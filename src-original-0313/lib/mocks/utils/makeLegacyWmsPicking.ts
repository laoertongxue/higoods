/**
 * 领料单/配料单 Mock 数据生成器
 * 使用 mulberry32 算法生成稳定可复现的伪随机数据
 */

// mulberry32 伪随机数生成器
function mulberry32(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// 哈希字符串为数字（用于生成稳定 seed）
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

// 配料单状态
export type PickingStatus = 'NOT_CREATED' | 'CREATED' | 'PICKING' | 'PARTIAL' | 'COMPLETED' | 'CANCELLED'

// 缺口原因码
export type ShortageReasonCode = 'INSUFFICIENT_STOCK' | 'NOT_RECEIVED' | 'QC_FAILED' | 'FROZEN' | 'UNKNOWN'

// 配料明细行
export interface PickingLine {
  lineId: string
  pickId: string
  materialCode: string
  materialName: string
  specification: string
  uom: string
  requiredQty: number
  pickedQty: number
  shortQty: number
  reasonCode?: ShortageReasonCode
  location?: string
}

// 配料单
export interface PickingOrder {
  pickId: string
  poId: string
  warehouseId: string
  warehouseName: string
  status: PickingStatus
  fulfillmentRate: number
  shortLineCount: number
  createdAt: string
  updatedAt: string
}

// 生产单摘要
export interface PoSummary {
  poId: string
  legacyOrderNo: string
  spuCode: string
  spuName: string
  mainFactoryName: string
  requiredDeliveryDate: string
  materialReadyStatus: 'NOT_CREATED' | 'CREATED' | 'PICKING' | 'PARTIAL' | 'COMPLETED'
}

// 仓库列表
const WAREHOUSES = [
  { id: 'WH-JKT-01', name: '雅加达中心仓' },
  { id: 'WH-TNG-01', name: '丹格朗仓库' },
  { id: 'WH-BKS-01', name: '勿加泗仓库' },
  { id: 'WH-BDG-01', name: '万隆仓库' },
]

// 物料列表
const MATERIALS = [
  { code: 'FAB-001', name: '棉布-白色', spec: '150cm/100g/㎡', uom: '米' },
  { code: 'FAB-002', name: '涤纶面料-黑色', spec: '140cm/120g/㎡', uom: '米' },
  { code: 'FAB-003', name: '真丝面料-红色', spec: '110cm/80g/㎡', uom: '米' },
  { code: 'THR-001', name: '缝纫线-白色', spec: '40/2', uom: '卷' },
  { code: 'THR-002', name: '缝纫线-黑色', spec: '40/2', uom: '卷' },
  { code: 'BTN-001', name: '四孔纽扣-白色', spec: '12mm', uom: '颗' },
  { code: 'BTN-002', name: '四孔纽扣-黑色', spec: '15mm', uom: '颗' },
  { code: 'ZIP-001', name: '金属拉链-银色', spec: '20cm', uom: '条' },
  { code: 'ZIP-002', name: '隐形拉链-黑色', spec: '50cm', uom: '条' },
  { code: 'LBL-001', name: '主标签', spec: '3cm×5cm', uom: '张' },
  { code: 'LBL-002', name: '洗水标', spec: '2cm×4cm', uom: '张' },
  { code: 'PKG-001', name: 'OPP袋', spec: '30×40cm', uom: '个' },
  { code: 'INT-001', name: '衬布', spec: '90cm', uom: '米' },
  { code: 'ELA-001', name: '松紧带', spec: '2.5cm宽', uom: '米' },
  { code: 'PAD-001', name: '垫肩', spec: '标准', uom: '对' },
]

// 缺口原因列表
const REASON_CODES: ShortageReasonCode[] = ['INSUFFICIENT_STOCK', 'NOT_RECEIVED', 'QC_FAILED', 'FROZEN', 'UNKNOWN']

/**
 * 生成配料单明细行
 */
export function makePickingLines(pickId: string, seed?: number): PickingLine[] {
  const finalSeed = seed ?? hashString(pickId)
  const rand = mulberry32(finalSeed)
  
  // 生成 15-20 条明细行
  const lineCount = 15 + Math.floor(rand() * 6)
  const lines: PickingLine[] = []
  
  // 随机选择物料（不重复）
  const shuffledMaterials = [...MATERIALS].sort(() => rand() - 0.5).slice(0, lineCount)
  
  // 确定有缺口的行数（3-6条）
  const shortCount = 3 + Math.floor(rand() * 4)
  const shortIndices = new Set<number>()
  while (shortIndices.size < shortCount) {
    shortIndices.add(Math.floor(rand() * lineCount))
  }
  
  // 确保原因码覆盖至少3种
  const usedReasons: ShortageReasonCode[] = []
  const shortIndicesArr = Array.from(shortIndices)
  
  for (let i = 0; i < lineCount; i++) {
    const material = shuffledMaterials[i % shuffledMaterials.length]
    const requiredQty = 50 + Math.floor(rand() * 450)
    
    let pickedQty = requiredQty
    let shortQty = 0
    let reasonCode: ShortageReasonCode | undefined
    
    if (shortIndices.has(i)) {
      const shortIdx = shortIndicesArr.indexOf(i)
      // 前3个使用不同原因码
      if (shortIdx < 3) {
        reasonCode = REASON_CODES[shortIdx]
      } else {
        reasonCode = REASON_CODES[Math.floor(rand() * REASON_CODES.length)]
      }
      usedReasons.push(reasonCode)
      shortQty = Math.floor(rand() * (requiredQty * 0.5)) + 1
      pickedQty = requiredQty - shortQty
    }
    
    lines.push({
      lineId: `${pickId}-L${String(i + 1).padStart(3, '0')}`,
      pickId,
      materialCode: material.code,
      materialName: material.name,
      specification: material.spec,
      uom: material.uom,
      requiredQty,
      pickedQty,
      shortQty,
      reasonCode,
      location: `A${Math.floor(rand() * 10) + 1}-${Math.floor(rand() * 20) + 1}`,
    })
  }
  
  return lines
}

/**
 * 生成生产单的配料单列表
 */
export function makePickingOrdersForPo(poId: string, seed?: number): PickingOrder[] {
  const finalSeed = seed ?? hashString(poId)
  const rand = mulberry32(finalSeed)
  
  // 每个生产单生成 3-5 张配料单，确保覆盖不同状态
  const statuses: PickingStatus[] = ['CREATED', 'PICKING', 'PARTIAL', 'COMPLETED']
  const orders: PickingOrder[] = []
  
  // 确保每种状态至少一张
  for (let i = 0; i < statuses.length; i++) {
    const pickId = `PK-${poId.replace('PO-', '')}-${String(i + 1).padStart(2, '0')}`
    const warehouse = WAREHOUSES[i % WAREHOUSES.length]
    const status = statuses[i]
    
    // 生成对应的明细行以计算配齐率
    const lines = makePickingLines(pickId, finalSeed + i)
    const totalRequired = lines.reduce((sum, l) => sum + l.requiredQty, 0)
    const totalPicked = lines.reduce((sum, l) => sum + Math.min(l.pickedQty, l.requiredQty), 0)
    const fulfillmentRate = totalRequired > 0 ? Math.round((totalPicked / totalRequired) * 100) : 0
    const shortLineCount = lines.filter(l => l.shortQty > 0).length
    
    // 根据状态调整配齐率
    let adjustedRate = fulfillmentRate
    if (status === 'COMPLETED') adjustedRate = 100
    if (status === 'CREATED') adjustedRate = 0
    if (status === 'PICKING') adjustedRate = Math.min(adjustedRate, 60)
    if (status === 'PARTIAL') adjustedRate = Math.max(70, Math.min(adjustedRate, 95))
    
    const baseDate = new Date('2026-03-01')
    const createdAt = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000)
    const updatedAt = new Date(createdAt.getTime() + Math.floor(rand() * 48) * 60 * 60 * 1000)
    
    orders.push({
      pickId,
      poId,
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      status,
      fulfillmentRate: adjustedRate,
      shortLineCount: status === 'COMPLETED' ? 0 : shortLineCount,
      createdAt: createdAt.toISOString().replace('T', ' ').slice(0, 19),
      updatedAt: updatedAt.toISOString().replace('T', ' ').slice(0, 19),
    })
  }
  
  // 可能再加一张随机状态的配料单
  if (rand() > 0.3) {
    const pickId = `PK-${poId.replace('PO-', '')}-05`
    const warehouse = WAREHOUSES[Math.floor(rand() * WAREHOUSES.length)]
    const status = statuses[Math.floor(rand() * statuses.length)]
    const lines = makePickingLines(pickId, finalSeed + 100)
    const totalRequired = lines.reduce((sum, l) => sum + l.requiredQty, 0)
    const totalPicked = lines.reduce((sum, l) => sum + Math.min(l.pickedQty, l.requiredQty), 0)
    const fulfillmentRate = totalRequired > 0 ? Math.round((totalPicked / totalRequired) * 100) : 0
    
    orders.push({
      pickId,
      poId,
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      status,
      fulfillmentRate: status === 'COMPLETED' ? 100 : (status === 'CREATED' ? 0 : fulfillmentRate),
      shortLineCount: status === 'COMPLETED' ? 0 : lines.filter(l => l.shortQty > 0).length,
      createdAt: '2026-03-04 10:00:00',
      updatedAt: '2026-03-04 15:30:00',
    })
  }
  
  return orders
}

/**
 * 生成生产单摘要
 */
export function makePoSummary(poId: string, seed?: number): PoSummary {
  const finalSeed = seed ?? hashString(poId)
  const rand = mulberry32(finalSeed)
  
  // 获取该 PO 的配料单
  const pickingOrders = makePickingOrdersForPo(poId, finalSeed)
  
  // 计算物料就绪状态
  let materialReadyStatus: PoSummary['materialReadyStatus'] = 'NOT_CREATED'
  if (pickingOrders.length > 0) {
    const hasShortage = pickingOrders.some(o => o.shortLineCount > 0)
    const allCompleted = pickingOrders.every(o => o.status === 'COMPLETED')
    const hasPicking = pickingOrders.some(o => o.status === 'PICKING')
    
    if (allCompleted && !hasShortage) {
      materialReadyStatus = 'COMPLETED'
    } else if (hasShortage) {
      materialReadyStatus = 'PARTIAL'
    } else if (hasPicking) {
      materialReadyStatus = 'PICKING'
    } else {
      materialReadyStatus = 'CREATED'
    }
  }
  
  const spuCodes = ['SPU-SHIRT-001', 'SPU-DRESS-002', 'SPU-JACKET-003', 'SPU-PANTS-004', 'SPU-COAT-005']
  const spuNames = ['基础款衬衫', '夏季连衣裙', '休闲夹克', '商务西裤', '羊毛大衣']
  const factories = ['Jakarta Central Factory', 'Tangerang Satellite', 'Bekasi Sewing Hub', 'Bandung Print House']
  
  const idx = Math.floor(rand() * spuCodes.length)
  const factoryIdx = Math.floor(rand() * factories.length)
  
  const deliveryDate = new Date('2026-03-15')
  deliveryDate.setDate(deliveryDate.getDate() + Math.floor(rand() * 30))
  
  return {
    poId,
    legacyOrderNo: `OLD-${poId.replace('PO-', '')}`,
    spuCode: spuCodes[idx],
    spuName: spuNames[idx],
    mainFactoryName: factories[factoryIdx],
    requiredDeliveryDate: deliveryDate.toISOString().slice(0, 10),
    materialReadyStatus,
  }
}

/**
 * 生成生产单列表（至少20个PO）
 */
export function makePoList(seed: number = 12345, n: number = 25): PoSummary[] {
  const rand = mulberry32(seed)
  const poList: PoSummary[] = []
  
  for (let i = 0; i < n; i++) {
    const poId = `PO-TEST-${String(i + 1).padStart(3, '0')}`
    // 每个 PO 用不同的 seed 确保数据多样性
    const poSeed = seed + i * 1000
    poList.push(makePoSummary(poId, poSeed))
  }
  
  return poList
}
