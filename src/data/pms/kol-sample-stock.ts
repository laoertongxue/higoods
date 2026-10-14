/**
 * KOL 库存(原型 mock,跟随 manage.higood.ai /pms/kol_sample_stock/index)。
 *
 * mock 字段:商品信息(SPU/SKU/名称/图片)、品牌、商品定位(低价/低价改款/设计款等)、
 * KOL 库存数量、VKOL 当日手动锁定池、锁定已占用、操作(释放)。
 * 操作按记录保存，事务完成后发布；刷新从本浏览器 IndexedDB 回读。
 */
import { listSkuArchives } from '../pcs-sku-archive-repository.ts'
import { PMS_STORES, pmsAll, pmsCommitRecords } from './idb-storage.ts'
import { appendKolLockRows, makeKolLockRow } from './kol-sample-stock-lock-log.ts'
import { createPmsKolLink } from './kol-sample-link.ts'
import { PmsDomainError } from './runtime.ts'

export type PmsKolBrand = '全部' | 'Asaya' | 'Chicmore' | 'FADFAD' | 'Tendblank' | 'LUXME' | 'MODISH' | 'PRIMA'
export type PmsKolPositioning =
  | '低价'
  | '低价改款'
  | '设计款'
  | '基础款'
  | '主推款'
  | '形象款'
  | '联名款'
  | '专题款'
  | '其他'

export const PmsKolBrandList: PmsKolBrand[] = ['全部', 'Asaya', 'Chicmore', 'FADFAD', 'Tendblank', 'LUXME', 'MODISH', 'PRIMA']
export const PmsKolPositioningList: PmsKolPositioning[] = ['低价', '低价改款', '设计款', '基础款', '主推款', '形象款', '联名款', '专题款', '其他']

export interface PmsKolStockRow {
  id?: string
  _pmsBaseVersion?: number
  sku: string
  spu: string
  productName: string
  imageUrl: string
  brand: Exclude<PmsKolBrand, '全部'>
  positioning: PmsKolPositioning
  kolStock: number
  vkolManualLockedPool: number
  lockedOccupied: number
}

interface KolStockRuntime {
  rows: PmsKolStockRow[]
}

function getRuntime(): KolStockRuntime {
  return kolStockRuntime ??= { rows: seedStock() }
}

let kolStockRuntime: KolStockRuntime | null = null
function seedStock(): PmsKolStockRow[] {
  return listSkuArchives().filter(row => row.skuImageUrl && row.archiveStatus === 'ACTIVE').slice(0, 20).map((row, index) => ({
    id: row.skuCode, sku: row.skuCode, spu: row.styleCode, productName: row.styleName,
    imageUrl: row.skuImageUrl, brand: 'Asaya', positioning: '基础款',
    kolStock: 12 + index, vkolManualLockedPool: 5, lockedOccupied: index < 3 ? 1 : 0,
  }))
}
let hydration: Promise<void> | null = null
export function hydratePmsKolStock(): Promise<void> {
  return hydration ??= pmsAll<PmsKolStockRow>(PMS_STORES.pmsKolStock).then(saved => {
    const rows = getRuntime().rows
    for (const row of saved) { const i = rows.findIndex(seed => seed.sku === row.sku); if(i < 0) rows.push(row); else rows[i] = row }
  }).catch(error => { hydration = null; throw error })
}

export interface PmsKolStockFilter {
  search?: string
  brand?: '' | PmsKolBrand
  positioning?: '' | PmsKolPositioning
  stockAtLeast?: number
  stockAtMost?: number
  lockedStatus?: '' | '全部SKU' | '有锁定'
}

export function listPmsKolStock(): PmsKolStockRow[] {
  return getRuntime().rows.slice()
}

export function filterPmsKolStock(filter: PmsKolStockFilter): PmsKolStockRow[] {
  const search = filter.search?.trim().toLowerCase() ?? ''
  return getRuntime().rows.filter((row) => {
    if (search) {
      const candidates = [row.sku, row.spu, row.productName].join(' ').toLowerCase()
      if (!candidates.includes(search)) return false
    }
    if (filter.brand && filter.brand !== '全部' && row.brand !== filter.brand) return false
    if (filter.positioning && row.positioning !== filter.positioning) return false
    if (filter.stockAtLeast !== undefined && row.kolStock < filter.stockAtLeast) return false
    if (filter.stockAtMost !== undefined && row.kolStock > filter.stockAtMost) return false
    if (filter.lockedStatus === '全部SKU') {
      // no-op
    } else if (filter.lockedStatus === '有锁定') {
      if (row.vkolManualLockedPool <= 0 && row.lockedOccupied <= 0) return false
    }
    return true
  })
}

export interface PmsKolStockStats {
  totalSkus: number
  totalKolStock: number
  totalVkolManualLockedPool: number
  totalLockedOccupied: number
}

export function summarizePmsKolStock(filter: PmsKolStockFilter): PmsKolStockStats {
  const rows = filterPmsKolStock(filter)
  return rows.reduce<PmsKolStockStats>(
    (acc, row) => ({
      totalSkus: acc.totalSkus + 1,
      totalKolStock: acc.totalKolStock + row.kolStock,
      totalVkolManualLockedPool: acc.totalVkolManualLockedPool + row.vkolManualLockedPool,
      totalLockedOccupied: acc.totalLockedOccupied + row.lockedOccupied,
    }),
    { totalSkus: 0, totalKolStock: 0, totalVkolManualLockedPool: 0, totalLockedOccupied: 0 },
  )
}

export function getPmsKolStockRow(sku: string): PmsKolStockRow | undefined {
  return getRuntime().rows.find((row) => row.sku === sku)
}

export interface ReleasePmsKolLockResult {
  released: number
  failedSkus: string[]
}

export async function releasePmsKolLock(skus: string[], operationId: string = crypto.randomUUID()): Promise<ReleasePmsKolLockResult> {
  await hydratePmsKolStock()
  if (!skus.length) throw new PmsKolStockEmptySelectionError()
  const candidates = [...new Set(skus)].map(sku => {
    const current = getPmsKolStockRow(sku)
    if (!current) throw new PmsKolStockInvalidSkuError(sku)
    return { before: current, next: { ...current, id: sku, vkolManualLockedPool: current.lockedOccupied } }
  })
  const logs = candidates.map(({ before, next }) => makeKolLockRow(before, next, '手动释放', operationId))
  await pmsCommitRecords([...candidates.map(({ next }) => ({ store: PMS_STORES.pmsKolStock, value: next })), ...logs.map(value => ({ store: PMS_STORES.pmsKolLockLogs, value }))], { operationId,operationSignature:JSON.stringify(skus) })
  for (const { before, next } of candidates) Object.assign(before, next)
  appendKolLockRows(logs)
  return { released: candidates.reduce((sum, { before }, i) => sum - logs[i].deltaQty, 0), failedSkus: [] }
}

export interface LockPmsKolStockResult {
  locked: Array<{ sku: string; qty: number }>
  insufficient: Array<{ sku: string; requested: number; available: number }>
}

/** Entries are the final pool values, not increments. Occupied quantities cannot be released. */
export async function lockPmsKolStockBatch(entries: Array<{ sku: string; qty: number }>, operationId: string = crypto.randomUUID()): Promise<LockPmsKolStockResult> {
  await hydratePmsKolStock()
  if (!entries.length) throw new PmsKolStockEmptySelectionError()
  if (new Set(entries.map(e => e.sku)).size !== entries.length) throw new PmsDomainError('PMS_KOL_LOCK_DUPLICATE', '同一 SKU 不能重复锁定')
  const candidates = entries.map(entry => {
    const before = getPmsKolStockRow(entry.sku)
    if (!before) throw new PmsKolStockInvalidSkuError(entry.sku)
    if (!Number.isInteger(entry.qty) || entry.qty < before.lockedOccupied || entry.qty > before.kolStock) throw new PmsDomainError('PMS_KOL_LOCK_QUANTITY', `${entry.sku} 锁定池须为 ${before.lockedOccupied}～${before.kolStock} 件的整数`)
    return { before, next: { ...before, id: before.sku, vkolManualLockedPool: entry.qty } }
  })
  const logs = candidates.map(({ before, next }) => makeKolLockRow(before, next, '手动锁定', operationId))
  await pmsCommitRecords([...candidates.map(({ next }) => ({ store: PMS_STORES.pmsKolStock, value: next })), ...logs.map(value => ({ store: PMS_STORES.pmsKolLockLogs, value }))], { operationId,operationSignature:JSON.stringify(entries) })
  for (const { before, next } of candidates) Object.assign(before, next)
  appendKolLockRows(logs)
  return { locked: entries, insufficient: [] }
}

export interface CreateKolLinkResult {
  linkCode: string
  url: string
}

export async function generatePmsKolLinkCode(skus: string[], options: { name?: string; maxSkuSelection?: number; expiresAt?: string; operationId?: string } = {}): Promise<CreateKolLinkResult> {
  const row = await createPmsKolLink(skus, options)
  return { linkCode: row.id, url: row.url }
}

export class PmsKolStockEmptySelectionError extends PmsDomainError {
  constructor() {
    super('PMS_KOL_STOCK_EMPTY_SELECTION', '请先选择要操作的 SKU')
  }
}

export class PmsKolStockInvalidSkuError extends PmsDomainError {
  constructor(sku: string) {
    super('PMS_KOL_STOCK_INVALID_SKU', `SKU ${sku} 不存在`)
  }
}

/** Receipt candidates join the upstream purchase/KOL-demand transaction. */
export function preparePmsKolStockReceipt(entries:Array<{sku:string;quantity:number}>):PmsKolStockRow[] {
  if(new Set(entries.map(row=>row.sku)).size!==entries.length) throw new PmsDomainError('PMS_KOL_RECEIPT_DUPLICATE','同一入库动作不能重复包含相同 SKU')
  return entries.map(entry=>{
    if(!Number.isInteger(entry.quantity)||entry.quantity<=0) throw new PmsDomainError('PMS_KOL_RECEIPT_QUANTITY','入库件数须为正整数')
    const existing=getPmsKolStockRow(entry.sku)
    if(existing) return {...structuredClone(existing),id:existing.sku,kolStock:existing.kolStock+entry.quantity}
    const source=listSkuArchives().find(row=>row.skuCode===entry.sku && row.archiveStatus==='ACTIVE' && row.skuImageUrl)
    if(!source) throw new PmsDomainError('PMS_KOL_RECEIPT_SOURCE',`${entry.sku} 缺少有效商品档案及对应图片`)
    return {id:source.skuCode,sku:source.skuCode,spu:source.styleCode,productName:source.styleName,imageUrl:source.skuImageUrl,brand:'Asaya',positioning:'基础款',kolStock:entry.quantity,vkolManualLockedPool:0,lockedOccupied:0,_pmsBaseVersion:0}
  })
}
export function publishPmsKolStock(rows:PmsKolStockRow[]):void {
  for(const row of rows){const before=getPmsKolStockRow(row.sku);if(before) Object.assign(before,row);else getRuntime().rows.push(row)}
}

/** Issue candidates preserve occupied samples and bound the remaining pool to real stock. */
export function preparePmsKolStockIssue(entries:Array<{sku:string;quantity:number}>):PmsKolStockRow[]{
 if(!entries.length || new Set(entries.map(row=>row.sku)).size!==entries.length)throw new PmsDomainError('PMS_KOL_ISSUE_DUPLICATE','出库 SKU 不可为空或重复')
 return entries.map(entry=>{const row=getPmsKolStockRow(entry.sku);if(!row)throw new PmsDomainError('PMS_KOL_ISSUE_SOURCE',`${entry.sku} 没有KOL库存，不能出库`);const available=row.kolStock-row.lockedOccupied;if(!Number.isInteger(entry.quantity)||entry.quantity<=0||entry.quantity>available)throw new PmsDomainError('PMS_KOL_ISSUE_QUANTITY',`${entry.sku} 可出库 ${available} 件，申请已占用 ${row.lockedOccupied} 件须保留`);const remaining=row.kolStock-entry.quantity;return {...structuredClone(row),id:row.id || row.sku,kolStock:remaining,vkolManualLockedPool:Math.min(row.vkolManualLockedPool,remaining)}})
}
export function preparePmsKolStockIssueLogs(entries:Array<{sku:string;quantity:number}>,operationId:string){
 const next=preparePmsKolStockIssue(entries);return next.flatMap(row=>{const before=getPmsKolStockRow(row.sku)!;return row.vkolManualLockedPool<before.vkolManualLockedPool?[{...makeKolLockRow(before,row,'手动释放',operationId),remark:'样衣出库后缩减未占用锁定池'}]:[]})
}
