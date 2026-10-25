package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.CandidateSkill;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

/** Data access for {@link CandidateSkill}. */
@Repository
public interface CandidateSkillRepository extends JpaRepository<CandidateSkill, String> {

    List<CandidateSkill> findByCandidateId(String candidateId);

    @Modifying
    void deleteByCandidateId(String candidateId);
}
