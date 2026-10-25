import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, MapPin, Clock, Search, Building2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatExperience, formatSalaryRange, humanise } from '@/lib/utils';
import type { Paginated, PublicJob } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Field,
  Input,
  Skeleton,
} from '@/components/ui/primitives';
import { Select } from '@/components/ui/select';
import { Logo } from '@/components/ui/Logo';

const EMPLOYMENT_OPTIONS = [
  { value: '', label: 'Any type' },
  ...['FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERNSHIP', 'FREELANCE'].map((value) => ({
    value,
    label: humanise(value),
  })),
];

const WORK_MODE_OPTIONS = [
  { value: '', label: 'Any work mode' },
  ...['ONSITE', 'REMOTE', 'HYBRID'].map((value) => ({ value, label: humanise(value) })),
];

/** Public careers portal. No authentication required. */
export default function CareersListPage() {
  const { isAuthenticated, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('search') ?? '';
  const location = searchParams.get('location') ?? '';
  const employmentType = searchParams.get('employmentType') ?? '';
  const workMode = searchParams.get('workMode') ?? '';
  const page = Number(searchParams.get('page') ?? '1');

  const [form, setForm] = useState({ search, location });

  const { data, isLoading } = useQuery({
    queryKey: ['public-jobs', { search, location, employmentType, workMode, page }],
    queryFn: () =>
      api.get<Paginated<PublicJob>>('/public/jobs', {
        page,
        pageSize: 12,
        search: search || undefined,
        location: location || undefined,
        employmentType: employmentType || undefined,
        workMode: workMode || undefined,
      }),
  });

  const departments = useQuery({
    queryKey: ['public-departments'],
    queryFn: () => api.get<Array<{ id: string; name: string; openPositions: number }>>('/public/departments'),
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setSearchParams(next);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ---- Public header ---- */}
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/careers" className="flex items-center gap-3">
            <Logo width={160} />
            <span className="hidden border-l pl-3 text-sm text-muted-foreground sm:inline">
              Careers
            </span>
          </Link>

          <nav className="flex items-center gap-2" aria-label="Account">
            {isAuthenticated ? (
              <>
                <span className="hidden text-sm text-muted-foreground sm:inline">
                  {user?.firstName}
                </span>
                <Button size="sm" variant="outline" onClick={() => (window.location.href = '/portal/applications')}>
                  My applications
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => (window.location.href = '/login')}>
                  Sign in
                </Button>
                <Button size="sm" onClick={() => (window.location.href = '/register')}>
                  Create account
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ---- Hero ---- */}
      <section className="border-b bg-muted/30 py-12">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Build your career with Business Gateways
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            We build the B2B e-procurement and supply-chain platforms used by
            government entities and leading private-sector organisations across Oman
            and the wider Gulf. Explore our open positions and apply in a few minutes.
          </p>

          <form
            className="mx-auto mt-6 flex max-w-2xl flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              const next = new URLSearchParams(searchParams);
              if (form.search) next.set('search', form.search); else next.delete('search');
              if (form.location) next.set('location', form.location); else next.delete('location');
              next.delete('page');
              setSearchParams(next);
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                className="h-11 pl-9"
                placeholder="Job title or skill"
                aria-label="Search jobs"
                value={form.search}
                onChange={(event) => setForm({ ...form, search: event.target.value })}
              />
            </div>
            <div className="relative flex-1">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                className="h-11 pl-9"
                placeholder="Location"
                aria-label="Filter by location"
                value={form.location}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
              />
            </div>
            <Button type="submit" size="lg">Search jobs</Button>
          </form>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
          {/* ---- Filters ---- */}
          <aside className="space-y-4" aria-label="Filters">
            <Field label="Employment type" htmlFor="filter-type">
              <Select
                id="filter-type"
                value={employmentType}
                onValueChange={(value) => setParam('employmentType', value)}
                options={EMPLOYMENT_OPTIONS}
              />
            </Field>

            <Field label="Work mode" htmlFor="filter-mode">
              <Select
                id="filter-mode"
                value={workMode}
                onValueChange={(value) => setParam('workMode', value)}
                options={WORK_MODE_OPTIONS}
              />
            </Field>

            {(departments.data?.length ?? 0) > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-medium">Departments</h2>
                <ul className="space-y-1 text-sm">
                  {departments.data!.map((department) => (
                    <li key={department.id}>
                      <button
                        type="button"
                        onClick={() => setParam('department', department.name)}
                        className="flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-left text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="truncate">{department.name}</span>
                        <span className="tabular-nums">{department.openPositions}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>

          {/* ---- Results ---- */}
          <section aria-label="Job openings">
            <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
              {isLoading ? 'Searching…' : `${data?.meta.totalItems ?? 0} open position(s)`}
            </p>

            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-32 w-full" />
                ))}
              </div>
            ) : (data?.data.length ?? 0) === 0 ? (
              <Card>
                <EmptyState
                  icon={<Briefcase className="size-6" />}
                  title="No positions match your search"
                  description="Try a different keyword or clear your filters."
                  action={
                    <Button variant="outline" onClick={() => setSearchParams(new URLSearchParams())}>
                      Clear filters
                    </Button>
                  }
                />
              </Card>
            ) : (
              <ul className="space-y-3">
                {data!.data.map((job) => (
                  <li key={job.id}>
                    <Card className="transition-shadow hover:shadow-md">
                      <CardContent className="pt-5">
                        <Link to={`/careers/${job.slug}`} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <h3 className="text-base font-semibold text-foreground hover:text-primary">
                            {job.title}
                          </h3>
                        </Link>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          {job.department && (
                            <span className="inline-flex items-center gap-1">
                              <Building2 className="size-3.5" aria-hidden="true" />
                              {job.department}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3.5" aria-hidden="true" />
                            {job.location}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3.5" aria-hidden="true" />
                            {formatExperience(job.minExperience, job.maxExperience)}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge tone="info">{humanise(job.employmentType)}</Badge>
                          <Badge>{humanise(job.workMode)}</Badge>
                          {job.salaryDisclosed && (
                            <Badge tone="success">
                              {formatSalaryRange(job.salaryMin, job.salaryMax, job.salaryCurrency ?? 'USD')}
                            </Badge>
                          )}
                          {job.vacancies > 1 && <Badge>{job.vacancies} openings</Badge>}
                        </div>

                        {job.skills.length > 0 && (
                          <p className="mt-3 text-xs text-muted-foreground">
                            {job.skills.slice(0, 6).join(' · ')}
                          </p>
                        )}

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <span className="text-xs text-muted-foreground">
                            Posted {formatDate(job.publishedAt)}
                            {job.applicationDeadline && ` · closes ${formatDate(job.applicationDeadline)}`}
                          </span>
                          <Button size="sm" onClick={() => (window.location.href = `/careers/${job.slug}`)}>
                            View &amp; apply
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}

            {data && data.meta.totalPages > 1 && (
              <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Pagination">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.meta.hasPreviousPage}
                  onClick={() => setParam('page', String(page - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {data.meta.page} of {data.meta.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.meta.hasNextPage}
                  onClick={() => setParam('page', String(page + 1))}
                >
                  Next
                </Button>
              </nav>
            )}
          </section>
        </div>
      </main>

      <footer className="border-t py-6">
        <p className="text-center text-xs text-muted-foreground">
          © 2026 Business Gateways. Your personal data is handled in line with our privacy policy.
        </p>
      </footer>
    </div>
  );
}
