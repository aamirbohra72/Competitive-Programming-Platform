-- Unique payment id for idempotent Razorpay fulfillment (Postgres allows multiple NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentOrder_razorpayPaymentId_key" ON "PaymentOrder"("razorpayPaymentId");

-- Webhook event audit / duplicate skip
CREATE TABLE IF NOT EXISTS "RazorpayWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RazorpayWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RazorpayWebhookEvent_eventId_key" ON "RazorpayWebhookEvent"("eventId");

-- PENDING reaper lookups
CREATE INDEX IF NOT EXISTS "Submission_status_submittedAt_idx" ON "Submission"("status", "submittedAt");
