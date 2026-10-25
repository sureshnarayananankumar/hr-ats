import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiError } from '@/lib/api';
import { AuthLayout } from './AuthLayout';
import { Alert, Button, Field, Input } from '@/components/ui/primitives';

const schema = z
  .object({
    newPassword: z
      .string()
      .min(12, 'Use at least 12 characters')
      .max(128)
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[0-9]/, 'Include a digit'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type Values = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values: Values) => {
    setFormError(null);
    try {
      await api.post('/auth/reset-password', { token, newPassword: values.newPassword });
      setDone(true);
      // Resetting revokes every existing session, so the user must sign
      // in again with the new password.
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Reset failed. Please try again.');
    }
  };

  if (!token) {
    return (
      <AuthLayout title="Invalid reset link">
        <Alert tone="error">
          This link is missing its token. Request a new password-reset email.
        </Alert>
        <Link to="/forgot-password" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
          Request a new link
        </Link>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="Password updated">
        <Alert tone="success">
          Your password has been changed and all previous sessions were signed out. Taking you to
          the sign-in page…
        </Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="This signs out all of your other sessions.">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}

        <Field
          label="New password"
          htmlFor="newPassword"
          error={form.formState.errors.newPassword?.message}
          hint="At least 12 characters, with upper and lower case letters and a digit."
          required
        >
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            autoFocus
            hasError={Boolean(form.formState.errors.newPassword)}
            {...form.register('newPassword')}
          />
        </Field>

        <Field
          label="Confirm new password"
          htmlFor="confirmPassword"
          error={form.formState.errors.confirmPassword?.message}
          required
        >
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            hasError={Boolean(form.formState.errors.confirmPassword)}
            {...form.register('confirmPassword')}
          />
        </Field>

        <Button type="submit" className="w-full" isLoading={form.formState.isSubmitting}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
