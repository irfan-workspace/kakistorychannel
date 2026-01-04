import { useState, useRef, useCallback } from 'react';
import { Scene } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface VideoDownloaderProps {
  scenes: Scene[];
  aspectRatio: '16:9' | '9:16';
  projectTitle: string;
}

export function VideoDownloader({ scenes, aspectRatio, projectTitle }: VideoDownloaderProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentScene, setCurrentScene] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateVideo = useCallback(async () => {
    if (!canvasRef.current) return;

    const validScenes = scenes.filter(s => s.image_url && s.audio_url && s.audio_status === 'completed');
    if (validScenes.length === 0) {
      toast.error('No valid scenes with images and audio');
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setCurrentScene(0);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      toast.error('Canvas not supported');
      setIsGenerating(false);
      return;
    }

    // Set canvas dimensions based on aspect ratio
    const width = aspectRatio === '16:9' ? 1280 : 720;
    const height = aspectRatio === '16:9' ? 720 : 1280;
    canvas.width = width;
    canvas.height = height;

    try {
      // Create audio context for mixing
      const audioContext = new AudioContext();
      const audioDestination = audioContext.createMediaStreamDestination();

      // Set up MediaRecorder with canvas stream + audio
      const canvasStream = canvas.captureStream(30);
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioDestination.stream.getAudioTracks()
      ]);

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 5000000
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectTitle.replace(/[^a-z0-9]/gi, '_')}_video.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setIsGenerating(false);
        setProgress(100);
        toast.success('Video downloaded successfully!');
      };

      mediaRecorder.start();

      // Process each scene
      const totalDuration = validScenes.reduce((acc, s) => acc + (s.actual_duration || s.estimated_duration || 5), 0);
      let elapsedTime = 0;

      for (let i = 0; i < validScenes.length; i++) {
        const scene = validScenes[i];
        const duration = scene.actual_duration || scene.estimated_duration || 5;
        setCurrentScene(i + 1);

        // Load and draw image
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = scene.image_url!;
        });

        // Draw image to fit canvas
        const imgAspect = img.width / img.height;
        const canvasAspect = width / height;
        let drawWidth, drawHeight, drawX, drawY;

        if (imgAspect > canvasAspect) {
          drawHeight = height;
          drawWidth = height * imgAspect;
          drawX = (width - drawWidth) / 2;
          drawY = 0;
        } else {
          drawWidth = width;
          drawHeight = width / imgAspect;
          drawX = 0;
          drawY = (height - drawHeight) / 2;
        }

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

        // Load and play audio
        if (scene.audio_url) {
          try {
            const response = await fetch(scene.audio_url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioDestination);
            source.start();
          } catch (audioError) {
            console.warn('Audio load failed for scene', i, audioError);
          }
        }

        // Wait for scene duration while updating progress
        const startTime = Date.now();
        while (Date.now() - startTime < duration * 1000) {
          await new Promise(resolve => setTimeout(resolve, 100));
          const currentProgress = ((elapsedTime + (Date.now() - startTime) / 1000) / totalDuration) * 100;
          setProgress(Math.min(currentProgress, 99));
        }

        elapsedTime += duration;
      }

      // Stop recording
      mediaRecorder.stop();
      await audioContext.close();

    } catch (error) {
      console.error('Video generation error:', error);
      toast.error('Failed to generate video. Please try the web player instead.');
      setIsGenerating(false);
    }
  }, [scenes, aspectRatio, projectTitle]);

  const validSceneCount = scenes.filter(s => s.image_url && s.audio_url && s.audio_status === 'completed').length;

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" />
      
      {isGenerating ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Recording scene {currentScene} of {validSceneCount}...
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground text-center">
            Please keep this tab open while generating
          </p>
        </div>
      ) : progress === 100 ? (
        <div className="flex items-center justify-center gap-2 text-success py-2">
          <CheckCircle className="h-5 w-5" />
          <span>Download complete!</span>
        </div>
      ) : null}

      <Button
        onClick={generateVideo}
        disabled={isGenerating || validSceneCount === 0}
        className="w-full gap-2"
        variant="outline"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating Video...
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Download as Video
          </>
        )}
      </Button>
      
      <p className="text-xs text-muted-foreground text-center">
        Downloads as WebM format • May take a few minutes
      </p>
    </div>
  );
}
