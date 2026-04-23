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
assert(renderersSource.includes('renderProductionConfirmationPrintPage'), '必须注册生产确认单预览渲染器')
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
assert(previewHtml.includes('工序工艺任务分配'), '预览页必须展示任务分配信息')
assert(previewHtml.includes('纸样和尺寸'), '预览页必须展示纸样和尺寸')
assert(previewHtml.includes('纸样分类'), '预览页必须展示纸样分类')
assert(previewHtml.includes('适用颜色'), '预览页必须展示适用颜色')
assert(previewHtml.includes('每种颜色的片数'), '预览页必须展示每种颜色的片数')
assert(previewHtml.includes('特殊工艺'), '预览页必须展示特殊工艺')
assert(previewHtml.includes('暂无图片') || previewHtml.includes('<img '), '预览页必须处理图片展示或缺图兜底')
assert(!previewHtml.includes('WASHING'), '预览页不得显示 WASHING')
assert(!previewHtml.includes('POST_FINISHING'), '预览页不得显示 POST_FINISHING')
assert(!previewHtml.includes('BUTTONHOLE'), '预览页不得显示 BUTTONHOLE')
assert(!previewHtml.includes('BUTTON_ATTACH'), '预览页不得显示 BUTTON_ATTACH')
assert(!previewHtml.includes('IRONING'), '预览页不得显示 IRONING')
assert(!previewHtml.includes('PACKAGING'), '预览页不得显示 PACKAGING')
assert(!previewHtml.includes('confirmationSnapshot'), '预览页不得显示 confirmationSnapshot')
assert(!previewHtml.includes('taskAssignmentSnapshot'), '预览页不得显示 taskAssignmentSnapshot')
assert(!previewHtml.includes('techPackSnapshot'), '预览页不得显示 techPackSnapshot')
assert(!previewHtml.includes('patternMaterialType'), '预览页不得显示 patternMaterialType')
assert(!previewHtml.includes('colorAllocations'), '预览页不得显示 colorAllocations')
assert(!previewHtml.includes('specialCrafts'), '预览页不得显示 specialCrafts')
assert(previewHtml.includes('分配状态'), '预览页必须展示分配状态列')

const specialCraftPreviewHtml = renderProductionConfirmationPrintPage(specialCraftOrder.productionOrderId)
assert(specialCraftPreviewHtml.includes('工序工艺任务分配'), '含特殊工艺任务的确认单页面必须展示任务分配区块')
assert(specialCraftPreviewHtml.includes('待分配'), '未分配特殊工艺任务必须显示待分配')
assert(specialCraftPreviewHtml.includes(specialCraftTask.operationName), '确认单页面必须展示特殊工艺名称')
assert(specialCraftPreviewHtml.includes(specialCraftTask.productionOrderNo), '确认单页面必须展示特殊工艺所属生产单号')
;['作用对象', '裁片部位', '颜色', '尺码', '分配状态'].forEach((token) => {
  assert(specialCraftPreviewHtml.includes(token), `确认单页面缺少特殊工艺字段：${token}`)
})

const blockedHtml = renderProductionConfirmationPrintPage(nonPrintableOrder.productionOrderId)
assert(blockedHtml.includes(nonPrintableState.reason || '未完成工厂分配'), '不可打印页面必须显示短中文原因')

assert.equal(
  formatConfirmationTaskDisplayName({
    processCode: 'SPECIAL_CRAFT',
    processName: '特殊工艺',
    craftName: '洗水',
    isSpecialCraft: true,
  }),
  '特殊工艺 - 洗水',
  '洗水必须显示为“特殊工艺 - 洗水”',
)
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
  '内含：开扣眼、装扣子、熨烫、包装',
  '后道备注必须收口为内含说明',
)

console.log('[check-production-confirmation] PASS')
