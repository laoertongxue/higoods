#!/usr/bin/env node

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

function main(): void {
  const acceptance = read('tests/cutting-release-acceptance.spec.ts')
  const markerListWorkbench = read('tests/cutting-marker-plan-list-workbench.spec.ts')

  ;[
    "await page.setViewportSize({ width: 1366, height: 768 })",
    "countViewportRows(page, 'cutting-spreading-list-table')",
    "countViewportRows(page, 'marker-plan-list-table')",
    "await page.setViewportSize({ width: 360, height: 800 })",
    '[data-pda-cutting-unit-step="SPREADING"]',
    "expectVisibleInViewport(page, page.getByRole('button', { name: '保存铺布记录' }))",
    "countTripleCardNesting(page, '[data-testid=\"cutting-spreading-list-page\"]')",
  ].forEach((token) => {
    assert(acceptance.includes(token), `tests/cutting-release-acceptance.spec.ts 缺少低分辨率可用性断言：${token}`)
  })

  ;[
    "countViewportRows(page, 'marker-plan-list-table')",
    "countTripleCardNesting(page, '[data-testid=\"cutting-marker-plan-list-page\"]')",
  ].forEach((token) => {
    assert(markerListWorkbench.includes(token), `tests/cutting-marker-plan-list-workbench.spec.ts 缺少唛架列表密度约束：${token}`)
  })

  console.log(
    JSON.stringify(
      {
        releaseAcceptance低分辨率断言: '通过',
        唛架列表低分辨率工作台断言: '通过',
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

