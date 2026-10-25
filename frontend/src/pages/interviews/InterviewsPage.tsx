import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTime, humanise } from '@/lib/utils';
import type { Interview, Paginated } from '@/lib/types';
import { Button, Card, CardContent, CardHeader, CardTitle, Field, PageHeader } from '@/components/ui/primitives';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Select } from '@/components/ui/select';
import { InterviewStatusBadge } from '@/components/ui/status';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...['SCHEDULED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map((value) => ({
    value,
    label: humanise(value),
  })),
];

export default function InterviewsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? '';
  const page = Number(searchParams.get('page') ?? '1');

  const { data, isLoading } = useQuery({
    queryKey: ['interviews', { status, page }],
    queryFn: () =>
      api.get<Paginated<Interview>>('/interviews', {
        page,
        pageSize: 20,
        status: status || undefined,
        sortDir: 'desc',
      }),
  });

  // Interviews I personally still owe feedback on.
  const pendingFeedback = useQuery({
    queryKey: ['interviews', 'pending-feedback'],
    queryFn: () => api.get<Interview[]>('/interviews/my-pending-feedback'),
    retry: false,
  });

  const columns: Array<Column<Interview>> = [
    {
      key: 'candidate',
      header: 'Candidate',
      render: (interview) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{interview.candidate?.fullName ?? '—'}</p>
          <p className="font-mono text-xs text-muted-foreground">{interview.interviewCode}</p>
        </div>
      ),
    },
    {
      key: 'job',
      header: 'Job',
      hideOnMobile: true,
      render: (interview) => <span className="text-sm">{interview.job?.title ?? '—'}</span>,
    },
    {
      key: 'round',
      header: 'Round',
      render: (interview) => (
        <div className="text-sm">
          <p>{interview.roundName}</p>
          <p className="text-xs text-muted-foreground">{humanise(interview.interviewType)}</p>
        </div>
      ),
    },
    {
      key: 'when',
      header: 'Scheduled',
      render: (interview) => (
        <div className="text-sm">
          <p>{formatDateTime(interview.scheduledStart)}</p>
          <p className="text-xs text-muted-foreground">{interview.timeZone}</p>
        </div>
      ),
    },
    {
      key: 'panel',
      header: 'Panel',
      hideOnMobile: true,
      render: (interview) =>
        interview.panel ? (
          <span className="text-sm">
            {interview.panel
              .slice(0, 2)
              .map((member) => `${member.interviewer.firstName} ${member.interviewer.lastName}`)
              .join(', ')}
            {interview.panel.length > 2 && ` +${interview.panel.length - 2}`}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'feedback',
      header: 'Feedback',
      hideOnMobile: true,
      render: (interview) =>
        interview._count ? (
          <span className="text-sm tabular-nums">
            {interview._count.feedback}/{interview.panel?.length ?? 0}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { key: 'status', header: 'Status', render: (interview) => <InterviewStatusBadge status={interview.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Interviews"
        description="Scheduled interviews and feedback status."
      />

      {pendingFeedback.data && pendingFeedback.data.length > 0 && (
        <Card className="mb-4 border-warning/40 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ClipboardList className="size-4 text-warning" aria-hidden="true" />
              {pendingFeedback.data.length} interview(s) awaiting your feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {pendingFeedback.data.map((interview) => (
                <li key={interview.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {interview.candidate?.fullName} — {interview.roundName}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(interview.scheduledStart)}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/interviews/${interview.id}`)}>
                    Submit feedback
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="mb-4 p-4">
        <Field label="Status" htmlFor="interview-status" className="max-w-xs">
          <Select
            id="interview-status"
            value={status}
            onValueChange={(value) => {
              const next = new URLSearchParams(searchParams);
              if (value) next.set('status', value);
              else next.delete('status');
              next.delete('page');
              setSearchParams(next);
            }}
            options={STATUS_OPTIONS}
          />
        </Field>
      </Card>

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(interview) => interview.id}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={(next) => {
          const params = new URLSearchParams(searchParams);
          params.set('page', String(next));
          setSearchParams(params);
        }}
        onRowClick={(interview) => navigate(`/interviews/${interview.id}`)}
        caption="Interviews"
        emptyTitle="No interviews scheduled"
        emptyDescription="Schedule interviews from an application's detail page."
      />
    </>
  );
}
