package com.businessgateways.hrats.domain.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** Maps the existing {@code system_settings} table. */
@Entity
@Table(name = "system_settings")
@Getter
@Setter
@NoArgsConstructor
public class SystemSetting {

    @Id
    @Column(name = "id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String id = UUID.randomUUID().toString();

    @Column(name = "key", length = 100, nullable = false, unique = true)
    private String settingKey;

    @Column(name = "value", nullable = false, columnDefinition = "TEXT")
    private String settingValue;

    @Column(name = "valueType", length = 20)
    private String valueType = "string";

    @Column(name = "category", length = 60)
    private String category = "general";

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "isSecret")
    private boolean isSecret = false;

    @Column(name = "updatedById", length = 36, columnDefinition = "CHAR(36)")
    private String updatedById;

    @CreationTimestamp
    @Column(name = "createdAt")
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updatedAt")
    private Instant updatedAt;
}
