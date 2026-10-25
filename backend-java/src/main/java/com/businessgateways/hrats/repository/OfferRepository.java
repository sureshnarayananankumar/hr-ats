package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.Offer;
import com.businessgateways.hrats.domain.enums.Enums.OfferStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

/** Data access for {@link Offer}. */
@Repository
public interface OfferRepository extends JpaRepository<Offer, String>, JpaSpecificationExecutor<Offer> {

    Optional<Offer> findByOfferCode(String offerCode);

    Optional<Offer> findByApplicationId(String applicationId);

    List<Offer> findByCandidateIdOrderByCreatedAtDesc(String candidateId);

    List<Offer> findByStatusAndExpiresAtBefore(OfferStatus status, Instant cutoff);

    long countByStatus(OfferStatus status);

    Optional<Offer> findFirstByOfferCodeStartingWithOrderByOfferCodeDesc(String prefix);
}
