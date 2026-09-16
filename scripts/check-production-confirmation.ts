import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { productionOrders } from '../src/data/fcs/production-orders.ts'
import {
  buildProductionConfirmationSnapshot,
  formatConfirmationTaskDisplayName,
  getPostIncludedRemark,
  getProductionConfirmationByOrderId,
  isProductionConfirmationPrintable,
} from '../src/data/fcs/production-confirmation.ts'
import { getSpecialCraftTasksByProductionOrder } from '../src/data/fcs/special-craft-task-orders.ts'
import { buildProductionConfirmationPrintDocument, renderProductionConfirmationTemplate } from '../src/pages/print/templates/production-material-confirmation-template.ts'
import { renderProductionConfirmationPrintPage } from '../src/pages/production/confirmation-print.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8')
}

function fail(message: string): never {
  throw new Error(`[check-production-confirmation] ${message}`)
}

const confirmationSource = read('src/data/fcs/production-confirmation.ts')
const listSource = read('src/pages/production/orders-domain.ts')
const detailSource = read('src/pages/production/detail-domain.ts')
const previewSource = read('src/pages/production/confirmation-print.ts')
const routesSource = read('src/router/routes-fcs.ts')
const renderersSource = read('src/router/route-renderers-fcs.ts')
const packageSource = read('package.json')

assert(confirmationSource.includes('buildProductionConfirmationSnapshot'), '必须提供 buildProductionConfirmationSnapshot')
assert(confirmationSource.includes('isProductionConfirmationPrintable'), '必须提供 isProductionConfirmationPrintable')
assert(confirmationSource.includes('getOrCreateProductionConfirmation'), '必须提供 getOrCreateProductionConfirmation')
assert(listSource.includes('打印预览'), '生产单列表必须有“打印预览”入口')
assert(detailSource.includes('打印预览'), '生产单详情必须有“打印预览”入口')
assert(previewSource.includes('生产确认单'), '预览页必须显示“生产确认单”')
assert(previewSource.includes('打印'), '预览页必须有“打印”按钮')
assert(previewSource.includes('window.print') || previewSource.includes('@media print'), '预览页必须具备打印能力')
assert(routesSource.includes('/confirmation-print'), '必须注册生产确认单预览路由')
assert(routesSource.includes('pattern: /^\\/fcs\\/production\\/orders\\/([^/]+)\\/confirmation-print$/'), '生产确认单打印预览动态路由必须保留')
assert(renderersSource.includes('renderProductionConfirmationPrintPage'), '必须注册生产确认单预览渲染器')
assert(!previewSource.includes('任务交货卡'), '生产确认单预览页不得被任务交货卡替换')
assert(!previewSource.includes('任务流转卡'), '生产确认单预览页不得被任务流转卡替换')
assert(!packageSource.includes('jspdf'), '不得引入 jspdf')
assert(!packageSource.includes('pdfmake'), '不得引入 pdfmake')
assert(!packageSource.includes('html2pdf'), '不得引入 html2pdf')
assert(!packageSource.includes('react-pdf'), '不得引入 react-pdf')

const printableOrder = productionOrders.find((order) => {
  const current = getProductionConfirmationByOrderId(order.productionOrderId)
  return Boolean(current) || isProductionConfirmationPrintable(order.productionOrderId).printable
})

if (!printableOrder) {
  fail('至少应存在一个可打印生产单或已有确认单版本')
}

const nonPrintableOrder = productionOrders.find((order) => {
  const current = getProductionConfirmationByOrderId(order.productionOrderId)
  return !current && !isProductionConfirmationPrintable(order.productionOrderId).printable
})

if (!nonPrintableOrder) {
  fail('至少应存在一个未完成分配的生产单')
}

const printableState = isProductionConfirmationPrintable(printableOrder.productionOrderId)
if (!getProductionConfirmationByOrderId(printableOrder.productionOrderId)) {
  assert.equal(printableState.printable, true, '完成工厂分配的生产单必须可打印')
}

const nonPrintableState = isProductionConfirmationPrintable(nonPrintableOrder.productionOrderId)
assert.equal(nonPrintableState.printable, false, '未完成工厂分配的生产单不得可打印')
assert(nonPrintableState.reason, '不可打印时必须给出短中文原因')

const generatedSnapshot = buildProductionConfirmationSnapshot(printableOrder.productionOrderId)
assert(generatedSnapshot.productionOrderSnapshot.productionOrderNo, '确认单快照必须带生产单号')
assert(Array.isArray(generatedSnapshot.taskAssignmentSnapshot), '确认单快照必须包含任务分配快照')
assert(Array.isArray(generatedSnapshot.bomSnapshot), '确认单快照必须包含面辅料快照')
assert(Array.isArray(generatedSnapshot.patternSnapshot.rows), '确认单快照必须包含纸样快照')
assert(generatedSnapshot.patternSnapshot.rows.every((row) => Array.isArray(row.selectedSizeCodes)), '确认单纸样快照必须保留尺码数组')
assert(
  generatedSnapshot.patternSnapshot.rows.flatMap((row) => row.pieceRows).every((piece) => Array.isArray(piece.colorAllocations)),
  '确认单纸样快照必须保留颜色分配',
)
assert(
  generatedSnapshot.patternSnapshot.rows.flatMap((row) => row.pieceRows).every((piece) => Array.isArray(piece.specialCrafts)),
  '确认单纸样快照必须保留特殊工艺',
)

const specialCraftOrder = productionOrders.find((order) => getSpecialCraftTasksByProductionOrder(order.productionOrderId).length > 0)
if (!specialCraftOrder) {
  fail('至少应存在一个含特殊工艺任务的生产单')
}

const specialCraftTasks = getSpecialCraftTasksByProductionOrder(specialCraftOrder.productionOrderId)
assert(specialCraftTasks.length > 0, '特殊工艺任务数据源必须可按生产单读取')
assert(specialCraftTasks.every((task) => task.generationSourceLabel === '生产单生成'), '特殊工艺任务来源必须标记为生产单生成')

const specialCraftSnapshot = buildProductionConfirmationSnapshot(specialCraftOrder.productionOrderId)
const specialCraftTask = specialCraftTasks[0]
assert(specialCraftTask, '必须存在示例特殊工艺任务')
const specialCraftRows = specialCraftSnapshot.taskAssignmentSnapshot.filter((row) => row.taskNo === specialCraftTask.taskOrderNo)
assert(specialCraftRows.length > 0, '生产确认单快照必须包含特殊工艺任务分配行')
assert(specialCraftRows.every((row) => row.stageName === '特殊工艺'), '特殊工艺任务在确认单中必须归特殊工艺阶段')
assert(
  specialCraftRows.every(
    (row) =>
      Boolean(row.targetObject?.trim())
      && Boolean(row.partName?.trim())
      && Boolean(row.colorName?.trim())
      && Boolean(row.sizeCode?.trim())
      && Boolean(row.assignmentStatus?.trim()),
  ),
  '特殊工艺任务确认单行必须包含作用对象、裁片部位、颜色、尺码和分配状态',
)

const previewHtml = renderProductionConfirmationPrintPage(printableOrder.productionOrderId)
assert(previewHtml.includes('生产确认单'), '预览页必须输出生产确认单标题')
assert(previewHtml.includes('生产单号'), '预览页必须展示生产单基本信息')
assert(previewHtml.includes('规格数量'), '预览页必须展示规格数量矩阵')
assert(previewHtml.includes('面辅料信息'), '预览页必须展示面辅料信息')
assert(previewHtml.includes('Nama pabrik'), '预览页必须展示线上工厂区块')
assert(previewHtml.includes('Pola kertas') && previewHtml.includes('Graf ukura'), '预览页必须展示纸样和成衣尺寸')
assert(previewHtml.includes('warna &amp; gambar'), '预览页必须展示对应颜色与图片')
assert(previewHtml.includes('颜色'), '预览页必须展示颜色身份')
assert(previewHtml.includes('Daftar SK') && previewHtml.includes('尺码明细'), '预览页必须展示颜色尺码数量矩阵')
assert(previewHtml.includes('Proses Tambahan'), '预览页必须保留额外工艺资料位置')
assert(previewHtml.includes('暂无图片') || previewHtml.includes('<img '), '预览页必须处理图片展示或缺图兜底')
assert(!previewHtml.includes('POST_FINISHING'), '预览页不得显示 POST_FINISHING')
assert(!previewHtml.includes('BUTTONHOLE'), '预览页不得显示 BUTTONHOLE')
assert(!previewHtml.includes('BUTTON_ATTACH'), '预览页不得显示 BUTTON_ATTACH')
assert(!previewHtml.includes('IRON_PACK'), '预览页不得显示烫包技术码')
assert(!previewHtml.includes('confirmationSnapshot'), '预览页不得显示 confirmationSnapshot')
assert(!previewHtml.includes('taskAssignmentSnapshot'), '预览页不得显示 taskAssignmentSnapshot')
assert(!previewHtml.includes('techPackSnapshot'), '预览页不得显示 techPackSnapshot')
assert(!previewHtml.includes('patternMaterialType'), '预览页不得显示 patternMaterialType')
assert(!previewHtml.includes('colorAllocations'), '预览页不得显示 colorAllocations')
assert(!previewHtml.includes('specialCrafts'), '预览页不得显示 specialCrafts')
assert(!previewHtml.includes('PrintDocument'), '纸张不能暴露实现元信息')

// The special-craft example is not assigned yet: keep the route gate, and inspect its actual snapshot through the paper renderer.
const specialRouteState = isProductionConfirmationPrintable(specialCraftOrder.productionOrderId)
if (!specialRouteState.printable) assert(renderProductionConfirmationPrintPage(specialCraftOrder.productionOrderId).includes(specialRouteState.reason!), '未分配特殊工艺生产单仍受打印门禁约束')
const specialCraftPreviewHtml = renderProductionConfirmationTemplate({ ...buildProductionConfirmationPrintDocument(printableOrder.productionOrderId), confirmationSnapshot: specialCraftSnapshot })
for (const craft of specialCraftSnapshot.onlineDisplaySnapshot.additionalProcesses) assert(specialCraftPreviewHtml.includes(craft), `额外工艺栏目必须保留实际工艺：${craft}`)
assert(specialCraftPreviewHtml.includes('Proses Tambahan'), '含特殊工艺的确认单保留额外工艺栏目')
assert(specialCraftPreviewHtml.includes(specialCraftTask.productionOrderNo), '确认单展示对应生产单号')
assert(specialCraftSnapshot.taskAssignmentSnapshot.some((row) => row.taskNo === specialCraftTask.taskOrderNo), '完整任务事实保留在快照中，纸张按线上六区排版')

const blockedHtml = renderProductionConfirmationPrintPage(nonPrintableOrder.productionOrderId)
assert(blockedHtml.includes(nonPrintableState.reason || '未完成工厂分配'), '不可打印页面必须显示短中文原因')

assert.equal(
  formatConfirmationTaskDisplayName({
    processCode: 'POST_FINISHING',
    processName: '后道',
  }),
  '后道',
  '后道只能显示为“后道”',
)
assert.equal(
  getPostIncludedRemark(),
  '内含：开扣眼、装扣子、烫包',
  '后道备注必须收口为内含说明',
)
assert.equal(
  formatConfirmationTaskDisplayName({
    processCode: 'IRON_PACK',
    processName: '烫包',
  }),
  '烫包',
  '独立烫包任务必须以当前业务名称进入生产确认单',
)

console.log('[check-production-confirmation] PASS')
