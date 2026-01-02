import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Project, StoryLanguage, StoryType, StoryTone, VisualStyle, VoiceType } from '@/lib/types';
import { useProjects } from '@/hooks/useProjects';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2, Save, Trash2 } from 'lucide-react';

interface ProjectSettingsProps {
  project: Project;
}

export function ProjectSettings({ project }: ProjectSettingsProps) {
  const navigate = useNavigate();
  const { updateProject, deleteProject } = useProjects();
  const [title, setTitle] = useState(project.title);
  const [language, setLanguage] = useState(project.language);
  const [storyType, setStoryType] = useState(project.story_type);
  const [tone, setTone] = useState(project.tone);
  const [visualStyle, setVisualStyle] = useState(project.visual_style);
  const [voiceType, setVoiceType] = useState(project.voice_type);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Project title is required');
      return;
    }

    setIsSaving(true);
    try {
      await updateProject.mutateAsync({
        id: project.id,
        title: title.trim(),
        language,
        story_type: storyType,
        tone,
        visual_style: visualStyle,
        voice_type: voiceType,
      });
      toast.success('Settings saved');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    await deleteProject.mutateAsync(project.id);
    navigate('/dashboard');
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Project Settings</CardTitle>
          <CardDescription>Update your project configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Project Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as StoryLanguage)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hindi">Hindi</SelectItem>
                  <SelectItem value="hinglish">Hinglish</SelectItem>
                  <SelectItem value="english">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Story Type</Label>
              <Select value={storyType} onValueChange={(v) => setStoryType(v as StoryType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kids">Kids Stories</SelectItem>
                  <SelectItem value="bedtime">Bedtime Stories</SelectItem>
                  <SelectItem value="moral">Moral Stories</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as StoryTone)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="calm">Calm</SelectItem>
                  <SelectItem value="emotional">Emotional</SelectItem>
                  <SelectItem value="dramatic">Dramatic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Visual Style</Label>
              <Select value={visualStyle} onValueChange={(v) => setVisualStyle(v as VisualStyle)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cartoon">Cartoon</SelectItem>
                  <SelectItem value="storybook">Storybook</SelectItem>
                  <SelectItem value="kids_illustration">Kids Illustration</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Voice Type</Label>
              <Select value={voiceType} onValueChange={(v) => setVoiceType(v as VoiceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="child">Child</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <Trash2 className="h-4 w-4" />
                Delete Project
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete "{project.title}" and all its scenes, images,
                  and voiceovers. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
