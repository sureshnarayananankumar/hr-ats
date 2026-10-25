import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Download, MessageSquarePlus, UserCog, XCircle } from 'lucide-react';
import { api, ApiError, downloadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  formatDate,
  formatDateTime,
  formatDuration,
  humanise,
  isValidStageTransition,
  STAGE_LABELS,
  STAGE_ORDER,
} from '@/lib/utils';
import type { ApplicationStage, JobApplication, StatusHistoryEntry, UserSummary } from '@/lib/types';
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
import { ApplicationStatusBadge, InterviewStatusBadge, StageBadge } from '@/components/ui/status';
import { Dialog, useToast } from '@/components/ui/feedback';

interface Note {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  author: { id: string; firstName: string; lastName: string };
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();

  const [moveOpen, setMoveOpen] = useState(false);
  const [targetStage, setTargetStage] = useState<ApplicationStage | ''>('');
  const [moveReason, setMoveReason] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [recruiterId, setRecruiterId] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const application = useQuery({
    queryKey: ['application', id],
    queryFn: () => api.get<JobApplication>(`/applications/${id}`),
  });

  const history = useQuery({
    queryKey: ['application', id, 'history'],
    queryFn: () => api.get<StatusHistoryEntry[]>(`/applications/${id}/history`),
  });

  const notes = useQuery({
    queryKey: ['application', id, 'notes'],
    queryFn: () => api.get<Note[]>(`/applications/${id}/notes`),
  });

  const recruiters = useQuery({
    queryKey: ['assignable', 'RECRUITER'],
    queryFn: () => api.get<UserSummary[]>('/admin/users/assignable', { role: 'RECRUITER' }),
    enabled: assignOpen,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['application', id] });
    void queryClient.invalidateQueries({ queryKey: ['applications'] });
  };

  const transition = useMutation({
    mutationFn: (payload: { toStage?: ApplicationStage; toStatus?: string; reason?: string }) =>
      api.patch(`/applications/${id}/transition`, payload),
    onSuccess: () => {
      invalidate();
      setMoveOpen(false);
      setRejectOpen(false);
      setMoveReason('');
      setRejectReason('');
      toast.success('Application updated');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not update the application.'),
  });

  const assign = useMutation({
    mutationFn: () => api.patch(`/applications/${id}/assign`, { recruiterId }),
    onSuccess: () => {
      invalidate();
      setAssignOpen(false);
      toast.success('Recruiter assigned');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not assign the recruiter.'),
  });

  const addNote = useMutation({
    mutationFn: () => api.post(`/applications/${id}/notes`, { body: noteBody, isInternal: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['application', id, 'notes'] });
      setNoteBody('');
      toast.success('Note added');
    },
    onError: (err) => toast.error('Could not add note', err instanceof ApiError ? err.message : undefined),
  });

  if (application.isLoading) return <PageLoader label="Loading application" />;
  if (application.isError || !application.data) {
    return <Alert tone="error" title="Could not load this application">You may not have access to it.</Alert>;
  }

  const data = application.data;
  const isTerminal = ['REJECTED', 'WITHDRAWN', 'OFFER_DECLINED', 'HIRED'].includes(data.status);

  // Only offer stages the server will actually accept.
  const validStages = STAGE_ORDER.filter((stage) => isValidStageTransition(data.currentStage, stage));

  return (
    <>
      <PageHeader
        title={data.candidate?.fullName ?? 'Application'}
        description={`${data.applicationCode} · ${data.job?.title ?? ''}`}
        actions={
          <>
            {can('application.transition') && !isTerminal && (
              <>
                <Button size="sm" onClick={() => setMoveOpen(true)} leftIcon={<ArrowRight />}>
                  Move stage
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)} leftIcon={<XCircle />}>
                  Reject
                </Button>
              </>
            )}
            {can('application.assign') && (
              <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)} leftIcon={<UserCog />}>
                Assign
              </Button>
            )}
          </>
        }
      />

      {error && <Alert tone="error" className="mb-4">{error}</Alert>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Application</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2.5 text-sm sm:grid-cols-2">
                {[
                  ['Stage', <StageBadge key="s" stage={data.currentStage} />],
                  ['Status', <ApplicationStatusBadge key="st" status={data.status} />],
                  ['Applied', formatDate(data.appliedAt)],
                  ['Last updated', formatDateTime(data.lastUpdatedAt)],
                  ['Source', data.source?.name ?? '—'],
                  ['Screening', humanise(data.screeningResult ?? 'NOT_SCREENED')],
                  ['Recruiter', data.recruiter ? `${data.recruiter.firstName} ${data.recruiter.lastName}` : 'Unassigned'],
                  ['Follow-up due', data.followUpDueAt ? formatDate(data.followUpDueAt) : '—'],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex justify-between gap-3 sm:block">
                    <dt className="text-muted-foreground sm:text-xs">{label}</dt>
                    <dd className="font-medium sm:mt-0.5">{value}</dd>
                  </div>
                ))}
              </dl>

              {data.coverLetter && (
                <div className="mt-4 border-t pt-4">
                  <h3 className="mb-1 text-sm font-medium">Cover letter</h3>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{data.coverLetter}</p>
                </div>
              )}

              {data.screeningRemarks && (
                <div className="mt-4 rounded-md border border-warning/30 bg-warning/5 p-3">
                  <h3 className="mb-1 text-sm font-medium">Screening remarks (internal)</h3>
                  <p className="text-sm text-muted-foreground">{data.screeningRemarks}</p>
                </div>
              )}

              {data.rejectionReason && (
                <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <h3 className="mb-1 text-sm font-medium">Rejection reason (internal)</h3>
                  <p className="text-sm text-muted-foreground">{data.rejectionReason}</p>
                </div>
              )}

              {data.resumeDocument && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{data.resumeDocument.originalName}</p>
                    <p className="text-xs text-muted-foreground">
                      Version {data.resumeDocument.version} · uploaded {formatDate(data.resumeDocument.uploadedAt)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<Download />}
                    onClick={() =>
                      void downloadFile(
                        `/documents/${data.resumeDocument!.id}/download`,
                        data.resumeDocument!.originalName,
                      )
                    }
                  >
                    Download
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ---- Stage history ---- */}
          <Card>
            <CardHeader>
              <CardTitle>Stage history</CardTitle>
            </CardHeader>
            <CardContent>
              {history.data && history.data.length > 0 ? (
                <ol className="relative space-y-4 border-l pl-5">
                  {history.data.map((entry) => (
                    <li key={entry.id} className="relative">
                      <span className="absolute -left-[1.4375rem] top-1.5 size-2.5 rounded-full bg-primary" aria-hidden="true" />
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-medium">
                          {entry.fromStageLabel ? `${entry.fromStageLabel} → ` : ''}
                          {entry.toStageLabel}
                        </p>
                        <time className="text-xs text-muted-foreground" dateTime={entry.changedAt}>
                          {formatDateTime(entry.changedAt)}
                        </time>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        by {entry.changedBy.firstName} {entry.changedBy.lastName}
                        {entry.durationSeconds != null && ` · spent ${formatDuration(entry.durationSeconds)} in previous stage`}
                      </p>
                      {entry.reason && <p className="mt-0.5 text-xs italic text-muted-foreground">{entry.reason}</p>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">No transitions recorded.</p>
              )}
            </CardContent>
          </Card>

          {/* ---- Notes ---- */}
          {can('application.note.manage') && (
            <Card>
              <CardHeader>
                <CardTitle>Internal notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Textarea
                    rows={2}
                    value={noteBody}
                    onChange={(event) => setNoteBody(event.target.value)}
                    placeholder="Add a note — visible to recruiters only, never to the candidate."
                    aria-label="New note"
                  />
                  <Button
                    onClick={() => addNote.mutate()}
                    isLoading={addNote.isPending}
                    disabled={!noteBody.trim()}
                    leftIcon={<MessageSquarePlus />}
                  >
                    Add
                  </Button>
                </div>

                {notes.data && notes.data.length > 0 ? (
                  <ul className="divide-y">
                    {notes.data.map((note) => (
                      <li key={note.id} className="py-2.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-xs font-medium">
                            {note.author.firstName} {note.author.lastName}
                            {note.isInternal && <Badge tone="warning" className="ml-2">Internal</Badge>}
                          </p>
                          <time className="text-xs text-muted-foreground" dateTime={note.createdAt}>
                            {formatDateTime(note.createdAt)}
                          </time>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{note.body}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No notes yet.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Candidate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{data.candidate?.fullName}</p>
              {data.candidate?.candidateCode && (
                <p className="font-mono text-xs text-muted-foreground">{data.candidate.candidateCode}</p>
              )}
              {data.candidate?.user?.email && <p className="text-muted-foreground">{data.candidate.user.email}</p>}
              {data.candidate?.currentDesignation && (
                <p className="text-muted-foreground">
                  {data.candidate.currentDesignation}
                  {data.candidate.currentCompany ? ` at ${data.candidate.currentCompany}` : ''}
                </p>
              )}
              {data.candidate?.id && can('candidate.read.any') && (
                <Link to={`/candidates/${data.candidate.id}`} className="inline-block pt-1 text-sm text-primary hover:underline">
                  View full profile
                </Link>
              )}
            </CardContent>
          </Card>

          {data.interviews && data.interviews.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Interviews</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5">
                  {data.interviews.map((interview) => (
                    <li key={interview.id}>
                      <Link to={`/interviews/${interview.id}`} className="block rounded-md border p-2.5 hover:bg-muted/40">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium">{interview.roundName}</p>
                          <InterviewStatusBadge status={interview.status} />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDateTime(interview.scheduledStart)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {data.job?.id && (
            <Card>
              <CardContent className="space-y-2 pt-5 text-sm">
                <p className="font-medium">{data.job.title}</p>
                <p className="font-mono text-xs text-muted-foreground">{data.job.requirementCode}</p>
                <div className="flex flex-col gap-1 pt-1">
                  <Link to={`/jobs/${data.job.id}`} className="text-sm text-primary hover:underline">
                    View requirement
                  </Link>
                  <Link to={`/pipeline/${data.job.id}`} className="text-sm text-primary hover:underline">
                    View pipeline
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ---- Move stage ---- */}
      <Dialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        title="Move to another stage"
        description={`Currently at ${STAGE_LABELS[data.currentStage]}. Only valid next stages are listed.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>Cancel</Button>
            <Button
              onClick={() => transition.mutate({ toStage: targetStage as ApplicationStage, reason: moveReason || undefined })}
              isLoading={transition.isPending}
              disabled={!targetStage}
            >
              Move
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="New stage" htmlFor="move-stage" required>
            <Select
              id="move-stage"
              value={targetStage}
              onValueChange={(value) => setTargetStage(value as ApplicationStage)}
              options={validStages.map((stage) => ({ value: stage, label: STAGE_LABELS[stage] }))}
              placeholder={validStages.length === 0 ? 'No moves available' : 'Select a stage'}
            />
          </Field>
          <Field label="Reason" htmlFor="move-reason" hint="Optional. Recorded in the history.">
            <Textarea id="move-reason" rows={2} value={moveReason} onChange={(event) => setMoveReason(event.target.value)} />
          </Field>
        </div>
      </Dialog>

      {/* ---- Reject ---- */}
      <Dialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject this application"
        description="The candidate is notified, but the internal reason below is never shown to them."
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => transition.mutate({ toStatus: 'REJECTED', reason: rejectReason })}
              isLoading={transition.isPending}
              disabled={!rejectReason.trim()}
            >
              Reject application
            </Button>
          </>
        }
      >
        <Field label="Internal reason" htmlFor="reject-reason" required hint="Required. Used in rejection-reason reporting.">
          <Textarea id="reject-reason" rows={3} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
        </Field>
      </Dialog>

      {/* ---- Assign recruiter ---- */}
      <Dialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        title="Assign a recruiter"
        footer={
          <>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={() => assign.mutate()} isLoading={assign.isPending} disabled={!recruiterId}>
              Assign
            </Button>
          </>
        }
      >
        <Field label="Recruiter" htmlFor="assign-recruiter" required>
          <Select
            id="assign-recruiter"
            value={recruiterId}
            onValueChange={setRecruiterId}
            options={(recruiters.data ?? []).map((person) => ({ value: person.id, label: person.name }))}
            placeholder="Select a recruiter"
          />
        </Field>
      </Dialog>
    </>
  );
}
