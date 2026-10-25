import { ApplicationStage, ApplicationStatus, JobStatus, OfferStatus } from '@prisma/client';

export const ACCESS_COOKIE = 'hr_ats_access';
export const REFRESH_COOKIE = 'hr_ats_refresh';
export const CSRF_COOKIE = 'hr_ats_csrf';
export const CSRF_HEADER = 'x-csrf-token';

/**
 * Allowed job-requirement status transitions.
 * Enforced server-side in JobsService -- the UI only mirrors this.
 */
export const JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['PUBLISHED', 'ON_HOLD', 'CANCELLED'],
  PUBLISHED: ['ON_HOLD', 'CLOSED', 'CANCELLED'],
  ON_HOLD: ['PUBLISHED', 'APPROVED', 'CLOSED', 'CANCELLED'],
  CLOSED: ['PUBLISHED'], // reopening a filled vacancy, when permitted
  CANCELLED: [], // terminal
};

/** The 12 default recruitment stages, in order. */
export const STAGE_ORDER: ApplicationStage[] = [
  'APPLIED',
  'RESUME_SCREENING',
  'HR_SCREENING',
  'SHORTLISTED',
  'ASSESSMENT',
  'TECHNICAL_INTERVIEW',
  'HR_INTERVIEW',
  'FINAL_INTERVIEW',
  'SELECTED',
  'OFFER_RELEASED',
  'OFFER_ACCEPTED',
  'HIRED',
];

export const STAGE_LABELS: Record<ApplicationStage, string> = {
  APPLIED: 'Applied',
  RESUME_SCREENING: 'Resume Screening',
  HR_SCREENING: 'HR Screening',
  SHORTLISTED: 'Shortlisted',
  ASSESSMENT: 'Assessment / Test',
  TECHNICAL_INTERVIEW: 'Technical Interview',
  HR_INTERVIEW: 'HR Interview',
  FINAL_INTERVIEW: 'Final Interview',
  SELECTED: 'Selected',
  OFFER_RELEASED: 'Offer Released',
  OFFER_ACCEPTED: 'Offer Accepted',
  HIRED: 'Hired',
};

/**
 * Statuses in which an application is no longer competing for the role.
 * Reaching one of these clears `activeJobKey`, releasing the unique
 * constraint so the candidate may apply again later.
 */
export const TERMINAL_APPLICATION_STATUSES: ApplicationStatus[] = [
  'REJECTED',
  'WITHDRAWN',
  'OFFER_DECLINED',
  'HIRED',
];

/**
 * Stage progression rules.
 *
 * Forward movement must be to the next stage or a later one (recruiters
 * routinely skip Assessment), and backward movement is allowed by one
 * step for correcting mistakes. Arbitrary jumps are rejected.
 */
export function isValidStageTransition(
  from: ApplicationStage,
  to: ApplicationStage,
): boolean {
  if (from === to) return false;
  const fromIndex = STAGE_ORDER.indexOf(from);
  const toIndex = STAGE_ORDER.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) return false;

  // HIRED may only be reached from OFFER_ACCEPTED -- an offer being sent
  // must never by itself mark someone as hired.
  if (to === 'HIRED') return from === 'OFFER_ACCEPTED';

  // OFFER_ACCEPTED is driven by the candidate's response on the offer,
  // not by a manual drag on the pipeline board.
  if (to === 'OFFER_ACCEPTED') return from === 'OFFER_RELEASED';

  if (toIndex > fromIndex) return true;
  return fromIndex - toIndex === 1;
}

export const OFFER_TRANSITIONS: Record<OfferStatus, OfferStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'WITHDRAWN'],
  PENDING_APPROVAL: ['APPROVED', 'DRAFT', 'WITHDRAWN'],
  APPROVED: ['SENT', 'WITHDRAWN'],
  SENT: ['ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN'],
  ACCEPTED: [],
  DECLINED: [],
  EXPIRED: [],
  WITHDRAWN: [],
};

/** Default follow-up SLA per stage, in days. Drives overdue indicators. */
export const STAGE_FOLLOWUP_DAYS: Partial<Record<ApplicationStage, number>> = {
  APPLIED: 3,
  RESUME_SCREENING: 3,
  HR_SCREENING: 5,
  SHORTLISTED: 5,
  ASSESSMENT: 7,
  TECHNICAL_INTERVIEW: 5,
  HR_INTERVIEW: 5,
  FINAL_INTERVIEW: 5,
  SELECTED: 3,
  OFFER_RELEASED: 7,
};

/** Executables and scripts that must never be accepted as uploads. */
export const BLOCKED_UPLOAD_EXTENSIONS = [
  '.exe', '.dll', '.bat', '.cmd', '.com', '.scr', '.msi', '.ps1', '.psm1',
  '.sh', '.bash', '.js', '.mjs', '.cjs', '.jar', '.php', '.phtml', '.asp',
  '.aspx', '.jsp', '.py', '.rb', '.pl', '.vbs', '.wsf', '.hta', '.lnk',
  '.svg', '.html', '.htm', '.xhtml',
];

export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGIN_LOCKED: 'LOGIN_LOCKED',
  LOGOUT: 'LOGOUT',
  MFA_ENABLED: 'MFA_ENABLED',
  MFA_FAILED: 'MFA_FAILED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',
  TOKEN_REUSE_DETECTED: 'TOKEN_REUSE_DETECTED',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  USER_CREATED: 'USER_CREATED',
  ROLE_ASSIGNED: 'ROLE_ASSIGNED',
  JOB_CREATED: 'JOB_CREATED',
  JOB_SUBMITTED: 'JOB_SUBMITTED',
  JOB_APPROVED: 'JOB_APPROVED',
  JOB_REJECTED: 'JOB_REJECTED',
  JOB_PUBLISHED: 'JOB_PUBLISHED',
  JOB_STATUS_CHANGED: 'JOB_STATUS_CHANGED',
  APPLICATION_CREATED: 'APPLICATION_CREATED',
  APPLICATION_STAGE_CHANGED: 'APPLICATION_STAGE_CHANGED',
  DOCUMENT_UPLOADED: 'DOCUMENT_UPLOADED',
  DOCUMENT_DOWNLOADED: 'DOCUMENT_DOWNLOADED',
  DOCUMENT_ACCESS_DENIED: 'DOCUMENT_ACCESS_DENIED',
  INTERVIEW_SCHEDULED: 'INTERVIEW_SCHEDULED',
  FEEDBACK_SUBMITTED: 'FEEDBACK_SUBMITTED',
  OFFER_CREATED: 'OFFER_CREATED',
  OFFER_APPROVED: 'OFFER_APPROVED',
  OFFER_SENT: 'OFFER_SENT',
  OFFER_RESPONDED: 'OFFER_RESPONDED',
  ONBOARDING_STARTED: 'ONBOARDING_STARTED',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
} as const;
