import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const { jobId } = body;

    if (!jobId || typeof jobId !== 'string' || !UUID_REGEX.test(jobId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing jobId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Get job status (user can only see their own jobs due to RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: job, error: jobError } = await supabaseAdmin
      .from('generation_jobs')
      .select('id, status, error_message, project_id, created_at, started_at, completed_at, retry_count')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. If completed, fetch the generated scenes
    let scenes = null;
    if (job.status === 'completed') {
      const { data: sceneData } = await supabaseAdmin
        .from('scenes')
        .select('id, scene_order, title, narration_text, visual_description, mood, estimated_duration')
        .eq('project_id', job.project_id)
        .order('scene_order', { ascending: true });

      scenes = sceneData;
    }

    // 5. Calculate progress estimate
    let progress = 0;
    let estimatedTimeRemaining = null;

    switch (job.status) {
      case 'queued':
        progress = 10;
        estimatedTimeRemaining = 30; // seconds
        break;
      case 'processing':
        // Estimate based on elapsed time (assume 30s average)
        if (job.started_at) {
          const elapsed = (Date.now() - new Date(job.started_at).getTime()) / 1000;
          progress = Math.min(90, 20 + Math.floor(elapsed * 2));
          estimatedTimeRemaining = Math.max(5, 30 - elapsed);
        } else {
          progress = 20;
          estimatedTimeRemaining = 25;
        }
        break;
      case 'completed':
        progress = 100;
        estimatedTimeRemaining = 0;
        break;
      case 'failed':
        progress = 0;
        estimatedTimeRemaining = null;
        break;
    }

    return new Response(
      JSON.stringify({
        jobId: job.id,
        status: job.status,
        progress,
        estimatedTimeRemaining,
        errorMessage: job.error_message,
        retryCount: job.retry_count,
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
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
