import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockExistsSync = vi.hoisted(() => vi.fn())
const mockReadFileSync = vi.hoisted(() => vi.fn())
const mockWriteFileSync = vi.hoisted(() => vi.fn())
const mockGetStorageAdapterFor = vi.hoisted(() => vi.fn())

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
}))
vi.mock('@/lib/storage', () => ({
  getStorageAdapterFor: mockGetStorageAdapterFor,
  getActiveProvider: () => 'r2',
  IMMUTABLE_CACHE_CONTROL: 'public, max-age=31536000, immutable',
}))

const makeAdapter = (
  provider: 'vercel' | 'r2' | 's3',
  overrides: Partial<{
    getUrl: ReturnType<typeof vi.fn>
    list: ReturnType<typeof vi.fn>
    put: ReturnType<typeof vi.fn>
  }> = {}
) => ({
  provider,
  put: overrides.put ?? vi.fn(),
  delete: vi.fn(),
  getUrl: overrides.getUrl ?? vi.fn(),
  list: overrides.list ?? vi.fn(),
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  vi.unstubAllGlobals()
})

describe('parseArgs', () => {
  it('defaults to dry-run with no limit and the default checkpoint path', async () => {
    const { parseArgs } = await import('../../scripts/migrate-storage-to-r2')
    const options = parseArgs([])
    expect(options.apply).toBe(false)
    expect(options.prefix).toBeUndefined()
    expect(options.limit).toBe(Number.POSITIVE_INFINITY)
    expect(options.checkpointPath).toMatch(
      /\.storage-migration-checkpoint\.json$/
    )
    expect(options.sourceProvider).toBe('vercel')
    expect(options.destinationProvider).toBe('r2')
  })

  it('parses --apply', async () => {
    const { parseArgs } = await import('../../scripts/migrate-storage-to-r2')
    expect(parseArgs(['--apply']).apply).toBe(true)
  })

  it('lets a later --dry-run override an earlier --apply', async () => {
    const { parseArgs } = await import('../../scripts/migrate-storage-to-r2')
    expect(parseArgs(['--apply', '--dry-run']).apply).toBe(false)
  })

  it('parses --prefix=', async () => {
    const { parseArgs } = await import('../../scripts/migrate-storage-to-r2')
    expect(parseArgs(['--prefix=images/2025/']).prefix).toBe('images/2025/')
  })

  it('parses --limit=', async () => {
    const { parseArgs } = await import('../../scripts/migrate-storage-to-r2')
    expect(parseArgs(['--limit=50']).limit).toBe(50)
  })

  it('ignores a non-positive --limit and falls back to unlimited', async () => {
    const { parseArgs } = await import('../../scripts/migrate-storage-to-r2')
    expect(parseArgs(['--limit=0']).limit).toBe(Number.POSITIVE_INFINITY)
    expect(parseArgs(['--limit=-5']).limit).toBe(Number.POSITIVE_INFINITY)
  })

  it('parses --checkpoint= to an absolute path', async () => {
    const { parseArgs } = await import('../../scripts/migrate-storage-to-r2')
    const options = parseArgs(['--checkpoint=my-checkpoint.json'])
    expect(options.checkpointPath.endsWith('my-checkpoint.json')).toBe(true)
    expect(options.checkpointPath.startsWith('/')).toBe(true)
  })

  it('parses --from= and --to= provider options', async () => {
    const { parseArgs } = await import('../../scripts/migrate-storage-to-r2')
    const options = parseArgs(['--from=vercel', '--to=s3'])
    expect(options.sourceProvider).toBe('vercel')
    expect(options.destinationProvider).toBe('s3')
  })
})

describe('loadCheckpoint', () => {
  it('returns an empty checkpoint when the file does not exist', async () => {
    mockExistsSync.mockReturnValue(false)
    const { loadCheckpoint } =
      await import('../../scripts/migrate-storage-to-r2')
    expect(loadCheckpoint('/tmp/does-not-exist.json')).toEqual({
      migrated: [],
    })
  })

  it('loads a well-formed checkpoint file', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ migrated: ['images/a.png', 'images/b.png'] })
    )
    const { loadCheckpoint } =
      await import('../../scripts/migrate-storage-to-r2')
    expect(loadCheckpoint('/tmp/checkpoint.json')).toEqual({
      migrated: ['images/a.png', 'images/b.png'],
    })
  })

  it('treats malformed JSON as an empty checkpoint rather than throwing', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('{not json')
    const { loadCheckpoint } =
      await import('../../scripts/migrate-storage-to-r2')
    expect(loadCheckpoint('/tmp/checkpoint.json')).toEqual({ migrated: [] })
  })

  it('treats a well-formed but wrongly-shaped JSON file as an empty checkpoint', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(JSON.stringify({ notMigrated: true }))
    const { loadCheckpoint } =
      await import('../../scripts/migrate-storage-to-r2')
    expect(loadCheckpoint('/tmp/checkpoint.json')).toEqual({ migrated: [] })
  })
})

describe('saveCheckpoint', () => {
  it('writes the checkpoint as pretty-printed JSON', async () => {
    const { saveCheckpoint } =
      await import('../../scripts/migrate-storage-to-r2')
    saveCheckpoint('/tmp/checkpoint.json', { migrated: ['images/a.png'] })
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/tmp/checkpoint.json',
      JSON.stringify({ migrated: ['images/a.png'] }, null, 2)
    )
  })
})

describe('listAllSourceObjects', () => {
  it('paginates through every page of the Vercel listing', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        objects: [{ pathname: 'images/a.png', size: 1, uploadedAt: null }],
        cursor: 'cursor-1',
        hasMore: true,
      })
      .mockResolvedValueOnce({
        objects: [{ pathname: 'images/b.png', size: 2, uploadedAt: null }],
        cursor: undefined,
        hasMore: false,
      })
    mockGetStorageAdapterFor.mockReturnValue(makeAdapter('vercel', { list }))

    const { listAllSourceObjects } =
      await import('../../scripts/migrate-storage-to-r2')
    const objects = await listAllSourceObjects('vercel', undefined)

    expect(objects.map((o) => o.pathname)).toEqual([
      'images/a.png',
      'images/b.png',
    ])
    expect(list).toHaveBeenCalledTimes(2)
    expect(list.mock.calls[1][0]).toMatchObject({ cursor: 'cursor-1' })
  })
})

describe('migrateOne', () => {
  const object = { pathname: 'images/a.png', size: 3, uploadedAt: null }

  it('reports already_migrated when the destination already has the object', async () => {
    const r2GetUrl = vi
      .fn()
      .mockResolvedValue('https://cdn.example.com/images/a.png')
    mockGetStorageAdapterFor.mockImplementation((provider: string) =>
      provider === 'r2'
        ? makeAdapter('r2', { getUrl: r2GetUrl })
        : makeAdapter('vercel')
    )

    const { migrateOne } = await import('../../scripts/migrate-storage-to-r2')
    const result = await migrateOne(object, {
      apply: true,
      sourceProvider: 'vercel',
      destinationProvider: 'r2',
    })
    expect(result).toEqual({ outcome: 'already_migrated' })
  })

  it('reports would_copy in dry-run mode without fetching or writing', async () => {
    const r2GetUrl = vi.fn().mockResolvedValue(null)
    const r2Put = vi.fn()
    mockGetStorageAdapterFor.mockImplementation((provider: string) =>
      provider === 'r2'
        ? makeAdapter('r2', { getUrl: r2GetUrl, put: r2Put })
        : makeAdapter('vercel')
    )
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { migrateOne } = await import('../../scripts/migrate-storage-to-r2')
    const result = await migrateOne(object, {
      apply: false,
      sourceProvider: 'vercel',
      destinationProvider: 'r2',
    })

    expect(result).toEqual({ outcome: 'would_copy' })
    expect(r2Put).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails when the source object has disappeared', async () => {
    const vercelGetUrl = vi.fn().mockResolvedValue(null)
    mockGetStorageAdapterFor.mockImplementation((provider: string) =>
      provider === 'r2'
        ? makeAdapter('r2', { getUrl: vi.fn().mockResolvedValue(null) })
        : makeAdapter('vercel', { getUrl: vercelGetUrl })
    )

    const { migrateOne } = await import('../../scripts/migrate-storage-to-r2')
    const result = await migrateOne(object, {
      apply: true,
      sourceProvider: 'vercel',
      destinationProvider: 'r2',
    })
    expect(result).toEqual({
      outcome: 'failed',
      reason: 'source object disappeared before it could be copied',
    })
  })

  it('fails when the source fetch responds with a non-2xx status', async () => {
    mockGetStorageAdapterFor.mockImplementation((provider: string) =>
      provider === 'r2'
        ? makeAdapter('r2', { getUrl: vi.fn().mockResolvedValue(null) })
        : makeAdapter('vercel', {
            getUrl: vi
              .fn()
              .mockResolvedValue('https://vercel.example.com/images/a.png'),
          })
    )
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 404 }))
    )

    const { migrateOne } = await import('../../scripts/migrate-storage-to-r2')
    const result = await migrateOne(object, {
      apply: true,
      sourceProvider: 'vercel',
      destinationProvider: 'r2',
    })
    expect(result).toEqual({
      outcome: 'failed',
      reason: 'source fetch failed with HTTP 404',
    })
  })

  it('copies, verifies, and reports success on a matching size', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const r2Put = vi.fn().mockResolvedValue({
      url: 'https://cdn.example.com/images/a.png',
      pathname: 'images/a.png',
      contentType: 'image/png',
      provider: 'r2',
    })
    const r2GetUrl = vi
      .fn()
      .mockResolvedValueOnce(null) // pre-copy existence check
      .mockResolvedValueOnce('https://cdn.example.com/images/a.png') // post-copy verify
    mockGetStorageAdapterFor.mockImplementation((provider: string) =>
      provider === 'r2'
        ? makeAdapter('r2', { getUrl: r2GetUrl, put: r2Put })
        : makeAdapter('vercel', {
            getUrl: vi
              .fn()
              .mockResolvedValue('https://vercel.example.com/images/a.png'),
          })
    )

    const fetchMock = vi.fn().mockImplementation((_url, init) => {
      if (init?.method === 'HEAD') {
        return Promise.resolve(
          new Response(null, {
            status: 200,
            headers: { 'content-length': String(bytes.length) },
          })
        )
      }
      return Promise.resolve(
        new Response(bytes, {
          status: 200,
          headers: { 'content-type': 'image/png' },
        })
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const { migrateOne } = await import('../../scripts/migrate-storage-to-r2')
    const result = await migrateOne(object, {
      apply: true,
      sourceProvider: 'vercel',
      destinationProvider: 'r2',
    })

    expect(result).toEqual({ outcome: 'copied' })
    expect(r2Put).toHaveBeenCalledWith(
      'images/a.png',
      expect.any(Buffer),
      expect.objectContaining({
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000, immutable',
      })
    )
  })

  it('fails when the destination is missing immediately after the copy', async () => {
    const r2Put = vi.fn().mockResolvedValue({
      url: 'https://cdn.example.com/images/a.png',
      pathname: 'images/a.png',
      contentType: 'image/png',
      provider: 'r2',
    })
    const r2GetUrl = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    mockGetStorageAdapterFor.mockImplementation((provider: string) =>
      provider === 'r2'
        ? makeAdapter('r2', { getUrl: r2GetUrl, put: r2Put })
        : makeAdapter('vercel', {
            getUrl: vi
              .fn()
              .mockResolvedValue('https://vercel.example.com/images/a.png'),
          })
    )
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(new Uint8Array([1]), { status: 200 }))
    )

    const { migrateOne } = await import('../../scripts/migrate-storage-to-r2')
    const result = await migrateOne(object, {
      apply: true,
      sourceProvider: 'vercel',
      destinationProvider: 'r2',
    })
    expect(result).toEqual({
      outcome: 'failed',
      reason: 'object missing from destination immediately after copy',
    })
  })

  it('fails on a destination/source size mismatch', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const r2Put = vi.fn().mockResolvedValue({
      url: 'https://cdn.example.com/images/a.png',
      pathname: 'images/a.png',
      contentType: 'image/png',
      provider: 'r2',
    })
    const r2GetUrl = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('https://cdn.example.com/images/a.png')
    mockGetStorageAdapterFor.mockImplementation((provider: string) =>
      provider === 'r2'
        ? makeAdapter('r2', { getUrl: r2GetUrl, put: r2Put })
        : makeAdapter('vercel', {
            getUrl: vi
              .fn()
              .mockResolvedValue('https://vercel.example.com/images/a.png'),
          })
    )

    const fetchMock = vi.fn().mockImplementation((_url, init) => {
      if (init?.method === 'HEAD') {
        return Promise.resolve(
          new Response(null, {
            status: 200,
            headers: { 'content-length': '999' },
          })
        )
      }
      return Promise.resolve(new Response(bytes, { status: 200 }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const { migrateOne } = await import('../../scripts/migrate-storage-to-r2')
    const result = await migrateOne(object, {
      apply: true,
      sourceProvider: 'vercel',
      destinationProvider: 'r2',
    })

    expect(result).toEqual({
      outcome: 'failed',
      reason: 'size mismatch after copy: source 3 bytes, destination 999 bytes',
    })
  })
})

describe('runMigration', () => {
  it('skips objects already recorded in the checkpoint', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ migrated: ['images/a.png'] })
    )
    const list = vi.fn().mockResolvedValue({
      objects: [
        { pathname: 'images/a.png', size: 1, uploadedAt: null },
        { pathname: 'images/b.png', size: 2, uploadedAt: null },
      ],
      cursor: undefined,
      hasMore: false,
    })
    const r2GetUrl = vi.fn().mockResolvedValue(null)
    mockGetStorageAdapterFor.mockImplementation((provider: string) =>
      provider === 'r2'
        ? makeAdapter('r2', { getUrl: r2GetUrl })
        : makeAdapter('vercel', { list })
    )

    const { runMigration } = await import('../../scripts/migrate-storage-to-r2')
    const summary = await runMigration({
      apply: false,
      limit: Number.POSITIVE_INFINITY,
      checkpointPath: '/tmp/checkpoint.json',
      sourceProvider: 'vercel',
      destinationProvider: 'r2',
    })

    expect(summary.alreadyMigrated).toBe(1)
    expect(summary.scanned).toBe(2)
    // Only images/b.png should have been probed against R2.
    expect(r2GetUrl).toHaveBeenCalledTimes(1)
    expect(r2GetUrl).toHaveBeenCalledWith('images/b.png')
  })

  it('respects the limit option and saves the checkpoint after each apply', async () => {
    mockExistsSync.mockReturnValue(false)
    const list = vi.fn().mockResolvedValue({
      objects: [
        { pathname: 'images/a.png', size: 1, uploadedAt: null },
        { pathname: 'images/b.png', size: 2, uploadedAt: null },
      ],
      cursor: undefined,
      hasMore: false,
    })
    const r2Put = vi.fn().mockResolvedValue({
      url: 'https://cdn.example.com/images/a.png',
      pathname: 'images/a.png',
      contentType: 'image/png',
      provider: 'r2',
    })
    const r2GetUrl = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('https://cdn.example.com/images/a.png')
    mockGetStorageAdapterFor.mockImplementation((provider: string) =>
      provider === 'r2'
        ? makeAdapter('r2', { getUrl: r2GetUrl, put: r2Put })
        : makeAdapter('vercel', {
            list,
            getUrl: vi
              .fn()
              .mockResolvedValue('https://vercel.example.com/images/a.png'),
          })
    )
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url, init) =>
        Promise.resolve(
          init?.method === 'HEAD'
            ? new Response(null, {
                status: 200,
                headers: { 'content-length': '1' },
              })
            : new Response(new Uint8Array([9]), { status: 200 })
        )
      )
    )

    const { runMigration } = await import('../../scripts/migrate-storage-to-r2')
    const summary = await runMigration({
      apply: true,
      limit: 1,
      checkpointPath: '/tmp/checkpoint.json',
      sourceProvider: 'vercel',
      destinationProvider: 'r2',
    })

    expect(summary.scanned).toBe(1)
    expect(summary.migrated).toBe(1)
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '/tmp/checkpoint.json',
      JSON.stringify({ migrated: ['images/a.png'] }, null, 2)
    )
  })

  it('collects failures without aborting the run', async () => {
    mockExistsSync.mockReturnValue(false)
    const list = vi.fn().mockResolvedValue({
      objects: [{ pathname: 'images/a.png', size: 1, uploadedAt: null }],
      cursor: undefined,
      hasMore: false,
    })
    mockGetStorageAdapterFor.mockImplementation((provider: string) =>
      provider === 'r2'
        ? makeAdapter('r2', { getUrl: vi.fn().mockResolvedValue(null) })
        : makeAdapter('vercel', {
            list,
            getUrl: vi.fn().mockResolvedValue(null),
          })
    )

    const { runMigration } = await import('../../scripts/migrate-storage-to-r2')
    const summary = await runMigration({
      apply: true,
      limit: Number.POSITIVE_INFINITY,
      checkpointPath: '/tmp/checkpoint.json',
      sourceProvider: 'vercel',
      destinationProvider: 'r2',
    })

    expect(summary.failed).toBe(1)
    expect(summary.failures[0]).toEqual({
      pathname: 'images/a.png',
      reason: 'source object disappeared before it could be copied',
    })
  })

  it('rejects a migration where source and destination are the same provider', async () => {
    mockExistsSync.mockReturnValue(false)
    const { runMigration } = await import('../../scripts/migrate-storage-to-r2')
    await expect(
      runMigration({
        apply: false,
        limit: 1,
        checkpointPath: '/tmp/checkpoint.json',
        sourceProvider: 'r2',
        destinationProvider: 'r2',
      })
    ).rejects.toThrow(/must differ/)
  })
})
