package com.businessgateways.hrats.domain.entity;

import com.businessgateways.hrats.domain.enums.Enums.Recommendation;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** Maps the existing {@code interview_feedback} table. */
@Entity
@Table(name = "interview_feedback")
@Getter
@Setter
@NoArgsConstructor
public class InterviewFeedback {

    @Id
    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @Column(name = "interviewId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String interviewId;

    @Column(name = "interviewerId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String interviewerId;

    @Column(name = "technicalSkills")
    private Integer technicalSkills;

    @Column(name = "communication")
    private Integer communication;

    @Column(name = "problemSolving")
    private Integer problemSolving;

    @Column(name = "relevantExperience")
    private Integer relevantExperience;

    @Column(name = "roleSuitability")
    private Integer roleSuitability;

    @Column(name = "teamCollaboration")
    private Integer teamCollaboration;

    @Column(name = "overallRating", nullable = false)
    private int overallRating;

    @Column(name = "strengths", columnDefinition = "TEXT")
    private String strengths;

    @Column(name = "areasForImprovement", columnDefinition = "TEXT")
    private String areasForImprovement;

    @Column(name = "comments", columnDefinition = "TEXT")
    private String comments;

    @Enumerated(EnumType.STRING)
    @Column(name = "recommendation", nullable = false, columnDefinition = "enum('STRONG_HIRE','HIRE','HOLD','NO_HIRE')")
    private Recommendation recommendation;

    @CreationTimestamp
    @Column(name = "submittedAt")
    private Instant submittedAt;

    @UpdateTimestamp
    @Column(name = "updatedAt")
    private Instant updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "interviewerId", insertable = false, updatable = false)
    private User interviewer;
}
