import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type JobStatus = 'idle' | 'queued' | 'processing' | 'completed' | 'failed';

interface JobState {
  jobId: string | null;
  status: JobStatus;
  progress: number;
  estimatedTimeRemaining: number | null;
  errorMessage: string | null;
  scenes: any[] | null;
}

interface UseJobPollingOptions {
  pollInterval?: number;
  maxPollTime?: number;
  onCompleted?: (scenes: any[]) => void;
  onFailed?: (error: string) => void;
}

export function useJobPolling(options: UseJobPollingOptions = {}) {
  const {
    pollInterval = 2000,
    maxPollTime = 120000, // 2 minutes max
    onCompleted,
    onFailed,
  } = options;

  const [jobState, setJobState] = useState<JobState>({
    jobId: null,
    status: 'idle',
    progress: 0,
    estimatedTimeRemaining: null,
    errorMessage: null,
    scenes: null,
  });

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
    startTimeRef.current = null;
  }, []);

  const checkJobStatus = useCallback(async (jobId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('check-job-status', {
        body: { jobId },
      });

      if (error) {
        console.error('Job status check error:', error);
        throw new Error(error.message);
      }

      setJobState(prev => ({
        ...prev,
        status: data.status,
        progress: data.progress,
        estimatedTimeRemaining: data.estimatedTimeRemaining,
        errorMessage: data.errorMessage,
        scenes: data.scenes,
      }));

      if (data.status === 'completed') {
        stopPolling();
        if (data.scenes && onCompleted) {
          onCompleted(data.scenes);
        }
        return true;
      }

      if (data.status === 'failed') {
        stopPolling();
        if (onFailed) {
          onFailed(data.errorMessage || 'Job failed');
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error('Polling error:', error);
      return false;
    }
  }, [stopPolling, onCompleted, onFailed]);

  const startPolling = useCallback((jobId: string) => {
    startTimeRef.current = Date.now();
    
    const poll = async () => {
      // Check if we've exceeded max poll time
      if (startTimeRef.current && Date.now() - startTimeRef.current > maxPollTime) {
        stopPolling();
        setJobState(prev => ({
          ...prev,
          status: 'failed',
          errorMessage: 'Job timed out. Please try again.',
        }));
        if (onFailed) {
          onFailed('Job timed out');
        }
        return;
      }

      const isDone = await checkJobStatus(jobId);
      
      if (!isDone) {
        pollingRef.current = setTimeout(poll, pollInterval);
      }
    };

    poll();
  }, [checkJobStatus, pollInterval, maxPollTime, stopPolling, onFailed]);

  const submitJob = useCallback(async (
    projectId: string,
    script: string,
    language: string,
    storyType: string,
    tone: string
  ) => {
    // Reset state
    setJobState({
      jobId: null,
      status: 'queued',
      progress: 5,
      estimatedTimeRemaining: 30,
      errorMessage: null,
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

      if (error) {
        throw new Error(error.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setJobState(prev => ({
        ...prev,
        jobId: data.jobId,
        status: data.status,
      }));

      // If cached result, complete immediately
      if (data.cached && data.status === 'completed') {
        setJobState(prev => ({
          ...prev,
          status: 'completed',
          progress: 100,
          scenes: data.scenes,
        }));
        
        if (onCompleted && data.scenes) {
          onCompleted(data.scenes);
        }
        
        toast.success('Scenes loaded from cache!');
        return data;
      }

      // Start polling for non-cached jobs
      startPolling(data.jobId);
      return data;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit job';
      setJobState(prev => ({
        ...prev,
        status: 'failed',
        errorMessage: message,
      }));
      toast.error(message);
      throw error;
    }
  }, [startPolling, onCompleted]);

  const reset = useCallback(() => {
    stopPolling();
    setJobState({
      jobId: null,
      status: 'idle',
      progress: 0,
      estimatedTimeRemaining: null,
      errorMessage: null,
      scenes: null,
    });
  }, [stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return {
    ...jobState,
    isProcessing: jobState.status === 'queued' || jobState.status === 'processing',
    submitJob,
    reset,
    stopPolling,
  };
}
