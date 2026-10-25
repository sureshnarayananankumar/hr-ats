package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.JobRequirementHistory;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Data access for {@link JobRequirementHistory}. */
@Repository
public interface JobRequirementHistoryRepository extends JpaRepository<JobRequirementHistory, Long> {

    List<JobRequirementHistory> findByJobIdOrderByChangedAtDesc(String jobId);
}
