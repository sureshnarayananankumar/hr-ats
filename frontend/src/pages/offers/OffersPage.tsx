import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, humanise } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import type { Offer, Paginated } from '@/lib/types';
import { Card, Field, PageHeader } from '@/components/ui/primitives';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Select } from '@/components/ui/select';
import { OfferStatusBadge } from '@/components/ui/status';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN'].map(
    (value) => ({ value, label: humanise(value) }),
  ),
];

export default function OffersPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? '';
  const page = Number(searchParams.get('page') ?? '1');

  // Salary is a restricted field: only users with offer.read.any see it.
  const canSeeCompensation = can('offer.read.any');

  const { data, isLoading } = useQuery({
    queryKey: ['offers', { status, page }],
    queryFn: () =>
      api.get<Paginated<Offer>>('/offers', {
        page,
        pageSize: 20,
        status: status || undefined,
      }),
  });

  const columns: Array<Column<Offer>> = [
    {
      key: 'candidate',
      header: 'Candidate',
      render: (offer) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{offer.candidate?.fullName ?? '—'}</p>
          <p className="font-mono text-xs text-muted-foreground">{offer.offerCode}</p>
        </div>
      ),
    },
    {
      key: 'job',
      header: 'Job',
      hideOnMobile: true,
      render: (offer) => <span className="text-sm">{offer.job?.title ?? '—'}</span>,
    },
    {
      key: 'designation',
      header: 'Proposed role',
      render: (offer) => <span className="text-sm">{offer.proposedDesignation}</span>,
    },
    ...(canSeeCompensation
      ? [
          {
            key: 'salary',
            header: 'Annual salary',
            hideOnMobile: true,
            render: (offer: Offer) => (
              <span className="text-sm tabular-nums">
                {formatCurrency(offer.annualSalary, offer.currency)}
              </span>
            ),
          } as Column<Offer>,
        ]
      : []),
    {
      key: 'joining',
      header: 'Joining date',
      render: (offer) => <span className="text-sm">{formatDate(offer.joiningDate)}</span>,
    },
    {
      key: 'expires',
      header: 'Expires',
      hideOnMobile: true,
      render: (offer) => (
        <span className="text-xs text-muted-foreground">{formatDate(offer.expiresAt)}</span>
      ),
    },
    { key: 'status', header: 'Status', render: (offer) => <OfferStatusBadge status={offer.status} /> },
  ];

  return (
    <>
      <PageHeader title="Offers" description="Offer lifecycle from draft through acceptance." />

      <Card className="mb-4 p-4">
        <Field label="Status" htmlFor="offer-status" className="max-w-xs">
          <Select
            id="offer-status"
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
        rowKey={(offer) => offer.id}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={(next) => {
          const params = new URLSearchParams(searchParams);
          params.set('page', String(next));
          setSearchParams(params);
        }}
        onRowClick={(offer) => navigate(`/offers/${offer.id}`)}
        caption="Offers"
        emptyTitle="No offers yet"
        emptyDescription="Raise an offer from a candidate's application once they reach the Selected stage."
      />
    </>
  );
}
