import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Crown, Check, Zap, Star, CreditCard } from 'lucide-react';

const creditPacks = [
  {
    id: 'starter',
    credits: 10,
    price: 99,
    pricePerCredit: 9.9,
    description: 'Try it out',
  },
  {
    id: 'popular',
    credits: 50,
    price: 449,
    pricePerCredit: 8.98,
    save: 10,
    popular: true,
    description: 'Most popular choice',
  },
  {
    id: 'pro',
    credits: 100,
    price: 799,
    pricePerCredit: 7.99,
    save: 20,
    description: 'Best value for pros',
  },
  {
    id: 'studio',
    credits: 250,
    price: 1749,
    pricePerCredit: 6.99,
    save: 30,
    description: 'For studios & teams',
  },
];

const freeFeatures = [
  '5 free credits to start',
  'Up to 3 projects',
  'Watermark on exports',
  'Standard support',
];

const paidFeatures = [
  'No watermark on exports',
  'Unlimited projects',
  'HD exports (1080p)',
  'All voice types',
  'Priority support',
  'Credits never expire',
];

export default function Subscription() {
  const { profile } = useAuth();
  const creditsBalance = profile?.credits_balance || 0;
  const hasCredits = creditsBalance > 5; // More than free tier credits

  const handleBuyCredits = (packId: string) => {
    // TODO: Integrate with Razorpay/Stripe for credit purchase
    const pack = creditPacks.find(p => p.id === packId);
    console.log('Buy credits pack:', pack);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Subscription</h1>
          <p className="text-muted-foreground">Manage your plan and credits</p>
        </div>

        {/* Current Credits Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-warning" />
              Your Credits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-4xl font-bold">{creditsBalance}</p>
                <p className="text-sm text-muted-foreground">
                  credits available
                </p>
              </div>
              <Badge variant={hasCredits ? 'default' : 'secondary'} className="text-lg px-4 py-2">
                {hasCredits ? 'Active' : 'Free Tier'}
              </Badge>
            </div>

            {!hasCredits && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Buy credits to unlock full features</p>
                    <p className="text-sm text-muted-foreground">
                      Remove watermarks, access HD exports, and unlock all voice types.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Features based on credits */}
            <div className="grid gap-4 md:grid-cols-2 pt-2">
              <div className="space-y-2">
                <p className="font-medium text-sm text-muted-foreground">Free Tier (5 credits)</p>
                <ul className="space-y-1">
                  {freeFeatures.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="h-3 w-3 text-muted-foreground" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-sm text-primary">With Purchased Credits</p>
                <ul className="space-y-1">
                  {paidFeatures.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="h-3 w-3 text-success" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credit Packs */}
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-display font-bold">Buy Credit Packs</h2>
            <p className="text-muted-foreground">Purchase credits - pay only for what you use</p>
          </div>
          
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {creditPacks.map((pack) => (
              <Card
                key={pack.id}
                className={`relative cursor-pointer transition-all hover:shadow-lg ${
                  pack.popular ? 'border-primary shadow-glow' : 'hover:border-primary/50'
                }`}
                onClick={() => handleBuyCredits(pack.id)}
              >
                {pack.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="gradient-primary gap-1">
                      <Star className="h-3 w-3" />
                      Best Value
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <div className="text-4xl font-bold">{pack.credits}</div>
                  <CardDescription>credits</CardDescription>
                </CardHeader>
                <CardContent className="text-center space-y-3">
                  <div>
                    <p className="text-2xl font-bold">₹{pack.price}</p>
                    <p className="text-xs text-muted-foreground">
                      ₹{pack.pricePerCredit.toFixed(2)}/credit
                    </p>
                  </div>
                  
                  {pack.save && (
                    <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                      Save {pack.save}%
                    </Badge>
                  )}
                  
                  <p className="text-sm text-muted-foreground">{pack.description}</p>
                  
                  <Button 
                    className={`w-full ${pack.popular ? 'gradient-primary' : ''}`}
                    variant={pack.popular ? 'default' : 'outline'}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Buy Now
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* How Credits Work */}
        <Card>
          <CardHeader>
            <CardTitle>How Credits Work</CardTitle>
            <CardDescription>Simple, transparent pricing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="text-center p-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">1 Credit = 1 Scene</h3>
                <p className="text-sm text-muted-foreground">
                  Each scene generation (image + audio) costs 1 credit
                </p>
              </div>
              <div className="text-center p-4">
                <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
                  <Zap className="h-6 w-6 text-success" />
                </div>
                <h3 className="font-semibold mb-1">Never Expire</h3>
                <p className="text-sm text-muted-foreground">
                  Your purchased credits stay valid forever
                </p>
              </div>
              <div className="text-center p-4">
                <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-3">
                  <Crown className="h-6 w-6 text-warning" />
                </div>
                <h3 className="font-semibold mb-1">Full Access</h3>
                <p className="text-sm text-muted-foreground">
                  All features unlocked with purchased credits
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
