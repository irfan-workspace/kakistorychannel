import { useState } from 'react';
import { useAdminPayments } from '@/hooks/usePayments';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertTriangle, 
  Shield, 
  History, 
  Loader2,
  Search,
  RefreshCw
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

export function PaymentManagement() {
  const { 
    allPaymentRequests, 
    auditLogs, 
    isLoadingAll, 
    isLoadingAuditLogs,
    refetchAll,
    verifyPayment, 
    isVerifying,
    rejectPayment,
    isRejecting,
    isAdmin
  } = useAdminPayments();

  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [upiTransactionId, setUpiTransactionId] = useState('');
  const [payerVpa, setPayerVpa] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold mb-2">Admin Access Required</h3>
          <p className="text-muted-foreground">You need admin privileges to access payment management.</p>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case 'expired':
        return <Badge variant="outline"><AlertTriangle className="h-3 w-3 mr-1" />Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingPayments = allPaymentRequests?.filter(p => p.status === 'pending') || [];
  const filteredPayments = allPaymentRequests?.filter(p => 
    !searchQuery || 
    p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.upi_transaction_id?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleVerifyClick = (payment: any) => {
    setSelectedPayment(payment);
    setUpiTransactionId('');
    setPayerVpa('');
    setVerifyDialogOpen(true);
  };

  const handleVerifySubmit = () => {
    if (!selectedPayment || !upiTransactionId) return;

    verifyPayment({
      paymentRequestId: selectedPayment.id,
      upiTransactionId,
      payerVpa: payerVpa || undefined,
    }, {
      onSuccess: () => {
        setVerifyDialogOpen(false);
        setSelectedPayment(null);
      }
    });
  };

  const handleReject = (paymentId: string) => {
    if (confirm('Are you sure you want to reject this payment?')) {
      rejectPayment(paymentId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Verification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingPayments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Verified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {allPaymentRequests?.filter(p => p.status === 'completed').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{allPaymentRequests?.filter(p => p.status === 'completed')
                .reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2) || '0.00'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Credits Sold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {allPaymentRequests?.filter(p => p.status === 'completed')
                .reduce((sum, p) => sum + p.credits, 0) || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="pending" className="relative">
              Pending
              {pendingPayments.length > 0 && (
                <Badge className="ml-2 bg-yellow-600">{pendingPayments.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="all">All Payments</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => refetchAll()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Pending Payments Tab */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Pending Verification
              </CardTitle>
              <CardDescription>
                Review and verify pending payment requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAll ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : pendingPayments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No pending payments</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request ID</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-mono text-xs">
                          {payment.id.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          User
                        </TableCell>
                        <TableCell className="font-medium">₹{Number(payment.amount).toFixed(2)}</TableCell>
                        <TableCell>{payment.credits}</TableCell>
                        <TableCell className="capitalize">{payment.payment_method || 'UPI'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(payment.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(payment.expires_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              onClick={() => handleVerifyClick(payment)}
                              disabled={isVerifying}
                            >
                              {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              onClick={() => handleReject(payment.id)}
                              disabled={isRejecting}
                            >
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Payments Tab */}
        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                All Payment Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingAll ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Request ID</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Credits</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>UPI Txn ID</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayments.map((payment) => (
                        <TableRow key={payment.id}>
                        <TableCell className="font-mono text-xs">
                          {payment.id.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          User
                          </TableCell>
                          <TableCell className="font-medium">₹{Number(payment.amount).toFixed(2)}</TableCell>
                          <TableCell>{payment.credits}</TableCell>
                          <TableCell>{getStatusBadge(payment.status)}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {payment.upi_transaction_id || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(payment.created_at), 'MMM dd, yyyy HH:mm')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Audit Logs
              </CardTitle>
              <CardDescription>
                Security audit trail for all payment actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAuditLogs ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : !auditLogs || auditLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No audit logs yet</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Actor Role</TableHead>
                        <TableHead>Payment ID</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">
                            {format(new Date(log.created_at), 'MMM dd, HH:mm:ss')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {log.action.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">{log.actor_role || 'system'}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.payment_request_id?.substring(0, 8) || '-'}...
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                            {log.metadata ? JSON.stringify(log.metadata) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Verify Payment Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Payment</DialogTitle>
            <DialogDescription>
              Enter the UPI transaction details to verify this payment
            </DialogDescription>
          </DialogHeader>
          
          {selectedPayment && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Amount</span>
                  <span className="font-bold">₹{Number(selectedPayment.amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Credits to Add</span>
                  <span className="font-bold">{selectedPayment.credits}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>User</span>
                  <span>{selectedPayment.profiles?.full_name || 'Unknown'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="upi-txn">UPI Transaction ID *</Label>
                <Input
                  id="upi-txn"
                  value={upiTransactionId}
                  onChange={(e) => setUpiTransactionId(e.target.value)}
                  placeholder="Enter UPI transaction ID"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payer-vpa">Payer VPA (Optional)</Label>
                <Input
                  id="payer-vpa"
                  value={payerVpa}
                  onChange={(e) => setPayerVpa(e.target.value)}
                  placeholder="e.g., user@upi"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleVerifySubmit} 
              disabled={!upiTransactionId || isVerifying}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify & Add Credits'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}