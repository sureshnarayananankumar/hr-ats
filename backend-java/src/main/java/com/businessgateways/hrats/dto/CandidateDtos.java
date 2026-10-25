package com.businessgateways.hrats.dto;

import com.businessgateways.hrats.domain.enums.Enums.DocumentType;
import com.businessgateways.hrats.domain.enums.Enums.EmploymentType;
import com.businessgateways.hrats.domain.enums.Enums.SkillProficiency;
import com.businessgateways.hrats.domain.enums.Enums.WorkMode;
import com.businessgateways.hrats.dto.CommonDtos.PersonRef;
import com.businessgateways.hrats.dto.CommonDtos.SkillRef;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Request and response bodies for candidate profiles. */
public final class CandidateDtos {

    private CandidateDtos() {}

    public record CandidateSkillRequest(
            @NotBlank String skillId,
            @DecimalMin("0.0") BigDecimal years,
            @NotNull SkillProficiency proficiency) {}

    /**
     * The editable part of a profile.
     *
     * Deliberately excludes the candidate code, the linked user and the
     * consent timestamps: those are set once, by the system, and a
     * candidate editing their own profile must not be able to rewrite
     * the record of what they consented to.
     */
    public record UpdateCandidateRequest(
            @Size(max = 200) String fullName,
            @Size(max = 30) String mobile,
            @Size(max = 200) String location,
            @DecimalMin("0.0") BigDecimal totalExperience,
            @Size(max = 150) String currentDesignation,
            @Size(max = 200) String currentCompany,
            @Size(max = 200) String highestEducation,
            String educationDetails,
            @DecimalMin("0.0") BigDecimal expectedSalary,
            @DecimalMin("0.0") BigDecimal currentSalary,
            @Size(min = 3, max = 3) String salaryCurrency,
            @Min(0) Integer noticePeriodDays,
            @Size(max = 400) String linkedinUrl,
            @Size(max = 400) String portfolioUrl,
            @Size(max = 200) String preferredLocation,
            WorkMode preferredWorkMode,
            EmploymentType preferredEmploymentType,
            Boolean willingToRelocate,
            String summary,
            List<CandidateSkillRequest> skills) {}

    public record NoteRequest(@NotBlank @Size(max = 5000) String body) {}

    public record TagRequest(@NotBlank String tagId) {}

    public record CandidateSkillResponse(
            SkillRef skill, BigDecimal years, SkillProficiency proficiency) {}

    public record TagResponse(String id, String name, String colour) {}

    public record NoteResponse(
            String id, String body, PersonRef author, Instant createdAt, Instant updatedAt) {}

    public record ActivityResponse(
            Long id, String activity, String detail, PersonRef actor, Instant createdAt) {}

    public record DocumentResponse(
            String id,
            String candidateId,
            DocumentType documentType,
            String originalName,
            String mimeType,
            int sizeBytes,
            int version,
            boolean isCurrent,
            Instant uploadedAt,
            String downloadUrl) {}

    /** The compact form used in candidate lists. */
    public record CandidateSummary(
            String id,
            String candidateCode,
            String fullName,
            String email,
            String mobile,
            String location,
            BigDecimal totalExperience,
            String currentDesignation,
            String currentCompany,
            Integer noticePeriodDays,
            List<String> skills,
            List<TagResponse> tags,
            long applicationCount,
            Instant createdAt) {}

    /** The full profile. */
    public record CandidateResponse(
            String id,
            String candidateCode,
            String userId,
            String fullName,
            String email,
            String phone,
            String mobile,
            String location,
            BigDecimal totalExperience,
            String currentDesignation,
            String currentCompany,
            String highestEducation,
            String educationDetails,
            BigDecimal expectedSalary,
            BigDecimal currentSalary,
            String salaryCurrency,
            Integer noticePeriodDays,
            String linkedinUrl,
            String portfolioUrl,
            String preferredLocation,
            WorkMode preferredWorkMode,
            EmploymentType preferredEmploymentType,
            boolean willingToRelocate,
            String summary,
            boolean consentToStoreData,
            Instant consentAt,
            Instant dataDeletionRequestedAt,
            List<CandidateSkillResponse> skills,
            List<TagResponse> tags,
            List<DocumentResponse> documents,
            Counts count,
            Instant createdAt,
            Instant updatedAt) {

        public record Counts(long applications, long documents) {}
    }

    /**
     * A possible duplicate of this candidate.
     *
     * Surfaced rather than merged automatically: two people really can
     * share a name, and silently combining two candidates' histories
     * would be very hard to undo.
     */
    public record DuplicateCandidate(
            String id,
            String candidateCode,
            String fullName,
            String email,
            String matchedOn,
            Instant createdAt) {}
}
