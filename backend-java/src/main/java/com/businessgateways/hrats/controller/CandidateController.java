package com.businessgateways.hrats.controller;

import com.businessgateways.hrats.common.Constants;
import com.businessgateways.hrats.common.dto.PageResponse;
import com.businessgateways.hrats.common.dto.PaginationQuery;
import com.businessgateways.hrats.dto.AuthDtos.MessageResponse;
import com.businessgateways.hrats.dto.CandidateDtos.ActivityResponse;
import com.businessgateways.hrats.dto.CandidateDtos.CandidateResponse;
import com.businessgateways.hrats.dto.CandidateDtos.CandidateSummary;
import com.businessgateways.hrats.dto.CandidateDtos.DuplicateCandidate;
import com.businessgateways.hrats.dto.CandidateDtos.NoteRequest;
import com.businessgateways.hrats.dto.CandidateDtos.NoteResponse;
import com.businessgateways.hrats.dto.CandidateDtos.TagRequest;
import com.businessgateways.hrats.dto.CandidateDtos.TagResponse;
import com.businessgateways.hrats.dto.CandidateDtos.UpdateCandidateRequest;
import com.businessgateways.hrats.security.AuthenticatedUser;
import com.businessgateways.hrats.service.AuditService;
import com.businessgateways.hrats.service.CandidateService;
import com.businessgateways.hrats.service.CandidateService.BigDecimalRange;
import com.businessgateways.hrats.service.ExportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Candidate profiles.
 *
 * The {@code /me} routes come first on purpose: they must match before
 * {@code /{id}}, or "me" would be read as a candidate id.
 */
@RestController
@RequestMapping("${hrats.api-prefix:/api}/candidates")
@Tag(name = "Candidates", description = "Talent pool, notes, tags and duplicate detection")
public class CandidateController {

    private final CandidateService candidates;
    private final ExportService exports;
    private final AuditService audit;

    public CandidateController(
            CandidateService candidates, ExportService exports, AuditService audit) {
        this.candidates = candidates;
        this.exports = exports;
        this.audit = audit;
    }

    // -----------------------------------------------------------------
    //  The caller's own profile
    // -----------------------------------------------------------------

    @GetMapping("/me")
    @PreAuthorize("hasAnyAuthority('candidate.read.own', 'candidate.read.any')")
    @Operation(summary = "The signed-in candidate's own profile")
    public CandidateResponse myProfile(@AuthenticationPrincipal AuthenticatedUser caller) {
        return candidates.getOwnProfile(caller);
    }

    @PatchMapping("/me")
    @PreAuthorize("hasAuthority('candidate.update.own')")
    @Operation(summary = "Update the signed-in candidate's own profile")
    public CandidateResponse updateMyProfile(
            @Valid @RequestBody UpdateCandidateRequest request,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return candidates.update(
                candidates.getOwnProfile(caller).id(), request, caller);
    }

    @PostMapping("/me/request-deletion")
    @PreAuthorize("hasAuthority('candidate.update.own')")
    @Operation(summary = "Ask for your personal data to be erased")
    public MessageResponse requestDeletion(@AuthenticationPrincipal AuthenticatedUser caller) {
        return MessageResponse.of(candidates.requestDeletion(caller));
    }

    // -----------------------------------------------------------------
    //  The talent pool
    // -----------------------------------------------------------------

    @GetMapping
    @PreAuthorize("hasAuthority('candidate.read.any')")
    @Operation(summary = "Search the talent pool")
    public PageResponse<CandidateSummary> list(
            @Valid PaginationQuery query,
            @RequestParam(required = false) String skillId,
            @RequestParam(required = false) String tagId,
            @RequestParam(required = false) BigDecimal minExperience,
            @RequestParam(required = false) BigDecimal maxExperience,
            @RequestParam(required = false) Integer maxNoticePeriod,
            @RequestParam(required = false) String location) {

        return candidates.list(query, skillId, tagId,
                new BigDecimalRange(minExperience, maxExperience), maxNoticePeriod, location);
    }

    @GetMapping("/tags")
    @PreAuthorize("hasAnyAuthority('candidate.read.any', 'candidate.tag.manage')")
    @Operation(summary = "Every tag that can be applied to a candidate")
    public List<TagResponse> tags() {
        return candidates.allTags();
    }

    @GetMapping("/export")
    @PreAuthorize("hasAuthority('candidate.export')")
    @Operation(summary = "Export the matching candidates as CSV or Excel")
    public ResponseEntity<ByteArrayResource> export(
            @Valid PaginationQuery query,
            @RequestParam(required = false) String skillId,
            @RequestParam(required = false) String tagId,
            @RequestParam(required = false) BigDecimal minExperience,
            @RequestParam(required = false) BigDecimal maxExperience,
            @RequestParam(required = false) Integer maxNoticePeriod,
            @RequestParam(required = false) String location,
            @AuthenticationPrincipal AuthenticatedUser caller) {

        var rows = candidates.exportRows(query, skillId, tagId,
                new BigDecimalRange(minExperience, maxExperience), maxNoticePeriod, location);

        // An export of personal data is exactly the kind of bulk access
        // a reviewer needs to see in the audit trail.
        audit.recordSecurityEvent(caller, Constants.Audit.DATA_EXPORTED, "candidate", null,
                Map.of("rows", rows.size(), "format", query.getFormat()));

        return exports.download(rows, query.getFormat(), "candidates", "Candidates");
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('candidate.read.any', 'candidate.read.own')")
    @Operation(summary = "One candidate profile")
    public CandidateResponse get(
            @PathVariable String id, @AuthenticationPrincipal AuthenticatedUser caller) {
        return candidates.get(id, caller);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('candidate.update.any', 'candidate.update.own')")
    @Operation(summary = "Update a candidate profile")
    public CandidateResponse update(
            @PathVariable String id,
            @Valid @RequestBody UpdateCandidateRequest request,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return candidates.update(id, request, caller);
    }

    @GetMapping("/{id}/duplicates")
    @PreAuthorize("hasAuthority('candidate.read.any')")
    @Operation(summary = "Candidates who may be the same person")
    public List<DuplicateCandidate> duplicates(
            @PathVariable String id, @AuthenticationPrincipal AuthenticatedUser caller) {
        return candidates.duplicates(id, caller);
    }

    @GetMapping("/{id}/activity")
    @PreAuthorize("hasAnyAuthority('candidate.read.any', 'candidate.read.own')")
    @Operation(summary = "Activity timeline for a candidate")
    public PageResponse<ActivityResponse> activity(
            @PathVariable String id,
            @Valid PaginationQuery query,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return candidates.activity(id, query, caller);
    }

    @GetMapping("/{id}/notes")
    @PreAuthorize("hasAuthority('candidate.note.manage')")
    @Operation(summary = "Internal notes on a candidate")
    public PageResponse<NoteResponse> notes(
            @PathVariable String id,
            @Valid PaginationQuery query,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return candidates.notes(id, query, caller);
    }

    @PostMapping("/{id}/notes")
    @PreAuthorize("hasAuthority('candidate.note.manage')")
    @Operation(summary = "Add an internal note")
    public NoteResponse addNote(
            @PathVariable String id,
            @Valid @RequestBody NoteRequest request,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return candidates.addNote(id, request, caller);
    }

    @PostMapping("/{id}/tags")
    @PreAuthorize("hasAuthority('candidate.tag.manage')")
    @Operation(summary = "Tag a candidate")
    public List<TagResponse> addTag(
            @PathVariable String id,
            @Valid @RequestBody TagRequest request,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return candidates.addTag(id, request.tagId(), caller);
    }

    @DeleteMapping("/{id}/tags/{tagId}")
    @PreAuthorize("hasAuthority('candidate.tag.manage')")
    @Operation(summary = "Remove a tag from a candidate")
    public List<TagResponse> removeTag(
            @PathVariable String id,
            @PathVariable String tagId,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return candidates.removeTag(id, tagId, caller);
    }
}
