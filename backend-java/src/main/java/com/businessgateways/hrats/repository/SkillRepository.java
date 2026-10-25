package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.Skill;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Data access for {@link Skill}. */
@Repository
public interface SkillRepository extends JpaRepository<Skill, String> {

    Optional<Skill> findByNameIgnoreCase(String name);

    List<Skill> findTop20ByNameContainingIgnoreCaseOrderByNameAsc(String term);

    List<Skill> findAllByOrderByNameAsc();
}
