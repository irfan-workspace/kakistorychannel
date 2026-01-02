import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sceneId, text, voiceType, language } = await req.json();
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    // Get voice ID based on language and voice type
    const voiceId = voiceMap[language]?.[voiceType] || voiceMap.english.female;

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
          text,
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
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const audioData = new Uint8Array(audioBuffer);

    // Upload to Supabase Storage
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
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
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const estimatedDuration = Math.max(3, Math.round(wordCount / 2.5));

    console.log(`Audio uploaded: ${urlData.publicUrl}, estimated duration: ${estimatedDuration}s`);

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
