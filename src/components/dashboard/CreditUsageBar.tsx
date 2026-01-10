import { useAuth } from '@/hooks/useAuth';
import { useUsageStats } from '@/hooks/useUsageAnalytics';
import { useNavigate } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Coins, TrendingUp, AlertTriangle, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

const CREDIT_LIMITS: Record<string, number> = {
  free: 100,
  monthly: 1000,
  credits: 500,
};

const TIER_LABELS: Record<string, string> = {
  free: 'Free Plan',
  monthly: 'Monthly Pro',
  credits: 'Pay-as-you-go',
};

export function CreditUsageBar() {
  const { profile } = useAuth();
  const { data: usageStats, isLoading } = useUsageStats(30);
  const navigate = useNavigate();

  const tier = profile?.subscription_tier || 'free';
  const creditLimit = CREDIT_LIMITS[tier] || CREDIT_LIMITS.free;
  const creditsRemaining = profile?.credits_balance ?? creditLimit;
  const creditsUsed = creditLimit - creditsRemaining;
  const usagePercentage = Math.min(100, Math.max(0, (creditsUsed / creditLimit) * 100));
  const showPurchaseButton = usagePercentage >= 70;

  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return 'text-destructive';
    if (percentage >= 75) return 'text-warning';
    return 'text-primary';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-destructive';
    if (percentage >= 75) return 'bg-warning';
    return 'bg-primary';
  };

  const getStatusBadge = (percentage: number) => {
    if (percentage >= 100) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Exhausted
        </Badge>
      );
    }
    if (percentage >= 90) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Critical
        </Badge>
      );
    }
    if (percentage >= 75) {
      return (
        <Badge variant="outline" className="gap-1 border-warning text-warning">
          <TrendingUp className="h-3 w-3" />
          High Usage
        </Badge>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-1/3 bg-muted rounded" />
            <div className="h-2 w-full bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Coins className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-sm font-medium">Credit Usage</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(usagePercentage)}
            <Badge variant="secondary" className="text-xs">
              {TIER_LABELS[tier]}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4 px-4 space-y-3">
        <div className="relative">
          <Progress 
            value={usagePercentage} 
            className="h-3 bg-muted"
          />
          <div 
            className={cn(
              "absolute inset-0 h-3 rounded-full transition-all",
              getProgressColor(usagePercentage)
            )}
            style={{ width: `${usagePercentage}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            <span className={cn("font-semibold", getStatusColor(usagePercentage))}>
              {creditsUsed.toFixed(0)}
            </span>
            {' / '}
            {creditLimit} credits used
          </span>
          <span className={cn("font-medium", getStatusColor(usagePercentage))}>
            {usagePercentage.toFixed(0)}%
          </span>
        </div>
        {usageStats && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t">
            <span>{usageStats.totalApiCalls} API calls this month</span>
            <span>•</span>
            <span>${usageStats.totalCostUsd.toFixed(2)} spent</span>
          </div>
        )}
        {showPurchaseButton && (
          <div className="pt-2">
            <Button 
              onClick={() => navigate('/subscription')}
              size="sm"
              className={cn(
                "w-full gap-2",
                usagePercentage >= 90 
                  ? "bg-destructive hover:bg-destructive/90" 
                  : "bg-primary hover:bg-primary/90"
              )}
            >
              <CreditCard className="h-4 w-4" />
              {usagePercentage >= 100 
                ? 'Purchase Credits Now' 
                : usagePercentage >= 90 
                  ? 'Running Low - Get More Credits'
                  : 'Top Up Credits'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
