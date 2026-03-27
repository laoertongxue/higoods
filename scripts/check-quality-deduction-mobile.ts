#!/usr/bin/env node

import process from 'node:process'
import { readFileSync } from 'node:fs'
import {
  confirmQualityDeductionFactoryResponse,
  getFormalQualityDeductionLedgerByQcId,
  submitQualityDeductionDispute,
} from '../src/data/fcs/quality-deduction-repository.ts'
import {
  getFutureMobileFactoryQcDetail,
  getFutureMobileFactoryQcSummary,
  getPlatformQcDetailViewModelByRouteKey,
  listFutureMobileFactoryQcBuckets,
  listFutureMobileFactorySoonOverdueQcItems,
  listPdaSettlementWritebackItems,
} from '../src/data/fcs/quality-deduction-selectors.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function main(): void {
  const legacyAdjustmentLabel = ['下', '周期', '调整'].join('')
  const idf001Buckets = listFutureMobileFactoryQcBuckets('ID-F001')
  const idf001Summary = getFutureMobileFactoryQcSummary('ID-F001')
  const idf004Summary = getFutureMobileFactoryQcSummary('ID-F004')
  const processedFactoryId = ['ID-F001', 'ID-F002', 'ID-F003', 'ID-F004', 'ID-F005'].find(
    (factoryId) => listFutureMobileFactoryQcBuckets(factoryId).processed.length >= 1,
  )
  assert(idf001Buckets.pending.length >= 1, '工厂端待处理视图为空')
  assert(idf001Buckets.disputing.length >= 1, '工厂端异议中视图为空')
  assert(Boolean(processedFactoryId), '工厂端已处理视图为空')
  assert(idf001Buckets.history.length >= 1, '工厂端历史视图为空')
  assert(idf001Summary.pendingCount === idf001Buckets.pending.length, '工厂端待处理统计与视图不一致')
  assert(listFutureMobileFactorySoonOverdueQcItems('ID-F004').length >= 1, '工厂端即将超时统计缺少样例')

  const mobileSource = readFileSync(new URL('../src/pages/pda-quality.ts', import.meta.url), 'utf8')
  const settlementSource = readFileSync(new URL('../src/pages/pda-settlement.ts', import.meta.url), 'utf8')
  assert(mobileSource.includes('data-pda-quality-action="go-confirm"'), '工厂端质量页缺少确认入口')
  assert(mobileSource.includes('data-pda-quality-action="go-dispute"'), '工厂端质量页缺少异议入口')
  assert(mobileSource.includes('data-pda-quality-action="submit-confirm"'), '工厂端质量页缺少确认提交动作')
  assert(mobileSource.includes('data-pda-quality-action="submit-dispute"'), '工厂端质量页缺少异议提交动作')
  assert(!mobileSource.includes(legacyAdjustmentLabel), '工厂端质量页仍暴露旧的兼容调整口径')
  assert(!settlementSource.includes(`含${legacyAdjustmentLabel}`), '工厂端结算页仍暴露旧的兼容调整标签')
  assert(settlementSource.includes('正式流水'), '工厂端结算页未切到正式流水语义')
  assert(settlementSource.includes('对账与预付款'), '工厂端结算页未切到对账与预付款语义')
  assert(!settlementSource.includes('应付调整'), '工厂端结算页仍暴露应付调整口径')
  assert(!settlementSource.includes('其它扣款'), '工厂端结算页仍暴露其它扣款口径')

  const pendingDetail = getFutureMobileFactoryQcDetail('QC-NEW-001', 'ID-F001')
  assert(Boolean(pendingDetail), '缺少工厂端待处理样例 QC-NEW-001')
  assert(pendingDetail?.availableActions.includes('CONFIRM'), '待处理样例缺少确认动作')
  assert(pendingDetail?.availableActions.includes('DISPUTE'), '待处理样例缺少异议动作')

  const confirmResult = confirmQualityDeductionFactoryResponse({
    qcId: 'QC-NEW-001',
    responderUserName: '工厂财务-Adi',
    respondedAt: '2026-03-25 10:00:00',
    responseComment: '移动端确认处理',
  })
  assert(confirmResult.ok, '工厂端确认处理失败')

  const confirmedMobileDetail = getFutureMobileFactoryQcDetail('QC-NEW-001', 'ID-F001')
  const confirmedPlatformDetail = getPlatformQcDetailViewModelByRouteKey('QC-NEW-001')
  assert(confirmedMobileDetail?.factoryResponseStatus === 'CONFIRMED', '确认后工厂端状态未更新为已确认')
  assert(confirmedMobileDetail?.formalLedgerStatusLabel === '已生成正式质量扣款流水', '确认后工厂端未显示正式质量扣款流水')
  assert(confirmedPlatformDetail?.formalLedger?.triggerSource === 'FACTORY_CONFIRM', '确认后平台端未同步正式质量扣款流水')

  const disputeWithoutEvidence = submitQualityDeductionDispute({
    qcId: 'QC-NEW-005',
    submittedByUserName: '工厂厂长-Siti',
    submittedAt: '2026-03-25 11:00:00',
    disputeReasonCode: 'PROCESS_JUDGEMENT',
    disputeReasonName: '责任判定异议',
    disputeDescription: '仅文字，无证据，不应允许提交',
    disputeEvidenceAssets: [],
  })
  assert(!disputeWithoutEvidence.ok, '缺少证据的质量异议不应提交成功')

  const disputeResult = submitQualityDeductionDispute({
    qcId: 'QC-NEW-005',
    submittedByUserName: '工厂厂长-Siti',
    submittedAt: '2026-03-25 11:10:00',
    disputeReasonCode: 'PROCESS_JUDGEMENT',
    disputeReasonName: '责任判定异议',
    disputeDescription: '工厂认为责任数量需复核，已补充现场图片。',
    disputeEvidenceAssets: [{ assetId: 'TMP-001', name: '现场图片-01.jpg', assetType: 'IMAGE' }],
  })
  assert(disputeResult.ok, '工厂端发起质量异议失败')

  const idf004Buckets = listFutureMobileFactoryQcBuckets('ID-F004')
  const disputedMobileDetail = getFutureMobileFactoryQcDetail('QC-NEW-005', 'ID-F004')
  const disputedPlatformDetail = getPlatformQcDetailViewModelByRouteKey('QC-NEW-005')
  assert(idf004Buckets.pending.every((item) => item.qcId !== 'QC-NEW-005'), '异议提交后记录仍停留在待处理视图')
  assert(idf004Buckets.disputing.some((item) => item.qcId === 'QC-NEW-005'), '异议提交后记录未进入异议中视图')
  assert(disputedMobileDetail?.disputeStatus === 'PENDING_REVIEW', '异议提交后工厂端状态未进入待平台处理')
  assert(disputedMobileDetail?.submittedDisputeEvidenceAssets.length === 1, '异议提交后证据数量异常')
  assert(!getFormalQualityDeductionLedgerByQcId('QC-NEW-005'), '质量异议待裁决前不应生成正式质量扣款流水')
  assert(disputedPlatformDetail?.disputeCase?.status === 'PENDING_REVIEW', '异议提交后平台端未同步待平台处理状态')

  const adjudicatedDetail = getFutureMobileFactoryQcDetail('QC-NEW-004', 'ID-F001')
  assert(adjudicatedDetail?.adjudicationResultLabel === '最终部分工厂责任', '工厂端未暴露最终部分工厂责任结果')
  assert(adjudicatedDetail?.formalLedgerStatusLabel === '已生成正式质量扣款流水', '工厂端未暴露正式质量扣款流水状态')

  const pdaWritebackItems = listPdaSettlementWritebackItems(new Set(['ID-F001', 'ID-F004']))
  assert(pdaWritebackItems.every((item) => item.settlementAmount > 0), '工厂端预结算感知不应包含未成立的正式质量扣款流水')

  console.log(
    JSON.stringify(
      {
        idf001Pending: idf001Buckets.pending.length,
        idf001SoonOverdue: idf004Summary.soonOverdueCount,
        processedFactoryId,
        idf004Disputing: idf004Buckets.disputing.length,
        confirmedQcId: confirmedMobileDetail?.qcId,
        disputedQcId: disputedMobileDetail?.qcId,
        adjudicatedQcId: adjudicatedDetail?.qcId,
        pdaWritebackCount: pdaWritebackItems.length,
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
