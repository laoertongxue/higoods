import { renderDetailDrawer as uiDetailDrawer } from '../../../components/ui'
import { appStore } from '../../../state/store'
import { escapeHtml, formatDateTime } from '../../../utils'
import {
  buildDefaultSpecialProcessFollowupActions,
  buildDefaultSpecialProcessScopeLines,
  buildSpecialProcessExecutionLog,
  deriveSpecialProcessTypeExecutionMeta,
  validateSpecialProcessExecutionTransition,
} from './special-processes-domain'
import {
  buildSpecialProcessAuditTrail,
  buildSpecialProcessNavigationPayload,
  createBindingStripProcessDraft,
  CUTTING_SPECIAL_PROCESS_AUDIT_STORAGE_KEY,
  CUTTING_SPECIAL_PROCESS_BINDING_PAYLOAD_STORAGE_KEY,
  CUTTING_SPECIAL_PROCESS_EXECUTION_LOGS_STORAGE_KEY,
  CUTTING_SPECIAL_PROCESS_FOLLOWUP_ACTIONS_STORAGE_KEY,
  CUTTING_SPECIAL_PROCESS_ORDERS_STORAGE_KEY,
  CUTTING_SPECIAL_PROCESS_SCOPE_LINES_STORAGE_KEY,
  deserializeBindingStripPayloadsStorage,
  deserializeSpecialProcessAuditTrailStorage,
  deserializeSpecialProcessExecutionLogsStorage,
  deserializeSpecialProcessFollowupActionsStorage,
  deserializeSpecialProcessOrdersStorage,
  deserializeSpecialProcessScopeLinesStorage,
  filterSpecialProcessRows,
  findSpecialProcessByPrefilter,
  serializeBindingStripPayloadsStorage,
  serializeSpecialProcessAuditTrailStorage,
  serializeSpecialProcessExecutionLogsStorage,
  serializeSpecialProcessFollowupActionsStorage,
  serializeSpecialProcessOrdersStorage,
  serializeSpecialProcessScopeLinesStorage,
  specialProcessStatusMetaMap,
  specialProcessTypeMeta,
  validateSpecialProcessPayload,
  type BindingStripProcessPayload,
  type SpecialProcessAuditTrail,
  type SpecialProcessExecutionLog,
  type SpecialProcessExecutionLogActionType,
  type SpecialProcessFilters,
  type SpecialProcessFollowupAction,
  type SpecialProcessFollowupActionStatus,
  type SpecialProcessOrder,
  type SpecialProcessPrefilter,
  type SpecialProcessRow,
  type SpecialProcessScopeLine,
  type SpecialProcessScopeUnitType,
  type SpecialProcessStatusKey,
  type SpecialProcessType,
} from './special-processes-model'
import { buildExecutionPrepProjectionContext } from './execution-prep-projection-helpers'
import { buildSpecialProcessesProjection } from './special-processes-projection'
import {
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchStateBar,
} from './layout.helpers'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, renderCuttingPageHeader } from './meta'
import { getWarehouseSearchParams } from './warehouse-shared'
import {
  buildCuttingDrillChipLabels,
  buildCuttingDrillSummary,
  buildCuttingRouteWithContext,
  buildReturnToSummaryContext,
  getCuttingNavigationActionLabel,
  hasSummaryReturnContext,
  normalizeLegacyCuttingPayload,
  readCuttingDrillContextFromLocation,
  type CuttingDrillContext,
  type CuttingNavigationTarget,
} from './navigation-context'

type FilterField = 'keyword' | 'processType' | 'status' | 'sourceType'
type FeedbackTone = 'success' | 'warning'
type ScopeField = 'sourceCutOrderId' | 'plannedQty' | 'unitType' | 'note'
type EditorField = 'note' | 'materialLength' | 'cutWidth' | 'expectedQty' | 'actualQty' | 'operatorName' | 'payloadNote'
type ExecutionField = 'operatorName' | 'actualQty' | 'actualLength' | 'actualWidth' | 'remark'

interface SpecialProcessesPageState {
  filters: SpecialProcessFilters
  prefilter: SpecialProcessPrefilter | null
  drillContext: CuttingDrillContext | null
  querySignature: string
  activeProcessOrderId: string | null
  orders: SpecialProcessOrder[]
  bindingPayloads: BindingStripProcessPayload[]
  scopeLines: SpecialProcessScopeLine[]
  executionLogs: SpecialProcessExecutionLog[]
  followupActions: SpecialProcessFollowupAction[]
  audits: SpecialProcessAuditTrail[]
  editorDraft: {
    note: string
    materialLength: string
    cutWidth: string
    expectedQty: string
    actualQty: string
    operatorName: string
    payloadNote: string
    scopeLines: SpecialProcessScopeLine[]
    execution: {
      operatorName: string
      actualQty: string
      actualLength: string
      actualWidth: string
      remark: string
    }
  }
  feedback: {
    tone: FeedbackTone
    message: string
  } | null
}

const initialFilters: SpecialProcessFilters = {
  keyword: '',
  processType: 'ALL',
  status: 'ALL',
  sourceType: 'ALL',
}

const state: SpecialProcessesPageState = {
  filters: { ...initialFilters },
  prefilter: null,
  drillContext: null,
  querySignature: '',
  activeProcessOrderId: null,
  orders: deserializeSpecialProcessOrdersStorage(localStorage.getItem(CUTTING_SPECIAL_PROCESS_ORDERS_STORAGE_KEY)),
  bindingPayloads: deserializeBindingStripPayloadsStorage(localStorage.getItem(CUTTING_SPECIAL_PROCESS_BINDING_PAYLOAD_STORAGE_KEY)),
  scopeLines: deserializeSpecialProcessScopeLinesStorage(localStorage.getItem(CUTTING_SPECIAL_PROCESS_SCOPE_LINES_STORAGE_KEY)),
  executionLogs: deserializeSpecialProcessExecutionLogsStorage(localStorage.getItem(CUTTING_SPECIAL_PROCESS_EXECUTION_LOGS_STORAGE_KEY)),
  followupActions: deserializeSpecialProcessFollowupActionsStorage(localStorage.getItem(CUTTING_SPECIAL_PROCESS_FOLLOWUP_ACTIONS_STORAGE_KEY)),
  audits: deserializeSpecialProcessAuditTrailStorage(localStorage.getItem(CUTTING_SPECIAL_PROCESS_AUDIT_STORAGE_KEY)),
  editorDraft: {
    note: '',
    materialLength: '',
    cutWidth: '',
    expectedQty: '',
    actualQty: '',
    operatorName: '',
    payloadNote: '',
    scopeLines: [],
    execution: {
      operatorName: '',
      actualQty: '',
      actualLength: '',
      actualWidth: '',
      remark: '',
    },
  },
  feedback: null,
}

function parseProcessType(value: string | null): SpecialProcessType | undefined {
  if (!value) return undefined
  if (value === 'binding-strip' || value === 'BINDING_STRIP') return 'BINDING_STRIP'
  if (value === 'wash' || value === 'WASH') return 'WASH'
  return undefined
}

function buildSeedLedger() {
  return buildSpecialProcessesProjection({
    orders: state.orders,
    bindingPayloads: state.bindingPayloads,
    scopeLines: state.scopeLines,
    executionLogs: state.executionLogs,
    followupActions: state.followupActions,
  }).seedAudits
}

function nowText(date = new Date()): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function buildViewModel() {
  return buildSpecialProcessesProjection({
    orders: state.orders,
    bindingPayloads: state.bindingPayloads,
    scopeLines: state.scopeLines,
    executionLogs: state.executionLogs,
    followupActions: state.followupActions,
  }).viewModel
}

function getAllAudits(): SpecialProcessAuditTrail[] {
  return [...buildSeedLedger(), ...state.audits].sort((left, right) => right.actionAt.localeCompare(left.actionAt, 'zh-CN'))
}

function getSpecialProcessSourceContext() {
  const context = buildExecutionPrepProjectionContext()
  return {
    originalRows: context.sources.originalRows,
    mergeBatches: context.sources.mergeBatches,
  }
}

function persistStore(): void {
  localStorage.setItem(CUTTING_SPECIAL_PROCESS_ORDERS_STORAGE_KEY, serializeSpecialProcessOrdersStorage(state.orders))
  localStorage.setItem(
    CUTTING_SPECIAL_PROCESS_BINDING_PAYLOAD_STORAGE_KEY,
    serializeBindingStripPayloadsStorage(state.bindingPayloads),
  )
  localStorage.setItem(CUTTING_SPECIAL_PROCESS_SCOPE_LINES_STORAGE_KEY, serializeSpecialProcessScopeLinesStorage(state.scopeLines))
  localStorage.setItem(CUTTING_SPECIAL_PROCESS_EXECUTION_LOGS_STORAGE_KEY, serializeSpecialProcessExecutionLogsStorage(state.executionLogs))
  localStorage.setItem(
    CUTTING_SPECIAL_PROCESS_FOLLOWUP_ACTIONS_STORAGE_KEY,
    serializeSpecialProcessFollowupActionsStorage(state.followupActions),
  )
  localStorage.setItem(CUTTING_SPECIAL_PROCESS_AUDIT_STORAGE_KEY, serializeSpecialProcessAuditTrailStorage(state.audits))
}

function upsertOrder(order: SpecialProcessOrder): void {
  state.orders = [...state.orders.filter((item) => item.processOrderId !== order.processOrderId), order]
}

function upsertBindingPayload(payload: BindingStripProcessPayload): void {
  state.bindingPayloads = [...state.bindingPayloads.filter((item) => item.processOrderId !== payload.processOrderId), payload]
}

function replaceScopeLines(processOrderId: string, scopeLines: SpecialProcessScopeLine[]): void {
  state.scopeLines = [...state.scopeLines.filter((item) => item.processOrderId !== processOrderId), ...scopeLines]
}

function prependExecutionLog(log: SpecialProcessExecutionLog): void {
  state.executionLogs = [log, ...state.executionLogs.filter((item) => item.executionId !== log.executionId)]
}

function replaceFollowupActions(processOrderId: string, actions: SpecialProcessFollowupAction[]): void {
  state.followupActions = [...state.followupActions.filter((item) => item.processOrderId !== processOrderId), ...actions]
}

function prependAudit(audit: SpecialProcessAuditTrail): void {
  state.audits = [audit, ...state.audits]
}

function setFeedback(tone: FeedbackTone, message: string): void {
  state.feedback = { tone, message }
}

function clearFeedback(): void {
  state.feedback = null
}

function getPrefilterFromQuery(): SpecialProcessPrefilter | null {
  const params = getWarehouseSearchParams()
  const drillContext = readCuttingDrillContextFromLocation(params)
  const prefilter: SpecialProcessPrefilter = {
    productionOrderId: drillContext?.productionOrderId || params.get('productionOrderId') || undefined,
    productionOrderNo: drillContext?.productionOrderNo || params.get('productionOrderNo') || undefined,
    originalCutOrderId: drillContext?.originalCutOrderId || params.get('originalCutOrderId') || undefined,
    originalCutOrderNo: drillContext?.originalCutOrderNo || params.get('originalCutOrderNo') || undefined,
    mergeBatchId: drillContext?.mergeBatchId || params.get('mergeBatchId') || undefined,
    mergeBatchNo: drillContext?.mergeBatchNo || params.get('mergeBatchNo') || undefined,
    processOrderId: drillContext?.processOrderId || params.get('processOrderId') || undefined,
    processOrderNo: drillContext?.processOrderNo || params.get('processOrderNo') || undefined,
    processType: parseProcessType(params.get('processType')),
    styleCode: drillContext?.styleCode || params.get('styleCode') || undefined,
    materialSku: drillContext?.materialSku || params.get('materialSku') || undefined,
  }

  return Object.values(prefilter).some(Boolean) ? prefilter : null
}

function syncEditorDraft(row: SpecialProcessRow | null): void {
  state.editorDraft = {
    note: row?.note || '',
    materialLength: row?.bindingPayload ? String(row.bindingPayload.materialLength) : '',
    cutWidth: row?.bindingPayload ? String(row.bindingPayload.cutWidth) : '',
    expectedQty: row?.bindingPayload ? String(row.bindingPayload.expectedQty) : '',
    actualQty: row?.bindingPayload ? String(row.bindingPayload.actualQty) : '',
    operatorName: row?.bindingPayload?.operatorName || row?.latestOperatorName || '',
    payloadNote: row?.bindingPayload?.note || '',
    scopeLines: row?.scopeLines.map((item) => ({ ...item })) || [],
    execution: {
      operatorName: row?.latestOperatorName || row?.bindingPayload?.operatorName || '',
      actualQty: row?.bindingPayload ? String(row.bindingPayload.actualQty || '') : '',
      actualLength: row?.latestActualLength ? String(row.latestActualLength) : '',
      actualWidth: row?.latestActualWidth ? String(row.latestActualWidth) : '',
      remark: '',
    },
  }
}

function createDraftFromPrefilterIfNeeded(): void {
  if (state.prefilter?.processType && state.prefilter.processType !== 'BINDING_STRIP') return
  const matched = findSpecialProcessByPrefilter(buildViewModel().rows, state.prefilter)
  if (matched) {
    state.activeProcessOrderId = matched.processOrderId
    syncEditorDraft(matched)
    return
  }

  const created = createBindingStripProcessDraft({
    ...getSpecialProcessSourceContext(),
    prefilter: state.prefilter,
    existingCount: buildViewModel().rows.length,
  })
  upsertOrder(created.order)
  upsertBindingPayload(created.payload)
  replaceScopeLines(created.order.processOrderId, created.scopeLines)
  replaceFollowupActions(created.order.processOrderId, created.followupActions)
  prependAudit(created.audit)
  persistStore()
  state.activeProcessOrderId = created.order.processOrderId
  syncEditorDraft(buildViewModel().rowsById[created.order.processOrderId] || null)
}

function syncPrefilterFromQuery(): void {
  const pathname = appStore.getState().pathname
  if (pathname === state.querySignature) return
  state.querySignature = pathname
  state.drillContext = readCuttingDrillContextFromLocation(getWarehouseSearchParams())
  state.prefilter = getPrefilterFromQuery()

  const matched = findSpecialProcessByPrefilter(buildViewModel().rows, state.prefilter)
  if (matched) {
    state.activeProcessOrderId = matched.processOrderId
    syncEditorDraft(matched)
  } else if (state.prefilter?.processType !== 'WASH') {
    createDraftFromPrefilterIfNeeded()
  }
}

function getFilteredRows(): SpecialProcessRow[] {
  return filterSpecialProcessRows(buildViewModel().rows, state.filters, state.prefilter)
}

function getActiveRow(): SpecialProcessRow | null {
  if (!state.activeProcessOrderId) return null
  return buildViewModel().rowsById[state.activeProcessOrderId] || null
}

function formatQty(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.max(value, 0))
}

function renderTag(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function renderFilterSelect(
  label: string,
  field: FilterField,
  value: string,
  options: Array<{ value: string; label: string }>,
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-special-process-field="${field}">
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    </label>
  `
}

function renderHeaderActions(): string {
  const returnToSummary = hasSummaryReturnContext(state.drillContext)
    ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="return-summary">返回裁剪总表</button>`
    : ''
  return `
    <div class="flex flex-wrap gap-2">
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="create-binding-strip">新建捆条工艺单</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="go-original-index">返回原始裁片单</button>
      ${returnToSummary}
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="go-summary-index">查看裁剪总表</button>
    </div>
  `
}

function renderStats(): string {
  const { stats } = buildViewModel()
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      ${renderCompactKpiCard('工艺单总数', stats.totalCount, '当前特殊工艺台账', 'text-slate-900')}
      ${renderCompactKpiCard('捆条工艺单数', stats.bindingStripCount, '已接入执行链', 'text-blue-600')}
      ${renderCompactKpiCard('待执行数', stats.pendingExecutionCount, '已准备待开工', 'text-amber-600')}
      ${renderCompactKpiCard('执行中数', stats.inProgressCount, '当前厂内处理中', 'text-violet-600')}
      ${renderCompactKpiCard('已完成数', stats.doneCount, '执行已完成，待看后续动作', 'text-emerald-600')}
      ${renderCompactKpiCard('预留类型数', stats.reservedCount, '暂未接入执行链', 'text-slate-600')}
    </section>
  `
}

function renderFeedbackBar(): string {
  if (!state.feedback) return ''
  const toneClass =
    state.feedback.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'
  return `<section class="rounded-lg border px-3 py-2 text-sm ${toneClass}">${escapeHtml(state.feedback.message)}</section>`
}

function renderPrefilterBar(): string {
  if (!state.prefilter) return ''
  const labels = [
    ...buildCuttingDrillChipLabels(state.drillContext),
    state.prefilter.processType ? `工艺类型：${specialProcessTypeMeta[state.prefilter.processType].label}` : '',
  ].filter(Boolean)

  return renderWorkbenchStateBar({
    summary: buildCuttingDrillSummary(state.drillContext) || '当前按来源上下文预填特殊工艺',
    chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-special-process-action="clear-prefilter"', 'amber')),
    clearAttrs: 'data-special-process-action="clear-prefilter"',
  })
}

function renderFilterBar(): string {
  return renderStickyFilterShell(`
    <div class="space-y-3">
      <div class="flex flex-wrap gap-2">
        ${renderWorkbenchFilterChip('仅看捆条工艺', 'data-special-process-action="filter-binding-strip"', state.filters.processType === 'BINDING_STRIP' ? 'amber' : 'blue')}
        <button type="button" class="rounded-md border px-3 py-1 text-xs hover:bg-muted" data-special-process-action="clear-filters">重置筛选</button>
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label class="space-y-2 xl:col-span-2">
          <span class="text-sm font-medium text-foreground">关键词</span>
          <input type="text" value="${escapeHtml(state.filters.keyword)}" placeholder="支持工艺单号 / 原始裁片单号 / 批次号 / 款号 / 面料" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-special-process-field="keyword" />
        </label>
        ${renderFilterSelect('工艺类型', 'processType', state.filters.processType, [
          { value: 'ALL', label: '全部' },
          { value: 'BINDING_STRIP', label: '捆条工艺' },
          { value: 'WASH', label: '洗水（预留）' },
        ])}
        ${renderFilterSelect('状态筛选', 'status', state.filters.status, [
          { value: 'ALL', label: '全部' },
          { value: 'DRAFT', label: '草稿' },
          { value: 'PENDING_EXECUTION', label: '待执行' },
          { value: 'IN_PROGRESS', label: '执行中' },
          { value: 'DONE', label: '已完成' },
          { value: 'CANCELLED', label: '已取消' },
        ])}
        ${renderFilterSelect('来源类型', 'sourceType', state.filters.sourceType, [
          { value: 'ALL', label: '全部' },
          { value: 'original-order', label: '原始裁片单' },
          { value: 'merge-batch', label: '合并裁剪批次' },
        ])}
      </div>
    </div>
  `)
}

function renderTable(rows: SpecialProcessRow[]): string {
  if (!rows.length) {
    return '<section class="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">当前筛选条件下暂无特殊工艺单。</section>'
  }

  return renderStickyTableScroller(`
    <table class="min-w-full text-sm">
      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th class="px-4 py-3 text-left">工艺单号</th>
          <th class="px-4 py-3 text-left">工艺类型</th>
          <th class="px-4 py-3 text-left">来源范围</th>
          <th class="px-4 py-3 text-left">面料 SKU</th>
          <th class="px-4 py-3 text-left">计划量</th>
          <th class="px-4 py-3 text-left">实际量</th>
          <th class="px-4 py-3 text-left">当前状态</th>
          <th class="px-4 py-3 text-left">执行进度</th>
          <th class="px-4 py-3 text-left">后续阻塞</th>
          <th class="px-4 py-3 text-left">操作</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => {
            const processAction = row.typeExecutionMeta.enabledForExecution && !['DONE', 'CANCELLED'].includes(row.status) ? '处理特殊工艺' : '查看详情'
            return `
              <tr class="border-b align-top ${state.activeProcessOrderId === row.processOrderId ? 'bg-blue-50/60' : 'bg-card'}">
                <td class="px-4 py-3">
                  <button type="button" class="font-medium text-blue-700 hover:underline" data-special-process-action="open-detail" data-process-order-id="${escapeHtml(row.processOrderId)}">${escapeHtml(row.processOrderNo)}</button>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.latestExecutionAt ? `最近更新 ${formatDateTime(row.latestExecutionAt)}` : `创建于 ${formatDateTime(row.createdAt)}`)}</div>
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-2">
                    ${renderTag(row.processTypeLabel, specialProcessTypeMeta[row.processType].className)}
                    ${!row.typeExecutionMeta.enabledForExecution ? renderTag(row.typeExecutionMeta.readinessLabel, 'bg-slate-100 text-slate-700') : ''}
                  </div>
                </td>
                <td class="px-4 py-3">
                  <div class="font-medium text-foreground">${escapeHtml(row.sourceLabel)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.scopeLines.map((item) => item.sourceCutOrderNo).join(' / ') || row.sourceSummary)}</div>
                </td>
                <td class="px-4 py-3">
                  <div class="font-medium text-foreground">${escapeHtml(row.materialSku || '待补面料')}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.scopeLines.map((item) => item.color).filter(Boolean).join(' / ') || '颜色待补')}</div>
                </td>
                <td class="px-4 py-3">${escapeHtml(formatQty(row.plannedQtyTotal))}</td>
                <td class="px-4 py-3">${escapeHtml(formatQty(row.actualQtyTotal))}</td>
                <td class="px-4 py-3">${renderTag(row.statusMeta.label, row.statusMeta.className)}</td>
                <td class="px-4 py-3">
                  <div class="font-medium text-foreground">${escapeHtml(row.executionProgressSummary)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.latestOperatorName || row.typeExecutionMeta.integrationLabel)}</div>
                </td>
                <td class="px-4 py-3">
                  ${renderTag(row.downstreamBlocked ? row.downstreamBlockReason : '不阻塞', row.downstreamBlocked ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.followupProgressSummary)}</div>
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-2">
                    <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-special-process-action="open-detail" data-process-order-id="${escapeHtml(row.processOrderId)}">${processAction}</button>
                    <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-special-process-action="go-original-orders" data-process-order-id="${escapeHtml(row.processOrderId)}">去原始裁片单</button>
                  </div>
                </td>
              </tr>
            `
          })
          .join('')}
      </tbody>
    </table>
  `)
}

function renderScopeUnitOptions(value: SpecialProcessScopeUnitType): string {
  return (['GARMENT', 'PIECE', 'METER', 'BUNDLE'] as SpecialProcessScopeUnitType[])
    .map((item) => `<option value="${item}" ${item === value ? 'selected' : ''}>${item === 'GARMENT' ? '件' : item === 'PIECE' ? '片' : item === 'METER' ? '米' : '扎'}</option>`)
    .join('')
}

function renderScopeSection(row: SpecialProcessRow): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold text-foreground">作用范围</h3>
          <p class="mt-1 text-xs text-muted-foreground">当前共 ${state.editorDraft.scopeLines.length} 条范围行，计划量合计 ${formatQty(state.editorDraft.scopeLines.reduce((sum, item) => sum + Math.max(item.plannedQty, 0), 0))}</p>
        </div>
        ${row.typeExecutionMeta.enabledForExecution && !['DONE', 'CANCELLED'].includes(row.status)
          ? '<button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-special-process-action="add-scope-line">新增范围行</button>'
          : ''}
      </div>
      <div class="mt-3 overflow-x-auto">
        <table class="min-w-full text-xs">
          <thead class="bg-muted/60 text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left">来源裁片单</th>
              <th class="px-3 py-2 text-left">来源生产单</th>
              <th class="px-3 py-2 text-left">颜色</th>
              <th class="px-3 py-2 text-left">面料 SKU</th>
              <th class="px-3 py-2 text-left">计划量</th>
              <th class="px-3 py-2 text-left">单位</th>
              <th class="px-3 py-2 text-left">备注</th>
              <th class="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            ${state.editorDraft.scopeLines
              .map((scope) => `
                <tr class="border-b">
                  <td class="px-3 py-2">
                    <select class="h-9 w-full rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" data-special-process-scope-field="sourceCutOrderId" data-scope-id="${escapeHtml(scope.scopeId)}" ${row.typeExecutionMeta.enabledForExecution && !['DONE', 'CANCELLED'].includes(row.status) ? '' : 'disabled'}>
                      ${row.sourceOptions
                        .map((option) => `<option value="${escapeHtml(option.sourceCutOrderId)}" ${option.sourceCutOrderId === scope.sourceCutOrderId ? 'selected' : ''}>${escapeHtml(option.sourceCutOrderNo)}</option>`)
                        .join('')}
                    </select>
                  </td>
                  <td class="px-3 py-2 text-muted-foreground">${escapeHtml(scope.sourceProductionOrderNo || '待补')}</td>
                  <td class="px-3 py-2 text-muted-foreground">${escapeHtml(scope.color || '待补')}</td>
                  <td class="px-3 py-2 text-muted-foreground">${escapeHtml(scope.materialSku || '待补')}</td>
                  <td class="px-3 py-2">
                    <input type="number" min="0" step="1" value="${escapeHtml(String(scope.plannedQty))}" class="h-9 w-24 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" data-special-process-scope-field="plannedQty" data-scope-id="${escapeHtml(scope.scopeId)}" ${row.typeExecutionMeta.enabledForExecution && !['DONE', 'CANCELLED'].includes(row.status) ? '' : 'disabled'} />
                  </td>
                  <td class="px-3 py-2">
                    <select class="h-9 rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" data-special-process-scope-field="unitType" data-scope-id="${escapeHtml(scope.scopeId)}" ${row.typeExecutionMeta.enabledForExecution && !['DONE', 'CANCELLED'].includes(row.status) ? '' : 'disabled'}>
                      ${renderScopeUnitOptions(scope.unitType)}
                    </select>
                  </td>
                  <td class="px-3 py-2">
                    <input type="text" value="${escapeHtml(scope.note)}" class="h-9 w-full rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" data-special-process-scope-field="note" data-scope-id="${escapeHtml(scope.scopeId)}" ${row.typeExecutionMeta.enabledForExecution && !['DONE', 'CANCELLED'].includes(row.status) ? '' : 'disabled'} />
                  </td>
                  <td class="px-3 py-2">
                    ${row.typeExecutionMeta.enabledForExecution && !['DONE', 'CANCELLED'].includes(row.status)
                      ? `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-special-process-action="remove-scope-line" data-scope-id="${escapeHtml(scope.scopeId)}">删除</button>`
                      : '—'}
                  </td>
                </tr>
              `)
              .join('') || '<tr><td colspan="8" class="px-3 py-4 text-center text-muted-foreground">当前暂无作用范围。</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderBindingStripSection(row: SpecialProcessRow): string {
  if (row.processType === 'WASH') {
    return `
      <section class="rounded-lg border bg-card p-4">
        <h3 class="text-sm font-semibold text-foreground">工艺参数</h3>
        <div class="mt-3 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">
          ${escapeHtml(row.typeExecutionMeta.disabledReason)}
        </div>
      </section>
    `
  }

  const difference = Number(state.editorDraft.expectedQty || 0) - Number(state.editorDraft.actualQty || 0)
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold text-foreground">工艺参数</h3>
          <div class="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>计划产出：${escapeHtml(state.editorDraft.expectedQty || '0')}</span>
            <span>实际产出：${escapeHtml(state.editorDraft.actualQty || '0')}</span>
            <span>差异：${escapeHtml(String(difference))}</span>
            <span>当前负责人：${escapeHtml(state.editorDraft.operatorName || row.latestOperatorName || '待补')}</span>
            <span>最近更新：${escapeHtml(row.latestExecutionAt ? formatDateTime(row.latestExecutionAt) : '待补')}</span>
          </div>
        </div>
        ${renderTag(row.typeExecutionMeta.integrationLabel, 'bg-blue-50 text-blue-700')}
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <label class="space-y-2">
          <span class="text-xs text-muted-foreground">计划布料长度（米）</span>
          <input type="number" min="0" step="0.1" value="${escapeHtml(state.editorDraft.materialLength)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-special-process-editor="materialLength" />
        </label>
        <label class="space-y-2">
          <span class="text-xs text-muted-foreground">计划裁剪宽度（厘米）</span>
          <input type="number" min="0" step="0.1" value="${escapeHtml(state.editorDraft.cutWidth)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-special-process-editor="cutWidth" />
        </label>
        <label class="space-y-2">
          <span class="text-xs text-muted-foreground">计划产出数量</span>
          <input type="number" min="0" step="1" value="${escapeHtml(state.editorDraft.expectedQty)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-special-process-editor="expectedQty" />
        </label>
        <label class="space-y-2">
          <span class="text-xs text-muted-foreground">累计实际产出</span>
          <input type="number" min="0" step="1" value="${escapeHtml(state.editorDraft.actualQty)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-special-process-editor="actualQty" />
        </label>
        <label class="space-y-2">
          <span class="text-xs text-muted-foreground">当前负责人</span>
          <input type="text" value="${escapeHtml(state.editorDraft.operatorName)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-special-process-editor="operatorName" />
        </label>
        <label class="space-y-2">
          <span class="text-xs text-muted-foreground">工艺备注</span>
          <input type="text" value="${escapeHtml(state.editorDraft.payloadNote)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-special-process-editor="payloadNote" />
        </label>
      </div>
      <label class="mt-3 block space-y-2">
        <span class="text-xs text-muted-foreground">工艺单说明</span>
        <textarea rows="3" class="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-special-process-editor="note">${escapeHtml(state.editorDraft.note)}</textarea>
      </label>
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="save-editor">保存工艺参数</button>
        ${row.status === 'DRAFT' ? '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="submit-pending">提交待执行</button>' : ''}
      </div>
    </section>
  `
}

function renderExecutionSection(row: SpecialProcessRow): string {
  const actionButtons = !row.typeExecutionMeta.enabledForExecution || ['DONE', 'CANCELLED'].includes(row.status)
    ? ''
    : `
      <div class="mt-3 flex flex-wrap gap-2">
        ${row.status === 'PENDING_EXECUTION' ? '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="log-start">记录开工</button>' : ''}
        ${row.status === 'IN_PROGRESS' ? '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="log-update">记录进度</button>' : ''}
        ${row.status === 'IN_PROGRESS' ? '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="log-pause">记录暂停</button>' : ''}
        ${row.status === 'IN_PROGRESS' ? '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="log-resume">恢复执行</button>' : ''}
        ${row.status !== 'CANCELLED' && row.status !== 'DONE' ? '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="log-note">记录备注</button>' : ''}
        ${row.status === 'IN_PROGRESS' ? '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="log-complete">标记完成</button>' : ''}
        ${row.status !== 'DONE' && row.status !== 'CANCELLED' ? '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="log-cancel">取消工艺单</button>' : ''}
      </div>
    `

  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold text-foreground">执行记录</h3>
      ${row.typeExecutionMeta.enabledForExecution ? `
        <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label class="space-y-2">
            <span class="text-xs text-muted-foreground">执行人</span>
            <input type="text" value="${escapeHtml(state.editorDraft.execution.operatorName)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-special-process-execution-field="operatorName" />
          </label>
          <label class="space-y-2">
            <span class="text-xs text-muted-foreground">实际产出</span>
            <input type="number" min="0" step="1" value="${escapeHtml(state.editorDraft.execution.actualQty)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-special-process-execution-field="actualQty" />
          </label>
          <label class="space-y-2">
            <span class="text-xs text-muted-foreground">实际长度（米）</span>
            <input type="number" min="0" step="0.1" value="${escapeHtml(state.editorDraft.execution.actualLength)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-special-process-execution-field="actualLength" />
          </label>
          <label class="space-y-2">
            <span class="text-xs text-muted-foreground">实际宽度（厘米）</span>
            <input type="number" min="0" step="0.1" value="${escapeHtml(state.editorDraft.execution.actualWidth)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-special-process-execution-field="actualWidth" />
          </label>
          <label class="space-y-2 xl:col-span-1">
            <span class="text-xs text-muted-foreground">执行备注</span>
            <input type="text" value="${escapeHtml(state.editorDraft.execution.remark)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-special-process-execution-field="remark" />
          </label>
        </div>
        ${actionButtons}
      ` : `<div class="mt-3 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">当前仅展示预留状态，不进入执行记录链。</div>`}
      <div class="mt-4 overflow-x-auto">
        <table class="min-w-full text-xs">
          <thead class="bg-muted/60 text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left">动作</th>
              <th class="px-3 py-2 text-left">执行人</th>
              <th class="px-3 py-2 text-left">时间</th>
              <th class="px-3 py-2 text-left">实际产出</th>
              <th class="px-3 py-2 text-left">长度/宽度</th>
              <th class="px-3 py-2 text-left">备注</th>
            </tr>
          </thead>
          <tbody>
            ${row.executionLogs
              .map((log) => `
                <tr class="border-b">
                  <td class="px-3 py-2">${escapeHtml(log.actionType === 'CREATE' ? '创建' : log.actionType === 'UPDATE' ? '进度补录' : log.actionType === 'START' ? '开工' : log.actionType === 'PAUSE' ? '暂停' : log.actionType === 'RESUME' ? '恢复执行' : log.actionType === 'COMPLETE' ? '完成' : log.actionType === 'CANCEL' ? '取消' : '备注')}</td>
                  <td class="px-3 py-2">${escapeHtml(log.operatorName)}</td>
                  <td class="px-3 py-2 text-muted-foreground">${escapeHtml(formatDateTime(log.operatedAt))}</td>
                  <td class="px-3 py-2">${escapeHtml(formatQty(log.actualQty))}</td>
                  <td class="px-3 py-2 text-muted-foreground">${escapeHtml(`${log.actualLength || 0} / ${log.actualWidth || 0}`)}</td>
                  <td class="px-3 py-2 text-muted-foreground">${escapeHtml(log.remark || '—')}</td>
                </tr>
              `)
              .join('') || '<tr><td colspan="6" class="px-3 py-4 text-center text-muted-foreground">当前暂无执行记录。</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderAuditActionLabel(action: SpecialProcessAuditTrail['action']): string {
  if (action === 'CREATED') return '已创建'
  if (action === 'UPDATED') return '已更新'
  if (action === 'STATUS_CHANGED') return '状态变更'
  if (action === 'CANCELLED') return '已取消'
  if (action === 'EXECUTION_LOGGED') return '执行记录'
  return '下游动作'
}

function canProcessFollowupActions(row: SpecialProcessRow): boolean {
  return row.typeExecutionMeta.enabledForExecution && row.status === 'DONE'
}

function renderFollowupSection(row: SpecialProcessRow): string {
  const canProcessActions = canProcessFollowupActions(row)
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold text-foreground">下游联动动作</h3>
      ${
        !canProcessActions && row.followupActions.length
          ? `<div class="mt-3 rounded-lg border border-dashed bg-slate-50 px-3 py-2 text-xs text-muted-foreground">${
              row.typeExecutionMeta.enabledForExecution ? '工艺单完成后再处理下游动作。' : row.typeExecutionMeta.disabledReason
            }</div>`
          : ''
      }
      <div class="mt-3 overflow-x-auto">
        <table class="min-w-full text-xs">
          <thead class="bg-muted/60 text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left">动作</th>
              <th class="px-3 py-2 text-left">状态</th>
              <th class="px-3 py-2 text-left">备注</th>
              <th class="px-3 py-2 text-left">处理时间</th>
              <th class="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            ${row.followupActions
              .map((action) => `
                <tr class="border-b">
                  <td class="px-3 py-2">
                    <div class="font-medium text-foreground">${escapeHtml(action.title)}</div>
                    <div class="mt-1 text-muted-foreground">${escapeHtml(action.targetPath)}</div>
                  </td>
                  <td class="px-3 py-2">${renderTag(action.status === 'DONE' ? '已处理' : action.status === 'SKIPPED' ? '已跳过' : '待处理', action.status === 'DONE' ? 'bg-emerald-100 text-emerald-700' : action.status === 'SKIPPED' ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-700')}</td>
                  <td class="px-3 py-2 text-muted-foreground">${escapeHtml(action.note || '—')}</td>
                  <td class="px-3 py-2 text-muted-foreground">${escapeHtml(action.completedAt || action.decidedAt || '待补')}</td>
                  <td class="px-3 py-2">
                    <div class="flex flex-wrap gap-2">
                      <button type="button" class="rounded-md border px-2 py-1 hover:bg-muted" data-special-process-action="go-followup" data-action-id="${escapeHtml(action.actionId)}">${escapeHtml(getCuttingNavigationActionLabel(action.targetPageKey as CuttingNavigationTarget))}</button>
                      ${action.status !== 'DONE' ? `<button type="button" class="rounded-md border px-2 py-1 hover:bg-muted" data-special-process-action="complete-followup" data-action-id="${escapeHtml(action.actionId)}">标记完成</button>` : ''}
                      ${action.status === 'PENDING' ? `<button type="button" class="rounded-md border px-2 py-1 hover:bg-muted" data-special-process-action="skip-followup" data-action-id="${escapeHtml(action.actionId)}">跳过</button>` : ''}
                    </div>
                  </td>
                </tr>
              `)
              .join('') || '<tr><td colspan="5" class="px-3 py-4 text-center text-muted-foreground">当前暂无下游动作。</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderAuditSection(row: SpecialProcessRow): string {
  const audits = getAllAudits().filter((item) => item.processOrderId === row.processOrderId)
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold text-foreground">审计记录</h3>
      <div class="mt-3 space-y-2 text-xs text-muted-foreground">
        ${audits
          .map(
            (audit) => `
              <article class="rounded-lg border bg-muted/20 p-3">
                <div class="flex items-center justify-between gap-3">
                  <div class="flex items-center gap-2">
                    ${renderTag(renderAuditActionLabel(audit.action), 'bg-slate-100 text-slate-700')}
                    <span class="font-medium text-foreground">${escapeHtml(audit.payloadSummary)}</span>
                  </div>
                  <span>${escapeHtml(formatDateTime(audit.actionAt))}</span>
                </div>
                <div class="mt-1">${escapeHtml(`${audit.actionBy} · ${audit.note || '无补充说明'}`)}</div>
              </article>
            `,
          )
          .join('') || '<div class="rounded-lg border border-dashed px-3 py-4 text-center">当前暂无审计记录。</div>'}
      </div>
    </section>
  `
}

function renderBasicInfoSection(row: SpecialProcessRow): string {
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-lg border bg-muted/20 p-3">
        <div class="text-xs text-muted-foreground">工艺类型</div>
        <div class="mt-1 flex flex-wrap gap-2">
          ${renderTag(row.processTypeLabel, specialProcessTypeMeta[row.processType].className)}
          ${renderTag(row.statusMeta.label, row.statusMeta.className)}
        </div>
      </div>
      <div class="rounded-lg border bg-muted/20 p-3">
        <div class="text-xs text-muted-foreground">来源范围</div>
        <div class="mt-1 font-medium text-foreground">${escapeHtml(row.sourceSummary)}</div>
      </div>
      <div class="rounded-lg border bg-muted/20 p-3">
        <div class="text-xs text-muted-foreground">面料 / 款号</div>
        <div class="mt-1 font-medium text-foreground">${escapeHtml(row.materialSku || '待补')}</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.styleCode || row.spuCode || '待补款号')}</div>
      </div>
      <div class="rounded-lg border bg-muted/20 p-3">
        <div class="text-xs text-muted-foreground">执行边界</div>
        <div class="mt-1 font-medium text-foreground">${escapeHtml(row.typeExecutionMeta.readinessLabel)}</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.typeExecutionMeta.integrationLabel)}</div>
      </div>
    </section>
  `
}

function renderDetailDrawer(): string {
  const row = getActiveRow()
  if (!row) return ''

  return uiDetailDrawer(
    {
      title: `特殊工艺详情 · ${row.processOrderNo}`,
      subtitle: '',
      closeAction: { prefix: 'specialProcess', action: 'close-overlay' },
      width: 'xl',
    },
    `
      <div class="space-y-6 text-sm">
        ${renderBasicInfoSection(row)}
        ${renderScopeSection(row)}
        ${renderBindingStripSection(row)}
        ${renderExecutionSection(row)}
        ${renderFollowupSection(row)}
        ${renderAuditSection(row)}
      </div>
    `,
    `
      <div class="flex flex-wrap gap-2">
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="go-original-orders" data-process-order-id="${escapeHtml(row.processOrderId)}">去原始裁片单</button>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="go-merge-batches" data-process-order-id="${escapeHtml(row.processOrderId)}">去合并裁剪批次</button>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="go-replenishment" data-process-order-id="${escapeHtml(row.processOrderId)}">去补料管理</button>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="go-summary" data-process-order-id="${escapeHtml(row.processOrderId)}">去裁剪总表</button>
      </div>
    `,
  )
}

function renderPage(): string {
  syncPrefilterFromQuery()
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'special-processes')

  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, { actionsHtml: renderHeaderActions() })}
      ${renderStats()}
      ${renderFeedbackBar()}
      ${renderPrefilterBar()}
      ${renderFilterBar()}
      ${renderTable(getFilteredRows())}
      ${renderDetailDrawer()}
    </div>
  `
}

function navigateByProcessOrder(
  processOrderId: string | undefined,
  target: keyof SpecialProcessRow['navigationPayload'],
): boolean {
  if (!processOrderId) return false
  const row = buildViewModel().rowsById[processOrderId]
  if (!row) return false
  const context = normalizeLegacyCuttingPayload(row.navigationPayload[target], 'special-processes', {
    productionOrderId: row.productionOrderIds[0] || undefined,
    productionOrderNo: row.productionOrderNos[0] || undefined,
    originalCutOrderId: row.originalCutOrderIds[0] || undefined,
    originalCutOrderNo: row.originalCutOrderNos[0] || undefined,
    mergeBatchId: row.mergeBatchId || undefined,
    mergeBatchNo: row.mergeBatchNo || undefined,
    materialSku: row.materialSku || undefined,
    processOrderId: row.processOrderId,
    processOrderNo: row.processOrderNo,
    autoOpenDetail: true,
  })
  appStore.navigate(buildCuttingRouteWithContext(target as CuttingNavigationTarget, context))
  return true
}

function buildDraftPayload(row: SpecialProcessRow): BindingStripProcessPayload | null {
  if (row.processType !== 'BINDING_STRIP') return null
  return {
    processOrderId: row.processOrderId,
    materialLength: Number(state.editorDraft.materialLength || 0),
    cutWidth: Number(state.editorDraft.cutWidth || 0),
    expectedQty: Number(state.editorDraft.expectedQty || 0),
    actualQty: Number(state.editorDraft.actualQty || 0),
    operatorName: state.editorDraft.operatorName.trim(),
    note: state.editorDraft.payloadNote.trim(),
  }
}

function persistDraftForRow(row: SpecialProcessRow, nextStatus?: SpecialProcessStatusKey): { ok: boolean; message: string } {
  const order: SpecialProcessOrder = {
    ...row,
    status: nextStatus || row.status,
    note: state.editorDraft.note.trim(),
  }
  const payload = buildDraftPayload(row)
  if (row.typeExecutionMeta.enabledForExecution) {
    const validation = validateSpecialProcessPayload({ order, payload })
    if (!validation.ok && nextStatus !== 'CANCELLED') return validation
  }
  if (nextStatus && nextStatus !== row.status) {
    const transitionValidation = validateSpecialProcessExecutionTransition({
      order,
      nextStatus,
      payload,
      scopeLines: state.editorDraft.scopeLines,
      executionLogs: buildViewModel().rowsById[row.processOrderId]?.executionLogs || [],
      typeMeta: row.typeExecutionMeta,
      remark: state.editorDraft.payloadNote || state.editorDraft.note,
    })
    if (!transitionValidation.ok) return transitionValidation
  }

  upsertOrder(order)
  if (payload) upsertBindingPayload(payload)
  replaceScopeLines(row.processOrderId, state.editorDraft.scopeLines)
  if (!row.followupActions.length && row.typeExecutionMeta.enabledForExecution) {
    replaceFollowupActions(
      row.processOrderId,
      buildDefaultSpecialProcessFollowupActions({
        order,
        navigationPayload: buildSpecialProcessNavigationPayload(order),
        typeMeta: deriveSpecialProcessTypeExecutionMeta(order.processType),
      }),
    )
  }
  persistStore()
  return { ok: true, message: '已保存工艺参数。' }
}

function buildNextExecutionLog(row: SpecialProcessRow, actionType: SpecialProcessExecutionLogActionType): SpecialProcessExecutionLog {
  return buildSpecialProcessExecutionLog({
    processOrderId: row.processOrderId,
    actionType,
    operatorName: state.editorDraft.execution.operatorName.trim() || state.editorDraft.operatorName.trim() || '待补执行人',
    actualQty: Number(state.editorDraft.execution.actualQty || state.editorDraft.actualQty || 0),
    actualLength: Number(state.editorDraft.execution.actualLength || 0),
    actualWidth: Number(state.editorDraft.execution.actualWidth || 0),
    remark: state.editorDraft.execution.remark.trim(),
  })
}

function logExecution(row: SpecialProcessRow, actionType: SpecialProcessExecutionLogActionType): { ok: boolean; message: string } {
  const typeMeta = deriveSpecialProcessTypeExecutionMeta(row.processType)
  if (!typeMeta.enabledForExecution) {
    return { ok: false, message: typeMeta.disabledReason }
  }

  const payload = buildDraftPayload(row)
  const scopeLines = state.editorDraft.scopeLines
  const nextLog = buildNextExecutionLog(row, actionType)
  const currentLogs = buildViewModel().rowsById[row.processOrderId]?.executionLogs || []
  const nextLogs = [nextLog, ...currentLogs]
  const nextStatus: SpecialProcessStatusKey =
    actionType === 'START' || actionType === 'RESUME' || actionType === 'UPDATE' || actionType === 'NOTE' || actionType === 'PAUSE'
      ? 'IN_PROGRESS'
      : actionType === 'COMPLETE'
        ? 'DONE'
        : actionType === 'CANCEL'
          ? 'CANCELLED'
          : row.status

  const validation = validateSpecialProcessExecutionTransition({
    order: { ...row, status: nextStatus, note: state.editorDraft.note.trim() },
    nextStatus,
    payload,
    scopeLines,
    executionLogs: nextLogs,
    typeMeta,
    remark: state.editorDraft.execution.remark,
  })
  if (!validation.ok) return validation

  const persistResult = persistDraftForRow(row, nextStatus)
  if (!persistResult.ok) return persistResult
  prependExecutionLog(nextLog)
  prependAudit(
    buildSpecialProcessAuditTrail({
      processOrderId: row.processOrderId,
      action: actionType === 'CANCEL' ? 'CANCELLED' : actionType === 'COMPLETE' || actionType === 'START' || actionType === 'UPDATE' || actionType === 'PAUSE' || actionType === 'RESUME' || actionType === 'NOTE' ? 'EXECUTION_LOGGED' : 'STATUS_CHANGED',
      actionBy: nextLog.operatorName,
      payloadSummary:
        actionType === 'START'
          ? `${row.processOrderNo} 已开工`
          : actionType === 'UPDATE'
            ? `${row.processOrderNo} 已补录执行进度`
            : actionType === 'PAUSE'
              ? `${row.processOrderNo} 已记录暂停`
              : actionType === 'RESUME'
                ? `${row.processOrderNo} 已恢复执行`
                : actionType === 'COMPLETE'
                  ? `${row.processOrderNo} 已完成`
                  : actionType === 'CANCEL'
                    ? `${row.processOrderNo} 已取消`
                    : `${row.processOrderNo} 已记录备注`,
      note: nextLog.remark || state.editorDraft.payloadNote || state.editorDraft.note,
    }),
  )
  persistStore()
  const refreshedRow = buildViewModel().rowsById[row.processOrderId] || null
  syncEditorDraft(refreshedRow)
  return {
    ok: true,
    message:
      actionType === 'START'
        ? `已记录 ${row.processOrderNo} 开工。`
        : actionType === 'COMPLETE'
          ? `已完成 ${row.processOrderNo}。`
          : actionType === 'CANCEL'
            ? `已取消 ${row.processOrderNo}。`
            : `已记录 ${row.processOrderNo} 的执行动作。`,
  }
}

function updateFollowupAction(
  row: SpecialProcessRow,
  actionId: string,
  nextStatus: SpecialProcessFollowupActionStatus,
): { ok: boolean; message: string } {
  if (!canProcessFollowupActions(row) && !(row.status === 'CANCELLED' && nextStatus === 'SKIPPED')) {
    return {
      ok: false,
      message: row.typeExecutionMeta.enabledForExecution ? '请先完成工艺单，再处理下游动作。' : row.typeExecutionMeta.disabledReason,
    }
  }
  const action = row.followupActions.find((item) => item.actionId === actionId)
  if (!action) return { ok: false, message: '未找到对应的下游动作。' }
  const updatedActions = row.followupActions.map((item) =>
    item.actionId !== actionId
      ? item
      : {
          ...item,
          status: nextStatus,
          note: nextStatus === 'SKIPPED' ? item.note || '人工确认无需继续处理。' : item.note,
          decidedAt: nextStatus === 'PENDING' ? item.decidedAt : item.decidedAt || nowText(),
          decidedBy: nextStatus === 'PENDING' ? item.decidedBy : item.decidedBy || '工艺专员 叶晓青',
          completedAt: nextStatus === 'DONE' ? nowText() : item.completedAt,
          completedBy: nextStatus === 'DONE' ? '工艺专员 叶晓青' : item.completedBy,
        },
  )
  replaceFollowupActions(row.processOrderId, updatedActions)
  prependAudit(
    buildSpecialProcessAuditTrail({
      processOrderId: row.processOrderId,
      action: 'FOLLOWUP_UPDATED',
      actionBy: '工艺专员 叶晓青',
      payloadSummary: nextStatus === 'DONE' ? `${row.processOrderNo} 下游动作已完成` : `${row.processOrderNo} 下游动作已跳过`,
      note: `${action.title} · ${nextStatus === 'DONE' ? '已完成' : '已跳过'}`,
    }),
  )
  persistStore()
  const refreshedRow = buildViewModel().rowsById[row.processOrderId] || null
  syncEditorDraft(refreshedRow)
  return { ok: true, message: nextStatus === 'DONE' ? '已标记下游动作完成。' : '已标记下游动作跳过。' }
}

function buildNewScopeLine(row: SpecialProcessRow): SpecialProcessScopeLine {
  const source = row.sourceOptions[0]
  return {
    scopeId: `scope-${row.processOrderId}-${Date.now()}`,
    processOrderId: row.processOrderId,
    sourceType: source?.sourceType || (row.sourceType === 'merge-batch' ? 'MERGE_BATCH' : 'ORIGINAL_CUT_ORDER'),
    sourceCutOrderId: source?.sourceCutOrderId || row.originalCutOrderIds[0] || '',
    sourceCutOrderNo: source?.sourceCutOrderNo || row.originalCutOrderNos[0] || '',
    mergeBatchId: source?.mergeBatchId || row.mergeBatchId,
    mergeBatchNo: source?.mergeBatchNo || row.mergeBatchNo,
    sourceProductionOrderNo: source?.sourceProductionOrderNo || row.productionOrderNos[0] || '',
    styleCode: source?.styleCode || row.styleCode,
    spuCode: source?.spuCode || row.spuCode,
    color: source?.color || '',
    materialSku: source?.materialSku || row.materialSku,
    plannedQty: source?.plannedQty || 0,
    unitType: 'GARMENT',
    note: '',
  }
}

export function renderCraftCuttingSpecialProcessesPage(): string {
  return renderPage()
}

export function handleCraftCuttingSpecialProcessesEvent(target: Element): boolean {
  const filterFieldNode = target.closest<HTMLElement>('[data-special-process-field]')
  if (filterFieldNode) {
    const field = filterFieldNode.dataset.specialProcessField as FilterField | undefined
    if (!field) return false
    state.filters = {
      ...state.filters,
      [field]: (filterFieldNode as HTMLInputElement | HTMLSelectElement).value,
    }
    return true
  }

  const editorFieldNode = target.closest<HTMLElement>('[data-special-process-editor]')
  if (editorFieldNode) {
    const field = editorFieldNode.dataset.specialProcessEditor as EditorField | undefined
    if (!field) return false
    const input = editorFieldNode as HTMLInputElement | HTMLTextAreaElement
    if (field === 'note') state.editorDraft.note = input.value
    if (field === 'materialLength') state.editorDraft.materialLength = input.value
    if (field === 'cutWidth') state.editorDraft.cutWidth = input.value
    if (field === 'expectedQty') state.editorDraft.expectedQty = input.value
    if (field === 'actualQty') state.editorDraft.actualQty = input.value
    if (field === 'operatorName') state.editorDraft.operatorName = input.value
    if (field === 'payloadNote') state.editorDraft.payloadNote = input.value
    return true
  }

  const executionFieldNode = target.closest<HTMLElement>('[data-special-process-execution-field]')
  if (executionFieldNode) {
    const field = executionFieldNode.dataset.specialProcessExecutionField as ExecutionField | undefined
    if (!field) return false
    const input = executionFieldNode as HTMLInputElement
    if (field === 'operatorName') state.editorDraft.execution.operatorName = input.value
    if (field === 'actualQty') state.editorDraft.execution.actualQty = input.value
    if (field === 'actualLength') state.editorDraft.execution.actualLength = input.value
    if (field === 'actualWidth') state.editorDraft.execution.actualWidth = input.value
    if (field === 'remark') state.editorDraft.execution.remark = input.value
    return true
  }

  const scopeFieldNode = target.closest<HTMLElement>('[data-special-process-scope-field]')
  if (scopeFieldNode) {
    const field = scopeFieldNode.dataset.specialProcessScopeField as ScopeField | undefined
    const scopeId = scopeFieldNode.dataset.scopeId
    if (!field || !scopeId) return false
    const input = scopeFieldNode as HTMLInputElement | HTMLSelectElement
    state.editorDraft.scopeLines = state.editorDraft.scopeLines.map((scope) => {
      if (scope.scopeId !== scopeId) return scope
      if (field === 'sourceCutOrderId') {
        const row = getActiveRow()
        const source = row?.sourceOptions.find((item) => item.sourceCutOrderId === input.value)
        if (!source) return scope
        return {
          ...scope,
          sourceType: source.sourceType,
          sourceCutOrderId: source.sourceCutOrderId,
          sourceCutOrderNo: source.sourceCutOrderNo,
          mergeBatchId: source.mergeBatchId,
          mergeBatchNo: source.mergeBatchNo,
          sourceProductionOrderNo: source.sourceProductionOrderNo,
          styleCode: source.styleCode,
          spuCode: source.spuCode,
          color: source.color,
          materialSku: source.materialSku,
          plannedQty: scope.plannedQty > 0 ? scope.plannedQty : source.plannedQty,
        }
      }
      if (field === 'plannedQty') return { ...scope, plannedQty: Math.max(Number(input.value || 0), 0) }
      if (field === 'unitType') return { ...scope, unitType: input.value as SpecialProcessScopeUnitType }
      if (field === 'note') return { ...scope, note: input.value }
      return scope
    })
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-special-process-action]')
  const action = actionNode?.dataset.specialProcessAction
  if (!action) return false

  clearFeedback()

  if (action === 'open-detail') {
    const processOrderId = actionNode.dataset.processOrderId
    if (!processOrderId) return false
    state.activeProcessOrderId = processOrderId
    syncEditorDraft(buildViewModel().rowsById[processOrderId] || null)
    return true
  }

  if (action === 'close-overlay') {
    state.activeProcessOrderId = null
    return true
  }

  if (action === 'create-binding-strip') {
    const created = createBindingStripProcessDraft({
      ...getSpecialProcessSourceContext(),
      prefilter: state.prefilter,
      existingCount: buildViewModel().rows.length,
    })
    upsertOrder(created.order)
    upsertBindingPayload(created.payload)
    replaceScopeLines(created.order.processOrderId, created.scopeLines)
    replaceFollowupActions(created.order.processOrderId, created.followupActions)
    prependAudit(created.audit)
    persistStore()
    state.activeProcessOrderId = created.order.processOrderId
    syncEditorDraft(buildViewModel().rowsById[created.order.processOrderId] || null)
    setFeedback('success', `已创建 ${created.order.processOrderNo}。`)
    return true
  }

  if (action === 'save-editor') {
    const row = getActiveRow()
    if (!row) return false
    if (!row.typeExecutionMeta.enabledForExecution) {
      setFeedback('warning', row.typeExecutionMeta.disabledReason)
      return true
    }
    const result = persistDraftForRow(row)
    if (!result.ok) {
      setFeedback('warning', result.message)
      return true
    }
    prependAudit(
      buildSpecialProcessAuditTrail({
        processOrderId: row.processOrderId,
        action: 'UPDATED',
        actionBy: '工艺专员 叶晓青',
        payloadSummary: `更新 ${row.processOrderNo} 的工艺参数`,
        note: state.editorDraft.payloadNote || state.editorDraft.note,
      }),
    )
    persistStore()
    const refreshedRow = buildViewModel().rowsById[row.processOrderId] || null
    syncEditorDraft(refreshedRow)
    setFeedback('success', result.message)
    return true
  }

  if (action === 'submit-pending') {
    const row = getActiveRow()
    if (!row) return false
    const result = persistDraftForRow(row, 'PENDING_EXECUTION')
    if (!result.ok) {
      setFeedback('warning', result.message)
      return true
    }
    prependAudit(
      buildSpecialProcessAuditTrail({
        processOrderId: row.processOrderId,
        action: 'STATUS_CHANGED',
        actionBy: '工艺专员 叶晓青',
        payloadSummary: `${row.processOrderNo} 已转为待执行`,
        note: state.editorDraft.note,
      }),
    )
    persistStore()
    const refreshedRow = buildViewModel().rowsById[row.processOrderId] || null
    syncEditorDraft(refreshedRow)
    setFeedback('success', `已提交 ${row.processOrderNo} 至待执行。`)
    return true
  }

  if (action === 'log-start' || action === 'log-update' || action === 'log-pause' || action === 'log-resume' || action === 'log-note' || action === 'log-complete' || action === 'log-cancel') {
    const row = getActiveRow()
    if (!row) return false
    const actionTypeMap: Record<string, SpecialProcessExecutionLogActionType> = {
      'log-start': 'START',
      'log-update': 'UPDATE',
      'log-pause': 'PAUSE',
      'log-resume': 'RESUME',
      'log-note': 'NOTE',
      'log-complete': 'COMPLETE',
      'log-cancel': 'CANCEL',
    }
    const result = logExecution(row, actionTypeMap[action])
    setFeedback(result.ok ? 'success' : 'warning', result.message)
    return true
  }

  if (action === 'add-scope-line') {
    const row = getActiveRow()
    if (!row) return false
    state.editorDraft.scopeLines = [...state.editorDraft.scopeLines, buildNewScopeLine(row)]
    return true
  }

  if (action === 'remove-scope-line') {
    const scopeId = actionNode.dataset.scopeId
    if (!scopeId) return false
    state.editorDraft.scopeLines = state.editorDraft.scopeLines.filter((item) => item.scopeId !== scopeId)
    return true
  }

  if (action === 'go-followup') {
    const row = getActiveRow()
    const actionId = actionNode.dataset.actionId
    if (!row || !actionId) return false
    const followup = row.followupActions.find((item) => item.actionId === actionId)
    if (!followup) return false
    const context = normalizeLegacyCuttingPayload(followup.targetQuery, 'special-processes', {
      productionOrderId: row.productionOrderIds[0] || undefined,
      productionOrderNo: row.productionOrderNos[0] || undefined,
      originalCutOrderId: row.originalCutOrderIds[0] || undefined,
      originalCutOrderNo: row.originalCutOrderNos[0] || undefined,
      mergeBatchId: row.mergeBatchId || undefined,
      mergeBatchNo: row.mergeBatchNo || undefined,
      materialSku: row.materialSku || undefined,
      processOrderId: row.processOrderId,
      processOrderNo: row.processOrderNo,
      autoOpenDetail: true,
    })
    appStore.navigate(buildCuttingRouteWithContext(followup.targetPageKey as CuttingNavigationTarget, context))
    return true
  }

  if (action === 'complete-followup' || action === 'skip-followup') {
    const row = getActiveRow()
    const actionId = actionNode.dataset.actionId
    if (!row || !actionId) return false
    const result = updateFollowupAction(row, actionId, action === 'complete-followup' ? 'DONE' : 'SKIPPED')
    setFeedback(result.ok ? 'success' : 'warning', result.message)
    return true
  }

  if (action === 'clear-prefilter') {
    state.prefilter = null
    state.drillContext = null
    state.activeProcessOrderId = null
    state.querySignature = getCanonicalCuttingPath('special-processes')
    appStore.navigate(getCanonicalCuttingPath('special-processes'))
    return true
  }

  if (action === 'clear-filters') {
    state.filters = { ...initialFilters }
    return true
  }

  if (action === 'filter-binding-strip') {
    state.filters.processType = state.filters.processType === 'BINDING_STRIP' ? 'ALL' : 'BINDING_STRIP'
    return true
  }

  if (action === 'go-original-orders') return navigateByProcessOrder(actionNode.dataset.processOrderId || state.activeProcessOrderId || undefined, 'originalOrders')
  if (action === 'go-merge-batches') return navigateByProcessOrder(actionNode.dataset.processOrderId || state.activeProcessOrderId || undefined, 'mergeBatches')
  if (action === 'go-replenishment') return navigateByProcessOrder(actionNode.dataset.processOrderId || state.activeProcessOrderId || undefined, 'replenishment')
  if (action === 'go-summary') return navigateByProcessOrder(actionNode.dataset.processOrderId || state.activeProcessOrderId || undefined, 'summary')

  if (action === 'go-original-index') {
    appStore.navigate(getCanonicalCuttingPath('original-orders'))
    return true
  }

  if (action === 'go-summary-index') {
    appStore.navigate(getCanonicalCuttingPath('summary'))
    return true
  }

  if (action === 'return-summary') {
    const context = buildReturnToSummaryContext(state.drillContext)
    if (!context) return false
    appStore.navigate(buildCuttingRouteWithContext('summary', context))
    return true
  }

  return false
}

export function isCraftCuttingSpecialProcessesDialogOpen(): boolean {
  return state.activeProcessOrderId !== null
}
