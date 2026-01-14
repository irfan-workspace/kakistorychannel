import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface PaymentRequest {
  id: string;
  amount: number;
  credits: number;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  qr_code_data: string;
  expires_at: string;
  payment_method: string;
  upi_transaction_id: string | null;
  payer_vpa: string | null;
  created_at: string;
  verified_at: string | null;
}

interface CreatePaymentParams {
  amount: number;
  credits: number;
  paymentMethod: 'phonepe' | 'googlepay' | 'upi';
}

interface VerifyPaymentParams {
  paymentRequestId: string;
  upiTransactionId: string;
  payerVpa?: string;
}

export function usePayments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: paymentRequests, isLoading: isLoadingPayments, refetch: refetchPayments } = useQuery({
    queryKey: ['payment-requests', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PaymentRequest[];
    },
    enabled: !!user,
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (params: CreatePaymentParams) => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('create-payment-request', {
        body: params,
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create payment request');
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-requests'] });
      toast.success('Payment request created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create payment request');
    },
  });

  return {
    paymentRequests,
    isLoadingPayments,
    refetchPayments,
    createPayment: createPaymentMutation.mutate,
    isCreatingPayment: createPaymentMutation.isPending,
  };
}

export function useAdminPayments() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const isAdmin = (profile as any)?.role === 'admin';

  const { data: allPaymentRequests, isLoading: isLoadingAll, refetch: refetchAll } = useQuery({
    queryKey: ['admin-payment-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const { data: auditLogs, isLoading: isLoadingAuditLogs } = useQuery({
    queryKey: ['payment-audit-logs'],
    queryFn: async () => {
      if (!isAdmin) return [];
      
      const { data, error } = await supabase
        .from('payment_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: async (params: VerifyPaymentParams) => {
      const response = await supabase.functions.invoke('verify-payment', {
        body: params,
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to verify payment');
      }

      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment-requests'] });
      queryClient.invalidateQueries({ queryKey: ['payment-requests'] });
      queryClient.invalidateQueries({ queryKey: ['payment-audit-logs'] });
      toast.success(data.message || 'Payment verified successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to verify payment');
    },
  });

  const rejectPaymentMutation = useMutation({
    mutationFn: async (paymentRequestId: string) => {
      const { error } = await supabase
        .from('payment_requests')
        .update({ status: 'failed' })
        .eq('id', paymentRequestId);

      if (error) throw error;

      // Create audit log
      await supabase.from('payment_audit_logs').insert({
        payment_request_id: paymentRequestId,
        action: 'payment_rejected',
        actor_id: user?.id,
        actor_role: 'admin',
        new_values: { status: 'failed' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment-requests'] });
      queryClient.invalidateQueries({ queryKey: ['payment-audit-logs'] });
      toast.success('Payment rejected');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reject payment');
    },
  });

  return {
    allPaymentRequests,
    auditLogs,
    isLoadingAll,
    isLoadingAuditLogs,
    refetchAll,
    verifyPayment: verifyPaymentMutation.mutate,
    isVerifying: verifyPaymentMutation.isPending,
    rejectPayment: rejectPaymentMutation.mutate,
    isRejecting: rejectPaymentMutation.isPending,
    isAdmin,
  };
}