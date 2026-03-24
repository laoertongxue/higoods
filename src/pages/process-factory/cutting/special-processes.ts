import { renderDetailDrawer as uiDetailDrawer } from '../../../components/ui'
import { appStore } from '../../../state/store'
import { escapeHtml, formatDateTime } from '../../../utils'
import {
  buildSystemSeedSpecialProcessLedger,
  buildSpecialProcessAuditTrail,
  buildSpecialProcessViewModel,
  createBindingStripProcessDraft,
  CUTTING_SPECIAL_PROCESS_AUDIT_STORAGE_KEY,
  CUTTING_SPECIAL_PROCESS_BINDING_PAYLOAD_STORAGE_KEY,
  CUTTING_SPECIAL_PROCESS_ORDERS_STORAGE_KEY,
  deserializeBindingStripPayloadsStorage,
  deserializeSpecialProcessAuditTrailStorage,
  deserializeSpecialProcessOrdersStorage,
  filterSpecialProcessRows,
  findSpecialProcessByPrefilter,
  serializeBindingStripPayloadsStorage,
  serializeSpecialProcessAuditTrailStorage,
  serializeSpecialProcessOrdersStorage,
  specialProcessStatusMetaMap,
  specialProcessTypeMeta,
  validateSpecialProcessPayload,
  type BindingStripProcessPayload,
  type SpecialProcessAuditTrail,
  type SpecialProcessFilters,
  type SpecialProcessOrder,
  type SpecialProcessPrefilter,
  type SpecialProcessRow,
  type SpecialProcessStatusKey,
  type SpecialProcessType,
} from './special-processes-model'
import {
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchStateBar,
} from './layout.helpers'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, renderCuttingPageHeader } from './meta'
import {
  buildWarehouseOriginalRows,
  buildWarehouseRouteWithQuery,
  getWarehouseSearchParams,
  readWarehouseMergeBatchLedger,
} from './warehouse-shared'

type FilterField = 'keyword' | 'processType' | 'status' | 'sourceType'
type FeedbackTone = 'success' | 'warning'

interface SpecialProcessesPageState {
  filters: SpecialProcessFilters
  prefilter: SpecialProcessPrefilter | null
  querySignature: string
  activeProcessOrderId: string | null
  orders: SpecialProcessOrder[]
  bindingPayloads: BindingStripProcessPayload[]
  audits: SpecialProcessAuditTrail[]
  editorDraft: {
    processType: SpecialProcessType
    status: SpecialProcessStatusKey
    note: string
    materialLength: string
    cutWidth: string
    expectedQty: string
    actualQty: string
    operatorName: string
    payloadNote: string
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
  querySignature: '',
  activeProcessOrderId: null,
  orders: deserializeSpecialProcessOrdersStorage(localStorage.getItem(CUTTING_SPECIAL_PROCESS_ORDERS_STORAGE_KEY)),
  bindingPayloads: deserializeBindingStripPayloadsStorage(localStorage.getItem(CUTTING_SPECIAL_PROCESS_BINDING_PAYLOAD_STORAGE_KEY)),
  audits: deserializeSpecialProcessAuditTrailStorage(localStorage.getItem(CUTTING_SPECIAL_PROCESS_AUDIT_STORAGE_KEY)),
  editorDraft: {
    processType: 'BINDING_STRIP',
    status: 'DRAFT',
    note: '',
    materialLength: '',
    cutWidth: '',
    expectedQty: '',
    actualQty: '',
    operatorName: '',
    payloadNote: '',
  },
  feedback: null,
}

function nowText(date = new Date()): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function parseProcessType(value: string | null): SpecialProcessType | undefined {
  if (!value) return undefined
  if (value === 'binding-strip' || value === 'BINDING_STRIP') return 'BINDING_STRIP'
  if (value === 'wash' || value === 'WASH') return 'WASH'
  return undefined
}

function buildSeedLedger() {
  return buildSystemSeedSpecialProcessLedger(buildWarehouseOriginalRows(), readWarehouseMergeBatchLedger())
}

function buildViewModel() {
  return buildSpecialProcessViewModel({
    originalRows: buildWarehouseOriginalRows(),
    mergeBatches: readWarehouseMergeBatchLedger(),
    orders: state.orders,
    bindingPayloads: state.bindingPayloads,
  })
}

function getAllAudits(): SpecialProcessAuditTrail[] {
  return [...buildSeedLedger().audits, ...state.audits].sort((left, right) => right.actionAt.localeCompare(left.actionAt, 'zh-CN'))
}

function persistStore(): void {
  localStorage.setItem(CUTTING_SPECIAL_PROCESS_ORDERS_STORAGE_KEY, serializeSpecialProcessOrdersStorage(state.orders))
  localStorage.setItem(
    CUTTING_SPECIAL_PROCESS_BINDING_PAYLOAD_STORAGE_KEY,
    serializeBindingStripPayloadsStorage(state.bindingPayloads),
  )
  localStorage.setItem(CUTTING_SPECIAL_PROCESS_AUDIT_STORAGE_KEY, serializeSpecialProcessAuditTrailStorage(state.audits))
}

function upsertOrder(order: SpecialProcessOrder): void {
  state.orders = [...state.orders.filter((item) => item.processOrderId !== order.processOrderId), order]
}

function upsertBindingPayload(payload: BindingStripProcessPayload): void {
  state.bindingPayloads = [...state.bindingPayloads.filter((item) => item.processOrderId !== payload.processOrderId), payload]
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
  const prefilter: SpecialProcessPrefilter = {
    originalCutOrderNo: params.get('originalCutOrderNo') || undefined,
    mergeBatchNo: params.get('mergeBatchNo') || undefined,
    processType: parseProcessType(params.get('processType')),
    styleCode: params.get('styleCode') || undefined,
    materialSku: params.get('materialSku') || undefined,
  }

  return Object.values(prefilter).some(Boolean) ? prefilter : null
}

function syncEditorDraft(row: SpecialProcessRow | null): void {
  state.editorDraft = {
    processType: row?.processType || 'BINDING_STRIP',
    status: row?.status || 'DRAFT',
    note: row?.note || '',
    materialLength: row?.bindingPayload ? String(row.bindingPayload.materialLength) : '',
    cutWidth: row?.bindingPayload ? String(row.bindingPayload.cutWidth) : '',
    expectedQty: row?.bindingPayload ? String(row.bindingPayload.expectedQty) : '',
    actualQty: row?.bindingPayload ? String(row.bindingPayload.actualQty) : '',
    operatorName: row?.bindingPayload?.operatorName || '',
    payloadNote: row?.bindingPayload?.note || '',
  }
}

function createDraftFromPrefilterIfNeeded(): void {
  if (state.prefilter?.processType !== 'BINDING_STRIP') return
  const matched = findSpecialProcessByPrefilter(buildViewModel().rows, state.prefilter)
  if (matched) {
    state.activeProcessOrderId = matched.processOrderId
    syncEditorDraft(matched)
    return
  }

  const created = createBindingStripProcessDraft({
    originalRows: buildWarehouseOriginalRows(),
    mergeBatches: readWarehouseMergeBatchLedger(),
    prefilter: state.prefilter,
    existingCount: buildViewModel().rows.length,
  })
  upsertOrder(created.order)
  upsertBindingPayload(created.payload)
  prependAudit(created.audit)
  persistStore()
  state.activeProcessOrderId = created.order.processOrderId
  syncEditorDraft(buildViewModel().rowsById[created.order.processOrderId] || null)
}

function syncPrefilterFromQuery(): void {
  const pathname = appStore.getState().pathname
  if (pathname === state.querySignature) return
  state.querySignature = pathname
  state.prefilter = getPrefilterFromQuery()

  const matched = findSpecialProcessByPrefilter(buildViewModel().rows, state.prefilter)
  if (matched) {
    state.activeProcessOrderId = matched.processOrderId
    syncEditorDraft(matched)
  } else if (state.prefilter?.processType === 'BINDING_STRIP') {
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
  return `
    <div class="flex flex-wrap gap-2">
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="create-binding-strip">新建捆条工艺单</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="go-original-index">返回裁片单（原始单）</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="go-summary-index">查看裁剪总结</button>
    </div>
  `
}

function renderStats(): string {
  const { stats } = buildViewModel()
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      ${renderCompactKpiCard('工艺单总数', stats.totalCount, '当前特殊工艺台账', 'text-slate-900')}
      ${renderCompactKpiCard('捆条工艺单数', stats.bindingStripCount, '正式启用类型', 'text-blue-600')}
      ${renderCompactKpiCard('待执行数', stats.pendingExecutionCount, '已确认待开工', 'text-amber-600')}
      ${renderCompactKpiCard('执行中数', stats.inProgressCount, '当前厂内处理中', 'text-violet-600')}
      ${renderCompactKpiCard('已完成数', stats.doneCount, '已完成的工艺单', 'text-emerald-600')}
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
    state.prefilter.originalCutOrderNo ? `原始裁片单：${state.prefilter.originalCutOrderNo}` : '',
    state.prefilter.mergeBatchNo ? `合并批次：${state.prefilter.mergeBatchNo}` : '',
    state.prefilter.processType ? `工艺类型：${specialProcessTypeMeta[state.prefilter.processType].label}` : '',
    state.prefilter.styleCode ? `款号：${state.prefilter.styleCode}` : '',
    state.prefilter.materialSku ? `面料 SKU：${state.prefilter.materialSku}` : '',
  ].filter(Boolean)

  return renderWorkbenchStateBar({
    summary: '当前按上下文预填特殊工艺来源',
    chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-special-process-action="clear-prefilter"', 'amber')),
    clearAttrs: 'data-special-process-action="clear-prefilter"',
  })
}

function renderFilterBar(): string {
  return renderStickyFilterShell(`
    <div class="space-y-3">
      <div class="flex flex-wrap gap-2">
        ${renderWorkbenchFilterChip('仅正式建单捆条工艺', 'data-special-process-action="filter-binding-strip"', state.filters.processType === 'BINDING_STRIP' ? 'amber' : 'blue')}
        <button type="button" class="rounded-md border px-3 py-1 text-xs hover:bg-muted" data-special-process-action="clear-filters">重置筛选</button>
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label class="space-y-2 xl:col-span-2">
          <span class="text-sm font-medium text-foreground">关键词</span>
          <input type="text" value="${escapeHtml(state.filters.keyword)}" placeholder="支持工艺单号 / 原始裁片单号 / 批次号 / 款号" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-special-process-field="keyword" />
        </label>
        ${renderFilterSelect('工艺类型', 'processType', state.filters.processType, [
          { value: 'ALL', label: '全部' },
          { value: 'BINDING_STRIP', label: '捆条工艺' },
          { value: 'WASH', label: '洗水（占位）' },
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
          <th class="px-4 py-3 text-left">来源</th>
          <th class="px-4 py-3 text-left">款号 / 面料</th>
          <th class="px-4 py-3 text-left">状态</th>
          <th class="px-4 py-3 text-left">创建时间</th>
          <th class="px-4 py-3 text-left">操作</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => `
            <tr class="border-b align-top ${state.activeProcessOrderId === row.processOrderId ? 'bg-blue-50/60' : 'bg-card'}">
              <td class="px-4 py-3">
                <button type="button" class="font-medium text-blue-700 hover:underline" data-special-process-action="open-detail" data-process-order-id="${escapeHtml(row.processOrderId)}">${escapeHtml(row.processOrderNo)}</button>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.sourceSummary)}</div>
              </td>
              <td class="px-4 py-3">${renderTag(row.processTypeLabel, specialProcessTypeMeta[row.processType].className)}</td>
              <td class="px-4 py-3">
                ${renderTag(row.sourceLabel, row.sourceType === 'merge-batch' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-700')}
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.originalCutOrderNos.join(' / '))}</div>
              </td>
              <td class="px-4 py-3">
                <div class="font-medium text-foreground">${escapeHtml(row.styleCode || row.spuCode || '待补款号')}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.materialSku || '待补面料')}</div>
              </td>
              <td class="px-4 py-3">${renderTag(row.statusMeta.label, row.statusMeta.className)}</td>
              <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(formatDateTime(row.createdAt))}</td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-special-process-action="open-detail" data-process-order-id="${escapeHtml(row.processOrderId)}">查看详情</button>
                  <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-special-process-action="go-original-orders" data-process-order-id="${escapeHtml(row.processOrderId)}">查看原始裁片单</button>
                </div>
              </td>
            </tr>
          `)
          .join('')}
      </tbody>
    </table>
  `)
}

function renderBindingStripPanel(row: SpecialProcessRow): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold text-foreground">捆条工艺参数</h3>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <label class="space-y-2">
          <span class="text-xs text-muted-foreground">布料长度</span>
          <input type="number" min="0" step="0.1" value="${escapeHtml(state.editorDraft.materialLength)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-special-process-editor="materialLength" />
        </label>
        <label class="space-y-2">
          <span class="text-xs text-muted-foreground">裁剪宽度</span>
          <input type="number" min="0" step="0.1" value="${escapeHtml(state.editorDraft.cutWidth)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-special-process-editor="cutWidth" />
        </label>
        <label class="space-y-2">
          <span class="text-xs text-muted-foreground">预期数量</span>
          <input type="number" min="0" step="1" value="${escapeHtml(state.editorDraft.expectedQty)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-special-process-editor="expectedQty" />
        </label>
        <label class="space-y-2">
          <span class="text-xs text-muted-foreground">实际数量</span>
          <input type="number" min="0" step="1" value="${escapeHtml(state.editorDraft.actualQty)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-special-process-editor="actualQty" />
        </label>
        <label class="space-y-2">
          <span class="text-xs text-muted-foreground">操作人</span>
          <input type="text" value="${escapeHtml(state.editorDraft.operatorName)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-special-process-editor="operatorName" />
        </label>
        <label class="space-y-2">
          <span class="text-xs text-muted-foreground">工艺状态</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-special-process-editor="status">
            ${(['DRAFT', 'PENDING_EXECUTION', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as SpecialProcessStatusKey[])
              .map((status) => `<option value="${status}" ${state.editorDraft.status === status ? 'selected' : ''}>${specialProcessStatusMetaMap[status].label}</option>`)
              .join('')}
          </select>
        </label>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <label class="space-y-2">
          <span class="text-xs text-muted-foreground">工艺说明</span>
          <textarea rows="3" class="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-special-process-editor="note">${escapeHtml(state.editorDraft.note)}</textarea>
        </label>
        <label class="space-y-2">
          <span class="text-xs text-muted-foreground">参数备注</span>
          <textarea rows="3" class="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-special-process-editor="payloadNote">${escapeHtml(state.editorDraft.payloadNote)}</textarea>
        </label>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="save-editor">保存工艺单</button>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="set-status" data-next-status="PENDING_EXECUTION">标记待执行</button>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="set-status" data-next-status="IN_PROGRESS">标记执行中</button>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="set-status" data-next-status="DONE">标记已完成</button>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="set-status" data-next-status="CANCELLED">取消工艺单</button>
      </div>
    </section>
  `
}

function renderDetailDrawer(): string {
  const row = getActiveRow()
  if (!row) return ''

  const audits = getAllAudits().filter((item) => item.processOrderId === row.processOrderId)
  const bindingPanel =
    row.processType === 'BINDING_STRIP'
      ? renderBindingStripPanel(row)
      : `
          <section class="rounded-lg border bg-card p-4">
            <h3 class="text-sm font-semibold text-foreground">预留工艺占位</h3>
            <div class="mt-3 rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-muted-foreground">
              洗水工艺当前仅做结构占位，后续阶段启用，不进入正式参数编辑与执行逻辑。
            </div>
          </section>
        `

  return uiDetailDrawer(
    {
      title: `特殊工艺详情 · ${row.processOrderNo}`,
      subtitle: '特殊工艺单用于承接需单独建单的工艺任务，不改变原始裁片单主体。',
      closeAction: { prefix: 'specialProcess', action: 'close-overlay' },
      width: 'lg',
    },
    `
      <div class="space-y-6 text-sm">
        <section class="grid gap-3 md:grid-cols-2">
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">来源关系</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(row.sourceSummary)}</div>
          </div>
          <div class="rounded-lg border bg-muted/20 p-3">
            <div class="text-xs text-muted-foreground">当前状态</div>
            <div class="mt-1 flex flex-wrap gap-2">
              ${renderTag(row.processTypeLabel, specialProcessTypeMeta[row.processType].className)}
              ${renderTag(row.statusMeta.label, row.statusMeta.className)}
            </div>
          </div>
        </section>

        ${bindingPanel}

        <section class="rounded-lg border bg-card p-4">
          <h3 class="text-sm font-semibold text-foreground">审计记录</h3>
          <div class="mt-3 space-y-2 text-xs text-muted-foreground">
            ${audits
              .map(
                (audit) => `
                  <article class="rounded-lg border bg-muted/20 p-3">
                    <div class="flex items-center justify-between gap-3">
                      <span class="font-medium text-foreground">${escapeHtml(audit.payloadSummary)}</span>
                      <span>${escapeHtml(formatDateTime(audit.actionAt))}</span>
                    </div>
                    <div class="mt-1">${escapeHtml(`${audit.actionBy} · ${audit.note || '无补充说明'}`)}</div>
                  </article>
                `,
              )
              .join('') || '<div class="rounded-lg border border-dashed px-3 py-4 text-center">当前暂无审计记录。</div>'}
          </div>
        </section>
      </div>
    `,
    `
      <div class="flex flex-wrap gap-2">
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="go-original-orders" data-process-order-id="${escapeHtml(row.processOrderId)}">查看原始裁片单</button>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="go-merge-batches" data-process-order-id="${escapeHtml(row.processOrderId)}">查看合并裁剪批次</button>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-special-process-action="go-summary" data-process-order-id="${escapeHtml(row.processOrderId)}">查看裁剪总结</button>
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

  const pathMap: Record<keyof SpecialProcessRow['navigationPayload'], string> = {
    originalOrders: getCanonicalCuttingPath('original-orders'),
    mergeBatches: getCanonicalCuttingPath('merge-batches'),
    summary: getCanonicalCuttingPath('summary'),
  }

  appStore.navigate(buildWarehouseRouteWithQuery(pathMap[target], row.navigationPayload[target]))
  return true
}

function saveCurrentEditor(row: SpecialProcessRow, nextStatus?: SpecialProcessStatusKey): { ok: boolean; message: string } {
  const order: SpecialProcessOrder = {
    ...row,
    processType: state.editorDraft.processType,
    status: nextStatus || state.editorDraft.status,
    note: state.editorDraft.note.trim(),
  }
  const payload: BindingStripProcessPayload | null =
    order.processType === 'BINDING_STRIP'
      ? {
          processOrderId: row.processOrderId,
          materialLength: Number(state.editorDraft.materialLength || 0),
          cutWidth: Number(state.editorDraft.cutWidth || 0),
          expectedQty: Number(state.editorDraft.expectedQty || 0),
          actualQty: Number(state.editorDraft.actualQty || 0),
          operatorName: state.editorDraft.operatorName.trim(),
          note: state.editorDraft.payloadNote.trim(),
        }
      : null

  const validation = validateSpecialProcessPayload({ order, payload })
  if (!validation.ok && order.processType === 'BINDING_STRIP' && (nextStatus && nextStatus !== 'CANCELLED')) {
    return { ok: false, message: validation.message }
  }

  upsertOrder(order)
  if (payload) upsertBindingPayload(payload)
  prependAudit(
    buildSpecialProcessAuditTrail({
      processOrderId: row.processOrderId,
      action: nextStatus && nextStatus !== row.status ? 'STATUS_CHANGED' : 'UPDATED',
      actionBy: '工艺专员 叶晓青',
      payloadSummary: nextStatus && nextStatus !== row.status ? `${row.processOrderNo} 状态调整为 ${specialProcessStatusMetaMap[nextStatus].label}` : `更新 ${row.processOrderNo} 的工艺参数`,
      note: payload?.note || order.note,
    }),
  )
  persistStore()
  return { ok: true, message: nextStatus && nextStatus !== row.status ? `已更新 ${row.processOrderNo} 的状态。` : `已保存 ${row.processOrderNo} 的工艺参数。` }
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
    const field = editorFieldNode.dataset.specialProcessEditor
    if (!field) return false
    const input = editorFieldNode as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    if (field === 'processType') state.editorDraft.processType = input.value as SpecialProcessType
    if (field === 'status') state.editorDraft.status = input.value as SpecialProcessStatusKey
    if (field === 'note') state.editorDraft.note = input.value
    if (field === 'materialLength') state.editorDraft.materialLength = input.value
    if (field === 'cutWidth') state.editorDraft.cutWidth = input.value
    if (field === 'expectedQty') state.editorDraft.expectedQty = input.value
    if (field === 'actualQty') state.editorDraft.actualQty = input.value
    if (field === 'operatorName') state.editorDraft.operatorName = input.value
    if (field === 'payloadNote') state.editorDraft.payloadNote = input.value
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
      originalRows: buildWarehouseOriginalRows(),
      mergeBatches: readWarehouseMergeBatchLedger(),
      prefilter: state.prefilter,
      existingCount: buildViewModel().rows.length,
    })
    upsertOrder(created.order)
    upsertBindingPayload(created.payload)
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
    if (row.processType === 'WASH') {
      setFeedback('warning', '洗水工艺当前仅做占位，后续阶段启用。')
      return true
    }
    const result = saveCurrentEditor(row)
    setFeedback(result.ok ? 'success' : 'warning', result.message)
    return true
  }

  if (action === 'set-status') {
    const row = getActiveRow()
    const nextStatus = actionNode.dataset.nextStatus as SpecialProcessStatusKey | undefined
    if (!row || !nextStatus) return false
    if (row.processType === 'WASH') {
      setFeedback('warning', '洗水工艺当前仅做占位，不进入正式状态流转。')
      return true
    }
    const result = saveCurrentEditor(row, nextStatus)
    setFeedback(result.ok ? 'success' : 'warning', result.message)
    return true
  }

  if (action === 'clear-prefilter') {
    state.prefilter = null
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
  if (action === 'go-summary') return navigateByProcessOrder(actionNode.dataset.processOrderId || state.activeProcessOrderId || undefined, 'summary')

  if (action === 'go-original-index') {
    appStore.navigate(getCanonicalCuttingPath('original-orders'))
    return true
  }

  if (action === 'go-summary-index') {
    appStore.navigate(getCanonicalCuttingPath('summary'))
    return true
  }

  return false
}

export function isCraftCuttingSpecialProcessesDialogOpen(): boolean {
  return state.activeProcessOrderId !== null
}
