import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildTaskDeliveryCardPrintDocByRecordId,
  buildTaskRouteCardPrintDoc,
} from '../src/data/fcs/task-print-cards.ts'
import {
  listPrintExecutionNodeRecords,
  listPrintWorkOrders,
} from '../src/data/fcs/printing-task-domain.ts'
import {
  listDyeExecutionNodeRecords,
  listDyeWorkOrders,
} from '../src/data/fcs/dyeing-task-domain.ts'
import { listSpecialCraftTaskOrders } from '../src/data/fcs/special-craft-task-orders.ts'
import { listGeneratedOriginalCutOrderSourceRecords } from '../src/data/fcs/cutting/generated-original-cut-orders.ts'
import { listCuttingMergeBatchTaskPrintSources } from '../src/data/fcs/cutting-task-print-source.ts'
import {
  getPdaHandoverRecordsByHead,
  listPdaHandoverHeads,
} from '../src/data/fcs/pda-handover-events.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(ROOT, relativePath), 'utf8')
}

function exists(relativePath: string): boolean {
  return fs.existsSync(path.resolve(ROOT, relativePath))
}

function assertIncludes(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNotIncludes(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

function sourceBetween(source: string, startToken: string, endToken: string): string {
  const start = source.indexOf(startToken)
  assert(start >= 0, `缺少片段起点：${startToken}`)
  const end = source.indexOf(endToken, start + startToken.length)
  assert(end > start, `缺少片段终点：${endToken}`)
  return source.slice(start, end)
}

function stripImportsAndComments(source: string): string {
  return source
    .replace(/import[\s\S]*?from\s+['"][^'"]+['"]\s*;?/g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
}

;[
  'src/data/fcs/task-print-cards.ts',
  'src/pages/print/task-route-card.ts',
  'src/pages/print/task-delivery-card.ts',
].forEach((file) => assert(exists(file), `缺少 Step 1 打印底座文件：${file}`))

const packageSource = read('package.json')
const taskPrintSource = read('src/data/fcs/task-print-cards.ts')
const routeLinksSource = read('src/data/fcs/fcs-route-links.ts')
const routesSource = read('src/router/routes-fcs.ts')
const renderersSource = read('src/router/route-renderers-fcs.ts')
const routePageSource = read('src/pages/print/task-route-card.ts')
const deliveryPageSource = read('src/pages/print/task-delivery-card.ts')
const printingPageSource = read('src/pages/process-factory/printing/work-orders.ts')
const dyeingPageSource = read('src/pages/process-factory/dyeing/work-orders.ts')
const specialTaskListSource = read('src/pages/process-factory/special-craft/task-orders.ts')
const specialTaskDetailSource = read('src/pages/process-factory/special-craft/task-detail.ts')
const specialWarehouseSource = read('src/pages/process-factory/special-craft/warehouse.ts')
const originalOrdersSource = read('src/pages/process-factory/cutting/original-orders.ts')
const mergeBatchesSource = read('src/pages/process-factory/cutting/merge-batches.ts')
const appShellSource = read('src/data/app-shell-config.ts')

;[
  'buildTaskRouteCardPrintLink',
  'buildTaskDeliveryCardPrintLink',
  'buildTaskRouteCardPrintDoc',
  'buildTaskDeliveryCardPrintDocByRecordId',
  '/fcs/print/task-route-card',
  '/fcs/print/task-delivery-card',
].forEach((token) => {
  assertIncludes(
    [taskPrintSource, routeLinksSource, routesSource, renderersSource].join('\n'),
    token,
    `Step 1 打印底座缺少：${token}`,
  )
})

;[
  'PRINTING_WORK_ORDER',
  'DYEING_WORK_ORDER',
  'SPECIAL_CRAFT_TASK_ORDER',
  'CUTTING_ORIGINAL_ORDER',
  'CUTTING_MERGE_BATCH',
].forEach((sourceType) => assertIncludes(taskPrintSource, sourceType, `任务流转卡 builder 未接入 ${sourceType}`))

assertIncludes(printingPageSource, '打印任务流转卡', '/fcs/craft/printing/work-orders 缺少打印任务流转卡入口')
assertIncludes(printingPageSource, "buildTaskRouteCardPrintLink('PRINTING_WORK_ORDER', order.printOrderId)", '印花加工单必须使用 printOrderId')
assertNotIncludes(printingPageSource, '打印任务交货卡', '印花加工单不得提前增加任务交货卡')

assertIncludes(dyeingPageSource, '打印任务流转卡', '/fcs/craft/dyeing/work-orders 缺少打印任务流转卡入口')
assertIncludes(dyeingPageSource, "buildTaskRouteCardPrintLink('DYEING_WORK_ORDER', order.dyeOrderId)", '染色加工单必须使用 dyeOrderId')
assertNotIncludes(dyeingPageSource, '打印任务交货卡', '染色加工单不得提前增加任务交货卡')

assertIncludes(specialTaskListSource, '打印任务流转卡', '特殊工艺任务单列表缺少打印任务流转卡')
assertIncludes(specialTaskListSource, "buildTaskRouteCardPrintLink('SPECIAL_CRAFT_TASK_ORDER', taskOrder.taskOrderId)", '特殊工艺任务单列表必须使用 taskOrderId')
assertIncludes(specialTaskDetailSource, '打印任务流转卡', '特殊工艺任务详情缺少打印任务流转卡')
assertIncludes(specialTaskDetailSource, "buildTaskRouteCardPrintLink('SPECIAL_CRAFT_TASK_ORDER', taskOrder.taskOrderId)", '特殊工艺任务详情必须使用 taskOrderId')

assertIncludes(originalOrdersSource, '打印任务流转卡', '原始裁片单缺少打印任务流转卡')
assertIncludes(originalOrdersSource, 'print-task-route-card', '原始裁片单缺少 print-task-route-card action')
assertIncludes(originalOrdersSource, "buildTaskRouteCardPrintLink('CUTTING_ORIGINAL_ORDER', row.originalCutOrderId)", '原始裁片单打印必须使用 originalCutOrderId')

assertIncludes(mergeBatchesSource, '打印任务流转卡', '裁片批次缺少打印任务流转卡')
assertIncludes(mergeBatchesSource, 'print-task-route-card', '裁片批次缺少 print-task-route-card action')
assertIncludes(mergeBatchesSource, "buildTaskRouteCardPrintLink('CUTTING_MERGE_BATCH', batch.mergeBatchId)", '裁片批次打印必须使用 mergeBatchId')

const waitProcessSection = sourceBetween(specialWarehouseSource, 'const waitProcessRows', 'const waitHandoverRows')
const waitHandoverSection = sourceBetween(specialWarehouseSource, 'const waitHandoverRows', 'const inboundRows')
const inboundSection = sourceBetween(specialWarehouseSource, 'const inboundRows', 'const outboundRows')
const outboundSection = sourceBetween(specialWarehouseSource, 'const outboundRows', 'const nodeRows')
assertIncludes(outboundSection, '打印任务交货卡', '特殊工艺仓库出库记录缺少打印任务交货卡')
assertIncludes(outboundSection, 'buildTaskDeliveryCardPrintLink(item.handoverRecordId)', '特殊工艺仓库任务交货卡必须使用 handoverRecordId')
assertIncludes(outboundSection, 'disabled', 'handoverRecordId 缺失时必须禁用任务交货卡按钮')
assertNotIncludes(waitProcessSection, '打印任务交货卡', '待加工仓不得增加打印任务交货卡')
assertNotIncludes(waitHandoverSection, '打印任务交货卡', '待交出仓不得增加打印任务交货卡')
assertNotIncludes(inboundSection, '打印任务交货卡', '入库记录不得增加打印任务交货卡')

const handoutHead = listPdaHandoverHeads().find((head) => head.headType === 'HANDOUT' && getPdaHandoverRecordsByHead(head.handoverId).length > 0)
assert(handoutHead, '缺少任务交货卡检查样例')
const handoutRecord = getPdaHandoverRecordsByHead(handoutHead.handoverId)[0]
const deliveryDoc = buildTaskDeliveryCardPrintDocByRecordId(handoutRecord.handoverRecordId || handoutRecord.recordId)
assert.deepEqual(
  deliveryDoc.summaryRows.slice(0, 3).map((row) => row.label),
  ['交出单号', '交货记录号', '第几次交货'],
  '任务交货卡页头前三项必须是交出单号 / 交货记录号 / 第几次交货',
)
assert.equal(deliveryDoc.sequenceNo, handoutRecord.sequenceNo, '任务交货卡第几次交货必须来自 sequenceNo')
assertIncludes(deliveryPageSource, '交出单号', '任务交货卡预览页缺少交出单号')
assertIncludes(deliveryPageSource, '交货记录号', '任务交货卡预览页缺少交货记录号')
assertIncludes(deliveryPageSource, '第几次交货', '任务交货卡预览页缺少第几次交货')

const printOrder = listPrintWorkOrders().find((order) => listPrintExecutionNodeRecords(order.printOrderId).length > 0) || listPrintWorkOrders()[0]
const dyeOrder = listDyeWorkOrders().find((order) => listDyeExecutionNodeRecords(order.dyeOrderId).length > 0) || listDyeWorkOrders()[0]
const specialTaskOrder = listSpecialCraftTaskOrders()[0]
const originalCutOrder = listGeneratedOriginalCutOrderSourceRecords()[0]
const mergeBatch = listCuttingMergeBatchTaskPrintSources()[0]
assert(printOrder && dyeOrder && specialTaskOrder && originalCutOrder && mergeBatch, '缺少 PFOS 任务流转卡样例数据')

const routeDocs = [
  buildTaskRouteCardPrintDoc({ sourceType: 'PRINTING_WORK_ORDER', sourceId: printOrder.printOrderId }),
  buildTaskRouteCardPrintDoc({ sourceType: 'DYEING_WORK_ORDER', sourceId: dyeOrder.dyeOrderId }),
  buildTaskRouteCardPrintDoc({ sourceType: 'SPECIAL_CRAFT_TASK_ORDER', sourceId: specialTaskOrder.taskOrderId }),
  buildTaskRouteCardPrintDoc({ sourceType: 'CUTTING_ORIGINAL_ORDER', sourceId: originalCutOrder.originalCutOrderId }),
  buildTaskRouteCardPrintDoc({ sourceType: 'CUTTING_MERGE_BATCH', sourceId: mergeBatch.mergeBatchId }),
]

assert.equal(routeDocs[0].title, '印花任务流转卡', '印花任务流转卡标题错误')
assert.equal(routeDocs[1].title, '染色任务流转卡', '染色任务流转卡标题错误')
assert(routeDocs[2].title.endsWith('任务流转卡'), '特殊工艺标题必须以任务流转卡结尾')
assert.equal(routeDocs[3].title, '原始裁片单任务流转卡', '原始裁片单标题错误')
assert.equal(routeDocs[4].title, '裁片批次任务流转卡', '裁片批次标题错误')
routeDocs.forEach((doc) => {
  assert(doc.imageUrl.trim().length > 0, `${doc.sourceType} 图片不能为空`)
  assert(doc.qrValue.trim().length > 0, `${doc.sourceType} 二维码不能为空`)
  assert(doc.summaryRows.length > 0, `${doc.sourceType} 信息区不能为空`)
  assert(doc.nodeRows.length > 0, `${doc.sourceType} 流转记录不能为空`)
})

assertIncludes(read('src/pages/production/confirmation-print.ts'), '生产确认单', '生产确认单打印链路被破坏')
assertIncludes(read('src/pages/process-factory/cutting/material-prep.ts'), '配料单', '配料单打印链路被破坏')
assertIncludes(read('src/pages/process-factory/cutting/fei-tickets.ts'), '菲票', '菲票打印链路被破坏')
assertIncludes(read('src/pages/process-factory/cutting/transfer-bags.ts'), '中转袋', '袋码 / 中转单打印链路被破坏')

assertIncludes(routesSource + routeLinksSource, '/fcs/print/task-route-card', '任务流转卡打印路由不可达')
assertIncludes(routesSource + routeLinksSource, '/fcs/print/task-delivery-card', '任务交货卡打印路由不可达')
assertIncludes(packageSource, 'check:pfos-task-print-entry-spread', 'package.json 缺少 Step 2 检查命令')

;['pfos-task-route-card', 'pfos-task-delivery-card', 'PFOS 专用打印页'].forEach((token) => {
  assertNotIncludes(routesSource + renderersSource + routePageSource + deliveryPageSource, token, `不得新造 PFOS 专用打印页：${token}`)
})

const visibleSource = stripImportsAndComments([
  printingPageSource,
  dyeingPageSource,
  specialTaskListSource,
  specialTaskDetailSource,
  specialWarehouseSource,
  originalOrdersSource,
  mergeBatchesSource,
  routePageSource,
  deliveryPageSource,
].join('\n'))
;[
  ['随货', '交接标签'].join(''),
  ['随', '货单'].join(''),
  ['工艺', '流转卡'].join(''),
  'PDA',
  'QR payload',
  'JSON',
  ['A', 'PI'].join(''),
].forEach((token) => {
  assertNotIncludes(visibleSource, token, `用户可见文案不应出现：${token}`)
})

;['完整 WMS', '拣货波次', '上架任务', '来料仓', '半成品仓'].forEach((token) => {
  assertNotIncludes(visibleSource + appShellSource + routesSource, token, `不得引入 WMS 越界能力：${token}`)
})

console.log('[check-pfos-task-print-entry-spread] PFOS 任务打印入口铺开通过')
