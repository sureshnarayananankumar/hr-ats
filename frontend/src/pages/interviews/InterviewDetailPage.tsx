import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarClock, MapPin, Video, Lock } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime, humanise } from '@/lib/utils';
import type { Interview, InterviewFeedback, Recommendation } from '@/lib/types';
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
import { InterviewStatusBadge, RatingDisplay, RecommendationBadge } from '@/components/ui/status';
import { useToast } from '@/components/ui/feedback';

const CRITERIA = [
  ['technicalSkills', 'Technical skills'],
  ['communication', 'Communication'],
  ['problemSolving', 'Problem solving'],
  ['relevantExperience', 'Relevant experience'],
  ['roleSuitability', 'Role suitability'],
  ['teamCollaboration', 'Team collaboration'],
] as const;

const RECOMMENDATIONS: Recommendation[] = ['STRONG_HIRE', 'HIRE', 'HOLD', 'NO_HIRE'];

const feedbackSchema = z.object({
  technicalSkills: z.coerce.number().min(1).max(5).optional(),
  communication: z.coerce.number().min(1).max(5).optional(),
  problemSolving: z.coerce.number().min(1).max(5).optional(),
  relevantExperience: z.coerce.number().min(1).max(5).optional(),
  roleSuitability: z.coerce.number().min(1).max(5).optional(),
  teamCollaboration: z.coerce.number().min(1).max(5).optional(),
  overallRating: z.coerce.number().min(1, 'An overall rating is required').max(5),
  strengths: z.string().max(5000).optional(),
  areasForImprovement: z.string().max(5000).optional(),
  comments: z.string().max(5000).optional(),
  recommendation: z.enum(['STRONG_HIRE', 'HIRE', 'HOLD', 'NO_HIRE']),
});

type FeedbackValues = z.infer<typeof feedbackSchema>;

const RATING_OPTIONS = [1, 2, 3, 4, 5].map((value) => ({
  value: String(value),
  label: `${value} — ${['Poor', 'Below expectation', 'Meets expectation', 'Strong', 'Exceptional'][value - 1]}`,
}));

export default function InterviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const interview = useQuery({
    queryKey: ['interview', id],
    queryFn: () => api.get<Interview>(`/interviews/${id}`),
  });

  const feedback = useQuery({
    queryKey: ['interview', id, 'feedback'],
    queryFn: () =>
      api.get<{
        feedback: InterviewFeedback[];
        summary: { count: number; averageRating: number | null; recommendations: Record<string, number> };
      }>(`/interviews/${id}/feedback`),
    // A 403 here is expected for users outside the panel; do not retry.
    retry: false,
  });

  const form = useForm<FeedbackValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { overallRating: 3, recommendation: 'HIRE' },
  });

  const submitFeedback = useMutation({
    mutationFn: (values: FeedbackValues) => api.post(`/interviews/${id}/feedback`, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['interview', id] });
      void queryClient.invalidateQueries({ queryKey: ['interviews'] });
      toast.success('Feedback submitted');
      form.reset();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not submit feedback.'),
  });

  if (interview.isLoading) return <PageLoader label="Loading interview" />;
  if (interview.isError || !interview.data) {
    return <Alert tone="error" title="Could not load this interview">You may not have access to it.</Alert>;
  }

  const data = interview.data;
  const canSubmitFeedback = can('interview.feedback.submit');

  return (
    <>
      <PageHeader
        title={`${data.roundName} — ${data.candidate?.fullName ?? 'Candidate'}`}
        description={`${data.interviewCode} · ${data.job?.title ?? ''}`}
      />

      {error && <Alert tone="error" className="mb-4">{error}</Alert>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>
                  {formatDateTime(data.scheduledStart)} – {formatDateTime(data.scheduledEnd)}
                  <span className="ml-1 text-muted-foreground">({data.timeZone})</span>
                </span>
              </div>

              {data.meetingLink && (
                <div className="flex items-center gap-2">
                  <Video className="size-4 text-muted-foreground" aria-hidden="true" />
                  <a href={data.meetingLink} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline">
                    Join meeting
                  </a>
                </div>
              )}

              {data.venue && (
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span>{data.venue}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <InterviewStatusBadge status={data.status} />
                <Badge>{humanise(data.interviewType)}</Badge>
                <Badge>Round {data.round}</Badge>
              </div>

              {data.instructions && (
                <div className="border-t pt-3">
                  <h3 className="mb-1 font-medium">Instructions</h3>
                  <p className="whitespace-pre-wrap text-muted-foreground">{data.instructions}</p>
                </div>
              )}

              {data.cancelReason && (
                <Alert tone="warning" title="Cancelled">{data.cancelReason}</Alert>
              )}
            </CardContent>
          </Card>

          {/* ---- Submit feedback ---- */}
          {canSubmitFeedback && (
            <Card>
              <CardHeader>
                <CardTitle>Your evaluation</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={form.handleSubmit((values) => submitFeedback.mutate(values))} className="space-y-4" noValidate>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {CRITERIA.map(([name, label]) => (
                      <Field key={name} label={label} htmlFor={name}>
                        <Controller
                          control={form.control}
                          name={name}
                          render={({ field }) => (
                            <Select
                              id={name}
                              value={field.value ? String(field.value) : ''}
                              onValueChange={(value) => field.onChange(Number(value))}
                              options={RATING_OPTIONS}
                              placeholder="Not assessed"
                            />
                          )}
                        />
                      </Field>
                    ))}
                  </div>

                  <Field
                    label="Overall rating"
                    htmlFor="overallRating"
                    error={form.formState.errors.overallRating?.message}
                    required
                  >
                    <Controller
                      control={form.control}
                      name="overallRating"
                      render={({ field }) => (
                        <Select
                          id="overallRating"
                          value={String(field.value ?? '')}
                          onValueChange={(value) => field.onChange(Number(value))}
                          options={RATING_OPTIONS}
                          hasError={Boolean(form.formState.errors.overallRating)}
                        />
                      )}
                    />
                  </Field>

                  <Field label="Strengths" htmlFor="strengths" hint="Give specific evidence from the interview.">
                    <Textarea id="strengths" rows={3} {...form.register('strengths')} />
                  </Field>

                  <Field label="Areas for improvement" htmlFor="areasForImprovement">
                    <Textarea id="areasForImprovement" rows={3} {...form.register('areasForImprovement')} />
                  </Field>

                  <Field label="Additional comments" htmlFor="comments">
                    <Textarea id="comments" rows={3} {...form.register('comments')} />
                  </Field>

                  <Field label="Recommendation" htmlFor="recommendation" required>
                    <Controller
                      control={form.control}
                      name="recommendation"
                      render={({ field }) => (
                        <Select
                          id="recommendation"
                          value={field.value}
                          onValueChange={field.onChange}
                          options={RECOMMENDATIONS.map((value) => ({ value, label: humanise(value) }))}
                        />
                      )}
                    />
                  </Field>

                  <Button type="submit" isLoading={submitFeedback.isPending}>
                    Submit evaluation
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Submitting again updates your existing evaluation. Candidates can never read this.
                  </p>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ---- Existing feedback ---- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="size-4 text-muted-foreground" aria-hidden="true" />
                Panel feedback
              </CardTitle>
            </CardHeader>
            <CardContent>
              {feedback.isError ? (
                <p className="text-sm text-muted-foreground">
                  You do not have permission to read this interview's feedback.
                </p>
              ) : feedback.data && feedback.data.feedback.length > 0 ? (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-4 rounded-md border bg-muted/30 p-3 text-sm">
                    <span>
                      <span className="text-muted-foreground">Submissions: </span>
                      <span className="font-medium tabular-nums">{feedback.data.summary.count}</span>
                    </span>
                    {feedback.data.summary.averageRating != null && (
                      <span className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Average:</span>
                        <RatingDisplay value={feedback.data.summary.averageRating} />
                      </span>
                    )}
                  </div>

                  <ul className="space-y-4">
                    {feedback.data.feedback.map((entry) => (
                      <li key={entry.id} className="rounded-md border p-3">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">
                            {entry.interviewer?.firstName} {entry.interviewer?.lastName}
                          </p>
                          <div className="flex items-center gap-2">
                            <RatingDisplay value={entry.overallRating} />
                            <RecommendationBadge value={entry.recommendation} />
                          </div>
                        </div>

                        <dl className="mb-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                          {CRITERIA.map(([name, label]) =>
                            entry[name] != null ? (
                              <div key={name} className="flex justify-between gap-2">
                                <dt className="text-muted-foreground">{label}</dt>
                                <dd className="font-medium tabular-nums">{entry[name]}/5</dd>
                              </div>
                            ) : null,
                          )}
                        </dl>

                        {entry.strengths && (
                          <p className="text-sm"><span className="font-medium">Strengths: </span>{entry.strengths}</p>
                        )}
                        {entry.areasForImprovement && (
                          <p className="text-sm"><span className="font-medium">To improve: </span>{entry.areasForImprovement}</p>
                        )}
                        {entry.comments && <p className="mt-1 text-sm text-muted-foreground">{entry.comments}</p>}
                        <time className="mt-2 block text-xs text-muted-foreground" dateTime={entry.submittedAt}>
                          {formatDateTime(entry.submittedAt)}
                        </time>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No feedback submitted yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Panel</CardTitle></CardHeader>
            <CardContent>
              {data.panel && data.panel.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {data.panel.map((member) => (
                    <li key={member.interviewerId} className="flex items-center justify-between gap-2">
                      <span>{member.interviewer.firstName} {member.interviewer.lastName}</span>
                      {member.isLead && <Badge tone="info">Lead</Badge>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Panel not visible.</p>
              )}
            </CardContent>
          </Card>

          {data.application && (
            <Card>
              <CardContent className="space-y-2 pt-5 text-sm">
                <p className="font-medium">{data.candidate?.fullName}</p>
                <p className="font-mono text-xs text-muted-foreground">{data.application.applicationCode}</p>
                <Link to={`/applications/${data.application.id}`} className="inline-block text-sm text-primary hover:underline">
                  View application
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
