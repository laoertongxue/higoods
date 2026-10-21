import { ACCESSORY_WAREHOUSE_DEMOS } from './accessory-warehouse-demo.ts'
import { ACCESSORY_GTP_WAREHOUSE, type AccessoryPreparation } from './accessory-warehouse-flow.ts'
import { getAccessoryStockAvailable, getAccessoryStockId, type AccessoryStock } from './accessory-warehouse-stock.ts'
import { listAccessoryWarehouseLocations } from './accessory-warehouse-master.ts'

/** 本地演示盘点底稿版本；不代表线上或现场盘点结果，不随生产需求量增减。 */
export const ACCESSORY_STOCK_SOURCE_VERSION = 'AW-STOCK-DEMO-20261019-V1'

export interface AccessoryStockIdentity {
  warehouseCode: string
  locationId: string
  materialSku: string
  unit: string
}

export interface AccessoryStockMaterialMetadata {
  materialName: string
  imageUrl: string
  color: string
  spec: string
}

interface FixedStockCatalogueRow {
  materialSku: string
  unit: string
  locationCode: string
  onHandQty: number
}

// 明确白名单而非扫描订单生成库存；同 SKU 被几个生产单引用都只有这一笔实物余额。
// 原配料 availableStockQty 是逐单演示比例，不是此底稿的数据来源。
const normalTemplateSpus = [
  'tdv_demand_SPU_2024_004', 'tdv_demand_SPU_2024_005', 'tdv_demand_SPU_2024_010',
  'tdv_demand_SPU_2024_012', 'tdv_demand_SPU_2024_013', 'tdv_demand_SPU_2024_014',
  'tdv_demand_SPU_2024_022', 'tdv_demand_SPU_2024_023', 'tdv_demand_SPU_2024_032',
  'tdv_demand_SPU_2024_033',
] as const
const zeroTemplateSpus = ['tdv_demand_SPU_2024_021', 'tdv_demand_SPU_2024_024', 'tdv_demand_SPU_2024_031'] as const
const templateBalances = [
  { code: 'accessory-zipper', unit: '条', onHandQty: 2400 },
  { code: 'accessory-button', unit: '粒', onHandQty: 9600 },
  { code: 'accessory-label', unit: '套', onHandQty: 2400 },
  { code: 'yarn-stitching', unit: '公斤', onHandQty: 120 },
] as const
const catalogue: readonly FixedStockCatalogueRow[] = [
  ...normalTemplateSpus.flatMap(spu => templateBalances.map(row => ({
    materialSku: `${spu}-bom-${row.code}`, unit: row.unit, locationCode: 'GTP-A-01', onHandQty: row.onHandQty,
  }))),
  ...zeroTemplateSpus.flatMap(spu => templateBalances.map(row => ({
    materialSku: `${spu}-bom-${row.code}`, unit: row.unit, locationCode: 'GTP-A-01', onHandQty: 0,
  }))),
  { materialSku: 'tdv_demand_SPU_2024_005-bom-accessory-main-label', unit: '套', locationCode: 'GTP-A-01', onHandQty: 2400 },
  { materialSku: 'tdv_demand_SPU_2024_005-bom-accessory-care-label', unit: '套', locationCode: 'GTP-A-01', onHandQty: 2400 },
  { materialSku: 'HG-DEMO-ZIPPER-GRY-60', unit: 'PCS', locationCode: 'GTP-A-01', onHandQty: 1600 },
  { materialSku: 'HG-DEMO-RIB-GRY', unit: '米', locationCode: 'GTP-A-02', onHandQty: 500 },
  { materialSku: 'ACC-ELASTIC-42CM', unit: '米', locationCode: 'GTP-A-02', onHandQty: 600 },
  { materialSku: 'LABEL-SPU-2024-011-CARE', unit: '件', locationCode: 'GTP-A-03', onHandQty: 1600 },
  // 辅料流转 F01/F02/F03 共用 SKU 和余额；固定 600，不是每单 100 另起一份。
  { materialSku: 'AW-DEMO-ZIPPER', unit: '条', locationCode: 'GTP-A-01', onHandQty: 600 },
  { materialSku: 'AW-DEMO-BUTTON', unit: '粒', locationCode: 'GTP-A-02', onHandQty: 1200 },
  { materialSku: 'AW-DEMO-PRICE-TAG', unit: '张', locationCode: 'GTP-A-03', onHandQty: 600 },
  { materialSku: 'AW-DEMO-BRAND-TAG', unit: '张', locationCode: 'GTP-B-01', onHandQty: 600 },
  { materialSku: 'AW-DEMO-TAG-FASTENER', unit: '条', locationCode: 'GTP-B-02', onHandQty: 600 },
  { materialSku: 'AW-DEMO-SEWING-THREAD', unit: '公斤', locationCode: 'GTP-B-03', onHandQty: 12 },
  { materialSku: 'AW-DEMO-ZERO-STOCK', unit: '条', locationCode: 'GTP-A-01', onHandQty: 0 },
]

const templateMetadata: Readonly<Record<(typeof templateBalances)[number]['code'], AccessoryStockMaterialMetadata>> = {
  'accessory-zipper': { materialName: '拉链', imageUrl: '/materials/accessory-zipper.jpg', color: '金属色', spec: '金属拉链（实拍参考）' },
  'accessory-button': { materialName: '纽扣', imageUrl: '/materials/accessory-button.jpg', color: '多色', spec: '服装纽扣（实拍参考）' },
  'accessory-label': { materialName: '主唛/洗护唛', imageUrl: '/materials/accessory-label.jpg', color: '白底黑字', spec: '服装洗护唛（实拍参考）' },
  'yarn-stitching': { materialName: '缝纫线', imageUrl: '/materials/yarn-stitching.jpg', color: '黑色', spec: '车缝线（实拍参考）' },
}
const materialMetadata = new Map<string, AccessoryStockMaterialMetadata>([
  ...[...normalTemplateSpus, ...zeroTemplateSpus].flatMap(spu => templateBalances.map(row =>
    [`${spu}-bom-${row.code}`, templateMetadata[row.code]] as [string, AccessoryStockMaterialMetadata])),
  ['tdv_demand_SPU_2024_005-bom-accessory-main-label', templateMetadata['accessory-label']],
  ['tdv_demand_SPU_2024_005-bom-accessory-care-label', { ...templateMetadata['accessory-label'], materialName: '洗护唛' }],
  ['HG-DEMO-ZIPPER-GRY-60', { materialName: '雾灰色开尾拉链', imageUrl: '/production-confirmation-demo/fog-grey-open-end-zipper.png', color: '雾灰', spec: '60cm 开尾拉链' }],
  ['HG-DEMO-RIB-GRY', { materialName: '雾灰色罗纹', imageUrl: '/production-confirmation-demo/fog-grey-rib-knit.png', color: '雾灰', spec: '罗纹布' }],
  ['ACC-ELASTIC-42CM', { materialName: '松紧带', imageUrl: '/materials/accessory-elastic-band.jpg', color: '白色', spec: '42cm 松紧带（实拍参考）' }],
  ['LABEL-SPU-2024-011-CARE', { ...templateMetadata['accessory-label'], materialName: '洗护唛' }],
  ['AW-DEMO-ZIPPER', templateMetadata['accessory-zipper']],
  ['AW-DEMO-BUTTON', templateMetadata['accessory-button']],
  ['AW-DEMO-PRICE-TAG', { materialName: '价格吊牌', imageUrl: '/materials/accessory-flow/price-tag.jpg', color: '白色', spec: '纸质价格吊牌（实拍参考）' }],
  ['AW-DEMO-BRAND-TAG', { materialName: '品牌吊牌', imageUrl: '/materials/accessory-flow/brand-tag.jpg', color: '多色', spec: '纸质品牌吊牌（实拍参考）' }],
  ['AW-DEMO-TAG-FASTENER', { materialName: '吊粒', imageUrl: '/materials/accessory-flow/tag-fastener.png', color: '黑色', spec: '棉绳塑料锁扣（演示物料效果图）' }],
  ['AW-DEMO-SEWING-THREAD', { ...templateMetadata['yarn-stitching'], materialName: '车缝线' }],
  ['AW-DEMO-ZERO-STOCK', { ...templateMetadata['accessory-zipper'], materialName: '缺货演示拉链' }],
])

/** 与固定库存 SKU 目录同源的只读识别资料；未知 SKU 返回 null，不借无关图补位。 */
export function getAccessoryStockMaterialMetadata(materialSku: string): AccessoryStockMaterialMetadata | null {
  const bom = ACCESSORY_WAREHOUSE_DEMOS.flatMap(fixture => fixture.techPack.bomItems).find(row => row.materialCode === materialSku)
  const metadata = materialMetadata.get(materialSku) || (bom ? { materialName: bom.name, imageUrl: bom.materialImageUrl || '', color: bom.colorLabel || '', spec: bom.spec } : null)
  return metadata ? { ...metadata } : null
}

function cloneStock(stock: AccessoryStock): AccessoryStock { return structuredClone(stock) }

/** 只读静态底稿，普通访问不落 IndexedDB；旧 ACC-/YRN- 库位不会自动映射。 */
export function listAccessoryStaticStockSources(): AccessoryStock[] {
  const locations = new Map(listAccessoryWarehouseLocations(ACCESSORY_GTP_WAREHOUSE).map(location => [location.locationCode, location]))
  return catalogue.map(row => {
    const location = locations.get(row.locationCode)
    if (!location?.enabled) throw new Error(`演示库存底稿的库位 ${row.locationCode} 未启用。`)
    return {
      id: getAccessoryStockId(ACCESSORY_GTP_WAREHOUSE, location.id, row.materialSku, row.unit),
      warehouseCode: ACCESSORY_GTP_WAREHOUSE, locationId: location.id, materialSku: row.materialSku,
      unit: row.unit, onHandQty: row.onHandQty, reservedQty: 0, version: 0, sourceRefs: [],
    }
  })
}

/** 已保存事实按物理身份完整覆盖静态底稿，包括 0 余额；绝不与种子相加。 */
export function listAccessoryStockSources(savedStocks: readonly AccessoryStock[] = []): AccessoryStock[] {
  const sources = new Map(listAccessoryStaticStockSources().map(stock => [stock.id, stock]))
  const savedIds = new Set<string>()
  for (const stock of savedStocks) {
    if (savedIds.has(stock.id)) throw new Error('同一物理库存存在重复保存记录，需重新核对。')
    savedIds.add(stock.id)
    // 复用库存契约核验身份、余额、预留归属与版本，损坏记录不能回退到演示余额。
    getAccessoryStockAvailable(stock)
    sources.set(stock.id, cloneStock(stock))
  }
  return [...sources.values()].map(cloneStock)
}

export function readAccessoryStockSource(identity: AccessoryStockIdentity, savedStocks: readonly AccessoryStock[] = []): AccessoryStock | null {
  const id = getAccessoryStockId(identity.warehouseCode, identity.locationId, identity.materialSku, identity.unit)
  return listAccessoryStockSources(savedStocks).find(stock => stock.id === id) ?? null
}

/**
 * 仅投影可用余额，不给订单复制库存。未选库位时显示同仓同 SKU 同单位的可用合计；
 * 选位后显示该位置余额。保存仍须用 reserveAccessoryPreparationStock 聚合校验并原子保存。
 * 历史 line.locationId / allocations / preparedQty 保留，不据此虚构预留归属。
 */
export function projectAccessoryPreparationAvailability(
  preparation: AccessoryPreparation,
  stocks: readonly AccessoryStock[],
  options: { locationByLine?: Readonly<Record<string, string>> } = {},
): AccessoryPreparation {
  const unique = new Set<string>()
  for (const stock of stocks) {
    if (unique.has(stock.id)) throw new Error('库存投影不能重复累计同一物理库存。')
    unique.add(stock.id)
    getAccessoryStockAvailable(stock)
  }
  return {
    ...structuredClone(preparation),
    lines: preparation.lines.map(line => {
      const selected = options.locationByLine?.[line.id]
      const available = stocks.filter(stock => stock.warehouseCode === ACCESSORY_GTP_WAREHOUSE
        && stock.materialSku === line.materialSku && stock.unit === line.unit
        && (!selected || stock.locationId === selected))
        .reduce((sum, stock) => sum + getAccessoryStockAvailable(stock), 0)
      return { ...structuredClone(line), availableQty: Math.round(available * 1_000_000) / 1_000_000 }
    }),
  }
}
