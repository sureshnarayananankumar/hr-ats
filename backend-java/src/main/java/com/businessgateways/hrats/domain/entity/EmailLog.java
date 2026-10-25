package com.businessgateways.hrats.domain.entity;

import com.businessgateways.hrats.domain.enums.Enums.EmailStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Maps the existing {@code email_logs} table. */
@Entity
@Table(name = "email_logs")
@Getter
@Setter
@NoArgsConstructor
public class EmailLog {

    @Id
    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @Column(name = "templateId", length = 36, columnDefinition = "CHAR(36)")
    private String templateId;

    @Column(name = "toEmail", length = 255, nullable = false)
    private String toEmail;

    @Column(name = "subject", length = 300, nullable = false)
    private String subject;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, columnDefinition = "enum('QUEUED','SENT','FAILED','BOUNCED')")
    private EmailStatus status;

    @Column(name = "providerId", length = 255)
    private String providerId;

    @Column(name = "errorMessage", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "attempts")
    private int attempts = 0;

    @CreationTimestamp
    @Column(name = "queuedAt")
    private Instant queuedAt;

    @Column(name = "sentAt")
    private Instant sentAt;
}
