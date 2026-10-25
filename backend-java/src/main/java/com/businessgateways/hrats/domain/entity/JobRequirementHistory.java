package com.businessgateways.hrats.domain.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Maps the existing {@code job_requirement_history} table. */
@Entity
@Table(name = "job_requirement_history")
@Getter
@Setter
@NoArgsConstructor
public class JobRequirementHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "jobId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String jobId;

    @Column(name = "changedById", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String changedById;

    @Column(name = "fieldName", length = 80, nullable = false)
    private String fieldName;

    @Column(name = "oldValue", columnDefinition = "TEXT")
    private String oldValue;

    @Column(name = "newValue", columnDefinition = "TEXT")
    private String newValue;

    @Column(name = "reason", length = 500)
    private String reason;

    @CreationTimestamp
    @Column(name = "changedAt")
    private Instant changedAt;
}
