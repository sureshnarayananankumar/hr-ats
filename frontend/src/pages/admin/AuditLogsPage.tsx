import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import type { AuditLogEntry, Paginated } from '@/lib/types';
import {
  Badge,
  Card,
  Field,
  Input,
  PageHeader,
  StatCard,
} from '@/components/ui/primitives';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Select } from '@/components/ui/select';
import { Dialog } from '@/components/ui/feedback';

interface SecuritySummary {
  since: string;
  failedLogins: number;
  lockouts: number;
  unauthorized: number;
  documentDenials: number;
  tokenReuse: number;
}

const SEVERITIES = [
  { value: '', label: 'All severities' },
  { value: 'INFO', label: 'Info' },
  { value: 'WARN', label: 'Warning' },
  { value: 'CRITICAL', label: 'Critical' },
];

export default function AuditLogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1');
  const severity = searchParams.get('severity') ?? '';
  const search = searchParams.get('search') ?? '';

  const [searchInput, setSearchInput] = useState(search);
  const [detail, setDetail] = useState<AuditLogEntry | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', { page, severity, search }],
    queryFn: () =>
      api.get<Paginated<AuditLogEntry>>('/admin/audit-logs', {
        page,
        pageSize: 25,
        severity: severity || undefined,
        search: search || undefined,
      }),
  });

  const summary = useQuery({
    queryKey: ['security-summary'],
    queryFn: () => api.get<SecuritySummary>('/admin/security-summary', { days: 7 }),
  });

  const updateParams = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    }
    if (!('page' in changes)) next.delete('page');
    setSearchParams(next);
  };

  const columns: Array<Column<AuditLogEntry>> = [
    {
      key: 'when',
      header: 'When',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => <span className="font-mono text-xs">{row.action}</span>,
    },
    {
      key: 'actor',
      header: 'Actor',
      render: (row) => (
        <span className="text-sm">
          {row.actor ? `${row.actor.firstName} ${row.actor.lastName}` : (row.actorEmail ?? 'System')}
        </span>
      ),
    },
    {
      key: 'entity',
      header: 'Entity',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.entityType ?? '—'}
          {row.entityId && <span className="ml-1 font-mono">{row.entityId.slice(0, 8)}…</span>}
        </span>
      ),
    },
    {
      key: 'ip',
      header: 'IP',
      hideOnMobile: true,
      render: (row) => <span className="font-mono text-xs text-muted-foreground">{row.ipAddress ?? '—'}</span>,
    },
    {
      key: 'severity',
      header: 'Severity',
      render: (row) => (
        <Badge
          tone={row.severity === 'CRITICAL' ? 'danger' : row.severity === 'WARN' ? 'warning' : 'neutral'}
        >
          {row.severity}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Audit Logs"
        description="Append-only record of security and business events. Restricted to Super Admins."
      />

      <section aria-label="Security summary" className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Failed logins" value={summary.data?.failedLogins ?? 0} hint="Last 7 days" tone={summary.data?.failedLogins ? 'warning' : 'neutral'} />
        <StatCard label="Lockouts" value={summary.data?.lockouts ?? 0} hint="Last 7 days" tone={summary.data?.lockouts ? 'warning' : 'neutral'} />
        <StatCard label="Unauthorised access" value={summary.data?.unauthorized ?? 0} hint="Last 7 days" tone={summary.data?.unauthorized ? 'danger' : 'neutral'} />
        <StatCard label="Document denials" value={summary.data?.documentDenials ?? 0} hint="Last 7 days" tone={summary.data?.documentDenials ? 'danger' : 'neutral'} />
        <StatCard label="Token reuse" value={summary.data?.tokenReuse ?? 0} hint="Last 7 days" tone={summary.data?.tokenReuse ? 'danger' : 'neutral'} icon={<ShieldAlert className="size-5" />} />
      </section>

      <Card className="mb-4 p-4">
        <form
          className="grid gap-3 sm:grid-cols-[1fr_12rem]"
          onSubmit={(event) => {
            event.preventDefault();
            updateParams({ search: searchInput });
          }}
        >
          <Field label="Search" htmlFor="audit-search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="audit-search"
                className="pl-8"
                placeholder="Action, email or entity ID"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
          </Field>
          <Field label="Severity" htmlFor="audit-severity">
            <Select
              id="audit-severity"
              value={severity}
              onValueChange={(value) => updateParams({ severity: value })}
              options={SEVERITIES}
            />
          </Field>
        </form>
      </Card>

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={(next) => updateParams({ page: next })}
        onRowClick={(row) => setDetail(row)}
        caption="Audit log entries"
        emptyTitle="No audit entries match your filters"
      />

      <Dialog
        open={detail !== null}
        onOpenChange={(open) => !open && setDetail(null)}
        title={detail?.action ?? ''}
        description={detail ? formatDateTime(detail.createdAt) : undefined}
        size="lg"
      >
        {detail && (
          <dl className="space-y-3 text-sm">
            {[
              ['Actor', detail.actor ? `${detail.actor.firstName} ${detail.actor.lastName} (${detail.actor.email})` : detail.actorEmail],
              ['Entity', detail.entityType],
              ['Entity ID', detail.entityId],
              ['IP address', detail.ipAddress],
              ['Request ID', detail.requestId],
              ['Severity', detail.severity],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="break-all text-right font-mono text-xs">{value || '—'}</dd>
              </div>
            ))}

            {detail.metadata && (
              <div>
                <dt className="mb-1 text-muted-foreground">Metadata</dt>
                <dd>
                  <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
                    {JSON.stringify(JSON.parse(detail.metadata), null, 2)}
                  </pre>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Passwords, tokens and other secrets are redacted before an entry is written.
                  </p>
                </dd>
              </div>
            )}
          </dl>
        )}
      </Dialog>
    </>
  );
}
