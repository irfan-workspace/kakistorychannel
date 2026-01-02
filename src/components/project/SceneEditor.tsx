import { useState } from 'react';
import { Project, Scene } from '@/lib/types';
import { useScenes } from '@/hooks/useScenes';
import { SceneCard } from './SceneCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Loader2, Wand2, Image, Mic, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SceneEditorProps {
  project: Project;
  scenes: Scene[];
  isLoading: boolean;
}

export function SceneEditor({ project, scenes, isLoading }: SceneEditorProps) {
  const { updateScene, deleteScene, reorderScenes, refetch } = useScenes(project.id);
  const [generatingImages, setGeneratingImages] = useState<Set<string>>(new Set());
  const [generatingAudio, setGeneratingAudio] = useState<Set<string>>(new Set());

  const handleGenerateImage = async (scene: Scene) => {
    setGeneratingImages((prev) => new Set(prev).add(scene.id));

    try {
      await updateScene.mutateAsync({
        id: scene.id,
        image_status: 'generating',
      });

      const response = await supabase.functions.invoke('generate-image', {
        body: {
          sceneId: scene.id,
          visualDescription: scene.visual_description || scene.narration_text,
          style: project.visual_style,
          mood: scene.mood || project.tone,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      await updateScene.mutateAsync({
        id: scene.id,
        image_url: response.data.imageUrl,
        image_status: 'completed',
      });

      toast.success(`Image generated for "${scene.title}"`);
    } catch (error) {
      console.error('Image generation error:', error);
      await updateScene.mutateAsync({
        id: scene.id,
        image_status: 'failed',
      });
      toast.error(error instanceof Error ? error.message : 'Failed to generate image');
    } finally {
      setGeneratingImages((prev) => {
        const next = new Set(prev);
        next.delete(scene.id);
        return next;
      });
    }
  };

  const handleGenerateAudio = async (scene: Scene) => {
    setGeneratingAudio((prev) => new Set(prev).add(scene.id));

    try {
      await updateScene.mutateAsync({
        id: scene.id,
        audio_status: 'generating',
      });

      const response = await supabase.functions.invoke('generate-voiceover', {
        body: {
          sceneId: scene.id,
          text: scene.narration_text,
          voiceType: project.voice_type,
          language: project.language,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      await updateScene.mutateAsync({
        id: scene.id,
        audio_url: response.data.audioUrl,
        actual_duration: response.data.duration,
        audio_status: 'completed',
      });

      toast.success(`Voiceover generated for "${scene.title}"`);
    } catch (error) {
      console.error('Audio generation error:', error);
      await updateScene.mutateAsync({
        id: scene.id,
        audio_status: 'failed',
      });
      toast.error(error instanceof Error ? error.message : 'Failed to generate voiceover');
    } finally {
      setGeneratingAudio((prev) => {
        const next = new Set(prev);
        next.delete(scene.id);
        return next;
      });
    }
  };

  const handleGenerateAllImages = async () => {
    const pendingScenes = scenes.filter((s) => s.image_status === 'pending' || s.image_status === 'failed');
    for (const scene of pendingScenes) {
      await handleGenerateImage(scene);
    }
  };

  const handleGenerateAllAudio = async () => {
    const pendingScenes = scenes.filter((s) => s.audio_status === 'pending' || s.audio_status === 'failed');
    for (const scene of pendingScenes) {
      await handleGenerateAudio(scene);
    }
  };

  const handleSceneUpdate = async (sceneId: string, updates: Partial<Scene>) => {
    await updateScene.mutateAsync({ id: sceneId, ...updates });
  };

  const handleSceneDelete = async (sceneId: string) => {
    await deleteScene.mutateAsync(sceneId);
  };

  const handleReorder = async (fromIndex: number, toIndex: number) => {
    const newScenes = [...scenes];
    const [moved] = newScenes.splice(fromIndex, 1);
    newScenes.splice(toIndex, 0, moved);

    const updates = newScenes.map((scene, index) => ({
      id: scene.id,
      scene_order: index + 1,
    }));

    await reorderScenes.mutateAsync(updates);
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full mb-4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (scenes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Scenes Yet</CardTitle>
          <CardDescription>
            Go to the Script tab and generate scenes from your story.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Wand2 className="h-12 w-12 text-muted-foreground/50" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const pendingImages = scenes.filter((s) => s.image_status === 'pending' || s.image_status === 'failed').length;
  const pendingAudio = scenes.filter((s) => s.audio_status === 'pending' || s.audio_status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {scenes.length} scene{scenes.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateAllImages}
            disabled={pendingImages === 0 || generatingImages.size > 0}
            className="gap-2"
          >
            {generatingImages.size > 0 ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Image className="h-4 w-4" />
            )}
            Generate All Images ({pendingImages})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateAllAudio}
            disabled={pendingAudio === 0 || generatingAudio.size > 0}
            className="gap-2"
          >
            {generatingAudio.size > 0 ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
            Generate All Voiceovers ({pendingAudio})
          </Button>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Scenes Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {scenes.map((scene, index) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            index={index}
            totalScenes={scenes.length}
            onUpdate={handleSceneUpdate}
            onDelete={handleSceneDelete}
            onGenerateImage={() => handleGenerateImage(scene)}
            onGenerateAudio={() => handleGenerateAudio(scene)}
            isGeneratingImage={generatingImages.has(scene.id)}
            isGeneratingAudio={generatingAudio.has(scene.id)}
            onMoveUp={index > 0 ? () => handleReorder(index, index - 1) : undefined}
            onMoveDown={index < scenes.length - 1 ? () => handleReorder(index, index + 1) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
