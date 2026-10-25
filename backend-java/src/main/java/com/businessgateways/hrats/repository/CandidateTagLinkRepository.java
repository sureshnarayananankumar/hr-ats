package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.CandidateTagLink;
import com.businessgateways.hrats.domain.entity.CandidateTagLinkId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

/** Data access for {@link CandidateTagLink}. */
@Repository
public interface CandidateTagLinkRepository extends JpaRepository<CandidateTagLink, CandidateTagLinkId> {

    List<CandidateTagLink> findByCandidateId(String candidateId);

    @Modifying
    void deleteByCandidateIdAndTagId(String candidateId, String tagId);
}
