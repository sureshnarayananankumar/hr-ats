package com.businessgateways.hrats.service;

import com.businessgateways.hrats.common.ApiException;
import com.businessgateways.hrats.common.Constants;
import com.businessgateways.hrats.common.CryptoUtil;
import com.businessgateways.hrats.common.dto.PageResponse;
import com.businessgateways.hrats.common.dto.PaginationQuery;
import com.businessgateways.hrats.domain.entity.CandidateActivity;
import com.businessgateways.hrats.domain.entity.CandidateNote;
import com.businessgateways.hrats.domain.entity.CandidateProfile;
import com.businessgateways.hrats.domain.entity.CandidateSkill;
import com.businessgateways.hrats.domain.entity.CandidateTagLink;
import com.businessgateways.hrats.dto.CandidateDtos.ActivityResponse;
import com.businessgateways.hrats.dto.CandidateDtos.CandidateResponse;
import com.businessgateways.hrats.dto.CandidateDtos.CandidateSkillResponse;
import com.businessgateways.hrats.dto.CandidateDtos.CandidateSummary;
import com.businessgateways.hrats.dto.CandidateDtos.DocumentResponse;
import com.businessgateways.hrats.dto.CandidateDtos.DuplicateCandidate;
import com.businessgateways.hrats.dto.CandidateDtos.NoteRequest;
import com.businessgateways.hrats.dto.CandidateDtos.NoteResponse;
import com.businessgateways.hrats.dto.CandidateDtos.TagResponse;
import com.businessgateways.hrats.dto.CandidateDtos.UpdateCandidateRequest;
import com.businessgateways.hrats.dto.CommonDtos.PersonRef;
import com.businessgateways.hrats.dto.CommonDtos.SkillRef;
import com.businessgateways.hrats.repository.CandidateActivityRepository;
import com.businessgateways.hrats.repository.CandidateDocumentRepository;
import com.businessgateways.hrats.repository.CandidateNoteRepository;
import com.businessgateways.hrats.repository.CandidateProfileRepository;
import com.businessgateways.hrats.repository.CandidateSkillRepository;
import com.businessgateways.hrats.repository.CandidateTagLinkRepository;
import com.businessgateways.hrats.repository.CandidateTagRepository;
import com.businessgateways.hrats.repository.JobApplicationRepository;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Candidate profiles, notes, tags and duplicate detection.
 *
 * Access is scoped two ways. A candidate may only ever reach their own
 * record, enforced in {@link #requireVisible}. Staff with
 * {@code candidate.read.any} see everyone — there is no per-recruiter
 * partition of the talent pool, which matches how the organisation
 * actually works.
 */
@Service
public class CandidateService {

    private static final Logger log = LoggerFactory.getLogger(CandidateService.class);

    private static final List<String> SORTABLE = List.of(
            "createdAt", "updatedAt", "fullName", "candidateCode",
            "totalExperience", "expectedSalary", "noticePeriodDays");

    private final CandidateProfileRepository candidates;
    private final CandidateSkillRepository candidateSkills;
    private final CandidateNoteRepository notes;
    private final CandidateActivityRepository activities;
    private final CandidateTagRepository tags;
    private final CandidateTagLinkRepository tagLinks;
    private final CandidateDocumentRepository documents;
    private final JobApplicationRepository applications;
    private final SkillRepository skills;
    private final UserRepository users;
    private final AuditService audit;

    public CandidateService(
            CandidateProfileRepository candidates,
            CandidateSkillRepository candidateSkills,
            CandidateNoteRepository notes,
            CandidateActivityRepository activities,
            CandidateTagRepository tags,
            CandidateTagLinkRepository tagLinks,
            CandidateDocumentRepository documents,
            JobApplicationRepository applications,
            SkillRepository skills,
            UserRepository users,
            AuditService audit) {
        this.candidates = candidates;
        this.candidateSkills = candidateSkills;
        this.notes = notes;
        this.activities = activities;
        this.tags = tags;
        this.tagLinks = tagLinks;
        this.documents = documents;
        this.applications = applications;
        this.skills = skills;
        this.users = users;
        this.audit = audit;
    }

    // -----------------------------------------------------------------
    //  Reading
    // -----------------------------------------------------------------

    @Transactional(readOnly = true)
    public PageResponse<CandidateSummary> list(
            PaginationQuery query,
            String skillId,
            String tagId,
            BigDecimalRange experience,
            Integer maxNoticePeriod,
            String location) {

        Specification<CandidateProfile> spec =
                buildSpec(query, skillId, tagId, experience, maxNoticePeriod, location);

        Page<CandidateProfile> page = candidates.findAll(spec, query.pageable(SORTABLE, "createdAt"));
        return PageResponse.from(page, this::toSummary);
    }

    /** An inclusive experience band; either end may be absent. */
    public record BigDecimalRange(java.math.BigDecimal min, java.math.BigDecimal max) {

        public boolean isEmpty() {
            return min == null && max == null;
        }
    }

    private Specification<CandidateProfile> buildSpec(
            PaginationQuery query,
            String skillId,
            String tagId,
            BigDecimalRange experience,
            Integer maxNoticePeriod,
            String location) {

        return (root, criteria, builder) -> {
            List<Predicate> predicates = new ArrayList<>();

            String term = query.searchTerm();
            if (term != null) {
                String like = "%" + term.toLowerCase() + "%";
                predicates.add(builder.or(
                        builder.like(builder.lower(root.get("fullName")), like),
                        builder.like(builder.lower(root.get("candidateCode")), like),
                        builder.like(builder.lower(root.get("normalisedEmail")), like),
                        builder.like(builder.lower(root.get("currentCompany")), like),
                        builder.like(builder.lower(root.get("currentDesignation")), like)));
            }

            if (location != null && !location.isBlank()) {
                predicates.add(builder.like(
                        builder.lower(root.get("location")), "%" + location.toLowerCase() + "%"));
            }
            if (experience != null && experience.min() != null) {
                predicates.add(builder.greaterThanOrEqualTo(
                        root.get("totalExperience"), experience.min()));
            }
            if (experience != null && experience.max() != null) {
                predicates.add(builder.lessThanOrEqualTo(
                        root.get("totalExperience"), experience.max()));
            }
            if (maxNoticePeriod != null) {
                predicates.add(builder.lessThanOrEqualTo(
                        root.get("noticePeriodDays"), maxNoticePeriod));
            }

            // Skill and tag live in child tables; a subquery keeps this
            // a single statement without duplicating parent rows the way
            // a join would.
            if (skillId != null && !skillId.isBlank()) {
                var subquery = criteria.subquery(String.class);
                var skillRoot = subquery.from(CandidateSkill.class);
                subquery.select(skillRoot.get("candidateId"))
                        .where(builder.equal(skillRoot.get("skillId"), skillId));
                predicates.add(root.get("id").in(subquery));
            }
            if (tagId != null && !tagId.isBlank()) {
                var subquery = criteria.subquery(String.class);
                var tagRoot = subquery.from(CandidateTagLink.class);
                subquery.select(tagRoot.get("candidateId"))
                        .where(builder.equal(tagRoot.get("tagId"), tagId));
                predicates.add(root.get("id").in(subquery));
            }

            return builder.and(predicates.toArray(new Predicate[0]));
        };
    }

    @Transactional(readOnly = true)
    public CandidateResponse get(String id, AuthenticatedUser caller) {
        return toResponse(requireVisible(id, caller));
    }

    @Transactional(readOnly = true)
    public CandidateResponse getOwnProfile(AuthenticatedUser caller) {
        CandidateProfile profile = candidates.findByUserId(caller.userId())
                .orElseThrow(() -> ApiException.notFound(
                        "You do not have a candidate profile on this account"));
        return toResponse(profile);
    }

    // -----------------------------------------------------------------
    //  Writing
    // -----------------------------------------------------------------

    @Transactional
    public CandidateResponse update(String id, UpdateCandidateRequest request, AuthenticatedUser caller) {
        CandidateProfile profile = requireVisible(id, caller);

        boolean ownProfile = profile.getUserId().equals(caller.userId());
        if (!ownProfile && !caller.hasPermission(Permissions.CANDIDATE_UPDATE_ANY)) {
            throw ApiException.forbidden("You may only edit your own profile.");
        }

        applyFields(profile, request);
        candidates.save(profile);

        if (request.skills() != null) {
            candidateSkills.deleteByCandidateId(profile.getId());
            for (var requested : request.skills()) {
                skills.findById(requested.skillId())
                        .orElseThrow(() -> ApiException.badRequest(
                                "Skill \"" + requested.skillId() + "\" does not exist."));

                CandidateSkill row = new CandidateSkill();
                row.setCandidateId(profile.getId());
                row.setSkillId(requested.skillId());
                row.setYears(requested.years());
                row.setProficiency(requested.proficiency());
                candidateSkills.save(row);
            }
        }

        recordActivity(profile.getId(), "Profile updated",
                ownProfile ? "Updated by the candidate" : "Updated by " + caller.email(),
                caller.userId());

        audit.record(caller, "CANDIDATE_UPDATED", "candidate", profile.getId(), null);

        return toResponse(profile);
    }

    private void applyFields(CandidateProfile profile, UpdateCandidateRequest request) {
        if (request.fullName() != null) {
            profile.setFullName(request.fullName().trim());
        }
        if (request.mobile() != null) {
            profile.setMobile(request.mobile());
            profile.setNormalisedPhone(CryptoUtil.normalisePhone(request.mobile()));
        }
        if (request.location() != null) {
            profile.setLocation(request.location());
        }
        if (request.totalExperience() != null) {
            profile.setTotalExperience(request.totalExperience());
        }
        if (request.currentDesignation() != null) {
            profile.setCurrentDesignation(request.currentDesignation());
        }
        if (request.currentCompany() != null) {
            profile.setCurrentCompany(request.currentCompany());
        }
        if (request.highestEducation() != null) {
            profile.setHighestEducation(request.highestEducation());
        }
        if (request.educationDetails() != null) {
            profile.setEducationDetails(request.educationDetails());
        }
        if (request.expectedSalary() != null) {
            profile.setExpectedSalary(request.expectedSalary());
        }
        if (request.currentSalary() != null) {
            profile.setCurrentSalary(request.currentSalary());
        }
        if (request.salaryCurrency() != null) {
            profile.setSalaryCurrency(request.salaryCurrency().toUpperCase());
        }
        if (request.noticePeriodDays() != null) {
            profile.setNoticePeriodDays(request.noticePeriodDays());
        }
        if (request.linkedinUrl() != null) {
            profile.setLinkedinUrl(request.linkedinUrl());
        }
        if (request.portfolioUrl() != null) {
            profile.setPortfolioUrl(request.portfolioUrl());
        }
        if (request.preferredLocation() != null) {
            profile.setPreferredLocation(request.preferredLocation());
        }
        if (request.preferredWorkMode() != null) {
            profile.setPreferredWorkMode(request.preferredWorkMode());
        }
        if (request.preferredEmploymentType() != null) {
            profile.setPreferredEmploymentType(request.preferredEmploymentType());
        }
        if (request.willingToRelocate() != null) {
            profile.setWillingToRelocate(request.willingToRelocate());
        }
        if (request.summary() != null) {
            profile.setSummary(request.summary());
        }
    }

    /**
     * Flags the profile for erasure rather than deleting it.
     *
     * An immediate delete would cascade through applications,
     * interviews and offers, destroying records the organisation is
     * legally required to keep for a period. The request is recorded
     * and the retention job acts on it when the period expires.
     */
    @Transactional
    public String requestDeletion(AuthenticatedUser caller) {
        CandidateProfile profile = candidates.findByUserId(caller.userId())
                .orElseThrow(() -> ApiException.notFound("You do not have a candidate profile"));

        if (profile.getDataDeletionRequestedAt() != null) {
            return "Your erasure request is already recorded.";
        }

        profile.setDataDeletionRequestedAt(Instant.now());
        candidates.save(profile);

        recordActivity(profile.getId(), "Erasure requested",
                "The candidate asked for their data to be erased", caller.userId());

        audit.recordSecurityEvent(caller, "CANDIDATE_DELETION_REQUESTED",
                "candidate", profile.getId(), null);

        return "Your request is recorded. We will erase your data once the records "
                + "we are required to keep have reached the end of their retention period.";
    }

    // -----------------------------------------------------------------
    //  Notes, tags and activity
    // -----------------------------------------------------------------

    @Transactional(readOnly = true)
    public PageResponse<NoteResponse> notes(String id, PaginationQuery query, AuthenticatedUser caller) {
        requireVisible(id, caller);
        return PageResponse.from(
                notes.findByCandidateIdOrderByCreatedAtDesc(id, query.pageable()),
                this::toNoteResponse);
    }

    @Transactional
    public NoteResponse addNote(String id, NoteRequest request, AuthenticatedUser caller) {
        requireVisible(id, caller);

        CandidateNote note = new CandidateNote();
        note.setCandidateId(id);
        note.setAuthorId(caller.userId());
        note.setBody(request.body());
        notes.save(note);

        recordActivity(id, "Note added", null, caller.userId());
        return toNoteResponse(note);
    }

    @Transactional(readOnly = true)
    public PageResponse<ActivityResponse> activity(
            String id, PaginationQuery query, AuthenticatedUser caller) {
        requireVisible(id, caller);

        return PageResponse.from(
                activities.findByCandidateIdOrderByCreatedAtDesc(id, query.pageable()),
                entry -> new ActivityResponse(
                        entry.getId(),
                        entry.getActivity(),
                        entry.getDetail(),
                        entry.getActorUserId() == null ? null
                                : users.findById(entry.getActorUserId())
                                        .map(PersonRef::withoutEmail).orElse(null),
                        entry.getCreatedAt()));
    }

    @Transactional(readOnly = true)
    public List<TagResponse> allTags() {
        return tags.findAllByOrderByNameAsc().stream()
                .map(tag -> new TagResponse(tag.getId(), tag.getName(), tag.getColour()))
                .toList();
    }

    @Transactional
    public List<TagResponse> addTag(String id, String tagId, AuthenticatedUser caller) {
        requireVisible(id, caller);

        var tag = tags.findById(tagId)
                .orElseThrow(() -> ApiException.badRequest("That tag does not exist."));

        boolean alreadyTagged = tagLinks.findByCandidateId(id).stream()
                .anyMatch(link -> link.getTagId().equals(tagId));

        if (!alreadyTagged) {
            CandidateTagLink link = new CandidateTagLink();
            link.setCandidateId(id);
            link.setTagId(tagId);
            link.setAssignedById(caller.userId());
            tagLinks.save(link);

            recordActivity(id, "Tagged", tag.getName(), caller.userId());
        }

        return tagsFor(id);
    }

    @Transactional
    public List<TagResponse> removeTag(String id, String tagId, AuthenticatedUser caller) {
        requireVisible(id, caller);
        tagLinks.deleteByCandidateIdAndTagId(id, tagId);
        recordActivity(id, "Tag removed", tagId, caller.userId());
        return tagsFor(id);
    }

    /**
     * Candidates who may be the same person.
     *
     * Matching is on the normalised email and phone only. Fuzzy name
     * matching produces far too many false positives on a talent pool
     * of any size, and a wrongly merged candidate is worse than a
     * missed duplicate.
     */
    @Transactional(readOnly = true)
    public List<DuplicateCandidate> duplicates(String id, AuthenticatedUser caller) {
        CandidateProfile profile = requireVisible(id, caller);
        Map<String, DuplicateCandidate> found = new LinkedHashMap<>();

        candidates.findByNormalisedEmail(profile.getNormalisedEmail())
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> found.put(other.getId(), toDuplicate(other, "email")));

        if (profile.getNormalisedPhone() != null) {
            candidates.findByNormalisedPhone(profile.getNormalisedPhone()).stream()
                    .filter(other -> !other.getId().equals(id))
                    .forEach(other -> found.putIfAbsent(other.getId(), toDuplicate(other, "phone")));
        }

        return List.copyOf(found.values());
    }

    // -----------------------------------------------------------------
    //  Export
    // -----------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<Map<String, Object>> exportRows(
            PaginationQuery query,
            String skillId,
            String tagId,
            BigDecimalRange experience,
            Integer maxNoticePeriod,
            String location) {

        return candidates
                .findAll(buildSpec(query, skillId, tagId, experience, maxNoticePeriod, location))
                .stream()
                .map(profile -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("Code", profile.getCandidateCode());
                    row.put("Name", profile.getFullName());
                    row.put("Email", profile.getNormalisedEmail());
                    row.put("Mobile", profile.getMobile());
                    row.put("Location", profile.getLocation());
                    row.put("Experience", profile.getTotalExperience());
                    row.put("Current Designation", profile.getCurrentDesignation());
                    row.put("Current Company", profile.getCurrentCompany());
                    row.put("Education", profile.getHighestEducation());
                    row.put("Expected Salary", profile.getExpectedSalary());
                    row.put("Notice Period (days)", profile.getNoticePeriodDays());
                    row.put("Skills", String.join("; ", skillNames(profile.getId())));
                    row.put("Applications", applications.findByCandidateIdOrderByAppliedAtDesc(
                            profile.getId()).size());
                    row.put("Registered", profile.getCreatedAt());
                    return row;
                })
                .toList();
    }

    // -----------------------------------------------------------------
    //  Helpers
    // -----------------------------------------------------------------

    /**
     * Loads a profile the caller is entitled to see.
     *
     * A candidate reaching for somebody else's id gets 404 rather than
     * 403 — confirming that a given candidate exists is itself a
     * disclosure.
     */
    public CandidateProfile requireVisible(String id, AuthenticatedUser caller) {
        CandidateProfile profile = candidates.findById(id)
                .orElseThrow(() -> ApiException.notFound("Candidate", id));

        if (caller.hasPermission(Permissions.CANDIDATE_READ_ANY)) {
            return profile;
        }
        if (profile.getUserId().equals(caller.userId())) {
            return profile;
        }

        log.warn("User {} attempted to read candidate {}", caller.userId(), id);
        audit.recordSecurityEvent(caller, Constants.Audit.UNAUTHORIZED_ACCESS,
                "candidate", id, Map.of("reason", "not-own-profile"));

        throw ApiException.notFound("Candidate", id);
    }

    public void recordActivity(String candidateId, String activity, String detail, String actorUserId) {
        try {
            CandidateActivity entry = new CandidateActivity();
            entry.setCandidateId(candidateId);
            entry.setActivity(activity);
            entry.setDetail(detail);
            entry.setActorUserId(actorUserId);
            activities.save(entry);
        } catch (Exception ex) {
            log.error("Could not record activity \"{}\" for candidate {}", activity, candidateId, ex);
        }
    }

    private List<String> skillNames(String candidateId) {
        return candidateSkills.findByCandidateId(candidateId).stream()
                .filter(row -> row.getSkill() != null)
                .map(row -> row.getSkill().getName())
                .toList();
    }

    private List<TagResponse> tagsFor(String candidateId) {
        return tagLinks.findByCandidateId(candidateId).stream()
                .filter(link -> link.getTag() != null)
                .map(link -> new TagResponse(
                        link.getTag().getId(), link.getTag().getName(), link.getTag().getColour()))
                .toList();
    }

    private DuplicateCandidate toDuplicate(CandidateProfile other, String matchedOn) {
        return new DuplicateCandidate(
                other.getId(),
                other.getCandidateCode(),
                other.getFullName(),
                other.getNormalisedEmail(),
                matchedOn,
                other.getCreatedAt());
    }

    // -----------------------------------------------------------------
    //  Projection
    // -----------------------------------------------------------------

    public CandidateSummary toSummary(CandidateProfile profile) {
        return new CandidateSummary(
                profile.getId(),
                profile.getCandidateCode(),
                profile.getFullName(),
                profile.getNormalisedEmail(),
                profile.getMobile(),
                profile.getLocation(),
                profile.getTotalExperience(),
                profile.getCurrentDesignation(),
                profile.getCurrentCompany(),
                profile.getNoticePeriodDays(),
                skillNames(profile.getId()),
                tagsFor(profile.getId()),
                applications.findByCandidateIdOrderByAppliedAtDesc(profile.getId()).size(),
                profile.getCreatedAt());
    }

    public CandidateResponse toResponse(CandidateProfile profile) {
        List<CandidateSkillResponse> skillRows = candidateSkills.findByCandidateId(profile.getId())
                .stream()
                .map(row -> new CandidateSkillResponse(
                        SkillRef.of(row.getSkill()), row.getYears(), row.getProficiency()))
                .toList();

        List<DocumentResponse> documentRows =
                documents.findByCandidateIdAndDeletedAtIsNullOrderByUploadedAtDesc(profile.getId())
                        .stream()
                        .map(document -> new DocumentResponse(
                                document.getId(),
                                document.getCandidateId(),
                                document.getDocumentType(),
                                document.getOriginalName(),
                                document.getMimeType(),
                                document.getSizeBytes(),
                                document.getVersion(),
                                document.isCurrent(),
                                document.getUploadedAt(),
                                "/api/documents/" + document.getId() + "/download"))
                        .toList();

        var user = profile.getUser();

        return new CandidateResponse(
                profile.getId(),
                profile.getCandidateCode(),
                profile.getUserId(),
                profile.getFullName(),
                profile.getNormalisedEmail(),
                user == null ? null : user.getPhone(),
                profile.getMobile(),
                profile.getLocation(),
                profile.getTotalExperience(),
                profile.getCurrentDesignation(),
                profile.getCurrentCompany(),
                profile.getHighestEducation(),
                profile.getEducationDetails(),
                profile.getExpectedSalary(),
                profile.getCurrentSalary(),
                profile.getSalaryCurrency(),
                profile.getNoticePeriodDays(),
                profile.getLinkedinUrl(),
                profile.getPortfolioUrl(),
                profile.getPreferredLocation(),
                profile.getPreferredWorkMode(),
                profile.getPreferredEmploymentType(),
                profile.isWillingToRelocate(),
                profile.getSummary(),
                profile.isConsentToStoreData(),
                profile.getConsentAt(),
                profile.getDataDeletionRequestedAt(),
                skillRows,
                tagsFor(profile.getId()),
                documentRows,
                new CandidateResponse.Counts(
                        applications.findByCandidateIdOrderByAppliedAtDesc(profile.getId()).size(),
                        documentRows.size()),
                profile.getCreatedAt(),
                profile.getUpdatedAt());
    }

    private NoteResponse toNoteResponse(CandidateNote note) {
        return new NoteResponse(
                note.getId(),
                note.getBody(),
                PersonRef.withoutEmail(note.getAuthor()),
                note.getCreatedAt(),
                note.getUpdatedAt());
    }
}
