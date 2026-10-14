/**
 * 手动寄样申请(原型 mock,跟随 manage.higood.ai /pms/kol_sample_apply/index)。
 *
 * 申请单 = 申请人/达人 + 收货信息 + 多样品行;含状态(待审核/已通过/已驳回)、审核记录、借出单号(已通过的从库存管理生成)。
 * 操作:仅详情查看,审核动作真实由 manage.higood.ai 处理,原型只有详情侧拉抽屉(已实现)。
 */
import { PMS_STORES, pmsAll, pmsCommitRecords } from './idb-storage.ts'
import { getPmsKolStockRow, hydratePmsKolStock, listPmsKolStock } from './kol-sample-stock.ts'
import { getPmsKolLink, hydratePmsKolLinks, publishPmsKolLink } from './kol-sample-link.ts'
import { appendKolLockRows, makeKolLockRow } from './kol-sample-stock-lock-log.ts'
import { PmsDomainError } from './runtime.ts'

export type PmsKolApplyStatus = '待审核' | '已通过' | '已驳回'

export interface PmsKolApplySampleItem {
  sku: string
  spu: string
  imageUrl: string
  qty: number
}

export interface PmsKolApplyAuditRecord {
  reviewer: string
  reviewedAt: string
  remark: string
}

export interface PmsKolApplyRow {
  id: string
  applyNo?: string
  _pmsBaseVersion?: number
  submittedAt: string
  linkCode: string
  applicantHandle: string
  applicantPlatform: string
  applicantContact: string
  recipientName: string
  recipientAddress: string
  samples: PmsKolApplySampleItem[]
  totalQty: number
  status: PmsKolApplyStatus
  auditTrail: PmsKolApplyAuditRecord[]
  borrowOrderNo: string
  borrowOrder?: {id:string;createdAt:string;recipientName:string;recipientAddress:string;items:PmsKolApplySampleItem[]}
}

interface KolApplyRuntime {
  rows: PmsKolApplyRow[]
}

function getRuntime(): KolApplyRuntime {
  return kolApplyRuntime ??= { rows: seedApplies() }
}

let kolApplyRuntime: KolApplyRuntime | null = null
function seedApplies(): PmsKolApplyRow[] {
  return listPmsKolStock().slice(0,6).map((stock,index) => ({
    id: `APPLY-DEMO-${index+1}`, applyNo: `APPLY-DEMO-${index+1}`, submittedAt: '2026-10-13T08:00:00', linkCode: `POOL-DEMO-${index+1}`,
    applicantHandle: `达人 ${index+1}`, applicantPlatform: 'TikTok', applicantContact: `collab-${index+1}`, recipientName: `收货人 ${index+1}`, recipientAddress: 'Bandung',
    samples: [{ sku: stock.sku, spu: stock.spu, imageUrl: stock.imageUrl, qty: 1 }], totalQty: 1,
    status: index < 3 ? '待审核' : index < 5 ? '已驳回' : '已通过', auditTrail: index < 3 ? [] : [{ reviewer: '采购管理', reviewedAt: '2026-10-13T09:00:00', remark: index < 5 ? '取消寄样' : '已确认寄样' }],
    borrowOrderNo: index < 5 ? '-' : 'BORROW-DEMO-6',
  }))
}
let hydration: Promise<void> | null = null
export function hydratePmsKolApplies(): Promise<void> {
  return hydration ??= pmsAll<PmsKolApplyRow>(PMS_STORES.pmsKolApplies).then(rows => {
    for(const row of rows) { const index = getRuntime().rows.findIndex(old => old.id === row.id); if(index < 0) getRuntime().rows.unshift(row); else getRuntime().rows[index] = row }
  }).catch(error => { hydration = null; throw error })
}

export function listPmsKolApply(): PmsKolApplyRow[] {
  return getRuntime().rows.slice()
}

export interface PmsKolApplyFilter {
  search?: string
  status?: '' | PmsKolApplyStatus
  submittedAtFrom?: string
  submittedAtTo?: string
}

export function filterPmsKolApply(filter: PmsKolApplyFilter): PmsKolApplyRow[] {
  const search = filter.search?.trim().toLowerCase() ?? ''
  const fromTs = filter.submittedAtFrom ? Date.parse(filter.submittedAtFrom.replace(' ', 'T')) : undefined
  const toTs = filter.submittedAtTo ? Date.parse(`${filter.submittedAtTo} 23:59:59`) : undefined
  return getRuntime().rows.filter((row) => {
    if (search) {
      const candidates = [row.id, row.applicantHandle, row.recipientName, row.linkCode].join(' ').toLowerCase()
      if (!candidates.includes(search)) return false
    }
    if (filter.status && row.status !== filter.status) return false
    if (fromTs !== undefined || toTs !== undefined) {
      const ts = row.submittedAt ? Date.parse(row.submittedAt.replace(' ', 'T')) : Number.NaN
      if (Number.isNaN(ts)) return false
      if (fromTs !== undefined && ts < fromTs) return false
      if (toTs !== undefined && ts > toTs) return false
    }
    return true
  })
}

export interface PmsKolApplyStats {
  totalApply: number
  totalSamples: number
  pending: number
  approved: number
  rejected: number
}

export function summarizePmsKolApply(filter: PmsKolApplyFilter): PmsKolApplyStats {
  const rows = filterPmsKolApply(filter)
  return rows.reduce<PmsKolApplyStats>(
    (acc, row) => ({
      totalApply: acc.totalApply + 1,
      totalSamples: acc.totalSamples + row.totalQty,
      pending: acc.pending + (row.status === '待审核' ? 1 : 0),
      approved: acc.approved + (row.status === '已通过' ? 1 : 0),
      rejected: acc.rejected + (row.status === '已驳回' ? 1 : 0),
    }),
    { totalApply: 0, totalSamples: 0, pending: 0, approved: 0, rejected: 0 },
  )
}

export function getPmsKolApply(id: string): PmsKolApplyRow | undefined {
  return getRuntime().rows.find((r) => r.id === id)
}

export class PmsKolApplyNotFoundError extends PmsDomainError {
  constructor(id: string) {
    super('PMS_KOL_APPLY_NOT_FOUND', `手动寄样申请 ${id} 不存在`)
  }
}

export async function submitPmsKolApply(linkId: string, input: { applicantHandle: string; applicantPlatform: string; applicantContact: string; recipientName: string; recipientAddress: string; samples: Array<{sku:string;qty:number}> }, operationId: string = crypto.randomUUID()): Promise<PmsKolApplyRow> {
  await Promise.all([hydratePmsKolApplies(), hydratePmsKolStock(), hydratePmsKolLinks()])
  const link = getPmsKolLink(linkId)
  if(!link || link.computedStatus !== '待提交') throw new PmsDomainError('PMS_KOL_LINK_LOCKED','该样品池当前不能提交申请')
  if(!input.applicantHandle.trim() || !input.recipientName.trim() || !input.recipientAddress.trim() || !input.applicantContact.trim()) throw new PmsDomainError('PMS_KOL_APPLY_REQUIRED','填写达人、联系方式、收货人和收货地址')
  if(!input.samples.length || input.samples.length > link.maxSkuSelection || new Set(input.samples.map(s=>s.sku)).size !== input.samples.length) throw new PmsDomainError('PMS_KOL_SELECTION_LIMIT',`选择 1～${link.maxSkuSelection} 个不重复 SKU`)
  const candidates = input.samples.map(item => {
    const before = getPmsKolStockRow(item.sku)
    if(!before || !link.skus?.includes(item.sku)) throw new PmsDomainError('PMS_KOL_SKU_OUTSIDE_POOL',`${item.sku} 不在当前样品池`)
    const available = before.vkolManualLockedPool - before.lockedOccupied
    if(!Number.isInteger(item.qty) || item.qty < 1 || item.qty > available) throw new PmsDomainError('PMS_KOL_STOCK_OVER',`${item.sku} 可申请 ${available} 件`)
    return { before, next: { ...before, id: before.sku, lockedOccupied: before.lockedOccupied + item.qty }, qty: item.qty }
  })
  const id = `APPLY-${operationId}`
  const row: PmsKolApplyRow = { id, applyNo:id, submittedAt:new Date().toISOString(),linkCode:link.id, ...input, samples:candidates.map(({before,qty})=>({sku:before.sku,spu:before.spu,imageUrl:before.imageUrl,qty})), totalQty:candidates.reduce((sum,r)=>sum+r.qty,0),status:'待审核',auditTrail:[],borrowOrderNo:'-' }
  const nextLink = { ...link, linkId:link.id,persistedStatus:'已提交' as const, computedStatus:'已提交' as const,relatedApplyId:id }
  const logs = candidates.map(({before,next})=>makeKolLockRow(before,next,'申请单自动占用',operationId,id))
  await pmsCommitRecords([{store:PMS_STORES.pmsKolApplies,value:row},{store:PMS_STORES.pmsKolLinks,value:nextLink},...candidates.map(({next})=>({store:PMS_STORES.pmsKolStock,value:next})),...logs.map(value=>({store:PMS_STORES.pmsKolLockLogs,value}))],{operationId,operationSignature:JSON.stringify([linkId,input])})
  for(const {before,next} of candidates) Object.assign(before,next)
  publishPmsKolLink(nextLink);appendKolLockRows(logs);getRuntime().rows.unshift(row)
  return row
}
export async function reviewPmsKolApply(id: string, approved: boolean, reason: string, operationId: string = crypto.randomUUID()): Promise<PmsKolApplyRow> {
  await Promise.all([hydratePmsKolApplies(),hydratePmsKolStock()])
  const before = getPmsKolApply(id)
  if(!before || before.status !== '待审核') throw new PmsDomainError('PMS_KOL_REVIEW_LOCKED','仅待审核申请可以审核')
  if(!reason.trim()) throw new PmsDomainError('PMS_KOL_REVIEW_REASON','填写审核说明')
  const candidates = before.samples.map(item => {
    const stock = getPmsKolStockRow(item.sku)
    if(!stock || stock.lockedOccupied < item.qty || stock.kolStock < item.qty) throw new PmsDomainError('PMS_KOL_OCCUPANCY_MISMATCH',`${item.sku} 库存占用不一致，重新读取后核对`)
    return { before:stock, next:{...stock,id:stock.sku,kolStock:stock.kolStock-(approved?item.qty:0),vkolManualLockedPool:stock.vkolManualLockedPool-(approved?item.qty:0),lockedOccupied:stock.lockedOccupied-item.qty} }
  })
  const row = { ...before,applyNo:id,status:approved?'已通过' as const:'已驳回' as const,borrowOrderNo:approved?`JS-${operationId.replaceAll('-','').slice(0,10).toUpperCase()}`:'-',borrowOrder:approved?{id:`JS-${operationId.replaceAll('-','').slice(0,10).toUpperCase()}`,createdAt:new Date().toISOString(),recipientName:before.recipientName,recipientAddress:before.recipientAddress,items:structuredClone(before.samples)}:undefined,auditTrail:[...before.auditTrail,{reviewer:'采购管理',reviewedAt:new Date().toISOString(),remark:reason.trim()}] }
  const logs = candidates.map(({before,next})=>makeKolLockRow(before,next,approved?'手动释放':'驳回释放占用',operationId,id))
  await pmsCommitRecords([{store:PMS_STORES.pmsKolApplies,value:row},...candidates.map(({next})=>({store:PMS_STORES.pmsKolStock,value:next})),...logs.map(value=>({store:PMS_STORES.pmsKolLockLogs,value}))],{operationId,operationSignature:JSON.stringify([id,approved,reason])})
  Object.assign(before,row);for(const {before,next} of candidates) Object.assign(before,next);appendKolLockRows(logs)
  return before
}
