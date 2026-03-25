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

  assert(source.includes('function getTaskIncomeListItems('), '缺少任务收入列表 view model selector')
  assert(source.includes('function getTaskIncomeDetailViewModel('), '缺少任务收入详情 view model selector')
  assert(source.includes('function listTaskLinkedDeductionItems('), '缺少任务关联扣款项 selector')
  assert(source.includes('function listTaskLinkedQualityCases('), '缺少任务关联质检记录 selector')
  assert(source.includes('function getTaskSettlementImpactViewModel('), '缺少任务结算影响 selector')

  assert(source.includes('扣款来源与结算影响'), '任务抽屉未合并扣款构成与结算影响区块')
  assert(source.includes('关联扣款项'), '任务抽屉未新增关联扣款项区块')
  assert(source.includes('关联质检记录'), '任务抽屉未新增关联质检记录区块')
  assert(source.includes('付款记录'), '任务抽屉未保留付款记录区块')

  assert(source.includes('有关联质检'), '任务收入列表未补任务级质量扣款轻提示')
  assert(source.includes('含下周期调整'), '任务收入列表未补下周期调整轻提示')

  assert(source.includes('data-pda-sett-action="open-ded-drawer"'), '任务抽屉未接查看扣款项动作')
  assert(source.includes('data-pda-sett-action="goto-deductions-from-task"'), '任务抽屉未接去扣款台账动作')
  assert(source.includes('data-pda-sett-action="goto-quality-from-task"'), '任务抽屉未接去质检扣款动作')
  assert(source.includes('buildPdaQualityDetailHref('), '任务抽屉未复用 PDA 质检详情路由')

  assert(source.includes('linkedQualityQcIds'), '任务收入 mock 未补显式关联质检记录字段')
  assert(source.includes('linkedQcIds'), '扣款项 mock 未补显式关联质检记录字段')
  assert(source.includes('function matchesLedgerKeyword('), '扣款台账搜索未切到统一 ledger keyword 过滤')
  assert(source.includes('搜索台账单/任务/质检/扣款原因'), '扣款台账搜索提示未补任务/质检维度')

  console.log(
    JSON.stringify(
      {
        taskDrawerSections: ['金额情况', '扣款来源与结算影响', '数量与基础信息', '关联扣款项', '关联质检记录', '付款记录'],
        drillDownActions: ['open-ded-drawer', 'goto-deductions-from-task', 'goto-quality-from-task'],
        listHints: ['有关联质检', '含下周期调整'],
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
