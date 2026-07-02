import {
  buildQualityDeductionAnalysisFilterOptions,
  buildQualityDeductionDetails,
  buildQualityDeductionExportRows,
  buildQualityDeductionKpis,
  createDefaultQualityDeductionAnalysisQuery,
  QUALITY_DEDUCTION_ANALYSIS_TIME_BASIS_LABEL,
  type QualityDeductionAnalysisDetailRow,
  type QualityDeductionAnalysisQuery,
} from '../data/fcs/quality-deduction-analysis.ts'
import { appStore } from '../state/store.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionOrderIdentityCell,
} from '../data/fcs/production-order-identity.ts'
import { escapeHtml } from '../utils.ts'

interface DeductionAnalysisPageState {
  query: QualityDeductionAnalysisQuery
  draftQuery: QualityDeductionAnalysisQuery
}

const state: DeductionAnalysisPageState = {
  query: createDefaultQualityDeductionAnalysisQuery(),
  draftQuery: createDefaultQualityDeductionAnalysisQuery(),
}

let routeQueryKey = ''

function getCurrentAnalysisSearchParams(): URLSearchParams {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return new URLSearchParams(query ?? '')
}

function syncAnalysisStateFromRoute(): void {
  const pathname = appStore.getState().pathname
  const [, query = ''] = pathname.split('?')
  if (query === routeQueryKey) return
  routeQueryKey = query

  const params = getCurrentAnalysisSearchParams()
  const keyword = params.get('keyword')
  state.query.keyword = keyword ?? ''
  state.draftQuery = { ...state.query }
}

function formatAmount(value: number): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatMoney(value: number): string {
  return `${formatAmount(value)} IDR`
}

function renderRecordSourceBadge(row: QualityDeductionAnalysisDetailRow): string {
  const className =
    row.recordSource === 'QC_REWORK_CHARGEBACK'
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'
  return `<span class="inline-flex rounded-md border px-2 py-0.5 text-xs ${className}">${escapeHtml(row.recordSourceLabel)}</span>`
}

function renderStatChip(label: string, value: string | number, tone = 'text-foreground'): string {
  return `
    <span data-danalysis-stat-chip class="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm shadow-sm">
      <span class="text-muted-foreground">${escapeHtml(label)}:</span>
      <span class="font-semibold tabular-nums ${tone}">${escapeHtml(String(value))}</span>
    </span>
  `
}

function csvEscape(value: string | number): string {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

function buildCsvHref(): string {
  const rows = buildQualityDeductionExportRows(state.query)
  if (!rows.length) return '#'
  const headers = Object.keys(rows[0])
  const lines = [
    headers.map((header) => csvEscape(header)).join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header as keyof typeof row] ?? '')).join(',')),
  ]
  return `data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${lines.join('\n')}`)}`
}

function currentRangeText(): string {
  if (!state.query.startDate && !state.query.endDate) return '全部时间'
  if (state.query.startDate && state.query.endDate) return `${state.query.startDate} 至 ${state.query.endDate}`
  if (state.query.startDate) return `${state.query.startDate} 起`
  return `截至 ${state.query.endDate}`
}

function renderSelectOptions(
  options: Array<{ value: string; label: string }>,
  currentValue: string,
): string {
  return options
    .map(
      (option) =>
        `<option value="${escapeHtml(option.value)}" ${option.value === currentValue ? 'selected' : ''}>${escapeHtml(option.label)}</option>`,
    )
    .join('')
}

function syncDraftQueryFromFilterPanel(panel: HTMLElement): void {
  panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-danalysis-filter]').forEach((node) => {
    const field = node.dataset.danalysisFilter
    if (!field) return
    ;(state.draftQuery as Record<string, string | undefined>)[field] = node.value
  })
}

export function renderDeductionAnalysisPage(): string {
  syncAnalysisStateFromRoute()
  const filterOptions = buildQualityDeductionAnalysisFilterOptions()
  const kpis = buildQualityDeductionKpis(state.query)
  const details = buildQualityDeductionDetails(state.query)
  const exportHref = buildCsvHref()

  return `
    <div class="flex flex-col gap-5 p-6">
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 class="text-2xl font-semibold">扣款记录</h1>
            <p class="mt-1 text-sm text-muted-foreground">按工厂、生产单、质检记录查看扣款事实；来源包括质检记录返工扣款和对账单瑕疵扣款。</p>
          </div>
          <div class="flex flex-col items-start gap-2 text-xs text-muted-foreground lg:items-end">
            <span class="rounded-full bg-muted px-3 py-1">统计口径：${escapeHtml(QUALITY_DEDUCTION_ANALYSIS_TIME_BASIS_LABEL[state.query.timeBasis])}</span>
            <span>统计范围：${escapeHtml(currentRangeText())}</span>
            ${
              details.length
                ? `<a class="inline-flex h-9 items-center rounded-md border px-3 text-sm text-foreground hover:bg-muted" href="${exportHref}" download="扣款记录-${escapeHtml((state.query.endDate || new Date().toISOString().slice(0, 10)).replaceAll('-', ''))}.csv">导出当前明细</a>`
                : ''
            }
          </div>
        </div>
      </div>

      <section class="rounded-md border bg-card" data-danalysis-filter-panel>
        <div class="overflow-x-auto p-4">
          <div data-danalysis-filter-row class="flex min-w-[1280px] items-end gap-3">
          <label class="flex w-72 shrink-0 flex-col gap-1 text-sm">
            <span class="text-muted-foreground">关键词</span>
            <input class="h-10 rounded-md border bg-background px-3" data-danalysis-filter="keyword" placeholder="对账单号 / 工厂 / 质检记录" value="${escapeHtml(state.draftQuery.keyword)}" />
          </label>
          <label class="flex w-56 shrink-0 flex-col gap-1 text-sm">
            <span class="text-muted-foreground">工厂</span>
            <select class="h-10 rounded-md border bg-background px-3" data-danalysis-filter="factoryId">
              ${renderSelectOptions([{ value: 'ALL', label: '全部工厂' }, ...filterOptions.factories], state.draftQuery.factoryId)}
            </select>
          </label>
          <label class="flex w-56 shrink-0 flex-col gap-1 text-sm">
            <span class="text-muted-foreground">统计口径</span>
            <select class="h-10 rounded-md border bg-background px-3" data-danalysis-filter="timeBasis">
              ${renderSelectOptions(
                Object.entries(QUALITY_DEDUCTION_ANALYSIS_TIME_BASIS_LABEL).map(([value, label]) => ({ value, label })),
                state.draftQuery.timeBasis,
              )}
            </select>
          </label>
          <label class="flex w-48 shrink-0 flex-col gap-1 text-sm">
            <span class="text-muted-foreground">扣款类型</span>
            <select class="h-10 rounded-md border bg-background px-3" data-danalysis-filter="processType">
              ${renderSelectOptions([{ value: 'ALL', label: '全部扣款类型' }, ...filterOptions.processes], state.draftQuery.processType)}
            </select>
          </label>
          <label class="flex w-48 shrink-0 flex-col gap-1 text-sm">
            <span class="text-muted-foreground">入预付款</span>
            <select class="h-10 rounded-md border bg-background px-3" data-danalysis-filter="settled">
              ${renderSelectOptions(
                [
                  { value: 'ALL', label: '全部' },
                  { value: 'YES', label: '已进入' },
                  { value: 'NO', label: '未进入' },
                ],
                state.draftQuery.settled,
              )}
            </select>
          </label>
          <div class="flex shrink-0 items-end gap-2">
            <button class="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-danalysis-action="query">查询</button>
            <button class="inline-flex h-10 items-center rounded-md border px-4 text-sm hover:bg-muted" data-danalysis-action="reset">重置</button>
          </div>
          </div>
        </div>
        <div class="border-t p-4">
          <div class="flex flex-wrap gap-2">
            ${renderStatChip('扣款记录', kpis.qcRecordCount)}
            ${renderStatChip('返工扣款', details.filter((row) => row.recordSource === 'QC_REWORK_CHARGEBACK').length, 'text-blue-600')}
            ${renderStatChip('瑕疵扣款', details.filter((row) => row.recordSource === 'STATEMENT_FACTORY_DEFECT').length, 'text-amber-600')}
            ${renderStatChip('涉及工厂', kpis.factoryCount)}
            ${renderStatChip('总扣款金额', formatMoney(kpis.totalFinancialImpactAmount), 'text-violet-600')}
          </div>
        </div>
      </section>

      <section class="rounded-md border bg-card p-5">
        <div class="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 class="text-base font-semibold">扣款明细</h2>
            <p class="text-sm text-muted-foreground">一行就是一个工厂、生产单、质检记录下的扣款记录。</p>
          </div>
          <span class="text-xs text-muted-foreground">来源：质检记录返工扣款 / 对账单瑕疵扣款</span>
        </div>

        ${
          details.length === 0
            ? '<div class="flex h-48 items-center justify-center text-sm text-muted-foreground">当前筛选条件下暂无扣款记录</div>'
            : `
              <div class="overflow-x-auto rounded-md border">
                <table class="w-full min-w-[1360px] text-sm">
                  <thead>
                    <tr class="border-b bg-muted/40 text-left">
                      <th class="px-4 py-2 font-medium">工厂</th>
                      <th class="px-4 py-2 font-medium">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE}</th>
                      <th class="px-4 py-2 font-medium">质检记录</th>
                      <th class="px-4 py-2 font-medium">来源</th>
                      <th class="px-4 py-2 font-medium">扣款类型 / 原因</th>
                      <th class="px-4 py-2 text-right font-medium">扣款数量</th>
                      <th class="px-4 py-2 text-right font-medium">扣款金额</th>
                      <th class="px-4 py-2 font-medium">状态</th>
                      <th class="px-4 py-2 font-medium">时间</th>
                      <th class="px-4 py-2 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${details
                      .map(
                        (row) => `
                          <tr class="border-b last:border-b-0 align-top">
                            <td class="px-4 py-3">${escapeHtml(row.factoryName)}</td>
                            <td class="px-4 py-3">${renderProductionOrderIdentityCell(row.productionOrderNo)}</td>
                            <td class="px-4 py-3 font-mono text-xs">${escapeHtml(row.qcNo)}</td>
                            <td class="px-4 py-3">${renderRecordSourceBadge(row)}</td>
                            <td class="px-4 py-3">
                              <div class="font-medium">${escapeHtml(row.processLabel)}</div>
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.deductionReasonName ?? '—')}</div>
                            </td>
                            <td class="px-4 py-3 text-right tabular-nums">${row.factoryLiabilityQty}</td>
                            <td class="px-4 py-3 text-right tabular-nums">${formatMoney(row.effectiveQualityDeductionAmount)}</td>
                            <td class="px-4 py-3">
                              <div>${escapeHtml(row.settlementImpactStatusLabel)}</div>
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.settlementCycleLabel ?? '未进入对账单')}</div>
                            </td>
                            <td class="px-4 py-3 text-xs text-muted-foreground">
                              <div class="flex flex-col gap-1">
                                <span>${escapeHtml(row.displayTimeLabel)}</span>
                                <span>${escapeHtml(row.detailSummary)}</span>
                              </div>
                            </td>
                            <td class="px-4 py-3">
                              <div class="flex flex-wrap items-center gap-1">
                                <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-nav="${escapeHtml(row.qcHref)}">查看来源证据</button>
                                ${
                                  row.deductionHref
                                    ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-nav="${escapeHtml(row.deductionHref)}">查看对账单</button>`
                                    : '<span class="px-2 text-xs text-muted-foreground">—</span>'
                                }
                              </div>
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
      </section>
    </div>
  `
}

export function handleDeductionAnalysisEvent(target: HTMLElement): boolean {
  const filterNode = target.closest<HTMLElement>('[data-danalysis-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const field = filterNode.dataset.danalysisFilter
    if (!field) return false
    ;(state.draftQuery as Record<string, string | undefined>)[field] = filterNode.value
    return false
  }

  const actionNode = target.closest<HTMLElement>('[data-danalysis-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.danalysisAction
  if (action === 'reset') {
    state.query = createDefaultQualityDeductionAnalysisQuery()
    state.draftQuery = { ...state.query }
    return true
  }
  if (action === 'query') {
    const panel = actionNode.closest<HTMLElement>('[data-danalysis-filter-panel]')
    if (panel) syncDraftQueryFromFilterPanel(panel)
    state.query = { ...state.draftQuery }
    return true
  }
  return false
}

export function isDeductionAnalysisDialogOpen(): boolean {
  return false
}
