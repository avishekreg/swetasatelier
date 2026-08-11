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

    const lineRows = items.map((line) => ({
      order_id: order.id,
      item_id: line.itemId || null,
      quantity: line.quantity,
      type: line.type,
      measurements: line.measurements || {},
      unit_price: line.unitPrice ?? null,
    }));

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
