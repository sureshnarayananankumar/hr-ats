package com.businessgateways.hrats.domain.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Maps the existing {@code role_permissions} join table. */
@Entity
@Table(name = "role_permissions")
@IdClass(RolePermissionId.class)
@Getter
@Setter
@NoArgsConstructor
public class RolePermission {

    @Id
    @Column(name = "roleId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String roleId;

    @Id
    @Column(name = "permissionId", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String permissionId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "permissionId", insertable = false, updatable = false)
    private Permission permission;
}
