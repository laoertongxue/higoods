import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  applyCuttingWarehouseLinkageAfterAction,
  applyDyeWarehouseLinkageAfterAction,
  applyPrintWarehouseLinkageAfterAction,
  applySpecialCraftWarehouseLinkageAfterAction,
  applyWarehouseLinkageAfterAction,
} from '../src/data/fcs/process-warehouse-linkage-service.ts'
import {
  executeMobileProcessAction,
  executeProcessAction,
} from '../src/data/fcs/process-action-writeback-service.ts'
import {
  listProcessHandoverDifferenceRecords,
  listProcessHandoverRecords,
  listProcessWarehouseReviewRecords,
  listWaitHandoverWarehouseRecords,
  listWaitProcessWarehouseRecords,
  writeBackProcessHandoverRecord,
} from '../src/data/fcs/process-warehouse-domain.ts'
import { validatePrintWorkOrderMobileTaskBinding } from '../src/data/fcs/process-mobile-task-binding.ts'
import { listMobileExecutionTasks } from '../src/data/fcs/mobile-execution-task-index.ts'
import { mapCraftStatusToPlatformStatus } from '../src/data/fcs/process-platform-status-adapter.ts'
import { getQuantityLabel } from '../src/data/fcs/process-quantity-labels.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`待加工仓、待交出仓、交出、回写联动检查失败：${message}`)
}

function assertIncludes(path: string, expected: string, message: string): void {
  const content = read(path)
  assert(content.includes(expected), `${message}：${path} 缺少 ${expected}`)
}

function assertNotIncludes(path: string, forbidden: string, message: string): void {
  const content = read(path)
  assert(!content.includes(forbidden), `${message}：${path} 不应出现 ${forbidden}`)
}

function diffCountByHandover(handoverRecordId: string): number {
  return listProcessHandoverDifferenceRecords().filter((record) => record.handoverRecordId === handoverRecordId).length
}

const linkagePath = 'src/data/fcs/process-warehouse-linkage-service.ts'
const writebackPath = 'src/data/fcs/process-action-writeback-service.ts'

assert(existsSync(join(root, linkagePath)), '缺少 process-warehouse-linkage-service 模块')
assert(typeof applyWarehouseLinkageAfterAction === 'function', '缺少 applyWarehouseLinkageAfterAction')
assert(typeof applyPrintWarehouseLinkageAfterAction === 'function', '缺少 applyPrintWarehouseLinkageAfterAction')
assert(typeof applyDyeWarehouseLinkageAfterAction === 'function', '缺少 applyDyeWarehouseLinkageAfterAction')
assert(typeof applyCuttingWarehouseLinkageAfterAction === 'function', '缺少 applyCuttingWarehouseLinkageAfterAction')
assert(typeof applySpecialCraftWarehouseLinkageAfterAction === 'function', '缺少 applySpecialCraftWarehouseLinkageAfterAction')

assertIncludes(writebackPath, 'applyWarehouseLinkageAfterAction', 'executeProcessAction 成功后必须触发统一仓联动')
assertIncludes(writebackPath, 'linkage.createdWaitHandoverWarehouseRecordId', '统一写回结果必须合并待交出仓记录')
assertIncludes(writebackPath, 'linkage.createdHandoverRecordId', '统一写回结果必须合并交出记录')
assertIncludes(writebackPath, 'linkage.createdDifferenceRecordId', '统一写回结果必须合并差异记录')
assertIncludes(linkagePath, 'createWaitProcessWarehouseRecord', '联动服务必须能创建待加工仓记录')
assertIncludes(linkagePath, 'createWaitHandoverWarehouseRecord', '联动服务必须能创建待交出仓记录')
assertIncludes(linkagePath, 'createProcessHandoverRecord', '联动服务必须能创建交出记录')
assertIncludes(linkagePath, 'createProcessHandoverDifferenceRecord', '联动服务必须能创建差异记录')
assertIncludes(linkagePath, 'applySpecialCraftDifferenceToFeiTickets', '特殊工艺差异必须联动菲票')
assertIncludes(linkagePath, '菲票归属原始裁片单', '裁片联动必须声明菲票回落原始裁片单')
assertIncludes(linkagePath, 'CUTTING', '统一仓记录 craftType 必须支持裁片')

const printWaitResult = executeProcessAction({
  sourceChannel: 'Web 端',
  sourceType: 'PRINT',
  sourceId: 'PWO-PRINT-009',
  actionCode: 'PRINT_FINISH_TRANSFER',
  operatorName: '检查脚本',
  operatedAt: '2026-04-28 11:00',
  objectType: '裁片',
  objectQty: 1010,
  qtyUnit: '片',
})
assert(Boolean(printWaitResult.affectedWarehouseRecordId), '印花完成转印后必须生成待交出仓记录')
assert(listWaitHandoverWarehouseRecords({ craftType: 'PRINT', sourceWorkOrderId: 'PWO-PRINT-009' }).some((record) =>
  record.warehouseRecordId === printWaitResult.affectedWarehouseRecordId && record.objectType === '裁片' && record.qtyUnit === '片',
), '印花待交出仓必须记录对象和单位')

const printHandoverResult = executeProcessAction({
  sourceChannel: '移动端',
  sourceType: 'PRINT',
  sourceId: 'PWO-PRINT-005',
  actionCode: 'PRINT_SUBMIT_HANDOVER',
  operatorName: '检查脚本',
  operatedAt: '2026-04-28 11:10',
  objectType: '裁片',
  objectQty: 930,
  qtyUnit: '片',
})
assert(Boolean(printHandoverResult.affectedHandoverRecordId), '印花发起交出后必须生成交出记录')
const printHandover = listProcessHandoverRecords({ craftType: 'PRINT', sourceWorkOrderId: 'PWO-PRINT-005' }).find((record) =>
  record.handoverRecordId === printHandoverResult.affectedHandoverRecordId,
)
assert(printHandover?.qtyUnit === '片' && printHandover.objectType === '裁片', '印花交出记录必须保留裁片数量口径')

const beforeEqualDiffCount = diffCountByHandover(printHandoverResult.affectedHandoverRecordId)
writeBackProcessHandoverRecord(printHandoverResult.affectedHandoverRecordId, {
  receiveObjectQty: 930,
  receivePerson: '检查脚本接收方',
  receiveAt: '2026-04-28 11:20',
  remark: '实收一致',
})
assert(diffCountByHandover(printHandoverResult.affectedHandoverRecordId) === beforeEqualDiffCount, '印花回写一致时不得生成差异记录')

const printDiffResult = applyPrintWarehouseLinkageAfterAction({
  success: true,
  sourceChannel: 'Web 端',
  sourceType: 'PRINT',
  sourceId: 'PWO-PRINT-005',
  taskId: 'TASK-PRINT-000718',
  actionCode: 'PRINT_SUBMIT_HANDOVER',
  previousStatus: '待交出',
  nextStatus: '待回写',
  objectType: '裁片',
  objectQty: 930,
  qtyUnit: '片',
})
writeBackProcessHandoverRecord(printDiffResult.createdHandoverRecordId, {
  receiveObjectQty: 900,
  receivePerson: '检查脚本接收方',
  receiveAt: '2026-04-28 11:25',
  remark: '实收裁片数量差异',
})
assert(diffCountByHandover(printDiffResult.createdHandoverRecordId) > 0, '印花回写不一致时必须生成差异记录')

const dyeWaitResult = executeProcessAction({
  sourceChannel: 'Web 端',
  sourceType: 'DYE',
  sourceId: 'DWO-013',
  actionCode: 'DYE_FINISH_PACKING',
  operatorName: '检查脚本',
  operatedAt: '2026-04-28 11:30',
  objectType: '面料',
  objectQty: 940,
  qtyUnit: '米',
})
assert(Boolean(dyeWaitResult.affectedWarehouseRecordId), '染色完成包装后必须生成待交出仓记录')
assert(listWaitHandoverWarehouseRecords({ craftType: 'DYE', sourceWorkOrderId: 'DWO-013' }).some((record) =>
  record.warehouseRecordId === dyeWaitResult.affectedWarehouseRecordId && record.objectType === '面料' && record.qtyUnit === '米',
), '染色待交出仓必须使用面料米数')

const dyeHandoverResult = executeProcessAction({
  sourceChannel: '移动端',
  sourceType: 'DYE',
  sourceId: 'DWO-007',
  actionCode: 'DYE_SUBMIT_HANDOVER',
  operatorName: '检查脚本',
  operatedAt: '2026-04-28 11:40',
  objectType: '面料',
  objectQty: 1100,
  qtyUnit: '米',
})
assert(Boolean(dyeHandoverResult.affectedHandoverRecordId), '染色发起交出后必须生成交出记录')
const dyeBeforeDiff = diffCountByHandover(dyeHandoverResult.affectedHandoverRecordId)
writeBackProcessHandoverRecord(dyeHandoverResult.affectedHandoverRecordId, {
  receiveObjectQty: 1094,
  receivePerson: '检查脚本接收方',
  receiveAt: '2026-04-28 11:45',
  remark: '实收面料米数差异',
})
assert(diffCountByHandover(dyeHandoverResult.affectedHandoverRecordId) > dyeBeforeDiff, '染色回写不一致时必须生成差异记录')

const cuttingOrderId = 'CUT-260304-009-01'
for (const actionCode of [
  'CUTTING_START_SPREADING',
  'CUTTING_FINISH_SPREADING',
  'CUTTING_START_CUTTING',
  'CUTTING_FINISH_CUTTING',
  'CUTTING_GENERATE_FEI_TICKETS',
]) {
  executeProcessAction({
    sourceChannel: 'Web 端',
    sourceType: 'CUTTING',
    sourceId: cuttingOrderId,
    actionCode,
    operatorName: '检查脚本',
    operatedAt: '2026-04-28 12:00',
    objectType: '裁片',
    objectQty: 2800,
    qtyUnit: '片',
  })
}
const cuttingInboundResult = executeProcessAction({
  sourceChannel: 'Web 端',
  sourceType: 'CUTTING',
  sourceId: cuttingOrderId,
  actionCode: 'CUTTING_CONFIRM_INBOUND',
  operatorName: '检查脚本',
  operatedAt: '2026-04-28 12:10',
  objectType: '裁片',
  objectQty: 2800,
  qtyUnit: '片',
})
assert(Boolean(cuttingInboundResult.affectedWarehouseRecordId), '裁片确认入仓后必须生成待交出仓记录')
const cuttingWait = listWaitHandoverWarehouseRecords({ craftType: 'CUTTING', sourceWorkOrderId: cuttingOrderId }).find((record) =>
  record.warehouseRecordId === cuttingInboundResult.affectedWarehouseRecordId,
)
assert(Boolean(cuttingWait?.relatedFeiTicketIds.length), '裁片待交出仓必须关联菲票')
const cuttingHandoverResult = executeMobileProcessAction({
  sourceType: 'CUTTING',
  sourceId: cuttingOrderId,
  actionCode: 'CUTTING_SUBMIT_HANDOVER',
  operatorName: '检查脚本',
  operatedAt: '2026-04-28 12:20',
  objectType: '裁片',
  objectQty: 2800,
  qtyUnit: '片',
})
assert(Boolean(cuttingHandoverResult.affectedHandoverRecordId), '裁片发起交出后必须生成交出记录')
const cuttingHandover = listProcessHandoverRecords({ craftType: 'CUTTING', sourceWorkOrderId: cuttingOrderId }).find((record) =>
  record.handoverRecordId === cuttingHandoverResult.affectedHandoverRecordId,
)
assert(Boolean(cuttingHandover?.relatedFeiTicketIds.length), '裁片交出记录必须关联原始裁片单菲票')
writeBackProcessHandoverRecord(cuttingHandoverResult.affectedHandoverRecordId, {
  receiveObjectQty: 2790,
  receivePerson: '检查脚本接收方',
  receiveAt: '2026-04-28 12:30',
  remark: '裁片实收差异',
})
assert(listProcessHandoverDifferenceRecords({ craftType: 'CUTTING', sourceWorkOrderId: cuttingOrderId }).some((record) =>
  record.relatedFeiTicketIds.length > 0,
), '裁片差异必须可追溯菲票')

const specialReceiveResult = executeProcessAction({
  sourceChannel: 'Web 端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: 'SC-TASK-SC-OP-008-01-WO-001-',
  actionCode: 'SPECIAL_CRAFT_RECEIVE_CUT_PIECES',
  operatorName: '检查脚本',
  operatedAt: '2026-04-28 13:00',
  objectType: '裁片',
  objectQty: 180,
  qtyUnit: '片',
})
assert(Boolean(specialReceiveResult.affectedWarehouseRecordId), '特殊工艺确认接收后必须生成待加工仓记录')
assert(listWaitProcessWarehouseRecords({ craftType: 'SPECIAL_CRAFT', sourceWorkOrderId: 'SC-TASK-SC-OP-008-01-WO-001-' }).some((record) =>
  record.warehouseRecordId === specialReceiveResult.affectedWarehouseRecordId && record.relatedFeiTicketIds.length > 0,
), '特殊工艺待加工仓必须关联菲票')
executeProcessAction({
  sourceChannel: 'Web 端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: 'SC-TASK-SC-OP-008-01-WO-001-',
  actionCode: 'SPECIAL_CRAFT_START_PROCESS',
  operatorName: '检查脚本',
  operatedAt: '2026-04-28 13:05',
  objectType: '裁片',
  objectQty: 180,
  qtyUnit: '片',
})
const specialFinishResult = executeProcessAction({
  sourceChannel: '移动端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: 'SC-TASK-SC-OP-008-01-WO-001-',
  actionCode: 'SPECIAL_CRAFT_FINISH_PROCESS',
  operatorName: '检查脚本',
  operatedAt: '2026-04-28 13:20',
  objectType: '裁片',
  objectQty: 178,
  qtyUnit: '片',
})
assert(Boolean(specialFinishResult.affectedWarehouseRecordId), '特殊工艺完成加工后必须生成待交出仓记录')
const specialSubmitResult = executeProcessAction({
  sourceChannel: 'Web 端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: 'SC-TASK-SC-OP-008-01-WO-001-',
  actionCode: 'SPECIAL_CRAFT_SUBMIT_HANDOVER',
  operatorName: '检查脚本',
  operatedAt: '2026-04-28 13:30',
  objectType: '裁片',
  objectQty: 178,
  qtyUnit: '片',
})
assert(Boolean(specialSubmitResult.affectedHandoverRecordId), '特殊工艺发起交出后必须生成交出记录')
const specialDifferenceResult = executeProcessAction({
  sourceChannel: '移动端',
  sourceType: 'SPECIAL_CRAFT',
  sourceId: 'SC-TASK-SC-OP-064-01-WO-001-',
  actionCode: 'SPECIAL_CRAFT_REPORT_DIFFERENCE',
  operatorName: '检查脚本',
  operatedAt: '2026-04-28 13:40',
  objectType: '裁片',
  objectQty: 5,
  qtyUnit: '片',
  remark: '货损裁片数量 5 片',
})
assert(Boolean(specialDifferenceResult.affectedDifferenceRecordId), '特殊工艺上报差异后必须生成差异记录')
assert(listProcessHandoverDifferenceRecords({ craftType: 'SPECIAL_CRAFT', sourceWorkOrderId: 'SC-TASK-SC-OP-064-01-WO-001-' }).some((record) =>
  record.relatedFeiTicketIds.length > 0 && record.diffObjectQty === 5,
), '特殊工艺差异必须关联菲票并记录裁片数量变化')

assert(listProcessWarehouseReviewRecords().some((record) => record.handoverRecordId === dyeHandoverResult.affectedHandoverRecordId), '接收方回写后必须生成审核记录')
assert(validatePrintWorkOrderMobileTaskBinding('PWO-PRINT-009').reasonCode === 'OK', '第 2 步绑定校验回退')
assert(listMobileExecutionTasks({ currentFactoryId: 'F090' }).some((task) => task.taskId === 'TASK-PRINT-000716'), '第 3 步移动端列表一致性回退')
assert(mapCraftStatusToPlatformStatus({ processType: 'PRINT', craftStatusLabel: '待回写' }).platformStatusLabel === '待回写', '第 4 步平台状态映射回退')
assertIncludes('src/data/fcs/process-web-status-actions.ts', 'listAvailableWebActions', '第 5 步 Web 状态操作入口回退')
assert(getQuantityLabel({ processType: 'SPECIAL_CRAFT', objectType: '裁片', qtyUnit: '片', qtyPurpose: '差异' }) === '差异裁片数量', '第 7 步数量文案回退')

assertNotIncludes('src/pages/process-factory/special-craft/work-order-detail.ts', '开扣眼', '特殊工艺页面不得新增开扣眼动作')
assertNotIncludes('src/pages/process-factory/special-craft/work-order-detail.ts', '装扣子', '特殊工艺页面不得新增装扣子动作')
assertNotIncludes('src/pages/process-factory/special-craft/work-order-detail.ts', '熨烫', '特殊工艺页面不得新增熨烫动作')
assertNotIncludes(linkagePath, 'handoverRecords = [', '联动服务不得维护页面孤立交出数组')
assertNotIncludes(linkagePath, 'differenceRecords = [', '联动服务不得维护页面孤立差异数组')
assertIncludes('docs/fcs-process-warehouse-handover-linkage.md', 'Web或移动端执行动作', '缺少本轮文档流程图')
assertIncludes('docs/fcs-process-warehouse-handover-linkage.md', '待加工', '缺少本轮文档状态机')

console.log('process warehouse handover linkage checks passed')
