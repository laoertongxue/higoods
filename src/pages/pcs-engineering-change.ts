// @page-pattern: list
// 工程变更：从当前使用的技术包选择具体修改内容，专业成果进入真实任务，普通资料直接修改下一版。
import { listEngineeringMasterOrders } from '../data/pcs-engineering-master-repository'
import { getCurrentTechPackVersionByStyleId } from '../data/pcs-technical-data-version-repository'
import {
  completeEngineeringChangeDirectItem,
  completeEngineeringChangeWorkspace,
  confirmEngineeringChangeColorRequirement,
  confirmEngineeringChangeWork,
  createEngineeringChangeWorkspace,
  getEngineeringChangeWorkspaceView,
  listEngineeringChangeModificationOptions,
  listEngineeringChangeWorkspaceViews,
  reviewEngineeringChangeTaskLine,
  startEngineeringChangeTaskLine,
  submitEngineeringChangeTaskLine,
  submitEngineeringChangeTechPackReview,
  type EngineeringChangeItem,
  type EngineeringChangeTaskLine,
} from '../data/pcs-engineering-change-workspace'
import { CURRENT_PCS_ENGINEERING_USER } from '../data/pcs-engineering-current-user'
import { getEngineeringTeamCurrentOperator } from '../data/pcs-engineering-team-directory'
import {
  listEngineeringTaskUploadedFiles,
  removeEngineeringTaskUploadedFile,
  uploadEngineeringTaskFiles,
} from '../data/pcs-engineering-task-upload-repository'
import type { EngineeringUploadPurpose } from '../data/pcs-engineering-file-upload'
import { getStyleArchiveById } from '../data/pcs-style-archive-repository'
import { ensureEngineeringMasterDemoData } from '../data/pcs-engineering-master-view-model'
import { renderEngineeringFileUpload, renderEngineeringUploadPreview } from '../components/ui/engineering-file-upload'
import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page'
import { renderStandardListTable, type StandardListColumn } from '../components/ui/list-table'
import { paginateStandardListRows, type StandardListColumnPreferences } from '../components/ui/list-table-model'
import { renderTablePagination } from '../components/ui/pagination'
import { escapeHtml } from '../utils'

const LIST_PATH = '/pcs/engineering/changes'
const changeListState = { currentPage: 1, pageSize: 10 }
let changeImagePreview: { url: string; title: string } | null = null
let uploadPreview: { url: string; fileName: string } | null = null
const createDraft = {
  sourceMasterOrderId: '',
  changeReason: '',
  optionIds: new Set<string>(),
}
const colorDrafts = new Map<string, { pantone: string; colorName: string; dyeCode: string; reviewReason: string }>()

function renderHeader(title: string, extra = ''): string {
  return `<div class="flex flex-wrap items-center justify-between gap-3"><div><h1 class="text-xl font-semibold text-slate-900">${escapeHtml(title)}</h1><p class="mt-1 text-sm text-slate-500">在当前使用的技术包基础上完成修改，审核发布后形成下一版。</p></div>${extra}</div>`
}

type EngineeringChangeRow = ReturnType<typeof listEngineeringChangeWorkspaceViews>[number] & { imageUrl: string }

function activeTeams(row: EngineeringChangeRow): string[] {
  return [...new Set(row.workspace.selectedItems.filter((item) => item.status !== '已完成').map((item) => item.currentTeamName).filter(Boolean))]
}

const changeColumns: StandardListColumn<EngineeringChangeRow>[] = [
  { key: 'code', title: '变更编号', width: 140, required: true, freezeable: true, render: ({ change }) => `<button type="button" class="font-medium text-blue-700" data-nav="${LIST_PATH}/${escapeHtml(change.engineeringChangeTaskId)}">${escapeHtml(change.engineeringChangeTaskCode)}</button>` },
  { key: 'style', title: '目标款式', width: 280, required: true, freezeable: true, render: ({ change, imageUrl }) => `<div class="flex items-center gap-3">${imageUrl ? `<button type="button" class="h-12 w-12 overflow-hidden rounded border" aria-label="查看${escapeHtml(change.styleName)}大图" data-engineering-change-action="open-image-preview" data-image-preview-url="${escapeHtml(imageUrl)}" data-image-preview-title="${escapeHtml(change.styleName)}"><img class="h-full w-full object-cover" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(change.styleName)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="text-[10px] text-red-600">图片失败</span></button>` : '<span class="flex h-12 w-12 items-center justify-center rounded border text-[10px] text-amber-700">缺少图片</span>'}<div><p class="font-medium text-slate-900">${escapeHtml(change.styleName)}</p><p class="text-xs text-slate-500">${escapeHtml(change.styleCode)}</p></div></div>` },
  { key: 'master', title: '由哪张单发起', width: 150, render: ({ change }) => escapeHtml(change.sourceMasterOrderCode) },
  { key: 'techPack', title: '当前使用的技术包', width: 160, render: ({ workspace }) => escapeHtml(workspace.currentTechnicalVersionCode) },
  { key: 'scope', title: '本次要修改的内容', width: 320, render: ({ workspace }) => `<div class="line-clamp-2">${escapeHtml(workspace.selectedItems.map((item) => item.label).join('、'))}</div>` },
  { key: 'team', title: '当前需处理的团队', width: 180, render: (row) => escapeHtml(activeTeams(row).join('、') || '-') },
  { key: 'progress', title: '进度', width: 90, render: ({ workspace }) => `${workspace.selectedItems.filter((item) => item.status === '已完成').length}/${workspace.selectedItems.length}` },
  { key: 'status', title: '状态／下一版', width: 170, render: ({ workspace, effectiveStatus }) => `<p>${escapeHtml(effectiveStatus)}</p><p class="text-xs text-slate-500">${escapeHtml(workspace.newTechnicalVersionCode || '-')}</p>` },
  { key: 'actions', title: '操作', width: 100, required: true, actionColumn: true, render: ({ change }) => `<button type="button" class="h-8 rounded-md border border-slate-200 px-3 text-xs" data-nav="${LIST_PATH}/${escapeHtml(change.engineeringChangeTaskId)}">查看详情</button>` },
]

const changePreferences: StandardListColumnPreferences = {
  order: changeColumns.map((column) => column.key),
  visibleKeys: changeColumns.map((column) => column.key),
  frozenKeys: ['code', 'style'], pageSize: 10,
}

function renderEngineeringChangeImagePreview(): string {
  if (!changeImagePreview) return ''
  return `<div class="fixed inset-0 z-[100] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="${escapeHtml(changeImagePreview.title)}大图预览"><button type="button" class="absolute inset-0 bg-slate-950/70" data-engineering-change-action="close-image-preview" aria-label="关闭大图预览"></button><div class="relative z-10 flex max-h-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"><div class="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3"><p class="font-medium">${escapeHtml(changeImagePreview.title)}</p><button type="button" class="rounded border px-3 py-1 text-sm" data-engineering-change-action="close-image-preview">关闭</button></div><div class="flex min-h-0 items-center justify-center bg-slate-100 p-4"><img class="max-h-[calc(100vh-9rem)] max-w-full object-contain" src="${escapeHtml(changeImagePreview.url)}" alt="${escapeHtml(changeImagePreview.title)}高清大图" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="p-8 text-sm text-red-600">图片加载失败，请重新上传或检查原图。</span></div></div></div>`
}

function updateEngineeringChangeImagePreview(): void {
  const host = document.querySelector<HTMLElement>('[data-engineering-change-region="image-preview"]')
  if (host) host.innerHTML = `${renderEngineeringChangeImagePreview()}${renderEngineeringUploadPreview(uploadPreview, 'engineering-change')}`
}

export function renderPcsEngineeringChangeListPage(): string {
  ensureEngineeringMasterDemoData()
  const rows: EngineeringChangeRow[] = listEngineeringChangeWorkspaceViews().map((row) => ({ ...row, imageUrl: getStyleArchiveById(row.change.styleId)?.mainImageUrl || '' }))
  const paging = paginateStandardListRows(rows, changeListState.currentPage, changeListState.pageSize)
  changeListState.currentPage = paging.currentPage
  changePreferences.pageSize = changeListState.pageSize
  return `<div data-engineering-change-list>${renderStandardListPage({
    title: '工程变更',
    primaryActionsHtml: `<button type="button" class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-nav="${LIST_PATH}/new">新建工程变更</button>`,
    statsHtml: renderStandardListStats([
      { label: '变更总数', value: rows.length },
      { label: '修改中', value: rows.filter((row) => ['待确认修改内容', '修改中', '待汇总技术包'].includes(row.effectiveStatus)).length },
      { label: '审核中', value: rows.filter((row) => row.effectiveStatus === '技术包审核中').length },
      { label: '已完成', value: rows.filter((row) => row.effectiveStatus === '已完成').length },
    ]),
    listTitle: '工程变更列表',
    tableHtml: renderStandardListTable({ columns: changeColumns, rows: paging.rows, preferences: changePreferences, sort: null, eventPrefix: 'engineering-change', emptyText: '暂无工程变更' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: 'engineering-change', pageSizeOptions: [10, 20, 50] }),
  })}<div data-engineering-change-region="image-preview">${renderEngineeringChangeImagePreview()}${renderEngineeringUploadPreview(uploadPreview, 'engineering-change')}</div></div>`
}

export function isPcsEngineeringChangeDialogOpen(): boolean {
  return Boolean(changeImagePreview || uploadPreview)
}

function renderModificationOptions(): string {
  if (!createDraft.sourceMasterOrderId) return '<p class="rounded-md bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">请先选择已关闭工程主单。</p>'
  const options = listEngineeringChangeModificationOptions(createDraft.sourceMasterOrderId)
  if (!options.length) return '<p class="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">该款式没有正在使用的技术包，不能发起工程变更。</p>'
  const groups = [
    { key: 'BOM_EDIT', title: '用料与成本' },
    { key: 'PROFESSIONAL_TASK', title: '需要专业团队重新制作的成果' },
    { key: 'TECHNICAL_DATA_EDIT', title: '直接修改的技术资料' },
  ] as const
  return groups.map((group) => {
    const items = options.filter((item) => item.treatment === group.key)
    if (!items.length) return ''
    return `<section><h3 class="text-sm font-medium text-slate-800">${group.title}</h3><div class="mt-2 grid gap-2 md:grid-cols-2">${items.map((item) => `<label class="flex items-start gap-3 rounded-md border border-slate-200 px-3 py-3 text-sm"><input type="checkbox" class="mt-0.5" value="${escapeHtml(item.optionId)}" data-engineering-change-option ${createDraft.optionIds.has(item.optionId) ? 'checked' : ''}><span><span class="font-medium text-slate-800">${escapeHtml(item.label)}</span><span class="mt-1 block text-xs text-slate-500">${item.treatment === 'PROFESSIONAL_TASK' ? `建立${escapeHtml(item.taskName || '专业任务')} · ${escapeHtml(item.executionTeamName || '')}` : `在下一版技术包中由${escapeHtml(item.executionTeamName || '对应团队')}修改`}</span></span></label>`).join('')}</div></section>`
  }).join('')
}

export function renderPcsEngineeringChangeCreatePage(): string {
  ensureEngineeringMasterDemoData()
  const masters = listEngineeringMasterOrders().filter((master) => master.status === '已关闭')
  return `<div class="space-y-5 p-4" data-engineering-change-create>${renderHeader('新建工程变更', `<button type="button" class="h-10 rounded-md border border-slate-200 bg-white px-4 text-sm" data-nav="${LIST_PATH}">返回列表</button>`)}<section class="rounded-lg border border-slate-200 bg-white p-5"><div data-engineering-change-feedback class="mb-4 hidden rounded-md px-3 py-2 text-sm" role="alert"></div><div class="grid gap-4 md:grid-cols-2"><label class="text-sm text-slate-600">基于哪张已关闭工程主单<select class="mt-1 h-10 w-full rounded-md border border-slate-200 px-3" data-engineering-change-field="sourceMasterOrderId"><option value="">请选择</option>${masters.map((master) => { const tech = getCurrentTechPackVersionByStyleId(master.styleId); return `<option value="${escapeHtml(master.masterOrderId)}" ${createDraft.sourceMasterOrderId === master.masterOrderId ? 'selected' : ''}>${escapeHtml(master.masterOrderCode)} · ${escapeHtml(master.styleCode)} · ${escapeHtml(tech?.technicalVersionCode || '无生效技术包')}</option>` }).join('')}</select></label><label class="text-sm text-slate-600">发起团队<input class="mt-1 h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3" value="跟单" readonly></label><label class="text-sm text-slate-600 md:col-span-2">本次为什么要修改<textarea class="mt-1 min-h-24 w-full rounded-md border border-slate-200 px-3 py-2" data-engineering-change-field="changeReason">${escapeHtml(createDraft.changeReason)}</textarea></label></div><div class="mt-5 space-y-5" data-engineering-change-options>${renderModificationOptions()}</div><div class="mt-5 flex justify-end"><button type="button" class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-engineering-change-action="create">创建并进入确认</button></div></section></div>`
}

function rerenderCreatePage(): void {
  const host = document.querySelector<HTMLElement>('[data-engineering-change-create]')
  if (host) host.outerHTML = renderPcsEngineeringChangeCreatePage()
}

function directItemTarget(item: EngineeringChangeItem, styleId: string, versionId: string): string {
  return item.treatment === 'BOM_EDIT'
    ? `/pcs/technical-data/bom-pricing/owner/TECH_PACK_DRAFT/${versionId}`
    : `/pcs/products/styles/${styleId}/technical-data/${versionId}`
}

function renderDirectItem(changeId: string, item: EngineeringChangeItem, styleId: string, versionId: string): string {
  const completed = item.status === '已完成'
  return `<tr class="border-t border-slate-100"><td class="px-4 py-3"><p class="font-medium text-slate-800">${escapeHtml(item.label)}</p><p class="text-xs text-slate-500">${item.treatment === 'BOM_EDIT' ? '直接修改下一版用料与成本，不建立假任务' : '直接修改下一版技术资料，不建立假任务'}</p></td><td class="px-4 py-3 text-sm">${escapeHtml(completed ? '-' : item.currentTeamName || '-')}</td><td class="px-4 py-3 text-sm">${escapeHtml(item.status)}</td><td class="px-4 py-3"><div class="flex flex-wrap gap-2"><button type="button" class="h-8 rounded border border-slate-200 px-3 text-xs" data-nav="${escapeHtml(directItemTarget(item, styleId, versionId))}">进入修改</button>${completed ? `<span class="text-xs text-emerald-700">${escapeHtml(item.completedBy)} · ${escapeHtml(item.completedAt)}</span>` : `<button type="button" class="h-8 rounded border border-blue-200 px-3 text-xs text-blue-700" data-engineering-change-action="complete-direct-item" data-change-id="${escapeHtml(changeId)}" data-item-id="${escapeHtml(item.itemId)}" data-team="${escapeHtml(item.currentTeamName)}">确认本项已修改</button>`}</div></td></tr>`
}

function uploadPurposeSections(line: EngineeringChangeTaskLine): Array<{ purpose: EngineeringUploadPurpose; label: string; hint: string }> {
  if (['BASE_PATTERN_WOVEN', 'BASE_PATTERN_KNIT', 'SIZE_PATTERN_WOVEN', 'SIZE_PATTERN_KNIT'].includes(line.taskType)) return [
    { purpose: 'PATTERN_SOURCE', label: '纸样源文件', hint: '必须从本地选择至少 1 个真实 .prj 文件；可同时上传 DXF、RUL 或 PDF。' },
    { purpose: 'PATTERN_PREVIEW', label: '纸样预览图', hint: '必须从本地选择真实 JPG、PNG 或 WebP 图片。' },
  ]
  if (line.taskType === 'PRE_PRODUCTION_SAMPLE') return [{ purpose: 'SAMPLE_RESULT', label: '产前版样衣成果图', hint: '上传真实样衣照片，保存成功后才能提交。' }]
  if (line.taskType === 'PATTERN_ARTWORK') return [{ purpose: 'PATTERN_ARTWORK', label: '花型成果', hint: '上传真实花型源文件或效果图，买手审核通过后完成。' }]
  return [{ purpose: 'COLOR_RESULT', label: '调色成果', hint: '上传真实色样或调色结果图片，买手审核通过后完成。' }]
}

function colorDraft(lineId: string): { pantone: string; colorName: string; dyeCode: string; reviewReason: string } {
  return colorDrafts.get(lineId) || { pantone: '', colorName: '', dyeCode: '', reviewReason: '' }
}

function renderProfessionalTask(changeId: string, line: EngineeringChangeTaskLine): string {
  const isColor = ['COLOR_YARN', 'COLOR_FABRIC'].includes(line.taskType)
  const draft = colorDraft(line.lineId)
  const uploadVisible = ['进行中', '返工中', '待审核', '已完成'].includes(line.status) && (!isColor || Boolean(line.pantoneColorCode))
  const locked = ['待审核', '已完成'].includes(line.status)
  const uploads = uploadVisible ? `<div class="space-y-3 border-t border-slate-100 bg-slate-50 px-4 py-4">${uploadPurposeSections(line).map((entry) => {
    const files = listEngineeringTaskUploadedFiles(line.lineId, `ROUND-${line.currentRoundNo}`, entry.purpose)
    return renderEngineeringFileUpload({ taskId: line.lineId, itemId: `ROUND-${line.currentRoundNo}`, purpose: entry.purpose, files, eventPrefix: 'engineering-change', label: entry.label, requiredHint: entry.hint, locked })
  }).join('')}</div>` : ''
  let action = ''
  if (isColor && line.status === '待开始' && line.currentTeamName === '跟单') {
    action = `<div class="grid gap-3 border-t border-slate-100 bg-slate-50 px-4 py-4 md:grid-cols-4"><label class="text-xs text-slate-600">潘通色号<input class="mt-1 h-9 w-full rounded border px-2" data-engineering-change-color-field="pantone" data-line-id="${escapeHtml(line.lineId)}" value="${escapeHtml(draft.pantone || line.pantoneColorCode)}"></label><label class="text-xs text-slate-600">颜色名称<input class="mt-1 h-9 w-full rounded border px-2" data-engineering-change-color-field="colorName" data-line-id="${escapeHtml(line.lineId)}" value="${escapeHtml(draft.colorName || line.colorName)}"></label><label class="text-xs text-slate-600">染色色号<input class="mt-1 h-9 w-full rounded border px-2" data-engineering-change-color-field="dyeCode" data-line-id="${escapeHtml(line.lineId)}" value="${escapeHtml(draft.dyeCode || line.dyeColorCode)}"></label><div class="flex items-end"><button type="button" class="h-9 rounded bg-blue-600 px-3 text-sm text-white" data-engineering-change-action="confirm-color" data-change-id="${escapeHtml(changeId)}" data-line-id="${escapeHtml(line.lineId)}">确认并交给染厂</button></div></div>`
  } else if (line.status === '待开始') {
    action = `<button type="button" class="h-8 rounded bg-blue-600 px-3 text-xs text-white" data-engineering-change-action="start-line" data-change-id="${escapeHtml(changeId)}" data-line-id="${escapeHtml(line.lineId)}" data-team="${escapeHtml(line.currentTeamName)}">开始任务</button>`
  } else if (['进行中', '返工中'].includes(line.status)) {
    action = `<button type="button" class="h-8 rounded bg-blue-600 px-3 text-xs text-white" data-engineering-change-action="submit-line" data-change-id="${escapeHtml(changeId)}" data-line-id="${escapeHtml(line.lineId)}">提交本次工作</button>`
  } else if (line.status === '待审核') {
    action = `<div class="flex flex-wrap items-center gap-2"><input class="h-8 w-56 rounded border px-2 text-xs" placeholder="填写审核意见" data-engineering-change-color-field="reviewReason" data-line-id="${escapeHtml(line.lineId)}" value="${escapeHtml(draft.reviewReason)}"><button type="button" class="h-8 rounded bg-emerald-600 px-3 text-xs text-white" data-engineering-change-action="review-line" data-decision="通过" data-change-id="${escapeHtml(changeId)}" data-line-id="${escapeHtml(line.lineId)}">通过</button><button type="button" class="h-8 rounded border border-red-200 px-3 text-xs text-red-700" data-engineering-change-action="review-line" data-decision="未通过" data-change-id="${escapeHtml(changeId)}" data-line-id="${escapeHtml(line.lineId)}">退回本项</button></div>`
  } else action = `<span class="text-xs text-emerald-700">${escapeHtml(line.actualOperatorName)} · ${escapeHtml(line.completedAt)}</span>`
  return `<article id="task-${escapeHtml(line.lineId)}" class="overflow-hidden rounded-md border border-slate-200"><div class="grid gap-3 px-4 py-3 md:grid-cols-[minmax(220px,1.6fr)_150px_120px_minmax(240px,1fr)]"><div><p class="font-medium text-slate-800">${escapeHtml(line.taskName)}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(line.lineId)} · 第 ${line.currentRoundNo} 轮${line.reviewOpinion ? ` · 上次意见：${escapeHtml(line.reviewOpinion)}` : ''}</p></div><div><p class="text-xs text-slate-500">当前需处理的团队</p><p class="mt-1 text-sm">${escapeHtml(line.currentTeamName || '-')}</p></div><div><p class="text-xs text-slate-500">状态</p><p class="mt-1 text-sm">${escapeHtml(line.status)}</p></div><div class="flex items-center justify-end">${action}</div></div>${uploadVisible ? uploads : ''}</article>`
}

function currentActionText(status: string): string {
  if (status === '待确认修改内容') return '由跟单确认本次修改内容，系统再建立真实专业任务和下一版技术包。'
  if (status === '修改中') return '各团队按当前任务并行修改；系统自动记录实际操作人并在完成后交给下一团队。'
  if (status === '待汇总技术包') return '全部修改已完成，由跟单汇总并提交现行技术包审核。'
  if (status === '技术包审核中') return '下一版技术包正在按现行审核流程处理。'
  if (status === '已生效') return '下一版技术包已经生效，由跟单确认本次工程变更完成。'
  return '本次工程变更已完成。'
}

export function renderPcsEngineeringChangeDetailPage(changeId: string): string {
  const view = getEngineeringChangeWorkspaceView(changeId)
  if (!view) return `<div class="p-4">${renderHeader('未找到工程变更', `<button type="button" data-nav="${LIST_PATH}">返回列表</button>`)}</div>`
  const { change, workspace } = view
  const style = getStyleArchiveById(change.styleId)
  const imageUrl = style?.mainImageUrl || style?.galleryImageUrls?.[0] || ''
  const directItems = workspace.selectedItems.filter((item) => item.treatment !== 'PROFESSIONAL_TASK')
  return `<div class="space-y-5 p-4" data-engineering-change-detail="${escapeHtml(changeId)}">${renderHeader(`${change.styleName} · ${change.engineeringChangeTaskCode}`, `<button type="button" class="h-10 rounded-md border border-slate-200 bg-white px-4 text-sm" data-nav="${LIST_PATH}">返回列表</button>`)}<section class="overflow-hidden rounded-lg border border-slate-200 bg-white"><div class="flex flex-wrap items-center gap-4 border-b px-5 py-4">${imageUrl ? `<button type="button" class="h-20 w-16 overflow-hidden rounded border" data-engineering-change-action="open-image-preview" data-image-preview-url="${escapeHtml(imageUrl)}" data-image-preview-title="${escapeHtml(change.styleName)}"><img class="h-full w-full object-cover" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(change.styleName)}"></button>` : ''}<div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2"><h2 class="font-semibold">${escapeHtml(change.styleName)}</h2><span class="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">${escapeHtml(view.effectiveStatus)}</span></div><p class="mt-1 text-sm text-slate-500">${escapeHtml(change.styleCode)} · ${escapeHtml(change.sourceMasterOrderCode)} · 基于 ${escapeHtml(workspace.currentTechnicalVersionCode)}</p><p class="mt-2 text-sm text-slate-700">${escapeHtml(workspace.changeReason)}</p></div></div><div class="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-5 py-4"><div><p class="text-xs font-medium text-slate-500">当前动作</p><p class="mt-1 text-sm text-slate-800">${escapeHtml(currentActionText(view.effectiveStatus))}</p></div>${view.effectiveStatus === '待确认修改内容' ? `<button type="button" class="h-10 rounded bg-blue-600 px-4 text-sm text-white" data-engineering-change-action="confirm-work" data-change-id="${escapeHtml(changeId)}">确认修改内容并建立工作</button>` : ''}</div><div data-engineering-change-feedback class="m-5 hidden rounded-md px-3 py-2 text-sm" role="alert"></div></section><section class="overflow-hidden rounded-lg border border-slate-200 bg-white"><div class="border-b border-slate-100 px-5 py-4"><h2 class="font-semibold">本次要修改的内容</h2><p class="mt-1 text-xs text-slate-500">具体到用料行、专业成果或技术资料栏目；原主单和原正式技术包保持只读。</p></div><div class="overflow-x-auto"><table class="min-w-full"><thead class="bg-slate-50 text-left text-xs text-slate-500"><tr><th class="px-4 py-3">具体内容</th><th class="px-4 py-3">当前团队</th><th class="px-4 py-3">状态</th><th class="px-4 py-3">操作</th></tr></thead><tbody>${directItems.map((item) => renderDirectItem(changeId, item, change.styleId, workspace.newTechnicalVersionId)).join('')}${workspace.taskLines.map((line) => `<tr class="border-t"><td class="px-4 py-3 font-medium">${escapeHtml(line.taskName)}</td><td class="px-4 py-3 text-sm">${escapeHtml(line.currentTeamName || '-')}</td><td class="px-4 py-3 text-sm">${escapeHtml(line.status)}</td><td class="px-4 py-3"><a class="text-sm text-blue-700" href="#task-${escapeHtml(line.lineId)}">进入任务</a></td></tr>`).join('')}</tbody></table></div></section>${workspace.taskLines.length ? `<section class="rounded-lg border border-slate-200 bg-white p-5"><div class="mb-4"><h2 class="font-semibold">专业任务</h2><p class="mt-1 text-xs text-slate-500">这些是真实任务，同时出现在对应的制版、产前版样衣、花型或调色任务列表中。</p></div><div class="space-y-4">${workspace.taskLines.map((line) => renderProfessionalTask(changeId, line)).join('')}</div></section>` : ''}<section class="rounded-lg border border-slate-200 bg-white p-5"><div class="flex flex-wrap items-start justify-between gap-4"><div><h2 class="font-semibold">下一版技术包</h2><p class="mt-2 text-sm text-slate-600">${workspace.newTechnicalVersionCode ? `${escapeHtml(workspace.newTechnicalVersionCode)} · ${escapeHtml(view.effectiveStatus)}` : '确认修改内容后建立。'}</p></div><div class="flex flex-wrap gap-2">${workspace.newTechnicalVersionId ? `<button type="button" class="h-9 rounded border border-slate-200 px-4 text-sm" data-nav="/pcs/products/styles/${escapeHtml(change.styleId)}/technical-data/${escapeHtml(workspace.newTechnicalVersionId)}">进入技术包</button>` : ''}${view.effectiveStatus === '待汇总技术包' ? `<button type="button" class="h-9 rounded bg-blue-600 px-4 text-sm text-white" data-engineering-change-action="submit-tech-review" data-change-id="${escapeHtml(changeId)}">汇总修改结果，提交技术包审核</button>` : ''}${view.effectiveStatus === '已生效' ? `<button type="button" class="h-9 rounded bg-blue-600 px-4 text-sm text-white" data-engineering-change-action="complete-change" data-change-id="${escapeHtml(changeId)}">确认本次变更完成</button>` : ''}</div></div></section><section class="rounded-lg border border-slate-200 bg-white"><div class="border-b px-5 py-4"><h2 class="font-semibold">操作记录</h2></div><div class="divide-y">${workspace.operationLogs.length ? workspace.operationLogs.map((log) => `<div class="grid gap-2 px-5 py-3 text-sm md:grid-cols-[170px_140px_160px_1fr]"><span class="text-slate-500">${escapeHtml(log.occurredAt)}</span><span>${escapeHtml(log.action)}</span><span>${escapeHtml(log.teamName)} · ${escapeHtml(log.operatorName)}</span><span class="text-slate-600">${escapeHtml(log.detail)}</span></div>`).join('') : '<p class="p-5 text-sm text-slate-500">暂无操作记录</p>'}</div></section><div data-engineering-change-region="image-preview">${renderEngineeringChangeImagePreview()}${renderEngineeringUploadPreview(uploadPreview, 'engineering-change')}</div></div>`
}

function rerenderDetail(changeId: string): void {
  const host = document.querySelector<HTMLElement>(`[data-engineering-change-detail="${CSS.escape(changeId)}"]`)
  if (host) host.outerHTML = renderPcsEngineeringChangeDetailPage(changeId)
}

function showFeedback(changeId: string, error: unknown): void {
  const feedback = document.querySelector<HTMLElement>(`[data-engineering-change-detail="${CSS.escape(changeId)}"] [data-engineering-change-feedback]`)
  if (!feedback) return
  feedback.hidden = false
  feedback.className = 'm-5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'
  feedback.textContent = error instanceof Error ? error.message : '操作失败，请重试。'
}

export function handlePcsEngineeringChangeInput(target: Element): boolean {
  const uploadInput = target.closest<HTMLInputElement>('[data-engineering-change-upload-input]')
  if (uploadInput) {
    const lineId = uploadInput.dataset.taskId || ''
    const view = listEngineeringChangeWorkspaceViews().find((item) => item.workspace.taskLines.some((line) => line.lineId === lineId))
    if (!view || !uploadInput.files?.length) return true
    const line = view.workspace.taskLines.find((item) => item.lineId === lineId)!
    const operator = getEngineeringTeamCurrentOperator(line.executionTeamName)
    const purpose = (uploadInput.dataset.uploadPurpose || '') as EngineeringUploadPurpose
    void uploadEngineeringTaskFiles({ taskId: lineId, itemId: uploadInput.dataset.itemId || `ROUND-${line.currentRoundNo}`, purpose, files: uploadInput.files, actor: { userId: operator.operatorId, userName: operator.operatorName, teamName: operator.teamName }, roundNo: line.currentRoundNo })
      .then(() => rerenderDetail(view.change.engineeringChangeTaskId))
      .catch((error) => showFeedback(view.change.engineeringChangeTaskId, error))
    return true
  }
  const optionNode = target.closest<HTMLInputElement>('[data-engineering-change-option]')
  if (optionNode) {
    if (optionNode.checked) createDraft.optionIds.add(optionNode.value)
    else createDraft.optionIds.delete(optionNode.value)
    return true
  }
  const colorNode = target.closest<HTMLInputElement>('[data-engineering-change-color-field]')
  if (colorNode) {
    const lineId = colorNode.dataset.lineId || ''
    const current = colorDraft(lineId)
    const field = colorNode.dataset.engineeringChangeColorField as keyof typeof current
    current[field] = colorNode.value
    colorDrafts.set(lineId, current)
    return true
  }
  const node = target.closest<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-engineering-change-field]')
  if (!node) return false
  const field = node.dataset.engineeringChangeField || ''
  if (field === 'sourceMasterOrderId') {
    createDraft.sourceMasterOrderId = node.value
    createDraft.optionIds.clear()
    rerenderCreatePage()
    return true
  }
  if (field === 'changeReason') {
    createDraft.changeReason = node.value
    return true
  }
  return false
}

export function handlePcsEngineeringChangeEvent(target: HTMLElement): boolean {
  const uploadRemove = target.closest<HTMLElement>('[data-engineering-change-upload-remove]')
  if (uploadRemove) {
    const lineId = uploadRemove.dataset.taskId || ''
    const view = listEngineeringChangeWorkspaceViews().find((item) => item.workspace.taskLines.some((line) => line.lineId === lineId))
    if (!view) return true
    removeEngineeringTaskUploadedFile({ taskId: lineId, itemId: uploadRemove.dataset.itemId || 'TASK', fileId: uploadRemove.dataset.fileId || '', locked: false })
    rerenderDetail(view.change.engineeringChangeTaskId)
    return true
  }
  const uploadPreviewNode = target.closest<HTMLElement>('[data-engineering-change-upload-preview]')
  if (uploadPreviewNode) {
    uploadPreview = { url: uploadPreviewNode.dataset.fileUrl || '', fileName: uploadPreviewNode.dataset.fileName || '成果图片' }
    updateEngineeringChangeImagePreview()
    return true
  }
  if (target.closest('[data-engineering-change-upload-preview-close]')) {
    uploadPreview = null
    updateEngineeringChangeImagePreview()
    return true
  }
  const node = target.closest<HTMLElement>('[data-engineering-change-action]')
  if (!node) return false
  const action = node.dataset.engineeringChangeAction || ''
  if (action === 'open-image-preview') {
    const url = node.dataset.imagePreviewUrl || ''
    if (url) changeImagePreview = { url, title: node.dataset.imagePreviewTitle || '款式图片' }
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
  const changeId = node.dataset.changeId || ''
  try {
    if (action === 'create') {
      const created = createEngineeringChangeWorkspace({ sourceMasterOrderId: createDraft.sourceMasterOrderId, changeReason: createDraft.changeReason, modificationOptionIds: [...createDraft.optionIds], actor: CURRENT_PCS_ENGINEERING_USER })
      createDraft.sourceMasterOrderId = ''
      createDraft.changeReason = ''
      createDraft.optionIds.clear()
      window.history.pushState({}, '', `${LIST_PATH}/${created.change.engineeringChangeTaskId}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
      return true
    }
    if (action === 'confirm-work') confirmEngineeringChangeWork(changeId, CURRENT_PCS_ENGINEERING_USER)
    else if (action === 'start-line') startEngineeringChangeTaskLine(changeId, node.dataset.lineId || '', getEngineeringTeamCurrentOperator(node.dataset.team || ''))
    else if (action === 'confirm-color') {
      const lineId = node.dataset.lineId || ''
      const draft = colorDraft(lineId)
      confirmEngineeringChangeColorRequirement({ changeId, lineId, pantoneColorCode: draft.pantone, colorName: draft.colorName, dyeColorCode: draft.dyeCode, actor: getEngineeringTeamCurrentOperator('跟单') })
      colorDrafts.delete(lineId)
    } else if (action === 'submit-line') {
      const view = getEngineeringChangeWorkspaceView(changeId)
      const line = view?.workspace.taskLines.find((item) => item.lineId === node.dataset.lineId)
      if (!line) throw new Error('未找到本次专业任务。')
      submitEngineeringChangeTaskLine(changeId, line.lineId, getEngineeringTeamCurrentOperator(line.executionTeamName))
    } else if (action === 'review-line') {
      const lineId = node.dataset.lineId || ''
      reviewEngineeringChangeTaskLine({ changeId, lineId, decision: node.dataset.decision === '通过' ? '通过' : '未通过', reason: colorDraft(lineId).reviewReason, actor: getEngineeringTeamCurrentOperator('买手') })
      colorDrafts.delete(lineId)
    } else if (action === 'complete-direct-item') {
      completeEngineeringChangeDirectItem(changeId, node.dataset.itemId || '', getEngineeringTeamCurrentOperator(node.dataset.team || ''))
    } else if (action === 'submit-tech-review') submitEngineeringChangeTechPackReview(changeId, CURRENT_PCS_ENGINEERING_USER)
    else if (action === 'complete-change') completeEngineeringChangeWorkspace(changeId, CURRENT_PCS_ENGINEERING_USER)
    else return false
    rerenderDetail(changeId)
    return true
  } catch (error) {
    if (changeId) showFeedback(changeId, error)
    else {
      const feedback = document.querySelector<HTMLElement>('[data-engineering-change-create] [data-engineering-change-feedback]')
      if (feedback) { feedback.hidden = false; feedback.className = 'mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'; feedback.textContent = error instanceof Error ? error.message : '操作失败，请重试。' }
    }
    return true
  }
}
