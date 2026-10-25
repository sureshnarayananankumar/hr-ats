package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.NotificationTemplate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Data access for {@link NotificationTemplate}. */
@Repository
public interface NotificationTemplateRepository extends JpaRepository<NotificationTemplate, String> {

    Optional<NotificationTemplate> findByTemplateKey(String templateKey);

    List<NotificationTemplate> findByIsActiveTrue();
}
