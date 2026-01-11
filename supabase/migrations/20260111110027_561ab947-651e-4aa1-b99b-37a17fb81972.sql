-- Fix security for database views
-- Views inherit RLS from their base tables, but we should create security definer functions for safer access

-- Create a function to get user's own daily cost summary
CREATE OR REPLACE FUNCTION public.get_user_daily_costs(p_user_id uuid, p_days integer DEFAULT 30)
RETURNS TABLE (
  date date,
  feature text,
  provider text,
  model text,
  api_calls bigint,
  tokens_used bigint,
  cost_usd numeric,
  cost_inr numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(l.created_at) as date,
    l.feature,
    l.provider,
    l.model,
    COUNT(*)::BIGINT as api_calls,
    COALESCE(SUM(l.total_tokens), 0)::BIGINT as tokens_used,
    COALESCE(SUM(l.cost_usd), 0)::NUMERIC as cost_usd,
    COALESCE(SUM(l.cost_inr), 0)::NUMERIC as cost_inr
  FROM public.api_usage_logs l
  WHERE l.user_id = p_user_id
  AND l.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY DATE(l.created_at), l.feature, l.provider, l.model
  ORDER BY date DESC;
END;
$$;

-- Create a function to get user's feature cost breakdown
CREATE OR REPLACE FUNCTION public.get_user_feature_costs(p_user_id uuid)
RETURNS TABLE (
  feature text,
  total_calls bigint,
  total_tokens bigint,
  total_cost_usd numeric,
  total_cost_inr numeric,
  avg_cost_per_call_usd numeric,
  avg_cost_per_call_inr numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.feature,
    COUNT(*)::BIGINT as total_calls,
    COALESCE(SUM(l.total_tokens), 0)::BIGINT as total_tokens,
    COALESCE(SUM(l.cost_usd), 0)::NUMERIC as total_cost_usd,
    COALESCE(SUM(l.cost_inr), 0)::NUMERIC as total_cost_inr,
    ROUND(COALESCE(AVG(l.cost_usd), 0)::NUMERIC, 6) as avg_cost_per_call_usd,
    ROUND(COALESCE(AVG(l.cost_inr), 0)::NUMERIC, 4) as avg_cost_per_call_inr
  FROM public.api_usage_logs l
  WHERE l.user_id = p_user_id
  GROUP BY l.feature
  ORDER BY total_cost_usd DESC;
END;
$$;

-- Create admin-only function for platform usage summary
CREATE OR REPLACE FUNCTION public.get_platform_usage_summary(p_user_id uuid, p_days integer DEFAULT 30)
RETURNS TABLE (
  date date,
  unique_users bigint,
  total_api_calls bigint,
  total_tokens bigint,
  total_cost_usd numeric,
  total_cost_inr numeric,
  scene_generations bigint,
  image_generations bigint,
  voiceover_generations bigint,
  video_exports bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT public.has_role(p_user_id, 'admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  RETURN QUERY
  SELECT 
    DATE(l.created_at) as date,
    COUNT(DISTINCT l.user_id)::BIGINT as unique_users,
    COUNT(*)::BIGINT as total_api_calls,
    COALESCE(SUM(l.total_tokens), 0)::BIGINT as total_tokens,
    COALESCE(SUM(l.cost_usd), 0)::NUMERIC as total_cost_usd,
    COALESCE(SUM(l.cost_inr), 0)::NUMERIC as total_cost_inr,
    COUNT(CASE WHEN l.feature = 'generate-scenes' THEN 1 END)::BIGINT as scene_generations,
    COUNT(CASE WHEN l.feature = 'generate-image' THEN 1 END)::BIGINT as image_generations,
    COUNT(CASE WHEN l.feature = 'generate-voiceover' THEN 1 END)::BIGINT as voiceover_generations,
    COUNT(CASE WHEN l.feature = 'export-video' THEN 1 END)::BIGINT as video_exports
  FROM public.api_usage_logs l
  WHERE l.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY DATE(l.created_at)
  ORDER BY date DESC;
END;
$$;

-- Create admin-only function to get all user usage summaries
CREATE OR REPLACE FUNCTION public.get_all_users_usage(p_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  total_api_calls bigint,
  total_tokens bigint,
  total_cost_usd numeric,
  total_cost_inr numeric,
  successful_calls bigint,
  failed_calls bigint,
  last_api_call timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT public.has_role(p_user_id, 'admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  RETURN QUERY
  SELECT 
    l.user_id,
    COUNT(*)::BIGINT as total_api_calls,
    COALESCE(SUM(l.total_tokens), 0)::BIGINT as total_tokens,
    COALESCE(SUM(l.cost_usd), 0)::NUMERIC as total_cost_usd,
    COALESCE(SUM(l.cost_inr), 0)::NUMERIC as total_cost_inr,
    COUNT(CASE WHEN l.status = 'success' THEN 1 END)::BIGINT as successful_calls,
    COUNT(CASE WHEN l.status = 'failed' THEN 1 END)::BIGINT as failed_calls,
    MAX(l.created_at) as last_api_call
  FROM public.api_usage_logs l
  GROUP BY l.user_id
  ORDER BY total_cost_usd DESC;
END;
$$;