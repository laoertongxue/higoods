import {
  completeSupplementOrder,
  getSupplementOrder,
  registerSupplementOrder,
  type SupplementOrderLineFact,
  type SupplementOrderMaterialDemandFact,
  type SupplementOrderStatus,
} from './supplement-order-registry.ts'

export type StableCutOrderSupplementLineFact = SupplementOrderLineFact

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
  readonly materialDemands: ReadonlyArray<SupplementOrderMaterialDemandFact>
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

const stableCutOrderBFixtures: ReadonlyArray<StableCutOrderSupplementFixture> = [1, 2, 3].map((sequenceNo) => {
  const lines = baseLines.map((line) => ({ ...line, supplementQty: line.supplementQty + sequenceNo - 1 }))
  const materialKinds = ['B', 'D', 'B', 'D', 'B', 'D', 'B', 'D', 'B', 'D', 'A', 'B', 'D', 'A', 'B', 'D', 'A', 'B', 'D'] as const
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
    materialDemands: lines.map((line, index) => {
      const kind = materialKinds[index]
      return {
        materialSku: `RELEASE-${kind}`,
        materialName: kind === 'A' ? '面料 A · 净色' : kind === 'B' ? '面料 B · 白色条' : '面料 D · 灰色条',
        requiredQty: Math.round(line.supplementQty * 0.42 * 10) / 10,
        unit: 'yard',
      }
    }),
    createdAt: `2026-07-22 ${String(9 + sequenceNo).padStart(2, '0')}:00`,
    createdBy: '裁床主管 王敏',
    initialStatus: sequenceNo === 1 ? '已完成' : '未完成',
  }
})

const mockReasons = ['裁片损耗', '尺码齐套不足', '验片破损', '裁剪差异'] as const
const mockReasonDetails = [
  '验片后发现左前片有破损，需要按裁片单新增补料。',
  '生产单部分尺码齐套不足，需要补齐后续车缝用料。',
  '现场复核发现裁片损坏，按实际缺口补齐。',
  '裁剪数量与计划存在差异，主管确认后发起补料。',
] as const

const fixedMockDescriptors = [
  ['030004', '001', 'cut-order:po-202603-0004:tdv-demand-spu-2024-010-bom-black-stretch-twill:tdv-demand-spu-2024-010-pattern-main:v1-0:150cm', 'CUT-260302-004-01', 'PO-202603-0004', 'Black', 152, 139, 359.7, '2026-03-25 16:00', '裁床主管 周敏', '已完成', 1],
  ['030004', '002', 'cut-order:po-202603-0004:tdv-demand-spu-2024-010-bom-black-stretch-twill:tdv-demand-spu-2024-010-pattern-main:v1-0:150cm', 'CUT-260302-004-01', 'PO-202603-0004', 'Black', 153, 140, 362.1, '2026-03-25 15:07', '裁床组长 林洁', '未完成', 2],
  ['030004', '003', 'cut-order:po-202603-0004:tdv-demand-spu-2024-010-bom-black-stretch-twill:tdv-demand-spu-2024-010-pattern-main:v1-0:155cm', 'CUT-260306-101-04', 'PO-202603-0004', 'Black', 154, 141, 364.6, '2026-03-25 14:14', '验片主管 陈玲', '未完成', 1],
  ['030004', '004', 'cut-order:po-202603-0004:tdv-demand-spu-2024-010-bom-black-stretch-twill-select-a:tdv-demand-spu-2024-010-pattern-main:v1-0:150cm', 'CUT-260306-101-05', 'PO-202603-0004', 'Black', 155, 142, 367.1, '2026-03-25 13:21', '裁床主管 王海', '已完成', 1],
  ['030004', '005', 'cut-order:po-202603-0004:tdv-demand-spu-2024-010-bom-black-stretch-twill-history-b:tdv-demand-spu-2024-010-pattern-main:v1-0:150cm', 'CUT-260306-101-06', 'PO-202603-0004', 'Black', 152, 139, 359.7, '2026-03-24 16:28', '裁床主管 周敏', '未完成', 1],
  ['030002', '006', 'cut-order:po-202603-0002:tdv-demand-spu-2024-005-bom-main:tdv-demand-spu-2024-005-pattern-main:v2-1:150cm', 'CUT-260303-002-01', 'PO-202603-0002', 'Grey', 111, 99, 259.6, '2026-03-24 15:35', '裁床组长 林洁', '未完成', 1],
  ['030002', '007', 'cut-order:po-202603-0002:tdv-demand-spu-2024-005-bom-main-stable-101-01:tdv-demand-spu-2024-005-pattern-main:v2-1:150cm', 'CUT-260306-101-01', 'PO-202603-0002', 'Grey', 112, 100, 262, '2026-03-24 14:42', '验片主管 陈玲', '已完成', 1],
  ['030002', '008', 'cut-order:po-202603-0002:tdv-demand-spu-2024-005-bom-main-stable-101-02:tdv-demand-spu-2024-005-pattern-main:v2-1:150cm', 'CUT-260306-101-02', 'PO-202603-0002', 'Grey', 113, 101, 264.6, '2026-03-24 13:49', '裁床主管 王海', '未完成', 1],
  ['030002', '009', 'cut-order:po-202603-0002:tdv-demand-spu-2024-005-bom-main-stable-007-01:tdv-demand-spu-2024-005-pattern-main:v2-1:150cm', 'CUT-260303-007-01', 'PO-202603-0002', 'Grey', 110, 98, 257.2, '2026-03-23 16:56', '裁床主管 周敏', '未完成', 1],
  ['030003', '010', 'cut-order:po-202603-0003:tdv-demand-spu-2024-009-bom-main:tdv-demand-spu-2024-009-pattern-main:v1-2:150cm', 'CUT-260301-003-01', 'PO-202603-0003', 'White', 161, 162, 399.2, '2026-03-23 15:03', '裁床组长 林洁', '已完成', 1],
  ['030003', '011', 'cut-order:po-202603-0003:tdv-demand-spu-2024-009-bom-main-stable-005-01:tdv-demand-spu-2024-009-pattern-main:v1-2:150cm', 'CUT-260301-005-01', 'PO-202603-0003', 'White', 162, 163, 401.7, '2026-03-23 14:10', '验片主管 陈玲', '未完成', 1],
  ['030008', '012', 'cut-order:po-202603-0008:tdv-demand-spu-2024-014-bom-main:tdv-demand-spu-2024-014-pattern-main:v1-0:150cm', 'CUT-260304-008-01', 'PO-202603-0008', 'Green', 48, 34, 101.3, '2026-03-23 13:17', '裁床主管 王海', '未完成', 1],
] as const

const fixedMockSupplementFixtures: ReadonlyArray<StableCutOrderSupplementFixture> = fixedMockDescriptors.map((descriptor, index) => {
  const [processSeed, serial, cutOrderId, cutOrderNo, productionOrderNo, color, largeQty, mediumQty, requiredQty, createdAt, createdBy, initialStatus, sequenceNo] = descriptor
  const lines = [
    { color, size: 'L', supplementQty: largeQty },
    { color, size: 'M', supplementQty: mediumQty },
  ]
  const materialName = color === 'Black' ? '黑色弹力斜纹布' : color === 'Grey' ? '灰色针织布' : color === 'White' ? '白色梭织布' : '绿色棉布'
  return {
    id: `supplement-${processSeed}-${serial}`,
    recordNo: `SUP-${processSeed}-${serial}`,
    cutOrderId,
    cutOrderNo,
    productionOrderNo,
    sequenceNo,
    reason: mockReasons[index % mockReasons.length],
    reasonDetail: mockReasonDetails[index % mockReasonDetails.length],
    totalQty: largeQty + mediumQty,
    lineSummary: `${color}/L/${largeQty}件；${color}/M/${mediumQty}件`,
    lines,
    materialDemands: [{
      materialSku: `FAB-${processSeed}-${color.toUpperCase()}`,
      materialName,
      requiredQty,
      unit: 'yard',
    }],
    createdAt,
    createdBy,
    initialStatus: initialStatus as SupplementOrderStatus,
  }
})

export const fixedSupplementOrderFixtures: ReadonlyArray<StableCutOrderSupplementFixture> = [
  ...stableCutOrderBFixtures,
  ...fixedMockSupplementFixtures,
]

export const stableCutOrderSupplementFixtures = stableCutOrderBFixtures

export function ensureFixedSupplementOrderFixturesRegistered(): void {
  fixedSupplementOrderFixtures.forEach((fixture) => {
    registerSupplementOrder({
      id: fixture.id,
      recordNo: fixture.recordNo,
      cutOrderId: fixture.cutOrderId,
      cutOrderNo: fixture.cutOrderNo,
      productionOrderNo: fixture.productionOrderNo,
      reason: fixture.reason,
      reasonDetail: fixture.reasonDetail,
      totalQty: fixture.totalQty,
      lineSummary: fixture.lineSummary,
      lines: fixture.lines,
      materialDemands: fixture.materialDemands,
      createdAt: fixture.createdAt,
      createdBy: fixture.createdBy,
    })
  })
  fixedSupplementOrderFixtures.forEach((fixture) => {
    const order = getSupplementOrder(fixture.id)
    if (fixture.initialStatus === '已完成' && order?.status === '未完成') {
      completeSupplementOrder({ id: order.id, completedAt: fixture.createdAt, completedBy: fixture.createdBy })
    }
  })
}
