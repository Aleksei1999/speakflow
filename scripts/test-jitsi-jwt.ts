/**
 * Smoke-test для generateJitsiToken: проверяем что nbf+iat+exp в payload и
 * формат HS256 не сломался. Запуск: npx tsx scripts/test-jitsi-jwt.ts
 */
process.env.JITSI_DOMAIN = 'meet.example.com'
process.env.JITSI_JWT_SECRET = 'a'.repeat(64)
process.env.JITSI_JWT_APP_ID = 'speakflow'

import * as jose from 'jose'

async function run() {
  const { generateJitsiToken } = await import('../src/lib/jitsi/jwt')
  const token = await generateJitsiToken('room123', {
    id: 'u1',
    name: 'Test User',
    email: 't@e.x',
    avatarUrl: null,
    isModerator: false,
  })

  const decoded = jose.decodeJwt(token)
  const header = jose.decodeProtectedHeader(token)

  console.log('header:', JSON.stringify(header))
  console.log('payload keys:', Object.keys(decoded).sort().join(','))
  console.log('iat:', decoded.iat, 'nbf:', decoded.nbf, 'exp:', decoded.exp)

  if (header.alg !== 'HS256') {
    console.error('FAIL: alg ≠ HS256')
    process.exit(1)
  }
  if (!decoded.nbf) {
    console.error('FAIL: nbf отсутствует')
    process.exit(1)
  }
  if (!decoded.iat || !decoded.exp) {
    console.error('FAIL: iat/exp отсутствуют')
    process.exit(1)
  }
  if (decoded.nbf !== decoded.iat) {
    // не критично, но обычно совпадают (оба = now)
    console.log('WARN: nbf ≠ iat (diff:', (decoded.nbf as number) - (decoded.iat as number), ')')
  }
  // verify with secret
  const secret = new TextEncoder().encode('a'.repeat(64))
  const { payload } = await jose.jwtVerify(token, secret, {
    issuer: 'speakflow',
    audience: 'jitsi',
  })
  console.log('OK verify pass, sub:', payload.sub, 'room:', payload.room)

  console.log('\nALL PASS')
}

run().catch((e) => {
  console.error('FAIL:', e)
  process.exit(1)
})
