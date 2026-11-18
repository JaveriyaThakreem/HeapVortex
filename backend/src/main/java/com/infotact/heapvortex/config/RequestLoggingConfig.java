package com.infotact.heapvortex.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.filter.CommonsRequestLoggingFilter;

/**
 * Enables Spring's built-in CommonsRequestLoggingFilter so every API
 * request is logged at DEBUG level with method, URI, and query string.
 *
 * To activate, set in application.properties:
 *   logging.level.org.springframework.web.filter.CommonsRequestLoggingFilter=DEBUG
 */
@Configuration
public class RequestLoggingConfig {

    @Bean
    public CommonsRequestLoggingFilter requestLoggingFilter() {
        CommonsRequestLoggingFilter filter = new CommonsRequestLoggingFilter();
        filter.setIncludeQueryString(true);
        filter.setIncludeClientInfo(true);
        filter.setIncludeHeaders(false);
        filter.setIncludePayload(false);
        filter.setMaxPayloadLength(200);
        filter.setBeforeMessagePrefix("API ► ");
        filter.setAfterMessagePrefix("API ◄ ");
        return filter;
    }
}
