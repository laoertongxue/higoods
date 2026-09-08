#!/usr/bin/env tsx

import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import {
  RETURN_INBOUND_QC_CHAIN_SCENARIOS,
  returnInboundChainBatches,
} from '../src/data/fcs/return-inbound-quality-chain-facts.ts'
import {
  applyReturnInboundPassWriteback,
  createQcFromReturnInboundBatch,
} from '../src/data/fcs/return-inbound-workflow.ts'

const ROOT = process.cwd()
const SRC_ROOT = path.join(ROOT, 'src')
const retiredSourceType = 'DYE_PRINT_ORDER'

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) return listSourceFiles(absolutePath)
    return /\.(?:ts|tsx|js|mjs|cjs)$/.test(entry.name) ? [absolutePath] : []
  })
}

function main(): void {
  const retiredOccurrences = listSourceFiles(SRC_ROOT)
    .filter((filePath) => readFileSync(filePath, 'utf8').includes(retiredSourceType))
    .map((filePath) => path.relative(ROOT, filePath))
  assert.deepEqual(retiredOccurrences, [], `${retiredSourceType} 历史来源仍存在于运行时代码`)

  assert(
    RETURN_INBOUND_QC_CHAIN_SCENARIOS.every((scenario) =>
      scenario.sourceBusinessType === 'TASK'
      && scenario.sourceBusinessId === scenario.taskId,
    ),
    '回货质检场景必须以当前任务作为需求来源事实',
  )

  const printBatch = returnInboundChainBatches.find((batch) => batch.processType === 'PRINT')
  assert(printBatch?.sourceTaskId, '缺少印花回货批次专项样例')
  const qc = createQcFromReturnInboundBatch({
    inspections: [],
    batch: printBatch,
    productionOrderId: printBatch.productionOrderId,
    by: '专项检查',
    result: 'PASS',
  })
  assert.equal(qc.sourceBusinessType, 'TASK', '印花回货质检不得恢复旧染印单来源类型')
  assert.equal(qc.sourceBusinessId, printBatch.sourceTaskId, '印花回货质检必须关联当前任务 ID')
  assert.equal(qc.responsiblePartyType, 'PROCESSOR', '印花责任方必须由工序类型识别为加工方')
  assert.equal(qc.sourceOrderId, undefined, '回货质检不得继续写入旧染印加工单号')

  const allocationEvents: Parameters<typeof applyReturnInboundPassWriteback>[0]['allocationEvents'] = []
  const writeback = applyReturnInboundPassWriteback({
    batch: printBatch,
    allocationByTaskId: {},
    allocationEvents,
    by: '专项检查',
  })
  assert(writeback.ok, '印花回货合格数量写回失败')
  assert.equal(writeback.event.refType, 'RETURN_BATCH', '数量写回事件必须引用当前回货批次')
  assert.equal(writeback.event.refId, printBatch.batchId, '数量写回事件不得引用已删除的旧染印单号')

  console.log([
    '质量回货当前任务来源检查通过',
    `${retiredSourceType}：运行时代码 0 处`,
    `回货质检样例：${RETURN_INBOUND_QC_CHAIN_SCENARIOS.length} 条全部引用 TASK`,
    '印花 QC：加工方责任识别与 RETURN_BATCH 数量事件通过',
  ].join('\n'))
}

main()
