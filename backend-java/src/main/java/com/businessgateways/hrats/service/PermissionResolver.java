package com.businessgateways.hrats.service;

import com.businessgateways.hrats.domain.entity.User;
import com.businessgateways.hrats.domain.enums.Enums.RoleName;
import com.businessgateways.hrats.repository.PermissionRepository;
import com.businessgateways.hrats.repository.RolePermissionRepository;
import com.businessgateways.hrats.repository.RoleRepository;
import com.businessgateways.hrats.security.Permissions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Resolves a user's effective permission set.
 *
 * The {@code role_permissions} table is the source of truth, so an
 * administrator can re-cut a bundle without a redeploy. The compiled-in
 * {@link Permissions#ROLE_PERMISSIONS} map is used only when a role has
 * no rows at all — a half-seeded database should not quietly strip
 * everyone's access.
 *
 * The role-to-permission mapping is cached because it is read on every
 * login and changes perhaps a few times a year. {@link #invalidate()}
 * clears it when an administrator edits a bundle.
 */
@Service
public class PermissionResolver {

    private static final Logger log = LoggerFactory.getLogger(PermissionResolver.class);

    private final RoleRepository roles;
    private final RolePermissionRepository rolePermissions;
    private final PermissionRepository permissions;

    private final Map<RoleName, Set<String>> cache = new ConcurrentHashMap<>();

    public PermissionResolver(
            RoleRepository roles,
            RolePermissionRepository rolePermissions,
            PermissionRepository permissions) {
        this.roles = roles;
        this.rolePermissions = rolePermissions;
        this.permissions = permissions;
    }

    /** The union of every permission the user's roles grant. */
    @Transactional(readOnly = true)
    public Set<String> permissionsFor(User user) {
        Set<String> granted = new LinkedHashSet<>();
        for (RoleName role : rolesOf(user)) {
            granted.addAll(forRole(role));
        }
        return granted;
    }

    @Transactional(readOnly = true)
    public Set<RoleName> rolesOf(User user) {
        Set<RoleName> names = new LinkedHashSet<>();
        user.getUserRoles().forEach(link -> {
            if (link.getRole() != null) {
                names.add(link.getRole().getName());
            }
        });
        return names;
    }

    @Transactional(readOnly = true)
    public Set<String> forRole(RoleName role) {
        return cache.computeIfAbsent(role, this::loadFromDatabase);
    }

    private Set<String> loadFromDatabase(RoleName role) {
        var roleRow = roles.findByName(role);
        if (roleRow.isEmpty()) {
            log.warn("Role {} is not present in the database; falling back to the built-in bundle", role);
            return Set.copyOf(Permissions.ROLE_PERMISSIONS.getOrDefault(role, List.of()));
        }

        Set<String> keys = new LinkedHashSet<>();
        rolePermissions.findByRoleId(roleRow.get().getId()).forEach(link -> {
            if (link.getPermission() != null) {
                keys.add(link.getPermission().getPermissionKey());
            }
        });

        if (keys.isEmpty()) {
            // A role with zero permission rows is almost certainly an
            // incomplete seed rather than a deliberate "can do nothing"
            // role, and silently honouring it would lock people out.
            log.warn("Role {} has no permission rows; falling back to the built-in bundle", role);
            return Set.copyOf(Permissions.ROLE_PERMISSIONS.getOrDefault(role, List.of()));
        }

        return Set.copyOf(keys);
    }

    /** Drops the cache after an administrator changes a role's bundle. */
    public void invalidate() {
        cache.clear();
        log.info("Role permission cache cleared");
    }

    /** Keys that exist in the catalogue but not yet in the database. */
    @Transactional(readOnly = true)
    public List<String> missingFromDatabase() {
        return Permissions.ALL.stream()
                .filter(key -> permissions.findByPermissionKey(key).isEmpty())
                .toList();
    }
}
