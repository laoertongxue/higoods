import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  executeMobileProcessAction,
  executeProcessAction,
  executePrintAction,
  executeDyeAction,
  executeCuttingAction,
  executeSpecialCraftAction,
  getProcessActionOperationRecordsBySource,
  getProcessActionOperationRecordsByTask,
  listProcessActionOperationRecords,
  validateProcessAction,
} from '../src/data/fcs/process-action-writeback-service.ts'
import { executeProcessWebAction, getProcessWebOperationRecordsBySource } from '../src/data/fcs/process-web-status-actions.ts'
import { validatePrintWorkOrderMobileTaskBinding } from '../src/data/fcs/process-mobile-task-binding.ts'
import { getPlatformStatusForProcessWorkOrder } from '../src/data/fcs/process-platform-status-adapter.ts'
import { getProcessWorkOrderById } from '../src/data/fcs/process-work-order-domain.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`移动端与 Web 共用写回检查失败：${message}`)
}

function assertIncludes(path: string, expected: string, message: string): void {
  const content = read(path)
  assert(content.includes(expected), `${message}：${path} 缺少 ${expected}`)
}

function assertNotIncludes(path: string, forbidden: string, message: string): void {
  const content = read(path)
  assert(!content.includes(forbidden), `${message}：${path} 不应出现 ${forbidden}`)
}

const servicePath = 'src/data/fcs/process-action-writeback-service.ts'
assert(existsSync(join(root, servicePath)), '缺少 process-action-writeback-service 模块')
assert(typeof executeProcessAction === 'function', '缺少 executeProcessAction')
assert(typeof executePrintAction === 'function', '缺少 executePrintAction')
assert(typeof executeDyeAction === 'function', '缺少 executeDyeAction')
assert(typeof executeCuttingAction === 'function', '缺少 executeCuttingAction')
assert(typeof executeSpecialCraftAction === 'function', '缺少 executeSpecialCraftAction')
assert(typeof executeMobileProcessAction === 'function', '缺少 executeMobileProcessAction')

assertIncludes(servicePath, 'ProcessActionOperationRecord', '缺少统一操作记录模型')
assertIncludes(servicePath, 'createProcessActionOperationRecord', '缺少统一操作记录创建函数')
assertIncludes(servicePath, 'listProcessActionOperationRecords', '缺少统一操作记录列表函数')
assertIncludes(servicePath, 'getProcessActionOperationRecordsBySource', '缺少按 sourceId 查询操作记录能力')
assertIncludes(servicePath, 'getProcessActionOperationRecordsByTask', '缺少按 taskId 查询操作记录能力')
assertIncludes(servicePath, 'sourceChannel', '操作记录必须包含 sourceChannel')
assertIncludes(servicePath, 'Web 端', '操作记录必须支持 Web 端来源')
assertIncludes(servicePath, '移动端', '操作记录必须支持移动端来源')
assertIncludes(servicePath, 'validatePrintWorkOrderMobileTaskBinding', '写回服务必须调用绑定校验')
assertIncludes(servicePath, 'validateProcessAction', '写回服务必须调用合法动作校验')
assertIncludes(servicePath, 'assertRequiredFields', '写回服务必须校验必填字段')
assertIncludes(servicePath, 'mapCraftStatusToPlatformStatus', '写回后必须可派生平台聚合状态')

assertIncludes('src/data/fcs/process-web-status-actions.ts', 'executeProcessAction', 'executeProcessWebAction 必须调用统一写回服务')
assertIncludes('src/pages/pda-exec-detail.ts', 'executeMobileProcessAction', '移动端详情必须调用移动端薄封装')
assertNotIncludes('src/pages/pda-exec-detail.ts', 'startPrintNode(', 'PDA 印花不得直接调用 startPrintNode')
assertNotIncludes('src/pages/pda-exec-detail.ts', 'finishPrintNode(', 'PDA 印花不得直接调用 finishPrintNode')
assertNotIncludes('src/pages/pda-exec-detail.ts', 'startDyeNode(', 'PDA 染色不得直接调用 startDyeNode')
assertNotIncludes('src/pages/pda-exec-detail.ts', 'finishDyeNode(', 'PDA 染色不得直接调用 finishDyeNode')
assertNotIncludes('src/pages/pda-exec-detail.ts', 'submitPrintHandover(', 'PDA 印花不得直接调用 submitPrintHandover')
assertNotIncludes('src/pages/pda-exec-detail.ts', 'submitDyeHandover(', 'PDA 染色不得直接调用 submitDyeHandover')
assertNotIncludes('src/pages/pda-exec-detail.ts', 'startSpecialCraftTask(', 'PDA 特殊工艺不得直接调用 startSpecialCraftTask')
assertNotIncludes('src/pages/pda-exec-detail.ts', 'finishSpecialCraftTask(', 'PDA 特殊工艺不得直接调用 finishSpecialCraftTask')

const canonicalActionCodes = [
  'PRINT_START_PRINTING',
  'PRINT_FINISH_PRINTING',
  'DYE_START_DYEING',
  'DYE_FINISH_PACKING',
  'CUTTING_START_SPREADING',
  'SPECIAL_CRAFT_START_PROCESS',
]
for (const code of canonicalActionCodes) {
  assertIncludes(servicePath, code, `统一写回服务缺少 ${code}`)
  const mobileSource = code.startsWith('CUTTING_') ? 'src/pages/pda-cutting-spreading.ts' : 'src/pages/pda-exec-detail.ts'
  assertIncludes(mobileSource, code, `移动端缺少 ${code}`)
}
assertIncludes('src/data/fcs/process-web-status-actions.ts', 'PRINT_START_PRINTING', 'Web 印花动作必须使用统一 actionCode')
assertIncludes('src/data/fcs/process-web-status-actions.ts', 'DYE_START_DYEING', 'Web 染色动作必须使用统一 actionCode')
assertIncludes('src/data/fcs/process-web-status-actions.ts', 'CUTTING_START_SPREADING', 'Web 裁片动作必须使用统一 actionCode')
assertIncludes('src/data/fcs/process-web-status-actions.ts', 'SPECIAL_CRAFT_START_PROCESS', 'Web 特殊工艺动作必须使用统一 actionCode')

const binding = validatePrintWorkOrderMobileTaskBinding('PWO-PRINT-011')
assert(binding.reasonCode === 'OK', `PWO-PRINT-011 绑定校验应有效：${binding.reasonLabel}`)

const invalidBeforeCount = listProcessActionOperationRecords().length
const invalidValidation = validateProcessAction({
  sourceChannel: 'Web 端',
  sourceType: 'PRINT',
  sourceId: 'PWO-PRINT-001',
  taskId: 'TASK-PRINT-000800',
  actionCode: 'PRINT_FINISH_TRANSFER',
  operatorName: '检查脚本',
  operatedAt: '2026-04-28 10:00',
  objectType: '面料',
  objectQty: 10,
  qtyUnit: '米',
})
assert(!invalidValidation.ok, '待花型状态不得完成转印')
try {
  executeProcessAction({
    sourceChannel: 'Web 端',
    sourceType: 'PRINT',
    sourceId: 'PWO-PRINT-001',
    taskId: 'TASK-PRINT-000800',
    actionCode: 'PRINT_FINISH_TRANSFER',
    operatorName: '检查脚本',
    operatedAt: '2026-04-28 10:00',
    objectType: '面料',
    objectQty: 10,
    qtyUnit: '米',
  })
  assert(false, '非法动作不应写回')
} catch {
  assert(listProcessActionOperationRecords().length === invalidBeforeCount, '非法动作失败后不得生成操作记录')
}

const webResult = executeProcessWebAction({
  sourceType: 'PRINT_WORK_ORDER',
  sourceId: 'PWO-PRINT-011',
  actionCode: 'PRINT_START_PRINTING',
  operatorName: '检查脚本 Web',
  operatedAt: '2026-04-28 10:00',
  objectType: '面料',
  objectQty: 910,
  qtyUnit: '米',
  fields: { printerNo: 'CRAFT_2000001-F090' },
  remark: '检查脚本 Web 开始打印',
})
assert(webResult.success, 'Web 写回应成功')

const mobileResult = executeMobileProcessAction({
  sourceType: 'PRINT',
  sourceId: 'PWO-PRINT-011',
  taskId: webResult.updatedTaskId,
  actionCode: 'PRINT_FINISH_PRINTING',
  operatorName: '检查脚本移动端',
  operatedAt: '2026-04-28 10:30',
  objectType: '面料',
  objectQty: 900,
  qtyUnit: '米',
  remark: '检查脚本移动端完成打印',
})
assert(mobileResult.success, '移动端写回应成功')

const actionRecords = getProcessActionOperationRecordsBySource('PRINT', 'PWO-PRINT-011')
assert(actionRecords.some((record) => record.sourceChannel === 'Web 端' && record.actionCode === 'PRINT_START_PRINTING'), '统一操作记录必须包含 Web 端开始打印')
assert(actionRecords.some((record) => record.sourceChannel === '移动端' && record.actionCode === 'PRINT_FINISH_PRINTING'), '统一操作记录必须包含移动端完成打印')
assert(getProcessActionOperationRecordsByTask(webResult.updatedTaskId).length >= 2, '操作记录必须支持按 taskId 查询')

const webRecords = getProcessWebOperationRecordsBySource('PRINT_WORK_ORDER', 'PWO-PRINT-011')
assert(webRecords.some((record) => record.sourceChannel === 'Web 端'), 'Web 详情操作记录列表必须能展示 Web 端记录')
assert(webRecords.some((record) => record.sourceChannel === '移动端'), 'Web 详情操作记录列表必须能展示移动端记录')

const processOrder = getProcessWorkOrderById('PWO-PRINT-011')
assert(processOrder, '统一写回后应能读取平台侧加工单')
const platformStatus = getPlatformStatusForProcessWorkOrder(processOrder!)
assert(['加工中', '待送货', '准备中', '待回写', '待审核', '异常', '已完成'].includes(platformStatus.platformStatusLabel), '统一写回后平台聚合状态必须可派生')

assertNotIncludes(servicePath, '自由状态下拉', '不得出现自由状态下拉')
assertNotIncludes(servicePath, '任意跳', '不得允许任意跳转')
assertNotIncludes('src/data/fcs/process-action-writeback-service.ts', '开扣眼', '特殊工艺动作不得出现开扣眼')
assertNotIncludes('src/data/fcs/process-action-writeback-service.ts', '装扣子', '特殊工艺动作不得出现装扣子')
assertNotIncludes('src/data/fcs/process-action-writeback-service.ts', '熨烫', '特殊工艺动作不得出现熨烫')

assertIncludes('docs/fcs-shared-process-action-writeback.md', 'Web或移动端发起动作', '缺少统一写回文档流程图')
assertIncludes('docs/fcs-shared-process-action-writeback.md', '待操作', '缺少统一写回文档状态机')

console.log('shared process action writeback checks passed')
