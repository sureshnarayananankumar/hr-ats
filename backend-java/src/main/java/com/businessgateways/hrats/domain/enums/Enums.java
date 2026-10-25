package com.businessgateways.hrats.domain.enums;

/**
 * Enum values mirror the MySQL ENUM columns created by Prisma exactly.
 * Renaming or reordering a constant here without a migration would
 * break persistence, so they are kept in one file to make that
 * correspondence obvious.
 */
public final class Enums {
    private Enums() {}

    public enum RoleName {
        SUPER_ADMIN, HR_ADMIN, RECRUITER, HIRING_MANAGER, INTERVIEWER, CANDIDATE
    }

    public enum UserStatus {
        PENDING_VERIFICATION, ACTIVE, SUSPENDED, DEACTIVATED
    }

    public enum JobStatus {
        DRAFT, PENDING_APPROVAL, APPROVED, PUBLISHED, ON_HOLD, CLOSED, CANCELLED
    }

    public enum Priority {
        LOW, MEDIUM, HIGH, CRITICAL
    }

    public enum EmploymentType {
        FULL_TIME, PART_TIME, CONTRACT, TEMPORARY, INTERNSHIP, FREELANCE
    }

    public enum WorkMode {
        ONSITE, REMOTE, HYBRID
    }

    public enum ApprovalDecision {
        PENDING, APPROVED, REJECTED
    }

    /** The 12 default recruitment stages, in progression order. */
    public enum ApplicationStage {
        APPLIED,
        RESUME_SCREENING,
        HR_SCREENING,
        SHORTLISTED,
        ASSESSMENT,
        TECHNICAL_INTERVIEW,
        HR_INTERVIEW,
        FINAL_INTERVIEW,
        SELECTED,
        OFFER_RELEASED,
        OFFER_ACCEPTED,
        HIRED
    }

    /** Lifecycle status, tracked independently of the stage. */
    public enum ApplicationStatus {
        ACTIVE, ON_HOLD, REJECTED, WITHDRAWN, OFFER_DECLINED, HIRED
    }

    public enum ScreeningResult {
        NOT_SCREENED, PASS, FAIL, ON_HOLD
    }

    public enum DocumentType {
        RESUME, COVER_LETTER, CERTIFICATE, ID_PROOF,
        EDUCATION_PROOF, EXPERIENCE_LETTER, OFFER_DOCUMENT, OTHER
    }

    public enum InterviewType {
        PHONE, VIDEO, ONSITE, PANEL, ASSESSMENT, TECHNICAL, HR
    }

    public enum InterviewStatus {
        SCHEDULED, RESCHEDULED, COMPLETED, CANCELLED, NO_SHOW
    }

    public enum Recommendation {
        STRONG_HIRE, HIRE, HOLD, NO_HIRE
    }

    public enum OfferStatus {
        DRAFT, PENDING_APPROVAL, APPROVED, SENT, ACCEPTED, DECLINED, EXPIRED, WITHDRAWN
    }

    public enum OnboardingStatus {
        OFFER_ACCEPTED, PREBOARDING, JOINED, DID_NOT_JOIN
    }

    public enum TaskStatus {
        PENDING, IN_PROGRESS, COMPLETED, BLOCKED, CANCELLED
    }

    public enum NotificationChannel {
        IN_APP, EMAIL, BOTH
    }

    public enum EmailStatus {
        QUEUED, SENT, FAILED, BOUNCED
    }

    public enum SkillProficiency {
        BEGINNER, INTERMEDIATE, ADVANCED, EXPERT
    }
}
