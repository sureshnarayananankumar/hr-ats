import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { AuthLayout } from './AuthLayout';
import { Alert, Button, Field, Input } from '@/components/ui/primitives';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const mfaSchema = z.object({
  code: z.string().min(6, 'Enter the 6-digit code or a recovery code'),
});

type LoginValues = z.infer<typeof loginSchema>;
type MfaValues = z.infer<typeof mfaSchema>;

export default function LoginPage() {
  const { login, verifyMfa, isAuthenticated, mfaPending } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const mfaForm = useForm<MfaValues>({
    resolver: zodResolver(mfaSchema),
    defaultValues: { code: '' },
  });

  if (isAuthenticated) return <Navigate to={from} replace />;

  const onLogin = async (values: LoginValues) => {
    setFormError(null);
    try {
      const result = await login(values.email, values.password);
      if (!result.mfaRequired) navigate(from, { replace: true });
    } catch (error) {
      // The server returns the same message for a bad password and an
      // unknown account; surface it verbatim rather than guessing.
      setFormError(
        error instanceof ApiError ? error.message : 'Sign-in failed. Please try again.',
      );
    }
  };

  const onVerifyMfa = async (values: MfaValues) => {
    setFormError(null);
    try {
      await verifyMfa(values.code);
      navigate(from, { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Verification failed. Please try again.',
      );
    }
  };

  if (mfaPending) {
    return (
      <AuthLayout
        title="Two-factor authentication"
        subtitle="Enter the 6-digit code from your authenticator app, or one of your recovery codes."
      >
        <form onSubmit={mfaForm.handleSubmit(onVerifyMfa)} className="space-y-4" noValidate>
          {formError && <Alert tone="error">{formError}</Alert>}

          <Field label="Authentication code" htmlFor="code" error={mfaForm.formState.errors.code?.message} required>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="123456"
              hasError={Boolean(mfaForm.formState.errors.code)}
              {...mfaForm.register('code')}
            />
          </Field>

          <Button type="submit" className="w-full" isLoading={mfaForm.formState.isSubmitting}>
            Verify and sign in
          </Button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Sign in" subtitle="Access the HR recruitment workspace.">
      <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4" noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}

        <Field
          label="Email address"
          htmlFor="email"
          error={loginForm.formState.errors.email?.message}
          required
        >
          <Input
            id="email"
            type="email"
            autoComplete="username"
            autoFocus
            placeholder="you@company.com"
            hasError={Boolean(loginForm.formState.errors.email)}
            {...loginForm.register('email')}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={loginForm.formState.errors.password?.message}
          required
        >
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            hasError={Boolean(loginForm.formState.errors.password)}
            {...loginForm.register('password')}
          />
        </Field>

        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-xs font-medium text-primary hover:underline"
          >
            Forgot your password?
          </Link>
        </div>

        <Button type="submit" className="w-full" isLoading={loginForm.formState.isSubmitting}>
          Sign in
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Applying for a role?{' '}
          <Link to="/careers" className="font-medium text-primary hover:underline">
            Browse open positions
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
