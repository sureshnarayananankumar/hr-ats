package com.businessgateways.hrats.dto;

import com.businessgateways.hrats.domain.enums.Enums.ApplicationStage;
import com.businessgateways.hrats.domain.enums.Enums.InterviewStatus;
import com.businessgateways.hrats.domain.enums.Enums.InterviewType;
import com.businessgateways.hrats.domain.enums.Enums.Recommendation;
import com.businessgateways.hrats.dto.CommonDtos.PersonRef;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

/** Request and response bodies for interviews and feedback. */
public final class InterviewDtos {

    private InterviewDtos() {}

    public record ScheduleInterviewRequest(
            @NotBlank String applicationId,
            @Min(1) int round,
            @NotBlank @Size(max = 100) String roundName,
            @NotNull InterviewType interviewType,
            @NotNull Instant scheduledStart,
            @NotNull Instant scheduledEnd,
            @Size(max = 60) String timeZone,
            @Size(max = 500) String meetingLink,
            @Size(max = 300) String venue,
            String instructions,
            @NotEmpty List<String> interviewerIds,
            String leadInterviewerId,
            @Schema(description = "Schedule anyway when a panellist is double-booked")
            Boolean ignoreConflicts) {}

    public record RescheduleRequest(
            @NotNull Instant scheduledStart,
            @NotNull Instant scheduledEnd,
            @Size(max = 500) String reason,
            Boolean ignoreConflicts) {}

    public record CancelRequest(@NotBlank @Size(max = 500) String reason) {}

    /**
     * A structured scorecard.
     *
     * The per-competency scores are optional because not every round
     * assesses every competency; {@code overallRating} and
     * {@code recommendation} are not, because a scorecard without a
     * verdict is of no use to the hiring decision.
     */
    public record FeedbackRequest(
            @Min(1) @Max(5) Integer technicalSkills,
            @Min(1) @Max(5) Integer communication,
            @Min(1) @Max(5) Integer problemSolving,
            @Min(1) @Max(5) Integer relevantExperience,
            @Min(1) @Max(5) Integer roleSuitability,
            @Min(1) @Max(5) Integer teamCollaboration,
            @NotNull @Min(1) @Max(5) Integer overallRating,
            @Size(max = 4000) String strengths,
            @Size(max = 4000) String areasForImprovement,
            @Size(max = 4000) String comments,
            @NotNull Recommendation recommendation) {}

    public record PanelMemberResponse(
            String interviewerId,
            boolean isLead,
            boolean accepted,
            Instant respondedAt,
            PersonRef interviewer,
            boolean hasSubmittedFeedback) {}

    /** A panellist who is already booked across the proposed window. */
    public record ConflictResponse(
            String interviewerId,
            String interviewerName,
            String conflictingInterview,
            Instant from,
            Instant to) {}

    public record FeedbackResponse(
            String id,
            String interviewId,
            Integer technicalSkills,
            Integer communication,
            Integer problemSolving,
            Integer relevantExperience,
            Integer roleSuitability,
            Integer teamCollaboration,
            int overallRating,
            String strengths,
            String areasForImprovement,
            String comments,
            Recommendation recommendation,
            PersonRef interviewer,
            Instant submittedAt,
            Instant updatedAt) {}

    public record CandidateRef(String id, String candidateCode, String fullName) {}

    public record JobRef(String id, String title, String requirementCode) {}

    public record ApplicationRef(String id, String applicationCode, ApplicationStage currentStage) {}

    public record InterviewResponse(
            String id,
            String interviewCode,
            String applicationId,
            String candidateId,
            String jobId,
            int round,
            String roundName,
            InterviewType interviewType,
            Instant scheduledStart,
            Instant scheduledEnd,
            String timeZone,
            String meetingLink,
            String venue,
            String instructions,
            InterviewStatus status,
            String cancelReason,
            CandidateRef candidate,
            JobRef job,
            ApplicationRef application,
            PersonRef organiser,
            List<PanelMemberResponse> panel,
            Counts count,
            List<ConflictResponse> conflicts,
            Instant createdAt) {

        public record Counts(int feedback) {}
    }

    /** One entry on the interview calendar. */
    public record CalendarEntry(
            String id,
            String interviewCode,
            String title,
            Instant start,
            Instant end,
            InterviewStatus status,
            InterviewType interviewType,
            String candidateName,
            String jobTitle,
            List<String> interviewerNames) {}

    /** An interview the caller has sat on but not yet written up. */
    public record PendingFeedbackResponse(
            String interviewId,
            String interviewCode,
            String roundName,
            Instant scheduledStart,
            String candidateName,
            String jobTitle,
            long daysOverdue) {}
}
