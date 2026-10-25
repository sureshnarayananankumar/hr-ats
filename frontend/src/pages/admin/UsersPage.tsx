import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatRelative, humanise } from '@/lib/utils';
import type { Paginated, RoleName } from '@/lib/types';
import {
  Alert,
  Badge,
  Button,
  Field,
  Input,
  PageHeader,
} from '@/components/ui/primitives';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Select } from '@/components/ui/select';
import { Dialog, useToast } from '@/components/ui/feedback';

interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  mfaEnabled: boolean;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  roles: RoleName[];
}

const ROLES: RoleName[] = ['SUPER_ADMIN', 'HR_ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'CANDIDATE'];
const STATUSES = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'PENDING_VERIFICATION'];

const createSchema = z.object({
  firstName: z.string().min(1, 'Required').max(100),
  lastName: z.string().min(1, 'Required').max(100),
  email: z.string().email('Enter a valid email'),
  role: z.enum(['SUPER_ADMIN', 'HR_ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'CANDIDATE']),
  temporaryPassword: z
    .string()
    .min(12, 'At least 12 characters')
    .regex(/[a-z]/, 'Include a lowercase letter')
    .regex(/[A-Z]/, 'Include an uppercase letter')
    .regex(/[0-9]/, 'Include a digit'),
});

type CreateValues = z.infer<typeof createSchema>;

export default function UsersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can, user: currentUser } = useAuth();

  const [createOpen, setCreateOpen] = useState(false);
  const [roleDialog, setRoleDialog] = useState<AdminUser | null>(null);
  const [newRole, setNewRole] = useState<RoleName>('RECRUITER');
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get<Paginated<AdminUser>>('/admin/users', { pageSize: 50 }),
  });

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { firstName: '', lastName: '', email: '', role: 'RECRUITER', temporaryPassword: '' },
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });

  const createUser = useMutation({
    mutationFn: (values: CreateValues) =>
      api.post('/admin/users', {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        roles: [values.role],
        temporaryPassword: values.temporaryPassword,
      }),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      form.reset();
      toast.success('User created', 'Share the temporary password through a secure channel.');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not create the user.'),
  });

  const setRoles = useMutation({
    mutationFn: ({ id, roles }: { id: string; roles: RoleName[] }) =>
      api.patch(`/admin/users/${id}/roles`, { roles }),
    onSuccess: () => {
      invalidate();
      setRoleDialog(null);
      toast.success('Roles updated', 'The user must sign in again for the change to take effect.');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not update roles.'),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/users/${id}/status`, { status }),
    onSuccess: () => {
      invalidate();
      toast.success('Status updated');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not update the status.'),
  });

  const columns: Array<Column<AdminUser>> = [
    {
      key: 'name',
      header: 'User',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">
            {row.firstName} {row.lastName}
            {row.id === currentUser?.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'roles',
      header: 'Roles',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.roles.map((role) => (
            <Badge key={role} tone={role === 'SUPER_ADMIN' ? 'danger' : 'info'}>
              {humanise(role)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge
          tone={
            row.status === 'ACTIVE' ? 'success'
              : row.status === 'PENDING_VERIFICATION' ? 'warning' : 'neutral'
          }
        >
          {humanise(row.status)}
        </Badge>
      ),
    },
    {
      key: 'mfa',
      header: 'MFA',
      hideOnMobile: true,
      render: (row) =>
        row.mfaEnabled ? (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <ShieldCheck className="size-3.5" aria-hidden="true" /> Enabled
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Not enrolled</span>
        ),
    },
    {
      key: 'lastLogin',
      header: 'Last sign-in',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.lastLoginAt ? formatRelative(row.lastLoginAt) : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        row.id === currentUser?.id ? (
          // The server also refuses self-modification; this keeps the UI
          // honest rather than offering an action that will fail.
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <div className="flex gap-1">
            {can('role.assign') && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setRoleDialog(row);
                  setNewRole(row.roles[0] ?? 'RECRUITER');
                }}
              >
                Roles
              </Button>
            )}
            {can('user.deactivate') && (
              <Select
                value={row.status}
                onValueChange={(value) => setStatus.mutate({ id: row.id, status: value })}
                options={STATUSES.map((status) => ({ value: status, label: humanise(status) }))}
                className="w-36"
                aria-label={`Status for ${row.email}`}
              />
            )}
          </div>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="User Management"
        description="Accounts, roles and access status."
        actions={
          can('user.create') ? (
            <Button onClick={() => setCreateOpen(true)} leftIcon={<UserPlus />}>
              New user
            </Button>
          ) : undefined
        }
      />

      {error && <Alert tone="error" className="mb-4">{error}</Alert>}

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        caption="User accounts"
        emptyTitle="No users found"
      />

      {/* ---- Create user ---- */}
      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create a user account"
        description="The user receives an invitation email and must change the temporary password at first sign-in."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={form.handleSubmit((values) => createUser.mutate(values))}
              isLoading={createUser.isPending}
            >
              Create user
            </Button>
          </>
        }
      >
        <form className="space-y-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name" htmlFor="firstName" error={form.formState.errors.firstName?.message} required>
              <Input id="firstName" {...form.register('firstName')} />
            </Field>
            <Field label="Last name" htmlFor="lastName" error={form.formState.errors.lastName?.message} required>
              <Input id="lastName" {...form.register('lastName')} />
            </Field>
          </div>

          <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message} required>
            <Input id="email" type="email" {...form.register('email')} />
          </Field>

          <Field label="Role" htmlFor="role" required>
            <Select
              id="role"
              value={form.watch('role')}
              onValueChange={(value) => form.setValue('role', value as RoleName)}
              options={ROLES.map((role) => ({ value: role, label: humanise(role) }))}
            />
          </Field>

          <Field
            label="Temporary password"
            htmlFor="temporaryPassword"
            error={form.formState.errors.temporaryPassword?.message}
            hint="At least 12 characters. Share it through a secure channel, never by email."
            required
          >
            <Input id="temporaryPassword" type="text" autoComplete="off" {...form.register('temporaryPassword')} />
          </Field>
        </form>
      </Dialog>

      {/* ---- Change roles ---- */}
      <Dialog
        open={roleDialog !== null}
        onOpenChange={(open) => !open && setRoleDialog(null)}
        title={`Change roles for ${roleDialog?.firstName ?? ''} ${roleDialog?.lastName ?? ''}`}
        description="Changing roles immediately revokes the user's active sessions."
        footer={
          <>
            <Button variant="outline" onClick={() => setRoleDialog(null)}>Cancel</Button>
            <Button
              onClick={() => roleDialog && setRoles.mutate({ id: roleDialog.id, roles: [newRole] })}
              isLoading={setRoles.isPending}
            >
              Update roles
            </Button>
          </>
        }
      >
        <Field label="Role" htmlFor="new-role" required>
          <Select
            id="new-role"
            value={newRole}
            onValueChange={(value) => setNewRole(value as RoleName)}
            options={ROLES.map((role) => ({ value: role, label: humanise(role) }))}
          />
        </Field>
      </Dialog>
    </>
  );
}
