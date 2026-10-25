package com.businessgateways.hrats.security;

import com.businessgateways.hrats.common.Constants;
import com.businessgateways.hrats.config.HrAtsProperties;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Builds the session cookies.
 *
 * The access and refresh cookies are HTTP-only so that script on the
 * page cannot read them — an XSS bug then cannot exfiltrate the
 * session. The CSRF cookie is deliberately readable, because the
 * front end has to echo its value back in a header.
 *
 * {@code domain} is left empty by default, which makes the cookie
 * host-only. That is stricter than a {@code Domain=} attribute, and it
 * avoids the trap where a cookie scoped to {@code localhost} is simply
 * not sent to {@code 127.0.0.1}.
 */
@Component
public class CookieFactory {

    private final HrAtsProperties.Cookies config;
    private final long accessTtlSeconds;
    private final long refreshTtlSeconds;
    private final String apiPrefix;

    public CookieFactory(HrAtsProperties properties) {
        this.config = properties.getCookies();
        this.accessTtlSeconds = properties.getJwt().getAccessTtlSeconds();
        this.refreshTtlSeconds = properties.getJwt().getRefreshTtlSeconds();
        this.apiPrefix = properties.getApiPrefix();
    }

    public ResponseCookie access(String token) {
        return base(Constants.ACCESS_COOKIE, token)
                .httpOnly(true)
                .path("/")
                .maxAge(Duration.ofSeconds(accessTtlSeconds))
                .build();
    }

    /**
     * The refresh cookie is scoped to the auth routes only, so it is not
     * attached to the hundreds of ordinary API calls that have no use
     * for it — less exposure for the longest-lived credential.
     */
    public ResponseCookie refresh(String token) {
        return base(Constants.REFRESH_COOKIE, token)
                .httpOnly(true)
                .path(apiPrefix + "/auth")
                .maxAge(Duration.ofSeconds(refreshTtlSeconds))
                .build();
    }

    /**
     * The half-authenticated cookie used between password and MFA code.
     *
     * Deliberately the same name as the access cookie, so that
     * completing or abandoning the challenge replaces it rather than
     * leaving a second credential in the jar.
     */
    public ResponseCookie mfaChallenge(String token, Duration ttl) {
        return base(Constants.ACCESS_COOKIE, token)
                .httpOnly(true)
                .path("/")
                .maxAge(ttl)
                .build();
    }

    /** Readable by script on purpose: the SPA echoes it in the CSRF header. */
    public ResponseCookie csrf(String token) {
        return base(Constants.CSRF_COOKIE, token)
                .httpOnly(false)
                .path("/")
                .maxAge(Duration.ofSeconds(refreshTtlSeconds))
                .build();
    }

    public ResponseCookie clearAccess() {
        return expire(Constants.ACCESS_COOKIE, "/", true);
    }

    public ResponseCookie clearRefresh() {
        return expire(Constants.REFRESH_COOKIE, apiPrefix + "/auth", true);
    }

    public ResponseCookie clearCsrf() {
        return expire(Constants.CSRF_COOKIE, "/", false);
    }

    private ResponseCookie expire(String name, String path, boolean httpOnly) {
        return base(name, "")
                .httpOnly(httpOnly)
                .path(path)
                .maxAge(Duration.ZERO)
                .build();
    }

    private ResponseCookie.ResponseCookieBuilder base(String name, String value) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(name, value)
                .secure(config.isSecure())
                .sameSite(config.getSameSite());

        // An empty domain must mean "host-only", not "Domain=". Setting
        // the attribute to an empty string would widen the cookie's
        // scope rather than narrow it.
        if (config.getDomain() != null && !config.getDomain().isBlank()) {
            builder.domain(config.getDomain());
        }
        return builder;
    }
}
