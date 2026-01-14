import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentRequestBody {
  amount: number;
  credits: number;
  paymentMethod: 'phonepe' | 'googlepay' | 'upi';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const merchantUpiId = Deno.env.get("MERCHANT_UPI_ID") || "merchant@upi";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify the user's JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: PaymentRequestBody = await req.json();
    const { amount, credits, paymentMethod } = body;

    // Validate input
    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!credits || credits <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid credits" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate UPI payment URL for QR code
    const transactionNote = `Credits Purchase - ${credits} credits`;
    const transactionId = crypto.randomUUID().replace(/-/g, '').substring(0, 20);
    
    // UPI deep link format that works with PhonePe and GPay
    const upiUrl = `upi://pay?pa=${encodeURIComponent(merchantUpiId)}&pn=${encodeURIComponent('Kaki Story Channel')}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(transactionNote)}&tr=${transactionId}`;

    // Create payment request in database
    const { data: paymentRequest, error: insertError } = await supabase
      .from("payment_requests")
      .insert({
        user_id: user.id,
        amount,
        credits,
        payment_method: paymentMethod,
        qr_code_data: upiUrl,
        status: 'pending',
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes expiry
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating payment request:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create payment request" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create audit log
    await supabase.from("payment_audit_logs").insert({
      payment_request_id: paymentRequest.id,
      action: "payment_request_created",
      actor_id: user.id,
      actor_role: "user",
      metadata: {
        amount,
        credits,
        payment_method: paymentMethod,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        paymentRequest: {
          id: paymentRequest.id,
          amount: paymentRequest.amount,
          credits: paymentRequest.credits,
          qrCodeData: paymentRequest.qr_code_data,
          expiresAt: paymentRequest.expires_at,
          status: paymentRequest.status,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in create-payment-request:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});