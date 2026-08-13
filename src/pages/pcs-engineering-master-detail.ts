// @page-pattern: detail

// 工程主单详情：按任务逐行展示的执行表格。
// 表格只展示业务执行所需的团队、动作、先后关系、去向、计划/实际与状态。

import {
  ENGINEERING_LANES,
  ENGINEERING_PHASES,
  buildEngineeringMasterDetailModel,
  type EngineeringMasterDetailModel,
  type EngineeringTaskCardModel,
} from '../data/pcs-engineering-master-view-model.ts'
import {
  closeEngineeringMasterOrder,
  confirmEngineeringMasterBomPricingPlan,
  confirmEngineeringMasterTaskPlan,
  getEngineeringMasterOrderById,
  validateEngineeringMasterOrderClose,
  type EngineeringMasterPriorResultDecisionInput,
} from '../data/pcs-engineering-master-repository.ts'
import type {
  EngineeringMasterStatus,
  EngineeringPreparationType,
  EngineeringTaskStatus,
  EngineeringTaskType,
} from '../data/pcs-engineering-master-types.ts'
import { engineeringTaskHref } from '../data/pcs-engineering-preparation-projection.ts'
import { listSkuArchivesByStyleId } from '../data/pcs-sku-archive-repository.ts'
import { escapeHtml } from '../utils.ts'

const DETAIL_EVENT_PREFIX = 'pcs-engineering-master'

// 原型尚无统一登录态；详情页把当前主单跟单解析为当前演示操作者。
// 渲染权限与事件提交必须始终经由同一解析函数，避免身份文案与领域入参漂移。
export function resolveEngineeringMasterDemoOperatorName(
  model: Pick<EngineeringMasterDetailModel, 'merchandiserName'>,
): string {
  return model.merchandiserName.trim()
}

const MASTER_STATUS_TONES: Record<EngineeringMasterStatus, string> = {
  草稿: 'bg-slate-100 text-slate-700',
  已发布: 'bg-blue-100 text-blue-700',
  进行中: 'bg-amber-100 text-amber-700',
  技术包审核中: 'bg-purple-100 text-purple-700',
  待关闭: 'bg-orange-100 text-orange-700',
  已关闭: 'bg-emerald-100 text-emerald-700',
  已终止: 'bg-red-100 text-red-700',
}

const TASK_STATUS_TONES: Record<EngineeringTaskStatus, string> = {
  未启用: 'bg-slate-100 text-slate-500',
  待前置: 'bg-slate-100 text-slate-600',
  待开始: 'bg-white text-slate-700 border border-slate-200',
  进行中: 'bg-blue-100 text-blue-700',
  待审核: 'bg-purple-100 text-purple-700',
  返工中: 'bg-amber-100 text-amber-700',
  已完成: 'bg-emerald-100 text-emerald-700',
  因需求变更结束: 'bg-slate-200 text-slate-600',
}

interface DetailUiState {
  imagePreviewUrl: string
  imagePreviewTitle: string
  taskPlanMasterId: string
  selectedPreparationType: EngineeringPreparationType | ''
  selectedConditionalTaskTypes: EngineeringTaskType[]
  taskPlanError: string
  preProductionSampleRequirements: Array<{ draftId: string; targetColor: string; targetSize: string; requiredQuantity: number; requirementNote: string }>
  priorResultSelections: Record<string, {
    sourceSamplingTaskId: string
    sourceProfessionalTaskId: string
    sourceResultVersion: string
    decision: '' | '复用' | '重新执行' | '不采用'
  }>
}

const detailUiState: DetailUiState = {
  imagePreviewUrl: '',
  imagePreviewTitle: '',
  taskPlanMasterId: '',
  selectedPreparationType: '',
  selectedConditionalTaskTypes: [],
  taskPlanError: '',
  preProductionSampleRequirements: [],
  priorResultSelections: {},
}

function renderStatusBadge(status: EngineeringMasterStatus): string {
  const tone = MASTER_STATUS_TONES[status] ?? 'bg-slate-100 text-slate-700'
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tone}">${escapeHtml(status)}</span>`
}

function renderTaskStatusBadge(status: EngineeringTaskStatus): string {
  const tone = TASK_STATUS_TONES[status] ?? 'bg-slate-100 text-slate-600'
  return `<span class="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${tone}">${escapeHtml(status)}</span>`
}

// ============ 头部 ============

function renderMasterHeader(model: EngineeringMasterDetailModel): string {
  const operatorName = resolveEngineeringMasterDemoOperatorName(model)
  let canClose = operatorName === model.merchandiserName
  if (canClose) {
    try {
      validateEngineeringMasterOrderClose(model.masterOrderId)
    } catch {
      canClose = false
    }
  }
  return `
    <header class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
      <div class="flex flex-wrap items-center gap-3">
        ${model.styleImageUrl ? `
          <button
            type="button"
            class="group block h-14 w-11 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50"
            data-${DETAIL_EVENT_PREFIX}-action="open-style-image-preview"
            data-image-url="${escapeHtml(model.styleImageUrl)}"
            data-image-title="${escapeHtml(model.styleName)}"
            aria-label="查看${escapeHtml(model.styleName)}大图"
          >
            <img src="${escapeHtml(model.styleImageUrl)}" alt="${escapeHtml(model.styleName)}" class="h-full w-full object-cover transition-transform group-hover:scale-105" />
          </button>
        ` : ''}
        <h1 class="text-lg font-semibold">${escapeHtml(model.masterOrderCode)}</h1>
        ${renderStatusBadge(model.status)}
        <span class="text-sm text-slate-500">${escapeHtml(model.styleName)}（${escapeHtml(model.styleCode)}）</span>
      </div>
      <div class="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>跟单：${escapeHtml(model.merchandiserName)}</span>
        <span>创建：${escapeHtml(model.createdBy)} · ${escapeHtml(model.createdAt)}</span>
        ${model.publishedAt ? `<span>发布：${escapeHtml(model.publishedAt)}</span>` : ''}
        ${canClose ? `
          <button
            type="button"
            class="inline-flex h-8 items-center justify-center rounded-md bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800"
            data-${DETAIL_EVENT_PREFIX}-action="close-master-order"
          >关闭工程主单</button>
        ` : ''}
      </div>
    </header>
  `
}

function renderStyleImagePreview(): string {
  if (!detailUiState.imagePreviewUrl) return ''
  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center px-4 py-6" role="dialog" aria-modal="true" aria-label="款式大图预览">
      <button type="button" class="absolute inset-0 bg-slate-950/70" data-${DETAIL_EVENT_PREFIX}-action="close-style-image-preview" aria-label="关闭款式大图预览"></button>
      <section class="relative z-10 flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <header class="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <h2 class="truncate text-base font-semibold text-slate-900">${escapeHtml(detailUiState.imagePreviewTitle || '款式图片')}</h2>
          <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50" data-${DETAIL_EVENT_PREFIX}-action="close-style-image-preview" aria-label="关闭款式大图预览">×</button>
        </header>
        <div class="overflow-auto bg-slate-100 p-5">
          <img src="${escapeHtml(detailUiState.imagePreviewUrl)}" alt="${escapeHtml(detailUiState.imagePreviewTitle || '款式图片')}" class="mx-auto max-h-[80vh] w-auto max-w-full rounded-lg border border-slate-200 bg-white object-contain shadow-sm" />
        </div>
      </section>
    </div>
  `
}

// ============ 前期输入区 ============

function renderPriorReuseRegion(model: EngineeringMasterDetailModel): string {
  if (model.priorResultReuseLines.length === 0) return ''
  return `
    <section class="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3" data-engineering-master-prior-region>
      <h2 class="mb-2 text-sm font-semibold text-slate-700">前期输入</h2>
      <div class="flex flex-wrap gap-2">
        ${model.priorResultReuseLines.map((line) => `
          <div class="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600" data-prior-reuse-card>
            <p class="font-medium text-slate-800">${escapeHtml(line.resultLabel)}</p>
            <p class="mt-0.5">${escapeHtml(line.sourceSamplingTaskCode || line.sourceTaskLabel)} · ${escapeHtml(line.sourceResultVersion || '未标版本')} · ${escapeHtml(line.decision)}</p>
            <p class="mt-0.5 text-slate-400">${escapeHtml(line.confirmedBy)} · ${escapeHtml(line.confirmedAt)}</p>
          </div>
        `).join('')}
      </div>
    </section>
  `
}

const PREPARATION_TYPE_OPTIONS: Array<{ value: EngineeringPreparationType; label: string }> = [
  { value: 'PURE_WOVEN', label: '纯梭织' },
  { value: 'HEAT_TRANSFER_DIRECT_PRINT', label: '烫画／直喷' },
  { value: 'KNIT', label: '毛织' },
  { value: 'KNIT_WOVEN', label: '毛织＋梭织' },
]

function applyTaskPlanState(model: EngineeringMasterDetailModel): void {
  detailUiState.selectedPreparationType = model.preparationType
  detailUiState.selectedConditionalTaskTypes = model.taskPlanSuggestions
    .filter((item) => !item.required && !item.notApplicable && item.suggestedSelected)
    .map((item) => item.taskType)
  detailUiState.taskPlanError = ''
  const master = getEngineeringMasterOrderById(model.masterOrderId)
  const seen = new Set<string>()
  detailUiState.preProductionSampleRequirements = master
    ? listSkuArchivesByStyleId(master.styleId)
      .filter((sku) => sku.archiveStatus === 'ACTIVE')
      .filter((sku) => {
        const key = `${sku.colorName}\u0000${sku.sizeName}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map((sku, index) => ({
        draftId: `${model.masterOrderId}-PRE-SAMPLE-REQ-DRAFT-${index + 1}`,
        targetColor: sku.colorName,
        targetSize: sku.sizeName,
        requiredQuantity: 1,
        requirementNote: '',
      }))
    : []
  detailUiState.priorResultSelections = Object.fromEntries(model.priorResultCandidateGroups.map((group) => {
    const recommended = group.candidates.find((candidate) => candidate.recommended) || group.candidates[0]
    return [group.engineeringTaskType, {
      sourceSamplingTaskId: recommended?.sourceSamplingTaskId || '',
      sourceProfessionalTaskId: recommended?.sourceProfessionalTaskId || '',
      sourceResultVersion: recommended?.sourceResultVersion || '',
      decision: '',
    }]
  }))
}

function ensureTaskPlanState(model: EngineeringMasterDetailModel): void {
  if (detailUiState.taskPlanMasterId === model.masterOrderId) return
  detailUiState.taskPlanMasterId = model.masterOrderId
  applyTaskPlanState(model)
}

function renderPriorResultChoices(model: EngineeringMasterDetailModel): string {
  if (model.priorResultCandidateGroups.length === 0) return ''
  return `
    <section class="border-b bg-blue-50/30 px-4 py-3" data-prior-result-plan>
      <div class="mb-3 flex items-center justify-between gap-3">
        <div><h3 class="text-sm font-semibold text-slate-800">前期成果</h3><p class="mt-0.5 text-xs text-slate-500">默认推荐最近确认版本，可改选历史版本；每项选择复用、重新执行或不采用。</p></div>
      </div>
      <div class="space-y-2">
        ${model.priorResultCandidateGroups.map((group) => {
          const selection = detailUiState.priorResultSelections[group.engineeringTaskType]
          return `
            <div class="grid grid-cols-[minmax(140px,.7fr)_minmax(260px,1.5fr)_minmax(150px,.7fr)] items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2">
              <span class="text-sm font-medium text-slate-800">${escapeHtml(group.taskName)}</span>
              <select class="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm" data-${DETAIL_EVENT_PREFIX}-action="select-prior-result-version" data-task-type="${escapeHtml(group.engineeringTaskType)}">
                ${group.candidates.map((candidate) => `<option value="${escapeHtml(candidate.sourceProfessionalTaskId)}" ${selection?.sourceProfessionalTaskId === candidate.sourceProfessionalTaskId ? 'selected' : ''}>${escapeHtml(candidate.sourceSamplingTaskCode)} · ${escapeHtml(candidate.sourceResultVersion)} · ${escapeHtml(candidate.confirmedAt)}${candidate.recommended ? '（推荐）' : ''}</option>`).join('')}
              </select>
              <select class="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm" data-${DETAIL_EVENT_PREFIX}-action="select-prior-result-decision" data-task-type="${escapeHtml(group.engineeringTaskType)}">
                <option value="" ${!selection?.decision ? 'selected' : ''}>请选择</option>
                <option value="复用" ${selection?.decision === '复用' ? 'selected' : ''}>复用</option>
                <option value="重新执行" ${selection?.decision === '重新执行' ? 'selected' : ''}>重新执行</option>
                <option value="不采用" ${selection?.decision === '不采用' ? 'selected' : ''}>不采用</option>
              </select>
            </div>
          `
        }).join('')}
      </div>
    </section>
  `
}

function syncPreProductionSampleRequirementsFromDom(): void {
  const rows = [...document.querySelectorAll<HTMLElement>('[data-pre-production-requirement-row]')]
  if (!rows.length) return
  detailUiState.preProductionSampleRequirements = rows.map((row, index) => ({
    draftId: row.dataset.preProductionRequirementRow || `${detailUiState.taskPlanMasterId}-PRE-SAMPLE-REQ-DRAFT-${index + 1}`,
    targetColor: row.querySelector<HTMLSelectElement>('[data-pre-production-requirement-field="color"]')?.value.trim() || '',
    targetSize: row.querySelector<HTMLSelectElement>('[data-pre-production-requirement-field="size"]')?.value.trim() || '',
    requiredQuantity: Number(row.querySelector<HTMLInputElement>('[data-pre-production-requirement-field="quantity"]')?.value || 0),
    requirementNote: row.querySelector<HTMLInputElement>('[data-pre-production-requirement-field="note"]')?.value.trim() || '',
  }))
}

function renderPreProductionSampleRequirementEditor(model: EngineeringMasterDetailModel): string {
  const master = getEngineeringMasterOrderById(model.masterOrderId)
  const skus = master ? listSkuArchivesByStyleId(master.styleId).filter((sku) => sku.archiveStatus === 'ACTIVE') : []
  const colors = [...new Set(skus.map((sku) => sku.colorName).filter(Boolean))]
  const sizes = [...new Set(skus.map((sku) => sku.sizeName).filter(Boolean))]
  return `<section class="border-t bg-blue-50/20 px-4 py-4"><div class="flex flex-wrap items-start justify-between gap-3"><div><h3 class="text-sm font-semibold text-slate-800">产前版样衣制作要求</h3><p class="mt-1 text-xs text-slate-500">跟单在生成任务前按颜色和尺码下达要求数量；制作团队进入任务后填写实际交付。</p></div><button type="button" class="rounded-md border bg-white px-3 py-2 text-sm" data-${DETAIL_EVENT_PREFIX}-action="add-pre-production-requirement">新增一行</button></div><div class="mt-3 overflow-x-auto rounded-md border bg-white"><table class="w-full min-w-[820px] text-sm"><thead><tr class="border-b bg-slate-50 text-left"><th class="p-3">颜色</th><th class="p-3">尺码</th><th class="p-3">要求数量</th><th class="p-3">制作要求</th><th class="p-3 text-right">操作</th></tr></thead><tbody>${detailUiState.preProductionSampleRequirements.map((line) => `<tr class="border-b" data-pre-production-requirement-row="${escapeHtml(line.draftId)}"><td class="p-3"><select class="h-9 min-w-36 rounded border px-2" data-pre-production-requirement-field="color">${colors.map((color) => `<option ${color === line.targetColor ? 'selected' : ''}>${escapeHtml(color)}</option>`).join('')}</select></td><td class="p-3"><select class="h-9 min-w-28 rounded border px-2" data-pre-production-requirement-field="size">${sizes.map((size) => `<option ${size === line.targetSize ? 'selected' : ''}>${escapeHtml(size)}</option>`).join('')}</select></td><td class="p-3"><input type="number" min="1" step="1" class="h-9 w-24 rounded border px-2" data-pre-production-requirement-field="quantity" value="${line.requiredQuantity}"></td><td class="p-3"><input class="h-9 min-w-64 rounded border px-2" data-pre-production-requirement-field="note" value="${escapeHtml(line.requirementNote)}" placeholder="可填写面辅料、工艺或制作注意事项"></td><td class="p-3 text-right"><button type="button" class="text-red-600" data-${DETAIL_EVENT_PREFIX}-action="remove-pre-production-requirement" data-draft-id="${escapeHtml(line.draftId)}">删除</button></td></tr>`).join('') || '<tr><td colspan="5" class="p-6 text-center text-red-600">请至少新增一行产前版样衣制作要求</td></tr>'}</tbody></table></div></section>`
}

function renderTaskPlanConfirmation(model: EngineeringMasterDetailModel): string {
  const selected = new Set(detailUiState.selectedConditionalTaskTypes)
  const selectableSuggestions = model.taskPlanSuggestions.filter((item) => !item.notApplicable)
  const selectedCount = selectableSuggestions.filter((item) => item.required || selected.has(item.taskType)).length
  const hasPreparationType = Boolean(detailUiState.selectedPreparationType)
  return `
    <section class="overflow-hidden rounded-lg border bg-card" data-engineering-task-plan-confirmation>
      <header class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-base font-semibold text-slate-900">本次工作安排确认</h2>
            <span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">建议安排</span>
          </div>
          <p class="mt-1 text-xs text-slate-500">由跟单确认本次需要完成的工作；工作先后顺序按已确认规则自动带出。</p>
        </div>
        <div class="text-sm text-slate-600">${hasPreparationType ? `已选 ${selectedCount}/${selectableSuggestions.length} 项` : '待选择准备类型'}</div>
      </header>
      ${detailUiState.taskPlanError ? `<div class="mx-4 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${escapeHtml(detailUiState.taskPlanError)}</div>` : ''}
      <div class="border-b bg-slate-50/60 px-4 py-3">
        <label class="block max-w-sm text-sm font-medium text-slate-800">生产准备类型 <span class="text-red-500">*</span>
          <select
            class="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            data-${DETAIL_EVENT_PREFIX}-action="select-preparation-type"
          >
            <option value="">请选择生产准备类型</option>
            ${PREPARATION_TYPE_OPTIONS.map((option) => `<option value="${option.value}" ${detailUiState.selectedPreparationType === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}
          </select>
        </label>
        <p class="mt-1 text-xs text-slate-500">系统根据已确认类型生成固定任务和依赖，不按款式名称猜测。</p>
      </div>
      ${renderPriorResultChoices(model)}
      ${hasPreparationType ? `<div class="divide-y">
        ${model.taskPlanSuggestions.map((item) => {
          const checked = !item.notApplicable && (item.required || selected.has(item.taskType))
          return `
            <label class="grid grid-cols-[28px_minmax(180px,1.2fr)_minmax(120px,.7fr)_minmax(180px,1fr)_minmax(220px,1.4fr)] items-center gap-3 px-4 py-3 text-sm ${item.required ? 'bg-slate-50/60' : item.notApplicable ? 'bg-slate-50/40 text-slate-400' : 'hover:bg-blue-50/40'}">
              <input
                type="checkbox"
                class="h-4 w-4 rounded border-slate-300 text-blue-600"
                data-${DETAIL_EVENT_PREFIX}-action="toggle-task-plan-type"
                data-task-type="${escapeHtml(item.taskType)}"
                ${checked ? 'checked' : ''}
                ${item.required || item.notApplicable ? 'disabled' : ''}
              />
              <span class="font-medium text-slate-900">${escapeHtml(item.taskName)}</span>
              <span class="text-slate-600">${escapeHtml(item.ownerTeamName)}</span>
              <span class="text-xs text-slate-500">需要先完成：${escapeHtml(item.dependencyText)}</span>
              <span class="flex items-center gap-2 text-xs">
                <span class="rounded-full px-2 py-0.5 ${item.required ? 'bg-slate-200 text-slate-700' : item.notApplicable ? 'bg-slate-100 text-slate-500' : item.suggestedSelected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">${item.required ? '必做' : item.notApplicable ? '不适用' : item.suggestedSelected ? '建议启用' : '按需启用'}</span>
                <span class="text-slate-500">${escapeHtml(item.suggestionReason)}</span>
              </span>
            </label>
          `
        }).join('')}
      </div>${renderPreProductionSampleRequirementEditor(model)}` : `<div class="px-4 py-8 text-center text-sm text-slate-500">选择生产准备类型后，系统将展示必做任务、条件任务和固定前置。</div>`}
      <footer class="flex flex-wrap items-center justify-between gap-3 border-t bg-slate-50 px-4 py-3">
        <p class="text-xs text-slate-500">确认后生成固定任务；条件任务根据当前工程 BOM 与价格方案自动启用。</p>
        <button
          type="button"
          class="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          data-${DETAIL_EVENT_PREFIX}-action="confirm-task-plan"
          ${hasPreparationType ? '' : 'disabled'}
        >确认并生成任务</button>
      </footer>
    </section>
  `
}

function renderBomSummary(model: EngineeringMasterDetailModel): string {
  const summary = model.bomSummary
  const conditionLabels = [
    summary.conditions.hasPrintRequirement ? '印花' : '',
    summary.conditions.hasYarnDyeRequirement ? '纱线染色' : '',
    summary.conditions.hasFabricDyeRequirement ? '面料染色' : '',
    summary.conditions.hasAccessoryPurchaseRequirement ? '辅料采购' : '',
  ].filter(Boolean)
  return `<section class="rounded-lg border bg-card p-4" data-engineering-bom-summary>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div><div class="flex items-center gap-2"><h2 class="font-semibold">工程 BOM 与价格</h2><span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs">${escapeHtml(summary.statusText)}</span></div><p class="mt-1 text-xs text-slate-500">${escapeHtml(summary.versionCodes.join('、') || '随工程主单自动建立')}</p></div>
      <div class="flex flex-wrap items-center gap-2">
        <a class="rounded border px-3 py-2 text-sm text-blue-700" href="${summary.pricingPlanId ? `/pcs/technical-data/bom-pricing/owner/ENGINEERING_MASTER/${escapeHtml(model.masterOrderId)}` : '/pcs/technical-data/bom-pricing'}">${summary.pricingPlanId ? '查看／维护整款方案' : '查看 BOM 列表'}</a>
        ${summary.planStatus === 'DRAFT' ? `<button type="button" class="rounded bg-blue-600 px-3 py-2 text-sm text-white" data-${DETAIL_EVENT_PREFIX}-action="confirm-bom-pricing-plan">确认工程 BOM 与价格</button>` : ''}
      </div>
    </div>
    <div class="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-5">
      <div><p class="text-xs text-slate-500">颜色版本</p><p class="mt-1 font-medium">${summary.colorCount} 个</p></div>
      <div><p class="text-xs text-slate-500">物料行</p><p class="mt-1 font-medium">${summary.materialLineCount} 行</p></div>
      <div><p class="text-xs text-slate-500">承接来源</p><p class="mt-1 font-medium">${summary.sourceVersionCount ? `${summary.sourceVersionCount} 个前期颜色方案` : '空白创建'}</p></div>
      <div><p class="text-xs text-slate-500">条件要求</p><p class="mt-1 font-medium">${escapeHtml(conditionLabels.join('、') || '暂无')}</p></div>
      <div><p class="text-xs text-slate-500">整款费用</p><p class="mt-1 font-medium">${escapeHtml(summary.customCostDecisionText)}</p></div>
      <div><p class="text-xs text-slate-500">买手／更新</p><p class="mt-1 font-medium">${escapeHtml(summary.buyerName)}</p><p class="text-xs text-slate-500">${escapeHtml(summary.updatedAt)}</p></div>
    </div>
  </section>`
}

// ============ 任务表格 ============

function renderTaskNameButton(task: EngineeringTaskCardModel): string {
  const dependsOnIdsAttr = task.dependsOnTaskIds.length > 0
    ? ` data-depends-on-ids="${escapeHtml(task.dependsOnTaskIds.join(' '))}"`
    : ''
  const requiredByIdsAttr = task.requiredByTaskIds.length > 0
    ? ` data-required-by-ids="${escapeHtml(task.requiredByTaskIds.join(' '))}"`
    : ''
  return `
    <button
      type="button"
      class="rounded px-1 py-0.5 text-left text-sm font-medium text-blue-700 hover:bg-blue-50 hover:text-blue-800"
      data-engineering-task-card
      data-task-id="${escapeHtml(task.taskId)}"
      data-nav="${escapeHtml(engineeringTaskHref(task.taskType, task.taskId))}"
      ${dependsOnIdsAttr}
      ${requiredByIdsAttr}
      aria-label="查看任务：${escapeHtml(task.taskName)}"
    >${escapeHtml(task.taskName)}</button>
  `
}

function renderTaskTable(model: EngineeringMasterDetailModel): string {
  const rows = ENGINEERING_PHASES.flatMap((phase) =>
    model.lanes.flatMap((lane) =>
      lane.tasks
        .filter((task) => phase.taskTypes.includes(task.taskType))
        .map((task) => ({ task, phaseName: phase.phaseName, laneName: lane.laneName })),
    ),
  )
  return `
    <section class="overflow-hidden rounded-lg border bg-card" data-engineering-task-table>
      <header class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div><h2 class="text-base font-semibold text-slate-900">工程任务</h2><p class="mt-0.5 text-xs text-slate-500">共 ${rows.length} 项，按执行阶段排列</p></div>
        <p class="text-xs text-slate-500">并行工作分行展示；完成后由系统自动交给下一团队</p>
      </header>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1320px] border-collapse text-sm">
          <thead class="bg-slate-50 text-left text-xs font-medium text-slate-500">
            <tr><th class="w-12 px-3 py-3 text-center">序号</th><th class="min-w-44 px-3 py-3">任务</th><th class="min-w-28 px-3 py-3">阶段</th><th class="min-w-32 px-3 py-3">当前处理团队</th><th class="min-w-52 px-3 py-3">当前动作</th><th class="min-w-44 px-3 py-3">需要先完成</th><th class="min-w-56 px-3 py-3">完成后去向</th><th class="min-w-44 px-3 py-3">计划／实际</th><th class="min-w-24 px-3 py-3">状态</th></tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${rows.map(({ task, phaseName }, index) => `<tr class="align-top hover:bg-slate-50/70" data-engineering-task-row="${escapeHtml(task.taskId)}"><td class="px-3 py-3 text-center text-slate-400">${index + 1}</td><td class="px-3 py-3">${renderTaskNameButton(task)}</td><td class="px-3 py-3 text-slate-600">${escapeHtml(phaseName)}</td><td class="px-3 py-3 font-medium text-slate-700">${escapeHtml(task.currentTeamName)}</td><td class="px-3 py-3 text-slate-700">${escapeHtml(task.currentActionText)}</td><td class="px-3 py-3 text-slate-600">${escapeHtml(task.dependsOnLabels.join('、') || '无')}</td><td class="px-3 py-3 text-slate-600">${escapeHtml(task.completionDestinationText)}</td><td class="px-3 py-3 text-xs text-slate-600"><p>${escapeHtml(task.plannedTimeText)}</p><p class="mt-1">${escapeHtml(task.actualTimeText)}</p></td><td class="px-3 py-3">${renderTaskStatusBadge(task.status)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

// ============ 页面组装 ============

export function renderPcsEngineeringMasterDetailPage(key: string): string {
  let model = buildEngineeringMasterDetailModel(key)
  if (!model) {
    return '<div class="p-6 text-sm text-slate-500">未找到工程主单。</div>'
  }
  ensureTaskPlanState(model)
  if (model.status === '草稿' && detailUiState.selectedPreparationType && model.preparationType !== detailUiState.selectedPreparationType) {
    model = buildEngineeringMasterDetailModel(key, detailUiState.selectedPreparationType) || model
  }

  return `
    <div class="min-w-0 max-w-full space-y-3 p-4" data-pcs-engineering-master-detail-page>
      <div data-engineering-master-region="header">${withDetailLocalInteractions(renderMasterHeader(model))}</div>
      <div data-engineering-master-region="feedback"></div>
      <div data-engineering-master-region="bom">${renderBomSummary(model)}</div>
      ${renderPriorReuseRegion(model)}
      <div data-engineering-master-region="lanes">${withDetailLocalInteractions(model.status === '草稿' ? renderTaskPlanConfirmation(model) : renderTaskTable(model))}</div>
      <div data-engineering-master-region="image-preview">${withDetailLocalInteractions(renderStyleImagePreview())}</div>
    </div>
  `
}

// ============ 局部交互 ============

function withDetailLocalInteractions(html: string): string {
  const actionPattern = new RegExp(`data-${DETAIL_EVENT_PREFIX}-action="([^"]+)"`, 'g')
  return html.replace(actionPattern, (attribute) =>
    `data-skip-page-rerender="true" ${attribute}`)
}

function refreshLanesRegion(model: EngineeringMasterDetailModel): void {
  if (typeof document === 'undefined') return
  const lanesHost = document.querySelector<HTMLElement>('[data-engineering-master-region="lanes"]')
  if (!lanesHost) return
  lanesHost.innerHTML = withDetailLocalInteractions(
    model.status === '草稿' ? renderTaskPlanConfirmation(model) : renderTaskTable(model),
  )
  void import('../components/shell.ts')
    .then(({ hydrateIcons }) => hydrateIcons(lanesHost))
    .catch(() => undefined)
}

function refreshMasterHeader(model: EngineeringMasterDetailModel): void {
  if (typeof document === 'undefined') return
  const headerHost = document.querySelector<HTMLElement>('[data-engineering-master-region="header"]')
  if (!headerHost) return
  headerHost.innerHTML = withDetailLocalInteractions(renderMasterHeader(model))
}

function refreshStyleImagePreview(): void {
  if (typeof document === 'undefined') return
  const previewHost = document.querySelector<HTMLElement>('[data-engineering-master-region="image-preview"]')
  if (!previewHost) return
  previewHost.innerHTML = withDetailLocalInteractions(renderStyleImagePreview())
}

function showDetailFeedback(message: string, ok: boolean): void {
  if (typeof document === 'undefined') return
  const feedbackHost = document.querySelector<HTMLElement>('[data-engineering-master-region="feedback"]')
  if (!feedbackHost) return
  feedbackHost.innerHTML = `
    <section class="rounded-lg border px-4 py-2.5 text-sm ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}">
      ${escapeHtml(message)}
    </section>
  `
}

export function handlePcsEngineeringMasterDetailEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>(`[data-${DETAIL_EVENT_PREFIX}-action]`)
  if (!actionNode) return false
  const action = actionNode.dataset.pcsEngineeringMasterAction
  if (!action) return false

  if (action === 'open-style-image-preview') {
    detailUiState.imagePreviewUrl = actionNode.dataset.imageUrl || ''
    detailUiState.imagePreviewTitle = actionNode.dataset.imageTitle || '款式图片'
    refreshStyleImagePreview()
    return true
  }
  if (action === 'close-style-image-preview') {
    detailUiState.imagePreviewUrl = ''
    detailUiState.imagePreviewTitle = ''
    refreshStyleImagePreview()
    return true
  }
  if (action === 'toggle-task-plan-type') {
    const taskType = actionNode.dataset.taskType as EngineeringTaskType
    const checked = Boolean((actionNode as HTMLInputElement).checked)
    const selected = new Set(detailUiState.selectedConditionalTaskTypes)
    if (checked) selected.add(taskType)
    else selected.delete(taskType)
    detailUiState.selectedConditionalTaskTypes = [...selected]
    detailUiState.taskPlanError = ''
    return true
  }
  if (action === 'select-preparation-type') {
    const preparationType = (actionNode as HTMLSelectElement).value as EngineeringPreparationType | ''
    detailUiState.selectedPreparationType = preparationType
    detailUiState.taskPlanError = ''
    const model = buildEngineeringMasterDetailModel(currentMasterKey(), preparationType)
    if (model) {
      applyTaskPlanState(model)
      refreshLanesRegion(model)
    }
    return true
  }
  if (action === 'select-prior-result-version') {
    const model = buildEngineeringMasterDetailModel(currentMasterKey(), detailUiState.selectedPreparationType)
    const taskType = actionNode.dataset.taskType as EngineeringTaskType
    const candidate = model?.priorResultCandidateGroups
      .find((group) => group.engineeringTaskType === taskType)?.candidates
      .find((item) => item.sourceProfessionalTaskId === (actionNode as HTMLSelectElement).value)
    if (candidate) {
      const previous = detailUiState.priorResultSelections[taskType]
      detailUiState.priorResultSelections[taskType] = {
        sourceSamplingTaskId: candidate.sourceSamplingTaskId,
        sourceProfessionalTaskId: candidate.sourceProfessionalTaskId,
        sourceResultVersion: candidate.sourceResultVersion,
        decision: previous?.decision || '',
      }
    }
    detailUiState.taskPlanError = ''
    return true
  }
  if (action === 'select-prior-result-decision') {
    const taskType = actionNode.dataset.taskType as EngineeringTaskType
    const selection = detailUiState.priorResultSelections[taskType]
    if (selection) selection.decision = (actionNode as HTMLSelectElement).value as typeof selection.decision
    detailUiState.taskPlanError = ''
    return true
  }
  if (action === 'add-pre-production-requirement') {
    syncPreProductionSampleRequirementsFromDom()
    const master = getEngineeringMasterOrderById(currentMasterKey())
    const firstSku = master ? listSkuArchivesByStyleId(master.styleId).find((sku) => sku.archiveStatus === 'ACTIVE') : undefined
    detailUiState.preProductionSampleRequirements.push({
      draftId: `${currentMasterKey()}-PRE-SAMPLE-REQ-DRAFT-${Date.now().toString(36)}`,
      targetColor: firstSku?.colorName || '',
      targetSize: firstSku?.sizeName || '',
      requiredQuantity: 1,
      requirementNote: '',
    })
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('higood:request-render'))
    return true
  }
  if (action === 'remove-pre-production-requirement') {
    syncPreProductionSampleRequirementsFromDom()
    detailUiState.preProductionSampleRequirements = detailUiState.preProductionSampleRequirements.filter((line) => line.draftId !== actionNode.dataset.draftId)
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('higood:request-render'))
    return true
  }
  if (action === 'confirm-task-plan') {
    const masterKey = currentMasterKey()
    const model = buildEngineeringMasterDetailModel(masterKey, detailUiState.selectedPreparationType)
    if (!model) return true
    try {
      const master = getEngineeringMasterOrderById(masterKey)
      if (!master) throw new Error('工程主单不存在。')
      const priorResultDecisions: EngineeringMasterPriorResultDecisionInput[] = model.priorResultCandidateGroups.map((group) => {
        const selection = detailUiState.priorResultSelections[group.engineeringTaskType]
        if (!selection?.decision) throw new Error(`请选择${group.taskName}成果的复用方式。`)
        return {
          engineeringTaskType: group.engineeringTaskType,
          sourceSamplingTaskId: selection.sourceSamplingTaskId,
          sourceProfessionalTaskId: selection.sourceProfessionalTaskId,
          sourceResultVersion: selection.sourceResultVersion,
          decision: selection.decision,
        }
      })
      syncPreProductionSampleRequirementsFromDom()
      confirmEngineeringMasterTaskPlan(masterKey, {
        confirmedBy: resolveEngineeringMasterDemoOperatorName(model),
        confirmedById: master.merchandiserId,
        confirmedByRole: '跟单',
        preparationType: detailUiState.selectedPreparationType || undefined,
        selectedConditionalTaskTypes: detailUiState.selectedConditionalTaskTypes,
        bomConditions: model.bomSummary.conditions,
        priorResultDecisions,
        preProductionSampleRequirements: detailUiState.preProductionSampleRequirements.map((line) => ({
          requirementLineId: line.draftId,
          targetColor: line.targetColor,
          targetSize: line.targetSize,
          requiredQuantity: line.requiredQuantity,
          requirementNote: line.requirementNote,
        })),
      })
      detailUiState.taskPlanError = ''
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('higood:request-render'))
    } catch (error) {
      detailUiState.taskPlanError = error instanceof Error ? error.message : '确认任务方案失败。'
      const refreshedModel = buildEngineeringMasterDetailModel(masterKey, detailUiState.selectedPreparationType)
      if (refreshedModel) refreshLanesRegion(refreshedModel)
    }
    return true
  }

  if (action === 'confirm-bom-pricing-plan') {
    const masterKey = currentMasterKey()
    try {
      const model = buildEngineeringMasterDetailModel(masterKey)
      if (!model) throw new Error('工程主单不存在。')
      if (!model.bomSummary.buyerId || !model.bomSummary.buyerName) throw new Error('请先为工程 BOM 与价格分配买手。')
      confirmEngineeringMasterBomPricingPlan({
        masterOrderId: masterKey,
        role: '买手',
        userId: model.bomSummary.buyerId,
        userName: model.bomSummary.buyerName,
      })
      showDetailFeedback('工程 BOM 与价格已整款确认，条件任务建议已同步更新。', true)
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('higood:request-render'))
    } catch (error) {
      showDetailFeedback(error instanceof Error ? error.message : '确认工程 BOM 与价格失败。', false)
    }
    return true
  }

  if (action === 'close-master-order') {
    const masterKey = currentMasterKey()
    if (!masterKey) return true
    let message = ''
    let ok = false
    try {
      const currentModel = buildEngineeringMasterDetailModel(masterKey)
      if (!currentModel) throw new Error('未找到工程主单，无法关闭。')
      closeEngineeringMasterOrder(masterKey, resolveEngineeringMasterDemoOperatorName(currentModel))
      message = '工程主单已关闭。'
      ok = true
    } catch (error) {
      message = error instanceof Error ? error.message : '关闭工程主单失败。'
    }
    const model = buildEngineeringMasterDetailModel(masterKey)
    if (model) refreshMasterHeader(model)
    showDetailFeedback(message, ok)
    return true
  }
  return false
}

export function handlePcsEngineeringMasterDetailInput(target: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): boolean {
  if (!target.closest('[data-pre-production-requirement-row]')) return false
  target.dataset.skipPageRerender = 'true'
  syncPreProductionSampleRequirementsFromDom()
  return true
}

function currentMasterKey(): string {
  if (typeof window === 'undefined') return ''
  const match = /^\/pcs\/engineering\/masters\/([^/]+)$/.exec(window.location.pathname)
  return match?.[1] ?? ''
}

export function isPcsEngineeringMasterDetailDialogOpen(): boolean {
  return Boolean(detailUiState.imagePreviewUrl)
}
