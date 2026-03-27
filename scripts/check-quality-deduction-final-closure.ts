#!/usr/bin/env node

import process from 'node:process'
import { existsSync, readFileSync } from 'node:fs'
import {
  buildDeductionAnalysisHref,
  buildDeductionEntryHrefByBasisId,
  resolveQcRouteKeyByBasisId,
} from '../src/data/fcs/quality-chain-adapter.ts'
import {
  getFutureMobileFactoryQcDetail,
  getPlatformQcDetailViewModelByRouteKey,
  listPdaSettlementWritebackItems,
} from '../src/data/fcs/quality-deduction-selectors.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function main(): void {
  const deductionCalcPage = new URL('../src/pages/deduction-calc.ts', import.meta.url)
  const arbitrationPage = new URL('../src/pages/arbitration.ts', import.meta.url)
  assert(!existsSync(deductionCalcPage), '旧兼容页 deduction-calc.ts 未退场')
  assert(!existsSync(arbitrationPage), '旧兼容页 arbitration.ts 未退场')

  const routesSource = readFileSync(new URL('../src/router/routes.ts', import.meta.url), 'utf8')
  const handlersSource = readFileSync(new URL('../src/main-handlers/fcs-handlers.ts', import.meta.url), 'utf8')
  const listSource = readFileSync(new URL('../src/pages/qc-records/list-domain.ts', import.meta.url), 'utf8')
  const detailSource = readFileSync(new URL('../src/pages/qc-records/detail-domain.ts', import.meta.url), 'utf8')
  const statementsSource = readFileSync(new URL('../src/pages/statements.ts', import.meta.url), 'utf8')
  const adjustmentsSource = readFileSync(new URL('../src/pages/adjustments.ts', import.meta.url), 'utf8')
  const analysisSource = readFileSync(new URL('../src/data/fcs/quality-deduction-analysis.ts', import.meta.url), 'utf8')
  const settlementSource = readFileSync(new URL('../src/pages/pda-settlement.ts', import.meta.url), 'utf8')

  assert(
    routesSource.includes("'/fcs/quality/deduction-calc': () =>") &&
      routesSource.includes("renderRouteRedirect('/fcs/quality/deduction-analysis'"),
    '旧 /fcs/quality/deduction-calc route 未收口为 redirect',
  )
  assert(
    routesSource.includes("'/fcs/quality/arbitration': () =>") &&
      routesSource.includes("renderRouteRedirect('/fcs/quality/qc-records?view=WAIT_PLATFORM_REVIEW'"),
    '旧 /fcs/quality/arbitration route 未收口为 redirect',
  )
  assert(
    routesSource.includes('pattern: /^\\/fcs\\/quality\\/deduction-calc\\/([^/]+)$/') &&
      routesSource.includes("buildDeductionEntryHrefByBasisId(decodeURIComponent(match[1]))"),
    '旧 deduction-calc 详情 route 未收口为 basisId redirect',
  )

  assert(!handlersSource.includes('handleDeductionCalcEvent'), '旧 deduction-calc handler 仍残留')
  assert(!handlersSource.includes('handleArbitrationEvent'), '旧 arbitration handler 仍残留')

  const affectedSources = [listSource, detailSource, statementsSource, adjustmentsSource, analysisSource, settlementSource]
  assert(
    affectedSources.every((source) => !source.includes('/fcs/quality/deduction-calc/')),
    '仍有页面直接指向旧 deduction-calc 详情路由',
  )

  assert(listSource.includes('buildQcDeductionHref(row.qcId)'), '质检记录列表“查看扣款”未收口到质检详情扣款依据区')
  assert(detailSource.includes('buildQcDeductionHref(detailVm.qcId)'), '质检详情“查看扣款依据”未收口到详情扣款依据区')
  assert(detailSource.includes('buildDeductionEntryHrefByBasisId(basis.basisId)'), '质检详情 basis 级链接未走 basisId resolver')
  assert(statementsSource.includes('buildDeductionEntryHrefByBasisId(item.basisId)'), '对账页“查看依据”未收口')
  assert(adjustmentsSource.includes('buildDeductionEntryHrefByBasisId(adjustment.relatedBasisId)'), '调整页“查看依据”未收口')
  assert(analysisSource.includes('buildDeductionEntryHrefByBasisId(deductionBasis.basisId)'), '扣款分析明细未收口 basis 链接')
  assert(settlementSource.includes('buildDeductionEntryHrefByBasisId(item.basisId)'), '结算页“查看扣款依据”未收口')

  const resolvedQc = resolveQcRouteKeyByBasisId('DBI-019')
  assert(resolvedQc === 'QC-NEW-006', `basisId 反查 qc 失败: ${resolvedQc ?? 'null'}`)
  assert(
    buildDeductionEntryHrefByBasisId('DBI-019') === '/fcs/quality/qc-records/QC-NEW-006?focus=deduction',
    '已知 basisId 未跳到质检详情扣款依据区',
  )
  assert(
    buildDeductionEntryHrefByBasisId('UNKNOWN-BASIS') === buildDeductionAnalysisHref('UNKNOWN-BASIS'),
    '未知 basisId 未正确回退到扣款分析',
  )

  assert(
    settlementSource.includes("formatSettlementAwareAmount(item.blockedProcessingFeeAmount, 'CNY', item.inspectedAt)") &&
      settlementSource.includes("formatSettlementAwareAmount(item.effectiveQualityDeductionAmount, 'CNY', item.inspectedAt)"),
    '结算质检工作台卡片仍未统一主币种展示',
  )
  assert(
    settlementSource.includes("formatSettlementAwareAmount(totalAmountCny, 'CNY', fxReferenceAt)") &&
      settlementSource.includes("formatSettlementAwareAmount(item.deductionAmountCny, 'CNY', item.inspectedAt)"),
    '平台回写质量影响概况仍未统一主币种展示',
  )
  assert(
    settlementSource.includes("formatSettlementAwareAmount(settlementImpact.blockedProcessingFeeAmount, 'CNY'") &&
      settlementSource.includes("formatSettlementAwareAmount(settlementImpact.effectiveQualityDeductionAmount, 'CNY'"),
    '任务抽屉质量影响仍未统一主币种展示',
  )

  const platformDetail = getPlatformQcDetailViewModelByRouteKey('QC-NEW-004')
  const mobileDetail = getFutureMobileFactoryQcDetail('QC-NEW-004', 'ID-F001')
  const pdaWriteback = listPdaSettlementWritebackItems(new Set(['ID-F001'])).find((item) => item.qcId === 'QC-NEW-004')
  assert(Boolean(platformDetail), '平台端详情样例缺失')
  assert(Boolean(mobileDetail), '工厂端详情样例缺失')
  assert(Boolean(pdaWriteback), 'PDA 结算感知样例缺失')
  assert(platformDetail?.settlementImpactStatusLabel === mobileDetail?.settlementImpactStatusLabel, '平台端与工厂端结算影响状态不一致')
  assert(platformDetail?.settlementImpactStatusLabel === pdaWriteback?.settlementStatusText, '平台端与 PDA 结算感知状态不一致')
  assert(
    platformDetail?.settlementImpact.effectiveQualityDeductionAmount === mobileDetail?.effectiveQualityDeductionAmount,
    '平台端与工厂端生效质量扣款金额不一致',
  )

  console.log(
    JSON.stringify(
      {
        retiredCompatPages: ['deduction-calc.ts', 'arbitration.ts'],
        redirectRoutes: [
          '/fcs/quality/deduction-calc -> /fcs/quality/deduction-analysis',
          '/fcs/quality/arbitration -> /fcs/quality/qc-records?view=WAIT_PLATFORM_REVIEW',
          '/fcs/quality/deduction-calc/:basisId -> 质检详情扣款依据区或扣款分析',
        ],
        basisRedirectSample: {
          basisId: 'DBI-019',
          qcId: resolvedQc,
          href: buildDeductionEntryHrefByBasisId('DBI-019'),
        },
        fallbackRedirect: buildDeductionEntryHrefByBasisId('UNKNOWN-BASIS'),
        crossEndConsistency: {
          qcId: 'QC-NEW-004',
          platformSettlementStatus: platformDetail?.settlementImpactStatusLabel,
          mobileSettlementStatus: mobileDetail?.settlementImpactStatusLabel,
          pdaSettlementStatus: pdaWriteback?.settlementStatusText,
        },
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
