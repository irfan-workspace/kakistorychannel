import { Project, Scene } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Clock, Image, Mic, Film } from 'lucide-react';

interface VideoTimelineProps {
  project: Project;
  scenes: Scene[];
}

export function VideoTimeline({ project, scenes }: VideoTimelineProps) {
  const totalDuration = scenes.reduce(
    (acc, scene) => acc + (scene.actual_duration || scene.estimated_duration || 5),
    0
  );

  const completedImages = scenes.filter((s) => s.image_status === 'completed').length;
  const completedAudio = scenes.filter((s) => s.audio_status === 'completed').length;

  if (scenes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Video Timeline</CardTitle>
          <CardDescription>Generate scenes first to see the timeline</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Film className="h-12 w-12 text-muted-foreground/50" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Scenes</span>
            </div>
            <p className="text-2xl font-bold mt-1">{scenes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Duration</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {Math.floor(totalDuration / 60)}:{String(Math.floor(totalDuration % 60)).padStart(2, '0')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Image className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Images</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {completedImages}/{scenes.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Voiceovers</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {completedAudio}/{scenes.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>
            {project.aspect_ratio} • {project.visual_style.replace('_', ' ')} style
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <div className="timeline-track py-2">
              {scenes.map((scene, index) => {
                const duration = scene.actual_duration || scene.estimated_duration || 5;
                const width = Math.max(120, duration * 15);

                return (
                  <div
                    key={scene.id}
                    className="flex-shrink-0 relative rounded-lg border overflow-hidden bg-card hover:shadow-md transition-shadow"
                    style={{ width: `${width}px` }}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-video bg-muted">
                      {scene.image_url ? (
                        <img
                          src={scene.image_url}
                          alt={scene.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-2xl font-bold text-muted-foreground/30">
                            {index + 1}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-2 space-y-1">
                      <p className="text-xs font-medium truncate">{scene.title}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{duration}s</span>
                        <div className="flex gap-1">
                          {scene.image_status === 'completed' && (
                            <Badge variant="outline" className="h-4 px-1">
                              <Image className="h-2.5 w-2.5" />
                            </Badge>
                          )}
                          {scene.audio_status === 'completed' && (
                            <Badge variant="outline" className="h-4 px-1">
                              <Mic className="h-2.5 w-2.5" />
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {/* Time Markers */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>0:00</span>
              <span>
                Total: {Math.floor(totalDuration / 60)}:{String(Math.floor(totalDuration % 60)).padStart(2, '0')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
