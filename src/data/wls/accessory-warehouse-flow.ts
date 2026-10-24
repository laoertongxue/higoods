/** 本任务的纯业务计算；ID、来源版本、库存和命令去重由同库事务负责。 */
export const ACCESSORY_GTP_WAREHOUSE = 'WH-FITTING-001'
export const ACCESSORY_HILON_WAREHOUSE = 'HILON-2'
export const ACCESSORY_MAHAMERU_WAREHOUSE = 'WH-FITTING-MAHAMERU'
export const ACCESSORY_POST_WAREHOUSE = 'DLN'

export type AccessoryPurpose = '价格吊牌' | '品牌吊牌' | '吊粒' | '车缝线' | '其他' | '待核对'
export type AccessoryTaskType = 'SEWING' | 'SEWING_IRONING_PACKING' | 'CUTTING_SEWING_IRONING_PACKING'
export interface AccessoryAction { at: string; by: string }
export interface AccessoryHistory extends AccessoryAction { action: string; detail: string }
export interface AccessoryAllocation { locationId: string; qty: number }
export interface AccessoryLine {
  id: string
  materialSku: string
  materialName: string
  imageUrl: string
  color: string
  spec: string
  unit: string
  requiredQty: number
  preparedQty: number
  availableQty: number
  locationId: string
  allocations?: AccessoryAllocation[]
  purpose: AccessoryPurpose
  requiresCutting: boolean
}
export interface AccessoryPreparation {
  id: string
  productionOrderId: string
  productionOrderNo: string
  styleName: string
  styleImageUrl: string
  techPackVersion: string
  cuttingFactoryId: string | null
  cuttingFactoryName: string | null
  version: number
  status: '待配料' | '配料中' | '已配齐'
  remark: string
  lines: AccessoryLine[]
  history: AccessoryHistory[]
  completedAt?: string
  completedBy?: string
  completionVersion?: number
}
export interface AccessoryTransferLine {
  id: string
  sourceLineId?: string
  materialSku: string
  materialName: string
  imageUrl: string
  color: string
  spec: string
  unit: string
  purpose: AccessoryPurpose
  requiresCutting: boolean
  qty: number
  fromLocationId: string
  toLocationId?: string
}
export interface AccessoryTransfer {
  id: string
  kind: 'GTP_TO_SITE' | 'SITE_TO_POST' | 'GTP_TO_POST' | 'SITE_REASSIGN'
  preparationId: string
  productionOrderId: string
  fromWarehouse: string
  toWarehouse: string | null
  status: '待定调入方' | '待出库' | '已出库待收货' | '已收货' | '已作废'
  version: number
  lines: AccessoryTransferLine[]
  history: AccessoryHistory[]
  createdAt: string
  createdBy: string
  creationMode?: 'SYSTEM' | 'MANUAL'
  manualSource?: 'PRODUCTION_ORDER' | 'GENERAL'
  manualTransferNo?: string
  manualProductionOrderNo?: string
  manualStyleName?: string
  manualStyleImageUrl?: string
  manualRequestSignature?: string
  sourceTransferId?: string
  responsibilityKey?: string
  changeId?: string
  dispatchedAt?: string
  dispatchedBy?: string
  receivedAt?: string
  receivedBy?: string
}
export interface AccessoryLocation { id: string; warehouseCode: string; enabled: boolean }
export interface AccessoryReceiptLine { lineId: string; qty: number; locationId: string }
export interface AccessoryPickupLine extends AccessoryTransferLine { requiredQty: number; handedQty: number }
export interface AccessoryPickup {
  id: string
  preparationId: string
  productionOrderId: string
  sourceTransferId: string
  warehouseCode: string
  taskId: string
  assignmentId: string
  taskVersion: string
  factoryId: string
  factoryName: string
  version: number
  status: '待领料' | '领料中' | '已领料' | '已失效'
  lines: AccessoryPickupLine[]
  history: AccessoryHistory[]
}
export interface AccessoryReassignment extends AccessoryAction {
  id: string
  sourceTransferId: string
  fromWarehouse: string
  toWarehouse: string
  newFactoryId: string
  newFactoryName: string
  reason: string
  status: '等待原仓收货' | '待仓间调拨'
}

export class AccessoryFlowError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'AccessoryFlowError'
    this.code = code
  }
}

const EPSILON = 0.000001
const POST_EXCLUDED_PURPOSES = new Set<AccessoryPurpose>(['价格吊牌', '品牌吊牌', '吊粒', '车缝线'])
const equalQty = (left: number, right: number) => Math.abs(left - right) <= EPSILON
const quantity = (value: number) => Math.round(value * 1_000_000) / 1_000_000
const isSiteWarehouse = (code: string | null): code is string => code === ACCESSORY_HILON_WAREHOUSE || code === ACCESSORY_MAHAMERU_WAREHOUSE
function requireValue(value: unknown, code: string, message: string): asserts value {
  if (!value) throw new AccessoryFlowError(code, message)
}
function requireQty(value: number, label: string, allowZero = false): void {
  requireValue(Number.isFinite(value) && (allowZero ? value >= 0 : value > 0), 'INVALID_QUANTITY', `${label}必须是${allowZero ? '非负' : '大于零的'}有效数量`)
}
function requireAction(action: AccessoryAction): void {
  requireValue(action.at.trim() && action.by.trim(), 'MISSING_OPERATOR', '需要记录操作人和时间')
}
function uniqueIds(rows: readonly { id: string }[], label: string): void {
  requireValue(rows.every(row => row.id.trim()) && new Set(rows.map(row => row.id)).size === rows.length, 'DUPLICATE_LINE', `${label}明细身份缺失或重复`)
}
function history(action: AccessoryAction, name: string, detail: string): AccessoryHistory {
  requireAction(action)
  return { at: action.at, by: action.by, action: name, detail }
}
function requireTransferLines(transfer: AccessoryTransfer): void {
  requireValue(transfer.lines.length, 'EMPTY_TRANSFER', '调拨单没有可办理的明细')
  uniqueIds(transfer.lines, '调拨')
  for (const line of transfer.lines) {
    requireQty(line.qty, `${line.materialName}调拨数量`)
    requireValue(line.unit.trim(), 'MISSING_UNIT', `${line.materialName}缺少数量单位`)
    requireValue(line.fromLocationId.trim(), 'MISSING_LOCATION', `${line.materialName}缺少来源库位`)
    requireValue(!line.requiresCutting, 'CUTTING_MATERIAL', '本流程只办理无需裁剪的辅料')
  }
}

function requireTransferRoute(transfer: AccessoryTransfer): void {
  const valid = transfer.kind === 'GTP_TO_SITE'
    ? transfer.fromWarehouse === ACCESSORY_GTP_WAREHOUSE && isSiteWarehouse(transfer.toWarehouse)
    : transfer.kind === 'SITE_TO_POST'
      ? isSiteWarehouse(transfer.fromWarehouse) && transfer.toWarehouse === ACCESSORY_POST_WAREHOUSE
      : transfer.kind === 'GTP_TO_POST'
        ? transfer.fromWarehouse === ACCESSORY_GTP_WAREHOUSE && transfer.toWarehouse === ACCESSORY_POST_WAREHOUSE
        : transfer.kind === 'SITE_REASSIGN' && isSiteWarehouse(transfer.fromWarehouse) && isSiteWarehouse(transfer.toWarehouse) && transfer.fromWarehouse !== transfer.toWarehouse
  requireValue(valid, 'INVALID_DESTINATION', '调拨类型与发出仓、目的仓不一致')
}

/** 工厂身份由外层档案核对；这里只映射本轮明确的两个正式名称。 */
export function getAccessoryWarehouseForCuttingFactory(factoryName: string | null | undefined): string | null {
  const name = factoryName?.trim().toLowerCase()
  if (name === 'sea cutting') return ACCESSORY_HILON_WAREHOUSE
  if (name === 'sea cutting2') return ACCESSORY_MAHAMERU_WAREHOUSE
  return null
}

export function getAccessoryPreparationRemaining(line: AccessoryLine): number {
  return quantity(Math.max(0, line.requiredQty - line.preparedQty))
}

/** 旧单位置明细只读展开；新动作保存片段，不把新库位覆盖到历史已配数量。 */
export function getAccessoryLineAllocations(line: AccessoryLine): AccessoryAllocation[] {
  requireQty(line.preparedQty, `${line.materialName}累计实配`, true)
  if (!line.allocations) {
    if (line.preparedQty === 0) return []
    requireValue(line.locationId.trim(), 'MISSING_LOCATION', `${line.materialName}原已配数量缺少来源库位`)
    return [{ locationId: line.locationId, qty: line.preparedQty }]
  }
  const allocations = new Map<string, number>()
  for (const allocation of line.allocations) {
    requireValue(allocation.locationId.trim(), 'MISSING_LOCATION', `${line.materialName}配料片段缺少来源库位`)
    requireQty(allocation.qty, `${line.materialName}库位分配数量`)
    allocations.set(allocation.locationId, quantity((allocations.get(allocation.locationId) ?? 0) + allocation.qty))
  }
  requireValue(equalQty([...allocations.values()].reduce((sum, qty) => sum + qty, 0), line.preparedQty), 'ALLOCATION_QUANTITY_CONFLICT', `${line.materialName}库位分配合计与累计实配不一致`)
  return [...allocations].map(([locationId, qty]) => ({ locationId, qty }))
}

export function registerAccessoryPreparation(
  preparation: AccessoryPreparation,
  entries: readonly { lineId: string; qty: number; locationId: string }[],
  action: AccessoryAction,
): AccessoryPreparation {
  requireAction(action)
  requireValue(preparation.status !== '已配齐', 'PREPARATION_COMPLETED', '已配齐记录不能继续登记配料')
  uniqueIds(preparation.lines, '配料')
  requireValue(entries.length, 'EMPTY_PREPARATION', '至少登记一行本次配料')
  requireValue(new Set(entries.map(entry => entry.lineId)).size === entries.length, 'DUPLICATE_LINE', '本次配料明细重复')
  const updates = new Map<string, { qty: number; locationId: string }>()
  for (const entry of entries) {
    const line = preparation.lines.find(item => item.id === entry.lineId)
    requireValue(line, 'UNKNOWN_LINE', '配料明细已变化，请重新读取')
    requireValue(!line.requiresCutting, 'CUTTING_MATERIAL', `${line.materialName}需要裁剪，不属于本次配料范围`)
    requireQty(entry.qty, `${line.materialName}本次配料`)
    requireQty(line.requiredQty, `${line.materialName}应配数量`)
    requireQty(line.preparedQty, `${line.materialName}累计实配`, true)
    requireQty(line.availableQty, `${line.materialName}可用数量`, true)
    requireValue(entry.locationId.trim(), 'MISSING_LOCATION', `${line.materialName}需要选择来源库位`)
    getAccessoryLineAllocations(line)
    requireValue(entry.qty <= getAccessoryPreparationRemaining(line) + EPSILON, 'OVER_PREPARATION', `${line.materialName}本次配料超过待配数量`)
    requireValue(entry.qty <= line.availableQty + EPSILON, 'INSUFFICIENT_STOCK', `${line.materialName}可用数量不足`)
    updates.set(line.id, entry)
  }
  return {
    ...preparation,
    version: preparation.version + 1,
    status: '配料中',
    lines: preparation.lines.map(line => {
      const update = updates.get(line.id)
      if (!update) return { ...line }
      const allocations = getAccessoryLineAllocations(line)
      const existing = allocations.find(allocation => allocation.locationId === update.locationId)
      if (existing) existing.qty = quantity(existing.qty + update.qty)
      else allocations.push({ locationId: update.locationId, qty: update.qty })
      return {
        ...line, preparedQty: quantity(line.preparedQty + update.qty), availableQty: quantity(line.availableQty - update.qty),
        locationId: allocations[0].locationId, allocations,
      }
    }),
    history: [...preparation.history, history(action, '登记配料', entries.map(entry => {
      const line = preparation.lines.find(item => item.id === entry.lineId)!
      return `${line.materialName} ${entry.qty}${line.unit}（${entry.locationId}）`
    }).join('；'))],
  }
}

function preparationTransferLines(preparation: AccessoryPreparation): AccessoryTransferLine[] {
  requireValue(preparation.lines.length, 'EMPTY_PREPARATION', '没有可配料明细')
  uniqueIds(preparation.lines, '配料')
  return preparation.lines.flatMap(line => {
    requireValue(!line.requiresCutting, 'CUTTING_MATERIAL', '需要裁剪的物料不能纳入本次辅料调拨')
    requireQty(line.requiredQty, `${line.materialName}应配数量`)
    requireValue(equalQty(line.requiredQty, line.preparedQty), 'NOT_FULLY_PREPARED', `${line.materialName}尚未逐行配齐`)
    requireValue(line.unit.trim(), 'MISSING_UNIT', `${line.materialName}缺少数量单位`)
    const allocations = getAccessoryLineAllocations(line)
    return allocations.map(allocation => ({
      id: allocations.length === 1 ? line.id : `${line.id}::location:${encodeURIComponent(allocation.locationId)}`,
      sourceLineId: line.id, materialSku: line.materialSku, materialName: line.materialName, imageUrl: line.imageUrl,
      color: line.color, spec: line.spec, unit: line.unit, purpose: line.purpose, requiresCutting: false,
      qty: allocation.qty, fromLocationId: allocation.locationId,
    }))
  })
}

/** 允许显式切换工具为阶段一已配齐记录补建；普通读取不得调用本函数写回。 */
export function completeAccessoryPreparation(
  preparation: AccessoryPreparation,
  action: AccessoryAction & { transferId: string },
  existingTransfer?: AccessoryTransfer | null,
): { preparation: AccessoryPreparation; transfer: AccessoryTransfer } {
  requireAction(action)
  const lines = preparationTransferLines(preparation)
  if (existingTransfer) {
    requireValue(existingTransfer.kind === 'GTP_TO_SITE' && existingTransfer.preparationId === preparation.id && existingTransfer.productionOrderId === preparation.productionOrderId, 'TRANSFER_SOURCE_CONFLICT', '首次调拨来源与配料单不一致')
    requireValue(existingTransfer.lines.length === lines.length && lines.every(line => existingTransfer.lines.some(existing => existing.id === line.id && (existing.sourceLineId ?? existing.id) === line.sourceLineId && existing.materialSku === line.materialSku && existing.unit === line.unit && existing.fromLocationId === line.fromLocationId && equalQty(existing.qty, line.qty))), 'TRANSFER_SOURCE_CONFLICT', '首次调拨明细与配齐版本不一致')
    requireValue(preparation.status === '已配齐', 'TRANSFER_SOURCE_CONFLICT', '调拨已经存在，但配料完成状态不一致')
    return { preparation, transfer: existingTransfer }
  }
  requireValue(action.transferId.trim(), 'MISSING_TRANSFER_ID', '调拨单身份不能为空')
  const destination = getAccessoryWarehouseForCuttingFactory(preparation.cuttingFactoryName)
  requireValue(!preparation.cuttingFactoryId || destination, 'UNKNOWN_FACTORY', '裁剪工厂与辅料仓映射待核对')
  requireValue(!preparation.cuttingFactoryName || preparation.cuttingFactoryId, 'UNKNOWN_FACTORY', '裁剪工厂档案身份待核对')
  const alreadyCompleted = preparation.status === '已配齐'
  const completed: AccessoryPreparation = alreadyCompleted ? preparation : {
    ...preparation, version: preparation.version + 1, status: '已配齐', completedAt: action.at, completedBy: action.by,
    completionVersion: preparation.version + 1,
    history: [...preparation.history, history(action, '完成配齐', '全部辅料逐行配齐，建立整单调拨')],
  }
  return {
    preparation: completed,
    transfer: {
      id: action.transferId, kind: 'GTP_TO_SITE', preparationId: preparation.id, productionOrderId: preparation.productionOrderId,
      fromWarehouse: ACCESSORY_GTP_WAREHOUSE, toWarehouse: destination, status: destination ? '待出库' : '待定调入方', version: 1,
      lines, createdAt: action.at, createdBy: action.by,
      history: [history(action, alreadyCompleted ? '历史已配齐切换补建' : '建立辅料调拨', destination ? `调往${destination}` : '裁剪工厂待定，调入方待定')],
    },
  }
}

export function setAccessoryTransferDestination(transfer: AccessoryTransfer, warehouseCode: string | null, action: AccessoryAction): AccessoryTransfer {
  requireAction(action)
  requireValue(transfer.status === '待定调入方' || transfer.status === '待出库', 'TRANSFER_ALREADY_DISPATCHED', '已经出库的调拨不能改写原目的仓')
  requireValue(warehouseCode === null || [ACCESSORY_HILON_WAREHOUSE, ACCESSORY_MAHAMERU_WAREHOUSE].includes(warehouseCode), 'INVALID_DESTINATION', '目的辅料仓待核对')
  requireValue(transfer.kind === 'GTP_TO_SITE', 'INVALID_TRANSFER_KIND', '这里只能更新 GTP 首次调拨的目的方')
  if (transfer.toWarehouse === warehouseCode) return transfer
  return {
    ...transfer, toWarehouse: warehouseCode, status: warehouseCode ? '待出库' : '待定调入方', version: transfer.version + 1,
    history: [...transfer.history, history(action, '更新调入方', `${transfer.toWarehouse ?? '待定'} → ${warehouseCode ?? '待定'}`)],
  }
}

/** 创建调拨不扣库存；整单实际出库之前由外层读取同事务中的逐行可用余额。 */
export function dispatchAccessoryTransfer(transfer: AccessoryTransfer, action: AccessoryAction, availableByLine: Readonly<Record<string, number>>): AccessoryTransfer {
  requireAction(action)
  requireValue(transfer.status === '待出库', 'TRANSFER_NOT_DISPATCHABLE', transfer.status === '待定调入方' ? '调入方待定，不能出库' : '当前调拨不能再次出库')
  requireValue(transfer.toWarehouse && transfer.toWarehouse !== transfer.fromWarehouse, 'INVALID_DESTINATION', '调入方缺失或与发出仓相同')
  requireTransferRoute(transfer)
  requireTransferLines(transfer)
  for (const line of transfer.lines) {
    const available = availableByLine[line.id]
    requireQty(available, `${line.materialName}可用数量`, true)
    requireValue(available + EPSILON >= line.qty, 'INSUFFICIENT_STOCK', `${line.materialName}可用数量不足，整单未出库`)
  }
  return {
    ...transfer, status: '已出库待收货', version: transfer.version + 1, dispatchedAt: action.at, dispatchedBy: action.by,
    history: [...transfer.history, history(action, '整单出库', `${transfer.fromWarehouse} → ${transfer.toWarehouse}`)],
  }
}

export function receiveAccessoryTransfer(transfer: AccessoryTransfer, action: AccessoryAction & {
  warehouseCode: string; lines: readonly AccessoryReceiptLine[]; locations: readonly AccessoryLocation[]
}): AccessoryTransfer {
  requireAction(action)
  requireValue(transfer.status === '已出库待收货', 'TRANSFER_NOT_RECEIVABLE', '仅已实际出库的调拨可以收货，不能重复接收')
  requireValue(action.warehouseCode === transfer.toWarehouse, 'WRONG_RECEIVING_WAREHOUSE', '当前仓库不是这张调拨单的目的仓')
  requireTransferRoute(transfer)
  requireTransferLines(transfer)
  requireValue(action.lines.length === transfer.lines.length && new Set(action.lines.map(line => line.lineId)).size === transfer.lines.length, 'PARTIAL_TRANSFER', '调拨必须整单核对并收货，不能分批')
  const locations = new Map(action.locations.map(location => [location.id, location]))
  const receipts = new Map(action.lines.map(line => [line.lineId, line]))
  for (const line of transfer.lines) {
    const received = receipts.get(line.id)
    requireValue(received, 'PARTIAL_TRANSFER', '收货明细不完整，整单未入库')
    requireQty(received.qty, `${line.materialName}实收数量`)
    requireValue(equalQty(received.qty, line.qty), 'RECEIPT_DIFFERENCE', `${line.materialName}实收与应收不一致，整单未入库`)
    const location = locations.get(received.locationId)
    requireValue(location?.enabled && location.warehouseCode === action.warehouseCode, 'INVALID_RECEIVING_LOCATION', `${line.materialName}需要选择本仓启用库位`)
  }
  return {
    ...transfer, status: '已收货', version: transfer.version + 1, receivedAt: action.at, receivedBy: action.by,
    lines: transfer.lines.map(line => ({ ...line, toLocationId: receipts.get(line.id)!.locationId })),
    history: [...transfer.history, history(action, '收货入库并上架', action.warehouseCode)],
  }
}

/** 必须使用正式用途；不通过物料名称关键字推断。 */
export function splitAccessoryLinesForTask<T extends { purpose: AccessoryPurpose; requiresCutting: boolean }>(lines: readonly T[], taskType: AccessoryTaskType): { sewingLines: T[]; postLines: T[] } {
  requireValue(['SEWING', 'SEWING_IRONING_PACKING', 'CUTTING_SEWING_IRONING_PACKING'].includes(taskType), 'UNKNOWN_TASK_TYPE', '车缝任务责任待核对')
  const accessories = lines.filter(line => !line.requiresCutting)
  requireValue(accessories.every(line => line.purpose !== '待核对'), 'UNKNOWN_PURPOSE', '有辅料用途待核对，不能生成领料或后道清单')
  if (taskType !== 'SEWING') return { sewingLines: [...accessories], postLines: [] }
  return {
    sewingLines: accessories.filter(line => POST_EXCLUDED_PURPOSES.has(line.purpose)),
    postLines: accessories.filter(line => !POST_EXCLUDED_PURPOSES.has(line.purpose)),
  }
}

function scopedTransferLines(lines: readonly AccessoryTransferLine[], quantitiesByLine: Readonly<Record<string, number>>): AccessoryTransferLine[] {
  requireValue(Object.keys(quantitiesByLine).every(id => lines.some(line => line.id === id)), 'UNKNOWN_LINE', '任务数量包含不属于本次清单的明细')
  const scoped: AccessoryTransferLine[] = []
  for (const line of lines) {
    const qty = quantitiesByLine[line.id] ?? 0
    requireQty(qty, `${line.materialName}任务范围数量`, true)
    requireValue(qty <= line.qty + EPSILON, 'OVER_TASK_QUANTITY', `${line.materialName}任务范围数量超过来源调拨`)
    if (qty > 0) scoped.push({ ...line, qty, fromLocationId: line.toLocationId ?? line.fromLocationId, toLocationId: undefined })
  }
  return scoped
}

export function createAccessoryPickup(transfer: AccessoryTransfer, input: {
  id: string; taskId: string; assignmentId: string; taskVersion: string; taskType: AccessoryTaskType;
  factoryId: string; factoryName: string; quantitiesByLine: Readonly<Record<string, number>>
}): AccessoryPickup {
  requireValue(transfer.status === '已收货' && isSiteWarehouse(transfer.toWarehouse), 'SOURCE_NOT_RECEIVED', '本仓收货上架后才能生成车缝领料')
  requireTransferLines(transfer)
  requireValue(input.id.trim() && input.taskId.trim() && input.assignmentId.trim() && input.taskVersion.trim() && input.factoryId.trim() && input.factoryName.trim(), 'TASK_NOT_ASSIGNED', '需要有效车缝任务、分配版本及领料工厂')
  const split = splitAccessoryLinesForTask(transfer.lines, input.taskType)
  const lines = scopedTransferLines(split.sewingLines, input.quantitiesByLine)
  requireValue(lines.length, 'EMPTY_PICKUP', '当前任务没有应领辅料')
  return {
    id: input.id, preparationId: transfer.preparationId, productionOrderId: transfer.productionOrderId, sourceTransferId: transfer.id,
    warehouseCode: transfer.toWarehouse!, taskId: input.taskId, assignmentId: input.assignmentId, taskVersion: input.taskVersion,
    factoryId: input.factoryId, factoryName: input.factoryName, version: 1, status: '待领料',
    lines: lines.map(line => ({ ...line, requiredQty: line.qty, handedQty: 0 })), history: [],
  }
}

export function recordAccessoryPickup(pickup: AccessoryPickup, input: AccessoryAction & {
  taskVersion: string; role: 'WAREHOUSE' | 'PPIC' | 'FACTORY'; entries: readonly { lineId: string; qty: number }[]
}, availableByLine: Readonly<Record<string, number>>): AccessoryPickup {
  requireAction(input)
  requireValue(input.role === 'WAREHOUSE', 'WAREHOUSE_CONFIRMATION_REQUIRED', '车缝领料须由交出仓库确认，PPIC或领料工厂不能代确认')
  requireValue(input.taskVersion === pickup.taskVersion, 'STALE_TASK_VERSION', '任务范围已变化，请重新读取当前领料清单')
  requireValue(pickup.status !== '已领料', 'PICKUP_COMPLETED', '当前清单已经全部领料')
  requireValue(pickup.status !== '已失效', 'STALE_TASK_VERSION', '原领料清单已失效，请读取当前领料清单')
  uniqueIds(pickup.lines, '领料')
  requireValue(input.entries.length && new Set(input.entries.map(entry => entry.lineId)).size === input.entries.length, 'DUPLICATE_LINE', '本次领料明细为空或重复')
  const entries = new Map(input.entries.map(entry => [entry.lineId, entry.qty]))
  for (const entry of input.entries) {
    const line = pickup.lines.find(item => item.id === entry.lineId)
    requireValue(line, 'UNKNOWN_LINE', '领料明细已变化，请重新读取')
    requireQty(entry.qty, `${line.materialName}本次实交`)
    requireValue(entry.qty <= line.requiredQty - line.handedQty + EPSILON, 'OVER_PICKUP', `${line.materialName}本次领料超过剩余应领`)
    requireQty(availableByLine[line.id], `${line.materialName}可用数量`, true)
    requireValue(entry.qty <= availableByLine[line.id] + EPSILON, 'INSUFFICIENT_STOCK', `${line.materialName}仓内可用数量不足`)
  }
  const lines = pickup.lines.map(line => ({ ...line, handedQty: quantity(line.handedQty + (entries.get(line.id) ?? 0)) }))
  return {
    ...pickup, lines, version: pickup.version + 1, status: lines.every(line => equalQty(line.requiredQty, line.handedQty)) ? '已领料' : '领料中',
    history: [...pickup.history, history(input, '车缝领料实交', input.entries.map(entry => {
      const line = pickup.lines.find(item => item.id === entry.lineId)!
      return `${line.materialName} ${entry.qty}${line.unit}`
    }).join('；'))],
  }
}

export function createAccessoryPostTransfer(transfer: AccessoryTransfer, input: AccessoryAction & {
  id: string; taskType: AccessoryTaskType; responsibilityKey: string; quantitiesByLine: Readonly<Record<string, number>>
}): AccessoryTransfer {
  requireAction(input)
  requireValue(transfer.status === '已收货' && isSiteWarehouse(transfer.toWarehouse), 'SOURCE_NOT_RECEIVED', '本仓收货上架后才能建立后道调拨')
  requireTransferLines(transfer)
  requireValue(input.taskType === 'SEWING', 'NO_POST_SPLIT', '当前任务责任包含烫包，不走独立车缝后道分流')
  requireValue(input.id.trim() && input.responsibilityKey.trim(), 'MISSING_TRANSFER_ID', '缺少后道调拨身份或有效责任来源')
  const lines = scopedTransferLines(splitAccessoryLinesForTask(transfer.lines, input.taskType).postLines, input.quantitiesByLine)
  requireValue(lines.length, 'EMPTY_TRANSFER', '当前任务没有应调后道的辅料')
  return {
    id: input.id, kind: 'SITE_TO_POST', preparationId: transfer.preparationId, productionOrderId: transfer.productionOrderId,
    sourceTransferId: transfer.id, fromWarehouse: transfer.toWarehouse!, toWarehouse: ACCESSORY_POST_WAREHOUSE,
    status: '待出库', version: 1, lines, createdAt: input.at, createdBy: input.by, responsibilityKey: input.responsibilityKey,
    history: [history(input, '建立后道调拨', '按有效独立车缝任务范围排除四类辅料')],
  }
}

export function createAccessoryReassignmentTransfer(transfer: AccessoryTransfer, change: AccessoryReassignment, action: AccessoryAction & { transferId: string }): AccessoryTransfer {
  requireAction(action)
  requireValue(transfer.id === change.sourceTransferId && transfer.status === '已收货' && transfer.toWarehouse === change.fromWarehouse, 'SOURCE_NOT_RECEIVED', '原目的仓须先收货上架，再向新仓调拨')
  requireValue(isSiteWarehouse(change.fromWarehouse) && isSiteWarehouse(change.toWarehouse) && change.fromWarehouse !== change.toWarehouse && action.transferId.trim(), 'INVALID_DESTINATION', '仓间调拨身份或目的仓不正确')
  requireTransferLines(transfer)
  requireValue(transfer.lines.every(line => line.toLocationId?.trim()), 'MISSING_LOCATION', '原仓入库库位缺失，需核对接收记录')
  return {
    id: action.transferId, kind: 'SITE_REASSIGN', preparationId: transfer.preparationId, productionOrderId: transfer.productionOrderId,
    sourceTransferId: transfer.id, changeId: change.id, fromWarehouse: change.fromWarehouse, toWarehouse: change.toWarehouse,
    status: '待出库', version: 1, createdAt: action.at, createdBy: action.by,
    lines: transfer.lines.map(line => ({ ...line, fromLocationId: line.toLocationId!, toLocationId: undefined })),
    history: [history(action, '改厂仓间调拨', `${change.reason}；${change.fromWarehouse} → ${change.toWarehouse}`)],
  }
}

/** 外层同时核对有效任务版本及旧预入库，按返回结果在同事务更新。 */
export function planAccessoryCuttingFactoryChange(preparation: AccessoryPreparation, transfer: AccessoryTransfer | null, input: AccessoryAction & {
  changeId: string; transferId: string; newFactoryId: string; newFactoryName: string; reason: string;
  releasedQtyByLine: Readonly<Record<string, number>>
}): {
  mode: 'NO_TRANSFER' | 'UNCHANGED_DESTINATION' | 'UPDATE_DESTINATION' | 'WAIT_ORIGINAL_RECEIPT' | 'CREATE_REASSIGN_TRANSFER'
  preparation: AccessoryPreparation; currentTransfer: AccessoryTransfer | null; onwardTransfer: AccessoryTransfer | null;
  reassignment: AccessoryReassignment | null; cancelledReceipt: { transferId: string; warehouseCode: string; reason: string } | null
} {
  requireAction(input)
  const destination = getAccessoryWarehouseForCuttingFactory(input.newFactoryName)
  requireValue(input.changeId.trim() && input.newFactoryId.trim() && input.reason.trim() && destination, 'INVALID_FACTORY_CHANGE', '需要明确的新裁剪工厂、变更原因与变更身份')
  requireValue(Object.values(input.releasedQtyByLine).every(qty => Number.isFinite(qty) && qty >= 0), 'INVALID_QUANTITY', '已交出数量待核对')
  requireValue(Object.values(input.releasedQtyByLine).every(qty => qty <= EPSILON), 'ALREADY_RELEASED', '已有辅料交给三方或后道，不能按原整包改厂；请先核对实际去向')
  const nextPreparation: AccessoryPreparation = {
    ...preparation, version: preparation.version + 1, cuttingFactoryId: input.newFactoryId, cuttingFactoryName: input.newFactoryName,
    history: [...preparation.history, history(input, '裁剪工厂变更', `${preparation.cuttingFactoryName ?? '待定'} → ${input.newFactoryName}；${input.reason}`)],
  }
  const result = { preparation: nextPreparation, currentTransfer: transfer, onwardTransfer: null as AccessoryTransfer | null, reassignment: null as AccessoryReassignment | null, cancelledReceipt: null as { transferId: string; warehouseCode: string; reason: string } | null }
  if (!transfer) return { ...result, mode: 'NO_TRANSFER' }
  requireValue(transfer.preparationId === preparation.id && transfer.productionOrderId === preparation.productionOrderId && transfer.kind !== 'SITE_TO_POST', 'TRANSFER_SOURCE_CONFLICT', '当前调拨不是该生产单的有效辅料流转')
  if (transfer.toWarehouse === destination) return { ...result, mode: 'UNCHANGED_DESTINATION' }
  if (transfer.status === '待定调入方' || transfer.status === '待出库') {
    requireValue(transfer.kind === 'GTP_TO_SITE', 'REASSIGNMENT_IN_PROGRESS', '已有仓间改厂调拨待办理，请先完成当前流转')
    return {
      ...result, mode: 'UPDATE_DESTINATION', currentTransfer: setAccessoryTransferDestination(transfer, destination, input),
      cancelledReceipt: transfer.toWarehouse ? { transferId: transfer.id, warehouseCode: transfer.toWarehouse, reason: input.reason } : null,
    }
  }
  requireValue(transfer.toWarehouse, 'INVALID_DESTINATION', '原调拨目的仓缺失，需核对历史')
  const reassignment: AccessoryReassignment = {
    id: input.changeId, sourceTransferId: transfer.id, fromWarehouse: transfer.toWarehouse, toWarehouse: destination,
    newFactoryId: input.newFactoryId, newFactoryName: input.newFactoryName, reason: input.reason, at: input.at, by: input.by,
    status: transfer.status === '已收货' ? '待仓间调拨' : '等待原仓收货',
  }
  if (transfer.status === '已出库待收货') return { ...result, mode: 'WAIT_ORIGINAL_RECEIPT', reassignment }
  return { ...result, mode: 'CREATE_REASSIGN_TRANSFER', reassignment, onwardTransfer: createAccessoryReassignmentTransfer(transfer, reassignment, { ...input, transferId: input.transferId }) }
}
