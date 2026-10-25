package com.businessgateways.hrats.service;

import com.businessgateways.hrats.common.ApiException;
import com.businessgateways.hrats.config.HrAtsProperties;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Per-IP sliding-window rate limiting for the sensitive auth endpoints.
 *
 * Kong rate-limits these routes too, and that is the primary control.
 * This is the second layer, for the case where a request reaches the
 * container without passing through the gateway — otherwise a direct
 * connection to the API would face no limit at all.
 *
 * In-memory and per-instance: with one API container that is exactly
 * right, and if the deployment is ever scaled out, Kong's shared
 * counters remain the authoritative limit.
 */
@Service
public class RateLimiter {

    private static final Logger log = LoggerFactory.getLogger(RateLimiter.class);

    private static final Duration WINDOW = Duration.ofMinutes(1);

    /** Stops a flood of distinct source addresses from exhausting memory. */
    private static final int MAX_TRACKED_KEYS = 50_000;

    private final Map<String, Deque<Instant>> hits = new ConcurrentHashMap<>();
    private final HrAtsProperties.Security config;

    public RateLimiter(HrAtsProperties properties) {
        this.config = properties.getSecurity();
    }

    public int loginLimit() {
        return config.getLoginRateLimit();
    }

    public int registerLimit() {
        return config.getRegisterRateLimit();
    }

    public int resetLimit() {
        return config.getResetRateLimit();
    }

    public int publicLimit() {
        return config.getPublicRateLimit();
    }

    /**
     * Records one hit and throws 429 if the bucket is over its limit.
     *
     * @param bucket a name such as "login", so that attempts against
     *               different endpoints do not consume each other's
     *               allowance
     */
    public void check(String bucket, HttpServletRequest request, int limit) {
        if (limit <= 0) {
            return;
        }

        String key = bucket + "|" + clientIp(request);
        Instant now = Instant.now();
        Instant cutoff = now.minus(WINDOW);

        Deque<Instant> window = hits.computeIfAbsent(key, ignored -> new ArrayDeque<>());

        // Synchronised on the deque itself: contention is per-key, so
        // two different addresses never wait on each other.
        synchronized (window) {
            while (!window.isEmpty() && window.peekFirst().isBefore(cutoff)) {
                window.pollFirst();
            }

            if (window.size() >= limit) {
                log.warn("Rate limit reached for {} ({} in the last {}s)", key, window.size(), WINDOW.toSeconds());
                throw ApiException.tooManyRequests(
                        "Too many attempts. Wait a minute and try again.");
            }

            window.addLast(now);
        }

        if (hits.size() > MAX_TRACKED_KEYS) {
            sweep();
        }
    }

    /** Drops windows that have gone quiet, so the map does not grow without bound. */
    @Scheduled(fixedDelay = 300_000L, initialDelay = 300_000L)
    public void sweep() {
        Instant cutoff = Instant.now().minus(WINDOW);
        int before = hits.size();

        hits.entrySet().removeIf(entry -> {
            Deque<Instant> window = entry.getValue();
            synchronized (window) {
                while (!window.isEmpty() && window.peekFirst().isBefore(cutoff)) {
                    window.pollFirst();
                }
                return window.isEmpty();
            }
        });

        if (before != hits.size()) {
            log.debug("Rate limiter swept {} idle key(s)", before - hits.size());
        }
    }

    private String clientIp(HttpServletRequest request) {
        if (request == null) {
            return "unknown";
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            String first = forwarded.split(",")[0].trim();
            if (!first.isEmpty()) {
                return first;
            }
        }
        return request.getRemoteAddr();
    }
}
