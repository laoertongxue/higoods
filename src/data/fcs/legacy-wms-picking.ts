/**
 * Legacy WMS Picking mock 数据与辅助方法
 * 保持与原始页面同口径计算
 */

function mulberry32(seed: number): () => number {
  return function rand() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    const char = value.charCodeAt(index)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash)
}

export type PickingStatus = 'NOT_CREATED' | 'CREATED' | 'PICKING' | 'PARTIAL' | 'COMPLETED' | 'CANCELLED'
export type ShortageReasonCode = 'INSUFFICIENT_STOCK' | 'NOT_RECEIVED' | 'QC_FAILED' | 'FROZEN' | 'UNKNOWN'

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

export interface PoSummary {
  poId: string
  legacyOrderNo: string
  spuCode: string
  spuName: string
  mainFactoryName: string
  requiredDeliveryDate: string
  materialReadyStatus: 'NOT_CREATED' | 'CREATED' | 'PICKING' | 'PARTIAL' | 'COMPLETED'
}

export interface MaterialProgress {
  readinessStatus: PoSummary['materialReadyStatus']
  fulfillmentRate: number
  shortLineCount: number
  latestPickStatus: PickingStatus | null
  latestUpdatedAt: string | null
}

const WAREHOUSES = [
  { id: 'WH-JKT-01', name: '雅加达中心仓' },
  { id: 'WH-TNG-01', name: '丹格朗仓库' },
  { id: 'WH-BKS-01', name: '勿加泗仓库' },
  { id: 'WH-BDG-01', name: '万隆仓库' },
]

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

const REASON_CODES: ShortageReasonCode[] = ['INSUFFICIENT_STOCK', 'NOT_RECEIVED', 'QC_FAILED', 'FROZEN', 'UNKNOWN']

export function makePickingLines(pickId: string, seed?: number): PickingLine[] {
  const finalSeed = seed ?? hashString(pickId)
  const rand = mulberry32(finalSeed)

  const lineCount = 15 + Math.floor(rand() * 6)
  const lines: PickingLine[] = []

  const shuffledMaterials = [...MATERIALS].sort(() => rand() - 0.5).slice(0, lineCount)

  const shortCount = 3 + Math.floor(rand() * 4)
  const shortIndices = new Set<number>()
  while (shortIndices.size < shortCount) {
    shortIndices.add(Math.floor(rand() * lineCount))
  }

  const shortIndicesList = Array.from(shortIndices)

  for (let index = 0; index < lineCount; index += 1) {
    const material = shuffledMaterials[index % shuffledMaterials.length]
    const requiredQty = 50 + Math.floor(rand() * 450)

    let pickedQty = requiredQty
    let shortQty = 0
    let reasonCode: ShortageReasonCode | undefined

    if (shortIndices.has(index)) {
      const shortIndex = shortIndicesList.indexOf(index)
      reasonCode = shortIndex < 3 ? REASON_CODES[shortIndex] : REASON_CODES[Math.floor(rand() * REASON_CODES.length)]
      shortQty = Math.floor(rand() * (requiredQty * 0.5)) + 1
      pickedQty = requiredQty - shortQty
    }

    lines.push({
      lineId: `${pickId}-L${String(index + 1).padStart(3, '0')}`,
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

export function makePickingOrdersForPo(poId: string, seed?: number): PickingOrder[] {
  const finalSeed = seed ?? hashString(poId)
  const rand = mulberry32(finalSeed)

  const statuses: PickingStatus[] = ['CREATED', 'PICKING', 'PARTIAL', 'COMPLETED']
  const orders: PickingOrder[] = []

  for (let index = 0; index < statuses.length; index += 1) {
    const pickId = `PK-${poId.replace('PO-', '')}-${String(index + 1).padStart(2, '0')}`
    const warehouse = WAREHOUSES[index % WAREHOUSES.length]
    const status = statuses[index]

    const lines = makePickingLines(pickId, finalSeed + index)
    const totalRequired = lines.reduce((sum, line) => sum + line.requiredQty, 0)
    const totalPicked = lines.reduce((sum, line) => sum + Math.min(line.pickedQty, line.requiredQty), 0)
    const fulfillmentRate = totalRequired > 0 ? Math.round((totalPicked / totalRequired) * 100) : 0
    const shortLineCount = lines.filter((line) => line.shortQty > 0).length

    let adjustedRate = fulfillmentRate
    if (status === 'COMPLETED') adjustedRate = 100
    if (status === 'CREATED') adjustedRate = 0
    if (status === 'PICKING') adjustedRate = Math.min(adjustedRate, 60)
    if (status === 'PARTIAL') adjustedRate = Math.max(70, Math.min(adjustedRate, 95))

    const baseDate = new Date('2026-03-01')
    const createdAtDate = new Date(baseDate.getTime() + index * 24 * 60 * 60 * 1000)
    const updatedAtDate = new Date(createdAtDate.getTime() + Math.floor(rand() * 48) * 60 * 60 * 1000)

    orders.push({
      pickId,
      poId,
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      status,
      fulfillmentRate: adjustedRate,
      shortLineCount: status === 'COMPLETED' ? 0 : shortLineCount,
      createdAt: createdAtDate.toISOString().replace('T', ' ').slice(0, 19),
      updatedAt: updatedAtDate.toISOString().replace('T', ' ').slice(0, 19),
    })
  }

  if (rand() > 0.3) {
    const pickId = `PK-${poId.replace('PO-', '')}-05`
    const warehouse = WAREHOUSES[Math.floor(rand() * WAREHOUSES.length)]
    const status = statuses[Math.floor(rand() * statuses.length)]
    const lines = makePickingLines(pickId, finalSeed + 100)
    const totalRequired = lines.reduce((sum, line) => sum + line.requiredQty, 0)
    const totalPicked = lines.reduce((sum, line) => sum + Math.min(line.pickedQty, line.requiredQty), 0)
    const fulfillmentRate = totalRequired > 0 ? Math.round((totalPicked / totalRequired) * 100) : 0

    orders.push({
      pickId,
      poId,
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      status,
      fulfillmentRate: status === 'COMPLETED' ? 100 : status === 'CREATED' ? 0 : fulfillmentRate,
      shortLineCount: status === 'COMPLETED' ? 0 : lines.filter((line) => line.shortQty > 0).length,
      createdAt: '2026-03-04 10:00:00',
      updatedAt: '2026-03-04 15:30:00',
    })
  }

  return orders
}

export function makePoSummary(poId: string, seed?: number): PoSummary {
  const finalSeed = seed ?? hashString(poId)
  const rand = mulberry32(finalSeed)
  const pickingOrders = makePickingOrdersForPo(poId, finalSeed)

  let materialReadyStatus: PoSummary['materialReadyStatus'] = 'NOT_CREATED'
  if (pickingOrders.length > 0) {
    const hasShortage = pickingOrders.some((order) => order.shortLineCount > 0)
    const allCompleted = pickingOrders.every((order) => order.status === 'COMPLETED')
    const hasPicking = pickingOrders.some((order) => order.status === 'PICKING')

    if (allCompleted && !hasShortage) materialReadyStatus = 'COMPLETED'
    else if (hasShortage) materialReadyStatus = 'PARTIAL'
    else if (hasPicking) materialReadyStatus = 'PICKING'
    else materialReadyStatus = 'CREATED'
  }

  const spuCodes = ['SPU-SHIRT-001', 'SPU-DRESS-002', 'SPU-JACKET-003', 'SPU-PANTS-004', 'SPU-COAT-005']
  const spuNames = ['基础款衬衫', '夏季连衣裙', '休闲夹克', '商务西裤', '羊毛大衣']
  const factories = ['Jakarta Central Factory', 'Tangerang Satellite', 'Bekasi Sewing Hub', 'Bandung Print House']

  const itemIndex = Math.floor(rand() * spuCodes.length)
  const factoryIndex = Math.floor(rand() * factories.length)
  const deliveryDate = new Date('2026-03-15')
  deliveryDate.setDate(deliveryDate.getDate() + Math.floor(rand() * 30))

  return {
    poId,
    legacyOrderNo: `OLD-${poId.replace('PO-', '')}`,
    spuCode: spuCodes[itemIndex],
    spuName: spuNames[itemIndex],
    mainFactoryName: factories[factoryIndex],
    requiredDeliveryDate: deliveryDate.toISOString().slice(0, 10),
    materialReadyStatus,
  }
}

export function makePoList(seed = 12345, size = 25): PoSummary[] {
  const list: PoSummary[] = []
  for (let index = 0; index < size; index += 1) {
    const poId = `PO-TEST-${String(index + 1).padStart(3, '0')}`
    list.push(makePoSummary(poId, seed + index * 1000))
  }
  return list
}

export function getPickingOrdersByPo(poId: string): PickingOrder[] {
  return makePickingOrdersForPo(poId)
}

export function getPickingLinesByPickId(pickId: string): PickingLine[] {
  return makePickingLines(pickId)
}

export function getPoSummaryById(poId: string): PoSummary {
  return makePoSummary(poId)
}

export function getPickingOrderById(pickId: string, poId: string): PickingOrder | undefined {
  return makePickingOrdersForPo(poId).find((item) => item.pickId === pickId)
}

export function getShortageSummaryByPo(poId: string): PickingLine[] {
  const orders = makePickingOrdersForPo(poId)
  const lines: PickingLine[] = []
  for (const order of orders) {
    lines.push(...makePickingLines(order.pickId).filter((line) => line.shortQty > 0))
  }
  return lines
}

export function getPoList(): PoSummary[] {
  return makePoList()
}

export function getMaterialProgressByPo(poId: string): MaterialProgress {
  const orders = makePickingOrdersForPo(poId)

  if (orders.length === 0) {
    return {
      readinessStatus: 'NOT_CREATED',
      fulfillmentRate: 0,
      shortLineCount: 0,
      latestPickStatus: null,
      latestUpdatedAt: null,
    }
  }

  let totalRequired = 0
  let totalPicked = 0
  let shortLineCount = 0

  for (const order of orders) {
    const lines = makePickingLines(order.pickId)
    for (const line of lines) {
      totalRequired += line.requiredQty
      totalPicked += Math.min(line.pickedQty, line.requiredQty)
      if (line.shortQty > 0) shortLineCount += 1
    }
  }

  const fulfillmentRate = totalRequired > 0 ? Math.round((totalPicked / totalRequired) * 100) : 0
  const latestOrder = [...orders].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]

  const hasPicking = orders.some((item) => item.status === 'PICKING')
  const allCompleted = orders.every((item) => item.status === 'COMPLETED')
  const hasShortage = shortLineCount > 0

  let readinessStatus: PoSummary['materialReadyStatus'] = 'CREATED'
  if (hasPicking) readinessStatus = 'PICKING'
  else if (hasShortage) readinessStatus = 'PARTIAL'
  else if (allCompleted) readinessStatus = 'COMPLETED'

  return {
    readinessStatus,
    fulfillmentRate,
    shortLineCount,
    latestPickStatus: latestOrder.status,
    latestUpdatedAt: latestOrder.updatedAt,
  }
}
