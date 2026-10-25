package com.businessgateways.hrats.domain.entity;

import com.businessgateways.hrats.domain.enums.Enums.OfferStatus;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Maps the existing {@code offer_history} table. */
@Entity
@Table(name = "offer_history")
@Getter
@Setter
@NoArgsConstructor
public class OfferHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "offerId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String offerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "fromStatus", columnDefinition = "enum('DRAFT','PENDING_APPROVAL','APPROVED','SENT','ACCEPTED','DECLINED','EXPIRED','WITHDRAWN')")
    private OfferStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "toStatus", nullable = false, columnDefinition = "enum('DRAFT','PENDING_APPROVAL','APPROVED','SENT','ACCEPTED','DECLINED','EXPIRED','WITHDRAWN')")
    private OfferStatus toStatus;

    @Column(name = "changedById", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String changedById;

    @Column(name = "reason", length = 500)
    private String reason;

    @CreationTimestamp
    @Column(name = "changedAt")
    private Instant changedAt;
}
