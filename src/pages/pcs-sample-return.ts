import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  renderFormDialog as uiFormDialog,
  renderDialog as uiDialog,
  renderSecondaryButton,
  renderPrimaryButton,
} from '../components/ui'

// ============ 类型定义 ============

type CaseType = 'RETURN' | 'DISPOSITION'
type CaseStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RETURNING' | 'CONFIRMED' | 'EXECUTING' | 'CLOSED' | 'REJECTED' | 'CANCELLED'
type ReasonCategory = 'QUALITY_FAIL' | 'DAMAGED' | 'MISSING_PARTS' | 'WRONG_SIZE_COLOR' | 'OVERDUE_RETURN' | 'INVENTORY_DIFF' | 'SUPPLIER_ISSUE' | 'OTHER'
type DispositionResult = 'SCRAP' | 'RETAIN' | 'INTERNAL_USE' | 'DONATE' | 'OTHER'
type ResponsibleSite = 'SHENZHEN' | 'JAKARTA'

interface CaseLog {
  id: string
  action: string
  operator: string
  time: string
  comment?: string
}

interface ReturnCase {
  id: string
  case_code: string
  case_type: CaseType
  case_status: CaseStatus
  responsible_site: ResponsibleSite
  sample_id: string
  sample_code: string
  sample_name: string
  inventory_status_snapshot: string
  reason_category: ReasonCategory
  reason_detail: string
  evidence_attachments: string[]
  project_ref: { code: string; name: string } | null
  work_item_ref: { code: string; name: string } | null
  requester: { role: string; name: string }
  handler: { role: string; name: string } | null
  return_target?: string
  return_method?: string
  tracking_no?: string
  disposition_result?: DispositionResult
  disposition_location?: string
  executor?: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  sla_deadline: string
  created_at: string
  updated_at: string
  closed_at?: string
  case_logs: CaseLog[]
}

// ============ 常量 ============

const CASE_TYPE_MAP: Record<CaseType, string> = {
  RETURN: '退货',
  DISPOSITION: '处置',
}

const CASE_STATUS_MAP: Record<CaseStatus, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'bg-gray-100 text-gray-800' },
  SUBMITTED: { label: '已提交', color: 'bg-blue-100 text-blue-800' },
  APPROVED: { label: '已批准', color: 'bg-emerald-100 text-emerald-800' },
  RETURNING: { label: '退货中', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: '已确认', color: 'bg-teal-100 text-teal-800' },
  EXECUTING: { label: '执行中', color: 'bg-amber-100 text-amber-800' },
  CLOSED: { label: '已结案', color: 'bg-gray-100 text-gray-800' },
  REJECTED: { label: '已驳回', color: 'bg-rose-100 text-rose-800' },
  CANCELLED: { label: '已取消', color: 'bg-gray-100 text-gray-500' },
}

const REASON_CATEGORY_MAP: Record<ReasonCategory, string> = {
  QUALITY_FAIL: '质检不合格',
  DAMAGED: '破损',
  MISSING_PARTS: '缺件',
  WRONG_SIZE_COLOR: '错码错色',
  OVERDUE_RETURN: '超期未归还',
  INVENTORY_DIFF: '盘点差异',
  SUPPLIER_ISSUE: '供应商问题',
  OTHER: '其它',
}

const DISPOSITION_RESULT_MAP: Record<DispositionResult, string> = {
  SCRAP: '报废/销毁',
  RETAIN: '留存归档',
  INTERNAL_USE: '转内部使用',
  DONATE: '捐赠',
  OTHER: '其他',
}

const SITE_MAP: Record<ResponsibleSite, string> = {
  SHENZHEN: '深圳',
  JAKARTA: '雅加达',
}

const CASE_TYPE_OPTIONS = [
  { value: 'all', label: '全部类型' },
  { value: 'RETURN', label: '退货' },
  { value: 'DISPOSITION', label: '处置' },
]

const CASE_STATUS_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'DRAFT', label: '草稿' },
  { value: 'SUBMITTED', label: '已提交' },
  { value: 'APPROVED', label: '已批准' },
  { value: 'RETURNING', label: '退货中' },
  { value: 'CONFIRMED', label: '已确认' },
  { value: 'EXECUTING', label: '执行中' },
  { value: 'CLOSED', label: '已结案' },
  { value: 'REJECTED', label: '已驳回' },
  { value: 'CANCELLED', label: '已取消' },
]

const SITE_OPTIONS = [
  { value: 'all', label: '全部站点' },
  { value: 'SHENZHEN', label: '深圳' },
  { value: 'JAKARTA', label: '雅加达' },
]

const REASON_OPTIONS = [
  { value: 'all', label: '全部原因' },
  ...Object.entries(REASON_CATEGORY_MAP).map(([k, v]) => ({ value: k, label: v })),
]

// ============ Mock 数据 ============

const NOW_ISO = '2026-01-16T12:30:30+08:00'

const mockCases: ReturnCase[] = [
  {
    id: 'case_001',
    case_code: 'RC-20260116-001',
    case_type: 'RETURN',
    case_status: 'SUBMITTED',
    responsible_site: 'SHENZHEN',
    sample_id: 'smp_001',
    sample_code: 'SMP-20260110-001',
    sample_name: '印尼风格碎花连衣裙',
    inventory_status_snapshot: '异常-待处理',
    reason_category: 'QUALITY_FAIL',
    reason_detail: '面料起球严重，不符合质检标准',
    evidence_attachments: ['evidence_001.jpg', 'evidence_002.jpg'],
    project_ref: { code: 'PRJ-20260110-001', name: '印尼风格碎花连衣裙' },
    work_item_ref: { code: 'WI-INS-001', name: '样衣质检' },
    requester: { role: '质检员', name: '李明' },
    handler: { role: '仓管', name: '王华' },
    return_target: '东莞服装厂',
    return_method: '快递',
    priority: 'HIGH',
    sla_deadline: '2026-01-18T18:00:00+08:00',
    created_at: '2026-01-16T09:00:00+08:00',
    updated_at: '2026-01-16T10:30:00+08:00',
    case_logs: [
      { id: 'log_001', action: '创建案件', operator: '李明', time: '01-16 09:00', comment: '发起质检不合格退货申请' },
      { id: 'log_002', action: '提交审批', operator: '李明', time: '01-16 09:15' },
    ],
  },
  {
    id: 'case_002',
    case_code: 'RC-20260116-002',
    case_type: 'DISPOSITION',
    case_status: 'APPROVED',
    responsible_site: 'SHENZHEN',
    sample_id: 'smp_002',
    sample_code: 'SMP-20260110-002',
    sample_name: '蓝色波西米亚半裙',
    inventory_status_snapshot: '异常-破损',
    reason_category: 'DAMAGED',
    reason_detail: '拉链损坏无法修复，建议报废处理',
    evidence_attachments: ['evidence_003.jpg'],
    project_ref: { code: 'PRJ-20260108-002', name: '波西米亚系列' },
    work_item_ref: null,
    requester: { role: '仓管', name: '王华' },
    handler: { role: '仓管', name: '王华' },
    disposition_result: 'SCRAP',
    disposition_location: '深圳报废区',
    executor: '王华',
    priority: 'MEDIUM',
    sla_deadline: '2026-01-20T18:00:00+08:00',
    created_at: '2026-01-15T14:00:00+08:00',
    updated_at: '2026-01-16T11:00:00+08:00',
    case_logs: [
      { id: 'log_003', action: '创建案件', operator: '王华', time: '01-15 14:00' },
      { id: 'log_004', action: '提交审批', operator: '王华', time: '01-15 14:30' },
      { id: 'log_005', action: '审批通过', operator: '张经理', time: '01-16 11:00', comment: '同意报废处理' },
    ],
  },
  {
    id: 'case_003',
    case_code: 'RC-20260115-003',
    case_type: 'RETURN',
    case_status: 'RETURNING',
    responsible_site: 'SHENZHEN',
    sample_id: 'smp_003',
    sample_code: 'SMP-20260108-003',
    sample_name: '白色基础T恤',
    inventory_status_snapshot: '在途',
    reason_category: 'WRONG_SIZE_COLOR',
    reason_detail: '实际收到L码，订单为M码',
    evidence_attachments: ['evidence_004.jpg', 'evidence_005.jpg'],
    project_ref: { code: 'PRJ-20260112-003', name: '基础款T恤系列' },
    work_item_ref: { code: 'WI-ACQ-003', name: '样衣获取' },
    requester: { role: '采购', name: '赵敏' },
    handler: { role: '仓管', name: '王华' },
    return_target: '广州针织厂',
    return_method: '快递',
    tracking_no: 'SF1234567890',
    priority: 'MEDIUM',
    sla_deadline: '2026-01-19T18:00:00+08:00',
    created_at: '2026-01-14T10:00:00+08:00',
    updated_at: '2026-01-16T08:00:00+08:00',
    case_logs: [
      { id: 'log_006', action: '创建案件', operator: '赵敏', time: '01-14 10:00' },
      { id: 'log_007', action: '提交审批', operator: '赵敏', time: '01-14 10:30' },
      { id: 'log_008', action: '审批通过', operator: '王华', time: '01-14 14:00' },
      { id: 'log_009', action: '执行退货', operator: '王华', time: '01-15 09:00', comment: '已寄出，运单号SF1234567890' },
    ],
  },
  {
    id: 'case_004',
    case_code: 'RC-20260114-004',
    case_type: 'RETURN',
    case_status: 'CLOSED',
    responsible_site: 'JAKARTA',
    sample_id: 'smp_004',
    sample_code: 'SMP-20260105-004',
    sample_name: '牛仔短裤',
    inventory_status_snapshot: '已退货',
    reason_category: 'SUPPLIER_ISSUE',
    reason_detail: '供应商发错货，需退回更换',
    evidence_attachments: ['evidence_006.jpg'],
    project_ref: { code: 'PRJ-20260105-004', name: '夏季牛仔系列' },
    work_item_ref: null,
    requester: { role: '采购', name: 'Andi' },
    handler: { role: '仓管', name: 'Budi' },
    return_target: 'Jakarta Textile Co.',
    return_method: '自送',
    priority: 'LOW',
    sla_deadline: '2026-01-18T18:00:00+08:00',
    created_at: '2026-01-10T09:00:00+08:00',
    updated_at: '2026-01-14T16:00:00+08:00',
    closed_at: '2026-01-14T16:00:00+08:00',
    case_logs: [
      { id: 'log_010', action: '创建案件', operator: 'Andi', time: '01-10 09:00' },
      { id: 'log_011', action: '提交审批', operator: 'Andi', time: '01-10 09:30' },
      { id: 'log_012', action: '审批通过', operator: 'Budi', time: '01-10 14:00' },
      { id: 'log_013', action: '执行退货', operator: 'Budi', time: '01-12 10:00' },
      { id: 'log_014', action: '确认签收', operator: 'Budi', time: '01-14 14:00', comment: '供应商已签收' },
      { id: 'log_015', action: '结案', operator: 'Budi', time: '01-14 16:00', comment: '写入台账退货事件' },
    ],
  },
  {
    id: 'case_005',
    case_code: 'RC-20260113-005',
    case_type: 'DISPOSITION',
    case_status: 'EXECUTING',
    responsible_site: 'SHENZHEN',
    sample_id: 'smp_005',
    sample_code: 'SMP-20260101-005',
    sample_name: '米色针织开衫',
    inventory_status_snapshot: '待处置',
    reason_category: 'OVERDUE_RETURN',
    reason_detail: '借出超过90天未归还，已联系无果，转内部留存',
    evidence_attachments: [],
    project_ref: { code: 'PRJ-20260101-005', name: '秋冬针织系列' },
    work_item_ref: { code: 'WI-USE-005', name: '样衣使用' },
    requester: { role: '仓管', name: '王华' },
    handler: { role: '仓管', name: '王华' },
    disposition_result: 'INTERNAL_USE',
    disposition_location: '深圳陈列区',
    executor: '王华',
    priority: 'LOW',
    sla_deadline: '2026-01-25T18:00:00+08:00',
    created_at: '2026-01-13T11:00:00+08:00',
    updated_at: '2026-01-16T09:30:00+08:00',
    case_logs: [
      { id: 'log_016', action: '创建案件', operator: '王华', time: '01-13 11:00' },
      { id: 'log_017', action: '提交审批', operator: '王华', time: '01-13 11:30' },
      { id: 'log_018', action: '审批通过', operator: '张经理', time: '01-14 09:00' },
      { id: 'log_019', action: '执行处置', operator: '王华', time: '01-16 09:30', comment: '移至陈列区' },
    ],
  },
  {
    id: 'case_006',
    case_code: 'RC-20260116-006',
    case_type: 'RETURN',
    case_status: 'DRAFT',
    responsible_site: 'SHENZHEN',
    sample_id: 'smp_006',
    sample_code: 'SMP-20260112-006',
    sample_name: '黑色西装外套',
    inventory_status_snapshot: '异常-缺件',
    reason_category: 'MISSING_PARTS',
    reason_detail: '缺少配套纽扣',
    evidence_attachments: ['evidence_007.jpg'],
    project_ref: null,
    work_item_ref: null,
    requester: { role: '质检员', name: '李明' },
    handler: null,
    return_target: '',
    return_method: '',
    priority: 'MEDIUM',
    sla_deadline: '2026-01-20T18:00:00+08:00',
    created_at: '2026-01-16T11:00:00+08:00',
    updated_at: '2026-01-16T11:00:00+08:00',
    case_logs: [{ id: 'log_020', action: '创建案件', operator: '李明', time: '01-16 11:00' }],
  },
  {
    id: 'case_007',
    case_code: 'RC-20260112-007',
    case_type: 'DISPOSITION',
    case_status: 'CLOSED',
    responsible_site: 'SHENZHEN',
    sample_id: 'smp_007',
    sample_code: 'SMP-20251228-007',
    sample_name: '灰色连帽卫衣',
    inventory_status_snapshot: '已处置',
    reason_category: 'INVENTORY_DIFF',
    reason_detail: '盘点发现实物与系统不符，确认报废',
    evidence_attachments: ['evidence_008.jpg', 'evidence_009.jpg'],
    project_ref: { code: 'PRJ-20251228-007', name: '休闲卫衣系列' },
    work_item_ref: null,
    requester: { role: '仓管', name: '王华' },
    handler: { role: '仓管', name: '王华' },
    disposition_result: 'SCRAP',
    disposition_location: '深圳报废区',
    executor: '王华',
    priority: 'LOW',
    sla_deadline: '2026-01-15T18:00:00+08:00',
    created_at: '2026-01-08T10:00:00+08:00',
    updated_at: '2026-01-12T15:00:00+08:00',
    closed_at: '2026-01-12T15:00:00+08:00',
    case_logs: [
      { id: 'log_021', action: '创建案件', operator: '王华', time: '01-08 10:00' },
      { id: 'log_022', action: '提交审批', operator: '王华', time: '01-08 10:30' },
      { id: 'log_023', action: '审批通过', operator: '张经理', time: '01-09 09:00' },
      { id: 'log_024', action: '执行处置', operator: '王华', time: '01-12 10:00' },
      { id: 'log_025', action: '结案', operator: '王华', time: '01-12 15:00', comment: '写入台账处置事件' },
    ],
  },
  {
    id: 'case_008',
    case_code: 'RC-20260115-008',
    case_type: 'RETURN',
    case_status: 'REJECTED',
    responsible_site: 'JAKARTA',
    sample_id: 'smp_008',
    sample_code: 'SMP-20260110-008',
    sample_name: '粉色雪纺上衣',
    inventory_status_snapshot: '在库-可用',
    reason_category: 'OTHER',
    reason_detail: '款式不符合市场需求，申请退回',
    evidence_attachments: [],
    project_ref: { code: 'PRJ-20260110-008', name: '春季雪纺系列' },
    work_item_ref: null,
    requester: { role: '设计师', name: 'Maya' },
    handler: { role: '仓管', name: 'Budi' },
    return_target: 'Surabaya Factory',
    return_method: '快递',
    priority: 'LOW',
    sla_deadline: '2026-01-22T18:00:00+08:00',
    created_at: '2026-01-15T08:00:00+08:00',
    updated_at: '2026-01-15T14:00:00+08:00',
    case_logs: [
      { id: 'log_026', action: '创建案件', operator: 'Maya', time: '01-15 08:00' },
      { id: 'log_027', action: '提交审批', operator: 'Maya', time: '01-15 08:30' },
      { id: 'log_028', action: '驳回', operator: 'Budi', time: '01-15 14:00', comment: '样衣状态正常，不符合退货条件' },
    ],
  },
]

// ============ 状态管理 ============

interface ReturnState {
  search: string
  typeFilter: string
  statusFilter: string
  siteFilter: string
  reasonFilter: string
  selectedCaseId: string | null
  drawerOpen: boolean
  newCaseDialogOpen: boolean
  approveDialogOpen: boolean
  closeDialogOpen: boolean
  currentPage: number
}

let state: ReturnState = {
  search: '',
  typeFilter: 'all',
  statusFilter: 'all',
  siteFilter: 'all',
  reasonFilter: 'all',
  selectedCaseId: null,
  drawerOpen: false,
  newCaseDialogOpen: false,
  approveDialogOpen: false,
  closeDialogOpen: false,
  currentPage: 1,
}

const PAGE_SIZE = 10

// ============ 工具函数 ============

function getFilteredCases(): ReturnCase[] {
  return mockCases.filter((c) => {
    if (state.search) {
      const keyword = state.search.toLowerCase()
      if (
        !c.case_code.toLowerCase().includes(keyword) &&
        !c.sample_code.toLowerCase().includes(keyword) &&
        !c.sample_name.toLowerCase().includes(keyword)
      ) {
        return false
      }
    }
    if (state.typeFilter !== 'all' && c.case_type !== state.typeFilter) return false
    if (state.statusFilter !== 'all' && c.case_status !== state.statusFilter) return false
    if (state.siteFilter !== 'all' && c.responsible_site !== state.siteFilter) return false
    if (state.reasonFilter !== 'all' && c.reason_category !== state.reasonFilter) return false
    return true
  })
}

function getStats() {
  return {
    total: mockCases.length,
    pending: mockCases.filter((c) => c.case_status === 'SUBMITTED').length,
    processing: mockCases.filter((c) => ['APPROVED', 'RETURNING', 'EXECUTING'].includes(c.case_status)).length,
    closed: mockCases.filter((c) => c.case_status === 'CLOSED').length,
    overdue: mockCases.filter(
      (c) => new Date(c.sla_deadline) < new Date(NOW_ISO) && !['CLOSED', 'CANCELLED', 'REJECTED'].includes(c.case_status),
    ).length,
  }
}

function getSelectedCase(): ReturnCase | null {
  if (!state.selectedCaseId) return null
  return mockCases.find((c) => c.id === state.selectedCaseId) || null
}

function isOverdue(c: ReturnCase): boolean {
  return new Date(c.sla_deadline) < new Date(NOW_ISO) && !['CLOSED', 'CANCELLED', 'REJECTED'].includes(c.case_status)
}

function formatDate(isoString: string): string {
  const d = new Date(isoString)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}-${day}`
}

function formatFullDate(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleString('zh-CN')
}

function getAvailableActions(c: ReturnCase): string[] {
  const actions: string[] = []
  switch (c.case_status) {
    case 'DRAFT':
      actions.push('submit', 'cancel')
      break
    case 'SUBMITTED':
      actions.push('approve', 'reject', 'withdraw')
      break
    case 'APPROVED':
      actions.push('execute')
      break
    case 'RETURNING':
      actions.push('confirm')
      break
    case 'CONFIRMED':
    case 'EXECUTING':
      actions.push('close')
      break
  }
  return actions
}

// ============ 渲染函数 ============

function renderKpiCard(label: string, value: number, icon: string, colorClass: string, bgClass: string, action: string, filterValue?: string) {
  const isActive = action === 'filter-status' && state.statusFilter === filterValue
  return `
    <button class="rounded-lg border p-3 text-left transition hover:border-blue-300 ${bgClass} ${isActive ? 'border-blue-300' : ''}" data-return-action="${action}" ${filterValue ? `data-filter-value="${filterValue}"` : ''}>
      <div class="text-xs ${colorClass} flex items-center gap-1">
        <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
        ${escapeHtml(label)}
      </div>
      <div class="text-xl font-semibold mt-1 ${colorClass}">${value}</div>
    </button>
  `
}

function renderCaseRow(c: ReturnCase): string {
  const statusInfo = CASE_STATUS_MAP[c.case_status]
  const typeColor = c.case_type === 'RETURN' ? 'border-blue-400 text-blue-700' : 'border-purple-400 text-purple-700'
  const overdueFlag = isOverdue(c)

  return `
    <tr class="border-b last:border-b-0 hover:bg-muted/40 cursor-pointer ${overdueFlag ? 'bg-rose-50' : ''}" data-return-action="view-detail" data-case-id="${c.id}">
      <td class="px-3 py-2 align-top">
        <span class="text-sm font-medium text-blue-700">${escapeHtml(c.case_code)}</span>
      </td>
      <td class="px-3 py-2 align-top">
        <span class="inline-flex rounded-full border px-2 py-0.5 text-xs ${typeColor}">${CASE_TYPE_MAP[c.case_type]}</span>
      </td>
      <td class="px-3 py-2 align-top">
        <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${statusInfo.color}">${statusInfo.label}</span>
      </td>
      <td class="px-3 py-2 align-top text-xs">${SITE_MAP[c.responsible_site]}</td>
      <td class="px-3 py-2 align-top">
        <div class="text-xs font-medium">${escapeHtml(c.sample_code)}</div>
        <div class="text-xs text-muted-foreground truncate max-w-[120px]">${escapeHtml(c.sample_name)}</div>
      </td>
      <td class="px-3 py-2 align-top">
        <span class="inline-flex rounded-full border px-2 py-0.5 text-xs">${escapeHtml(c.inventory_status_snapshot)}</span>
      </td>
      <td class="px-3 py-2 align-top text-xs">${REASON_CATEGORY_MAP[c.reason_category]}</td>
      <td class="px-3 py-2 align-top">
        ${c.project_ref ? `<div class="text-xs truncate max-w-[100px]">${escapeHtml(c.project_ref.name)}</div>` : '<span class="text-muted-foreground text-xs">-</span>'}
      </td>
      <td class="px-3 py-2 align-top">
        <div class="text-xs">${escapeHtml(c.requester.role)}</div>
        <div class="text-xs text-muted-foreground">${escapeHtml(c.requester.name)}</div>
      </td>
      <td class="px-3 py-2 align-top">
        ${c.handler ? `<div class="text-xs">${escapeHtml(c.handler.role)}</div><div class="text-xs text-muted-foreground">${escapeHtml(c.handler.name)}</div>` : '<span class="text-muted-foreground text-xs">待受理</span>'}
      </td>
      <td class="px-3 py-2 align-top text-xs text-muted-foreground">${formatDate(c.updated_at)}</td>
      <td class="px-3 py-2 align-top">
        ${overdueFlag ? '<span class="inline-flex rounded-full px-2 py-0.5 text-xs bg-rose-100 text-rose-800">超期</span>' : ''}
      </td>
      <td class="px-3 py-2 align-top">
        <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-return-action="view-detail" data-case-id="${c.id}">查看</button>
      </td>
    </tr>
  `
}

function renderDetailDrawer(): string {
  if (!state.drawerOpen) return ''
  const c = getSelectedCase()
  if (!c) return ''

  const statusInfo = CASE_STATUS_MAP[c.case_status]
  const actions = getAvailableActions(c)

  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-return-action="close-drawer" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full border-l bg-background shadow-2xl sm:max-w-[480px] overflow-y-auto">
        <header class="sticky top-0 z-10 border-b bg-background px-4 py-3">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-base font-semibold">${CASE_TYPE_MAP[c.case_type]} · ${escapeHtml(c.case_code)}</h3>
              <div class="flex items-center gap-2 mt-2">
                <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${statusInfo.color}">${statusInfo.label}</span>
                <span class="inline-flex rounded-full border px-2 py-0.5 text-xs">${SITE_MAP[c.responsible_site]}</span>
                <span class="inline-flex rounded-full border px-2 py-0.5 text-xs">${escapeHtml(c.inventory_status_snapshot)}</span>
              </div>
            </div>
            <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-return-action="close-drawer" aria-label="关闭">
              <i data-lucide="x" class="h-4 w-4"></i>
            </button>
          </div>
          <div class="flex flex-wrap gap-2 mt-3">
            ${actions.includes('submit') ? `<button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-return-action="submit-case">提交审批</button>` : ''}
            ${actions.includes('withdraw') ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-return-action="withdraw-case">撤回</button>` : ''}
            ${actions.includes('approve') ? `<button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-return-action="open-approve-dialog">审批</button>` : ''}
            ${actions.includes('execute') ? `<button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-return-action="execute-case">${c.case_type === 'RETURN' ? '执行退货' : '执行处置'}</button>` : ''}
            ${actions.includes('confirm') ? `<button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-return-action="confirm-case">确认签收</button>` : ''}
            ${actions.includes('close') ? `<button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-return-action="open-close-dialog">结案</button>` : ''}
            ${actions.includes('cancel') ? `<button class="inline-flex h-8 items-center rounded-md border border-rose-300 px-3 text-xs text-rose-700 hover:bg-rose-50" data-return-action="cancel-case">取消</button>` : ''}
            <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-return-action="open-inventory">
              <i data-lucide="package" class="mr-1 h-3.5 w-3.5"></i>打开库存
            </button>
            <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-return-action="open-ledger">
              <i data-lucide="file-text" class="mr-1 h-3.5 w-3.5"></i>打开台账
            </button>
          </div>
        </header>

        <div class="p-4 space-y-6">
          <!-- A. 案件概览 -->
          <div>
            <h4 class="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground">A. 案件概览</h4>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div><span class="text-muted-foreground">案件类型: </span>${CASE_TYPE_MAP[c.case_type]}</div>
              <div><span class="text-muted-foreground">责任站点: </span>${SITE_MAP[c.responsible_site]}</div>
              <div><span class="text-muted-foreground">发起人: </span>${escapeHtml(c.requester.role)} - ${escapeHtml(c.requester.name)}</div>
              <div><span class="text-muted-foreground">发起时间: </span>${formatFullDate(c.created_at)}</div>
              <div><span class="text-muted-foreground">受理人: </span>${c.handler ? `${escapeHtml(c.handler.role)} - ${escapeHtml(c.handler.name)}` : '待受理'}</div>
              <div>
                <span class="text-muted-foreground">优先级: </span>
                <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${c.priority === 'HIGH' ? 'bg-rose-100 text-rose-800' : c.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'}">${c.priority === 'HIGH' ? '高' : c.priority === 'MEDIUM' ? '中' : '低'}</span>
              </div>
              ${c.project_ref ? `<div class="col-span-2"><span class="text-muted-foreground">关联项目: </span><button class="text-blue-700 hover:underline">${escapeHtml(c.project_ref.code)} - ${escapeHtml(c.project_ref.name)}</button></div>` : ''}
              ${c.work_item_ref ? `<div class="col-span-2"><span class="text-muted-foreground">关联工作项: </span><button class="text-blue-700 hover:underline">${escapeHtml(c.work_item_ref.code)} - ${escapeHtml(c.work_item_ref.name)}</button></div>` : ''}
              <div class="col-span-2"><span class="text-muted-foreground">SLA到期: </span><span class="${isOverdue(c) ? 'text-rose-600 font-medium' : ''}">${formatFullDate(c.sla_deadline)}</span></div>
            </div>
          </div>

          <div class="border-t pt-4"></div>

          <!-- B. 样衣信息 -->
          <div>
            <h4 class="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground">B. 样衣信息（只读快照）</h4>
            <div class="bg-muted/50 rounded-lg p-4">
              <div class="grid grid-cols-2 gap-2 text-sm">
                <div><span class="text-muted-foreground">样衣编号: </span><span class="font-medium">${escapeHtml(c.sample_code)}</span></div>
                <div><span class="text-muted-foreground">样衣名称: </span>${escapeHtml(c.sample_name)}</div>
                <div><span class="text-muted-foreground">当前状态: </span><span class="inline-flex rounded-full border px-2 py-0.5 text-xs">${escapeHtml(c.inventory_status_snapshot)}</span></div>
                <div><span class="text-muted-foreground">责任站点: </span>${SITE_MAP[c.responsible_site]}</div>
              </div>
            </div>
          </div>

          <div class="border-t pt-4"></div>

          <!-- C. 原因与证据 -->
          <div>
            <h4 class="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground">C. 原因与证据</h4>
            <div class="space-y-2 text-sm">
              <div><span class="text-muted-foreground">原因大类: </span><span class="inline-flex rounded-full border px-2 py-0.5 text-xs">${REASON_CATEGORY_MAP[c.reason_category]}</span></div>
              <div>
                <span class="text-muted-foreground">原因详情: </span>
                <p class="mt-1 p-3 bg-muted/50 rounded">${escapeHtml(c.reason_detail)}</p>
              </div>
              <div>
                <span class="text-muted-foreground">证据附件: </span>
                ${c.evidence_attachments.length > 0 ? `<div class="flex flex-wrap gap-2 mt-1">${c.evidence_attachments.map((f) => `<span class="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs">${escapeHtml(f)}</span>`).join('')}</div>` : '<span class="text-muted-foreground ml-1">暂无</span>'}
              </div>
            </div>
          </div>

          <div class="border-t pt-4"></div>

          <!-- D. 处理方案 -->
          <div>
            <h4 class="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground">D. 处理方案</h4>
            ${
              c.case_type === 'RETURN'
                ? `<div class="grid grid-cols-2 gap-3 text-sm p-4 bg-blue-50 rounded-lg">
                <div><span class="text-muted-foreground">退货对象: </span>${escapeHtml(c.return_target || '-')}</div>
                <div><span class="text-muted-foreground">退货方式: </span>${escapeHtml(c.return_method || '-')}</div>
                ${c.tracking_no ? `<div class="col-span-2"><span class="text-muted-foreground">运单号: </span><span class="text-blue-700 font-medium">${escapeHtml(c.tracking_no)}</span></div>` : ''}
              </div>`
                : `<div class="grid grid-cols-2 gap-3 text-sm p-4 bg-purple-50 rounded-lg">
                <div><span class="text-muted-foreground">处置结果: </span>${c.disposition_result ? DISPOSITION_RESULT_MAP[c.disposition_result] : '-'}</div>
                <div><span class="text-muted-foreground">处置地点: </span>${escapeHtml(c.disposition_location || '-')}</div>
                <div><span class="text-muted-foreground">执行人: </span>${escapeHtml(c.executor || '-')}</div>
              </div>`
            }
          </div>

          <div class="border-t pt-4"></div>

          <!-- E. 审批与案件日志 -->
          <div>
            <h4 class="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground">E. 审批与案件日志</h4>
            <div class="space-y-3">
              ${c.case_logs
                .map(
                  (log, idx) => `
                <div class="flex gap-3">
                  <div class="flex flex-col items-center">
                    <div class="w-2 h-2 rounded-full ${idx === c.case_logs.length - 1 ? 'bg-blue-500' : 'bg-gray-300'}"></div>
                    ${idx < c.case_logs.length - 1 ? '<div class="w-0.5 flex-1 bg-gray-200"></div>' : ''}
                  </div>
                  <div class="flex-1 pb-3">
                    <div class="flex items-center gap-2 text-sm">
                      <span class="font-medium">${escapeHtml(log.action)}</span>
                      <span class="text-xs text-muted-foreground">${escapeHtml(log.operator)}</span>
                      <span class="text-xs text-muted-foreground">${escapeHtml(log.time)}</span>
                    </div>
                    ${log.comment ? `<p class="text-xs text-muted-foreground mt-1">${escapeHtml(log.comment)}</p>` : ''}
                  </div>
                </div>
              `,
                )
                .join('')}
            </div>
          </div>

          ${
            c.case_status === 'CLOSED' && c.closed_at
              ? `
            <div class="border-t pt-4"></div>
            <div>
              <h4 class="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground">F. 结案信息</h4>
              <div class="p-4 bg-emerald-50 rounded-lg text-sm space-y-2">
                <div><span class="text-muted-foreground">结案时间: </span>${formatFullDate(c.closed_at)}</div>
                <div><span class="text-muted-foreground">落账回执: </span><span class="text-emerald-700 font-medium">已写入台账${c.case_type === 'RETURN' ? '退货' : '处置'}事件</span></div>
                <div><span class="text-muted-foreground">库存状态更新: </span><span class="inline-flex rounded-full px-2 py-0.5 text-xs bg-emerald-100 text-emerald-800">${escapeHtml(c.inventory_status_snapshot)}</span></div>
              </div>
            </div>
          `
              : ''
          }
        </div>
      </section>
    </div>
  `
}

function renderReturnNewCaseDialog(): string {
  if (!state.newCaseDialogOpen) return ''

  const formContent = `
    <div class="space-y-4">
      <div>
        <label class="block text-sm mb-1">案件类型</label>
        <select class="h-9 w-full rounded-md border bg-background px-3 text-sm">
          <option value="RETURN">退货</option>
          <option value="DISPOSITION">处置</option>
        </select>
      </div>
      <div>
        <label class="block text-sm mb-1">关联样衣</label>
        <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="输入样衣编号或选择" />
      </div>
      <div>
        <label class="block text-sm mb-1">原因分类</label>
        <select class="h-9 w-full rounded-md border bg-background px-3 text-sm">
          ${Object.entries(REASON_CATEGORY_MAP).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="block text-sm mb-1">原因详情</label>
        <textarea class="w-full rounded-md border bg-background px-3 py-2 text-sm" rows="3" placeholder="请描述详细原因..."></textarea>
      </div>
      <div>
        <label class="block text-sm mb-1">证据附件</label>
        <button class="inline-flex h-9 w-full items-center justify-center rounded-md border px-3 text-sm hover:bg-muted">
          <i data-lucide="upload" class="mr-2 h-4 w-4"></i>上传附件
        </button>
      </div>
    </div>
  `

  return uiFormDialog(
    {
      title: '新建退货与处理案件',
      description: '请填写案件基本信息',
      closeAction: { prefix: 'return', action: 'close-new-case-dialog' },
      width: 'md',
      submitAction: { prefix: 'return', action: 'create-case', label: '创建' },
      cancelLabel: '取消',
    },
    formContent
  )
}

function renderReturnApproveDialog(): string {
  if (!state.approveDialogOpen) return ''
  const c = getSelectedCase()
  if (!c) return ''

  const formContent = `
    <div class="space-y-4">
      <div>
        <label class="block text-sm mb-1">审批意见</label>
        <textarea class="w-full rounded-md border bg-background px-3 py-2 text-sm" rows="3" placeholder="请输入审批意见..."></textarea>
      </div>
    </div>
  `

  const footer = `
    ${renderSecondaryButton('取消', { prefix: 'return', action: 'close-approve-dialog' })}
    <button class="inline-flex h-9 items-center rounded-md border border-rose-300 px-4 text-sm text-rose-700 hover:bg-rose-50" data-return-action="reject-case">
      <i data-lucide="x-circle" class="mr-1 h-4 w-4"></i>驳回
    </button>
    ${renderPrimaryButton('通过', { prefix: 'return', action: 'approve-case' })}
  `

  return uiDialog(
    {
      title: '审批案件',
      description: `请审批案件 ${escapeHtml(c.case_code)}`,
      closeAction: { prefix: 'return', action: 'close-approve-dialog' },
      width: 'sm',
    },
    formContent,
    footer
  )
}

function renderReturnCloseDialog(): string {
  if (!state.closeDialogOpen) return ''
  const c = getSelectedCase()
  if (!c) return ''

  const formContent = `
    <div class="space-y-4">
      <div>
        <label class="block text-sm mb-1">结案备注</label>
        <textarea class="w-full rounded-md border bg-background px-3 py-2 text-sm" rows="3" placeholder="请输入结案备注..."></textarea>
      </div>
    </div>
  `

  return uiFormDialog(
    {
      title: '结案确认',
      description: `结案后将写入台账${c.case_type === 'RETURN' ? '退货' : '处置'}事件，此操作不可撤销`,
      closeAction: { prefix: 'return', action: 'close-close-dialog' },
      width: 'sm',
      submitAction: { prefix: 'return', action: 'confirm-close-case', label: '确认结案' },
      cancelLabel: '取消',
    },
    formContent
  )
}

function renderPage(): string {
  const filtered = getFilteredCases()
  const stats = getStats()
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1
  const paginated = filtered.slice((state.currentPage - 1) * PAGE_SIZE, state.currentPage * PAGE_SIZE)

  return `
    <div class="space-y-4">
      <!-- Header -->
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">样衣退货与处理</h1>
          <p class="mt-1 text-sm text-muted-foreground">管理样衣退货和处置案件的完整流程</p>
        </div>
        <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-return-action="open-new-case-dialog">
          <i data-lucide="plus" class="mr-1 h-4 w-4"></i>新建案件
        </button>
      </header>

      <!-- KPI Cards -->
      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        ${renderKpiCard('全部案件', stats.total, 'layers', 'text-gray-700', 'bg-card', 'filter-status', 'all')}
        ${renderKpiCard('待审批', stats.pending, 'clock', 'text-blue-700', 'bg-card', 'filter-status', 'SUBMITTED')}
        ${renderKpiCard('处理中', stats.processing, 'arrow-right', 'text-amber-700', 'bg-card', 'filter-status', 'APPROVED')}
        ${renderKpiCard('已结案', stats.closed, 'check-circle', 'text-emerald-700', 'bg-card', 'filter-status', 'CLOSED')}
        ${renderKpiCard('超期未处理', stats.overdue, 'alert-triangle', 'text-rose-700', 'bg-rose-50 border-rose-200', 'filter-overdue')}
      </section>

      <!-- Filter Bar -->
      <section class="rounded-lg border bg-card p-4">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div class="xl:col-span-2">
            <label class="mb-1 block text-xs text-muted-foreground">关键词</label>
            <div class="relative">
              <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
              <input
                class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
                placeholder="案件编号/样衣编号/名称"
                value="${escapeHtml(state.search)}"
                data-return-field="search"
              />
            </div>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">案件类型</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-return-field="typeFilter">
              ${CASE_TYPE_OPTIONS.map((o) => `<option value="${o.value}" ${state.typeFilter === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">案件状态</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-return-field="statusFilter">
              ${CASE_STATUS_OPTIONS.map((o) => `<option value="${o.value}" ${state.statusFilter === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">责任站点</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-return-field="siteFilter">
              ${SITE_OPTIONS.map((o) => `<option value="${o.value}" ${state.siteFilter === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs text-muted-foreground">原因分类</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-return-field="reasonFilter">
              ${REASON_OPTIONS.map((o) => `<option value="${o.value}" ${state.reasonFilter === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="mt-3 flex justify-end gap-2">
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-return-action="reset-filters">
            <i data-lucide="rotate-ccw" class="mr-1 h-3.5 w-3.5"></i>重置
          </button>
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-return-action="export">
            <i data-lucide="download" class="mr-1 h-3.5 w-3.5"></i>导出
          </button>
        </div>
      </section>

      <!-- Table -->
      <section class="overflow-hidden rounded-lg border bg-card">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1400px] text-sm">
            <thead>
              <tr class="border-b bg-muted/30 text-left text-muted-foreground">
                <th class="px-3 py-2 font-medium">案件编号</th>
                <th class="px-3 py-2 font-medium">类型</th>
                <th class="px-3 py-2 font-medium">状态</th>
                <th class="px-3 py-2 font-medium">责任站点</th>
                <th class="px-3 py-2 font-medium">样衣</th>
                <th class="px-3 py-2 font-medium">样衣状态</th>
                <th class="px-3 py-2 font-medium">原因</th>
                <th class="px-3 py-2 font-medium">关联项目</th>
                <th class="px-3 py-2 font-medium">发起人</th>
                <th class="px-3 py-2 font-medium">受理人</th>
                <th class="px-3 py-2 font-medium">更新时间</th>
                <th class="px-3 py-2 font-medium">风险</th>
                <th class="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${
                paginated.length > 0
                  ? paginated.map(renderCaseRow).join('')
                  : '<tr><td colspan="13" class="px-4 py-12 text-center text-muted-foreground"><i data-lucide="file-x" class="mx-auto h-10 w-10 text-muted-foreground/60"></i><p class="mt-2">暂无符合条件的案件</p></td></tr>'
              }
            </tbody>
          </table>
        </div>
        <footer class="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-3">
          <p class="text-xs text-muted-foreground">共 ${filtered.length} 条</p>
          <div class="flex flex-wrap items-center gap-2">
            <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted ${state.currentPage === 1 ? 'cursor-not-allowed opacity-60' : ''}" ${state.currentPage === 1 ? 'disabled' : ''} data-return-action="prev-page">上一页</button>
            <span class="text-xs text-muted-foreground">${state.currentPage} / ${totalPages}</span>
            <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted ${state.currentPage >= totalPages ? 'cursor-not-allowed opacity-60' : ''}" ${state.currentPage >= totalPages ? 'disabled' : ''} data-return-action="next-page">下一页</button>
          </div>
        </footer>
      </section>
    </div>

    ${renderDetailDrawer()}
    ${renderReturnNewCaseDialog()}
    ${renderReturnApproveDialog()}
    ${renderReturnCloseDialog()}
  `
}

// ============ 事件处理 ============

export function handleSampleReturnEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-return-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.returnField
    if (field === 'search' && fieldNode instanceof HTMLInputElement) {
      state.search = fieldNode.value
      state.currentPage = 1
      return true
    }
    if (field === 'typeFilter' && fieldNode instanceof HTMLSelectElement) {
      state.typeFilter = fieldNode.value
      state.currentPage = 1
      return true
    }
    if (field === 'statusFilter' && fieldNode instanceof HTMLSelectElement) {
      state.statusFilter = fieldNode.value
      state.currentPage = 1
      return true
    }
    if (field === 'siteFilter' && fieldNode instanceof HTMLSelectElement) {
      state.siteFilter = fieldNode.value
      state.currentPage = 1
      return true
    }
    if (field === 'reasonFilter' && fieldNode instanceof HTMLSelectElement) {
      state.reasonFilter = fieldNode.value
      state.currentPage = 1
      return true
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-return-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.returnAction
  if (!action) return false

  if (action === 'reset-filters') {
    state.search = ''
    state.typeFilter = 'all'
    state.statusFilter = 'all'
    state.siteFilter = 'all'
    state.reasonFilter = 'all'
    state.currentPage = 1
    return true
  }

  if (action === 'filter-status') {
    const value = actionNode.dataset.filterValue
    if (value) {
      state.statusFilter = value
      state.currentPage = 1
    }
    return true
  }

  if (action === 'filter-overdue') {
    console.log('Filter overdue')
    return true
  }

  if (action === 'view-detail') {
    const caseId = actionNode.dataset.caseId
    if (caseId) {
      state.selectedCaseId = caseId
      state.drawerOpen = true
    }
    return true
  }

  if (action === 'close-drawer') {
    state.drawerOpen = false
    return true
  }

  if (action === 'open-new-case-dialog') {
    state.newCaseDialogOpen = true
    return true
  }

  if (action === 'close-new-case-dialog') {
    state.newCaseDialogOpen = false
    return true
  }

  if (action === 'create-case') {
    console.log('Create case')
    state.newCaseDialogOpen = false
    return true
  }

  if (action === 'open-approve-dialog') {
    state.approveDialogOpen = true
    return true
  }

  if (action === 'close-approve-dialog') {
    state.approveDialogOpen = false
    return true
  }

  if (action === 'approve-case' || action === 'reject-case') {
    console.log(action === 'approve-case' ? 'Approve case' : 'Reject case')
    state.approveDialogOpen = false
    state.drawerOpen = false
    return true
  }

  if (action === 'open-close-dialog') {
    state.closeDialogOpen = true
    return true
  }

  if (action === 'close-close-dialog') {
    state.closeDialogOpen = false
    return true
  }

  if (action === 'confirm-close-case') {
    console.log('Close case')
    state.closeDialogOpen = false
    state.drawerOpen = false
    return true
  }

  if (action === 'submit-case' || action === 'withdraw-case' || action === 'execute-case' || action === 'confirm-case' || action === 'cancel-case') {
    console.log('Case action:', action)
    state.drawerOpen = false
    return true
  }

  if (action === 'prev-page') {
    if (state.currentPage > 1) state.currentPage--
    return true
  }

  if (action === 'next-page') {
    const totalPages = Math.ceil(getFilteredCases().length / PAGE_SIZE) || 1
    if (state.currentPage < totalPages) state.currentPage++
    return true
  }

  if (action === 'export') {
    console.log('Export')
    return true
  }

  if (action === 'open-inventory') {
    appStore.navigate('/pcs/samples/inventory')
    return true
  }

  if (action === 'open-ledger') {
    appStore.navigate('/pcs/samples/ledger')
    return true
  }

  return false
}

export function isSampleReturnDialogOpen(): boolean {
  return state.drawerOpen || state.newCaseDialogOpen || state.approveDialogOpen || state.closeDialogOpen
}

export function renderSampleReturnPage(): string {
  return renderPage()
}
