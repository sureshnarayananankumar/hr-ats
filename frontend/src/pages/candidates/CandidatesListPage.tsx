import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, Search } from 'lucide-react';
import { api, downloadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import type { CandidateProfile, Paginated } from '@/lib/types';
import { Badge, Button, Card, Field, Input, PageHeader } from '@/components/ui/primitives';
import { DataTable, type Column } from '@/components/ui/data-table';

export default function CandidatesListPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get('page') ?? '1');
  const search = searchParams.get('search') ?? '';
  const location = searchParams.get('location') ?? '';
  const minExperience = searchParams.get('minExperience') ?? '';

  const [form, setForm] = useState({ search, location, minExperience });

  const applyFilters = () => {
    const next = new URLSearchParams();
    if (form.search) next.set('search', form.search);
    if (form.location) next.set('location', form.location);
    if (form.minExperience) next.set('minExperience', form.minExperience);
    setSearchParams(next);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['candidates', { page, search, location, minExperience }],
    queryFn: () =>
      api.get<Paginated<CandidateProfile>>('/candidates', {
        page,
        pageSize: 20,
        search: search || undefined,
        location: location || undefined,
        minExperience: minExperience || undefined,
      }),
  });

  const columns: Array<Column<CandidateProfile>> = [
    {
      key: 'name',
      header: 'Candidate',
      sortKey: 'fullName',
      render: (candidate) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{candidate.fullName}</p>
          <p className="font-mono text-xs text-muted-foreground">{candidate.candidateCode}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      hideOnMobile: true,
      render: (candidate) => (
        <div className="min-w-0 text-sm">
          <p className="truncate">{candidate.user?.email}</p>
          {candidate.mobile && <p className="text-xs text-muted-foreground">{candidate.mobile}</p>}
        </div>
      ),
    },
    {
      key: 'current',
      header: 'Current role',
      hideOnMobile: true,
      render: (candidate) => (
        <div className="min-w-0 text-sm">
          <p className="truncate">{candidate.currentDesignation ?? '—'}</p>
          {candidate.currentCompany && (
            <p className="truncate text-xs text-muted-foreground">{candidate.currentCompany}</p>
          )}
        </div>
      ),
    },
    {
      key: 'experience',
      header: 'Experience',
      sortKey: 'totalExperience',
      render: (candidate) =>
        candidate.totalExperience ? (
          <span className="text-sm tabular-nums">{Number(candidate.totalExperience).toFixed(1)} yrs</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'location',
      header: 'Location',
      hideOnMobile: true,
      render: (candidate) => <span className="text-sm">{candidate.location ?? '—'}</span>,
    },
    {
      key: 'skills',
      header: 'Skills',
      hideOnMobile: true,
      render: (candidate) => (
        <div className="flex flex-wrap gap-1">
          {(candidate.skills ?? []).slice(0, 3).map((entry) => (
            <Badge key={entry.skill.id}>{entry.skill.name}</Badge>
          ))}
          {(candidate.skills?.length ?? 0) > 3 && (
            <span className="text-xs text-muted-foreground">+{candidate.skills!.length - 3}</span>
          )}
        </div>
      ),
    },
    {
      key: 'applications',
      header: 'Applications',
      render: (candidate) => <span className="text-sm tabular-nums">{candidate._count?.applications ?? 0}</span>,
    },
    {
      key: 'registered',
      header: 'Registered',
      sortKey: 'createdAt',
      hideOnMobile: true,
      render: (candidate) => (
        <span className="text-xs text-muted-foreground">{formatDate(candidate.createdAt)}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Candidates"
        description="Search the candidate directory."
        actions={
          can('candidate.export') ? (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download />}
              onClick={() =>
                void downloadFile('/candidates/export', 'candidates.csv', {
                  format: 'csv',
                  search: search || undefined,
                  location: location || undefined,
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
          className="grid gap-3 md:grid-cols-[1fr_12rem_10rem_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <Field label="Search" htmlFor="cand-search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="cand-search"
                className="pl-8"
                placeholder="Name, code, email or company"
                value={form.search}
                onChange={(event) => setForm({ ...form, search: event.target.value })}
              />
            </div>
          </Field>

          <Field label="Location" htmlFor="cand-location">
            <Input
              id="cand-location"
              value={form.location}
              onChange={(event) => setForm({ ...form, location: event.target.value })}
            />
          </Field>

          <Field label="Min experience" htmlFor="cand-exp">
            <Input
              id="cand-exp"
              type="number"
              min={0}
              value={form.minExperience}
              onChange={(event) => setForm({ ...form, minExperience: event.target.value })}
            />
          </Field>

          <div className="flex items-end">
            <Button type="submit" className="w-full md:w-auto">Search</Button>
          </div>
        </form>
      </Card>

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(candidate) => candidate.id}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={(next) => {
          const params = new URLSearchParams(searchParams);
          params.set('page', String(next));
          setSearchParams(params);
        }}
        onRowClick={(candidate) => navigate(`/candidates/${candidate.id}`)}
        caption="Candidate directory"
        emptyTitle="No candidates found"
        emptyDescription="Candidates appear here once they register on the careers portal."
      />
    </>
  );
}
