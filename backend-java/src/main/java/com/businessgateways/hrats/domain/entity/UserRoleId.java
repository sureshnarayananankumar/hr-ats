package com.businessgateways.hrats.domain.entity;

import java.io.Serializable;
import java.util.Objects;

/** Composite primary key for {@link UserRole}. */
public class UserRoleId implements Serializable {

    private String userId;
    private String roleId;

    public UserRoleId() {}

    public UserRoleId(String userId, String roleId) {
        this.userId = userId;
        this.roleId = roleId;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) return true;
        if (!(other instanceof UserRoleId that)) return false;
        return Objects.equals(userId, that.userId)
                && Objects.equals(roleId, that.roleId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, roleId);
    }
}
