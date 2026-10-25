package com.businessgateways.hrats.dto;

import com.businessgateways.hrats.domain.enums.Enums.ApplicationStage;
import com.businessgateways.hrats.domain.enums.Enums.ApplicationStatus;
import com.businessgateways.hrats.domain.enums.Enums.ScreeningResult;
import com.businessgateways.hrats.dto.CandidateDtos.DocumentResponse;
import com.businessgateways.hrats.dto.CandidateDtos.TagResponse;
import com.businessgateways.hrats.dto.CommonDtos.PersonRef;
import com.businessgateways.hrats.dto.CommonDtos.SourceRef;
import com.businessgateways.hrats.dto.JobDtos.JobSummary;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Request and response bodies for job applications. */
public final class ApplicationDtos {

    private ApplicationDtos() {}

    public record CreateApplicationRequest(
            @Schema(description = "Omitted when a candidate applies for themselves")
            String candidateId,
            @NotNull String jobId,
            String resumeDocumentId,
            @Size(max = 5000) String coverLetter,
            String sourceId) {}

    public record TransitionRequest(
            @NotNull ApplicationStage toStage,
            ApplicationStatus toStatus,
            @Size(max = 500) String reason,
            ScreeningResult screeningResult,
            @Size(max = 2000) String screeningRemarks) {}

    public record BulkTransitionRequest(
            @NotEmpty List<String> applicationIds,
            @NotNull ApplicationStage toStage,
            ApplicationStatus toStatus,
            @Size(max = 500) String reason) {}

    public record WithdrawRequest(@Size(max = 500) String reason) {}

    public record AssignRequest(@NotNull String recruiterId) {}

    public record NoteRequest(
            @Size(max = 5000) String body,
            @Schema(defaultValue = "true") Boolean isInternal) {}

    public record NoteResponse(
            String id,
            String body,
            boolean isInternal,
            PersonRef author,
            Instant createdAt,
            Instant updatedAt) {}

    /** One application's result from a bulk operation. */
    public record BulkResult(String applicationId, boolean succeeded, String message) {}

    public record BulkTransitionResponse(int succeeded, int failed, List<BulkResult> results) {}

    public record NextInterviewRef(String id, Instant scheduledStart, String roundName) {}

    public record CandidateRef(
            String id,
            String candidateCode,
            String fullName,
            String email,
            BigDecimal totalExperience,
            String currentDesignation,
            String currentCompany) {}

    public record StatusHistoryResponse(
            Long id,
            String applicationId,
            ApplicationStage fromStage,
            ApplicationStage toStage,
            String fromStageLabel,
            String toStageLabel,
            ApplicationStatus fromStatus,
            ApplicationStatus toStatus,
            String reason,
            Integer durationSeconds,
            PersonRef changedBy,
            Instant changedAt) {}

    public record ApplicationSummary(
            String id,
            String applicationCode,
            String candidateId,
            String jobId,
            ApplicationStage currentStage,
            String stageLabel,
            ApplicationStatus status,
            ScreeningResult screeningResult,
            Instant appliedAt,
            Instant stageEnteredAt,
            Instant followUpDueAt,
            Instant lastUpdatedAt,
            boolean isOverdue,
            CandidateRef candidate,
            JobSummary job,
            PersonRef recruiter,
            SourceRef source,
            NextInterviewRef nextInterview) {}

    public record ApplicationResponse(
            String id,
            String applicationCode,
            String candidateId,
            String jobId,
            ApplicationStage currentStage,
            String stageLabel,
            ApplicationStatus status,
            ScreeningResult screeningResult,
            String screeningRemarks,
            String rejectionReason,
            String withdrawReason,
            String coverLetter,
            Instant appliedAt,
            Instant stageEnteredAt,
            Instant followUpDueAt,
            Instant lastUpdatedAt,
            boolean isOverdue,
            CandidateRef candidate,
            JobSummary job,
            PersonRef recruiter,
            SourceRef source,
            DocumentResponse resumeDocument,
            NextInterviewRef nextInterview,
            List<ApplicationStage> allowedNextStages) {}

    // -----------------------------------------------------------------
    //  Kanban pipeline
    // -----------------------------------------------------------------

    public record PipelineCard(
            String applicationId,
            String applicationCode,
            String candidateId,
            String candidateCode,
            String candidateName,
            BigDecimal experience,
            List<String> skills,
            List<TagResponse> tags,
            Instant appliedAt,
            PersonRef recruiter,
            ApplicationStatus status,
            NextInterviewRef nextInterview,
            Instant stageEnteredAt,
            Instant followUpDueAt,
            boolean isOverdue) {}

    public record PipelineColumn(
            ApplicationStage stage, String label, int count, List<PipelineCard> cards) {}

    public record PipelineBoard(JobRef job, List<PipelineColumn> columns, int total) {

        public record JobRef(
                String id,
                String title,
                String requirementCode,
                int vacancies,
                int vacanciesFilled) {}
    }
}
