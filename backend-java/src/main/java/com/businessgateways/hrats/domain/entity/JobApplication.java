package com.businessgateways.hrats.domain.entity;

import com.businessgateways.hrats.domain.enums.Enums.ApplicationStage;
import com.businessgateways.hrats.domain.enums.Enums.ApplicationStatus;
import com.businessgateways.hrats.domain.enums.Enums.ScreeningResult;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** Maps the existing {@code job_applications} table. */
@Entity
@Table(name = "job_applications")
@Getter
@Setter
@NoArgsConstructor
public class JobApplication {

    @Id
    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @Column(name = "applicationCode", length = 30, nullable = false, unique = true)
    private String applicationCode;

    @Column(name = "candidateId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String candidateId;

    @Column(name = "jobId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String jobId;

    @Column(name = "activeJobKey", length = 36, columnDefinition = "CHAR(36)")
    private String activeJobKey;

    @Column(name = "appliedAt", nullable = false)
    private Instant appliedAt;

    @Column(name = "resumeDocumentId", length = 36, columnDefinition = "CHAR(36)")
    private String resumeDocumentId;

    @Column(name = "coverLetter", columnDefinition = "TEXT")
    private String coverLetter;

    @Column(name = "sourceId", length = 36, columnDefinition = "CHAR(36)")
    private String sourceId;

    @Column(name = "recruiterId", length = 36, columnDefinition = "CHAR(36)")
    private String recruiterId;

    @Enumerated(EnumType.STRING)
    @Column(name = "currentStage", nullable = false, columnDefinition = "enum('APPLIED','RESUME_SCREENING','HR_SCREENING','SHORTLISTED','ASSESSMENT','TECHNICAL_INTERVIEW','HR_INTERVIEW','FINAL_INTERVIEW','SELECTED','OFFER_RELEASED','OFFER_ACCEPTED','HIRED')")
    private ApplicationStage currentStage;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, columnDefinition = "enum('ACTIVE','ON_HOLD','REJECTED','WITHDRAWN','OFFER_DECLINED','HIRED')")
    private ApplicationStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "screeningResult", nullable = false, columnDefinition = "enum('NOT_SCREENED','PASS','FAIL','ON_HOLD')")
    private ScreeningResult screeningResult;

    @Column(name = "screeningRemarks", columnDefinition = "TEXT")
    private String screeningRemarks;

    @Column(name = "rejectionReason", length = 500)
    private String rejectionReason;

    @Column(name = "withdrawReason", length = 500)
    private String withdrawReason;

    @Column(name = "stageEnteredAt", nullable = false)
    private Instant stageEnteredAt;

    @Column(name = "followUpDueAt")
    private Instant followUpDueAt;

    @UpdateTimestamp
    @Column(name = "lastUpdatedAt")
    private Instant lastUpdatedAt;

    @CreationTimestamp
    @Column(name = "createdAt")
    private Instant createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidateId", insertable = false, updatable = false)
    private CandidateProfile candidate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "jobId", insertable = false, updatable = false)
    private JobRequirement job;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recruiterId", insertable = false, updatable = false)
    private User recruiter;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sourceId", insertable = false, updatable = false)
    private RecruitmentSource source;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resumeDocumentId", insertable = false, updatable = false)
    private CandidateDocument resumeDocument;
}
