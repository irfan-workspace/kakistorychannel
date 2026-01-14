import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyPaymentBody {
  paymentRequestId: string;
  upiTransactionId: string;
  payerVpa?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: VerifyPaymentBody = await req.json();
    const { paymentRequestId, upiTransactionId, payerVpa } = body;

    if (!paymentRequestId || !upiTransactionId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicate transaction ID (replay attack prevention)
    const { data: existingTransaction } = await supabase
      .from("payment_transactions")
      .select("id")
      .eq("upi_transaction_id", upiTransactionId)
      .single();

    if (existingTransaction) {
      return new Response(
        JSON.stringify({ error: "Transaction ID already used - possible replay attack" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the payment request
    const { data: paymentRequest, error: fetchError } = await supabase
      .from("payment_requests")
      .select("*")
      .eq("id", paymentRequestId)
      .single();

    if (fetchError || !paymentRequest) {
      return new Response(
        JSON.stringify({ error: "Payment request not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (paymentRequest.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: `Payment request already ${paymentRequest.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if expired
    if (new Date(paymentRequest.expires_at) < new Date()) {
      await supabase
        .from("payment_requests")
        .update({ status: 'expired' })
        .eq("id", paymentRequestId);

      return new Response(
        JSON.stringify({ error: "Payment request has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate transaction hash for integrity
    const timestamp = new Date().toISOString();
    const { data: hashResult } = await supabase.rpc('generate_transaction_hash', {
      p_request_id: paymentRequestId,
      p_user_id: paymentRequest.user_id,
      p_amount: paymentRequest.amount,
      p_upi_id: upiTransactionId,
      p_timestamp: timestamp,
    });

    const transactionHash = hashResult || crypto.randomUUID();

    // Create the transaction record
    const { data: transaction, error: transactionError } = await supabase
      .from("payment_transactions")
      .insert({
        payment_request_id: paymentRequestId,
        user_id: paymentRequest.user_id,
        amount: paymentRequest.amount,
        credits_added: paymentRequest.credits,
        upi_transaction_id: upiTransactionId,
        payer_vpa: payerVpa,
        payment_method: paymentRequest.payment_method,
        transaction_hash: transactionHash,
      })
      .select()
      .single();

    if (transactionError) {
      console.error("Error creating transaction:", transactionError);
      return new Response(
        JSON.stringify({ error: "Failed to create transaction" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update payment request status
    const { error: updateError } = await supabase
      .from("payment_requests")
      .update({
        status: 'completed',
        upi_transaction_id: upiTransactionId,
        payer_vpa: payerVpa,
        verified_at: timestamp,
        verified_by: user.id,
      })
      .eq("id", paymentRequestId);

    if (updateError) {
      console.error("Error updating payment request:", updateError);
    }

    // Create audit log
    await supabase.from("payment_audit_logs").insert({
      payment_request_id: paymentRequestId,
      action: "payment_verified",
      actor_id: user.id,
      actor_role: "admin",
      old_values: { status: paymentRequest.status },
      new_values: { 
        status: 'completed',
        upi_transaction_id: upiTransactionId,
        credits_added: paymentRequest.credits,
      },
      metadata: {
        transaction_id: transaction.id,
        transaction_hash: transactionHash,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully verified payment and added ${paymentRequest.credits} credits`,
        transaction: {
          id: transaction.id,
          creditsAdded: transaction.credits_added,
          amount: transaction.amount,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in verify-payment:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});