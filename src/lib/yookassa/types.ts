/**
 * YooKassa API v3 TypeScript types
 * https://yookassa.ru/developers/api
 */

export interface YooKassaAmount {
  /** Сумма в формате строки, например "150.00" */
  value: string
  /** Код валюты по ISO 4217 */
  currency: string
}

export interface YooKassaConfirmation {
  type: 'redirect' | 'embedded'
  return_url?: string
  confirmation_url?: string
  confirmation_token?: string
}

export interface YooKassaPaymentMethod {
  type: string
  id?: string
  saved?: boolean
  title?: string
}

export interface YooKassaRecipient {
  account_id: string
  gateway_id: string
}

export interface YooKassaPayment {
  id: string
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled'
  amount: YooKassaAmount
  income_amount?: YooKassaAmount
  description?: string
  recipient?: YooKassaRecipient
  payment_method?: YooKassaPaymentMethod
  captured_at?: string
  created_at: string
  expires_at?: string
  confirmation?: YooKassaConfirmation
  test: boolean
  refunded_amount?: YooKassaAmount
  paid: boolean
  refundable: boolean
  metadata?: Record<string, string>
}

export interface YooKassaRefund {
  id: string
  payment_id: string
  status: 'succeeded' | 'canceled'
  amount: YooKassaAmount
  created_at: string
  description?: string
}

export interface CreatePaymentParams {
  /** Сумма в копейках (целое число) */
  amountKopecks: number
  currency?: string
  description: string
  returnUrl: string
  metadata?: Record<string, string>
  /** Ключ идемпотентности (используется lesson_id) */
  idempotencyKey: string
}

export interface CreateRefundParams {
  paymentId: string
  amountKopecks: number
  currency?: string
  description?: string
  idempotencyKey: string
}

export interface YooKassaWebhookNotification {
  type: 'notification'
  event: 'payment.succeeded' | 'payment.canceled' | 'payment.waiting_for_capture' | 'refund.succeeded'
  object: YooKassaPayment | YooKassaRefund
}

export class YooKassaError extends Error {
  public readonly statusCode: number
  public readonly code: string
  public readonly parameter?: string

  constructor(message: string, statusCode: number, code: string, parameter?: string) {
    super(message)
    this.name = 'YooKassaError'
    this.statusCode = statusCode
    this.code = code
    this.parameter = parameter
  }
}
