import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const forwardScripts = [
  'scripts/check-factory-onboarding-final-flow.ts',
  'scripts/check-factory-onboarding-step11-ppic-assignment.ts',
  'scripts/check-cut-piece-release-available-qty.ts',
  'scripts/check-cut-piece-release-matrix.ts',
  'scripts/check-cut-piece-release-mock-records.ts',
  'scripts/check-cutting-sewing-dispatch.ts',
  'scripts/check-fcs-unified-assignment-foundation.ts',
  'scripts/check-sewing-outsourcing-task-boundary.ts',
  'scripts/check-sewing-outsourcing-ppic-responsibility.ts',
  'scripts/check-sewing-outsourcing-release-gate.ts',
  'scripts/check-sewing-cut-piece-responsibility.ts',
  'scripts/check-sewing-cut-piece-handover-page.ts',
  'scripts/check-cutting-dispatch-ppic-ledger-linkage.ts',
  'scripts/check-sewing-outsourcing-supplement-return.ts',
  'scripts/check-sewing-outsourcing-sample-approval.ts',
  'scripts/check-sewing-outsourcing-sample-pages.ts',
  'scripts/check-post-finishing-full-flow-surface.ts',
  'scripts/check-post-finishing-full-flow.ts',
  'scripts/check-post-finishing-sewing-self-return.ts',
  'scripts/check-sewing-outsourcing-return-fulfillment.ts',
  'scripts/check-sewing-outsourcing-workbench.ts',
  'scripts/check-sewing-outsourcing-list-page-consistency.ts',
  'scripts/check-sewing-outsourcing-information-architecture.ts',
  'scripts/check-sewing-outsourcing-migration-audit.ts',
  'scripts/check-production-contract-template-fidelity.ts',
  'scripts/check-fcs-sewing-preparation-return-preview.ts',
  'scripts/check-sewing-outsourcing-full-flow-data.ts',
] as const

const passName = process.env.VERIFICATION_PASS?.trim()
const direction = process.env.VERIFICATION_DIRECTION?.trim()
const evidenceDir = process.env.PPIC_EVIDENCE_DIR?.trim()

assert(passName, '必须设置VERIFICATION_PASS')
assert(direction === 'forward' || direction === 'reverse', 'VERIFICATION_DIRECTION必须为forward或reverse')
assert(evidenceDir, '必须设置PPIC_EVIDENCE_DIR')

const scripts = direction === 'forward' ? [...forwardScripts] : [...forwardScripts].reverse()
const startedAt = new Date().toISOString()
const results = scripts.map((scriptPath, index) => {
  const started = Date.now()
  const result = spawnSync(process.execPath, ['--import', 'tsx', scriptPath], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      VERIFICATION_PASS: passName,
      PPIC_EVIDENCE_DIR: evidenceDir,
    },
    maxBuffer: 16 * 1024 * 1024,
  })
  const receipt = {
    sequence: index + 1,
    script: scriptPath,
    exitCode: result.status ?? 1,
    durationMs: Date.now() - started,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  }
  const marker = receipt.exitCode === 0 ? 'PASS' : 'FAIL'
  console.log(`[${passName} ${direction}] ${index + 1}/${scripts.length} ${marker} ${scriptPath}`)
  if (receipt.stdout) console.log(receipt.stdout)
  if (receipt.exitCode !== 0 && receipt.stderr) console.error(receipt.stderr)
  return receipt
})

const failed = results.filter((result) => result.exitCode !== 0)
const receipt = {
  schemaVersion: 1,
  scope: '车缝外发协同（PPIC）逐项验证',
  passName,
  direction,
  startedAt,
  finishedAt: new Date().toISOString(),
  result: failed.length === 0 ? 'PASS' : 'FAIL',
  scriptCount: results.length,
  failedCount: failed.length,
  results,
}

mkdirSync(evidenceDir, { recursive: true })
const receiptPath = path.resolve(evidenceDir, 'verification-pass-receipt.json')
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8')
assert.equal(failed.length, 0, `${failed.length}项专项失败；详见${receiptPath}`)
console.log(`车缝外发协同（PPIC）${passName} ${direction}逐项验证通过：${results.length}项；收据 ${receiptPath}`)
