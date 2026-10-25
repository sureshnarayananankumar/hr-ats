package com.businessgateways.hrats.domain.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Maps the existing {@code candidate_tag_links} join table. */
@Entity
@Table(name = "candidate_tag_links")
@IdClass(CandidateTagLinkId.class)
@Getter
@Setter
@NoArgsConstructor
public class CandidateTagLink {

    @Id
    @Column(name = "candidateId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String candidateId;

    @Id
    @Column(name = "tagId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String tagId;

    @CreationTimestamp
    @Column(name = "assignedAt")
    private Instant assignedAt;

    @Column(name = "assignedById", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String assignedById;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "tagId", insertable = false, updatable = false)
    private CandidateTag tag;
}
