import { cuttingOrderProgressRecords } from '../../../data/fcs/cutting/order-progress'
import { appStore } from '../../../state/store'
import { escapeHtml } from '../../../utils'
import { buildCuttablePoolViewModel } from './cuttable-pool-model'
import {
  buildSystemSeedMergeBatches,
  createMergeBatchDraft,
  CUTTING_MERGE_BATCH_LEDGER_STORAGE_KEY,
  CUTTING_SELECTED_COMPATIBILITY_KEY_STORAGE_KEY,
  CUTTING_SELECTED_IDS_STORAGE_KEY,
  deserializeMergeBatchStorage,
  getMergeBatchStatusMeta,
  groupMergeBatchItemsByProductionOrder,
  hydrateIncomingSelectedOriginalCutOrders,
  serializeMergeBatchStorage,
  summarizeIncomingBatchSelection,
  type MergeBatchDraftForm,
  type MergeBatchRecord,
  type MergeBatchStatus,
  type MergeBatchSummary,
  type MergeBatchValidationResult,
  validateIncomingBatchSelection,
} from './merge-batches-model'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta'
import { renderCompactKpiCard, renderStickyFilterShell } from './layout.helpers'

type MergeBatchFilterField = 'keyword' | 'status' | 'cuttingGroup'
type MergeBatchDraftField = keyof MergeBatchDraftForm

interface MergeBatchLedgerFilters {
  keyword: string
  status: 'ALL' | MergeBatchStatus
  cuttingGroup: string
}

interface MergeBatchFeedback {
  tone: 'success' | 'warning'
  message: string
}

interface MergeBatchPageState {
  draftForm: MergeBatchDraftForm
  ledgerFilters: MergeBatchLedgerFilters
  activeBatchId: string
  feedback: MergeBatchFeedback | null
}

const initialDraftForm: MergeBatchDraftForm = {
  plannedCuttingGroup: '',
  plannedCuttingDate: '',
  note: '',
}

const state: MergeBatchPageState = {
  draftForm: { ...initialDraftForm },
  ledgerFilters: {
    keyword: '',
    status: 'ALL',
    cuttingGroup: 'ALL',
  },
  activeBatchId: '',
  feedback: null,
}

function getViewModel() {
  return buildCuttablePoolViewModel(cuttingOrderProgressRecords)
}

function nowText(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  const hours = `${now.getHours()}`.padStart(2, '0')
  const minutes = `${now.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function readStoredLedger(): MergeBatchRecord[] {
  try {
    return deserializeMergeBatchStorage(localStorage.getItem(CUTTING_MERGE_BATCH_LEDGER_STORAGE_KEY))
  } catch {
    return []
  }
}

function writeStoredLedger(records: MergeBatchRecord[]): void {
  try {
    localStorage.setItem(CUTTING_MERGE_BATCH_LEDGER_STORAGE_KEY, serializeMergeBatchStorage(records))
  } catch {
    state.feedback = {
      tone: 'warning',
      message: '当前浏览器未能保存批次台账，请稍后重试。',
    }
  }
}

function clearIncomingSelection(): void {
  try {
    sessionStorage.removeItem(CUTTING_SELECTED_IDS_STORAGE_KEY)
    sessionStorage.removeItem(CUTTING_SELECTED_COMPATIBILITY_KEY_STORAGE_KEY)
  } catch {
    // 原型页允许静默失败，页面会继续以当前内存态显示。
  }
}

function getMergedLedger(): MergeBatchRecord[] {
  const systemSeed = buildSystemSeedMergeBatches(Object.values(getViewModel().itemsById))
  const merged = new Map(systemSeed.map((batch) => [batch.mergeBatchId, batch]))

  for (const batch of readStoredLedger()) {
    merged.set(batch.mergeBatchId, batch)
  }

  return Array.from(merged.values()).sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt, 'zh-CN') ||
      right.mergeBatchNo.localeCompare(left.mergeBatchNo, 'zh-CN'),
  )
}

function upsertBatch(batch: MergeBatchRecord): void {
  const stored = readStoredLedger()
  const next = stored.filter((item) => item.mergeBatchId !== batch.mergeBatchId)
  next.push(batch)
  next.sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt, 'zh-CN') ||
      right.mergeBatchNo.localeCompare(left.mergeBatchNo, 'zh-CN'),
  )
  writeStoredLedger(next)
}

function getIncomingSelection(ledger = getMergedLedger()): {
  summary: MergeBatchSummary | null
  validation: MergeBatchValidationResult
  incoming: ReturnType<typeof hydrateIncomingSelectedOriginalCutOrders>
} {
  const incoming = hydrateIncomingSelectedOriginalCutOrders(getViewModel().itemsById, sessionStorage)
  const validation = validateIncomingBatchSelection(incoming, ledger)
  return {
    summary: incoming.items.length ? summarizeIncomingBatchSelection(incoming.items) : null,
    validation,
    incoming,
  }
}

function getActiveBatch(ledger = getMergedLedger()): MergeBatchRecord | null {
  const matched = ledger.find((batch) => batch.mergeBatchId === state.activeBatchId) ?? null
  const fallback = matched ?? ledger[0] ?? null
  if (fallback && state.activeBatchId !== fallback.mergeBatchId) {
    state.activeBatchId = fallback.mergeBatchId
  }
  if (!fallback && state.activeBatchId) state.activeBatchId = ''
  return fallback
}

function setFeedback(tone: MergeBatchFeedback['tone'], message: string): void {
  state.feedback = { tone, message }
}

function clearFeedback(): void {
  state.feedback = null
}

function renderStatusBadge(status: MergeBatchStatus): string {
  const meta = getMergeBatchStatusMeta(status)
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}">${escapeHtml(meta.label)}</span>`
}

function renderActionButton(label: string, attrs: string, variant: 'primary' | 'secondary' = 'secondary', disabled = false): string {
  const baseClass =
    variant === 'primary'
      ? 'rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700'
      : 'rounded-md border px-3 py-2 text-sm hover:bg-muted'
  return `
    <button
      type="button"
      ${attrs}
      class="${baseClass} ${disabled ? 'pointer-events-none opacity-50' : ''}"
      ${disabled ? 'disabled' : ''}
    >
      ${escapeHtml(label)}
    </button>
  `
}

function renderHeaderActions(activeBatch: MergeBatchRecord | null): string {
  return `
    <div class="flex flex-wrap items-center gap-2">
      ${renderActionButton('返回可裁排产', 'data-merge-batches-action="go-cuttable-pool"')}
      ${renderActionButton(
        '去唛架 / 铺布',
        `data-merge-batches-action="go-marker-spreading"${activeBatch ? ` data-batch-id="${escapeHtml(activeBatch.mergeBatchId)}"` : ''}`,
        'primary',
        !activeBatch,
      )}
      ${renderActionButton('查看裁剪总结', 'data-merge-batches-action="go-summary"')}
    </div>
  `
}

function buildStats(ledger: MergeBatchRecord[], incomingCount: number) {
  return {
    total: ledger.length,
    draft: ledger.filter((batch) => batch.status === 'DRAFT').length,
    ready: ledger.filter((batch) => batch.status === 'READY').length,
    cutting: ledger.filter((batch) => batch.status === 'CUTTING').length,
    done: ledger.filter((batch) => batch.status === 'DONE').length,
    incoming: incomingCount,
  }
}

function renderStatsCards(ledger: MergeBatchRecord[], incomingCount: number): string {
  const stats = buildStats(ledger, incomingCount)
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      ${renderCompactKpiCard('批次总数', stats.total, '执行层批次台账', 'text-slate-900')}
      ${renderCompactKpiCard('草稿批次数', stats.draft, '待继续补充计划', 'text-slate-700')}
      ${renderCompactKpiCard('待裁批次数', stats.ready, '已建档待进入裁床', 'text-blue-600')}
      ${renderCompactKpiCard('裁剪中批次数', stats.cutting, '批次已进入执行上下文', 'text-amber-600')}
      ${renderCompactKpiCard('已完成批次数', stats.done, '仅表示批次执行完成', 'text-emerald-600')}
      ${renderCompactKpiCard('当前待建原始裁片单数', stats.incoming, '来自可裁排产输入', 'text-violet-600')}
    </section>
  `
}

function renderFeedbackBar(): string {
  if (!state.feedback) return ''

  const toneClass =
    state.feedback.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'

  return `
    <section class="rounded-lg border px-4 py-3 ${toneClass}">
      <div class="flex items-start justify-between gap-3">
        <p class="text-sm">${escapeHtml(state.feedback.message)}</p>
        <button type="button" class="shrink-0 text-xs hover:underline" data-merge-batches-action="clear-feedback">知道了</button>
      </div>
    </section>
  `
}

function renderIncomingSummaryCard(label: string, value: string | number, hint: string): string {
  return `
    <article class="rounded-lg border bg-muted/10 px-3 py-2">
      <p class="text-xs text-muted-foreground">${escapeHtml(label)}</p>
      <p class="mt-1 text-base font-semibold">${escapeHtml(String(value))}</p>
      <p class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(hint)}</p>
    </article>
  `
}

function renderIncomingEmptyState(): string {
  return `
    <section class="rounded-lg border bg-card">
      <div class="border-b px-4 py-3">
        <h2 class="text-sm font-semibold">待建批次输入区</h2>
        <p class="mt-1 text-xs text-muted-foreground">当前没有收到来自可裁排产页的原始裁片单选择结果。</p>
      </div>
      <div class="px-4 py-10 text-center">
        <p class="text-sm text-muted-foreground">请先去可裁排产选择可裁原始裁片单，再回到本页创建合并裁剪批次。</p>
        <div class="mt-4 flex justify-center">
          ${renderActionButton('前往可裁排产', 'data-merge-batches-action="go-cuttable-pool"', 'primary')}
        </div>
      </div>
    </section>
  `
}

function renderIncomingValidation(validation: MergeBatchValidationResult): string {
  if (validation.ok) {
    return `
      <div class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        当前选择已通过兼容性校验，可创建为草稿批次或待裁批次。
      </div>
    `
  }

  return `
    <div class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
      <p class="font-medium">当前输入暂不能创建批次：</p>
      <ul class="mt-2 list-disc space-y-1 pl-5">
        ${validation.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}
      </ul>
    </div>
  `
}

function renderIncomingDraftZone(ledger: MergeBatchRecord[]): string {
  const { incoming, summary, validation } = getIncomingSelection(ledger)
  if (!incoming.requestedIds.length) return renderIncomingEmptyState()

  return `
    <section class="rounded-lg border bg-card">
      <div class="border-b px-4 py-3">
        <h2 class="text-sm font-semibold">待建批次输入区</h2>
        <p class="mt-1 text-xs text-muted-foreground">本区只承接来自可裁排产页的原始裁片单选择结果，用于生成执行层批次草稿。</p>
      </div>
      <div class="space-y-4 px-4 py-4">
        ${
          summary
            ? `
              <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                ${renderIncomingSummaryCard('来源生产单数', summary.sourceProductionOrderCount, '同一批次允许来自多个生产单')}
                ${renderIncomingSummaryCard('来源原始裁片单数', summary.sourceOriginalCutOrderCount, '批次 item 只允许原始裁片单')}
                ${renderIncomingSummaryCard('同款 / SPU', `${summary.styleCode || summary.spuCode}`, summary.styleName || '当前批次主款')}
                ${renderIncomingSummaryCard('compatibilityKey', summary.compatibilityKey, '执行层兼容分组')}
                ${renderIncomingSummaryCard('面料摘要', summary.materialSkuSummary || '-', summary.riskSummary || '兼容校验结果')}
              </div>
            `
            : ''
        }

        ${renderIncomingValidation(validation)}

        <div class="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
          <div class="rounded-lg border bg-muted/10 p-3">
            <h3 class="text-sm font-semibold">来源原始裁片单</h3>
            <div class="mt-3 overflow-hidden rounded-lg border">
              <table class="min-w-full text-left text-sm">
                <thead class="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2 font-medium">原始裁片单号</th>
                    <th class="px-3 py-2 font-medium">生产单号</th>
                    <th class="px-3 py-2 font-medium">面料 SKU</th>
                    <th class="px-3 py-2 font-medium">当前状态</th>
                  </tr>
                </thead>
                <tbody>
                  ${incoming.items
                    .map(
                      (item) => `
                        <tr class="border-t">
                          <td class="px-3 py-2 font-medium">${escapeHtml(item.originalCutOrderNo)}</td>
                          <td class="px-3 py-2">${escapeHtml(item.productionOrderNo)}</td>
                          <td class="px-3 py-2">${escapeHtml(item.materialSku)}</td>
                          <td class="px-3 py-2">${escapeHtml(item.cuttableState.label)}</td>
                        </tr>
                      `,
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="rounded-lg border bg-muted/10 p-3">
            <h3 class="text-sm font-semibold">批次基础信息</h3>
            <div class="mt-3 space-y-3">
              <label class="block space-y-2">
                <span class="text-sm font-medium">计划裁床组</span>
                <input
                  type="text"
                  value="${escapeHtml(state.draftForm.plannedCuttingGroup)}"
                  placeholder="如：一号裁床 / 夜班组"
                  data-merge-batches-draft-field="plannedCuttingGroup"
                  class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label class="block space-y-2">
                <span class="text-sm font-medium">计划裁剪日期</span>
                <input
                  type="date"
                  value="${escapeHtml(state.draftForm.plannedCuttingDate)}"
                  data-merge-batches-draft-field="plannedCuttingDate"
                  class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label class="block space-y-2">
                <span class="text-sm font-medium">备注</span>
                <textarea
                  rows="4"
                  placeholder="可记录裁床组排期、加急说明、预计并行执行约束。"
                  data-merge-batches-draft-field="note"
                  class="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >${escapeHtml(state.draftForm.note)}</textarea>
              </label>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          ${renderActionButton('保存为草稿', 'data-merge-batches-action="save-draft"', 'secondary', !validation.ok)}
          ${renderActionButton('创建待裁批次', 'data-merge-batches-action="create-ready"', 'primary', !validation.ok)}
          ${renderActionButton('清空本次输入', 'data-merge-batches-action="clear-incoming"')}
          ${renderActionButton('返回可裁排产重新选择', 'data-merge-batches-action="go-cuttable-pool"')}
        </div>
      </div>
    </section>
  `
}

function renderFilterSelect(
  label: string,
  field: MergeBatchFilterField,
  value: string,
  options: Array<{ value: string; label: string }>,
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select
        data-merge-batches-filter-field="${field}"
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
      >
        ${options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('')}
      </select>
    </label>
  `
}

function getLedgerCuttingGroups(ledger: MergeBatchRecord[]): string[] {
  return Array.from(new Set(ledger.map((batch) => batch.plannedCuttingGroup).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, 'zh-CN'),
  )
}

function renderLedgerFilters(ledger: MergeBatchRecord[]): string {
  const groupOptions = getLedgerCuttingGroups(ledger)

  return renderStickyFilterShell(`
    <div class="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_repeat(2,minmax(0,0.7fr))]">
      <label class="space-y-2">
        <span class="text-sm font-medium text-foreground">关键字</span>
        <input
          type="text"
          value="${escapeHtml(state.ledgerFilters.keyword)}"
          placeholder="批次号 / 款号 / 生产单号 / 原始裁片单号"
          data-merge-batches-filter-field="keyword"
          class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
      </label>
      ${renderFilterSelect('批次状态', 'status', state.ledgerFilters.status, [
        { value: 'ALL', label: '全部状态' },
        { value: 'DRAFT', label: '草稿' },
        { value: 'READY', label: '待裁' },
        { value: 'CUTTING', label: '裁剪中' },
        { value: 'DONE', label: '已完成' },
        { value: 'CANCELLED', label: '已取消' },
      ])}
      ${renderFilterSelect(
        '裁床组',
        'cuttingGroup',
        state.ledgerFilters.cuttingGroup,
        [{ value: 'ALL', label: '全部裁床组' }, ...groupOptions.map((group) => ({ value: group, label: group }))],
      )}
    </div>
  `)
}

function filterLedger(ledger: MergeBatchRecord[]): MergeBatchRecord[] {
  const keyword = state.ledgerFilters.keyword.trim().toLowerCase()

  return ledger.filter((batch) => {
    if (state.ledgerFilters.status !== 'ALL' && batch.status !== state.ledgerFilters.status) return false
    if (state.ledgerFilters.cuttingGroup !== 'ALL' && batch.plannedCuttingGroup !== state.ledgerFilters.cuttingGroup) return false

    if (!keyword) return true

    const keywordValues = [
      batch.mergeBatchNo,
      batch.styleCode,
      batch.spuCode,
      batch.styleName,
      batch.compatibilityKey,
      batch.plannedCuttingGroup,
      ...batch.items.map((item) => item.productionOrderNo),
      ...batch.items.map((item) => item.originalCutOrderNo),
      ...batch.items.map((item) => item.materialSku),
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase())

    return keywordValues.some((value) => value.includes(keyword))
  })
}

function getStatusTransitions(batch: MergeBatchRecord): Array<{ status: MergeBatchStatus; label: string }> {
  if (batch.status === 'DRAFT') {
    return [
      { status: 'READY', label: '标记待裁' },
      { status: 'CANCELLED', label: '作废 / 取消' },
    ]
  }

  if (batch.status === 'READY') {
    return [
      { status: 'CUTTING', label: '标记裁剪中' },
      { status: 'CANCELLED', label: '作废 / 取消' },
    ]
  }

  if (batch.status === 'CUTTING') {
    return [
      { status: 'DONE', label: '标记已完成' },
      { status: 'CANCELLED', label: '作废 / 取消' },
    ]
  }

  return []
}

function renderLedgerTable(ledger: MergeBatchRecord[]): string {
  if (!ledger.length) {
    return `
      <section class="rounded-lg border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
        当前还没有批次台账。可先从可裁排产页选择原始裁片单，或在上方待建批次输入区保存第一条草稿。
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card">
      <div class="border-b px-4 py-3">
        <h2 class="text-sm font-semibold">批次台账列表</h2>
        <p class="mt-1 text-xs text-muted-foreground">批次只是执行层对象，不会改变生产单与原始裁片单身份。</p>
      </div>
      <div class="overflow-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">批次号</th>
              <th class="px-3 py-2 font-medium">状态</th>
              <th class="px-3 py-2 font-medium">同款 / compatibilityKey</th>
              <th class="px-3 py-2 font-medium">来源生产单数</th>
              <th class="px-3 py-2 font-medium">来源原始裁片单数</th>
              <th class="px-3 py-2 font-medium">计划裁床组</th>
              <th class="px-3 py-2 font-medium">计划裁剪日期</th>
              <th class="px-3 py-2 font-medium">创建时间</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${ledger
              .map((batch) => {
                const statusMeta = getMergeBatchStatusMeta(batch.status)
                return `
                  <tr class="border-t align-top ${state.activeBatchId === batch.mergeBatchId ? 'bg-blue-50/30' : ''}">
                    <td class="px-3 py-3">
                      <div class="font-medium">${escapeHtml(batch.mergeBatchNo)}</div>
                      ${batch.note ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(batch.note)}</div>` : ''}
                    </td>
                    <td class="px-3 py-3">
                      ${renderStatusBadge(batch.status)}
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(statusMeta.helperText)}</div>
                    </td>
                    <td class="px-3 py-3">
                      <div class="font-medium">${escapeHtml(batch.styleCode || batch.spuCode)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(batch.compatibilityKey)}</div>
                    </td>
                    <td class="px-3 py-3">${batch.sourceProductionOrderCount}</td>
                    <td class="px-3 py-3">${batch.sourceOriginalCutOrderCount}</td>
                    <td class="px-3 py-3">${escapeHtml(batch.plannedCuttingGroup || '-')}</td>
                    <td class="px-3 py-3">${escapeHtml(batch.plannedCuttingDate || '-')}</td>
                    <td class="px-3 py-3">${escapeHtml(batch.createdAt || '-')}</td>
                    <td class="px-3 py-3">
                      <div class="flex flex-wrap gap-2">
                        <button class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-merge-batches-action="open-detail" data-batch-id="${escapeHtml(batch.mergeBatchId)}">查看详情</button>
                        <button class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-merge-batches-action="go-marker-spreading" data-batch-id="${escapeHtml(batch.mergeBatchId)}">去唛架 / 铺布</button>
                        <button class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-merge-batches-action="go-original-orders-batch" data-batch-id="${escapeHtml(batch.mergeBatchId)}">查看原始裁片单</button>
                        ${
                          batch.status !== 'DONE' && batch.status !== 'CANCELLED'
                            ? `<button class="rounded-md border px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50" data-merge-batches-action="set-status" data-batch-id="${escapeHtml(batch.mergeBatchId)}" data-next-status="CANCELLED">作废 / 取消</button>`
                            : ''
                        }
                      </div>
                    </td>
                  </tr>
                `
              })
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderBatchDetail(batch: MergeBatchRecord | null): string {
  if (!batch) {
    return `
      <aside class="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        当前尚未选中批次，可从左侧台账列表查看某个批次的来源构成。
      </aside>
    `
  }

  const sourceGroups = groupMergeBatchItemsByProductionOrder(batch.items)
  const transitions = getStatusTransitions(batch)
  const statusMeta = getMergeBatchStatusMeta(batch.status)

  return `
    <aside class="rounded-lg border bg-card">
      <div class="border-b px-4 py-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold">${escapeHtml(batch.mergeBatchNo)}</h2>
            <p class="mt-1 text-xs text-muted-foreground">批次仅作为执行层上下文，不改变生产单与原始裁片单归属。</p>
          </div>
          ${renderStatusBadge(batch.status)}
        </div>
      </div>

      <div class="space-y-4 px-4 py-4">
        <section class="rounded-lg border bg-muted/10 p-3">
          <h3 class="text-sm font-semibold">批次主信息</h3>
          <div class="mt-3 grid gap-3 md:grid-cols-2">
            <div class="rounded-md border bg-background px-3 py-2">
              <p class="text-xs text-muted-foreground">同款 / SPU</p>
              <p class="mt-1 font-medium">${escapeHtml(batch.styleCode || batch.spuCode)}</p>
            </div>
            <div class="rounded-md border bg-background px-3 py-2">
              <p class="text-xs text-muted-foreground">compatibilityKey</p>
              <p class="mt-1 font-medium">${escapeHtml(batch.compatibilityKey)}</p>
            </div>
            <div class="rounded-md border bg-background px-3 py-2">
              <p class="text-xs text-muted-foreground">计划裁床组</p>
              <p class="mt-1 font-medium">${escapeHtml(batch.plannedCuttingGroup || '-')}</p>
            </div>
            <div class="rounded-md border bg-background px-3 py-2">
              <p class="text-xs text-muted-foreground">计划裁剪日期</p>
              <p class="mt-1 font-medium">${escapeHtml(batch.plannedCuttingDate || '-')}</p>
            </div>
            <div class="rounded-md border bg-background px-3 py-2">
              <p class="text-xs text-muted-foreground">创建时间</p>
              <p class="mt-1 font-medium">${escapeHtml(batch.createdAt || '-')}</p>
            </div>
            <div class="rounded-md border bg-background px-3 py-2">
              <p class="text-xs text-muted-foreground">来源摘要</p>
              <p class="mt-1 font-medium">${batch.sourceProductionOrderCount} 个生产单 / ${batch.sourceOriginalCutOrderCount} 个原始裁片单</p>
            </div>
          </div>
          ${batch.note ? `<p class="mt-3 text-sm text-muted-foreground">备注：${escapeHtml(batch.note)}</p>` : ''}
          <p class="mt-3 text-xs text-muted-foreground">${escapeHtml(statusMeta.helperText)}</p>
        </section>

        <section class="rounded-lg border bg-muted/10 p-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm font-semibold">来源生产单摘要</h3>
            <span class="text-xs text-muted-foreground">同一生产单下不同原始裁片单可进入不同批次</span>
          </div>
          <div class="mt-3 space-y-3">
            ${sourceGroups
              .map(
                (group) => `
                  <div class="rounded-lg border bg-background px-3 py-3">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div class="font-medium">${escapeHtml(group.productionOrderNo)}</div>
                        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(group.styleCode)} · ${escapeHtml(group.styleName)} · ${escapeHtml(group.urgencyLabel)} · 发货 ${escapeHtml(group.plannedShipDateDisplay)}</div>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="text-xs text-muted-foreground">原始裁片单 ${group.itemCount} 条</span>
                        <button class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-merge-batches-action="go-original-orders-production" data-batch-id="${escapeHtml(batch.mergeBatchId)}" data-production-order-no="${escapeHtml(group.productionOrderNo)}">查看原始裁片单</button>
                      </div>
                    </div>
                  </div>
                `,
              )
              .join('')}
          </div>
        </section>

        <section class="rounded-lg border bg-muted/10 p-3">
          <h3 class="text-sm font-semibold">原始裁片单明细</h3>
          <div class="mt-3 overflow-hidden rounded-lg border">
            <table class="min-w-full text-left text-sm">
              <thead class="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 font-medium">原始裁片单号</th>
                  <th class="px-3 py-2 font-medium">生产单号</th>
                  <th class="px-3 py-2 font-medium">面料 SKU</th>
                  <th class="px-3 py-2 font-medium">面料类别</th>
                  <th class="px-3 py-2 font-medium">当前阶段</th>
                  <th class="px-3 py-2 font-medium">来源 compatibilityKey</th>
                </tr>
              </thead>
              <tbody>
                ${batch.items
                  .map(
                    (item) => `
                      <tr class="border-t">
                        <td class="px-3 py-2 font-medium">${escapeHtml(item.originalCutOrderNo)}</td>
                        <td class="px-3 py-2">${escapeHtml(item.productionOrderNo)}</td>
                        <td class="px-3 py-2">${escapeHtml(item.materialSku)}</td>
                        <td class="px-3 py-2">${escapeHtml(item.materialCategory)}</td>
                        <td class="px-3 py-2">${escapeHtml(item.currentStage)}</td>
                        <td class="px-3 py-2">${escapeHtml(item.sourceCompatibilityKey)}</td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </section>

        <section class="rounded-lg border bg-blue-50/60 p-3">
          <h3 class="text-sm font-semibold">说明与下一步</h3>
          <ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>本批次仅为执行层对象，不改变生产单身份。</li>
            <li>本批次仅为执行层对象，不改变原始裁片单身份。</li>
            <li>后续若从本批次发起菲票打印，菲票仍归属原始裁片单。</li>
            <li>本页下一步可进入“唛架 / 铺布”，继续承接执行上下文。</li>
          </ul>
        </section>

        <div class="flex flex-wrap items-center gap-2">
          ${transitions
            .map((item) =>
              renderActionButton(
                item.label,
                `data-merge-batches-action="set-status" data-batch-id="${escapeHtml(batch.mergeBatchId)}" data-next-status="${item.status}"`,
              ),
            )
            .join('')}
          ${renderActionButton(
            '去唛架 / 铺布',
            `data-merge-batches-action="go-marker-spreading" data-batch-id="${escapeHtml(batch.mergeBatchId)}"`,
            'primary',
          )}
          ${renderActionButton(
            '查看原始裁片单',
            `data-merge-batches-action="go-original-orders-batch" data-batch-id="${escapeHtml(batch.mergeBatchId)}"`,
          )}
          ${renderActionButton('返回可裁排产', 'data-merge-batches-action="go-cuttable-pool"')}
        </div>
      </div>
    </aside>
  `
}

function renderBatchWorkbench(ledger: MergeBatchRecord[]): string {
  const filteredLedger = filterLedger(ledger)
  const activeBatch = getActiveBatch(filteredLedger.length ? filteredLedger : ledger)

  return `
    <section class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div class="space-y-4">
        ${renderLedgerFilters(ledger)}
        ${renderLedgerTable(filteredLedger)}
      </div>
      ${renderBatchDetail(activeBatch)}
    </section>
  `
}

function createBatch(status: MergeBatchStatus): boolean {
  const ledger = getMergedLedger()
  const { incoming, validation } = getIncomingSelection(ledger)
  if (!validation.ok) {
    setFeedback('warning', validation.reasons[0] || '当前输入暂不能创建合并裁剪批次。')
    return true
  }

  const batch = createMergeBatchDraft({
    items: incoming.items,
    form: state.draftForm,
    status,
    existingBatches: ledger,
  })

  upsertBatch(batch)
  clearIncomingSelection()
  state.draftForm = { ...initialDraftForm }
  state.activeBatchId = batch.mergeBatchId
  setFeedback('success', `${batch.mergeBatchNo} 已${status === 'DRAFT' ? '保存为草稿' : '创建为待裁批次'}。`)
  return true
}

function updateBatchStatus(batchId: string | undefined, nextStatus: MergeBatchStatus | undefined): boolean {
  if (!batchId || !nextStatus) return false

  const batch = getMergedLedger().find((item) => item.mergeBatchId === batchId)
  if (!batch) return false

  const nextBatch: MergeBatchRecord = {
    ...batch,
    status: nextStatus,
    updatedAt: nowText(),
  }
  upsertBatch(nextBatch)
  state.activeBatchId = batchId
  setFeedback('success', `${batch.mergeBatchNo} 已更新为“${getMergeBatchStatusMeta(nextStatus).label}”。`)
  return true
}

function buildRouteWithQuery(path: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value)
  })
  const query = search.toString()
  return query ? `${path}?${query}` : path
}

function goMarkerSpreading(batchId: string | undefined): boolean {
  if (!batchId) {
    setFeedback('warning', '请先选择一个批次，再进入唛架 / 铺布。')
    return true
  }
  appStore.navigate(buildRouteWithQuery(getCanonicalCuttingPath('marker-spreading'), { mergeBatchId: batchId }))
  return true
}

function goOriginalOrdersByBatch(batchId: string | undefined): boolean {
  if (!batchId) {
    setFeedback('warning', '请先选择一个批次，再查看来源原始裁片单。')
    return true
  }
  appStore.navigate(buildRouteWithQuery(getCanonicalCuttingPath('original-orders'), { mergeBatchId: batchId }))
  return true
}

export function renderCraftCuttingMergeBatchesPage(): string {
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'merge-batches')
  const ledger = getMergedLedger()
  const incoming = getIncomingSelection(ledger)
  const activeBatch = getActiveBatch(ledger)

  return `
    <div class="space-y-4 p-4">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderHeaderActions(activeBatch),
        showCompatibilityBadge: isCuttingAliasPath(pathname),
      })}
      ${renderStatsCards(ledger, incoming.incoming.items.length)}
      ${renderFeedbackBar()}
      ${renderIncomingDraftZone(ledger)}
      ${renderBatchWorkbench(ledger)}
    </div>
  `
}

export function handleCraftCuttingMergeBatchesEvent(target: Element): boolean {
  const draftFieldNode = target.closest<HTMLElement>('[data-merge-batches-draft-field]')
  if (draftFieldNode) {
    const field = draftFieldNode.dataset.mergeBatchesDraftField as MergeBatchDraftField | undefined
    if (!field) return false
    const input = draftFieldNode as HTMLInputElement | HTMLTextAreaElement
    state.draftForm[field] = input.value
    return true
  }

  const filterFieldNode = target.closest<HTMLElement>('[data-merge-batches-filter-field]')
  if (filterFieldNode) {
    const field = filterFieldNode.dataset.mergeBatchesFilterField as MergeBatchFilterField | undefined
    if (!field) return false
    const input = filterFieldNode as HTMLInputElement | HTMLSelectElement
    if (field === 'keyword') state.ledgerFilters.keyword = input.value
    if (field === 'status') state.ledgerFilters.status = input.value as MergeBatchLedgerFilters['status']
    if (field === 'cuttingGroup') state.ledgerFilters.cuttingGroup = input.value
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-merge-batches-action]')
  const action = actionNode?.dataset.mergeBatchesAction
  if (!action) return false

  if (action === 'clear-feedback') {
    clearFeedback()
    return true
  }

  if (action === 'go-cuttable-pool') {
    appStore.navigate(getCanonicalCuttingPath('cuttable-pool'))
    return true
  }

  if (action === 'go-summary') {
    appStore.navigate(getCanonicalCuttingPath('summary'))
    return true
  }

  if (action === 'go-marker-spreading') {
    return goMarkerSpreading(actionNode.dataset.batchId)
  }

  if (action === 'go-original-orders-batch') {
    return goOriginalOrdersByBatch(actionNode.dataset.batchId)
  }

  if (action === 'go-original-orders-production') {
    appStore.navigate(
      buildRouteWithQuery(getCanonicalCuttingPath('original-orders'), {
        mergeBatchId: actionNode.dataset.batchId,
        productionOrderNo: actionNode.dataset.productionOrderNo,
      }),
    )
    return true
  }

  if (action === 'save-draft') {
    return createBatch('DRAFT')
  }

  if (action === 'create-ready') {
    return createBatch('READY')
  }

  if (action === 'clear-incoming') {
    clearIncomingSelection()
    state.draftForm = { ...initialDraftForm }
    clearFeedback()
    return true
  }

  if (action === 'open-detail') {
    if (!actionNode.dataset.batchId) return false
    state.activeBatchId = actionNode.dataset.batchId
    return true
  }

  if (action === 'set-status') {
    return updateBatchStatus(actionNode.dataset.batchId, actionNode.dataset.nextStatus as MergeBatchStatus | undefined)
  }

  return false
}

export function isCraftCuttingMergeBatchesDialogOpen(): boolean {
  return false
}
