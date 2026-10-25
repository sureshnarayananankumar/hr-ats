package com.businessgateways.hrats.common.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.List;

/**
 * Shared pagination, sorting and search parameters.
 *
 * {@code sortBy} never reaches the query builder as given: every
 * endpoint passes it through {@link #sort(List, String)}, which drops
 * anything outside its own allow-list. A sort column interpolated into
 * a query is an injection point, and an allow-list is the only check
 * that cannot be talked around.
 */
@Getter
@Setter
public class PaginationQuery {

    public enum ExportFormat { csv, xlsx }

    public enum SortDirection { asc, desc }

    @Min(1)
    @Schema(defaultValue = "1", minimum = "1")
    private int page = 1;

    @Min(1)
    @Max(100)
    @Schema(defaultValue = "20", minimum = "1", maximum = "100")
    private int pageSize = 20;

    @Size(max = 200)
    @Schema(description = "Free-text search term")
    private String search;

    @Size(max = 50)
    @Schema(description = "Column to sort by (allow-listed per endpoint)")
    private String sortBy;

    @Schema(defaultValue = "desc")
    private SortDirection sortDir = SortDirection.desc;

    @Schema(description = "Output format, for the matching /export endpoint", defaultValue = "csv")
    private ExportFormat format = ExportFormat.csv;

    /** Trimmed search term, or null when it was blank. */
    public String searchTerm() {
        if (search == null) {
            return null;
        }
        String trimmed = search.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public boolean hasSearch() {
        return searchTerm() != null;
    }

    /** Spring Data pages are zero-based; the API is one-based. */
    public Pageable pageable(List<String> sortableColumns, String fallbackColumn) {
        return PageRequest.of(page - 1, pageSize, sort(sortableColumns, fallbackColumn));
    }

    /** Unsorted page request, for endpoints that impose their own ordering. */
    public Pageable pageable() {
        return PageRequest.of(page - 1, pageSize);
    }

    public Sort sort(List<String> sortableColumns, String fallbackColumn) {
        String column = sortBy != null && sortableColumns.contains(sortBy) ? sortBy : fallbackColumn;
        Sort.Direction direction = sortDir == SortDirection.asc ? Sort.Direction.ASC : Sort.Direction.DESC;
        return Sort.by(direction, column);
    }
}
