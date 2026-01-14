import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Coins, Zap, Star, Crown, Smartphone } from 'lucide-react';
import { PaymentQRModal } from './PaymentQRModal';

interface CreditPack {
  id: string;
  credits: number;
  price: number;
  pricePerCredit: number;
  popular?: boolean;
  bestValue?: boolean;
  icon: React.ReactNode;
}

const CREDIT_PACKS: CreditPack[] = [
  {
    id: 'starter',
    credits: 50,
    price: 99,
    pricePerCredit: 1.98,
    icon: <Coins className="h-5 w-5" />,
  },
  {
    id: 'popular',
    credits: 150,
    price: 249,
    pricePerCredit: 1.66,
    popular: true,
    icon: <Zap className="h-5 w-5" />,
  },
  {
    id: 'pro',
    credits: 350,
    price: 499,
    pricePerCredit: 1.43,
    icon: <Star className="h-5 w-5" />,
  },
  {
    id: 'business',
    credits: 800,
    price: 999,
    pricePerCredit: 1.25,
    bestValue: true,
    icon: <Crown className="h-5 w-5" />,
  },
];

type PaymentMethod = 'phonepe' | 'googlepay' | 'upi';

export function CreditPurchaseCard() {
  const [selectedPack, setSelectedPack] = useState<string>('popular');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const currentPack = CREDIT_PACKS.find(p => p.id === selectedPack) || CREDIT_PACKS[1];

  const handlePurchase = () => {
    setShowPaymentModal(true);
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Purchase Credits
          </CardTitle>
          <CardDescription>
            Buy credits to generate images, voiceovers, and export videos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Credit Pack Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Select Credit Pack</Label>
            <div className="grid grid-cols-2 gap-3">
              {CREDIT_PACKS.map((pack) => (
                <div
                  key={pack.id}
                  onClick={() => setSelectedPack(pack.id)}
                  className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all hover:border-primary/50 ${
                    selectedPack === pack.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  }`}
                >
                  {pack.popular && (
                    <Badge className="absolute -top-2 -right-2 bg-primary">
                      Popular
                    </Badge>
                  )}
                  {pack.bestValue && (
                    <Badge className="absolute -top-2 -right-2 bg-green-600">
                      Best Value
                    </Badge>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    {pack.icon}
                    <span className="font-bold">{pack.credits} Credits</span>
                  </div>
                  <div className="text-2xl font-bold">₹{pack.price}</div>
                  <div className="text-xs text-muted-foreground">
                    ₹{pack.pricePerCredit.toFixed(2)} per credit
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Payment Method</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              className="grid grid-cols-3 gap-3"
            >
              <div>
                <RadioGroupItem
                  value="phonepe"
                  id="phonepe"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="phonepe"
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center mb-2">
                    <Smartphone className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-medium">PhonePe</span>
                </Label>
              </div>

              <div>
                <RadioGroupItem
                  value="googlepay"
                  id="googlepay"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="googlepay"
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mb-2">
                    <span className="text-white font-bold text-sm">G</span>
                  </div>
                  <span className="text-sm font-medium">GPay</span>
                </Label>
              </div>

              <div>
                <RadioGroupItem
                  value="upi"
                  id="upi"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="upi"
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center mb-2">
                    <span className="text-white font-bold text-xs">UPI</span>
                  </div>
                  <span className="text-sm font-medium">Any UPI</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Summary and Purchase Button */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Credits</span>
              <span className="font-medium">{currentPack.credits}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Price per Credit</span>
              <span className="font-medium">₹{currentPack.pricePerCredit.toFixed(2)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold">
              <span>Total</span>
              <span>₹{currentPack.price}</span>
            </div>
          </div>

          <Button onClick={handlePurchase} className="w-full" size="lg">
            Pay ₹{currentPack.price}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Secure payment via UPI. Credits never expire.
          </p>
        </CardContent>
      </Card>

      <PaymentQRModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        amount={currentPack.price}
        credits={currentPack.credits}
        paymentMethod={paymentMethod}
      />
    </>
  );
}