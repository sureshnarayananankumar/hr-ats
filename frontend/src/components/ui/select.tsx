import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Accessible select built on Radix.
 *
 * A native <select> cannot be styled consistently across browsers, but
 * it is fully accessible for free -- Radix reproduces that keyboard and
 * screen-reader behaviour, so nothing is traded away for the styling.
 */
export const Select = forwardRef<
  HTMLButtonElement,
  {
    value?: string;
    onValueChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    id?: string;
    disabled?: boolean;
    hasError?: boolean;
    className?: string;
    'aria-label'?: string;
  }
>(({ value, onValueChange, options, placeholder = 'Select…', id, disabled, hasError, className, ...rest }, ref) => (
  <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
    <SelectPrimitive.Trigger
      ref={ref}
      id={id}
      aria-label={rest['aria-label']}
      aria-invalid={hasError || undefined}
      className={cn(
        'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input',
        'bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50 [&>span]:truncate',
        hasError && 'border-destructive focus:ring-destructive',
        className,
      )}
    >
      <SelectPrimitive.Value placeholder={placeholder} />
      <SelectPrimitive.Icon>
        <ChevronDown className="size-4 opacity-60" aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>

    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position="popper"
        sideOffset={4}
        className={cn(
          'z-[60] max-h-72 min-w-[8rem] overflow-hidden rounded-md border bg-card shadow-md',
          'data-[state=open]:animate-fade-in w-[var(--radix-select-trigger-width)]',
        )}
      >
        <SelectPrimitive.Viewport className="p-1">
          {options.map((option) => (
            <SelectPrimitive.Item
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className={cn(
                'relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm',
                'outline-none focus:bg-accent focus:text-accent-foreground',
                'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
              )}
            >
              <span className="absolute left-2 flex size-4 items-center justify-center">
                <SelectPrimitive.ItemIndicator>
                  <Check className="size-3.5" aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
              </span>
              <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
            </SelectPrimitive.Item>
          ))}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>
));
Select.displayName = 'Select';

/** Builds options from an enum-like union plus a humanising formatter. */
export function toOptions(
  values: readonly string[],
  format: (value: string) => string,
): SelectOption[] {
  return values.map((value) => ({ value, label: format(value) }));
}
