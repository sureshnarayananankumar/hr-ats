package com.businessgateways.hrats.controller;

import com.businessgateways.hrats.common.ApiException;
import com.businessgateways.hrats.common.dto.PageResponse;
import com.businessgateways.hrats.common.dto.PaginationQuery;
import com.businessgateways.hrats.domain.entity.JobRequirement;
import com.businessgateways.hrats.domain.enums.Enums.EmploymentType;
import com.businessgateways.hrats.domain.enums.Enums.JobStatus;
import com.businessgateways.hrats.domain.enums.Enums.WorkMode;
import com.businessgateways.hrats.dto.JobDtos.PublicJobResponse;
import com.businessgateways.hrats.repository.DepartmentRepository;
import com.businessgateways.hrats.repository.JobRequirementRepository;
import com.businessgateways.hrats.repository.JobSkillRepository;
import com.businessgateways.hrats.repository.RecruitmentSourceRepository;
import com.businessgateways.hrats.service.RateLimiter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.persistence.criteria.Predicate;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * The public careers portal. No authentication.
 *
 * Every response here is built from {@link PublicJobResponse}, which
 * has no field for internal notes, salary confidentiality, the
 * recruiter, or anything else about how the requisition is being run.
 * The listing is also restricted to PUBLISHED requisitions whose
 * deadline has not passed, so a draft or a cancelled role is never
 * reachable even by guessing its slug.
 */
@RestController
@RequestMapping("${hrats.api-prefix:/api}/public")
@Tag(name = "Careers Portal", description = "Public, unauthenticated job browsing")
public class PublicController {

    private final JobRequirementRepository jobs;
    private final JobSkillRepository jobSkills;
    private final DepartmentRepository departments;
    private final RecruitmentSourceRepository sources;
    private final RateLimiter rateLimiter;

    public PublicController(
            JobRequirementRepository jobs,
            JobSkillRepository jobSkills,
            DepartmentRepository departments,
            RecruitmentSourceRepository sources,
            RateLimiter rateLimiter) {
        this.jobs = jobs;
        this.jobSkills = jobSkills;
        this.departments = departments;
        this.sources = sources;
        this.rateLimiter = rateLimiter;
    }

    @GetMapping("/jobs")
    @Operation(summary = "Browse published openings")
    public ResponseEntity<PageResponse<PublicJobResponse>> listJobs(
            @Valid PaginationQuery query,
            @RequestParam(required = false) String departmentId,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) EmploymentType employmentType,
            @RequestParam(required = false) WorkMode workMode,
            @RequestParam(required = false) Integer maxExperience,
            HttpServletRequest http) {

        rateLimiter.check("public", http, rateLimiter.publicLimit());

        var page = jobs.findAll(
                publiclyVisible(query, departmentId, location, employmentType, workMode, maxExperience),
                query.pageable(List.of("publishedAt", "title", "applicationDeadline"), "publishedAt"));

        return ResponseEntity.ok()
                // A short cache takes the edge off a listing that every
                // visitor loads, without making a new posting wait.
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(2)).cachePublic())
                .body(PageResponse.from(page, this::toPublicResponse));
    }

    @GetMapping("/jobs/{slug}")
    @Operation(summary = "One published opening, by its slug")
    public ResponseEntity<PublicJobResponse> getJob(
            @PathVariable String slug, HttpServletRequest http) {

        rateLimiter.check("public", http, rateLimiter.publicLimit());

        JobRequirement job = jobs.findBySlug(slug)
                .filter(this::isPubliclyVisible)
                .orElseThrow(() -> ApiException.notFound("That opening is no longer listed"));

        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(2)).cachePublic())
                .body(toPublicResponse(job));
    }

    @GetMapping("/departments")
    @Operation(summary = "Departments that currently have an opening")
    public List<DepartmentOption> departments(HttpServletRequest http) {
        rateLimiter.check("public", http, rateLimiter.publicLimit());

        List<JobRequirement> live = jobs.findAll(publiclyVisible(new PaginationQuery(), null, null, null, null, null));

        return departments.findByIsActiveTrueOrderByNameAsc().stream()
                .map(department -> new DepartmentOption(
                        department.getId(),
                        department.getName(),
                        live.stream().filter(job ->
                                department.getId().equals(job.getDepartmentId())).count()))
                .filter(option -> option.openings() > 0)
                .toList();
    }

    @GetMapping("/locations")
    @Operation(summary = "Locations that currently have an opening")
    public List<String> locations(HttpServletRequest http) {
        rateLimiter.check("public", http, rateLimiter.publicLimit());

        return jobs.findAll(publiclyVisible(new PaginationQuery(), null, null, null, null, null)).stream()
                .map(JobRequirement::getLocation)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
    }

    /**
     * The "how did you hear about us?" options on the application form.
     *
     * Only the id and name are exposed — a source's cost is commercial
     * information and has no business reaching the careers site.
     */
    @GetMapping("/sources")
    @Operation(summary = "Recruitment sources offered on the application form")
    public List<SourceOption> sources(HttpServletRequest http) {
        rateLimiter.check("public", http, rateLimiter.publicLimit());

        return sources.findByIsActiveTrueOrderByNameAsc().stream()
                .map(source -> new SourceOption(source.getId(), source.getName()))
                .toList();
    }

    // -----------------------------------------------------------------

    public record DepartmentOption(String id, String name, long openings) {}

    public record SourceOption(String id, String name) {}

    private Specification<JobRequirement> publiclyVisible(
            PaginationQuery query,
            String departmentId,
            String location,
            EmploymentType employmentType,
            WorkMode workMode,
            Integer maxExperience) {

        return (root, criteria, builder) -> {
            List<Predicate> predicates = new ArrayList<>();

            predicates.add(builder.equal(root.get("status"), JobStatus.PUBLISHED));
            predicates.add(builder.or(
                    builder.isNull(root.get("applicationDeadline")),
                    builder.greaterThanOrEqualTo(root.get("applicationDeadline"), Instant.now())));

            if (departmentId != null && !departmentId.isBlank()) {
                predicates.add(builder.equal(root.get("departmentId"), departmentId));
            }
            if (location != null && !location.isBlank()) {
                predicates.add(builder.like(
                        builder.lower(root.get("location")), "%" + location.toLowerCase() + "%"));
            }
            if (employmentType != null) {
                predicates.add(builder.equal(root.get("employmentType"), employmentType));
            }
            if (workMode != null) {
                predicates.add(builder.equal(root.get("workMode"), workMode));
            }
            if (maxExperience != null) {
                // "Roles I qualify for": the requisition's floor is at
                // or below the experience the visitor entered.
                predicates.add(builder.lessThanOrEqualTo(root.get("minExperience"), maxExperience));
            }

            String term = query.searchTerm();
            if (term != null) {
                String like = "%" + term.toLowerCase() + "%";
                predicates.add(builder.or(
                        builder.like(builder.lower(root.get("title")), like),
                        builder.like(builder.lower(root.get("designation")), like),
                        builder.like(builder.lower(root.get("location")), like)));
            }

            return builder.and(predicates.toArray(new Predicate[0]));
        };
    }

    private boolean isPubliclyVisible(JobRequirement job) {
        return job.getStatus() == JobStatus.PUBLISHED
                && (job.getApplicationDeadline() == null
                    || !job.getApplicationDeadline().isBefore(Instant.now()));
    }

    private PublicJobResponse toPublicResponse(JobRequirement job) {
        List<String> skills = jobSkills.findByJobId(job.getId()).stream()
                .filter(row -> row.getSkill() != null)
                .map(row -> row.getSkill().getName())
                .toList();

        // A confidential band is withheld entirely rather than shown as
        // a range of nulls, which would still hint at its existence.
        boolean showSalary = !job.isSalaryConfidential();

        return new PublicJobResponse(
                job.getId(),
                job.getRequirementCode(),
                job.getTitle(),
                job.getSlug(),
                job.getDescription(),
                job.getResponsibilities(),
                job.getQualifications(),
                job.getDesignation(),
                job.getDepartment() == null ? null : job.getDepartment().getName(),
                job.getLocation(),
                job.getEmploymentType(),
                job.getWorkMode(),
                job.getVacancies(),
                job.getMinExperience(),
                job.getMaxExperience(),
                showSalary ? job.getSalaryMin() : null,
                showSalary ? job.getSalaryMax() : null,
                showSalary ? job.getSalaryCurrency() : null,
                skills,
                job.getPublishedAt(),
                job.getApplicationDeadline());
    }
}
