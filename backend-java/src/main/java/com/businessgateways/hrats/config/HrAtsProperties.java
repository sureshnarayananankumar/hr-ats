package com.businessgateways.hrats.config;

import jakarta.annotation.PostConstruct;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.util.ArrayList;
import java.util.List;

/**
 * Typed application configuration, bound from the `hrats.*` block.
 *
 * {@link #validate()} refuses to start the application on a missing or
 * weak secret. A misconfigured deployment should fail loudly at boot
 * rather than run on a guessable key.
 */
@Getter
@Setter
@Validated
@ConfigurationProperties(prefix = "hrats")
public class HrAtsProperties {

    private String apiPrefix = "/api";
    private String frontendUrl = "http://localhost:5173";

    private Jwt jwt = new Jwt();
    private Cookies cookies = new Cookies();
    private Security security = new Security();
    private Storage storage = new Storage();
    private Mail mail = new Mail();

    @Getter
    @Setter
    public static class Jwt {
        @NotBlank private String accessSecret;
        @NotBlank private String refreshSecret;
        private long accessTtlSeconds = 900;
        private long refreshTtlSeconds = 604800;
    }

    @Getter
    @Setter
    public static class Cookies {
        /** Empty means a host-only cookie, which is stricter. */
        private String domain = "";
        private boolean secure = false;
        private String sameSite = "Lax";
    }

    @Getter
    @Setter
    public static class Security {
        @NotBlank private String csrfSecret;
        private String gatewaySharedSecret = "";
        private List<String> corsOrigins = new ArrayList<>();
        private int maxFailedLogins = 5;
        private int lockoutMinutes = 15;
        private List<String> mfaRequiredRoles = new ArrayList<>();
        private int loginRateLimit = 5;
        private int registerRateLimit = 5;
        private int resetRateLimit = 3;
        private int publicRateLimit = 60;
    }

    @Getter
    @Setter
    public static class Storage {
        private String root = "/app/storage";
        private long maxUploadBytes = 10L * 1024 * 1024;
        private List<String> allowedMimeTypes = new ArrayList<>();
    }

    @Getter
    @Setter
    public static class Mail {
        private String from = "HR ATS <no-reply@hr-ats.local>";
    }

    /**
     * Fail fast on a misconfigured deployment.
     *
     * Mirrors validateEnv() in the Node backend so the two behave
     * identically during the migration.
     */
    @PostConstruct
    void validate() {
        List<String> errors = new ArrayList<>();

        requireSecret(errors, "JWT_ACCESS_SECRET", jwt.accessSecret, 32);
        requireSecret(errors, "JWT_REFRESH_SECRET", jwt.refreshSecret, 32);
        requireSecret(errors, "CSRF_SECRET", security.csrfSecret, 16);

        if (jwt.accessSecret != null && jwt.accessSecret.equals(jwt.refreshSecret)) {
            errors.add("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ");
        }

        boolean production = "production".equalsIgnoreCase(System.getenv("NODE_ENV"))
                || "prod".equalsIgnoreCase(System.getenv("SPRING_PROFILES_ACTIVE"));

        if (production) {
            if (!cookies.secure) {
                errors.add("COOKIE_SECURE must be true in production (HTTPS only)");
            }
            if (security.corsOrigins.isEmpty()) {
                errors.add("CORS_ORIGINS is required in production");
            }
            if (security.corsOrigins.stream().anyMatch(origin -> origin.contains("*"))) {
                errors.add("CORS_ORIGINS must not contain a wildcard when credentials are used");
            }
        }

        if (!errors.isEmpty()) {
            throw new IllegalStateException(
                    "Invalid configuration:\n  - " + String.join("\n  - ", errors)
                            + "\nSee .env.example for the full list of required values.");
        }
    }

    private void requireSecret(List<String> errors, String name, String value, int minLength) {
        if (value == null || value.isBlank()) {
            errors.add(name + " is required");
            return;
        }
        if (value.length() < minLength) {
            errors.add(name + " must be at least " + minLength + " characters (got " + value.length() + ")");
        }
        if (value.toUpperCase().contains("CHANGE_ME")) {
            errors.add(name + " still contains a CHANGE_ME placeholder");
        }
    }
}
