package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.RecruitmentSource;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Data access for {@link RecruitmentSource}. */
@Repository
public interface RecruitmentSourceRepository extends JpaRepository<RecruitmentSource, String> {

    Optional<RecruitmentSource> findByNameIgnoreCase(String name);

    List<RecruitmentSource> findByIsActiveTrueOrderByNameAsc();

    List<RecruitmentSource> findAllByOrderByNameAsc();
}
