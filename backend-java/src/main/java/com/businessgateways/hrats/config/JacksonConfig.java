package com.businessgateways.hrats.config;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.module.SimpleModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Keeps the JSON wire format identical to what the NestJS backend
 * produced, so the React client needs no changes.
 *
 * Two differences would otherwise show up:
 *
 * <ul>
 *   <li><b>Decimals.</b> Prisma returned {@code Decimal} as a string;
 *       Jackson writes {@link BigDecimal} as a JSON number. A salary of
 *       {@code 120000.00} would arrive as {@code 120000} and lose the
 *       scale the UI formats against — and large values would be at the
 *       mercy of JavaScript's 53-bit integer precision.</li>
 *   <li><b>Timestamps.</b> {@link Instant} serialises with nanosecond
 *       precision, so {@code Instant.now()} produced
 *       {@code ...712030693Z} while the same value read back from a
 *       {@code datetime(3)} column produced {@code ...712Z}. Truncating
 *       to milliseconds makes the two indistinguishable, which matters
 *       for anything comparing a response against a stored value.</li>
 * </ul>
 */
@Configuration
public class JacksonConfig {

    @Bean
    public SimpleModule hrAtsWireFormatModule() {
        SimpleModule module = new SimpleModule("hr-ats-wire-format");
        module.addSerializer(BigDecimal.class, new DecimalAsStringSerializer());
        module.addSerializer(Instant.class, new MillisecondInstantSerializer());
        return module;
    }

    private static final class DecimalAsStringSerializer extends JsonSerializer<BigDecimal> {
        @Override
        public void serialize(BigDecimal value, JsonGenerator generator, SerializerProvider provider)
                throws IOException {
            generator.writeString(value.toPlainString());
        }
    }

    private static final class MillisecondInstantSerializer extends JsonSerializer<Instant> {
        @Override
        public void serialize(Instant value, JsonGenerator generator, SerializerProvider provider)
                throws IOException {
            generator.writeString(value.truncatedTo(ChronoUnit.MILLIS).toString());
        }
    }
}
