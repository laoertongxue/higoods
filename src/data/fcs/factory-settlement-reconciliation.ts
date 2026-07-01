export const SETTLEMENT_CURRENCIES = ['IDR', 'CNY', 'USD'] as const
export type SettlementCurrency = (typeof SETTLEMENT_CURRENCIES)[number]
export const DEFAULT_SETTLEMENT_CURRENCY: SettlementCurrency = 'IDR'

export const SEWING_FACTORY_LIABILITY_REASONS = [
  '做工原因',
  '脏污',
  '抽纱',
  '做错',
  '做毁',
  '破洞',
] as const

export type ReworkReceiveObject = 'ORIGINAL_FACTORY' | 'POST_FACTORY'

export interface SettlementHandoverLine {
  recordId: string
  handedOverQty: number
  handedOverAt: string
}

export interface SettlementReworkLine {
  qcOrderId: string
  receiveObject: ReworkReceiveObject
  reworkQty: number
}

export interface SettlementDefectReasonLine {
  reasonName: string
  qty: number
}

export interface ProductionOrderSettlementSummary {
  cuttingCompletedQty: number
  normalHandoverQty: number
  originalFactoryReworkQty: number
  postFactoryReworkQty: number
  settlementHandoverQty: number
  shortageQty: number
  isComplete: boolean
  defectQty: number
  sewingFactoryLiabilityDefectQty: number
  defectReasonQtyByName: Record<string, number>
}

function sumQty<T>(items: T[], getter: (item: T) => number): number {
  return items.reduce((sum, item) => sum + Math.max(0, getter(item) || 0), 0)
}

export function isSewingFactoryLiabilityReason(reasonName: string): boolean {
  return SEWING_FACTORY_LIABILITY_REASONS.includes(
    reasonName as (typeof SEWING_FACTORY_LIABILITY_REASONS)[number],
  )
}

export function calculateProductionOrderSettlementSummary(input: {
  cuttingCompletedQty: number
  handoverLines: SettlementHandoverLine[]
  reworkLines: SettlementReworkLine[]
  defectReasonLines: SettlementDefectReasonLine[]
}): ProductionOrderSettlementSummary {
  const cuttingCompletedQty = Math.max(0, input.cuttingCompletedQty || 0)
  const normalHandoverQty = sumQty(input.handoverLines, (item) => item.handedOverQty)
  const originalFactoryReworkQty = sumQty(
    input.reworkLines.filter((item) => item.receiveObject === 'ORIGINAL_FACTORY'),
    (item) => item.reworkQty,
  )
  const postFactoryReworkQty = sumQty(
    input.reworkLines.filter((item) => item.receiveObject === 'POST_FACTORY'),
    (item) => item.reworkQty,
  )
  const settlementHandoverQty = normalHandoverQty + postFactoryReworkQty
  const defectReasonQtyByName = input.defectReasonLines.reduce<Record<string, number>>((map, item) => {
    map[item.reasonName] = (map[item.reasonName] ?? 0) + Math.max(0, item.qty || 0)
    return map
  }, {})
  const defectQty = Object.values(defectReasonQtyByName).reduce((sum, qty) => sum + qty, 0)
  const sewingFactoryLiabilityDefectQty = Object.entries(defectReasonQtyByName)
    .filter(([reason]) => isSewingFactoryLiabilityReason(reason))
    .reduce((sum, [, qty]) => sum + qty, 0)

  return {
    cuttingCompletedQty,
    normalHandoverQty,
    originalFactoryReworkQty,
    postFactoryReworkQty,
    settlementHandoverQty,
    shortageQty: Math.max(cuttingCompletedQty - settlementHandoverQty, 0),
    isComplete: settlementHandoverQty === cuttingCompletedQty,
    defectQty,
    sewingFactoryLiabilityDefectQty,
    defectReasonQtyByName,
  }
}
