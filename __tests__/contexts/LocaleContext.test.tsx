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
  it('prepends the active locale to internal hrefs', () => {
    render(
      <LocaleProvider locale="es">
        <LocalizedPathProbe path="/shop" />
      </LocaleProvider>
    )
    expect(screen.getByText('/es/shop')).toBeInTheDocument()
  })

  it('is idempotent when the path is already locale-prefixed', () => {
    render(
      <LocaleProvider locale="en">
        <LocalizedPathProbe path="/en/admin" />
      </LocaleProvider>
    )
    expect(screen.getByText('/en/admin')).toBeInTheDocument()
  })
})
