import { renderDrawer as uiDrawer } from '../components/ui'
import {
  buildCuttingSettlementFocusBuckets,
  buildCuttingSettlementInputEmptyStateText,
  buildCuttingSettlementInputStats,
  buildGroupContributionHeadline,
  buildOperatorContributionHeadline,
  buildSettlementReviewText,
  cuttingInputReviewStatusMeta,
  cuttingRecommendedScoreBandMeta,
  cuttingScoreFocusMeta,
  cuttingSettlementFocusMeta,
  filterCuttingSettlementInputViews,
  hasCuttingSettlementInputFilters,
  type CuttingSettlementInputFilters,
} from '../domain/cutting-settlement/helpers'
import { platformCuttingStageMeta } from '../domain/cutting-platform/overview.helpers'
import { cloneCuttingSettlementInputViews } from '../domain/cutting-settlement/mock'
import type {
  CuttingInputReviewStatus,
  CuttingRecommendedScoreBand,
  CuttingScoreFocusLevel,
  CuttingSettlementFocusLevel,
  CuttingSettlementInputView,
} from '../domain/cutting-settlement/types'
import { appStore } from '../state/store'
import { escapeHtml, formatDateTime } from '../utils'

interface CuttingSettlementProcessDraft {
  recordId: string
  settlementFocusLevel: CuttingSettlementFocusLevel
  scoreFocusLevel: CuttingScoreFocusLevel
  reviewStatus: CuttingInputReviewStatus
  reviewNote: string
  confirmNote: string
}

interface CuttingSettlementPageState {
  rows: CuttingSettlementInputView[]
  filters: CuttingSettlementInputFilters
  activeRecordId: string | null
  processDraft: CuttingSettlementProcessDraft | null
}

const REVIEW_ACTOR = '平台结算与绩效岗'

const state: CuttingSettlementPageState = {
  rows: cloneCuttingSettlementInputViews(),
  filters: {
    keyword: '',
    attentionType: 'ALL',
    settlementFocusLevel: 'ALL',
    scoreFocusLevel: 'ALL',
    reviewStatus: 'ALL',
    exceptionImpact: 'ALL',
    pendingOnly: 'ALL',
  },
  activeRecordId: null,
  processDraft: null,
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function buildSummaryCard(label: string, value: number, hint: string, accentClass: string): string {
  return `
    <article class="rounded-lg border bg-card p-4">
      <p class="text-sm text-muted-foreground">${escapeHtml(label)}</p>
      <div class="mt-3 flex items-end justify-between gap-3">
        <p class="text-3xl font-semibold tabular-nums ${accentClass}">${value}</p>
        <p class="text-right text-xs text-muted-foreground">${escapeHtml(hint)}</p>
      </div>
    </article>
  `
}

function renderFilterSelect(
  label: string,
  field: keyof CuttingSettlementInputFilters,
  value: string,
  options: Array<{ value: string; label: string }>,
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        data-cutting-settlement-field="${field}"
      >
        ${options
          .map(
            (option) =>
              `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`,
          )
          .join('')}
      </select>
    </label>
  `
}

function renderProcessSelect(
  label: string,
  field: keyof Pick<CuttingSettlementProcessDraft, 'settlementFocusLevel' | 'scoreFocusLevel' | 'reviewStatus'>,
  value: string,
  options: Array<{ value: string; label: string }>,
): string {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        data-cutting-settlement-process-field="${field}"
      >
        ${options
          .map(
            (option) =>
              `<option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`,
          )
          .join('')}
      </select>
    </label>
  `
}

function getFilteredRows(): CuttingSettlementInputView[] {
  return filterCuttingSettlementInputViews(state.rows, state.filters)
}

function getActiveRow(): CuttingSettlementInputView | null {
  if (!state.activeRecordId) return null
  return state.rows.find((row) => row.id === state.activeRecordId) ?? null
}

function getProcessingRow(): CuttingSettlementInputView | null {
  if (!state.processDraft) return null
  return state.rows.find((row) => row.id === state.processDraft?.recordId) ?? null
}

function getNowText(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const date = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${date} ${hours}:${minutes}`
}

function buildRecommendedScoreBand(scoreFocusLevel: CuttingScoreFocusLevel): CuttingRecommendedScoreBand {
  if (scoreFocusLevel === 'HIGH_ATTENTION') return 'LIMIT'
  if (scoreFocusLevel === 'LOW_SCORE_RISK') return 'WATCH'
  if (scoreFocusLevel === 'WATCH') return 'GOOD'
  return 'EXCELLENT'
}

function openDetail(recordId: string): void {
  state.activeRecordId = recordId
  state.processDraft = null
}

function openProcess(recordId: string): void {
  const row = state.rows.find((item) => item.id === recordId)
  if (!row) return
  state.activeRecordId = null
  state.processDraft = {
    recordId,
    settlementFocusLevel: row.settlementInput.settlementFocusLevel,
    scoreFocusLevel: row.scoreInput.scoreFocusLevel,
    reviewStatus: row.reviewStatus,
    reviewNote: row.settlementInput.reviewNote,
    confirmNote: '',
  }
}

function closeOverlay(): void {
  if (state.processDraft) {
    state.processDraft = null
    return
  }
  state.activeRecordId = null
}

function updateProcessField(
  field: keyof Pick<CuttingSettlementProcessDraft, 'settlementFocusLevel' | 'scoreFocusLevel' | 'reviewStatus' | 'reviewNote' | 'confirmNote'>,
  value: string,
): void {
  if (!state.processDraft) return
  state.processDraft = {
    ...state.processDraft,
    [field]: value,
  }
}

function updateRow(recordId: string, updater: (row: CuttingSettlementInputView) => void): void {
  const row = state.rows.find((item) => item.id === recordId)
  if (!row) return
  updater(row)
}

function syncReviewFlags(row: CuttingSettlementInputView): void {
  row.reviewStatus = row.settlementInput.reviewStatus
  row.requiresSettlementAttention = row.settlementInput.settlementFocusLevel !== 'NORMAL'
  row.requiresScoreAttention = row.scoreInput.scoreFocusLevel !== 'NORMAL'
  row.isPending = row.reviewStatus !== 'CONFIRMED'
}

function applyCommonReviewPatch(
  row: CuttingSettlementInputView,
  next: {
    settlementFocusLevel?: CuttingSettlementFocusLevel
    scoreFocusLevel?: CuttingScoreFocusLevel
    reviewStatus?: CuttingInputReviewStatus
    reviewNote?: string
    latestActionText?: string
    suggestedActionText?: string
    snapshotConfirmed?: boolean
  },
): void {
  const nowText = getNowText()
  if (next.settlementFocusLevel) {
    row.settlementInput.settlementFocusLevel = next.settlementFocusLevel
  }
  if (next.scoreFocusLevel) {
    row.scoreInput.scoreFocusLevel = next.scoreFocusLevel
    row.scoreInput.recommendedScoreBand = buildRecommendedScoreBand(next.scoreFocusLevel)
  }
  if (next.reviewStatus) {
    row.settlementInput.reviewStatus = next.reviewStatus
    row.scoreInput.reviewStatus = next.reviewStatus
  }
  if (typeof next.reviewNote === 'string') {
    row.settlementInput.reviewNote = next.reviewNote
    row.scoreInput.reviewNote = next.reviewNote
  }

  const currentReviewStatus = row.settlementInput.reviewStatus
  if (currentReviewStatus === 'CONFIRMED') {
    row.settlementInput.reviewedAt = nowText
    row.settlementInput.reviewedBy = REVIEW_ACTOR
    row.scoreInput.reviewedAt = nowText
    row.scoreInput.reviewedBy = REVIEW_ACTOR
    if (next.snapshotConfirmed) {
      row.settlementInput.snapshotConfirmedAt = nowText
      row.settlementInput.snapshotConfirmedBy = REVIEW_ACTOR
    }
  } else {
    row.settlementInput.reviewedAt = nowText
    row.settlementInput.reviewedBy = REVIEW_ACTOR
    row.scoreInput.reviewedAt = nowText
    row.scoreInput.reviewedBy = REVIEW_ACTOR
    if (currentReviewStatus !== 'CONFIRMED') {
      row.settlementInput.snapshotConfirmedAt = ''
      row.settlementInput.snapshotConfirmedBy = ''
    }
  }

  row.settlementInput.needsManualReview = row.settlementInput.settlementFocusLevel !== 'NORMAL' || row.hasExceptionImpact || currentReviewStatus !== 'CONFIRMED'
  row.scoreInput.needsManualReview = row.scoreInput.scoreFocusLevel !== 'NORMAL' || row.hasExceptionImpact || currentReviewStatus !== 'CONFIRMED'

  if (next.latestActionText) row.latestActionText = next.latestActionText
  if (next.suggestedActionText) row.suggestedActionText = next.suggestedActionText
  syncReviewFlags(row)
}

function markSettlementAttention(recordId: string): void {
  updateRow(recordId, (row) => {
    const nextFocus = row.settlementInput.settlementFocusLevel === 'HIGH_FOCUS' ? 'HIGH_FOCUS' : 'FOCUS'
    const nextStatus = row.reviewStatus === 'CONFIRMED' ? 'REVIEWING' : row.reviewStatus === 'NEED_MORE_INFO' ? 'NEED_MORE_INFO' : 'REVIEWING'
    applyCommonReviewPatch(row, {
      settlementFocusLevel: nextFocus,
      reviewStatus: nextStatus,
      reviewNote: '平台已标记纳入结算关注，请结合异常影响与执行留痕继续核查。',
      latestActionText: `平台已纳入结算关注 · ${getNowText()} · ${REVIEW_ACTOR}`,
      suggestedActionText: '建议先核对异常影响和现场执行留痕，再决定是否纳入后续结算关注。',
    })
  })
}

function markScoreAttention(recordId: string): void {
  updateRow(recordId, (row) => {
    const nextFocus = row.scoreInput.scoreFocusLevel === 'NORMAL' ? 'WATCH' : row.scoreInput.scoreFocusLevel
    const nextStatus = row.reviewStatus === 'CONFIRMED' ? 'REVIEWING' : row.reviewStatus === 'NEED_MORE_INFO' ? 'NEED_MORE_INFO' : 'REVIEWING'
    applyCommonReviewPatch(row, {
      scoreFocusLevel: nextFocus,
      reviewStatus: nextStatus,
      reviewNote: '平台已标记纳入评分关注，请结合稳定性、异常和凭证合规情况继续核查。',
      latestActionText: `平台已纳入评分关注 · ${getNowText()} · ${REVIEW_ACTOR}`,
      suggestedActionText: '建议结合异常中心和平台详情评估工厂稳定性与评分关注等级。',
    })
  })
}

function markReviewing(recordId: string): void {
  updateRow(recordId, (row) => {
    applyCommonReviewPatch(row, {
      reviewStatus: 'REVIEWING',
      reviewNote: '平台已进入人工复核。',
      latestActionText: `平台已标记复核中 · ${getNowText()} · ${REVIEW_ACTOR}`,
      suggestedActionText: '请结合平台详情、异常中心和 PCS 页面继续补充核查结论。',
    })
  })
}

function confirmInput(recordId: string): void {
  updateRow(recordId, (row) => {
    applyCommonReviewPatch(row, {
      reviewStatus: 'CONFIRMED',
      reviewNote: '平台已确认当前结算与评分输入快照，可供后续真实系统消费。',
      latestActionText: `平台已确认输入快照 · ${getNowText()} · ${REVIEW_ACTOR}`,
      suggestedActionText: '如后续仍有异常变化，请回到异常中心或平台详情继续跟进。',
      snapshotConfirmed: true,
    })
  })
}

function saveProcessDraft(): void {
  if (!state.processDraft) return
  const row = getProcessingRow()
  if (!row) return

  const note = state.processDraft.reviewNote.trim()
  const confirmNote = state.processDraft.confirmNote.trim()
  const isConfirmed = state.processDraft.reviewStatus === 'CONFIRMED'

  applyCommonReviewPatch(row, {
    settlementFocusLevel: state.processDraft.settlementFocusLevel,
    scoreFocusLevel: state.processDraft.scoreFocusLevel,
    reviewStatus: state.processDraft.reviewStatus,
    reviewNote: [note, confirmNote].filter(Boolean).join('；'),
    latestActionText: `平台已处理输入 · ${getNowText()} · ${REVIEW_ACTOR}`,
    suggestedActionText:
      state.processDraft.reviewStatus === 'NEED_MORE_INFO'
        ? '需要补充现场说明、凭证或异常关闭信息后再确认输入。'
        : state.processDraft.reviewStatus === 'CONFIRMED'
          ? '当前输入快照已确认，可供后续结算与评分系统消费。'
          : '当前输入仍在平台复核中，请继续核查异常与执行留痕。',
    snapshotConfirmed: isConfirmed,
  })

  state.processDraft = null
}

function renderEmptyState(text: string): string {
  return `
    <div class="rounded-lg border border-dashed bg-card px-6 py-10 text-center">
      <p class="text-sm text-muted-foreground">${escapeHtml(text)}</p>
    </div>
  `
}

function renderPageHeader(): string {
  return `
    <header class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="mb-1 text-sm text-muted-foreground">平台运营系统 / 对账与结算</p>
          <h1 class="text-2xl font-bold">裁片结算与评分输入</h1>
          <p class="mt-2 max-w-4xl text-sm text-muted-foreground">用于平台侧整理裁片执行数据、异常影响和个人 / 小组留痕，形成后续结算与评分关注输入。</p>
        </div>
        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-settlement-action="go-overview">返回裁片任务总览</button>
      </div>
    </header>
  `
}

function renderSummaryCards(): string {
  const stats = buildCuttingSettlementInputStats(getFilteredRows())
  return `
    <section class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        ${buildSummaryCard('待确认输入数', stats.pendingConfirmCount, '仍需平台确认输入快照', 'text-slate-900')}
        ${buildSummaryCard('高关注结算输入数', stats.highSettlementFocusCount, '异常和留痕已影响结算关注', 'text-rose-600')}
        ${buildSummaryCard('高关注评分输入数', stats.highScoreFocusCount, '工厂稳定性与评分风险偏高', 'text-fuchsia-600')}
        ${buildSummaryCard('受异常影响输入数', stats.exceptionImpactedCount, '异常摘要已进入输入对象', 'text-amber-600')}
        ${buildSummaryCard('需人工复核输入数', stats.manualReviewCount, '需要人工补充说明或继续核查', 'text-violet-600')}
        ${buildSummaryCard('低评分建议工厂数', stats.lowScoreRiskFactoryCount, '建议关注工厂后续评分风险', 'text-sky-600')}
      </div>
      <div class="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        当前页面整理的是平台可消费的结算与评分输入，不直接生成财务结算单，也不直接输出最终工厂评分。
      </div>
    </section>
  `
}

function renderFocusColumn(
  title: string,
  description: string,
  rows: CuttingSettlementInputView[],
  emptyText: string,
): string {
  return `
    <article class="rounded-lg border bg-muted/20 p-4">
      <div>
        <h3 class="font-semibold text-foreground">${escapeHtml(title)}</h3>
        <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(description)}</p>
      </div>
      <div class="mt-4 space-y-3">
        ${
          rows.length === 0
            ? `<div class="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">${escapeHtml(emptyText)}</div>`
            : rows
                .map(
                  (row) => `
                    <div class="rounded-lg border bg-background p-3">
                      <div class="flex flex-wrap items-center gap-2">
                        ${renderBadge(cuttingSettlementFocusMeta[row.settlementInput.settlementFocusLevel].label, cuttingSettlementFocusMeta[row.settlementInput.settlementFocusLevel].className)}
                        ${renderBadge(cuttingScoreFocusMeta[row.scoreInput.scoreFocusLevel].label, cuttingScoreFocusMeta[row.scoreInput.scoreFocusLevel].className)}
                        ${renderBadge(cuttingInputReviewStatusMeta[row.reviewStatus].label, cuttingInputReviewStatusMeta[row.reviewStatus].className)}
                      </div>
                      <button class="mt-3 text-left text-sm font-medium text-blue-600 hover:underline" data-cutting-settlement-action="open-detail" data-record-id="${row.id}">
                        ${escapeHtml(row.productionOrderNo)} · ${escapeHtml(row.cuttingTaskNo)}
                      </button>
                      <p class="mt-1 text-xs text-foreground">${escapeHtml(row.factoryName)}</p>
                      <p class="mt-2 text-xs text-muted-foreground">${escapeHtml(row.exceptionImpactText)}</p>
                      <div class="mt-3 flex flex-wrap gap-2">
                        <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-settlement-action="open-process" data-record-id="${row.id}">输入处理</button>
                        <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-settlement-action="go-platform-detail" data-route="${row.routes.platformDetail}">去平台详情</button>
                      </div>
                    </div>
                  `,
                )
                .join('')
        }
      </div>
    </article>
  `
}

function renderFocusSection(): string {
  const rows = getFilteredRows()
  const buckets = buildCuttingSettlementFocusBuckets(rows)
  return `
    <section class="rounded-lg border bg-card p-5">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">待平台确认区</h2>
          <p class="mt-1 text-sm text-muted-foreground">优先暴露高风险异常影响结算、高风险评分关注、多次复核 / 凭证不足，以及补料和仓务滞后带来的输入关注点。</p>
        </div>
        <span class="text-sm text-muted-foreground">当前重点 ${rows.filter((row) => row.isPending).length} 项</span>
      </div>
      <div class="mt-4 grid gap-4 xl:grid-cols-4">
        ${renderFocusColumn('高关注结算输入', '优先确认异常对结算关注的影响。', buckets.settlementRows, '当前无高关注结算输入。')}
        ${renderFocusColumn('高关注评分输入', '优先识别工厂稳定性和评分风险。', buckets.scoreRows, '当前无高关注评分输入。')}
        ${renderFocusColumn('多次复核 / 凭证不足', '优先补齐复核依据和照片凭证。', buckets.reviewRows, '当前无复核或凭证不足输入。')}
        ${renderFocusColumn('补料 / 仓务滞后', '优先核对补料、入仓和交接滞后是否影响后续结算。', buckets.executionRows, '当前无补料或仓务滞后输入。')}
      </div>
    </section>
  `
}

function renderFilterSection(): string {
  return `
    <section class="rounded-lg border bg-card p-5">
      <div class="grid gap-4 lg:grid-cols-3 xl:grid-cols-7">
        <label class="space-y-2 xl:col-span-2">
          <span class="text-sm font-medium text-foreground">关键词搜索</span>
          <input
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            value="${escapeHtml(state.filters.keyword)}"
            placeholder="输入编号 / 生产单号 / 裁片任务号 / 工厂名 / 裁片单号"
            data-cutting-settlement-field="keyword"
          />
        </label>
        ${renderFilterSelect('关注类型', 'attentionType', state.filters.attentionType, [
          { value: 'ALL', label: '全部' },
          { value: 'SETTLEMENT', label: '结算关注' },
          { value: 'SCORE', label: '评分关注' },
          { value: 'BOTH', label: '两者都关注' },
        ])}
        ${renderFilterSelect('结算关注等级', 'settlementFocusLevel', state.filters.settlementFocusLevel, [
          { value: 'ALL', label: '全部' },
          { value: 'NORMAL', label: '普通' },
          { value: 'FOCUS', label: '关注' },
          { value: 'HIGH_FOCUS', label: '高关注' },
        ])}
        ${renderFilterSelect('评分关注等级', 'scoreFocusLevel', state.filters.scoreFocusLevel, [
          { value: 'ALL', label: '全部' },
          { value: 'NORMAL', label: '普通' },
          { value: 'WATCH', label: '观察' },
          { value: 'LOW_SCORE_RISK', label: '低评分风险' },
          { value: 'HIGH_ATTENTION', label: '高关注' },
        ])}
        ${renderFilterSelect('复核状态', 'reviewStatus', state.filters.reviewStatus, [
          { value: 'ALL', label: '全部' },
          { value: 'PENDING', label: '待确认' },
          { value: 'REVIEWING', label: '复核中' },
          { value: 'CONFIRMED', label: '已确认' },
          { value: 'NEED_MORE_INFO', label: '待补充说明' },
        ])}
        ${renderFilterSelect('异常影响', 'exceptionImpact', state.filters.exceptionImpact, [
          { value: 'ALL', label: '全部' },
          { value: 'IMPACTED', label: '受异常影响' },
          { value: 'MULTI_RECHECK', label: '多次复核' },
          { value: 'MISSING_EVIDENCE', label: '凭证不足' },
        ])}
      </div>
      <div class="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
        ${renderFilterSelect('仅看待处理', 'pendingOnly', state.filters.pendingOnly, [
          { value: 'ALL', label: '全部' },
          { value: 'PENDING_ONLY', label: '仅看待处理' },
        ])}
        <div class="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          当前页整理的是平台后续结算与评分输入，不直接做真实结算，也不直接做评分算法输出。
        </div>
      </div>
    </section>
  `
}

function renderMainTable(): string {
  const rows = getFilteredRows()
  const hasFilters = hasCuttingSettlementInputFilters(state.filters)

  return `
    <section class="rounded-lg border bg-card p-5">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-foreground">裁片结算与评分输入列表</h2>
          <p class="mt-1 text-sm text-muted-foreground">按生产单 / 裁片任务 / 工厂维度查看执行留痕、异常影响和平台复核输入。</p>
        </div>
        <span class="text-sm text-muted-foreground">共 ${rows.length} 项</span>
      </div>
      <div class="mt-4 overflow-x-auto">
        ${
          rows.length === 0
            ? renderEmptyState(buildCuttingSettlementInputEmptyStateText(hasFilters, 'records'))
            : `
              <table class="min-w-full divide-y divide-border text-sm">
                <thead class="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th class="px-3 py-3">生产单号</th>
                    <th class="px-3 py-3">裁片任务号</th>
                    <th class="px-3 py-3">工厂</th>
                    <th class="px-3 py-3">结算关注等级</th>
                    <th class="px-3 py-3">评分关注等级</th>
                    <th class="px-3 py-3">执行留痕摘要</th>
                    <th class="px-3 py-3">异常影响摘要</th>
                    <th class="px-3 py-3">当前复核状态</th>
                    <th class="px-3 py-3">最近动作</th>
                    <th class="px-3 py-3">建议动作</th>
                    <th class="px-3 py-3">操作</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  ${rows
                    .map(
                      (row) => `
                        <tr class="align-top">
                          <td class="px-3 py-4">
                            <button class="text-left font-medium text-blue-600 hover:underline" data-cutting-settlement-action="open-detail" data-record-id="${row.id}">${escapeHtml(row.productionOrderNo)}</button>
                            <div class="mt-1 text-xs text-muted-foreground">输入编号：${escapeHtml(row.settlementInput.settlementInputNo)}</div>
                          </td>
                          <td class="px-3 py-4">
                            <div class="font-medium text-foreground">${escapeHtml(row.cuttingTaskNo)}</div>
                            <div class="mt-1 text-xs text-muted-foreground">当前阶段：${escapeHtml(platformCuttingStageMeta[row.currentStage].label)}</div>
                          </td>
                          <td class="px-3 py-4">
                            <div class="font-medium text-foreground">${escapeHtml(row.factoryName)}</div>
                            <div class="mt-1 text-xs text-muted-foreground">工厂编码：${escapeHtml(row.settlementInput.factoryCode)}</div>
                          </td>
                          <td class="px-3 py-4">
                            ${renderBadge(cuttingSettlementFocusMeta[row.settlementInput.settlementFocusLevel].label, cuttingSettlementFocusMeta[row.settlementInput.settlementFocusLevel].className)}
                            <div class="mt-2 text-xs text-muted-foreground">${row.settlementInput.needsManualReview ? '需人工复核' : '常规结算输入'}</div>
                          </td>
                          <td class="px-3 py-4">
                            ${renderBadge(cuttingScoreFocusMeta[row.scoreInput.scoreFocusLevel].label, cuttingScoreFocusMeta[row.scoreInput.scoreFocusLevel].className)}
                            <div class="mt-2">${renderBadge(cuttingRecommendedScoreBandMeta[row.scoreInput.recommendedScoreBand].label, cuttingRecommendedScoreBandMeta[row.scoreInput.recommendedScoreBand].className)}</div>
                          </td>
                          <td class="px-3 py-4">
                            <div class="text-sm text-foreground">${escapeHtml(row.executionSummaryText)}</div>
                            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(buildOperatorContributionHeadline(row))}</div>
                            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(buildGroupContributionHeadline(row))}</div>
                          </td>
                          <td class="px-3 py-4">
                            <div class="text-sm text-foreground">${escapeHtml(row.exceptionImpactText)}</div>
                            <div class="mt-1 flex flex-wrap gap-1">
                              ${row.settlementInput.exceptionImpactSummary.highRiskExceptionCount > 0 ? renderBadge(`高风险 ${row.settlementInput.exceptionImpactSummary.highRiskExceptionCount}`, 'bg-rose-50 text-rose-700') : ''}
                              ${row.settlementInput.exceptionImpactSummary.repeatedRecheckCount > 0 ? renderBadge('多次复核', 'bg-amber-50 text-amber-700') : ''}
                              ${row.settlementInput.exceptionImpactSummary.insufficientEvidenceCount > 0 ? renderBadge('凭证不足', 'bg-sky-50 text-sky-700') : ''}
                            </div>
                          </td>
                          <td class="px-3 py-4">
                            ${renderBadge(cuttingInputReviewStatusMeta[row.reviewStatus].label, cuttingInputReviewStatusMeta[row.reviewStatus].className)}
                            <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(buildSettlementReviewText(row))}</div>
                          </td>
                          <td class="px-3 py-4">
                            <div class="text-sm text-foreground">${escapeHtml(row.latestActionText)}</div>
                            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(formatDateTime(row.settlementInput.latestActionAt))} · ${escapeHtml(row.settlementInput.latestActionBy)}</div>
                          </td>
                          <td class="px-3 py-4">
                            <div class="text-sm text-foreground">${escapeHtml(row.suggestedActionText)}</div>
                          </td>
                          <td class="px-3 py-4">
                            <div class="flex min-w-[320px] flex-wrap gap-2">
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-settlement-action="open-detail" data-record-id="${row.id}">查看输入详情</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-settlement-action="focus-settlement" data-record-id="${row.id}">标记纳入结算关注</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-settlement-action="focus-score" data-record-id="${row.id}">标记纳入评分关注</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-settlement-action="mark-reviewing" data-record-id="${row.id}">标记复核中</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-settlement-action="confirm-input" data-record-id="${row.id}">确认输入</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-settlement-action="open-process" data-record-id="${row.id}">输入处理</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-settlement-action="go-platform-detail" data-route="${row.routes.platformDetail}">去平台详情</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-settlement-action="go-platform-exception" data-route="${row.routes.platformExceptionCenter}">去异常中心</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-settlement-action="go-order-progress" data-route="${row.routes.orderProgress}">去订单进度</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-settlement-action="go-material-prep" data-route="${row.routes.materialPrep}">去仓库配料</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-settlement-action="go-cut-piece-orders" data-route="${row.routes.cutPieceOrders}">去裁片单</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-settlement-action="go-replenishment" data-route="${row.routes.replenishment}">去补料管理</button>
                              <button class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-cutting-settlement-action="go-warehouse-management" data-route="${row.routes.warehouseManagement}">去仓库管理</button>
                            </div>
                          </td>
                        </tr>
                      `,
                    )
                    .join('')}
                </tbody>
              </table>
            `
        }
      </div>
    </section>
  `
}

function renderDetailDrawer(): string {
  const row = getActiveRow()
  if (!row) return ''

  return uiDrawer(
    {
      title: '裁片结算与评分输入详情',
      subtitle: '只做平台输入整理和关注归集，不替代平台详情、异常中心和 PCS 页面。',
      closeAction: { prefix: 'cutting-settlement', action: 'close-overlay' },
      width: 'lg',
    },
    `
      <div class="space-y-6 text-sm">
        <section class="grid gap-4 rounded-lg border bg-muted/20 p-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <p class="text-xs text-muted-foreground">输入编号</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(row.settlementInput.settlementInputNo)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">生产单号</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(row.productionOrderNo)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">裁片任务号</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(row.cuttingTaskNo)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">工厂名称</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(row.factoryName)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">当前阶段</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(platformCuttingStageMeta[row.currentStage].label)}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">最近更新时间 / 来源</p>
            <p class="mt-1 font-medium text-foreground">${escapeHtml(formatDateTime(row.settlementInput.latestActionAt))} · ${escapeHtml(row.settlementInput.latestActionBy)}</p>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">执行留痕摘要</h3>
          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <div class="rounded-lg border bg-muted/20 p-4">
              <p class="text-xs text-muted-foreground">个人执行摘要</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(buildOperatorContributionHeadline(row))}</p>
              <div class="mt-3 space-y-2 text-xs text-muted-foreground">
                ${row.settlementInput.operatorSummary.length === 0 ? '<p>当前无个人执行留痕。</p>' : row.settlementInput.operatorSummary.map((item) => `<p>${escapeHtml(item.operatorName)} · 动作 ${item.actionCount} 次 · ${escapeHtml(item.latestActionSummary)}</p>`).join('')}
              </div>
            </div>
            <div class="rounded-lg border bg-muted/20 p-4">
              <p class="text-xs text-muted-foreground">小组执行摘要</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(buildGroupContributionHeadline(row))}</p>
              <div class="mt-3 space-y-2 text-xs text-muted-foreground">
                ${row.settlementInput.groupSummary.map((item) => `<p>${escapeHtml(item.groupName)} · 成员 ${item.memberCount} 人 · 动作 ${item.actionCount} 次 · ${escapeHtml(item.latestActionSummary)}</p>`).join('')}
              </div>
            </div>
            <div class="rounded-lg border bg-muted/20 p-4">
              <p class="text-xs text-muted-foreground">领料与扫码摘要</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(row.settlementInput.pickupSummary.summaryText)}</p>
              <p class="mt-2 text-xs text-muted-foreground">领料单号：${escapeHtml(row.settlementInput.pickupSummary.pickupSlipNo)}</p>
              <p class="mt-1 text-xs text-muted-foreground">打印版本 / 回执：${escapeHtml(row.settlementInput.pickupSummary.latestPrintVersionNo)} / ${escapeHtml(row.settlementInput.pickupSummary.receiptStatusLabel)}</p>
              <p class="mt-1 text-xs text-muted-foreground">二维码 / 凭证：${escapeHtml(row.settlementInput.pickupSummary.qrCodeValue)} / ${row.settlementInput.pickupSummary.photoProofCount} 张</p>
              <p class="mt-1 text-xs text-muted-foreground">最近扫码：${escapeHtml(row.settlementInput.pickupSummary.latestScannedAt)} · ${escapeHtml(row.settlementInput.pickupSummary.latestScannedBy)}</p>
            </div>
            <div class="rounded-lg border bg-muted/20 p-4">
              <p class="text-xs text-muted-foreground">铺布 / 入仓 / 交接摘要</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(row.executionSummaryText)}</p>
              <p class="mt-2 text-xs text-muted-foreground">最近铺布：${escapeHtml(row.settlementInput.executionSummary.latestSpreadingAt)} · ${escapeHtml(row.settlementInput.executionSummary.latestSpreadingBy)}</p>
              <p class="mt-1 text-xs text-muted-foreground">仓务摘要：${escapeHtml(row.settlementInput.warehouseSummary.summaryText)}</p>
            </div>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">结算关注输入</h3>
          <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4 text-sm">
            <div>
              <p class="text-xs text-muted-foreground">结算关注等级</p>
              <div class="mt-1">${renderBadge(cuttingSettlementFocusMeta[row.settlementInput.settlementFocusLevel].label, cuttingSettlementFocusMeta[row.settlementInput.settlementFocusLevel].className)}</div>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">人工复核</p>
              <div class="mt-1">${row.settlementInput.needsManualReview ? renderBadge('需要人工复核', 'bg-amber-50 text-amber-700') : renderBadge('可常规收口', 'bg-emerald-50 text-emerald-700')}</div>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">当前复核状态</p>
              <div class="mt-1">${renderBadge(cuttingInputReviewStatusMeta[row.reviewStatus].label, cuttingInputReviewStatusMeta[row.reviewStatus].className)}</div>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">快照确认</p>
              <p class="mt-1 font-medium text-foreground">${row.settlementInput.snapshotConfirmedAt ? escapeHtml(formatDateTime(row.settlementInput.snapshotConfirmedAt)) : '尚未确认快照'}</p>
            </div>
          </div>
          <div class="mt-4 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
            异常对结算的影响：${escapeHtml(row.settlementInput.exceptionImpactSummary.summaryText)}
            <div class="mt-2">备注：${escapeHtml(row.settlementInput.reviewNote || '当前无补充备注。')}</div>
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">评分关注输入</h3>
          <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4 text-sm">
            <div>
              <p class="text-xs text-muted-foreground">评分关注等级</p>
              <div class="mt-1">${renderBadge(cuttingScoreFocusMeta[row.scoreInput.scoreFocusLevel].label, cuttingScoreFocusMeta[row.scoreInput.scoreFocusLevel].className)}</div>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">推荐评分带</p>
              <div class="mt-1">${renderBadge(cuttingRecommendedScoreBandMeta[row.scoreInput.recommendedScoreBand].label, cuttingRecommendedScoreBandMeta[row.scoreInput.recommendedScoreBand].className)}</div>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">异常对评分影响</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(row.scoreInput.exceptionPenaltySummary)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">凭证合规摘要</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(row.scoreInput.evidenceComplianceSummary)}</p>
            </div>
          </div>
          <div class="mt-4 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
            评分备注：${escapeHtml(row.scoreInput.reviewNote || '当前无评分补充备注。')}
          </div>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">异常影响摘要</h3>
          <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4 text-sm">
            <article class="rounded-lg border bg-muted/20 p-4">
              <p class="text-xs text-muted-foreground">高风险异常数</p>
              <p class="mt-1 text-2xl font-semibold text-rose-600">${row.settlementInput.exceptionImpactSummary.highRiskExceptionCount}</p>
            </article>
            <article class="rounded-lg border bg-muted/20 p-4">
              <p class="text-xs text-muted-foreground">多次复核摘要</p>
              <p class="mt-1 text-2xl font-semibold text-amber-600">${row.settlementInput.exceptionImpactSummary.repeatedRecheckCount}</p>
            </article>
            <article class="rounded-lg border bg-muted/20 p-4">
              <p class="text-xs text-muted-foreground">凭证不足摘要</p>
              <p class="mt-1 text-2xl font-semibold text-sky-600">${row.settlementInput.exceptionImpactSummary.insufficientEvidenceCount}</p>
            </article>
            <article class="rounded-lg border bg-muted/20 p-4">
              <p class="text-xs text-muted-foreground">待关闭异常摘要</p>
              <p class="mt-1 text-2xl font-semibold text-violet-600">${row.settlementInput.exceptionImpactSummary.openExceptionCount}</p>
            </article>
          </div>
          <p class="mt-4 text-sm text-muted-foreground">关联异常编号：${row.relatedExceptionNos.length > 0 ? escapeHtml(row.relatedExceptionNos.join('、')) : '当前无关联异常。'}</p>
        </section>

        <section class="rounded-lg border p-4">
          <h3 class="font-semibold text-foreground">快捷入口区</h3>
          <div class="mt-4 flex flex-wrap gap-2">
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-settlement-action="go-platform-detail" data-route="${row.routes.platformDetail}">去平台裁片任务详情</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-settlement-action="go-platform-exception" data-route="${row.routes.platformExceptionCenter}">去裁片专项异常中心</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-settlement-action="go-order-progress" data-route="${row.routes.orderProgress}">去订单进度</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-settlement-action="go-material-prep" data-route="${row.routes.materialPrep}">去仓库配料</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-settlement-action="go-cut-piece-orders" data-route="${row.routes.cutPieceOrders}">去裁片单</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-settlement-action="go-replenishment" data-route="${row.routes.replenishment}">去补料管理</button>
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-settlement-action="go-warehouse-management" data-route="${row.routes.warehouseManagement}">去仓库管理</button>
          </div>
        </section>
      </div>
    `,
    {
      extra: `<button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-settlement-action="open-process" data-record-id="${row.id}">打开输入处理</button>`,
      cancel: { prefix: 'cutting-settlement', action: 'close-overlay', label: '关闭' },
    },
  )
}

function renderProcessDrawer(): string {
  const row = getProcessingRow()
  const draft = state.processDraft
  if (!row || !draft) return ''

  return uiDrawer(
    {
      title: '输入处理',
      subtitle: '本地演示平台对裁片结算与评分输入的确认、复核和备注。',
      closeAction: { prefix: 'cutting-settlement', action: 'close-overlay' },
      width: 'md',
    },
    `
      <div class="space-y-6 text-sm">
        <section class="rounded-lg border bg-muted/20 p-4">
          <h3 class="font-semibold text-foreground">当前输入摘要</h3>
          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p class="text-xs text-muted-foreground">输入编号</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(row.settlementInput.settlementInputNo)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">工厂 / 任务</p>
              <p class="mt-1 font-medium text-foreground">${escapeHtml(row.factoryName)} · ${escapeHtml(row.cuttingTaskNo)}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">当前结算关注等级</p>
              <div class="mt-1">${renderBadge(cuttingSettlementFocusMeta[row.settlementInput.settlementFocusLevel].label, cuttingSettlementFocusMeta[row.settlementInput.settlementFocusLevel].className)}</div>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">当前评分关注等级</p>
              <div class="mt-1">${renderBadge(cuttingScoreFocusMeta[row.scoreInput.scoreFocusLevel].label, cuttingScoreFocusMeta[row.scoreInput.scoreFocusLevel].className)}</div>
            </div>
          </div>
        </section>

        <section class="grid gap-4 md:grid-cols-2">
          ${renderProcessSelect('设置结算关注等级', 'settlementFocusLevel', draft.settlementFocusLevel, [
            { value: 'NORMAL', label: '普通' },
            { value: 'FOCUS', label: '关注' },
            { value: 'HIGH_FOCUS', label: '高关注' },
          ])}
          ${renderProcessSelect('设置评分关注等级', 'scoreFocusLevel', draft.scoreFocusLevel, [
            { value: 'NORMAL', label: '普通' },
            { value: 'WATCH', label: '观察' },
            { value: 'LOW_SCORE_RISK', label: '低评分风险' },
            { value: 'HIGH_ATTENTION', label: '高关注' },
          ])}
          ${renderProcessSelect('设置复核状态', 'reviewStatus', draft.reviewStatus, [
            { value: 'PENDING', label: '待确认' },
            { value: 'REVIEWING', label: '复核中' },
            { value: 'CONFIRMED', label: '已确认' },
            { value: 'NEED_MORE_INFO', label: '待补充说明' },
          ])}
          <div class="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            确认输入快照后，只会更新本地输入对象，不会触发财务结算、评分引擎或平台审批流。
          </div>
        </section>

        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">人工备注</span>
          <textarea
            class="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-cutting-settlement-process-field="reviewNote"
            placeholder="记录异常影响、凭证核查或后续结算 / 评分关注理由"
          >${escapeHtml(draft.reviewNote)}</textarea>
        </label>

        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">确认说明</span>
          <textarea
            class="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-cutting-settlement-process-field="confirmNote"
            placeholder="输入本次确认快照或待补充说明的收口结论"
          >${escapeHtml(draft.confirmNote)}</textarea>
        </label>
      </div>
    `,
    {
      cancel: { prefix: 'cutting-settlement', action: 'close-overlay', label: '取消' },
      confirm: { prefix: 'cutting-settlement', action: 'save-process', label: '保存处理结果', variant: 'primary' },
    },
  )
}

export function renderCuttingSettlementInputPage(): string {
  return `
    <div class="space-y-6 p-6">
      ${renderPageHeader()}
      ${renderSummaryCards()}
      ${renderFocusSection()}
      ${renderFilterSection()}
      ${renderMainTable()}
      ${renderDetailDrawer()}
      ${renderProcessDrawer()}
    </div>
  `
}

export function handleCuttingSettlementInputEvent(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-cutting-settlement-field]')
  if (fieldNode) {
    const field = fieldNode.dataset.cuttingSettlementField as keyof CuttingSettlementInputFilters | undefined
    if (!field) return false
    const input = fieldNode as HTMLInputElement | HTMLSelectElement
    state.filters = {
      ...state.filters,
      [field]: input.value,
    }
    return true
  }

  const processFieldNode = target.closest<HTMLElement>('[data-cutting-settlement-process-field]')
  if (processFieldNode) {
    const field = processFieldNode.dataset.cuttingSettlementProcessField as
      | keyof Pick<CuttingSettlementProcessDraft, 'settlementFocusLevel' | 'scoreFocusLevel' | 'reviewStatus' | 'reviewNote' | 'confirmNote'>
      | undefined
    if (!field) return false
    const input = processFieldNode as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    updateProcessField(field, input.value)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cutting-settlement-action]')
  const action = actionNode?.dataset.cuttingSettlementAction
  if (!action) return false

  const recordId = actionNode?.dataset.recordId ?? ''
  const route = actionNode?.dataset.route ?? ''

  if (action === 'open-detail' && recordId) {
    openDetail(recordId)
    return true
  }

  if (action === 'open-process' && recordId) {
    openProcess(recordId)
    return true
  }

  if (action === 'close-overlay') {
    closeOverlay()
    return true
  }

  if (action === 'focus-settlement' && recordId) {
    markSettlementAttention(recordId)
    return true
  }

  if (action === 'focus-score' && recordId) {
    markScoreAttention(recordId)
    return true
  }

  if (action === 'mark-reviewing' && recordId) {
    markReviewing(recordId)
    return true
  }

  if (action === 'confirm-input' && recordId) {
    confirmInput(recordId)
    return true
  }

  if (action === 'save-process') {
    saveProcessDraft()
    return true
  }

  if (action === 'go-overview') {
    appStore.navigate('/fcs/progress/cutting-overview')
    return true
  }

  if ((action === 'go-platform-detail' || action === 'go-platform-exception' || action === 'go-order-progress' || action === 'go-material-prep' || action === 'go-cut-piece-orders' || action === 'go-replenishment' || action === 'go-warehouse-management') && route) {
    appStore.navigate(route)
    return true
  }

  return false
}

export function isCuttingSettlementInputDialogOpen(): boolean {
  return state.activeRecordId !== null || state.processDraft !== null
}
