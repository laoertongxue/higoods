#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repoRoot = process.cwd()

function abs(rel: string): string {
  return path.join(repoRoot, rel)
}

function read(rel: string): string {
  return fs.readFileSync(abs(rel), 'utf8')
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const checks = [
  { label: 'Playwright 预检', file: 'scripts/check-playwright-preflight.ts' },
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
  { label: '追溯链（铺布完成结果->菲票->装袋->入仓）', file: 'scripts/check-cutting-traceability-chain.ts' },
  { label: '低分辨率密度', file: 'scripts/check-cutting-low-res-density.ts' },
  { label: '流程矩阵（含补料回仓库待配料）', file: 'scripts/check-cutting-flow-matrix.ts' },
  { label: 'release acceptance', file: 'scripts/check-cutting-release-acceptance.ts' },
  { label: '最终清理（含中文文案 / 正式名词）', file: 'scripts/check-cutting-final-cleanup.ts' },
  { label: '来源 provenance', file: 'scripts/check-cutting-source-provenance.ts' },
  { label: 'writeback 完整性', file: 'scripts/check-cutting-writeback-integrity.ts' },
  { label: 'E2E 环境 readiness', file: 'scripts/check-cutting-e2e-readiness.ts' },
] as const

function assertReadinessRulesAligned(): void {
  const acceptanceSpec = read('tests/cutting-release-acceptance.spec.ts')
  const acceptanceCheck = read('scripts/check-cutting-release-acceptance.ts')
  const e2eCheck = read('scripts/check-cutting-e2e-readiness.ts')
  const playwrightPreflight = read('scripts/check-playwright-preflight.ts')

  ;[
    '补料待配料',
    '去仓库配料领料',
    '铺布完成结果',
    '实际成衣件数',
    '合并裁剪批次',
    '理论成衣件数（件）',
    '已裁片片数（片）',
    '已入仓裁片片数（片）',
    '计划捆条产出数量',
    '实际捆条产出',
    'manual-entry',
    'context-only',
    'countViewportRows(page, \'marker-plan-list-table\')',
    'countViewportRows(page, \'cutting-spreading-list-table\')',
    "expectVisibleInViewport(page, page.getByRole('button', { name: '保存铺布记录' }))",
  ].forEach((token) => {
    assert(acceptanceSpec.includes(token), `tests/cutting-release-acceptance.spec.ts 未覆盖当前正式规则：${token}`)
  })

  ;[
    '补料待配料',
    '铺布完成结果',
    '实际成衣件数',
    '理论成衣件数（件）',
    '计划捆条产出数量',
    'manual-entry',
    'context-only',
  ].forEach((token) => {
    assert(acceptanceCheck.includes(token), `scripts/check-cutting-release-acceptance.ts 未纳入当前正式规则：${token}`)
    assert(e2eCheck.includes(token), `scripts/check-cutting-e2e-readiness.ts 未纳入当前正式规则：${token}`)
  })

  ;['npm install', 'test:cutting:install-browsers', '@playwright/test', 'playwright.config.ts'].forEach((token) => {
    assert(playwrightPreflight.includes(token), `scripts/check-playwright-preflight.ts 未纳入 Playwright 预检规则：${token}`)
  })
}

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

  assertReadinessRulesAligned()

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
        正式规则与总闸脚本对齐: '通过',
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
