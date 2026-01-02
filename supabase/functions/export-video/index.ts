import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SceneData {
  id: string;
  imageUrl: string;
  audioUrl: string;
  duration: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, aspectRatio, includeWatermark, scenes } = await req.json();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    console.log(`Exporting video for project ${projectId} with ${scenes.length} scenes`);

    // Validate scenes
    const validScenes = scenes.filter((s: SceneData) => s.imageUrl && s.audioUrl);
    if (validScenes.length === 0) {
      throw new Error("No valid scenes with both image and audio");
    }

    // For now, we'll create a simple slideshow video using FFmpeg concepts
    // In a production environment, you'd use a video rendering service like Remotion, Shotstack, or similar
    
    // Create a manifest for the video
    const videoManifest = {
      projectId,
      aspectRatio,
      includeWatermark,
      resolution: aspectRatio === "16:9" ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 },
      scenes: validScenes.map((scene: SceneData, index: number) => ({
        order: index + 1,
        imageUrl: scene.imageUrl,
        audioUrl: scene.audioUrl,
        duration: scene.duration || 5,
      })),
      totalDuration: validScenes.reduce((acc: number, s: SceneData) => acc + (s.duration || 5), 0),
      createdAt: new Date().toISOString(),
    };

    // Store the manifest and create a placeholder video URL
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // In a real implementation, this would:
    // 1. Send the manifest to a video rendering service (Remotion, Shotstack, etc.)
    // 2. Wait for the render to complete
    // 3. Return the final video URL
    
    // For now, we'll store the manifest as a JSON file
    const manifestFileName = `${projectId}/manifest-${Date.now()}.json`;
    const manifestData = new TextEncoder().encode(JSON.stringify(videoManifest, null, 2));

    await supabase.storage
      .from("exported-videos")
      .upload(manifestFileName, manifestData, { 
        contentType: "application/json", 
        upsert: true 
      });

    // Create a simple HTML5 video player page as a temporary solution
    const videoPlayerHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Story Video - ${projectId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #000; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .player { position: relative; width: 100%; max-width: ${aspectRatio === "16:9" ? "1280px" : "400px"}; }
    .scene { display: none; width: 100%; aspect-ratio: ${aspectRatio.replace(":", "/")}; object-fit: cover; }
    .scene.active { display: block; }
    .controls { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 10; }
    button { padding: 10px 20px; font-size: 16px; cursor: pointer; }
    ${includeWatermark ? '.watermark { position: absolute; bottom: 10px; right: 10px; color: rgba(255,255,255,0.7); font-size: 14px; }' : ''}
  </style>
</head>
<body>
  <div class="player">
    ${validScenes.map((s: SceneData, i: number) => `
      <img class="scene${i === 0 ? " active" : ""}" src="${s.imageUrl}" data-duration="${s.duration || 5}" data-audio="${s.audioUrl}" />
    `).join("")}
    ${includeWatermark ? '<div class="watermark">Made with KakiStoryChannel</div>' : ''}
    <div class="controls">
      <button onclick="playVideo()">▶ Play Video</button>
    </div>
  </div>
  <script>
    let currentScene = 0;
    const scenes = document.querySelectorAll('.scene');
    let currentAudio = null;
    
    async function playVideo() {
      if (currentAudio) currentAudio.pause();
      currentScene = 0;
      playScene();
    }
    
    function playScene() {
      if (currentScene >= scenes.length) {
        currentScene = 0;
        return;
      }
      
      scenes.forEach((s, i) => s.classList.toggle('active', i === currentScene));
      const scene = scenes[currentScene];
      const audioUrl = scene.dataset.audio;
      const duration = parseFloat(scene.dataset.duration) * 1000;
      
      if (audioUrl) {
        currentAudio = new Audio(audioUrl);
        currentAudio.play().catch(console.error);
      }
      
      setTimeout(() => {
        currentScene++;
        playScene();
      }, duration);
    }
  </script>
</body>
</html>`;

    const playerFileName = `${projectId}/player-${Date.now()}.html`;
    const playerData = new TextEncoder().encode(videoPlayerHtml);

    const { error: playerUploadError } = await supabase.storage
      .from("exported-videos")
      .upload(playerFileName, playerData, { 
        contentType: "text/html", 
        upsert: true 
      });

    if (playerUploadError) {
      console.error("Player upload error:", playerUploadError);
    }

    const { data: playerUrlData } = supabase.storage
      .from("exported-videos")
      .getPublicUrl(playerFileName);

    console.log(`Video exported: ${playerUrlData.publicUrl}`);

    // Return the player URL as the video URL for now
    // In production, this would be the actual rendered MP4 URL
    return new Response(
      JSON.stringify({ 
        videoUrl: playerUrlData.publicUrl,
        manifestUrl: `${SUPABASE_URL}/storage/v1/object/public/exported-videos/${manifestFileName}`,
        message: "Video manifest created. Full MP4 export requires Remotion integration.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Export video error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to export video" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
