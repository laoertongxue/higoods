#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { cutPieceOrderRecords } from '../src/data/fcs/cutting/cut-piece-orders.ts'
import { listMergeBatchSourceRecords } from '../src/data/fcs/cutting/merge-batch-source.ts'
import {
  getPdaCuttingExecutionSourceRecord,
  listPdaCuttingExecutionSourceRecords,
  listPdaCuttingTaskSourceRecords,
} from '../src/data/fcs/cutting/pda-cutting-task-source.ts'
import {
  resolveCuttingTaskRef,
  resolveMergeBatchRef,
  resolveOriginalCutOrderRef,
  resolvePdaExecutionRef,
  resolveProductionOrderRef,
} from '../src/domain/cutting-core/index.ts'

const FORBIDDEN_GLOBAL_STRINGS = [
  'PRODUCTION_ORDER_NO_ALIASES',
  'PDA_CUTTING_TASK_IDENTITY_SEEDS',
]

const FORBIDDEN_FILE_SNIPPETS: Array<{ file: string; snippets: string[] }> = [
  {
    file: 'src/data/fcs/cutting/cut-piece-orders.ts',
    snippets: [
      'originalCutOrderId: record.cutPieceOrderNo',
      'originalCutOrderNo: record.cutPieceOrderNo',
    ],
  },
]

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function listTsFiles(rootDir: string): string[] {
  const result: string[] = []

  function walk(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const nextPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(nextPath)
        continue
      }
      if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        result.push(nextPath)
      }
    }
  }

  walk(path.resolve(rootDir))
  return result
}

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8')
}

function assertNoForbiddenStrings(): void {
  const files = listTsFiles('src')
  for (const filePath of files) {
    const source = readFile(filePath)
    for (const value of FORBIDDEN_GLOBAL_STRINGS) {
      assert(!source.includes(value), `${path.relative(process.cwd(), filePath)} 仍残留旧 identity 逻辑：${value}`)
    }
  }

  FORBIDDEN_FILE_SNIPPETS.forEach(({ file, snippets }) => {
    const source = readFile(path.resolve(file))
    snippets.forEach((snippet) => {
      assert(!source.includes(snippet), `${file} 仍残留旧默认回填逻辑：${snippet}`)
    })
  })
}

function assertDomainDoesNotImportPages(): void {
  const files = listTsFiles('src/domain/cutting-core')
  assert(!fs.existsSync(path.resolve('src/domain/cutting-identity')), 'src/domain/cutting-identity 应已退场')
  for (const filePath of files) {
    const source = readFile(filePath)
    assert(!source.includes('/pages/'), `${path.relative(process.cwd(), filePath)} 不应 import src/pages/**`)
    assert(!source.includes('../pages/'), `${path.relative(process.cwd(), filePath)} 不应反向依赖 pages`)
    assert(!source.includes('../../pages/'), `${path.relative(process.cwd(), filePath)} 不应反向依赖 pages`)
    assert(!source.includes('../../../pages/'), `${path.relative(process.cwd(), filePath)} 不应反向依赖 pages`)
  }
}

function assertCoreResolve(): void {
  const production = resolveProductionOrderRef({ productionOrderNo: 'PO-202603-081' })
  assert(production?.productionOrderId === 'PO-202603-081', '生产单 core resolve 失败：PO-202603-081')

  const original = resolveOriginalCutOrderRef({ originalCutOrderNo: 'CUT-260308-081-01' })
  assert(original?.productionOrderNo === 'PO-202603-081', '原始裁片单 core resolve 失败：CUT-260308-081-01')

  const mergeBatchSeed = listMergeBatchSourceRecords()[0]
  if (mergeBatchSeed) {
    const mergeBatch = resolveMergeBatchRef({ mergeBatchNo: mergeBatchSeed.mergeBatchNo })
    assert(mergeBatch?.mergeBatchId === mergeBatchSeed.mergeBatchId, `合并批次 core resolve 失败：${mergeBatchSeed.mergeBatchNo}`)
  }

  const task = resolveCuttingTaskRef({ taskId: 'TASK-CUT-000087' })
  assert(task?.productionOrderNo === 'PO-202603-081', '裁片任务 core resolve 失败：TASK-CUT-000087')
  assert(task?.originalCutOrderNos.length === 3, '裁片任务未正确绑定全部原始裁片单：TASK-CUT-000087')

  const execution = resolvePdaExecutionRef({
    taskId: 'TASK-CUT-000089',
    cutPieceOrderNo: 'CPO-20260319-C',
  })
  assert(execution?.originalCutOrderNo === 'CUT-260310-083-01', 'PDA 执行对象未正确绑定原始裁片单：TASK-CUT-000089 / CPO-20260319-C')

  const unboundExecution = resolvePdaExecutionRef({
    taskId: 'TASK-CUT-BID-201',
    cutPieceOrderNo: 'CPO-20260322-M',
  })
  assert(unboundExecution === null, '未绑定 PDA 执行对象不应伪装成已绑定对象：TASK-CUT-BID-201 / CPO-20260322-M')
}

function assertPdaSourceCoverage(): void {
  const taskIds = new Set(listPdaCuttingTaskSourceRecords().map((item) => item.taskId))
  assert(taskIds.has('TASK-CUT-BID-017'), 'PDA raw task source 缺少 TASK-CUT-BID-017')
  assert(taskIds.has('TASK-CUT-BID-201'), 'PDA raw task source 缺少 TASK-CUT-BID-201')

  listPdaCuttingExecutionSourceRecords().forEach((record) => {
    const resolvedTask = resolveCuttingTaskRef({ taskId: record.taskId })
    assert(resolvedTask, `PDA execution 所属任务未进入 core registry：${record.taskId}`)
    const resolvedRecord = getPdaCuttingExecutionSourceRecord(record.taskId, record.executionOrderNo)
    assert(Boolean(resolvedRecord), `PDA execution raw source 查询失败：${record.taskId} / ${record.executionOrderNo}`)

    const resolvedExecution = resolvePdaExecutionRef({
      taskId: record.taskId,
      cutPieceOrderNo: record.executionOrderNo,
    })

    if (record.bindingState === 'BOUND') {
      assert(Boolean(resolvedExecution), `已绑定 PDA execution 未能进入 core registry：${record.taskId} / ${record.executionOrderNo}`)
      assert(
        resolvedExecution?.originalCutOrderNo === record.originalCutOrderNo,
        `PDA execution 绑定原始裁片单不一致：${record.taskId} / ${record.executionOrderNo}`,
      )
      return
    }

    assert(!resolvedExecution, `未绑定 PDA execution 不应进入 core registry：${record.taskId} / ${record.executionOrderNo}`)
  })
}

function assertLegacyCutPieceOrdersExplicit(): void {
  assert(cutPieceOrderRecords.length > 0, 'legacy cut-piece-orders 数据为空，无法校验绑定状态')

  cutPieceOrderRecords.forEach((record) => {
    assert(
      record.bindingState === 'BOUND' || record.bindingState === 'UNBOUND_LEGACY',
      `legacy cut-piece-order 缺少明确 bindingState：${record.cutPieceOrderNo}`,
    )

    if (record.bindingState === 'BOUND') {
      assert(record.boundOriginalCutOrderId, `BOUND legacy cut-piece-order 缺少 boundOriginalCutOrderId：${record.cutPieceOrderNo}`)
      assert(record.boundOriginalCutOrderNo, `BOUND legacy cut-piece-order 缺少 boundOriginalCutOrderNo：${record.cutPieceOrderNo}`)
      assert(record.originalCutOrderNo === record.boundOriginalCutOrderNo, `BOUND legacy cut-piece-order 应回落到 canonical 原始裁片单号：${record.cutPieceOrderNo}`)
      return
    }

    assert(!record.boundOriginalCutOrderId, `UNBOUND_LEGACY 不应伪装绑定 originalCutOrderId：${record.cutPieceOrderNo}`)
    assert(!record.boundOriginalCutOrderNo, `UNBOUND_LEGACY 不应伪装绑定 originalCutOrderNo：${record.cutPieceOrderNo}`)
    assert(!record.boundMergeBatchId, `UNBOUND_LEGACY 不应伪装绑定 mergeBatchId：${record.cutPieceOrderNo}`)
    assert(!record.boundMergeBatchNo, `UNBOUND_LEGACY 不应伪装绑定 mergeBatchNo：${record.cutPieceOrderNo}`)
    assert(!record.originalCutOrderId, `UNBOUND_LEGACY 不应继续回填 originalCutOrderId：${record.cutPieceOrderNo}`)
    assert(!record.originalCutOrderNo, `UNBOUND_LEGACY 不应继续回填 originalCutOrderNo：${record.cutPieceOrderNo}`)
    assert(record.cutPieceOrderNo !== record.originalCutOrderNo, `CP-... 不得继续冒充原始裁片单号：${record.cutPieceOrderNo}`)
  })
}

function main(): void {
  assertNoForbiddenStrings()
  assertDomainDoesNotImportPages()
  assertCoreResolve()
  assertPdaSourceCoverage()
  assertLegacyCutPieceOrdersExplicit()

  console.log(
    JSON.stringify(
      {
        旧alias与seed删除: '通过',
        domain不反向依赖pages: '通过',
        core对象resolve: '通过',
        PDA执行绑定: '通过',
        legacy裁片单显式绑定状态: '通过',
      },
      null,
      2,
    ),
  )
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
