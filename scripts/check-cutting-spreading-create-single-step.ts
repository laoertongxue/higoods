#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pageFile = 'src/pages/process-factory/cutting/marker-spreading.ts'
const projectionFile = 'src/pages/process-factory/cutting/marker-spreading-projection.ts'
const pageSource = readFileSync(pageFile, 'utf8')
const projectionSource = readFileSync(projectionFile, 'utf8')

for (const token of [
  'sizePiecePerLayer',
  'plannedLayerCount',
  'existingSpreadingOrder',
  'canCreate',
  'styleImageUrl',
  'businessSearchTerms',
]) {
  assert(projectionSource.includes(token), `${projectionFile} 缺少新建铺布投影字段：${token}`)
}

for (const token of [
  'data-testid="cutting-spreading-create-business-search"',
  'data-testid="cutting-spreading-create-scheme-group"',
  'data-testid="cutting-spreading-create-size-ratio"',
  'data-testid="cutting-spreading-create-action-bar"',
  'data-testid="cutting-spreading-create-pagination"',
  'data-cutting-marker-action="open-spreading-style-image"',
  'data-cutting-marker-action="confirm-spreading-create"',
]) {
  assert(pageSource.includes(token), `${pageFile} 缺少单步新建能力：${token}`)
}

for (const token of [
  'renderSpreadingCreateStepBar',
  'renderSpreadingCreateConfirmStep',
  'getSelectedCreateSchemeSources',
  'next-spreading-create-step',
  'prev-spreading-create-step',
  "step: 'confirm'",
]) {
  assert(!pageSource.includes(token), `${pageFile} 仍保留两步新建逻辑：${token}`)
}

const buildBlock = pageSource.match(/function buildCreateSessionsFromSelection\(\)[\s\S]*?\n\}/)?.[0] || ''
assert(buildBlock.includes('return [draft]'), '新建铺布必须只返回一个铺布单草稿')
assert(!buildBlock.includes('for (let rowIndex'), '新建铺布不得遍历方案下全部唛架编号')

console.log('cutting spreading create single-step check passed')
