export type FabricDemandBoardMaterialType = '直裁面料' | '印花面料' | '染色面料'

export type FabricDemandBoardWarehouseName =
  | '中央仓面料仓'
  | '中转仓'
  | '印花厂待加工仓'
  | '染色厂待加工仓'

export type FabricDemandBoardAlertType =
  | '缺直裁面料'
  | '缺印花原料'
  | '缺染色原料'
  | '直裁待调拨'
  | '印花待调拨'
  | '染色待调拨'

export interface FabricDemandBoardWarehouseStock {
  warehouseName: FabricDemandBoardWarehouseName
  areaName: string
  locationCode: string
  qty: number
  unit: '米'
}

export interface FabricDemandBoardProcessQty {
  waitPickupQty: number
  processingQty: number
  waitInboundQty: number
}

export interface FabricDemandBoardPurchaseQty {
  purchasingQty: number
  transitQty: number
  waitInboundQty: number
}

export interface FabricDemandBoardAlert {
  type: FabricDemandBoardAlertType
  reasonText: string
  resolveText: string
  gapQty: number
  ownerText: string
}

export interface FabricDemandBoardAlertRule {
  type: FabricDemandBoardAlertType
  triggerText: string
  resolveText: string
}

export interface FabricDemandBoardRow {
  id: string
  materialImageUrl: string
  materialName: string
  materialSpu: string
  materialSku: string
  materialType: FabricDemandBoardMaterialType
  requiresPrint: boolean
  requiresDye: boolean
  demandQty: number
  rawMaterialName: string
  rawMaterialSku: string
  rawMaterialDemandQty: number
  warehouseStocks: FabricDemandBoardWarehouseStock[]
  printQty: FabricDemandBoardProcessQty
  dyeQty: FabricDemandBoardProcessQty
  purchaseQty: FabricDemandBoardPurchaseQty
  alerts: FabricDemandBoardAlert[]
}

export interface FabricDemandBoardFilters {
  keyword: string
  materialType: '全部' | FabricDemandBoardMaterialType
  printRequirement: '全部' | '需印花' | '不需印花'
  dyeRequirement: '全部' | '需染色' | '不需染色'
  alertType: '全部' | FabricDemandBoardAlertType
  warehouseName: '全部' | FabricDemandBoardWarehouseName
}

export interface FabricDemandBoardSummary {
  totalSkuCount: number
  printOrDyeSkuCount: number
  directCutSkuCount: number
  printingQty: number
  dyeingQty: number
  cuttingQty: number
  purchasingQty: number
  stockQty: number
}

export const defaultFabricDemandBoardFilters: FabricDemandBoardFilters = {
  keyword: '',
  materialType: '全部',
  printRequirement: '全部',
  dyeRequirement: '全部',
  alertType: '全部',
  warehouseName: '全部',
}

function stock(
  warehouseName: FabricDemandBoardWarehouseName,
  qty: number,
  locationCode: string,
): FabricDemandBoardWarehouseStock {
  const areaName = warehouseName === '中央仓面料仓' ? 'A区' : warehouseName === '中转仓' ? 'B区' : '待加工区'
  return { warehouseName, areaName, locationCode, qty, unit: '米' }
}

function alert(
  type: FabricDemandBoardAlertType,
  gapQty: number,
  reasonText: string,
  resolveText: string,
  ownerText: string,
): FabricDemandBoardAlert {
  return { type, gapQty, reasonText, resolveText, ownerText }
}

const fabricDemandBoardRows: FabricDemandBoardRow[] = [
  {
    id: 'fabric-demand-001',
    materialImageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=120&q=80',
    materialName: '黑色斜纹直裁主面料',
    materialSpu: 'FAB-SPU-1008',
    materialSku: 'FAB-2026-001-BLK',
    materialType: '直裁面料',
    requiresPrint: false,
    requiresDye: false,
    demandQty: 620,
    rawMaterialName: '',
    rawMaterialSku: '',
    rawMaterialDemandQty: 0,
    warehouseStocks: [stock('中央仓面料仓', 420, 'A-03-02'), stock('中转仓', 80, 'B-01-08')],
    printQty: { waitPickupQty: 0, processingQty: 0, waitInboundQty: 0 },
    dyeQty: { waitPickupQty: 0, processingQty: 0, waitInboundQty: 0 },
    purchaseQty: { purchasingQty: 180, transitQty: 0, waitInboundQty: 0 },
    alerts: [
      alert(
        '直裁待调拨',
        540,
        '触发：中转仓仅 80 米，未覆盖直裁需求 620 米；中央仓面料仓有 420 米可调拨。',
        '解除：中转仓库存达到 620 米。',
        '仓储主管',
      ),
    ],
  },
  {
    id: 'fabric-demand-002',
    materialImageUrl: 'https://images.unsplash.com/photo-1584273143981-41c073dfe8f8?auto=format&fit=crop&w=120&q=80',
    materialName: '花型印花针织布',
    materialSpu: 'FAB-SPU-2031',
    materialSku: 'FAB-2026-031-PRT',
    materialType: '印花面料',
    requiresPrint: true,
    requiresDye: false,
    demandQty: 540,
    rawMaterialName: '白坯针织布',
    rawMaterialSku: 'RAW-FAB-2026-031-WHT',
    rawMaterialDemandQty: 540,
    warehouseStocks: [stock('中央仓面料仓', 360, 'A-08-06'), stock('印花厂待加工仓', 120, 'P-02-04')],
    printQty: { waitPickupQty: 420, processingQty: 260, waitInboundQty: 60 },
    dyeQty: { waitPickupQty: 0, processingQty: 0, waitInboundQty: 0 },
    purchaseQty: { purchasingQty: 0, transitQty: 0, waitInboundQty: 0 },
    alerts: [
      alert(
        '印花待调拨',
        420,
        '触发：印花厂待加工仓仅 120 米，未覆盖印花需求 540 米；中央仓面料仓有 360 米可调拨。',
        '解除：印花厂待加工仓原料库存达到 540 米。',
        '印花仓管',
      ),
    ],
  },
  {
    id: 'fabric-demand-003',
    materialImageUrl: 'https://images.unsplash.com/photo-1534639077088-d702bcf685e1?auto=format&fit=crop&w=120&q=80',
    materialName: '雾蓝染色梭织布',
    materialSpu: 'FAB-SPU-3086',
    materialSku: 'FAB-2026-086-DYE',
    materialType: '染色面料',
    requiresPrint: false,
    requiresDye: true,
    demandQty: 720,
    rawMaterialName: '本白梭织坯布',
    rawMaterialSku: 'RAW-FAB-2026-086-WHT',
    rawMaterialDemandQty: 720,
    warehouseStocks: [stock('中央仓面料仓', 500, 'A-11-01'), stock('染色厂待加工仓', 160, 'D-03-02')],
    printQty: { waitPickupQty: 0, processingQty: 0, waitInboundQty: 0 },
    dyeQty: { waitPickupQty: 560, processingQty: 210, waitInboundQty: 70 },
    purchaseQty: { purchasingQty: 0, transitQty: 0, waitInboundQty: 0 },
    alerts: [
      alert(
        '染色待调拨',
        560,
        '触发：染色厂待加工仓仅 160 米，未覆盖染色需求 720 米；中央仓面料仓有 500 米可调拨。',
        '解除：染色厂待加工仓原料库存达到 720 米。',
        '染色仓管',
      ),
    ],
  },
  {
    id: 'fabric-demand-004',
    materialImageUrl: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=120&q=80',
    materialName: '米白直裁里布',
    materialSpu: 'FAB-SPU-4012',
    materialSku: 'FAB-2026-112-LIN',
    materialType: '直裁面料',
    requiresPrint: false,
    requiresDye: false,
    demandQty: 460,
    rawMaterialName: '',
    rawMaterialSku: '',
    rawMaterialDemandQty: 0,
    warehouseStocks: [stock('中央仓面料仓', 120, 'A-02-09'), stock('中转仓', 80, 'B-04-02')],
    printQty: { waitPickupQty: 0, processingQty: 0, waitInboundQty: 0 },
    dyeQty: { waitPickupQty: 0, processingQty: 0, waitInboundQty: 0 },
    purchaseQty: { purchasingQty: 260, transitQty: 80, waitInboundQty: 0 },
    alerts: [
      alert(
        '缺直裁面料',
        260,
        '触发：中央仓面料仓 120 米 + 中转仓 80 米，合计小于直裁需求 460 米。',
        '解除：中央仓面料仓 + 中转仓库存达到 460 米。',
        '采购跟单',
      ),
    ],
  },
  {
    id: 'fabric-demand-005',
    materialImageUrl: 'https://images.unsplash.com/photo-1603912699214-92627f304eb6?auto=format&fit=crop&w=120&q=80',
    materialName: '渐变印花雪纺',
    materialSpu: 'FAB-SPU-5099',
    materialSku: 'FAB-2026-099-PRT',
    materialType: '印花面料',
    requiresPrint: true,
    requiresDye: false,
    demandQty: 680,
    rawMaterialName: '本白雪纺坯布',
    rawMaterialSku: 'RAW-FAB-2026-099-WHT',
    rawMaterialDemandQty: 680,
    warehouseStocks: [stock('中央仓面料仓', 180, 'A-07-03'), stock('印花厂待加工仓', 90, 'P-01-07')],
    printQty: { waitPickupQty: 590, processingQty: 120, waitInboundQty: 0 },
    dyeQty: { waitPickupQty: 0, processingQty: 0, waitInboundQty: 0 },
    purchaseQty: { purchasingQty: 410, transitQty: 0, waitInboundQty: 60 },
    alerts: [
      alert(
        '缺印花原料',
        410,
        '触发：中央仓面料仓 180 米 + 印花厂待加工仓 90 米，合计小于印花需求 680 米。',
        '解除：中央仓面料仓 + 印花厂待加工仓原料库存达到 680 米。',
        '采购跟单',
      ),
    ],
  },
  {
    id: 'fabric-demand-006',
    materialImageUrl: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=120&q=80',
    materialName: '炭灰染色弹力布',
    materialSpu: 'FAB-SPU-6105',
    materialSku: 'FAB-2026-105-DYE',
    materialType: '染色面料',
    requiresPrint: false,
    requiresDye: true,
    demandQty: 580,
    rawMaterialName: '本白弹力坯布',
    rawMaterialSku: 'RAW-FAB-2026-105-WHT',
    rawMaterialDemandQty: 580,
    warehouseStocks: [stock('中央仓面料仓', 150, 'A-10-05'), stock('染色厂待加工仓', 120, 'D-02-01')],
    printQty: { waitPickupQty: 0, processingQty: 0, waitInboundQty: 0 },
    dyeQty: { waitPickupQty: 460, processingQty: 160, waitInboundQty: 0 },
    purchaseQty: { purchasingQty: 310, transitQty: 0, waitInboundQty: 0 },
    alerts: [
      alert(
        '缺染色原料',
        310,
        '触发：中央仓面料仓 150 米 + 染色厂待加工仓 120 米，合计小于染色需求 580 米。',
        '解除：中央仓面料仓 + 染色厂待加工仓原料库存达到 580 米。',
        '采购跟单',
      ),
    ],
  },
]

export function getFabricDemandBoardRows(): FabricDemandBoardRow[] {
  return fabricDemandBoardRows.map((row) => ({
    ...row,
    warehouseStocks: row.warehouseStocks.map((item) => ({ ...item })),
    printQty: { ...row.printQty },
    dyeQty: { ...row.dyeQty },
    purchaseQty: { ...row.purchaseQty },
    alerts: row.alerts.map((item) => ({ ...item })),
  }))
}

export function getFabricDemandBoardAlertRules(): FabricDemandBoardAlertRule[] {
  return [
    {
      type: '缺直裁面料',
      triggerText: '触发：中央仓面料仓库存 + 中转仓库存 < 直裁需求米数。',
      resolveText: '解除：中央仓面料仓库存 + 中转仓库存 >= 直裁需求米数。',
    },
    {
      type: '缺印花原料',
      triggerText: '触发：中央仓面料仓原料库存 + 印花厂待加工仓原料库存 < 印花需求米数。',
      resolveText: '解除：中央仓面料仓原料库存 + 印花厂待加工仓原料库存 >= 印花需求米数。',
    },
    {
      type: '缺染色原料',
      triggerText: '触发：中央仓面料仓原料库存 + 染色厂待加工仓原料库存 < 染色需求米数。',
      resolveText: '解除：中央仓面料仓原料库存 + 染色厂待加工仓原料库存 >= 染色需求米数。',
    },
    {
      type: '直裁待调拨',
      triggerText: '触发：中转仓库存不足，中央仓面料仓有库存，且两仓合计可覆盖直裁需求；调拨方向：中央仓面料仓 -> 中转仓。',
      resolveText: '解除：中转仓库存 >= 直裁需求米数。',
    },
    {
      type: '印花待调拨',
      triggerText: '触发：印花厂待加工仓原料库存不足，中央仓面料仓有原料，且两仓合计可覆盖印花需求；调拨方向：中央仓面料仓 -> 印花厂待加工仓。',
      resolveText: '解除：印花厂待加工仓原料库存 >= 印花需求米数。',
    },
    {
      type: '染色待调拨',
      triggerText: '触发：染色厂待加工仓原料库存不足，中央仓面料仓有原料，且两仓合计可覆盖染色需求；调拨方向：中央仓面料仓 -> 染色厂待加工仓。',
      resolveText: '解除：染色厂待加工仓原料库存 >= 染色需求米数。',
    },
  ]
}

export function getWarehouseQty(row: FabricDemandBoardRow, warehouseName: FabricDemandBoardWarehouseName): number {
  return row.warehouseStocks
    .filter((stockItem) => stockItem.warehouseName === warehouseName)
    .reduce((sum, stockItem) => sum + stockItem.qty, 0)
}

export function formatFabricDemandQty(qty: number): string {
  return `${Math.max(qty, 0).toLocaleString('zh-CN')} 米`
}

export function summarizeFabricDemandBoardRows(rows: FabricDemandBoardRow[]): FabricDemandBoardSummary {
  return {
    totalSkuCount: rows.length,
    printOrDyeSkuCount: rows.filter((row) => row.requiresPrint || row.requiresDye).length,
    directCutSkuCount: rows.filter((row) => !row.requiresPrint && !row.requiresDye).length,
    printingQty: rows.reduce((sum, row) => sum + row.printQty.processingQty, 0),
    dyeingQty: rows.reduce((sum, row) => sum + row.dyeQty.processingQty, 0),
    cuttingQty: rows
      .filter((row) => !row.requiresPrint && !row.requiresDye)
      .reduce((sum, row) => sum + Math.min(row.demandQty, getWarehouseQty(row, '中转仓')), 0),
    purchasingQty: rows.reduce((sum, row) => sum + row.purchaseQty.purchasingQty, 0),
    stockQty: rows.reduce((sum, row) => sum + row.warehouseStocks.reduce((rowSum, item) => rowSum + item.qty, 0), 0),
  }
}

export function filterFabricDemandBoardRows(
  rows: FabricDemandBoardRow[],
  filters: FabricDemandBoardFilters,
): FabricDemandBoardRow[] {
  const keyword = filters.keyword.trim().toLowerCase()
  return rows.filter((row) => {
    if (filters.materialType !== '全部' && row.materialType !== filters.materialType) return false
    if (filters.printRequirement === '需印花' && !row.requiresPrint) return false
    if (filters.printRequirement === '不需印花' && row.requiresPrint) return false
    if (filters.dyeRequirement === '需染色' && !row.requiresDye) return false
    if (filters.dyeRequirement === '不需染色' && row.requiresDye) return false
    if (filters.alertType !== '全部' && !row.alerts.some((item) => item.type === filters.alertType)) return false
    if (filters.warehouseName !== '全部' && getWarehouseQty(row, filters.warehouseName) <= 0) return false
    if (!keyword) return true

    return [row.materialName, row.materialSku, row.materialSpu, row.rawMaterialName, row.rawMaterialSku]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
}
