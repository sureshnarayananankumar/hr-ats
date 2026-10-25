package com.businessgateways.hrats.domain.entity;

import com.businessgateways.hrats.domain.enums.Enums.ApprovalDecision;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Maps the existing {@code job_approvals} table. */
@Entity
@Table(name = "job_approvals")
@Getter
@Setter
@NoArgsConstructor
public class JobApproval {

    @Id
    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @Column(name = "jobId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String jobId;

    @Column(name = "approverId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String approverId;

    @Column(name = "sequence")
    private int sequence = 1;

    @Enumerated(EnumType.STRING)
    @Column(name = "decision", nullable = false, columnDefinition = "enum('PENDING','APPROVED','REJECTED')")
    private ApprovalDecision decision;

    @Column(name = "comments", columnDefinition = "TEXT")
    private String comments;

    @Column(name = "decidedAt")
    private Instant decidedAt;

    @CreationTimestamp
    @Column(name = "createdAt")
    private Instant createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approverId", insertable = false, updatable = false)
    private User approver;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "jobId", insertable = false, updatable = false)
    private JobRequirement job;
}
