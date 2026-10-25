package com.businessgateways.hrats.common;

import java.util.List;
import java.util.Set;

/** Names and literals shared across the application. */
public final class Constants {

    private Constants() {}

    public static final String ACCESS_COOKIE = "hr_ats_access";
    public static final String REFRESH_COOKIE = "hr_ats_refresh";
    public static final String CSRF_COOKIE = "hr_ats_csrf";
    public static final String CSRF_HEADER = "x-csrf-token";
    public static final String REQUEST_ID_HEADER = "x-request-id";

    /**
     * Identity headers a caller must never be able to set.
     *
     * Kong strips these on the way in, but the API strips them again so
     * that a request reaching the container directly — bypassing the
     * gateway — cannot assert an identity.
     */
    public static final Set<String> SPOOFABLE_IDENTITY_HEADERS = Set.of(
            "x-user-id",
            "x-user-email",
            "x-user-roles",
            "x-user-permissions",
            "x-consumer-id",
            "x-consumer-username",
            "x-authenticated-userid",
            "x-forwarded-user");

    /** Executables and scripts that must never be accepted as uploads. */
    public static final Set<String> BLOCKED_UPLOAD_EXTENSIONS = Set.of(
            ".exe", ".dll", ".bat", ".cmd", ".com", ".scr", ".msi", ".ps1", ".psm1",
            ".sh", ".bash", ".js", ".mjs", ".cjs", ".jar", ".php", ".phtml", ".asp",
            ".aspx", ".jsp", ".py", ".rb", ".pl", ".vbs", ".wsf", ".hta", ".lnk",
            // SVG and HTML are blocked because they can carry script that
            // would run on our origin when the file is served back.
            ".svg", ".html", ".htm", ".xhtml");

    /** Magic-number prefixes for the document types we accept. */
    public static final List<byte[]> PDF_MAGIC = List.of(new byte[] {0x25, 0x50, 0x44, 0x46});
    public static final List<byte[]> ZIP_MAGIC = List.of(new byte[] {0x50, 0x4B, 0x03, 0x04});
    public static final List<byte[]> DOC_MAGIC =
            List.of(new byte[] {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0});

    /** Audit action names. Kept as constants so a typo cannot silently fork the trail. */
    public static final class Audit {
        private Audit() {}

        public static final String LOGIN_SUCCESS = "LOGIN_SUCCESS";
        public static final String LOGIN_FAILED = "LOGIN_FAILED";
        public static final String LOGIN_LOCKED = "LOGIN_LOCKED";
        public static final String LOGOUT = "LOGOUT";
        public static final String MFA_ENABLED = "MFA_ENABLED";
        public static final String MFA_DISABLED = "MFA_DISABLED";
        public static final String MFA_FAILED = "MFA_FAILED";
        public static final String PASSWORD_RESET_REQUESTED = "PASSWORD_RESET_REQUESTED";
        public static final String PASSWORD_RESET_COMPLETED = "PASSWORD_RESET_COMPLETED";
        public static final String PASSWORD_CHANGED = "PASSWORD_CHANGED";
        public static final String TOKEN_REUSE_DETECTED = "TOKEN_REUSE_DETECTED";
        public static final String UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS";
        public static final String USER_CREATED = "USER_CREATED";
        public static final String USER_UPDATED = "USER_UPDATED";
        public static final String USER_DEACTIVATED = "USER_DEACTIVATED";
        public static final String ROLE_ASSIGNED = "ROLE_ASSIGNED";
        public static final String JOB_CREATED = "JOB_CREATED";
        public static final String JOB_SUBMITTED = "JOB_SUBMITTED";
        public static final String JOB_APPROVED = "JOB_APPROVED";
        public static final String JOB_REJECTED = "JOB_REJECTED";
        public static final String JOB_PUBLISHED = "JOB_PUBLISHED";
        public static final String JOB_STATUS_CHANGED = "JOB_STATUS_CHANGED";
        public static final String APPLICATION_CREATED = "APPLICATION_CREATED";
        public static final String APPLICATION_STAGE_CHANGED = "APPLICATION_STAGE_CHANGED";
        public static final String APPLICATION_WITHDRAWN = "APPLICATION_WITHDRAWN";
        public static final String DOCUMENT_UPLOADED = "DOCUMENT_UPLOADED";
        public static final String DOCUMENT_DOWNLOADED = "DOCUMENT_DOWNLOADED";
        public static final String DOCUMENT_ACCESS_DENIED = "DOCUMENT_ACCESS_DENIED";
        public static final String DOCUMENT_DELETED = "DOCUMENT_DELETED";
        public static final String INTERVIEW_SCHEDULED = "INTERVIEW_SCHEDULED";
        public static final String INTERVIEW_CANCELLED = "INTERVIEW_CANCELLED";
        public static final String FEEDBACK_SUBMITTED = "FEEDBACK_SUBMITTED";
        public static final String OFFER_CREATED = "OFFER_CREATED";
        public static final String OFFER_APPROVED = "OFFER_APPROVED";
        public static final String OFFER_SENT = "OFFER_SENT";
        public static final String OFFER_RESPONDED = "OFFER_RESPONDED";
        public static final String ONBOARDING_STARTED = "ONBOARDING_STARTED";
        public static final String SETTINGS_UPDATED = "SETTINGS_UPDATED";
        public static final String DATA_EXPORTED = "DATA_EXPORTED";
    }
}
