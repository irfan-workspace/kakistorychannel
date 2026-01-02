import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Crown, Check, Zap, Star, CreditCard } from 'lucide-react';

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '₹0',
    period: 'forever',
    description: 'Get started with basic features',
    features: [
      '5 credits per month',
      'Up to 3 projects',
      'Watermark on exports',
      'Standard support',
    ],
    limitations: [
      'Limited exports',
      'Watermark included',
    ],
  },
  {
    id: 'monthly',
    name: 'Creator',
    price: '₹499',
    period: 'per month',
    description: 'For serious content creators',
    features: [
      '50 credits per month',
      'Unlimited projects',
      'No watermark',
      'Priority support',
      'HD exports (1080p)',
      'All voice types',
    ],
    popular: true,
  },
  {
    id: 'credits',
    name: 'Pay as You Go',
    price: '₹10',
    period: 'per credit',
    description: 'Only pay for what you use',
    features: [
      'Buy credits as needed',
      'No monthly commitment',
      'No watermark',
      'Credits never expire',
      'All features included',
    ],
  },
];

export default function Subscription() {
  const { profile } = useAuth();
  const currentPlan = profile?.subscription_tier || 'free';
  const creditsUsed = profile?.monthly_exports_used || 0;
  const creditsTotal = currentPlan === 'free' ? 5 : currentPlan === 'monthly' ? 50 : profile?.credits_balance || 0;

  const handleUpgrade = (planId: string) => {
    // TODO: Integrate with Razorpay
    console.log('Upgrade to:', planId);
  };

  const handleBuyCredits = () => {
    // TODO: Integrate with Razorpay for credit purchase
    console.log('Buy credits');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Subscription</h1>
          <p className="text-muted-foreground">Manage your plan and credits</p>
        </div>

        {/* Current Plan Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-warning" />
              Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold capitalize">{currentPlan}</p>
                <p className="text-sm text-muted-foreground">
                  {currentPlan === 'free' ? 'Free tier' : 'Paid subscription'}
                </p>
              </div>
              <Badge variant={currentPlan === 'free' ? 'secondary' : 'default'} className="text-lg px-4 py-1">
                {profile?.credits_balance} credits
              </Badge>
            </div>

            {currentPlan !== 'credits' && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Monthly usage</span>
                  <span>{creditsUsed}/{creditsTotal} credits used</span>
                </div>
                <Progress value={(creditsUsed / creditsTotal) * 100} />
              </div>
            )}

            {currentPlan === 'free' && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Upgrade to remove watermarks</p>
                    <p className="text-sm text-muted-foreground">
                      Get more credits and professional exports without the watermark.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plans */}
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative ${plan.popular ? 'border-primary shadow-glow' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="gradient-primary gap-1">
                    <Star className="h-3 w-3" />
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="pt-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">/{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-success" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {currentPlan === plan.id ? (
                  <Button disabled className="w-full">
                    Current Plan
                  </Button>
                ) : plan.id === 'credits' ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleBuyCredits}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Buy Credits
                  </Button>
                ) : (
                  <Button
                    className={`w-full ${plan.popular ? 'gradient-primary' : ''}`}
                    variant={plan.popular ? 'default' : 'outline'}
                    onClick={() => handleUpgrade(plan.id)}
                  >
                    {plan.id === 'free' ? 'Downgrade' : 'Upgrade'}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Credit Packs */}
        <Card>
          <CardHeader>
            <CardTitle>Buy Credit Packs</CardTitle>
            <CardDescription>Purchase credits in bulk for better value</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { credits: 10, price: 99, save: 0 },
                { credits: 50, price: 449, save: 10 },
                { credits: 100, price: 799, save: 20 },
              ].map((pack) => (
                <div
                  key={pack.credits}
                  className="p-4 rounded-lg border hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={handleBuyCredits}
                >
                  <div className="text-center">
                    <p className="text-2xl font-bold">{pack.credits}</p>
                    <p className="text-sm text-muted-foreground">credits</p>
                    <p className="text-lg font-semibold mt-2">₹{pack.price}</p>
                    {pack.save > 0 && (
                      <Badge variant="secondary" className="mt-1">
                        Save {pack.save}%
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
