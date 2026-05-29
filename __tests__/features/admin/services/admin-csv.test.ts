import { describe, expect, it } from 'vitest'
import { csvEscape, parseCsv, toCsvLine } from '@/features/admin/services/admin-csv'

describe('admin-csv helpers', () => {
  it('escapes csv fields with quotes and commas', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('a"b')).toBe('"a""b"')
  })

  it('serializes csv lines', () => {
    expect(toCsvLine(['id', 'name'])).toBe('id,name\n')
  })

  it('parses csv rows', () => {
    const parsed = parseCsv('name,description\nRose,Fresh blooms')
    expect(parsed.headers).toEqual(['name', 'description'])
    expect(parsed.rows).toEqual([['Rose', 'Fresh blooms']])
  })
})
