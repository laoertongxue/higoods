#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { listProcessDefinitions } from '../src/data/fcs/process-craft-dict.ts'
import {
  normalizeProcessRouteEntries,
  sortProcessRouteEntries,
} from '../src/data/tech-pack-process-route.ts'

type CheckRouteEntry = {
  id: string
  stageCode: string
  processCode: string
  routeStepNo?: number
  routeLaneNo?: number
  linkedBomItemIds?: string[]
}

function ids(entries: Array<{ id: string }>): string[] {
  return entries.map((entry) => entry.id)
}

const pageSource = readFileSync(new URL('../src/pages/production-craft-dict.ts', import.meta.url), 'utf8')
assert.doesNotMatch(pageSource, /基础工序顺序|open-route-order|close-route-order/, '字典页不得保留默认顺序入口、弹窗或事件')
assert.match(pageSource, /每款工序顺序以对应技术包确认路线为准/, '字典页必须说明每款路线的事实来源')
assert(listProcessDefinitions().every((item) => !('sort' in item)), '工序定义不得携带跨款式默认顺序值')

const sameStageEntries: CheckRouteEntry[] = [
  { id: 'print-first', stageCode: 'PREP', processCode: 'PRINT' },
  { id: 'dye-second', stageCode: 'PREP', processCode: 'DYE' },
  { id: 'water-third', stageCode: 'PREP', processCode: 'WATER_SOLUBLE' },
]
assert.deepEqual(ids(sortProcessRouteEntries(sameStageEntries)), ids(sameStageEntries), '无显式步骤时不得按字典顺序重排')
assert.deepEqual(ids(normalizeProcessRouteEntries(sameStageEntries)), ids(sameStageEntries), '路线归一化必须保持该款原始录入顺序')

const explicitRouteEntries: CheckRouteEntry[] = [
  { id: 'sew-step-2', stageCode: 'PROD', processCode: 'SEW', routeStepNo: 2, routeLaneNo: 1 },
  { id: 'cut-step-1', stageCode: 'PROD', processCode: 'CUT_PANEL', routeStepNo: 1, routeLaneNo: 1 },
]
assert.deepEqual(ids(sortProcessRouteEntries(explicitRouteEntries)), ['cut-step-1', 'sew-step-2'], '显式款式路线必须继续优先')

const materialDependencyEntries: CheckRouteEntry[] = [
  { id: 'dye-input-first', stageCode: 'PREP', processCode: 'DYE', linkedBomItemIds: ['bom-shared'] },
  { id: 'water-input-second', stageCode: 'PREP', processCode: 'WATER_SOLUBLE', linkedBomItemIds: ['bom-shared'] },
]
assert.deepEqual(
  ids(normalizeProcessRouteEntries(materialDependencyEntries)),
  ['water-input-second', 'dye-input-first'],
  '删除字典默认顺序后仍必须保留同 BOM 水溶先于染色的必要依赖',
)

const dictionarySource = readFileSync(new URL('../src/data/fcs/process-craft-dict.ts', import.meta.url), 'utf8')
const routeSource = readFileSync(new URL('../src/data/tech-pack-process-route.ts', import.meta.url), 'utf8')
const techPackContextSource = readFileSync(new URL('../src/pages/tech-pack/context.ts', import.meta.url), 'utf8')
const processDomainSource = readFileSync(new URL('../src/pages/tech-pack/process-domain.ts', import.meta.url), 'utf8')
const technicalVersionTypesSource = readFileSync(new URL('../src/data/pcs-technical-data-version-types.ts', import.meta.url), 'utf8')

assert.doesNotMatch(dictionarySource, /listDefaultProcessRouteOrders|getDefaultProcessRouteOrder/, '字典数据层不得保留默认顺序 API')
assert.doesNotMatch(routeSource, /process-craft-dict|getDefaultProcessRouteOrder/, '技术包路线不得继续读取字典顺序')
assert.doesNotMatch(techPackContextSource, /DEFAULT_TECHNIQUES|DICT_DEFAULT|技术包默认烫包工序/, '空技术包不得补入硬编码默认路线')
assert.match(techPackContextSource, /syncBomDrivenPrepTechniques\(\[\], bomItems\)/, '空技术包只能按 BOM 真实要求生成准备工序')
assert.match(processDomainSource, /DICT_REFERENCE: '工序字典引用'/, '来源文案必须只表达字典引用')
assert.doesNotMatch(technicalVersionTypesSource, /DICT_DEFAULT/, '技术版本类型不得保留字典默认路线来源')

console.log(JSON.stringify({
  字典默认顺序: '已删除',
  每款显式路线: '保留',
  同物料必要依赖: '保留',
  空技术包硬编码路线: '已删除',
}, null, 2))
