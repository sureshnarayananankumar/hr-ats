package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.JobApplication;
import com.businessgateways.hrats.domain.enums.Enums.ApplicationStage;
import com.businessgateways.hrats.domain.enums.Enums.ApplicationStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/** Data access for {@link JobApplication}. */
@Repository
public interface JobApplicationRepository extends JpaRepository<JobApplication, String>, JpaSpecificationExecutor<JobApplication> {

    Optional<JobApplication> findByApplicationCode(String applicationCode);

    Optional<JobApplication> findByCandidateIdAndActiveJobKey(String candidateId, String activeJobKey);

    List<JobApplication> findByJobId(String jobId);

    List<JobApplication> findByCandidateIdOrderByAppliedAtDesc(String candidateId);

    long countByJobIdAndStatus(String jobId, ApplicationStatus status);

    long countByStatus(ApplicationStatus status);

    Optional<JobApplication> findFirstByApplicationCodeStartingWithOrderByApplicationCodeDesc(String prefix);

    @Query("""
           select a.currentStage, count(a) from JobApplication a
           where a.status = :status and (:jobId is null or a.jobId = :jobId)
           group by a.currentStage
           """)
    List<Object[]> countByStageGrouped(@Param("status") ApplicationStatus status, @Param("jobId") String jobId);

    @Query("""
           select a from JobApplication a
           where a.status = :status and a.followUpDueAt is not null and a.followUpDueAt < :now
           """)
    List<JobApplication> findOverdueFollowUps(@Param("status") ApplicationStatus status, @Param("now") Instant now);

    long countByAppliedAtBetween(Instant from, Instant to);

    @Query("""
           select a.sourceId, count(a) from JobApplication a
           where a.sourceId is not null and a.appliedAt between :from and :to
           group by a.sourceId
           """)
    List<Object[]> countBySourceBetween(@Param("from") Instant from, @Param("to") Instant to);
}
