import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { executeMobileProcessAction } from '../src/data/fcs/process-action-writeback-service.ts'
import { executeProcessWebAction, getUnifiedOperationRecordsForProcessWorkOrder } from '../src/data/fcs/process-web-status-actions.ts'
import {
  getHandoverRecordsByWorkOrderId,
  getWarehouseRecordsByWorkOrderId,
} from '../src/data/fcs/process-warehouse-domain.ts'
import { validateSpecialCraftMobileTaskBinding } from '../src/data/fcs/process-mobile-task-binding.ts'
import { listSpecialCraftTaskOrders } from '../src/data/fcs/special-craft-task-orders.ts'
import { listPlatformSpecialCraftResultViews } from '../src/data/fcs/platform-process-result-view.ts'
import { buildTaskRouteCardBySource } from '../src/data/fcs/task-print-cards.ts'

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

const detailSource = read('src/pages/process-factory/special-craft/task-detail.ts')
const workOrderDetailRedirectSource = read('src/pages/process-factory/special-craft/work-order-detail.ts')
const taskDetailSource = read('src/pages/process-factory/special-craft/task-detail.ts')
const taskOrdersSource = read('src/pages/process-factory/special-craft/task-orders.ts')
const warehouseSource = read('src/pages/process-factory/special-craft/warehouse.ts')
const specialCraftSharedSource = read('src/pages/process-factory/special-craft/shared.ts')
const webActionsSource = read('src/data/fcs/process-web-status-actions.ts')
const writebackSource = read('src/data/fcs/process-action-writeback-service.ts')
const linkageSource = read('src/data/fcs/process-warehouse-linkage-service.ts')
const mobileSource = read('src/pages/pda-exec-detail.ts')
const platformSource = read('src/data/fcs/platform-process-result-view.ts')
const mainHandlersSource = read('src/main-handlers/fcs-handlers.ts')
const taskPrintCardsSource = read('src/data/fcs/task-print-cards.ts')

assert(workOrderDetailRedirectSource.includes('window.location.replace'), '加工单详情页已改为重定向到任务详情')
assert(workOrderDetailRedirectSource.includes('/tasks/'), '加工单详情页重定向目标必须是任务详情页')
assert(!/data-nav="[^"]*webAction/.test(workOrderDetailRedirectSource + detailSource), '特殊工艺页面仍存在 data-nav + webAction 直写')
assert(!detailSource.includes('applyWebActionFromUrl'), '特殊工艺页面仍保留 applyWebActionFromUrl 主操作入口')
assert(!detailSource.includes('document.body.insertAdjacentHTML'), '特殊工艺自定义弹窗不能挂到 body 外，避免 #app 事件委托不可达')
includesAll(mainHandlersSource, [
  '[data-special-craft-sku-confirm]',
  '[data-special-craft-fei-confirm]',
  '[data-special-craft-task-list-field]',
  'handleSpecialCraftTaskDetailEvent(target)',
  'handleSpecialCraftTaskOrdersEvent(target, event)',
], '特殊工艺主事件分发')
includesAll(detailSource, [
  'handleProcessWebStatusActionDialogEvent',
  'data-special-craft-web-action',
  'customConfirmNode',
  'renderGarmentSkuConfirmDialog',
  'renderCutPieceFeiTicketConfirmDialog',
], '特殊工艺任务详情')
assert(
  detailSource.indexOf('const customConfirmNode') < detailSource.indexOf('if (!actionNode && !customConfirmNode) return false')
    && detailSource.indexOf('if (actionNode) return true') < detailSource.indexOf('const skuConfirmNode'),
  '特殊工艺自定义确认按钮必须绕过 web action 提前返回，并进入 SKU/菲票提交处理',
)
includesAll(detailSource, ['基本信息', '菲票流转', '交出记录', '任务明细'], '特殊工艺任务详情内容')
assert(!detailSource.includes('差异异常'), '特殊工艺任务详情仍包含差异异常 Tab')
includesAll(specialCraftSharedSource, [
  'SPECIAL_CRAFT_CONFIRM_RECEIVE',
  'SPECIAL_CRAFT_PROCESS_REPORT',
  'SPECIAL_CRAFT_SUBMIT_HANDOVER',
  'SPECIAL_CRAFT_COMPLETE_ORDER',
  '实收件数',
  '完工件数',
  '交出件数',
  '回写数量',
], '特殊工艺自定义弹窗')
includesAll(webActionsSource, [
  'SPECIAL_CRAFT_CONFIRM_RECEIVE',
  'SPECIAL_CRAFT_PROCESS_REPORT',
  'SPECIAL_CRAFT_SUBMIT_HANDOVER',
  'SPECIAL_CRAFT_COMPLETE_ORDER',
], '特殊工艺 Web 动作定义')
includesAll(writebackSource, [
  "sourceType: 'SPECIAL_CRAFT'",
  'executeSpecialCraftAction',
  'SPECIAL_CRAFT_CONFIRM_RECEIVE',
  'SPECIAL_CRAFT_PROCESS_REPORT',
  'SPECIAL_CRAFT_COMPLETE_ORDER',
  'executeMobileProcessAction',
  'executeProcessAction',
], '统一写回服务')
includesAll(linkageSource, [
  'applySpecialCraftWarehouseLinkageAfterAction',
  'SPECIAL_CRAFT_CONFIRM_RECEIVE',
  'SPECIAL_CRAFT_PROCESS_REPORT',
  'SPECIAL_CRAFT_SUBMIT_HANDOVER',
  'relatedFeiTicketIds',
  'updatedFeiTicketIds',
], '特殊工艺仓交出联动')
includesAll(mobileSource, [
  'special-confirm-receive',
  'special-process-report',
  'special-submit-handover',
  'special-complete-order',
  'executeMobileProcessAction',
  "sourceType: 'SPECIAL_CRAFT'",
  '操作记录',
  '交出记录',
], '移动端特殊工艺详情')
assert(!mobileSource.includes('sourceId: specialCraftWorkOrder.workOrderId'), 'PDA 特殊工艺仍使用旧 workOrderId 写回')
assert(!mobileSource.includes('移动端确认接收'), 'PDA 通用开工分支仍自动写回特殊工艺确认接收')
assert(!`${webActionsSource}\n${writebackSource}\n${linkageSource}\n${mobileSource}`.match(/SPECIAL_CRAFT_GARMENT_WAREHOUSE_OUTBOUND|SPECIAL_CRAFT_RECEIVE_CUT_PIECES|SPECIAL_CRAFT_FINISH_PROCESS|SPECIAL_CRAFT_REPORT_DIFFERENCE|SPECIAL_CRAFT_REWORK_AFTER_REJECT|special-report-difference|special-rework-after-reject/), '特殊工艺旧动作仍有残留')
assert(!`${detailSource}\n${taskOrdersSource}\n${specialCraftSharedSource}\n${mobileSource}\n${taskPrintCardsSource}`.match(/接收裁片|开始加工|完成加工(?!单)|差异上报|驳回后重交|差异后重交/), '特殊工艺页面、PDA 或打印卡仍有旧中文动作节点')
includesAll(platformSource, [
  'listPlatformSpecialCraftResultViews',
  'SPECIAL_CRAFT',
  'latestHandoverRecordId',
  'latestDifferenceRecordId',
  'platformStatusLabel',
  'platformRiskLabel',
  'platformActionHint',
], '平台特殊工艺结果视图')
assert(!`${detailSource}\n${taskDetailSource}\n${taskOrdersSource}\n${warehouseSource}`.match(/开扣眼|装扣子|熨烫|包装/), '特殊工艺页面出现后道或染色包装动作文案')

const taskOrders = listSpecialCraftTaskOrders()
const waitReceive = taskOrders.find((item) => item.status === '待领料')
const processing = taskOrders.find((item) => item.status === '加工中')
const completed = taskOrders.find((item) => item.status === '已完结')
assert(waitReceive, '缺少待领料特殊工艺演示工艺单')
assert(processing, '缺少加工中特殊工艺演示工艺单')
assert(completed, '缺少已完结特殊工艺演示工艺单')
assert(listPlatformSpecialCraftResultViews().some((view) => view.sourceId === processing!.taskOrderId), '干净态平台侧找不到加工中特殊工艺结果')

function assertThrows(action: () => unknown, message: string): void {
  try {
    action()
  } catch {
    return
  }
  assert(false, message)
}

const receiveBinding = validateSpecialCraftMobileTaskBinding(waitReceive!.taskOrderId)
assert(receiveBinding.canOpenMobileExecution, '待领料特殊工艺工艺单未绑定可执行移动端任务')
assertThrows(() => executeProcessWebAction({
  sourceType: 'SPECIAL_CRAFT',
  sourceId: waitReceive!.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_CONFIRM_RECEIVE',
  operatorName: 'Web 端验收员',
  operatedAt: '2026-04-28 09:50',
  objectType: '裁片',
  objectQty: waitReceive!.planQty + 1,
  qtyUnit: '片',
}), '确认接收超计划数量没有被拦截')
const receiveResult = executeProcessWebAction({
  sourceType: 'SPECIAL_CRAFT',
  sourceId: waitReceive!.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_CONFIRM_RECEIVE',
  operatorName: 'Web 端验收员',
  operatedAt: '2026-04-28 10:00',
  objectType: '裁片',
  objectQty: waitReceive!.planQty,
  qtyUnit: '片',
  fields: {
    接收人: 'Web 端验收员',
    接收时间: '2026-04-28 10:00',
  },
  remark: '检查脚本确认接收',
})
assert(receiveResult.success, 'Web 确认接收未成功')
assert(getWarehouseRecordsByWorkOrderId(waitReceive!.taskOrderId).some((record) => record.recordType === 'WAIT_PROCESS'), '确认接收后未生成待加工仓记录')

const routeCard = buildTaskRouteCardBySource('SPECIAL_CRAFT_TASK_ORDER', waitReceive!.taskOrderId)
assert(routeCard.ok, '特殊工艺打印路线卡构建失败')
const routeNodes = routeCard.ok ? routeCard.card.routeRecords.map((record) => record.node) : []
;['确认接收', '加工填报', '发起交出', '完成加工单'].forEach((node) => assert(routeNodes.includes(node), `特殊工艺打印路线卡缺少 ${node}`))
assert(routeNodes.length === 4, '特殊工艺打印路线卡必须严格输出 4 个动作节点')
assert(new Set(routeNodes).size === 4, '特殊工艺打印路线卡动作节点不能重复')
assert(!routeNodes.some((node) => /接收裁片|开始加工|完成加工$|差异|异议|重交/.test(node)), '特殊工艺打印路线卡仍有旧节点')

const processingBinding = validateSpecialCraftMobileTaskBinding(processing!.taskOrderId)
assert(processingBinding.canOpenMobileExecution, '加工中特殊工艺工艺单未绑定可执行移动端任务')
assertThrows(() => executeMobileProcessAction({
  sourceType: 'SPECIAL_CRAFT',
  sourceId: processing!.taskOrderId,
  taskId: processingBinding.actualTaskId,
  actionCode: 'SPECIAL_CRAFT_PROCESS_REPORT',
  operatorName: '移动端验收员',
  operatedAt: '2026-04-28 10:05',
  objectType: '裁片',
  objectQty: processing!.receivedQty + 1,
  qtyUnit: '片',
}), '加工填报超已接收数量没有被拦截')
const mobileReport = executeMobileProcessAction({
  sourceType: 'SPECIAL_CRAFT',
  sourceId: processing!.taskOrderId,
  taskId: processingBinding.actualTaskId,
  actionCode: 'SPECIAL_CRAFT_PROCESS_REPORT',
  operatorName: '移动端验收员',
  operatedAt: '2026-04-28 10:10',
  objectType: '裁片',
  objectQty: processing!.currentQty || processing!.planQty,
  qtyUnit: '片',
  remark: '检查脚本移动端加工填报',
})
assert(mobileReport.success, '移动端加工填报未成功')

const processMobileRecords = getUnifiedOperationRecordsForProcessWorkOrder(
  'SPECIAL_CRAFT',
  processing!.taskOrderId,
  processingBinding.actualTaskId,
)
assert(processMobileRecords.some((record) => record.sourceChannel === '移动端'), '特殊工艺操作记录未合并移动端记录')
assert(getWarehouseRecordsByWorkOrderId(processing!.taskOrderId).some((record) => record.recordType === 'WAIT_HANDOVER'), '加工填报后未生成待交出仓记录')
assertThrows(() => executeProcessWebAction({
  sourceType: 'SPECIAL_CRAFT',
  sourceId: processing!.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_SUBMIT_HANDOVER',
  operatorName: 'Web 端验收员',
  operatedAt: '2026-04-28 10:25',
  objectType: '裁片',
  objectQty: processing!.planQty + 1,
  qtyUnit: '片',
}), '发起交出超已完工未交出数量没有被拦截')
assertThrows(() => executeMobileProcessAction({
  sourceType: 'SPECIAL_CRAFT',
  sourceId: processing!.taskOrderId,
  taskId: processingBinding.actualTaskId,
  actionCode: 'SPECIAL_CRAFT_COMPLETE_ORDER',
  operatorName: '移动端验收员',
  operatedAt: '2026-04-28 10:26',
  objectType: '裁片',
  objectQty: 0,
  qtyUnit: '片',
}), '未发起交出前完成加工单没有被拦截')

const handoverResult = executeProcessWebAction({
  sourceType: 'SPECIAL_CRAFT',
  sourceId: processing!.taskOrderId,
  actionCode: 'SPECIAL_CRAFT_SUBMIT_HANDOVER',
  operatorName: 'Web 端验收员',
  operatedAt: '2026-04-28 10:30',
  objectType: '裁片',
  objectQty: processing!.currentQty || processing!.planQty,
  qtyUnit: '片',
  fields: {
    交出人: 'Web 端验收员',
    交出时间: '2026-04-28 10:30',
  },
  remark: '检查脚本发起交出',
})
assert(handoverResult.success, 'Web 发起交出未成功')
assert(getHandoverRecordsByWorkOrderId(processing!.taskOrderId).length > 0, '发起交出后未生成交出记录')

const completeResult = executeMobileProcessAction({
  sourceType: 'SPECIAL_CRAFT',
  sourceId: processing!.taskOrderId,
  taskId: processingBinding.actualTaskId,
  actionCode: 'SPECIAL_CRAFT_COMPLETE_ORDER',
  operatorName: '移动端验收员',
  operatedAt: '2026-04-28 10:40',
  objectType: '裁片',
  objectQty: processing!.currentQty || processing!.planQty,
  qtyUnit: '片',
  remark: '检查脚本完成加工单',
})
assert(completeResult.success, '移动端完成加工单未成功')

const platformViews = listPlatformSpecialCraftResultViews()
assert(platformViews.some((view) => view.processType === 'SPECIAL_CRAFT' && view.platformStatusLabel), '平台侧看不到特殊工艺结果')
const processingPlatformView = platformViews.find((view) => view.sourceId === processing!.taskOrderId)
assert(processingPlatformView, '平台侧找不到刚执行的特殊工艺加工单结果')
assert(processingPlatformView?.latestHandoverRecordId, '平台侧特殊工艺结果未承接最新交出记录')
assert(processingPlatformView?.quantityDisplayFields.some((item) => item.label === '特殊工艺名称'), '平台侧特殊工艺结果缺少工艺名称字段')
assert(processingPlatformView?.quantityDisplayFields.some((item) => item.label === '绑定菲票数量'), '平台侧特殊工艺结果缺少绑定菲票数量字段')
console.log('special craft web mobile action dialog and layout checks passed')
