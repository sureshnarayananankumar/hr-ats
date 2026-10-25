/**
 * Generates the JPA entity and repository classes that map the existing
 * hr_ats_db schema.
 *
 * These classes are almost entirely mechanical — column names, types and
 * nullability restated in Java. Generating them from one spec keeps them
 * consistent with each other and makes a schema change a one-line edit
 * rather than a hunt through 40 files.
 *
 * The interesting code (security, services, controllers) is hand-written.
 *
 *   node codegen/entities.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const ENTITY_DIR = path.join(root, 'src/main/java/com/businessgateways/hrats/domain/entity');
const REPO_DIR = path.join(root, 'src/main/java/com/businessgateways/hrats/repository');

fs.mkdirSync(ENTITY_DIR, { recursive: true });
fs.mkdirSync(REPO_DIR, { recursive: true });

// ---------------------------------------------------------------------
//  Field shorthands
// ---------------------------------------------------------------------
const str = (col, len, opts = {}) => ({ kind: 'string', col, len, ...opts });
const text = (col, opts = {}) => ({ kind: 'text', col, ...opts });
const int = (col, opts = {}) => ({ kind: 'int', col, ...opts });
const bool = (col, opts = {}) => ({ kind: 'bool', col, ...opts });
const dec = (col, p, s, opts = {}) => ({ kind: 'decimal', col, precision: p, scale: s, ...opts });
const ts = (col, opts = {}) => ({ kind: 'instant', col, ...opts });
const enm = (col, type, opts = {}) => ({ kind: 'enum', col, type, ...opts });
const many = (col, target, opts = {}) => ({ kind: 'manyToOne', col, target, ...opts });

/**
 * id: 'uuid'   -> CHAR(36), generated in the application
 * id: 'auto'   -> BIGINT AUTO_INCREMENT
 * id: 'none'   -> composite key, handled by an @IdClass
 */
const ENTITIES = [
  // ---------------- Access control ----------------
  {
    name: 'Role', table: 'roles', id: 'uuid',
    fields: [
      enm('name', 'RoleName', { nullable: false, unique: true }),
      str('label', 100, { nullable: false }),
      str('description', 500),
      bool('isSystem', { def: 'true' }),
      ts('createdAt', { created: true }),
      ts('updatedAt', { updated: true }),
    ],
  },
  {
    name: 'Permission', table: 'permissions', id: 'uuid',
    fields: [
      str('key', 100, { nullable: false, unique: true, field: 'permissionKey' }),
      str('resource', 50, { nullable: false }),
      str('action', 50, { nullable: false }),
      str('description', 500),
      ts('createdAt', { created: true }),
    ],
  },
  {
    name: 'RefreshSession', table: 'refresh_sessions', id: 'uuid',
    fields: [
      str('userId', 36, { nullable: false }),
      str('tokenHash', 255, { nullable: false, unique: true }),
      str('previousId', 36),
      str('userAgent', 400),
      str('ipAddress', 45),
      ts('expiresAt', { nullable: false }),
      ts('revokedAt'),
      str('revokedReason', 200),
      ts('createdAt', { created: true }),
    ],
  },
  {
    name: 'EmailVerificationToken', table: 'email_verification_tokens', id: 'uuid',
    fields: [
      str('userId', 36, { nullable: false }),
      str('tokenHash', 255, { nullable: false, unique: true }),
      ts('expiresAt', { nullable: false }),
      ts('usedAt'),
      ts('createdAt', { created: true }),
    ],
  },
  {
    name: 'PasswordResetToken', table: 'password_reset_tokens', id: 'uuid',
    fields: [
      str('userId', 36, { nullable: false }),
      str('tokenHash', 255, { nullable: false, unique: true }),
      ts('expiresAt', { nullable: false }),
      ts('usedAt'),
      str('requestIp', 45),
      ts('createdAt', { created: true }),
    ],
  },
  {
    name: 'LoginAttempt', table: 'login_attempts', id: 'auto',
    fields: [
      str('email', 255, { nullable: false }),
      str('ipAddress', 45, { nullable: false }),
      bool('successful', { nullable: false }),
      str('reason', 100),
      str('userAgent', 400),
      ts('createdAt', { created: true }),
    ],
  },

  // ---------------- Organisation ----------------
  {
    name: 'Department', table: 'departments', id: 'uuid',
    fields: [
      str('code', 20, { nullable: false, unique: true }),
      str('name', 150, { nullable: false, unique: true }),
      str('description', 500),
      str('headUserId', 36),
      bool('isActive', { def: 'true' }),
      ts('createdAt', { created: true }),
      ts('updatedAt', { updated: true }),
    ],
  },
  {
    name: 'Skill', table: 'skills', id: 'uuid',
    fields: [
      str('name', 100, { nullable: false, unique: true }),
      str('category', 60),
      ts('createdAt', { created: true }),
    ],
  },
  {
    name: 'RecruitmentSource', table: 'recruitment_sources', id: 'uuid',
    fields: [
      str('name', 100, { nullable: false, unique: true }),
      str('category', 60),
      dec('costPerMonth', 12, 2),
      bool('isActive', { def: 'true' }),
      ts('createdAt', { created: true }),
    ],
  },

  // ---------------- Requisitions ----------------
  {
    name: 'JobRequirement', table: 'job_requirements', id: 'uuid',
    fields: [
      str('requirementCode', 30, { nullable: false, unique: true }),
      str('title', 200, { nullable: false }),
      str('slug', 250, { nullable: false, unique: true }),
      text('description', { nullable: false }),
      text('responsibilities'),
      text('qualifications'),
      text('internalNotes'),
      int('minExperience', { def: '0' }),
      int('maxExperience', { boxed: true }),
      str('departmentId', 36, { nullable: false }),
      str('designation', 150, { nullable: false }),
      int('vacancies', { def: '1' }),
      int('vacanciesFilled', { def: '0' }),
      enm('employmentType', 'EmploymentType', { nullable: false }),
      enm('workMode', 'WorkMode', { nullable: false }),
      str('location', 200, { nullable: false }),
      dec('salaryMin', 14, 2),
      dec('salaryMax', 14, 2),
      str('salaryCurrency', 3, { def: '"USD"' }),
      bool('salaryConfidential', { def: 'true' }),
      enm('priority', 'Priority', { nullable: false }),
      enm('status', 'JobStatus', { nullable: false }),
      str('requestedById', 36, { nullable: false }),
      ts('requestDate', { nullable: false }),
      str('recruiterId', 36),
      str('hiringManagerId', 36),
      str('createdById', 36, { nullable: false }),
      ts('publishedAt'),
      ts('applicationDeadline'),
      ts('closedAt'),
      str('onHoldReason', 500),
      str('cancelReason', 500),
      str('duplicatedFromId', 36),
      ts('createdAt', { created: true }),
      ts('updatedAt', { updated: true }),
    ],
    relations: [
      { kind: 'manyToOne', field: 'department', target: 'Department', col: 'departmentId' },
      { kind: 'manyToOne', field: 'recruiter', target: 'User', col: 'recruiterId' },
      { kind: 'manyToOne', field: 'hiringManager', target: 'User', col: 'hiringManagerId' },
      { kind: 'manyToOne', field: 'requestedBy', target: 'User', col: 'requestedById' },
    ],
  },
  {
    name: 'JobSkill', table: 'job_skills', id: 'uuid',
    fields: [
      str('jobId', 36, { nullable: false }),
      str('skillId', 36, { nullable: false }),
      bool('isRequired', { def: 'true' }),
      int('minYears', { boxed: true }),
    ],
    relations: [{ kind: 'manyToOne', field: 'skill', target: 'Skill', col: 'skillId' }],
  },
  {
    name: 'JobApproval', table: 'job_approvals', id: 'uuid',
    fields: [
      str('jobId', 36, { nullable: false }),
      str('approverId', 36, { nullable: false }),
      int('sequence', { def: '1' }),
      enm('decision', 'ApprovalDecision', { nullable: false }),
      text('comments'),
      ts('decidedAt'),
      ts('createdAt', { created: true }),
    ],
    relations: [
      { kind: 'manyToOne', field: 'approver', target: 'User', col: 'approverId' },
      { kind: 'manyToOne', field: 'job', target: 'JobRequirement', col: 'jobId' },
    ],
  },
  {
    name: 'JobRequirementHistory', table: 'job_requirement_history', id: 'auto',
    fields: [
      str('jobId', 36, { nullable: false }),
      str('changedById', 36, { nullable: false }),
      str('fieldName', 80, { nullable: false }),
      text('oldValue'),
      text('newValue'),
      str('reason', 500),
      ts('changedAt', { created: true }),
    ],
  },

  // ---------------- Candidates ----------------
  {
    name: 'CandidateProfile', table: 'candidate_profiles', id: 'uuid',
    fields: [
      str('candidateCode', 30, { nullable: false, unique: true }),
      str('userId', 36, { nullable: false, unique: true }),
      str('fullName', 200, { nullable: false }),
      str('normalisedEmail', 255, { nullable: false }),
      str('normalisedPhone', 30),
      str('mobile', 30),
      str('location', 200),
      dec('totalExperience', 4, 1),
      str('currentDesignation', 150),
      str('currentCompany', 200),
      str('highestEducation', 200),
      text('educationDetails'),
      dec('expectedSalary', 14, 2),
      dec('currentSalary', 14, 2),
      str('salaryCurrency', 3, { def: '"USD"' }),
      int('noticePeriodDays', { boxed: true }),
      str('linkedinUrl', 400),
      str('portfolioUrl', 400),
      str('preferredLocation', 200),
      enm('preferredWorkMode', 'WorkMode'),
      enm('preferredEmploymentType', 'EmploymentType'),
      bool('willingToRelocate', { def: 'false' }),
      text('summary'),
      bool('consentToStoreData', { def: 'false' }),
      ts('consentAt'),
      ts('dataDeletionRequestedAt'),
      ts('createdAt', { created: true }),
      ts('updatedAt', { updated: true }),
    ],
    relations: [{ kind: 'oneToOne', field: 'user', target: 'User', col: 'userId' }],
  },
  {
    name: 'CandidateSkill', table: 'candidate_skills', id: 'uuid',
    fields: [
      str('candidateId', 36, { nullable: false }),
      str('skillId', 36, { nullable: false }),
      dec('years', 4, 1),
      enm('proficiency', 'SkillProficiency', { nullable: false }),
    ],
    relations: [{ kind: 'manyToOne', field: 'skill', target: 'Skill', col: 'skillId' }],
  },
  {
    name: 'CandidateDocument', table: 'candidate_documents', id: 'uuid',
    fields: [
      str('candidateId', 36, { nullable: false }),
      enm('documentType', 'DocumentType', { nullable: false }),
      str('originalName', 255, { nullable: false }),
      str('storageKey', 255, { nullable: false, unique: true }),
      str('mimeType', 150, { nullable: false }),
      int('sizeBytes', { nullable: false }),
      str('checksum', 64, { nullable: false }),
      int('version', { def: '1' }),
      bool('isCurrent', { def: 'true' }),
      str('supersedesId', 36),
      ts('uploadedAt', { created: true }),
      ts('deletedAt'),
    ],
  },
  {
    name: 'DocumentAccessLog', table: 'document_access_logs', id: 'auto',
    fields: [
      str('documentId', 36, { nullable: false }),
      str('userId', 36, { nullable: false }),
      str('ipAddress', 45),
      str('action', 40, { nullable: false }),
      ts('accessedAt', { created: true }),
    ],
  },
  {
    name: 'CandidateTag', table: 'candidate_tags', id: 'uuid',
    fields: [
      str('name', 60, { nullable: false, unique: true }),
      str('colour', 9, { def: '"#64748b"' }),
      ts('createdAt', { created: true }),
    ],
  },
  {
    name: 'CandidateNote', table: 'candidate_notes', id: 'uuid',
    fields: [
      str('candidateId', 36, { nullable: false }),
      str('authorId', 36, { nullable: false }),
      text('body', { nullable: false }),
      ts('createdAt', { created: true }),
      ts('updatedAt', { updated: true }),
    ],
    relations: [{ kind: 'manyToOne', field: 'author', target: 'User', col: 'authorId' }],
  },
  {
    name: 'CandidateActivity', table: 'candidate_activities', id: 'auto',
    fields: [
      str('candidateId', 36, { nullable: false }),
      str('activity', 120, { nullable: false }),
      text('detail'),
      str('actorUserId', 36),
      ts('createdAt', { created: true }),
    ],
  },

  // ---------------- Applications ----------------
  {
    name: 'JobApplication', table: 'job_applications', id: 'uuid',
    fields: [
      str('applicationCode', 30, { nullable: false, unique: true }),
      str('candidateId', 36, { nullable: false }),
      str('jobId', 36, { nullable: false }),
      // Holds the jobId while ACTIVE, NULL once terminal. With the
      // unique index on (candidateId, activeJobKey) this is what
      // enforces "one live application per candidate per job".
      str('activeJobKey', 36),
      ts('appliedAt', { nullable: false }),
      str('resumeDocumentId', 36),
      text('coverLetter'),
      str('sourceId', 36),
      str('recruiterId', 36),
      enm('currentStage', 'ApplicationStage', { nullable: false }),
      enm('status', 'ApplicationStatus', { nullable: false }),
      enm('screeningResult', 'ScreeningResult', { nullable: false }),
      text('screeningRemarks'),
      str('rejectionReason', 500),
      str('withdrawReason', 500),
      ts('stageEnteredAt', { nullable: false }),
      ts('followUpDueAt'),
      ts('lastUpdatedAt', { updated: true }),
      ts('createdAt', { created: true }),
    ],
    relations: [
      { kind: 'manyToOne', field: 'candidate', target: 'CandidateProfile', col: 'candidateId' },
      { kind: 'manyToOne', field: 'job', target: 'JobRequirement', col: 'jobId' },
      { kind: 'manyToOne', field: 'recruiter', target: 'User', col: 'recruiterId' },
      { kind: 'manyToOne', field: 'source', target: 'RecruitmentSource', col: 'sourceId' },
      { kind: 'manyToOne', field: 'resumeDocument', target: 'CandidateDocument', col: 'resumeDocumentId' },
    ],
  },
  {
    name: 'ApplicationStatusHistory', table: 'application_status_history', id: 'auto',
    fields: [
      str('applicationId', 36, { nullable: false }),
      enm('fromStage', 'ApplicationStage'),
      enm('toStage', 'ApplicationStage', { nullable: false }),
      enm('fromStatus', 'ApplicationStatus'),
      enm('toStatus', 'ApplicationStatus', { nullable: false }),
      str('changedById', 36, { nullable: false }),
      str('reason', 500),
      int('durationSeconds', { boxed: true }),
      ts('changedAt', { created: true }),
    ],
    relations: [{ kind: 'manyToOne', field: 'changedBy', target: 'User', col: 'changedById' }],
  },
  {
    name: 'ApplicationNote', table: 'application_notes', id: 'uuid',
    fields: [
      str('applicationId', 36, { nullable: false }),
      str('authorId', 36, { nullable: false }),
      text('body', { nullable: false }),
      bool('isInternal', { def: 'true' }),
      ts('createdAt', { created: true }),
      ts('updatedAt', { updated: true }),
    ],
    relations: [{ kind: 'manyToOne', field: 'author', target: 'User', col: 'authorId' }],
  },

  // ---------------- Interviews ----------------
  {
    name: 'Interview', table: 'interviews', id: 'uuid',
    fields: [
      str('interviewCode', 30, { nullable: false, unique: true }),
      str('applicationId', 36, { nullable: false }),
      str('candidateId', 36, { nullable: false }),
      str('jobId', 36, { nullable: false }),
      int('round', { def: '1' }),
      str('roundName', 100, { nullable: false }),
      enm('interviewType', 'InterviewType', { nullable: false }),
      ts('scheduledStart', { nullable: false }),
      ts('scheduledEnd', { nullable: false }),
      str('timeZone', 60, { def: '"UTC"' }),
      str('meetingLink', 500),
      str('venue', 300),
      text('instructions'),
      enm('status', 'InterviewStatus', { nullable: false }),
      str('cancelReason', 500),
      str('rescheduledFromId', 36),
      str('organiserId', 36, { nullable: false }),
      ts('createdAt', { created: true }),
      ts('updatedAt', { updated: true }),
    ],
    relations: [
      { kind: 'manyToOne', field: 'candidate', target: 'CandidateProfile', col: 'candidateId' },
      { kind: 'manyToOne', field: 'job', target: 'JobRequirement', col: 'jobId' },
      { kind: 'manyToOne', field: 'application', target: 'JobApplication', col: 'applicationId' },
      { kind: 'manyToOne', field: 'organiser', target: 'User', col: 'organiserId' },
    ],
  },
  {
    name: 'InterviewFeedback', table: 'interview_feedback', id: 'uuid',
    fields: [
      str('interviewId', 36, { nullable: false }),
      str('interviewerId', 36, { nullable: false }),
      int('technicalSkills', { boxed: true }),
      int('communication', { boxed: true }),
      int('problemSolving', { boxed: true }),
      int('relevantExperience', { boxed: true }),
      int('roleSuitability', { boxed: true }),
      int('teamCollaboration', { boxed: true }),
      int('overallRating', { nullable: false }),
      text('strengths'),
      text('areasForImprovement'),
      text('comments'),
      enm('recommendation', 'Recommendation', { nullable: false }),
      ts('submittedAt', { created: true }),
      ts('updatedAt', { updated: true }),
    ],
    relations: [{ kind: 'manyToOne', field: 'interviewer', target: 'User', col: 'interviewerId' }],
  },

  // ---------------- Offers ----------------
  {
    name: 'Offer', table: 'offers', id: 'uuid',
    fields: [
      str('offerCode', 30, { nullable: false, unique: true }),
      str('applicationId', 36, { nullable: false }),
      str('candidateId', 36, { nullable: false }),
      str('jobId', 36, { nullable: false }),
      str('proposedDesignation', 150, { nullable: false }),
      str('departmentName', 150),
      dec('annualSalary', 14, 2, { nullable: false }),
      str('currency', 3, { def: '"USD"' }),
      dec('bonus', 14, 2),
      text('benefits'),
      ts('joiningDate', { nullable: false }),
      ts('issuedAt'),
      ts('expiresAt'),
      enm('status', 'OfferStatus', { nullable: false }),
      str('declineReason', 500),
      str('withdrawReason', 500),
      ts('respondedAt'),
      str('offerDocumentKey', 255),
      str('createdById', 36, { nullable: false }),
      int('revision', { def: '1' }),
      ts('createdAt', { created: true }),
      ts('updatedAt', { updated: true }),
    ],
    relations: [
      { kind: 'manyToOne', field: 'candidate', target: 'CandidateProfile', col: 'candidateId' },
      { kind: 'manyToOne', field: 'job', target: 'JobRequirement', col: 'jobId' },
      { kind: 'manyToOne', field: 'application', target: 'JobApplication', col: 'applicationId' },
      { kind: 'manyToOne', field: 'createdBy', target: 'User', col: 'createdById' },
    ],
  },
  {
    name: 'OfferApproval', table: 'offer_approvals', id: 'uuid',
    fields: [
      str('offerId', 36, { nullable: false }),
      str('approverId', 36, { nullable: false }),
      int('sequence', { def: '1' }),
      enm('decision', 'ApprovalDecision', { nullable: false }),
      text('comments'),
      ts('decidedAt'),
      ts('createdAt', { created: true }),
    ],
    relations: [{ kind: 'manyToOne', field: 'approver', target: 'User', col: 'approverId' }],
  },
  {
    name: 'OfferHistory', table: 'offer_history', id: 'auto',
    fields: [
      str('offerId', 36, { nullable: false }),
      enm('fromStatus', 'OfferStatus'),
      enm('toStatus', 'OfferStatus', { nullable: false }),
      str('changedById', 36, { nullable: false }),
      str('reason', 500),
      ts('changedAt', { created: true }),
    ],
  },

  // ---------------- Onboarding ----------------
  {
    name: 'OnboardingRecord', table: 'onboarding_records', id: 'uuid',
    fields: [
      str('onboardingCode', 30, { nullable: false, unique: true }),
      str('applicationId', 36, { nullable: false, unique: true }),
      str('offerId', 36, { nullable: false, unique: true }),
      str('candidateId', 36, { nullable: false }),
      enm('status', 'OnboardingStatus', { nullable: false }),
      ts('joiningDate', { nullable: false }),
      ts('actualJoinDate'),
      str('departmentId', 36),
      str('designation', 150, { nullable: false }),
      str('reportingManagerId', 36),
      str('employeeCode', 30, { unique: true }),
      str('didNotJoinReason', 500),
      bool('documentsVerified', { def: 'false' }),
      ts('verifiedAt'),
      ts('createdAt', { created: true }),
      ts('updatedAt', { updated: true }),
    ],
    relations: [
      { kind: 'manyToOne', field: 'candidate', target: 'CandidateProfile', col: 'candidateId' },
      { kind: 'manyToOne', field: 'department', target: 'Department', col: 'departmentId' },
      { kind: 'manyToOne', field: 'reportingManager', target: 'User', col: 'reportingManagerId' },
      { kind: 'manyToOne', field: 'offer', target: 'Offer', col: 'offerId' },
    ],
  },
  {
    name: 'OnboardingTask', table: 'onboarding_tasks', id: 'uuid',
    fields: [
      str('onboardingId', 36, { nullable: false }),
      str('title', 200, { nullable: false }),
      text('description'),
      str('category', 60),
      str('ownerUserId', 36),
      ts('dueDate'),
      enm('status', 'TaskStatus', { nullable: false }),
      ts('completedAt'),
      int('sequence', { def: '0' }),
      bool('isMandatory', { def: 'true' }),
      ts('createdAt', { created: true }),
      ts('updatedAt', { updated: true }),
    ],
    relations: [{ kind: 'manyToOne', field: 'owner', target: 'User', col: 'ownerUserId' }],
  },

  // ---------------- Platform ----------------
  {
    name: 'NotificationTemplate', table: 'notification_templates', id: 'uuid',
    fields: [
      str('key', 100, { nullable: false, unique: true, field: 'templateKey' }),
      str('name', 150, { nullable: false }),
      enm('channel', 'NotificationChannel', { nullable: false }),
      str('subject', 300, { nullable: false }),
      text('bodyHtml', { nullable: false }),
      text('bodyText'),
      text('variables'),
      bool('isActive', { def: 'true' }),
      ts('createdAt', { created: true }),
      ts('updatedAt', { updated: true }),
    ],
  },
  {
    name: 'Notification', table: 'notifications', id: 'uuid',
    fields: [
      str('userId', 36, { nullable: false }),
      str('templateId', 36),
      enm('channel', 'NotificationChannel', { nullable: false }),
      str('title', 300, { nullable: false }),
      text('body', { nullable: false }),
      str('link', 400),
      str('category', 60),
      ts('readAt'),
      ts('createdAt', { created: true }),
    ],
  },
  {
    name: 'EmailLog', table: 'email_logs', id: 'uuid',
    fields: [
      str('templateId', 36),
      str('toEmail', 255, { nullable: false }),
      str('subject', 300, { nullable: false }),
      enm('status', 'EmailStatus', { nullable: false }),
      str('providerId', 255),
      text('errorMessage'),
      int('attempts', { def: '0' }),
      ts('queuedAt', { created: true }),
      ts('sentAt'),
    ],
  },
  {
    name: 'AuditLog', table: 'audit_logs', id: 'auto',
    fields: [
      str('actorUserId', 36),
      str('actorEmail', 255),
      str('action', 100, { nullable: false }),
      str('entityType', 60),
      str('entityId', 64),
      text('metadata'),
      str('ipAddress', 45),
      str('userAgent', 400),
      str('requestId', 64),
      str('severity', 20, { def: '"INFO"' }),
      ts('createdAt', { created: true }),
    ],
    relations: [{ kind: 'manyToOne', field: 'actor', target: 'User', col: 'actorUserId' }],
  },
  {
    name: 'SystemSetting', table: 'system_settings', id: 'uuid',
    fields: [
      str('key', 100, { nullable: false, unique: true, field: 'settingKey' }),
      text('value', { nullable: false, field: 'settingValue' }),
      str('valueType', 20, { def: '"string"' }),
      str('category', 60, { def: '"general"' }),
      str('description', 500),
      bool('isSecret', { def: 'false' }),
      str('updatedById', 36),
      ts('createdAt', { created: true }),
      ts('updatedAt', { updated: true }),
    ],
  },
];

// ---------------------------------------------------------------------
//  Composite-key join tables, written with an @IdClass
// ---------------------------------------------------------------------
const JOIN_ENTITIES = [
  {
    name: 'UserRole', table: 'user_roles',
    keys: [['userId', 36], ['roleId', 36]],
    fields: [ts('assignedAt', { created: true }), str('assignedBy', 36)],
    relations: [
      { kind: 'manyToOne', field: 'user', target: 'User', col: 'userId' },
      { kind: 'manyToOne', field: 'role', target: 'Role', col: 'roleId', eager: true },
    ],
  },
  {
    name: 'RolePermission', table: 'role_permissions',
    keys: [['roleId', 36], ['permissionId', 36]],
    fields: [],
    relations: [{ kind: 'manyToOne', field: 'permission', target: 'Permission', col: 'permissionId', eager: true }],
  },
  {
    name: 'CandidateTagLink', table: 'candidate_tag_links',
    keys: [['candidateId', 36], ['tagId', 36]],
    fields: [ts('assignedAt', { created: true }), str('assignedById', 36, { nullable: false })],
    relations: [{ kind: 'manyToOne', field: 'tag', target: 'CandidateTag', col: 'tagId', eager: true }],
  },
  {
    name: 'InterviewPanelMember', table: 'interview_panel_members',
    keys: [['interviewId', 36], ['interviewerId', 36]],
    fields: [bool('isLead', { def: 'false' }), ts('invitedAt', { created: true }), ts('respondedAt'), bool('accepted', { boxed: true })],
    relations: [{ kind: 'manyToOne', field: 'interviewer', target: 'User', col: 'interviewerId', eager: true }],
  },
];

// ---------------------------------------------------------------------
//  Rendering
// ---------------------------------------------------------------------
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function javaType(f) {
  switch (f.kind) {
    case 'string': case 'text': return 'String';
    case 'int': return f.boxed ? 'Integer' : 'int';
    case 'bool': return f.boxed ? 'Boolean' : 'boolean';
    case 'decimal': return 'BigDecimal';
    case 'instant': return 'Instant';
    case 'enum': return f.type;
    default: throw new Error('unknown kind ' + f.kind);
  }
}

function renderField(f) {
  const name = f.field ?? f.col;
  const type = javaType(f);
  const lines = [];

  // When a column is also mapped by an association, exactly one of the
  // two mappings may write it. The scalar id is the writable one and the
  // association is read-only (see renderRelation): services set
  // setCandidateId(...) and read getCandidate(). The other way round
  // would leave the foreign key unwritable from either side.
  const attrs = [`name = "${f.col}"`];

  if (f.kind === 'string') attrs.push(`length = ${f.len}`);
  if (f.kind === 'decimal') attrs.push(`precision = ${f.precision}`, `scale = ${f.scale}`);
  if (f.nullable === false) attrs.push('nullable = false');
  if (f.unique) attrs.push('unique = true');

  if (f.kind === 'enum') lines.push('    @Enumerated(EnumType.STRING)');
  if (f.created) lines.push('    @CreationTimestamp');
  if (f.updated) lines.push('    @UpdateTimestamp');

  const definition = columnDefinitionFor(f);
  if (definition) attrs.push(`columnDefinition = "${definition}"`);

  lines.push(`    @Column(${attrs.join(', ')})`);
  lines.push(`    private ${type} ${name}${f.def ? ' = ' + f.def : ''};`);

  return lines.join('\n');
}

/**
 * The exact SQL type, where Hibernate's default would not match what
 * Prisma created.
 *
 * Hibernate validates a mapping by comparing the JDBC type code OR by
 * checking that the mapped SQL type starts with the database's type
 * name. Prisma used CHAR(36) for UUIDs, native MySQL ENUMs for enum
 * columns and TEXT for long strings; Hibernate would otherwise expect
 * VARCHAR for all three and refuse to start. Stating the real type here
 * keeps `ddl-auto: validate` on, which is what stops a mapping mistake
 * from reaching production.
 */
function columnDefinitionFor(f) {
  if (f.kind === 'text') return 'TEXT';
  if (f.kind === 'string' && f.len === 36) return 'CHAR(36)';
  if (f.kind === 'enum') {
    const values = enumValues(f.type);
    return `enum(${values.map((v) => `'${v}'`).join(',')})`;
  }
  return null;
}

/** Reads the constants of one enum out of Enums.java. */
function enumValues(name) {
  const source = fs.readFileSync(
    path.join(root, 'src/main/java/com/businessgateways/hrats/domain/enums/Enums.java'),
    'utf8',
  );
  const match = source.match(new RegExp(`enum\\s+${name}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`Enum ${name} not found in Enums.java`);

  return match[1]
    .split(/[,\n]/)
    .map((line) => line.replace(/\/\/.*$/, '').trim())
    .filter((token) => /^[A-Z][A-Z0-9_]*$/.test(token));
}

function renderRelation(r) {
  const fetch = r.eager ? 'FetchType.EAGER' : 'FetchType.LAZY';
  const annotation = r.kind === 'oneToOne' ? 'OneToOne' : 'ManyToOne';
  return [
    `    @${annotation}(fetch = ${fetch})`,
    `    @JoinColumn(name = "${r.col}", insertable = false, updatable = false)`,
    `    private ${r.target} ${r.field};`,
  ].join('\n');
}

function imports(entity) {
  const set = new Set([
    'jakarta.persistence.*',
    'lombok.Getter',
    'lombok.NoArgsConstructor',
    'lombok.Setter',
  ]);
  const all = [...(entity.fields ?? []), ...(entity.keys ?? []).map(() => ({ kind: 'string' }))];
  if (all.some((f) => f.kind === 'instant')) set.add('java.time.Instant');
  if (all.some((f) => f.kind === 'decimal')) set.add('java.math.BigDecimal');
  if (all.some((f) => f.created)) set.add('org.hibernate.annotations.CreationTimestamp');
  if (all.some((f) => f.updated)) set.add('org.hibernate.annotations.UpdateTimestamp');
  if (entity.id === 'uuid') set.add('java.util.UUID');
  if (all.some((f) => f.kind === 'enum')) {
    for (const f of all.filter((x) => x.kind === 'enum')) {
      set.add(`com.businessgateways.hrats.domain.enums.Enums.${f.type}`);
    }
  }
  return [...set].sort();
}

function renderEntity(e) {
  const body = [];

  if (e.id === 'uuid') {
    body.push('    @Id');
    body.push('    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")');
    body.push('    private String id = UUID.randomUUID().toString();');
  } else if (e.id === 'auto') {
    body.push('    @Id');
    body.push('    @GeneratedValue(strategy = GenerationType.IDENTITY)');
    body.push('    @Column(name = "id", nullable = false)');
    body.push('    private Long id;');
  }

  for (const f of e.fields) body.push('', renderField(f));
  for (const r of e.relations ?? []) body.push('', renderRelation(r));

  return `package com.businessgateways.hrats.domain.entity;

${imports(e).map((i) => `import ${i};`).join('\n')}

/** Maps the existing {@code ${e.table}} table. */
@Entity
@Table(name = "${e.table}")
@Getter
@Setter
@NoArgsConstructor
public class ${e.name} {

${body.join('\n')}
}
`;
}

function renderJoinEntity(e) {
  const keyNames = e.keys.map(([n]) => n);

  const idClass = `package com.businessgateways.hrats.domain.entity;

import java.io.Serializable;
import java.util.Objects;

/** Composite primary key for {@link ${e.name}}. */
public class ${e.name}Id implements Serializable {

${keyNames.map((n) => `    private String ${n};`).join('\n')}

    public ${e.name}Id() {}

    public ${e.name}Id(${keyNames.map((n) => `String ${n}`).join(', ')}) {
${keyNames.map((n) => `        this.${n} = ${n};`).join('\n')}
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) return true;
        if (!(other instanceof ${e.name}Id that)) return false;
        return ${keyNames.map((n) => `Objects.equals(${n}, that.${n})`).join('\n                && ')};
    }

    @Override
    public int hashCode() {
        return Objects.hash(${keyNames.join(', ')});
    }
}
`;

  const body = [];
  for (const [name, len] of e.keys) {
    body.push('    @Id');
    body.push(`    @Column(name = "${name}", length = ${len}, nullable = false, columnDefinition = "CHAR(${len})")`);
    body.push(`    private String ${name};`);
    body.push('');
  }
  for (const f of e.fields) body.push(renderField(f), '');
  for (const r of e.relations ?? []) body.push(renderRelation(r), '');

  const entity = `package com.businessgateways.hrats.domain.entity;

${imports(e).map((i) => `import ${i};`).join('\n')}

/** Maps the existing {@code ${e.table}} join table. */
@Entity
@Table(name = "${e.table}")
@IdClass(${e.name}Id.class)
@Getter
@Setter
@NoArgsConstructor
public class ${e.name} {

${body.join('\n')}}
`;

  return { entity, idClass };
}

// ---------------------------------------------------------------------
//  Write
// ---------------------------------------------------------------------
let written = 0;

for (const e of ENTITIES) {
  fs.writeFileSync(path.join(ENTITY_DIR, `${e.name}.java`), renderEntity(e));
  written += 1;
}

for (const e of JOIN_ENTITIES) {
  const { entity, idClass } = renderJoinEntity(e);
  fs.writeFileSync(path.join(ENTITY_DIR, `${e.name}.java`), entity);
  fs.writeFileSync(path.join(ENTITY_DIR, `${e.name}Id.java`), idClass);
  written += 2;
}

console.log(`Generated ${written} entity file(s) in domain/entity`);
console.log(`  ${ENTITIES.length} simple entities`);
console.log(`  ${JOIN_ENTITIES.length} join entities (+ their @IdClass)`);
console.log('\nUser.java is hand-written and was not touched.');
