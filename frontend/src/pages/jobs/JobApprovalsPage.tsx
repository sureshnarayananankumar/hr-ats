import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatRelative } from '@/lib/utils';
import type { JobApproval } from '@/lib/types';
import { Button, PageHeader } from '@/components/ui/primitives';
import { DataTable, type Column } from '@/components/ui/data-table';
import { PriorityBadge } from '@/components/ui/status';

export default function JobApprovalsPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['job-approvals'],
    queryFn: () => api.get<JobApproval[]>('/jobs/pending-approvals'),
  });

  const columns: Array<Column<JobApproval>> = [
    {
      key: 'job',
      header: 'Requirement',
      render: (approval) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{approval.job?.title}</p>
          <p className="font-mono text-xs text-muted-foreground">{approval.job?.requirementCode}</p>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      hideOnMobile: true,
      render: (approval) => <span className="text-sm">{approval.job?.department?.name ?? '—'}</span>,
    },
    {
      key: 'requestedBy',
      header: 'Requested by',
      hideOnMobile: true,
      render: (approval) => (
        <span className="text-sm">
          {approval.job?.requestedBy
            ? `${approval.job.requestedBy.firstName} ${approval.job.requestedBy.lastName}`
            : '—'}
        </span>
      ),
    },
    {
      key: 'vacancies',
      header: 'Vacancies',
      hideOnMobile: true,
      render: (approval) => <span className="text-sm tabular-nums">{approval.job?.vacancies ?? '—'}</span>,
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (approval) =>
        approval.job?.priority ? <PriorityBadge priority={approval.job.priority} /> : null,
    },
    {
      key: 'waiting',
      header: 'Waiting',
      render: (approval) => (
        <span className="text-xs text-muted-foreground">{formatRelative(approval.createdAt)}</span>
      ),
    },
    {
      key: 'action',
      header: '',
      render: (approval) => (
        <Button
          size="sm"
          variant="outline"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/jobs/${approval.jobId}`);
          }}
        >
          Review
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Job Approvals"
        description="Requirements waiting on your decision."
      />

      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(approval) => approval.id}
        isLoading={isLoading}
        onRowClick={(approval) => navigate(`/jobs/${approval.jobId}`)}
        caption="Job requirements awaiting your approval"
        emptyTitle="Nothing awaiting your approval"
        emptyDescription="Requirements submitted to you will appear here."
      />
    </>
  );
}
