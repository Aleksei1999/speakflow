import {
  type CreatePaymentParams,
  type CreateRefundParams,
  type YooKassaPayment,
  type YooKassaRefund,
  type YooKassaAmount,
  YooKassaError,
} from './types'

const YOOKASSA_API_BASE = 'https://api.yookassa.ru/v3'

/**
 * Конвертация копеек в формат YooKassa (рубли, строка с 2 знаками).
 * Пример: 15000 -> "150.00"
 */
function kopecksToAmount(kopecks: number, currency = 'RUB'): YooKassaAmount {
  if (!Number.isInteger(kopecks) || kopecks < 0) {
    throw new Error(`Некорректная сумма в копейках: ${kopecks}`)
  }
  return {
    value: (kopecks / 100).toFixed(2),
    currency,
  }
}

export class YooKassaClient {
  private readonly shopId: string
  private readonly secretKey: string

  constructor() {
    const shopId = process.env.YOOKASSA_SHOP_ID
    const secretKey = process.env.YOOKASSA_SECRET_KEY

    if (!shopId || !secretKey) {
      throw new Error(
        'YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY должны быть заданы в переменных окружения'
      )
    }

    this.shopId = shopId
    this.secretKey = secretKey
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64')
    return `Basic ${credentials}`
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    idempotencyKey?: string
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Authorization': this.getAuthHeader(),
      'Content-Type': 'application/json',
    }

    if (idempotencyKey) {
      headers['Idempotence-Key'] = idempotencyKey
    }

    const url = `${YOOKASSA_API_BASE}${path}`

    let response: Response
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })
    } catch (error) {
      throw new YooKassaError(
        `Ошибка сети при запросе к YooKassa: ${error instanceof Error ? error.message : 'unknown'}`,
        0,
        'network_error'
      )
    }

    if (!response.ok) {
      let errorData: { description?: string; code?: string; parameter?: string } = {}
      try {
        errorData = await response.json()
      } catch {
        // Ответ не содержит валидный JSON
      }

      throw new YooKassaError(
        errorData.description ?? `Ошибка YooKassa API: HTTP ${response.status}`,
        response.status,
        errorData.code ?? 'unknown',
        errorData.parameter
      )
    }

    return response.json() as Promise<T>
  }

  /**
   * Создание платежа.
   * https://yookassa.ru/developers/api#create_payment
   */
  async createPayment(params: CreatePaymentParams): Promise<YooKassaPayment> {
    const amount = kopecksToAmount(params.amountKopecks, params.currency)

    return this.request<YooKassaPayment>(
      'POST',
      '/payments',
      {
        amount,
        confirmation: {
          type: 'redirect',
          return_url: params.returnUrl,
        },
        capture: true,
        description: params.description,
        metadata: params.metadata,
      },
      params.idempotencyKey
    )
  }

  /**
   * Получение информации о платеже.
   * https://yookassa.ru/developers/api#get_payment
   */
  async getPayment(paymentId: string): Promise<YooKassaPayment> {
    if (!paymentId || typeof paymentId !== 'string') {
      throw new YooKassaError('paymentId обязателен', 400, 'invalid_parameter', 'paymentId')
    }

    return this.request<YooKassaPayment>('GET', `/payments/${encodeURIComponent(paymentId)}`)
  }

  /**
   * Создание возврата.
   * https://yookassa.ru/developers/api#create_refund
   */
  async createRefund(params: CreateRefundParams): Promise<YooKassaRefund> {
    const amount = kopecksToAmount(params.amountKopecks, params.currency)

    return this.request<YooKassaRefund>(
      'POST',
      '/refunds',
      {
        payment_id: params.paymentId,
        amount,
        description: params.description,
      },
      params.idempotencyKey
    )
  }
}

/** Синглтон-инстанс клиента (создается лениво на сервере) */
let _client: YooKassaClient | null = null

export function getYooKassaClient(): YooKassaClient {
  if (!_client) {
    _client = new YooKassaClient()
  }
  return _client
}
