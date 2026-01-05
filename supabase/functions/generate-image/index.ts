import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Generate Image Edge Function
 * 
 * Uses Google Gemini Imagen API directly with user-provided API key.
 * Includes authentication, authorization, and input validation.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IMAGEN_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict";

// Valid enum values from database
const VALID_STYLES = ["cartoon", "storybook", "kids_illustration"];
const VALID_MOODS = ["calm", "emotional", "dramatic", "happy", "tense", "sad", "exciting"];

// UUID regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Input constraints
const MAX_DESCRIPTION_LENGTH = 2000;

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
    const { sceneId, visualDescription, style, mood } = body;

    // Validate sceneId as UUID
    if (!sceneId || typeof sceneId !== 'string' || !UUID_REGEX.test(sceneId)) {
      return new Response(
        JSON.stringify({ error: "Bad Request", message: "Valid scene ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate visualDescription
    if (!visualDescription || typeof visualDescription !== 'string') {
      return new Response(
        JSON.stringify({ error: "Bad Request", message: "Visual description is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sanitizedDescription = sanitizeText(visualDescription);
    if (sanitizedDescription.length > MAX_DESCRIPTION_LENGTH) {
      return new Response(
        JSON.stringify({ error: "Bad Request", message: `Visual description must be less than ${MAX_DESCRIPTION_LENGTH} characters` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate style and mood against allowed values
    const validatedStyle = VALID_STYLES.includes(style) ? style : "cartoon";
    const validatedMood = VALID_MOODS.includes(mood) ? mood : "calm";

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

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not configured");
      return new Response(
        JSON.stringify({ 
          error: "API key not configured", 
          message: "Gemini API key is not configured." 
        }),
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

    const prompt = `${sanitizedDescription}. Style: ${stylePrompts[validatedStyle]}. Mood: ${moodPrompts[validatedMood]}. High quality, detailed illustration suitable for children's story video.`;

    console.log("Generating image with Gemini Imagen:", prompt.substring(0, 100) + "...");

    const response = await fetch(`${IMAGEN_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "16:9",
          safetyFilterLevel: "block_low_and_above",
          personGeneration: "allow_adult"
        }
      }),
    });

    if (response.status === 429) {
      console.error("Rate limit exceeded on Gemini API");
      return new Response(
        JSON.stringify({ 
          error: "Rate limit exceeded", 
          message: "Too many requests to Gemini API. Please wait a minute and try again." 
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini Imagen API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: "AI request failed", 
          message: `Gemini API returned status ${response.status}` 
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const imageData = data.predictions?.[0]?.bytesBase64Encoded;

    if (!imageData) {
      console.error("No image in Gemini response:", JSON.stringify(data));
      throw new Error("No image generated from AI service.");
    }

    // Upload to Supabase Storage
    const imageBuffer = Uint8Array.from(atob(imageData), (c) => c.charCodeAt(0));
    const fileName = `${sceneId}/${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("project-assets")
      .upload(fileName, imageBuffer, { contentType: "image/png", upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("Failed to upload image to storage");
    }

    const { data: urlData } = supabase.storage.from("project-assets").getPublicUrl(fileName);

    console.log(`Image generated and uploaded successfully for user ${user.id}:`, urlData.publicUrl);

    return new Response(JSON.stringify({ imageUrl: urlData.publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Generate image error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to generate image", 
        message: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
