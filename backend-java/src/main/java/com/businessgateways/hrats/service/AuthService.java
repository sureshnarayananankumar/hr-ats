package com.businessgateways.hrats.service;

import com.businessgateways.hrats.common.ApiException;
import com.businessgateways.hrats.common.Constants;
import com.businessgateways.hrats.common.CryptoUtil;
import com.businessgateways.hrats.config.HrAtsProperties;
import com.businessgateways.hrats.domain.entity.CandidateProfile;
import com.businessgateways.hrats.domain.entity.EmailVerificationToken;
import com.businessgateways.hrats.domain.entity.LoginAttempt;
import com.businessgateways.hrats.domain.entity.PasswordResetToken;
import com.businessgateways.hrats.domain.entity.RefreshSession;
import com.businessgateways.hrats.domain.entity.Role;
import com.businessgateways.hrats.domain.entity.User;
import com.businessgateways.hrats.domain.entity.UserRole;
import com.businessgateways.hrats.domain.enums.Enums.RoleName;
import com.businessgateways.hrats.domain.enums.Enums.UserStatus;
import com.businessgateways.hrats.dto.AuthDtos.CurrentUserResponse;
import com.businessgateways.hrats.dto.AuthDtos.MfaConfirmResponse;
import com.businessgateways.hrats.dto.AuthDtos.MfaSetupResponse;
import com.businessgateways.hrats.dto.AuthDtos.RegisterRequest;
import com.businessgateways.hrats.dto.AuthDtos.SessionResponse;
import com.businessgateways.hrats.repository.CandidateProfileRepository;
import com.businessgateways.hrats.repository.EmailVerificationTokenRepository;
import com.businessgateways.hrats.repository.LoginAttemptRepository;
import com.businessgateways.hrats.repository.PasswordResetTokenRepository;
import com.businessgateways.hrats.repository.RefreshSessionRepository;
import com.businessgateways.hrats.repository.RoleRepository;
import com.businessgateways.hrats.repository.UserRepository;
import com.businessgateways.hrats.security.AuthenticatedUser;
import com.businessgateways.hrats.security.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Authentication, session lifecycle and password management.
 *
 * Three decisions shape most of what follows.
 *
 * <ol>
 *   <li><b>Login failures are indistinguishable.</b> Unknown email,
 *       wrong password, suspended account and unverified address all
 *       produce the same message and comparable timing, so the endpoint
 *       cannot be used to enumerate who has an account.</li>
 *   <li><b>Refresh tokens rotate and detect reuse.</b> Each refresh
 *       issues a new token and revokes the old one. Presenting an
 *       already-used token means the token leaked, so the whole family
 *       is revoked and the event is audited.</li>
 *   <li><b>Password change ends every session.</b> If the reason for
 *       changing is "somebody else has my password", leaving their
 *       session alive would defeat the point.</li>
 * </ol>
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    /** One message for every login failure. Never say which part was wrong. */
    private static final String LOGIN_FAILED = "Email or password is incorrect.";

    private static final Duration EMAIL_TOKEN_TTL = Duration.ofHours(24);
    private static final Duration RESET_TOKEN_TTL = Duration.ofHours(1);
    private static final Duration MFA_CHALLENGE_TTL = Duration.ofMinutes(5);

    private final UserRepository users;
    private final RoleRepository roles;
    private final CandidateProfileRepository candidates;
    private final RefreshSessionRepository sessions;
    private final EmailVerificationTokenRepository emailTokens;
    private final PasswordResetTokenRepository resetTokens;
    private final LoginAttemptRepository loginAttempts;

    private final PasswordEncoder passwordEncoder;
    private final JwtService jwt;
    private final PermissionResolver permissionResolver;
    private final MfaService mfa;
    private final MailService mail;
    private final AuditService audit;
    private final CodeGenerator codes;
    private final HrAtsProperties properties;

    public AuthService(
            UserRepository users,
            RoleRepository roles,
            CandidateProfileRepository candidates,
            RefreshSessionRepository sessions,
            EmailVerificationTokenRepository emailTokens,
            PasswordResetTokenRepository resetTokens,
            LoginAttemptRepository loginAttempts,
            PasswordEncoder passwordEncoder,
            JwtService jwt,
            PermissionResolver permissionResolver,
            MfaService mfa,
            MailService mail,
            AuditService audit,
            CodeGenerator codes,
            HrAtsProperties properties) {
        this.users = users;
        this.roles = roles;
        this.candidates = candidates;
        this.sessions = sessions;
        this.emailTokens = emailTokens;
        this.resetTokens = resetTokens;
        this.loginAttempts = loginAttempts;
        this.passwordEncoder = passwordEncoder;
        this.jwt = jwt;
        this.permissionResolver = permissionResolver;
        this.mfa = mfa;
        this.mail = mail;
        this.audit = audit;
        this.codes = codes;
        this.properties = properties;
    }

    // -----------------------------------------------------------------
    //  Registration
    // -----------------------------------------------------------------

    /**
     * Creates a candidate account from the public careers portal.
     *
     * Always reports success, even when the address is already taken —
     * otherwise the endpoint becomes a way to test whether somebody has
     * applied here. The duplicate case sends a "you already have an
     * account" email instead, which reaches the real owner and nobody
     * else.
     */
    @Transactional
    public String registerCandidate(RegisterRequest request, HttpServletRequest http) {
        if (!request.consentToStoreData()) {
            throw ApiException.badRequest(
                    "We cannot create an account without your consent to store your data.");
        }

        String email = CryptoUtil.normaliseEmail(request.email());

        if (users.existsByEmailIgnoreCase(email)) {
            log.info("Registration attempted for an existing address");
            mail.sendTemplate("account.duplicate_registration", email, Map.of(
                    "firstName", request.firstName()));
            return "Check your inbox — if the address is new to us, a verification link is on its way.";
        }

        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setFirstName(request.firstName().trim());
        user.setLastName(request.lastName().trim());
        user.setPhone(request.phone());
        user.setStatus(UserStatus.PENDING_VERIFICATION);
        user.setConsentGivenAt(Instant.now());

        Role candidateRole = roles.findByName(RoleName.CANDIDATE)
                .orElseThrow(() -> new IllegalStateException(
                        "The CANDIDATE role is missing; the database has not been seeded."));

        UserRole link = new UserRole();
        link.setUserId(user.getId());
        link.setRoleId(candidateRole.getId());
        user.getUserRoles().add(link);

        users.save(user);

        CandidateProfile profile = new CandidateProfile();
        profile.setCandidateCode(codes.nextCandidateCode());
        profile.setUserId(user.getId());
        profile.setFullName(user.fullName());
        profile.setNormalisedEmail(email);
        profile.setNormalisedPhone(CryptoUtil.normalisePhone(request.phone()));
        profile.setMobile(request.phone());
        profile.setConsentToStoreData(true);
        profile.setConsentAt(Instant.now());
        candidates.save(profile);

        sendVerificationEmail(user);

        audit.write(user.getId(), email, Constants.Audit.USER_CREATED, "user", user.getId(),
                Map.of("via", "public-registration"), "INFO");

        return "Check your inbox — if the address is new to us, a verification link is on its way.";
    }

    @Transactional
    public String verifyEmail(String rawToken) {
        EmailVerificationToken token = emailTokens.findByTokenHash(CryptoUtil.sha256Hex(rawToken))
                .orElseThrow(() -> ApiException.badRequest(
                        "That verification link is not valid. Request a new one."));

        if (token.getUsedAt() != null) {
            throw ApiException.badRequest("That verification link has already been used.");
        }
        if (token.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.badRequest("That verification link has expired. Request a new one.");
        }

        User user = users.findById(token.getUserId())
                .orElseThrow(() -> ApiException.badRequest("That verification link is not valid."));

        token.setUsedAt(Instant.now());
        emailTokens.save(token);

        user.setEmailVerifiedAt(Instant.now());
        if (user.getStatus() == UserStatus.PENDING_VERIFICATION) {
            user.setStatus(UserStatus.ACTIVE);
        }
        users.save(user);

        return "Your email address is verified. You can sign in now.";
    }

    @Transactional
    public void resendVerification(String rawEmail) {
        users.findByEmailIgnoreCase(CryptoUtil.normaliseEmail(rawEmail))
                .filter(user -> user.getEmailVerifiedAt() == null)
                .ifPresent(this::sendVerificationEmail);
    }

    private void sendVerificationEmail(User user) {
        emailTokens.deleteByUserId(user.getId());

        String raw = CryptoUtil.randomToken();
        EmailVerificationToken token = new EmailVerificationToken();
        token.setUserId(user.getId());
        token.setTokenHash(CryptoUtil.sha256Hex(raw));
        token.setExpiresAt(Instant.now().plus(EMAIL_TOKEN_TTL));
        emailTokens.save(token);

        mail.sendTemplate("account.verify_email", user.getEmail(), Map.of(
                "firstName", user.getFirstName(),
                "verifyUrl", properties.getFrontendUrl() + "/verify-email?token=" + raw,
                "expiresInHours", EMAIL_TOKEN_TTL.toHours()));
    }

    // -----------------------------------------------------------------
    //  Login
    // -----------------------------------------------------------------

    /** What {@link #login} produced: either a session or an MFA challenge. */
    public record LoginOutcome(
            boolean mfaRequired,
            String mfaChallengeToken,
            Tokens tokens,
            CurrentUserResponse user) {}

    public record Tokens(String accessToken, String refreshToken, long expiresIn) {}

    @Transactional
    public LoginOutcome login(String rawEmail, String password, HttpServletRequest http) {
        String email = CryptoUtil.normaliseEmail(rawEmail);
        String ip = clientIp(http);

        Optional<User> found = users.findByEmailIgnoreCase(email);

        if (found.isEmpty()) {
            // Spend comparable time on an unknown address, so response
            // timing does not reveal which accounts exist.
            passwordEncoder.encode(password);
            recordAttempt(email, ip, false, "UNKNOWN_EMAIL", http);
            audit.recordAnonymous(Constants.Audit.LOGIN_FAILED, email, Map.of("reason", "unknown"), "WARN");
            throw ApiException.unauthorized(LOGIN_FAILED);
        }

        User user = found.get();

        if (user.isLocked()) {
            recordAttempt(email, ip, false, "LOCKED", http);
            audit.write(user.getId(), email, Constants.Audit.LOGIN_LOCKED, "user", user.getId(),
                    Map.of("lockedUntil", String.valueOf(user.getLockedUntil())), "WARN");
            throw ApiException.unauthorized(
                    "This account is temporarily locked after too many failed attempts. "
                            + "Try again shortly, or reset your password.");
        }

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            registerFailure(user, email, ip, http);
            throw ApiException.unauthorized(LOGIN_FAILED);
        }

        if (user.getStatus() == UserStatus.SUSPENDED || user.getStatus() == UserStatus.DEACTIVATED) {
            recordAttempt(email, ip, false, user.getStatus().name(), http);
            audit.write(user.getId(), email, Constants.Audit.LOGIN_FAILED, "user", user.getId(),
                    Map.of("reason", user.getStatus().name()), "WARN");
            throw ApiException.unauthorized(
                    "This account is not active. Contact your HR administrator.");
        }

        if (user.getEmailVerifiedAt() == null) {
            recordAttempt(email, ip, false, "UNVERIFIED", http);
            throw ApiException.unauthorized(
                    "Your email address is not verified yet. Check your inbox for the link.");
        }

        // Password accepted: clear the failure counter before anything
        // that might still reject the request, so a user stuck on MFA
        // does not accumulate a lockout.
        user.setFailedLoginCount(0);
        user.setLockedUntil(null);

        Set<RoleName> roleNames = permissionResolver.rolesOf(user);

        if (user.isMfaEnabled() || requiresMfa(roleNames)) {
            if (!user.isMfaEnabled()) {
                // Policy requires MFA for this role but the user has not
                // enrolled. Let them in only far enough to enrol.
                users.save(user);
                recordAttempt(email, ip, true, "MFA_ENROLMENT_REQUIRED", http);
                return new LoginOutcome(true, issueChallengeToken(user, roleNames), null, null);
            }
            users.save(user);
            recordAttempt(email, ip, true, "MFA_CHALLENGE", http);
            return new LoginOutcome(true, issueChallengeToken(user, roleNames), null, null);
        }

        return establishSession(user, roleNames, http, email, ip);
    }

    @Transactional
    public LoginOutcome verifyMfa(String userId, String code, HttpServletRequest http) {
        User user = users.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("Start again from the sign-in page."));

        boolean accepted = mfa.verifyCode(user.getMfaSecret(), code)
                || mfa.consumeRecoveryCode(user, code);

        if (!accepted) {
            registerFailure(user, user.getEmail(), clientIp(http), http);
            audit.write(user.getId(), user.getEmail(), Constants.Audit.MFA_FAILED,
                    "user", user.getId(), null, "WARN");
            throw ApiException.unauthorized("That code is not valid. Try the next one from your app.");
        }

        user.setFailedLoginCount(0);
        user.setLockedUntil(null);
        users.save(user);

        return establishSession(
                user, permissionResolver.rolesOf(user), http, user.getEmail(), clientIp(http));
    }

    private LoginOutcome establishSession(
            User user, Set<RoleName> roleNames, HttpServletRequest http, String email, String ip) {

        Set<String> permissions = permissionResolver.permissionsFor(user);

        OpenedSession session = openSession(user, null, http);
        AuthenticatedUser principal = new AuthenticatedUser(
                user.getId(), user.getEmail(), roleNames, permissions, session.row().getId(), true);

        String accessToken = jwt.issueAccessToken(principal);

        user.setLastLoginAt(Instant.now());
        user.setLastLoginIp(ip);
        users.save(user);

        recordAttempt(email, ip, true, null, http);
        audit.write(user.getId(), email, Constants.Audit.LOGIN_SUCCESS, "user", user.getId(),
                Map.of("sessionId", session.row().getId()), "INFO");

        return new LoginOutcome(
                false,
                null,
                new Tokens(accessToken, session.rawToken(), jwt.getAccessTtlSeconds()),
                profileOf(user, roleNames, permissions));
    }

    /**
     * A half-authenticated token carrying no permissions.
     *
     * It identifies who is halfway through signing in and nothing more,
     * so even if it leaked it would not open any endpoint that matters.
     */
    private String issueChallengeToken(User user, Set<RoleName> roleNames) {
        return jwt.issueChallengeToken(
                new AuthenticatedUser(
                        user.getId(), user.getEmail(), roleNames, Set.of(), "mfa-challenge", false),
                MFA_CHALLENGE_TTL.toSeconds());
    }

    private boolean requiresMfa(Set<RoleName> roleNames) {
        List<String> required = properties.getSecurity().getMfaRequiredRoles();
        return roleNames.stream().anyMatch(role -> required.contains(role.name()));
    }

    private void registerFailure(User user, String email, String ip, HttpServletRequest http) {
        int limit = properties.getSecurity().getMaxFailedLogins();
        int count = user.getFailedLoginCount() + 1;
        user.setFailedLoginCount(count);

        if (count >= limit) {
            Instant until = Instant.now().plus(
                    Duration.ofMinutes(properties.getSecurity().getLockoutMinutes()));
            user.setLockedUntil(until);
            user.setFailedLoginCount(0);
            log.warn("Locked account {} until {} after {} failed attempts", user.getId(), until, limit);

            mail.sendTemplate("account.locked", user.getEmail(), Map.of(
                    "firstName", user.getFirstName(),
                    "lockoutMinutes", properties.getSecurity().getLockoutMinutes()));
        }

        users.save(user);
        recordAttempt(email, ip, false, "BAD_PASSWORD", http);
        audit.write(user.getId(), email, Constants.Audit.LOGIN_FAILED, "user", user.getId(),
                Map.of("failedCount", count), "WARN");
    }

    private void recordAttempt(
            String email, String ip, boolean successful, String reason, HttpServletRequest http) {
        try {
            LoginAttempt attempt = new LoginAttempt();
            attempt.setEmail(email);
            attempt.setIpAddress(ip);
            attempt.setSuccessful(successful);
            attempt.setReason(reason);
            attempt.setUserAgent(userAgent(http));
            loginAttempts.save(attempt);
        } catch (Exception ex) {
            log.error("Could not record a login attempt for {}", email, ex);
        }
    }

    // -----------------------------------------------------------------
    //  Session lifecycle
    // -----------------------------------------------------------------

    /**
     * A newly opened session together with its raw token.
     *
     * The raw token is returned alongside the row rather than stored on
     * it: only the SHA-256 hash is ever persisted, so this is the one
     * moment the plaintext exists, and it goes straight into a cookie.
     */
    private record OpenedSession(RefreshSession row, String rawToken) {}

    @Transactional
    public Tokens refresh(String rawToken, HttpServletRequest http) {
        if (rawToken == null || rawToken.isBlank()) {
            throw ApiException.unauthorized("There is no session to refresh.");
        }

        RefreshSession session = sessions.findByTokenHash(CryptoUtil.sha256Hex(rawToken))
                .orElseThrow(() -> ApiException.unauthorized("Your session has expired. Sign in again."));

        if (session.getRevokedAt() != null) {
            // A revoked token coming back means it was captured. The
            // legitimate holder has a newer one, so revoke the whole
            // family: whoever has the stolen copy loses it immediately.
            handleTokenReuse(session);
            throw ApiException.unauthorized("Your session has expired. Sign in again.");
        }

        if (session.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.unauthorized("Your session has expired. Sign in again.");
        }

        User user = users.findById(session.getUserId())
                .orElseThrow(() -> ApiException.unauthorized("Your session is no longer valid."));

        if (user.getStatus() != UserStatus.ACTIVE) {
            revokeAllSessions(user.getId(), "ACCOUNT_NOT_ACTIVE");
            throw ApiException.unauthorized("This account is not active.");
        }

        session.setRevokedAt(Instant.now());
        session.setRevokedReason("ROTATED");
        sessions.save(session);

        OpenedSession next = openSession(user, session.getId(), http);

        Set<RoleName> roleNames = permissionResolver.rolesOf(user);
        AuthenticatedUser principal = new AuthenticatedUser(
                user.getId(), user.getEmail(), roleNames,
                permissionResolver.permissionsFor(user), next.row().getId(), true);

        return new Tokens(
                jwt.issueAccessToken(principal), next.rawToken(), jwt.getAccessTtlSeconds());
    }

    private void handleTokenReuse(RefreshSession session) {
        log.error("Refresh token reuse detected for user {}; revoking every session", session.getUserId());

        audit.write(session.getUserId(), null, Constants.Audit.TOKEN_REUSE_DETECTED,
                "session", session.getId(),
                Map.of("revokedReason", String.valueOf(session.getRevokedReason())), "WARN");

        revokeAllSessions(session.getUserId(), "TOKEN_REUSE_DETECTED");

        users.findById(session.getUserId()).ifPresent(user ->
                mail.sendTemplate("security.session_revoked", user.getEmail(), Map.of(
                        "firstName", user.getFirstName())));
    }

    private OpenedSession openSession(User user, String previousId, HttpServletRequest http) {
        String raw = CryptoUtil.randomToken(48);

        RefreshSession session = new RefreshSession();
        session.setUserId(user.getId());
        session.setTokenHash(CryptoUtil.sha256Hex(raw));
        session.setPreviousId(previousId);
        session.setUserAgent(userAgent(http));
        session.setIpAddress(clientIp(http));
        session.setExpiresAt(Instant.now().plusSeconds(properties.getJwt().getRefreshTtlSeconds()));

        return new OpenedSession(sessions.save(session), raw);
    }

    @Transactional
    public String logout(String rawToken, String userId) {
        if (rawToken != null && !rawToken.isBlank()) {
            sessions.findByTokenHash(CryptoUtil.sha256Hex(rawToken)).ifPresent(session -> {
                session.setRevokedAt(Instant.now());
                session.setRevokedReason("USER_LOGOUT");
                sessions.save(session);
            });
        }

        audit.write(userId, null, Constants.Audit.LOGOUT, "user", userId, null, "INFO");
        return "Signed out.";
    }

    @Transactional
    public int revokeAllSessions(String userId, String reason) {
        return sessions.revokeAllForUser(userId, Instant.now(), reason);
    }

    @Transactional(readOnly = true)
    public List<SessionResponse> listSessions(String userId, String currentSessionId) {
        return sessions.findByUserIdAndRevokedAtIsNull(userId).stream()
                .filter(session -> session.getExpiresAt().isAfter(Instant.now()))
                .map(session -> new SessionResponse(
                        session.getId(),
                        session.getUserAgent(),
                        session.getIpAddress(),
                        session.getCreatedAt(),
                        session.getExpiresAt(),
                        session.getId().equals(currentSessionId)))
                .toList();
    }

    // -----------------------------------------------------------------
    //  Passwords
    // -----------------------------------------------------------------

    /**
     * Always reports the same thing, whether or not the address exists.
     *
     * Otherwise "forgot password" becomes an account-enumeration oracle
     * that needs no credentials at all.
     */
    @Transactional
    public String requestPasswordReset(String rawEmail, HttpServletRequest http) {
        String email = CryptoUtil.normaliseEmail(rawEmail);
        String neutral = "If that address has an account, a reset link is on its way.";

        Optional<User> found = users.findByEmailIgnoreCase(email);
        if (found.isEmpty()) {
            audit.recordAnonymous(Constants.Audit.PASSWORD_RESET_REQUESTED, email,
                    Map.of("outcome", "no-account"), "INFO");
            return neutral;
        }

        User user = found.get();
        resetTokens.deleteByUserId(user.getId());

        String raw = CryptoUtil.randomToken();
        PasswordResetToken token = new PasswordResetToken();
        token.setUserId(user.getId());
        token.setTokenHash(CryptoUtil.sha256Hex(raw));
        token.setExpiresAt(Instant.now().plus(RESET_TOKEN_TTL));
        token.setRequestIp(clientIp(http));
        resetTokens.save(token);

        mail.sendTemplate("account.password_reset", user.getEmail(), Map.of(
                "firstName", user.getFirstName(),
                "resetUrl", properties.getFrontendUrl() + "/reset-password?token=" + raw,
                "expiresInMinutes", RESET_TOKEN_TTL.toMinutes()));

        audit.write(user.getId(), email, Constants.Audit.PASSWORD_RESET_REQUESTED,
                "user", user.getId(), null, "INFO");

        return neutral;
    }

    @Transactional
    public String resetPassword(String rawToken, String newPassword) {
        PasswordResetToken token = resetTokens.findByTokenHash(CryptoUtil.sha256Hex(rawToken))
                .orElseThrow(() -> ApiException.badRequest(
                        "That reset link is not valid. Request a new one."));

        if (token.getUsedAt() != null) {
            throw ApiException.badRequest("That reset link has already been used.");
        }
        if (token.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.badRequest("That reset link has expired. Request a new one.");
        }

        User user = users.findById(token.getUserId())
                .orElseThrow(() -> ApiException.badRequest("That reset link is not valid."));

        if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
            throw ApiException.badRequest("Choose a password you have not used here before.");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setFailedLoginCount(0);
        user.setLockedUntil(null);
        if (user.getStatus() == UserStatus.PENDING_VERIFICATION && user.getEmailVerifiedAt() == null) {
            // Following an emailed link proves control of the address.
            user.setEmailVerifiedAt(Instant.now());
            user.setStatus(UserStatus.ACTIVE);
        }
        users.save(user);

        token.setUsedAt(Instant.now());
        resetTokens.save(token);

        // The reset may well be a response to a compromise.
        revokeAllSessions(user.getId(), "PASSWORD_RESET");

        audit.write(user.getId(), user.getEmail(), Constants.Audit.PASSWORD_RESET_COMPLETED,
                "user", user.getId(), null, "WARN");

        mail.sendTemplate("account.password_changed", user.getEmail(), Map.of(
                "firstName", user.getFirstName()));

        return "Your password is updated. Sign in with the new one.";
    }

    @Transactional
    public String changePassword(String userId, String currentPassword, String newPassword) {
        User user = users.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User"));

        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            audit.write(userId, user.getEmail(), Constants.Audit.PASSWORD_CHANGED, "user", userId,
                    Map.of("outcome", "wrong-current-password"), "WARN");
            throw ApiException.badRequest("Your current password is not correct.");
        }

        if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
            throw ApiException.badRequest("The new password must differ from the current one.");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        users.save(user);

        revokeAllSessions(userId, "PASSWORD_CHANGED");

        audit.write(userId, user.getEmail(), Constants.Audit.PASSWORD_CHANGED,
                "user", userId, null, "WARN");

        mail.sendTemplate("account.password_changed", user.getEmail(), Map.of(
                "firstName", user.getFirstName()));

        return "Your password is updated. Sign in again on each of your devices.";
    }

    // -----------------------------------------------------------------
    //  MFA enrolment
    // -----------------------------------------------------------------

    @Transactional
    public MfaSetupResponse beginMfaSetup(String userId) {
        User user = users.findById(userId).orElseThrow(() -> ApiException.notFound("User"));

        if (user.isMfaEnabled()) {
            throw ApiException.conflict(
                    "Two-factor authentication is already on. Turn it off first to re-enrol.");
        }

        // Stored unconfirmed: until /mfa/confirm succeeds, mfaEnabled
        // stays false, so an abandoned enrolment cannot lock anyone out.
        String secret = mfa.generateSecret();
        user.setMfaSecret(secret);
        users.save(user);

        return new MfaSetupResponse(secret, mfa.otpauthUri(user.getEmail(), secret), mfa.issuer());
    }

    @Transactional
    public MfaConfirmResponse confirmMfaSetup(String userId, String code) {
        User user = users.findById(userId).orElseThrow(() -> ApiException.notFound("User"));

        if (user.getMfaSecret() == null) {
            throw ApiException.badRequest("Start enrolment first.");
        }
        if (!mfa.verifyCode(user.getMfaSecret(), code)) {
            throw ApiException.badRequest("That code is not valid. Check your authenticator app's clock.");
        }

        List<String> recoveryCodes = mfa.generateRecoveryCodes();
        user.setMfaEnabled(true);
        user.setMfaRecoveryCodes(mfa.hashRecoveryCodes(recoveryCodes));
        users.save(user);

        audit.write(userId, user.getEmail(), Constants.Audit.MFA_ENABLED, "user", userId, null, "INFO");

        return new MfaConfirmResponse(
                "Two-factor authentication is on. Save these recovery codes — "
                        + "they are shown only once.",
                recoveryCodes);
    }

    @Transactional
    public String disableMfa(String userId, String currentPassword) {
        User user = users.findById(userId).orElseThrow(() -> ApiException.notFound("User"));

        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw ApiException.badRequest("Your current password is not correct.");
        }
        if (requiresMfa(permissionResolver.rolesOf(user))) {
            throw ApiException.forbidden(
                    "Your role requires two-factor authentication; it cannot be turned off.");
        }

        user.setMfaEnabled(false);
        user.setMfaSecret(null);
        user.setMfaRecoveryCodes(null);
        users.save(user);

        audit.write(userId, user.getEmail(), Constants.Audit.MFA_DISABLED, "user", userId, null, "WARN");

        return "Two-factor authentication is off.";
    }

    // -----------------------------------------------------------------
    //  Profile
    // -----------------------------------------------------------------

    @Transactional(readOnly = true)
    public CurrentUserResponse getProfile(String userId) {
        User user = users.findById(userId).orElseThrow(() -> ApiException.notFound("User"));
        return profileOf(
                user, permissionResolver.rolesOf(user), permissionResolver.permissionsFor(user));
    }

    private CurrentUserResponse profileOf(User user, Set<RoleName> roleNames, Set<String> permissions) {
        CandidateProfile profile = candidates.findByUserId(user.getId()).orElse(null);

        return new CurrentUserResponse(
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getPhone(),
                user.getStatus().name(),
                user.isMfaEnabled(),
                user.getEmailVerifiedAt() != null,
                new LinkedHashSet<>(roleNames),
                new ArrayList<>(permissions),
                profile == null ? null : profile.getId(),
                profile == null ? null : profile.getCandidateCode(),
                user.getLastLoginAt());
    }

    // -----------------------------------------------------------------

    private String clientIp(HttpServletRequest http) {
        if (http == null) {
            return null;
        }
        String forwarded = http.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            String first = forwarded.split(",")[0].trim();
            if (!first.isEmpty()) {
                return first.length() > 45 ? first.substring(0, 45) : first;
            }
        }
        return http.getRemoteAddr();
    }

    private String userAgent(HttpServletRequest http) {
        if (http == null) {
            return null;
        }
        String agent = http.getHeader("User-Agent");
        if (agent == null) {
            return null;
        }
        return agent.length() > 400 ? agent.substring(0, 400) : agent;
    }
}
