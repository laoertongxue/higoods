#!/usr/bin/env node

import process from 'node:process'
import {
  getPlatformQcDetailViewModelByRouteKey,
  getFutureMobileFactoryQcDetail,
  listFutureSettlementAdjustmentItems,
  listPdaSettlementWritebackItems,
} from '../src/data/fcs/quality-deduction-selectors.ts'
import {
  adjudicateDisputeCase,
  autoConfirmOverdueQualityCases,
  findAutoConfirmCandidates,
  resetQualityDeductionNowForTest,
  setQualityDeductionNowForTest,
} from '../src/data/fcs/quality-deduction-lifecycle.ts'
import {
  getQualityDeductionCaseFactByQcId,
  submitQualityDeductionDispute,
} from '../src/data/fcs/quality-deduction-repository.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function main(): void {
  setQualityDeductionNowForTest('2026-03-25 10:00:00')

  const autoCandidates = findAutoConfirmCandidates()
  const autoCandidateIds = autoCandidates.map((item) => item.qcRecord.qcId)
  assert(autoCandidateIds.includes('QC-RIB-202603-0003'), '缺少自动确认候选样例 QC-RIB-202603-0003')
  assert(!autoCandidateIds.includes('QC-NEW-002'), '已发起异议记录不应进入自动确认候选')
  assert(!autoCandidateIds.includes('QC-NEW-007'), '无需工厂响应记录不应进入自动确认候选')

  const autoConfirmResult = autoConfirmOverdueQualityCases()
  assert(autoConfirmResult.processedQcIds.includes('QC-RIB-202603-0003'), '自动确认未处理 QC-RIB-202603-0003')

  const autoConfirmedCase = getQualityDeductionCaseFactByQcId('QC-RIB-202603-0003')
  assert(autoConfirmedCase?.factoryResponse?.factoryResponseStatus === 'AUTO_CONFIRMED', '自动确认后工厂响应状态错误')
  assert(autoConfirmedCase?.deductionBasis?.status === 'EFFECTIVE', '自动确认后扣款依据未转为已生效')
  assert(autoConfirmedCase?.settlementImpact.status === 'ELIGIBLE', '自动确认后结算影响未进入可结算')

  const autoConfirmAgain = autoConfirmOverdueQualityCases()
  assert(!autoConfirmAgain.processedQcIds.includes('QC-RIB-202603-0003'), '自动确认重复执行不应再次生成副作用')

  const createDispute = submitQualityDeductionDispute({
    qcId: 'QC-NEW-005',
    submittedByUserName: '工厂厂长-Siti',
    submittedAt: '2026-03-25 10:30:00',
    disputeReasonCode: 'PROCESS_JUDGEMENT',
    disputeReasonName: '责任判定异议',
    disputeDescription: '工厂认为裁片报废责任需复核，提交现场图片与视频供平台裁决。',
    disputeEvidenceAssets: [
      { assetId: 'TMP-LC-001', name: '现场图片-01.jpg', assetType: 'IMAGE' },
      { assetId: 'TMP-LC-002', name: '现场视频-01.mp4', assetType: 'VIDEO' },
    ],
  })
  assert(createDispute.ok, '用于维持原判测试的异议创建失败')

  const upheldResult = adjudicateDisputeCase({
    qcId: 'QC-NEW-005',
    reviewerUserName: '平台运营-裁决',
    adjudicatedAt: '2026-03-25 11:00:00',
    adjudicationResult: 'UPHELD',
    adjudicationComment: '复核仓库证据与工厂异议素材后，维持原责任数量与金额。',
  })
  assert(upheldResult.ok, '维持原判裁决失败')

  const upheldPlatform = getPlatformQcDetailViewModelByRouteKey('QC-NEW-005')
  const upheldMobile = getFutureMobileFactoryQcDetail('QC-NEW-005', 'ID-F004')
  assert(upheldPlatform?.disputeCase?.status === 'UPHELD', '平台端未同步为维持原判')
  assert(upheldPlatform?.settlementImpact.status === 'ELIGIBLE', '未锁账维持原判后应转可结算')
  assert(upheldMobile?.adjudicationResultLabel === '维持原判', '工厂端未同步维持原判结果')
  assert(upheldMobile?.resultWrittenBackAt === upheldPlatform?.disputeCase?.resultWrittenBackAt, '平台端与工厂端回写时间不一致')

  const partialUnlockedResult = adjudicateDisputeCase({
    qcId: 'QC-NEW-002',
    reviewerUserName: '平台运营-裁决',
    adjudicatedAt: '2026-03-25 11:20:00',
    adjudicationResult: 'PARTIALLY_ADJUSTED',
    adjudicationComment: '复核后下调责任数量和质量扣款金额，当前周期可直接按新口径入结算。',
    adjustedLiableQty: 31,
    adjustedBlockedProcessingFeeAmount: 0,
    adjustedEffectiveQualityDeductionAmount: 1180,
    adjustmentReasonSummary: '未锁账周期内直接按调整后金额回写。',
  })
  assert(partialUnlockedResult.ok, '未锁账部分调整裁决失败')

  const partialUnlockedCase = getQualityDeductionCaseFactByQcId('QC-NEW-002')
  assert(partialUnlockedCase?.disputeCase?.status === 'PARTIALLY_ADJUSTED', '未锁账部分调整后异议状态错误')
  assert(partialUnlockedCase?.settlementImpact.status === 'ELIGIBLE', '未锁账部分调整后应直接进入可结算')
  assert(partialUnlockedCase?.settlementAdjustment === null, '未锁账部分调整不应生成 adjustment')
  assert(partialUnlockedCase?.deductionBasis?.effectiveQualityDeductionAmount === 1180, '未锁账部分调整后扣款金额未更新')

  const partialLockedResult = adjudicateDisputeCase({
    qcId: 'QC-RIB-202603-0002',
    reviewerUserName: '平台运营-裁决',
    adjudicatedAt: '2026-03-25 11:40:00',
    adjudicationResult: 'PARTIALLY_ADJUSTED',
    adjudicationComment: '当前批次已锁账，差额转下周期调整。',
    adjustedLiableQty: 32,
    adjustedBlockedProcessingFeeAmount: 0,
    adjustedEffectiveQualityDeductionAmount: 960,
    adjustmentReasonSummary: '锁账后仅能通过下周期调整减少扣款。',
  })
  assert(partialLockedResult.ok, '锁账场景部分调整裁决失败')

  const partialLockedCase = getQualityDeductionCaseFactByQcId('QC-RIB-202603-0002')
  assert(partialLockedCase?.settlementImpact.status === 'NEXT_CYCLE_ADJUSTMENT_PENDING', '锁账场景部分调整后应进入待下周期调整')
  assert(partialLockedCase?.settlementAdjustment?.adjustmentType === 'DECREASE_DEDUCTION', '锁账场景部分调整应生成减少扣款 adjustment')
  assert(partialLockedCase?.settlementAdjustment?.adjustmentAmount === 804, '锁账场景部分调整 adjustment 金额错误')
  assert(partialLockedCase?.settlementImpact.includedSettlementBatchId === 'STL-2026-W10', '历史锁账批次引用不应被覆写')

  const reversedLockedResult = adjudicateDisputeCase({
    qcId: 'QC-NEW-006',
    reviewerUserName: '平台运营-裁决',
    adjudicatedAt: '2026-03-25 12:00:00',
    adjudicationResult: 'REVERSED',
    adjudicationComment: '平台改判为非工厂责任，原扣款需在下周期冲回。',
  })
  assert(reversedLockedResult.ok, '锁账场景改判冲回失败')

  const reversedLockedCase = getQualityDeductionCaseFactByQcId('QC-NEW-006')
  assert(reversedLockedCase?.disputeCase?.status === 'REVERSED', '改判冲回后异议状态错误')
  assert(reversedLockedCase?.qcRecord.factoryLiabilityQty === 0, '改判冲回后工厂责任数量应清零')
  assert(reversedLockedCase?.deductionBasis?.status === 'CANCELLED', '改判冲回后扣款依据应取消')
  assert(reversedLockedCase?.settlementImpact.status === 'NEXT_CYCLE_ADJUSTMENT_PENDING', '改判冲回后应进入待下周期调整')
  assert(reversedLockedCase?.settlementAdjustment?.adjustmentType === 'REVERSAL', '改判冲回应生成 REVERSAL adjustment')
  assert(reversedLockedCase?.settlementAdjustment?.adjustmentAmount === 892, '改判冲回 adjustment 金额错误')

  const partialPlatform = getPlatformQcDetailViewModelByRouteKey('QC-NEW-002')
  const partialMobile = getFutureMobileFactoryQcDetail('QC-NEW-002', 'ID-F001')
  assert(partialPlatform?.settlementImpact.effectiveQualityDeductionAmount === partialMobile?.effectiveQualityDeductionAmount, '平台端与工厂端部分调整后金额不一致')
  assert(partialPlatform?.disputeCase?.adjudicationResult === 'PARTIALLY_ADJUSTED', '平台端未暴露部分调整裁决结果')
  assert(partialMobile?.adjudicationResultLabel === '部分调整', '工厂端未暴露部分调整裁决结果')

  const reversedPlatform = getPlatformQcDetailViewModelByRouteKey('QC-NEW-006')
  const reversedMobile = getFutureMobileFactoryQcDetail('QC-NEW-006', 'ID-F004')
  assert(reversedPlatform?.settlementImpact.status === reversedMobile?.settlementImpactStatus, '平台端与工厂端冲回后结算状态不一致')
  assert(reversedPlatform?.settlementImpact.effectiveQualityDeductionAmount === reversedMobile?.effectiveQualityDeductionAmount, '平台端与工厂端冲回后金额不一致')

  const pdaItems = listPdaSettlementWritebackItems(new Set(['ID-F001', 'ID-F004']))
  const partialPda = pdaItems.find((item) => item.qcId === 'QC-NEW-002')
  const reversedPda = pdaItems.find((item) => item.qcId === 'QC-NEW-006')
  assert(partialPda?.deductionAmountCny === partialPlatform?.settlementImpact.effectiveQualityDeductionAmount, 'PDA 结算感知与平台端部分调整金额不一致')
  assert(reversedPda?.settlementStatusText === reversedPlatform?.settlementImpactStatusLabel, 'PDA 结算感知与平台端冲回状态不一致')

  const futureAdjustments = listFutureSettlementAdjustmentItems({ includeLegacy: true })
  assert(futureAdjustments.some((item) => item.qcId === 'QC-RIB-202603-0002' && item.adjustmentType === 'DECREASE_DEDUCTION'), '未来结算 selector 缺少锁账部分调整 adjustment')
  assert(futureAdjustments.some((item) => item.qcId === 'QC-NEW-006' && item.adjustmentType === 'REVERSAL'), '未来结算 selector 缺少冲回 adjustment')

  console.log(
    JSON.stringify(
      {
        autoConfirmCandidateIds: autoCandidateIds,
        autoConfirmedQcIds: autoConfirmResult.processedQcIds,
        upheldQcId: upheldPlatform?.qcId,
        partialUnlockedQcId: partialPlatform?.qcId,
        partialLockedAdjustmentAmount: partialLockedCase?.settlementAdjustment?.adjustmentAmount,
        reversedLockedAdjustmentAmount: reversedLockedCase?.settlementAdjustment?.adjustmentAmount,
        futureAdjustmentCount: futureAdjustments.length,
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
