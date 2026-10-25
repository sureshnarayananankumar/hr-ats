import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate, humanise } from '@/lib/utils';
import type { OnboardingRecord, Paginated } from '@/lib/types';
import { Card, Field, PageHeader } from '@/components/ui/primitives';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Select } from '@/components/ui/select';
import { OnboardingStatusBadge } from '@/components/ui/status';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...['OFFER_ACCEPTED', 'PREBOARDING', 'JOINED', 'DID_NOT_JOIN'].map((value) => ({
    value,
    label: humanise(value),
  })),
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? '';
  const page = Number(searchParams.get('page') ?? '1');

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding', { status, page }],
    queryFn: () =>
      api.get<Paginated<OnboardingRecord>>('/onboarding', {
        page,
        pageSize: 20,
        status: status || undefined,
      }),
  });

  const columns: Array<Column<OnboardingRecord>> = [
    {
      key: 'candidate',
      header: 'New hire',
      render: (record) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{record.candidate?.fullName ?? '—'}</p>
          <p className="font-mono text-xs text-muted-foreground">{record.onboardingCode}</p>
        </div>
      ),
    },
    {
      key: 'designation',
      header: 'Designation',
      render: (record) => <span className="text-sm">{record.designation}</span>,
    },
    {
      key: 'department',
      header: 'Department',
      hideOnMobile: true,
      render: (record) => <span className="text-sm">{record.department?.name ?? '—'}</span>,
    },
    {
      key: 'joining',
      header: 'Joining date',
      render: (record) => <span className="text-sm">{formatDate(record.joiningDate)}</span>,
    },
    {
      key: 'progress',
      header: 'Checklist',
      render: (record) => {
        const summary = record.taskSummary;
        if (!summary || summary.total === 0) {
          return <span className="text-xs text-muted-foreground">Not started</span>;
        }
        return (
          <div className="min-w-[7rem]">
            <div className="flex items-center justify-between text-xs">
              <span className="tabular-nums">{summary.completed}/{summary.total}</span>
              <span className="text-muted-foreground">{summary.percentComplete}%</span>
            </div>
            <div
              className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={summary.percentComplete}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Checklist completion"
            >
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${summary.percentComplete}%` }}
              />
            </div>
          </div>
        );
      },
    },
    { key: 'status', header: 'Status', render: (record) => <OnboardingStatusBadge status={record.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Onboarding"
        description="New hires from offer acceptance through to joining."
      />

      <Card className="mb-4 p-4">
        <Field label="Status" htmlFor="onboarding-status" className="max-w-xs">
          <Select
            id="onboarding-status"
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
        rowKey={(record) => record.id}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={(next) => {
          const params = new URLSearchParams(searchParams);
          params.set('page', String(next));
          setSearchParams(params);
        }}
        onRowClick={(record) => navigate(`/onboarding/${record.id}`)}
        caption="Onboarding records"
        emptyTitle="No onboarding records"
        emptyDescription="A record is created automatically when a candidate accepts an offer."
      />
    </>
  );
}
