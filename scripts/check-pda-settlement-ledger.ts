#!/usr/bin/env node

import process from 'node:process'
import { readFileSync } from 'node:fs'
import { getPreSettlementLedgerById, listPreSettlementLedgers, tracePreSettlementLedgerSource } from '../src/data/fcs/pre-settlement-ledger-repository.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function main(): void {
  const source = readFileSync(new URL('../src/pages/pda-settlement.ts', import.meta.url), 'utf8')

  assert(source.includes("type LedgerTypeView = 'all' | 'task-earning' | 'quality-deduction'"), '正式流水页缺少来源类型切换')
  assert(
    source.includes("type LedgerStatusView = 'all' | 'open' | 'in-statement' | 'in-prepayment-batch' | 'prepaid'"),
    '正式流水页缺少状态切换',
  )
  assert(source.includes('function getFilteredCycleLedgers('), '缺少正式流水筛选 selector')
  assert(source.includes('function getLedgerDetailViewModel('), '缺少正式流水详情 view model')
  assert(source.includes('function getConvertedCurrencyDisplay('), '缺少币种换算展示 helper')

  assert(source.includes('原始币种金额'), '台账详情未展示原始币种金额')
  assert(source.includes('换算时点'), '台账详情未展示换算时点')
  assert(source.includes('汇率'), '台账详情未展示汇率')
  assert(source.includes('data-pda-sett-action="set-ledger-type-view"'), '正式流水页未接来源类型切换动作')
  assert(source.includes('data-pda-sett-action="set-ledger-status-view"'), '正式流水页未接状态切换动作')
  assert(source.includes('任务收入'), '正式流水页缺少任务收入来源切换')
  assert(source.includes('质量扣款'), '正式流水页缺少质量扣款来源切换')
  assert(source.includes('待入对账单'), '正式流水页缺少待入对账单状态切换')
  assert(source.includes('已入对账单'), '正式流水页缺少已入对账单状态切换')
  assert(source.includes('已入预付款批次'), '正式流水页缺少已入预付款批次状态切换')
  assert(source.includes('已预付'), '正式流水页缺少已预付状态切换')

  assert(source.includes('对账单信息'), '正式流水详情缺少对账单信息区块')
  assert(source.includes('预付款与打款'), '正式流水详情缺少预付款与打款区块')
  assert(source.includes('来源链路'), '正式流水详情缺少来源链路区块')
  assert(!source.includes('其它扣款'), '正式流水页仍残留旧的其它扣款口径')
  assert(!source.includes('下周期调整'), '正式流水页仍残留旧的下周期调整口径')
  assert(!source.includes('冲回'), '正式流水页仍残留旧的冲回口径')

  const taskLedger = listPreSettlementLedgers({ ledgerType: 'TASK_EARNING' })[0]
  const qualityLedger = listPreSettlementLedgers({ ledgerType: 'QUALITY_DEDUCTION' })[0]
  assert(Boolean(taskLedger), '缺少任务收入正式流水样例')
  assert(Boolean(qualityLedger), '缺少质量扣款正式流水样例')

  const taskTrace = taskLedger ? tracePreSettlementLedgerSource(taskLedger.ledgerId) : null
  const qualityTrace = qualityLedger ? tracePreSettlementLedgerSource(qualityLedger.ledgerId) : null
  assert(Boolean(taskTrace?.task || taskLedger?.taskId), '任务收入正式流水无法追到任务')
  assert(Boolean(taskTrace?.returnInboundBatch || taskLedger?.returnInboundBatchId), '任务收入正式流水无法追到回货批次')
  assert(Boolean(qualityTrace?.qcRecord || qualityLedger?.qcRecordId), '质量扣款正式流水无法追到质检记录')
  assert(Boolean(qualityTrace?.pendingDeductionRecord || qualityLedger?.pendingDeductionRecordId), '质量扣款正式流水无法追到待确认记录')

  console.log(
    JSON.stringify(
      {
        pageTitle: '正式流水',
        sourceFilters: ['全部', '任务收入', '质量扣款'],
        statusFilters: ['全部', '待入对账单', '已入对账单', '已入预付款批次', '已预付'],
        drawerSections: ['基本信息', '金额信息', '来源链路', '对账单信息', '预付款与打款'],
        taskLedgerNo: taskLedger?.ledgerNo ?? null,
        qualityLedgerNo: qualityLedger?.ledgerNo ?? null,
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
