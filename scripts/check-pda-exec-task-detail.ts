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
  assertIncludes('writtenBackQtyTotal', '任务详情页缺少交出单已回写汇总字段')
  assertIncludes('diffQtyTotal', '任务详情页缺少交出单差异汇总字段')
  assertIncludes('pendingWritebackCount', '任务详情页缺少交出单待回写汇总字段')
  assertIncludes('objectionCount', '任务详情页缺少交出单异议汇总字段')

  ;[
    '去交接（待交出）',
    '去交接',
    '发起交出单',
    legacyMobileCopy('印花', ' ', 'PDA'),
    legacyMobileCopy('染色', ' ', 'PDA'),
    legacyMobileCopy('印花', 'PDA'),
    legacyMobileCopy('染色', 'PDA'),
    '交出头',
    '后道内部记录',
    '折叠区',
    '开扣眼',
    '装扣子',
    '钉扣',
    '熨烫',
    '机器数',
    '人数',
    '设备数',
  ].forEach((token) => assertExcludes(token, `任务详情页仍残留禁用文案：${token}`))
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
  console.log('check:pda-exec-task-detail passed')
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
}
