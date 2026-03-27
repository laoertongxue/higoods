#!/usr/bin/env node

import process from 'node:process'
import { menusBySystem } from '../src/data/app-shell-config.ts'
import { listPreSettlementLedgers, tracePreSettlementLedgerSource } from '../src/data/fcs/pre-settlement-ledger-repository.ts'
import { renderAdjustmentsPage } from '../src/pages/adjustments.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function main(): void {
  const ledgers = listPreSettlementLedgers()
  const taskLedgers = ledgers.filter((item) => item.ledgerType === 'TASK_EARNING')
  const qualityLedgers = ledgers.filter((item) => item.ledgerType === 'QUALITY_DEDUCTION')

  assert(taskLedgers.length > 0, '正式流水池缺少任务收入流水')
  assert(qualityLedgers.length > 0, '正式流水池缺少质量扣款流水')
  assert(
    ledgers.every((item) => item.ledgerType === 'TASK_EARNING' || item.ledgerType === 'QUALITY_DEDUCTION'),
    '正式流水池仍混入非预结算流水对象',
  )

  for (const ledger of qualityLedgers) {
    const trace = tracePreSettlementLedgerSource(ledger.ledgerId)
    assert(Boolean(trace?.formalQualityLedger), `${ledger.ledgerId} 未关联正式质量扣款流水`)
    assert(Boolean(trace?.qcRecord), `${ledger.ledgerId} 未关联质检记录`)
    assert(Boolean(trace?.pendingDeductionRecord), `${ledger.ledgerId} 未关联待确认质量扣款记录`)
    if (trace?.disputeCase) {
      assert(Boolean(trace.disputeCase.adjudicationResult), `${ledger.ledgerId} 关联了未最终裁决的质量异议单`)
    }
  }

  for (const ledger of taskLedgers.slice(0, 10)) {
    const trace = tracePreSettlementLedgerSource(ledger.ledgerId)
    assert(Boolean(trace?.task), `${ledger.ledgerId} 未关联任务`)
    assert(Boolean(trace?.productionOrder), `${ledger.ledgerId} 未关联生产单`)
    assert(Boolean(ledger.returnInboundBatchId), `${ledger.ledgerId} 未关联回货批次`)
    assert(Boolean(ledger.priceSourceType === 'DISPATCH' || ledger.priceSourceType === 'BID'), `${ledger.ledgerId} 价格来源异常`)
  }

  const pageHtml = renderAdjustmentsPage()
  assert(pageHtml.includes('预结算流水'), '平台页标题未切换为预结算流水')
  assert(!pageHtml.includes('应付调整'), '平台页仍残留应付调整文案')
  assert(!pageHtml.includes('下周期调整'), '平台页仍残留下周期调整文案')
  assert(!pageHtml.includes('冲回'), '平台页仍残留冲回文案')

  const settlementMenu = menusBySystem.fcs.flatMap((group) => group.items)
    .find((item) => item.key === 'fcs-platform-settlement')
  const adjustmentMenuTitle = settlementMenu && 'children' in settlementMenu
    ? settlementMenu.children.find((item) => item.key === 'settlement-adjustments')?.title
    : null
  assert(adjustmentMenuTitle === '预结算流水', '对账与结算菜单仍未切换为预结算流水')

  console.log(
    JSON.stringify(
      {
        正式流水总数: ledgers.length,
        任务收入流水数: taskLedgers.length,
        质量扣款流水数: qualityLedgers.length,
        平台菜单名称: adjustmentMenuTitle,
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
