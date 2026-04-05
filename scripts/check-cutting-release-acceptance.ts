#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'

const repoRoot = process.cwd()
const specRel = 'tests/cutting-release-acceptance.spec.ts'
const copyCleanupSpecRel = 'tests/cutting-copy-cleanup.spec.ts'

function abs(rel: string): string {
  return path.join(repoRoot, rel)
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function read(rel: string): string {
  return fs.readFileSync(abs(rel), 'utf8')
}

function assertSpecCoversAcceptance(): void {
  assert(fs.existsSync(abs(specRel)), `${specRel} 缺失，release acceptance 未建立`)
  const source = read(specRel)

  ;[
    '裁后处理',
    '铺布列表',
    '补料管理',
    '打印菲票',
    '周转口袋流转',
    '裁片仓',
    "countViewportRows(page, 'cutting-spreading-list-table')",
    "countViewportRows(page, 'marker-plan-list-table')",
    '[data-pda-cutting-unit-step="SPREADING"]',
    "expectVisibleInViewport(page, page.getByRole('button', { name: '保存铺布记录' }))",
    '按唛架新建铺布',
    '异常补录铺布必须填写异常补录原因',
    '进入执行单元',
    '继续当前铺布',
    '按唛架开始铺布',
    'planUnitId',
    '去补料管理',
    '去打印菲票',
    '去装袋',
    '去裁片仓',
    '补料待配料',
    '来源铺布：',
    '来源补料：',
    'PDA回写',
    '先装袋后入仓',
    'sourceWritebackId',
  ].forEach((token) => {
    assert(source.includes(token), `${specRel} 缺少 release acceptance 关键覆盖点：${token}`)
  })

  ;[
    /release acceptance：supervisor IA、铺布列表状态与菜单闭环可见/,
    /release acceptance：铺布只能 marker-first 创建，异常补录必须填写原因/,
    /release acceptance：PDA 从任务到执行单元到铺布录入，写回后 supervisor 可见/,
    /release acceptance：补料审批通过后，仓库配料领料可见补料待配料/,
  ].forEach((pattern) => {
    assert(pattern.test(source), `${specRel} 缺少关键 acceptance 用例：${pattern}`)
  })
}

function assertCopyCleanupSpec(): void {
  assert(fs.existsSync(abs(copyCleanupSpecRel)), `${copyCleanupSpecRel} 缺失，中文文案专项验收未建立`)
  const source = read(copyCleanupSpecRel)

  ;[
    '补料管理',
    '铺布列表',
    '唛架列表',
    '合并裁剪批次',
    'manual-entry',
    'context',
    'readyForSpreading = true',
    'allocationStatus ≠ balanced',
    'layoutStatus ≠ done',
    'PIECE',
    'ROLL',
    'LAYER',
  ].forEach((token) => {
    assert(source.includes(token), `${copyCleanupSpecRel} 缺少中文文案 / 工程词清场覆盖点：${token}`)
  })
}

function assertSpecIsCollectable(rel: string): void {
  const result = spawnSync('npx', ['playwright', 'test', '--list', rel], {
    cwd: repoRoot,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    throw new Error(`${rel} 无法被 Playwright 收集\n${result.stdout || ''}${result.stderr || ''}`.trim())
  }
}

function main(): void {
  assertSpecCoversAcceptance()
  assertCopyCleanupSpec()
  assertSpecIsCollectable(specRel)
  assertSpecIsCollectable(copyCleanupSpecRel)

  console.log(
    JSON.stringify(
      {
        releaseAcceptanceSpec存在: '通过',
        releaseAcceptance业务覆盖: '通过',
        releaseAcceptance低分辨率覆盖: '通过',
        copyCleanupSpec存在: '通过',
        copyCleanup文案清场覆盖: '通过',
        releaseAcceptance可被Playwright收集: '通过',
        copyCleanup可被Playwright收集: '通过',
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
