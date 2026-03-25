#!/usr/bin/env node

import process from 'node:process'
import { readFileSync } from 'node:fs'
import {
  getFutureMobileFactoryQcDetail,
  getPlatformQcDetailViewModelByRouteKey,
  listFutureMobileFactoryQcBuckets,
  listPdaSettlementWritebackItems,
} from '../src/data/fcs/quality-deduction-selectors.ts'
import {
  confirmQualityDeductionFactoryResponse,
  submitQualityDeductionDispute,
} from '../src/data/fcs/quality-deduction-repository.ts'
import {
  adjudicateDisputeCase,
  autoConfirmOverdueQualityCases,
  findAutoConfirmCandidates,
  resetQualityDeductionNowForTest,
  setQualityDeductionNowForTest,
} from '../src/data/fcs/quality-deduction-lifecycle.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function main(): void {
  setQualityDeductionNowForTest('2026-03-25 10:00:00')

  const mobileSource = readFileSync(new URL('../src/pages/pda-quality.ts', import.meta.url), 'utf8')
  const platformListSource = readFileSync(new URL('../src/pages/qc-records/list-domain.ts', import.meta.url), 'utf8')
  const platformDetailSource = readFileSync(new URL('../src/pages/qc-records/detail-domain.ts', import.meta.url), 'utf8')
  assert(mobileSource.includes('data-pda-quality-action="go-confirm"'), '工厂端待处理卡片未渲染确认处理入口')
  assert(mobileSource.includes('data-pda-quality-action="go-dispute"'), '工厂端待处理卡片未渲染发起异议入口')
  assert(platformListSource.includes('data-qcr-action="handle-dispute"'), '平台列表未渲染处理异议入口')
  assert(platformDetailSource.includes('异议快捷处理'), '平台详情未承接异议快捷处理区')

  const autoConfirmCandidates = findAutoConfirmCandidates()
  assert(autoConfirmCandidates.some((item) => item.qcRecord.qcId === 'QC-RIB-202603-0003'), '链路 5：缺少自动确认候选样例')
  const chain5AutoConfirm = autoConfirmOverdueQualityCases()
  assert(chain5AutoConfirm.processedQcIds.includes('QC-RIB-202603-0003'), '链路 5：自动确认未处理超时记录')

  const mobileAfterAutoConfirm = getFutureMobileFactoryQcDetail('QC-RIB-202603-0003', 'ID-F004')
  const platformAfterAutoConfirm = getPlatformQcDetailViewModelByRouteKey('QC-RIB-202603-0003')
  assert(platformAfterAutoConfirm?.factoryResponse?.factoryResponseStatus === 'AUTO_CONFIRMED', '链路 5：平台端未同步自动确认')
  assert(mobileAfterAutoConfirm?.factoryResponseStatus === 'AUTO_CONFIRMED', '链路 5：工厂端未同步自动确认')
  assert(platformAfterAutoConfirm?.settlementImpact.status === 'ELIGIBLE', '链路 5：自动确认后未进入可结算')

  const chain1Confirm = confirmQualityDeductionFactoryResponse({
    qcId: 'QC-NEW-001',
    responderUserName: '工厂财务-Adi',
    respondedAt: '2026-03-25 10:05:00',
    responseComment: '工厂确认处理',
  })
  assert(chain1Confirm.ok, '链路 1：工厂确认处理失败')

  const mobileAfterConfirm = getFutureMobileFactoryQcDetail('QC-NEW-001', 'ID-F001')
  const platformAfterConfirm = getPlatformQcDetailViewModelByRouteKey('QC-NEW-001')
  const pdaAfterConfirm = listPdaSettlementWritebackItems(new Set(['ID-F001'])).find((item) => item.qcId === 'QC-NEW-001')
  assert(mobileAfterConfirm?.factoryResponseStatus === 'CONFIRMED', '链路 1：工厂端未同步为已确认')
  assert(platformAfterConfirm?.factoryResponse?.factoryResponseStatus === 'CONFIRMED', '链路 1：平台端未同步为已确认')
  assert(platformAfterConfirm?.settlementImpact.status === 'ELIGIBLE', '链路 1：平台端未进入可结算')
  assert(pdaAfterConfirm?.settlementStatusText === platformAfterConfirm?.settlementImpactStatusLabel, '链路 1：PDA 结算感知状态未同步')
  assert(listFutureMobileFactoryQcBuckets('ID-F001').pending.every((item) => item.qcId !== 'QC-NEW-001'), '链路 1：确认后记录仍在待处理')

  const chain2Dispute = submitQualityDeductionDispute({
    qcId: 'QC-NEW-005',
    submittedByUserName: '工厂厂长-Siti',
    submittedAt: '2026-03-25 10:20:00',
    disputeReasonCode: 'PROCESS_JUDGEMENT',
    disputeReasonName: '责任判定异议',
    disputeDescription: '工厂认为责任数量和扣款口径需要复核，补充提交现场图片与视频。',
    disputeEvidenceAssets: [
      { assetId: 'CHAIN2-IMG', name: '工厂异议图片-01.jpg', assetType: 'IMAGE' },
      { assetId: 'CHAIN2-VID', name: '工厂异议视频-01.mp4', assetType: 'VIDEO' },
    ],
  })
  assert(chain2Dispute.ok, '链路 2：工厂发起异议失败')

  const mobileAfterDispute = getFutureMobileFactoryQcDetail('QC-NEW-005', 'ID-F004')
  const platformAfterDispute = getPlatformQcDetailViewModelByRouteKey('QC-NEW-005')
  assert(mobileAfterDispute?.disputeStatus === 'PENDING_REVIEW', '链路 2：工厂端未进入异议中')
  assert(mobileAfterDispute?.submittedDisputeEvidenceAssets.length === 2, '链路 2：工厂端异议证据未写回')
  assert(platformAfterDispute?.disputeCase?.status === 'PENDING_REVIEW', '链路 2：平台端未看到待平台处理')
  assert(platformAfterDispute?.factoryResponse?.factoryResponseStatus === 'DISPUTED', '链路 2：平台端未看到已发起异议')
  assert(platformDetailSource.includes('data-qcd-action="submit-adjudication"'), '链路 2：平台详情未接裁决提交按钮')

  const chain3Upheld = adjudicateDisputeCase({
    qcId: 'QC-NEW-005',
    reviewerUserName: '平台运营-裁决',
    adjudicatedAt: '2026-03-25 10:40:00',
    adjudicationResult: 'UPHELD',
    adjudicationComment: '复核仓库证据与工厂上传素材后，维持原判。',
  })
  assert(chain3Upheld.ok, '链路 3：平台维持原判失败')

  const mobileAfterUpheld = getFutureMobileFactoryQcDetail('QC-NEW-005', 'ID-F004')
  const platformAfterUpheld = getPlatformQcDetailViewModelByRouteKey('QC-NEW-005')
  assert(platformAfterUpheld?.disputeCase?.status === 'UPHELD', '链路 3：平台端未同步维持原判')
  assert(mobileAfterUpheld?.adjudicationResultLabel === '维持原判', '链路 3：工厂端未同步维持原判')
  assert(platformAfterUpheld?.settlementImpact.status === 'ELIGIBLE', '链路 3：维持原判后未进入可结算')

  const chain4PartialAdjust = adjudicateDisputeCase({
    qcId: 'QC-RIB-202603-0002',
    reviewerUserName: '平台运营-裁决',
    adjudicatedAt: '2026-03-25 11:00:00',
    adjudicationResult: 'PARTIALLY_ADJUSTED',
    adjudicationComment: '当前批次已锁账，减少扣款差额转下周期调整。',
    adjustedLiableQty: 32,
    adjustedBlockedProcessingFeeAmount: 0,
    adjustedEffectiveQualityDeductionAmount: 960,
    adjustmentReasonSummary: '锁账后通过下周期减扣回写差额。',
  })
  assert(chain4PartialAdjust.ok, '链路 4：平台部分调整失败')

  const platformAfterPartial = getPlatformQcDetailViewModelByRouteKey('QC-RIB-202603-0002')
  const mobileAfterPartial = getFutureMobileFactoryQcDetail('QC-RIB-202603-0002', 'ID-F001')
  assert(platformAfterPartial?.settlementImpact.status === 'NEXT_CYCLE_ADJUSTMENT_PENDING', '链路 4：部分调整后未进入待下周期调整')
  assert(platformAfterPartial?.settlementAdjustment?.adjustmentType === 'DECREASE_DEDUCTION', '链路 4：未生成减少扣款 adjustment')
  assert(platformAfterPartial?.settlementAdjustment?.adjustmentAmount === 804, '链路 4：adjustment 金额错误')
  assert(mobileAfterPartial?.settlementAdjustmentSummary === platformAfterPartial?.settlementAdjustment?.summary, '链路 4：工厂端未同步 adjustment 摘要')

  console.log(
    JSON.stringify(
      {
        chain1Confirm: {
          qcId: platformAfterConfirm?.qcId,
          mobileStatus: mobileAfterConfirm?.factoryResponseStatusLabel,
          platformStatus: platformAfterConfirm?.factoryResponseStatusLabel,
          settlement: platformAfterConfirm?.settlementImpactStatusLabel,
        },
        chain2Dispute: {
          qcId: platformAfterDispute?.qcId,
          platformDisputeStatus: platformAfterDispute?.disputeStatusLabel,
          evidenceCount: mobileAfterDispute?.submittedDisputeEvidenceAssets.length,
        },
        chain3Upheld: {
          qcId: platformAfterUpheld?.qcId,
          result: platformAfterUpheld?.disputeStatusLabel,
          settlement: platformAfterUpheld?.settlementImpactStatusLabel,
        },
        chain4PartialAdjust: {
          qcId: platformAfterPartial?.qcId,
          adjustmentType: platformAfterPartial?.settlementAdjustment?.adjustmentType,
          adjustmentAmount: platformAfterPartial?.settlementAdjustment?.adjustmentAmount,
          settlement: platformAfterPartial?.settlementImpactStatusLabel,
        },
        chain5AutoConfirm: {
          qcId: platformAfterAutoConfirm?.qcId,
          status: platformAfterAutoConfirm?.factoryResponseStatusLabel,
          settlement: platformAfterAutoConfirm?.settlementImpactStatusLabel,
        },
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
