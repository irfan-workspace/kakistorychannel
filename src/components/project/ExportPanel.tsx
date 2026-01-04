import { useState } from 'react';
import { Project, Scene } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Download, Loader2, AlertCircle, CheckCircle, Film, Crown } from 'lucide-react';

interface ExportPanelProps {
  project: Project;
  scenes: Scene[];
}

export function ExportPanel({ project, scenes }: ExportPanelProps) {
  const { profile } = useAuth();
  const { updateProject } = useProjects();
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>(project.aspect_ratio as '16:9' | '9:16');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState<string | null>(project.exported_video_url);

  const completedImages = scenes.filter((s) => s.image_status === 'completed').length;
  const completedAudio = scenes.filter((s) => s.audio_status === 'completed').length;
  const isReady = scenes.length > 0 && completedImages === scenes.length && completedAudio === scenes.length;
  const isFreeUser = profile?.subscription_tier === 'free';

  const handleExport = async () => {
    if (!isReady) {
      toast.error('Please complete all scene images and voiceovers first');
      return;
    }

    setIsExporting(true);
    setProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 5, 90));
      }, 500);

      const response = await supabase.functions.invoke('export-video', {
        body: {
          projectId: project.id,
          aspectRatio,
          includeWatermark: isFreeUser,
          scenes: scenes.map((s) => ({
            id: s.id,
            imageUrl: s.image_url,
            audioUrl: s.audio_url,
            duration: s.actual_duration || s.estimated_duration,
          })),
        },
      });

      clearInterval(progressInterval);

      if (response.error) {
        throw new Error(response.error.message);
      }

      setProgress(100);
      setExportUrl(response.data.videoUrl);

      await updateProject.mutateAsync({
        id: project.id,
        status: 'exported',
        exported_video_url: response.data.videoUrl,
      });

      toast.success('Video exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to export video');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        {/* Readiness Check */}
        <Card>
          <CardHeader>
            <CardTitle>Export Readiness</CardTitle>
            <CardDescription>Complete these steps before exporting</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                {scenes.length > 0 ? (
                  <CheckCircle className="h-5 w-5 text-success" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                )}
                <span>Scenes generated</span>
              </div>
              <Badge variant={scenes.length > 0 ? 'outline' : 'secondary'}>
                {scenes.length} scenes
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                {completedImages === scenes.length && scenes.length > 0 ? (
                  <CheckCircle className="h-5 w-5 text-success" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                )}
                <span>Images generated</span>
              </div>
              <Badge variant={completedImages === scenes.length ? 'outline' : 'secondary'}>
                {completedImages}/{scenes.length}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                {completedAudio === scenes.length && scenes.length > 0 ? (
                  <CheckCircle className="h-5 w-5 text-success" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                )}
                <span>Voiceovers generated</span>
              </div>
              <Badge variant={completedAudio === scenes.length ? 'outline' : 'secondary'}>
                {completedAudio}/{scenes.length}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Export Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Export Settings</CardTitle>
            <CardDescription>Configure your video output</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Aspect Ratio</Label>
              <RadioGroup
                value={aspectRatio}
                onValueChange={(v) => setAspectRatio(v as '16:9' | '9:16')}
              >
                <div className="grid sm:grid-cols-2 gap-3">
                  <Label
                    htmlFor="ratio-16-9"
                    className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      aspectRatio === '16:9'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value="16:9" id="ratio-16-9" />
                    <div>
                      <p className="font-medium">YouTube (16:9)</p>
                      <p className="text-sm text-muted-foreground">Standard landscape video</p>
                    </div>
                  </Label>
                  <Label
                    htmlFor="ratio-9-16"
                    className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      aspectRatio === '9:16'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value="9:16" id="ratio-9-16" />
                    <div>
                      <p className="font-medium">Shorts (9:16)</p>
                      <p className="text-sm text-muted-foreground">Vertical short video</p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="font-medium">Resolution</p>
                <p className="text-sm text-muted-foreground">1080p Full HD</p>
              </div>
              <Badge>1080p</Badge>
            </div>

            {isFreeUser && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-warning/10 border border-warning/30">
                <Crown className="h-5 w-5 text-warning" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Watermark will be added</p>
                  <p className="text-xs text-muted-foreground">
                    Upgrade to remove watermark from exports
                  </p>
                </div>
                <Button size="sm" variant="outline">
                  Upgrade
                </Button>
              </div>
            )}

            {isExporting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Exporting video...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}

            <Button
              onClick={handleExport}
              disabled={!isReady || isExporting}
              className="w-full gradient-primary gap-2"
              size="lg"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Film className="h-5 w-5" />
                  Export Video
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Download Section */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Download</CardTitle>
            <CardDescription>
              {exportUrl ? 'Your video is ready' : 'Export your video first'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {exportUrl ? (
              <div className="space-y-4">
                <div className="aspect-video rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                  {scenes[0]?.image_url && (
                    <img 
                      src={scenes[0].image_url} 
                      alt="Video preview" 
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <Button asChild className="w-full gap-2">
                  <a href={exportUrl} target="_blank" rel="noopener noreferrer">
                    <Film className="h-4 w-4" />
                    Watch Video
                  </a>
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Opens interactive video player in new tab
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <Film className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Complete all scenes and export to download
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Your balance</span>
              <span className="font-bold">{profile?.credits_balance ?? 0}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              1 credit per video export
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
