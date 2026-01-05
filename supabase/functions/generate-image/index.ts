import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Generate Image Edge Function
 * 
 * Uses Google Gemini API (Imagen) directly with your own API key.
 * 
 * CONFIGURATION:
 * Set the GEMINI_API_KEY environment variable in your Supabase project secrets.
 * You can get an API key from: https://aistudio.google.com/apikey
 * 
 * To update the API key, go to Supabase Dashboard > Project Settings > Edge Functions > Secrets
 * and update the GEMINI_API_KEY value.
 * 
 * NOTE: Image generation requires Gemini API with Imagen support.
 * If image generation is not available, consider using an alternative like DALL-E or Stable Diffusion.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google Gemini API endpoint for image generation
// Using gemini-2.0-flash-exp with image generation capabilities
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sceneId, visualDescription, style, mood } = await req.json();
    
    // ============================================
    // API KEY CONFIGURATION
    // The GEMINI_API_KEY is read from environment variables.
    // To replace the API key, update the secret in Supabase Dashboard.
    // ============================================
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Error handling: Missing API key
    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not configured");
      return new Response(
        JSON.stringify({ 
          error: "API key not configured", 
          message: "Please set the GEMINI_API_KEY in your Supabase project secrets." 
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

    console.log("Generating image with Gemini API:", prompt.substring(0, 100) + "...");

    // Call Google Gemini API directly for image generation
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseModalities: ["image", "text"],
          temperature: 1,
          topK: 40,
          topP: 0.95
        }
      }),
    });

    // Error handling: API request failures
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      
      // Error handling: Invalid API key (401/403)
      if (response.status === 401 || response.status === 403) {
        return new Response(
          JSON.stringify({ 
            error: "Invalid API key", 
            message: "The GEMINI_API_KEY is invalid or has been revoked. Please update it in your Supabase project secrets." 
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Error handling: Rate limiting (429)
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: "Rate limit exceeded", 
            message: "Too many requests. Please try again later." 
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Generic API error
      return new Response(
        JSON.stringify({ 
          error: "API request failed", 
          message: `Gemini API returned status ${response.status}` 
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    
    // Extract image from Gemini response
    // The response format for image generation includes inline_data with base64 image
    const parts = data.candidates?.[0]?.content?.parts;
    let imageData: string | null = null;
    
    if (parts) {
      for (const part of parts) {
        if (part.inlineData?.data) {
          imageData = part.inlineData.data;
          break;
        }
      }
    }

    if (!imageData) {
      console.error("No image in Gemini response:", JSON.stringify(data));
      throw new Error("No image generated. The model may not support image generation with your current API key.");
    }

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
