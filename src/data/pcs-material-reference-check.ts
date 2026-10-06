import type { MaterialSkuRecord } from './pcs-material-archive-types.ts'
import { canonicalMaterialUnit } from './pcs-material-rules.ts'

type MaterialUnitIdentity = Pick<MaterialSkuRecord, 'materialSkuId' | 'mainUnit' | 'pricingUnit' | 'mainUnitUsed' | 'approvalStatus'>
type PurchaseReferenceReader = (materialSkuId: string) => Promise<boolean>

async function readPurchaseReference(materialSkuId: string): Promise<boolean> {
  const { hasMaterialPurchaseReference } = await import('./pms/material-purchase-references.ts')
  return hasMaterialPurchaseReference(materialSkuId)
}

/** Preflight before a PCS write; PMS remains a separate, read-only source here. */
export async function assertMaterialMainUnitChangeAllowed(
  sku: MaterialUnitIdentity,
  requestedUnit: string | undefined,
  hasPurchaseReference: PurchaseReferenceReader = readPurchaseReference,
): Promise<void> {
  if (requestedUnit === undefined) return
  if (!requestedUnit.trim()) throw new Error('主计量单位不能为空。')
  if (canonicalMaterialUnit(requestedUnit) === canonicalMaterialUnit(sku.mainUnit || sku.pricingUnit)) return
  if (sku.mainUnitUsed || sku.approvalStatus === 'APPROVED') throw new Error('该 SKU 已审核或已使用，主计量单位不能修改。')

  let referenced: boolean
  try {
    referenced = await hasPurchaseReference(sku.materialSkuId)
  } catch {
    throw new Error('暂时无法核对采购记录，主计量单位未修改。请稍后重试。')
  }
  if (referenced) throw new Error('该 SKU 已被采购草稿或采购记录引用，主计量单位不能修改。历史采购数量继续使用原单位。')
}
