#!/usr/bin/env node

import process from 'node:process'
import { readFileSync } from 'node:fs'
import {
  getFutureMobileFactoryQcDetail,
  getFutureMobileFactoryQcSummary,
  getPlatformQcDetailViewModelByRouteKey,
  listFutureMobileFactoryQcBuckets,
  listPdaSettlementWritebackItems,
} from '../src/data/fcs/quality-deduction-selectors.ts'
import {
  confirmQualityDeductionFactoryResponse,
  getFormalQualityDeductionLedgerByQcId,
  getPendingQualityDeductionRecordByQcId,
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

  assert(
    /data-nav="\$\{escapeHtml\(detailHref\)\}"[\s\S]*?>\s*查看详情\s*<\/button>/.test(platformListSource),
    '平台列表未渲染真实查看详情入口',
  )
  assert(
    /data-nav="\$\{escapeHtml\(disputeHref\)\}"[\s\S]*?>\s*处理异议\s*<\/button>/.test(platformListSource),
    '平台列表未渲染处理异议入口',
  )
  assert(mobileSource.includes('data-pda-quality-action="go-confirm"'), '工厂端待处理卡片未渲染确认处理入口')
  assert(mobileSource.includes('data-pda-quality-action="go-dispute"'), '工厂端待处理卡片未渲染发起异议入口')
  assert(platformDetailSource.includes('平台裁决操作'), '平台详情未承接平台裁决操作区')
  assert(platformDetailSource.includes('data-qcd-action="submit-adjudication"'), '平台详情未接裁决提交按钮')
  assert(platformDetailSource.includes('待确认质量扣款记录'), '平台详情未展示待确认质量扣款记录区块')
  assert(platformDetailSource.includes('正式质量扣款流水与预结算衔接'), '平台详情未展示正式质量扣款流水区块')

  const autoConfirmCandidates = findAutoConfirmCandidates()
  assert(autoConfirmCandidates.some((item) => item.qcRecord.qcId === 'QC-RIB-202603-0003'), '缺少系统自动确认样例')
  const autoConfirmResult = autoConfirmOverdueQualityCases()
  const platformAfterAutoConfirm = getPlatformQcDetailViewModelByRouteKey('QC-RIB-202603-0003')
  const mobileAfterAutoConfirm = getFutureMobileFactoryQcDetail('QC-RIB-202603-0003', 'ID-F004')
  assert(autoConfirmResult.processedQcIds.includes('QC-RIB-202603-0003'), '系统自动确认未处理超时记录')
  assert(getPendingQualityDeductionRecordByQcId('QC-RIB-202603-0003')?.status === 'SYSTEM_AUTO_CONFIRMED', '系统自动确认后待确认质量扣款记录状态错误')
  assert(Boolean(getFormalQualityDeductionLedgerByQcId('QC-RIB-202603-0003')), '系统自动确认后未生成正式质量扣款流水')
  assert(!platformAfterAutoConfirm?.disputeCase, '系统自动确认不应生成质量异议单')
  assert(platformAfterAutoConfirm?.settlementImpactStatusLabel === '已生成正式质量扣款流水', '平台端未同步系统自动确认后的正式流水状态')
  assert(mobileAfterAutoConfirm?.formalLedgerStatusLabel === '已生成正式质量扣款流水', '工厂端未同步系统自动确认后的正式流水状态')

  const detailSamples = ['QC-NEW-001', 'QC-NEW-005', 'QC-RIB-202603-0003']
  assert(
    detailSamples.every((qcId) => Boolean(getPlatformQcDetailViewModelByRouteKey(qcId))),
    '至少一条平台详情样例无法打开',
  )

  const pendingBeforeConfirm = getFutureMobileFactoryQcSummary('ID-F001').pendingCount
  const confirmResult = confirmQualityDeductionFactoryResponse({
    qcId: 'QC-NEW-001',
    responderUserName: '工厂主管-Adi',
    respondedAt: '2026-03-25 10:10:00',
    responseComment: '工厂确认责任数量与扣款金额',
  })
  const platformAfterConfirm = getPlatformQcDetailViewModelByRouteKey('QC-NEW-001')
  const mobileAfterConfirm = getFutureMobileFactoryQcDetail('QC-NEW-001', 'ID-F001')
  const confirmedLedger = getFormalQualityDeductionLedgerByQcId('QC-NEW-001')
  assert(confirmResult.ok, '工厂确认处理失败')
  assert(getPendingQualityDeductionRecordByQcId('QC-NEW-001')?.status === 'FACTORY_CONFIRMED', '工厂确认后待确认质量扣款记录状态错误')
  assert(Boolean(confirmedLedger), '工厂确认后未生成正式质量扣款流水')
  assert(platformAfterConfirm?.formalLedger?.ledgerId === confirmedLedger?.ledgerId, '平台端未同步工厂确认后的正式质量扣款流水')
  assert(mobileAfterConfirm?.factoryResponseStatusLabel === '工厂已确认', '工厂端未同步已确认状态')
  assert(getFutureMobileFactoryQcSummary('ID-F001').pendingCount === pendingBeforeConfirm - 1, '工厂确认后待处理数量未减少')

  const pendingBeforeDispute = getFutureMobileFactoryQcSummary('ID-F004').pendingCount
  const disputeSubmitResult = submitQualityDeductionDispute({
    qcId: 'QC-NEW-005',
    submittedByUserName: '工厂主管-Siti',
    submittedAt: '2026-03-25 10:20:00',
    disputeReasonCode: 'PROCESS_JUDGEMENT',
    disputeReasonName: '责任判定异议',
    disputeDescription: '工厂补充现场图片，请平台复核当前责任数量与金额。',
    disputeEvidenceAssets: [{ assetId: 'CHAIN-IMG-001', name: '现场图片-01.jpg', assetType: 'IMAGE' }],
  })
  const platformAfterDispute = getPlatformQcDetailViewModelByRouteKey('QC-NEW-005')
  const mobileAfterDispute = getFutureMobileFactoryQcDetail('QC-NEW-005', 'ID-F004')
  const pdaWritebackAfterDispute = listPdaSettlementWritebackItems(new Set(['ID-F004']))
  const noLedgerBeforeAdjudication = !getFormalQualityDeductionLedgerByQcId('QC-NEW-005')
  assert(disputeSubmitResult.ok, '工厂发起质量异议失败')
  assert(getPendingQualityDeductionRecordByQcId('QC-NEW-005')?.status === 'DISPUTED', '发起异议后待确认质量扣款记录状态错误')
  assert(platformAfterDispute?.disputeCase?.status === 'PENDING_REVIEW', '平台端未同步为待平台处理')
  assert(noLedgerBeforeAdjudication, '待平台处理异议前不应生成正式质量扣款流水')
  assert(mobileAfterDispute?.disputeStatusLabel === '待平台处理', '工厂端未同步为待平台处理')
  assert(getFutureMobileFactoryQcSummary('ID-F004').pendingCount === pendingBeforeDispute - 1, '发起异议后待处理数量未减少')
  assert(!pdaWritebackAfterDispute.some((item) => item.qcId === 'QC-NEW-005'), '待平台处理异议前不应进入工厂端正式流水视图')

  const upheldResult = adjudicateDisputeCase({
    qcId: 'QC-NEW-005',
    reviewerUserName: '平台运营-裁决',
    adjudicatedAt: '2026-03-25 10:40:00',
    adjudicationResult: 'UPHELD',
    adjudicationComment: '复核仓库证据与工厂补充素材后，最终维持工厂责任。',
  })
  const platformAfterUpheld = getPlatformQcDetailViewModelByRouteKey('QC-NEW-005')
  const mobileAfterUpheld = getFutureMobileFactoryQcDetail('QC-NEW-005', 'ID-F004')
  const upheldLedger = getFormalQualityDeductionLedgerByQcId('QC-NEW-005')
  assert(upheldResult.ok, '最终维持工厂责任裁决失败')
  assert(Boolean(upheldLedger), '最终维持工厂责任后未生成正式质量扣款流水')
  assert(platformAfterUpheld?.disputeStatusLabel === '最终维持工厂责任', '平台端未同步维持工厂责任裁决结果')
  assert(mobileAfterUpheld?.formalLedgerStatusLabel === '已生成正式质量扣款流水', '工厂端未同步维持工厂责任后的正式流水状态')

  const partialResult = adjudicateDisputeCase({
    qcId: 'QC-NEW-002',
    reviewerUserName: '平台运营-裁决',
    adjudicatedAt: '2026-03-25 11:00:00',
    adjudicationResult: 'PARTIALLY_ADJUSTED',
    adjudicationComment: '复核后调整为部分工厂责任，按裁决金额生成正式质量扣款流水。',
    adjustedLiableQty: 31,
    adjustedBlockedProcessingFeeAmount: 0,
    adjustedEffectiveQualityDeductionAmount: 1180,
    adjustmentReasonSummary: '部分责任成立，按裁决金额回写正式质量扣款流水。',
  })
  const platformAfterPartial = getPlatformQcDetailViewModelByRouteKey('QC-NEW-002')
  const mobileAfterPartial = getFutureMobileFactoryQcDetail('QC-NEW-002', 'ID-F001')
  const partialLedger = getFormalQualityDeductionLedgerByQcId('QC-NEW-002')
  assert(partialResult.ok, '最终部分工厂责任裁决失败')
  assert(partialLedger?.settlementAmount === 1180, `部分工厂责任正式质量扣款流水金额错误: ${partialLedger?.settlementAmount}`)
  assert(platformAfterPartial?.disputeStatusLabel === '最终部分工厂责任', '平台端未同步部分工厂责任裁决结果')
  assert(mobileAfterPartial?.adjudicationResultLabel === '最终部分工厂责任', '工厂端未同步部分工厂责任裁决结果')

  const reversedResult = adjudicateDisputeCase({
    qcId: 'QC-NEW-006',
    reviewerUserName: '平台运营-裁决',
    adjudicatedAt: '2026-03-25 11:20:00',
    adjudicationResult: 'REVERSED',
    adjudicationComment: '平台复核后认定为非工厂责任，不生成正式质量扣款流水。',
  })
  const platformAfterReversed = getPlatformQcDetailViewModelByRouteKey('QC-NEW-006')
  const mobileAfterReversed = getFutureMobileFactoryQcDetail('QC-NEW-006', 'ID-F004')
  assert(reversedResult.ok, '最终非工厂责任裁决失败')
  assert(getPendingQualityDeductionRecordByQcId('QC-NEW-006')?.status === 'CLOSED_WITHOUT_LEDGER', '最终非工厂责任后待确认质量扣款记录应关闭')
  assert(!getFormalQualityDeductionLedgerByQcId('QC-NEW-006'), '最终非工厂责任不应生成正式质量扣款流水')
  assert(platformAfterReversed?.settlementImpactStatusLabel === '未形成正式质量扣款流水', '平台端未同步非工厂责任后的关闭结果')
  assert(mobileAfterReversed?.settlementImpactStatusLabel === '未形成正式质量扣款流水', '工厂端未同步非工厂责任后的关闭结果')

  const mobileBuckets = listFutureMobileFactoryQcBuckets('ID-F004')
  assert(mobileBuckets.disputing.every((item) => item.disputeStatusLabel.includes('待平台处理') || item.disputeStatusLabel.includes('处理中')), '工厂端异议中分桶存在状态错位样例')

  console.log(
    JSON.stringify(
      {
        chainConfirm: {
          qcId: 'QC-NEW-001',
          ledgerId: confirmedLedger?.ledgerId,
          pendingAfter: getFutureMobileFactoryQcSummary('ID-F001').pendingCount,
        },
        chainDispute: {
          qcId: 'QC-NEW-005',
          disputeStatus: platformAfterDispute?.disputeStatusLabel,
          noFormalLedgerBeforeAdjudication: noLedgerBeforeAdjudication,
        },
        chainUpheld: {
          qcId: 'QC-NEW-005',
          ledgerId: upheldLedger?.ledgerId,
          status: platformAfterUpheld?.disputeStatusLabel,
        },
        chainPartial: {
          qcId: 'QC-NEW-002',
          ledgerAmount: partialLedger?.settlementAmount,
          status: platformAfterPartial?.disputeStatusLabel,
        },
        chainReversed: {
          qcId: 'QC-NEW-006',
          pendingStatus: getPendingQualityDeductionRecordByQcId('QC-NEW-006')?.status,
          ledger: Boolean(getFormalQualityDeductionLedgerByQcId('QC-NEW-006')),
        },
        chainAutoConfirm: {
          qcId: 'QC-RIB-202603-0003',
          processed: autoConfirmResult.processedQcIds.includes('QC-RIB-202603-0003'),
          ledger: Boolean(getFormalQualityDeductionLedgerByQcId('QC-RIB-202603-0003')),
        },
        detailSamples,
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
