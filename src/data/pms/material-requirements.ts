import { computeBomDemand, computeMaterialSuggestedQty, getPmsBomTemplate, type PmsBomMaterialLine } from './bom-templates.ts'
import { PMS_STYLE_IMAGES } from './images.ts'
import { nextPmsSequence, roundPmsQty } from './runtime.ts'

export type PmsMaterialPushStatus = '待下推' | '已下推'
export type PmsMaterialRequirementStatus = '已生成' | '部分下推' | '已下推'

export interface PmsMaterialRequirementLine {
  lineNo: string
  materialCode: string
  materialName: string
  materialType: string
  imageUrl: string
  unit: string
  styleCode: string
  styleName: string
  styleImageUrl: string
  sourceSku: string
  skuQty: number
  usagePerPiece: number
  lossRate: number
  plannedUsage: number
  bomDemand: number
  stockQty: number
  historicalStockQty: number
  idHistoricalStockQty: number
  purchasingQty: number
  suggestedQty: number
  actualQty: number
  supplierName: string
  warehouse: string
  pushStatus: PmsMaterialPushStatus
  generatedPurchaseOrderNo: string
}

export interface PmsMaterialRequirement {
  requirementNo: string
  sourcePurchaseOrderNo: string
  sourceSuggestionNo: string
  spu: string
  productName: string
  styleImageUrl: string
  createdAt: string
  status: PmsMaterialRequirementStatus
  lines: PmsMaterialRequirementLine[]
}

interface PmsRequirementRuntime {
  requirements: PmsMaterialRequirement[]
}

let runtime: PmsRequirementRuntime | null = null

function getRuntime(): PmsRequirementRuntime {
  if (!runtime) runtime = buildInitialRuntime()
  return runtime
}

function buildInitialRuntime(): PmsRequirementRuntime {
  const state: PmsRequirementRuntime = { requirements: [] }
  runtime = state
  createPmsMaterialRequirementFromOrder({
    purchaseOrderNo: 'CG-2026-0018',
    spu: 'HG-HD-2603',
    productName: '连帽卫衣',
    imageUrl: PMS_STYLE_IMAGES.hoodie,
    sourceSuggestionNo: 'PSG-2026-0003',
    lines: [
      { sku: 'HG-HD-2603-GY-M', qty: 1200 },
      { sku: 'HG-HD-2603-GY-L', qty: 1400 },
      { sku: 'HG-HD-2603-NV-M', qty: 1000 },
    ],
  })
  createPmsMaterialRequirementFromOrder({
    purchaseOrderNo: 'CG-2026-0020',
    spu: 'HG-SH-2607',
    productName: '商务衬衫',
    imageUrl: PMS_STYLE_IMAGES.shirt,
    sourceSuggestionNo: '',
    lines: [
      { sku: 'HG-SH-2607-WH-M', qty: 700 },
      { sku: 'HG-SH-2607-WH-L', qty: 700 },
    ],
  })
  createPmsMaterialRequirementFromOrder({
    purchaseOrderNo: 'CG-2026-0021',
    spu: 'HG-SK-2604',
    productName: '女款连衣裙',
    imageUrl: PMS_STYLE_IMAGES.dress,
    sourceSuggestionNo: '',
    lines: [
      { sku: 'HG-SK-2604-NV-M', qty: 900 },
      { sku: 'HG-SK-2604-NV-L', qty: 800 },
    ],
  })
  return state
}

function aggregateMaterials(
  bomMaterials: PmsBomMaterialLine[],
  skuLines: Array<{ sku: string; qty: number }>,
): Array<PmsBomMaterialLine & { bomDemand: number }> {
  const bomByCode = new Map(bomMaterials.map((material) => [material.materialCode, material]))
  const aggregated = new Map<string, PmsBomMaterialLine & { bomDemand: number }>()
  skuLines.forEach((skuLine) => {
    bomMaterials.forEach((material) => {
      const demand = computeBomDemand(skuLine.qty, material.usagePerPiece, material.lossRate)
      const existing = aggregated.get(material.materialCode)
      if (existing) existing.bomDemand = roundPmsQty(existing.bomDemand + demand, 2)
      else {
        const base = bomByCode.get(material.materialCode) ?? material
        aggregated.set(material.materialCode, { ...base, bomDemand: demand, usagePerPiece: material.usagePerPiece, lossRate: material.lossRate })
      }
    })
  })
  return [...aggregated.values()]
}

export interface PmsRequirementOrderSource {
  purchaseOrderNo: string
  spu: string
  productName: string
  imageUrl: string
  sourceSuggestionNo: string
  lines: Array<{ sku: string; qty: number }>
}

export function createPmsMaterialRequirementFromOrder(order: PmsRequirementOrderSource): { requirementNo: string; lines: PmsMaterialRequirementLine[] } {
  const bomTemplate = getPmsBomTemplate(order.spu)
  if (!bomTemplate) throw new Error(`BOM 模板不存在: ${order.spu}`)
  const aggregated = aggregateMaterials(bomTemplate.materials, order.lines)
  const requirementNo = nextPmsSequence('MREQ', 4)
  const lines: PmsMaterialRequirementLine[] = aggregated.map((material, index) => ({
    lineNo: `${requirementNo}-${String(index + 1).padStart(2, '0')}`,
    materialCode: material.materialCode,
    materialName: material.materialName,
    materialType: material.materialType,
    imageUrl: material.imageUrl,
    unit: material.unit,
    styleCode: bomTemplate.styleCode,
    styleName: bomTemplate.productName,
    styleImageUrl: bomTemplate.imageUrl,
    sourceSku: order.lines.map((line) => line.sku).join(' / '),
    skuQty: order.lines.reduce((sum, line) => sum + line.qty, 0),
    usagePerPiece: material.usagePerPiece,
    lossRate: material.lossRate,
    plannedUsage: roundPmsQty(material.usagePerPiece * (1 + material.lossRate), 4),
    bomDemand: material.bomDemand,
    stockQty: material.stockQty,
    historicalStockQty: Math.max(material.stockQty + Math.round(material.purchasingQty * 0.18), 0),
    idHistoricalStockQty: Math.max(Math.round(material.stockQty * 0.65), 0),
    purchasingQty: material.purchasingQty,
    suggestedQty: computeMaterialSuggestedQty(material.bomDemand, material.stockQty, material.purchasingQty),
    actualQty: computeMaterialSuggestedQty(material.bomDemand, material.stockQty, material.purchasingQty),
    supplierName: material.supplierName,
    warehouse: material.warehouse,
    pushStatus: '待下推',
    generatedPurchaseOrderNo: '',
  }))
  const requirement: PmsMaterialRequirement = {
    requirementNo,
    sourcePurchaseOrderNo: order.purchaseOrderNo,
    sourceSuggestionNo: order.sourceSuggestionNo,
    spu: order.spu,
    productName: order.productName,
    styleImageUrl: order.imageUrl,
    createdAt: new Date().toISOString(),
    status: '已生成',
    lines,
  }
  getRuntime().requirements.unshift(requirement)
  return { requirementNo, lines }
}

export function listPmsMaterialRequirements(): PmsMaterialRequirement[] {
  return getRuntime().requirements
}

export function getPmsMaterialRequirement(requirementNo: string): PmsMaterialRequirement | undefined {
  return getRuntime().requirements.find((requirement) => requirement.requirementNo === requirementNo)
}

export interface PmsRequirementPushInput {
  lineNo: string
  actualQty: number
  purchaseOrderNo: string
}

export function applyPmsMaterialRequirementPush(requirementNo: string, pushedLines: PmsRequirementPushInput[]): PmsMaterialRequirement {
  const requirement = getPmsMaterialRequirement(requirementNo)
  if (!requirement) throw new Error(`面辅料需求 ${requirementNo} 不存在`)
  pushedLines.forEach((input) => {
    const line = requirement.lines.find((item) => item.lineNo === input.lineNo)
    if (!line) throw new Error(`面辅料需求行 ${input.lineNo} 不存在`)
    line.actualQty = input.actualQty
    line.pushStatus = '已下推'
    line.generatedPurchaseOrderNo = input.purchaseOrderNo
  })
  const pushedCount = requirement.lines.filter((line) => line.pushStatus === '已下推').length
  requirement.status = pushedCount === requirement.lines.length ? '已下推' : '部分下推'
  return requirement
}

export function listPendingPmsRequirementLines(): PmsMaterialRequirementLine[] {
  return getRuntime().requirements.flatMap((requirement) => requirement.lines.filter((line) => line.pushStatus === '待下推' && line.suggestedQty > 0))
}
