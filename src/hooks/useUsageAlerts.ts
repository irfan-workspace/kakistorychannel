import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

// Credit thresholds for alerts (percentage of credits used)
const ALERT_THRESHOLDS = [
  { percentage: 50, message: 'You have used 50% of your credits', variant: 'default' as const },
  { percentage: 75, message: 'Warning: 75% of credits used', variant: 'default' as const },
  { percentage: 90, message: 'Critical: 90% of credits used!', variant: 'destructive' as const },
  { percentage: 100, message: 'All credits exhausted!', variant: 'destructive' as const },
];

// Default credit limits per tier (credits-based system)
const CREDIT_LIMITS: Record<string, number> = {
  free: 5,
  credits: 1000, // Base limit for credits tier
};

interface UsageStats {
  totalCost: number;
  apiCalls: number;
}

export function useUsageAlerts() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const lastAlertThreshold = useRef<number>(0);
  const isSubscribed = useRef(false);

  // Calculate usage percentage
  const calculateUsagePercentage = useCallback((stats: UsageStats): number => {
    if (!profile) return 0;
    
    const creditLimit = CREDIT_LIMITS[profile.subscription_tier] || CREDIT_LIMITS.free;
    const currentCredits = profile.credits_balance;
    
    // If credits are being tracked directly
    if (currentCredits !== undefined && currentCredits !== null) {
      const usedCredits = creditLimit - currentCredits;
      return Math.min(100, Math.max(0, (usedCredits / creditLimit) * 100));
    }
    
    // Fallback to cost-based calculation
    return Math.min(100, (stats.totalCost / (creditLimit * 0.1)) * 100);
  }, [profile]);

  // Check and show alerts
  const checkAndShowAlert = useCallback((usagePercentage: number) => {
    // Find the highest threshold that's been crossed
    const crossedThresholds = ALERT_THRESHOLDS.filter(
      t => usagePercentage >= t.percentage && t.percentage > lastAlertThreshold.current
    );

    if (crossedThresholds.length > 0) {
      const highestThreshold = crossedThresholds[crossedThresholds.length - 1];
      
      toast({
        title: usagePercentage >= 100 ? '⚠️ Credits Exhausted' : '📊 Usage Alert',
        description: highestThreshold.message,
        variant: highestThreshold.variant,
      });

      lastAlertThreshold.current = highestThreshold.percentage;
    }
  }, [toast]);

  // Fetch current usage stats
  const fetchUsageStats = useCallback(async (): Promise<UsageStats | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('api_usage_logs')
        .select('cost_usd, api_calls')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      const stats = (data || []).reduce(
        (acc, log) => ({
          totalCost: acc.totalCost + (log.cost_usd || 0),
          apiCalls: acc.apiCalls + (log.api_calls || 1),
        }),
        { totalCost: 0, apiCalls: 0 }
      );

      return stats;
    } catch (error) {
      console.error('Error fetching usage stats:', error);
      return null;
    }
  }, [user]);

  // Handle new usage log
  const handleNewUsageLog = useCallback(async () => {
    const stats = await fetchUsageStats();
    if (stats) {
      const usagePercentage = calculateUsagePercentage(stats);
      checkAndShowAlert(usagePercentage);
      
      // Refresh profile to get updated credits
      await refreshProfile();
    }
  }, [fetchUsageStats, calculateUsagePercentage, checkAndShowAlert, refreshProfile]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user || isSubscribed.current) return;

    const channel = supabase
      .channel(`usage-alerts-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'api_usage_logs',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('New usage log detected:', payload);
          handleNewUsageLog();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          isSubscribed.current = true;
          console.log('Subscribed to usage alerts');
        }
      });

    // Initial check on mount
    handleNewUsageLog();

    return () => {
      isSubscribed.current = false;
      supabase.removeChannel(channel);
    };
  }, [user, handleNewUsageLog]);

  // Reset threshold when profile changes (e.g., after credit purchase)
  useEffect(() => {
    if (profile?.credits_balance !== undefined) {
      const creditLimit = CREDIT_LIMITS[profile.subscription_tier] || CREDIT_LIMITS.free;
      const usedPercentage = ((creditLimit - profile.credits_balance) / creditLimit) * 100;
      
      // Only reset if credits were added (usage percentage went down)
      if (usedPercentage < lastAlertThreshold.current) {
        lastAlertThreshold.current = Math.floor(usedPercentage / 25) * 25; // Round down to nearest 25%
      }
    }
  }, [profile?.credits_balance, profile?.subscription_tier]);

  return {
    checkUsage: handleNewUsageLog,
  };
}
