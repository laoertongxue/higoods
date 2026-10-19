import { createServer as createPortReservation } from 'node:net'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { createServer } from 'vite'

// Explicit consumers only: unknown browser tests remain a receipt blocker.
export const ACCESSORY_BROWSER_CONTRACT_PATHS = [
  "tests/browser-contracts/accessory-backup-post-source.test.ts",
  "tests/browser-contracts/accessory-fcs-readonly.test.ts",
  "tests/browser-contracts/accessory-final-boundaries-ui.test.ts",
  "tests/browser-contracts/accessory-full-backup-ui.test.ts",
  "tests/browser-contracts/accessory-mixed-print-ui.test.ts",
  "tests/browser-contracts/accessory-pickup-print-images-ui.test.ts",
  "tests/browser-contracts/accessory-post-finishing.test.ts",
  "tests/browser-contracts/accessory-print-layout-ui.test.ts",
  "tests/browser-contracts/accessory-reopen-images-ui.test.ts",
  "tests/browser-contracts/accessory-retired-module.test.ts",
  "tests/browser-contracts/accessory-transfer-cutover-ui.test.ts",
  "tests/browser-contracts/accessory-transfer-ui.test.ts",
  "tests/browser-contracts/accessory-upstream-transfer.test.ts",
  "tests/browser-contracts/accessory-warehouse-maintenance-ui.test.ts",
  "tests/browser-contracts/accessory-warehouse-migration.test.ts",
  "tests/browser-contracts/accessory-warehouse-records.test.ts",
  "tests/browser-contracts/accessory-warehouse-sewing.test.ts",
  "tests/browser-contracts/accessory-warehouse-stage1-ui.test.ts",
  "tests/browser-contracts/sewing-material-handover-images-ui.test.ts"
] as const
export const ACCESSORY_BROWSER_FIXTURE_PATH = 'tests/browser-contracts/helpers/accessory-sewing-fixture.ts'
export const ACCESSORY_BROWSER_FIXTURE_PATHS = [ACCESSORY_BROWSER_FIXTURE_PATH, 'tests/fixtures/accessory-warehouse/cutover.json', 'tests/fixtures/accessory-warehouse/gtpLegacy.json', 'tests/fixtures/accessory-warehouse/mixed.json', 'tests/fixtures/accessory-warehouse/post.json', 'tests/fixtures/accessory-warehouse/postLegacy.json', 'tests/fixtures/accessory-warehouse/sew.json', 'tests/fixtures/accessory-warehouse/sewingLegacy.json'] as const

async function main(): Promise<void> {
  const reservation = createPortReservation()
  await new Promise<void>((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve) })
  const reserved = reservation.address()
  if (!reserved || typeof reserved === 'string') throw new Error('Cannot reserve isolated test port')
  await new Promise<void>((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()))
  // Vite treats port 0 as its default 5173; pass the actual free port so tests
  // with their own Vite servers do not collide with this shared source server.
  const server = await createServer({ server: { host: '127.0.0.1', port: reserved.port, strictPort: true, hmr: false, watch: { ignored: ['**/*'] } } })
  try {
    await server.listen()
    const address = server.httpServer!.address()
    if (!address || typeof address === 'string') throw new Error('Cannot determine isolated accessory test server')
    const base = `http://127.0.0.1:${address.port}`
    const env = { ...process.env }
    for (const key of ['ACCESSORY_CUTOVER_UI_URL', 'ACCESSORY_POST_TEST_URL', 'ACCESSORY_MAINTENANCE_UI_URL', 'ACCESSORY_STORAGE_TEST_URL', 'ACCESSORY_FCS_TEST_URL', 'ACCESSORY_TRANSFER_TEST_URL', 'ACCESSORY_STAGE1_UI_URL', 'ACCESSORY_UPSTREAM_TEST_URL']) env[key] = base
    console.log(`Accessory contracts: fresh source server ${base}; ${ACCESSORY_BROWSER_CONTRACT_PATHS.length} explicit files; sequential isolated browser contexts`)
    const child = spawn(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', ...ACCESSORY_BROWSER_CONTRACT_PATHS], { stdio: 'inherit', env })
    process.exitCode = await new Promise<number>((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)) })
  } finally { await server.close() }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
