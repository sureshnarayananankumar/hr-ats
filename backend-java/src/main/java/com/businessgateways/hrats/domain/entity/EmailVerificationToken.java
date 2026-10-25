package com.businessgateways.hrats.domain.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Maps the existing {@code email_verification_tokens} table. */
@Entity
@Table(name = "email_verification_tokens")
@Getter
@Setter
@NoArgsConstructor
public class EmailVerificationToken {

    @Id
    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @Column(name = "userId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String userId;

    @Column(name = "tokenHash", length = 255, nullable = false, unique = true)
    private String tokenHash;

    @Column(name = "expiresAt", nullable = false)
    private Instant expiresAt;

    @Column(name = "usedAt")
    private Instant usedAt;

    @CreationTimestamp
    @Column(name = "createdAt")
    private Instant createdAt;
}
