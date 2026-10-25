package com.businessgateways.hrats.security;

import com.businessgateways.hrats.common.Constants;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.Enumeration;
import java.util.UUID;

/**
 * First filter in the chain. Two jobs, both about not trusting the edge.
 *
 * <ol>
 *   <li>Gives every request a correlation id, so an API log line can be
 *       matched to Kong's gateway log and to the audit trail.</li>
 *   <li>Hides any identity-asserting header the caller supplied.</li>
 * </ol>
 *
 * Kong already strips those headers inbound, but a request that reaches
 * this container directly — a misconfigured network, a compromised
 * sidecar — would otherwise be able to assert whatever identity it
 * liked. Authentication must come from the signed token and nothing
 * else, so the headers are hidden here as well. Defence in depth is the
 * point: either layer alone would be a single point of failure.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class GatewayRequestFilter extends OncePerRequestFilter {

    private static final String MDC_KEY = "requestId";

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain chain) throws ServletException, IOException {

        String requestId = request.getHeader(Constants.REQUEST_ID_HEADER);
        if (requestId == null || requestId.isBlank() || requestId.length() > 64) {
            requestId = UUID.randomUUID().toString();
        }

        MDC.put(MDC_KEY, requestId);
        response.setHeader(Constants.REQUEST_ID_HEADER, requestId);

        try {
            chain.doFilter(new IdentityHeaderShield(request), response);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }

    /** Makes the spoofable identity headers invisible to everything downstream. */
    private static final class IdentityHeaderShield extends HttpServletRequestWrapper {

        private IdentityHeaderShield(HttpServletRequest request) {
            super(request);
        }

        private boolean isBlocked(String name) {
            return name != null
                    && Constants.SPOOFABLE_IDENTITY_HEADERS.contains(name.toLowerCase());
        }

        @Override
        public String getHeader(String name) {
            return isBlocked(name) ? null : super.getHeader(name);
        }

        @Override
        public Enumeration<String> getHeaders(String name) {
            return isBlocked(name) ? Collections.emptyEnumeration() : super.getHeaders(name);
        }

        @Override
        public Enumeration<String> getHeaderNames() {
            return Collections.enumeration(
                    Collections.list(super.getHeaderNames()).stream()
                            .filter(name -> !isBlocked(name))
                            .toList());
        }
    }
}
