package com.businessgateways.hrats.domain.entity;

import com.businessgateways.hrats.domain.enums.Enums.OnboardingStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** Maps the existing {@code onboarding_records} table. */
@Entity
@Table(name = "onboarding_records")
@Getter
@Setter
@NoArgsConstructor
public class OnboardingRecord {

    @Id
    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @Column(name = "onboardingCode", length = 30, nullable = false, unique = true)
    private String onboardingCode;

    @Column(name = "applicationId", length = 36, nullable = false, unique = true, columnDefinition = "CHAR(36)")
    private String applicationId;

    @Column(name = "offerId", length = 36, nullable = false, unique = true, columnDefinition = "CHAR(36)")
    private String offerId;

    @Column(name = "candidateId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String candidateId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, columnDefinition = "enum('OFFER_ACCEPTED','PREBOARDING','JOINED','DID_NOT_JOIN')")
    private OnboardingStatus status;

    @Column(name = "joiningDate", nullable = false)
    private Instant joiningDate;

    @Column(name = "actualJoinDate")
    private Instant actualJoinDate;

    @Column(name = "departmentId", length = 36, columnDefinition = "CHAR(36)")
    private String departmentId;

    @Column(name = "designation", length = 150, nullable = false)
    private String designation;

    @Column(name = "reportingManagerId", length = 36, columnDefinition = "CHAR(36)")
    private String reportingManagerId;

    @Column(name = "employeeCode", length = 30, unique = true)
    private String employeeCode;

    @Column(name = "didNotJoinReason", length = 500)
    private String didNotJoinReason;

    @Column(name = "documentsVerified")
    private boolean documentsVerified = false;

    @Column(name = "verifiedAt")
    private Instant verifiedAt;

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
    @JoinColumn(name = "departmentId", insertable = false, updatable = false)
    private Department department;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reportingManagerId", insertable = false, updatable = false)
    private User reportingManager;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "offerId", insertable = false, updatable = false)
    private Offer offer;
}
