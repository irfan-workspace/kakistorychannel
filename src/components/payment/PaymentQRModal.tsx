import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Copy, CheckCircle2, Clock, AlertCircle, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { usePayments } from '@/hooks/usePayments';

interface PaymentQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  credits: number;
  paymentMethod: 'phonepe' | 'googlepay' | 'upi';
}

export function PaymentQRModal({ isOpen, onClose, amount, credits, paymentMethod }: PaymentQRModalProps) {
  const { createPayment, isCreatingPayment, paymentRequests, refetchPayments } = usePayments();
  const [currentRequest, setCurrentRequest] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [upiTransactionId, setUpiTransactionId] = useState('');

  useEffect(() => {
    if (isOpen && !currentRequest) {
      createPayment(
        { amount, credits, paymentMethod },
        {
          onSuccess: (data) => {
            setCurrentRequest(data.paymentRequest);
          },
        }
      );
    }
  }, [isOpen, currentRequest, amount, credits, paymentMethod, createPayment]);

  // Timer countdown
  useEffect(() => {
    if (!currentRequest?.expiresAt) return;

    const updateTimer = () => {
      const expiresAt = new Date(currentRequest.expiresAt).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeLeft(remaining);

      if (remaining === 0) {
        refetchPayments();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [currentRequest?.expiresAt, refetchPayments]);

  // Poll for status updates
  useEffect(() => {
    if (!currentRequest) return;

    const pollInterval = setInterval(() => {
      refetchPayments();
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [currentRequest, refetchPayments]);

  // Check if payment was completed
  useEffect(() => {
    if (currentRequest && paymentRequests) {
      const updated = paymentRequests.find(p => p.id === currentRequest.id);
      if (updated && updated.status === 'completed') {
        toast.success(`${credits} credits added to your account!`);
        handleClose();
      }
    }
  }, [paymentRequests, currentRequest, credits]);

  const handleClose = () => {
    setCurrentRequest(null);
    setUpiTransactionId('');
    onClose();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const openUpiApp = () => {
    if (currentRequest?.qrCodeData) {
      window.location.href = currentRequest.qrCodeData;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getAppName = () => {
    switch (paymentMethod) {
      case 'phonepe': return 'PhonePe';
      case 'googlepay': return 'Google Pay';
      default: return 'UPI App';
    }
  };

  const getAppColor = () => {
    switch (paymentMethod) {
      case 'phonepe': return 'bg-purple-600';
      case 'googlepay': return 'bg-blue-600';
      default: return 'bg-green-600';
    }
  };

  // Generate QR code using a simple API
  const qrCodeUrl = currentRequest?.qrCodeData 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(currentRequest.qrCodeData)}`
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${getAppColor()}`} />
            Pay with {getAppName()}
          </DialogTitle>
          <DialogDescription>
            Scan the QR code or tap to open {getAppName()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isCreatingPayment ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : currentRequest ? (
            <>
              {/* Timer */}
              <div className="flex items-center justify-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className={`font-mono text-lg ${timeLeft < 60 ? 'text-destructive' : ''}`}>
                  {formatTime(timeLeft)}
                </span>
                {timeLeft === 0 && (
                  <Badge variant="destructive">Expired</Badge>
                )}
              </div>

              {/* Amount Display */}
              <div className="text-center bg-muted rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Amount to Pay</p>
                <p className="text-3xl font-bold">₹{amount.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">{credits} Credits</p>
              </div>

              {/* QR Code */}
              {timeLeft > 0 && qrCodeUrl && (
                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-lg shadow-inner">
                    <img
                      src={qrCodeUrl}
                      alt="Payment QR Code"
                      className="w-[200px] h-[200px]"
                    />
                  </div>
                </div>
              )}

              {/* Open App Button */}
              {timeLeft > 0 && (
                <Button 
                  onClick={openUpiApp} 
                  className={`w-full ${getAppColor()} hover:opacity-90`}
                >
                  <Smartphone className="mr-2 h-4 w-4" />
                  Open {getAppName()}
                </Button>
              )}

              {/* Instructions */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-sm">After Payment:</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Complete payment in your UPI app</li>
                  <li>Note your UPI Transaction ID</li>
                  <li>Credits will be added after verification</li>
                </ol>
              </div>

              {/* Transaction ID Input (optional for user reference) */}
              <div className="space-y-2">
                <Label htmlFor="upi-txn-id" className="text-sm">
                  UPI Transaction ID (for reference)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="upi-txn-id"
                    value={upiTransactionId}
                    onChange={(e) => setUpiTransactionId(e.target.value)}
                    placeholder="Enter after payment"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(currentRequest.id)}
                    title="Copy Request ID"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Request ID: {currentRequest.id.substring(0, 8)}...
                </p>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center justify-center gap-2 py-2">
                {currentRequest.status === 'pending' && timeLeft > 0 && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                    <span className="text-sm text-muted-foreground">Waiting for payment...</span>
                  </>
                )}
                {currentRequest.status === 'completed' && (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-600">Payment verified!</span>
                  </>
                )}
                {(currentRequest.status === 'expired' || timeLeft === 0) && (
                  <>
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-destructive">Payment request expired</span>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Failed to create payment request. Please try again.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}