import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'
import { UserMenu } from '@/components/ui/UserMenu'
import { ProtectedRoute } from '@/components/ui/ProtectedRoute'

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) => <a href={href}>{children}</a>,
}))

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} alt={props.alt ?? ''} />
  ),
}))

describe('UserMenu', () => {
  it('shows Login link when no session', () => {
    render(<UserMenu session={null} />)
    expect(screen.getByText('Login')).toBeTruthy()
    const link = screen.getByText('Login').closest('a')
    expect(link?.getAttribute('href')).toBe('/auth/signin')
  })

  it('shows Login button with onLoginClick callback', () => {
    const onLoginClick = vi.fn()
    render(<UserMenu session={null} onLoginClick={onLoginClick} />)
    const button = screen.getByText('Login')
    expect(button.tagName).toBe('BUTTON')
    fireEvent.click(button)
    expect(onLoginClick).toHaveBeenCalled()
  })

  it('renders user avatar initial when session has no image', () => {
    const session = {
      user: { name: 'Alice', email: 'alice@example.com', image: null },
    }
    render(<UserMenu session={session} />)
    expect(screen.getByText('A')).toBeTruthy()
  })

  it('renders user image when session has image', () => {
    const session = {
      user: {
        name: 'Alice',
        email: 'alice@example.com',
        image: 'https://example.com/alice.png',
      },
    }
    render(<UserMenu session={session} />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('src')).toBe('https://example.com/alice.png')
  })

  it('shows user name and email in menu', () => {
    const session = {
      user: { name: 'Alice', email: 'alice@example.com', image: null },
    }
    render(<UserMenu session={session} />)
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0)
    expect(screen.getByText('alice@example.com')).toBeTruthy()
  })

  it('shows Admin badge when user role is ADMIN', () => {
    const session = {
      user: {
        name: 'Admin',
        email: 'admin@example.com',
        image: null,
        role: 'ADMIN',
      },
    }
    render(<UserMenu session={session} />)
    const badges = screen.getAllByText('Admin')
    const adminBadge = badges.find((el) =>
      el.classList.contains('bg-purple-100')
    )
    expect(adminBadge).toBeTruthy()
  })

  it('does not show Admin badge for regular users', () => {
    const session = {
      user: {
        name: 'Bob',
        email: 'bob@example.com',
        image: null,
        role: 'CUSTOMER',
      },
    }
    render(<UserMenu session={session} />)
    expect(screen.queryByText('Admin')).toBeNull()
  })

  it('calls signOut when Sign Out button is clicked', async () => {
    const { signOut } = await import('next-auth/react')
    const session = {
      user: { name: 'Alice', email: 'alice@example.com', image: null },
    }
    render(<UserMenu session={session} />)
    await act(async () => {
      fireEvent.click(screen.getByText('Sign Out'))
    })
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/' })
  })

  it('shows fallback initial when name and email are both null', () => {
    const session = {
      user: { name: null, email: null, image: null },
    }
    render(<UserMenu session={session} />)
    expect(screen.getByText('?')).toBeTruthy()
  })
})

describe('ProtectedRoute', () => {
  it('shows authentication required when no session', () => {
    render(
      <ProtectedRoute session={null}>
        <div>Protected content</div>
      </ProtectedRoute>
    )
    expect(screen.getByText('Authentication Required')).toBeTruthy()
    expect(screen.queryByText('Protected content')).toBeNull()
  })

  it('renders children when session exists and no role required', () => {
    const session = {
      user: { name: 'Alice', email: 'alice@example.com', role: 'CUSTOMER' },
    }
    render(
      <ProtectedRoute session={session}>
        <div>Protected content</div>
      </ProtectedRoute>
    )
    expect(screen.getByText('Protected content')).toBeTruthy()
  })

  it('shows access denied when user lacks required role', () => {
    const session = {
      user: { name: 'Bob', email: 'bob@example.com', role: 'CUSTOMER' },
    }
    render(
      <ProtectedRoute session={session} requiredRole="ADMIN">
        <div>Admin only</div>
      </ProtectedRoute>
    )
    expect(screen.getByText('Access Denied')).toBeTruthy()
    expect(screen.queryByText('Admin only')).toBeNull()
  })

  it('renders children when user has required role', () => {
    const session = {
      user: { name: 'Admin', email: 'admin@example.com', role: 'ADMIN' },
    }
    render(
      <ProtectedRoute session={session} requiredRole="ADMIN">
        <div>Admin panel</div>
      </ProtectedRoute>
    )
    expect(screen.getByText('Admin panel')).toBeTruthy()
  })

  it('shows Sign In link in authentication required message', () => {
    render(
      <ProtectedRoute session={null}>
        <div>Protected</div>
      </ProtectedRoute>
    )
    const link = screen.getByText('Sign In').closest('a')
    expect(link?.getAttribute('href')).toBe('/auth/signin')
  })

  it('shows Go Home link in access denied message', () => {
    const session = {
      user: { name: 'Bob', email: 'bob@example.com', role: 'CUSTOMER' },
    }
    render(
      <ProtectedRoute session={session} requiredRole="ADMIN">
        <div>Admin only</div>
      </ProtectedRoute>
    )
    const link = screen.getByText('Go Home').closest('a')
    expect(link?.getAttribute('href')).toBe('/')
  })
})
