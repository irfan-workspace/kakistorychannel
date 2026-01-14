import { usePayments } from '@/hooks/usePayments';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { History, CheckCircle2, Clock, XCircle, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function PaymentHistory() {
  const { paymentRequests, isLoadingPayments } = usePayments();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="outline">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'phonepe':
        return 'PhonePe';
      case 'googlepay':
        return 'Google Pay';
      case 'upi':
        return 'UPI';
      default:
        return method || 'UPI';
    }
  };

  if (isLoadingPayments) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Payment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Payment History
        </CardTitle>
        <CardDescription>
          Your recent credit purchases and payment status
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!paymentRequests || paymentRequests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No payment history yet</p>
            <p className="text-sm">Purchase credits to get started</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentRequests.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(payment.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="font-medium">₹{Number(payment.amount).toFixed(2)}</TableCell>
                  <TableCell>{payment.credits}</TableCell>
                  <TableCell className="text-sm">
                    {getPaymentMethodLabel(payment.payment_method)}
                  </TableCell>
                  <TableCell>{getStatusBadge(payment.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}