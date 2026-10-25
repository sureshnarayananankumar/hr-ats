package com.businessgateways.hrats.service;

import com.businessgateways.hrats.common.ApiException;
import com.businessgateways.hrats.common.dto.PageResponse;
import com.businessgateways.hrats.common.dto.PaginationQuery;
import com.businessgateways.hrats.domain.entity.Notification;
import com.businessgateways.hrats.domain.enums.Enums.NotificationChannel;
import com.businessgateways.hrats.repository.NotificationRepository;
import com.businessgateways.hrats.repository.NotificationTemplateRepository;
import com.businessgateways.hrats.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;

/**
 * In-app notifications, and the email that may accompany them.
 *
 * A notification is a side effect of somebody else's action, so a
 * failure here is logged and swallowed. Nobody's stage change should
 * fail because a notification row could not be written.
 *
 * The template's {@code channel} decides whether an email goes out as
 * well, so the choice is configuration rather than something each
 * caller has to remember.
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notifications;
    private final NotificationTemplateRepository templates;
    private final UserRepository users;
    private final MailService mail;

    public NotificationService(
            NotificationRepository notifications,
            NotificationTemplateRepository templates,
            UserRepository users,
            MailService mail) {
        this.notifications = notifications;
        this.templates = templates;
        this.users = users;
        this.mail = mail;
    }

    public void notify(String userId, String templateKey, String title, String body, String link) {
        notify(userId, templateKey, title, body, link, Map.of());
    }

    @Transactional
    public void notify(
            String userId,
            String templateKey,
            String title,
            String body,
            String link,
            Map<String, ?> emailVariables) {

        if (userId == null) {
            return;
        }

        try {
            var template = templates.findByTemplateKey(templateKey).orElse(null);
            NotificationChannel channel =
                    template == null ? NotificationChannel.IN_APP : template.getChannel();

            Notification entry = new Notification();
            entry.setUserId(userId);
            entry.setTemplateId(template == null ? null : template.getId());
            entry.setChannel(channel);
            entry.setTitle(title);
            entry.setBody(body);
            entry.setLink(link);
            entry.setCategory(categoryOf(templateKey));
            notifications.save(entry);

            if (channel == NotificationChannel.EMAIL || channel == NotificationChannel.BOTH) {
                users.findById(userId).ifPresent(user -> {
                    var variables = new java.util.HashMap<String, Object>(emailVariables);
                    variables.putIfAbsent("firstName", user.getFirstName());
                    variables.putIfAbsent("title", title);
                    variables.putIfAbsent("body", body);
                    variables.putIfAbsent("link", link);
                    mail.sendTemplate(templateKey, user.getEmail(), variables);
                });
            }

        } catch (Exception ex) {
            log.error("Could not notify user {} with template \"{}\"", userId, templateKey, ex);
        }
    }

    @Transactional(readOnly = true)
    public PageResponse<NotificationResponse> list(String userId, PaginationQuery query) {
        return PageResponse.from(
                notifications.findByUserIdOrderByCreatedAtDesc(userId, query.pageable()),
                this::toResponse);
    }

    @Transactional(readOnly = true)
    public long unreadCount(String userId) {
        return notifications.countByUserIdAndReadAtIsNull(userId);
    }

    @Transactional
    public NotificationResponse markRead(String id, String userId) {
        Notification entry = notifications.findById(id)
                .orElseThrow(() -> ApiException.notFound("Notification", id));

        // Ownership is checked rather than assumed: the id comes from
        // the URL, and nothing else stops one user naming another's.
        if (!entry.getUserId().equals(userId)) {
            throw ApiException.notFound("Notification", id);
        }

        if (entry.getReadAt() == null) {
            entry.setReadAt(Instant.now());
            notifications.save(entry);
        }

        return toResponse(entry);
    }

    @Transactional
    public int markAllRead(String userId) {
        return notifications.markAllRead(userId, Instant.now());
    }

    private String categoryOf(String templateKey) {
        int dot = templateKey.indexOf('.');
        return dot > 0 ? templateKey.substring(0, dot) : "general";
    }

    private NotificationResponse toResponse(Notification entry) {
        return new NotificationResponse(
                entry.getId(),
                entry.getTitle(),
                entry.getBody(),
                entry.getLink(),
                entry.getCategory(),
                entry.getChannel(),
                entry.getReadAt(),
                entry.getCreatedAt());
    }

    public record NotificationResponse(
            String id,
            String title,
            String body,
            String link,
            String category,
            NotificationChannel channel,
            Instant readAt,
            Instant createdAt) {}
}
