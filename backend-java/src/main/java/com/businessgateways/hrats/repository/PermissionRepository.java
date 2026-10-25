package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.Permission;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Data access for {@link Permission}. */
@Repository
public interface PermissionRepository extends JpaRepository<Permission, String> {

    Optional<Permission> findByPermissionKey(String permissionKey);
}
