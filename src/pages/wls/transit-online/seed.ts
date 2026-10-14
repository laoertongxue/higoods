// ============================================================================
// WLS 中转仓在线页（Hilon 老中转仓 / Mahameru 新中转仓）演示种子
// 面料 SKU 采用原型 raw/transit 域既有命名口径（CNIDMLxxx-gexxxxxx）。
// 仓库命名与 src/data/fcs/dye-work-order-demo-details.ts 保持一致：
//   WH-BDG-005 中转仓（Sea Cutting，老中转仓 Hilon）
//   WH-BDG-009 中转仓（新裁床，新中转仓 Mahameru）
// 每条单据列表 16 条（标准分页 10/页 → 恰好 2 页）。
// ============================================================================

export interface TransitOnlineWarehouse {
  code: string
  name: string
}

export const transitOnlineWarehouses: Record<'hilon' | 'mahameru', TransitOnlineWarehouse> = {
  hilon: { code: 'WH-BDG-005', name: '中转仓（Sea Cutting）' },
  mahameru: { code: 'WH-BDG-009', name: '中转仓（新裁床）' },
}

export interface TransitOnlineLocation {
  locationCode: string
  area: string
  status: '空闲' | '占用'
  productionNo: string
  bindTime: string
  skuCount: number
  warehouse: string
}

function buildLocations(prefix: string, warehouse: string): TransitOnlineLocation[] {
  const areas = ['A', 'B', 'C']
  const occupied = [1, 2, 4, 6, 8, 9, 11, 13, 14, 16]
  return Array.from({ length: 16 }, (_, index) => {
    const seq = index + 1
    const area = areas[Math.floor(index / 6)] || 'C'
    const taken = occupied.includes(seq)
    return {
      locationCode: `${prefix}-${area}-${String(seq).padStart(2, '0')}`,
      area: `${prefix}-${area} 区`,
      status: taken ? '占用' : '空闲',
      productionNo: taken ? `PO${20101 + index}` : '—',
      bindTime: taken ? `2026-10-14 ${String(8 + (index % 9)).padStart(2, '0')}:${String((index * 7) % 60).padStart(2, '0')}` : '—',
      skuCount: taken ? 1 + (index % 3) : 0,
      warehouse,
    }
  })
}

export const mahameruLocationRows: TransitOnlineLocation[] = buildLocations('MH', transitOnlineWarehouses.mahameru.name)

// ── 上架单 / 作业单（同构）────────────────────────────────────────────────
export interface TransitOnlinePutawayRow {
  no: string
  location: string
  sku: string
  materialName: string
  receiveQty: number
  putawayQty: number
  status: '待上架' | '上架完成' | '已释放' | '已出库'
  time: string
  receiveNo: string
  productionNo: string
  inboundNo: string
  spu: string
}

const putawayStatuses: TransitOnlinePutawayRow['status'][] = [
  '待上架', '待上架', '待上架', '上架完成', '上架完成', '待上架', '已释放', '上架完成',
  '已出库', '待上架', '上架完成', '已释放', '待上架', '上架完成', '已出库', '上架完成',
]

const fabricPool: Array<{ sku: string; name: string; spu: string }> = [
  { sku: 'CNIDML002-ge001296', name: '150CM 锦棉皱', spu: 'SPU-FAB-1002' },
  { sku: 'CNIDML074-ge001031', name: '哥弟布-裤子面料', spu: 'SPU-FAB-1074' },
  { sku: 'CNIDML105-ge001422', name: '天丝棉 C2037', spu: 'SPU-FAB-1105' },
  { sku: 'CNIDML328-ge001508', name: '迈巴赫 S874', spu: 'SPU-FAB-1328' },
  { sku: 'CNIDML111-ge001377', name: '泡泡格 W886', spu: 'SPU-FAB-1111' },
  { sku: 'CNIDML359-ge001265', name: '棉感绉 C2032', spu: 'SPU-FAB-1359' },
]

const mahameruPutawayRows: TransitOnlinePutawayRow[] = Array.from({ length: 16 }, (_, index) => {
  const fabric = fabricPool[index % fabricPool.length]
  const seq = index + 1
  const received = 6 + (index % 8)
  const status = putawayStatuses[index]
  const done = status !== '待上架'
  return {
    no: `MH-PW-20261014-${String(seq).padStart(3, '0')}`,
    location: `MH-${['A', 'B', 'C'][index % 3]}-${String((index % 6) + 1).padStart(2, '0')}`,
    sku: fabric.sku,
    materialName: fabric.name,
    receiveQty: received,
    putawayQty: done ? received : 0,
    status,
    time: `2026-10-14 ${String(8 + (index % 10)).padStart(2, '0')}:${String((index * 11) % 60).padStart(2, '0')}`,
    receiveNo: `MH-RC-20261014-${String(seq).padStart(3, '0')}`,
    productionNo: `PO${20101 + index}`,
    inboundNo: `MH-IN-20261014-${String(seq).padStart(3, '0')}`,
    spu: fabric.spu,
  }
})

export const mahameruPutawaySeed: TransitOnlinePutawayRow[] = mahameruPutawayRows
export const mahameruWorkSeed: TransitOnlinePutawayRow[] = mahameruPutawayRows

// ── 中转仓库存 ─────────────────────────────────────────────────────────
export interface TransitOnlineInventoryRow {
  productionNo: string
  sku: string
  area: string
  location: string
  pendingQty: number
  shelfQty: number
  outboundQty: number
  warehouse: string
  status: '待上架' | '已上架' | '已出库'
  updateTime: string
  materialName: string
  spu: string
}

const inventoryStatuses: TransitOnlineInventoryRow['status'][] = [
  '待上架', '已上架', '已上架', '待上架', '已出库', '已上架', '待上架', '已上架',
  '已上架', '已出库', '待上架', '已上架', '已上架', '待上架', '已上架', '已出库',
]

export const mahameruInventorySeed: TransitOnlineInventoryRow[] = Array.from({ length: 16 }, (_, index) => {
  const fabric = fabricPool[index % fabricPool.length]
  const status = inventoryStatuses[index]
  return {
    productionNo: `PO${20101 + index}`,
    sku: fabric.sku,
    area: `MH-${['A', 'B', 'C'][index % 3]} 区`,
    location: `MH-${['A', 'B', 'C'][index % 3]}-${String((index % 6) + 1).padStart(2, '0')}`,
    pendingQty: status === '待上架' ? 4 + (index % 5) : 0,
    shelfQty: status === '已上架' ? 6 + (index % 7) : status === '已出库' ? 2 + (index % 3) : 0,
    outboundQty: status === '已出库' ? 4 + (index % 5) : 0,
    warehouse: transitOnlineWarehouses.mahameru.name,
    status,
    updateTime: `2026-10-14 ${String(9 + (index % 9)).padStart(2, '0')}:${String((index * 13) % 60).padStart(2, '0')}`,
    materialName: fabric.name,
    spu: fabric.spu,
  }
})

// ── 生产单校验 ─────────────────────────────────────────────────────────
export interface TransitOnlineKitRow {
  productionNo: string
  satisfied: '满足' | '不满足'
  sku: string
  materialName: string
  fabricType: string
  requiredQty: number
  workAreaQty: number
  shelfQty: number
  totalQty: number
  shortageRate: string
  location: string
  updateTime: string
  spu: string
}

export const mahameruKitSeed: TransitOnlineKitRow[] = Array.from({ length: 16 }, (_, index) => {
  const fabric = fabricPool[index % fabricPool.length]
  const required = 10 + (index % 9)
  const total = index % 4 === 0 ? required - 2 - (index % 3) : required
  const satisfied: TransitOnlineKitRow['satisfied'] = total >= required ? '满足' : '不满足'
  const short = Math.max(0, required - total)
  return {
    productionNo: `PO${20101 + index}`,
    satisfied,
    sku: fabric.sku,
    materialName: fabric.name,
    fabricType: index % 3 === 0 ? '主身面料' : index % 3 === 1 ? '配色面料' : '辅料',
    requiredQty: required,
    workAreaQty: Math.min(total, 3 + (index % 4)),
    shelfQty: total - Math.min(total, 3 + (index % 4)),
    totalQty: total,
    shortageRate: short === 0 ? '0%' : `${Math.round((short / required) * 100)}%`,
    location: `MH-${['A', 'B', 'C'][index % 3]}-${String((index % 6) + 1).padStart(2, '0')}`,
    updateTime: `2026-10-14 ${String(8 + (index % 10)).padStart(2, '0')}:${String((index * 17) % 60).padStart(2, '0')}`,
    spu: fabric.spu,
  }
})

// ── 中转配料单 ─────────────────────────────────────────────────────────
export interface TransitOnlineAllocationRow {
  no: string
  allocationType: string
  sku: string
  materialName: string
  planQty: number
  actualQty: number
  workAreaQty: number
  shelfQty: number
  warehouseQty: number
  flowStatus: '待配料' | '已配料'
  taskStatus: string
  createTime: string
  receiveNo: string
  inboundNo: string
  productionNo: string
}

export const mahameruAllocationSeed: TransitOnlineAllocationRow[] = Array.from({ length: 16 }, (_, index) => {
  const fabric = fabricPool[index % fabricPool.length]
  const plan = 8 + (index % 8)
  const done = index % 3 !== 0
  return {
    no: `MH-AL-20261014-${String(index + 1).padStart(3, '0')}`,
    allocationType: index % 2 === 0 ? '整卷配料' : '拆卷配料',
    sku: fabric.sku,
    materialName: fabric.name,
    planQty: plan,
    actualQty: done ? plan - (index % 2) : 0,
    workAreaQty: 2 + (index % 4),
    shelfQty: done ? 4 + (index % 5) : 0,
    warehouseQty: 6 + (index % 6),
    flowStatus: done ? '已配料' : '待配料',
    taskStatus: done ? '已配齐' : '待配齐',
    createTime: `2026-10-14 ${String(8 + (index % 10)).padStart(2, '0')}:${String((index * 19) % 60).padStart(2, '0')}`,
    receiveNo: `MH-RC-20261014-${String(index + 1).padStart(3, '0')}`,
    inboundNo: `MH-IN-20261014-${String(index + 1).padStart(3, '0')}`,
    productionNo: `PO${20101 + index}`,
  }
})

// ── 中转出库单 ─────────────────────────────────────────────────────────
export interface TransitOnlineOutboundRow {
  no: string
  status: '待出库' | '已领料' | '已取消' | '已出库'
  sku: string
  materialName: string
  planQty: number
  allocationQty: number
  actualQty: number
  time: string
  productionNo: string
}

const outboundStatuses: TransitOnlineOutboundRow['status'][] = [
  '待出库', '已领料', '已出库', '待出库', '已取消', '已领料', '待出库', '已出库',
  '已领料', '待出库', '已出库', '已取消', '待出库', '已领料', '已出库', '待出库',
]

export const mahameruOutboundSeed: TransitOnlineOutboundRow[] = Array.from({ length: 16 }, (_, index) => {
  const fabric = fabricPool[index % fabricPool.length]
  const plan = 8 + (index % 8)
  const status = outboundStatuses[index]
  return {
    no: `MH-OUT-20261014-${String(index + 1).padStart(3, '0')}`,
    status,
    sku: fabric.sku,
    materialName: fabric.name,
    planQty: plan,
    allocationQty: status === '待出库' ? 0 : plan - (index % 2),
    actualQty: status === '已出库' ? plan : 0,
    time: `2026-10-14 ${String(8 + (index % 10)).padStart(2, '0')}:${String((index * 23) % 60).padStart(2, '0')}`,
    productionNo: `PO${20101 + index}`,
  }
})

// ── 预入库单（含创建入库单）─────────────────────────────────────────────
export interface TransitOnlineInboundRow {
  no: string
  sku: string
  materialName: string
  docType: string
  status: '待收货' | '部分收货' | '收货完成' | '已取消'
  source: string
  expectedQty: number
  time: string
  productionNo: string
  spu: string
  receiveNo: string
  productionOrderNo: string
  demandNo: string
  packageCount: number
}

const inboundStatuses: TransitOnlineInboundRow['status'][] = [
  '待收货', '部分收货', '收货完成', '待收货', '收货完成', '部分收货', '待收货', '已取消',
  '收货完成', '部分收货', '待收货', '收货完成', '部分收货', '待收货', '收货完成', '待收货',
]
const docTypes = ['申请调拨', '染色交出', '印花交出', '绣花交出']

export const mahameruInboundSeed: TransitOnlineInboundRow[] = Array.from({ length: 16 }, (_, index) => {
  const fabric = fabricPool[index % fabricPool.length]
  const expected = 6 + (index % 9)
  return {
    no: `MH-IN-20261014-${String(index + 1).padStart(3, '0')}`,
    sku: fabric.sku,
    materialName: fabric.name,
    docType: docTypes[index % docTypes.length],
    status: inboundStatuses[index],
    source: index % 2 === 0 ? '印花厂' : '染色厂',
    expectedQty: expected,
    time: `2026-10-14 ${String(8 + (index % 10)).padStart(2, '0')}:${String((index * 29) % 60).padStart(2, '0')}`,
    productionNo: `PO${20101 + index}`,
    spu: fabric.spu,
    receiveNo: `MH-RC-20261014-${String(index + 1).padStart(3, '0')}`,
    productionOrderNo: `PO${20101 + index}`,
    demandNo: `DM-20261014-${String(index + 1).padStart(3, '0')}`,
    packageCount: 2 + (index % 4),
  }
})

// ── 收货单（多层展开：明细 / 配货 / 上架）───────────────────────────────
export interface TransitOnlineReceivedDetail {
  sku: string
  materialName: string
  expectedQty: number
  actualQty: number
  allocationQty: number
  putawayQty: number
  rollCount: number
}

export interface TransitOnlineReceivedRow {
  receiveNo: string
  sourceNo: string
  demandNo: string
  productionNo: string
  sku: string
  materialName: string
  expectedQty: number
  actualQty: number
  receiveStatus: '待收货' | '收货完成'
  kitType: string
  taskStatus: '待处理' | '未配齐' | '已配齐'
  details: TransitOnlineReceivedDetail[]
}

const receivedTaskStatuses: TransitOnlineReceivedRow['taskStatus'][] = [
  '待处理', '已配齐', '未配齐', '待处理', '已配齐', '未配齐', '待处理', '已配齐',
  '未配齐', '待处理', '已配齐', '未配齐', '待处理', '已配齐', '未配齐', '待处理',
]

export const mahameruReceivedSeed: TransitOnlineReceivedRow[] = Array.from({ length: 16 }, (_, index) => {
  const fabric = fabricPool[index % fabricPool.length]
  const fabric2 = fabricPool[(index + 2) % fabricPool.length]
  const expected = 6 + (index % 9)
  const receiveStatus: TransitOnlineReceivedRow['receiveStatus'] = index % 4 === 3 ? '待收货' : '收货完成'
  const actual = receiveStatus === '待收货' ? 0 : Math.max(1, expected - (index % 3))
  const taskStatus = receivedTaskStatuses[index]
  return {
    receiveNo: `MH-RC-20261014-${String(index + 1).padStart(3, '0')}`,
    sourceNo: `MH-IN-20261014-${String(index + 1).padStart(3, '0')}`,
    demandNo: `DM-20261014-${String(index + 1).padStart(3, '0')}`,
    productionNo: `PO${20101 + index}`,
    sku: fabric.sku,
    materialName: fabric.name,
    expectedQty: expected,
    actualQty: actual,
    receiveStatus,
    kitType: actual === 0 ? '—' : actual >= expected ? (taskStatus === '已配齐' ? '已配齐' : '已配齐（需配货）') : '未配齐',
    taskStatus,
    details: [
      { sku: fabric.sku, materialName: fabric.name, expectedQty: expected - 2, actualQty: Math.max(0, actual - 2), allocationQty: taskStatus === '待处理' ? 0 : 1, putawayQty: taskStatus === '已配齐' ? 1 : 0, rollCount: 1 + (index % 3) },
      { sku: fabric2.sku, materialName: fabric2.name, expectedQty: 2, actualQty: actual === 0 ? 0 : 2, allocationQty: taskStatus === '待处理' ? 0 : 2, putawayQty: taskStatus === '已配齐' ? 2 : 0, rollCount: 1 },
    ],
  }
})

// ── 裁片配料 All（老中转仓 / 新中转仓同构）──────────────────────────────
export interface TransitOnlineCuttingAllDetail {
  sku: string
  materialType: string
  name: string
  source: string
  dyeStatus: string
  inventory: number
  planQty: number
  allocationQty: number
  pendingQty: number
}

export interface TransitOnlineCuttingAllRow {
  sku: string
  materialType: string
  image: string
  name: string
  source: string
  dyeStatus: string
  inventory: number
  planQty: number
  allocationQty: number
  allocationRolls: number
  pickupQty: number
  pickupRolls: number
  pendingQty: number
  productionNo: string
  taskNo: string
  allocationNo: string
  demandNo: string
  spu: string
  hasSupplement: '是' | '否'
  materialIsFull: '齐全' | '不齐全'
  isAccessoryCut: '是' | '否'
  disassembleStatus: '未拆解' | '已拆解'
  sellType: string
  dyeDemand: string
  cuttingFactory: string
  createdAt: string
  prepAt: string
  pickAt: string
  demandAt: string
  productionAt: string
  remark: string
  details: TransitOnlineCuttingAllDetail[]
}

const dyeStatusPool = ['白坯', '已染色', '已印花', '待印染', '已定型']
const materialTypes = ['面料', '辅料']
const fabricImagePool = ['/materials/fabric-main.jpg', '/materials/fabric-contrast.jpg', '/materials/fabric-lining.jpg']
const accessoryImagePool = ['/materials/accessory-button.jpg', '/materials/accessory-zipper.jpg', '/materials/accessory-elastic-band.jpg', '/materials/accessory-label.jpg']
const sellTypePool = ['内销', '外销', '样衣', '大货', '返单', '补单', '预售', '现货', '清仓', '定制']
const dyeDemandPool = ['白坯', '染色', '印花', '绣花', '压皱', '水洗', '定型', '免烫']
// 裁床工厂筛选（与生产配料管理的「工厂×2」对应：工厂 + 裁床工厂）。
const cuttingFactoryPool = ['Sea Cutting', '锦华裁床', '新达水洗']
export const cuttingAllCuttingFactoryOptions = ['全部', ...cuttingFactoryPool]

function buildCuttingAllRows(scope: 'hilon' | 'mahameru'): TransitOnlineCuttingAllRow[] {
  const prefix = scope === 'hilon' ? 'CA-HL' : 'CA-MH'
  return Array.from({ length: 16 }, (_, index) => {
    const fabric = fabricPool[index % fabricPool.length]
    const fabric2 = fabricPool[(index + 3) % fabricPool.length]
    const plan = 8 + (index % 9)
    const allocated = index % 3 === 0 ? 0 : Math.max(1, plan - (index % 4))
    const materialType = materialTypes[index % 2]
    const image =
      materialType === '面料'
        ? fabricImagePool[index % fabricImagePool.length]
        : accessoryImagePool[index % accessoryImagePool.length]
    return {
      sku: fabric.sku,
      materialType,
      image,
      name: fabric.name,
      source: index % 2 === 0 ? '印花厂' : '染色厂',
      dyeStatus: dyeStatusPool[index % dyeStatusPool.length],
      inventory: 20 + (index % 20),
      planQty: plan,
      allocationQty: allocated,
      allocationRolls: allocated === 0 ? 0 : 1 + (index % 3),
      pickupQty: index % 4 === 0 ? 0 : allocated,
      pickupRolls: index % 4 === 0 ? 0 : 1 + (index % 2),
      pendingQty: Math.max(0, plan - allocated),
      productionNo: `PO${20101 + index}`,
      taskNo: `${prefix}-TASK-${String(index + 1).padStart(3, '0')}`,
      allocationNo: `${prefix}-20261014-${String(index + 1).padStart(3, '0')}`,
      demandNo: `DM-20261014-${String(index + 1).padStart(3, '0')}`,
      spu: fabric.spu,
      hasSupplement: index % 5 === 0 ? '是' : '否',
      materialIsFull: allocated >= plan ? '齐全' : '不齐全',
      isAccessoryCut: index % 3 === 0 ? '是' : '否',
      disassembleStatus: index % 2 === 0 ? '已拆解' : '未拆解',
      sellType: sellTypePool[index % sellTypePool.length],
      dyeDemand: dyeDemandPool[index % dyeDemandPool.length],
      cuttingFactory: cuttingFactoryPool[index % cuttingFactoryPool.length],
      createdAt: `2026-10-${String(5 + (index % 10)).padStart(2, '0')} 09:00`,
      prepAt: allocated === 0 ? '—' : `2026-10-${String(6 + (index % 9)).padStart(2, '0')} 10:20`,
      pickAt: index % 4 === 0 ? '—' : `2026-10-${String(7 + (index % 8)).padStart(2, '0')} 11:40`,
      demandAt: `2026-10-${String(1 + (index % 12)).padStart(2, '0')} 08:00`,
      productionAt: `2026-10-${String(2 + (index % 12)).padStart(2, '0')} 08:30`,
      remark: index % 4 === 0 ? '补料需求待确认' : '',
      details: [
        { sku: fabric.sku, materialType: '面料', name: fabric.name, source: index % 2 === 0 ? '印花厂' : '染色厂', dyeStatus: dyeStatusPool[index % dyeStatusPool.length], inventory: 20 + (index % 20), planQty: plan, allocationQty: allocated, pendingQty: Math.max(0, plan - allocated) },
        { sku: fabric2.sku, materialType: '辅料', name: `${fabric2.name} 辅料包`, source: '辅料仓', dyeStatus: '—', inventory: 10 + (index % 8), planQty: 1 + (index % 2), allocationQty: index % 3 === 0 ? 0 : 1, pendingQty: index % 3 === 0 ? 1 : 0 },
      ],
    }
  })
}

export const hilonCuttingAllSeed: TransitOnlineCuttingAllRow[] = buildCuttingAllRows('hilon')
export const mahameruCuttingSeed: TransitOnlineCuttingAllRow[] = buildCuttingAllRows('mahameru')

// ── 裁片任务分配（老中转仓 / 新中转仓同构）─────────────────────────────
export interface TransitOnlineCuttingFactoryRow {
  taskObject: string
  taskContent: string
  qty: number
  followUp: string
  assignmentInfo: string
  dispatchTime: string
  acceptDeadline: string
  taskDeadline: string
  price: string
  assignmentStatus: '待分配' | '竞价中' | '已定标' | '已直接派单'
  assignmentMode: '人工直接派单' | '竞价'
  productionNo: string
  outboundNo: string
  allocationNo: string
  processStation: string
  process: string
  factory: string
}

// 承接工厂按仓库上下文区分：老中转仓 Hilon 限 sea cutting / sea-PPIC，
// 新中转仓 Mahameru 限 sea cutting / sea2-PPIC（group8 行80、group9 行19/24）。
const cuttingFactoryNames: Record<'hilon' | 'mahameru', string[]> = {
  hilon: ['sea cutting', 'sea-PPIC'],
  mahameru: ['sea cutting', 'sea2-PPIC'],
}
// 工序 / 工艺下拉各 40+ 项（含代码），与测试环境规格一致（group8 行81）。
const processStationNames = [
  '裁剪(CUT)', '粘衬(FUSE)', '绣花(EMB)', '印花(PRINT)', '水洗(WASH)', '染色(DYE)', '压皱(PLEAT)',
  '打钉(RIVET)', '锁眼(BUTTONHOLE)', '钉扣(BUTTON)', '套结(BARTACK)', '拷边(OVERLOCK)', '绷缝(COVERSTITCH)',
  '平车(PLAIN)', '包缝(SAFETY)', '毛织(KNIT)', '织带(WEBBING)', '烫包(PRESS)', '后道质检(QC)', '熨烫(IRON)',
  '包装(PACK)', '挂牌(TAG)', '验针(NEEDLE)', '整烫(FINISH)', '开袋(POCKET)', '装领(COLLAR)', '装袖(SLEEVE)',
  '装拉链(ZIPPER)', '装腰(WAIST)', '拼缝(SEAM)', '车缝(SEW)', '手工(HAND)', '点胶(GLUE)', '打枣(BARTACK2)',
  '通肩(SHOULDER)', '卷边(HEM)', '开扣眼(GROMMET)', '织补(MENDING)', '补强(REINFORCE)', '过检(INSPECT)',
  '封样(SAMPLE)', '裁片修边(TRIM)',
]
const processNames = [
  '其它(OTH)', '渐变染(OMB)', '乱染(TDY)', '成衣染(GDY)', '匹染(PDY)', '定位印(REGISTER_PRINT)',
  '定向印(TARGET_PRINT)', '数码印(DIGITAL_PRINT)', '转移印(TRANSFER_PRINT)', '水浆印(PIGMENT)', '胶浆印(RUBBER)',
  '拔印(DISCHARGE)', '烂花(BURNOUT)', '压花(EMBOSS)', '烫金(FOIL)', '植绒(FLOCK)', '绣花(EMB)', '珠绣(BEAD)',
  '亮片(SEQUIN)', '打褶(PLEAT)', '压皱(CRINKLE)', '水洗(WASH)', '石洗(STONE_WASH)', '酵素洗(ENZYME)',
  '砂洗(SAND_WASH)', '雪洗(SNOW_WASH)', '烫钻(RHINESTONE)', '扎染(TIE_DYE)', '蜡染(BATIK)', '涂料染(PIGMENT_DYE)',
  '活性染(REACTIVE)', '酸性染(ACID)', '分散染(DISPERSE)', '直接染(DIRECT)', '阳离子染(CATIONIC)', '硫化染(SULPHUR)',
  '还原染(VAT)', '涂料印花(PIGMENT_PRINT)', '转移印花(TRANSFER_PRINT2)', '烫画(HEAT_PRINT)', '贴布绣(APPLIQUE)',
]
const assignmentStatuses: TransitOnlineCuttingFactoryRow['assignmentStatus'][] = [
  '待分配', '竞价中', '已定标', '已直接派单', '待分配', '竞价中', '已定标', '已直接派单',
  '待分配', '竞价中', '已定标', '已直接派单', '待分配', '竞价中', '已定标', '待分配',
]

function buildCuttingFactoryRows(scope: 'hilon' | 'mahameru'): TransitOnlineCuttingFactoryRow[] {
  const prefix = scope === 'hilon' ? 'CT-HL' : 'CT-MH'
  const factoryNames = cuttingFactoryNames[scope]
  return Array.from({ length: 16 }, (_, index) => {
    const fabric = fabricPool[index % fabricPool.length]
    const status = assignmentStatuses[index]
    const mode: TransitOnlineCuttingFactoryRow['assignmentMode'] = status === '竞价中' || status === '已定标' ? '竞价' : '人工直接派单'
    return {
      taskObject: `PO${20101 + index} / ${fabric.name}`,
      taskContent: `裁片加工 ${2 + (index % 4)} 项`,
      qty: 40 + (index % 120),
      followUp: index % 3 === 0 ? '跟单-小林' : index % 3 === 1 ? '跟单-阿伟' : '跟单-Sari',
      assignmentInfo: status === '待分配' ? '待分配' : `${index % 2 === 0 ? '人工派单' : '竞价'} · ${factoryNames[index % factoryNames.length]}`,
      dispatchTime: status === '待分配' ? '—' : `2026-10-14 ${String(9 + (index % 8)).padStart(2, '0')}:00`,
      acceptDeadline: status === '待分配' ? '—' : '2026-10-15 12:00',
      taskDeadline: status === '待分配' ? '—' : '2026-10-17 18:00',
      price: status === '待分配' ? '—' : `¥${(3 + (index % 9)) * 1.5}`,
      assignmentStatus: status,
      assignmentMode: mode,
      productionNo: `PO${20101 + index}`,
      outboundNo: `${prefix}-OUT-${String(index + 1).padStart(3, '0')}`,
      allocationNo: `${scope === 'hilon' ? 'CA-HL' : 'CA-MH'}-20261014-${String(index + 1).padStart(3, '0')}`,
      processStation: processStationNames[index % processStationNames.length],
      process: processNames[index % processNames.length],
      factory: factoryNames[index % factoryNames.length],
    }
  })
}

export const hilonCuttingFactorySeed: TransitOnlineCuttingFactoryRow[] = buildCuttingFactoryRows('hilon')
export const mahameruCuttingFactorySeed: TransitOnlineCuttingFactoryRow[] = buildCuttingFactoryRows('mahameru')

// 分配状态 / 加工工序下拉选项（与测试环境规格一致）
export const cuttingAssignmentStatusOptions = ['全部', '待分配', '竞价中', '已定标', '已直接派单']
export const cuttingAssignmentModeOptions = ['全部', '人工直接派单', '竞价']
export const cuttingProcessStationOptions = ['全部', ...processStationNames]
export const cuttingProcessOptions = ['全部', ...processNames]
export const hilonCuttingFactoryOptions = ['全部', ...cuttingFactoryNames.hilon]
export const mahameruCuttingFactoryOptions = ['全部', ...cuttingFactoryNames.mahameru]
