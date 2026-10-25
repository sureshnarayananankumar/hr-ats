package com.businessgateways.hrats.domain.entity;

import java.io.Serializable;
import java.util.Objects;

/** Composite primary key for {@link RolePermission}. */
public class RolePermissionId implements Serializable {

    private String roleId;
    private String permissionId;

    public RolePermissionId() {}

    public RolePermissionId(String roleId, String permissionId) {
        this.roleId = roleId;
        this.permissionId = permissionId;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) return true;
        if (!(other instanceof RolePermissionId that)) return false;
        return Objects.equals(roleId, that.roleId)
                && Objects.equals(permissionId, that.permissionId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(roleId, permissionId);
    }
}
