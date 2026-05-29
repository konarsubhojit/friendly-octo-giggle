const NEWLINE = '\n'

export const csvEscape = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  const raw = typeof value === 'string' ? value : JSON.stringify(value)
  const escaped = raw.replaceAll('"', '""')
  return /[",\n\r]/.test(raw) ? `"${escaped}"` : escaped
}

export const toCsvLine = (values: readonly unknown[]): string =>
  `${values.map(csvEscape).join(',')}${NEWLINE}`

export const streamCsvResponse = (
  filename: string,
  headers: readonly string[],
  rows: readonly (readonly unknown[])[]
): Response => {
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(toCsvLine(headers)))
      for (const row of rows) {
        controller.enqueue(encoder.encode(toCsvLine(row)))
      }
      controller.close()
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

export const parseCsv = (
  csvText: string
): { headers: string[]; rows: string[][] } => {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) return { headers: [], rows: [] }

  const parseLine = (line: string): string[] => {
    const values: string[] = []
    let current = ''
    let inQuotes = false

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index]

      if (char === '"') {
        const next = line[index + 1]
        if (inQuotes && next === '"') {
          current += '"'
          index += 1
          continue
        }
        inQuotes = !inQuotes
        continue
      }

      if (char === ',' && !inQuotes) {
        values.push(current)
        current = ''
        continue
      }

      current += char
    }

    values.push(current)
    return values.map((value) => value.trim())
  }

  const [headerLine, ...rowLines] = lines
  return {
    headers: parseLine(headerLine),
    rows: rowLines.map((line) => parseLine(line)),
  }
}
