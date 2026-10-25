package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.JobSkill;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

/** Data access for {@link JobSkill}. */
@Repository
public interface JobSkillRepository extends JpaRepository<JobSkill, String> {

    List<JobSkill> findByJobId(String jobId);

    @Modifying
    void deleteByJobId(String jobId);
}
