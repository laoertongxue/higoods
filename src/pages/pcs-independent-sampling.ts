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
  saveEngineeringBomVersion,
} from '../data/pcs-engineering-bom-repository.ts'
import { resolveEngineeringBomMaterialLine } from '../data/pcs-engineering-bom-material-resolver.ts'
import type { EngineeringBomCustomCostDecision, EngineeringBomCustomCostDraft, EngineeringBomMaterialLineDraft, EngineeringBomPricingPlanRecord } from '../data/pcs-engineering-bom-types.ts'
import {
  DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS,
  confirmEngineeringIndependentColorRequirement,
  confirmEngineeringIndependentSamplingScheme,
  confirmEngineeringIndependentSamplingResult,
  createEngineeringIndependentSampling,
  getEngineeringIndependentCurrentTeam,
  getEngineeringIndependentCurrentTeams,
  getEngineeringIndependentProfessionalTaskCurrentTeam,
  getEngineeringIndependentSamplingRecord,
  getEngineeringIndependentSamplingStep,
  listEngineeringIndependentAvailablePatternVersions,
  listEngineeringIndependentSamplingRecords,
  replaceEngineeringIndependentDesignFiles,
  returnEngineeringIndependentBuyerPreparation,
  reviewEngineeringIndependentProfessionalTask,
  startEngineeringIndependentProfessionalTask,
  submitEngineeringIndependentProfessionalTask,
  suggestEngineeringIndependentTaskTypes,
  suggestEngineeringIndependentTaskTypesForBomLines,
} from '../data/pcs-engineering-master-sampling.ts'
import type {
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
import { getMaterialArchiveById, getMaterialSkuRecordById, listMaterialArchives, listMaterialSkuRecordsByMaterialId } from '../data/pcs-material-archive-repository.ts'
import { getLatestPcsExchangeRate } from '../data/pcs-exchange-rate-config.ts'
import { getStyleArchiveById, listStyleArchives } from '../data/pcs-style-archive-repository.ts'
import { buildDyeingWorkOrderDetailLink, buildPrintingWorkOrderDetailLink } from '../data/fcs/fcs-route-links.ts'
import { readDesignRevisionProcessWorkOrderStatuses } from '../data/pcs-design-revision-process-work-order-port.ts'
import { escapeHtml } from '../utils.ts'

const PREFIX = 'pcs-independent-sampling'
const BUYER = { role: '买手' as const, userId: 'U-BUYER-WANGMING', userName: '买手-王明' }
const ADMINISTRATOR = { role: '管理员' as const, userId: 'U-ADMIN', userName: '管理员（代操作）' }
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
  createDraft: {
    sourceStyleId: '',
    targetMode: 'ARCHIVED_STYLE' as 'ARCHIVED_STYLE' | 'TEMPORARY_SPU',
    targetStyleId: '',
    temporarySpuName: '',
    creationReason: '',
    patternHandling: 'REMAKE' as 'REUSE' | 'REMAKE',
    designFiles: [] as EngineeringUploadedFile[],
    reusedPatternFiles: [] as EngineeringUploadedFile[],
  },
  taskDrafts: {} as Record<string, Record<string, string>>,
  preview: null as { url: string; fileName: string } | null,
  feedback: '', ok: true,
  teamFilter: '',
  displayTeamFilter: '',
  detailStepByTask: {} as Record<string, number>,
  bomLineDraftsByVersion: {} as Record<string, EngineeringBomMaterialLineDraft[]>,
  pricingPlanDraftsByTask: {} as Record<string, { customCostDecision: EngineeringBomCustomCostDecision; customCosts: EngineeringBomCustomCostDraft[] }>,
  sampleRequirementDraftsByTask: {} as Record<string, Array<{ draftId: string; targetColor: string; targetSize: string; requiredQuantity: number; requirementNote: string }>>,
  sampleResultDraftsByTask: {} as Record<string, Array<{ draftId: string; requirementLineId: string; title: string; actualColor: string; actualSize: string; actualQuantity: number; sourcePatternVersion: string; productionNote: string; differenceNote: string }>>,
  returnReasonByTask: {} as Record<string, string>,
}

function resetCreateDraft(): void {
  ui.createDraft = {
    sourceStyleId: '',
    targetMode: 'ARCHIVED_STYLE',
    targetStyleId: '',
    temporarySpuName: '',
    creationReason: '',
    patternHandling: 'REMAKE',
    designFiles: [],
    reusedPatternFiles: [],
  }
}

function listControllerState(): ProcessOrderListControllerState {
  return { currentPage: 1, sort: null, preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 }, preferencesLoaded: false, showColumnSettings: false }
}
const listState = listControllerState()
const displaySampleListState = listControllerState()

function nowText(): string { return new Date().toISOString().replace('T', ' ').slice(0, 19) }
function samplingStatusText(record: EngineeringIndependentSamplingRecord): string {
  if (record.status === 'COMPLETED') return '已完成'
  if (record.status === 'WAIT_CONFIRMATION') return '待买手确认'
  if (record.status === 'IN_PROGRESS') return '专业工作中'
  return '待方案确认'
}
function feedbackHtml(): string { return ui.feedback ? `<p class="whitespace-pre-line rounded border px-3 py-2 text-sm ${ui.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}">${escapeHtml(ui.feedback)}</p>` : '' }
function setFeedback(message: string, ok = true): void { ui.feedback = message; ui.ok = ok }
function rerender(): void { if (typeof window !== 'undefined') window.dispatchEvent(new Event('higood:request-render')) }
function run(action: () => void, success: string): void { try { action(); setFeedback(success) } catch (error) { setFeedback(error instanceof Error ? error.message : '操作失败。', false) } rerender() }
function value(field: string, scope: ParentNode = document): string { return scope.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[data-${PREFIX}-field="${field}"]`)?.value.trim() || '' }
function checkedTaskTypes(): EngineeringIndependentProfessionalTaskType[] { return [...document.querySelectorAll<HTMLInputElement>(`[data-${PREFIX}-field="planTaskType"]:checked`)].map((node) => node.value as EngineeringIndependentProfessionalTaskType) }
function isDisplaySampleListPath(): boolean { return location.pathname === '/pcs/production-preparation/display-sample' }

export function getIndependentProfessionalTaskDetailPath(task: Pick<EngineeringIndependentProfessionalTask, 'taskId' | 'taskType'>): string {
  if (task.taskType === 'BASE_PATTERN') return `/pcs/production-preparation/plate-making/${encodeURIComponent(task.taskId)}`
  if (task.taskType === 'PATTERN_ARTWORK') return `/pcs/production-preparation/artwork/${encodeURIComponent(task.taskId)}`
  if (task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') return `/pcs/production-preparation/color/${encodeURIComponent(task.taskId)}`
  return `/pcs/production-preparation/display-sample/${encodeURIComponent(task.taskId)}`
}

function imageButton(url: string, alt: string, body = ''): string {
  return `<button type="button" class="flex items-center gap-2 text-left" data-${PREFIX}-action="open-image" data-image-url="${escapeHtml(url)}" data-image-alt="${escapeHtml(alt)}"><span class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border bg-slate-50"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" class="h-full w-full object-cover" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-center text-[10px] text-red-600">图片加载失败</span></span><span>${body}</span></button>`
}

function renderDesignRevisionStyleRelation(row: EngineeringIndependentSamplingRecord): string {
  const source = getStyleArchiveById(row.sourceStyleId)
  const target = getStyleArchiveById(row.targetStyleId)
  const sourceHtml = source
    ? imageButton(source.mainImageUrl, source.styleName, `<span class="block"><strong>${escapeHtml(source.styleCode)}</strong><small class="block text-slate-500">${escapeHtml(source.styleName)}</small></span>`)
    : '<span class="text-red-600">参照款缺失</span>'
  const targetHtml = target
    ? imageButton(target.mainImageUrl, target.styleName, `<span class="block"><strong>${escapeHtml(target.styleCode)}</strong><small class="block text-slate-500">${escapeHtml(target.styleName)}</small></span>`)
    : row.targetMode === 'TEMPORARY_SPU' && !row.linkedFormalStyleId
      ? imageButton(row.designFiles.at(-1)?.dataUrl || '', row.temporarySpuName, `<span class="block"><strong>线下临时 SPU</strong><small class="block text-slate-500">${escapeHtml(row.temporarySpuName)}</small></span>`)
      : escapeHtml(row.targetStyleName)

  return `<div class="flex min-w-0 flex-col items-start gap-1" data-design-revision-style-relation><div class="min-w-0" data-design-revision-style-source>${sourceHtml}</div><div class="h-5 text-left leading-5 text-slate-500" data-design-revision-style-arrow aria-hidden="true">→</div><div class="min-w-0" data-design-revision-style-target>${targetHtml}</div></div>`
}

function renderDesignRevisionArtwork(row: EngineeringIndependentSamplingRecord): string {
  const file = row.designFiles.at(-1)
  if (!file?.dataUrl) return '<span class="text-red-600">缺少设计稿</span>'
  return `<button type="button" class="inline-flex rounded border bg-slate-50 p-1 hover:border-blue-400" title="点击查看设计稿大图" aria-label="查看设计稿 ${escapeHtml(file.fileName)} 大图" data-${PREFIX}-action="open-image" data-image-url="${escapeHtml(file.dataUrl)}" data-image-alt="${escapeHtml(file.fileName)}" data-design-revision-design-thumbnail><span class="flex h-16 w-16 items-center justify-center overflow-hidden rounded bg-white"><img src="${escapeHtml(file.dataUrl)}" alt="${escapeHtml(file.fileName)}" class="h-full w-full object-cover" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-center text-[10px] text-red-600">图片加载失败</span></span></button>`
}

function renderDesignRevisionWorkItems(row: EngineeringIndependentSamplingRecord): string {
  if (!row.professionalTasks.length) return '<span class="text-slate-400" data-design-revision-work-items>—</span>'
  return `<div class="space-y-1.5" data-design-revision-work-items>${row.professionalTasks.map((task) => `<div class="flex min-w-0 items-center justify-between gap-2" data-design-revision-work-item><span class="truncate" title="${escapeHtml(task.taskName)}">${escapeHtml(task.taskName)}</span><span class="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600" data-design-revision-owner-team>${escapeHtml(task.ownerTeamName)}</span></div>`).join('')}</div>`
}

function renderDesignRevisionTimeValue(value: string): string {
  return value
    ? `<time class="whitespace-nowrap tabular-nums text-slate-700">${escapeHtml(value)}</time>`
    : '<span class="text-slate-400">—</span>'
}

function renderDesignRevisionTimePoint(label: string, value: string, marker = ''): string {
  return `<div class="flex min-w-0 items-baseline gap-1.5" ${marker}><span class="shrink-0 text-slate-500">${escapeHtml(label)}</span>${renderDesignRevisionTimeValue(value)}</div>`
}

function renderDesignRevisionTimes(row: EngineeringIndependentSamplingRecord): string {
  const latestDesignUploadedAt = row.designFiles.at(-1)?.uploadedAt || ''
  const materialAndCostConfirmedAt = row.buyerPreparationConfirmedAt || row.bomConversionConfirmedAt
  const reopenedAt = row.buyerPreparationReturnedAt
    ? renderDesignRevisionTimePoint('方案重开', row.buyerPreparationReturnedAt, 'data-design-revision-reopened-at')
    : ''
  const taskTimes = row.professionalTasks.map((task) => {
    const colorConfirmedAt = task.colorRequirementConfirmedAt
      ? renderDesignRevisionTimePoint('颜色确认', task.colorRequirementConfirmedAt, 'data-design-revision-color-confirmed-at')
      : ''
    return `<section class="border-t border-slate-100 pt-1.5" data-design-revision-work-item-times><p class="mb-1 font-medium text-slate-700">${escapeHtml(task.taskName)}</p><div class="grid grid-cols-2 gap-x-3 gap-y-0.5">${renderDesignRevisionTimePoint('计划完成', task.plannedCompleteAt)}${renderDesignRevisionTimePoint('开始', task.startedAt)}${colorConfirmedAt}${renderDesignRevisionTimePoint('提交', task.submittedAt)}${renderDesignRevisionTimePoint('完成', task.completedAt)}</div></section>`
  }).join('')
  return `<div class="space-y-1.5 text-xs leading-5" data-design-revision-times><div class="grid grid-cols-2 gap-x-3 gap-y-0.5">${renderDesignRevisionTimePoint('创建', row.createdAt, 'data-design-revision-created-at')}${renderDesignRevisionTimePoint('设计稿上传', latestDesignUploadedAt, 'data-design-revision-design-uploaded-at')}${renderDesignRevisionTimePoint('物料费用确认', materialAndCostConfirmedAt, 'data-design-revision-material-cost-confirmed-at')}${renderDesignRevisionTimePoint('工作安排确认', row.taskPlanConfirmedAt, 'data-design-revision-plan-confirmed-at')}${reopenedAt}</div>${taskTimes}<div class="grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-slate-100 pt-1.5">${renderDesignRevisionTimePoint('设计改款完成', row.confirmedAt, 'data-design-revision-completed-at')}${renderDesignRevisionTimePoint('最后更新', row.updatedAt, 'data-design-revision-updated-at')}</div></div>`
}

function styleOptions(selected = ''): string {
  return listStyleArchives().filter((style) => style.mainImageUrl).map((style) => `<option value="${escapeHtml(style.styleId)}" ${style.styleId === selected ? 'selected' : ''}>${escapeHtml(style.styleCode)} · ${escapeHtml(style.styleName)}</option>`).join('')
}

function renderCreateDialog(): string {
  if (!ui.createOpen) return ''
  const designRule = ENGINEERING_UPLOAD_RULES.DESIGN_IMAGE
  const patternRule = ENGINEERING_UPLOAD_RULES.PATTERN_SOURCE
  const fileRows = (files: EngineeringUploadedFile[], removeAction: string, imagePreview: boolean) => files.map((file) => `<div class="flex items-center justify-between rounded border bg-white px-3 py-2 text-sm"><div><p class="font-medium">${escapeHtml(file.fileName)}</p><p class="text-xs text-slate-500">${formatEngineeringUploadSize(file.sizeBytes)} · ${escapeHtml(file.uploadedByName)} · ${escapeHtml(file.uploadedAt)}</p></div><div class="flex gap-3">${imagePreview ? `<button type="button" class="text-blue-700" data-${PREFIX}-upload-preview data-file-url="${escapeHtml(file.dataUrl)}" data-file-name="${escapeHtml(file.fileName)}">查看</button>` : ''}<button type="button" class="text-red-600" data-${PREFIX}-action="${removeAction}" data-file-id="${escapeHtml(file.fileId)}">删除</button></div></div>`).join('')
  return `<div class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" data-${PREFIX}-action="close-create"><section class="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl" role="dialog" aria-modal="true"><div class="mb-4 flex items-center justify-between"><h2 class="text-lg font-semibold">新建设计改款任务</h2><button type="button" data-${PREFIX}-action="close-create">关闭</button></div><div class="grid gap-4 md:grid-cols-2"><label class="space-y-1 text-sm"><span>参照款式（SPU）</span><select class="h-10 w-full rounded border px-3" data-${PREFIX}-field="sourceStyleId"><option value="">请选择</option>${styleOptions(ui.createDraft.sourceStyleId)}</select></label><label class="space-y-1 text-sm"><span>目标款式</span><select class="h-10 w-full rounded border px-3" data-${PREFIX}-field="targetMode"><option value="ARCHIVED_STYLE" ${ui.createDraft.targetMode === 'ARCHIVED_STYLE' ? 'selected' : ''}>选择已建档 SPU</option><option value="TEMPORARY_SPU" ${ui.createDraft.targetMode === 'TEMPORARY_SPU' ? 'selected' : ''}>线下临时 SPU</option></select></label>${ui.createDraft.targetMode === 'ARCHIVED_STYLE' ? `<label class="space-y-1 text-sm md:col-span-2"><span>已建档目标 SPU</span><select class="h-10 w-full rounded border px-3" data-${PREFIX}-field="targetStyleId"><option value="">请选择</option>${styleOptions(ui.createDraft.targetStyleId)}</select></label>` : `<label class="space-y-1 text-sm md:col-span-2"><span>线下临时 SPU 名称</span><input class="h-10 w-full rounded border px-3" data-${PREFIX}-field="temporarySpuName" value="${escapeHtml(ui.createDraft.temporarySpuName)}" placeholder="填写线下使用的临时款名"></label>`}<label class="space-y-1 text-sm"><span>买手</span><input class="h-10 w-full rounded border bg-slate-50 px-3" value="${escapeHtml(BUYER.userName)}" readonly></label><label class="space-y-1 text-sm"><span>基码纸样</span><select class="h-10 w-full rounded border px-3" data-${PREFIX}-field="patternHandling"><option value="REMAKE" ${ui.createDraft.patternHandling === 'REMAKE' ? 'selected' : ''}>需要重新制作</option><option value="REUSE" ${ui.createDraft.patternHandling === 'REUSE' ? 'selected' : ''}>纸样不变，直接复用</option></select></label><label class="space-y-1 text-sm md:col-span-2"><span>本次设计改款要求</span><textarea class="min-h-20 w-full rounded border p-3" data-${PREFIX}-field="creationReason" placeholder="填写本次需要改什么">${escapeHtml(ui.createDraft.creationReason)}</textarea></label><section class="space-y-3 rounded border bg-slate-50 p-4 md:col-span-2"><div><p class="font-medium">设计稿 <span class="text-red-600">*</span></p><p class="text-xs text-slate-500">${designRule.extensions.map((item) => `.${item}`).join('、')} · 单个不超过 ${Math.round(designRule.maxSizeBytes / 1024 / 1024)} MB</p></div><label class="inline-flex h-9 cursor-pointer items-center rounded border border-blue-200 bg-white px-3 text-sm text-blue-700">选择本地设计稿<input class="sr-only" type="file" accept="${escapeHtml(designRule.accept)}" multiple data-skip-page-rerender="true" data-${PREFIX}-create-design-upload></label><div class="space-y-2">${fileRows(ui.createDraft.designFiles, 'remove-create-design', true) || '<p class="text-xs text-amber-700">请上传真实设计稿。</p>'}</div></section>${ui.createDraft.patternHandling === 'REUSE' ? `<section class="space-y-3 rounded border bg-slate-50 p-4 md:col-span-2"><div><p class="font-medium">复用基码纸样 <span class="text-red-600">*</span></p><p class="text-xs text-slate-500">必须包含真实 .prj 文件；支持 ${patternRule.extensions.map((item) => `.${item}`).join('、')}</p></div><label class="inline-flex h-9 cursor-pointer items-center rounded border border-blue-200 bg-white px-3 text-sm text-blue-700">选择本地纸样<input class="sr-only" type="file" accept="${escapeHtml(patternRule.accept)}" multiple data-skip-page-rerender="true" data-${PREFIX}-create-pattern-upload></label><div class="space-y-2">${fileRows(ui.createDraft.reusedPatternFiles, 'remove-create-pattern', false) || '<p class="text-xs text-amber-700">纸样不变时必须上传 .prj。</p>'}</div></section>` : ''}</div><div class="mt-5 flex justify-end gap-2"><button class="h-9 rounded border px-4" data-${PREFIX}-action="close-create">取消</button><button class="h-9 rounded bg-blue-600 px-4 text-white" data-${PREFIX}-action="create">创建任务</button></div></section></div>`
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
    { key: 'code', title: '任务号', width: 140, required: true, freezeable: true, sortable: true, sortValue: (row) => row.samplingTaskCode, render: (row) => `<a class="font-medium text-blue-700 hover:underline" href="/pcs/production-preparation/design-revision/${escapeHtml(row.samplingTaskId)}">${escapeHtml(row.samplingTaskCode)}</a>` },
    { key: 'style', title: '参照款式 → 目标款式', width: 390, required: true, render: renderDesignRevisionStyleRelation },
    { key: 'design', title: '设计稿', width: 110, required: true, render: renderDesignRevisionArtwork },
    { key: 'status', title: '状态', width: 140, sortable: true, sortValue: samplingStatusText, render: (row) => `<span class="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">${samplingStatusText(row)}</span>` },
    { key: 'team', title: '当前需处理的团队', width: 150, render: (row) => escapeHtml(getEngineeringIndependentCurrentTeam(row)) },
    { key: 'workItems', title: '工作项 / 负责团队', width: 260, required: true, render: renderDesignRevisionWorkItems },
    { key: 'bom', title: '物料与费用', width: 170, render: (row) => row.bomVersionIds.length ? `<a class="text-blue-700 hover:underline" href="/pcs/production-preparation/design-revision/${escapeHtml(row.samplingTaskId)}">查看整款方案</a>` : '<span class="text-slate-400">尚未建立</span>' },
    { key: 'owner', title: '买手', width: 120, render: (row) => escapeHtml(row.buyerName) },
    { key: 'times', title: '时间', width: 520, required: true, sortable: true, sortValue: (row) => row.updatedAt, render: renderDesignRevisionTimes },
    { key: 'action', title: '操作', width: 100, actionColumn: true, render: (row) => `<a class="inline-flex h-8 items-center rounded border px-3 text-xs" href="/pcs/production-preparation/design-revision/${escapeHtml(row.samplingTaskId)}">查看详情</a>` },
  ]
}

const listController = createProcessOrderListController({
    state: listState, columns: listColumns(), preferenceKey: 'higood-pcs-design-revision-list-preferences-v2',
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
  if ((task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') && !task.colorRequirementConfirmedAt) return '由买手填写潘通色号和颜色名称'
  return task.status === 'IN_PROGRESS' ? '制作并提交真实成果' : '开始本项工作'
}

const displaySampleColumns: StandardListColumn<DisplaySampleListRow>[] = [
  { key: 'task', title: '任务号', width: 230, required: true, freezeable: true, sortable: true, sortValue: ({ task }) => task.taskId, render: ({ task }) => `<a class="font-medium text-blue-700" href="${getIndependentProfessionalTaskDetailPath(task)}">${escapeHtml(task.taskId)}</a>` },
  { key: 'source', title: '由哪张单发起', width: 160, sortable: true, sortValue: ({ record }) => record.samplingTaskCode, render: ({ record }) => `<p class="font-medium">${escapeHtml(record.samplingTaskCode)}</p><p class="text-xs text-slate-500">${TASK_TYPE_TEXT}</p>` },
  { key: 'style', title: '目标款式', width: 300, required: true, render: ({ record }) => { const style = getStyleArchiveById(record.targetStyleId); return style ? imageButton(style.mainImageUrl, style.styleName, `<span class="block"><strong>${escapeHtml(style.styleCode)}</strong><small class="block text-slate-500">${escapeHtml(style.styleName)}</small></span>`) : imageButton(record.designFiles.at(-1)?.dataUrl || '', record.temporarySpuName || record.targetStyleName, `<span class="block"><strong>线下临时 SPU</strong><small class="block text-slate-500">${escapeHtml(record.temporarySpuName || record.targetStyleName)}</small></span>`) } },
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
    filtersHtml: `<div class="rounded-lg border bg-white p-4"><label class="block max-w-[260px] text-sm text-slate-600"><span>当前需处理的团队</span><select class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="teamFilter"><option value="">全部团队</option>${teamOptions().map((team) => `<option value="${escapeHtml(team)}" ${ui.teamFilter === team ? 'selected' : ''}>${escapeHtml(team)}</option>`).join('')}</select></label></div>`,
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

function targetStyleCard(record: EngineeringIndependentSamplingRecord, label: string): string {
  const style = getStyleArchiveById(record.targetStyleId)
  if (style) return styleCard(style.styleId, label)
  const imageUrl = record.designFiles.at(-1)?.dataUrl || ''
  return `<div class="rounded-lg border bg-white p-4"><p class="mb-2 text-xs text-slate-500">${escapeHtml(label)}</p>${imageButton(imageUrl, record.temporarySpuName, `<span><strong>线下临时 SPU</strong><small class="block text-slate-500">${escapeHtml(record.temporarySpuName)}</small></span>`)}</div>`
}

type IndependentPricingPlanDraft = {
  customCostDecision: EngineeringBomCustomCostDecision
  customCosts: EngineeringBomCustomCostDraft[]
}

function ensurePricingPlanDraft(record: EngineeringIndependentSamplingRecord): IndependentPricingPlanDraft {
  const existing = ui.pricingPlanDraftsByTask[record.samplingTaskId]
  if (existing) return existing
  const plan = getEngineeringBomPricingPlan('INDEPENDENT_SAMPLING', record.samplingTaskId)
  const customCosts = (plan?.customCosts || []).map((cost) => ({ ...cost }))
  const draft: IndependentPricingPlanDraft = {
    customCostDecision: customCosts.length ? 'HAS_CUSTOM_COST' : 'NO_CUSTOM_COST',
    customCosts,
  }
  ui.pricingPlanDraftsByTask[record.samplingTaskId] = draft
  return draft
}

function syncPricingPlanDraftFromDom(samplingTaskId: string): void {
  const current = ui.pricingPlanDraftsByTask[samplingTaskId] || { customCostDecision: 'NO_CUSTOM_COST' as const, customCosts: [] }
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
    customCostDecision: customCosts.length ? 'HAS_CUSTOM_COST' : 'NO_CUSTOM_COST',
    customCosts,
  }
}

function sampleQuantityForPlan(record: EngineeringIndependentSamplingRecord): number {
  const drafts = ensureSampleRequirementDrafts(record)
  return drafts.reduce((sum, line) => sum + Math.max(0, Number(line.requiredQuantity) || 0), 0) || 1
}

function ensureBomLineDrafts(versionId: string): EngineeringBomMaterialLineDraft[] {
  if (!ui.bomLineDraftsByVersion[versionId]) {
    ui.bomLineDraftsByVersion[versionId] = getEngineeringBomVersionById(versionId)?.materialLines.map((line) => ({ ...line, applicableSkuIds: [...(line.applicableSkuIds || [])], linkedPatternResultIds: [...(line.linkedPatternResultIds || [])] })) || []
  }
  return ui.bomLineDraftsByVersion[versionId]
}

function syncBomLineDraftsFromDom(): void {
  document.querySelectorAll<HTMLElement>('[data-independent-bom-version]').forEach((section) => {
    const versionId = section.dataset.independentBomVersion || ''
    const current = ensureBomLineDrafts(versionId)
    ui.bomLineDraftsByVersion[versionId] = [...section.querySelectorAll<HTMLElement>('[data-independent-bom-line]')].map((row, index) => {
      const previous = current[index] || {}
      return {
        ...previous,
        bomItemId: row.dataset.independentBomLine || previous.bomItemId,
        materialSkuId: value('bomMaterialSkuId', row),
        usage: Number(value('bomUsage', row)) || 0,
        sampleQuantity: Number(value('bomSampleQuantity', row)) || 0,
        usageUnit: value('bomUsageUnit', row) || 'PCS',
        lossRate: (Number(value('bomLossRate', row)) || 0) / 100,
        dyeRequirement: value('bomDyeRequirement', row) as '是' | '否',
        printRequirement: value('bomPrintRequirement', row) as '是' | '否',
        remark: value('bomRemark', row),
      }
    })
  })
}

function saveInlineBomDrafts(record: EngineeringIndependentSamplingRecord): void {
  syncBomLineDraftsFromDom()
  record.bomVersionIds.forEach((versionId) => {
    const version = getEngineeringBomVersionById(versionId)
    if (!version) throw new Error('物料与费用方案不存在，请刷新页面后重试。')
    saveEngineeringBomVersion({
      versionId,
      role: ADMINISTRATOR.role,
      userId: ADMINISTRATOR.userId,
      userName: ADMINISTRATOR.userName,
      materialLines: ensureBomLineDrafts(versionId).map((line) => ({
        ...line,
        sampleQuantity: sampleQuantityForPlan(record),
      })),
      updatedAt: nowText(),
    })
  })
}

function renderBomSummary(record: EngineeringIndependentSamplingRecord, readonly: boolean): string {
  const versions = record.bomVersionIds.map(getEngineeringBomVersionById).filter((version): version is NonNullable<typeof version> => Boolean(version))
  if (!versions.length) {
    return '<div class="border-b border-red-200 bg-red-50 p-4 text-sm text-red-700">物料与费用方案不存在，请刷新页面后重试。</div>'
  }
  const sampleQuantity = sampleQuantityForPlan(record)
  const body = versions.map((version) => {
    const lines = readonly ? version.materialLines : ensureBomLineDrafts(version.bomDraftVersionId)
    return `<tbody data-independent-bom-version="${escapeHtml(version.bomDraftVersionId)}">${lines.map((line, index) => {
      let resolved: ReturnType<typeof resolveEngineeringBomMaterialLine> | null = null
      try { resolved = resolveEngineeringBomMaterialLine({ ...line, sampleQuantity }) } catch { resolved = null }
      const materialSku = getMaterialSkuRecordById(line.materialSkuId)
      const materialArchive = materialSku ? getMaterialArchiveById(materialSku.materialId) : null
      const lineId = line.bomItemId || `${version.bomDraftVersionId}-DRAFT-${index + 1}`
      const materialName = resolved?.materialName || materialSku?.materialName || line.materialSkuId
      const materialImageUrl = resolved?.materialImageUrl || line.materialImageUrl || materialSku?.skuImageUrl || materialArchive?.mainImageUrl || ''
      const materialImage = materialImageUrl
        ? imageButton(materialImageUrl, materialName)
        : '<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded border bg-slate-50 px-1 text-center text-[10px] text-red-600">图片缺失</span>'
      const unitPriceValue = resolved?.standardUnitPriceCny || materialSku?.costPrice || 0
      const pricingUnit = resolved?.pricingUnit || materialSku?.pricingUnit || line.usageUnit
      const unitPrice = `¥ ${unitPriceValue.toFixed(4)} / ${escapeHtml(pricingUnit)}`
      const materialSubtotal = resolved?.materialCostCny ? `¥ ${resolved.materialCostCny.toFixed(2)}` : '¥ 0.00'
      return `<tr class="border-b" data-independent-bom-line="${escapeHtml(lineId)}"><td class="p-2"><div class="flex min-w-72 items-center gap-2">${materialImage}${readonly ? `<span>${escapeHtml(resolved?.materialName || line.materialSkuId)}</span>` : `<select class="h-9 min-w-56 rounded border px-2" data-${PREFIX}-field="bomMaterialSkuId">${materialSkuOptions(line.materialSkuId)}</select>`}</div></td><td class="p-2">${readonly ? `${line.usage} ${escapeHtml(line.usageUnit)}` : `<div class="flex"><input type="number" min="0.0001" step="0.0001" class="h-9 w-24 rounded-l border px-2" data-${PREFIX}-field="bomUsage" value="${line.usage}"><input class="h-9 w-20 rounded-r border border-l-0 px-2" data-${PREFIX}-field="bomUsageUnit" value="${escapeHtml(line.usageUnit)}"></div>`}</td><td class="p-2">${readonly ? `${Math.round(line.lossRate * 10_000) / 100}%` : `<input type="number" min="0" max="99.99" step="0.01" class="h-9 w-20 rounded border px-2" data-${PREFIX}-field="bomLossRate" value="${Math.round(line.lossRate * 10_000) / 100}">`}</td><td class="p-2">${readonly ? line.dyeRequirement || '否' : `<select class="h-9 rounded border px-2" data-${PREFIX}-field="bomDyeRequirement"><option ${line.dyeRequirement !== '是' ? 'selected' : ''}>否</option><option ${line.dyeRequirement === '是' ? 'selected' : ''}>是</option></select>`}</td><td class="p-2">${readonly ? line.printRequirement || '否' : `<select class="h-9 rounded border px-2" data-${PREFIX}-field="bomPrintRequirement"><option ${line.printRequirement !== '是' ? 'selected' : ''}>否</option><option ${line.printRequirement === '是' ? 'selected' : ''}>是</option></select>`}</td><td class="p-2">${unitPrice}</td><td class="p-2">${materialSubtotal}</td><td class="p-2">${readonly ? escapeHtml(line.remark || '-') : `<input class="h-9 min-w-40 rounded border px-2" data-${PREFIX}-field="bomRemark" value="${escapeHtml(line.remark || '')}">`}</td>${readonly ? '' : `<td class="p-2"><button class="text-red-600" data-${PREFIX}-action="remove-bom-line" data-version-id="${escapeHtml(version.bomDraftVersionId)}" data-line-index="${index}">删除</button></td>`}</tr>`
    }).join('')}</tbody>`
  }).join('')
  const hasMaterialLines = versions.some((version) => (readonly ? version.materialLines : ensureBomLineDrafts(version.bomDraftVersionId)).length > 0)
  const firstVersionId = versions[0]?.bomDraftVersionId || ''
  return `<div class="overflow-hidden rounded-lg border" data-design-revision-material-table><div class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"><h4 class="font-medium">物料与加工要求</h4>${readonly ? '' : `<button type="button" class="rounded border px-3 py-2 text-sm text-blue-700" data-${PREFIX}-action="add-bom-line" data-version-id="${escapeHtml(firstVersionId)}">新增物料</button>`}</div><div class="overflow-x-auto"><table class="w-full min-w-[1320px] text-sm"><thead><tr class="border-b bg-slate-50 text-left"><th class="p-2">物料</th><th class="p-2">单位用量</th><th class="p-2">损耗率 %</th><th class="p-2">染色</th><th class="p-2">印花</th><th class="p-2">标准单价</th><th class="p-2">物料小计</th><th class="p-2">说明</th>${readonly ? '' : '<th class="p-2">操作</th>'}</tr></thead>${hasMaterialLines ? body : `<tbody data-independent-bom-version="${escapeHtml(firstVersionId)}"><tr><td colspan="9" class="p-6 text-center text-amber-700">请由买手手工新增本次使用的物料。</td></tr></tbody>`}</table></div></div>`
}

function renderPricingPlanCosts(record: EngineeringIndependentSamplingRecord, readonly: boolean): string {
  const plan = getEngineeringBomPricingPlan('INDEPENDENT_SAMPLING', record.samplingTaskId)
  if (!plan) return '<div class="border-t border-red-200 bg-red-50 p-4 text-sm text-red-700">费用方案不存在，请刷新页面后重试。</div>'
  const draft = readonly
    ? { customCostDecision: plan.customCostDecision, customCosts: plan.customCosts.map((cost) => ({ ...cost })) }
    : ensurePricingPlanDraft(record)
  const versions = record.bomVersionIds.map(getEngineeringBomVersionById).filter((version): version is NonNullable<typeof version> => Boolean(version))
  const sampleQuantity = sampleQuantityForPlan(record)
  const materialLines = versions.flatMap((version) => (readonly ? version.materialLines : ensureBomLineDrafts(version.bomDraftVersionId)).map((line) => ({ ...line, sampleQuantity })))
  const exchangeRate = getLatestPcsExchangeRate().idrPerCny
  const materialCostCny = Math.round(materialLines.reduce((total, line) => {
    try { return total + (resolveEngineeringBomMaterialLine(line).materialCostCny || 0) } catch { return total }
  }, 0) * 100) / 100
  const customCostIdr = Math.round(draft.customCosts.reduce((total, cost) => total + Math.max(0, Number(cost.amountIdr) || 0), 0))
  const comprehensiveCostCny = Math.round((materialCostCny + customCostIdr / exchangeRate) * 100) / 100
  const comprehensiveCostIdr = Math.round(materialCostCny * exchangeRate + customCostIdr)
  const editable = !readonly && plan.status === 'DRAFT' && !plan.editingLockedAt
  const feeRows = draft.customCosts.length
    ? draft.customCosts.map((cost, index) => `<div class="grid gap-3 border-t p-3 md:grid-cols-[1fr_220px_1fr_80px]" data-independent-pricing-cost-row="${escapeHtml(cost.customCostId || `${record.samplingTaskId}-COST-${index + 1}`)}"><input class="h-9 rounded border px-3" data-${PREFIX}-field="customCostTitle" value="${escapeHtml(cost.title)}" placeholder="费用名称，如车位费" ${editable ? '' : 'disabled'}><label class="flex items-center gap-2"><span>Rp</span><input class="h-9 w-full rounded border px-3" type="number" min="1" step="1" data-${PREFIX}-field="customCostAmount" value="${cost.amountIdr || ''}" placeholder="金额" ${editable ? '' : 'disabled'}></label><input class="h-9 rounded border px-3" data-${PREFIX}-field="customCostNote" value="${escapeHtml(cost.note || '')}" placeholder="备注" ${editable ? '' : 'disabled'}>${editable ? `<button class="text-sm text-red-600" data-${PREFIX}-action="remove-custom-cost" data-sampling-id="${escapeHtml(record.samplingTaskId)}" data-cost-index="${index}">删除</button>` : '<span class="text-sm text-slate-500">已锁定</span>'}</div>`).join('')
    : '<p class="border-t p-5 text-center text-sm text-slate-500">暂无自定义费用明细。</p>'
  return `<div class="overflow-hidden rounded-lg border" data-design-revision-pricing><div class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"><h4 class="font-medium">费用与综合成本</h4>${editable ? `<button class="rounded border px-3 py-2 text-sm text-blue-700" data-${PREFIX}-action="add-custom-cost" data-sampling-id="${escapeHtml(record.samplingTaskId)}">新增费用</button>` : '<span class="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">已锁定</span>'}</div><div>${feeRows}</div><div class="grid gap-3 border-t bg-slate-50 p-4 md:grid-cols-5" data-design-revision-cost-summary><article><p class="text-xs text-slate-500">物料成本</p><p class="mt-1 font-semibold">¥ ${materialCostCny.toFixed(2)}</p></article><article><p class="text-xs text-slate-500">其他费用</p><p class="mt-1 font-semibold">Rp ${customCostIdr.toLocaleString('id-ID')}</p></article><article><p class="text-xs text-slate-500">系统汇率</p><p class="mt-1 font-semibold">1 CNY = ${exchangeRate.toLocaleString('id-ID')} IDR</p></article><article><p class="text-xs text-slate-500">综合成本 CNY</p><p class="mt-1 font-semibold text-blue-700">¥ ${comprehensiveCostCny.toFixed(2)}</p></article><article><p class="text-xs text-slate-500">综合成本 IDR</p><p class="mt-1 font-semibold text-blue-700">Rp ${comprehensiveCostIdr.toLocaleString('id-ID')}</p></article></div></div>`
}

function renderMaterialAndPricingPlan(record: EngineeringIndependentSamplingRecord, readonly: boolean): string {
  return `<section class="space-y-4 rounded-lg border bg-white p-4" data-design-revision-material-pricing>${renderBomSummary(record, readonly)}${renderPricingPlanCosts(record, readonly)}</section>`
}

function refreshMaterialPricingRegion(record: EngineeringIndependentSamplingRecord): void {
  const region = document.querySelector<HTMLElement>('[data-design-revision-material-pricing]')
  if (region) region.outerHTML = renderMaterialAndPricingPlan(record, false)
}

function refreshMaterialPricingSummary(record: EngineeringIndependentSamplingRecord): void {
  const current = document.querySelector<HTMLElement>('[data-design-revision-cost-summary]')
  if (!current) return
  const holder = document.createElement('div')
  holder.innerHTML = renderPricingPlanCosts(record, false)
  const next = holder.querySelector<HTMLElement>('[data-design-revision-cost-summary]')
  if (next) current.replaceWith(next)
}

function suggestTaskTypesForWorkPreview(
  record: EngineeringIndependentSamplingRecord,
  readonly: boolean,
): EngineeringIndependentProfessionalTaskType[] {
  if (readonly) return suggestEngineeringIndependentTaskTypes(record)
  const bomLines = record.bomVersionIds.flatMap((versionId) => ensureBomLineDrafts(versionId))
  return suggestEngineeringIndependentTaskTypesForBomLines(record, bomLines)
}

function renderWorkPreview(record: EngineeringIndependentSamplingRecord, readonly: boolean): string {
  const suggested = suggestTaskTypesForWorkPreview(record, readonly)
  return `<section class="rounded-lg border bg-white p-4" data-design-revision-work-preview><h3 class="font-semibold">将生成的工作</h3><div class="mt-3 flex flex-wrap gap-2">${suggested.map((type) => `<span class="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">${escapeHtml(TASK_OPTIONS.find((item) => item.value === type)?.label || type)}</span>`).join('')}</div></section>`
}

function refreshWorkPreview(record: EngineeringIndependentSamplingRecord): void {
  const current = document.querySelector<HTMLElement>('[data-design-revision-work-preview]')
  if (current) current.outerHTML = renderWorkPreview(record, false)
}

function materialSkuOptions(selected = ''): string {
  return listMaterialArchives().filter((archive) => archive.status === 'ACTIVE').flatMap((archive) => listMaterialSkuRecordsByMaterialId(archive.materialId).filter((sku) => sku.status === 'ACTIVE' && sku.costPrice > 0).map((sku) => `<option value="${escapeHtml(sku.materialSkuId)}" ${sku.materialSkuId === selected ? 'selected' : ''}>${escapeHtml(sku.materialSkuCode)} · ${escapeHtml(archive.materialName)}</option>`)).join('')
}

function dependencyNames(record: EngineeringIndependentSamplingRecord, task: EngineeringIndependentProfessionalTask): string {
  return task.dependsOnTaskIds.length ? task.dependsOnTaskIds.map((id) => record.professionalTasks.find((item) => item.taskId === id)?.taskName || '前一项工作').join('、') : '无'
}

function nextTeam(record: EngineeringIndependentSamplingRecord, task: EngineeringIndependentProfessionalTask): string {
  const dependents = record.professionalTasks.filter((item) => item.dependsOnTaskIds.includes(task.taskId))
  if (dependents.length) return dependents.map((item) => item.ownerTeamName).join('、')
  return record.professionalTasks.every((item) => item.taskId === task.taskId || item.status === 'COMPLETED') ? '买手确认本次结果' : '其他并行团队继续处理'
}

function ensureSampleRequirementDrafts(record: EngineeringIndependentSamplingRecord): typeof ui.sampleRequirementDraftsByTask[string] {
  if (ui.sampleRequirementDraftsByTask[record.samplingTaskId]) return ui.sampleRequirementDraftsByTask[record.samplingTaskId]
  const saved = record.professionalTasks.find((task) => task.taskType === 'DISPLAY_SAMPLE')?.sampleRequirements || []
  const current = saved[0]
  ui.sampleRequirementDraftsByTask[record.samplingTaskId] = [{
    draftId: current?.requirementLineId || `${record.samplingTaskId}-DISPLAY-REQ-DRAFT-1`,
    targetColor: current?.targetColor || record.colorMappings[0]?.targetColor || '整款',
    targetSize: 'M',
    requiredQuantity: current?.requiredQuantity || 1,
    requirementNote: current?.requirementNote || '',
  }]
  return ui.sampleRequirementDraftsByTask[record.samplingTaskId]
}

function renderSampleRequirementTable(record: EngineeringIndependentSamplingRecord, locked: boolean): string {
  const draft = ensureSampleRequirementDrafts(record)[0]
  return `<section class="overflow-hidden rounded-lg border bg-white" data-design-revision-display-sample-arrangement><div class="flex items-center justify-between gap-3 border-b px-4 py-3"><h3 class="font-semibold">销售展示样衣制作安排</h3>${locked ? '<span class="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">已下达</span>' : ''}</div><div class="grid gap-4 p-4 md:grid-cols-[180px_220px_1fr]" data-sample-requirement-row="${escapeHtml(draft.draftId)}"><div><p class="text-sm text-slate-600">默认尺码</p><p class="mt-1 flex h-10 items-center rounded border bg-slate-50 px-3 font-medium">M</p></div><label class="text-sm text-slate-600">样衣数量（件）${locked ? `<p class="mt-1 flex h-10 items-center rounded border bg-slate-50 px-3 font-medium">${draft.requiredQuantity} 件</p>` : `<input type="number" min="1" step="1" class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="sampleRequirementQuantity" value="${draft.requiredQuantity}">`}</label><label class="text-sm text-slate-600">制作要求${locked ? `<p class="mt-1 min-h-10 whitespace-pre-wrap rounded border bg-slate-50 px-3 py-2 text-slate-800">${escapeHtml(draft.requirementNote || '-')}</p>` : `<textarea class="mt-1 min-h-10 w-full rounded border px-3 py-2" rows="2" data-${PREFIX}-field="sampleRequirementNote" placeholder="填写制作注意事项">${escapeHtml(draft.requirementNote)}</textarea>`}</label></div></section>`
}

function renderWorkPlan(record: EngineeringIndependentSamplingRecord): string {
  return `<section class="space-y-4"><section class="overflow-hidden rounded-lg border bg-white"><div class="border-b px-4 py-3"><h2 class="font-semibold">本次需要完成的工作</h2></div><div class="overflow-x-auto"><table class="w-full min-w-[1080px] text-sm"><thead><tr class="border-b bg-slate-50 text-left"><th class="p-3">任务</th><th class="p-3">当前团队</th><th class="p-3">当前动作</th><th class="p-3">需要先完成</th><th class="p-3">完成后去向</th><th class="p-3">状态</th><th class="p-3">操作</th></tr></thead><tbody>${record.professionalTasks.map((task) => {
    const processStatuses = readDesignRevisionProcessWorkOrderStatuses(task.processWorkOrderRefs)
    const processLinks = task.processWorkOrderRefs.map((ref) => {
      const href = ref.processType === 'PRINTING'
        ? buildPrintingWorkOrderDetailLink(ref.processOrderId)
        : buildDyeingWorkOrderDetailLink(ref.processOrderId)
      const status = processStatuses.find((item) => item.processType === ref.processType && item.processOrderId === ref.processOrderId)
      return `<a class="block text-xs text-blue-700" href="${escapeHtml(href)}">${ref.processType === 'PRINTING' ? '印花加工单' : '染色加工单'} ${escapeHtml(ref.processOrderCode || ref.processOrderId)}${status ? ` · ${escapeHtml(status.statusLabel)}` : ''}</a>`
    }).join('')
    return `<tr class="border-b"><td class="p-3 font-medium">${escapeHtml(task.taskName)}${processLinks ? `<div class="mt-2 space-y-1">${processLinks}</div>` : ''}</td><td class="p-3">${escapeHtml(getEngineeringIndependentProfessionalTaskCurrentTeam(task) || '-')}</td><td class="p-3">${escapeHtml(task.status === 'WAIT_DEPENDENCY' ? '等待前面工作完成' : task.status === 'WAIT_REVIEW' ? '审核本次成果' : task.status === 'REWORK' ? '根据未通过项重做' : task.status === 'COMPLETED' ? '无' : (task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') && !task.colorRequirementConfirmedAt ? '填写潘通色号和颜色名称' : task.status === 'IN_PROGRESS' ? '制作并提交成果' : '开始本项工作')}</td><td class="p-3">${escapeHtml(dependencyNames(record, task))}</td><td class="p-3">${escapeHtml(nextTeam(record, task))}</td><td class="p-3">${escapeHtml(TASK_STATUS_TEXT[task.status])}</td><td class="p-3"><a class="text-blue-700" href="${getIndependentProfessionalTaskDetailPath(task)}">进入任务</a></td></tr>`
  }).join('')}</tbody></table></div></section>${renderSampleRequirementTable(record, true)}</section>`
}

const SAMPLING_STEPS: Array<{ key: Exclude<EngineeringIndependentSamplingStep, 'COMPLETED'>; title: string; team: string }> = [
  { key: 'SCHEME_CONFIRMATION', title: '确认本次方案', team: '买手' },
  { key: 'PROFESSIONAL_WORK', title: '专业工作', team: '专业团队' },
  { key: 'RESULT_CONFIRMATION', title: '确认本次结果', team: '买手' },
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
  return `<nav class="grid overflow-hidden rounded-lg border bg-white md:grid-cols-3" aria-label="设计改款任务步骤">${SAMPLING_STEPS.map((step, index) => {
    const completed = record.status === 'COMPLETED' || index < currentIndex
    const current = record.status !== 'COMPLETED' && index === currentIndex
    const locked = index > currentIndex
    return `<button type="button" class="border-b p-4 text-left md:border-b-0 md:border-r ${selectedIndex === index ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : ''} ${locked ? 'cursor-not-allowed bg-slate-50 text-slate-400' : 'hover:bg-slate-50'}" data-${PREFIX}-action="select-detail-step" data-sampling-id="${escapeHtml(record.samplingTaskId)}" data-step-index="${index}" ${locked ? 'disabled' : ''}><span class="flex items-center gap-2"><span class="flex h-6 w-6 items-center justify-center rounded-full ${completed ? 'bg-emerald-500 text-white' : current ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}">${completed ? '✓' : index + 1}</span><strong>${escapeHtml(step.title)}</strong></span><span class="mt-2 block pl-8 text-xs">${escapeHtml(step.team)} · ${completed ? '已完成' : current ? '当前步骤' : '待前一步完成'}</span></button>`
  }).join('')}</nav>`
}

function renderSchemeConfirmationStep(record: EngineeringIndependentSamplingRecord, readonly: boolean): string {
  const bomReady = record.bomVersionIds.length > 0
  const returned = record.buyerPreparationReturnedAt
    ? `<p class="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">方案已重新打开：${escapeHtml(record.buyerPreparationReturnReason)}</p>`
    : ''
  const workPreview = renderWorkPreview(record, readonly)
  const details = bomReady ? `${renderMaterialAndPricingPlan(record, readonly)}${renderSampleRequirementTable(record, readonly)}${workPreview}` : ''
  const action = !readonly && bomReady ? `<div class="sticky bottom-3 flex justify-end rounded-lg border bg-white/95 p-4 shadow"><button class="rounded bg-blue-600 px-5 py-2 text-white" data-${PREFIX}-action="confirm-scheme" data-sampling-id="${escapeHtml(record.samplingTaskId)}">确认方案并生成工作</button></div>` : ''
  return `<section class="space-y-4"><header class="rounded-lg border bg-white p-4"><div class="flex items-center justify-between gap-3"><h2 class="font-semibold">第一步：确认本次方案</h2><span class="rounded-full ${readonly ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'} px-2 py-1 text-xs">${readonly ? '已确认' : '买手处理'}</span></div></header>${returned}${details}${action}</section>`
}

function renderProfessionalWorkStep(record: EngineeringIndependentSamplingRecord): string {
  if (!record.taskPlanConfirmedAt) return '<section class="rounded-lg border border-dashed bg-slate-50 p-6 text-sm text-slate-500">待买手确认本次方案。</section>'
  return `<section class="space-y-4"><header class="rounded-lg border bg-white p-4"><div class="flex items-center justify-between gap-3"><h2 class="font-semibold">第二步：专业工作</h2><span class="rounded-full ${record.status === 'WAIT_CONFIRMATION' || record.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'} px-2 py-1 text-xs">${record.status === 'WAIT_CONFIRMATION' || record.status === 'COMPLETED' ? '已完成' : '处理中'}</span></div></header>${renderWorkPlan(record)}</section>`
}

function renderResultConfirmationStep(record: EngineeringIndependentSamplingRecord): string {
  return `<section class="space-y-4"><header class="rounded-lg border bg-white p-4"><div class="flex items-center justify-between gap-3"><h2 class="font-semibold">第三步：确认本次结果</h2><span class="rounded-full ${record.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : record.status === 'WAIT_CONFIRMATION' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'} px-2 py-1 text-xs">${record.status === 'COMPLETED' ? '已完成' : record.status === 'WAIT_CONFIRMATION' ? '买手处理' : '等待专业工作完成'}</span></div></header><section class="rounded-lg border bg-white p-4"><h3 class="font-semibold">本次成果</h3>${record.status === 'WAIT_CONFIRMATION' ? `<div class="mt-3 grid gap-2"><input class="h-9 rounded border px-3" data-${PREFIX}-field="resultVersion" placeholder="成果版本，如 v1.0"><textarea class="rounded border p-3" data-${PREFIX}-field="resultSummary" placeholder="填写本次实际完成结果"></textarea><button class="rounded bg-blue-600 px-4 py-2 text-white" data-${PREFIX}-action="confirm-result" data-sampling-id="${escapeHtml(record.samplingTaskId)}">确认本次结果</button></div>` : `<p class="mt-3 text-sm">${record.resultVersion ? `${escapeHtml(record.resultVersion)} · ${escapeHtml(record.resultSummary)}` : '待全部专业工作完成'}</p>`}</section></section>`
}

function renderDesignFileHistory(record: EngineeringIndependentSamplingRecord): string {
  const canReplace = !record.taskPlanConfirmedAt
  return `<section class="rounded-lg border bg-white p-4" data-design-revision-design-files><div class="flex flex-wrap items-center justify-between gap-3"><h2 class="font-semibold">设计稿</h2>${canReplace ? `<label class="inline-flex h-9 cursor-pointer items-center rounded border border-blue-200 px-3 text-sm text-blue-700">替换设计稿<input class="sr-only" type="file" accept="${escapeHtml(ENGINEERING_UPLOAD_RULES.DESIGN_IMAGE.accept)}" multiple data-skip-page-rerender="true" data-${PREFIX}-replace-design-upload data-sampling-id="${escapeHtml(record.samplingTaskId)}"></label>` : '<span class="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">已锁定</span>'}</div><div class="mt-3 grid gap-3">${record.designFiles.map((file, index) => `<article class="rounded border p-3 ${index === record.designFiles.length - 1 ? 'border-blue-300 bg-blue-50/40' : ''}"><button type="button" class="block w-full text-left" data-${PREFIX}-upload-preview data-file-url="${escapeHtml(file.dataUrl)}" data-file-name="${escapeHtml(file.fileName)}"><span class="flex h-36 items-center justify-center overflow-hidden rounded bg-slate-100"><img src="${escapeHtml(file.dataUrl)}" alt="${escapeHtml(file.fileName)}设计稿" class="h-full w-full object-contain" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="text-sm text-red-600">设计稿加载失败</span></span><strong class="mt-2 block truncate text-sm">${escapeHtml(file.fileName)}</strong></button><p class="mt-1 text-xs text-slate-500">${index === record.designFiles.length - 1 ? '当前版本 · ' : '历史版本 · '}${escapeHtml(file.uploadedByName)} · ${escapeHtml(file.uploadedAt)}</p></article>`).join('') || '<p class="text-sm text-red-600">缺少设计稿。</p>'}</div></section>`
}

function renderDesignRevisionBasicInfo(
  record: EngineeringIndependentSamplingRecord,
  currentStep: number,
): string {
  const objective = record.creationReason.trim() || '未填写设计改款目标'
  return `<section class="overflow-hidden rounded-lg border bg-white" data-design-revision-basic-info><header class="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div><div class="flex flex-wrap items-center gap-2"><h1 class="text-xl font-semibold">${escapeHtml(record.samplingTaskCode)}</h1><span class="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">${escapeHtml(samplingStatusText(record))}</span></div><p class="mt-1 text-sm text-slate-500">设计改款 · 买手：${escapeHtml(record.buyerName)}</p></div><a class="rounded border px-4 py-2 text-sm" href="/pcs/production-preparation/design-revision">返回列表</a></header><div class="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]" data-design-revision-basic-columns><div class="space-y-4"><section class="rounded-lg border border-blue-100 bg-blue-50/60 px-5 py-4" data-design-revision-objective><p class="text-sm font-medium text-blue-700">设计改款目标</p><p class="mt-2 whitespace-pre-wrap text-base font-medium leading-7 text-slate-900">${escapeHtml(objective)}</p></section><div class="grid gap-4 md:grid-cols-2">${styleCard(record.sourceStyleId, '参照款式')}${targetStyleCard(record, '目标款式')}</div><div class="grid gap-4 md:grid-cols-2"><div class="rounded-lg border bg-slate-50 p-4"><p class="text-xs text-slate-500">当前需处理的团队</p><p class="mt-1 font-medium">${escapeHtml(getEngineeringIndependentCurrentTeam(record) || '已完成')}</p></div><div class="rounded-lg border bg-slate-50 p-4"><p class="text-xs text-slate-500">当前步骤</p><p class="mt-1 font-medium">${escapeHtml(SAMPLING_STEPS[currentStep].title)}</p></div></div></div>${renderDesignFileHistory(record)}</div></section>`
}

export function renderPcsIndependentSamplingDetailPage(id: string): string {
  const record = getEngineeringIndependentSamplingRecord(id)
  if (!record) return '<section class="p-6"><h1 class="text-xl font-semibold">任务不存在</h1></section>'
  if (!(record.samplingTaskId in ui.detailStepByTask) && typeof location !== 'undefined') {
    const query = new URLSearchParams(location.search)
    if (query.get('step') === 'buyer') ui.detailStepByTask[record.samplingTaskId] = 0
  }
  const selectedStep = ui.detailStepByTask[record.samplingTaskId] ?? currentSamplingStepIndex(record)
  const currentStep = currentSamplingStepIndex(record)
  const stepContent = selectedStep === 0
    ? renderSchemeConfirmationStep(record, Boolean(record.taskPlanConfirmedAt))
    : selectedStep === 1
      ? renderProfessionalWorkStep(record)
      : renderResultConfirmationStep(record)
  return `<section class="space-y-4 p-4">${renderDesignRevisionBasicInfo(record, currentStep)}${feedbackHtml()}${renderSamplingStepNav(record)}${stepContent}<section class="rounded-lg border bg-white p-4"><h2 class="font-semibold">操作记录</h2><div class="mt-3 space-y-2">${record.operationLogs.map((log) => `<div class="grid gap-1 border-b pb-2 text-sm md:grid-cols-[160px_200px_1fr]"><span>${escapeHtml(log.occurredAt)}</span><span>${escapeHtml(log.operatorName)} · ${escapeHtml(log.action)}</span><span class="text-slate-500">${escapeHtml(log.detail)}</span></div>`).join('')}</div></section>${renderDialogHost()}</section>`
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
  return listEngineeringIndependentAvailablePatternVersions(found.record).map((item) => item.value)
}

function renderDisplaySampleRequirementSummary(task: EngineeringIndependentProfessionalTask): string {
  const requirements = task.sampleRequirements || []
  const expectedTotal = requirements.reduce((sum, line) => sum + line.requiredQuantity, 0)
  const actualTotal = task.results.reduce((sum, result) => sum + Number(result.sampleQuantity || 0), 0)
  return `<section class="overflow-hidden rounded-lg border bg-white"><div class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"><div><h2 class="font-semibold">买手确认的制作要求</h2><p class="mt-1 text-sm text-slate-500">要求合计 ${expectedTotal} 件</p></div>${task.results.length ? `<span class="rounded-full ${actualTotal === expectedTotal ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'} px-2 py-1 text-xs">实际 ${actualTotal} 件 · ${actualTotal === expectedTotal ? '数量一致' : `相差 ${actualTotal - expectedTotal} 件`}</span>` : ''}</div><div class="overflow-x-auto"><table class="w-full min-w-[720px] text-sm"><thead><tr class="border-b bg-slate-50 text-left"><th class="p-3">颜色</th><th class="p-3">尺码</th><th class="p-3">要求数量</th><th class="p-3">制作要求</th><th class="p-3">确认人</th></tr></thead><tbody>${requirements.map((line) => `<tr class="border-b"><td class="p-3">${escapeHtml(line.targetColor)}</td><td class="p-3">${escapeHtml(line.targetSize)}</td><td class="p-3">${line.requiredQuantity} 件</td><td class="p-3">${escapeHtml(line.requirementNote || '-')}</td><td class="p-3">${escapeHtml(line.issuedBy)}<small class="block text-slate-500">${escapeHtml(line.issuedAt)}</small></td></tr>`).join('') || '<tr><td colspan="5" class="p-6 text-center text-red-600">尚未确认制作要求</td></tr>'}</tbody></table></div></section>`
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
  const targetLabel = style?.styleCode || record.temporarySpuName || record.targetStyleName || '线下临时 SPU'
  const targetBlock = style
    ? `<div class="flex items-center gap-3">${imageButton(style.mainImageUrl, style.styleName)}<div><p class="font-medium">${escapeHtml(style.styleName)}</p><p class="text-sm text-slate-500">${escapeHtml(style.styleCode)}</p></div></div>`
    : `<div class="flex items-center gap-3">${imageButton(record.designFiles.at(-1)?.dataUrl || '', targetLabel)}<div><p class="font-medium">${escapeHtml(targetLabel)}</p><p class="text-sm text-slate-500">线下临时 SPU</p></div></div>`
  const isColor = task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC'
  const canSubmit = ['IN_PROGRESS', 'REWORK'].includes(task.status)
  const currentTeam = getEngineeringIndependentProfessionalTaskCurrentTeam(task) || '-'
  const waitingColorRequirement = isColor && !task.colorRequirementConfirmedAt && ['WAIT_START', 'IN_PROGRESS', 'REWORK'].includes(task.status)
  const currentAction = waitingColorRequirement
    ? '由买手确认潘通色号和颜色名称'
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
  return `<section class="space-y-4 p-4"><header class="rounded-lg border bg-white"><div class="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div><div class="flex items-center gap-2"><h1 class="text-xl font-semibold">${escapeHtml(task.taskName)}</h1><span class="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">${escapeHtml(TASK_STATUS_TEXT[task.status])}</span></div><p class="mt-1 text-sm text-slate-500">${escapeHtml(record.samplingTaskCode)} · 目标款式 ${escapeHtml(targetLabel)} · 来源：设计改款</p></div><a class="rounded border px-4 py-2 text-sm" href="/pcs/production-preparation/design-revision/${escapeHtml(record.samplingTaskId)}">返回主任务</a></div><div class="grid gap-4 px-5 py-4 md:grid-cols-[2fr_1fr_1fr_1fr]">${targetBlock}<div><p class="text-xs text-slate-500">当前需处理的团队</p><p class="mt-1 font-medium">${escapeHtml(currentTeam)}</p></div><div><p class="text-xs text-slate-500">需要先完成</p><p class="mt-1 font-medium">${escapeHtml(dependencyNames(record, task))}</p></div><div><p class="text-xs text-slate-500">完成后去向</p><p class="mt-1 font-medium">${escapeHtml(nextTeam(record, task))}</p></div></div><div class="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-5 py-4"><div><p class="text-xs text-slate-500">当前动作</p><p class="mt-1 text-sm">${escapeHtml(currentAction)}</p></div>${task.status === 'WAIT_START' && !waitingColorRequirement ? `<button class="rounded bg-blue-600 px-4 py-2 text-white" data-${PREFIX}-action="start-task" data-task-id="${escapeHtml(task.taskId)}">开始任务</button>` : ''}</div></header>${feedbackHtml()}${task.taskType === 'DISPLAY_SAMPLE' ? renderDisplaySampleRequirementSummary(task) : ''}${isColor ? `<section class="rounded-lg border bg-white p-4"><h2 class="font-semibold">颜色要求</h2><div class="mt-3 grid gap-3 md:grid-cols-3"><label class="text-sm text-slate-600">潘通色号<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="pantoneColorCode" value="${escapeHtml(task.pantoneColorCode)}" ${task.colorRequirementConfirmedAt ? 'readonly' : ''}></label><label class="text-sm text-slate-600">颜色名称<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="colorName" value="${escapeHtml(task.colorName)}" ${task.colorRequirementConfirmedAt ? 'readonly' : ''}></label><div class="self-end text-sm text-slate-500">${task.colorRequirementConfirmedAt ? `买手已确认 · ${escapeHtml(task.colorRequirementConfirmedBy)} · ${escapeHtml(task.colorRequirementConfirmedAt)}` : '待买手确认'}</div></div>${!task.colorRequirementConfirmedAt && ['WAIT_START', 'IN_PROGRESS', 'REWORK'].includes(task.status) ? `<button class="mt-4 rounded border border-blue-200 px-4 py-2 text-blue-700" data-${PREFIX}-action="confirm-color-requirement" data-task-id="${escapeHtml(task.taskId)}">买手确认颜色要求</button>` : ''}</section>` : ''}${submitSection}<section class="rounded-lg border bg-white p-4"><h2 class="font-semibold">成果记录</h2><div class="mt-3 grid gap-3 md:grid-cols-2">${resultCards}</div>${task.status === 'WAIT_REVIEW' ? `<button class="mt-4 rounded bg-blue-600 px-4 py-2 text-white" data-${PREFIX}-action="review-task" data-task-id="${escapeHtml(task.taskId)}">买手提交整张审核</button>` : ''}</section><section class="rounded-lg border bg-white p-4"><h2 class="font-semibold">操作记录</h2><div class="mt-3 space-y-2">${record.operationLogs.filter((log) => log.detail.includes(task.taskName) || log.action === '创建任务').map((log) => `<p class="border-b pb-2 text-sm"><span class="text-slate-500">${escapeHtml(log.occurredAt)}</span> · ${escapeHtml(log.operatorName)} · ${escapeHtml(log.action)} · ${escapeHtml(log.detail)}</p>`).join('') || '<p class="text-sm text-slate-500">暂无操作记录</p>'}</div></section>${renderDialogHost()}</section>`
}

function syncSampleRequirementsFromDom(samplingTaskId: string): void {
  const rows = [...document.querySelectorAll<HTMLElement>('[data-sample-requirement-row]')]
  if (!rows.length) return
  const current = ui.sampleRequirementDraftsByTask[samplingTaskId]?.[0]
  ui.sampleRequirementDraftsByTask[samplingTaskId] = rows.map((row) => ({
    draftId: row.dataset.sampleRequirementRow || `${samplingTaskId}-DISPLAY-REQ-DRAFT-${Date.now().toString(36)}`,
    targetColor: current?.targetColor || '整款',
    targetSize: 'M',
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
  if (action === 'open-create') { ui.createOpen = true; resetCreateDraft(); setFeedback(''); refreshDialogs(); return true }
  if (action === 'close-create') { if (target !== node && target.closest('section')) return false; ui.createOpen = false; resetCreateDraft(); refreshDialogs(); return true }
  if (action === 'remove-create-design') { ui.createDraft.designFiles = ui.createDraft.designFiles.filter((file) => file.fileId !== node.dataset.fileId); refreshDialogs(); return true }
  if (action === 'remove-create-pattern') { ui.createDraft.reusedPatternFiles = ui.createDraft.reusedPatternFiles.filter((file) => file.fileId !== node.dataset.fileId); refreshDialogs(); return true }
  if (action === 'create') { run(() => { const created = createEngineeringIndependentSampling({ samplingType: 'DESIGN_REVISION', sourceStyleId: ui.createDraft.sourceStyleId, targetMode: ui.createDraft.targetMode, targetStyleId: ui.createDraft.targetStyleId, temporarySpuName: ui.createDraft.temporarySpuName, creationReason: ui.createDraft.creationReason, designFiles: ui.createDraft.designFiles, patternHandling: ui.createDraft.patternHandling, reusedPatternFiles: ui.createDraft.reusedPatternFiles, buyer: BUYER, createdAt: nowText() }); ui.createOpen = false; resetCreateDraft(); window.history.pushState({}, '', `/pcs/production-preparation/design-revision/${created.samplingTaskId}`); window.dispatchEvent(new PopStateEvent('popstate')) }, '设计改款任务已创建。'); return true }
  if (action === 'select-detail-step') { const samplingId = node.dataset.samplingId || ''; const record = getEngineeringIndependentSamplingRecord(samplingId); const nextIndex = Number(node.dataset.stepIndex); if (record && Number.isInteger(nextIndex) && nextIndex <= currentSamplingStepIndex(record)) { ui.detailStepByTask[samplingId] = nextIndex; rerender() } return true }
  if (action === 'add-custom-cost') { const samplingId = node.dataset.samplingId || ''; const record = getEngineeringIndependentSamplingRecord(samplingId); if (!record) return true; syncPricingPlanDraftFromDom(samplingId); const draft = ensurePricingPlanDraft(record); draft.customCostDecision = 'HAS_CUSTOM_COST'; draft.customCosts.push({ customCostId: `${samplingId}-COST-DRAFT-${Date.now().toString(36)}`, title: '', amountIdr: 0, note: '', displayOrder: draft.customCosts.length + 1 }); rerender(); return true }
  if (action === 'remove-custom-cost') { const samplingId = node.dataset.samplingId || ''; const record = getEngineeringIndependentSamplingRecord(samplingId); if (!record) return true; syncPricingPlanDraftFromDom(samplingId); const draft = ensurePricingPlanDraft(record); const index = Number(node.dataset.costIndex); if (Number.isInteger(index)) draft.customCosts.splice(index, 1); if (!draft.customCosts.length) draft.customCostDecision = 'NO_CUSTOM_COST'; rerender(); return true }
  if (action === 'add-bom-line') { syncBomLineDraftsFromDom(); const versionId = node.dataset.versionId || ''; const firstArchive = listMaterialArchives().find((archive) => archive.status === 'ACTIVE' && listMaterialSkuRecordsByMaterialId(archive.materialId).some((sku) => sku.status === 'ACTIVE' && sku.costPrice > 0)); const firstSku = firstArchive ? listMaterialSkuRecordsByMaterialId(firstArchive.materialId).find((sku) => sku.status === 'ACTIVE' && sku.costPrice > 0) : null; ensureBomLineDrafts(versionId).push({ bomItemId: `${versionId}-DRAFT-${Date.now().toString(36)}`, materialSkuId: firstSku?.materialSkuId || '', usage: 1, sampleQuantity: 1, usageUnit: firstSku?.pricingUnit || 'PCS', lossRate: 0, dyeRequirement: '否', printRequirement: '否', remark: '' }); rerender(); return true }
  if (action === 'remove-bom-line') { syncBomLineDraftsFromDom(); const versionId = node.dataset.versionId || ''; const index = Number(node.dataset.lineIndex); if (Number.isInteger(index)) ensureBomLineDrafts(versionId).splice(index, 1); rerender(); return true }
  if (action === 'confirm-scheme') { const samplingId = node.dataset.samplingId || ''; run(() => { let record = getEngineeringIndependentSamplingRecord(samplingId); if (!record) throw new Error('设计改款任务不存在。'); syncBomLineDraftsFromDom(); syncPricingPlanDraftFromDom(samplingId); syncSampleRequirementsFromDom(samplingId); saveInlineBomDrafts(record); const costDraft = ensurePricingPlanDraft(record); saveEngineeringBomPricingPlan({ ownerStage: 'INDEPENDENT_SAMPLING', ownerId: samplingId, role: ADMINISTRATOR.role, userId: ADMINISTRATOR.userId, userName: ADMINISTRATOR.userName, customCostDecision: costDraft.customCostDecision, customCosts: costDraft.customCosts, updatedAt: nowText() }); record = getEngineeringIndependentSamplingRecord(samplingId); if (!record) throw new Error('设计改款任务不存在。'); confirmEngineeringIndependentSamplingScheme({ samplingTaskId: samplingId, actor: ADMINISTRATOR, selectedTaskTypes: suggestEngineeringIndependentTaskTypes(record), displaySampleAssignment: { ...DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS[0] }, sampleRequirements: readSampleRequirements(samplingId).map((draft) => ({ requirementLineId: draft.draftId, targetColor: draft.targetColor, targetSize: 'M', requiredQuantity: draft.requiredQuantity, requirementNote: draft.requirementNote })) }); delete ui.pricingPlanDraftsByTask[samplingId]; selectCurrentSamplingStep(samplingId) }, '方案已确认，相关专业工作和加工单已生成。'); return true }
  if (action === 'return-buyer-preparation') { const samplingId = node.dataset.samplingId || ''; run(() => { returnEngineeringIndependentBuyerPreparation({ samplingTaskId: samplingId, actor: ADMINISTRATOR, reason: ui.returnReasonByTask[samplingId] || value('buyerReturnReason') }); delete ui.pricingPlanDraftsByTask[samplingId]; ui.detailStepByTask[samplingId] = 0 }, '方案已重新打开。'); return true }
  if (action === 'start-task') { const found = findProfessional(node.dataset.taskId || ''); run(() => { if (!found) throw new Error('任务不存在。'); startEngineeringIndependentProfessionalTask({ taskId: found.task.taskId, actor: ADMINISTRATOR }) }, '任务已开始。'); return true }
  if (action === 'confirm-color-requirement') { run(() => confirmEngineeringIndependentColorRequirement({ taskId: node.dataset.taskId || '', actor: ADMINISTRATOR, pantoneColorCode: value('pantoneColorCode'), colorName: value('colorName') }), '颜色要求已确认。'); return true }
  if (action === 'add-sample-result') { const found = findProfessional(node.dataset.taskId || ''); if (!found) return true; syncSampleResultsFromDom(found.task); const requirement = found.task.sampleRequirements?.[0]; if (!requirement) { setFeedback('尚未下达销售展示样衣制作要求。', false); rerender(); return true } (ui.sampleResultDraftsByTask[found.task.taskId] ||= []).push({ draftId: `${found.task.taskId}-DISPLAY-ACTUAL-DRAFT-${Date.now().toString(36)}`, requirementLineId: requirement.requirementLineId, title: `${requirement.targetColor} / ${requirement.targetSize} 销售展示样衣`, actualColor: requirement.targetColor, actualSize: requirement.targetSize, actualQuantity: 1, sourcePatternVersion: '', productionNote: '', differenceNote: '' }); rerender(); return true }
  if (action === 'remove-sample-result') { const found = findProfessional(node.dataset.taskId || ''); if (!found) return true; syncSampleResultsFromDom(found.task); ui.sampleResultDraftsByTask[found.task.taskId] = (ui.sampleResultDraftsByTask[found.task.taskId] || []).filter((draft) => draft.draftId !== node.dataset.draftId); rerender(); return true }
  if (action === 'submit-task') { const found = findProfessional(node.dataset.taskId || ''); run(() => { if (!found) throw new Error('任务不存在。'); const results = found.task.taskType === 'DISPLAY_SAMPLE' ? readDisplaySampleResults(found.task) : [{ title: value('resultTitle'), version: value('resultVersion'), description: value('resultDescription'), applicablePartOrSize: value('applicablePartOrSize'), sampleQuantity: Number(value('sampleQuantity')) || 0, sampleColor: value('sampleColor'), sampleSize: value('sampleSize'), sourcePatternVersion: value('sourcePatternVersion'), files: professionalFiles(found.task) }]; submitEngineeringIndependentProfessionalTask({ taskId: found.task.taskId, actor: ADMINISTRATOR, results, dyeColorCode: value('dyeColorCode') }); delete ui.sampleResultDraftsByTask[found.task.taskId]; selectCurrentSamplingStep(found.record.samplingTaskId) }, '本次工作已提交。'); return true }
  if (action === 'review-task') { const taskId = node.dataset.taskId || ''; const found = findProfessional(taskId); run(() => { if (!found) throw new Error('任务不存在。'); const decisions = found.task.results.map((result) => { const selected = document.querySelector<HTMLInputElement>(`[data-${PREFIX}-review-result="${result.resultId}"]:checked`); return { resultId: result.resultId, approved: selected?.value === 'approve', reason: document.querySelector<HTMLInputElement>(`[data-${PREFIX}-review-reason="${result.resultId}"]`)?.value || '' } }); reviewEngineeringIndependentProfessionalTask({ taskId, actor: ADMINISTRATOR, decisions }); selectCurrentSamplingStep(found.record.samplingTaskId) }, '审核结果已提交。'); return true }
  if (action === 'confirm-result') { run(() => confirmEngineeringIndependentSamplingResult({ samplingTaskId: node.dataset.samplingId || '', actor: ADMINISTRATOR, resultVersion: value('resultVersion'), resultSummary: value('resultSummary'), confirmedAt: nowText() }), '本次设计改款结果已确认。'); return true }
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
    void captureEngineeringUploadedFiles({ files, purpose: 'DESIGN_IMAGE', actor: { userId: BUYER.userId, userName: BUYER.userName, teamName: '买手' } })
      .then((saved) => { ui.createDraft.designFiles.push(...saved); setFeedback('设计稿已真实读取并保存。'); refreshDialogs() })
      .catch((error) => { setFeedback(error instanceof Error ? error.message : '设计稿上传失败。', false); refreshDialogs() })
    return true
  }
  const createPatternUpload = target.closest<HTMLInputElement>(`[data-${PREFIX}-create-pattern-upload]`)
  if (createPatternUpload) {
    const files = Array.from(createPatternUpload.files || [])
    if (!files.length) return true
    setFeedback('正在读取并保存基码纸样…')
    refreshDialogs()
    void captureEngineeringUploadedFiles({ files, purpose: 'PATTERN_SOURCE', actor: { userId: BUYER.userId, userName: BUYER.userName, teamName: '买手' } })
      .then((saved) => { ui.createDraft.reusedPatternFiles.push(...saved); setFeedback('基码纸样已真实读取并保存。'); refreshDialogs() })
      .catch((error) => { setFeedback(error instanceof Error ? error.message : '基码纸样上传失败。', false); refreshDialogs() })
    return true
  }
  const replaceDesignUpload = target.closest<HTMLInputElement>(`[data-${PREFIX}-replace-design-upload]`)
  if (replaceDesignUpload) {
    const files = Array.from(replaceDesignUpload.files || [])
    const samplingTaskId = replaceDesignUpload.dataset.samplingId || ''
    if (!files.length) return true
    setFeedback('正在读取并保存新的设计稿…')
    rerender()
    void captureEngineeringUploadedFiles({ files, purpose: 'DESIGN_IMAGE', actor: { userId: ADMINISTRATOR.userId, userName: ADMINISTRATOR.userName, teamName: '管理员' } })
      .then((saved) => { replaceEngineeringIndependentDesignFiles({ samplingTaskId, designFiles: saved, actor: ADMINISTRATOR }); setFeedback('新设计稿已保存，历史版本继续保留。'); rerender() })
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
    void uploadEngineeringTaskFiles({ taskId: found.task.taskId, itemId: upload.dataset.itemId, purpose: upload.dataset.uploadPurpose as EngineeringUploadPurpose, files, actor: { userId: ADMINISTRATOR.userId, userName: ADMINISTRATOR.userName, teamName: '管理员' } }).then(() => { setFeedback('文件已真实读取并保存。'); rerender() }).catch((error) => { setFeedback(error instanceof Error ? error.message : '文件上传失败。', false); rerender() })
    return true
  }
  if (target.matches(`[data-${PREFIX}-field="pageSize"]`)) { const controller = currentListController(); controller.setPageSize(Number(target.value)); controller.refresh(); return true }
  if (target.matches(`[data-${PREFIX}-field="teamFilter"]`)) { ui.teamFilter = target.value; listState.currentPage = 1; rerender(); return true }
  if (target.matches(`[data-${PREFIX}-field="displayTeamFilter"]`)) { ui.displayTeamFilter = target.value; displaySampleListState.currentPage = 1; rerender(); return true }
  if (target.matches(`[data-${PREFIX}-field="sourceStyleId"]`)) { ui.createDraft.sourceStyleId = target.value; return true }
  if (target.matches(`[data-${PREFIX}-field="targetStyleId"]`)) { ui.createDraft.targetStyleId = target.value; return true }
  if (target.matches(`[data-${PREFIX}-field="targetMode"]`)) { ui.createDraft.targetMode = target.value as 'ARCHIVED_STYLE' | 'TEMPORARY_SPU'; ui.createDraft.targetStyleId = ''; ui.createDraft.temporarySpuName = ''; refreshDialogs(); return true }
  if (target.matches(`[data-${PREFIX}-field="temporarySpuName"]`)) { ui.createDraft.temporarySpuName = target.value; return true }
  if (target.matches(`[data-${PREFIX}-field="patternHandling"]`)) { ui.createDraft.patternHandling = target.value as 'REUSE' | 'REMAKE'; if (ui.createDraft.patternHandling === 'REMAKE') ui.createDraft.reusedPatternFiles = []; refreshDialogs(); return true }
  if (target.matches(`[data-${PREFIX}-field="creationReason"]`)) { ui.createDraft.creationReason = target.value; return true }
  if (target.matches(`[data-${PREFIX}-field="buyerReturnReason"]`)) { const samplingId = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || ''); ui.returnReasonByTask[samplingId] = target.value; return true }
  if (target.matches(`[data-${PREFIX}-field="customCostTitle"], [data-${PREFIX}-field="customCostAmount"], [data-${PREFIX}-field="customCostNote"]`)) { const samplingId = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || ''); const record = getEngineeringIndependentSamplingRecord(samplingId); syncPricingPlanDraftFromDom(samplingId); if (record) refreshMaterialPricingSummary(record); return true }
  if (target.closest('[data-independent-bom-line]')) { const samplingId = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || ''); const record = getEngineeringIndependentSamplingRecord(samplingId); syncBomLineDraftsFromDom(); if (record && target.matches(`[data-${PREFIX}-field="bomMaterialSkuId"]`)) { const row = target.closest<HTMLElement>('[data-independent-bom-line]'); const version = row?.closest<HTMLElement>('[data-independent-bom-version]'); const sku = getMaterialSkuRecordById(target.value); const draftLine = version ? ensureBomLineDrafts(version.dataset.independentBomVersion || '').find((line) => line.bomItemId === row?.dataset.independentBomLine) : null; if (sku && draftLine) draftLine.usageUnit = sku.pricingUnit; refreshMaterialPricingRegion(record) } else if (record) refreshMaterialPricingSummary(record); if (record) refreshWorkPreview(record); return true }
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
