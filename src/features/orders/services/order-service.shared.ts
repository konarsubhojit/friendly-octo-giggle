export interface OrderSessionUser {
  readonly id: string
  readonly name?: string | null
  readonly email?: string | null
}

export class OrderRequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'OrderRequestError'
    this.status = status
  }
}

export const isOrderRequestError = (
  error: unknown
): error is OrderRequestError => error instanceof OrderRequestError
