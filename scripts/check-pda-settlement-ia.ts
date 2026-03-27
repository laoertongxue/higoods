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

  assert(source.includes("type SettlementPageMode = 'cycles' | 'cycle-detail'"), '未拆出结算周期列表与周期详情两层状态')
  assert(source.includes("type DetailTab = 'overview' | 'quality' | 'ledgers' | 'statements'"), '周期详情未收口为 4 个 Tab')
  assert(source.includes("pageMode: 'cycles'"), '默认入口没有落到结算周期列表')
  assert(source.includes('selectedCycleId: null'), '缺少 selectedCycleId 初始态')
  assert(source.includes("detailTab: 'overview'"), '周期详情默认 Tab 未设为 overview')

  assert(source.includes("if (rawTab === 'cycles' || (!rawTab && !cycleId))"), '旧 tab=cycles 未兼容到周期列表')
  assert(source.includes("if (rawTab === 'tasks')"), '旧 tab=tasks 未兼容')
  assert(source.includes("state.detailTab = 'ledgers'"), '旧入口未映射到正式流水 Tab')
  assert(source.includes("state.ledgerTypeView = 'task-earning'"), '旧 tab=tasks 未映射到任务收入过滤态')
  assert(source.includes("} else if (rawTab === 'deductions')"), '旧 tab=deductions 未兼容')
  assert(source.includes("state.ledgerTypeView = 'quality-deduction'"), '旧 tab=deductions 未映射到质量扣款过滤态')
  assert(source.includes("state.pageMode = 'cycle-detail'"), '未进入周期详情层')
  assert(source.includes("state.selectedCycleId = resolveSettlementCycleId(cycleId)"), '旧入口未保留 cycleId 上下文')

  assert(source.includes('<h1 class="text-base font-bold">结算周期</h1>'), '默认页面标题未改为结算周期列表')
  assert(source.includes('返回结算周期'), '周期详情缺少返回周期列表入口')

  const detailTabs = [
    "['overview', '总览']",
    "['quality', '质检扣款']",
    "['ledgers', '正式流水']",
    "['statements', '对账与预付款']",
  ]
  detailTabs.forEach((tab) => assert(source.includes(tab), `缺少周期详情 Tab: ${tab}`))
  assert(!source.includes("['tasks', '任务收入']"), '周期详情仍保留旧的任务收入主 Tab')
  assert(!source.includes("['deductions', '扣款台账']"), '周期详情仍保留旧的扣款台账主 Tab')

  assert(source.includes('function renderSettlementProfileEntryCard()'), '未抽出结算资料独立入口')
  assert(source.includes('${renderSettlementProfileEntryCard()}'), '结算资料入口未挂到页面头部')
  assert(!source.includes('renderSettlementInfoSection()'), '总览正文仍在直接挂载旧结算信息区块')
  assert(!source.includes('以下为当前生效结算信息，提交申请后不会立即生效'), '总览正文仍保留大块结算信息说明')

  assert(source.includes("data-pda-sett-action=\"open-cycle-detail\""), '周期列表缺少进入周期详情的入口')
  assert(source.includes("data-pda-sett-action=\"switch-detail-tab\""), '周期详情缺少 detail tab 切换动作')
  assert(source.includes("data-pda-sett-action=\"back-to-cycles\""), '周期详情缺少返回列表动作')

  assert(source.includes("buildSettlementListHref(): string"), '缺少结算周期列表路由 helper')
  assert(source.includes("buildSettlementDetailHref("), '缺少周期详情路由 helper')
  assert(source.includes("appStore.navigate(buildSettlementListHref())"), '返回周期列表未同步到路由')
  assert(source.includes("appStore.navigate(buildSettlementDetailHref('overview', state.selectedCycleId))"), '打开当前周期详情未同步到路由')

  console.log(
    JSON.stringify(
      {
        defaultEntry: '/fcs/pda/settlement -> 结算周期列表',
        detailTabs: ['总览', '质检扣款', '正式流水', '对账与预付款'],
        compatQueries: ['tab=cycles', 'tab=overview', 'tab=quality', 'tab=tasks', 'tab=deductions'],
        materialEntry: '结算资料已从总览正文抽到页头入口',
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
