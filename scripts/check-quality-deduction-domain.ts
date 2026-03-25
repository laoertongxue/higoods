#!/usr/bin/env node

import process from 'node:process'
import {
  getPlatformQcCompatInspectionByRouteKey,
  listDeductionBasisCompatItems,
  listFutureMobileFactoryQcBuckets,
  listFutureSettlementAdjustmentItems,
  listPdaSettlementWritebackItems,
  listPlatformQcListItems,
} from '../src/data/fcs/quality-deduction-selectors.ts'
import {
  getQualityDeductionCaseFactByRouteKey,
  listQualityDeductionCaseFacts,
  validateQualityDeductionRepository,
} from '../src/data/fcs/quality-deduction-repository.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function main(): void {
  const validationIssues = validateQualityDeductionRepository()
  assert(validationIssues.length === 0, `共享 facts 校验失败: ${validationIssues.map((item) => `${item.qcId}:${item.message}`).join('; ')}`)

  const allCases = listQualityDeductionCaseFacts({ includeLegacy: true })
  const activeCases = listQualityDeductionCaseFacts({ includeLegacy: false })
  assert(allCases.length === 17, `期望 17 条共享 case，实际 ${allCases.length}`)
  assert(activeCases.length === 15, `期望 15 条非历史共享 case，实际 ${activeCases.length}`)

  const platformRows = listPlatformQcListItems({ includeLegacy: false })
  const results = Array.from(new Set(platformRows.map((item) => item.result))).sort()
  assert(
    results.join(',') === ['FAIL', 'PARTIAL_PASS', 'PASS'].join(','),
    `平台列表结果集异常: ${results.join(',')}`,
  )

  const qualifiedRow = platformRows.find((item) => item.result === 'PASS')
  const partialRow = platformRows.find((item) => item.result === 'PARTIAL_PASS')
  const unqualifiedRow = platformRows.find((item) => item.result === 'FAIL')
  assert(Boolean(qualifiedRow), '缺少合格样例')
  assert(Boolean(partialRow), '缺少部分合格样例')
  assert(Boolean(unqualifiedRow), '缺少不合格样例')

  const compatDetail = getPlatformQcCompatInspectionByRouteKey('RIB-202603-0008')
  assert(compatDetail?.qcId === 'QC-NEW-004', '详情兼容主键解析失败：RIB-202603-0008')

  const caseFact = getQualityDeductionCaseFactByRouteKey('QC-NEW-004')
  assert(caseFact?.qcRecord.qcId === 'QC-NEW-004', '共享 case routeKey 解析失败：QC-NEW-004')
  assert(caseFact?.settlementAdjustment?.adjustmentType === 'DECREASE_DEDUCTION', '改判调整项未落地')

  const basisItems = listDeductionBasisCompatItems({ includeLegacy: true })
  const adjustedBasis = basisItems.find((item) => item.basisId === 'DBI-017')
  assert(Boolean(adjustedBasis), '缺少改判后的扣款依据 DBI-017')
  assert(adjustedBasis?.deductionAmountSnapshot === 860, `DBI-017 生效金额错误: ${adjustedBasis?.deductionAmountSnapshot}`)

  const factoryBuckets = listFutureMobileFactoryQcBuckets('ID-F001')
  assert(factoryBuckets.pending.length >= 1, 'future-mobile 待处理 bucket 为空')
  assert(factoryBuckets.disputing.length >= 1, 'future-mobile 异议中 bucket 为空')
  assert(factoryBuckets.history.length >= 1, 'future-mobile 历史 bucket 为空')

  const pdaItems = listPdaSettlementWritebackItems(new Set(['ID-F001']))
  const pdaQcIds = new Set(pdaItems.map((item) => item.qcId))
  assert(pdaQcIds.has('QC-NEW-002'), 'PDA 联动缺少争议中记录 QC-NEW-002')
  assert(pdaQcIds.has('QC-NEW-004'), 'PDA 联动缺少改判记录 QC-NEW-004')
  assert(pdaQcIds.has('QC-NEW-011'), 'PDA 联动缺少已结算记录 QC-NEW-011')

  const adjustments = listFutureSettlementAdjustmentItems({ includeLegacy: true })
  assert(adjustments.length >= 2, `期望至少 2 条 settlement adjustment，实际 ${adjustments.length}`)
  assert(
    adjustments.some((item) => item.adjustmentType === 'DECREASE_DEDUCTION') &&
      adjustments.some((item) => item.adjustmentType === 'REVERSAL'),
    'settlement adjustment 类型覆盖不足',
  )

  console.log(
    JSON.stringify(
      {
        totalCases: allCases.length,
        activeCases: activeCases.length,
        platformResults: results,
        pendingMobile: factoryBuckets.pending.length,
        disputingMobile: factoryBuckets.disputing.length,
        historyMobile: factoryBuckets.history.length,
        pdaWritebackCount: pdaItems.length,
        adjustmentCount: adjustments.length,
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
