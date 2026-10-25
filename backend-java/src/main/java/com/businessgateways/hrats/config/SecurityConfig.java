package com.businessgateways.hrats.config;

import com.businessgateways.hrats.security.CsrfDoubleSubmitFilter;
import com.businessgateways.hrats.security.GatewayRequestFilter;
import com.businessgateways.hrats.security.JwtAuthenticationFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * The HTTP security chain.
 *
 * Everything is denied unless a rule allows it, sessions are stateless,
 * and authorization is enforced per-endpoint with method security on
 * permission keys rather than with path patterns — a path pattern is
 * too easy to bypass with an unexpected URL spelling.
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

    /**
     * Routes reachable without a session: the careers portal, the auth
     * entry points, health, and the API documentation.
     */
    private static final String[] PUBLIC_PATHS = {
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/refresh",
        "/api/auth/logout",
        "/api/auth/csrf",
        "/api/auth/forgot-password",
        "/api/auth/reset-password",
        "/api/auth/verify-email",
        "/api/auth/resend-verification",
        "/api/auth/mfa/challenge",
        "/api/public/**",
        "/api/health",
        "/api/health/**",
        "/api/actuator/health",
        "/api/docs",
        "/api/docs/**",
        "/api/docs-json",
        "/api/docs-json/**",
        "/swagger-ui/**",
        "/v3/api-docs/**",
    };

    private final HrAtsProperties properties;
    private final ObjectMapper objectMapper;

    public SecurityConfig(HrAtsProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    /**
     * Argon2id with the same parameters the Node backend used.
     *
     * These must not be changed casually: the 249 password hashes
     * already in the database encode m=19456, t=2, p=1, and
     * {@code Argon2CompatibilityTest} pins the values so a well-meaning
     * tune-up cannot lock every existing user out.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new Argon2PasswordEncoder(16, 32, 1, 19456, 2);
    }

    @Bean
    public SecurityFilterChain filterChain(
            HttpSecurity http,
            GatewayRequestFilter gatewayRequestFilter,
            JwtAuthenticationFilter jwtAuthenticationFilter,
            CsrfDoubleSubmitFilter csrfDoubleSubmitFilter) throws Exception {

        http
            .cors(Customizer.withDefaults())
            // Spring's own CSRF support is disabled in favour of the
            // double-submit filter, which matches what the SPA already
            // implements against the Node backend.
            .csrf(AbstractHttpConfigurer::disable)
            .httpBasic(AbstractHttpConfigurer::disable)
            .formLogin(AbstractHttpConfigurer::disable)
            .logout(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .headers(headers -> headers
                    .frameOptions(frame -> frame.deny())
                    .contentTypeOptions(Customizer.withDefaults())
                    .referrerPolicy(referrer -> referrer.policy(
                            org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter
                                    .ReferrerPolicy.NO_REFERRER))
                    .httpStrictTransportSecurity(hsts -> hsts
                            .includeSubDomains(true)
                            .maxAgeInSeconds(31536000)))
            .authorizeHttpRequests(auth -> auth
                    .requestMatchers(org.springframework.http.HttpMethod.OPTIONS, "/**").permitAll()
                    .requestMatchers(PUBLIC_PATHS).permitAll()
                    .anyRequest().authenticated())
            .exceptionHandling(handling -> handling
                    .authenticationEntryPoint(this::writeUnauthorized)
                    .accessDeniedHandler((request, response, ex) ->
                            writeProblem(request, response, HttpStatus.FORBIDDEN,
                                    "You do not have permission to perform this action.")))
            .addFilterBefore(gatewayRequestFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterAfter(csrfDoubleSubmitFilter, JwtAuthenticationFilter.class);

        return http.build();
    }

    private void writeUnauthorized(
            HttpServletRequest request,
            HttpServletResponse response,
            org.springframework.security.core.AuthenticationException ex) throws IOException {
        writeProblem(request, response, HttpStatus.UNAUTHORIZED, "Authentication required.");
    }

    /**
     * Error bodies carry no internal detail on purpose — the exact
     * reason a token was rejected is useful to an attacker and useless
     * to a legitimate client, which simply needs to re-authenticate.
     */
    private void writeProblem(
            HttpServletRequest request,
            HttpServletResponse response,
            HttpStatus status,
            String message) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), Map.of(
                "statusCode", status.value(),
                "error", status.getReasonPhrase(),
                "message", message,
                "timestamp", Instant.now().toString(),
                "path", request.getRequestURI()));
    }

    /**
     * CORS for the SPA.
     *
     * Credentials are allowed, so the origin list must be explicit — a
     * wildcard is rejected by the browser in that combination anyway.
     * {@code check-cors-consistency.mjs} fails the build if this list
     * and Kong's drift apart, because a mismatch produces exactly the
     * kind of intermittent failure that is miserable to diagnose.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        List<String> origins = properties.getSecurity().getCorsOrigins();
        if (origins.isEmpty()) {
            log.warn("CORS_ORIGINS is empty; browser clients on another origin will be refused.");
        } else {
            log.info("CORS enabled for: {}", String.join(", ", origins));
        }

        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(origins);
        config.setAllowedMethods(List.of("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of(
                "Content-Type", "Authorization", "X-CSRF-Token", "X-Request-Id", "Accept"));
        config.setExposedHeaders(List.of(
                "Content-Disposition", "X-Request-Id", "X-Total-Count"));
        config.setAllowCredentials(true);
        config.setMaxAge(600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
