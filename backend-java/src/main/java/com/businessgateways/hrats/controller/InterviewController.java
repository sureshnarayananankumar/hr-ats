package com.businessgateways.hrats.controller;

import com.businessgateways.hrats.common.dto.PageResponse;
import com.businessgateways.hrats.common.dto.PaginationQuery;
import com.businessgateways.hrats.domain.enums.Enums.InterviewStatus;
import com.businessgateways.hrats.domain.enums.Enums.InterviewType;
import com.businessgateways.hrats.dto.InterviewDtos.CalendarEntry;
import com.businessgateways.hrats.dto.InterviewDtos.CancelRequest;
import com.businessgateways.hrats.dto.InterviewDtos.FeedbackRequest;
import com.businessgateways.hrats.dto.InterviewDtos.FeedbackResponse;
import com.businessgateways.hrats.dto.InterviewDtos.InterviewResponse;
import com.businessgateways.hrats.dto.InterviewDtos.PendingFeedbackResponse;
import com.businessgateways.hrats.dto.InterviewDtos.RescheduleRequest;
import com.businessgateways.hrats.dto.InterviewDtos.ScheduleInterviewRequest;
import com.businessgateways.hrats.security.AuthenticatedUser;
import com.businessgateways.hrats.service.InterviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
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

import java.time.Instant;
import java.util.List;

/** Interview scheduling, panels and scorecards. */
@RestController
@RequestMapping("${hrats.api-prefix:/api}/interviews")
@Tag(name = "Interviews", description = "Scheduling, panels and structured feedback")
public class InterviewController {

    private final InterviewService interviews;

    public InterviewController(InterviewService interviews) {
        this.interviews = interviews;
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority("
            + "'interview.read.any', 'interview.read.assigned', 'interview.read.own')")
    @Operation(summary = "List interviews visible to the caller")
    public PageResponse<InterviewResponse> list(
            @Valid PaginationQuery query,
            @RequestParam(required = false) String applicationId,
            @RequestParam(required = false) String candidateId,
            @RequestParam(required = false) String jobId,
            @RequestParam(required = false) InterviewStatus status,
            @RequestParam(required = false) InterviewType interviewType,
            @AuthenticationPrincipal AuthenticatedUser caller) {

        return interviews.list(
                query, applicationId, candidateId, jobId, status, interviewType, caller);
    }

    @GetMapping("/calendar")
    @PreAuthorize("hasAnyAuthority('interview.read.any', 'interview.read.assigned')")
    @Operation(summary = "Interviews in a date range, for the calendar view")
    public List<CalendarEntry> calendar(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(required = false) String interviewerId,
            @AuthenticationPrincipal AuthenticatedUser caller) {

        return interviews.calendar(from, to, interviewerId, caller);
    }

    @GetMapping("/my-pending-feedback")
    @PreAuthorize("hasAuthority('interview.feedback.submit')")
    @Operation(summary = "Interviews the caller sat on but has not written up")
    public List<PendingFeedbackResponse> myPendingFeedback(
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return interviews.myPendingFeedback(caller);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority("
            + "'interview.read.any', 'interview.read.assigned', 'interview.read.own')")
    @Operation(summary = "One interview, with its panel")
    public InterviewResponse get(
            @PathVariable String id, @AuthenticationPrincipal AuthenticatedUser caller) {
        return interviews.get(id, caller);
    }

    @GetMapping("/{id}/feedback")
    @PreAuthorize("hasAnyAuthority('interview.feedback.read.any', 'interview.feedback.submit')")
    @Operation(summary = "Scorecards for an interview")
    public List<FeedbackResponse> feedback(
            @PathVariable String id, @AuthenticationPrincipal AuthenticatedUser caller) {
        return interviews.feedbackFor(id, caller);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('interview.schedule')")
    @Operation(summary = "Schedule an interview and invite the panel")
    public InterviewResponse schedule(
            @Valid @RequestBody ScheduleInterviewRequest request,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return interviews.schedule(request, caller);
    }

    @PatchMapping("/{id}/reschedule")
    @PreAuthorize("hasAuthority('interview.reschedule')")
    @Operation(summary = "Move an interview to a new time")
    public InterviewResponse reschedule(
            @PathVariable String id,
            @Valid @RequestBody RescheduleRequest request,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return interviews.reschedule(id, request, caller);
    }

    @PatchMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('interview.cancel')")
    @Operation(summary = "Cancel an interview")
    public InterviewResponse cancel(
            @PathVariable String id,
            @Valid @RequestBody CancelRequest request,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return interviews.cancel(id, request.reason(), caller);
    }

    @PatchMapping("/{id}/complete")
    @PreAuthorize("hasAnyAuthority('interview.schedule', 'interview.feedback.submit')")
    @Operation(summary = "Mark an interview as held")
    public InterviewResponse complete(
            @PathVariable String id, @AuthenticationPrincipal AuthenticatedUser caller) {
        return interviews.complete(id, caller);
    }

    @PostMapping("/{id}/feedback")
    @PreAuthorize("hasAuthority('interview.feedback.submit')")
    @Operation(summary = "Submit or update your own scorecard")
    public FeedbackResponse submitFeedback(
            @PathVariable String id,
            @Valid @RequestBody FeedbackRequest request,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        return interviews.submitFeedback(id, request, caller);
    }
}
