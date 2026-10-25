package com.businessgateways.hrats.domain.entity;

import com.businessgateways.hrats.domain.enums.Enums.InterviewStatus;
import com.businessgateways.hrats.domain.enums.Enums.InterviewType;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** Maps the existing {@code interviews} table. */
@Entity
@Table(name = "interviews")
@Getter
@Setter
@NoArgsConstructor
public class Interview {

    @Id
    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @Column(name = "interviewCode", length = 30, nullable = false, unique = true)
    private String interviewCode;

    @Column(name = "applicationId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String applicationId;

    @Column(name = "candidateId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String candidateId;

    @Column(name = "jobId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String jobId;

    @Column(name = "round")
    private int round = 1;

    @Column(name = "roundName", length = 100, nullable = false)
    private String roundName;

    @Enumerated(EnumType.STRING)
    @Column(name = "interviewType", nullable = false, columnDefinition = "enum('PHONE','VIDEO','ONSITE','PANEL','ASSESSMENT','TECHNICAL','HR')")
    private InterviewType interviewType;

    @Column(name = "scheduledStart", nullable = false)
    private Instant scheduledStart;

    @Column(name = "scheduledEnd", nullable = false)
    private Instant scheduledEnd;

    @Column(name = "timeZone", length = 60)
    private String timeZone = "UTC";

    @Column(name = "meetingLink", length = 500)
    private String meetingLink;

    @Column(name = "venue", length = 300)
    private String venue;

    @Column(name = "instructions", columnDefinition = "TEXT")
    private String instructions;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, columnDefinition = "enum('SCHEDULED','RESCHEDULED','COMPLETED','CANCELLED','NO_SHOW')")
    private InterviewStatus status;

    @Column(name = "cancelReason", length = 500)
    private String cancelReason;

    @Column(name = "rescheduledFromId", length = 36, columnDefinition = "CHAR(36)")
    private String rescheduledFromId;

    @Column(name = "organiserId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String organiserId;

    @CreationTimestamp
    @Column(name = "createdAt")
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updatedAt")
    private Instant updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidateId", insertable = false, updatable = false)
    private CandidateProfile candidate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "jobId", insertable = false, updatable = false)
    private JobRequirement job;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "applicationId", insertable = false, updatable = false)
    private JobApplication application;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organiserId", insertable = false, updatable = false)
    private User organiser;
}
