// Self-contained unit tests для scrub.ts.
//
// Runner: built-in `node:test`. Запуск из корня репо:
//   node --test --experimental-strip-types src/lib/sentry/__tests__/scrub.test.ts
//
// Node 24+. Зависимостей не добавляем (vitest/jest сюда не подключены).
// Каждый кейс подаёт грязный event/breadcrumb-shape, проверяет что:
//   1. ни одна из «грязных» подстрок не осталась в результате (JSON-сериализация)
//   2. появилась соответствующая [redacted-*] метка

import { describe, it } from "node:test"
import assert from "node:assert/strict"

// Импорт с явным `.ts` — обязателен для Node `--experimental-strip-types` resolver'а.
// TypeScript под `bundler` resolution это тоже умеет; если tsc ругается на
// "TS5097: import path can only end with .ts when allowImportingTsExtensions is enabled" —
// либо запускайте `tsc --noEmit --allowImportingTsExtensions`, либо игнорируйте: тестовый файл
// не попадает в продакшн-бандл (Next.js игнорирует `__tests__` по соглашению).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — см. комментарий выше. Импорт с `.ts` нужен только в Node strip-types runtime.
import {
  scrubSentryEvent,
  scrubSentryBreadcrumb,
  __testing,
} from "../scrub.ts"

const { maskString, isSensitiveField } = __testing

/** Проверить что в JSON-форме результата нет ни одной из dirty-подстрок. */
function assertClean(result: unknown, dirty: string[], hint = "") {
  const json = JSON.stringify(result)
  for (const d of dirty) {
    assert.ok(
      !json.includes(d),
      `${hint}: dirty value "${d}" leaked through scrub. Got: ${json}`
    )
  }
}

// ----------------------------------------------------------------------------
// PII regex coverage
// ----------------------------------------------------------------------------

describe("maskString — regex coverage", () => {
  it("redacts email anywhere in string", () => {
    const out = maskString("contact hello@ammfund.com for help")
    assert.ok(!out.includes("hello@ammfund.com"))
    assert.match(out, /\[redacted-email\]/)
  })

  it("redacts phone numbers (≥10 digits)", () => {
    const out = maskString("звоните +7 (916) 123-45-67 срочно")
    assert.ok(!out.includes("916"))
    assert.match(out, /\[redacted-phone\]/)
  })

  it("redacts JWT (eyJ.eyJ.sig)", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
    const out = maskString(`Authorization: ${jwt}`)
    assert.ok(!out.includes("eyJ"))
    assert.match(out, /\[redacted-jwt\]/)
  })

  it("redacts Bearer tokens", () => {
    const out = maskString("Authorization: Bearer abc123.def456_ghi-789")
    assert.ok(!out.includes("abc123"))
    assert.match(out, /Bearer \[redacted\]/)
  })

  it("redacts Basic auth", () => {
    const out = maskString("Authorization: Basic c2hvcF9pZDpzZWNyZXRfa2V5XzEyMzQ1Njc4")
    assert.ok(!out.includes("c2hvcF9pZDpzZWNyZXRfa2V5"))
    assert.match(out, /Basic \[redacted\]/)
  })

  it("redacts Supabase secret keys (sbp_, sb_)", () => {
    const sbp = "sbp_abcdef0123456789abcdef0123456789abcdef01"
    const sb = "sb_abcdef0123456789abcd-efgh"
    const out = maskString(`key=${sbp} legacy=${sb}`)
    assert.ok(!out.includes("sbp_abcdef"))
    assert.ok(!out.includes("sb_abcdef"))
    assert.match(out, /\[redacted-sb-key\]/)
  })

  it("redacts OpenAI sk-proj-... keys", () => {
    const key = "sk-proj-abc123XYZdef456GHI789jklMNO012pqr_stu-vwx"
    const out = maskString(`OPENAI_API_KEY=${key}`)
    assert.ok(!out.includes("abc123XYZdef"))
    assert.match(out, /\[redacted-openai-key\]/)
  })

  it("redacts legacy OpenAI sk- keys", () => {
    const key = "sk-abcdEFGH1234ijkLMNOPqrstu5678vwxyZABCdefgh"
    const out = maskString(`key: ${key}`)
    assert.ok(!out.includes("abcdEFGH1234"))
    assert.match(out, /\[redacted-openai-key\]/)
  })

  it("redacts Stripe-style sk_live keys", () => {
    const out = maskString("sk_live_abcdef0123456789ABCDEF")
    assert.ok(!out.includes("sk_live_abcdef"))
    assert.match(out, /\[redacted-sk\]/)
  })

  it("redacts Telegram bot token", () => {
    const tok = "1234567890:AAEhBP0av28FcjA5gJiNlk9aD6ZQwwc-_lk"
    const out = maskString(`https://api.telegram.org/bot${tok}/getMe`)
    assert.ok(!out.includes("AAEhBP0av28"))
    assert.match(out, /\[redacted-tg-bot-token\]/)
  })

  it("redacts card PAN", () => {
    const out = maskString("paid with 4111 1111 1111 1111 today")
    assert.ok(!out.includes("4111 1111 1111 1111"))
    assert.match(out, /\[redacted-card\]/)
  })
})

// ----------------------------------------------------------------------------
// Field-name redaction
// ----------------------------------------------------------------------------

describe("isSensitiveField — name-based redaction", () => {
  const cases = [
    "password",
    "Password",
    "PASSWORD",
    "access_token",
    "refresh_token",
    "provider_token",
    "provider_refresh_token",
    "authorization",
    "Cookie",
    "x-supabase-auth",
    "sb-access-token",
    "sb-refresh-token",
    "email",
    "phone",
    "first_name",
    "last_name",
    "full_name",
    "telegram_chat_id",
    "telegram_user_id",
    "tg_user_id",
    "tg_chat_id",
    "telegram_bot_token",
    "bot_token",
    "yookassa_secret_key",
    "idempotence_key",
    "Idempotence-Key",
    "idempotency_key",
    "idempotency-key",
    "payment_method_data",
    "payment_token",
    "confirmation_token",
    "recipient",
    "client_email",
    "card",
    "card_number",
    "cvv",
    "first6",
    "last4",
    "expiry_year",
    "expiry_month",
  ]

  for (const name of cases) {
    it(`marks field "${name}" as sensitive`, () => {
      assert.equal(isSensitiveField(name), true)
    })
  }

  it("leaves benign field names alone", () => {
    assert.equal(isSensitiveField("lesson_id"), false)
    assert.equal(isSensitiveField("status"), false)
    assert.equal(isSensitiveField("currency"), false)
  })
})

// ----------------------------------------------------------------------------
// End-to-end shapes: Sentry event / breadcrumb
// ----------------------------------------------------------------------------

describe("scrubSentryEvent — realistic event shapes", () => {
  it("scrubs YooKassa create-payment request body", () => {
    const event = {
      request: {
        url: "https://api.yookassa.ru/v3/payments",
        headers: {
          Authorization: "Basic c2hvcDpzZWNyZXRfa2V5Xzk5OTk5OTk5OTk5OTk=",
          "Idempotence-Key": "abc-def-123-456",
        },
        data: {
          amount: { value: "1500.00", currency: "RUB" },
          recipient: { account_id: "12345", gateway_id: "g1" },
          payment_method_data: { type: "bank_card", card: { number: "4111111111111111" } },
          confirmation_token: "ct_abc12345",
          metadata: {
            lesson_id: "lesson-uuid",
            student_id: "user-uuid",
            client_email: "hello@ammfund.com",
          },
        },
      },
    }
    const scrubbed = scrubSentryEvent(event) as typeof event
    assertClean(
      scrubbed,
      [
        "c2hvcDpzZWNyZXRfa2V5",
        "abc-def-123-456",
        "12345",
        "4111111111111111",
        "ct_abc12345",
        "hello@ammfund.com",
      ],
      "yookassa-create-payment"
    )
    assert.equal(scrubbed.request.headers.Authorization, "[redacted]")
    assert.equal(scrubbed.request.headers["Idempotence-Key"], "[redacted]")
    assert.equal(scrubbed.request.data.recipient, "[redacted]")
    assert.equal(scrubbed.request.data.payment_method_data, "[redacted]")
    assert.equal(scrubbed.request.data.confirmation_token, "[redacted]")
    assert.equal(scrubbed.request.data.metadata.client_email, "[redacted]")
    // lesson_id остаётся — это не PII
    assert.equal(scrubbed.request.data.metadata.lesson_id, "lesson-uuid")
  })

  it("scrubs YooKassa payment response with card.first6/last4/expiry", () => {
    const event = {
      extra: {
        payment: {
          id: "2c25aa4e-000f-5000-9000-1b68e7c15c95",
          payment_method: {
            type: "bank_card",
            card: {
              first6: "411111",
              last4: "1111",
              expiry_year: "2030",
              expiry_month: "12",
              card_type: "VISA",
            },
          },
        },
      },
    }
    const scrubbed = scrubSentryEvent(event) as typeof event
    assertClean(
      scrubbed,
      ["411111", "1111", "2030", "12"],
      "yookassa-card-info"
    )
    assert.equal(scrubbed.extra.payment.payment_method.card, "[redacted]")
  })

  it("scrubs Supabase auth artefacts (access/refresh/provider tokens, sb cookies)", () => {
    const event = {
      request: {
        cookies: {
          "sb-access-token": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3IifQ.signaturePart_abc",
          "sb-refresh-token": "v1.refresh_token_value_here",
        },
        headers: {
          "x-supabase-auth": "sbp_0123456789abcdef0123456789abcdef0123456789",
        },
      },
      extra: {
        session: {
          access_token: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3IifQ.signaturePart_xyz",
          refresh_token: "v1.different_refresh_token",
          provider_token: "ya29.providerGoogleTokenABCDEF",
          provider_refresh_token: "1//providerGoogleRefresh",
        },
      },
    }
    const scrubbed = scrubSentryEvent(event) as typeof event
    assertClean(
      scrubbed,
      [
        "eyJhbGciOiJIUzI1NiJ9",
        "v1.refresh_token_value_here",
        "v1.different_refresh_token",
        "sbp_0123456789abcdef",
        "ya29.providerGoogleTokenABCDEF",
        "providerGoogleRefresh",
      ],
      "supabase-auth"
    )
    assert.equal(scrubbed.request.cookies["sb-access-token"], "[redacted]")
    assert.equal(scrubbed.request.cookies["sb-refresh-token"], "[redacted]")
    assert.equal(scrubbed.request.headers["x-supabase-auth"], "[redacted]")
    assert.equal(scrubbed.extra.session.access_token, "[redacted]")
    assert.equal(scrubbed.extra.session.refresh_token, "[redacted]")
    assert.equal(scrubbed.extra.session.provider_token, "[redacted]")
    assert.equal(scrubbed.extra.session.provider_refresh_token, "[redacted]")
  })

  it("scrubs Telegram bot token in URL and field-name forms", () => {
    const event = {
      request: {
        url: "https://api.telegram.org/bot1234567890:AAEhBP0av28FcjA5gJiNlk9aD6ZQwwc-_lk/sendMessage",
      },
      extra: {
        tg_user_id: 987654321,
        tg_chat_id: 100200300,
        telegram_bot_token: "1234567890:AAEhBP0av28FcjA5gJiNlk9aD6ZQwwc-_lk",
      },
    }
    const scrubbed = scrubSentryEvent(event) as typeof event
    assertClean(
      scrubbed,
      ["AAEhBP0av28FcjA5gJiNlk9aD6ZQwwc-_lk", "987654321", "100200300"],
      "telegram"
    )
    assert.equal(scrubbed.extra.tg_user_id, "[redacted]")
    assert.equal(scrubbed.extra.tg_chat_id, "[redacted]")
    assert.equal(scrubbed.extra.telegram_bot_token, "[redacted]")
    // URL должен быть замаскирован regex'ом
    assert.match(scrubbed.request.url, /\[redacted-tg-bot-token\]/)
  })

  it("scrubs OpenAI API key from env-style strings", () => {
    const event = {
      message: "OPENAI_API_KEY=sk-proj-abc123XYZdef456GHI789jklMNO012pqr_stu-vwx failed",
      extra: {
        api_key: "sk-proj-very-secret-value-12345_abcdefgh-ijklmn",
      },
    }
    const scrubbed = scrubSentryEvent(event) as typeof event
    assertClean(
      scrubbed,
      ["abc123XYZdef456", "very-secret-value-12345"],
      "openai"
    )
    assert.match(scrubbed.message, /\[redacted-openai-key\]/)
    assert.equal(scrubbed.extra.api_key, "[redacted]")
  })

  it("scrubs PII inside user object", () => {
    const event = {
      user: {
        id: "uuid-stays",
        email: "user@example.com",
        phone: "+7 916 555 12 34",
        first_name: "Иван",
        last_name: "Петров",
      },
    }
    const scrubbed = scrubSentryEvent(event) as typeof event
    assertClean(
      scrubbed,
      ["user@example.com", "916", "555", "Иван", "Петров"],
      "user"
    )
    assert.equal(scrubbed.user.id, "uuid-stays")
    assert.equal(scrubbed.user.email, "[redacted]")
    assert.equal(scrubbed.user.phone, "[redacted]")
    assert.equal(scrubbed.user.first_name, "[redacted]")
    assert.equal(scrubbed.user.last_name, "[redacted]")
  })
})

describe("scrubSentryBreadcrumb — realistic breadcrumb shapes", () => {
  it("scrubs fetch breadcrumb with Bearer + email in URL", () => {
    const breadcrumb = {
      type: "http",
      category: "fetch",
      data: {
        url: "https://api.example.com/users?email=hello@ammfund.com",
        method: "GET",
        request_headers: {
          authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.payload_xyz.sig_abcd1234",
        },
      },
    }
    const scrubbed = scrubSentryBreadcrumb(breadcrumb) as typeof breadcrumb
    assertClean(
      scrubbed,
      ["hello@ammfund.com", "eyJhbGciOiJIUzI1NiJ9"],
      "fetch-breadcrumb"
    )
    assert.equal(scrubbed.data.request_headers.authorization, "[redacted]")
    assert.match(scrubbed.data.url, /\[redacted-email\]/)
  })

  it("scrubs console breadcrumb leaking payment metadata", () => {
    const breadcrumb = {
      category: "console",
      level: "log",
      message:
        "yookassa created: idempotency_key=ik-abc-123, payment_token=pt_999, card 4111111111111111",
    }
    const scrubbed = scrubSentryBreadcrumb(breadcrumb) as typeof breadcrumb
    assertClean(
      scrubbed,
      ["4111111111111111"],
      "console-breadcrumb"
    )
    assert.match(scrubbed.message, /\[redacted-card\]/)
  })
})

// ----------------------------------------------------------------------------
// Idempotency: scrub дважды должен давать тот же результат.
// ----------------------------------------------------------------------------

describe("idempotency", () => {
  it("scrubbing twice produces same output (no [redacted-[redacted-…]] cascades)", () => {
    const event = {
      request: {
        headers: { authorization: "Bearer abc123_def456-ghi789" },
        url: "https://x/?email=foo@bar.com",
      },
      user: { email: "foo@bar.com", phone: "+7 916 555 12 34" },
    }
    const once = scrubSentryEvent(structuredClone(event))
    const twice = scrubSentryEvent(structuredClone(once))
    assert.deepEqual(once, twice)
  })
})
