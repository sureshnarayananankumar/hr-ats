import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, CalendarClock, FileSignature } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatDate, formatDateTime, STAGE_LABELS, STAGE_ORDER } from '@/lib/utils';
import type { JobApplication, Offer, Paginated } from '@/lib/types';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  PageHeader,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';
import { ApplicationStatusBadge, StageBadge } from '@/components/ui/status';
import { Dialog, useToast } from '@/components/ui/feedback';

/** Simple progress indicator across the 12 stages. */
function StageProgress({ application }: { application: JobApplication }) {
  const index = STAGE_ORDER.indexOf(application.currentStage);
  const percent = Math.round(((index + 1) / STAGE_ORDER.length) * 100);
  const isClosed = ['REJECTED', 'WITHDRAWN', 'OFFER_DECLINED'].includes(application.status);

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{STAGE_LABELS[application.currentStage]}</span>
        <span>{isClosed ? 'Closed' : `${percent}%`}</span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Application progress: ${STAGE_LABELS[application.currentStage]}`}
      >
        <div
          className={`h-full rounded-full transition-all ${isClosed ? 'bg-muted-foreground' : 'bg-primary'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export default function MyApplicationsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const applications = useQuery({
    queryKey: ['my-applications'],
    queryFn: () => api.get<Paginated<JobApplication>>('/applications', { pageSize: 50 }),
  });

  const offers = useQuery({
    queryKey: ['my-offers'],
    queryFn: () => api.get<Paginated<Offer>>('/offers', { pageSize: 20 }),
    retry: false,
  });

  const interviews = useQuery({
    queryKey: ['my-interviews'],
    queryFn: () =>
      api.get<Paginated<{ id: string; roundName: string; scheduledStart: string; status: string; job?: { title: string } }>>(
        '/interviews',
        { pageSize: 20, status: 'SCHEDULED,RESCHEDULED' },
      ),
    retry: false,
  });

  const withdraw = useMutation({
    mutationFn: () => api.patch(`/applications/${withdrawId}/withdraw`, { reason: withdrawReason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-applications'] });
      setWithdrawId(null);
      setWithdrawReason('');
      toast.success('Application withdrawn');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not withdraw.'),
  });

  const upcoming = (interviews.data?.data ?? []).filter(
    (interview) => new Date(interview.scheduledStart) > new Date(),
  );
  const liveOffers = (offers.data?.data ?? []).filter((offer) => offer.status === 'SENT');

  return (
    <>
      <PageHeader
        title="My applications"
        description="Track every role you have applied for."
      />

      {error && <Alert tone="error" className="mb-4">{error}</Alert>}

      {liveOffers.length > 0 && (
        <Card className="mb-4 border-success/40 bg-success/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileSignature className="size-4 text-success" aria-hidden="true" />
              You have {liveOffers.length} offer{liveOffers.length === 1 ? '' : 's'} awaiting your response
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {liveOffers.map((offer) => (
                <li key={offer.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{offer.proposedDesignation}</p>
                    <p className="text-xs text-muted-foreground">
                      {offer.job?.title} · joining {formatDate(offer.joiningDate)}
                      {offer.expiresAt && ` · expires ${formatDate(offer.expiresAt)}`}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => (window.location.href = `/offers/${offer.id}`)}>
                    Review offer
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {upcoming.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarClock className="size-4 text-info" aria-hidden="true" />
              Upcoming interviews
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {upcoming.map((interview) => (
                <li key={interview.id} className="text-sm">
                  <p className="font-medium">{interview.roundName}</p>
                  <p className="text-xs text-muted-foreground">
                    {interview.job?.title} · {formatDateTime(interview.scheduledStart)}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {applications.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full" />
          ))}
        </div>
      ) : (applications.data?.data.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            icon={<Briefcase className="size-6" />}
            title="You have not applied to any roles yet"
            description="Browse our open positions and submit your first application."
            action={
              <Button onClick={() => (window.location.href = '/careers')}>
                Browse open roles
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {applications.data!.data.map((application) => {
            const canWithdraw = !['REJECTED', 'WITHDRAWN', 'HIRED', 'OFFER_DECLINED'].includes(
              application.status,
            );

            return (
              <li key={application.id}>
                <Card>
                  <CardContent className="pt-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-semibold">{application.job?.title ?? 'Role'}</h2>
                        <p className="font-mono text-xs text-muted-foreground">
                          {application.applicationCode}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StageBadge stage={application.currentStage} />
                        <ApplicationStatusBadge status={application.status} />
                      </div>
                    </div>

                    <StageProgress application={application} />

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        Applied {formatDate(application.appliedAt)} · last updated{' '}
                        {formatDate(application.lastUpdatedAt)}
                      </p>
                      {canWithdraw && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setWithdrawId(application.id)}
                        >
                          Withdraw
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={withdrawId !== null}
        onOpenChange={(open) => !open && setWithdrawId(null)}
        title="Withdraw your application"
        description="This cannot be undone, but you may apply again for this role in future."
        footer={
          <>
            <Button variant="outline" onClick={() => setWithdrawId(null)}>Keep my application</Button>
            <Button variant="destructive" onClick={() => withdraw.mutate()} isLoading={withdraw.isPending}>
              Withdraw application
            </Button>
          </>
        }
      >
        <Field label="Reason" htmlFor="withdraw-reason" hint="Optional — it helps us improve.">
          <Textarea
            id="withdraw-reason"
            rows={3}
            value={withdrawReason}
            onChange={(event) => setWithdrawReason(event.target.value)}
          />
        </Field>
      </Dialog>
    </>
  );
}
