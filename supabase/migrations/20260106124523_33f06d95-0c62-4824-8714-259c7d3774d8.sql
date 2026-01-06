-- Add progress and scenes_generated columns to generation_jobs
ALTER TABLE public.generation_jobs 
ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS scenes_generated integer NOT NULL DEFAULT 0;

-- Add constraint to ensure progress is between 0 and 100
ALTER TABLE public.generation_jobs 
ADD CONSTRAINT progress_range CHECK (progress >= 0 AND progress <= 100);

-- Add constraint to ensure scenes_generated is non-negative
ALTER TABLE public.generation_jobs 
ADD CONSTRAINT scenes_generated_non_negative CHECK (scenes_generated >= 0);

-- Create index for finding stale jobs
CREATE INDEX IF NOT EXISTS idx_generation_jobs_stale 
ON public.generation_jobs (user_id, status, updated_at) 
WHERE status IN ('queued', 'processing');

-- Update has_active_job function to return job details for stale detection
CREATE OR REPLACE FUNCTION public.get_active_job(p_user_id uuid)
RETURNS TABLE (
  job_id uuid,
  status text,
  updated_at timestamp with time zone,
  project_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT gj.id, gj.status, gj.updated_at, gj.project_id
  FROM public.generation_jobs gj
  WHERE gj.user_id = p_user_id
  AND gj.status IN ('queued', 'processing')
  ORDER BY gj.created_at DESC
  LIMIT 1;
END;
$function$;

-- Function to mark stale job as failed and release lock
CREATE OR REPLACE FUNCTION public.mark_job_as_stale(p_job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.generation_jobs
  SET 
    status = 'failed',
    error_message = 'Job timed out',
    completed_at = now(),
    updated_at = now()
  WHERE id = p_job_id
  AND status IN ('queued', 'processing');
  
  RETURN FOUND;
END;
$function$;