import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Lock } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { humanise } from '@/lib/utils';
import type { Department } from '@/lib/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/feedback';

interface SystemSetting {
  id: string;
  key: string;
  value: string;
  valueType: string;
  category: string;
  description: string | null;
  isSecret: boolean;
}

interface Source {
  id: string;
  name: string;
  category: string | null;
  isActive: boolean;
  _count?: { applications: number };
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const settings = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.get<SystemSetting[]>('/admin/settings'),
  });

  const departments = useQuery({
    queryKey: ['departments', 'all'],
    queryFn: () => api.get<Department[]>('/admin/departments', { includeInactive: 'true' }),
  });

  const sources = useQuery({
    queryKey: ['admin', 'sources'],
    queryFn: () => api.get<Source[]>('/admin/sources'),
  });

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      api.patch(`/admin/settings/${key}`, { value }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      setEdits((current) => {
        const next = { ...current };
        delete next[variables.key];
        return next;
      });
      toast.success('Setting updated', 'The change has been recorded in the audit log.');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not save the setting.'),
  });

  const grouped = (settings.data ?? []).reduce<Record<string, SystemSetting[]>>((acc, setting) => {
    (acc[setting.category] ??= []).push(setting);
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Settings"
        description="System configuration. Every change here is written to the audit log."
      />

      {error && <Alert tone="error" className="mb-4">{error}</Alert>}

      <div className="grid gap-4 lg:grid-cols-2">
        {settings.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle>{humanise(category)}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  {items.map((setting) => (
                    <li key={setting.key} className="space-y-1.5">
                      <label htmlFor={setting.key} className="flex items-center gap-2 text-sm font-medium">
                        {setting.key}
                        {setting.isSecret && (
                          <Badge tone="warning">
                            <Lock className="size-3" aria-hidden="true" />
                            Secret
                          </Badge>
                        )}
                      </label>
                      {setting.description && (
                        <p className="text-xs text-muted-foreground">{setting.description}</p>
                      )}
                      <div className="flex gap-2">
                        <Input
                          id={setting.key}
                          value={edits[setting.key] ?? setting.value}
                          // Secret values come back masked; editing them
                          // here would write the mask back to the database.
                          disabled={setting.isSecret || !can('settings.update')}
                          onChange={(event) =>
                            setEdits({ ...edits, [setting.key]: event.target.value })
                          }
                        />
                        {can('settings.update') && !setting.isSecret && (
                          <Button
                            size="icon"
                            variant="outline"
                            aria-label={`Save ${setting.key}`}
                            disabled={edits[setting.key] === undefined || edits[setting.key] === setting.value}
                            onClick={() => save.mutate({ key: setting.key, value: edits[setting.key] })}
                          >
                            <Save className="size-4" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))
        )}

        <Card>
          <CardHeader><CardTitle>Departments</CardTitle></CardHeader>
          <CardContent>
            {departments.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <ul className="divide-y">
                {(departments.data ?? []).map((department) => (
                  <li key={department.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{department.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {department.code}
                        {department._count ? ` · ${department._count.jobRequirements} requirement(s)` : ''}
                      </p>
                    </div>
                    <Badge tone={department.isActive ? 'success' : 'neutral'}>
                      {department.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recruitment sources</CardTitle></CardHeader>
          <CardContent>
            {sources.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <ul className="divide-y">
                {(sources.data ?? []).map((source) => (
                  <li key={source.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{source.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {source.category ? humanise(source.category) : 'Uncategorised'}
                        {source._count ? ` · ${source._count.applications} application(s)` : ''}
                      </p>
                    </div>
                    <Badge tone={source.isActive ? 'success' : 'neutral'}>
                      {source.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
