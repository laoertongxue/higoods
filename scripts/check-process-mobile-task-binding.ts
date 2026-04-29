import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { buildFcsCuttingDomainSnapshot } from '../src/domain/fcs-cutting-runtime/index.ts'
import { TEST_FACTORY_ID } from '../src/data/fcs/factory-mock-data.ts'
import { listDyeWorkOrders } from '../src/data/fcs/dyeing-task-domain.ts'
import {
  getMobileTaskBiddingState,
  getMobileTaskProcessType,
  getPdaMobileExecutionTaskById,
  isTaskAccepted,
  isTaskExecutable,
  isTaskInBiddingOrAwarding,
  isTaskVisibleInMobileExecutionList,
  listPdaMobileExecutionTasks,
  validateCuttingOrderMobileTaskBinding,
  validateDyeWorkOrderMobileTaskBinding,
  validatePrintWorkOrderMobileTaskBinding,
  validateProcessMobileTaskBinding,
  validateSpecialCraftMobileTaskBinding,
} from '../src/data/fcs/process-mobile-task-binding.ts'
import { listPrintWorkOrders } from '../src/data/fcs/printing-task-domain.ts'
import { listSpecialCraftTaskWorkOrders } from '../src/data/fcs/special-craft-task-orders.ts'

const root = process.cwd()

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`加工单与移动端任务绑定检查失败：${message}`)
  }
}

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assertIncludes(path: string, needles: string[]): void {
  const source = read(path)
  for (const needle of needles) {
    assert(source.includes(needle), `${path} 缺少 ${needle}`)
  }
}

function assertIncludesAny(path: string, groups: string[][]): void {
  const source = read(path)
  for (const group of groups) {
    assert(group.some((needle) => source.includes(needle)), `${path} 缺少 ${group.join(' / ')}`)
  }
}

const modulePath = join(root, 'src/data/fcs/process-mobile-task-binding.ts')
assert(existsSync(modulePath), '缺少 src/data/fcs/process-mobile-task-binding.ts')
assert(typeof validateProcessMobileTaskBinding === 'function', '缺少 validateProcessMobileTaskBinding')
assert(typeof validatePrintWorkOrderMobileTaskBinding === 'function', '缺少 validatePrintWorkOrderMobileTaskBinding')
assert(typeof validateDyeWorkOrderMobileTaskBinding === 'function', '缺少 validateDyeWorkOrderMobileTaskBinding')
assert(typeof validateCuttingOrderMobileTaskBinding === 'function', '缺少 validateCuttingOrderMobileTaskBinding')
assert(typeof validateSpecialCraftMobileTaskBinding === 'function', '缺少 validateSpecialCraftMobileTaskBinding')
assert(typeof isTaskVisibleInMobileExecutionList === 'function', '缺少 isTaskVisibleInMobileExecutionList')
assert(typeof isTaskExecutable === 'function', '缺少 isTaskExecutable')
assert(typeof isTaskAccepted === 'function', '缺少 isTaskAccepted')
assert(typeof isTaskInBiddingOrAwarding === 'function', '缺少 isTaskInBiddingOrAwarding')

const printOrders = listPrintWorkOrders()
const dyeOrders = listDyeWorkOrders()
const cuttingSnapshot = buildFcsCuttingDomainSnapshot()
const specialCraftWorkOrders = listSpecialCraftTaskWorkOrders()

const phOrder = printOrders.find((order) => order.printOrderNo === 'PH-20260328-001')
assert(phOrder, '缺少 PH-20260328-001')
const phBinding = validatePrintWorkOrderMobileTaskBinding(phOrder.printOrderId)
assert(phBinding.isTaskFound, 'PH-20260328-001 绑定任务不存在')
assert(phBinding.reasonCode === 'OK', `PH-20260328-001 绑定仍不可执行：${phBinding.reasonLabel}`)
assert(phBinding.actualTaskId !== 'TASK-PRINT-000713', 'PH-20260328-001 不得继续绑定 TASK-PRINT-000713')
assert(phBinding.actualTaskId !== 'TASK-PRINT-000714', 'PH-20260328-001 不得绑定报价阶段任务')
assert(phBinding.actualTaskId !== 'TASK-PRINT-000715', 'PH-20260328-001 不得绑定待接单任务')
assert(phBinding.isFactoryMatched, 'PH-20260328-001 绑定任务必须属于 F090')
assert(phBinding.isVisibleInMobileExecutionList, 'PH-20260328-001 绑定任务必须在移动端执行列表可见')

const phTask = getPdaMobileExecutionTaskById(phBinding.actualTaskId)
assert(phTask, 'PH-20260328-001 绑定任务必须可在统一任务源中找到')
assert(!isTaskInBiddingOrAwarding(phTask), 'PH-20260328-001 绑定任务不得处于报价 / 待定标阶段')
assert(isTaskAccepted(phTask), 'PH-20260328-001 绑定任务必须已接单')
assert(isTaskVisibleInMobileExecutionList(phTask, TEST_FACTORY_ID), 'PH-20260328-001 绑定任务必须在 F090 执行列表可见')

const printValidCount = printOrders
  .map((order) => validatePrintWorkOrderMobileTaskBinding(order.printOrderId))
  .filter((result) => result.reasonCode === 'OK')
  .length
assert(printValidCount >= 3, `印花加工单有效移动端绑定不足 3 条，当前 ${printValidCount}`)

const dyeValidCount = dyeOrders
  .map((order) => validateDyeWorkOrderMobileTaskBinding(order.dyeOrderId))
  .filter((result) => result.reasonCode === 'OK')
  .length
assert(dyeValidCount >= 3, `染色加工单有效移动端绑定不足 3 条，当前 ${dyeValidCount}`)

const cuttingValidCount = cuttingSnapshot.originalCutOrders
  .map((order) => validateCuttingOrderMobileTaskBinding(order.originalCutOrderId))
  .filter((result) => result.reasonCode === 'OK')
  .length
assert(cuttingValidCount >= 3, `裁片原始裁片单有效移动端绑定不足 3 条，当前 ${cuttingValidCount}`)

const specialCraftValidCount = specialCraftWorkOrders
  .filter((workOrder) => ['打揽', '打条', '捆条'].includes(workOrder.operationName))
  .map((workOrder) => validateSpecialCraftMobileTaskBinding(workOrder.workOrderId))
  .filter((result) => result.reasonCode === 'OK')
  .length
assert(specialCraftValidCount >= 3, `特殊工艺工艺单有效移动端绑定不足 3 条，当前 ${specialCraftValidCount}`)

const validPrintBindings = printOrders.map((order) => validatePrintWorkOrderMobileTaskBinding(order.printOrderId))
const validDyeBindings = dyeOrders.map((order) => validateDyeWorkOrderMobileTaskBinding(order.dyeOrderId))
assert(
  validPrintBindings.every((result) => result.reasonCode === 'OK'),
  '印花加工单已改为派单直入执行，所有印花加工单绑定应可执行',
)
assert(
  validDyeBindings.every((result) => result.reasonCode === 'OK'),
  '染色加工单已改为派单直入执行，所有染色加工单绑定应可执行',
)
assert(
  [...validPrintBindings, ...validDyeBindings].every((result) => !['TASK-PRINT-000713'].includes(result.actualTaskId)),
  '保留的报价 / 待定标样本不得作为印花 / 染色加工单绑定任务',
)
for (const result of [...validPrintBindings, ...validDyeBindings]) {
  const task = getPdaMobileExecutionTaskById(result.actualTaskId)
  assert(task, `${result.workOrderNo} 绑定任务缺失`)
  assert(!isTaskInBiddingOrAwarding(task), `${result.workOrderNo} 绑定任务不得处于报价 / 待定标阶段`)
  assert(isTaskAccepted(task), `${result.workOrderNo} 绑定任务必须已分配可执行`)
  assert(isTaskVisibleInMobileExecutionList(task, TEST_FACTORY_ID), `${result.workOrderNo} 绑定任务必须出现在执行列表`)
}

specialCraftWorkOrders
  .filter((workOrder) => ['打揽', '打条', '捆条'].includes(workOrder.operationName))
  .map((workOrder) => validateSpecialCraftMobileTaskBinding(workOrder.workOrderId))
  .filter((result) => result.reasonCode === 'OK')
  .forEach((result) => {
    const task = getPdaMobileExecutionTaskById(result.actualTaskId)
    assert(task, `${result.workOrderNo} 绑定任务缺失`)
    assert(getMobileTaskProcessType(task) === 'SPECIAL_CRAFT', `${result.workOrderNo} 绑定任务工艺类型错误`)
  })

assertIncludes('src/pages/process-factory/printing/work-order-detail.ts', [
  'validatePrintWorkOrderMobileTaskBinding',
  '绑定状态',
  '不可执行原因',
  '打开移动端执行页',
])
assertIncludes('src/pages/process-factory/dyeing/work-order-detail.ts', [
  'validateDyeWorkOrderMobileTaskBinding',
  '绑定状态',
  '不可执行原因',
  '打开移动端执行页',
])
assertIncludes('src/pages/process-factory/cutting/original-orders.ts', [
  'validateCuttingOrderMobileTaskBinding',
  '绑定状态',
  '打开移动端执行页',
])
assertIncludes('src/pages/process-factory/special-craft/work-order-detail.ts', [
  'validateSpecialCraftMobileTaskBinding',
  '绑定状态',
  '打开移动端执行页',
])
assertIncludesAny('src/pages/pda-exec.ts', [
  ['isTaskVisibleInMobileExecutionList', 'isMobileTaskVisibleForFactory', 'listMobileExecutionTasks'],
  ['listPdaMobileExecutionTasks', 'listMobileExecutionTasks'],
])
assertIncludes('src/pages/pda-exec-detail.ts', [
  'getMobileTaskAccessResult',
  '只允许只读查看',
])

const unifiedTasks = listPdaMobileExecutionTasks()
assert(unifiedTasks.some((task) => task.taskNo === 'TASK-SC-OP-008-0101'), '统一移动端任务源必须包含特殊工艺真实绑定任务号')
assert(!unifiedTasks.some((task) => task.taskId === 'TASK-PRINT-000713' && isTaskVisibleInMobileExecutionList(task, TEST_FACTORY_ID)), '报价中的印花任务不得进入执行列表')
assert(
  !unifiedTasks.some(
    (task) =>
      getMobileTaskProcessType(task) === 'DYE' &&
      ['待报价', '待定标'].includes(getMobileTaskBiddingState(task)) &&
      isTaskVisibleInMobileExecutionList(task, TEST_FACTORY_ID),
  ),
  '报价 / 待定标染色任务不得进入执行列表',
)

console.log('process mobile task binding checks passed')
