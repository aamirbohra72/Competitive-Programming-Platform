'use client';

import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { markLocalEnrollments } from '@/lib/enrollment';

export type CreateOrderResponse = {
  orderId: string;
  amount: number;
  currency: string;
  productId: string;
  productTitle: string;
  keyId: string;
  paymentDbId: string;
  grantsProductIds?: string[];
};

export type VerifyPaymentResponse = {
  ok: boolean;
  alreadyPaid?: boolean;
  productId: string;
  productIds?: string[];
};

export type CheckoutResult = {
  productId: string;
  productIds: string[];
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

async function pollEnrollment(productId: string, attempts = 10): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      const data = await api.get<{ enrolled: boolean }>(
        `/payments/enrollments/${encodeURIComponent(productId)}`,
      );
      if (data.enrolled) return true;
    } catch {
      /* webhook may still be in flight */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

export async function startRazorpayCheckout(productId: string): Promise<CheckoutResult> {
  if (!getToken()) {
    throw new Error('Please sign in before paying');
  }

  const order = await api.post<CreateOrderResponse>('/payments/create-order', { productId });
  const ok = await loadRazorpayScript();
  if (!ok || !window.Razorpay) {
    throw new Error('Failed to load Razorpay checkout');
  }

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: order.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      name: 'Codeforces Platform',
      description: order.productTitle,
      order_id: order.orderId,
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        let productIds = [order.productId, ...(order.grantsProductIds ?? [])];
        try {
          const verified = await api.post<VerifyPaymentResponse>('/payments/verify', {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          if (verified.productIds?.length) {
            productIds = verified.productIds;
          }
        } catch {
          /* Browser verify can fail; webhook fulfillment is the source of truth. */
        }

        const enrolled = await pollEnrollment(order.productId);
        if (!enrolled) {
          reject(
            new Error(
              'Payment received but enrollment is still pending. Refresh this page in a moment.',
            ),
          );
          return;
        }

        const unique = Array.from(new Set(productIds));
        markLocalEnrollments(unique);
        resolve({ productId: order.productId, productIds: unique });
      },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled')),
      },
      theme: { color: '#22c55e' },
    });
    rzp.open();
  });
}
