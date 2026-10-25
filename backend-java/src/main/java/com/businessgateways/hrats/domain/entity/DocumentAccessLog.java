package com.businessgateways.hrats.domain.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Maps the existing {@code document_access_logs} table. */
@Entity
@Table(name = "document_access_logs")
@Getter
@Setter
@NoArgsConstructor
public class DocumentAccessLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "documentId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String documentId;

    @Column(name = "userId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String userId;

    @Column(name = "ipAddress", length = 45)
    private String ipAddress;

    @Column(name = "action", length = 40, nullable = false)
    private String action;

    @CreationTimestamp
    @Column(name = "accessedAt")
    private Instant accessedAt;
}
