// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { LocaleProvider, useLocale } from '@/contexts/LocaleContext'

const LocalizedPathProbe = ({ path }: { readonly path: string }) => {
  const { localizePath } = useLocale()
  return <span>{localizePath(path)}</span>
}

describe('LocaleContext', () => {
  it('keeps internal navigation paths locale-agnostic', () => {
    render(
      <LocaleProvider locale="es">
        <LocalizedPathProbe path="/shop" />
      </LocaleProvider>
    )
    expect(screen.getByText('/shop')).toBeInTheDocument()
  })

  it('strips locale prefix from links when present', () => {
    render(
      <LocaleProvider locale="en">
        <LocalizedPathProbe path="/en/admin" />
      </LocaleProvider>
    )
    expect(screen.getByText('/admin')).toBeInTheDocument()
  })
})
