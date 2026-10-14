// 成衣出库域线上页（L1 泳道）演示数据。
// 仅用于原型演示：每个列表页 16 条（两页），各状态至少 1 条。
// 商品图片复用原型已有实拍资产（public 根目录示例图），无对应图片的对象不渲染 img，不使用纯色块冒充。

/* ------------------------------------------------------------------ */
/* 共用：仓库选项与商品行                                               */
/* ------------------------------------------------------------------ */

export const ONLINE_WAREHOUSE_OPTIONS = ['全部仓库', 'A&C WH', 'F&M WH'] as const

/** 成衣商品行（含实拍图），供各列表“商品信息”列复用。 */
export type OnlineProduct = {
  spu: string
  sku: string
  name: string
  image: string
}

export const ONLINE_PRODUCTS: OnlineProduct[] = [
  { spu: 'SPU-GC-10001', sku: 'SKU-GC-20001', name: '黑色连衣裙 M', image: '/dress-sample-1.jpg' },
  { spu: 'SPU-GC-10002', sku: 'SKU-GC-20002', name: '白色短袖 L', image: '/tshirt-sample.jpg' },
  { spu: 'SPU-GC-10003', sku: 'SKU-GC-20003', name: '灰色百褶裙 M', image: '/pants-sample.jpg' },
  { spu: 'SPU-GC-10004', sku: 'SKU-GC-20004', name: '卡其夹克 S', image: '/jacket-sample.jpg' },
  { spu: 'SPU-GC-10005', sku: 'SKU-GC-20005', name: '蓝色牛仔裤 L', image: '/denim-shorts-sample.jpg' },
  { spu: 'SPU-GC-10006', sku: 'SKU-GC-20006', name: '米色针织衫 M', image: '/cardigan-sample.jpg' },
  { spu: 'SPU-GC-10007', sku: 'SKU-GC-20007', name: '黑色卫衣 XL', image: '/shirt-sample.jpg' },
  { spu: 'SPU-GC-10008', sku: 'SKU-GC-20008', name: '藏青西裤 32', image: '/pants-sample.jpg' },
  { spu: 'SPU-GC-10009', sku: 'SKU-GC-20009', name: '白色衬衫 39', image: '/shirt-sample.jpg' },
]

function productAt(index: number): OnlineProduct {
  return ONLINE_PRODUCTS[index % ONLINE_PRODUCTS.length]
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0')
}

/* ------------------------------------------------------------------ */
/* 1. 打单揽收统计 printCollectSeed                                     */
/* ------------------------------------------------------------------ */

export type PrintCollectStatus = '待拣货' | '拣货完成' | '预售发货' | '现货发货'

export type PrintCollectRow = {
  id: string
  outboundOrderNo: string
  relatedOrderNo: string
  trackingNo: string
  product: OnlineProduct
  warehouse: string
  carrier: string
  orderType: string
  status: PrintCollectStatus
  createdAt: string
  collectedAt: string
}

export const PRINT_COLLECT_CARRIERS = ['J&T Express', 'JNE', 'SICEPAT', 'ANTERAJA'] as const
export const PRINT_COLLECT_STATUSES: readonly PrintCollectStatus[] = ['待拣货', '拣货完成', '预售发货', '现货发货']

export const printCollectSeed: PrintCollectRow[] = Array.from({ length: 16 }, (_, index) => {
  const status = PRINT_COLLECT_STATUSES[index % PRINT_COLLECT_STATUSES.length]
  const carrier = PRINT_COLLECT_CARRIERS[index % PRINT_COLLECT_CARRIERS.length]
  const day = 12 - Math.floor(index / 8)
  const hour = 9 + (index % 8)
  return {
    id: `PC-${pad(index + 1, 4)}`,
    outboundOrderNo: `CK-202610${pad(day, 2)}-${pad(1000 + index, 4)}`,
    relatedOrderNo: `SO-202610${pad(day, 2)}-${pad(2000 + index, 4)}`,
    trackingNo: `${carrier === 'J&T Express' ? 'JP' : carrier === 'JNE' ? 'JNE' : carrier === 'SICEPAT' ? 'SP' : 'AJA'}${pad(7100000000 + index * 137, 12)}`,
    product: productAt(index),
    warehouse: ONLINE_WAREHOUSE_OPTIONS[1 + (index % 2)],
    carrier,
    orderType: index % 3 === 0 ? '预售订单' : '现货订单',
    status,
    createdAt: `2026-10-${pad(day, 2)} ${pad(hour, 2)}:${pad((index * 7) % 60, 2)}`,
    collectedAt:
      status === '待拣货'
        ? '-'
        : `2026-10-${pad(day, 2)} ${pad(hour + 2, 2)}:${pad((index * 5) % 60, 2)}`,
  }
})

/* ------------------------------------------------------------------ */
/* 2. KOL待打单列表 kolPrintSeed                                        */
/* ------------------------------------------------------------------ */

export type KolPrintStatus = '待打单' | '已打单' | '已取消'

export type KolPrintRow = {
  id: string
  outboundOrderNo: string
  relatedOrderNo: string
  trackingNo: string
  product: OnlineProduct
  warehouse: string
  outboundType: string
  pickType: string
  brand: string
  stockStatus: string
  platform: string
  status: KolPrintStatus
  createdAt: string
  collectedAt: string
}

export const KOL_PICK_TYPES = ['全部拣货类型', '单品拣货', '多品拣货'] as const
export const KOL_BRANDS = ['请选择品牌', '自营品牌', '合作品牌'] as const
export const KOL_STOCK_STATUSES = ['全部库存状态', '库存充足', '库存不足'] as const
export const KOL_PLATFORMS = ['全部平台', 'Shopee', 'TikTok', '抖音'] as const

export const kolPrintSeed: KolPrintRow[] = Array.from({ length: 16 }, (_, index) => {
  const statuses: KolPrintStatus[] = ['待打单', '待打单', '已打单', '已取消']
  const status = statuses[index % statuses.length]
  const outboundTypes = ['KOL寄样', '直播出库', '达人寄样']
  const day = 13 - Math.floor(index / 8)
  const hour = 8 + (index % 9)
  return {
    id: `KOL-${pad(index + 1, 4)}`,
    outboundOrderNo: `KOLCK-202610${pad(day, 2)}-${pad(3000 + index, 4)}`,
    relatedOrderNo: `KOL-202610${pad(day, 2)}-${pad(4000 + index, 4)}`,
    trackingNo: `SP${pad(59000000 + index * 211, 12)}`,
    product: productAt(index + 2),
    warehouse: ONLINE_WAREHOUSE_OPTIONS[1 + (index % 2)],
    outboundType: outboundTypes[index % outboundTypes.length],
    pickType: index % 2 === 0 ? '单品拣货' : '多品拣货',
    brand: index % 3 === 0 ? '合作品牌' : '自营品牌',
    stockStatus: index % 5 === 0 ? '库存不足' : '库存充足',
    platform: KOL_PLATFORMS[1 + (index % 3)],
    status,
    createdAt: `2026-10-${pad(day, 2)} ${pad(hour, 2)}:${pad((index * 11) % 60, 2)}`,
    collectedAt:
      status === '待打单'
        ? '-'
        : `2026-10-${pad(day, 2)} ${pad(hour + 1, 2)}:${pad((index * 9) % 60, 2)}`,
  }
})

/* ------------------------------------------------------------------ */
/* 3. 借出单管理 loanSeed                                               */
/* ------------------------------------------------------------------ */

export type LoanStatus = '待借出' | '已借出' | '已归还' | '已取消'

export type LoanRow = {
  id: string
  loanOrderNo: string
  sourceOrderNo: string
  warehouse: string
  product: OnlineProduct
  quantity: number
  borrower: string
  borrowType: string
  recipientInfo: string
  operator: string
  status: LoanStatus
  pushStatus: string
  printStatus: string
  createdAt: string
  waybillNo: string
  carrier: string
}

export const LOAN_BORROW_TYPES = ['全部借出类别', '跟单', '直播', '主播寄样', '达人寄样'] as const
export const LOAN_STATUSES: readonly LoanStatus[] = ['待借出', '已借出', '已归还', '已取消']

export const loanSeed: LoanRow[] = Array.from({ length: 16 }, (_, index) => {
  const status = LOAN_STATUSES[index % LOAN_STATUSES.length]
  const borrowTypes = ['跟单', '直播', '主播寄样', '达人寄样']
  const borrowers = ['Rina', 'Dian', 'Siti', '阿明']
  const day = 11 - Math.floor(index / 8)
  const hour = 9 + (index % 8)
  const printStatus = status === '待借出' ? '未下载' : index % 3 === 0 ? '已打印' : '已下载'
  return {
    id: `LOAN-${pad(index + 1, 4)}`,
    loanOrderNo: `JC-202610${pad(day, 2)}-${pad(5000 + index, 4)}`,
    sourceOrderNo: `LY-202610${pad(day, 2)}-${pad(6000 + index, 4)}`,
    warehouse: ONLINE_WAREHOUSE_OPTIONS[1 + (index % 2)],
    product: productAt(index + 1),
    quantity: 1 + (index % 5),
    borrower: borrowers[index % borrowers.length],
    borrowType: borrowTypes[index % borrowTypes.length],
    recipientInfo: `雅加达直播间 ${pad(index % 12 + 1, 2)} 号展位 / 0821${pad(30000000 + index * 131, 8)}`,
    operator: index % 4 === 0 ? '待分配' : borrowers[(index + 1) % borrowers.length],
    status,
    pushStatus: index % 3 === 0 ? '已推单' : '未推单',
    printStatus,
    createdAt: `2026-10-${pad(day, 2)} ${pad(hour, 2)}:${pad((index * 13) % 60, 2)}`,
    waybillNo: `SP${pad(59000000 + index * 97, 12)}`,
    carrier: index % 2 === 0 ? 'J&T Express' : 'SICEPAT',
  }
})

/* ------------------------------------------------------------------ */
/* 4. Shopee订单管理 / 5. 推广任务单列表（同构）                         */
/* ------------------------------------------------------------------ */

export type ShopeeOrderStatus = '待拣货' | '待打单' | '已打单' | '已发货'

export type ShopeeOrderRow = {
  id: string
  outboundOrderNo: string
  relatedOrderNo: string
  trackingNo: string
  product: OnlineProduct
  warehouse: string
  orderType: string
  outboundQuantity: number
  waybillPrintCount: number
  status: ShopeeOrderStatus
  createTime: string
  pickTime: string
  collectedTime: string
  shipTime: string
  platform: string
}

export const SHOPEE_ORDER_TYPES = ['全部出库类型', '现货订单', '预售订单'] as const
export const SHOPEE_PRINT_STATUSES = ['全部打印状态', '未打印', '已打印'] as const
export const SHOPEE_SORT_FIELDS = ['创建时间', '拣货时间', '揽收时效', '发货时间'] as const

function buildShopeeSeed(prefix: string, platform: string, offset: number): ShopeeOrderRow[] {
  const statuses: ShopeeOrderStatus[] = ['待拣货', '待打单', '已打单', '已发货']
  return Array.from({ length: 16 }, (_, index) => {
    const status = statuses[index % statuses.length]
    const day = 14 - Math.floor(index / 8)
    const hour = 8 + (index % 9)
    const printCount = status === '待拣货' || status === '待打单' ? 0 : index % 4 === 3 ? 2 : 1
    return {
      id: `${prefix}-${pad(index + 1, 4)}`,
      outboundOrderNo: `${prefix}CK-202610${pad(day, 2)}-${pad(offset + index, 4)}`,
      relatedOrderNo: `${prefix}SO-202610${pad(day, 2)}-${pad(offset + 1000 + index, 4)}`,
      trackingNo: `${platform === 'Shopee' ? 'SP' : 'PO'}${pad(60000000 + index * 173 + offset, 12)}`,
      product: productAt(index + offset),
      warehouse: ONLINE_WAREHOUSE_OPTIONS[1 + (index % 2)],
      orderType: index % 3 === 0 ? '预售订单' : '现货订单',
      outboundQuantity: 1 + ((index * 3) % 6),
      waybillPrintCount: printCount,
      status,
      createTime: `2026-10-${pad(day, 2)} ${pad(hour, 2)}:${pad((index * 7) % 60, 2)}`,
      pickTime: status === '待拣货' ? '-' : `2026-10-${pad(day, 2)} ${pad(hour + 1, 2)}:10`,
      collectedTime: status === '待拣货' || status === '待打单' ? '-' : `2026-10-${pad(day, 2)} ${pad(hour + 2, 2)}:20`,
      shipTime: status === '已发货' ? `2026-10-${pad(day, 2)} ${pad(hour + 4, 2)}:30` : '-',
      platform,
    }
  })
}

export const shopeeOrderSeed: ShopeeOrderRow[] = buildShopeeSeed('SH', 'Shopee', 0)
export const promoOrderSeed: ShopeeOrderRow[] = buildShopeeSeed('TG', '推广', 500)

/* ------------------------------------------------------------------ */
/* 6. 扫码拣货 scanPickOrderSeed（mock 1 个拣货单）                      */
/* ------------------------------------------------------------------ */

export type ScanPickLineStatus = '待拣货' | '已拣货'

export type ScanPickLine = {
  id: string
  spu: string
  sku: string
  name: string
  image: string
  location: string
  plannedQuantity: number
  pickedQuantity: number
  status: ScanPickLineStatus
}

export type ScanPickOrder = {
  pickOrderNo: string
  outboundOrderNo: string
  relatedOrderNo: string
  trackingNo: string
  warehouse: string
  pickType: string
  operator: string
  status: string
  createdAt: string
  lines: ScanPickLine[]
}

export const scanPickOrderSeed: ScanPickOrder[] = [
  {
    pickOrderNo: 'JHD-20261014-3001',
    outboundOrderNo: 'CK-20261014-1001',
    relatedOrderNo: 'SO-20261014-2001',
    trackingNo: 'SP600000000001',
    warehouse: 'A&C WH',
    pickType: '多品拣货',
    operator: 'Rina',
    status: '待拣货',
    createdAt: '2026-10-14 09:12',
    lines: [
      { id: 'SPL-01', spu: 'SPU-GC-10001', sku: 'SKU-GC-20001', name: '黑色连衣裙 M', image: '/dress-sample-1.jpg', location: 'A-01-02', plannedQuantity: 2, pickedQuantity: 0, status: '待拣货' },
      { id: 'SPL-02', spu: 'SPU-GC-10002', sku: 'SKU-GC-20002', name: '白色短袖 L', image: '/tshirt-sample.jpg', location: 'A-02-05', plannedQuantity: 3, pickedQuantity: 0, status: '待拣货' },
      { id: 'SPL-03', spu: 'SPU-GC-10004', sku: 'SKU-GC-20004', name: '卡其夹克 S', image: '/jacket-sample.jpg', location: 'B-01-01', plannedQuantity: 1, pickedQuantity: 1, status: '已拣货' },
      { id: 'SPL-04', spu: 'SPU-GC-10005', sku: 'SKU-GC-20005', name: '蓝色牛仔裤 L', image: '/denim-shorts-sample.jpg', location: 'B-02-03', plannedQuantity: 2, pickedQuantity: 0, status: '待拣货' },
      { id: 'SPL-05', spu: 'SPU-GC-10007', sku: 'SKU-GC-20007', name: '黑色卫衣 XL', image: '/shirt-sample.jpg', location: 'C-01-04', plannedQuantity: 1, pickedQuantity: 0, status: '待拣货' },
    ],
  },
]

/* ------------------------------------------------------------------ */
/* 7. 扫码打单 orderScanShipSeed                                        */
/* ------------------------------------------------------------------ */

export type OrderScanShipStatus = '待扫描' | '已扫描' | '已打印'

export type OrderScanShipLine = {
  id: string
  barcode: string
  product: OnlineProduct
  orderedQuantity: number
  pickedQuantity: number
  status: OrderScanShipStatus
}

export type OrderScanShipOrder = {
  pickOrderNo: string
  outboundOrderNo: string
  relatedOrderNo: string
  warehouse: string
  operator: string
  lines: OrderScanShipLine[]
}

export const ORDER_SCAN_SHIP_PRINTERS = ['手动打印', '标签打印机 LP-01', '标签打印机 LP-02'] as const

export const orderScanShipOrderSeed: OrderScanShipOrder[] = [
  {
    pickOrderNo: 'JHD-20261014-3002',
    outboundOrderNo: 'CK-20261014-1002',
    relatedOrderNo: 'SO-20261014-2002',
    warehouse: 'F&M WH',
    operator: 'Dian',
    lines: [
      { id: 'OSS-01', barcode: 'SKU-GC-20003', product: ONLINE_PRODUCTS[2], orderedQuantity: 2, pickedQuantity: 2, status: '待扫描' },
      { id: 'OSS-02', barcode: 'SKU-GC-20006', product: ONLINE_PRODUCTS[5], orderedQuantity: 1, pickedQuantity: 1, status: '待扫描' },
      { id: 'OSS-03', barcode: 'SKU-GC-20008', product: ONLINE_PRODUCTS[7], orderedQuantity: 3, pickedQuantity: 2, status: '待扫描' },
      { id: 'OSS-04', barcode: 'SKU-GC-20009', product: ONLINE_PRODUCTS[8], orderedQuantity: 1, pickedQuantity: 1, status: '待扫描' },
    ],
  },
]
