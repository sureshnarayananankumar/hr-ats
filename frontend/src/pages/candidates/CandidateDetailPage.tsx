import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, MessageSquarePlus, Tag } from 'lucide-react';
import { api, ApiError, downloadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatBytes, formatDate, formatDateTime, humanise } from '@/lib/utils';
import type { CandidateProfile } from '@/lib/types';
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
  PageLoader,
  Textarea,
} from '@/components/ui/primitives';
import { ApplicationStatusBadge, StageBadge } from '@/components/ui/status';
import { useToast } from '@/components/ui/feedback';

interface Note {
  id: string;
  body: string;
  createdAt: string;
  author: { firstName: string; lastName: string };
}

interface Duplicate {
  id: string;
  candidateCode: string;
  fullName: string;
  matchedOn: string[];
  createdAt: string;
}

interface Activity {
  id: string;
  activity: string;
  detail: string | null;
  createdAt: string;
}

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();

  const [noteBody, setNoteBody] = useState('');
  const [tagName, setTagName] = useState('');

  const candidate = useQuery({
    queryKey: ['candidate', id],
    queryFn: () => api.get<CandidateProfile>(`/candidates/${id}`),
  });

  const notes = useQuery({
    queryKey: ['candidate', id, 'notes'],
    queryFn: () => api.get<Note[]>(`/candidates/${id}/notes`),
    enabled: can('candidate.note.manage'),
  });

  const duplicates = useQuery({
    queryKey: ['candidate', id, 'duplicates'],
    queryFn: () => api.get<Duplicate[]>(`/candidates/${id}/duplicates`),
  });

  const activity = useQuery({
    queryKey: ['candidate', id, 'activity'],
    queryFn: () => api.get<Activity[]>(`/candidates/${id}/activity`),
  });

  const addNote = useMutation({
    mutationFn: () => api.post(`/candidates/${id}/notes`, { body: noteBody }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['candidate', id, 'notes'] });
      setNoteBody('');
      toast.success('Note added');
    },
    onError: (error) => toast.error('Could not add note', error instanceof ApiError ? error.message : undefined),
  });

  const addTag = useMutation({
    mutationFn: () => api.post(`/candidates/${id}/tags`, { name: tagName }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['candidate', id] });
      setTagName('');
      toast.success('Tag added');
    },
    onError: (error) => toast.error('Could not add tag', error instanceof ApiError ? error.message : undefined),
  });

  if (candidate.isLoading) return <PageLoader label="Loading candidate" />;
  if (candidate.isError || !candidate.data) {
    return <Alert tone="error" title="Could not load this candidate">You may not have access to this profile.</Alert>;
  }

  const data = candidate.data;

  return (
    <>
      <PageHeader
        title={data.fullName}
        description={`${data.candidateCode} · ${data.user?.email ?? ''}`}
      />

      {duplicates.data && duplicates.data.length > 0 && (
        <Alert tone="warning" title="Possible duplicate profiles" className="mb-4">
          <ul className="mt-1 space-y-1">
            {duplicates.data.map((duplicate) => (
              <li key={duplicate.id}>
                <Link to={`/candidates/${duplicate.id}`} className="text-primary hover:underline">
                  {duplicate.fullName} ({duplicate.candidateCode})
                </Link>
                <span className="text-xs text-muted-foreground"> — matched on {duplicate.matchedOn.join(', ')}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            Review before merging. Profiles are never merged automatically.
          </p>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {[
                  ['Email', data.user?.email],
                  ['Mobile', data.mobile],
                  ['Location', data.location],
                  ['Experience', data.totalExperience ? `${Number(data.totalExperience).toFixed(1)} yrs` : null],
                  ['Current role', data.currentDesignation],
                  ['Current company', data.currentCompany],
                  ['Education', data.highestEducation],
                  ['Notice period', data.noticePeriodDays != null ? `${data.noticePeriodDays} days` : null],
                  ['Expected salary', data.expectedSalary],
                  ['Preferred location', data.preferredLocation],
                  ['Preferred work mode', data.preferredWorkMode ? humanise(data.preferredWorkMode) : null],
                  ['Willing to relocate', data.willingToRelocate ? 'Yes' : 'No'],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-0.5 font-medium">{value || '—'}</dd>
                  </div>
                ))}
              </dl>

              {(data.linkedinUrl || data.portfolioUrl) && (
                <div className="mt-4 flex gap-4 border-t pt-4 text-sm">
                  {data.linkedinUrl && (
                    <a href={data.linkedinUrl} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline">
                      LinkedIn
                    </a>
                  )}
                  {data.portfolioUrl && (
                    <a href={data.portfolioUrl} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline">
                      Portfolio
                    </a>
                  )}
                </div>
              )}

              {data.summary && (
                <div className="mt-4 border-t pt-4">
                  <h3 className="mb-1 text-sm font-medium">Summary</h3>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{data.summary}</p>
                </div>
              )}

              {(data.skills?.length ?? 0) > 0 && (
                <div className="mt-4 border-t pt-4">
                  <h3 className="mb-2 text-sm font-medium">Skills</h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {data.skills!.map((entry) => (
                      <li key={entry.skill.id}>
                        <Badge tone="info">
                          {entry.skill.name}
                          {entry.years && <span className="opacity-70">{Number(entry.years).toFixed(0)}y</span>}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Applications</CardTitle></CardHeader>
            <CardContent>
              {(data.applications?.length ?? 0) > 0 ? (
                <ul className="divide-y">
                  {data.applications!.map((application) => (
                    <li key={application.id}>
                      <Link to={`/applications/${application.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-muted/40">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{application.job?.title}</p>
                          <p className="font-mono text-xs text-muted-foreground">{application.applicationCode}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <StageBadge stage={application.currentStage} />
                          <ApplicationStatusBadge status={application.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No applications yet.</p>
              )}
            </CardContent>
          </Card>

          {can('candidate.note.manage') && (
            <Card>
              <CardHeader><CardTitle>Recruiter notes</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Textarea
                    rows={2}
                    value={noteBody}
                    onChange={(event) => setNoteBody(event.target.value)}
                    placeholder="Internal note — never visible to the candidate."
                    aria-label="New note"
                  />
                  <Button onClick={() => addNote.mutate()} isLoading={addNote.isPending} disabled={!noteBody.trim()} leftIcon={<MessageSquarePlus />}>
                    Add
                  </Button>
                </div>

                {notes.data && notes.data.length > 0 ? (
                  <ul className="divide-y">
                    {notes.data.map((note) => (
                      <li key={note.id} className="py-2.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-xs font-medium">{note.author.firstName} {note.author.lastName}</p>
                          <time className="text-xs text-muted-foreground" dateTime={note.createdAt}>{formatDateTime(note.createdAt)}</time>
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
            <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
            <CardContent>
              {(data.documents?.length ?? 0) > 0 ? (
                <ul className="space-y-2">
                  {data.documents!.map((document) => (
                    <li key={document.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{document.originalName}</p>
                        <p className="text-xs text-muted-foreground">
                          {humanise(document.documentType)} · v{document.version} · {formatBytes(document.sizeBytes)}
                          {document.isCurrent && ' · current'}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Download ${document.originalName}`}
                        onClick={() => void downloadFile(`/documents/${document.id}/download`, document.originalName)}
                      >
                        <Download className="size-4" aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No documents uploaded.</p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Documents are private. Every download is recorded.
              </p>
            </CardContent>
          </Card>

          {can('candidate.tag.manage') && (
            <Card>
              <CardHeader><CardTitle>Tags</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={tagName}
                    onChange={(event) => setTagName(event.target.value)}
                    placeholder="Add a tag"
                    aria-label="Tag name"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && tagName.trim()) {
                        event.preventDefault();
                        addTag.mutate();
                      }
                    }}
                  />
                  <Button size="icon" onClick={() => addTag.mutate()} disabled={!tagName.trim()} aria-label="Add tag">
                    <Tag className="size-4" aria-hidden="true" />
                  </Button>
                </div>
                {(data.tags?.length ?? 0) > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {data.tags!.map((entry) => (
                      <li key={entry.tag.id}>
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ background: `${entry.tag.colour}1a`, color: entry.tag.colour }}
                        >
                          {entry.tag.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No tags.</p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
            <CardContent>
              {activity.data && activity.data.length > 0 ? (
                <ul className="space-y-2.5">
                  {activity.data.slice(0, 15).map((item) => (
                    <li key={item.id} className="text-sm">
                      <p className="font-medium">{humanise(item.activity)}</p>
                      {item.detail && <p className="text-xs text-muted-foreground">{item.detail}</p>}
                      <time className="text-xs text-muted-foreground" dateTime={item.createdAt}>
                        {formatDate(item.createdAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No activity recorded.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
