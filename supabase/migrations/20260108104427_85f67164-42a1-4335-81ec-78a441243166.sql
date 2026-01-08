-- Create api_usage_logs table for granular tracking
CREATE TABLE public.api_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  scene_id UUID REFERENCES public.scenes(id) ON DELETE SET NULL,
  
  provider TEXT NOT NULL, -- google | elevenlabs
  model TEXT NOT NULL, -- gemini-2.5-flash | flash-image-preview | elevenlabs-v2
  feature TEXT NOT NULL, -- generate-scenes | generate-image | voiceover | export-video
  
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  
  api_calls INTEGER DEFAULT 1,
  cost_usd NUMERIC(10, 6) DEFAULT 0,
  cost_inr NUMERIC(10, 4) DEFAULT 0,
  
  status TEXT NOT NULL DEFAULT 'success', -- success | failed
  error_message TEXT,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_api_usage_logs_user_id ON public.api_usage_logs(user_id);
CREATE INDEX idx_api_usage_logs_project_id ON public.api_usage_logs(project_id);
CREATE INDEX idx_api_usage_logs_created_at ON public.api_usage_logs(created_at DESC);
CREATE INDEX idx_api_usage_logs_feature ON public.api_usage_logs(feature);
CREATE INDEX idx_api_usage_logs_provider ON public.api_usage_logs(provider);
CREATE INDEX idx_api_usage_logs_status ON public.api_usage_logs(status);

-- Composite index for common queries
CREATE INDEX idx_api_usage_logs_user_date ON public.api_usage_logs(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own usage logs"
ON public.api_usage_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all usage logs"
ON public.api_usage_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage all usage logs"
ON public.api_usage_logs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert usage logs"
ON public.api_usage_logs
FOR INSERT
WITH CHECK (true);

-- Create view for user usage summary
CREATE OR REPLACE VIEW public.user_usage_summary AS
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

-- Create view for daily cost summary
CREATE OR REPLACE VIEW public.daily_cost_summary AS
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
GROUP BY user_id, DATE(created_at), feature, provider, model
ORDER BY date DESC;

-- Create view for feature cost breakdown
CREATE OR REPLACE VIEW public.feature_cost_breakdown AS
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

-- Create admin platform summary view
CREATE OR REPLACE VIEW public.platform_usage_summary AS
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
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Function to get user usage stats
CREATE OR REPLACE FUNCTION public.get_user_usage_stats(p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  total_api_calls BIGINT,
  total_tokens BIGINT,
  total_cost_usd NUMERIC,
  total_cost_inr NUMERIC,
  successful_calls BIGINT,
  failed_calls BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_api_calls,
    COALESCE(SUM(l.total_tokens), 0)::BIGINT as total_tokens,
    COALESCE(SUM(l.cost_usd), 0)::NUMERIC as total_cost_usd,
    COALESCE(SUM(l.cost_inr), 0)::NUMERIC as total_cost_inr,
    COUNT(CASE WHEN l.status = 'success' THEN 1 END)::BIGINT as successful_calls,
    COUNT(CASE WHEN l.status = 'failed' THEN 1 END)::BIGINT as failed_calls
  FROM public.api_usage_logs l
  WHERE l.user_id = p_user_id
  AND l.created_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$;