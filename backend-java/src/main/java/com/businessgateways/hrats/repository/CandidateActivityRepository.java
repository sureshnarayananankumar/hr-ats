package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.CandidateActivity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Data access for {@link CandidateActivity}. */
@Repository
public interface CandidateActivityRepository extends JpaRepository<CandidateActivity, Long> {

    Page<CandidateActivity> findByCandidateIdOrderByCreatedAtDesc(String candidateId, Pageable pageable);
}
