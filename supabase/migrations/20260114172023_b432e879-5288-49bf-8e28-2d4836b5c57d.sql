-- Fix the permissive audit log policy by restricting to authenticated users only
DROP POLICY IF EXISTS "System can insert audit logs" ON public.payment_audit_logs;

CREATE POLICY "Authenticated users can insert audit logs"
ON public.payment_audit_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);