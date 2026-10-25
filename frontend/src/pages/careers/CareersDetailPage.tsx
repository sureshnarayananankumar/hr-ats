import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Briefcase, Clock, MapPin, Upload, CheckCircle2 } from 'lucide-react';
import { api, ApiError, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatBytes, formatDate, formatExperience, formatSalaryRange, humanise } from '@/lib/utils';
import type { CandidateDocument, PublicJob } from '@/lib/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  Field,
  PageLoader,
  Textarea,
} from '@/components/ui/primitives';
import { Select } from '@/components/ui/select';
import { Logo } from '@/components/ui/Logo';
import { Dialog, useToast } from '@/components/ui/feedback';

export default function CareersDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();

  const [applyOpen, setApplyOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [resumeId, setResumeId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const job = useQuery({
    queryKey: ['public-job', slug],
    queryFn: () => api.get<PublicJob>(`/public/jobs/${slug}`),
  });

  const sources = useQuery({
    queryKey: ['public-sources'],
    queryFn: () => api.get<Array<{ id: string; name: string }>>('/public/sources'),
  });

  const documents = useQuery({
    queryKey: ['my-documents'],
    queryFn: () => api.get<CandidateDocument[]>(`/documents/candidate/${user?.candidateId}`),
    enabled: Boolean(user?.candidateId) && applyOpen,
  });

  const apply = useMutation({
    mutationFn: () =>
      api.post('/applications', {
        jobId: job.data!.id,
        coverLetter: coverLetter || undefined,
        sourceId: sourceId || undefined,
        resumeDocumentId: resumeId || undefined,
      }),
    onSuccess: () => {
      setApplied(true);
      setApplyOpen(false);
      toast.success('Application submitted', 'We have emailed you a confirmation.');
    },
    onError: (err) => {
      // 409 means the duplicate-application guard fired.
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not submit your application. Please try again.',
      );
    },
  });

  const handleUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const document = await uploadFile<CandidateDocument>('/documents/upload', file, {
        documentType: 'RESUME',
      });
      setResumeId(document.id);
      void documents.refetch();
      toast.success('Resume uploaded');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  if (job.isLoading) return <PageLoader label="Loading job" />;

  if (job.isError || !job.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Alert tone="error" title="This job is no longer available">
          It may have been closed or filled.
        </Alert>
        <Link to="/careers" className="mt-4 inline-block text-sm text-primary hover:underline">
          Back to all openings
        </Link>
      </div>
    );
  }

  const data = job.data;
  const canApply = data.acceptingApplications !== false;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Logo width={140} />
            <Link to="/careers" className="inline-flex items-center gap-2 border-l pl-4 text-sm font-medium hover:text-primary">
              <ArrowLeft className="size-4" aria-hidden="true" />
              All openings
            </Link>
          </div>
          {!isAuthenticated && (
            <Button size="sm" variant="outline" onClick={() => navigate('/login')}>
              Sign in
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {applied && (
          <Alert tone="success" title="Application received" className="mb-6">
            Thank you for applying. You can track its progress in{' '}
            <Link to="/portal/applications" className="font-medium underline">
              your applications
            </Link>
            .
          </Alert>
        )}

        {error && <Alert tone="error" className="mb-6">{error}</Alert>}

        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{data.title}</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {data.department && (
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="size-4" aria-hidden="true" />
                {data.department}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden="true" />
              {data.location}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden="true" />
              {formatExperience(data.minExperience, data.maxExperience)}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge tone="info">{humanise(data.employmentType)}</Badge>
            <Badge>{humanise(data.workMode)}</Badge>
            {data.salaryDisclosed && (
              <Badge tone="success">
                {formatSalaryRange(data.salaryMin, data.salaryMax, data.salaryCurrency ?? 'USD')}
              </Badge>
            )}
            {data.vacancies > 1 && <Badge>{data.vacancies} openings</Badge>}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {canApply ? (
              <Button
                size="lg"
                disabled={applied}
                onClick={() => {
                  if (!isAuthenticated) {
                    // Send them to sign in, then straight back here.
                    navigate('/login', { state: { from: `/careers/${slug}` } });
                    return;
                  }
                  setApplyOpen(true);
                }}
              >
                {applied ? 'Application submitted' : 'Apply now'}
              </Button>
            ) : (
              <Alert tone="warning" title="Applications are closed">
                The deadline for this position has passed.
              </Alert>
            )}
            {data.applicationDeadline && canApply && (
              <span className="text-sm text-muted-foreground">
                Closes {formatDate(data.applicationDeadline)}
              </span>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="space-y-6 pt-6">
            <section>
              <h2 className="mb-2 text-base font-semibold">About the role</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {data.description}
              </p>
            </section>

            {data.responsibilities && (
              <section>
                <h2 className="mb-2 text-base font-semibold">Responsibilities</h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {data.responsibilities}
                </p>
              </section>
            )}

            {data.qualifications && (
              <section>
                <h2 className="mb-2 text-base font-semibold">Qualifications</h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {data.qualifications}
                </p>
              </section>
            )}

            {(data.requiredSkills?.length ?? 0) > 0 && (
              <section>
                <h2 className="mb-2 text-base font-semibold">Required skills</h2>
                <ul className="flex flex-wrap gap-2">
                  {data.requiredSkills!.map((skill) => (
                    <li key={skill}>
                      <Badge tone="info">{skill}</Badge>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(data.preferredSkills?.length ?? 0) > 0 && (
              <section>
                <h2 className="mb-2 text-base font-semibold">Nice to have</h2>
                <ul className="flex flex-wrap gap-2">
                  {data.preferredSkills!.map((skill) => (
                    <li key={skill}>
                      <Badge>{skill}</Badge>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </CardContent>
        </Card>

        {(data.related?.length ?? 0) > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-base font-semibold">Related openings</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.related!.map((related) => (
                <li key={related.slug}>
                  <Link to={`/careers/${related.slug}`} className="block rounded-lg border p-4 hover:border-primary hover:shadow-sm">
                    <p className="font-medium">{related.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {related.location} · {humanise(related.workMode)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {/* ---- Apply dialog ---- */}
      <Dialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        title={`Apply for ${data.title}`}
        description="Attach your resume and tell us why you are a good fit."
        footer={
          <>
            <Button variant="outline" onClick={() => setApplyOpen(false)}>Cancel</Button>
            <Button onClick={() => apply.mutate()} isLoading={apply.isPending}>
              Submit application
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field
            label="Resume"
            htmlFor="resume-upload"
            hint="PDF, DOC or DOCX, up to 10 MB. Your file is stored privately."
          >
            <div className="space-y-2">
              {(documents.data?.length ?? 0) > 0 && (
                <Select
                  value={resumeId}
                  onValueChange={setResumeId}
                  placeholder="Choose an existing resume"
                  options={documents.data!
                    .filter((document) => document.documentType === 'RESUME')
                    .map((document) => ({
                      value: document.id,
                      label: `${document.originalName} (v${document.version}, ${formatBytes(document.sizeBytes)})`,
                    }))}
                  aria-label="Existing resume"
                />
              )}

              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground hover:border-primary hover:text-foreground">
                <Upload className="size-4" aria-hidden="true" />
                {uploading ? 'Uploading…' : 'Upload a new resume'}
                <input
                  id="resume-upload"
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

              {resumeId && (
                <p className="inline-flex items-center gap-1.5 text-xs text-success">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  Resume attached
                </p>
              )}
            </div>
          </Field>

          <Field label="Cover letter" htmlFor="cover-letter" hint="Optional, but it helps.">
            <Textarea
              id="cover-letter"
              rows={5}
              value={coverLetter}
              onChange={(event) => setCoverLetter(event.target.value)}
              placeholder="Why are you interested in this role?"
            />
          </Field>

          <Field label="How did you hear about us?" htmlFor="source">
            <Select
              id="source"
              value={sourceId}
              onValueChange={setSourceId}
              placeholder="Select a source"
              options={(sources.data ?? []).map((source) => ({ value: source.id, label: source.name }))}
            />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
