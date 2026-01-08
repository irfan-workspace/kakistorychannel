import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UsageStats {
  totalApiCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  totalCostInr: number;
  successfulCalls: number;
  failedCalls: number;
}

export interface DailyUsage {
  date: string;
  feature: string;
  provider: string;
  model: string;
  api_calls: number;
  tokens_used: number;
  cost_usd: number;
  cost_inr: number;
}

export interface FeatureBreakdown {
  feature: string;
  total_calls: number;
  total_tokens: number;
  total_cost_usd: number;
  total_cost_inr: number;
  avg_cost_per_call_usd: number;
  avg_cost_per_call_inr: number;
}

export interface UsageLog {
  id: string;
  user_id: string;
  project_id: string | null;
  scene_id: string | null;
  provider: string;
  model: string;
  feature: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  api_calls: number;
  cost_usd: number;
  cost_inr: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

export function useUsageStats(days: number = 30) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['usage-stats', user?.id, days],
    queryFn: async (): Promise<UsageStats> => {
      if (!user) throw new Error("Not authenticated");

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('api_usage_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      const stats = (data || []).reduce(
        (acc, log) => ({
          totalApiCalls: acc.totalApiCalls + (log.api_calls || 1),
          totalTokens: acc.totalTokens + (log.total_tokens || 0),
          totalCostUsd: acc.totalCostUsd + (log.cost_usd || 0),
          totalCostInr: acc.totalCostInr + (log.cost_inr || 0),
          successfulCalls: acc.successfulCalls + (log.status === 'success' ? 1 : 0),
          failedCalls: acc.failedCalls + (log.status === 'failed' ? 1 : 0),
        }),
        {
          totalApiCalls: 0,
          totalTokens: 0,
          totalCostUsd: 0,
          totalCostInr: 0,
          successfulCalls: 0,
          failedCalls: 0,
        }
      );

      return stats;
    },
    enabled: !!user,
  });
}

export function useDailyUsage(days: number = 30) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['daily-usage', user?.id, days],
    queryFn: async (): Promise<DailyUsage[]> => {
      if (!user) throw new Error("Not authenticated");

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('api_usage_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'success')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by date, feature, provider, model
      const grouped = (data || []).reduce((acc: Record<string, DailyUsage>, log) => {
        const date = new Date(log.created_at).toISOString().split('T')[0];
        const key = `${date}-${log.feature}-${log.provider}-${log.model}`;
        
        if (!acc[key]) {
          acc[key] = {
            date,
            feature: log.feature,
            provider: log.provider,
            model: log.model,
            api_calls: 0,
            tokens_used: 0,
            cost_usd: 0,
            cost_inr: 0,
          };
        }
        
        acc[key].api_calls += log.api_calls || 1;
        acc[key].tokens_used += log.total_tokens || 0;
        acc[key].cost_usd += log.cost_usd || 0;
        acc[key].cost_inr += log.cost_inr || 0;
        
        return acc;
      }, {});

      return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
    },
    enabled: !!user,
  });
}

export function useFeatureBreakdown(days: number = 30) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['feature-breakdown', user?.id, days],
    queryFn: async (): Promise<FeatureBreakdown[]> => {
      if (!user) throw new Error("Not authenticated");

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('api_usage_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'success')
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      // Group by feature
      const grouped = (data || []).reduce((acc: Record<string, FeatureBreakdown>, log) => {
        const feature = log.feature;
        
        if (!acc[feature]) {
          acc[feature] = {
            feature,
            total_calls: 0,
            total_tokens: 0,
            total_cost_usd: 0,
            total_cost_inr: 0,
            avg_cost_per_call_usd: 0,
            avg_cost_per_call_inr: 0,
          };
        }
        
        acc[feature].total_calls += 1;
        acc[feature].total_tokens += log.total_tokens || 0;
        acc[feature].total_cost_usd += log.cost_usd || 0;
        acc[feature].total_cost_inr += log.cost_inr || 0;
        
        return acc;
      }, {});

      // Calculate averages
      return Object.values(grouped).map(item => ({
        ...item,
        avg_cost_per_call_usd: item.total_calls > 0 ? item.total_cost_usd / item.total_calls : 0,
        avg_cost_per_call_inr: item.total_calls > 0 ? item.total_cost_inr / item.total_calls : 0,
      }));
    },
    enabled: !!user,
  });
}

export function useUsageLogs(limit: number = 50) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['usage-logs', user?.id, limit],
    queryFn: async (): Promise<UsageLog[]> => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from('api_usage_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as UsageLog[];
    },
    enabled: !!user,
  });
}

// Admin hooks
export function useAdminUsageStats(days: number = 30) {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ['admin-usage-stats', days],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('api_usage_logs')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      const stats = (data || []).reduce(
        (acc, log) => ({
          totalApiCalls: acc.totalApiCalls + (log.api_calls || 1),
          totalTokens: acc.totalTokens + (log.total_tokens || 0),
          totalCostUsd: acc.totalCostUsd + (log.cost_usd || 0),
          totalCostInr: acc.totalCostInr + (log.cost_inr || 0),
          successfulCalls: acc.successfulCalls + (log.status === 'success' ? 1 : 0),
          failedCalls: acc.failedCalls + (log.status === 'failed' ? 1 : 0),
          uniqueUsers: new Set([...acc.uniqueUsersSet, log.user_id]),
          uniqueUsersSet: new Set([...acc.uniqueUsersSet, log.user_id]),
        }),
        {
          totalApiCalls: 0,
          totalTokens: 0,
          totalCostUsd: 0,
          totalCostInr: 0,
          successfulCalls: 0,
          failedCalls: 0,
          uniqueUsers: new Set<string>(),
          uniqueUsersSet: new Set<string>(),
        }
      );

      return {
        ...stats,
        uniqueUsers: stats.uniqueUsersSet.size,
      };
    },
    enabled: isAdmin,
  });
}

export function useAdminUsageLogs(limit: number = 100) {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ['admin-usage-logs', limit],
    queryFn: async (): Promise<UsageLog[]> => {
      const { data, error } = await supabase
        .from('api_usage_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as UsageLog[];
    },
    enabled: isAdmin,
  });
}

export function useAdminDailyStats(days: number = 30) {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ['admin-daily-stats', days],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('api_usage_logs')
        .select('*')
        .eq('status', 'success')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by date
      const grouped = (data || []).reduce((acc: Record<string, any>, log) => {
        const date = new Date(log.created_at).toISOString().split('T')[0];
        
        if (!acc[date]) {
          acc[date] = {
            date,
            api_calls: 0,
            total_tokens: 0,
            cost_usd: 0,
            cost_inr: 0,
            unique_users: new Set<string>(),
            scene_generations: 0,
            image_generations: 0,
            voiceover_generations: 0,
            video_exports: 0,
          };
        }
        
        acc[date].api_calls += log.api_calls || 1;
        acc[date].total_tokens += log.total_tokens || 0;
        acc[date].cost_usd += log.cost_usd || 0;
        acc[date].cost_inr += log.cost_inr || 0;
        acc[date].unique_users.add(log.user_id);
        
        if (log.feature === 'generate-scenes') acc[date].scene_generations++;
        if (log.feature === 'generate-image') acc[date].image_generations++;
        if (log.feature === 'generate-voiceover') acc[date].voiceover_generations++;
        if (log.feature === 'export-video') acc[date].video_exports++;
        
        return acc;
      }, {});

      return Object.values(grouped).map((day: any) => ({
        ...day,
        unique_users: day.unique_users.size,
      }));
    },
    enabled: isAdmin,
  });
}

export function useAdminUserCosts(days: number = 30) {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ['admin-user-costs', days],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('api_usage_logs')
        .select('*')
        .eq('status', 'success')
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      // Group by user
      const grouped = (data || []).reduce((acc: Record<string, any>, log) => {
        const userId = log.user_id;
        
        if (!acc[userId]) {
          acc[userId] = {
            user_id: userId,
            api_calls: 0,
            total_tokens: 0,
            cost_usd: 0,
            cost_inr: 0,
          };
        }
        
        acc[userId].api_calls += log.api_calls || 1;
        acc[userId].total_tokens += log.total_tokens || 0;
        acc[userId].cost_usd += log.cost_usd || 0;
        acc[userId].cost_inr += log.cost_inr || 0;
        
        return acc;
      }, {});

      return Object.values(grouped).sort((a: any, b: any) => b.cost_usd - a.cost_usd);
    },
    enabled: isAdmin,
  });
}
