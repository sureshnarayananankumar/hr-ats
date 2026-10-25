import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiError } from '@/lib/api';
import { AuthLayout } from './AuthLayout';
import { Alert, Button, Field, Input } from '@/components/ui/primitives';

/**
 * Password rules mirror the server's `validatePasswordStrength`.
 * The server re-validates regardless -- this is immediate feedback,
 * not the enforcement point.
 */
const registerSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required').max(100),
    lastName: z.string().min(1, 'Last name is required').max(100),
    email: z.string().min(1, 'Email is required').email('Enter a valid email address').max(255),
    phone: z
      .string()
      .max(30)
      .regex(/^[0-9+()\-\s]*$/, 'Phone number contains invalid characters')
      .optional()
      .or(z.literal('')),
    password: z
      .string()
      .min(12, 'Use at least 12 characters')
      .max(128)
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[0-9]/, 'Include a digit'),
    confirmPassword: z.string(),
    consentToStoreData: z.literal(true, {
      errorMap: () => ({ message: 'You must consent before we can store your details' }),
    }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      consentToStoreData: false as unknown as true,
    },
  });

  const onSubmit = async (values: RegisterValues) => {
    setFormError(null);
    try {
      await api.post('/auth/register', {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone || undefined,
        password: values.password,
        consentToStoreData: values.consentToStoreData,
      });
      setSubmitted(true);
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Registration failed. Please try again.',
      );
    }
  };

  if (submitted) {
    return (
      <AuthLayout title="Check your email">
        <Alert tone="success" title="Almost there">
          We have sent you a verification link. Open it to activate your account, then sign in.
        </Alert>
        <Link
          to="/login"
          className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
        >
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your candidate account"
      subtitle="Apply for roles and track your applications in one place."
      footer={
        <span className="text-muted-foreground">
          Already registered?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="firstName" error={form.formState.errors.firstName?.message} required>
            <Input id="firstName" autoComplete="given-name" hasError={Boolean(form.formState.errors.firstName)} {...form.register('firstName')} />
          </Field>
          <Field label="Last name" htmlFor="lastName" error={form.formState.errors.lastName?.message} required>
            <Input id="lastName" autoComplete="family-name" hasError={Boolean(form.formState.errors.lastName)} {...form.register('lastName')} />
          </Field>
        </div>

        <Field label="Email address" htmlFor="email" error={form.formState.errors.email?.message} required>
          <Input id="email" type="email" autoComplete="username" hasError={Boolean(form.formState.errors.email)} {...form.register('email')} />
        </Field>

        <Field label="Mobile number" htmlFor="phone" error={form.formState.errors.phone?.message} hint="Optional">
          <Input id="phone" type="tel" autoComplete="tel" {...form.register('phone')} />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={form.formState.errors.password?.message}
          hint="At least 12 characters, with upper and lower case letters and a digit."
          required
        >
          <Input id="password" type="password" autoComplete="new-password" hasError={Boolean(form.formState.errors.password)} {...form.register('password')} />
        </Field>

        <Field label="Confirm password" htmlFor="confirmPassword" error={form.formState.errors.confirmPassword?.message} required>
          <Input id="confirmPassword" type="password" autoComplete="new-password" hasError={Boolean(form.formState.errors.confirmPassword)} {...form.register('confirmPassword')} />
        </Field>

        <div className="space-y-1.5">
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-input accent-primary"
              {...form.register('consentToStoreData')}
            />
            <span className="text-muted-foreground">
              I consent to my personal data being stored and processed for recruitment
              purposes. I can request access, correction or deletion at any time.
            </span>
          </label>
          {form.formState.errors.consentToStoreData && (
            <p role="alert" className="text-xs font-medium text-destructive">
              {form.formState.errors.consentToStoreData.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" isLoading={form.formState.isSubmitting}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
