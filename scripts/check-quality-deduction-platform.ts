#!/usr/bin/env node

import process from 'node:process'
import { readFileSync } from 'node:fs'
import {
  getPlatformQcDetailViewModelByRouteKey,
  getPlatformQcWorkbenchStats,
  getPlatformQcWorkbenchTabCounts,
  listPlatformQcListItems,
  matchesPlatformQcWorkbenchView,
} from '../src/data/fcs/quality-deduction-selectors.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function main(): void {
  const rows = listPlatformQcListItems({ includeLegacy: false })
  const stats = getPlatformQcWorkbenchStats({ includeLegacy: false })
  const tabs = getPlatformQcWorkbenchTabCounts({ includeLegacy: false })

  assert(rows.length === 15, `平台质检工作台记录数异常: ${rows.length}`)
  assert(stats.totalCount === rows.length, '工作台总数统计与列表记录数不一致')
  assert(tabs.ALL === rows.length, '全部 tab 计数异常')
  assert(stats.waitFactoryResponseCount === tabs.WAIT_FACTORY_RESPONSE, '待工厂响应卡片与 tab 计数不一致')
  assert(stats.waitPlatformReviewCount === tabs.WAIT_PLATFORM_REVIEW, '待平台处理卡片与 tab 计数不一致')
  assert(stats.autoConfirmedCount === tabs.AUTO_CONFIRMED, '已自动确认卡片与 tab 计数不一致')

  assert(rows.every((row) => ['PASS', 'PARTIAL_PASS', 'FAIL'].includes(row.result)), '列表存在三态之外的质检结果')
  assert(rows.every((row) => row.inspector.trim().length > 0), '存在缺失质检人的平台列表记录')
  assert(
    rows.filter((row) => row.result === 'PASS').every((row) => row.disposition === undefined),
    '合格记录不应带有不合格品处置方式',
  )

  const pendingRows = rows.filter((row) => matchesPlatformQcWorkbenchView(row, 'WAIT_FACTORY_RESPONSE'))
  const autoConfirmedRows = rows.filter((row) => matchesPlatformQcWorkbenchView(row, 'AUTO_CONFIRMED'))
  const reviewRows = rows.filter((row) => matchesPlatformQcWorkbenchView(row, 'WAIT_PLATFORM_REVIEW'))
  assert(pendingRows.length >= 1, '待工厂响应视图为空')
  assert(autoConfirmedRows.length >= 1, '已自动确认视图为空')
  assert(reviewRows.length >= 1, '待平台处理视图为空')

  const listSource = readFileSync(new URL('../src/pages/qc-records/list-domain.ts', import.meta.url), 'utf8')
  const detailSource = readFileSync(new URL('../src/pages/qc-records/detail-domain.ts', import.meta.url), 'utf8')
  assert(listSource.includes('data-qcr-action="handle-dispute"'), '平台端列表未渲染“处理异议”真实入口')
  assert(detailSource.includes('异议快捷处理'), '平台端详情未承接从列表进入的异议快捷处理区')
  assert(detailSource.includes('data-qcd-action="submit-adjudication"'), '平台端详情未接裁决提交动作')

  const qualifiedDetail = getPlatformQcDetailViewModelByRouteKey('QC-NEW-007')
  const partialDetail = getPlatformQcDetailViewModelByRouteKey('QC-NEW-011')
  const unqualifiedDetail = getPlatformQcDetailViewModelByRouteKey('QC-NEW-005')
  const disputeDetail = getPlatformQcDetailViewModelByRouteKey('QC-NEW-002')
  const adjustedDetail = getPlatformQcDetailViewModelByRouteKey('QC-NEW-004')

  assert(qualifiedDetail?.qcResultLabel === '合格', '合格详情样例缺失或结果错误')
  assert(qualifiedDetail?.showUnqualifiedHandling === false, '合格详情不应展示完整不合格处理区')
  assert(qualifiedDetail?.settlementImpact.blockedProcessingFeeAmount === 0, '合格详情冻结加工费应为 0')

  assert(partialDetail?.qcResultLabel === '部分合格', '部分合格详情样例缺失或结果错误')
  assert(partialDetail?.qcRecord.qualifiedQty > 0 && partialDetail?.qcRecord.unqualifiedQty > 0, '部分合格数量口径错误')

  assert(unqualifiedDetail?.qcResultLabel === '不合格', '不合格详情样例缺失或结果错误')
  assert(unqualifiedDetail?.qcRecord.qualifiedQty === 0, '不合格记录不应存在合格数量')
  assert(unqualifiedDetail?.showUnqualifiedHandling === true, '不合格详情必须展示不合格处理区')

  assert(disputeDetail?.canHandleDispute === true, '待平台处理记录未暴露处理异议入口')
  assert(
    disputeDetail?.settlementImpact.blockedProcessingFeeAmount !== disputeDetail?.settlementImpact.effectiveQualityDeductionAmount,
    '冻结加工费金额与质量扣款金额不应混用',
  )

  assert(adjustedDetail?.settlementAdjustment?.adjustmentAmount === 240, '改判调整项金额错误')
  assert(adjustedDetail?.settlementImpact.effectiveQualityDeductionAmount === 860, '改判后生效质量扣款金额错误')
  assert(disputeDetail?.warehouseEvidenceCount !== undefined, '详情 view model 缺少仓库证据计数')
  assert(disputeDetail?.disputeEvidenceCount !== undefined, '详情 view model 缺少工厂异议证据计数')
  assert(Boolean(disputeDetail?.deductionBasis?.basisId), '详情 view model 缺少扣款依据对象')
  assert(Boolean(disputeDetail?.settlementImpact?.impactId), '详情 view model 缺少结算影响对象')

  console.log(
    JSON.stringify(
      {
        rowCount: rows.length,
        waitFactoryResponseCount: stats.waitFactoryResponseCount,
        autoConfirmedCount: stats.autoConfirmedCount,
        waitPlatformReviewCount: stats.waitPlatformReviewCount,
        blockedOrReadyCount: stats.blockedOrReadyCount,
        qualifiedSample: qualifiedDetail?.qcId,
        partialSample: partialDetail?.qcId,
        unqualifiedSample: unqualifiedDetail?.qcId,
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
