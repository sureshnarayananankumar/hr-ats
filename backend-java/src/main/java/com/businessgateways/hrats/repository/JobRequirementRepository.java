package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.JobRequirement;
import com.businessgateways.hrats.domain.enums.Enums.JobStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

/** Data access for {@link JobRequirement}. */
@Repository
public interface JobRequirementRepository extends JpaRepository<JobRequirement, String>, JpaSpecificationExecutor<JobRequirement> {

    Optional<JobRequirement> findBySlug(String slug);

    Optional<JobRequirement> findByRequirementCode(String requirementCode);

    boolean existsBySlug(String slug);

    long countByStatus(JobStatus status);

    List<JobRequirement> findByStatusAndApplicationDeadlineBefore(JobStatus status, Instant cutoff);

    Optional<JobRequirement> findFirstByRequirementCodeStartingWithOrderByRequirementCodeDesc(String prefix);
}
