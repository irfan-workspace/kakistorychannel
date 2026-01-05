import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Generate Scenes Edge Function (Production Architecture)
 * 
 * Uses Lovable AI Gateway for reliable, high-throughput scene generation.
 * No external API key management required - uses pre-configured LOVABLE_API_KEY.
 * 
 * Features:
 * - Higher rate limits than direct Gemini API
 * - Automatic load balancing
 * - Proper error handling for rate limits (429) and payment (402)
 * - No unnecessary retry logic that wastes quota
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lovable AI Gateway endpoint (OpenAI-compatible)
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { script, language, storyType, tone } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

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

    const systemPrompt = `You are a professional story scene analyzer for children's video content. Your task is to analyze a story script and break it into logical visual scenes.

Guidelines:
- Create 6-12 scenes maximum
- Each scene should represent a distinct visual moment
- Don't split sentence by sentence - group related content
- Include clear visual descriptions for image generation
- Estimate duration based on narration length (avg 2-3 words per second)

Language: ${language}
Story Type: ${storyType}
Tone: ${tone}

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
{
  "scenes": [
    {
      "title": "Scene title (short)",
      "narration_text": "The exact text to be narrated",
      "visual_description": "Detailed visual description for AI image generation",
      "estimated_duration": 5,
      "mood": "calm/happy/tense/sad/exciting"
    }
  ]
}`;

    console.log("Calling Lovable AI Gateway for scene generation...");

    // Single request - no unnecessary retries
    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze this story script and create scenes:\n\n${script}` }
        ],
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
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("No content in AI response:", JSON.stringify(data));
      throw new Error("No content in AI response");
    }

    // Parse JSON response (handle potential markdown code blocks)
    let parsed;
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Invalid JSON response from AI");
    }

    console.log(`Generated ${parsed.scenes?.length || 0} scenes successfully`);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Generate scenes error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to generate scenes", 
        message: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
