package com.businessgateways.hrats.service;

import com.businessgateways.hrats.common.ApiException;
import com.businessgateways.hrats.common.CryptoUtil;
import com.businessgateways.hrats.domain.entity.User;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.samstevens.totp.code.CodeVerifier;
import dev.samstevens.totp.code.DefaultCodeGenerator;
import dev.samstevens.totp.code.DefaultCodeVerifier;
import dev.samstevens.totp.code.HashingAlgorithm;
import dev.samstevens.totp.secret.DefaultSecretGenerator;
import dev.samstevens.totp.secret.SecretGenerator;
import dev.samstevens.totp.time.SystemTimeProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * TOTP second factor and single-use recovery codes.
 *
 * Recovery codes are stored hashed, exactly like passwords would be,
 * because they are password-equivalent: one is enough to take over an
 * account. They are shown once at enrolment and never again.
 */
@Service
public class MfaService {

    private static final Logger log = LoggerFactory.getLogger(MfaService.class);

    private static final String ISSUER = "HR ATS";
    private static final int RECOVERY_CODE_COUNT = 10;
    private static final String RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final SecretGenerator secretGenerator = new DefaultSecretGenerator(32);
    private final CodeVerifier codeVerifier;
    private final ObjectMapper objectMapper;
    private final SecureRandom random = new SecureRandom();

    public MfaService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;

        DefaultCodeVerifier verifier =
                new DefaultCodeVerifier(new DefaultCodeGenerator(HashingAlgorithm.SHA1), new SystemTimeProvider());
        // One period either side, so a code typed as it rolls over is
        // still accepted. Wider than that starts to matter for replay.
        verifier.setAllowedTimePeriodDiscrepancy(1);
        this.codeVerifier = verifier;
    }

    public String generateSecret() {
        return secretGenerator.generate();
    }

    /**
     * The {@code otpauth://} URI an authenticator app scans.
     *
     * Built by hand rather than rendered as a QR image server-side: the
     * secret then never passes through an image pipeline, and the client
     * renders the QR locally.
     */
    public String otpauthUri(String email, String secret) {
        String label = encode(ISSUER + ":" + email);
        return "otpauth://totp/" + label
                + "?secret=" + secret
                + "&issuer=" + encode(ISSUER)
                + "&algorithm=SHA1&digits=6&period=30";
    }

    public String issuer() {
        return ISSUER;
    }

    public boolean verifyCode(String secret, String code) {
        if (secret == null || code == null) {
            return false;
        }
        return codeVerifier.isValidCode(secret, code.trim());
    }

    /** Ten codes, in the form {@code ABCD-EFGH}. */
    public List<String> generateRecoveryCodes() {
        List<String> codes = new ArrayList<>(RECOVERY_CODE_COUNT);
        for (int i = 0; i < RECOVERY_CODE_COUNT; i++) {
            codes.add(randomGroup(4) + "-" + randomGroup(4));
        }
        return codes;
    }

    public String hashRecoveryCodes(List<String> codes) {
        try {
            List<String> hashes = codes.stream()
                    .map(code -> CryptoUtil.sha256Hex(normalise(code)))
                    .toList();
            return objectMapper.writeValueAsString(hashes);
        } catch (Exception ex) {
            throw new ApiException(
                    org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR,
                    "Recovery codes could not be stored.", ex);
        }
    }

    /**
     * Consumes a recovery code if it matches.
     *
     * Mutates the user's stored list so the code cannot be replayed, and
     * returns whether it was accepted. The caller is responsible for
     * saving the user.
     */
    public boolean consumeRecoveryCode(User user, String candidate) {
        String stored = user.getMfaRecoveryCodes();
        if (stored == null || stored.isBlank()) {
            return false;
        }

        List<String> hashes;
        try {
            hashes = objectMapper.readValue(stored, new TypeReference<List<String>>() {});
        } catch (Exception ex) {
            log.error("Recovery codes for user {} could not be read", user.getId(), ex);
            return false;
        }

        String target = CryptoUtil.sha256Hex(normalise(candidate));
        List<String> remaining = new ArrayList<>(hashes.size());
        boolean matched = false;

        for (String hash : hashes) {
            // Compare every entry rather than breaking early, so the
            // time taken does not reveal the code's position.
            if (!matched && CryptoUtil.safeEquals(hash, target)) {
                matched = true;
                continue;
            }
            remaining.add(hash);
        }

        if (!matched) {
            return false;
        }

        try {
            user.setMfaRecoveryCodes(objectMapper.writeValueAsString(remaining));
        } catch (Exception ex) {
            log.error("Could not write back recovery codes for user {}", user.getId(), ex);
            return false;
        }

        if (remaining.isEmpty()) {
            log.warn("User {} has used their last MFA recovery code", user.getId());
        }

        return true;
    }

    private String normalise(String code) {
        return code == null ? "" : code.trim().toUpperCase(Locale.ROOT).replace("-", "");
    }

    private String randomGroup(int length) {
        StringBuilder group = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            group.append(RECOVERY_ALPHABET.charAt(random.nextInt(RECOVERY_ALPHABET.length())));
        }
        return group.toString();
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
