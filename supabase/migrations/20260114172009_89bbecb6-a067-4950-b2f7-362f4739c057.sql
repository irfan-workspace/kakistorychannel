-- Add role column to profiles table for admin access control
ALTER TABLE public.profiles ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Create payment_requests table for tracking payment requests
CREATE TABLE public.payment_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  credits INTEGER NOT NULL CHECK (credits > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  upi_transaction_id TEXT,
  payer_vpa TEXT,
  payment_method TEXT CHECK (payment_method IN ('phonepe', 'googlepay', 'upi')),
  qr_code_data TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '15 minutes'),
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payment_transactions table for completed transactions
CREATE TABLE public.payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_request_id UUID NOT NULL REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  credits_added INTEGER NOT NULL,
  upi_transaction_id TEXT NOT NULL,
  payer_vpa TEXT,
  payment_method TEXT,
  transaction_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payment_audit_logs table for security audit trail
CREATE TABLE public.payment_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  actor_id UUID,
  actor_role TEXT,
  ip_address TEXT,
  user_agent TEXT,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_payment_requests_user_id ON public.payment_requests(user_id);
CREATE INDEX idx_payment_requests_status ON public.payment_requests(status);
CREATE INDEX idx_payment_requests_expires_at ON public.payment_requests(expires_at);
CREATE INDEX idx_payment_transactions_user_id ON public.payment_transactions(user_id);
CREATE INDEX idx_payment_transactions_upi_id ON public.payment_transactions(upi_transaction_id);
CREATE INDEX idx_payment_audit_logs_request_id ON public.payment_audit_logs(payment_request_id);
CREATE INDEX idx_payment_audit_logs_created_at ON public.payment_audit_logs(created_at);

-- Enable RLS
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_requests
CREATE POLICY "Users can view their own payment requests"
ON public.payment_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own payment requests"
ON public.payment_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all payment requests"
ON public.payment_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can update payment requests"
ON public.payment_requests FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- RLS Policies for payment_transactions
CREATE POLICY "Users can view their own transactions"
ON public.payment_transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions"
ON public.payment_transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can insert transactions"
ON public.payment_transactions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- RLS Policies for payment_audit_logs
CREATE POLICY "Admins can view audit logs"
ON public.payment_audit_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "System can insert audit logs"
ON public.payment_audit_logs FOR INSERT
WITH CHECK (true);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_payment_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_payment_requests_updated_at
BEFORE UPDATE ON public.payment_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_payment_request_updated_at();

-- Function to generate transaction hash for integrity
CREATE OR REPLACE FUNCTION public.generate_transaction_hash(
  p_request_id UUID,
  p_user_id UUID,
  p_amount DECIMAL,
  p_upi_id TEXT,
  p_timestamp TIMESTAMP WITH TIME ZONE
) RETURNS TEXT AS $$
BEGIN
  RETURN encode(
    sha256(
      (p_request_id::text || p_user_id::text || p_amount::text || p_upi_id || p_timestamp::text)::bytea
    ),
    'hex'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Function to add credits after successful payment
CREATE OR REPLACE FUNCTION public.add_credits_after_payment()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET credits_balance = COALESCE(credits_balance, 0) + NEW.credits_added
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER add_credits_on_transaction
AFTER INSERT ON public.payment_transactions
FOR EACH ROW
EXECUTE FUNCTION public.add_credits_after_payment();