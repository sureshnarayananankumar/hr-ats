package com.businessgateways.hrats.security;

import com.businessgateways.hrats.config.HrAtsProperties;
import com.businessgateways.hrats.domain.enums.Enums.RoleName;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Issues and verifies the short-lived access token.
 *
 * Refresh tokens are deliberately NOT JWTs: they are opaque random
 * strings whose SHA-256 hash is stored in {@code refresh_sessions}, so
 * that a stolen refresh token can be revoked server-side and its reuse
 * detected. A self-contained refresh JWT could not be withdrawn.
 */
@Service
public class JwtService {

    private static final Logger log = LoggerFactory.getLogger(JwtService.class);

    private static final String ISSUER = "hr-ats";
    private static final String AUDIENCE = "hr-ats-api";

    private static final String CLAIM_EMAIL = "email";
    private static final String CLAIM_ROLES = "roles";
    private static final String CLAIM_PERMISSIONS = "perms";
    private static final String CLAIM_SESSION = "sid";
    private static final String CLAIM_MFA = "mfa";

    private final SecretKey accessKey;
    private final long accessTtlSeconds;

    public JwtService(HrAtsProperties properties) {
        this.accessKey = Keys.hmacShaKeyFor(
                properties.getJwt().getAccessSecret().getBytes(StandardCharsets.UTF_8));
        this.accessTtlSeconds = properties.getJwt().getAccessTtlSeconds();
    }

    public long getAccessTtlSeconds() {
        return accessTtlSeconds;
    }

    /**
     * Mints an access token carrying the caller's resolved permissions.
     *
     * Embedding the permission set avoids a role lookup on every request.
     * The cost is that a permission change only takes effect at the next
     * refresh — bounded by the 15-minute access TTL — and that is the
     * trade the short TTL exists to make acceptable.
     */
    public String issueAccessToken(AuthenticatedUser user) {
        return issueToken(user, accessTtlSeconds);
    }

    /**
     * A short-lived, half-authenticated token for the MFA challenge.
     *
     * The caller passes an {@link AuthenticatedUser} with an empty
     * permission set and {@code mfaVerified = false}, so the token
     * identifies who is mid-sign-in and opens nothing else.
     */
    public String issueChallengeToken(AuthenticatedUser user, long ttlSeconds) {
        return issueToken(user, ttlSeconds);
    }

    private String issueToken(AuthenticatedUser user, long ttlSeconds) {
        Instant now = Instant.now();
        return Jwts.builder()
                .issuer(ISSUER)
                .audience().add(AUDIENCE).and()
                .subject(user.userId())
                .id(UUID.randomUUID().toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(ttlSeconds)))
                .claim(CLAIM_EMAIL, user.email())
                .claim(CLAIM_ROLES, user.roles().stream().map(Enum::name).toList())
                .claim(CLAIM_PERMISSIONS, List.copyOf(user.permissions()))
                .claim(CLAIM_SESSION, user.sessionId())
                .claim(CLAIM_MFA, user.mfaVerified())
                .signWith(accessKey, Jwts.SIG.HS256)
                .compact();
    }

    /**
     * Verifies a token and rebuilds the caller.
     *
     * Returns empty rather than throwing: an expired or forged token is
     * an ordinary unauthenticated request, not an exceptional condition,
     * and the filter turns it into a 401.
     */
    public Optional<AuthenticatedUser> verifyAccessToken(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(accessKey)
                    .requireIssuer(ISSUER)
                    .requireAudience(AUDIENCE)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            return Optional.of(new AuthenticatedUser(
                    claims.getSubject(),
                    claims.get(CLAIM_EMAIL, String.class),
                    readRoles(claims),
                    readStrings(claims, CLAIM_PERMISSIONS),
                    claims.get(CLAIM_SESSION, String.class),
                    Boolean.TRUE.equals(claims.get(CLAIM_MFA, Boolean.class))));
        } catch (JwtException | IllegalArgumentException ex) {
            // Logged at debug: a rejected token is routine traffic, and
            // logging it louder would let anyone flood the error log.
            log.debug("Rejected access token: {}", ex.getMessage());
            return Optional.empty();
        }
    }

    private Set<RoleName> readRoles(Claims claims) {
        return readStrings(claims, CLAIM_ROLES).stream()
                .map(name -> {
                    try {
                        return RoleName.valueOf(name);
                    } catch (IllegalArgumentException ex) {
                        // A role removed from the enum since the token was
                        // issued. Dropping it is safer than failing open.
                        log.warn("Access token carries unknown role \"{}\"; ignoring it", name);
                        return null;
                    }
                })
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    @SuppressWarnings("unchecked")
    private Set<String> readStrings(Claims claims, String name) {
        Object raw = claims.get(name);
        if (raw instanceof List<?> list) {
            return list.stream()
                    .map(String::valueOf)
                    .collect(Collectors.toCollection(LinkedHashSet::new));
        }
        return Set.of();
    }
}
