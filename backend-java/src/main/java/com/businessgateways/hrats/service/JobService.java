package com.businessgateways.hrats.service;

import com.businessgateways.hrats.common.ApiException;
import com.businessgateways.hrats.common.Constants;
import com.businessgateways.hrats.common.WorkflowRules;
import com.businessgateways.hrats.common.dto.PageResponse;
import com.businessgateways.hrats.common.dto.PaginationQuery;
import com.businessgateways.hrats.domain.entity.JobApproval;
import com.businessgateways.hrats.domain.entity.JobRequirement;
import com.businessgateways.hrats.domain.entity.JobRequirementHistory;
import com.businessgateways.hrats.domain.entity.JobSkill;
import com.businessgateways.hrats.domain.enums.Enums.ApplicationStatus;
import com.businessgateways.hrats.domain.enums.Enums.ApprovalDecision;
import com.businessgateways.hrats.domain.enums.Enums.JobStatus;
import com.businessgateways.hrats.domain.enums.Enums.RoleName;
import com.businessgateways.hrats.dto.CommonDtos.DepartmentRef;
import com.businessgateways.hrats.dto.CommonDtos.PersonRef;
import com.businessgateways.hrats.dto.CommonDtos.SkillRef;
import com.businessgateways.hrats.dto.JobDtos.ApprovalRequest;
import com.businessgateways.hrats.dto.JobDtos.ApprovalResponse;
import com.businessgateways.hrats.dto.JobDtos.AssignRecruiterRequest;
import com.businessgateways.hrats.dto.JobDtos.JobHistoryResponse;
import com.businessgateways.hrats.dto.JobDtos.JobResponse;
import com.businessgateways.hrats.dto.JobDtos.JobSkillResponse;
import com.businessgateways.hrats.dto.JobDtos.JobSummary;
import com.businessgateways.hrats.dto.JobDtos.StatusChangeRequest;
import com.businessgateways.hrats.dto.JobDtos.UpsertJobRequest;
import com.businessgateways.hrats.repository.DepartmentRepository;
import com.businessgateways.hrats.repository.JobApplicationRepository;
import com.businessgateways.hrats.repository.JobApprovalRepository;
import com.businessgateways.hrats.repository.JobRequirementHistoryRepository;
import com.businessgateways.hrats.repository.JobRequirementRepository;
import com.businessgateways.hrats.repository.JobSkillRepository;
import com.businessgateways.hrats.repository.SkillRepository;
import com.businessgateways.hrats.repository.UserRepository;
import com.businessgateways.hrats.security.AuthenticatedUser;
import com.businessgateways.hrats.security.Permissions;
import jakarta.persistence.criteria.Predicate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Job requirements and their approval workflow.
 *
 * The status machine lives in {@link WorkflowRules} and is enforced
 * here, not in the controller, so that every path into a status change
 * — the UI, a bulk action, a scheduled job — goes through the same
 * check.
 */
@Service
public class JobService {

    private static final Logger log = LoggerFactory.getLogger(JobService.class);

    private static final List<String> SORTABLE = List.of(
            "createdAt", "updatedAt", "title", "requirementCode", "priority",
            "status", "publishedAt", "applicationDeadline", "vacancies");

    private final JobRequirementRepository jobs;
    private final JobSkillRepository jobSkills;
    private final JobApprovalRepository approvals;
    private final JobRequirementHistoryRepository history;
    private final JobApplicationRepository applications;
    private final DepartmentRepository departments;
    private final SkillRepository skills;
    private final UserRepository users;
    private final CodeGenerator codes;
    private final AuditService audit;
    private final NotificationService notifications;

    public JobService(
            JobRequirementRepository jobs,
            JobSkillRepository jobSkills,
            JobApprovalRepository approvals,
            JobRequirementHistoryRepository history,
            JobApplicationRepository applications,
            DepartmentRepository departments,
            SkillRepository skills,
            UserRepository users,
            CodeGenerator codes,
            AuditService audit,
            NotificationService notifications) {
        this.jobs = jobs;
        this.jobSkills = jobSkills;
        this.approvals = approvals;
        this.history = history;
        this.applications = applications;
        this.departments = departments;
        this.skills = skills;
        this.users = users;
        this.codes = codes;
        this.audit = audit;
        this.notifications = notifications;
    }

    // -----------------------------------------------------------------
    //  Reading
    // -----------------------------------------------------------------

    @Transactional(readOnly = true)
    public PageResponse<JobSummary> list(
            PaginationQuery query,
            JobStatus status,
            String departmentId,
            com.businessgateways.hrats.domain.enums.Enums.Priority priority,
            String recruiterId,
            AuthenticatedUser caller) {

        Specification<JobRequirement> spec = buildSpec(query, status, departmentId, priority, recruiterId, caller);
        Page<JobRequirement> page = jobs.findAll(spec, query.pageable(SORTABLE, "createdAt"));

        return PageResponse.from(page, this::toSummary);
    }

    /**
     * Narrows the result set to what the caller is allowed to see.
     *
     * A reader with only {@code job.read.assigned} sees the
     * requisitions they recruit for, hire for or raised — not the whole
     * organisation's pipeline.
     */
    private Specification<JobRequirement> buildSpec(
            PaginationQuery query,
            JobStatus status,
            String departmentId,
            com.businessgateways.hrats.domain.enums.Enums.Priority priority,
            String recruiterId,
            AuthenticatedUser caller) {

        return (root, criteria, builder) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (status != null) {
                predicates.add(builder.equal(root.get("status"), status));
            }
            if (departmentId != null && !departmentId.isBlank()) {
                predicates.add(builder.equal(root.get("departmentId"), departmentId));
            }
            if (priority != null) {
                predicates.add(builder.equal(root.get("priority"), priority));
            }
            if (recruiterId != null && !recruiterId.isBlank()) {
                predicates.add(builder.equal(root.get("recruiterId"), recruiterId));
            }

            String term = query.searchTerm();
            if (term != null) {
                String like = "%" + term.toLowerCase() + "%";
                predicates.add(builder.or(
                        builder.like(builder.lower(root.get("title")), like),
                        builder.like(builder.lower(root.get("requirementCode")), like),
                        builder.like(builder.lower(root.get("designation")), like),
                        builder.like(builder.lower(root.get("location")), like)));
            }

            if (caller != null && !caller.hasPermission(Permissions.JOB_READ_ANY)) {
                predicates.add(builder.or(
                        builder.equal(root.get("recruiterId"), caller.userId()),
                        builder.equal(root.get("hiringManagerId"), caller.userId()),
                        builder.equal(root.get("requestedById"), caller.userId())));
            }

            return builder.and(predicates.toArray(new Predicate[0]));
        };
    }

    @Transactional(readOnly = true)
    public JobResponse get(String id, AuthenticatedUser caller) {
        JobRequirement job = require(id);
        assertCanView(job, caller);
        return toResponse(job, caller);
    }

    @Transactional(readOnly = true)
    public List<JobHistoryResponse> history(String id, AuthenticatedUser caller) {
        JobRequirement job = require(id);
        assertCanView(job, caller);

        return history.findByJobIdOrderByChangedAtDesc(id).stream()
                .map(entry -> new JobHistoryResponse(
                        entry.getId(),
                        entry.getFieldName(),
                        entry.getOldValue(),
                        entry.getNewValue(),
                        entry.getReason(),
                        users.findById(entry.getChangedById())
                                .map(PersonRef::withoutEmail).orElse(null),
                        entry.getChangedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ApprovalResponse> pendingApprovals(AuthenticatedUser caller) {
        return approvals
                .findByApproverIdAndDecisionOrderByCreatedAtDesc(caller.userId(), ApprovalDecision.PENDING)
                .stream()
                .map(this::toApprovalResponse)
                .toList();
    }

    // -----------------------------------------------------------------
    //  Writing
    // -----------------------------------------------------------------

    @Transactional
    public JobResponse create(UpsertJobRequest request, AuthenticatedUser caller) {
        validateSalaryBand(request);

        departments.findById(request.departmentId())
                .orElseThrow(() -> ApiException.badRequest("That department does not exist."));

        JobRequirement job = new JobRequirement();
        job.setRequirementCode(codes.nextJobCode());
        job.setSlug(CodeGenerator.slugify(request.title(), shortSuffix()));
        job.setStatus(JobStatus.DRAFT);
        job.setRequestedById(caller.userId());
        job.setCreatedById(caller.userId());
        job.setRequestDate(Instant.now());

        applyEditableFields(job, request);
        jobs.save(job);
        replaceSkills(job.getId(), request);

        audit.record(caller, Constants.Audit.JOB_CREATED, "job", job.getId(),
                Map.of("requirementCode", job.getRequirementCode()));

        return toResponse(job, caller);
    }

    @Transactional
    public JobResponse update(String id, UpsertJobRequest request, AuthenticatedUser caller) {
        JobRequirement job = require(id);
        assertCanView(job, caller);
        validateSalaryBand(request);

        // A published requisition is what candidates applied to. Editing
        // its substance after the fact would change the deal under them,
        // so published and closed requisitions are read-only except for
        // the fields the dedicated endpoints cover.
        if (job.getStatus() == JobStatus.CLOSED || job.getStatus() == JobStatus.CANCELLED) {
            throw ApiException.unprocessable(
                    "A " + job.getStatus().name().toLowerCase() + " requisition cannot be edited.");
        }

        recordChanges(job, request, caller);
        applyEditableFields(job, request);

        // Re-opening for approval: a material change should be looked at
        // again rather than riding on the earlier sign-off.
        if (job.getStatus() == JobStatus.APPROVED) {
            job.setStatus(JobStatus.DRAFT);
            log.info("Requisition {} returned to DRAFT after an edit to an approved record",
                    job.getRequirementCode());
        }

        jobs.save(job);
        replaceSkills(job.getId(), request);

        audit.record(caller, "JOB_UPDATED", "job", job.getId(), null);
        return toResponse(job, caller);
    }

    @Transactional
    public JobResponse submitForApproval(String id, AuthenticatedUser caller) {
        JobRequirement job = require(id);
        assertCanView(job, caller);

        transition(job, JobStatus.PENDING_APPROVAL, null, caller);

        // Everyone who can approve gets a pending row, and the first
        // decision settles it. A fixed approver chain would stall the
        // moment one person went on leave.
        List<com.businessgateways.hrats.domain.entity.User> approvers =
                users.findByRoleAndStatus(RoleName.HR_ADMIN,
                        com.businessgateways.hrats.domain.enums.Enums.UserStatus.ACTIVE);

        if (approvers.isEmpty()) {
            throw ApiException.unprocessable(
                    "There is no active HR administrator to approve this requisition.");
        }

        int sequence = 1;
        for (var approver : approvers) {
            JobApproval approval = new JobApproval();
            approval.setJobId(job.getId());
            approval.setApproverId(approver.getId());
            approval.setSequence(sequence++);
            approval.setDecision(ApprovalDecision.PENDING);
            approvals.save(approval);

            notifications.notify(approver.getId(), "job.approval_requested",
                    "Approval requested: " + job.getTitle(),
                    job.getRequirementCode() + " is waiting for your decision.",
                    "/jobs/" + job.getId());
        }

        audit.record(caller, Constants.Audit.JOB_SUBMITTED, "job", job.getId(),
                Map.of("approvers", approvers.size()));

        return toResponse(job, caller);
    }

    @Transactional
    public JobResponse decideApproval(String id, ApprovalRequest request, AuthenticatedUser caller) {
        JobRequirement job = require(id);

        if (job.getStatus() != JobStatus.PENDING_APPROVAL) {
            throw ApiException.unprocessable(
                    "This requisition is not awaiting approval.");
        }
        if (request.decision() == ApprovalDecision.PENDING) {
            throw ApiException.badRequest("Choose APPROVED or REJECTED.");
        }

        JobApproval approval = approvals.findByJobIdOrderBySequenceAsc(id).stream()
                .filter(row -> row.getApproverId().equals(caller.userId()))
                .filter(row -> row.getDecision() == ApprovalDecision.PENDING)
                .findFirst()
                .orElseThrow(() -> ApiException.forbidden(
                        "You do not have a pending approval for this requisition."));

        approval.setDecision(request.decision());
        approval.setComments(request.comments());
        approval.setDecidedAt(Instant.now());
        approvals.save(approval);

        boolean approved = request.decision() == ApprovalDecision.APPROVED;
        job.setStatus(approved ? JobStatus.APPROVED : JobStatus.DRAFT);
        jobs.save(job);

        recordHistory(job, "status", JobStatus.PENDING_APPROVAL.name(), job.getStatus().name(),
                request.comments(), caller);

        // One decision settles the requisition, so the other approvers'
        // rows are closed with the same outcome. Leaving them PENDING
        // would keep a decided requisition sitting in their queue.
        approvals.findByJobIdOrderBySequenceAsc(id).stream()
                .filter(row -> !row.getId().equals(approval.getId()))
                .filter(row -> row.getDecision() == ApprovalDecision.PENDING)
                .forEach(row -> {
                    row.setDecision(request.decision());
                    row.setComments("Settled by " + caller.email() + ".");
                    row.setDecidedAt(Instant.now());
                    approvals.save(row);
                });

        notifications.notify(job.getRequestedById(),
                approved ? "job.approved" : "job.rejected",
                (approved ? "Approved: " : "Returned: ") + job.getTitle(),
                approved
                        ? job.getRequirementCode() + " is approved and can be published."
                        : job.getRequirementCode() + " was sent back for changes.",
                "/jobs/" + job.getId());

        audit.record(caller,
                approved ? Constants.Audit.JOB_APPROVED : Constants.Audit.JOB_REJECTED,
                "job", job.getId(), Map.of("comments", String.valueOf(request.comments())));

        return toResponse(job, caller);
    }

    @Transactional
    public JobResponse changeStatus(String id, StatusChangeRequest request, AuthenticatedUser caller) {
        JobRequirement job = require(id);
        assertCanView(job, caller);

        requirePermissionFor(request.status(), caller);
        transition(job, request.status(), request.reason(), caller);

        return toResponse(job, caller);
    }

    /** Maps a target status to the permission that authorises reaching it. */
    private void requirePermissionFor(JobStatus target, AuthenticatedUser caller) {
        String needed = switch (target) {
            case PUBLISHED -> Permissions.JOB_PUBLISH;
            case ON_HOLD -> Permissions.JOB_HOLD;
            case CLOSED -> Permissions.JOB_CLOSE;
            case CANCELLED -> Permissions.JOB_CANCEL;
            case PENDING_APPROVAL -> Permissions.JOB_SUBMIT;
            case APPROVED -> Permissions.JOB_APPROVE;
            case DRAFT -> Permissions.JOB_UPDATE;
        };

        if (!caller.hasPermission(needed)) {
            throw ApiException.forbidden("You do not have permission to do that.");
        }
    }

    private void transition(
            JobRequirement job, JobStatus target, String reason, AuthenticatedUser caller) {

        JobStatus from = job.getStatus();

        if (!WorkflowRules.canTransitionJob(from, target)) {
            throw ApiException.unprocessable(
                    "A requisition cannot move from " + from + " to " + target + ".");
        }

        if (target == JobStatus.PUBLISHED) {
            if (job.getRecruiterId() == null) {
                throw ApiException.unprocessable(
                        "Assign a recruiter before publishing this requisition.");
            }
            if (job.getPublishedAt() == null) {
                job.setPublishedAt(Instant.now());
            }
            job.setOnHoldReason(null);
        }

        if (target == JobStatus.ON_HOLD) {
            job.setOnHoldReason(reason);
        }
        if (target == JobStatus.CANCELLED) {
            job.setCancelReason(reason);
        }
        if (target == JobStatus.CLOSED) {
            job.setClosedAt(Instant.now());
        }
        if (from == JobStatus.CLOSED && target == JobStatus.PUBLISHED) {
            job.setClosedAt(null);
        }

        job.setStatus(target);
        jobs.save(job);

        recordHistory(job, "status", from.name(), target.name(), reason, caller);

        audit.record(caller,
                target == JobStatus.PUBLISHED
                        ? Constants.Audit.JOB_PUBLISHED
                        : Constants.Audit.JOB_STATUS_CHANGED,
                "job", job.getId(),
                Map.of("from", from.name(), "to", target.name(), "reason", String.valueOf(reason)));
    }

    @Transactional
    public JobResponse duplicate(String id, AuthenticatedUser caller) {
        JobRequirement source = require(id);

        JobRequirement copy = new JobRequirement();
        copy.setRequirementCode(codes.nextJobCode());
        copy.setTitle(source.getTitle());
        copy.setSlug(CodeGenerator.slugify(source.getTitle(), shortSuffix()));
        copy.setDescription(source.getDescription());
        copy.setResponsibilities(source.getResponsibilities());
        copy.setQualifications(source.getQualifications());
        copy.setInternalNotes(source.getInternalNotes());
        copy.setMinExperience(source.getMinExperience());
        copy.setMaxExperience(source.getMaxExperience());
        copy.setDepartmentId(source.getDepartmentId());
        copy.setDesignation(source.getDesignation());
        copy.setVacancies(source.getVacancies());
        copy.setEmploymentType(source.getEmploymentType());
        copy.setWorkMode(source.getWorkMode());
        copy.setLocation(source.getLocation());
        copy.setSalaryMin(source.getSalaryMin());
        copy.setSalaryMax(source.getSalaryMax());
        copy.setSalaryCurrency(source.getSalaryCurrency());
        copy.setSalaryConfidential(source.isSalaryConfidential());
        copy.setPriority(source.getPriority());
        copy.setRecruiterId(source.getRecruiterId());
        copy.setHiringManagerId(source.getHiringManagerId());

        // A copy starts fresh: no approvals, no fill count, no live date.
        copy.setStatus(JobStatus.DRAFT);
        copy.setVacanciesFilled(0);
        copy.setRequestedById(caller.userId());
        copy.setCreatedById(caller.userId());
        copy.setRequestDate(Instant.now());
        copy.setDuplicatedFromId(source.getId());

        jobs.save(copy);

        jobSkills.findByJobId(source.getId()).forEach(skill -> {
            JobSkill clone = new JobSkill();
            clone.setJobId(copy.getId());
            clone.setSkillId(skill.getSkillId());
            clone.setRequired(skill.isRequired());
            clone.setMinYears(skill.getMinYears());
            jobSkills.save(clone);
        });

        audit.record(caller, Constants.Audit.JOB_CREATED, "job", copy.getId(),
                Map.of("duplicatedFrom", source.getRequirementCode()));

        return toResponse(copy, caller);
    }

    @Transactional
    public JobResponse assignRecruiter(String id, AssignRecruiterRequest request, AuthenticatedUser caller) {
        JobRequirement job = require(id);

        if (request.recruiterId() != null) {
            users.findById(request.recruiterId())
                    .orElseThrow(() -> ApiException.badRequest("That recruiter does not exist."));
            recordHistory(job, "recruiterId", job.getRecruiterId(), request.recruiterId(), null, caller);
            job.setRecruiterId(request.recruiterId());

            notifications.notify(request.recruiterId(), "job.assigned",
                    "Assigned to you: " + job.getTitle(),
                    "You are now the recruiter for " + job.getRequirementCode() + ".",
                    "/jobs/" + job.getId());
        }

        if (request.hiringManagerId() != null) {
            users.findById(request.hiringManagerId())
                    .orElseThrow(() -> ApiException.badRequest("That hiring manager does not exist."));
            recordHistory(job, "hiringManagerId", job.getHiringManagerId(),
                    request.hiringManagerId(), null, caller);
            job.setHiringManagerId(request.hiringManagerId());
        }

        jobs.save(job);
        audit.record(caller, "JOB_RECRUITER_ASSIGNED", "job", job.getId(), null);

        return toResponse(job, caller);
    }

    // -----------------------------------------------------------------
    //  Export
    // -----------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<Map<String, Object>> exportRows(
            PaginationQuery query,
            JobStatus status,
            String departmentId,
            com.businessgateways.hrats.domain.enums.Enums.Priority priority,
            String recruiterId,
            AuthenticatedUser caller) {

        return jobs.findAll(buildSpec(query, status, departmentId, priority, recruiterId, caller))
                .stream()
                .map(job -> {
                    Map<String, Object> row = new java.util.LinkedHashMap<>();
                    row.put("Code", job.getRequirementCode());
                    row.put("Title", job.getTitle());
                    row.put("Department", job.getDepartment() == null ? "" : job.getDepartment().getName());
                    row.put("Designation", job.getDesignation());
                    row.put("Location", job.getLocation());
                    row.put("Employment Type", job.getEmploymentType());
                    row.put("Work Mode", job.getWorkMode());
                    row.put("Status", job.getStatus());
                    row.put("Priority", job.getPriority());
                    row.put("Vacancies", job.getVacancies());
                    row.put("Filled", job.getVacanciesFilled());
                    row.put("Recruiter", job.getRecruiter() == null ? "" : job.getRecruiter().fullName());
                    row.put("Applications", applications.findByJobId(job.getId()).size());
                    row.put("Published", job.getPublishedAt());
                    row.put("Deadline", job.getApplicationDeadline());
                    row.put("Created", job.getCreatedAt());
                    return row;
                })
                .toList();
    }

    // -----------------------------------------------------------------
    //  Helpers
    // -----------------------------------------------------------------

    private JobRequirement require(String id) {
        return jobs.findById(id).orElseThrow(() -> ApiException.notFound("Job requirement", id));
    }

    private void assertCanView(JobRequirement job, AuthenticatedUser caller) {
        if (caller == null) {
            throw ApiException.unauthorized("Authentication required.");
        }
        if (caller.hasPermission(Permissions.JOB_READ_ANY)) {
            return;
        }

        boolean assigned = caller.userId().equals(job.getRecruiterId())
                || caller.userId().equals(job.getHiringManagerId())
                || caller.userId().equals(job.getRequestedById());

        if (!assigned) {
            // 404, not 403: confirming that a requisition exists is
            // itself information the caller is not entitled to.
            throw ApiException.notFound("Job requirement", job.getId());
        }
    }

    private void validateSalaryBand(UpsertJobRequest request) {
        if (request.salaryMin() != null && request.salaryMax() != null
                && request.salaryMin().compareTo(request.salaryMax()) > 0) {
            throw ApiException.badRequest("The minimum salary cannot exceed the maximum.");
        }
        if (request.maxExperience() != null && request.maxExperience() < request.minExperience()) {
            throw ApiException.badRequest("The maximum experience cannot be below the minimum.");
        }
    }

    private void applyEditableFields(JobRequirement job, UpsertJobRequest request) {
        job.setTitle(request.title().trim());
        job.setDescription(request.description());
        job.setResponsibilities(request.responsibilities());
        job.setQualifications(request.qualifications());
        job.setInternalNotes(request.internalNotes());
        job.setMinExperience(request.minExperience());
        job.setMaxExperience(request.maxExperience());
        job.setDepartmentId(request.departmentId());
        job.setDesignation(request.designation().trim());
        job.setVacancies(request.vacancies());
        job.setEmploymentType(request.employmentType());
        job.setWorkMode(request.workMode());
        job.setLocation(request.location().trim());
        job.setSalaryMin(request.salaryMin());
        job.setSalaryMax(request.salaryMax());
        job.setSalaryCurrency(
                request.salaryCurrency() == null ? "USD" : request.salaryCurrency().toUpperCase());
        job.setSalaryConfidential(
                request.salaryConfidential() == null || request.salaryConfidential());
        job.setPriority(request.priority());
        job.setRecruiterId(request.recruiterId());
        job.setHiringManagerId(request.hiringManagerId());
        job.setApplicationDeadline(request.applicationDeadline());
    }

    private void replaceSkills(String jobId, UpsertJobRequest request) {
        jobSkills.deleteByJobId(jobId);
        if (request.skills() == null) {
            return;
        }

        for (var requested : request.skills()) {
            skills.findById(requested.skillId())
                    .orElseThrow(() -> ApiException.badRequest(
                            "Skill \"" + requested.skillId() + "\" does not exist."));

            JobSkill row = new JobSkill();
            row.setJobId(jobId);
            row.setSkillId(requested.skillId());
            row.setRequired(requested.isRequired());
            row.setMinYears(requested.minYears());
            jobSkills.save(row);
        }
    }

    /** Writes a history row for each field the edit actually changed. */
    private void recordChanges(JobRequirement job, UpsertJobRequest request, AuthenticatedUser caller) {
        compare(job, caller, "title", job.getTitle(), request.title());
        compare(job, caller, "designation", job.getDesignation(), request.designation());
        compare(job, caller, "location", job.getLocation(), request.location());
        compare(job, caller, "vacancies", job.getVacancies(), request.vacancies());
        compare(job, caller, "priority", job.getPriority(), request.priority());
        compare(job, caller, "employmentType", job.getEmploymentType(), request.employmentType());
        compare(job, caller, "workMode", job.getWorkMode(), request.workMode());
        compare(job, caller, "salaryMin", job.getSalaryMin(), request.salaryMin());
        compare(job, caller, "salaryMax", job.getSalaryMax(), request.salaryMax());
        compare(job, caller, "departmentId", job.getDepartmentId(), request.departmentId());
        compare(job, caller, "applicationDeadline",
                job.getApplicationDeadline(), request.applicationDeadline());
    }

    private void compare(
            JobRequirement job, AuthenticatedUser caller, String field, Object before, Object after) {
        if (Objects.equals(before, after)) {
            return;
        }
        recordHistory(job, field,
                before == null ? null : String.valueOf(before),
                after == null ? null : String.valueOf(after),
                null, caller);
    }

    private void recordHistory(
            JobRequirement job, String field, String before, String after,
            String reason, AuthenticatedUser caller) {

        JobRequirementHistory entry = new JobRequirementHistory();
        entry.setJobId(job.getId());
        entry.setChangedById(caller.userId());
        entry.setFieldName(field);
        entry.setOldValue(before);
        entry.setNewValue(after);
        entry.setReason(reason);
        history.save(entry);
    }

    /** Eight hex characters: enough to keep slugs apart, short enough to read. */
    private String shortSuffix() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    // -----------------------------------------------------------------
    //  Projection
    // -----------------------------------------------------------------

    public JobSummary toSummary(JobRequirement job) {
        return new JobSummary(
                job.getId(),
                job.getRequirementCode(),
                job.getTitle(),
                job.getSlug(),
                job.getStatus(),
                job.getPriority(),
                job.getDesignation(),
                job.getLocation(),
                job.getEmploymentType(),
                job.getWorkMode(),
                job.getVacancies(),
                job.getVacanciesFilled(),
                DepartmentRef.of(job.getDepartment()),
                PersonRef.withoutEmail(job.getRecruiter()),
                applications.countByJobIdAndStatus(job.getId(), ApplicationStatus.ACTIVE),
                job.getPublishedAt(),
                job.getApplicationDeadline(),
                job.getCreatedAt());
    }

    public JobResponse toResponse(JobRequirement job, AuthenticatedUser caller) {
        List<JobSkillResponse> skillRows = jobSkills.findByJobId(job.getId()).stream()
                .map(row -> new JobSkillResponse(
                        SkillRef.of(row.getSkill()), row.isRequired(), row.getMinYears()))
                .toList();

        List<ApprovalResponse> approvalRows = approvals.findByJobIdOrderBySequenceAsc(job.getId())
                .stream().map(this::toApprovalResponse).toList();

        // Internal notes are for the hiring team, not for every reader
        // who happens to be assigned to the requisition.
        boolean showInternal = caller != null && caller.hasPermission(Permissions.JOB_READ_ANY);

        return new JobResponse(
                job.getId(),
                job.getRequirementCode(),
                job.getTitle(),
                job.getSlug(),
                job.getDescription(),
                job.getResponsibilities(),
                job.getQualifications(),
                showInternal ? job.getInternalNotes() : null,
                job.getStatus(),
                job.getPriority(),
                job.getDesignation(),
                job.getDepartmentId(),
                DepartmentRef.of(job.getDepartment()),
                job.getLocation(),
                job.getEmploymentType(),
                job.getWorkMode(),
                job.getVacancies(),
                job.getVacanciesFilled(),
                job.getMinExperience(),
                job.getMaxExperience(),
                job.getSalaryMin(),
                job.getSalaryMax(),
                job.getSalaryCurrency(),
                job.isSalaryConfidential(),
                PersonRef.of(job.getRecruiter()),
                PersonRef.withoutEmail(job.getHiringManager()),
                PersonRef.withoutEmail(job.getRequestedBy()),
                skillRows,
                applications.findByJobId(job.getId()).size(),
                approvalRows,
                job.getOnHoldReason(),
                job.getCancelReason(),
                job.getRequestDate(),
                job.getPublishedAt(),
                job.getApplicationDeadline(),
                job.getClosedAt(),
                job.getCreatedAt(),
                job.getUpdatedAt());
    }

    private ApprovalResponse toApprovalResponse(JobApproval approval) {
        return new ApprovalResponse(
                approval.getId(),
                approval.getJobId(),
                approval.getApproverId(),
                approval.getSequence(),
                approval.getDecision(),
                approval.getComments(),
                approval.getDecidedAt(),
                approval.getCreatedAt(),
                PersonRef.withoutEmail(approval.getApprover()),
                approval.getJob() == null ? null : toSummary(approval.getJob()));
    }
}
