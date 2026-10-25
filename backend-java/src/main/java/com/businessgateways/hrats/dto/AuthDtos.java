package com.businessgateways.hrats.dto;

import com.businessgateways.hrats.domain.enums.Enums.RoleName;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.Set;

/**
 * Request and response bodies for the auth endpoints.
 *
 * Field names match what the React client already sends and reads, so
 * the migration from the NestJS backend needs no front-end change.
 */
public final class AuthDtos {

    private AuthDtos() {}

    /**
     * Password policy, applied wherever a password is set.
     *
     * Length does more for strength than character classes do, so the
     * floor is 12 rather than the more common 8. The composition rule
     * is kept because the organisation's policy requires it.
     */
    public static final String PASSWORD_PATTERN =
            "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{12,128}$";

    public static final String PASSWORD_MESSAGE =
            "Password must be at least 12 characters and include an upper-case letter, "
                    + "a lower-case letter, a digit and a symbol.";

    public record RegisterRequest(
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Pattern(regexp = PASSWORD_PATTERN, message = PASSWORD_MESSAGE) String password,
            @NotBlank @Size(max = 100) String firstName,
            @NotBlank @Size(max = 100) String lastName,
            @Size(max = 30) String phone,
            @Schema(description = "Must be true; the account cannot be created without it")
            boolean consentToStoreData) {}

    public record LoginRequest(
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Size(max = 128) String password) {}

    public record MfaCodeRequest(
            @NotBlank
            @Pattern(regexp = "^[0-9A-Za-z-]{6,20}$",
                    message = "Enter the 6-digit code from your authenticator app, or a recovery code.")
            String code) {}

    public record VerifyEmailRequest(@NotBlank @Size(max = 200) String token) {}

    public record ForgotPasswordRequest(@NotBlank @Email @Size(max = 255) String email) {}

    public record ResetPasswordRequest(
            @NotBlank @Size(max = 200) String token,
            @NotBlank @Pattern(regexp = PASSWORD_PATTERN, message = PASSWORD_MESSAGE) String newPassword) {}

    public record ChangePasswordRequest(
            @NotBlank @Size(max = 128) String currentPassword,
            @NotBlank @Pattern(regexp = PASSWORD_PATTERN, message = PASSWORD_MESSAGE) String newPassword) {}

    /** The profile returned by {@code /auth/me} and after a successful login. */
    public record CurrentUserResponse(
            String id,
            String email,
            String firstName,
            String lastName,
            String phone,
            String status,
            boolean mfaEnabled,
            boolean emailVerified,
            Set<RoleName> roles,
            List<String> permissions,
            String candidateId,
            String candidateCode,
            Instant lastLoginAt) {}

    /**
     * {@code mfaRequired} is the discriminator: when true, no session
     * was established and the client must call {@code /auth/mfa/verify}.
     */
    public record LoginResponse(
            boolean mfaRequired,
            CurrentUserResponse user,
            Long expiresIn) {

        public static LoginResponse challenge() {
            return new LoginResponse(true, null, null);
        }

        public static LoginResponse success(CurrentUserResponse user, long expiresIn) {
            return new LoginResponse(false, user, expiresIn);
        }
    }

    public record RefreshResponse(long expiresIn) {}

    public record MessageResponse(String message) {

        public static MessageResponse of(String message) {
            return new MessageResponse(message);
        }
    }

    public record CsrfResponse(String csrfToken) {}

    /** Returned when enrolment begins; the secret is shown once. */
    public record MfaSetupResponse(String secret, String otpauthUri, String issuer) {}

    /** Recovery codes are shown exactly once, at confirmation. */
    public record MfaConfirmResponse(String message, List<String> recoveryCodes) {}

    public record SessionResponse(
            String id,
            String userAgent,
            String ipAddress,
            Instant createdAt,
            Instant expiresAt,
            boolean current) {}
}
