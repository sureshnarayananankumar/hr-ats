import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { daysSince, formatDate, formatExperience, humanise } from '@/lib/utils';
import type { JobRequirement, Paginated } from '@/lib/types';
import { Badge, Button, PageHeader } from '@/components/ui/primitives';
import { DataTable, type Column } from '@/components/ui/data-table';

/** Live jobs only — the operational counterpart of the careers portal. */
export default function PublishedJobsPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', 'published'],
    queryFn: () =>
      api.get<Paginated<JobRequirement>>('/jobs', {
        status: 'PUBLISHED',
        pageSize: 50,
        sortBy: 'publishedAt',
        sortDir: 'desc',
      }),
  });

  const columns: Array<Column<JobRequirement>> = [
    {
      key: 'title',
      header: 'Job',
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
        <span className="text-sm">
          {job.location} · {humanise(job.workMode)}
        </span>
      ),
    },
    {
      key: 'experience',
      header: 'Experience',
      hideOnMobile: true,
      render: (job) => <span className="text-sm">{formatExperience(job.minExperience, job.maxExperience)}</span>,
    },
    {
      key: 'applications',
      header: 'Applicants',
      render: (job) => (
        <span className="inline-flex items-center gap-1 text-sm tabular-nums">
          <Users className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {job.applicationCount ?? 0}
        </span>
      ),
    },
    {
      key: 'fill',
      header: 'Filled',
      render: (job) => (
        <span className="text-sm tabular-nums">
          {job.vacanciesFilled}/{job.vacancies}
        </span>
      ),
    },
    {
      key: 'live',
      header: 'Live for',
      hideOnMobile: true,
      render: (job) => {
        const days = daysSince(job.publishedAt);
        return <span className="text-xs text-muted-foreground">{days === null ? '—' : `${days} day(s)`}</span>;
      },
    },
    {
      key: 'deadline',
      header: 'Deadline',
      hideOnMobile: true,
      render: (job) => {
        if (!job.applicationDeadline) return <span className="text-xs text-muted-foreground">None</span>;
        const expired = new Date(job.applicationDeadline) < new Date();
        return (
          <Badge tone={expired ? 'danger' : 'neutral'}>
            {expired ? 'Expired' : formatDate(job.applicationDeadline)}
          </Badge>
        );
      },
    },
    {
      key: 'public',
      header: '',
      render: (job) => (
        <Link
          to={`/careers/${job.slug}`}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View public page
          <ExternalLink className="size-3" aria-hidden="true" />
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Published Jobs"
        description="Live vacancies currently visible on the careers portal."
        actions={
          <Button variant="outline" size="sm" onClick={() => window.open('/careers', '_blank')} leftIcon={<ExternalLink />}>
            Open careers portal
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(job) => job.id}
        isLoading={isLoading}
        onRowClick={(job) => navigate(`/jobs/${job.id}`)}
        caption="Published job requirements"
        emptyTitle="No published jobs"
        emptyDescription="Approve and publish a requirement to list it on the careers portal."
      />
    </>
  );
}
