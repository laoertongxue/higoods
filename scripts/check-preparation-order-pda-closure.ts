import assert from 'node:assert/strict'

import {
  acceptPrintWorkOrderPdaTask,
  capturePrintProcessMutationState,
  getPrintExecutionNodeRecord,
  listPrintMobileExecutionTasks,
  listPrintWorkOrders,
  rejectPrintWorkOrderPdaTask,
  restorePrintProcessMutationState,
  submitPrintHandover,
} from '../src/data/fcs/printing-task-domain.ts'
import {
  acceptDyeWorkOrderPdaTask,
  captureDyeProcessMutationState,
  listDyeMobileExecutionTasks,
  listDyeWorkOrders,
  rejectDyeWorkOrderPdaTask,
  restoreDyeProcessMutationState,
  submitDyeHandover,
} from '../src/data/fcs/dyeing-task-domain.ts'
import {
  acceptWaterSolubleWorkOrderPdaTask,
  assignWaterSolubleFactory,
  listWaterSolubleMobileTasks,
  listWaterSolubleWorkOrders,
} from '../src/data/fcs/water-soluble-task-domain.ts'
import {
  getMobileTaskProcessType,
  isTaskVisibleInMobileExecutionList,
  listPdaMobileExecutionTasks,
} from '../src/data/fcs/process-mobile-task-binding.ts'
import { executeMobileProcessAction } from '../src/data/fcs/process-action-writeback-service.ts'

const pendingPrint = listPrintWorkOrders().find((order) => order.printFactoryId && order.acceptanceStatus === 'PENDING')
assert(pendingPrint, '缺少待接单印花加工单场景')
const printSnapshot = capturePrintProcessMutationState()
let pendingPrintTask = listPrintMobileExecutionTasks().find((task) => task.taskId === pendingPrint.taskId)
assert(pendingPrintTask, '待接单印花加工单没有投影到 PDA 接单数据')
assert.equal(pendingPrintTask.defaultDocType, 'PREPARATION_ORDER', '印花 PDA 对象必须是生产准备加工单')
assert.equal(isTaskVisibleInMobileExecutionList(pendingPrintTask, pendingPrint.printFactoryId), false, '印花加工单接单前不得进入执行列表')

rejectPrintWorkOrderPdaTask(pendingPrint.taskId, '检查员', '接单能力不匹配')
const rejectedPrint = listPrintWorkOrders().find((order) => order.taskId === pendingPrint.taskId)
assert.equal(rejectedPrint?.acceptanceStatus, 'REJECTED', '印花拒单必须写回源加工单')
assert.equal(rejectedPrint?.printFactoryId, '', '印花拒单必须释放原工厂分配')
restorePrintProcessMutationState(printSnapshot)

acceptPrintWorkOrderPdaTask(pendingPrint.taskId, '检查员', '2026-08-05 10:00:00')
pendingPrintTask = listPrintMobileExecutionTasks().find((task) => task.taskId === pendingPrint.taskId)
const acceptedPrint = listPrintWorkOrders().find((order) => order.taskId === pendingPrint.taskId)
assert.equal(acceptedPrint?.acceptanceStatus, 'ACCEPTED', '印花接单必须写回源加工单')
assert.equal(pendingPrintTask?.acceptanceStatus, 'ACCEPTED', '印花 PDA 投影必须实时读取源加工单接单状态')
assert.equal(pendingPrintTask?.qty, acceptedPrint?.plannedQty, '印花 PDA 数量必须实时读取源加工单')
assert.equal(isTaskVisibleInMobileExecutionList(pendingPrintTask, acceptedPrint?.printFactoryId), true, '印花接单后必须进入执行列表')

const pendingDye = listDyeWorkOrders().find((order) => order.dyeFactoryId && order.acceptanceStatus === 'PENDING')
assert(pendingDye, '缺少待接单染色加工单场景')
const dyeSnapshot = captureDyeProcessMutationState()
let pendingDyeTask = listDyeMobileExecutionTasks().find((task) => task.taskId === pendingDye.taskId)
assert(pendingDyeTask, '待接单染色加工单没有投影到 PDA 接单数据')
assert.equal(pendingDyeTask.defaultDocType, 'PREPARATION_ORDER', '染色 PDA 对象必须是生产准备加工单')
assert.equal(isTaskVisibleInMobileExecutionList(pendingDyeTask, pendingDye.dyeFactoryId), false, '染色加工单接单前不得进入执行列表')

rejectDyeWorkOrderPdaTask(pendingDye.taskId, '检查员', '染缸能力不匹配')
const rejectedDye = listDyeWorkOrders().find((order) => order.taskId === pendingDye.taskId)
assert.equal(rejectedDye?.acceptanceStatus, 'REJECTED', '染色拒单必须写回源加工单')
assert.equal(rejectedDye?.dyeFactoryId, '', '染色拒单必须释放原工厂分配')
restoreDyeProcessMutationState(dyeSnapshot)

acceptDyeWorkOrderPdaTask(pendingDye.taskId, '检查员', '2026-08-05 10:00:00')
pendingDyeTask = listDyeMobileExecutionTasks().find((task) => task.taskId === pendingDye.taskId)
const acceptedDye = listDyeWorkOrders().find((order) => order.taskId === pendingDye.taskId)
assert.equal(acceptedDye?.acceptanceStatus, 'ACCEPTED', '染色接单必须写回源加工单')
assert.equal(pendingDyeTask?.acceptanceStatus, 'ACCEPTED', '染色 PDA 投影必须实时读取源加工单接单状态')
assert.equal(pendingDyeTask?.qty, acceptedDye?.plannedQty, '染色 PDA 数量必须实时读取源加工单')
assert.equal(isTaskVisibleInMobileExecutionList(pendingDyeTask, acceptedDye?.dyeFactoryId), true, '染色接单后必须进入执行列表')

const unassignedWater = listWaterSolubleWorkOrders().find((order) => !order.factoryId)
assert(unassignedWater, '缺少待分配水溶加工单场景')
assert(assignWaterSolubleFactory(unassignedWater.waterOrderId, 'F090').ok, '水溶加工单分配工厂失败')
const pendingWater = listWaterSolubleWorkOrders().find((order) => order.waterOrderId === unassignedWater.waterOrderId)
assert(pendingWater, '缺少待接单水溶加工单场景')
let pendingWaterTask = listWaterSolubleMobileTasks().find((task) => task.taskId === pendingWater.taskId)
assert.equal(pendingWaterTask?.defaultDocType, 'PREPARATION_ORDER', '水溶 PDA 对象必须是生产准备加工单')
assert.equal(isTaskVisibleInMobileExecutionList(pendingWaterTask, pendingWater.factoryId), false, '水溶加工单接单前不得进入执行列表')
assert(acceptWaterSolubleWorkOrderPdaTask(pendingWater.taskId, '检查员').ok, '水溶加工单接单失败')
pendingWaterTask = listWaterSolubleMobileTasks().find((task) => task.taskId === pendingWater.taskId)
assert.equal(pendingWaterTask?.acceptanceStatus, 'ACCEPTED', '水溶接单必须写回源加工单并实时投影')
assert.equal(isTaskVisibleInMobileExecutionList(pendingWaterTask, pendingWater.factoryId), true, '水溶接单后必须进入执行列表')

const mobileTasks = listPdaMobileExecutionTasks()
const printTaskIds = new Set(listPrintWorkOrders().map((order) => order.taskId))
const dyeTaskIds = new Set(listDyeWorkOrders().map((order) => order.taskId))
assert.equal(mobileTasks.filter((task) => printTaskIds.has(task.taskId)).length, printTaskIds.size, '每张印花加工单必须且只能投影一条 PDA 对象')
assert.equal(mobileTasks.filter((task) => dyeTaskIds.has(task.taskId)).length, dyeTaskIds.size, '每张染色加工单必须且只能投影一条 PDA 对象')
assert(mobileTasks.filter((task) => getMobileTaskProcessType(task) === 'PRINT').every((task) => printTaskIds.has(task.taskId)), 'PDA 不得残留脱离加工单的通用印花任务')
assert(mobileTasks.filter((task) => getMobileTaskProcessType(task) === 'DYE').every((task) => dyeTaskIds.has(task.taskId)), 'PDA 不得残留脱离加工单的通用染色任务')

const waitPrint = listPrintWorkOrders().find((order) => order.status === 'WAIT_HANDOVER')
assert(waitPrint, '缺少印花待交出场景')
assert.throws(() => submitPrintHandover(waitPrint.printOrderId, { handoverQty: waitPrint.plannedQty + 1_000_000 }), /不能超过已完工未交出数量/, '印花交出必须限制在已完工未交出数量内')
const waitDye = listDyeWorkOrders().find((order) => order.status === 'WAIT_HANDOVER')
assert(waitDye, '缺少染色待交出场景')
assert.throws(() => submitDyeHandover(waitDye.dyeOrderId, { handoverQty: waitDye.plannedQty + 1_000_000 }), /不能超过已完工未交出数量/, '染色交出必须限制在已完工未交出数量内')

const transferNode = getPrintExecutionNodeRecord(waitPrint.printOrderId, 'TRANSFER')
const handoverQty = transferNode?.actualCompletedQty || transferNode?.outputQty || waitPrint.plannedQty
const handoverPayload = {
  sourceType: 'PRINT' as const,
  sourceId: waitPrint.printOrderId,
  taskId: waitPrint.taskId,
  actionCode: 'PRINT_SUBMIT_HANDOVER',
  objectQty: handoverQty,
  qtyUnit: waitPrint.qtyUnit,
  operatorName: '检查员',
  confirmationKey: `CHECK-IDEMPOTENCY:${waitPrint.printOrderId}`,
}
const firstHandover = executeMobileProcessAction(handoverPayload)
const repeatedHandover = executeMobileProcessAction(handoverPayload)
assert.equal(repeatedHandover.operationRecordId, firstHandover.operationRecordId, '相同确认键不得重复生成操作记录')
assert.equal(repeatedHandover.affectedHandoverRecordId, firstHandover.affectedHandoverRecordId, '相同确认键不得重复生成交出记录')

console.log('preparation order PDA closure checks passed')
