import { describe, expect, it } from 'vitest'
import {
  ALLOWED_FORMATS,
  DEFAULT_QUALITY,
  MAX_QUALITY,
  MAX_WIDTH,
  MIN_QUALITY,
  MIN_WIDTH,
  describeValidationFailure,
  isAllowedHostname,
  validateImageRequest,
} from '../../../workers/images/src/validation'

const ALLOW_LIST =
  'images.unsplash.com,lh3.googleusercontent.com,.public.blob.vercel-storage.com'

const buildUrl = (params: Record<string, string>): URL => {
  const url = new URL('https://images.example.com/')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url
}

describe('isAllowedHostname', () => {
  it('matches an exact hostname entry', () => {
    expect(isAllowedHostname('images.unsplash.com', ALLOW_LIST)).toBe(true)
  })

  it('matches a subdomain against a leading-dot suffix entry', () => {
    expect(
      isAllowedHostname('abc123.public.blob.vercel-storage.com', ALLOW_LIST)
    ).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isAllowedHostname('IMAGES.UNSPLASH.COM', ALLOW_LIST)).toBe(true)
  })

  it('rejects a hostname not on the allow-list', () => {
    expect(isAllowedHostname('evil.example.com', ALLOW_LIST)).toBe(false)
  })

  it('does not let a suffix entry match a bare-domain impersonation', () => {
    // "evilpublic.blob.vercel-storage.com" ends with
    // "public.blob.vercel-storage.com" as a raw string, but not with the
    // configured ".public.blob.vercel-storage.com" (leading dot), so this
    // must be rejected.
    expect(
      isAllowedHostname('evilpublic.blob.vercel-storage.com', ALLOW_LIST)
    ).toBe(false)
  })

  it('handles an empty allow-list', () => {
    expect(isAllowedHostname('images.unsplash.com', '')).toBe(false)
  })
})

describe('validateImageRequest', () => {
  it('accepts a fully specified valid request', () => {
    const result = validateImageRequest(
      buildUrl({
        url: 'https://images.unsplash.com/photo.jpg',
        w: '800',
        q: '80',
        f: 'webp',
      }),
      ALLOW_LIST
    )

    expect(result).toEqual({
      ok: true,
      request: {
        sourceUrl: 'https://images.unsplash.com/photo.jpg',
        width: 800,
        quality: 80,
        format: 'webp',
      },
    })
  })

  it('defaults quality and format when omitted', () => {
    const result = validateImageRequest(
      buildUrl({ url: 'https://images.unsplash.com/photo.jpg', w: '400' }),
      ALLOW_LIST
    )

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.request.quality).toBe(DEFAULT_QUALITY)
    expect(result.request.format).toBe('auto')
  })

  it('rejects a missing url', () => {
    const result = validateImageRequest(buildUrl({ w: '400' }), ALLOW_LIST)
    expect(result).toEqual({ ok: false, failure: { kind: 'missing_url' } })
  })

  it('rejects a malformed url', () => {
    const result = validateImageRequest(
      buildUrl({ url: 'not-a-url', w: '400' }),
      ALLOW_LIST
    )
    expect(result).toEqual({ ok: false, failure: { kind: 'invalid_url' } })
  })

  it('rejects a non-https url', () => {
    const result = validateImageRequest(
      buildUrl({ url: 'http://images.unsplash.com/photo.jpg', w: '400' }),
      ALLOW_LIST
    )
    expect(result).toEqual({ ok: false, failure: { kind: 'invalid_url' } })
  })

  it('rejects a disallowed hostname', () => {
    const result = validateImageRequest(
      buildUrl({ url: 'https://evil.example.com/photo.jpg', w: '400' }),
      ALLOW_LIST
    )
    expect(result).toEqual({
      ok: false,
      failure: { kind: 'disallowed_hostname', hostname: 'evil.example.com' },
    })
  })

  it('rejects a missing width', () => {
    const result = validateImageRequest(
      buildUrl({ url: 'https://images.unsplash.com/photo.jpg' }),
      ALLOW_LIST
    )
    expect(result).toEqual({ ok: false, failure: { kind: 'missing_width' } })
  })

  it.each([
    ['below the minimum', String(MIN_WIDTH - 1)],
    ['above the maximum', String(MAX_WIDTH + 1)],
    ['zero', '0'],
    ['negative', '-100'],
    ['non-numeric', 'abc'],
    ['a float', '100.5'],
  ])('rejects a width that is %s (%s)', (_label, width) => {
    const result = validateImageRequest(
      buildUrl({ url: 'https://images.unsplash.com/photo.jpg', w: width }),
      ALLOW_LIST
    )
    expect(result).toEqual({ ok: false, failure: { kind: 'invalid_width' } })
  })

  it.each([String(MIN_WIDTH), String(MAX_WIDTH)])(
    'accepts a width at the boundary (%s)',
    (width) => {
      const result = validateImageRequest(
        buildUrl({ url: 'https://images.unsplash.com/photo.jpg', w: width }),
        ALLOW_LIST
      )
      expect(result.ok).toBe(true)
    }
  )

  it.each([
    ['below the minimum', String(MIN_QUALITY - 1)],
    ['above the maximum', String(MAX_QUALITY + 1)],
    ['non-numeric', 'abc'],
  ])('rejects a quality that is %s (%s)', (_label, quality) => {
    const result = validateImageRequest(
      buildUrl({
        url: 'https://images.unsplash.com/photo.jpg',
        w: '400',
        q: quality,
      }),
      ALLOW_LIST
    )
    expect(result).toEqual({ ok: false, failure: { kind: 'invalid_quality' } })
  })

  it('rejects a format outside the allow-list', () => {
    const result = validateImageRequest(
      buildUrl({
        url: 'https://images.unsplash.com/photo.jpg',
        w: '400',
        f: 'svg',
      }),
      ALLOW_LIST
    )
    expect(result).toEqual({ ok: false, failure: { kind: 'invalid_format' } })
  })

  it.each(ALLOWED_FORMATS)('accepts the %s format', (format) => {
    const result = validateImageRequest(
      buildUrl({
        url: 'https://images.unsplash.com/photo.jpg',
        w: '400',
        f: format,
      }),
      ALLOW_LIST
    )
    expect(result.ok).toBe(true)
  })
})

describe('describeValidationFailure', () => {
  it('describes every failure kind distinctly', () => {
    const messages = new Set<string>()
    const failures: Parameters<typeof describeValidationFailure>[0][] = [
      { kind: 'missing_url' },
      { kind: 'invalid_url' },
      { kind: 'disallowed_hostname', hostname: 'evil.example.com' },
      { kind: 'missing_width' },
      { kind: 'invalid_width' },
      { kind: 'invalid_quality' },
      { kind: 'invalid_format' },
    ]

    for (const failure of failures) {
      const message = describeValidationFailure(failure)
      expect(message.length).toBeGreaterThan(0)
      messages.add(message)
    }

    expect(messages.size).toBe(failures.length)
  })

  it('includes the offending hostname in its message', () => {
    expect(
      describeValidationFailure({
        kind: 'disallowed_hostname',
        hostname: 'evil.example.com',
      })
    ).toContain('evil.example.com')
  })
})
