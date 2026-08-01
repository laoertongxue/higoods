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
assert(
  partOutput.materialImageUrls?.length
    && partOutput.materialImageUrls.every((url) => url && !url.includes('/placeholder')),
  '毛织交出单涉及的物料必须带真实物料图，不能使用占位图',
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

assert.equal(handover.qtyUnit, '件', '部位毛织交出记录单位必须是件')
assert.equal(
  handover.receiverType,
  'CUTTING_WAIT_HANDOVER_WAREHOUSE',
  '部位毛织交出后的接收方必须是裁床工厂/裁床待交出仓',
)

const workOrdersSource = read('src/pages/process-factory/wool/work-orders.ts')
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
assert(existsSync(new URL(`../${printPagePath}`, import.meta.url)), '缺少毛织交出单 A4 打印页面')

const printSource = read(printPagePath)
for (const requiredText of [
  '交出单',
  'SURAT JALAN',
  'data-wool-handover-print-page',
  'data-barcode',
  'data-qr-code',
  '生产单',
  '毛织加工单',
  '下游接收工厂',
  '颜色',
  '尺码',
  '真实款式图',
  '真实物料图',
]) {
  assert(printSource.includes(requiredText), `毛织交出单打印页缺少：${requiredText}`)
}
assert(
  !printSource.includes('菲票') && !workOrdersSource.includes('打印菲票'),
  '毛织打印链路不得出现菲票语义',
)

for (const forbiddenDocText of [
  '部位加工后对象 | 毛织部位 SKU，单位为片',
  '部位计划量 | 成衣 SKU 计划件数 × 单件该部位所需片数',
  '部位毛织按毛织部位 SKU 和片',
  '计划片数为成衣计划件数',
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
  '新增 `renderCraftWoolHandoverPrintPage`',
]) {
  assert(
    designSource.includes(requiredDocText) || planSource.includes(requiredDocText),
    `正式设计/实现计划缺少毛织交出单或件数口径说明：${requiredDocText}`,
  )
}

const renderedPrintPage = renderCraftWoolHandoverPrintPage(partPanelOrder.woolOrderId)
for (const expectedRenderedText of [
  handover.handoverId,
  partPanelOrder.productionOrderNo,
  partPanelOrder.woolOrderNo,
  '裁床工厂（裁床待交出仓）',
  partOutput.colorName,
  partOutput.sizeCode,
  '2 件',
  'data-barcode',
  'data-qr-code',
  'wool-print-style-image',
  'wool-print-material-image-1',
]) {
  assert(renderedPrintPage.includes(expectedRenderedText), `实际交出单渲染结果缺少：${expectedRenderedText}`)
}
assert(!renderedPrintPage.includes('菲票'), '实际毛织交出单渲染结果不得出现菲票语义')

console.log('check:wool-handover-printing passed')
