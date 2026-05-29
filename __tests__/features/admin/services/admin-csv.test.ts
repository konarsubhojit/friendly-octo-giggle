import { describe, expect, it } from 'vitest'
import {
  batchedCsvRows,
  csvEscape,
  parseCsv,
  streamCsvResponse,
  toCsvLine,
} from '@/features/admin/services/admin-csv'

describe('admin-csv helpers', () => {
  it('escapes csv fields with quotes and commas', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('a"b')).toBe('"a""b"')
  })

  it('prefixes spreadsheet formulas in string fields', () => {
    expect(csvEscape('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)")
    expect(csvEscape('@cmd')).toBe("'@cmd")
  })

  it('serializes csv lines', () => {
    expect(toCsvLine(['id', 'name'])).toBe('id,name\n')
  })

  it('parses csv rows', () => {
    const parsed = parseCsv('name,description\nRose,Fresh blooms')
    expect(parsed.headers).toEqual(['name', 'description'])
    expect(parsed.rows).toEqual([['Rose', 'Fresh blooms']])
  })

  it('parses multiline quoted csv fields', () => {
    const parsed = parseCsv('name,description\nRose,"Fresh\nblooms"')
    expect(parsed.rows).toEqual([['Rose', 'Fresh\nblooms']])
  })

  it('streams csv responses from async batches', async () => {
    const response = streamCsvResponse(
      'products.csv',
      ['id', 'name'],
      batchedCsvRows({
        fetchBatch: async (offset, limit) =>
          [
            ['1', 'Rose'],
            ['2', 'Lily'],
          ]
            .slice(offset, offset + limit)
            .map(([id, name]) => ({ id, name })),
        mapRow: (row) => [row.id, row.name],
        batchSize: 1,
      })
    )

    await expect(response.text()).resolves.toBe('id,name\n1,Rose\n2,Lily\n')
  })
})
