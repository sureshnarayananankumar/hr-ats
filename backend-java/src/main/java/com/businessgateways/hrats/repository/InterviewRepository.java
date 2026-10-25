package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.Interview;
import com.businessgateways.hrats.domain.enums.Enums.InterviewStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/** Data access for {@link Interview}. */
@Repository
public interface InterviewRepository extends JpaRepository<Interview, String>, JpaSpecificationExecutor<Interview> {

    Optional<Interview> findByInterviewCode(String interviewCode);

    List<Interview> findByApplicationIdOrderByRoundAsc(String applicationId);

    List<Interview> findByCandidateIdOrderByScheduledStartDesc(String candidateId);

    List<Interview> findByStatusAndScheduledStartBetween(InterviewStatus status, Instant from, Instant to);

    Optional<Interview> findFirstByInterviewCodeStartingWithOrderByInterviewCodeDesc(String prefix);

    @Query("""
           select i from Interview i, InterviewPanelMember p
           where p.interviewId = i.id and p.interviewerId = :interviewerId
             and i.scheduledStart >= :from
           order by i.scheduledStart asc
           """)
    List<Interview> findUpcomingForInterviewer(@Param("interviewerId") String interviewerId, @Param("from") Instant from);

    @Query("""
           select count(i) from Interview i, InterviewPanelMember p
           where p.interviewId = i.id and p.interviewerId = :interviewerId
             and i.status in :liveStatuses
             and i.scheduledStart < :end and i.scheduledEnd > :start
             and i.id <> :excludeId
           """)
    long countConflicts(@Param("interviewerId") String interviewerId, @Param("liveStatuses") List<InterviewStatus> liveStatuses, @Param("start") Instant start, @Param("end") Instant end, @Param("excludeId") String excludeId);
}
