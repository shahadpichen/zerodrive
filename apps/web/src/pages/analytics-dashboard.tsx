import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type {
  AnalyticsDailyStat,
  AnalyticsDimensionBucket,
  AnalyticsSummary,
} from "@zerodrive/shared-types";
import { toast } from "sonner";
import apiClient, { ApiError } from "../utils/apiClient";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

type RangeDays = 7 | 30 | 90 | 365;

const RANGES: RangeDays[] = [7, 30, 90, 365];

function formatDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(`${date.slice(0, 10)}T00:00:00`));
}

function LoadingState() {
  return (
    <div className="space-y-8 p-6 md:p-10" aria-label="Loading analytics">
      <div className="h-28 animate-pulse border bg-muted/40" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-32 animate-pulse border bg-muted/40" />
        ))}
      </div>
      <div className="h-72 animate-pulse border bg-muted/40" />
    </div>
  );
}

function DailyBars({ stats }: { stats: AnalyticsDailyStat[] }) {
  const visible = stats.slice(-30);
  const max = Math.max(
    1,
    ...visible.map(
      (day) =>
        day.logins +
        day.filesAdded +
        day.shares +
        day.downloads +
        day.sharesFinalized +
        day.sharesRevoked +
        day.keySetups +
        day.keyRotations,
    ),
  );

  if (visible.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center border border-dashed text-sm text-muted-foreground">
        No activity has been counted in this period.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex h-56 min-w-[680px] items-end gap-2 border-b px-2 pt-4">
        {visible.map((day) => {
          const total =
            day.logins +
            day.filesAdded +
            day.shares +
            day.downloads +
            day.sharesFinalized +
            day.sharesRevoked +
            day.keySetups +
            day.keyRotations;
          const height = Math.max(total > 0 ? 6 : 2, (total / max) * 100);
          return (
            <div
              key={day.date}
              className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2"
            >
              <span className="text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                {total}
              </span>
              <div
                className="w-full bg-card-foreground/85 transition-colors group-hover:bg-primary"
                style={{ height: `${height}%` }}
                title={`${formatDate(day.date)}: ${total} counted events`}
              />
              <span className="whitespace-nowrap text-[9px] text-muted-foreground">
                {formatDate(day.date)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DimensionList({
  title,
  description,
  buckets,
}: {
  title: string;
  description: string;
  buckets: AnalyticsDimensionBucket[];
}) {
  const visibleCounts = buckets
    .map((bucket) => bucket.count || 0)
    .filter((count) => count > 0);
  const max = Math.max(1, ...visibleCounts);

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {buckets.length === 0 && (
          <p className="text-sm text-muted-foreground">No bucket data yet.</p>
        )}
        {buckets.map((bucket) => (
          <div key={`${bucket.metric}-${bucket.dimension}-${bucket.bucket}`}>
            <div className="mb-1.5 flex items-center justify-between gap-4 text-xs">
              <span className="truncate">{bucket.bucket}</span>
              <span className="text-muted-foreground">
                {bucket.suppressed ? "< 5" : bucket.count}
              </span>
            </div>
            <div className="h-1.5 bg-muted">
              <div
                className="h-full bg-card-foreground"
                style={{
                  width: bucket.suppressed
                    ? "4%"
                    : `${Math.max(4, ((bucket.count || 0) / max) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function AnalyticsDashboard() {
  const navigate = useNavigate();
  const [days, setDays] = useState<RangeDays>(30);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [daily, setDaily] = useState<AnalyticsDailyStat[]>([]);
  const [dimensions, setDimensions] = useState<AnalyticsDimensionBucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [summaryResponse, dailyResponse, dimensionResponse] =
          await Promise.all([
            apiClient.get<AnalyticsSummary>(`/analytics/summary?days=${days}`),
            apiClient.get<AnalyticsDailyStat[]>(`/analytics/daily?days=${days}`),
            apiClient.get<AnalyticsDimensionBucket[]>(
              `/analytics/dimensions?days=${days}`,
            ),
          ]);

        if (!active) return;
        setSummary(summaryResponse.data || null);
        setDaily(dailyResponse.data || []);
        setDimensions(dimensionResponse.data || []);
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && [401, 403].includes(error.statusCode)) {
          toast.error("Analytics administrator access is required");
          navigate("/home", { replace: true });
          return;
        }
        toast.error(
          error instanceof ApiError && error.statusCode === 503
            ? "Analytics are disabled for this deployment"
            : "Analytics could not be loaded",
        );
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [days, navigate]);

  const dimensionsByName = useMemo(() => {
    const grouped = new Map<string, AnalyticsDimensionBucket[]>();
    dimensions.forEach((bucket) => {
      const key = `${bucket.metric}:${bucket.dimension}`;
      grouped.set(key, [...(grouped.get(key) || []), bucket]);
    });
    return grouped;
  }, [dimensions]);

  if (loading && !summary) return <LoadingState />;

  const totals = summary?.totals;
  const cards = [
    ["Successful logins", totals?.logins || 0, "Authentication events"],
    ["Files added", totals?.filesAdded || 0, "Client-reported Drive actions"],
    ["Shares created", totals?.shares || 0, "Encrypted share records"],
    ["Files accessed", totals?.downloads || 0, "Recipient access events"],
  ] as const;

  return (
    <main className="w-full space-y-10 p-6 md:p-10">
      <section className="border px-6 py-8 md:px-10 md:py-12">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="mb-4 text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Private operator view
            </p>
            <h1 className="text-3xl leading-tight md:text-5xl">
              Understand ZeroDrive without tracking its users.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
              Daily aggregate counters from this deployment. These numbers
              count events, not people, and cannot be used to inspect an
              individual account or file.
            </p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Analytics period">
            {RANGES.map((range) => (
              <Button
                key={range}
                size="sm"
                variant={days === range ? "default" : "outline"}
                onClick={() => setDays(range)}
              >
                {range === 365 ? "1 year" : `${range} days`}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Lifecycle outcomes</CardTitle>
          <CardDescription>
            Server-confirmed key and sharing transitions.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Key setups", totals?.keySetups || 0],
            ["Key rotations", totals?.keyRotations || 0],
            ["Shares finalized", totals?.sharesFinalized || 0],
            ["Shares revoked", totals?.sharesRevoked || 0],
            ["Invitations", totals?.invitations || 0],
          ].map(([label, value]) => (
            <div key={label} className="border-l-2 pl-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Overview
            </p>
            <h2 className="mt-2 text-2xl">Last {days} days</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            {summary?.totalEvents || 0} total counted events
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(([label, value, description]) => (
            <Card key={label} className="shadow-none">
              <CardHeader className="pb-3">
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-3xl font-normal">{value}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {description}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Daily activity</CardTitle>
          <CardDescription>
            Up to the latest 30 days are drawn for readability.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DailyBars stats={daily} />
        </CardContent>
      </Card>

      <section>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Coarse distributions
        </p>
        <h2 className="mb-5 mt-2 text-2xl">Patterns without identities</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <DimensionList
            title="Drive action source"
            description="How encrypted files entered Drive."
            buckets={dimensionsByName.get("file_added_to_drive:source") || []}
          />
          <DimensionList
            title="File categories"
            description="Broad categories only; exact MIME types are never retained."
            buckets={
              dimensionsByName.get("file_added_to_drive:file_category") || []
            }
          />
          <DimensionList
            title="Drive file sizes"
            description="Coarse size ranges reported by the client."
            buckets={
              dimensionsByName.get("file_added_to_drive:size_bucket") || []
            }
          />
          <DimensionList
            title="Shared file sizes"
            description="Coarse encrypted-share size ranges."
            buckets={dimensionsByName.get("file_shared:size_bucket") || []}
          />
        </div>
      </section>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Daily counters</CardTitle>
          <CardDescription>
            Aggregate records retained for a maximum of 365 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Logins</TableHead>
                <TableHead className="text-right">New setup</TableHead>
                <TableHead className="text-right">Files</TableHead>
                <TableHead className="text-right">Shares</TableHead>
                <TableHead className="text-right">Finalized</TableHead>
                <TableHead className="text-right">Accessed</TableHead>
                <TableHead className="text-right">Keys</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daily.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No aggregate counters are available for this period.
                  </TableCell>
                </TableRow>
              )}
              {[...daily].reverse().map((stat) => (
                <TableRow key={stat.date}>
                  <TableCell>{formatDate(stat.date)}</TableCell>
                  <TableCell className="text-right">{stat.logins}</TableCell>
                  <TableCell className="text-right">{stat.newUsers}</TableCell>
                  <TableCell className="text-right">{stat.filesAdded}</TableCell>
                  <TableCell className="text-right">{stat.shares}</TableCell>
                  <TableCell className="text-right">
                    {stat.sharesFinalized}
                  </TableCell>
                  <TableCell className="text-right">{stat.downloads}</TableCell>
                  <TableCell className="text-right">
                    {stat.keySetups + stat.keyRotations}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <section className="border-2 px-6 py-7 md:px-8">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Privacy boundary
        </p>
        <h2 className="mt-2 text-xl">What this dashboard cannot show</h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-muted-foreground">
          ZeroDrive does not keep raw analytics events, unique-user counts,
          sessions, emails, IP addresses, filenames, exact file sizes, object
          keys, or sender identities. Buckets containing fewer than five events
          are suppressed in this view.
        </p>
      </section>
    </main>
  );
}
