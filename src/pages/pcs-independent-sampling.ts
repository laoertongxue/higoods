// @page-pattern: list
import { renderEngineeringFileUpload, renderEngineeringUploadPreview } from '../components/ui/engineering-file-upload.ts'
import { renderStandardListPage } from '../components/ui/list-page.ts'
import { type StandardListColumn } from '../components/ui/list-table.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../components/ui/process-order-list-controller.ts'
import { getEngineeringBomVersionById } from '../data/pcs-engineering-bom-repository.ts'
import { CURRENT_PCS_ENGINEERING_USER } from '../data/pcs-engineering-current-user.ts'
import {
  confirmEngineeringIndependentColorMappings,
  confirmEngineeringIndependentColorRequirement,
  confirmEngineeringIndependentMaterialConversions,
  confirmEngineeringIndependentSamplingPlan,
  confirmEngineeringIndependentSamplingResult,
  createEngineeringIndependentSampling,
  getEngineeringIndependentCurrentTeam,
  getEngineeringIndependentCurrentTeams,
  getEngineeringIndependentProfessionalTaskCurrentTeam,
  getEngineeringIndependentSamplingRecord,
  getEngineeringIndependentTargetColorGroups,
  listEngineeringIndependentSamplingRecords,
  reviewEngineeringIndependentProfessionalTask,
  startEngineeringIndependentProfessionalTask,
  submitEngineeringIndependentProfessionalTask,
  suggestEngineeringIndependentTaskTypes,
} from '../data/pcs-engineering-master-sampling.ts'
import type {
  EngineeringIndependentMaterialDecision,
  EngineeringIndependentProfessionalTask,
  EngineeringIndependentProfessionalTaskType,
  EngineeringIndependentSamplingRecord,
  EngineeringIndependentSamplingType,
} from '../data/pcs-engineering-master-types.ts'
import {
  listEngineeringTaskUploadedFiles,
  removeEngineeringTaskUploadedFile,
  uploadEngineeringTaskFiles,
} from '../data/pcs-engineering-task-upload-repository.ts'
import type { EngineeringUploadPurpose } from '../data/pcs-engineering-file-upload.ts'
import { listMaterialArchives, listMaterialSkuRecordsByMaterialId } from '../data/pcs-material-archive-repository.ts'
import { listSkuArchivesByStyleId } from '../data/pcs-sku-archive-repository.ts'
import { getStyleArchiveById, listStyleArchives } from '../data/pcs-style-archive-repository.ts'
import { escapeHtml } from '../utils.ts'

const PREFIX = 'pcs-independent-sampling'
const BUYER = { role: '买手' as const, userId: 'U-BUYER-WANGMING', userName: '买手-王明' }
const EXECUTORS: Record<EngineeringIndependentProfessionalTaskType, { role: string; userId: string; userName: string }> = {
  BASE_PATTERN: { role: '版师', userId: 'U-PATTERN-ZHAO', userName: '版师-赵云' },
  DISPLAY_SAMPLE: { role: '制作团队', userId: 'U-SAMPLE-ALAN', userName: '样衣制作-阿兰' },
  PATTERN_ARTWORK: { role: '花型团队', userId: 'U-ARTWORK-BING', userName: '花型-冰冰' },
  COLOR_YARN: { role: '染厂', userId: 'U-DYE-CHEN', userName: '染厂-陈师傅' },
  COLOR_FABRIC: { role: '染厂', userId: 'U-DYE-CHEN', userName: '染厂-陈师傅' },
}
const TYPE_TEXT: Record<EngineeringIndependentSamplingType, string> = { REVISION: '改款打样', DESIGN: '设计打样' }
const STATUS_TEXT: Record<EngineeringIndependentSamplingRecord['status'], string> = { DRAFT: '草稿', IN_PROGRESS: '进行中', WAIT_CONFIRMATION: '待整单确认', COMPLETED: '已完成' }
const TASK_STATUS_TEXT: Record<EngineeringIndependentProfessionalTask['status'], string> = { WAIT_DEPENDENCY: '需要先完成其他工作', WAIT_START: '待开始', IN_PROGRESS: '进行中', WAIT_REVIEW: '待买手审核', REWORK: '需要重做', COMPLETED: '已完成' }
const TASK_OPTIONS: Array<{ value: EngineeringIndependentProfessionalTaskType; label: string }> = [
  { value: 'BASE_PATTERN', label: '基码纸样' },
  { value: 'DISPLAY_SAMPLE', label: '销售展示样衣任务' },
  { value: 'PATTERN_ARTWORK', label: '花型任务' },
  { value: 'COLOR_YARN', label: '调色任务（纱线）' },
  { value: 'COLOR_FABRIC', label: '调色任务（面料）' },
]

const ui = {
  createType: '' as EngineeringIndependentSamplingType | '',
  createDraft: { sourceStyleId: '', targetStyleId: '', creationReason: '' },
  taskDrafts: {} as Record<string, Record<string, string>>,
  preview: null as { url: string; fileName: string } | null,
  feedback: '', ok: true,
  teamFilter: { REVISION: '', DESIGN: '' } as Record<EngineeringIndependentSamplingType, string>,
  displayTeamFilter: '',
}

function listControllerState(): ProcessOrderListControllerState {
  return { currentPage: 1, sort: null, preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 }, preferencesLoaded: false, showColumnSettings: false }
}
const listStates = { REVISION: listControllerState(), DESIGN: listControllerState() }
const displaySampleListState = listControllerState()

function nowText(): string { return new Date().toISOString().replace('T', ' ').slice(0, 19) }
function feedbackHtml(): string { return ui.feedback ? `<p class="rounded border px-3 py-2 text-sm ${ui.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}">${escapeHtml(ui.feedback)}</p>` : '' }
function setFeedback(message: string, ok = true): void { ui.feedback = message; ui.ok = ok }
function rerender(): void { if (typeof window !== 'undefined') window.dispatchEvent(new Event('higood:request-render')) }
function run(action: () => void, success: string): void { try { action(); setFeedback(success) } catch (error) { setFeedback(error instanceof Error ? error.message : '操作失败。', false) } rerender() }
function value(field: string, scope: ParentNode = document): string { return scope.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[data-${PREFIX}-field="${field}"]`)?.value.trim() || '' }
function checkedTaskTypes(): EngineeringIndependentProfessionalTaskType[] { return [...document.querySelectorAll<HTMLInputElement>(`[data-${PREFIX}-field="planTaskType"]:checked`)].map((node) => node.value as EngineeringIndependentProfessionalTaskType) }
function currentListType(): EngineeringIndependentSamplingType { return location.pathname.includes('revision') ? 'REVISION' : 'DESIGN' }
function isDisplaySampleListPath(): boolean { return location.pathname === '/pcs/samples/display-sample' }

function imageButton(url: string, alt: string, body = ''): string {
  return `<button type="button" class="flex items-center gap-2 text-left" data-${PREFIX}-action="open-image" data-image-url="${escapeHtml(url)}" data-image-alt="${escapeHtml(alt)}"><span class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border bg-slate-50"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" class="h-full w-full object-cover" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-center text-[10px] text-red-600">图片加载失败</span></span><span>${body}</span></button>`
}

function styleOptions(selected = ''): string {
  return listStyleArchives().filter((style) => style.mainImageUrl).map((style) => `<option value="${escapeHtml(style.styleId)}" ${style.styleId === selected ? 'selected' : ''}>${escapeHtml(style.styleCode)} · ${escapeHtml(style.styleName)}</option>`).join('')
}

function renderCreateDialog(type: EngineeringIndependentSamplingType): string {
  if (ui.createType !== type) return ''
  const isRevision = type === 'REVISION'
  return `<div class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" data-${PREFIX}-action="close-create"><section class="w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl" role="dialog" aria-modal="true"><div class="mb-4 flex items-center justify-between"><h2 class="text-lg font-semibold">新建${TYPE_TEXT[type]}任务</h2><button type="button" data-${PREFIX}-action="close-create">关闭</button></div><div class="grid gap-4 md:grid-cols-2">${isRevision ? `<label class="space-y-1 text-sm"><span>基于款式（SPU）</span><select class="h-10 w-full rounded border px-3" data-${PREFIX}-field="sourceStyleId"><option value="">请选择</option>${styleOptions(ui.createDraft.sourceStyleId)}</select></label>` : ''}<label class="space-y-1 text-sm"><span>${isRevision ? '做成款式' : '目标款式'}（SPU）</span><select class="h-10 w-full rounded border px-3" data-${PREFIX}-field="targetStyleId"><option value="">请选择</option>${styleOptions(ui.createDraft.targetStyleId)}</select></label><label class="space-y-1 text-sm"><span>跟单团队</span><input class="h-10 w-full rounded border bg-slate-50 px-3" value="${escapeHtml(CURRENT_PCS_ENGINEERING_USER.userName)}" readonly></label><label class="space-y-1 text-sm md:col-span-2"><span>本次打样原因</span><textarea class="min-h-24 w-full rounded border p-3" data-${PREFIX}-field="creationReason" placeholder="请说明要调整或设计什么，以及为什么需要制作销售展示样衣">${escapeHtml(ui.createDraft.creationReason)}</textarea></label></div><p class="mt-4 rounded bg-blue-50 px-3 py-2 text-sm text-blue-700">创建后先完成 B 款 BOM 与价格，再由跟单确认本次工作安排。</p><div class="mt-5 flex justify-end gap-2"><button class="h-9 rounded border px-4" data-${PREFIX}-action="close-create">取消</button><button class="h-9 rounded bg-blue-600 px-4 text-white" data-${PREFIX}-action="create" data-sampling-type="${type}">创建草稿</button></div></section></div>`
}

function renderDialogHost(): string {
  return `<div data-independent-sampling-dialogs>${ui.createType ? renderCreateDialog(ui.createType) : ''}${renderEngineeringUploadPreview(ui.preview, PREFIX)}</div>`
}
function refreshDialogs(): void {
  document.querySelectorAll<HTMLElement>('[data-independent-sampling-dialogs]').forEach((host) => { host.innerHTML = `${ui.createType ? renderCreateDialog(ui.createType) : ''}${renderEngineeringUploadPreview(ui.preview, PREFIX)}` })
}

function listRows(type: EngineeringIndependentSamplingType): EngineeringIndependentSamplingRecord[] {
  return listEngineeringIndependentSamplingRecords(type).filter((record) => !ui.teamFilter[type] || getEngineeringIndependentCurrentTeams(record).includes(ui.teamFilter[type]))
}
function teamOptions(type: EngineeringIndependentSamplingType): string[] {
  return [...new Set(listEngineeringIndependentSamplingRecords(type).flatMap(getEngineeringIndependentCurrentTeams))].sort()
}

function listColumns(type: EngineeringIndependentSamplingType): StandardListColumn<EngineeringIndependentSamplingRecord>[] {
  return [
    { key: 'code', title: '任务号', width: 130, required: true, freezeable: true, sortable: true, sortValue: (row) => row.samplingTaskCode, render: (row) => `<a class="font-medium text-blue-700 hover:underline" href="/pcs/engineering/${type === 'REVISION' ? 'revision' : 'design'}-sampling/${escapeHtml(row.samplingTaskId)}">${escapeHtml(row.samplingTaskCode)}</a>` },
    { key: 'style', title: type === 'REVISION' ? '基于款式 → 做成款式' : '目标款式', width: 360, required: true, render: (row) => { const target = getStyleArchiveById(row.targetStyleId); const source = row.sourceStyleId ? getStyleArchiveById(row.sourceStyleId) : null; return `<div class="flex items-center gap-2">${source ? `${imageButton(source.mainImageUrl, source.styleName, `<span class="block"><strong>${escapeHtml(source.styleCode)}</strong><small class="block text-slate-500">${escapeHtml(source.styleName)}</small></span>`)}<span>→</span>` : ''}${target ? imageButton(target.mainImageUrl, target.styleName, `<span class="block"><strong>${escapeHtml(target.styleCode)}</strong><small class="block text-slate-500">${escapeHtml(target.styleName)}</small></span>`) : escapeHtml(row.targetStyleCode)}</div>` } },
    { key: 'status', title: '状态', width: 120, sortable: true, sortValue: (row) => STATUS_TEXT[row.status], render: (row) => `<span class="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">${STATUS_TEXT[row.status]}</span>` },
    { key: 'team', title: '当前需处理的团队', width: 150, render: (row) => escapeHtml(getEngineeringIndependentCurrentTeam(row)) },
    { key: 'progress', title: '工作进度', width: 120, render: (row) => `${row.professionalTasks.filter((task) => task.status === 'COMPLETED').length}/${row.professionalTasks.length || '-'}` },
    { key: 'bom', title: 'BOM 与价格', width: 150, render: (row) => `<a class="text-blue-700 hover:underline" href="/pcs/technical-data/bom-pricing/${escapeHtml(row.bomDraftVersionId)}">${row.bomVersionIds.length} 个颜色版本</a>` },
    { key: 'owner', title: '跟单', width: 120, render: (row) => escapeHtml(row.merchandiserName) },
    { key: 'updated', title: '更新时间', width: 170, sortable: true, sortValue: (row) => row.updatedAt, render: (row) => escapeHtml(row.updatedAt) },
    { key: 'action', title: '操作', width: 100, actionColumn: true, render: (row) => `<a class="inline-flex h-8 items-center rounded border px-3 text-xs" href="/pcs/engineering/${type === 'REVISION' ? 'revision' : 'design'}-sampling/${escapeHtml(row.samplingTaskId)}">查看详情</a>` },
  ]
}

function createSamplingListController(type: EngineeringIndependentSamplingType) {
  return createProcessOrderListController({
    state: listStates[type], columns: listColumns(type), preferenceKey: `higood-pcs-${type.toLowerCase()}-sampling-list-preferences-v2`,
    pageSizeOptions: [10, 20, 50], eventPrefix: PREFIX, rootSelector: `[data-independent-sampling-list="${type}"]`,
    tableSurfaceSelector: '[data-independent-sampling-table]', paginationSurfaceSelector: '[data-independent-sampling-pagination]', overlaysSurfaceSelector: '[data-independent-sampling-overlays]',
    defaultFrozenKeys: ['code'], columnSettingsTitle: `${TYPE_TEXT[type]}列表列设置`, emptyText: `暂无${TYPE_TEXT[type]}任务`, getRows: () => listRows(type),
  })
}
const listControllers = { REVISION: createSamplingListController('REVISION'), DESIGN: createSamplingListController('DESIGN') }

interface DisplaySampleListRow {
  record: EngineeringIndependentSamplingRecord
  task: EngineeringIndependentProfessionalTask
}

function displaySampleRows(): DisplaySampleListRow[] {
  return listEngineeringIndependentSamplingRecords()
    .flatMap((record) => record.professionalTasks.filter((task) => task.taskType === 'DISPLAY_SAMPLE').map((task) => ({ record, task })))
    .filter(({ task }) => !ui.displayTeamFilter || getEngineeringIndependentProfessionalTaskCurrentTeam(task) === ui.displayTeamFilter)
}

function independentTaskCurrentAction(task: EngineeringIndependentProfessionalTask): string {
  if (task.status === 'WAIT_DEPENDENCY') return '等待需要先完成的工作'
  if (task.status === 'WAIT_REVIEW') return '由买手审核本次成果'
  if (task.status === 'REWORK') return '只重做未通过的成果'
  if (task.status === 'COMPLETED') return '已完成'
  if ((task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') && !task.colorRequirementConfirmedAt) return '由跟单填写潘通色号和颜色名称'
  return task.status === 'IN_PROGRESS' ? '制作并提交真实成果' : '开始本项工作'
}

const displaySampleColumns: StandardListColumn<DisplaySampleListRow>[] = [
  { key: 'task', title: '任务号', width: 230, required: true, freezeable: true, sortable: true, sortValue: ({ task }) => task.taskId, render: ({ task }) => `<a class="font-medium text-blue-700" href="/pcs/engineering/sampling-professional/${escapeHtml(task.taskId)}">${escapeHtml(task.taskId)}</a>` },
  { key: 'source', title: '由哪张单发起', width: 160, sortable: true, sortValue: ({ record }) => record.samplingTaskCode, render: ({ record }) => `<p class="font-medium">${escapeHtml(record.samplingTaskCode)}</p><p class="text-xs text-slate-500">${TYPE_TEXT[record.samplingType]}</p>` },
  { key: 'style', title: '目标款式', width: 300, required: true, render: ({ record }) => { const style = getStyleArchiveById(record.targetStyleId); return style ? imageButton(style.mainImageUrl, style.styleName, `<span class="block"><strong>${escapeHtml(style.styleCode)}</strong><small class="block text-slate-500">${escapeHtml(style.styleName)}</small></span>`) : escapeHtml(record.targetStyleCode) } },
  { key: 'team', title: '当前需处理的团队', width: 160, render: ({ task }) => escapeHtml(getEngineeringIndependentProfessionalTaskCurrentTeam(task) || '-') },
  { key: 'actionText', title: '当前动作', width: 220, render: ({ task }) => escapeHtml(independentTaskCurrentAction(task)) },
  { key: 'status', title: '状态', width: 120, sortable: true, sortValue: ({ task }) => TASK_STATUS_TEXT[task.status], render: ({ task }) => `<span class="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">${escapeHtml(TASK_STATUS_TEXT[task.status])}</span>` },
  { key: 'plan', title: '计划完成', width: 130, sortable: true, sortValue: ({ task }) => task.plannedCompleteAt, render: ({ task }) => escapeHtml(task.plannedCompleteAt || '-') },
  { key: 'updated', title: '最后更新', width: 170, sortable: true, sortValue: ({ record }) => record.updatedAt, render: ({ record }) => escapeHtml(record.updatedAt) },
  { key: 'action', title: '操作', width: 100, actionColumn: true, render: ({ task }) => `<a class="inline-flex h-8 items-center rounded border px-3 text-xs" href="/pcs/engineering/sampling-professional/${escapeHtml(task.taskId)}">查看详情</a>` },
]

const displaySampleListController = createProcessOrderListController({
  state: displaySampleListState,
  columns: displaySampleColumns,
  preferenceKey: 'higood-pcs-display-sample-list-preferences-v1',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: PREFIX,
  rootSelector: '[data-independent-sampling-list="DISPLAY_SAMPLE"]',
  tableSurfaceSelector: '[data-independent-sampling-table]',
  paginationSurfaceSelector: '[data-independent-sampling-pagination]',
  overlaysSurfaceSelector: '[data-independent-sampling-overlays]',
  defaultFrozenKeys: ['task'],
  columnSettingsTitle: '销售展示样衣任务列表列设置',
  emptyText: '暂无销售展示样衣任务',
  getRows: displaySampleRows,
})

function currentListController() {
  return isDisplaySampleListPath() ? displaySampleListController : listControllers[currentListType()]
}

function renderList(type: EngineeringIndependentSamplingType): string {
  const controller = listControllers[type]
  const view = controller.getView(); controller.installColumnDragEvents()
  return `<div data-independent-sampling-list="${type}">${renderStandardListPage({
    title: `${TYPE_TEXT[type]}任务`,
    primaryActionsHtml: `<button class="h-9 rounded border px-4 text-sm" data-${PREFIX}-action="open-column-settings">列设置</button><button class="h-9 rounded bg-blue-600 px-4 text-sm text-white" data-${PREFIX}-action="open-create" data-sampling-type="${type}">新建${TYPE_TEXT[type]}</button>`,
    feedbackHtml: feedbackHtml(),
    filtersHtml: `<div class="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-[260px_1fr]"><label class="text-sm text-slate-600"><span>当前需处理的团队</span><select class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="teamFilter"><option value="">全部团队</option>${teamOptions(type).map((team) => `<option value="${escapeHtml(team)}" ${ui.teamFilter[type] === team ? 'selected' : ''}>${escapeHtml(team)}</option>`).join('')}</select></label><p class="self-end text-sm text-slate-500">${type === 'REVISION' ? '来源 SPU 和目标 SPU 均必须已建档' : '目标 SPU 必须已建档'}；该筛选只用于快速找到当前该由哪个团队处理的任务。</p></div>`,
    listTitle: `共 ${listRows(type).length} 条`, tableHtml: `<div data-independent-sampling-table>${view.tableHtml}</div>`, paginationHtml: `<div data-independent-sampling-pagination>${view.paginationHtml}</div>`, overlaysHtml: `<div data-independent-sampling-overlays>${controller.renderColumnSettings()}</div>${renderDialogHost()}`,
  })}</div>`
}
export function renderPcsRevisionSamplingListPage(): string { return renderList('REVISION') }
export function renderPcsDesignSamplingListPage(): string { return renderList('DESIGN') }

export function renderPcsDisplaySampleTaskListPage(): string {
  const view = displaySampleListController.getView()
  displaySampleListController.installColumnDragEvents()
  const teams = [...new Set(listEngineeringIndependentSamplingRecords().flatMap((record) => record.professionalTasks.filter((task) => task.taskType === 'DISPLAY_SAMPLE').map(getEngineeringIndependentProfessionalTaskCurrentTeam)).filter(Boolean))].sort()
  return `<div data-independent-sampling-list="DISPLAY_SAMPLE">${renderStandardListPage({
    title: '销售展示样衣任务',
    primaryActionsHtml: `<button class="h-9 rounded border px-4 text-sm" data-${PREFIX}-action="open-column-settings">列设置</button>`,
    feedbackHtml: feedbackHtml(),
    filtersHtml: `<div class="rounded-lg border bg-white p-4"><label class="block max-w-xs text-sm text-slate-600"><span>当前需处理的团队</span><select class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="displayTeamFilter"><option value="">全部团队</option>${teams.map((team) => `<option value="${escapeHtml(team)}" ${ui.displayTeamFilter === team ? 'selected' : ''}>${escapeHtml(team)}</option>`).join('')}</select></label></div>`,
    listTitle: `共 ${displaySampleRows().length} 条`,
    tableHtml: `<div data-independent-sampling-table>${view.tableHtml}</div>`,
    paginationHtml: `<div data-independent-sampling-pagination>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-independent-sampling-overlays>${displaySampleListController.renderColumnSettings()}</div>${renderDialogHost()}`,
  })}</div>`
}

function styleCard(styleId: string, label: string): string {
  const style = getStyleArchiveById(styleId); if (!style) return ''
  return `<div class="rounded-lg border bg-white p-4"><p class="mb-2 text-xs text-slate-500">${escapeHtml(label)}</p>${imageButton(style.mainImageUrl, style.styleName, `<span><strong>${escapeHtml(style.styleCode)}</strong><small class="block text-slate-500">${escapeHtml(style.styleName)}</small></span>`)}</div>`
}

function renderBomSummary(record: EngineeringIndependentSamplingRecord): string {
  const versions = record.bomVersionIds.map(getEngineeringBomVersionById).filter(Boolean)
  const lineCount = versions.reduce((sum, version) => sum + (version?.materialLines.length || 0), 0)
  return `<section class="rounded-lg border bg-white p-4"><div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="font-semibold">BOM 与价格</h2><p class="mt-1 text-sm text-slate-500">B 款共 ${versions.length} 个颜色版本、${lineCount} 条用料；只能由买手维护。</p></div><a class="rounded border border-blue-200 px-4 py-2 text-sm text-blue-700" href="/pcs/technical-data/bom-pricing/${escapeHtml(record.bomDraftVersionId)}">进入 B 款 BOM 与价格</a></div></section>`
}

function renderColorMapping(record: EngineeringIndependentSamplingRecord): string {
  if (record.samplingType !== 'REVISION') return ''
  const sourceColors = [...new Set(listSkuArchivesByStyleId(record.sourceStyleId).map((sku) => sku.colorName.trim() || '待确认颜色'))]
  const targetGroups = getEngineeringIndependentTargetColorGroups(record.samplingTaskId)
  if (record.bomConversionStatus !== 'WAIT_COLOR_MAPPING') return `<section class="rounded-lg border bg-white p-4"><h2 class="font-semibold">A 款颜色 → B 款颜色</h2><div class="mt-3 overflow-x-auto"><table class="w-full min-w-[620px] text-sm"><thead><tr class="border-b bg-slate-50 text-left"><th class="p-3">B 款颜色</th><th class="p-3">对应方式</th><th class="p-3">A 款参考颜色</th><th class="p-3">确认人</th></tr></thead><tbody>${record.colorMappings.map((item) => `<tr class="border-b"><td class="p-3">${escapeHtml(item.targetColor)}</td><td class="p-3">${escapeHtml(item.mappingType)}</td><td class="p-3">${escapeHtml(item.sourceColor || '无，B 款新增')}</td><td class="p-3">${escapeHtml(item.confirmedBy)} · ${escapeHtml(item.confirmedAt)}</td></tr>`).join('')}</tbody></table></div></section>`
  return `<section class="rounded-lg border bg-white p-4"><div><h2 class="font-semibold">第 1 步：确认 A 款颜色如何对应 B 款颜色</h2><p class="mt-1 text-sm text-slate-500">A 款只是参考；B 款每个颜色都要单独确认来源。</p></div><div class="mt-3 overflow-x-auto"><table class="w-full min-w-[760px] text-sm"><thead><tr class="border-b bg-slate-50 text-left"><th class="p-3">B 款颜色</th><th class="p-3">对应方式</th><th class="p-3">A 款参考颜色</th></tr></thead><tbody>${targetGroups.map((group) => `<tr class="border-b" data-color-mapping-row="${escapeHtml(group.productColor)}"><td class="p-3 font-medium">${escapeHtml(group.productColor)}</td><td class="p-3"><select class="h-9 rounded border px-2" data-${PREFIX}-field="mappingType"><option>沿用颜色</option><option>改为新颜色</option><option>B 款新增颜色</option></select></td><td class="p-3"><select class="h-9 min-w-52 rounded border px-2" data-${PREFIX}-field="sourceColor"><option value="">无来源颜色</option>${sourceColors.map((color) => `<option value="${escapeHtml(color)}">${escapeHtml(color)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div><button class="mt-4 rounded bg-blue-600 px-4 py-2 text-sm text-white" data-${PREFIX}-action="confirm-color-mappings" data-sampling-id="${escapeHtml(record.samplingTaskId)}">买手确认颜色对应</button></section>`
}

function materialSkuOptions(selected = ''): string {
  return listMaterialArchives().filter((archive) => archive.status === 'ACTIVE').flatMap((archive) => listMaterialSkuRecordsByMaterialId(archive.materialId).filter((sku) => sku.status === 'ACTIVE' && sku.costPrice > 0).map((sku) => `<option value="${escapeHtml(sku.materialSkuId)}" ${sku.materialSkuId === selected ? 'selected' : ''}>${escapeHtml(sku.materialSkuCode)} · ${escapeHtml(archive.materialName)}</option>`)).join('')
}

function renderMaterialConversion(record: EngineeringIndependentSamplingRecord): string {
  if (record.samplingType !== 'REVISION' || record.bomConversionStatus === 'WAIT_COLOR_MAPPING') return ''
  const locked = record.bomConversionStatus === 'CONFIRMED'
  return `<section class="rounded-lg border bg-white p-4"><div><h2 class="font-semibold">第 2 步：确认 A 款物料如何变成 B 款用料</h2><p class="mt-1 text-sm text-slate-500">每条来源物料必须选择沿用、替换、重新染色、重新印花或不使用；最终全部归入 B 款 BOM。</p></div>${record.materialConversionLines.length ? `<div class="mt-3 overflow-x-auto"><table class="w-full min-w-[1120px] text-sm"><thead><tr class="border-b bg-slate-50 text-left"><th class="p-3">B 款颜色</th><th class="p-3">A 款参考物料</th><th class="p-3">处理方式</th><th class="p-3">B 款物料</th><th class="p-3">染色</th><th class="p-3">印花</th><th class="p-3">说明</th></tr></thead><tbody>${record.materialConversionLines.map((line) => `<tr class="border-b" data-material-conversion-row="${escapeHtml(line.conversionLineId)}"><td class="p-3">${escapeHtml(line.targetProductColor)}</td><td class="p-3"><div class="flex items-center gap-2">${line.sourceMaterialImageUrl ? imageButton(line.sourceMaterialImageUrl, line.sourceMaterialName) : ''}<span>${escapeHtml(line.sourceMaterialName)}<small class="block text-slate-500">${escapeHtml(line.sourceMaterialSkuId)}</small></span></div></td><td class="p-3">${locked ? escapeHtml(line.decision) : `<select class="h-9 rounded border px-2" data-${PREFIX}-field="materialDecision"><option>沿用</option><option>替换</option><option>重新染色</option><option>重新印花</option><option>不使用</option></select>`}</td><td class="p-3">${locked ? `${escapeHtml(line.targetMaterialName)}<small class="block text-slate-500">${escapeHtml(line.targetMaterialSkuId || '-')}</small>` : `<select class="h-9 min-w-64 rounded border px-2" data-${PREFIX}-field="targetMaterialSkuId">${materialSkuOptions(line.targetMaterialSkuId)}</select>`}</td><td class="p-3">${locked ? line.dyeRequirement : `<select class="h-9 rounded border px-2" data-${PREFIX}-field="dyeRequirement"><option ${line.dyeRequirement === '否' ? 'selected' : ''}>否</option><option ${line.dyeRequirement === '是' ? 'selected' : ''}>是</option></select>`}</td><td class="p-3">${locked ? line.printRequirement : `<select class="h-9 rounded border px-2" data-${PREFIX}-field="printRequirement"><option ${line.printRequirement === '否' ? 'selected' : ''}>否</option><option ${line.printRequirement === '是' ? 'selected' : ''}>是</option></select>`}</td><td class="p-3">${locked ? escapeHtml(line.note || '-') : `<input class="h-9 min-w-44 rounded border px-2" value="${escapeHtml(line.note)}" data-${PREFIX}-field="conversionNote" placeholder="处理说明">`}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mt-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-700">当前颜色没有可引用的 A 款 BOM，请买手直接在 B 款 BOM 与价格中新增用料。</p>'}${locked ? `<p class="mt-4 text-sm text-emerald-700">买手 ${escapeHtml(record.bomConversionConfirmedBy)} 已确认，${escapeHtml(record.bomConversionConfirmedAt)}。</p>` : `<button class="mt-4 rounded bg-blue-600 px-4 py-2 text-sm text-white" data-${PREFIX}-action="confirm-material-conversions" data-sampling-id="${escapeHtml(record.samplingTaskId)}">买手确认 B 款用料</button>`}</section>`
}

function dependencyNames(record: EngineeringIndependentSamplingRecord, task: EngineeringIndependentProfessionalTask): string {
  return task.dependsOnTaskIds.length ? task.dependsOnTaskIds.map((id) => record.professionalTasks.find((item) => item.taskId === id)?.taskName || '前一项工作').join('、') : '无'
}

function nextTeam(record: EngineeringIndependentSamplingRecord, task: EngineeringIndependentProfessionalTask): string {
  const dependents = record.professionalTasks.filter((item) => item.dependsOnTaskIds.includes(task.taskId))
  if (dependents.length) return dependents.map((item) => item.ownerTeamName).join('、')
  return record.professionalTasks.every((item) => item.taskId === task.taskId || item.status === 'COMPLETED') ? '跟单团队确认整单成果' : '其他并行团队继续处理'
}

function renderWorkPlan(record: EngineeringIndependentSamplingRecord): string {
  if (record.status === 'DRAFT') {
    const suggested = suggestEngineeringIndependentTaskTypes(record)
    return `<section class="rounded-lg border bg-white p-4"><div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="font-semibold">本次工作安排</h2><p class="mt-1 text-sm text-slate-500">系统根据打样目的和 B 款 BOM 建议，跟单确认后一次生成；销售展示样衣为必做。</p></div><button class="rounded bg-blue-600 px-4 py-2 text-sm text-white" data-${PREFIX}-action="confirm-plan" data-sampling-id="${escapeHtml(record.samplingTaskId)}">确认并生成工作</button></div><div class="mt-3 grid gap-2 md:grid-cols-3">${TASK_OPTIONS.map((item) => `<label class="flex items-center gap-2 rounded border p-3 text-sm"><input type="checkbox" data-${PREFIX}-field="planTaskType" value="${item.value}" ${suggested.includes(item.value) ? 'checked' : ''}>${item.label}${suggested.includes(item.value) ? '<span class="ml-auto rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">建议</span>' : ''}</label>`).join('')}</div></section>`
  }
  return `<section class="overflow-hidden rounded-lg border bg-white"><div class="border-b px-4 py-3"><h2 class="font-semibold">本次需要完成的工作</h2></div><div class="overflow-x-auto"><table class="w-full min-w-[1080px] text-sm"><thead><tr class="border-b bg-slate-50 text-left"><th class="p-3">任务</th><th class="p-3">当前团队</th><th class="p-3">当前动作</th><th class="p-3">需要先完成</th><th class="p-3">完成后去向</th><th class="p-3">状态</th><th class="p-3">操作</th></tr></thead><tbody>${record.professionalTasks.map((task) => `<tr class="border-b"><td class="p-3 font-medium">${escapeHtml(task.taskName)}</td><td class="p-3">${escapeHtml(getEngineeringIndependentProfessionalTaskCurrentTeam(task) || '-')}</td><td class="p-3">${escapeHtml(task.status === 'WAIT_DEPENDENCY' ? '等待前面工作完成' : task.status === 'WAIT_REVIEW' ? '审核本次成果' : task.status === 'REWORK' ? '根据未通过项重做' : task.status === 'COMPLETED' ? '无' : (task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') && !task.colorRequirementConfirmedAt ? '填写潘通色号和颜色名称' : task.status === 'IN_PROGRESS' ? '制作并提交成果' : '开始本项工作')}</td><td class="p-3">${escapeHtml(dependencyNames(record, task))}</td><td class="p-3">${escapeHtml(nextTeam(record, task))}</td><td class="p-3">${escapeHtml(TASK_STATUS_TEXT[task.status])}</td><td class="p-3"><a class="text-blue-700" href="/pcs/engineering/sampling-professional/${escapeHtml(task.taskId)}">进入任务</a></td></tr>`).join('')}</tbody></table></div></section>`
}

export function renderPcsIndependentSamplingDetailPage(type: EngineeringIndependentSamplingType, id: string): string {
  const record = getEngineeringIndependentSamplingRecord(id)
  if (!record || record.samplingType !== type) return '<section class="p-6"><h1 class="text-xl font-semibold">任务不存在</h1></section>'
  return `<section class="space-y-4 p-4"><header class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4"><div><div class="flex items-center gap-2"><h1 class="text-xl font-semibold">${TYPE_TEXT[type]} · ${escapeHtml(record.samplingTaskCode)}</h1><span class="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">${STATUS_TEXT[record.status]}</span></div><p class="mt-1 text-sm text-slate-500">跟单：${escapeHtml(record.merchandiserName)} · 当前需处理的团队：${escapeHtml(getEngineeringIndependentCurrentTeam(record))}</p></div><a class="rounded border px-4 py-2 text-sm" href="/pcs/engineering/${type === 'REVISION' ? 'revision' : 'design'}-sampling">返回列表</a></header>${feedbackHtml()}<section class="rounded-lg border bg-white p-4"><h2 class="font-semibold">任务说明</h2><p class="mt-2 text-sm text-slate-700">${escapeHtml(record.creationReason)}</p></section><div class="grid gap-3 md:grid-cols-2">${record.sourceStyleId ? styleCard(record.sourceStyleId, 'A 款：基于款式（参考）') : ''}${styleCard(record.targetStyleId, 'B 款：最终做成款式')}</div>${renderColorMapping(record)}${renderMaterialConversion(record)}${renderBomSummary(record)}${renderWorkPlan(record)}<section class="rounded-lg border bg-white p-4"><h2 class="font-semibold">整单成果</h2>${record.status === 'WAIT_CONFIRMATION' ? `<div class="mt-3 grid gap-2"><input class="h-9 rounded border px-3" data-${PREFIX}-field="resultVersion" placeholder="成果版本，如 v1.0"><textarea class="rounded border p-3" data-${PREFIX}-field="resultSummary" placeholder="本次实际完成的样衣和成果说明"></textarea><button class="rounded bg-blue-600 px-4 py-2 text-white" data-${PREFIX}-action="confirm-result" data-sampling-id="${escapeHtml(record.samplingTaskId)}">跟单确认整张任务成果</button></div>` : `<p class="mt-3 text-sm">${record.resultVersion ? `${escapeHtml(record.resultVersion)} · ${escapeHtml(record.resultSummary)}` : '待全部专业任务完成'}</p>`}</section><section class="rounded-lg border bg-white p-4"><h2 class="font-semibold">操作记录</h2><div class="mt-3 space-y-2">${record.operationLogs.map((log) => `<div class="grid gap-1 border-b pb-2 text-sm md:grid-cols-[160px_200px_1fr]"><span>${escapeHtml(log.occurredAt)}</span><span>${escapeHtml(log.operatorName)} · ${escapeHtml(log.action)}</span><span class="text-slate-500">${escapeHtml(log.detail)}</span></div>`).join('')}</div></section>${renderDialogHost()}</section>`
}

function findProfessional(taskId: string): { record: EngineeringIndependentSamplingRecord; task: EngineeringIndependentProfessionalTask } | null {
  for (const record of listEngineeringIndependentSamplingRecords()) { const task = record.professionalTasks.find((item) => item.taskId === taskId); if (task) return { record, task } }
  return null
}
function uploadPurposes(task: EngineeringIndependentProfessionalTask): Array<{ purpose: EngineeringUploadPurpose; label: string; requiredHint: string }> {
  if (task.taskType === 'BASE_PATTERN') return [{ purpose: 'PATTERN_SOURCE', label: '基码纸样源文件', requiredHint: '必须包含真实 .prj 纸样文件；可同时上传 .dxf、.rul 或 .pdf。' }]
  if (task.taskType === 'DISPLAY_SAMPLE') return [{ purpose: 'SAMPLE_RESULT', label: '销售展示样衣图片', requiredHint: '必须上传与 B 款真实对应的样衣图片。' }]
  if (task.taskType === 'PATTERN_ARTWORK') return [{ purpose: 'PATTERN_ARTWORK', label: '花型源文件与预览图', requiredHint: '必须同时包含 .ai、.psd 或 .pdf 源文件，以及可视预览图。' }]
  return [{ purpose: 'COLOR_RESULT', label: '调色成果', requiredHint: '必须上传实际色样或调色成果图片。' }]
}
function professionalFiles(task: EngineeringIndependentProfessionalTask) { return uploadPurposes(task).flatMap(({ purpose }) => listEngineeringTaskUploadedFiles(task.taskId, 'TASK', purpose)) }
function taskDraftValue(task: EngineeringIndependentProfessionalTask, field: string, fallback = ''): string {
  return ui.taskDrafts[task.taskId]?.[field] ?? fallback
}

function renderProfessionalResultFields(task: EngineeringIndependentProfessionalTask): string {
  const common = `<label class="text-sm text-slate-600">成果名称<input class="mt-1 h-10 w-full rounded border px-3" data-pcs-independent-sampling-field="resultTitle" value="${escapeHtml(taskDraftValue(task, 'resultTitle'))}" placeholder="请填写这次实际交付的成果名称"></label>`
  if (task.taskType === 'BASE_PATTERN') {
    return `${common}<div class="grid gap-3 md:grid-cols-2"><label class="text-sm text-slate-600">纸样版本<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="resultVersion" value="${escapeHtml(taskDraftValue(task, 'resultVersion'))}" placeholder="如 v1.0"></label><label class="text-sm text-slate-600">适用部位／尺码<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="applicablePartOrSize" value="${escapeHtml(taskDraftValue(task, 'applicablePartOrSize'))}" placeholder="如基码 / M 码"></label></div><label class="text-sm text-slate-600">纸样说明<textarea class="mt-1 min-h-20 w-full rounded border p-3" data-${PREFIX}-field="resultDescription" placeholder="说明纸样范围和本轮调整">${escapeHtml(taskDraftValue(task, 'resultDescription'))}</textarea></label>`
  }
  if (task.taskType === 'DISPLAY_SAMPLE') {
    return `${common}<div class="grid gap-3 md:grid-cols-4"><label class="text-sm text-slate-600">制作数量<input type="number" min="1" class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="sampleQuantity" value="${escapeHtml(taskDraftValue(task, 'sampleQuantity', '1'))}"></label><label class="text-sm text-slate-600">颜色<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="sampleColor" value="${escapeHtml(taskDraftValue(task, 'sampleColor'))}"></label><label class="text-sm text-slate-600">尺码<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="sampleSize" value="${escapeHtml(taskDraftValue(task, 'sampleSize'))}"></label><label class="text-sm text-slate-600">使用的纸样版本<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="sourcePatternVersion" value="${escapeHtml(taskDraftValue(task, 'sourcePatternVersion'))}"></label></div><label class="text-sm text-slate-600">制作说明<textarea class="mt-1 min-h-20 w-full rounded border p-3" data-${PREFIX}-field="resultDescription">${escapeHtml(taskDraftValue(task, 'resultDescription'))}</textarea></label>`
  }
  if (task.taskType === 'PATTERN_ARTWORK') {
    return `${common}<div class="grid gap-3 md:grid-cols-2"><label class="text-sm text-slate-600">花型版本<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="resultVersion" value="${escapeHtml(taskDraftValue(task, 'resultVersion'))}" placeholder="如 v1.0"></label><label class="text-sm text-slate-600">花型说明<textarea class="mt-1 min-h-20 w-full rounded border p-3" data-${PREFIX}-field="resultDescription">${escapeHtml(taskDraftValue(task, 'resultDescription'))}</textarea></label></div>`
  }
  return `${common}<div class="grid gap-3 md:grid-cols-2"><label class="text-sm text-slate-600">染厂色号<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="dyeColorCode" value="${escapeHtml(taskDraftValue(task, 'dyeColorCode', task.dyeColorCode))}"></label><label class="text-sm text-slate-600">调色说明<textarea class="mt-1 min-h-20 w-full rounded border p-3" data-${PREFIX}-field="resultDescription">${escapeHtml(taskDraftValue(task, 'resultDescription'))}</textarea></label></div>`
}

function renderProfessionalResultDetails(task: EngineeringIndependentProfessionalTask, result: EngineeringIndependentProfessionalTask['results'][number]): string {
  const details: Array<[string, string]> = []
  if (result.version) details.push(['版本', result.version])
  if (result.applicablePartOrSize) details.push(['适用部位／尺码', result.applicablePartOrSize])
  if (result.sampleQuantity) details.push(['制作数量', `${result.sampleQuantity} 件`])
  if (result.sampleColor) details.push(['颜色', result.sampleColor])
  if (result.sampleSize) details.push(['尺码', result.sampleSize])
  if (result.sourcePatternVersion) details.push(['使用纸样', result.sourcePatternVersion])
  if ((task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') && task.dyeColorCode) details.push(['染厂色号', task.dyeColorCode])
  if (result.description) details.push(['说明', result.description])
  return details.length ? `<dl class="mt-3 grid gap-2 rounded bg-slate-50 p-3 text-sm md:grid-cols-2">${details.map(([label, content]) => `<div><dt class="text-xs text-slate-500">${escapeHtml(label)}</dt><dd class="mt-1 text-slate-800">${escapeHtml(content)}</dd></div>`).join('')}</dl>` : ''
}

export function renderPcsIndependentSamplingProfessionalTaskPage(taskId: string): string {
  const found = findProfessional(taskId)
  if (!found) return '<section class="p-6"><h1 class="text-xl font-semibold">任务不存在</h1></section>'
  const { record, task } = found
  const style = getStyleArchiveById(record.targetStyleId)
  const isColor = task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC'
  const canSubmit = ['IN_PROGRESS', 'REWORK'].includes(task.status)
  const currentTeam = getEngineeringIndependentProfessionalTaskCurrentTeam(task) || '-'
  const files = professionalFiles(task)
  const waitingColorRequirement = isColor && !task.colorRequirementConfirmedAt && ['WAIT_START', 'IN_PROGRESS', 'REWORK'].includes(task.status)
  return `<section class="space-y-4 p-4"><header class="rounded-lg border bg-white"><div class="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div><div class="flex items-center gap-2"><h1 class="text-xl font-semibold">${escapeHtml(task.taskName)}</h1><span class="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">${escapeHtml(TASK_STATUS_TEXT[task.status])}</span></div><p class="mt-1 text-sm text-slate-500">${escapeHtml(record.samplingTaskCode)} · 目标款式 ${escapeHtml(record.targetStyleCode)} · 来源：${TYPE_TEXT[record.samplingType]}</p></div><a class="rounded border px-4 py-2 text-sm" href="/pcs/engineering/${record.samplingType === 'REVISION' ? 'revision' : 'design'}-sampling/${escapeHtml(record.samplingTaskId)}">返回主任务</a></div><div class="grid gap-4 px-5 py-4 md:grid-cols-[2fr_1fr_1fr_1fr]">${style ? `<div class="flex items-center gap-3">${imageButton(style.mainImageUrl, style.styleName)}<div><p class="font-medium">${escapeHtml(style.styleName)}</p><p class="text-sm text-slate-500">${escapeHtml(style.styleCode)}</p></div></div>` : '<div>-</div>'}<div><p class="text-xs text-slate-500">当前需处理的团队</p><p class="mt-1 font-medium">${escapeHtml(currentTeam)}</p></div><div><p class="text-xs text-slate-500">需要先完成</p><p class="mt-1 font-medium">${escapeHtml(dependencyNames(record, task))}</p></div><div><p class="text-xs text-slate-500">完成后去向</p><p class="mt-1 font-medium">${escapeHtml(nextTeam(record, task))}</p></div></div><div class="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-5 py-4"><div><p class="text-xs text-slate-500">当前动作</p><p class="mt-1 text-sm">${escapeHtml(waitingColorRequirement ? '由跟单填写潘通色号和颜色名称' : task.status === 'WAIT_START' ? '由当前团队开始制作' : task.status === 'IN_PROGRESS' ? '上传并提交本次真实成果' : task.status === 'WAIT_REVIEW' ? '由买手逐项审核成果' : task.status === 'REWORK' ? '只重做未通过的成果' : task.status === 'COMPLETED' ? '本项工作已完成' : '等待需要先完成的工作')}</p></div>${task.status === 'WAIT_START' && !waitingColorRequirement ? `<button class="rounded bg-blue-600 px-4 py-2 text-white" data-${PREFIX}-action="start-task" data-task-id="${escapeHtml(task.taskId)}">开始任务</button>` : ''}</div></header>${feedbackHtml()}${isColor ? `<section class="rounded-lg border bg-white p-4"><h2 class="font-semibold">颜色要求</h2><div class="mt-3 grid gap-3 md:grid-cols-3"><label class="text-sm text-slate-600">潘通色号<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="pantoneColorCode" value="${escapeHtml(task.pantoneColorCode)}" ${task.colorRequirementConfirmedAt ? 'readonly' : ''}></label><label class="text-sm text-slate-600">颜色名称<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="colorName" value="${escapeHtml(task.colorName)}" ${task.colorRequirementConfirmedAt ? 'readonly' : ''}></label><div class="self-end text-sm text-slate-500">${task.colorRequirementConfirmedAt ? `跟单已确认 · ${escapeHtml(task.colorRequirementConfirmedBy)} · ${escapeHtml(task.colorRequirementConfirmedAt)}` : '待跟单确认'}</div></div>${!task.colorRequirementConfirmedAt && ['WAIT_START', 'IN_PROGRESS', 'REWORK'].includes(task.status) ? `<button class="mt-4 rounded border border-blue-200 px-4 py-2 text-blue-700" data-${PREFIX}-action="confirm-color-requirement" data-task-id="${escapeHtml(task.taskId)}">跟单确认颜色要求</button>` : ''}</section>` : ''}${canSubmit ? `<section class="rounded-lg border bg-white p-4"><h2 class="font-semibold">提交本次成果</h2><div class="mt-3 grid gap-3">${renderProfessionalResultFields(task)}${uploadPurposes(task).map(({ purpose, label, requiredHint }) => renderEngineeringFileUpload({ taskId: task.taskId, purpose, files: listEngineeringTaskUploadedFiles(task.taskId, 'TASK', purpose), label, requiredHint, eventPrefix: PREFIX })).join('')}</div><button class="mt-4 rounded bg-blue-600 px-4 py-2 text-white" data-${PREFIX}-action="submit-task" data-task-id="${escapeHtml(task.taskId)}">提交本次工作</button></section>` : ''}<section class="rounded-lg border bg-white p-4"><h2 class="font-semibold">成果记录</h2><div class="mt-3 grid gap-3 md:grid-cols-2">${task.results.length ? task.results.map((result) => `<article class="rounded border p-3"><div class="flex items-center justify-between gap-2"><strong>${escapeHtml(result.title)}</strong><span class="text-xs ${result.status === 'REJECTED' ? 'text-red-600' : result.status === 'APPROVED' ? 'text-emerald-700' : 'text-amber-700'}">${result.status === 'APPROVED' ? '已通过' : result.status === 'REJECTED' ? '未通过' : '待审核'}</span></div>${renderProfessionalResultDetails(task, result)}<div class="mt-3 space-y-2">${result.files.map((file) => `<div class="flex items-center justify-between gap-2 rounded bg-slate-50 px-3 py-2 text-sm"><span class="truncate">${escapeHtml(file.fileName)} · ${(file.sizeBytes / 1024).toFixed(0)} KB · 第 ${file.roundNo} 轮</span><div class="flex gap-2">${['jpg','jpeg','png','webp'].includes(file.extension) ? `<button class="text-blue-700" data-${PREFIX}-upload-preview data-file-url="${escapeHtml(file.dataUrl)}" data-file-name="${escapeHtml(file.fileName)}">查看大图</button>` : ''}<a class="text-blue-700" href="${escapeHtml(file.dataUrl)}" download="${escapeHtml(file.fileName)}">下载</a></div></div>`).join('')}</div>${task.status === 'WAIT_REVIEW' ? `<div class="mt-3 grid gap-2"><label class="text-sm"><input type="radio" name="review-${escapeHtml(result.resultId)}" value="approve" checked data-${PREFIX}-review-result="${escapeHtml(result.resultId)}"> 通过</label><label class="text-sm"><input type="radio" name="review-${escapeHtml(result.resultId)}" value="reject" data-${PREFIX}-review-result="${escapeHtml(result.resultId)}"> 不通过</label><input class="h-9 rounded border px-2 text-sm" data-${PREFIX}-review-reason="${escapeHtml(result.resultId)}" placeholder="不通过原因"></div>` : result.rejectReason ? `<p class="mt-2 text-sm text-red-600">${escapeHtml(result.rejectReason)}</p>` : ''}</article>`).join('') : '<p class="text-sm text-slate-500">尚未提交成果</p>'}</div>${task.status === 'WAIT_REVIEW' ? `<button class="mt-4 rounded bg-blue-600 px-4 py-2 text-white" data-${PREFIX}-action="review-task" data-task-id="${escapeHtml(task.taskId)}">买手提交整张审核</button>` : ''}</section><section class="rounded-lg border bg-white p-4"><h2 class="font-semibold">操作记录</h2><div class="mt-3 space-y-2">${record.operationLogs.filter((log) => log.detail.includes(task.taskName) || log.action === '创建任务').map((log) => `<p class="border-b pb-2 text-sm"><span class="text-slate-500">${escapeHtml(log.occurredAt)}</span> · ${escapeHtml(log.operatorName)} · ${escapeHtml(log.action)} · ${escapeHtml(log.detail)}</p>`).join('') || '<p class="text-sm text-slate-500">暂无操作记录</p>'}</div></section>${renderDialogHost()}</section>`
}

function readColorMappings() {
  return [...document.querySelectorAll<HTMLElement>('[data-color-mapping-row]')].map((row) => ({
    targetColor: row.dataset.colorMappingRow || '',
    mappingType: value('mappingType', row) as '沿用颜色' | '改为新颜色' | 'B 款新增颜色',
    sourceColor: value('sourceColor', row),
  }))
}
function readMaterialDecisions() {
  return [...document.querySelectorAll<HTMLElement>('[data-material-conversion-row]')].map((row) => ({
    conversionLineId: row.dataset.materialConversionRow || '',
    decision: value('materialDecision', row) as EngineeringIndependentMaterialDecision,
    targetMaterialSkuId: value('targetMaterialSkuId', row),
    dyeRequirement: value('dyeRequirement', row) as '是' | '否',
    printRequirement: value('printRequirement', row) as '是' | '否',
    note: value('conversionNote', row),
  }))
}

export function handlePcsIndependentSamplingEvent(target: HTMLElement): boolean {
  const previewOpen = target.closest<HTMLElement>(`[data-${PREFIX}-upload-preview]`)
  if (previewOpen) { ui.preview = { url: previewOpen.dataset.fileUrl || '', fileName: previewOpen.dataset.fileName || '成果图片' }; refreshDialogs(); return true }
  if (target.closest(`[data-${PREFIX}-upload-preview-close]`)) { ui.preview = null; refreshDialogs(); return true }
  const remove = target.closest<HTMLElement>(`[data-${PREFIX}-upload-remove]`)
  if (remove) { run(() => removeEngineeringTaskUploadedFile({ taskId: remove.dataset.taskId || '', itemId: remove.dataset.itemId, fileId: remove.dataset.fileId || '' }), '文件已删除。'); return true }
  const node = target.closest<HTMLElement>(`[data-${PREFIX}-action]`); if (!node) return false
  const action = node.dataset.pcsIndependentSamplingAction || ''
  const controller = currentListController()
  if (action === 'prev-page' || action === 'next-page') { controller.stepPage(action === 'next-page' ? 1 : -1); controller.refresh(); return true }
  if (action === 'sort-column') { controller.cycleSort(node.dataset.columnKey || ''); controller.refresh(); return true }
  if (action === 'open-column-settings') { listStates[currentListType()].showColumnSettings = true; controller.refresh({ table: false, pagination: false, overlays: true }); return true }
  if (action === 'close-column-settings') { listStates[currentListType()].showColumnSettings = false; controller.refresh({ table: false, pagination: false, overlays: true }); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') { const key = node.dataset.pcsIndependentSamplingColumnKey || node.closest<HTMLElement>('[data-pcs-independent-sampling-column-key]')?.dataset.pcsIndependentSamplingColumnKey || ''; controller.updateColumnPreference(action, key, target instanceof HTMLInputElement ? target.checked : undefined); controller.refresh({ overlays: true }); return true }
  if (action === 'restore-column-settings') { controller.restorePreferences(); controller.refresh({ overlays: true }); return true }
  if (action === 'open-image') { ui.preview = { url: node.dataset.imageUrl || '', fileName: node.dataset.imageAlt || '款式图片' }; refreshDialogs(); return true }
  if (action === 'close-image') { ui.preview = null; refreshDialogs(); return true }
  if (action === 'open-create') { ui.createType = node.dataset.samplingType as EngineeringIndependentSamplingType; ui.createDraft = { sourceStyleId: '', targetStyleId: '', creationReason: '' }; setFeedback(''); refreshDialogs(); return true }
  if (action === 'close-create') { if (target !== node && target.closest('section')) return true; ui.createType = ''; ui.createDraft = { sourceStyleId: '', targetStyleId: '', creationReason: '' }; refreshDialogs(); return true }
  if (action === 'create') { const type = node.dataset.samplingType as EngineeringIndependentSamplingType; run(() => { const created = createEngineeringIndependentSampling({ samplingType: type, sourceStyleId: type === 'REVISION' ? ui.createDraft.sourceStyleId : undefined, targetStyleId: ui.createDraft.targetStyleId, creationReason: ui.createDraft.creationReason, merchandiser: CURRENT_PCS_ENGINEERING_USER, createdAt: nowText() }); ui.createType = ''; ui.createDraft = { sourceStyleId: '', targetStyleId: '', creationReason: '' }; window.history.pushState({}, '', `/pcs/engineering/${type === 'REVISION' ? 'revision' : 'design'}-sampling/${created.samplingTaskId}`); window.dispatchEvent(new PopStateEvent('popstate')) }, '任务草稿已创建。'); return true }
  if (action === 'confirm-color-mappings') { run(() => confirmEngineeringIndependentColorMappings({ samplingTaskId: node.dataset.samplingId || '', actor: BUYER, mappings: readColorMappings() }), '颜色对应已确认，请继续逐条确认 B 款用料。'); return true }
  if (action === 'confirm-material-conversions') { run(() => confirmEngineeringIndependentMaterialConversions({ samplingTaskId: node.dataset.samplingId || '', actor: BUYER, decisions: readMaterialDecisions() }), 'B 款用料已确认并归入 B 款 BOM。'); return true }
  if (action === 'confirm-plan') { run(() => confirmEngineeringIndependentSamplingPlan({ samplingTaskId: node.dataset.samplingId || '', actor: CURRENT_PCS_ENGINEERING_USER, selectedTaskTypes: checkedTaskTypes() }), '本次工作安排已确认，专业任务已一次生成。'); return true }
  if (action === 'start-task') { const found = findProfessional(node.dataset.taskId || ''); run(() => { if (!found) throw new Error('任务不存在。'); startEngineeringIndependentProfessionalTask({ taskId: found.task.taskId, actor: EXECUTORS[found.task.taskType] }) }, '任务已开始。'); return true }
  if (action === 'confirm-color-requirement') { run(() => confirmEngineeringIndependentColorRequirement({ taskId: node.dataset.taskId || '', actor: CURRENT_PCS_ENGINEERING_USER, pantoneColorCode: value('pantoneColorCode'), colorName: value('colorName') }), '颜色要求已确认。'); return true }
  if (action === 'submit-task') { const found = findProfessional(node.dataset.taskId || ''); run(() => { if (!found) throw new Error('任务不存在。'); submitEngineeringIndependentProfessionalTask({ taskId: found.task.taskId, actor: EXECUTORS[found.task.taskType], results: [{ title: value('resultTitle'), version: value('resultVersion'), description: value('resultDescription'), applicablePartOrSize: value('applicablePartOrSize'), sampleQuantity: Number(value('sampleQuantity')) || 0, sampleColor: value('sampleColor'), sampleSize: value('sampleSize'), sourcePatternVersion: value('sourcePatternVersion'), files: professionalFiles(found.task) }], dyeColorCode: value('dyeColorCode') }) }, '本次工作已提交。'); return true }
  if (action === 'review-task') { const taskId = node.dataset.taskId || ''; const found = findProfessional(taskId); run(() => { if (!found) throw new Error('任务不存在。'); const decisions = found.task.results.map((result) => { const selected = document.querySelector<HTMLInputElement>(`[data-${PREFIX}-review-result="${result.resultId}"]:checked`); return { resultId: result.resultId, approved: selected?.value === 'approve', reason: document.querySelector<HTMLInputElement>(`[data-${PREFIX}-review-reason="${result.resultId}"]`)?.value || '' } }); reviewEngineeringIndependentProfessionalTask({ taskId, actor: BUYER, decisions }) }, '买手审核结果已提交。'); return true }
  if (action === 'confirm-result') { run(() => confirmEngineeringIndependentSamplingResult({ samplingTaskId: node.dataset.samplingId || '', actor: CURRENT_PCS_ENGINEERING_USER, resultVersion: value('resultVersion'), resultSummary: value('resultSummary'), confirmedAt: nowText() }), '整张任务成果已确认。'); return true }
  return false
}

export function handlePcsIndependentSamplingInput(target: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): boolean {
  // 本页输入由各自的局部处理器保存或刷新；阻止全局输入处理再次整页渲染，
  // 否则创建弹窗和成果表单中尚未提交的值会在一次选择/输入后被清空。
  target.dataset.skipPageRerender = 'true'
  const upload = target.closest<HTMLInputElement>(`[data-${PREFIX}-upload-input]`)
  if (upload) {
    const found = findProfessional(upload.dataset.taskId || '')
    const files = Array.from(upload.files || [])
    if (!found || !files.length) return true
    setFeedback('正在读取并保存文件…'); rerender()
    void uploadEngineeringTaskFiles({ taskId: found.task.taskId, itemId: upload.dataset.itemId, purpose: upload.dataset.uploadPurpose as EngineeringUploadPurpose, files, actor: { ...EXECUTORS[found.task.taskType], teamName: found.task.ownerTeamName } }).then(() => { setFeedback('文件已真实读取并保存。'); rerender() }).catch((error) => { setFeedback(error instanceof Error ? error.message : '文件上传失败。', false); rerender() })
    return true
  }
  if (target.matches(`[data-${PREFIX}-field="pageSize"]`)) { const controller = currentListController(); controller.setPageSize(Number(target.value)); controller.refresh(); return true }
  if (target.matches(`[data-${PREFIX}-field="teamFilter"]`)) { const type = currentListType(); ui.teamFilter[type] = target.value; listStates[type].currentPage = 1; rerender(); return true }
  if (target.matches(`[data-${PREFIX}-field="displayTeamFilter"]`)) { ui.displayTeamFilter = target.value; displaySampleListState.currentPage = 1; rerender(); return true }
  if (target.matches(`[data-${PREFIX}-field="sourceStyleId"]`)) { ui.createDraft.sourceStyleId = target.value; return true }
  if (target.matches(`[data-${PREFIX}-field="targetStyleId"]`)) { ui.createDraft.targetStyleId = target.value; return true }
  if (target.matches(`[data-${PREFIX}-field="creationReason"]`)) { ui.createDraft.creationReason = target.value; return true }
  const taskField = target.dataset.pcsIndependentSamplingField
  if (taskField) {
    const taskId = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '')
    if (findProfessional(taskId)) {
      ui.taskDrafts[taskId] ||= {}
      ui.taskDrafts[taskId][taskField] = target.value
    }
  }
  if (target.matches(`[data-${PREFIX}-field], [data-${PREFIX}-review-result], [data-${PREFIX}-review-reason]`)) return true
  return false
}

export function isPcsIndependentSamplingDialogOpen(): boolean { return Boolean(ui.createType || ui.preview) }
