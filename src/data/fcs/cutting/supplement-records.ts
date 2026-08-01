import type { CuttingMaterialLine } from './types.ts'
import type { TechPackBomItemSnapshot } from '../production-tech-pack-snapshot-types.ts'
import type { TechnicalColorMaterialMappingLine } from '../../pcs-technical-data-version-types.ts'

export type SupplementManualSourceType = 'production-order' | 'cut-order'
export type SupplementSourceType = SupplementManualSourceType | 'release-snapshot'
export type SupplementRecordStatus = '已确认'
export type SupplementMaterialRole = '面料A' | '面料B' | '面料C' | '里布' | '衬' | '罗纹' | '辅料' | '包材' | '未识别'
export type SupplementRoleSource = '物料-纸样关联别名' | '物料行继承别名' | '纸样辅助识别' | '顺序推断' | '未识别'
export type SupplementRoleConfirmStatus = '已确认' | '待确认'

export interface SupplementSizeColorRow {
  key: string
  skuCode: string
  color: string
  size: string
  plannedQty: number
  actualCutPieces: number
  inboundPieces: number
  completeSetQty: number
  inboundSetQty: number
  shortageQty: number
  existingSupplementQty: number
  suggestedSupplementQty: number
  relatedCutOrderNos: string[]
}

export interface SupplementMaterialDemand {
  key: string
  materialPatternMappingId: string
  sourceBomItemId: string
  techPackVersionId: string
  materialSku: string
  materialName: string
  materialTypeLabel: string
  materialImageUrl: string
  materialAlias: string
  materialRole: SupplementMaterialRole
  roleSource: SupplementRoleSource
  roleConfirmStatus: SupplementRoleConfirmStatus
  patternId: string
  patternName: string
  requiredQty: number
  unit: string
  printRequired: boolean
  dyeRequired: boolean
  processNote: string
  originalCutOrderId: string
  originalCutOrderNo: string
}

export interface SupplementMaterialPatternRef {
  materialPatternMappingId: string
  techPackVersionId: string
  materialSku: string
  materialName: string
  materialImageUrl: string
  materialTypeLabel: string
  materialAlias: string
  materialRole: SupplementMaterialRole
  roleSource: SupplementRoleSource
  roleConfirmStatus: SupplementRoleConfirmStatus
  patternId: string
  patternName: string
  cutOrderNo: string
  line: CuttingMaterialLine
  mappingLine?: TechnicalColorMaterialMappingLine
  bomItem?: TechPackBomItemSnapshot
}

export interface SupplementAbAnalysisRow {
  key: string
  skuCode: string
  color: string
  size: string
  plannedQty: number
  benchmarkMaterial: SupplementMaterialPatternRef
  shortageMaterial: SupplementMaterialPatternRef
  benchmarkCutQty: number
  currentRoleCutQty: number
  differenceQty: number
  shortageQty: number
  existingSupplementQty: number
  suggestedSupplementQty: number
  relatedCutOrderNos: string[]
  roleConfirmStatus: SupplementRoleConfirmStatus
}

export interface SupplementLine extends SupplementSizeColorRow {
  supplementQty: number
  basis: SupplementAbAnalysisRow
  isManualAdjusted: boolean
  adjustReason: string
  actualMissingPieceQty?: number
  piecesPerGarment?: number
}

export interface SupplementDraft {
  candidateId: string
  sourceType: SupplementSourceType
  sourceNo: string
  productionOrderId: string
  productionOrderNo: string
  styleName: string
  spuCode: string
  reason: string
  reasonDetail: string
  lines: SupplementLine[]
  materialDemands: SupplementMaterialDemand[]
  confirmationIdentity?: string
  releaseSnapshotId?: string
  releaseMatrixVersion?: number
  releaseTargetConfirmedAt?: string
}

export interface SupplementProcessWorkOrderRef {
  processType: 'PRINT' | 'DYE'
  sourceType: 'CUT_PIECE_SUPPLEMENT'
  workOrderId: string
  workOrderNo: string
  materialSku: string
  materialName: string
  plannedQty: number
  unit: string
}

export interface SupplementRecord {
  id: string
  recordNo: string
  confirmationKey: string
  requestFingerprint: string
  status: SupplementRecordStatus
  createdAt: string
  createdBy: string
  draft: SupplementDraft
  processWorkOrderRefs: SupplementProcessWorkOrderRef[]
}

let supplementRecords: SupplementRecord[] = []

export function listSupplementRecords(): SupplementRecord[] {
  return structuredClone(supplementRecords)
}

export function prependSupplementRecord(record: SupplementRecord): SupplementRecord {
  supplementRecords = [structuredClone(record), ...supplementRecords]
  return structuredClone(record)
}

interface PickupSeedSpec {
  id: string
  recordNo: string
  confirmationKey: string
  createdAt: string
  createdBy: string
  sourceNo: string
  reason: string
  reasonDetail: string
  materialSku: string
  materialName: string
  requiredQty: number
  originalCutOrderId: string
}

const pickupSeedSpecs: PickupSeedSpec[] = [
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

function buildPickupSeedRecord(spec: PickupSeedSpec): SupplementRecord {
  const mappingId = 'TPS-PO-202603-0002-mapping-1-tdv_demand_SPU_2024_005-pattern-main-sleeve'
  return {
    id: spec.id,
    recordNo: spec.recordNo,
    confirmationKey: spec.confirmationKey,
    requestFingerprint: `pickup-seed:${spec.confirmationKey}:${spec.materialSku}`,
    status: '已确认',
    createdAt: spec.createdAt,
    createdBy: spec.createdBy,
    draft: {
      candidateId: `cut-order:cutting-op:PO-202603-0002:${spec.sourceNo}`,
      sourceType: 'cut-order',
      sourceNo: spec.sourceNo,
      productionOrderId: 'PO-202603-0002',
      productionOrderNo: 'PO-202603-0002',
      styleName: 'Jaket Hoodie Unisex',
      spuCode: 'SPU-2024-005',
      reason: spec.reason,
      reasonDetail: spec.reasonDetail,
      lines: [],
      confirmationIdentity: spec.confirmationKey,
      materialDemands: [{
        key: `${mappingId}::yard`,
        materialPatternMappingId: mappingId,
        sourceBomItemId: 'tdv_demand_SPU_2024_005-bom-main',
        techPackVersionId: 'tdv_demand_SPU_2024_005',
        materialSku: spec.materialSku,
        materialName: spec.materialName,
        materialTypeLabel: '面料',
        materialImageUrl: '/materials/fabric-main.jpg',
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
    },
    processWorkOrderRefs: [],
  }
}

export function ensureSupplementRecordPickupSeeds(): SupplementRecord[] {
  if (supplementRecords.length === 0) {
    supplementRecords = pickupSeedSpecs.map(buildPickupSeedRecord)
  }
  return listSupplementRecords()
}

export function resetSupplementRecordsForTest(): void {
  supplementRecords = []
}
