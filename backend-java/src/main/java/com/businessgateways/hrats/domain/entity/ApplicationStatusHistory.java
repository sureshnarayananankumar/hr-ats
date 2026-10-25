package com.businessgateways.hrats.domain.entity;

import com.businessgateways.hrats.domain.enums.Enums.ApplicationStage;
import com.businessgateways.hrats.domain.enums.Enums.ApplicationStatus;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Maps the existing {@code application_status_history} table. */
@Entity
@Table(name = "application_status_history")
@Getter
@Setter
@NoArgsConstructor
public class ApplicationStatusHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "applicationId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String applicationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "fromStage", columnDefinition = "enum('APPLIED','RESUME_SCREENING','HR_SCREENING','SHORTLISTED','ASSESSMENT','TECHNICAL_INTERVIEW','HR_INTERVIEW','FINAL_INTERVIEW','SELECTED','OFFER_RELEASED','OFFER_ACCEPTED','HIRED')")
    private ApplicationStage fromStage;

    @Enumerated(EnumType.STRING)
    @Column(name = "toStage", nullable = false, columnDefinition = "enum('APPLIED','RESUME_SCREENING','HR_SCREENING','SHORTLISTED','ASSESSMENT','TECHNICAL_INTERVIEW','HR_INTERVIEW','FINAL_INTERVIEW','SELECTED','OFFER_RELEASED','OFFER_ACCEPTED','HIRED')")
    private ApplicationStage toStage;

    @Enumerated(EnumType.STRING)
    @Column(name = "fromStatus", columnDefinition = "enum('ACTIVE','ON_HOLD','REJECTED','WITHDRAWN','OFFER_DECLINED','HIRED')")
    private ApplicationStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "toStatus", nullable = false, columnDefinition = "enum('ACTIVE','ON_HOLD','REJECTED','WITHDRAWN','OFFER_DECLINED','HIRED')")
    private ApplicationStatus toStatus;

    @Column(name = "changedById", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String changedById;

    @Column(name = "reason", length = 500)
    private String reason;

    @Column(name = "durationSeconds")
    private Integer durationSeconds;

    @CreationTimestamp
    @Column(name = "changedAt")
    private Instant changedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changedById", insertable = false, updatable = false)
    private User changedBy;
}
