-- Razorpay Marketplace Upgrade for existing Learning Hub marketplace tables
-- Run this once in Supabase SQL Editor before testing Razorpay Checkout.

ALTER TABLE public.project_purchases
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'manual_upi',
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR',
ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT,
ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT,
ADD COLUMN IF NOT EXISTS razorpay_signature TEXT,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP WITHOUT TIME ZONE;

-- Razorpay payments do not require manual screenshot/reference proof.
ALTER TABLE public.project_purchases
ALTER COLUMN screenshot_url DROP NOT NULL;

ALTER TABLE public.project_purchases
ALTER COLUMN transaction_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_purchases_buyer_id
ON public.project_purchases(buyer_id);

CREATE INDEX IF NOT EXISTS idx_project_purchases_project_id
ON public.project_purchases(project_id);

CREATE INDEX IF NOT EXISTS idx_project_purchases_status
ON public.project_purchases(status);

CREATE INDEX IF NOT EXISTS idx_project_purchases_razorpay_order_id
ON public.project_purchases(razorpay_order_id);

CREATE INDEX IF NOT EXISTS idx_project_purchases_razorpay_payment_id
ON public.project_purchases(razorpay_payment_id);

ALTER TABLE public.project_earnings
ADD COLUMN IF NOT EXISTS instructor_share NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS instructor_id INTEGER REFERENCES public.users(id),
ADD COLUMN IF NOT EXISTS payout_note TEXT,
ADD COLUMN IF NOT EXISTS received_at TIMESTAMP WITHOUT TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_project_earnings_uploader_id
ON public.project_earnings(uploader_id);

CREATE INDEX IF NOT EXISTS idx_project_earnings_purchase_id
ON public.project_earnings(purchase_id);

CREATE INDEX IF NOT EXISTS idx_project_earnings_payout_status
ON public.project_earnings(payout_status);
