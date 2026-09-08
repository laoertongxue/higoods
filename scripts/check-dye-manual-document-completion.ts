import assert from 'node:assert/strict'

import {
  confirmDyeReceipt,
  getDyeReviewRecordByOrderId,
  getDyeWorkOrderById,
  listDyeMobileExecutionTasks,
  listDyeWorkOrders,
} from '../src/data/fcs/dyeing-task-domain.ts'
import { getDyeWorkOrderOnlineRecord } from '../src/data/fcs/dye-work-order-online-domain.ts'
import {
  executeProcessWebAction,
  getAvailableDyeWebActions,
  getUnifiedOperationRecordsForProcessWorkOrder,
} from '../src/data/fcs/process-web-status-actions.ts'
import { renderCraftDyeingWorkOrderDetailPage } from '../src/pages/process-factory/dyeing/work-order-detail.ts'

const waitingOrder = listDyeWorkOrders().find((order) => order.status === 'WAIT_MANUAL_COMPLETION')
assert(waitingOrder, '足额收货后必须存在“待人工完成单据”的染色加工单样本')

const reviewBefore = getDyeReviewRecordByOrderId(waitingOrder.dyeOrderId)
assert(reviewBefore, '待人工完单必须保留收货确认事实')
assert.equal(reviewBefore.reviewStatus, 'FULL_HANDOVER', '待人工完单必须来自全部加工产出已确认收货')
assert.equal(getDyeWorkOrderOnlineRecord(waitingOrder.dyeOrderId).status, '待人工完单', '线上列表不得把足额收货自动显示为已完成')

const mobileBefore = listDyeMobileExecutionTasks().find((task) => task.taskId === waitingOrder.taskId)
assert(mobileBefore, '染色加工单必须存在移动执行任务')
assert.equal(mobileBefore.status, 'IN_PROGRESS', '足额收货后、人工完单前，执行任务不得自动完成')

const availableActions = getAvailableDyeWebActions(waitingOrder.dyeOrderId)
assert.deepEqual(
  availableActions.map((action) => action.actionCode),
  ['DYE_COMPLETE_DOCUMENT'],
  '待人工完单时只能展示人工完成单据动作',
)
assert(renderCraftDyeingWorkOrderDetailPage(waitingOrder.dyeOrderId).includes('人工完成单据'), '染色加工单详情必须展示人工完成单据动作')

const result = executeProcessWebAction({
  sourceType: 'DYE_WORK_ORDER',
  sourceId: waitingOrder.dyeOrderId,
  actionCode: 'DYE_COMPLETE_DOCUMENT',
  operatorName: '染色主管',
  operatedAt: '2026-09-07 15:30:00',
  remark: '全部交出与收货已核对，人工完成本单',
})
assert.equal(result.nextStatus, 'COMPLETED', '人工确认后才允许进入已完成')

const completedOrder = getDyeWorkOrderById(waitingOrder.dyeOrderId)
assert.equal(completedOrder?.status, 'COMPLETED', '人工完成动作必须写回染色加工单唯一事实')
assert.equal(completedOrder?.updatedAt, '2026-09-07 15:30:00', '人工完成时间必须写回加工单')
assert.equal(getDyeWorkOrderOnlineRecord(waitingOrder.dyeOrderId).status, '已完成', '人工完成后线上列表才显示已完成')
assert.equal(
  listDyeMobileExecutionTasks().find((task) => task.taskId === waitingOrder.taskId)?.status,
  'DONE',
  '人工完成后执行任务才允许完成',
)
assert.equal(getAvailableDyeWebActions(waitingOrder.dyeOrderId).length, 0, '已完成单据不得重复提供人工完单动作')

const records = getUnifiedOperationRecordsForProcessWorkOrder('DYE_WORK_ORDER', waitingOrder.dyeOrderId, waitingOrder.taskId)
assert(records.some((record) => record.actionCode === 'DYE_COMPLETE_DOCUMENT' && record.operatorName === '染色主管'), '人工完单必须保留操作人和操作记录')

assert.throws(
  () => executeProcessWebAction({
    sourceType: 'DYE_WORK_ORDER',
    sourceId: waitingOrder.dyeOrderId,
    actionCode: 'DYE_COMPLETE_DOCUMENT',
    operatorName: '染色主管',
    operatedAt: '2026-09-07 15:31:00',
  }),
  /暂无该可执行动作|不能人工完成单据/,
  '已完成加工单不得重复完成',
)
assert.throws(
  () => confirmDyeReceipt(waitingOrder.dyeOrderId, { receivedBy: '仓库收货员' }),
  /已由人工完成，不能再修改收货结果/,
  '人工完成后不得倒改收货事实',
)
assert.deepEqual(getDyeReviewRecordByOrderId(waitingOrder.dyeOrderId), reviewBefore, '被拒绝的重复收货不得污染既有收货事实')

const unfinishedOrder = listDyeWorkOrders().find((order) => order.status !== 'COMPLETED')
assert(unfinishedOrder, '需要未完结样本验证越权完单拦截')
assert(!getAvailableDyeWebActions(unfinishedOrder.dyeOrderId).some((action) => action.actionCode === 'DYE_COMPLETE_DOCUMENT'), '非待人工完单状态不得出现人工完单动作')

console.log('染色加工单人工完单检查通过：收货与单据完成已解耦，人工动作、状态、任务及操作记录闭环。')
