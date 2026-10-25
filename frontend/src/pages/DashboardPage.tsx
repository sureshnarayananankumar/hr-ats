import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Briefcase,
  Users,
  CalendarCheck,
  FileSignature,
  TrendingUp,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CHART_COLOURS, formatRelative } from '@/lib/utils';
import type { DashboardSummary, PendingActions } from '@/lib/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Skeleton,
  StatCard,
} from '@/components/ui/primitives';

interface StageCount {
  stage: string;
  label: string;
  count: number;
}
interface MonthPoint {
  month: string;
  applications: number;
  hired: number;
}
interface DepartmentRow {
  department: string;
  vacancies: number;
  filled: number;
  remaining: number;
}
interface SourceRow {
  source: string;
  applications: number;
  hired: number;
  conversionRate: number;
}
interface TimeMetrics {
  timeToHire: { definition: string; sampleSize: number; averageDays: number | null; medianDays: number | null };
  timeToFill: { definition: string; sampleSize: number; averageDays: number | null; medianDays: number | null };
}
interface ActivityItem {
  type: string;
  at: string;
  title: string;
  detail: string;
  link: string;
}

/** Shared tooltip styling so every chart reads the same. */
const tooltipStyle = {
  contentStyle: {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '0.5rem',
    fontSize: '0.8125rem',
  },
} as const;

function ChartCard({
  title,
  children,
  isLoading,
  isEmpty,
  emptyMessage = 'No data yet',
  /** Text alternative for users who cannot read the chart visually. */
  summary,
}: {
  title: string;
  children: React.ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  summary?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : isEmpty ? (
          <EmptyState title={emptyMessage} description="Data appears here as recruitment activity is recorded." />
        ) : (
          <>
            <div className="h-64">{children}</div>
            {summary && <p className="sr-only">{summary}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  const summary = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.get<DashboardSummary>('/dashboard/summary'),
  });

  const pending = useQuery({
    queryKey: ['pending-actions'],
    queryFn: () => api.get<PendingActions>('/dashboard/pending-actions'),
  });

  const byStage = useQuery({
    queryKey: ['dashboard', 'stages'],
    queryFn: () => api.get<StageCount[]>('/dashboard/candidates-by-stage'),
  });

  const byMonth = useQuery({
    queryKey: ['dashboard', 'months'],
    queryFn: () => api.get<MonthPoint[]>('/dashboard/applications-by-month', { months: 12 }),
  });

  const byDepartment = useQuery({
    queryKey: ['dashboard', 'departments'],
    queryFn: () => api.get<DepartmentRow[]>('/dashboard/vacancies-by-department'),
  });

  const bySource = useQuery({
    queryKey: ['dashboard', 'sources'],
    queryFn: () => api.get<SourceRow[]>('/dashboard/source-performance'),
  });

  const timeMetrics = useQuery({
    queryKey: ['dashboard', 'time-metrics'],
    queryFn: () => api.get<TimeMetrics>('/dashboard/time-metrics'),
  });

  const activity = useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: () => api.get<ActivityItem[]>('/dashboard/recent-activity', { limit: 12 }),
  });

  const jobs = summary.data?.jobs;
  const candidates = summary.data?.candidates;
  const activeStages = (byStage.data ?? []).filter((row) => row.count > 0);

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user?.firstName ?? ''}`.trim()}
        description="Live recruitment activity across your organisation."
      />

      {/* ---- Pending actions ---- */}
      {pending.data && pending.data.total > 0 && (
        <Card className="mb-6 border-warning/40 bg-warning/5">
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="size-4 text-warning" aria-hidden="true" />
                {pending.data.total} item{pending.data.total === 1 ? '' : 's'} need your attention
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                {pending.data.jobApprovals > 0 && (
                  <Link to="/job-approvals" className="hover:text-foreground hover:underline">
                    {pending.data.jobApprovals} job approval(s)
                  </Link>
                )}
                {pending.data.offerApprovals > 0 && (
                  <Link to="/offers" className="hover:text-foreground hover:underline">
                    {pending.data.offerApprovals} offer approval(s)
                  </Link>
                )}
                {pending.data.pendingFeedback > 0 && (
                  <Link to="/interviews" className="hover:text-foreground hover:underline">
                    {pending.data.pendingFeedback} interview feedback
                  </Link>
                )}
                {pending.data.overdueFollowUps > 0 && (
                  <Link
                    to="/applications?overdueOnly=true"
                    className="hover:text-foreground hover:underline"
                  >
                    {pending.data.overdueFollowUps} overdue follow-up(s)
                  </Link>
                )}
                {pending.data.onboardingTasks > 0 && (
                  <Link to="/onboarding" className="hover:text-foreground hover:underline">
                    {pending.data.onboardingTasks} onboarding task(s)
                  </Link>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---- Headline counters ---- */}
      <section aria-label="Key metrics" className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summary.isLoading ? (
          Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-24" />)
        ) : (
          <>
            <StatCard label="Total job requirements" value={jobs?.total ?? 0} icon={<Briefcase className="size-5" />} />
            <StatCard label="Open positions" value={jobs?.openPositions ?? 0} tone="info" hint="Unfilled vacancies on live jobs" />
            <StatCard label="Pending approvals" value={jobs?.pendingApproval ?? 0} tone={jobs?.pendingApproval ? 'warning' : 'neutral'} />
            <StatCard label="Published jobs" value={jobs?.published ?? 0} tone="success" />

            <StatCard label="On hold" value={jobs?.onHold ?? 0} tone={jobs?.onHold ? 'warning' : 'neutral'} />
            <StatCard label="Closed jobs" value={jobs?.closed ?? 0} />
            <StatCard label="Total candidates" value={candidates?.total ?? 0} icon={<Users className="size-5" />} />
            <StatCard label="New applications" value={candidates?.newApplications ?? 0} tone="info" hint="Last 7 days" />

            <StatCard label="Under screening" value={candidates?.underScreening ?? 0} />
            <StatCard label="Shortlisted" value={candidates?.shortlisted ?? 0} tone="info" />
            <StatCard label="Interviews scheduled" value={summary.data?.interviews.scheduled ?? 0} icon={<CalendarCheck className="size-5" />} />
            <StatCard label="Offers released" value={summary.data?.offers.released ?? 0} icon={<FileSignature className="size-5" />} />

            <StatCard label="Offers accepted" value={summary.data?.offers.accepted ?? 0} tone="success" />
            <StatCard label="Hired" value={candidates?.hired ?? 0} tone="success" icon={<TrendingUp className="size-5" />} />
            <StatCard label="Rejected" value={candidates?.rejected ?? 0} tone="danger" />
            <StatCard label="Withdrawn" value={candidates?.withdrawn ?? 0} />
          </>
        )}
      </section>

      {/* ---- Time metrics ---- */}
      <section className="mb-6 grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 size-5 text-muted-foreground" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Average time to hire</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {timeMetrics.data?.timeToHire.averageDays ?? '—'}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">days</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {timeMetrics.data?.timeToHire.definition ?? 'Applied → hired'}
                  {timeMetrics.data ? ` · based on ${timeMetrics.data.timeToHire.sampleSize} hire(s)` : ''}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 size-5 text-muted-foreground" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Average time to fill</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {timeMetrics.data?.timeToFill.averageDays ?? '—'}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">days</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {timeMetrics.data?.timeToFill.definition ?? 'Published → hired'}
                  {timeMetrics.data ? ` · based on ${timeMetrics.data.timeToFill.sampleSize} hire(s)` : ''}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ---- Charts ---- */}
      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Applications by month"
          isLoading={byMonth.isLoading}
          isEmpty={!byMonth.data?.some((row) => row.applications > 0)}
          summary={`Monthly applications: ${(byMonth.data ?? []).map((r) => `${r.month}: ${r.applications}`).join(', ')}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={byMonth.data ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
              <Line type="monotone" dataKey="applications" name="Applications" stroke={CHART_COLOURS[0]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="hired" name="Hired" stroke={CHART_COLOURS[1]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Candidates by recruitment stage"
          isLoading={byStage.isLoading}
          isEmpty={activeStages.length === 0}
          summary={`Candidates per stage: ${activeStages.map((r) => `${r.label}: ${r.count}`).join(', ')}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={activeStages} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" name="Candidates" radius={[0, 4, 4, 0]}>
                {activeStages.map((_, index) => (
                  <Cell key={index} fill={CHART_COLOURS[index % CHART_COLOURS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Vacancies by department"
          isLoading={byDepartment.isLoading}
          isEmpty={(byDepartment.data ?? []).length === 0}
          summary={`Vacancies per department: ${(byDepartment.data ?? []).map((r) => `${r.department}: ${r.remaining} remaining of ${r.vacancies}`).join(', ')}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byDepartment.data ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="department" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
              <Bar dataKey="filled" name="Filled" stackId="a" fill={CHART_COLOURS[1]} />
              <Bar dataKey="remaining" name="Remaining" stackId="a" fill={CHART_COLOURS[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Recruitment source performance"
          isLoading={bySource.isLoading}
          isEmpty={!bySource.data?.some((row) => row.applications > 0)}
          summary={`Applications by source: ${(bySource.data ?? []).map((r) => `${r.source}: ${r.applications}`).join(', ')}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={(bySource.data ?? []).filter((row) => row.applications > 0)}
                dataKey="applications"
                nameKey="source"
                cx="50%"
                cy="50%"
                outerRadius={85}
                label={(entry: { source: string }) => entry.source}
                labelLine={false}
                style={{ fontSize: '0.6875rem' }}
              >
                {(bySource.data ?? []).map((_, index) => (
                  <Cell key={index} fill={CHART_COLOURS[index % CHART_COLOURS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* ---- Recent activity ---- */}
      <section className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            ) : (activity.data ?? []).length === 0 ? (
              <EmptyState title="No activity yet" description="Actions across jobs, applications and interviews appear here." />
            ) : (
              <ul className="divide-y">
                {activity.data!.map((item, index) => (
                  <li key={index}>
                    <Link
                      to={item.link}
                      className="flex items-start justify-between gap-4 py-2.5 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                      </div>
                      <time className="shrink-0 text-xs text-muted-foreground" dateTime={item.at}>
                        {formatRelative(item.at)}
                      </time>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
