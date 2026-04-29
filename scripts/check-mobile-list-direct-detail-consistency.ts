import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { buildFcsCuttingDomainSnapshot } from '../src/domain/fcs-cutting-runtime/index.ts'
import { TEST_FACTORY_ID, TEST_FACTORY_NAME } from '../src/data/fcs/factory-mock-data.ts'
import { listDyeWorkOrders } from '../src/data/fcs/dyeing-task-domain.ts'
import {
  buildMobileExecutionListLocatePathForTask,
  getMobileExecutionTaskById,
  getMobileExecutionTaskByNo,
  getMobileExecutionTaskBySource,
  getMobileExecutionTaskSourceInfo,
  getMobileTaskTabKey,
  isMobileTaskVisibleForFactory,
  listMobileExecutionTasks,
  matchMobileTaskKeyword,
} from '../src/data/fcs/mobile-execution-task-index.ts'
import {
  getMobileTaskFactoryId,
  getPdaMobileExecutionTaskById,
  isTaskVisibleInMobileExecutionList,
  listPdaMobileExecutionTasks,
  validateCuttingOrderMobileTaskBinding,
  validateDyeWorkOrderMobileTaskBinding,
  validatePrintWorkOrderMobileTaskBinding,
  validateSpecialCraftMobileTaskBinding,
} from '../src/data/fcs/process-mobile-task-binding.ts'
import { listPrintWorkOrders } from '../src/data/fcs/printing-task-domain.ts'
import { listSpecialCraftTaskWorkOrders } from '../src/data/fcs/special-craft-task-orders.ts'

const root = process.cwd()

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`移动端列表与直达详情一致性检查失败：${message}`)
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

const modulePath = join(root, 'src/data/fcs/mobile-execution-task-index.ts')
assert(existsSync(modulePath), '缺少 src/data/fcs/mobile-execution-task-index.ts')
assert(typeof listMobileExecutionTasks === 'function', '缺少 listMobileExecutionTasks')
assert(typeof getMobileExecutionTaskById === 'function', '缺少 getMobileExecutionTaskById')
assert(typeof getMobileExecutionTaskByNo === 'function', '缺少 getMobileExecutionTaskByNo')
assert(typeof getMobileExecutionTaskBySource === 'function', '缺少 getMobileExecutionTaskBySource')
assert(typeof matchMobileTaskKeyword === 'function', '缺少 matchMobileTaskKeyword')
assert(typeof getMobileTaskTabKey === 'function', '缺少 getMobileTaskTabKey')
assert(typeof isMobileTaskVisibleForFactory === 'function', '缺少 isMobileTaskVisibleForFactory')

assertIncludes('src/pages/pda-exec.ts', [
  'listMobileExecutionTasks',
  'matchMobileTaskKeyword',
  'getMobileTaskTabKey',
])
assertIncludes('src/pages/pda-exec-detail.ts', [
  'getMobileExecutionTaskById',
  'getMobileExecutionTaskBySource',
  '当前任务不属于当前工厂',
  '当前任务尚未接单，不能执行',
  '当前任务仍在报价或定标阶段，不能执行',
])

const allTasks = listPdaMobileExecutionTasks()
allTasks.forEach((task) => {
  assert(
    isMobileTaskVisibleForFactory(task, TEST_FACTORY_ID) === isTaskVisibleInMobileExecutionList(task, TEST_FACTORY_ID),
    `${task.taskId} 的列表可见性规则不一致`,
  )
})

const visibleTasks = listMobileExecutionTasks({ currentFactoryId: TEST_FACTORY_ID })
assert(visibleTasks.every((task) => getMobileTaskFactoryId(task) === TEST_FACTORY_ID), 'F090 列表不应返回非当前工厂任务')

const printOrders = listPrintWorkOrders()
const phOrder = printOrders.find((order) => order.printOrderNo === 'PH-20260328-001')
assert(phOrder, '缺少 PH-20260328-001')
const phBinding = validatePrintWorkOrderMobileTaskBinding(phOrder.printOrderId)
assert(phBinding.reasonCode === 'OK', `PH-20260328-001 绑定异常：${phBinding.reasonLabel}`)
const phTask = getPdaMobileExecutionTaskById(phBinding.actualTaskId)
assert(phTask, 'PH-20260328-001 对应任务缺失')
assert(getMobileExecutionTaskById(phBinding.actualTaskId)?.taskId === phBinding.actualTaskId, 'getMobileExecutionTaskById 无法读取 PH 对应任务')
assert(getMobileExecutionTaskByNo(phBinding.actualTaskNo)?.taskId === phBinding.actualTaskId, 'getMobileExecutionTaskByNo 无法读取 PH 对应任务')
assert(getMobileExecutionTaskBySource('PRINT_WORK_ORDER', phOrder.printOrderId)?.taskId === phBinding.actualTaskId, 'getMobileExecutionTaskBySource 无法定位印花任务')
assert(matchMobileTaskKeyword(phTask, 'PH-20260328-001'), 'PH-20260328-001 关键字无法命中对应任务')
assert(matchMobileTaskKeyword(phTask, phBinding.actualTaskNo), 'TASK-PRINT 关键字无法命中对应任务')
assert(listMobileExecutionTasks({ currentFactoryId: TEST_FACTORY_ID, keyword: 'PH-20260328-001' }).some((task) => task.taskId === phBinding.actualTaskId), '搜索 PH-20260328-001 无法返回对应任务')
assert(listMobileExecutionTasks({ currentFactoryId: TEST_FACTORY_ID, keyword: phBinding.actualTaskNo }).some((task) => task.taskId === phBinding.actualTaskId), '搜索印花任务号无法返回对应任务')

const dyeOrders = listDyeWorkOrders()
const dyeOrder = dyeOrders.find((order) => order.dyeOrderNo === 'DY-20260328-006')
assert(dyeOrder, '缺少 DY-20260328-006')
const dyeBinding = validateDyeWorkOrderMobileTaskBinding(dyeOrder.dyeOrderId)
assert(dyeBinding.reasonCode === 'OK', `DY-20260328-006 绑定异常：${dyeBinding.reasonLabel}`)
assert(listMobileExecutionTasks({ currentFactoryId: TEST_FACTORY_ID, keyword: 'DY-20260328-006' }).some((task) => task.taskId === dyeBinding.actualTaskId), '搜索染色加工单号无法返回对应任务')
assert(listMobileExecutionTasks({ currentFactoryId: TEST_FACTORY_ID, keyword: dyeBinding.actualTaskNo }).some((task) => task.taskId === dyeBinding.actualTaskId), '搜索染色任务号无法返回对应任务')

const cuttingSnapshot = buildFcsCuttingDomainSnapshot()
const cuttingOrder = cuttingSnapshot.originalCutOrders.find((order) => order.originalCutOrderNo === 'CUT-260314-087-02')
assert(cuttingOrder, '缺少 CUT-260314-087-02')
const cuttingBinding = validateCuttingOrderMobileTaskBinding(cuttingOrder.originalCutOrderId)
assert(cuttingBinding.reasonCode === 'OK', `CUT-260314-087-02 绑定异常：${cuttingBinding.reasonLabel}`)
assert(listMobileExecutionTasks({ currentFactoryId: TEST_FACTORY_ID, keyword: 'CUT-260314-087-02' }).some((task) => task.taskId === cuttingBinding.actualTaskId), '搜索原始裁片单号无法返回对应任务')
assert(listMobileExecutionTasks({ currentFactoryId: TEST_FACTORY_ID, keyword: cuttingBinding.actualTaskNo }).some((task) => task.taskId === cuttingBinding.actualTaskId), '搜索裁片任务号无法返回对应任务')

const specialWorkOrder = listSpecialCraftTaskWorkOrders().find((workOrder) => workOrder.operationName === '打揽')
assert(specialWorkOrder, '缺少打揽工艺单')
const specialBinding = validateSpecialCraftMobileTaskBinding(specialWorkOrder.workOrderId)
assert(specialBinding.reasonCode === 'OK', `特殊工艺绑定异常：${specialBinding.reasonLabel}`)
assert(listMobileExecutionTasks({ currentFactoryId: TEST_FACTORY_ID, keyword: specialWorkOrder.workOrderNo }).some((task) => task.taskId === specialBinding.actualTaskId), '搜索特殊工艺工艺单号无法返回对应任务')
assert(listMobileExecutionTasks({ currentFactoryId: TEST_FACTORY_ID, keyword: specialBinding.actualTaskNo }).some((task) => task.taskId === specialBinding.actualTaskId), '搜索特殊工艺任务号无法返回对应任务')
const specialTask = getMobileExecutionTaskById(specialBinding.actualTaskId)
assert(specialTask, '特殊工艺移动端任务不存在')
const specialInfo = getMobileExecutionTaskSourceInfo(specialTask)
assert(specialInfo.factoryName === TEST_FACTORY_NAME, '特殊工艺移动端任务工厂显示异常')

const printVisibleCount = listMobileExecutionTasks({ currentFactoryId: TEST_FACTORY_ID, processType: 'PRINT' }).length
const dyeVisibleCount = listMobileExecutionTasks({ currentFactoryId: TEST_FACTORY_ID, processType: 'DYE' }).length
const cuttingVisibleCount = listMobileExecutionTasks({ currentFactoryId: TEST_FACTORY_ID, processType: 'CUTTING' }).length
const specialVisibleCount = listMobileExecutionTasks({ currentFactoryId: TEST_FACTORY_ID, processType: 'SPECIAL_CRAFT' }).length
assert(printVisibleCount >= 3, `执行列表可见印花任务不足 3 条，当前 ${printVisibleCount}`)
assert(dyeVisibleCount >= 3, `执行列表可见染色任务不足 3 条，当前 ${dyeVisibleCount}`)
assert(cuttingVisibleCount >= 3, `执行列表可见裁片任务不足 3 条，当前 ${cuttingVisibleCount}`)
assert(specialVisibleCount >= 3, `执行列表可见特殊工艺任务不足 3 条，当前 ${specialVisibleCount}`)

assert(!visibleTasks.some((task) => task.taskId === 'TASK-PRINT-000713'), '报价任务 TASK-PRINT-000713 不得出现在执行列表')
assert(!visibleTasks.some((task) => task.taskId === 'TASK-PRINT-000714'), '待定标任务 TASK-PRINT-000714 不得出现在执行列表')
assert(!visibleTasks.some((task) => task.taskId === 'TASK-PRINT-000715'), '未接单任务 TASK-PRINT-000715 不得出现在执行列表')
assert(!visibleTasks.some((task) => task.taskId === 'TASK-DYE-000721'), '报价染色任务不得出现在执行列表')

visibleTasks.forEach((task) => {
  const backPath = buildMobileExecutionListLocatePathForTask(task, { currentFactoryId: TEST_FACTORY_ID })
  assert(backPath.startsWith('/fcs/pda/exec?tab='), `${task.taskId} 缺少可回到执行列表的路径`)
})

console.log('mobile list direct detail consistency checks passed')
