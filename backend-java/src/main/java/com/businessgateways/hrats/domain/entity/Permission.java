package com.businessgateways.hrats.domain.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Maps the existing {@code permissions} table. */
@Entity
@Table(name = "permissions")
@Getter
@Setter
@NoArgsConstructor
public class Permission {

    @Id
    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @Column(name = "key", length = 100, nullable = false, unique = true)
    private String permissionKey;

    @Column(name = "resource", length = 50, nullable = false)
    private String resource;

    @Column(name = "action", length = 50, nullable = false)
    private String action;

    @Column(name = "description", length = 500)
    private String description;

    @CreationTimestamp
    @Column(name = "createdAt")
    private Instant createdAt;
}
