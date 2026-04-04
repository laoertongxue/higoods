#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import process from 'node:process'

const repoRoot = process.cwd()

const checks = [
  { label: '入口清理', file: 'scripts/check-cutting-entry-cleanup.ts' },
  { label: '主对象身份', file: 'scripts/check-cutting-core-identity.ts' },
  { label: '上游链', file: 'scripts/check-fcs-upstream-cutting-chain.ts' },
  { label: 'runtime 边界', file: 'scripts/check-cutting-runtime-boundary.ts' },
  { label: '主页面切换', file: 'scripts/check-cutting-main-pages-cutover.ts' },
  { label: '执行准备链', file: 'scripts/check-cutting-execution-prep-chain.ts' },
  { label: '唛架铺布编辑动作', file: 'scripts/check-cutting-marker-spreading-actions.ts' },
  { label: 'runtime 摘旧仓务', file: 'scripts/check-cutting-runtime-no-legacy-warehouse.ts' },
  { label: '平台总览摘旧 pickup', file: 'scripts/check-cutting-platform-no-legacy-pickup.ts' },
  { label: '仓务写回链', file: 'scripts/check-cutting-warehouse-writeback-chain.ts' },
  { label: 'P1 收口', file: 'scripts/check-cutting-p1-closure.ts' },
  { label: '裁片 PDA mock 覆盖', file: 'scripts/check-cutting-pda-mock-coverage.ts' },
  { label: 'PDA 投影写回', file: 'scripts/check-cutting-pda-projection-writeback.ts' },
  { label: '追溯链', file: 'scripts/check-cutting-traceability-chain.ts' },
  { label: '低分辨率密度', file: 'scripts/check-cutting-low-res-density.ts' },
  { label: '流程矩阵', file: 'scripts/check-cutting-flow-matrix.ts' },
  { label: 'release acceptance', file: 'scripts/check-cutting-release-acceptance.ts' },
  { label: '最终清理', file: 'scripts/check-cutting-final-cleanup.ts' },
  { label: '来源 provenance', file: 'scripts/check-cutting-source-provenance.ts' },
  { label: 'writeback 完整性', file: 'scripts/check-cutting-writeback-integrity.ts' },
  { label: 'E2E 环境 readiness', file: 'scripts/check-cutting-e2e-readiness.ts' },
] as const

function runCheck(file: string): { ok: boolean; output: string } {
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--experimental-specifier-resolution=node', file],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  )

  return {
    ok: result.status === 0,
    output: `${result.stdout || ''}${result.stderr || ''}`.trim(),
  }
}

function main(): void {
  const failures: string[] = []

  console.log('裁片 release readiness 检查开始')
  console.log('='.repeat(40))

  checks.forEach(({ label, file }) => {
    const result = runCheck(file)
    if (result.ok) {
      console.log(`PASS  ${label}  (${file})`)
      return
    }

    console.log(`FAIL  ${label}  (${file})`)
    if (result.output) console.log(result.output)
    failures.push(`${label} -> ${file}`)
  })

  console.log('='.repeat(40))

  if (failures.length > 0) {
    throw new Error(`裁片 release readiness 未通过：\n${failures.map((item) => `- ${item}`).join('\n')}`)
  }

  console.log(
    JSON.stringify(
      {
        releaseReadiness: '通过',
        检查脚本数量: checks.length,
      },
      null,
      2,
    ),
  )
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
