#!/usr/bin/env node

import process from 'node:process'
import { readFileSync } from 'node:fs'

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function main(): void {
  const pageSource = readFileSync(new URL('../src/pages/pda-settlement.ts', import.meta.url), 'utf8')
  const dataSource = readFileSync(new URL('../src/data/fcs/settlement-change-requests.ts', import.meta.url), 'utf8')

  assert(
    pageSource.includes("settlementRequestDrawerMode: 'create' | 'detail' | 'profile' | 'history' | 'versions' | null"),
    '结算资料 drawer 模式未扩展为资料/申请/历史/版本沿革',
  )
  assert(pageSource.includes('settlementRequestDetailId: string | null'), '缺少当前查看申请详情的状态')
  assert(pageSource.includes('function renderSettlementProfileEntryCard()'), '缺少结算资料轻入口卡')
  assert(pageSource.includes('function renderSettlementRequestDrawer()'), '缺少结算资料独立内容层')
  assert(!pageSource.includes('renderSettlementInfoSection()'), '结算资料仍作为总览正文大块内容存在')

  assert(pageSource.includes('当前生效资料'), '结算资料页未展示当前生效资料')
  assert(pageSource.includes('收款账户'), '结算资料页缺少收款账户区块')
  assert(pageSource.includes('结算配置快照'), '结算资料页缺少结算配置快照')
  assert(pageSource.includes('默认扣款规则概况'), '结算资料页缺少默认扣款规则概况')
  assert(pageSource.includes('历史申请'), '结算资料页缺少历史申请入口或列表')
  assert(pageSource.includes('版本沿革'), '结算资料页缺少版本沿革入口或列表')

  assert(pageSource.includes('open-settlement-profile'), '缺少打开结算资料页入口')
  assert(pageSource.includes('open-settlement-request-history'), '缺少历史申请入口动作')
  assert(pageSource.includes('open-settlement-version-history'), '缺少版本沿革入口动作')
  assert(pageSource.includes('back-to-settlement-profile'), '缺少返回结算资料动作')
  assert(pageSource.includes("state.settlementRequestDrawerMode = 'detail'"), '创建申请后未回到申请详情')
  assert(pageSource.includes('state.settlementRequestDetailId = result.data.requestId'), '创建申请后未定位到新申请详情')

  assert(dataSource.includes('export function createSettlementChangeRequest('), '缺少创建结算资料申请数据源')
  assert(dataSource.includes('export function getSettlementEffectiveInfoByFactory('), '缺少当前生效资料读取方法')
  assert(dataSource.includes('export function getSettlementActiveRequestByFactory('), '缺少当前申请读取方法')
  assert(dataSource.includes('export function getSettlementLatestRequestByFactory('), '缺少最近申请读取方法')
  assert(dataSource.includes('export function listSettlementRequestsByFactory('), '缺少按工厂查询申请列表方法')
  assert(dataSource.includes('export function getSettlementVersionHistory('), '缺少版本沿革读取方法')

  console.log(
    JSON.stringify(
      {
        entry: '结算模块独立二级入口 -> 结算资料',
        drawerModes: ['profile', 'create', 'detail', 'history', 'versions'],
        profileSections: ['当前生效资料', '结算配置快照', '默认扣款规则概况', '当前申请/最近申请'],
        history: '支持历史申请列表',
        versions: '支持版本沿革列表',
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
