import {
  completeSupplementOrder,
  getSupplementOrder,
  registerSupplementOrder,
  type SupplementOrderStatus,
} from './supplement-order-registry.ts'

export interface StableCutOrderSupplementLineFact {
  readonly color: string
  readonly size: string
  readonly supplementQty: number
}

export interface StableCutOrderSupplementFixture {
  readonly id: string
  readonly recordNo: string
  readonly cutOrderId: string
  readonly cutOrderNo: string
  readonly productionOrderNo: string
  readonly sequenceNo: number
  readonly reason: string
  readonly reasonDetail: string
  readonly totalQty: number
  readonly lineSummary: string
  readonly lines: ReadonlyArray<StableCutOrderSupplementLineFact>
  readonly createdAt: string
  readonly createdBy: string
  readonly initialStatus: SupplementOrderStatus
}

const baseLines: ReadonlyArray<StableCutOrderSupplementLineFact> = [
  ['Black', 'M', 9], ['Black', 'M', 10], ['Black', 'XL', 23], ['Black', 'XL', 24],
  ['White', 'M', 10], ['White', 'M', 11], ['White', 'L', 17], ['White', 'L', 13],
  ['White', 'XL', 19], ['White', 'XL', 15], ['Red', 'M', 16], ['Red', 'M', 27],
  ['Red', 'M', 23], ['Red', 'L', 24], ['Red', 'L', 30], ['Red', 'L', 28],
  ['Red', 'XL', 22], ['Red', 'XL', 38], ['Red', 'XL', 34],
].map(([color, size, supplementQty]) => ({
  color: String(color),
  size: String(size),
  supplementQty: Number(supplementQty),
}))

export const stableCutOrderSupplementFixtures: ReadonlyArray<StableCutOrderSupplementFixture> = [1, 2, 3].map((sequenceNo) => {
  const lines = baseLines.map((line) => ({ ...line, supplementQty: line.supplementQty + sequenceNo - 1 }))
  return {
    id: `supplement-cut14671-b-${String(sequenceNo).padStart(3, '0')}`,
    recordNo: `SUP-CUT14671-B-${String(sequenceNo).padStart(3, '0')}`,
    cutOrderId: 'cut-14671-b',
    cutOrderNo: 'CUT14671-B',
    productionOrderNo: 'PO14671',
    sequenceNo,
    reason: sequenceNo === 1 ? '验片破损' : '尺码齐套不足',
    reasonDetail: `CUT14671-B 第 ${sequenceNo} 次补料演示记录。`,
    totalQty: lines.reduce((total, line) => total + line.supplementQty, 0),
    lineSummary: `Black/M/${9 + sequenceNo - 1}件；Black/M/${10 + sequenceNo - 1}件`,
    lines,
    createdAt: `2026-07-22 ${String(9 + sequenceNo).padStart(2, '0')}:00`,
    createdBy: '裁床主管 王敏',
    initialStatus: sequenceNo === 1 ? '已完成' : '未完成',
  }
})

export function ensureStableCutOrderSupplementOrders(): void {
  stableCutOrderSupplementFixtures.forEach((fixture) => {
    registerSupplementOrder({
      id: fixture.id,
      recordNo: fixture.recordNo,
      cutOrderId: fixture.cutOrderId,
      cutOrderNo: fixture.cutOrderNo,
      productionOrderNo: fixture.productionOrderNo,
      reason: fixture.reason,
      totalQty: fixture.totalQty,
      lineSummary: fixture.lineSummary,
      createdAt: fixture.createdAt,
      createdBy: fixture.createdBy,
    })
  })
  const first = getSupplementOrder(stableCutOrderSupplementFixtures[0].id)
  if (first?.status === '未完成') {
    completeSupplementOrder({ id: first.id, completedAt: first.createdAt, completedBy: first.createdBy })
  }
}
