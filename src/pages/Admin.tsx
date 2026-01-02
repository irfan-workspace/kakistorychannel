import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Video, CreditCard, TrendingUp, Search, Crown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface AdminStats {
  totalUsers: number;
  totalProjects: number;
  totalExports: number;
  activeSubscriptions: number;
}

interface UserData {
  id: string;
  user_id: string;
  full_name: string | null;
  subscription_tier: string;
  credits_balance: number;
  created_at: string;
}

export default function Admin() {
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch admin stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [usersResult, projectsResult, subscriptionsResult] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);

      return {
        totalUsers: usersResult.count || 0,
        totalProjects: projectsResult.count || 0,
        totalExports: 0, // Would come from usage_logs
        activeSubscriptions: subscriptionsResult.count || 0,
      } as AdminStats;
    },
  });

  // Fetch users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (searchQuery) {
        query = query.ilike('full_name', `%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as UserData[];
    },
  });

  // Fetch recent projects
  const { data: recentProjects, isLoading: projectsLoading } = useQuery({
    queryKey: ['admin-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers ?? 0, icon: Users, color: 'text-primary' },
    { label: 'Total Projects', value: stats?.totalProjects ?? 0, icon: Video, color: 'text-accent' },
    { label: 'Active Subscriptions', value: stats?.activeSubscriptions ?? 0, icon: Crown, color: 'text-warning' },
    { label: 'This Month', value: '+12%', icon: TrendingUp, color: 'text-success' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Admin Panel</h1>
          <p className="text-muted-foreground">Manage users, subscriptions, and analytics</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <Card key={i}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      {statsLoading ? (
                        <Skeleton className="h-8 w-16 mt-1" />
                      ) : (
                        <p className="text-2xl font-bold">{stat.value}</p>
                      )}
                    </div>
                    <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${stat.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="usage">Usage Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Users</CardTitle>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Subscription</TableHead>
                        <TableHead>Credits</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users?.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.full_name || 'Unnamed User'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.subscription_tier === 'free' ? 'secondary' : 'default'}>
                              {user.subscription_tier}
                            </Badge>
                          </TableCell>
                          <TableCell>{user.credits_balance}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Projects</CardTitle>
                <CardDescription>Latest projects across all users</CardDescription>
              </CardHeader>
              <CardContent>
                {projectsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Language</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentProjects?.map((project: any) => (
                        <TableRow key={project.id}>
                          <TableCell className="font-medium">{project.title}</TableCell>
                          <TableCell className="capitalize">{project.language}</TableCell>
                          <TableCell className="capitalize">{project.story_type}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{project.status}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Usage Analytics</CardTitle>
                <CardDescription>Track platform usage and credits consumption</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <p>Usage analytics coming soon...</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
