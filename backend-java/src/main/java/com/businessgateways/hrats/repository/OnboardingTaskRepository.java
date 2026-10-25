package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.OnboardingTask;
import com.businessgateways.hrats.domain.enums.Enums.TaskStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Data access for {@link OnboardingTask}. */
@Repository
public interface OnboardingTaskRepository extends JpaRepository<OnboardingTask, String> {

    List<OnboardingTask> findByOnboardingIdOrderBySequenceAsc(String onboardingId);

    List<OnboardingTask> findByOwnerUserIdAndStatus(String ownerUserId, TaskStatus status);

    long countByOnboardingIdAndStatus(String onboardingId, TaskStatus status);

    long countByOnboardingId(String onboardingId);
}
