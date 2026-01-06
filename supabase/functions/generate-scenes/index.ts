import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const VALID_LANGUAGES = ["hindi", "hinglish", "english"];
const VALID_STORY_TYPES = ["kids", "bedtime", "moral"];
const VALID_TONES = ["calm", "emotional", "dramatic"];

const MAX_SCRIPT_LENGTH = 10000;
const MIN_SCRIPT_LENGTH = 10;

function sanitizeText(text: string): string {
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Authenticated user: ${user.id}`);

    const body = await req.json();
    const { script, language, storyType, tone } = body;

    if (!script || typeof script !== 'string') {
      return new Response(
        JSON.stringify({ error: "Script is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sanitizedScript = sanitizeText(script);
    if (sanitizedScript.length < MIN_SCRIPT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Script must be at least ${MIN_SCRIPT_LENGTH} characters` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (sanitizedScript.length > MAX_SCRIPT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Script must be less than ${MAX_SCRIPT_LENGTH} characters` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validatedLanguage = VALID_LANGUAGES.includes(language) ? language : "english";
    const validatedStoryType = VALID_STORY_TYPES.includes(storyType) ? storyType : "kids";
    const validatedTone = VALID_TONES.includes(tone) ? tone : "calm";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Lovable API key not configured" }),
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

    console.log("Calling Lovable AI for scene generation...");

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
          { role: "user", content: `Analyze this story script and create scenes:\n\n${sanitizedScript}` }
        ],
      }),
    });

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (response.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `AI service error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("No content in response:", JSON.stringify(data));
      throw new Error("No content in AI response");
    }

    let parsed;
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Invalid JSON response from AI");
    }

    console.log(`Generated ${parsed.scenes?.length || 0} scenes for user ${user.id}`);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Generate scenes error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
