package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.EmailVerificationToken;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

/** Data access for {@link EmailVerificationToken}. */
@Repository
public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, String> {

    Optional<EmailVerificationToken> findByTokenHash(String tokenHash);

    @Modifying
    void deleteByUserId(String userId);
}
