import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Search, AlertTriangle } from 'lucide-react';
import { api, ApiError, downloadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatRelative, humanise, STAGE_LABELS, STAGE_ORDER } from '@/lib/utils';
import type { ApplicationStage, JobApplication, Paginated } from '@/lib/types';
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Textarea,
} from '@/components/ui/primitives';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Select } from '@/components/ui/select';
import { ApplicationStatusBadge, StageBadge } from '@/components/ui/status';
import { Dialog, useToast } from '@/components/ui/feedback';

const STAGE_OPTIONS = [
  { value: '', label: 'All stages' },
  ...STAGE_ORDER.map((stage) => ({ value: stage, label: STAGE_LABELS[stage] })),
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...['ACTIVE', 'ON_HOLD', 'REJECTED', 'WITHDRAWN', 'OFFER_DECLINED', 'HIRED'].map((value) => ({
    value,
    label: humanise(value),
  })),
];

export default function ApplicationsListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get('page') ?? '1');
  const stage = searchParams.get('stage') ?? '';
  const status = searchParams.get('status') ?? '';
  const search = searchParams.get('search') ?? '';
  const overdueOnly = searchParams.get('overdueOnly') === 'true';

  const [searchInput, setSearchInput] = useState(search);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStage, setBulkStage] = useState<ApplicationStage | ''>('');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkResult, setBulkResult] = useState<{ succeeded: number; failed: number } | null>(null);

  const updateParams = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    }
    if (!('page' in changes)) next.delete('page');
    setSearchParams(next);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['applications', { page, stage, status, search, overdueOnly }],
    queryFn: () =>
      api.get<Paginated<JobApplication>>('/applications', {
        page,
        pageSize: 20,
        stage: stage || undefined,
        status: status || undefined,
        search: search || undefined,
        overdueOnly: overdueOnly || undefined,
      }),
  });

  const bulkTransition = useMutation({
    mutationFn: () =>
      api.post<{ succeeded: number; failed: number; results: Array<{ id: string; ok: boolean; error?: string }> }>(
        '/applications/bulk/transition',
        {
          applicationIds: [...selected],
          toStage: bulkStage || undefined,
          reason: bulkReason || undefined,
        },
      ),
    onSuccess: (result) => {
      // Bulk operations are per-row: report partial success honestly
      // rather than claiming the whole batch worked.
      setBulkResult({ succeeded: result.succeeded, failed: result.failed });
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      setSelected(new Set());
      if (result.failed === 0) {
        toast.success(`${result.succeeded} application(s) moved`);
        setBulkOpen(false);
      } else {
        toast.toast({
          title: `${result.succeeded} moved, ${result.failed} could not be moved`,
          description: 'Transitions that the server rejected are listed in the dialog.',
          tone: 'warning',
        });
      }
    },
    onError: (error) =>
      toast.error('Bulk update failed', error instanceof ApiError ? error.message : undefined),
  });

  const columns: Array<Column<JobApplication>> = [
    {
      key: 'candidate',
      header: 'Candidate',
      render: (application) => (
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-medium">
            {application.candidate?.fullName ?? '—'}
            {application.isOverdue && (
              <AlertTriangle className="size-3.5 shrink-0 text-warning" aria-label="Follow-up overdue" />
            )}
          </p>
          <p className="font-mono text-xs text-muted-foreground">{application.applicationCode}</p>
        </div>
      ),
    },
    {
      key: 'job',
      header: 'Job',
      hideOnMobile: true,
      render: (application) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{application.job?.title ?? '—'}</p>
          <p className="font-mono text-xs text-muted-foreground">{application.job?.requirementCode}</p>
        </div>
      ),
    },
    {
      key: 'experience',
      header: 'Exp.',
      hideOnMobile: true,
      render: (application) =>
        application.candidate?.totalExperience ? (
          <span className="text-sm">{Number(application.candidate.totalExperience).toFixed(1)} yrs</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { key: 'stage', header: 'Stage', render: (application) => <StageBadge stage={application.currentStage} /> },
    { key: 'status', header: 'Status', render: (application) => <ApplicationStatusBadge status={application.status} /> },
    {
      key: 'recruiter',
      header: 'Recruiter',
      hideOnMobile: true,
      render: (application) => (
        <span className="text-sm">
          {application.recruiter ? `${application.recruiter.firstName} ${application.recruiter.lastName}` : '—'}
        </span>
      ),
    },
    {
      key: 'applied',
      header: 'Applied',
      sortKey: 'appliedAt',
      render: (application) => (
        <span className="text-xs text-muted-foreground">{formatDate(application.appliedAt)}</span>
      ),
    },
    {
      key: 'updated',
      header: 'Updated',
      hideOnMobile: true,
      render: (application) => (
        <span className="text-xs text-muted-foreground">{formatRelative(application.lastUpdatedAt)}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Applications"
        description="Every application across the roles you can see."
        actions={
          can('application.export') ? (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download />}
              onClick={() =>
                void downloadFile('/applications/export', 'applications.csv', {
                  format: 'csv',
                  stage: stage || undefined,
                  status: status || undefined,
                  search: search || undefined,
                })
              }
            >
              Export CSV
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-4 p-4">
        <form
          className="grid gap-3 md:grid-cols-[1fr_12rem_12rem]"
          onSubmit={(event) => {
            event.preventDefault();
            updateParams({ search: searchInput });
          }}
        >
          <Field label="Search" htmlFor="app-search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="app-search"
                className="pl-8"
                placeholder="Candidate, application ID or job"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
          </Field>

          <Field label="Stage" htmlFor="app-stage">
            <Select id="app-stage" value={stage} onValueChange={(value) => updateParams({ stage: value })} options={STAGE_OPTIONS} />
          </Field>

          <Field label="Status" htmlFor="app-status">
            <Select id="app-status" value={status} onValueChange={(value) => updateParams({ status: value })} options={STATUS_OPTIONS} />
          </Field>
        </form>

        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 rounded border-input accent-primary"
            checked={overdueOnly}
            onChange={(event) => updateParams({ overdueOnly: event.target.checked ? 'true' : undefined })}
          />
          <span className="text-muted-foreground">Only show overdue follow-ups</span>
        </label>
      </Card>

      {selected.size > 0 && can('application.bulk') && (
        <Card className="mb-4 border-primary/40 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">{selected.size} selected</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
              <Button size="sm" onClick={() => { setBulkResult(null); setBulkOpen(true); }}>
                Change stage
              </Button>
            </div>
          </div>
        </Card>
      )}

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(application) => application.id}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={(next) => updateParams({ page: next })}
        onRowClick={(application) => navigate(`/applications/${application.id}`)}
        selectable={can('application.bulk')}
        selectedIds={selected}
        onSelectionChange={setSelected}
        caption="Job applications"
        emptyTitle="No applications found"
        emptyDescription="Applications appear here once candidates apply to published jobs."
      />

      <Dialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title={`Move ${selected.size} application(s)`}
        description="Each application is validated individually. Any that cannot move are reported back."
        footer={
          <>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>
              Close
            </Button>
            <Button onClick={() => bulkTransition.mutate()} isLoading={bulkTransition.isPending} disabled={!bulkStage}>
              Apply to {selected.size}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Move to stage" htmlFor="bulk-stage" required>
            <Select
              id="bulk-stage"
              value={bulkStage}
              onValueChange={(value) => setBulkStage(value as ApplicationStage)}
              options={STAGE_ORDER.map((entry) => ({ value: entry, label: STAGE_LABELS[entry] }))}
              placeholder="Select a stage"
            />
          </Field>

          <Field label="Reason" htmlFor="bulk-reason" hint="Recorded in each application's history.">
            <Textarea id="bulk-reason" rows={2} value={bulkReason} onChange={(event) => setBulkReason(event.target.value)} />
          </Field>

          {bulkResult && (
            <Alert tone={bulkResult.failed === 0 ? 'success' : 'warning'}>
              {bulkResult.succeeded} moved successfully
              {bulkResult.failed > 0 && `, ${bulkResult.failed} rejected by the server (invalid transition for their current stage)`}
              .
            </Alert>
          )}
        </div>
      </Dialog>
    </>
  );
}
