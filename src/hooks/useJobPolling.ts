import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// STRICT STATE MACHINE: Only these states allowed
export type JobStatus = 'idle' | 'queued' | 'processing' | 'completed' | 'failed';

interface JobState {
  jobId: string | null;
  status: JobStatus;
  progress: number;
  scenesGenerated: number;
  failureReason: string | null;
  scenes: any[] | null;
}

interface UseJobPollingOptions {
  pollInterval?: number;
  maxPollTime?: number;
  onCompleted?: (scenes: any[]) => void;
  onFailed?: (error: string) => void;
}

// Session storage key for persisting job state
const JOB_STATE_KEY = 'scene_generation_job';

function saveJobToSession(projectId: string, jobId: string, status: JobStatus): void {
  try {
    sessionStorage.setItem(`${JOB_STATE_KEY}_${projectId}`, JSON.stringify({ jobId, status }));
  } catch (e) {
    console.warn('Failed to save job state to session:', e);
  }
}

function loadJobFromSession(projectId: string): { jobId: string; status: JobStatus } | null {
  try {
    const saved = sessionStorage.getItem(`${JOB_STATE_KEY}_${projectId}`);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load job state from session:', e);
  }
  return null;
}

function clearJobFromSession(projectId: string): void {
  try {
    sessionStorage.removeItem(`${JOB_STATE_KEY}_${projectId}`);
  } catch (e) {
    console.warn('Failed to clear job state from session:', e);
  }
}

export function useJobPolling(projectId: string | null, options: UseJobPollingOptions = {}) {
  const {
    pollInterval = 3000,
    maxPollTime = 300000, // 5 minutes max (matches backend timeout)
    onCompleted,
    onFailed,
  } = options;

  const [jobState, setJobState] = useState<JobState>({
    jobId: null,
    status: 'idle',
    progress: 0,
    scenesGenerated: 0,
    failureReason: null,
    scenes: null,
  });

  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
    startTimeRef.current = null;
  }, []);

  const checkJobStatus = useCallback(async (jobId: string): Promise<boolean> => {
    if (!mountedRef.current) return true;

    try {
      // Check if user is still authenticated before polling
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No active session, stopping polling');
        stopPolling();
        if (projectId) clearJobFromSession(projectId);
        return true;
      }

      const { data, error } = await supabase.functions.invoke('check-job-status', {
        body: { jobId },
      });

      if (!mountedRef.current) return true;

      if (error) {
        console.error('Job status check error:', error);

        const status = (error as any)?.context?.status ?? (error as any)?.status;
        if (status === 404) {
          console.warn('Job not found during polling, clearing local job state', { jobId });
          stopPolling();
          if (projectId) clearJobFromSession(projectId);
          setJobState({
            jobId: null,
            status: 'idle',
            progress: 0,
            scenesGenerated: 0,
            failureReason: null,
            scenes: null,
          });
          toast.error('That generation job is no longer available. Please generate again.');
          return true;
        }
        
        // Check if it's an auth error
        const errorMessage = error.message?.toLowerCase() || '';
        if (errorMessage.includes('401') || errorMessage.includes('auth') || errorMessage.includes('session')) {
          console.log('Auth error during polling, will retry after session check');
          // Don't fail permanently on auth errors - the session check above will handle it
          return false;
        }
        
        // Don't fail immediately on transient errors
        return false;
      }

      // Update state from backend (source of truth)
      setJobState(prev => ({
        ...prev,
        status: data.status as JobStatus,
        progress: data.progress || 0,
        scenesGenerated: data.scenesGenerated || 0,
        failureReason: data.failureReason || null,
        scenes: data.scenes || null,
      }));

      // Handle terminal states
      if (data.status === 'completed') {
        stopPolling();
        if (projectId) clearJobFromSession(projectId);
        if (data.scenes && onCompleted) {
          onCompleted(data.scenes);
        }
        return true;
      }

      if (data.status === 'failed') {
        stopPolling();
        if (projectId) clearJobFromSession(projectId);
        if (onFailed) {
          onFailed(data.failureReason || 'Generation failed');
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error('Polling error:', error);
      // Don't stop on transient errors
      return false;
    }
  }, [stopPolling, onCompleted, onFailed, projectId]);

  const startPolling = useCallback((jobId: string, initialStatus: JobStatus = 'queued') => {
    // Don't start if already terminal
    if (initialStatus === 'completed' || initialStatus === 'failed') {
      return;
    }

    stopPolling();
    startTimeRef.current = Date.now();
    
    const poll = async () => {
      if (!mountedRef.current) return;

      // Check if we've exceeded max poll time
      if (startTimeRef.current && Date.now() - startTimeRef.current > maxPollTime) {
        stopPolling();
        setJobState(prev => ({
          ...prev,
          status: 'failed',
          failureReason: 'The generation is taking too long. Please try again.',
        }));
        if (projectId) clearJobFromSession(projectId);
        if (onFailed) {
          onFailed('Generation timed out');
        }
        return;
      }

      const isDone = await checkJobStatus(jobId);
      
      if (!isDone && mountedRef.current) {
        pollingRef.current = setTimeout(poll, pollInterval);
      }
    };

    // Initial check
    poll();
  }, [checkJobStatus, pollInterval, maxPollTime, stopPolling, onFailed, projectId]);

  const submitJob = useCallback(async (
    script: string,
    language: string,
    storyType: string,
    tone: string
  ) => {
    if (!projectId) {
      toast.error('Project not found');
      return;
    }

    // Set to queued immediately for responsive UI
    setJobState({
      jobId: null,
      status: 'queued',
      progress: 5,
      scenesGenerated: 0,
      failureReason: null,
      scenes: null,
    });

    try {
      const { data, error } = await supabase.functions.invoke('submit-scene-job', {
        body: {
          projectId,
          script,
          language,
          storyType,
          tone,
        },
      });

      // Handle different response scenarios
      if (error) {
        // Check if it's a FunctionsHttpError with a response
        const errorData = error as any;
        
        // Try to extract the actual response data for 409 handling
        if (errorData?.context?.status === 409 || errorData?.status === 409) {
          // 409 is NOT an error - it means we have an existing job
          // We need to get the job data from the error response
          console.log('409 response - existing job detected');
          
          // The functions.invoke wraps 409 as an error, but we need to handle it
          // Try to parse the response body if available
          try {
            const responseBody = errorData?.context?.body || errorData?.message;
            if (responseBody && typeof responseBody === 'string') {
              const parsed = JSON.parse(responseBody);
              if (parsed.jobId) {
                console.log(`Resuming existing job: ${parsed.jobId}`);
                setJobState(prev => ({
                  ...prev,
                  jobId: parsed.jobId,
                  status: (parsed.status as JobStatus) || 'processing',
                }));
                saveJobToSession(projectId, parsed.jobId, (parsed.status as JobStatus) || 'processing');
                startPolling(parsed.jobId, (parsed.status as JobStatus) || 'processing');
                return { jobId: parsed.jobId, existingJob: true };
              }
            }
          } catch (parseError) {
            console.warn('Could not parse 409 response:', parseError);
          }
        }

        // Real error
        throw new Error(error.message || 'Failed to submit job');
      }

      // Handle 409 from successful response (shouldn't happen with invoke but just in case)
      if (data?.existingJob && data?.jobId) {
        console.log(`Existing job found: ${data.jobId}, status: ${data.status}`);
        setJobState(prev => ({
          ...prev,
          jobId: data.jobId,
          status: (data.status as JobStatus) || 'processing',
        }));
        saveJobToSession(projectId, data.jobId, (data.status as JobStatus) || 'processing');
        startPolling(data.jobId, (data.status as JobStatus) || 'processing');
        return data;
      }

      // Handle cached result (immediate completion)
      if (data.cached && data.status === 'completed') {
        setJobState({
          jobId: data.jobId,
          status: 'completed',
          progress: 100,
          scenesGenerated: data.scenesGenerated || 0,
          failureReason: null,
          scenes: data.scenes,
        });
        
        if (onCompleted && data.scenes) {
          onCompleted(data.scenes);
        }
        
        toast.success('Scenes loaded from cache!');
        return data;
      }

      // Normal job creation
      setJobState(prev => ({
        ...prev,
        jobId: data.jobId,
        status: (data.status as JobStatus) || 'queued',
        progress: data.progress || 5,
      }));

      saveJobToSession(projectId, data.jobId, (data.status as JobStatus) || 'queued');
      startPolling(data.jobId, (data.status as JobStatus) || 'queued');
      return data;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit job';
      
      // Map technical errors to user-friendly messages
      let userMessage = message;
      if (message.includes('rate limit') || message.includes('429')) {
        userMessage = 'Please wait a moment before generating more scenes';
      } else if (message.includes('authentication') || message.includes('401')) {
        userMessage = 'Please log in again to continue';
      } else if (message.includes('500') || message.includes('service')) {
        userMessage = 'Service temporarily unavailable. Please try again.';
      }

      setJobState(prev => ({
        ...prev,
        status: 'failed',
        failureReason: userMessage,
      }));
      toast.error(userMessage);
      throw error;
    }
  }, [projectId, startPolling, onCompleted]);

  const reset = useCallback(() => {
    stopPolling();
    if (projectId) clearJobFromSession(projectId);
    setJobState({
      jobId: null,
      status: 'idle',
      progress: 0,
      scenesGenerated: 0,
      failureReason: null,
      scenes: null,
    });
  }, [stopPolling, projectId]);

  // Resume polling on mount if there's an active job (refresh safety)
  useEffect(() => {
    if (!projectId) return;

    const resumePolling = async () => {
      // Wait for session to be ready before resuming
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No session available, clearing saved job state');
        clearJobFromSession(projectId);
        return;
      }

      const savedJob = loadJobFromSession(projectId);
      if (savedJob && savedJob.jobId && savedJob.status !== 'completed' && savedJob.status !== 'failed') {
        console.log(`Resuming job ${savedJob.jobId} from session (status: ${savedJob.status})`);
        setJobState(prev => ({
          ...prev,
          jobId: savedJob.jobId,
          status: savedJob.status,
        }));
        startPolling(savedJob.jobId, savedJob.status);
      }
    };

    resumePolling();
  }, [projectId, startPolling]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  return {
    ...jobState,
    isProcessing: jobState.status === 'queued' || jobState.status === 'processing',
    canRetry: jobState.status === 'failed',
    submitJob,
    reset,
    stopPolling,
  };
}
