import {
  type MarkerScheme,
  type MarkerSchemeBed,
  type MarkerPlan,
  markerPlanModeMeta,
} from './marker-plan-domain.ts'

export interface MarkerSchemeSourceValidationInput {
  contextNo: string
  spuCode: string
  techPackStatusLabel?: string
  materialSkuSummary?: string
}

export interface MarkerSchemeSourceValidationResult {
  passed: boolean
  messages: string[]
}

function nowText(date = new Date()): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + (Number.isFinite(Number(value)) ? Number(value) : 0), 0)
}

export function validateMarkerSchemeSourceCandidates(
  candidates: MarkerSchemeSourceValidationInput[],
): MarkerSchemeSourceValidationResult {
  const messages: string[] = []
  const spuCodes = Array.from(new Set(candidates.map((candidate) => candidate.spuCode).filter(Boolean)))
  const materialSkus = Array.from(new Set(candidates.map((candidate) => candidate.materialSkuSummary || '').filter(Boolean)))
  if (!candidates.length) messages.push('请选择来源单据')
  if (spuCodes.length > 1) messages.push('已选单据不属于同一款式')
  if (candidates.some((candidate) => !String(candidate.techPackStatusLabel || '').includes('正式'))) {
    messages.push('当前款式没有正式版技术包')
  }
  if (materialSkus.length > 1) messages.push('已选单据面料不一致，请拆分方案')
  return {
    passed: messages.length === 0,
    messages,
  }
}

export function buildMarkerSchemeBedsFromPlan(plan: MarkerPlan): MarkerSchemeBed[] {
  return plan.beds?.length ? plan.beds : []
}

export function buildMarkerSchemeFromPlan(plan: MarkerPlan): MarkerScheme {
  const beds = buildMarkerSchemeBedsFromPlan(plan)
  const demandRows = plan.schemeDemandRows?.length ? plan.schemeDemandRows : []
  const normalBedCount = beds.filter((bed) => bed.bedMode === 'normal').length
  const highLowBedCount = beds.filter((bed) => bed.bedMode === 'high_low').length
  const foldBedCount = beds.filter((bed) => bed.bedMode === 'fold_normal' || bed.bedMode === 'fold_high_low').length
  const totalPlannedQty = sum(beds.map((bed) => bed.plannedGarmentQty))
  const totalDemandQty = sum(demandRows.map((row) => row.demandQty))
  const modeSummaryText = Array.from(new Set(beds.map((bed) => markerPlanModeMeta[bed.bedMode].label)))
    .map((label) => {
      const count = beds.filter((bed) => markerPlanModeMeta[bed.bedMode].label === label).length
      return `${label} x${count}`
    })
    .join('，') || markerPlanModeMeta[plan.markerMode].label

  return {
    schemeId: plan.schemeId || plan.id,
    schemeNo: plan.schemeNo || plan.markerNo,
    schemeName: plan.schemeName || plan.markerNo,
    sourceType: plan.contextType === 'merge-batch' ? 'merge-batch' : 'original-cut-order',
    sourceOriginalCutOrderIds: [...plan.originalCutOrderIds],
    sourceOriginalCutOrderNos: [...plan.originalCutOrderNos],
    sourceMergeBatchIds: plan.mergeBatchId ? [plan.mergeBatchId] : [],
    sourceMergeBatchNos: plan.mergeBatchNo ? [plan.mergeBatchNo] : [],
    productionOrderIds: [...plan.productionOrderIds],
    productionOrderNos: [...plan.productionOrderNos],
    spuCode: plan.spuCode,
    spuName: plan.styleName,
    styleCode: plan.styleCode,
    techPackId: plan.techPackId || plan.techPackSpu || plan.spuCode,
    techPackVersion: plan.techPackVersion || '正式版',
    techPackStatus: '正式版',
    materialSku: plan.sourceMaterialSku || plan.materialSkuSummary,
    materialName: plan.materialSkuSummary,
    fabricWidth: plan.foldConfig?.originalEffectiveWidth || 0,
    fabricWidthUnit: 'cm',
    demandRows,
    beds,
    totalDemandQty,
    totalPlannedQty,
    remainingQty: Math.max(totalDemandQty - totalPlannedQty, 0),
    overPlannedQty: Math.max(totalPlannedQty - totalDemandQty, 0),
    bedCount: beds.length,
    normalBedCount,
    highLowBedCount,
    foldBedCount,
    modeSummaryText,
    schemeImage: plan.schemeImage || null,
    detailImage: plan.detailImage || null,
    imageStatus: plan.schemeImageStatus || '待生成',
    spreadingStatus: plan.schemeSpreadingStatus || '未排程',
    status: plan.status,
    createdAt: plan.createdAt,
    createdBy: plan.createdBy,
    updatedAt: plan.updatedAt || nowText(),
    updatedBy: plan.updatedBy,
  }
}
