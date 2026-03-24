import { renderFormDialog as uiFormDialog } from '../../../components/ui'
import { cuttingOrderProgressRecords } from '../../../data/fcs/cutting/order-progress'
import { appStore } from '../../../state/store'
import { escapeHtml } from '../../../utils'
import { buildCuttablePoolViewModel } from './cuttable-pool-model'
import { buildMaterialPrepViewModel, type MaterialPrepRow } from './material-prep-model'
import {
  buildSystemSeedMergeBatches,
  CUTTING_MERGE_BATCH_LEDGER_STORAGE_KEY,
  deserializeMergeBatchStorage,
  type MergeBatchRecord,
} from './merge-batches-model'
import {
  buildMarkerSeedDraft,
  buildMarkerSpreadingNavigationPayload,
  buildMarkerSpreadingViewModel,
  buildReplenishmentPreview,
  buildSpreadingVarianceSummary,
  computeMarkerTotalPieces,
  computeUsableLength,
  createEmptyStore,
  createOperatorRecordDraft,
  createRollRecordDraft,
  createSpreadingDraftFromMarker,
  CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
  deriveMarkerModeMeta,
  deriveSpreadingStatus,
  deserializeMarkerSpreadingStorage,
  formatSpreadingLength,
  serializeMarkerSpreadingStorage,
  summarizeContextHint,
  summarizeSpreadingRolls,
  upsertMarkerRecord,
  upsertSpreadingSession,
  updateSessionStatus,
  type MarkerModeKey,
  type MarkerRecord,
  type MarkerSpreadingContext,
  type MarkerSpreadingPrefilter,
  type MarkerSpreadingStore,
  type MarkerSpreadingViewModel,
  type SpreadingOperatorRecord,
  type SpreadingRollRecord,
  type SpreadingSession,
  type SpreadingStatusKey,
  type SpreadingVarianceSummary,
} from './marker-spreading-model'
import {
  applyWritebackToSpreadingSession,
  buildMockPdaWritebacks,
  buildPdaSupplementDraft,
  buildPdaWritebackStats,
  buildWritebackAuditTrail,
  createEmptyPdaWritebackStore,
  CUTTING_PDA_WRITEBACK_STORAGE_KEY,
  derivePdaWritebackStatus,
  hydrateIncomingPdaWritebacks,
  normalizePdaWritebackPayload,
  resolvePdaWritebackStatus,
  serializePdaWritebackStorage,
  type PdaSpreadingWriteback,
  type PdaSupplementDraft,
  type PdaWritebackAuditTrail,
  type PdaWritebackStatusKey,
  type PdaWritebackStore,
} from './pda-writeback-model'
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from './meta'
import { renderCompactKpiCard, renderWorkbenchFilterChip, renderWorkbenchStateBar } from './layout.helpers'

type MarkerField = 'markerMode' | 'netLength' | 'singlePieceUsage' | 'note'
type PdaSupplementField =
  | 'sourceAccountId'
  | 'sourceAccountName'
  | 'originalCutOrderIdsText'
  | 'originalCutOrderNosText'
  | 'mergeBatchId'
  | 'mergeBatchNo'
  | 'note'
type RollField =
  | 'rollNo'
  | 'materialSku'
  | 'width'
  | 'labeledLength'
  | 'actualLength'
  | 'headLength'
  | 'tailLength'
  | 'layerCount'
  | 'operatorNames'
  | 'handoverNotes'
  | 'note'
type OperatorField = 'operatorName' | 'startAt' | 'endAt' | 'actionType' | 'note'
type DialogType = 'ROLL' | 'OPERATOR' | null
type FeedbackTone = 'success' | 'warning'

interface MarkerSpreadingFeedback {
  tone: FeedbackTone
  message: string
}

interface MarkerSpreadingPageState {
  store: MarkerSpreadingStore
  pdaStore: PdaWritebackStore
  querySignature: string
  prefilter: MarkerSpreadingPrefilter | null
  pdaStatusFilter: PdaWritebackStatusKey | 'ALL'
  markerDraft: MarkerRecord | null
  activeSessionId: string | null
  activeWritebackId: string | null
  activeDialog: DialogType
  rollDraft: SpreadingRollRecord | null
  operatorDraft: SpreadingOperatorRecord | null
  pdaJsonDraft: string
  supplementDraft: PdaSupplementDraft | null
  feedback: MarkerSpreadingFeedback | null
}

const state: MarkerSpreadingPageState = {
  store: createEmptyStore(),
  pdaStore: createEmptyPdaWritebackStore(),
  querySignature: '',
  prefilter: null,
  pdaStatusFilter: 'ALL',
  markerDraft: null,
  activeSessionId: null,
  activeWritebackId: null,
  activeDialog: null,
  rollDraft: null,
  operatorDraft: null,
  pdaJsonDraft: '',
  supplementDraft: null,
  feedback: null,
}

function getCurrentQueryString(): string {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return query || ''
}

function getCurrentSearchParams(): URLSearchParams {
  return new URLSearchParams(getCurrentQueryString())
}

function buildRouteWithQuery(pathname: string, payload?: Record<string, string | undefined>): string {
  if (!payload) return pathname

  const params = new URLSearchParams()
  Object.entries(payload).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })

  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

function formatDate(value: string): string {
  return value || '待补'
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.max(value, 0))
}

function readStoredMarkerLedger(): MarkerSpreadingStore {
  try {
    return deserializeMarkerSpreadingStorage(localStorage.getItem(CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY))
  } catch {
    return createEmptyStore()
  }
}

function persistMarkerLedger(store: MarkerSpreadingStore): void {
  state.store = store
  localStorage.setItem(CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY, serializeMarkerSpreadingStorage(store))
}

function readStoredPdaWritebacks(): PdaWritebackStore {
  try {
    return hydrateIncomingPdaWritebacks(localStorage)
  } catch {
    return createEmptyPdaWritebackStore()
  }
}

function persistPdaWritebacks(store: PdaWritebackStore): void {
  state.pdaStore = store
  localStorage.setItem(CUTTING_PDA_WRITEBACK_STORAGE_KEY, serializePdaWritebackStorage(store))
}

function readStoredMergeBatches(): MergeBatchRecord[] {
  try {
    return deserializeMergeBatchStorage(localStorage.getItem(CUTTING_MERGE_BATCH_LEDGER_STORAGE_KEY))
  } catch {
    return []
  }
}

function getMergeBatchLedger(): MergeBatchRecord[] {
  const cuttablePoolView = buildCuttablePoolViewModel(cuttingOrderProgressRecords)
  const systemSeed = buildSystemSeedMergeBatches(Object.values(cuttablePoolView.itemsById))
  const merged = new Map(systemSeed.map((batch) => [batch.mergeBatchId, batch]))

  for (const batch of readStoredMergeBatches()) {
    merged.set(batch.mergeBatchId, batch)
  }

  return Array.from(merged.values()).sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt, 'zh-CN') ||
      right.createdAt.localeCompare(left.createdAt, 'zh-CN') ||
      right.mergeBatchNo.localeCompare(left.mergeBatchNo, 'zh-CN'),
  )
}

function getMaterialPrepRows(): MaterialPrepRow[] {
  return buildMaterialPrepViewModel(cuttingOrderProgressRecords, getMergeBatchLedger()).rows
}

function getViewModel(): MarkerSpreadingViewModel {
  return buildMarkerSpreadingViewModel({
    rows: getMaterialPrepRows(),
    mergeBatches: getMergeBatchLedger(),
    store: state.store,
    prefilter: state.prefilter,
  })
}

function parsePrefilterFromPath(): MarkerSpreadingPrefilter | null {
  const params = getCurrentSearchParams()
  const nextPrefilter: MarkerSpreadingPrefilter = {}

  const entries: Array<[keyof MarkerSpreadingPrefilter, string | null]> = [
    ['originalCutOrderId', params.get('originalCutOrderId')],
    ['originalCutOrderNo', params.get('originalCutOrderNo')],
    ['mergeBatchId', params.get('mergeBatchId')],
    ['mergeBatchNo', params.get('mergeBatchNo')],
    ['productionOrderNo', params.get('productionOrderNo')],
    ['styleCode', params.get('styleCode')],
    ['spuCode', params.get('spuCode')],
    ['materialSku', params.get('materialSku')],
  ]

  entries.forEach(([key, value]) => {
    if (value) nextPrefilter[key] = value
  })

  return Object.keys(nextPrefilter).length ? nextPrefilter : null
}

function parsePdaStatusFilterFromPath(): PdaWritebackStatusKey | 'ALL' {
  const raw = getCurrentSearchParams().get('pdaStatus')
  if (raw === 'PENDING_REVIEW' || raw === 'APPLIED' || raw === 'CONFLICT' || raw === 'PENDING_SUPPLEMENT' || raw === 'REJECTED') {
    return raw
  }
  return 'ALL'
}

function parseActiveWritebackIdFromPath(): string | null {
  return getCurrentSearchParams().get('writebackId')
}

function syncStateFromPath(): void {
  const pathname = appStore.getState().pathname
  if (state.querySignature === pathname) return

  state.store = readStoredMarkerLedger()
  state.pdaStore = readStoredPdaWritebacks()
  state.prefilter = parsePrefilterFromPath()
  state.pdaStatusFilter = parsePdaStatusFilterFromPath()
  state.activeWritebackId = parseActiveWritebackIdFromPath()
  state.querySignature = pathname
  state.activeDialog = null
  state.rollDraft = null
  state.operatorDraft = null
  state.supplementDraft = null
  state.feedback = null

  const viewModel = getViewModel()
  state.markerDraft = buildMarkerSeedDraft(viewModel.context, viewModel.markerRecords[0] ?? null)
  state.activeSessionId = viewModel.spreadingSessions[0]?.spreadingSessionId ?? null
}

function getCurrentContext(viewModel = getViewModel()): MarkerSpreadingContext | null {
  return viewModel.context
}

function getCurrentMarker(viewModel = getViewModel()): MarkerRecord | null {
  return state.markerDraft ?? buildMarkerSeedDraft(viewModel.context, viewModel.markerRecords[0] ?? null)
}

function getActiveSession(viewModel = getViewModel()): SpreadingSession | null {
  if (!viewModel.spreadingSessions.length) return null
  if (state.activeSessionId) {
    return viewModel.spreadingSessions.find((session) => session.spreadingSessionId === state.activeSessionId) ?? viewModel.spreadingSessions[0]
  }
  return viewModel.spreadingSessions[0]
}

function getCurrentMarkerRoute(overrides?: Record<string, string | undefined | null>): string {
  const params = getCurrentSearchParams()
  Object.entries(overrides ?? {}).forEach(([key, value]) => {
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
  })

  const query = params.toString()
  const basePath = getCanonicalCuttingPath('marker-spreading')
  return query ? `${basePath}?${query}` : basePath
}

function getAllMatchedWritebacks(viewModel = getViewModel()): PdaSpreadingWriteback[] {
  const context = viewModel.context
  const matched = state.pdaStore.writebacks.filter((writeback) => {
    if (!context) return true
    if (context.contextType !== writeback.contextType) return false
    if (context.contextType === 'merge-batch') {
      const currentBatch = context.mergeBatchId || context.mergeBatchNo
      const incomingBatch = writeback.mergeBatchId || writeback.mergeBatchNo
      return Boolean(currentBatch) && currentBatch === incomingBatch
    }
    return writeback.originalCutOrderIds.some((id) => context.originalCutOrderIds.includes(id))
  })

  const withResolvedStatus = matched.map((writeback) => {
    const resolved = resolvePdaWritebackStatus(writeback, context, viewModel.spreadingSessions)
    return resolved.status === writeback.status ? writeback : { ...writeback, status: resolved.status, validationIssues: resolved.validation.issues }
  })

  return withResolvedStatus.sort((left, right) => right.submittedAt.localeCompare(left.submittedAt, 'zh-CN'))
}

function getContextMatchedWritebacks(viewModel = getViewModel()): PdaSpreadingWriteback[] {
  return getAllMatchedWritebacks(viewModel)
    .filter((writeback) => state.pdaStatusFilter === 'ALL' || writeback.status === state.pdaStatusFilter)
}

function getActiveWriteback(viewModel = getViewModel()): PdaSpreadingWriteback | null {
  const items = getContextMatchedWritebacks(viewModel)
  if (!items.length) return null
  if (state.activeWritebackId) {
    return items.find((item) => item.writebackId === state.activeWritebackId) ?? items[0]
  }
  return items[0]
}

function setFeedback(tone: FeedbackTone, message: string): void {
  state.feedback = { tone, message }
}

function clearFeedback(): void {
  state.feedback = null
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function renderSourceChannelBadge(sourceChannel: SpreadingSession['sourceChannel'] | SpreadingRollRecord['sourceChannel'] | SpreadingOperatorRecord['sourceChannel']): string {
  if (sourceChannel === 'PDA_WRITEBACK') {
    return renderBadge('PDA 回写', 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200')
  }
  if (sourceChannel === 'MIXED') {
    return renderBadge('混合来源', 'bg-violet-100 text-violet-700 border-violet-200')
  }
  return renderBadge('后台补录', 'bg-slate-100 text-slate-700 border-slate-200')
}

function renderInfoGrid(items: Array<{ label: string; value: string; hint?: string; tone?: 'default' | 'strong' }>): string {
  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      ${items
        .map(
          (item) => `
            <article class="rounded-lg border bg-muted/10 px-3 py-2">
              <p class="text-xs text-muted-foreground">${escapeHtml(item.label)}</p>
              <p class="mt-1 ${item.tone === 'strong' ? 'text-base font-semibold' : 'text-sm'}">${escapeHtml(item.value || '待补')}</p>
              ${item.hint ? `<p class="mt-1 text-[11px] text-muted-foreground">${escapeHtml(item.hint)}</p>` : ''}
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderSection(title: string, hint: string, body: string, actionsHtml = ''): string {
  return `
    <section class="rounded-lg border bg-card">
      <div class="flex flex-col gap-2 border-b px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 class="text-base font-semibold text-foreground">${escapeHtml(title)}</h2>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(hint)}</p>
        </div>
        ${actionsHtml}
      </div>
      <div class="p-4">
        ${body}
      </div>
    </section>
  `
}

function renderFeedbackBar(): string {
  if (!state.feedback) return ''

  const className =
    state.feedback.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'

  return `
    <section class="flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${className}">
      <span>${escapeHtml(state.feedback.message)}</span>
      <button type="button" class="rounded-md px-2 py-1 text-xs hover:bg-black/5" data-cutting-marker-action="clear-feedback">关闭</button>
    </section>
  `
}

function renderStatsCards(viewModel: MarkerSpreadingViewModel): string {
  const stats = viewModel.stats
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      ${renderCompactKpiCard('唛架记录数', stats.markerCount, '当前上下文 / 原型台账', 'text-slate-900')}
      ${renderCompactKpiCard('铺布记录数', stats.sessionCount, '包含草稿与已完成 session', 'text-blue-600')}
      ${renderCompactKpiCard('进行中铺布数', stats.inProgressCount, '当前仍可继续补录卷与人员', 'text-amber-600')}
      ${renderCompactKpiCard('已完成铺布数', stats.doneCount, '已形成差异测算基础数据', 'text-emerald-600')}
      ${renderCompactKpiCard('铺布总卷数', stats.rollCount, '当前台账内卷记录总数', 'text-violet-600')}
      ${renderCompactKpiCard('预警项数量', stats.warningCount, '存在差异或可能补料的 session', 'text-rose-600')}
    </section>
  `
}

function getPrefilterLabels(): string[] {
  const labels: string[] = []
  const prefilter = state.prefilter
  if (!prefilter && state.pdaStatusFilter === 'ALL') return labels

  if (prefilter?.originalCutOrderNo) labels.push(`原始裁片单：${prefilter.originalCutOrderNo}`)
  if (prefilter?.mergeBatchNo) labels.push(`批次：${prefilter.mergeBatchNo}`)
  if (prefilter?.productionOrderNo) labels.push(`生产单：${prefilter.productionOrderNo}`)
  if (prefilter?.styleCode) labels.push(`款号：${prefilter.styleCode}`)
  if (prefilter?.spuCode) labels.push(`SPU：${prefilter.spuCode}`)
  if (prefilter?.materialSku) labels.push(`面料：${prefilter.materialSku}`)
  if (state.pdaStatusFilter !== 'ALL') {
    labels.push(`PDA 状态：${derivePdaWritebackStatus(state.pdaStatusFilter).label}`)
  }

  return labels
}

function renderPrefilterBar(): string {
  const labels = getPrefilterLabels()
  if (!labels.length) return ''

  return renderWorkbenchStateBar({
    summary: '当前上下文条件',
    chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-cutting-marker-action="clear-prefilter"', 'amber')),
    clearAttrs: 'data-cutting-marker-action="clear-prefilter"',
  })
}

function buildHeaderActions(viewModel: MarkerSpreadingViewModel, varianceSummary: SpreadingVarianceSummary | null): string {
  const context = viewModel.context
  const navigationPayload = buildMarkerSpreadingNavigationPayload(context, varianceSummary)
  const backLabel = context?.contextType === 'merge-batch' ? '返回合并裁剪批次' : '返回裁片单（原始单）'
  const backRoute =
    context?.contextType === 'merge-batch'
      ? buildRouteWithQuery(getCanonicalCuttingPath('merge-batches'), navigationPayload.mergeBatches)
      : buildRouteWithQuery(getCanonicalCuttingPath('original-orders'), navigationPayload.originalOrders)

  return `
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="import-mock-pda-writebacks" ${context ? '' : 'disabled'}>
        导入模拟 PDA 回写
      </button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="toggle-pending-writebacks">
        ${state.pdaStatusFilter === 'PENDING_REVIEW' ? '查看全部回写' : '只看待审核'}
      </button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="refresh-writeback-inbox">
        刷新收件箱
      </button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="go-back-context" data-nav-target="${escapeHtml(backRoute)}">
        ${escapeHtml(backLabel)}
      </button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="go-replenishment" ${context ? '' : 'disabled'}>
        去补料管理
      </button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="go-fei-tickets" ${context ? '' : 'disabled'}>
        去菲票 / 打编号
      </button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="go-summary" ${context ? '' : 'disabled'}>
        查看裁剪总结
      </button>
    </div>
  `
}

function renderContextSummary(viewModel: MarkerSpreadingViewModel): string {
  const context = viewModel.context

  if (!context) {
    return renderSection(
      '上下文摘要区',
      '本页支持原始裁片单上下文与合并裁剪批次上下文两种进入模式。',
      `
        <div class="space-y-3">
          <div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
            当前尚未收到原始裁片单或合并裁剪批次上下文。请从裁片单（原始单）或合并裁剪批次页进入，以建立可追溯的执行上下文。
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="go-original-orders-index">去裁片单（原始单）</button>
            <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="go-merge-batches-index">去合并裁剪批次</button>
          </div>
        </div>
      `,
    )
  }

  const contextBadge =
    context.contextType === 'merge-batch'
      ? renderBadge('合并裁剪批次上下文', 'bg-violet-100 text-violet-700 border-violet-200')
      : renderBadge('原始裁片单上下文', 'bg-blue-100 text-blue-700 border-blue-200')

  const actionsHtml = `
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="go-original-orders">查看参与原始裁片单</button>
      ${context.contextType === 'merge-batch' ? '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="go-merge-batches">返回批次</button>' : ''}
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="clear-prefilter">清除上下文</button>
    </div>
  `

  return renderSection(
    '上下文摘要区',
    '唛架 / 铺布可以工作在原始裁片单或合并裁剪批次上下文下，但追溯始终回落原始裁片单。',
    `
      <div class="space-y-4">
        <div class="flex flex-wrap items-center gap-2">
          ${contextBadge}
          <span class="text-sm text-muted-foreground">${escapeHtml(summarizeContextHint(context))}</span>
        </div>
        ${renderInfoGrid([
          { label: '原始裁片单', value: context.originalCutOrderNos.join(' / '), tone: 'strong' },
          { label: '合并裁剪批次', value: context.mergeBatchNo || '当前未绑定批次' },
          { label: '来源生产单', value: context.productionOrderNos.join(' / ') },
          { label: '款号 / SPU', value: `${context.styleCode || context.spuCode} / ${context.styleName || context.spuCode}` },
          { label: '面料摘要', value: context.materialSkuSummary },
          { label: '上下文原始裁片单数', value: `${formatCount(context.originalCutOrderIds.length)} 个` },
        ])}
      </div>
    `,
    actionsHtml,
  )
}

function renderMarkerInfoSection(viewModel: MarkerSpreadingViewModel): string {
  const context = viewModel.context
  const marker = getCurrentMarker(viewModel)

  if (!context || !marker) {
    return renderSection(
      '唛架信息区',
      '唛架记录可挂在原始裁片单或合并裁剪批次上下文下，但不会替代原始裁片单主体。',
      '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">请先从裁片单（原始单）或合并裁剪批次进入上下文，再录入唛架模式、尺码配比和唛架图。</div>',
    )
  }

  const modeMeta = deriveMarkerModeMeta(marker.markerMode)
  const totalPieces = computeMarkerTotalPieces(marker.sizeDistribution)

  return renderSection(
    '唛架信息区',
    '本区负责录入唛架模式、尺码配比、净长度和单件用量，并为铺布草稿提供基础数据。',
    `
      <div class="space-y-4">
        <div class="flex flex-wrap items-center gap-2">
          ${renderBadge(modeMeta.label, modeMeta.className)}
          <span class="text-sm text-muted-foreground">${escapeHtml(modeMeta.detailText)}</span>
        </div>

        <div class="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
          <div class="space-y-4 rounded-lg border bg-muted/10 p-4">
            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label class="space-y-2 md:col-span-2 xl:col-span-1">
                <span class="text-sm font-medium text-foreground">唛架模式</span>
                <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-field="markerMode">
                  <option value="NORMAL" ${marker.markerMode === 'NORMAL' ? 'selected' : ''}>正常铺布</option>
                  <option value="HIGH_LOW" ${marker.markerMode === 'HIGH_LOW' ? 'selected' : ''}>高低层模式</option>
                  <option value="FOLDED" ${marker.markerMode === 'FOLDED' ? 'selected' : ''}>对折铺布模式</option>
                </select>
              </label>
              ${marker.sizeDistribution
                .map(
                  (item, index) => `
                    <label class="space-y-2">
                      <span class="text-sm font-medium text-foreground">${escapeHtml(item.sizeLabel)}</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value="${escapeHtml(String(item.quantity))}"
                        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        data-cutting-marker-size-index="${index}"
                      />
                    </label>
                  `,
                )
                .join('')}
            </div>

            <div class="grid gap-3 md:grid-cols-3">
              <article class="rounded-lg border bg-background px-3 py-3">
                <p class="text-xs text-muted-foreground">唛架总件数</p>
                <p class="mt-1 text-lg font-semibold text-slate-900">${escapeHtml(formatCount(totalPieces))}</p>
              </article>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">唛架净长度（米）</span>
                <input type="number" min="0" step="0.01" value="${escapeHtml(String(marker.netLength))}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-field="netLength" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">单件用量（米）</span>
                <input type="number" min="0" step="0.001" value="${escapeHtml(String(marker.singlePieceUsage))}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-field="singlePieceUsage" />
              </label>
            </div>

            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">唛架备注</span>
              <textarea class="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-field="note">${escapeHtml(marker.note)}</textarea>
            </label>
          </div>

          <div class="space-y-4 rounded-lg border bg-muted/10 p-4">
            <div class="space-y-2">
              <span class="text-sm font-medium text-foreground">唛架图</span>
              <input type="file" accept="image/*" class="block w-full text-sm text-muted-foreground" data-cutting-marker-image-input="true" />
            </div>

            ${
              marker.markerImageUrl
                ? `
                  <div class="space-y-2 rounded-lg border bg-background p-3">
                    <p class="text-sm font-medium text-foreground">${escapeHtml(marker.markerImageName || '当前唛架图')}</p>
                    <img src="${escapeHtml(marker.markerImageUrl)}" alt="唛架图预览" class="max-h-72 w-full rounded-md object-contain bg-slate-50" />
                    <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-marker-action="remove-marker-image">移除唛架图</button>
                  </div>
                `
                : '<div class="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">当前尚未上传唛架图，可上传文件名占位或现场截图用于后续铺布沟通。</div>'
            }

            <div class="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-700">
              当前上下文仍以原始裁片单为最终追溯主体。即使从合并裁剪批次进入，本页记录的唛架与铺布信息也只作为执行准备与执行记录，不改变生产单或原始裁片单身份。
            </div>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="save-marker">保存唛架草稿</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="create-session-from-marker">从当前唛架生成铺布草稿</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="create-empty-session">新建空白铺布 Session</button>
        </div>
      </div>
    `,
  )
}

function renderRollTable(session: SpreadingSession): string {
  if (!session.rolls.length) {
    return '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">当前尚无卷记录，请先新增卷并补录长度、布头布尾和层数。</div>'
  }

  return `
    <div class="overflow-x-auto">
      <table class="w-full min-w-[1120px] text-sm">
        <thead class="border-b bg-muted/60 text-muted-foreground">
          <tr>
            <th class="px-3 py-2 text-left font-medium">卷号</th>
            <th class="px-3 py-2 text-left font-medium">面料 SKU</th>
            <th class="px-3 py-2 text-left font-medium">幅宽</th>
            <th class="px-3 py-2 text-left font-medium">标注米数</th>
            <th class="px-3 py-2 text-left font-medium">实际长度</th>
            <th class="px-3 py-2 text-left font-medium">布头</th>
            <th class="px-3 py-2 text-left font-medium">布尾</th>
            <th class="px-3 py-2 text-left font-medium">层数</th>
            <th class="px-3 py-2 text-left font-medium">可用长度</th>
            <th class="px-3 py-2 text-left font-medium">操作人员</th>
            <th class="px-3 py-2 text-left font-medium">来源</th>
            <th class="px-3 py-2 text-left font-medium">备注</th>
            <th class="px-3 py-2 text-left font-medium">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          ${session.rolls
            .map(
              (roll) => `
                <tr>
                  <td class="px-3 py-2 align-top font-medium">${escapeHtml(roll.rollNo || '待补')}</td>
                  <td class="px-3 py-2 align-top">${escapeHtml(roll.materialSku || '待补')}</td>
                  <td class="px-3 py-2 align-top">${escapeHtml(roll.width ? `${roll.width} cm` : '待补')}</td>
                  <td class="px-3 py-2 align-top">${escapeHtml(formatSpreadingLength(roll.labeledLength))}</td>
                  <td class="px-3 py-2 align-top">${escapeHtml(formatSpreadingLength(roll.actualLength))}</td>
                  <td class="px-3 py-2 align-top">${escapeHtml(formatSpreadingLength(roll.headLength))}</td>
                  <td class="px-3 py-2 align-top">${escapeHtml(formatSpreadingLength(roll.tailLength))}</td>
                  <td class="px-3 py-2 align-top">${escapeHtml(String(roll.layerCount || 0))}</td>
                  <td class="px-3 py-2 align-top font-medium">${escapeHtml(formatSpreadingLength(roll.usableLength))}</td>
                  <td class="px-3 py-2 align-top text-xs text-muted-foreground">${escapeHtml(roll.operatorNames.join(' / ') || '待补')}</td>
                  <td class="px-3 py-2 align-top">${renderSourceChannelBadge(roll.sourceChannel)}</td>
                  <td class="px-3 py-2 align-top text-xs text-muted-foreground">${escapeHtml(roll.note || roll.handoverNotes || '—')}</td>
                  <td class="px-3 py-2 align-top">
                    <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-marker-action="edit-roll" data-roll-id="${escapeHtml(roll.rollRecordId)}">编辑卷记录</button>
                  </td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderOperatorRecords(session: SpreadingSession): string {
  if (!session.operators.length) {
    return '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">当前尚无人员 / 交接记录，可继续补录操作人与交接说明。</div>'
  }

  return `
    <div class="space-y-3">
      ${session.operators
        .map(
          (operator) => `
            <article class="rounded-lg border bg-muted/10 px-3 py-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="font-medium text-foreground">${escapeHtml(operator.operatorName || '待补')}</div>
                <div class="text-xs text-muted-foreground">${escapeHtml(operator.actionType || '铺布')}</div>
              </div>
              <div class="mt-1 text-xs text-muted-foreground">开始：${escapeHtml(formatDate(operator.startAt))} · 结束：${escapeHtml(formatDate(operator.endAt))}</div>
              <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                ${renderSourceChannelBadge(operator.sourceChannel)}
                <span>账号：${escapeHtml(operator.operatorAccountId || '待补')}</span>
                ${operator.handoverFlag ? '<span>含交接</span>' : ''}
              </div>
              <div class="mt-1 text-xs text-muted-foreground">说明：${escapeHtml(operator.note || '—')}</div>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderSessionDetail(viewModel: MarkerSpreadingViewModel): string {
  const session = getActiveSession(viewModel)
  if (!session) {
    return '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">当前尚无铺布 session。可先从唛架导入铺布草稿，或新建一个空白 session。</div>'
  }

  const modeMeta = deriveMarkerModeMeta(session.spreadingMode)
  const statusMeta = deriveSpreadingStatus(session.status)
  const rollSummary = summarizeSpreadingRolls(session.rolls)
  const actionsHtml = `
    <div class="flex flex-wrap gap-2">
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-marker-action="open-roll-dialog" ${session.status === 'DONE' ? 'disabled' : ''}>新增卷</button>
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-marker-action="open-operator-dialog">新增人员记录</button>
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-marker-action="set-session-status" data-next-status="IN_PROGRESS" ${session.status === 'IN_PROGRESS' ? 'disabled' : ''}>开始铺布</button>
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-marker-action="set-session-status" data-next-status="DONE" ${session.status === 'DONE' ? 'disabled' : ''}>完成铺布</button>
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-marker-action="set-session-status" data-next-status="DRAFT" ${session.status === 'DRAFT' ? 'disabled' : ''}>标记草稿</button>
    </div>
  `

  return renderSection(
    '铺布记录区',
    '支持多卷、多人员补录；铺布数据将作为后续补料预警与菲票 / 打编号的基础数据。',
    `
      <div class="space-y-4">
        <div class="flex flex-wrap items-center gap-2">
          ${renderBadge(statusMeta.label, statusMeta.className)}
          ${renderBadge(modeMeta.label, modeMeta.className)}
          ${renderSourceChannelBadge(session.sourceChannel)}
          ${session.importedFromMarker ? renderBadge('已从唛架导入', 'bg-sky-100 text-sky-700 border-sky-200') : renderBadge('手工建档', 'bg-slate-100 text-slate-700 border-slate-200')}
        </div>

        ${renderInfoGrid([
          { label: '上下文', value: session.mergeBatchNo || session.originalCutOrderIds.join(' / '), tone: 'strong' },
          { label: '铺布模式', value: modeMeta.label, hint: modeMeta.detailText },
          { label: '状态', value: statusMeta.label, hint: statusMeta.detailText },
          { label: '卷数', value: `${formatCount(session.rollCount)} 卷` },
          { label: '人员记录', value: `${formatCount(session.operatorCount)} 条` },
          { label: '总可用长度', value: formatSpreadingLength(session.totalCalculatedUsableLength) },
          { label: '总实际长度', value: formatSpreadingLength(rollSummary.totalActualLength) },
          { label: '总布头 / 布尾', value: `${formatSpreadingLength(rollSummary.totalHeadLength)} / ${formatSpreadingLength(rollSummary.totalTailLength)}` },
          { label: '实际层数', value: `${formatCount(rollSummary.totalLayers)} 层`, hint: `创建于 ${formatDate(session.createdAt)} · 更新于 ${formatDate(session.updatedAt)}` },
        ])}

        <div class="space-y-3 rounded-lg border bg-muted/10 p-4">
          <div>
            <h3 class="text-sm font-semibold text-foreground">卷记录</h3>
            <p class="mt-1 text-xs text-muted-foreground">一卷布一条记录，卷号、长度、布头布尾、层数和人员都在本区追溯。</p>
          </div>
          ${renderRollTable(session)}
        </div>

        <div class="space-y-3 rounded-lg border bg-muted/10 p-4">
          <div>
            <h3 class="text-sm font-semibold text-foreground">人员 / 交接记录</h3>
            <p class="mt-1 text-xs text-muted-foreground">支持记录操作人员、交接说明和动作类型，形成裁床执行的轻量追溯链路。</p>
          </div>
          ${renderOperatorRecords(session)}
        </div>
      </div>
    `,
    actionsHtml,
  )
}

function renderSessionWorkbench(viewModel: MarkerSpreadingViewModel): string {
  const sessions = viewModel.spreadingSessions

  if (!viewModel.context && !sessions.length) {
    return renderSection(
      '铺布记录区',
      '当前页既可以在原始裁片单上下文下工作，也可以在合并裁剪批次上下文下工作。',
      '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">当前尚无上下文与铺布 session。请从上游页面进入后，再创建铺布草稿或补录卷记录。</div>',
    )
  }

  return `
    <section class="space-y-4 rounded-lg border bg-card p-4">
      <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 class="text-base font-semibold text-foreground">铺布记录区</h2>
          <p class="mt-1 text-sm text-muted-foreground">支持多卷、多人员、分状态补录。铺布完成后会自动生成差异摘要与补料预警基础数据。</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="create-session-from-marker" ${viewModel.context ? '' : 'disabled'}>从当前唛架生成铺布草稿</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="create-empty-session" ${viewModel.context ? '' : 'disabled'}>新建空白铺布 Session</button>
        </div>
      </div>

      ${
        sessions.length
          ? `
            <div class="grid gap-3 xl:grid-cols-[320px,minmax(0,1fr)]">
              <div class="space-y-3">
                ${sessions
                  .map((session) => {
                    const active = getActiveSession(viewModel)?.spreadingSessionId === session.spreadingSessionId
                    const modeMeta = deriveMarkerModeMeta(session.spreadingMode)
                    const statusMeta = deriveSpreadingStatus(session.status)

                    return `
                      <button
                        type="button"
                        data-cutting-marker-action="open-session"
                        data-session-id="${escapeHtml(session.spreadingSessionId)}"
                        class="w-full rounded-lg border px-3 py-3 text-left transition ${active ? 'border-blue-500 bg-blue-50 shadow-sm' : 'bg-card hover:border-slate-300 hover:bg-muted/10'}"
                      >
                        <div class="flex flex-wrap items-start justify-between gap-3">
                          <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                              ${renderBadge(statusMeta.label, statusMeta.className)}
                              ${renderBadge(modeMeta.label, modeMeta.className)}
                              ${renderSourceChannelBadge(session.sourceChannel)}
                            </div>
                            <p class="mt-2 text-sm font-semibold text-foreground">${escapeHtml(session.mergeBatchNo || session.originalCutOrderIds.join(' / '))}</p>
                            <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(session.note || '当前 session 尚未补充说明。')}</p>
                          </div>
                          <div class="text-right text-xs text-muted-foreground">
                            <div>卷数 ${escapeHtml(String(session.rollCount))}</div>
                            <div class="mt-1">人员 ${escapeHtml(String(session.operatorCount))}</div>
                            <div class="mt-1">可用 ${escapeHtml(formatSpreadingLength(session.totalCalculatedUsableLength))}</div>
                          </div>
                        </div>
                      </button>
                    `
                  })
                  .join('')}
              </div>
              <div>${renderSessionDetail(viewModel)}</div>
            </div>
          `
          : '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">当前上下文尚无铺布 session，可先从唛架导入或手工新建。</div>'
      }
    </section>
  `
}

function renderVarianceSection(viewModel: MarkerSpreadingViewModel): string {
  const context = viewModel.context
  const varianceSummary = buildSpreadingVarianceSummary(context, getCurrentMarker(viewModel), getActiveSession(viewModel))
  const preview = buildReplenishmentPreview(varianceSummary)

  if (!context) {
    return renderSection(
      '差异与预警区',
      '差异与补料预警依赖当前上下文、唛架件数与铺布卷记录。',
      '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">当前尚无上下文，暂无法对比仓库配料 / 领料与铺布实际长度差异。</div>',
    )
  }

  const previewClassName =
    preview.level === 'ALERT'
      ? 'bg-rose-100 text-rose-700 border-rose-200'
      : preview.level === 'WATCH'
        ? 'bg-amber-100 text-amber-700 border-amber-200'
        : preview.level === 'OK'
          ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
          : 'bg-slate-100 text-slate-700 border-slate-200'

  return renderSection(
    '差异与预警区',
    '本区只形成补料判断基础数据和预警提示，不在本步直接创建正式补料单。',
    `
      <div class="space-y-4">
        <div class="flex flex-wrap items-center gap-2">
          ${renderBadge(preview.label, previewClassName)}
          <span class="text-sm text-muted-foreground">${escapeHtml(preview.detailText)}</span>
        </div>

        ${renderInfoGrid([
          { label: '已配置长度总和', value: varianceSummary ? formatSpreadingLength(varianceSummary.configuredLengthTotal) : '待补录' },
          { label: '已领取长度总和', value: varianceSummary ? formatSpreadingLength(varianceSummary.claimedLengthTotal) : '待补录' },
          { label: '实际铺布长度总和', value: varianceSummary ? formatSpreadingLength(varianceSummary.actualLengthTotal) : '待补录' },
          { label: '可用长度总和', value: varianceSummary ? formatSpreadingLength(varianceSummary.usableLengthTotal) : '待补录' },
          { label: '差异长度', value: varianceSummary ? formatSpreadingLength(varianceSummary.varianceLength) : '待补录' },
          { label: '预计件数承载', value: varianceSummary ? `${formatCount(varianceSummary.estimatedPieceCapacity)} 件` : '待补录' },
          { label: '唛架总件数', value: varianceSummary ? `${formatCount(varianceSummary.requiredPieceQty)} 件` : '待补录' },
          { label: '补料预警', value: preview.shortageIndicator ? '建议进入补料管理' : '当前未识别明确缺口' },
        ])}

        <div class="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-700">
          差异计算基于仓库配料 / 领料页的配置长度、已领长度与当前铺布卷记录。后续如从本页进入菲票 / 打编号，归属仍永远回落原始裁片单。
        </div>

        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="go-replenishment">去补料管理</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="go-fei-tickets">去菲票 / 打编号</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="go-summary">查看裁剪总结</button>
        </div>
      </div>
    `,
  )
}

function renderPdaStatsCards(viewModel: MarkerSpreadingViewModel): string {
  const stats = buildPdaWritebackStats(getAllMatchedWritebacks(viewModel))
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      ${renderCompactKpiCard('待审核回写数', stats.pendingReviewCount, '等待后台核对并应用', 'text-amber-600')}
      ${renderCompactKpiCard('已应用回写数', stats.appliedCount, '已并入铺布记录', 'text-emerald-600')}
      ${renderCompactKpiCard('冲突待处理数', stats.conflictCount, '存在重复卷号或上下文冲突', 'text-rose-600')}
      ${renderCompactKpiCard('待补录回写数', stats.pendingSupplementCount, '关键字段缺失，待后台补齐', 'text-blue-600')}
      ${renderCompactKpiCard('今日回写数', stats.todayCount, `账号 ${stats.accountCount} 个 · 卷 ${stats.rollCount} 条`, 'text-slate-900')}
    </section>
  `
}

function renderPdaInboxTable(viewModel: MarkerSpreadingViewModel): string {
  const items = getContextMatchedWritebacks(viewModel)
  if (!items.length) {
    return '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">当前上下文下暂无 PDA 回写记录。可先导入模拟回写，或粘贴 JSON payload 建立收件箱。</div>'
  }

  return `
    <div class="overflow-x-auto">
      <table class="w-full min-w-[1120px] text-sm">
        <thead class="border-b bg-muted/60 text-muted-foreground">
          <tr>
            <th class="px-3 py-2 text-left font-medium">回写编号</th>
            <th class="px-3 py-2 text-left font-medium">来源账号</th>
            <th class="px-3 py-2 text-left font-medium">上下文</th>
            <th class="px-3 py-2 text-left font-medium">原始裁片单数</th>
            <th class="px-3 py-2 text-left font-medium">卷数</th>
            <th class="px-3 py-2 text-left font-medium">人员数</th>
            <th class="px-3 py-2 text-left font-medium">提交时间</th>
            <th class="px-3 py-2 text-left font-medium">状态</th>
            <th class="px-3 py-2 text-left font-medium">差异提示</th>
            <th class="px-3 py-2 text-left font-medium">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          ${items
            .map((item) => {
              const resolved = resolvePdaWritebackStatus(item, viewModel.context, viewModel.spreadingSessions)
              const statusMeta = derivePdaWritebackStatus(resolved.status)
              const issueSummary = [...resolved.validation.issues, ...resolved.comparison.issues][0] || '可进入详情查看'
              return `
                <tr>
                  <td class="px-3 py-2 align-top font-medium">${escapeHtml(item.writebackNo)}</td>
                  <td class="px-3 py-2 align-top">
                    <div class="font-medium">${escapeHtml(item.sourceAccountName || '待补账号')}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.sourceAccountId || '账号缺失')}</div>
                  </td>
                  <td class="px-3 py-2 align-top text-xs text-muted-foreground">
                    <div>${escapeHtml(item.contextType === 'merge-batch' ? `批次 ${item.mergeBatchNo || '待补'}` : `原始单 ${item.originalCutOrderNos.join(' / ') || '待补'}`)}</div>
                    <div class="mt-1">${escapeHtml(item.styleCode || item.spuCode || '待补款号')}</div>
                  </td>
                  <td class="px-3 py-2 align-top">${escapeHtml(String(item.originalCutOrderIds.length))}</td>
                  <td class="px-3 py-2 align-top">${escapeHtml(String(item.rollItems.length))}</td>
                  <td class="px-3 py-2 align-top">${escapeHtml(String(item.operatorItems.length))}</td>
                  <td class="px-3 py-2 align-top text-xs text-muted-foreground">${escapeHtml(formatDate(item.submittedAt))}</td>
                  <td class="px-3 py-2 align-top">${renderBadge(statusMeta.label, statusMeta.className)}</td>
                  <td class="px-3 py-2 align-top text-xs text-muted-foreground">${escapeHtml(issueSummary)}</td>
                  <td class="px-3 py-2 align-top">
                    <button type="button" class="text-xs text-blue-600 hover:underline" data-cutting-marker-action="open-writeback" data-writeback-id="${escapeHtml(item.writebackId)}">查看详情</button>
                  </td>
                </tr>
              `
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderPdaSupplementEditor(activeWriteback: PdaSpreadingWriteback | null): string {
  if (!activeWriteback) return ''
  const draft =
    state.supplementDraft && state.supplementDraft.writebackId === activeWriteback.writebackId
      ? state.supplementDraft
      : null
  if (!draft) return ''

  return `
    <div class="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div>
        <h4 class="text-sm font-semibold text-blue-800">补录与冲突处理区</h4>
        <p class="mt-1 text-xs text-blue-700">用于补齐来源账号、原始裁片单追溯和批次上下文，补齐后可重新校验并再次应用。</p>
      </div>
      <div class="grid gap-3 md:grid-cols-2">
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">来源账号 ID</span>
          <input type="text" value="${escapeHtml(draft.sourceAccountId)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-pda-supplement-field="sourceAccountId" />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">来源账号姓名</span>
          <input type="text" value="${escapeHtml(draft.sourceAccountName)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-pda-supplement-field="sourceAccountName" />
        </label>
        <label class="space-y-2 md:col-span-2">
          <span class="text-sm font-medium text-foreground">原始裁片单 ID（多个用逗号分隔）</span>
          <input type="text" value="${escapeHtml(draft.originalCutOrderIdsText)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-pda-supplement-field="originalCutOrderIdsText" />
        </label>
        <label class="space-y-2 md:col-span-2">
          <span class="text-sm font-medium text-foreground">原始裁片单号（多个用逗号分隔）</span>
          <input type="text" value="${escapeHtml(draft.originalCutOrderNosText)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-pda-supplement-field="originalCutOrderNosText" />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">批次 ID</span>
          <input type="text" value="${escapeHtml(draft.mergeBatchId)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-pda-supplement-field="mergeBatchId" />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">批次号</span>
          <input type="text" value="${escapeHtml(draft.mergeBatchNo)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-pda-supplement-field="mergeBatchNo" />
        </label>
      </div>
      <label class="space-y-2">
        <span class="text-sm font-medium text-foreground">补录说明</span>
        <textarea class="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-pda-supplement-field="note">${escapeHtml(draft.note)}</textarea>
      </label>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-background" data-cutting-marker-action="save-supplement-draft">保存补录并重校验</button>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-background" data-cutting-marker-action="cancel-supplement-draft">关闭补录区</button>
      </div>
    </div>
  `
}

function renderPdaWritebackDetail(viewModel: MarkerSpreadingViewModel): string {
  const activeWriteback = getActiveWriteback(viewModel)
  if (!activeWriteback) {
    return '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">请先在收件箱中选择一条 PDA 回写，查看卷记录、人员记录和冲突处理结果。</div>'
  }

  const resolved = resolvePdaWritebackStatus(activeWriteback, viewModel.context, viewModel.spreadingSessions)
  const statusMeta = derivePdaWritebackStatus(resolved.status)
  const comparison = resolved.comparison
  const validation = resolved.validation
  const auditTrails = state.pdaStore.auditTrails.filter((item) => item.writebackId === activeWriteback.writebackId).sort((left, right) =>
    right.actionAt.localeCompare(left.actionAt, 'zh-CN'),
  )

  return `
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        ${renderBadge(statusMeta.label, statusMeta.className)}
        <span class="text-sm text-muted-foreground">${escapeHtml(statusMeta.detailText)}</span>
      </div>

      ${renderInfoGrid([
        { label: '回写编号', value: activeWriteback.writebackNo, tone: 'strong' },
        { label: '来源账号', value: `${activeWriteback.sourceAccountName || '待补'} / ${activeWriteback.sourceAccountId || '账号缺失'}` },
        { label: '来源设备', value: activeWriteback.sourceDeviceId || '待补' },
        { label: '上下文', value: activeWriteback.contextType === 'merge-batch' ? '合并裁剪批次' : '原始裁片单' },
        { label: '原始裁片单', value: activeWriteback.originalCutOrderNos.join(' / ') || '待补' },
        { label: '批次号', value: activeWriteback.mergeBatchNo || '当前未绑定批次' },
        { label: '提交时间', value: formatDate(activeWriteback.submittedAt) },
        { label: '预留结算字段', value: `账号 ${activeWriteback.settlementReserve.sourceAccountName || '待补'} · 卷 ${formatCount(activeWriteback.settlementReserve.rollCount)}` },
      ])}

      <section class="space-y-3 rounded-lg border bg-muted/10 p-4">
        <div>
          <h4 class="text-sm font-semibold text-foreground">上下文匹配与差异</h4>
          <p class="mt-1 text-xs text-muted-foreground">PDA 回写不会静默覆盖后台数据。所有冲突、缺字段和重复卷号都要先显式处理。</p>
        </div>
        <div class="space-y-2 text-sm">
          ${[...validation.issues, ...comparison.issues]
            .map((issue) => `<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">${escapeHtml(issue)}</div>`)
            .join('') || '<div class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">当前回写已通过基础校验，可直接应用到铺布记录。</div>'}
          ${
            comparison.duplicateRollNos.length
              ? `<div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">重复卷号：${escapeHtml(comparison.duplicateRollNos.join(' / '))}</div>`
              : ''
          }
          ${
            comparison.conflictingRollNos.length
              ? `<div class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">冲突卷号：${escapeHtml(comparison.conflictingRollNos.join(' / '))}</div>`
              : ''
          }
        </div>
      </section>

      <section class="space-y-3 rounded-lg border bg-muted/10 p-4">
        <div>
          <h4 class="text-sm font-semibold text-foreground">卷记录明细</h4>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[780px] text-sm">
            <thead class="border-b bg-background text-muted-foreground">
              <tr>
                <th class="px-3 py-2 text-left font-medium">卷号</th>
                <th class="px-3 py-2 text-left font-medium">面料 SKU</th>
                <th class="px-3 py-2 text-left font-medium">实际长度</th>
                <th class="px-3 py-2 text-left font-medium">布头 / 布尾</th>
                <th class="px-3 py-2 text-left font-medium">层数</th>
                <th class="px-3 py-2 text-left font-medium">可用长度</th>
                <th class="px-3 py-2 text-left font-medium">备注</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              ${activeWriteback.rollItems
                .map(
                  (item) => `
                    <tr>
                      <td class="px-3 py-2 align-top font-medium">${escapeHtml(item.rollNo || '待补')}</td>
                      <td class="px-3 py-2 align-top">${escapeHtml(item.materialSku || '待补')}</td>
                      <td class="px-3 py-2 align-top">${escapeHtml(formatSpreadingLength(item.actualLength))}</td>
                      <td class="px-3 py-2 align-top">${escapeHtml(`${formatSpreadingLength(item.headLength)} / ${formatSpreadingLength(item.tailLength)}`)}</td>
                      <td class="px-3 py-2 align-top">${escapeHtml(String(item.layerCount || 0))}</td>
                      <td class="px-3 py-2 align-top">${escapeHtml(formatSpreadingLength(item.usableLength))}</td>
                      <td class="px-3 py-2 align-top text-xs text-muted-foreground">${escapeHtml(item.note || '—')}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>

      <section class="space-y-3 rounded-lg border bg-muted/10 p-4">
        <div>
          <h4 class="text-sm font-semibold text-foreground">人员 / 交接记录</h4>
        </div>
        <div class="space-y-2">
          ${activeWriteback.operatorItems
            .map(
              (item) => `
                <article class="rounded-lg border bg-background px-3 py-3 text-sm">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="font-medium">${escapeHtml(item.operatorName || '待补')}</div>
                    <div class="text-xs text-muted-foreground">${escapeHtml(item.actionType || '铺布')}</div>
                  </div>
                  <div class="mt-1 text-xs text-muted-foreground">账号：${escapeHtml(item.operatorAccountId || '账号缺失')} · ${escapeHtml(formatDate(item.startAt))} - ${escapeHtml(formatDate(item.endAt))}</div>
                  <div class="mt-1 text-xs text-muted-foreground">交接：${item.handoverFlag ? '是' : '否'} · ${escapeHtml(item.note || '—')}</div>
                </article>
              `,
            )
            .join('') || '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">当前回写未携带人员 / 交接记录。</div>'}
        </div>
      </section>

      <section class="space-y-3 rounded-lg border bg-muted/10 p-4">
        <div>
          <h4 class="text-sm font-semibold text-foreground">处理动作</h4>
          <p class="mt-1 text-xs text-muted-foreground">应用、驳回、待补录和补录草稿都会保留来源账号、处理人和时间，便于后续审计与计件结算扩展。</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="apply-writeback" data-writeback-id="${escapeHtml(activeWriteback.writebackId)}" ${resolved.status === 'APPLIED' ? 'disabled' : ''}>应用</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="force-apply-writeback" data-writeback-id="${escapeHtml(activeWriteback.writebackId)}" ${resolved.status === 'APPLIED' ? 'disabled' : ''}>仍然应用</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="reject-writeback" data-writeback-id="${escapeHtml(activeWriteback.writebackId)}" ${resolved.status === 'REJECTED' ? 'disabled' : ''}>驳回</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="mark-writeback-supplement" data-writeback-id="${escapeHtml(activeWriteback.writebackId)}">标记待补录</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="open-supplement-draft" data-writeback-id="${escapeHtml(activeWriteback.writebackId)}">生成补录草稿</button>
        </div>
      </section>

      ${renderPdaSupplementEditor(activeWriteback)}

      <section class="space-y-3 rounded-lg border bg-muted/10 p-4">
        <div>
          <h4 class="text-sm font-semibold text-foreground">审计记录区</h4>
        </div>
        <div class="space-y-2">
          ${auditTrails
            .map(
              (item) => `
                <article class="rounded-lg border bg-background px-3 py-3 text-sm">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="font-medium">${escapeHtml(item.action)}</div>
                    <div class="text-xs text-muted-foreground">${escapeHtml(formatDate(item.actionAt))}</div>
                  </div>
                  <div class="mt-1 text-xs text-muted-foreground">处理人：${escapeHtml(item.actionBy)} · 目标 Session：${escapeHtml(item.targetSessionId || '—')}</div>
                  <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.note || '—')}</div>
                </article>
              `,
            )
            .join('') || '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">当前回写尚无处理审计记录。</div>'}
        </div>
      </section>
    </div>
  `
}

function renderPdaWritebackSection(viewModel: MarkerSpreadingViewModel): string {
  const items = getContextMatchedWritebacks(viewModel)
  const activeWriteback = getActiveWriteback(viewModel)

  return `
    <section class="space-y-4 rounded-lg border bg-card p-4">
      <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 class="text-base font-semibold text-foreground">PDA 回写</h2>
          <p class="mt-1 text-sm text-muted-foreground">后台接收来自工厂端移动应用的铺布回写。回写是来源记录，不会替代原始裁片单、合并裁剪批次和铺布 session 主对象。</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="import-mock-pda-writebacks" ${viewModel.context ? '' : 'disabled'}>导入模拟 PDA 回写</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="import-json-pda-writebacks">导入 JSON</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-marker-action="refresh-writeback-inbox">刷新收件箱</button>
        </div>
      </div>

      ${renderPdaStatsCards(viewModel)}

      <div class="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <div class="space-y-4">
          <section class="space-y-3 rounded-lg border bg-muted/10 p-4">
            <div>
              <h3 class="text-sm font-semibold text-foreground">PDA 回写收件箱</h3>
              <p class="mt-1 text-xs text-muted-foreground">支持待审核、已应用、冲突待处理和待补录状态，不会静默覆盖后台已有铺布记录。</p>
            </div>
            ${renderPdaWritebackTable(viewModel)}
          </section>
        </div>
        <div class="space-y-4">
          <section class="space-y-3 rounded-lg border bg-muted/10 p-4">
            <div>
              <h3 class="text-sm font-semibold text-foreground">模拟 / JSON 导入</h3>
              <p class="mt-1 text-xs text-muted-foreground">推荐先用模拟导入建立 2~4 条代表性回写，再按需粘贴 JSON payload 模拟未来 PDA 接口形态。</p>
            </div>
            <textarea class="min-h-40 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-pda-json="true" placeholder='可粘贴单条或数组 JSON，例如 [{"contextType":"original-order","originalCutOrderIds":["..."],"rollItems":[...]}]'>${escapeHtml(state.pdaJsonDraft)}</textarea>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-background" data-cutting-marker-action="import-json-pda-writebacks">导入 JSON</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-background" data-cutting-marker-action="clear-pda-json">清空 JSON</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-background" data-cutting-marker-action="toggle-pending-writebacks">
                ${state.pdaStatusFilter === 'PENDING_REVIEW' ? '查看全部回写' : '只看待审核'}
              </button>
            </div>
          </section>

          <section class="space-y-3 rounded-lg border bg-muted/10 p-4">
            <div>
              <h3 class="text-sm font-semibold text-foreground">PDA 回写详情区</h3>
              <p class="mt-1 text-xs text-muted-foreground">当前${activeWriteback ? `聚焦 ${activeWriteback.writebackNo}` : '尚未选中回写'}，可查看卷记录、人员记录、上下文匹配与应用结果。</p>
            </div>
            ${renderPdaWritebackDetail(viewModel)}
          </section>
        </div>
      </div>
    </section>
  `
}

function buildMaterialSkuOptions(context: MarkerSpreadingContext | null): string[] {
  if (!context) return []
  return Array.from(new Set(context.materialPrepRows.flatMap((row) => row.materialLineItems.map((item) => item.materialSku)).filter(Boolean)))
}

function renderRollDialog(viewModel: MarkerSpreadingViewModel): string {
  if (state.activeDialog !== 'ROLL' || !state.rollDraft) return ''
  const materialSkus = buildMaterialSkuOptions(viewModel.context)

  return uiFormDialog(
    {
      title: '卷记录',
      description: '按卷补录铺布长度、布头布尾、层数与人员，后续会自动汇总可用长度。',
      closeAction: { prefix: 'cuttingMarker', action: 'close-overlay' },
      submitAction: { prefix: 'cuttingMarker', action: 'save-roll', label: '保存卷记录' },
      width: 'lg',
    },
    `
      <div class="space-y-4">
        <div class="grid gap-3 md:grid-cols-2">
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">卷号</span>
            <input type="text" value="${escapeHtml(state.rollDraft.rollNo)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-roll-field="rollNo" />
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">面料 SKU</span>
            <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-roll-field="materialSku">
              <option value="">请选择面料</option>
              ${materialSkus
                .map((sku) => `<option value="${escapeHtml(sku)}" ${sku === state.rollDraft?.materialSku ? 'selected' : ''}>${escapeHtml(sku)}</option>`)
                .join('')}
            </select>
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">幅宽（cm）</span>
            <input type="number" min="0" step="1" value="${escapeHtml(String(state.rollDraft.width))}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-roll-field="width" />
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">标注米数</span>
            <input type="number" min="0" step="0.01" value="${escapeHtml(String(state.rollDraft.labeledLength))}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-roll-field="labeledLength" />
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">实际长度</span>
            <input type="number" min="0" step="0.01" value="${escapeHtml(String(state.rollDraft.actualLength))}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-roll-field="actualLength" />
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">层数</span>
            <input type="number" min="0" step="1" value="${escapeHtml(String(state.rollDraft.layerCount))}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-roll-field="layerCount" />
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">布头长度</span>
            <input type="number" min="0" step="0.01" value="${escapeHtml(String(state.rollDraft.headLength))}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-roll-field="headLength" />
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">布尾长度</span>
            <input type="number" min="0" step="0.01" value="${escapeHtml(String(state.rollDraft.tailLength))}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-roll-field="tailLength" />
          </label>
        </div>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">操作人员（多个可用逗号分隔）</span>
          <input type="text" value="${escapeHtml(state.rollDraft.operatorNames.join('，'))}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-roll-field="operatorNames" />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">交接说明</span>
          <textarea class="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-roll-field="handoverNotes">${escapeHtml(state.rollDraft.handoverNotes)}</textarea>
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">备注</span>
          <textarea class="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-roll-field="note">${escapeHtml(state.rollDraft.note)}</textarea>
        </label>
      </div>
    `,
  )
}

function renderOperatorDialog(): string {
  if (state.activeDialog !== 'OPERATOR' || !state.operatorDraft) return ''

  return uiFormDialog(
    {
      title: '新增人员 / 交接记录',
      description: '补录操作人与交接说明，形成铺布 session 的轻量追溯链路。',
      closeAction: { prefix: 'cuttingMarker', action: 'close-overlay' },
      submitAction: { prefix: 'cuttingMarker', action: 'save-operator', label: '保存人员记录' },
      width: 'lg',
    },
    `
      <div class="space-y-4">
        <div class="grid gap-3 md:grid-cols-2">
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">操作人员</span>
            <input type="text" value="${escapeHtml(state.operatorDraft.operatorName)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-operator-field="operatorName" />
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">动作类型</span>
            <input type="text" value="${escapeHtml(state.operatorDraft.actionType)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-operator-field="actionType" />
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">开始时间</span>
            <input type="text" value="${escapeHtml(state.operatorDraft.startAt)}" placeholder="例如 2026-03-24 09:30" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-operator-field="startAt" />
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">结束时间</span>
            <input type="text" value="${escapeHtml(state.operatorDraft.endAt)}" placeholder="例如 2026-03-24 11:10" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-operator-field="endAt" />
          </label>
        </div>
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">说明</span>
          <textarea class="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-marker-operator-field="note">${escapeHtml(state.operatorDraft.note)}</textarea>
        </label>
      </div>
    `,
  )
}

function renderDialogs(viewModel: MarkerSpreadingViewModel): string {
  return `${renderRollDialog(viewModel)}${renderOperatorDialog()}`
}

function renderPage(): string {
  syncStateFromPath()
  const pathname = appStore.getState().pathname
  const meta = getCanonicalCuttingMeta(pathname, 'marker-spreading')
  const viewModel = getViewModel()
  const varianceSummary = buildSpreadingVarianceSummary(viewModel.context, getCurrentMarker(viewModel), getActiveSession(viewModel))

  return `
    <div class="space-y-4 p-4">
      ${renderCuttingPageHeader(meta, {
        actionsHtml: buildHeaderActions(viewModel, varianceSummary),
        showCompatibilityBadge: isCuttingAliasPath(pathname),
      })}
      ${renderStatsCards(viewModel)}
      ${renderFeedbackBar()}
      ${renderPrefilterBar()}
      ${renderContextSummary(viewModel)}
      ${renderMarkerInfoSection(viewModel)}
      ${renderSessionWorkbench(viewModel)}
      ${renderPdaWritebackSection(viewModel)}
      ${renderVarianceSection(viewModel)}
      ${renderDialogs(viewModel)}
    </div>
  `
}

function saveCurrentMarker(): boolean {
  const context = getCurrentContext()
  const marker = getCurrentMarker()
  if (!context || !marker) {
    setFeedback('warning', '请先从原始裁片单或合并裁剪批次进入，再保存唛架记录。')
    return true
  }

  const nextStore = upsertMarkerRecord(
    {
      ...marker,
      contextType: context.contextType,
      originalCutOrderIds: [...context.originalCutOrderIds],
      mergeBatchId: context.mergeBatchId,
      mergeBatchNo: context.mergeBatchNo,
      totalPieces: computeMarkerTotalPieces(marker.sizeDistribution),
    },
    state.store,
  )

  persistMarkerLedger(nextStore)
  state.markerDraft = nextStore.markers.find((item) => item.markerId === marker.markerId) ?? marker
  setFeedback('success', '唛架记录已保存，可继续生成铺布草稿。')
  return true
}

function createSession(importedFromMarker: boolean): boolean {
  const viewModel = getViewModel()
  const context = viewModel.context
  const marker = getCurrentMarker(viewModel)
  if (!context || !marker) {
    setFeedback('warning', '请先建立原始裁片单或合并裁剪批次上下文，再创建铺布 session。')
    return true
  }

  const nextSession: SpreadingSession = {
    ...createSpreadingDraftFromMarker(marker, context),
    importedFromMarker,
    note: importedFromMarker ? '已从当前唛架记录生成铺布草稿。' : '已创建空白铺布 session，可继续补录卷与人员。',
  }

  const nextStore = upsertSpreadingSession(nextSession, state.store)
  persistMarkerLedger(nextStore)
  state.activeSessionId = nextSession.spreadingSessionId
  setFeedback('success', importedFromMarker ? '已生成铺布草稿，请继续补录卷和人员。' : '已创建空白铺布 session。')
  return true
}

function openRollDialog(rollId?: string): boolean {
  const viewModel = getViewModel()
  const session = getActiveSession(viewModel)
  if (!session) {
    setFeedback('warning', '请先创建一个铺布 session，再补录卷记录。')
    return true
  }

  state.activeSessionId = session.spreadingSessionId
  state.rollDraft =
    session.rolls.find((item) => item.rollRecordId === rollId) ??
    createRollRecordDraft(session.spreadingSessionId, viewModel.context?.materialPrepRows[0]?.materialLineItems[0]?.materialSku || '')
  state.activeDialog = 'ROLL'
  return true
}

function openOperatorDialog(): boolean {
  const viewModel = getViewModel()
  const session = getActiveSession(viewModel)
  if (!session) {
    setFeedback('warning', '请先创建一个铺布 session，再补录人员 / 交接记录。')
    return true
  }

  state.activeSessionId = session.spreadingSessionId
  state.operatorDraft = createOperatorRecordDraft(session.spreadingSessionId)
  state.activeDialog = 'OPERATOR'
  return true
}

function saveRoll(): boolean {
  const viewModel = getViewModel()
  const session = getActiveSession(viewModel)
  if (!session || !state.rollDraft) return false
  if (!state.rollDraft.rollNo || !state.rollDraft.materialSku) {
    setFeedback('warning', '请至少补齐卷号和面料 SKU。')
    return true
  }

  const normalizedRoll: SpreadingRollRecord = {
    ...state.rollDraft,
    usableLength: computeUsableLength(state.rollDraft.actualLength, state.rollDraft.headLength, state.rollDraft.tailLength),
  }

  const nextRolls = [...session.rolls.filter((item) => item.rollRecordId !== normalizedRoll.rollRecordId), normalizedRoll].sort((left, right) =>
    left.rollNo.localeCompare(right.rollNo, 'zh-CN'),
  )

  const nextStore = upsertSpreadingSession({ ...session, rolls: nextRolls }, state.store)
  persistMarkerLedger(nextStore)
  state.rollDraft = null
  state.activeDialog = null
  setFeedback('success', `${normalizedRoll.rollNo} 已保存卷记录。`)
  return true
}

function saveOperator(): boolean {
  const viewModel = getViewModel()
  const session = getActiveSession(viewModel)
  if (!session || !state.operatorDraft) return false
  if (!state.operatorDraft.operatorName) {
    setFeedback('warning', '请先填写操作人员姓名。')
    return true
  }

  const nextOperators = [...session.operators.filter((item) => item.operatorRecordId !== state.operatorDraft?.operatorRecordId), state.operatorDraft].sort(
    (left, right) => (left.startAt || '').localeCompare(right.startAt || '', 'zh-CN'),
  )

  const nextStore = upsertSpreadingSession({ ...session, operators: nextOperators }, state.store)
  persistMarkerLedger(nextStore)
  const savedName = state.operatorDraft.operatorName
  state.operatorDraft = null
  state.activeDialog = null
  setFeedback('success', `${savedName} 的人员记录已保存。`)
  return true
}

function changeSessionStatus(nextStatus: SpreadingStatusKey): boolean {
  const viewModel = getViewModel()
  const session = getActiveSession(viewModel)
  if (!session) {
    setFeedback('warning', '当前尚无可切换状态的铺布 session。')
    return true
  }

  if (nextStatus === 'DONE' && !session.rolls.length) {
    setFeedback('warning', '当前 session 尚无卷记录，不能直接标记为已完成。')
    return true
  }

  const nextStore = upsertSpreadingSession(updateSessionStatus(session, nextStatus), state.store)
  persistMarkerLedger(nextStore)
  state.activeSessionId = session.spreadingSessionId

  if (nextStatus === 'DONE') {
    const nextViewModel = getViewModel()
    const variance = buildSpreadingVarianceSummary(nextViewModel.context, getCurrentMarker(nextViewModel), getActiveSession(nextViewModel))
    const preview = buildReplenishmentPreview(variance)
    setFeedback('success', `铺布 session 已完成。${preview.label}：${preview.detailText}`)
    return true
  }

  setFeedback('success', `铺布 session 已更新为“${deriveSpreadingStatus(nextStatus).label}”。`)
  return true
}

function closeOverlay(): void {
  state.activeDialog = null
  state.rollDraft = null
  state.operatorDraft = null
}

function navigateByPayload(target: 'replenishment' | 'feiTickets' | 'originalOrders' | 'mergeBatches' | 'summary'): boolean {
  const viewModel = getViewModel()
  const varianceSummary = buildSpreadingVarianceSummary(viewModel.context, getCurrentMarker(viewModel), getActiveSession(viewModel))
  const payload = buildMarkerSpreadingNavigationPayload(viewModel.context, varianceSummary)

  const routeMap = {
    replenishment: getCanonicalCuttingPath('replenishment'),
    feiTickets: getCanonicalCuttingPath('fei-tickets'),
    originalOrders: getCanonicalCuttingPath('original-orders'),
    mergeBatches: getCanonicalCuttingPath('merge-batches'),
    summary: getCanonicalCuttingPath('summary'),
  }

  appStore.navigate(buildRouteWithQuery(routeMap[target], payload[target]))
  return true
}

function navigateBackToContext(): boolean {
  const viewModel = getViewModel()
  if (viewModel.context?.contextType === 'merge-batch') {
    return navigateByPayload('mergeBatches')
  }
  return navigateByPayload('originalOrders')
}

function upsertWritebackRecord(writeback: PdaSpreadingWriteback): void {
  const nextStore: PdaWritebackStore = {
    ...state.pdaStore,
    writebacks: [...state.pdaStore.writebacks.filter((item) => item.writebackId !== writeback.writebackId), writeback].sort((left, right) =>
      right.submittedAt.localeCompare(left.submittedAt, 'zh-CN'),
    ),
  }
  persistPdaWritebacks(nextStore)
}

function appendWritebackAudit(audit: PdaWritebackAuditTrail): void {
  const nextStore: PdaWritebackStore = {
    ...state.pdaStore,
    auditTrails: [audit, ...state.pdaStore.auditTrails].sort((left, right) => right.actionAt.localeCompare(left.actionAt, 'zh-CN')),
  }
  persistPdaWritebacks(nextStore)
}

function syncWritebackStatus(writeback: PdaSpreadingWriteback, viewModel: MarkerSpreadingViewModel): PdaSpreadingWriteback {
  const resolved = resolvePdaWritebackStatus(writeback, viewModel.context, viewModel.spreadingSessions)
  return resolved.status === writeback.status
    ? { ...writeback, validationIssues: resolved.validation.issues }
    : { ...writeback, status: resolved.status, validationIssues: resolved.validation.issues }
}

function importMockPdaWritebacks(): boolean {
  const viewModel = getViewModel()
  const imported = buildMockPdaWritebacks({ context: viewModel.context, sessions: viewModel.spreadingSessions })
  if (!imported.length) {
    setFeedback('warning', '请先进入原始裁片单或合并裁剪批次上下文，再导入模拟 PDA 回写。')
    return true
  }

  const nextWritebacks = [...state.pdaStore.writebacks]
  const nextAudits = [...state.pdaStore.auditTrails]

  for (const raw of imported) {
    const normalized = syncWritebackStatus(raw, viewModel)
    nextWritebacks.push(normalized)
    nextAudits.push(
      buildWritebackAuditTrail({
        writebackId: normalized.writebackId,
        action: 'IMPORT',
        actionBy: '系统模拟导入',
        note: '通过“导入模拟 PDA 回写”生成。',
      }),
    )
  }

  persistPdaWritebacks({
    writebacks: nextWritebacks.sort((left, right) => right.submittedAt.localeCompare(left.submittedAt, 'zh-CN')),
    auditTrails: nextAudits.sort((left, right) => right.actionAt.localeCompare(left.actionAt, 'zh-CN')),
  })
  state.activeWritebackId = imported[0]?.writebackId ?? state.activeWritebackId
  setFeedback('success', `已导入 ${imported.length} 条模拟 PDA 回写，可继续审核、应用或补录。`)
  return true
}

function importJsonPdaWritebacks(): boolean {
  if (!state.pdaJsonDraft.trim()) {
    setFeedback('warning', '请先粘贴 JSON payload，再执行导入。')
    return true
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(state.pdaJsonDraft)
  } catch {
    setFeedback('warning', 'JSON 解析失败，请检查 payload 格式。')
    return true
  }

  const rawItems = Array.isArray(parsed) ? parsed : [parsed]
  const viewModel = getViewModel()
  const imported = rawItems.map((item) => syncWritebackStatus(normalizePdaWritebackPayload(item), viewModel))
  const nextStore: PdaWritebackStore = {
    writebacks: [...state.pdaStore.writebacks, ...imported].sort((left, right) => right.submittedAt.localeCompare(left.submittedAt, 'zh-CN')),
    auditTrails: [
      ...imported.map((item) =>
        buildWritebackAuditTrail({
          writebackId: item.writebackId,
          action: 'IMPORT',
          actionBy: 'JSON 导入',
          note: '通过 JSON 粘贴导入收件箱。',
        }),
      ),
      ...state.pdaStore.auditTrails,
    ].sort((left, right) => right.actionAt.localeCompare(left.actionAt, 'zh-CN')),
  }

  persistPdaWritebacks(nextStore)
  state.activeWritebackId = imported[0]?.writebackId ?? state.activeWritebackId
  state.pdaJsonDraft = ''
  setFeedback('success', `已导入 ${imported.length} 条 JSON 回写记录。`)
  return true
}

function getWritebackById(writebackId: string): PdaSpreadingWriteback | null {
  return state.pdaStore.writebacks.find((item) => item.writebackId === writebackId) ?? null
}

function updateWritebackAfterAction(writeback: PdaSpreadingWriteback): void {
  upsertWritebackRecord(writeback)
  state.activeWritebackId = writeback.writebackId
}

function applyWriteback(writebackId: string, force = false): boolean {
  const writeback = getWritebackById(writebackId)
  if (!writeback) {
    setFeedback('warning', '未找到对应的 PDA 回写记录。')
    return true
  }

  const viewModel = getViewModel()
  const resolved = resolvePdaWritebackStatus(writeback, viewModel.context, viewModel.spreadingSessions)
  const applyResult = applyWritebackToSpreadingSession({
    writeback: { ...writeback, status: resolved.status },
    store: state.store,
    force,
    appliedBy: '后台审核人',
  })

  if (!applyResult.applied) {
    const nextStatus = resolved.validation.hasMissingField ? 'PENDING_SUPPLEMENT' : 'CONFLICT'
    updateWritebackAfterAction({
      ...writeback,
      status: nextStatus,
      validationIssues: [...resolved.validation.issues, ...resolved.comparison.issues],
      warningMessages: applyResult.warningMessages,
    })
    appendWritebackAudit(
      buildWritebackAuditTrail({
        writebackId,
        action: force ? 'FORCE_APPLY' : 'APPLY',
        actionBy: '后台审核人',
        note: applyResult.warningMessages.join('；') || '当前回写未能通过应用校验。',
      }),
    )
    setFeedback('warning', applyResult.warningMessages[0] || '当前回写存在冲突或缺字段，不能直接应用。')
    return true
  }

  persistMarkerLedger(applyResult.nextStore)
  const nextWriteback: PdaSpreadingWriteback = {
    ...writeback,
    status: 'APPLIED',
    appliedSessionId: applyResult.updatedSessionId || applyResult.createdSessionId,
    appliedAt: formatDate(new Date().toISOString().slice(0, 16).replace('T', ' ')),
    appliedBy: '后台审核人',
    warningMessages: applyResult.warningMessages,
    validationIssues: [],
  }
  updateWritebackAfterAction(nextWriteback)
  appendWritebackAudit(
    buildWritebackAuditTrail({
      writebackId,
      action: force ? 'FORCE_APPLY' : 'APPLY',
      actionBy: '后台审核人',
      targetSessionId: nextWriteback.appliedSessionId,
      note:
        applyResult.warningMessages.join('；') ||
        `已并入 Session ${nextWriteback.appliedSessionId}，卷新增 ${applyResult.createdRollCount} 条，卷更新 ${applyResult.updatedRollCount} 条。`,
    }),
  )
  state.supplementDraft = null
  setFeedback('success', force ? '已按人工确认结果强制应用 PDA 回写，并保留审计痕迹。' : '已应用 PDA 回写，当前铺布记录已同步显示来源渠道。')
  return true
}

function rejectWriteback(writebackId: string): boolean {
  const writeback = getWritebackById(writebackId)
  if (!writeback) return false
  updateWritebackAfterAction({ ...writeback, status: 'REJECTED' })
  appendWritebackAudit(
    buildWritebackAuditTrail({
      writebackId,
      action: 'REJECT',
      actionBy: '后台审核人',
      note: '已在后台驳回当前 PDA 回写，保留来源记录供后续审计。',
    }),
  )
  setFeedback('success', '当前 PDA 回写已驳回，但记录仍保留在收件箱中。')
  return true
}

function markWritebackPendingSupplement(writebackId: string): boolean {
  const writeback = getWritebackById(writebackId)
  if (!writeback) return false
  updateWritebackAfterAction({ ...writeback, status: 'PENDING_SUPPLEMENT' })
  appendWritebackAudit(
    buildWritebackAuditTrail({
      writebackId,
      action: 'MARK_PENDING_SUPPLEMENT',
      actionBy: '后台审核人',
      note: '已标记为待补录，等待后台补齐关键字段后重新校验。',
    }),
  )
  setFeedback('success', '当前回写已标记为待补录。')
  return true
}

function openSupplementDraft(writebackId: string): boolean {
  const writeback = getWritebackById(writebackId)
  if (!writeback) return false
  state.activeWritebackId = writebackId
  state.supplementDraft = buildPdaSupplementDraft(writeback)
  return true
}

function saveSupplementDraft(): boolean {
  const draft = state.supplementDraft
  if (!draft) return false
  const current = getWritebackById(draft.writebackId)
  if (!current) return false

  const nextWriteback = normalizePdaWritebackPayload({
    ...current,
    sourceAccountId: draft.sourceAccountId,
    sourceAccountName: draft.sourceAccountName,
    originalCutOrderIds: draft.originalCutOrderIdsText
      .split(/[，,]/)
      .map((value) => value.trim())
      .filter(Boolean),
    originalCutOrderNos: draft.originalCutOrderNosText
      .split(/[，,]/)
      .map((value) => value.trim())
      .filter(Boolean),
    mergeBatchId: draft.mergeBatchId,
    mergeBatchNo: draft.mergeBatchNo,
    note: draft.note,
    rollItems: current.rollItems,
    operatorItems: current.operatorItems,
  })

  const viewModel = getViewModel()
  const resolved = resolvePdaWritebackStatus(nextWriteback, viewModel.context, viewModel.spreadingSessions, false)
  updateWritebackAfterAction({
    ...nextWriteback,
    status: resolved.status,
    validationIssues: resolved.validation.issues,
  })
  appendWritebackAudit(
    buildWritebackAuditTrail({
      writebackId: nextWriteback.writebackId,
      action: 'SAVE_SUPPLEMENT',
      actionBy: '后台审核人',
      note: '已保存补录草稿并重新校验当前 PDA 回写。',
    }),
  )
  state.supplementDraft = null
  setFeedback('success', resolved.status === 'PENDING_REVIEW' ? '补录已完成，当前回写可继续审核应用。' : '补录已保存，但当前回写仍存在待处理问题。')
  return true
}

export function renderCraftCuttingMarkerSpreadingPage(): string {
  return renderPage()
}

export function handleCraftCuttingMarkerSpreadingEvent(target: Element): boolean {
  const imageInputNode = target.closest<HTMLElement>('[data-cutting-marker-image-input]')
  if (imageInputNode instanceof HTMLInputElement) {
    const file = imageInputNode.files?.[0]
    if (!file || !state.markerDraft) return true
    state.markerDraft = {
      ...state.markerDraft,
      markerImageName: file.name,
      markerImageUrl: URL.createObjectURL(file),
    }
    return true
  }

  const markerFieldNode = target.closest<HTMLElement>('[data-cutting-marker-field]')
  if (markerFieldNode && state.markerDraft) {
    const field = markerFieldNode.dataset.cuttingMarkerField as MarkerField | undefined
    if (!field) return false
    const input = markerFieldNode as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

    if (field === 'markerMode') {
      state.markerDraft = { ...state.markerDraft, markerMode: input.value as MarkerModeKey }
      return true
    }

    if (field === 'netLength' || field === 'singlePieceUsage') {
      state.markerDraft = { ...state.markerDraft, [field]: Number(input.value) || 0 }
      return true
    }

    state.markerDraft = { ...state.markerDraft, [field]: input.value }
    return true
  }

  const sizeFieldNode = target.closest<HTMLElement>('[data-cutting-marker-size-index]')
  if (sizeFieldNode && state.markerDraft) {
    const index = Number(sizeFieldNode.dataset.cuttingMarkerSizeIndex)
    const input = sizeFieldNode as HTMLInputElement
    if (Number.isNaN(index) || !state.markerDraft.sizeDistribution[index]) return false

    const nextSizeDistribution = state.markerDraft.sizeDistribution.map((item, currentIndex) =>
      currentIndex === index ? { ...item, quantity: Math.max(Number(input.value) || 0, 0) } : item,
    )

    state.markerDraft = {
      ...state.markerDraft,
      sizeDistribution: nextSizeDistribution,
      totalPieces: computeMarkerTotalPieces(nextSizeDistribution),
    }
    return true
  }

  const rollFieldNode = target.closest<HTMLElement>('[data-cutting-marker-roll-field]')
  if (rollFieldNode && state.rollDraft) {
    const field = rollFieldNode.dataset.cuttingMarkerRollField as RollField | undefined
    if (!field) return false
    const input = rollFieldNode as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

    if (field === 'operatorNames') {
      state.rollDraft = {
        ...state.rollDraft,
        operatorNames: input.value
          .split(/[，,]/)
          .map((value) => value.trim())
          .filter(Boolean),
      }
      return true
    }

    if (['width', 'labeledLength', 'actualLength', 'headLength', 'tailLength', 'layerCount'].includes(field)) {
      state.rollDraft = { ...state.rollDraft, [field]: Number(input.value) || 0 }
      return true
    }

    state.rollDraft = { ...state.rollDraft, [field]: input.value }
    return true
  }

  const operatorFieldNode = target.closest<HTMLElement>('[data-cutting-marker-operator-field]')
  if (operatorFieldNode && state.operatorDraft) {
    const field = operatorFieldNode.dataset.cuttingMarkerOperatorField as OperatorField | undefined
    if (!field) return false
    const input = operatorFieldNode as HTMLInputElement | HTMLTextAreaElement
    state.operatorDraft = { ...state.operatorDraft, [field]: input.value }
    return true
  }

  const pdaJsonNode = target.closest<HTMLElement>('[data-cutting-marker-pda-json]')
  if (pdaJsonNode) {
    state.pdaJsonDraft = (pdaJsonNode as HTMLTextAreaElement).value
    return true
  }

  const supplementFieldNode = target.closest<HTMLElement>('[data-cutting-marker-pda-supplement-field]')
  if (supplementFieldNode && state.supplementDraft) {
    const field = supplementFieldNode.dataset.cuttingMarkerPdaSupplementField as PdaSupplementField | undefined
    if (!field) return false
    const input = supplementFieldNode as HTMLInputElement | HTMLTextAreaElement
    state.supplementDraft = { ...state.supplementDraft, [field]: input.value }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cutting-marker-action]')
  const action = actionNode?.dataset.cuttingMarkerAction
  if (!action) return false

  if (action === 'clear-feedback') {
    clearFeedback()
    return true
  }

  if (action === 'clear-prefilter') {
    state.prefilter = null
    state.pdaStatusFilter = 'ALL'
    state.markerDraft = null
    state.activeSessionId = null
    state.activeWritebackId = null
    state.querySignature = getCanonicalCuttingPath('marker-spreading')
    appStore.navigate(getCanonicalCuttingPath('marker-spreading'))
    return true
  }

  if (action === 'import-mock-pda-writebacks') return importMockPdaWritebacks()
  if (action === 'import-json-pda-writebacks') return importJsonPdaWritebacks()
  if (action === 'clear-pda-json') {
    state.pdaJsonDraft = ''
    return true
  }
  if (action === 'refresh-writeback-inbox') {
    state.pdaStore = readStoredPdaWritebacks()
    setFeedback('success', '已刷新 PDA 回写收件箱。')
    return true
  }
  if (action === 'toggle-pending-writebacks') {
    const nextStatus = state.pdaStatusFilter === 'PENDING_REVIEW' ? undefined : 'PENDING_REVIEW'
    appStore.navigate(getCurrentMarkerRoute({ pdaStatus: nextStatus, writebackId: undefined }))
    return true
  }

  if (action === 'save-marker') return saveCurrentMarker()
  if (action === 'create-session-from-marker') return createSession(true)
  if (action === 'create-empty-session') return createSession(false)

  if (action === 'open-session') {
    state.activeSessionId = actionNode.dataset.sessionId ?? null
    return true
  }

  if (action === 'open-roll-dialog') return openRollDialog()
  if (action === 'edit-roll') return openRollDialog(actionNode.dataset.rollId)
  if (action === 'open-operator-dialog') return openOperatorDialog()
  if (action === 'save-roll') return saveRoll()
  if (action === 'save-operator') return saveOperator()

  if (action === 'set-session-status') {
    const nextStatus = actionNode.dataset.nextStatus as SpreadingStatusKey | undefined
    return nextStatus ? changeSessionStatus(nextStatus) : false
  }

  if (action === 'remove-marker-image' && state.markerDraft) {
    state.markerDraft = { ...state.markerDraft, markerImageName: '', markerImageUrl: '' }
    return true
  }

  if (action === 'open-writeback') {
    const writebackId = actionNode.dataset.writebackId
    if (!writebackId) return false
    appStore.navigate(getCurrentMarkerRoute({ writebackId }))
    return true
  }

  if (action === 'apply-writeback') {
    const writebackId = actionNode.dataset.writebackId
    return writebackId ? applyWriteback(writebackId, false) : false
  }

  if (action === 'force-apply-writeback') {
    const writebackId = actionNode.dataset.writebackId
    return writebackId ? applyWriteback(writebackId, true) : false
  }

  if (action === 'reject-writeback') {
    const writebackId = actionNode.dataset.writebackId
    return writebackId ? rejectWriteback(writebackId) : false
  }

  if (action === 'mark-writeback-supplement') {
    const writebackId = actionNode.dataset.writebackId
    return writebackId ? markWritebackPendingSupplement(writebackId) : false
  }

  if (action === 'open-supplement-draft') {
    const writebackId = actionNode.dataset.writebackId
    return writebackId ? openSupplementDraft(writebackId) : false
  }

  if (action === 'save-supplement-draft') return saveSupplementDraft()
  if (action === 'cancel-supplement-draft') {
    state.supplementDraft = null
    return true
  }

  if (action === 'close-overlay') {
    closeOverlay()
    return true
  }

  if (action === 'go-back-context') return navigateBackToContext()
  if (action === 'go-replenishment') return navigateByPayload('replenishment')
  if (action === 'go-fei-tickets') return navigateByPayload('feiTickets')
  if (action === 'go-summary') return navigateByPayload('summary')
  if (action === 'go-original-orders') return navigateByPayload('originalOrders')
  if (action === 'go-merge-batches') return navigateByPayload('mergeBatches')

  if (action === 'go-original-orders-index') {
    appStore.navigate(getCanonicalCuttingPath('original-orders'))
    return true
  }

  if (action === 'go-merge-batches-index') {
    appStore.navigate(getCanonicalCuttingPath('merge-batches'))
    return true
  }

  return false
}

export function isCraftCuttingMarkerSpreadingDialogOpen(): boolean {
  return state.activeDialog !== null
}
