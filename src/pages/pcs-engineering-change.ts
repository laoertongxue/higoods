// @page-pattern: list
// 工程变更：关闭后的款式修改独立成单，原主单和原正式技术包保持只读。
import { listEngineeringMasterOrders } from '../data/pcs-engineering-master-repository'
import { getCurrentTechPackVersionByStyleId } from '../data/pcs-technical-data-version-repository'
import {
  completeEngineeringChangeTaskLine,
  createEngineeringChangeTechPackDraft,
  createEngineeringChangeWorkspace,
  getEngineeringChangeWorkspaceView,
  listEngineeringChangeWorkspaceViews,
  startEngineeringChangeTaskLine,
} from '../data/pcs-engineering-change-workspace'
import type { TechnicalModuleKey } from '../data/pcs-technical-data-version-types'
import { CURRENT_PCS_ENGINEERING_USER } from '../data/pcs-engineering-current-user'
import { getStyleArchiveById } from '../data/pcs-style-archive-repository'
import { ensureEngineeringMasterDemoData } from '../data/pcs-engineering-master-view-model'
import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page'
import { renderStandardListTable, type StandardListColumn } from '../components/ui/list-table'
import { paginateStandardListRows, type StandardListColumnPreferences } from '../components/ui/list-table-model'
import { renderTablePagination } from '../components/ui/pagination'
import { escapeHtml } from '../utils'

const LIST_PATH = '/pcs/engineering/changes'
const changeListState = { currentPage: 1, pageSize: 10 }
let changeImagePreview: { url: string; title: string } | null = null
const createDraft = {
  sourceMasterOrderId: '',
  changeReason: '',
  affectedModules: new Set<TechnicalModuleKey>(),
}

const MODULE_OPTIONS: Array<{ key: TechnicalModuleKey; label: string }> = [
  { key: 'BOM', label: 'BOM 与价格' },
  { key: 'PATTERN', label: '纸样' },
  { key: 'MATERIAL_PATTERN_LINK', label: '花型' },
  { key: 'COLOR_MATERIAL_MAPPING', label: '颜色与调色' },
  { key: 'PROCESS', label: '工艺' },
  { key: 'SIZE', label: '尺码' },
  { key: 'DESIGN', label: '设计资料' },
  { key: 'ATTACHMENT', label: '附件' },
  { key: 'QUALITY', label: '质量要求' },
]

function renderHeader(title: string, extra = ''): string {
  return `<div class="flex flex-wrap items-center justify-between gap-3"><div><h1 class="text-xl font-semibold text-slate-900">${escapeHtml(title)}</h1><p class="mt-1 text-sm text-slate-500">关闭后修改独立成单，并生成下一版技术包。</p></div>${extra}</div>`
}

type EngineeringChangeRow = ReturnType<typeof listEngineeringChangeWorkspaceViews>[number] & { imageUrl: string }

const changeColumns: StandardListColumn<EngineeringChangeRow>[] = [
  { key: 'code', title: '变更编号', width: 150, required: true, freezeable: true, render: ({ change }) => `<span class="font-medium text-blue-700">${escapeHtml(change.engineeringChangeTaskCode)}</span>` },
  { key: 'style', title: '目标款式', width: 280, required: true, freezeable: true, render: ({ change, imageUrl }) => `<div class="flex items-center gap-3">${imageUrl ? `<button type="button" class="h-12 w-12 overflow-hidden rounded border" aria-label="查看${escapeHtml(change.styleName)}大图" data-engineering-change-action="open-image-preview" data-image-preview-url="${escapeHtml(imageUrl)}" data-image-preview-title="${escapeHtml(change.styleName)}"><img class="h-full w-full object-cover" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(change.styleName)}"><span hidden>图片加载失败</span></button>` : '<span class="flex h-12 w-12 items-center justify-center rounded border text-[10px] text-slate-400">暂无图片</span>'}<div><p class="font-medium text-slate-900">${escapeHtml(change.styleName)}</p><p class="text-xs text-slate-500">${escapeHtml(change.styleCode)}</p></div></div>` },
  { key: 'master', title: '来源主单', width: 150, render: ({ change }) => escapeHtml(change.sourceMasterOrderCode) },
  { key: 'techPack', title: '当前正式技术包', width: 150, render: ({ workspace }) => escapeHtml(workspace.currentTechnicalVersionCode) },
  { key: 'scope', title: '变更范围', width: 260, render: ({ workspace }) => escapeHtml(workspace.affectedModules.map((key) => MODULE_OPTIONS.find((item) => item.key === key)?.label || key).join('、')) },
  { key: 'owner', title: '负责人', width: 120, render: ({ workspace }) => escapeHtml(workspace.ownerName) },
  { key: 'progress', title: '进度', width: 90, render: ({ workspace }) => `${workspace.taskLines.filter((line) => line.status === '已完成').length}/${workspace.taskLines.length}` },
  { key: 'status', title: '状态／新技术包', width: 150, render: ({ workspace, effectiveStatus }) => `<p>${escapeHtml(effectiveStatus)}</p><p class="text-xs text-slate-500">${escapeHtml(workspace.newTechnicalVersionCode || '-')}</p>` },
  { key: 'actions', title: '操作', width: 100, required: true, actionColumn: true, render: ({ change }) => `<button type="button" class="h-8 rounded-md border border-slate-200 px-3 text-xs" data-nav="${LIST_PATH}/${escapeHtml(change.engineeringChangeTaskId)}">查看详情</button>` },
]

const changePreferences: StandardListColumnPreferences = {
  order: changeColumns.map((column) => column.key),
  visibleKeys: changeColumns.map((column) => column.key),
  frozenKeys: ['code', 'style'],
  pageSize: 10,
}

function renderEngineeringChangeImagePreview(): string {
  if (!changeImagePreview) return ''
  return `<div class="fixed inset-0 z-[100] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="${escapeHtml(changeImagePreview.title)}大图预览">
    <button type="button" class="absolute inset-0 bg-slate-950/70" data-engineering-change-action="close-image-preview" aria-label="关闭大图预览"></button>
    <div class="relative z-10 flex max-h-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
      <div class="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3"><p class="font-medium text-slate-900">${escapeHtml(changeImagePreview.title)}</p><button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200" data-engineering-change-action="close-image-preview" aria-label="关闭大图预览">×</button></div>
      <div class="flex min-h-0 items-center justify-center bg-slate-100 p-4"><img class="max-h-[calc(100vh-9rem)] max-w-full object-contain" src="${escapeHtml(changeImagePreview.url)}" alt="${escapeHtml(changeImagePreview.title)}高清大图"><span class="hidden text-sm text-red-600">图片加载失败，请稍后重试。</span></div>
    </div>
  </div>`
}

function updateEngineeringChangeImagePreview(): void {
  const host = document.querySelector<HTMLElement>('[data-engineering-change-region="image-preview"]')
  if (host) host.innerHTML = renderEngineeringChangeImagePreview()
}

export function renderPcsEngineeringChangeListPage(): string {
  ensureEngineeringMasterDemoData()
  const rows: EngineeringChangeRow[] = listEngineeringChangeWorkspaceViews().map((row) => ({
    ...row,
    imageUrl: getStyleArchiveById(row.change.styleId)?.mainImageUrl || '',
  }))
  const paging = paginateStandardListRows(rows, changeListState.currentPage, changeListState.pageSize)
  changeListState.currentPage = paging.currentPage
  changePreferences.pageSize = changeListState.pageSize
  return `<div data-engineering-change-list>${renderStandardListPage({
    title: '工程变更',
    primaryActionsHtml: `<button type="button" class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-nav="${LIST_PATH}/new">新建工程变更</button>`,
    statsHtml: renderStandardListStats([
      { label: '变更总数', value: rows.length },
      { label: '进行中', value: rows.filter((row) => row.effectiveStatus === '进行中').length },
      { label: '已完成', value: rows.filter((row) => row.effectiveStatus === '已完成').length },
    ]),
    listTitle: '工程变更列表',
    tableHtml: renderStandardListTable({ columns: changeColumns, rows: paging.rows, preferences: changePreferences, sort: null, eventPrefix: 'engineering-change', emptyText: '暂无工程变更' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: 'engineering-change', pageSizeOptions: [10, 20, 50] }),
  })}<div data-engineering-change-region="image-preview">${renderEngineeringChangeImagePreview()}</div></div>`
}

export function isPcsEngineeringChangeDialogOpen(): boolean {
  return Boolean(changeImagePreview)
}

export function renderPcsEngineeringChangeCreatePage(): string {
  const masters = listEngineeringMasterOrders().filter((master) => master.status === '已关闭')
  return `<div class="space-y-5 p-4" data-engineering-change-create>
    ${renderHeader('新建工程变更', `<button type="button" class="h-10 rounded-md border border-slate-200 bg-white px-4 text-sm" data-nav="${LIST_PATH}">返回列表</button>`)}
    <section class="rounded-lg border border-slate-200 bg-white p-5"><div data-engineering-change-feedback class="mb-4 hidden rounded-md px-3 py-2 text-sm" role="alert"></div><div class="grid gap-4 md:grid-cols-2">
      <label class="text-sm text-slate-600">来源工程主单<select class="mt-1 h-10 w-full rounded-md border border-slate-200 px-3" data-engineering-change-field="sourceMasterOrderId"><option value="">请选择已关闭工程主单</option>${masters.map((master) => { const tech = getCurrentTechPackVersionByStyleId(master.styleId); return `<option value="${escapeHtml(master.masterOrderId)}" ${createDraft.sourceMasterOrderId === master.masterOrderId ? 'selected' : ''}>${escapeHtml(master.masterOrderCode)} · ${escapeHtml(master.styleCode)} · ${escapeHtml(tech?.technicalVersionCode || '无生效技术包')}</option>` }).join('')}</select></label>
      <label class="text-sm text-slate-600">负责人<input class="mt-1 h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3" value="${escapeHtml(CURRENT_PCS_ENGINEERING_USER.userName)}（当前登录跟单）" readonly></label>
      <label class="text-sm text-slate-600">创建人<input class="mt-1 h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3" value="${escapeHtml(CURRENT_PCS_ENGINEERING_USER.userName)}" readonly></label>
      <label class="text-sm text-slate-600 md:col-span-2">变更原因<textarea class="mt-1 min-h-24 w-full rounded-md border border-slate-200 px-3 py-2" data-engineering-change-field="changeReason">${escapeHtml(createDraft.changeReason)}</textarea></label>
      <fieldset class="md:col-span-2"><legend class="text-sm text-slate-600">受影响资料</legend><div class="mt-2 grid gap-2 sm:grid-cols-3">${MODULE_OPTIONS.map((item) => `<label class="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" value="${item.key}" data-engineering-change-module ${createDraft.affectedModules.has(item.key) ? 'checked' : ''}>${escapeHtml(item.label)}</label>`).join('')}</div></fieldset>
    </div><div class="mt-5 flex justify-end"><button type="button" class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-engineering-change-action="create">创建工程变更</button></div></section>
  </div>`
}

export function renderPcsEngineeringChangeDetailPage(changeId: string): string {
  const view = getEngineeringChangeWorkspaceView(changeId)
  if (!view) return `<div class="p-4">${renderHeader('未找到工程变更', `<button type="button" data-nav="${LIST_PATH}">返回列表</button>`)}</div>`
  const { change, workspace, allTasksCompleted } = view
  return `<div class="space-y-5 p-4" data-engineering-change-detail="${escapeHtml(changeId)}">
    ${renderHeader(`${change.title} · ${change.engineeringChangeTaskCode}`, `<button type="button" class="h-10 rounded-md border border-slate-200 bg-white px-4 text-sm" data-nav="${LIST_PATH}">返回列表</button>`)}
    <section class="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-4"><div><p class="text-xs text-slate-500">目标 SPU</p><p class="mt-1 font-medium">${escapeHtml(change.styleCode)}</p></div><div><p class="text-xs text-slate-500">来源工程主单</p><p class="mt-1 font-medium">${escapeHtml(change.sourceMasterOrderCode)} · ${escapeHtml(view.sourceMasterStatus)}</p></div><div><p class="text-xs text-slate-500">当前正式技术包</p><p class="mt-1 font-medium">${escapeHtml(workspace.currentTechnicalVersionCode)}</p></div><div><p class="text-xs text-slate-500">负责人</p><p class="mt-1 font-medium">${escapeHtml(workspace.ownerName)}</p></div><div class="md:col-span-4"><p class="text-xs text-slate-500">变更原因</p><p class="mt-1 text-sm">${escapeHtml(workspace.changeReason)}</p></div></section>
    <section class="overflow-hidden rounded-lg border border-slate-200 bg-white"><div class="border-b border-slate-100 px-5 py-4"><h2 class="font-semibold">专业任务</h2></div><div class="divide-y divide-slate-100">${workspace.taskLines.map((line) => `<div class="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p class="font-medium">${escapeHtml(line.taskName)}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(line.ownerName)} · ${line.status}${line.startedAt ? ` · 开始 ${escapeHtml(line.startedAt)}` : ''}${line.completedAt ? ` · 完成 ${escapeHtml(line.completedAt)}` : ''}</p>${line.resultSummary ? `<p class="mt-2 text-sm text-slate-700">${escapeHtml(line.resultSummary)}</p>` : ''}</div>${line.status === '已完成' ? '<span class="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">已完成</span>' : line.status === '待开始' ? `<button type="button" class="h-9 rounded-md border border-blue-200 px-3 text-sm text-blue-700" data-engineering-change-action="start-line" data-change-id="${escapeHtml(changeId)}" data-line-id="${escapeHtml(line.lineId)}">开始任务</button>` : `<button type="button" class="h-9 rounded-md border border-blue-200 px-3 text-sm text-blue-700" data-engineering-change-action="complete-line" data-change-id="${escapeHtml(changeId)}" data-line-id="${escapeHtml(line.lineId)}">提交成果并完成</button>`}</div>`).join('')}</div></section>
    <section class="rounded-lg border border-slate-200 bg-white p-5"><h2 class="font-semibold">新技术包版本</h2><p class="mt-2 text-sm text-slate-600">${workspace.newTechnicalVersionCode ? `已生成 ${escapeHtml(workspace.newTechnicalVersionCode)}，后续沿用现行技术包审核与发布流程。` : allTasksCompleted ? '专业任务均已完成，可以生成下一版技术包草稿。' : '完成全部专业任务后生成下一版技术包草稿。'}</p>${workspace.newTechnicalVersionId ? `<button type="button" class="mt-4 h-9 rounded-md bg-blue-600 px-4 text-sm text-white" data-nav="/pcs/products/styles/${escapeHtml(change.styleId)}/technical-data/${escapeHtml(workspace.newTechnicalVersionId)}">进入技术包</button>` : `<div class="mt-4 flex flex-wrap items-center gap-3"><span class="text-sm text-slate-600">操作人：${escapeHtml(CURRENT_PCS_ENGINEERING_USER.userName)}</span><button type="button" class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white disabled:opacity-40" ${allTasksCompleted ? '' : 'disabled'} data-engineering-change-action="generate-tech-pack" data-change-id="${escapeHtml(changeId)}">生成新技术包草稿</button></div>`}<div data-engineering-change-feedback class="mt-4 hidden rounded-md px-3 py-2 text-sm" role="alert"></div></section>
  </div>`
}

function rerenderDetail(changeId: string): void {
  const host = document.querySelector<HTMLElement>(`[data-engineering-change-detail="${CSS.escape(changeId)}"]`)
  if (host) host.outerHTML = renderPcsEngineeringChangeDetailPage(changeId)
}

export function handlePcsEngineeringChangeInput(target: Element): boolean {
  const listPageSize = target.closest<HTMLSelectElement>('[data-engineering-change-field="pageSize"]')
  if (listPageSize) {
    changeListState.pageSize = Number(listPageSize.value) || 10
    changeListState.currentPage = 1
    const host = document.querySelector<HTMLElement>('[data-engineering-change-list]')
    if (host) host.outerHTML = renderPcsEngineeringChangeListPage()
    return true
  }
  const moduleNode = target.closest<HTMLInputElement>('[data-engineering-change-module]')
  if (moduleNode) {
    const key = moduleNode.value as TechnicalModuleKey
    if (moduleNode.checked) createDraft.affectedModules.add(key)
    else createDraft.affectedModules.delete(key)
    return true
  }
  const node = target.closest<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-engineering-change-field]')
  if (!node) return false
  const field = node.dataset.engineeringChangeField || ''
  if (field === 'sourceMasterOrderId' || field === 'changeReason') {
    createDraft[field] = node.value
    return true
  }
  return false
}

export function handlePcsEngineeringChangeEvent(target: HTMLElement): boolean {
  const node = target.closest<HTMLElement>('[data-engineering-change-action]')
  if (!node) return false
  const action = node.dataset.engineeringChangeAction || ''
  if (action === 'open-image-preview') {
    const url = node.dataset.imagePreviewUrl || ''
    if (!url) return true
    changeImagePreview = { url, title: node.dataset.imagePreviewTitle || '款式图片' }
    updateEngineeringChangeImagePreview()
    return true
  }
  if (action === 'close-image-preview') {
    changeImagePreview = null
    updateEngineeringChangeImagePreview()
    return true
  }
  if (action === 'prev-page' || action === 'next-page') {
    changeListState.currentPage = action === 'prev-page' ? Math.max(1, changeListState.currentPage - 1) : changeListState.currentPage + 1
    const host = document.querySelector<HTMLElement>('[data-engineering-change-list]')
    if (host) host.outerHTML = renderPcsEngineeringChangeListPage()
    return true
  }
  const feedback = node.closest<HTMLElement>('[data-engineering-change-create], [data-engineering-change-detail]')?.querySelector<HTMLElement>('[data-engineering-change-feedback]')
  try {
    if (action === 'create') {
      const created = createEngineeringChangeWorkspace({
        sourceMasterOrderId: createDraft.sourceMasterOrderId,
        changeReason: createDraft.changeReason,
        affectedModules: [...createDraft.affectedModules],
        actor: CURRENT_PCS_ENGINEERING_USER,
      })
      createDraft.sourceMasterOrderId = ''
      createDraft.changeReason = ''
      createDraft.affectedModules.clear()
      window.history.pushState({}, '', `${LIST_PATH}/${created.change.engineeringChangeTaskId}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
      return true
    }
    const changeId = node.dataset.changeId || ''
    if (action === 'start-line') startEngineeringChangeTaskLine(changeId, node.dataset.lineId || '', CURRENT_PCS_ENGINEERING_USER)
    else if (action === 'complete-line') {
      const summary = window.prompt('请填写本次成果说明') || ''
      completeEngineeringChangeTaskLine(changeId, node.dataset.lineId || '', summary, CURRENT_PCS_ENGINEERING_USER)
    }
    else if (action === 'generate-tech-pack') createEngineeringChangeTechPackDraft(changeId, CURRENT_PCS_ENGINEERING_USER)
    else return false
    rerenderDetail(changeId)
    return true
  } catch (error) {
    if (feedback) {
      feedback.hidden = false
      feedback.className = 'mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'
      feedback.textContent = error instanceof Error ? error.message : '操作失败，请重试。'
    }
    return true
  }
}
