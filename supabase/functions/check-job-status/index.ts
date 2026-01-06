import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No auth header provided');
      return new Response(
        JSON.stringify({ error: 'Authentication required', code: 'AUTH_REQUIRED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Create client with user's token
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user session
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      console.log('Auth failed:', authError?.message || 'No user');
      return new Response(
        JSON.stringify({ error: 'Session expired', code: 'SESSION_EXPIRED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse and validate input
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid request format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { jobId } = body;

    if (!jobId || typeof jobId !== 'string' || !UUID_REGEX.test(jobId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid job ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Get job status (user can only see their own jobs)
    // Use the authenticated client (avoids relying on service-role env vars)
    const { data: job, error: jobError } = await supabaseUser
      .from('generation_jobs')
      .select('id, status, error_message, project_id, created_at, started_at, completed_at, retry_count, progress, scenes_generated, updated_at')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Normalize status to valid state machine states
    let normalizedStatus: 'idle' | 'queued' | 'processing' | 'completed' | 'failed' = 'idle';
    switch (job.status) {
      case 'queued':
        normalizedStatus = 'queued';
        break;
      case 'processing':
        normalizedStatus = 'processing';
        break;
      case 'completed':
        normalizedStatus = 'completed';
        break;
      case 'failed':
        normalizedStatus = 'failed';
        break;
      default:
        normalizedStatus = 'idle';
    }

    // 5. If completed, fetch the generated scenes
    let scenes = null;
    if (normalizedStatus === 'completed') {
      const { data: sceneData } = await supabaseUser
        .from('scenes')
        .select('id, scene_order, title, narration_text, visual_description, mood, estimated_duration')
        .eq('project_id', job.project_id)
        .order('scene_order', { ascending: true });

      scenes = sceneData;
    }

    // 6. Generate user-friendly error message
    let failureReason: string | null = null;
    if (normalizedStatus === 'failed' && job.error_message) {
      // Map technical errors to user-friendly messages
      const errorMsg = job.error_message.toLowerCase();
      if (errorMsg.includes('timeout')) {
        failureReason = 'The generation took too long. Please try again.';
      } else if (errorMsg.includes('rate limit')) {
        failureReason = 'AI service is busy. Please try again in a moment.';
      } else if (errorMsg.includes('gemini')) {
        failureReason = 'AI service error. Please try again.';
      } else {
        failureReason = 'Generation failed. Please try again.';
      }
    }

    return new Response(
      JSON.stringify({
        jobId: job.id,
        status: normalizedStatus,
        progress: job.progress || 0,
        scenesGenerated: job.scenes_generated || 0,
        failureReason,
        scenes: scenes,
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Check job status error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to check job status' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
