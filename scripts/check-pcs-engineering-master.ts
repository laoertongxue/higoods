#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import process from 'node:process'

const checks = [
  'tests/pcs-work-item-module-removal.spec.ts',
  'tests/pcs-engineering-master-domain.spec.ts',
  'tests/pcs-engineering-dependency-policy.spec.ts',
  'tests/pcs-engineering-master-pages.spec.ts',
  'tests/pcs-engineering-task-workbench.spec.ts',
  'tests/pcs-engineering-pre-production-sample-submit.spec.ts',
  'tests/pcs-engineering-task-status.spec.ts',
  'tests/pcs-engineering-material-review.spec.ts',
  'tests/pcs-engineering-bom-pricing.spec.ts',
  'tests/pcs-engineering-bom-task-linkage.spec.ts',
  'tests/pcs-engineering-purchase-linkage.spec.ts',
  'tests/pcs-engineering-tech-pack-linkage.spec.ts',
  'tests/pcs-engineering-preparation-projection.spec.ts',
  'tests/pcs-tech-pack-bom-review-activation-atomic.spec.ts',
  'tests/pcs-engineering-master-close-gate.spec.ts',
  'tests/pcs-engineering-master-close-public-api-boundary.spec.ts',
  'tests/pcs-technical-data-version-snapshot-compat.spec.ts',
  'tests/pcs-engineering-preparation-color-projection.spec.ts',
  'tests/pcs-engineering-navigation-removal.spec.ts',
  'tests/pcs-independent-sampling.spec.ts',
  'tests/pcs-independent-sampling-pages.spec.ts',
  'tests/pcs-engineering-technical-data-and-change.spec.ts',
] as const

for (const check of checks) {
  console.log(`\n[PCS 生产工程门禁] ${check}`)
  const result = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['test', '--', check],
    { cwd: process.cwd(), stdio: 'inherit' },
  )

  if (result.error) {
    console.error(`[PCS 生产工程门禁] 无法执行 ${check}:`, result.error)
    process.exit(1)
  }
  if (result.status !== 0) {
    console.error(`[PCS 生产工程门禁] ${check} 失败，退出码 ${result.status ?? '未知'}`)
    process.exit(result.status ?? 1)
  }
}

console.log(`\ncheck-pcs-engineering-master PASS (${checks.length}/${checks.length})`)
