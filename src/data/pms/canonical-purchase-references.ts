import { getMaterialArchiveByCode, getMaterialArchiveById, listAllMaterialSkuRecords, resolveMaterialSkuIdentity } from '../pcs-material-archive-repository.ts'
import { listSkuArchives } from '../pcs-sku-archive-repository.ts'
import { getCurrentTechPackVersionByStyleId, getTechnicalDataVersionContentById, listTechnicalDataVersions } from '../pcs-technical-data-version-repository.ts'
import { warehouseSeed } from '../wls/seed/shared-seed.ts'

/** Read only the catalog collections procurement actually consumes. */
export async function ensurePurchaseCatalogState(): Promise<void> {
  const { ensurePcsRecordState } = await import('../pcs-record-runtime.ts')
  await ensurePcsRecordState([
    'higood-pcs-style-archive-store-v3', 'higood-pcs-sku-archive-store-v1',
    'higood-pcs-material-archive-store-v2', 'higood-pcs-material-config-v1',
    'higood-pcs-config-workspace-store-v1', 'higood-pcs-technical-data-version-store-v5',
  ])
}

/** Procurement reads existing catalog identities; this module owns no master records or writes. */
export type PurchaseRegion = '国内' | '印尼'
export interface PurchaseMaterialReference {
  materialSpu?: string
  materialId?: string
  materialSkuId?: string
  colorName?: string
  specName?: string
  materialCode: string
  materialName: string
  imageUrl: string
  category: string
  unit: string
  referencePrice: number
  active: boolean
}

export function listPurchaseMaterialReferences(): PurchaseMaterialReference[] {
  return listAllMaterialSkuRecords().map(sku => {
    const archive = getMaterialArchiveById(sku.materialId)
    return { materialSpu: archive?.materialCode || '', materialId: sku.materialId, materialSkuId: sku.materialSkuId, colorName: sku.colorName, specName: sku.specName, materialCode: sku.materialSkuCode, materialName: [sku.materialName, sku.colorName, sku.sizeName].filter(Boolean).join(' · '), imageUrl: sku.skuImageUrl || archive?.mainImageUrl || '', category: archive?.kind === 'fabric' ? '面料' : archive?.kind === 'yarn' ? '纱线' : '辅料', unit: sku.mainUnit || archive?.mainUnit || sku.pricingUnit, referencePrice: sku.costPrice, active: sku.status === 'ACTIVE' }
  })
}

export function getPurchaseMaterialReference(identity: string): PurchaseMaterialReference | undefined {
  const sku = resolveMaterialSkuIdentity(identity)
  if (sku) {
    const archive = getMaterialArchiveById(sku.materialId)
    return { materialSpu: archive?.materialCode || '', materialId: sku.materialId, materialSkuId: sku.materialSkuId, colorName: sku.colorName, specName: sku.specName, materialCode: sku.materialSkuCode, materialName: [sku.materialName, sku.colorName, sku.sizeName].filter(Boolean).join(' · '), imageUrl: sku.skuImageUrl || archive?.mainImageUrl || '', category: archive?.kind === 'fabric' ? '面料' : archive?.kind === 'yarn' ? '纱线' : '辅料', unit: sku.mainUnit || archive?.mainUnit || sku.pricingUnit, referencePrice: sku.costPrice, active: sku.status === 'ACTIVE' }
  }
  const archive = getMaterialArchiveByCode(identity)
  if (!archive) return undefined
  return { materialSpu: archive.materialCode, materialId: archive.materialId, materialCode: archive.materialCode, materialName: archive.materialName, imageUrl: archive.mainImageUrl, category: archive.kind === 'fabric' ? '面料' : archive.kind === 'yarn' ? '纱线' : '辅料', unit: archive.mainUnit, referencePrice: 0, active: archive.status === 'ACTIVE' }
}

export function listPurchaseGoodsReferences(): PurchaseMaterialReference[] {
  return [...listPurchaseMaterialReferences(), ...listSkuArchives().map(sku => ({ materialSpu: sku.styleCode, materialSkuId: sku.skuId, materialCode: sku.skuCode, materialName: sku.skuName, imageUrl: sku.skuImageUrl, category: '成衣', unit: sku.pricingUnit || '件', referencePrice: sku.costPrice, active: sku.archiveStatus === 'ACTIVE' }))]
}
export function getPurchaseGoodsReference(identity: string): PurchaseMaterialReference | undefined {
  return getPurchaseMaterialReference(identity) || listPurchaseGoodsReferences().find(item => item.materialCode === identity)
}

export function listPurchaseWarehouses() {
  return warehouseSeed.filter(item => item.enabled).map(item => ({ code: item.code, name: item.name, businessType: item.businessType }))
}

export function getPurchaseStyleImage(spu: string): string {
  return listSkuArchives().find(sku => sku.styleCode === spu)?.skuImageUrl || ''
}

export interface PurchaseRequirementMaterial {
  materialCode: string
  materialName: string
  materialType: string
  imageUrl: string
  unit: string
  usagePerPiece: number
  lossRate: number
  applicableSkuCodes?: string[]
  stockQty: number
  purchasingQty: number
  supplierName: string
  warehouse: string
}

/** Only the current published PCS version can supply a new procurement requirement. */
export function getPublishedPurchaseMaterials(spu: string) {
  const styleId = listSkuArchives().find(sku => sku.styleCode === spu)?.styleId
    || listTechnicalDataVersions().find(version => version.styleCode === spu)?.styleId
  if (!styleId) return undefined
  const version = getCurrentTechPackVersionByStyleId(styleId)
  if (!version || version.versionStatus !== 'PUBLISHED') return undefined
  const content = getTechnicalDataVersionContentById(version.technicalVersionId)
  const items = content?.bomPricingSnapshot?.bomItems || content?.bomItems || []
  if (!items.length || items.some(item => !item.materialSkuId || !getPurchaseMaterialReference(item.materialSkuId))) return undefined
  const materials: PurchaseRequirementMaterial[] = items.map(item => {
    const reference = getPurchaseMaterialReference(item.materialSkuId!)!
    return { materialCode: reference.materialCode, materialName: reference.materialName, materialType: reference.category, imageUrl: reference.imageUrl, unit: item.unit || reference.unit, usagePerPiece: item.unitConsumption, lossRate: item.lossRate, applicableSkuCodes: item.applicableSkuCodes, stockQty: 0, purchasingQty: 0, supplierName: item.supplier, warehouse: '' }
  })
  return { styleCode: version.styleCode, productName: version.styleName, imageUrl: getPurchaseStyleImage(spu), version: version.versionLabel, status: '已发布' as const, materials }
}
