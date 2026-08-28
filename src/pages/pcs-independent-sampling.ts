// @page-pattern: list
import { renderEngineeringFileUpload, renderEngineeringUploadPreview } from '../components/ui/engineering-file-upload.ts'
import { renderStandardListPage } from '../components/ui/list-page.ts'
import { type StandardListColumn } from '../components/ui/list-table.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../components/ui/process-order-list-controller.ts'
import {
  getEngineeringBomPricingPlan,
  getEngineeringBomVersionById,
  resolveEngineeringBomPricingPlan,
  saveEngineeringBomPricingPlan,
} from '../data/pcs-engineering-bom-repository.ts'
import { resolveEngineeringBomDraft } from '../data/pcs-engineering-bom-pricing.ts'
import type { EngineeringBomCustomCostDecision, EngineeringBomCustomCostDraft, EngineeringBomPricingPlanRecord } from '../data/pcs-engineering-bom-types.ts'
import { CURRENT_PCS_ENGINEERING_USER } from '../data/pcs-engineering-current-user.ts'
import {
  completeEngineeringIndependentBuyerPreparation,
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
  getEngineeringIndependentSamplingStep,
  listEngineeringIndependentSamplingRecords,
  listEngineeringIndependentTargetColorSuggestions,
  regenerateEngineeringIndependentBomFromReference,
  replaceEngineeringIndependentDesignFiles,
  returnEngineeringIndependentBuyerPreparation,
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
  EngineeringIndependentSamplingStep,
  EngineeringSampleRequirementLine,
} from '../data/pcs-engineering-master-types.ts'
import {
  listEngineeringTaskUploadedFiles,
  removeEngineeringTaskUploadedFile,
  uploadEngineeringTaskFiles,
} from '../data/pcs-engineering-task-upload-repository.ts'
import {
  captureEngineeringUploadedFiles,
  ENGINEERING_UPLOAD_RULES,
  formatEngineeringUploadSize,
  type EngineeringUploadedFile,
  type EngineeringUploadPurpose,
} from '../data/pcs-engineering-file-upload.ts'
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
const TASK_TYPE_TEXT = '设计改款'
const TASK_STATUS_TEXT: Record<EngineeringIndependentProfessionalTask['status'], string> = { WAIT_DEPENDENCY: '需要先完成其他工作', WAIT_START: '待开始', IN_PROGRESS: '进行中', WAIT_REVIEW: '待买手审核', REWORK: '需要重做', COMPLETED: '已完成' }
const TASK_OPTIONS: Array<{ value: EngineeringIndependentProfessionalTaskType; label: string }> = [
  { value: 'BASE_PATTERN', label: '基码纸样' },
  { value: 'DISPLAY_SAMPLE', label: '销售展示样衣任务' },
  { value: 'PATTERN_ARTWORK', label: '花型任务' },
  { value: 'COLOR_YARN', label: '调色任务（纱线）' },
  { value: 'COLOR_FABRIC', label: '调色任务（面料）' },
]

const ui = {
  createOpen: false,
  createDraft: { sourceStyleId: '', targetStyleId: '', creationReason: '', designFiles: [] as EngineeringUploadedFile[] },
  taskDrafts: {} as Record<string, Record<string, string>>,
  preview: null as { url: string; fileName: string } | null,
  feedback: '', ok: true,
  teamFilter: '',
  displayTeamFilter: '',
  detailStepByTask: {} as Record<string, number>,
  buyerTabByTask: {} as Record<string, 'colors' | 'bom'>,
  colorDraftsByTask: {} as Record<string, Array<{ draftId: string; targetColor: string; sourceColor: string; targetSizeNames: string[] }>>,
  pricingPlanDraftsByTask: {} as Record<string, { customCostDecision: EngineeringBomCustomCostDecision; customCosts: EngineeringBomCustomCostDraft[] }>,
  sampleRequirementDraftsByTask: {} as Record<string, Array<{ draftId: string; targetColor: string; targetSize: string; requiredQuantity: number; requirementNote: string }>>,
  sampleResultDraftsByTask: {} as Record<string, Array<{ draftId: string; requirementLineId: string; title: string; actualColor: string; actualSize: string; actualQuantity: number; sourcePatternVersion: string; productionNote: string; differenceNote: string }>>,
  returnReasonByTask: {} as Record<string, string>,
}

function listControllerState(): ProcessOrderListControllerState {
  return { currentPage: 1, sort: null, preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 }, preferencesLoaded: false, showColumnSettings: false }
}
const listState = listControllerState()
const displaySampleListState = listControllerState()

function nowText(): string { return new Date().toISOString().replace('T', ' ').slice(0, 19) }
function samplingStatusText(record: EngineeringIndependentSamplingRecord): string {
  if (record.status === 'COMPLETED') return '已完成'
  if (record.status === 'WAIT_CONFIRMATION') return '待整单确认'
  if (record.status === 'IN_PROGRESS') return '专业工作中'
  return record.buyerPreparationConfirmedAt ? '待跟单安排' : '新款资料准备中'
}
function feedbackHtml(): string { return ui.feedback ? `<p class="whitespace-pre-line rounded border px-3 py-2 text-sm ${ui.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}">${escapeHtml(ui.feedback)}</p>` : '' }
function setFeedback(message: string, ok = true): void { ui.feedback = message; ui.ok = ok }
function rerender(): void { if (typeof window !== 'undefined') window.dispatchEvent(new Event('higood:request-render')) }
function run(action: () => void, success: string): void { try { action(); setFeedback(success) } catch (error) { setFeedback(error instanceof Error ? error.message : '操作失败。', false) } rerender() }
function value(field: string, scope: ParentNode = document): string { return scope.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[data-${PREFIX}-field="${field}"]`)?.value.trim() || '' }
function checkedTaskTypes(): EngineeringIndependentProfessionalTaskType[] { return [...document.querySelectorAll<HTMLInputElement>(`[data-${PREFIX}-field="planTaskType"]:checked`)].map((node) => node.value as EngineeringIndependentProfessionalTaskType) }
function isDisplaySampleListPath(): boolean { return location.pathname === '/pcs/samples/display-sample' }

export function getIndependentProfessionalTaskDetailPath(task: Pick<EngineeringIndependentProfessionalTask, 'taskId' | 'taskType'>): string {
  if (task.taskType === 'BASE_PATTERN') return `/pcs/patterns/plate-making/${encodeURIComponent(task.taskId)}`
  if (task.taskType === 'PATTERN_ARTWORK') return `/pcs/patterns/artwork/${encodeURIComponent(task.taskId)}`
  if (task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') return `/pcs/engineering/color/${encodeURIComponent(task.taskId)}`
  return `/pcs/samples/display-sample/${encodeURIComponent(task.taskId)}`
}

function imageButton(url: string, alt: string, body = ''): string {
  return `<button type="button" class="flex items-center gap-2 text-left" data-${PREFIX}-action="open-image" data-image-url="${escapeHtml(url)}" data-image-alt="${escapeHtml(alt)}"><span class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border bg-slate-50"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" class="h-full w-full object-cover" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-center text-[10px] text-red-600">图片加载失败</span></span><span>${body}</span></button>`
}

function styleOptions(selected = ''): string {
  return listStyleArchives().filter((style) => style.mainImageUrl).map((style) => `<option value="${escapeHtml(style.styleId)}" ${style.styleId === selected ? 'selected' : ''}>${escapeHtml(style.styleCode)} · ${escapeHtml(style.styleName)}</option>`).join('')
}

function renderCreateDialog(): string {
  if (!ui.createOpen) return ''
  const rule = ENGINEERING_UPLOAD_RULES.DESIGN_IMAGE
  return `<div class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" data-${PREFIX}-action="close-create"><section class="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl" role="dialog" aria-modal="true"><div class="mb-4 flex items-center justify-between"><h2 class="text-lg font-semibold">新建设计改款任务</h2><button type="button" data-${PREFIX}-action="close-create">关闭</button></div><div class="grid gap-4 md:grid-cols-2"><label class="space-y-1 text-sm"><span>参照款式（SPU）</span><select class="h-10 w-full rounded border px-3" data-${PREFIX}-field="sourceStyleId"><option value="">请选择</option>${styleOptions(ui.createDraft.sourceStyleId)}</select></label><label class="space-y-1 text-sm"><span>目标款式（SPU）</span><select class="h-10 w-full rounded border px-3" data-${PREFIX}-field="targetStyleId"><option value="">请选择</option>${styleOptions(ui.createDraft.targetStyleId)}</select></label><label class="space-y-1 text-sm"><span>跟单</span><input class="h-10 w-full rounded border bg-slate-50 px-3" value="${escapeHtml(CURRENT_PCS_ENGINEERING_USER.userName)}" readonly></label><label class="space-y-1 text-sm md:col-span-2"><span>本次设计改款要求</span><textarea class="min-h-24 w-full rounded border p-3" data-${PREFIX}-field="creationReason" placeholder="请说明参照内容、目标变化和样衣要求">${escapeHtml(ui.createDraft.creationReason)}</textarea></label><section class="space-y-3 rounded border bg-slate-50 p-4 md:col-span-2"><div><p class="font-medium">设计稿 <span class="text-red-600">*</span></p><p class="mt-1 text-xs text-slate-500">由跟单上传真实图片；支持 ${rule.extensions.map((item) => `.${item}`).join('、')}，单个文件不超过 ${Math.round(rule.maxSizeBytes / 1024 / 1024)} MB。</p></div><label class="inline-flex h-9 cursor-pointer items-center rounded border border-blue-200 bg-white px-3 text-sm text-blue-700">选择本地设计稿<input class="sr-only" type="file" accept="${escapeHtml(rule.accept)}" multiple data-skip-page-rerender="true" data-${PREFIX}-create-design-upload></label><div class="space-y-2">${ui.createDraft.designFiles.map((file) => `<div class="flex items-center justify-between rounded border bg-white px-3 py-2 text-sm"><div><p class="font-medium">${escapeHtml(file.fileName)}</p><p class="text-xs text-slate-500">${formatEngineeringUploadSize(file.sizeBytes)} · ${escapeHtml(file.uploadedByName)} · ${escapeHtml(file.uploadedAt)}</p></div><div class="flex gap-3"><button type="button" class="text-blue-700" data-${PREFIX}-upload-preview data-file-url="${escapeHtml(file.dataUrl)}" data-file-name="${escapeHtml(file.fileName)}">查看大图</button><button type="button" class="text-red-600" data-${PREFIX}-action="remove-create-design" data-file-id="${escapeHtml(file.fileId)}">删除</button></div></div>`).join('') || '<p class="text-xs text-amber-700">尚未上传设计稿，不能创建。</p>'}</div></section></div><p class="mt-4 rounded bg-blue-50 px-3 py-2 text-sm text-blue-700">创建后进入“新款资料准备”，由买手定义目标颜色，并一次确认物料与整款费用。</p><div class="mt-5 flex justify-end gap-2"><button class="h-9 rounded border px-4" data-${PREFIX}-action="close-create">取消</button><button class="h-9 rounded bg-blue-600 px-4 text-white" data-${PREFIX}-action="create">创建任务</button></div></section></div>`
}

function renderDialogHost(): string {
  return `<div data-independent-sampling-dialogs>${ui.createOpen && ui.feedback ? `<div class="fixed left-1/2 top-6 z-50 w-[min(90vw,48rem)] -translate-x-1/2">${feedbackHtml()}</div>` : ''}${ui.createOpen ? renderCreateDialog() : ''}${renderEngineeringUploadPreview(ui.preview, PREFIX)}</div>`
}
function refreshDialogs(): void {
  document.querySelectorAll<HTMLElement>('[data-independent-sampling-dialogs]').forEach((host) => { host.innerHTML = `${ui.createOpen && ui.feedback ? `<div class="fixed left-1/2 top-6 z-50 w-[min(90vw,48rem)] -translate-x-1/2">${feedbackHtml()}</div>` : ''}${ui.createOpen ? renderCreateDialog() : ''}${renderEngineeringUploadPreview(ui.preview, PREFIX)}` })
}

function listRows(): EngineeringIndependentSamplingRecord[] {
  return listEngineeringIndependentSamplingRecords().filter((record) => !ui.teamFilter || getEngineeringIndependentCurrentTeams(record).includes(ui.teamFilter))
}
function teamOptions(): string[] {
  return [...new Set(listEngineeringIndependentSamplingRecords().flatMap(getEngineeringIndependentCurrentTeams))].sort()
}

function listColumns(): StandardListColumn<EngineeringIndependentSamplingRecord>[] {
  return [
    { key: 'code', title: '任务号', width: 140, required: true, freezeable: true, sortable: true, sortValue: (row) => row.samplingTaskCode, render: (row) => `<a class="font-medium text-blue-700 hover:underline" href="/pcs/engineering/design-revision/${escapeHtml(row.samplingTaskId)}">${escapeHtml(row.samplingTaskCode)}</a>` },
    { key: 'style', title: '参照款式 → 目标款式', width: 390, required: true, render: (row) => { const target = getStyleArchiveById(row.targetStyleId); const source = getStyleArchiveById(row.sourceStyleId); return `<div class="flex items-center gap-2">${source ? imageButton(source.mainImageUrl, source.styleName, `<span class="block"><strong>${escapeHtml(source.styleCode)}</strong><small class="block text-slate-500">${escapeHtml(source.styleName)}</small></span>`) : '<span class="text-red-600">参照款缺失</span>'}<span>→</span>${target ? imageButton(target.mainImageUrl, target.styleName, `<span class="block"><strong>${escapeHtml(target.styleCode)}</strong><small class="block text-slate-500">${escapeHtml(target.styleName)}</small></span>`) : escapeHtml(row.targetStyleCode)}</div>` } },
    { key: 'design', title: '设计稿', width: 130, render: (row) => row.designFiles.length ? `<button type="button" class="text-blue-700 hover:underline" data-${PREFIX}-action="open-image" data-image-url="${escapeHtml(row.designFiles.at(-1)?.dataUrl || '')}" data-image-alt="${escapeHtml(row.designFiles.at(-1)?.fileName || '设计稿')}">查看当前设计稿</button>` : '<span class="text-red-600">缺少设计稿</span>' },
    { key: 'status', title: '状态', width: 140, sortable: true, sortValue: samplingStatusText, render: (row) => `<span class="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">${samplingStatusText(row)}</span>` },
    { key: 'team', title: '当前需处理的团队', width: 150, render: (row) => escapeHtml(getEngineeringIndependentCurrentTeam(row)) },
    { key: 'progress', title: '工作进度', width: 120, render: (row) => `${row.professionalTasks.filter((task) => task.status === 'COMPLETED').length}/${row.professionalTasks.length || '-'}` },
    { key: 'bom', title: 'BOM 与价格', width: 170, render: (row) => row.bomVersionIds.length ? `<a class="text-blue-700 hover:underline" href="/pcs/engineering/design-revision/${escapeHtml(row.samplingTaskId)}?step=buyer&tab=bom">${row.bomVersionIds.length} 个颜色物料方案</a>` : '<span class="text-slate-400">尚未建立</span>' },
    { key: 'owner', title: '跟单', width: 120, render: (row) => escapeHtml(row.merchandiserName) },
    { key: 'updated', title: '更新时间', width: 170, sortable: true, sortValue: (row) => row.updatedAt, render: (row) => escapeHtml(row.updatedAt) },
    { key: 'action', title: '操作', width: 100, actionColumn: true, render: (row) => `<a class="inline-flex h-8 items-center rounded border px-3 text-xs" href="/pcs/engineering/design-revision/${escapeHtml(row.samplingTaskId)}">查看详情</a>` },
  ]
}

const listController = createProcessOrderListController({
    state: listState, columns: listColumns(), preferenceKey: 'higood-pcs-design-revision-list-preferences-v1',
    pageSizeOptions: [10, 20, 50], eventPrefix: PREFIX, rootSelector: '[data-independent-sampling-list="DESIGN_REVISION"]',
    tableSurfaceSelector: '[data-independent-sampling-table]', paginationSurfaceSelector: '[data-independent-sampling-pagination]', overlaysSurfaceSelector: '[data-independent-sampling-overlays]',
    defaultFrozenKeys: ['code'], columnSettingsTitle: '设计改款任务列表列设置', emptyText: '暂无设计改款任务', getRows: listRows,
  })

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
  { key: 'task', title: '任务号', width: 230, required: true, freezeable: true, sortable: true, sortValue: ({ task }) => task.taskId, render: ({ task }) => `<a class="font-medium text-blue-700" href="${getIndependentProfessionalTaskDetailPath(task)}">${escapeHtml(task.taskId)}</a>` },
  { key: 'source', title: '由哪张单发起', width: 160, sortable: true, sortValue: ({ record }) => record.samplingTaskCode, render: ({ record }) => `<p class="font-medium">${escapeHtml(record.samplingTaskCode)}</p><p class="text-xs text-slate-500">${TASK_TYPE_TEXT}</p>` },
  { key: 'style', title: '目标款式', width: 300, required: true, render: ({ record }) => { const style = getStyleArchiveById(record.targetStyleId); return style ? imageButton(style.mainImageUrl, style.styleName, `<span class="block"><strong>${escapeHtml(style.styleCode)}</strong><small class="block text-slate-500">${escapeHtml(style.styleName)}</small></span>`) : escapeHtml(record.targetStyleCode) } },
  { key: 'team', title: '当前需处理的团队', width: 160, render: ({ task }) => escapeHtml(getEngineeringIndependentProfessionalTaskCurrentTeam(task) || '-') },
  { key: 'actionText', title: '当前动作', width: 220, render: ({ task }) => escapeHtml(independentTaskCurrentAction(task)) },
  { key: 'status', title: '状态', width: 120, sortable: true, sortValue: ({ task }) => TASK_STATUS_TEXT[task.status], render: ({ task }) => `<span class="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">${escapeHtml(TASK_STATUS_TEXT[task.status])}</span>` },
  { key: 'plan', title: '计划完成', width: 130, sortable: true, sortValue: ({ task }) => task.plannedCompleteAt, render: ({ task }) => escapeHtml(task.plannedCompleteAt || '-') },
  { key: 'updated', title: '最后更新', width: 170, sortable: true, sortValue: ({ record }) => record.updatedAt, render: ({ record }) => escapeHtml(record.updatedAt) },
  { key: 'action', title: '操作', width: 100, actionColumn: true, render: ({ task }) => `<a class="inline-flex h-8 items-center rounded border px-3 text-xs" href="${getIndependentProfessionalTaskDetailPath(task)}">查看详情</a>` },
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
  return isDisplaySampleListPath() ? displaySampleListController : listController
}

export function renderPcsDesignRevisionListPage(): string {
  const view = listController.getView(); listController.installColumnDragEvents()
  return `<div data-independent-sampling-list="DESIGN_REVISION">${renderStandardListPage({
    title: '设计改款任务',
    primaryActionsHtml: `<button class="h-9 rounded bg-blue-600 px-4 text-sm text-white" data-${PREFIX}-action="open-create">新建设计改款</button>`,
    feedbackHtml: feedbackHtml(),
    filtersHtml: `<div class="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-[260px_1fr]"><label class="text-sm text-slate-600"><span>当前需处理的团队</span><select class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="teamFilter"><option value="">全部团队</option>${teamOptions().map((team) => `<option value="${escapeHtml(team)}" ${ui.teamFilter === team ? 'selected' : ''}>${escapeHtml(team)}</option>`).join('')}</select></label><p class="self-end text-sm text-slate-500">参照 SPU 和目标 SPU 均必须已建档且不能相同；设计稿由跟单上传。</p></div>`,
    listTitle: `共 ${listRows().length} 条`, listActionsHtml: `<button class="h-9 rounded border px-4 text-sm" data-${PREFIX}-action="open-column-settings">列设置</button>`, tableHtml: `<div data-independent-sampling-table>${view.tableHtml}</div>`, paginationHtml: `<div data-independent-sampling-pagination>${view.paginationHtml}</div>`, overlaysHtml: `<div data-independent-sampling-overlays>${listController.renderColumnSettings()}</div>${renderDialogHost()}`,
  })}</div>`
}

export function renderPcsDisplaySampleTaskListPage(): string {
  const view = displaySampleListController.getView()
  displaySampleListController.installColumnDragEvents()
  const teams = [...new Set(listEngineeringIndependentSamplingRecords().flatMap((record) => record.professionalTasks.filter((task) => task.taskType === 'DISPLAY_SAMPLE').map(getEngineeringIndependentProfessionalTaskCurrentTeam)).filter(Boolean))].sort()
  return `<div data-independent-sampling-list="DISPLAY_SAMPLE">${renderStandardListPage({
    title: '销售展示样衣任务',
    listActionsHtml: `<button class="h-9 rounded border px-4 text-sm" data-${PREFIX}-action="open-column-settings">列设置</button>`,
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

type IndependentColorDraft = { draftId: string; targetColor: string; sourceColor: string; targetSizeNames: string[] }

function targetSizeOptions(record: EngineeringIndependentSamplingRecord): string[] {
  return [...new Set(listSkuArchivesByStyleId(record.targetStyleId).filter((sku) => sku.archiveStatus === 'ACTIVE').map((sku) => sku.sizeName.trim()).filter(Boolean))]
}

function ensureColorDrafts(record: EngineeringIndependentSamplingRecord): IndependentColorDraft[] {
  if (!ui.colorDraftsByTask[record.samplingTaskId]) {
    const allSizes = targetSizeOptions(record)
    ui.colorDraftsByTask[record.samplingTaskId] = record.colorMappings.length
      ? record.colorMappings.map((mapping, index) => ({
          draftId: mapping.mappingId || `${record.samplingTaskId}-COLOR-${index + 1}`,
          targetColor: mapping.targetColor,
          sourceColor: mapping.sourceColor,
          targetSizeNames: mapping.targetSizeNames.length ? [...mapping.targetSizeNames] : [...allSizes],
        }))
      : [{ draftId: `${record.samplingTaskId}-COLOR-DRAFT-1`, targetColor: '', sourceColor: '', targetSizeNames: [...allSizes] }]
  }
  return ui.colorDraftsByTask[record.samplingTaskId]
}

type IndependentPricingPlanDraft = {
  customCostDecision: EngineeringBomCustomCostDecision
  customCosts: EngineeringBomCustomCostDraft[]
}

function ensurePricingPlanDraft(record: EngineeringIndependentSamplingRecord): IndependentPricingPlanDraft {
  const existing = ui.pricingPlanDraftsByTask[record.samplingTaskId]
  if (existing) return existing
  const plan = getEngineeringBomPricingPlan('INDEPENDENT_SAMPLING', record.samplingTaskId)
  const draft: IndependentPricingPlanDraft = {
    customCostDecision: plan?.customCostDecision || 'UNDECIDED',
    customCosts: (plan?.customCosts || []).map((cost) => ({ ...cost })),
  }
  ui.pricingPlanDraftsByTask[record.samplingTaskId] = draft
  return draft
}

function syncPricingPlanDraftFromDom(samplingTaskId: string): void {
  const decision = document.querySelector<HTMLSelectElement>(`[data-${PREFIX}-field="customCostDecision"]`)
  if (!decision) return
  const current = ui.pricingPlanDraftsByTask[samplingTaskId] || { customCostDecision: 'UNDECIDED' as const, customCosts: [] }
  const customCostDecision = decision.value as EngineeringBomCustomCostDecision
  const customCosts = [...document.querySelectorAll<HTMLElement>('[data-independent-pricing-cost-row]')].map((row, index) => {
    const customCostId = row.dataset.independentPricingCostRow || current.customCosts[index]?.customCostId || ''
    const field = (name: string) => row.querySelector<HTMLInputElement>(`[data-${PREFIX}-field="${name}"]`)?.value || ''
    return {
      customCostId,
      title: field('customCostTitle').trim(),
      amountIdr: Number(field('customCostAmount')) || 0,
      note: field('customCostNote').trim(),
      displayOrder: index + 1,
    }
  })
  ui.pricingPlanDraftsByTask[samplingTaskId] = {
    customCostDecision,
    customCosts: customCostDecision === 'HAS_CUSTOM_COST' ? customCosts : [],
  }
}

function renderBomSummary(record: EngineeringIndependentSamplingRecord): string {
  const versions = record.bomVersionIds.map(getEngineeringBomVersionById).filter((version): version is NonNullable<typeof version> => Boolean(version))
  if (!versions.length) {
    return '<section class="rounded-lg border border-dashed bg-slate-50 p-5 text-sm text-slate-600"><h3 class="font-semibold text-slate-800">颜色物料方案</h3><p class="mt-2">确认目标颜色后，系统才会按颜色逐一建立物料方案。</p></section>'
  }
  const readonly = Boolean(record.buyerPreparationConfirmedAt || record.taskPlanConfirmedAt)
  return `<section class="rounded-lg border bg-white"><header class="border-b px-4 py-3"><h3 class="font-semibold">颜色物料方案</h3><p class="mt-1 text-sm text-slate-500">共 ${versions.length} 个目标颜色；仅买手可维护，每个颜色单独保存物料，不能单独确认。</p></header><div class="divide-y">${versions.map((version) => {
    const mapping = record.colorMappings.find((item) => item.targetColor === version.productColor)
    const source = version.sourceVersionId ? getEngineeringBomVersionById(version.sourceVersionId) : null
    const sourceText = mapping?.sourceColor
      ? `参考：${record.sourceStyleCode} · ${mapping.sourceColor}${source ? ` · ${source.versionCode}` : ''}`
      : '无参考色，由买手自行维护'
    return `<div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><p class="font-medium">${escapeHtml(version.productColor)} · ${escapeHtml(version.versionCode)}</p><p class="mt-1 text-xs text-slate-500">${version.materialLines.length} 条物料 · ${escapeHtml(sourceText)}${version.editingLockedAt ? ` · 已于 ${escapeHtml(version.editingLockedAt)} 锁定` : ''}</p></div><div class="flex flex-wrap gap-2">${!readonly && mapping?.sourceColor ? `<button type="button" class="rounded border border-amber-300 px-3 py-2 text-sm text-amber-800" data-${PREFIX}-action="regenerate-bom-from-reference" data-sampling-id="${escapeHtml(record.samplingTaskId)}" data-target-color="${escapeHtml(version.productColor)}">重新按参考色生成</button>` : ''}<a class="rounded border border-blue-200 px-3 py-2 text-sm text-blue-700" href="/pcs/technical-data/bom-pricing/${escapeHtml(version.bomDraftVersionId)}">${readonly ? '查看该颜色物料' : '维护该颜色物料'}</a></div></div>`
  }).join('')}</div></section>`
}

function renderPricingPlanCosts(record: EngineeringIndependentSamplingRecord, readonly: boolean): string {
  const plan = getEngineeringBomPricingPlan('INDEPENDENT_SAMPLING', record.samplingTaskId)
  if (!plan) return '<section class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">整款 BOM 与价格方案不存在，请重新确认目标颜色。</section>'
  const draft = readonly
    ? { customCostDecision: plan.customCostDecision, customCosts: plan.customCosts.map((cost) => ({ ...cost })) }
    : ensurePricingPlanDraft(record)
  const versions = record.bomVersionIds.map(getEngineeringBomVersionById).filter((version): version is NonNullable<typeof version> => Boolean(version))
  let resolved: ReturnType<typeof resolveEngineeringBomDraft> | null = null
  try {
    resolved = resolveEngineeringBomDraft({
      materialLines: versions.flatMap((version) => version.materialLines),
      customCosts: draft.customCosts,
    })
  } catch { resolved = null }
  const editable = !readonly && plan.status === 'DRAFT' && !plan.editingLockedAt
  const feeRows = draft.customCosts.length
    ? draft.customCosts.map((cost, index) => `<div class="grid gap-3 border-t p-3 md:grid-cols-[1fr_220px_1fr_80px]" data-independent-pricing-cost-row="${escapeHtml(cost.customCostId || `${record.samplingTaskId}-COST-${index + 1}`)}"><input class="h-9 rounded border px-3" data-${PREFIX}-field="customCostTitle" value="${escapeHtml(cost.title)}" placeholder="费用名称，如车位费" ${editable ? '' : 'disabled'}><label class="flex items-center gap-2"><span>Rp</span><input class="h-9 w-full rounded border px-3" type="number" min="1" step="1" data-${PREFIX}-field="customCostAmount" value="${cost.amountIdr || ''}" placeholder="金额" ${editable ? '' : 'disabled'}></label><input class="h-9 rounded border px-3" data-${PREFIX}-field="customCostNote" value="${escapeHtml(cost.note || '')}" placeholder="备注" ${editable ? '' : 'disabled'}>${editable ? `<button class="text-sm text-red-600" data-${PREFIX}-action="remove-custom-cost" data-sampling-id="${escapeHtml(record.samplingTaskId)}" data-cost-index="${index}">删除</button>` : '<span class="text-sm text-slate-500">已锁定</span>'}</div>`).join('')
    : '<p class="border-t p-5 text-center text-sm text-slate-500">暂无自定义费用明细。</p>'
  return `<section class="overflow-hidden rounded-lg border bg-white"><header class="flex flex-wrap items-start justify-between gap-3 px-4 py-3"><div><h3 class="font-semibold">整款费用与综合成本</h3><p class="mt-1 text-sm text-slate-500">费用统一作用于整个 SPU，只维护、计算和确认一次；物料与费用将在交给跟单时一起校验。</p></div>${editable ? `<button class="rounded border px-3 py-2 text-sm text-blue-700" data-${PREFIX}-action="add-custom-cost" data-sampling-id="${escapeHtml(record.samplingTaskId)}">新增费用</button>` : '<span class="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">已锁定</span>'}</header><div class="border-t p-4"><label class="block max-w-md text-sm"><span class="mb-1 block text-slate-600">本次费用情况</span><select class="h-9 w-full rounded border px-3" data-${PREFIX}-field="customCostDecision" ${editable ? '' : 'disabled'}><option value="UNDECIDED" ${draft.customCostDecision === 'UNDECIDED' ? 'selected' : ''}>请选择</option><option value="NO_CUSTOM_COST" ${draft.customCostDecision === 'NO_CUSTOM_COST' ? 'selected' : ''}>本次无自定义费用</option><option value="HAS_CUSTOM_COST" ${draft.customCostDecision === 'HAS_CUSTOM_COST' ? 'selected' : ''}>本次有自定义费用</option></select></label></div><div>${feeRows}</div><div class="grid gap-3 border-t bg-slate-50 p-4 md:grid-cols-5"><article><p class="text-xs text-slate-500">物料成本</p><p class="mt-1 font-semibold">${resolved ? `¥ ${resolved.cost.materialCostCny.toFixed(2)}` : '待校验'}</p></article><article><p class="text-xs text-slate-500">自定义费用</p><p class="mt-1 font-semibold">${resolved ? `Rp ${resolved.cost.customCostIdr.toLocaleString('id-ID')}` : '待校验'}</p></article><article><p class="text-xs text-slate-500">系统最新汇率</p><p class="mt-1 font-semibold">${resolved ? `1 CNY = ${resolved.cost.exchangeRateIdrPerCny.toLocaleString('id-ID')} IDR` : '待校验'}</p></article><article><p class="text-xs text-slate-500">综合成本 CNY</p><p class="mt-1 font-semibold text-blue-700">${resolved ? `¥ ${resolved.cost.comprehensiveCostCny.toFixed(2)}` : '待校验'}</p></article><article><p class="text-xs text-slate-500">综合成本 IDR</p><p class="mt-1 font-semibold text-blue-700">${resolved ? `Rp ${resolved.cost.comprehensiveCostIdr.toLocaleString('id-ID')}` : '待校验'}</p></article></div></section>`
}

function renderColorMapping(record: EngineeringIndependentSamplingRecord, locked: boolean): string {
  const sourceColors = [...new Set(listSkuArchivesByStyleId(record.sourceStyleId).filter((sku) => sku.archiveStatus === 'ACTIVE').map((sku) => sku.colorName.trim()).filter(Boolean))]
  const allSizes = targetSizeOptions(record)
  const drafts = ensureColorDrafts(record)
  const suggestions = listEngineeringIndependentTargetColorSuggestions(record.samplingTaskId)
  const suggestionListId = `${PREFIX}-target-color-suggestions-${record.samplingTaskId}`
  return `<section class="rounded-lg border bg-white"><header class="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3"><div><h3 class="font-semibold">新款颜色与参照款颜色</h3><p class="mt-1 text-sm text-slate-500">新款颜色由买手自行定义，数量可多于或少于参照款；每个颜色至少选择一个新款尺码，参照色可以不选。</p></div>${locked ? '<span class="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">已完成</span>' : `<button class="rounded border px-3 py-2 text-sm" data-${PREFIX}-action="add-color-row" data-sampling-id="${escapeHtml(record.samplingTaskId)}">新增颜色</button>`}</header>${suggestions.length && !record.colorMappings.length ? `<p class="mx-4 mt-3 text-xs text-slate-500">可直接选择款式档案已有颜色，也可以输入新颜色：${suggestions.map((item) => escapeHtml(item.productColor)).join('、')}</p><datalist id="${escapeHtml(suggestionListId)}">${suggestions.map((item) => `<option value="${escapeHtml(item.productColor)}"></option>`).join('')}</datalist>` : ''}<div class="overflow-x-auto"><table class="w-full min-w-[900px] text-sm"><thead><tr class="border-b bg-slate-50 text-left"><th class="p-3">新款颜色</th><th class="p-3">参照款颜色（可不选）</th><th class="p-3">适用新款尺码</th>${locked ? '<th class="p-3">确认记录</th>' : '<th class="p-3 text-right">操作</th>'}</tr></thead><tbody>${drafts.map((draft, index) => `<tr class="border-b" data-color-mapping-row="${escapeHtml(draft.draftId)}"><td class="p-3">${locked ? `<strong>${escapeHtml(draft.targetColor)}</strong>` : `<input class="h-9 w-full min-w-40 rounded border px-2" data-${PREFIX}-field="targetColor" value="${escapeHtml(draft.targetColor)}" ${suggestions.length ? `list="${escapeHtml(suggestionListId)}"` : ''} placeholder="输入或选择新款颜色">`}</td><td class="p-3">${locked ? escapeHtml(draft.sourceColor || '无参考色') : `<select class="h-9 min-w-52 rounded border px-2" data-${PREFIX}-field="sourceColor"><option value="">无参考色</option>${sourceColors.map((color) => `<option value="${escapeHtml(color)}" ${color === draft.sourceColor ? 'selected' : ''}>${escapeHtml(color)}</option>`).join('')}</select>`}</td><td class="p-3"><div class="flex flex-wrap gap-3">${allSizes.map((size) => `<label class="inline-flex items-center gap-1 ${locked ? 'text-slate-600' : ''}"><input type="checkbox" data-${PREFIX}-field="targetSizeName" value="${escapeHtml(size)}" ${draft.targetSizeNames.includes(size) ? 'checked' : ''} ${locked ? 'disabled' : ''}>${escapeHtml(size)}</label>`).join('') || '<span class="text-red-600">目标款式暂无尺码，请先维护款式档案</span>'}</div></td>${locked ? `<td class="p-3 text-xs text-slate-500">${escapeHtml(record.colorMappings[index]?.confirmedBy || '-')}<br>${escapeHtml(record.colorMappings[index]?.confirmedAt || '-')}</td>` : `<td class="p-3 text-right"><button class="text-red-600" data-${PREFIX}-action="remove-color-row" data-sampling-id="${escapeHtml(record.samplingTaskId)}" data-draft-id="${escapeHtml(draft.draftId)}">删除</button></td>`}</tr>`).join('')}</tbody></table></div>${locked ? '' : `<div class="flex justify-end p-4"><button class="rounded bg-blue-600 px-4 py-2 text-sm text-white" data-${PREFIX}-action="confirm-color-mappings" data-sampling-id="${escapeHtml(record.samplingTaskId)}">确认目标颜色并建立 BOM</button></div>`}</section>`
}

function materialSkuOptions(selected = ''): string {
  return listMaterialArchives().filter((archive) => archive.status === 'ACTIVE').flatMap((archive) => listMaterialSkuRecordsByMaterialId(archive.materialId).filter((sku) => sku.status === 'ACTIVE' && sku.costPrice > 0).map((sku) => `<option value="${escapeHtml(sku.materialSkuId)}" ${sku.materialSkuId === selected ? 'selected' : ''}>${escapeHtml(sku.materialSkuCode)} · ${escapeHtml(archive.materialName)}</option>`)).join('')
}

function renderMaterialConversion(record: EngineeringIndependentSamplingRecord): string {
  if (record.bomConversionStatus === 'WAIT_COLOR_MAPPING') return ''
  const locked = Boolean(record.buyerPreparationConfirmedAt || record.taskPlanConfirmedAt)
  const decisionOptions: EngineeringIndependentMaterialDecision[] = ['沿用', '替换', '重新染色', '重新印花', '不使用']
  return `<section class="rounded-lg border bg-white p-4"><div><h3 class="font-semibold">参考物料处理</h3><p class="mt-1 text-sm text-slate-500">仅处理已明确选择旧款参考色的物料；处理结果写入对应的新款颜色物料方案。</p></div>${record.materialConversionLines.length ? `<div class="mt-3 overflow-x-auto"><table class="w-full min-w-[1120px] text-sm"><thead><tr class="border-b bg-slate-50 text-left"><th class="p-3">新款颜色</th><th class="p-3">旧款参考物料</th><th class="p-3">处理方式</th><th class="p-3">新款物料</th><th class="p-3">染色</th><th class="p-3">印花</th><th class="p-3">说明</th></tr></thead><tbody>${record.materialConversionLines.map((line) => `<tr class="border-b" data-material-conversion-row="${escapeHtml(line.conversionLineId)}"><td class="p-3">${escapeHtml(line.targetProductColor)}</td><td class="p-3"><div class="flex items-center gap-2">${line.sourceMaterialImageUrl ? imageButton(line.sourceMaterialImageUrl, line.sourceMaterialName) : ''}<span>${escapeHtml(line.sourceMaterialName)}<small class="block text-slate-500">${escapeHtml(line.sourceMaterialSkuId)}</small></span></div></td><td class="p-3">${locked ? escapeHtml(line.decision) : `<select class="h-9 rounded border px-2" data-${PREFIX}-field="materialDecision">${decisionOptions.map((decision) => `<option ${decision === (line.decision || '沿用') ? 'selected' : ''}>${decision}</option>`).join('')}</select>`}</td><td class="p-3">${locked ? `${escapeHtml(line.targetMaterialName)}<small class="block text-slate-500">${escapeHtml(line.targetMaterialSkuId || '-')}</small>` : `<select class="h-9 min-w-64 rounded border px-2" data-${PREFIX}-field="targetMaterialSkuId">${materialSkuOptions(line.targetMaterialSkuId)}</select>`}</td><td class="p-3">${locked ? line.dyeRequirement : `<select class="h-9 rounded border px-2" data-${PREFIX}-field="dyeRequirement"><option ${line.dyeRequirement === '否' ? 'selected' : ''}>否</option><option ${line.dyeRequirement === '是' ? 'selected' : ''}>是</option></select>`}</td><td class="p-3">${locked ? line.printRequirement : `<select class="h-9 rounded border px-2" data-${PREFIX}-field="printRequirement"><option ${line.printRequirement === '否' ? 'selected' : ''}>否</option><option ${line.printRequirement === '是' ? 'selected' : ''}>是</option></select>`}</td><td class="p-3">${locked ? escapeHtml(line.note || '-') : `<input class="h-9 min-w-44 rounded border px-2" value="${escapeHtml(line.note)}" data-${PREFIX}-field="conversionNote" placeholder="处理说明">`}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mt-3 rounded bg-slate-50 px-3 py-2 text-sm text-slate-600">没有选择旧款参考色，或参考色没有可用的正式 BOM。请直接维护各新款颜色的物料方案。</p>'}${locked || !record.materialConversionLines.length ? '' : `<button class="mt-4 rounded border border-blue-200 px-4 py-2 text-sm text-blue-700" data-${PREFIX}-action="confirm-material-conversions" data-sampling-id="${escapeHtml(record.samplingTaskId)}">应用参考物料处理结果</button>`}</section>`
}

function dependencyNames(record: EngineeringIndependentSamplingRecord, task: EngineeringIndependentProfessionalTask): string {
  return task.dependsOnTaskIds.length ? task.dependsOnTaskIds.map((id) => record.professionalTasks.find((item) => item.taskId === id)?.taskName || '前一项工作').join('、') : '无'
}

function nextTeam(record: EngineeringIndependentSamplingRecord, task: EngineeringIndependentProfessionalTask): string {
  const dependents = record.professionalTasks.filter((item) => item.dependsOnTaskIds.includes(task.taskId))
  if (dependents.length) return dependents.map((item) => item.ownerTeamName).join('、')
  return record.professionalTasks.every((item) => item.taskId === task.taskId || item.status === 'COMPLETED') ? '跟单团队确认整单成果' : '其他并行团队继续处理'
}

function ensureSampleRequirementDrafts(record: EngineeringIndependentSamplingRecord): typeof ui.sampleRequirementDraftsByTask[string] {
  if (ui.sampleRequirementDraftsByTask[record.samplingTaskId]) return ui.sampleRequirementDraftsByTask[record.samplingTaskId]
  const saved = record.professionalTasks.find((task) => task.taskType === 'DISPLAY_SAMPLE')?.sampleRequirements || []
  ui.sampleRequirementDraftsByTask[record.samplingTaskId] = saved.length
    ? saved.map((line) => ({
      draftId: line.requirementLineId,
      targetColor: line.targetColor,
      targetSize: line.targetSize,
      requiredQuantity: line.requiredQuantity,
      requirementNote: line.requirementNote,
    }))
    : record.colorMappings.flatMap((mapping) => mapping.targetSizeNames.map((targetSize, index) => ({
      draftId: `${record.samplingTaskId}-DISPLAY-REQ-DRAFT-${mapping.mappingId}-${index + 1}`,
      targetColor: mapping.targetColor,
      targetSize,
      requiredQuantity: 1,
      requirementNote: '',
    })))
  return ui.sampleRequirementDraftsByTask[record.samplingTaskId]
}

function renderSampleRequirementTable(record: EngineeringIndependentSamplingRecord, locked: boolean): string {
  const drafts = ensureSampleRequirementDrafts(record)
  const colorOptions = record.colorMappings.map((mapping) => mapping.targetColor)
  const sizeOptions = [...new Set(record.colorMappings.flatMap((mapping) => mapping.targetSizeNames))]
  const rows = drafts.map((draft) => `<tr class="border-b" data-sample-requirement-row="${escapeHtml(draft.draftId)}">
    <td class="p-3">${locked ? escapeHtml(draft.targetColor) : `<select class="h-9 min-w-36 rounded border px-2" data-${PREFIX}-field="sampleRequirementColor">${colorOptions.map((color) => `<option ${color === draft.targetColor ? 'selected' : ''}>${escapeHtml(color)}</option>`).join('')}</select>`}</td>
    <td class="p-3">${locked ? escapeHtml(draft.targetSize) : `<select class="h-9 min-w-28 rounded border px-2" data-${PREFIX}-field="sampleRequirementSize">${sizeOptions.map((size) => `<option ${size === draft.targetSize ? 'selected' : ''}>${escapeHtml(size)}</option>`).join('')}</select>`}</td>
    <td class="p-3">${locked ? `${draft.requiredQuantity} 件` : `<input type="number" min="1" step="1" class="h-9 w-24 rounded border px-2" data-${PREFIX}-field="sampleRequirementQuantity" value="${draft.requiredQuantity}">`}</td>
    <td class="p-3">${locked ? escapeHtml(draft.requirementNote || '-') : `<input class="h-9 min-w-64 rounded border px-2" data-${PREFIX}-field="sampleRequirementNote" value="${escapeHtml(draft.requirementNote)}" placeholder="可填写面辅料、工艺或制作注意事项">`}</td>
    ${locked ? '' : `<td class="p-3 text-right"><button class="text-red-600" data-${PREFIX}-action="remove-sample-requirement" data-sampling-id="${escapeHtml(record.samplingTaskId)}" data-draft-id="${escapeHtml(draft.draftId)}">删除</button></td>`}
  </tr>`).join('')
  return `<section class="mt-4 overflow-hidden rounded-lg border bg-white"><div class="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3"><div><h3 class="font-semibold">销售展示样衣制作要求</h3><p class="mt-1 text-sm text-slate-500">跟单按颜色和尺码下达要求数量；制作团队进入任务后逐行填写实际交付。</p></div>${locked ? '<span class="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">已下达</span>' : `<button class="rounded border px-3 py-2 text-sm" data-${PREFIX}-action="add-sample-requirement" data-sampling-id="${escapeHtml(record.samplingTaskId)}">新增一行</button>`}</div><div class="overflow-x-auto"><table class="w-full min-w-[820px] text-sm"><thead><tr class="border-b bg-slate-50 text-left"><th class="p-3">颜色</th><th class="p-3">尺码</th><th class="p-3">要求数量</th><th class="p-3">制作要求</th>${locked ? '' : '<th class="p-3 text-right">操作</th>'}</tr></thead><tbody>${rows || `<tr><td colspan="5" class="p-6 text-center text-slate-500">请至少新增一行制作要求</td></tr>`}</tbody></table></div></section>`
}

function renderWorkPlan(record: EngineeringIndependentSamplingRecord): string {
  if (record.status === 'DRAFT') {
    const suggested = suggestEngineeringIndependentTaskTypes(record)
    return `<section class="rounded-lg border bg-white p-4"><div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="font-semibold">本次工作安排</h2><p class="mt-1 text-sm text-slate-500">系统根据打样目的和 B 款 BOM 建议，跟单确认后一次生成；销售展示样衣为必做。</p></div><button class="rounded bg-blue-600 px-4 py-2 text-sm text-white" data-${PREFIX}-action="confirm-plan" data-sampling-id="${escapeHtml(record.samplingTaskId)}">确认并生成工作</button></div><div class="mt-3 grid gap-2 md:grid-cols-3">${TASK_OPTIONS.map((item) => `<label class="flex items-center gap-2 rounded border p-3 text-sm"><input type="checkbox" data-${PREFIX}-field="planTaskType" value="${item.value}" ${suggested.includes(item.value) ? 'checked' : ''}>${item.label}${suggested.includes(item.value) ? '<span class="ml-auto rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">建议</span>' : ''}</label>`).join('')}</div>${renderSampleRequirementTable(record, false)}</section>`
  }
  return `<section class="space-y-4"><section class="overflow-hidden rounded-lg border bg-white"><div class="border-b px-4 py-3"><h2 class="font-semibold">本次需要完成的工作</h2></div><div class="overflow-x-auto"><table class="w-full min-w-[1080px] text-sm"><thead><tr class="border-b bg-slate-50 text-left"><th class="p-3">任务</th><th class="p-3">当前团队</th><th class="p-3">当前动作</th><th class="p-3">需要先完成</th><th class="p-3">完成后去向</th><th class="p-3">状态</th><th class="p-3">操作</th></tr></thead><tbody>${record.professionalTasks.map((task) => `<tr class="border-b"><td class="p-3 font-medium">${escapeHtml(task.taskName)}</td><td class="p-3">${escapeHtml(getEngineeringIndependentProfessionalTaskCurrentTeam(task) || '-')}</td><td class="p-3">${escapeHtml(task.status === 'WAIT_DEPENDENCY' ? '等待前面工作完成' : task.status === 'WAIT_REVIEW' ? '审核本次成果' : task.status === 'REWORK' ? '根据未通过项重做' : task.status === 'COMPLETED' ? '无' : (task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') && !task.colorRequirementConfirmedAt ? '填写潘通色号和颜色名称' : task.status === 'IN_PROGRESS' ? '制作并提交成果' : '开始本项工作')}</td><td class="p-3">${escapeHtml(dependencyNames(record, task))}</td><td class="p-3">${escapeHtml(nextTeam(record, task))}</td><td class="p-3">${escapeHtml(TASK_STATUS_TEXT[task.status])}</td><td class="p-3"><a class="text-blue-700" href="${getIndependentProfessionalTaskDetailPath(task)}">进入任务</a></td></tr>`).join('')}</tbody></table></div></section>${renderSampleRequirementTable(record, true)}</section>`
}

const SAMPLING_STEPS: Array<{ key: Exclude<EngineeringIndependentSamplingStep, 'COMPLETED'>; title: string; team: string }> = [
  { key: 'BUYER_PREPARATION', title: '新款资料准备', team: '买手' },
  { key: 'WORK_PLAN', title: '工作安排', team: '跟单' },
  { key: 'PROFESSIONAL_WORK', title: '专业工作', team: '专业团队' },
  { key: 'RESULT_CONFIRMATION', title: '整单确认', team: '跟单' },
]

function currentSamplingStepIndex(record: EngineeringIndependentSamplingRecord): number {
  const current = getEngineeringIndependentSamplingStep(record)
  return current === 'COMPLETED' ? SAMPLING_STEPS.length - 1 : Math.max(0, SAMPLING_STEPS.findIndex((step) => step.key === current))
}

function selectCurrentSamplingStep(samplingTaskId: string): void {
  const record = getEngineeringIndependentSamplingRecord(samplingTaskId)
  if (record) ui.detailStepByTask[samplingTaskId] = currentSamplingStepIndex(record)
}

function renderSamplingStepNav(record: EngineeringIndependentSamplingRecord): string {
  const currentIndex = currentSamplingStepIndex(record)
  const selectedIndex = Math.min(ui.detailStepByTask[record.samplingTaskId] ?? currentIndex, currentIndex)
  ui.detailStepByTask[record.samplingTaskId] = selectedIndex
  return `<nav class="grid overflow-hidden rounded-lg border bg-white md:grid-cols-4" aria-label="打样任务步骤">${SAMPLING_STEPS.map((step, index) => {
    const completed = record.status === 'COMPLETED' || index < currentIndex
    const current = record.status !== 'COMPLETED' && index === currentIndex
    const locked = index > currentIndex
    return `<button type="button" class="border-b p-4 text-left md:border-b-0 md:border-r ${selectedIndex === index ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : ''} ${locked ? 'cursor-not-allowed bg-slate-50 text-slate-400' : 'hover:bg-slate-50'}" data-${PREFIX}-action="select-detail-step" data-sampling-id="${escapeHtml(record.samplingTaskId)}" data-step-index="${index}" ${locked ? 'disabled' : ''}><span class="flex items-center gap-2"><span class="flex h-6 w-6 items-center justify-center rounded-full ${completed ? 'bg-emerald-500 text-white' : current ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}">${completed ? '✓' : index + 1}</span><strong>${escapeHtml(step.title)}</strong></span><span class="mt-2 block pl-8 text-xs">${escapeHtml(step.team)} · ${completed ? '已完成' : current ? '当前步骤' : '待前一步完成'}</span></button>`
  }).join('')}</nav>`
}

function renderBuyerPreparationStep(record: EngineeringIndependentSamplingRecord, readonly: boolean): string {
  const bomReady = record.colorMappings.length > 0 && record.bomVersionIds.length === record.colorMappings.length
  const activeTab = bomReady ? ui.buyerTabByTask[record.samplingTaskId] || 'colors' : 'colors'
  ui.buyerTabByTask[record.samplingTaskId] = activeTab
  const returned = record.buyerPreparationReturnedAt
    ? `<p class="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">跟单于 ${escapeHtml(record.buyerPreparationReturnedAt)} 退回修改：${escapeHtml(record.buyerPreparationReturnReason)}</p>`
    : ''
  const tabNav = `<div class="flex gap-2 border-b bg-white px-4 pt-3"><button class="border-b-2 px-3 py-2 text-sm ${activeTab === 'colors' ? 'border-blue-600 font-medium text-blue-700' : 'border-transparent text-slate-500'}" data-${PREFIX}-action="select-buyer-tab" data-sampling-id="${escapeHtml(record.samplingTaskId)}" data-buyer-tab="colors">目标颜色与参考色</button><button class="border-b-2 px-3 py-2 text-sm ${activeTab === 'bom' ? 'border-blue-600 font-medium text-blue-700' : 'border-transparent text-slate-500'} ${bomReady ? '' : 'cursor-not-allowed bg-slate-50 text-slate-400'}" data-${PREFIX}-action="select-buyer-tab" data-sampling-id="${escapeHtml(record.samplingTaskId)}" data-buyer-tab="bom" ${bomReady ? '' : 'disabled title="请先确认目标颜色"'}>BOM 与价格${bomReady ? '' : '（待确认颜色）'}</button></div>`
  const body = activeTab === 'colors'
    ? renderColorMapping(record, readonly)
    : `<div class="space-y-4">${renderBomSummary(record)}${renderMaterialConversion(record)}${renderPricingPlanCosts(record, readonly)}${readonly ? `<p class="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">买手 ${escapeHtml(record.buyerPreparationConfirmedBy)} 已于 ${escapeHtml(record.buyerPreparationConfirmedAt)} 一次确认全部颜色物料与整款费用，并交给跟单。</p>` : `<div class="flex justify-end"><button class="rounded bg-blue-600 px-4 py-2 text-sm text-white" data-${PREFIX}-action="complete-buyer-preparation" data-sampling-id="${escapeHtml(record.samplingTaskId)}">确认 BOM 与价格并交给跟单</button></div>`}</div>`
  return `<section class="space-y-4"><header class="rounded-lg border bg-white p-4"><div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="font-semibold">第一步：新款资料准备</h2><p class="mt-1 text-sm text-slate-500">买手先定义新款颜色和参考色，再分别维护各颜色物料，并统一维护一次整款费用。</p></div><span class="rounded-full ${readonly ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'} px-2 py-1 text-xs">${readonly ? '已完成' : '当前由买手处理'}</span></div></header>${returned}<div class="overflow-hidden rounded-lg border bg-slate-50">${tabNav}<div class="space-y-4 p-4">${body}</div></div></section>`
}

function renderWorkPlanStep(record: EngineeringIndependentSamplingRecord): string {
  if (!record.buyerPreparationConfirmedAt && record.status === 'DRAFT') return '<section class="rounded-lg border border-dashed bg-slate-50 p-6 text-sm text-slate-500">待买手完成新款资料准备后，由跟单安排专业工作。</section>'
  const canReturn = record.status === 'DRAFT' && Boolean(record.buyerPreparationConfirmedAt) && !record.taskPlanConfirmedAt
  return `<section class="space-y-4"><header class="rounded-lg border bg-white p-4"><div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="font-semibold">第二步：工作安排</h2><p class="mt-1 text-sm text-slate-500">跟单根据系统建议确认本次需要开展的专业工作。</p></div><span class="rounded-full ${record.taskPlanConfirmedAt ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'} px-2 py-1 text-xs">${record.taskPlanConfirmedAt ? '已完成' : '当前由跟单处理'}</span></div></header>${renderWorkPlan(record)}${canReturn ? `<section class="rounded-lg border bg-white p-4"><h3 class="font-semibold">需要买手修改资料</h3><div class="mt-3 flex flex-col gap-2 md:flex-row"><input class="h-10 flex-1 rounded border px-3" data-${PREFIX}-field="buyerReturnReason" value="${escapeHtml(ui.returnReasonByTask[record.samplingTaskId] || '')}" placeholder="填写退回原因"><button class="rounded border border-amber-300 px-4 py-2 text-sm text-amber-800" data-${PREFIX}-action="return-buyer-preparation" data-sampling-id="${escapeHtml(record.samplingTaskId)}">退回买手修改</button></div></section>` : ''}</section>`
}

function renderProfessionalWorkStep(record: EngineeringIndependentSamplingRecord): string {
  if (!record.taskPlanConfirmedAt) return '<section class="rounded-lg border border-dashed bg-slate-50 p-6 text-sm text-slate-500">待跟单完成工作安排后，各专业团队才能开始。</section>'
  return `<section class="space-y-4"><header class="rounded-lg border bg-white p-4"><div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="font-semibold">第三步：专业工作</h2><p class="mt-1 text-sm text-slate-500">各专业团队按前后依赖开展工作；表格直接显示当前团队、当前动作和完成后去向。</p></div><span class="rounded-full ${record.status === 'WAIT_CONFIRMATION' || record.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'} px-2 py-1 text-xs">${record.status === 'WAIT_CONFIRMATION' || record.status === 'COMPLETED' ? '已完成' : '各专业团队处理中'}</span></div></header>${renderWorkPlan(record)}</section>`
}

function renderResultConfirmationStep(record: EngineeringIndependentSamplingRecord): string {
  return `<section class="space-y-4"><header class="rounded-lg border bg-white p-4"><div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="font-semibold">第四步：整单确认</h2><p class="mt-1 text-sm text-slate-500">全部专业工作完成后，由跟单确认整张打样任务成果。</p></div><span class="rounded-full ${record.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : record.status === 'WAIT_CONFIRMATION' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'} px-2 py-1 text-xs">${record.status === 'COMPLETED' ? '已完成' : record.status === 'WAIT_CONFIRMATION' ? '当前由跟单处理' : '等待专业工作完成'}</span></div></header><section class="rounded-lg border bg-white p-4"><h3 class="font-semibold">整单成果</h3>${record.status === 'WAIT_CONFIRMATION' ? `<div class="mt-3 grid gap-2"><input class="h-9 rounded border px-3" data-${PREFIX}-field="resultVersion" placeholder="成果版本，如 v1.0"><textarea class="rounded border p-3" data-${PREFIX}-field="resultSummary" placeholder="本次实际完成的样衣和成果说明"></textarea><button class="rounded bg-blue-600 px-4 py-2 text-white" data-${PREFIX}-action="confirm-result" data-sampling-id="${escapeHtml(record.samplingTaskId)}">确认整张任务成果</button></div>` : `<p class="mt-3 text-sm">${record.resultVersion ? `${escapeHtml(record.resultVersion)} · ${escapeHtml(record.resultSummary)}` : '待全部专业工作完成'}</p>`}</section></section>`
}

function renderDesignFileHistory(record: EngineeringIndependentSamplingRecord): string {
  const canReplace = !record.taskPlanConfirmedAt
  return `<section class="rounded-lg border bg-white p-4"><div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="font-semibold">设计稿</h2><p class="mt-1 text-sm text-slate-500">由跟单上传；工作安排确认前可以替换，历史版本保留。</p></div>${canReplace ? `<label class="inline-flex h-9 cursor-pointer items-center rounded border border-blue-200 px-3 text-sm text-blue-700">替换设计稿<input class="sr-only" type="file" accept="${escapeHtml(ENGINEERING_UPLOAD_RULES.DESIGN_IMAGE.accept)}" multiple data-skip-page-rerender="true" data-${PREFIX}-replace-design-upload data-sampling-id="${escapeHtml(record.samplingTaskId)}"></label>` : '<span class="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">工作安排已确认，设计稿已锁定</span>'}</div><div class="mt-3 grid gap-3 md:grid-cols-3">${record.designFiles.map((file, index) => `<article class="rounded border p-3 ${index === record.designFiles.length - 1 ? 'border-blue-300 bg-blue-50/40' : ''}"><button type="button" class="block w-full text-left" data-${PREFIX}-upload-preview data-file-url="${escapeHtml(file.dataUrl)}" data-file-name="${escapeHtml(file.fileName)}"><span class="flex h-36 items-center justify-center overflow-hidden rounded bg-slate-100"><img src="${escapeHtml(file.dataUrl)}" alt="${escapeHtml(file.fileName)}设计稿" class="h-full w-full object-contain" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="text-sm text-red-600">设计稿加载失败</span></span><strong class="mt-2 block truncate text-sm">${escapeHtml(file.fileName)}</strong></button><p class="mt-1 text-xs text-slate-500">${index === record.designFiles.length - 1 ? '当前版本 · ' : '历史版本 · '}${escapeHtml(file.uploadedByName)} · ${escapeHtml(file.uploadedAt)}</p></article>`).join('') || '<p class="text-sm text-red-600">缺少设计稿，任务资料不完整。</p>'}</div></section>`
}

export function renderPcsIndependentSamplingDetailPage(id: string): string {
  const record = getEngineeringIndependentSamplingRecord(id)
  if (!record) return '<section class="p-6"><h1 class="text-xl font-semibold">任务不存在</h1></section>'
  if (!(record.samplingTaskId in ui.detailStepByTask) && typeof location !== 'undefined') {
    const query = new URLSearchParams(location.search)
    if (query.get('step') === 'buyer') ui.detailStepByTask[record.samplingTaskId] = 0
    if (query.get('tab') === 'bom' && record.colorMappings.length) ui.buyerTabByTask[record.samplingTaskId] = 'bom'
  }
  const selectedStep = ui.detailStepByTask[record.samplingTaskId] ?? currentSamplingStepIndex(record)
  const currentStep = currentSamplingStepIndex(record)
  const stepContent = selectedStep === 0
    ? renderBuyerPreparationStep(record, Boolean(record.buyerPreparationConfirmedAt || record.taskPlanConfirmedAt))
    : selectedStep === 1
      ? renderWorkPlanStep(record)
      : selectedStep === 2
        ? renderProfessionalWorkStep(record)
        : renderResultConfirmationStep(record)
  const targetColorLabel = record.colorMappings.length ? `本次目标颜色 ${record.colorMappings.length} 个` : '本次目标颜色待买手定义'
  return `<section class="space-y-4 p-4"><header class="rounded-lg border bg-white"><div class="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div><div class="flex items-center gap-2"><h1 class="text-xl font-semibold">设计改款 · ${escapeHtml(record.samplingTaskCode)}</h1><span class="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">${escapeHtml(samplingStatusText(record))}</span></div><p class="mt-1 text-sm text-slate-500">${escapeHtml(record.creationReason)}</p></div><a class="rounded border px-4 py-2 text-sm" href="/pcs/engineering/design-revision">返回列表</a></div><div class="grid gap-4 px-5 py-4 md:grid-cols-[2fr_2fr_1fr_1fr]">${styleCard(record.sourceStyleId, '参照款式（A 款）')}${styleCard(record.targetStyleId, `目标款式（B 款） · ${targetColorLabel}`)}<div><p class="text-xs text-slate-500">当前需处理的团队</p><p class="mt-1 font-medium">${escapeHtml(getEngineeringIndependentCurrentTeam(record) || '已完成')}</p></div><div><p class="text-xs text-slate-500">当前步骤</p><p class="mt-1 font-medium">${escapeHtml(SAMPLING_STEPS[currentStep].title)}</p><p class="text-xs text-slate-500">跟单：${escapeHtml(record.merchandiserName)}</p></div></div></header>${feedbackHtml()}${renderDesignFileHistory(record)}${renderSamplingStepNav(record)}${stepContent}<section class="rounded-lg border bg-white p-4"><h2 class="font-semibold">操作记录</h2><div class="mt-3 space-y-2">${record.operationLogs.map((log) => `<div class="grid gap-1 border-b pb-2 text-sm md:grid-cols-[160px_200px_1fr]"><span>${escapeHtml(log.occurredAt)}</span><span>${escapeHtml(log.operatorName)} · ${escapeHtml(log.action)}</span><span class="text-slate-500">${escapeHtml(log.detail)}</span></div>`).join('')}</div></section>${renderDialogHost()}</section>`
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

function ensureSampleResultDrafts(task: EngineeringIndependentProfessionalTask): typeof ui.sampleResultDraftsByTask[string] {
  if (ui.sampleResultDraftsByTask[task.taskId]) return ui.sampleResultDraftsByTask[task.taskId]
  ui.sampleResultDraftsByTask[task.taskId] = (task.sampleRequirements || []).map((requirement, index) => ({
    draftId: `${task.taskId}-DISPLAY-ACTUAL-DRAFT-${index + 1}`,
    requirementLineId: requirement.requirementLineId,
    title: `${requirement.targetColor} / ${requirement.targetSize} 销售展示样衣`,
    actualColor: requirement.targetColor,
    actualSize: requirement.targetSize,
    actualQuantity: requirement.requiredQuantity,
    sourcePatternVersion: '',
    productionNote: requirement.requirementNote,
    differenceNote: '',
  }))
  return ui.sampleResultDraftsByTask[task.taskId]
}

function sampleRequirementById(task: EngineeringIndependentProfessionalTask, requirementLineId: string): EngineeringSampleRequirementLine | undefined {
  return (task.sampleRequirements || []).find((line) => line.requirementLineId === requirementLineId)
}

function availableIndependentPatternVersions(task: EngineeringIndependentProfessionalTask): string[] {
  const found = findProfessional(task.taskId)
  if (!found) return []
  return [...new Set(found.record.professionalTasks
    .filter((item) => task.dependsOnTaskIds.includes(item.taskId) && item.taskType === 'BASE_PATTERN' && item.status === 'COMPLETED')
    .flatMap((item) => item.results.filter((result) => result.status === 'APPROVED').map((result) => result.version.trim()))
    .filter(Boolean))]
}

function renderDisplaySampleRequirementSummary(task: EngineeringIndependentProfessionalTask): string {
  const requirements = task.sampleRequirements || []
  const expectedTotal = requirements.reduce((sum, line) => sum + line.requiredQuantity, 0)
  const actualTotal = task.results.reduce((sum, result) => sum + Number(result.sampleQuantity || 0), 0)
  return `<section class="overflow-hidden rounded-lg border bg-white"><div class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"><div><h2 class="font-semibold">跟单下达的制作要求</h2><p class="mt-1 text-sm text-slate-500">要求合计 ${expectedTotal} 件；制作开始后要求锁定。</p></div>${task.results.length ? `<span class="rounded-full ${actualTotal === expectedTotal ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'} px-2 py-1 text-xs">实际 ${actualTotal} 件 · ${actualTotal === expectedTotal ? '数量一致' : `相差 ${actualTotal - expectedTotal} 件`}</span>` : ''}</div><div class="overflow-x-auto"><table class="w-full min-w-[720px] text-sm"><thead><tr class="border-b bg-slate-50 text-left"><th class="p-3">颜色</th><th class="p-3">尺码</th><th class="p-3">要求数量</th><th class="p-3">制作要求</th><th class="p-3">下达人</th></tr></thead><tbody>${requirements.map((line) => `<tr class="border-b"><td class="p-3">${escapeHtml(line.targetColor)}</td><td class="p-3">${escapeHtml(line.targetSize)}</td><td class="p-3">${line.requiredQuantity} 件</td><td class="p-3">${escapeHtml(line.requirementNote || '-')}</td><td class="p-3">${escapeHtml(line.issuedBy)}<small class="block text-slate-500">${escapeHtml(line.issuedAt)}</small></td></tr>`).join('') || '<tr><td colspan="5" class="p-6 text-center text-red-600">尚未下达制作要求</td></tr>'}</tbody></table></div></section>`
}

function renderDisplaySampleSubmission(task: EngineeringIndependentProfessionalTask): string {
  const drafts = ensureSampleResultDrafts(task)
  const requirements = task.sampleRequirements || []
  const patternVersions = availableIndependentPatternVersions(task)
  return `<div class="space-y-4"><div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="font-semibold">提交本次实际交付</h2><p class="mt-1 text-sm text-slate-500">每行对应一项制作要求；同一要求可拆成多行实际交付。实际与要求不一致时必须填写差异说明。</p></div><button class="rounded border px-3 py-2 text-sm" data-${PREFIX}-action="add-sample-result" data-task-id="${escapeHtml(task.taskId)}">新增实际交付</button></div>${drafts.map((draft, index) => {
    const requirement = sampleRequirementById(task, draft.requirementLineId)
    const files = listEngineeringTaskUploadedFiles(task.taskId, draft.draftId, 'SAMPLE_RESULT')
    return `<article class="space-y-3 rounded-lg border p-4" data-sample-result-row="${escapeHtml(draft.draftId)}"><div class="flex items-center justify-between gap-3"><strong>实际交付 ${index + 1}</strong>${drafts.length > requirements.length ? `<button class="text-sm text-red-600" data-${PREFIX}-action="remove-sample-result" data-task-id="${escapeHtml(task.taskId)}" data-draft-id="${escapeHtml(draft.draftId)}">删除</button>` : ''}</div><div class="grid gap-3 md:grid-cols-4"><label class="text-sm text-slate-600">对应制作要求<select class="mt-1 h-10 w-full rounded border px-2" data-${PREFIX}-field="sampleResultRequirement">${requirements.map((line) => `<option value="${escapeHtml(line.requirementLineId)}" ${line.requirementLineId === draft.requirementLineId ? 'selected' : ''}>${escapeHtml(line.targetColor)} / ${escapeHtml(line.targetSize)} / ${line.requiredQuantity} 件</option>`).join('')}</select></label><label class="text-sm text-slate-600">实际颜色<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="sampleResultColor" value="${escapeHtml(draft.actualColor)}"></label><label class="text-sm text-slate-600">实际尺码<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="sampleResultSize" value="${escapeHtml(draft.actualSize)}"></label><label class="text-sm text-slate-600">实际数量<input type="number" min="1" step="1" class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="sampleResultQuantity" value="${draft.actualQuantity}"></label></div><div class="grid gap-3 md:grid-cols-3"><label class="text-sm text-slate-600">使用的纸样版本<select class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="sampleResultPattern"><option value="">请选择已完成纸样版本</option>${patternVersions.map((version) => `<option value="${escapeHtml(version)}" ${version === draft.sourcePatternVersion ? 'selected' : ''}>${escapeHtml(version)}</option>`).join('')}</select></label><label class="text-sm text-slate-600">制作说明<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="sampleResultNote" value="${escapeHtml(draft.productionNote)}" placeholder="本行实际制作情况"></label><label class="text-sm text-slate-600">差异说明<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="sampleResultDifference" value="${escapeHtml(draft.differenceNote)}" placeholder="仅实际与要求不一致时必填"></label></div>${patternVersions.length ? '' : '<p class="rounded bg-amber-50 px-3 py-2 text-sm text-amber-700">尚无可用的已完成基码纸样版本，不能提交样衣成果。</p>'}${requirement ? `<p class="rounded bg-slate-50 px-3 py-2 text-xs text-slate-600">要求：${escapeHtml(requirement.targetColor)} / ${escapeHtml(requirement.targetSize)} / ${requirement.requiredQuantity} 件${requirement.requirementNote ? ` · ${escapeHtml(requirement.requirementNote)}` : ''}</p>` : ''}${renderEngineeringFileUpload({ taskId: task.taskId, itemId: draft.draftId, purpose: 'SAMPLE_RESULT', files, label: '本行销售展示样衣图片', requiredHint: '必须选择并真实读取与本行实际样衣对应的图片。', eventPrefix: PREFIX })}</article>`
  }).join('')}</div>`
}

function renderProfessionalResultFields(task: EngineeringIndependentProfessionalTask): string {
  const common = `<label class="text-sm text-slate-600">成果名称<input class="mt-1 h-10 w-full rounded border px-3" data-pcs-independent-sampling-field="resultTitle" value="${escapeHtml(taskDraftValue(task, 'resultTitle'))}" placeholder="请填写这次实际交付的成果名称"></label>`
  if (task.taskType === 'BASE_PATTERN') {
    return `${common}<div class="grid gap-3 md:grid-cols-2"><label class="text-sm text-slate-600">纸样版本<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="resultVersion" value="${escapeHtml(taskDraftValue(task, 'resultVersion'))}" placeholder="如 v1.0"></label><label class="text-sm text-slate-600">适用部位／尺码<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="applicablePartOrSize" value="${escapeHtml(taskDraftValue(task, 'applicablePartOrSize'))}" placeholder="如基码 / M 码"></label></div><label class="text-sm text-slate-600">纸样说明<textarea class="mt-1 min-h-20 w-full rounded border p-3" data-${PREFIX}-field="resultDescription" placeholder="说明纸样范围和本轮调整">${escapeHtml(taskDraftValue(task, 'resultDescription'))}</textarea></label>`
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
  if (result.requirementLineId) {
    const requirement = sampleRequirementById(task, result.requirementLineId)
    if (requirement) details.push(['对应制作要求', `${requirement.targetColor} / ${requirement.targetSize} / ${requirement.requiredQuantity} 件`])
  }
  if (result.differenceNote) details.push(['差异说明', result.differenceNote])
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
  const waitingColorRequirement = isColor && !task.colorRequirementConfirmedAt && ['WAIT_START', 'IN_PROGRESS', 'REWORK'].includes(task.status)
  const currentAction = waitingColorRequirement
    ? '由跟单填写潘通色号和颜色名称'
    : task.status === 'WAIT_START' ? '由当前团队开始制作'
      : task.status === 'IN_PROGRESS' ? '上传并提交本次真实成果'
        : task.status === 'WAIT_REVIEW' ? '由买手逐项审核成果'
          : task.status === 'REWORK' ? '只重做未通过的成果'
            : task.status === 'COMPLETED' ? '本项工作已完成' : '等待需要先完成的工作'
  const resultCards = task.results.length
    ? task.results.map((result) => `<article class="rounded border p-3"><div class="flex items-center justify-between gap-2"><strong>${escapeHtml(result.title)}</strong><span class="text-xs ${result.status === 'REJECTED' ? 'text-red-600' : result.status === 'APPROVED' ? 'text-emerald-700' : 'text-amber-700'}">${result.status === 'APPROVED' ? '已通过' : result.status === 'REJECTED' ? '未通过' : '待审核'}</span></div>${renderProfessionalResultDetails(task, result)}<div class="mt-3 space-y-2">${result.files.map((file) => `<div class="flex items-center justify-between gap-2 rounded bg-slate-50 px-3 py-2 text-sm"><span class="truncate">${escapeHtml(file.fileName)} · ${(file.sizeBytes / 1024).toFixed(0)} KB · 第 ${file.roundNo} 轮</span><div class="flex gap-2">${['jpg','jpeg','png','webp'].includes(file.extension) ? `<button class="text-blue-700" data-${PREFIX}-upload-preview data-file-url="${escapeHtml(file.dataUrl)}" data-file-name="${escapeHtml(file.fileName)}">查看大图</button>` : ''}<a class="text-blue-700" href="${escapeHtml(file.dataUrl)}" download="${escapeHtml(file.fileName)}">下载</a></div></div>`).join('')}</div>${task.status === 'WAIT_REVIEW' ? `<div class="mt-3 grid gap-2"><label class="text-sm"><input type="radio" name="review-${escapeHtml(result.resultId)}" value="approve" checked data-${PREFIX}-review-result="${escapeHtml(result.resultId)}"> 通过</label><label class="text-sm"><input type="radio" name="review-${escapeHtml(result.resultId)}" value="reject" data-${PREFIX}-review-result="${escapeHtml(result.resultId)}"> 不通过</label><input class="h-9 rounded border px-2 text-sm" data-${PREFIX}-review-reason="${escapeHtml(result.resultId)}" placeholder="不通过原因"></div>` : result.rejectReason ? `<p class="mt-2 text-sm text-red-600">${escapeHtml(result.rejectReason)}</p>` : ''}</article>`).join('')
    : '<p class="text-sm text-slate-500">尚未提交成果</p>'
  const submitSection = canSubmit
    ? task.taskType === 'DISPLAY_SAMPLE'
      ? `<section class="rounded-lg border bg-white p-4">${renderDisplaySampleSubmission(task)}<button class="mt-4 rounded bg-blue-600 px-4 py-2 text-white" data-${PREFIX}-action="submit-task" data-task-id="${escapeHtml(task.taskId)}">提交本次工作</button></section>`
      : `<section class="rounded-lg border bg-white p-4"><h2 class="font-semibold">提交本次成果</h2><div class="mt-3 grid gap-3">${renderProfessionalResultFields(task)}${uploadPurposes(task).map(({ purpose, label, requiredHint }) => renderEngineeringFileUpload({ taskId: task.taskId, purpose, files: listEngineeringTaskUploadedFiles(task.taskId, 'TASK', purpose), label, requiredHint, eventPrefix: PREFIX })).join('')}</div><button class="mt-4 rounded bg-blue-600 px-4 py-2 text-white" data-${PREFIX}-action="submit-task" data-task-id="${escapeHtml(task.taskId)}">提交本次工作</button></section>`
    : ''
  return `<section class="space-y-4 p-4"><header class="rounded-lg border bg-white"><div class="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div><div class="flex items-center gap-2"><h1 class="text-xl font-semibold">${escapeHtml(task.taskName)}</h1><span class="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">${escapeHtml(TASK_STATUS_TEXT[task.status])}</span></div><p class="mt-1 text-sm text-slate-500">${escapeHtml(record.samplingTaskCode)} · 目标款式 ${escapeHtml(record.targetStyleCode)} · 来源：设计改款</p></div><a class="rounded border px-4 py-2 text-sm" href="/pcs/engineering/design-revision/${escapeHtml(record.samplingTaskId)}">返回主任务</a></div><div class="grid gap-4 px-5 py-4 md:grid-cols-[2fr_1fr_1fr_1fr]">${style ? `<div class="flex items-center gap-3">${imageButton(style.mainImageUrl, style.styleName)}<div><p class="font-medium">${escapeHtml(style.styleName)}</p><p class="text-sm text-slate-500">${escapeHtml(style.styleCode)}</p></div></div>` : '<div>-</div>'}<div><p class="text-xs text-slate-500">当前需处理的团队</p><p class="mt-1 font-medium">${escapeHtml(currentTeam)}</p></div><div><p class="text-xs text-slate-500">需要先完成</p><p class="mt-1 font-medium">${escapeHtml(dependencyNames(record, task))}</p></div><div><p class="text-xs text-slate-500">完成后去向</p><p class="mt-1 font-medium">${escapeHtml(nextTeam(record, task))}</p></div></div><div class="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-5 py-4"><div><p class="text-xs text-slate-500">当前动作</p><p class="mt-1 text-sm">${escapeHtml(currentAction)}</p></div>${task.status === 'WAIT_START' && !waitingColorRequirement ? `<button class="rounded bg-blue-600 px-4 py-2 text-white" data-${PREFIX}-action="start-task" data-task-id="${escapeHtml(task.taskId)}">开始任务</button>` : ''}</div></header>${feedbackHtml()}${task.taskType === 'DISPLAY_SAMPLE' ? renderDisplaySampleRequirementSummary(task) : ''}${isColor ? `<section class="rounded-lg border bg-white p-4"><h2 class="font-semibold">颜色要求</h2><div class="mt-3 grid gap-3 md:grid-cols-3"><label class="text-sm text-slate-600">潘通色号<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="pantoneColorCode" value="${escapeHtml(task.pantoneColorCode)}" ${task.colorRequirementConfirmedAt ? 'readonly' : ''}></label><label class="text-sm text-slate-600">颜色名称<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="colorName" value="${escapeHtml(task.colorName)}" ${task.colorRequirementConfirmedAt ? 'readonly' : ''}></label><div class="self-end text-sm text-slate-500">${task.colorRequirementConfirmedAt ? `跟单已确认 · ${escapeHtml(task.colorRequirementConfirmedBy)} · ${escapeHtml(task.colorRequirementConfirmedAt)}` : '待跟单确认'}</div></div>${!task.colorRequirementConfirmedAt && ['WAIT_START', 'IN_PROGRESS', 'REWORK'].includes(task.status) ? `<button class="mt-4 rounded border border-blue-200 px-4 py-2 text-blue-700" data-${PREFIX}-action="confirm-color-requirement" data-task-id="${escapeHtml(task.taskId)}">跟单确认颜色要求</button>` : ''}</section>` : ''}${submitSection}<section class="rounded-lg border bg-white p-4"><h2 class="font-semibold">成果记录</h2><div class="mt-3 grid gap-3 md:grid-cols-2">${resultCards}</div>${task.status === 'WAIT_REVIEW' ? `<button class="mt-4 rounded bg-blue-600 px-4 py-2 text-white" data-${PREFIX}-action="review-task" data-task-id="${escapeHtml(task.taskId)}">买手提交整张审核</button>` : ''}</section><section class="rounded-lg border bg-white p-4"><h2 class="font-semibold">操作记录</h2><div class="mt-3 space-y-2">${record.operationLogs.filter((log) => log.detail.includes(task.taskName) || log.action === '创建任务').map((log) => `<p class="border-b pb-2 text-sm"><span class="text-slate-500">${escapeHtml(log.occurredAt)}</span> · ${escapeHtml(log.operatorName)} · ${escapeHtml(log.action)} · ${escapeHtml(log.detail)}</p>`).join('') || '<p class="text-sm text-slate-500">暂无操作记录</p>'}</div></section>${renderDialogHost()}</section>`
}

function readColorMappings() {
  return [...document.querySelectorAll<HTMLElement>('[data-color-mapping-row]')].map((row) => ({
    targetColor: value('targetColor', row),
    mappingType: value('sourceColor', row) ? '参考 A 款颜色' as const : '无参考颜色' as const,
    sourceColor: value('sourceColor', row),
    targetSizeNames: [...row.querySelectorAll<HTMLInputElement>(`[data-${PREFIX}-field="targetSizeName"]:checked`)].map((item) => item.value),
  }))
}

function syncSampleRequirementsFromDom(samplingTaskId: string): void {
  const rows = [...document.querySelectorAll<HTMLElement>('[data-sample-requirement-row]')]
  if (!rows.length) return
  ui.sampleRequirementDraftsByTask[samplingTaskId] = rows.map((row) => ({
    draftId: row.dataset.sampleRequirementRow || `${samplingTaskId}-DISPLAY-REQ-DRAFT-${Date.now().toString(36)}`,
    targetColor: value('sampleRequirementColor', row),
    targetSize: value('sampleRequirementSize', row),
    requiredQuantity: Number(value('sampleRequirementQuantity', row)) || 0,
    requirementNote: value('sampleRequirementNote', row),
  }))
}

function readSampleRequirements(samplingTaskId: string): typeof ui.sampleRequirementDraftsByTask[string] {
  syncSampleRequirementsFromDom(samplingTaskId)
  return ui.sampleRequirementDraftsByTask[samplingTaskId] || []
}

function syncSampleResultsFromDom(task: EngineeringIndependentProfessionalTask): void {
  const rows = [...document.querySelectorAll<HTMLElement>('[data-sample-result-row]')]
  if (!rows.length) return
  ui.sampleResultDraftsByTask[task.taskId] = rows.map((row, index) => ({
    draftId: row.dataset.sampleResultRow || `${task.taskId}-DISPLAY-ACTUAL-DRAFT-${Date.now().toString(36)}-${index}`,
    requirementLineId: value('sampleResultRequirement', row),
    title: `${value('sampleResultColor', row)} / ${value('sampleResultSize', row)} 销售展示样衣`,
    actualColor: value('sampleResultColor', row),
    actualSize: value('sampleResultSize', row),
    actualQuantity: Number(value('sampleResultQuantity', row)) || 0,
    sourcePatternVersion: value('sampleResultPattern', row),
    productionNote: value('sampleResultNote', row),
    differenceNote: value('sampleResultDifference', row),
  }))
}

function readDisplaySampleResults(task: EngineeringIndependentProfessionalTask) {
  syncSampleResultsFromDom(task)
  return (ui.sampleResultDraftsByTask[task.taskId] || []).map((draft) => ({
    title: draft.title,
    requirementLineId: draft.requirementLineId,
    description: draft.productionNote,
    sampleQuantity: draft.actualQuantity,
    sampleColor: draft.actualColor,
    sampleSize: draft.actualSize,
    sourcePatternVersion: draft.sourcePatternVersion,
    differenceNote: draft.differenceNote,
    files: listEngineeringTaskUploadedFiles(task.taskId, draft.draftId, 'SAMPLE_RESULT'),
  }))
}

function syncColorDraftsFromDom(samplingTaskId: string): void {
  const rows = [...document.querySelectorAll<HTMLElement>('[data-color-mapping-row]')]
  if (!rows.length) return
  ui.colorDraftsByTask[samplingTaskId] = rows.map((row) => ({
    draftId: row.dataset.colorMappingRow || `${samplingTaskId}-COLOR-${Date.now().toString(36)}`,
    targetColor: value('targetColor', row),
    sourceColor: value('sourceColor', row),
    targetSizeNames: [...row.querySelectorAll<HTMLInputElement>(`[data-${PREFIX}-field="targetSizeName"]:checked`)].map((item) => item.value),
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
  if (action === 'open-column-settings') { (isDisplaySampleListPath() ? displaySampleListState : listState).showColumnSettings = true; controller.refresh({ table: false, pagination: false, overlays: true }); return true }
  if (action === 'close-column-settings') { (isDisplaySampleListPath() ? displaySampleListState : listState).showColumnSettings = false; controller.refresh({ table: false, pagination: false, overlays: true }); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') { const key = node.dataset.pcsIndependentSamplingColumnKey || node.closest<HTMLElement>('[data-pcs-independent-sampling-column-key]')?.dataset.pcsIndependentSamplingColumnKey || ''; controller.updateColumnPreference(action, key, target instanceof HTMLInputElement ? target.checked : undefined); controller.refresh({ overlays: true }); return true }
  if (action === 'restore-column-settings') { controller.restorePreferences(); controller.refresh({ overlays: true }); return true }
  if (action === 'open-image') { ui.preview = { url: node.dataset.imageUrl || '', fileName: node.dataset.imageAlt || '款式图片' }; refreshDialogs(); return true }
  if (action === 'close-image') { ui.preview = null; refreshDialogs(); return true }
  if (action === 'open-create') { ui.createOpen = true; ui.createDraft = { sourceStyleId: '', targetStyleId: '', creationReason: '', designFiles: [] }; setFeedback(''); refreshDialogs(); return true }
  if (action === 'close-create') { if (target !== node && target.closest('section')) return false; ui.createOpen = false; ui.createDraft = { sourceStyleId: '', targetStyleId: '', creationReason: '', designFiles: [] }; refreshDialogs(); return true }
  if (action === 'remove-create-design') { ui.createDraft.designFiles = ui.createDraft.designFiles.filter((file) => file.fileId !== node.dataset.fileId); refreshDialogs(); return true }
  if (action === 'create') { run(() => { const created = createEngineeringIndependentSampling({ samplingType: 'DESIGN_REVISION', sourceStyleId: ui.createDraft.sourceStyleId, targetStyleId: ui.createDraft.targetStyleId, creationReason: ui.createDraft.creationReason, designFiles: ui.createDraft.designFiles, merchandiser: CURRENT_PCS_ENGINEERING_USER, createdAt: nowText() }); ui.createOpen = false; ui.createDraft = { sourceStyleId: '', targetStyleId: '', creationReason: '', designFiles: [] }; window.history.pushState({}, '', `/pcs/engineering/design-revision/${created.samplingTaskId}`); window.dispatchEvent(new PopStateEvent('popstate')) }, '设计改款任务已创建，待买手准备新款资料。'); return true }
  if (action === 'select-detail-step') { const samplingId = node.dataset.samplingId || ''; const record = getEngineeringIndependentSamplingRecord(samplingId); const nextIndex = Number(node.dataset.stepIndex); if (record && Number.isInteger(nextIndex) && nextIndex <= currentSamplingStepIndex(record)) { syncColorDraftsFromDom(samplingId); ui.detailStepByTask[samplingId] = nextIndex; rerender() } return true }
  if (action === 'select-buyer-tab') { const samplingId = node.dataset.samplingId || ''; const record = getEngineeringIndependentSamplingRecord(samplingId); syncColorDraftsFromDom(samplingId); const bomReady = Boolean(record?.colorMappings.length && record.bomVersionIds.length === record.colorMappings.length); ui.buyerTabByTask[samplingId] = node.dataset.buyerTab === 'bom' && bomReady ? 'bom' : 'colors'; rerender(); return true }
  if (action === 'add-color-row') { const samplingId = node.dataset.samplingId || ''; const record = getEngineeringIndependentSamplingRecord(samplingId); if (!record) return true; syncColorDraftsFromDom(samplingId); const drafts = ensureColorDrafts(record); drafts.push({ draftId: `${samplingId}-COLOR-DRAFT-${Date.now().toString(36)}`, targetColor: '', sourceColor: '', targetSizeNames: targetSizeOptions(record) }); rerender(); return true }
  if (action === 'remove-color-row') { const samplingId = node.dataset.samplingId || ''; syncColorDraftsFromDom(samplingId); ui.colorDraftsByTask[samplingId] = (ui.colorDraftsByTask[samplingId] || []).filter((draft) => draft.draftId !== node.dataset.draftId); rerender(); return true }
  if (action === 'confirm-color-mappings') { const samplingId = node.dataset.samplingId || ''; run(() => { confirmEngineeringIndependentColorMappings({ samplingTaskId: samplingId, actor: BUYER, mappings: readColorMappings() }); delete ui.colorDraftsByTask[samplingId]; delete ui.pricingPlanDraftsByTask[samplingId]; ui.buyerTabByTask[samplingId] = 'bom' }, '目标颜色已确认，并按颜色建立物料方案。'); return true }
  if (action === 'regenerate-bom-from-reference') { const samplingId = node.dataset.samplingId || ''; const targetColor = node.dataset.targetColor || ''; if (!window.confirm(`重新按旧款参考色生成“${targetColor}”的 BOM？该颜色现有的手工增删改将被重置。`)) return true; run(() => regenerateEngineeringIndependentBomFromReference({ samplingTaskId: samplingId, targetColor, actor: BUYER }), `${targetColor} 已重新按旧款参考色生成 BOM。`); return true }
  if (action === 'confirm-material-conversions') { run(() => confirmEngineeringIndependentMaterialConversions({ samplingTaskId: node.dataset.samplingId || '', actor: BUYER, decisions: readMaterialDecisions() }), 'B 款用料已确认并归入 B 款 BOM。'); return true }
  if (action === 'add-custom-cost') { const samplingId = node.dataset.samplingId || ''; const record = getEngineeringIndependentSamplingRecord(samplingId); if (!record) return true; syncPricingPlanDraftFromDom(samplingId); const draft = ensurePricingPlanDraft(record); draft.customCostDecision = 'HAS_CUSTOM_COST'; draft.customCosts.push({ customCostId: `${samplingId}-COST-DRAFT-${Date.now().toString(36)}`, title: '', amountIdr: 0, note: '', displayOrder: draft.customCosts.length + 1 }); rerender(); return true }
  if (action === 'remove-custom-cost') { const samplingId = node.dataset.samplingId || ''; const record = getEngineeringIndependentSamplingRecord(samplingId); if (!record) return true; syncPricingPlanDraftFromDom(samplingId); const draft = ensurePricingPlanDraft(record); const index = Number(node.dataset.costIndex); if (Number.isInteger(index)) draft.customCosts.splice(index, 1); if (!draft.customCosts.length) draft.customCostDecision = 'UNDECIDED'; rerender(); return true }
  if (action === 'complete-buyer-preparation') { const samplingId = node.dataset.samplingId || ''; run(() => { const record = getEngineeringIndependentSamplingRecord(samplingId); if (!record) throw new Error('设计改款任务不存在。'); if (!record.buyerPreparationConfirmedAt) { syncPricingPlanDraftFromDom(samplingId); const draft = ensurePricingPlanDraft(record); saveEngineeringBomPricingPlan({ ownerStage: 'INDEPENDENT_SAMPLING', ownerId: samplingId, role: BUYER.role, userId: BUYER.userId, userName: BUYER.userName, customCostDecision: draft.customCostDecision, customCosts: draft.customCosts, updatedAt: nowText() }) } completeEngineeringIndependentBuyerPreparation({ samplingTaskId: samplingId, actor: BUYER }); delete ui.pricingPlanDraftsByTask[samplingId]; selectCurrentSamplingStep(samplingId) }, 'BOM 与价格已一次确认并交给跟单安排工作。'); return true }
  if (action === 'return-buyer-preparation') { const samplingId = node.dataset.samplingId || ''; run(() => { returnEngineeringIndependentBuyerPreparation({ samplingTaskId: samplingId, actor: CURRENT_PCS_ENGINEERING_USER, reason: ui.returnReasonByTask[samplingId] || value('buyerReturnReason') }); delete ui.pricingPlanDraftsByTask[samplingId]; ui.detailStepByTask[samplingId] = 0; ui.buyerTabByTask[samplingId] = 'colors' }, '已退回买手修改新款资料。'); return true }
  if (action === 'add-sample-requirement') { const samplingId = node.dataset.samplingId || ''; const record = getEngineeringIndependentSamplingRecord(samplingId); if (!record) return true; syncSampleRequirementsFromDom(samplingId); const firstMapping = record.colorMappings[0]; (ui.sampleRequirementDraftsByTask[samplingId] ||= []).push({ draftId: `${samplingId}-DISPLAY-REQ-DRAFT-${Date.now().toString(36)}`, targetColor: firstMapping?.targetColor || '', targetSize: firstMapping?.targetSizeNames[0] || '', requiredQuantity: 1, requirementNote: '' }); rerender(); return true }
  if (action === 'remove-sample-requirement') { const samplingId = node.dataset.samplingId || ''; syncSampleRequirementsFromDom(samplingId); ui.sampleRequirementDraftsByTask[samplingId] = (ui.sampleRequirementDraftsByTask[samplingId] || []).filter((draft) => draft.draftId !== node.dataset.draftId); rerender(); return true }
  if (action === 'confirm-plan') { const samplingId = node.dataset.samplingId || ''; run(() => { confirmEngineeringIndependentSamplingPlan({ samplingTaskId: samplingId, actor: CURRENT_PCS_ENGINEERING_USER, selectedTaskTypes: checkedTaskTypes(), sampleRequirements: readSampleRequirements(samplingId).map((draft) => ({ requirementLineId: draft.draftId, targetColor: draft.targetColor, targetSize: draft.targetSize, requiredQuantity: draft.requiredQuantity, requirementNote: draft.requirementNote })) }); selectCurrentSamplingStep(samplingId) }, '本次工作安排已确认，专业任务与销售展示样衣制作要求已一次生成。'); return true }
  if (action === 'start-task') { const found = findProfessional(node.dataset.taskId || ''); run(() => { if (!found) throw new Error('任务不存在。'); startEngineeringIndependentProfessionalTask({ taskId: found.task.taskId, actor: EXECUTORS[found.task.taskType] }) }, '任务已开始。'); return true }
  if (action === 'confirm-color-requirement') { run(() => confirmEngineeringIndependentColorRequirement({ taskId: node.dataset.taskId || '', actor: CURRENT_PCS_ENGINEERING_USER, pantoneColorCode: value('pantoneColorCode'), colorName: value('colorName') }), '颜色要求已确认。'); return true }
  if (action === 'add-sample-result') { const found = findProfessional(node.dataset.taskId || ''); if (!found) return true; syncSampleResultsFromDom(found.task); const requirement = found.task.sampleRequirements?.[0]; if (!requirement) { setFeedback('尚未下达销售展示样衣制作要求。', false); rerender(); return true } (ui.sampleResultDraftsByTask[found.task.taskId] ||= []).push({ draftId: `${found.task.taskId}-DISPLAY-ACTUAL-DRAFT-${Date.now().toString(36)}`, requirementLineId: requirement.requirementLineId, title: `${requirement.targetColor} / ${requirement.targetSize} 销售展示样衣`, actualColor: requirement.targetColor, actualSize: requirement.targetSize, actualQuantity: 1, sourcePatternVersion: '', productionNote: '', differenceNote: '' }); rerender(); return true }
  if (action === 'remove-sample-result') { const found = findProfessional(node.dataset.taskId || ''); if (!found) return true; syncSampleResultsFromDom(found.task); ui.sampleResultDraftsByTask[found.task.taskId] = (ui.sampleResultDraftsByTask[found.task.taskId] || []).filter((draft) => draft.draftId !== node.dataset.draftId); rerender(); return true }
  if (action === 'submit-task') { const found = findProfessional(node.dataset.taskId || ''); run(() => { if (!found) throw new Error('任务不存在。'); const results = found.task.taskType === 'DISPLAY_SAMPLE' ? readDisplaySampleResults(found.task) : [{ title: value('resultTitle'), version: value('resultVersion'), description: value('resultDescription'), applicablePartOrSize: value('applicablePartOrSize'), sampleQuantity: Number(value('sampleQuantity')) || 0, sampleColor: value('sampleColor'), sampleSize: value('sampleSize'), sourcePatternVersion: value('sourcePatternVersion'), files: professionalFiles(found.task) }]; submitEngineeringIndependentProfessionalTask({ taskId: found.task.taskId, actor: EXECUTORS[found.task.taskType], results, dyeColorCode: value('dyeColorCode') }); delete ui.sampleResultDraftsByTask[found.task.taskId]; selectCurrentSamplingStep(found.record.samplingTaskId) }, '本次工作已提交。'); return true }
  if (action === 'review-task') { const taskId = node.dataset.taskId || ''; const found = findProfessional(taskId); run(() => { if (!found) throw new Error('任务不存在。'); const decisions = found.task.results.map((result) => { const selected = document.querySelector<HTMLInputElement>(`[data-${PREFIX}-review-result="${result.resultId}"]:checked`); return { resultId: result.resultId, approved: selected?.value === 'approve', reason: document.querySelector<HTMLInputElement>(`[data-${PREFIX}-review-reason="${result.resultId}"]`)?.value || '' } }); reviewEngineeringIndependentProfessionalTask({ taskId, actor: BUYER, decisions }); selectCurrentSamplingStep(found.record.samplingTaskId) }, '买手审核结果已提交。'); return true }
  if (action === 'confirm-result') { run(() => confirmEngineeringIndependentSamplingResult({ samplingTaskId: node.dataset.samplingId || '', actor: CURRENT_PCS_ENGINEERING_USER, resultVersion: value('resultVersion'), resultSummary: value('resultSummary'), confirmedAt: nowText() }), '整张任务成果已确认。'); return true }
  return false
}

export function handlePcsIndependentSamplingInput(target: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): boolean {
  // 本页输入由各自的局部处理器保存或刷新；阻止全局输入处理再次整页渲染，
  // 否则创建弹窗和成果表单中尚未提交的值会在一次选择/输入后被清空。
  target.dataset.skipPageRerender = 'true'
  const createDesignUpload = target.closest<HTMLInputElement>(`[data-${PREFIX}-create-design-upload]`)
  if (createDesignUpload) {
    const files = Array.from(createDesignUpload.files || [])
    if (!files.length) return true
    setFeedback('正在读取并保存设计稿…')
    refreshDialogs()
    void captureEngineeringUploadedFiles({ files, purpose: 'DESIGN_IMAGE', actor: { userId: CURRENT_PCS_ENGINEERING_USER.userId, userName: CURRENT_PCS_ENGINEERING_USER.userName, teamName: '跟单' } })
      .then((saved) => { ui.createDraft.designFiles.push(...saved); setFeedback('设计稿已真实读取并保存。'); refreshDialogs() })
      .catch((error) => { setFeedback(error instanceof Error ? error.message : '设计稿上传失败。', false); refreshDialogs() })
    return true
  }
  const replaceDesignUpload = target.closest<HTMLInputElement>(`[data-${PREFIX}-replace-design-upload]`)
  if (replaceDesignUpload) {
    const files = Array.from(replaceDesignUpload.files || [])
    const samplingTaskId = replaceDesignUpload.dataset.samplingId || ''
    if (!files.length) return true
    setFeedback('正在读取并保存新的设计稿…')
    rerender()
    void captureEngineeringUploadedFiles({ files, purpose: 'DESIGN_IMAGE', actor: { userId: CURRENT_PCS_ENGINEERING_USER.userId, userName: CURRENT_PCS_ENGINEERING_USER.userName, teamName: '跟单' } })
      .then((saved) => { replaceEngineeringIndependentDesignFiles({ samplingTaskId, designFiles: saved, actor: CURRENT_PCS_ENGINEERING_USER }); setFeedback('新设计稿已保存，历史版本继续保留。'); rerender() })
      .catch((error) => { setFeedback(error instanceof Error ? error.message : '设计稿替换失败。', false); rerender() })
    return true
  }
  const upload = target.closest<HTMLInputElement>(`[data-${PREFIX}-upload-input]`)
  if (upload) {
    const found = findProfessional(upload.dataset.taskId || '')
    const files = Array.from(upload.files || [])
    if (!found || !files.length) return true
    if (found.task.taskType === 'DISPLAY_SAMPLE') syncSampleResultsFromDom(found.task)
    setFeedback('正在读取并保存文件…'); rerender()
    void uploadEngineeringTaskFiles({ taskId: found.task.taskId, itemId: upload.dataset.itemId, purpose: upload.dataset.uploadPurpose as EngineeringUploadPurpose, files, actor: { ...EXECUTORS[found.task.taskType], teamName: found.task.ownerTeamName } }).then(() => { setFeedback('文件已真实读取并保存。'); rerender() }).catch((error) => { setFeedback(error instanceof Error ? error.message : '文件上传失败。', false); rerender() })
    return true
  }
  if (target.matches(`[data-${PREFIX}-field="pageSize"]`)) { const controller = currentListController(); controller.setPageSize(Number(target.value)); controller.refresh(); return true }
  if (target.matches(`[data-${PREFIX}-field="teamFilter"]`)) { ui.teamFilter = target.value; listState.currentPage = 1; rerender(); return true }
  if (target.matches(`[data-${PREFIX}-field="displayTeamFilter"]`)) { ui.displayTeamFilter = target.value; displaySampleListState.currentPage = 1; rerender(); return true }
  if (target.matches(`[data-${PREFIX}-field="sourceStyleId"]`)) { ui.createDraft.sourceStyleId = target.value; return true }
  if (target.matches(`[data-${PREFIX}-field="targetStyleId"]`)) { ui.createDraft.targetStyleId = target.value; return true }
  if (target.matches(`[data-${PREFIX}-field="creationReason"]`)) { ui.createDraft.creationReason = target.value; return true }
  if (target.matches(`[data-${PREFIX}-field="buyerReturnReason"]`)) { const samplingId = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || ''); ui.returnReasonByTask[samplingId] = target.value; return true }
  if (target.matches(`[data-${PREFIX}-field="targetColor"], [data-${PREFIX}-field="sourceColor"], [data-${PREFIX}-field="targetSizeName"]`)) { const samplingId = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || ''); syncColorDraftsFromDom(samplingId); return true }
  if (target.matches(`[data-${PREFIX}-field="customCostDecision"], [data-${PREFIX}-field="customCostTitle"], [data-${PREFIX}-field="customCostAmount"], [data-${PREFIX}-field="customCostNote"]`)) { const samplingId = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || ''); syncPricingPlanDraftFromDom(samplingId); return true }
  if (target.closest('[data-sample-requirement-row]')) { const samplingId = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || ''); syncSampleRequirementsFromDom(samplingId); return true }
  if (target.closest('[data-sample-result-row]')) { const taskId = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || ''); const found = findProfessional(taskId); if (found) syncSampleResultsFromDom(found.task); return true }
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

export function isPcsIndependentSamplingDialogOpen(): boolean { return Boolean(ui.createOpen || ui.preview) }
