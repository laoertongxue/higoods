import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { listDyeWorkOrders } from '../src/data/fcs/dyeing-task-domain.ts'
import { getMobileExecutionTaskById, listMobileExecutionTasks } from '../src/data/fcs/mobile-execution-task-index.ts'
import { getPlatformProcessResultView } from '../src/data/fcs/platform-process-result-view.ts'
import {
  getMobileTaskAcceptanceState,
  getMobileTaskBiddingState,
  getMobileTaskExecutionState,
  isTaskVisibleInMobileExecutionList,
  validateDyeWorkOrderMobileTaskBinding,
  validatePrintWorkOrderMobileTaskBinding,
} from '../src/data/fcs/process-mobile-task-binding.ts'
import { getProcessWorkOrderById, listProcessWorkOrders } from '../src/data/fcs/process-work-order-domain.ts'
import {
  executeProcessWebAction,
  getUnifiedOperationRecordsForProcessWorkOrder,
} from '../src/data/fcs/process-web-status-actions.ts'
import { listPrintWorkOrders } from '../src/data/fcs/printing-task-domain.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`印花/染色操作弹窗与派单检查失败：${message}`)
}

function assertIncludes(path: string, expected: string, message: string): void {
  const content = read(path)
  assert(content.includes(expected), `${message}：${path} 缺少 ${expected}`)
}

function assertNotIncludes(path: string, forbidden: string, message: string): void {
  const content = read(path)
  assert(!content.includes(forbidden), `${message}：${path} 不应出现 ${forbidden}`)
}

function assertNoDirectWebActionNav(path: string): void {
  const content = read(path)
  assert(!/data-nav=["'][^"']*webAction=/.test(content), `${path} 不得通过 data-nav + webAction 作为主操作方式直接写回`)
}

const dialogPath = 'src/pages/process-factory/shared/web-status-action-dialog.ts'
assert(existsSync(join(root, dialogPath)), '缺少工艺 Web 状态操作弹窗模块')
assertIncludes(dialogPath, 'process-web-status-action-dialog', '弹窗缺少稳定 data-testid')
assertIncludes(dialogPath, 'process-web-status-action-field', '弹窗字段缺少稳定 data-testid')
assertIncludes(dialogPath, 'process-web-status-action-confirm', '弹窗确认按钮缺少稳定 data-testid')
assertIncludes(dialogPath, 'executeProcessWebAction', '弹窗确认后必须调用 executeProcessWebAction')
assertIncludes(dialogPath, '请填写', '弹窗必须校验必填字段')
assertIncludes(dialogPath, '必须填写数字', '弹窗必须校验数量字段')
assertIncludes(dialogPath, 'data-process-web-status-action-field', '弹窗字段必须按 requiredFields 动态生成')

const printDetailPath = 'src/pages/process-factory/printing/work-order-detail.ts'
const dyeDetailPath = 'src/pages/process-factory/dyeing/work-order-detail.ts'
const printEventsPath = 'src/pages/process-factory/printing/events.ts'
const dyeEventsPath = 'src/pages/process-factory/dyeing/events.ts'
assertIncludes(printDetailPath, 'open-web-status-action-dialog', '印花详情缺少操作弹窗触发能力')
assertIncludes(dyeDetailPath, 'open-web-status-action-dialog', '染色详情缺少操作弹窗触发能力')
assertIncludes(printEventsPath, 'openProcessWebStatusActionDialog', '印花事件未打开统一弹窗')
assertIncludes(dyeEventsPath, 'openProcessWebStatusActionDialog', '染色事件未打开统一弹窗')
assertIncludes(printDetailPath, '操作记录', '印花详情操作记录标题应为操作记录')
assertIncludes(dyeDetailPath, '操作记录', '染色详情操作记录标题应为操作记录')
assertIncludes(printDetailPath, 'getUnifiedOperationRecordsForProcessWorkOrder', '印花详情应合并 Web 端和移动端操作记录')
assertIncludes(dyeDetailPath, 'getUnifiedOperationRecordsForProcessWorkOrder', '染色详情应合并 Web 端和移动端操作记录')
assertIncludes(printDetailPath, '分配方式', '印花详情必须展示分配方式')
assertIncludes(dyeDetailPath, '分配方式', '染色详情必须展示分配方式')
assertIncludes(printDetailPath, '派单价格', '印花详情必须展示派单价格')
assertIncludes(dyeDetailPath, '派单价格', '染色详情必须展示派单价格')
assertNoDirectWebActionNav(printDetailPath)
assertNoDirectWebActionNav(dyeDetailPath)
assertNotIncludes(printDetailPath, 'Web 端操作记录', '印花详情不应再显示 Web 端操作记录')
assertNotIncludes(dyeDetailPath, 'Web 端操作记录', '染色详情不应再显示 Web 端操作记录')
assertNotIncludes(printDetailPath, '暂无 Web 端状态操作记录', '印花详情空状态文案不应局限 Web 端')
assertNotIncludes(dyeDetailPath, '暂无 Web 端状态操作记录', '染色详情空状态文案不应局限 Web 端')

assertIncludes('src/data/fcs/process-web-status-actions.ts', 'getUnifiedOperationRecordsForProcessWorkOrder', '缺少统一操作记录查询函数')
assertIncludes('src/data/fcs/process-web-status-actions.ts', 'getProcessActionOperationRecordsByTask', '统一操作记录必须按 taskId 合并移动端记录')
assertIncludes('src/data/fcs/process-web-status-actions.ts', 'executeProcessAction', 'executeProcessWebAction 必须调用统一写回服务')
assert(typeof executeProcessWebAction === 'function', 'executeProcessWebAction 必须可调用')
assert(typeof getUnifiedOperationRecordsForProcessWorkOrder === 'function', '统一操作记录查询函数必须可调用')

assertIncludes('src/data/fcs/printing-task-domain.ts', 'assignmentMode', 'PrintWorkOrder 缺少 assignmentMode')
assertIncludes('src/data/fcs/dyeing-task-domain.ts', 'assignmentMode', 'DyeWorkOrder 缺少 assignmentMode')
assertIncludes('src/data/fcs/process-work-order-domain.ts', 'assignmentMode', 'ProcessWorkOrder 缺少 assignmentMode')
assertIncludes('src/data/fcs/printing-task-domain.ts', 'dispatchPriceDisplay', 'PrintWorkOrder 缺少 dispatchPriceDisplay')
assertIncludes('src/data/fcs/dyeing-task-domain.ts', 'dispatchPriceDisplay', 'DyeWorkOrder 缺少 dispatchPriceDisplay')
assertIncludes('src/data/fcs/platform-process-result-view.ts', 'dispatchPriceDisplay', '平台结果视图缺少派单价格')

for (const order of listPrintWorkOrders()) {
  assert(order.assignmentMode === '派单', `${order.printOrderNo} 分配方式必须为派单`)
  assert(order.assignmentModeEditable === false, `${order.printOrderNo} 分配方式必须不可编辑`)
  assert(order.dispatchPriceCurrency === 'IDR', `${order.printOrderNo} 派单价格币种必须为 IDR`)
  assert(order.dispatchPriceUnit === 'Yard', `${order.printOrderNo} 派单价格单位必须为 Yard`)
  assert(order.dispatchPriceDisplay.includes('IDR/Yard'), `${order.printOrderNo} 派单价格必须展示 IDR/Yard`)
}

for (const order of listDyeWorkOrders()) {
  assert(order.assignmentMode === '派单', `${order.dyeOrderNo} 分配方式必须为派单`)
  assert(order.assignmentModeEditable === false, `${order.dyeOrderNo} 分配方式必须不可编辑`)
  assert(order.dispatchPriceCurrency === 'IDR', `${order.dyeOrderNo} 派单价格币种必须为 IDR`)
  assert(order.dispatchPriceUnit === 'Yard', `${order.dyeOrderNo} 派单价格单位必须为 Yard`)
  assert(order.dispatchPriceDisplay.includes('IDR/Yard'), `${order.dyeOrderNo} 派单价格必须展示 IDR/Yard`)
}

const processOrders = listProcessWorkOrders().filter((order) => order.processType === 'PRINT' || order.processType === 'DYE')
for (const order of processOrders) {
  assert(order.assignmentMode === '派单', `${order.workOrderNo} 统一加工单分配方式必须为派单`)
  assert(order.assignmentModeEditable === false, `${order.workOrderNo} 统一加工单分配方式必须不可编辑`)
  assert(order.dispatchPriceDisplay?.includes('IDR/Yard'), `${order.workOrderNo} 统一加工单派单价格必须展示 IDR/Yard`)
}

const visibleExecutionTasks = listMobileExecutionTasks({ currentFactoryId: 'F090' })

for (const order of listPrintWorkOrders()) {
  const binding = validatePrintWorkOrderMobileTaskBinding(order.printOrderId)
  assert(binding.canOpenMobileExecution, `${order.printOrderNo} 绑定移动端任务必须可打开执行页：${binding.reasonLabel}`)
  const task = getMobileExecutionTaskById(binding.actualTaskId)
  assert(task, `${order.printOrderNo} 绑定任务不存在：${binding.actualTaskId}`)
  assert(task!.assignmentMode !== 'BIDDING', `${order.printOrderNo} 绑定任务不得为 BIDDING`)
  assert(getMobileTaskBiddingState(task) === '非报价任务', `${order.printOrderNo} 绑定任务不得为报价或待定标`)
  assert(getMobileTaskAcceptanceState(task) === '已接单', `${order.printOrderNo} 绑定任务必须是已分配可执行状态`)
  assert(!['待接单', '待报价', '已报价', '待定标'].includes(getMobileTaskExecutionState(task)), `${order.printOrderNo} 绑定任务不得进入接单/竞价口径`)
  assert(isTaskVisibleInMobileExecutionList(task, 'F090'), `${order.printOrderNo} 绑定任务必须出现在执行列表`)
  assert(visibleExecutionTasks.some((item) => item.taskId === task!.taskId), `${order.printOrderNo} 执行列表检索不到绑定任务`)
}

for (const order of listDyeWorkOrders()) {
  const binding = validateDyeWorkOrderMobileTaskBinding(order.dyeOrderId)
  assert(binding.canOpenMobileExecution, `${order.dyeOrderNo} 绑定移动端任务必须可打开执行页：${binding.reasonLabel}`)
  const task = getMobileExecutionTaskById(binding.actualTaskId)
  assert(task, `${order.dyeOrderNo} 绑定任务不存在：${binding.actualTaskId}`)
  assert(task!.assignmentMode !== 'BIDDING', `${order.dyeOrderNo} 绑定任务不得为 BIDDING`)
  assert(getMobileTaskBiddingState(task) === '非报价任务', `${order.dyeOrderNo} 绑定任务不得为报价或待定标`)
  assert(getMobileTaskAcceptanceState(task) === '已接单', `${order.dyeOrderNo} 绑定任务必须是已分配可执行状态`)
  assert(!['待接单', '待报价', '已报价', '待定标'].includes(getMobileTaskExecutionState(task)), `${order.dyeOrderNo} 绑定任务不得进入接单/竞价口径`)
  assert(isTaskVisibleInMobileExecutionList(task, 'F090'), `${order.dyeOrderNo} 绑定任务必须出现在执行列表`)
  assert(visibleExecutionTasks.some((item) => item.taskId === task!.taskId), `${order.dyeOrderNo} 执行列表检索不到绑定任务`)
}

assertIncludes('src/data/fcs/pda-receive-scope.ts', "['印花', '染色']", '接单模块必须排除印花/染色')
assertIncludes('src/data/fcs/pda-receive-scope.ts', "'PRINT'", '接单模块必须按工艺编码排除印花')
assertIncludes('src/data/fcs/pda-receive-scope.ts', "'DYE'", '接单模块必须按工艺编码排除染色')

const printPlatformView = getPlatformProcessResultView('PRINT', 'PWO-PRINT-001')
const dyePlatformView = getPlatformProcessResultView('DYE', 'DWO-001')
assert(printPlatformView?.assignmentMode === '派单', '平台印花结果视图必须展示派单口径')
assert(printPlatformView?.dispatchPriceDisplay?.includes('IDR/Yard'), '平台印花结果视图必须展示 IDR/Yard 派单价格')
assert(dyePlatformView?.assignmentMode === '派单', '平台染色结果视图必须展示派单口径')
assert(dyePlatformView?.dispatchPriceDisplay?.includes('IDR/Yard'), '平台染色结果视图必须展示 IDR/Yard 派单价格')

const sampleProcessOrder = getProcessWorkOrderById('PWO-PRINT-011')
assert(sampleProcessOrder?.assignmentMode === '派单', '统一加工单事实源必须保留派单口径')

const webResult = executeProcessWebAction({
  sourceType: 'PRINT_WORK_ORDER',
  sourceId: 'PWO-PRINT-011',
  actionCode: 'PRINT_START_PRINTING',
  operatorName: '检查脚本',
  operatedAt: '2026-04-29 10:00',
  objectType: '面料',
  objectQty: 800,
  qtyUnit: '米',
  formData: {
    操作人: '检查脚本',
    打印机编号: 'PRN-01',
    开始时间: '2026-04-29 10:00',
  },
  remark: '检查脚本验证弹窗确认写回',
})
assert(webResult.success, `executeProcessWebAction 应成功调用 executeProcessAction：${webResult.message}`)
const records = getUnifiedOperationRecordsForProcessWorkOrder('PRINT_WORK_ORDER', 'PWO-PRINT-011', webResult.updatedTaskId)
assert(records.some((record) => record.sourceChannel === 'Web 端'), '统一操作记录必须包含 Web 端记录')
assert(records.every((record, index, list) => index === 0 || record.operatedAt <= list[index - 1].operatedAt), '统一操作记录必须按 operatedAt 倒序')

assertIncludes('docs/fcs-print-dye-web-action-dialog-and-dispatch.md', '分配方式固定为派单', '缺少本轮业务文档')
assertIncludes('docs/fcs-print-dye-web-action-dialog-and-dispatch.md', '操作记录合并 Web 端与移动端', '文档必须说明操作记录合并口径')

console.log('print dye web action dialog and dispatch checks passed')
