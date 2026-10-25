package com.businessgateways.hrats.domain.entity;

import com.businessgateways.hrats.domain.enums.Enums.UserStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Maps the existing `users` table.
 *
 * Column names are quoted because Prisma created them in camelCase and
 * MySQL on Linux is case-sensitive about identifiers.
 */
@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class User {

    /**
     * Prisma stores UUIDs as CHAR(36) strings rather than binary, so the
     * id is generated in the application to match exactly what the Node
     * backend writes.
     */
    @Id
    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @Column(name = "email", length = 255, nullable = false, unique = true)
    private String email;

    /** Argon2id, in PHC string format. Never serialised to a response. */
    @Column(name = "passwordHash", length = 255, nullable = false)
    private String passwordHash;

    @Column(name = "firstName", length = 100, nullable = false)
    private String firstName;

    @Column(name = "lastName", length = 100, nullable = false)
    private String lastName;

    @Column(name = "phone", length = 30)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, columnDefinition = "enum('PENDING_VERIFICATION','ACTIVE','SUSPENDED','DEACTIVATED')")
    private UserStatus status = UserStatus.PENDING_VERIFICATION;

    @Column(name = "emailVerifiedAt")
    private Instant emailVerifiedAt;

    // ---- MFA ----
    @Column(name = "mfaEnabled", nullable = false)
    private boolean mfaEnabled = false;

    @Column(name = "mfaSecret", length = 255)
    private String mfaSecret;

    /** JSON array of hashed single-use recovery codes. */
    @Column(name = "mfaRecoveryCodes", columnDefinition = "TEXT")
    private String mfaRecoveryCodes;

    // ---- Brute-force protection ----
    @Column(name = "failedLoginCount", nullable = false)
    private int failedLoginCount = 0;

    @Column(name = "lockedUntil")
    private Instant lockedUntil;

    @Column(name = "lastLoginAt")
    private Instant lastLoginAt;

    @Column(name = "lastLoginIp", length = 45)
    private String lastLoginIp;

    // ---- Privacy / retention ----
    @Column(name = "consentGivenAt")
    private Instant consentGivenAt;

    @Column(name = "dataRetentionUntil")
    private Instant dataRetentionUntil;

    @Column(name = "deactivatedAt")
    private Instant deactivatedAt;

    @CreationTimestamp
    @Column(name = "createdAt", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updatedAt", nullable = false)
    private Instant updatedAt;

    /**
     * Eagerly fetched because every authenticated request needs the
     * caller's roles to build their permission set; loading them lazily
     * would add a query per request for no benefit.
     */
    @OneToMany(mappedBy = "user", fetch = FetchType.EAGER, cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<UserRole> userRoles = new LinkedHashSet<>();

    @OneToOne(mappedBy = "user", fetch = FetchType.LAZY)
    private CandidateProfile candidateProfile;

    public String fullName() {
        return firstName + " " + lastName;
    }

    public boolean isLocked() {
        return lockedUntil != null && lockedUntil.isAfter(Instant.now());
    }
}
