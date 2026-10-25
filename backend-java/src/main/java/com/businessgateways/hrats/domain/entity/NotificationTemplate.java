package com.businessgateways.hrats.domain.entity;

import com.businessgateways.hrats.domain.enums.Enums.NotificationChannel;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** Maps the existing {@code notification_templates} table. */
@Entity
@Table(name = "notification_templates")
@Getter
@Setter
@NoArgsConstructor
public class NotificationTemplate {

    @Id
    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @Column(name = "key", length = 100, nullable = false, unique = true)
    private String templateKey;

    @Column(name = "name", length = 150, nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel", nullable = false, columnDefinition = "enum('IN_APP','EMAIL','BOTH')")
    private NotificationChannel channel;

    @Column(name = "subject", length = 300, nullable = false)
    private String subject;

    @Column(name = "bodyHtml", nullable = false, columnDefinition = "TEXT")
    private String bodyHtml;

    @Column(name = "bodyText", columnDefinition = "TEXT")
    private String bodyText;

    @Column(name = "variables", columnDefinition = "TEXT")
    private String variables;

    @Column(name = "isActive")
    private boolean isActive = true;

    @CreationTimestamp
    @Column(name = "createdAt")
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updatedAt")
    private Instant updatedAt;
}
