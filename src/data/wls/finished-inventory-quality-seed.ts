import { listSkuArchives } from '../pcs-sku-archive-repository.ts'
import { KOL_GOTO_FACTORY_ID, GOTO_GLOBAL_FACTORY_NAME } from '../fcs/factory-mock-data.ts'
import { warehouseSeed } from './seed/shared-seed.ts'
import type { FinishedInventoryState, FinishedInventoryLot } from './finished-inventory-quality-types.ts'
import inventoryMock from './finished-inventory-quality-mock.json' with {type:'json'}

export const FINISHED_INVENTORY_SEED_VERSION = '2026-10-23-quality-v2'
// 取正式静态仓库ID，不以“成衣仓”/F&M等相似名称猜测合并。
const original = (() => { const value = warehouseSeed.find(row => row.businessType === 'FINISHED'); if (!value) throw new Error('成衣仓静态身份缺失，不能建立库存演示。'); return value })()
export const FINISHED_INVENTORY_NORMAL_WAREHOUSE = { id: original.code, name: original.name }
export const FINISHED_INVENTORY_DEFECT_WAREHOUSE = { id: 'WH-FINISHED-DEFECT-001', name: '独立瑕疵品仓' }
export const FINISHED_INVENTORY_REWORK_FACTORY = { id: KOL_GOTO_FACTORY_ID, name: GOTO_GLOBAL_FACTORY_NAME }
export const FINISHED_INVENTORY_POST_FACTORY = { id: 'ID-F002', name: '后道工厂' }
const normalLocations = original.zones.flatMap(zone => zone.locations.map(locationCode => ({ warehouseId: original.code, zoneName: zone.name, locationCode }))).filter(row => row.zoneName === 'A区').slice(0, 3)
export const FINISHED_INVENTORY_LOCATIONS = [
  ...normalLocations,
  { warehouseId: FINISHED_INVENTORY_DEFECT_WAREHOUSE.id, zoneName: '瑕疵品区', locationCode: 'DEF-A-01' },
  { warehouseId: FINISHED_INVENTORY_DEFECT_WAREHOUSE.id, zoneName: '瑕疵品区', locationCode: 'DEF-A-02' },
] as const

// 正式档案中已审核颜色实拍的固定样本。只读取静态身份，不生成或修改PCS资料。
const inventorySkus = listSkuArchives().filter(sku => sku.styleId === 'style_r1_wms_tee'
  || ['STYLE-PRJ-202603-007', 'STYLE-PRJ-202603-008', 'STYLE-PRJ-202603-009'].includes(sku.styleCode))
  .filter(sku => sku.skuImageUrl.startsWith('/materials/pcs-reviewed/') && sku.deliveryMode !== 'VIRTUAL_BUNDLE')

/** 新的明确演示基线，库位数量是本版本声明的样本，不是对旧用户资料随机分摊。 */
export function createFinishedInventoryBaseSeed(): FinishedInventoryState {
  const counts = new Map<string, number>()
  inventorySkus.forEach(sku => counts.set(sku.styleId, (counts.get(sku.styleId) || 0) + 1))
  const seen = new Map<string, number>()
  const lots: FinishedInventoryLot[] = inventorySkus.flatMap(sku => {
    const count = counts.get(sku.styleId)!, index = seen.get(sku.styleId) || 0
    seen.set(sku.styleId, index + 1)
    const quantity = Math.floor(100 / count) + (index < 100 % count ? 1 : 0)
    return [0, 1].map(bin => ({
    id: `FI-LOT-${sku.skuId}-${bin}`, warehouseId: original.code, warehouseName: original.name,
    styleId: sku.styleId, styleNo: sku.styleCode, styleName: sku.styleName,
    skuId: sku.skuId, skuCode: sku.skuCode, colorName: sku.colorName, sizeName: sku.sizeName,
    imageUrl: sku.skuImageUrl, barcode: sku.barcode, zoneName: normalLocations[bin]!.zoneName, locationCode: normalLocations[bin]!.locationCode,
    quality: '正常' as const, putaway: true, quantity: bin ? Math.floor(quantity / 2) : Math.ceil(quantity / 2), updatedAt: '2026-10-22T09:00:00+07:00',
    sourceRef: `STATIC:${FINISHED_INVENTORY_SEED_VERSION}`, identityVerified: true,
  })) })
  const first = lots[0]!
  // 同一订单行在三个阶段的投影保留；排除计算按身份取当前最大量而不是相加。
  const exclusions = (['订单占用', '已拣货', '待出库'] as const).map((stage, i) => ({ id: `FI-EXCLUDE-001-${i}`, orderLineId: 'FI-DEMO-ORDER-LINE-001',
    warehouseId: original.code, skuId: first.skuId, quantity: 20, stage, active: true, sourceRef: 'STATIC:FI-DEMO-ORDER-LINE-001' }))
  lots.push({ ...first, id: 'FI-LOT-EXISTING-DEFECT', quality: '瑕疵', quantity: 3, locationCode: normalLocations[0]!.locationCode })
  lots.push({ ...first, id: 'FI-LOT-EXISTING-DAMAGE', quality: '破损', quantity: 2, locationCode: normalLocations[0]!.locationCode })
  return { lots, exclusions, applications: [], transfers: [], movements: [], differences: [], scopes: [] }
}

/** Fixed examples are read in memory. Only later business changes are persisted. */
export function createFinishedInventorySeed(): FinishedInventoryState {
  const seed=createFinishedInventoryBaseSeed()
  const examples=structuredClone(inventoryMock.inventory) as unknown as FinishedInventoryState
  // A completed cycle can consume an original bin. Its current balance replaces
  // that bin's baseline instead of appending a second copy of the same stock.
  seed.lots=[...new Map([...seed.lots,...examples.lots].map(lot=>[lot.id,lot])).values()]
  for(const key of ['exclusions','applications','transfers','movements','differences','scopes'] as const)(seed[key] as unknown[]).push(...examples[key])
  return seed
}
