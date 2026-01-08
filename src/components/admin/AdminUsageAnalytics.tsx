import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Activity, 
  Coins, 
  TrendingUp, 
  Users, 
  Download,
  CheckCircle, 
  XCircle,
  Image,
  Mic,
  Video,
  FileText,
  DollarSign
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { 
  useAdminUsageStats, 
  useAdminUsageLogs,
  useAdminDailyStats,
  useAdminUserCosts,
} from "@/hooks/useUsageAnalytics";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, AreaChart, Area } from "recharts";

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  "generate-scenes": <FileText className="h-4 w-4" />,
  "generate-image": <Image className="h-4 w-4" />,
  "generate-voiceover": <Mic className="h-4 w-4" />,
  "export-video": <Video className="h-4 w-4" />,
};

export function AdminUsageAnalytics() {
  const [days, setDays] = useState(30);
  
  const { data: stats, isLoading: statsLoading } = useAdminUsageStats(days);
  const { data: usageLogs, isLoading: logsLoading } = useAdminUsageLogs(100);
  const { data: dailyStats, isLoading: dailyLoading } = useAdminDailyStats(days);
  const { data: userCosts, isLoading: userCostsLoading } = useAdminUserCosts(days);

  // Prepare chart data
  const chartData = (dailyStats || []).slice(-14).map((day: any) => ({
    ...day,
    date: new Date(day.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
  }));

  // Export to CSV
  const exportToCSV = () => {
    if (!usageLogs) return;
    
    const headers = ['Date', 'User ID', 'Feature', 'Model', 'Tokens', 'Cost USD', 'Cost INR', 'Status'];
    const rows = usageLogs.map(log => [
      new Date(log.created_at).toISOString(),
      log.user_id,
      log.feature,
      log.model,
      log.total_tokens,
      log.cost_usd,
      log.cost_inr,
      log.status,
    ]);
    
    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usage-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Time Period Selector */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Usage Analytics</h2>
          <p className="text-muted-foreground">Platform-wide AI usage and cost tracking</p>
        </div>
        <div className="flex gap-2">
          <Select value={days.toString()} onValueChange={(v) => setDays(parseInt(v))}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total API Calls</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.totalApiCalls || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.successfulCalls || 0} success / {stats?.failedCalls || 0} failed
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.uniqueUsers || 0}</div>
                <p className="text-xs text-muted-foreground">Last {days} days</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {((stats?.totalTokens || 0) / 1000).toFixed(1)}K
                </div>
                <p className="text-xs text-muted-foreground">Tokens consumed</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cost (₹)</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  ₹{(stats?.totalCostInr || 0).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">Platform burn</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cost ($)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  ${(stats?.totalCostUsd || 0).toFixed(4)}
                </div>
                <p className="text-xs text-muted-foreground">USD equivalent</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="users">Top Users</TabsTrigger>
          <TabsTrigger value="logs">All Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Daily Cost Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Daily Cost Trend</CardTitle>
                <CardDescription>Platform AI cost over time</CardDescription>
              </CardHeader>
              <CardContent>
                {dailyLoading ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : chartData.length > 0 ? (
                  <ChartContainer config={{}} className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <XAxis dataKey="date" fontSize={12} />
                        <YAxis fontSize={12} tickFormatter={(v) => `₹${v}`} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area 
                          type="monotone" 
                          dataKey="cost_inr" 
                          stroke="hsl(var(--primary))" 
                          fill="hsl(var(--primary)/0.2)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* API Calls Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">API Calls Trend</CardTitle>
                <CardDescription>Daily API call volume</CardDescription>
              </CardHeader>
              <CardContent>
                {dailyLoading ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : chartData.length > 0 ? (
                  <ChartContainer config={{}} className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <XAxis dataKey="date" fontSize={12} />
                        <YAxis fontSize={12} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="api_calls" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Feature Usage Today */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Feature Usage (Last {days} Days)</CardTitle>
              <CardDescription>Breakdown by feature type</CardDescription>
            </CardHeader>
            <CardContent>
              {dailyLoading ? (
                <div className="grid gap-4 md:grid-cols-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-4">
                  {[
                    { key: 'scene_generations', label: 'Scenes', icon: <FileText className="h-5 w-5" /> },
                    { key: 'image_generations', label: 'Images', icon: <Image className="h-5 w-5" /> },
                    { key: 'voiceover_generations', label: 'Voiceovers', icon: <Mic className="h-5 w-5" /> },
                    { key: 'video_exports', label: 'Exports', icon: <Video className="h-5 w-5" /> },
                  ].map((feature) => {
                    const total = (dailyStats || []).reduce((acc: number, day: any) => acc + (day[feature.key] || 0), 0);
                    return (
                      <div key={feature.key} className="flex items-center gap-3 p-4 rounded-lg border">
                        <div className="p-2 rounded-full bg-primary/10">
                          {feature.icon}
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{total}</p>
                          <p className="text-sm text-muted-foreground">{feature.label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Top Users by Cost</CardTitle>
              <CardDescription>Users with highest AI usage costs</CardDescription>
            </CardHeader>
            <CardContent>
              {userCostsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : userCosts && userCosts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>API Calls</TableHead>
                      <TableHead>Tokens</TableHead>
                      <TableHead>Cost (₹)</TableHead>
                      <TableHead>Cost ($)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userCosts.slice(0, 20).map((user: any, index: number) => (
                      <TableRow key={user.user_id}>
                        <TableCell>
                          <Badge variant={index < 3 ? "default" : "secondary"}>
                            #{index + 1}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {user.user_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>{user.api_calls}</TableCell>
                        <TableCell>{user.total_tokens.toLocaleString()}</TableCell>
                        <TableCell className="font-semibold">
                          ₹{user.cost_inr.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          ${user.cost_usd.toFixed(4)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  No user data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>All Usage Logs</CardTitle>
              <CardDescription>Complete API usage history</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : usageLogs && usageLogs.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Feature</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Tokens</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usageLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-muted-foreground text-xs">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.user_id.slice(0, 8)}...
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {FEATURE_ICONS[log.feature] || <Activity className="h-4 w-4" />}
                              <span className="capitalize text-sm">
                                {log.feature.replace(/-/g, ' ')}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs font-mono">
                            {log.model.split('/').pop()?.slice(0, 15)}
                          </TableCell>
                          <TableCell>{log.total_tokens.toLocaleString()}</TableCell>
                          <TableCell>₹{log.cost_inr.toFixed(4)}</TableCell>
                          <TableCell>
                            {log.status === 'success' ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  No logs available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
