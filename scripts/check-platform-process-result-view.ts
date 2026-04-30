import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  getPlatformFollowUpTasks,
  getPlatformProcessResultView,
  getPlatformRiskSummary,
  listPlatformCuttingResultViews,
  listPlatformDyeResultViews,
  listPlatformPrintResultViews,
  listPlatformProcessResultViews,
  listPlatformSpecialCraftResultViews,
  type PlatformProcessResultView,
} from '../src/data/fcs/platform-process-result-view.ts'
import { listPlatformStatusOptions, type PlatformProcessStatus } from '../src/data/fcs/process-platform-status-adapter.ts'
import { executeMobileProcessAction, executeProcessAction } from '../src/data/fcs/process-action-writeback-service.ts'
import { writeBackProcessHandoverRecord } from '../src/data/fcs/process-warehouse-domain.ts'
import { validatePrintWorkOrderMobileTaskBinding } from '../src/data/fcs/process-mobile-task-binding.ts'
import { listMobileExecutionTasks } from '../src/data/fcs/mobile-execution-task-index.ts'
import { getQuantityLabel } from '../src/data/fcs/process-quantity-labels.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`平台侧同步看结果检查失败：${message}`)
}

function assertIncludes(path: string, expected: string, message: string): void {
  const content = read(path)
  assert(content.includes(expected), `${message}：${path} 缺少 ${expected}`)
}

function assertNotIncludes(path: string, forbidden: string, message: string): void {
  const content = read(path)
  assert(!content.includes(forbidden), `${message}：${path} 不应出现 ${forbidden}`)
}

function assertAllowedStatus(view: PlatformProcessResultView): void {
  assert(
    listPlatformStatusOptions().includes(view.platformStatusLabel as PlatformProcessStatus),
    `${view.workOrderNo} 平台主状态不在允许集合：${view.platformStatusLabel}`,
  )
}

function assertCommonViewFields(view: PlatformProcessResultView): void {
  assert(view.platformStatusLabel, `${view.workOrderNo} 缺少 platformStatusLabel`)
  assert(view.factoryInternalStatusLabel, `${view.workOrderNo} 缺少 factoryInternalStatusLabel`)
  assert(view.platformRiskLabel, `${view.workOrderNo} 缺少 platformRiskLabel`)
  assert(view.platformActionHint, `${view.workOrderNo} 缺少 platformActionHint`)
  assert(view.platformOwnerHint, `${view.workOrderNo} 缺少 platformOwnerHint`)
  assert(view.quantityDisplayFields.length >= 6, `${view.workOrderNo} 缺少对象化数量字段`)
  assert(view.quantityDisplayFields.every((item) => item.label && item.unit && !['数量', '完成数量', '交出数量', '实收数量', '差异数量'].includes(item.label)), `${view.workOrderNo} 存在泛化数量文案`)
  assert(view.followUpActionCode && view.followUpActionLabel, `${view.workOrderNo} 缺少跟单动作`)
  assertAllowedStatus(view)
}

const modulePath = 'src/data/fcs/platform-process-result-view.ts'
assert(existsSync(join(root, modulePath)), '缺少 platform-process-result-view 模块')
assert(typeof getPlatformProcessResultView === 'function', '缺少 getPlatformProcessResultView')
assert(typeof listPlatformProcessResultViews === 'function', '缺少 listPlatformProcessResultViews')
assert(typeof listPlatformPrintResultViews === 'function', '缺少 listPlatformPrintResultViews')
assert(typeof listPlatformDyeResultViews === 'function', '缺少 listPlatformDyeResultViews')
assert(typeof listPlatformCuttingResultViews === 'function', '缺少 listPlatformCuttingResultViews')
assert(typeof listPlatformSpecialCraftResultViews === 'function', '缺少 listPlatformSpecialCraftResultViews')
assert(typeof getPlatformRiskSummary === 'function', '缺少 getPlatformRiskSummary')
assert(typeof getPlatformFollowUpTasks === 'function', '缺少 getPlatformFollowUpTasks')

const printWait = executeProcessAction({
  sourceChannel: 'Web 端',
  sourceType: 'PRINT',
  sourceId: 'PWO-PRINT-009',
  actionCode: 'PRINT_FINISH_TRANSFER',
  operatorName: '平台视图检查',
  operatedAt: '2026-04-28 14:00',
  objectType: '裁片',
  objectQty: 1010,
  qtyUnit: '片',
})
assert(Boolean(printWait.affectedWarehouseRecordId), '印花完成转印必须先形成待交出仓')

const printHandover = executeMobileProcessAction({
  sourceType: 'PRINT',
  sourceId: 'PWO-PRINT-005',
  actionCode: 'PRINT_SUBMIT_HANDOVER',
  operatorName: '平台视图检查',
  operatedAt: '2026-04-28 14:10',
  objectType: '裁片',
  objectQty: 930,
  qtyUnit: '片',
})
assert(Boolean(printHandover.affectedHandoverRecordId), '印花发起交出必须先形成交出记录')
writeBackProcessHandoverRecord(printHandover.affectedHandoverRecordId, {
  receiveObjectQty: 900,
  receivePerson: '平台视图检查接收方',
  receiveAt: '2026-04-28 14:20',
  remark: '印花回写差异用于平台异常展示',
})

const printWaitWritebackSourceId = 'PWO-PRINT-012'
for (const actionCode of [
  'PRINT_FINISH_PRINTING',
  'PRINT_START_TRANSFER',
  'PRINT_FINISH_TRANSFER',
  'PRINT_SUBMIT_HANDOVER',
] as const) {
  executeProcessAction({
    sourceChannel: 'Web 端',
    sourceType: 'PRINT',
    sourceId: printWaitWritebackSourceId,
    actionCode,
    operatorName: '平台视图检查',
    operatedAt: '2026-04-28 14:25',
    objectType: '裁片',
    objectQty: 100,
    qtyUnit: '片',
  })
}

const dyeWait = executeProcessAction({
  sourceChannel: 'Web 端',
  sourceType: 'DYE',
  sourceId: 'DWO-013',
  actionCode: 'DYE_FINISH_PACKING',
  operatorName: '平台视图检查',
  operatedAt: '2026-04-28 14:30',
  objectType: '面料',
  objectQty: 940,
  qtyUnit: '米',
})
assert(Boolean(dyeWait.affectedWarehouseRecordId), '染色完成包装必须先形成待交出仓')

const dyeHandover = executeMobileProcessAction({
  sourceType: 'DYE',
  sourceId: 'DWO-007',
  actionCode: 'DYE_SUBMIT_HANDOVER',
  operatorName: '平台视图检查',
  operatedAt: '2026-04-28 14:40',
  objectType: '面料',
  objectQty: 1100,
  qtyUnit: '米',
})
writeBackProcessHandoverRecord(dyeHandover.affectedHandoverRecordId, {
  receiveObjectQty: 1094,
  receivePerson: '平台视图检查接收方',
  receiveAt: '2026-04-28 14:45',
  remark: '染色回写差异用于平台异常展示',
})

const cuttingOrderId = 'CUT-260304-009-01'
for (const actionCode of [
  'CUTTING_START_SPREADING',
  'CUTTING_FINISH_SPREADING',
  'CUTTING_START_CUTTING',
  'CUTTING_FINISH_CUTTING',
  'CUTTING_GENERATE_FEI_TICKETS',
  'CUTTING_CONFIRM_INBOUND',
] as const) {
  executeProcessAction({
    sourceChannel: 'Web 端',
    sourceType: 'CUTTING',
    sourceId: cuttingOrderId,
    actionCode,
    operatorName: '平台视图检查',
    operatedAt: '2026-04-28 14:50',
    objectType: '裁片',
    objectQty: 2800,
    qtyUnit: '片',
  })
}

executeProcessAction({
  sourceChannel: '移动端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: 'SC-TASK-SC-OP-064-01-WO-001-',
  actionCode: 'SPECIAL_CRAFT_REPORT_DIFFERENCE',
  operatorName: '平台视图检查',
  operatedAt: '2026-04-28 15:10',
  objectType: '裁片',
  objectQty: 5,
  qtyUnit: '片',
  remark: '货损裁片数量 5 片',
})

const printViews = listPlatformPrintResultViews()
const dyeViews = listPlatformDyeResultViews()
const cuttingViews = listPlatformCuttingResultViews()
const specialViews = listPlatformSpecialCraftResultViews()
assert(printViews.length > 0, '印花平台结果视图为空')
assert(dyeViews.length > 0, '染色平台结果视图为空')
assert(cuttingViews.length > 0, '裁片平台结果视图为空')
assert(specialViews.length > 0, '特殊工艺平台结果视图为空')

;[...printViews, ...dyeViews, ...cuttingViews, ...specialViews].forEach(assertCommonViewFields)

const printWaitView = getPlatformProcessResultView('PRINT', 'PWO-PRINT-009')
assert(printWaitView?.platformStatusLabel === '待送货', 'Web 端印花完成转印后平台侧必须看到待送货')
assert(printWaitView.hasWaitHandoverRecord && printWaitView.latestWarehouseRecordId, '印花待送货必须能看到待交出仓记录')
assert(printWaitView.followUpActionLabel === '跟进工厂交出', '待送货必须给出跟进工厂交出动作')
assert(printWaitView.quantityDisplayFields.some((field) => field.label.includes('待交出') && field.label.includes('裁片')), '印花裁片待交出必须显示裁片数量')

const printDiffView = getPlatformProcessResultView('PRINT', 'PWO-PRINT-005')
assert(printDiffView?.platformStatusLabel === '异常', '印花回写差异后平台侧必须看到异常')
assert(printDiffView.hasDifferenceRecord && printDiffView.latestDifferenceRecordId, '印花异常必须能看到差异记录')
assert(['处理差异', '要求重新交出'].includes(printDiffView.followUpActionLabel), '印花异常必须给出差异处理动作')

const printWaitWritebackView = getPlatformProcessResultView('PRINT', printWaitWritebackSourceId)
assert(printWaitWritebackView?.platformStatusLabel === '待回写', '平台侧必须能展示待回写状态')
assert(printWaitWritebackView.followUpActionLabel === '跟进接收方回写', '待回写必须给出跟进接收方回写动作')
assert(printWaitWritebackView.platformOwnerHint === '接收方 / 仓库', '待回写责任方必须指向接收方或仓库')

const dyeWaitView = getPlatformProcessResultView('DYE', 'DWO-013')
assert(dyeWaitView?.platformStatusLabel === '待送货', 'Web 端染色完成包装后平台侧必须看到待送货')
assert(dyeWaitView.quantityDisplayFields.some((field) => field.label === '待交出面料米数'), '染色待送货必须显示待交出面料米数')
assert(dyeWaitView.quantityDisplayFields.some((field) => field.label === '卷数'), '染色平台侧必须显示卷数')

const dyeDiffView = getPlatformProcessResultView('DYE', 'DWO-007')
assert(dyeDiffView?.platformStatusLabel === '异常', '染色回写差异后平台侧必须看到异常')
assert(dyeDiffView.hasDifferenceRecord && dyeDiffView.latestDifferenceRecordId, '染色异常必须能看到差异记录')

const cuttingView = getPlatformProcessResultView('CUTTING', cuttingOrderId)
assert(cuttingView?.hasWaitHandoverRecord, '裁片确认入仓后平台侧必须看到待交出仓记录')
assert(cuttingView.quantityDisplayFields.some((field) => field.label.includes('裁片数量')), '裁片平台侧必须展示裁片数量')
assert(cuttingView.quantityDisplayFields.some((field) => field.label === '关联菲票数量'), '裁片平台侧必须展示关联菲票数量')

const specialDiffView = getPlatformProcessResultView('SPECIAL_CRAFT', 'SC-TASK-SC-OP-064-01-WO-001-')
assert(specialDiffView?.platformStatusLabel === '异常', '特殊工艺上报差异后平台侧必须看到异常')
assert(specialDiffView.hasDifferenceRecord && specialDiffView.latestDifferenceRecordId, '特殊工艺异常必须能看到差异记录')
assert(specialDiffView.quantityDisplayFields.some((field) => field.label === '绑定菲票数量'), '特殊工艺平台侧必须展示绑定菲票数量')

assert(getPlatformRiskSummary().totalCount >= printViews.length + dyeViews.length, '风险摘要必须覆盖平台结果视图')
assert(getPlatformFollowUpTasks().some((view) => view.followUpActionLabel === '跟进工厂交出'), '跟单任务必须包含跟进工厂交出')
assert(getPlatformFollowUpTasks().some((view) => view.followUpActionLabel === '跟进接收方回写'), '跟单任务必须包含跟进接收方回写')
assert(getPlatformFollowUpTasks().some((view) => ['处理审核', '处理差异'].includes(view.followUpActionLabel)), '跟单任务必须包含审核或差异处理')

assertIncludes('src/data/fcs/page-adapters/process-prep-pages-adapter.ts', 'getPlatformProcessResultView', '平台侧印花/染色 adapter 必须读取统一结果视图')
assertIncludes('src/pages/process-print-orders.ts', 'renderPlatformSyncSection', '平台侧印花页面必须展示同步结果')
assertIncludes('src/pages/process-print-orders.ts', 'followUpActionLabel', '平台侧印花页面必须展示跟单动作')
assertIncludes('src/pages/process-dye-orders.ts', 'renderPlatformSyncSection', '平台侧染色页面必须展示同步结果')
assertIncludes('src/pages/process-dye-orders.ts', 'followUpActionLabel', '平台侧染色页面必须展示跟单动作')
assertIncludes('src/pages/progress-board/task-domain.ts', 'listPlatformProcessResultViews', '任务进度看板必须读取统一结果视图')

for (const path of ['src/pages/process-print-orders.ts', 'src/pages/process-dye-orders.ts']) {
  assertIncludes(path, 'platformStatusLabel', '平台页面必须保留平台聚合状态字段')
  assertIncludes(path, 'factoryInternalStatusLabel', '平台页面必须展示工厂内部状态辅助字段')
  assertIncludes(path, 'platformRiskLabel', '平台页面必须展示风险提示')
  assertIncludes(path, 'platformActionHint', '平台页面必须展示下一步动作')
  assertIncludes(path, 'platformOwnerHint', '平台页面必须展示当前责任方')
  assertIncludes(path, 'latestWarehouseRecordId', '平台页面必须能看到仓记录')
  assertIncludes(path, 'latestHandoverRecordId', '平台页面必须能看到交出记录')
  assertIncludes(path, 'latestReviewRecordId', '平台页面必须能看到审核记录')
  assertIncludes(path, 'latestDifferenceRecordId', '平台页面必须能看到差异记录')
}

for (const forbidden of ['待花型', '待调色测试', '等打印', '打印中', '转印中']) {
  assertNotIncludes('src/pages/process-print-orders.ts', forbidden, '平台侧印花主页面不得硬编码印花细状态作为主状态')
}
for (const forbidden of ['待样衣', '待原料', '打样中', '待排缸', '染色中', '脱水中', '烘干中', '定型中', '打卷中', '包装中']) {
  assertNotIncludes('src/pages/process-dye-orders.ts', forbidden, '平台侧染色主页面不得硬编码染色细状态作为主状态')
}

assert(validatePrintWorkOrderMobileTaskBinding('PWO-PRINT-009').reasonCode === 'OK', '第 2 步绑定校验回退')
assert(listMobileExecutionTasks({ currentFactoryId: 'F090' }).some((task) => task.taskId === 'TASK-PRINT-000716'), '第 3 步移动端列表一致性回退')
assert(getQuantityLabel({ processType: 'PRINT', objectType: '裁片', qtyUnit: '片', qtyPurpose: '待交出' }) === '待交出裁片数量', '第 7 步数量文案回退')
assertIncludes('src/data/fcs/process-warehouse-linkage-service.ts', 'applyWarehouseLinkageAfterAction', '第 8 步仓交出联动回退')

assertNotIncludes('src/data/fcs/platform-process-result-view.ts', '开扣眼', '平台特殊工艺展示不得新增开扣眼')
assertNotIncludes('src/data/fcs/platform-process-result-view.ts', '装扣子', '平台特殊工艺展示不得新增装扣子')
assertNotIncludes('src/data/fcs/platform-process-result-view.ts', '熨烫', '平台特殊工艺展示不得新增熨烫')
assertNotIncludes('src/data/fcs/platform-process-result-view.ts', 'handoverRecords = [', '平台结果视图不得维护孤立交出数组')
assertIncludes('docs/fcs-platform-process-result-view.md', '平台结果视图读取统一事实源', '缺少本轮文档流程图')
assertIncludes('docs/fcs-platform-process-result-view.md', '发现差异记录', '缺少本轮文档异常流转')

console.log('platform process result view checks passed')
