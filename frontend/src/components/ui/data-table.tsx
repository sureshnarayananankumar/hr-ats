import { type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ChevronsUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PageMeta } from '@/lib/types';
import { Button, EmptyState, Skeleton } from './primitives';

export interface Column<T> {
  key: string;
  header: string;
  /** Column key accepted by the API's `sortBy`, when sortable. */
  sortKey?: string;
  render: (row: T) => ReactNode;
  className?: string;
  /** Hidden below the `md` breakpoint to keep mobile tables readable. */
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  meta?: PageMeta;
  onPageChange?: (page: number) => void;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSortChange?: (sortBy: string, sortDir: 'asc' | 'desc') => void;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** Row-selection support for bulk actions. */
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  caption?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  meta,
  onPageChange,
  sortBy,
  sortDir,
  onSortChange,
  onRowClick,
  emptyTitle = 'Nothing to show',
  emptyDescription,
  emptyAction,
  selectable,
  selectedIds,
  onSelectionChange,
  caption,
}: DataTableProps<T>) {
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds?.has(rowKey(row)));
  const someSelected = rows.some((row) => selectedIds?.has(rowKey(row))) && !allSelected;

  const toggleAll = () => {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds);
    if (allSelected) {
      rows.forEach((row) => next.delete(rowKey(row)));
    } else {
      rows.forEach((row) => next.add(rowKey(row)));
    }
    onSelectionChange(next);
  };

  const toggleOne = (id: string) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const handleSort = (column: Column<T>) => {
    if (!column.sortKey || !onSortChange) return;
    const isCurrent = sortBy === column.sortKey;
    onSortChange(column.sortKey, isCurrent && sortDir === 'desc' ? 'asc' : 'desc');
  };

  if (isLoading) {
    return (
      <div className="space-y-2 rounded-lg border p-4" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading results</span>
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border">
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full caption-bottom text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="border-b bg-muted/40">
            <tr>
              {selectable && (
                <th scope="col" className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(element) => {
                      // Indeterminate is a DOM property, not an attribute.
                      if (element) element.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                    aria-label="Select all rows on this page"
                    className="size-4 rounded border-input accent-primary"
                  />
                </th>
              )}
              {columns.map((column) => {
                const isSorted = sortBy === column.sortKey;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                    className={cn(
                      'px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground',
                      column.hideOnMobile && 'hidden md:table-cell',
                      column.className,
                    )}
                  >
                    {column.sortKey ? (
                      <button
                        type="button"
                        onClick={() => handleSort(column)}
                        className="inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {column.header}
                        {isSorted ? (
                          sortDir === 'asc' ? (
                            <ArrowUp className="size-3" aria-hidden="true" />
                          ) : (
                            <ArrowDown className="size-3" aria-hidden="true" />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3 opacity-40" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = rowKey(row);
              return (
                <tr
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b last:border-0 transition-colors hover:bg-muted/40',
                    onRowClick && 'cursor-pointer',
                    selectedIds?.has(id) && 'bg-primary/5',
                  )}
                >
                  {selectable && (
                    <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds?.has(id) ?? false}
                        onChange={() => toggleOne(id)}
                        aria-label={`Select row ${id}`}
                        className="size-4 rounded border-input accent-primary"
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-3 py-2.5 align-middle',
                        column.hideOnMobile && 'hidden md:table-cell',
                        column.className,
                      )}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {meta && onPageChange && meta.totalPages > 1 && (
        <nav
          className="flex flex-col items-center justify-between gap-3 sm:flex-row"
          aria-label="Pagination"
        >
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Page {meta.page} of {meta.totalPages} · {meta.totalItems.toLocaleString()} record
            {meta.totalItems === 1 ? '' : 's'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(meta.page - 1)}
              disabled={!meta.hasPreviousPage}
              leftIcon={<ChevronLeft />}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(meta.page + 1)}
              disabled={!meta.hasNextPage}
            >
              Next
              <ChevronRight />
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
