import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListChecks, UserCheck, UserX } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, humanise } from '@/lib/utils';
import type { OnboardingRecord, OnboardingStatus, TaskStatus } from '@/lib/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  PageHeader,
  PageLoader,
  Textarea,
} from '@/components/ui/primitives';
import { Select } from '@/components/ui/select';
import { OnboardingStatusBadge } from '@/components/ui/status';
import { Dialog, useToast } from '@/components/ui/feedback';

const TASK_STATUSES: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED', 'CANCELLED'];

export default function OnboardingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();

  const [statusOpen, setStatusOpen] = useState<OnboardingStatus | null>(null);
  const [didNotJoinReason, setDidNotJoinReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const record = useQuery({
    queryKey: ['onboarding', id],
    queryFn: () => api.get<OnboardingRecord>(`/onboarding/${id}`),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['onboarding', id] });
    void queryClient.invalidateQueries({ queryKey: ['onboarding'] });
  };

  const initialise = useMutation({
    mutationFn: () => api.post(`/onboarding/${id}/initialise-tasks`),
    onSuccess: () => {
      invalidate();
      toast.success('Checklist created');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not create the checklist.'),
  });

  const updateTask = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      api.patch(`/onboarding/tasks/${taskId}`, { status }),
    onSuccess: () => invalidate(),
    onError: (err) => toast.error('Could not update task', err instanceof ApiError ? err.message : undefined),
  });

  const updateStatus = useMutation({
    mutationFn: (status: OnboardingStatus) =>
      api.patch(`/onboarding/${id}`, {
        status,
        didNotJoinReason: status === 'DID_NOT_JOIN' ? didNotJoinReason : undefined,
      }),
    onSuccess: (_, status) => {
      invalidate();
      setStatusOpen(null);
      toast.success(`Onboarding marked as ${humanise(status)}`);
    },
    onError: (err) => {
      // JOINED is refused while mandatory tasks remain open; show why.
      setError(err instanceof ApiError ? err.message : 'Could not update the status.');
      setStatusOpen(null);
    },
  });

  if (record.isLoading) return <PageLoader label="Loading onboarding record" />;
  if (record.isError || !record.data) {
    return <Alert tone="error" title="Could not load this record">You may not have access to it.</Alert>;
  }

  const data = record.data;
  const tasks = data.tasks ?? [];
  const mandatoryOpen = tasks.filter((task) => task.isMandatory && task.status !== 'COMPLETED' && task.status !== 'CANCELLED').length;
  const canManage = can('onboarding.manage');

  return (
    <>
      <PageHeader
        title={data.candidate?.fullName ?? 'Onboarding'}
        description={`${data.onboardingCode} · ${data.designation}`}
        actions={
          canManage ? (
            <>
              {data.status === 'OFFER_ACCEPTED' && (
                <Button size="sm" onClick={() => setStatusOpen('PREBOARDING')}>
                  Start preboarding
                </Button>
              )}
              {data.status === 'PREBOARDING' && (
                <Button size="sm" onClick={() => setStatusOpen('JOINED')} leftIcon={<UserCheck />}>
                  Mark as joined
                </Button>
              )}
              {['OFFER_ACCEPTED', 'PREBOARDING'].includes(data.status) && (
                <Button size="sm" variant="outline" onClick={() => setStatusOpen('DID_NOT_JOIN')} leftIcon={<UserX />}>
                  Did not join
                </Button>
              )}
            </>
          ) : undefined
        }
      />

      {error && <Alert tone="error" className="mb-4">{error}</Alert>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <ListChecks className="size-4" aria-hidden="true" />
                  Onboarding checklist
                </span>
                {tasks.length === 0 && canManage && (
                  <Button size="sm" variant="outline" onClick={() => initialise.mutate()} isLoading={initialise.isPending}>
                    Create default checklist
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No tasks yet. Create the default checklist to get started.
                </p>
              ) : (
                <ul className="divide-y">
                  {tasks.map((task) => (
                    <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          {task.title}
                          {task.isMandatory && <Badge tone="warning">Mandatory</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {task.category ? humanise(task.category) : 'General'}
                          {task.owner && ` · ${task.owner.firstName} ${task.owner.lastName}`}
                          {task.dueDate && ` · due ${formatDate(task.dueDate)}`}
                        </p>
                      </div>
                      {can('onboarding.task.update') ? (
                        <Select
                          value={task.status}
                          onValueChange={(value) =>
                            updateTask.mutate({ taskId: task.id, status: value as TaskStatus })
                          }
                          options={TASK_STATUSES.map((status) => ({ value: status, label: humanise(status) }))}
                          className="w-40"
                          aria-label={`Status for ${task.title}`}
                        />
                      ) : (
                        <Badge tone={task.status === 'COMPLETED' ? 'success' : 'neutral'}>
                          {humanise(task.status)}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Status</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <OnboardingStatusBadge status={data.status} />
              {mandatoryOpen > 0 && data.status === 'PREBOARDING' && (
                <Alert tone="warning">
                  {mandatoryOpen} mandatory task(s) still open. These must be completed before the
                  new hire can be marked as joined.
                </Alert>
              )}
              {data.didNotJoinReason && (
                <Alert tone="warning" title="Did not join">{data.didNotJoinReason}</Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent>
              <dl className="space-y-2.5 text-sm">
                {[
                  ['Designation', data.designation],
                  ['Department', data.department?.name ?? '—'],
                  ['Reporting manager', data.reportingManager ? `${data.reportingManager.firstName} ${data.reportingManager.lastName}` : '—'],
                  ['Joining date', formatDate(data.joiningDate)],
                  ['Actual join date', formatDate(data.actualJoinDate)],
                  ['Employee code', data.employeeCode ?? '—'],
                  ['Documents verified', data.documentsVerified ? 'Yes' : 'No'],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          {data.applicationId && (
            <Card>
              <CardContent className="pt-5">
                <Link to={`/applications/${data.applicationId}`} className="text-sm text-primary hover:underline">
                  View original application
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog
        open={statusOpen !== null}
        onOpenChange={(open) => !open && setStatusOpen(null)}
        title={statusOpen ? `Mark as ${humanise(statusOpen)}` : ''}
        description={
          statusOpen === 'JOINED'
            ? 'This marks the application as Hired and consumes one vacancy on the job requirement.'
            : statusOpen === 'DID_NOT_JOIN'
              ? 'The application is closed without a hire. The vacancy stays open.'
              : 'Preboarding begins and the checklist becomes active.'
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setStatusOpen(null)}>Cancel</Button>
            <Button
              variant={statusOpen === 'DID_NOT_JOIN' ? 'destructive' : 'primary'}
              onClick={() => statusOpen && updateStatus.mutate(statusOpen)}
              isLoading={updateStatus.isPending}
              disabled={statusOpen === 'DID_NOT_JOIN' && !didNotJoinReason.trim()}
            >
              Confirm
            </Button>
          </>
        }
      >
        {statusOpen === 'DID_NOT_JOIN' && (
          <Field label="Reason" htmlFor="dnj-reason" required>
            <Textarea
              id="dnj-reason"
              rows={3}
              value={didNotJoinReason}
              onChange={(event) => setDidNotJoinReason(event.target.value)}
            />
          </Field>
        )}
      </Dialog>
    </>
  );
}
