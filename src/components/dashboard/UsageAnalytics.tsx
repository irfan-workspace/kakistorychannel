import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, 
  Coins, 
  TrendingUp, 
  Zap, 
  CheckCircle, 
  XCircle,
  Image,
  Mic,
  Video,
  FileText
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { 
  useUsageStats, 
  useDailyUsage, 
  useFeatureBreakdown, 
  useUsageLogs 
} from "@/hooks/useUsageAnalytics";
import { useAuth } from "@/hooks/useAuth";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  "generate-scenes": <FileText className="h-4 w-4" />,
  "generate-image": <Image className="h-4 w-4" />,
  "generate-voiceover": <Mic className="h-4 w-4" />,
  "export-video": <Video className="h-4 w-4" />,
};

const FEATURE_COLORS: Record<string, string> = {
  "generate-scenes": "hsl(var(--primary))",
  "generate-image": "hsl(var(--accent))",
  "generate-voiceover": "#10b981",
  "export-video": "#f59e0b",
};

export function UsageAnalytics() {
  const { profile } = useAuth();
  const { data: stats, isLoading: statsLoading } = useUsageStats(30);
  const { data: dailyUsage, isLoading: dailyLoading } = useDailyUsage(30);
  const { data: featureBreakdown, isLoading: featureLoading } = useFeatureBreakdown(30);
  const { data: usageLogs, isLoading: logsLoading } = useUsageLogs(20);

  const remainingCredits = profile?.credits_balance ?? 0;

  // Prepare chart data for daily usage
  const dailyChartData = dailyUsage?.reduce((acc: Record<string, any>, item) => {
    if (!acc[item.date]) {
      acc[item.date] = { date: item.date, cost: 0, calls: 0 };
    }
    acc[item.date].cost += item.cost_inr;
    acc[item.date].calls += item.api_calls;
    return acc;
  }, {});

  const chartData = Object.values(dailyChartData || {})
    .slice(-7)
    .map((item: any) => ({
      ...item,
      date: new Date(item.date).toLocaleDateString('en-IN', { weekday: 'short' }),
    }));

  // Prepare pie chart data
  const pieData = featureBreakdown?.map(item => ({
    name: item.feature.replace('generate-', '').replace('-', ' '),
    value: item.total_cost_inr,
    color: FEATURE_COLORS[item.feature] || "hsl(var(--muted))",
  })) || [];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">API Calls</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.totalApiCalls || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.successfulCalls || 0} successful, {stats?.failedCalls || 0} failed
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tokens Used</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {(stats?.totalTokens || 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
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
                <p className="text-xs text-muted-foreground">
                  ${(stats?.totalCostUsd || 0).toFixed(4)} USD
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Credits Balance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{remainingCredits}</div>
            <p className="text-xs text-muted-foreground">Available credits</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="breakdown">Feature Breakdown</TabsTrigger>
          <TabsTrigger value="history">Usage History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Daily Usage Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Daily Cost (Last 7 Days)</CardTitle>
                <CardDescription>Your AI usage cost over time</CardDescription>
              </CardHeader>
              <CardContent>
                {dailyLoading ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : chartData.length > 0 ? (
                  <ChartContainer config={{}} className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <XAxis dataKey="date" fontSize={12} />
                        <YAxis fontSize={12} tickFormatter={(v) => `₹${v}`} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    No usage data yet
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Feature Cost Split */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cost by Feature</CardTitle>
                <CardDescription>Where your credits are going</CardDescription>
              </CardHeader>
              <CardContent>
                {featureLoading ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : pieData.length > 0 ? (
                  <div className="flex items-center gap-4">
                    <ChartContainer config={{}} className="h-[200px] w-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={80}
                            dataKey="value"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                    <div className="space-y-2">
                      {pieData.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div 
                            className="h-3 w-3 rounded-full" 
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-sm capitalize">{item.name}</span>
                          <span className="text-sm text-muted-foreground">
                            ₹{item.value.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                    No usage data yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="breakdown">
          <Card>
            <CardHeader>
              <CardTitle>Feature Usage Breakdown</CardTitle>
              <CardDescription>Detailed breakdown by feature type</CardDescription>
            </CardHeader>
            <CardContent>
              {featureLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : featureBreakdown && featureBreakdown.length > 0 ? (
                <div className="space-y-4">
                  {featureBreakdown.map((item) => (
                    <div 
                      key={item.feature}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-primary/10">
                          {FEATURE_ICONS[item.feature] || <Activity className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="font-medium capitalize">
                            {item.feature.replace(/-/g, ' ')}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {item.total_calls} calls • {item.total_tokens.toLocaleString()} tokens
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">₹{item.total_cost_inr.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">
                          Avg: ₹{item.avg_cost_per_call_inr.toFixed(4)}/call
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  No usage data yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Recent Usage</CardTitle>
              <CardDescription>Your latest API calls</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : usageLogs && usageLogs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feature</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Tokens</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usageLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {FEATURE_ICONS[log.feature] || <Activity className="h-4 w-4" />}
                            <span className="capitalize">
                              {log.feature.replace(/-/g, ' ')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs font-mono">
                          {log.model.split('/').pop()}
                        </TableCell>
                        <TableCell>{log.total_tokens.toLocaleString()}</TableCell>
                        <TableCell>₹{log.cost_inr.toFixed(4)}</TableCell>
                        <TableCell>
                          {log.status === 'success' ? (
                            <Badge variant="default" className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  No usage logs yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
