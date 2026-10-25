package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.CandidateNote;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Data access for {@link CandidateNote}. */
@Repository
public interface CandidateNoteRepository extends JpaRepository<CandidateNote, String> {

    Page<CandidateNote> findByCandidateIdOrderByCreatedAtDesc(String candidateId, Pageable pageable);
}
