package com.businessgateways.hrats.domain.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Maps the existing {@code candidate_activities} table. */
@Entity
@Table(name = "candidate_activities")
@Getter
@Setter
@NoArgsConstructor
public class CandidateActivity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "candidateId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String candidateId;

    @Column(name = "activity", length = 120, nullable = false)
    private String activity;

    @Column(name = "detail", columnDefinition = "TEXT")
    private String detail;

    @Column(name = "actorUserId", length = 36, columnDefinition = "CHAR(36)")
    private String actorUserId;

    @CreationTimestamp
    @Column(name = "createdAt")
    private Instant createdAt;
}
