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

// Cost pricing configuration (USD)
const AI_PRICING = {
  "gemini-2.5-flash": {
    input_per_1k: 0.00035,
    output_per_1k: 0.00105,
  },
};

const USD_TO_INR = 83;

function sanitizeText(text: string): string {
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}

// Estimate tokens (rough: 1 token ≈ 4 chars for English, 2-3 for Hindi)
function estimateTokens(text: string, isOutput = false): number {
  const avgCharsPerToken = 4;
  return Math.ceil(text.length / avgCharsPerToken);
}

async function logUsage(
  supabase: any,
  userId: string,
  projectId: string | null,
  feature: string,
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  status: "success" | "failed",
  errorMessage?: string
) {
  try {
    const totalTokens = inputTokens + outputTokens;
    const pricing = AI_PRICING["gemini-2.5-flash"];
    const costUsd = (inputTokens / 1000) * pricing.input_per_1k + (outputTokens / 1000) * pricing.output_per_1k;
    const costInr = costUsd * USD_TO_INR;

    await supabase.from('api_usage_logs').insert({
      user_id: userId,
      project_id: projectId,
      provider,
      model,
      feature,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      api_calls: 1,
      cost_usd: costUsd,
      cost_inr: costInr,
      status,
      error_message: errorMessage,
    });

    console.log(`Usage logged: ${feature}, tokens: ${totalTokens}, cost: $${costUsd.toFixed(6)}`);
  } catch (err) {
    console.error("Failed to log usage:", err);
    // Don't block main operation if logging fails
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Service role client for logging
  const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let userId: string | null = null;
  let projectId: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    userId = user.id;
    console.log(`Authenticated user: ${user.id}`);

    const body = await req.json();
    const { script, language, storyType, tone, projectId: reqProjectId } = body;
    projectId = reqProjectId || null;

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

    const userMessage = `Analyze this story script and create scenes:\n\n${sanitizedScript}`;
    
    // Estimate input tokens
    inputTokens = estimateTokens(systemPrompt + userMessage);

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
          { role: "user", content: userMessage }
        ],
      }),
    });

    if (response.status === 429) {
      await logUsage(serviceSupabase, userId, projectId, "generate-scenes", "google", "gemini-2.5-flash", inputTokens, 0, "failed", "Rate limit exceeded");
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (response.status === 402) {
      await logUsage(serviceSupabase, userId, projectId, "generate-scenes", "google", "gemini-2.5-flash", inputTokens, 0, "failed", "Credits exhausted");
      return new Response(
        JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      await logUsage(serviceSupabase, userId, projectId, "generate-scenes", "google", "gemini-2.5-flash", inputTokens, 0, "failed", `API error: ${response.status}`);
      return new Response(
        JSON.stringify({ error: `AI service error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    // Extract token usage from response if available
    const usage = data.usage;
    if (usage) {
      inputTokens = usage.prompt_tokens || inputTokens;
      outputTokens = usage.completion_tokens || estimateTokens(content || "", true);
    } else {
      outputTokens = estimateTokens(content || "", true);
    }

    if (!content) {
      console.error("No content in response:", JSON.stringify(data));
      await logUsage(serviceSupabase, userId, projectId, "generate-scenes", "google", "gemini-2.5-flash", inputTokens, outputTokens, "failed", "No content in response");
      throw new Error("No content in AI response");
    }

    let parsed;
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      await logUsage(serviceSupabase, userId, projectId, "generate-scenes", "google", "gemini-2.5-flash", inputTokens, outputTokens, "failed", "Invalid JSON response");
      throw new Error("Invalid JSON response from AI");
    }

    // Log successful usage
    await logUsage(serviceSupabase, userId, projectId, "generate-scenes", "google", "gemini-2.5-flash", inputTokens, outputTokens, "success");

    console.log(`Generated ${parsed.scenes?.length || 0} scenes for user ${user.id}`);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Generate scenes error:", error);
    
    // Log failed usage
    if (userId) {
      await logUsage(serviceSupabase, userId, projectId, "generate-scenes", "google", "gemini-2.5-flash", inputTokens, outputTokens, "failed", error instanceof Error ? error.message : "Unknown error");
    }
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
