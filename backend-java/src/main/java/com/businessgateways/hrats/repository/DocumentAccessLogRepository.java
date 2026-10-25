package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.DocumentAccessLog;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Data access for {@link DocumentAccessLog}. */
@Repository
public interface DocumentAccessLogRepository extends JpaRepository<DocumentAccessLog, Long> {

    List<DocumentAccessLog> findTop100ByDocumentIdOrderByAccessedAtDesc(String documentId);
}
