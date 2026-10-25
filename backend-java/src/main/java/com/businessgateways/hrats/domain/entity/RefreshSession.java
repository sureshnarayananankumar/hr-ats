package com.businessgateways.hrats.domain.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Maps the existing {@code refresh_sessions} table. */
@Entity
@Table(name = "refresh_sessions")
@Getter
@Setter
@NoArgsConstructor
public class RefreshSession {

    @Id
    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @Column(name = "userId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String userId;

    @Column(name = "tokenHash", length = 255, nullable = false, unique = true)
    private String tokenHash;

    @Column(name = "previousId", length = 36, columnDefinition = "CHAR(36)")
    private String previousId;

    @Column(name = "userAgent", length = 400)
    private String userAgent;

    @Column(name = "ipAddress", length = 45)
    private String ipAddress;

    @Column(name = "expiresAt", nullable = false)
    private Instant expiresAt;

    @Column(name = "revokedAt")
    private Instant revokedAt;

    @Column(name = "revokedReason", length = 200)
    private String revokedReason;

    @CreationTimestamp
    @Column(name = "createdAt")
    private Instant createdAt;
}
