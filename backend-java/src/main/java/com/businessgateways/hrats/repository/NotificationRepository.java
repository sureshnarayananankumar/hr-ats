package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.Notification;
import java.time.Instant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/** Data access for {@link Notification}. */
@Repository
public interface NotificationRepository extends JpaRepository<Notification, String> {

    Page<Notification> findByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);

    long countByUserIdAndReadAtIsNull(String userId);

    @Modifying
    @Query("""
           update Notification n set n.readAt = :now
           where n.userId = :userId and n.readAt is null
           """)
    int markAllRead(@Param("userId") String userId, @Param("now") Instant now);
}
