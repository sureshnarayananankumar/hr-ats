/** Shared types mirroring the backend DTOs and Prisma enums. */

export type RoleName =
  | 'SUPER_ADMIN'
  | 'HR_ADMIN'
  | 'RECRUITER'
  | 'HIRING_MANAGER'
  | 'INTERVIEWER'
  | 'CANDIDATE';

export type JobStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'ON_HOLD'
  | 'CLOSED'
  | 'CANCELLED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type EmploymentType =
  | 'FULL_TIME'
  | 'PART_TIME'
  | 'CONTRACT'
  | 'TEMPORARY'
  | 'INTERNSHIP'
  | 'FREELANCE';

export type WorkMode = 'ONSITE' | 'REMOTE' | 'HYBRID';

export type ApplicationStage =
  | 'APPLIED'
  | 'RESUME_SCREENING'
  | 'HR_SCREENING'
  | 'SHORTLISTED'
  | 'ASSESSMENT'
  | 'TECHNICAL_INTERVIEW'
  | 'HR_INTERVIEW'
  | 'FINAL_INTERVIEW'
  | 'SELECTED'
  | 'OFFER_RELEASED'
  | 'OFFER_ACCEPTED'
  | 'HIRED';

export type ApplicationStatus =
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'OFFER_DECLINED'
  | 'HIRED';

export type InterviewStatus =
  | 'SCHEDULED'
  | 'RESCHEDULED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type InterviewType =
  | 'PHONE'
  | 'VIDEO'
  | 'ONSITE'
  | 'PANEL'
  | 'ASSESSMENT'
  | 'TECHNICAL'
  | 'HR';

export type Recommendation = 'STRONG_HIRE' | 'HIRE' | 'HOLD' | 'NO_HIRE';

export type OfferStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SENT'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'WITHDRAWN';

export type OnboardingStatus = 'OFFER_ACCEPTED' | 'PREBOARDING' | 'JOINED' | 'DID_NOT_JOIN';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED' | 'CANCELLED';

export interface PageMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status: string;
  mfaEnabled: boolean;
  emailVerified: boolean;
  roles: RoleName[];
  permissions: string[];
  candidateId?: string;
  candidateCode?: string;
  lastLoginAt?: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  head?: { id: string; firstName: string; lastName: string } | null;
  _count?: { jobRequirements: number };
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  roles: RoleName[];
}

export interface JobRequirement {
  id: string;
  requirementCode: string;
  title: string;
  slug: string;
  description?: string;
  responsibilities?: string;
  qualifications?: string;
  internalNotes?: string;
  status: JobStatus;
  priority: Priority;
  designation: string;
  department?: { id: string; name: string; code?: string } | null;
  departmentId?: string;
  location: string;
  employmentType: EmploymentType;
  workMode: WorkMode;
  vacancies: number;
  vacanciesFilled: number;
  minExperience: number;
  maxExperience?: number | null;
  salaryMin?: string | null;
  salaryMax?: string | null;
  salaryCurrency: string;
  salaryConfidential?: boolean;
  recruiter?: { id: string; firstName: string; lastName: string; email?: string } | null;
  hiringManager?: { id: string; firstName: string; lastName: string } | null;
  requestedBy?: { id: string; firstName: string; lastName: string } | null;
  skills?: string[] | Array<{ skill: { id: string; name: string }; isRequired: boolean }>;
  applicationCount?: number;
  publishedAt?: string | null;
  applicationDeadline?: string | null;
  createdAt: string;
  updatedAt: string;
  approvals?: JobApproval[];
}

export interface JobApproval {
  id: string;
  jobId: string;
  approverId: string;
  sequence: number;
  decision: 'PENDING' | 'APPROVED' | 'REJECTED';
  comments?: string;
  decidedAt?: string | null;
  createdAt: string;
  approver?: { id: string; firstName: string; lastName: string };
  job?: JobRequirement;
}

export interface CandidateProfile {
  id: string;
  candidateCode: string;
  userId: string;
  fullName: string;
  mobile?: string | null;
  location?: string | null;
  totalExperience?: string | null;
  currentDesignation?: string | null;
  currentCompany?: string | null;
  highestEducation?: string | null;
  expectedSalary?: string | null;
  noticePeriodDays?: number | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
  preferredLocation?: string | null;
  preferredWorkMode?: WorkMode | null;
  willingToRelocate?: boolean;
  summary?: string | null;
  user?: { id?: string; email: string; phone?: string | null; status?: string };
  skills?: Array<{ skill: { id: string; name: string }; years?: string; proficiency?: string }>;
  tags?: Array<{ tag: { id: string; name: string; colour: string } }>;
  documents?: CandidateDocument[];
  applications?: JobApplication[];
  _count?: { applications: number; documents: number };
  createdAt: string;
}

export interface CandidateDocument {
  id: string;
  candidateId?: string;
  documentType: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  isCurrent: boolean;
  uploadedAt: string;
  downloadUrl?: string;
}

export interface JobApplication {
  id: string;
  applicationCode: string;
  candidateId: string;
  jobId: string;
  currentStage: ApplicationStage;
  stageLabel?: string;
  status: ApplicationStatus;
  screeningResult?: string;
  screeningRemarks?: string;
  rejectionReason?: string;
  appliedAt: string;
  stageEnteredAt?: string;
  followUpDueAt?: string | null;
  lastUpdatedAt: string;
  isOverdue?: boolean;
  coverLetter?: string;
  candidate?: Partial<CandidateProfile>;
  job?: Partial<JobRequirement>;
  recruiter?: { id: string; firstName: string; lastName: string } | null;
  source?: { id: string; name: string } | null;
  resumeDocument?: CandidateDocument | null;
  nextInterview?: { id: string; scheduledStart: string; roundName: string } | null;
  interviews?: Interview[];
  offers?: Offer[];
}

export interface StatusHistoryEntry {
  id: string;
  applicationId: string;
  fromStage?: ApplicationStage | null;
  toStage: ApplicationStage;
  fromStageLabel?: string | null;
  toStageLabel: string;
  fromStatus?: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  reason?: string | null;
  durationSeconds?: number | null;
  changedAt: string;
  changedBy: { id: string; firstName: string; lastName: string };
}

export interface PipelineCard {
  applicationId: string;
  applicationCode: string;
  candidateId: string;
  candidateCode: string;
  candidateName: string;
  experience?: string | null;
  skills: string[];
  tags: Array<{ name: string; colour: string }>;
  appliedAt: string;
  recruiter?: { id: string; firstName: string; lastName: string } | null;
  status: ApplicationStatus;
  nextInterview?: { id: string; scheduledStart: string; roundName: string } | null;
  stageEnteredAt: string;
  followUpDueAt?: string | null;
  isOverdue: boolean;
}

export interface PipelineColumn {
  stage: ApplicationStage;
  label: string;
  count: number;
  cards: PipelineCard[];
}

export interface PipelineBoard {
  job: {
    id: string;
    title: string;
    requirementCode: string;
    vacancies: number;
    vacanciesFilled: number;
  };
  columns: PipelineColumn[];
  total: number;
}

export interface Interview {
  id: string;
  interviewCode: string;
  applicationId: string;
  candidateId: string;
  jobId: string;
  round: number;
  roundName: string;
  interviewType: InterviewType;
  scheduledStart: string;
  scheduledEnd: string;
  timeZone: string;
  meetingLink?: string | null;
  venue?: string | null;
  instructions?: string | null;
  status: InterviewStatus;
  cancelReason?: string | null;
  candidate?: { id: string; candidateCode: string; fullName: string };
  job?: { id: string; title: string; requirementCode: string };
  application?: { id: string; applicationCode: string; currentStage: ApplicationStage };
  panel?: Array<{
    interviewerId: string;
    isLead: boolean;
    interviewer: { id: string; firstName: string; lastName: string; email?: string };
  }>;
  _count?: { feedback: number };
  conflicts?: Array<{
    interviewerId: string;
    interviewerName: string;
    conflictingInterview: string;
    from: string;
    to: string;
  }>;
}

export interface InterviewFeedback {
  id: string;
  interviewId: string;
  interviewerId: string;
  technicalSkills?: number | null;
  communication?: number | null;
  problemSolving?: number | null;
  relevantExperience?: number | null;
  roleSuitability?: number | null;
  teamCollaboration?: number | null;
  overallRating: number;
  strengths?: string | null;
  areasForImprovement?: string | null;
  comments?: string | null;
  recommendation: Recommendation;
  submittedAt: string;
  interviewer?: { id: string; firstName: string; lastName: string };
}

export interface Offer {
  id: string;
  offerCode: string;
  applicationId: string;
  candidateId: string;
  jobId: string;
  proposedDesignation: string;
  departmentName?: string | null;
  annualSalary: string;
  currency: string;
  bonus?: string | null;
  benefits?: string | null;
  joiningDate: string;
  issuedAt?: string | null;
  expiresAt?: string | null;
  status: OfferStatus;
  declineReason?: string | null;
  respondedAt?: string | null;
  revision: number;
  createdAt: string;
  candidate?: { id: string; candidateCode: string; fullName: string };
  job?: { id: string; title: string; requirementCode: string };
  application?: { id: string; applicationCode: string };
  createdBy?: { id: string; firstName: string; lastName: string };
  approvals?: Array<{
    id: string;
    decision: string;
    comments?: string;
    approver: { id: string; firstName: string; lastName: string };
  }>;
}

export interface OnboardingRecord {
  id: string;
  onboardingCode: string;
  applicationId: string;
  offerId: string;
  candidateId: string;
  status: OnboardingStatus;
  joiningDate: string;
  actualJoinDate?: string | null;
  designation: string;
  employeeCode?: string | null;
  documentsVerified: boolean;
  didNotJoinReason?: string | null;
  candidate?: { id: string; candidateCode: string; fullName: string };
  department?: { id: string; name: string } | null;
  reportingManager?: { id: string; firstName: string; lastName: string } | null;
  offer?: Partial<Offer> | null;
  tasks?: OnboardingTask[];
  taskSummary?: { total: number; completed: number; percentComplete: number };
}

export interface OnboardingTask {
  id: string;
  onboardingId: string;
  title: string;
  description?: string | null;
  category?: string | null;
  ownerUserId?: string | null;
  dueDate?: string | null;
  status: TaskStatus;
  completedAt?: string | null;
  isMandatory: boolean;
  sequence: number;
  owner?: { id: string; firstName: string; lastName: string } | null;
  onboarding?: {
    id: string;
    onboardingCode: string;
    joiningDate: string;
    candidate: { fullName: string };
  };
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  link?: string | null;
  category?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  jobs: {
    total: number;
    draft: number;
    pendingApproval: number;
    approved: number;
    published: number;
    onHold: number;
    closed: number;
    cancelled: number;
    openPositions: number;
  };
  candidates: {
    total: number;
    newApplications: number;
    underScreening: number;
    shortlisted: number;
    hired: number;
    rejected: number;
    withdrawn: number;
  };
  interviews: { scheduled: number };
  offers: { released: number; accepted: number };
  generatedAt: string;
}

export interface PendingActions {
  jobApprovals: number;
  offerApprovals: number;
  pendingFeedback: number;
  overdueFollowUps: number;
  onboardingTasks: number;
  total: number;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorEmail?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: string | null;
  ipAddress?: string | null;
  requestId?: string | null;
  severity: string;
  createdAt: string;
  actor?: { id: string; email: string; firstName: string; lastName: string } | null;
}

export interface PublicJob {
  id: string;
  slug: string;
  requirementCode: string;
  title: string;
  designation: string;
  department?: string | null;
  location: string;
  employmentType: EmploymentType;
  workMode: WorkMode;
  minExperience: number;
  maxExperience?: number | null;
  vacancies: number;
  publishedAt?: string | null;
  applicationDeadline?: string | null;
  salaryMin?: string | null;
  salaryMax?: string | null;
  salaryCurrency?: string | null;
  salaryDisclosed: boolean;
  skills: string[];
  description?: string;
  responsibilities?: string;
  qualifications?: string;
  requiredSkills?: string[];
  preferredSkills?: string[];
  acceptingApplications?: boolean;
  isExpired?: boolean;
  related?: Array<{
    slug: string;
    title: string;
    location: string;
    employmentType: EmploymentType;
    workMode: WorkMode;
  }>;
}
