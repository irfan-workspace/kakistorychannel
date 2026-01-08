-- Fix Security Definer Views - Convert to Security Invoker
DROP VIEW IF EXISTS public.user_usage_summary;
DROP VIEW IF EXISTS public.daily_cost_summary;
DROP VIEW IF EXISTS public.feature_cost_breakdown;
DROP VIEW IF EXISTS public.platform_usage_summary;

-- Recreate views with SECURITY INVOKER (default, explicit)
CREATE VIEW public.user_usage_summary 
WITH (security_invoker = on)
AS
SELECT 
  user_id,
  COUNT(*) as total_api_calls,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(cost_usd) as total_cost_usd,
  SUM(cost_inr) as total_cost_inr,
  COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_calls,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_calls,
  MAX(created_at) as last_api_call
FROM public.api_usage_logs
GROUP BY user_id;

CREATE VIEW public.daily_cost_summary 
WITH (security_invoker = on)
AS
SELECT 
  user_id,
  DATE(created_at) as date,
  feature,
  provider,
  model,
  COUNT(*) as api_calls,
  SUM(total_tokens) as tokens_used,
  SUM(cost_usd) as cost_usd,
  SUM(cost_inr) as cost_inr
FROM public.api_usage_logs
WHERE status = 'success'
GROUP BY user_id, DATE(created_at), feature, provider, model;

CREATE VIEW public.feature_cost_breakdown 
WITH (security_invoker = on)
AS
SELECT 
  user_id,
  feature,
  COUNT(*) as total_calls,
  SUM(total_tokens) as total_tokens,
  SUM(cost_usd) as total_cost_usd,
  SUM(cost_inr) as total_cost_inr,
  AVG(cost_usd) as avg_cost_per_call_usd,
  AVG(cost_inr) as avg_cost_per_call_inr
FROM public.api_usage_logs
WHERE status = 'success'
GROUP BY user_id, feature;

CREATE VIEW public.platform_usage_summary 
WITH (security_invoker = on)
AS
SELECT 
  DATE(created_at) as date,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) as total_api_calls,
  SUM(total_tokens) as total_tokens,
  SUM(cost_usd) as total_cost_usd,
  SUM(cost_inr) as total_cost_inr,
  COUNT(CASE WHEN feature = 'generate-scenes' THEN 1 END) as scene_generations,
  COUNT(CASE WHEN feature = 'generate-image' THEN 1 END) as image_generations,
  COUNT(CASE WHEN feature = 'generate-voiceover' THEN 1 END) as voiceover_generations,
  COUNT(CASE WHEN feature = 'export-video' THEN 1 END) as video_exports
FROM public.api_usage_logs
WHERE status = 'success'
GROUP BY DATE(created_at);

-- Fix overly permissive RLS policy - restrict to service role only
DROP POLICY IF EXISTS "Service role can insert usage logs" ON public.api_usage_logs;

CREATE POLICY "Service role can insert usage logs"
ON public.api_usage_logs
FOR INSERT
WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);