import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ContactForm from '@/app/contact/ContactForm';

describe('ContactForm', () => {
  it('renders form with all fields', () => {
    render(<ContactForm />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Subject')).toBeInTheDocument();
    expect(screen.getByLabelText('Message')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send Message' })).toBeInTheDocument();
  });

  it('shows validation errors when submitting empty form', () => {
    render(<ContactForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }));

    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Please select a subject')).toBeInTheDocument();
    expect(screen.getByText('Message is required')).toBeInTheDocument();
  });

  it('shows email validation error for invalid email', () => {
    render(<ContactForm />);
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'not-an-email', name: 'email' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }));

    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
  });

  it('submits successfully when all fields are valid', () => {
    render(<ContactForm />);

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'John Doe', name: 'name' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'john@example.com', name: 'email' },
    });
    fireEvent.change(screen.getByLabelText('Subject'), {
      target: { value: 'order', name: 'subject' },
    });
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'I need help with my order', name: 'message' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }));

    expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
    expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
    expect(screen.queryByText('Please select a subject')).not.toBeInTheDocument();
    expect(screen.queryByText('Message is required')).not.toBeInTheDocument();
  });

  it('shows success state after submission', () => {
    render(<ContactForm />);

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Jane Doe', name: 'name' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'jane@example.com', name: 'email' },
    });
    fireEvent.change(screen.getByLabelText('Subject'), {
      target: { value: 'order', name: 'subject' },
    });
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'Where is my order?', name: 'message' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }));

    expect(screen.getByText('Message Sent!')).toBeInTheDocument();
    expect(screen.getByText('Send another message')).toBeInTheDocument();
  });

  it('resets form when "Send another message" is clicked', () => {
    render(<ContactForm />);

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Jane Doe', name: 'name' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'jane@example.com', name: 'email' },
    });
    fireEvent.change(screen.getByLabelText('Subject'), {
      target: { value: 'order', name: 'subject' },
    });
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'Where is my order?', name: 'message' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }));
    expect(screen.getByText('Message Sent!')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Send another message'));

    // Form should be visible again with empty fields
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Email')).toHaveValue('');
    expect(screen.getByLabelText('Subject')).toHaveValue('');
    expect(screen.getByLabelText('Message')).toHaveValue('');
  });

  it('clears field error when user types in it', () => {
    render(<ContactForm />);

    // Submit to trigger errors
    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }));
    expect(screen.getByText('Name is required')).toBeInTheDocument();

    // Type in the name field to clear the error
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'J', name: 'name' },
    });

    expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
  });
});
