import { renderDrawer as uiDrawer } from '../../../components/ui'
import { appStore } from '../../../state/store'
import { escapeHtml } from '../../../utils'
import {
  CUTTING_MERGE_BATCH_LEDGER_STORAGE_KEY,
  deserializeMergeBatchStorage,
  getMergeBatchStatusMeta,
  groupMergeBatchItemsByProductionOrder,
  normalizeMergeBatchStatus,
  serializeMergeBatchStorage,
  type MergeBatchRecord,
  type MergeBatchStatus,
} from './merge-batches-model'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta'
import { renderCompactKpiCard, renderStickyFilterShell } from './layout.helpers'
import { buildMergeBatchesProjection } from './merge-batches-projection'

type MergeBatchFilterField = 'keyword' | 'status'

interface MergeBatchLedgerFilters {
  keyword: string
  status: 'ALL' | MergeBatchStatus
}

interface MergeBatchFeedback {
  tone: 'success' | 'warning'
  message: string
}

interface MergeBatchPageState {
  ledgerFilters: MergeBatchLedgerFilters
  activeBatchId: string
  feedback: MergeBatchFeedback | null
  querySignature: string
}

const state: MergeBatchPageState = {
  ledgerFilters: {
    keyword: '',
    status: 'ALL',
  },
  activeBatchId: '',
  feedback: null,
  querySignature: '',
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

function getProjection() {
  return buildMergeBatchesProjection()
}

function getMergedLedger(): MergeBatchRecord[] {
  return getProjection().sources.mergeBatches
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

function getActiveBatch(ledger = getMergedLedger()): MergeBatchRecord | null {
  if (!state.activeBatchId) return null
  const matched = ledger.find((batch) => batch.mergeBatchId === state.activeBatchId) ?? null
  if (!matched) {
    state.activeBatchId = ''
  }
  return matched
}

function setFeedback(tone: MergeBatchFeedback['tone'], message: string): void {
  state.feedback = { tone, message }
}

function clearFeedback(): void {
  state.feedback = null
}

function getCurrentSearchParams(): URLSearchParams {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return new URLSearchParams(query || '')
}

function openBatchDetail(batchId: string | undefined, ledger = getMergedLedger()): boolean {
  if (!batchId) return false
  const batch = ledger.find((item) => item.mergeBatchId === batchId) ?? null
  if (!batch) return false
  state.activeBatchId = batch.mergeBatchId
  return true
}

function closeBatchDetail(): boolean {
  state.activeBatchId = ''

  const params = getCurrentSearchParams()
  if (!params.has('focusBatchId') && !params.has('createdBatchNo')) return true
  params.delete('focusBatchId')
  params.delete('createdBatchNo')
  const query = params.toString()
  appStore.navigate(query ? `${getCanonicalCuttingPath('merge-batches')}?${query}` : getCanonicalCuttingPath('merge-batches'))
  return true
}

function syncStateFromPath(ledger = getMergedLedger()): void {
  const pathname = appStore.getState().pathname
  if (state.querySignature === pathname) return
  state.querySignature = pathname

  const params = getCurrentSearchParams()
  const focusBatchId = params.get('focusBatchId') || ''
  const createdBatchNo = params.get('createdBatchNo') || ''

  if (focusBatchId) {
    const matched = ledger.find((batch) => batch.mergeBatchId === focusBatchId) ?? null
    state.activeBatchId = matched?.mergeBatchId || ''
  } else {
    state.activeBatchId = ''
  }

  if (createdBatchNo) {
    setFeedback('success', `已创建裁剪批次 ${createdBatchNo}。`)
  }
}

function renderStatusBadge(status: MergeBatchStatus): string {
  const meta = getMergeBatchStatusMeta(status)
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}">${escapeHtml(meta.label)}</span>`
}

function renderActionButton(
  label: string,
  attrs: string,
  variant: 'primary' | 'secondary' = 'secondary',
  disabled = false,
): string {
  const baseClass =
    variant === 'primary'
      ? 'rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700'
      : 'rounded-md border px-3 py-2 text-sm hover:bg-muted'

  return `
    <button
      type="button"
      ${attrs}
      ${disabled ? 'disabled' : ''}
      class="${baseClass} ${disabled ? 'cursor-not-allowed opacity-60' : ''}"
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
        '去唛架铺布',
        `data-merge-batches-action="go-marker-spreading"${activeBatch ? ` data-batch-id="${escapeHtml(activeBatch.mergeBatchId)}"` : ''}`,
        'primary',
        !activeBatch,
      )}
      ${renderActionButton('去裁剪总表', 'data-merge-batches-action="go-summary"')}
    </div>
  `
}

function buildStats(ledger: MergeBatchRecord[]) {
  return {
    total: ledger.length,
    ready: ledger.filter((batch) => normalizeMergeBatchStatus(batch.status) === 'READY').length,
    cutting: ledger.filter((batch) => normalizeMergeBatchStatus(batch.status) === 'CUTTING').length,
    done: ledger.filter((batch) => normalizeMergeBatchStatus(batch.status) === 'DONE').length,
    cancelled: ledger.filter((batch) => normalizeMergeBatchStatus(batch.status) === 'CANCELLED').length,
  }
}

function renderStatsCards(ledger: MergeBatchRecord[]): string {
  const stats = buildStats(ledger)
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      ${renderCompactKpiCard('批次总数', stats.total, '执行层批次台账', 'text-slate-900')}
      ${renderCompactKpiCard('待裁批次数', stats.ready, '已创建，待进入裁床', 'text-blue-600')}
      ${renderCompactKpiCard('裁剪中批次数', stats.cutting, '当前已进入裁床执行', 'text-amber-600')}
      ${renderCompactKpiCard('已完成批次数', stats.done, '批次执行已结束', 'text-emerald-600')}
      ${renderCompactKpiCard('已取消批次数', stats.cancelled, '当前已取消的批次', 'text-rose-600')}
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

function renderLedgerFilters(ledger: MergeBatchRecord[]): string {
  return renderStickyFilterShell(`
    <div class="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)]">
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
        { value: 'READY', label: '待裁' },
        { value: 'CUTTING', label: '裁剪中' },
        { value: 'DONE', label: '已完成' },
        { value: 'CANCELLED', label: '已取消' },
      ])}
    </div>
  `)
}

function filterLedger(ledger: MergeBatchRecord[]): MergeBatchRecord[] {
  const keyword = state.ledgerFilters.keyword.trim().toLowerCase()

  return ledger.filter((batch) => {
    if (state.ledgerFilters.status !== 'ALL' && normalizeMergeBatchStatus(batch.status) !== state.ledgerFilters.status) return false
    if (!keyword) return true

    const keywordValues = [
      batch.mergeBatchNo,
      batch.styleCode,
      batch.spuCode,
      batch.styleName,
      batch.compatibilityKey,
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
  const visibleStatus = normalizeMergeBatchStatus(batch.status)

  if (visibleStatus === 'READY') {
    return [
      { status: 'CUTTING', label: '标记裁剪中' },
      { status: 'CANCELLED', label: '作废 / 取消' },
    ]
  }

  if (visibleStatus === 'CUTTING') {
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
      <section class="rounded-lg border bg-card px-6 py-10 text-center text-sm text-muted-foreground" data-testid="cutting-merge-batches-ledger">
        当前还没有批次台账，可先去可裁排产选择原始裁片单并创建裁剪批次。
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card" data-testid="cutting-merge-batches-ledger">
      <div class="border-b px-4 py-3">
        <h2 class="text-sm font-semibold">批次列表</h2>
        <p class="mt-1 text-xs text-muted-foreground">默认只看列表，点击某条批次后从右侧查看详情与状态。</p>
      </div>
      <div class="overflow-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">批次号</th>
              <th class="px-3 py-2 font-medium">状态</th>
              <th class="px-3 py-2 font-medium">同款 / SPU</th>
              <th class="px-3 py-2 font-medium">面料 SKU</th>
              <th class="px-3 py-2 font-medium">来源摘要</th>
              <th class="px-3 py-2 font-medium">创建时间</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${ledger
              .map((batch) => `
                <tr class="border-t align-top ${state.activeBatchId === batch.mergeBatchId ? 'bg-blue-50/30' : ''}">
                  <td class="px-3 py-3">
                    <div class="font-medium">${escapeHtml(batch.mergeBatchNo)}</div>
                  </td>
                  <td class="px-3 py-3">${renderStatusBadge(batch.status)}</td>
                  <td class="px-3 py-3">
                    <div class="font-medium">${escapeHtml(batch.styleCode || batch.spuCode)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(batch.styleName || '-')}</div>
                  </td>
                  <td class="px-3 py-3">${escapeHtml(batch.materialSkuSummary || '-')}</td>
                  <td class="px-3 py-3">${batch.sourceProductionOrderCount} 个生产单 / ${batch.sourceOriginalCutOrderCount} 个原始裁片单</td>
                  <td class="px-3 py-3">${escapeHtml(batch.createdAt || '-')}</td>
                  <td class="px-3 py-3">
                    ${renderActionButton('查看详情', `data-merge-batches-action="open-detail" data-batch-id="${escapeHtml(batch.mergeBatchId)}"`)}
                  </td>
                </tr>
              `)
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderFieldCard(label: string, value: string): string {
  return `
    <div class="rounded-md border bg-background px-3 py-2">
      <p class="text-xs text-muted-foreground">${escapeHtml(label)}</p>
      <p class="mt-1 text-sm font-medium">${escapeHtml(value || '-')}</p>
    </div>
  `
}

function renderBatchBasicInfo(batch: MergeBatchRecord): string {
  const statusMeta = getMergeBatchStatusMeta(batch.status)
  const transitions = getStatusTransitions(batch)
  return `
    <section class="space-y-3 rounded-lg border bg-muted/10 p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold">批次基础信息</h3>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(statusMeta.helperText)}</p>
        </div>
        ${renderStatusBadge(batch.status)}
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        ${renderFieldCard('批次号', batch.mergeBatchNo)}
        ${renderFieldCard('同款 / SPU', batch.styleCode || batch.spuCode)}
        ${renderFieldCard('compatibilityKey', batch.compatibilityKey)}
        ${renderFieldCard('创建时间', batch.createdAt || '-')}
        ${renderFieldCard('来源生产单数', String(batch.sourceProductionOrderCount))}
        ${renderFieldCard('来源原始裁片单数', String(batch.sourceOriginalCutOrderCount))}
      </div>
      ${
        transitions.length
          ? `
            <div class="flex flex-wrap gap-2">
              ${transitions
                .map((item) =>
                  renderActionButton(
                    item.label,
                    `data-merge-batches-action="set-status" data-batch-id="${escapeHtml(batch.mergeBatchId)}" data-next-status="${item.status}"`,
                  ),
                )
                .join('')}
            </div>
          `
          : ''
      }
    </section>
  `
}

function renderSourceProductionOrders(batch: MergeBatchRecord): string {
  const sourceGroups = groupMergeBatchItemsByProductionOrder(batch.items)
  const productionRowMap = new Map(getProjection().sources.productionRows.map((row) => [row.productionOrderId, row]))

  return `
    <section class="space-y-3 rounded-lg border bg-muted/10 p-4">
      <div>
        <h3 class="text-sm font-semibold">来源生产单</h3>
        <p class="mt-1 text-xs text-muted-foreground">同一批次可来自多个生产单，但只承接兼容的原始裁片单。</p>
      </div>
      <div class="space-y-3">
        ${sourceGroups
          .map((group) => {
            const row = productionRowMap.get(group.productionOrderId)
            return `
              <div class="rounded-lg border bg-background px-3 py-3">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="space-y-1">
                    <div class="font-medium">${escapeHtml(group.productionOrderNo)}</div>
                    <div class="text-xs text-muted-foreground">${escapeHtml(group.styleCode)} · ${escapeHtml(group.styleName)}</div>
                    <div class="text-xs text-muted-foreground">工厂：${escapeHtml(row?.assignedFactoryName || '-')} · 发货：${escapeHtml(group.plannedShipDateDisplay || '-')}</div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-muted-foreground">原始裁片单 ${group.itemCount} 条</span>
                    <button
                      class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
                      data-merge-batches-action="go-original-orders-production"
                      data-batch-id="${escapeHtml(batch.mergeBatchId)}"
                      data-production-order-id="${escapeHtml(group.productionOrderId)}"
                      data-production-order-no="${escapeHtml(group.productionOrderNo)}"
                    >
                      查看原始裁片单
                    </button>
                  </div>
                </div>
              </div>
            `
          })
          .join('')}
      </div>
    </section>
  `
}

function renderSourceOriginalOrders(batch: MergeBatchRecord): string {
  return `
    <section class="space-y-3 rounded-lg border bg-muted/10 p-4">
      <div>
        <h3 class="text-sm font-semibold">原始裁片单明细</h3>
        <p class="mt-1 text-xs text-muted-foreground">在这里继续核对批次来源，不再整页铺开默认详情。</p>
      </div>
      <div class="overflow-hidden rounded-lg border bg-background">
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
            ${batch.items
              .map(
                (item) => `
                  <tr class="border-t">
                    <td class="px-3 py-2 font-medium">${escapeHtml(item.originalCutOrderNo)}</td>
                    <td class="px-3 py-2">${escapeHtml(item.productionOrderNo)}</td>
                    <td class="px-3 py-2">${escapeHtml(item.materialSku)}</td>
                    <td class="px-3 py-2">${escapeHtml(item.currentStage || item.cuttableStateLabel || '-')}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderBatchDetailDrawer(batch: MergeBatchRecord | null): string {
  if (!batch) return ''

  const content = `
    <div class="space-y-4" data-testid="cutting-merge-batches-detail-drawer">
      ${renderBatchBasicInfo(batch)}
      ${renderSourceProductionOrders(batch)}
      ${renderSourceOriginalOrders(batch)}
    </div>
  `

  return uiDrawer(
    {
      title: '批次详情',
      subtitle: batch.mergeBatchNo,
      closeAction: { prefix: 'merge-batches', action: 'close-detail-drawer' },
      width: 'lg',
    },
    content,
    {
      cancel: { prefix: 'merge-batches', action: 'close-detail-drawer', label: '关闭' },
    },
  )
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
    setFeedback('warning', '请先选择一个批次，再进入唛架铺布。')
    return true
  }
  const batch = getMergedLedger().find((item) => item.mergeBatchId === batchId)
  appStore.navigate(
    buildRouteWithQuery(getCanonicalCuttingPath('marker-spreading'), {
      mergeBatchId: batchId,
      mergeBatchNo: batch?.mergeBatchNo,
      tab: 'spreadings',
    }),
  )
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
  syncStateFromPath(ledger)
  const activeBatch = getActiveBatch(ledger)
  const filteredLedger = filterLedger(ledger)

  return `
    <div class="space-y-4 p-4" data-testid="cutting-merge-batches-page">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: renderHeaderActions(activeBatch),
        showCompatibilityBadge: isCuttingAliasPath(pathname),
      })}
      ${renderStatsCards(ledger)}
      ${renderFeedbackBar()}
      ${renderLedgerFilters(ledger)}
      ${renderLedgerTable(filteredLedger)}
      ${renderBatchDetailDrawer(activeBatch)}
    </div>
  `
}

export function handleCraftCuttingMergeBatchesEvent(target: Element): boolean {
  const filterFieldNode = target.closest<HTMLElement>('[data-merge-batches-filter-field]')
  if (filterFieldNode) {
    const field = filterFieldNode.dataset.mergeBatchesFilterField as MergeBatchFilterField | undefined
    if (!field) return false
    const input = filterFieldNode as HTMLInputElement | HTMLSelectElement
    if (field === 'keyword') state.ledgerFilters.keyword = input.value
    if (field === 'status') state.ledgerFilters.status = input.value as MergeBatchLedgerFilters['status']
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-merge-batches-action]')
  const action = actionNode?.dataset.mergeBatchesAction
  if (!action) return false

  if (action === 'clear-feedback') {
    clearFeedback()
    return true
  }

  if (action === 'close-detail-drawer') {
    return closeBatchDetail()
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
    return goMarkerSpreading(actionNode.dataset.batchId || state.activeBatchId)
  }

  if (action === 'go-original-orders-batch') {
    return goOriginalOrdersByBatch(actionNode.dataset.batchId || state.activeBatchId)
  }

  if (action === 'go-original-orders-production') {
    appStore.navigate(
      buildRouteWithQuery(getCanonicalCuttingPath('original-orders'), {
        mergeBatchId: actionNode.dataset.batchId,
        productionOrderId: actionNode.dataset.productionOrderId,
        productionOrderNo: actionNode.dataset.productionOrderNo,
      }),
    )
    return true
  }

  if (action === 'open-detail') {
    return openBatchDetail(actionNode.dataset.batchId)
  }

  if (action === 'set-status') {
    return updateBatchStatus(actionNode.dataset.batchId || state.activeBatchId, actionNode.dataset.nextStatus as MergeBatchStatus | undefined)
  }

  return false
}

export function isCraftCuttingMergeBatchesDialogOpen(): boolean {
  return Boolean(state.activeBatchId)
}
