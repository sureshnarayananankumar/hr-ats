package com.businessgateways.hrats.common;

import com.businessgateways.hrats.domain.enums.Enums.ApplicationStage;
import com.businessgateways.hrats.domain.enums.Enums.ApplicationStatus;
import com.businessgateways.hrats.domain.enums.Enums.JobStatus;
import com.businessgateways.hrats.domain.enums.Enums.OfferStatus;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The state machines behind requisitions, applications and offers.
 *
 * These rules are enforced here, server-side. The UI mirrors them to
 * grey out impossible actions, but a client that ignores the UI and
 * posts a forbidden transition is still rejected.
 */
public final class WorkflowRules {

    private WorkflowRules() {}

    /** Allowed job-requirement status transitions. */
    public static final Map<JobStatus, Set<JobStatus>> JOB_TRANSITIONS;

    static {
        Map<JobStatus, Set<JobStatus>> map = new EnumMap<>(JobStatus.class);
        map.put(JobStatus.DRAFT, Set.of(JobStatus.PENDING_APPROVAL, JobStatus.CANCELLED));
        map.put(JobStatus.PENDING_APPROVAL, Set.of(JobStatus.APPROVED, JobStatus.DRAFT, JobStatus.CANCELLED));
        map.put(JobStatus.APPROVED, Set.of(JobStatus.PUBLISHED, JobStatus.ON_HOLD, JobStatus.CANCELLED));
        map.put(JobStatus.PUBLISHED, Set.of(JobStatus.ON_HOLD, JobStatus.CLOSED, JobStatus.CANCELLED));
        map.put(JobStatus.ON_HOLD, Set.of(JobStatus.PUBLISHED, JobStatus.APPROVED, JobStatus.CLOSED, JobStatus.CANCELLED));
        // Reopening a filled vacancy, when permitted.
        map.put(JobStatus.CLOSED, Set.of(JobStatus.PUBLISHED));
        map.put(JobStatus.CANCELLED, Set.of());
        JOB_TRANSITIONS = Map.copyOf(map);
    }

    public static boolean canTransitionJob(JobStatus from, JobStatus to) {
        return JOB_TRANSITIONS.getOrDefault(from, Set.of()).contains(to);
    }

    /** The 12 default recruitment stages, in progression order. */
    public static final List<ApplicationStage> STAGE_ORDER = List.of(ApplicationStage.values());

    public static final Map<ApplicationStage, String> STAGE_LABELS;

    static {
        Map<ApplicationStage, String> map = new EnumMap<>(ApplicationStage.class);
        map.put(ApplicationStage.APPLIED, "Applied");
        map.put(ApplicationStage.RESUME_SCREENING, "Resume Screening");
        map.put(ApplicationStage.HR_SCREENING, "HR Screening");
        map.put(ApplicationStage.SHORTLISTED, "Shortlisted");
        map.put(ApplicationStage.ASSESSMENT, "Assessment / Test");
        map.put(ApplicationStage.TECHNICAL_INTERVIEW, "Technical Interview");
        map.put(ApplicationStage.HR_INTERVIEW, "HR Interview");
        map.put(ApplicationStage.FINAL_INTERVIEW, "Final Interview");
        map.put(ApplicationStage.SELECTED, "Selected");
        map.put(ApplicationStage.OFFER_RELEASED, "Offer Released");
        map.put(ApplicationStage.OFFER_ACCEPTED, "Offer Accepted");
        map.put(ApplicationStage.HIRED, "Hired");
        STAGE_LABELS = Map.copyOf(map);
    }

    public static String labelFor(ApplicationStage stage) {
        return STAGE_LABELS.getOrDefault(stage, stage.name());
    }

    /**
     * Statuses in which an application is no longer competing for the role.
     *
     * Reaching one of these clears {@code activeJobKey}, releasing the
     * unique index on {@code (candidateId, activeJobKey)} so the
     * candidate may apply for the same job again later.
     */
    public static final Set<ApplicationStatus> TERMINAL_APPLICATION_STATUSES = Set.of(
            ApplicationStatus.REJECTED,
            ApplicationStatus.WITHDRAWN,
            ApplicationStatus.OFFER_DECLINED,
            ApplicationStatus.HIRED);

    public static boolean isTerminal(ApplicationStatus status) {
        return TERMINAL_APPLICATION_STATUSES.contains(status);
    }

    /**
     * Stage progression rules.
     *
     * Forward movement may skip stages — recruiters routinely skip
     * Assessment — but backward movement is limited to a single step, so
     * that a mis-drag can be corrected without rewriting the history.
     */
    public static boolean isValidStageTransition(ApplicationStage from, ApplicationStage to) {
        if (from == null || to == null || from == to) {
            return false;
        }

        // HIRED may only be reached from OFFER_ACCEPTED: sending an offer
        // must never by itself mark someone as hired.
        if (to == ApplicationStage.HIRED) {
            return from == ApplicationStage.OFFER_ACCEPTED;
        }

        // OFFER_ACCEPTED is driven by the candidate's response on the
        // offer, not by a manual drag on the pipeline board.
        if (to == ApplicationStage.OFFER_ACCEPTED) {
            return from == ApplicationStage.OFFER_RELEASED;
        }

        int fromIndex = STAGE_ORDER.indexOf(from);
        int toIndex = STAGE_ORDER.indexOf(to);
        if (toIndex > fromIndex) {
            return true;
        }
        return fromIndex - toIndex == 1;
    }

    public static final Map<OfferStatus, Set<OfferStatus>> OFFER_TRANSITIONS;

    static {
        Map<OfferStatus, Set<OfferStatus>> map = new EnumMap<>(OfferStatus.class);
        map.put(OfferStatus.DRAFT, Set.of(OfferStatus.PENDING_APPROVAL, OfferStatus.WITHDRAWN));
        map.put(OfferStatus.PENDING_APPROVAL, Set.of(OfferStatus.APPROVED, OfferStatus.DRAFT, OfferStatus.WITHDRAWN));
        map.put(OfferStatus.APPROVED, Set.of(OfferStatus.SENT, OfferStatus.WITHDRAWN));
        map.put(OfferStatus.SENT, Set.of(OfferStatus.ACCEPTED, OfferStatus.DECLINED, OfferStatus.EXPIRED, OfferStatus.WITHDRAWN));
        map.put(OfferStatus.ACCEPTED, Set.of());
        map.put(OfferStatus.DECLINED, Set.of());
        map.put(OfferStatus.EXPIRED, Set.of());
        map.put(OfferStatus.WITHDRAWN, Set.of());
        OFFER_TRANSITIONS = Map.copyOf(map);
    }

    public static boolean canTransitionOffer(OfferStatus from, OfferStatus to) {
        return OFFER_TRANSITIONS.getOrDefault(from, Set.of()).contains(to);
    }

    /** Default follow-up SLA per stage, in days. Drives the overdue indicator. */
    public static final Map<ApplicationStage, Integer> STAGE_FOLLOWUP_DAYS;

    static {
        Map<ApplicationStage, Integer> map = new EnumMap<>(ApplicationStage.class);
        map.put(ApplicationStage.APPLIED, 3);
        map.put(ApplicationStage.RESUME_SCREENING, 3);
        map.put(ApplicationStage.HR_SCREENING, 5);
        map.put(ApplicationStage.SHORTLISTED, 5);
        map.put(ApplicationStage.ASSESSMENT, 7);
        map.put(ApplicationStage.TECHNICAL_INTERVIEW, 5);
        map.put(ApplicationStage.HR_INTERVIEW, 5);
        map.put(ApplicationStage.FINAL_INTERVIEW, 5);
        map.put(ApplicationStage.SELECTED, 3);
        map.put(ApplicationStage.OFFER_RELEASED, 7);
        STAGE_FOLLOWUP_DAYS = Map.copyOf(map);
    }
}
