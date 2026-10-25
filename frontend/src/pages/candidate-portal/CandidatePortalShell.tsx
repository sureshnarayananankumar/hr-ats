import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Briefcase, FileText, LogOut, User } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/primitives';
import { Logo } from '@/components/ui/Logo';

/**
 * Candidate-facing shell.
 *
 * Deliberately separate from the staff AppShell: candidates see only
 * their own records and none of the recruitment operations navigation.
 */
export default function CandidatePortalShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const links = [
    { to: '/portal/applications', label: 'My applications', icon: FileText },
    { to: '/portal/profile', label: 'My profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-muted/20">
      <a href="#portal-content" className="skip-link">
        Skip to main content
      </a>

      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
          <NavLink to="/careers" className="flex items-center gap-3">
            <Logo width={150} />
            <span className="hidden text-sm text-muted-foreground sm:inline">Careers</span>
          </NavLink>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user?.firstName} {user?.lastName}
            </span>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<LogOut />}
              onClick={async () => {
                await logout();
                navigate('/careers', { replace: true });
              }}
            >
              Sign out
            </Button>
          </div>
        </div>

        <nav className="mx-auto max-w-5xl px-4" aria-label="Candidate portal">
          <ul className="flex gap-1">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    cn(
                      'inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )
                  }
                >
                  <link.icon className="size-4" aria-hidden="true" />
                  {link.label}
                </NavLink>
              </li>
            ))}
            <li>
              <NavLink
                to="/careers"
                className="inline-flex items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <Briefcase className="size-4" aria-hidden="true" />
                Browse jobs
              </NavLink>
            </li>
          </ul>
        </nav>
      </header>

      <main id="portal-content" className="mx-auto max-w-5xl px-4 py-8" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
