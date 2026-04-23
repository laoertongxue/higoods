import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { buildSeedProductionOrderTechPackSnapshot } from '../src/data/fcs/production-tech-pack-snapshot-builder.ts'
import { buildProductionConfirmationSnapshot } from '../src/data/fcs/production-confirmation.ts'
import { renderProductionConfirmationPrintPage } from '../src/pages/production/confirmation-print.ts'
import { removedPseudoCraftNames } from './utils/special-craft-banlist.ts'

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

function joinText(parts: string[]): string {
  return parts.join('')
}

const patternDomainSource = read('src/pages/tech-pack/pattern-domain.ts')
const patternEventsSource = read('src/pages/tech-pack/events.ts')
const patternContextSource = read('src/pages/tech-pack/context.ts')
const parserAdapterSource = read('src/data/fcs/fcs-pattern-file-parser.ts')
const pcsParserSource = read('src/utils/pcs-part-template-parser.ts')
const snapshotTypesSource = read('src/data/fcs/production-tech-pack-snapshot-types.ts')
const snapshotBuilderSource = read('src/data/fcs/production-tech-pack-snapshot-builder.ts')
const confirmationSource = read('src/data/fcs/production-confirmation.ts')
const confirmationPageSource = read('src/pages/production/confirmation-print.ts')
const cuttingFeiSource = read('src/data/fcs/cutting/generated-fei-tickets.ts')

;['纸样文件类型', '布料纸样', '针织纸样', '纸样分类'].forEach((token) => {
  assertIncludes(patternDomainSource, token, `纸样表单缺少文案：${token}`)
})
assertNotIncludes(patternDomainSource, '<span class="text-sm">纸样类型</span>', '主体片/结构片选择不得继续使用“纸样类型”字段名')
;['部位名称', '片数', '适用颜色', '每种颜色的片数', '特殊工艺', '是否为模板', '部位模板'].forEach((token) => {
  assertIncludes(patternDomainSource, token, `裁片明细表缺少字段：${token}`)
})
assertNotIncludes(patternDomainSource, '<span class="text-sm">备注</span>', '纸样新增/编辑弹窗不应再显示备注字段')
assertNotIncludes(patternDomainSource, '备注：', '纸样详情不应再展示备注摘要')
assertNotIncludes(patternDomainSource, '<th class="px-3 py-2 text-left">备注</th>', '纸样列表不应再保留备注列')
;['selectedSizeCodes', 'colorAllocations', 'specialCrafts'].forEach((token) => {
  assertIncludes(patternContextSource, token, `纸样上下文缺少新字段：${token}`)
})

;[
  'DXF 文件',
  'RUL 文件',
  '选择 DXF 文件',
  '选择 RUL 文件',
  '解析纸样',
  '清空已上传文件',
].forEach((token) => {
  assertIncludes(patternDomainSource, token, `布料纸样交互缺少：${token}`)
})

;['上传纸样文件', '选择纸样文件', '新增裁片'].forEach((token) => {
  assertIncludes(patternDomainSource, token, `针织纸样交互缺少：${token}`)
})

;[
  'parsePartTemplateFiles',
  'resolveTemplateFilePair',
  'suggestStandardPartName',
].forEach((token) => {
  assertIncludes(parserAdapterSource, token, `FCS 解析适配器必须复用 PCS 解析能力：${token}`)
  assertIncludes(pcsParserSource, token, `PCS 解析源缺少：${token}`)
})

;[
  '请成对上传 1 个 DXF 和 1 个 RUL 文件',
  '布料纸样需先解析纸样',
  '布料纸样解析不到裁片明细，不能保存',
  '布料纸样存在名称缺失，不能保存',
  '布料纸样存在数量缺失，不能保存',
  "sourceType !== 'PARSED_PATTERN'",
  "sourceType: 'PARSED_PATTERN' as const",
].forEach((token) => {
  assertIncludes(patternEventsSource, token, `布料纸样保存约束缺少：${token}`)
})

;[
  '针织纸样需先选择纸样文件',
  '针织纸样至少保留 1 行裁片明细',
  '针织纸样裁片名称和片数必须填写完整',
  "sourceType !== 'MANUAL'",
  "sourceType: 'MANUAL' as const",
].forEach((token) => {
  assertIncludes(patternEventsSource, token, `针织纸样保存约束缺少：${token}`)
})

assertIncludes(patternEventsSource, "if (state.newPattern.patternMaterialType !== 'KNIT') return true", '新增裁片入口必须只允许针织纸样使用')
assertIncludes(patternEventsSource, 'open-pattern-dxf-picker', '布料纸样必须支持 DXF 选择按钮')
assertIncludes(patternEventsSource, 'open-pattern-rul-picker', '布料纸样必须支持 RUL 选择按钮')
assertIncludes(patternEventsSource, 'open-pattern-single-file-picker', '针织纸样必须支持单文件选择按钮')
assertIncludes(patternDomainSource, 'toggle-pattern-size-code', '尺码范围必须改为放码规则标签选择')
assertNotIncludes(patternDomainSource, 'data-tech-field="new-pattern-size-range"', '尺码范围不得保留文本框输入')
assertIncludes(patternEventsSource, 'selectedSizeCodes.length === 0', '保存校验必须要求尺码范围至少选择 1 个')
assertIncludes(patternDomainSource, 'toggle-pattern-piece-color', '裁片适用颜色必须支持标签选择')
assertIncludes(patternDomainSource, 'toggle-pattern-piece-special-craft', '裁片特殊工艺必须支持标签选择')
assertIncludes(patternContextSource, 'getPatternPieceSpecialCraftOptionsFromCurrentTechPack', '裁片特殊工艺来源必须绑定当前技术包工序工艺')
assertIncludes(patternContextSource, 'state.techniques', '裁片特殊工艺来源必须依赖当前技术包工序工艺数据')
assertIncludes(patternEventsSource, 'row.colorAllocations.length === 0', '保存校验必须要求每行至少选择 1 个颜色')
assertIncludes(patternEventsSource, 'allocation.pieceCount) <= 0', '保存校验必须要求每个颜色片数大于 0')

;[
  'patternMaterialType',
  'patternFileMode',
  'dxfFileName',
  'rulFileName',
  'singlePatternFileName',
  'parseStatus',
  'rulSizeList',
  'rulSampleSize',
].forEach((token) => {
  assertIncludes(snapshotTypesSource, token, `技术包快照类型缺少：${token}`)
})

const seedSnapshot = buildSeedProductionOrderTechPackSnapshot({
  productionOrderId: 'PO-CHECK-FCS-PARSER',
  productionOrderNo: 'PO-CHECK-FCS-PARSER',
  demand: {
    spuCode: 'SPU-PARSER-001',
    spuName: '纸样解析检查款',
    skuLines: [
      { skuCode: 'SPU-PARSER-001-RED-M', color: '红色', size: 'M', qty: 10 },
      { skuCode: 'SPU-PARSER-001-BLUE-L', color: '蓝色', size: 'L', qty: 8 },
    ],
    techPackVersionLabel: 'v3.0',
    techPackStatus: 'RELEASED',
  },
  snapshotAt: '2026-04-21 10:00:00',
  snapshotBy: '系统',
})

assert(seedSnapshot.patternFiles.some((item) => item.patternMaterialType === 'WOVEN'), '技术包快照必须支持布料纸样')
assert(seedSnapshot.patternFiles.some((item) => item.patternMaterialType === 'KNIT'), '技术包快照必须支持针织纸样')
assert(seedSnapshot.patternFiles.some((item) => item.patternFileMode === 'PAIRED_DXF_RUL'), '布料纸样必须保存 DXF + RUL 模式')
assert(seedSnapshot.patternFiles.some((item) => item.patternFileMode === 'SINGLE_FILE'), '针织纸样必须保存单文件模式')
assert(seedSnapshot.patternFiles.some((item) => item.parseStatus === 'PARSED'), '布料纸样快照必须保留解析状态')
assert(seedSnapshot.patternFiles.some((item) => item.parseStatus === 'NOT_REQUIRED'), '针织纸样快照必须保留无需解析状态')
assert(seedSnapshot.patternFiles.some((item) => item.pieceRows?.some((row) => row.sourceType === 'PARSED_PATTERN')), '布料纸样裁片明细必须保留解析来源')
assert(seedSnapshot.patternFiles.some((item) => item.pieceRows?.some((row) => row.sourceType === 'MANUAL')), '针织纸样裁片明细必须保留人工来源')
assert(seedSnapshot.patternFiles.every((item) => Array.isArray(item.selectedSizeCodes ?? [])), '技术包快照必须保留尺码数组')
assert(seedSnapshot.patternFiles.flatMap((item) => item.pieceRows ?? []).every((row) => Array.isArray(row.colorAllocations ?? [])), '技术包快照必须保留颜色分配')
assert(seedSnapshot.patternFiles.flatMap((item) => item.pieceRows ?? []).every((row) => Array.isArray(row.specialCrafts ?? [])), '技术包快照必须保留特殊工艺')

const productionOrder =
  productionOrders.find((item) => buildProductionConfirmationSnapshot(item.productionOrderId).patternSnapshot.rows.length > 0)
  || productionOrders[0]
assert(productionOrder, '必须存在生产单用于确认单检查')

const confirmationSnapshot = buildProductionConfirmationSnapshot(productionOrder.productionOrderId)
assertIncludes(confirmationSource, 'patternMaterialType:', '生产确认单快照必须读取纸样文件类型')
assertIncludes(confirmationSource, 'patternMaterialTypeLabel:', '生产确认单快照必须读取纸样类型文案')
assert(confirmationSnapshot.patternSnapshot.rows.length > 0, '生产确认单必须保留纸样快照数据')
assert(confirmationSnapshot.patternSnapshot.rows.every((row) => row.patternMaterialTypeLabel !== 'WOVEN' && row.patternMaterialTypeLabel !== 'KNIT'), '生产确认单不得直接显示英文纸样类型')

const confirmationHtml = renderProductionConfirmationPrintPage(productionOrder.productionOrderId)
;['纸样类型', '纸样文件', '打版软件', '裁片部位'].forEach((token) => {
  assertIncludes(confirmationHtml, token, `生产确认单必须展示：${token}`)
})
;['纸样分类', '适用颜色', '每种颜色的片数', '特殊工艺'].forEach((token) => {
  assertIncludes(confirmationHtml, token, `生产确认单必须展示新字段：${token}`)
})
assertNotIncludes(confirmationHtml, '>WOVEN<', '生产确认单不得直接显示 WOVEN')
assertNotIncludes(confirmationHtml, '>KNIT<', '生产确认单不得直接显示 KNIT')
assertNotIncludes(confirmationHtml, 'patternMaterialType', '生产确认单不得展示研发字段')

;[
  'buildCutPieceParts',
  'pieceRows',
  'pieceCountPerGarment',
].forEach((token) => {
  assertIncludes(snapshotBuilderSource, token, `裁片部位快照生成缺少：${token}`)
})
assertIncludes(cuttingFeiSource, 'getProductionOrderCutPieceParts', '裁床菲票仍必须从技术包裁片部位读取数据')

;[
  '解析模板',
  '部位模板库',
  ...removedPseudoCraftNames,
].forEach((token) => {
  assertNotIncludes(patternDomainSource, token, `FCS 纸样页面不得展示研发文案：${token}`)
})

;[
  joinText(['axi', 'os']),
  joinText(['fet', 'ch(']),
  joinText(['api', 'Client']),
  joinText(['/', 'api', '/']),
  joinText(['i1', '8n']),
  joinText(['use', 'Translation']),
  joinText(['loc', 'ales']),
  joinText(['trans', 'lations']),
  'OCR',
  'AI解析',
  '图片识别',
].forEach((token) => {
  assertNotIncludes(parserAdapterSource, token, `解析迁移不得引入越界能力：${token}`)
  assertNotIncludes(patternEventsSource, token, `技术包事件不得引入越界能力：${token}`)
  assertNotIncludes(patternDomainSource, token, `技术包页面不得引入越界能力：${token}`)
  assertNotIncludes(patternContextSource, token, `技术包上下文不得引入越界能力：${token}`)
})

console.log('check-fcs-tech-pack-pattern-parser.ts PASS')
