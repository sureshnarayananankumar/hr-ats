package com.businessgateways.hrats.controller;

import com.businessgateways.hrats.common.ApiException;
import com.businessgateways.hrats.common.Constants;
import com.businessgateways.hrats.common.CryptoUtil;
import com.businessgateways.hrats.dto.AuthDtos.ChangePasswordRequest;
import com.businessgateways.hrats.dto.AuthDtos.CsrfResponse;
import com.businessgateways.hrats.dto.AuthDtos.CurrentUserResponse;
import com.businessgateways.hrats.dto.AuthDtos.ForgotPasswordRequest;
import com.businessgateways.hrats.dto.AuthDtos.LoginRequest;
import com.businessgateways.hrats.dto.AuthDtos.LoginResponse;
import com.businessgateways.hrats.dto.AuthDtos.MessageResponse;
import com.businessgateways.hrats.dto.AuthDtos.MfaCodeRequest;
import com.businessgateways.hrats.dto.AuthDtos.MfaConfirmResponse;
import com.businessgateways.hrats.dto.AuthDtos.MfaSetupResponse;
import com.businessgateways.hrats.dto.AuthDtos.RefreshResponse;
import com.businessgateways.hrats.dto.AuthDtos.RegisterRequest;
import com.businessgateways.hrats.dto.AuthDtos.ResetPasswordRequest;
import com.businessgateways.hrats.dto.AuthDtos.SessionResponse;
import com.businessgateways.hrats.dto.AuthDtos.VerifyEmailRequest;
import com.businessgateways.hrats.security.AuthenticatedUser;
import com.businessgateways.hrats.security.CookieFactory;
import com.businessgateways.hrats.service.AuthService;
import com.businessgateways.hrats.service.AuthService.LoginOutcome;
import com.businessgateways.hrats.service.AuthService.Tokens;
import com.businessgateways.hrats.service.RateLimiter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Authentication endpoints.
 *
 * Tokens are returned as HTTP-only cookies rather than in the response
 * body, so that script on the page can never read them. The body
 * carries only what the UI needs to render: the profile and the access
 * token's lifetime, which drives the silent-refresh timer.
 */
@RestController
@RequestMapping("${hrats.api-prefix:/api}/auth")
@Tag(name = "Authentication", description = "Sign-in, sessions, MFA and password management")
public class AuthController {

    private final AuthService auth;
    private final CookieFactory cookies;
    private final RateLimiter rateLimiter;

    public AuthController(AuthService auth, CookieFactory cookies, RateLimiter rateLimiter) {
        this.auth = auth;
        this.cookies = cookies;
        this.rateLimiter = rateLimiter;
    }

    // -----------------------------------------------------------------
    //  Registration and verification
    // -----------------------------------------------------------------

    @PostMapping("/register")
    @Operation(summary = "Register a candidate account from the public careers portal")
    public MessageResponse register(
            @Valid @RequestBody RegisterRequest request, HttpServletRequest http) {
        rateLimiter.check("register", http, rateLimiter.registerLimit());
        return MessageResponse.of(auth.registerCandidate(request, http));
    }

    @PostMapping("/verify-email")
    @Operation(summary = "Confirm an email address using the emailed token")
    public MessageResponse verifyEmail(
            @Valid @RequestBody VerifyEmailRequest request, HttpServletRequest http) {
        rateLimiter.check("verify", http, rateLimiter.resetLimit());
        return MessageResponse.of(auth.verifyEmail(request.token()));
    }

    @PostMapping("/resend-verification")
    @Operation(summary = "Send the verification email again")
    public MessageResponse resendVerification(
            @Valid @RequestBody ForgotPasswordRequest request, HttpServletRequest http) {
        rateLimiter.check("resend", http, rateLimiter.resetLimit());
        auth.resendVerification(request.email());
        // Same answer either way, so this cannot be used to discover
        // which addresses are registered.
        return MessageResponse.of("If that address needs verifying, a new link is on its way.");
    }

    // -----------------------------------------------------------------
    //  Login
    // -----------------------------------------------------------------

    @PostMapping("/login")
    @Operation(summary = "Sign in with email and password")
    public ResponseEntity<LoginResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest http,
            HttpServletResponse response) {

        rateLimiter.check("login", http, rateLimiter.loginLimit());

        LoginOutcome outcome = auth.login(request.email(), request.password(), http);

        if (outcome.mfaRequired()) {
            // A half-authenticated cookie, good for five minutes and
            // accepted only by /auth/mfa/verify.
            response.addHeader(HttpHeaders.SET_COOKIE, cookies
                    .mfaChallenge(outcome.mfaChallengeToken(), java.time.Duration.ofMinutes(5))
                    .toString());
            return ResponseEntity.ok(LoginResponse.challenge());
        }

        applySession(response, outcome.tokens());
        return ResponseEntity.ok(
                LoginResponse.success(outcome.user(), outcome.tokens().expiresIn()));
    }

    @PostMapping("/mfa/verify")
    @Operation(summary = "Complete the MFA challenge and receive a full session")
    public LoginResponse verifyMfa(
            @Valid @RequestBody MfaCodeRequest request,
            @AuthenticationPrincipal AuthenticatedUser caller,
            HttpServletRequest http,
            HttpServletResponse response) {

        requireCaller(caller);
        rateLimiter.check("mfa", http, rateLimiter.loginLimit());

        LoginOutcome outcome = auth.verifyMfa(caller.userId(), request.code(), http);
        applySession(response, outcome.tokens());
        return LoginResponse.success(outcome.user(), outcome.tokens().expiresIn());
    }

    @PostMapping("/mfa/setup")
    @Operation(summary = "Begin MFA enrolment; returns a TOTP secret and otpauth URI")
    public MfaSetupResponse beginMfaSetup(@AuthenticationPrincipal AuthenticatedUser caller) {
        requireCaller(caller);
        return auth.beginMfaSetup(caller.userId());
    }

    @PostMapping("/mfa/confirm")
    @Operation(summary = "Confirm MFA enrolment; returns one-time recovery codes")
    public MfaConfirmResponse confirmMfaSetup(
            @Valid @RequestBody MfaCodeRequest request,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        requireCaller(caller);
        return auth.confirmMfaSetup(caller.userId(), request.code());
    }

    @PostMapping("/mfa/disable")
    @Operation(summary = "Turn off MFA, confirming with the account password")
    public MessageResponse disableMfa(
            @Valid @RequestBody ChangePasswordRequest request,
            @AuthenticationPrincipal AuthenticatedUser caller) {
        requireCaller(caller);
        // Only currentPassword is read here; newPassword is ignored.
        return MessageResponse.of(auth.disableMfa(caller.userId(), request.currentPassword()));
    }

    // -----------------------------------------------------------------
    //  Session lifecycle
    // -----------------------------------------------------------------

    @PostMapping("/refresh")
    @Operation(summary = "Rotate the refresh token and issue a new access token")
    public RefreshResponse refresh(
            @CookieValue(name = Constants.REFRESH_COOKIE, required = false) String refreshToken,
            HttpServletRequest http,
            HttpServletResponse response) {

        Tokens tokens = auth.refresh(refreshToken, http);
        applySession(response, tokens);
        return new RefreshResponse(tokens.expiresIn());
    }

    @PostMapping("/logout")
    @Operation(summary = "Revoke the current session and clear the cookies")
    public MessageResponse logout(
            @CookieValue(name = Constants.REFRESH_COOKIE, required = false) String refreshToken,
            @AuthenticationPrincipal AuthenticatedUser caller,
            HttpServletResponse response) {

        String message = auth.logout(refreshToken, caller == null ? null : caller.userId());
        clearCookies(response);
        return MessageResponse.of(message);
    }

    @PostMapping("/logout-all")
    @Operation(summary = "Revoke every session for the current user")
    public MessageResponse logoutAll(
            @AuthenticationPrincipal AuthenticatedUser caller, HttpServletResponse response) {

        requireCaller(caller);
        int revoked = auth.revokeAllSessions(caller.userId(), "USER_LOGOUT_ALL");
        clearCookies(response);
        return MessageResponse.of("Signed out of " + revoked + " session(s).");
    }

    @GetMapping("/sessions")
    @Operation(summary = "List the current user's active sessions")
    public List<SessionResponse> sessions(@AuthenticationPrincipal AuthenticatedUser caller) {
        requireCaller(caller);
        return auth.listSessions(caller.userId(), caller.sessionId());
    }

    // -----------------------------------------------------------------
    //  Passwords
    // -----------------------------------------------------------------

    @PostMapping("/forgot-password")
    @Operation(summary = "Request a password-reset email")
    public MessageResponse forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request, HttpServletRequest http) {
        rateLimiter.check("forgot", http, rateLimiter.resetLimit());
        return MessageResponse.of(auth.requestPasswordReset(request.email(), http));
    }

    @PostMapping("/reset-password")
    @Operation(summary = "Set a new password using an emailed reset token")
    public MessageResponse resetPassword(
            @Valid @RequestBody ResetPasswordRequest request, HttpServletRequest http) {
        rateLimiter.check("reset", http, rateLimiter.resetLimit());
        return MessageResponse.of(auth.resetPassword(request.token(), request.newPassword()));
    }

    @PostMapping("/change-password")
    @Operation(summary = "Change your own password; ends every session")
    public MessageResponse changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            @AuthenticationPrincipal AuthenticatedUser caller,
            HttpServletResponse response) {

        requireCaller(caller);
        String message = auth.changePassword(
                caller.userId(), request.currentPassword(), request.newPassword());
        clearCookies(response);
        return MessageResponse.of(message);
    }

    // -----------------------------------------------------------------

    @GetMapping("/me")
    @Operation(summary = "Current user's profile, roles and permissions")
    public CurrentUserResponse me(@AuthenticationPrincipal AuthenticatedUser caller) {
        requireCaller(caller);
        return auth.getProfile(caller.userId());
    }

    /**
     * Issues the CSRF token.
     *
     * Public, because the SPA needs a token before it can log in. That
     * is safe: the token is worthless to an attacker who cannot read it
     * back out of the cookie, which the same-origin policy prevents.
     */
    @GetMapping("/csrf")
    @Operation(summary = "Issue a CSRF token for the double-submit cookie pattern")
    public CsrfResponse csrf(HttpServletResponse response) {
        String token = CryptoUtil.randomToken(24);
        response.addHeader(HttpHeaders.SET_COOKIE, cookies.csrf(token).toString());
        return new CsrfResponse(token);
    }

    // -----------------------------------------------------------------

    private void applySession(HttpServletResponse response, Tokens tokens) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookies.access(tokens.accessToken()).toString());
        response.addHeader(HttpHeaders.SET_COOKIE, cookies.refresh(tokens.refreshToken()).toString());
    }

    private void clearCookies(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookies.clearAccess().toString());
        response.addHeader(HttpHeaders.SET_COOKIE, cookies.clearRefresh().toString());
        response.addHeader(HttpHeaders.SET_COOKIE, cookies.clearCsrf().toString());
    }

    private void requireCaller(AuthenticatedUser caller) {
        if (caller == null) {
            throw ApiException.unauthorized("Authentication required.");
        }
    }
}
