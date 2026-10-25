package com.businessgateways.hrats.dto;

import com.businessgateways.hrats.domain.entity.Department;
import com.businessgateways.hrats.domain.entity.RecruitmentSource;
import com.businessgateways.hrats.domain.entity.Skill;
import com.businessgateways.hrats.domain.entity.User;
import com.businessgateways.hrats.domain.enums.Enums.RoleName;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

/**
 * Small shapes shared across modules.
 *
 * People and departments appear nested inside job, application and
 * interview responses. They are projected to these records rather than
 * serialised from the entity, so that a response can never accidentally
 * carry a password hash or trigger a lazy load during serialisation.
 */
public final class CommonDtos {

    private CommonDtos() {}

    /** A person, as they appear nested in another record. */
    public record PersonRef(String id, String firstName, String lastName, String email) {

        public static PersonRef of(User user) {
            return user == null ? null : new PersonRef(
                    user.getId(), user.getFirstName(), user.getLastName(), user.getEmail());
        }

        /** Without the address, for contexts where it is not needed. */
        public static PersonRef withoutEmail(User user) {
            return user == null ? null : new PersonRef(
                    user.getId(), user.getFirstName(), user.getLastName(), null);
        }
    }

    public record DepartmentRef(String id, String name, String code) {

        public static DepartmentRef of(Department department) {
            return department == null ? null : new DepartmentRef(
                    department.getId(), department.getName(), department.getCode());
        }
    }

    public record SkillRef(String id, String name, String category) {

        public static SkillRef of(Skill skill) {
            return skill == null ? null : new SkillRef(
                    skill.getId(), skill.getName(), skill.getCategory());
        }
    }

    public record SourceRef(String id, String name) {

        public static SourceRef of(RecruitmentSource source) {
            return source == null ? null : new SourceRef(source.getId(), source.getName());
        }
    }

    /** The admin user list and the "assignable people" pickers. */
    public record UserSummary(
            String id,
            String name,
            String email,
            String phone,
            String status,
            boolean mfaEnabled,
            boolean emailVerified,
            Set<RoleName> roles,
            java.time.Instant lastLoginAt,
            java.time.Instant createdAt) {}

    public record DepartmentResponse(
            String id,
            String code,
            String name,
            String description,
            boolean isActive,
            PersonRef head,
            Counts count) {

        public record Counts(long jobRequirements) {}
    }

    public record SkillResponse(String id, String name, String category) {

        public static SkillResponse of(Skill skill) {
            return new SkillResponse(skill.getId(), skill.getName(), skill.getCategory());
        }
    }

    public record SourceResponse(
            String id, String name, String category, BigDecimal costPerMonth, boolean isActive) {

        public static SourceResponse of(RecruitmentSource source) {
            return new SourceResponse(
                    source.getId(), source.getName(), source.getCategory(),
                    source.getCostPerMonth(), source.isActive());
        }
    }

    /** A simple labelled count, used throughout the dashboard and reports. */
    public record CountByLabel(String label, long count) {}

    /** A labelled numeric value, for charts whose measure is not a count. */
    public record ValueByLabel(String label, BigDecimal value) {}

    public record OptionList(List<String> options) {}
}
