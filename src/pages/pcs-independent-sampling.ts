// @page-pattern: list
import { getProjectById } from '../data/pcs-project-repository.ts'
import { localDateTimeText } from '../utils.ts'
import { renderEngineeringFileUpload, renderEngineeringUploadPreview } from '../components/ui/engineering-file-upload.ts'
import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../components/ui/button.ts'
import { renderProcessFilterToggle, handleProcessFilterPresentation } from '../components/ui/process-order-list-presentation.ts'
import { type StandardListColumn } from '../components/ui/list-table.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../components/ui/process-order-list-controller.ts'
import {
  getEngineeringBomPricingPlan,
  getEngineeringBomVersionById,
  listEngineeringBomHistory,
  resolveEngineeringBomPricingPlan,
  saveEngineeringBomPricingPlan,
  saveEngineeringBomVersion,
} from '../data/pcs-engineering-bom-repository.ts'
import { resolveEngineeringBomMaterialLine } from '../data/pcs-engineering-bom-material-resolver.ts'
import type { EngineeringBomCustomCostDecision, EngineeringBomCustomCostDraft, EngineeringBomMaterialLineDraft, EngineeringBomPricingPlanRecord } from '../data/pcs-engineering-bom-types.ts'
import {
  DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS,
  confirmEngineeringIndependentSamplingScheme,
  copyEngineeringIndependentSamplingDrafts,
  createEngineeringIndependentSampling,
  getEngineeringIndependentCurrentTeam,
  getEngineeringIndependentCurrentTeams,
  getEngineeringIndependentProfessionalTaskCurrentTeam,
  getEngineeringIndependentSamplingRecord as getSavedSamplingRecord,
  getEngineeringIndependentSamplingStep,
  listEngineeringIndependentAvailablePatternVersions,
  listEngineeringIndependentSamplingRecords,
  replaceEngineeringIndependentDesignFiles,
  saveEngineeringIndependentSamplingDraftRequirements,
  returnEngineeringIndependentBuyerPreparation,
  repairEngineeringIndependentProfessionalTaskProcessOrders,
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
import { localProductFixtureImageUrl } from '../data/pcs-product-archive-fixtures.ts'
import { buildDyeingWorkOrderDetailLink, buildPrintingWorkOrderDetailLink } from '../data/fcs/fcs-route-links.ts'
import '../data/fcs/design-revision-process-work-order-adapter.ts'
import { DYE_WORK_ORDER_STATUS_LABEL, getDyeOrderHandoverSummary, getDyeWorkOrderById } from '../data/fcs/dyeing-task-domain.ts'
import { PRINT_WORK_ORDER_STATUS_LABEL, getPrintOrderHandoverSummary, getPrintWorkOrderById } from '../data/fcs/printing-task-domain.ts'
import { getDesignRevisionMaterialTransferPlan } from '../data/fcs/design-revision-material-transfer.ts'
import { resolveDesignRevisionMaterialSku } from '../data/pcs-design-revision-material-sku.ts'
import { readDesignRevisionProcessWorkOrderStatuses } from '../data/pcs-design-revision-process-work-order-port.ts'
import { escapeHtml } from '../utils.ts'

const PREFIX = 'pcs-independent-sampling'
const BUYER = { role: '买手' as const, userId: 'U-BUYER-WANGMING', userName: '买手-王明' }
const ADMINISTRATOR = { role: '管理员' as const, userId: 'U-ADMIN', userName: '管理员（代操作）' }
const TASK_TYPE_TEXT = '设计改款'
const TASK_STATUS_TEXT: Record<EngineeringIndependentProfessionalTask['status'], string> = { WAIT_DEPENDENCY: '需要先完成其他工作', WAIT_START: '待开始', IN_PROGRESS: '进行中', WAIT_REVIEW: '待买手审核', REWORK: '需要重做', COMPLETED: '已完成' }
function professionalTaskStatusText(task: EngineeringIndependentProfessionalTask): string {
  return task.taskType === 'DISPLAY_SAMPLE' && task.status === 'WAIT_START' ? '可填报样衣' : TASK_STATUS_TEXT[task.status]
}
const TASK_OPTIONS: Array<{ value: EngineeringIndependentProfessionalTaskType; label: string }> = [
  { value: 'BASE_PATTERN', label: '基码纸样' },
  { value: 'DISPLAY_SAMPLE', label: '销售展示样衣任务' },
]

const ui = {
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
  preview: null as { url: string; fileName: string; notice?: string } | null,
  feedback: '', ok: true,
  extraFilters: {} as Record<string, string>,
  appliedExtraFilters: {} as Record<string, string>,
  teamFilter: '',
  listKeyword: '',
  listStatus: '',
  listPattern: '',
  listProcessing: '',
  listStartDate: '',
  listEndDate: '',
  appliedKeyword: '',
  appliedStatus: '',
  appliedTeamFilter: '',
  appliedPattern: '',
  appliedProcessing: '',
  appliedStartDate: '',
  appliedEndDate: '',
  selectedTaskIds: new Set<string>(),
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

const NEW_TASK_ID = 'new'
const NEW_BOM_ID = 'design-revision-new-bom'

// The unsubmitted form lives only in this page; opening it never creates a business task.
function getEngineeringIndependentSamplingRecord(id: string): EngineeringIndependentSamplingRecord | undefined {
  if (id !== NEW_TASK_ID) return getSavedSamplingRecord(id) || undefined
  const source = getStyleArchiveById(ui.createDraft.sourceStyleId)
  const target = getStyleArchiveById(ui.createDraft.targetStyleId)
  return {
    samplingTaskId: NEW_TASK_ID, samplingTaskCode: '新建设计改款', samplingType: 'DESIGN_REVISION',
    sourceStyleId: source?.styleId || '', sourceStyleCode: source?.styleCode || '',
    targetMode: 'ARCHIVED_STYLE',
    targetStyleId: target?.styleId || '', targetStyleCode: target?.styleCode || '', targetStyleName: target?.styleName || '',
    temporarySpuName: '',
    linkedFormalStyleId: '', linkedFormalStyleCode: '', linkedFormalStyleName: '', linkedAt: '', linkedBy: '',
    status: 'DRAFT', creationReason: ui.createDraft.creationReason, designFiles: ui.createDraft.designFiles.map((file) => ({ ...file })),
    creationDesignFileIds: ui.createDraft.designFiles.map((file) => file.fileId),
    patternHandling: ui.createDraft.patternHandling, reusedPatternFiles: ui.createDraft.reusedPatternFiles.map((file) => ({ ...file })),
    creationSampleRequirements: [],
    buyerId: BUYER.userId, buyerName: BUYER.userName,
    merchandiserId: '', merchandiserName: '',
    displaySampleTeamId: '', displaySampleTeamName: '',
    displaySampleReceivingLocationId: '', displaySampleReceivingLocationName: '',
    relatedProfessionalTaskIds: [], professionalTasks: [],
    bomDraftVersionId: NEW_BOM_ID,
    bomVersionIds: [NEW_BOM_ID],
    resultVersion: '', resultSummary: '', confirmedBy: '', confirmedAt: '',
    selectedTaskTypes: [], suggestedTaskTypes: [], taskPlanConfirmedBy: '', taskPlanConfirmedAt: '',
    colorMappings: [], materialConversionLines: [],
    bomConversionStatus: 'WAIT_COLOR_MAPPING',
    bomConversionConfirmedBy: '', bomConversionConfirmedAt: '', sourceResultVersionId: '', reuseDecision: 'PENDING',
    buyerPreparationConfirmedBy: '', buyerPreparationConfirmedAt: '',
    buyerPreparationReturnedBy: '', buyerPreparationReturnedAt: '', buyerPreparationReturnReason: '',
    operationLogs: [], createdBy: BUYER.userName, createdAt: '', updatedAt: '',
  }
}

function materialPlanVersions(record: EngineeringIndependentSamplingRecord) {
  return record.samplingTaskId === NEW_TASK_ID
    ? [{ bomDraftVersionId: NEW_BOM_ID, materialLines: ensureBomLineDrafts(NEW_BOM_ID) }]
    : record.bomVersionIds.map(getEngineeringBomVersionById).filter((version): version is NonNullable<typeof version> => Boolean(version))
}

function navigateDesignRevision(id = ''): void {
  window.history.pushState({}, '', `/pcs/production-preparation/design-revision${id ? `/${id}` : ''}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function listControllerState(): ProcessOrderListControllerState {
  return { currentPage: 1, sort: null, preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 }, preferencesLoaded: false, showColumnSettings: false }
}
const listState = listControllerState()
const displaySampleListState = listControllerState()

function nowText(): string { return localDateTimeText(new Date()) }
function samplingStatusText(record: EngineeringIndependentSamplingRecord): string {
  if (record.status === 'COMPLETED') return '已完成'
  if (record.status === 'IN_PROGRESS') return '进行中'
  return record.status === 'WAIT_CONFIRMATION' ? '历史待确认' : '草稿'
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

function localStyleFixtureImageUrl(url: string): string {
  return localProductFixtureImageUrl(url)
}

function imageButton(url: string, alt: string, body = ''): string {
  const imageUrl = localStyleFixtureImageUrl(url)
  return `<button type="button" class="flex items-center gap-2 text-left" data-${PREFIX}-action="open-image" data-image-url="${escapeHtml(imageUrl)}" data-image-alt="${escapeHtml(alt)}"><span class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border bg-slate-50"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(alt)}" class="h-full w-full object-cover" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-center text-[10px] text-red-600">图片加载失败</span></span><span>${body}</span></button>`
}

function renderDesignRevisionStyleRelation(row: EngineeringIndependentSamplingRecord): string {
  const source = getStyleArchiveById(row.sourceStyleId)
  const target = getStyleArchiveById(row.targetStyleId)
  const sourceHtml = source
    ? imageButton(source.mainImageUrl, source.styleName, `<span class="block"><strong>${escapeHtml(source.styleCode)}</strong><small class="block text-slate-500">${escapeHtml(source.styleName)}</small></span>`)
    : '<span class="text-red-600">未选择原款式</span>'
  const targetHtml = target
    ? imageButton(target.mainImageUrl, target.styleName, `<span class="block"><strong>${escapeHtml(target.styleCode)}</strong><small class="block text-slate-500">${escapeHtml(target.styleName)}</small></span>`)
    : row.targetMode === 'TEMPORARY_SPU' && !row.linkedFormalStyleId
      ? imageButton(row.designFiles.at(-1)?.dataUrl || '', row.temporarySpuName, `<span class="block"><strong>线下临时 SPU</strong><small class="block text-slate-500">${escapeHtml(row.temporarySpuName)}</small></span>`)
      : escapeHtml(row.targetStyleName)

  return `<div class="flex min-w-0 flex-col items-start gap-1" data-design-revision-style-relation><div class="min-w-0" data-design-revision-style-source>${sourceHtml}</div><div class="h-5 text-left leading-5 text-slate-500" data-design-revision-style-arrow aria-hidden="true">→</div><div class="min-w-0" data-design-revision-style-target>${targetHtml}</div><div class="mt-2 flex items-center gap-2"><span class="text-xs text-slate-500">设计稿</span>${renderDesignRevisionArtwork(row)}</div><div class="mt-1 space-y-0.5 text-xs text-slate-500"><p>原款式买手：${escapeHtml(styleBuyer(row.sourceStyleId))}</p><p>新款式买手：${escapeHtml(row.buyerName)}</p><p>添加人：${escapeHtml(row.createdBy)}</p><p>品牌：${escapeHtml(target?.brandName || '未记录')}</p><p>添加 ${escapeHtml(row.createdAt)}</p><p>完成 ${escapeHtml(row.confirmedAt || '—')}</p></div></div>`
}

function renderDesignRevisionArtwork(row: EngineeringIndependentSamplingRecord): string {
  const file = row.designFiles.at(-1)
  if (!file?.dataUrl) return '<span class="text-red-600">缺少设计稿</span>'
  const imageUrl = localStyleFixtureImageUrl(file.dataUrl)
  return `<button type="button" class="inline-flex rounded border bg-slate-50 p-1 hover:border-blue-400" title="点击查看设计稿大图" aria-label="查看设计稿 ${escapeHtml(file.fileName)} 大图" data-${PREFIX}-action="open-image" data-image-url="${escapeHtml(imageUrl)}" data-image-alt="${escapeHtml(file.fileName)}" data-design-revision-design-thumbnail><span class="flex h-16 w-16 items-center justify-center overflow-hidden rounded bg-white"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(file.fileName)}" class="h-full w-full object-cover" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="px-1 text-center text-[10px] text-red-600">图片加载失败</span></span></button>`
}

function styleOptions(selected = ''): string {
  return listStyleArchives().filter((style) => style.mainImageUrl).map((style) => `<option value="${escapeHtml(style.styleId)}" ${style.styleId === selected ? 'selected' : ''}>${escapeHtml(style.styleCode)} · ${escapeHtml(style.styleName)}</option>`).join('')
}

function reusablePatternCandidates(): Array<{ file: EngineeringUploadedFile; taskCode: string }> {
  const styleId = ui.createDraft.sourceStyleId || ui.createDraft.targetStyleId
  if (!styleId) return []
  return listEngineeringIndependentSamplingRecords()
    .filter((record) => record.targetStyleId === styleId && record.status === 'COMPLETED')
    .flatMap((record) => record.professionalTasks
      .filter((task) => task.taskType === 'BASE_PATTERN' && task.status === 'COMPLETED')
      .flatMap((task) => task.results
        .filter((result) => result.status === 'APPROVED')
        .flatMap((result) => result.files
          .filter((file) => file.purpose === 'PATTERN_SOURCE' && file.extension === 'prj' && file.status === '已保存' && Boolean(file.dataUrl))
          .map((file) => ({ file, taskCode: record.samplingTaskCode })))))
}

function renderReusablePatternPicker(): string {
  if (ui.createDraft.patternHandling !== 'REUSE') return ''
  const candidates = reusablePatternCandidates()
  const selected = ui.createDraft.reusedPatternFiles[0]?.fileId || ''
  return `<section class="space-y-3 bg-slate-50 p-4 md:col-span-2"><div><p class="font-medium">复用基码纸样 <span class="text-red-600">*</span></p><p class="text-xs text-slate-500">引用已完成任务的 .prj 纸样文件，也可上传现有文件。</p></div><label class="block space-y-1 text-sm"><span>已有纸样版本</span><select class="h-10 w-full rounded border bg-white px-3" data-${PREFIX}-field="reusedPatternFileId"><option value="">请选择已存纸样</option>${candidates.map(({ file, taskCode }) => `<option value="${escapeHtml(file.fileId)}" ${file.fileId === selected ? 'selected' : ''}>${escapeHtml(taskCode)} · ${escapeHtml(file.fileName)}</option>`).join('')}</select></label><label class="inline-flex h-9 cursor-pointer items-center rounded border border-blue-200 bg-white px-3 text-sm text-blue-700">上传现有纸样<input class="sr-only" type="file" accept="${escapeHtml(ENGINEERING_UPLOAD_RULES.PATTERN_SOURCE.accept)}" multiple data-skip-page-rerender="true" data-${PREFIX}-create-pattern-upload></label>${ui.createDraft.reusedPatternFiles.length ? `<p class="text-xs text-green-700">已选择 ${escapeHtml(ui.createDraft.reusedPatternFiles[0].fileName)}</p>` : '<p class="text-xs text-amber-700">请先引用或上传真实 .prj 纸样。</p>'}</section>`
}

function renderCreationBasicFields(): string {
  const designRule = ENGINEERING_UPLOAD_RULES.DESIGN_IMAGE
  const fileRows = (files: EngineeringUploadedFile[], removeAction: string, imagePreview: boolean) => files.map((file) => `<div class="flex items-center justify-between rounded border bg-white px-3 py-2 text-sm"><div>${imagePreview ? imageButton(file.dataUrl, file.fileName) : ''}<p class="font-medium">${escapeHtml(file.fileName)}</p><p class="text-xs text-slate-500">${formatEngineeringUploadSize(file.sizeBytes)} · ${escapeHtml(file.uploadedByName)} · ${escapeHtml(file.uploadedAt)}</p></div><div class="flex gap-3">${imagePreview ? `<button type="button" class="text-blue-700" data-${PREFIX}-upload-preview data-file-url="${escapeHtml(file.dataUrl)}" data-file-name="${escapeHtml(file.fileName)}">查看</button>` : ''}<button type="button" class="text-red-600" data-${PREFIX}-action="${removeAction}" data-file-id="${escapeHtml(file.fileId)}">删除</button></div></div>`).join('')
  return `<section class="rounded-lg bg-white p-5 border border-slate-200" data-design-revision-creation-fields><h2 class="mb-4 font-semibold">基本信息与设计稿</h2><div class="grid gap-4 md:grid-cols-2"><label class="block space-y-1 text-sm"><span>原款式（SPU）</span><select class="h-10 w-full rounded border px-3" data-${PREFIX}-field="sourceStyleId"><option value="">请选择</option>${styleOptions(ui.createDraft.sourceStyleId)}</select>${ui.createDraft.sourceStyleId ? styleCard(ui.createDraft.sourceStyleId, '原款式（SPU）').replace('rounded-lg border bg-white p-4', 'pt-2') : ''}</label><label class="block space-y-1 text-sm"><span>新款式（SPU） <span class="text-red-600">*</span></span><select class="h-10 w-full rounded border px-3" data-${PREFIX}-field="targetStyleId"><option value="">请选择</option>${styleOptions(ui.createDraft.targetStyleId)}</select>${ui.createDraft.targetStyleId ? styleCard(ui.createDraft.targetStyleId, '新款式（SPU）').replace('rounded-lg border bg-white p-4', 'pt-2') : ''}</label><label class="block space-y-1 text-sm"><span>买手</span><input class="h-10 w-full rounded border bg-slate-50 px-3" value="${escapeHtml(BUYER.userName)}" readonly></label><label class="block space-y-1 text-sm"><span>基码纸样</span><select class="h-10 w-full rounded border px-3" data-${PREFIX}-field="patternHandling"><option value="REMAKE" ${ui.createDraft.patternHandling === 'REMAKE' ? 'selected' : ''}>需要重新制作</option><option value="REUSE" ${ui.createDraft.patternHandling === 'REUSE' ? 'selected' : ''}>纸样不变，直接复用</option></select></label><label class="block space-y-1 text-sm md:col-span-2"><span>本次设计改款要求</span><textarea class="min-h-20 w-full rounded border p-3" data-${PREFIX}-field="creationReason" placeholder="填写本次需要改什么">${escapeHtml(ui.createDraft.creationReason)}</textarea></label><section class="space-y-3 bg-slate-50 p-4 md:col-span-2"><div><p class="font-medium">设计稿 <span class="text-red-600">*</span></p><p class="text-xs text-slate-500">${designRule.extensions.map((item) => `.${item}`).join('、')} · 单个不超过 ${Math.round(designRule.maxSizeBytes / 1024 / 1024)} MB</p></div><label class="inline-flex h-9 cursor-pointer items-center rounded border border-blue-200 bg-white px-3 text-sm text-blue-700">选择本地设计稿<input class="sr-only" type="file" accept="${escapeHtml(designRule.accept)}" multiple data-skip-page-rerender="true" data-${PREFIX}-create-design-upload></label><div class="space-y-2">${fileRows(ui.createDraft.designFiles, 'remove-create-design', true) || '<p class="text-xs text-amber-700">请选择本次设计稿，保存草稿或提交时一并保存。</p>'}</div></section>${renderReusablePatternPicker()}</div></section>`
}

function renderDialogHost(): string {
  return `<div data-independent-sampling-dialogs>${renderEngineeringUploadPreview(ui.preview, PREFIX)}</div>`
}
function refreshDialogs(): void {
  document.querySelectorAll<HTMLElement>('[data-independent-sampling-dialogs]').forEach(host => { host.innerHTML = renderEngineeringUploadPreview(ui.preview, PREFIX) })
  const fields = document.querySelector<HTMLElement>('[data-design-revision-creation-fields]')
  if (fields) fields.outerHTML = renderCreationBasicFields()
  const feedback = document.querySelector<HTMLElement>('[data-design-revision-create-feedback]')
  if (feedback) feedback.innerHTML = feedbackHtml()
}

function listRows(): EngineeringIndependentSamplingRecord[] {
  return listEngineeringIndependentSamplingRecords().filter((record) => {
    if (ui.appliedTeamFilter && !getEngineeringIndependentCurrentTeams(record).includes(ui.appliedTeamFilter)) return false
    if (ui.appliedStatus && record.status !== ui.appliedStatus) return false
    if (ui.appliedPattern && (record.patternHandling === 'REMAKE' ? 'REMAKE' : 'REUSE') !== ui.appliedPattern) return false
    const facts = recordFilterFacts(record)
    for (const [key, value] of Object.entries(ui.appliedExtraFilters)) {
      if (!value || key === 'timeType') continue
      if (['brand', 'category', 'patternUploaded', 'hasDyeOrder', 'hasPrintOrder'].includes(key)) { if (facts[key] !== value) return false }
      else if (!(facts[key] || '').toLocaleLowerCase().includes(value.toLocaleLowerCase())) return false
    }
    const date = facts[ui.appliedExtraFilters.timeType || 'created']?.slice(0, 10) || ''
    if ((ui.appliedStartDate || ui.appliedEndDate) && !date) return false
    if (ui.appliedStartDate && date < ui.appliedStartDate) return false
    if (ui.appliedEndDate && date > ui.appliedEndDate) return false
    if (ui.appliedProcessing) {
      const refs = processRefs(record)
      let dye = refs.some((ref) => ref.processType === 'DYEING')
      let print = refs.some((ref) => ref.processType === 'PRINTING')
      if (record.status === 'DRAFT') {
        for (const versionId of record.bomVersionIds) {
          for (const line of getEngineeringBomVersionById(versionId)?.materialLines || []) {
            try {
              const sku = resolveDesignRevisionMaterialSku(line.materialSkuId)
              dye ||= sku.requiresDye
              print ||= sku.requiresPrint
            } catch {
              dye ||= line.dyeRequirement === '是'
              print ||= line.printRequirement === '是'
            }
          }
        }
      }
      const combination = dye ? (print ? 'BOTH' : 'DYE_ONLY') : (print ? 'PRINT_ONLY' : 'NONE')
      if (combination !== ui.appliedProcessing) return false
    }
    if (!ui.appliedKeyword) return true
    const refs = processRefs(record)
    return [record.samplingTaskId, record.samplingTaskCode, record.targetStyleCode, record.sourceStyleCode, record.createdBy, record.buyerName, ...refs.map((ref) => ref.processOrderCode)].some((text) => text.toLocaleLowerCase().includes(ui.appliedKeyword.toLocaleLowerCase()))
  })
}
function teamOptions(): string[] {
  return [...new Set(listEngineeringIndependentSamplingRecords().flatMap(getEngineeringIndependentCurrentTeams))].sort()
}

function renderDesignRevisionProcessOrders(row: EngineeringIndependentSamplingRecord, processType: 'DYEING' | 'PRINTING'): string {
  const refs = processRefs(row).filter((ref) => ref.processType === processType)
  if (!refs.length) {
    const required = materialPlanVersions(row).some(version => version.materialLines.some(line => {
      if (processType === 'DYEING' ? line.dyeRequirement === '是' : line.printRequirement === '是') return true
      try { const sku = resolveDesignRevisionMaterialSku(line.materialSkuId); return processType === 'DYEING' ? sku.requiresDye : sku.requiresPrint } catch { return false }
    }))
    return `<span class="${required ? 'text-amber-700' : 'text-slate-400'}">${required ? row.status === 'DRAFT' ? '提交后生成' : '未关联加工单' : '无需加工'}</span>`
  }
  const statusViews = readDesignRevisionProcessWorkOrderStatuses(refs)
  return `<div class="space-y-2">${refs.map((ref) => {
    const order = processType === 'DYEING' ? getDyeWorkOrderById(ref.processOrderId) : getPrintWorkOrderById(ref.processOrderId)
    if (!order) return `<p class="text-red-700">${escapeHtml(ref.processOrderCode)} 单据缺失</p>`
    const handover = processType === 'DYEING' ? getDyeOrderHandoverSummary(ref.processOrderId) : getPrintOrderHandoverSummary(ref.processOrderId)
    const completedQty = processType === 'DYEING'
      ? getDyeWorkOrderById(ref.processOrderId)?.outputRolls?.reduce((sum, roll) => sum + roll.qty, 0) || 0
      : getPrintWorkOrderById(ref.processOrderId)?.businessView?.output.completedQty || 0
    const completedAt = processType === 'DYEING'
      ? getDyeWorkOrderById(ref.processOrderId)?.documentCompletedAt
        || getDyeWorkOrderById(ref.processOrderId)?.outputRolls?.map((roll) => roll.createdAt).filter(Boolean).sort().at(-1) || ''
      : getPrintWorkOrderById(ref.processOrderId)?.businessView?.completedAt || getPrintWorkOrderById(ref.processOrderId)?.manuallyCompletedAt || ''
    const link = processType === 'DYEING' ? buildDyeingWorkOrderDetailLink(ref.processOrderId) : buildPrintingWorkOrderDetailLink(ref.processOrderId)
    const plan = getDesignRevisionMaterialTransferPlan(processType, ref.processOrderId)
    const factoryName = processType === 'DYEING' ? getDyeWorkOrderById(ref.processOrderId)?.dyeFactoryName : getPrintWorkOrderById(ref.processOrderId)?.printFactoryName
    const statusLabel = statusViews.find((view) => view.processOrderId === ref.processOrderId)?.statusLabel || (processType === 'DYEING'
      ? DYE_WORK_ORDER_STATUS_LABEL[order.status as keyof typeof DYE_WORK_ORDER_STATUS_LABEL]
      : PRINT_WORK_ORDER_STATUS_LABEL[order.status as keyof typeof PRINT_WORK_ORDER_STATUS_LABEL])
    return `<div class="space-y-0.5 text-xs" data-design-revision-process-order><p class="text-blue-700"><a href="${escapeHtml(link)}">${escapeHtml(ref.processOrderCode)}</a> · ${escapeHtml(statusLabel || '待处理')}</p><p class="mt-1 text-xs">下单 ${escapeHtml(order.createdAt)}</p><p class="text-xs">计划 ${order.plannedQty} ${escapeHtml(order.qtyUnit)} · 完成 ${completedQty} ${escapeHtml(order.qtyUnit)}</p><p class="text-xs">实交 ${handover.submittedQty} ${escapeHtml(order.qtyUnit)} · 已确认 ${handover.writtenBackQty} ${escapeHtml(order.qtyUnit)}</p><p class="text-xs">完成时间 ${escapeHtml(completedAt || '未完成')} · ${escapeHtml(factoryName || '待分厂')}</p>${plan ? `<p class="text-xs text-slate-500">调拨 ${escapeHtml(plan.originName)} → ${escapeHtml(plan.targetName)} · ${plan.sentQty}/${plan.plannedQty} ${escapeHtml(plan.qtyUnit)}</p>` : ''}</div>`
  }).join('')}</div>`
}

function taskTiming(task: EngineeringIndependentProfessionalTask): string {
  return `<div class="mt-1 space-y-0.5 text-xs text-slate-500"><p>负责 ${escapeHtml(task.ownerTeamName)}</p><p>当前处理 ${escapeHtml(getEngineeringIndependentProfessionalTaskCurrentTeam(task) || '—')}</p><p>计划完成 ${escapeHtml(task.plannedCompleteAt || '—')}</p><p>开始 ${escapeHtml(task.startedAt || '—')}</p><p>提交 ${escapeHtml(task.submittedAt || '—')}</p><p>完成 ${escapeHtml(task.completedAt || '—')}</p></div>`
}
function processRefs(record: EngineeringIndependentSamplingRecord) {
  return [...new Map([...record.professionalTasks.flatMap(task => task.processWorkOrderRefs), ...(record.historicalProcessWorkOrderRefs || [])].map(ref => [`${ref.processType}:${ref.processOrderId}`, ref])).values()]
}
function patternFiles(record: EngineeringIndependentSamplingRecord) {
  return [...record.reusedPatternFiles, ...record.professionalTasks.filter(task => task.taskType === 'BASE_PATTERN').flatMap(task => task.results.flatMap(result => result.files))].filter(file => file.purpose === 'PATTERN_SOURCE')
}
function styleBuyer(styleId: string): string {
  const style = getStyleArchiveById(styleId)
  return style?.sourceProjectId ? getProjectById(style.sourceProjectId)?.ownerName || '未记录' : '未记录'
}
function recordFilterFacts(record: EngineeringIndependentSamplingRecord): Record<string, string> {
  const style = getStyleArchiveById(record.targetStyleId)
  const files = patternFiles(record)
  const refs = processRefs(record)
  return { originalSpu: record.sourceStyleCode, newSpu: record.targetStyleCode, creator: record.createdBy,
    originalBuyer: styleBuyer(record.sourceStyleId), newBuyer: record.buyerName,
    patternMaker: [...new Set(files.map(file => file.uploadedByName))].join('、'),
    patternUploaded: files.length ? 'YES' : 'NO', brand: style?.brandName || '', category: style?.categoryCodeName || style?.categoryName || '',
    hasDyeOrder: refs.some(ref => ref.processType === 'DYEING') ? 'YES' : 'NO', hasPrintOrder: refs.some(ref => ref.processType === 'PRINTING') ? 'YES' : 'NO',
    created: record.createdAt, completed: record.confirmedAt, patternUploadedAt: files.map(file => file.uploadedAt).sort().at(-1) || '' }
}
function renderMaterialCosts(row: EngineeringIndependentSamplingRecord): string {
  const lines = materialPlanVersions(row).flatMap(version => version.materialLines)
  let total = 0
  let invalid = false
  const materials = lines.map(line => {
    try {
      const item = resolveEngineeringBomMaterialLine(line)
      if (item.materialCostCny === null) invalid = true
      total += item.materialCostCny || 0
      const sku = getMaterialSkuRecordById(line.materialSkuId)
      const archive = sku && getMaterialArchiveById(sku.materialId)
      return `<div class="flex items-center justify-between gap-3 py-2" data-design-revision-material-row><div class="min-w-0 flex-1">${imageButton(sku?.skuImageUrl || archive?.mainImageUrl || line.materialImageUrl || '', item.materialName, `<strong class="block text-xs">${escapeHtml(item.materialName)}</strong><span class="block break-all text-xs text-slate-500">${escapeHtml(item.materialSkuCode)}</span>`)}</div><div class="shrink-0 text-right text-xs">用量 ${Number(item.totalRequirementQuantity.toFixed(4))}<span class="block text-slate-500">${escapeHtml(item.pricingUnit)}</span></div><div class="shrink-0 text-right text-xs"><p class="text-slate-500">单价 ¥${item.standardUnitPriceCny?.toFixed(2) || '未维护'}</p><p>小计 ¥${item.materialCostCny?.toFixed(2) || '未核定'}</p></div></div>`
    } catch { invalid = true; return `<p class="text-xs text-amber-700">${escapeHtml(line.materialSkuId)}：物料资料需补齐</p>` }
  }).join('')
  const costs = getEngineeringBomPricingPlan('INDEPENDENT_SAMPLING', row.samplingTaskId)?.customCosts || []
  const fees = costs.reduce((sum, cost) => sum + cost.amountIdr, 0)
  return `<div class="divide-y divide-slate-100 text-xs" data-design-revision-material-costs><section class="pb-2" data-cost-section="materials"><h4 class="font-medium text-slate-500">物料</h4>${materials || '<p class="py-2 text-slate-400">尚未添加物料</p>'}</section><section class="py-3" data-cost-section="fees"><h4 class="mb-2 font-medium text-slate-500">费用</h4>${costs.map(cost => `<div class="flex items-start justify-between gap-3 py-1" data-design-revision-fee-row><div>${escapeHtml(cost.title)}${cost.note ? `<span class="block text-slate-400">${escapeHtml(cost.note)}</span>` : ''}</div><span class="shrink-0">Rp ${cost.amountIdr.toLocaleString('id-ID')}</span></div>`).join('') || '<p class="text-slate-400">无其他费用</p>'}</section><section class="pt-3 space-y-1" data-cost-section="total"><h4 class="mb-2 font-medium text-slate-500">合计</h4><p class="flex justify-between gap-3"><span>物料合计</span><span>¥${total.toFixed(2)}</span></p><p class="flex justify-between gap-3"><span>费用合计</span><span>Rp ${fees.toLocaleString('id-ID')}</span></p><p class="flex justify-between gap-3 font-medium"><span>综合成本</span><span>¥${(total + fees / getLatestPcsExchangeRate().idrPerCny).toFixed(2)}${invalid ? '（部分待核定）' : ''}</span></p></section></div>`
}

function renderDesignRevisionBasePattern(row: EngineeringIndependentSamplingRecord): string {
  const task = row.professionalTasks.find((item) => item.taskType === 'BASE_PATTERN')
  if (!task) return row.patternHandling === 'REUSE' ? `复用已有纸样<p class="text-xs">上传 ${escapeHtml(patternFiles(row).map(file => file.uploadedAt).sort().at(-1) || '—')}</p>` : row.status === 'DRAFT' ? '提交后生成' : '历史未记录纸样任务'
  return `<a class="text-blue-700" href="${getIndependentProfessionalTaskDetailPath(task)}">${escapeHtml(task.taskId)}</a><p class="text-xs">${escapeHtml(professionalTaskStatusText(task))} · ${escapeHtml(task.ownerTeamName)}</p>${taskTiming(task)}<p class="text-xs">纸样上传：${patternFiles(row).length ? '是' : '否'}</p><p class="text-xs">上传人 ${escapeHtml(recordFilterFacts(row).patternMaker || '—')}</p><p class="text-xs">上传 ${escapeHtml(recordFilterFacts(row).patternUploadedAt || '—')}</p>`
}

function renderDesignRevisionSampleTask(row: EngineeringIndependentSamplingRecord): string {
  const task = row.professionalTasks.find((item) => item.taskType === 'DISPLAY_SAMPLE')
  if (!task) return `<span class="text-slate-400">${row.status === 'DRAFT' ? '提交后生成' : '历史未记录样衣任务'}</span>`
  const planned = (task.sampleRequirements || []).reduce((sum, line) => sum + line.requiredQuantity, 0)
  const delivered = task.results.reduce((sum, result) => sum + result.sampleQuantity, 0)
  return `<a class="text-blue-700" href="${getIndependentProfessionalTaskDetailPath(task)}">${escapeHtml(task.taskId)}</a><p class="text-xs">${planned} 件要求 · ${delivered} 件已交</p><p class="text-xs">${escapeHtml(professionalTaskStatusText(task))} · 提交 ${escapeHtml(task.submittedAt || '—')}</p>${taskTiming(task)}`
}

function renderDesignRevisionFilters(): string {
  const inputClass = 'h-9 w-full rounded-md border px-3 text-sm'
  const field = (label: string, control: string, className = 'min-w-0') => `<label class="${className}"><span class="mb-1 block text-xs text-muted-foreground">${label}</span>${control}</label>`
  const input = (key: string, value: string, type = 'text', placeholder = '') => `<input type="${type}" class="${inputClass}" data-${PREFIX}-field="${key}" value="${escapeHtml(value)}" placeholder="${placeholder}">`
  const select = (key: string, value: string, options: string[][]) => `<select class="${inputClass} border-input bg-background" data-${PREFIX}-field="${key}">${options.map(([id, label]) => `<option value="${escapeHtml(id)}" ${id === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select>`
  const advancedCount = [...Object.values(ui.extraFilters), ui.listPattern, ui.listProcessing, ui.listStartDate, ui.listEndDate].filter(Boolean).length
  return `<div class="rounded-lg border bg-white p-3">
    <div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      ${field('综合查询', input('listKeyword', ui.listKeyword, 'text', '任务号、SPU、买手或加工单号'), 'min-w-0 sm:col-span-2')}
      ${field('任务状态', select('listStatus', ui.listStatus, [['', '全部'], ['DRAFT', '草稿'], ['IN_PROGRESS', '进行中'], ['COMPLETED', '已完成']]))}
      ${field('当前团队', select('teamFilter', ui.teamFilter, [['', '全部团队'], ...teamOptions().map(team => [team, team])]))}
      <div class="[&:not([hidden])]:contents" data-process-advanced ${advancedCount ? '' : 'hidden'}>
        ${field('基码纸样', select('listPattern', ui.listPattern, [['', '全部'], ['REMAKE', '需要制作'], ['REUSE', '复用纸样']]))}
        ${field('染印组合', select('listProcessing', ui.listProcessing, [['', '全部'], ['NONE', '无需印染'], ['DYE_ONLY', '仅染色'], ['PRINT_ONLY', '仅印花'], ['BOTH', '先染后印']]))}
        ${[['originalSpu', '原款式（SPU）'], ['newSpu', '新款式（SPU）'], ['originalBuyer', '原款式买手'], ['newBuyer', '新款式买手'], ['creator', '添加人'], ['patternMaker', '纸样上传人／版师']].map(([key, label]) => field(label, input(`extra:${key}`, ui.extraFilters[key] || ''))).join('')}
        ${[['brand', '品牌'], ['category', '款式品类']].map(([key, label]) => field(label, select(`extra:${key}`, ui.extraFilters[key] || '', [['', '全部'], ...[...new Set(listEngineeringIndependentSamplingRecords().map(record => recordFilterFacts(record)[key]).filter(Boolean))].sort().map(text => [text, text])]))).join('')}
        ${[['patternUploaded', '是否上传纸样'], ['hasDyeOrder', '是否创建染色单'], ['hasPrintOrder', '是否创建印花单']].map(([key, label]) => field(label, select(`extra:${key}`, ui.extraFilters[key] || '', [['', '全部'], ['YES', '是'], ['NO', '否']]))).join('')}
        ${field('时间类型', select('extra:timeType', ui.extraFilters.timeType || '', [['', '添加时间'], ['completed', '完成时间'], ['patternUploadedAt', '上传纸样时间']]))}
        ${field('开始日期', input('listStartDate', ui.listStartDate, 'date'))}
        ${field('结束日期', input('listEndDate', ui.listEndDate, 'date'))}
      </div>
    </div>
    <div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
      ${renderPrimaryButton('查询', { prefix: PREFIX, action: 'query' }, 'search')}
      ${renderSecondaryButton('重置', { prefix: PREFIX, action: 'reset' }, 'rotate-ccw')}
      ${renderSecondaryButton('导出', { prefix: PREFIX, action: 'export' }, 'download')}
      ${renderProcessFilterToggle(advancedCount, 'button')}
    </div>
  </div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function listColumns(): StandardListColumn<EngineeringIndependentSamplingRecord>[] {
  return [
    { key: 'select', title: '勾选', width: 56, leadingControlColumn: true, required: true, freezeable: true, render: (row) => `<input type="checkbox" aria-label="选择 ${escapeHtml(row.samplingTaskCode)}" data-${PREFIX}-select-task="${escapeHtml(row.samplingTaskId)}" ${ui.selectedTaskIds.has(row.samplingTaskId) ? 'checked' : ''}>` },
    { key: 'code', title: '任务号', width: 110, required: true, freezeable: true, sortable: true, sortValue: (row) => row.samplingTaskCode, render: (row) => `<a class="font-medium text-blue-700 hover:underline" href="/pcs/production-preparation/design-revision/${escapeHtml(row.samplingTaskId)}">${escapeHtml(row.samplingTaskCode)}</a>` },
    { key: 'status', title: '状态', width: 85, required: true, render: row => `<span class="inline-flex whitespace-nowrap rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">${escapeHtml(samplingStatusText(row))}</span>` },
    { key: 'style', title: '原款式-->新款式', width: 260, required: true, render: renderDesignRevisionStyleRelation },
    { key: 'bom', title: '物料与费用', width: 340, render: renderMaterialCosts },
    { key: 'basePattern', title: '基码纸样', width: 175, required: true, render: renderDesignRevisionBasePattern },
    { key: 'dyeOrders', title: '染色加工单', width: 235, required: true, render: (row) => renderDesignRevisionProcessOrders(row, 'DYEING') },
    { key: 'printOrders', title: '印花加工单', width: 235, required: true, render: (row) => renderDesignRevisionProcessOrders(row, 'PRINTING') },
    { key: 'sampleTask', title: '销售展示样衣', width: 200, required: true, render: renderDesignRevisionSampleTask },
    { key: 'action', title: '操作', width: 100, actionColumn: true, render: (row) => `<a class="inline-flex h-8 items-center rounded border px-3 text-xs" href="/pcs/production-preparation/design-revision/${escapeHtml(row.samplingTaskId)}">查看详情</a>` },
  ]
}

const listController = createProcessOrderListController({
    state: listState, columns: listColumns(), preferenceKey: 'higood-pcs-design-revision-list-preferences-v3',
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
  if (task.taskType === 'DISPLAY_SAMPLE' && task.status === 'WAIT_START') return '填报并提交销售展示样衣'
  if (task.status === 'WAIT_REVIEW') return '由买手审核本次成果'
  if (task.status === 'REWORK') return '只重做未通过的成果'
  if (task.status === 'COMPLETED') return '已完成'
  if ((task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') && !task.colorRequirementConfirmedAt) return '由买手填写潘通色号和颜色名称'
  return task.status === 'IN_PROGRESS' ? '制作并提交真实成果' : '开始本项工作'
}

const displaySampleColumns: StandardListColumn<DisplaySampleListRow>[] = [
  { key: 'task', title: '任务号', width: 230, required: true, freezeable: true, sortable: true, sortValue: ({ task }) => task.taskId, render: ({ task }) => `<a class="font-medium text-blue-700" href="${getIndependentProfessionalTaskDetailPath(task)}">${escapeHtml(task.taskId)}</a>` },
  { key: 'source', title: '由哪张单发起', width: 160, sortable: true, sortValue: ({ record }) => record.samplingTaskCode, render: ({ record }) => `<p class="font-medium">${escapeHtml(record.samplingTaskCode)}</p><p class="text-xs text-slate-500">${TASK_TYPE_TEXT}</p>` },
  { key: 'style', title: '新款式（SPU）', width: 300, required: true, render: ({ record }) => { const style = getStyleArchiveById(record.targetStyleId); return style ? imageButton(style.mainImageUrl, style.styleName, `<span class="block"><strong>${escapeHtml(style.styleCode)}</strong><small class="block text-slate-500">${escapeHtml(style.styleName)}</small></span>`) : imageButton(record.designFiles.at(-1)?.dataUrl || '', record.temporarySpuName || record.targetStyleName, `<span class="block"><strong>线下临时 SPU</strong><small class="block text-slate-500">${escapeHtml(record.temporarySpuName || record.targetStyleName)}</small></span>`) } },
  { key: 'team', title: '当前需处理的团队', width: 160, render: ({ task }) => escapeHtml(getEngineeringIndependentProfessionalTaskCurrentTeam(task) || '-') },
  { key: 'actionText', title: '当前动作', width: 220, render: ({ task }) => escapeHtml(independentTaskCurrentAction(task)) },
  { key: 'status', title: '状态', width: 120, sortable: true, sortValue: ({ task }) => professionalTaskStatusText(task), render: ({ task }) => `<span class="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">${escapeHtml(professionalTaskStatusText(task))}</span>` },
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
  const rows = listRows()
  return `<div data-independent-sampling-list="DESIGN_REVISION">${renderStandardListPage({
    title: '设计改款任务',
    primaryActionsHtml: `<button class="h-9 rounded bg-blue-600 px-4 text-sm text-white" data-${PREFIX}-action="open-create">新建设计改款</button>`,
    feedbackHtml: feedbackHtml(),
    filtersHtml: renderDesignRevisionFilters(),
    statsHtml: renderStandardListStats([{ label: '查询结果', value: rows.length }, { label: '草稿', value: rows.filter((row) => row.status === 'DRAFT').length }, { label: '进行中', value: rows.filter((row) => row.status === 'IN_PROGRESS').length }, { label: '已完成', value: rows.filter((row) => row.status === 'COMPLETED').length }], { compact: true }),
    listTitle: `共 ${rows.length} 条`, listActionsHtml: `<div class="flex flex-wrap items-center gap-2"><span class="text-sm text-slate-600" data-design-revision-selected-count>已选 ${ui.selectedTaskIds.size} 条</span><button class="h-9 rounded border px-3 text-sm" data-${PREFIX}-action="select-page">本页全选</button><button class="h-9 rounded border px-3 text-sm" data-${PREFIX}-action="clear-selection">清空选择</button><button class="h-9 rounded border border-blue-300 px-3 text-sm text-blue-700" data-${PREFIX}-action="copy-selected">批量复制为草稿</button><button class="h-9 rounded border px-4 text-sm" data-${PREFIX}-action="open-column-settings">列设置</button></div>`, tableHtml: `<div data-independent-sampling-table>${view.tableHtml}</div>`, paginationHtml: `<div data-independent-sampling-pagination>${view.paginationHtml}</div>`, overlaysHtml: `<div data-independent-sampling-overlays>${listController.renderColumnSettings()}</div>${renderDialogHost()}`,
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
      const selectedSkuId = value('bomMaterialSkuId', row)
      let skuSnapshot: ReturnType<typeof resolveDesignRevisionMaterialSku> | null = null
      try { skuSnapshot = resolveDesignRevisionMaterialSku(selectedSkuId) } catch { /* 提交时给出明确缺失资料 */ }
      return {
        ...previous,
        bomItemId: row.dataset.independentBomLine || previous.bomItemId,
        materialSkuId: selectedSkuId,
        usage: Number(value('bomUsage', row)) || 0,
        quantityBasis: value('bomQuantityBasis', row) === 'ORDER_TOTAL' ? 'ORDER_TOTAL' : 'PER_SAMPLE',
        sampleQuantity: Number(previous.sampleQuantity) || 1,
        usageUnit: value('bomUsageUnit', row).trim() || skuSnapshot?.pricingUnit || previous.usageUnit || 'PCS',
        lossRate: 0,
        dyeRequirement: skuSnapshot?.requiresDye ? '是' : '否',
        printRequirement: skuSnapshot?.requiresPrint ? '是' : '否',
        designRevisionSkuSnapshot: undefined,
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
        lossRate: 0,
        designRevisionSkuSnapshot: undefined,
        sampleQuantity: sampleQuantityForPlan(record),
      })),
      updatedAt: nowText(),
    })
  })
}

function renderBomSummary(record: EngineeringIndependentSamplingRecord, readonly: boolean): string {
  const versions = materialPlanVersions(record)
  if (!versions.length) {
    return '<div class="border-b border-red-200 bg-red-50 p-4 text-sm text-red-700">物料与费用方案不存在，请刷新页面后重试。</div>'
  }
  const sampleQuantity = sampleQuantityForPlan(record)
  const enteredSampleQuantity = ensureSampleRequirementDrafts(record).reduce((sum, item) => sum + Math.max(0, Number(item.requiredQuantity) || 0), 0)
  const body = versions.map((version) => {
    const lines = readonly ? version.materialLines : ensureBomLineDrafts(version.bomDraftVersionId)
    return `<tbody data-independent-bom-version="${escapeHtml(version.bomDraftVersionId)}">${lines.map((line, index) => {
      let resolved: ReturnType<typeof resolveEngineeringBomMaterialLine> | null = null
      try { resolved = resolveEngineeringBomMaterialLine({ ...line, sampleQuantity }) } catch { resolved = null }
      const materialSku = getMaterialSkuRecordById(line.materialSkuId)
      const materialArchive = materialSku ? getMaterialArchiveById(materialSku.materialId) : null
      let skuSnapshot: ReturnType<typeof resolveDesignRevisionMaterialSku> | null = null
      let skuError = ''
      try { skuSnapshot = line.designRevisionSkuSnapshot || resolveDesignRevisionMaterialSku(line.materialSkuId) } catch (error) { skuError = error instanceof Error ? error.message : '目标 SKU 资料不完整' }
      const skuInfo = skuSnapshot
        ? `<div class="text-xs text-slate-600">${skuSnapshot.requiresDye ? `染色 ${escapeHtml(skuSnapshot.colorName)} · 潘通 ${escapeHtml(skuSnapshot.pantoneCode)}` : '无需染色'}；${skuSnapshot.requiresPrint ? `印花 ${escapeHtml(skuSnapshot.patternCode)}${skuSnapshot.patternImageUrl ? imageButton(skuSnapshot.patternImageUrl, `${skuSnapshot.patternCode} 花型图`, '查看花型图') : ''}` : '无需印花'}${skuSnapshot.requiresDye && skuSnapshot.requiresPrint ? '；先染后印' : ''}</div>`
        : `<span class="text-xs text-red-700">${escapeHtml(skuError)}</span>`
      const lineId = line.bomItemId || `${version.bomDraftVersionId}-DRAFT-${index + 1}`
      const materialName = resolved?.materialName || materialSku?.materialName || line.materialSkuId
      const materialImageUrl = resolved?.materialImageUrl || line.materialImageUrl || materialSku?.skuImageUrl || materialArchive?.mainImageUrl || ''
      const materialImage = materialImageUrl
        ? imageButton(materialImageUrl, materialName)
        : '<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded border bg-slate-50 px-1 text-center text-[10px] text-red-600">图片缺失</span>'
      const unitPriceValue = resolved?.standardUnitPriceCny || materialSku?.costPrice || 0
      const pricingUnit = resolved?.pricingUnit || materialSku?.pricingUnit || line.usageUnit
      const unitPrice = `¥ ${unitPriceValue.toFixed(4)} / ${escapeHtml(pricingUnit)}`
      const plannedQuantity = resolved && enteredSampleQuantity > 0
        ? `<div class="mt-1 whitespace-nowrap text-xs font-medium text-slate-700">计划用量 ${resolved.totalRequirementQuantity.toFixed(4)} ${escapeHtml(pricingUnit)}</div><div class="whitespace-nowrap text-xs text-slate-500">${line.quantityBasis === 'ORDER_TOTAL' ? `整单 ${line.usage} ${escapeHtml(line.usageUnit)}` : `${line.usage} ${escapeHtml(line.usageUnit)}/件 × ${enteredSampleQuantity} 件`}${resolved.conversionToPricingUnit === 1 ? '' : ` × 换算 ${resolved.conversionToPricingUnit.toFixed(6)}`}</div>`
        : `<div class="mt-1 text-xs text-amber-700">${resolved ? '填写样衣件数后计算计划用量' : '用量或单位换算待核对'}</div>`
      const materialSubtotal = `${resolved?.materialCostCny ? `¥ ${resolved.materialCostCny.toFixed(2)}` : '¥ 0.00'}${plannedQuantity}`
      return `<tr class="border-b" data-independent-bom-line="${escapeHtml(lineId)}"><td class="p-2"><div class="flex min-w-72 items-center gap-2">${materialImage}${skuInfo}${readonly ? `<span>${escapeHtml(resolved?.materialName || line.materialSkuId)}</span>` : `<select class="h-9 min-w-56 rounded border px-2" data-${PREFIX}-field="bomMaterialSkuId">${materialSkuOptions(line.materialSkuId)}</select>`}</div></td><td class="p-2">${readonly ? `${line.usage} ${escapeHtml(line.usageUnit)} · ${line.quantityBasis === 'ORDER_TOTAL' ? '整单总量' : '单件用量'}` : `<div class="flex"><input type="number" min="0.0001" step="0.0001" class="h-9 w-24 rounded-l border px-2" data-${PREFIX}-field="bomUsage" value="${line.usage}"><input class="h-9 w-20 rounded-r border border-l-0 px-2" data-${PREFIX}-field="bomUsageUnit" value="${escapeHtml(line.usageUnit)}"></div><select class="mt-1 h-8 w-full rounded border px-1 text-xs" aria-label="BOM 数量口径" data-${PREFIX}-field="bomQuantityBasis"><option value="PER_SAMPLE" ${line.quantityBasis !== 'ORDER_TOTAL' ? 'selected' : ''}>单件用量</option><option value="ORDER_TOTAL" ${line.quantityBasis === 'ORDER_TOTAL' ? 'selected' : ''}>整单总量</option></select>`}</td><td class="p-2">${readonly ? `${Math.round(line.lossRate * 10_000) / 100}%` : `<input type="number" min="0" max="99.99" step="0.01" class="h-9 w-20 rounded border px-2" readonly aria-label="损耗率固定为零" data-${PREFIX}-field="bomLossRate" value="${Math.round(line.lossRate * 10_000) / 100}">`}</td><td class="p-2">${readonly ? line.dyeRequirement || '否' : `<select class="h-9 rounded border px-2" disabled aria-label="染色由目标SKU决定" data-${PREFIX}-field="bomDyeRequirement"><option ${line.dyeRequirement !== '是' ? 'selected' : ''}>否</option><option ${line.dyeRequirement === '是' ? 'selected' : ''}>是</option></select>`}</td><td class="p-2">${readonly ? line.printRequirement || '否' : `<select class="h-9 rounded border px-2" disabled aria-label="印花由目标SKU决定" data-${PREFIX}-field="bomPrintRequirement"><option ${line.printRequirement !== '是' ? 'selected' : ''}>否</option><option ${line.printRequirement === '是' ? 'selected' : ''}>是</option></select>`}</td><td class="p-2">${unitPrice}</td><td class="p-2" data-design-revision-bom-subtotal>${materialSubtotal}</td><td class="p-2">${readonly ? escapeHtml(line.remark || '-') : `<input class="h-9 min-w-40 rounded border px-2" data-${PREFIX}-field="bomRemark" value="${escapeHtml(line.remark || '')}">`}</td>${readonly ? '' : `<td class="p-2"><button class="text-red-600" data-${PREFIX}-action="remove-bom-line" data-version-id="${escapeHtml(version.bomDraftVersionId)}" data-line-index="${index}">删除</button></td>`}</tr>`
    }).join('')}</tbody>`
  }).join('')
  const hasMaterialLines = versions.some((version) => (readonly ? version.materialLines : ensureBomLineDrafts(version.bomDraftVersionId)).length > 0)
  const firstVersionId = versions[0]?.bomDraftVersionId || ''
  return `<div class="overflow-hidden rounded-lg bg-white border border-slate-200" data-design-revision-material-table><div class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"><h4 class="font-medium">物料与加工要求</h4><p class="text-xs text-slate-500">选择目标 SKU 后自动带出颜色、潘通色号、花型图和加工方式；同一物料先染后印。</p>${readonly ? '' : `<button type="button" class="rounded border px-3 py-2 text-sm text-blue-700" data-${PREFIX}-action="add-bom-line" data-version-id="${escapeHtml(firstVersionId)}">新增物料</button>`}</div><div class="overflow-x-auto"><table class="w-full min-w-[1320px] text-sm"><thead><tr class="border-b bg-slate-50 text-left"><th class="p-2">物料</th><th class="p-2">单位用量</th><th class="p-2">损耗率 %（固定 0）</th><th class="p-2">染色</th><th class="p-2">印花</th><th class="p-2">标准单价</th><th class="p-2">物料小计</th><th class="p-2">说明</th>${readonly ? '' : '<th class="p-2">操作</th>'}</tr></thead>${hasMaterialLines ? body : `<tbody data-independent-bom-version="${escapeHtml(firstVersionId)}"><tr><td colspan="9" class="p-6 text-center text-amber-700">请由买手手工新增本次使用的物料。</td></tr></tbody>`}</table></div></div>`
}

function renderPricingPlanCosts(record: EngineeringIndependentSamplingRecord, readonly: boolean): string {
  const plan = getEngineeringBomPricingPlan('INDEPENDENT_SAMPLING', record.samplingTaskId)
  if (!plan && record.samplingTaskId !== NEW_TASK_ID) return '<div class="border-t border-red-200 bg-red-50 p-4 text-sm text-red-700">费用方案不存在，请刷新页面后重试。</div>'
  const draft = readonly
    ? { customCostDecision: plan!.customCostDecision, customCosts: plan!.customCosts.map((cost) => ({ ...cost })) }
    : ensurePricingPlanDraft(record)
  const versions = materialPlanVersions(record)
  const sampleQuantity = sampleQuantityForPlan(record)
  const materialLines = versions.flatMap((version) => (readonly ? version.materialLines : ensureBomLineDrafts(version.bomDraftVersionId)).map((line) => ({ ...line, sampleQuantity })))
  const exchangeRate = getLatestPcsExchangeRate().idrPerCny
  const materialCostCny = Math.round(materialLines.reduce((total, line) => {
    try { return total + (resolveEngineeringBomMaterialLine(line).materialCostCny || 0) } catch { return total }
  }, 0) * 100) / 100
  const customCostIdr = Math.round(draft.customCosts.reduce((total, cost) => total + Math.max(0, Number(cost.amountIdr) || 0), 0))
  const comprehensiveCostCny = Math.round((materialCostCny + customCostIdr / exchangeRate) * 100) / 100
  const comprehensiveCostIdr = Math.round(materialCostCny * exchangeRate + customCostIdr)
  const editable = !readonly && (!plan || (plan.status === 'DRAFT' && !plan.editingLockedAt))
  const feeRows = draft.customCosts.length
    ? draft.customCosts.map((cost, index) => `<div class="grid gap-3 border-t p-3 md:grid-cols-[1fr_220px_1fr_80px]" data-independent-pricing-cost-row="${escapeHtml(cost.customCostId || `${record.samplingTaskId}-COST-${index + 1}`)}"><input class="h-9 rounded border px-3" data-${PREFIX}-field="customCostTitle" value="${escapeHtml(cost.title)}" placeholder="费用名称，如车位费" ${editable ? '' : 'disabled'}><label class="flex items-center gap-2"><span>Rp</span><input class="h-9 w-full rounded border px-3" type="number" min="1" step="1" data-${PREFIX}-field="customCostAmount" value="${cost.amountIdr || ''}" placeholder="金额" ${editable ? '' : 'disabled'}></label><input class="h-9 rounded border px-3" data-${PREFIX}-field="customCostNote" value="${escapeHtml(cost.note || '')}" placeholder="备注" ${editable ? '' : 'disabled'}>${editable ? `<button class="text-sm text-red-600" data-${PREFIX}-action="remove-custom-cost" data-sampling-id="${escapeHtml(record.samplingTaskId)}" data-cost-index="${index}">删除</button>` : '<span class="text-sm text-slate-500">已锁定</span>'}</div>`).join('')
    : '<p class="border-t p-5 text-center text-sm text-slate-500">暂无自定义费用明细。</p>'
  return `<div class="overflow-hidden rounded-lg bg-white border border-slate-200" data-design-revision-pricing><div class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"><h4 class="font-medium">费用与综合成本</h4>${editable ? `<button class="rounded border px-3 py-2 text-sm text-blue-700" data-${PREFIX}-action="add-custom-cost" data-sampling-id="${escapeHtml(record.samplingTaskId)}">新增费用</button>` : '<span class="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">已锁定</span>'}</div><div>${feeRows}</div><div class="grid gap-3 border-t bg-slate-50 p-4 md:grid-cols-5" data-design-revision-cost-summary><article><p class="text-xs text-slate-500">物料成本</p><p class="mt-1 font-semibold">¥ ${materialCostCny.toFixed(2)}</p></article><article><p class="text-xs text-slate-500">其他费用</p><p class="mt-1 font-semibold">Rp ${customCostIdr.toLocaleString('id-ID')}</p></article><article><p class="text-xs text-slate-500">系统汇率</p><p class="mt-1 font-semibold">1 CNY = ${exchangeRate.toLocaleString('id-ID')} IDR</p></article><article><p class="text-xs text-slate-500">综合成本 CNY</p><p class="mt-1 font-semibold text-blue-700">¥ ${comprehensiveCostCny.toFixed(2)}</p></article><article><p class="text-xs text-slate-500">综合成本 IDR</p><p class="mt-1 font-semibold text-blue-700">Rp ${comprehensiveCostIdr.toLocaleString('id-ID')}</p></article></div></div>`
}

function renderMaterialAndPricingPlan(record: EngineeringIndependentSamplingRecord, readonly: boolean): string {
  return `<section class="space-y-6" data-design-revision-material-pricing>${renderBomSummary(record, readonly)}${renderPricingPlanCosts(record, readonly)}</section>`
}

function refreshBuyerFormSections(): void {
  const id = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '')
  const record = getEngineeringIndependentSamplingRecord(id)
  if (!record) return
  refreshMaterialPricingRegion(record)
  const sample = document.querySelector<HTMLElement>('[data-design-revision-display-sample-arrangement]')
  if (sample) sample.outerHTML = renderSampleRequirementTable(record, false)
  refreshWorkPreview(record)
}

function refreshMaterialPricingRegion(record: EngineeringIndependentSamplingRecord): void {
  const region = document.querySelector<HTMLElement>('[data-design-revision-material-pricing]')
  if (region) region.outerHTML = renderMaterialAndPricingPlan(record, false)
}

function refreshBomComputedValues(record: EngineeringIndependentSamplingRecord): void {
  const holder = document.createElement('div')
  holder.innerHTML = renderBomSummary(record, false)
  const current = [...document.querySelectorAll<HTMLElement>('[data-design-revision-material-table] [data-design-revision-bom-subtotal]')]
  const next = [...holder.querySelectorAll<HTMLElement>('[data-design-revision-bom-subtotal]')]
  if (current.length === next.length) current.forEach((cell, index) => { cell.innerHTML = next[index].innerHTML })
  refreshMaterialPricingSummary(record)
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
  return `<section class="rounded-lg bg-white px-4 py-3" data-design-revision-work-preview><h3 class="font-semibold">将生成的工作</h3><div class="mt-3 flex flex-wrap gap-2">${suggested.map((type) => `<span class="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">${escapeHtml(TASK_OPTIONS.find((item) => item.value === type)?.label || type)}</span>`).join('')}</div></section>`
}

function refreshWorkPreview(record: EngineeringIndependentSamplingRecord): void {
  const current = document.querySelector<HTMLElement>('[data-design-revision-work-preview]')
  if (current) current.outerHTML = renderWorkPreview(record, false)
}

function materialSkuOptions(selected = ''): string {
  return listMaterialArchives().filter((archive) => archive.status === 'ACTIVE').flatMap((archive) => listMaterialSkuRecordsByMaterialId(archive.materialId).filter((sku) => sku.status === 'ACTIVE' && sku.costPrice > 0 && (Boolean(sku.designRevisionProcesses) || sku.materialSkuId === selected)).map((sku) => `<option value="${escapeHtml(sku.materialSkuId)}" ${sku.materialSkuId === selected ? 'selected' : ''}>${escapeHtml(sku.materialSkuCode)} · ${escapeHtml(archive.materialName)}${sku.designRevisionProcesses?.length ? ` · ${sku.designRevisionProcesses.join('→')}` : ''}</option>`)).join('')
}

function dependencyNames(record: EngineeringIndependentSamplingRecord, task: EngineeringIndependentProfessionalTask): string {
  return task.dependsOnTaskIds.length ? task.dependsOnTaskIds.map((id) => record.professionalTasks.find((item) => item.taskId === id)?.taskName || '前一项工作').join('、') : '无'
}

function nextTeam(record: EngineeringIndependentSamplingRecord, task: EngineeringIndependentProfessionalTask): string {
  const dependents = record.professionalTasks.filter((item) => item.dependsOnTaskIds.includes(task.taskId))
  if (dependents.length) return dependents.map((item) => item.ownerTeamName).join('、')
  return record.professionalTasks.every((item) => item.taskId === task.taskId || item.status === 'COMPLETED') ? '设计改款任务自动完成' : '其他并行团队继续处理'
}

function ensureSampleRequirementDrafts(record: EngineeringIndependentSamplingRecord): typeof ui.sampleRequirementDraftsByTask[string] {
  if (ui.sampleRequirementDraftsByTask[record.samplingTaskId]) return ui.sampleRequirementDraftsByTask[record.samplingTaskId]
  const saved = record.professionalTasks.find((task) => task.taskType === 'DISPLAY_SAMPLE')?.sampleRequirements
    || record.creationSampleRequirements || []
  ui.sampleRequirementDraftsByTask[record.samplingTaskId] = saved.length ? saved.map((line, index) => ({
    draftId: 'requirementLineId' in line && typeof line.requirementLineId === 'string' ? line.requirementLineId : `${record.samplingTaskId}-DISPLAY-REQ-DRAFT-${index + 1}`,
    targetColor: line.targetColor, targetSize: line.targetSize,
    requiredQuantity: line.requiredQuantity, requirementNote: line.requirementNote,
  })) : [{ draftId: `${record.samplingTaskId}-DISPLAY-REQ-DRAFT-1`, targetColor: '整款', targetSize: 'M', requiredQuantity: 1, requirementNote: '' }]
  return ui.sampleRequirementDraftsByTask[record.samplingTaskId]
}

function renderSampleRequirementTable(record: EngineeringIndependentSamplingRecord, locked: boolean): string {
  const rows = ensureSampleRequirementDrafts(record)
  return `<section class="overflow-hidden rounded-lg bg-white border border-slate-200" data-design-revision-display-sample-arrangement><div class="flex items-center justify-between gap-3 border-b px-4 py-3"><h3 class="font-semibold">销售展示样衣制作安排</h3>${locked ? '<span class="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">已下达</span>' : `<button type="button" class="rounded border px-3 py-1.5 text-sm" data-${PREFIX}-action="add-sample-requirement">增加颜色／尺码</button>`}</div>${rows.map((draft, index) => `<div class="grid gap-4 p-4 md:grid-cols-[minmax(110px,1fr)_minmax(110px,1fr)_150px_minmax(180px,2fr)_50px]" data-sample-requirement-row="${escapeHtml(draft.draftId)}"><label class="text-sm text-slate-600">颜色${locked ? `<p class="mt-1">${escapeHtml(draft.targetColor)}</p>` : `<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="sampleRequirementColor" value="${escapeHtml(draft.targetColor)}">`}</label><label class="text-sm text-slate-600">尺码${locked ? `<p class="mt-1">${escapeHtml(draft.targetSize)}</p>` : `<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="sampleRequirementSize" value="${escapeHtml(draft.targetSize)}">`}</label><label class="text-sm text-slate-600">数量（件）${locked ? `<p class="mt-1">${draft.requiredQuantity} 件</p>` : `<input type="number" min="1" step="1" class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="sampleRequirementQuantity" value="${draft.requiredQuantity}">`}</label><label class="text-sm text-slate-600">制作要求${locked ? `<p class="mt-1">${escapeHtml(draft.requirementNote || '-')}</p>` : `<textarea class="mt-1 min-h-10 w-full rounded border px-3 py-2" data-${PREFIX}-field="sampleRequirementNote">${escapeHtml(draft.requirementNote)}</textarea>`}</label>${locked || rows.length === 1 ? '' : `<button type="button" class="self-center text-sm text-red-700" data-${PREFIX}-action="remove-sample-requirement" data-line-index="${index}">删除</button>`}</div>`).join('')}</section>`
}

function renderWorkPlan(record: EngineeringIndependentSamplingRecord): string {
  return `<section class="space-y-4"><section class="overflow-hidden rounded-lg border bg-white"><div class="border-b px-4 py-3"><h2 class="font-semibold">本次需要完成的工作</h2></div><div class="overflow-x-auto"><table class="w-full min-w-[1080px] text-sm"><thead><tr class="border-b bg-slate-50 text-left"><th class="p-3">任务</th><th class="p-3">当前团队</th><th class="p-3">当前动作</th><th class="p-3">需要先完成</th><th class="p-3">完成后去向</th><th class="p-3">状态</th><th class="p-3">操作</th></tr></thead><tbody>${record.professionalTasks.filter((task) => task.taskType === 'BASE_PATTERN' || task.taskType === 'DISPLAY_SAMPLE').map((task) => {
    const processStatuses = readDesignRevisionProcessWorkOrderStatuses(task.processWorkOrderRefs)
    const processLinks = task.processWorkOrderRefs.map((ref) => {
      const href = ref.processType === 'PRINTING'
        ? buildPrintingWorkOrderDetailLink(ref.processOrderId)
        : buildDyeingWorkOrderDetailLink(ref.processOrderId)
      const status = processStatuses.find((item) => item.processType === ref.processType && item.processOrderId === ref.processOrderId)
      return `<a class="block text-xs text-blue-700" href="${escapeHtml(href)}">${ref.processType === 'PRINTING' ? '印花加工单' : '染色加工单'} ${escapeHtml(ref.processOrderCode || ref.processOrderId)}${status ? ` · ${escapeHtml(status.statusLabel)}` : ''}</a>`
    }).join('')
    return `<tr class="border-b"><td class="p-3 font-medium">${escapeHtml(task.taskName)}${processLinks ? `<div class="mt-2 space-y-1">${processLinks}</div>` : ''}</td><td class="p-3">${escapeHtml(getEngineeringIndependentProfessionalTaskCurrentTeam(task) || '-')}</td><td class="p-3">${escapeHtml(task.taskType === 'DISPLAY_SAMPLE' && task.status === 'WAIT_START' ? '填报并提交销售展示样衣' : task.status === 'WAIT_DEPENDENCY' ? '等待前面工作完成' : task.status === 'WAIT_REVIEW' ? '审核本次成果' : task.status === 'REWORK' ? '根据未通过项重做' : task.status === 'COMPLETED' ? '无' : (task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') && !task.colorRequirementConfirmedAt ? '填写潘通色号和颜色名称' : task.status === 'IN_PROGRESS' ? '制作并提交成果' : '开始本项工作')}</td><td class="p-3">${escapeHtml(dependencyNames(record, task))}</td><td class="p-3">${escapeHtml(nextTeam(record, task))}</td><td class="p-3">${escapeHtml(professionalTaskStatusText(task))}</td><td class="p-3"><a class="text-blue-700" href="${getIndependentProfessionalTaskDetailPath(task)}">进入任务</a></td></tr>`
  }).join('')}</tbody></table></div></section>${renderSampleRequirementTable(record, true)}</section>`
}

const SAMPLING_STEPS: Array<{ key: Exclude<EngineeringIndependentSamplingStep, 'COMPLETED'>; title: string; team: string }> = [
  { key: 'SCHEME_CONFIRMATION', title: '填写并提交任务', team: '买手' },
  { key: 'PROFESSIONAL_WORK', title: '制作与交接', team: '版师、加工厂、中央工厂' },
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
  return `<nav class="grid overflow-hidden rounded-lg border bg-white md:grid-cols-2" aria-label="设计改款任务步骤">${SAMPLING_STEPS.map((step, index) => {
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
  const action = !readonly && bomReady ? `<div class="sticky bottom-0 z-10 flex justify-end gap-2 bg-white/95 px-4 py-3"><button class="rounded border px-5 py-2" data-${PREFIX}-action="save-draft" data-sampling-id="${escapeHtml(record.samplingTaskId)}">保存草稿</button><button class="rounded bg-blue-600 px-5 py-2 text-white" data-${PREFIX}-action="confirm-scheme" data-sampling-id="${escapeHtml(record.samplingTaskId)}">提交任务并生成工作</button></div>` : ''
  return `<section class="space-y-6">${returned}${details}${action}</section>`
}

function renderProfessionalWorkStep(record: EngineeringIndependentSamplingRecord): string {
  if (!record.taskPlanConfirmedAt) return '<section class="rounded-lg border border-dashed bg-slate-50 p-6 text-sm text-slate-500">待买手确认本次方案。</section>'
  return `<section class="space-y-4"><header class="rounded-lg border bg-white p-4"><div class="flex items-center justify-between gap-3"><h2 class="font-semibold">第二步：专业工作</h2><span class="rounded-full ${record.status === 'WAIT_CONFIRMATION' || record.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'} px-2 py-1 text-xs">${record.status === 'WAIT_CONFIRMATION' || record.status === 'COMPLETED' ? '已完成' : '处理中'}</span></div></header>${renderWorkPlan(record)}</section>`
}

function renderDesignFileHistory(record: EngineeringIndependentSamplingRecord): string {
  const canReplace = !record.taskPlanConfirmedAt
  return `<section class="rounded-lg bg-white p-4" data-design-revision-design-files><div class="flex flex-wrap items-center justify-between gap-3"><h2 class="font-semibold">设计稿</h2>${canReplace ? `<label class="inline-flex h-9 cursor-pointer items-center rounded border border-blue-200 px-3 text-sm text-blue-700">替换设计稿<input class="sr-only" type="file" accept="${escapeHtml(ENGINEERING_UPLOAD_RULES.DESIGN_IMAGE.accept)}" multiple data-skip-page-rerender="true" data-${PREFIX}-replace-design-upload data-sampling-id="${escapeHtml(record.samplingTaskId)}"></label>` : '<span class="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">已锁定</span>'}</div><div class="mt-3 grid gap-3">${record.designFiles.map((file, index) => { const imageUrl = localStyleFixtureImageUrl(file.dataUrl); return `<article class="rounded p-3 ${index === record.designFiles.length - 1 ? 'bg-blue-50/40' : ''}"><button type="button" class="block w-full text-left" data-${PREFIX}-upload-preview data-file-url="${escapeHtml(imageUrl)}" data-file-name="${escapeHtml(file.fileName)}"><span class="flex h-36 items-center justify-center overflow-hidden rounded bg-slate-100"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(file.fileName)}设计稿" class="h-full w-full object-contain" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="text-sm text-red-600">设计稿加载失败</span></span><strong class="mt-2 block truncate text-sm">${escapeHtml(file.fileName)}</strong></button><p class="mt-1 text-xs text-slate-500">${index === record.designFiles.length - 1 ? '当前版本 · ' : '历史版本 · '}${escapeHtml(file.uploadedByName)} · ${escapeHtml(file.uploadedAt)}</p></article>` }).join('') || '<p class="text-sm text-red-600">缺少设计稿。</p>'}</div></section>`
}

function renderDesignRevisionBasicInfo(
  record: EngineeringIndependentSamplingRecord,
  currentStep: number,
): string {
  const objective = record.creationReason.trim() || '未填写设计改款目标'
  return `<section class="overflow-hidden rounded-lg bg-white" data-design-revision-basic-info><header class="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div><div class="flex flex-wrap items-center gap-2"><h1 class="text-xl font-semibold">${escapeHtml(record.samplingTaskCode)}</h1><span class="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">${escapeHtml(samplingStatusText(record))}</span></div><p class="mt-1 text-sm text-slate-500">设计改款 · 买手：${escapeHtml(record.buyerName)}</p></div><a class="rounded border px-4 py-2 text-sm" href="/pcs/production-preparation/design-revision">返回列表</a></header><div class="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]" data-design-revision-basic-columns><div class="space-y-4"><section class="rounded-lg bg-blue-50/60 px-5 py-4" data-design-revision-objective><p class="text-sm font-medium text-blue-700">设计改款目标</p><p class="mt-2 whitespace-pre-wrap text-base font-medium leading-7 text-slate-900">${escapeHtml(objective)}</p></section><div class="grid gap-4 md:grid-cols-2">${styleCard(record.sourceStyleId, '原款式（SPU）').replace('rounded-lg border bg-white p-4', 'p-2')}${targetStyleCard(record, '新款式（SPU）').replace('rounded-lg border bg-white p-4', 'p-2')}</div><div class="grid gap-4 md:grid-cols-2"><div class="rounded-lg bg-slate-50 p-4"><p class="text-xs text-slate-500">当前需处理的团队</p><p class="mt-1 font-medium">${escapeHtml(getEngineeringIndependentCurrentTeam(record) || '已完成')}</p></div><div class="rounded-lg bg-slate-50 p-4"><p class="text-xs text-slate-500">当前步骤</p><p class="mt-1 font-medium">${escapeHtml(SAMPLING_STEPS[currentStep].title)}</p></div></div></div>${renderDesignFileHistory(record)}</div></section>`
}

export function renderPcsIndependentSamplingDetailPage(id: string): string {
  if (id === NEW_TASK_ID) {
    const record = getEngineeringIndependentSamplingRecord(id)!
    return `<section class="space-y-6 p-4" data-design-revision-create-page><header class="flex items-center justify-between"><h1 class="text-xl font-semibold">新建设计改款</h1><button class="rounded border px-4 py-2 text-sm" data-${PREFIX}-action="close-create">返回列表</button></header>${renderSamplingStepNav(record)}<div data-design-revision-create-feedback>${feedbackHtml()}</div>${renderCreationBasicFields()}${renderSchemeConfirmationStep(record, false)}${renderDialogHost()}</section>`
  }
  const record = getEngineeringIndependentSamplingRecord(id)
  if (!record) return '<section class="p-6"><h1 class="text-xl font-semibold">任务不存在</h1></section>'
  if (!(record.samplingTaskId in ui.detailStepByTask) && typeof location !== 'undefined') {
    const query = new URLSearchParams(location.search)
    if (query.get('step') === 'buyer') ui.detailStepByTask[record.samplingTaskId] = 0
  }
  const selectedStep = ui.detailStepByTask[record.samplingTaskId] ?? currentSamplingStepIndex(record)
  const currentStep = currentSamplingStepIndex(record)
  const stepContent = selectedStep === 0 ? renderSchemeConfirmationStep(record, Boolean(record.taskPlanConfirmedAt)) : renderProfessionalWorkStep(record)
  return `<section class="space-y-4 p-4">${renderDesignRevisionBasicInfo(record, currentStep)}${feedbackHtml()}${renderSamplingStepNav(record)}${stepContent}<section class="rounded-lg border bg-white p-4"><h2 class="font-semibold">操作记录</h2><div class="mt-3 space-y-2">${record.operationLogs.map((log) => `<div class="grid gap-1 border-b pb-2 text-sm md:grid-cols-[160px_200px_1fr]"><span>${escapeHtml(log.occurredAt)}</span><span>${escapeHtml(log.operatorName)} · ${escapeHtml(log.action)}</span><span class="text-slate-500">${escapeHtml(log.detail)}</span></div>`).join('')}</div></section>${renderDialogHost()}</section>`
}

function findProfessional(taskId: string): { record: EngineeringIndependentSamplingRecord; task: EngineeringIndependentProfessionalTask } | null {
  for (const record of listEngineeringIndependentSamplingRecords()) { const task = record.professionalTasks.find((item) => item.taskId === taskId); if (task) return { record, task } }
  return null
}
function uploadPurposes(task: EngineeringIndependentProfessionalTask): Array<{ purpose: EngineeringUploadPurpose; label: string; requiredHint: string }> {
  if (task.taskType === 'BASE_PATTERN') return [{ purpose: 'PATTERN_SOURCE', label: '基码纸样源文件', requiredHint: '必须包含真实 .prj 纸样文件；可同时上传 .dxf、.rul 或 .pdf。' }]
  if (task.taskType === 'DISPLAY_SAMPLE') return [{ purpose: 'SAMPLE_RESULT', label: '销售展示样衣图片', requiredHint: '必须上传与 B 款真实对应的样衣图片。' }]
  if (task.taskType === 'PATTERN_ARTWORK') return [{ purpose: 'PATTERN_ARTWORK', label: '花型成果文件', requiredHint: '可一次或分次上传多个花型图和花型文件；至少包含 1 张可预览花型图及 1 个 .ai、.psd 或 .pdf 文件。' }]
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

function isConceptSampleImage(file: { fileName: string; dataUrl: string }): boolean {
  return /concept|effect|概念|效果图/i.test(file.fileName)
    || file.dataUrl.includes('/design-revision-demo/style-prj-202603-012-blue-floral-polo-effect.jpg')
}

function sampleImageNoticeText(file: { fileName: string; dataUrl: string }): string {
  if (isConceptSampleImage(file)) return '概念效果图 · 仅供 Mock 演示，不代表实物样衣照片。'
  if (/^es-id-dr-.*-display_sample-/i.test(file.fileName)) return 'Mock 演示图片 · 未核验为本次实际制作样衣的实拍照片。'
  return ''
}

function renderConceptSampleImageNotice(files: Array<{ fileName: string; dataUrl: string }>): string {
  const conceptFile = files.find(isConceptSampleImage)
  if (conceptFile) return `<p class="rounded bg-blue-50 px-3 py-2 text-xs text-blue-800" data-sample-concept-notice>${sampleImageNoticeText(conceptFile)}</p>`
  const demoFile = files.find((file) => /^es-id-dr-.*-display_sample-/i.test(file.fileName))
  if (demoFile) return `<p class="rounded bg-blue-50 px-3 py-2 text-xs text-blue-800" data-sample-demo-notice>${sampleImageNoticeText(demoFile)}</p>`
  return ''
}

function renderDisplaySampleSubmission(task: EngineeringIndependentProfessionalTask): string {
  const drafts = ensureSampleResultDrafts(task)
  const requirements = task.sampleRequirements || []
  const patternVersions = availableIndependentPatternVersions(task)
  return `<div class="space-y-4"><div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="font-semibold">提交本次实际交付</h2><p class="mt-1 text-sm text-slate-500">每行对应一项制作要求；同一要求可拆成多行实际交付。实际与要求不一致时必须填写差异说明。Mock 演示可使用概念效果图；此类图片仅演示流程，不代表实物样衣照片。</p></div><button class="rounded border px-3 py-2 text-sm" data-${PREFIX}-action="add-sample-result" data-task-id="${escapeHtml(task.taskId)}">新增实际交付</button></div>${drafts.map((draft, index) => {
    const requirement = sampleRequirementById(task, draft.requirementLineId)
    const files = listEngineeringTaskUploadedFiles(task.taskId, draft.draftId, 'SAMPLE_RESULT')
    return `<article class="space-y-3 rounded-lg border p-4" data-sample-result-row="${escapeHtml(draft.draftId)}"><div class="flex items-center justify-between gap-3"><strong>实际交付 ${index + 1}</strong>${drafts.length > requirements.length ? `<button class="text-sm text-red-600" data-${PREFIX}-action="remove-sample-result" data-task-id="${escapeHtml(task.taskId)}" data-draft-id="${escapeHtml(draft.draftId)}">删除</button>` : ''}</div><div class="grid gap-3 md:grid-cols-4"><label class="text-sm text-slate-600">对应制作要求<select class="mt-1 h-10 w-full rounded border px-2" data-${PREFIX}-field="sampleResultRequirement">${requirements.map((line) => `<option value="${escapeHtml(line.requirementLineId)}" ${line.requirementLineId === draft.requirementLineId ? 'selected' : ''}>${escapeHtml(line.targetColor)} / ${escapeHtml(line.targetSize)} / ${line.requiredQuantity} 件</option>`).join('')}</select></label><label class="text-sm text-slate-600">实际颜色<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="sampleResultColor" value="${escapeHtml(draft.actualColor)}"></label><label class="text-sm text-slate-600">实际尺码<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="sampleResultSize" value="${escapeHtml(draft.actualSize)}"></label><label class="text-sm text-slate-600">实际数量<input type="number" min="1" step="1" class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="sampleResultQuantity" value="${draft.actualQuantity}"></label></div><div class="grid gap-3 md:grid-cols-3"><label class="text-sm text-slate-600">使用的纸样版本<select class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="sampleResultPattern"><option value="">请选择已完成纸样版本</option>${patternVersions.map((version) => `<option value="${escapeHtml(version)}" ${version === draft.sourcePatternVersion ? 'selected' : ''}>${escapeHtml(version)}</option>`).join('')}</select></label><label class="text-sm text-slate-600">制作说明<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="sampleResultNote" value="${escapeHtml(draft.productionNote)}" placeholder="本行实际制作情况"></label><label class="text-sm text-slate-600">差异说明<input class="mt-1 h-10 w-full rounded border px-3" data-${PREFIX}-field="sampleResultDifference" value="${escapeHtml(draft.differenceNote)}" placeholder="仅实际与要求不一致时必填"></label></div>${patternVersions.length ? '' : '<p class="rounded bg-amber-50 px-3 py-2 text-sm text-amber-700">尚无可用的已完成基码纸样版本，不能提交样衣成果。</p>'}${requirement ? `<p class="rounded bg-slate-50 px-3 py-2 text-xs text-slate-600">要求：${escapeHtml(requirement.targetColor)} / ${escapeHtml(requirement.targetSize)} / ${requirement.requiredQuantity} 件${requirement.requirementNote ? ` · ${escapeHtml(requirement.requirementNote)}` : ''}</p>` : ''}${renderConceptSampleImageNotice(files)}${renderEngineeringFileUpload({ taskId: task.taskId, itemId: draft.draftId, purpose: 'SAMPLE_RESULT', files, label: '本行销售展示样衣图片', requiredHint: '必须选择并真实读取与本行实际样衣对应的图片。', eventPrefix: PREFIX })}</article>`
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
  if (task.taskType !== 'BASE_PATTERN' && task.taskType !== 'DISPLAY_SAMPLE') {
    return `<section class="space-y-4 p-4"><div class="rounded-lg border bg-white p-5"><h1 class="text-xl font-semibold">${escapeHtml(task.taskName)} · 历史记录</h1><p class="mt-3 text-sm text-slate-600">当前设计改款流程已在创建前完成花型设计和染色调色。本记录仅供追溯，不再接受审核或返工。</p><a class="mt-4 inline-block text-blue-700" href="/pcs/production-preparation/design-revision/${escapeHtml(record.samplingTaskId)}">返回设计改款任务</a></div></section>`
  }
  const style = getStyleArchiveById(record.targetStyleId)
  const targetLabel = style?.styleCode || record.temporarySpuName || record.targetStyleName || '线下临时 SPU'
  const targetBlock = style
    ? `<div class="flex items-center gap-3">${imageButton(style.mainImageUrl, style.styleName)}<div><p class="font-medium">${escapeHtml(style.styleName)}</p><p class="text-sm text-slate-500">${escapeHtml(style.styleCode)}</p></div></div>`
    : `<div class="flex items-center gap-3">${imageButton(record.designFiles.at(-1)?.dataUrl || '', targetLabel)}<div><p class="font-medium">${escapeHtml(targetLabel)}</p><p class="text-sm text-slate-500">线下临时 SPU</p></div></div>`
  const canSubmit = task.taskType === 'DISPLAY_SAMPLE' ? ['WAIT_START', 'IN_PROGRESS'].includes(task.status) : task.status === 'IN_PROGRESS'
  const currentTeam = getEngineeringIndependentProfessionalTaskCurrentTeam(task) || '-'
  const missingProcessOrders = task.processWorkOrderRefs.length > 0
    && readDesignRevisionProcessWorkOrderStatuses(task.processWorkOrderRefs).some((status) => status.status === 'NOT_FOUND')
  const canRepairProcessOrders = (record.professionalTasks.find((item) => item.taskType === 'DISPLAY_SAMPLE')?.sampleRequirements || []).length > 0
  const currentAction = task.taskType === 'DISPLAY_SAMPLE' && task.status === 'WAIT_START' ? '所需材料确认接收后直接填报并提交样衣'
    : task.status === 'WAIT_START' ? '由当前团队开始制作'
      : task.status === 'IN_PROGRESS' ? '上传并提交本次真实成果'
        : task.status === 'COMPLETED' ? '本项工作已完成' : '等待需要先完成的工作'
  const resultCards = task.results.length
    ? task.results.map((result) => `<article class="rounded border p-3"><div class="flex items-center justify-between gap-2"><strong>${escapeHtml(result.title)}</strong><span class="text-xs ${result.status === 'REJECTED' ? 'text-red-600' : result.status === 'APPROVED' ? 'text-emerald-700' : 'text-amber-700'}">${result.status === 'APPROVED' ? '已通过' : result.status === 'REJECTED' ? '未通过' : '待审核'}</span></div>${renderProfessionalResultDetails(task, result)}${task.taskType === 'DISPLAY_SAMPLE' ? renderConceptSampleImageNotice(result.files) : ''}<div class="mt-3 space-y-2">${result.files.map((file) => `<div class="flex items-center justify-between gap-2 rounded bg-slate-50 px-3 py-2 text-sm"><span class="truncate">${escapeHtml(file.fileName)} · ${(file.sizeBytes / 1024).toFixed(0)} KB · 第 ${file.roundNo} 轮</span><div class="flex gap-2">${['jpg','jpeg','png','webp'].includes(file.extension) ? `<button class="text-blue-700" data-${PREFIX}-upload-preview data-file-url="${escapeHtml(file.dataUrl)}" data-file-name="${escapeHtml(file.fileName)}">查看大图</button>` : ''}<a class="text-blue-700" href="${escapeHtml(localStyleFixtureImageUrl(file.dataUrl))}" download="${escapeHtml(file.fileName)}">下载</a></div></div>`).join('')}</div>${task.status === 'WAIT_REVIEW' ? `<div class="mt-3 grid gap-2"><label class="text-sm"><input type="radio" name="review-${escapeHtml(result.resultId)}" value="approve" checked data-${PREFIX}-review-result="${escapeHtml(result.resultId)}"> 通过</label><label class="text-sm"><input type="radio" name="review-${escapeHtml(result.resultId)}" value="reject" data-${PREFIX}-review-result="${escapeHtml(result.resultId)}"> 不通过</label><input class="h-9 rounded border px-2 text-sm" data-${PREFIX}-review-reason="${escapeHtml(result.resultId)}" placeholder="不通过原因"></div>` : result.rejectReason ? `<p class="mt-2 text-sm text-red-600">${escapeHtml(result.rejectReason)}</p>` : ''}</article>`).join('')
    : '<p class="text-sm text-slate-500">尚未提交成果</p>'
  const submitSection = canSubmit
    ? task.taskType === 'DISPLAY_SAMPLE'
      ? `<section class="rounded-lg border bg-white p-4">${renderDisplaySampleSubmission(task)}<button class="mt-4 rounded bg-blue-600 px-4 py-2 text-white" data-${PREFIX}-action="submit-task" data-task-id="${escapeHtml(task.taskId)}">提交本次工作</button></section>`
      : `<section class="rounded-lg border bg-white p-4"><h2 class="font-semibold">提交本次成果</h2><div class="mt-3 grid gap-3">${renderProfessionalResultFields(task)}${uploadPurposes(task).map(({ purpose, label, requiredHint }) => renderEngineeringFileUpload({ taskId: task.taskId, purpose, files: listEngineeringTaskUploadedFiles(task.taskId, 'TASK', purpose), label, requiredHint, eventPrefix: PREFIX })).join('')}</div><button class="mt-4 rounded bg-blue-600 px-4 py-2 text-white" data-${PREFIX}-action="submit-task" data-task-id="${escapeHtml(task.taskId)}">提交本次工作</button></section>`
    : ''
  return `<section class="space-y-4 p-4"><header class="rounded-lg border bg-white"><div class="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div><div class="flex items-center gap-2"><h1 class="text-xl font-semibold">${escapeHtml(task.taskName)}</h1><span class="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">${escapeHtml(professionalTaskStatusText(task))}</span></div><p class="mt-1 text-sm text-slate-500">${escapeHtml(record.samplingTaskCode)} · 新款式（SPU） ${escapeHtml(targetLabel)} · 来源：设计改款</p></div><a class="rounded border px-4 py-2 text-sm" href="/pcs/production-preparation/design-revision/${escapeHtml(record.samplingTaskId)}">返回主任务</a></div><div class="grid gap-4 px-5 py-4 md:grid-cols-[2fr_1fr_1fr_1fr]">${targetBlock}<div><p class="text-xs text-slate-500">当前需处理的团队</p><p class="mt-1 font-medium">${escapeHtml(currentTeam)}</p></div><div><p class="text-xs text-slate-500">需要先完成</p><p class="mt-1 font-medium">${escapeHtml(dependencyNames(record, task))}</p></div><div><p class="text-xs text-slate-500">完成后去向</p><p class="mt-1 font-medium">${escapeHtml(nextTeam(record, task))}</p></div></div><div class="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-5 py-4"><div><p class="text-xs text-slate-500">当前动作</p><p class="mt-1 text-sm">${escapeHtml(currentAction)}</p></div>${task.status === 'WAIT_START' && task.taskType === 'BASE_PATTERN' ? `<button class="rounded bg-blue-600 px-4 py-2 text-white" data-${PREFIX}-action="start-task" data-task-id="${escapeHtml(task.taskId)}">开始任务</button>` : ''}</div></header>${feedbackHtml()}${missingProcessOrders ? `<section class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><span>${canRepairProcessOrders ? '原加工单关联已失效，请按当前物料与加工要求重新建立。' : '原加工单关联已失效，请先补充销售展示样衣数量。'}</span>${canRepairProcessOrders ? `<button class="rounded border border-amber-300 bg-white px-3 py-2 font-medium" data-${PREFIX}-action="repair-process-orders" data-task-id="${escapeHtml(task.taskId)}">重新生成加工单关联</button>` : `<a class="rounded border border-amber-300 bg-white px-3 py-2 font-medium" href="/pcs/production-preparation/design-revision/${escapeHtml(record.samplingTaskId)}?step=buyer">返回主任务补充</a>`}</section>` : ''}${task.taskType === 'DISPLAY_SAMPLE' ? renderDisplaySampleRequirementSummary(task) : ''}${submitSection}<section class="rounded-lg border bg-white p-4"><h2 class="font-semibold">成果记录</h2>${task.taskType === 'DISPLAY_SAMPLE' ? '<p class="mt-2 rounded bg-blue-50 px-3 py-2 text-xs text-blue-800" data-sample-mock-disclaimer>Mock 演示：概念效果图仅用于展示提交流程，不代表实物样衣照片或真实生产成果。</p>' : ''}<div class="mt-3 grid gap-3 md:grid-cols-2">${resultCards}</div>${task.status === 'WAIT_REVIEW' ? `<button class="mt-4 rounded bg-blue-600 px-4 py-2 text-white" data-${PREFIX}-action="review-task" data-task-id="${escapeHtml(task.taskId)}">买手提交整张审核</button>` : ''}</section><section class="rounded-lg border bg-white p-4"><h2 class="font-semibold">操作记录</h2><div class="mt-3 space-y-2">${record.operationLogs.filter((log) => log.detail.includes(task.taskName) || log.action === '创建任务' || log.action === '修复加工单关联').map((log) => `<p class="border-b pb-2 text-sm"><span class="text-slate-500">${escapeHtml(log.occurredAt)}</span> · ${escapeHtml(log.operatorName)} · ${escapeHtml(log.action)} · ${escapeHtml(log.detail)}</p>`).join('') || '<p class="text-sm text-slate-500">暂无操作记录</p>'}</div></section>${renderDialogHost()}</section>`
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

function saveDesignRevisionDraft(record: EngineeringIndependentSamplingRecord): void {
  const samplingId = record.samplingTaskId
  syncBomLineDraftsFromDom()
  syncPricingPlanDraftFromDom(samplingId)
  syncSampleRequirementsFromDom(samplingId)
  saveEngineeringIndependentSamplingDraftRequirements({
    samplingTaskId: samplingId, actor: ADMINISTRATOR,
    sampleRequirements: readSampleRequirements(samplingId).map(({ targetColor, targetSize, requiredQuantity, requirementNote }) => ({ targetColor, targetSize, requiredQuantity, requirementNote })),
  })
  saveInlineBomDrafts(record)
  const costDraft = ensurePricingPlanDraft(record)
  saveEngineeringBomPricingPlan({ ownerStage: 'INDEPENDENT_SAMPLING', ownerId: samplingId, role: ADMINISTRATOR.role, userId: ADMINISTRATOR.userId, userName: ADMINISTRATOR.userName, customCostDecision: costDraft.customCostDecision, customCosts: costDraft.customCosts, updatedAt: nowText() })
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
  const listRoot = target.closest<HTMLElement>('[data-independent-sampling-list="DESIGN_REVISION"]')
  if (listRoot && handleProcessFilterPresentation(listRoot, target)) return true
  const previewOpen = target.closest<HTMLElement>(`[data-${PREFIX}-upload-preview]`)
  if (previewOpen) {
    const file = { fileName: previewOpen.dataset.fileName || '成果图片', dataUrl: previewOpen.dataset.fileUrl || '' }
    ui.preview = { url: localStyleFixtureImageUrl(file.dataUrl), fileName: file.fileName, notice: sampleImageNoticeText(file) || undefined }
    refreshDialogs()
    return true
  }
  if (target.closest(`[data-${PREFIX}-upload-preview-close]`)) { ui.preview = null; refreshDialogs(); return true }
  const remove = target.closest<HTMLElement>(`[data-${PREFIX}-upload-remove]`)
  if (remove) { run(() => removeEngineeringTaskUploadedFile({ taskId: remove.dataset.taskId || '', itemId: remove.dataset.itemId, fileId: remove.dataset.fileId || '' }), '文件已删除。'); return true }
  const node = target.closest<HTMLElement>(`[data-${PREFIX}-action]`); if (!node) return false
  const action = node.dataset.pcsIndependentSamplingAction || ''
  const controller = currentListController()
  if (action === 'query') {
    if (ui.listStartDate && ui.listEndDate && ui.listStartDate > ui.listEndDate) {
      setFeedback('创建开始日期不能晚于结束日期。', false)
      rerender()
      return true
    }
    ui.appliedExtraFilters = { ...ui.extraFilters }
    ui.appliedKeyword = ui.listKeyword.trim()
    ui.appliedStatus = ui.listStatus
    ui.appliedTeamFilter = ui.teamFilter
    ui.appliedPattern = ui.listPattern
    ui.appliedProcessing = ui.listProcessing
    ui.appliedStartDate = ui.listStartDate
    ui.appliedEndDate = ui.listEndDate
    listState.currentPage = 1
    rerender()
    return true
  }
  if (action === 'reset') {
    ui.extraFilters = {}; ui.appliedExtraFilters = {}
    ui.listKeyword = ''; ui.listStatus = ''; ui.teamFilter = ''; ui.listPattern = ''; ui.listProcessing = ''; ui.listStartDate = ''; ui.listEndDate = ''
    ui.appliedKeyword = ''; ui.appliedStatus = ''; ui.appliedTeamFilter = ''; ui.appliedPattern = ''; ui.appliedProcessing = ''; ui.appliedStartDate = ''; ui.appliedEndDate = ''
    listState.currentPage = 1
    rerender()
    return true
  }
  if (action === 'export') {
    const rows = listRows()
    if (!rows.length) { setFeedback('当前查询没有可导出的任务。', false); rerender(); return true }
    const columns = ['任务号', '原款式（SPU）', '原款式买手', '添加人', '新款式（SPU）', '状态', '买手', '基码纸样任务', '染色加工单', '印花加工单', '销售展示样衣任务', '创建时间', '完成时间']
    const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const csv = '\ufeff' + [columns, ...rows.map((record) => [record.samplingTaskCode, record.sourceStyleCode, styleBuyer(record.sourceStyleId), record.createdBy, record.targetStyleCode, samplingStatusText(record), record.buyerName, record.professionalTasks.find((task) => task.taskType === 'BASE_PATTERN')?.taskId || '', processRefs(record).filter((ref) => ref.processType === 'DYEING').map((ref) => ref.processOrderCode).join('；'), processRefs(record).filter((ref) => ref.processType === 'PRINTING').map((ref) => ref.processOrderCode).join('；'), record.professionalTasks.find((task) => task.taskType === 'DISPLAY_SAMPLE')?.taskId || '', record.createdAt, record.confirmedAt])].map((line) => line.map(quote).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = '设计改款任务.csv'; link.click(); URL.revokeObjectURL(url)
    return true
  }
  if (action === 'select-page') {
    document.querySelectorAll<HTMLInputElement>(`[data-independent-sampling-list="DESIGN_REVISION"] [data-independent-sampling-table] input[data-${PREFIX}-select-task]`)
      .forEach((checkbox) => { const taskId = checkbox.getAttribute(`data-${PREFIX}-select-task`); if (taskId) ui.selectedTaskIds.add(taskId) })
    rerender()
    return true
  }
  if (action === 'clear-selection') { ui.selectedTaskIds.clear(); rerender(); return true }
  if (action === 'copy-selected') {
    if (!ui.selectedTaskIds.size) { setFeedback('请先勾选要复制的设计改款任务。', false); rerender(); return true }
    const results = copyEngineeringIndependentSamplingDrafts({ samplingTaskIds: [...ui.selectedTaskIds], actor: BUYER, createdAt: nowText() })
    const failed = results.filter((item) => item.error)
    ui.selectedTaskIds = new Set(failed.map((item) => item.sourceTaskId))
    setFeedback(`${failed.length ? `已生成 ${results.length - failed.length} 张草稿，${failed.length} 张失败。` : '已批量生成独立的设计改款草稿。'}\n${results.map((item) => item.error ? `${item.sourceTaskId}：失败，${item.error}` : `${item.sourceTaskId}：成功，新草稿 ${item.draftTaskId}`).join('\n')}`, failed.length === 0)
    rerender()
    return true
  }
  if (action === 'prev-page' || action === 'next-page') { controller.stepPage(action === 'next-page' ? 1 : -1); controller.refresh(); return true }
  if (action === 'sort-column') { controller.cycleSort(node.dataset.columnKey || ''); controller.refresh(); return true }
  if (action === 'open-column-settings') { (isDisplaySampleListPath() ? displaySampleListState : listState).showColumnSettings = true; controller.refresh({ table: false, pagination: false, overlays: true }); return true }
  if (action === 'close-column-settings') { (isDisplaySampleListPath() ? displaySampleListState : listState).showColumnSettings = false; controller.refresh({ table: false, pagination: false, overlays: true }); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') { const key = node.dataset.pcsIndependentSamplingColumnKey || node.closest<HTMLElement>('[data-pcs-independent-sampling-column-key]')?.dataset.pcsIndependentSamplingColumnKey || ''; controller.updateColumnPreference(action, key, target instanceof HTMLInputElement ? target.checked : undefined); controller.refresh({ overlays: true }); return true }
  if (action === 'restore-column-settings') { controller.restorePreferences(); controller.refresh({ overlays: true }); return true }
  if (action === 'open-image') { ui.preview = { url: node.dataset.imageUrl || '', fileName: node.dataset.imageAlt || '款式图片' }; refreshDialogs(); return true }
  if (action === 'close-image') { ui.preview = null; refreshDialogs(); return true }
  if (action === 'open-create') { resetCreateDraft(); delete ui.bomLineDraftsByVersion[NEW_BOM_ID]; delete ui.pricingPlanDraftsByTask[NEW_TASK_ID]; delete ui.sampleRequirementDraftsByTask[NEW_TASK_ID]; setFeedback(''); navigateDesignRevision(NEW_TASK_ID); return true }
  if (action === 'close-create') { setFeedback(''); navigateDesignRevision(); return true }
  if (action === 'remove-create-design') { ui.createDraft.designFiles = ui.createDraft.designFiles.filter((file) => file.fileId !== node.dataset.fileId); refreshDialogs(); return true }
  if (action === 'remove-create-pattern') { ui.createDraft.reusedPatternFiles = ui.createDraft.reusedPatternFiles.filter((file) => file.fileId !== node.dataset.fileId); refreshDialogs(); return true }

  if (action === 'select-detail-step') { const samplingId = node.dataset.samplingId || ''; const record = getEngineeringIndependentSamplingRecord(samplingId); const nextIndex = Number(node.dataset.stepIndex); if (record && Number.isInteger(nextIndex) && nextIndex <= currentSamplingStepIndex(record)) { ui.detailStepByTask[samplingId] = nextIndex; rerender() } return true }
  if (action === 'add-custom-cost') { const samplingId = node.dataset.samplingId || ''; const record = getEngineeringIndependentSamplingRecord(samplingId); if (!record) return true; syncPricingPlanDraftFromDom(samplingId); const draft = ensurePricingPlanDraft(record); draft.customCostDecision = 'HAS_CUSTOM_COST'; draft.customCosts.push({ customCostId: `${samplingId}-COST-DRAFT-${Date.now().toString(36)}`, title: '', amountIdr: 0, note: '', displayOrder: draft.customCosts.length + 1 }); refreshBuyerFormSections(); return true }
  if (action === 'remove-custom-cost') { const samplingId = node.dataset.samplingId || ''; const record = getEngineeringIndependentSamplingRecord(samplingId); if (!record) return true; syncPricingPlanDraftFromDom(samplingId); const draft = ensurePricingPlanDraft(record); const index = Number(node.dataset.costIndex); if (Number.isInteger(index)) draft.customCosts.splice(index, 1); if (!draft.customCosts.length) draft.customCostDecision = 'NO_CUSTOM_COST'; refreshBuyerFormSections(); return true }
  if (action === 'add-bom-line') { syncBomLineDraftsFromDom(); const versionId = node.dataset.versionId || ''; const firstSku = getMaterialSkuRecordById('dr_cotton_raw'); ensureBomLineDrafts(versionId).push({ bomItemId: `${versionId}-DRAFT-${Date.now().toString(36)}`, materialSkuId: firstSku?.materialSkuId || '', usage: 1, sampleQuantity: 1, usageUnit: firstSku?.pricingUnit || 'Yard', lossRate: 0, dyeRequirement: '否', printRequirement: '否', remark: '' }); refreshBuyerFormSections(); return true }
  if (action === 'remove-bom-line') { syncBomLineDraftsFromDom(); const versionId = node.dataset.versionId || ''; const index = Number(node.dataset.lineIndex); if (Number.isInteger(index)) ensureBomLineDrafts(versionId).splice(index, 1); refreshBuyerFormSections(); return true }
  if (action === 'add-sample-requirement') { const samplingId = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || ''); const record = getEngineeringIndependentSamplingRecord(samplingId); if (!record) return true; syncSampleRequirementsFromDom(samplingId); ensureSampleRequirementDrafts(record).push({ draftId: `${samplingId}-DISPLAY-REQ-DRAFT-${Date.now().toString(36)}`, targetColor: '', targetSize: '', requiredQuantity: 1, requirementNote: '' }); refreshBuyerFormSections(); return true }
  if (action === 'remove-sample-requirement') { const samplingId = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || ''); syncSampleRequirementsFromDom(samplingId); const index = Number(node.dataset.lineIndex); if (Number.isInteger(index) && ui.sampleRequirementDraftsByTask[samplingId]?.length > 1) ui.sampleRequirementDraftsByTask[samplingId].splice(index, 1); refreshBuyerFormSections(); return true }
  if ((action === 'save-draft' || action === 'confirm-scheme') && node.dataset.samplingId === NEW_TASK_ID) {
    run(() => {
      syncBomLineDraftsFromDom(); syncPricingPlanDraftFromDom(NEW_TASK_ID); syncSampleRequirementsFromDom(NEW_TASK_ID)
      if (!ui.createDraft.targetStyleId) throw new Error('请选择新款式（SPU）。')
      const created = createEngineeringIndependentSampling({ ...ui.createDraft, buyer: BUYER, createdAt: nowText(),
        creationSampleRequirements: readSampleRequirements(NEW_TASK_ID),
        materialLines: ensureBomLineDrafts(NEW_BOM_ID), customCosts: ensurePricingPlanDraft(getEngineeringIndependentSamplingRecord(NEW_TASK_ID)!).customCosts })
      navigateDesignRevision(created.samplingTaskId)
      if (action === 'confirm-scheme') {
        try { confirmEngineeringIndependentSamplingScheme({ samplingTaskId: created.samplingTaskId, actor: ADMINISTRATOR,
          selectedTaskTypes: suggestEngineeringIndependentTaskTypes(created), displaySampleAssignment: { ...DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS[0] },
          sampleRequirements: (created.creationSampleRequirements || []).map((line, index) => ({ ...line, requirementLineId: `${created.samplingTaskId}-DISPLAY-REQ-${index + 1}` })) }) } catch (error) { throw new Error(`草稿已保存，尚未提交：${error instanceof Error ? error.message : '请核对方案后重试。'}`) }
        selectCurrentSamplingStep(created.samplingTaskId)
      }
      resetCreateDraft()
    }, action === 'save-draft' ? '设计改款草稿已保存。' : '任务已提交，已按需求生成工作。')
    return true
  }
  if (action === 'save-draft') { const samplingId = node.dataset.samplingId || ''; run(() => { const record = getEngineeringIndependentSamplingRecord(samplingId); if (!record) throw new Error('任务不存在。'); saveDesignRevisionDraft(record) }, '设计改款草稿已保存。'); return true }
  if (action === 'confirm-scheme') { const samplingId = node.dataset.samplingId || ''; run(() => { let record = getEngineeringIndependentSamplingRecord(samplingId); if (!record) throw new Error('设计改款任务不存在。'); saveDesignRevisionDraft(record); record = getEngineeringIndependentSamplingRecord(samplingId); if (!record) throw new Error('设计改款任务不存在。'); confirmEngineeringIndependentSamplingScheme({ samplingTaskId: samplingId, actor: ADMINISTRATOR, selectedTaskTypes: suggestEngineeringIndependentTaskTypes(record), displaySampleAssignment: { ...DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS[0] }, sampleRequirements: readSampleRequirements(samplingId).map((draft) => ({ requirementLineId: draft.draftId, targetColor: draft.targetColor, targetSize: draft.targetSize, requiredQuantity: draft.requiredQuantity, requirementNote: draft.requirementNote })) }); delete ui.pricingPlanDraftsByTask[samplingId]; selectCurrentSamplingStep(samplingId) }, '任务已提交，基码纸样和印染加工单已按需求生成。'); return true }
  if (action === 'return-buyer-preparation') { const samplingId = node.dataset.samplingId || ''; run(() => { returnEngineeringIndependentBuyerPreparation({ samplingTaskId: samplingId, actor: ADMINISTRATOR, reason: ui.returnReasonByTask[samplingId] || value('buyerReturnReason') }); delete ui.pricingPlanDraftsByTask[samplingId]; ui.detailStepByTask[samplingId] = 0 }, '方案已重新打开。'); return true }
  if (action === 'start-task') { const found = findProfessional(node.dataset.taskId || ''); run(() => { if (!found) throw new Error('任务不存在。'); startEngineeringIndependentProfessionalTask({ taskId: found.task.taskId, actor: ADMINISTRATOR }) }, '任务已开始。'); return true }
  if (action === 'add-sample-result') { const found = findProfessional(node.dataset.taskId || ''); if (!found) return true; syncSampleResultsFromDom(found.task); const requirement = found.task.sampleRequirements?.[0]; if (!requirement) { setFeedback('尚未下达销售展示样衣制作要求。', false); rerender(); return true } (ui.sampleResultDraftsByTask[found.task.taskId] ||= []).push({ draftId: `${found.task.taskId}-DISPLAY-ACTUAL-DRAFT-${Date.now().toString(36)}`, requirementLineId: requirement.requirementLineId, title: `${requirement.targetColor} / ${requirement.targetSize} 销售展示样衣`, actualColor: requirement.targetColor, actualSize: requirement.targetSize, actualQuantity: 1, sourcePatternVersion: '', productionNote: '', differenceNote: '' }); rerender(); return true }
  if (action === 'remove-sample-result') { const found = findProfessional(node.dataset.taskId || ''); if (!found) return true; syncSampleResultsFromDom(found.task); ui.sampleResultDraftsByTask[found.task.taskId] = (ui.sampleResultDraftsByTask[found.task.taskId] || []).filter((draft) => draft.draftId !== node.dataset.draftId); rerender(); return true }
  if (action === 'submit-task') { const found = findProfessional(node.dataset.taskId || ''); run(() => { if (!found) throw new Error('任务不存在。'); const results = found.task.taskType === 'DISPLAY_SAMPLE' ? readDisplaySampleResults(found.task) : [{ title: value('resultTitle'), version: value('resultVersion'), description: value('resultDescription'), applicablePartOrSize: value('applicablePartOrSize'), sampleQuantity: Number(value('sampleQuantity')) || 0, sampleColor: value('sampleColor'), sampleSize: value('sampleSize'), sourcePatternVersion: value('sourcePatternVersion'), files: professionalFiles(found.task) }]; submitEngineeringIndependentProfessionalTask({ taskId: found.task.taskId, actor: ADMINISTRATOR, results, dyeColorCode: value('dyeColorCode') }); delete ui.sampleResultDraftsByTask[found.task.taskId]; selectCurrentSamplingStep(found.record.samplingTaskId) }, '本次工作已提交。'); return true }
  if (action === 'repair-process-orders') { const taskId = node.dataset.taskId || ''; run(() => repairEngineeringIndependentProfessionalTaskProcessOrders({ taskId, actor: ADMINISTRATOR }), '加工单关联已按当前方案重新生成。'); return true }
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
      .then((saved) => { ui.createDraft.designFiles.push(...saved); setFeedback('设计稿已读取，将随草稿或任务一起保存。'); refreshDialogs() })
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
  if (target.matches(`[data-${PREFIX}-select-task]`)) { const id = target.getAttribute(`data-${PREFIX}-select-task`) || ''; if (target instanceof HTMLInputElement && target.checked) ui.selectedTaskIds.add(id); else ui.selectedTaskIds.delete(id); const count = document.querySelector<HTMLElement>('[data-design-revision-selected-count]'); if (count) count.textContent = `已选 ${ui.selectedTaskIds.size} 条`; return true }
  if (target.matches(`[data-${PREFIX}-field="pageSize"]`)) { const controller = currentListController(); controller.setPageSize(Number(target.value)); controller.refresh(); return true }
  if (target.dataset.pcsIndependentSamplingField?.startsWith('extra:')) { ui.extraFilters[target.dataset.pcsIndependentSamplingField.slice(6)] = target.value; return true }
  if (target.matches(`[data-${PREFIX}-field="listKeyword"]`)) { ui.listKeyword = target.value; return true }
  if (target.matches(`[data-${PREFIX}-field="listStatus"]`)) { ui.listStatus = target.value; return true }
  if (target.matches(`[data-${PREFIX}-field="teamFilter"]`)) { ui.teamFilter = target.value; return true }
  if (target.matches(`[data-${PREFIX}-field="listPattern"]`)) { ui.listPattern = target.value; return true }
  if (target.matches(`[data-${PREFIX}-field="listProcessing"]`)) { ui.listProcessing = target.value; return true }
  if (target.matches(`[data-${PREFIX}-field="listStartDate"]`)) { ui.listStartDate = target.value; return true }
  if (target.matches(`[data-${PREFIX}-field="listEndDate"]`)) { ui.listEndDate = target.value; return true }
  if (target.matches(`[data-${PREFIX}-field="displayTeamFilter"]`)) { ui.displayTeamFilter = target.value; displaySampleListState.currentPage = 1; rerender(); return true }
  if (target.matches(`[data-${PREFIX}-field="sourceStyleId"]`)) { ui.createDraft.sourceStyleId = target.value; if (ui.createDraft.patternHandling === 'REUSE') ui.createDraft.reusedPatternFiles = []; const source = getStyleArchiveById(target.value); if (source && !ensureBomLineDrafts(NEW_BOM_ID).length) { const reference = listEngineeringBomHistory(source.styleCode)[0]; if (reference) { ui.bomLineDraftsByVersion[NEW_BOM_ID] = reference.materialLines.map(line => ({ ...line })); refreshMaterialPricingRegion(getEngineeringIndependentSamplingRecord(NEW_TASK_ID)!); refreshWorkPreview(getEngineeringIndependentSamplingRecord(NEW_TASK_ID)!) } } refreshDialogs(); return true }
  if (target.matches(`[data-${PREFIX}-field="targetStyleId"]`)) { ui.createDraft.targetStyleId = target.value; if (ui.createDraft.patternHandling === 'REUSE' && !ui.createDraft.sourceStyleId) ui.createDraft.reusedPatternFiles = []; refreshDialogs(); return true }
  if (target.matches(`[data-${PREFIX}-field="reusedPatternFileId"]`)) { const candidate = reusablePatternCandidates().find(({ file }) => file.fileId === target.value); ui.createDraft.reusedPatternFiles = candidate ? [{ ...candidate.file }] : []; refreshDialogs(); return true }
  if (target.matches(`[data-${PREFIX}-field="targetMode"]`)) { ui.createDraft.targetMode = target.value as 'ARCHIVED_STYLE' | 'TEMPORARY_SPU'; ui.createDraft.targetStyleId = ''; ui.createDraft.temporarySpuName = ''; refreshDialogs(); return true }
  if (target.matches(`[data-${PREFIX}-field="temporarySpuName"]`)) { ui.createDraft.temporarySpuName = target.value; return true }
  if (target.matches(`[data-${PREFIX}-field="patternHandling"]`)) { ui.createDraft.patternHandling = target.value as 'REUSE' | 'REMAKE'; if (ui.createDraft.patternHandling === 'REMAKE') ui.createDraft.reusedPatternFiles = []; refreshDialogs(); refreshWorkPreview(getEngineeringIndependentSamplingRecord(NEW_TASK_ID)!); return true }
  if (target.matches(`[data-${PREFIX}-field="creationReason"]`)) { ui.createDraft.creationReason = target.value; return true }
  if (target.matches(`[data-${PREFIX}-field="buyerReturnReason"]`)) { const samplingId = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || ''); ui.returnReasonByTask[samplingId] = target.value; return true }
  if (target.matches(`[data-${PREFIX}-field="customCostTitle"], [data-${PREFIX}-field="customCostAmount"], [data-${PREFIX}-field="customCostNote"]`)) { const samplingId = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || ''); const record = getEngineeringIndependentSamplingRecord(samplingId); syncPricingPlanDraftFromDom(samplingId); if (record) refreshMaterialPricingSummary(record); return true }
  if (target.closest('[data-independent-bom-line]')) { const samplingId = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || ''); const record = getEngineeringIndependentSamplingRecord(samplingId); syncBomLineDraftsFromDom(); if (record && target.matches(`[data-${PREFIX}-field="bomMaterialSkuId"]`)) { const row = target.closest<HTMLElement>('[data-independent-bom-line]'); const version = row?.closest<HTMLElement>('[data-independent-bom-version]'); const sku = getMaterialSkuRecordById(target.value); const draftLine = version ? ensureBomLineDrafts(version.dataset.independentBomVersion || '').find((line) => line.bomItemId === row?.dataset.independentBomLine) : null; if (sku && draftLine) draftLine.usageUnit = sku.pricingUnit; refreshMaterialPricingRegion(record) } else if (record && target.matches(`[data-${PREFIX}-field="bomQuantityBasis"]`)) refreshMaterialPricingRegion(record); else if (record && target.matches(`[data-${PREFIX}-field="bomUsage"], [data-${PREFIX}-field="bomUsageUnit"]`)) refreshBomComputedValues(record); else if (record) refreshMaterialPricingSummary(record); if (record) refreshWorkPreview(record); return true }
  if (target.closest('[data-sample-requirement-row]')) { const samplingId = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || ''); syncSampleRequirementsFromDom(samplingId); const record = getEngineeringIndependentSamplingRecord(samplingId); if (record) { refreshBomComputedValues(record); refreshWorkPreview(record) } return true }
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

export function isPcsIndependentSamplingDialogOpen(): boolean { return Boolean(ui.preview) }
