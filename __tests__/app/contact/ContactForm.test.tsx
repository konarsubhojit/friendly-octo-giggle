import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ContactForm from '@/app/contact/ContactForm'

describe('ContactForm', () => {
  it('renders form with all fields', () => {
    render(<ContactForm />)
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Subject')).toBeInTheDocument()
    expect(screen.getByLabelText('Message')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Send Message' })
    ).toBeInTheDocument()
  })

  it('shows validation errors when submitting empty form', () => {
    render(<ContactForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }))

    expect(
      screen.getByText('Tell us your name so we know how to address you.')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Enter the email address where we should reply.')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Choose the topic that best matches your message.')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Share a few details so our team can help you faster.')
    ).toBeInTheDocument()
  })

  it('shows email validation error for invalid email', () => {
    render(<ContactForm />)
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'not-an-email', name: 'email' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }))

    expect(
      screen.getByText('Enter a valid email address, like you@example.com.')
    ).toBeInTheDocument()
  })

  it('submits successfully when all fields are valid', () => {
    render(<ContactForm />)

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'John Doe', name: 'name' },
    })
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'john@example.com', name: 'email' },
    })
    fireEvent.change(screen.getByLabelText('Subject'), {
      target: { value: 'order', name: 'subject' },
    })
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'I need help with my order', name: 'message' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }))

    expect(
      screen.queryByText('Tell us your name so we know how to address you.')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Enter the email address where we should reply.')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Choose the topic that best matches your message.')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Share a few details so our team can help you faster.')
    ).not.toBeInTheDocument()
  })

  it('shows success state after submission', () => {
    render(<ContactForm />)

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Jane Doe', name: 'name' },
    })
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'jane@example.com', name: 'email' },
    })
    fireEvent.change(screen.getByLabelText('Subject'), {
      target: { value: 'order', name: 'subject' },
    })
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'Where is my order?', name: 'message' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }))

    expect(screen.getByText('Message Sent!')).toBeInTheDocument()
    expect(screen.getByText('Send another message')).toBeInTheDocument()
  })

  it('resets form when "Send another message" is clicked', () => {
    render(<ContactForm />)

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Jane Doe', name: 'name' },
    })
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'jane@example.com', name: 'email' },
    })
    fireEvent.change(screen.getByLabelText('Subject'), {
      target: { value: 'order', name: 'subject' },
    })
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'Where is my order?', name: 'message' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }))
    expect(screen.getByText('Message Sent!')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Send another message'))

    expect(screen.getByLabelText('Name')).toHaveValue('')
    expect(screen.getByLabelText('Email')).toHaveValue('')
    expect(screen.getByLabelText('Subject')).toHaveValue('')
    expect(screen.getByLabelText('Message')).toHaveValue('')
  })

  it('clears field error when user types in it', () => {
    render(<ContactForm />)

    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }))
    expect(
      screen.getByText('Tell us your name so we know how to address you.')
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'J', name: 'name' },
    })

    expect(
      screen.queryByText('Tell us your name so we know how to address you.')
    ).not.toBeInTheDocument()
  })
})
