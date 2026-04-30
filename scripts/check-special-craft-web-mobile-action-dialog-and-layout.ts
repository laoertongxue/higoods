import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { executeMobileProcessAction } from '../src/data/fcs/process-action-writeback-service.ts'
import { executeProcessWebAction, getUnifiedOperationRecordsForProcessWorkOrder } from '../src/data/fcs/process-web-status-actions.ts'
import {
  getDifferenceRecordsByWorkOrderId,
  getHandoverRecordsByWorkOrderId,
  getWarehouseRecordsByWorkOrderId,
} from '../src/data/fcs/process-warehouse-domain.ts'
import { validateSpecialCraftMobileTaskBinding } from '../src/data/fcs/process-mobile-task-binding.ts'
import {
  getSpecialCraftStatistics,
  listSpecialCraftTaskWorkOrders,
} from '../src/data/fcs/special-craft-task-orders.ts'
import { listPlatformSpecialCraftResultViews } from '../src/data/fcs/platform-process-result-view.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    console.error(`特殊工艺检查失败：${message}`)
    process.exit(1)
  }
}

function includesAll(content: string, values: string[], label: string): void {
  values.forEach((value) => assert(content.includes(value), `${label} 缺少 ${value}`))
}

const detailSource = read('src/pages/process-factory/special-craft/work-order-detail.ts')
const taskDetailSource = read('src/pages/process-factory/special-craft/task-detail.ts')
const taskOrdersSource = read('src/pages/process-factory/special-craft/task-orders.ts')
const warehouseSource = read('src/pages/process-factory/special-craft/warehouse.ts')
const statisticsSource = read('src/pages/process-factory/special-craft/statistics.ts')
const sharedDialogSource = read('src/pages/process-factory/shared/web-status-action-dialog.ts')
const webActionsSource = read('src/data/fcs/process-web-status-actions.ts')
const writebackSource = read('src/data/fcs/process-action-writeback-service.ts')
const linkageSource = read('src/data/fcs/process-warehouse-linkage-service.ts')
const mobileSource = read('src/pages/pda-exec-detail.ts')
const platformSource = read('src/data/fcs/platform-process-result-view.ts')

assert(!/data-nav="[^"]*webAction/.test(detailSource), '特殊工艺详情仍存在 data-nav + webAction 直写')
assert(!detailSource.includes('applyWebActionFromUrl'), '特殊工艺详情仍保留 applyWebActionFromUrl 主操作入口')
assert(!detailSource.includes('getProcessWebOperationRecordsBySource'), '特殊工艺详情仍只读取 Web 端操作记录')
includesAll(detailSource, [
  'openProcessWebStatusActionDialog',
  'handleProcessWebStatusActionDialogEvent',
  'data-special-craft-web-action="open-web-status-action-dialog"',
  'data-testid="web-status-action-area"',
  'data-testid="web-status-action-button"',
  'getUnifiedOperationRecordsForProcessWorkOrder',
  'sourceChannel',
], '特殊工艺详情')
includesAll(detailSource, ['基本信息', '接收记录', '加工记录', '菲票记录', '差异记录', '交出记录', '操作记录'], '特殊工艺详情 Tab')
includesAll(sharedDialogSource, [
  'process-web-status-action-dialog',
  'process-web-status-action-title',
  'process-web-status-action-field',
  'process-web-status-action-confirm',
  'process-web-status-action-cancel',
  '关联菲票',
  '接收人',
], '通用 Web 状态操作弹窗')
includesAll(webActionsSource, [
  'SPECIAL_CRAFT_RECEIVE_CUT_PIECES',
  'SPECIAL_CRAFT_START_PROCESS',
  'SPECIAL_CRAFT_FINISH_PROCESS',
  'SPECIAL_CRAFT_REPORT_DIFFERENCE',
  'SPECIAL_CRAFT_SUBMIT_HANDOVER',
  'SPECIAL_CRAFT_REWORK_AFTER_REJECT',
  '接收裁片数量',
  '加工完成裁片数量',
  '交出裁片数量',
  '关联菲票',
], '特殊工艺 Web 动作定义')
includesAll(writebackSource, [
  "sourceType: 'SPECIAL_CRAFT'",
  'executeSpecialCraftAction',
  'SPECIAL_CRAFT_REPORT_DIFFERENCE',
  'SPECIAL_CRAFT_REWORK_AFTER_REJECT',
  'executeMobileProcessAction',
  'executeProcessAction',
], '统一写回服务')
includesAll(linkageSource, [
  'applySpecialCraftWarehouseLinkageAfterAction',
  'SPECIAL_CRAFT_RECEIVE_CUT_PIECES',
  'SPECIAL_CRAFT_FINISH_PROCESS',
  'SPECIAL_CRAFT_SUBMIT_HANDOVER',
  'SPECIAL_CRAFT_REPORT_DIFFERENCE',
  'relatedFeiTicketIds',
  'updatedFeiTicketIds',
  'applySpecialCraftDifferenceToFeiTickets',
], '特殊工艺仓交出联动')
includesAll(mobileSource, [
  'special-receive-cut-pieces',
  'special-start-process',
  'special-finish-process',
  'special-report-difference',
  'special-submit-handover',
  'special-rework-after-reject',
  'executeMobileProcessAction',
  "sourceType: 'SPECIAL_CRAFT'",
  '操作记录',
  '差异记录',
  '交出记录',
], '移动端特殊工艺详情')
includesAll(platformSource, [
  'listPlatformSpecialCraftResultViews',
  'SPECIAL_CRAFT',
  'latestHandoverRecordId',
  'latestDifferenceRecordId',
  'platformStatusLabel',
  'platformRiskLabel',
  'platformActionHint',
], '平台特殊工艺结果视图')
assert(statisticsSource.includes('裁片数量') && statisticsSource.includes('菲票数量'), '特殊工艺统计未使用裁片数量和菲票数量口径')
assert(!`${detailSource}\n${taskDetailSource}\n${taskOrdersSource}\n${warehouseSource}`.match(/开扣眼|装扣子|熨烫|包装/), '特殊工艺页面出现后道或染色包装动作文案')

const workOrders = listSpecialCraftTaskWorkOrders()
const waitReceive = workOrders.find((item) => item.status === '待领料')
const waitProcess = workOrders.find((item) => item.status === '已入待加工仓')
const processing = workOrders.find((item) => item.status === '加工中')
const waitHandover = workOrders.find((item) => item.status === '待交出')
assert(waitReceive, '缺少待领料特殊工艺演示工艺单')
assert(waitProcess, '缺少已入待加工仓特殊工艺演示工艺单')
assert(processing, '缺少加工中特殊工艺演示工艺单')
assert(waitHandover, '缺少待交出特殊工艺演示工艺单')

const receiveBinding = validateSpecialCraftMobileTaskBinding(waitReceive!.workOrderId)
assert(receiveBinding.canOpenMobileExecution, '待领料特殊工艺工艺单未绑定可执行移动端任务')
const receiveResult = executeProcessWebAction({
  sourceType: 'SPECIAL_CRAFT_WORK_ORDER',
  sourceId: waitReceive!.workOrderId,
  actionCode: 'SPECIAL_CRAFT_RECEIVE_CUT_PIECES',
  operatorName: 'Web 端验收员',
  operatedAt: '2026-04-28 10:00',
  objectType: '裁片',
  objectQty: waitReceive!.planQty,
  qtyUnit: '片',
  fields: {
    接收人: 'Web 端验收员',
    接收时间: '2026-04-28 10:00',
    接收裁片数量: waitReceive!.planQty,
    关联菲票: waitReceive!.feiTicketNos.join('、'),
  },
  remark: '检查脚本确认接收裁片',
})
assert(receiveResult.success, 'Web 确认接收裁片未成功')
assert(getWarehouseRecordsByWorkOrderId(waitReceive!.workOrderId).some((record) => record.recordType === 'WAIT_PROCESS'), '确认接收后未生成待加工仓记录')

const processBinding = validateSpecialCraftMobileTaskBinding(waitProcess!.workOrderId)
assert(processBinding.canOpenMobileExecution, '已入待加工仓特殊工艺工艺单未绑定可执行移动端任务')
const mobileStart = executeMobileProcessAction({
  sourceType: 'SPECIAL_CRAFT',
  sourceId: waitProcess!.workOrderId,
  taskId: processBinding.actualTaskId,
  actionCode: 'SPECIAL_CRAFT_START_PROCESS',
  operatorName: '移动端验收员',
  operatedAt: '2026-04-28 10:10',
  objectType: '裁片',
  objectQty: waitProcess!.currentQty || waitProcess!.planQty,
  qtyUnit: '片',
  remark: '检查脚本移动端开始加工',
})
assert(mobileStart.success, '移动端开始加工未成功')

const processMobileRecords = getUnifiedOperationRecordsForProcessWorkOrder(
  'SPECIAL_CRAFT_WORK_ORDER',
  waitProcess!.workOrderId,
  processBinding.actualTaskId,
)
assert(processMobileRecords.some((record) => record.sourceChannel === '移动端'), '特殊工艺操作记录未合并移动端记录')

const processingBinding = validateSpecialCraftMobileTaskBinding(processing!.workOrderId)
const finishResult = executeMobileProcessAction({
  sourceType: 'SPECIAL_CRAFT',
  sourceId: processing!.workOrderId,
  taskId: processingBinding.actualTaskId,
  actionCode: 'SPECIAL_CRAFT_FINISH_PROCESS',
  operatorName: '移动端验收员',
  operatedAt: '2026-04-28 10:20',
  objectType: '裁片',
  objectQty: processing!.currentQty || processing!.planQty,
  qtyUnit: '片',
  remark: '检查脚本移动端完成加工',
})
assert(finishResult.success, '移动端完成加工未成功')
assert(getWarehouseRecordsByWorkOrderId(processing!.workOrderId).some((record) => record.recordType === 'WAIT_HANDOVER'), '完成加工后未生成待交出仓记录')

const handoverBinding = validateSpecialCraftMobileTaskBinding(waitHandover!.workOrderId)
const handoverResult = executeProcessWebAction({
  sourceType: 'SPECIAL_CRAFT_WORK_ORDER',
  sourceId: waitHandover!.workOrderId,
  actionCode: 'SPECIAL_CRAFT_SUBMIT_HANDOVER',
  operatorName: 'Web 端验收员',
  operatedAt: '2026-04-28 10:30',
  objectType: '裁片',
  objectQty: waitHandover!.currentQty || waitHandover!.planQty,
  qtyUnit: '片',
  fields: {
    交出人: 'Web 端验收员',
    交出时间: '2026-04-28 10:30',
    交出裁片数量: waitHandover!.currentQty || waitHandover!.planQty,
    关联菲票: waitHandover!.feiTicketNos.join('、'),
  },
  remark: '检查脚本发起交出',
})
assert(handoverResult.success, 'Web 发起交出未成功')
assert(getHandoverRecordsByWorkOrderId(waitHandover!.workOrderId).length > 0, '发起交出后未生成交出记录')

const differenceResult = executeMobileProcessAction({
  sourceType: 'SPECIAL_CRAFT',
  sourceId: processing!.workOrderId,
  taskId: processingBinding.actualTaskId,
  actionCode: 'SPECIAL_CRAFT_REPORT_DIFFERENCE',
  operatorName: '移动端验收员',
  operatedAt: '2026-04-28 10:40',
  objectType: '裁片',
  objectQty: 1,
  qtyUnit: '片',
  remark: '检查脚本上报特殊工艺差异',
})
assert(differenceResult.success, '移动端上报差异未成功')
const differenceRecords = getDifferenceRecordsByWorkOrderId(processing!.workOrderId)
assert(differenceRecords.some((record) => record.relatedFeiTicketIds.length > 0), '特殊工艺差异记录未关联菲票')

const platformViews = listPlatformSpecialCraftResultViews()
assert(platformViews.some((view) => view.processType === 'SPECIAL_CRAFT' && view.platformStatusLabel), '平台侧看不到特殊工艺结果')
const statistics = getSpecialCraftStatistics(waitHandover!.operationId)
assert(statistics.length > 0, '特殊工艺统计未读取统一事实源')

console.log('special craft web mobile action dialog and layout checks passed')
