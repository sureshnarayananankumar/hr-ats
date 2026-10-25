package com.businessgateways.hrats.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.NoHandlerFoundException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Turns every exception into one consistent JSON shape.
 *
 * The shape matches what the NestJS backend produced, so the React
 * client's error handling needs no changes during the migration:
 * {@code {statusCode, error, message, timestamp, path}} plus an
 * optional {@code details} array for field-level validation errors.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> handleApi(ApiException ex, HttpServletRequest request) {
        // 4xx is the caller's problem and routine; only 5xx deserves a stack trace.
        if (ex.getStatus().is5xxServerError()) {
            log.error("{} on {}", ex.getStatus(), request.getRequestURI(), ex);
        } else {
            log.debug("{} on {}: {}", ex.getStatus(), request.getRequestURI(), ex.getMessage());
        }
        return body(ex.getStatus(), ex.getMessage(), null, request);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(
            MethodArgumentNotValidException ex, HttpServletRequest request) {

        List<Map<String, String>> details = ex.getBindingResult().getFieldErrors().stream()
                .map(this::describeFieldError)
                .toList();

        return body(HttpStatus.BAD_REQUEST, "Validation failed.", details, request);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Map<String, Object>> handleConstraint(
            ConstraintViolationException ex, HttpServletRequest request) {

        List<Map<String, String>> details = ex.getConstraintViolations().stream()
                .map(violation -> Map.of(
                        "field", String.valueOf(violation.getPropertyPath()),
                        "message", violation.getMessage()))
                .toList();

        return body(HttpStatus.BAD_REQUEST, "Validation failed.", details, request);
    }

    @ExceptionHandler({
        MissingServletRequestParameterException.class,
        MethodArgumentTypeMismatchException.class,
        HttpMessageNotReadableException.class,
    })
    public ResponseEntity<Map<String, Object>> handleMalformed(Exception ex, HttpServletRequest request) {
        return body(HttpStatus.BAD_REQUEST, "The request could not be read: " + shortReason(ex), null, request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleDenied(
            AccessDeniedException ex, HttpServletRequest request) {
        return body(HttpStatus.FORBIDDEN,
                "You do not have permission to perform this action.", null, request);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleTooLarge(
            MaxUploadSizeExceededException ex, HttpServletRequest request) {
        return body(HttpStatus.PAYLOAD_TOO_LARGE, "The uploaded file is too large.", null, request);
    }

    /**
     * A unique-index violation is the database enforcing a rule the
     * service also checks. Reporting it as 409 keeps the race-condition
     * case indistinguishable from the ordinary one, for the client.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleIntegrity(
            DataIntegrityViolationException ex, HttpServletRequest request) {

        String detail = ex.getMostSpecificCause().getMessage();
        log.warn("Data integrity violation on {}: {}", request.getRequestURI(), detail);

        String message = "That record conflicts with one that already exists.";
        if (detail != null && detail.contains("uniq_active_application")) {
            message = "This candidate already has an open application for that job.";
        } else if (detail != null && detail.contains("foreign key")) {
            message = "A referenced record does not exist, or is still in use.";
        }

        return body(HttpStatus.CONFLICT, message, null, request);
    }

    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNoHandler(
            NoHandlerFoundException ex, HttpServletRequest request) {
        return body(HttpStatus.NOT_FOUND, "No endpoint matches that path.", null, request);
    }

    /**
     * The catch-all. The caller gets a generic message because an
     * unexpected exception's own message usually describes our
     * internals; the detail goes to the log, tagged with the request id
     * so it can still be found.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpected(Exception ex, HttpServletRequest request) {
        log.error("Unhandled exception on {} {}", request.getMethod(), request.getRequestURI(), ex);
        return body(HttpStatus.INTERNAL_SERVER_ERROR,
                "Something went wrong. If it keeps happening, quote the request id from "
                        + "the x-request-id response header.", null, request);
    }

    private Map<String, String> describeFieldError(FieldError error) {
        Map<String, String> entry = new LinkedHashMap<>();
        entry.put("field", error.getField());
        entry.put("message", error.getDefaultMessage() == null ? "is invalid" : error.getDefaultMessage());
        return entry;
    }

    private String shortReason(Exception ex) {
        String message = ex.getMessage();
        if (message == null) {
            return "malformed request";
        }
        int newline = message.indexOf('\n');
        String firstLine = newline > 0 ? message.substring(0, newline) : message;
        return firstLine.length() > 200 ? firstLine.substring(0, 200) + "…" : firstLine;
    }

    private ResponseEntity<Map<String, Object>> body(
            HttpStatus status,
            String message,
            List<Map<String, String>> details,
            HttpServletRequest request) {

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("statusCode", status.value());
        payload.put("error", status.getReasonPhrase());
        payload.put("message", message);
        if (details != null && !details.isEmpty()) {
            payload.put("details", details);
        }
        payload.put("timestamp", Instant.now().toString());
        payload.put("path", request.getRequestURI());

        return ResponseEntity.status(status).body(payload);
    }
}
