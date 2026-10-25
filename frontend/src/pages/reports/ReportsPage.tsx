import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileBarChart } from 'lucide-react';
import { api, downloadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Department } from '@/lib/types';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/feedback';

interface ReportMeta {
  key: string;
  name: string;
  definition: string;
}

interface ReportResult {
  key: string;
  name: string;
  definition: string;
  rowCount: number;
  generatedAt: string;
  rows: Array<Record<string, string | number | boolean | null>>;
}

export default function ReportsPage() {
  const { can } = useAuth();
  const toast = useToast();

  const [selectedKey, setSelectedKey] = useState('');
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', departmentId: '' });
  const [runKey, setRunKey] = useState<string | null>(null);

  const catalogue = useQuery({
    queryKey: ['reports', 'catalogue'],
    queryFn: () => api.get<ReportMeta[]>('/reports'),
  });

  const departments = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get<Department[]>('/admin/departments'),
  });

  const result = useQuery({
    queryKey: ['report', runKey, filters],
    queryFn: () =>
      api.get<ReportResult>(`/reports/${runKey}`, {
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        departmentId: filters.departmentId || undefined,
      }),
    enabled: Boolean(runKey),
  });

  const handleExport = async (format: 'csv' | 'xlsx') => {
    if (!runKey) return;
    try {
      await downloadFile(`/reports/${runKey}/export`, `${runKey}.${format}`, {
        format,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        departmentId: filters.departmentId || undefined,
      });
    } catch {
      toast.error('Export failed', 'You may not have permission to export this report.');
    }
  };

  const columns = result.data?.rows?.[0] ? Object.keys(result.data.rows[0]) : [];

  return (
    <>
      <PageHeader
        title="Reports"
        description="Recruitment reporting built from live database records."
      />

      <Card className="mb-4">
        <CardHeader><CardTitle>Run a report</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[1fr_10rem_10rem_12rem_auto]">
            <Field label="Report" htmlFor="report-key">
              <Select
                id="report-key"
                value={selectedKey}
                onValueChange={setSelectedKey}
                placeholder={catalogue.isLoading ? 'Loading…' : 'Choose a report'}
                options={(catalogue.data ?? []).map((report) => ({ value: report.key, label: report.name }))}
              />
            </Field>

            <Field label="From" htmlFor="report-from">
              <Input
                id="report-from"
                type="date"
                value={filters.dateFrom}
                onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}
              />
            </Field>

            <Field label="To" htmlFor="report-to">
              <Input
                id="report-to"
                type="date"
                value={filters.dateTo}
                onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}
              />
            </Field>

            <Field label="Department" htmlFor="report-dept">
              <Select
                id="report-dept"
                value={filters.departmentId}
                onValueChange={(value) => setFilters({ ...filters, departmentId: value })}
                placeholder="All departments"
                options={(departments.data ?? []).map((department) => ({
                  value: department.id,
                  label: department.name,
                }))}
              />
            </Field>

            <div className="flex items-end">
              <Button onClick={() => setRunKey(selectedKey)} disabled={!selectedKey} className="w-full md:w-auto">
                Run
              </Button>
            </div>
          </div>

          {selectedKey && catalogue.data && (
            <p className="mt-3 text-xs text-muted-foreground">
              {catalogue.data.find((report) => report.key === selectedKey)?.definition}
            </p>
          )}
        </CardContent>
      </Card>

      {!runKey ? (
        <Card>
          <EmptyState
            icon={<FileBarChart className="size-6" />}
            title="Choose a report above"
            description={`${catalogue.data?.length ?? 0} reports are available, each with a documented metric definition.`}
          />
        </Card>
      ) : result.isLoading ? (
        <Card className="p-4">
          <Skeleton className="h-64 w-full" />
        </Card>
      ) : result.isError ? (
        <Alert tone="error" title="Could not run this report">
          You may not have permission to view it.
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{result.data!.name}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">{result.data!.definition}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {result.data!.rowCount} row(s) · generated {new Date(result.data!.generatedAt).toLocaleString()}
                </p>
              </div>
              {can('report.export') && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void handleExport('csv')} leftIcon={<Download />}>
                    CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void handleExport('xlsx')}>
                    Excel
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {result.data!.rows.length === 0 ? (
              <EmptyState
                title="No data for these filters"
                description="Try widening the date range or clearing the department filter."
              />
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <caption className="sr-only">{result.data!.name}</caption>
                  <thead className="border-b bg-muted/40">
                    <tr>
                      {columns.map((column) => (
                        <th
                          key={column}
                          scope="col"
                          className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data!.rows.slice(0, 200).map((row, index) => (
                      <tr key={index} className="border-b last:border-0 hover:bg-muted/30">
                        {columns.map((column) => (
                          <td key={column} className="whitespace-nowrap px-3 py-2">
                            {row[column] === null || row[column] === '' ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              String(row[column])
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {result.data!.rows.length > 200 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Showing the first 200 of {result.data!.rowCount} rows. Export for the full dataset.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
