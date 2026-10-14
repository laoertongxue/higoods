import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { isProductionCreateImportOnly } from './workflow-governance/production-create-test-import.ts'

const path = 'tests/pcs-production-engineering-full-flow.spec.ts'
const base = process.env.GOVERNANCE_BASE_SHA || execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { encoding: 'utf8' }).trim()
const before = execFileSync('git', ['show', `${base}:${path}`], { encoding: 'utf8' })
const after = readFileSync(path, 'utf8')
if (isProductionCreateImportOnly(before, after)) {
  // Execute the actual current builder/freeze behavior, then certify only the unchanged driver's import relocation.
  for (const test of ['tests/fcs-demand-to-order-current-tech-pack.spec.ts', 'tests/fcs-production-tech-pack-snapshot-freeze.spec.ts']) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', test], { stdio: 'inherit' })
    assert.equal(result.status, 0, `实际建单/冻结专项未通过：${test}`)
  }
  console.log('PCS工程旧全流程：仅内部建单导入迁移契约通过；未宣称旧全流程业务回放通过。')
} else {
  // Any further test/fixture/assertion change must execute the full driver; no blanket exemption.
  const result = spawnSync(process.execPath, ['--import', 'tsx', path], { stdio: 'inherit' })
  process.exitCode = result.status ?? 1
}
