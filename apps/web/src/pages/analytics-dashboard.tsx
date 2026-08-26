import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { format, startOfDay, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import type {
  AnalyticsDailyStat,
  AnalyticsDimensionBucket,
  AnalyticsMonthlyStat,
  AnalyticsSummary,
} from "@zerodrive/shared-types";
import { userNotifications as toast } from "../utils/userNotifications";
import apiClient, { ApiError } from "../utils/apiClient";
import { Button } from "../components/ui/button";
import { Calendar } from "../components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
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
import { docsPages } from "../components/docs/docs-content";

const utcTodayParts = new Date()
  .toISOString()
  .slice(0, 10)
  .split("-")
  .map(Number);
const today = startOfDay(
  new Date(utcTodayParts[0], utcTodayParts[1] - 1, utcTodayParts[2]),
);
const initialRange: DateRange = { from: subDays(today, 29), to: today };

const DOCS_PAGE_LABELS = Object.fromEntries(
  docsPages
    .filter((page) => page.analyticsKey)
    .map((page) => [page.analyticsKey, `Docs · ${page.title}`]),
);

const PAGE_LABELS: Readonly<Record<string, string>> = {
  landing: "Landing page",
  home: "Home",
  storage: "Storage",
  share: "Share files",
  shared_with_me: "Shared with me",
  recovery_access: "Recovery & Access",
  docs: "Docs overview",
  ...DOCS_PAGE_LABELS,
  privacy: "Privacy Policy",
  terms: "Terms of Service",
};

export function analyticsPageLabel(bucket: string): string {
  return PAGE_LABELS[bucket] || bucket;
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(`${date.slice(0, 10)}T00:00:00`));
}

function formatRangeLabel(range: DateRange): string {
  if (!range.from) return "Choose dates";
  if (!range.to) return format(range.from, "d MMM yyyy");
  return `${format(range.from, "d MMM yyyy")} – ${format(range.to, "d MMM yyyy")}`;
}

function toQuery(range: DateRange): string {
  const from = range.from || today;
  const to = range.to || from;
  return `from=${format(from, "yyyy-MM-dd")}&to=${format(to, "yyyy-MM-dd")}`;
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
        day.pageViews +
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
      <div className="flex h-56 min-w-[680px] gap-2 border-b px-2 pt-4">
        {visible.map((day) => {
          const total =
            day.logins +
            day.pageViews +
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
              className="group flex h-full min-w-0 flex-1 flex-col items-center gap-2"
              aria-label={`${formatDate(day.date)}: ${total} counted events`}
            >
              <span className="text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                {total}
              </span>
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full bg-card-foreground/85 transition-colors group-hover:bg-primary"
                  style={{ height: `${height}%` }}
                  title={`${formatDate(day.date)}: ${total} counted events`}
                />
              </div>
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
  labelForBucket = (bucket) => bucket,
}: {
  title: string;
  description: string;
  buckets: AnalyticsDimensionBucket[];
  labelForBucket?: (bucket: string) => string;
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
              <span className="truncate">{labelForBucket(bucket.bucket)}</span>
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
  const [range, setRange] = useState<DateRange>(initialRange);
  const [draftRange, setDraftRange] = useState<DateRange>(initialRange);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [daily, setDaily] = useState<AnalyticsDailyStat[]>([]);
  const [dimensions, setDimensions] = useState<AnalyticsDimensionBucket[]>([]);
  const [monthly, setMonthly] = useState<AnalyticsMonthlyStat[]>([]);
  const [monthlyDimensions, setMonthlyDimensions] = useState<
    AnalyticsDimensionBucket[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const query = toQuery(range);
        const [
          summaryResponse,
          dailyResponse,
          dimensionResponse,
          monthlyResponse,
          monthlyDimensionResponse,
        ] =
          await Promise.all([
            apiClient.get<AnalyticsSummary>(`/analytics/summary?${query}`),
            apiClient.get<AnalyticsDailyStat[]>(
              `/analytics/daily?${query}`,
            ),
            apiClient.get<AnalyticsDimensionBucket[]>(
              `/analytics/dimensions?${query}`,
            ),
            apiClient.get<AnalyticsMonthlyStat[]>("/analytics/monthly"),
            apiClient.get<AnalyticsDimensionBucket[]>(
              "/analytics/monthly/dimensions",
            ),
          ]);

        if (!active) return;
        setSummary(summaryResponse.data || null);
        setDaily(dailyResponse.data || []);
        setDimensions(dimensionResponse.data || []);
        setMonthly(monthlyResponse.data || []);
        setMonthlyDimensions(monthlyDimensionResponse.data || []);
      } catch (error) {
        if (!active) return;
        if (
          error instanceof ApiError &&
          [401, 403].includes(error.statusCode)
        ) {
          toast.error("Analytics administrator access is required", {
            id: "analytics:load",
          });
          navigate("/home", { replace: true });
          return;
        }
        toast.error(
          error instanceof ApiError && error.statusCode === 503
            ? "Analytics are disabled for this deployment"
            : "Analytics could not be loaded",
          { id: "analytics:load" },
        );
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [navigate, range]);

  const dimensionsByName = useMemo(() => {
    const grouped = new Map<string, AnalyticsDimensionBucket[]>();
    dimensions.forEach((bucket) => {
      const key = `${bucket.metric}:${bucket.dimension}`;
      grouped.set(key, [...(grouped.get(key) || []), bucket]);
    });
    return grouped;
  }, [dimensions]);

  const longTermPageViews = useMemo(
    () =>
      monthlyDimensions.filter(
        (bucket) =>
          bucket.metric === "page_view" && bucket.dimension === "page",
      ),
    [monthlyDimensions],
  );

  if (loading && !summary) return <LoadingState />;

  const totals = summary?.totals;
  const cards = [
    ["Page views", totals?.pageViews || 0, "Allowlisted page visits"],
    ["Successful logins", totals?.logins || 0, "Authentication events"],
    ["Files added", totals?.filesAdded || 0, "Client-reported Drive actions"],
    ["Shares created", totals?.shares || 0, "Encrypted share records"],
    ["Files accessed", totals?.downloads || 0, "Recipient access events"],
  ] as const;

  const applyPresetRange = (days: number) => {
    const next = { from: subDays(today, days - 1), to: today };
    setDraftRange(next);
    setRange(next);
    setRangeOpen(false);
  };

  const applyDraftRange = () => {
    if (!draftRange.from || !draftRange.to) return;
    setRange(draftRange);
    setRangeOpen(false);
  };

  return (
    <main className="w-full space-y-10">
      <section className="mx-auto max-w-5xl py-8 text-center md:py-14">

        <h1 className="text-3xl leading-tight md:text-4xl">
          Understand ZeroDrive <br/> without tracking its users.
        </h1>
        <p className="mx-auto mt-5 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
          Aggregate counters from this deployment. These numbers count events,
          not people, and cannot be used to inspect an individual account or
          file.
        </p>

        <div className="mt-8 flex justify-center" aria-label="Analytics period">
          <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-[260px] justify-start">
                <CalendarDays aria-hidden="true" />
                {formatRangeLabel(range)}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="center" className="w-auto p-4">
              <div className="mb-4 flex flex-wrap gap-2">
                {[7, 30, 90, 365].map((days) => (
                  <Button
                    key={days}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => applyPresetRange(days)}
                  >
                    {days === 365 ? "1 year" : `${days} days`}
                  </Button>
                ))}
              </div>
              <Calendar
                mode="range"
                selected={draftRange}
                onSelect={(next) =>
                  setDraftRange(next || { from: undefined, to: undefined })
                }
                defaultMonth={draftRange.from}
                fromDate={subDays(today, 399)}
                toDate={today}
                disabled={{ after: today, before: subDays(today, 399) }}
                numberOfMonths={2}
                showOutsideDays
              />
              <div className="mt-4 flex items-center justify-between gap-4 border-t pt-4">
                <p className="text-xs text-muted-foreground">
                  Exact daily data is available for 400 days.
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={!draftRange.from || !draftRange.to}
                  onClick={applyDraftRange}
                >
                  Apply dates
                </Button>
              </div>
            </PopoverContent>
          </Popover>
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
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Page attention
        </p>
        <h2 className="mb-5 mt-2 text-2xl">Where ZeroDrive is being used</h2>
        <DimensionList
          title="Page views"
          description="Aggregate visits to reviewed product and documentation pages. No visitor, session, raw URL, query string, or referrer is stored."
          buckets={dimensionsByName.get("page_view:page") || []}
          labelForBucket={analyticsPageLabel}
        />
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Overview
            </p>
            <h2 className="mt-2 text-2xl">{formatRangeLabel(range)}</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            {summary?.totalEvents || 0} total counted events
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
            Exact daily records retained for the latest 400-day window.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Logins</TableHead>
                <TableHead className="text-right">Views</TableHead>
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
                  <TableCell
                    colSpan={9}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No aggregate counters are available for this period.
                  </TableCell>
                </TableRow>
              )}
              {[...daily].reverse().map((stat) => (
                <TableRow key={stat.date}>
                  <TableCell>{formatDate(stat.date)}</TableCell>
                  <TableCell className="text-right">{stat.logins}</TableCell>
                  <TableCell className="text-right">{stat.pageViews}</TableCell>
                  <TableCell className="text-right">{stat.newUsers}</TableCell>
                  <TableCell className="text-right">
                    {stat.filesAdded}
                  </TableCell>
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

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Monthly archive</CardTitle>
          <CardDescription>
            A month-by-month view of older analytics. Daily counters are kept
            for 400 days, then combined into privacy-safe monthly totals that
            do not expire automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Page views</TableHead>
                <TableHead className="text-right">Recorded events</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthly.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No monthly rollups yet. The first appears when daily data
                    becomes older than 400 days.
                  </TableCell>
                </TableRow>
              )}
              {[...monthly].reverse().map((stat) => (
                <TableRow key={stat.month}>
                  <TableCell>
                    {new Intl.DateTimeFormat(undefined, {
                      month: "long",
                      year: "numeric",
                      timeZone: "UTC",
                    }).format(new Date(`${stat.month}T00:00:00Z`))}
                  </TableCell>
                  <TableCell className="text-right">
                    {stat.pageViews}
                  </TableCell>
                  <TableCell className="text-right">
                    {stat.totalEvents}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DimensionList
        title="Archived page views by page"
        description="Page-view totals grouped by page across the complete monthly archive. This uses the same archived data shown above."
        buckets={longTermPageViews}
        labelForBucket={analyticsPageLabel}
      />

      <section className="border-2 px-6 py-7 md:px-8">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Privacy boundary
        </p>
        <h2 className="mt-2 text-xl">What this dashboard cannot show</h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-muted-foreground">
          ZeroDrive does not keep raw analytics events, unique-user counts,
          sessions, emails, IP addresses, filenames, exact file sizes, object
          keys, sender identities, raw URLs, query strings, or referrers.
          Buckets containing fewer than five events are suppressed in this view.
        </p>
      </section>
    </main>
  );
}
