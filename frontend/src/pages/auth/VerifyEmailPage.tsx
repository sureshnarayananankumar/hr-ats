import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { AuthLayout } from './AuthLayout';
import { Alert, Spinner } from '@/components/ui/primitives';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [state, setState] = useState<'pending' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState('');

  // StrictMode mounts effects twice in development; the token is
  // single-use, so the second call would always report "already used".
  const attempted = useRef(false);

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('This verification link is missing its token.');
      return;
    }
    if (attempted.current) return;
    attempted.current = true;

    api
      .post<{ message: string }>('/auth/verify-email', { token })
      .then((result) => {
        setState('success');
        setMessage(result.message);
      })
      .catch((error) => {
        setState('error');
        setMessage(
          error instanceof ApiError
            ? error.message
            : 'Verification failed. The link may have expired.',
        );
      });
  }, [token]);

  return (
    <AuthLayout title="Email verification">
      {state === 'pending' && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Spinner label="Verifying your email" />
          Verifying your email address…
        </div>
      )}

      {state === 'success' && (
        <>
          <Alert tone="success" title="Email verified">
            {message}
          </Alert>
          <Link to="/login" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
            Continue to sign in
          </Link>
        </>
      )}

      {state === 'error' && (
        <>
          <Alert tone="error" title="Could not verify">
            {message}
          </Alert>
          <Link to="/login" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </>
      )}
    </AuthLayout>
  );
}
