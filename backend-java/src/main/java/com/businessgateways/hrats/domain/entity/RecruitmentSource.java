package com.businessgateways.hrats.domain.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Maps the existing {@code recruitment_sources} table. */
@Entity
@Table(name = "recruitment_sources")
@Getter
@Setter
@NoArgsConstructor
public class RecruitmentSource {

    @Id
    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @Column(name = "name", length = 100, nullable = false, unique = true)
    private String name;

    @Column(name = "category", length = 60)
    private String category;

    @Column(name = "costPerMonth", precision = 12, scale = 2)
    private BigDecimal costPerMonth;

    @Column(name = "isActive")
    private boolean isActive = true;

    @CreationTimestamp
    @Column(name = "createdAt")
    private Instant createdAt;
}
