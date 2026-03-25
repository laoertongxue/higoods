#!/usr/bin/env node

import process from 'node:process'
import { readFileSync } from 'node:fs'
import {
  confirmQualityDeductionFactoryResponse,
  submitQualityDeductionDispute,
} from '../src/data/fcs/quality-deduction-repository.ts'
import {
  getFutureMobileFactoryQcDetail,
  getFutureMobileFactoryQcSummary,
  getPlatformQcDetailViewModelByRouteKey,
  listFutureMobileFactoryQcBuckets,
} from '../src/data/fcs/quality-deduction-selectors.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function main(): void {
  const idf001Buckets = listFutureMobileFactoryQcBuckets('ID-F001')
  const idf001Summary = getFutureMobileFactoryQcSummary('ID-F001')

  assert(idf001Buckets.pending.length >= 1, '工厂端待处理 bucket 为空')
  assert(idf001Buckets.disputing.length >= 1, '工厂端异议中 bucket 为空')
  assert(idf001Buckets.processed.length >= 1, '工厂端已处理 bucket 为空')
  assert(idf001Buckets.history.length >= 1, '工厂端历史 bucket 为空')
  assert(idf001Summary.pendingCount === idf001Buckets.pending.length, '工厂端待处理统计与 bucket 不一致')
  assert(idf001Summary.soonOverdueCount >= 1, '工厂端即将超时统计未命中样例')

  const mobileSource = readFileSync(new URL('../src/pages/pda-quality.ts', import.meta.url), 'utf8')
  const settlementSource = readFileSync(new URL('../src/pages/pda-settlement.ts', import.meta.url), 'utf8')
  const shellSource = readFileSync(new URL('../src/pages/pda-shell.ts', import.meta.url), 'utf8')
  const appShellSource = readFileSync(new URL('../src/data/app-shell-config.ts', import.meta.url), 'utf8')
  const notifySource = readFileSync(new URL('../src/pages/pda-notify.ts', import.meta.url), 'utf8')
  const dueSoonSource = readFileSync(new URL('../src/pages/pda-notify-due-soon.ts', import.meta.url), 'utf8')
  assert(mobileSource.includes('data-pda-quality-action="go-confirm"'), '工厂端待处理卡片未渲染确认处理入口')
  assert(mobileSource.includes('data-pda-quality-action="go-dispute"'), '工厂端待处理卡片未渲染发起异议入口')
  assert(mobileSource.includes('data-pda-quality-action="submit-confirm"'), '工厂端详情未接确认处理提交动作')
  assert(mobileSource.includes('data-pda-quality-action="submit-dispute"'), '工厂端详情未接发起异议提交动作')
  assert(!shellSource.includes("key: 'quality'"), 'PDA 底部 Tab 仍暴露独立“质检处理”')
  assert(!appShellSource.includes("key: 'pda-quality'"), '工厂端应用菜单仍暴露独立“质检处理”')
  assert(settlementSource.includes('质检扣款待处理'), '结算页未承接质检扣款待处理分组')
  assert(settlementSource.includes('质检扣款即将逾期'), '结算页未承接质检扣款即将逾期分组')
  assert(settlementSource.includes("data-pda-sett-action=\"set-quality-view\""), '结算页未提供质检扣款分组切换')
  assert(
    settlementSource.includes('renderQualityQuickActionCards(factoryId, { workbench: true })'),
    '质检扣款页顶部待办摘要未收口为工作台专用模式',
  )
  assert(settlementSource.includes('function sortSettlementQualityItems('), '结算页未定义质检扣款工作台排序逻辑')
  assert(
    settlementSource.includes("view === 'pending' || view === 'soon'") &&
      settlementSource.includes('getQualitySortTime(left.responseDeadlineAt'),
    '待处理/即将逾期视图未按 deadline 紧急程度排序',
  )
  assert(
    settlementSource.includes('getQualitySortTime(left.submittedAt)') &&
      settlementSource.includes('getQualitySortTime(left.respondedAt)'),
    '异议中/已处理视图未按最近状态时间排序',
  )
  assert(notifySource.includes('质检扣款待处理'), '待办页未接入质检扣款待处理')
  assert(notifySource.includes('质检扣款即将逾期'), '待办页未接入质检扣款即将逾期')
  assert(dueSoonSource.includes('结算类'), '即将逾期页未接入结算类分组')
  assert(dueSoonSource.includes('质检扣款'), '即将逾期页未接入质检扣款项')

  const pendingDetail = getFutureMobileFactoryQcDetail('QC-NEW-001', 'ID-F001')
  assert(Boolean(pendingDetail), '缺少待处理详情样例 QC-NEW-001')
  assert(pendingDetail?.availableActions.includes('CONFIRM'), '待处理详情缺少确认处理动作')
  assert(pendingDetail?.availableActions.includes('DISPUTE'), '待处理详情缺少发起异议动作')
  assert(pendingDetail?.inspectedQty === pendingDetail?.qualifiedQty + pendingDetail?.unqualifiedQty, '移动端数量三态口径错误')
  assert(
    pendingDetail?.blockedProcessingFeeAmount !== pendingDetail?.effectiveQualityDeductionAmount,
    '移动端冻结加工费金额与质量扣款金额被混用',
  )

  const confirmResult = confirmQualityDeductionFactoryResponse({
    qcId: 'QC-NEW-001',
    responderUserName: '工厂财务-Adi',
    respondedAt: '2026-03-25 10:00:00',
    responseComment: '移动端确认处理',
  })
  assert(confirmResult.ok, '确认处理写回共享源失败')

  const confirmedMobileDetail = getFutureMobileFactoryQcDetail('QC-NEW-001', 'ID-F001')
  const confirmedPlatformDetail = getPlatformQcDetailViewModelByRouteKey('QC-NEW-001')
  assert(confirmedMobileDetail?.factoryResponseStatus === 'CONFIRMED', '确认后移动端状态未更新为已确认')
  assert(confirmedMobileDetail?.settlementImpactStatus === 'ELIGIBLE', '确认后移动端结算状态未进入可结算')
  assert(confirmedMobileDetail?.availableActions.length === 0, '确认后移动端仍保留确认/异议动作')
  assert(confirmedPlatformDetail?.factoryResponse?.factoryResponseStatus === 'CONFIRMED', '确认后平台端仍未同步为已确认')
  assert(confirmedPlatformDetail?.settlementImpact.status === 'ELIGIBLE', '确认后平台端结算状态未同步')

  const disputeWithoutEvidence = submitQualityDeductionDispute({
    qcId: 'QC-NEW-005',
    submittedByUserName: '工厂厂长-Siti',
    submittedAt: '2026-03-25 11:00:00',
    disputeReasonCode: 'PROCESS_JUDGEMENT',
    disputeReasonName: '责任判定异议',
    disputeDescription: '仅文字，无证据，不应允许提交',
    disputeEvidenceAssets: [],
  })
  assert(!disputeWithoutEvidence.ok, '未上传证据的异议不应提交成功')

  const disputeResult = submitQualityDeductionDispute({
    qcId: 'QC-NEW-005',
    submittedByUserName: '工厂厂长-Siti',
    submittedAt: '2026-03-25 11:10:00',
    disputeReasonCode: 'PROCESS_JUDGEMENT',
    disputeReasonName: '责任判定异议',
    disputeDescription: '工厂认为裁片报废数量需复核，已补充现场图片与视频。',
    disputeEvidenceAssets: [
      { assetId: 'TMP-001', name: '裁片现场照片-01.jpg', assetType: 'IMAGE' },
      { assetId: 'TMP-002', name: '裁片现场视频-01.mp4', assetType: 'VIDEO' },
    ],
  })
  assert(disputeResult.ok, '发起异议写回共享源失败')

  const idf004Buckets = listFutureMobileFactoryQcBuckets('ID-F004')
  const disputedMobileDetail = getFutureMobileFactoryQcDetail('QC-NEW-005', 'ID-F004')
  const disputedPlatformDetail = getPlatformQcDetailViewModelByRouteKey('QC-NEW-005')
  assert(idf004Buckets.pending.every((item) => item.qcId !== 'QC-NEW-005'), '异议提交后记录仍停留在待处理')
  assert(idf004Buckets.disputing.some((item) => item.qcId === 'QC-NEW-005'), '异议提交后记录未进入异议中')
  assert(disputedMobileDetail?.disputeStatus === 'PENDING_REVIEW', '异议提交后移动端异议状态未更新为待平台审核')
  assert(disputedMobileDetail?.submittedDisputeEvidenceAssets.length === 2, '异议提交后移动端证据数量异常')
  assert(Boolean(disputedMobileDetail?.disputeId), '异议提交后未生成 dispute case')
  assert(disputedPlatformDetail?.disputeCase?.status === 'PENDING_REVIEW', '异议提交后平台端未同步为待平台审核')
  assert(disputedPlatformDetail?.factoryResponse?.factoryResponseStatus === 'DISPUTED', '异议提交后平台端响应状态未同步为已发起异议')
  assert(disputedPlatformDetail?.disputeEvidenceCount === disputedMobileDetail?.submittedDisputeEvidenceAssets.length, '平台端与移动端异议证据数量不一致')
  assert(
    disputedPlatformDetail?.settlementImpact.blockedProcessingFeeAmount === disputedMobileDetail?.blockedProcessingFeeAmount,
    '平台端与移动端冻结加工费金额不一致',
  )
  assert(
    disputedPlatformDetail?.settlementImpact.effectiveQualityDeductionAmount === disputedMobileDetail?.effectiveQualityDeductionAmount,
    '平台端与移动端生效质量扣款金额不一致',
  )

  const adjudicatedDetail = getFutureMobileFactoryQcDetail('QC-NEW-004', 'ID-F001')
  assert(Boolean(adjudicatedDetail?.adjudicationResultLabel), '工厂端未暴露平台裁决结果摘要')
  assert(Boolean(adjudicatedDetail?.settlementAdjustmentSummary), '工厂端未暴露下周期调整摘要')

  console.log(
    JSON.stringify(
      {
        idf001Pending: idf001Buckets.pending.length,
        idf001SoonOverdue: idf001Summary.soonOverdueCount,
        idf004Disputing: idf004Buckets.disputing.length,
        nearestPendingDeadline: idf001Summary.nearestPendingDeadlineAt,
        nearestSoonDeadline: idf001Summary.nearestSoonOverdueDeadlineAt,
        confirmedQcId: confirmedMobileDetail?.qcId,
        disputedQcId: disputedMobileDetail?.qcId,
        adjudicatedQcId: adjudicatedDetail?.qcId,
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
