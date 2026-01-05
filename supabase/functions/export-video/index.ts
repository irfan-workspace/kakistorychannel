import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Export Video Edge Function
 * 
 * Creates an interactive video player from scenes.
 * Includes authentication, authorization, and input validation.
 */

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

// UUID regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Valid aspect ratios
const VALID_ASPECT_RATIOS = ["16:9", "9:16"];

// Input constraints
const MAX_SCENES = 50;
const MAX_SCENE_DURATION = 120; // 2 minutes per scene max
const MIN_SCENE_DURATION = 1;

// URL validation (basic check for http/https)
const URL_REGEX = /^https?:\/\/.+/i;

function validateSceneData(scene: any, index: number): { valid: boolean; error?: string } {
  if (!scene || typeof scene !== 'object') {
    return { valid: false, error: `Scene ${index + 1} is invalid` };
  }

  if (!scene.id || typeof scene.id !== 'string' || !UUID_REGEX.test(scene.id)) {
    return { valid: false, error: `Scene ${index + 1} has invalid ID` };
  }

  if (!scene.imageUrl || typeof scene.imageUrl !== 'string' || !URL_REGEX.test(scene.imageUrl)) {
    return { valid: false, error: `Scene ${index + 1} has invalid image URL` };
  }

  if (!scene.audioUrl || typeof scene.audioUrl !== 'string' || !URL_REGEX.test(scene.audioUrl)) {
    return { valid: false, error: `Scene ${index + 1} has invalid audio URL` };
  }

  const duration = Number(scene.duration);
  if (isNaN(duration) || duration < MIN_SCENE_DURATION || duration > MAX_SCENE_DURATION) {
    return { valid: false, error: `Scene ${index + 1} has invalid duration (must be ${MIN_SCENE_DURATION}-${MAX_SCENE_DURATION} seconds)` };
  }

  return { valid: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create client with user's auth token for auth check
    const userSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      console.error("Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Authenticated user: ${user.id}`);

    // Parse and validate input
    const body = await req.json();
    const { projectId, aspectRatio, includeWatermark, scenes } = body;

    // Validate projectId as UUID
    if (!projectId || typeof projectId !== 'string' || !UUID_REGEX.test(projectId)) {
      return new Response(
        JSON.stringify({ error: "Bad Request", message: "Valid project ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate aspectRatio
    const validatedAspectRatio = VALID_ASPECT_RATIOS.includes(aspectRatio) ? aspectRatio : "16:9";

    // Validate includeWatermark (boolean)
    const validatedIncludeWatermark = typeof includeWatermark === 'boolean' ? includeWatermark : true;

    // Validate scenes array
    if (!Array.isArray(scenes)) {
      return new Response(
        JSON.stringify({ error: "Bad Request", message: "Scenes must be an array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (scenes.length === 0) {
      return new Response(
        JSON.stringify({ error: "Bad Request", message: "At least one scene is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (scenes.length > MAX_SCENES) {
      return new Response(
        JSON.stringify({ error: "Bad Request", message: `Maximum ${MAX_SCENES} scenes allowed` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate each scene
    for (let i = 0; i < scenes.length; i++) {
      const validation = validateSceneData(scenes[i], i);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({ error: "Bad Request", message: validation.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Authorization check - verify user owns the project
    // Use service role client for database queries
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error("Project not found:", projectError?.message);
      return new Response(
        JSON.stringify({ error: "Not Found", message: "Project not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user owns the project
    if (project.user_id !== user.id) {
      console.error(`User ${user.id} attempted to export project owned by ${project.user_id}`);
      return new Response(
        JSON.stringify({ error: "Forbidden", message: "You don't have permission to export this project" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting video export for project ${projectId}`);
    console.log(`Number of scenes: ${scenes.length}`);
    console.log(`Aspect ratio: ${validatedAspectRatio}`);

    // Filter valid scenes with both image and audio
    const validScenes = scenes.filter((s: SceneData) => s.imageUrl && s.audioUrl);
    if (validScenes.length === 0) {
      return new Response(
        JSON.stringify({ error: "Bad Request", message: "No valid scenes with both image and audio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Valid scenes: ${validScenes.length}`);

    // Calculate total duration
    const totalDuration = validScenes.reduce((acc: number, s: SceneData) => {
      const duration = Math.min(Math.max(s.duration || 5, MIN_SCENE_DURATION), MAX_SCENE_DURATION);
      console.log(`Scene ${s.id}: duration ${duration}s`);
      return acc + duration;
    }, 0);

    console.log(`Total video duration: ${totalDuration}s`);

    // Create video manifest with all scene data
    const videoManifest = {
      projectId,
      aspectRatio: validatedAspectRatio,
      includeWatermark: validatedIncludeWatermark,
      resolution: validatedAspectRatio === "16:9" ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 },
      scenes: validScenes.map((scene: SceneData, index: number) => ({
        order: index + 1,
        imageUrl: scene.imageUrl,
        audioUrl: scene.audioUrl,
        duration: Math.min(Math.max(scene.duration || 5, MIN_SCENE_DURATION), MAX_SCENE_DURATION),
      })),
      totalDuration,
      createdAt: new Date().toISOString(),
      userId: user.id,
    };

    // Store manifest
    const manifestFileName = `${projectId}/manifest-${Date.now()}.json`;
    const manifestData = new TextEncoder().encode(JSON.stringify(videoManifest, null, 2));

    const { error: manifestError } = await supabase.storage
      .from("exported-videos")
      .upload(manifestFileName, manifestData, { 
        contentType: "application/json", 
        upsert: true 
      });

    if (manifestError) {
      console.error("Manifest upload error:", manifestError);
    }

    const { data: manifestUrlData } = supabase.storage
      .from("exported-videos")
      .getPublicUrl(manifestFileName);

    console.log(`Manifest stored at: ${manifestUrlData.publicUrl}`);

    // Generate an interactive video player that properly stitches scenes together
    const resolution = validatedAspectRatio === "16:9" ? { width: 1280, height: 720 } : { width: 405, height: 720 };
    
    const videoPlayerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KakiStoryChannel - ${projectId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); 
      display: flex; 
      flex-direction: column;
      justify-content: center; 
      align-items: center; 
      min-height: 100vh; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: white;
      padding: 20px;
    }
    .container {
      max-width: ${resolution.width}px;
      width: 100%;
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      text-align: center;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .player-wrapper {
      position: relative;
      width: 100%;
      aspect-ratio: ${validatedAspectRatio.replace(":", "/")};
      background: #000;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }
    .scene-display {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: none;
    }
    .scene-display.active {
      display: block;
    }
    .controls {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(transparent, rgba(0,0,0,0.8));
      padding: 40px 20px 20px;
    }
    .progress-container {
      width: 100%;
      height: 6px;
      background: rgba(255,255,255,0.2);
      border-radius: 3px;
      cursor: pointer;
      margin-bottom: 15px;
    }
    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      border-radius: 3px;
      width: 0%;
      transition: width 0.1s linear;
    }
    .controls-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .btn-group {
      display: flex;
      gap: 10px;
    }
    .btn {
      background: rgba(255,255,255,0.1);
      border: none;
      color: white;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .btn:hover {
      background: rgba(255,255,255,0.2);
      transform: scale(1.1);
    }
    .btn.play-btn {
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .btn svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }
    .time-display {
      font-size: 14px;
      font-variant-numeric: tabular-nums;
      color: rgba(255,255,255,0.9);
    }
    ${validatedIncludeWatermark ? `
    .watermark {
      position: absolute;
      bottom: 80px;
      right: 15px;
      color: rgba(255,255,255,0.6);
      font-size: 12px;
      font-weight: 500;
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    }` : ''}
    .overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.4);
      cursor: pointer;
    }
    .overlay.hidden {
      display: none;
    }
    .play-overlay-btn {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
    }
    .play-overlay-btn:hover {
      transform: scale(1.1);
    }
    .play-overlay-btn svg {
      width: 36px;
      height: 36px;
      fill: white;
      margin-left: 5px;
    }
    .info {
      margin-top: 1rem;
      text-align: center;
      color: rgba(255,255,255,0.6);
      font-size: 0.875rem;
    }
    .download-hint {
      margin-top: 1.5rem;
      padding: 1rem;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      text-align: center;
    }
    .download-hint p {
      color: rgba(255,255,255,0.7);
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Your Story Video</h1>
    <div class="player-wrapper">
      ${validScenes.map((s: SceneData, i: number) => `
        <img class="scene-display${i === 0 ? " active" : ""}" 
             src="${s.imageUrl}" 
             data-duration="${Math.min(Math.max(s.duration || 5, MIN_SCENE_DURATION), MAX_SCENE_DURATION)}" 
             data-audio="${s.audioUrl}"
             data-index="${i}"
             alt="Scene ${i + 1}" />
      `).join("")}
      
      <div class="overlay" id="startOverlay">
        <div class="play-overlay-btn">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>
      
      ${validatedIncludeWatermark ? '<div class="watermark">Made with KakiStoryChannel</div>' : ''}
      
      <div class="controls">
        <div class="progress-container" id="progressContainer">
          <div class="progress-bar" id="progressBar"></div>
        </div>
        <div class="controls-row">
          <div class="btn-group">
            <button class="btn" id="prevBtn" title="Previous scene">
              <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
            </button>
            <button class="btn play-btn" id="playBtn" title="Play/Pause">
              <svg viewBox="0 0 24 24" id="playIcon"><path d="M8 5v14l11-7z"/></svg>
              <svg viewBox="0 0 24 24" id="pauseIcon" style="display:none"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </button>
            <button class="btn" id="nextBtn" title="Next scene">
              <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
          </div>
          <div class="time-display">
            <span id="currentTime">0:00</span> / <span id="totalTime">${Math.floor(totalDuration / 60)}:${String(Math.floor(totalDuration % 60)).padStart(2, '0')}</span>
          </div>
        </div>
      </div>
    </div>
    <p class="info">${validScenes.length} scenes • ${Math.floor(totalDuration / 60)}:${String(Math.floor(totalDuration % 60)).padStart(2, '0')} total duration</p>
    <div class="download-hint">
      <p>To save this video, use screen recording software or right-click to save individual scenes.</p>
    </div>
  </div>

  <script>
    const scenes = document.querySelectorAll('.scene-display');
    const progressBar = document.getElementById('progressBar');
    const progressContainer = document.getElementById('progressContainer');
    const playBtn = document.getElementById('playBtn');
    const playIcon = document.getElementById('playIcon');
    const pauseIcon = document.getElementById('pauseIcon');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const currentTimeEl = document.getElementById('currentTime');
    const startOverlay = document.getElementById('startOverlay');
    
    const totalDuration = ${totalDuration};
    const sceneDurations = [${validScenes.map((s: SceneData) => Math.min(Math.max(s.duration || 5, MIN_SCENE_DURATION), MAX_SCENE_DURATION)).join(', ')}];
    
    let currentSceneIndex = 0;
    let isPlaying = false;
    let currentAudio = null;
    let sceneStartTime = 0;
    let globalStartTime = 0;
    let animationFrameId = null;
    
    function formatTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return mins + ':' + String(secs).padStart(2, '0');
    }
    
    function getElapsedTimeBeforeScene(sceneIndex) {
      let elapsed = 0;
      for (let i = 0; i < sceneIndex; i++) {
        elapsed += sceneDurations[i];
      }
      return elapsed;
    }
    
    function showScene(index) {
      scenes.forEach((s, i) => s.classList.toggle('active', i === index));
      currentSceneIndex = index;
    }
    
    function updateProgress() {
      if (!isPlaying) return;
      
      const now = Date.now();
      const sceneElapsed = (now - sceneStartTime) / 1000;
      const currentSceneDuration = sceneDurations[currentSceneIndex];
      
      if (sceneElapsed >= currentSceneDuration) {
        // Move to next scene
        if (currentSceneIndex < scenes.length - 1) {
          playScene(currentSceneIndex + 1);
        } else {
          // Video ended
          stopPlayback();
          currentSceneIndex = 0;
          showScene(0);
          progressBar.style.width = '0%';
          currentTimeEl.textContent = '0:00';
          startOverlay.classList.remove('hidden');
          return;
        }
      }
      
      // Calculate global progress
      const globalElapsed = getElapsedTimeBeforeScene(currentSceneIndex) + Math.min(sceneElapsed, currentSceneDuration);
      const progress = (globalElapsed / totalDuration) * 100;
      progressBar.style.width = progress + '%';
      currentTimeEl.textContent = formatTime(globalElapsed);
      
      animationFrameId = requestAnimationFrame(updateProgress);
    }
    
    function playScene(index) {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
      }
      
      showScene(index);
      sceneStartTime = Date.now();
      
      const scene = scenes[index];
      const audioUrl = scene.dataset.audio;
      
      if (audioUrl) {
        currentAudio = new Audio(audioUrl);
        currentAudio.play().catch(e => console.log('Audio play failed:', e));
      }
    }
    
    function startPlayback() {
      isPlaying = true;
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
      startOverlay.classList.add('hidden');
      playScene(currentSceneIndex);
      animationFrameId = requestAnimationFrame(updateProgress);
    }
    
    function stopPlayback() {
      isPlaying = false;
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
      if (currentAudio) {
        currentAudio.pause();
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    }
    
    function togglePlayback() {
      if (isPlaying) {
        stopPlayback();
      } else {
        startPlayback();
      }
    }
    
    playBtn.addEventListener('click', togglePlayback);
    startOverlay.addEventListener('click', startPlayback);
    
    prevBtn.addEventListener('click', () => {
      const wasPlaying = isPlaying;
      stopPlayback();
      currentSceneIndex = Math.max(0, currentSceneIndex - 1);
      showScene(currentSceneIndex);
      const elapsed = getElapsedTimeBeforeScene(currentSceneIndex);
      progressBar.style.width = (elapsed / totalDuration * 100) + '%';
      currentTimeEl.textContent = formatTime(elapsed);
      if (wasPlaying) startPlayback();
    });
    
    nextBtn.addEventListener('click', () => {
      const wasPlaying = isPlaying;
      stopPlayback();
      currentSceneIndex = Math.min(scenes.length - 1, currentSceneIndex + 1);
      showScene(currentSceneIndex);
      const elapsed = getElapsedTimeBeforeScene(currentSceneIndex);
      progressBar.style.width = (elapsed / totalDuration * 100) + '%';
      currentTimeEl.textContent = formatTime(elapsed);
      if (wasPlaying) startPlayback();
    });
    
    progressContainer.addEventListener('click', (e) => {
      const rect = progressContainer.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = clickX / rect.width;
      const targetTime = percentage * totalDuration;
      
      // Find which scene this time falls into
      let accumulatedTime = 0;
      let targetSceneIndex = 0;
      for (let i = 0; i < sceneDurations.length; i++) {
        if (accumulatedTime + sceneDurations[i] > targetTime) {
          targetSceneIndex = i;
          break;
        }
        accumulatedTime += sceneDurations[i];
        if (i === sceneDurations.length - 1) {
          targetSceneIndex = i;
        }
      }
      
      const wasPlaying = isPlaying;
      stopPlayback();
      currentSceneIndex = targetSceneIndex;
      showScene(currentSceneIndex);
      progressBar.style.width = (percentage * 100) + '%';
      currentTimeEl.textContent = formatTime(targetTime);
      if (wasPlaying) startPlayback();
    });
    
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayback();
      } else if (e.code === 'ArrowLeft') {
        prevBtn.click();
      } else if (e.code === 'ArrowRight') {
        nextBtn.click();
      }
    });
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
      throw new Error("Failed to upload video player");
    }

    const { data: playerUrlData } = supabase.storage
      .from("exported-videos")
      .getPublicUrl(playerFileName);

    console.log(`Video player created for user ${user.id}: ${playerUrlData.publicUrl}`);
    console.log(`Export completed successfully for project ${projectId}`);

    return new Response(
      JSON.stringify({ 
        videoUrl: playerUrlData.publicUrl,
        manifestUrl: manifestUrlData.publicUrl,
        totalDuration,
        sceneCount: validScenes.length,
        message: "Video exported successfully as interactive player",
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
