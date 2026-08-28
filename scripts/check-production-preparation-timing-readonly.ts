#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import process from 'node:process'

for (const test of [
  'tests/pcs-engineering-preparation-projection.spec.ts',
  'tests/pcs-engineering-preparation-color-projection.spec.ts',
]) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', test], {
    cwd: process.cwd(),
    stdio: 'inherit',
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const projection = readFileSync('src/data/pcs-engineering-preparation-projection.ts', 'utf8')
const page = readFileSync('src/pages/production/preparation-timing.ts', 'utf8')

assert.match(projection, /工程主单是唯一执行事实源/)
assert.doesNotMatch(projection, /legacyRecords|旧准备记录/)
assert.match(page, /只读 · 数据来源：工程主单/)
assert.match(page, /projectEngineeringMastersToPreparation\(masters, formalTechPacks\)/)
assert.match(page, /新生产准备时效只读展示工程主单事实，不接受任何本页写入/)
assert.match(page, /生产准备时效不再承载确认、上传、维护物料等写动作/)

for (const feature of ['月度统计', '明细统计', '导出月度统计', '导出完成明细', '列设置', 'paginationHtml']) {
  assert.ok(page.includes(feature), `生产准备时效缺少只读统计能力：${feature}`)
}

console.log('check-production-preparation-timing-readonly PASS')
