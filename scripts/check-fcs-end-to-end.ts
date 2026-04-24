#!/usr/bin/env node

import process from 'node:process'
import { indonesiaFactories } from '../src/data/fcs/indonesia-factories.ts'
import { listPreSettlementLedgers, tracePreSettlementLedgerSource } from '../src/data/fcs/pre-settlement-ledger-repository.ts'
import {
  getFormalQualityDeductionLedgerByQcId,
  listFormalQualityDeductionLedgers,
  listPendingQualityDeductionRecords,
  listQualityDeductionDisputeCases,
  traceQualityDeductionLedgerSource,
} from '../src/data/fcs/quality-deduction-repository.ts'
import { getSettlementEffectiveInfoByFactory } from '../src/data/fcs/settlement-change-requests.ts'
import {
  getPrepaymentBatchById,
  getStatementById,
  listFeishuPaymentApprovals,
  listPaymentWritebacks,
  listStatements,
} from '../src/data/fcs/store-domain-settlement-seeds.ts'
import {
  getPdaHandoverRecordsByHead,
  listPdaHandoverHeads,
} from '../src/data/fcs/pda-handover-events.ts'
import { listRuntimeProcessTasks } from '../src/data/fcs/runtime-process-tasks.ts'
import {
  buildTaskDeliveryCardPrintDocByRecordId,
  buildTaskRouteCardPrintDoc,
} from '../src/data/fcs/task-print-cards.ts'
import { listPdaGenericProcessTasks } from '../src/data/fcs/pda-task-mock-factory.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function main(): void {
  const ledgers = listPreSettlementLedgers()
  const statements = listStatements()
  const approvals = listFeishuPaymentApprovals()
  const writebacks = listPaymentWritebacks()
  const qualityLedgers = listFormalQualityDeductionLedgers({ includeLegacy: false })
  const pendingRecords = listPendingQualityDeductionRecords({ includeLegacy: false })
  const disputes = listQualityDeductionDisputeCases({ includeLegacy: false })

  const prepaidTaskLedger = ledgers.find((ledger) => ledger.ledgerType === 'TASK_EARNING' && ledger.status === 'PREPAID')
  assert(prepaidTaskLedger, '缺少“任务收入正式流水 -> 对账单 -> 预付款 -> 打款回写”的已预付样例')
  const prepaidTaskTrace = tracePreSettlementLedgerSource(prepaidTaskLedger.ledgerId)
  assert(prepaidTaskTrace?.task, '任务收入正式流水未能追到任务')
  assert(prepaidTaskTrace?.productionOrder, '任务收入正式流水未能追到生产单')
  assert(Boolean(prepaidTaskTrace?.ledger.returnInboundBatchId), '任务收入正式流水未能追到回货批次')
  assert(Boolean(prepaidTaskTrace?.statement), '任务收入正式流水未关联对账单')
  assert(Boolean(prepaidTaskTrace?.batch), '任务收入正式流水未关联预付款批次')
  const prepaidTaskApproval = prepaidTaskTrace?.batch ? listFeishuPaymentApprovals(prepaidTaskTrace.batch.batchId)[0] ?? null : null
  const prepaidTaskWriteback = prepaidTaskTrace?.batch ? listPaymentWritebacks(prepaidTaskTrace.batch.batchId)[0] ?? null : null
  assert(prepaidTaskApproval?.status === 'PAID', '已预付任务收入样例缺少已付款飞书付款审批')
  assert(Boolean(prepaidTaskWriteback?.bankReceiptName && prepaidTaskWriteback?.bankSerialNo), '已预付任务收入样例缺少银行回执或银行流水')

  const factoryConfirmLedger = qualityLedgers.find((ledger) => ledger.triggerSource === 'FACTORY_CONFIRM')
  assert(factoryConfirmLedger, '缺少“工厂确认 -> 正式质量扣款流水”的样例')
  const factoryConfirmTrace = traceQualityDeductionLedgerSource(factoryConfirmLedger.ledgerId)
  assert(factoryConfirmTrace?.pendingRecord?.status === 'FACTORY_CONFIRMED', '工厂确认样例的待确认质量扣款记录状态不正确')

  const autoConfirmLedger = qualityLedgers.find((ledger) => ledger.triggerSource === 'AUTO_CONFIRM')
  assert(autoConfirmLedger, '缺少“自动确认 -> 正式质量扣款流水”的样例')
  const autoConfirmTrace = traceQualityDeductionLedgerSource(autoConfirmLedger.ledgerId)
  assert(autoConfirmTrace?.pendingRecord?.status === 'SYSTEM_AUTO_CONFIRMED', '自动确认样例的待确认质量扣款记录状态不正确')

  const adjudicationLedger = qualityLedgers.find(
    (ledger) =>
      ledger.triggerSource === 'ADJUDICATION_FACTORY_LIABILITY' ||
      ledger.triggerSource === 'ADJUDICATION_PARTIAL_LIABILITY',
  )
  assert(adjudicationLedger, '缺少“异议裁决 -> 正式质量扣款流水”的样例')
  const adjudicationTrace = traceQualityDeductionLedgerSource(adjudicationLedger.ledgerId)
  assert(Boolean(adjudicationTrace?.disputeCase?.adjudicationResult), '裁决样例未关联最终裁决结果')

  const openDispute = disputes.find((item) => item.status === 'PENDING_REVIEW' || item.status === 'IN_REVIEW')
  assert(openDispute, '缺少“异议中未入单”的样例')
  assert(
    getFormalQualityDeductionLedgerByQcId(openDispute.qcId) == null,
    '未最终裁决的质量异议仍生成了正式质量扣款流水',
  )

  const reversedDispute =
    disputes.find((item) => item.adjudicationResult === 'REVERSED')
    ?? listQualityDeductionDisputeCases({ includeLegacy: true }).find((item) => item.adjudicationResult === 'REVERSED')
  assert(reversedDispute, '缺少“最终非工厂责任”的样例')
  assert(
    getFormalQualityDeductionLedgerByQcId(reversedDispute.qcId) == null,
    '最终非工厂责任样例仍生成了正式质量扣款流水',
  )

  const prepaidBatch = approvals
    .filter((approval) => approval.status === 'PAID')
    .map((approval) => {
      const batch = getPrepaymentBatchById(approval.batchId)
      const writeback = listPaymentWritebacks(approval.batchId)[0] ?? null
      return { approval, batch, writeback }
    })
    .find((item) => item.batch && item.writeback)
  assert(prepaidBatch?.batch, '缺少“飞书已付款 + 打款回写”的预付款批次样例')
  assert(prepaidBatch.writeback?.approvalId === prepaidBatch.approval.approvalId, '打款回写未正确关联飞书付款审批')
  assert(prepaidBatch.batch.status === 'PREPAID' || prepaidBatch.batch.status === 'CLOSED', '已完成打款回写的批次状态不正确')

  const prepaidStatements = prepaidBatch.batch.statementIds
    .map((statementId) => getStatementById(statementId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  assert(prepaidStatements.length > 0, '已完成打款回写的批次未找到关联对账单')
  assert(
    prepaidStatements.every((statement) => statement.status === 'PREPAID' || statement.status === 'CLOSED'),
    '打款回写后，对账单状态未同步推进到已预付口径',
  )

  const prepaidLedgerIds = new Set(prepaidStatements.flatMap((statement) => statement.ledgerIds ?? []))
  const prepaidLedgers = ledgers.filter((ledger) => prepaidLedgerIds.has(ledger.ledgerId))
  assert(
    prepaidLedgers.every(
      (ledger) =>
        ledger.status === 'PREPAID' &&
        ledger.prepaymentBatchId === prepaidBatch.batch?.batchId &&
        prepaidBatch.batch?.statementIds.includes(ledger.statementId ?? ''),
    ),
    '打款回写后，正式流水状态或双向关联未同步推进',
  )

  const runtimeTask = listRuntimeProcessTasks()[0] ?? listPdaGenericProcessTasks()[0]
  assert(runtimeTask, '缺少任务流转卡端到端样例任务')
  const routeCard = buildTaskRouteCardPrintDoc({ sourceType: 'RUNTIME_TASK', sourceId: runtimeTask.taskId })
  assert(routeCard.taskId === runtimeTask.taskId && routeCard.qrLabel === '任务二维码', '任务流转卡端到端链路异常')
  const handoutHead = listPdaHandoverHeads().find((head) => head.headType === 'HANDOUT' && getPdaHandoverRecordsByHead(head.handoverId).length > 0)
  assert(handoutHead, '缺少任务交货卡端到端交出记录样例')
  const handoutRecord = getPdaHandoverRecordsByHead(handoutHead.handoverId)[0]
  const deliveryCard = buildTaskDeliveryCardPrintDocByRecordId(handoutRecord.handoverRecordId || handoutRecord.recordId)
  assert(deliveryCard.handoverRecordId === (handoutRecord.handoverRecordId || handoutRecord.recordId), '任务交货卡端到端链路异常')
  assert(deliveryCard.deliverySequenceLabel === `第 ${handoutRecord.sequenceNo} 次交货`, '任务交货卡端到端交货次数异常')

  const statementScopeKeys = new Set<string>()
  for (const statement of statements) {
    const scopeKey = `${statement.settlementPartyId}__${statement.settlementCycleId}`
    assert(!statementScopeKeys.has(scopeKey), `同一工厂同一周期出现多张对账单：${scopeKey}`)
    statementScopeKeys.add(scopeKey)
  }

  const snapshotMismatch = indonesiaFactories.flatMap((factory) => {
    const effective = getSettlementEffectiveInfoByFactory(factory.code)
    if (!effective) return []
    const statement = statements.find(
      (item) => item.settlementProfileSnapshot.sourceFactoryId === factory.id && item.settlementProfileVersionNo !== effective.versionNo,
    )
    if (statement) {
      return [
        {
          factoryId: factory.id,
          currentVersionNo: effective.versionNo,
          statementId: statement.statementId,
          statementVersionNo: statement.settlementProfileVersionNo,
          batchId: statement.prepaymentBatchId ?? null,
        },
      ]
    }
    return []
  })[0]
  assert(snapshotMismatch, '缺少“当前生效资料版本与历史单据快照版本不一致”的样例')

  const pendingCount = pendingRecords.filter((item) => item.status === 'PENDING_FACTORY_CONFIRM').length
  const disputingCount = disputes.filter((item) => item.status === 'PENDING_REVIEW' || item.status === 'IN_REVIEW').length
  assert(pendingCount > 0, '缺少待确认质量扣款记录样例')
  assert(disputingCount > 0, '缺少质量异议单样例')

  console.log(
    JSON.stringify(
      {
        任务收入链样例: prepaidTaskLedger.ledgerNo,
        工厂确认质量链样例: factoryConfirmLedger.ledgerNo,
        自动确认质量链样例: autoConfirmLedger.ledgerNo,
        裁决质量链样例: adjudicationLedger.ledgerNo,
        异议中未入单样例: openDispute.disputeNo,
        最终非工厂责任样例: reversedDispute.disputeNo,
        已预付批次样例: prepaidBatch.batch.batchNo,
        飞书付款审批编号: prepaidBatch.approval.approvalNo,
        银行流水号: prepaidBatch.writeback?.bankSerialNo,
        资料快照差异样例: snapshotMismatch,
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
