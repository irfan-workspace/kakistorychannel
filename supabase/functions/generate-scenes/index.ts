import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Generate Scenes Edge Function
 * 
 * Uses Google Gemini API directly with your own API key.
 * 
 * CONFIGURATION:
 * Set the GEMINI_API_KEY environment variable in your Supabase project secrets.
 * You can get an API key from: https://aistudio.google.com/apikey
 * 
 * To update the API key, go to Supabase Dashboard > Project Settings > Edge Functions > Secrets
 * and update the GEMINI_API_KEY value.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google Gemini API endpoint
// Using gemini-1.5-flash for fast, cost-effective scene generation
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { script, language, storyType, tone } = await req.json();
    
    // ============================================
    // API KEY CONFIGURATION
    // The GEMINI_API_KEY is read from environment variables.
    // To replace the API key, update the secret in Supabase Dashboard.
    // ============================================
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

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

Return a JSON array of scenes with this exact structure:
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

    console.log("Calling Gemini API for scene generation...");

    // Call Google Gemini API directly
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\nAnalyze this story script and create scenes:\n\n${script}` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
          responseMimeType: "application/json"
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
    
    // Extract content from Gemini response format
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      console.error("No content in Gemini response:", JSON.stringify(data));
      throw new Error("No content in AI response");
    }

    // Parse the JSON response
    const parsed = JSON.parse(content);
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
