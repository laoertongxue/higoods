import { escapeHtml } from '../utils'
import {
  renderDrawer as uiDrawer,
  renderConfirmDialog as uiConfirmDialog,
  renderFormDialog as uiFormDialog,
  renderSecondaryButton,
} from '../components/ui'

// ============ 常量定义 ============

type RequestStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'ACTIVE' | 'RETURNING' | 'COMPLETED'

const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'bg-gray-100 text-gray-700' },
  SUBMITTED: { label: '待审批', color: 'bg-yellow-100 text-yellow-700' },
  APPROVED: { label: '已批准', color: 'bg-blue-100 text-blue-700' },
  REJECTED: { label: '已驳回', color: 'bg-red-100 text-red-700' },
  CANCELLED: { label: '已取消', color: 'bg-gray-100 text-gray-500' },
  ACTIVE: { label: '使用中', color: 'bg-green-100 text-green-700' },
  RETURNING: { label: '归还中', color: 'bg-purple-100 text-purple-700' },
  COMPLETED: { label: '已完成', color: 'bg-emerald-100 text-emerald-700' },
}

const SCENARIOS = ['直播测款', '短视频测款', '版房制版', '工厂打样', '外协加工', '主播家播', '拍摄', '其他']
const PICKUP_METHODS = ['仓库自取', '仓管交接', '快递寄送']
const SITES = ['深圳', '雅加达']

// ============ Mock 数据 ============

const PROJECTS = [
  { id: 'prj_001', code: 'PRJ-20260115-001', name: '印尼风格碎花连衣裙' },
  { id: 'prj_002', code: 'PRJ-20260115-002', name: '波西米亚风半身裙' },
  { id: 'prj_003', code: 'PRJ-20260115-003', name: '基础款白色T恤' },
  { id: 'prj_004', code: 'PRJ-20260115-004', name: '夏季牛仔短裤' },
]

const WORK_ITEMS = [
  { id: 'wi_001', code: 'WI-001-001', name: '直播测款-场次1', projectId: 'prj_001' },
  { id: 'wi_002', code: 'WI-001-002', name: '短视频测款-批次A', projectId: 'prj_001' },
  { id: 'wi_003', code: 'WI-002-001', name: '样衣拍摄', projectId: 'prj_002' },
  { id: 'wi_004', code: 'WI-003-001', name: '版房打版', projectId: 'prj_003' },
]

const SAMPLES = [
  { id: 'smp_001', code: 'SMP-20260101-001', name: '红色碎花连衣裙-M', site: '深圳', status: '在库', availability: '可用', location: 'A-01-01' },
  { id: 'smp_002', code: 'SMP-20260101-002', name: '蓝色波西米亚半身裙-S', site: '深圳', status: '在库', availability: '可用', location: 'A-01-02' },
  { id: 'smp_003', code: 'SMP-20260102-001', name: '白色基础T恤-L', site: '深圳', status: '预占', availability: '不可用', unavailableReason: '已被申请单UR-001预占', location: 'A-02-01' },
  { id: 'smp_004', code: 'SMP-20260103-001', name: '牛仔短裤-M', site: '雅加达', status: '在库', availability: '可用', location: 'B-01-01' },
  { id: 'smp_005', code: 'SMP-20260104-001', name: '米色开衫-M', site: '深圳', status: '借出', availability: '不可用', unavailableReason: '已借出使用中', location: 'A-03-01' },
  { id: 'smp_006', code: 'SMP-20260105-001', name: '黑色西装外套-L', site: '雅加达', status: '在库', availability: '可用', location: 'B-02-01' },
  { id: 'smp_007', code: 'SMP-20260106-001', name: '灰色卫衣-XL', site: '深圳', status: '在库', availability: '可用', location: 'A-04-01' },
  { id: 'smp_008', code: 'SMP-20260107-001', name: '粉色雪纺衫-S', site: '深圳', status: '在库', availability: '可用', location: 'A-05-01' },
]

interface UseRequest {
  id: string
  code: string
  status: RequestStatus
  responsibleSite: string
  sampleCount: number
  sampleIds: string[]
  expectedReturnAt: string
  projectId: string
  projectCode: string
  projectName: string
  workItemId: string
  workItemCode: string
  workItemName: string
  requesterId: string
  requesterName: string
  requesterRole: string
  approverId?: string
  approverName?: string
  scenario: string
  pickupMethod: string
  custodianType: 'internal' | 'external'
  custodianName: string
  remark?: string
  createdAt: string
  updatedAt: string
  submittedAt?: string
  approvedAt?: string
  checkoutAt?: string
  returnRequestedAt?: string
  completedAt?: string
  logs: { time: string; action: string; operator: string; remark?: string }[]
}

const mockRequests: UseRequest[] = [
  {
    id: 'ur_001', code: 'UR-20260116-001', status: 'ACTIVE', responsibleSite: '深圳',
    sampleCount: 2, sampleIds: ['smp_001', 'smp_002'], expectedReturnAt: '2026-01-20 18:00',
    projectId: 'prj_001', projectCode: 'PRJ-20260115-001', projectName: '印尼风格碎花连衣裙',
    workItemId: 'wi_001', workItemCode: 'WI-001-001', workItemName: '直播测款-场次1',
    requesterId: 'user_001', requesterName: '张丽', requesterRole: '测款运营',
    approverId: 'user_wh_001', approverName: '李仓管',
    scenario: '直播测款', pickupMethod: '仓管交接', custodianType: 'internal', custodianName: '张丽',
    createdAt: '2026-01-15 09:00', updatedAt: '2026-01-16 10:30', submittedAt: '2026-01-15 09:30',
    approvedAt: '2026-01-15 14:00', checkoutAt: '2026-01-16 10:30',
    logs: [
      { time: '2026-01-16 10:30', action: '确认领用', operator: '李仓管', remark: '已完成交接' },
      { time: '2026-01-15 14:00', action: '审批通过', operator: '李仓管' },
      { time: '2026-01-15 09:30', action: '提交申请', operator: '张丽' },
      { time: '2026-01-15 09:00', action: '创建草稿', operator: '张丽' },
    ],
  },
  {
    id: 'ur_002', code: 'UR-20260116-002', status: 'SUBMITTED', responsibleSite: '深圳',
    sampleCount: 1, sampleIds: ['smp_007'], expectedReturnAt: '2026-01-22 18:00',
    projectId: 'prj_002', projectCode: 'PRJ-20260115-002', projectName: '波西米亚风半身裙',
    workItemId: 'wi_003', workItemCode: 'WI-002-001', workItemName: '样衣拍摄',
    requesterId: 'user_002', requesterName: '王芳', requesterRole: '内容运营',
    scenario: '拍摄', pickupMethod: '仓库自取', custodianType: 'internal', custodianName: '王芳',
    createdAt: '2026-01-16 08:00', updatedAt: '2026-01-16 08:30', submittedAt: '2026-01-16 08:30',
    logs: [
      { time: '2026-01-16 08:30', action: '提交申请', operator: '王芳' },
      { time: '2026-01-16 08:00', action: '创建草稿', operator: '王芳' },
    ],
  },
  {
    id: 'ur_003', code: 'UR-20260116-003', status: 'APPROVED', responsibleSite: '深圳',
    sampleCount: 1, sampleIds: ['smp_008'], expectedReturnAt: '2026-01-25 18:00',
    projectId: 'prj_001', projectCode: 'PRJ-20260115-001', projectName: '印尼风格碎花连衣裙',
    workItemId: 'wi_002', workItemCode: 'WI-001-002', workItemName: '短视频测款-批次A',
    requesterId: 'user_003', requesterName: '陈明', requesterRole: '短视频运营',
    approverId: 'user_wh_001', approverName: '李仓管',
    scenario: '短视频测款', pickupMethod: '仓管交接', custodianType: 'internal', custodianName: '陈明',
    createdAt: '2026-01-15 14:00', updatedAt: '2026-01-16 09:00', submittedAt: '2026-01-15 14:30', approvedAt: '2026-01-16 09:00',
    logs: [
      { time: '2026-01-16 09:00', action: '审批通过', operator: '李仓管' },
      { time: '2026-01-15 14:30', action: '提交申请', operator: '陈明' },
      { time: '2026-01-15 14:00', action: '创建草稿', operator: '陈明' },
    ],
  },
  {
    id: 'ur_004', code: 'UR-20260115-001', status: 'RETURNING', responsibleSite: '深圳',
    sampleCount: 1, sampleIds: ['smp_005'], expectedReturnAt: '2026-01-16 18:00',
    projectId: 'prj_003', projectCode: 'PRJ-20260115-003', projectName: '基础款白色T恤',
    workItemId: 'wi_004', workItemCode: 'WI-003-001', workItemName: '版房打版',
    requesterId: 'user_004', requesterName: '赵强', requesterRole: '版房主管',
    approverId: 'user_wh_001', approverName: '李仓管',
    scenario: '版房制版', pickupMethod: '仓库自取', custodianType: 'internal', custodianName: '赵强',
    createdAt: '2026-01-10 10:00', updatedAt: '2026-01-16 11:00', submittedAt: '2026-01-10 10:30',
    approvedAt: '2026-01-10 14:00', checkoutAt: '2026-01-10 16:00', returnRequestedAt: '2026-01-16 11:00',
    logs: [
      { time: '2026-01-16 11:00', action: '发起归还', operator: '赵强', remark: '样衣已打包准备归还' },
      { time: '2026-01-10 16:00', action: '确认领用', operator: '李仓管' },
      { time: '2026-01-10 14:00', action: '审批通过', operator: '李仓管' },
      { time: '2026-01-10 10:30', action: '提交申请', operator: '赵强' },
      { time: '2026-01-10 10:00', action: '创建草稿', operator: '赵强' },
    ],
  },
  {
    id: 'ur_005', code: 'UR-20260114-001', status: 'COMPLETED', responsibleSite: '雅加达',
    sampleCount: 1, sampleIds: ['smp_004'], expectedReturnAt: '2026-01-15 18:00',
    projectId: 'prj_004', projectCode: 'PRJ-20260115-004', projectName: '夏季牛仔短裤',
    workItemId: 'wi_001', workItemCode: 'WI-001-001', workItemName: '直播测款-场次1',
    requesterId: 'user_005', requesterName: '林小红', requesterRole: '雅加达运营',
    approverId: 'user_wh_002', approverName: 'Budi',
    scenario: '直播测款', pickupMethod: '仓管交接', custodianType: 'external', custodianName: '主播Siti',
    createdAt: '2026-01-12 09:00', updatedAt: '2026-01-15 16:00', submittedAt: '2026-01-12 09:30',
    approvedAt: '2026-01-12 11:00', checkoutAt: '2026-01-12 14:00', returnRequestedAt: '2026-01-15 10:00', completedAt: '2026-01-15 16:00',
    logs: [
      { time: '2026-01-15 16:00', action: '确认归还入库', operator: 'Budi' },
      { time: '2026-01-15 10:00', action: '发起归还', operator: '林小红' },
      { time: '2026-01-12 14:00', action: '确认领用', operator: 'Budi' },
      { time: '2026-01-12 11:00', action: '审批通过', operator: 'Budi' },
      { time: '2026-01-12 09:30', action: '提交申请', operator: '林小红' },
      { time: '2026-01-12 09:00', action: '创建草稿', operator: '林小红' },
    ],
  },
  {
    id: 'ur_006', code: 'UR-20260113-001', status: 'REJECTED', responsibleSite: '深圳',
    sampleCount: 2, sampleIds: ['smp_001', 'smp_007'], expectedReturnAt: '2026-01-18 18:00',
    projectId: 'prj_001', projectCode: 'PRJ-20260115-001', projectName: '印尼风格碎花连衣裙',
    workItemId: 'wi_001', workItemCode: 'WI-001-001', workItemName: '直播测款-场次1',
    requesterId: 'user_006', requesterName: '周杰', requesterRole: '实习运营',
    scenario: '主播家播', pickupMethod: '快递寄送', custodianType: 'external', custodianName: '家播主播小美',
    remark: '需要寄送到主播家中',
    createdAt: '2026-01-13 15:00', updatedAt: '2026-01-14 10:00', submittedAt: '2026-01-13 15:30',
    logs: [
      { time: '2026-01-14 10:00', action: '驳回', operator: '李仓管', remark: '外寄主播需提供押金协议' },
      { time: '2026-01-13 15:30', action: '提交申请', operator: '周杰' },
      { time: '2026-01-13 15:00', action: '创建草稿', operator: '周杰' },
    ],
  },
  {
    id: 'ur_007', code: 'UR-20260116-004', status: 'DRAFT', responsibleSite: '深圳',
    sampleCount: 1, sampleIds: ['smp_001'], expectedReturnAt: '2026-01-23 18:00',
    projectId: 'prj_001', projectCode: 'PRJ-20260115-001', projectName: '印尼风格碎花连衣裙',
    workItemId: 'wi_001', workItemCode: 'WI-001-001', workItemName: '直播测款-场次1',
    requesterId: 'user_001', requesterName: '张丽', requesterRole: '测款运营',
    scenario: '直播测款', pickupMethod: '仓管交接', custodianType: 'internal', custodianName: '张丽',
    createdAt: '2026-01-16 14:00', updatedAt: '2026-01-16 14:00',
    logs: [{ time: '2026-01-16 14:00', action: '创建草稿', operator: '张丽' }],
  },
  {
    id: 'ur_008', code: 'UR-20260110-001', status: 'CANCELLED', responsibleSite: '雅加达',
    sampleCount: 1, sampleIds: ['smp_006'], expectedReturnAt: '2026-01-15 18:00',
    projectId: 'prj_004', projectCode: 'PRJ-20260115-004', projectName: '夏季牛仔短裤',
    workItemId: 'wi_001', workItemCode: 'WI-001-001', workItemName: '直播测款-场次1',
    requesterId: 'user_005', requesterName: '林小红', requesterRole: '雅加达运营',
    scenario: '拍摄', pickupMethod: '仓库自取', custodianType: 'internal', custodianName: '林小红',
    createdAt: '2026-01-10 08:00', updatedAt: '2026-01-11 09:00', submittedAt: '2026-01-10 08:30',
    logs: [
      { time: '2026-01-11 09:00', action: '取消申请', operator: '林小红', remark: '拍摄计划取消' },
      { time: '2026-01-10 08:30', action: '提交申请', operator: '林小红' },
      { time: '2026-01-10 08:00', action: '创建草稿', operator: '林小红' },
    ],
  },
]

// ============ 状态管理 ============

interface ApplicationState {
  search: string
  statusFilter: string
  siteFilter: string
  selectedRequestId: string | null
  detailDrawerOpen: boolean
  createDrawerOpen: boolean
  approveDialogOpen: boolean
  rejectDialogOpen: boolean
  cancelDialogOpen: boolean
  rejectReason: string
  cancelReason: string
  // 新建表单
  newProjectId: string
  newWorkItemId: string
  newExpectedReturnAt: string
  newScenario: string
  newPickupMethod: string
  newCustodianType: 'internal' | 'external'
  newCustodianName: string
  newSelectedSampleIds: string[]
  newRemark: string
}

let state: ApplicationState = {
  search: '',
  statusFilter: 'all',
  siteFilter: 'all',
  selectedRequestId: null,
  detailDrawerOpen: false,
  createDrawerOpen: false,
  approveDialogOpen: false,
  rejectDialogOpen: false,
  cancelDialogOpen: false,
  rejectReason: '',
  cancelReason: '',
  newProjectId: '',
  newWorkItemId: '',
  newExpectedReturnAt: '',
  newScenario: '',
  newPickupMethod: '',
  newCustodianType: 'internal',
  newCustodianName: '',
  newSelectedSampleIds: [],
  newRemark: '',
}

// ============ 工具函数 ============

function getSampleById(id: string) {
  return SAMPLES.find((s) => s.id === id)
}

function getSelectedRequest(): UseRequest | undefined {
  if (!state.selectedRequestId) return undefined
  return mockRequests.find((r) => r.id === state.selectedRequestId)
}

function isOverdue(request: UseRequest): boolean {
  if (request.status !== 'ACTIVE' && request.status !== 'RETURNING') return false
  return new Date(request.expectedReturnAt) < new Date()
}

function getFilteredRequests() {
  return mockRequests.filter((req) => {
    if (state.search) {
      const kw = state.search.toLowerCase()
      const match = req.code.toLowerCase().includes(kw) || req.projectName.toLowerCase().includes(kw) ||
        req.workItemName.toLowerCase().includes(kw) || req.requesterName.toLowerCase().includes(kw)
      if (!match) return false
    }
    if (state.statusFilter !== 'all' && req.status !== state.statusFilter) return false
    if (state.siteFilter !== 'all' && req.responsibleSite !== state.siteFilter) return false
    return true
  })
}

function getStats() {
  return {
    total: mockRequests.length,
    draft: mockRequests.filter((r) => r.status === 'DRAFT').length,
    submitted: mockRequests.filter((r) => r.status === 'SUBMITTED').length,
    approved: mockRequests.filter((r) => r.status === 'APPROVED').length,
    active: mockRequests.filter((r) => r.status === 'ACTIVE').length,
    returning: mockRequests.filter((r) => r.status === 'RETURNING').length,
    completed: mockRequests.filter((r) => r.status === 'COMPLETED').length,
    overdue: mockRequests.filter((r) => (r.status === 'ACTIVE' || r.status === 'RETURNING') && new Date(r.expectedReturnAt) < new Date()).length,
  }
}

// ============ 渲染函数 ============

function renderStatCard(label: string, value: number, colorClass = '', filterValue = '', isActive = false) {
  return `
    <button class="rounded-lg border bg-card p-3 text-left transition hover:border-blue-300 ${isActive ? 'border-blue-500 ring-1 ring-blue-500' : ''}"
      data-app-action="filter-status" data-status="${filterValue}">
      <div class="text-sm text-muted-foreground">${escapeHtml(label)}</div>
      <div class="text-2xl font-bold mt-1 ${colorClass}">${value}</div>
    </button>
  `
}

function renderRequestRow(req: UseRequest) {
  const cfg = STATUS_CONFIG[req.status]
  const overdue = isOverdue(req)
  return `
    <tr class="border-b last:border-b-0 hover:bg-muted/40 cursor-pointer" data-app-action="view-detail" data-request-id="${req.id}">
      <td class="px-3 py-3 font-medium text-primary">${req.code}</td>
      <td class="px-3 py-3"><span class="inline-flex rounded-full px-2 py-0.5 text-xs ${cfg.color}">${cfg.label}</span></td>
      <td class="px-3 py-3">${req.responsibleSite}</td>
      <td class="px-3 py-3">${req.sampleCount}</td>
      <td class="px-3 py-3">
        <div class="flex items-center gap-1">
          ${req.expectedReturnAt.slice(0, 10)}
          ${overdue ? '<span class="inline-flex rounded-full px-1.5 py-0.5 text-xs bg-red-100 text-red-700">超期</span>' : ''}
        </div>
      </td>
      <td class="px-3 py-3">
        <div class="text-xs text-muted-foreground">${req.projectCode}</div>
        <div class="truncate max-w-[150px]">${escapeHtml(req.projectName)}</div>
      </td>
      <td class="px-3 py-3">
        <div class="text-xs text-muted-foreground">${req.workItemCode}</div>
        <div class="truncate max-w-[150px]">${escapeHtml(req.workItemName)}</div>
      </td>
      <td class="px-3 py-3">
        <div class="text-xs text-muted-foreground">${req.requesterRole}</div>
        <div>${escapeHtml(req.requesterName)}</div>
      </td>
      <td class="px-3 py-3">${req.approverName || '-'}</td>
      <td class="px-3 py-3 text-sm text-muted-foreground">${req.updatedAt}</td>
      <td class="px-3 py-3">
        <button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-app-action="view-detail" data-request-id="${req.id}">
          <i data-lucide="eye" class="h-3.5 w-3.5"></i>
        </button>
      </td>
    </tr>
  `
}

function renderAppDetailDrawer() {
  if (!state.detailDrawerOpen) return ''
  const req = getSelectedRequest()
  if (!req) return ''

  const cfg = STATUS_CONFIG[req.status]
  const overdue = isOverdue(req)

  const headerHtml = `
    <div class="flex items-center gap-2">
      ${req.code}
      <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${cfg.color}">${cfg.label}</span>
    </div>
    <div class="flex items-center gap-2 mt-1">
      <span class="inline-flex rounded-full px-2 py-0.5 text-xs border">${req.responsibleSite}</span>
      ${overdue ? '<span class="inline-flex rounded-full px-2 py-0.5 text-xs bg-red-100 text-red-700">超期风险</span>' : ''}
    </div>
    <div class="flex flex-wrap gap-2 mt-4">
      ${req.status === 'DRAFT' ? `<button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-app-action="submit-request"><i data-lucide="send" class="mr-1 h-3.5 w-3.5"></i>提交申请</button>` : ''}
      ${req.status === 'SUBMITTED' ? `
        <button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-app-action="open-approve-dialog"><i data-lucide="check" class="mr-1 h-3.5 w-3.5"></i>审批通过</button>
        <button class="inline-flex h-8 items-center rounded-md bg-rose-600 px-3 text-xs text-white hover:bg-rose-700" data-app-action="open-reject-dialog"><i data-lucide="x" class="mr-1 h-3.5 w-3.5"></i>驳回</button>
      ` : ''}
      ${req.status === 'APPROVED' ? `<button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-app-action="checkout"><i data-lucide="package" class="mr-1 h-3.5 w-3.5"></i>确认领用</button>` : ''}
      ${req.status === 'ACTIVE' ? `<button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-app-action="request-return"><i data-lucide="undo" class="mr-1 h-3.5 w-3.5"></i>发起归还</button>` : ''}
      ${req.status === 'RETURNING' ? `<button class="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs text-white hover:bg-blue-700" data-app-action="confirm-return"><i data-lucide="inbox" class="mr-1 h-3.5 w-3.5"></i>确认归还入库</button>` : ''}
      ${['DRAFT', 'SUBMITTED', 'APPROVED'].includes(req.status) ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-app-action="open-cancel-dialog">取消申请</button>` : ''}
    </div>
  `

  const content = `
    <div class="space-y-6">
      <!-- 头部操作 -->
      <div class="-m-6 mb-0 px-6 py-4 border-b bg-muted/30">
        ${headerHtml}
      </div>

      <!-- 绑定信息 -->
      <div>
        <h3 class="font-semibold mb-3 flex items-center gap-2"><i data-lucide="file-text" class="h-4 w-4"></i>绑定信息</h3>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div class="text-muted-foreground">项目</div>
            <div>${req.projectCode}</div>
            <div class="font-medium">${escapeHtml(req.projectName)}</div>
          </div>
          <div>
            <div class="text-muted-foreground">工作项实例</div>
            <div>${req.workItemCode}</div>
            <div class="font-medium">${escapeHtml(req.workItemName)}</div>
          </div>
          <div>
            <div class="text-muted-foreground">预计归还时间</div>
            <div class="flex items-center gap-1">
              <i data-lucide="calendar" class="h-4 w-4"></i>${req.expectedReturnAt}
              ${overdue ? '<span class="inline-flex rounded-full px-1.5 py-0.5 text-xs bg-red-100 text-red-700">超期</span>' : ''}
            </div>
          </div>
          <div>
            <div class="text-muted-foreground">责任站点</div>
            <div class="flex items-center gap-1"><i data-lucide="building" class="h-4 w-4"></i>${req.responsibleSite}</div>
          </div>
        </div>
      </div>

      <!-- 使用信息 -->
      <div>
        <h3 class="font-semibold mb-3 flex items-center gap-2"><i data-lucide="user" class="h-4 w-4"></i>使用信息</h3>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div><div class="text-muted-foreground">使用场景</div><div>${req.scenario}</div></div>
          <div><div class="text-muted-foreground">取样方式</div><div>${req.pickupMethod}</div></div>
          <div><div class="text-muted-foreground">保管人类型</div><div>${req.custodianType === 'internal' ? '内部人员' : '外部主体'}</div></div>
          <div><div class="text-muted-foreground">保管人</div><div>${escapeHtml(req.custodianName)}</div></div>
          <div><div class="text-muted-foreground">申请人</div><div>${escapeHtml(req.requesterName)}（${req.requesterRole}）</div></div>
          ${req.approverName ? `<div><div class="text-muted-foreground">审批人</div><div>${escapeHtml(req.approverName)}</div></div>` : ''}
        </div>
        ${req.remark ? `<div class="mt-3"><div class="text-muted-foreground text-sm">备注</div><div class="text-sm bg-muted p-2 rounded mt-1">${escapeHtml(req.remark)}</div></div>` : ''}
      </div>

      <!-- 样衣清单 -->
      <div>
        <h3 class="font-semibold mb-3 flex items-center gap-2"><i data-lucide="package" class="h-4 w-4"></i>样衣清单（${req.sampleCount}件）</h3>
        <div class="space-y-2">
          ${req.sampleIds.map((sid) => {
            const sample = getSampleById(sid)
            if (!sample) return ''
            return `
              <div class="flex items-center gap-3 p-3 border rounded-lg">
                <div class="w-12 h-12 rounded bg-muted flex items-center justify-center">
                  <i data-lucide="image" class="h-6 w-6 text-muted-foreground"></i>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium truncate">${escapeHtml(sample.name)}</div>
                  <div class="text-xs text-muted-foreground">${sample.code}</div>
                </div>
                <div class="text-right text-sm">
                  <div>${sample.site}</div>
                  <div class="text-xs text-muted-foreground">${sample.location}</div>
                </div>
                <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${sample.availability === '可用' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${sample.availability}</span>
              </div>
            `
          }).join('')}
        </div>
      </div>

      <!-- 审批与操作日志 -->
      <div>
        <h3 class="font-semibold mb-3 flex items-center gap-2"><i data-lucide="clock" class="h-4 w-4"></i>审批与操作日志</h3>
        <div class="space-y-3">
          ${req.logs.map((log) => `
            <div class="flex gap-3 text-sm">
              <div class="w-[130px] text-muted-foreground shrink-0">${log.time}</div>
              <div class="flex-1">
                <span class="font-medium">${log.action}</span>
                <span class="text-muted-foreground ml-2">by ${escapeHtml(log.operator)}</span>
                ${log.remark ? `<div class="text-muted-foreground mt-0.5">${escapeHtml(log.remark)}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `

  return uiDrawer(
    {
      title: '申请详情',
      closeAction: { prefix: 'app', action: 'close-detail' },
      width: 'sm',
    },
    content,
    { cancel: { prefix: 'app', action: 'close-detail', label: '关闭' } }
  )
}

function renderAppCreateDrawer() {
  if (!state.createDrawerOpen) return ''

  const filteredWorkItems = WORK_ITEMS.filter((w) => w.projectId === state.newProjectId)

  const formContent = `
    <div class="space-y-6">
      <!-- 绑定信息 -->
      <div>
        <h3 class="font-semibold mb-3">绑定信息（必填）</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1.5">项目 *</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-app-field="new-project">
              <option value="">选择项目</option>
              ${PROJECTS.map((p) => `<option value="${p.id}" ${state.newProjectId === p.id ? 'selected' : ''}>${p.code} - ${escapeHtml(p.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1.5">工作项实例 *</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-app-field="new-work-item" ${!state.newProjectId ? 'disabled' : ''}>
              <option value="">选择工作项实例</option>
              ${filteredWorkItems.map((w) => `<option value="${w.id}" ${state.newWorkItemId === w.id ? 'selected' : ''}>${w.code} - ${escapeHtml(w.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1.5">预计归还时间 *</label>
            <input type="datetime-local" class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${state.newExpectedReturnAt}" data-app-field="new-return-time" />
          </div>
        </div>
      </div>

      <!-- 使用信息 -->
      <div>
        <h3 class="font-semibold mb-3">使用信息</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1.5">使用场景</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-app-field="new-scenario">
              <option value="">选择使用场景</option>
              ${SCENARIOS.map((s) => `<option value="${s}" ${state.newScenario === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1.5">取样方式</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-app-field="new-pickup">
              <option value="">选择取样方式</option>
              ${PICKUP_METHODS.map((m) => `<option value="${m}" ${state.newPickupMethod === m ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1.5">保管人类型</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-app-field="new-custodian-type">
              <option value="internal" ${state.newCustodianType === 'internal' ? 'selected' : ''}>内部人员</option>
              <option value="external" ${state.newCustodianType === 'external' ? 'selected' : ''}>外部主体</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1.5">保管人姓名</label>
            <input type="text" class="h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="输入保管人姓名" value="${escapeHtml(state.newCustodianName)}" data-app-field="new-custodian-name" />
          </div>
        </div>
      </div>

      <!-- 样衣清单 -->
      <div>
        <h3 class="font-semibold mb-3">样衣清单 *</h3>
        <div class="space-y-2">
          ${SAMPLES.map((sample) => {
            const isSelected = state.newSelectedSampleIds.includes(sample.id)
            const isUnavailable = sample.availability !== '可用'
            return `
              <div class="flex items-center gap-3 p-3 border rounded-lg ${isUnavailable ? 'opacity-50 bg-muted' : ''} ${isSelected ? 'border-primary bg-primary/5' : ''}"
                data-app-action="toggle-sample" data-sample-id="${sample.id}" ${isUnavailable ? 'data-disabled="true"' : ''}>
                <input type="checkbox" class="h-4 w-4 rounded border" ${isSelected ? 'checked' : ''} ${isUnavailable ? 'disabled' : ''} />
                <div class="w-10 h-10 rounded bg-muted flex items-center justify-center">
                  <i data-lucide="image" class="h-5 w-5 text-muted-foreground"></i>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-sm truncate">${escapeHtml(sample.name)}</div>
                  <div class="text-xs text-muted-foreground">${sample.code}</div>
                </div>
                <div class="text-right text-xs">
                  <div>${sample.site}</div>
                  <div class="text-muted-foreground">${sample.location}</div>
                </div>
                <span class="inline-flex rounded-full px-2 py-0.5 text-xs ${sample.availability === '可用' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${sample.availability}</span>
              </div>
            `
          }).join('')}
        </div>
        ${state.newSelectedSampleIds.length > 0 ? `<div class="mt-2 text-sm text-muted-foreground">已选择 ${state.newSelectedSampleIds.length} 件样衣</div>` : ''}
      </div>

      <!-- 备注 -->
      <div>
        <h3 class="font-semibold mb-3">附件与备注</h3>
        <div>
          <label class="block text-sm font-medium mb-1.5">补充说明</label>
          <textarea class="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px]" placeholder="输入补充说明..." data-app-field="new-remark">${escapeHtml(state.newRemark)}</textarea>
        </div>
      </div>
    </div>
  `

  return uiDrawer(
    {
      title: '新建样衣使用申请',
      closeAction: { prefix: 'app', action: 'close-create' },
      width: 'sm',
    },
    formContent,
    {
      cancel: { prefix: 'app', action: 'close-create', label: '取消' },
      extra: renderSecondaryButton('保存草稿', { prefix: 'app', action: 'save-draft' }),
      confirm: { prefix: 'app', action: 'submit-new', label: '提交申请', variant: 'primary' },
    }
  )
}

function renderAppApproveDialog() {
  if (!state.approveDialogOpen) return ''
  return uiConfirmDialog(
    {
      title: '确认审批通过',
      description: '审批通过后，所选样衣将被预占锁定，申请人可以进行领用操作。',
      closeAction: { prefix: 'app', action: 'close-approve-dialog' },
      confirmAction: { prefix: 'app', action: 'confirm-approve', label: '确认通过' },
      width: 'sm',
    }
  )
}

function renderAppRejectDialog() {
  if (!state.rejectDialogOpen) return ''
  const content = `
    <textarea class="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px]" placeholder="请输入驳回原因..." data-app-field="reject-reason">${escapeHtml(state.rejectReason)}</textarea>
  `
  return uiFormDialog(
    {
      title: '驳回申请',
      description: '请填写驳回原因',
      closeAction: { prefix: 'app', action: 'close-reject-dialog' },
      submitAction: { prefix: 'app', action: 'confirm-reject', label: '确认驳回' },
      width: 'sm',
    },
    content
  )
}

function renderAppCancelDialog() {
  if (!state.cancelDialogOpen) return ''
  const content = `
    <p class="text-sm text-muted-foreground mb-4">确定要取消此申请吗？如果样衣已被预占，将自动释放预占。</p>
    <textarea class="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[60px]" placeholder="取消原因（可选）..." data-app-field="cancel-reason">${escapeHtml(state.cancelReason)}</textarea>
  `
  return uiFormDialog(
    {
      title: '取消申请',
      closeAction: { prefix: 'app', action: 'close-cancel-dialog' },
      submitAction: { prefix: 'app', action: 'confirm-cancel', label: '确认取消' },
      cancelLabel: '返回',
      width: 'sm',
    },
    content
  )
}

function renderPage(): string {
  const filtered = getFilteredRequests()
  const stats = getStats()

  return `
    <div class="space-y-4">
      <!-- Header -->
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">样衣使用申请</h1>
          <p class="mt-1 text-sm text-muted-foreground">管理样衣借用申请流程，驱动预占/领用/归还台账事件</p>
        </div>
      </header>

      <!-- Stats Cards -->
      <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        ${renderStatCard('全部申请', stats.total, '', 'all', state.statusFilter === 'all')}
        ${renderStatCard('草稿', stats.draft, 'text-gray-600', 'DRAFT', state.statusFilter === 'DRAFT')}
        ${renderStatCard('待审批', stats.submitted, 'text-yellow-600', 'SUBMITTED', state.statusFilter === 'SUBMITTED')}
        ${renderStatCard('已批准', stats.approved, 'text-blue-600', 'APPROVED', state.statusFilter === 'APPROVED')}
        ${renderStatCard('使用中', stats.active, 'text-green-600', 'ACTIVE', state.statusFilter === 'ACTIVE')}
        ${renderStatCard('归还中', stats.returning, 'text-purple-600', 'RETURNING', state.statusFilter === 'RETURNING')}
        ${renderStatCard('已完成', stats.completed, 'text-emerald-600', 'COMPLETED', state.statusFilter === 'COMPLETED')}
        <button class="rounded-lg border border-red-200 bg-red-50 p-3 text-left transition hover:border-red-300" data-app-action="filter-overdue">
          <div class="text-sm text-red-600">超期未归还</div>
          <div class="text-2xl font-bold mt-1 text-red-600">${stats.overdue}</div>
        </button>
      </section>

      <!-- Filter Bar -->
      <section class="rounded-lg border bg-card p-4">
        <div class="flex flex-wrap gap-4 items-end">
          <div class="flex-1 min-w-[200px]">
            <label class="text-xs text-muted-foreground mb-1.5 block">关键词</label>
            <div class="relative">
              <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"></i>
              <input class="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" placeholder="申请单号/样衣编号/项目/工作项/申请人" value="${escapeHtml(state.search)}" data-app-field="search" />
            </div>
          </div>
          <div class="w-[140px]">
            <label class="text-xs text-muted-foreground mb-1.5 block">状态</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-app-field="status-filter">
              <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>全部状态</option>
              <option value="DRAFT" ${state.statusFilter === 'DRAFT' ? 'selected' : ''}>草稿</option>
              <option value="SUBMITTED" ${state.statusFilter === 'SUBMITTED' ? 'selected' : ''}>待审批</option>
              <option value="APPROVED" ${state.statusFilter === 'APPROVED' ? 'selected' : ''}>已批准</option>
              <option value="ACTIVE" ${state.statusFilter === 'ACTIVE' ? 'selected' : ''}>使用中</option>
              <option value="RETURNING" ${state.statusFilter === 'RETURNING' ? 'selected' : ''}>归还中</option>
              <option value="COMPLETED" ${state.statusFilter === 'COMPLETED' ? 'selected' : ''}>已完成</option>
              <option value="REJECTED" ${state.statusFilter === 'REJECTED' ? 'selected' : ''}>已驳回</option>
              <option value="CANCELLED" ${state.statusFilter === 'CANCELLED' ? 'selected' : ''}>已取消</option>
            </select>
          </div>
          <div class="w-[120px]">
            <label class="text-xs text-muted-foreground mb-1.5 block">责任站点</label>
            <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-app-field="site-filter">
              <option value="all" ${state.siteFilter === 'all' ? 'selected' : ''}>全部站点</option>
              ${SITES.map((s) => `<option value="${s}" ${state.siteFilter === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="flex gap-2">
            <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-app-action="reset-filters">重置</button>
            <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm text-white hover:bg-blue-700">查询</button>
          </div>
          <div class="flex-1"></div>
          <button class="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm text-white hover:bg-blue-700" data-app-action="open-create">
            <i data-lucide="plus" class="mr-1 h-4 w-4"></i>新建申请
          </button>
          <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-app-action="export">
            <i data-lucide="download" class="mr-1 h-4 w-4"></i>导出
          </button>
        </div>
      </section>

      <!-- Table -->
      <section class="overflow-hidden rounded-lg border bg-card">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1200px] text-sm">
            <thead>
              <tr class="border-b bg-muted/30 text-left text-muted-foreground">
                <th class="px-3 py-2 font-medium">申请单号</th>
                <th class="px-3 py-2 font-medium">状态</th>
                <th class="px-3 py-2 font-medium">责任站点</th>
                <th class="px-3 py-2 font-medium">样衣数量</th>
                <th class="px-3 py-2 font-medium">预计归还</th>
                <th class="px-3 py-2 font-medium">项目</th>
                <th class="px-3 py-2 font-medium">工作项实例</th>
                <th class="px-3 py-2 font-medium">申请人</th>
                <th class="px-3 py-2 font-medium">审批人</th>
                <th class="px-3 py-2 font-medium">更新时间</th>
                <th class="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length > 0 ? filtered.map(renderRequestRow).join('') : '<tr><td colspan="11" class="px-4 py-12 text-center text-muted-foreground"><i data-lucide="inbox" class="mx-auto h-10 w-10 text-muted-foreground/60"></i><p class="mt-2">暂无符合条件的申请单</p></td></tr>'}
            </tbody>
          </table>
        </div>
        <footer class="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-3">
          <p class="text-xs text-muted-foreground">共 ${filtered.length} 条</p>
          <div class="flex flex-wrap items-center gap-2">
            <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted cursor-not-allowed opacity-60" disabled>上一页</button>
            <span class="text-xs text-muted-foreground">1 / 1</span>
            <button class="inline-flex h-8 items-center rounded-md border px-2 text-xs hover:bg-muted cursor-not-allowed opacity-60" disabled>下一页</button>
          </div>
        </footer>
      </section>
    </div>

    ${renderAppDetailDrawer()}
    ${renderAppCreateDrawer()}
    ${renderAppApproveDialog()}
    ${renderAppRejectDialog()}
    ${renderAppCancelDialog()}
  `
}

// ============ 事件处理 ============

export function handleSampleApplicationEvent(target: Element): boolean {
  const actionNode = target.closest<HTMLElement>('[data-app-action]')
  const action = actionNode?.dataset.appAction

  if (action === 'filter-status') {
    const status = actionNode?.dataset.status || 'all'
    state.statusFilter = status
    return true
  }

  if (action === 'filter-overdue') {
    state.statusFilter = 'ACTIVE'
    return true
  }

  if (action === 'view-detail') {
    const requestId = actionNode?.dataset.requestId
    if (requestId) {
      state.selectedRequestId = requestId
      state.detailDrawerOpen = true
      return true
    }
  }

  if (action === 'close-detail') {
    state.detailDrawerOpen = false
    return true
  }

  if (action === 'open-create') {
    state.createDrawerOpen = true
    return true
  }

  if (action === 'close-create') {
    state.createDrawerOpen = false
    resetNewForm()
    return true
  }

  if (action === 'toggle-sample') {
    if (actionNode?.dataset.disabled === 'true') return true
    const sampleId = actionNode?.dataset.sampleId
    if (sampleId) {
      if (state.newSelectedSampleIds.includes(sampleId)) {
        state.newSelectedSampleIds = state.newSelectedSampleIds.filter((id) => id !== sampleId)
      } else {
        state.newSelectedSampleIds = [...state.newSelectedSampleIds, sampleId]
      }
      return true
    }
  }

  if (action === 'save-draft' || action === 'submit-new') {
    console.log('保存申请:', state.newSelectedSampleIds)
    state.createDrawerOpen = false
    resetNewForm()
    return true
  }

  if (action === 'reset-filters') {
    state.search = ''
    state.statusFilter = 'all'
    state.siteFilter = 'all'
    return true
  }

  // 详情抽屉内操作
  if (action === 'submit-request') {
    console.log('提交申请')
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

  if (action === 'confirm-approve') {
    console.log('审批通过')
    state.approveDialogOpen = false
    return true
  }

  if (action === 'open-reject-dialog') {
    state.rejectDialogOpen = true
    return true
  }

  if (action === 'close-reject-dialog') {
    state.rejectDialogOpen = false
    state.rejectReason = ''
    return true
  }

  if (action === 'confirm-reject') {
    console.log('驳回:', state.rejectReason)
    state.rejectDialogOpen = false
    state.rejectReason = ''
    return true
  }

  if (action === 'open-cancel-dialog') {
    state.cancelDialogOpen = true
    return true
  }

  if (action === 'close-cancel-dialog') {
    state.cancelDialogOpen = false
    state.cancelReason = ''
    return true
  }

  if (action === 'confirm-cancel') {
    console.log('取消申请:', state.cancelReason)
    state.cancelDialogOpen = false
    state.cancelReason = ''
    state.detailDrawerOpen = false
    return true
  }

  if (action === 'checkout') {
    console.log('确认领用')
    return true
  }

  if (action === 'request-return') {
    console.log('发起归还')
    return true
  }

  if (action === 'confirm-return') {
    console.log('确认归还入库')
    state.detailDrawerOpen = false
    return true
  }

  if (action === 'export') {
    console.log('导出')
    return true
  }

  return false
}

export function handleSampleApplicationInput(target: Element): boolean {
  const field = (target as HTMLElement).dataset.appField
  if (!field) return false

  if (field === 'search') {
    state.search = (target as HTMLInputElement).value
    return true
  }

  if (field === 'status-filter') {
    state.statusFilter = (target as HTMLSelectElement).value
    return true
  }

  if (field === 'site-filter') {
    state.siteFilter = (target as HTMLSelectElement).value
    return true
  }

  if (field === 'new-project') {
    state.newProjectId = (target as HTMLSelectElement).value
    state.newWorkItemId = ''
    return true
  }

  if (field === 'new-work-item') {
    state.newWorkItemId = (target as HTMLSelectElement).value
    return true
  }

  if (field === 'new-return-time') {
    state.newExpectedReturnAt = (target as HTMLInputElement).value
    return true
  }

  if (field === 'new-scenario') {
    state.newScenario = (target as HTMLSelectElement).value
    return true
  }

  if (field === 'new-pickup') {
    state.newPickupMethod = (target as HTMLSelectElement).value
    return true
  }

  if (field === 'new-custodian-type') {
    state.newCustodianType = (target as HTMLSelectElement).value as 'internal' | 'external'
    return true
  }

  if (field === 'new-custodian-name') {
    state.newCustodianName = (target as HTMLInputElement).value
    return true
  }

  if (field === 'new-remark') {
    state.newRemark = (target as HTMLTextAreaElement).value
    return true
  }

  if (field === 'reject-reason') {
    state.rejectReason = (target as HTMLTextAreaElement).value
    return true
  }

  if (field === 'cancel-reason') {
    state.cancelReason = (target as HTMLTextAreaElement).value
    return true
  }

  return false
}

function resetNewForm() {
  state.newProjectId = ''
  state.newWorkItemId = ''
  state.newExpectedReturnAt = ''
  state.newScenario = ''
  state.newPickupMethod = ''
  state.newCustodianType = 'internal'
  state.newCustodianName = ''
  state.newSelectedSampleIds = []
  state.newRemark = ''
}

export function isSampleApplicationDialogOpen(): boolean {
  return state.detailDrawerOpen || state.createDrawerOpen || state.approveDialogOpen || state.rejectDialogOpen || state.cancelDialogOpen
}

export function renderSampleApplicationPage(): string {
  return renderPage()
}
