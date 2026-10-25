package com.businessgateways.hrats.service;

import com.businessgateways.hrats.common.ApiException;
import com.businessgateways.hrats.common.Constants;
import com.businessgateways.hrats.common.dto.PageResponse;
import com.businessgateways.hrats.common.dto.PaginationQuery;
import com.businessgateways.hrats.domain.entity.Interview;
import com.businessgateways.hrats.domain.entity.InterviewFeedback;
import com.businessgateways.hrats.domain.entity.InterviewPanelMember;
import com.businessgateways.hrats.domain.entity.JobApplication;
import com.businessgateways.hrats.domain.entity.User;
import com.businessgateways.hrats.domain.enums.Enums.InterviewStatus;
import com.businessgateways.hrats.domain.enums.Enums.InterviewType;
import com.businessgateways.hrats.dto.CommonDtos.PersonRef;
import com.businessgateways.hrats.dto.InterviewDtos.ApplicationRef;
import com.businessgateways.hrats.dto.InterviewDtos.CalendarEntry;
import com.businessgateways.hrats.dto.InterviewDtos.CandidateRef;
import com.businessgateways.hrats.dto.InterviewDtos.ConflictResponse;
import com.businessgateways.hrats.dto.InterviewDtos.FeedbackRequest;
import com.businessgateways.hrats.dto.InterviewDtos.FeedbackResponse;
import com.businessgateways.hrats.dto.InterviewDtos.InterviewResponse;
import com.businessgateways.hrats.dto.InterviewDtos.JobRef;
import com.businessgateways.hrats.dto.InterviewDtos.PanelMemberResponse;
import com.businessgateways.hrats.dto.InterviewDtos.PendingFeedbackResponse;
import com.businessgateways.hrats.dto.InterviewDtos.RescheduleRequest;
import com.businessgateways.hrats.dto.InterviewDtos.ScheduleInterviewRequest;
import com.businessgateways.hrats.repository.InterviewFeedbackRepository;
import com.businessgateways.hrats.repository.InterviewPanelMemberRepository;
import com.businessgateways.hrats.repository.InterviewRepository;
import com.businessgateways.hrats.repository.JobApplicationRepository;
import com.businessgateways.hrats.repository.UserRepository;
import com.businessgateways.hrats.security.AuthenticatedUser;
import com.businessgateways.hrats.security.Permissions;
import jakarta.persistence.criteria.Predicate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Interview scheduling, panels and structured feedback.
 *
 * Two behaviours are worth calling out. Double-booking is detected
 * rather than forbidden: a genuine clash is usually a scheduling
 * mistake, but sometimes a panellist really is moving between two
 * rooms, so the conflict is reported and the recruiter decides.
 * Feedback is per-interviewer and editable, because a panellist who
 * mistypes a score should not have to ask an administrator to fix it.
 */
@Service
public class InterviewService {

    private static final Logger log = LoggerFactory.getLogger(InterviewService.class);

    private static final List<String> SORTABLE = List.of(
            "scheduledStart", "createdAt", "round", "status", "interviewCode");

    private static final Duration MAX_DURATION = Duration.ofHours(8);

    private final InterviewRepository interviews;
    private final InterviewPanelMemberRepository panels;
    private final InterviewFeedbackRepository feedback;
    private final JobApplicationRepository applications;
    private final UserRepository users;
    private final CodeGenerator codes;
    private final AuditService audit;
    private final NotificationService notifications;

    public InterviewService(
            InterviewRepository interviews,
            InterviewPanelMemberRepository panels,
            InterviewFeedbackRepository feedback,
            JobApplicationRepository applications,
            UserRepository users,
            CodeGenerator codes,
            AuditService audit,
            NotificationService notifications) {
        this.interviews = interviews;
        this.panels = panels;
        this.feedback = feedback;
        this.applications = applications;
        this.users = users;
        this.codes = codes;
        this.audit = audit;
        this.notifications = notifications;
    }

    // -----------------------------------------------------------------
    //  Scheduling
    // -----------------------------------------------------------------

    @Transactional
    public InterviewResponse schedule(ScheduleInterviewRequest request, AuthenticatedUser caller) {
        JobApplication application = applications.findById(request.applicationId())
                .orElseThrow(() -> ApiException.notFound("Application", request.applicationId()));

        validateWindow(request.scheduledStart(), request.scheduledEnd());

        List<User> panellists = resolvePanel(request.interviewerIds());

        List<ConflictResponse> conflicts = findConflicts(
                panellists, request.scheduledStart(), request.scheduledEnd(), "-");

        if (!conflicts.isEmpty() && !Boolean.TRUE.equals(request.ignoreConflicts())) {
            throw ApiException.conflict(
                    describeConflicts(conflicts)
                            + " Send ignoreConflicts=true to schedule anyway.");
        }

        Interview interview = new Interview();
        interview.setInterviewCode(codes.nextInterviewCode());
        interview.setApplicationId(application.getId());
        interview.setCandidateId(application.getCandidateId());
        interview.setJobId(application.getJobId());
        interview.setRound(request.round());
        interview.setRoundName(request.roundName().trim());
        interview.setInterviewType(request.interviewType());
        interview.setScheduledStart(request.scheduledStart());
        interview.setScheduledEnd(request.scheduledEnd());
        interview.setTimeZone(request.timeZone() == null ? "UTC" : request.timeZone());
        interview.setMeetingLink(request.meetingLink());
        interview.setVenue(request.venue());
        interview.setInstructions(request.instructions());
        interview.setStatus(InterviewStatus.SCHEDULED);
        interview.setOrganiserId(caller.userId());

        interviews.save(interview);
        savePanel(interview, panellists, request.leadInterviewerId());

        notifyScheduled(interview, application, panellists);

        audit.record(caller, Constants.Audit.INTERVIEW_SCHEDULED, "interview", interview.getId(),
                Map.of("application", application.getApplicationCode(),
                        "round", request.round(),
                        "conflictsOverridden", !conflicts.isEmpty()));

        return toResponse(interview, conflicts);
    }

    @Transactional
    public InterviewResponse reschedule(
            String id, RescheduleRequest request, AuthenticatedUser caller) {

        Interview interview = require(id);
        assertReschedulable(interview);
        validateWindow(request.scheduledStart(), request.scheduledEnd());

        List<User> panellists = panels.findByInterviewId(id).stream()
                .map(InterviewPanelMember::getInterviewer)
                .filter(java.util.Objects::nonNull)
                .toList();

        List<ConflictResponse> conflicts = findConflicts(
                panellists, request.scheduledStart(), request.scheduledEnd(), id);

        if (!conflicts.isEmpty() && !Boolean.TRUE.equals(request.ignoreConflicts())) {
            throw ApiException.conflict(
                    describeConflicts(conflicts) + " Send ignoreConflicts=true to reschedule anyway.");
        }

        Instant previousStart = interview.getScheduledStart();

        interview.setScheduledStart(request.scheduledStart());
        interview.setScheduledEnd(request.scheduledEnd());
        interview.setStatus(InterviewStatus.RESCHEDULED);
        interviews.save(interview);

        // Acceptances were for the old time, so they are reset.
        panels.findByInterviewId(id).forEach(member -> {
            member.setAccepted(null);
            member.setRespondedAt(null);
            panels.save(member);
        });

        notifyRescheduled(interview, panellists, previousStart, request.reason());

        audit.record(caller, "INTERVIEW_RESCHEDULED", "interview", id,
                Map.of("from", String.valueOf(previousStart),
                        "to", String.valueOf(request.scheduledStart()),
                        "reason", String.valueOf(request.reason())));

        return toResponse(interview, conflicts);
    }

    @Transactional
    public InterviewResponse cancel(String id, String reason, AuthenticatedUser caller) {
        Interview interview = require(id);
        assertReschedulable(interview);

        interview.setStatus(InterviewStatus.CANCELLED);
        interview.setCancelReason(reason);
        interviews.save(interview);

        panels.findByInterviewId(id).forEach(member ->
                notifications.notify(member.getInterviewerId(), "interview.cancelled",
                        "Interview cancelled",
                        interview.getRoundName() + " on "
                                + interview.getScheduledStart() + " is cancelled.",
                        "/interviews/" + id));

        applications.findById(interview.getApplicationId()).ifPresent(application -> {
            if (application.getCandidate() != null) {
                notifications.notify(application.getCandidate().getUserId(), "interview.cancelled",
                        "Your interview is cancelled",
                        "We will be in touch to rearrange.", "/my-applications");
            }
        });

        audit.record(caller, Constants.Audit.INTERVIEW_CANCELLED, "interview", id,
                Map.of("reason", String.valueOf(reason)));

        return toResponse(interview, List.of());
    }

    @Transactional
    public InterviewResponse complete(String id, AuthenticatedUser caller) {
        Interview interview = require(id);

        if (interview.getStatus() == InterviewStatus.CANCELLED) {
            throw ApiException.unprocessable("A cancelled interview cannot be completed.");
        }

        interview.setStatus(InterviewStatus.COMPLETED);
        interviews.save(interview);

        // Nudge the panellists who have not written up yet.
        List<String> submitted = feedback.findByInterviewId(id).stream()
                .map(InterviewFeedback::getInterviewerId)
                .toList();

        panels.findByInterviewId(id).stream()
                .filter(member -> !submitted.contains(member.getInterviewerId()))
                .forEach(member -> notifications.notify(
                        member.getInterviewerId(), "interview.feedback_due",
                        "Feedback needed: " + interview.getRoundName(),
                        "Please write up your scorecard while it is fresh.",
                        "/interviews/" + id));

        audit.record(caller, "INTERVIEW_COMPLETED", "interview", id, null);

        return toResponse(interview, List.of());
    }

    // -----------------------------------------------------------------
    //  Feedback
    // -----------------------------------------------------------------

    /**
     * Records one panellist's scorecard.
     *
     * Only somebody who was on the panel may submit, and re-submitting
     * updates their own row rather than creating a second one.
     */
    @Transactional
    public FeedbackResponse submitFeedback(
            String interviewId, FeedbackRequest request, AuthenticatedUser caller) {

        Interview interview = require(interviewId);

        if (!panels.existsByInterviewIdAndInterviewerId(interviewId, caller.userId())) {
            audit.recordSecurityEvent(caller, Constants.Audit.UNAUTHORIZED_ACCESS,
                    "interview", interviewId, Map.of("reason", "not-on-panel"));
            throw ApiException.forbidden("You were not on the panel for this interview.");
        }

        if (interview.getStatus() == InterviewStatus.CANCELLED) {
            throw ApiException.unprocessable("That interview was cancelled.");
        }

        InterviewFeedback entry = feedback
                .findByInterviewIdAndInterviewerId(interviewId, caller.userId())
                .orElseGet(() -> {
                    InterviewFeedback fresh = new InterviewFeedback();
                    fresh.setInterviewId(interviewId);
                    fresh.setInterviewerId(caller.userId());
                    return fresh;
                });

        entry.setTechnicalSkills(request.technicalSkills());
        entry.setCommunication(request.communication());
        entry.setProblemSolving(request.problemSolving());
        entry.setRelevantExperience(request.relevantExperience());
        entry.setRoleSuitability(request.roleSuitability());
        entry.setTeamCollaboration(request.teamCollaboration());
        entry.setOverallRating(request.overallRating());
        entry.setStrengths(request.strengths());
        entry.setAreasForImprovement(request.areasForImprovement());
        entry.setComments(request.comments());
        entry.setRecommendation(request.recommendation());

        feedback.save(entry);

        // Once every panellist has written up, the round is done.
        long panelSize = panels.findByInterviewId(interviewId).size();
        long submitted = feedback.findByInterviewId(interviewId).size();

        if (submitted >= panelSize && interview.getStatus() != InterviewStatus.COMPLETED) {
            interview.setStatus(InterviewStatus.COMPLETED);
            interviews.save(interview);

            notifications.notify(interview.getOrganiserId(), "interview.feedback_complete",
                    "All feedback is in: " + interview.getRoundName(),
                    "Every panellist has submitted their scorecard.",
                    "/interviews/" + interviewId);
        }

        audit.record(caller, Constants.Audit.FEEDBACK_SUBMITTED, "interview", interviewId,
                Map.of("recommendation", request.recommendation().name(),
                        "overallRating", request.overallRating()));

        return toFeedbackResponse(entry);
    }

    /**
     * The panel's scorecards.
     *
     * A panellist who has not written up yet sees only their own, so
     * that another interviewer's verdict cannot anchor theirs.
     */
    @Transactional(readOnly = true)
    public List<FeedbackResponse> feedbackFor(String interviewId, AuthenticatedUser caller) {
        require(interviewId);

        List<InterviewFeedback> all = feedback.findByInterviewId(interviewId);

        boolean canSeeAll = caller.hasPermission(Permissions.FEEDBACK_READ_ANY);
        boolean hasSubmitted = all.stream()
                .anyMatch(entry -> entry.getInterviewerId().equals(caller.userId()));

        if (!canSeeAll && !hasSubmitted) {
            return all.stream()
                    .filter(entry -> entry.getInterviewerId().equals(caller.userId()))
                    .map(this::toFeedbackResponse)
                    .toList();
        }

        return all.stream().map(this::toFeedbackResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<PendingFeedbackResponse> myPendingFeedback(AuthenticatedUser caller) {
        // Every round this person sat on, from the beginning of time —
        // the finder is named for its usual forward-looking use, but an
        // epoch cutoff makes it return their whole history.
        return interviews.findUpcomingForInterviewer(caller.userId(), Instant.EPOCH).stream()
                // Only rounds that have actually happened need a write-up.
                .filter(interview -> interview.getScheduledEnd().isBefore(Instant.now()))
                .filter(interview -> interview.getStatus() != InterviewStatus.CANCELLED)
                .filter(interview -> feedback
                        .findByInterviewIdAndInterviewerId(interview.getId(), caller.userId())
                        .isEmpty())
                .map(interview -> new PendingFeedbackResponse(
                        interview.getId(),
                        interview.getInterviewCode(),
                        interview.getRoundName(),
                        interview.getScheduledStart(),
                        interview.getCandidate() == null ? null : interview.getCandidate().getFullName(),
                        interview.getJob() == null ? null : interview.getJob().getTitle(),
                        ChronoUnit.DAYS.between(interview.getScheduledEnd(), Instant.now())))
                .toList();
    }

    // -----------------------------------------------------------------
    //  Reading
    // -----------------------------------------------------------------

    @Transactional(readOnly = true)
    public PageResponse<InterviewResponse> list(
            PaginationQuery query,
            String applicationId,
            String candidateId,
            String jobId,
            InterviewStatus status,
            InterviewType interviewType,
            AuthenticatedUser caller) {

        var spec = buildSpec(query, applicationId, candidateId, jobId, status, interviewType, caller);
        var page = interviews.findAll(spec, query.pageable(SORTABLE, "scheduledStart"));

        return PageResponse.from(page, interview -> toResponse(interview, List.of()));
    }

    private Specification<Interview> buildSpec(
            PaginationQuery query,
            String applicationId,
            String candidateId,
            String jobId,
            InterviewStatus status,
            InterviewType interviewType,
            AuthenticatedUser caller) {

        return (root, criteria, builder) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (applicationId != null && !applicationId.isBlank()) {
                predicates.add(builder.equal(root.get("applicationId"), applicationId));
            }
            if (candidateId != null && !candidateId.isBlank()) {
                predicates.add(builder.equal(root.get("candidateId"), candidateId));
            }
            if (jobId != null && !jobId.isBlank()) {
                predicates.add(builder.equal(root.get("jobId"), jobId));
            }
            if (status != null) {
                predicates.add(builder.equal(root.get("status"), status));
            }
            if (interviewType != null) {
                predicates.add(builder.equal(root.get("interviewType"), interviewType));
            }

            String term = query.searchTerm();
            if (term != null) {
                String like = "%" + term.toLowerCase() + "%";
                predicates.add(builder.or(
                        builder.like(builder.lower(root.get("interviewCode")), like),
                        builder.like(builder.lower(root.get("roundName")), like)));
            }

            if (!caller.hasPermission(Permissions.INTERVIEW_READ_ANY)) {
                // An interviewer sees the rounds they sit on; a
                // candidate sees their own. Both are expressed as a
                // subquery so neither can widen the result.
                var panelQuery = criteria.subquery(String.class);
                var panelRoot = panelQuery.from(InterviewPanelMember.class);
                panelQuery.select(panelRoot.get("interviewId"))
                        .where(builder.equal(panelRoot.get("interviewerId"), caller.userId()));

                Predicate onPanel = root.get("id").in(panelQuery);
                Predicate organiser = builder.equal(root.get("organiserId"), caller.userId());

                if (caller.hasPermission(Permissions.INTERVIEW_READ_OWN)) {
                    var candidateJoin = root.join("candidate",
                            jakarta.persistence.criteria.JoinType.LEFT);
                    predicates.add(builder.or(onPanel, organiser,
                            builder.equal(candidateJoin.get("userId"), caller.userId())));
                } else {
                    predicates.add(builder.or(onPanel, organiser));
                }
            }

            return builder.and(predicates.toArray(new Predicate[0]));
        };
    }

    @Transactional(readOnly = true)
    public InterviewResponse get(String id, AuthenticatedUser caller) {
        Interview interview = require(id);
        assertCanView(interview, caller);
        return toResponse(interview, List.of());
    }

    @Transactional(readOnly = true)
    public List<CalendarEntry> calendar(
            Instant from, Instant to, String interviewerId, AuthenticatedUser caller) {

        if (from == null) {
            from = Instant.now().minus(Duration.ofDays(7));
        }
        if (to == null) {
            to = Instant.now().plus(Duration.ofDays(30));
        }
        if (to.isBefore(from)) {
            throw ApiException.badRequest("The end of the range is before its start.");
        }
        if (Duration.between(from, to).toDays() > 180) {
            throw ApiException.badRequest("Ask for at most six months at a time.");
        }

        String scopeTo = interviewerId != null ? interviewerId
                : (caller.hasPermission(Permissions.INTERVIEW_READ_ANY) ? null : caller.userId());

        List<Interview> found = new ArrayList<>();
        for (InterviewStatus status : List.of(InterviewStatus.SCHEDULED,
                InterviewStatus.RESCHEDULED, InterviewStatus.COMPLETED)) {
            found.addAll(interviews.findByStatusAndScheduledStartBetween(status, from, to));
        }

        return found.stream()
                .filter(interview -> scopeTo == null
                        || panels.existsByInterviewIdAndInterviewerId(interview.getId(), scopeTo)
                        || scopeTo.equals(interview.getOrganiserId()))
                .sorted(java.util.Comparator.comparing(Interview::getScheduledStart))
                .map(interview -> new CalendarEntry(
                        interview.getId(),
                        interview.getInterviewCode(),
                        interview.getRoundName() + " — "
                                + (interview.getCandidate() == null
                                        ? "Candidate" : interview.getCandidate().getFullName()),
                        interview.getScheduledStart(),
                        interview.getScheduledEnd(),
                        interview.getStatus(),
                        interview.getInterviewType(),
                        interview.getCandidate() == null ? null : interview.getCandidate().getFullName(),
                        interview.getJob() == null ? null : interview.getJob().getTitle(),
                        panels.findByInterviewId(interview.getId()).stream()
                                .filter(member -> member.getInterviewer() != null)
                                .map(member -> member.getInterviewer().fullName())
                                .toList()))
                .toList();
    }

    // -----------------------------------------------------------------
    //  Helpers
    // -----------------------------------------------------------------

    private Interview require(String id) {
        return interviews.findById(id).orElseThrow(() -> ApiException.notFound("Interview", id));
    }

    private void assertCanView(Interview interview, AuthenticatedUser caller) {
        if (caller.hasPermission(Permissions.INTERVIEW_READ_ANY)
                || caller.userId().equals(interview.getOrganiserId())
                || panels.existsByInterviewIdAndInterviewerId(interview.getId(), caller.userId())) {
            return;
        }

        boolean ownInterview = interview.getCandidate() != null
                && caller.userId().equals(interview.getCandidate().getUserId());

        if (!ownInterview) {
            throw ApiException.notFound("Interview", interview.getId());
        }
    }

    private void assertReschedulable(Interview interview) {
        if (interview.getStatus() == InterviewStatus.CANCELLED) {
            throw ApiException.unprocessable("That interview is already cancelled.");
        }
        if (interview.getStatus() == InterviewStatus.COMPLETED) {
            throw ApiException.unprocessable("That interview is already complete.");
        }
    }

    private void validateWindow(Instant start, Instant end) {
        if (!end.isAfter(start)) {
            throw ApiException.badRequest("The interview must end after it starts.");
        }
        if (Duration.between(start, end).compareTo(MAX_DURATION) > 0) {
            throw ApiException.badRequest("An interview cannot run longer than eight hours.");
        }
        // A little slack rather than "not in the past", so that
        // recording something that has just happened still works.
        if (start.isBefore(Instant.now().minus(Duration.ofDays(1)))) {
            throw ApiException.badRequest("That start time is in the past.");
        }
    }

    private List<User> resolvePanel(List<String> interviewerIds) {
        List<User> panellists = interviewerIds.stream().distinct()
                .map(id -> users.findById(id)
                        .orElseThrow(() -> ApiException.badRequest(
                                "Interviewer \"" + id + "\" does not exist.")))
                .toList();

        if (panellists.isEmpty()) {
            throw ApiException.badRequest("An interview needs at least one interviewer.");
        }
        if (panellists.size() > 10) {
            throw ApiException.badRequest("A panel of more than ten is not supported.");
        }

        return panellists;
    }

    private void savePanel(Interview interview, List<User> panellists, String leadId) {
        panels.deleteByInterviewId(interview.getId());

        for (User panellist : panellists) {
            InterviewPanelMember member = new InterviewPanelMember();
            member.setInterviewId(interview.getId());
            member.setInterviewerId(panellist.getId());
            member.setLead(panellist.getId().equals(leadId));
            panels.save(member);
        }
    }

    private List<ConflictResponse> findConflicts(
            List<User> panellists, Instant start, Instant end, String excludeInterviewId) {

        List<ConflictResponse> conflicts = new ArrayList<>();
        List<InterviewStatus> live = List.of(InterviewStatus.SCHEDULED, InterviewStatus.RESCHEDULED);

        for (User panellist : panellists) {
            long count = interviews.countConflicts(
                    panellist.getId(), live, start, end, excludeInterviewId);

            if (count > 0) {
                interviews.findUpcomingForInterviewer(panellist.getId(), start.minus(MAX_DURATION))
                        .stream()
                        .filter(other -> !other.getId().equals(excludeInterviewId))
                        .filter(other -> live.contains(other.getStatus()))
                        .filter(other -> other.getScheduledStart().isBefore(end)
                                && other.getScheduledEnd().isAfter(start))
                        .findFirst()
                        .ifPresent(other -> conflicts.add(new ConflictResponse(
                                panellist.getId(),
                                panellist.fullName(),
                                other.getInterviewCode(),
                                other.getScheduledStart(),
                                other.getScheduledEnd())));
            }
        }

        return conflicts;
    }

    private String describeConflicts(List<ConflictResponse> conflicts) {
        String names = conflicts.stream()
                .map(ConflictResponse::interviewerName)
                .distinct()
                .reduce((a, b) -> a + ", " + b)
                .orElse("A panellist");

        return names + (conflicts.size() == 1 ? " is" : " are")
                + " already booked during that window.";
    }

    private void notifyScheduled(
            Interview interview, JobApplication application, List<User> panellists) {

        String jobTitle = application.getJob() == null
                ? "the role" : application.getJob().getTitle();
        String candidateName = application.getCandidate() == null
                ? "the candidate" : application.getCandidate().getFullName();

        for (User panellist : panellists) {
            notifications.notify(panellist.getId(), "interview.panel_invited",
                    "You are on a panel: " + interview.getRoundName(),
                    candidateName + " for " + jobTitle + ", "
                            + interview.getScheduledStart() + ".",
                    "/interviews/" + interview.getId());
        }

        if (application.getCandidate() != null) {
            notifications.notify(application.getCandidate().getUserId(), "interview.scheduled",
                    "Your interview is scheduled",
                    interview.getRoundName() + " for " + jobTitle + " on "
                            + interview.getScheduledStart() + ".",
                    "/my-applications");
        }
    }

    private void notifyRescheduled(
            Interview interview, List<User> panellists, Instant previousStart, String reason) {

        for (User panellist : panellists) {
            notifications.notify(panellist.getId(), "interview.rescheduled",
                    "Interview moved: " + interview.getRoundName(),
                    "Moved from " + previousStart + " to " + interview.getScheduledStart()
                            + (reason == null ? "." : ". " + reason),
                    "/interviews/" + interview.getId());
        }

        if (interview.getCandidate() != null) {
            notifications.notify(interview.getCandidate().getUserId(), "interview.rescheduled",
                    "Your interview has moved",
                    "It is now on " + interview.getScheduledStart() + ".",
                    "/my-applications");
        }
    }

    // -----------------------------------------------------------------
    //  Projection
    // -----------------------------------------------------------------

    public InterviewResponse toResponse(Interview interview, List<ConflictResponse> conflicts) {
        List<String> submitted = feedback.findByInterviewId(interview.getId()).stream()
                .map(InterviewFeedback::getInterviewerId)
                .toList();

        List<PanelMemberResponse> panel = panels.findByInterviewId(interview.getId()).stream()
                .map(member -> new PanelMemberResponse(
                        member.getInterviewerId(),
                        member.isLead(),
                        Boolean.TRUE.equals(member.getAccepted()),
                        member.getRespondedAt(),
                        PersonRef.of(member.getInterviewer()),
                        submitted.contains(member.getInterviewerId())))
                .toList();

        return new InterviewResponse(
                interview.getId(),
                interview.getInterviewCode(),
                interview.getApplicationId(),
                interview.getCandidateId(),
                interview.getJobId(),
                interview.getRound(),
                interview.getRoundName(),
                interview.getInterviewType(),
                interview.getScheduledStart(),
                interview.getScheduledEnd(),
                interview.getTimeZone(),
                interview.getMeetingLink(),
                interview.getVenue(),
                interview.getInstructions(),
                interview.getStatus(),
                interview.getCancelReason(),
                interview.getCandidate() == null ? null : new CandidateRef(
                        interview.getCandidate().getId(),
                        interview.getCandidate().getCandidateCode(),
                        interview.getCandidate().getFullName()),
                interview.getJob() == null ? null : new JobRef(
                        interview.getJob().getId(),
                        interview.getJob().getTitle(),
                        interview.getJob().getRequirementCode()),
                interview.getApplication() == null ? null : new ApplicationRef(
                        interview.getApplication().getId(),
                        interview.getApplication().getApplicationCode(),
                        interview.getApplication().getCurrentStage()),
                PersonRef.withoutEmail(interview.getOrganiser()),
                panel,
                new InterviewResponse.Counts(submitted.size()),
                conflicts,
                interview.getCreatedAt());
    }

    private FeedbackResponse toFeedbackResponse(InterviewFeedback entry) {
        return new FeedbackResponse(
                entry.getId(),
                entry.getInterviewId(),
                entry.getTechnicalSkills(),
                entry.getCommunication(),
                entry.getProblemSolving(),
                entry.getRelevantExperience(),
                entry.getRoleSuitability(),
                entry.getTeamCollaboration(),
                entry.getOverallRating(),
                entry.getStrengths(),
                entry.getAreasForImprovement(),
                entry.getComments(),
                entry.getRecommendation(),
                PersonRef.withoutEmail(entry.getInterviewer()),
                entry.getSubmittedAt(),
                entry.getUpdatedAt());
    }
}
