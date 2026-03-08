import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuth = vi.hoisted(() => vi.fn());
const mockGetCachedData = vi.hoisted(() => vi.fn());
const mockFindMany = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({ auth: mockAuth }));
vi.mock('@/lib/redis', () => ({ getCachedData: mockGetCachedData }));
vi.mock('@/lib/db', () => ({
  drizzleDb: { query: { users: { findMany: mockFindMany } } },
}));
vi.mock('@/lib/schema', () => ({ users: { createdAt: 'createdAt' } }));
vi.mock('drizzle-orm', () => ({ desc: vi.fn((col: string) => col) }));

import { GET } from '@/app/api/admin/users/route';

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Not authenticated');
  });

  it('returns 403 when user is not admin', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', role: 'USER' },
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Not authorized - Admin access required');
  });

  it('returns user list for admin users', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    const mockUsers = [
      {
        id: 'u1',
        name: 'Alice',
        email: 'alice@example.com',
        role: 'USER',
        emailVerified: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        image: null,
        orders: [{ id: 'o1' }, { id: 'o2' }],
      },
      {
        id: 'u2',
        name: 'Bob',
        email: 'bob@example.com',
        role: 'ADMIN',
        emailVerified: new Date('2024-01-01'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        image: 'https://example.com/bob.jpg',
        orders: [],
      },
    ];

    mockFindMany.mockResolvedValue(mockUsers);
    mockGetCachedData.mockImplementation(async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher());

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.users).toHaveLength(2);
    expect(body.data.users[0].id).toBe('u1');
    expect(body.data.users[0]._count.orders).toBe(2);
    expect(body.data.users[1]._count.orders).toBe(0);
  });

  it('calls handleApiError on exception', async () => {
    mockAuth.mockRejectedValue(new Error('DB connection failed'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe('DB connection failed');
  });
});
