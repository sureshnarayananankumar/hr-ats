package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.Department;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Data access for {@link Department}. */
@Repository
public interface DepartmentRepository extends JpaRepository<Department, String> {

    Optional<Department> findByCodeIgnoreCase(String code);

    Optional<Department> findByNameIgnoreCase(String name);

    List<Department> findByIsActiveTrueOrderByNameAsc();

    List<Department> findAllByOrderByNameAsc();
}
