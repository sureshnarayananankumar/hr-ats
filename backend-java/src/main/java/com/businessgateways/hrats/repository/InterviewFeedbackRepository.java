package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.InterviewFeedback;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Data access for {@link InterviewFeedback}. */
@Repository
public interface InterviewFeedbackRepository extends JpaRepository<InterviewFeedback, String> {

    List<InterviewFeedback> findByInterviewId(String interviewId);

    Optional<InterviewFeedback> findByInterviewIdAndInterviewerId(String interviewId, String interviewerId);

    List<InterviewFeedback> findByInterviewIdIn(List<String> interviewIds);
}
