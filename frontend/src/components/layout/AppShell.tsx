import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Briefcase,
  CheckSquare,
  Globe,
  Users,
  FileText,
  Kanban,
  CalendarDays,
  FileSignature,
  UserPlus,
  BarChart3,
  Bell,
  Shield,
  Settings,
  ScrollText,
  Menu,
  X,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { cn, initials } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import styles from './AppShell.module.scss';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Any ONE of these permissions reveals the item. */
  permissions?: string[];
  badgeKey?: 'jobApprovals' | 'notifications';
}

/**
 * Main navigation.
 *
 * `permissions` controls what is DISPLAYED. It is a usability feature,
 * not a security control -- every route and every endpoint behind it is
 * independently authorised on the server.
 */
const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permissions: ['dashboard.view'] },
  { to: '/jobs', label: 'Job Requirements', icon: Briefcase, permissions: ['job.read.assigned', 'job.read.any'] },
  { to: '/job-approvals', label: 'Job Approvals', icon: CheckSquare, permissions: ['job.approve'], badgeKey: 'jobApprovals' },
  { to: '/published-jobs', label: 'Published Jobs', icon: Globe, permissions: ['job.read.assigned', 'job.read.any'] },
  { to: '/candidates', label: 'Candidates', icon: Users, permissions: ['candidate.read.any'] },
  { to: '/applications', label: 'Applications', icon: FileText, permissions: ['application.read.any', 'application.read.assigned'] },
  { to: '/pipeline', label: 'Candidate Pipeline', icon: Kanban, permissions: ['application.read.any', 'application.read.assigned'] },
  { to: '/interviews', label: 'Interviews', icon: CalendarDays, permissions: ['interview.read.any', 'interview.read.assigned'] },
  { to: '/offers', label: 'Offers', icon: FileSignature, permissions: ['offer.read.any'] },
  { to: '/onboarding', label: 'Onboarding', icon: UserPlus, permissions: ['onboarding.read.any'] },
  { to: '/reports', label: 'Reports', icon: BarChart3, permissions: ['report.view'] },
  { to: '/notifications', label: 'Notifications', icon: Bell, permissions: ['notification.read.own'] },
  { to: '/admin/users', label: 'User Management', icon: Shield, permissions: ['user.read'] },
  { to: '/admin/settings', label: 'Settings', icon: Settings, permissions: ['settings.read'] },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText, permissions: ['audit.read'] },
];

export function AppShell() {
  const { user, logout, canAny } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.permissions || canAny(...item.permissions),
  );

  const { data: pending } = useQuery({
    queryKey: ['pending-actions'],
    queryFn: () => api.get<{ jobApprovals: number; total: number }>('/dashboard/pending-actions'),
    enabled: canAny('dashboard.view'),
    refetchInterval: 120_000,
    retry: false,
  });

  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ unread: number }>('/notifications/unread-count'),
    refetchInterval: 60_000,
    retry: false,
  });

  const badgeFor = (item: NavItem): number | undefined => {
    if (item.badgeKey === 'jobApprovals') return pending?.jobApprovals || undefined;
    if (item.badgeKey === 'notifications') return unread?.unread || undefined;
    if (item.to === '/notifications') return unread?.unread || undefined;
    return undefined;
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className={styles.shell}>
      {/* Keyboard users can skip straight past the navigation. */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* ---- Sidebar ---- */}
      {/*
        The accessible name belongs on the <nav> landmark inside, not on
        the <aside>. An <aside> exposes role="complementary", so labelling
        it here would leave the navigation landmark itself unnamed.
      */}
      <aside
        id="app-sidebar"
        className={cn(styles.sidebar, mobileOpen && styles.sidebarOpen)}
      >
        <div className={styles.brand}>
          <Logo width={132} className={styles.brandLogo} />
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <nav className={styles.nav} aria-label="Main navigation">
          <ul>
            {visibleItems.map((item) => {
              const badge = badgeFor(item);
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) => cn(styles.navLink, isActive && styles.navLinkActive)}
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className={styles.navLabel}>{item.label}</span>
                    {badge ? (
                      <span className={styles.navBadge} aria-label={`${badge} pending`}>
                        {badge > 99 ? '99+' : badge}
                      </span>
                    ) : null}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={styles.sidebarFooter}>
          <p className={styles.version}>HR ATS v1.0</p>
        </div>
      </aside>

      {/* Dim + close the drawer on mobile. */}
      {mobileOpen && (
        <div
          className={styles.backdrop}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ---- Top bar ---- */}
      <div className={styles.main}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.menuButton}
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            aria-controls="app-sidebar"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>

          <div className={styles.topbarSpacer} />

          <NavLink to="/notifications" className={styles.iconButton} aria-label="Notifications">
            <Bell className="size-5" aria-hidden="true" />
            {unread?.unread ? (
              <span className={styles.dot} aria-label={`${unread.unread} unread`} />
            ) : null}
          </NavLink>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger className={styles.userButton}>
              <span className={styles.avatar} aria-hidden="true">
                {initials(user ? `${user.firstName} ${user.lastName}` : '')}
              </span>
              <span className={styles.userMeta}>
                <span className={styles.userName}>
                  {user?.firstName} {user?.lastName}
                </span>
                <span className={styles.userRole}>
                  {user?.roles.map((role) => role.replace(/_/g, ' ')).join(', ')}
                </span>
              </span>
              <ChevronDown className="size-4 opacity-60" aria-hidden="true" />
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={6} className={styles.menu}>
                <DropdownMenu.Label className={styles.menuLabel}>
                  {user?.email}
                </DropdownMenu.Label>
                <DropdownMenu.Separator className={styles.menuSeparator} />
                <DropdownMenu.Item asChild>
                  <NavLink to="/account" className={styles.menuItem}>
                    <Settings className="size-4" aria-hidden="true" />
                    Account &amp; security
                  </NavLink>
                </DropdownMenu.Item>
                <DropdownMenu.Separator className={styles.menuSeparator} />
                <DropdownMenu.Item className={styles.menuItem} onSelect={() => void handleLogout()}>
                  <LogOut className="size-4" aria-hidden="true" />
                  Sign out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </header>

        <main id="main-content" className={styles.content} tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
