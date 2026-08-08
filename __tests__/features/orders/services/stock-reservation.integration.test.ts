/**
 * The reservation guarantee, exercised against a real PostgreSQL server.
 *
 * The whole feature is a concurrency claim, and a test that mocks the losing
 * writer proves nothing: the point is that the *database* decides, through the
 * zero-row result of a conditional `UPDATE`. So this suite runs the real SQL.
 *
 * It is opt-in — set `RESERVATION_TEST_DATABASE_URL` to a scratch database
 * that already has the schema applied (`npm run db:bootstrap` against it) and
 * re-run `npm test`. Without that variable the suite is skipped, so the
 * default unit run stays hermetic; `stock-reservation.test.ts` covers the same
 * module's branching with fakes.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'

const TEST_DATABASE_URL = process.env.RESERVATION_TEST_DATABASE_URL

vi.mock('@/lib/db', async () => {
  const { Pool } = await import('pg')
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const schema = await import('@/lib/schema')
  const pool = new Pool({ connectionString: process.env.RESERVATION_TEST_DATABASE_URL })
  const database = drizzle(pool, { schema })
  return {
    primaryDrizzleDb: database,
    drizzleDb: database,
    readDrizzleDb: database,
    db: {},
  }
})

describe.skipIf(!TEST_DATABASE_URL)(
  'stock reservations against a real database',
  () => {
    let realDb: Awaited<ReturnType<typeof connect>>['database']
    let pool: Awaited<ReturnType<typeof connect>>['pool']
    let schema: typeof import('@/lib/schema')
    let orm: typeof import('drizzle-orm')
    let service: typeof import('@/features/orders/services/stock-reservation')

    const connect = async () => {
      const { Pool } = await import('pg')
      const { drizzle } = await import('drizzle-orm/node-postgres')
      const loadedSchema = await import('@/lib/schema')
      const created = new Pool({ connectionString: TEST_DATABASE_URL })
      return {
        pool: created,
        database: drizzle(created, { schema: loadedSchema }),
      }
    }

    const ids = {
      user: 'resu001',
      product: 'resp001',
      variant: 'resv001',
      secondVariant: 'resv002',
      firstRequest: 'rescr01',
      secondRequest: 'rescr02',
    }

    const readVariant = async (variantId: string) => {
      const [row] = await realDb
        .select()
        .from(schema.productVariants)
        .where(orm.eq(schema.productVariants.id, variantId))
      return row
    }

    beforeAll(async () => {
      schema = await import('@/lib/schema')
      orm = await import('drizzle-orm')
      service = await import('@/features/orders/services/stock-reservation')
      const connection = await connect()
      pool = connection.pool
      realDb = connection.database
    })

    afterAll(async () => {
      await pool?.end()
    })

    beforeEach(async () => {
      const { sql } = orm
      await realDb.execute(
        sql`delete from "StockReservation" where "checkoutRequestId" in (${ids.firstRequest}, ${ids.secondRequest})`
      )
      await realDb.execute(
        sql`delete from "CheckoutRequest" where id in (${ids.firstRequest}, ${ids.secondRequest})`
      )
      await realDb.execute(
        sql`delete from "ProductVariant" where id in (${ids.variant}, ${ids.secondVariant})`
      )
      await realDb.execute(sql`delete from "Product" where id = ${ids.product}`)
      await realDb.execute(sql`delete from "User" where id = ${ids.user}`)

      await realDb
        .insert(schema.users)
        .values({ id: ids.user, email: `${ids.user}@example.test` })
      await realDb.insert(schema.products).values({
        id: ids.product,
        name: 'Reservation fixture',
        description: 'fixture',
        category: 'fixture',
        image: 'fixture.webp',
      })
      await realDb.insert(schema.productVariants).values([
        { id: ids.variant, productId: ids.product, price: 10, stock: 1 },
        { id: ids.secondVariant, productId: ids.product, price: 5, stock: 5 },
      ])
      for (const id of [ids.firstRequest, ids.secondRequest]) {
        await realDb.insert(schema.checkoutRequests).values({
          id,
          userId: ids.user,
          customerName: 'Fixture',
          customerEmail: `${ids.user}@example.test`,
          customerAddress: 'fixture',
          items: [],
        })
      }
    })

    it('grants the last unit exactly once under concurrency', async () => {
      const [first, second] = await Promise.all([
        service.reserveForCheckoutRequest({
          checkoutRequestId: ids.firstRequest,
          items: [{ variantId: ids.variant, quantity: 1 }],
        }),
        service.reserveForCheckoutRequest({
          checkoutRequestId: ids.secondRequest,
          items: [{ variantId: ids.variant, quantity: 1 }],
        }),
      ])

      expect([first.granted, second.granted].filter(Boolean)).toHaveLength(1)
      const variant = await readVariant(ids.variant)
      // On-hand stock is untouched by a reservation.
      expect(variant.stock).toBe(1)
      expect(variant.reservedStock).toBe(1)
    })

    it('reuses the existing hold when the grant is replayed', async () => {
      await service.reserveForCheckoutRequest({
        checkoutRequestId: ids.firstRequest,
        items: [{ variantId: ids.variant, quantity: 1 }],
      })

      const replay = await service.reserveForCheckoutRequest({
        checkoutRequestId: ids.firstRequest,
        items: [{ variantId: ids.variant, quantity: 1 }],
      })

      expect(replay.granted).toBe(true)
      expect((await readVariant(ids.variant)).reservedStock).toBe(1)
    })

    it('rolls a multi-item grant back when one item cannot be held', async () => {
      const result = await service.reserveForCheckoutRequest({
        checkoutRequestId: ids.firstRequest,
        items: [
          { variantId: ids.secondVariant, quantity: 2 },
          { variantId: ids.variant, quantity: 9 },
        ],
      })

      expect(result.granted).toBe(false)
      expect((await readVariant(ids.secondVariant)).reservedStock).toBe(0)
    })

    it('denies a soft-deleted variant rather than stranding the hold', async () => {
      await realDb
        .update(schema.productVariants)
        .set({ deletedAt: new Date() })
        .where(orm.eq(schema.productVariants.id, ids.variant))

      const result = await service.reserveForCheckoutRequest({
        checkoutRequestId: ids.firstRequest,
        items: [{ variantId: ids.variant, quantity: 1 }],
      })

      expect(result.granted).toBe(false)
    })

    it('releases held units once and is a no-op on replay', async () => {
      await service.reserveForCheckoutRequest({
        checkoutRequestId: ids.firstRequest,
        items: [{ variantId: ids.variant, quantity: 1 }],
      })

      expect(
        await service.releaseForCheckoutRequest({
          checkoutRequestId: ids.firstRequest,
          reason: 'test',
        })
      ).toEqual({ reservations: 1, quantity: 1 })
      expect((await readVariant(ids.variant)).reservedStock).toBe(0)

      expect(
        await service.releaseForCheckoutRequest({
          checkoutRequestId: ids.firstRequest,
          reason: 'test',
        })
      ).toEqual({ reservations: 0, quantity: 0 })
      expect((await readVariant(ids.variant)).reservedStock).toBe(0)
    })

    it('expires against the database clock and never twice', async () => {
      const { sql } = orm
      await service.reserveForCheckoutRequest({
        checkoutRequestId: ids.firstRequest,
        items: [{ variantId: ids.variant, quantity: 1 }],
      })

      // A live hold is not due.
      expect(await service.expireDueReservations(500)).toEqual({
        reservations: 0,
        quantity: 0,
      })

      await realDb.execute(
        sql`update "StockReservation" set "expiresAt" = now() - interval '1 minute' where "checkoutRequestId" = ${ids.firstRequest}`
      )

      expect(await service.expireDueReservations(500)).toEqual({
        reservations: 1,
        quantity: 1,
      })
      expect((await readVariant(ids.variant)).reservedStock).toBe(0)
      expect(await service.expireDueReservations(500)).toEqual({
        reservations: 0,
        quantity: 0,
      })
    })

    it('consumes inside the caller transaction exactly once', async () => {
      await service.reserveForCheckoutRequest({
        checkoutRequestId: ids.firstRequest,
        items: [{ variantId: ids.variant, quantity: 1 }],
      })

      const first = await realDb.transaction((tx) =>
        service.consumeForCheckoutRequest(tx as never, ids.firstRequest)
      )
      expect(first).toEqual({ reservations: 1, quantity: 1 })
      expect((await readVariant(ids.variant)).reservedStock).toBe(0)

      const replay = await realDb.transaction((tx) =>
        service.consumeForCheckoutRequest(tx as never, ids.firstRequest)
      )
      expect(replay).toEqual({ reservations: 0, quantity: 0 })
    })

    it('summarises live holds for the admin dashboard', async () => {
      await service.reserveForCheckoutRequest({
        checkoutRequestId: ids.firstRequest,
        items: [{ variantId: ids.variant, quantity: 1 }],
      })

      const summaries = await service.getReservationsForCheckoutRequests([
        ids.firstRequest,
        ids.secondRequest,
      ])

      expect(summaries.get(ids.firstRequest)).toMatchObject({
        heldQuantity: 1,
        status: 'HELD',
      })
      expect(summaries.get(ids.firstRequest)?.expiresAt).toBeInstanceOf(Date)
      expect(summaries.has(ids.secondRequest)).toBe(false)
    })
  }
)
