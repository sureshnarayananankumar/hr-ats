package com.businessgateways.hrats.domain.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Maps the existing {@code interview_panel_members} join table. */
@Entity
@Table(name = "interview_panel_members")
@IdClass(InterviewPanelMemberId.class)
@Getter
@Setter
@NoArgsConstructor
public class InterviewPanelMember {

    @Id
    @Column(name = "interviewId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String interviewId;

    @Id
    @Column(name = "interviewerId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String interviewerId;

    @Column(name = "isLead")
    private boolean isLead = false;

    @CreationTimestamp
    @Column(name = "invitedAt")
    private Instant invitedAt;

    @Column(name = "respondedAt")
    private Instant respondedAt;

    @Column(name = "accepted")
    private Boolean accepted;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "interviewerId", insertable = false, updatable = false)
    private User interviewer;
}
