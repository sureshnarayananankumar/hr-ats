import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiError } from '@/lib/api';
import { AuthLayout } from './AuthLayout';
import { Alert, Button, Field, Input } from '@/components/ui/primitives';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
});

type Values = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const onSubmit = async (values: Values) => {
    setFormError(null);
    try {
      await api.post('/auth/forgot-password', values);
      // The API deliberately returns the same response whether or not
      // the address exists, so the UI must not imply otherwise.
      setSent(true);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Request failed. Please try again.');
    }
  };

  if (sent) {
    return (
      <AuthLayout title="Check your email">
        <Alert tone="info">
          If an account exists for that address, we have sent a password-reset link. It expires
          in one hour.
        </Alert>
        <Link to="/login" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email address and we will send you a reset link."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <Field label="Email address" htmlFor="email" error={form.formState.errors.email?.message} required>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            autoFocus
            hasError={Boolean(form.formState.errors.email)}
            {...form.register('email')}
          />
        </Field>
        <Button type="submit" className="w-full" isLoading={form.formState.isSubmitting}>
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  );
}
