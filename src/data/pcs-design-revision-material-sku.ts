import { getMaterialArchiveById, getMaterialSkuRecordById } from './pcs-material-archive-repository.ts'
import type { MaterialSkuRecord } from './pcs-material-archive-types.ts'

export interface DesignRevisionMaterialSkuSnapshot {
  targetSkuId: string
  targetSkuCode: string
  materialId: string
  materialName: string
  materialImageUrl: string
  rawSkuId: string
  rawSkuCode: string
  dyedSkuId: string
  dyedSkuCode: string
  colorName: string
  pantoneCode: string
  patternCode: string
  patternImageUrl: string
  requiresDye: boolean
  requiresPrint: boolean
  pricingUnit: string
  capturedAt: string
}

function activeSku(id: string): MaterialSkuRecord | null {
  const sku = getMaterialSkuRecordById(id)
  return sku?.status === 'ACTIVE' ? sku : null
}

/** 目标 SKU 是加工结果。只有明确建档的工艺链才会产生加工单。 */
export function resolveDesignRevisionMaterialSku(targetSkuId: string, capturedAt = ''): DesignRevisionMaterialSkuSnapshot {
  const target = activeSku(targetSkuId)
  if (!target) throw new Error(`目标物料 SKU ${targetSkuId || '未选择'} 不存在或已停用。`)
  const archive = getMaterialArchiveById(target.materialId)
  if (!archive || archive.status !== 'ACTIVE') throw new Error(`${target.materialSkuCode} 所属物料已停用。`)
  if (!target.designRevisionProcesses) throw new Error(`${target.materialSkuCode} 尚未维护设计改款加工属性，不能作为目标 SKU。`)
  const processes = target.designRevisionProcesses || []
  const requiresPrint = processes.includes('PRINTING')
  // 设计改款按每条物料互斥：双工艺 SKU 由印花直接实现目标颜色。
  const requiresDye = !requiresPrint && processes.includes('DYEING')
  const raw = requiresDye || requiresPrint ? activeSku(target.designRevisionRawSkuId || '') : target
  if (!raw || raw.materialId !== target.materialId) throw new Error(`${target.materialSkuCode} 缺少同物料的首道仓库发料 SKU。`)
  const dyed = requiresDye ? target : null
  if (requiresDye && (!target.colorName?.trim() || !target.pantoneCode?.trim())) throw new Error(`${target.materialSkuCode} 缺少颜色或潘通色号。`)
  if (requiresPrint && (!target.patternCode?.trim() || !target.patternImageUrl?.trim())) throw new Error(`${target.materialSkuCode} 缺少花型编号或正式花型图片。`)
  if (!target.skuImageUrl?.trim() || !raw.skuImageUrl?.trim()) throw new Error(`${target.materialSkuCode} 缺少物料实图。`)
  if (!target.pricingUnit?.trim() || !raw.pricingUnit?.trim()) throw new Error(`${target.materialSkuCode} 缺少计量单位。`)
  return {
    targetSkuId: target.materialSkuId, targetSkuCode: target.materialSkuCode,
    materialId: target.materialId, materialName: archive.materialName,
    materialImageUrl: target.skuImageUrl, rawSkuId: raw.materialSkuId, rawSkuCode: raw.materialSkuCode,
    dyedSkuId: dyed?.materialSkuId || '', dyedSkuCode: dyed?.materialSkuCode || '',
    colorName: target.colorName || '', pantoneCode: target.pantoneCode || '',
    patternCode: target.patternCode || '', patternImageUrl: target.patternImageUrl || '',
    requiresDye, requiresPrint, pricingUnit: target.pricingUnit, capturedAt,
  }
}
