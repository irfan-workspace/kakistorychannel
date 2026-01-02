import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { StoryLanguage, StoryType, StoryTone, VisualStyle, VoiceType } from '@/lib/types';
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from 'lucide-react';

const languages: { value: StoryLanguage; label: string; description: string }[] = [
  { value: 'hindi', label: 'Hindi', description: 'Pure Hindi narration' },
  { value: 'hinglish', label: 'Hinglish', description: 'Mix of Hindi & English' },
  { value: 'english', label: 'English', description: 'Full English narration' },
];

const storyTypes: { value: StoryType; label: string; description: string }[] = [
  { value: 'kids', label: 'Kids Stories', description: 'Fun & educational tales' },
  { value: 'bedtime', label: 'Bedtime Stories', description: 'Calm & soothing narratives' },
  { value: 'moral', label: 'Moral Stories', description: 'Stories with life lessons' },
];

const tones: { value: StoryTone; label: string; description: string }[] = [
  { value: 'calm', label: 'Calm', description: 'Peaceful & relaxing' },
  { value: 'emotional', label: 'Emotional', description: 'Touching & heartfelt' },
  { value: 'dramatic', label: 'Dramatic', description: 'Exciting & suspenseful' },
];

const visualStyles: { value: VisualStyle; label: string; description: string }[] = [
  { value: 'cartoon', label: 'Cartoon', description: 'Bright & playful animations' },
  { value: 'storybook', label: 'Storybook', description: 'Classic illustrated style' },
  { value: 'kids_illustration', label: 'Kids Illustration', description: 'Soft & friendly artwork' },
];

const voiceTypes: { value: VoiceType; label: string; description: string }[] = [
  { value: 'female', label: 'Female Voice', description: 'Warm female narrator' },
  { value: 'male', label: 'Male Voice', description: 'Deep male narrator' },
  { value: 'child', label: 'Child Voice', description: 'Young storyteller' },
];

const aspectRatios = [
  { value: '16:9', label: 'YouTube (16:9)', description: 'Standard video format' },
  { value: '9:16', label: 'Shorts (9:16)', description: 'Vertical short format' },
];

export default function NewProject() {
  const navigate = useNavigate();
  const { createProject } = useProjects();
  const [step, setStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);

  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<StoryLanguage>('hindi');
  const [storyType, setStoryType] = useState<StoryType>('kids');
  const [tone, setTone] = useState<StoryTone>('calm');
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('cartoon');
  const [voiceType, setVoiceType] = useState<VoiceType>('female');
  const [aspectRatio, setAspectRatio] = useState('16:9');

  const handleCreate = async () => {
    if (!title.trim()) return;
    setIsCreating(true);

    try {
      const project = await createProject.mutateAsync({
        title: title.trim(),
        language,
        story_type: storyType,
        tone,
        visual_style: visualStyle,
        voice_type: voiceType,
        aspect_ratio: aspectRatio,
      });
      navigate(`/project/${project.id}`);
    } catch {
      setIsCreating(false);
    }
  };

  const canProceed = step === 1 ? title.trim().length > 0 : true;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold">Create New Project</h1>
            <p className="text-muted-foreground">Step {step} of 3</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? 'gradient-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
              <CardDescription>Give your story project a name and choose the language</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Project Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., The Clever Fox Story"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-lg"
                />
              </div>

              <div className="space-y-3">
                <Label>Language</Label>
                <RadioGroup value={language} onValueChange={(v) => setLanguage(v as StoryLanguage)}>
                  <div className="grid gap-3">
                    {languages.map((lang) => (
                      <Label
                        key={lang.value}
                        htmlFor={lang.value}
                        className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          language === lang.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <RadioGroupItem value={lang.value} id={lang.value} />
                        <div>
                          <p className="font-medium">{lang.label}</p>
                          <p className="text-sm text-muted-foreground">{lang.description}</p>
                        </div>
                      </Label>
                    ))}
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Story Settings */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Story Settings</CardTitle>
              <CardDescription>Choose the type and tone of your story</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Story Type</Label>
                <RadioGroup value={storyType} onValueChange={(v) => setStoryType(v as StoryType)}>
                  <div className="grid gap-3">
                    {storyTypes.map((type) => (
                      <Label
                        key={type.value}
                        htmlFor={type.value}
                        className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          storyType === type.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <RadioGroupItem value={type.value} id={type.value} />
                        <div>
                          <p className="font-medium">{type.label}</p>
                          <p className="text-sm text-muted-foreground">{type.description}</p>
                        </div>
                      </Label>
                    ))}
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label>Tone</Label>
                <RadioGroup value={tone} onValueChange={(v) => setTone(v as StoryTone)}>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {tones.map((t) => (
                      <Label
                        key={t.value}
                        htmlFor={`tone-${t.value}`}
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all text-center ${
                          tone === t.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <RadioGroupItem value={t.value} id={`tone-${t.value}`} className="sr-only" />
                        <p className="font-medium">{t.label}</p>
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                      </Label>
                    ))}
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Visual & Audio */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Visual & Audio</CardTitle>
              <CardDescription>Configure the look and sound of your video</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Visual Style</Label>
                <RadioGroup value={visualStyle} onValueChange={(v) => setVisualStyle(v as VisualStyle)}>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {visualStyles.map((style) => (
                      <Label
                        key={style.value}
                        htmlFor={`style-${style.value}`}
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all text-center ${
                          visualStyle === style.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <RadioGroupItem value={style.value} id={`style-${style.value}`} className="sr-only" />
                        <p className="font-medium">{style.label}</p>
                        <p className="text-xs text-muted-foreground">{style.description}</p>
                      </Label>
                    ))}
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label>Voice Type</Label>
                <RadioGroup value={voiceType} onValueChange={(v) => setVoiceType(v as VoiceType)}>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {voiceTypes.map((voice) => (
                      <Label
                        key={voice.value}
                        htmlFor={`voice-${voice.value}`}
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all text-center ${
                          voiceType === voice.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <RadioGroupItem value={voice.value} id={`voice-${voice.value}`} className="sr-only" />
                        <p className="font-medium">{voice.label}</p>
                        <p className="text-xs text-muted-foreground">{voice.description}</p>
                      </Label>
                    ))}
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label>Aspect Ratio</Label>
                <RadioGroup value={aspectRatio} onValueChange={setAspectRatio}>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {aspectRatios.map((ratio) => (
                      <Label
                        key={ratio.value}
                        htmlFor={`ratio-${ratio.value}`}
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all text-center ${
                          aspectRatio === ratio.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <RadioGroupItem value={ratio.value} id={`ratio-${ratio.value}`} className="sr-only" />
                        <p className="font-medium">{ratio.label}</p>
                        <p className="text-xs text-muted-foreground">{ratio.description}</p>
                      </Label>
                    ))}
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 1}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          {step < 3 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleCreate}
              disabled={isCreating || !canProceed}
              className="gradient-primary"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Create Project
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
