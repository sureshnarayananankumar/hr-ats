package com.businessgateways.hrats.security;

import com.businessgateways.hrats.common.Constants;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

/**
 * Reads the access token from the HTTP-only cookie (or an Authorization
 * header) and populates the security context.
 *
 * Each permission key becomes a granted authority verbatim, so a
 * controller can write {@code @PreAuthorize("hasAuthority('job.create')")}
 * and roles additionally appear as {@code ROLE_*} for the few places
 * where role identity, not capability, is what matters.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtService jwtService;

    public JwtAuthenticationFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain chain) throws ServletException, IOException {

        // Never overwrite an authentication another filter established.
        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            extractToken(request)
                    .flatMap(jwtService::verifyAccessToken)
                    .ifPresent(user -> authenticate(request, user));
        }

        chain.doFilter(request, response);
    }

    private void authenticate(HttpServletRequest request, AuthenticatedUser user) {
        List<SimpleGrantedAuthority> authorities = java.util.stream.Stream.concat(
                        user.permissions().stream().map(SimpleGrantedAuthority::new),
                        user.roles().stream().map(role -> new SimpleGrantedAuthority("ROLE_" + role.name())))
                .toList();

        var authentication = new UsernamePasswordAuthenticationToken(user, null, authorities);
        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    /**
     * Cookie first, then {@code Authorization: Bearer}.
     *
     * The cookie is what the browser SPA uses. The header exists for
     * server-to-server callers and for the API documentation's "try it"
     * button, and is exempt from CSRF precisely because a browser never
     * attaches it automatically.
     */
    private Optional<String> extractToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if (Constants.ACCESS_COOKIE.equals(cookie.getName())
                        && cookie.getValue() != null
                        && !cookie.getValue().isBlank()) {
                    return Optional.of(cookie.getValue());
                }
            }
        }

        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith(BEARER_PREFIX)) {
            String token = header.substring(BEARER_PREFIX.length()).trim();
            if (!token.isEmpty()) {
                return Optional.of(token);
            }
        }

        return Optional.empty();
    }
}
