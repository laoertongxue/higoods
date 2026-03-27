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
  if (!condition) throw new Error(message)
}

function main(): void {
  const rows = listPlatformQcListItems({ includeLegacy: false })
  const stats = getPlatformQcWorkbenchStats({ includeLegacy: false })
  const tabs = getPlatformQcWorkbenchTabCounts({ includeLegacy: false })

  assert(rows.length >= 15, `平台端质检记录数量偏少: ${rows.length}`)
  assert(stats.totalCount === rows.length, '平台端总数统计与列表行数不一致')
  assert(tabs.ALL === rows.length, '全部视图计数错误')
  assert(stats.waitFactoryResponseCount === tabs.WAIT_FACTORY_RESPONSE, '待工厂处理计数不一致')
  assert(stats.waitPlatformReviewCount === tabs.WAIT_PLATFORM_REVIEW, '待平台处理计数不一致')
  assert(stats.autoConfirmedCount === tabs.AUTO_CONFIRMED, '系统自动确认计数不一致')

  assert(rows.some((row) => matchesPlatformQcWorkbenchView(row, 'WAIT_FACTORY_RESPONSE')), '平台端缺少待工厂处理样例')
  assert(rows.some((row) => matchesPlatformQcWorkbenchView(row, 'WAIT_PLATFORM_REVIEW')), '平台端缺少待平台处理异议样例')
  assert(rows.some((row) => matchesPlatformQcWorkbenchView(row, 'AUTO_CONFIRMED')), '平台端缺少系统自动确认样例')

  const listSource = readFileSync(new URL('../src/pages/qc-records/list-domain.ts', import.meta.url), 'utf8')
  const detailSource = readFileSync(new URL('../src/pages/qc-records/detail-domain.ts', import.meta.url), 'utf8')
  assert(listSource.includes('查看详情'), '平台端质检列表缺少查看详情入口')
  assert(listSource.includes('处理异议'), '平台端质检列表缺少处理异议入口')
  assert(detailSource.includes('待确认质量扣款记录'), '平台端详情未暴露待确认质量扣款记录区块')
  assert(detailSource.includes('正式质量扣款流水与预结算衔接'), '平台端详情未暴露正式质量扣款流水区块')
  assert(detailSource.includes('data-qcd-action="submit-adjudication"'), '平台端详情未接平台裁决提交动作')

  const pendingDetail = getPlatformQcDetailViewModelByRouteKey('QC-NEW-005')
  const disputeDetail = getPlatformQcDetailViewModelByRouteKey('QC-NEW-006')
  const autoConfirmedDetail = getPlatformQcDetailViewModelByRouteKey('QC-RIB-202603-0003')
  const partialDetail = getPlatformQcDetailViewModelByRouteKey('QC-NEW-004')
  const reversedDetail = getPlatformQcDetailViewModelByRouteKey('QC-021')

  assert(pendingDetail?.pendingDeductionRecord?.status === 'PENDING_FACTORY_CONFIRM', '待工厂处理详情未命中待确认质量扣款记录')
  assert(!pendingDetail?.formalLedger, '待工厂处理详情不应提前展示正式质量扣款流水')
  assert(disputeDetail?.disputeCase?.status === 'PENDING_REVIEW', '待平台处理样例状态错误')
  assert(!disputeDetail?.formalLedger, '待平台处理异议样例不应提前展示正式质量扣款流水')
  assert(autoConfirmedDetail?.pendingDeductionRecord?.status === 'SYSTEM_AUTO_CONFIRMED', '系统自动确认样例状态错误')
  assert(autoConfirmedDetail?.formalLedger?.status === 'GENERATED_PENDING_STATEMENT', '系统自动确认样例未展示正式质量扣款流水')
  assert(partialDetail?.formalLedger?.settlementAmount === 860, '部分工厂责任样例正式质量扣款流水金额错误')
  assert(reversedDetail?.disputeCase?.status === 'REVERSED', '非工厂责任样例状态错误')
  assert(!reversedDetail?.formalLedger, '非工厂责任样例不应展示正式质量扣款流水')

  console.log(
    JSON.stringify(
      {
        rowCount: rows.length,
        waitFactoryResponseCount: stats.waitFactoryResponseCount,
        waitPlatformReviewCount: stats.waitPlatformReviewCount,
        autoConfirmedCount: stats.autoConfirmedCount,
        samplePendingQcId: pendingDetail?.qcId,
        sampleDisputeQcId: disputeDetail?.qcId,
        sampleAutoConfirmedQcId: autoConfirmedDetail?.qcId,
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
