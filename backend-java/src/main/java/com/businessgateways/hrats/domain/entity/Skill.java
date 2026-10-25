package com.businessgateways.hrats.domain.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Maps the existing {@code skills} table. */
@Entity
@Table(name = "skills")
@Getter
@Setter
@NoArgsConstructor
public class Skill {

    @Id
    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @Column(name = "name", length = 100, nullable = false, unique = true)
    private String name;

    @Column(name = "category", length = 60)
    private String category;

    @CreationTimestamp
    @Column(name = "createdAt")
    private Instant createdAt;
}
