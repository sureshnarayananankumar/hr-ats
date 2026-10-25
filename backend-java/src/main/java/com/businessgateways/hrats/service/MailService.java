package com.businessgateways.hrats.service;

import com.businessgateways.hrats.config.HrAtsProperties;
import com.businessgateways.hrats.domain.entity.EmailLog;
import com.businessgateways.hrats.domain.entity.NotificationTemplate;
import com.businessgateways.hrats.domain.enums.Enums.EmailStatus;
import com.businessgateways.hrats.repository.EmailLogRepository;
import com.businessgateways.hrats.repository.NotificationTemplateRepository;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Sends templated transactional email and records every attempt.
 *
 * Templates live in {@code notification_templates} so that wording can
 * be changed without a deploy. A missing template is logged and skipped
 * rather than thrown: a recruiter's stage change must not fail because
 * somebody deleted a notification template.
 */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    /** Matches {@code {{variableName}}} in a template body. */
    private static final Pattern VARIABLE = Pattern.compile("\\{\\{\\s*([a-zA-Z0-9_.]+)\\s*}}");

    private final JavaMailSender mailSender;
    private final NotificationTemplateRepository templates;
    private final EmailLogRepository emailLogs;
    private final HrAtsProperties properties;

    public MailService(
            JavaMailSender mailSender,
            NotificationTemplateRepository templates,
            EmailLogRepository emailLogs,
            HrAtsProperties properties) {
        this.mailSender = mailSender;
        this.templates = templates;
        this.emailLogs = emailLogs;
        this.properties = properties;
    }

    /**
     * Renders a stored template and sends it.
     *
     * Asynchronous, so SMTP latency never shows up in an API response.
     */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendTemplate(String templateKey, String toEmail, Map<String, ?> variables) {
        var template = templates.findByTemplateKey(templateKey).orElse(null);
        if (template == null) {
            log.warn("No notification template \"{}\"; nothing sent to {}", templateKey, toEmail);
            return;
        }
        if (!template.isActive()) {
            log.debug("Template \"{}\" is inactive; nothing sent to {}", templateKey, toEmail);
            return;
        }

        Map<String, Object> context = withDefaults(variables);
        send(
                template.getId(),
                toEmail,
                render(template.getSubject(), context),
                render(template.getBodyHtml(), context),
                template.getBodyText() == null ? null : render(template.getBodyText(), context));
    }

    /** Sends a message that has no stored template, such as a one-off notice. */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendDirect(String toEmail, String subject, String html, String text) {
        send(null, toEmail, subject, html, text);
    }

    private void send(String templateId, String toEmail, String subject, String html, String text) {
        EmailLog entry = new EmailLog();
        entry.setTemplateId(templateId);
        entry.setToEmail(toEmail);
        entry.setSubject(trim(subject, 300));
        entry.setStatus(EmailStatus.QUEUED);
        entry.setAttempts(1);

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(
                    message, MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED, StandardCharsets.UTF_8.name());

            helper.setFrom(properties.getMail().getFrom());
            helper.setTo(toEmail);
            helper.setSubject(subject);
            if (text != null && !text.isBlank()) {
                helper.setText(text, html);
            } else {
                helper.setText(html, true);
            }

            mailSender.send(message);

            entry.setStatus(EmailStatus.SENT);
            entry.setSentAt(Instant.now());
            log.debug("Sent \"{}\" to {}", subject, toEmail);

        } catch (MailException | jakarta.mail.MessagingException ex) {
            // Recorded, not rethrown. The retry sweep picks it up from
            // the log; failing the caller's request would be worse.
            entry.setStatus(EmailStatus.FAILED);
            entry.setErrorMessage(trim(ex.getMessage(), 1000));
            log.error("Failed to send \"{}\" to {}", subject, toEmail, ex);
        }

        try {
            emailLogs.save(entry);
        } catch (Exception ex) {
            log.error("Could not record the email log entry for {}", toEmail, ex);
        }
    }

    /**
     * Substitutes {@code {{variables}}}.
     *
     * An unknown variable becomes an empty string rather than being left
     * as literal {@code {{name}}} in the recipient's inbox.
     */
    public String render(String template, Map<String, ?> variables) {
        if (template == null) {
            return "";
        }

        Matcher matcher = VARIABLE.matcher(template);
        StringBuilder out = new StringBuilder();

        while (matcher.find()) {
            Object value = variables.get(matcher.group(1));
            matcher.appendReplacement(out, Matcher.quoteReplacement(value == null ? "" : String.valueOf(value)));
        }
        matcher.appendTail(out);

        return out.toString();
    }

    private Map<String, Object> withDefaults(Map<String, ?> variables) {
        Map<String, Object> context = new HashMap<>();
        context.put("appName", "HR ATS");
        context.put("frontendUrl", properties.getFrontendUrl());
        context.put("year", String.valueOf(java.time.Year.now().getValue()));
        if (variables != null) {
            context.putAll(variables);
        }
        return context;
    }

    private String trim(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
