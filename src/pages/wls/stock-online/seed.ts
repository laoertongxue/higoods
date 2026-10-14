// WLS 库存与库内操作域（L2 泳道）新页面演示数据。
// 数据仅用于原型演示：单据类列表 16 条（两页），库存查询类 18 条。

/* ------------------------------------------------------------------ */
/* 仓库库存管理                                                        */
/* ------------------------------------------------------------------ */

export type WarehouseStockRow = {
  id: string
  spu: string
  sku: string
  zone: string
  stockType: string
  locationCode: string
  onHand: number
  locked: number
  available: number
  warehouseName: string
  countedAt: string
  updatedAt: string
}

export const WAREHOUSE_STOCK_ZONES = ['存储区', '拣货区', 'KOL区', '暂存区'] as const
export const WAREHOUSE_STOCK_TYPES = ['正常', '冻结', '次品', '待上架'] as const
export const WAREHOUSE_STOCK_WAREHOUSES = ['F&M WH', 'A&C WH'] as const

const WAREHOUSE_STOCK_PRODUCTS = [
  { spu: 'SPU-GC-10001', sku: 'SKU-GC-20001', name: '黑色连衣裙 M' },
  { spu: 'SPU-GC-10002', sku: 'SKU-GC-20002', name: '白色短袖 L' },
  { spu: 'SPU-GC-10003', sku: 'SKU-GC-20003', name: '灰色百褶裙 M' },
  { spu: 'SPU-GC-10004', sku: 'SKU-GC-20004', name: '卡其夹克 S' },
  { spu: 'SPU-GC-10005', sku: 'SKU-GC-20005', name: '蓝色牛仔裤 L' },
  { spu: 'SPU-GC-10006', sku: 'SKU-GC-20006', name: '米色针织衫 M' },
  { spu: 'SPU-GC-10007', sku: 'SKU-GC-20007', name: '黑色卫衣 XL' },
  { spu: 'SPU-GC-10008', sku: 'SKU-GC-20008', name: '藏青西裤 32' },
  { spu: 'SPU-GC-10009', sku: 'SKU-GC-20009', name: '白色衬衫 39' },
]

export const warehouseStockSeed: WarehouseStockRow[] = Array.from({ length: 18 }, (_, i) => {
  const product = WAREHOUSE_STOCK_PRODUCTS[i % WAREHOUSE_STOCK_PRODUCTS.length]
  const zone = WAREHOUSE_STOCK_ZONES[i % WAREHOUSE_STOCK_ZONES.length]
  const stockType = WAREHOUSE_STOCK_TYPES[i % WAREHOUSE_STOCK_TYPES.length]
  const warehouseName = WAREHOUSE_STOCK_WAREHOUSES[i % WAREHOUSE_STOCK_WAREHOUSES.length]
  const onHand = 36 + ((i * 17) % 180)
  const locked = i % 4 === 1 ? 6 + (i % 5) * 2 : 0
  const day = 18 - Math.floor(i / 6)
  return {
    id: `WS-${String(i + 1).padStart(3, '0')}`,
    spu: product.spu,
    sku: product.sku,
    zone,
    stockType,
    locationCode: `${zone.slice(0, 1)}-${String((i % 6) + 1).padStart(2, '0')}-${String((i % 4) + 1).padStart(2, '0')}`,
    onHand,
    locked,
    available: onHand - locked,
    warehouseName,
    countedAt: `2026-09-${String(day).padStart(2, '0')} ${String(9 + (i % 8)).padStart(2, '0')}:20`,
    updatedAt: `2026-09-${String(day).padStart(2, '0')} ${String(13 + (i % 6)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`,
  }
})

/* ------------------------------------------------------------------ */
/* 中转库存流水                                                        */
/* ------------------------------------------------------------------ */

export type TransitFlowRow = {
  id: string
  businessNo: string
  flowType: string
  spu: string
  sku: string
  opQty: number
  spotBefore: number
  spotAfter: number
  transitBefore: number
  transitAfter: number
  availableBefore: number
  availableAfter: number
  lockedBefore: number
  lockedAfter: number
  shippedBefore: number
  shippedAfter: number
  operatorName: string
  operateTime: string
  remark: string
}

export const TRANSIT_FLOW_TYPES = ['采购入库', '印花入库', '染色入库', '绣花入库', '调拨入库', '盘点入库', '手动入库', '卷码库存调整', '调拨出库', '领料出库', '盘点出库', '手动出库', '脚本自动出库'] as const

const TRANSIT_FLOW_PRODUCTS = [
  { spu: 'SPU-TF-30001', sku: 'SKU-TF-40001', name: '全棉平纹布 32S' },
  { spu: 'SPU-TF-30002', sku: 'SKU-TF-40002', name: '涤纶针织面料 40D' },
  { spu: 'SPU-TF-30003', sku: 'SKU-TF-40003', name: '树脂纽扣 11.5mm' },
  { spu: 'SPU-TF-30004', sku: 'SKU-TF-40004', name: '金属拉链 5# 60cm' },
  { spu: 'SPU-TF-30005', sku: 'SKU-TF-40005', name: 'OPP透明包装袋 30×40cm' },
  { spu: 'SPU-TF-30006', sku: 'SKU-TF-40006', name: '瓦楞纸箱 5层 60×40×30cm' },
]

const TRANSIT_FLOW_OPERATORS = ['Sari', 'Ayu', 'Bayu', 'Dian', 'Rina']

export const transitFlowSeed: TransitFlowRow[] = Array.from({ length: 16 }, (_, i) => {
  const flowType = TRANSIT_FLOW_TYPES[i % TRANSIT_FLOW_TYPES.length]
  const product = TRANSIT_FLOW_PRODUCTS[i % TRANSIT_FLOW_PRODUCTS.length]
  const opQty = 4 + ((i * 3) % 26)
  const spotBefore = 60 + ((i * 11) % 140)
  const transitBefore = 10 + ((i * 5) % 40)
  const lockedBefore = 4 + ((i * 3) % 24)
  const shippedBefore = 20 + ((i * 7) % 90)
  const isPickBack = flowType === '盘点入库' && i % 3 === 0
  const delta = isPickBack ? -Math.min(opQty, transitBefore) : opQty
  const spotAfter = flowType === '手动入库' || flowType === '盘点入库' ? spotBefore + delta : spotBefore
  const transitAfter = Math.max(0, transitBefore + (isPickBack ? delta : flowType === '手动入库' ? 0 : opQty))
  const lockedAfter = lockedBefore
  const shippedAfter = flowType === '调拨入库' ? shippedBefore + opQty : shippedBefore
  const availableAfter = Math.max(0, spotAfter - lockedAfter)
  const day = 13 - Math.floor(i / 6)
  const hour = 8 + (i % 9)
  return {
    id: `TF-${String(i + 1).padStart(3, '0')}`,
    businessNo: `${flowType.slice(0, 2)}-202609${String(day).padStart(2, '0')}-${String(3001 + i).padStart(4, '0')}`,
    flowType,
    spu: product.spu,
    sku: product.sku,
    opQty,
    spotBefore,
    spotAfter,
    transitBefore,
    transitAfter,
    availableBefore: Math.max(0, spotBefore - lockedBefore),
    availableAfter,
    lockedBefore,
    lockedAfter,
    shippedBefore,
    shippedAfter,
    operatorName: TRANSIT_FLOW_OPERATORS[i % TRANSIT_FLOW_OPERATORS.length],
    operateTime: `2026-09-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String((i * 9) % 60).padStart(2, '0')}`,
    remark: i % 5 === 0 ? `${product.name} 入库质检完成` : i % 5 === 3 ? '由盘点差异调整' : '',
  }
})

/* ------------------------------------------------------------------ */
/* 中转移货                                                            */
/* ------------------------------------------------------------------ */

export type TransitMoveRow = {
  id: string
  moveNo: string
  warehouseName: string
  fromLocation: string
  toLocation: string
  spu: string
  sku: string
  moveQtyText: string
  createdAt: string
  status: '待执行' | '执行中' | '已完成' | '已取消'
}

export const TRANSIT_MOVE_STATUSES = ['待执行', '执行中', '已完成', '已取消'] as const
export const TRANSIT_WAREHOUSES = ['新裁床', 'Sea Cutting'] as const

export const transitMoveSeed: TransitMoveRow[] = Array.from({ length: 16 }, (_, i) => {
  const product = TRANSIT_FLOW_PRODUCTS[i % TRANSIT_FLOW_PRODUCTS.length]
  const warehouseName = TRANSIT_WAREHOUSES[i % TRANSIT_WAREHOUSES.length]
  const packageQty = 1 + (i % 4)
  const baseQty = packageQty * 120
  const day = 17 - Math.floor(i / 6)
  return {
    id: `TM-${String(i + 1).padStart(3, '0')}`,
    moveNo: `YH-202609${String(day).padStart(2, '0')}-${String(7001 + i).padStart(4, '0')}`,
    warehouseName,
    fromLocation: `存储区 ${String.fromCharCode(65 + (i % 3))}-${String((i % 5) + 1).padStart(2, '0')}-01`,
    toLocation: `拣货区 ${String.fromCharCode(65 + ((i + 1) % 3))}-${String((i % 4) + 1).padStart(2, '0')}-02`,
    spu: product.spu,
    sku: product.sku,
    moveQtyText: `${packageQty} 箱 / ${baseQty} 个`,
    createdAt: `2026-09-${String(day).padStart(2, '0')} ${String(8 + (i % 9)).padStart(2, '0')}:${String((i * 11) % 60).padStart(2, '0')}`,
    status: TRANSIT_MOVE_STATUSES[i % TRANSIT_MOVE_STATUSES.length],
  }
})

/* ------------------------------------------------------------------ */
/* 成衣仓调拨                                                          */
/* ------------------------------------------------------------------ */

export type GarmentTransferRow = {
  id: string
  transferNo: string
  fromWarehouse: string
  toWarehouse: string
  skuKinds: number
  transferQty: number
  pickedQty: number
  sentQty: number
  status: '待拣货' | '待发出' | '已完成' | '已取消' | '异常'
  account: string
}

export const GARMENT_TRANSFER_STATUSES = ['待拣货', '待发出', '已完成', '已取消', '异常'] as const
export const GARMENT_WAREHOUSES = ['F&M WH', 'A&C WH'] as const
export const GARMENT_ACCOUNTS = ['Rina', 'Ayu', 'Bayu', 'Dian', 'Putri'] as const

export const garmentTransferSeed: GarmentTransferRow[] = Array.from({ length: 16 }, (_, i) => {
  const status = GARMENT_TRANSFER_STATUSES[i % GARMENT_TRANSFER_STATUSES.length]
  const fromWarehouse = GARMENT_WAREHOUSES[i % GARMENT_WAREHOUSES.length]
  const toWarehouse = GARMENT_WAREHOUSES[(i + 1) % GARMENT_WAREHOUSES.length]
  const transferQty = 40 + ((i * 13) % 200)
  const pickedQty = status === '待拣货' ? 0 : status === '已取消' ? 0 : transferQty
  const sentQty = status === '已完成' ? transferQty : status === '异常' ? Math.floor(transferQty / 2) : 0
  const day = 16 - Math.floor(i / 6)
  return {
    id: `GT-${String(i + 1).padStart(3, '0')}`,
    transferNo: `DB-202609${String(day).padStart(2, '0')}-${String(9001 + i).padStart(4, '0')}`,
    fromWarehouse,
    toWarehouse,
    skuKinds: 1 + (i % 5),
    transferQty,
    pickedQty,
    sentQty,
    status,
    account: GARMENT_ACCOUNTS[i % GARMENT_ACCOUNTS.length],
  }
})

/* ------------------------------------------------------------------ */
/* 中转仓盘点单                                                        */
/* ------------------------------------------------------------------ */

export type TransitCountRow = {
  id: string
  countNo: string
  warehouseName: string
  countType: string
  status: '待处理' | '盘点中' | '待审核' | '盘点完成' | '已取消'
  creator: string
  createdAt: string
}

export const TRANSIT_COUNT_STATUSES = ['待处理', '盘点中', '待审核', '盘点完成', '已取消'] as const
export const TRANSIT_COUNT_TYPES = ['全仓', '库区', '库位', 'SKU'] as const
export const TRANSIT_COUNT_CREATORS = ['Sari', 'Ayu', 'Bayu', 'Dian'] as const

export const transitCountSeed: TransitCountRow[] = Array.from({ length: 16 }, (_, i) => {
  const day = 18 - Math.floor(i / 6)
  return {
    id: `TC-${String(i + 1).padStart(3, '0')}`,
    countNo: `PD-202609${String(day).padStart(2, '0')}-${String(8001 + i).padStart(4, '0')}`,
    warehouseName: TRANSIT_WAREHOUSES[i % TRANSIT_WAREHOUSES.length],
    countType: TRANSIT_COUNT_TYPES[i % TRANSIT_COUNT_TYPES.length],
    status: TRANSIT_COUNT_STATUSES[i % TRANSIT_COUNT_STATUSES.length],
    creator: TRANSIT_COUNT_CREATORS[i % TRANSIT_COUNT_CREATORS.length],
    createdAt: `2026-09-${String(day).padStart(2, '0')} ${String(9 + (i % 8)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`,
  }
})

/* ------------------------------------------------------------------ */
/* KOL 移货申请                                                        */
/* ------------------------------------------------------------------ */

export type KolMoveRow = {
  id: string
  applyNo: string
  applicant: string
  applyTime: string
  spu: string
  sku: string
  productName: string
  applyQty: number
  status: '待处理' | '已生成移货单' | '已驳回' | '已完成'
  remark: string
}

export const KOL_MOVE_STATUSES = ['待处理', '已生成移货单', '已驳回', '已完成'] as const
export const KOL_MOVE_APPLICANTS = ['KOL运营-小陈', 'KOL运营-小杨', 'KOL运营-小林', 'KOL运营-小周'] as const

export const kolMoveSeed: KolMoveRow[] = Array.from({ length: 16 }, (_, i) => {
  const product = WAREHOUSE_STOCK_PRODUCTS[i % WAREHOUSE_STOCK_PRODUCTS.length]
  const day = 17 - Math.floor(i / 6)
  return {
    id: `KM-${String(i + 1).padStart(3, '0')}`,
    applyNo: `KOL-202609${String(day).padStart(2, '0')}-${String(6001 + i).padStart(4, '0')}`,
    applicant: KOL_MOVE_APPLICANTS[i % KOL_MOVE_APPLICANTS.length],
    applyTime: `2026-09-${String(day).padStart(2, '0')} ${String(10 + (i % 8)).padStart(2, '0')}:${String((i * 13) % 60).padStart(2, '0')}`,
    spu: product.spu,
    sku: product.sku,
    productName: product.name,
    applyQty: 2 + ((i * 3) % 30),
    status: KOL_MOVE_STATUSES[i % KOL_MOVE_STATUSES.length],
    remark: i % 5 === 0 ? '直播样品，优先处理' : i % 5 === 2 ? '库存不足，部分驳回' : '',
  }
})
