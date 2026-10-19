import {
  installAccessoryPostFinishingReadBridge, readLegacyPostFinishingMaterialState, resolvePostFinishingResponsibility,
  type PostFinishingActor, type PostFinishingMaterialTransferOrder, type PostFinishingMaterialStock,
} from '../fcs/post-finishing-full-flow.ts'
import { ensurePostFinishingRecordState, getPostFinishingStorageFailure } from '../fcs/post-finishing-records.ts'
import { readPcsRecords, pcsFileReferences, type PcsStoredFile } from '../pcs-record-db.ts'
import { prepareAccessoryWarehouseSources, listAccessoryPreparations } from './accessory-warehouse-sources.ts'
import { accessoryRecord, ensureAccessoryWarehouseRecords, listAccessoryRecords, saveAccessoryWarehouseAction } from './accessory-warehouse-records.ts'
import { buildAccessoryReceiveChange, type AccessoryReceipt, type AccessoryWarehouseActor } from './accessory-warehouse-commands.ts'
import { ACCESSORY_POST_WAREHOUSE, splitAccessoryLinesForTask, type AccessoryTransfer, type AccessoryPreparation, type AccessoryReceiptLine } from './accessory-warehouse-flow.ts'
import { getAccessoryStockId, type AccessoryStock } from './accessory-warehouse-stock.ts'
import { listAccessoryStockSources } from './accessory-warehouse-stock-sources.ts'
import { listAccessoryWarehouses, listAccessoryPostWarehouseLocations } from './accessory-warehouse-master.ts'
import { cuttingRecordFingerprint } from '../fcs/cutting/cutting-record-identity.ts'
import { readCuttingRecordFile, type CuttingRecordChange } from '../fcs/cutting/cutting-record-repository.ts'

export interface AccessoryPostLocation { id: string; locationCode: string; warehouseCode: 'DLN'; zoneName: string; enabled: true }
const postLocations: readonly AccessoryPostLocation[] = listAccessoryPostWarehouseLocations().filter(row => row.enabled).map(row => Object.freeze({ id: row.id, locationCode: row.locationCode, warehouseCode: 'DLN', zoneName: row.zoneName, enabled: true }))
export function listAccessoryPostLocations(): AccessoryPostLocation[] { return postLocations.map(row => ({ ...row })) }
const legacyKey = 'higood-fcs-post-finishing-full-flow-v1'
const pcsPrefix = 'higood-fcs-post-finishing-records/flow/'
interface Source { key: string; collection: 'materialTransferOrders' | 'materialStocks'; value: PostFinishingMaterialTransferOrder | PostFinishingMaterialStock; fingerprint: string }
interface Archive { id: string; kind: 'post-legacy-archive'; sourceKey: string; sourceFingerprint: string; sourceCollection: Source['collection']; original: Source['value']; retainedOriginal: true; canonicalTransferId?: string; batchId: string; files: Array<{ originalId: string; fileId: string }> }
interface Batch { id: string; kind: 'post-legacy-batch'; phase: 'COPIED' | 'COMPLETE'; sourceKeys: string[]; at: string; by: string; retainedOriginal: true; noPhysicalMove: true }
export interface AccessoryPostMigrationInspection { state: '无需迁移' | '待迁移' | '待核对' | '待验证' | '已完成'; transferCount: number; stockCount: number; demonstrationTransferCount: number; retainedOriginal: true; issues: string[]; message: string }
let sourceRows: Source[] = [], sourceFiles: PcsStoredFile[] = [], prepared = false
const allTransfers = () => listAccessoryRecords<AccessoryTransfer & { legacyPostBatchId?: string }>('transfer')
const batches = () => listAccessoryRecords<Batch>('migration').filter(row => row.kind === 'post-legacy-batch')
const archives = () => listAccessoryRecords<Archive>('migration').filter(row => row.kind === 'post-legacy-archive')
const preparationFor = (id: string) => listAccessoryPreparations().find(row => row.productionOrderId === id || row.productionOrderNo === id)
const managed = (id: string) => Boolean(preparationFor(id))
function activeTransfer(row: AccessoryTransfer & { legacyPostBatchId?: string }): boolean { return row.kind === 'SITE_TO_POST' && row.toWarehouse === ACCESSORY_POST_WAREHOUSE && row.status !== '已作废' && (!row.legacyPostBatchId || batches().some(batch => batch.id === row.legacyPostBatchId && batch.phase === 'COMPLETE')) }
function postTransfers() { return allTransfers().filter(activeTransfer).map(row => { requireValue(splitAccessoryLinesForTask(row.lines, 'SEWING').postLines.length === row.lines.length, '后道调拨明细包含不属于本次后道范围的物料，需核对原单。'); return row }) }
function requireValue(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
function postNumber(transfer: AccessoryTransfer): string {
  const preparation = listAccessoryPreparations().find(row => row.id === transfer.preparationId)
  const same = allTransfers().filter(row => row.kind === 'SITE_TO_POST' && row.preparationId === transfer.preparationId).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  return `HD-${preparation?.productionOrderNo || '历史辅料'}-${String(same.findIndex(row => row.id === transfer.id) + 1).padStart(2, '0')}`
}
const locationName = (id: string) => postLocations.find(row => row.id === id)?.locationCode || '历史库位待核对'
function project(transfer: AccessoryTransfer): PostFinishingMaterialTransferOrder {
  const preparation = listAccessoryPreparations().find(row => row.id === transfer.preparationId)
  requireValue(preparation, '后道调拨缺少对应生产单配料资料，请重新读取。')
  const receipt = listAccessoryRecords<AccessoryReceipt>('receipt').find(row => row.transferId === transfer.id && row.status !== '已取消')
  const received = transfer.status === '已收货'
  return {
    transferOrderId: transfer.id, transferOrderNo: postNumber(transfer), productionOrderId: transfer.productionOrderId,
    productionOrderNo: preparation.productionOrderNo, styleNo: '', styleName: preparation.styleName, styleImageUrl: preparation.styleImageUrl,
    sewingTaskNo: '', responsibility: resolvePostFinishingResponsibility('INDEPENDENT_SEWING', transfer.createdAt),
    sourceWarehouseName: listAccessoryWarehouses().find(row => row.code === transfer.fromWarehouse)?.name || '历史来源仓',
    targetWarehouseName: 'DLN 后道工厂', targetAreaName: '后道辅料暂存区（演示）',
    targetLocationCode: received && receipt ? [...new Set(receipt.lines.map(line => locationName(line.locationId)))].join(' / ') : '收货时选择',
    status: received ? '已入库' : transfer.status === '已出库待收货' ? '待入库' : '待调拨',
    lines: transfer.lines.map(line => ({ transferLineId: line.id, materialName: line.materialName, materialCode: line.materialSku, materialSpuCode: '', specification: [line.color, line.spec].filter(Boolean).join(' · '), unit: line.unit, requestedQty: line.qty, preparedQty: line.qty, imageUrl: line.imageUrl })),
    statusHistory: transfer.history.map(item => ({ status: item.action.includes('收货') || item.action.includes('入库') ? '已入库' : item.action.includes('出库') ? '待入库' : '待调拨', operatedAt: item.at, operatorName: item.by, remark: item.detail })),
    createdAt: transfer.createdAt, updatedAt: transfer.receivedAt || transfer.dispatchedAt || transfer.createdAt,
    inboundAt: transfer.receivedAt, inboundBy: received ? { actorId: 'ACCESSORY-DLN-RECEIVER', actorName: transfer.receivedBy || '历史后道仓管', roleName: '后道仓管' } : undefined,
  }
}
export function listManagedAccessoryPostTransfers(): PostFinishingMaterialTransferOrder[] { requireValue(prepared, '请先读取后道辅料资料。'); return postTransfers().map(project) }
export function isManagedAccessoryPostTransfer(id: string): boolean { return postTransfers().some(row => row.id === id || postNumber(row) === id) }
function projectStocks(): PostFinishingMaterialStock[] {
  const result: PostFinishingMaterialStock[] = []
  const stocks = listAccessoryRecords<AccessoryStock>('stock').filter(row => row.warehouseCode === 'DLN')
  for (const transfer of postTransfers().filter(row => row.status === '已收货')) {
    const order = project(transfer), receipt = listAccessoryRecords<AccessoryReceipt>('receipt').find(row => row.transferId === transfer.id && row.status === '已收货')
    if (!receipt) continue
    for (const line of transfer.lines) {
      const received = receipt.lines.find(row => row.lineId === line.id)
      if (!received) continue
      const stockId = getAccessoryStockId('DLN', received.locationId, line.materialSku, line.unit), physical = stocks.find(row => row.id === stockId)
      if (!physical) continue
      // A physical stock row is displayed once even when several transfers share it.
      if (result.some(row => row.stockId === stockId)) continue
      result.push({ stockId, transferOrderId: transfer.id, transferOrderNo: order.transferOrderNo, productionOrderNo: order.productionOrderNo, material: order.lines.find(row => row.transferLineId === line.id)!, currentQty: physical.onHandQty, inboundQty: physical.sourceRefs?.filter(ref => ref.kind === 'TRANSFER_IN').reduce((sum, ref) => sum + ref.qty, 0) || physical.onHandQty, areaName: '后道辅料暂存区（演示）', locationCode: locationName(received.locationId), inboundAt: transfer.receivedAt!, inboundBy: order.inboundBy! })
    }
  }
  return result.map(row => {
    const refs = new Set(stocks.find(stock => stock.id === row.stockId)?.sourceRefs?.filter(ref => ref.kind === 'TRANSFER_IN').map(ref => ref.sourceId))
    const related = postTransfers().filter(transfer => refs.has(transfer.id)).map(project)
    return { ...row, productionOrderNo: [...new Set(related.map(order => order.productionOrderNo))].join('、') || row.productionOrderNo, transferOrderNo: related.map(order => order.transferOrderNo).join('、') || row.transferOrderNo }
  })
}
function legacyDemonstrationHistory() {
  const legacy = readLegacyPostFinishingMaterialState(), persisted = new Set(sourceRows.filter(row => row.collection === 'materialTransferOrders').map(row => (row.value as PostFinishingMaterialTransferOrder).transferOrderId))
  const transfers = legacy.materialTransferOrders.filter(row => (managed(row.productionOrderId) || managed(row.productionOrderNo)) && !persisted.has(row.transferOrderId))
  const ids = new Set(transfers.map(row => row.transferOrderId))
  return { source: '原后道固定演示版本', readOnly: true as const, materialTransferOrders: transfers, materialStocks: legacy.materialStocks.filter(row => ids.has(row.transferOrderId)) }
}
async function readSources(): Promise<void> {
  const read = await readPcsRecords([`${pcsPrefix}materialTransferOrders`, `${pcsPrefix}materialStocks`])
  const rows: Array<Omit<Source, 'fingerprint'>> = read.records.filter(row => !row.deleted).flatMap(row => row.collection === 'flow/materialTransferOrders' || row.collection === 'flow/materialStocks' ? [{ key: `PCS:${row.id}`, collection: row.collection.split('/')[1] as Source['collection'], value: row.value as Source['value'] }] : [])
  let raw: string | null = null
  try { raw = globalThis.localStorage?.getItem(legacyKey) || null } catch { /* Existing IndexedDB facts remain readable when localStorage is unavailable. */ }
  if (raw) {
    const value = JSON.parse(raw)
    for (const collection of ['materialTransferOrders', 'materialStocks'] as const) {
      requireValue(value[collection] === undefined || Array.isArray(value[collection]), '原后道辅料资料结构无法核对，请先备份原资料。')
      for (const item of value[collection] || []) rows.push({ key: `LS:${collection}:${collection === 'materialTransferOrders' ? item.transferOrderId : item.stockId}`, collection, value: item })
    }
  }
  const oldTransfers = rows.filter(row => row.collection === 'materialTransferOrders')
  const ids = new Set(oldTransfers.filter(row => managed((row.value as PostFinishingMaterialTransferOrder).productionOrderId) || managed((row.value as PostFinishingMaterialTransferOrder).productionOrderNo)).map(row => (row.value as PostFinishingMaterialTransferOrder).transferOrderId))
  sourceRows = await Promise.all(rows.filter(row => row.collection === 'materialTransferOrders' ? ids.has((row.value as PostFinishingMaterialTransferOrder).transferOrderId) : ids.has((row.value as PostFinishingMaterialStock).transferOrderId) || managed((row.value as PostFinishingMaterialStock).productionOrderNo)).map(async row => ({ ...row, fingerprint: await cuttingRecordFingerprint(JSON.stringify(row.value)) })))
  const fileIds = new Set(sourceRows.flatMap(row => [...pcsFileReferences(row.value)]))
  sourceFiles = read.files.filter(file => fileIds.has(file.id))
}
export async function prepareAccessoryPostFinishing(): Promise<void> {
  prepared = false
  await prepareAccessoryWarehouseSources()
  await ensurePostFinishingRecordState()
  requireValue(!getPostFinishingStorageFailure(), getPostFinishingStorageFailure())
  await readSources()
  prepared = true
  installAccessoryPostFinishingReadBridge({ ownsProduction: managed, transfers: () => listManagedAccessoryPostTransfers(), stocks: projectStocks, readiness: no => {
    const preparation = preparationFor(no)
    if (!preparation) return undefined
    const all = postTransfers().filter(row => row.productionOrderId === preparation.productionOrderId)
    const rows = all.filter(row => !row.legacyPostBatchId)
    const legacy = sourceRows.filter(row => row.value.productionOrderNo === preparation.productionOrderNo || ('productionOrderId' in row.value && row.value.productionOrderId === preparation.productionOrderId))
    if (legacy.some(source => !archives().some(archive => archive.sourceKey === source.key && archive.sourceFingerprint === source.fingerprint && batches().some(batch => batch.id === archive.batchId && batch.phase === 'COMPLETE')))) return { applicable: true, status: '申请调拨', label: '本单原后道辅料资料尚未归档核验，请先核对原资料' }
    if (!rows.length) return all.length ? { applicable: true, status: '申请调拨', label: '原后道库存已承接，本次任务尚未建立后道调拨，不能把历史入库视为本次齐套' } : { applicable: false, status: '不适用', label: '当前有效任务尚无后道辅料调拨；以本次辅料清单和任务分配为准' }
    const first = rows.find(row => row.status !== '已收货') || rows[0], order = project(first)
    return { applicable: true, status: order.status, label: rows.every(row => row.status === '已收货') ? '本次后道辅料已收货上架' : order.status === '待入库' ? '本次后道辅料在途，须逐行确认收货并上架' : '本次后道辅料尚未整单出库', transferOrderNo: order.transferOrderNo }
  } })
}
function allowedLines(preparation: AccessoryPreparation) {
  return splitAccessoryLinesForTask(preparation.lines.map(line => ({ ...line, qty: line.requiredQty, fromLocationId: line.locationId })), 'SEWING').postLines
}
function analyze() {
  const issues: string[] = [], canonical: Array<{ transfer: AccessoryTransfer; receipt: AccessoryReceipt; stocks: AccessoryStock[] }> = []
  const originals = new Map<string, PostFinishingMaterialTransferOrder>()
  const originalStocks = new Map<string, PostFinishingMaterialStock>(), aggregatedStocks = new Map<string, AccessoryStock>()
  for (const row of sourceRows.filter(row => row.collection === 'materialTransferOrders')) {
    const transfer = row.value as PostFinishingMaterialTransferOrder, existing = originals.get(transfer.transferOrderId)
    if (existing && JSON.stringify(existing) !== JSON.stringify(transfer)) issues.push(`${transfer.transferOrderNo} 在两处原资料中内容不一致，需核对。`)
    originals.set(transfer.transferOrderId, transfer)
  }
  for (const row of sourceRows.filter(row => row.collection === 'materialStocks')) {
    const stock = row.value as PostFinishingMaterialStock, existing = originalStocks.get(stock.stockId), owner = originals.get(stock.transferOrderId)
    if (existing && JSON.stringify(existing) !== JSON.stringify(stock)) issues.push(`${stock.transferOrderNo} 的同编号库存内容不一致，需核对。`)
    originalStocks.set(stock.stockId, stock)
    const sourceLine = owner?.lines.find(line => line.transferLineId === stock.material.transferLineId)
    if (!owner || !sourceLine || sourceLine.materialCode !== stock.material.materialCode || sourceLine.unit !== stock.material.unit || stock.productionOrderNo !== owner.productionOrderNo) issues.push(`${stock.transferOrderNo} 的库存缺少一致的原调拨明细，不能推测来源。`)
  }
  for (const old of originals.values()) {
    const prep = preparationFor(old.productionOrderId) || preparationFor(old.productionOrderNo)
    if (!prep) continue
    let permitted: ReturnType<typeof allowedLines>
    try { permitted = allowedLines(prep) } catch { issues.push(`${old.transferOrderNo} 对应辅料用途尚未明确，不能推测后道范围。`); continue }
    for (const line of old.lines) if (!prep.lines.some(item => item.materialSku === line.materialCode && item.unit === line.unit)) issues.push(`${old.transferOrderNo} 的 ${line.materialName} 无法按正式 SKU 和单位对应本次辅料，请核对。`)
    if (old.status !== '已入库') continue // A historical plan is archived; it does not create a physical movement.
    const materialStocks = sourceRows.filter(row => row.collection === 'materialStocks' && (row.value as PostFinishingMaterialStock).transferOrderId === old.transferOrderId).map(row => row.value as PostFinishingMaterialStock)
    const uniqueStocks = [...new Map(materialStocks.map(row => [row.stockId, row])).values()]
    const source = listAccessoryWarehouses().find(row => row.key !== 'gtp' && (row.name === old.sourceWarehouseName || row.code === old.sourceWarehouseName))
    const included = old.lines.filter(line => permitted.some(item => item.materialSku === line.materialCode && item.unit === line.unit))
    if (!included.length) continue
    if (!source) { issues.push(`${old.transferOrderNo} 已入库，但原发出仓未明确到 HILON 或 Mahameru；保留原记录，不能推测库存来源。`); continue }
    const lines: AccessoryTransfer['lines'] = [], receiptLines: AccessoryReceiptLine[] = [], stocks: AccessoryStock[] = []
    for (const line of included) {
      const candidates = prep.lines.filter(item => item.materialSku === line.materialCode && item.unit === line.unit)
      if (candidates.length !== 1 || !Number.isFinite(line.preparedQty) || line.preparedQty <= 0) { issues.push(`${old.transferOrderNo} 的 ${line.materialName} 来源行或实配数量不能唯一核对。`); continue }
      const from = candidates[0]
      const matches = uniqueStocks.filter(stock => stock.material.transferLineId === line.transferLineId)
      if (!matches.length || Math.abs(matches.reduce((sum, stock) => sum + stock.inboundQty, 0) - line.preparedQty) > 0.000001) { issues.push(`${old.transferOrderNo} 的 ${line.materialName} 入库明细缺失或数量不一致。`); continue }
      for (const stock of matches) {
        const location = postLocations.find(row => row.locationCode === stock.locationCode)
        if (!location || !Number.isFinite(stock.inboundQty) || stock.inboundQty <= 0 || !Number.isFinite(stock.currentQty) || stock.currentQty < 0 || stock.currentQty > stock.inboundQty) { issues.push(`${old.transferOrderNo} 的 ${line.materialName} 实存数量或后道位置无法核对。`); continue }
        const id = matches.length === 1 ? line.transferLineId : `${line.transferLineId}:${stock.stockId}`
        lines.push({ id, sourceLineId: from.id, materialSku: from.materialSku, materialName: from.materialName, imageUrl: from.imageUrl, color: from.color, spec: from.spec, unit: from.unit, purpose: from.purpose, requiresCutting: false, qty: stock.inboundQty, fromLocationId: '', toLocationId: location.id })
        receiptLines.push({ lineId: id, qty: stock.inboundQty, locationId: location.id })
        const stockId = getAccessoryStockId('DLN', location.id, from.materialSku, from.unit)
        if (listAccessoryRecords<AccessoryStock>('stock').some(row => row.id === stockId)) { issues.push(`${old.transferOrderNo} 的 ${line.materialName} 与新库已有实物余额重叠，不能重复增加。`); continue }
        const previous = aggregatedStocks.get(stockId)
        const balance: AccessoryStock = { id: stockId, warehouseCode: 'DLN', locationId: location.id, materialSku: from.materialSku, unit: from.unit, onHandQty: Math.round(((previous?.onHandQty || 0) + stock.currentQty) * 1_000_000) / 1_000_000, reservedQty: 0, version: 1, sourceRefs: [...(previous?.sourceRefs || []), { kind: 'TRANSFER_IN', sourceId: old.transferOrderId, qty: stock.inboundQty, operationId: `LEGACY-POST-MIGRATION:${stock.stockId}` }] }
        aggregatedStocks.set(stockId, balance); stocks.push(balance)
      }
    }
    const transfer: AccessoryTransfer = { id: old.transferOrderId, preparationId: prep.id, productionOrderId: prep.productionOrderId, kind: 'SITE_TO_POST', fromWarehouse: source.code, toWarehouse: 'DLN', version: 1, status: '已收货', createdAt: old.createdAt, createdBy: old.statusHistory[0]?.operatorName || '历史后道记录', receivedAt: old.inboundAt || old.updatedAt, receivedBy: old.inboundBy?.actorName || '历史后道记录', lines, history: [{ action: '承接历史已入库事实', at: old.inboundAt || old.updatedAt, by: old.inboundBy?.actorName || '历史后道记录', detail: '由原辅料记录转换；保留原源只读，没有再次出库或入库。历史未记录发出库位。' }] }
    canonical.push({ transfer, receipt: { id: `LEGACY-POST-RECEIPT:${old.transferOrderId}`, transferId: transfer.id, warehouseCode: 'DLN', status: '已收货', version: 1, lines: receiptLines, receivedAt: transfer.receivedAt, receivedBy: transfer.receivedBy }, stocks })
  }
  return { issues: [...new Set(issues)], canonical }
}
export function inspectLegacyAccessoryPostMigration(): AccessoryPostMigrationInspection {
  requireValue(prepared, '请先读取后道辅料资料。')
  const known = archives(), pending = sourceRows.filter(source => !known.some(row => row.sourceKey === source.key && row.sourceFingerprint === source.fingerprint))
  const incomplete = batches().some(row => row.phase !== 'COMPLETE')
  const issues = pending.length ? analyze().issues : []
  const changed = sourceRows.filter(source => known.some(row => row.sourceKey === source.key && row.sourceFingerprint !== source.fingerprint))
  if (changed.length) issues.push('归档后的原后道辅料又有变化，原源已保留，请先核对来源版本。')
  const state = issues.length ? '待核对' : incomplete ? '待验证' : pending.length ? '待迁移' : sourceRows.length ? '已完成' : '无需迁移'
  const demonstrationTransferCount = legacyDemonstrationHistory().materialTransferOrders.length
  return { state, transferCount: sourceRows.filter(row => row.collection === 'materialTransferOrders').length, stockCount: sourceRows.filter(row => row.collection === 'materialStocks').length, demonstrationTransferCount, retainedOriginal: true, issues, message: state === '无需迁移' ? (demonstrationTransferCount ? '相交的固定演示历史仅保留只读，可导出查看，不生成本次库存。' : '本次生产单没有相交的旧后道辅料用户记录。') : state === '已完成' ? '相交原记录已归档核验，原源保留只读；未删除 PCS 资料。' : state === '待核对' ? '原后道辅料资料需核对，已保留原源，未推测新库存。' : '本次相交的旧后道辅料需显式归档转换；其他后道资料不受影响。' }
}
export async function migrateLegacyAccessoryPost(input: { commandId: string; at: string; actor: string }): Promise<AccessoryPostMigrationInspection> {
  await prepareAccessoryPostFinishing()
  const inspection = inspectLegacyAccessoryPostMigration()
  requireValue(inspection.state !== '待核对', inspection.issues.join('；'))
  if (inspection.state === '无需迁移' || inspection.state === '已完成') return inspection
  const existing = archives(), pendingSources = sourceRows.filter(source => !existing.some(row => row.sourceKey === source.key && row.sourceFingerprint === source.fingerprint))
  const { canonical } = analyze()
  const batchId = `post-legacy:${await cuttingRecordFingerprint(JSON.stringify(sourceRows.map(row => [row.key, row.fingerprint])))}`
  if (pendingSources.length) {
    const batch: Batch = { id: batchId, kind: 'post-legacy-batch', phase: 'COPIED', sourceKeys: sourceRows.map(row => row.key), at: input.at, by: input.actor, retainedOriginal: true, noPhysicalMove: true }
    const files = sourceFiles.map(file => ({ id: `AW-POST-LEGACY-FILE:${file.id}`, blob: file.blob }))
    const puts: CuttingRecordChange['puts'] = pendingSources.map(source => accessoryRecord('migration', `post-source:${source.key}`, { id: `post-source:${source.key}`, kind: 'post-legacy-archive', sourceKey: source.key, sourceFingerprint: source.fingerprint, sourceCollection: source.collection, original: source.value, retainedOriginal: true, canonicalTransferId: source.collection === 'materialTransferOrders' ? (source.value as PostFinishingMaterialTransferOrder).transferOrderId : (source.value as PostFinishingMaterialStock).transferOrderId, batchId, files: sourceFiles.map(file => ({ originalId: file.id, fileId: `AW-POST-LEGACY-FILE:${file.id}` })) } satisfies Archive))
    for (const row of canonical) {
      requireValue(!allTransfers().some(item => item.id === row.transfer.id), '原后道单与新调拨身份重叠，请核对后再转换。')
      puts.push(accessoryRecord('transfer', row.transfer.id, { ...row.transfer, legacyPostBatchId: batchId }), accessoryRecord('receipt', row.receipt.id, row.receipt))
    }
    for (const stock of new Map(canonical.flatMap(row => row.stocks).map(stock => [stock.id, stock])).values()) puts.push(accessoryRecord('stock', stock.id, stock))
    puts.push(accessoryRecord('migration', batch.id, batch))
    await saveAccessoryWarehouseAction({ commandId: input.commandId, intent: `archive-legacy-post:${batchId}`, result: { batchId }, change: { puts, files } })
  }
  await ensureAccessoryWarehouseRecords()
  await readSources()
  const copied = archives()
  requireValue(sourceRows.every(source => copied.some(row => row.sourceKey === source.key && row.sourceFingerprint === source.fingerprint)), '原记录在转换期间发生变化；归档已保留，未启用历史转换结果，请重新核对。')
  for (const source of sourceFiles) {
    const saved = await readCuttingRecordFile(`AW-POST-LEGACY-FILE:${source.id}`)
    requireValue(saved && saved.type === source.blob.type && saved.size === source.blob.size, '原辅料附件归档不完整，尚未启用转换结果。')
    const before = new Uint8Array(await crypto.subtle.digest('SHA-256', await source.blob.arrayBuffer()))
    const after = new Uint8Array(await crypto.subtle.digest('SHA-256', await saved.arrayBuffer()))
    requireValue(before.every((byte, index) => byte === after[index]), '原辅料附件归档内容不一致，原源仍保留。')
  }
  const incomplete = batches().filter(row => row.phase === 'COPIED')
  for (const batch of incomplete) await saveAccessoryWarehouseAction({ commandId: `${input.commandId}:verify:${batch.id}`, intent: `verify-legacy-post:${batch.id}`, result: { batchId: batch.id }, change: { puts: [accessoryRecord('migration', batch.id, { ...batch, phase: 'COMPLETE' })] } })
  return inspectLegacyAccessoryPostMigration()
}
export function readLegacyAccessoryPostBackup(): { format: 'accessory-post-legacy-scope'; version: 1; retainedOriginal: true; sources: Source[]; archived: Archive[]; demonstrationHistory: ReturnType<typeof legacyDemonstrationHistory> } { return { format: 'accessory-post-legacy-scope', version: 1, retainedOriginal: true, sources: structuredClone(sourceRows), archived: archives(), demonstrationHistory: legacyDemonstrationHistory() } }
/** 导出本范围原记录和原始附件字节；不扫描或改变其他 PCS 对象。 */
export async function exportLegacyAccessoryPostBackup(): Promise<Blob> {
  await prepareAccessoryPostFinishing()
  const backup = readLegacyAccessoryPostBackup(), files = new Map(sourceFiles.map(file => [file.id, file.blob]))
  for (const archive of backup.archived) for (const file of archive.files) {
    if (files.has(file.originalId)) continue
    const blob = await readCuttingRecordFile(file.fileId)
    requireValue(blob, '归档附件缺失，未导出不完整备份；原源仍保留。')
    files.set(file.originalId, blob)
  }
  const bytes = await Promise.all([...files].map(async ([id, blob]) => ({ id, type: blob.type, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) })))
  return new Blob([JSON.stringify({ ...backup, files: bytes })], { type: 'application/json' })
}
export async function receiveAccessoryPostTransfer(input: { id: string; actor: AccessoryWarehouseActor; commandId: string; lines: AccessoryReceiptLine[]; at: string }): Promise<{ transfer: PostFinishingMaterialTransferOrder; alreadyInbound: boolean }> {
  await prepareAccessoryPostFinishing()
  const transfer = postTransfers().find(row => row.id === input.id || postNumber(row) === input.id)
  requireValue(transfer, '没有找到当前后道辅料调拨单。')
  const prep = preparationFor(transfer.productionOrderId)!
  const relevant = sourceRows.filter(row => row.value.productionOrderNo === prep.productionOrderNo || ('productionOrderId' in row.value && row.value.productionOrderId === prep.productionOrderId))
  requireValue(relevant.every(source => archives().some(archive => archive.sourceKey === source.key && archive.sourceFingerprint === source.fingerprint && batches().some(batch => batch.id === archive.batchId && batch.phase === 'COMPLETE'))), '本单原后道辅料资料尚未归档核验，请先保留原资料并完成核对。')
  requireValue(input.actor.role === '仓管' && input.actor.warehouseCode === 'DLN' && input.actor.name.trim(), '仅 DLN 后道仓管可确认辅料收货上架。')
  const receipt = listAccessoryRecords<AccessoryReceipt>('receipt').find(row => row.transferId === transfer.id && row.warehouseCode === 'DLN' && row.status !== '已取消')
  requireValue(receipt, '后道接收事项已取消或失效，请重新读取。')
  if (transfer.status === '已收货') { requireValue(JSON.stringify([...input.lines].sort((a, b) => a.lineId.localeCompare(b.lineId))) === JSON.stringify([...receipt.lines].sort((a, b) => a.lineId.localeCompare(b.lineId))), '该单已收货，本次数量或库位与原收货不同，未再次保存。'); return { transfer: project(transfer), alreadyInbound: true } }
  const result = buildAccessoryReceiveChange({ transfer, receipt, lines: input.lines, locations: listAccessoryPostLocations(), stocks: listAccessoryStockSources(listAccessoryRecords<AccessoryStock>('stock')), actor: input.actor, commandId: input.commandId, at: input.at })
  const saved = await saveAccessoryWarehouseAction({ commandId: input.commandId, intent: `receive-post:${transfer.id}`, result: result.transfer, change: result.change })
  return { transfer: project(saved), alreadyInbound: false }
}
