package com.businessgateways.hrats.common;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Small cryptographic helpers.
 *
 * Mirrors {@code src/common/utils/crypto.util.ts} so that tokens minted
 * by either backend hash to the same value — the migration can run the
 * two side by side without invalidating anyone's session.
 */
public final class CryptoUtil {

    private CryptoUtil() {}

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Base64.Encoder URL_ENCODER = Base64.getUrlEncoder().withoutPadding();

    /** A 32-byte URL-safe random token. Used for refresh, reset and CSRF tokens. */
    public static String randomToken() {
        return randomToken(32);
    }

    public static String randomToken(int bytes) {
        byte[] buffer = new byte[bytes];
        RANDOM.nextBytes(buffer);
        return URL_ENCODER.encodeToString(buffer);
    }

    /**
     * SHA-256, lower-case hex.
     *
     * Opaque tokens are stored hashed so that a database leak does not
     * hand the attacker working sessions. Unlike a password, these are
     * already full-entropy random values, so a fast hash is correct —
     * there is nothing to brute-force.
     */
    public static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is required but unavailable", ex);
        }
    }

    /**
     * Constant-time comparison.
     *
     * A naive {@code equals} returns as soon as two bytes differ, which
     * leaks how much of a token the attacker guessed correctly.
     */
    public static boolean safeEquals(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        return MessageDigest.isEqual(
                a.getBytes(StandardCharsets.UTF_8),
                b.getBytes(StandardCharsets.UTF_8));
    }

    /** Normalises an email for comparison and duplicate detection. */
    public static String normaliseEmail(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }

    /** Reduces a phone number to digits so formatting differences do not hide a duplicate. */
    public static String normalisePhone(String phone) {
        if (phone == null) {
            return null;
        }
        String digits = phone.replaceAll("[^0-9]", "");
        return digits.isEmpty() ? null : digits;
    }
}
