import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resetWoolFactWorkflowMock } from '../src/data/fcs/wool-task-domain.ts'
import {
  addWoolHandover,
  addWoolProcessReport,
  addWoolYarnReceipt,
  listWoolWorkOrders,
} from '../src/data/fcs/wool-task-domain.ts'
import { renderCraftWoolHandoverPrintPage } from '../src/pages/process-factory/wool/handover-print.ts'
import { productionDemands } from '../src/data/fcs/production-demands.ts'
import { buildProductionOrderTechPackSnapshot } from '../src/data/fcs/production-tech-pack-snapshot-builder.ts'
import {
  findStyleArchiveByCode,
  updateStyleArchive,
} from '../src/data/pcs-style-archive-repository.ts'

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

resetWoolFactWorkflowMock('CHECK_WOOL_HANDOVER_PRINTING')

const partPanelOrder = listWoolWorkOrders().find((order) => order.kind === 'PART_PANEL')
assert(partPanelOrder, '缺少部位毛织加工单样例')
assert(
  partPanelOrder.outputPlanLines.length > 0,
  '部位毛织加工单必须有颜色+尺码计划行',
)
assert(
  partPanelOrder.outputPlanLines.every((line) => line.qtyUnit === '件'),
  '部位毛织完工/交出数量必须按颜色+尺码件数，不得按片数统计',
)

const partOutput = partPanelOrder.outputPlanLines[0]
assert(
  partPanelOrder.styleImageUrl && !partPanelOrder.styleImageUrl.includes('/placeholder'),
  '毛织交出单涉及的款式必须带真实款式图，不能使用占位图',
)
addWoolYarnReceipt(partPanelOrder.woolOrderId, {
  commandId: 'CHECK-WOOL-PRINT-RECEIPT',
  receivedAt: '2026-08-01 09:00:00',
  receivedBy: '检查脚本',
  lines: partOutput.requiredYarnSkus.map((yarnSkuCode) => ({
    yarnSkuCode,
    receivedQty: 1,
  })),
})
addWoolProcessReport(partPanelOrder.woolOrderId, {
  commandId: 'CHECK-WOOL-PRINT-REPORT',
  outputSkuCode: partOutput.outputSkuCode,
  reportedQty: 3,
  reportedAt: '2026-08-01 09:10:00',
  reportedBy: '检查脚本',
})
const handover = addWoolHandover(partPanelOrder.woolOrderId, {
  commandId: 'CHECK-WOOL-PRINT-HANDOVER',
  outputSkuCode: partOutput.outputSkuCode,
  handoverQty: 2,
  handedOverAt: '2026-08-01 09:20:00',
  handedOverBy: '检查脚本',
})
const secondHandover = addWoolHandover(partPanelOrder.woolOrderId, {
  commandId: 'CHECK-WOOL-PRINT-HANDOVER-SECOND',
  outputSkuCode: partOutput.outputSkuCode,
  handoverQty: 1,
  handedOverAt: '2026-08-01 09:30:00',
  handedOverBy: '检查脚本',
})

assert.equal(handover.qtyUnit, '件', '部位毛织交出记录单位必须是件')
assert.equal(
  handover.receiverType,
  'CUTTING_WAIT_HANDOVER_WAREHOUSE',
  '部位毛织交出后的接收方必须是裁床工厂/裁床待交出仓',
)

const workOrdersSource = read('src/pages/process-factory/wool/work-orders.ts')
const workOrderDetailSource = read('src/pages/process-factory/wool/work-order-detail.ts')
const woolTypesSource = read('src/data/fcs/wool-domain/types.ts')
const woolMockSource = read('src/data/fcs/wool-domain/mock-data.ts')
const woolTechPackSource = read('src/data/fcs/wool-domain/tech-pack-source.ts')
const snapshotBuilderSource = read('src/data/fcs/production-tech-pack-snapshot-builder.ts')
const realQrSource = read('src/components/real-qr.ts')
const routeSource = read('src/router/routes-fcs.ts')
const renderersSource = read('src/router/route-renderers-fcs.ts')
const linksSource = read('src/data/fcs/fcs-route-links.ts')
const printPagePath = 'src/pages/process-factory/wool/handover-print.ts'
const designSource = read('docs/superpowers/specs/2026-07-30-wool-management-fact-workflow-design.md')
const planSource = read('docs/superpowers/plans/2026-07-30-wool-management-fact-workflow-implementation-plan.md')

assert(
  workOrdersSource.includes('打印交出单'),
  '毛织加工单列表操作栏必须提供“打印交出单”入口',
)
assert(
  linksSource.includes('buildWoolHandoverPrintLink'),
  '必须提供毛织交出单打印链接构造函数',
)
assert(
  renderersSource.includes('renderCraftWoolHandoverPrintPage'),
  '必须注册毛织交出单打印页 renderer',
)
assert(
  routeSource.includes('handover-print')
    && routeSource.includes('renderCraftWoolHandoverPrintPage'),
  '必须注册毛织交出单动态打印路由',
)
assert(
  /handover-print\\\/\(\[\^\/\]\+\)/.test(routeSource)
    && routeSource.includes('decodeURIComponent(match[2])'),
  '毛织交出单动态路由必须支持 handoverId 精确打印单条交出记录',
)
assert(existsSync(new URL(`../${printPagePath}`, import.meta.url)), '缺少毛织交出单 A4 打印页面')

const printSource = read(printPagePath)
for (const requiredText of [
  '交出单',
  'SURAT JALAN',
  'data-wool-handover-print-page',
  'renderRealQrPlaceholder',
  'data-wool-print-spu-info',
  '生产单',
  '毛织加工单',
  '下游接收工厂',
  '颜色',
  '尺码',
  '款式图',
]) {
  assert(printSource.includes(requiredText), `毛织交出单打印页缺少：${requiredText}`)
}
assert(
  workOrderDetailSource.includes('打印本次交出单')
    && workOrderDetailSource.includes('record.handoverId'),
  '加工单详情交出记录必须提供绑定 handoverId 的“打印本次交出单”入口',
)
assert(
  printSource.includes('renderRealQrPlaceholder') && realQrSource.includes('QRCodeSVG'),
  '交出单必须复用 qrcode.react 生成真实可扫描二维码',
)
assert(
  printSource.includes("document.querySelectorAll('[data-real-qr]')")
    && printSource.includes("qrNodes.some((node) => !node.querySelector('svg'))")
    && printSource.includes('二维码正在生成，请稍后再打印。'),
  '正式打印按钮必须等待每张交出单的真实二维码 SVG 全部生成，避免批量打印空二维码',
)
assert(
  !printSource.includes('function qrCode')
    && !printSource.includes('data-qr-code')
    && !printSource.includes('data-barcode')
    && !printSource.includes('交出单条码'),
  '不得继续把伪方格或装饰条纹标为二维码/条码',
)
assert(
  !woolMockSource.includes('data:image/svg+xml')
    && /styleImageUrl:\s*['"`]\/[^'"`]+\.jpg/.test(woolMockSource),
  '毛织 Mock 款式图必须使用 public 下真实 jpg 资产，不得使用 data SVG 伪图',
)
for (const forbiddenText of [
  '本次交出对应物料',
  'data-wool-print-materials',
  'data-wool-print-material-item',
  'data-material-sku',
  'wool-print-material-image',
  '物料图',
]) {
  assert(!printSource.includes(forbiddenText), `毛织交出单不得残留投入纱线板块：${forbiddenText}`)
}
assert(
  !woolTypesSource.includes('materialImages')
    && !woolMockSource.includes('materialImages')
    && !woolTechPackSource.includes('materialImages')
    && !woolTechPackSource.includes('materialImageUrl'),
  '毛织领域源文件不得残留 materialImages 或毛织专用 materialImageUrl 数据链',
)
assert(
  snapshotBuilderSource.includes('styleImages')
    && snapshotBuilderSource.includes('style.mainImageUrl'),
  '生产单技术包快照必须冻结款式档案 SPU 主图，供毛织加工单使用',
)
const snapshotDemand = productionDemands.find((item) => item.demandId === 'DEM-202603-0001')
assert(snapshotDemand, '缺少生产单技术包快照主图检查用需求')
const snapshotStyle = findStyleArchiveByCode(snapshotDemand.spuCode)
assert(snapshotStyle, '缺少生产单技术包快照主图检查用款式档案')
const originalStyleImages = {
  mainImageUrl: snapshotStyle.mainImageUrl,
  galleryImageUrls: [...snapshotStyle.galleryImageUrls],
}
try {
  updateStyleArchive(snapshotStyle.styleId, {
    mainImageUrl: '/cardigan-sample.jpg',
    galleryImageUrls: ['/jacket-sample.jpg'],
  })
  const techPackSnapshot = buildProductionOrderTechPackSnapshot({
    productionOrderId: 'PO-CHECK-WOOL-STYLE-IMAGE',
    productionOrderNo: 'PO-CHECK-WOOL-STYLE-IMAGE',
    demand: snapshotDemand,
    snapshotAt: '2026-08-01 08:00:00',
    snapshotBy: '毛织交出单检查',
  })
  assert.deepEqual(
    techPackSnapshot.imageSnapshot.styleImages,
    ['/cardigan-sample.jpg', '/jacket-sample.jpg'],
    '生产单技术包快照必须按主图优先顺序冻结 SPU 真实款式图片',
  )
} finally {
  updateStyleArchive(snapshotStyle.styleId, originalStyleImages)
}
assert(
  /qtyUnit:\s*'件'/.test(woolTypesSource)
    && !/interface WoolOutputPlanLine[\s\S]*?qtyUnit:\s*'片'/.test(woolTypesSource),
  'WoolOutputPlanLine 与毛织交出记录必须固定使用件数口径',
)
assert(
  !printSource.includes('菲票') && !workOrdersSource.includes('打印菲票'),
  '毛织打印链路不得出现菲票语义',
)

for (const forbiddenDocText of [
  '部位加工后对象 | 毛织部位 SKU，单位为片',
  '部位计划量 | 成衣 SKU 计划件数 × 单件该部位所需片数',
  '部位毛织按毛织部位 SKU 和片',
  '计划片数为成衣计划件数',
  "qtyUnit: '件' | '片'",
  "assert.equal(sleeveM.qtyUnit, '片')",
  '成衣 SKU/毛织部位 SKU、件/片和片数乘法',
]) {
  assert(
    !designSource.includes(forbiddenDocText) && !planSource.includes(forbiddenDocText),
    `正式设计/实现计划仍残留部位毛织片数口径：${forbiddenDocText}`,
  )
}
for (const requiredDocText of [
  '部位毛织按毛织部位 SKU 和颜色+尺码件数管理',
  '每次交出必须可以打印独立交出单',
  '明细数量按颜色+尺码展示“本次交出件数”',
  '`renderCraftWoolHandoverPrintPage(woolOrderId, handoverId?)`',
  '款式图与 SPU 款式信息处于同一区块',
  '详情交出记录提供“打印本次交出单”',
]) {
  assert(
    designSource.includes(requiredDocText) || planSource.includes(requiredDocText),
    `正式设计/实现计划缺少毛织交出单或件数口径说明：${requiredDocText}`,
  )
}

const renderedPrintPage = renderCraftWoolHandoverPrintPage(partPanelOrder.woolOrderId, handover.handoverId)
for (const expectedRenderedText of [
  handover.handoverId,
  partPanelOrder.productionOrderNo,
  partPanelOrder.woolOrderNo,
  '裁床工厂（裁床待交出仓）',
  partOutput.colorName,
  partOutput.sizeCode,
  '2 件',
  'data-real-qr',
  'data-wool-print-spu-info',
  'wool-print-style-image',
  partOutput.outputSkuCode,
]) {
  assert(renderedPrintPage.includes(expectedRenderedText), `实际交出单渲染结果缺少：${expectedRenderedText}`)
}
assert(!renderedPrintPage.includes(secondHandover.handoverId), '指定 handoverId 后只能打印对应单条交出记录')
assert.equal(
  (renderedPrintPage.match(/data-wool-print-style-image/g) ?? []).length,
  1,
  '每个 SPU 的交出单只能展示一张款式图',
)
assert(
  /data-wool-print-spu-info[\s\S]*data-wool-print-style-image/.test(renderedPrintPage),
  '唯一款式图必须与 SPU 款式信息处于同一区块',
)
assert(
  partPanelOrder.styleImageUrl?.endsWith('.jpg'),
  '实际交出单款式图必须来自 public 下真实 jpg 资产',
)
const renderedBatch = renderCraftWoolHandoverPrintPage(partPanelOrder.woolOrderId)
assert(renderedBatch.includes(handover.handoverId) && renderedBatch.includes(secondHandover.handoverId), '加工单入口必须批量打印全部交出记录')
const renderedMissing = renderCraftWoolHandoverPrintPage(partPanelOrder.woolOrderId, 'WHO-NOT-FOUND')
assert(renderedMissing.includes('未找到对应的交出记录'), '指定不存在的 handoverId 时必须显示清晰空态')
assert(!renderedPrintPage.includes('菲票'), '实际毛织交出单渲染结果不得出现菲票语义')

console.log('check:wool-handover-printing passed')
