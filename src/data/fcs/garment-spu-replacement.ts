import { productionOrders } from './production-orders.ts'
import { listSkuArchives } from '../pcs-sku-archive-repository.ts'

export type GarmentReplacementStatus = 'RELABELING' | 'COMPLETED'
export type GarmentWarehouseRelabelStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED'
export type GarmentReplacementIdentityStage =
  | 'PRINT'
  | 'FUTURE_RETURN'
  | 'DEFECT'
  | 'POST_FACTORY'
  | 'FINISHED_WAREHOUSE'

export interface GarmentReplacementIdentity {
  spuCode: string
  spuName: string
  skuCode: string
  color: string
  size: string
  imageUrl: string
  shipmentBarcode: string
  retailBarcode: string
  suggestedRetailPrice: number
  currency: string
}

export interface GarmentReplacementQuantitySplit {
  soldHistoryQty: number
  finishedWarehouseQty: number
  postFactoryQty: number
  remainingReturnQty: number
}

export interface GarmentSpuReplacementLine extends GarmentReplacementQuantitySplit {
  lineId: string
  size: string
  originalDemandQty: number
  source: GarmentReplacementIdentity
  target: GarmentReplacementIdentity
  replacementRequired: boolean
  postRelabeledQty: number
}

export interface GarmentReplacementEvidence {
  evidenceId: string
  fileName: string
  imageUrl?: string
  uploadedAt: string
  uploadedBy: string
}

export interface GarmentIdentityMigrationAudit {
  auditId: string
  objectType: string
  objectId: string
  size: string
  originalSpuCode: string
  originalSkuCode: string
  currentSpuCode: string
  currentSkuCode: string
  migratedAt: string
  reason: string
}

export interface GarmentSpuReplacementRecord {
  replacementId: string
  replacementNo: string
  productionOrderId: string
  productionOrderNo: string
  scopeKey: string
  sourceSpuCode: string
  sourceSpuName: string
  sourceColor: string
  targetSpuCode: string
  targetSpuName: string
  targetColor: string
  originalDemandQty: number
  status: GarmentReplacementStatus
  reason: string
  evidence: GarmentReplacementEvidence[]
  lines: GarmentSpuReplacementLine[]
  migrationAudits: GarmentIdentityMigrationAudit[]
  createdAt: string
  createdBy: string
  completedAt: string
}

export interface GarmentWarehouseInventoryBatch {
  inventoryBatchId: string
  sourceInboundBatchId: string
  replacementId: string
  productionOrderId: string
  size: string
  qty: number
  originalIdentity: GarmentReplacementIdentity
  currentIdentity: GarmentReplacementIdentity
  relabeled: boolean
}

export interface GarmentWarehouseMovement {
  movementId: string
  movementType: 'OLD_SKU_OUTBOUND' | 'NEW_SKU_INBOUND'
  replacementId: string
  relabelTaskId: string
  inventoryBatchId: string
  sourceInboundBatchId: string
  qty: number
  identity: GarmentReplacementIdentity
  occurredAt: string
  operatorName: string
}

export interface GarmentWarehouseRelabelTaskLine {
  taskLineId: string
  inventoryBatchId: string
  sourceInboundBatchId: string
  size: string
  qty: number
  source: GarmentReplacementIdentity
  target: GarmentReplacementIdentity
  status: GarmentWarehouseRelabelStatus
}

export interface GarmentWarehouseRelabelTask {
  relabelTaskId: string
  relabelTaskNo: string
  replacementId: string
  productionOrderId: string
  productionOrderNo: string
  sourceColor: string
  status: GarmentWarehouseRelabelStatus
  lines: GarmentWarehouseRelabelTaskLine[]
  createdAt: string
  completedAt: string
}

export interface GarmentReplacementStoreSnapshot {
  version: 1
  records: GarmentSpuReplacementRecord[]
  inventoryBatches: GarmentWarehouseInventoryBatch[]
  relabelTasks: GarmentWarehouseRelabelTask[]
  warehouseMovements: GarmentWarehouseMovement[]
}

export interface GarmentReplacementPreview {
  productionOrderId: string
  productionOrderNo: string
  sourceSpuCode: string
  sourceSpuName: string
  sourceColor: string
  targetSpuCode: string
  targetSpuName: string
  targetColor: string
  lines: GarmentSpuReplacementLine[]
  totals: GarmentReplacementQuantitySplit & { originalDemandQty: number; replacementQty: number }
}

export interface GarmentPrintRow {
  replacementId: string
  productionOrderId: string
  productionOrderNo: string
  size: string
  qty: number
  identity: GarmentReplacementIdentity
  originalIdentity: GarmentReplacementIdentity
}

export interface GarmentSalesOutboundGuard {
  allowed: boolean
  reason: string
  relabelTaskId?: string
  relabelTaskNo?: string
}

const STORAGE_KEY = 'higood-fcs-garment-spu-replacement-v1'
const DEFAULT_QUANTITY_SPLITS: Record<string, GarmentReplacementQuantitySplit> = {
  S: { soldHistoryQty: 300, finishedWarehouseQty: 300, postFactoryQty: 0, remainingReturnQty: 400 },
  M: { soldHistoryQty: 400, finishedWarehouseQty: 350, postFactoryQty: 300, remainingReturnQty: 450 },
  L: { soldHistoryQty: 350, finishedWarehouseQty: 300, postFactoryQty: 250, remainingReturnQty: 600 },
  XL: { soldHistoryQty: 200, finishedWarehouseQty: 200, postFactoryQty: 150, remainingReturnQty: 450 },
}

let memorySnapshot: GarmentReplacementStoreSnapshot | null = null

function emptySnapshot(): GarmentReplacementStoreSnapshot {
  return { version: 1, records: [], inventoryBatches: [], relabelTasks: [], warehouseMovements: [] }
}

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
    && typeof localStorage.getItem === 'function'
    && typeof localStorage.setItem === 'function'
    && typeof localStorage.removeItem === 'function'
}

function cloneSnapshot(snapshot: GarmentReplacementStoreSnapshot): GarmentReplacementStoreSnapshot {
  return structuredClone(snapshot)
}

function loadSnapshot(): GarmentReplacementStoreSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)
  if (canUseStorage()) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as GarmentReplacementStoreSnapshot
        if (parsed.version === 1 && Array.isArray(parsed.records)) {
          memorySnapshot = cloneSnapshot(parsed)
          return cloneSnapshot(parsed)
        }
      }
    } catch {
      // 原型环境存储损坏时回到空白状态，不伪造业务记录。
    }
  }
  memorySnapshot = emptySnapshot()
  return cloneSnapshot(memorySnapshot)
}

function persistSnapshot(snapshot: GarmentReplacementStoreSnapshot): void {
  memorySnapshot = cloneSnapshot(snapshot)
  if (canUseStorage()) localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

function nowText(): string {
  return new Date().toLocaleString('zh-CN', { hour12: false }).replaceAll('/', '-')
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function sumLine(line: GarmentReplacementQuantitySplit): number {
  return line.soldHistoryQty + line.finishedWarehouseQty + line.postFactoryQty + line.remainingReturnQty
}

function autoShipmentBarcode(retailBarcode: string, skuCode: string): string {
  const digits = (retailBarcode || skuCode).replace(/\D/g, '')
  const fallback = Array.from(skuCode).reduce((sum, char) => sum + char.charCodeAt(0), 0).toString()
  return `HG${(digits || fallback).slice(-8).padStart(8, '0')}`
}

function identityFromSku(sku: ReturnType<typeof listSkuArchives>[number]): GarmentReplacementIdentity {
  return {
    spuCode: sku.styleCode,
    spuName: sku.styleName,
    skuCode: sku.skuCode,
    color: sku.colorName,
    size: sku.sizeName,
    imageUrl: sku.skuImageUrl,
    shipmentBarcode: autoShipmentBarcode(sku.barcode, sku.skuCode),
    retailBarcode: sku.barcode,
    suggestedRetailPrice: sku.suggestedRetailPrice,
    currency: sku.currency,
  }
}

function fallbackSourceIdentity(input: {
  spuCode: string
  spuName: string
  skuCode: string
  color: string
  size: string
}): GarmentReplacementIdentity {
  const sku = listSkuArchives().find((item) => item.skuCode === input.skuCode)
  if (sku) return identityFromSku(sku)
  return {
    spuCode: input.spuCode,
    spuName: input.spuName,
    skuCode: input.skuCode,
    color: input.color,
    size: input.size,
    imageUrl: '/tshirt-sample.jpg',
    shipmentBarcode: autoShipmentBarcode('', input.skuCode),
    retailBarcode: input.skuCode,
    suggestedRetailPrice: 0,
    currency: 'IDR',
  }
}

function getOrder(productionOrderId: string) {
  const order = productionOrders.find((item) => item.productionOrderId === productionOrderId || item.productionOrderNo === productionOrderId)
  if (!order) throw new Error('未找到生产单，无法发起整色替换。')
  return order
}

function resolveTargetSku(input: { targetSpuCode: string; targetColor: string; size: string }) {
  const matches = listSkuArchives().filter((sku) =>
    sku.archiveStatus === 'ACTIVE'
    && sku.styleCode === input.targetSpuCode
    && normalize(sku.colorName) === normalize(input.targetColor)
    && normalize(sku.sizeName) === normalize(input.size),
  )
  if (matches.length !== 1) {
    throw new Error(`目标商品中心中 ${input.targetColor}/${input.size} 必须且只能找到一个有效 SKU，当前找到 ${matches.length} 个。`)
  }
  return matches[0]
}

function buildSplit(size: string, originalDemandQty: number, useDefaultSplit: boolean): GarmentReplacementQuantitySplit {
  const preset = useDefaultSplit ? DEFAULT_QUANTITY_SPLITS[size] : undefined
  if (!preset) return { soldHistoryQty: 0, finishedWarehouseQty: 0, postFactoryQty: 0, remainingReturnQty: originalDemandQty }
  if (sumLine(preset) !== originalDemandQty) throw new Error(`${size} 码 A/B/C/D 数量与生产需求数量不守恒。`)
  return { ...preset }
}

function recomputeRecordStatus(record: GarmentSpuReplacementRecord, task?: GarmentWarehouseRelabelTask): void {
  const postDone = record.lines.every((line) => line.postRelabeledQty === line.postFactoryQty)
  const warehouseDone = !task || task.status === 'COMPLETED'
  record.status = postDone && warehouseDone ? 'COMPLETED' : 'RELABELING'
  record.completedAt = record.status === 'COMPLETED' ? (record.completedAt || nowText()) : ''
}

export function buildGarmentReplacementPreview(input: {
  productionOrderId: string
  sourceColor: string
  targetSpuCode: string
  targetColor: string
}): GarmentReplacementPreview {
  const order = getOrder(input.productionOrderId)
  const sourceLines = order.demandSnapshot.skuLines.filter((line) => normalize(line.color) === normalize(input.sourceColor))
  if (!sourceLines.length) throw new Error('生产单中没有所选源颜色。')
  const useDefaultSplit = order.productionOrderId === 'PO-202603-0001' && normalize(input.sourceColor) === 'white'
  const lines = sourceLines.map((sourceLine, index): GarmentSpuReplacementLine => {
    const split = buildSplit(sourceLine.size, sourceLine.qty, useDefaultSplit)
    const replacementQty = split.finishedWarehouseQty + split.postFactoryQty + split.remainingReturnQty
    // 只对确实要替换的 B/C/D 数量要求目标尺码；纯 A 类历史数量不增加商品门禁。
    const targetSku = replacementQty > 0
      ? resolveTargetSku({ targetSpuCode: input.targetSpuCode, targetColor: input.targetColor, size: sourceLine.size })
      : null
    const source = fallbackSourceIdentity({
      spuCode: order.demandSnapshot.spuCode,
      spuName: order.demandSnapshot.spuName,
      skuCode: sourceLine.skuCode,
      color: sourceLine.color,
      size: sourceLine.size,
    })
    return {
      lineId: `GRP-PREVIEW-${index + 1}-${sourceLine.size}`,
      size: sourceLine.size,
      originalDemandQty: sourceLine.qty,
      ...split,
      source,
      target: targetSku ? identityFromSku(targetSku) : structuredClone(source),
      replacementRequired: replacementQty > 0,
      postRelabeledQty: 0,
    }
  })
  const totals = lines.reduce((result, line) => ({
    soldHistoryQty: result.soldHistoryQty + line.soldHistoryQty,
    finishedWarehouseQty: result.finishedWarehouseQty + line.finishedWarehouseQty,
    postFactoryQty: result.postFactoryQty + line.postFactoryQty,
    remainingReturnQty: result.remainingReturnQty + line.remainingReturnQty,
    originalDemandQty: result.originalDemandQty + line.originalDemandQty,
    replacementQty: result.replacementQty + line.finishedWarehouseQty + line.postFactoryQty + line.remainingReturnQty,
  }), { soldHistoryQty: 0, finishedWarehouseQty: 0, postFactoryQty: 0, remainingReturnQty: 0, originalDemandQty: 0, replacementQty: 0 })
  const firstTarget = lines.find((line) => line.replacementRequired)?.target
  if (!firstTarget) throw new Error('所选颜色当前只有已销售历史数量，没有可执行替换的 B/C/D 数量。')
  return {
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    sourceSpuCode: order.demandSnapshot.spuCode,
    sourceSpuName: order.demandSnapshot.spuName,
    sourceColor: input.sourceColor,
    targetSpuCode: firstTarget.spuCode,
    targetSpuName: firstTarget.spuName,
    targetColor: input.targetColor,
    lines,
    totals,
  }
}

export function createGarmentSpuReplacement(input: {
  productionOrderId: string
  sourceColor: string
  targetSpuCode: string
  targetColor: string
  reason: string
  evidenceFileName?: string
  evidenceImageUrl?: string
  operatorName: string
  occurredAt?: string
}): GarmentSpuReplacementRecord {
  if (!input.reason.trim()) throw new Error('必须填写 SPU 替换原因。')
  const preview = buildGarmentReplacementPreview(input)
  if (preview.sourceSpuCode === preview.targetSpuCode && normalize(preview.sourceColor) === normalize(preview.targetColor)) {
    throw new Error('目标 SPU 和颜色不能与源商品完全相同。')
  }
  const snapshot = loadSnapshot()
  const scopeKey = `${preview.productionOrderId}::${normalize(preview.sourceColor)}`
  if (snapshot.records.some((record) => record.scopeKey === scopeKey)) {
    throw new Error('该生产单与颜色已经存在整色替换记录，不能重复发起。')
  }
  const occurredAt = input.occurredAt || nowText()
  const replacementId = `GRP-${String(snapshot.records.length + 1).padStart(6, '0')}`
  const record: GarmentSpuReplacementRecord = {
    replacementId,
    replacementNo: `成衣替换-${String(snapshot.records.length + 1).padStart(4, '0')}`,
    productionOrderId: preview.productionOrderId,
    productionOrderNo: preview.productionOrderNo,
    scopeKey,
    sourceSpuCode: preview.sourceSpuCode,
    sourceSpuName: preview.sourceSpuName,
    sourceColor: preview.sourceColor,
    targetSpuCode: preview.targetSpuCode,
    targetSpuName: preview.targetSpuName,
    targetColor: preview.targetColor,
    originalDemandQty: preview.totals.originalDemandQty,
    status: 'RELABELING',
    reason: input.reason.trim(),
    evidence: input.evidenceFileName?.trim() ? [{
      evidenceId: `${replacementId}-EVIDENCE-1`,
      fileName: input.evidenceFileName.trim(),
      imageUrl: input.evidenceImageUrl,
      uploadedAt: occurredAt,
      uploadedBy: input.operatorName,
    }] : [],
    lines: preview.lines.map((line, index) => ({ ...structuredClone(line), lineId: `${replacementId}-LINE-${index + 1}` })),
    migrationAudits: [],
    createdAt: occurredAt,
    createdBy: input.operatorName,
    completedAt: '',
  }
  snapshot.records.push(record)
  const warehouseLines = record.lines.flatMap((line, index) => {
    if (line.finishedWarehouseQty <= 0 || !line.target) return []
    const inventoryBatchId = `${replacementId}-INV-${String(index + 1).padStart(2, '0')}`
    const sourceInboundBatchId = `FIN-IN-${preview.productionOrderId.replace(/[^A-Za-z0-9]/g, '')}-${line.size}-01`
    snapshot.inventoryBatches.push({
      inventoryBatchId,
      sourceInboundBatchId,
      replacementId,
      productionOrderId: preview.productionOrderId,
      size: line.size,
      qty: line.finishedWarehouseQty,
      originalIdentity: structuredClone(line.source),
      currentIdentity: structuredClone(line.source),
      relabeled: false,
    })
    return [{
      taskLineId: `${replacementId}-WMS-LINE-${index + 1}`,
      inventoryBatchId,
      sourceInboundBatchId,
      size: line.size,
      qty: line.finishedWarehouseQty,
      source: structuredClone(line.source),
      target: structuredClone(line.target),
      status: 'PENDING' as GarmentWarehouseRelabelStatus,
    }]
  })
  if (warehouseLines.length) {
    snapshot.relabelTasks.push({
      relabelTaskId: `${replacementId}-WMS`,
      relabelTaskNo: `成衣仓换码-${String(snapshot.relabelTasks.length + 1).padStart(4, '0')}`,
      replacementId,
      productionOrderId: record.productionOrderId,
      productionOrderNo: record.productionOrderNo,
      sourceColor: record.sourceColor,
      status: 'PENDING',
      lines: warehouseLines,
      createdAt: occurredAt,
      completedAt: '',
    })
  }
  recomputeRecordStatus(record, snapshot.relabelTasks.find((task) => task.replacementId === replacementId))
  persistSnapshot(snapshot)
  return structuredClone(record)
}

export function listGarmentSpuReplacements(): GarmentSpuReplacementRecord[] {
  return loadSnapshot().records.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getGarmentSpuReplacement(id: string): GarmentSpuReplacementRecord | null {
  const record = loadSnapshot().records.find((item) => item.replacementId === id || item.replacementNo === id)
  return record ? structuredClone(record) : null
}

export function getActiveGarmentReplacement(productionOrderId: string, color: string): GarmentSpuReplacementRecord | null {
  return listGarmentSpuReplacements().find((record) =>
    (record.productionOrderId === productionOrderId || record.productionOrderNo === productionOrderId)
    && normalize(record.sourceColor) === normalize(color),
  ) || null
}

export function resolveEffectiveGarmentIdentity(input: {
  productionOrderId: string
  color: string
  size: string
  stage: GarmentReplacementIdentityStage
}): GarmentReplacementIdentity | null {
  const record = getActiveGarmentReplacement(input.productionOrderId, input.color)
  const line = record?.lines.find((item) => normalize(item.size) === normalize(input.size))
  if (!record || !line) return null
  if (!line.target) return structuredClone(line.source)
  if (input.stage === 'POST_FACTORY' && line.postRelabeledQty < line.postFactoryQty) return structuredClone(line.source)
  if (input.stage === 'FINISHED_WAREHOUSE') {
    const batch = loadSnapshot().inventoryBatches.find((item) => item.replacementId === record.replacementId && normalize(item.size) === normalize(input.size))
    return structuredClone(batch?.currentIdentity || line.source)
  }
  return structuredClone(line.target)
}

export function resolveOriginalSkuForReturnedSku(productionOrderId: string, skuCode: string): string {
  for (const record of listGarmentSpuReplacements()) {
    if (record.productionOrderId !== productionOrderId && record.productionOrderNo !== productionOrderId) continue
    const line = record.lines.find((item) => item.target?.skuCode === skuCode)
    if (line) return line.source.skuCode
  }
  return skuCode
}

export function completePostFactoryRelabel(input: { replacementId: string; operatorName: string; occurredAt?: string }): GarmentSpuReplacementRecord {
  const snapshot = loadSnapshot()
  const record = snapshot.records.find((item) => item.replacementId === input.replacementId)
  if (!record) throw new Error('未找到成衣 SPU 替换记录。')
  record.lines.forEach((line) => { line.postRelabeledQty = line.postFactoryQty })
  recomputeRecordStatus(record, snapshot.relabelTasks.find((task) => task.replacementId === record.replacementId))
  persistSnapshot(snapshot)
  return structuredClone(record)
}

export function isPostFactoryRelabelPending(productionOrderId: string, color?: string): boolean {
  return listGarmentSpuReplacements().some((record) =>
    (record.productionOrderId === productionOrderId || record.productionOrderNo === productionOrderId)
    && (!color || normalize(record.sourceColor) === normalize(color))
    && record.lines.some((line) => line.postRelabeledQty < line.postFactoryQty),
  )
}

export function appendGarmentIdentityMigrationAudits(input: {
  replacementId: string
  candidates: Array<{
    objectType: string
    objectId: string
    size: string
    originalSpuCode?: string
    originalSkuCode?: string
  }>
  occurredAt?: string
}): GarmentIdentityMigrationAudit[] {
  const snapshot = loadSnapshot()
  const record = snapshot.records.find((item) => item.replacementId === input.replacementId)
  if (!record) throw new Error('未找到成衣 SPU 替换记录。')
  const occurredAt = input.occurredAt || nowText()
  input.candidates.forEach((candidate) => {
    if (record.migrationAudits.some((item) => item.objectType === candidate.objectType && item.objectId === candidate.objectId && normalize(item.size) === normalize(candidate.size))) return
    const line = record.lines.find((item) => normalize(item.size) === normalize(candidate.size))
    if (!line?.target) return
    record.migrationAudits.push({
      auditId: `${record.replacementId}-MIG-${String(record.migrationAudits.length + 1).padStart(4, '0')}`,
      objectType: candidate.objectType,
      objectId: candidate.objectId,
      size: candidate.size,
      originalSpuCode: candidate.originalSpuCode || line.source.spuCode,
      originalSkuCode: candidate.originalSkuCode || line.source.skuCode,
      currentSpuCode: line.target.spuCode,
      currentSkuCode: line.target.skuCode,
      migratedAt: occurredAt,
      reason: '整色 SPU 替换：保留原始身份并更新当前有效瑕疵归属',
    })
  })
  persistSnapshot(snapshot)
  return structuredClone(record.migrationAudits)
}

export function listGarmentWarehouseRelabelTasks(): GarmentWarehouseRelabelTask[] {
  return loadSnapshot().relabelTasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getGarmentSalesOutboundGuard(input: {
  productionOrderId: string
  skuCode: string
}): GarmentSalesOutboundGuard {
  const task = loadSnapshot().relabelTasks.find((item) => (
    (item.productionOrderId === input.productionOrderId || item.productionOrderNo === input.productionOrderId)
    && item.status !== 'COMPLETED'
    && item.lines.some((line) => line.source.skuCode === input.skuCode && line.qty > 0)
  ))
  if (!task) return { allowed: true, reason: '当前 SKU 没有未完成的成衣仓换码占用。' }
  return {
    allowed: false,
    reason: `旧 SKU 正由 ${task.relabelTaskNo} 占用换码，完成旧出新入前不得完成销售出库。`,
    relabelTaskId: task.relabelTaskId,
    relabelTaskNo: task.relabelTaskNo,
  }
}

export function assertGarmentSalesOutboundAllowed(input: {
  productionOrderId: string
  skuCode: string
}): void {
  const guard = getGarmentSalesOutboundGuard(input)
  if (!guard.allowed) throw new Error(guard.reason)
}

export function getGarmentWarehouseRelabelTask(id: string): GarmentWarehouseRelabelTask | null {
  const task = loadSnapshot().relabelTasks.find((item) => item.relabelTaskId === id || item.relabelTaskNo === id)
  return task ? structuredClone(task) : null
}

export function startGarmentWarehouseRelabelTask(taskId: string): GarmentWarehouseRelabelTask {
  const snapshot = loadSnapshot()
  const task = snapshot.relabelTasks.find((item) => item.relabelTaskId === taskId)
  if (!task) throw new Error('未找到成衣仓换码任务。')
  if (task.status === 'COMPLETED') return structuredClone(task)
  task.status = 'PROCESSING'
  task.lines.forEach((line) => { if (line.status === 'PENDING') line.status = 'PROCESSING' })
  persistSnapshot(snapshot)
  return structuredClone(task)
}

export function completeGarmentWarehouseRelabelTask(input: { taskId: string; operatorName: string; occurredAt?: string }): GarmentWarehouseRelabelTask {
  const snapshot = loadSnapshot()
  const task = snapshot.relabelTasks.find((item) => item.relabelTaskId === input.taskId)
  if (!task) throw new Error('未找到成衣仓换码任务。')
  if (task.status === 'COMPLETED') return structuredClone(task)
  const occurredAt = input.occurredAt || nowText()
  task.lines.forEach((line) => {
    const batch = snapshot.inventoryBatches.find((item) => item.inventoryBatchId === line.inventoryBatchId)
    if (!batch) throw new Error(`未找到来源入库批次 ${line.sourceInboundBatchId}。`)
    snapshot.warehouseMovements.push({
      movementId: `${task.relabelTaskId}-OUT-${line.size}`,
      movementType: 'OLD_SKU_OUTBOUND',
      replacementId: task.replacementId,
      relabelTaskId: task.relabelTaskId,
      inventoryBatchId: batch.inventoryBatchId,
      sourceInboundBatchId: batch.sourceInboundBatchId,
      qty: line.qty,
      identity: structuredClone(line.source),
      occurredAt,
      operatorName: input.operatorName,
    })
    snapshot.warehouseMovements.push({
      movementId: `${task.relabelTaskId}-IN-${line.size}`,
      movementType: 'NEW_SKU_INBOUND',
      replacementId: task.replacementId,
      relabelTaskId: task.relabelTaskId,
      inventoryBatchId: batch.inventoryBatchId,
      sourceInboundBatchId: batch.sourceInboundBatchId,
      qty: line.qty,
      identity: structuredClone(line.target || line.source),
      occurredAt,
      operatorName: input.operatorName,
    })
    batch.currentIdentity = structuredClone(line.target)
    batch.relabeled = true
    line.status = 'COMPLETED'
  })
  task.status = 'COMPLETED'
  task.completedAt = occurredAt
  const record = snapshot.records.find((item) => item.replacementId === task.replacementId)
  if (record) recomputeRecordStatus(record, task)
  persistSnapshot(snapshot)
  return structuredClone(task)
}

export function listGarmentWarehouseInventoryBatches(): GarmentWarehouseInventoryBatch[] {
  return loadSnapshot().inventoryBatches
}

export function listGarmentWarehouseMovements(replacementId?: string): GarmentWarehouseMovement[] {
  return loadSnapshot().warehouseMovements.filter((item) => !replacementId || item.replacementId === replacementId)
}

export function listGarmentPrintRows(sourceId: string): GarmentPrintRow[] {
  const snapshot = loadSnapshot()
  const task = snapshot.relabelTasks.find((item) => item.relabelTaskId === sourceId || item.relabelTaskNo === sourceId)
  const record = snapshot.records.find((item) =>
    item.replacementId === sourceId
    || item.replacementNo === sourceId
    || item.productionOrderId === sourceId
    || item.productionOrderNo === sourceId
    || item.replacementId === task?.replacementId,
  )
  if (record) {
    return record.lines.map((line) => ({
      replacementId: record.replacementId,
      productionOrderId: record.productionOrderId,
      productionOrderNo: record.productionOrderNo,
      size: line.size,
      qty: task ? line.finishedWarehouseQty : line.finishedWarehouseQty + line.postFactoryQty + line.remainingReturnQty,
      identity: structuredClone(line.target),
      originalIdentity: structuredClone(line.source),
    })).filter((line) => line.qty > 0)
  }
  const order = getOrder(sourceId)
  return order.demandSnapshot.skuLines.map((line) => ({
    replacementId: '',
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    size: line.size,
    qty: line.qty,
    identity: fallbackSourceIdentity({
      spuCode: order.demandSnapshot.spuCode,
      spuName: order.demandSnapshot.spuName,
      skuCode: line.skuCode,
      color: line.color,
      size: line.size,
    }),
    originalIdentity: fallbackSourceIdentity({
      spuCode: order.demandSnapshot.spuCode,
      spuName: order.demandSnapshot.spuName,
      skuCode: line.skuCode,
      color: line.color,
      size: line.size,
    }),
  }))
}

export function getProductionOrderGarmentComposition(productionOrderId: string): {
  originalDemandQty: number
  originalSpuQty: number
  targetSpuQty: number
  remainingReturnQty: number
  sourceSpuCode: string
  targetSpuCode: string
} | null {
  const record = listGarmentSpuReplacements().find((item) => item.productionOrderId === productionOrderId || item.productionOrderNo === productionOrderId)
  if (!record) return null
  return {
    originalDemandQty: record.originalDemandQty,
    originalSpuQty: record.lines.reduce((sum, line) => sum + line.soldHistoryQty, 0),
    targetSpuQty: record.lines.reduce((sum, line) => sum + line.finishedWarehouseQty + line.postFactoryQty + line.remainingReturnQty, 0),
    remainingReturnQty: record.lines.reduce((sum, line) => sum + line.remainingReturnQty, 0),
    sourceSpuCode: record.sourceSpuCode,
    targetSpuCode: record.targetSpuCode,
  }
}

export function resetGarmentSpuReplacementStore(): void {
  memorySnapshot = emptySnapshot()
  if (canUseStorage()) localStorage.removeItem(STORAGE_KEY)
}
