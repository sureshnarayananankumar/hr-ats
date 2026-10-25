package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.EmailLog;
import com.businessgateways.hrats.domain.enums.Enums.EmailStatus;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Data access for {@link EmailLog}. */
@Repository
public interface EmailLogRepository extends JpaRepository<EmailLog, String> {

    Page<EmailLog> findByStatusOrderByQueuedAtDesc(EmailStatus status, Pageable pageable);

    List<EmailLog> findTop50ByStatusAndAttemptsLessThanOrderByQueuedAtAsc(EmailStatus status, int maxAttempts);
}
