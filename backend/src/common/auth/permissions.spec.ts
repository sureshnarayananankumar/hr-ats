import { PERMISSIONS, ROLE_PERMISSIONS, ROLE_LABELS } from './permissions';
import type { RoleName } from '@prisma/client';

const ALL_ROLES: RoleName[] = [
  'SUPER_ADMIN',
  'HR_ADMIN',
  'RECRUITER',
  'HIRING_MANAGER',
  'INTERVIEWER',
  'CANDIDATE',
];

/**
 * The permission bundles are the authorization model. A mistake here —
 * especially one that grants a candidate an ".any" permission — would
 * expose every other candidate's data, so these are asserted directly.
 */
describe('Permission catalogue', () => {
  it('defines a bundle and a label for every role', () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
      expect(ROLE_LABELS[role]).toBeTruthy();
    }
  });

  it('uses the "resource.action" naming convention throughout', () => {
    for (const key of Object.values(PERMISSIONS)) {
      expect(key).toMatch(/^[a-z_]+(\.[a-z_]+)+$/);
    }
  });

  it('contains no duplicate keys', () => {
    const keys = Object.values(PERMISSIONS);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('only grants roles permissions that exist in the catalogue', () => {
    const catalogue = new Set<string>(Object.values(PERMISSIONS));
    for (const role of ALL_ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(catalogue.has(permission)).toBe(true);
      }
    }
  });
});

describe('CANDIDATE role is confined to its own records', () => {
  const candidate = ROLE_PERMISSIONS.CANDIDATE;

  // The single most important assertion in this file.
  it('holds no ".any" permission of any kind', () => {
    const anyPermissions = candidate.filter((permission) => permission.endsWith('.any'));
    expect(anyPermissions).toEqual([]);
  });

  it('cannot read the candidate directory', () => {
    expect(candidate).not.toContain(PERMISSIONS.CANDIDATE_READ_ANY);
  });

  it('cannot read other applications, interviews or documents', () => {
    expect(candidate).not.toContain(PERMISSIONS.APPLICATION_READ_ANY);
    expect(candidate).not.toContain(PERMISSIONS.INTERVIEW_READ_ANY);
    expect(candidate).not.toContain(PERMISSIONS.DOCUMENT_READ_ANY);
  });

  it('cannot read interview feedback written about them', () => {
    expect(candidate).not.toContain(PERMISSIONS.FEEDBACK_READ_ANY);
    expect(candidate).not.toContain(PERMISSIONS.FEEDBACK_SUBMIT);
  });

  it('cannot move an application between stages', () => {
    expect(candidate).not.toContain(PERMISSIONS.APPLICATION_TRANSITION);
  });

  it('cannot reach administration, settings or audit logs', () => {
    expect(candidate).not.toContain(PERMISSIONS.USER_READ);
    expect(candidate).not.toContain(PERMISSIONS.USER_CREATE);
    expect(candidate).not.toContain(PERMISSIONS.ROLE_ASSIGN);
    expect(candidate).not.toContain(PERMISSIONS.SETTINGS_READ);
    expect(candidate).not.toContain(PERMISSIONS.AUDIT_READ);
  });

  it('cannot view the HR dashboard or reports', () => {
    expect(candidate).not.toContain(PERMISSIONS.DASHBOARD_VIEW);
    expect(candidate).not.toContain(PERMISSIONS.REPORT_VIEW);
    expect(candidate).not.toContain(PERMISSIONS.REPORT_EXPORT);
  });

  it('cannot export any data', () => {
    const exports = candidate.filter((permission) => permission.includes('export'));
    expect(exports).toEqual([]);
  });

  it('can manage its own profile, documents and applications', () => {
    expect(candidate).toContain(PERMISSIONS.CANDIDATE_READ_OWN);
    expect(candidate).toContain(PERMISSIONS.CANDIDATE_UPDATE_OWN);
    expect(candidate).toContain(PERMISSIONS.DOCUMENT_UPLOAD_OWN);
    expect(candidate).toContain(PERMISSIONS.APPLICATION_CREATE_OWN);
    expect(candidate).toContain(PERMISSIONS.APPLICATION_WITHDRAW_OWN);
    expect(candidate).toContain(PERMISSIONS.OFFER_RESPOND_OWN);
  });
});

describe('INTERVIEWER role is narrow', () => {
  const interviewer = ROLE_PERMISSIONS.INTERVIEWER;

  it('can submit feedback for assigned interviews', () => {
    expect(interviewer).toContain(PERMISSIONS.FEEDBACK_SUBMIT);
    expect(interviewer).toContain(PERMISSIONS.INTERVIEW_READ_ASSIGNED);
  });

  it('cannot schedule, reschedule or cancel interviews', () => {
    expect(interviewer).not.toContain(PERMISSIONS.INTERVIEW_SCHEDULE);
    expect(interviewer).not.toContain(PERMISSIONS.INTERVIEW_RESCHEDULE);
    expect(interviewer).not.toContain(PERMISSIONS.INTERVIEW_CANCEL);
  });

  it('cannot move applications or touch offers', () => {
    expect(interviewer).not.toContain(PERMISSIONS.APPLICATION_TRANSITION);
    expect(interviewer).not.toContain(PERMISSIONS.OFFER_READ_ANY);
    expect(interviewer).not.toContain(PERMISSIONS.OFFER_CREATE);
  });
});

describe('RECRUITER role', () => {
  const recruiter = ROLE_PERMISSIONS.RECRUITER;

  it('works on assigned records, not all records', () => {
    expect(recruiter).toContain(PERMISSIONS.JOB_READ_ASSIGNED);
    expect(recruiter).toContain(PERMISSIONS.APPLICATION_READ_ASSIGNED);
    expect(recruiter).not.toContain(PERMISSIONS.JOB_READ_ANY);
    expect(recruiter).not.toContain(PERMISSIONS.APPLICATION_READ_ANY);
  });

  it('cannot approve or publish requirements', () => {
    expect(recruiter).not.toContain(PERMISSIONS.JOB_APPROVE);
    expect(recruiter).not.toContain(PERMISSIONS.JOB_PUBLISH);
  });

  it('cannot create or approve offers', () => {
    expect(recruiter).not.toContain(PERMISSIONS.OFFER_CREATE);
    expect(recruiter).not.toContain(PERMISSIONS.OFFER_APPROVE);
    expect(recruiter).not.toContain(PERMISSIONS.OFFER_SEND);
  });

  it('cannot administer users or read audit logs', () => {
    expect(recruiter).not.toContain(PERMISSIONS.USER_CREATE);
    expect(recruiter).not.toContain(PERMISSIONS.AUDIT_READ);
  });
});

describe('HR_ADMIN role', () => {
  const hrAdmin = ROLE_PERMISSIONS.HR_ADMIN;

  it('can run the full recruitment lifecycle', () => {
    expect(hrAdmin).toEqual(
      expect.arrayContaining([
        PERMISSIONS.JOB_CREATE,
        PERMISSIONS.JOB_APPROVE,
        PERMISSIONS.JOB_PUBLISH,
        PERMISSIONS.APPLICATION_READ_ANY,
        PERMISSIONS.OFFER_CREATE,
        PERMISSIONS.OFFER_SEND,
        PERMISSIONS.ONBOARDING_MANAGE,
      ]),
    );
  });

  // Section 4 assigns audit logs, permissions and settings to Super Admin.
  it('cannot read audit logs', () => {
    expect(hrAdmin).not.toContain(PERMISSIONS.AUDIT_READ);
  });

  it('cannot manage permissions or system settings', () => {
    expect(hrAdmin).not.toContain(PERMISSIONS.PERMISSION_MANAGE);
    expect(hrAdmin).not.toContain(PERMISSIONS.SETTINGS_UPDATE);
  });

  it('cannot create or deactivate users', () => {
    expect(hrAdmin).not.toContain(PERMISSIONS.USER_CREATE);
    expect(hrAdmin).not.toContain(PERMISSIONS.USER_DEACTIVATE);
    expect(hrAdmin).not.toContain(PERMISSIONS.ROLE_ASSIGN);
  });
});

describe('SUPER_ADMIN role', () => {
  it('holds every permission in the catalogue', () => {
    const all = Object.values(PERMISSIONS);
    expect(ROLE_PERMISSIONS.SUPER_ADMIN).toHaveLength(all.length);
    for (const permission of all) {
      expect(ROLE_PERMISSIONS.SUPER_ADMIN).toContain(permission);
    }
  });

  it('is the only role holding audit.read', () => {
    const holders = ALL_ROLES.filter((role) =>
      ROLE_PERMISSIONS[role].includes(PERMISSIONS.AUDIT_READ),
    );
    expect(holders).toEqual(['SUPER_ADMIN']);
  });

  it('is the only role able to assign roles', () => {
    const holders = ALL_ROLES.filter((role) =>
      ROLE_PERMISSIONS[role].includes(PERMISSIONS.ROLE_ASSIGN),
    );
    expect(holders).toEqual(['SUPER_ADMIN']);
  });
});
