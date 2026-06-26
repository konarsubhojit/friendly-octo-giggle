// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { Button } from '@/components/ui/Button'

describe('Button', () => {
  describe('rendering', () => {
    it('renders children', () => {
      render(<Button>Click me</Button>)
      expect(screen.getByRole('button', { name: 'Click me' })).toBeTruthy()
    })

    it('renders a <button> element', () => {
      const { container } = render(<Button>Submit</Button>)
      expect(container.firstChild?.nodeName).toBe('BUTTON')
    })

    it('defaults to type="button"', () => {
      render(<Button>Click</Button>)
      const btn = screen.getByRole('button') as HTMLButtonElement
      expect(btn.type).toBe('button')
    })

    it('accepts type="submit"', () => {
      render(<Button type="submit">Submit</Button>)
      const btn = screen.getByRole('button') as HTMLButtonElement
      expect(btn.type).toBe('submit')
    })
  })

  describe('variants', () => {
    it('applies primary variant classes by default', () => {
      const { container } = render(<Button>Primary</Button>)
      const btn = container.firstChild as HTMLElement
      expect(btn.className).toContain('from-[var(--btn-primary)]')
    })

    it('applies secondary variant classes', () => {
      const { container } = render(
        <Button variant="secondary">Secondary</Button>
      )
      const btn = container.firstChild as HTMLElement
      expect(btn.className).toContain('from-[var(--text-secondary)]')
    })

    it('applies ghost variant classes', () => {
      const { container } = render(<Button variant="ghost">Ghost</Button>)
      const btn = container.firstChild as HTMLElement
      expect(btn.className).toContain('bg-[var(--accent-blush)]')
      expect(btn.className).toContain('border-[var(--border-warm)]')
    })

    it('applies gradient variant classes', () => {
      const { container } = render(<Button variant="gradient">Gradient</Button>)
      const btn = container.firstChild as HTMLElement
      expect(btn.className).toContain('from-[var(--accent-warm)]')
      expect(btn.className).toContain('to-[var(--accent-rose)]')
    })

    it('applies danger variant classes', () => {
      const { container } = render(<Button variant="danger">Delete</Button>)
      const btn = container.firstChild as HTMLElement
      expect(btn.className).toContain('from-red-400')
      expect(btn.className).toContain('to-red-500')
    })
  })

  describe('sizes', () => {
    it('applies md size classes by default', () => {
      const { container } = render(<Button>Click</Button>)
      const btn = container.firstChild as HTMLElement
      expect(btn.className).toContain('px-6')
      expect(btn.className).toContain('py-2.5')
    })

    it('applies sm size classes', () => {
      const { container } = render(<Button size="sm">Small</Button>)
      const btn = container.firstChild as HTMLElement
      expect(btn.className).toContain('px-4')
      expect(btn.className).toContain('py-2')
    })

    it('applies lg size classes', () => {
      const { container } = render(<Button size="lg">Large</Button>)
      const btn = container.firstChild as HTMLElement
      expect(btn.className).toContain('px-6')
      expect(btn.className).toContain('py-3')
      expect(btn.className).toContain('text-base')
    })
  })

  describe('loading state', () => {
    it('is not loading by default', () => {
      render(<Button>Click</Button>)
      const btn = screen.getByRole('button') as HTMLButtonElement
      expect(btn.disabled).toBe(false)
    })

    it('disables the button when loading=true', () => {
      render(<Button loading>Saving</Button>)
      const btn = screen.getByRole('button') as HTMLButtonElement
      expect(btn.disabled).toBe(true)
    })

    it('shows loadingText when loading', () => {
      render(
        <Button loading loadingText="Saving…">
          Submit
        </Button>
      )
      expect(screen.getByRole('button').textContent).toBe('Saving…')
    })

    it('shows children when loading but no loadingText', () => {
      render(<Button loading>Submit</Button>)
      expect(screen.getByRole('button').textContent).toBe('Submit')
    })

    it('applies disabled:opacity-50 class', () => {
      const { container } = render(<Button>Click</Button>)
      const btn = container.firstChild as HTMLElement
      expect(btn.className).toContain('disabled:opacity-50')
    })
  })

  describe('disabled state', () => {
    it('disables the button when disabled=true', () => {
      render(<Button disabled>Click</Button>)
      const btn = screen.getByRole('button') as HTMLButtonElement
      expect(btn.disabled).toBe(true)
    })

    it('applies disabled:cursor-not-allowed class', () => {
      const { container } = render(<Button>Click</Button>)
      const btn = container.firstChild as HTMLElement
      expect(btn.className).toContain('disabled:cursor-not-allowed')
    })
  })

  describe('fullWidth', () => {
    it('does not apply w-full by default', () => {
      const { container } = render(<Button>Click</Button>)
      const btn = container.firstChild as HTMLElement
      expect(btn.className).not.toContain('w-full')
    })

    it('applies w-full when fullWidth=true', () => {
      const { container } = render(<Button fullWidth>Click</Button>)
      const btn = container.firstChild as HTMLElement
      expect(btn.className).toContain('w-full')
    })
  })

  describe('base styles', () => {
    it('always applies rounded-full', () => {
      const { container } = render(<Button>Click</Button>)
      expect((container.firstChild as HTMLElement).className).toContain(
        'rounded-full'
      )
    })

    it('always applies font-semibold', () => {
      const { container } = render(<Button>Click</Button>)
      expect((container.firstChild as HTMLElement).className).toContain(
        'font-semibold'
      )
    })

    it('always applies focus-warm', () => {
      const { container } = render(<Button>Click</Button>)
      expect((container.firstChild as HTMLElement).className).toContain(
        'focus-warm'
      )
    })
  })

  describe('className passthrough', () => {
    it('merges extra className', () => {
      const { container } = render(
        <Button className="my-extra-class">Click</Button>
      )
      expect((container.firstChild as HTMLElement).className).toContain(
        'my-extra-class'
      )
    })
  })

  describe('event handlers', () => {
    it('calls onClick when clicked', () => {
      const onClick = vi.fn()
      render(<Button onClick={onClick}>Click</Button>)
      fireEvent.click(screen.getByRole('button'))
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('does not call onClick when disabled', () => {
      const onClick = vi.fn()
      render(
        <Button disabled onClick={onClick}>
          Click
        </Button>
      )
      fireEvent.click(screen.getByRole('button'))
      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe('HTML attribute passthrough', () => {
    it('passes aria-label', () => {
      render(<Button aria-label="Close dialog">X</Button>)
      expect(screen.getByRole('button', { name: 'Close dialog' })).toBeTruthy()
    })

    it('passes data-testid', () => {
      render(<Button data-testid="my-btn">Click</Button>)
      expect(screen.getByTestId('my-btn')).toBeTruthy()
    })
  })
})
