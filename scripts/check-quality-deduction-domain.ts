#!/usr/bin/env node

import process from 'node:process'
import {
  getPlatformQcDetailViewModelByRouteKey,
  getFutureMobileFactoryQcDetail,
  listFutureMobileFactoryQcBuckets,
  listFutureSettlementAdjustmentItems,
  listPdaSettlementWritebackItems,
  listPlatformQcListItems,
} from '../src/data/fcs/quality-deduction-selectors.ts'
import {
  getFormalQualityDeductionLedgerById,
  listFormalQualityDeductionLedgers,
  listPendingQualityDeductionRecords,
  listQualityDeductionCaseFacts,
  listQualityDeductionDisputeCases,
  traceQualityDeductionLedgerSource,
  validateQualityDeductionRepository,
} from '../src/data/fcs/quality-deduction-repository.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function main(): void {
  const validationIssues = validateQualityDeductionRepository()
  assert(validationIssues.length === 0, `质量扣款共享事实校验失败: ${validationIssues.map((item) => `${item.qcId}:${item.message}`).join('; ')}`)

  const activeCases = listQualityDeductionCaseFacts({ includeLegacy: false })
  const pendingRecords = listPendingQualityDeductionRecords({ includeLegacy: false })
  const disputes = listQualityDeductionDisputeCases({ includeLegacy: true })
  const ledgers = listFormalQualityDeductionLedgers({ includeLegacy: true })

  assert(activeCases.length >= 10, `质量链活跃样例不足: ${activeCases.length}`)
  assert(pendingRecords.length >= 2, '待确认质量扣款记录样例不足')
  assert(disputes.length >= 3, '质量异议单样例不足')
  assert(ledgers.length >= 3, '正式质量扣款流水样例不足')

  const pendingStatuses = new Set(pendingRecords.map((item) => item.status))
  assert(pendingStatuses.has('PENDING_FACTORY_CONFIRM'), '缺少待工厂处理样例')
  assert(pendingStatuses.has('FACTORY_CONFIRMED'), '缺少工厂已确认样例')
  assert(pendingStatuses.has('SYSTEM_AUTO_CONFIRMED'), '缺少系统自动确认样例')
  assert(pendingStatuses.has('DISPUTED'), '缺少已发起质量异议样例')

  const disputeStatuses = new Set(disputes.map((item) => item.status))
  assert(disputeStatuses.has('PENDING_REVIEW'), '缺少待平台处理异议样例')
  assert(disputeStatuses.has('UPHELD'), '缺少最终维持工厂责任样例')
  assert(disputeStatuses.has('PARTIALLY_ADJUSTED'), '缺少最终部分工厂责任样例')
  assert(disputeStatuses.has('REVERSED'), '缺少最终非工厂责任样例')

  assert(listFutureSettlementAdjustmentItems({ includeLegacy: false }).length === 0, '当前主链不应再输出 adjustment 列表')

  const platformRows = listPlatformQcListItems({ includeLegacy: false })
  const platformResults = new Set(platformRows.map((item) => item.result))
  assert(platformResults.has('PASS') && platformResults.has('PARTIAL_PASS') && platformResults.has('FAIL'), '平台端质检列表三态样例不完整')

  const ledgerSample = ledgers[0]
  const traced = ledgerSample ? traceQualityDeductionLedgerSource(ledgerSample.ledgerId) : null
  assert(Boolean(traced), '正式质量扣款流水溯源失败')
  assert(traced?.ledger.ledgerId === ledgerSample?.ledgerId, '正式质量扣款流水溯源结果不一致')
  assert(Boolean(getFormalQualityDeductionLedgerById(ledgerSample.ledgerId)), '正式质量扣款流水按编号查询失败')

  const pendingDetail = getPlatformQcDetailViewModelByRouteKey('QC-NEW-005')
  const disputeDetail = getPlatformQcDetailViewModelByRouteKey('QC-NEW-006')
  const partialDetail = getPlatformQcDetailViewModelByRouteKey('QC-NEW-004')
  const reversedDetail = getPlatformQcDetailViewModelByRouteKey('QC-021')

  assert(pendingDetail?.pendingDeductionRecord?.status === 'PENDING_FACTORY_CONFIRM', '待工厂处理样例未命中待确认质量扣款记录')
  assert(!pendingDetail?.formalLedger, '待工厂处理样例不应提前生成正式质量扣款流水')
  assert(disputeDetail?.disputeCase?.status === 'PENDING_REVIEW', '异议样例未命中待平台处理状态')
  assert(!disputeDetail?.formalLedger, '异议待裁决样例不应提前生成正式质量扣款流水')
  assert(partialDetail?.formalLedger?.status === 'GENERATED_PENDING_STATEMENT', '部分工厂责任样例未生成正式质量扣款流水')
  assert(reversedDetail?.disputeCase?.status === 'REVERSED', '非工厂责任样例未命中最终裁决状态')
  assert(!reversedDetail?.formalLedger, '最终非工厂责任样例不应生成正式质量扣款流水')

  const mobileBuckets = listFutureMobileFactoryQcBuckets('ID-F001')
  assert(mobileBuckets.pending.length >= 1, '工厂端待处理视图样例不足')
  assert(mobileBuckets.disputing.length >= 1, '工厂端异议中视图样例不足')
  assert(mobileBuckets.history.length >= 1, '工厂端历史视图样例不足')

  const mobilePartial = getFutureMobileFactoryQcDetail('QC-NEW-004', 'ID-F001')
  assert(Boolean(mobilePartial?.formalLedgerStatusLabel), '工厂端未暴露正式质量扣款流水状态')

  const pdaWritebackItems = listPdaSettlementWritebackItems(new Set(['ID-F001', 'ID-F004']))
  assert(pdaWritebackItems.length > 0, '工厂端预结算感知缺少正式质量扣款流水样例')
  assert(
    pdaWritebackItems.every((item) => Boolean(getPlatformQcDetailViewModelByRouteKey(item.qcId)?.formalLedger)),
    '工厂端预结算感知存在无法回溯到正式质量扣款流水的样例',
  )

  console.log(
    JSON.stringify(
      {
        activeCaseCount: activeCases.length,
        pendingRecordCount: pendingRecords.length,
        disputeCount: disputes.length,
        formalLedgerCount: ledgers.length,
        platformRowCount: platformRows.length,
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
