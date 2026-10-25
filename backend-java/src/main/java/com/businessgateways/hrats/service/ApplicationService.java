package com.businessgateways.hrats.service;

import com.businessgateways.hrats.common.ApiException;
import com.businessgateways.hrats.common.Constants;
import com.businessgateways.hrats.common.WorkflowRules;
import com.businessgateways.hrats.common.dto.PageResponse;
import com.businessgateways.hrats.common.dto.PaginationQuery;
import com.businessgateways.hrats.domain.entity.ApplicationNote;
import com.businessgateways.hrats.domain.entity.ApplicationStatusHistory;
import com.businessgateways.hrats.domain.entity.CandidateProfile;
import com.businessgateways.hrats.domain.entity.Interview;
import com.businessgateways.hrats.domain.entity.JobApplication;
import com.businessgateways.hrats.domain.entity.JobRequirement;
import com.businessgateways.hrats.domain.enums.Enums.ApplicationStage;
import com.businessgateways.hrats.domain.enums.Enums.ApplicationStatus;
import com.businessgateways.hrats.domain.enums.Enums.InterviewStatus;
import com.businessgateways.hrats.domain.enums.Enums.JobStatus;
import com.businessgateways.hrats.domain.enums.Enums.ScreeningResult;
import com.businessgateways.hrats.dto.ApplicationDtos.ApplicationResponse;
import com.businessgateways.hrats.dto.ApplicationDtos.ApplicationSummary;
import com.businessgateways.hrats.dto.ApplicationDtos.BulkResult;
import com.businessgateways.hrats.dto.ApplicationDtos.BulkTransitionRequest;
import com.businessgateways.hrats.dto.ApplicationDtos.BulkTransitionResponse;
import com.businessgateways.hrats.dto.ApplicationDtos.CandidateRef;
import com.businessgateways.hrats.dto.ApplicationDtos.CreateApplicationRequest;
import com.businessgateways.hrats.dto.ApplicationDtos.NextInterviewRef;
import com.businessgateways.hrats.dto.ApplicationDtos.NoteRequest;
import com.businessgateways.hrats.dto.ApplicationDtos.NoteResponse;
import com.businessgateways.hrats.dto.ApplicationDtos.PipelineBoard;
import com.businessgateways.hrats.dto.ApplicationDtos.PipelineCard;
import com.businessgateways.hrats.dto.ApplicationDtos.PipelineColumn;
import com.businessgateways.hrats.dto.ApplicationDtos.StatusHistoryResponse;
import com.businessgateways.hrats.dto.ApplicationDtos.TransitionRequest;
import com.businessgateways.hrats.dto.CandidateDtos.DocumentResponse;
import com.businessgateways.hrats.dto.CandidateDtos.TagResponse;
import com.businessgateways.hrats.dto.CommonDtos.PersonRef;
import com.businessgateways.hrats.dto.CommonDtos.SourceRef;
import com.businessgateways.hrats.repository.ApplicationNoteRepository;
import com.businessgateways.hrats.repository.ApplicationStatusHistoryRepository;
import com.businessgateways.hrats.repository.CandidateDocumentRepository;
import com.businessgateways.hrats.repository.CandidateProfileRepository;
import com.businessgateways.hrats.repository.CandidateSkillRepository;
import com.businessgateways.hrats.repository.CandidateTagLinkRepository;
import com.businessgateways.hrats.repository.InterviewRepository;
import com.businessgateways.hrats.repository.JobApplicationRepository;
import com.businessgateways.hrats.repository.JobRequirementRepository;
import com.businessgateways.hrats.repository.RecruitmentSourceRepository;
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

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Applications and the twelve-stage recruitment pipeline.
 *
 * The single most important rule here is the {@code activeJobKey}
 * invariant. The column holds the job id while an application is live
 * and NULL once it reaches a terminal status, and the database has a
 * unique index on {@code (candidateId, activeJobKey)}. MySQL treats
 * NULLs as distinct in a unique index, so that one index enforces "at
 * most one live application per candidate per job" while still allowing
 * a rejected candidate to re-apply later. Every write path that changes
 * a status must keep the two in step — {@link #applyStatus} is the only
 * place that sets either, so that it cannot drift.
 */
@Service
public class ApplicationService {

    private static final Logger log = LoggerFactory.getLogger(ApplicationService.class);

    private static final List<String> SORTABLE = List.of(
            "appliedAt", "lastUpdatedAt", "stageEnteredAt", "followUpDueAt",
            "currentStage", "status", "applicationCode");

    private final JobApplicationRepository applications;
    private final ApplicationStatusHistoryRepository histories;
    private final ApplicationNoteRepository notes;
    private final JobRequirementRepository jobs;
    private final CandidateProfileRepository candidates;
    private final CandidateSkillRepository candidateSkills;
    private final CandidateTagLinkRepository tagLinks;
    private final CandidateDocumentRepository documents;
    private final InterviewRepository interviews;
    private final RecruitmentSourceRepository sources;
    private final UserRepository users;
    private final CodeGenerator codes;
    private final AuditService audit;
    private final NotificationService notifications;
    private final CandidateService candidateService;

    public ApplicationService(
            JobApplicationRepository applications,
            ApplicationStatusHistoryRepository histories,
            ApplicationNoteRepository notes,
            JobRequirementRepository jobs,
            CandidateProfileRepository candidates,
            CandidateSkillRepository candidateSkills,
            CandidateTagLinkRepository tagLinks,
            CandidateDocumentRepository documents,
            InterviewRepository interviews,
            RecruitmentSourceRepository sources,
            UserRepository users,
            CodeGenerator codes,
            AuditService audit,
            NotificationService notifications,
            CandidateService candidateService) {
        this.applications = applications;
        this.histories = histories;
        this.notes = notes;
        this.jobs = jobs;
        this.candidates = candidates;
        this.candidateSkills = candidateSkills;
        this.tagLinks = tagLinks;
        this.documents = documents;
        this.interviews = interviews;
        this.sources = sources;
        this.users = users;
        this.codes = codes;
        this.audit = audit;
        this.notifications = notifications;
        this.candidateService = candidateService;
    }

    // -----------------------------------------------------------------
    //  Creating
    // -----------------------------------------------------------------

    @Transactional
    public ApplicationResponse apply(CreateApplicationRequest request, AuthenticatedUser caller) {
        CandidateProfile candidate = resolveCandidate(request.candidateId(), caller);

        JobRequirement job = jobs.findById(request.jobId())
                .orElseThrow(() -> ApiException.notFound("Job requirement", request.jobId()));

        if (job.getStatus() != JobStatus.PUBLISHED) {
            throw ApiException.unprocessable("That opening is not accepting applications.");
        }
        if (job.getApplicationDeadline() != null
                && job.getApplicationDeadline().isBefore(Instant.now())) {
            throw ApiException.unprocessable("The deadline for that opening has passed.");
        }

        // Checked here for a clear message; the unique index is what
        // actually guarantees it when two requests race.
        applications.findByCandidateIdAndActiveJobKey(candidate.getId(), job.getId())
                .ifPresent(existing -> {
                    throw ApiException.conflict(
                            "You already have an open application for this role ("
                                    + existing.getApplicationCode() + ").");
                });

        if (request.resumeDocumentId() != null) {
            documents.findByIdAndDeletedAtIsNull(request.resumeDocumentId())
                    .filter(document -> document.getCandidateId().equals(candidate.getId()))
                    .orElseThrow(() -> ApiException.badRequest(
                            "That document does not belong to this candidate."));
        }
        if (request.sourceId() != null) {
            sources.findById(request.sourceId())
                    .orElseThrow(() -> ApiException.badRequest("That source does not exist."));
        }

        Instant now = Instant.now();

        JobApplication application = new JobApplication();
        application.setApplicationCode(codes.nextApplicationCode());
        application.setCandidateId(candidate.getId());
        application.setJobId(job.getId());
        application.setAppliedAt(now);
        application.setResumeDocumentId(request.resumeDocumentId());
        application.setCoverLetter(request.coverLetter());
        application.setSourceId(request.sourceId());
        application.setRecruiterId(job.getRecruiterId());
        application.setCurrentStage(ApplicationStage.APPLIED);
        application.setScreeningResult(ScreeningResult.NOT_SCREENED);
        application.setStageEnteredAt(now);
        applyStatus(application, ApplicationStatus.ACTIVE);
        setFollowUpDue(application);

        applications.save(application);

        histories.save(historyRow(application, null, ApplicationStage.APPLIED,
                null, ApplicationStatus.ACTIVE, "Application submitted", null, caller));

        candidateService.recordActivity(candidate.getId(), "Applied",
                "Applied for " + job.getTitle() + " (" + job.getRequirementCode() + ")",
                caller.userId());

        if (job.getRecruiterId() != null) {
            notifications.notify(job.getRecruiterId(), "application.received",
                    "New application: " + job.getTitle(),
                    candidate.getFullName() + " applied for " + job.getRequirementCode() + ".",
                    "/applications/" + application.getId());
        }

        notifications.notify(candidate.getUserId(), "application.submitted",
                "Application received",
                "We have your application for " + job.getTitle() + ".",
                "/my-applications");

        audit.record(caller, Constants.Audit.APPLICATION_CREATED, "application", application.getId(),
                Map.of("job", job.getRequirementCode(), "candidate", candidate.getCandidateCode()));

        return toResponse(application, caller);
    }

    /**
     * Whose application this is.
     *
     * A candidate may only ever apply as themselves, no matter what
     * {@code candidateId} the request carries. Staff may apply on
     * somebody's behalf, which is how a sourced candidate gets added.
     */
    private CandidateProfile resolveCandidate(String requestedId, AuthenticatedUser caller) {
        if (caller.hasPermission(Permissions.APPLICATION_READ_ANY)
                || caller.hasPermission(Permissions.APPLICATION_ASSIGN)) {
            if (requestedId != null) {
                return candidates.findById(requestedId)
                        .orElseThrow(() -> ApiException.notFound("Candidate", requestedId));
            }
        }

        CandidateProfile own = candidates.findByUserId(caller.userId())
                .orElseThrow(() -> ApiException.badRequest(
                        "This account does not have a candidate profile."));

        if (requestedId != null && !requestedId.equals(own.getId())) {
            audit.recordSecurityEvent(caller, Constants.Audit.UNAUTHORIZED_ACCESS,
                    "candidate", requestedId, Map.of("reason", "apply-as-another-candidate"));
            throw ApiException.forbidden("You may only apply on your own behalf.");
        }

        return own;
    }

    // -----------------------------------------------------------------
    //  Reading
    // -----------------------------------------------------------------

    @Transactional(readOnly = true)
    public PageResponse<ApplicationSummary> list(
            PaginationQuery query,
            String jobId,
            String candidateId,
            ApplicationStage stage,
            ApplicationStatus status,
            String recruiterId,
            Boolean overdueOnly,
            AuthenticatedUser caller) {

        Specification<JobApplication> spec =
                buildSpec(query, jobId, candidateId, stage, status, recruiterId, overdueOnly, caller);

        Page<JobApplication> page = applications.findAll(spec, query.pageable(SORTABLE, "appliedAt"));
        return PageResponse.from(page, application -> toSummary(application, caller));
    }

    private Specification<JobApplication> buildSpec(
            PaginationQuery query,
            String jobId,
            String candidateId,
            ApplicationStage stage,
            ApplicationStatus status,
            String recruiterId,
            Boolean overdueOnly,
            AuthenticatedUser caller) {

        return (root, criteria, builder) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (jobId != null && !jobId.isBlank()) {
                predicates.add(builder.equal(root.get("jobId"), jobId));
            }
            if (candidateId != null && !candidateId.isBlank()) {
                predicates.add(builder.equal(root.get("candidateId"), candidateId));
            }
            if (stage != null) {
                predicates.add(builder.equal(root.get("currentStage"), stage));
            }
            if (status != null) {
                predicates.add(builder.equal(root.get("status"), status));
            }
            if (recruiterId != null && !recruiterId.isBlank()) {
                predicates.add(builder.equal(root.get("recruiterId"), recruiterId));
            }
            if (Boolean.TRUE.equals(overdueOnly)) {
                predicates.add(builder.and(
                        builder.isNotNull(root.get("followUpDueAt")),
                        builder.lessThan(root.get("followUpDueAt"), Instant.now()),
                        builder.equal(root.get("status"), ApplicationStatus.ACTIVE)));
            }

            String term = query.searchTerm();
            if (term != null) {
                String like = "%" + term.toLowerCase() + "%";
                var candidateJoin = root.join("candidate", jakarta.persistence.criteria.JoinType.LEFT);
                predicates.add(builder.or(
                        builder.like(builder.lower(root.get("applicationCode")), like),
                        builder.like(builder.lower(candidateJoin.get("fullName")), like),
                        builder.like(builder.lower(candidateJoin.get("candidateCode")), like),
                        builder.like(builder.lower(candidateJoin.get("normalisedEmail")), like)));
            }

            applyVisibilityScope(predicates, root, builder, caller);

            return builder.and(predicates.toArray(new Predicate[0]));
        };
    }

    /**
     * Narrows a query to what the caller may see.
     *
     * Three tiers: everything, the applications they recruit for or
     * hire for, or only their own. A candidate falls into the last and
     * is matched on their profile id, so there is no way to widen it
     * by manipulating a parameter.
     */
    private void applyVisibilityScope(
            List<Predicate> predicates,
            jakarta.persistence.criteria.Root<JobApplication> root,
            jakarta.persistence.criteria.CriteriaBuilder builder,
            AuthenticatedUser caller) {

        if (caller.hasPermission(Permissions.APPLICATION_READ_ANY)) {
            return;
        }

        if (caller.hasPermission(Permissions.APPLICATION_READ_ASSIGNED)) {
            var jobJoin = root.join("job", jakarta.persistence.criteria.JoinType.LEFT);
            predicates.add(builder.or(
                    builder.equal(root.get("recruiterId"), caller.userId()),
                    builder.equal(jobJoin.get("recruiterId"), caller.userId()),
                    builder.equal(jobJoin.get("hiringManagerId"), caller.userId())));
            return;
        }

        String candidateId = candidates.findByUserId(caller.userId())
                .map(CandidateProfile::getId)
                // A non-existent id rather than no predicate: failing
                // open here would expose the whole pipeline.
                .orElse("-");
        predicates.add(builder.equal(root.get("candidateId"), candidateId));
    }

    @Transactional(readOnly = true)
    public ApplicationResponse get(String id, AuthenticatedUser caller) {
        return toResponse(requireVisible(id, caller), caller);
    }

    @Transactional(readOnly = true)
    public List<StatusHistoryResponse> history(String id, AuthenticatedUser caller) {
        requireVisible(id, caller);

        return histories.findByApplicationIdOrderByChangedAtAsc(id).stream()
                .map(entry -> new StatusHistoryResponse(
                        entry.getId(),
                        entry.getApplicationId(),
                        entry.getFromStage(),
                        entry.getToStage(),
                        entry.getFromStage() == null ? null : WorkflowRules.labelFor(entry.getFromStage()),
                        WorkflowRules.labelFor(entry.getToStage()),
                        entry.getFromStatus(),
                        entry.getToStatus(),
                        entry.getReason(),
                        entry.getDurationSeconds(),
                        PersonRef.withoutEmail(entry.getChangedBy()),
                        entry.getChangedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<NoteResponse> notes(String id, AuthenticatedUser caller) {
        requireVisible(id, caller);

        boolean staff = caller.hasAnyPermission(
                Permissions.APPLICATION_READ_ANY, Permissions.APPLICATION_READ_ASSIGNED);

        return notes.findByApplicationIdOrderByCreatedAtDesc(id).stream()
                // An internal note is written for the hiring team. The
                // candidate must not see it on their own application.
                .filter(note -> staff || !note.isInternal())
                .map(note -> new NoteResponse(
                        note.getId(),
                        note.getBody(),
                        note.isInternal(),
                        PersonRef.withoutEmail(note.getAuthor()),
                        note.getCreatedAt(),
                        note.getUpdatedAt()))
                .toList();
    }

    @Transactional
    public NoteResponse addNote(String id, NoteRequest request, AuthenticatedUser caller) {
        requireVisible(id, caller);

        ApplicationNote note = new ApplicationNote();
        note.setApplicationId(id);
        note.setAuthorId(caller.userId());
        note.setBody(request.body());
        note.setInternal(request.isInternal() == null || request.isInternal());
        notes.save(note);

        return new NoteResponse(
                note.getId(), note.getBody(), note.isInternal(),
                PersonRef.withoutEmail(users.findById(caller.userId()).orElse(null)),
                note.getCreatedAt(), note.getUpdatedAt());
    }

    // -----------------------------------------------------------------
    //  Transitions
    // -----------------------------------------------------------------

    @Transactional
    public ApplicationResponse transition(
            String id, TransitionRequest request, AuthenticatedUser caller) {

        JobApplication application = requireVisible(id, caller);
        applyTransition(application, request.toStage(), request.toStatus(), request.reason(),
                request.screeningResult(), request.screeningRemarks(), caller);

        return toResponse(application, caller);
    }

    /**
     * Moves one application, enforcing the stage rules.
     *
     * Shared by the single and bulk endpoints so that a bulk action can
     * never take a shortcut a single one would not allow.
     */
    private void applyTransition(
            JobApplication application,
            ApplicationStage toStage,
            ApplicationStatus requestedStatus,
            String reason,
            ScreeningResult screeningResult,
            String screeningRemarks,
            AuthenticatedUser caller) {

        ApplicationStage fromStage = application.getCurrentStage();
        ApplicationStatus fromStatus = application.getStatus();

        if (WorkflowRules.isTerminal(fromStatus)) {
            throw ApiException.unprocessable(
                    "This application is " + fromStatus.name().toLowerCase()
                            + " and can no longer be moved.");
        }

        if (!WorkflowRules.isValidStageTransition(fromStage, toStage)) {
            throw ApiException.unprocessable(
                    "An application cannot move from " + WorkflowRules.labelFor(fromStage)
                            + " to " + WorkflowRules.labelFor(toStage) + ".");
        }

        ApplicationStatus toStatus = requestedStatus == null ? fromStatus : requestedStatus;

        // Reaching HIRED is what fills a vacancy, so the status follows
        // the stage rather than being left to the caller.
        if (toStage == ApplicationStage.HIRED) {
            toStatus = ApplicationStatus.HIRED;
        }

        if (toStatus == ApplicationStatus.REJECTED && (reason == null || reason.isBlank())) {
            throw ApiException.badRequest("A rejection needs a reason.");
        }

        Instant now = Instant.now();
        int secondsInStage = (int) Math.min(
                Integer.MAX_VALUE,
                Duration.between(application.getStageEnteredAt(), now).getSeconds());

        application.setCurrentStage(toStage);
        application.setStageEnteredAt(now);
        applyStatus(application, toStatus);

        if (screeningResult != null) {
            application.setScreeningResult(screeningResult);
        }
        if (screeningRemarks != null) {
            application.setScreeningRemarks(screeningRemarks);
        }
        if (toStatus == ApplicationStatus.REJECTED) {
            application.setRejectionReason(reason);
        }

        setFollowUpDue(application);
        applications.save(application);

        histories.save(historyRow(application, fromStage, toStage, fromStatus, toStatus,
                reason, secondsInStage, caller));

        if (toStatus == ApplicationStatus.HIRED) {
            fillVacancy(application.getJobId());
        }

        notifyStageChange(application, toStage, toStatus);

        audit.record(caller, Constants.Audit.APPLICATION_STAGE_CHANGED,
                "application", application.getId(),
                Map.of("from", fromStage.name(), "to", toStage.name(), "status", toStatus.name()));
    }

    /**
     * The one place {@code status} and {@code activeJobKey} are set.
     *
     * Keeping them together is what guarantees the unique index stays
     * meaningful: a terminal application releases its key, and a live
     * one holds it.
     */
    private void applyStatus(JobApplication application, ApplicationStatus status) {
        application.setStatus(status);
        application.setActiveJobKey(
                WorkflowRules.isTerminal(status) ? null : application.getJobId());
    }

    /**
     * Records the hire against the requisition, and closes it once the
     * last vacancy is filled.
     */
    private void fillVacancy(String jobId) {
        jobs.findById(jobId).ifPresent(job -> {
            int filled = Math.min(job.getVacanciesFilled() + 1, job.getVacancies());
            job.setVacanciesFilled(filled);

            if (filled >= job.getVacancies() && job.getStatus() == JobStatus.PUBLISHED) {
                job.setStatus(JobStatus.CLOSED);
                job.setClosedAt(Instant.now());
                log.info("Requisition {} closed: all {} vacancies filled",
                        job.getRequirementCode(), job.getVacancies());
            }

            jobs.save(job);
        });
    }

    @Transactional
    public BulkTransitionResponse bulkTransition(
            BulkTransitionRequest request, AuthenticatedUser caller) {

        if (request.applicationIds().size() > 200) {
            throw ApiException.badRequest("Move at most 200 applications at a time.");
        }

        List<BulkResult> results = new ArrayList<>(request.applicationIds().size());
        int succeeded = 0;

        for (String id : request.applicationIds()) {
            try {
                JobApplication application = requireVisible(id, caller);
                applyTransition(application, request.toStage(), request.toStatus(),
                        request.reason(), null, null, caller);
                results.add(new BulkResult(id, true, "Moved to "
                        + WorkflowRules.labelFor(request.toStage()) + "."));
                succeeded++;

            } catch (ApiException ex) {
                // One application's rules should not abandon the rest:
                // the caller gets a per-row result instead.
                results.add(new BulkResult(id, false, ex.getMessage()));
            }
        }

        audit.record(caller, "APPLICATION_BULK_TRANSITION", "application", null,
                Map.of("requested", request.applicationIds().size(),
                        "succeeded", succeeded,
                        "toStage", request.toStage().name()));

        return new BulkTransitionResponse(
                succeeded, results.size() - succeeded, results);
    }

    @Transactional
    public ApplicationResponse withdraw(String id, String reason, AuthenticatedUser caller) {
        JobApplication application = requireVisible(id, caller);

        boolean ownApplication = candidates.findByUserId(caller.userId())
                .map(profile -> profile.getId().equals(application.getCandidateId()))
                .orElse(false);

        if (!ownApplication && !caller.hasPermission(Permissions.APPLICATION_TRANSITION)) {
            throw ApiException.forbidden("You may only withdraw your own application.");
        }

        if (WorkflowRules.isTerminal(application.getStatus())) {
            throw ApiException.unprocessable("This application is already closed.");
        }

        ApplicationStatus fromStatus = application.getStatus();
        application.setWithdrawReason(reason);
        applyStatus(application, ApplicationStatus.WITHDRAWN);
        application.setFollowUpDueAt(null);
        applications.save(application);

        histories.save(historyRow(application,
                application.getCurrentStage(), application.getCurrentStage(),
                fromStatus, ApplicationStatus.WITHDRAWN, reason, null, caller));

        if (application.getRecruiterId() != null) {
            notifications.notify(application.getRecruiterId(), "application.withdrawn",
                    "Application withdrawn",
                    application.getApplicationCode() + " was withdrawn.",
                    "/applications/" + application.getId());
        }

        audit.record(caller, Constants.Audit.APPLICATION_WITHDRAWN,
                "application", application.getId(), Map.of("reason", String.valueOf(reason)));

        return toResponse(application, caller);
    }

    @Transactional
    public ApplicationResponse assign(String id, String recruiterId, AuthenticatedUser caller) {
        JobApplication application = requireVisible(id, caller);

        users.findById(recruiterId)
                .orElseThrow(() -> ApiException.badRequest("That recruiter does not exist."));

        application.setRecruiterId(recruiterId);
        applications.save(application);

        notifications.notify(recruiterId, "application.assigned",
                "Application assigned to you",
                application.getApplicationCode() + " is now yours.",
                "/applications/" + application.getId());

        audit.record(caller, "APPLICATION_ASSIGNED", "application", application.getId(),
                Map.of("recruiterId", recruiterId));

        return toResponse(application, caller);
    }

    // -----------------------------------------------------------------
    //  Pipeline board
    // -----------------------------------------------------------------

    /**
     * The Kanban board for one requisition.
     *
     * Every stage gets a column even when empty, so the board does not
     * reflow as cards move and a recruiter always has somewhere to drop.
     */
    @Transactional(readOnly = true)
    public PipelineBoard pipeline(String jobId, AuthenticatedUser caller) {
        JobRequirement job = jobs.findById(jobId)
                .orElseThrow(() -> ApiException.notFound("Job requirement", jobId));

        List<JobApplication> live = applications.findByJobId(jobId).stream()
                .filter(application -> application.getStatus() == ApplicationStatus.ACTIVE
                        || application.getStatus() == ApplicationStatus.ON_HOLD)
                .toList();

        Map<ApplicationStage, List<PipelineCard>> byStage = new LinkedHashMap<>();
        for (ApplicationStage stage : WorkflowRules.STAGE_ORDER) {
            byStage.put(stage, new ArrayList<>());
        }

        for (JobApplication application : live) {
            byStage.get(application.getCurrentStage()).add(toCard(application));
        }

        List<PipelineColumn> columns = WorkflowRules.STAGE_ORDER.stream()
                .map(stage -> {
                    List<PipelineCard> cards = byStage.get(stage);
                    // Oldest first: the card that has waited longest is
                    // the one most likely to need attention.
                    cards.sort(Comparator.comparing(PipelineCard::stageEnteredAt));
                    return new PipelineColumn(
                            stage, WorkflowRules.labelFor(stage), cards.size(), cards);
                })
                .toList();

        return new PipelineBoard(
                new PipelineBoard.JobRef(
                        job.getId(), job.getTitle(), job.getRequirementCode(),
                        job.getVacancies(), job.getVacanciesFilled()),
                columns,
                live.size());
    }

    // -----------------------------------------------------------------
    //  Export
    // -----------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<Map<String, Object>> exportRows(
            PaginationQuery query,
            String jobId,
            String candidateId,
            ApplicationStage stage,
            ApplicationStatus status,
            String recruiterId,
            Boolean overdueOnly,
            AuthenticatedUser caller) {

        return applications
                .findAll(buildSpec(query, jobId, candidateId, stage, status,
                        recruiterId, overdueOnly, caller))
                .stream()
                .map(application -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("Application", application.getApplicationCode());
                    row.put("Candidate", application.getCandidate() == null
                            ? "" : application.getCandidate().getFullName());
                    row.put("Candidate Code", application.getCandidate() == null
                            ? "" : application.getCandidate().getCandidateCode());
                    row.put("Email", application.getCandidate() == null
                            ? "" : application.getCandidate().getNormalisedEmail());
                    row.put("Job", application.getJob() == null
                            ? "" : application.getJob().getTitle());
                    row.put("Job Code", application.getJob() == null
                            ? "" : application.getJob().getRequirementCode());
                    row.put("Stage", WorkflowRules.labelFor(application.getCurrentStage()));
                    row.put("Status", application.getStatus());
                    row.put("Screening", application.getScreeningResult());
                    row.put("Recruiter", application.getRecruiter() == null
                            ? "" : application.getRecruiter().fullName());
                    row.put("Source", application.getSource() == null
                            ? "" : application.getSource().getName());
                    row.put("Applied", application.getAppliedAt());
                    row.put("In Stage Since", application.getStageEnteredAt());
                    row.put("Follow-up Due", application.getFollowUpDueAt());
                    return row;
                })
                .toList();
    }

    // -----------------------------------------------------------------
    //  Helpers
    // -----------------------------------------------------------------

    public JobApplication requireVisible(String id, AuthenticatedUser caller) {
        JobApplication application = applications.findById(id)
                .orElseThrow(() -> ApiException.notFound("Application", id));

        if (caller.hasPermission(Permissions.APPLICATION_READ_ANY)) {
            return application;
        }

        if (caller.hasPermission(Permissions.APPLICATION_READ_ASSIGNED)) {
            JobRequirement job = application.getJob();
            boolean assigned = caller.userId().equals(application.getRecruiterId())
                    || (job != null && caller.userId().equals(job.getRecruiterId()))
                    || (job != null && caller.userId().equals(job.getHiringManagerId()));
            if (assigned) {
                return application;
            }
        }

        boolean own = candidates.findByUserId(caller.userId())
                .map(profile -> profile.getId().equals(application.getCandidateId()))
                .orElse(false);

        if (own) {
            return application;
        }

        audit.recordSecurityEvent(caller, Constants.Audit.UNAUTHORIZED_ACCESS,
                "application", id, Map.of("reason", "out-of-scope"));

        throw ApiException.notFound("Application", id);
    }

    /** Sets the follow-up date from the stage's SLA, or clears it when closed. */
    private void setFollowUpDue(JobApplication application) {
        if (WorkflowRules.isTerminal(application.getStatus())) {
            application.setFollowUpDueAt(null);
            return;
        }

        Integer days = WorkflowRules.STAGE_FOLLOWUP_DAYS.get(application.getCurrentStage());
        application.setFollowUpDueAt(
                days == null ? null : application.getStageEnteredAt().plus(Duration.ofDays(days)));
    }

    private ApplicationStatusHistory historyRow(
            JobApplication application,
            ApplicationStage fromStage,
            ApplicationStage toStage,
            ApplicationStatus fromStatus,
            ApplicationStatus toStatus,
            String reason,
            Integer durationSeconds,
            AuthenticatedUser caller) {

        ApplicationStatusHistory entry = new ApplicationStatusHistory();
        entry.setApplicationId(application.getId());
        entry.setFromStage(fromStage);
        entry.setToStage(toStage);
        entry.setFromStatus(fromStatus);
        entry.setToStatus(toStatus);
        entry.setChangedById(caller.userId());
        entry.setReason(reason);
        entry.setDurationSeconds(durationSeconds);
        return entry;
    }

    private void notifyStageChange(
            JobApplication application, ApplicationStage stage, ApplicationStatus status) {

        CandidateProfile candidate = application.getCandidate();
        if (candidate == null) {
            return;
        }

        // Candidates hear about outcomes and interviews, not about every
        // internal screening step — a flurry of updates is worse than
        // none, and some stages are not meaningful outside the team.
        boolean worthTelling = status == ApplicationStatus.REJECTED
                || status == ApplicationStatus.HIRED
                || stage == ApplicationStage.SHORTLISTED
                || stage == ApplicationStage.SELECTED
                || stage == ApplicationStage.OFFER_RELEASED;

        if (!worthTelling) {
            return;
        }

        String jobTitle = application.getJob() == null ? "your application"
                : application.getJob().getTitle();

        notifications.notify(candidate.getUserId(),
                status == ApplicationStatus.REJECTED
                        ? "application.rejected" : "application.progressed",
                status == ApplicationStatus.REJECTED
                        ? "Update on your application"
                        : "Good news about your application",
                status == ApplicationStatus.REJECTED
                        ? "We will not be taking your application for " + jobTitle + " further."
                        : "Your application for " + jobTitle + " has moved to "
                                + WorkflowRules.labelFor(stage) + ".",
                "/my-applications");
    }

    // -----------------------------------------------------------------
    //  Projection
    // -----------------------------------------------------------------

    private boolean isOverdue(JobApplication application) {
        return application.getStatus() == ApplicationStatus.ACTIVE
                && application.getFollowUpDueAt() != null
                && application.getFollowUpDueAt().isBefore(Instant.now());
    }

    private NextInterviewRef nextInterview(String applicationId) {
        return interviews.findByApplicationIdOrderByRoundAsc(applicationId).stream()
                .filter(interview -> interview.getStatus() == InterviewStatus.SCHEDULED
                        || interview.getStatus() == InterviewStatus.RESCHEDULED)
                .filter(interview -> interview.getScheduledStart().isAfter(Instant.now()))
                .min(Comparator.comparing(Interview::getScheduledStart))
                .map(interview -> new NextInterviewRef(
                        interview.getId(), interview.getScheduledStart(), interview.getRoundName()))
                .orElse(null);
    }

    private CandidateRef candidateRef(CandidateProfile candidate) {
        return candidate == null ? null : new CandidateRef(
                candidate.getId(),
                candidate.getCandidateCode(),
                candidate.getFullName(),
                candidate.getNormalisedEmail(),
                candidate.getTotalExperience(),
                candidate.getCurrentDesignation(),
                candidate.getCurrentCompany());
    }

    public ApplicationSummary toSummary(JobApplication application, AuthenticatedUser caller) {
        return new ApplicationSummary(
                application.getId(),
                application.getApplicationCode(),
                application.getCandidateId(),
                application.getJobId(),
                application.getCurrentStage(),
                WorkflowRules.labelFor(application.getCurrentStage()),
                application.getStatus(),
                application.getScreeningResult(),
                application.getAppliedAt(),
                application.getStageEnteredAt(),
                application.getFollowUpDueAt(),
                application.getLastUpdatedAt(),
                isOverdue(application),
                candidateRef(application.getCandidate()),
                application.getJob() == null ? null : jobSummary(application.getJob()),
                PersonRef.withoutEmail(application.getRecruiter()),
                SourceRef.of(application.getSource()),
                nextInterview(application.getId()));
    }

    public ApplicationResponse toResponse(JobApplication application, AuthenticatedUser caller) {
        DocumentResponse resume = application.getResumeDocument() == null ? null
                : new DocumentResponse(
                        application.getResumeDocument().getId(),
                        application.getResumeDocument().getCandidateId(),
                        application.getResumeDocument().getDocumentType(),
                        application.getResumeDocument().getOriginalName(),
                        application.getResumeDocument().getMimeType(),
                        application.getResumeDocument().getSizeBytes(),
                        application.getResumeDocument().getVersion(),
                        application.getResumeDocument().isCurrent(),
                        application.getResumeDocument().getUploadedAt(),
                        "/api/documents/" + application.getResumeDocument().getId() + "/download");

        // Precomputed so the board can grey out invalid drop targets
        // rather than letting a drag fail on the server.
        List<ApplicationStage> allowed = WorkflowRules.isTerminal(application.getStatus())
                ? List.of()
                : WorkflowRules.STAGE_ORDER.stream()
                        .filter(stage -> WorkflowRules.isValidStageTransition(
                                application.getCurrentStage(), stage))
                        .toList();

        return new ApplicationResponse(
                application.getId(),
                application.getApplicationCode(),
                application.getCandidateId(),
                application.getJobId(),
                application.getCurrentStage(),
                WorkflowRules.labelFor(application.getCurrentStage()),
                application.getStatus(),
                application.getScreeningResult(),
                application.getScreeningRemarks(),
                application.getRejectionReason(),
                application.getWithdrawReason(),
                application.getCoverLetter(),
                application.getAppliedAt(),
                application.getStageEnteredAt(),
                application.getFollowUpDueAt(),
                application.getLastUpdatedAt(),
                isOverdue(application),
                candidateRef(application.getCandidate()),
                application.getJob() == null ? null : jobSummary(application.getJob()),
                PersonRef.withoutEmail(application.getRecruiter()),
                SourceRef.of(application.getSource()),
                resume,
                nextInterview(application.getId()),
                allowed);
    }

    private PipelineCard toCard(JobApplication application) {
        CandidateProfile candidate = application.getCandidate();

        List<String> skills = candidate == null ? List.of()
                : candidateSkills.findByCandidateId(candidate.getId()).stream()
                        .filter(row -> row.getSkill() != null)
                        .map(row -> row.getSkill().getName())
                        // A card has room for a handful; the profile has
                        // the rest.
                        .limit(6)
                        .toList();

        List<TagResponse> tags = candidate == null ? List.of()
                : tagLinks.findByCandidateId(candidate.getId()).stream()
                        .filter(link -> link.getTag() != null)
                        .map(link -> new TagResponse(
                                link.getTag().getId(),
                                link.getTag().getName(),
                                link.getTag().getColour()))
                        .toList();

        return new PipelineCard(
                application.getId(),
                application.getApplicationCode(),
                application.getCandidateId(),
                candidate == null ? null : candidate.getCandidateCode(),
                candidate == null ? "Unknown" : candidate.getFullName(),
                candidate == null ? null : candidate.getTotalExperience(),
                skills,
                tags,
                application.getAppliedAt(),
                PersonRef.withoutEmail(application.getRecruiter()),
                application.getStatus(),
                nextInterview(application.getId()),
                application.getStageEnteredAt(),
                application.getFollowUpDueAt(),
                isOverdue(application));
    }

    /** A minimal job summary, without the extra count queries. */
    private com.businessgateways.hrats.dto.JobDtos.JobSummary jobSummary(JobRequirement job) {
        return new com.businessgateways.hrats.dto.JobDtos.JobSummary(
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
                com.businessgateways.hrats.dto.CommonDtos.DepartmentRef.of(job.getDepartment()),
                PersonRef.withoutEmail(job.getRecruiter()),
                null,
                job.getPublishedAt(),
                job.getApplicationDeadline(),
                job.getCreatedAt());
    }
}
