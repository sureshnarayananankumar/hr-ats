package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.LoginAttempt;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Data access for {@link LoginAttempt}. */
@Repository
public interface LoginAttemptRepository extends JpaRepository<LoginAttempt, Long> {

    long countByEmailAndSuccessfulFalseAndCreatedAtAfter(String email, Instant since);

    long countByIpAddressAndSuccessfulFalseAndCreatedAtAfter(String ipAddress, Instant since);

    List<LoginAttempt> findTop20ByEmailOrderByCreatedAtDesc(String email);
}
