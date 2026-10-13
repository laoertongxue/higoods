/**
 * 对外样品池链接(原型 mock,跟随 manage.higood.ai /pms/kol_sample_link/index)。
 *
 * 每个链接对应一个对外样品池(多个 SKU)、最大可选数量、有效期(到期后状态变"已过期")、
 * 提交状态(待提交/已提交/已作废)、访问次数、关联申请单。
 * 操作:复制链接 / 修改样品池 / 作废 / 查看申请单 —— 原型只展示状态变化,真实提交由 manage.higood.ai 处理。
 */
import { PmsDomainError } from './runtime.ts'

export type PmsKolLinkStatus = '待提交' | '已提交' | '已作废'

export interface PmsKolLinkRow {
  id: string
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
  return kolLinkRuntime
}

const NOW = () => Date.now()

function statusFor(row: PmsKolLinkRow): PmsKolLinkRow['computedStatus'] {
  if (row.persistedStatus === '已作废') return '已作废'
  if (row.persistedStatus === '已提交') return '已提交'
  const ts = Date.parse(row.expiresAt.replace(' ', 'T').replace(/-/g, '/'))
  if (!Number.isNaN(ts) && ts < NOW()) return '已过期'
  return '待提交'
}

const kolLinkRuntime: KolLinkRuntime = {
  rows: [
    {
      id: 'LNK-RUBY-0821-A',
      linkName: 'Ruby专属',
      url: 'https://manage.higood.ai/kol_sample/22aaa3fa96e4cec90cb45328',
      samplePoolName: 'Ruby专属',
      sampleCount: 2,
      maxSkuSelection: 3,
      expiresAt: '2026-08-28 23:59:59',
      computedStatus: '已过期',
      persistedStatus: '待提交',
      visitCount: 2,
      relatedApplyId: '-',
      creator: '六六',
      createdAt: '2026-08-21 16:59:34',
    },
    {
      id: 'LNK-RUBY-0821-B',
      linkName: '-',
      url: 'https://manage.higood.ai/kol_sample/f5d35df66bd07fb1369b1841',
      samplePoolName: '-',
      sampleCount: 2,
      maxSkuSelection: 1,
      expiresAt: '2026-08-28 23:59:59',
      computedStatus: '已过期',
      persistedStatus: '待提交',
      visitCount: 0,
      relatedApplyId: '-',
      creator: '六六',
      createdAt: '2026-08-21 16:58:14',
    },
    {
      id: 'LNK-OFFICIAL-0821',
      linkName: '官方合作达人',
      url: 'https://manage.higood.ai/kol_sample/31102fefd2b7981657988f44',
      samplePoolName: '官方合作达人',
      sampleCount: 20,
      maxSkuSelection: 3,
      expiresAt: '2026-12-31 23:59:59',
      computedStatus: '已提交',
      persistedStatus: '已提交',
      visitCount: 2,
      relatedApplyId: 'KS2NHPI1Z5QF40116248',
      creator: '六六',
      createdAt: '2026-08-21 16:56:08',
    },
    {
      id: 'LNK-DRESS-0821',
      linkName: '-',
      url: 'https://manage.higood.ai/kol_sample/073f6946f93984c2ff528457',
      samplePoolName: '-',
      sampleCount: 2,
      maxSkuSelection: 3,
      expiresAt: '2026-12-31 23:59:59',
      computedStatus: '已作废',
      persistedStatus: '已作废',
      visitCount: 0,
      relatedApplyId: '-',
      creator: '六六',
      createdAt: '2026-08-21 15:44:49',
    },
    {
      id: 'LNK-SPORT-0821',
      linkName: '-',
      url: 'https://manage.higood.ai/kol_sample/a033f6beecdd12c227bf8ad8',
      samplePoolName: '-',
      sampleCount: 3,
      maxSkuSelection: 3,
      expiresAt: '2026-12-31 23:59:59',
      computedStatus: '已提交',
      persistedStatus: '已提交',
      visitCount: 4,
      relatedApplyId: 'KS2NHFRZ1TL8N4575513',
      creator: '六六',
      createdAt: '2026-08-21 15:03:10',
    },
  ],
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

export function invalidatePmsKolLink(id: string): PmsKolLinkRow {
  const row = getRuntime().rows.find((r) => r.id === id)
  if (!row) throw new PmsDomainError('PMS_KOL_LINK_NOT_FOUND', `链接 ${id} 不存在`)
  row.persistedStatus = '已作废'
  row.computedStatus = statusFor(row)
  return row
}
