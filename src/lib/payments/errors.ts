export class PaymentConfigurationError extends Error {
  readonly status: number

  constructor(message: string, status = 503) {
    super(message)
    this.name = 'PaymentConfigurationError'
    this.status = status
  }
}

export class PaymentVerificationError extends Error {
  readonly status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'PaymentVerificationError'
    this.status = status
  }
}
