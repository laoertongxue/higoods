import { ensurePcsProjectDemoDataReady } from '../data/pcs-project-demo-seed-service.ts'
import { appendSampleTransition } from '../data/pcs-sample-actions.ts'
import {
  ensurePcsSampleReturnDemoDataReady,
  getSampleReturnCaseById,
  listSampleReturnCases,
  type SampleDispositionResult,
  type SampleReturnCaseRecord,
  type SampleReturnCaseStatus,
  type SampleReturnCaseType,
  type SampleReturnReasonCategory,
  upsertSampleReturnCase,
} from '../data/pcs-sample-return-repository.ts'
import { ensurePcsSampleDemoDataReady } from '../data/pcs-sample-demo.ts'
import { getSampleAssetById, listSampleAssets } from '../data/pcs-sample-asset-repository.ts'
import { listProjects, listProjectNodes } from '../data/pcs-project-repository.ts'
import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'

type ReturnCaseStatusFilter = 'all' | SampleReturnCaseStatus
type ReturnCaseTypeFilter = 'all' | SampleReturnCaseType
type ReturnSiteFilter = 'all' | string
type ReturnReasonFilter = 'all' | SampleReturnReasonCategory

interface ReturnPageState {
  notice: string | null
  filters: {
    search: string
    type: ReturnCaseTypeFilter
    status: ReturnCaseStatusFilter
    site: ReturnSiteFilter
    reason: ReturnReasonFilter
  }
  detailCaseId: string | null
  createDrawerOpen: boolean
  createDraft: {
    caseType: SampleReturnCaseType
    sampleAssetId: string
    reasonCategory: SampleReturnReasonCategory
    reasonDetail: string
  }
}

const CASE_TYPE_LABEL: Record<SampleReturnCaseType, string> = {
  RETURN: '退货',
  DISPOSITION: '处置',
}

const STATUS_META: Record<SampleReturnCaseStatus, { label: string; className: string }> = {
  DRAFT: { label: '草稿', className: 'bg-slate-100 text-slate-700' },
  SUBMITTED: { label: '已提交', className: 'bg-blue-100 text-blue-700' },
  APPROVED: { label: '已批准', className: 'bg-violet-100 text-violet-700' },
  RETURNING: { label: '退货中', className: 'bg-amber-100 text-amber-700' },
  CONFIRMED: { label: '已确认', className: 'bg-cyan-100 text-cyan-700' },
  EXECUTING: { label: '执行中', className: 'bg-orange-100 text-orange-700' },
  CLOSED: { label: '已结案', className: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: '已驳回', className: 'bg-rose-100 text-rose-700' },
  CANCELLED: { label: '已取消', className: 'bg-slate-100 text-slate-500' },
}

const REASON_LABEL: Record<SampleReturnReasonCategory, string> = {
  QUALITY_FAIL: '质检不合格',
  DAMAGED: '破损',
  MISSING_PARTS: '缺件',
  WRONG_SIZE_COLOR: '错码错色',
  OVERDUE_RETURN: '超期未归还',
  INVENTORY_DIFF: '盘点差异',
  SUPPLIER_ISSUE: '供应商问题',
  OTHER: '其它',
}

const DISPOSITION_LABEL: Record<SampleDispositionResult, string> = {
  SCRAP: '报废 / 销毁',
  RETAIN: '留存归档',
  INTERNAL_USE: '转内部使用',
  DONATE: '捐赠',
  OTHER: '其它',
}

const state: ReturnPageState = {
  notice: null,
  filters: {
    search: '',
    type: 'all',
    status: 'all',
    site: 'all',
    reason: 'all',
  },
  detailCaseId: null,
  createDrawerOpen: false,
  createDraft: {
    caseType: 'RETURN',
    sampleAssetId: '',
    reasonCategory: 'QUALITY_FAIL',
    reasonDetail: '',
  },
}

function ensurePageDataReady(): void {
  ensurePcsProjectDemoDataReady()
  ensurePcsSampleDemoDataReady()
  ensurePcsSampleReturnDemoDataReady()
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

function compactToday(): string {
  return nowText().slice(0, 10).replaceAll('-', '')
}

function isOverdue(caseItem: SampleReturnCaseRecord): boolean {
  return ['SUBMITTED', 'APPROVED', 'RETURNING', 'EXECUTING'].includes(caseItem.caseStatus) && caseItem.slaDeadline.slice(0, 16) < nowText().slice(0, 16)
}

function getCases(): SampleReturnCaseRecord[] {
  ensurePageDataReady()
  return listSampleReturnCases()
}

function getFilteredCases(): SampleReturnCaseRecord[] {
  const keyword = state.filters.search.trim().toLowerCase()
  return getCases().filter((caseItem) => {
    if (keyword) {
      const haystack = [caseItem.caseCode, caseItem.sampleCode, caseItem.sampleName, caseItem.projectCode, caseItem.projectName].join(' ').toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    if (state.filters.type !== 'all' && caseItem.caseType !== state.filters.type) return false
    if (state.filters.status !== 'all' && caseItem.caseStatus !== state.filters.status) return false
    if (state.filters.site !== 'all' && caseItem.responsibleSite !== state.filters.site) return false
    if (state.filters.reason !== 'all' && caseItem.reasonCategory !== state.filters.reason) return false
    return true
  })
}

function buildCaseLog(caseItem: SampleReturnCaseRecord, action: string, operator: string, comment = '') {
  return {
    id: `log_${Date.now()}`,
    action,
    operator,
    time: nowText(),
    comment,
  }
}

function updateCaseRecord(caseId: string, patch: Partial<SampleReturnCaseRecord>, log: ReturnType<typeof buildCaseLog> | null): SampleReturnCaseRecord | null {
  const caseItem = getSampleReturnCaseById(caseId)
  if (!caseItem) return null
  const nextRecord: SampleReturnCaseRecord = {
    ...caseItem,
    ...patch,
    updatedAt: patch.updatedAt || nowText(),
    caseLogs: log ? [log, ...caseItem.caseLogs] : caseItem.caseLogs,
  }
  return upsertSampleReturnCase(nextRecord)
}

function createCase(): boolean {
  if (!state.createDraft.sampleAssetId) {
    state.notice = '请选择关联样衣。'
    return true
  }
  if (!state.createDraft.reasonDetail.trim()) {
    state.notice = '请填写详细原因。'
    return true
  }

  const sample = getSampleAssetById(state.createDraft.sampleAssetId)
  const project = sample?.projectId ? listProjects().find((item) => item.projectId === sample.projectId) || null : null
  const node = project ? listProjectNodes(project.projectId).find((item) => item.workItemTypeCode === 'SAMPLE_RETURN_HANDLE') || null : null
  const codePrefix = `RC-${compactToday()}-`
  const count = getCases().filter((item) => item.caseCode.startsWith(codePrefix)).length + 1
  const caseCode = `${codePrefix}${String(count).padStart(3, '0')}`
  const timestamp = nowText()

  upsertSampleReturnCase({
    caseId: `sample_return_case_${Date.now()}`,
    caseCode,
    caseType: state.createDraft.caseType,
    caseStatus: 'DRAFT',
    responsibleSite: sample?.responsibleSite || '深圳',
    sampleAssetId: sample?.sampleAssetId || '',
    sampleCode: sample?.sampleCode || '',
    sampleName: sample?.sampleName || '',
    inventoryStatusSnapshot: sample?.inventoryStatus || '',
    reasonCategory: state.createDraft.reasonCategory,
    reasonDetail: state.createDraft.reasonDetail.trim(),
    evidenceAttachments: [],
    projectId: project?.projectId || '',
    projectCode: project?.projectCode || '',
    projectName: project?.projectName || '',
    projectNodeId: node?.projectNodeId || '',
    workItemTypeCode: node?.workItemTypeCode || 'SAMPLE_RETURN_HANDLE',
    workItemName: node?.workItemTypeName || '样衣退货与处理',
    requesterRole: '样衣管理员',
    requesterName: '样衣管理员',
    handlerRole: '仓管',
    handlerName: `${sample?.responsibleSite || '深圳'}仓管`,
    returnTarget: state.createDraft.caseType === 'RETURN' ? '原供应商' : '',
    returnMethod: state.createDraft.caseType === 'RETURN' ? '快递' : '',
    trackingNo: '',
    dispositionResult: state.createDraft.caseType === 'DISPOSITION' ? 'SCRAP' : '',
    dispositionLocation: state.createDraft.caseType === 'DISPOSITION' ? `${sample?.responsibleSite || '深圳'}待报废区` : '',
    executor: '',
    priority: sample?.inventoryStatus === '待处置' ? 'HIGH' : 'MEDIUM',
    slaDeadline: `${timestamp.slice(0, 10)} 18:00:00`,
    createdAt: timestamp,
    updatedAt: timestamp,
    closedAt: '',
    caseLogs: [buildCaseLog({} as SampleReturnCaseRecord, '创建案件', '样衣管理员', '新建样衣退货 / 处理案件。')],
  })

  state.notice = `已创建案件 ${caseCode}。`
  state.createDrawerOpen = false
  state.createDraft = { caseType: 'RETURN', sampleAssetId: '', reasonCategory: 'QUALITY_FAIL', reasonDetail: '' }
  return true
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="font-medium">样衣退货与处理</p>
          <p class="mt-1">${escapeHtml(state.notice)}</p>
        </div>
        <button type="button" class="inline-flex h-7 items-center rounded-md px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-sample-return-action="close-notice">关闭</button>
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
          <h1 class="mt-1 text-2xl font-semibold text-slate-900">样衣退货与处理</h1>
          <p class="mt-1 text-sm text-slate-500">集中处理退货、异常处置和结案，确保样衣最终去向与库存状态一致。</p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-sample-return-action="open-create-drawer"><i data-lucide="plus" class="h-4 w-4"></i>新建案件</button>
          <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-return-action="refresh"><i data-lucide="refresh-cw" class="h-4 w-4"></i>刷新</button>
        </div>
      </div>
    </section>
  `
}

function renderSummary(): string {
  const cases = getFilteredCases()
  const total = cases.length
  const processing = cases.filter((item) => ['APPROVED', 'RETURNING', 'EXECUTING'].includes(item.caseStatus)).length
  const submitted = cases.filter((item) => item.caseStatus === 'SUBMITTED').length
  const closed = cases.filter((item) => item.caseStatus === 'CLOSED').length
  const overdue = cases.filter((item) => isOverdue(item)).length
  const disposition = cases.filter((item) => item.caseType === 'DISPOSITION').length
  const cards = [
    { label: '全部案件', value: total, helper: '退货和处置统一看板', tone: 'border-slate-200 bg-white text-slate-900' },
    { label: '待审批', value: submitted, helper: '待确认处理方案', tone: 'border-blue-200 bg-blue-50 text-blue-700' },
    { label: '处理中', value: processing, helper: '已进入退回或执行阶段', tone: 'border-orange-200 bg-orange-50 text-orange-700' },
    { label: '处置类', value: disposition, helper: '报废、留存或内部转用', tone: 'border-violet-200 bg-violet-50 text-violet-700' },
    { label: '超期未处理', value: overdue, helper: '已超过 SLA 截止时间', tone: 'border-rose-200 bg-rose-50 text-rose-700' },
    { label: '已结案', value: closed, helper: '样衣最终去向已明确', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
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
  const cases = getCases()
  const sites = Array.from(new Set(cases.map((item) => item.responsibleSite)))
  return `
    <section class="rounded-xl border bg-white px-6 py-5 shadow-sm">
      <div class="grid gap-4 xl:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))]">
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>搜索</span>
          <input type="search" class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" placeholder="案件编号 / 样衣编号 / 样衣名称" value="${escapeHtml(state.filters.search)}" data-pcs-sample-return-field="search" />
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>案件类型</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-sample-return-field="type">
            <option value="all">全部类型</option>
            <option value="RETURN" ${state.filters.type === 'RETURN' ? 'selected' : ''}>退货</option>
            <option value="DISPOSITION" ${state.filters.type === 'DISPOSITION' ? 'selected' : ''}>处置</option>
          </select>
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>案件状态</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-sample-return-field="status">
            <option value="all">全部状态</option>
            ${Object.entries(STATUS_META)
              .map(([key, meta]) => `<option value="${escapeHtml(key)}" ${state.filters.status === key ? 'selected' : ''}>${escapeHtml(meta.label)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>责任站点</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-sample-return-field="site">
            <option value="all">全部站点</option>
            ${sites.map((site) => `<option value="${escapeHtml(site)}" ${state.filters.site === site ? 'selected' : ''}>${escapeHtml(site)}</option>`).join('')}
          </select>
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>原因分类</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-sample-return-field="reason">
            <option value="all">全部原因</option>
            ${Object.entries(REASON_LABEL).map(([key, label]) => `<option value="${escapeHtml(key)}" ${state.filters.reason === key ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
          </select>
        </label>
        <div class="flex items-end justify-end gap-3">
          <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-return-action="reset">重置</button>
        </div>
      </div>
    </section>
  `
}

function renderTable(): string {
  const cases = getFilteredCases()
  return `
    <section class="rounded-xl border bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-3">案件编号</th>
              <th class="px-4 py-3">样衣</th>
              <th class="px-4 py-3">快照状态</th>
              <th class="px-4 py-3">类型 / 状态</th>
              <th class="px-4 py-3">项目 / 工作项</th>
              <th class="px-4 py-3">SLA</th>
              <th class="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${
              cases.length === 0
                ? '<tr><td colspan="7" class="px-4 py-12 text-center text-sm text-slate-500">当前筛选条件下暂无退货与处理案件。</td></tr>'
                : cases
                    .map(
                      (caseItem) => `
                        <tr class="hover:bg-slate-50/80">
                          <td class="px-4 py-3 align-top">
                            <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-pcs-sample-return-action="open-detail" data-case-id="${escapeHtml(caseItem.caseId)}">${escapeHtml(caseItem.caseCode)}</button>
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(caseItem.responsibleSite)}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <p class="font-medium text-slate-900">${escapeHtml(caseItem.sampleCode)}</p>
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(caseItem.sampleName)}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <span class="inline-flex rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600">${escapeHtml(caseItem.inventoryStatusSnapshot || '-')}</span>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <p class="text-slate-900">${escapeHtml(CASE_TYPE_LABEL[caseItem.caseType])}</p>
                            <span class="${escapeHtml(toClassName('mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_META[caseItem.caseStatus].className))}">${escapeHtml(STATUS_META[caseItem.caseStatus].label)}</span>
                          </td>
                          <td class="px-4 py-3 align-top">
                            ${caseItem.projectId ? `<button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(caseItem.projectId)}">${escapeHtml(caseItem.projectCode || caseItem.projectName)}</button>` : '<p class="text-slate-500">未绑定项目</p>'}
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(caseItem.workItemName || '-')}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <p class="text-slate-900">${escapeHtml(formatDateTime(caseItem.slaDeadline))}</p>
                            ${isOverdue(caseItem) ? '<p class="mt-1 text-xs text-rose-600">已超期</p>' : '<p class="mt-1 text-xs text-slate-400">-</p>'}
                          </td>
                          <td class="px-4 py-3 align-top text-right">
                            <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-sample-return-action="open-detail" data-case-id="${escapeHtml(caseItem.caseId)}">查看详情</button>
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
      <button type="button" class="absolute inset-0 bg-slate-900/35" data-pcs-sample-return-action="${escapeHtml(closeAction)}"></button>
      <section class="relative flex h-full w-full max-w-4xl flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div class="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p class="text-xs text-slate-500">样衣退货与处理</p>
            <h2 class="mt-1 text-lg font-semibold text-slate-900">${escapeHtml(title)}</h2>
          </div>
          <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-return-action="${escapeHtml(closeAction)}">关闭</button>
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-5">${body}</div>
      </section>
    </div>
  `
}

function renderDetailDrawer(): string {
  if (!state.detailCaseId) return ''
  const caseItem = getSampleReturnCaseById(state.detailCaseId)
  if (!caseItem) return ''
  const sample = getSampleAssetById(caseItem.sampleAssetId)

  const actions: string[] = []
  if (caseItem.caseStatus === 'DRAFT') {
    actions.push(`<button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-sample-return-action="submit-case" data-case-id="${escapeHtml(caseItem.caseId)}">提交审批</button>`)
  }
  if (caseItem.caseStatus === 'SUBMITTED') {
    actions.push(`<button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-sample-return-action="approve-case" data-case-id="${escapeHtml(caseItem.caseId)}">审批通过</button>`)
    actions.push(`<button type="button" class="inline-flex h-9 items-center rounded-md border border-rose-200 bg-white px-4 text-sm text-rose-700 hover:bg-rose-50" data-pcs-sample-return-action="reject-case" data-case-id="${escapeHtml(caseItem.caseId)}">驳回</button>`)
  }
  if (caseItem.caseStatus === 'APPROVED' && caseItem.caseType === 'RETURN') {
    actions.push(`<button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-sample-return-action="execute-return" data-case-id="${escapeHtml(caseItem.caseId)}">执行退回</button>`)
  }
  if (caseItem.caseStatus === 'APPROVED' && caseItem.caseType === 'DISPOSITION') {
    actions.push(`<button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-sample-return-action="execute-disposition" data-case-id="${escapeHtml(caseItem.caseId)}">开始处置</button>`)
  }
  if (caseItem.caseStatus === 'RETURNING') {
    actions.push(`<button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-sample-return-action="confirm-return" data-case-id="${escapeHtml(caseItem.caseId)}">确认签收</button>`)
  }
  if (['CONFIRMED', 'EXECUTING', 'APPROVED'].includes(caseItem.caseStatus)) {
    actions.push(`<button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-return-action="close-case" data-case-id="${escapeHtml(caseItem.caseId)}">确认结案</button>`)
  }
  if (!['CLOSED', 'REJECTED', 'CANCELLED'].includes(caseItem.caseStatus)) {
    actions.push(`<button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-return-action="cancel-case" data-case-id="${escapeHtml(caseItem.caseId)}">取消案件</button>`)
  }

  const body = `
    <div class="space-y-6">
      <section class="rounded-lg border bg-slate-50 p-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="inline-flex rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600">${escapeHtml(CASE_TYPE_LABEL[caseItem.caseType])}</span>
          <span class="${escapeHtml(toClassName('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_META[caseItem.caseStatus].className))}">${escapeHtml(STATUS_META[caseItem.caseStatus].label)}</span>
          <span class="inline-flex rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">${escapeHtml(caseItem.responsibleSite)}</span>
        </div>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p class="text-xs text-slate-500">案件编号</p>
            <p class="mt-1 font-medium text-slate-900">${escapeHtml(caseItem.caseCode)}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">SLA 截止</p>
            <p class="mt-1 text-slate-900">${escapeHtml(caseItem.slaDeadline)}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">样衣编号</p>
            <p class="mt-1 font-medium text-slate-900">${escapeHtml(caseItem.sampleCode)}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">样衣名称</p>
            <p class="mt-1 text-slate-900">${escapeHtml(caseItem.sampleName)}</p>
          </div>
        </div>
      </section>

      <section class="grid gap-4 md:grid-cols-2">
        <div class="rounded-lg border bg-white p-4">
          <p class="text-sm font-medium text-slate-900">样衣快照</p>
          <div class="mt-3 space-y-2 text-sm">
            <p><span class="text-slate-500">库存状态：</span>${escapeHtml(caseItem.inventoryStatusSnapshot || '-')}</p>
            <p><span class="text-slate-500">当前位置：</span>${escapeHtml(sample?.locationDisplay || '-')}</p>
            <p><span class="text-slate-500">当前保管：</span>${escapeHtml(sample?.custodianName || '-')}</p>
          </div>
        </div>
        <div class="rounded-lg border bg-white p-4">
          <p class="text-sm font-medium text-slate-900">业务关联</p>
          <div class="mt-3 space-y-2 text-sm">
            <p><span class="text-slate-500">项目：</span>${caseItem.projectId ? `<button type="button" class="text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(caseItem.projectId)}">${escapeHtml(caseItem.projectCode || caseItem.projectName)}</button>` : '未绑定'}</p>
            <p><span class="text-slate-500">工作项：</span>${caseItem.projectId && caseItem.projectNodeId ? `<button type="button" class="text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(caseItem.projectId)}/work-items/${escapeHtml(caseItem.projectNodeId)}">${escapeHtml(caseItem.workItemName || '-')}</button>` : escapeHtml(caseItem.workItemName || '-')}</p>
            <p><span class="text-slate-500">发起人：</span>${escapeHtml(caseItem.requesterName)} / ${escapeHtml(caseItem.requesterRole)}</p>
          </div>
        </div>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <p class="text-sm font-medium text-slate-900">处理原因</p>
        <div class="mt-3 space-y-2 text-sm">
          <p><span class="text-slate-500">原因分类：</span>${escapeHtml(REASON_LABEL[caseItem.reasonCategory])}</p>
          <p><span class="text-slate-500">详细说明：</span>${escapeHtml(caseItem.reasonDetail || '-')}</p>
          <p><span class="text-slate-500">证据附件：</span>${escapeHtml(caseItem.evidenceAttachments.join('、') || '-')}</p>
        </div>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <p class="text-sm font-medium text-slate-900">处理方案</p>
        <div class="mt-3 space-y-2 text-sm">
          <p><span class="text-slate-500">退回目标：</span>${escapeHtml(caseItem.returnTarget || '-')}</p>
          <p><span class="text-slate-500">退回方式：</span>${escapeHtml(caseItem.returnMethod || '-')}</p>
          <p><span class="text-slate-500">运单号：</span>${escapeHtml(caseItem.trackingNo || '-')}</p>
          <p><span class="text-slate-500">处置结果：</span>${escapeHtml(caseItem.dispositionResult ? DISPOSITION_LABEL[caseItem.dispositionResult] : '-')}</p>
          <p><span class="text-slate-500">处置位置：</span>${escapeHtml(caseItem.dispositionLocation || '-')}</p>
        </div>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-slate-900">操作</p>
            <p class="mt-1 text-xs text-slate-500">退回会写在途和已退货，处置会写已处置并同步库存状态。</p>
          </div>
          <div class="flex flex-wrap gap-3">${actions.join('')}</div>
        </div>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <p class="text-sm font-medium text-slate-900">案件日志</p>
        <div class="mt-4 space-y-3">
          ${caseItem.caseLogs
            .map(
              (log) => `
                <div class="rounded-lg border border-slate-200 p-3">
                  <div class="flex items-center justify-between gap-3">
                    <p class="text-sm font-medium text-slate-900">${escapeHtml(log.action)}</p>
                    <p class="text-xs text-slate-500">${escapeHtml(formatDateTime(log.time))}</p>
                  </div>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(log.operator)}${log.comment ? ` · ${escapeHtml(log.comment)}` : ''}</p>
                </div>
              `,
            )
            .join('')}
        </div>
      </section>
    </div>
  `

  return renderDrawerShell(`${caseItem.caseCode} · ${STATUS_META[caseItem.caseStatus].label}`, body, 'close-detail')
}

function renderCreateDrawer(): string {
  if (!state.createDrawerOpen) return ''
  const samples = listSampleAssets()
  const body = `
    <div class="space-y-6">
      <section class="grid gap-4 md:grid-cols-2">
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>案件类型</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-sample-return-field="create-case-type">
            <option value="RETURN" ${state.createDraft.caseType === 'RETURN' ? 'selected' : ''}>退货</option>
            <option value="DISPOSITION" ${state.createDraft.caseType === 'DISPOSITION' ? 'selected' : ''}>处置</option>
          </select>
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>关联样衣</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-sample-return-field="create-sample">
            <option value="">请选择样衣</option>
            ${samples
              .map(
                (sample) => `<option value="${escapeHtml(sample.sampleAssetId)}" ${state.createDraft.sampleAssetId === sample.sampleAssetId ? 'selected' : ''}>${escapeHtml(sample.sampleCode)} · ${escapeHtml(sample.sampleName)} · ${escapeHtml(sample.inventoryStatus)}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600 md:col-span-2">
          <span>原因分类</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-sample-return-field="create-reason">
            ${Object.entries(REASON_LABEL).map(([key, label]) => `<option value="${escapeHtml(key)}" ${state.createDraft.reasonCategory === key ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
          </select>
        </label>
      </section>
      <label class="flex flex-col gap-2 text-sm text-slate-600">
        <span>详细原因</span>
        <textarea class="min-h-[120px] rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" placeholder="请描述详细原因..." data-pcs-sample-return-field="create-detail">${escapeHtml(state.createDraft.reasonDetail)}</textarea>
      </label>
      <div class="flex justify-end gap-3">
        <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-return-action="close-create-drawer">取消</button>
        <button type="button" class="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-sample-return-action="create-case">创建案件</button>
      </div>
    </div>
  `

  return renderDrawerShell('新建退货与处理案件', body, 'close-create-drawer')
}

export function renderPcsSampleReturnPage(): string {
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

export function handlePcsSampleReturnInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-sample-return-field]')
  if (!fieldNode) return false
  const field = fieldNode.dataset.pcsSampleReturnField
  if (!field) return false

  if (field === 'search' && fieldNode instanceof HTMLInputElement) {
    state.filters.search = fieldNode.value
    return true
  }
  if (fieldNode instanceof HTMLSelectElement) {
    if (field === 'type') state.filters.type = fieldNode.value as ReturnCaseTypeFilter
    if (field === 'status') state.filters.status = fieldNode.value as ReturnCaseStatusFilter
    if (field === 'site') state.filters.site = fieldNode.value
    if (field === 'reason') state.filters.reason = fieldNode.value as ReturnReasonFilter
    if (field === 'create-case-type') state.createDraft.caseType = fieldNode.value as SampleReturnCaseType
    if (field === 'create-sample') state.createDraft.sampleAssetId = fieldNode.value
    if (field === 'create-reason') state.createDraft.reasonCategory = fieldNode.value as SampleReturnReasonCategory
    return true
  }
  if (field === 'create-detail' && fieldNode instanceof HTMLTextAreaElement) {
    state.createDraft.reasonDetail = fieldNode.value
    return true
  }
  return false
}

function handleApproveCase(caseItem: SampleReturnCaseRecord): boolean {
  updateCaseRecord(caseItem.caseId, { caseStatus: 'APPROVED' }, buildCaseLog(caseItem, '审批通过', '样衣管理员', '已确认进入处理。'))
  state.notice = `${caseItem.caseCode} 已审批通过。`
  return true
}

function handleRejectCase(caseItem: SampleReturnCaseRecord): boolean {
  updateCaseRecord(caseItem.caseId, { caseStatus: 'REJECTED' }, buildCaseLog(caseItem, '驳回申请', '样衣管理员', '当前不满足退回或处置条件。'))
  state.notice = `${caseItem.caseCode} 已驳回。`
  return true
}

function handleExecuteReturn(caseItem: SampleReturnCaseRecord): boolean {
  const sample = getSampleAssetById(caseItem.sampleAssetId)
  if (sample) {
    appendSampleTransition({
      sampleAssetId: sample.sampleAssetId,
      eventType: 'SHIP_OUT',
      inventoryStatusAfter: '在途待签收',
      availabilityAfter: '不可用',
      locationType: '在途',
      locationDisplay: `${caseItem.responsibleSite}退回在途`,
      custodianType: '系统',
      custodianName: '物流在途',
      operatorName: '样衣管理员',
      note: `退货案件 ${caseItem.caseCode} 已执行退回，等待签收。`,
      sourceModule: '样衣退货与处理',
      sourceDocType: '样衣退回单',
      sourceDocCode: caseItem.caseCode,
      sourceDocId: caseItem.caseId,
    })
  }
  updateCaseRecord(
    caseItem.caseId,
    {
      caseStatus: 'RETURNING',
      trackingNo: caseItem.trackingNo || `RET-${compactToday()}-${String(Date.now()).slice(-4)}`,
    },
    buildCaseLog(caseItem, '执行退回', '样衣管理员', '已寄出等待签收。'),
  )
  state.notice = `${caseItem.caseCode} 已进入退货中。`
  return true
}

function handleConfirmReturn(caseItem: SampleReturnCaseRecord): boolean {
  const sample = getSampleAssetById(caseItem.sampleAssetId)
  if (sample) {
    appendSampleTransition({
      sampleAssetId: sample.sampleAssetId,
      eventType: 'RETURN_SUPPLIER',
      inventoryStatusAfter: '已退货',
      availabilityAfter: '不可用',
      locationType: '外部保管',
      locationDisplay: caseItem.returnTarget || '原供应商',
      custodianType: '外部主体',
      custodianName: caseItem.returnTarget || '原供应商',
      operatorName: '样衣管理员',
      note: `退货案件 ${caseItem.caseCode} 已确认签收。`,
      sourceModule: '样衣退货与处理',
      sourceDocType: '样衣退回单',
      sourceDocCode: caseItem.caseCode,
      sourceDocId: caseItem.caseId,
    })
  }
  updateCaseRecord(caseItem.caseId, { caseStatus: 'CONFIRMED' }, buildCaseLog(caseItem, '确认签收', '样衣管理员'))
  state.notice = `${caseItem.caseCode} 已确认退货签收。`
  return true
}

function handleExecuteDisposition(caseItem: SampleReturnCaseRecord): boolean {
  updateCaseRecord(caseItem.caseId, { caseStatus: 'EXECUTING', executor: '样衣管理员' }, buildCaseLog(caseItem, '执行处置', '样衣管理员'))
  state.notice = `${caseItem.caseCode} 已进入执行中。`
  return true
}

function handleCloseCase(caseItem: SampleReturnCaseRecord): boolean {
  const sample = getSampleAssetById(caseItem.sampleAssetId)
  if (caseItem.caseType === 'DISPOSITION' && sample) {
    appendSampleTransition({
      sampleAssetId: sample.sampleAssetId,
      eventType: 'DISPOSAL',
      inventoryStatusAfter: '已处置',
      availabilityAfter: '不可用',
      locationType: '处置区',
      locationDisplay: caseItem.dispositionLocation || `${caseItem.responsibleSite}处置区`,
      custodianType: '仓管',
      custodianName: `${caseItem.responsibleSite}仓管`,
      operatorName: '样衣管理员',
      note: `处置案件 ${caseItem.caseCode} 已结案。`,
      sourceModule: '样衣退货与处理',
      sourceDocType: '样衣处置单',
      sourceDocCode: caseItem.caseCode,
      sourceDocId: caseItem.caseId,
    })
  }
  updateCaseRecord(caseItem.caseId, { caseStatus: 'CLOSED', closedAt: nowText() }, buildCaseLog(caseItem, '结案确认', '样衣管理员'))
  state.notice = `${caseItem.caseCode} 已结案。`
  return true
}

function handleCancelCase(caseItem: SampleReturnCaseRecord): boolean {
  updateCaseRecord(caseItem.caseId, { caseStatus: 'CANCELLED' }, buildCaseLog(caseItem, '取消案件', '样衣管理员'))
  state.notice = `${caseItem.caseCode} 已取消。`
  return true
}

export function handlePcsSampleReturnEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pcs-sample-return-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsSampleReturnAction
  if (!action) return false

  if (action === 'close-notice') {
    state.notice = null
    return true
  }
  if (action === 'refresh') {
    ensurePageDataReady()
    state.notice = '已刷新退货与处理案件。'
    return true
  }
  if (action === 'reset') {
    state.filters = { search: '', type: 'all', status: 'all', site: 'all', reason: 'all' }
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
  if (action === 'create-case') return createCase()
  if (action === 'open-detail') {
    const caseId = actionNode.dataset.caseId
    if (!caseId) return true
    state.detailCaseId = caseId
    return true
  }
  if (action === 'close-detail') {
    state.detailCaseId = null
    return true
  }

  const caseId = actionNode.dataset.caseId
  if (!caseId) return false
  const caseItem = getSampleReturnCaseById(caseId)
  if (!caseItem) return true

  if (action === 'submit-case' && caseItem.caseStatus === 'DRAFT') {
    updateCaseRecord(caseItem.caseId, { caseStatus: 'SUBMITTED' }, buildCaseLog(caseItem, '提交审批', '样衣管理员'))
    state.notice = `${caseItem.caseCode} 已提交审批。`
    return true
  }
  if (action === 'approve-case' && caseItem.caseStatus === 'SUBMITTED') return handleApproveCase(caseItem)
  if (action === 'reject-case' && caseItem.caseStatus === 'SUBMITTED') return handleRejectCase(caseItem)
  if (action === 'execute-return' && caseItem.caseStatus === 'APPROVED' && caseItem.caseType === 'RETURN') return handleExecuteReturn(caseItem)
  if (action === 'confirm-return' && caseItem.caseStatus === 'RETURNING') return handleConfirmReturn(caseItem)
  if (action === 'execute-disposition' && caseItem.caseStatus === 'APPROVED' && caseItem.caseType === 'DISPOSITION') return handleExecuteDisposition(caseItem)
  if (action === 'close-case' && ['APPROVED', 'CONFIRMED', 'EXECUTING'].includes(caseItem.caseStatus)) return handleCloseCase(caseItem)
  if (action === 'cancel-case' && !['CLOSED', 'REJECTED', 'CANCELLED'].includes(caseItem.caseStatus)) return handleCancelCase(caseItem)

  return true
}

export function isPcsSampleReturnDialogOpen(): boolean {
  return Boolean(state.detailCaseId || state.createDrawerOpen)
}

export function resetPcsSampleReturnState(): void {
  state.notice = null
  state.filters = { search: '', type: 'all', status: 'all', site: 'all', reason: 'all' }
  state.detailCaseId = null
  state.createDrawerOpen = false
  state.createDraft = { caseType: 'RETURN', sampleAssetId: '', reasonCategory: 'QUALITY_FAIL', reasonDetail: '' }
}
