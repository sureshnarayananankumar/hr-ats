package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.AuditLog;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

/** Data access for {@link AuditLog}. */
@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long>, JpaSpecificationExecutor<AuditLog> {

    Page<AuditLog> findByActorUserIdOrderByCreatedAtDesc(String actorUserId, Pageable pageable);

    List<AuditLog> findTop100ByEntityTypeAndEntityIdOrderByCreatedAtDesc(String entityType, String entityId);
}
