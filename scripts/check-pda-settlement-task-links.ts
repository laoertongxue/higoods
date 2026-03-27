#!/usr/bin/env node

import process from 'node:process'
import { readFileSync } from 'node:fs'
import { listFeishuPaymentApprovals, listPaymentWritebacks, listSettlementBatchesByParty, listSettlementStatementsByParty } from '../src/data/fcs/store-domain-settlement-seeds.ts'
import { indonesiaFactories } from '../src/data/fcs/indonesia-factories.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function main(): void {
  const source = readFileSync(new URL('../src/pages/pda-settlement.ts', import.meta.url), 'utf8')
  const qualitySource = readFileSync(new URL('../src/pages/pda-quality.ts', import.meta.url), 'utf8')

  assert(source.includes('function buildPdaQualityDetailHref(qcId: string, cycleId?: string, qualityView?: QualityView): string'), '结算页缺少跳转 pda-quality 的详情路由 helper')
  assert(source.includes('data-pda-sett-action="open-quality-workbench"'), '结算页缺少去处理质检扣款入口')
  assert(source.includes('data-nav="${escapeHtml(detailHref)}"'), '质检扣款卡片未复用共享详情跳转')
  assert(source.includes('飞书付款审批编号'), '结算页未展示飞书付款审批编号')
  assert(source.includes('银行回执'), '结算页未展示银行回执')
  assert(source.includes('银行流水号'), '结算页未展示银行流水号')
  assert(source.includes('当前生效：'), '结算页未展示资料快照版本差异说明')
  assert(source.includes('工厂端不能在这里创建预付款批次、申请付款或创建打款回写'), '结算页未明确消费端动作边界')

  assert(!source.includes('data-batch-action="create-batch"'), '工厂端结算页不应出现创建预付款批次动作')
  assert(!source.includes('data-batch-action="apply-payment"'), '工厂端结算页不应出现申请付款动作')
  assert(!source.includes('data-batch-action="create-writeback"'), '工厂端结算页不应出现创建打款回写动作')

  assert(qualitySource.includes("const cycleId = params.get('cycleId')"), 'pda-quality 未读取 cycleId 以保留回跳上下文')
  assert(qualitySource.includes("search.set('cycleId', cycleId)"), 'pda-quality 返回结算页时未保留 cycleId')

  const factoryWithBatch = indonesiaFactories.find((factory) => listSettlementBatchesByParty(factory.id).length > 0)
  assert(Boolean(factoryWithBatch), '缺少可用于工厂端查看预付款结果的工厂样例')
  const statements = factoryWithBatch ? listSettlementStatementsByParty(factoryWithBatch.id) : []
  const batches = factoryWithBatch ? listSettlementBatchesByParty(factoryWithBatch.id) : []
  const approvals = listFeishuPaymentApprovals()
  const writebacks = listPaymentWritebacks()
  const linkedBatch = batches.find((batch) => batch.statementIds.some((statementId) => statements.some((statement) => statement.statementId === statementId)))
  assert(Boolean(linkedBatch), '缺少关联对账单的预付款批次样例')
  const linkedApproval = linkedBatch ? approvals.find((approval) => approval.batchId === linkedBatch.batchId) : null
  const linkedWriteback = linkedBatch ? writebacks.find((writeback) => writeback.batchId === linkedBatch.batchId) : null
  assert(Boolean(linkedApproval), '缺少飞书付款审批样例')
  assert(Boolean(linkedWriteback), '缺少打款回写样例')

  console.log(
    JSON.stringify(
      {
        linkedFactory: factoryWithBatch?.id ?? null,
        batchNo: linkedBatch?.batchNo ?? null,
        approvalNo: linkedApproval?.approvalNo ?? null,
        writebackSerialNo: linkedWriteback?.bankSerialNo ?? null,
        qualityDrillDown: '结算页通过 pda-quality 详情承接质检扣款处理，不在 settlement 页重复堆表单',
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
