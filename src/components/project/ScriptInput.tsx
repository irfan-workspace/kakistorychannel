import { useState } from 'react';
import { Project } from '@/lib/types';
import { useProjects } from '@/hooks/useProjects';
import { useScenes } from '@/hooks/useScenes';
import { useJobPolling, JobStatus } from '@/hooks/useJobPolling';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Loader2, Sparkles, Wand2, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';

interface ScriptInputProps {
  project: Project;
  onScenesGenerated: () => void;
}

function JobStatusBadge({ status, scenesGenerated }: { status: JobStatus; scenesGenerated: number }) {
  const statusConfig = {
    idle: { icon: null, text: '', className: '' },
    queued: { icon: Clock, text: 'Queued', className: 'bg-yellow-500/20 text-yellow-600' },
    processing: { icon: Loader2, text: `Processing${scenesGenerated > 0 ? ` (${scenesGenerated} scenes)` : ''}`, className: 'bg-blue-500/20 text-blue-600' },
    completed: { icon: CheckCircle, text: 'Completed', className: 'bg-green-500/20 text-green-600' },
    failed: { icon: XCircle, text: 'Failed', className: 'bg-red-500/20 text-red-600' },
  };

  const config = statusConfig[status];
  if (!config.icon) return null;

  const Icon = config.icon;
  const isSpinning = status === 'processing';

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.className}`}>
      <Icon className={`h-3.5 w-3.5 ${isSpinning ? 'animate-spin' : ''}`} />
      {config.text}
    </div>
  );
}

export function ScriptInput({ project, onScenesGenerated }: ScriptInputProps) {
  const [script, setScript] = useState(project.script_content || '');
  const { updateProject } = useProjects();
  const { createScenes, deleteAllScenes, scenes } = useScenes(project.id);

  const handleScenesCompleted = async (generatedScenes: any[]) => {
    try {
      // Delete existing scenes first
      if (scenes.length > 0) {
        await deleteAllScenes.mutateAsync();
      }

      // Create new scenes from the job result
      const sceneInputs = generatedScenes.map((scene: any, index: number) => ({
        project_id: project.id,
        scene_order: scene.scene_order || index + 1,
        title: scene.title,
        narration_text: scene.narration_text,
        visual_description: scene.visual_description,
        estimated_duration: scene.estimated_duration || 5,
        mood: scene.mood,
      }));

      await createScenes.mutateAsync(sceneInputs);
      toast.success(`${generatedScenes.length} scenes generated successfully!`);
      onScenesGenerated();
    } catch (error) {
      console.error('Failed to save scenes:', error);
      toast.error('Failed to save generated scenes');
    }
  };

  const {
    status,
    progress,
    scenesGenerated,
    failureReason,
    isProcessing,
    canRetry,
    submitJob,
    reset,
  } = useJobPolling(project.id, {
    onCompleted: handleScenesCompleted,
    onFailed: (error) => {
      // Don't show toast here - it's already handled in useJobPolling or will show in UI
      console.log('Job failed:', error);
    },
  });

  const handleSaveScript = async () => {
    await updateProject.mutateAsync({
      id: project.id,
      script_content: script,
    });
    toast.success('Script saved');
  };

  const handleGenerateScenes = async () => {
    if (!script.trim()) {
      toast.error('Please enter a script first');
      return;
    }

    if (script.trim().length < 50) {
      toast.error('Script must be at least 50 characters');
      return;
    }

    try {
      // Save script first
      await updateProject.mutateAsync({
        id: project.id,
        script_content: script,
      });

      // Submit the job
      await submitJob(
        script,
        project.language,
        project.story_type,
        project.tone
      );
    } catch (error) {
      // Error already handled by useJobPolling
      console.error('Generate scenes error:', error);
    }
  };

  const handleRetry = () => {
    reset();
    // Small delay to ensure state is cleared
    setTimeout(() => {
      handleGenerateScenes();
    }, 100);
  };

  // Calculate estimated time remaining based on progress
  const getTimeEstimate = () => {
    if (status === 'queued') return 'Waiting in queue...';
    if (status === 'processing') {
      if (progress < 20) return 'Starting generation...';
      if (progress < 50) return 'Processing script...';
      if (progress < 80) return 'Creating scenes...';
      return 'Almost done...';
    }
    return '';
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5 text-primary" />
                  Story Script
                </CardTitle>
                <CardDescription>
                  Paste your story script below. The AI will analyze it and create visual scenes.
                </CardDescription>
              </div>
              <JobStatusBadge status={status} scenesGenerated={scenesGenerated} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Once upon a time, in a magical forest, there lived a clever little fox named Ruby. She had the brightest orange fur and the most curious eyes in all the land...

Write or paste your complete story here. The AI will automatically split it into logical scenes, generate visual descriptions, and estimate durations for each scene."
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="min-h-[400px] font-mono text-sm resize-none"
              disabled={isProcessing}
            />

            {/* Progress indicator */}
            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {getTimeEstimate()}
                  </span>
                  <span className="text-muted-foreground">
                    {progress}%
                    {scenesGenerated > 0 && ` • ${scenesGenerated} scenes`}
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {/* Error message - user-friendly only */}
            {status === 'failed' && failureReason && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">{failureReason}</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {script.length} characters • ~{Math.ceil(script.split(/\s+/).filter(Boolean).length / 150)} min read
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleSaveScript} 
                  disabled={updateProject.isPending || isProcessing}
                >
                  Save Draft
                </Button>
                
                {/* Retry button - only visible when status is FAILED */}
                {canRetry && (
                  <Button
                    onClick={handleRetry}
                    variant="outline"
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Retry
                  </Button>
                )}
                
                {/* Generate button - disabled when QUEUED or PROCESSING */}
                <Button
                  onClick={handleGenerateScenes}
                  disabled={isProcessing || !script.trim() || script.trim().length < 50}
                  className="gradient-primary gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {status === 'queued' ? 'Queued...' : 'Generating...'}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate Scenes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tips for Best Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-2">
              <span className="text-primary">•</span>
              <p>Write complete paragraphs for each scene or moment</p>
            </div>
            <div className="flex gap-2">
              <span className="text-primary">•</span>
              <p>Include sensory details (what characters see, hear, feel)</p>
            </div>
            <div className="flex gap-2">
              <span className="text-primary">•</span>
              <p>Keep dialogue natural and age-appropriate</p>
            </div>
            <div className="flex gap-2">
              <span className="text-primary">•</span>
              <p>Aim for 6-12 distinct scenes for best pacing</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Language</span>
              <span className="capitalize font-medium">{project.language}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Story Type</span>
              <span className="capitalize font-medium">{project.story_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tone</span>
              <span className="capitalize font-medium">{project.tone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Visual Style</span>
              <span className="capitalize font-medium">{project.visual_style.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Voice</span>
              <span className="capitalize font-medium">{project.voice_type}</span>
            </div>
          </CardContent>
        </Card>

        {/* Queue Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generation Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="flex gap-2">
              <span className="text-primary">✓</span>
              <p>Rate limited: 5 requests per minute</p>
            </div>
            <div className="flex gap-2">
              <span className="text-primary">✓</span>
              <p>Results cached for 30 days</p>
            </div>
            <div className="flex gap-2">
              <span className="text-primary">✓</span>
              <p>Auto-retry on failures (3 attempts)</p>
            </div>
            <div className="flex gap-2">
              <span className="text-primary">✓</span>
              <p>Resumes on page refresh</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
