import { createServer as createPortReservation } from 'node:net'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { createServer } from 'vite'

// Explicit task consumers: unknown browser contracts must retain their own routing.
export const PROTOTYPE_FULL_FUNCTION_BROWSER_PATHS = [
  'tests/browser-contracts/business-responsibility-entrypoints.test.ts',
  'tests/browser-contracts/progress-material-standard-list.test.ts',
  'tests/browser-contracts/prototype-maintenance-entrypoints.test.ts',
  'tests/browser-contracts/prototype-role-cleanup.test.ts',
  'tests/browser-contracts/prototype-real-pda-boundaries.test.ts',
] as const

export const PROTOTYPE_RETIRED_ROLE_DRIVER_PATHS = [
  'tests/factory-onboarding-final-flow.spec.ts', 'tests/factory-onboarding-p1.spec.ts',
  'tests/factory-onboarding-p2.spec.ts', 'tests/factory-onboarding-step1-model-state-form.spec.ts',
  'tests/factory-onboarding-step8-form-account-simplify.spec.ts',
  'tests/water-soluble-pda.spec.ts', 'tests/ppic-shared-consumers.spec.ts',
] as const
async function main(): Promise<void> {
  const reservation = createPortReservation()
  await new Promise<void>((resolve, reject) => {
    reservation.once('error', reject)
    reservation.listen(0, '127.0.0.1', resolve)
  })
  const reserved = reservation.address()
  if (!reserved || typeof reserved === 'string') throw new Error('Cannot reserve isolated prototype test port')
  await new Promise<void>((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()))
  const server = await createServer({
    server: {
      host: '127.0.0.1',
      port: reserved.port,
      strictPort: true,
      hmr: false,
      watch: { ignored: ['**/*'] },
    },
  })
  try {
    await server.listen()
    const address = server.httpServer!.address()
    if (!address || typeof address === 'string') throw new Error('Cannot determine isolated prototype test server')
    const base = `http://127.0.0.1:${address.port}`
    // Preserve each contract's caller-supplied output directory or own default.
    const env = { ...process.env }
    for (const key of [
      'BUSINESS_RESPONSIBILITY_TEST_URL',
      'PROGRESS_MATERIAL_LIST_TEST_URL',
      'MAINTENANCE_ENTRYPOINT_TEST_URL',
      'PROTOTYPE_ROLE_TEST_URL',
      'REAL_PDA_BOUNDARIES_TEST_URL',
    ]) env[key] = base
    console.log(`Prototype full-function contracts: fresh source server ${base}; ${PROTOTYPE_FULL_FUNCTION_BROWSER_PATHS.length} explicit files; sequential isolated browser contexts`)
    const child = spawn(process.execPath, [
      '--import', 'tsx', '--test', '--test-concurrency=1', ...PROTOTYPE_FULL_FUNCTION_BROWSER_PATHS,
    ], { stdio: 'inherit', env })
    const code = await new Promise<number>((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', code => resolve(code ?? 1))
    })
    if (code !== 0) { process.exitCode = code; return }
    // The source-module fixtures are independent of the production preview.
    // Real PDA sessions remain mandatory; no URL or DOM identity overrides.
    const replayEnv = { ...env, PLAYWRIGHT_BASE_URL: base, CUTTING_E2E_PORT: String(address.port), PLAYWRIGHT_REUSE_EXISTING_SERVER: 'true' }
    for (const args of [
      ['tests/ppic-shared-consumers.spec.ts', '--grep', 'PDA车缝执行读取回货待核对状态'],
    ]) {
      const replay = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...args, '--workers=1', '--reporter=line'], { stdio: 'inherit', env: replayEnv })
      const replayCode = await new Promise<number>((resolve, reject) => { replay.once('error', reject); replay.once('exit', code => resolve(code ?? 1)) })
      if (replayCode !== 0) { process.exitCode = replayCode; return }
    }
  } finally { await server.close() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
