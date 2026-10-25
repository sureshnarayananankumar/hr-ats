package com.businessgateways.hrats.dto;

import com.businessgateways.hrats.domain.enums.Enums.ApprovalDecision;
import com.businessgateways.hrats.domain.enums.Enums.EmploymentType;
import com.businessgateways.hrats.domain.enums.Enums.JobStatus;
import com.businessgateways.hrats.domain.enums.Enums.Priority;
import com.businessgateways.hrats.domain.enums.Enums.WorkMode;
import com.businessgateways.hrats.dto.CommonDtos.DepartmentRef;
import com.businessgateways.hrats.dto.CommonDtos.PersonRef;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Request and response bodies for job requirements. */
public final class JobDtos {

    private JobDtos() {}

    public record SkillRequirement(
            @NotBlank String skillId,
            boolean isRequired,
            @Min(0) Integer minYears) {}

    /** A requisition's editable fields. Status is never set directly. */
    public record UpsertJobRequest(
            @NotBlank @Size(max = 200) String title,
            @NotBlank String description,
            String responsibilities,
            String qualifications,
            String internalNotes,
            @Min(0) int minExperience,
            @Min(0) Integer maxExperience,
            @NotBlank String departmentId,
            @NotBlank @Size(max = 150) String designation,
            @Min(1) int vacancies,
            @NotNull EmploymentType employmentType,
            @NotNull WorkMode workMode,
            @NotBlank @Size(max = 200) String location,
            BigDecimal salaryMin,
            BigDecimal salaryMax,
            @Size(min = 3, max = 3) String salaryCurrency,
            Boolean salaryConfidential,
            @NotNull Priority priority,
            String recruiterId,
            String hiringManagerId,
            Instant applicationDeadline,
            List<SkillRequirement> skills) {}

    public record StatusChangeRequest(
            @NotNull JobStatus status,
            @Size(max = 500) String reason) {}

    public record ApprovalRequest(
            @NotNull
            @Schema(description = "APPROVED or REJECTED; PENDING is not a decision")
            ApprovalDecision decision,
            @Size(max = 2000) String comments) {}

    public record AssignRecruiterRequest(String recruiterId, String hiringManagerId) {}

    public record ApprovalResponse(
            String id,
            String jobId,
            String approverId,
            int sequence,
            ApprovalDecision decision,
            String comments,
            Instant decidedAt,
            Instant createdAt,
            PersonRef approver,
            JobSummary job) {}

    /** The compact form used in lists and nested inside other records. */
    public record JobSummary(
            String id,
            String requirementCode,
            String title,
            String slug,
            JobStatus status,
            Priority priority,
            String designation,
            String location,
            EmploymentType employmentType,
            WorkMode workMode,
            int vacancies,
            int vacanciesFilled,
            DepartmentRef department,
            PersonRef recruiter,
            Long applicationCount,
            Instant publishedAt,
            Instant applicationDeadline,
            Instant createdAt) {}

    /** The full record returned by {@code GET /jobs/{id}}. */
    public record JobResponse(
            String id,
            String requirementCode,
            String title,
            String slug,
            String description,
            String responsibilities,
            String qualifications,
            String internalNotes,
            JobStatus status,
            Priority priority,
            String designation,
            String departmentId,
            DepartmentRef department,
            String location,
            EmploymentType employmentType,
            WorkMode workMode,
            int vacancies,
            int vacanciesFilled,
            int minExperience,
            Integer maxExperience,
            BigDecimal salaryMin,
            BigDecimal salaryMax,
            String salaryCurrency,
            boolean salaryConfidential,
            PersonRef recruiter,
            PersonRef hiringManager,
            PersonRef requestedBy,
            List<JobSkillResponse> skills,
            long applicationCount,
            List<ApprovalResponse> approvals,
            String onHoldReason,
            String cancelReason,
            Instant requestDate,
            Instant publishedAt,
            Instant applicationDeadline,
            Instant closedAt,
            Instant createdAt,
            Instant updatedAt) {}

    public record JobSkillResponse(
            CommonDtos.SkillRef skill, boolean isRequired, Integer minYears) {}

    public record JobHistoryResponse(
            Long id,
            String fieldName,
            String oldValue,
            String newValue,
            String reason,
            PersonRef changedBy,
            Instant changedAt) {}

    /**
     * The public careers-portal view.
     *
     * Deliberately a separate shape rather than a filtered JobResponse:
     * leaking an internal note or a confidential salary band to an
     * anonymous visitor should require adding a field here, not
     * forgetting to remove one there.
     */
    public record PublicJobResponse(
            String id,
            String requirementCode,
            String title,
            String slug,
            String description,
            String responsibilities,
            String qualifications,
            String designation,
            String departmentName,
            String location,
            EmploymentType employmentType,
            WorkMode workMode,
            int vacancies,
            int minExperience,
            Integer maxExperience,
            BigDecimal salaryMin,
            BigDecimal salaryMax,
            String salaryCurrency,
            List<String> skills,
            Instant publishedAt,
            Instant applicationDeadline) {}
}
