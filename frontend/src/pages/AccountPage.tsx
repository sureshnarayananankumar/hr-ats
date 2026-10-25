import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound, ShieldCheck, Smartphone, Monitor } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime, formatRelative, humanise } from '@/lib/utils';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  PageHeader,
} from '@/components/ui/primitives';
import { Dialog, useToast } from '@/components/ui/feedback';

interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Required'),
    newPassword: z
      .string()
      .min(12, 'Use at least 12 characters')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[0-9]/, 'Include a digit'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type PasswordValues = z.infer<typeof passwordSchema>;

export default function AccountPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaSecret, setMfaSecret] = useState<{ secret: string; otpauth: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessions = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: () => api.get<Session[]>('/auth/sessions'),
  });

  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const changePassword = useMutation({
    mutationFn: (values: PasswordValues) =>
      api.post('/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: async () => {
      toast.success('Password changed', 'All sessions were signed out. Please sign in again.');
      // Changing a password revokes every session server-side, so the
      // local state must be cleared to match.
      await logout();
      window.location.href = '/login';
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not change the password.'),
  });

  const beginMfa = useMutation({
    mutationFn: () => api.post<{ secret: string; otpauth: string }>('/auth/mfa/setup'),
    onSuccess: (result) => {
      setMfaSecret(result);
      setMfaOpen(true);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not start MFA setup.'),
  });

  const confirmMfa = useMutation({
    mutationFn: () => api.post<{ recoveryCodes: string[] }>('/auth/mfa/confirm', { code: mfaCode }),
    onSuccess: (result) => {
      setRecoveryCodes(result.recoveryCodes);
      setMfaCode('');
      void queryClient.invalidateQueries({ queryKey: ['auth'] });
      toast.success('Multi-factor authentication enabled');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Invalid code.'),
  });

  const revokeAll = useMutation({
    mutationFn: () => api.post('/auth/logout-all'),
    onSuccess: () => {
      window.location.href = '/login';
    },
  });

  return (
    <>
      <PageHeader title="Account & security" description="Manage your sign-in and session security." />

      {error && <Alert tone="error" className="mb-4">{error}</Alert>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-2.5 text-sm">
              {[
                ['Name', `${user?.firstName} ${user?.lastName}`],
                ['Email', user?.email],
                ['Roles', user?.roles.map(humanise).join(', ')],
                ['Status', user?.status ? humanise(user.status) : '—'],
                ['Email verified', user?.emailVerified ? 'Yes' : 'No'],
                ['Last sign-in', user?.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'This is your first session'],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Multi-factor authentication
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {user?.mfaEnabled ? (
              <>
                <Badge tone="success">Enabled</Badge>
                <p className="text-sm text-muted-foreground">
                  Your account requires a one-time code at sign-in.
                </p>
              </>
            ) : (
              <>
                <Badge tone="warning">Not enrolled</Badge>
                <p className="text-sm text-muted-foreground">
                  Privileged roles should enrol in MFA. You will need an authenticator app.
                </p>
                <Button onClick={() => beginMfa.mutate()} isLoading={beginMfa.isPending} leftIcon={<Smartphone />}>
                  Set up MFA
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4" aria-hidden="true" />
              Change password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={form.handleSubmit((values) => changePassword.mutate(values))}
              className="space-y-3"
              noValidate
            >
              <Field label="Current password" htmlFor="currentPassword" error={form.formState.errors.currentPassword?.message} required>
                <Input id="currentPassword" type="password" autoComplete="current-password" {...form.register('currentPassword')} />
              </Field>
              <Field label="New password" htmlFor="newPassword" error={form.formState.errors.newPassword?.message} required>
                <Input id="newPassword" type="password" autoComplete="new-password" {...form.register('newPassword')} />
              </Field>
              <Field label="Confirm new password" htmlFor="confirmPassword" error={form.formState.errors.confirmPassword?.message} required>
                <Input id="confirmPassword" type="password" autoComplete="new-password" {...form.register('confirmPassword')} />
              </Field>
              <Button type="submit" isLoading={changePassword.isPending}>
                Change password
              </Button>
              <p className="text-xs text-muted-foreground">
                Changing your password signs you out of every device.
              </p>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="size-4" aria-hidden="true" />
              Active sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessions.data && sessions.data.length > 0 ? (
              <ul className="divide-y">
                {sessions.data.map((session) => (
                  <li key={session.id} className="py-2.5 text-sm">
                    <p className="truncate font-medium">{session.userAgent ?? 'Unknown device'}</p>
                    <p className="text-xs text-muted-foreground">
                      {session.ipAddress ?? 'unknown IP'} · started {formatRelative(session.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No other active sessions.</p>
            )}

            <Button variant="outline" onClick={() => revokeAll.mutate()} isLoading={revokeAll.isPending}>
              Sign out everywhere
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ---- MFA enrolment ---- */}
      <Dialog
        open={mfaOpen}
        onOpenChange={(open) => {
          setMfaOpen(open);
          if (!open) {
            setMfaSecret(null);
            setRecoveryCodes(null);
          }
        }}
        title="Set up multi-factor authentication"
        description={
          recoveryCodes
            ? 'Save these recovery codes now — they are shown only once.'
            : 'Add this secret to your authenticator app, then enter the generated code.'
        }
      >
        {recoveryCodes ? (
          <div className="space-y-3">
            <Alert tone="warning" title="Store these somewhere safe">
              Each code can be used once if you lose access to your authenticator app.
            </Alert>
            <ul className="grid grid-cols-2 gap-2 rounded-md border bg-muted p-3 font-mono text-sm">
              {recoveryCodes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
            <Button
              className="w-full"
              onClick={() => {
                setMfaOpen(false);
                setRecoveryCodes(null);
                window.location.reload();
              }}
            >
              I have saved my codes
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Secret key" htmlFor="mfa-secret" hint="Enter this in your authenticator app if you cannot scan a QR code.">
              <Input id="mfa-secret" readOnly value={mfaSecret?.secret ?? ''} className="font-mono" />
            </Field>

            <Field label="Verification code" htmlFor="mfa-code" required>
              <Input
                id="mfa-code"
                inputMode="numeric"
                placeholder="123456"
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value)}
              />
            </Field>

            <Button
              className="w-full"
              onClick={() => confirmMfa.mutate()}
              isLoading={confirmMfa.isPending}
              disabled={mfaCode.length < 6}
            >
              Verify and enable
            </Button>
          </div>
        )}
      </Dialog>
    </>
  );
}
