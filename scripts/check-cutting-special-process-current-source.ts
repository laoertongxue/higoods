#!/usr/bin/env tsx

import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { listSpecialCraftTaskOrders } from '../src/data/fcs/special-craft-task-orders.ts'
import { buildBindingProcessOrders } from '../src/pages/process-factory/cutting/binding-strip-orders.ts'

const ROOT = process.cwd()
const SRC_ROOT = path.join(ROOT, 'src')

const retiredStorageKeys = [
  'cuttingSpecialProcessOrders',
  'cuttingSpecialProcessBindingPayloads',
  'cuttingSpecialProcessAuditTrail',
  'cuttingSpecialProcessScopeLines',
  'cuttingSpecialProcessExecutionLogs',
  'cuttingSpecialProcessFollowupActions',
]

const retiredSourceFiles = [
  'src/data/fcs/cutting/storage/special-processes-storage.ts',
  'src/pages/process-factory/cutting/special-processes-model.ts',
  'src/pages/process-factory/cutting/special-processes-domain.ts',
  'src/pages/process-factory/cutting/special-processes-projection.ts',
]

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) return listSourceFiles(absolutePath)
    return /\.(?:ts|tsx|js|mjs|cjs)$/.test(entry.name) ? [absolutePath] : []
  })
}

function findLiteralOccurrences(literal: string): string[] {
  return listSourceFiles(SRC_ROOT)
    .filter((filePath) => readFileSync(filePath, 'utf8').includes(literal))
    .map((filePath) => path.relative(ROOT, filePath))
}

function assertUnique(values: string[], label: string): void {
  assert.equal(new Set(values).size, values.length, `${label} 不唯一`)
}

function main(): void {
  retiredSourceFiles.forEach((relativePath) => {
    assert(!existsSync(path.join(ROOT, relativePath)), `旧裁床特殊工艺源文件仍存在：${relativePath}`)
  })
  retiredStorageKeys.forEach((storageKey) => {
    assert.deepEqual(findLiteralOccurrences(storageKey), [], `旧 localStorage 键仍被运行时代码读取或写入：${storageKey}`)
  })
  ;[
    'specialProcessState',
    'specialProcessView',
    'special-processes-model',
    'special-processes-domain',
    'special-processes-projection',
  ].forEach((legacyRuntimeToken) => {
    assert.deepEqual(findLiteralOccurrences(legacyRuntimeToken), [], `旧裁床特殊工艺投影仍有消费者：${legacyRuntimeToken}`)
  })

  assert.deepEqual(buildBindingProcessOrders([]), [], '无正式捆条需求时不得生成兜底捆条加工单')
  const bindingOrders = buildBindingProcessOrders()
  assert(bindingOrders.length > 0, '当前正式裁片事实未生成捆条加工单')
  assertUnique(bindingOrders.map((order) => order.bindingOrderId), '捆条加工单 ID')
  assertUnique(bindingOrders.map((order) => order.bindingOrderNo), '捆条加工单号')
  assert(
    bindingOrders.every((order) => order.processType === '捆条' && order.sourceCutOrderId && order.sourceTaskId),
    '捆条加工单必须全部来自专用裁片/任务绑定源',
  )

  const specialCraftOrders = listSpecialCraftTaskOrders()
  assert.equal(
    specialCraftOrders.filter((order) => order.craftName === '捆条').length,
    0,
    '通用辅助/特殊工艺流不得重复生成捆条加工单',
  )
  const buttonLoopOrders = specialCraftOrders.filter((order) => order.craftName === '盘扣')
  assert(buttonLoopOrders.length > 0, '专用盘扣流缺少可验证加工单')
  assert(
    buttonLoopOrders.every((order) =>
      order.businessType === 'BUTTON_LOOP'
      && order.targetObject === '捆条'
      && order.sourceTriggerLabel === '技术包捆条标记盘扣后自动生成'
      && order.buttonLoopInputLines?.length,
    ),
    '盘扣加工单必须全部来自专用捆条菲票投入流',
  )
  assertUnique(buttonLoopOrders.map((order) => order.taskOrderId), '盘扣加工单 ID')
  assertUnique(buttonLoopOrders.map((order) => order.taskOrderNo), '盘扣加工单号')

  console.log([
    '裁床特殊工艺当前执行源检查通过',
    `旧 localStorage 键：${retiredStorageKeys.length} 个均无读写`,
    `专用捆条加工单：${bindingOrders.length} 张，ID/单号唯一`,
    `专用盘扣加工单：${buttonLoopOrders.length} 张，未发现通用流重复单`,
  ].join('\n'))
}

main()
