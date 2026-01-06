import { useState } from 'react';
import { Project } from '@/lib/types';
import { useProjects } from '@/hooks/useProjects';
import { useScenes } from '@/hooks/useScenes';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';

interface ScriptInputProps {
  project: Project;
  onScenesGenerated: () => void;
}

export function ScriptInput({ project, onScenesGenerated }: ScriptInputProps) {
  const [script, setScript] = useState(project.script_content || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const { updateProject } = useProjects();
  const { createScenes, deleteAllScenes, scenes } = useScenes(project.id);

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

    setIsGenerating(true);

    try {
      // Save script first
      await updateProject.mutateAsync({
        id: project.id,
        script_content: script,
      });

      // Call generate-scenes directly
      const { data, error } = await supabase.functions.invoke('generate-scenes', {
        body: {
          script,
          language: project.language,
          storyType: project.story_type,
          tone: project.tone,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate scenes');
      }

      if (!data?.scenes || !Array.isArray(data.scenes)) {
        throw new Error('Invalid response from AI');
      }

      // Delete existing scenes first
      if (scenes.length > 0) {
        await deleteAllScenes.mutateAsync();
      }

      // Create new scenes
      const sceneInputs = data.scenes.map((scene: any, index: number) => ({
        project_id: project.id,
        scene_order: index + 1,
        title: scene.title,
        narration_text: scene.narration_text,
        visual_description: scene.visual_description,
        estimated_duration: scene.estimated_duration || 5,
        mood: scene.mood,
      }));

      await createScenes.mutateAsync(sceneInputs);
      toast.success(`${data.scenes.length} scenes generated successfully!`);
      onScenesGenerated();
    } catch (error) {
      console.error('Generate scenes error:', error);
      const message = error instanceof Error ? error.message : 'Failed to generate scenes';
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
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
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Once upon a time, in a magical forest, there lived a clever little fox named Ruby. She had the brightest orange fur and the most curious eyes in all the land...

Write or paste your complete story here. The AI will automatically split it into logical scenes, generate visual descriptions, and estimate durations for each scene."
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="min-h-[400px] font-mono text-sm resize-none"
              disabled={isGenerating}
            />

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {script.length} characters • ~{Math.ceil(script.split(/\s+/).filter(Boolean).length / 150)} min read
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleSaveScript} 
                  disabled={updateProject.isPending || isGenerating}
                >
                  Save Draft
                </Button>
                
                <Button
                  onClick={handleGenerateScenes}
                  disabled={isGenerating || !script.trim() || script.trim().length < 50}
                  className="gradient-primary gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
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
      </div>
    </div>
  );
}
