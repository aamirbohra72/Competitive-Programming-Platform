import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { requireUserId } from '../lib/errors';
import {
  createPaymentOrder,
  handleRazorpayWebhook,
  verifyPayment,
} from '../services/razorpayService';
import {
  listProducts,
  listUserEnrollments,
  listUserPayments,
  userHasEnrollment,
} from '../services/productCatalog';

const createOrderSchema = z.object({
  productId: z.string().min(1),
});

const verifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export const paymentController = {
  async listProducts(_req: AuthRequest, res: Response): Promise<void> {
    res.json({ products: listProducts() });
  },

  async createOrder(req: AuthRequest, res: Response): Promise<void> {
    const userId = requireUserId(req.user?.userId);
    const body = createOrderSchema.parse(req.body);
    const order = await createPaymentOrder(userId, body.productId);
    res.status(201).json(order);
  },

  async verify(req: AuthRequest, res: Response): Promise<void> {
    const userId = requireUserId(req.user?.userId);
    const body = verifySchema.parse(req.body);
    const result = await verifyPayment({
      userId,
      razorpayOrderId: body.razorpay_order_id,
      razorpayPaymentId: body.razorpay_payment_id,
      razorpaySignature: body.razorpay_signature,
    });
    res.json(result);
  },

  async webhook(req: Request, res: Response): Promise<void> {
    const signature = String(req.headers['x-razorpay-signature'] || '');
    const eventId = String(req.headers['x-razorpay-event-id'] || '');
    const raw = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));
    const result = await handleRazorpayWebhook(raw, signature, eventId || undefined);
    res.json(result);
  },

  async myEnrollments(req: AuthRequest, res: Response): Promise<void> {
    const userId = requireUserId(req.user?.userId);
    const enrollments = await listUserEnrollments(userId);
    res.json({ enrollments });
  },

  async myPayments(req: AuthRequest, res: Response): Promise<void> {
    const userId = requireUserId(req.user?.userId);
    const payments = await listUserPayments(userId);
    res.json({ payments });
  },

  async checkEnrollment(req: AuthRequest, res: Response): Promise<void> {
    const userId = requireUserId(req.user?.userId);
    const productId = req.params.productId;
    const enrolled = await userHasEnrollment(userId, productId);
    res.json({ enrolled });
  },
};
