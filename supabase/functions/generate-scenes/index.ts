import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Generate Scenes Edge Function
 * 
 * Uses Google Gemini API directly with user-provided API key.
 * Includes authentication and input validation.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Valid enum values from database
const VALID_LANGUAGES = ["hindi", "hinglish", "english"];
const VALID_STORY_TYPES = ["kids", "bedtime", "moral"];
const VALID_TONES = ["calm", "emotional", "dramatic"];

// Input constraints
const MAX_SCRIPT_LENGTH = 10000;
const MIN_SCRIPT_LENGTH = 10;

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

    // Create client with user's auth token
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
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
    const { script, language, storyType, tone } = body;

    // Validate script
    if (!script || typeof script !== 'string') {
      return new Response(
        JSON.stringify({ error: "Bad Request", message: "Script is required and must be a string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sanitizedScript = sanitizeText(script);
    if (sanitizedScript.length < MIN_SCRIPT_LENGTH) {
      return new Response(
        JSON.stringify({ error: "Bad Request", message: `Script must be at least ${MIN_SCRIPT_LENGTH} characters` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (sanitizedScript.length > MAX_SCRIPT_LENGTH) {
      return new Response(
        JSON.stringify({ error: "Bad Request", message: `Script must be less than ${MAX_SCRIPT_LENGTH} characters` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate language
    const validatedLanguage = VALID_LANGUAGES.includes(language) ? language : "english";

    // Validate storyType
    const validatedStoryType = VALID_STORY_TYPES.includes(storyType) ? storyType : "kids";

    // Validate tone
    const validatedTone = VALID_TONES.includes(tone) ? tone : "calm";

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

    const systemPrompt = `You are a professional story scene analyzer for children's video content. Your task is to analyze a story script and break it into logical visual scenes.

Guidelines:
- Create 6-12 scenes maximum
- Each scene should represent a distinct visual moment
- Don't split sentence by sentence - group related content
- Include clear visual descriptions for image generation
- Estimate duration based on narration length (avg 2-3 words per second)

Language: ${validatedLanguage}
Story Type: ${validatedStoryType}
Tone: ${validatedTone}

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

    console.log("Calling Gemini API for scene generation...");

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\nAnalyze this story script and create scenes:\n\n${sanitizedScript}` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          maxOutputTokens: 4096,
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
      console.error("Gemini API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: "AI request failed", 
          message: `Gemini API returned status ${response.status}` 
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      console.error("No content in Gemini response:", JSON.stringify(data));
      throw new Error("No content in AI response");
    }

    // Parse JSON response (handle potential markdown code blocks)
    let parsed;
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Invalid JSON response from AI");
    }

    console.log(`Generated ${parsed.scenes?.length || 0} scenes successfully for user ${user.id}`);

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
