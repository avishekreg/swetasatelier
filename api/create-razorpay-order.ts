import type { VercelRequest, VercelResponse } from '@vercel/node';
import Razorpay from 'razorpay';
import { json, readJsonBody, requireUser } from './_lib/auth';

type CartLine = {
  itemId: string;
  quantity: number;
  type: 'stitched' | 'material';
  measurements?: Record<string, string>;
  unitPrice?: number;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const { admin, user } = await requireUser(req);

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return json(res, 500, { error: 'Razorpay keys are not configured on the server.' });
    }

    const body = readJsonBody<{
      items?: CartLine[];
      totalAmount?: number;
    }>(req);

    const items = body.items || [];
    const totalAmount = Number(body.totalAmount);

    if (!Array.isArray(items) || items.length === 0) {
      return json(res, 400, { error: 'Cart items are required.' });
    }

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return json(res, 400, { error: 'A valid totalAmount is required.' });
    }

    const itemIds = items.map((line) => line.itemId).filter(Boolean);
    const { data: catalogRows, error: catalogError } = await admin
      .from('items')
      .select('id, price, sale_price, cost_price, stock, showcase_type')
      .in('id', itemIds);

    if (catalogError) throw catalogError;

    const catalog = new Map((catalogRows || []).map((row) => [row.id as string, row]));

    for (const line of items) {
      const row = catalog.get(line.itemId);
      if (!row) {
        return json(res, 400, { error: `Item ${line.itemId} was not found in inventory.` });
      }
      if (row.showcase_type === 'ready_stock' && Number(row.stock) < line.quantity) {
        return json(res, 400, { error: 'Insufficient stock for one or more items.' });
      }
    }

    const amountPaise = Math.round(totalAmount * 100);
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

    const razorpayOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `swa_${Date.now()}`,
      notes: {
        user_id: user.id,
      },
    });

    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        user_id: user.id,
        status: 'pending',
        total_amount: totalAmount,
        razorpay_order_id: razorpayOrder.id,
      })
      .select('id')
      .single();

    if (orderError || !order) {
      throw orderError || new Error('Unable to create order record.');
    }

    const lineRows = items.map((line) => {
      const row = catalog.get(line.itemId);
      const sell =
        line.unitPrice ??
        (row?.sale_price != null ? Number(row.sale_price) : Number(row?.price ?? 0));
      const cost = row?.cost_price != null ? Number(row.cost_price) : 0;

      return {
        order_id: order.id,
        item_id: line.itemId || null,
        quantity: line.quantity,
        type: line.type || 'material',
        measurements: line.measurements || {},
        unit_price: sell,
        unit_cost: cost,
      };
    });

    const { error: linesError } = await admin.from('order_items').insert(lineRows);
    if (linesError) {
      throw linesError;
    }

    return json(res, 200, {
      orderId: order.id,
      razorpayOrderId: razorpayOrder.id,
      amount: amountPaise,
      currency: 'INR',
      keyId,
    });
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode || 500;
    return json(res, statusCode, {
      error: error instanceof Error ? error.message : 'Unable to create Razorpay order.',
    });
  }
}
