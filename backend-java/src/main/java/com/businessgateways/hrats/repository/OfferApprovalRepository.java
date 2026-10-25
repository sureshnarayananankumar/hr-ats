package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.OfferApproval;
import com.businessgateways.hrats.domain.enums.Enums.ApprovalDecision;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Data access for {@link OfferApproval}. */
@Repository
public interface OfferApprovalRepository extends JpaRepository<OfferApproval, String> {

    List<OfferApproval> findByOfferIdOrderBySequenceAsc(String offerId);

    long countByOfferIdAndDecision(String offerId, ApprovalDecision decision);
}
