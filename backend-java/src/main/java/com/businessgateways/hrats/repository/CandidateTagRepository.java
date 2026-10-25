package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.CandidateTag;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Data access for {@link CandidateTag}. */
@Repository
public interface CandidateTagRepository extends JpaRepository<CandidateTag, String> {

    Optional<CandidateTag> findByNameIgnoreCase(String name);

    List<CandidateTag> findAllByOrderByNameAsc();
}
