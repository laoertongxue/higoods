#!/usr/bin/env node

import process from 'node:process'
import { readFileSync } from 'node:fs'
import { menusBySystem } from '../src/data/app-shell-config.ts'
import { listPreSettlementLedgers, tracePreSettlementLedgerSource } from '../src/data/fcs/pre-settlement-ledger-repository.ts'
import { renderAdjustmentsPage } from '../src/pages/adjustments.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function main(): void {
  const ledgers = listPreSettlementLedgers()
  const taskLedgers = ledgers.filter((item) => item.ledgerType === 'TASK_EARNING')
  const reworkDeductionLedgers = ledgers.filter((item) => item.ledgerType === 'QUALITY_DEDUCTION')

  assert(taskLedgers.length > 0, '正式流水池缺少任务收入流水')
  assert(reworkDeductionLedgers.length > 0, '正式流水池缺少返工扣款流水')
  assert(
    ledgers.every((item) => item.ledgerType === 'TASK_EARNING' || item.ledgerType === 'QUALITY_DEDUCTION'),
    '正式流水池仍混入非预结算流水对象',
  )

  const originalFactoryReworkTaskLedger = taskLedgers.find((item) =>
    (item.remark ?? '').includes('返工对象为原工厂') &&
    (item.remark ?? '').includes('返工数量对应金额') &&
    item.settlementAmount < item.originalAmount,
  )
  const postFactoryReworkTaskLedger = taskLedgers.find((item) =>
    (item.remark ?? '').includes('返工对象非原工厂') &&
    (item.remark ?? '').includes('反扣扣款') &&
    item.settlementAmount < item.originalAmount,
  )
  assert(originalFactoryReworkTaskLedger, '缺少“原工厂返工只扣返工数量对应金额”的任务收入流水样例')
  assert(postFactoryReworkTaskLedger, '缺少“非原工厂返工再扣反扣扣款”的任务收入流水样例')

  for (const ledger of reworkDeductionLedgers) {
    const trace = tracePreSettlementLedgerSource(ledger.ledgerId)
    assert(Boolean(trace?.formalQualityLedger), `${ledger.ledgerId} 未关联正式返工扣款流水`)
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
  const adjustmentsSource = readFileSync(new URL('../src/pages/adjustments.ts', import.meta.url), 'utf8')
  assert(pageHtml.includes('预结算流水'), '平台页标题未切换为预结算流水')
  assert(!pageHtml.includes('应付调整'), '平台页仍残留应付调整文案')
  assert(!pageHtml.includes('下周期调整'), '平台页仍残留下周期调整文案')
  assert(!pageHtml.includes('冲回'), '平台页仍残留冲回文案')
  assert(pageHtml.includes('返工扣款流水'), '预结算流水页未将质量扣款流水更名为返工扣款流水')
  assert(!pageHtml.includes('质量扣款流水'), '预结算流水页仍残留质量扣款流水文案')
  assert(!pageHtml.includes('对象说明'), '预结算流水页仍显示顶部对象说明卡片')
  assert(!pageHtml.includes('统一承接任务收入与质量扣款'), '预结算流水页仍显示顶部大统计卡片')
  assert(!pageHtml.includes('data-adj-filter="cycle"'), '预结算流水搜索条件仍包含结算周期筛选')
  assert(!pageHtml.includes('全部结算周期'), '预结算流水搜索条件仍显示全部结算周期')
  assert(!pageHtml.includes('结算周期 / 计划预付款'), '预结算流水列表仍显示结算周期/计划预付款列')
  assert(!pageHtml.includes('计划预付款：'), '预结算流水列表仍显示计划预付款')

  const filterIndex = pageHtml.indexOf('data-adj-filter="keyword"')
  const chipIndex = pageHtml.indexOf('data-adj-action="switch-view"')
  assert(filterIndex >= 0 && chipIndex > filterIndex, '预结算流水小统计卡片应移动到搜索条件之下')
  assert(adjustmentsSource.includes("getViewCount('ALL', searchFiltered)"), '预结算流水小统计卡片未与搜索结果联动')
  assert(!adjustmentsSource.includes("renderTraceRow('结算周期'"), '预结算流水详情仍显示结算周期')
  assert(!adjustmentsSource.includes("renderTraceRow('计划预付款日'"), '预结算流水详情仍显示计划预付款日')
  assert(ledgers.length > 10, '预结算流水分页检查需要超过 10 条 mock 数据')
  assert(pageHtml.includes('data-adj-action="next-page"'), '预结算流水列表缺少下一页分页动作')
  assert(pageHtml.includes('data-adj-field="pageSize"'), '预结算流水列表缺少每页条数选择')

  const renderedRows = (pageHtml.match(/data-adj-ledger-row=/g) ?? []).length
  assert(renderedRows === 10, `预结算流水列表首屏应只渲染 10 条，实际 ${renderedRows} 条`)

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
        返工扣款流水数: reworkDeductionLedgers.length,
        原工厂返工扣减样例: originalFactoryReworkTaskLedger.ledgerNo,
        后道返工扣减样例: postFactoryReworkTaskLedger.ledgerNo,
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
