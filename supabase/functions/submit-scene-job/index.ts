import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation constants
const MAX_SCRIPT_LENGTH = 50000;
const MIN_SCRIPT_LENGTH = 50;
const VALID_LANGUAGES = ['hindi', 'hinglish', 'english'];
const VALID_STORY_TYPES = ['kids', 'bedtime', 'moral'];
const VALID_TONES = ['calm', 'emotional', 'dramatic'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Generate script hash for caching
async function generateScriptHash(script: string, language: string, storyType: string, tone: string): Promise<string> {
  const content = `${script.trim().toLowerCase()}|${language}|${storyType}|${tone}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create client with user's token
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user session
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      console.error('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${user.id} authenticated successfully`);

    // 2. Parse and validate input
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { projectId, script, language, storyType, tone } = body;

    // Validate projectId
    if (!projectId || typeof projectId !== 'string' || !UUID_REGEX.test(projectId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing projectId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate script
    if (!script || typeof script !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid script' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sanitizedScript = script.trim();
    if (sanitizedScript.length < MIN_SCRIPT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Script must be at least ${MIN_SCRIPT_LENGTH} characters` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (sanitizedScript.length > MAX_SCRIPT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Script must not exceed ${MAX_SCRIPT_LENGTH} characters` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate enums with defaults
    const validatedLanguage = VALID_LANGUAGES.includes(language) ? language : 'hindi';
    const validatedStoryType = VALID_STORY_TYPES.includes(storyType) ? storyType : 'kids';
    const validatedTone = VALID_TONES.includes(tone) ? tone : 'calm';

    // Service role client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Verify project ownership
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id, user_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error('Project not found:', projectError?.message);
      return new Response(
        JSON.stringify({ error: 'Project not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (project.user_id !== user.id) {
      console.error('Unauthorized access to project');
      return new Response(
        JSON.stringify({ error: 'Not authorized to access this project' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Check rate limit (5 requests per minute)
    const { data: rateLimitOk, error: rateLimitError } = await supabaseAdmin
      .rpc('check_rate_limit', { p_user_id: user.id, p_max_requests: 5, p_window_minutes: 1 });

    if (rateLimitError) {
      console.error('Rate limit check failed:', rateLimitError.message);
      return new Response(
        JSON.stringify({ error: 'Rate limit check failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rateLimitOk) {
      console.log(`User ${user.id} rate limited`);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please wait a minute before trying again.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Check for active job (one job per user)
    const { data: hasActiveJob, error: activeJobError } = await supabaseAdmin
      .rpc('has_active_job', { p_user_id: user.id });

    if (activeJobError) {
      console.error('Active job check failed:', activeJobError.message);
      return new Response(
        JSON.stringify({ error: 'Active job check failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (hasActiveJob) {
      console.log(`User ${user.id} already has an active job`);
      return new Response(
        JSON.stringify({ error: 'You already have a job in progress. Please wait for it to complete.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Generate script hash and check cache
    const scriptHash = await generateScriptHash(sanitizedScript, validatedLanguage, validatedStoryType, validatedTone);
    console.log(`Script hash: ${scriptHash}`);

    const { data: cachedResult, error: cacheError } = await supabaseAdmin
      .from('script_cache')
      .select('id, cached_scenes, hit_count')
      .eq('script_hash', scriptHash)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!cacheError && cachedResult) {
      console.log(`Cache hit for script hash ${scriptHash}`);
      
      // Update hit count
      const currentHitCount = (cachedResult as any).hit_count || 0;
      await supabaseAdmin
        .from('script_cache')
        .update({ hit_count: currentHitCount + 1 })
        .eq('id', cachedResult.id);

      // Create a completed job immediately
      const { data: job, error: jobError } = await supabaseAdmin
        .from('generation_jobs')
        .insert({
          user_id: user.id,
          project_id: projectId,
          script_content: sanitizedScript,
          script_hash: scriptHash,
          status: 'completed',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (jobError) {
        console.error('Failed to create job record:', jobError.message);
        return new Response(
          JSON.stringify({ error: 'Failed to create job' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          jobId: job.id,
          status: 'completed',
          cached: true,
          scenes: cachedResult.cached_scenes,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Create new job in queue
    const { data: newJob, error: createJobError } = await supabaseAdmin
      .from('generation_jobs')
      .insert({
        user_id: user.id,
        project_id: projectId,
        script_content: sanitizedScript,
        script_hash: scriptHash,
        status: 'queued',
      })
      .select('id')
      .single();

    if (createJobError) {
      console.error('Failed to create job:', createJobError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to create job' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Job ${newJob.id} created for user ${user.id}`);

    // 8. Trigger the worker function asynchronously (fire and forget)
    const workerUrl = `${supabaseUrl}/functions/v1/process-scene-job`;
    fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jobId: newJob.id,
        projectId,
        script: sanitizedScript,
        language: validatedLanguage,
        storyType: validatedStoryType,
        tone: validatedTone,
        scriptHash,
      }),
    }).catch(err => console.error('Worker trigger failed:', err));

    // 9. Return jobId immediately
    return new Response(
      JSON.stringify({
        jobId: newJob.id,
        status: 'queued',
        cached: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Submit job error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
