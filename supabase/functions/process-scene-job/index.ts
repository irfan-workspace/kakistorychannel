import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 2000; // 2 seconds
const CHUNK_SIZE = 4000; // characters per chunk
const DELAY_BETWEEN_CHUNKS = 1500; // 1.5 seconds between API calls

// Helper to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Exponential backoff delay calculator
function getBackoffDelay(attempt: number): number {
  return INITIAL_RETRY_DELAY * Math.pow(2, attempt) + Math.random() * 1000;
}

// Split script into chunks while preserving sentence boundaries
function chunkScript(script: string, maxSize: number): string[] {
  const chunks: string[] = [];
  const sentences = script.split(/(?<=[.!?])\s+/);
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // If only one chunk and it's small enough, return as is
  if (chunks.length === 0 && script.length <= maxSize) {
    return [script];
  }

  return chunks.length > 0 ? chunks : [script];
}

// Call Gemini API with retry logic - NEVER parallel calls
async function callGeminiWithRetry(
  prompt: string,
  apiKey: string,
  attempt: number = 0
): Promise<any> {
  try {
    console.log(`Gemini API call attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
    
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (response.status === 429) {
      // Rate limited - retry with backoff
      if (attempt < MAX_RETRIES) {
        const backoffDelay = getBackoffDelay(attempt);
        console.log(`Rate limited (429). Retrying in ${backoffDelay}ms...`);
        await delay(backoffDelay);
        return callGeminiWithRetry(prompt, apiKey, attempt + 1);
      }
      throw new Error('AI service rate limit exceeded. Please try again later.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API error (${response.status}):`, errorText);
      
      if (attempt < MAX_RETRIES && response.status >= 500) {
        const backoffDelay = getBackoffDelay(attempt);
        console.log(`Server error. Retrying in ${backoffDelay}ms...`);
        await delay(backoffDelay);
        return callGeminiWithRetry(prompt, apiKey, attempt + 1);
      }
      
      throw new Error(`AI service error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (attempt < MAX_RETRIES && error instanceof TypeError) {
      // Network error - retry
      const backoffDelay = getBackoffDelay(attempt);
      console.log(`Network error. Retrying in ${backoffDelay}ms...`);
      await delay(backoffDelay);
      return callGeminiWithRetry(prompt, apiKey, attempt + 1);
    }
    throw error;
  }
}

// Parse Gemini response to extract scenes
function parseGeminiResponse(responseText: string): any[] {
  try {
    // Try to extract JSON from the response
    let jsonStr = responseText;
    
    // Remove markdown code blocks if present
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Try parsing as array first
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (parsed.scenes && Array.isArray(parsed.scenes)) {
        return parsed.scenes;
      }
    } catch {
      // Try to find JSON array in the text
      const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        return JSON.parse(arrayMatch[0]);
      }
    }

    throw new Error('Could not parse scenes from response');
  } catch (error) {
    console.error('Parse error:', error);
    throw new Error('Failed to parse AI response');
  }
}

// Generate scenes for a chunk of script
async function generateScenesForChunk(
  chunk: string,
  chunkIndex: number,
  totalChunks: number,
  language: string,
  storyType: string,
  tone: string,
  apiKey: string
): Promise<any[]> {
  const systemPrompt = `You are an AI that converts story scripts into visual scenes for video creation.

CONTEXT: This is ${totalChunks > 1 ? `part ${chunkIndex + 1} of ${totalChunks} of a larger story` : 'a complete story'}.
Language: ${language}
Story Type: ${storyType}
Tone: ${tone}

OUTPUT FORMAT: Return a JSON array of scenes. Each scene must have:
{
  "title": "Brief scene title (3-5 words)",
  "narration_text": "The exact narration text for this scene",
  "visual_description": "Detailed visual description for image generation (describe setting, characters, actions, lighting, mood)",
  "mood": "One of: happy, sad, mysterious, exciting, calm, tense, magical, romantic",
  "estimated_duration": number (seconds, typically 5-15 based on narration length)
}

RULES:
1. Each scene should be 1-3 sentences of narration
2. Visual descriptions should be vivid and specific enough for AI image generation
3. Maintain consistent character descriptions across scenes
4. Duration should be realistic for the narration (roughly 2-3 words per second)
5. Return ONLY the JSON array, no other text

SCRIPT TO CONVERT:
${chunk}`;

  const result = await callGeminiWithRetry(systemPrompt, apiKey);
  
  const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) {
    throw new Error('Empty response from AI');
  }

  return parseGeminiResponse(responseText);
}

// Update job progress in database
async function updateJobProgress(
  supabaseAdmin: any,
  jobId: string,
  progress: number,
  scenesGenerated: number
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('generation_jobs')
    .update({
      progress,
      scenes_generated: scenesGenerated,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    console.error('Failed to update progress:', error.message);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // Extract jobId from request for cleanup in finally block
  let jobId: string | null = null;
  let finalStatus: 'completed' | 'failed' = 'failed';
  let errorMessage: string | null = null;
  let scenesCount = 0;

  try {
    // Parse job data
    const body = await req.json();
    jobId = body.jobId;
    const { projectId, script, language, storyType, tone, scriptHash } = body;

    console.log(`Processing job ${jobId} for project ${projectId}`);

    if (!geminiApiKey) {
      throw new Error('AI service not configured');
    }

    if (!jobId) {
      throw new Error('Missing job ID');
    }

    // Update job status to processing
    const { error: updateError } = await supabaseAdmin
      .from('generation_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        progress: 5,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('Failed to update job status:', updateError.message);
      throw new Error('Failed to start job');
    }

    // Split script into chunks
    const chunks = chunkScript(script, CHUNK_SIZE);
    console.log(`Script split into ${chunks.length} chunks`);

    // Process chunks SEQUENTIALLY (never parallel to avoid rate limits)
    const allScenes: any[] = [];
    let sceneOrder = 1;

    for (let i = 0; i < chunks.length; i++) {
      console.log(`Processing chunk ${i + 1}/${chunks.length}`);
      
      // Calculate progress (5-90% during processing)
      const chunkProgress = 5 + Math.floor((i / chunks.length) * 85);
      await updateJobProgress(supabaseAdmin, jobId, chunkProgress, allScenes.length);

      const chunkScenes = await generateScenesForChunk(
        chunks[i],
        i,
        chunks.length,
        language,
        storyType,
        tone,
        geminiApiKey
      );

      // Add scenes to database INCREMENTALLY
      for (const scene of chunkScenes) {
        const sceneData = {
          project_id: projectId,
          scene_order: sceneOrder++,
          title: scene.title || `Scene ${sceneOrder}`,
          narration_text: scene.narration_text || '',
          visual_description: scene.visual_description || '',
          mood: scene.mood || 'calm',
          estimated_duration: scene.estimated_duration || 5,
        };

        const { error: insertError } = await supabaseAdmin
          .from('scenes')
          .insert(sceneData);

        if (insertError) {
          console.error(`Failed to insert scene ${sceneOrder}:`, insertError.message);
        } else {
          allScenes.push(sceneData);
          // Update progress after each scene
          await updateJobProgress(supabaseAdmin, jobId, chunkProgress, allScenes.length);
        }
      }

      // Delay between chunks to respect rate limits
      if (i < chunks.length - 1) {
        console.log(`Waiting ${DELAY_BETWEEN_CHUNKS}ms before next chunk...`);
        await delay(DELAY_BETWEEN_CHUNKS);
      }
    }

    scenesCount = allScenes.length;

    // Cache the result
    const { error: cacheError } = await supabaseAdmin
      .from('script_cache')
      .upsert({
        script_hash: scriptHash,
        language,
        story_type: storyType,
        tone,
        cached_scenes: allScenes,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      }, {
        onConflict: 'script_hash',
      });

    if (cacheError) {
      console.error('Failed to cache result:', cacheError.message);
    }

    finalStatus = 'completed';
    console.log(`Job ${jobId} processing completed with ${allScenes.length} scenes`);

    return new Response(
      JSON.stringify({ success: true, scenesCount: allScenes.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Worker error:', error);
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    finalStatus = 'failed';

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } finally {
    // GUARANTEED CLEANUP: Always update job status and release lock
    if (jobId) {
      console.log(`Cleanup: Setting job ${jobId} to ${finalStatus}`);
      
      const cleanupData: any = {
        status: finalStatus,
        updated_at: new Date().toISOString(),
      };

      if (finalStatus === 'completed') {
        cleanupData.progress = 100;
        cleanupData.scenes_generated = scenesCount;
        cleanupData.completed_at = new Date().toISOString();
      } else {
        cleanupData.error_message = errorMessage || 'Unknown error';
        cleanupData.completed_at = new Date().toISOString();
      }

      const { error: cleanupError } = await supabaseAdmin
        .from('generation_jobs')
        .update(cleanupData)
        .eq('id', jobId);

      if (cleanupError) {
        console.error('Cleanup failed:', cleanupError.message);
      } else {
        console.log(`Cleanup successful for job ${jobId}`);
      }
    }
  }
});
