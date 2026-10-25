package com.businessgateways.hrats.domain.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Maps the existing {@code login_attempts} table. */
@Entity
@Table(name = "login_attempts")
@Getter
@Setter
@NoArgsConstructor
public class LoginAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "email", length = 255, nullable = false)
    private String email;

    @Column(name = "ipAddress", length = 45, nullable = false)
    private String ipAddress;

    @Column(name = "successful", nullable = false)
    private boolean successful;

    @Column(name = "reason", length = 100)
    private String reason;

    @Column(name = "userAgent", length = 400)
    private String userAgent;

    @CreationTimestamp
    @Column(name = "createdAt")
    private Instant createdAt;
}
