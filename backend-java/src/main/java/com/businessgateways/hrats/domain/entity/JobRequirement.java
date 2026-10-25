package com.businessgateways.hrats.domain.entity;

import com.businessgateways.hrats.domain.enums.Enums.EmploymentType;
import com.businessgateways.hrats.domain.enums.Enums.JobStatus;
import com.businessgateways.hrats.domain.enums.Enums.Priority;
import com.businessgateways.hrats.domain.enums.Enums.WorkMode;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** Maps the existing {@code job_requirements} table. */
@Entity
@Table(name = "job_requirements")
@Getter
@Setter
@NoArgsConstructor
public class JobRequirement {

    @Id
    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @Column(name = "requirementCode", length = 30, nullable = false, unique = true)
    private String requirementCode;

    @Column(name = "title", length = 200, nullable = false)
    private String title;

    @Column(name = "slug", length = 250, nullable = false, unique = true)
    private String slug;

    @Column(name = "description", nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(name = "responsibilities", columnDefinition = "TEXT")
    private String responsibilities;

    @Column(name = "qualifications", columnDefinition = "TEXT")
    private String qualifications;

    @Column(name = "internalNotes", columnDefinition = "TEXT")
    private String internalNotes;

    @Column(name = "minExperience")
    private int minExperience = 0;

    @Column(name = "maxExperience")
    private Integer maxExperience;

    @Column(name = "departmentId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String departmentId;

    @Column(name = "designation", length = 150, nullable = false)
    private String designation;

    @Column(name = "vacancies")
    private int vacancies = 1;

    @Column(name = "vacanciesFilled")
    private int vacanciesFilled = 0;

    @Enumerated(EnumType.STRING)
    @Column(name = "employmentType", nullable = false, columnDefinition = "enum('FULL_TIME','PART_TIME','CONTRACT','TEMPORARY','INTERNSHIP','FREELANCE')")
    private EmploymentType employmentType;

    @Enumerated(EnumType.STRING)
    @Column(name = "workMode", nullable = false, columnDefinition = "enum('ONSITE','REMOTE','HYBRID')")
    private WorkMode workMode;

    @Column(name = "location", length = 200, nullable = false)
    private String location;

    @Column(name = "salaryMin", precision = 14, scale = 2)
    private BigDecimal salaryMin;

    @Column(name = "salaryMax", precision = 14, scale = 2)
    private BigDecimal salaryMax;

    @Column(name = "salaryCurrency", length = 3)
    private String salaryCurrency = "USD";

    @Column(name = "salaryConfidential")
    private boolean salaryConfidential = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "priority", nullable = false, columnDefinition = "enum('LOW','MEDIUM','HIGH','CRITICAL')")
    private Priority priority;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, columnDefinition = "enum('DRAFT','PENDING_APPROVAL','APPROVED','PUBLISHED','ON_HOLD','CLOSED','CANCELLED')")
    private JobStatus status;

    @Column(name = "requestedById", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String requestedById;

    @Column(name = "requestDate", nullable = false)
    private Instant requestDate;

    @Column(name = "recruiterId", length = 36, columnDefinition = "CHAR(36)")
    private String recruiterId;

    @Column(name = "hiringManagerId", length = 36, columnDefinition = "CHAR(36)")
    private String hiringManagerId;

    @Column(name = "createdById", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String createdById;

    @Column(name = "publishedAt")
    private Instant publishedAt;

    @Column(name = "applicationDeadline")
    private Instant applicationDeadline;

    @Column(name = "closedAt")
    private Instant closedAt;

    @Column(name = "onHoldReason", length = 500)
    private String onHoldReason;

    @Column(name = "cancelReason", length = 500)
    private String cancelReason;

    @Column(name = "duplicatedFromId", length = 36, columnDefinition = "CHAR(36)")
    private String duplicatedFromId;

    @CreationTimestamp
    @Column(name = "createdAt")
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updatedAt")
    private Instant updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "departmentId", insertable = false, updatable = false)
    private Department department;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recruiterId", insertable = false, updatable = false)
    private User recruiter;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hiringManagerId", insertable = false, updatable = false)
    private User hiringManager;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requestedById", insertable = false, updatable = false)
    private User requestedBy;
}
