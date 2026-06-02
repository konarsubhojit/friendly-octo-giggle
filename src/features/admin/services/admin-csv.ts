const NEWLINE = '\n'
const FORMULA_PREFIX_RE = /^[=+\-@|\t\r]/

type CsvRow = readonly unknown[]
type CsvRows = Iterable<CsvRow> | AsyncIterable<CsvRow>

const sanitizeCsvCell = (value: string): string => {
  if (!FORMULA_PREFIX_RE.test(value)) {
    return value
  }

  return `'${value.replaceAll("'", "''")}`
}

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

type CsvState = {
  rows: string[][]
  currentRow: string[]
  currentValue: string
  inQuotes: boolean
  index: number
}

const pushValueState = (state: CsvState) => {
  state.currentRow.push(state.currentValue)
  state.currentValue = ''
}

const pushRowState = (state: CsvState) => {
  pushValueState(state)
  state.rows.push(state.currentRow)
  state.currentRow = []
}

const handleQuote = (state: CsvState, next: string | undefined) => {
  if (state.inQuotes && next === '"') {
    state.currentValue += '"'
    state.index += 1
    return
  }
  state.inQuotes = !state.inQuotes
}

const handleLineBreak = (
  state: CsvState,
  char: string,
  next: string | undefined
) => {
  if (char === '\r' && next === '\n') {
    state.index += 1
  }
  pushRowState(state)
}

export const parseCsv = (
  csvText: string
): { headers: string[]; rows: string[][] } => {
  const state: CsvState = {
    rows: [],
    currentRow: [],
    currentValue: '',
    inQuotes: false,
    index: 0,
  }

  while (state.index < csvText.length) {
    const char = csvText[state.index]
    const next = csvText[state.index + 1]

    if (char === '"') {
      handleQuote(state, next)
    } else if (char === ',' && !state.inQuotes) {
      pushValueState(state)
    } else if ((char === '\n' || char === '\r') && !state.inQuotes) {
      handleLineBreak(state, char, next)
    } else {
      state.currentValue += char
    }

    state.index += 1
  }

  // Flush a final partial row only when the input did not end with a newline,
  // so files terminated by '\n' (Excel/Google Sheets exports) do not produce a
  // phantom trailing empty row.
  if (state.currentValue.length > 0 || state.currentRow.length > 0) {
    pushRowState(state)
  }

  const [headers = [], ...rows] = state.rows
  return { headers, rows }
}
