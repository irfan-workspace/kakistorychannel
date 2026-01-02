import { useState } from 'react';
import { Scene } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  MoreVertical,
  Image,
  Mic,
  ChevronUp,
  ChevronDown,
  Trash2,
  Edit2,
  Check,
  X,
  Loader2,
  Clock,
  Play,
  ImageOff,
} from 'lucide-react';

interface SceneCardProps {
  scene: Scene;
  index: number;
  totalScenes: number;
  onUpdate: (id: string, updates: Partial<Scene>) => void;
  onDelete: (id: string) => void;
  onGenerateImage: () => void;
  onGenerateAudio: () => void;
  isGeneratingImage: boolean;
  isGeneratingAudio: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function SceneCard({
  scene,
  index,
  onUpdate,
  onDelete,
  onGenerateImage,
  onGenerateAudio,
  isGeneratingImage,
  isGeneratingAudio,
  onMoveUp,
  onMoveDown,
}: SceneCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(scene.title);
  const [editNarration, setEditNarration] = useState(scene.narration_text);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleSave = () => {
    onUpdate(scene.id, {
      title: editTitle,
      narration_text: editNarration,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(scene.title);
    setEditNarration(scene.narration_text);
    setIsEditing(false);
  };

  const handlePlayAudio = () => {
    if (!scene.audio_url) return;

    if (audioRef) {
      if (isPlaying) {
        audioRef.pause();
        setIsPlaying(false);
      } else {
        audioRef.play();
        setIsPlaying(true);
      }
    } else {
      const audio = new Audio(scene.audio_url);
      audio.onended = () => setIsPlaying(false);
      audio.play();
      setIsPlaying(true);
      setAudioRef(audio);
    }
  };

  const getStatusBadge = (status: string, type: 'image' | 'audio') => {
    const Icon = type === 'image' ? Image : Mic;
    const config = {
      pending: { variant: 'secondary' as const, label: 'Pending' },
      generating: { variant: 'default' as const, label: 'Generating' },
      completed: { variant: 'outline' as const, label: 'Ready' },
      failed: { variant: 'destructive' as const, label: 'Failed' },
    };
    const { variant, label } = config[status as keyof typeof config] || config.pending;

    return (
      <Badge variant={variant} className="gap-1 text-xs">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  return (
    <>
      <Card className="scene-card group">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="flex-shrink-0 h-6 w-6 rounded-full gradient-primary flex items-center justify-center text-xs font-medium text-white">
                {index + 1}
              </span>
              {isEditing ? (
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="h-7 text-sm font-medium"
                />
              ) : (
                <h3 className="font-medium text-sm truncate">{scene.title}</h3>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                {onMoveUp && (
                  <DropdownMenuItem onClick={onMoveUp}>
                    <ChevronUp className="h-4 w-4 mr-2" />
                    Move Up
                  </DropdownMenuItem>
                )}
                {onMoveDown && (
                  <DropdownMenuItem onClick={onMoveDown}>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Move Down
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Image Preview */}
          <div className="aspect-video rounded-lg bg-muted overflow-hidden relative">
            {scene.image_url ? (
              <img
                src={scene.image_url}
                alt={scene.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageOff className="h-8 w-8 text-muted-foreground/50" />
              </div>
            )}
            {isGeneratingImage && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </div>

          {/* Narration */}
          {isEditing ? (
            <Textarea
              value={editNarration}
              onChange={(e) => setEditNarration(e.target.value)}
              className="text-xs min-h-[60px]"
            />
          ) : (
            <p className="text-xs text-muted-foreground line-clamp-3">
              {scene.narration_text}
            </p>
          )}

          {/* Duration */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{scene.actual_duration || scene.estimated_duration}s</span>
          </div>

          {/* Status Badges */}
          <div className="flex gap-2">
            {getStatusBadge(scene.image_status, 'image')}
            {getStatusBadge(scene.audio_status, 'audio')}
          </div>

          {/* Actions */}
          {isEditing ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} className="flex-1 gap-1">
                <Check className="h-3 w-3" />
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onGenerateImage}
                disabled={isGeneratingImage}
                className="flex-1 gap-1"
              >
                {isGeneratingImage ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Image className="h-3 w-3" />
                )}
                Image
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onGenerateAudio}
                disabled={isGeneratingAudio}
                className="flex-1 gap-1"
              >
                {isGeneratingAudio ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Mic className="h-3 w-3" />
                )}
                Voice
              </Button>
              {scene.audio_url && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handlePlayAudio}
                  className="px-2"
                >
                  <Play className={`h-3 w-3 ${isPlaying ? 'text-primary' : ''}`} />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scene?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{scene.title}" and its generated assets.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete(scene.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
