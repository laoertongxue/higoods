/**
 * 对外样品池链接(原型 mock,跟随 manage.higood.ai /pms/kol_sample_link/index)。
 *
 * 每个链接对应一个对外样品池(多个 SKU)、最大可选数量、有效期(到期后状态变"已过期")、
 * 提交状态(待提交/已提交/已作废)、访问次数、关联申请单。
 * 操作:复制链接 / 修改样品池 / 作废 / 查看申请单 —— 原型只展示状态变化,真实提交由 manage.higood.ai 处理。
 */
import { PMS_STORES, pmsAll, pmsCommitRecords } from './idb-storage.ts'
import { getPmsKolStockRow, hydratePmsKolStock, listPmsKolStock } from './kol-sample-stock.ts'
import { PmsDomainError } from './runtime.ts'

export type PmsKolLinkStatus = '待提交' | '已提交' | '已作废'

export interface PmsKolLinkRow {
  id: string
  linkId?: string
  _pmsBaseVersion?: number
  skus?: string[]
  linkName: string
  url: string
  samplePoolName: string
  sampleCount: number
  maxSkuSelection: number
  expiresAt: string
  computedStatus: PmsKolLinkStatus | '已过期'
  persistedStatus: PmsKolLinkStatus
  visitCount: number
  relatedApplyId: string
  creator: string
  createdAt: string
}

interface KolLinkRuntime {
  rows: PmsKolLinkRow[]
}

function getRuntime(): KolLinkRuntime {
  return kolLinkRuntime ??= { rows: seedLinks() }
}

const NOW = () => Date.now()

function statusFor(row: PmsKolLinkRow): PmsKolLinkRow['computedStatus'] {
  if (row.persistedStatus === '已作废') return '已作废'
  if (row.persistedStatus === '已提交') return '已提交'
  const ts = Date.parse(row.expiresAt.replace(' ', 'T'))
  if (!Number.isNaN(ts) && ts < NOW()) return '已过期'
  return '待提交'
}

let kolLinkRuntime: KolLinkRuntime | null = null
function seedLinks(): PmsKolLinkRow[] {
  const stocks = listPmsKolStock()
  return Array.from({ length: 6 }, (_, index) => {
    const id = `POOL-DEMO-${index + 1}`
    const skus = stocks.slice(index, index + 2).map(s => s.sku)
    return { id, linkId: id, skus, linkName: `寄样池 ${index + 1}`, samplePoolName: `寄样池 ${index + 1}`,
      url: `/pms/kol-sample-link?pool=${id}`, sampleCount: skus.length, maxSkuSelection: Math.min(2,skus.length), expiresAt: '2026-12-31T23:59:59', computedStatus: '待提交', persistedStatus: '待提交',
      visitCount: 0, relatedApplyId: '', creator: '采购管理', createdAt: '2026-10-13T08:00:00' }
  })
}
let hydration: Promise<void> | null = null
export function hydratePmsKolLinks(): Promise<void> {
  return hydration ??= pmsAll<PmsKolLinkRow>(PMS_STORES.pmsKolLinks).then(rows => {
    for (const row of rows) { const index = getRuntime().rows.findIndex(old => old.id === row.id); if(index < 0) getRuntime().rows.unshift(row); else getRuntime().rows[index] = row }
  }).catch(error => { hydration = null; throw error })
}

export function listPmsKolLinks(): PmsKolLinkRow[] {
  for (const row of getRuntime().rows) row.computedStatus = statusFor(row)
  return getRuntime().rows.slice()
}

export interface PmsKolLinkFilter {
  search?: string
  status?: '' | '全部' | PmsKolLinkStatus | '已过期'
}

export function filterPmsKolLinks(filter: PmsKolLinkFilter): PmsKolLinkRow[] {
  const search = filter.search?.trim().toLowerCase() ?? ''
  return listPmsKolLinks().filter((row) => {
    if (search) {
      const candidates = [row.linkName, row.url, row.relatedApplyId, row.creator, row.id].join(' ').toLowerCase()
      if (!candidates.includes(search)) return false
    }
    if (filter.status && filter.status !== '全部') {
      if (row.computedStatus !== filter.status) return false
    }
    return true
  })
}

export interface PmsKolLinkStats {
  totalLinks: number
  pending: number
  submitted: number
  expired: number
  invalidated: number
}

export function summarizePmsKolLinks(filter: PmsKolLinkFilter): PmsKolLinkStats {
  const rows = filterPmsKolLinks(filter)
  return rows.reduce<PmsKolLinkStats>(
    (acc, row) => ({
      totalLinks: acc.totalLinks + 1,
      pending: acc.pending + (row.computedStatus === '待提交' ? 1 : 0),
      submitted: acc.submitted + (row.computedStatus === '已提交' ? 1 : 0),
      expired: acc.expired + (row.computedStatus === '已过期' ? 1 : 0),
      invalidated: acc.invalidated + (row.computedStatus === '已作废' ? 1 : 0),
    }),
    { totalLinks: 0, pending: 0, submitted: 0, expired: 0, invalidated: 0 },
  )
}

export function getPmsKolLink(id: string): PmsKolLinkRow | undefined {
  return listPmsKolLinks().find((r) => r.id === id)
}

export async function invalidatePmsKolLink(id: string, operationId: string = crypto.randomUUID()): Promise<PmsKolLinkRow> {
  await hydratePmsKolLinks()
  const before = getPmsKolLink(id)
  if (!before) throw new PmsDomainError('PMS_KOL_LINK_NOT_FOUND', `链接 ${id} 不存在`)
  if (before.persistedStatus === '已提交') throw new PmsDomainError('PMS_KOL_LINK_SUBMITTED', '已提交的链接不能作废')
  const row = { ...before, linkId: id, persistedStatus: '已作废' as const, computedStatus: '已作废' as const }
  await pmsCommitRecords([{ store: PMS_STORES.pmsKolLinks, value: row }], { operationId,operationSignature:JSON.stringify(id) })
  Object.assign(before, row)
  return before
}

export async function createPmsKolLink(skus: string[], options: { name?: string; maxSkuSelection?: number; expiresAt?: string; operationId?: string } = {}): Promise<PmsKolLinkRow> {
  await Promise.all([hydratePmsKolLinks(), hydratePmsKolStock()])
  const selected = validatePool(skus)
  const id = options.operationId || crypto.randomUUID()
  const maxSkuSelection = options.maxSkuSelection ?? Math.min(3, selected.length)
  const expiresAt = options.expiresAt || new Date(Date.now() + 7 * 86400000).toISOString()
  validatePoolOptions(maxSkuSelection, selected.length, expiresAt)
  const name = options.name?.trim() || '寄样池'
  const row: PmsKolLinkRow = { id, linkId: id, skus: selected, url: `/pms/kol-sample-link?pool=${encodeURIComponent(id)}`,
    linkName: name, samplePoolName: name, sampleCount: selected.length, maxSkuSelection, expiresAt,
    computedStatus: '待提交', persistedStatus: '待提交', visitCount: 0, relatedApplyId: '', creator: '采购管理', createdAt: new Date().toISOString() }
  await pmsCommitRecords([{ store: PMS_STORES.pmsKolLinks, value: row }], { operationId: id,operationSignature:JSON.stringify([selected,options.name || '寄样池',options.maxSkuSelection || 'default',options.expiresAt || '7days']) })
  const existing = getRuntime().rows.findIndex(old => old.id === id)
  if(existing < 0) getRuntime().rows.unshift(row); else getRuntime().rows[existing] = row
  return row
}
function validatePool(skus: string[]): string[] {
  const selected = [...new Set(skus)]
  if (!selected.length) throw new PmsDomainError('PMS_KOL_POOL_EMPTY', '请先选择样品 SKU')
  for(const sku of selected) {
    const stock = getPmsKolStockRow(sku)
    if (!stock || stock.kolStock <= 0) throw new PmsDomainError('PMS_KOL_POOL_STOCK', `${sku} 没有可寄样库存`)
  }
  return selected
}
function validatePoolOptions(max: number, count: number, expires: string): void {
  if(!Number.isInteger(max) || max < 1 || max > count) throw new PmsDomainError('PMS_KOL_POOL_LIMIT', `最多可选数量须为 1～${count} 个 SKU`)
  if(!Number.isFinite(Date.parse(expires)) || Date.parse(expires) <= Date.now()) throw new PmsDomainError('PMS_KOL_POOL_EXPIRY', '有效期须晚于当前时间')
}
export async function updatePmsKolLink(id: string, patch: { name: string; maxSkuSelection: number; expiresAt: string; skus: string[] }, operationId: string = crypto.randomUUID()): Promise<PmsKolLinkRow> {
  await Promise.all([hydratePmsKolLinks(), hydratePmsKolStock()])
  const before = getPmsKolLink(id)
  if (!before || before.persistedStatus !== '待提交') throw new PmsDomainError('PMS_KOL_POOL_LOCKED', '当前链接状态不允许修改样品池')
  const skus = validatePool(patch.skus)
  validatePoolOptions(patch.maxSkuSelection, skus.length, patch.expiresAt)
  if (!patch.name.trim()) throw new PmsDomainError('PMS_KOL_POOL_NAME', '填写样品池名称')
  const row = { ...before, linkId: id, skus, linkName: patch.name.trim(), samplePoolName: patch.name.trim(), sampleCount: skus.length, maxSkuSelection: patch.maxSkuSelection, expiresAt: patch.expiresAt }
  await pmsCommitRecords([{ store: PMS_STORES.pmsKolLinks, value: row }], { operationId,operationSignature:JSON.stringify([id,patch]) })
  Object.assign(before, row)
  return before
}
export function publishPmsKolLink(row: PmsKolLinkRow): void {
  const before = getRuntime().rows.find(old => old.id === row.id)
  if(before) Object.assign(before,row); else getRuntime().rows.unshift(row)
}
