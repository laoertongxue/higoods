#!/usr/bin/env node
// Quality storage contracts use an isolated local Vite server and fresh browser
// contexts. Never depend on a developer's open service or write real user data.
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { mkdtempSync, openSync, closeSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as pause } from 'node:timers/promises'
const paths = [
  'tests/browser-contracts/pcs-record-db.test.ts',
  'tests/browser-contracts/post-quality-storage.test.ts',
  'tests/browser-contracts/quality-management-storage.test.ts',
  'tests/browser-contracts/production-context-quality-migration.test.ts',
  'tests/browser-contracts/production-context-revision-read.test.ts',
  'tests/browser-contracts/post-finishing-late-repository-read.test.ts',
  'tests/browser-contracts/sample-bounded-action-storage.test.ts',
  'tests/browser-contracts/sample-quality-source-storage.test.ts',
  'tests/browser-contracts/sewing-execution-storage.test.ts',
]
const probe = createServer()
await new Promise((done, fail) => { probe.once('error', fail); probe.listen(0, '127.0.0.1', done) })
const port = probe.address().port
await new Promise(done => probe.close(done))
const output = mkdtempSync(join(tmpdir(), 'higood-quality-native-'))
const log = openSync(join(output, 'vite.log'), 'a')
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', log, log] })
const base = `http://127.0.0.1:${port}`
let exitCode = 1
try {
  const deadline = Date.now() + 60000
  while (true) {
    if (server.exitCode !== null) throw Error(`Isolated Vite exited ${server.exitCode}; ${output}/vite.log`)
    try { const response = await fetch(base); if (response.ok) break } catch {}
    if (Date.now() >= deadline) throw Error(`Isolated Vite did not become ready; ${output}/vite.log`)
    await pause(100)
  }
  console.log(`Quality native contracts: ${paths.length} exact test files; isolated ${base}; logs ${output}`)
  const child = spawn(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', ...paths], {
    stdio: 'inherit', env: { ...process.env, QUALITY_MANAGEMENT_TEST_URL: base, POST_QUALITY_TEST_URL: base,
      QUALITY_SAMPLE_BOUNDED_REPORT_PATH: join(output, 'sample-bounded-action-native-results.json'),
      QUALITY_SAMPLE_GATE_REPORT_PATH: join(output, 'sample-source-gate-native-results.json'),
      QUALITY_SEWING_EXECUTION_REPORT_PATH: join(output, 'sewing-execution-native-results.json'),
      QUALITY_PRODUCTION_MIGRATION_REPORT_PATH: join(output, 'production-context-quality-migration-results.json') },
  })
  exitCode = await new Promise((done, fail) => { child.once('error', fail); child.once('exit', code => done(code ?? 1)) })
} finally {
  server.kill('SIGTERM')
  if (server.exitCode === null) await new Promise(done => server.once('exit', done))
  closeSync(log)
}
process.exitCode = exitCode
