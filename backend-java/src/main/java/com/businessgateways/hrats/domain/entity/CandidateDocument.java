package com.businessgateways.hrats.domain.entity;

import com.businessgateways.hrats.domain.enums.Enums.DocumentType;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Maps the existing {@code candidate_documents} table. */
@Entity
@Table(name = "candidate_documents")
@Getter
@Setter
@NoArgsConstructor
public class CandidateDocument {

    @Id
    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @Column(name = "candidateId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String candidateId;

    @Enumerated(EnumType.STRING)
    @Column(name = "documentType", nullable = false, columnDefinition = "enum('RESUME','COVER_LETTER','CERTIFICATE','ID_PROOF','EDUCATION_PROOF','EXPERIENCE_LETTER','OFFER_DOCUMENT','OTHER')")
    private DocumentType documentType;

    @Column(name = "originalName", length = 255, nullable = false)
    private String originalName;

    @Column(name = "storageKey", length = 255, nullable = false, unique = true)
    private String storageKey;

    @Column(name = "mimeType", length = 150, nullable = false)
    private String mimeType;

    @Column(name = "sizeBytes", nullable = false)
    private int sizeBytes;

    @Column(name = "checksum", length = 64, nullable = false)
    private String checksum;

    @Column(name = "version")
    private int version = 1;

    @Column(name = "isCurrent")
    private boolean isCurrent = true;

    @Column(name = "supersedesId", length = 36, columnDefinition = "CHAR(36)")
    private String supersedesId;

    @CreationTimestamp
    @Column(name = "uploadedAt")
    private Instant uploadedAt;

    @Column(name = "deletedAt")
    private Instant deletedAt;
}
