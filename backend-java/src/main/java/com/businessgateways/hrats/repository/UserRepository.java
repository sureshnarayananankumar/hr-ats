package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.User;
import com.businessgateways.hrats.domain.enums.Enums.RoleName;
import com.businessgateways.hrats.domain.enums.Enums.UserStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/** Data access for {@link User}. */
@Repository
public interface UserRepository extends JpaRepository<User, String>, JpaSpecificationExecutor<User> {

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    List<User> findByStatus(UserStatus status);

    @Query("""
           select u from User u join u.userRoles ur
           where ur.role.name = :role and u.status = :status
           """)
    List<User> findByRoleAndStatus(@Param("role") RoleName role, @Param("status") UserStatus status);

    long countByStatus(UserStatus status);
}
