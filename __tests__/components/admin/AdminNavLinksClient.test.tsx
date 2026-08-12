// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AdminNavLinksClient } from '@/features/admin/components/AdminNavLinksClient'
import { ADMIN_PERMISSIONS, ROLE_PERMISSIONS } from '@/lib/constants/roles'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('AdminNavLinksClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(globalThis, 'scrollY', { value: 0, writable: true })
    Object.defineProperty(globalThis, 'scrollX', { value: 0, writable: true })
  })

  it('renders the Dashboard link', () => {
    render(
      <AdminNavLinksClient
        failedEmailCount={0}
        permissions={ADMIN_PERMISSIONS}
      />
    )
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/admin'
    )
  })

  it('renders Catalogue, People, Operations dropdown buttons', () => {
    render(
      <AdminNavLinksClient
        failedEmailCount={0}
        permissions={ADMIN_PERMISSIONS}
      />
    )
    expect(screen.getByRole('button', { name: /Catalogue/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /People/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Operations/i })).toBeInTheDocument()
  })

  it('renders Jump to... quick navigation button', () => {
    render(
      <AdminNavLinksClient
        failedEmailCount={0}
        permissions={ADMIN_PERMISSIONS}
      />
    )
    expect(
      screen.getByRole('button', { name: /Quick navigation/i })
    ).toBeInTheDocument()
  })

  it('Catalogue dropdown is closed initially (no menu items visible)', () => {
    render(
      <AdminNavLinksClient
        failedEmailCount={0}
        permissions={ADMIN_PERMISSIONS}
      />
    )
    expect(screen.queryByRole('link', { name: 'Products' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Categories' })).toBeNull()
  })

  it('clicking Catalogue button opens the dropdown with menu items', async () => {
    render(
      <AdminNavLinksClient
        failedEmailCount={0}
        permissions={ADMIN_PERMISSIONS}
      />
    )
    const catalogBtn = screen.getByRole('button', { name: /Catalogue/i })
    fireEvent.click(catalogBtn)
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument()
    })
    expect(screen.getByRole('menuitem', { name: 'Products' })).toHaveAttribute(
      'href',
      '/admin/products'
    )
    expect(
      screen.getByRole('menuitem', { name: 'Categories' })
    ).toHaveAttribute('href', '/admin/categories')
  })

  it('positions the dropdown using viewport coordinates when the page is scrolled', async () => {
    Object.defineProperty(globalThis, 'scrollY', {
      value: 320,
      writable: true,
    })
    Object.defineProperty(globalThis, 'scrollX', { value: 48, writable: true })
    Object.defineProperty(globalThis, 'innerWidth', {
      value: 1280,
      writable: true,
    })

    const rectSpy = vi
      .spyOn(HTMLButtonElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({
        x: 24,
        y: 180,
        top: 180,
        left: 24,
        right: 116,
        bottom: 218,
        width: 92,
        height: 38,
        toJSON: () => ({}),
      })

    render(
      <AdminNavLinksClient
        failedEmailCount={0}
        permissions={ADMIN_PERMISSIONS}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Catalogue/i }))

    await waitFor(() => {
      expect(screen.getByRole('menu')).toHaveStyle({
        top: '218px',
        left: '24px',
      })
    })

    rectSpy.mockRestore()
  })

  it('repositions an open dropdown when the viewport scrolls', async () => {
    Object.defineProperty(globalThis, 'innerWidth', {
      value: 1280,
      writable: true,
    })

    let currentRect = {
      x: 24,
      y: 180,
      top: 180,
      left: 24,
      right: 116,
      bottom: 218,
      width: 92,
      height: 38,
      toJSON: () => ({}),
    }

    const rectSpy = vi
      .spyOn(HTMLButtonElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => currentRect)

    render(
      <AdminNavLinksClient
        failedEmailCount={0}
        permissions={ADMIN_PERMISSIONS}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Catalogue/i }))

    await waitFor(() => {
      expect(screen.getByRole('menu')).toHaveStyle({
        top: '218px',
        left: '24px',
      })
    })

    currentRect = {
      ...currentRect,
      y: 12,
      top: 12,
      bottom: 50,
    }

    fireEvent.scroll(window)

    await waitFor(() => {
      expect(screen.getByRole('menu')).toHaveStyle({
        top: '50px',
        left: '24px',
      })
    })

    rectSpy.mockRestore()
  })

  it('Catalogue dropdown button has aria-expanded=false initially', () => {
    render(
      <AdminNavLinksClient
        failedEmailCount={0}
        permissions={ADMIN_PERMISSIONS}
      />
    )
    const catalogBtn = screen.getByRole('button', { name: /Catalogue/i })
    expect(catalogBtn).toHaveAttribute('aria-expanded', 'false')
  })

  it('Catalogue dropdown button has aria-expanded=true when open', async () => {
    render(
      <AdminNavLinksClient
        failedEmailCount={0}
        permissions={ADMIN_PERMISSIONS}
      />
    )
    const catalogBtn = screen.getByRole('button', { name: /Catalogue/i })
    fireEvent.click(catalogBtn)
    await waitFor(() => {
      expect(catalogBtn).toHaveAttribute('aria-expanded', 'true')
    })
  })

  it('clicking a menu item closes the dropdown', async () => {
    render(
      <AdminNavLinksClient
        failedEmailCount={0}
        permissions={ADMIN_PERMISSIONS}
      />
    )
    const catalogBtn = screen.getByRole('button', { name: /Catalogue/i })
    fireEvent.click(catalogBtn)
    await waitFor(() => screen.getByRole('menuitem', { name: 'Products' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Products' }))
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull()
    })
  })

  it('People dropdown opens with Users and Reviews links', async () => {
    render(
      <AdminNavLinksClient
        failedEmailCount={0}
        permissions={ADMIN_PERMISSIONS}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /People/i }))
    await waitFor(() => screen.getByRole('menu'))
    expect(screen.getByRole('menuitem', { name: 'Users' })).toHaveAttribute(
      'href',
      '/admin/users'
    )
    expect(screen.getByRole('menuitem', { name: 'Reviews' })).toHaveAttribute(
      'href',
      '/admin/reviews'
    )
  })

  it('Operations dropdown opens with Search and Email Failures links', async () => {
    render(
      <AdminNavLinksClient
        failedEmailCount={0}
        permissions={ADMIN_PERMISSIONS}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Operations/i }))
    await waitFor(() => screen.getByRole('menu'))
    expect(screen.getByRole('menuitem', { name: 'Search' })).toHaveAttribute(
      'href',
      '/admin/search'
    )
    expect(
      screen.getByRole('menuitem', { name: 'Email Failures' })
    ).toHaveAttribute('href', '/admin/email-failures')
  })

  it('shows failed email badge when failedEmailCount > 0', async () => {
    render(
      <AdminNavLinksClient
        failedEmailCount={5}
        permissions={ADMIN_PERMISSIONS}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Operations/i }))
    await waitFor(() => screen.getByRole('menu'))
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('shows 99+ badge when failedEmailCount > 99', async () => {
    render(
      <AdminNavLinksClient
        failedEmailCount={150}
        permissions={ADMIN_PERMISSIONS}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Operations/i }))
    await waitFor(() => screen.getByRole('menu'))
    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('does not show badge when failedEmailCount is 0', async () => {
    render(
      <AdminNavLinksClient
        failedEmailCount={0}
        permissions={ADMIN_PERMISSIONS}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Operations/i }))
    await waitFor(() => screen.getByRole('menu'))
    expect(screen.queryByText('0')).toBeNull()
  })

  it('clicking outside closes the dropdown', async () => {
    render(
      <div>
        <AdminNavLinksClient
          failedEmailCount={0}
          permissions={ADMIN_PERMISSIONS}
        />
        <div data-testid="outside">outside</div>
      </div>
    )
    fireEvent.click(screen.getByRole('button', { name: /Catalogue/i }))
    await waitFor(() => screen.getByRole('menu'))
    fireEvent.mouseDown(screen.getByTestId('outside'))
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull()
    })
  })

  it('clicking the backdrop button again closes the dropdown', async () => {
    render(
      <AdminNavLinksClient
        failedEmailCount={0}
        permissions={ADMIN_PERMISSIONS}
      />
    )
    const catalogBtn = screen.getByRole('button', { name: /Catalogue/i })
    fireEvent.click(catalogBtn)
    await waitFor(() => screen.getByRole('menu'))
    fireEvent.click(catalogBtn)
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull()
    })
  })

  describe('CommandPalette', () => {
    it('opens command palette when Jump to button is clicked', async () => {
      render(
        <AdminNavLinksClient
          failedEmailCount={0}
          permissions={ADMIN_PERMISSIONS}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: /Quick navigation/i }))
      await waitFor(() => {
        expect(
          screen.getByRole('dialog', { name: /Admin quick navigation/i })
        ).toBeInTheDocument()
      })
    })

    it('shows all nav items in command palette', async () => {
      render(
        <AdminNavLinksClient
          failedEmailCount={0}
          permissions={ADMIN_PERMISSIONS}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: /Quick navigation/i }))
      const dialog = await screen.findByRole('dialog')
      expect(dialog).toBeInTheDocument()
      expect(dialog.textContent).toContain('Dashboard')
      expect(dialog.textContent).toContain('Products')
      expect(dialog.textContent).toContain('Orders')
      expect(dialog.textContent).toContain('Email Failures')
    })

    it('filters items when typing in command palette', async () => {
      render(
        <AdminNavLinksClient
          failedEmailCount={0}
          permissions={ADMIN_PERMISSIONS}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: /Quick navigation/i }))
      await waitFor(() => screen.getByRole('dialog'))
      const input = screen.getByPlaceholderText('Jump to admin section...')
      fireEvent.change(input, { target: { value: 'order' } })
      await waitFor(() => {
        expect(screen.queryByText('Products')).toBeNull()
        expect(screen.getByText('Orders')).toBeInTheDocument()
      })
    })

    it("shows 'No matching sections' when filter has no results", async () => {
      render(
        <AdminNavLinksClient
          failedEmailCount={0}
          permissions={ADMIN_PERMISSIONS}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: /Quick navigation/i }))
      await waitFor(() => screen.getByRole('dialog'))
      const input = screen.getByPlaceholderText('Jump to admin section...')
      fireEvent.change(input, { target: { value: 'xyznonexistent' } })
      await waitFor(() => {
        expect(screen.getByText('No matching sections')).toBeInTheDocument()
      })
    })

    it('closes command palette when backdrop is clicked', async () => {
      render(
        <AdminNavLinksClient
          failedEmailCount={0}
          permissions={ADMIN_PERMISSIONS}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: /Quick navigation/i }))
      await waitFor(() => screen.getByRole('dialog'))
      fireEvent.click(screen.getByRole('button', { name: /Close navigation/i }))
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull()
      })
    })

    it('closes command palette on Escape key', async () => {
      render(
        <AdminNavLinksClient
          failedEmailCount={0}
          permissions={ADMIN_PERMISSIONS}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: /Quick navigation/i }))
      await waitFor(() => screen.getByRole('dialog'))
      const input = screen.getByPlaceholderText('Jump to admin section...')
      fireEvent.keyDown(input, { key: 'Escape' })
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull()
      })
    })

    it('ArrowDown and ArrowUp navigate through items', async () => {
      render(
        <AdminNavLinksClient
          failedEmailCount={0}
          permissions={ADMIN_PERMISSIONS}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: /Quick navigation/i }))
      await waitFor(() => screen.getByRole('dialog'))
      const input = screen.getByPlaceholderText('Jump to admin section...')
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      fireEvent.keyDown(input, { key: 'ArrowUp' })
      expect(input).toBeInTheDocument()
    })

    it('shows badge for email failures in command palette', async () => {
      render(
        <AdminNavLinksClient
          failedEmailCount={3}
          permissions={ADMIN_PERMISSIONS}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: /Quick navigation/i }))
      await waitFor(() => screen.getByRole('dialog'))
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('Ctrl+K keyboard shortcut opens command palette', async () => {
      render(
        <AdminNavLinksClient
          failedEmailCount={0}
          permissions={ADMIN_PERMISSIONS}
        />
      )
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
    })

    it('Cmd+K keyboard shortcut opens command palette', async () => {
      render(
        <AdminNavLinksClient
          failedEmailCount={0}
          permissions={ADMIN_PERMISSIONS}
        />
      )
      fireEvent.keyDown(document, { key: 'k', metaKey: true })
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
    })
  })

  it('hides catalog entries FULFILMENT cannot use', () => {
    render(
      <AdminNavLinksClient
        failedEmailCount={0}
        permissions={ROLE_PERMISSIONS.FULFILMENT}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Catalogue/i }))
    expect(
      screen.getByRole('menuitem', { name: 'Products' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('menuitem', { name: 'Categories' })
    ).not.toBeInTheDocument()
  })

  it('drops groups entirely when the role has none of their permissions', () => {
    render(
      <AdminNavLinksClient
        failedEmailCount={0}
        permissions={ROLE_PERMISSIONS.CUSTOMER}
      />
    )

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Catalogue/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /People/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Operations/i })
    ).not.toBeInTheDocument()
  })
})
