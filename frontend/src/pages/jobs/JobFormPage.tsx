import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { humanise } from '@/lib/utils';
import type { Department, JobRequirement, UserSummary } from '@/lib/types';
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
import { useToast } from '@/components/ui/feedback';

const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERNSHIP', 'FREELANCE'] as const;
const WORK_MODES = ['ONSITE', 'REMOTE', 'HYBRID'] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

const schema = z
  .object({
    title: z.string().min(1, 'Job title is required').max(200),
    description: z.string().min(1, 'A job description is required').max(20000),
    responsibilities: z.string().max(20000).optional(),
    qualifications: z.string().max(20000).optional(),
    internalNotes: z.string().max(10000).optional(),
    departmentId: z.string().uuid('Select a department'),
    designation: z.string().min(1, 'Designation is required').max(150),
    location: z.string().min(1, 'Location is required').max(200),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    workMode: z.enum(WORK_MODES),
    priority: z.enum(PRIORITIES),
    vacancies: z.coerce.number().int().min(1, 'At least one vacancy').max(999),
    minExperience: z.coerce.number().int().min(0).max(50),
    maxExperience: z.coerce.number().int().min(0).max(50).optional(),
    salaryMin: z.coerce.number().min(0).optional(),
    salaryMax: z.coerce.number().min(0).optional(),
    salaryCurrency: z.string().max(3).optional(),
    salaryConfidential: z.boolean(),
    applicationDeadline: z.string().optional(),
    recruiterId: z.string().uuid().optional().or(z.literal('')),
    hiringManagerId: z.string().uuid().optional().or(z.literal('')),
  })
  // These two rules mirror server-side checks so the user sees the
  // problem before submitting rather than after a 400.
  .refine((v) => v.maxExperience === undefined || v.minExperience <= v.maxExperience, {
    message: 'Maximum experience must be at least the minimum',
    path: ['maxExperience'],
  })
  .refine((v) => !v.salaryMin || !v.salaryMax || v.salaryMin <= v.salaryMax, {
    message: 'Maximum salary must be at least the minimum',
    path: ['salaryMax'],
  });

type FormValues = z.infer<typeof schema>;

export default function JobFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [skills, setSkills] = useState<Array<{ name: string; isRequired: boolean }>>([]);
  const [skillInput, setSkillInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const departments = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get<Department[]>('/admin/departments'),
  });

  const recruiters = useQuery({
    queryKey: ['assignable', 'RECRUITER'],
    queryFn: () => api.get<UserSummary[]>('/admin/users/assignable', { role: 'RECRUITER' }),
  });

  const managers = useQuery({
    queryKey: ['assignable', 'HIRING_MANAGER'],
    queryFn: () => api.get<UserSummary[]>('/admin/users/assignable', { role: 'HIRING_MANAGER' }),
  });

  const existing = useQuery({
    queryKey: ['job', id],
    queryFn: () => api.get<JobRequirement>(`/jobs/${id}`),
    enabled: isEdit,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      responsibilities: '',
      qualifications: '',
      internalNotes: '',
      departmentId: '',
      designation: '',
      location: '',
      employmentType: 'FULL_TIME',
      workMode: 'ONSITE',
      priority: 'MEDIUM',
      vacancies: 1,
      minExperience: 0,
      salaryCurrency: 'USD',
      salaryConfidential: true,
      recruiterId: '',
      hiringManagerId: '',
    },
  });

  // Populate the form once the existing record arrives.
  useEffect(() => {
    const job = existing.data;
    if (!job) return;

    form.reset({
      title: job.title,
      description: job.description ?? '',
      responsibilities: job.responsibilities ?? '',
      qualifications: job.qualifications ?? '',
      internalNotes: job.internalNotes ?? '',
      departmentId: job.departmentId ?? job.department?.id ?? '',
      designation: job.designation,
      location: job.location,
      employmentType: job.employmentType,
      workMode: job.workMode,
      priority: job.priority,
      vacancies: job.vacancies,
      minExperience: job.minExperience,
      maxExperience: job.maxExperience ?? undefined,
      salaryMin: job.salaryMin ? Number(job.salaryMin) : undefined,
      salaryMax: job.salaryMax ? Number(job.salaryMax) : undefined,
      salaryCurrency: job.salaryCurrency,
      salaryConfidential: job.salaryConfidential ?? true,
      applicationDeadline: job.applicationDeadline ? job.applicationDeadline.slice(0, 10) : '',
      recruiterId: job.recruiter?.id ?? '',
      hiringManagerId: job.hiringManager?.id ?? '',
    });

    if (Array.isArray(job.skills)) {
      setSkills(
        job.skills.map((entry) =>
          typeof entry === 'string'
            ? { name: entry, isRequired: true }
            : { name: entry.skill.name, isRequired: entry.isRequired },
        ),
      );
    }
  }, [existing.data, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        ...values,
        // Empty strings would fail UUID validation server-side.
        recruiterId: values.recruiterId || undefined,
        hiringManagerId: values.hiringManagerId || undefined,
        applicationDeadline: values.applicationDeadline
          ? new Date(values.applicationDeadline).toISOString()
          : undefined,
        responsibilities: values.responsibilities || undefined,
        qualifications: values.qualifications || undefined,
        internalNotes: values.internalNotes || undefined,
        skills: skills.map((skill) => ({ name: skill.name, isRequired: skill.isRequired })),
      };
      return isEdit
        ? api.patch<JobRequirement>(`/jobs/${id}`, payload)
        : api.post<JobRequirement>('/jobs', payload);
    },
    onSuccess: (job) => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
      void queryClient.invalidateQueries({ queryKey: ['job', id] });
      toast.success(isEdit ? 'Requirement updated' : 'Requirement saved as draft');
      navigate(`/jobs/${job.id}`);
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : 'Could not save the requirement.');
    },
  });

  const addSkill = (isRequired: boolean) => {
    const name = skillInput.trim();
    if (!name) return;
    if (skills.some((skill) => skill.name.toLowerCase() === name.toLowerCase())) {
      setSkillInput('');
      return;
    }
    setSkills((current) => [...current, { name, isRequired }]);
    setSkillInput('');
  };

  if (isEdit && existing.isLoading) return <PageLoader label="Loading requirement" />;

  return (
    <>
      <PageHeader
        title={isEdit ? 'Edit job requirement' : 'New job requirement'}
        description={
          isEdit
            ? 'Changes are recorded in the requirement history.'
            : 'Saved as a draft. Submit it for approval when you are ready.'
        }
      />

      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="grid gap-4 lg:grid-cols-3"
        noValidate
      >
        <div className="space-y-4 lg:col-span-2">
          {formError && <Alert tone="error">{formError}</Alert>}

          <Card>
            <CardHeader>
              <CardTitle>Role details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Job title" htmlFor="title" error={form.formState.errors.title?.message} required>
                <Input id="title" placeholder="e.g. Senior Backend Engineer" hasError={Boolean(form.formState.errors.title)} {...form.register('title')} />
              </Field>

              <Field label="Designation" htmlFor="designation" error={form.formState.errors.designation?.message} required>
                <Input id="designation" placeholder="e.g. Senior Engineer" hasError={Boolean(form.formState.errors.designation)} {...form.register('designation')} />
              </Field>

              <Field label="Job description" htmlFor="description" error={form.formState.errors.description?.message} required>
                <Textarea id="description" rows={6} placeholder="What the role involves and why it matters." hasError={Boolean(form.formState.errors.description)} {...form.register('description')} />
              </Field>

              <Field label="Responsibilities" htmlFor="responsibilities" hint="One per line works well.">
                <Textarea id="responsibilities" rows={4} {...form.register('responsibilities')} />
              </Field>

              <Field label="Qualifications" htmlFor="qualifications">
                <Textarea id="qualifications" rows={4} {...form.register('qualifications')} />
              </Field>

              <Field
                label="Internal notes"
                htmlFor="internalNotes"
                hint="Never shown on the public careers portal."
              >
                <Textarea id="internalNotes" rows={3} {...form.register('internalNotes')} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Skills</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={skillInput}
                  onChange={(event) => setSkillInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      // Enter inside a text field would submit the form.
                      event.preventDefault();
                      addSkill(true);
                    }
                  }}
                  placeholder="Add a skill, e.g. TypeScript"
                  aria-label="Skill name"
                />
                <Button type="button" variant="outline" onClick={() => addSkill(true)}>
                  Required
                </Button>
                <Button type="button" variant="ghost" onClick={() => addSkill(false)}>
                  Preferred
                </Button>
              </div>

              {skills.length === 0 ? (
                <p className="text-sm text-muted-foreground">No skills added yet.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <li key={skill.name}>
                      <Badge tone={skill.isRequired ? 'info' : 'neutral'}>
                        {skill.name}
                        <span className="text-[0.625rem] opacity-70">
                          {skill.isRequired ? 'required' : 'preferred'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSkills((current) => current.filter((s) => s.name !== skill.name))}
                          aria-label={`Remove ${skill.name}`}
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
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Placement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Department" htmlFor="departmentId" error={form.formState.errors.departmentId?.message} required>
                <Controller
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <Select
                      id="departmentId"
                      value={field.value}
                      onValueChange={field.onChange}
                      hasError={Boolean(form.formState.errors.departmentId)}
                      placeholder="Select a department"
                      options={(departments.data ?? []).map((department) => ({
                        value: department.id,
                        label: department.name,
                      }))}
                    />
                  )}
                />
              </Field>

              <Field label="Location" htmlFor="location" error={form.formState.errors.location?.message} required>
                <Input id="location" placeholder="e.g. Muscat, Oman" hasError={Boolean(form.formState.errors.location)} {...form.register('location')} />
              </Field>

              <Field label="Employment type" htmlFor="employmentType">
                <Controller
                  control={form.control}
                  name="employmentType"
                  render={({ field }) => (
                    <Select
                      id="employmentType"
                      value={field.value}
                      onValueChange={field.onChange}
                      options={EMPLOYMENT_TYPES.map((value) => ({ value, label: humanise(value) }))}
                    />
                  )}
                />
              </Field>

              <Field label="Work mode" htmlFor="workMode">
                <Controller
                  control={form.control}
                  name="workMode"
                  render={({ field }) => (
                    <Select
                      id="workMode"
                      value={field.value}
                      onValueChange={field.onChange}
                      options={WORK_MODES.map((value) => ({ value, label: humanise(value) }))}
                    />
                  )}
                />
              </Field>

              <Field label="Priority" htmlFor="priority">
                <Controller
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <Select
                      id="priority"
                      value={field.value}
                      onValueChange={field.onChange}
                      options={PRIORITIES.map((value) => ({ value, label: humanise(value) }))}
                    />
                  )}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Headcount &amp; experience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Number of vacancies" htmlFor="vacancies" error={form.formState.errors.vacancies?.message} required>
                <Input id="vacancies" type="number" min={1} hasError={Boolean(form.formState.errors.vacancies)} {...form.register('vacancies')} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Min experience" htmlFor="minExperience" error={form.formState.errors.minExperience?.message}>
                  <Input id="minExperience" type="number" min={0} {...form.register('minExperience')} />
                </Field>
                <Field label="Max experience" htmlFor="maxExperience" error={form.formState.errors.maxExperience?.message}>
                  <Input id="maxExperience" type="number" min={0} {...form.register('maxExperience')} />
                </Field>
              </div>

              <Field label="Application deadline" htmlFor="applicationDeadline">
                <Input id="applicationDeadline" type="date" {...form.register('applicationDeadline')} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Compensation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Salary from" htmlFor="salaryMin">
                  <Input id="salaryMin" type="number" min={0} {...form.register('salaryMin')} />
                </Field>
                <Field label="Salary to" htmlFor="salaryMax" error={form.formState.errors.salaryMax?.message}>
                  <Input id="salaryMax" type="number" min={0} {...form.register('salaryMax')} />
                </Field>
              </div>

              <Field label="Currency" htmlFor="salaryCurrency">
                <Input id="salaryCurrency" maxLength={3} placeholder="USD" {...form.register('salaryCurrency')} />
              </Field>

              <label className="flex items-start gap-2.5 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 rounded border-input accent-primary" {...form.register('salaryConfidential')} />
                <span className="text-muted-foreground">
                  Keep compensation confidential (hidden on the public careers portal)
                </span>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ownership</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Assigned recruiter" htmlFor="recruiterId">
                <Controller
                  control={form.control}
                  name="recruiterId"
                  render={({ field }) => (
                    <Select
                      id="recruiterId"
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                      placeholder="Unassigned"
                      options={(recruiters.data ?? []).map((person) => ({
                        value: person.id,
                        label: person.name,
                      }))}
                    />
                  )}
                />
              </Field>

              <Field label="Hiring manager" htmlFor="hiringManagerId">
                <Controller
                  control={form.control}
                  name="hiringManagerId"
                  render={({ field }) => (
                    <Select
                      id="hiringManagerId"
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                      placeholder="Unassigned"
                      options={(managers.data ?? []).map((person) => ({
                        value: person.id,
                        label: person.name,
                      }))}
                    />
                  )}
                />
              </Field>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" isLoading={mutation.isPending}>
              {isEdit ? 'Save changes' : 'Save as draft'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
