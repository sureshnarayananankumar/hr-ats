package com.businessgateways.hrats.security;

import com.businessgateways.hrats.domain.enums.Enums.RoleName;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The complete permission catalogue.
 *
 * Authorization is permission-based, not role-based, at the enforcement
 * point: controllers require a permission key and roles are simply named
 * bundles of keys. That keeps the annotations readable and lets a bundle
 * be re-cut without touching a single controller.
 *
 * Naming: {@code <resource>.<action>[.scope]}
 * <ul>
 *   <li>{@code .any} — across all records</li>
 *   <li>{@code .own} — only records the caller owns</li>
 * </ul>
 *
 * These constants mirror {@code src/common/auth/permissions.ts} in the
 * Node backend and the rows already seeded into {@code permissions} and
 * {@code role_permissions}. {@code PermissionSeedConsistencyTest} fails
 * if the two ever drift.
 */
public final class Permissions {

    private Permissions() {}

    // ---- Users / platform administration ----
    public static final String USER_READ = "user.read";
    public static final String USER_CREATE = "user.create";
    public static final String USER_UPDATE = "user.update";
    public static final String USER_DEACTIVATE = "user.deactivate";
    public static final String ROLE_ASSIGN = "role.assign";
    public static final String PERMISSION_MANAGE = "permission.manage";
    public static final String SETTINGS_READ = "settings.read";
    public static final String SETTINGS_UPDATE = "settings.update";
    public static final String AUDIT_READ = "audit.read";

    // ---- Departments ----
    public static final String DEPARTMENT_READ = "department.read";
    public static final String DEPARTMENT_MANAGE = "department.manage";

    // ---- Job requirements ----
    public static final String JOB_READ_ANY = "job.read.any";
    public static final String JOB_READ_ASSIGNED = "job.read.assigned";
    public static final String JOB_CREATE = "job.create";
    public static final String JOB_UPDATE = "job.update";
    public static final String JOB_SUBMIT = "job.submit";
    public static final String JOB_APPROVE = "job.approve";
    public static final String JOB_PUBLISH = "job.publish";
    public static final String JOB_HOLD = "job.hold";
    public static final String JOB_CLOSE = "job.close";
    public static final String JOB_CANCEL = "job.cancel";
    public static final String JOB_DUPLICATE = "job.duplicate";
    public static final String JOB_ASSIGN_RECRUITER = "job.assign_recruiter";
    public static final String JOB_EXPORT = "job.export";

    // ---- Candidates ----
    public static final String CANDIDATE_READ_ANY = "candidate.read.any";
    public static final String CANDIDATE_READ_OWN = "candidate.read.own";
    public static final String CANDIDATE_UPDATE_ANY = "candidate.update.any";
    public static final String CANDIDATE_UPDATE_OWN = "candidate.update.own";
    public static final String CANDIDATE_NOTE_MANAGE = "candidate.note.manage";
    public static final String CANDIDATE_TAG_MANAGE = "candidate.tag.manage";
    public static final String CANDIDATE_EXPORT = "candidate.export";

    // ---- Documents ----
    public static final String DOCUMENT_UPLOAD_OWN = "document.upload.own";
    public static final String DOCUMENT_READ_OWN = "document.read.own";
    public static final String DOCUMENT_READ_ANY = "document.read.any";
    public static final String DOCUMENT_DELETE_OWN = "document.delete.own";

    // ---- Applications ----
    public static final String APPLICATION_CREATE_OWN = "application.create.own";
    public static final String APPLICATION_READ_OWN = "application.read.own";
    public static final String APPLICATION_READ_ANY = "application.read.any";
    public static final String APPLICATION_READ_ASSIGNED = "application.read.assigned";
    public static final String APPLICATION_WITHDRAW_OWN = "application.withdraw.own";
    public static final String APPLICATION_TRANSITION = "application.transition";
    public static final String APPLICATION_ASSIGN = "application.assign";
    public static final String APPLICATION_NOTE_MANAGE = "application.note.manage";
    public static final String APPLICATION_BULK = "application.bulk";
    public static final String APPLICATION_EXPORT = "application.export";

    // ---- Interviews ----
    public static final String INTERVIEW_READ_ANY = "interview.read.any";
    public static final String INTERVIEW_READ_ASSIGNED = "interview.read.assigned";
    public static final String INTERVIEW_READ_OWN = "interview.read.own";
    public static final String INTERVIEW_SCHEDULE = "interview.schedule";
    public static final String INTERVIEW_RESCHEDULE = "interview.reschedule";
    public static final String INTERVIEW_CANCEL = "interview.cancel";
    public static final String FEEDBACK_SUBMIT = "interview.feedback.submit";
    public static final String FEEDBACK_READ_ANY = "interview.feedback.read.any";

    // ---- Offers ----
    public static final String OFFER_READ_ANY = "offer.read.any";
    public static final String OFFER_READ_OWN = "offer.read.own";
    public static final String OFFER_CREATE = "offer.create";
    public static final String OFFER_UPDATE = "offer.update";
    public static final String OFFER_APPROVE = "offer.approve";
    public static final String OFFER_SEND = "offer.send";
    public static final String OFFER_WITHDRAW = "offer.withdraw";
    public static final String OFFER_RESPOND_OWN = "offer.respond.own";

    // ---- Onboarding ----
    public static final String ONBOARDING_READ_ANY = "onboarding.read.any";
    public static final String ONBOARDING_READ_OWN = "onboarding.read.own";
    public static final String ONBOARDING_MANAGE = "onboarding.manage";
    public static final String ONBOARDING_TASK_UPDATE = "onboarding.task.update";

    // ---- Reports & dashboard ----
    public static final String DASHBOARD_VIEW = "dashboard.view";
    public static final String REPORT_VIEW = "report.view";
    public static final String REPORT_EXPORT = "report.export";

    // ---- Notifications ----
    public static final String NOTIFICATION_READ_OWN = "notification.read.own";
    public static final String NOTIFICATION_TEMPLATE_MANAGE = "notification.template.manage";

    /** Every key in the catalogue, in declaration order. */
    public static final List<String> ALL = List.of(
            USER_READ, USER_CREATE, USER_UPDATE, USER_DEACTIVATE,
            ROLE_ASSIGN, PERMISSION_MANAGE, SETTINGS_READ, SETTINGS_UPDATE, AUDIT_READ,
            DEPARTMENT_READ, DEPARTMENT_MANAGE,
            JOB_READ_ANY, JOB_READ_ASSIGNED, JOB_CREATE, JOB_UPDATE, JOB_SUBMIT,
            JOB_APPROVE, JOB_PUBLISH, JOB_HOLD, JOB_CLOSE, JOB_CANCEL,
            JOB_DUPLICATE, JOB_ASSIGN_RECRUITER, JOB_EXPORT,
            CANDIDATE_READ_ANY, CANDIDATE_READ_OWN, CANDIDATE_UPDATE_ANY, CANDIDATE_UPDATE_OWN,
            CANDIDATE_NOTE_MANAGE, CANDIDATE_TAG_MANAGE, CANDIDATE_EXPORT,
            DOCUMENT_UPLOAD_OWN, DOCUMENT_READ_OWN, DOCUMENT_READ_ANY, DOCUMENT_DELETE_OWN,
            APPLICATION_CREATE_OWN, APPLICATION_READ_OWN, APPLICATION_READ_ANY,
            APPLICATION_READ_ASSIGNED, APPLICATION_WITHDRAW_OWN, APPLICATION_TRANSITION,
            APPLICATION_ASSIGN, APPLICATION_NOTE_MANAGE, APPLICATION_BULK, APPLICATION_EXPORT,
            INTERVIEW_READ_ANY, INTERVIEW_READ_ASSIGNED, INTERVIEW_READ_OWN,
            INTERVIEW_SCHEDULE, INTERVIEW_RESCHEDULE, INTERVIEW_CANCEL,
            FEEDBACK_SUBMIT, FEEDBACK_READ_ANY,
            OFFER_READ_ANY, OFFER_READ_OWN, OFFER_CREATE, OFFER_UPDATE,
            OFFER_APPROVE, OFFER_SEND, OFFER_WITHDRAW, OFFER_RESPOND_OWN,
            ONBOARDING_READ_ANY, ONBOARDING_READ_OWN, ONBOARDING_MANAGE, ONBOARDING_TASK_UPDATE,
            DASHBOARD_VIEW, REPORT_VIEW, REPORT_EXPORT,
            NOTIFICATION_READ_OWN, NOTIFICATION_TEMPLATE_MANAGE);

    /** Everything a recruiter can do — reused by the roles above it. */
    private static final List<String> RECRUITER = List.of(
            JOB_READ_ASSIGNED,
            DEPARTMENT_READ,
            CANDIDATE_READ_ANY,
            CANDIDATE_NOTE_MANAGE,
            CANDIDATE_TAG_MANAGE,
            DOCUMENT_READ_ANY,
            APPLICATION_READ_ASSIGNED,
            APPLICATION_TRANSITION,
            APPLICATION_NOTE_MANAGE,
            APPLICATION_BULK,
            APPLICATION_EXPORT,
            INTERVIEW_READ_ASSIGNED,
            INTERVIEW_SCHEDULE,
            INTERVIEW_RESCHEDULE,
            INTERVIEW_CANCEL,
            FEEDBACK_READ_ANY,
            OFFER_READ_ANY,
            ONBOARDING_READ_ANY,
            DASHBOARD_VIEW,
            REPORT_VIEW,
            NOTIFICATION_READ_OWN);

    private static final List<String> HR_ADMIN = union(RECRUITER, List.of(
            USER_READ,
            DEPARTMENT_MANAGE,
            JOB_READ_ANY,
            JOB_CREATE,
            JOB_UPDATE,
            JOB_SUBMIT,
            JOB_APPROVE,
            JOB_PUBLISH,
            JOB_HOLD,
            JOB_CLOSE,
            JOB_CANCEL,
            JOB_DUPLICATE,
            JOB_ASSIGN_RECRUITER,
            JOB_EXPORT,
            CANDIDATE_UPDATE_ANY,
            CANDIDATE_EXPORT,
            APPLICATION_READ_ANY,
            APPLICATION_ASSIGN,
            INTERVIEW_READ_ANY,
            OFFER_CREATE,
            OFFER_UPDATE,
            OFFER_APPROVE,
            OFFER_SEND,
            OFFER_WITHDRAW,
            ONBOARDING_MANAGE,
            ONBOARDING_TASK_UPDATE,
            REPORT_EXPORT,
            NOTIFICATION_TEMPLATE_MANAGE));

    /**
     * Role to permission bundles. Seeded into {@code role_permissions},
     * which stays the runtime source of truth; this map is what the seed
     * reconciles against and what the application falls back to if a role
     * has no rows yet.
     *
     * Note that HR_ADMIN deliberately lacks {@link #AUDIT_READ}: reading
     * the audit trail is a SUPER_ADMIN capability, so that an HR admin
     * cannot review the record of their own actions.
     */
    public static final Map<RoleName, List<String>> ROLE_PERMISSIONS = Map.of(
            RoleName.SUPER_ADMIN, ALL,
            RoleName.HR_ADMIN, HR_ADMIN,
            RoleName.RECRUITER, RECRUITER,
            RoleName.HIRING_MANAGER, List.of(
                    JOB_READ_ASSIGNED,
                    DEPARTMENT_READ,
                    JOB_CREATE,
                    JOB_SUBMIT,
                    CANDIDATE_READ_ANY,
                    DOCUMENT_READ_ANY,
                    APPLICATION_READ_ASSIGNED,
                    APPLICATION_TRANSITION,
                    APPLICATION_NOTE_MANAGE,
                    INTERVIEW_READ_ASSIGNED,
                    INTERVIEW_SCHEDULE,
                    FEEDBACK_SUBMIT,
                    FEEDBACK_READ_ANY,
                    OFFER_READ_ANY,
                    DASHBOARD_VIEW,
                    REPORT_VIEW,
                    NOTIFICATION_READ_OWN),
            RoleName.INTERVIEWER, List.of(
                    INTERVIEW_READ_ASSIGNED,
                    FEEDBACK_SUBMIT,
                    CANDIDATE_READ_ANY,
                    DOCUMENT_READ_ANY,
                    NOTIFICATION_READ_OWN),
            // A candidate can only ever reach their OWN records. Note the
            // deliberate absence of every ".any" permission.
            RoleName.CANDIDATE, List.of(
                    CANDIDATE_READ_OWN,
                    CANDIDATE_UPDATE_OWN,
                    DOCUMENT_UPLOAD_OWN,
                    DOCUMENT_READ_OWN,
                    DOCUMENT_DELETE_OWN,
                    APPLICATION_CREATE_OWN,
                    APPLICATION_READ_OWN,
                    APPLICATION_WITHDRAW_OWN,
                    INTERVIEW_READ_OWN,
                    OFFER_READ_OWN,
                    OFFER_RESPOND_OWN,
                    ONBOARDING_READ_OWN,
                    NOTIFICATION_READ_OWN));

    /** Human-readable labels used by the seed and the admin UI. */
    public static final Map<RoleName, String> ROLE_LABELS = Map.of(
            RoleName.SUPER_ADMIN, "Super Admin",
            RoleName.HR_ADMIN, "HR Admin",
            RoleName.RECRUITER, "Recruiter",
            RoleName.HIRING_MANAGER, "Hiring Manager",
            RoleName.INTERVIEWER, "Interviewer",
            RoleName.CANDIDATE, "Candidate");

    /** Splits {@code job.read.any} into resource {@code job} and action {@code read.any}. */
    public static String[] describe(String key) {
        int dot = key.indexOf('.');
        if (dot < 0) {
            return new String[] {key, "access"};
        }
        return new String[] {key.substring(0, dot), key.substring(dot + 1)};
    }

    @SafeVarargs
    private static List<String> union(List<String>... groups) {
        Set<String> merged = new LinkedHashSet<>();
        Arrays.stream(groups).forEach(merged::addAll);
        return List.copyOf(new ArrayList<>(merged));
    }
}
