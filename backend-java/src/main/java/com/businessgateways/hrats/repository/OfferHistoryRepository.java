package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.OfferHistory;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Data access for {@link OfferHistory}. */
@Repository
public interface OfferHistoryRepository extends JpaRepository<OfferHistory, Long> {

    List<OfferHistory> findByOfferIdOrderByChangedAtAsc(String offerId);
}
