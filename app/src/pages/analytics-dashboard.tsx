import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import apiClient from "../utils/apiClient";

interface AnalyticsSummary {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByCategory: Record<string, number>;
}

interface DailyStat {
  date: string;
  logins: number;
  uploads: number;
  shares: number;
  errors: number;
}

const AnalyticsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadAnalytics();
  }, [days]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      // Load summary
      const summaryResponse = await apiClient.get<AnalyticsSummary>(`/analytics/summary?days=${days}`);
      if (summaryResponse.success && summaryResponse.data) {
        setSummary(summaryResponse.data);
      }

      // Load daily stats
      const dailyResponse = await apiClient.get<DailyStat[]>(`/analytics/daily?days=${days}`);
      if (dailyResponse.success && dailyResponse.data) {
        setDailyStats(dailyResponse.data);
      }
    } catch (error) {
      console.error("Error loading analytics:", error);
      toast.error("Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading analytics...</p>
      </div>
    );
  }

  const totalLogins = Object.entries(summary?.eventsByType || {})
    .find(([key]) => key === "user_login")?.[1] || 0;
  const totalUploads = Object.entries(summary?.eventsByType || {})
    .find(([key]) => key === "file_uploaded")?.[1] || 0;
  const totalShares = Object.entries(summary?.eventsByType || {})
    .find(([key]) => key === "file_shared")?.[1] || 0;
  const totalInvitations = Object.entries(summary?.eventsByType || {})
    .find(([key]) => key === "invitation_sent")?.[1] || 0;

  return (
    <div className="container mx-auto min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Anonymous Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Privacy-safe usage statistics (no user tracking)
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate("/storage")}
          aria-label="Back to Storage"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Time range selector */}
      <div className="mb-6">
        <div className="flex gap-2">
          <Button
            variant={days === 7 ? "default" : "outline"}
            size="sm"
            onClick={() => setDays(7)}
          >
            7 Days
          </Button>
          <Button
            variant={days === 30 ? "default" : "outline"}
            size="sm"
            onClick={() => setDays(30)}
          >
            30 Days
          </Button>
          <Button
            variant={days === 90 ? "default" : "outline"}
            size="sm"
            onClick={() => setDays(90)}
          >
            90 Days
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Logins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLogins}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Last {days} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Files Uploaded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUploads}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Last {days} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Files Shared</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalShares}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Last {days} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Invitations Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvitations}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Last {days} days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Events by Category */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Events by Category</CardTitle>
          <CardDescription>Breakdown of all events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(summary?.eventsByCategory || {}).map(
              ([category, count]) => (
                <div key={category} className="flex justify-between items-center">
                  <span className="text-sm capitalize">{category}</span>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {/* Daily Activity Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Activity</CardTitle>
          <CardDescription>Event counts per day</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4 text-sm font-medium">Date</th>
                  <th className="text-right py-2 px-4 text-sm font-medium">Logins</th>
                  <th className="text-right py-2 px-4 text-sm font-medium">Uploads</th>
                  <th className="text-right py-2 px-4 text-sm font-medium">Shares</th>
                  <th className="text-right py-2 px-4 text-sm font-medium">Errors</th>
                </tr>
              </thead>
              <tbody>
                {dailyStats.map((stat) => (
                  <tr key={stat.date} className="border-b">
                    <td className="py-2 px-4 text-sm">
                      {new Date(stat.date).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-4 text-sm text-right">{stat.logins}</td>
                    <td className="py-2 px-4 text-sm text-right">{stat.uploads}</td>
                    <td className="py-2 px-4 text-sm text-right">{stat.shares}</td>
                    <td className="py-2 px-4 text-sm text-right">
                      <span className={stat.errors > 0 ? "text-red-500" : ""}>
                        {stat.errors}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Notice */}
      <Card className="mt-6 border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/50">
        <CardHeader>
          <CardTitle className="text-sm">🔒 Privacy-First Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            These analytics are completely anonymous. We track event counts, not users.
            No emails, IP addresses, or personal identifiers are stored.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsDashboard;
