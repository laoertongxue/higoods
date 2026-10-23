import {
  accessoryRecord,
  ensureAccessoryWarehouseRecords,
  listAccessoryRecords,
  saveAccessoryWarehouseAction,
} from './accessory-warehouse-records.ts'
import {
  ACCESSORY_GTP_WAREHOUSE,
  type AccessoryTransfer,
  type AccessoryTransferLine,
} from './accessory-warehouse-flow.ts'
import { accessoryReceiptForTransfer } from './accessory-warehouse-commands.ts'
import { listEnabledAccessoryWarehouseLocations } from './accessory-warehouse-master.ts'
import { getAccessoryStockAvailable, type AccessoryStock } from './accessory-warehouse-stock.ts'
import { listAccessoryStockSources } from './accessory-warehouse-stock-sources.ts'
import { productionOrders, type ProductionOrder } from '../fcs/production-orders.ts'
import type {
  ProductionOrderTechPackSnapshot,
  TechPackBomItemSnapshot,
} from '../fcs/production-tech-pack-snapshot-types.ts'

export type ManualTransferSource = 'PRODUCTION_ORDER' | 'GENERAL'

export interface ManualTransferMaterialRow {
  key: string
  materialSku: string
  materialName: string
  materialSpec: string
  unit: string
  imageUrl: string
  color: string
  imageMissing: boolean
  sourceProductionOrderNo: string
  sourceTechPackVersionId: string
}

export interface ManualTransferProductionPreview {
  productionOrderId: string
  productionOrderNo: string
  styleNo: string
  styleName: string
  styleImageUrl: string
  techPackVersionId: string
  techPackVersionLabel: string
  rows: ManualTransferMaterialRow[]
  excludedCount: number
  excludedSummary: string
}

export type ManualTransferPreviewResult =
  | { ok: true; preview: ManualTransferProductionPreview }
  | { ok: false; message: string }

export interface ManualTransferCreateInput {
  source: ManualTransferSource
  productionOrderNo?: string
  actorName: string
  lines: Array<{ materialKey: string; qty: number }>
  commandId: string
  at: string
}

const EXCLUDED_TAG_KEYWORDS = ['吊牌', '吊粒']
const EXCLUDED_THREAD_KEYWORDS = ['车缝线', '缝纫线']
const NON_POST_BOM_TYPES = new Set<TechPackBomItemSnapshot['type']>(['面料', '纱线', '成衣'])
const POST_ELIGIBLE_BOM_TYPES = new Set<TechPackBomItemSnapshot['type']>(['辅料', '包装材料', '其他'])
const CUTTING_PROCESS_CODES = new Set(['CUT', 'CUT_PANEL', 'CUTTING', 'WOOL', 'PROC_WOOL'])
const EPSILON = 0.000001

const roundQty = (value: number) => Math.round(value * 1_000_000) / 1_000_000
const normalizedKey = (value: string) => value.trim().toUpperCase()

export function isManualTransferExcludedBomItem(
  item: Pick<TechPackBomItemSnapshot, 'type' | 'name'>,
): { excluded: boolean; reason: string } {
  if (item.type === '面料') return { excluded: true, reason: '面料' }
  if (EXCLUDED_TAG_KEYWORDS.some(keyword => item.name.includes(keyword))) return { excluded: true, reason: '品牌/价格吊牌、吊粒' }
  if (EXCLUDED_THREAD_KEYWORDS.some(keyword => item.name.includes(keyword))) return { excluded: true, reason: '车缝线' }
  if (NON_POST_BOM_TYPES.has(item.type) || !POST_ELIGIBLE_BOM_TYPES.has(item.type)) return { excluded: true, reason: '非后道辅料' }
  return { excluded: false, reason: '' }
}

function hasCuttingOrPatternLink(
  item: TechPackBomItemSnapshot,
  snapshot: ProductionOrderTechPackSnapshot,
): boolean {
  if (item.linkedPatternIds?.length) return true
  if (snapshot.patternFiles.some(pattern => pattern.linkedBomItemId === item.id)) return true
  if (snapshot.colorMaterialMappings.some(mapping => mapping.lines.some(line => line.bomItemId === item.id && Boolean(line.patternId)))) return true
  const processCodes = new Set([
    ...(item.usageProcessCodes || []),
    ...snapshot.processEntries
      .filter(entry => entry.linkedBomItemIds?.includes(item.id) || entry.consumedBomItemIds?.includes(item.id))
      .map(entry => entry.processCode),
  ])
  return [...processCodes].some(code => CUTTING_PROCESS_CODES.has(code))
}

function materialCodeOf(item: TechPackBomItemSnapshot): string {
  return (item.materialCode || item.materialSkuCode || item.materialSkuId || '').trim()
}

function materialRowOf(
  item: TechPackBomItemSnapshot,
  order: ProductionOrder,
  snapshot: ProductionOrderTechPackSnapshot,
): ManualTransferMaterialRow | null {
  const code = materialCodeOf(item)
  const unit = (item.unit || '').trim()
  if (!code || !unit) return null
  return {
    key: normalizedKey(code),
    materialSku: code,
    materialName: item.name.trim(),
    materialSpec: item.spec || '',
    unit,
    imageUrl: item.materialImageUrl || '',
    color: item.colorLabel || '',
    imageMissing: !item.materialImageUrl?.trim(),
    sourceProductionOrderNo: order.productionOrderNo,
    sourceTechPackVersionId: snapshot.sourceTechPackVersionId,
  }
}

function collectOrderMaterials(order: ProductionOrder, snapshot: ProductionOrderTechPackSnapshot): {
  rows: ManualTransferMaterialRow[]
  excludedCount: number
  excludedSummary: string
} {
  const rows = new Map<string, ManualTransferMaterialRow>()
  const excludedReasons = new Map<string, number>()
  const countExcluded = (reason: string) => excludedReasons.set(reason, (excludedReasons.get(reason) || 0) + 1)
  for (const item of snapshot.bomItems) {
    const eligibility = isManualTransferExcludedBomItem(item)
    if (eligibility.excluded) {
      countExcluded(eligibility.reason)
      continue
    }
    if (hasCuttingOrPatternLink(item, snapshot)) {
      countExcluded('需裁剪或关联纸样')
      continue
    }
    const row = materialRowOf(item, order, snapshot)
    if (!row) {
      countExcluded('缺少物料编码或单位')
      continue
    }
    if (rows.has(row.key)) {
      countExcluded('重复物料')
      continue
    }
    rows.set(row.key, row)
  }
  const excludedCount = [...excludedReasons.values()].reduce((sum, value) => sum + value, 0)
  return {
    rows: [...rows.values()],
    excludedCount,
    excludedSummary: [...excludedReasons].map(([reason, count]) => `${reason} ${count} 项`).join('、'),
  }
}

export function listManualTransferProductionOrderOptions(): Array<{
  productionOrderNo: string
  styleName: string
  techPackVersionLabel: string
}> {
  return productionOrders
    .filter(order => Boolean(order.techPackSnapshot))
    .map(order => ({
      productionOrderNo: order.productionOrderNo,
      styleName: order.techPackSnapshot?.styleName || order.demandSnapshot.spuName,
      techPackVersionLabel: order.techPackSnapshot?.sourceTechPackVersionLabel || order.techPackSnapshot?.versionLabel || '版本待核对',
    }))
    .sort((left, right) => left.productionOrderNo.localeCompare(right.productionOrderNo))
}

export function readManualTransferProductionPreview(productionOrderNo: string): ManualTransferPreviewResult {
  const query = productionOrderNo.trim()
  if (!query) return { ok: false, message: '请输入生产单号。' }
  const matches = productionOrders.filter(order => order.productionOrderNo.toLowerCase() === query.toLowerCase())
  if (matches.length !== 1) {
    return { ok: false, message: matches.length ? '生产单号匹配到多条记录，请核对。' : `未找到生产单 ${query}。` }
  }
  const order = matches[0]
  const snapshot = order.techPackSnapshot
  if (!snapshot) return { ok: false, message: `生产单 ${order.productionOrderNo} 尚未绑定技术包版本，不能读取 BOM。` }
  const collected = collectOrderMaterials(order, snapshot)
  if (!collected.rows.length) {
    return {
      ok: false,
      message: `该生产单没有可调拨的后道辅料${collected.excludedSummary ? `（已排除：${collected.excludedSummary}）` : ''}。`,
    }
  }
  return {
    ok: true,
    preview: {
      productionOrderId: order.productionOrderId,
      productionOrderNo: order.productionOrderNo,
      styleNo: snapshot.styleCode || order.productionOrderNo,
      styleName: snapshot.styleName || order.demandSnapshot.spuName,
      styleImageUrl: snapshot.imageSnapshot.styleImages[0] || snapshot.imageSnapshot.productImages[0] || '',
      techPackVersionId: snapshot.sourceTechPackVersionId,
      techPackVersionLabel: snapshot.sourceTechPackVersionLabel || snapshot.versionLabel || snapshot.sourceTechPackVersionId,
      rows: collected.rows,
      excludedCount: collected.excludedCount,
      excludedSummary: collected.excludedSummary,
    },
  }
}

/** 通用物料目录按物料编码去重；只展示有正式物料图、可实际进入后道调拨的辅料。 */
export function listManualTransferMaterialCatalog(): ManualTransferMaterialRow[] {
  const rows = new Map<string, ManualTransferMaterialRow>()
  for (const order of productionOrders) {
    const snapshot = order.techPackSnapshot
    if (!snapshot) continue
    for (const row of collectOrderMaterials(order, snapshot).rows) {
      const current = rows.get(row.key)
      if (!current || (current.imageMissing && !row.imageMissing)) rows.set(row.key, row)
    }
  }
  return [...rows.values()]
    .filter(row => !row.imageMissing)
    .sort((left, right) => left.materialName.localeCompare(right.materialName, 'zh-CN') || left.materialSku.localeCompare(right.materialSku))
}

function requireQty(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label}必须是大于 0 的有效数量。`)
  const rounded = roundQty(value)
  if (rounded <= 0) throw new Error(`${label}必须是大于 0 的有效数量。`)
  return rounded
}

function sourceStockFor(
  row: ManualTransferMaterialRow,
  qty: number,
  stocks: readonly AccessoryStock[],
  enabledLocations: ReadonlySet<string>,
): AccessoryStock {
  const candidates = stocks
    .filter(stock => stock.warehouseCode === ACCESSORY_GTP_WAREHOUSE
      && stock.materialSku === row.materialSku
      && stock.unit === row.unit
      && enabledLocations.has(stock.locationId))
    .map(stock => ({ stock, available: getAccessoryStockAvailable(stock) }))
    .filter(candidate => candidate.available > 0)
    .sort((left, right) => right.available - left.available || left.stock.locationId.localeCompare(right.stock.locationId))
  const selected = candidates.find(candidate => candidate.available + EPSILON >= qty)
  if (selected) return selected.stock
  const available = candidates.reduce((max, candidate) => Math.max(max, candidate.available), 0)
  throw new Error(`${row.materialName}在辅料中央仓可用库存不足：需要 ${qty} ${row.unit}，当前可用 ${roundQty(available)} ${row.unit}。`)
}

function requestSignature(input: {
  source: ManualTransferSource
  productionOrderNo: string
  actorName: string
  lines: Array<{ materialSku: string; unit: string; qty: number }>
}): string {
  return JSON.stringify([
    input.source,
    input.productionOrderNo,
    input.actorName,
    [...input.lines]
      .sort((left, right) => left.materialSku.localeCompare(right.materialSku) || left.unit.localeCompare(right.unit))
      .map(line => [line.materialSku, line.unit, line.qty]),
  ])
}

function nextManualTransferNo(
  source: ManualTransferSource,
  productionOrderNo: string,
  transfers: readonly AccessoryTransfer[],
): string {
  const used = new Set(transfers.map(transfer => transfer.manualTransferNo).filter((value): value is string => Boolean(value)))
  if (source === 'PRODUCTION_ORDER') {
    let sequence = 1
    while (used.has(`HD-${productionOrderNo}-M${String(sequence).padStart(2, '0')}`)) sequence += 1
    return `HD-${productionOrderNo}-M${String(sequence).padStart(2, '0')}`
  }
  let sequence = 1
  while (used.has(`HD-GEN-${String(sequence).padStart(4, '0')}`)) sequence += 1
  return `HD-GEN-${String(sequence).padStart(4, '0')}`
}

export async function createManualAccessoryPostTransfer(input: ManualTransferCreateInput): Promise<AccessoryTransfer> {
  const actorName = input.actorName.trim()
  if (!actorName) throw new Error('请填写创建人。')
  if (!input.commandId.trim()) throw new Error('创建命令身份缺失，请重新打开创建窗口。')
  if (!input.lines.length) throw new Error('至少填写一项要调拨的物料数量。')
  if (!input.at.trim()) throw new Error('创建时间缺失，请重新打开创建窗口。')

  let preview: ManualTransferProductionPreview | null = null
  let catalog: ManualTransferMaterialRow[] = []
  if (input.source === 'PRODUCTION_ORDER') {
    const result = readManualTransferProductionPreview(input.productionOrderNo || '')
    if (!result.ok) throw new Error(result.message)
    preview = result.preview
  } else {
    catalog = listManualTransferMaterialCatalog()
  }
  const sourceRows = preview?.rows || catalog

  const requestedKeys = new Set<string>()
  const selected = input.lines.map(line => {
    const key = normalizedKey(line.materialKey)
    if (!key || requestedKeys.has(key)) throw new Error('同一物料只能添加一行，请核对调拨明细。')
    requestedKeys.add(key)
    const row = sourceRows.find(candidate => candidate.key === key)
    if (!row) throw new Error('调拨物料不在当前 BOM 或通用物料目录中，请重新读取。')
    if (row.imageMissing) throw new Error(`${row.materialName}缺少对应物料图，不能创建调拨单。`)
    return { row, qty: requireQty(line.qty, `${row.materialName}调拨数量`) }
  })
  const signature = requestSignature({
    source: input.source,
    productionOrderNo: preview?.productionOrderNo || '',
    actorName,
    lines: selected.map(line => ({ materialSku: line.row.materialSku, unit: line.row.unit, qty: line.qty })),
  })

  await ensureAccessoryWarehouseRecords()
  const transferId = `ACCESSORY-MANUAL:${input.commandId}`
  const existing = listAccessoryRecords<AccessoryTransfer>('transfer').find(transfer => transfer.id === transferId)
  if (existing) {
    if (existing.manualRequestSignature !== signature) throw new Error('同一创建命令对应的物料或数量已变化，请重新打开创建窗口。')
    return existing
  }

  const enabledLocations = new Set(listEnabledAccessoryWarehouseLocations(ACCESSORY_GTP_WAREHOUSE).map(location => location.id))
  const stocks = listAccessoryStockSources(listAccessoryRecords<AccessoryStock>('stock'))
  const resolved = selected.map(line => ({
    ...line,
    fromLocationId: sourceStockFor(line.row, line.qty, stocks, enabledLocations).locationId,
  }))
  const lines: AccessoryTransferLine[] = resolved.map((line, index) => ({
    id: `MANUAL-LINE:${input.commandId}:${String(index + 1).padStart(2, '0')}`,
    materialSku: line.row.materialSku,
    materialName: line.row.materialName,
    imageUrl: line.row.imageUrl,
    color: line.row.color,
    spec: line.row.materialSpec,
    unit: line.row.unit,
    purpose: '其他',
    requiresCutting: false,
    qty: line.qty,
    fromLocationId: line.fromLocationId,
  }))
  const transfers = listAccessoryRecords<AccessoryTransfer>('transfer')
  const transfer: AccessoryTransfer = {
    id: transferId,
    kind: 'GTP_TO_POST',
    preparationId: `MANUAL:${input.commandId}`,
    productionOrderId: preview?.productionOrderId || 'MANUAL-GENERAL',
    fromWarehouse: ACCESSORY_GTP_WAREHOUSE,
    toWarehouse: 'DLN',
    status: '待出库',
    version: 1,
    lines,
    history: [
      {
        action: '人工创建调拨单',
        at: input.at,
        by: actorName,
        detail: preview
          ? `按生产单 ${preview.productionOrderNo} 的冻结技术包 ${preview.techPackVersionLabel} 人工创建`
          : '按通用物料搜索人工创建',
      },
      {
        action: '自动审核通过',
        at: input.at,
        by: '辅料中央仓系统',
        detail: '辅料中央仓自动审核通过，等待整单出库',
      },
    ],
    createdAt: input.at,
    createdBy: actorName,
    creationMode: 'MANUAL',
    manualSource: input.source,
    manualTransferNo: nextManualTransferNo(input.source, preview?.productionOrderNo || '', transfers),
    manualProductionOrderNo: preview?.productionOrderNo,
    manualStyleName: preview?.styleName || '通用物料调拨',
    manualStyleImageUrl: preview?.styleImageUrl || '',
    manualRequestSignature: signature,
    responsibilityKey: `MANUAL:${input.commandId}`,
  }
  const receipt = accessoryReceiptForTransfer(transfer)
  if (!receipt) throw new Error('后道收货事项身份缺失，请重新核对调拨去向。')
  return saveAccessoryWarehouseAction({
    commandId: input.commandId,
    intent: `create-manual-post-transfer:${input.commandId}`,
    result: transfer,
    change: {
      puts: [
        accessoryRecord('transfer', transfer.id, transfer),
        accessoryRecord('receipt', receipt.id, receipt),
      ],
    },
  })
}
