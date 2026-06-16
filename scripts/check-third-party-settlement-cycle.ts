#!/usr/bin/env node

import process from 'node:process'
import { readFileSync } from 'node:fs'
import { listPreSettlementLedgers } from '../src/data/fcs/pre-settlement-ledger-repository.ts'
import { getSettlementEffectiveInfoByFactory } from '../src/data/fcs/settlement-change-requests.ts'
import {
  canStatementEnterPrepayment,
  createPrepaymentBatch,
  initialSettlementBatches,
  initialStatementDrafts,
} from '../src/data/fcs/store-domain-settlement-seeds.ts'
import { deriveSettlementCycleFields } from '../src/data/fcs/store-domain-statement-grain.ts'

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function readRepoFile(pathname: string): string {
  return readFileSync(new URL(`../${pathname}`, import.meta.url), 'utf8')
}

function assertCycle(
  referenceAt: string,
  expectedStartAt: string,
  expectedEndAt: string,
  expectedPlannedPrepaymentAt: string,
): void {
  const cycle = deriveSettlementCycleFields('ID-F021', referenceAt)
  assert(cycle.settlementCycleLabel.startsWith('三旬结算'), `${referenceAt} 未命中三旬结算`)
  assert(cycle.settlementCycleStartAt === expectedStartAt, `${referenceAt} 周期开始日错误`)
  assert(cycle.settlementCycleEndAt === expectedEndAt, `${referenceAt} 周期结束日错误`)
  assert(cycle.plannedPrepaymentAt === expectedPlannedPrepaymentAt, `${referenceAt} 计划预付款日错误`)
}

function getOpenBatchStatementIds(): Set<string> {
  return new Set(
    initialSettlementBatches
      .filter((batch) => batch.status !== 'CLOSED')
      .flatMap((batch) => batch.statementIds),
  )
}

function main(): void {
  const effectiveInfo = getSettlementEffectiveInfoByFactory('ID-FAC-0021')
  assert(effectiveInfo?.settlementConfigSnapshot.cycleType === 'TRI_DECAD', '三方工厂未配置为三旬结算')
  assert(
    effectiveInfo.settlementConfigSnapshot.settlementDayRule.includes('次月10日预付') &&
      effectiveInfo.settlementConfigSnapshot.settlementDayRule.includes('次月20日预付') &&
      effectiveInfo.settlementConfigSnapshot.settlementDayRule.includes('次月30日预付'),
    '三旬结算规则文案未覆盖 10/20/30 三个预付款日',
  )

  const settlementContextSource = readRepoFile('src/pages/settlement/context.ts')
  const settlementEventsSource = readRepoFile('src/pages/settlement/events.ts')
  assert(settlementContextSource.includes("export const CURRENCIES = ['IDR'"), '结算资料表单币种下拉缺少 IDR')
  assert(settlementContextSource.includes('export function getFactorySettlementDefaultConfig'), '缺少按工厂带出默认结算配置的函数')
  assert(settlementContextSource.includes('TRI_DECAD_SETTLEMENT_DAY_RULE'), '缺少三旬结算默认规则文案')
  assert(
    settlementContextSource.includes('state.initConfigDraft = getFactorySettlementDefaultConfig(factoryId)'),
    '初始化资料页未按工厂带出默认结算配置',
  )
  assert(
    settlementEventsSource.includes('getFactorySettlementDefaultConfig(state.initEditorFactoryId)'),
    '初始化资料页重置配置未按当前工厂带出默认结算配置',
  )
  assert(
    settlementEventsSource.includes('getSettlementDayRuleForCycleType(nextCycleType)'),
    '切换结算周期类型时未自动带出对应结算规则',
  )

  assertCycle('2026-03-01 10:00:00', '2026-03-01', '2026-03-10', '2026-04-10')
  assertCycle('2026-03-10 10:00:00', '2026-03-01', '2026-03-10', '2026-04-10')
  assertCycle('2026-03-11 10:00:00', '2026-03-11', '2026-03-20', '2026-04-20')
  assertCycle('2026-03-20 10:00:00', '2026-03-11', '2026-03-20', '2026-04-20')
  assertCycle('2026-03-21 10:00:00', '2026-03-21', '2026-03-31', '2026-04-30')
  assertCycle('2026-03-31 10:00:00', '2026-03-21', '2026-03-31', '2026-04-30')
  assertCycle('2026-01-21 10:00:00', '2026-01-21', '2026-01-31', '2026-02-28')

  const thirdPartyLedgers = listPreSettlementLedgers().filter((ledger) => ledger.factoryId === 'ID-F021')
  assert(thirdPartyLedgers.length > 0, '三方工厂缺少预结算流水 mock 数据')
  assert(thirdPartyLedgers.every((ledger) => ledger.settlementCycleLabel.includes('三旬结算')), '三方工厂流水未全部按三旬结算标记')
  assert(thirdPartyLedgers.every((ledger) => Boolean(ledger.plannedPrepaymentAt)), '三方工厂流水缺少计划预付款日')

  const thirdPartyStatements = initialStatementDrafts.filter((statement) => statement.settlementPartyId === 'ID-F021')
  assert(thirdPartyStatements.length >= 5, '三方工厂对账单 mock 数据不足')
  assert(thirdPartyStatements.every((statement) => statement.settlementCycleLabel.includes('三旬结算')), '三方工厂对账单未全部按三旬结算标记')
  assert(thirdPartyStatements.every((statement) => Boolean(statement.plannedPrepaymentAt)), '三方工厂对账单缺少计划预付款日')

  const plannedDates = new Set(thirdPartyStatements.map((statement) => statement.plannedPrepaymentAt))
  assert(plannedDates.has('2026-02-10'), '三方工厂 mock 缺少 1-10 日送货、次月 10 日预付样例')
  assert(plannedDates.has('2026-02-20'), '三方工厂 mock 缺少 11-20 日送货、次月 20 日预付样例')
  assert(plannedDates.has('2026-02-28'), '三方工厂 mock 缺少 21-月底送货、次月底预付样例')

  const thirdPartyBatches = initialSettlementBatches.filter((batch) => batch.factoryId === 'ID-F021')
  assert(thirdPartyBatches.some((batch) => batch.status === 'PREPAID' || batch.status === 'CLOSED'), '三方工厂缺少已付款回写批次样例')
  assert(thirdPartyBatches.some((batch) => batch.status === 'FEISHU_APPROVAL_CREATED'), '三方工厂缺少飞书付款审批中批次样例')
  assert(thirdPartyBatches.every((batch) => Boolean(batch.plannedPrepaymentAt)), '三方工厂预付款批次缺少计划预付款日')

  for (const batch of initialSettlementBatches) {
    const itemPlannedDates = new Set(batch.items.map((item) => item.plannedPrepaymentAt ?? batch.plannedPrepaymentAt))
    assert(itemPlannedDates.size === 1, `${batch.batchNo ?? batch.batchId} 混入多个计划预付款日`)
    assert(itemPlannedDates.has(batch.plannedPrepaymentAt), `${batch.batchNo ?? batch.batchId} 批次计划日与明细不一致`)
  }

  const occupied = getOpenBatchStatementIds()
  const thirdPartyCandidate = thirdPartyStatements.find(
    (statement) => canStatementEnterPrepayment(statement) && !occupied.has(statement.statementId),
  )
  assert(thirdPartyCandidate, '三方工厂缺少待入预付款批次候选样例')

  const mismatchCandidates = initialStatementDrafts
    .filter(
      (statement) =>
        statement.settlementPartyId === 'ID-F022' &&
        canStatementEnterPrepayment(statement) &&
        !occupied.has(statement.statementId),
    )
    .sort((left, right) => (left.plannedPrepaymentAt ?? '').localeCompare(right.plannedPrepaymentAt ?? ''))
  const firstMismatch = mismatchCandidates[0]
  const secondMismatch = mismatchCandidates.find((statement) => statement.plannedPrepaymentAt !== firstMismatch?.plannedPrepaymentAt)
  assert(firstMismatch && secondMismatch, '缺少同三方工厂但不同计划预付款日的组批拦截样例')

  const mismatchResult = createPrepaymentBatch({
    statementIds: [firstMismatch.statementId, secondMismatch.statementId],
    batchName: '脚本校验跨计划日组批',
    remark: '脚本校验跨计划预付款日必须拦截',
    by: '脚本校验',
    at: '2026-03-27 11:00:00',
  })
  assert(!mismatchResult.ok, '不同计划预付款日的对账单仍可进入同一预付款批次')
  assert(mismatchResult.message?.includes('计划预付款日不一致'), '跨计划日组批拦截提示不明确')

  console.log(
    JSON.stringify(
      {
        三旬边界日期: '通过',
        三方结算配置: effectiveInfo.settlementConfigSnapshot.cycleType,
        三方初始化默认配置: '源码断言通过',
        三方流水数: thirdPartyLedgers.length,
        三方对账单数: thirdPartyStatements.length,
        三方预付款批次数: thirdPartyBatches.length,
        待入批候选: thirdPartyCandidate.statementNo ?? thirdPartyCandidate.statementId,
        跨计划日组批拦截: mismatchResult.message,
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
