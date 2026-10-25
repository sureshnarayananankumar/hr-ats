package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.CandidateDocument;
import com.businessgateways.hrats.domain.enums.Enums.DocumentType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Data access for {@link CandidateDocument}. */
@Repository
public interface CandidateDocumentRepository extends JpaRepository<CandidateDocument, String> {

    List<CandidateDocument> findByCandidateIdAndDeletedAtIsNullOrderByUploadedAtDesc(String candidateId);

    Optional<CandidateDocument> findByIdAndDeletedAtIsNull(String id);

    Optional<CandidateDocument> findFirstByCandidateIdAndDocumentTypeAndIsCurrentTrueAndDeletedAtIsNull(String candidateId, DocumentType documentType);

    Optional<CandidateDocument> findFirstByChecksumAndCandidateIdAndDeletedAtIsNull(String checksum, String candidateId);
}
