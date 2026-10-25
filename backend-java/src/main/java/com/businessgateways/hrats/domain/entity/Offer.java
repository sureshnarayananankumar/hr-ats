package com.businessgateways.hrats.domain.entity;

import com.businessgateways.hrats.domain.enums.Enums.OfferStatus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** Maps the existing {@code offers} table. */
@Entity
@Table(name = "offers")
@Getter
@Setter
@NoArgsConstructor
public class Offer {

    @Id
    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @Column(name = "offerCode", length = 30, nullable = false, unique = true)
    private String offerCode;

    @Column(name = "applicationId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String applicationId;

    @Column(name = "candidateId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String candidateId;

    @Column(name = "jobId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String jobId;

    @Column(name = "proposedDesignation", length = 150, nullable = false)
    private String proposedDesignation;

    @Column(name = "departmentName", length = 150)
    private String departmentName;

    @Column(name = "annualSalary", precision = 14, scale = 2, nullable = false)
    private BigDecimal annualSalary;

    @Column(name = "currency", length = 3)
    private String currency = "USD";

    @Column(name = "bonus", precision = 14, scale = 2)
    private BigDecimal bonus;

    @Column(name = "benefits", columnDefinition = "TEXT")
    private String benefits;

    @Column(name = "joiningDate", nullable = false)
    private Instant joiningDate;

    @Column(name = "issuedAt")
    private Instant issuedAt;

    @Column(name = "expiresAt")
    private Instant expiresAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, columnDefinition = "enum('DRAFT','PENDING_APPROVAL','APPROVED','SENT','ACCEPTED','DECLINED','EXPIRED','WITHDRAWN')")
    private OfferStatus status;

    @Column(name = "declineReason", length = 500)
    private String declineReason;

    @Column(name = "withdrawReason", length = 500)
    private String withdrawReason;

    @Column(name = "respondedAt")
    private Instant respondedAt;

    @Column(name = "offerDocumentKey", length = 255)
    private String offerDocumentKey;

    @Column(name = "createdById", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String createdById;

    @Column(name = "revision")
    private int revision = 1;

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
    @JoinColumn(name = "createdById", insertable = false, updatable = false)
    private User createdBy;
}
