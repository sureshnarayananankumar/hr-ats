package com.businessgateways.hrats.domain.entity;

import com.businessgateways.hrats.domain.enums.Enums.RoleName;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** Maps the existing {@code roles} table. */
@Entity
@Table(name = "roles")
@Getter
@Setter
@NoArgsConstructor
public class Role {

    @Id
    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @Enumerated(EnumType.STRING)
    @Column(name = "name", nullable = false, unique = true, columnDefinition = "enum('SUPER_ADMIN','HR_ADMIN','RECRUITER','HIRING_MANAGER','INTERVIEWER','CANDIDATE')")
    private RoleName name;

    @Column(name = "label", length = 100, nullable = false)
    private String label;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "isSystem")
    private boolean isSystem = true;

    @CreationTimestamp
    @Column(name = "createdAt")
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updatedAt")
    private Instant updatedAt;
}
