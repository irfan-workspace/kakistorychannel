import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Generate Voiceover Edge Function
 * 
 * Uses ElevenLabs API for text-to-speech.
 * Includes authentication, authorization, input validation, and usage tracking.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_VOICE_TYPES = ["male", "female", "child"];
const VALID_LANGUAGES = ["hindi", "hinglish", "english"];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_TEXT_LENGTH = 5000;
const MIN_TEXT_LENGTH = 1;

// Cost pricing configuration (USD)
const AI_PRICING = {
  elevenlabs: {
    per_1k_chars: 0.30,
  },
};

const USD_TO_INR = 83;

const voiceMap: Record<string, Record<string, string>> = {
  hindi: {
    female: "EXAVITQu4vr4xnSDxMaL",
    male: "JBFqnCBsd6RMkjVDRZzb",
    child: "pFZP5JQG7iQjIQuC4Bku",
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
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}

async function logUsage(
  supabase: any,
  userId: string,
  projectId: string | null,
  sceneId: string | null,
  feature: string,
  provider: string,
  model: string,
  charCount: number,
  status: "success" | "failed",
  errorMessage?: string
) {
  try {
    const costUsd = (charCount / 1000) * AI_PRICING.elevenlabs.per_1k_chars;
    const costInr = costUsd * USD_TO_INR;

    await supabase.from('api_usage_logs').insert({
      user_id: userId,
      project_id: projectId,
      scene_id: sceneId,
      provider,
      model,
      feature,
      input_tokens: charCount, // Using tokens field for character count
      output_tokens: 0,
      total_tokens: charCount,
      api_calls: 1,
      cost_usd: status === "success" ? costUsd : 0,
      cost_inr: status === "success" ? costInr : 0,
      status,
      error_message: errorMessage,
      metadata: { char_count: charCount },
    });

    console.log(`Usage logged: ${feature}, chars: ${charCount}, cost: $${costUsd.toFixed(4)}`);
  } catch (err) {
    console.error("Failed to log usage:", err);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let userId: string | null = null;
  let projectId: string | null = null;
  let sceneId: string | null = null;
  let charCount = 0;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    userId = user.id;
    console.log(`Authenticated user: ${user.id}`);

    const body = await req.json();
    const { sceneId: reqSceneId, text, voiceType, language } = body;
    sceneId = reqSceneId;

    if (!sceneId || typeof sceneId !== 'string' || !UUID_REGEX.test(sceneId)) {
      return new Response(
        JSON.stringify({ error: "Bad Request", message: "Valid scene ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: "Bad Request", message: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sanitizedText = sanitizeText(text);
    charCount = sanitizedText.length;

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

    const validatedVoiceType = VALID_VOICE_TYPES.includes(voiceType) ? voiceType : "female";
    const validatedLanguage = VALID_LANGUAGES.includes(language) ? language : "english";

    const { data: scene, error: sceneError } = await serviceSupabase
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

    projectId = scene.project_id;
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

    const voiceId = voiceMap[validatedLanguage]?.[validatedVoiceType] || voiceMap.english.female;

    console.log(`Generating voiceover for scene ${sceneId} with voice ${voiceId}`);

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
      await logUsage(serviceSupabase, userId, projectId, sceneId, "generate-voiceover", "elevenlabs", "eleven_multilingual_v2", charCount, "failed", `API error: ${response.status}`);
      return new Response(
        JSON.stringify({ error: "TTS API error", message: `ElevenLabs API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    const audioData = new Uint8Array(audioBuffer);

    const fileName = `${sceneId}/${Date.now()}.mp3`;

    const { error: uploadError } = await serviceSupabase.storage
      .from("project-assets")
      .upload(fileName, audioData, { contentType: "audio/mpeg", upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      await logUsage(serviceSupabase, userId, projectId, sceneId, "generate-voiceover", "elevenlabs", "eleven_multilingual_v2", charCount, "failed", "Failed to upload audio");
      throw new Error("Failed to upload audio");
    }

    const { data: urlData } = serviceSupabase.storage.from("project-assets").getPublicUrl(fileName);

    const wordCount = sanitizedText.split(/\s+/).filter(Boolean).length;
    const estimatedDuration = Math.max(3, Math.round(wordCount / 2.5));

    // Log successful usage
    await logUsage(serviceSupabase, userId, projectId, sceneId, "generate-voiceover", "elevenlabs", "eleven_multilingual_v2", charCount, "success");

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
    
    if (userId) {
      await logUsage(serviceSupabase, userId, projectId, sceneId, "generate-voiceover", "elevenlabs", "eleven_multilingual_v2", charCount, "failed", error instanceof Error ? error.message : "Unknown error");
    }
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to generate voiceover" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
