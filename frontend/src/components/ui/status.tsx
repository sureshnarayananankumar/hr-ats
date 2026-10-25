import { Badge } from './primitives';
import {
  APPLICATION_STATUS_TONE,
  JOB_STATUS_TONE,
  OFFER_STATUS_TONE,
  STAGE_LABELS,
  humanise,
  type BadgeTone,
} from '@/lib/utils';
import type {
  ApplicationStage,
  ApplicationStatus,
  JobStatus,
  OfferStatus,
  OnboardingStatus,
  InterviewStatus,
  Recommendation,
} from '@/lib/types';

/**
 * Status badges.
 *
 * Tone is driven by the shared maps in lib/utils so a given status looks
 * identical on the dashboard, in a table and on a pipeline card.
 * Each badge also carries readable text -- colour is never the only
 * channel conveying meaning.
 */

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge tone={JOB_STATUS_TONE[status]}>{humanise(status)}</Badge>;
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge tone={APPLICATION_STATUS_TONE[status] ?? 'neutral'}>{humanise(status)}</Badge>;
}

export function StageBadge({ stage }: { stage: ApplicationStage }) {
  // Later stages read as progressively more positive.
  const tone: BadgeTone =
    stage === 'HIRED'
      ? 'success'
      : stage === 'OFFER_ACCEPTED' || stage === 'OFFER_RELEASED' || stage === 'SELECTED'
        ? 'info'
        : 'neutral';
  return <Badge tone={tone}>{STAGE_LABELS[stage]}</Badge>;
}

export function OfferStatusBadge({ status }: { status: OfferStatus }) {
  return <Badge tone={OFFER_STATUS_TONE[status]}>{humanise(status)}</Badge>;
}

export function InterviewStatusBadge({ status }: { status: InterviewStatus }) {
  const tone: BadgeTone = {
    SCHEDULED: 'info',
    RESCHEDULED: 'warning',
    COMPLETED: 'success',
    CANCELLED: 'danger',
    NO_SHOW: 'danger',
  }[status] as BadgeTone;
  return <Badge tone={tone}>{humanise(status)}</Badge>;
}

export function OnboardingStatusBadge({ status }: { status: OnboardingStatus }) {
  const tone: BadgeTone = {
    OFFER_ACCEPTED: 'info',
    PREBOARDING: 'warning',
    JOINED: 'success',
    DID_NOT_JOIN: 'danger',
  }[status] as BadgeTone;
  return <Badge tone={tone}>{humanise(status)}</Badge>;
}

export function RecommendationBadge({ value }: { value: Recommendation }) {
  const tone: BadgeTone = {
    STRONG_HIRE: 'success',
    HIRE: 'success',
    HOLD: 'warning',
    NO_HIRE: 'danger',
  }[value] as BadgeTone;
  return <Badge tone={tone}>{humanise(value)}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const tones: Record<string, BadgeTone> = {
    LOW: 'neutral',
    MEDIUM: 'info',
    HIGH: 'warning',
    CRITICAL: 'danger',
  };
  return <Badge tone={tones[priority] ?? 'neutral'}>{humanise(priority)}</Badge>;
}

/** Star rating display used by interview scorecards. */
export function RatingDisplay({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="inline-flex items-center gap-1" title={`${value} out of ${max}`}>
      <span aria-hidden="true" className="text-sm tracking-tight">
        {'★'.repeat(Math.round(value))}
        <span className="text-muted-foreground/40">{'★'.repeat(Math.max(0, max - Math.round(value)))}</span>
      </span>
      <span className="sr-only">{`Rated ${value} out of ${max}`}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{value.toFixed(1)}</span>
    </span>
  );
}
