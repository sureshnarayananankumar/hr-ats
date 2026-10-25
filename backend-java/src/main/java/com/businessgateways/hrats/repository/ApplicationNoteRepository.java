package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.ApplicationNote;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Data access for {@link ApplicationNote}. */
@Repository
public interface ApplicationNoteRepository extends JpaRepository<ApplicationNote, String> {

    List<ApplicationNote> findByApplicationIdOrderByCreatedAtDesc(String applicationId);
}
