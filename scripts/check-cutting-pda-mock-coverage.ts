#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

import { hydratePdaExecutionWritebackStore } from '../src/data/fcs/cutting/pda-execution-writeback-ledger.ts'
import { listPdaCuttingTaskScenarios } from '../src/data/fcs/cutting/pda-cutting-task-scenarios.ts'
import {
  PDA_MOCK_AWARDED_TENDER_NOTICES,
  PDA_MOCK_BIDDING_TENDERS,
  PDA_MOCK_QUOTED_TENDERS,
} from '../src/data/fcs/pda-mobile-mock.ts'

const root = process.cwd()

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function ensure(condition: boolean, errors: string[], message: string): void {
  if (!condition) errors.push(message)
}

function main(): void {
  const errors: string[] = []
  const scenarios = listPdaCuttingTaskScenarios()
  const allExecutions = scenarios.flatMap((scenario) => scenario.executions)
  const acceptanceStatuses = new Set(scenarios.map((scenario) => scenario.acceptanceStatus).filter(Boolean))
  const taskStatuses = new Set(scenarios.map((scenario) => scenario.taskStatus))
  const seededLedger = hydratePdaExecutionWritebackStore()

  ensure(scenarios.filter((scenario) => scenario.origin === 'DIRECT').length >= 8, errors, '直派裁片任务少于 8 条')
  ensure(scenarios.filter((scenario) => scenario.origin === 'BIDDING_PENDING').length >= 4, errors, '待报价裁片任务少于 4 条')
  ensure(scenarios.filter((scenario) => scenario.origin === 'BIDDING_QUOTED').length >= 4, errors, '已报价裁片任务少于 4 条')
  ensure(scenarios.filter((scenario) => scenario.origin === 'BIDDING_AWARDED').length >= 4, errors, '已中标裁片任务少于 4 条')

  ;['PENDING', 'ACCEPTED', 'REJECTED'].forEach((status) =>
    ensure(acceptanceStatuses.has(status), errors, `裁片任务缺少接单状态：${status}`),
  )
  ;['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'].forEach((status) =>
    ensure(taskStatuses.has(status), errors, `裁片任务缺少执行状态：${status}`),
  )

  ensure(allExecutions.filter((execution) => execution.bindingState === 'UNBOUND').length >= 3, errors, 'UNBOUND execution 少于 3 条')
  ensure(scenarios.filter((scenario) => scenario.executions.length > 1).length >= 4, errors, '单任务多 execution 场景少于 4 组')
  ensure(allExecutions.filter((execution) => Boolean(execution.mergeBatchNo)).length >= 3, errors, 'merge batch execution 场景少于 3 条')
  ensure(allExecutions.some((execution) => Boolean(execution.spreadingPreset)), errors, '缺少铺布预置场景')

  const cuttingBiddingTenders = PDA_MOCK_BIDDING_TENDERS.filter((item) => item.processName === '裁片')
  const cuttingQuotedTenders = PDA_MOCK_QUOTED_TENDERS.filter((item) => item.processName === '裁片')
  const cuttingAwardedTenders = PDA_MOCK_AWARDED_TENDER_NOTICES.filter((item) => item.processName === '裁片')
  ensure(cuttingBiddingTenders.length >= 4, errors, '待报价招标链上的裁片 mock 少于 4 条')
  ensure(cuttingQuotedTenders.length >= 4, errors, '已报价招标链上的裁片 mock 少于 4 条')
  ensure(cuttingAwardedTenders.length >= 4, errors, '已中标链上的裁片 mock 少于 4 条')

  ensure(seededLedger.pickupWritebacks.length >= 3, errors, 'pickup 预置写回少于 3 条')
  ensure(seededLedger.inboundWritebacks.length >= 2, errors, 'inbound 预置写回少于 2 条')
  ensure(seededLedger.handoverWritebacks.length >= 2, errors, 'handover 预置写回少于 2 条')
  ensure(seededLedger.replenishmentFeedbackWritebacks.length >= 3, errors, 'replenishment 预置写回少于 3 条')
  ensure(seededLedger.pickupWritebacks.some((item) => item.resultLabel.includes('领取成功')), errors, 'pickup 预置缺少“已领料”场景')
  ensure(seededLedger.pickupWritebacks.some((item) => item.resultLabel.includes('部分领取')), errors, 'pickup 预置缺少“部分领料”场景')
  ensure(seededLedger.pickupWritebacks.some((item) => Boolean(item.claimDisputeNo)), errors, 'pickup 预置缺少“差异举证已提交”场景')
  ensure(
    seededLedger.replenishmentFeedbackWritebacks.some((item) => item.lifecycleStatus === 'SUBMITTED'),
    errors,
    'replenishment 预置缺少“已反馈”场景',
  )
  ensure(
    seededLedger.replenishmentFeedbackWritebacks.some((item) => item.lifecycleStatus === 'PENDING'),
    errors,
    'replenishment 预置缺少“待处理”场景',
  )
  ensure(
    seededLedger.replenishmentFeedbackWritebacks.some((item) => item.lifecycleStatus === 'CLOSED'),
    errors,
    'replenishment 预置缺少“已关闭”场景',
  )

  const receivePage = read('src/pages/pda-task-receive.ts')
  const execPage = read('src/pages/pda-exec.ts')
  const detailPage = read('src/pages/pda-cutting-task-detail.ts')
  ensure(receivePage.includes('PDA_MOCK_BIDDING_TENDERS'), errors, 'pda-task-receive 未消费待报价 mock')
  ensure(receivePage.includes('PDA_MOCK_QUOTED_TENDERS'), errors, 'pda-task-receive 未消费已报价 mock')
  ensure(receivePage.includes("task.status === 'BLOCKED'"), errors, 'pda-task-receive 未覆盖 BLOCKED 中标态')
  ensure(receivePage.includes("task.status === 'CANCELLED'"), errors, 'pda-task-receive 未覆盖 CANCELLED 中标态')
  ensure(execPage.includes("type TaskStatusTab = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'"), errors, 'pda-exec 未覆盖暂停/已完工状态页签')
  ensure(detailPage.includes('待绑定原始裁片单'), errors, 'pda-cutting-task-detail 未处理 UNBOUND 场景')
  ensure(detailPage.includes('关联裁剪批次'), errors, 'pda-cutting-task-detail 未展示 merge batch 场景')

  if (errors.length > 0) {
    console.error('check-cutting-pda-mock-coverage failed:')
    errors.forEach((error) => console.error(`- ${error}`))
    process.exit(1)
  }

  console.log(
    JSON.stringify(
      {
        direct: scenarios.filter((scenario) => scenario.origin === 'DIRECT').length,
        pendingQuote: scenarios.filter((scenario) => scenario.origin === 'BIDDING_PENDING').length,
        quoted: scenarios.filter((scenario) => scenario.origin === 'BIDDING_QUOTED').length,
        awarded: scenarios.filter((scenario) => scenario.origin === 'BIDDING_AWARDED').length,
        unboundExecutions: allExecutions.filter((execution) => execution.bindingState === 'UNBOUND').length,
        seededPickupWritebacks: seededLedger.pickupWritebacks.length,
      },
      null,
      2,
    ),
  )
}

main()
