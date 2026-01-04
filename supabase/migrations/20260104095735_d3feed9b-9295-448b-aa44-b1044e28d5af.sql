-- Fix subscription security - prevent users from modifying their own subscriptions
-- Drop existing overly permissive update policy if exists
DROP POLICY IF EXISTS "Users can view their own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update their subscription" ON public.subscriptions;

-- Create proper read-only policy for users viewing their subscriptions
CREATE POLICY "Users can view their own subscription"
ON public.subscriptions
FOR SELECT
USING (auth.uid() = user_id);

-- Only admins can update subscriptions (via has_role function)
CREATE POLICY "Admins can update subscriptions"
ON public.subscriptions
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert subscriptions (system/payment processing)
DROP POLICY IF EXISTS "Users can insert subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can insert their subscription" ON public.subscriptions;

CREATE POLICY "Admins can insert subscriptions"
ON public.subscriptions
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix usage_logs security - prevent tampering
DROP POLICY IF EXISTS "Users can update usage logs" ON public.usage_logs;
DROP POLICY IF EXISTS "Users can delete usage logs" ON public.usage_logs;

-- Explicitly deny user updates/deletes by only allowing admins
CREATE POLICY "Admins can update usage logs"
ON public.usage_logs
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete usage logs"
ON public.usage_logs
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Fix profiles - add explicit delete policy (admin only for cleanup)
DROP POLICY IF EXISTS "Users can delete their profile" ON public.profiles;

CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));