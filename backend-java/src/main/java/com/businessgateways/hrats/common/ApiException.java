package com.businessgateways.hrats.common;

import org.springframework.http.HttpStatus;

/**
 * An error that is safe to show the caller.
 *
 * Anything thrown as an {@code ApiException} has a message written for
 * the person reading it. Everything else becomes a generic 500, because
 * an unplanned exception's message tends to describe our internals.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public ApiException(HttpStatus status, String message, Throwable cause) {
        super(message, cause);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, what + " was not found.");
    }

    public static ApiException notFound(String what, String id) {
        return new ApiException(HttpStatus.NOT_FOUND, what + " \"" + id + "\" was not found.");
    }

    public static ApiException badRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, message);
    }

    public static ApiException conflict(String message) {
        return new ApiException(HttpStatus.CONFLICT, message);
    }

    public static ApiException forbidden(String message) {
        return new ApiException(HttpStatus.FORBIDDEN, message);
    }

    public static ApiException unauthorized(String message) {
        return new ApiException(HttpStatus.UNAUTHORIZED, message);
    }

    /** 422: the request was well-formed but the workflow does not allow it. */
    public static ApiException unprocessable(String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, message);
    }

    public static ApiException tooManyRequests(String message) {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, message);
    }
}
