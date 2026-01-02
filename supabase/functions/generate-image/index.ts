import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      throw new Error("LOVABLE_API_KEY is not configured");
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

    const prompt = `${visualDescription}. Style: ${stylePrompts[style] || stylePrompts.cartoon}. Mood: ${moodPrompts[mood] || moodPrompts.calm}. High quality, detailed illustration suitable for children's story video.`;

    console.log("Generating image with prompt:", prompt.substring(0, 100) + "...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Image generation error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Image generation failed: ${response.status}`);
    }

    const data = await response.json();
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageData) {
      throw new Error("No image in response");
    }

    // Upload to Supabase Storage
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    const fileName = `${sceneId}/${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("project-assets")
      .upload(fileName, imageBuffer, { contentType: "image/png", upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("Failed to upload image");
    }

    const { data: urlData } = supabase.storage.from("project-assets").getPublicUrl(fileName);

    console.log("Image uploaded successfully:", urlData.publicUrl);

    return new Response(JSON.stringify({ imageUrl: urlData.publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Generate image error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to generate image" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
