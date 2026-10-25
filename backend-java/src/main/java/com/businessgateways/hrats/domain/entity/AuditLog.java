package com.businessgateways.hrats.domain.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Maps the existing {@code audit_logs} table. */
@Entity
@Table(name = "audit_logs")
@Getter
@Setter
@NoArgsConstructor
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "actorUserId", length = 36, columnDefinition = "CHAR(36)")
    private String actorUserId;

    @Column(name = "actorEmail", length = 255)
    private String actorEmail;

    @Column(name = "action", length = 100, nullable = false)
    private String action;

    @Column(name = "entityType", length = 60)
    private String entityType;

    @Column(name = "entityId", length = 64)
    private String entityId;

    @Column(name = "metadata", columnDefinition = "TEXT")
    private String metadata;

    @Column(name = "ipAddress", length = 45)
    private String ipAddress;

    @Column(name = "userAgent", length = 400)
    private String userAgent;

    @Column(name = "requestId", length = 64)
    private String requestId;

    @Column(name = "severity", length = 20)
    private String severity = "INFO";

    @CreationTimestamp
    @Column(name = "createdAt")
    private Instant createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actorUserId", insertable = false, updatable = false)
    private User actor;
}
