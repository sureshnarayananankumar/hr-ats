package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.InterviewPanelMember;
import com.businessgateways.hrats.domain.entity.InterviewPanelMemberId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

/** Data access for {@link InterviewPanelMember}. */
@Repository
public interface InterviewPanelMemberRepository extends JpaRepository<InterviewPanelMember, InterviewPanelMemberId> {

    List<InterviewPanelMember> findByInterviewId(String interviewId);

    @Modifying
    void deleteByInterviewId(String interviewId);

    boolean existsByInterviewIdAndInterviewerId(String interviewId, String interviewerId);
}
