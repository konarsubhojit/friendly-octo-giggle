import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { ThemeSelector } from '@/components/ui/ThemeSelector'
import { ThemeProvider, THEMES } from '@/contexts/ThemeContext'

const renderWithProvider = (ui: React.ReactElement) =>
  render(<ThemeProvider>{ui}</ThemeProvider>)

describe('ThemeSelector', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('renders a select element with aria-label', () => {
    renderWithProvider(<ThemeSelector />)
    const select = screen.getByRole('combobox', { name: /colour theme/i })
    expect(select).toBeInTheDocument()
  })

  it('shows default theme as selected by default', () => {
    renderWithProvider(<ThemeSelector />)
    expect(screen.getByRole('combobox')).toHaveValue('default')
  })

  it('lists all theme options', () => {
    renderWithProvider(<ThemeSelector />)
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(THEMES.length)
  })

  it('includes Bloom & Thread option', () => {
    renderWithProvider(<ThemeSelector />)
    expect(
      screen.getByRole('option', { name: /^bloom & thread$/i })
    ).toBeInTheDocument()
  })

  it('includes Simple Linen option', () => {
    renderWithProvider(<ThemeSelector />)
    expect(
      screen.getByRole('option', { name: /simple linen/i })
    ).toBeInTheDocument()
  })

  it('includes Baby Pink option', () => {
    renderWithProvider(<ThemeSelector />)
    expect(
      screen.getByRole('option', { name: /baby pink/i })
    ).toBeInTheDocument()
  })

  it('includes Midnight Bloom option', () => {
    renderWithProvider(<ThemeSelector />)
    expect(
      screen.getByRole('option', { name: /midnight bloom/i })
    ).toBeInTheDocument()
  })

  it('switches to baby-pink when selected', () => {
    renderWithProvider(<ThemeSelector />)
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'baby-pink' } })
    expect(select).toHaveValue('baby-pink')
  })

  it('shows the active theme description', () => {
    renderWithProvider(<ThemeSelector />)
    expect(screen.getByText(/warm cream and terracotta/i)).toBeTruthy()
  })

  it('applies data-theme attribute on documentElement when baby-pink is chosen', () => {
    renderWithProvider(<ThemeSelector />)
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'baby-pink' } })
    expect(document.documentElement.dataset.theme).toBe('baby-pink')
  })

  it('applies data-theme attribute on documentElement when midnight-bloom is chosen', () => {
    renderWithProvider(<ThemeSelector />)
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'midnight-bloom' } })
    expect(document.documentElement.dataset.theme).toBe('midnight-bloom')
  })
})
