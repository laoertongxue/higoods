#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import {
  ensureHandoverOrderForStartedTask,
  getHandoverOrderById,
  listHandoverOrdersByTaskId,
} from '../src/data/fcs/pda-handover-events.ts'
import { listPdaGenericProcessTasks } from '../src/data/fcs/pda-task-mock-factory.ts'
import {
  getPdaMobileExecutionTaskById,
  listPdaMobileExecutionTasks,
} from '../src/data/fcs/process-mobile-task-binding.ts'
import {
  getMobileExecutionTaskById,
  listMobileExecutionTasks,
} from '../src/data/fcs/mobile-execution-task-index.ts'
import {
  assignWaterSolubleFactory,
  listWaterSolubleWorkOrders,
  resetWaterSolubleDomainForChecks,
} from '../src/data/fcs/water-soluble-task-domain.ts'
import { getProcessTaskQtyDisplayMeta } from '../src/data/fcs/process-tasks.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

const ROOT = process.cwd()
const PAGE_PATH = path.join(ROOT, 'src/pages/pda-exec-detail.ts')
const PAGE_SOURCE = fs.readFileSync(PAGE_PATH, 'utf8')

function assertIncludes(token: string, message: string): void {
  assert(PAGE_SOURCE.includes(token), message)
}

function assertExcludes(token: string, message: string): void {
  assert(!PAGE_SOURCE.includes(token), message)
}

function legacyMobileCopy(...parts: string[]): string {
  return parts.join('')
}

function checkSourceCopy(): void {
  assertIncludes('任务二维码', '任务详情页未展示“任务二维码”')
  assertIncludes('查看交出单', '任务详情页缺少“查看交出单”')
  assertIncludes('新增交出记录', '任务详情页缺少“新增交出记录”')
  assertIncludes('ensureHandoverOrderForStartedTask', '任务详情页开工逻辑未接入 ensureHandoverOrderForStartedTask')
  assertIncludes('buildTaskQrValue', '任务详情页未使用 buildTaskQrValue 兜底任务二维码')
  assertIncludes('renderRealQrPlaceholder', '任务详情页未接入真实二维码渲染')
  assertIncludes('submittedQtyTotal', '任务详情页缺少交出单已交出汇总字段')
  assertIncludes('writtenBackQtyTotal', '任务详情页缺少交出单已收货汇总字段')
  assertIncludes('diffQtyTotal', '任务详情页缺少交出单差异汇总字段')
  assertIncludes('pendingWritebackCount', '任务详情页缺少交出单待收货汇总字段')
  assertIncludes('objectionCount', '任务详情页缺少交出单异议汇总字段')
  assertIncludes('报废数量', '任务详情页缺少特殊工艺报废数量')
  assertIncludes('货损数量', '任务详情页缺少特殊工艺货损数量')
  assertIncludes('完工后数量', '任务详情页缺少特殊工艺完工后数量')
  assertIncludes('绑定菲票', '任务详情页缺少特殊工艺绑定菲票')
  assertIncludes('原数量', '任务详情页缺少特殊工艺原数量')
  assertIncludes('当前数量', '任务详情页缺少特殊工艺当前数量')
  assertIncludes('linkSpecialCraftCompletionToReturnWaitHandoverStock', '特殊工艺完工未接入待交出仓 helper')
  assertIncludes('resolveSpecialCraftPdaObjectMeta', 'PDA 特殊工艺未按目标对象解析数量口径')
  assertIncludes('确认接收${escapeHtml(objectMeta.objectLabel)}', 'PDA 特殊工艺确认接收按钮未按目标对象展示')
  assertIncludes('objectType: objectMeta.objectType', 'PDA 特殊工艺写回未使用目标对象类型')
  assertIncludes('qtyUnit: objectMeta.qtyUnit', 'PDA 特殊工艺写回未使用目标对象单位')
  assertIncludes('无需绑定菲票', 'PDA 特殊工艺成衣/面料对象未展示无需菲票口径')

  ;[
    '去交接（待交出）',
    '发起交出单',
    legacyMobileCopy('印花', ' ', 'PDA'),
    legacyMobileCopy('染色', ' ', 'PDA'),
    legacyMobileCopy('印花', 'PDA'),
    legacyMobileCopy('染色', 'PDA'),
    legacyMobileCopy('交出', '头'),
    '后道内部记录',
    '折叠区',
    '>确认接收裁片</button>',
  ].forEach((token) => assertExcludes(token, `任务详情页仍残留禁用文案：${token}`))
}

function checkWaterSolubleRuntimeEntry(): void {
  resetWaterSolubleDomainForChecks()
  const order = listWaterSolubleWorkOrders().find((item) => item.productionOrderId === 'PO-202603-083')
    ?? listWaterSolubleWorkOrders()[0]
  assert(order, '缺少可用于 PDA 真实入口检查的独立水溶加工单')
  const assigned = assignWaterSolubleFactory(order.waterOrderId, 'F090')
  assert(assigned.ok, `水溶加工单测试分厂失败：${assigned.message}`)

  const rawTask = listPdaMobileExecutionTasks().find((task) => task.taskId === order.taskId)
  assert(rawTask, 'PDA 统一任务聚合入口缺少独立水溶领域任务')
  assert(rawTask.qty === order.plannedQty, 'PDA 水溶任务数量未使用 BOM 物料计划量')
  assert(rawTask.qtyDisplayUnit === order.qtyUnit, 'PDA 水溶任务未保留原 BOM 精确单位')
  assert(getPdaMobileExecutionTaskById(order.taskId)?.taskId === order.taskId, 'PDA 统一入口无法按 taskId 查询水溶任务')
  assert(getMobileExecutionTaskById(order.taskId)?.taskId === order.taskId, '移动任务索引无法按 taskId 查询水溶任务')
  assert(
    listMobileExecutionTasks({ currentFactoryId: 'F090', includeCompleted: true }).some((task) => task.taskId === order.taskId),
    '已分厂水溶任务未进入当前工厂移动执行列表',
  )

  const artifactTasks = listPdaMobileExecutionTasks().filter((task) => {
    if ((task as typeof task & { sourceArtifactId?: string }).sourceArtifactId === order.sourceArtifactId) return true
    return task.coveredProcesses?.some((process) => process.sourceArtifactIds.includes(order.sourceArtifactId))
  })
  assert(artifactTasks.length === 1, '同一独立水溶产物在 PDA 入口存在重复领域任务与通用 TASKGEN')
  assert(artifactTasks[0]?.taskId === order.taskId, '独立水溶产物未由正确领域任务替换通用 TASKGEN')

  const displayMeta = getProcessTaskQtyDisplayMeta(rawTask)
  assert(displayMeta.valueText.includes(`${order.plannedQty} ${order.qtyUnit}`), 'PDA 运行时数量展示未优先使用 BOM 物料数量与原单位')
}

function checkAutoCreateIdempotency(): void {
  const candidate = listPdaGenericProcessTasks().find((task) => task.startedAt && task.taskQrValue)
  assert(candidate, '未找到可用于校验交出单自动创建的已开工对外任务')

  const first = ensureHandoverOrderForStartedTask(candidate.taskId)
  const second = ensureHandoverOrderForStartedTask(candidate.taskId)
  assert(first.handoverOrderId === second.handoverOrderId, '交出单自动创建不是幂等的')

  const orders = listHandoverOrdersByTaskId(candidate.taskId)
  assert(orders.length === 1, '同一已开工任务生成了多个交出单')

  const order = getHandoverOrderById(first.handoverOrderId)
  assert(order, `未找到自动创建后的交出单：${first.handoverOrderId}`)
}

function checkPostCapacityNodesStayOut(): void {
  const postCapacityTasks = listPdaGenericProcessTasks().filter(
    (task) =>
      ['BUTTONHOLE', 'BUTTON_ATTACH', 'IRONING', 'PACKAGING'].includes(task.processBusinessCode || '')
      || ['PROC_BUTTONHOLE', 'PROC_BUTTON_ATTACH', 'PROC_IRON', 'PROC_PACK'].includes(task.processCode),
  )
  postCapacityTasks.forEach((task) => {
    assert(!task.taskQrValue, `后道产能节点不应有任务二维码：${task.taskId}`)
    assert(listHandoverOrdersByTaskId(task.taskId).length === 0, `后道产能节点不应生成交出单：${task.taskId}`)
  })
}

function main(): void {
  checkSourceCopy()
  checkAutoCreateIdempotency()
  checkPostCapacityNodesStayOut()
  checkWaterSolubleRuntimeEntry()
  console.log('check:pda-exec-task-detail passed')
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
}
