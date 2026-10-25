package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.Role;
import com.businessgateways.hrats.domain.enums.Enums.RoleName;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Data access for {@link Role}. */
@Repository
public interface RoleRepository extends JpaRepository<Role, String> {

    Optional<Role> findByName(RoleName name);

    List<Role> findAllByOrderByNameAsc();
}
