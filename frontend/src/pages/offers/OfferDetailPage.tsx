import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Send, XCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatCurrency, formatDate, formatDateTime, humanise } from '@/lib/utils';
import type { Offer } from '@/lib/types';
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
import { OfferStatusBadge } from '@/components/ui/status';
import { ConfirmDialog, Dialog, useToast } from '@/components/ui/feedback';

export default function OfferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can, user } = useAuth();

  const [sendOpen, setSendOpen] = useState(false);
  const [respondOpen, setRespondOpen] = useState<'accept' | 'decline' | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const offer = useQuery({
    queryKey: ['offer', id],
    queryFn: () => api.get<Offer>(`/offers/${id}`),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['offer', id] });
    void queryClient.invalidateQueries({ queryKey: ['offers'] });
  };

  const send = useMutation({
    mutationFn: () => api.post(`/offers/${id}/send`),
    onSuccess: () => {
      invalidate();
      setSendOpen(false);
      toast.success('Offer sent', 'The candidate has been notified.');
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Could not send the offer.');
      setSendOpen(false);
    },
  });

  const respond = useMutation({
    mutationFn: (accept: boolean) =>
      api.post(`/offers/${id}/respond`, {
        accept,
        declineReason: accept ? undefined : declineReason,
      }),
    onSuccess: (_, accept) => {
      invalidate();
      setRespondOpen(null);
      toast.success(accept ? 'Offer accepted' : 'Offer declined');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not record your response.'),
  });

  if (offer.isLoading) return <PageLoader label="Loading offer" />;
  if (offer.isError || !offer.data) {
    return <Alert tone="error" title="Could not load this offer">You may not have access to it.</Alert>;
  }

  const data = offer.data;
  const isMyOffer = user?.candidateId === data.candidateId;
  const canRespond = isMyOffer && data.status === 'SENT';
  const canSend = can('offer.send') && data.status === 'APPROVED';

  return (
    <>
      <PageHeader
        title={`Offer — ${data.candidate?.fullName ?? ''}`}
        description={`${data.offerCode} · ${data.job?.title ?? ''}`}
        actions={
          <>
            {canSend && (
              <Button size="sm" onClick={() => setSendOpen(true)} leftIcon={<Send />}>
                Send to candidate
              </Button>
            )}
            {canRespond && (
              <>
                <Button size="sm" onClick={() => setRespondOpen('accept')} leftIcon={<CheckCircle2 />}>
                  Accept offer
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRespondOpen('decline')} leftIcon={<XCircle />}>
                  Decline
                </Button>
              </>
            )}
          </>
        }
      />

      {error && <Alert tone="error" className="mb-4">{error}</Alert>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Offer terms</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {[
                  ['Proposed designation', data.proposedDesignation],
                  ['Department', data.departmentName ?? '—'],
                  ['Annual salary', formatCurrency(data.annualSalary, data.currency)],
                  ['Bonus', data.bonus ? formatCurrency(data.bonus, data.currency) : '—'],
                  ['Joining date', formatDate(data.joiningDate)],
                  ['Issued', formatDate(data.issuedAt)],
                  ['Expires', formatDate(data.expiresAt)],
                  ['Revision', String(data.revision)],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-0.5 font-medium">{value}</dd>
                  </div>
                ))}
              </dl>

              {data.benefits && (
                <div className="mt-4 border-t pt-4">
                  <h3 className="mb-1 text-sm font-medium">Benefits</h3>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{data.benefits}</p>
                </div>
              )}

              {data.declineReason && (
                <Alert tone="warning" title="Declined" className="mt-4">
                  {data.declineReason}
                </Alert>
              )}
            </CardContent>
          </Card>

          {data.approvals && data.approvals.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Approvals</CardTitle></CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {data.approvals.map((approval) => (
                    <li key={approval.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium">
                          {approval.approver.firstName} {approval.approver.lastName}
                        </p>
                        {approval.comments && <p className="text-xs text-muted-foreground">{approval.comments}</p>}
                      </div>
                      <Badge
                        tone={
                          approval.decision === 'APPROVED' ? 'success'
                            : approval.decision === 'REJECTED' ? 'danger' : 'warning'
                        }
                      >
                        {humanise(approval.decision)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Status</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <OfferStatusBadge status={data.status} />
              {data.respondedAt && (
                <p className="text-xs text-muted-foreground">
                  Responded {formatDateTime(data.respondedAt)}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Sending an offer does not mark the candidate as hired — that happens only when
                they accept and onboarding is completed.
              </p>
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

      <ConfirmDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        title="Send this offer?"
        message="The candidate is emailed and their application moves to Offer Released. Offer terms can no longer be edited."
        confirmLabel="Send offer"
        isLoading={send.isPending}
        onConfirm={() => send.mutate()}
      />

      <Dialog
        open={respondOpen !== null}
        onOpenChange={(open) => !open && setRespondOpen(null)}
        title={respondOpen === 'accept' ? 'Accept this offer' : 'Decline this offer'}
        description={
          respondOpen === 'accept'
            ? 'Accepting starts your onboarding. HR will be in touch with next steps.'
            : 'Please tell us why — it helps us improve our hiring process.'
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setRespondOpen(null)}>Cancel</Button>
            <Button
              variant={respondOpen === 'decline' ? 'destructive' : 'primary'}
              onClick={() => respond.mutate(respondOpen === 'accept')}
              isLoading={respond.isPending}
              disabled={respondOpen === 'decline' && !declineReason.trim()}
            >
              {respondOpen === 'accept' ? 'Accept offer' : 'Decline offer'}
            </Button>
          </>
        }
      >
        {respondOpen === 'decline' && (
          <Field label="Reason for declining" htmlFor="decline-reason" required>
            <Textarea
              id="decline-reason"
              rows={3}
              value={declineReason}
              onChange={(event) => setDeclineReason(event.target.value)}
            />
          </Field>
        )}
      </Dialog>
    </>
  );
}
