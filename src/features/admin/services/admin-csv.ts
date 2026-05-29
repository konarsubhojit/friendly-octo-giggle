const NEWLINE = '\n'
const FORMULA_PREFIX_RE = /^[=+\-@]/

type CsvRow = readonly unknown[]
type CsvRows = Iterable<CsvRow> | AsyncIterable<CsvRow>

const sanitizeCsvCell = (value: string): string =>
  FORMULA_PREFIX_RE.test(value) ? `'${value}` : value

const toAsyncIterator = (rows: CsvRows): AsyncIterator<CsvRow> => {
  if (Symbol.asyncIterator in rows) {
    return rows[Symbol.asyncIterator]()
  }

  return (async function* () {
    yield* rows
  })()
}

export const csvEscape = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  const raw =
    typeof value === 'string' ? sanitizeCsvCell(value) : JSON.stringify(value)
  const escaped = raw.replaceAll('"', '""')
  return /[",\n\r]/.test(raw) ? `"${escaped}"` : escaped
}

export const toCsvLine = (values: readonly unknown[]): string =>
  `${values.map(csvEscape).join(',')}${NEWLINE}`

export const streamCsvResponse = (
  filename: string,
  headers: readonly string[],
  rows: CsvRows
): Response => {
  const encoder = new TextEncoder()
  const iterator = toAsyncIterator(rows)
  let headerSent = false

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!headerSent) {
        headerSent = true
        controller.enqueue(encoder.encode(toCsvLine(headers)))
        return
      }

      const next = await iterator.next()
      if (next.done) {
        controller.close()
        return
      }

      controller.enqueue(encoder.encode(toCsvLine(next.value)))
    },
    async cancel() {
      await iterator.return?.()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export const batchedCsvRows = async function* <T>({
  fetchBatch,
  mapRow,
  batchSize = 250,
}: {
  fetchBatch: (offset: number, limit: number) => Promise<T[]>
  mapRow: (item: T) => CsvRow
  batchSize?: number
}): AsyncIterable<CsvRow> {
  let offset = 0

  while (true) {
    const batch = await fetchBatch(offset, batchSize)
    if (batch.length === 0) {
      return
    }

    for (const item of batch) {
      yield mapRow(item)
    }

    if (batch.length < batchSize) {
      return
    }

    offset += batch.length
  }
}

export const parseCsv = (
  csvText: string
): { headers: string[]; rows: string[][] } => {
  const allRows: string[][] = []
  let currentRow: string[] = []
  let currentValue = ''
  let inQuotes = false

  const pushValue = () => {
    currentRow.push(currentValue.trim())
    currentValue = ''
  }

  const pushRow = () => {
    if (currentRow.length === 0 && currentValue.trim().length === 0) {
      return
    }

    pushValue()
    allRows.push(currentRow)
    currentRow = []
  }

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index]
    const next = csvText[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentValue += '"'
        index += 1
        continue
      }

      inQuotes = !inQuotes
      continue
    }

    if (char === ',' && !inQuotes) {
      pushValue()
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1
      }

      pushRow()
      continue
    }

    currentValue += char
  }

  pushRow()

  const [headers = [], ...rows] = allRows
  return { headers, rows }
}
