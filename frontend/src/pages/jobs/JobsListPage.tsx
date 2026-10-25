import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Download, Search, Briefcase } from 'lucide-react';
import { api, downloadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatExperience, humanise } from '@/lib/utils';
import type { JobRequirement, JobStatus, Paginated } from '@/lib/types';
import { Button, Card, Field, Input, PageHeader } from '@/components/ui/primitives';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Select } from '@/components/ui/select';
import { JobStatusBadge, PriorityBadge } from '@/components/ui/status';
import { useToast } from '@/components/ui/feedback';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'ON_HOLD', 'CLOSED', 'CANCELLED'] as JobStatus[]).map(
    (value) => ({ value, label: humanise(value) }),
  ),
];

export default function JobsListPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get('page') ?? '1');
  const status = searchParams.get('status') ?? '';
  const search = searchParams.get('search') ?? '';
  const sortBy = searchParams.get('sortBy') ?? 'createdAt';
  const sortDir = (searchParams.get('sortDir') ?? 'desc') as 'asc' | 'desc';

  const [searchInput, setSearchInput] = useState(search);
  const [isExporting, setIsExporting] = useState(false);

  const updateParams = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    }
    // Any filter change invalidates the current page number.
    if (!('page' in changes)) next.delete('page');
    setSearchParams(next);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', { page, status, search, sortBy, sortDir }],
    queryFn: () =>
      api.get<Paginated<JobRequirement>>('/jobs', {
        page,
        pageSize: 20,
        status: status || undefined,
        search: search || undefined,
        sortBy,
        sortDir,
      }),
  });

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setIsExporting(true);
    try {
      await downloadFile(
        '/jobs/export',
        `job-requirements.${format}`,
        { format, status: status || undefined, search: search || undefined },
      );
    } catch {
      toast.error('Export failed', 'You may not have permission to export job data.');
    } finally {
      setIsExporting(false);
    }
  };

  const columns: Array<Column<JobRequirement>> = [
    {
      key: 'code',
      header: 'Requirement',
      sortKey: 'requirementCode',
      render: (job) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{job.title}</p>
          <p className="font-mono text-xs text-muted-foreground">{job.requirementCode}</p>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      hideOnMobile: true,
      render: (job) => <span className="text-sm">{job.department?.name ?? '—'}</span>,
    },
    {
      key: 'location',
      header: 'Location',
      hideOnMobile: true,
      render: (job) => (
        <div className="text-sm">
          <p>{job.location}</p>
          <p className="text-xs text-muted-foreground">{humanise(job.workMode)}</p>
        </div>
      ),
    },
    {
      key: 'experience',
      header: 'Experience',
      hideOnMobile: true,
      render: (job) => (
        <span className="text-sm">{formatExperience(job.minExperience, job.maxExperience)}</span>
      ),
    },
    {
      key: 'vacancies',
      header: 'Vacancies',
      render: (job) => (
        <span className="text-sm tabular-nums">
          {job.vacanciesFilled}/{job.vacancies}
        </span>
      ),
    },
    {
      key: 'applications',
      header: 'Applicants',
      hideOnMobile: true,
      render: (job) => <span className="text-sm tabular-nums">{job.applicationCount ?? 0}</span>,
    },
    { key: 'priority', header: 'Priority', hideOnMobile: true, render: (job) => <PriorityBadge priority={job.priority} /> },
    { key: 'status', header: 'Status', sortKey: 'status', render: (job) => <JobStatusBadge status={job.status} /> },
    {
      key: 'created',
      header: 'Created',
      sortKey: 'createdAt',
      hideOnMobile: true,
      render: (job) => <span className="text-xs text-muted-foreground">{formatDate(job.createdAt)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Job Requirements"
        description="Create, approve and publish hiring requirements."
        actions={
          <>
            {can('job.export') && (
              <>
                <Button variant="outline" size="sm" onClick={() => void handleExport('csv')} isLoading={isExporting} leftIcon={<Download />}>
                  CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => void handleExport('xlsx')} isLoading={isExporting}>
                  Excel
                </Button>
              </>
            )}
            {can('job.create') && (
              <Button onClick={() => navigate('/jobs/new')} leftIcon={<Plus />}>
                New requirement
              </Button>
            )}
          </>
        }
      />

      <Card className="mb-4 p-4">
        <form
          className="grid gap-3 sm:grid-cols-[1fr_12rem]"
          onSubmit={(event) => {
            event.preventDefault();
            updateParams({ search: searchInput });
          }}
        >
          <Field label="Search" htmlFor="job-search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="job-search"
                className="pl-8"
                placeholder="Title, code, designation or location"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
          </Field>

          <Field label="Status" htmlFor="job-status">
            <Select
              id="job-status"
              value={status}
              onValueChange={(value) => updateParams({ status: value })}
              options={STATUS_OPTIONS}
              aria-label="Filter by status"
            />
          </Field>
        </form>
      </Card>

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(job) => job.id}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={(next) => updateParams({ page: next })}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={(by, dir) => updateParams({ sortBy: by, sortDir: dir })}
        onRowClick={(job) => navigate(`/jobs/${job.id}`)}
        caption="Job requirements"
        emptyTitle="No job requirements found"
        emptyDescription={
          search || status
            ? 'Try removing a filter to widen your search.'
            : 'Create your first requirement to start hiring.'
        }
        emptyAction={
          can('job.create') ? (
            <Button onClick={() => navigate('/jobs/new')} leftIcon={<Briefcase />}>
              New requirement
            </Button>
          ) : undefined
        }
      />

      {data && data.meta.totalItems > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Showing {data.data.length} of {data.meta.totalItems} requirement(s).{' '}
          <Link to="/published-jobs" className="text-primary hover:underline">
            View published jobs
          </Link>
        </p>
      )}
    </>
  );
}
