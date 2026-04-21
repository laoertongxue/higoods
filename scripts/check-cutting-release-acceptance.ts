#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { assertPlaywrightPreflight, formatPlaywrightCollectabilityFailure } from './check-playwright-preflight.ts'

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
    '中转袋流转',
    '裁片仓',
    "countViewportRows(page, 'cutting-spreading-list-table')",
    "countViewportRows(page, 'marker-plan-list-table')",
    '[data-pda-cutting-unit-step="SPREADING"]',
    "expectVisibleInViewport(page, page.getByRole('button', { name: '保存铺布记录' }))",
    '按唛架新建铺布',
    '异常补录铺布必须填写异常补录原因',
    '进入当前任务',
    'manual-entry',
    'context-only',
    '继续当前铺布',
    '按唛架开始铺布',
    'planUnitId',
    '去补料管理',
    '去打印菲票',
    '去装袋',
    '去裁片仓',
    '补料待配料',
    '已生成补料待配料',
    '去仓库配料领料',
    '合并裁剪批次',
    '关联合并裁剪批次',
    '理论成衣件数（件）',
    '已裁片片数（片）',
    '已入仓裁片片数（片）',
    '理论裁片片数（片）',
    '差异裁片片数（片）',
    '计划捆条产出数量',
    '实际捆条产出',
    '需求成衣件数（件）',
    '本单成衣件数（件）',
    '录入来源',
    '当前后续动作',
    '来源铺布：',
    '来源补料单：',
    '铺布完成结果',
    '实际成衣件数',
    '参考理论值',
    '绑定菲票件数（件）',
    '裁片总片数（片）',
    '移动录入',
    '先装袋后入仓',
    'sourceWritebackId',
    "not.toContainText('sourceWritebackId')",
    "not.toContainText('enteredByAccountId')",
    '交接结果',
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
    '创建裁剪批次',
    '裁剪批次概览',
    '来源裁剪批次',
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
    throw new Error(formatPlaywrightCollectabilityFailure(rel, `${result.stdout || ''}${result.stderr || ''}`))
  }
}

function assertAcceptanceListCoversMainChain(): void {
  const result = spawnSync('npx', ['playwright', 'test', '--list', specRel], {
    cwd: repoRoot,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    throw new Error(formatPlaywrightCollectabilityFailure(specRel, `${result.stdout || ''}${result.stderr || ''}`))
  }

  const output = `${result.stdout || ''}${result.stderr || ''}`
  ;[
    'release acceptance：supervisor IA、铺布列表状态与菜单闭环可见',
    'release acceptance：铺布只能 marker-first 创建，异常补录必须填写原因',
    'release acceptance：supervisor 详情页 next-step action bar、公式和上下游跳转闭环',
    'release acceptance：PDA 从任务到执行单元到铺布录入，写回后 supervisor 可见',
    'release acceptance：补料 / 菲票 / 装袋 / 入仓 / PDA 写回数据链保持一致',
    'release acceptance：补料审批通过后，仓库配料领料可见补料待配料',
  ].forEach((token) => {
    assert(output.includes(token), `${specRel} 缺少主链 acceptance 用例：${token}`)
  })
}

function main(): void {
  assertPlaywrightPreflight()
  assertSpecCoversAcceptance()
  assertCopyCleanupSpec()
  assertSpecIsCollectable(specRel)
  assertSpecIsCollectable(copyCleanupSpecRel)
  assertAcceptanceListCoversMainChain()

  console.log(
    JSON.stringify(
      {
        playwright依赖可解析: '通过',
        releaseAcceptanceSpec存在: '通过',
        releaseAcceptance业务覆盖: '通过',
        releaseAcceptance低分辨率覆盖: '通过',
        copyCleanupSpec存在: '通过',
        copyCleanup文案清场覆盖: '通过',
        releaseAcceptance可被Playwright收集: '通过',
        copyCleanup可被Playwright收集: '通过',
        releaseAcceptance主链用例可枚举: '通过',
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
