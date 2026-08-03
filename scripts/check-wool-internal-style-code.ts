import { readFileSync } from 'node:fs'

const techPacksSource = readFileSync('src/data/fcs/tech-packs.ts', 'utf8')
const contextSource = readFileSync('src/pages/tech-pack/context.ts', 'utf8')
const eventsSource = readFileSync('src/pages/tech-pack/events.ts', 'utf8')
const patternDomainSource = readFileSync('src/pages/tech-pack/pattern-domain.ts', 'utf8')
const snapshotBuilderSource = readFileSync('src/data/fcs/production-tech-pack-snapshot-builder.ts', 'utf8')
const snapshotTypesSource = readFileSync('src/data/fcs/production-tech-pack-snapshot-types.ts', 'utf8')
const woolPageSource = readFileSync('src/pages/process-factory/wool/work-orders.ts', 'utf8')
const reviewRecord = readFileSync(
  'docs/prototype-review-records/2026-07-31-wool-work-order-standard-list.md',
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
assertTrue(woolPageSource.startsWith('// @page-pattern: list'), '毛织加工单必须声明标准列表页')
assertContains(woolPageSource, 'renderStandardListPage', '毛织加工单必须使用标准列表页骨架')
assertContains(woolPageSource, 'renderStandardListTable', '毛织加工单必须使用标准列表表格')
assertContains(woolPageSource, 'renderTablePagination', '毛织加工单必须使用标准分页')
assertContains(woolPageSource, '款式 / 内部货号', '毛织加工单筛选标签必须包含内部货号')
assertContains(woolPageSource, '可以开工', '毛织加工单必须展示可以开工 Tab')
assertContains(woolPageSource, '不可以开工', '毛织加工单必须展示不可以开工 Tab')
assertContains(woolPageSource, '已完成', '毛织加工单必须展示已完成 Tab')
assertContains(woolPageSource, 'getWoolWorkOrderTabCounts', 'Tab 数量必须基于筛选后的领域结果')
assertContains(woolPageSource, 'data-wool-work-orders-results', '筛选、Tab 与分页必须局部刷新结果区')
assertContains(woolPageSource, 'setTimeout', '文本搜索必须防抖')
assertContains(woolPageSource, 'data-skip-page-rerender="true"', '轻交互必须跳过页面级重绘')
assertContains(woolPageSource, 'data-wool-overlay-error', '业务弹窗必须在弹窗内展示命令错误')
assertContains(woolPageSource, 'scrollLeft', '结果局部刷新必须保留宽表横向滚动位置')
assertNotContains(woolPageSource, 'hydrateIcons(root)', '毛织加工单局部刷新不得重新扫描整页图标')
assertContains(woolPageSource, '凭证', '三类事实弹窗必须录入和展示凭证')
assertContains(woolPageSource, '差异说明', '确认接收弹窗必须支持逐纱线填写差异说明')
assertContains(woolPageSource, '历史摘要', '三类事实弹窗必须展示当前加工单历史摘要')
assertContains(woolPageSource, '累计有效接收', '确认接收弹窗必须逐纱线展示累计有效接收数量')
assertContains(woolPageSource, '最近接收时间', '确认接收弹窗必须逐纱线展示最近接收时间')
assertContains(woolPageSource, '累计有效加工填报', '加工填报弹窗必须按 SKU 展示累计有效加工数量')
assertContains(woolPageSource, '累计有效交出', '发起交出弹窗必须按 SKU 展示累计有效交出数量')
assertContains(woolPageSource, 'getWoolOutputHandoverAvailableQty', '交出弹窗必须使用领域统一可交出余额')
assertNotContains(woolPageSource, 'renderCompactSummaryTags', '毛织加工单不应保留统计标签')
assertNotContains(woolPageSource, 'renderMetricCard', '毛织加工单不应保留统计卡片')
assertNotContains(woolPageSource, 'advanceWoolOrderToWarehouseInbound', '毛织加工单不应保留旧完工入仓')
assertContains(reviewRecord, '三个含数量 Tab', '原型审查记录必须覆盖筛选联动 Tab')
assertContains(reviewRecord, '内部货号', '原型审查记录必须覆盖内部货号展示口径')

console.log('毛织内部货号专项检查通过')
