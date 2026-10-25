package com.businessgateways.hrats.domain.entity;

import com.businessgateways.hrats.domain.enums.Enums.EmploymentType;
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

/** Maps the existing {@code candidate_profiles} table. */
@Entity
@Table(name = "candidate_profiles")
@Getter
@Setter
@NoArgsConstructor
public class CandidateProfile {

    @Id
    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @Column(name = "candidateCode", length = 30, nullable = false, unique = true)
    private String candidateCode;

    @Column(name = "userId", length = 36, nullable = false, unique = true, columnDefinition = "CHAR(36)")
    private String userId;

    @Column(name = "fullName", length = 200, nullable = false)
    private String fullName;

    @Column(name = "normalisedEmail", length = 255, nullable = false)
    private String normalisedEmail;

    @Column(name = "normalisedPhone", length = 30)
    private String normalisedPhone;

    @Column(name = "mobile", length = 30)
    private String mobile;

    @Column(name = "location", length = 200)
    private String location;

    @Column(name = "totalExperience", precision = 4, scale = 1)
    private BigDecimal totalExperience;

    @Column(name = "currentDesignation", length = 150)
    private String currentDesignation;

    @Column(name = "currentCompany", length = 200)
    private String currentCompany;

    @Column(name = "highestEducation", length = 200)
    private String highestEducation;

    @Column(name = "educationDetails", columnDefinition = "TEXT")
    private String educationDetails;

    @Column(name = "expectedSalary", precision = 14, scale = 2)
    private BigDecimal expectedSalary;

    @Column(name = "currentSalary", precision = 14, scale = 2)
    private BigDecimal currentSalary;

    @Column(name = "salaryCurrency", length = 3)
    private String salaryCurrency = "USD";

    @Column(name = "noticePeriodDays")
    private Integer noticePeriodDays;

    @Column(name = "linkedinUrl", length = 400)
    private String linkedinUrl;

    @Column(name = "portfolioUrl", length = 400)
    private String portfolioUrl;

    @Column(name = "preferredLocation", length = 200)
    private String preferredLocation;

    @Enumerated(EnumType.STRING)
    @Column(name = "preferredWorkMode", columnDefinition = "enum('ONSITE','REMOTE','HYBRID')")
    private WorkMode preferredWorkMode;

    @Enumerated(EnumType.STRING)
    @Column(name = "preferredEmploymentType", columnDefinition = "enum('FULL_TIME','PART_TIME','CONTRACT','TEMPORARY','INTERNSHIP','FREELANCE')")
    private EmploymentType preferredEmploymentType;

    @Column(name = "willingToRelocate")
    private boolean willingToRelocate = false;

    @Column(name = "summary", columnDefinition = "TEXT")
    private String summary;

    @Column(name = "consentToStoreData")
    private boolean consentToStoreData = false;

    @Column(name = "consentAt")
    private Instant consentAt;

    @Column(name = "dataDeletionRequestedAt")
    private Instant dataDeletionRequestedAt;

    @CreationTimestamp
    @Column(name = "createdAt")
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updatedAt")
    private Instant updatedAt;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "userId", insertable = false, updatable = false)
    private User user;
}
