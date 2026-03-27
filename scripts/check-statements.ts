#!/usr/bin/env node

import fs from 'node:fs'
import process from 'node:process'
import { listPreSettlementLedgers } from '../src/data/fcs/pre-settlement-ledger-repository.ts'
import {
  buildStatementDraftLines,
  getStatementDetailViewModel,
  getStatementListItems,
  listStatementBuildScopes,
  listStatementEligibleLedgers,
} from '../src/data/fcs/store-domain-statement-source-adapter.ts'
import {
  createStatementFromEligibleLedgers,
  findOpenStatementByPartyAndCycle,
  getStatementById,
  listStatements,
} from '../src/data/fcs/store-domain-settlement-seeds.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function buildCheckStatementId(): string {
  return `ST-CHECK-${Date.now()}`
}

function main(): void {
  const candidateScopes = listStatementBuildScopes()
  const eligibleLedgers = candidateScopes.flatMap((scope) =>
    listStatementEligibleLedgers(scope.settlementPartyId, scope.settlementCycleId),
  )

  assert(eligibleLedgers.length > 0, '当前没有可生成对账单的正式流水候选')
  assert(
    eligibleLedgers.every((item) => item.sourceType === 'TASK_EARNING' || item.sourceType === 'QUALITY_DEDUCTION'),
    '候选池仍混入非正式流水来源',
  )
  assert(
    eligibleLedgers.every((item) => item.canEnterStatement && item.sourceStatus === 'OPEN'),
    '候选池仍混入不可入单或非 OPEN 状态的正式流水',
  )
  assert(
    eligibleLedgers
      .filter((item) => item.sourceType === 'QUALITY_DEDUCTION')
      .every((item) => Boolean(item.qcRecordId) && Boolean(item.pendingDeductionRecordId)),
    '质量扣款流水候选缺少正式追溯字段',
  )

  const statements = listStatements()
  const statementScopeKeys = new Set<string>()
  for (const statement of statements) {
    const key = `${statement.settlementPartyId}__${statement.settlementCycleId}`
    assert(!statementScopeKeys.has(key), `同一工厂同一周期出现多张对账单：${key}`)
    statementScopeKeys.add(key)
  }

  const ledgerBinding = new Map<string, string>()
  for (const statement of statements) {
    for (const ledgerId of statement.ledgerIds ?? []) {
      const existed = ledgerBinding.get(ledgerId)
      assert(!existed, `正式流水 ${ledgerId} 同时进入了两张对账单：${existed} / ${statement.statementId}`)
      ledgerBinding.set(ledgerId, statement.statementId)
    }
  }

  const mixedStatement = statements.find(
    (statement) => (statement.earningLedgerIds?.length ?? 0) > 0 && (statement.deductionLedgerIds?.length ?? 0) > 0,
  )
  assert(mixedStatement, '当前缺少同时包含任务收入流水与质量扣款流水的对账单样例')

  const mixedDetail = getStatementDetailViewModel(mixedStatement.statementId)
  assert(mixedDetail, '无法生成混合对账单详情视图')
  assert(mixedDetail.earningLines.length > 0, '对账单详情缺少任务收入流水明细')
  assert(mixedDetail.deductionLines.length > 0, '对账单详情缺少质量扣款流水明细')
  assert(
    Number((mixedDetail.totalEarningAmount - mixedDetail.totalQualityDeductionAmount).toFixed(2)) ===
      Number(mixedDetail.netPayableAmount.toFixed(2)),
    '对账单金额不是按正式流水逐条汇总得到',
  )

  const buildScope = candidateScopes.find(
    (scope) =>
      scope.earningLedgerCount > 0 &&
      scope.deductionLedgerCount > 0 &&
      findOpenStatementByPartyAndCycle(scope.settlementPartyId, scope.settlementCycleId) == null,
  )
  assert(buildScope, '缺少同时包含任务收入流水与质量扣款流水的待生成样例')

  const buildCandidates = listStatementEligibleLedgers(buildScope.settlementPartyId, buildScope.settlementCycleId)
  const buildLines = buildStatementDraftLines(buildScope.settlementPartyId, buildScope.settlementCycleId)
  assert(buildCandidates.some((item) => item.sourceType === 'TASK_EARNING'), '待生成样例缺少任务收入流水')
  assert(buildCandidates.some((item) => item.sourceType === 'QUALITY_DEDUCTION'), '待生成样例缺少质量扣款流水')
  assert(buildLines.some((item) => item.sourceItemType === 'TASK_EARNING'), '正式流水明细缺少任务收入流水行')
  assert(buildLines.some((item) => item.sourceItemType === 'QUALITY_DEDUCTION'), '正式流水明细缺少质量扣款流水行')

  const createResult = createStatementFromEligibleLedgers({
    statementId: buildCheckStatementId(),
    settlementPartyType: buildScope.settlementPartyType,
    settlementPartyId: buildScope.settlementPartyId,
    settlementPartyLabel: buildScope.settlementPartyLabel,
    settlementCycleId: buildScope.settlementCycleId,
    settlementCycleLabel: buildScope.settlementCycleLabel,
    settlementCycleStartAt: buildScope.settlementCycleStartAt,
    settlementCycleEndAt: buildScope.settlementCycleEndAt,
    itemSourceIds: buildCandidates.map((item) => item.sourceItemId),
    itemBasisIds: buildCandidates
      .filter((item) => item.sourceType === 'QUALITY_DEDUCTION')
      .map((item) => item.sourceItemId),
    items: buildLines,
    remark: '脚本校验生成',
    by: '脚本校验',
    at: '2026-03-27 10:00:00',
  })
  assert(createResult.ok, createResult.message ?? '脚本生成对账单失败')
  const createdStatement = getStatementById(createResult.data!.statementId)
  assert(createdStatement, '脚本生成的对账单未写回共享对象')

  const runtimeLedgers = listPreSettlementLedgers({
    factoryId: buildScope.settlementPartyId,
    settlementCycleId: buildScope.settlementCycleId,
  }).filter((item) => buildCandidates.some((candidate) => candidate.sourceItemId === item.ledgerId))
  assert(
    runtimeLedgers.every((item) => item.status === 'IN_STATEMENT' && item.statementId === createdStatement!.statementId),
    '对账单生成后，正式流水状态未切为 IN_STATEMENT 或未写回 statementId',
  )

  const lateResolvedLedger = listPreSettlementLedgers({ ledgerType: 'QUALITY_DEDUCTION' }).find((ledger) =>
    statements.some((statement) =>
      statement.settlementPartyId === ledger.factoryId &&
      statement.settlementCycleId === ledger.settlementCycleId &&
      ledger.status === 'OPEN' &&
      ledger.occurredAt > statement.createdAt &&
      !(statement.ledgerIds ?? []).includes(ledger.ledgerId),
    ),
  )
  assert(lateResolvedLedger, '缺少“后裁决正式质量扣款流水不回写旧单”的样例')

  const statementsPageSource = fs.readFileSync(
    new URL('../src/pages/statements.ts', import.meta.url),
    'utf8',
  )
  assert(statementsPageSource.includes('对账单列表'), '对账单页面未默认展示列表页')
  assert(statementsPageSource.includes('待入预付款'), '对账单页面未展示后续预付款口径')
  assert(statementsPageSource.includes('任务收入流水明细'), '对账单详情未分段展示任务收入流水')
  assert(statementsPageSource.includes('质量扣款流水明细'), '对账单详情未分段展示质量扣款流水')
  assert(!statementsPageSource.includes('应付调整'), '对账单页面仍残留应付调整文案')
  assert(!statementsPageSource.includes('其他调整'), '对账单页面仍残留其他调整文案')
  assert(!statementsPageSource.includes('跨周期调整'), '对账单页面仍残留跨周期调整文案')
  assert(!statementsPageSource.includes('回货净额行'), '对账单页面仍残留回货净额行文案')
  assert(!statementsPageSource.includes('下周期调整'), '对账单页面仍残留下周期调整文案')
  assert(!statementsPageSource.includes('冲回'), '对账单页面仍残留冲回文案')

  const listItems = getStatementListItems()
  assert(listItems.some((item) => item.totalEarningAmount > 0), '对账单列表缺少正向金额')
  assert(listItems.some((item) => item.totalDeductionAmount > 0), '对账单列表缺少反向金额')

  console.log(
    JSON.stringify(
      {
        对账单数: statements.length,
        候选范围数: candidateScopes.length,
        待生成混合样例: buildScope.settlementCycleLabel,
        脚本生成对账单: createdStatement?.statementId,
        后裁决待入单流水: lateResolvedLedger?.ledgerNo,
      },
      null,
      2,
    ),
  )
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
}
