import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const VALID_STYLES = ["cartoon", "storybook", "kids_illustration"];
const VALID_MOODS = ["calm", "emotional", "dramatic", "happy", "tense", "sad", "exciting"];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DESCRIPTION_LENGTH = 2000;

// Cost pricing configuration (USD)
const AI_PRICING = {
  "gemini-image": {
    per_image: 0.04,
  },
};

const USD_TO_INR = 83;

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
  status: "success" | "failed",
  errorMessage?: string
) {
  try {
    const costUsd = AI_PRICING["gemini-image"].per_image;
    const costInr = costUsd * USD_TO_INR;

    await supabase.from('api_usage_logs').insert({
      user_id: userId,
      project_id: projectId,
      scene_id: sceneId,
      provider,
      model,
      feature,
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      api_calls: 1,
      cost_usd: status === "success" ? costUsd : 0,
      cost_inr: status === "success" ? costInr : 0,
      status,
      error_message: errorMessage,
    });

    console.log(`Usage logged: ${feature}, cost: $${costUsd.toFixed(4)}`);
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

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    userId = user.id;
    console.log(`Authenticated user: ${user.id}`);

    const body = await req.json();
    const { sceneId: reqSceneId, visualDescription, style, mood } = body;
    sceneId = reqSceneId;

    if (!sceneId || typeof sceneId !== 'string' || !UUID_REGEX.test(sceneId)) {
      return new Response(
        JSON.stringify({ error: "Valid scene ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!visualDescription || typeof visualDescription !== 'string') {
      return new Response(
        JSON.stringify({ error: "Visual description is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sanitizedDescription = sanitizeText(visualDescription);
    if (sanitizedDescription.length > MAX_DESCRIPTION_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Visual description must be less than ${MAX_DESCRIPTION_LENGTH} characters` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validatedStyle = VALID_STYLES.includes(style) ? style : "cartoon";
    const validatedMood = VALID_MOODS.includes(mood) ? mood : "calm";

    const { data: scene, error: sceneError } = await serviceSupabase
      .from('scenes')
      .select('project_id, projects(user_id)')
      .eq('id', sceneId)
      .single();

    if (sceneError || !scene) {
      return new Response(
        JSON.stringify({ error: "Scene not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    projectId = scene.project_id;
    const projectUserId = (scene.projects as any)?.user_id;
    if (projectUserId !== user.id) {
      return new Response(
        JSON.stringify({ error: "You don't have permission to access this scene" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Lovable API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stylePrompts: Record<string, string> = {
      cartoon: "colorful cartoon style, vibrant colors, clean lines, Disney-Pixar inspired, child-friendly",
      storybook: "classic storybook illustration, watercolor style, warm lighting, whimsical, fairy tale aesthetic",
      kids_illustration: "soft children's book illustration, pastel colors, gentle shapes, friendly characters, cozy atmosphere",
    };

    const moodPrompts: Record<string, string> = {
      calm: "peaceful, serene lighting, soft tones",
      emotional: "warm emotional lighting, touching moment",
      dramatic: "dramatic lighting, dynamic composition",
      happy: "bright cheerful lighting, joyful atmosphere",
      tense: "suspenseful atmosphere, dramatic shadows",
      sad: "melancholic mood, soft muted colors",
      exciting: "dynamic action, vibrant energy",
    };

    const prompt = `${sanitizedDescription}. Style: ${stylePrompts[validatedStyle]}. Mood: ${moodPrompts[validatedMood]}. High quality, detailed illustration suitable for children's story video. 16:9 aspect ratio.`;

    console.log(`Generating image for scene ${sceneId}`);

    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          { role: "user", content: prompt }
        ],
        modalities: ["image", "text"],
      }),
    });

    if (response.status === 429) {
      await logUsage(serviceSupabase, userId, projectId, sceneId, "generate-image", "google", "gemini-2.5-flash-image-preview", "failed", "Rate limit exceeded");
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (response.status === 402) {
      await logUsage(serviceSupabase, userId, projectId, sceneId, "generate-image", "google", "gemini-2.5-flash-image-preview", "failed", "Credits exhausted");
      return new Response(
        JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      await logUsage(serviceSupabase, userId, projectId, sceneId, "generate-image", "google", "gemini-2.5-flash-image-preview", "failed", `API error: ${response.status}`);
      return new Response(
        JSON.stringify({ error: `AI service error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    
    const images = data.choices?.[0]?.message?.images;
    let imageData: string | null = null;

    if (images && images.length > 0) {
      const imageUrl = images[0]?.image_url?.url;
      if (imageUrl?.startsWith('data:image/')) {
        const base64Match = imageUrl.match(/data:image\/[^;]+;base64,(.+)/);
        if (base64Match) {
          imageData = base64Match[1];
        }
      }
    }

    if (!imageData) {
      console.error("No image in response:", JSON.stringify(data).substring(0, 500));
      await logUsage(serviceSupabase, userId, projectId, sceneId, "generate-image", "google", "gemini-2.5-flash-image-preview", "failed", "No image generated");
      return new Response(
        JSON.stringify({ error: "No image generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const imageBuffer = Uint8Array.from(atob(imageData), c => c.charCodeAt(0));
    const fileName = `${sceneId}/${Date.now()}.png`;

    const { error: uploadError } = await serviceSupabase.storage
      .from('project-assets')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      await logUsage(serviceSupabase, userId, projectId, sceneId, "generate-image", "google", "gemini-2.5-flash-image-preview", "failed", "Failed to upload image");
      return new Response(
        JSON.stringify({ error: "Failed to upload image" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: urlData } = serviceSupabase.storage
      .from('project-assets')
      .getPublicUrl(fileName);

    // Log successful usage
    await logUsage(serviceSupabase, userId, projectId, sceneId, "generate-image", "google", "gemini-2.5-flash-image-preview", "success");

    console.log(`Image generated for scene ${sceneId}: ${urlData.publicUrl}`);

    return new Response(
      JSON.stringify({ imageUrl: urlData.publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generate image error:", error);
    
    if (userId) {
      await logUsage(serviceSupabase, userId, projectId, sceneId, "generate-image", "google", "gemini-2.5-flash-image-preview", "failed", error instanceof Error ? error.message : "Unknown error");
    }
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
