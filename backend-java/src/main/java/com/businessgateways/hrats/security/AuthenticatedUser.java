package com.businessgateways.hrats.security;

import com.businessgateways.hrats.domain.enums.Enums.RoleName;

import java.util.Set;

/**
 * The authenticated caller, as reconstructed from the access token.
 *
 * Deliberately a value object with no entity reference: an authorization
 * check must never depend on a lazily-loaded association, and nothing
 * here should be mutable mid-request.
 *
 * @param userId      the {@code users.id} of the caller
 * @param email       used for the audit trail, not for authorization
 * @param roles       the caller's roles, for display and MFA policy
 * @param permissions the flattened permission keys the roles grant
 * @param sessionId   the refresh session this access token belongs to
 * @param mfaVerified whether this session cleared the MFA challenge
 */
public record AuthenticatedUser(
        String userId,
        String email,
        Set<RoleName> roles,
        Set<String> permissions,
        String sessionId,
        boolean mfaVerified) {

    public boolean hasPermission(String key) {
        return permissions.contains(key);
    }

    public boolean hasAnyPermission(String... keys) {
        for (String key : keys) {
            if (permissions.contains(key)) {
                return true;
            }
        }
        return false;
    }

    public boolean hasRole(RoleName role) {
        return roles.contains(role);
    }

    /**
     * True when the caller may only see their own records.
     *
     * A candidate who was later also given a staff role is no longer
     * restricted, so this tests for the absence of any broad read rather
     * than for the CANDIDATE role itself.
     */
    public boolean isSelfScopedOnly() {
        return !hasAnyPermission(
                Permissions.CANDIDATE_READ_ANY,
                Permissions.APPLICATION_READ_ANY,
                Permissions.APPLICATION_READ_ASSIGNED);
    }
}
