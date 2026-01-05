-- Create generation_jobs table for job queue
CREATE TABLE public.generation_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  script_content TEXT NOT NULL,
  script_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create script_cache table for caching AI results
CREATE TABLE public.script_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  script_hash TEXT NOT NULL UNIQUE,
  language TEXT NOT NULL,
  story_type TEXT NOT NULL,
  tone TEXT NOT NULL,
  cached_scenes JSONB NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

-- Create user_rate_limits table for tracking API usage
CREATE TABLE public.user_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  request_count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_generation_jobs_user_id ON public.generation_jobs(user_id);
CREATE INDEX idx_generation_jobs_status ON public.generation_jobs(status);
CREATE INDEX idx_generation_jobs_scheduled ON public.generation_jobs(scheduled_at) WHERE status = 'queued';
CREATE INDEX idx_generation_jobs_project ON public.generation_jobs(project_id);
CREATE INDEX idx_script_cache_hash ON public.script_cache(script_hash);
CREATE INDEX idx_script_cache_expires ON public.script_cache(expires_at);
CREATE INDEX idx_user_rate_limits_user ON public.user_rate_limits(user_id);

-- Enable RLS
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies for generation_jobs
CREATE POLICY "Users can view their own jobs"
ON public.generation_jobs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own jobs"
ON public.generation_jobs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access to jobs"
ON public.generation_jobs
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- script_cache is accessed by service role only
CREATE POLICY "Service role full access to cache"
ON public.script_cache
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- user_rate_limits accessed by service role only
CREATE POLICY "Service role full access to rate limits"
ON public.user_rate_limits
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_generation_jobs_updated_at
BEFORE UPDATE ON public.generation_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_rate_limits_updated_at
BEFORE UPDATE ON public.user_rate_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check and update rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_user_id UUID, p_max_requests INTEGER DEFAULT 5, p_window_minutes INTEGER DEFAULT 1)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_request_count INTEGER;
  v_now TIMESTAMP WITH TIME ZONE := now();
BEGIN
  -- Get or create rate limit record
  INSERT INTO public.user_rate_limits (user_id, request_count, window_start)
  VALUES (p_user_id, 0, v_now)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get current values
  SELECT window_start, request_count INTO v_window_start, v_request_count
  FROM public.user_rate_limits
  WHERE user_id = p_user_id;

  -- Check if window has expired
  IF v_now > v_window_start + (p_window_minutes || ' minutes')::INTERVAL THEN
    -- Reset window
    UPDATE public.user_rate_limits
    SET window_start = v_now, request_count = 1, updated_at = v_now
    WHERE user_id = p_user_id;
    RETURN TRUE;
  END IF;

  -- Check if under limit
  IF v_request_count < p_max_requests THEN
    UPDATE public.user_rate_limits
    SET request_count = request_count + 1, updated_at = v_now
    WHERE user_id = p_user_id;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Function to check for active job
CREATE OR REPLACE FUNCTION public.has_active_job(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.generation_jobs
    WHERE user_id = p_user_id
    AND status IN ('queued', 'processing')
  );
END;
$$;