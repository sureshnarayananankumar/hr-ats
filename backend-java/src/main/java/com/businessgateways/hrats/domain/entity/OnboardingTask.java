package com.businessgateways.hrats.domain.entity;

import com.businessgateways.hrats.domain.enums.Enums.TaskStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** Maps the existing {@code onboarding_tasks} table. */
@Entity
@Table(name = "onboarding_tasks")
@Getter
@Setter
@NoArgsConstructor
public class OnboardingTask {

    @Id
    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @Column(name = "onboardingId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String onboardingId;

    @Column(name = "title", length = 200, nullable = false)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "category", length = 60)
    private String category;

    @Column(name = "ownerUserId", length = 36, columnDefinition = "CHAR(36)")
    private String ownerUserId;

    @Column(name = "dueDate")
    private Instant dueDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, columnDefinition = "enum('PENDING','IN_PROGRESS','COMPLETED','BLOCKED','CANCELLED')")
    private TaskStatus status;

    @Column(name = "completedAt")
    private Instant completedAt;

    @Column(name = "sequence")
    private int sequence = 0;

    @Column(name = "isMandatory")
    private boolean isMandatory = true;

    @CreationTimestamp
    @Column(name = "createdAt")
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updatedAt")
    private Instant updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ownerUserId", insertable = false, updatable = false)
    private User owner;
}
