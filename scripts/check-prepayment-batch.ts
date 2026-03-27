#!/usr/bin/env node

import process from 'node:process'
import { listPreSettlementLedgers } from '../src/data/fcs/pre-settlement-ledger-repository.ts'
import {
  canStatementEnterPrepayment,
  createPrepaymentBatch,
  getStatementById,
  initialSettlementBatches,
  initialStatementDrafts,
} from '../src/data/fcs/store-domain-settlement-seeds.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function getPayeeSnapshotKey(statement: (typeof initialStatementDrafts)[number]): string {
  return [
    statement.settlementPartyId,
    statement.settlementCurrency ?? statement.settlementProfileSnapshot.settlementConfigSnapshot.currency,
    statement.settlementProfileVersionNo,
    statement.settlementProfileSnapshot.receivingAccountSnapshot.bankAccountNo,
  ].join('__')
}

function getOpenBatchStatementIds(): Set<string> {
  return new Set(
    initialSettlementBatches
      .filter((batch) => batch.status !== 'CLOSED')
      .flatMap((batch) => batch.statementIds),
  )
}

function getBuildableGroups() {
  const occupied = getOpenBatchStatementIds()
  const candidates = initialStatementDrafts.filter(
    (statement) => canStatementEnterPrepayment(statement) && !occupied.has(statement.statementId),
  )

  const groups = new Map<string, (typeof initialStatementDrafts)[]>()
  for (const statement of candidates) {
    const key = getPayeeSnapshotKey(statement)
    groups.set(key, [...(groups.get(key) ?? []), statement])
  }

  return Array.from(groups.values()).filter((group) => group.length >= 2)
}

function main(): void {
  const buildableGroups = getBuildableGroups()
  assert(buildableGroups.length > 0, '缺少可用于创建预付款批次的同工厂样例')

  const primaryGroup = buildableGroups[0]
  const selectedStatements = primaryGroup.slice(0, 2)
  const selectedIds = selectedStatements.map((item) => item.statementId)

  const createResult = createPrepaymentBatch({
    statementIds: selectedIds,
    batchName: '脚本校验预付款批次',
    remark: '脚本校验创建',
    by: '脚本校验',
    at: '2026-03-27 10:10:00',
  })

  assert(createResult.ok && createResult.data, createResult.message ?? '创建预付款批次失败')
  const batch = createResult.data
  assert(batch.status === 'READY_TO_APPLY_PAYMENT', '新建批次状态不是待申请付款')
  assert(batch.totalStatementCount === selectedIds.length, '批次对账单数量不正确')
  assert(new Set(batch.items.map((item) => item.settlementPartyId)).size === 1, '批次仍混入了跨工厂对账单')

  for (const statementId of selectedIds) {
    const statement = getStatementById(statementId)
    assert(statement, `创建后未找到对账单 ${statementId}`)
    assert(statement?.status === 'IN_PREPAYMENT_BATCH', `对账单 ${statementId} 未切到已入预付款批次`)
    assert(statement?.prepaymentBatchId === batch.batchId, `对账单 ${statementId} 未写回批次 ID`)
    assert(statement?.prepaymentBatchNo === batch.batchNo, `对账单 ${statementId} 未写回批次编号`)

    const ledgers = listPreSettlementLedgers().filter((ledger) => (statement?.ledgerIds ?? []).includes(ledger.ledgerId))
    assert(ledgers.length > 0, `对账单 ${statementId} 缺少正式流水`)
    assert(
      ledgers.every((ledger) => ledger.status === 'IN_PREPAYMENT_BATCH' && ledger.prepaymentBatchId === batch.batchId),
      `对账单 ${statementId} 的正式流水未推进到已入预付款批次`,
    )
  }

  const otherFactoryStatement = initialStatementDrafts.find(
    (statement) =>
      canStatementEnterPrepayment(statement) &&
      !getOpenBatchStatementIds().has(statement.statementId) &&
      statement.settlementPartyId !== selectedStatements[0].settlementPartyId,
  )
  assert(otherFactoryStatement, '缺少跨工厂拦截样例')

  const crossFactoryResult = createPrepaymentBatch({
    statementIds: [selectedIds[0], otherFactoryStatement.statementId],
    by: '脚本校验',
    at: '2026-03-27 10:15:00',
  })
  assert(!crossFactoryResult.ok, '跨工厂对账单仍然可以创建同一预付款批次')

  const duplicateResult = createPrepaymentBatch({
    statementIds: selectedIds,
    by: '脚本校验',
    at: '2026-03-27 10:20:00',
  })
  assert(!duplicateResult.ok, '已在未关闭批次中的对账单仍可重复入批')

  console.log(
    JSON.stringify(
      {
        预付款批次号: batch.batchNo,
        工厂: batch.factoryName,
        对账单数: batch.totalStatementCount,
        批次金额: batch.totalPayableAmount,
        跨工厂创建已拦截: true,
        重复入批已拦截: true,
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
