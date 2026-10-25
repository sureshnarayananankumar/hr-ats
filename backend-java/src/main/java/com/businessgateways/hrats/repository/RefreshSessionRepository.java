package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.RefreshSession;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/** Data access for {@link RefreshSession}. */
@Repository
public interface RefreshSessionRepository extends JpaRepository<RefreshSession, String> {

    Optional<RefreshSession> findByTokenHash(String tokenHash);

    List<RefreshSession> findByUserIdAndRevokedAtIsNull(String userId);

    List<RefreshSession> findByPreviousId(String previousId);

    @Modifying
    @Query("""
           update RefreshSession s set s.revokedAt = :now, s.revokedReason = :reason
           where s.userId = :userId and s.revokedAt is null
           """)
    int revokeAllForUser(@Param("userId") String userId, @Param("now") Instant now, @Param("reason") String reason);

    @Modifying
    @Query("""
           delete from RefreshSession s where s.expiresAt < :cutoff
           """)
    int deleteExpiredBefore(@Param("cutoff") Instant cutoff);
}
