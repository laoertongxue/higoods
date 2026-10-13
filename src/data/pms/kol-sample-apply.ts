/**
 * 手动寄样申请(原型 mock,跟随 manage.higood.ai /pms/kol_sample_apply/index)。
 *
 * 申请单 = 申请人/达人 + 收货信息 + 多样品行;含状态(待审核/已通过/已驳回)、审核记录、借出单号(已通过的从库存管理生成)。
 * 操作:仅详情查看,审核动作真实由 manage.higood.ai 处理,原型只有详情侧拉抽屉(已实现)。
 */
import { PMS_STYLE_IMAGES } from './images.ts'
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
}

interface KolApplyRuntime {
  rows: PmsKolApplyRow[]
}

function getRuntime(): KolApplyRuntime {
  return kolApplyRuntime
}

const kolApplyRuntime: KolApplyRuntime = {
  rows: [
    {
      id: 'KS2NHPI1Z5QF40116248',
      submittedAt: '2026-08-21 17:11:56',
      linkCode: '31102fefd2b7981657988f44',
      applicantHandle: '@galerianti',
      applicantPlatform: 'TikTok',
      applicantContact: '2i哦恶化的b',
      recipientName: 'Rubyyyyy',
      recipientAddress: '补充细胞外 234让同78 / 23456要 / 2345678908yutfnbvcx',
      samples: [
        { sku: 'ASYXL110799-sameasphoto-onesize', spu: 'ASYXL110799', imageUrl: PMS_STYLE_IMAGES.shirt, qty: 1 },
        { sku: 'ASYYC7226-coffee-l', spu: 'ASYYC7226', imageUrl: PMS_STYLE_IMAGES.shirt, qty: 1 },
        { sku: 'ASYZZ26052224-red-l', spu: 'ASYZZ26052224', imageUrl: PMS_STYLE_IMAGES.tshirt, qty: 1 },
      ],
      totalQty: 3,
      status: '已驳回',
      auditTrail: [{ reviewer: '六六', reviewedAt: '2026-08-21 17:13:41', remark: '不通过' }],
      borrowOrderNo: '-',
    },
    {
      id: 'KS2NHFRZ1TL8N4575513',
      submittedAt: '2026-08-21 15:22:55',
      linkCode: 'a033f6beecdd12c227bf8ad8',
      applicantHandle: 'mama.nazhief',
      applicantPlatform: 'Tiktok',
      applicantContact: '85649583913',
      recipientName: 'Nike Cholifah',
      recipientAddress: '85649583913 Jawa Timur / Malang / Jl. Kedawung X‑C No. 18, Kel. Tulusrejo, Kec. Lowokwaru',
      samples: [
        { sku: 'ASYXL112988-sameasphoto-onesize', spu: 'ASYXL112988', imageUrl: PMS_STYLE_IMAGES.shirt, qty: 1 },
      ],
      totalQty: 1,
      status: '已驳回',
      auditTrail: [{ reviewer: '六六', reviewedAt: '2026-08-21 15:25:28', remark: '测试' }],
      borrowOrderNo: '-',
    },
    {
      id: 'KS2NHZZ9123AA5500001',
      submittedAt: '2026-10-08 11:02:18',
      linkCode: 'b133f6beecdd12c227bf8ad9',
      applicantHandle: '@maya.collab',
      applicantPlatform: 'Instagram',
      applicantContact: 'maya.collab',
      recipientName: 'Maya Lestari',
      recipientAddress: 'Jl. Asia Afrika No. 100, Kel. Cikawao, Kec. Bojongloa Kidul, Bandung',
      samples: [
        { sku: 'ASYQU26070214-sameasphoto-l', spu: 'ASYQU26070214', imageUrl: PMS_STYLE_IMAGES.tshirt, qty: 1 },
        { sku: 'ASYQU26070221-sameasphoto-l', spu: 'ASYQU26070221', imageUrl: PMS_STYLE_IMAGES.tshirt, qty: 1 },
      ],
      totalQty: 2,
      status: '待审核',
      auditTrail: [],
      borrowOrderNo: '-',
    },
    {
      id: 'KS2NHZZ9123AA5500002',
      submittedAt: '2026-10-09 09:48:30',
      linkCode: 'c577f6beecdd12c227bf8b22',
      applicantHandle: '@dinda.tryon',
      applicantPlatform: 'TikTok',
      applicantContact: 'dinda.tryon',
      recipientName: 'Dinda Putri',
      recipientAddress: 'Jl. Diponegoro No. 32, Surabaya',
      samples: [
        { sku: 'BTSZIDXX24061313-sameasphoto-s', spu: 'BTSZIDXX24061313', imageUrl: PMS_STYLE_IMAGES.dress, qty: 1 },
      ],
      totalQty: 1,
      status: '已通过',
      auditTrail: [{ reviewer: '六六', reviewedAt: '2026-10-09 10:12:11', remark: '通过,生成借出单' }],
      borrowOrderNo: 'JL2NHRENT0001',
    },
  ],
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
