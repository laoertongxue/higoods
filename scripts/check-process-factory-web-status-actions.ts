import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  executeProcessWebAction,
  getAvailableCuttingWebActions,
  getAvailableDyeWebActions,
  getAvailablePrintWebActions,
  getAvailableSpecialCraftWebActions,
  getProcessWebOperationRecordsBySource,
  listAvailableWebActions,
  validateProcessWebAction,
} from '../src/data/fcs/process-web-status-actions.ts'
import { validatePrintWorkOrderMobileTaskBinding } from '../src/data/fcs/process-mobile-task-binding.ts'
import { getPlatformStatusForProcessWorkOrder } from '../src/data/fcs/process-platform-status-adapter.ts'
import { getProcessWorkOrderById } from '../src/data/fcs/process-work-order-domain.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function assertIncludes(path: string, expected: string, message: string): void {
  const content = read(path)
  assert(content.includes(expected), `${message}：${path} 缺少 ${expected}`)
}

function assertNotIncludes(path: string, forbidden: string, message: string): void {
  const content = read(path)
  assert(!content.includes(forbidden), `${message}：${path} 不应出现 ${forbidden}`)
}

const modulePath = 'src/data/fcs/process-web-status-actions.ts'
assert(existsSync(join(root, modulePath)), '缺少 process-web-status-actions 模块')
assertIncludes(modulePath, 'listAvailableWebActions', '缺少 listAvailableWebActions')
assertIncludes(modulePath, 'executeProcessWebAction', '缺少 executeProcessWebAction')
assertIncludes(modulePath, 'validateProcessWebAction', '缺少 validateProcessWebAction')
assertIncludes(modulePath, 'ProcessWebOperationRecord', '缺少 ProcessWebOperationRecord')
assertIncludes(modulePath, 'getAvailablePrintWebActions', '缺少 getAvailablePrintWebActions')
assertIncludes(modulePath, 'getAvailableDyeWebActions', '缺少 getAvailableDyeWebActions')
assertIncludes(modulePath, 'getAvailableCuttingWebActions', '缺少 getAvailableCuttingWebActions')
assertIncludes(modulePath, 'getAvailableSpecialCraftWebActions', '缺少 getAvailableSpecialCraftWebActions')
assertIncludes(modulePath, 'startPrintNode', '印花 Web 操作应复用或标注统一打印写回')
assertIncludes(modulePath, 'finishPrintNode', '印花 Web 操作应复用或标注统一打印写回')
assertIncludes(modulePath, 'startDyeNode', '染色 Web 操作应复用或标注统一染色写回')
assertIncludes(modulePath, 'finishDyeNode', '染色 Web 操作应复用或标注统一染色写回')
assertIncludes(modulePath, 'startSpecialCraftTask', '特殊工艺 Web 操作应复用或标注开始加工写回')
assertIncludes(modulePath, 'finishSpecialCraftTask', '特殊工艺 Web 操作应复用或标注完成加工写回')
assertIncludes(modulePath, 'sourceChannel', 'Web 操作记录必须包含来源')
assertIncludes(modulePath, 'Web 端', 'Web 操作记录来源必须为 Web 端')

assertIncludes('src/pages/process-factory/printing/work-order-detail.ts', '可执行动作', '印花详情页缺少可执行动作区域')
assertIncludes('src/pages/process-factory/dyeing/work-order-detail.ts', '可执行动作', '染色详情页缺少可执行动作区域')
assertIncludes('src/pages/process-factory/cutting/original-orders.ts', '可执行动作', '裁片详情缺少可执行动作区域')
assertIncludes('src/pages/process-factory/special-craft/work-order-detail.ts', '可执行动作', '特殊工艺详情页缺少可执行动作区域')
assertIncludes('src/pages/process-factory/printing/events.ts', 'executeProcessWebAction', '印花页面未接入 Web 操作执行')
assertIncludes('src/pages/process-factory/dyeing/events.ts', 'executeProcessWebAction', '染色页面未接入 Web 操作执行')
assertIncludes('src/pages/process-factory/cutting/original-orders.ts', 'executeProcessWebAction', '裁片页面未接入 Web 操作执行')
assertIncludes('src/pages/process-factory/special-craft/work-order-detail.ts', 'executeProcessWebAction', '特殊工艺页面未接入 Web 操作执行')

assertNotIncludes(modulePath, '任意状态', '不得提供自由状态跳转')
assertNotIncludes('src/pages/process-factory/printing/work-order-detail.ts', '<select name="status"', '印花详情不得提供自由状态下拉')
assertNotIncludes('src/pages/process-factory/dyeing/work-order-detail.ts', '<select name="status"', '染色详情不得提供自由状态下拉')
assertNotIncludes('src/pages/process-factory/special-craft/work-order-detail.ts', '<select name="status"', '特殊工艺详情不得提供自由状态下拉')
assertNotIncludes(modulePath, '开扣眼', '特殊工艺动作不得出现开扣眼')
assertNotIncludes(modulePath, '装扣子', '特殊工艺动作不得出现装扣子')
assertNotIncludes(modulePath, '熨烫', '特殊工艺动作不得出现熨烫')

const printBinding = validatePrintWorkOrderMobileTaskBinding('PWO-PRINT-001')
assert(printBinding.reasonCode === 'OK', '第 2 步绑定校验回退：PWO-PRINT-001 不再可执行')
const printActions = getAvailablePrintWebActions('PWO-PRINT-001')
assert(printActions.some((action) => action.actionLabel === '确认花型到位'), '印花待花型状态应可确认花型到位')
assert(!printActions.some((action) => action.actionLabel === '完成转印'), '印花待花型状态不得直接完成转印')

const printStartActions = getAvailablePrintWebActions('PWO-PRINT-011')
assert(printStartActions.some((action) => action.actionLabel === '开始打印'), '印花等打印状态应可开始打印')
const dyeActions = getAvailableDyeWebActions('DWO-012')
assert(dyeActions.some((action) => action.actionLabel === '开始染色' || action.actionLabel === '排染缸'), '染色待排缸状态应可排染缸或开始染色')
const cuttingActions = listAvailableWebActions('CUTTING_ORIGINAL_ORDER', 'ORIG-CUT-202603-001')
assert(Array.isArray(cuttingActions), '裁片动作查询应返回动作数组')
const specialActions = getAvailableSpecialCraftWebActions('SC-TASK-SC-OP-064-01-WO-001-')
assert(specialActions.some((action) => action.actionLabel === '完成加工' || action.actionLabel === '上报差异'), '特殊工艺加工中应可完成加工或上报差异')

const invalidValidation = validateProcessWebAction({
  sourceType: 'PRINT_WORK_ORDER',
  sourceId: 'PWO-PRINT-001',
  actionCode: 'PRINT_FINISH_TRANSFER',
  operatorName: '检查脚本',
  operatedAt: '2026-04-28 10:00',
  objectQty: 10,
  qtyUnit: '米',
})
assert(!invalidValidation.ok, '不得从待花型直接完成转印')

const result = executeProcessWebAction({
  sourceType: 'PRINT_WORK_ORDER',
  sourceId: 'PWO-PRINT-001',
  actionCode: 'PRINT_PATTERN_READY',
  operatorName: '检查脚本',
  operatedAt: '2026-04-28 10:00',
  remark: '检查脚本执行 Web 状态操作',
})
assert(result.success, 'Web 状态操作应执行成功')
const operationRecords = getProcessWebOperationRecordsBySource('PRINT_WORK_ORDER', 'PWO-PRINT-001')
assert(operationRecords.some((record) => record.sourceChannel === 'Web 端'), 'Web 操作必须生成来源为 Web 端的操作记录')

const processOrder = getProcessWorkOrderById('PWO-PRINT-001')
assert(processOrder, '执行后应能读取印花加工单事实源')
const platformStatus = getPlatformStatusForProcessWorkOrder(processOrder!)
assert(['准备中', '加工中', '待送货', '待回写', '待审核', '异常', '已完成'].includes(platformStatus.platformStatusLabel), '操作后平台聚合状态应可派生')

assertIncludes('docs/fcs-process-factory-web-status-actions.md', '工艺工厂Web详情', '缺少 Web 状态操作文档流程图')
assertIncludes('docs/fcs-process-factory-web-status-actions.md', '待操作', '缺少 Web 状态操作文档状态机')

console.log('process factory web status action checks passed')
