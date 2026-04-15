import { ensurePcsProjectDemoDataReady } from '../data/pcs-project-demo-seed-service.ts'
import { appendSampleTransitions } from '../data/pcs-sample-actions.ts'
import {
  buildSampleUseRequestRoute,
  ensurePcsSampleApplicationDemoDataReady,
  getProjectWorkItemRoute,
  getSampleUseRequestById,
  listSampleUseRequests,
  type SampleCustodianUsageType,
  type SampleUseRequestLog,
  type SampleUseRequestRecord,
  type SampleUseRequestStatus,
  upsertSampleUseRequest,
} from '../data/pcs-sample-application-repository.ts'
import { ensurePcsSampleDemoDataReady } from '../data/pcs-sample-demo.ts'
import { getSampleAssetById, listSampleAssets } from '../data/pcs-sample-asset-repository.ts'
import { listProjectNodes, listProjects } from '../data/pcs-project-repository.ts'
import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'

type ApplicationStatusFilter = 'all' | SampleUseRequestStatus

interface ApplicationPageState {
  notice: string | null
  filters: {
    search: string
    status: ApplicationStatusFilter
    site: string
  }
  detailRequestId: string | null
  createDrawerOpen: boolean
  createDraft: {
    projectId: string
    projectNodeId: string
    scenario: string
    pickupMethod: string
    expectedReturnAt: string
    custodianType: SampleCustodianUsageType
    custodianName: string
    requesterName: string
    requesterRole: string
    remark: string
    selectedSampleIds: string[]
  }
}

const STATUS_META: Record<SampleUseRequestStatus, { label: string; className: string }> = {
  DRAFT: { label: '草稿', className: 'bg-slate-100 text-slate-700' },
  SUBMITTED: { label: '待审批', className: 'bg-blue-100 text-blue-700' },
  APPROVED: { label: '已批准', className: 'bg-violet-100 text-violet-700' },
  REJECTED: { label: '已驳回', className: 'bg-rose-100 text-rose-700' },
  CANCELLED: { label: '已取消', className: 'bg-slate-100 text-slate-500' },
  ACTIVE: { label: '使用中', className: 'bg-orange-100 text-orange-700' },
  RETURNING: { label: '归还中', className: 'bg-amber-100 text-amber-700' },
  COMPLETED: { label: '已完成', className: 'bg-emerald-100 text-emerald-700' },
}

const SCENARIOS = ['直播测款', '短视频测款', '版房制版', '工厂打样', '拍摄', '主播家播', '其他']
const PICKUP_METHODS = ['仓库自取', '仓管交接', '快递寄送']
const RELEVANT_WORK_ITEM_CODES = [
  'LIVE_TEST',
  'VIDEO_TEST',
  'SAMPLE_SHOOT_FIT',
  'SAMPLE_ACQUIRE',
  'FIRST_SAMPLE',
  'PRE_PRODUCTION_SAMPLE',
  'SAMPLE_RETURN_HANDLE',
] as const

const state: ApplicationPageState = {
  notice: null,
  filters: {
    search: '',
    status: 'all',
    site: 'all',
  },
  detailRequestId: null,
  createDrawerOpen: false,
  createDraft: {
    projectId: '',
    projectNodeId: '',
    scenario: '直播测款',
    pickupMethod: '仓库自取',
    expectedReturnAt: '',
    custodianType: '内部人员',
    custodianName: '',
    requesterName: '样衣管理员',
    requesterRole: '样衣管理员',
    remark: '',
    selectedSampleIds: [],
  },
}

function ensurePageDataReady(): void {
  ensurePcsProjectDemoDataReady()
  ensurePcsSampleDemoDataReady()
  ensurePcsSampleApplicationDemoDataReady()
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

function todayCompact(): string {
  return nowText().slice(0, 10).replaceAll('-', '')
}

function isOverdue(request: SampleUseRequestRecord): boolean {
  return (
    ['APPROVED', 'ACTIVE', 'RETURNING'].includes(request.status) &&
    Boolean(request.expectedReturnAt) &&
    request.expectedReturnAt.slice(0, 10) < nowText().slice(0, 10)
  )
}

function getRequestSamples(request: SampleUseRequestRecord) {
  return request.sampleAssetIds
    .map((sampleAssetId) => getSampleAssetById(sampleAssetId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
}

function getRequests(): SampleUseRequestRecord[] {
  ensurePageDataReady()
  return listSampleUseRequests()
}

function getFilteredRequests(): SampleUseRequestRecord[] {
  const keyword = state.filters.search.trim().toLowerCase()
  return getRequests().filter((request) => {
    if (keyword) {
      const sampleText = getRequestSamples(request)
        .map((item) => `${item.sampleCode} ${item.sampleName}`)
        .join(' ')
      const haystack = [
        request.requestCode,
        request.projectCode,
        request.projectName,
        request.workItemName,
        request.requesterName,
        sampleText,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    if (state.filters.status !== 'all' && request.status !== state.filters.status) return false
    if (state.filters.site !== 'all' && request.responsibleSite !== state.filters.site) return false
    return true
  })
}

function getProjectNodeOptions(projectId: string) {
  if (!projectId) return []
  return listProjectNodes(projectId).filter((node) => RELEVANT_WORK_ITEM_CODES.includes(node.workItemTypeCode as (typeof RELEVANT_WORK_ITEM_CODES)[number]))
}

function buildRequestLog(action: string, operator: string, remark = ''): SampleUseRequestLog {
  return {
    time: nowText(),
    action,
    operator,
    remark,
  }
}

function updateRequestRecord(
  requestId: string,
  patch: Partial<SampleUseRequestRecord>,
  log: SampleUseRequestLog | null,
): SampleUseRequestRecord | null {
  const request = getSampleUseRequestById(requestId)
  if (!request) return null
  const nextRecord: SampleUseRequestRecord = {
    ...request,
    ...patch,
    updatedAt: patch.updatedAt || nowText(),
    logs: log ? [log, ...request.logs] : request.logs,
  }
  return upsertSampleUseRequest(nextRecord)
}

function buildCreateRequestCode(): string {
  const prefix = `APP-${todayCompact()}-`
  const count = getRequests().filter((item) => item.requestCode.startsWith(prefix)).length + 1
  return `${prefix}${String(count).padStart(3, '0')}`
}

function validateCreateDraft(): string | null {
  if (!state.createDraft.projectId) return '请选择商品项目。'
  if (!state.createDraft.projectNodeId) return '请选择关联工作项。'
  if (!state.createDraft.expectedReturnAt) return '请填写预计归还时间。'
  if (!state.createDraft.custodianName.trim()) return '请填写保管人。'
  if (!state.createDraft.requesterName.trim()) return '请填写申请人。'
  if (state.createDraft.selectedSampleIds.length === 0) return '请至少选择一件样衣。'

  const samples = state.createDraft.selectedSampleIds
    .map((sampleAssetId) => getSampleAssetById(sampleAssetId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  if (samples.some((item) => item.inventoryStatus !== '在库可用')) {
    return '存在不可直接申请的样衣，请移除后重试。'
  }
  const siteSet = new Set(samples.map((item) => item.responsibleSite))
  if (siteSet.size > 1) {
    return '所选样衣责任站点必须一致，请拆分成多张申请。'
  }
  return null
}

function resetCreateDraft(): void {
  state.createDraft = {
    projectId: '',
    projectNodeId: '',
    scenario: '直播测款',
    pickupMethod: '仓库自取',
    expectedReturnAt: '',
    custodianType: '内部人员',
    custodianName: '',
    requesterName: '样衣管理员',
    requesterRole: '样衣管理员',
    remark: '',
    selectedSampleIds: [],
  }
}

function createRequest(status: SampleUseRequestStatus): boolean {
  const error = validateCreateDraft()
  if (error) {
    state.notice = error
    return true
  }

  const project = listProjects().find((item) => item.projectId === state.createDraft.projectId)
  const node = getProjectNodeOptions(state.createDraft.projectId).find((item) => item.projectNodeId === state.createDraft.projectNodeId)
  const samples = state.createDraft.selectedSampleIds
    .map((sampleAssetId) => getSampleAssetById(sampleAssetId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  const timestamp = nowText()
  const requestCode = buildCreateRequestCode()
  upsertSampleUseRequest({
    requestId: `sample_use_request_${Date.now()}`,
    requestCode,
    status,
    responsibleSite: samples[0]?.responsibleSite || '深圳',
    sampleAssetIds: [...state.createDraft.selectedSampleIds],
    expectedReturnAt: state.createDraft.expectedReturnAt,
    projectId: project?.projectId || '',
    projectCode: project?.projectCode || '',
    projectName: project?.projectName || '',
    projectNodeId: node?.projectNodeId || '',
    workItemTypeCode: node?.workItemTypeCode || '',
    workItemName: node?.workItemTypeName || '',
    requesterName: state.createDraft.requesterName.trim(),
    requesterRole: state.createDraft.requesterRole.trim() || '样衣管理员',
    approverName: '',
    scenario: state.createDraft.scenario,
    pickupMethod: state.createDraft.pickupMethod,
    custodianType: state.createDraft.custodianType,
    custodianName: state.createDraft.custodianName.trim(),
    remark: state.createDraft.remark.trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
    submittedAt: status === 'SUBMITTED' ? timestamp : '',
    approvedAt: '',
    checkoutAt: '',
    returnRequestedAt: '',
    completedAt: '',
    logs: [
      ...(status === 'SUBMITTED' ? [buildRequestLog('提交申请', state.createDraft.requesterName.trim())] : []),
      buildRequestLog('创建草稿', state.createDraft.requesterName.trim()),
    ],
  })

  state.notice = status === 'SUBMITTED' ? `已创建并提交申请 ${requestCode}。` : `已保存草稿 ${requestCode}。`
  state.createDrawerOpen = false
  resetCreateDraft()
  return true
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="font-medium">样衣使用申请</p>
          <p class="mt-1">${escapeHtml(state.notice)}</p>
        </div>
        <button type="button" class="inline-flex h-7 items-center rounded-md px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-sample-application-action="close-notice">关闭</button>
      </div>
    </section>
  `
}

function renderHeader(): string {
  return `
    <section class="rounded-xl border bg-white px-6 py-5 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs text-slate-500">商品中心 / 样衣资产管理</p>
          <h1 class="mt-1 text-2xl font-semibold text-slate-900">样衣使用申请</h1>
          <p class="mt-1 text-sm text-slate-500">管理样衣借用申请、审批、领用和归还，驱动预占、出库与回仓台账事件。</p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-sample-application-action="open-create-drawer"><i data-lucide="plus" class="h-4 w-4"></i>新建申请</button>
          <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-application-action="refresh"><i data-lucide="refresh-cw" class="h-4 w-4"></i>刷新</button>
        </div>
      </div>
    </section>
  `
}

function renderSummary(): string {
  const requests = getFilteredRequests()
  const total = requests.length
  const pending = requests.filter((item) => item.status === 'SUBMITTED').length
  const approved = requests.filter((item) => item.status === 'APPROVED').length
  const active = requests.filter((item) => item.status === 'ACTIVE').length
  const returning = requests.filter((item) => item.status === 'RETURNING').length
  const overdue = requests.filter((item) => isOverdue(item)).length
  const cards = [
    { label: '全部申请', value: total, helper: '含草稿、审批中和已完成', tone: 'border-slate-200 bg-white text-slate-900' },
    { label: '待审批', value: pending, helper: '等待仓管审批', tone: 'border-blue-200 bg-blue-50 text-blue-700' },
    { label: '已批准待领用', value: approved, helper: '样衣已预占锁定', tone: 'border-violet-200 bg-violet-50 text-violet-700' },
    { label: '使用中', value: active, helper: '样衣已出库占用', tone: 'border-orange-200 bg-orange-50 text-orange-700' },
    { label: '归还中', value: returning, helper: '等待归还签收与回仓', tone: 'border-amber-200 bg-amber-50 text-amber-700' },
    { label: '超期风险', value: overdue, helper: '预计归还时间已超期', tone: 'border-rose-200 bg-rose-50 text-rose-700' },
  ]
  return `
    <section class="grid gap-4 xl:grid-cols-6">
      ${cards
        .map(
          (card) => `
            <article class="${escapeHtml(toClassName('rounded-xl border px-5 py-4 shadow-sm', card.tone))}">
              <p class="text-sm font-medium">${escapeHtml(card.label)}</p>
              <p class="mt-3 text-3xl font-semibold">${escapeHtml(card.value)}</p>
              <p class="mt-2 text-xs opacity-80">${escapeHtml(card.helper)}</p>
            </article>
          `,
        )
        .join('')}
    </section>
  `
}

function renderFilters(): string {
  const requests = getRequests()
  const sites = Array.from(new Set(requests.map((item) => item.responsibleSite)))
  return `
    <section class="rounded-xl border bg-white px-6 py-5 shadow-sm">
      <div class="grid gap-4 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>搜索</span>
          <input type="search" class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" placeholder="申请单号 / 样衣编号 / 项目 / 申请人" value="${escapeHtml(state.filters.search)}" data-pcs-sample-application-field="search" />
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>状态</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-sample-application-field="status">
            <option value="all">全部状态</option>
            ${Object.entries(STATUS_META)
              .map(([key, meta]) => `<option value="${escapeHtml(key)}" ${state.filters.status === key ? 'selected' : ''}>${escapeHtml(meta.label)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>责任站点</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-sample-application-field="site">
            <option value="all">全部站点</option>
            ${sites.map((site) => `<option value="${escapeHtml(site)}" ${state.filters.site === site ? 'selected' : ''}>${escapeHtml(site)}</option>`).join('')}
          </select>
        </label>
        <div class="flex items-end justify-end gap-3">
          <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-application-action="reset">重置</button>
        </div>
      </div>
    </section>
  `
}

function renderTable(): string {
  const requests = getFilteredRequests()
  return `
    <section class="rounded-xl border bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-3">申请单号</th>
              <th class="px-4 py-3">项目 / 工作项</th>
              <th class="px-4 py-3">样衣数量</th>
              <th class="px-4 py-3">申请人</th>
              <th class="px-4 py-3">预计归还</th>
              <th class="px-4 py-3">状态</th>
              <th class="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${
              requests.length === 0
                ? '<tr><td colspan="7" class="px-4 py-12 text-center text-sm text-slate-500">当前筛选条件下暂无样衣使用申请。</td></tr>'
                : requests
                    .map(
                      (request) => `
                        <tr class="hover:bg-slate-50/80">
                          <td class="px-4 py-3 align-top">
                            <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-pcs-sample-application-action="open-detail" data-request-id="${escapeHtml(request.requestId)}">${escapeHtml(request.requestCode)}</button>
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(request.responsibleSite)}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            ${request.projectId ? `<button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(request.projectId)}">${escapeHtml(request.projectCode || request.projectName)}</button>` : '<p class="text-slate-500">未绑定项目</p>'}
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(request.workItemName || '-')}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <p class="text-slate-900">${escapeHtml(request.sampleAssetIds.length)}</p>
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(getRequestSamples(request).map((item) => item.sampleCode).join('、') || '-')}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <p class="text-slate-900">${escapeHtml(request.requesterName)}</p>
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(request.requesterRole)}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <p class="text-slate-900">${escapeHtml(request.expectedReturnAt || '-')}</p>
                            ${isOverdue(request) ? '<p class="mt-1 text-xs text-rose-600">已超期</p>' : '<p class="mt-1 text-xs text-slate-400">-</p>'}
                          </td>
                          <td class="px-4 py-3 align-top">
                            <span class="${escapeHtml(toClassName('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_META[request.status].className))}">${escapeHtml(STATUS_META[request.status].label)}</span>
                          </td>
                          <td class="px-4 py-3 align-top text-right">
                            <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-sample-application-action="open-detail" data-request-id="${escapeHtml(request.requestId)}">查看详情</button>
                          </td>
                        </tr>
                      `,
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderDrawerShell(title: string, body: string, closeAction: string): string {
  return `
    <div class="fixed inset-0 z-40 flex justify-end">
      <button type="button" class="absolute inset-0 bg-slate-900/35" data-pcs-sample-application-action="${escapeHtml(closeAction)}"></button>
      <section class="relative flex h-full w-full max-w-4xl flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div class="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p class="text-xs text-slate-500">样衣使用申请</p>
            <h2 class="mt-1 text-lg font-semibold text-slate-900">${escapeHtml(title)}</h2>
          </div>
          <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-application-action="${escapeHtml(closeAction)}">关闭</button>
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-5">${body}</div>
      </section>
    </div>
  `
}

function renderDetailDrawer(): string {
  if (!state.detailRequestId) return ''
  const request = getSampleUseRequestById(state.detailRequestId)
  if (!request) return ''
  const samples = getRequestSamples(request)

  const actions: string[] = []
  if (request.status === 'DRAFT') {
    actions.push('<button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-sample-application-action="submit-detail-request" data-request-id="' + escapeHtml(request.requestId) + '">提交申请</button>')
  }
  if (request.status === 'SUBMITTED') {
    actions.push('<button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-sample-application-action="approve-request" data-request-id="' + escapeHtml(request.requestId) + '">审批通过</button>')
    actions.push('<button type="button" class="inline-flex h-9 items-center rounded-md border border-rose-200 bg-white px-4 text-sm text-rose-700 hover:bg-rose-50" data-pcs-sample-application-action="reject-request" data-request-id="' + escapeHtml(request.requestId) + '">驳回</button>')
  }
  if (request.status === 'APPROVED') {
    actions.push('<button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-sample-application-action="checkout-request" data-request-id="' + escapeHtml(request.requestId) + '">确认领用</button>')
  }
  if (request.status === 'ACTIVE') {
    actions.push('<button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-sample-application-action="request-return" data-request-id="' + escapeHtml(request.requestId) + '">发起归还</button>')
  }
  if (request.status === 'RETURNING') {
    actions.push('<button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-sample-application-action="confirm-return" data-request-id="' + escapeHtml(request.requestId) + '">确认归还</button>')
  }
  if (['DRAFT', 'SUBMITTED', 'APPROVED'].includes(request.status)) {
    actions.push('<button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-application-action="cancel-request" data-request-id="' + escapeHtml(request.requestId) + '">取消申请</button>')
  }

  const body = `
    <div class="space-y-6">
      <section class="rounded-lg border bg-slate-50 p-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="${escapeHtml(toClassName('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_META[request.status].className))}">${escapeHtml(STATUS_META[request.status].label)}</span>
          <span class="inline-flex rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">${escapeHtml(request.responsibleSite)}</span>
          ${isOverdue(request) ? '<span class="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">超期风险</span>' : ''}
        </div>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p class="text-xs text-slate-500">申请单号</p>
            <p class="mt-1 font-medium text-slate-900">${escapeHtml(request.requestCode)}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">预计归还时间</p>
            <p class="mt-1 text-slate-900">${escapeHtml(request.expectedReturnAt || '-')}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">商品项目</p>
            ${request.projectId ? `<button type="button" class="mt-1 text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(request.projectId)}">${escapeHtml(request.projectCode || request.projectName)}</button>` : '<p class="mt-1 text-slate-500">未绑定</p>'}
          </div>
          <div>
            <p class="text-xs text-slate-500">关联工作项</p>
            ${
              request.projectId && request.projectNodeId
                ? `<button type="button" class="mt-1 text-left font-medium text-blue-700 hover:underline" data-nav="${escapeHtml(getProjectWorkItemRoute(request.projectId, request.projectNodeId) || buildSampleUseRequestRoute(request.requestId))}">${escapeHtml(request.workItemName || '-')}</button>`
                : `<p class="mt-1 text-slate-900">${escapeHtml(request.workItemName || '-')}</p>`
            }
          </div>
          <div>
            <p class="text-xs text-slate-500">申请人</p>
            <p class="mt-1 text-slate-900">${escapeHtml(request.requesterName)} / ${escapeHtml(request.requesterRole)}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">保管人</p>
            <p class="mt-1 text-slate-900">${escapeHtml(request.custodianName)} / ${escapeHtml(request.custodianType)}</p>
          </div>
        </div>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-slate-900">样衣清单（${escapeHtml(samples.length)} 件）</p>
            <p class="mt-1 text-xs text-slate-500">这里展示申请绑定的样衣资产快照，审批与领用会直接写入库存和台账。</p>
          </div>
          <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/samples/ledger">查看台账</button>
        </div>
        <div class="mt-4 space-y-3">
          ${samples
            .map(
              (sample) => `
                <div class="rounded-lg border border-slate-200 p-3">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p class="text-sm font-medium text-slate-900">${escapeHtml(sample.sampleCode)}</p>
                      <p class="mt-1 text-xs text-slate-500">${escapeHtml(sample.sampleName)}</p>
                    </div>
                    <span class="inline-flex rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">${escapeHtml(sample.inventoryStatus)}</span>
                  </div>
                  <div class="mt-2 grid gap-2 text-xs text-slate-500 md:grid-cols-3">
                    <p>位置：${escapeHtml(sample.locationDisplay)}</p>
                    <p>保管：${escapeHtml(sample.custodianName || '-')}</p>
                    <p>最后变更：${escapeHtml(formatDateTime(sample.lastEventTime))}</p>
                  </div>
                </div>
              `,
            )
            .join('')}
        </div>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-slate-900">操作</p>
            <p class="mt-1 text-xs text-slate-500">审批通过会写预占，确认领用会写出库，确认归还会写回仓。</p>
          </div>
          <div class="flex flex-wrap items-center gap-3">${actions.join('')}</div>
        </div>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <p class="text-sm font-medium text-slate-900">操作日志</p>
        <div class="mt-4 space-y-3">
          ${request.logs
            .map(
              (log) => `
                <div class="rounded-lg border border-slate-200 p-3">
                  <div class="flex items-center justify-between gap-3">
                    <p class="text-sm font-medium text-slate-900">${escapeHtml(log.action)}</p>
                    <p class="text-xs text-slate-500">${escapeHtml(formatDateTime(log.time))}</p>
                  </div>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(log.operator)}${log.remark ? ` · ${escapeHtml(log.remark)}` : ''}</p>
                </div>
              `,
            )
            .join('')}
        </div>
      </section>
    </div>
  `

  return renderDrawerShell(`${request.requestCode} · ${STATUS_META[request.status].label}`, body, 'close-detail')
}

function renderCreateDrawer(): string {
  if (!state.createDrawerOpen) return ''
  const projectOptions = listProjects()
  const nodeOptions = getProjectNodeOptions(state.createDraft.projectId)
  const sampleOptions = listSampleAssets()
    .filter((item) => item.inventoryStatus === '在库可用')
    .filter((item) => !state.createDraft.projectId || !item.projectId || item.projectId === state.createDraft.projectId)

  const body = `
    <div class="space-y-6">
      <section class="grid gap-4 md:grid-cols-2">
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>商品项目</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-sample-application-field="create-project">
            <option value="">请选择项目</option>
            ${projectOptions
              .map((project) => `<option value="${escapeHtml(project.projectId)}" ${state.createDraft.projectId === project.projectId ? 'selected' : ''}>${escapeHtml(project.projectCode)} · ${escapeHtml(project.projectName)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>关联工作项</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-sample-application-field="create-node">
            <option value="">请选择工作项</option>
            ${nodeOptions
              .map((node) => `<option value="${escapeHtml(node.projectNodeId)}" ${state.createDraft.projectNodeId === node.projectNodeId ? 'selected' : ''}>${escapeHtml(node.workItemTypeName)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>使用场景</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-sample-application-field="create-scenario">
            ${SCENARIOS.map((scenario) => `<option value="${escapeHtml(scenario)}" ${state.createDraft.scenario === scenario ? 'selected' : ''}>${escapeHtml(scenario)}</option>`).join('')}
          </select>
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>取样方式</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-sample-application-field="create-pickup-method">
            ${PICKUP_METHODS.map((method) => `<option value="${escapeHtml(method)}" ${state.createDraft.pickupMethod === method ? 'selected' : ''}>${escapeHtml(method)}</option>`).join('')}
          </select>
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>预计归还时间</span>
          <input type="text" class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" placeholder="例如 2026-04-18 18:00" value="${escapeHtml(state.createDraft.expectedReturnAt)}" data-pcs-sample-application-field="create-expected-return" />
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>保管人类型</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-sample-application-field="create-custodian-type">
            <option value="内部人员" ${state.createDraft.custodianType === '内部人员' ? 'selected' : ''}>内部人员</option>
            <option value="外部主体" ${state.createDraft.custodianType === '外部主体' ? 'selected' : ''}>外部主体</option>
          </select>
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>申请人</span>
          <input type="text" class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" value="${escapeHtml(state.createDraft.requesterName)}" data-pcs-sample-application-field="create-requester-name" />
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>申请人角色</span>
          <input type="text" class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" value="${escapeHtml(state.createDraft.requesterRole)}" data-pcs-sample-application-field="create-requester-role" />
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600 md:col-span-2">
          <span>保管人</span>
          <input type="text" class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" value="${escapeHtml(state.createDraft.custodianName)}" data-pcs-sample-application-field="create-custodian-name" />
        </label>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <p class="text-sm font-medium text-slate-900">样衣清单</p>
        <p class="mt-1 text-xs text-slate-500">仅展示当前可直接申请的在库样衣。</p>
        <div class="mt-4 space-y-3">
          ${
            sampleOptions.length === 0
              ? '<div class="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-slate-500">当前条件下没有可直接申请的样衣。</div>'
              : sampleOptions
                  .map(
                    (sample) => `
                      <label class="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
                        <input type="checkbox" class="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" ${state.createDraft.selectedSampleIds.includes(sample.sampleAssetId) ? 'checked' : ''} data-pcs-sample-application-action="toggle-create-sample" data-sample-asset-id="${escapeHtml(sample.sampleAssetId)}" />
                        <div class="flex-1">
                          <div class="flex flex-wrap items-center gap-2">
                            <p class="text-sm font-medium text-slate-900">${escapeHtml(sample.sampleCode)}</p>
                            <span class="inline-flex rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">${escapeHtml(sample.responsibleSite)}</span>
                          </div>
                          <p class="mt-1 text-xs text-slate-500">${escapeHtml(sample.sampleName)}</p>
                          <p class="mt-2 text-xs text-slate-500">位置：${escapeHtml(sample.locationDisplay)} / 保管：${escapeHtml(sample.custodianName || '-')}</p>
                        </div>
                      </label>
                    `,
                  )
                  .join('')
          }
        </div>
      </section>

      <label class="flex flex-col gap-2 text-sm text-slate-600">
        <span>补充说明</span>
        <textarea class="min-h-[96px] rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" placeholder="输入补充说明..." data-pcs-sample-application-field="create-remark">${escapeHtml(state.createDraft.remark)}</textarea>
      </label>

      <div class="flex flex-wrap justify-end gap-3">
        <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-application-action="close-create-drawer">取消</button>
        <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-application-action="create-draft">保存草稿</button>
        <button type="button" class="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-sample-application-action="create-submit">提交申请</button>
      </div>
    </div>
  `

  return renderDrawerShell('新建样衣使用申请', body, 'close-create-drawer')
}

export function renderPcsSampleApplicationPage(): string {
  ensurePageDataReady()
  return `
    <div class="space-y-6">
      ${renderNotice()}
      ${renderHeader()}
      ${renderSummary()}
      ${renderFilters()}
      ${renderTable()}
      ${renderDetailDrawer()}
      ${renderCreateDrawer()}
    </div>
  `
}

export function handlePcsSampleApplicationInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-sample-application-field]')
  if (!fieldNode) return false
  const field = fieldNode.dataset.pcsSampleApplicationField
  if (!field) return false

  if (field === 'search' && fieldNode instanceof HTMLInputElement) {
    state.filters.search = fieldNode.value
    return true
  }
  if (field === 'status' && fieldNode instanceof HTMLSelectElement) {
    state.filters.status = fieldNode.value as ApplicationStatusFilter
    return true
  }
  if (field === 'site' && fieldNode instanceof HTMLSelectElement) {
    state.filters.site = fieldNode.value
    return true
  }

  if (fieldNode instanceof HTMLSelectElement || fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLTextAreaElement) {
    if (field === 'create-project') {
      state.createDraft.projectId = fieldNode.value
      state.createDraft.projectNodeId = ''
      state.createDraft.selectedSampleIds = []
    }
    if (field === 'create-node') state.createDraft.projectNodeId = fieldNode.value
    if (field === 'create-scenario') state.createDraft.scenario = fieldNode.value
    if (field === 'create-pickup-method') state.createDraft.pickupMethod = fieldNode.value
    if (field === 'create-expected-return') state.createDraft.expectedReturnAt = fieldNode.value
    if (field === 'create-custodian-type' && fieldNode instanceof HTMLSelectElement) {
      state.createDraft.custodianType = fieldNode.value as SampleCustodianUsageType
    }
    if (field === 'create-custodian-name') state.createDraft.custodianName = fieldNode.value
    if (field === 'create-requester-name') state.createDraft.requesterName = fieldNode.value
    if (field === 'create-requester-role') state.createDraft.requesterRole = fieldNode.value
    if (field === 'create-remark' && fieldNode instanceof HTMLTextAreaElement) state.createDraft.remark = fieldNode.value
    return true
  }

  return false
}

function applyApproveRequest(request: SampleUseRequestRecord): boolean {
  const samples = getRequestSamples(request)
  appendSampleTransitions(
    samples.map((sample) => ({
      sampleAssetId: sample.sampleAssetId,
      eventType: 'RESERVE_LOCK',
      inventoryStatusAfter: '预占锁定',
      availabilityAfter: '不可用',
      locationType: sample.locationType,
      locationDisplay: sample.locationDisplay,
      custodianType: request.custodianType === '内部人员' ? '内部人员' : '外部主体',
      custodianName: request.custodianName,
      operatorName: '样衣管理员',
      note: `样衣使用申请 ${request.requestCode} 审批通过，预计归还 ${request.expectedReturnAt || '-'}。`,
      sourceModule: '样衣使用申请',
      sourceDocType: '样衣使用申请',
      sourceDocCode: request.requestCode,
      sourceDocId: request.requestId,
    })),
  )
  updateRequestRecord(request.requestId, { status: 'APPROVED', approverName: '样衣管理员', approvedAt: nowText() }, buildRequestLog('审批通过', '样衣管理员'))
  state.notice = `${request.requestCode} 已审批通过，样衣已预占锁定。`
  return true
}

function applyRejectRequest(request: SampleUseRequestRecord): boolean {
  updateRequestRecord(request.requestId, { status: 'REJECTED' }, buildRequestLog('驳回申请', '样衣管理员', '当前样衣不可调用。'))
  state.notice = `${request.requestCode} 已驳回。`
  return true
}

function applyCheckoutRequest(request: SampleUseRequestRecord): boolean {
  const samples = getRequestSamples(request)
  appendSampleTransitions(
    samples.map((sample) => ({
      sampleAssetId: sample.sampleAssetId,
      eventType: 'CHECKOUT_BORROW',
      inventoryStatusAfter: '借出占用',
      availabilityAfter: '不可用',
      locationType: '外部保管',
      locationDisplay: `${request.responsibleSite} / ${request.custodianName}`,
      custodianType: request.custodianType === '内部人员' ? '内部人员' : '外部主体',
      custodianName: request.custodianName,
      operatorName: '样衣管理员',
      note: `样衣使用申请 ${request.requestCode} 已领用出库，预计归还 ${request.expectedReturnAt || '-'}。`,
      sourceModule: '样衣使用申请',
      sourceDocType: '样衣使用申请',
      sourceDocCode: request.requestCode,
      sourceDocId: request.requestId,
    })),
  )
  updateRequestRecord(request.requestId, { status: 'ACTIVE', checkoutAt: nowText() }, buildRequestLog('确认领用', '样衣管理员'))
  state.notice = `${request.requestCode} 已领用出库。`
  return true
}

function applyRequestReturn(request: SampleUseRequestRecord): boolean {
  updateRequestRecord(request.requestId, { status: 'RETURNING', returnRequestedAt: nowText() }, buildRequestLog('发起归还', request.requesterName))
  state.notice = `${request.requestCode} 已发起归还。`
  return true
}

function applyConfirmReturn(request: SampleUseRequestRecord): boolean {
  const samples = getRequestSamples(request)
  appendSampleTransitions(
    samples.map((sample) => ({
      sampleAssetId: sample.sampleAssetId,
      eventType: 'RETURN_CHECKIN',
      inventoryStatusAfter: '在库可用',
      availabilityAfter: '可用',
      locationType: '仓库',
      locationDisplay: `${request.responsibleSite}收货区`,
      custodianType: '仓管',
      custodianName: `${request.responsibleSite}仓管`,
      operatorName: '样衣管理员',
      note: `样衣使用申请 ${request.requestCode} 已归还入库。`,
      sourceModule: '样衣使用申请',
      sourceDocType: '样衣使用申请',
      sourceDocCode: request.requestCode,
      sourceDocId: request.requestId,
    })),
  )
  updateRequestRecord(
    request.requestId,
    { status: 'COMPLETED', completedAt: nowText() },
    buildRequestLog('完成归还', '样衣管理员'),
  )
  state.notice = `${request.requestCode} 已归还入库并完成。`
  return true
}

function applyCancelRequest(request: SampleUseRequestRecord): boolean {
  if (request.status === 'APPROVED') {
    const samples = getRequestSamples(request).filter((sample) => sample.inventoryStatus === '预占锁定')
    appendSampleTransitions(
      samples.map((sample) => ({
        sampleAssetId: sample.sampleAssetId,
        eventType: 'CANCEL_RESERVE',
        inventoryStatusAfter: '在库可用',
        availabilityAfter: '可用',
        locationType: sample.locationType,
        locationDisplay: sample.locationDisplay,
        custodianType: '仓管',
        custodianName: `${request.responsibleSite}仓管`,
        operatorName: '样衣管理员',
        note: `样衣使用申请 ${request.requestCode} 已取消，释放预占。`,
        sourceModule: '样衣使用申请',
        sourceDocType: '样衣使用申请',
        sourceDocCode: request.requestCode,
        sourceDocId: request.requestId,
      })),
    )
  }
  updateRequestRecord(request.requestId, { status: 'CANCELLED' }, buildRequestLog('取消申请', request.requesterName))
  state.notice = `${request.requestCode} 已取消。`
  return true
}

export function handlePcsSampleApplicationEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pcs-sample-application-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsSampleApplicationAction
  if (!action) return false

  if (action === 'close-notice') {
    state.notice = null
    return true
  }
  if (action === 'refresh') {
    ensurePageDataReady()
    state.notice = '已刷新样衣使用申请。'
    return true
  }
  if (action === 'reset') {
    state.filters = { search: '', status: 'all', site: 'all' }
    return true
  }
  if (action === 'open-create-drawer') {
    state.createDrawerOpen = true
    return true
  }
  if (action === 'close-create-drawer') {
    state.createDrawerOpen = false
    return true
  }
  if (action === 'create-draft') return createRequest('DRAFT')
  if (action === 'create-submit') return createRequest('SUBMITTED')
  if (action === 'toggle-create-sample') {
    const sampleAssetId = actionNode.dataset.sampleAssetId
    if (!sampleAssetId) return true
    state.createDraft.selectedSampleIds = state.createDraft.selectedSampleIds.includes(sampleAssetId)
      ? state.createDraft.selectedSampleIds.filter((item) => item !== sampleAssetId)
      : [...state.createDraft.selectedSampleIds, sampleAssetId]
    return true
  }
  if (action === 'open-detail') {
    const requestId = actionNode.dataset.requestId
    if (!requestId) return true
    state.detailRequestId = requestId
    return true
  }
  if (action === 'close-detail') {
    state.detailRequestId = null
    return true
  }

  const requestId = actionNode.dataset.requestId
  if (!requestId) return false
  const request = getSampleUseRequestById(requestId)
  if (!request) return true

  if (action === 'submit-detail-request' && request.status === 'DRAFT') {
    updateRequestRecord(request.requestId, { status: 'SUBMITTED', submittedAt: nowText() }, buildRequestLog('提交申请', request.requesterName))
    state.notice = `${request.requestCode} 已提交审批。`
    return true
  }
  if (action === 'approve-request' && request.status === 'SUBMITTED') return applyApproveRequest(request)
  if (action === 'reject-request' && request.status === 'SUBMITTED') return applyRejectRequest(request)
  if (action === 'checkout-request' && request.status === 'APPROVED') return applyCheckoutRequest(request)
  if (action === 'request-return' && request.status === 'ACTIVE') return applyRequestReturn(request)
  if (action === 'confirm-return' && request.status === 'RETURNING') return applyConfirmReturn(request)
  if (action === 'cancel-request' && ['DRAFT', 'SUBMITTED', 'APPROVED'].includes(request.status)) return applyCancelRequest(request)

  return true
}

export function isPcsSampleApplicationDialogOpen(): boolean {
  return Boolean(state.detailRequestId || state.createDrawerOpen)
}

export function resetPcsSampleApplicationState(): void {
  state.notice = null
  state.filters = { search: '', status: 'all', site: 'all' }
  state.detailRequestId = null
  state.createDrawerOpen = false
  resetCreateDraft()
}
