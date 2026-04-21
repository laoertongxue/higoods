import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { getProductionOrderTechPackSnapshot } from '../src/data/fcs/production-order-tech-pack-runtime.ts'
import { buildProductionConfirmationSnapshot } from '../src/data/fcs/production-confirmation.ts'
import { renderProductionConfirmationPrintPage } from '../src/pages/production/confirmation-print.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8')
}

function assertIncludes(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNotIncludes(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

const patternContextSource = read('src/pages/tech-pack/context.ts')
const patternDomainSource = read('src/pages/tech-pack/pattern-domain.ts')
const patternEventsSource = read('src/pages/tech-pack/events.ts')
const techPackSource = read('src/data/fcs/tech-packs.ts')
const processCraftSource = read('src/data/fcs/process-craft-dict.ts')
const snapshotBuilderSource = read('src/data/fcs/production-tech-pack-snapshot-builder.ts')
const snapshotRuntimeSource = read('src/data/fcs/production-order-tech-pack-runtime.ts')
const confirmationSource = read('src/data/fcs/production-confirmation.ts')
const confirmationPageSource = read('src/pages/production/confirmation-print.ts')
const snapshotPageSource = read('src/pages/fcs-production-tech-pack-snapshot.ts')
const mainSource = read('src/main.ts')
const fieldHandlingSection =
  patternEventsSource.split('if (field) {')[1]?.split('const action = actionNode?.dataset.techAction')[0] ?? ''

;['纸样文件类型', '纸样分类', '部位名称', '片数', '适用颜色', '每种颜色的片数', '特殊工艺', '备注'].forEach((token) => {
  assertIncludes(patternDomainSource, token, `纸样弹窗缺少业务字段：${token}`)
})
assertNotIncludes(patternDomainSource, '<span class="text-sm">纸样类型</span>', '主体片/结构片字段不得继续显示为“纸样类型”')

;[
  'PatternPieceColorAllocation',
  'PatternPieceSpecialCraft',
  'colorAllocations',
  'specialCrafts',
  'selectedSizeCodes',
].forEach((token) => {
  assertIncludes(patternContextSource, token, `技术包上下文缺少裁片明细结构：${token}`)
  assertIncludes(techPackSource, token, `技术包数据模型缺少裁片明细结构：${token}`)
})

;[
  'getSizeCodeOptionsFromSizeRules',
  'getBomColorOptionsForPattern',
  'getSpecialCraftOptionsForPatternPiece',
].forEach((token) => {
  assertIncludes(patternContextSource, token, `纸样来源 helper 缺少：${token}`)
})

assertIncludes(patternDomainSource, 'toggle-pattern-size-code', '尺码范围必须使用标签切换')
assertNotIncludes(patternDomainSource, 'data-tech-field="new-pattern-size-range"', '尺码范围不得继续使用文本框')
assertIncludes(patternDomainSource, '请先维护放码规则', '缺少放码规则空态提示')
assertIncludes(patternEventsSource, 'selectedSizeCodes.length === 0', '保存校验必须要求至少选择 1 个尺码')

assertIncludes(patternDomainSource, 'toggle-pattern-piece-color', '适用颜色必须通过标签交互维护')
assertIncludes(patternDomainSource, 'new-pattern-piece-color-count', '每种颜色片数必须有独立输入')
assertIncludes(patternEventsSource, 'row.colorAllocations.length === 0', '保存校验必须要求至少选择 1 个颜色')
assertIncludes(patternEventsSource, 'allocation.pieceCount) <= 0', '保存校验必须要求每个颜色片数大于 0')

assertIncludes(patternDomainSource, 'toggle-pattern-piece-special-craft', '特殊工艺必须通过标签交互维护')
assertIncludes(patternContextSource, 'function getSpecialCraftOptionsForPatternPiece()', '特殊工艺必须通过 helper 提供')
assertIncludes(patternContextSource, 'listProcessCraftDefinitions()', '特殊工艺 helper 必须读取工序工艺字典')
assertIncludes(patternContextSource, 'item.isActive && item.isSpecialCraft', '特殊工艺 helper 必须只返回启用的特殊工艺')
assertIncludes(processCraftSource, 'SPECIAL_CRAFT', '工序工艺字典必须存在特殊工艺工序')

assertIncludes(patternEventsSource, "if (state.newPattern.patternMaterialType !== 'KNIT') return true", '新增裁片入口必须只对针织纸样开放')
assertIncludes(patternDomainSource, '新增裁片', '针织纸样必须显示新增裁片入口')
assertIncludes(patternDomainSource, '解析结果只读部位名称和片数', '布料纸样必须说明解析行只读')
assertIncludes(patternEventsSource, "sourceType !== 'PARSED_PATTERN'", '布料纸样保存必须校验解析来源')
assertIncludes(patternEventsSource, "sourceType !== 'MANUAL'", '针织纸样保存必须校验人工来源')

assertNotIncludes(patternDomainSource, 'type="submit"', '弹窗按钮不得触发表单提交')
assertNotIncludes(patternDomainSource, '<form', '纸样弹窗不得使用默认 form 提交')
assertIncludes(mainSource, 'renderWithFocusRestore(focusSnapshot)', 'change 事件渲染必须恢复焦点')
assertNotIncludes(fieldHandlingSection, 'appStore.navigate', '纸样字段输入处理不得直接跳转页面')
assertNotIncludes(fieldHandlingSection, 'resetPatternForm()', '纸样字段输入处理不得直接重置表单')

assertIncludes(snapshotBuilderSource, 'colorAllocations', '技术包快照构建必须保留颜色分配')
assertIncludes(snapshotBuilderSource, 'specialCrafts', '技术包快照构建必须保留特殊工艺')
assertIncludes(snapshotBuilderSource, 'selectedSizeCodes', '技术包快照构建必须保留尺码数组')
assertIncludes(snapshotRuntimeSource, 'colorAllocations', '运行时快照克隆必须保留颜色分配')
assertIncludes(snapshotRuntimeSource, 'specialCrafts', '运行时快照克隆必须保留特殊工艺')
assertIncludes(snapshotRuntimeSource, 'selectedSizeCodes', '运行时快照克隆必须保留尺码数组')

;['适用颜色', '每种颜色的片数', '特殊工艺'].forEach((token) => {
  assertIncludes(confirmationPageSource, token, `生产确认单必须展示：${token}`)
  assertIncludes(snapshotPageSource, token, `技术包快照页必须展示：${token}`)
})
assertIncludes(confirmationSource, 'colorAllocations', '确认单快照必须保留颜色分配')
assertIncludes(confirmationSource, 'specialCrafts', '确认单快照必须保留特殊工艺')
assertIncludes(confirmationSource, 'selectedSizeCodes', '确认单快照必须保留尺码数组')

const snapshotOrder = productionOrders.find((item) => getProductionOrderTechPackSnapshot(item.productionOrderId)) ?? productionOrders[0]
assert(snapshotOrder, '必须存在可读取技术包快照的生产单')

const snapshot = getProductionOrderTechPackSnapshot(snapshotOrder.productionOrderId)
assert(snapshot, '必须能读取生产单技术包快照')
assert(snapshot.patternFiles.length > 0, '技术包快照必须包含纸样文件')
assert(snapshot.patternFiles.every((row) => Array.isArray(row.selectedSizeCodes ?? [])), '技术包快照纸样必须保留尺码数组')
assert(snapshot.patternFiles.flatMap((row) => row.pieceRows ?? []).every((piece) => Array.isArray(piece.colorAllocations ?? [])), '技术包快照裁片明细必须保留颜色分配')
assert(snapshot.patternFiles.flatMap((row) => row.pieceRows ?? []).every((piece) => Array.isArray(piece.specialCrafts ?? [])), '技术包快照裁片明细必须保留特殊工艺')

const confirmationOrder =
  productionOrders.find((item) => buildProductionConfirmationSnapshot(item.productionOrderId).patternSnapshot.rows.length > 0)
  ?? productionOrders[0]
assert(confirmationOrder, '必须存在可读取确认单的生产单')

const confirmationSnapshot = buildProductionConfirmationSnapshot(confirmationOrder.productionOrderId)
assert(confirmationSnapshot.patternSnapshot.rows.length > 0, '生产确认单必须保留纸样信息')
assert(
  confirmationSnapshot.patternSnapshot.rows.every((row) => Array.isArray(row.selectedSizeCodes)),
  '生产确认单纸样快照必须保留尺码数组',
)
assert(
  confirmationSnapshot.patternSnapshot.rows.flatMap((row) => row.pieceRows).every((piece) => Array.isArray(piece.colorAllocations)),
  '生产确认单纸样快照必须保留颜色分配',
)
assert(
  confirmationSnapshot.patternSnapshot.rows.flatMap((row) => row.pieceRows).every((piece) => Array.isArray(piece.specialCrafts)),
  '生产确认单纸样快照必须保留特殊工艺',
)

const confirmationHtml = renderProductionConfirmationPrintPage(confirmationOrder.productionOrderId)
;['适用颜色', '每种颜色的片数', '特殊工艺', '纸样分类'].forEach((token) => {
  assertIncludes(confirmationHtml, token, `生产确认单渲染缺少：${token}`)
})
;['patternMaterialType', 'colorAllocations', 'specialCrafts', 'sourceType', 'WOVEN', 'KNIT', 'JSON'].forEach((token) => {
  assertNotIncludes(confirmationHtml, token, `生产确认单不得展示研发字段：${token}`)
})

console.log('check-fcs-tech-pack-pattern-piece-detail.ts PASS')
