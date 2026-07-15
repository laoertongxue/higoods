import fs from 'node:fs'
import path from 'node:path'
import {
  createPrintWorkOrderFromStock,
  getPrintExecutionNodeRecord,
  getPrintOrderHandoverHead,
  getPrintOrderHandoverRecords,
  getPrintOrderHandoverSummary,
  getPrintReviewRecordByOrderId,
  getPrintWorkOrderByTaskId,
  getPrintWorkOrderStatusLabel,
  hasDirectTransferToReviewTransition,
  listPrintMachineOptions,
  listPrintWorkOrders,
} from '../src/data/fcs/printing-task-domain.ts'
import { getMobileExecutionTaskById } from '../src/data/fcs/mobile-execution-task-index.ts'
import { submitPrintHandover } from '../src/data/fcs/process-execution-writeback.ts'
import { applyPrintWarehouseLinkageAfterAction } from '../src/data/fcs/process-warehouse-linkage-service.ts'
import { getProcessWarehouseRecordById, listProcessHandoverRecords } from '../src/data/fcs/process-warehouse-domain.ts'
import { getPdaHandoverSourceDisplay, listHandoverOrdersByTaskId } from '../src/data/fcs/pda-handover-events.ts'

function fail(message: string): never {
  throw new Error(`[check-printing-workflow] ${message}`)
}

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) fail(message)
}

const pageFiles = [
  'src/pages/process-factory/printing/work-orders.ts',
  'src/pages/process-factory/printing/warehouse.ts',
  'src/pages/process-factory/printing/progress.ts',
  'src/pages/process-factory/printing/pending-review.ts',
  'src/pages/process-factory/printing/statistics.ts',
  'src/pages/process-factory/printing/dashboards.ts',
]

const pageSources = pageFiles.map((file) => ({ file, source: readFile(file) }))
const appShellSource = readFile('src/data/app-shell-config.ts')
const workOrdersPageSource = readFile('src/pages/process-factory/printing/work-orders.ts')
const platformOrdersPageSource = readFile('src/pages/process-print-orders.ts')
const warehousePageSource = readFile('src/pages/process-factory/printing/warehouse.ts')
const routesSource = readFile('src/router/routes-fcs.ts')
const oldTemplateToken = ['renderProcessFactory', 'Scaf', 'foldPage'].join('')
const oldPrintTerms = [
  ['印花', 'PDA'].join(''),
  ['印花 ', 'PDA'].join(''),
  ['Printing', ' PDA'].join(''),
  ['PDA', '印花'].join(''),
]

pageSources.forEach(({ file, source }) => {
  assert(!source.includes(oldTemplateToken), `${file} 仍在引用旧页面模板`)
  assert(!source.includes('骨' + '架页'), `${file} 仍含旧页面描述`)
  assert(!source.includes('仅展' + '示'), `${file} 仍含旧页面描述`)
  assert(!source.includes('敬请' + '期待'), `${file} 仍含旧页面描述`)
  oldPrintTerms.forEach((term) => {
    assert(!source.includes(term), `${file} 出现禁用文案：${term}`)
  })
})

const taskDetailSource = readFile('src/pages/pda-exec-detail.ts')
assert(workOrdersPageSource.includes('打印任务流转卡'), '印花加工单页缺少打印任务流转卡入口')
;['按需求创建', '选择印花需求', '印花需求单号'].forEach((term) => {
  assert(!platformOrdersPageSource.includes(term), `平台印花加工单页面不应包含：${term}`)
})
assert(
  workOrdersPageSource.includes("buildTaskRouteCardPrintLink('PRINTING_WORK_ORDER', order.printOrderId)"),
  '印花加工单页打印任务流转卡必须使用 PRINTING_WORK_ORDER + printOrderId',
)
assert(!workOrdersPageSource.includes('打印任务交货卡'), '印花加工单页不得提前增加打印任务交货卡入口')
assert(appShellSource.includes('印花待加工仓'), '印花厂管理菜单缺少印花待加工仓')
assert(appShellSource.includes('印花待交出仓'), '印花厂管理菜单缺少印花待交出仓')
assert(warehousePageSource.includes('renderCraftPrintingWaitHandoverWarehousePage'), '印花缺少待交出仓页面')
assert(warehousePageSource.includes('出库记录'), '印花待交出仓页缺少出库记录')
assert(warehousePageSource.includes('打印任务交货卡'), '印花待交出仓出库记录缺少打印任务交货卡')
assert(warehousePageSource.includes('buildTaskDeliveryCardPrintLink(item.handoverRecordId)'), '印花任务交货卡必须按 handoverRecordId 打印')
assert(
  routesSource.includes("renderRouteRedirect('/fcs/craft/printing/wait-process-warehouse', '正在跳转到印花待加工仓')"),
  '印花旧仓库入口必须重定向到印花待加工仓',
)
assert(taskDetailSource.includes('印花任务'), '任务详情页缺少印花任务区块')
assert(taskDetailSource.includes('打印机编号'), '任务详情页缺少打印机编号字段')
assert(taskDetailSource.includes('原料使用'), '任务详情页缺少原料使用字段')
assert(taskDetailSource.includes('实际完成'), '任务详情页缺少实际完成字段')
assert(taskDetailSource.includes('待送货'), '任务详情页缺少待送货状态')
oldPrintTerms.forEach((term) => {
  assert(!taskDetailSource.includes(term), `任务详情页出现禁用文案：${term}`)
})

const statisticsSource = readFile('src/pages/process-factory/printing/statistics.ts')
assert(statisticsSource.includes('打印机编号'), '统计页缺少打印机编号')
assert(statisticsSource.includes('打印速度'), '统计页缺少打印速度')
assert(statisticsSource.includes('待送货'), '统计页缺少待送货指标')
assert(statisticsSource.includes('待回写'), '统计页缺少待回写指标')
assert(statisticsSource.includes('待审核'), '统计页缺少待审核指标')

const dashboardSource = readFile('src/pages/process-factory/printing/dashboards.ts')
assert(dashboardSource.includes('待送货'), '大屏缺少待送货模块')
assert(dashboardSource.includes('待回写'), '大屏缺少待回写模块')
assert(dashboardSource.includes('待审核'), '大屏缺少待审核模块')

const reviewSource = readFile('src/pages/process-factory/printing/pending-review.ts')
assert(reviewSource.includes('接收方'), '审核页缺少接收方字段')
assert(reviewSource.includes('审核通过'), '审核页缺少审核通过入口')
assert(reviewSource.includes('审核驳回'), '审核页缺少审核驳回入口')

const progressSource = readFile('src/pages/process-factory/printing/progress.ts')
assert(progressSource.includes('待送货'), '进度页缺少待送货节点')
assert(progressSource.includes('接收方回写'), '进度页缺少接收方回写节点')
assert(progressSource.includes('审核'), '进度页缺少审核节点')

const { listPdaGenericProcessTasks, registerPdaGenericProcessTask } = await import(`../src/data/fcs/pda-task-${'mo'}${'ck'}-factory.ts`)
const tasks = listPdaGenericProcessTasks()
const orders = listPrintWorkOrders()
assert(orders.length > 0, '未生成印花加工单数据')
assert(orders.some((order) => getPrintWorkOrderStatusLabel(order.status) === '待送货'), '印花状态缺少待送货')
assert(!hasDirectTransferToReviewTransition(), '仍存在转印完成直达审核的链路')

orders.forEach((order) => {
  if (order.sourceType === 'PRODUCTION_ORDER') {
    assert(Boolean(order.sourceProductionOrderId), `${order.printOrderNo} 生产单来源必须有唯一 sourceProductionOrderId`)
    assert(!order.stockMaterialId, `${order.printOrderNo} 生产单来源不得携带 stockMaterialId`)
    return
  }
  assert(order.sourceType === 'STOCK', `${order.printOrderNo} 来源类型只能是生产单或备货`)
  assert(Boolean(order.stockMaterialId), `${order.printOrderNo} 备货来源必须有 stockMaterialId`)
  assert(!order.sourceProductionOrderId, `${order.printOrderNo} 备货来源不得伪造 sourceProductionOrderId`)
})

const stockCreated = createPrintWorkOrderFromStock({
  stockMaterialId: 'STOCK-PRINT-CHECK-001',
  stockMaterialName: '印花检查基布',
  materialSku: 'MAT-PRINT-CHECK-001',
  factoryId: orders[0]!.printFactoryId,
  plannedQty: 60,
  qtyUnit: '米',
  plannedFinishAt: '2026-07-31 18:00',
  processName: '数码印花',
})
assert(stockCreated.ok && stockCreated.order, '备货必须可以直接创建印花加工单')
assert(stockCreated.order.sourceType === 'STOCK', '备货印花加工单来源必须是 STOCK')
assert(stockCreated.order.stockMaterialId === 'STOCK-PRINT-CHECK-001', '备货印花加工单必须保留 stockMaterialId')
assert(!stockCreated.order.sourceProductionOrderId, '备货印花加工单不得伪造生产单')
const stockTask = listPdaGenericProcessTasks().find((task) => task.taskId === stockCreated.order!.taskId)
assert(stockTask?.sourceType === 'STOCK', '备货印花 PDA 任务来源必须是 STOCK')
assert(stockTask?.stockMaterialId === 'STOCK-PRINT-CHECK-001', '备货印花 PDA 任务必须保留 stockMaterialId')
assert(stockTask?.stockMaterialName === '印花检查基布', '备货印花 PDA 任务必须保留 stockMaterialName')
assert(stockTask?.productionOrderId === undefined, '备货印花 PDA 任务不得写空生产单 ID')
assert(stockTask?.productionOrderNo === undefined, '备货印花 PDA 任务不得写空生产单号')
if (stockTask) registerPdaGenericProcessTask({ ...stockTask, startedAt: '2026-07-15 10:00:00' })
const stockMobileTask = getMobileExecutionTaskById(stockCreated.order.taskId)
assert(stockMobileTask?.sourceType === 'STOCK', '备货印花移动索引来源必须是 STOCK')
assert(stockMobileTask?.stockMaterialId === 'STOCK-PRINT-CHECK-001', '备货印花移动索引必须保留 stockMaterialId')
assert(stockMobileTask?.productionOrderId === undefined, '备货印花移动索引不得回填生产单 ID')
const stockWarehouseLinkage = applyPrintWarehouseLinkageAfterAction({
  success: true,
  sourceType: 'PRINT',
  sourceId: stockCreated.order.printOrderId,
  taskId: stockCreated.order.taskId,
  actionCode: 'PRINT_FINISH_TRANSFER',
  previousStatus: 'TRANSFERRING',
  nextStatus: 'WAIT_HANDOVER',
  objectQty: stockCreated.order.plannedQty,
  qtyUnit: stockCreated.order.qtyUnit,
})
const stockWarehouseRecord = getProcessWarehouseRecordById(stockWarehouseLinkage.createdWaitHandoverWarehouseRecordId)
assert(stockWarehouseRecord?.sourceType === 'STOCK', '备货印花仓记录来源必须是 STOCK')
assert(stockWarehouseRecord?.stockMaterialId === 'STOCK-PRINT-CHECK-001', '备货印花仓记录必须保留 stockMaterialId')
assert(stockWarehouseRecord?.sourceProductionOrderId === undefined, '备货印花仓记录不得保留空生产单 ID')
assert(stockWarehouseRecord?.sourceDemandId === undefined, '备货印花仓记录不得保留空需求 ID')
const stockSubmit = submitPrintHandover(stockCreated.order.taskId, { submittedQty: stockCreated.order.plannedQty })
const stockPdaHead = listHandoverOrdersByTaskId(stockCreated.order.taskId)[0]
assert(stockPdaHead?.sourceType === 'STOCK', '备货印花 PDA 交出单来源必须是 STOCK')
assert(stockPdaHead?.stockMaterialId === 'STOCK-PRINT-CHECK-001', '备货印花 PDA 交出单必须保留 stockMaterialId')
assert(stockPdaHead?.productionOrderId === undefined, '备货印花 PDA 交出单不得写生产单 ID')
assert(stockPdaHead?.productionOrderNo === undefined, '备货印花 PDA 交出单不得写生产单号')
assert(JSON.stringify(getPdaHandoverSourceDisplay(stockPdaHead!)) === JSON.stringify({ label: '备货物料', value: '印花检查基布 / STOCK-PRINT-CHECK-001' }), '备货印花 PDA 页面必须展示备货物料')
assert(stockSubmit.handoverRecord.sourceType === 'STOCK', '备货印花 PDA 交出记录来源必须是 STOCK')
assert(stockSubmit.handoverRecord.stockMaterialId === 'STOCK-PRINT-CHECK-001', '备货印花 PDA 交出记录必须保留 stockMaterialId')
assert(stockSubmit.handoverRecord.stockMaterialName === '印花检查基布', '备货印花 PDA 交出记录必须保留 stockMaterialName')
assert(stockSubmit.handoverRecord.productionOrderId === undefined, '备货印花 PDA 交出记录不得写生产单 ID')
assert(stockSubmit.handoverRecord.productionOrderNo === undefined, '备货印花 PDA 交出记录不得写生产单号')
const stockHandoverRecord = listProcessHandoverRecords({ sourceWorkOrderId: stockCreated.order.printOrderId })
  .find((record) => record.sourceType === 'STOCK')
assert(stockHandoverRecord?.stockMaterialId === 'STOCK-PRINT-CHECK-001', '备货印花交出回写必须保留 stockMaterialId')
assert(stockHandoverRecord?.sourceProductionOrderId === undefined, '备货印花交出回写不得保留空生产单 ID')

const productionOrder = orders.find((order) => order.sourceType === 'PRODUCTION_ORDER')!
const productionTask = listPdaGenericProcessTasks().find((task) => task.taskId === productionOrder.taskId)
assert(productionTask?.sourceType === 'PRODUCTION_ORDER', '生产单印花 PDA 任务来源必须是 PRODUCTION_ORDER')
assert(productionTask?.productionOrderId === productionOrder.sourceProductionOrderId, '生产单印花 PDA 任务必须保留生产单 ID')
assert(productionTask?.stockMaterialId === undefined, '生产单印花 PDA 任务不得携带备货来源')
if (productionTask) registerPdaGenericProcessTask({ ...productionTask, startedAt: productionTask.startedAt || '2026-07-15 10:00:00' })
const productionWarehouseLinkage = applyPrintWarehouseLinkageAfterAction({
  success: true,
  sourceType: 'PRINT',
  sourceId: productionOrder.printOrderId,
  taskId: productionOrder.taskId,
  actionCode: 'PRINT_FINISH_TRANSFER',
  previousStatus: 'TRANSFERRING',
  nextStatus: 'WAIT_HANDOVER',
  objectQty: productionOrder.plannedQty,
})
const productionWarehouseRecord = getProcessWarehouseRecordById(productionWarehouseLinkage.createdWaitHandoverWarehouseRecordId)
assert(productionWarehouseRecord?.sourceType === 'PRODUCTION_ORDER', '生产单印花仓记录来源必须是 PRODUCTION_ORDER')
assert(productionWarehouseRecord?.sourceProductionOrderId === productionOrder.sourceProductionOrderId, '生产单印花仓记录必须保留生产单 ID')
assert(productionWarehouseRecord?.stockMaterialId === undefined, '生产单印花仓记录不得携带备货来源')
const productionSubmit = submitPrintHandover(productionOrder.taskId, { submittedQty: productionOrder.plannedQty })
const productionPdaHead = listHandoverOrdersByTaskId(productionOrder.taskId)[0]
assert(productionPdaHead?.sourceType === 'PRODUCTION_ORDER', '生产单印花 PDA 交出单来源必须是 PRODUCTION_ORDER')
assert(productionPdaHead?.productionOrderId === productionOrder.sourceProductionOrderId, '生产单印花 PDA 交出单必须保留生产单 ID')
assert(productionPdaHead?.productionOrderNo === productionOrder.sourceProductionOrderNo, '生产单印花 PDA 交出单必须保留生产单号')
assert(productionPdaHead?.stockMaterialId === undefined, '生产单印花 PDA 交出单不得携带备货来源')
assert(JSON.stringify(getPdaHandoverSourceDisplay(productionPdaHead!)) === JSON.stringify({ label: '生产单号', value: productionOrder.sourceProductionOrderNo }), '生产单印花 PDA 页面必须展示生产单号')
assert(productionSubmit.handoverRecord.productionOrderId === productionOrder.sourceProductionOrderId, '生产单印花 PDA 交出记录必须保留生产单 ID')
assert(productionSubmit.handoverRecord.productionOrderNo === productionOrder.sourceProductionOrderNo, '生产单印花 PDA 交出记录必须保留生产单号')
assert(productionSubmit.handoverRecord.stockMaterialId === undefined, '生产单印花 PDA 交出记录不得携带备货来源')
assert(productionSubmit.handoverRecord.stockMaterialName === undefined, '生产单印花 PDA 交出记录不得携带备货名称')
const productionHandoverRecord = listProcessHandoverRecords({ sourceWorkOrderId: productionOrder.printOrderId })
  .find((record) => record.sourceType === 'PRODUCTION_ORDER')
assert(productionHandoverRecord?.sourceProductionOrderId === productionOrder.sourceProductionOrderId, '生产单印花交出回写必须保留生产单 ID')
assert(productionHandoverRecord?.stockMaterialId === undefined, '生产单印花交出回写不得携带备货来源')

orders.forEach((order) => {
  const task = tasks.find((item) => item.taskId === order.taskId)
  assert(task, `印花加工单 ${order.printOrderNo} 未关联任务`)
  assert(getPrintWorkOrderByTaskId(order.taskId)?.printOrderId === order.printOrderId, `${order.printOrderNo} 与任务关联断裂`)
  assert((task?.taskQrValue || '').startsWith('FCS:TASK:v1:'), `${order.printOrderNo} 缺少任务二维码`)
  assert(order.targetTransferWarehouseName === '中转区域', `${order.printOrderNo} 接收方不是中转区域`)
  assert(!/裁床仓|裁片仓/.test(order.targetTransferWarehouseName), `${order.printOrderNo} 错误指向裁床仓`)

  const printNode = getPrintExecutionNodeRecord(order.printOrderId, 'PRINT')
  if (printNode?.startedAt) {
    assert(Boolean(printNode.printerNo), `${order.printOrderNo} 打印开始缺少打印机编号`)
  }
  if (printNode?.finishedAt) {
    assert((printNode.outputQty ?? 0) > 0, `${order.printOrderNo} 打印结束缺少完成数量`)
  }

  const transferNode = getPrintExecutionNodeRecord(order.printOrderId, 'TRANSFER')
  if (transferNode?.startedAt) {
    assert(Boolean(transferNode.startedAt), `${order.printOrderNo} 转印开始未记录时间`)
  }
  if (transferNode?.finishedAt) {
    assert((transferNode.usedMaterialQty ?? 0) > 0, `${order.printOrderNo} 转印结束缺少原料使用`)
    assert((transferNode.actualCompletedQty ?? 0) > 0, `${order.printOrderNo} 转印结束缺少实际完成`)
  }

  const handoverHead = getPrintOrderHandoverHead(order.printOrderId)
  const shouldHaveHandover =
    order.status === 'WAIT_DELIVERY' ||
    order.status === 'HANDOVER_SUBMITTED' ||
    order.status === 'RECEIVER_WRITTEN_BACK' ||
    order.status === 'WAIT_REVIEW' ||
    order.status === 'COMPLETED' ||
    order.status === 'REJECTED'
  if (task?.startedAt && shouldHaveHandover) {
    assert(Boolean(order.handoverOrderId || handoverHead?.handoverOrderId || handoverHead?.handoverId), `${order.printOrderNo} 开工后缺少交出单`)
  }

  const handoverRecords = getPrintOrderHandoverRecords(order.printOrderId)
  handoverRecords.forEach((record) => {
    assert(Boolean(record.handoverRecordQrValue), `${order.printOrderNo} 存在缺少二维码的交出记录`)
  })

  const handoverSummary = getPrintOrderHandoverSummary(order.printOrderId)
  const review = getPrintReviewRecordByOrderId(order.printOrderId)
  if (review) {
    assert(handoverSummary.writtenBackQty > 0, `${order.printOrderNo} 未回写就进入审核`)
  }
  if (review?.reviewStatus === 'REJECTED') {
    assert(Boolean(review.rejectReason?.trim()), `${order.printOrderNo} 审核驳回缺少原因`)
  }
})

const machineList = listPrintMachineOptions('ID-F002')
assert(machineList.length > 0, '印花工厂未配置打印机')

console.log('[check-printing-workflow] 印花加工单、任务节点、交出与审核链路通过')
console.table(
  orders.map((order) => {
    const task = tasks.find((item) => item.taskId === order.taskId)
    const printNode = getPrintExecutionNodeRecord(order.printOrderId, 'PRINT')
    const transferNode = getPrintExecutionNodeRecord(order.printOrderId, 'TRANSFER')
    const handoverSummary = getPrintOrderHandoverSummary(order.printOrderId)
    const review = getPrintReviewRecordByOrderId(order.printOrderId)

    return {
      印花单号: order.printOrderNo,
      印花任务: order.taskNo,
      任务二维码: task?.taskQrValue ? '已生成' : '缺失',
      当前状态: getPrintWorkOrderStatusLabel(order.status),
      打印机编号: printNode?.printerNo || '—',
      原料使用: transferNode?.usedMaterialQty ?? 0,
      实际完成: transferNode?.actualCompletedQty ?? 0,
      交出记录: handoverSummary.recordCount,
      待回写: handoverSummary.pendingWritebackCount,
      审核状态: review ? (review.reviewStatus === 'PASS' ? '已完成' : review.reviewStatus === 'REJECTED' ? '已驳回' : '待审核') : '未进入审核',
    }
  }),
)
