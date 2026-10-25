import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoader, EmptyState, Button } from '@/components/ui/primitives';
import { ShieldAlert } from 'lucide-react';

// Route-level code splitting keeps the initial bundle small.
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage'));

const CareersListPage = lazy(() => import('@/pages/careers/CareersListPage'));
const CareersDetailPage = lazy(() => import('@/pages/careers/CareersDetailPage'));

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const JobsListPage = lazy(() => import('@/pages/jobs/JobsListPage'));
const JobDetailPage = lazy(() => import('@/pages/jobs/JobDetailPage'));
const JobFormPage = lazy(() => import('@/pages/jobs/JobFormPage'));
const JobApprovalsPage = lazy(() => import('@/pages/jobs/JobApprovalsPage'));
const PublishedJobsPage = lazy(() => import('@/pages/jobs/PublishedJobsPage'));
const CandidatesListPage = lazy(() => import('@/pages/candidates/CandidatesListPage'));
const CandidateDetailPage = lazy(() => import('@/pages/candidates/CandidateDetailPage'));
const ApplicationsListPage = lazy(() => import('@/pages/applications/ApplicationsListPage'));
const ApplicationDetailPage = lazy(() => import('@/pages/applications/ApplicationDetailPage'));
const PipelinePage = lazy(() => import('@/pages/pipeline/PipelinePage'));
const InterviewsPage = lazy(() => import('@/pages/interviews/InterviewsPage'));
const InterviewDetailPage = lazy(() => import('@/pages/interviews/InterviewDetailPage'));
const OffersPage = lazy(() => import('@/pages/offers/OffersPage'));
const OfferDetailPage = lazy(() => import('@/pages/offers/OfferDetailPage'));
const OnboardingPage = lazy(() => import('@/pages/onboarding/OnboardingPage'));
const OnboardingDetailPage = lazy(() => import('@/pages/onboarding/OnboardingDetailPage'));
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const UsersPage = lazy(() => import('@/pages/admin/UsersPage'));
const SettingsPage = lazy(() => import('@/pages/admin/SettingsPage'));
const AuditLogsPage = lazy(() => import('@/pages/admin/AuditLogsPage'));
const AccountPage = lazy(() => import('@/pages/AccountPage'));

const MyApplicationsPage = lazy(() => import('@/pages/candidate-portal/MyApplicationsPage'));
const MyProfilePage = lazy(() => import('@/pages/candidate-portal/MyProfilePage'));
const CandidatePortalShell = lazy(() => import('@/pages/candidate-portal/CandidatePortalShell'));

/** Blocks unauthenticated access and remembers where the user was going. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <PageLoader label="Checking your session" />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}

/**
 * Hides a route the user has no permission for.
 *
 * This is a usability guard only. The matching API endpoints enforce the
 * same permissions server-side, so bypassing this changes nothing.
 */
function RequirePermission({
  anyOf,
  children,
}: {
  anyOf: string[];
  children: ReactNode;
}) {
  const { canAny } = useAuth();

  if (!canAny(...anyOf)) {
    return (
      <EmptyState
        icon={<ShieldAlert className="size-6" />}
        title="You do not have access to this page"
        description="If you believe this is a mistake, ask an administrator to review your role."
        action={
          <Button variant="outline" onClick={() => window.history.back()}>
            Go back
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}

/** Candidates get the portal; staff get the operations dashboard. */
function HomeRedirect() {
  const { user } = useAuth();
  const isCandidateOnly =
    user?.roles.length === 1 && user.roles[0] === 'CANDIDATE';
  return <Navigate to={isCandidateOnly ? '/portal/applications' : '/dashboard'} replace />;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* ---- Public ---- */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/careers" element={<CareersListPage />} />
        <Route path="/careers/:slug" element={<CareersDetailPage />} />

        {/* ---- Candidate portal ---- */}
        <Route
          path="/portal"
          element={
            <RequireAuth>
              <CandidatePortalShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/portal/applications" replace />} />
          <Route path="applications" element={<MyApplicationsPage />} />
          <Route path="profile" element={<MyProfilePage />} />
        </Route>

        {/* ---- Internal application ---- */}
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<HomeRedirect />} />

          <Route
            path="/dashboard"
            element={
              <RequirePermission anyOf={['dashboard.view']}>
                <DashboardPage />
              </RequirePermission>
            }
          />

          <Route
            path="/jobs"
            element={
              <RequirePermission anyOf={['job.read.assigned', 'job.read.any']}>
                <JobsListPage />
              </RequirePermission>
            }
          />
          <Route
            path="/jobs/new"
            element={
              <RequirePermission anyOf={['job.create']}>
                <JobFormPage />
              </RequirePermission>
            }
          />
          <Route
            path="/jobs/:id/edit"
            element={
              <RequirePermission anyOf={['job.update']}>
                <JobFormPage />
              </RequirePermission>
            }
          />
          <Route
            path="/jobs/:id"
            element={
              <RequirePermission anyOf={['job.read.assigned', 'job.read.any']}>
                <JobDetailPage />
              </RequirePermission>
            }
          />
          <Route
            path="/job-approvals"
            element={
              <RequirePermission anyOf={['job.approve']}>
                <JobApprovalsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/job-approvals/:id"
            element={
              <RequirePermission anyOf={['job.approve']}>
                <JobDetailPage />
              </RequirePermission>
            }
          />
          <Route
            path="/published-jobs"
            element={
              <RequirePermission anyOf={['job.read.assigned', 'job.read.any']}>
                <PublishedJobsPage />
              </RequirePermission>
            }
          />

          <Route
            path="/candidates"
            element={
              <RequirePermission anyOf={['candidate.read.any']}>
                <CandidatesListPage />
              </RequirePermission>
            }
          />
          <Route
            path="/candidates/:id"
            element={
              <RequirePermission anyOf={['candidate.read.any']}>
                <CandidateDetailPage />
              </RequirePermission>
            }
          />

          <Route
            path="/applications"
            element={
              <RequirePermission anyOf={['application.read.any', 'application.read.assigned']}>
                <ApplicationsListPage />
              </RequirePermission>
            }
          />
          <Route
            path="/applications/:id"
            element={
              <RequirePermission
                anyOf={['application.read.any', 'application.read.assigned', 'application.read.own']}
              >
                <ApplicationDetailPage />
              </RequirePermission>
            }
          />

          <Route
            path="/pipeline"
            element={
              <RequirePermission anyOf={['application.read.any', 'application.read.assigned']}>
                <PipelinePage />
              </RequirePermission>
            }
          />
          <Route
            path="/pipeline/:jobId"
            element={
              <RequirePermission anyOf={['application.read.any', 'application.read.assigned']}>
                <PipelinePage />
              </RequirePermission>
            }
          />

          <Route
            path="/interviews"
            element={
              <RequirePermission anyOf={['interview.read.any', 'interview.read.assigned']}>
                <InterviewsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/interviews/:id"
            element={
              <RequirePermission
                anyOf={['interview.read.any', 'interview.read.assigned', 'interview.feedback.submit']}
              >
                <InterviewDetailPage />
              </RequirePermission>
            }
          />

          <Route
            path="/offers"
            element={
              <RequirePermission anyOf={['offer.read.any']}>
                <OffersPage />
              </RequirePermission>
            }
          />
          <Route
            path="/offers/:id"
            element={
              <RequirePermission anyOf={['offer.read.any', 'offer.read.own']}>
                <OfferDetailPage />
              </RequirePermission>
            }
          />

          <Route
            path="/onboarding"
            element={
              <RequirePermission anyOf={['onboarding.read.any']}>
                <OnboardingPage />
              </RequirePermission>
            }
          />
          <Route
            path="/onboarding/:id"
            element={
              <RequirePermission anyOf={['onboarding.read.any', 'onboarding.read.own']}>
                <OnboardingDetailPage />
              </RequirePermission>
            }
          />

          <Route
            path="/reports"
            element={
              <RequirePermission anyOf={['report.view']}>
                <ReportsPage />
              </RequirePermission>
            }
          />

          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/account" element={<AccountPage />} />

          <Route
            path="/admin/users"
            element={
              <RequirePermission anyOf={['user.read']}>
                <UsersPage />
              </RequirePermission>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <RequirePermission anyOf={['settings.read']}>
                <SettingsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/admin/audit-logs"
            element={
              <RequirePermission anyOf={['audit.read']}>
                <AuditLogsPage />
              </RequirePermission>
            }
          />
        </Route>

        <Route
          path="*"
          element={
            <div className="flex min-h-screen items-center justify-center p-6">
              <EmptyState
                title="Page not found"
                description="The page you are looking for does not exist or has moved."
                action={
                  <Button onClick={() => (window.location.href = '/')}>Back to start</Button>
                }
              />
            </div>
          }
        />
      </Routes>
    </Suspense>
  );
}
