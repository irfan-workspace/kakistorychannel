import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Generate Voiceover Edge Function
 * 
 * Uses ElevenLabs API for text-to-speech.
 * Includes authentication, authorization, and input validation.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Valid enum values from database
const VALID_VOICE_TYPES = ["male", "female", "child"];
const VALID_LANGUAGES = ["hindi", "hinglish", "english"];

// UUID regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Input constraints
const MAX_TEXT_LENGTH = 5000;
const MIN_TEXT_LENGTH = 1;

// Voice IDs for different voice types and languages
const voiceMap: Record<string, Record<string, string>> = {
  hindi: {
    female: "EXAVITQu4vr4xnSDxMaL", // Sarah - works well for Hindi
    male: "JBFqnCBsd6RMkjVDRZzb", // George
    child: "pFZP5JQG7iQjIQuC4Bku", // Lily
  },
  hinglish: {
    female: "EXAVITQu4vr4xnSDxMaL",
    male: "JBFqnCBsd6RMkjVDRZzb",
    child: "pFZP5JQG7iQjIQuC4Bku",
  },
  english: {
    female: "EXAVITQu4vr4xnSDxMaL",
    male: "JBFqnCBsd6RMkjVDRZzb",
    child: "pFZP5JQG7iQjIQuC4Bku",
  },
};

function sanitizeText(text: string): string {
  // Remove control characters except newlines and tabs
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
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
    const { sceneId, text, voiceType, language } = body;

    // Validate sceneId as UUID
    if (!sceneId || typeof sceneId !== 'string' || !UUID_REGEX.test(sceneId)) {
      return new Response(
        JSON.stringify({ error: "Bad Request", message: "Valid scene ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate text
    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: "Bad Request", message: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sanitizedText = sanitizeText(text);
    if (sanitizedText.length < MIN_TEXT_LENGTH) {
      return new Response(
        JSON.stringify({ error: "Bad Request", message: "Text cannot be empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (sanitizedText.length > MAX_TEXT_LENGTH) {
      return new Response(
        JSON.stringify({ error: "Bad Request", message: `Text must be less than ${MAX_TEXT_LENGTH} characters` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate voiceType and language against allowed values
    const validatedVoiceType = VALID_VOICE_TYPES.includes(voiceType) ? voiceType : "female";
    const validatedLanguage = VALID_LANGUAGES.includes(language) ? language : "english";

    // Authorization check - verify user owns the scene's project
    // Use service role client for database queries
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: scene, error: sceneError } = await supabase
      .from('scenes')
      .select('project_id, projects(user_id)')
      .eq('id', sceneId)
      .single();

    if (sceneError || !scene) {
      console.error("Scene not found:", sceneError?.message);
      return new Response(
        JSON.stringify({ error: "Not Found", message: "Scene not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user owns the project
    const projectUserId = (scene.projects as any)?.user_id;
    if (projectUserId !== user.id) {
      console.error(`User ${user.id} attempted to access scene owned by ${projectUserId}`);
      return new Response(
        JSON.stringify({ error: "Forbidden", message: "You don't have permission to access this scene" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    if (!ELEVENLABS_API_KEY) {
      console.error("ELEVENLABS_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "API key not configured", message: "ElevenLabs API key is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get voice ID based on language and voice type
    const voiceId = voiceMap[validatedLanguage]?.[validatedVoiceType] || voiceMap.english.female;

    console.log(`Generating voiceover for scene ${sceneId} with voice ${voiceId}`);

    // Generate voiceover with ElevenLabs
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: sanitizedText,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.6,
            similarity_boost: 0.75,
            style: 0.4,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "TTS API error", message: `ElevenLabs API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    const audioData = new Uint8Array(audioBuffer);

    // Upload to Supabase Storage
    const fileName = `${sceneId}/${Date.now()}.mp3`;

    const { error: uploadError } = await supabase.storage
      .from("project-assets")
      .upload(fileName, audioData, { contentType: "audio/mpeg", upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("Failed to upload audio");
    }

    const { data: urlData } = supabase.storage.from("project-assets").getPublicUrl(fileName);

    // Estimate duration (rough calculation: ~2.5 words per second)
    const wordCount = sanitizedText.split(/\s+/).filter(Boolean).length;
    const estimatedDuration = Math.max(3, Math.round(wordCount / 2.5));

    console.log(`Audio uploaded for user ${user.id}: ${urlData.publicUrl}, estimated duration: ${estimatedDuration}s`);

    return new Response(
      JSON.stringify({ 
        audioUrl: urlData.publicUrl,
        duration: estimatedDuration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generate voiceover error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to generate voiceover" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
