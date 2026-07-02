#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { listPostFinishingQcOrders } from '../src/data/fcs/post-finishing-domain.ts'
import { renderAdjustmentsPage } from '../src/pages/adjustments.ts'
import { renderBatchesPage } from '../src/pages/batches.ts'
import { renderDeductionAnalysisPage } from '../src/pages/deduction-analysis.ts'
import { renderMaterialStatementsPage } from '../src/pages/material-statements.ts'
import { renderQcRecordDetailPage, renderQcRecordsPage } from '../src/pages/qc-records.ts'
import { renderStatementsPage } from '../src/pages/statements.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

const externalReworkQc = listPostFinishingQcOrders().find((record) =>
  (record.qcSkuResults ?? []).some((item) =>
    (item.reworkQty ?? 0) > 0 &&
    item.reworkReceiveFactoryName &&
    item.reworkReceiveFactoryName !== record.sourceFactoryName &&
    ((item.sourceChargeback?.amount ?? item.reworkDeductionAmountIdr ?? 0) > 0),
  ),
)

assert(externalReworkQc, '缺少带返工扣款金额的质检单样例')

const pages = [
  { name: '质检记录', html: renderQcRecordsPage(), mustShowIdr: true },
  { name: '质检记录详情', html: renderQcRecordDetailPage(externalReworkQc!.actionRecordId), mustShowIdr: true },
  { name: '扣款记录', html: renderDeductionAnalysisPage(), mustShowIdr: true },
  { name: '正式对账单', html: renderStatementsPage(), mustShowIdr: true },
  { name: '预结算流水', html: renderAdjustmentsPage(), mustShowIdr: true },
  { name: '物料对账单', html: renderMaterialStatementsPage(), mustShowIdr: false },
  { name: '预付款批次', html: renderBatchesPage(), mustShowIdr: true },
]

const forbiddenUnitPatterns = [
  /\bCNY\b/,
  /\bUSD\b/,
  /人民币/,
  /美元/,
  /\d[\d,.]*\s*元/,
]

for (const page of pages) {
  for (const pattern of forbiddenUnitPatterns) {
    assert(!pattern.test(page.html), `${page.name} 不应展示非 IDR 金额单位：${pattern}`)
  }
  if (page.mustShowIdr) {
    assert(page.html.includes('IDR'), `${page.name} 涉及金额时必须展示 IDR`)
  }
}

const sourceFiles = [
  '../src/pages/qc-records/detail-domain.ts',
  '../src/pages/deduction-analysis.ts',
  '../src/pages/statements.ts',
  '../src/pages/adjustments.ts',
  '../src/pages/batches.ts',
]

for (const sourceFile of sourceFiles) {
  const source = readFileSync(fileURLToPath(new URL(sourceFile, import.meta.url)), 'utf8')
  for (const pattern of forbiddenUnitPatterns) {
    assert(!pattern.test(source), `${sourceFile} 不应保留非 IDR 金额单位：${pattern}`)
  }
}

console.log('check:fcs-money-unit-idr passed')
