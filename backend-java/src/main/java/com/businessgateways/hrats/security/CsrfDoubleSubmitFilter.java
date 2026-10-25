package com.businessgateways.hrats.security;

import com.businessgateways.hrats.common.Constants;
import com.businessgateways.hrats.common.CryptoUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Double-submit-cookie CSRF protection.
 *
 * The attack this stops: a third-party page causes the browser to issue
 * a state-changing request to this API, and the browser helpfully
 * attaches our HTTP-only session cookie. The defence is that the
 * attacker's script cannot READ our CSRF cookie — the same-origin
 * policy forbids it — so it cannot echo the value back in a header.
 *
 * Only cookie-authenticated requests are subject to it. A Bearer token
 * is never attached automatically by a browser, so it carries no CSRF
 * risk and is exempt.
 */
@Component
public class CsrfDoubleSubmitFilter extends OncePerRequestFilter {

    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS", "TRACE");

    /**
     * Endpoints that establish a session cannot require a CSRF token
     * that does not exist yet.
     */
    private static final List<String> EXEMPT_SUFFIXES = List.of(
            "/auth/login",
            "/auth/register",
            "/auth/refresh",
            "/auth/forgot-password",
            "/auth/reset-password",
            "/auth/verify-email",
            "/auth/resend-verification",
            "/auth/csrf");

    private final ObjectMapper objectMapper;

    public CsrfDoubleSubmitFilter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain chain) throws ServletException, IOException {

        if (!requiresCsrfCheck(request)) {
            chain.doFilter(request, response);
            return;
        }

        String cookieToken = readCookie(request, Constants.CSRF_COOKIE);
        String headerToken = request.getHeader(Constants.CSRF_HEADER);

        if (cookieToken == null || headerToken == null
                || !CryptoUtil.safeEquals(cookieToken, headerToken)) {
            reject(request, response);
            return;
        }

        chain.doFilter(request, response);
    }

    private boolean requiresCsrfCheck(HttpServletRequest request) {
        if (SAFE_METHODS.contains(request.getMethod())) {
            return false;
        }

        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")) {
            return false;
        }

        if (readCookie(request, Constants.ACCESS_COOKIE) == null) {
            return false;
        }

        String path = request.getRequestURI();
        return EXEMPT_SUFFIXES.stream().noneMatch(path::endsWith);
    }

    private void reject(HttpServletRequest request, HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), Map.of(
                "statusCode", HttpStatus.FORBIDDEN.value(),
                "error", "Forbidden",
                "message", "CSRF token missing or invalid. Fetch " + request.getContextPath()
                        + "/api/auth/csrf and send the value in the "
                        + Constants.CSRF_HEADER + " header.",
                "timestamp", Instant.now().toString(),
                "path", request.getRequestURI()));
    }

    private String readCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (name.equals(cookie.getName()) && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
