package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.CandidateProfile;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

/** Data access for {@link CandidateProfile}. */
@Repository
public interface CandidateProfileRepository extends JpaRepository<CandidateProfile, String>, JpaSpecificationExecutor<CandidateProfile> {

    Optional<CandidateProfile> findByUserId(String userId);

    Optional<CandidateProfile> findByCandidateCode(String candidateCode);

    Optional<CandidateProfile> findByNormalisedEmail(String normalisedEmail);

    List<CandidateProfile> findByNormalisedPhone(String normalisedPhone);

    List<CandidateProfile> findByDataDeletionRequestedAtIsNotNull();

    Optional<CandidateProfile> findFirstByCandidateCodeStartingWithOrderByCandidateCodeDesc(String prefix);
}
