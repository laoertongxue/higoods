import { getSettlementEffectiveInfoByFactoryAt } from './settlement-change-requests.ts'
import { deriveSettlementCycleFields } from './store-domain-statement-grain.ts'
import type { PreSettlementLedger } from './store-domain-settlement-types.ts'
import { KOL_GOTO_FACTORY_ID, KOL_GOTO_FACTORY_NAME } from './factory-mock-data.ts'

const runtimeKolGotoFixedTotalLedgers: PreSettlementLedger[] = []
let failNextCompletionWriteForTest = false

export type KolGotoFixedTotalLedgerStoreSnapshot = PreSettlementLedger[]

export function captureKolGotoFixedTotalLedgerStore(): KolGotoFixedTotalLedgerStoreSnapshot {
  return structuredClone(runtimeKolGotoFixedTotalLedgers)
}

export function restoreKolGotoFixedTotalLedgerStore(snapshot: KolGotoFixedTotalLedgerStoreSnapshot): void {
  runtimeKolGotoFixedTotalLedgers.splice(0, runtimeKolGotoFixedTotalLedgers.length, ...structuredClone(snapshot))
}

export function listKolGotoFixedTotalLedgers(): PreSettlementLedger[] {
  return structuredClone(runtimeKolGotoFixedTotalLedgers)
}

export function setKolGotoFixedTotalLedgerFailureForTest(shouldFail: boolean): void {
  failNextCompletionWriteForTest = shouldFail
}

export function recordKolGotoFixedTotalTaskCompletion(input: {
  taskId: string
  taskNo: string
  productionOrderId: string
  productionOrderNo: string
  completedAt: string
  fixedTotalPrice: number
  currency: string
}): PreSettlementLedger {
  const existing = runtimeKolGotoFixedTotalLedgers.find((item) => item.taskId === input.taskId)
  if (existing) return structuredClone(existing)
  if (failNextCompletionWriteForTest) {
    failNextCompletionWriteForTest = false
    throw new Error('KOL 固定总价流水故障注入')
  }
  if (!input.taskId.trim() || !input.productionOrderId.trim()) throw new Error('KOL 固定总价流水缺少任务或生产单')
  if (!input.completedAt.trim()) throw new Error('KOL 固定总价流水缺少任务完成时间')
  if (!Number.isFinite(input.fixedTotalPrice) || input.fixedTotalPrice <= 0) throw new Error('KOL 整单任务固定总价无效')
  if (!input.currency.trim()) throw new Error('KOL 整单任务固定总价币种不能为空')

  const cycle = deriveSettlementCycleFields(KOL_GOTO_FACTORY_ID, input.completedAt)
  const settlementInfo = getSettlementEffectiveInfoByFactoryAt(KOL_GOTO_FACTORY_ID, input.completedAt)
  const ledgerId = `PSL-KOL-${input.taskId}`
  const ledger: PreSettlementLedger = {
    ledgerId,
    ledgerNo: ledgerId,
    ledgerType: 'TASK_EARNING',
    direction: 'INCOME',
    sourceType: 'TASK_COMPLETION',
    sourceRefId: `TASK_COMPLETION:${input.taskId}`,
    factoryId: KOL_GOTO_FACTORY_ID,
    factoryName: KOL_GOTO_FACTORY_NAME,
    taskId: input.taskId,
    taskNo: input.taskNo,
    productionOrderId: input.productionOrderId,
    productionOrderNo: input.productionOrderNo,
    priceSourceType: 'TASK_FIXED_TOTAL',
    qty: 1,
    originalCurrency: input.currency,
    originalAmount: input.fixedTotalPrice,
    settlementCurrency: input.currency,
    settlementAmount: input.fixedTotalPrice,
    fxRate: 1,
    fxAppliedAt: input.completedAt,
    occurredAt: input.completedAt,
    settlementCycleId: cycle.settlementCycleId,
    settlementCycleLabel: cycle.settlementCycleLabel,
    settlementCycleStartAt: cycle.settlementCycleStartAt,
    settlementCycleEndAt: cycle.settlementCycleEndAt,
    plannedPrepaymentAt: cycle.plannedPrepaymentAt,
    settlementProfileVersionNo: settlementInfo?.versionNo,
    status: 'OPEN',
    sourceReason: 'KOL 整单任务完成，按冻结固定总价计入预结算',
    remark: `整单任务 ${input.taskNo} 固定总价 ${input.fixedTotalPrice.toLocaleString('zh-CN')} ${input.currency}`,
  }
  runtimeKolGotoFixedTotalLedgers.push(ledger)
  return structuredClone(ledger)
}
