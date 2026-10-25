package com.businessgateways.hrats.domain.entity;

import com.businessgateways.hrats.domain.enums.Enums.SkillProficiency;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Maps the existing {@code candidate_skills} table. */
@Entity
@Table(name = "candidate_skills")
@Getter
@Setter
@NoArgsConstructor
public class CandidateSkill {

    @Id
    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @Column(name = "candidateId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String candidateId;

    @Column(name = "skillId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String skillId;

    @Column(name = "years", precision = 4, scale = 1)
    private BigDecimal years;

    @Enumerated(EnumType.STRING)
    @Column(name = "proficiency", nullable = false, columnDefinition = "enum('BEGINNER','INTERMEDIATE','ADVANCED','EXPERT')")
    private SkillProficiency proficiency;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "skillId", insertable = false, updatable = false)
    private Skill skill;
}
