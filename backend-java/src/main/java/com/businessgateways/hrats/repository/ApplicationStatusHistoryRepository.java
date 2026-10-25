package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.ApplicationStatusHistory;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

/** Data access for {@link ApplicationStatusHistory}. */
@Repository
public interface ApplicationStatusHistoryRepository extends JpaRepository<ApplicationStatusHistory, Long> {

    List<ApplicationStatusHistory> findByApplicationIdOrderByChangedAtAsc(String applicationId);

    @Query("""
           select h.toStage, avg(h.durationSeconds) from ApplicationStatusHistory h
           where h.durationSeconds is not null
           group by h.toStage
           """)
    List<Object[]> averageSecondsPerStage();
}
