import { cn } from '@/lib/utils';

/**
 * Business Gateways brand mark.
 *
 * The asset is the official SVG from businessgateways.com, served from
 * /public so it is cached as a static file rather than inlined into
 * every bundle that renders a header.
 *
 * It is a wide wordmark (800×199, roughly 4:1), so width is the
 * controlling dimension and height follows. Setting both would distort
 * it.
 */
export function Logo({
  className,
  width = 150,
  /** Screen-reader label. Decorative placements pass an empty string. */
  label = 'Business Gateways',
}: {
  className?: string;
  width?: number;
  label?: string;
}) {
  return (
    <img
      src="/bgi-logo.svg"
      alt={label}
      width={width}
      height={Math.round((width * 198.917) / 800)}
      className={cn('block h-auto select-none', className)}
      // Decorative instances are hidden from assistive tech entirely
      // rather than announced as an unlabelled image.
      aria-hidden={label === '' ? 'true' : undefined}
      draggable={false}
    />
  );
}

/**
 * Compact square mark for tight spaces (collapsed sidebar, avatars,
 * favicons) where the full wordmark would be illegible.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-md bg-primary',
        'text-[0.8125rem] font-bold leading-none tracking-tight text-primary-foreground',
        className,
      )}
      aria-hidden="true"
    >
      BG
    </span>
  );
}
