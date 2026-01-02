import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Save, User } from 'lucide-react';

export default function Settings() {
  const { user, profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('user_id', user.id);

      if (error) throw error;
      await refreshProfile();
      toast.success('Profile updated');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = () => {
    if (fullName) {
      return fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user?.email?.slice(0, 2).toUpperCase() || 'U';
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account settings</p>
        </div>

        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-xl">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{fullName || 'Your Name'}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10"
                    placeholder="Enter your name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ''} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>
            </div>

            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2">
              <div>
                <p className="font-medium">Subscription</p>
                <p className="text-sm text-muted-foreground">Your current plan</p>
              </div>
              <span className="capitalize font-medium">{profile?.subscription_tier || 'Free'}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center py-2">
              <div>
                <p className="font-medium">Credits Balance</p>
                <p className="text-sm text-muted-foreground">Available credits</p>
              </div>
              <span className="font-medium">{profile?.credits_balance ?? 0}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center py-2">
              <div>
                <p className="font-medium">Member Since</p>
                <p className="text-sm text-muted-foreground">Account creation date</p>
              </div>
              <span className="text-muted-foreground">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString()
                  : '-'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
