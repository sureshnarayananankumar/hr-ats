import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Download, ShieldAlert, Upload, X } from 'lucide-react';
import { api, ApiError, downloadFile, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatBytes, formatDate, humanise } from '@/lib/utils';
import type { CandidateDocument, CandidateProfile } from '@/lib/types';
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
  PageLoader,
  Textarea,
} from '@/components/ui/primitives';
import { Select } from '@/components/ui/select';
import { ConfirmDialog, useToast } from '@/components/ui/feedback';

const WORK_MODES = ['ONSITE', 'REMOTE', 'HYBRID'] as const;

const schema = z.object({
  fullName: z.string().min(1, 'Your name is required').max(200),
  mobile: z.string().max(30).optional().or(z.literal('')),
  location: z.string().max(200).optional().or(z.literal('')),
  totalExperience: z.coerce.number().min(0).max(60).optional(),
  currentDesignation: z.string().max(150).optional().or(z.literal('')),
  currentCompany: z.string().max(200).optional().or(z.literal('')),
  highestEducation: z.string().max(200).optional().or(z.literal('')),
  noticePeriodDays: z.coerce.number().int().min(0).max(365).optional(),
  expectedSalary: z.coerce.number().min(0).optional(),
  linkedinUrl: z.string().url('Enter a full URL including https://').max(400).optional().or(z.literal('')),
  portfolioUrl: z.string().url('Enter a full URL including https://').max(400).optional().or(z.literal('')),
  preferredLocation: z.string().max(200).optional().or(z.literal('')),
  preferredWorkMode: z.enum(WORK_MODES).optional(),
  willingToRelocate: z.boolean().optional(),
  summary: z.string().max(5000).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export default function MyProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deletionOpen, setDeletionOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profile = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get<CandidateProfile>('/candidates/me'),
  });

  const documents = useQuery({
    queryKey: ['my-documents', user?.candidateId],
    queryFn: () => api.get<CandidateDocument[]>(`/documents/candidate/${user!.candidateId}`),
    enabled: Boolean(user?.candidateId),
  });

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    const data = profile.data;
    if (!data) return;
    form.reset({
      fullName: data.fullName,
      mobile: data.mobile ?? '',
      location: data.location ?? '',
      totalExperience: data.totalExperience ? Number(data.totalExperience) : undefined,
      currentDesignation: data.currentDesignation ?? '',
      currentCompany: data.currentCompany ?? '',
      highestEducation: data.highestEducation ?? '',
      noticePeriodDays: data.noticePeriodDays ?? undefined,
      expectedSalary: data.expectedSalary ? Number(data.expectedSalary) : undefined,
      linkedinUrl: data.linkedinUrl ?? '',
      portfolioUrl: data.portfolioUrl ?? '',
      preferredLocation: data.preferredLocation ?? '',
      preferredWorkMode: data.preferredWorkMode ?? undefined,
      willingToRelocate: data.willingToRelocate ?? false,
      summary: data.summary ?? '',
    });
    setSkills((data.skills ?? []).map((entry) => entry.skill.name));
  }, [profile.data, form]);

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      api.patch('/candidates/me', {
        ...values,
        // Empty strings fail URL validation server-side; omit instead.
        linkedinUrl: values.linkedinUrl || undefined,
        portfolioUrl: values.portfolioUrl || undefined,
        mobile: values.mobile || undefined,
        location: values.location || undefined,
        currentDesignation: values.currentDesignation || undefined,
        currentCompany: values.currentCompany || undefined,
        highestEducation: values.highestEducation || undefined,
        preferredLocation: values.preferredLocation || undefined,
        summary: values.summary || undefined,
        skills: skills.map((name) => ({ name })),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-profile'] });
      toast.success('Profile updated');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not save your profile.'),
  });

  const requestDeletion = useMutation({
    mutationFn: () => api.post<{ message: string }>('/candidates/me/request-deletion'),
    onSuccess: (result) => {
      setDeletionOpen(false);
      toast.toast({ title: 'Request recorded', description: result.message, tone: 'info' });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not submit the request.'),
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      await uploadFile('/documents/upload', file, { documentType: 'RESUME' });
      void documents.refetch();
      toast.success('Resume uploaded', 'Your previous version is kept in your history.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  if (profile.isLoading) return <PageLoader label="Loading your profile" />;

  return (
    <>
      <PageHeader
        title="My profile"
        description="Keep your details current — recruiters see this when reviewing your applications."
      />

      {error && <Alert tone="error" className="mb-4">{error}</Alert>}

      <form onSubmit={form.handleSubmit((values) => save.mutate(values))} className="space-y-4" noValidate>
        <Card>
          <CardHeader><CardTitle>Personal details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="fullName" error={form.formState.errors.fullName?.message} required>
              <Input id="fullName" {...form.register('fullName')} />
            </Field>
            <Field label="Mobile number" htmlFor="mobile">
              <Input id="mobile" type="tel" {...form.register('mobile')} />
            </Field>
            <Field label="Location" htmlFor="location">
              <Input id="location" {...form.register('location')} />
            </Field>
            <Field label="Preferred location" htmlFor="preferredLocation">
              <Input id="preferredLocation" {...form.register('preferredLocation')} />
            </Field>
            <Field label="LinkedIn URL" htmlFor="linkedinUrl" error={form.formState.errors.linkedinUrl?.message}>
              <Input id="linkedinUrl" type="url" placeholder="https://linkedin.com/in/…" {...form.register('linkedinUrl')} />
            </Field>
            <Field label="Portfolio URL" htmlFor="portfolioUrl" error={form.formState.errors.portfolioUrl?.message}>
              <Input id="portfolioUrl" type="url" placeholder="https://…" {...form.register('portfolioUrl')} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Professional details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Current designation" htmlFor="currentDesignation">
              <Input id="currentDesignation" {...form.register('currentDesignation')} />
            </Field>
            <Field label="Current company" htmlFor="currentCompany">
              <Input id="currentCompany" {...form.register('currentCompany')} />
            </Field>
            <Field label="Total experience (years)" htmlFor="totalExperience">
              <Input id="totalExperience" type="number" step="0.5" min={0} {...form.register('totalExperience')} />
            </Field>
            <Field label="Highest education" htmlFor="highestEducation">
              <Input id="highestEducation" {...form.register('highestEducation')} />
            </Field>
            <Field label="Notice period (days)" htmlFor="noticePeriodDays">
              <Input id="noticePeriodDays" type="number" min={0} {...form.register('noticePeriodDays')} />
            </Field>
            <Field label="Expected salary (annual)" htmlFor="expectedSalary">
              <Input id="expectedSalary" type="number" min={0} {...form.register('expectedSalary')} />
            </Field>

            <Field label="Preferred work mode" htmlFor="preferredWorkMode">
              <Controller
                control={form.control}
                name="preferredWorkMode"
                render={({ field }) => (
                  <Select
                    id="preferredWorkMode"
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                    placeholder="No preference"
                    options={WORK_MODES.map((value) => ({ value, label: humanise(value) }))}
                  />
                )}
              />
            </Field>

            <div className="flex items-end">
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input type="checkbox" className="size-4 rounded border-input accent-primary" {...form.register('willingToRelocate')} />
                <span className="text-muted-foreground">Willing to relocate</span>
              </label>
            </div>

            <Field label="Professional summary" htmlFor="summary" className="sm:col-span-2">
              <Textarea id="summary" rows={4} placeholder="A short introduction for recruiters." {...form.register('summary')} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Skills</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={skillInput}
                onChange={(event) => setSkillInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    const name = skillInput.trim();
                    if (name && !skills.includes(name)) setSkills([...skills, name]);
                    setSkillInput('');
                  }
                }}
                placeholder="Add a skill and press Enter"
                aria-label="Skill name"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const name = skillInput.trim();
                  if (name && !skills.includes(name)) setSkills([...skills, name]);
                  setSkillInput('');
                }}
              >
                Add
              </Button>
            </div>

            {skills.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <li key={skill}>
                    <Badge tone="info">
                      {skill}
                      <button
                        type="button"
                        onClick={() => setSkills(skills.filter((entry) => entry !== skill))}
                        aria-label={`Remove ${skill}`}
                        className="ml-0.5 rounded-full hover:bg-black/10"
                      >
                        <X className="size-3" aria-hidden="true" />
                      </button>
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Button type="submit" isLoading={save.isPending}>Save profile</Button>
      </form>

      {/* ---- Documents ---- */}
      <Card className="mt-4">
        <CardHeader><CardTitle>My documents</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground hover:border-primary hover:text-foreground">
            <Upload className="size-4" aria-hidden="true" />
            {uploading ? 'Uploading…' : 'Upload a resume (PDF, DOC or DOCX, up to 10 MB)'}
            <input
              type="file"
              className="sr-only"
              accept=".pdf,.doc,.docx"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUpload(file);
              }}
            />
          </label>

          {(documents.data?.length ?? 0) > 0 ? (
            <ul className="divide-y">
              {documents.data!.map((document) => (
                <li key={document.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{document.originalName}</p>
                    <p className="text-xs text-muted-foreground">
                      v{document.version} · {formatBytes(document.sizeBytes)} · {formatDate(document.uploadedAt)}
                      {document.isCurrent && ' · current'}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Download ${document.originalName}`}
                    onClick={() => void downloadFile(`/documents/${document.id}/download`, document.originalName)}
                  >
                    <Download className="size-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
          )}
        </CardContent>
      </Card>

      {/* ---- Privacy ---- */}
      <Card className="mt-4 border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-destructive" aria-hidden="true" />
            Privacy &amp; your data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You can request deletion of your personal data at any time. Requests are reviewed by
            HR, since active applications and legal retention periods may apply.
          </p>
          <Button variant="outline" onClick={() => setDeletionOpen(true)}>
            Request data deletion
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deletionOpen}
        onOpenChange={setDeletionOpen}
        title="Request deletion of your data?"
        tone="destructive"
        confirmLabel="Submit request"
        isLoading={requestDeletion.isPending}
        message="Your request is recorded and reviewed by HR. You will be contacted about which records can be removed and which must be retained."
        onConfirm={() => requestDeletion.mutate()}
      />
    </>
  );
}
