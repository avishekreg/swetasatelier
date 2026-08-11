import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { getServiceClient, json, readJsonBody } from './_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return json(res, 500, { error: 'RAZORPAY_WEBHOOK_SECRET is not configured.' });
    }

    const signatureHeader = req.headers['x-razorpay-signature'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

    if (!signature) {
      return json(res, 400, { error: 'Missing Razorpay signature.' });
    }

    const rawBody =
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});

    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

    if (expected !== signature) {
      return json(res, 401, { error: 'Invalid Razorpay webhook signature.' });
    }

    const payload = readJsonBody<{
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            status?: string;
          };
        };
      };
    }>(req);

    const event = payload.event;
    const payment = payload.payload?.payment?.entity;

    if (event === 'payment.captured' && payment?.order_id && payment?.id) {
      const admin = getServiceClient();

      const { data: order, error: orderLookupError } = await admin
        .from('orders')
        .select('id, status, total_amount, user_id')
        .eq('razorpay_order_id', payment.order_id)
        .maybeSingle();

      if (orderLookupError) throw orderLookupError;
      if (!order) {
        return json(res, 404, { error: 'Order not found for Razorpay payment.' });
      }

      // Idempotent: skip stock/accounts if already past pending
      const alreadyProcessed = order.status !== 'pending';

      const { error: updateError } = await admin
        .from('orders')
        .update({
          status: 'processing',
          razorpay_payment_id: payment.id,
        })
        .eq('id', order.id);

      if (updateError) throw updateError;

      if (!alreadyProcessed) {
        const { error: stockError } = await admin.rpc('decrement_stock_for_order', {
          p_order_id: order.id,
        });
        if (stockError) {
          // Fallback if RPC not migrated yet
          console.warn('decrement_stock_for_order RPC failed, using inline fallback:', stockError.message);
          const { data: lines } = await admin
            .from('order_items')
            .select('item_id, quantity')
            .eq('order_id', order.id);

          for (const line of lines || []) {
            if (!line.item_id) continue;
            const { data: item } = await admin
              .from('items')
              .select('stock, showcase_type')
              .eq('id', line.item_id)
              .maybeSingle();
            if (!item || item.showcase_type !== 'ready_stock') continue;
            const nextStock = Math.max(0, Number(item.stock) - Number(line.quantity));
            await admin.from('items').update({ stock: nextStock }).eq('id', line.item_id);
          }
        }

        const { data: lines } = await admin
          .from('order_items')
          .select('quantity, unit_price, unit_cost')
          .eq('order_id', order.id);

        let costAmount = 0;
        let sellAmount = 0;
        for (const line of lines || []) {
          const qty = Number(line.quantity || 0);
          costAmount += qty * Number(line.unit_cost || 0);
          sellAmount += qty * Number(line.unit_price || 0);
        }
        const profitAmount = sellAmount - costAmount;
        const marginAmount = sellAmount > 0 ? (profitAmount / sellAmount) * 100 : 0;

        // Soft note on order via accounts entry when settings exist
        const { data: settings } = await admin
          .from('accounts_settings')
          .select('*')
          .eq('id', 'current')
          .maybeSingle();

        if (settings) {
          const invoiceNumber = `${settings.invoice_prefix}-${String(settings.next_invoice_number).padStart(4, '0')}`;
          const gstRate = Number(settings.default_gst_rate || 5);
          const taxMode = settings.default_tax_mode || 'intra_state';
          const taxable = sellAmount / (1 + gstRate / 100);
          const tax = sellAmount - taxable;
          const half = tax / 2;

          await admin.from('accounts_entries').insert({
            source_order_id: order.id,
            invoice_number: invoiceNumber,
            invoice_date: new Date().toISOString().slice(0, 10),
            customer_name: 'Online customer',
            place_of_supply: settings.state_name || 'Maharashtra',
            item_summary: `Order ${String(order.id).slice(0, 8)}`,
            taxable_amount: Number(taxable.toFixed(2)),
            gst_rate: gstRate,
            tax_mode: taxMode,
            cgst_amount: taxMode === 'intra_state' ? Number(half.toFixed(2)) : 0,
            sgst_amount: taxMode === 'intra_state' ? Number(half.toFixed(2)) : 0,
            igst_amount: taxMode === 'inter_state' ? Number(tax.toFixed(2)) : 0,
            total_amount: Number(sellAmount.toFixed(2)),
            cost_amount: Number(costAmount.toFixed(2)),
            margin_amount: Number(marginAmount.toFixed(2)),
            profit_amount: Number(profitAmount.toFixed(2)),
            payment_status: 'paid',
            payment_method: 'razorpay',
            notes: `Auto-posted from Razorpay payment ${payment.id}`,
          });

          await admin
            .from('accounts_settings')
            .update({ next_invoice_number: Number(settings.next_invoice_number) + 1 })
            .eq('id', 'current');
        }
      }
    }

    return json(res, 200, { received: true });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : 'Webhook processing failed.',
    });
  }
}
