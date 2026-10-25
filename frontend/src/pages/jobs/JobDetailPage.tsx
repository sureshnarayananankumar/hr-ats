import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Pencil,
  Copy,
  Send,
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
  Ban,
  Archive,
  Kanban,
  History,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatDateTime, formatExperience, formatSalaryRange, humanise } from '@/lib/utils';
import type { JobRequirement, JobStatus, UserSummary } from '@/lib/types';
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
import { JobStatusBadge, PriorityBadge } from '@/components/ui/status';
import { ConfirmDialog, Dialog, useToast } from '@/components/ui/feedback';
import { Select } from '@/components/ui/select';

interface HistoryRow {
  id: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  changedAt: string;
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can, user } = useAuth();

  const [statusDialog, setStatusDialog] = useState<JobStatus | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [approverId, setApproverId] = useState('');
  const [decisionOpen, setDecisionOpen] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [decisionComments, setDecisionComments] = useState('');
  const [error, setError] = useState<string | null>(null);

  const job = useQuery({
    queryKey: ['job', id],
    queryFn: () => api.get<JobRequirement>(`/jobs/${id}`),
  });

  const history = useQuery({
    queryKey: ['job', id, 'history'],
    queryFn: () => api.get<HistoryRow[]>(`/jobs/${id}/history`),
  });

  const approvers = useQuery({
    queryKey: ['assignable', 'HR_ADMIN'],
    queryFn: () => api.get<UserSummary[]>('/admin/users/assignable', { role: 'HR_ADMIN' }),
    enabled: submitOpen,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['job', id] });
    void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    void queryClient.invalidateQueries({ queryKey: ['pending-actions'] });
  };

  const changeStatus = useMutation({
    mutationFn: (payload: { status: JobStatus; reason?: string }) =>
      api.patch(`/jobs/${id}/status`, payload),
    onSuccess: (_, variables) => {
      invalidate();
      setStatusDialog(null);
      setStatusReason('');
      toast.success(`Requirement moved to ${humanise(variables.status)}`);
    },
    onError: (err) => {
      // The server validates every transition; surface its exact reason
      // rather than a generic failure.
      setError(err instanceof ApiError ? err.message : 'Could not change the status.');
      setStatusDialog(null);
    },
  });

  const submitForApproval = useMutation({
    mutationFn: () => api.post(`/jobs/${id}/submit`, { approverIds: [approverId] }),
    onSuccess: () => {
      invalidate();
      setSubmitOpen(false);
      toast.success('Submitted for approval', 'The approver has been notified.');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not submit.'),
  });

  const decide = useMutation({
    mutationFn: (decision: 'APPROVED' | 'REJECTED') =>
      api.post(`/jobs/${id}/approval`, { decision, comments: decisionComments || undefined }),
    onSuccess: (_, decision) => {
      invalidate();
      setDecisionOpen(null);
      setDecisionComments('');
      toast.success(decision === 'APPROVED' ? 'Requirement approved' : 'Requirement rejected');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not record the decision.'),
  });

  const duplicate = useMutation({
    mutationFn: () => api.post<JobRequirement>(`/jobs/${id}/duplicate`),
    onSuccess: (copy) => {
      toast.success('Requirement duplicated', 'A new draft has been created.');
      navigate(`/jobs/${copy.id}`);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not duplicate.'),
  });

  if (job.isLoading) return <PageLoader label="Loading requirement" />;
  if (job.isError || !job.data) {
    return <Alert tone="error" title="Could not load this requirement">You may not have access to it.</Alert>;
  }

  const data = job.data;
  const myPendingApproval = data.approvals?.find(
    (approval) => approval.approverId === user?.id && approval.decision === 'PENDING',
  );

  /** Status actions available from the CURRENT status (mirrors the server). */
  const statusActions: Array<{ status: JobStatus; label: string; icon: typeof Send; permission: string; tone?: 'destructive' }> = [
    { status: 'PUBLISHED', label: 'Publish', icon: PlayCircle, permission: 'job.publish' },
    { status: 'ON_HOLD', label: 'Put on hold', icon: PauseCircle, permission: 'job.hold' },
    { status: 'CLOSED', label: 'Close', icon: Archive, permission: 'job.close' },
    { status: 'CANCELLED', label: 'Cancel', icon: Ban, permission: 'job.cancel', tone: 'destructive' },
  ];

  const allowedFrom: Record<JobStatus, JobStatus[]> = {
    DRAFT: ['CANCELLED'],
    PENDING_APPROVAL: ['CANCELLED'],
    APPROVED: ['PUBLISHED', 'ON_HOLD', 'CANCELLED'],
    PUBLISHED: ['ON_HOLD', 'CLOSED', 'CANCELLED'],
    ON_HOLD: ['PUBLISHED', 'CLOSED', 'CANCELLED'],
    CLOSED: ['PUBLISHED'],
    CANCELLED: [],
  };

  const availableActions = statusActions.filter(
    (action) => allowedFrom[data.status].includes(action.status) && can(action.permission),
  );

  const skillList = Array.isArray(data.skills)
    ? data.skills.map((entry) => (typeof entry === 'string' ? { name: entry, isRequired: true } : { name: entry.skill.name, isRequired: entry.isRequired }))
    : [];

  return (
    <>
      <PageHeader
        title={data.title}
        description={`${data.requirementCode} · ${data.department?.name ?? 'No department'}`}
        actions={
          <>
            {can('job.update') && ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'ON_HOLD'].includes(data.status) && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/jobs/${id}/edit`)} leftIcon={<Pencil />}>
                Edit
              </Button>
            )}
            {can('job.duplicate') && (
              <Button variant="outline" size="sm" onClick={() => duplicate.mutate()} isLoading={duplicate.isPending} leftIcon={<Copy />}>
                Duplicate
              </Button>
            )}
            {data.status === 'DRAFT' && can('job.submit') && (
              <Button size="sm" onClick={() => setSubmitOpen(true)} leftIcon={<Send />}>
                Submit for approval
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate(`/pipeline/${id}`)} leftIcon={<Kanban />}>
              Pipeline
            </Button>
          </>
        }
      />

      {error && (
        <Alert tone="error" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Approver action bar */}
      {myPendingApproval && (
        <Card className="mb-4 border-warning/40 bg-warning/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-sm font-medium">This requirement is awaiting your approval.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setDecisionOpen('APPROVED')} leftIcon={<CheckCircle2 />}>
                Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setDecisionOpen('REJECTED')} leftIcon={<XCircle />}>
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="whitespace-pre-wrap text-muted-foreground">{data.description}</p>

              {data.responsibilities && (
                <div>
                  <h3 className="mb-1 font-medium">Responsibilities</h3>
                  <p className="whitespace-pre-wrap text-muted-foreground">{data.responsibilities}</p>
                </div>
              )}

              {data.qualifications && (
                <div>
                  <h3 className="mb-1 font-medium">Qualifications</h3>
                  <p className="whitespace-pre-wrap text-muted-foreground">{data.qualifications}</p>
                </div>
              )}

              {data.internalNotes && (
                <div className="rounded-md border border-warning/30 bg-warning/5 p-3">
                  <h3 className="mb-1 font-medium">Internal notes</h3>
                  <p className="whitespace-pre-wrap text-muted-foreground">{data.internalNotes}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Internal only — never shown on the careers portal.
                  </p>
                </div>
              )}

              {skillList.length > 0 && (
                <div>
                  <h3 className="mb-2 font-medium">Skills</h3>
                  <ul className="flex flex-wrap gap-2">
                    {skillList.map((skill) => (
                      <li key={skill.name}>
                        <Badge tone={skill.isRequired ? 'info' : 'neutral'}>
                          {skill.name}
                          <span className="text-[0.625rem] opacity-70">
                            {skill.isRequired ? 'required' : 'preferred'}
                          </span>
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {data.approvals && data.approvals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Approval chain</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {data.approvals.map((approval) => (
                    <li key={approval.id} className="flex items-start justify-between gap-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium">
                          {approval.approver?.firstName} {approval.approver?.lastName}
                        </p>
                        {approval.comments && (
                          <p className="text-xs text-muted-foreground">{approval.comments}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge
                          tone={
                            approval.decision === 'APPROVED'
                              ? 'success'
                              : approval.decision === 'REJECTED'
                                ? 'danger'
                                : 'warning'
                          }
                        >
                          {humanise(approval.decision)}
                        </Badge>
                        {approval.decidedAt && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDateTime(approval.decidedAt)}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-4" aria-hidden="true" />
                Change history
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.data && history.data.length > 0 ? (
                <ul className="divide-y text-sm">
                  {history.data.map((row) => (
                    <li key={row.id} className="py-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium">{humanise(row.fieldName)}</span>
                        <time className="text-xs text-muted-foreground" dateTime={row.changedAt}>
                          {formatDateTime(row.changedAt)}
                        </time>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <span className="line-through opacity-70">{row.oldValue ?? '—'}</span>
                        {' → '}
                        <span className="text-foreground">{row.newValue ?? '—'}</span>
                      </p>
                      {row.reason && <p className="mt-0.5 text-xs italic text-muted-foreground">{row.reason}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <JobStatusBadge status={data.status} />
                <PriorityBadge priority={data.priority} />
              </div>

              {availableActions.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {availableActions.map((action) => (
                    <Button
                      key={action.status}
                      variant={action.tone === 'destructive' ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={() => setStatusDialog(action.status)}
                      leftIcon={<action.icon />}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No further status changes are available from {humanise(data.status)}.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2.5 text-sm">
                {[
                  ['Designation', data.designation],
                  ['Location', data.location],
                  ['Work mode', humanise(data.workMode)],
                  ['Employment type', humanise(data.employmentType)],
                  ['Experience', formatExperience(data.minExperience, data.maxExperience)],
                  ['Vacancies', `${data.vacanciesFilled} filled of ${data.vacancies}`],
                  ['Compensation', data.salaryConfidential ? 'Confidential' : formatSalaryRange(data.salaryMin, data.salaryMax, data.salaryCurrency)],
                  ['Applications', String(data.applicationCount ?? 0)],
                  ['Recruiter', data.recruiter ? `${data.recruiter.firstName} ${data.recruiter.lastName}` : 'Unassigned'],
                  ['Hiring manager', data.hiringManager ? `${data.hiringManager.firstName} ${data.hiringManager.lastName}` : 'Unassigned'],
                  ['Requested by', data.requestedBy ? `${data.requestedBy.firstName} ${data.requestedBy.lastName}` : '—'],
                  ['Published', formatDate(data.publishedAt)],
                  ['Deadline', formatDate(data.applicationDeadline)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="shrink-0 text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          {data.status === 'PUBLISHED' && (
            <Card>
              <CardContent className="pt-5">
                <p className="mb-2 text-sm font-medium">Live on the careers portal</p>
                <Link to={`/careers/${data.slug}`} className="text-sm text-primary hover:underline" target="_blank" rel="noreferrer">
                  View public job page
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ---- Status change dialog ---- */}
      <ConfirmDialog
        open={statusDialog !== null}
        onOpenChange={(open) => !open && setStatusDialog(null)}
        title={`${statusDialog ? humanise(statusDialog) : ''} this requirement?`}
        tone={statusDialog === 'CANCELLED' ? 'destructive' : 'primary'}
        isLoading={changeStatus.isPending}
        confirmLabel={statusDialog ? humanise(statusDialog) : 'Confirm'}
        message={
          <div className="space-y-3">
            <p>
              {statusDialog === 'PUBLISHED'
                ? 'The job becomes visible on the public careers portal and starts accepting applications.'
                : statusDialog === 'CLOSED'
                  ? 'The job stops accepting new applications. Candidates already in the pipeline are unaffected.'
                  : statusDialog === 'CANCELLED'
                    ? 'Cancelling is final — the requirement cannot be reopened afterwards.'
                    : 'Applications are paused while the job is on hold.'}
            </p>
            {(statusDialog === 'ON_HOLD' || statusDialog === 'CANCELLED') && (
              <Field label="Reason" htmlFor="status-reason" required>
                <Textarea
                  id="status-reason"
                  rows={3}
                  value={statusReason}
                  onChange={(event) => setStatusReason(event.target.value)}
                  placeholder="Required — recorded in the requirement history"
                />
              </Field>
            )}
          </div>
        }
        onConfirm={() => {
          if (statusDialog) {
            changeStatus.mutate({ status: statusDialog, reason: statusReason || undefined });
          }
        }}
      />

      {/* ---- Submit for approval ---- */}
      <Dialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        title="Submit for approval"
        description="Choose who should approve this requirement. They will be notified."
        footer={
          <>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => submitForApproval.mutate()} isLoading={submitForApproval.isPending} disabled={!approverId}>
              Submit
            </Button>
          </>
        }
      >
        <Field label="Approver" htmlFor="approver" required>
          <Select
            id="approver"
            value={approverId}
            onValueChange={setApproverId}
            placeholder="Select an approver"
            options={(approvers.data ?? []).map((person) => ({ value: person.id, label: `${person.name} (${person.email})` }))}
          />
        </Field>
      </Dialog>

      {/* ---- Approve / reject ---- */}
      <Dialog
        open={decisionOpen !== null}
        onOpenChange={(open) => !open && setDecisionOpen(null)}
        title={decisionOpen === 'APPROVED' ? 'Approve requirement' : 'Reject requirement'}
        description={
          decisionOpen === 'APPROVED'
            ? 'Once every approver has signed off, the requirement becomes Approved and can be published.'
            : 'Rejecting returns the requirement to Draft so it can be revised.'
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setDecisionOpen(null)}>
              Cancel
            </Button>
            <Button
              variant={decisionOpen === 'REJECTED' ? 'destructive' : 'primary'}
              onClick={() => decisionOpen && decide.mutate(decisionOpen)}
              isLoading={decide.isPending}
              disabled={decisionOpen === 'REJECTED' && !decisionComments.trim()}
            >
              {decisionOpen === 'APPROVED' ? 'Approve' : 'Reject'}
            </Button>
          </>
        }
      >
        <Field
          label="Comments"
          htmlFor="decision-comments"
          required={decisionOpen === 'REJECTED'}
          hint={decisionOpen === 'REJECTED' ? 'Required — the requester will see this.' : 'Optional'}
        >
          <Textarea
            id="decision-comments"
            rows={3}
            value={decisionComments}
            onChange={(event) => setDecisionComments(event.target.value)}
          />
        </Field>
      </Dialog>
    </>
  );
}
