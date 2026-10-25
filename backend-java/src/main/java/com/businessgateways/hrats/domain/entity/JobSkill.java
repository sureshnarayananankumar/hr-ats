package com.businessgateways.hrats.domain.entity;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Maps the existing {@code job_skills} table. */
@Entity
@Table(name = "job_skills")
@Getter
@Setter
@NoArgsConstructor
public class JobSkill {

    @Id
    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @Column(name = "jobId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String jobId;

    @Column(name = "skillId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String skillId;

    @Column(name = "isRequired")
    private boolean isRequired = true;

    @Column(name = "minYears")
    private Integer minYears;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "skillId", insertable = false, updatable = false)
    private Skill skill;
}
