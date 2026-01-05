import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Generate Image Edge Function (Production Architecture)
 * 
 * Uses Lovable AI Gateway with Gemini image generation model.
 * No external API key management required - uses pre-configured LOVABLE_API_KEY.
 * 
 * Features:
 * - Higher rate limits than direct Gemini API
 * - Automatic image upload to Supabase Storage
 * - Proper error handling for rate limits (429) and payment (402)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lovable AI Gateway endpoint
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sceneId, visualDescription, style, mood } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ 
          error: "API key not configured", 
          message: "Lovable AI is not properly configured." 
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

    const prompt = `Generate an image: ${visualDescription}. Style: ${stylePrompts[style] || stylePrompts.cartoon}. Mood: ${moodPrompts[mood] || moodPrompts.calm}. High quality, detailed illustration suitable for children's story video.`;

    console.log("Generating image with Lovable AI:", prompt.substring(0, 100) + "...");

    // Call Lovable AI Gateway with image generation model
    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          { role: "user", content: prompt }
        ],
        modalities: ["image", "text"]
      }),
    });

    // Handle rate limiting (429)
    if (response.status === 429) {
      console.error("Rate limit exceeded on Lovable AI");
      return new Response(
        JSON.stringify({ 
          error: "Rate limit exceeded", 
          message: "Too many requests. Please wait a moment and try again." 
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle payment required (402)
    if (response.status === 402) {
      console.error("Payment required for Lovable AI");
      return new Response(
        JSON.stringify({ 
          error: "Credits exhausted", 
          message: "Please add credits to your Lovable workspace." 
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: "AI request failed", 
          message: `AI service returned status ${response.status}` 
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    
    // Extract image from Lovable AI response format
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error("No image in AI response:", JSON.stringify(data));
      throw new Error("No image generated from AI service.");
    }

    // Extract base64 data from data URL
    const base64Match = imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (!base64Match) {
      console.error("Invalid image format:", imageUrl.substring(0, 50));
      throw new Error("Invalid image format received from AI.");
    }

    const imageData = base64Match[1];

    // Upload to Supabase Storage
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
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

    console.log("Image generated and uploaded successfully:", urlData.publicUrl);

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
