#!/usr/bin/env node

import process from 'node:process'
import { readFileSync } from 'node:fs'

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function main(): void {
  const source = readFileSync(new URL('../src/pages/pda-settlement.ts', import.meta.url), 'utf8')

  assert(source.includes("type LedgerSourceView = 'all' | 'quality' | 'other'"), '缺少扣款台账来源类型切换')
  assert(
    source.includes("type LedgerFinancialView = 'all' | 'blocked' | 'effective' | 'adjustment' | 'reversed'"),
    '缺少扣款台账财务状态切换',
  )
  assert(source.includes('function getSettlementLedgerItems('), '缺少统一扣款台账 selector')
  assert(source.includes('function getSettlementLedgerOverview('), '缺少扣款台账顶部指标 selector')
  assert(source.includes('function getSettlementLedgerDetailViewModel('), '缺少扣款台账详情 view model')
  assert(source.includes('function getLedgerCurrencyDisplay('), '缺少扣款台账币种展示 helper')

  assert(source.includes('当前结算展示币种'), '台账页顶部未说明当前结算主币种')
  assert(source.includes('原始币种金额'), '台账详情未展示原始币种金额')
  assert(source.includes('换算时点'), '台账详情未展示换算时点')
  assert(source.includes('汇率'), '台账详情未展示汇率')

  assert(source.includes('set-ledger-source-view'), '台账页未接来源类型切换动作')
  assert(source.includes('set-ledger-finance-view'), '台账页未接财务状态切换动作')
  assert(source.includes('质量扣款'), '台账页缺少质量扣款来源切换')
  assert(source.includes('其它扣款'), '台账页缺少其它扣款来源切换')
  assert(source.includes('冻结中'), '台账页缺少冻结中状态切换/展示')
  assert(source.includes('已生效'), '台账页缺少已生效状态切换/展示')
  assert(source.includes('待下周期调整'), '台账页缺少待下周期调整状态切换/展示')
  assert(source.includes('已冲回'), '台账页缺少已冲回状态切换/展示')

  assert(!source.includes('renderPlatformQcWritebackSection(false)'), '扣款台账页仍直接堆叠平台回写质量扣款区块')
  assert(source.includes('renderDeductionDrawer(detail: SettlementLedgerDetailViewModel)'), '扣款台账 drawer 未升级为台账详情 view model')
  assert(source.includes('查看质检'), '台账详情缺少跳转质检入口')
  assert(source.includes('查看扣款依据'), '台账详情缺少跳转扣款依据入口')
  assert(source.includes('查看任务'), '台账详情缺少跳转任务入口')

  console.log(
    JSON.stringify(
      {
        pageTitle: '扣款台账',
        sourceFilters: ['全部', '质量扣款', '其它扣款'],
        financeFilters: ['全部', '冻结中', '已生效', '待下周期调整', '已冲回'],
        drawerSections: ['基本信息', '金额信息', '来源链路', '结算影响', '关联质检记录'],
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
