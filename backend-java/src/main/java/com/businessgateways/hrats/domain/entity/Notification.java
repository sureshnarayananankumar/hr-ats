package com.businessgateways.hrats.domain.entity;

import com.businessgateways.hrats.domain.enums.Enums.NotificationChannel;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Maps the existing {@code notifications} table. */
@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
public class Notification {

    @Id
    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @Column(name = "userId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String userId;

    @Column(name = "templateId", length = 36, columnDefinition = "CHAR(36)")
    private String templateId;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel", nullable = false, columnDefinition = "enum('IN_APP','EMAIL','BOTH')")
    private NotificationChannel channel;

    @Column(name = "title", length = 300, nullable = false)
    private String title;

    @Column(name = "body", nullable = false, columnDefinition = "TEXT")
    private String body;

    @Column(name = "link", length = 400)
    private String link;

    @Column(name = "category", length = 60)
    private String category;

    @Column(name = "readAt")
    private Instant readAt;

    @CreationTimestamp
    @Column(name = "createdAt")
    private Instant createdAt;
}
