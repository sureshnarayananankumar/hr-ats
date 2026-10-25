package com.businessgateways.hrats.repository;

import com.businessgateways.hrats.domain.entity.SystemSetting;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Data access for {@link SystemSetting}. */
@Repository
public interface SystemSettingRepository extends JpaRepository<SystemSetting, String> {

    Optional<SystemSetting> findBySettingKey(String settingKey);

    List<SystemSetting> findByCategoryOrderBySettingKeyAsc(String category);

    List<SystemSetting> findAllByOrderByCategoryAscSettingKeyAsc();
}
