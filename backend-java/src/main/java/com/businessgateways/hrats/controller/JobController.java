package com.businessgateways.hrats.controller;

import com.businessgateways.hrats.common.dto.PageResponse;
import com.businessgateways.hrats.common.dto.PaginationQuery;
import com.businessgateways.hrats.domain.enums.Enums.JobStatus;
import com.businessgateways.hrats.domain.enums.Enums.Priority;
import com.businessgateways.hrats.dto.JobDtos.ApprovalRequest;
import com.businessgateways.hrats.dto.JobDtos.ApprovalResponse;
import com.businessgateways.hrats.dto.JobDtos.AssignRecruiterRequest;
import com.businessgateways.hrats.dto.JobDtos.JobHistoryResponse;
import com.businessgateways.hrats.dto.JobDtos.JobResponse;
import com.businessgateways.hrats.dto.JobDtos.JobSummary;
import com.businessgateways.hrats.dto.JobDtos.StatusChangeRequest;
import com.businessgateways.hrats.dto.JobDtos.UpsertJobRequest;
import com.businessgateways.hrats.security.AuthenticatedUser;
import com.businessgateways.hrats.service.AuditService;
import com.businessgateways.hrats.service.ExportService;
import com.businessgateways.hrats.service.JobService;
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

/**
 * Job requirements.
 *
 * Authorization is declared per-operation with a permission key. A
 * reader who holds only {@code job.read.assigned} still reaches the
 * list endpoint, and {@link JobService} narrows the result to the
 * requisitions they are on — the permission decides reachability, the
 * service decides scope.
 */
@RestController
@RequestMapping("${hrats.api-prefix:/api}/jobs")
@Tag(name = "Job Requirements", description = "Requisitions, approvals and publication")
public class JobController {

    private final JobService jobs;
    private final ExportService exports;
    private final AuditService audit;

    public JobController(JobService jobs, ExportService exports, AuditService audit) {
        this.jobs = jobs;
        this.exports = exports;
        this.audit = audit;
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('job.read.any', 'job.read.assigned')")
    @Operation(summary = "List job requirements visible to the caller")
    public PageResponse<JobSummary> list(
            @Valid PaginationQuery query,
            @RequestParam(required = false) JobStatus status,
            @RequestParam(required = false) String departmentId,
            @RequestParam(required = false) Priority priority,
            @RequestParam(required = false) String recruiterId,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return jobs.list(query, status, departmentId, priority, recruiterId, caller);
    }

    @GetMapping("/pending-approvals")
    @PreAuthorize("hasAuthority('job.approve')")
    @Operation(summary = "Requisitions awaiting the caller's approval")
    public List<ApprovalResponse> pendingApprovals(@AuthenticationPrincipal AuthenticatedUser caller) {
        return jobs.pendingApprovals(caller);
    }

    @GetMapping("/export")
    @PreAuthorize("hasAuthority('job.export')")
    @Operation(summary = "Export the matching requisitions as CSV or Excel")
    public ResponseEntity<ByteArrayResource> export(
            @Valid PaginationQuery query,
            @RequestParam(required = false) JobStatus status,
            @RequestParam(required = false) String departmentId,
            @RequestParam(required = false) Priority priority,
            @RequestParam(required = false) String recruiterId,
            @AuthenticationPrincipal AuthenticatedUser caller) {

        var rows = jobs.exportRows(query, status, departmentId, priority, recruiterId, caller);
        audit.record(caller, com.businessgateways.hrats.common.Constants.Audit.DATA_EXPORTED,
                "job", null, java.util.Map.of("rows", rows.size(), "format", query.getFormat()));

        return exports.download(rows, query.getFormat(), "job-requirements", "Requisitions");
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('job.read.any', 'job.read.assigned')")
    @Operation(summary = "One job requirement in full")
    public JobResponse get(
            @PathVariable String id, @AuthenticationPrincipal AuthenticatedUser caller) {
        return jobs.get(id, caller);
    }

    @GetMapping("/{id}/history")
    @PreAuthorize("hasAnyAuthority('job.read.any', 'job.read.assigned')")
    @Operation(summary = "Field-level change history for a requisition")
    public List<JobHistoryResponse> history(
            @PathVariable String id, @AuthenticationPrincipal AuthenticatedUser caller) {
        return jobs.history(id, caller);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('job.create')")
    @Operation(summary = "Create a requisition in DRAFT")
    public JobResponse create(
            @Valid @RequestBody UpsertJobRequest request,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return jobs.create(request, caller);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAuthority('job.update')")
    @Operation(summary = "Update a requisition that is not yet closed")
    public JobResponse update(
            @PathVariable String id,
            @Valid @RequestBody UpsertJobRequest request,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return jobs.update(id, request, caller);
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize("hasAuthority('job.submit')")
    @Operation(summary = "Submit a draft requisition for approval")
    public JobResponse submit(
            @PathVariable String id, @AuthenticationPrincipal AuthenticatedUser caller) {
        return jobs.submitForApproval(id, caller);
    }

    @PostMapping("/{id}/approval")
    @PreAuthorize("hasAuthority('job.approve')")
    @Operation(summary = "Approve or reject a requisition awaiting approval")
    public JobResponse decide(
            @PathVariable String id,
            @Valid @RequestBody ApprovalRequest request,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return jobs.decideApproval(id, request, caller);
    }

    /**
     * The specific permission is checked in the service, because which
     * one applies depends on the target status in the body.
     */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyAuthority("
            + "'job.publish', 'job.hold', 'job.close', 'job.cancel', 'job.update', 'job.approve')")
    @Operation(summary = "Move a requisition to another status")
    public JobResponse changeStatus(
            @PathVariable String id,
            @Valid @RequestBody StatusChangeRequest request,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return jobs.changeStatus(id, request, caller);
    }

    @PostMapping("/{id}/duplicate")
    @PreAuthorize("hasAuthority('job.duplicate')")
    @Operation(summary = "Copy a requisition into a new draft")
    public JobResponse duplicate(
            @PathVariable String id, @AuthenticationPrincipal AuthenticatedUser caller) {
        return jobs.duplicate(id, caller);
    }

    @PatchMapping("/{id}/recruiter")
    @PreAuthorize("hasAuthority('job.assign_recruiter')")
    @Operation(summary = "Assign the recruiter and hiring manager")
    public JobResponse assign(
            @PathVariable String id,
            @Valid @RequestBody AssignRecruiterRequest request,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return jobs.assignRecruiter(id, request, caller);
    }
}
