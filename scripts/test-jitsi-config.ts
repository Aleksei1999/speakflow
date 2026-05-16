/**
 * Smoke-test для validateJitsiConfig(). Запуск: npx tsx scripts/test-jitsi-config.ts
 * Проверяет 3 кейса: пустой секрет, короткий (<32 байт), валидный (>=32 байт).
 */
process.env.JITSI_DOMAIN = 'meet.example.com'

async function run() {
  // CASE 1: короткий секрет должен бросить
  process.env.JITSI_JWT_SECRET = 'short'
  delete require.cache[require.resolve('../src/lib/jitsi/config')]
  const m1 = require('../src/lib/jitsi/config')
  try {
    m1.validateJitsiConfig()
    console.error('FAIL: short secret прошёл')
    process.exit(1)
  } catch (e) {
    console.log('OK short rejected:', (e as Error).message)
  }

  // CASE 2: валидный 64-char секрет (= 64 байт UTF-8) принимается
  process.env.JITSI_JWT_SECRET = 'a'.repeat(64)
  delete require.cache[require.resolve('../src/lib/jitsi/config')]
  const m2 = require('../src/lib/jitsi/config')
  try {
    m2.validateJitsiConfig()
    console.log('OK 64-byte secret accepted')
  } catch (e) {
    console.error('FAIL: valid secret rejected:', (e as Error).message)
    process.exit(1)
  }

  // CASE 3: пустой секрет — отдельная ошибка
  process.env.JITSI_JWT_SECRET = ''
  delete require.cache[require.resolve('../src/lib/jitsi/config')]
  const m3 = require('../src/lib/jitsi/config')
  try {
    m3.validateJitsiConfig()
    console.error('FAIL: empty secret прошёл')
    process.exit(1)
  } catch (e) {
    console.log('OK empty rejected:', (e as Error).message)
  }

  // CASE 4: граничный — ровно 32 байта (ascii) — должен пройти
  process.env.JITSI_JWT_SECRET = 'a'.repeat(32)
  delete require.cache[require.resolve('../src/lib/jitsi/config')]
  const m4 = require('../src/lib/jitsi/config')
  try {
    m4.validateJitsiConfig()
    console.log('OK exact 32-byte accepted')
  } catch (e) {
    console.error('FAIL: 32-byte rejected:', (e as Error).message)
    process.exit(1)
  }

  // CASE 5: 31 байт — должен зафейлить (off-by-one)
  process.env.JITSI_JWT_SECRET = 'a'.repeat(31)
  delete require.cache[require.resolve('../src/lib/jitsi/config')]
  const m5 = require('../src/lib/jitsi/config')
  try {
    m5.validateJitsiConfig()
    console.error('FAIL: 31-byte прошёл')
    process.exit(1)
  } catch (e) {
    console.log('OK 31-byte rejected:', (e as Error).message)
  }

  console.log('\nALL PASS')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
