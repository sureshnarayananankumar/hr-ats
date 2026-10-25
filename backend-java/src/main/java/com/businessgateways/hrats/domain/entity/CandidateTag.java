package com.businessgateways.hrats.domain.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Maps the existing {@code candidate_tags} table. */
@Entity
@Table(name = "candidate_tags")
@Getter
@Setter
@NoArgsConstructor
public class CandidateTag {

    @Id
    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @Column(name = "name", length = 60, nullable = false, unique = true)
    private String name;

    @Column(name = "colour", length = 9)
    private String colour = "#64748b";

    @CreationTimestamp
    @Column(name = "createdAt")
    private Instant createdAt;
}
