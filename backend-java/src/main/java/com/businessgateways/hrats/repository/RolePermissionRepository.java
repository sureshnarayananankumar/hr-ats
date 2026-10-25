package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.RolePermission;
import com.businessgateways.hrats.domain.entity.RolePermissionId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Data access for {@link RolePermission}. */
@Repository
public interface RolePermissionRepository extends JpaRepository<RolePermission, RolePermissionId> {

    List<RolePermission> findByRoleId(String roleId);

    void deleteByRoleId(String roleId);
}
