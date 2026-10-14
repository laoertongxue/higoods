// 原料管理域（/wls/online 占位页）演示数据。
// 全部为确定性生成，单据列表每页 16 条（默认 10/页，分页恰好 2 页）。

// ===========================================================================
// 1. 到货列表（染色 / 印花 / 绣花 三变体共享生成）
// ===========================================================================

export type ArrivalSourceType = '染色单' | '印花单' | '绣花单'
export type ArrivalStatus = '待收货' | '部分收货' | '收货完成' | '终止收货'

export interface ArrivalRow {
  id: string
  sourceType: ArrivalSourceType
  sourceNo: string
  relatedNo: string
  productionNo: string
  styleNo: string
  warehouseAttr: string
  warehouse: string
  spu: string
  sku: string
  productName: string
  unit: string
  planQty: number
  actualQty: number
  planPackage: number
  actualPackage: number
  weight: string
  gramWeight: string
  standardQty: number
  time: string
  barcodes: Array<{ barcode: string; qty: string }>
  status: ArrivalStatus
}

export interface ArrivalSourceConfig {
  key: 'dyeing' | 'printing' | 'embroidery'
  sourceType: ArrivalSourceType
  sourcePrefix: string
  title: string
  listTitle: string
  preferenceKey: string
  eventPrefix: string
}

export const ARRIVAL_SOURCES: readonly ArrivalSourceConfig[] = [
  { key: 'dyeing', sourceType: '染色单', sourcePrefix: 'RS', title: '染色到货列表', listTitle: '染色到货单', preferenceKey: '/wls/online/dye-arrival:list-columns', eventPrefix: 'wls-online-dye-arrival' },
  { key: 'printing', sourceType: '印花单', sourcePrefix: 'YH', title: '印花到货列表', listTitle: '印花到货单', preferenceKey: '/wls/online/print-arrival:list-columns', eventPrefix: 'wls-online-print-arrival' },
  { key: 'embroidery', sourceType: '绣花单', sourcePrefix: 'ST', title: '绣花到货列表', listTitle: '绣花到货单', preferenceKey: '/wls/online/embroidery-arrival:list-columns', eventPrefix: 'wls-online-embroidery-arrival' },
]

const ARRIVAL_STATUSES: readonly ArrivalStatus[] = ['待收货', '部分收货', '收货完成', '终止收货']

export interface RawWarehouseOption {
  name: string
  attr: string
  code?: string
}

// 规格 A/C/D 组共用仓库主数据（含编码）。
// 13 仓库：面料 / 辅料 / 纱线 / 耗材 / 包材属性，供到货、调拨调出、盘点等使用。
export const RAW_WAREHOUSE_13: readonly RawWarehouseOption[] = [
  { name: 'SAMPLE-FABRIC-样衣面辅料仓', attr: '辅料仓', code: 'WH-FABRIC-006' },
  { name: 'GT面料仓', attr: '面料仓', code: 'WH-FABRIC-005' },
  { name: 'holis面料仓', attr: '面料仓', code: 'WH-FABRIC-004' },
  { name: 'HILON-裁片仓', attr: '面料仓', code: 'HILON-5' },
  { name: 'HILON-耗材', attr: '耗材仓', code: 'HILON-4' },
  { name: 'HILON-纱线', attr: '纱线仓', code: 'HILON-3' },
  { name: '耗材中央仓', attr: '耗材仓', code: 'WH-HAOCAI-001' },
  { name: '面料中央仓', attr: '面料仓', code: 'WH-FABRIC-001' },
  { name: '纱线中央仓', attr: '纱线仓', code: 'WH-MAOSHA-001' },
  { name: '辅料中央仓', attr: '辅料仓', code: 'WH-FITTING-001' },
  { name: 'HILON-辅料仓', attr: '辅料仓', code: 'HILON-2' },
  { name: 'HILON-面料仓', attr: '面料仓', code: 'HILON-1' },
  { name: 'GUDANG BARU-1', attr: '面料仓' },
]

// 含 2 个中转仓：条码 / 出库组共用 15 仓库。
export const RAW_WAREHOUSE_15: readonly RawWarehouseOption[] = [
  ...RAW_WAREHOUSE_13,
  { name: '中转仓（新裁床）', attr: '中转仓', code: 'WH-BDG-009' },
  { name: '中转仓（Sea Cutting）', attr: '中转仓', code: 'WH-BDG-005' },
]

// 调拨目标仓库：13 仓库 + 中转仓 + 加工仓。
export const TRANSFER_TARGET_WAREHOUSES: readonly RawWarehouseOption[] = [
  ...RAW_WAREHOUSE_15,
  { name: '印花加工仓', attr: '加工仓', code: 'printing_29' },
  { name: 'GTG染色加工仓', attr: '加工仓', code: 'dyeing_30' },
  { name: 'MJS待加工仓', attr: '加工仓', code: 'dyeing_333' },
  { name: '绣花待加工仓', attr: '加工仓', code: 'embroidery_1202' },
  { name: '毛织待加工仓', attr: '加工仓', code: 'knitting_486' },
  { name: '织带加工仓', attr: '加工仓', code: 'webbing_1197' },
]

const ARRIVAL_WAREHOUSES = RAW_WAREHOUSE_13
const ARRIVAL_PRODUCTS = [
  { name: '主身面料-棕', unit: 'PCS', planQty: 64.2, color: 'brown' },
  { name: '罗纹领口-黑', unit: 'PCS', planQty: 120, color: 'black' },
  { name: '里布-浅灰', unit: '米', planQty: 286.5, color: 'gray' },
  { name: '绣花章-白', unit: '片', planQty: 300, color: 'white' },
  { name: '印花裁片-蓝', unit: '片', planQty: 210, color: 'blue' },
  { name: '包装袋-中号', unit: '个', planQty: 500, color: 'kraft' },
]

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function makeArrivalRows(config: ArrivalSourceConfig, base: number): ArrivalRow[] {
  return Array.from({ length: 16 }, (_, index): ArrivalRow => {
    const status = ARRIVAL_STATUSES[index % ARRIVAL_STATUSES.length]
    const warehouse = ARRIVAL_WAREHOUSES[index % ARRIVAL_WAREHOUSES.length]
    const product = ARRIVAL_PRODUCTS[index % ARRIVAL_PRODUCTS.length]
    const planQty = product.planQty
    const actualQty =
      status === '待收货' ? 0
        : status === '部分收货' ? round1(planQty * 0.6)
          : status === '终止收货' ? round1(planQty * 0.3)
            : planQty
    const planPackage = Math.max(1, Math.ceil(planQty / 80))
    const actualPackage = actualQty === 0 ? 0 : Math.max(1, Math.ceil(actualQty / 80))
    const hasWeight = product.unit === 'KG'
    const sourceNo = `${config.sourcePrefix}${6000 + base + index}`
    return {
      id: `${config.key.toUpperCase()}-${base + index}`,
      sourceType: config.sourceType,
      sourceNo,
      relatedNo: `FADUU2607${String(2000 + base + index).padStart(4, '0')}`,
      productionNo: `PO${17800 + base + index}`,
      styleNo: `FADUU26${String(72306 + base + index)}`,
      warehouseAttr: warehouse.attr,
      warehouse: warehouse.name,
      spu: `SPU-${config.sourcePrefix}-${1000 + base + index}`,
      sku: `FLSZ-${config.sourcePrefix}-${product.color}-19-${1300 + base + index}PT`,
      productName: product.name,
      unit: product.unit,
      planQty,
      actualQty,
      planPackage,
      actualPackage,
      weight: hasWeight ? `${round1(planQty * 0.5)} KG` : '—',
      gramWeight: hasWeight ? '180' : '—',
      standardQty: 10 + (index % 5) * 5,
      time: `2026-10-${String(1 + (index % 12)).padStart(2, '0')} ${String(8 + (index % 9)).padStart(2, '0')}:${index % 2 === 0 ? '20' : '40'}`,
      barcodes: Array.from({ length: planPackage }, (_, rollIndex) => ({
        barcode: `BC${config.sourcePrefix}${6000 + base + index}-${String(rollIndex + 1).padStart(2, '0')}`,
        qty: `${round1(planQty / planPackage)} ${product.unit}`,
      })),
      status,
    }
  })
}

export const dyeArrivalSeed: ArrivalRow[] = makeArrivalRows(ARRIVAL_SOURCES[0], 0)
export const printArrivalSeed: ArrivalRow[] = makeArrivalRows(ARRIVAL_SOURCES[1], 0)
export const embroideryArrivalSeed: ArrivalRow[] = makeArrivalRows(ARRIVAL_SOURCES[2], 0)

export function arrivalSeedByKey(key: ArrivalSourceConfig['key']): ArrivalRow[] {
  if (key === 'printing') return printArrivalSeed
  if (key === 'embroidery') return embroideryArrivalSeed
  return dyeArrivalSeed
}

// ===========================================================================
// 2. 调拨单据（待交出 / 交出 / 等待入库 三视角共享结构）
// ===========================================================================

export interface TransferRow {
  id: string
  productionNo: string
  spu: string
  sku: string
  materialType: string
  fromWarehouse: string
  toWarehouse: string
  transferQty: number
  unit: string
  doneQty: number
  status: string
  applicant: string
  applyTime: string
}

const TRANSFER_PRODUCTS = [
  { type: '面料', name: 'CNIDML074', unit: '卷', qty: 30 },
  { type: '辅料', name: 'ACC-拉链-5号', unit: '包', qty: 12 },
  { type: '面料', name: 'RIB-罗纹-黑', unit: '卷', qty: 24 },
  { type: '耗材', name: 'THR-缝纫线-40S', unit: '箱', qty: 8 },
  { type: '纱线', name: 'YRN-涤纶-300D', unit: '卷', qty: 40 },
  { type: '包材', name: 'PKG-快递袋-中号', unit: '包', qty: 20 },
]
const TRANSFER_FROM = RAW_WAREHOUSE_13.map((warehouse) => warehouse.name)
const TRANSFER_TO = ['中转仓（Sea Cutting）', '面料中央仓', 'HILON-裁片仓', 'HILON-纱线', '耗材中央仓', '辅料中央仓', '印花加工仓', 'GTG染色加工仓']
const TRANSFER_APPLICANTS = ['Mala', 'Rina', 'Dian', 'Siti', 'Agus', 'Bagus']

function makeTransferRows(prefix: string, statuses: readonly string[], base: number): TransferRow[] {
  return Array.from({ length: 16 }, (_, index): TransferRow => {
    const product = TRANSFER_PRODUCTS[index % TRANSFER_PRODUCTS.length]
    const status = statuses[index % statuses.length]
    const transferQty = product.qty + (index % 5) * 6
    const doneQty =
      status === statuses[0] ? 0
        : status === statuses[1] && statuses.length > 2 ? round1(transferQty * 0.5)
          : transferQty
    return {
      id: String(26700 + base + index),
      productionNo: `PO${18000 + base + index}`,
      spu: `SPU-${prefix}-${1000 + index}`,
      sku: `${product.name}-${product.type}`,
      materialType: product.type,
      fromWarehouse: TRANSFER_FROM[index % TRANSFER_FROM.length],
      toWarehouse: TRANSFER_TO[index % TRANSFER_TO.length],
      transferQty,
      unit: product.unit,
      doneQty,
      status,
      applicant: TRANSFER_APPLICANTS[index % TRANSFER_APPLICANTS.length],
      applyTime: `2026-10-${String(1 + (index % 12)).padStart(2, '0')} ${String(9 + (index % 8)).padStart(2, '0')}:15`,
    }
  })
}

export const transferWaitHandoverSeed: TransferRow[] = makeTransferRows('WTH', ['待交出', '部分交出', '已交出'], 0)
export const transferHandoverSeed: TransferRow[] = makeTransferRows('TH', ['待交出', '部分交出', '已交出'], 0)
export const transferWaitInboundSeed: TransferRow[] = makeTransferRows('TWI', ['待审核', '已驳回', '确认通过', '待调拨'], 0)

// ===========================================================================
// 3. 原料条码（待上架 / 原料条码列表 同构共享）
// ===========================================================================

export interface BarcodeRow {
  id: string
  barcode: string
  relatedNo: string
  productionNo: string
  spu: string
  sku: string
  status: string
  inboundStatus: string
  rollNo: string
  rollLength: number
  weight: number
  gramWeight: number
  standardQty: number
  width: string
  warehouse: string
  whAttr: string
  location: string
  relateType: string
  inboundTime: string
  printer: string
  printTime: string
  batch: string
}

const BARCODE_SKUS = ['FLSZ-brown-19-1317PT', 'FLSZ-black-20-1402PT', 'RIB-gray-18-2201PT', 'CNIDML074-white', 'ACC-拉链-5号', 'YRN-涤纶-300D']
const BARCODE_PRINTERS = ['Rina', 'Dian', 'Siti', 'Mala']
// C1 待上架列表状态：草稿 / 待打印 / 待上架。
const PUTAWAY_STATUSES = ['草稿', '待打印', '待上架'] as const
// C2 原料条码列表状态。
const BARCODE_STATUSES = ['草稿', '待打印', '待上架', '已上架', '下架到待出库区', '已出库'] as const

function makeBarcodeRows(placed: boolean): BarcodeRow[] {
  return Array.from({ length: 16 }, (_, index): BarcodeRow => ({
    id: String(91000 + index),
    barcode: `BC2026101${String(100 + index).padStart(3, '0')}${placed ? 'P' : 'W'}`,
    relatedNo: index % 3 === 0 ? `CG-2026100${index % 9}-${String(100 + index)}` : `BC${5000 + index}`,
    productionNo: `PO${18100 + index}`,
    spu: `SPU-BC-${1000 + index}`,
    sku: BARCODE_SKUS[index % BARCODE_SKUS.length],
    status: placed ? BARCODE_STATUSES[index % BARCODE_STATUSES.length] : PUTAWAY_STATUSES[index % PUTAWAY_STATUSES.length],
    inboundStatus: placed ? '已入库' : '未入库',
    rollNo: `ROLL-${String(200 + index)}`,
    rollLength: 40 + (index % 6) * 10,
    weight: round1(12 + (index % 7) * 1.3),
    gramWeight: 160 + (index % 5) * 10,
    standardQty: 25 + (index % 4) * 5,
    width: `${150 + (index % 4) * 10} cm`,
    warehouse: RAW_WAREHOUSE_15[index % RAW_WAREHOUSE_15.length].name,
    whAttr: RAW_WAREHOUSE_15[index % RAW_WAREHOUSE_15.length].attr,
    location: `${index % 2 === 0 ? 'FAB' : 'TRM'}-${String.fromCharCode(65 + (index % 4))}-${String(1 + (index % 6)).padStart(2, '0')}`,
    relateType: (['自定义', '面辅料采购单', '印花单', '染色单', '水溶单', '面辅料采购单'])[index % 6],
    inboundTime: placed ? `2026-10-${String(1 + (index % 12)).padStart(2, '0')} 14:30` : '',
    printer: BARCODE_PRINTERS[index % BARCODE_PRINTERS.length],
    printTime: `2026-09-${String(1 + (index % 28)).padStart(2, '0')} 10:${index % 2 === 0 ? '10' : '40'}`,
    batch: `BATCH-20261${String(100 + (index % 6))}`,
  }))
}

export const rawPutawaySeed: BarcodeRow[] = makeBarcodeRows(false)
export const rawBarcodeSeed: BarcodeRow[] = makeBarcodeRows(true)

// ===========================================================================
// 4. 耗材出库列表
// ===========================================================================

export interface ConsumableOutboundRow {
  id: string
  outboundNo: string
  relatedNo: string
  spu: string
  sku: string
  productName: string
  warehouse: string
  warehouseAttr: string
  outboundType: string
  status: string
  time: string
}

const CONSUMABLE_PRODUCTS = [
  { name: '缝纫线-白色 40S', unit: '箱' },
  { name: '包装胶带-透明', unit: '卷' },
  { name: '吊牌-合格证', unit: '包' },
  { name: '不干胶标签-主标', unit: '包' },
  { name: '防潮珠-2g', unit: '包' },
  { name: '扎带-尼龙', unit: '包' },
]

export const consumableOutboundSeed: ConsumableOutboundRow[] = Array.from({ length: 16 }, (_, index): ConsumableOutboundRow => {
  const product = CONSUMABLE_PRODUCTS[index % CONSUMABLE_PRODUCTS.length]
  const status = (['待出库', '已出库', '已取消', '已出库'] as const)[index % 4]
  return {
    id: `CON-${100 + index}`,
    outboundNo: `YCK-CON-2026${String(1000 + index)}`,
    relatedNo: `LL-2026${String(200 + index)}`,
    spu: `SPU-CON-${1000 + index}`,
    sku: `SKU-CON-${5000 + index}`,
    productName: product.name,
    warehouse: RAW_WAREHOUSE_15[index % RAW_WAREHOUSE_15.length].name,
    warehouseAttr: RAW_WAREHOUSE_15[index % RAW_WAREHOUSE_15.length].attr,
    outboundType: index % 2 === 0 ? '耗材领料出库' : '耗材调拨出库',
    status,
    time: `2026-10-${String(1 + (index % 12)).padStart(2, '0')} ${String(9 + (index % 8)).padStart(2, '0')}:30`,
  }
})

// ===========================================================================
// 5. 原料移货
// ===========================================================================

export interface RawMoveRow {
  id: string
  moveNo: string
  warehouse: string
  materialType: string
  fromLocation: string
  toLocation: string
  totalQty: number
  totalRolls: number
  unit: string
  createTime: string
  completeTime: string
  status: string
  operator: string
}

const MOVE_WAREHOUSES = ['GT面料仓', 'holis面料仓', 'HILON-裁片仓', '面料中央仓']
const MOVE_MATERIALS = ['面料', '辅料', '耗材', '纱线', '包材']

export const rawMoveSeed: RawMoveRow[] = Array.from({ length: 16 }, (_, index): RawMoveRow => {
  const status = (['待处理', '部分完成', '已完成', '已驳回'] as const)[index % 4]
  const materialType = MOVE_MATERIALS[index % MOVE_MATERIALS.length]
  const unit = materialType === '面料' || materialType === '纱线' ? '卷' : materialType === '耗材' ? '箱' : '包'
  return {
    id: `MV-${200 + index}`,
    moveNo: `YH-2026${String(300 + index)}`,
    warehouse: MOVE_WAREHOUSES[index % MOVE_WAREHOUSES.length],
    materialType,
    fromLocation: `A-${String(1 + (index % 5)).padStart(2, '0')}-${String(1 + (index % 4)).padStart(2, '0')}`,
    toLocation: `B-${String(1 + (index % 5)).padStart(2, '0')}-${String(1 + (index % 4)).padStart(2, '0')}`,
    totalQty: 20 + (index % 6) * 5,
    totalRolls: 2 + (index % 7),
    unit,
    createTime: `2026-10-${String(1 + (index % 12)).padStart(2, '0')} ${String(8 + (index % 9)).padStart(2, '0')}:20`,
    completeTime: status === '已完成' ? `2026-10-${String(1 + (index % 12)).padStart(2, '0')} 17:40` : '-',
    status,
    operator: TRANSFER_APPLICANTS[index % TRANSFER_APPLICANTS.length],
  }
})

// ===========================================================================
// 6. 面料条码异常
// ===========================================================================

export interface BarcodeExceptionRow {
  id: string
  exceptionNo: string
  spu: string
  sku: string
  warehouse: string
  zone: string
  location: string
  handledRolls: number
  createdBy: string
  auditedBy: string
  handledBy: string
  status: string
  createTime: string
  auditTime: string
  doneTime: string
}

const EXCEPTION_WAREHOUSES = ['GT面料仓', 'holis面料仓', 'HILON-裁片仓', '面料中央仓', 'HILON-面料仓', 'GUDANG BARU-1']

export const barcodeExceptionSeed: BarcodeExceptionRow[] = Array.from({ length: 16 }, (_, index): BarcodeExceptionRow => {
  const status = (['待审核', '待处理', '处理完成', '已驳回'] as const)[index % 4]
  const day = String(1 + (index % 12)).padStart(2, '0')
  return {
    id: `EXC-${300 + index}`,
    exceptionNo: `YC-2026${String(700 + index)}`,
    spu: `SPU-EXC-${1000 + index}`,
    sku: BARCODE_SKUS[index % BARCODE_SKUS.length],
    warehouse: EXCEPTION_WAREHOUSES[index % EXCEPTION_WAREHOUSES.length],
    zone: index % 2 === 0 ? 'A区' : 'B区',
    location: `A-${String(1 + (index % 5)).padStart(2, '0')}-${String(1 + (index % 4)).padStart(2, '0')}`,
    handledRolls: 1 + (index % 5),
    createdBy: BARCODE_PRINTERS[index % BARCODE_PRINTERS.length],
    auditedBy: status === '待审核' ? '-' : '仓库主管',
    handledBy: status === '处理完成' ? BARCODE_PRINTERS[(index + 1) % BARCODE_PRINTERS.length] : '-',
    status,
    createTime: `2026-10-${day} 09:20`,
    auditTime: status === '待审核' ? '-' : `2026-10-${day} 11:00`,
    doneTime: status === '处理完成' ? `2026-10-${day} 15:30` : '-',
  }
})

// ===========================================================================
// 7. 面辅料库存监控（非单据配置页）
// ===========================================================================

export interface StockMonitorRow {
  id: string
  spu: string
  sku: string
  productName: string
  materialType: string
  image: string
  targetStock: number
  threshold: number
  unit: string
  stockStatus: string
  shortageCondition: string
  usage7d: number
  purchasing: number
  processing: number
  suggestedOrder: number
  needProcess: string
  process: string
  rawMaterial: string
  rawStock: number
  stock: number
}

const MONITOR_PRODUCTS = [
  { name: '莫代尔基础打底面料', type: '面料', image: '/materials/fabric-main.jpg' },
  { name: '精梳棉轻薄T恤面料', type: '面料', image: '/materials/fabric-contrast.jpg' },
  { name: '弹力罗纹针织面料', type: '面料', image: '/materials/fabric-lining.jpg' },
  { name: '磨毛保暖内搭面料', type: '面料', image: '/materials/fabric-main.jpg' },
  { name: '树脂纽扣-12mm', type: '辅料', image: '/materials/accessory-button.jpg' },
  { name: '金属拉链-20cm', type: '辅料', image: '/materials/accessory-zipper.jpg' },
]
const MONITOR_PROCESSES = ['染色', '印花', '水洗', '定型', '—', '—']

export const stockMonitorSeed: StockMonitorRow[] = Array.from({ length: 16 }, (_, index): StockMonitorRow => {
  const product = MONITOR_PRODUCTS[index % MONITOR_PRODUCTS.length]
  const targetStock = 800 + (index % 5) * 200
  const threshold = Math.round(targetStock * 0.3)
  const stock = 200 + (index % 6) * 180
  const usage7d = 60 + (index % 7) * 20
  const purchasing = index % 3 === 0 ? 400 : 0
  const processing = index % 4 === 0 ? 300 : 0
  const needProcess = product.type === '面料' && index % 2 === 0 ? '是' : '否'
  const stockStatus = stock + purchasing + processing < threshold ? '库存不足' : '库存充足'
  const suggested = stockStatus === '库存不足' ? Math.max(0, targetStock - stock - purchasing - processing) : 0
  return {
    id: `MON-${400 + index}`,
    spu: `SPU-MON-${1000 + index}`,
    sku: `SKU-MON-${5000 + index}`,
    productName: product.name,
    materialType: product.type,
    image: product.image,
    targetStock,
    threshold,
    unit: product.type === '面料' ? '米' : '颗',
    stockStatus,
    shortageCondition: `可用 < ${threshold} ${product.type === '面料' ? '米' : '颗'}`,
    usage7d,
    purchasing,
    processing,
    suggestedOrder: suggested,
    needProcess,
    process: needProcess === '是' ? MONITOR_PROCESSES[index % 4] : '—',
    rawMaterial: product.type === '面料' ? (index % 2 === 0 ? '坯布-32S' : '坯布-40S') : '—',
    rawStock: product.type === '面料' ? 300 + (index % 5) * 100 : 0,
    stock,
  }
})

export const WAREHOUSE_ATTR_OPTIONS = ['面料仓', '辅料仓', '纱线仓', '耗材仓', '包材仓', '中转仓'] as const
export const MATERIAL_TYPE_OPTIONS = ['面料', '辅料', '耗材', '纱线', '包材'] as const
