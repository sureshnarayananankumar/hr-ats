package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.OnboardingRecord;
import com.businessgateways.hrats.domain.enums.Enums.OnboardingStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

/** Data access for {@link OnboardingRecord}. */
@Repository
public interface OnboardingRecordRepository extends JpaRepository<OnboardingRecord, String>, JpaSpecificationExecutor<OnboardingRecord> {

    Optional<OnboardingRecord> findByOfferId(String offerId);

    Optional<OnboardingRecord> findByApplicationId(String applicationId);

    Optional<OnboardingRecord> findByEmployeeCode(String employeeCode);

    List<OnboardingRecord> findByStatus(OnboardingStatus status);

    List<OnboardingRecord> findByJoiningDateBetween(Instant from, Instant to);

    Optional<OnboardingRecord> findFirstByOnboardingCodeStartingWithOrderByOnboardingCodeDesc(String prefix);
}
