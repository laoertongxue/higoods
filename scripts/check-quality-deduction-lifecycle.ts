#!/usr/bin/env node

import process from 'node:process'
import {
  getPlatformQcDetailViewModelByRouteKey,
  getFutureMobileFactoryQcDetail,
} from '../src/data/fcs/quality-deduction-selectors.ts'
import {
  adjudicateDisputeCase,
  autoConfirmOverdueQualityCases,
  findAutoConfirmCandidates,
  resetQualityDeductionNowForTest,
  setQualityDeductionNowForTest,
} from '../src/data/fcs/quality-deduction-lifecycle.ts'
import {
  confirmQualityDeductionFactoryResponse,
  getFormalQualityDeductionLedgerByQcId,
  getPendingQualityDeductionRecordByQcId,
  submitQualityDeductionDispute,
} from '../src/data/fcs/quality-deduction-repository.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function main(): void {
  setQualityDeductionNowForTest('2026-03-25 10:00:00')

  const autoCandidateIds = findAutoConfirmCandidates().map((item) => item.qcRecord.qcId)
  assert(autoCandidateIds.includes('QC-RIB-202603-0003'), '缺少系统自动确认样例 QC-RIB-202603-0003')
  assert(!autoCandidateIds.includes('QC-NEW-006'), '已发起质量异议样例不应进入系统自动确认候选')

  const autoConfirmResult = autoConfirmOverdueQualityCases()
  const autoLedger = getFormalQualityDeductionLedgerByQcId('QC-RIB-202603-0003')
  assert(getPendingQualityDeductionRecordByQcId('QC-RIB-202603-0003')?.status === 'SYSTEM_AUTO_CONFIRMED', '系统自动确认样例状态错误')
  assert(autoLedger?.triggerSource === 'AUTO_CONFIRM', '系统自动确认后未生成正式质量扣款流水')
  assert(!getPlatformQcDetailViewModelByRouteKey('QC-RIB-202603-0003')?.disputeCase, '系统自动确认不应生成质量异议单')
  assert(!autoConfirmOverdueQualityCases().processedQcIds.includes('QC-RIB-202603-0003'), '系统自动确认重复执行不应重复生成副作用')

  const confirmResult = confirmQualityDeductionFactoryResponse({
    qcId: 'QC-NEW-001',
    responderUserName: '工厂主管-Adi',
    respondedAt: '2026-03-25 10:15:00',
    responseComment: '工厂已确认责任数量与金额',
  })
  assert(confirmResult.ok, '工厂确认处理失败')
  const confirmedPending = getPendingQualityDeductionRecordByQcId('QC-NEW-001')
  const confirmedLedger = getFormalQualityDeductionLedgerByQcId('QC-NEW-001')
  assert(confirmedPending?.status === 'FACTORY_CONFIRMED', '工厂确认后待确认质量扣款记录状态错误')
  assert(confirmedLedger?.triggerSource === 'FACTORY_CONFIRM', '工厂确认后未生成正式质量扣款流水')

  const disputeSubmitResult = submitQualityDeductionDispute({
    qcId: 'QC-NEW-005',
    submittedByUserName: '工厂主管-Siti',
    submittedAt: '2026-03-25 10:30:00',
    disputeReasonCode: 'PROCESS_JUDGEMENT',
    disputeReasonName: '责任判定异议',
    disputeDescription: '工厂补充现场图片，请平台复核当前责任数量。',
    disputeEvidenceAssets: [
      { assetId: 'TMP-QD-001', name: '现场图片-01.jpg', assetType: 'IMAGE' },
    ],
  })
  assert(disputeSubmitResult.ok, '工厂发起质量异议失败')
  assert(getPendingQualityDeductionRecordByQcId('QC-NEW-005')?.status === 'DISPUTED', '发起异议后待确认质量扣款记录状态错误')
  assert(!getFormalQualityDeductionLedgerByQcId('QC-NEW-005'), '质量异议未裁决前不应生成正式质量扣款流水')

  const upheldResult = adjudicateDisputeCase({
    qcId: 'QC-NEW-005',
    reviewerUserName: '平台运营-裁决',
    adjudicatedAt: '2026-03-25 11:00:00',
    adjudicationResult: 'UPHELD',
    adjudicationComment: '复核仓库证据与工厂素材后，最终维持工厂责任。',
  })
  assert(upheldResult.ok, '最终维持工厂责任裁决失败')
  const upheldLedger = getFormalQualityDeductionLedgerByQcId('QC-NEW-005')
  assert(upheldLedger?.triggerSource === 'ADJUDICATION_FACTORY_LIABILITY', '维持工厂责任后未生成正式质量扣款流水')

  const partialResult = adjudicateDisputeCase({
    qcId: 'QC-NEW-002',
    reviewerUserName: '平台运营-裁决',
    adjudicatedAt: '2026-03-25 11:20:00',
    adjudicationResult: 'PARTIALLY_ADJUSTED',
    adjudicationComment: '复核后调整为部分工厂责任，按裁决金额生成正式质量扣款流水。',
    adjustedLiableQty: 31,
    adjustedBlockedProcessingFeeAmount: 0,
    adjustedEffectiveQualityDeductionAmount: 1180,
    adjustmentReasonSummary: '部分责任成立，按裁决金额回写正式质量扣款流水。',
  })
  assert(partialResult.ok, '最终部分工厂责任裁决失败')
  const partialLedger = getFormalQualityDeductionLedgerByQcId('QC-NEW-002')
  assert(partialLedger?.triggerSource === 'ADJUDICATION_PARTIAL_LIABILITY', '部分工厂责任后未生成正式质量扣款流水')
  assert(partialLedger?.settlementAmount === 1180, `部分工厂责任正式流水金额错误: ${partialLedger?.settlementAmount}`)

  const reversedResult = adjudicateDisputeCase({
    qcId: 'QC-NEW-006',
    reviewerUserName: '平台运营-裁决',
    adjudicatedAt: '2026-03-25 11:40:00',
    adjudicationResult: 'REVERSED',
    adjudicationComment: '平台复核后认定为非工厂责任，不生成正式质量扣款流水。',
  })
  assert(reversedResult.ok, '最终非工厂责任裁决失败')
  assert(getPendingQualityDeductionRecordByQcId('QC-NEW-006')?.status === 'CLOSED_WITHOUT_LEDGER', '最终非工厂责任后待确认质量扣款记录应关闭')
  assert(!getFormalQualityDeductionLedgerByQcId('QC-NEW-006'), '最终非工厂责任不应生成正式质量扣款流水')

  const mobileUpheld = getFutureMobileFactoryQcDetail('QC-NEW-005', 'ID-F004')
  const mobilePartial = getFutureMobileFactoryQcDetail('QC-NEW-002', 'ID-F001')
  const mobileReversed = getFutureMobileFactoryQcDetail('QC-NEW-006', 'ID-F004')
  assert(mobileUpheld?.formalLedgerStatusLabel === '已生成正式质量扣款流水', '工厂端未同步维持工厂责任后的正式流水状态')
  assert(mobilePartial?.adjudicationResultLabel === '最终部分工厂责任', '工厂端未同步部分工厂责任裁决结果')
  assert(mobileReversed?.settlementImpactStatusLabel === '未形成正式质量扣款流水', '工厂端未同步非工厂责任后的关闭结果')

  console.log(
    JSON.stringify(
      {
        autoConfirmCandidateIds: autoCandidateIds,
        autoConfirmedQcIds: autoConfirmResult.processedQcIds,
        confirmedLedgerId: confirmedLedger?.ledgerId,
        upheldLedgerId: upheldLedger?.ledgerId,
        partialLedgerAmount: partialLedger?.settlementAmount,
        reversedPendingStatus: getPendingQualityDeductionRecordByQcId('QC-NEW-006')?.status,
      },
      null,
      2,
    ),
  )

  resetQualityDeductionNowForTest()
}

try {
  main()
} catch (error) {
  resetQualityDeductionNowForTest()
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
}
