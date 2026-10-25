package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.UserRole;
import com.businessgateways.hrats.domain.entity.UserRoleId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Data access for {@link UserRole}. */
@Repository
public interface UserRoleRepository extends JpaRepository<UserRole, UserRoleId> {

    List<UserRole> findByUserId(String userId);

    void deleteByUserId(String userId);

    long countByRoleId(String roleId);
}
