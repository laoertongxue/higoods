import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { productionOrders } from '../src/data/fcs/production-orders.ts'
import {
  buildSeedProductionOrderTechPackSnapshot,
} from '../src/data/fcs/production-tech-pack-snapshot-builder.ts'
import { getProductionOrderTechPackSnapshot } from '../src/data/fcs/production-order-tech-pack-runtime.ts'
import {
  buildProductionConfirmationSnapshot,
  getProductionConfirmationByOrderId,
  isProductionConfirmationPrintable,
} from '../src/data/fcs/production-confirmation.ts'
import { renderFcsProductionTechPackSnapshotPage } from '../src/pages/fcs-production-tech-pack-snapshot.ts'
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

const snapshotTypesSource = read('src/data/fcs/production-tech-pack-snapshot-types.ts')
const snapshotBuilderSource = read('src/data/fcs/production-tech-pack-snapshot-builder.ts')
const snapshotPageSource = read('src/pages/fcs-production-tech-pack-snapshot.ts')
const confirmationSource = read('src/data/fcs/production-confirmation.ts')
const confirmationPageSource = read('src/pages/production/confirmation-print.ts')
const generatedFeiSource = read('src/data/fcs/cutting/generated-fei-tickets.ts')
const generatedOriginalCutOrdersSource = read('src/data/fcs/cutting/generated-original-cut-orders.ts')
const patternDomainSource = read('src/pages/tech-pack/pattern-domain.ts')

;[
  'patternFiles: TechPackPatternFileSnapshot[]',
  'patternMaterialType: PatternMaterialType',
  'patternFileMode: TechPackPatternFileMode',
  'dxfFileName?: string',
  'rulFileName?: string',
  'singlePatternFileName?: string',
  'patternSoftwareName?: string',
  'rulSizeList: string[]',
  'parseStatus: TechPackPatternParseStatus',
  'cutPieceParts: TechPackCutPiecePartSnapshot[]',
  'imageSnapshot: TechPackImageSnapshot',
].forEach((token) => {
  assertIncludes(snapshotTypesSource, token, `技术包快照类型缺少字段：${token}`)
})
;['selectedSizeCodes', 'colorAllocations', 'specialCrafts'].forEach((token) => {
  assertIncludes(snapshotBuilderSource, token, `技术包快照构建缺少新字段：${token}`)
})

;['KNIT', 'WOVEN', 'UNKNOWN', '针织', '布料', '暂无数据'].forEach((token) => {
  assertIncludes(snapshotTypesSource, token, `纸样类型映射缺少字段：${token}`)
})

;[
  'buildCutPieceParts',
  'buildImageSnapshot',
  'buildSizeMeasurements',
  'patternMaterialFileTypeLabels',
].forEach((token) => {
  assertIncludes(snapshotBuilderSource, token, `技术包快照构建缺少逻辑：${token}`)
})

const seedSnapshot = buildSeedProductionOrderTechPackSnapshot({
  productionOrderId: 'PO-CHECK-TECH-PACK',
  productionOrderNo: 'PO-CHECK-TECH-PACK',
  demand: {
    spuCode: 'SPU-CHECK-001',
    spuName: '技术包检查款',
    skuLines: [
      { skuCode: 'SPU-CHECK-001-RED-S', color: '红色', size: 'S', qty: 10 },
      { skuCode: 'SPU-CHECK-001-RED-M', color: '红色', size: 'M', qty: 12 },
      { skuCode: 'SPU-CHECK-001-BLUE-L', color: '蓝色', size: 'L', qty: 8 },
    ],
    techPackVersionLabel: 'v2.1',
    techPackStatus: 'RELEASED',
  },
  snapshotAt: '2026-04-20 10:00:00',
  snapshotBy: '系统',
})

assert(Array.isArray(seedSnapshot.patternFiles), '技术包快照必须支持 patternFiles 数组')
assert(seedSnapshot.patternFiles.some((item) => item.patternMaterialType === 'KNIT'), '必须支持针织纸样')
assert(seedSnapshot.patternFiles.some((item) => item.patternMaterialType === 'WOVEN'), '必须支持布料纸样')
assert(seedSnapshot.patternFiles.every((item) => 'patternSoftwareName' in item), '纸样必须支持打版软件字段')
assert(seedSnapshot.patternFiles.every((item) => Array.isArray(item.selectedSizeCodes ?? [])), '技术包快照必须支持尺码数组')
assert(seedSnapshot.sizeMeasurements.length > 0, '技术包快照必须支持尺寸表快照')
assert(seedSnapshot.cutPieceParts.length >= 3, '技术包快照必须支持裁片部位库')
assert(seedSnapshot.cutPieceParts.some((item) => item.partNameCn === '前片'), '裁片部位库必须包含前片')
assert(seedSnapshot.cutPieceParts.some((item) => item.partNameCn === '后片'), '裁片部位库必须包含后片')
assert(seedSnapshot.cutPieceParts.some((item) => item.partNameCn === '袖子'), '裁片部位库必须包含袖子')
assert(seedSnapshot.cutPieceParts.every((item) => Number(item.pieceCountPerGarment) > 0), '裁片部位必须包含每件用片数')
assert(seedSnapshot.cutPieceParts.every((item) => Array.isArray(item.applicableColorList)), '裁片部位必须包含适用颜色')
assert(seedSnapshot.cutPieceParts.every((item) => Array.isArray(item.applicableSizeList)), '裁片部位必须包含适用尺码')

const runtimeOrder = productionOrders.find((order) => getProductionOrderTechPackSnapshot(order.productionOrderId)) || null
assert(runtimeOrder, '至少应存在一个已冻结技术包快照的生产单')

const snapshotPageHtml = renderFcsProductionTechPackSnapshotPage(runtimeOrder.productionOrderId)
;['纸样类型', '纸样文件', '纸样版本', '打版软件', '尺码范围', '纸样分类', '裁片部位', '每件用片数', '对应面料', '人工确认', '适用颜色', '每种颜色的片数', '特殊工艺'].forEach((token) => {
  assert(snapshotPageHtml.includes(token), `技术包快照页必须展示：${token}`)
})
assertNotIncludes(snapshotPageHtml, '>KNIT<', '技术包快照页不得直接显示 KNIT')
assertNotIncludes(snapshotPageHtml, '>WOVEN<', '技术包快照页不得直接显示 WOVEN')
assertNotIncludes(snapshotPageHtml, '>UNKNOWN<', '技术包快照页不得直接显示 UNKNOWN')

const printableOrder = productionOrders.find((order) =>
  Boolean(getProductionConfirmationByOrderId(order.productionOrderId))
  || isProductionConfirmationPrintable(order.productionOrderId).printable,
) || null
assert(printableOrder, '至少应存在一个可预览生产确认单的生产单')

const confirmationSnapshot = buildProductionConfirmationSnapshot(printableOrder.productionOrderId)
assert(confirmationSnapshot.patternSnapshot.rows.length > 0, '生产确认单必须展示纸样类型')
assert(Array.isArray(confirmationSnapshot.patternSnapshot.cutPieceParts), '生产确认单必须支持裁片部位')
assert('patternSoftwareName' in confirmationSnapshot.patternSnapshot.rows[0], '生产确认单必须读取打版软件字段')
assert(confirmationSnapshot.patternSnapshot.rows.every((row) => Array.isArray(row.selectedSizeCodes)), '生产确认单必须读取尺码数组')
assert(
  confirmationSnapshot.patternSnapshot.rows.flatMap((row) => row.pieceRows).every((piece) => Array.isArray(piece.colorAllocations)),
  '生产确认单必须读取裁片颜色分配',
)
assert(
  confirmationSnapshot.patternSnapshot.rows.flatMap((row) => row.pieceRows).every((piece) => Array.isArray(piece.specialCrafts)),
  '生产确认单必须读取裁片特殊工艺',
)

const confirmationHtml = renderProductionConfirmationPrintPage(printableOrder.productionOrderId)
;['纸样类型', '纸样分类', '打版软件', '适用颜色', '每种颜色的片数', '特殊工艺', '裁片部位', '商品图片', '款式图片', '样衣图片', '面料图片', '辅料图片', '纸样图片', '唛架图', '花型图'].forEach((token) => {
  assert(confirmationHtml.includes(token), `生产确认单必须展示：${token}`)
})
assert(confirmationHtml.includes('暂无图片') || confirmationHtml.includes('<img '), '生产确认单必须处理无图片兜底')
assertNotIncludes(confirmationHtml, 'patternMaterialType', '生产确认单不得显示 patternMaterialType')
assertNotIncludes(confirmationHtml, 'partCode', '生产确认单不得显示 partCode')
assertNotIncludes(confirmationHtml, 'imageSnapshot', '生产确认单不得显示 imageSnapshot')

;[
  'getProductionOrderCutPieceParts',
  'resolveDemoCutPieceParts',
  "partName: '前片'",
  "partName: '后片'",
  "partName: '袖子'",
].forEach((token) => {
  assertIncludes(generatedFeiSource, token, `裁床菲票主源必须引用技术包部位：${token}`)
})

assertIncludes(generatedOriginalCutOrdersSource, 'getProductionOrderCutPieceParts', '原始裁片单生成必须可引用技术包部位')

;[
  'dummyimage',
  'picsum',
  'unsplash',
  'fake image',
].forEach((token) => {
  assertNotIncludes(confirmationHtml, token, `生产确认单渲染结果不得出现外部随机图片：${token}`)
  assertNotIncludes(snapshotPageHtml, token, `技术包快照页渲染结果不得出现外部随机图片：${token}`)
})

assertIncludes(patternDomainSource, '暂无图片', '纸样详情缺图时必须显示暂无图片')
;['纸样文件类型', '布料纸样', '针织纸样', '纸样分类', '解析纸样', '适用颜色', '每种颜色的片数', '特殊工艺'].forEach((token) => {
  assertIncludes(patternDomainSource, token, `纸样页必须展示：${token}`)
})
;['解析模板', '部位模板库'].forEach((token) => {
  assertNotIncludes(patternDomainSource, token, `FCS 纸样页不得展示：${token}`)
})
assertIncludes(snapshotPageSource, '暂无图片', '技术包快照页缺图时必须显示暂无图片')
assertIncludes(confirmationPageSource, '暂无图片', '确认单缺图时必须显示暂无图片')

console.log('check-tech-pack-pattern-and-images.ts PASS')
