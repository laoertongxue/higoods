import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  getMobileExecutionTaskById,
  listMobileExecutionTasks,
} from '../src/data/fcs/mobile-execution-task-index.ts'
import {
  getPostFinishingExecutionStatistics,
} from '../src/data/fcs/process-statistics-domain.ts'
import {
  executeMobileProcessAction,
  executeProcessAction,
  listProcessActionDefinitions,
  listProcessActionOperationRecords,
} from '../src/data/fcs/process-action-writeback-service.ts'
import {
  executeProcessWebAction,
  getAvailablePostFinishingWebActions,
  getUnifiedOperationRecordsForPostFinishing,
} from '../src/data/fcs/process-web-status-actions.ts'
import {
  listPostFinishingWorkOrders,
} from '../src/data/fcs/post-finishing-domain.ts'
import {
  validatePostFinishingMobileTaskBinding,
} from '../src/data/fcs/process-mobile-task-binding.ts'
import {
  listPlatformPostFinishingResultViews,
} from '../src/data/fcs/platform-process-result-view.ts'
import {
  listProcessHandoverDifferenceRecords,
  listProcessHandoverRecords,
  listWaitHandoverWarehouseRecords,
  listWaitProcessWarehouseRecords,
} from '../src/data/fcs/process-warehouse-domain.ts'

const root = process.cwd()
const forbiddenPostActionTerms = ['开扣眼', '装扣子', '熨烫', '包装']

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`后道三端操作闭环检查失败：${message}`)
}

function assertIncludes(path: string, expected: string, message: string): void {
  const content = read(path)
  assert(content.includes(expected), `${message}：${path} 缺少 ${expected}`)
}

function assertNotIncludes(path: string, forbidden: string, message: string): void {
  const content = read(path)
  assert(!content.includes(forbidden), `${message}：${path} 不应出现 ${forbidden}`)
}

const requiredFiles = [
  'src/pages/process-factory/post-finishing/work-order-detail.ts',
  'src/pages/process-factory/post-finishing/qc-orders.ts',
  'src/pages/process-factory/post-finishing/recheck-orders.ts',
  'src/pages/process-factory/post-finishing/events.ts',
  'src/pages/process-factory/shared/web-status-action-dialog.ts',
  'src/data/fcs/process-action-writeback-service.ts',
  'src/data/fcs/process-web-status-actions.ts',
  'src/data/fcs/process-warehouse-linkage-service.ts',
  'src/pages/pda-exec-detail.ts',
] as const

for (const file of requiredFiles) {
  assert(existsSync(join(root, file)), `缺少必要文件 ${file}`)
}

assertIncludes('src/data/fcs/process-action-writeback-service.ts', 'POST_FINISHING', '统一写回服务必须支持 POST_FINISHING')
assertIncludes('src/data/fcs/process-action-writeback-service.ts', 'executePostFinishingAction', '统一写回服务必须分派后道动作')
assertIncludes('src/data/fcs/process-web-status-actions.ts', 'POST_FINISHING_WORK_ORDER', 'Web 状态动作必须支持后道单')
assertIncludes('src/data/fcs/process-web-status-actions.ts', 'getAvailablePostFinishingWebActions', '必须存在后道可执行动作查询')
assertIncludes('src/data/fcs/process-web-status-actions.ts', 'getUnifiedOperationRecordsForPostFinishing', '必须存在后道统一操作记录查询')
assertIncludes('src/data/fcs/process-warehouse-linkage-service.ts', 'applyPostFinishingWarehouseLinkageAfterAction', '仓联动必须支持后道')
assertIncludes('src/data/fcs/process-warehouse-linkage-service.ts', 'POST_RECHECK_FINISH', '完成复检必须触发待交出仓联动')
assertIncludes('src/data/fcs/process-warehouse-linkage-service.ts', 'POST_SUBMIT_HANDOVER', '后道发起交出必须生成交出记录')
assertIncludes('src/data/fcs/process-warehouse-linkage-service.ts', 'POST_REPORT_DIFFERENCE', '后道上报差异必须生成差异记录')

assertIncludes('src/pages/process-factory/post-finishing/work-order-detail.ts', 'web-status-action-area', '后道详情必须存在可执行动作区域')
assertIncludes('src/pages/process-factory/post-finishing/work-order-detail.ts', 'open-web-status-action-dialog', '后道详情 Web 操作必须打开弹窗')
assertIncludes('src/pages/process-factory/post-finishing/qc-orders.ts', 'open-web-status-action-dialog', '质检单 Web 操作必须打开弹窗')
assertIncludes('src/pages/process-factory/post-finishing/recheck-orders.ts', 'open-web-status-action-dialog', '复检单 Web 操作必须打开弹窗')
assertIncludes('src/pages/process-factory/post-finishing/events.ts', 'openProcessWebStatusActionDialog', '后道事件必须复用通用弹窗')
assertIncludes('src/pages/process-factory/shared/web-status-action-dialog.ts', 'process-web-status-action-dialog', '通用弹窗必须有稳定 data-testid')
assertIncludes('src/pages/process-factory/shared/web-status-action-dialog.ts', 'executeProcessWebAction', '弹窗确认必须调用 executeProcessWebAction')
assertIncludes('src/pages/process-factory/shared/web-status-action-dialog.ts', '请填写', '弹窗必须校验必填字段')
assertIncludes('src/pages/process-factory/shared/web-status-action-dialog.ts', '必须填写数字', '弹窗必须校验数量字段')

assertIncludes('src/pages/process-factory/post-finishing/work-order-detail.ts', '操作记录', '后道详情记录标题必须为操作记录')
assertNotIncludes('src/pages/process-factory/post-finishing/work-order-detail.ts', 'Web 端操作记录', '后道详情不得使用 Web 端操作记录标题')
assertIncludes('src/pages/process-factory/post-finishing/work-order-detail.ts', 'sourceChannel', '后道详情操作记录必须展示来源')
assertIncludes('src/pages/pda-exec-detail.ts', 'executeMobileProcessAction', '移动端后道操作必须调用 executeMobileProcessAction')
assertIncludes('src/pages/pda-exec-detail.ts', 'POST_FINISHING', '移动端后道操作必须传 POST_FINISHING')
assertIncludes('src/pages/pda-exec-detail.ts', '操作记录', '移动端后道详情必须展示操作记录')

for (const term of forbiddenPostActionTerms) {
  assertNotIncludes('src/pages/process-factory/post-finishing/work-order-detail.ts', term, `后道详情动作不得出现 ${term}`)
  assertNotIncludes('src/pages/process-factory/post-finishing/qc-orders.ts', term, `质检单动作不得出现 ${term}`)
  assertNotIncludes('src/pages/process-factory/post-finishing/recheck-orders.ts', term, `复检单动作不得出现 ${term}`)
}

const definitions = listProcessActionDefinitions('POST_FINISHING')
const actionCodes = new Set(definitions.map((item) => item.actionCode))
for (const code of [
  'POST_RECEIVE_START',
  'POST_RECEIVE_FINISH',
  'POST_QC_START',
  'POST_QC_FINISH',
  'POST_PROCESS_START',
  'POST_PROCESS_FINISH',
  'POST_RECHECK_START',
  'POST_RECHECK_FINISH',
  'POST_SUBMIT_HANDOVER',
  'POST_REPORT_DIFFERENCE',
  'POST_REWORK_AFTER_REJECT',
]) {
  assert(actionCodes.has(code), `缺少后道动作定义 ${code}`)
}
assert(definitions.some((item) => item.actionLabel.includes('质检')), '必须存在质检动作定义')
assert(definitions.some((item) => item.actionLabel.includes('复检')), '必须存在复检动作定义')
assert(definitions.some((item) => item.requiredFields.some((field) => field.includes('成衣件数'))), '后道弹窗字段必须包含成衣件数')
assert(definitions.every((item) => forbiddenPostActionTerms.every((term) => !item.actionLabel.includes(term))), '后道动作定义不得混入开扣眼、装扣子、熨烫、包装')

const dedicatedOrder = listPostFinishingWorkOrders().find((order) => order.postOrderId === 'POST-WO-003')
assert(dedicatedOrder, '缺少专门后道工厂演示单 POST-WO-003')
const sewingDoneOrder = listPostFinishingWorkOrders().find((order) => order.postOrderId === 'POST-WO-103')
assert(sewingDoneOrder, '缺少车缝厂已做后道演示单 POST-WO-103')
assert(getAvailablePostFinishingWebActions(dedicatedOrder!.postOrderId).some((action) => action.actionCode === 'POST_PROCESS_START'), '专门后道工厂待后道状态必须允许开始后道')
assert(!getAvailablePostFinishingWebActions(sewingDoneOrder!.postOrderId).some((action) => action.actionCode === 'POST_PROCESS_START' || action.actionCode === 'POST_PROCESS_FINISH'), '车缝厂已做后道流程不得出现后道动作')

for (const order of listPostFinishingWorkOrders()) {
  const binding = validatePostFinishingMobileTaskBinding(order.postOrderId)
  assert(binding.reasonCode === 'OK', `${order.postOrderNo} 必须绑定有效移动端执行任务：${binding.reasonLabel}`)
  const task = getMobileExecutionTaskById(binding.actualTaskId || '')
  assert(task, `${order.postOrderNo} 绑定移动端任务不存在`)
  assert(listMobileExecutionTasks({ currentFactoryId: 'F090', keyword: order.postOrderNo }).some((item) => item.taskId === task!.taskId), `${order.postOrderNo} 必须能在移动端执行列表检索`)
}

const webStart = executeProcessWebAction({
  sourceType: 'POST_FINISHING_WORK_ORDER',
  sourceId: 'POST-WO-001',
  actionCode: 'POST_RECEIVE_START',
  operatorName: 'Web 端检查员',
  operatedAt: '2026-04-29 09:00',
  objectType: '成衣',
  objectQty: 260,
  qtyUnit: '件',
  formData: {
    操作人: 'Web 端检查员',
    开始时间: '2026-04-29 09:00',
  },
  remark: '检查 Web 后道弹窗写回',
})
assert(webStart.success, `Web 后道操作必须写回成功：${webStart.message}`)

const mobileFinishRecheck = executeMobileProcessAction({
  sourceType: 'POST_FINISHING',
  sourceId: 'POST-WO-010',
  taskId: 'TASK-POST-010',
  actionCode: 'POST_RECHECK_FINISH',
  actionLabel: '完成复检',
  operatorName: '移动端检查员',
  operatedAt: '2026-04-29 09:10',
  objectType: '成衣',
  objectQty: 420,
  qtyUnit: '件',
  formData: {
    复检人: '移动端检查员',
    完成时间: '2026-04-29 09:10',
    复检确认成衣件数: 420,
    复检不合格成衣件数: 0,
  },
  remark: '检查移动端完成复检',
})
assert(mobileFinishRecheck.success, `移动端后道完成复检必须写回成功：${mobileFinishRecheck.message}`)
assert(mobileFinishRecheck.affectedWarehouseRecordId, '完成复检后必须生成后道待交出仓记录')

const mobileHandover = executeMobileProcessAction({
  sourceType: 'POST_FINISHING',
  sourceId: 'POST-WO-005',
  taskId: 'TASK-POST-005',
  actionCode: 'POST_SUBMIT_HANDOVER',
  actionLabel: '发起交出',
  operatorName: '移动端检查员',
  operatedAt: '2026-04-29 09:20',
  objectType: '成衣',
  objectQty: 320,
  qtyUnit: '件',
  formData: {
    交出人: '移动端检查员',
    交出时间: '2026-04-29 09:20',
    交出成衣件数: 320,
  },
  remark: '检查移动端后道交出',
})
assert(mobileHandover.success, `移动端后道发起交出必须写回成功：${mobileHandover.message}`)
assert(mobileHandover.affectedHandoverRecordId, '发起交出后必须生成后道交出记录')

const diffResult = executeProcessAction({
  sourceChannel: 'Web 端',
  sourceType: 'POST_FINISHING',
  sourceId: 'POST-WO-008',
  taskId: 'TASK-POST-008',
  actionCode: 'POST_REPORT_DIFFERENCE',
  actionLabel: '上报差异',
  operatorName: 'Web 端检查员',
  operatedAt: '2026-04-29 09:30',
  objectType: '成衣',
  objectQty: 3,
  qtyUnit: '件',
  formData: {
    上报人: 'Web 端检查员',
    差异类型: '少收',
    应收成衣件数: 320,
    实收成衣件数: 317,
    差异成衣件数: 3,
    原因: '检查脚本差异',
  },
  remark: '检查后道差异',
})
assert(diffResult.success, `后道上报差异必须写回成功：${diffResult.message}`)
assert(diffResult.affectedDifferenceRecordId, '回写不一致或上报差异必须生成后道差异记录')

const unifiedRecords = getUnifiedOperationRecordsForPostFinishing('POST-WO-001', 'TASK-POST-001')
assert(unifiedRecords.some((record) => record.sourceChannel === 'Web 端'), '后道操作记录必须合并 Web 端记录')
assert(listProcessActionOperationRecords().some((record) => record.sourceType === 'POST_FINISHING' && record.sourceChannel === '移动端'), '后道操作记录必须包含移动端来源')
assert(listWaitProcessWarehouseRecords().some((record) => record.craftType === 'POST_FINISHING'), '后道必须能生成待加工仓记录')
assert(listWaitHandoverWarehouseRecords().some((record) => record.craftType === 'POST_FINISHING' && record.sourceWorkOrderId === 'POST-WO-010'), '完成复检后必须能看到后道待交出仓')
assert(listProcessHandoverRecords().some((record) => record.craftType === 'POST_FINISHING' && record.sourceWorkOrderId === 'POST-WO-005'), '后道发起交出后必须能看到统一交出记录')
assert(listProcessHandoverDifferenceRecords().some((record) => record.craftType === 'POST_FINISHING' && record.sourceWorkOrderId === 'POST-WO-008'), '后道差异必须进入统一差异记录')

const postViews = listPlatformPostFinishingResultViews()
assert(postViews.length >= listPostFinishingWorkOrders().length, '平台结果视图必须覆盖后道单')
assert(postViews.some((view) => view.platformStatusLabel === '异常' && view.hasDifferenceRecord), '平台侧必须能看到后道异常和差异记录')
assert(postViews.every((view) => view.quantityDisplayFields.some((field) => field.label.includes('成衣件数'))), '平台后道结果数量必须使用成衣件数')

const postStats = getPostFinishingExecutionStatistics({ factoryId: 'F090' })
assert(postStats.workOrderCount >= 1, '后道统计必须读取统一后道事实源')
assert(postStats.waitHandoverGarmentQty >= 0 && postStats.diffGarmentQty >= 0, '后道统计必须包含待交出和差异成衣件数')

assertIncludes('src/pages/process-factory/post-finishing/statistics.ts', '成衣件数', '后道统计页面必须显示成衣件数')
assertIncludes('src/data/fcs/process-statistics-domain.ts', 'filterWarehouseRecords', '后道统计必须读取统一仓交出差异事实源')
assertIncludes('src/data/fcs/process-action-writeback-service.ts', 'applyWarehouseLinkageAfterAction', 'executeProcessAction 成功后必须触发仓联动')
assertIncludes('src/data/fcs/process-action-writeback-service.ts', 'validateProcessAction', '统一写回前必须校验动作合法性')

console.log('post finishing web mobile action dialog checks passed')
