import { getPmsMaterial, type PmsPurchaseRegion } from './materials.ts'
import { appendPmsLog, PmsDomainError, roundPmsQty, type PmsActorRole } from './runtime.ts'

export type PmsInventoryRuleStatus = '正常' | '待补货' | '规则异常'
export type PmsInventoryTriggerMode = '比例' | '固定'
export type PmsInventoryProcess = '染色' | '印花' | '绣花' | '花边'
export type PmsInventoryUsageType = '成衣破货' | '样衣破货' | '成衣破货补采' | '成衣破货备货' | 'kol样品小单'

export const PMS_INVENTORY_PROCESSES: PmsInventoryProcess[] = ['染色', '印花', '绣花', '花边']
export const PMS_INVENTORY_USAGE_TYPES: PmsInventoryUsageType[] = ['成衣破货', '样衣破货', '成衣破货补采', '成衣破货备货', 'kol样品小单']
export const PMS_INVENTORY_PURCHASE_REGIONS: PmsPurchaseRegion[] = ['国内', '印尼']

export interface PmsInventoryOrderLine {
  sku: string
  skuName: string
  qty: number
  unit: string
}

export interface PmsInventoryMonitorRow {
  id: string
  materialCode: string
  materialName: string
  materialImageUrl: string
  unit: string
  warehouse: string
  stockQty: number
  safetyThreshold: number
  triggerMode: PmsInventoryTriggerMode
  triggerRatio: number
  fixedTrigger: number
  triggerLine: number
  targetStock: number
  suggestedQty: number
  ruleStatus: PmsInventoryRuleStatus
  canTransfer: boolean
  canPurchase: boolean
  transferBlockReason: string
  processChain: PmsInventoryProcess[]
  greigeSpu: string
  greigeSku: string
  greigeName: string
  greigeStock: number
  supplierName: string
  purchaseLeadTimeDays: number
  updatedAt: string
  remark: string
}

export interface PmsInventoryOrder {
  orderNo: string
  orderType: '调拨单' | '采购单'
  monitorId: string
  materialCode: string
  materialName: string
  unit: string
  qty: number
  fromWarehouse: string
  toWarehouse: string
  toTarget: string
  supplierName: string
  purchaseRegion: PmsPurchaseRegion | ''
  usageType: PmsInventoryUsageType | ''
  lines: PmsInventoryOrderLine[]
  processOrderNos: string[]
  syncProcessOrder: boolean
  status: '已创建'
  createdBy: string
  createdAt: string
  remark: string
}

export interface PmsInventoryOrderOptions {
  supplierName?: string
  purchaseRegion?: PmsPurchaseRegion
  usageType?: PmsInventoryUsageType
  items?: Array<{ sku: string; qty: number }>
  fromWarehouse?: string
  toWarehouse?: string
  syncProcessOrder?: boolean
}

export interface PmsInventoryMonitorInput {
  materialCode: string
  warehouse: string
  stockQty: number
  safetyThreshold: number
  triggerMode: PmsInventoryTriggerMode
  triggerRatio: number
  fixedTrigger: number
  targetStock: number
  processChain?: PmsInventoryProcess[]
  greigeSpu?: string
  greigeSku?: string
  greigeName?: string
  greigeStock?: number
  remark?: string
}

interface PmsInventoryRuntime {
  rows: PmsInventoryMonitorRow[]
  orders: PmsInventoryOrder[]
}

interface PmsInventoryRowExtras {
  remark?: string
  processChain?: PmsInventoryProcess[]
  greigeSpu?: string
  greigeSku?: string
  greigeName?: string
  greigeStock?: number
}

let runtime: PmsInventoryRuntime | null = null
let orderSequence = 0
let processOrderSequence = 0
let monitorRowSequence = 5

export function formatPmsInventoryProcessChain(chain: PmsInventoryProcess[]): string {
  return chain.length > 0 ? chain.join(' → ') : '—'
}

function validateProcessChain(chain: PmsInventoryProcess[]): PmsInventoryProcess[] {
  const result: PmsInventoryProcess[] = []
  chain.forEach((processName) => {
    if (!PMS_INVENTORY_PROCESSES.includes(processName)) throw new PmsDomainError('INVENTORY_PROCESS_INVALID', `加工工序 ${processName} 不在 染色 / 印花 / 绣花 / 花边 范围内`)
    if (result.includes(processName)) throw new PmsDomainError('INVENTORY_PROCESS_DUPLICATE', `加工工序 ${processName} 重复，请调整工序顺序`)
    result.push(processName)
  })
  return result
}

function normalizeGreige(spu: string, sku: string, name: string, stock: number): { greigeSpu: string; greigeSku: string; greigeName: string; greigeStock: number } {
  const greigeSpu = spu.trim()
  const greigeSku = sku.trim()
  const greigeName = name.trim()
  if (!Number.isFinite(stock) || stock < 0) throw new PmsDomainError('INVENTORY_GREIGE_STOCK_INVALID', '坯布库存必须是非负数字')
  const greigeStock = roundPmsQty(stock, 2)
  if (!greigeSku && (greigeSpu || greigeName || greigeStock > 0)) throw new PmsDomainError('INVENTORY_GREIGE_SKU_REQUIRED', '坯布 SKU 必填')
  return { greigeSpu, greigeSku, greigeName, greigeStock }
}

function computeTransferBlockReason(row: PmsInventoryMonitorRow): string {
  if (row.ruleStatus === '规则异常') return '补货规则异常，请先修复规则'
  if (row.suggestedQty <= 0) return '当前没有建议补货量，无需调拨'
  if (row.stockQty <= 0) return '本仓可用库存为 0，无法调出'
  if (row.greigeStock <= 0) return '坯布库存为 0，不满足调拨资格'
  return ''
}

function computeRow(row: PmsInventoryMonitorRow): void {
  row.triggerLine = row.triggerMode === '比例' ? roundPmsQty(row.safetyThreshold * row.triggerRatio, 2) : row.fixedTrigger
  row.suggestedQty = roundPmsQty(Math.max(0, row.targetStock - row.stockQty), 2)
  const ratioInvalid = row.triggerMode === '比例' && (row.triggerRatio <= 0 || row.triggerRatio > 1)
  if (row.safetyThreshold <= 0 || row.targetStock <= 0 || ratioInvalid) {
    row.ruleStatus = '规则异常'
  } else if (row.stockQty < row.triggerLine) {
    row.ruleStatus = '待补货'
  } else {
    row.ruleStatus = '正常'
  }
  row.transferBlockReason = computeTransferBlockReason(row)
  row.canTransfer = row.transferBlockReason === ''
  row.canPurchase = row.ruleStatus !== '规则异常' && row.suggestedQty > 0 && row.stockQty <= row.triggerLine
}

function buildRow(
  id: string,
  materialCode: string,
  warehouse: string,
  stockQty: number,
  safetyThreshold: number,
  triggerMode: PmsInventoryTriggerMode,
  triggerRatio: number,
  fixedTrigger: number,
  targetStock: number,
  extras: PmsInventoryRowExtras = {},
): PmsInventoryMonitorRow {
  const material = getPmsMaterial(materialCode)
  const row: PmsInventoryMonitorRow = {
    id,
    materialCode,
    materialName: material?.materialName ?? materialCode,
    materialImageUrl: material?.imageUrl ?? '',
    unit: material?.baseUnit ?? '个',
    warehouse,
    stockQty,
    safetyThreshold,
    triggerMode,
    triggerRatio,
    fixedTrigger,
    triggerLine: 0,
    targetStock,
    suggestedQty: 0,
    ruleStatus: '正常',
    canTransfer: false,
    canPurchase: false,
    transferBlockReason: '',
    processChain: extras.processChain ?? [],
    greigeSpu: extras.greigeSpu ?? '',
    greigeSku: extras.greigeSku ?? '',
    greigeName: extras.greigeName ?? '',
    greigeStock: extras.greigeStock ?? 0,
    supplierName: material?.defaultSupplier ?? '',
    purchaseLeadTimeDays: material?.purchaseLeadTimeDays ?? 10,
    updatedAt: '2026-06-12 09:00:00',
    remark: extras.remark ?? '',
  }
  computeRow(row)
  return row
}

function buildInitialRuntime(): PmsInventoryRuntime {
  const rows = [
    buildRow('INV-2026-0001', 'FAB-2026-0001', '广州原料仓', 800, 2000, '比例', 0.5, 1000, 3000, {
      remark: '夏季常备面料，库存低于触发线',
      processChain: ['染色', '印花'],
      greigeSpu: 'HG-GR-2601',
      greigeSku: 'HG-GR-2601-W01',
      greigeName: '180g 纯棉针织坯布',
      greigeStock: 1200,
    }),
    buildRow('INV-2026-0002', 'FAB-2026-0002', '广州原料仓', 700, 1500, '比例', 0.6, 900, 2500, {
      processChain: ['染色'],
      greigeSpu: 'HG-GR-2602',
      greigeSku: 'HG-GR-2602-GY01',
      greigeName: '220g 涤棉卫衣坯布',
      greigeStock: 900,
    }),
    buildRow('INV-2026-0003', 'ACC-2026-0002', '广州辅料仓', 0, 30000, '固定', 0.5, 30000, 60000, { remark: '纽扣断货，可采购' }),
    buildRow('INV-2026-0004', 'ACC-2026-0004', '广州辅料仓', 800, 300, '固定', 0.5, 150, 600),
    buildRow('INV-2026-0005', 'YAR-2026-0001', '印尼雅加达面辅料仓', 500, 400, '比例', 0, 0, 800, {
      remark: '触发比例未配置，规则异常',
      processChain: ['花边'],
    }),
  ]
  return { rows, orders: [] }
}

function getRuntime(): PmsInventoryRuntime {
  if (!runtime) {
    getPmsMaterial('FAB-2026-0001')
    runtime = buildInitialRuntime()
  }
  return runtime
}

export function listPmsInventoryMonitor(): PmsInventoryMonitorRow[] {
  return getRuntime().rows
}

export function getPmsInventoryMonitorRow(id: string): PmsInventoryMonitorRow | undefined {
  return getRuntime().rows.find((row) => row.id === id)
}

export function listPmsInventoryOrders(): PmsInventoryOrder[] {
  return getRuntime().orders
}

function validateRuleNumbers(row: PmsInventoryMonitorRow): void {
  if (row.safetyThreshold <= 0) throw new PmsDomainError('INVENTORY_THRESHOLD_INVALID', '安全阈值必须大于 0')
  if (row.targetStock <= 0) throw new PmsDomainError('INVENTORY_TARGET_INVALID', '目标库存必须大于 0')
  if (row.triggerMode !== '比例' && row.triggerMode !== '固定') throw new PmsDomainError('INVENTORY_TRIGGER_MODE_INVALID', '触发方式仅支持 比例 / 固定')
  if (row.fixedTrigger < 0) throw new PmsDomainError('INVENTORY_FIXED_INVALID', '固定触发线不能为负数')
}

export function updatePmsInventoryRule(
  id: string,
  patch: {
    safetyThreshold?: number
    triggerMode?: PmsInventoryTriggerMode
    triggerRatio?: number
    fixedTrigger?: number
    targetStock?: number
    processChain?: PmsInventoryProcess[]
    greigeSpu?: string
    greigeSku?: string
    greigeName?: string
    greigeStock?: number
    remark?: string
  },
  actor: { id: string; name: string; role: PmsActorRole },
): PmsInventoryMonitorRow {
  const row = getPmsInventoryMonitorRow(id)
  if (!row) throw new PmsDomainError('INVENTORY_MONITOR_NOT_FOUND', `库存监控 ${id} 不存在`)
  const beforeValue = `触发线 ${row.triggerLine} · 工序 ${formatPmsInventoryProcessChain(row.processChain)} · 坯布库存 ${row.greigeStock}`
  if (patch.safetyThreshold !== undefined) {
    if (!Number.isFinite(patch.safetyThreshold) || patch.safetyThreshold <= 0) throw new PmsDomainError('INVENTORY_THRESHOLD_INVALID', '安全阈值必须大于 0')
    row.safetyThreshold = roundPmsQty(patch.safetyThreshold, 2)
  }
  if (patch.triggerMode !== undefined) {
    if (patch.triggerMode !== '比例' && patch.triggerMode !== '固定') throw new PmsDomainError('INVENTORY_TRIGGER_MODE_INVALID', '触发方式仅支持 比例 / 固定')
    row.triggerMode = patch.triggerMode
  }
  if (patch.triggerRatio !== undefined) {
    if (!Number.isFinite(patch.triggerRatio)) throw new PmsDomainError('INVENTORY_RATIO_INVALID', '触发比例必须是数字')
    row.triggerRatio = roundPmsQty(patch.triggerRatio, 4)
  }
  if (patch.fixedTrigger !== undefined) {
    if (!Number.isFinite(patch.fixedTrigger) || patch.fixedTrigger < 0) throw new PmsDomainError('INVENTORY_FIXED_INVALID', '固定触发线不能为负数')
    row.fixedTrigger = roundPmsQty(patch.fixedTrigger, 2)
  }
  if (patch.targetStock !== undefined) {
    if (!Number.isFinite(patch.targetStock) || patch.targetStock <= 0) throw new PmsDomainError('INVENTORY_TARGET_INVALID', '目标库存必须大于 0')
    row.targetStock = roundPmsQty(patch.targetStock, 2)
  }
  if (patch.processChain !== undefined) row.processChain = validateProcessChain(patch.processChain)
  if (patch.greigeSpu !== undefined || patch.greigeSku !== undefined || patch.greigeName !== undefined || patch.greigeStock !== undefined) {
    const greige = normalizeGreige(
      patch.greigeSpu ?? row.greigeSpu,
      patch.greigeSku ?? row.greigeSku,
      patch.greigeName ?? row.greigeName,
      patch.greigeStock ?? row.greigeStock,
    )
    row.greigeSpu = greige.greigeSpu
    row.greigeSku = greige.greigeSku
    row.greigeName = greige.greigeName
    row.greigeStock = greige.greigeStock
  }
  if (patch.remark !== undefined) row.remark = patch.remark.trim()
  computeRow(row)
  row.updatedAt = new Date().toISOString()
  appendPmsLog({
    objectType: 'inventory-monitor',
    objectId: id,
    action: '更新补货规则',
    beforeValue,
    afterValue: `触发线 ${row.triggerLine} · 建议量 ${row.suggestedQty} · 工序 ${formatPmsInventoryProcessChain(row.processChain)} · 坯布库存 ${row.greigeStock} · ${row.ruleStatus}`,
    reason: patch.remark ?? '',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
  })
  return row
}

function nextProcessOrderNo(): string {
  processOrderSequence += 1
  return `PO-2026-${String(processOrderSequence).padStart(4, '0')}`
}

function buildProcessOrderChain(processChain: PmsInventoryProcess[]): string[] {
  const count = Math.max(1, processChain.length)
  return Array.from({ length: count }, () => nextProcessOrderNo())
}

export function generatePmsInventoryOrder(
  id: string,
  orderType: PmsInventoryOrder['orderType'],
  qty: number,
  actor: { id: string; name: string; role: PmsActorRole },
  options: PmsInventoryOrderOptions = {},
): PmsInventoryOrder {
  const row = getPmsInventoryMonitorRow(id)
  if (!row) throw new PmsDomainError('INVENTORY_MONITOR_NOT_FOUND', `库存监控 ${id} 不存在`)
  if (orderType !== '采购单' && orderType !== '调拨单') throw new PmsDomainError('INVENTORY_ORDER_TYPE_INVALID', '单据类型仅支持 采购单 / 调拨单')
  if (row.ruleStatus === '规则异常') throw new PmsDomainError('INVENTORY_RULE_INVALID', '补货规则异常，请先修复规则再建单')
  if (row.suggestedQty <= 0) throw new PmsDomainError('INVENTORY_SUGGESTED_ZERO', '当前没有建议补货量，无需建单')
  if (orderType === '调拨单' && !row.canTransfer) throw new PmsDomainError('INVENTORY_TRANSFER_BLOCKED', row.transferBlockReason ? `当前条件不满足调拨资格：${row.transferBlockReason}` : '当前条件不满足调拨资格')
  if (orderType === '采购单' && !row.canPurchase) throw new PmsDomainError('INVENTORY_PURCHASE_BLOCKED', '当前条件不满足采购资格')
  const itemInputs = options.items && options.items.length > 0 ? options.items : null
  if (itemInputs && orderType !== '采购单') throw new PmsDomainError('INVENTORY_ITEMS_UNSUPPORTED', '只有采购单支持按 SKU 明细建单')
  let lines: PmsInventoryOrderLine[]
  if (itemInputs) {
    lines = itemInputs.map((item) => {
      const sku = item.sku.trim()
      if (!sku) throw new PmsDomainError('INVENTORY_ITEM_SKU_REQUIRED', '采购明细 SKU 必填')
      if (!Number.isFinite(item.qty) || item.qty <= 0) throw new PmsDomainError('INVENTORY_QTY_INVALID', `SKU ${sku} 的采购数量必须大于 0`)
      const target = getRuntime().rows.find((candidate) => candidate.materialCode === sku)
      if (target && item.qty > target.suggestedQty) throw new PmsDomainError('INVENTORY_QTY_OVER', `SKU ${sku} 数量不能超过建议量 ${target.suggestedQty} ${target.unit}`)
      return { sku, skuName: target?.materialName ?? sku, qty: roundPmsQty(item.qty, 2), unit: target?.unit ?? row.unit }
    })
  } else {
    if (!Number.isFinite(qty) || qty <= 0) throw new PmsDomainError('INVENTORY_QTY_INVALID', '建单数量必须大于 0')
    if (qty > row.suggestedQty) throw new PmsDomainError('INVENTORY_QTY_OVER', `建单数量不能超过建议量 ${row.suggestedQty} ${row.unit}`)
    lines = [{ sku: row.materialCode, skuName: row.materialName, qty: roundPmsQty(qty, 2), unit: row.unit }]
  }
  let supplierName = row.supplierName
  if (options.supplierName !== undefined) {
    const nextSupplier = options.supplierName.trim()
    if (!nextSupplier) throw new PmsDomainError('INVENTORY_SUPPLIER_REQUIRED', '供应商不能为空')
    supplierName = nextSupplier
  }
  let purchaseRegion: PmsPurchaseRegion | '' = ''
  let usageType: PmsInventoryUsageType | '' = ''
  if (orderType === '采购单') {
    purchaseRegion = options.purchaseRegion ?? getPmsMaterial(row.materialCode)?.defaultPurchaseRegion ?? '国内'
    if (options.purchaseRegion !== undefined && !PMS_INVENTORY_PURCHASE_REGIONS.includes(options.purchaseRegion)) {
      throw new PmsDomainError('INVENTORY_REGION_INVALID', '采购地区仅支持 国内 / 印尼')
    }
    if (options.usageType !== undefined) {
      if (!PMS_INVENTORY_USAGE_TYPES.includes(options.usageType)) throw new PmsDomainError('INVENTORY_USAGE_INVALID', `使用类型仅支持 ${PMS_INVENTORY_USAGE_TYPES.join(' / ')}`)
      usageType = options.usageType
    }
  }
  let fromWarehouse = orderType === '调拨单' ? '广州原料仓' : supplierName
  let toWarehouse = row.warehouse
  if (orderType === '调拨单') {
    if (options.fromWarehouse !== undefined) {
      const nextFrom = options.fromWarehouse.trim()
      if (!nextFrom) throw new PmsDomainError('INVENTORY_FROM_WAREHOUSE_REQUIRED', '调出仓库不能为空')
      fromWarehouse = nextFrom
    }
    if (options.toWarehouse !== undefined) {
      const nextTo = options.toWarehouse.trim()
      if (!nextTo) throw new PmsDomainError('INVENTORY_TO_TARGET_REQUIRED', '调入目标不能为空')
      toWarehouse = nextTo
    }
  }
  const syncProcessOrder = orderType === '调拨单' && options.syncProcessOrder === true
  const processOrderNos = syncProcessOrder ? buildProcessOrderChain(row.processChain) : []
  const totalQty = roundPmsQty(lines.reduce((sum, line) => sum + line.qty, 0), 2)
  orderSequence += 1
  const order: PmsInventoryOrder = {
    orderNo: orderType === '调拨单' ? `ITR-2026-${String(orderSequence).padStart(4, '0')}` : `IPR-2026-${String(orderSequence).padStart(4, '0')}`,
    orderType,
    monitorId: id,
    materialCode: row.materialCode,
    materialName: row.materialName,
    unit: row.unit,
    qty: totalQty,
    fromWarehouse,
    toWarehouse,
    toTarget: toWarehouse,
    supplierName,
    purchaseRegion,
    usageType,
    lines,
    processOrderNos,
    syncProcessOrder,
    status: '已创建',
    createdBy: actor.name,
    createdAt: new Date().toISOString(),
    remark: '',
  }
  getRuntime().orders.unshift(order)
  appendPmsLog({
    objectType: 'inventory-monitor',
    objectId: id,
    action: `创建${orderType}`,
    beforeValue: '',
    afterValue: `${order.orderNo} · ${order.lines.length} 个 SKU · ${order.qty} ${order.unit}${order.processOrderNos.length > 0 ? ` · 加工单 ${order.processOrderNos.join(' → ')}` : ''}`,
    reason: itemInputs ? '按勾选 SKU 生成' : `按建议量 ${row.suggestedQty} 建单`,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
  })
  return order
}

export function refreshPmsInventoryStocks(actor: { id: string; name: string; role: PmsActorRole }): { count: number; refreshedAt: string } {
  const current = getRuntime()
  const refreshedAt = new Date().toISOString()
  const beforeTotal = roundPmsQty(current.rows.reduce((sum, row) => sum + row.stockQty, 0), 2)
  current.rows.forEach((row, index) => {
    row.stockQty = roundPmsQty(row.stockQty + (index + 1) * 25, 2)
    computeRow(row)
    row.updatedAt = refreshedAt
  })
  const afterTotal = roundPmsQty(current.rows.reduce((sum, row) => sum + row.stockQty, 0), 2)
  appendPmsLog({
    objectType: 'inventory-monitor',
    objectId: 'ALL',
    action: '批量刷新库存',
    beforeValue: `${current.rows.length} 条 · 库存合计 ${beforeTotal}`,
    afterValue: `${current.rows.length} 条 · 库存合计 ${afterTotal}`,
    reason: '同步 WMS 库存与刷新时间',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
  })
  return { count: current.rows.length, refreshedAt }
}

export function createPmsInventoryMonitorRow(
  input: PmsInventoryMonitorInput,
  actor: { id: string; name: string; role: PmsActorRole },
): PmsInventoryMonitorRow {
  const current = getRuntime()
  const materialCode = input.materialCode.trim()
  if (!materialCode) throw new PmsDomainError('INVENTORY_SKU_REQUIRED', '监控 SKU 必填')
  if (current.rows.some((row) => row.materialCode.toLowerCase() === materialCode.toLowerCase())) {
    throw new PmsDomainError('INVENTORY_SKU_DUPLICATE', `SKU ${materialCode} 已在库存监控列表中`)
  }
  const warehouse = input.warehouse.trim()
  if (!warehouse) throw new PmsDomainError('INVENTORY_WAREHOUSE_REQUIRED', '监控仓库不能为空')
  if (!Number.isFinite(input.stockQty) || input.stockQty < 0) throw new PmsDomainError('INVENTORY_STOCK_INVALID', '库存数量必须是非负数字')
  if (!Number.isFinite(input.safetyThreshold) || input.safetyThreshold <= 0) throw new PmsDomainError('INVENTORY_THRESHOLD_INVALID', '安全阈值必须大于 0')
  if (!Number.isFinite(input.targetStock) || input.targetStock <= 0) throw new PmsDomainError('INVENTORY_TARGET_INVALID', '目标库存必须大于 0')
  const triggerMode = input.triggerMode
  if (triggerMode !== '比例' && triggerMode !== '固定') throw new PmsDomainError('INVENTORY_TRIGGER_MODE_INVALID', '触发方式仅支持 比例 / 固定')
  if (!Number.isFinite(input.triggerRatio)) throw new PmsDomainError('INVENTORY_RATIO_INVALID', '触发比例必须是数字')
  if (!Number.isFinite(input.fixedTrigger) || input.fixedTrigger < 0) throw new PmsDomainError('INVENTORY_FIXED_INVALID', '固定触发线不能为负数')
  const processChain = validateProcessChain(input.processChain ?? [])
  const greige = normalizeGreige(input.greigeSpu ?? '', input.greigeSku ?? '', input.greigeName ?? '', input.greigeStock ?? 0)
  monitorRowSequence += 1
  const id = `INV-2026-${String(monitorRowSequence).padStart(4, '0')}`
  const row = buildRow(id, materialCode, warehouse, roundPmsQty(input.stockQty, 2), roundPmsQty(input.safetyThreshold, 2), triggerMode, roundPmsQty(input.triggerRatio, 4), roundPmsQty(input.fixedTrigger, 2), roundPmsQty(input.targetStock, 2), {
    remark: input.remark ?? '',
    processChain,
    greigeSpu: greige.greigeSpu,
    greigeSku: greige.greigeSku,
    greigeName: greige.greigeName,
    greigeStock: greige.greigeStock,
  })
  validateRuleNumbers(row)
  row.updatedAt = new Date().toISOString()
  current.rows.push(row)
  appendPmsLog({
    objectType: 'inventory-monitor',
    objectId: id,
    action: '添加监控 SKU',
    beforeValue: '',
    afterValue: `${row.materialCode} · ${row.materialName} · ${row.warehouse} · 库存 ${row.stockQty} ${row.unit} · ${row.ruleStatus}`,
    reason: '手动添加监控 SKU',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
  })
  return row
}
