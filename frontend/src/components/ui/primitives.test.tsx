import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Alert, Badge, Button, EmptyState, Field, Input, StatCard } from './primitives';
import { JobStatusBadge, StageBadge, RatingDisplay } from './status';

describe('Button', () => {
  it('renders its label and responds to a click', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save changes</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled and marked busy while loading', async () => {
    const onClick = vi.fn();
    render(<Button isLoading onClick={onClick}>Save</Button>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not fire when disabled', async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Field', () => {
  // Error text that is not linked to the control is invisible to a
  // screen reader, so this wiring is the accessibility contract.
  it('associates the label with its control', () => {
    render(
      <Field label="Email address" htmlFor="email">
        <Input id="email" />
      </Field>,
    );
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  });

  it('announces errors with role="alert"', () => {
    render(
      <Field label="Email" htmlFor="email" error="Enter a valid email address">
        <Input id="email" />
      </Field>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address');
  });

  it('marks required fields', () => {
    render(
      <Field label="Name" htmlFor="name" required>
        <Input id="name" />
      </Field>,
    );
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('hides the hint once an error is shown', () => {
    render(
      <Field label="Name" htmlFor="name" hint="Your full name" error="Required">
        <Input id="name" />
      </Field>,
    );
    expect(screen.queryByText('Your full name')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('Input', () => {
  it('flags invalid state for assistive technology', () => {
    render(<Input hasError aria-label="Email" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('accepts typed text', async () => {
    render(<Input aria-label="Search" />);
    const input = screen.getByLabelText('Search');
    await userEvent.type(input, 'engineer');
    expect(input).toHaveValue('engineer');
  });
});

describe('Alert', () => {
  it('uses role="alert" for errors so they interrupt', () => {
    render(<Alert tone="error" title="Something failed">Details</Alert>);
    expect(screen.getByRole('alert')).toHaveTextContent('Something failed');
  });

  it('uses role="status" for informational messages', () => {
    render(<Alert tone="info">Just so you know</Alert>);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('explains the situation and offers an action', () => {
    render(
      <EmptyState
        title="No job requirements found"
        description="Create your first requirement."
        action={<Button>New requirement</Button>}
      />,
    );
    expect(screen.getByText('No job requirements found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New requirement' })).toBeInTheDocument();
  });
});

describe('StatCard', () => {
  it('shows the label, value and hint', () => {
    render(<StatCard label="Open positions" value={6} hint="Unfilled vacancies" />);
    expect(screen.getByText('Open positions')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('Unfilled vacancies')).toBeInTheDocument();
  });
});

describe('Status badges', () => {
  // Colour must never be the only channel conveying meaning.
  it('renders readable text for a job status', () => {
    render(<JobStatusBadge status="PENDING_APPROVAL" />);
    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
  });

  it('renders the display label for a stage', () => {
    render(<StageBadge stage="RESUME_SCREENING" />);
    expect(screen.getByText('Resume Screening')).toBeInTheDocument();
  });

  it('renders a plain Badge', () => {
    render(<Badge tone="success">Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});

describe('RatingDisplay', () => {
  it('exposes the rating as text, not just stars', () => {
    render(<RatingDisplay value={4} />);
    expect(screen.getByText('Rated 4 out of 5')).toBeInTheDocument();
    expect(screen.getByText('4.0')).toBeInTheDocument();
  });
});
