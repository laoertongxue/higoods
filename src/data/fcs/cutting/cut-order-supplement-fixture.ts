import {
  completeSupplementOrder,
  getSupplementOrder,
  registerSupplementOrder,
  type RegisterSupplementOrderInput,
  type SupplementDraftMeta,
  type SupplementMaterialDemand,
  type SupplementOrderLifecycle,
  type SupplementOrderLineFact,
  type SupplementOrderStatus,
} from './supplement-order-registry.ts'
import { cuttingOrderProgressRecords } from './order-progress.ts'
import { buildSupplementSupplyDecisions } from './supplement-supply-domain.ts'
import { registerSupplementMaterialPrepDemand } from './supplement-material-prep-demand-registry.ts'

export type StableCutOrderSupplementLineFact = SupplementOrderLineFact

export interface StableCutOrderSupplementFixture {
  readonly id: string
  readonly recordNo: string
  readonly cutOrderId: string
  readonly cutOrderNo: string
  readonly productionOrderNo: string
  readonly productionOrderId?: string
  readonly sequenceNo: number
  readonly reason: string
  readonly reasonDetail: string
  readonly totalQty: number
  readonly lineSummary: string
  readonly lines: ReadonlyArray<StableCutOrderSupplementLineFact>
  readonly materialDemands: ReadonlyArray<SupplementMaterialDemand>
  readonly createdAt: string
  readonly createdBy: string
  readonly initialStatus: SupplementOrderStatus
  readonly confirmationKey?: string
  readonly draftMeta?: SupplementDraftMeta
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

function buildFixtureMaterialDemand(input: {
  cutOrderId: string
  cutOrderNo: string
  materialSku: string
  materialName: string
  requiredQty: number
  unit: string
}): SupplementMaterialDemand {
  const imageByMaterialSku: Record<string, string> = {
    'RELEASE-A': '/materials/fabric-main.jpg',
    'RELEASE-B': '/materials/fabric-contrast.jpg',
    'RELEASE-C': '/materials/fabric-lining.jpg',
    'RELEASE-D': '/materials/fabric-lining.jpg',
  }
  return {
    key: `${input.materialSku}::${input.unit}`,
    materialPatternMappingId: input.materialSku,
    sourceBomItemId: input.materialSku,
    techPackVersionId: '',
    materialSku: input.materialSku,
    materialName: input.materialName,
    materialTypeLabel: '面料',
    materialImageUrl: imageByMaterialSku[input.materialSku] || '/materials/fabric-main.jpg',
    materialImageAlt: `${input.materialName}（${input.materialSku}）实物图`,
    materialAlias: '',
    materialRole: '未识别',
    roleSource: '顺序推断',
    roleConfirmStatus: '待确认',
    patternId: '',
    patternName: '',
    requiredQty: input.requiredQty,
    unit: input.unit,
    printRequired: false,
    dyeRequired: false,
    processNote: '无需印花染色',
    originalCutOrderId: input.cutOrderId,
    originalCutOrderNo: input.cutOrderNo,
  }
}

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
    materialDemands: (['A', 'B', 'D'] as const).map((kind) => {
      const materialSku = `RELEASE-${kind}`
      const materialName = kind === 'A' ? '面料 A · 净色' : kind === 'B' ? '面料 B · 白色条' : '面料 D · 灰色条'
      const requiredQty = lines.reduce((sum, line, index) => materialKinds[index] === kind
        ? sum + Math.round(line.supplementQty * 0.42 * 10) / 10
        : sum, 0)
      return buildFixtureMaterialDemand({
        cutOrderId: 'cut-14671-b',
        cutOrderNo: 'CUT14671-B',
        materialSku,
        materialName,
        requiredQty: Number(requiredQty.toFixed(1)),
        unit: 'yard',
      })
    }),
    createdAt: `2026-07-22 ${String(9 + sequenceNo).padStart(2, '0')}:00`,
    createdBy: '裁床主管 王敏',
    initialStatus: sequenceNo === 1 ? '已完成' : '未完成',
    draftMeta: {
      candidateId: 'cut-order:cut-14671-b',
      sourceType: 'cut-order',
      sourceNo: 'CUT14671-B',
      styleName: '女式基础圆领短袖',
      spuCode: 'ASYSA26060310',
      styleImageUrl: '/tshirt-sample.jpg',
      styleImageAlt: '女式基础圆领短袖（ASYSA26060310）款式图',
    },
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
  const materialSku = `FAB-${processSeed}-${color.toUpperCase()}`
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
    materialDemands: [buildFixtureMaterialDemand({
      cutOrderId,
      cutOrderNo,
      materialSku,
      materialName,
      requiredQty,
      unit: 'yard',
    })],
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

const pickupMappingId = 'TPS-PO-202603-0002-mapping-1-tdv_demand_SPU_2024_005-pattern-main-sleeve'

interface PickupSeedSupplementSpec {
  readonly id: string
  readonly recordNo: string
  readonly confirmationKey: string
  readonly createdAt: string
  readonly createdBy: string
  readonly sourceNo: string
  readonly reason: string
  readonly reasonDetail: string
  readonly materialSku: string
  readonly materialName: string
  readonly requiredQty: number
  readonly originalCutOrderId: string
}

const pickupSeedSupplementSpecs: ReadonlyArray<PickupSeedSupplementSpec> = [
  {
    id: 'supplement-confirmed-000TDWG',
    recordNo: 'SUP-000TDWG',
    confirmationKey: 'mock-supplement-8',
    createdAt: '2026-03-24 13:49',
    createdBy: '裁床主管 王海',
    sourceNo: 'CUT-260303-002-01',
    reason: '裁剪差异',
    reasonDetail: '裁剪数量与计划存在差异，主管确认后发起补料。',
    materialSku: 'tdv_demand_SPU_2024_005-bom-main',
    materialName: '主面料',
    requiredQty: 264.51,
    originalCutOrderId: 'cut-order:po-202603-0002:tdv-demand-spu-2024-005-bom-main:tdv-demand-spu-2024-005-pattern-main:v2-1:150cm',
  },
  {
    id: 'supplement-confirmed-00ASZLF',
    recordNo: 'SUP-00ASZLF',
    confirmationKey: 'mock-supplement-9',
    createdAt: '2026-03-23 16:56',
    createdBy: '裁床主管 周敏',
    sourceNo: 'CUT-260306-101-01',
    reason: '裁片损耗',
    reasonDetail: '验片后发现左前片有破损，需要按裁片单新增补料。',
    materialSku: 'tdv_demand_SPU_2024_005-bom-main-stable-101-01',
    materialName: 'Black 弹力斜纹主面料',
    requiredQty: 257.09,
    originalCutOrderId: 'cut-order:po-202603-0002:tdv-demand-spu-2024-005-bom-main-stable-101-01:tdv-demand-spu-2024-005-pattern-main:v2-1:150cm',
  },
  {
    id: 'supplement-confirmed-0JPEXI9',
    recordNo: 'SUP-0JPEXI9',
    confirmationKey: 'mock-supplement-10',
    createdAt: '2026-03-23 15:03',
    createdBy: '裁床组长 林洁',
    sourceNo: 'CUT-260306-101-02',
    reason: '尺码齐套不足',
    reasonDetail: '生产单部分尺码齐套不足，需要补齐后续车缝用料。',
    materialSku: 'tdv_demand_SPU_2024_005-bom-main-stable-101-02',
    materialName: 'Charcoal 弹力斜纹主面料',
    requiredQty: 259.56,
    originalCutOrderId: 'cut-order:po-202603-0002:tdv-demand-spu-2024-005-bom-main-stable-101-02:tdv-demand-spu-2024-005-pattern-main:v2-1:150cm',
  },
  {
    id: 'supplement-confirmed-0JFFBTA',
    recordNo: 'SUP-0JFFBTA',
    confirmationKey: 'mock-supplement-11',
    createdAt: '2026-03-23 14:10',
    createdBy: '验片主管 陈玲',
    sourceNo: 'CUT-260303-007-01',
    reason: '验片破损',
    reasonDetail: '现场复核发现裁片损坏，按实际缺口补齐。',
    materialSku: 'tdv_demand_SPU_2024_005-bom-main-stable-007-01',
    materialName: 'PDA 异常同步主面料',
    requiredQty: 262.03,
    originalCutOrderId: 'cut-order:po-202603-0002:tdv-demand-spu-2024-005-bom-main-stable-007-01:tdv-demand-spu-2024-005-pattern-main:v2-1:150cm',
  },
]

function buildPickupSeedFixture(spec: PickupSeedSupplementSpec): StableCutOrderSupplementFixture {
  return {
    id: spec.id,
    recordNo: spec.recordNo,
    cutOrderId: spec.originalCutOrderId,
    cutOrderNo: spec.sourceNo,
    productionOrderNo: 'PO-202603-0002',
    productionOrderId: 'PO-202603-0002',
    sequenceNo: 1,
    reason: spec.reason,
    reasonDetail: spec.reasonDetail,
    totalQty: 0,
    lineSummary: '',
    lines: [],
    materialDemands: [{
      key: `${pickupMappingId}::yard`,
      materialPatternMappingId: pickupMappingId,
      sourceBomItemId: 'tdv_demand_SPU_2024_005-bom-main',
      techPackVersionId: 'tdv_demand_SPU_2024_005',
      materialSku: spec.materialSku,
      materialName: spec.materialName,
      materialTypeLabel: '面料',
      materialImageUrl: '/materials/fabric-main.jpg',
      materialImageAlt: `${spec.materialName}（${spec.materialSku}）实物图`,
      materialAlias: 'C',
      materialRole: '面料C',
      roleSource: '物料-纸样关联别名',
      roleConfirmStatus: '已确认',
      patternId: 'tdv_demand_SPU_2024_005-pattern-main-sleeve',
      patternName: '袖片',
      requiredQty: spec.requiredQty,
      unit: 'yard',
      printRequired: false,
      dyeRequired: false,
      processNote: '无需印花染色',
      originalCutOrderId: spec.originalCutOrderId,
      originalCutOrderNo: spec.sourceNo,
    }],
    createdAt: spec.createdAt,
    createdBy: spec.createdBy,
    initialStatus: '未完成',
    confirmationKey: spec.confirmationKey,
    draftMeta: {
      candidateId: `cut-order:cutting-op:PO-202603-0002:${spec.sourceNo}`,
      sourceType: 'cut-order',
      sourceNo: spec.sourceNo,
      styleName: 'Jaket Hoodie Unisex',
      spuCode: 'SPU-2024-005',
      styleImageUrl: '/jacket-sample.jpg',
      styleImageAlt: 'Jaket Hoodie Unisex（SPU-2024-005）款式图',
    },
  }
}

export const pickupSeedSupplementFixtures: ReadonlyArray<StableCutOrderSupplementFixture> =
  pickupSeedSupplementSpecs.map(buildPickupSeedFixture)

export const stablePickupSeedSupplementIds = pickupSeedSupplementFixtures.map((fixture) => fixture.id)

function toRegisterSupplementOrderInput(
  fixture: StableCutOrderSupplementFixture,
): RegisterSupplementOrderInput {
  const sourceRecord = cuttingOrderProgressRecords.find((record) => record.productionOrderId === (fixture.productionOrderId ?? fixture.productionOrderNo))
  const styleName = fixture.draftMeta?.styleName || sourceRecord?.styleName || '款式未记录'
  const spuCode = fixture.draftMeta?.spuCode || sourceRecord?.spuCode || '款号未记录'
  const styleImageUrl = fixture.draftMeta?.styleImageUrl || sourceRecord?.spuImageUrl || ''
  return {
    id: fixture.id,
    recordNo: fixture.recordNo,
    cutOrderId: fixture.cutOrderId,
    cutOrderNo: fixture.cutOrderNo,
    productionOrderNo: fixture.productionOrderNo,
    productionOrderId: fixture.productionOrderId ?? fixture.productionOrderNo,
    reason: fixture.reason,
    reasonDetail: fixture.reasonDetail,
    totalQty: fixture.totalQty,
    lineSummary: fixture.lineSummary,
    lines: fixture.lines,
    materialDemands: fixture.materialDemands,
    createdAt: fixture.createdAt,
    createdBy: fixture.createdBy,
    confirmationKey: fixture.confirmationKey ?? `fixture:${fixture.id}`,
    supplyDecisionSnapshots: buildSupplementSupplyDecisions({ demands: [...fixture.materialDemands], checkedAt: fixture.createdAt, confirmUncovered: true }),
    materialPrepDemandId: `SUP-PREP:${fixture.id}`,
    draftMeta: fixture.draftMeta ?? {
      candidateId: '',
      sourceType: 'cut-order',
      sourceNo: fixture.cutOrderNo,
      styleName,
      spuCode,
      styleImageUrl,
      styleImageAlt: `${styleName}（${spuCode}）款式图`,
    },
  }
}

export function ensureFixedSupplementOrderFixturesRegistered(): ReadonlyArray<SupplementOrderLifecycle> {
  const allFixtures = [...fixedSupplementOrderFixtures, ...pickupSeedSupplementFixtures]
  allFixtures.forEach((fixture) => {
    const order = registerSupplementOrder(toRegisterSupplementOrderInput(fixture))
    registerSupplementMaterialPrepDemand({
      supplementOrderId: order.id,
      supplementOrderNo: order.recordNo,
      productionOrderId: order.productionOrderId,
      productionOrderNo: order.productionOrderNo,
      cutOrderId: order.cutOrderId,
      cutOrderNo: order.cutOrderNo,
      sequenceNo: order.sequenceNo,
      reason: [order.reason, order.reasonDetail].filter(Boolean).join('：'),
      materialDemands: order.materialDemands,
      supplyDecisionSnapshots: order.supplyDecisionSnapshots,
      createdPurchaseOrderRefs: order.createdPurchaseOrderRefs,
      createdAt: order.createdAt,
    })
  })
  allFixtures.forEach((fixture) => {
    const order = getSupplementOrder(fixture.id)
    if (fixture.initialStatus === '已完成' && order?.status === '未完成') {
      completeSupplementOrder({ id: order.id, completedAt: fixture.createdAt, completedBy: fixture.createdBy })
    }
  })
  return allFixtures
    .map((fixture) => getSupplementOrder(fixture.id))
    .filter((order): order is SupplementOrderLifecycle => Boolean(order))
}

export function ensurePickupSeedSupplementFixturesRegistered(): ReadonlyArray<SupplementOrderLifecycle> {
  pickupSeedSupplementFixtures.forEach((fixture) => {
    const order = registerSupplementOrder(toRegisterSupplementOrderInput(fixture))
    registerSupplementMaterialPrepDemand({ supplementOrderId: order.id, supplementOrderNo: order.recordNo, productionOrderId: order.productionOrderId, productionOrderNo: order.productionOrderNo, cutOrderId: order.cutOrderId, cutOrderNo: order.cutOrderNo, sequenceNo: order.sequenceNo, reason: [order.reason, order.reasonDetail].filter(Boolean).join('：'), materialDemands: order.materialDemands, supplyDecisionSnapshots: order.supplyDecisionSnapshots, createdPurchaseOrderRefs: order.createdPurchaseOrderRefs, createdAt: order.createdAt })
  })
  return pickupSeedSupplementFixtures
    .map((fixture) => getSupplementOrder(fixture.id))
    .filter((order): order is SupplementOrderLifecycle => Boolean(order))
}
