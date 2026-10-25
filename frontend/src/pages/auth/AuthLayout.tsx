import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';

/** Centred card used by every unauthenticated page. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="flex h-16 items-center px-6">
        <Link
          to="/careers"
          className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo width={168} />
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:items-center sm:pt-0">
        <div className="w-full max-w-md">
          <div className="rounded-lg border bg-card p-6 shadow-sm sm:p-8">
            <div className="mb-6 space-y-1.5">
              <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {children}
          </div>
          {footer && <div className="mt-4 text-center text-sm">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
