import { tmfReferenceMaterials, tmfReferenceSkus } from '../pcs-tmf-material-reference-seeds.ts'
import { getPmsMaterial } from './materials.ts'
import { getPmsSupplier } from './suppliers.ts'
import { getPmsWarehouse } from './warehouses.ts'

/**
 * TMF 主档映射：采购、端头采购与收货只认原型内建权威主档的稳定身份。
 * 显示名变化不改变 masterId；未登记对象阻断，不得按名称猜测或静默放行。
 */
export type TmfMasterKind = 'SUPPLIER' | 'MATERIAL_SKU' | 'TIP_MATERIAL' | 'RAW_MATERIAL' | 'WAREHOUSE'
export type TmfMasterSource = 'PMS供应商主档' | 'PMS仓库主档' | 'PMS物料主档' | '物料档案' | 'TMF原型规范主档'

export interface TmfMasterReference {
  masterId: string
  code: string
  name: string
  source: TmfMasterSource
}

export interface TmfMaterialMasterReference extends TmfMasterReference {
  kind: TmfMasterKind
  category: string
  unit?: string
}

/**
 * 原型内建规范主档：规范场景与演示使用的稳定身份。
 * 新物料必须先在物料档案登记；这里只登记规范数据合同内的既有对象，不作为正式主数据。
 */
const tmfPrototypeMaterials: Record<string, { name: string; category: string; unit: string }> = {
  'WB20-WHT': { name: '白色织带 20mm 半成品（原型规范）', category: '织带', unit: '米' },
  'WB30-WHT': { name: '白色织带 30mm 半成品（原型规范）', category: '织带', unit: '米' },
  'WB40-WHT': { name: '白色织带 40mm 半成品（原型规范）', category: '织带', unit: '米' },
  'WB30-CBL01': { name: '蓝色染色织带 30mm 半成品（原型规范）', category: '织带', unit: '米' },
  'WB30-CBL01-P001': { name: '蓝色印花织带 30mm 半成品 P001（原型规范）', category: '织带', unit: '米' },
  'CORD-WHT': { name: '白色绳子半成品（原型规范）', category: '绳子', unit: '米' },
  'CORD-BLK': { name: '黑色绳子半成品（原型规范）', category: '绳子', unit: '米' },
  'YARN-DEMO-01': { name: '演示基础原料纱线（原型规范）', category: '基础原料', unit: 'kg' },
  'HEAD-M01': { name: '金属头 M01（原型规范）', category: '端头辅材', unit: '个' },
  'HEAD-P01': { name: '塑料包头 P01（原型规范）', category: '端头辅材', unit: '个' },
  'SILICONE-M01': { name: '硅胶浸头材料 M01（原型规范）', category: '端头辅材', unit: 'kg' },
  'METAL-M4': { name: '金属头 M4（原型规范）', category: '端头辅材', unit: '个' },
  'PLASTIC-P4': { name: '塑料包头 P4（原型规范）', category: '端头辅材', unit: '个' },
  'SIL-BLACK': { name: '黑色硅胶浸头材料（原型规范）', category: '端头辅材', unit: 'kg' },
  'SILICONE-BLACK': { name: '黑色硅胶浸头材料（原型规范）', category: '端头辅材', unit: 'kg' },
}
const tmfPrototypeSuppliers: Record<string, string> = {
  'MOCK-SUP-TMF': 'Mock 织带供货方（原型规范）',
  'TMF-DEMO-SUPPLIER': '织带供货方（原型演示）',
}
const tmfPrototypeWarehouses: Record<string, { name: string; type: string }> = {
  'MOCK-ACC-WH': { name: 'Mock 辅料仓（原型规范）', type: '辅料仓' },
  'TMF-DEMO-ACCESSORY-WH': { name: '辅料仓（原型演示）', type: '辅料仓' },
}

function materialKind(category: string): TmfMasterKind {
  if (category === '端头辅材') return 'TIP_MATERIAL'
  if (category === '基础原料') return 'RAW_MATERIAL'
  return 'MATERIAL_SKU'
}

export function resolveTmfSupplierMaster(supplierId: string): TmfMasterReference | null {
  const id = supplierId?.trim()
  if (!id) return null
  const pms = getPmsSupplier(id)
  if (pms) return { masterId: pms.supplierCode, code: pms.supplierCode, name: pms.supplierName, source: 'PMS供应商主档' }
  const demo = tmfPrototypeSuppliers[id]
  return demo ? { masterId: id, code: id, name: demo, source: 'TMF原型规范主档' } : null
}

export function resolveTmfWarehouseMaster(warehouseId: string): (TmfMasterReference & { warehouseType?: string }) | null {
  const id = warehouseId?.trim()
  if (!id) return null
  const pms = getPmsWarehouse(id)
  if (pms) return { masterId: pms.warehouseCode, code: pms.warehouseCode, name: pms.warehouseName, source: 'PMS仓库主档', warehouseType: pms.warehouseType }
  const demo = tmfPrototypeWarehouses[id]
  return demo ? { masterId: id, code: id, name: demo.name, source: 'TMF原型规范主档', warehouseType: demo.type } : null
}

export function resolveTmfMaterialMaster(materialSkuId: string): TmfMaterialMasterReference | null {
  const id = materialSkuId?.trim()
  if (!id) return null
  // 物料档案的规范参考 SKU 直接取自档案种子；新增档案对象需同步登记，不能按名称猜测。
  const sku = tmfReferenceSkus.find((item) => item.materialSkuId === id)
  if (sku) {
    const archive = tmfReferenceMaterials.find((item) => item.materialId === sku.materialId)
    const category = archive?.categoryName || '未分类'
    return { masterId: sku.materialSkuId, code: sku.materialSkuCode || sku.materialSkuId, name: sku.materialName, source: '物料档案', kind: materialKind(category), category, unit: sku.pricingUnit || archive?.mainUnit }
  }
  const prototype = tmfPrototypeMaterials[id]
  if (prototype) return { masterId: id, code: id, name: prototype.name, source: 'TMF原型规范主档', kind: materialKind(prototype.category), category: prototype.category, unit: prototype.unit }
  const pms = getPmsMaterial(id)
  if (pms) return { masterId: pms.materialCode, code: pms.materialCode, name: pms.materialName, source: 'PMS物料主档', kind: pms.materialCategory === '辅料' ? 'MATERIAL_SKU' : 'RAW_MATERIAL', category: pms.materialCategory, unit: pms.baseUnit }
  return null
}

export interface TmfBasePurchaseMasters {
  supplier: TmfMasterReference
  material: TmfMaterialMasterReference
  warehouse: TmfMasterReference
}

/** 基础采购必须同时映射供应方、织带／绳子物料与目标仓；缺失或类型不符直接阻断。 */
export function assertTmfBasePurchaseMasters(input: { supplierId: string; materialSkuId: string; targetWarehouseId: string }): TmfBasePurchaseMasters {
  const supplier = resolveTmfSupplierMaster(input.supplierId)
  if (!supplier) throw new Error(`供应方「${input.supplierId || '未填写'}」未在供应商主档登记，不能接入 TMF 基础采购；请先补齐主档或选择已登记供应方。`)
  const material = resolveTmfMaterialMaster(input.materialSkuId)
  if (!material) throw new Error(`物料「${input.materialSkuId || '未填写'}」未在物料档案或原型规范主档登记；请先在物料档案维护织带／绳子半成品 SKU。`)
  if (material.category !== '织带' && material.category !== '绳子') throw new Error(`物料主档「${material.code}」属于 ${material.category}，不是织带／绳子半成品，不能作为基础采购来源。`)
  const warehouse = resolveTmfWarehouseMaster(input.targetWarehouseId)
  if (!warehouse) throw new Error(`目标仓「${input.targetWarehouseId || '未填写'}」未在仓库主档登记；请维护可接收织带／绳子半成品的辅料仓。`)
  if (warehouse.warehouseType && !['面辅料仓', '加工仓', '辅料仓'].includes(warehouse.warehouseType)) throw new Error(`目标仓「${warehouse.name}」类型为 ${warehouse.warehouseType}，不能接收织带／绳子半成品；请选择辅料仓。`)
  return { supplier, material, warehouse }
}

/** 端头辅材采购／实收必须映射到独立端头主档，不得借用织带／绳子半成品 SKU。 */
export function assertTmfTipMaterialMaster(materialSkuId: string, unit: string): TmfMaterialMasterReference {
  const reference = resolveTmfMaterialMaster(materialSkuId)
  if (!reference) throw new Error(`端头辅材「${materialSkuId || '未填写'}」未在物料档案或端头辅材主档登记；请先补齐主档后重试。`)
  if (reference.category === '织带' || reference.category === '绳子') throw new Error(`端头辅材不能引用织带／绳子半成品主档「${reference.code}」；请核对技术包辅材并登记独立端头主档。`)
  if (!['个', 'kg', 'g'].includes(unit)) throw new Error('端头辅材计量单位必须为个或重量单位（kg／g）。')
  if (reference.unit && reference.unit !== unit) throw new Error(`端头辅材主档单位（${reference.unit}）与采购单位（${unit}）不一致；请核对主档或技术包。`)
  return reference
}

/** 投入料（基础原料）实收必须映射到物料主档；不能凭名称或数量直接入账。 */
export function assertTmfRawMaterialMaster(materialCode: string): TmfMaterialMasterReference {
  const reference = resolveTmfMaterialMaster(materialCode)
  if (!reference) throw new Error(`投入料「${materialCode || '未填写'}」未在物料主档登记；请先补齐主档后再实收。`)
  return reference
}
