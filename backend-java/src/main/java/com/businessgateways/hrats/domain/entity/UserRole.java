package com.businessgateways.hrats.domain.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Maps the existing {@code user_roles} join table. */
@Entity
@Table(name = "user_roles")
@IdClass(UserRoleId.class)
@Getter
@Setter
@NoArgsConstructor
public class UserRole {

    @Id
    @Column(name = "userId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String userId;

    @Id
    @Column(name = "roleId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String roleId;

    @CreationTimestamp
    @Column(name = "assignedAt")
    private Instant assignedAt;

    @Column(name = "assignedBy", length = 36, columnDefinition = "CHAR(36)")
    private String assignedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "userId", insertable = false, updatable = false)
    private User user;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "roleId", insertable = false, updatable = false)
    private Role role;
}
