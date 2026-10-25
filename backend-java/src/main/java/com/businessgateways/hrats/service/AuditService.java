package com.businessgateways.hrats.service;

import com.businessgateways.hrats.common.Constants;
import com.businessgateways.hrats.domain.entity.AuditLog;
import com.businessgateways.hrats.repository.AuditLogRepository;
import com.businessgateways.hrats.security.AuthenticatedUser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Map;

/**
 * Writes the security and activity audit trail.
 *
 * Two properties matter more than throughput here:
 *
 * <ul>
 *   <li><b>A failed audit write must not fail the request.</b> Every
 *       call is wrapped, so a full disk cannot stop people logging in.</li>
 *   <li><b>An audit row must survive a rolled-back transaction.</b>
 *       REQUIRES_NEW means a rejected action is still recorded — a
 *       denied access attempt is exactly what you want in the log.</li>
 * </ul>
 */
@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    private static final String SEVERITY_INFO = "INFO";
    private static final String SEVERITY_WARN = "WARN";

    private final AuditLogRepository repository;
    private final ObjectMapper objectMapper;

    public AuditService(AuditLogRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    public void record(AuthenticatedUser actor, String action, String entityType, String entityId) {
        record(actor, action, entityType, entityId, null, SEVERITY_INFO);
    }

    public void record(
            AuthenticatedUser actor,
            String action,
            String entityType,
            String entityId,
            Map<String, ?> metadata) {
        record(actor, action, entityType, entityId, metadata, SEVERITY_INFO);
    }

    /** For denials, lockouts and token reuse — anything a reviewer should notice. */
    public void recordSecurityEvent(
            AuthenticatedUser actor,
            String action,
            String entityType,
            String entityId,
            Map<String, ?> metadata) {
        record(actor, action, entityType, entityId, metadata, SEVERITY_WARN);
    }

    /**
     * Records an event for a caller who is not authenticated yet —
     * a failed login, a password-reset request.
     */
    public void recordAnonymous(String action, String email, Map<String, ?> metadata, String severity) {
        write(null, email, action, "auth", email, metadata, severity);
    }

    public void record(
            AuthenticatedUser actor,
            String action,
            String entityType,
            String entityId,
            Map<String, ?> metadata,
            String severity) {
        write(
                actor == null ? null : actor.userId(),
                actor == null ? null : actor.email(),
                action, entityType, entityId, metadata, severity);
    }

    /**
     * Runs on a separate thread and its own transaction.
     *
     * Asynchronous because the caller should not wait on an insert that
     * has no bearing on their response; REQUIRES_NEW so the row is kept
     * even when the business transaction rolls back.
     */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(
            String actorUserId,
            String actorEmail,
            String action,
            String entityType,
            String entityId,
            Map<String, ?> metadata,
            String severity) {

        try {
            AuditLog entry = new AuditLog();
            entry.setActorUserId(actorUserId);
            entry.setActorEmail(actorEmail);
            entry.setAction(action);
            entry.setEntityType(entityType);
            entry.setEntityId(truncate(entityId, 64));
            entry.setMetadata(serialise(metadata));
            entry.setSeverity(severity);
            entry.setRequestId(MDC.get("requestId"));

            currentRequest().ifPresent(request -> {
                entry.setIpAddress(clientIp(request));
                entry.setUserAgent(truncate(request.getHeader("User-Agent"), 400));
            });

            repository.save(entry);

        } catch (Exception ex) {
            // Never let the audit trail break the request it describes.
            log.error("Failed to write audit entry for action \"{}\"", action, ex);
        }
    }

    /**
     * The real client address.
     *
     * Kong terminates the client connection, so the socket address is
     * the Docker bridge. The left-most entry of X-Forwarded-For is the
     * original client — trusted only because Kong rewrites this header
     * rather than appending to whatever the caller sent.
     */
    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            String first = forwarded.split(",")[0].trim();
            if (!first.isEmpty()) {
                return truncate(first, 45);
            }
        }
        return truncate(request.getRemoteAddr(), 45);
    }

    private java.util.Optional<HttpServletRequest> currentRequest() {
        // Absent when called from a scheduled job rather than a request.
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            return java.util.Optional.of(attributes.getRequest());
        }
        return java.util.Optional.empty();
    }

    private String serialise(Map<String, ?> metadata) {
        if (metadata == null || metadata.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (JsonProcessingException ex) {
            log.warn("Audit metadata could not be serialised; storing a placeholder", ex);
            return "{\"error\":\"metadata could not be serialised\"}";
        }
    }

    private String truncate(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
