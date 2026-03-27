#!/usr/bin/env node

import process from 'node:process'
import { listPreSettlementLedgers } from '../src/data/fcs/pre-settlement-ledger-repository.ts'
import {
  applyPrepaymentBatchForPayment,
  canStatementEnterPrepayment,
  closePrepaymentBatch,
  createPaymentWriteback,
  createPrepaymentBatch,
  getPrepaymentBatchById,
  getStatementById,
  initialSettlementBatches,
  initialStatementDrafts,
  syncFeishuPaymentApprovalStatus,
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

function getBuildableStatements() {
  const occupied = getOpenBatchStatementIds()
  const groups = new Map<string, (typeof initialStatementDrafts)[]>()
  for (const statement of initialStatementDrafts) {
    if (!canStatementEnterPrepayment(statement) || occupied.has(statement.statementId)) continue
    const key = getPayeeSnapshotKey(statement)
    groups.set(key, [...(groups.get(key) ?? []), statement])
  }
  const selected = Array.from(groups.values()).find((group) => group.length >= 2)
  if (!selected) throw new Error('缺少可用于打款回写校验的批次样例')
  return selected.slice(0, 2)
}

function main(): void {
  const statements = getBuildableStatements()
  const batchResult = createPrepaymentBatch({
    statementIds: statements.map((item) => item.statementId),
    batchName: '回写校验批次',
    by: '脚本校验',
    at: '2026-03-27 12:00:00',
  })
  assert(batchResult.ok && batchResult.data, batchResult.message ?? '创建预付款批次失败')

  const batch = batchResult.data
  const applyResult = applyPrepaymentBatchForPayment({
    batchId: batch.batchId,
    by: '脚本校验',
    at: '2026-03-27 12:05:00',
  })
  assert(applyResult.ok && applyResult.data, applyResult.message ?? '申请付款失败')

  const earlyWriteback = createPaymentWriteback({
    batchId: batch.batchId,
    by: '脚本校验',
    at: '2026-03-27 12:06:00',
  })
  assert(!earlyWriteback.ok, '飞书审批未付款前仍可创建打款回写')

  const paidResult = syncFeishuPaymentApprovalStatus({
    approvalId: applyResult.data.approvalId,
    by: '脚本校验',
    at: '2026-03-27 12:10:00',
    status: 'PAID',
  })
  assert(paidResult.ok && paidResult.data?.status === 'PAID', '飞书审批未成功切到已付款')

  const writebackResult = createPaymentWriteback({
    batchId: batch.batchId,
    by: '脚本校验',
    at: '2026-03-27 12:15:00',
    notes: '脚本校验创建正式打款回写',
  })
  assert(writebackResult.ok && writebackResult.data, writebackResult.message ?? '创建打款回写失败')

  const runtimeBatch = getPrepaymentBatchById(batch.batchId)
  assert(runtimeBatch?.status === 'PREPAID', '打款回写后批次状态未进入已预付')
  assert(runtimeBatch?.paymentWritebackId === writebackResult.data.writebackId, '批次未写回正式打款回写 ID')
  assert(writebackResult.data.bankReceiptName && writebackResult.data.bankSerialNo, '打款回写未写入银行回执或银行流水')

  for (const statement of statements) {
    const runtimeStatement = getStatementById(statement.statementId)
    assert(runtimeStatement?.status === 'PREPAID', `对账单 ${statement.statementId} 未推进到已预付`)
    assert(runtimeStatement?.paymentWritebackId === writebackResult.data.writebackId, `对账单 ${statement.statementId} 未写回打款回写 ID`)
  }

  const ledgers = listPreSettlementLedgers().filter((ledger) =>
    statements.some((statement) => (statement.ledgerIds ?? []).includes(ledger.ledgerId)),
  )
  assert(
    ledgers.every((ledger) => ledger.status === 'PREPAID' && ledger.prepaymentBatchId === batch.batchId),
    '打款回写后正式流水状态未同步推进到已预付',
  )

  const duplicatedWriteback = createPaymentWriteback({
    batchId: batch.batchId,
    by: '脚本校验',
    at: '2026-03-27 12:20:00',
  })
  assert(!duplicatedWriteback.ok, '同一批次仍可重复生成打款回写')

  const closeResult = closePrepaymentBatch({
    batchId: batch.batchId,
    by: '脚本校验',
    at: '2026-03-27 12:25:00',
  })
  assert(closeResult.ok && closeResult.data?.status === 'CLOSED', '已预付批次关闭失败')

  console.log(
    JSON.stringify(
      {
        批次号: batch.batchNo,
        打款回写单号: writebackResult.data.writebackId,
        银行回执: writebackResult.data.bankReceiptName,
        银行流水号: writebackResult.data.bankSerialNo,
        关闭状态: closeResult.data?.status,
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
