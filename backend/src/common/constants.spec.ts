import {
  JOB_TRANSITIONS,
  OFFER_TRANSITIONS,
  STAGE_ORDER,
  STAGE_LABELS,
  TERMINAL_APPLICATION_STATUSES,
  isValidStageTransition,
  BLOCKED_UPLOAD_EXTENSIONS,
} from './constants';
import type { ApplicationStage } from '@prisma/client';

/**
 * These rules decide whether a candidate can be marked hired, whether a
 * job can be published, and whether a rejected application can be
 * revived. They are enforced in services, so a regression here is a
 * business-logic failure rather than a cosmetic one.
 */
describe('Recruitment stage transitions', () => {
  it('defines all 12 default stages in order', () => {
    expect(STAGE_ORDER).toHaveLength(12);
    expect(STAGE_ORDER[0]).toBe('APPLIED');
    expect(STAGE_ORDER[11]).toBe('HIRED');
  });

  it('labels every stage', () => {
    for (const stage of STAGE_ORDER) {
      expect(STAGE_LABELS[stage]).toBeTruthy();
    }
  });

  it('allows moving to the next stage', () => {
    expect(isValidStageTransition('APPLIED', 'RESUME_SCREENING')).toBe(true);
    expect(isValidStageTransition('RESUME_SCREENING', 'HR_SCREENING')).toBe(true);
    expect(isValidStageTransition('SHORTLISTED', 'ASSESSMENT')).toBe(true);
  });

  it('allows skipping forward (recruiters routinely skip Assessment)', () => {
    expect(isValidStageTransition('SHORTLISTED', 'TECHNICAL_INTERVIEW')).toBe(true);
    expect(isValidStageTransition('APPLIED', 'SHORTLISTED')).toBe(true);
  });

  it('allows stepping back exactly one stage to correct a mistake', () => {
    expect(isValidStageTransition('HR_SCREENING', 'RESUME_SCREENING')).toBe(true);
    expect(isValidStageTransition('SHORTLISTED', 'HR_SCREENING')).toBe(true);
  });

  it('rejects stepping back more than one stage', () => {
    expect(isValidStageTransition('FINAL_INTERVIEW', 'APPLIED')).toBe(false);
    expect(isValidStageTransition('SELECTED', 'SHORTLISTED')).toBe(false);
  });

  it('rejects a transition to the same stage', () => {
    for (const stage of STAGE_ORDER) {
      expect(isValidStageTransition(stage, stage)).toBe(false);
    }
  });

  // The rule that stops "offer sent" being mistaken for "hired".
  it('only allows HIRED from OFFER_ACCEPTED', () => {
    expect(isValidStageTransition('OFFER_ACCEPTED', 'HIRED')).toBe(true);

    const others = STAGE_ORDER.filter(
      (stage) => stage !== 'OFFER_ACCEPTED' && stage !== 'HIRED',
    );
    for (const stage of others) {
      expect(isValidStageTransition(stage, 'HIRED')).toBe(false);
    }
  });

  it('only allows OFFER_ACCEPTED from OFFER_RELEASED', () => {
    expect(isValidStageTransition('OFFER_RELEASED', 'OFFER_ACCEPTED')).toBe(true);
    expect(isValidStageTransition('SELECTED', 'OFFER_ACCEPTED')).toBe(false);
    expect(isValidStageTransition('APPLIED', 'OFFER_ACCEPTED')).toBe(false);
  });

  it('rejects an unknown stage value', () => {
    expect(isValidStageTransition('NOT_A_STAGE' as ApplicationStage, 'APPLIED')).toBe(false);
    expect(isValidStageTransition('APPLIED', 'NOT_A_STAGE' as ApplicationStage)).toBe(false);
  });
});

describe('Job requirement status transitions', () => {
  it('requires approval before a draft can be published', () => {
    expect(JOB_TRANSITIONS.DRAFT).not.toContain('PUBLISHED');
    expect(JOB_TRANSITIONS.DRAFT).toContain('PENDING_APPROVAL');
    expect(JOB_TRANSITIONS.APPROVED).toContain('PUBLISHED');
  });

  it('lets a rejected submission return to draft for revision', () => {
    expect(JOB_TRANSITIONS.PENDING_APPROVAL).toContain('DRAFT');
  });

  it('treats CANCELLED as terminal', () => {
    expect(JOB_TRANSITIONS.CANCELLED).toHaveLength(0);
  });

  it('allows reopening a closed requirement', () => {
    expect(JOB_TRANSITIONS.CLOSED).toContain('PUBLISHED');
  });

  it('allows a published job to be held, closed or cancelled', () => {
    expect(JOB_TRANSITIONS.PUBLISHED).toEqual(
      expect.arrayContaining(['ON_HOLD', 'CLOSED', 'CANCELLED']),
    );
  });

  it('never allows a transition back into PENDING_APPROVAL from a live state', () => {
    expect(JOB_TRANSITIONS.PUBLISHED).not.toContain('PENDING_APPROVAL');
    expect(JOB_TRANSITIONS.CLOSED).not.toContain('PENDING_APPROVAL');
  });
});

describe('Offer status transitions', () => {
  it('requires approval before an offer can be sent', () => {
    expect(OFFER_TRANSITIONS.DRAFT).not.toContain('SENT');
    expect(OFFER_TRANSITIONS.APPROVED).toContain('SENT');
  });

  it('only allows a candidate response once the offer has been sent', () => {
    expect(OFFER_TRANSITIONS.SENT).toEqual(
      expect.arrayContaining(['ACCEPTED', 'DECLINED', 'EXPIRED']),
    );
    expect(OFFER_TRANSITIONS.DRAFT).not.toContain('ACCEPTED');
    expect(OFFER_TRANSITIONS.APPROVED).not.toContain('ACCEPTED');
  });

  it('treats every response as terminal', () => {
    expect(OFFER_TRANSITIONS.ACCEPTED).toHaveLength(0);
    expect(OFFER_TRANSITIONS.DECLINED).toHaveLength(0);
    expect(OFFER_TRANSITIONS.EXPIRED).toHaveLength(0);
    expect(OFFER_TRANSITIONS.WITHDRAWN).toHaveLength(0);
  });
});

describe('Terminal application statuses', () => {
  // Reaching one of these clears activeJobKey, which releases the
  // unique index so the candidate may apply for the job again.
  it('includes every outcome that ends an application', () => {
    expect(TERMINAL_APPLICATION_STATUSES).toEqual(
      expect.arrayContaining(['REJECTED', 'WITHDRAWN', 'OFFER_DECLINED', 'HIRED']),
    );
  });

  it('does not treat ACTIVE or ON_HOLD as terminal', () => {
    expect(TERMINAL_APPLICATION_STATUSES).not.toContain('ACTIVE');
    expect(TERMINAL_APPLICATION_STATUSES).not.toContain('ON_HOLD');
  });
});

describe('Upload extension blocklist', () => {
  it('blocks executables and scripts', () => {
    for (const extension of ['.exe', '.dll', '.bat', '.ps1', '.sh', '.js', '.php', '.jar']) {
      expect(BLOCKED_UPLOAD_EXTENSIONS).toContain(extension);
    }
  });

  // SVG and HTML are not malware, but they execute script in a browser,
  // which makes them a stored-XSS vector.
  it('blocks browser-executable document types', () => {
    for (const extension of ['.svg', '.html', '.htm', '.xhtml']) {
      expect(BLOCKED_UPLOAD_EXTENSIONS).toContain(extension);
    }
  });

  it('does not block the resume formats the system accepts', () => {
    for (const extension of ['.pdf', '.doc', '.docx']) {
      expect(BLOCKED_UPLOAD_EXTENSIONS).not.toContain(extension);
    }
  });
});
