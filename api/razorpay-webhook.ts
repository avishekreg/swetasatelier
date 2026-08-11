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
      const { error } = await admin
        .from('orders')
        .update({
          status: 'processing',
          razorpay_payment_id: payment.id,
        })
        .eq('razorpay_order_id', payment.order_id);

      if (error) {
        throw error;
      }
    }

    return json(res, 200, { received: true });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : 'Webhook processing failed.',
    });
  }
}
