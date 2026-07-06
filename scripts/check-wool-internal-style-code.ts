import { readFileSync } from 'node:fs'
import {
  getWoolWorkOrderSummary,
  listWoolWorkOrders,
} from '../src/data/fcs/wool-task-domain.ts'
import { renderCraftWoolWorkOrdersPage } from '../src/pages/process-factory/wool/work-orders.ts'

const techPacksSource = readFileSync('src/data/fcs/tech-packs.ts', 'utf8')
const contextSource = readFileSync('src/pages/tech-pack/context.ts', 'utf8')
const eventsSource = readFileSync('src/pages/tech-pack/events.ts', 'utf8')
const patternDomainSource = readFileSync('src/pages/tech-pack/pattern-domain.ts', 'utf8')
const snapshotBuilderSource = readFileSync('src/data/fcs/production-tech-pack-snapshot-builder.ts', 'utf8')
const snapshotTypesSource = readFileSync('src/data/fcs/production-tech-pack-snapshot-types.ts', 'utf8')
const woolDomainSource = readFileSync('src/data/fcs/wool-task-domain.ts', 'utf8')
const woolPageSource = readFileSync('src/pages/process-factory/wool/work-orders.ts', 'utf8')
const reviewRecord = readFileSync(
  'docs/prototype-review-records/2026-07-06-wool-internal-style-code.md',
  'utf8',
)

function assertContains(source: string, expected: string, file: string): void {
  if (!source.includes(expected)) {
    throw new Error(`${file} 缺少 ${expected}`)
  }
}

function assertNotContains(source: string, unexpected: string, file: string): void {
  if (source.includes(unexpected)) {
    throw new Error(`${file} 不应包含 ${unexpected}`)
  }
}

function assertTrue(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function sourceBlock(source: string, start: string, end: string, file: string): string {
  const startIndex = source.indexOf(start)
  if (startIndex < 0) {
    throw new Error(`${file} 无法识别 ${start}`)
  }
  const endIndex = source.indexOf(end, startIndex + start.length)
  if (endIndex < 0) {
    throw new Error(`${file} 无法识别 ${end}`)
  }
  return source.slice(startIndex, endIndex)
}

const patternFileTypeBlock = sourceBlock(
  techPacksSource,
  'export interface TechPackPatternFile',
  'export interface TechPackProcess',
  'src/data/fcs/tech-packs.ts',
)
const techPackTypeBlock = sourceBlock(
  techPacksSource,
  'export interface TechPack',
  '// 计算完整度',
  'src/data/fcs/tech-packs.ts',
)
const emptyPatternFormBlock = sourceBlock(
  contextSource,
  'function createEmptyPatternFormState',
  'function createEmptyBomFormState',
  'src/pages/tech-pack/context.ts',
)
const buildPatternItemsBlock = sourceBlock(
  contextSource,
  'function buildPatternItemsFromTechPack',
  'function buildBomItemsFromTechPack',
  'src/pages/tech-pack/context.ts',
)
const patternPoolDemoBlock = sourceBlock(
  contextSource,
  'function createPatternPoolDemoPackage',
  'function createMaterialPatternDemoAssociation',
  'src/pages/tech-pack/context.ts',
)
const materialAssociationBlock = sourceBlock(
  contextSource,
  'function createMaterialPatternDemoAssociation',
  'function ensurePatternPoolDemoPackages',
  'src/pages/tech-pack/context.ts',
)
const inheritPatternPackageBlock = sourceBlock(
  contextSource,
  'function inheritPatternPackageTechnicalFields',
  'function buildPatternItemsFromTechPack',
  'src/pages/tech-pack/context.ts',
)
const syncTechPackBlock = sourceBlock(
  contextSource,
  'function syncTechPackToStore',
  'function buildPatternFormStateFromItem',
  'src/pages/tech-pack/context.ts',
)
const buildPatternFormStateBlock = sourceBlock(
  contextSource,
  'function buildPatternFormStateFromItem',
  'function resetPatternForm',
  'src/pages/tech-pack/context.ts',
)
const buildPatternItemFromFormBlock = sourceBlock(
  eventsSource,
  'function buildPatternItemFromForm',
  'function resetPieceInstanceCraftDraft',
  'src/pages/tech-pack/events.ts',
)

assertContains(patternFileTypeBlock, 'internalStyleCode?: string', 'TechPackPatternFile')
assertContains(techPackTypeBlock, 'internalStyleCode?: string', 'TechPack')
assertContains(emptyPatternFormBlock, "internalStyleCode: ''", 'createEmptyPatternFormState')
assertContains(buildPatternItemsBlock, "internalStyleCode: item.internalStyleCode || techPack.internalStyleCode || ''", 'buildPatternItemsFromTechPack')
assertContains(patternPoolDemoBlock, "internalStyleCode: '2585'", 'createPatternPoolDemoPackage')
assertContains(materialAssociationBlock, "internalStyleCode: patternPackage.internalStyleCode || ''", 'createMaterialPatternDemoAssociation')
assertContains(inheritPatternPackageBlock, 'internalStyleCode: sourcePackage.internalStyleCode', 'inheritPatternPackageTechnicalFields')
assertContains(
  syncTechPackBlock,
  "internalStyleCode: item.patternMaterialType === 'WOOL' ? item.internalStyleCode.trim() || undefined : undefined",
  'syncTechPackToStore',
)
assertContains(contextSource, 'resolveLatestWoolInternalStyleCode', '保存技术包时必须计算最后一次非空毛织内部货号')
assertNotContains(
  contextSource,
  'resolveLatestWoolInternalStyleCode(state.patternItems) || state.techPack.internalStyleCode',
  '保存技术包时不应 fallback 旧毛织内部货号',
)
assertContains(snapshotBuilderSource, 'resolveLatestWoolInternalStyleCode', '快照构建器必须计算内部货号')
assertContains(snapshotBuilderSource, 'internalStyleCode:', '快照构建器必须输出内部货号')
assertContains(snapshotTypesSource, 'internalStyleCode?: string', '生产单技术包快照类型必须声明内部货号')
assertContains(snapshotBuilderSource, 'hasWoolPatternFiles', '快照构建器 legacy fallback 必须限定存在毛织纸样')
assertContains(snapshotBuilderSource, 'allOriginalPatternFilesMissingInternalStyleCode', '快照构建器 legacy fallback 必须限定旧数据字段缺失')
assertNotContains(
  snapshotBuilderSource,
  'resolveLatestWoolInternalStyleCode(patternFiles) || normalizeText(content.internalStyleCode) || undefined',
  '快照构建器不应无条件 fallback 顶层内部货号',
)

assertContains(patternDomainSource, '内部货号', '毛织纸样包弹窗必须展示内部货号字段')
assertContains(patternDomainSource, 'new-pattern-internal-style-code', '内部货号输入框必须有 data-tech-field')
assertContains(patternDomainSource, '例如：2585', '内部货号输入框必须给出示例占位')
assertContains(eventsSource, "field === 'new-pattern-internal-style-code'", '技术包事件必须读取内部货号字段')
assertContains(eventsSource, 'state.newPattern.internalStyleCode = value.trim()', '内部货号保存前必须 trim')
assertContains(buildPatternItemFromFormBlock, "normalizedPatternMaterialType === 'WOOL'", 'buildPatternItemFromForm')
assertContains(buildPatternItemFromFormBlock, 'state.newPattern.internalStyleCode.trim()', 'buildPatternItemFromForm')
assertContains(buildPatternFormStateBlock, "internalStyleCode: item.internalStyleCode || state.techPack.internalStyleCode || ''", 'buildPatternFormStateFromItem')
assertContains(woolDomainSource, 'internalStyleCode?: string', '毛织加工单类型必须包含内部货号')
assertContains(
  woolDomainSource,
  'getWoolWorkOrderSummary(orders = listWoolWorkOrders())',
  '毛织统计必须支持传入筛选结果',
)
assertContains(woolPageSource, '款式 / 内部货号', '毛织加工单筛选标签必须包含内部货号')
assertContains(woolPageSource, 'order.internalStyleCode', '毛织加工单搜索和展示必须使用内部货号')
assertContains(
  woolPageSource,
  'renderCompactSummaryTags(filteredOrders)',
  '毛织加工单必须按筛选结果渲染紧凑统计',
)

const woolOrders = listWoolWorkOrders()
const internalStyleCodeOrders = woolOrders.filter((order) => order.internalStyleCode === '2585')
const fullSummary = getWoolWorkOrderSummary()
const filteredSummary = getWoolWorkOrderSummary(internalStyleCodeOrders)
const woolPageHtml = renderCraftWoolWorkOrdersPage()

assertTrue(internalStyleCodeOrders.length > 0, '内部货号 2585 必须能筛出毛织加工单')
assertTrue(
  internalStyleCodeOrders.some((order) => order.woolOrderId.startsWith('WOOL-MOCK-')),
  '毛织加工单 mock 必须包含 internalStyleCode 2585',
)
assertTrue(filteredSummary.total === internalStyleCodeOrders.length, '筛选统计 total 必须等于筛选结果数量')
assertTrue(filteredSummary.total < fullSummary.total, '筛选统计 total 必须小于全量统计 total')
assertContains(woolPageHtml, '内部货号：2585', '毛织加工单页面渲染结果必须展示内部货号 2585')
assertContains(reviewRecord, '内部货号', '原型审查记录必须覆盖内部货号')
assertContains(reviewRecord, '不做跨 SPU 唯一性校验', '原型审查记录必须说明例外')

console.log('毛织内部货号专项检查通过')
