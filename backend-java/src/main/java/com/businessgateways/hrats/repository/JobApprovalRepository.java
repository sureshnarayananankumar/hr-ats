package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.JobApproval;
import com.businessgateways.hrats.domain.enums.Enums.ApprovalDecision;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Data access for {@link JobApproval}. */
@Repository
public interface JobApprovalRepository extends JpaRepository<JobApproval, String> {

    List<JobApproval> findByJobIdOrderBySequenceAsc(String jobId);

    List<JobApproval> findByApproverIdAndDecisionOrderByCreatedAtDesc(String approverId, ApprovalDecision decision);

    long countByJobIdAndDecision(String jobId, ApprovalDecision decision);
}
