package com.businessgateways.hrats.common.dto;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

/**
 * The paginated envelope every list endpoint returns.
 *
 * The shape is fixed by the React client, which already consumes
 * {@code {data, meta}} from the NestJS backend — changing it here would
 * mean touching every query hook in the front end for no gain.
 */
public record PageResponse<T>(List<T> data, Meta meta) {

    public record Meta(
            int page,
            int pageSize,
            long totalItems,
            int totalPages,
            boolean hasNextPage,
            boolean hasPreviousPage) {}

    public static <T> PageResponse<T> of(List<T> data, long totalItems, int page, int pageSize) {
        // At least one page even when empty, so the UI's "page 1 of N"
        // never reads "page 1 of 0".
        int totalPages = Math.max(1, (int) Math.ceil((double) totalItems / Math.max(1, pageSize)));
        return new PageResponse<>(data, new Meta(
                page,
                pageSize,
                totalItems,
                totalPages,
                page < totalPages,
                page > 1));
    }

    /** Wraps a Spring Data page, converting each element on the way out. */
    public static <E, T> PageResponse<T> from(Page<E> page, Function<E, T> mapper) {
        return of(
                page.getContent().stream().map(mapper).toList(),
                page.getTotalElements(),
                page.getNumber() + 1,
                page.getSize());
    }
}
