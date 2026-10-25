package com.businessgateways.hrats.controller;

import com.businessgateways.hrats.common.Constants;
import com.businessgateways.hrats.common.dto.PageResponse;
import com.businessgateways.hrats.common.dto.PaginationQuery;
import com.businessgateways.hrats.domain.enums.Enums.ApplicationStage;
import com.businessgateways.hrats.domain.enums.Enums.ApplicationStatus;
import com.businessgateways.hrats.dto.ApplicationDtos.ApplicationResponse;
import com.businessgateways.hrats.dto.ApplicationDtos.ApplicationSummary;
import com.businessgateways.hrats.dto.ApplicationDtos.AssignRequest;
import com.businessgateways.hrats.dto.ApplicationDtos.BulkTransitionRequest;
import com.businessgateways.hrats.dto.ApplicationDtos.BulkTransitionResponse;
import com.businessgateways.hrats.dto.ApplicationDtos.CreateApplicationRequest;
import com.businessgateways.hrats.dto.ApplicationDtos.NoteRequest;
import com.businessgateways.hrats.dto.ApplicationDtos.NoteResponse;
import com.businessgateways.hrats.dto.ApplicationDtos.PipelineBoard;
import com.businessgateways.hrats.dto.ApplicationDtos.StatusHistoryResponse;
import com.businessgateways.hrats.dto.ApplicationDtos.TransitionRequest;
import com.businessgateways.hrats.dto.ApplicationDtos.WithdrawRequest;
import com.businessgateways.hrats.security.AuthenticatedUser;
import com.businessgateways.hrats.service.ApplicationService;
import com.businessgateways.hrats.service.AuditService;
import com.businessgateways.hrats.service.ExportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** Applications, stage transitions and the pipeline board. */
@RestController
@RequestMapping("${hrats.api-prefix:/api}/applications")
@Tag(name = "Applications", description = "The twelve-stage recruitment pipeline")
public class ApplicationController {

    private final ApplicationService applications;
    private final ExportService exports;
    private final AuditService audit;

    public ApplicationController(
            ApplicationService applications, ExportService exports, AuditService audit) {
        this.applications = applications;
        this.exports = exports;
        this.audit = audit;
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('application.create.own', 'application.assign')")
    @Operation(summary = "Apply for an opening")
    public ApplicationResponse apply(
            @Valid @RequestBody CreateApplicationRequest request,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return applications.apply(request, caller);
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority("
            + "'application.read.any', 'application.read.assigned', 'application.read.own')")
    @Operation(summary = "List applications visible to the caller")
    public PageResponse<ApplicationSummary> list(
            @Valid PaginationQuery query,
            @RequestParam(required = false) String jobId,
            @RequestParam(required = false) String candidateId,
            @RequestParam(required = false) ApplicationStage stage,
            @RequestParam(required = false) ApplicationStatus status,
            @RequestParam(required = false) String recruiterId,
            @RequestParam(required = false) Boolean overdueOnly,
            @AuthenticationPrincipal AuthenticatedUser caller) {

        return applications.list(
                query, jobId, candidateId, stage, status, recruiterId, overdueOnly, caller);
    }

    @GetMapping("/export")
    @PreAuthorize("hasAuthority('application.export')")
    @Operation(summary = "Export the matching applications as CSV or Excel")
    public ResponseEntity<ByteArrayResource> export(
            @Valid PaginationQuery query,
            @RequestParam(required = false) String jobId,
            @RequestParam(required = false) String candidateId,
            @RequestParam(required = false) ApplicationStage stage,
            @RequestParam(required = false) ApplicationStatus status,
            @RequestParam(required = false) String recruiterId,
            @RequestParam(required = false) Boolean overdueOnly,
            @AuthenticationPrincipal AuthenticatedUser caller) {

        var rows = applications.exportRows(
                query, jobId, candidateId, stage, status, recruiterId, overdueOnly, caller);

        audit.recordSecurityEvent(caller, Constants.Audit.DATA_EXPORTED, "application", null,
                Map.of("rows", rows.size(), "format", query.getFormat()));

        return exports.download(rows, query.getFormat(), "applications", "Applications");
    }

    @GetMapping("/pipeline/{jobId}")
    @PreAuthorize("hasAnyAuthority('application.read.any', 'application.read.assigned')")
    @Operation(summary = "The Kanban pipeline for one requisition")
    public PipelineBoard pipeline(
            @PathVariable String jobId, @AuthenticationPrincipal AuthenticatedUser caller) {
        return applications.pipeline(jobId, caller);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority("
            + "'application.read.any', 'application.read.assigned', 'application.read.own')")
    @Operation(summary = "One application in full")
    public ApplicationResponse get(
            @PathVariable String id, @AuthenticationPrincipal AuthenticatedUser caller) {
        return applications.get(id, caller);
    }

    @GetMapping("/{id}/history")
    @PreAuthorize("hasAnyAuthority("
            + "'application.read.any', 'application.read.assigned', 'application.read.own')")
    @Operation(summary = "Stage and status history, with time spent in each stage")
    public List<StatusHistoryResponse> history(
            @PathVariable String id, @AuthenticationPrincipal AuthenticatedUser caller) {
        return applications.history(id, caller);
    }

    @GetMapping("/{id}/notes")
    @PreAuthorize("hasAnyAuthority("
            + "'application.read.any', 'application.read.assigned', 'application.read.own')")
    @Operation(summary = "Notes on an application; internal notes are staff-only")
    public List<NoteResponse> notes(
            @PathVariable String id, @AuthenticationPrincipal AuthenticatedUser caller) {
        return applications.notes(id, caller);
    }

    @PostMapping("/{id}/notes")
    @PreAuthorize("hasAuthority('application.note.manage')")
    @Operation(summary = "Add a note to an application")
    public NoteResponse addNote(
            @PathVariable String id,
            @Valid @RequestBody NoteRequest request,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return applications.addNote(id, request, caller);
    }

    @PatchMapping("/{id}/transition")
    @PreAuthorize("hasAuthority('application.transition')")
    @Operation(summary = "Move an application to another stage")
    public ApplicationResponse transition(
            @PathVariable String id,
            @Valid @RequestBody TransitionRequest request,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return applications.transition(id, request, caller);
    }

    @PostMapping("/bulk/transition")
    @PreAuthorize("hasAuthority('application.bulk')")
    @Operation(summary = "Move many applications at once; each is reported separately")
    public BulkTransitionResponse bulkTransition(
            @Valid @RequestBody BulkTransitionRequest request,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return applications.bulkTransition(request, caller);
    }

    @PatchMapping("/{id}/withdraw")
    @PreAuthorize("hasAnyAuthority('application.withdraw.own', 'application.transition')")
    @Operation(summary = "Withdraw an application")
    public ApplicationResponse withdraw(
            @PathVariable String id,
            @Valid @RequestBody WithdrawRequest request,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return applications.withdraw(id, request.reason(), caller);
    }

    @PatchMapping("/{id}/assign")
    @PreAuthorize("hasAuthority('application.assign')")
    @Operation(summary = "Assign an application to a recruiter")
    public ApplicationResponse assign(
            @PathVariable String id,
            @Valid @RequestBody AssignRequest request,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return applications.assign(id, request.recruiterId(), caller);
    }
}
