#!/usr/bin/env node

import process from 'node:process'
import {
  applyPrepaymentBatchForPayment,
  canStatementEnterPrepayment,
  createPrepaymentBatch,
  getFeishuPaymentApprovalById,
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
  if (!selected) throw new Error('缺少可用于申请付款的预付款批次样例')
  return selected.slice(0, 2)
}

function main(): void {
  const statements = getBuildableStatements()
  const batchResult = createPrepaymentBatch({
    statementIds: statements.map((item) => item.statementId),
    batchName: '审批校验批次',
    by: '脚本校验',
    at: '2026-03-27 11:00:00',
  })
  assert(batchResult.ok && batchResult.data, batchResult.message ?? '创建预付款批次失败')

  const applyResult = applyPrepaymentBatchForPayment({
    batchId: batchResult.data.batchId,
    by: '脚本校验',
    at: '2026-03-27 11:05:00',
  })
  assert(applyResult.ok && applyResult.data, applyResult.message ?? '申请付款失败')

  const batch = getPrepaymentBatchById(batchResult.data.batchId)
  assert(batch, '申请付款后未找到预付款批次')
  assert(batch?.status === 'FEISHU_APPROVAL_CREATED', '申请付款后批次状态未推进到飞书审批已创建')
  assert(batch?.feishuApprovalId && batch?.feishuApprovalNo, '批次未写回飞书付款审批编号')

  const approval = getFeishuPaymentApprovalById(batch.feishuApprovalId!)
  assert(approval, '申请付款后未找到飞书付款审批对象')
  assert(approval?.approvalNo === batch.feishuApprovalNo, '批次上的飞书付款审批编号与审批对象不一致')

  for (const statement of statements) {
    const runtimeStatement = getStatementById(statement.statementId)
    assert(runtimeStatement?.feishuApprovalNo === approval?.approvalNo, `对账单 ${statement.statementId} 未写回飞书付款审批编号`)
  }

  const duplicatedApply = applyPrepaymentBatchForPayment({
    batchId: batch.batchId,
    by: '脚本校验',
    at: '2026-03-27 11:06:00',
  })
  assert(!duplicatedApply.ok, '存在有效审批时仍可重复申请付款')

  const sync1 = syncFeishuPaymentApprovalStatus({
    approvalId: approval!.approvalId,
    by: '脚本校验',
    at: '2026-03-27 11:10:00',
  })
  assert(sync1.ok && sync1.data?.status === 'APPROVING', '第一次同步后审批状态未进入审批中')

  const sync2 = syncFeishuPaymentApprovalStatus({
    approvalId: approval!.approvalId,
    by: '脚本校验',
    at: '2026-03-27 11:15:00',
  })
  assert(sync2.ok && sync2.data?.status === 'APPROVED_PENDING_PAYMENT', '第二次同步后审批状态未进入已审批待付款')

  const sync3 = syncFeishuPaymentApprovalStatus({
    approvalId: approval!.approvalId,
    by: '脚本校验',
    at: '2026-03-27 11:20:00',
  })
  assert(sync3.ok && sync3.data?.status === 'PAID', '第三次同步后审批状态未进入已付款')

  const syncedBatch = getPrepaymentBatchById(batch.batchId)
  assert(syncedBatch?.status === 'FEISHU_PAID_PENDING_WRITEBACK', '飞书已付款后批次未进入待创建回写状态')
  assert(sync3.data?.bankReceiptName && sync3.data?.bankSerialNo, '飞书已付款后未返回银行回执或银行流水号')

  console.log(
    JSON.stringify(
      {
        批次号: batch.batchNo,
        飞书付款审批编号: approval?.approvalNo,
        最终审批状态: sync3.data?.status,
        最近同步时间: sync3.data?.latestSyncedAt,
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
