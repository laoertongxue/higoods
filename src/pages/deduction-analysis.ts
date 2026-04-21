import {
  buildQualityDeductionAnalysisFilterOptions,
  buildQualityDeductionBreakdown,
  buildQualityDeductionDetails,
  buildQualityDeductionExportRows,
  buildQualityDeductionKpis,
  buildQualityDeductionTrend,
  createDefaultQualityDeductionAnalysisQuery,
  QUALITY_DEDUCTION_ANALYSIS_DIMENSION_LABEL,
  QUALITY_DEDUCTION_ANALYSIS_TIME_BASIS_LABEL,
  type QualityDeductionAnalysisDimension,
  type QualityDeductionAnalysisQuery,
} from '../data/fcs/quality-deduction-analysis.ts'
import { appStore } from '../state/store.ts'
import {
  QUALITY_DEDUCTION_DISPUTE_STATUS_LABEL,
  QUALITY_DEDUCTION_FACTORY_RESPONSE_STATUS_LABEL,
  QUALITY_DEDUCTION_LIABILITY_STATUS_LABEL,
  QUALITY_DEDUCTION_QC_RESULT_LABEL,
  QUALITY_DEDUCTION_SETTLEMENT_IMPACT_STATUS_LABEL,
} from '../data/fcs/quality-deduction-selectors.ts'
import { escapeHtml } from '../utils.ts'

interface DeductionAnalysisPageState {
  query: QualityDeductionAnalysisQuery
  breakdownDimension: QualityDeductionAnalysisDimension
}

const state: DeductionAnalysisPageState = {
  query: createDefaultQualityDeductionAnalysisQuery(),
  breakdownDimension: 'FACTORY',
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
}

const BREAKDOWN_DIMENSIONS: QualityDeductionAnalysisDimension[] = [
  'FACTORY',
  'PROCESS',
  'WAREHOUSE',
  'QC_RESULT',
  'LIABILITY_STATUS',
  'FACTORY_RESPONSE_STATUS',
  'DISPUTE_STATUS',
  'SETTLEMENT_IMPACT_STATUS',
]

function formatAmount(value: number): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatSignedAmount(value: number): string {
  if (value > 0) return `+${formatAmount(value)}`
  if (value < 0) return `-${formatAmount(Math.abs(value))}`
  return formatAmount(0)
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

function renderStatusOptions(labelMap: Record<string, string>, currentValue: string, allLabel: string): string {
  return renderSelectOptions(
    [{ value: 'ALL', label: allLabel }, ...Object.entries(labelMap).map(([value, label]) => ({ value, label }))],
    currentValue,
  )
}

function renderTrendSection(): string {
  const trend = buildQualityDeductionTrend(state.query)
  if (!trend.length) {
    return '<div class="flex h-56 items-center justify-center text-sm text-muted-foreground">当前筛选下暂无趋势数据</div>'
  }

  const maxImpact = Math.max(...trend.map((item) => item.totalFinancialImpactAmount), 1)

  return `
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-foreground">趋势分析</h3>
          <p class="mt-1 text-xs text-muted-foreground">按${escapeHtml(QUALITY_DEDUCTION_ANALYSIS_TIME_BASIS_LABEL[state.query.timeBasis])}汇总待确认金额、正式质量扣款流水金额、总财务影响和历史金额。</p>
        </div>
        <span class="text-xs text-muted-foreground">当前版本中的历史金额仅用于保留历史阅读体验，正式对账只汇总已成立的质量扣款流水。</span>
      </div>
      <div class="overflow-x-auto rounded-md border">
        <table class="w-full min-w-[760px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-left">
              <th class="px-4 py-2 font-medium">时间归属</th>
              <th class="px-4 py-2 text-right font-medium">记录数</th>
              <th class="px-4 py-2 text-right font-medium">待确认金额</th>
              <th class="px-4 py-2 text-right font-medium">生效质量扣款</th>
              <th class="px-4 py-2 text-right font-medium">总财务影响</th>
              <th class="px-4 py-2 text-right font-medium">历史金额</th>
              <th class="px-4 py-2 font-medium">影响分布</th>
            </tr>
          </thead>
          <tbody>
            ${trend
              .map((item) => {
                const width = Math.max(8, Math.round((item.totalFinancialImpactAmount / maxImpact) * 100))
                return `
                  <tr class="border-b last:border-b-0">
                    <td class="px-4 py-3 font-medium">${escapeHtml(item.label)}</td>
                    <td class="px-4 py-3 text-right tabular-nums">${item.recordCount}</td>
                    <td class="px-4 py-3 text-right tabular-nums">${formatAmount(item.blockedProcessingFeeAmount)}</td>
                    <td class="px-4 py-3 text-right tabular-nums">${formatAmount(item.effectiveQualityDeductionAmount)}</td>
                    <td class="px-4 py-3 text-right tabular-nums">${formatAmount(item.totalFinancialImpactAmount)}</td>
                    <td class="px-4 py-3 text-right tabular-nums ${item.adjustmentAmount < 0 ? 'text-emerald-700' : item.adjustmentAmount > 0 ? 'text-amber-700' : 'text-muted-foreground'}">${formatSignedAmount(item.adjustmentAmount)}</td>
                    <td class="px-4 py-3">
                      <div class="h-2 w-full rounded-full bg-muted">
                        <div class="h-2 rounded-full bg-amber-500" style="width: ${width}%"></div>
                      </div>
                    </td>
                  </tr>
                `
              })
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `
}

function renderBreakdownSection(): string {
  const rows = buildQualityDeductionBreakdown(state.query, state.breakdownDimension)
  if (!rows.length) {
    return '<div class="flex h-56 items-center justify-center text-sm text-muted-foreground">当前筛选下暂无维度分解数据</div>'
  }

  return `
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap gap-2">
        ${BREAKDOWN_DIMENSIONS.map(
          (dimension) => `
            <button
              class="${
                state.breakdownDimension === dimension
                  ? 'rounded-md bg-foreground px-3 py-1.5 text-sm text-background'
                  : 'rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground'
              }"
              data-danalysis-dimension="${dimension}"
            >
              ${escapeHtml(QUALITY_DEDUCTION_ANALYSIS_DIMENSION_LABEL[dimension])}
            </button>
          `,
        ).join('')}
      </div>
      <div class="overflow-x-auto rounded-md border">
        <table class="w-full min-w-[860px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-left">
              <th class="px-4 py-2 font-medium">分组项</th>
              <th class="px-4 py-2 text-right font-medium">记录数</th>
              <th class="px-4 py-2 text-right font-medium">待确认金额</th>
              <th class="px-4 py-2 text-right font-medium">生效质量扣款</th>
              <th class="px-4 py-2 text-right font-medium">总财务影响</th>
              <th class="px-4 py-2 text-right font-medium">历史金额</th>
              <th class="px-4 py-2 text-right font-medium">占比</th>
              <th class="px-4 py-2 font-medium">钻取</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((row) => {
                const isActive =
                  state.query.drilldownDimension === state.breakdownDimension &&
                  state.query.drilldownValue === row.key
                return `
                  <tr class="border-b last:border-b-0 ${isActive ? 'bg-amber-50/70' : ''}">
                    <td class="px-4 py-3 font-medium">${escapeHtml(row.label)}</td>
                    <td class="px-4 py-3 text-right tabular-nums">${row.recordCount}</td>
                    <td class="px-4 py-3 text-right tabular-nums">${formatAmount(row.blockedProcessingFeeAmount)}</td>
                    <td class="px-4 py-3 text-right tabular-nums">${formatAmount(row.effectiveQualityDeductionAmount)}</td>
                    <td class="px-4 py-3 text-right tabular-nums">${formatAmount(row.totalFinancialImpactAmount)}</td>
                    <td class="px-4 py-3 text-right tabular-nums ${row.adjustmentAmount < 0 ? 'text-emerald-700' : row.adjustmentAmount > 0 ? 'text-amber-700' : 'text-muted-foreground'}">${formatSignedAmount(row.adjustmentAmount)}</td>
                    <td class="px-4 py-3 text-right tabular-nums">${row.shareRate.toFixed(1)}%</td>
                    <td class="px-4 py-3">
                      <button
                        class="inline-flex h-8 items-center rounded-md border px-3 text-xs ${isActive ? 'border-amber-300 bg-amber-100 text-amber-800' : 'hover:bg-muted'}"
                        data-danalysis-breakdown-value="${escapeHtml(row.key)}"
                        data-danalysis-breakdown-label="${escapeHtml(row.label)}"
                      >
                        ${isActive ? '已联动明细' : '联动明细'}
                      </button>
                    </td>
                  </tr>
                `
              })
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `
}

export function renderDeductionAnalysisPage(): string {
  syncAnalysisStateFromRoute()
  const filterOptions = buildQualityDeductionAnalysisFilterOptions()
  const kpis = buildQualityDeductionKpis(state.query)
  const details = buildQualityDeductionDetails(state.query)
  const exportHref = buildCsvHref()
  const drilldownActive =
    state.query.drilldownDimension === state.breakdownDimension && Boolean(state.query.drilldownValue)

  return `
    <div class="flex flex-col gap-6 p-6">
      <div class="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 class="text-2xl font-semibold">扣款分析</h1>
            <p class="mt-1 text-sm text-muted-foreground">用于按时间、工厂、工序、仓库和状态等维度分析扣款与结算影响，并从汇总快速钻取到质检记录和扣款依据。</p>
          </div>
          <div class="flex flex-col items-start gap-2 text-xs text-muted-foreground lg:items-end">
            <span class="rounded-full bg-muted px-3 py-1">统计口径：${escapeHtml(QUALITY_DEDUCTION_ANALYSIS_TIME_BASIS_LABEL[state.query.timeBasis])}</span>
            <span>统计范围：${escapeHtml(currentRangeText())}</span>
            ${
              details.length
                ? `<a class="inline-flex h-9 items-center rounded-md border px-3 text-sm text-foreground hover:bg-muted" href="${exportHref}" download="扣款分析-${escapeHtml((state.query.endDate || new Date().toISOString().slice(0, 10)).replaceAll('-', ''))}.csv">导出当前明细</a>`
                : ''
            }
          </div>
        </div>
      </div>

      <section class="rounded-xl border bg-card p-5">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">关键词</span>
            <input class="h-10 rounded-md border bg-background px-3" data-danalysis-filter="keyword" placeholder="质检单号 / 生产单 / 回货批次号" value="${escapeHtml(state.query.keyword)}" />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">时间口径</span>
            <select class="h-10 rounded-md border bg-background px-3" data-danalysis-filter="timeBasis">
              ${renderSelectOptions(
                Object.entries(QUALITY_DEDUCTION_ANALYSIS_TIME_BASIS_LABEL).map(([value, label]) => ({ value, label })),
                state.query.timeBasis,
              )}
            </select>
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">开始日期</span>
            <input class="h-10 rounded-md border bg-background px-3" type="date" data-danalysis-filter="startDate" value="${escapeHtml(state.query.startDate)}" />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">结束日期</span>
            <input class="h-10 rounded-md border bg-background px-3" type="date" data-danalysis-filter="endDate" value="${escapeHtml(state.query.endDate)}" />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">工厂</span>
            <select class="h-10 rounded-md border bg-background px-3" data-danalysis-filter="factoryId">
              ${renderSelectOptions([{ value: 'ALL', label: '全部工厂' }, ...filterOptions.factories], state.query.factoryId)}
            </select>
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">回货环节 / 工序</span>
            <select class="h-10 rounded-md border bg-background px-3" data-danalysis-filter="processType">
              ${renderSelectOptions([{ value: 'ALL', label: '全部工序' }, ...filterOptions.processes], state.query.processType)}
            </select>
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">入仓仓库</span>
            <select class="h-10 rounded-md border bg-background px-3" data-danalysis-filter="warehouseId">
              ${renderSelectOptions([{ value: 'ALL', label: '全部仓库' }, ...filterOptions.warehouses], state.query.warehouseId)}
            </select>
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">质检结果</span>
            <select class="h-10 rounded-md border bg-background px-3" data-danalysis-filter="qcResult">
              ${renderStatusOptions(QUALITY_DEDUCTION_QC_RESULT_LABEL, state.query.qcResult, '全部结果')}
            </select>
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">责任状态</span>
            <select class="h-10 rounded-md border bg-background px-3" data-danalysis-filter="liabilityStatus">
              ${renderStatusOptions(QUALITY_DEDUCTION_LIABILITY_STATUS_LABEL, state.query.liabilityStatus, '全部责任状态')}
            </select>
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">工厂响应状态</span>
            <select class="h-10 rounded-md border bg-background px-3" data-danalysis-filter="factoryResponseStatus">
              ${renderStatusOptions(QUALITY_DEDUCTION_FACTORY_RESPONSE_STATUS_LABEL, state.query.factoryResponseStatus, '全部响应状态')}
            </select>
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">异议状态</span>
            <select class="h-10 rounded-md border bg-background px-3" data-danalysis-filter="disputeStatus">
              ${renderStatusOptions(QUALITY_DEDUCTION_DISPUTE_STATUS_LABEL, state.query.disputeStatus, '全部异议状态')}
            </select>
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">结算影响状态</span>
            <select class="h-10 rounded-md border bg-background px-3" data-danalysis-filter="settlementImpactStatus">
              ${renderStatusOptions(QUALITY_DEDUCTION_SETTLEMENT_IMPACT_STATUS_LABEL, state.query.settlementImpactStatus, '全部结算影响状态')}
            </select>
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">是否存在历史金额记录</span>
            <select class="h-10 rounded-md border bg-background px-3" data-danalysis-filter="hasAdjustment">
              ${renderSelectOptions(
                [
                  { value: 'ALL', label: '全部' },
                  { value: 'YES', label: '存在历史金额记录' },
                  { value: 'NO', label: '无历史金额记录' },
                ],
                state.query.hasAdjustment,
              )}
            </select>
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">是否已纳入结算单</span>
            <select class="h-10 rounded-md border bg-background px-3" data-danalysis-filter="includedInStatement">
              ${renderSelectOptions(
                [
                  { value: 'ALL', label: '全部' },
                  { value: 'YES', label: '已纳入' },
                  { value: 'NO', label: '未纳入' },
                ],
                state.query.includedInStatement,
              )}
            </select>
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted-foreground">是否已进入预付款批次</span>
            <select class="h-10 rounded-md border bg-background px-3" data-danalysis-filter="settled">
              ${renderSelectOptions(
                [
                  { value: 'ALL', label: '全部' },
                  { value: 'YES', label: '已进入' },
                  { value: 'NO', label: '未进入' },
                ],
                state.query.settled,
              )}
            </select>
          </label>
          <div class="flex items-end">
            <button class="inline-flex h-10 items-center rounded-md border px-3 text-sm hover:bg-muted" data-danalysis-action="reset">
              重置筛选
            </button>
          </div>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <article class="rounded-xl border bg-card p-4">
          <p class="text-xs text-muted-foreground">涉及质检记录数</p>
          <p class="mt-2 text-2xl font-semibold tabular-nums">${kpis.qcRecordCount}</p>
        </article>
        <article class="rounded-xl border bg-card p-4">
          <p class="text-xs text-muted-foreground">涉及工厂数</p>
          <p class="mt-2 text-2xl font-semibold tabular-nums">${kpis.factoryCount}</p>
        </article>
        <article class="rounded-xl border bg-card p-4">
          <p class="text-xs text-muted-foreground">待确认金额</p>
          <p class="mt-2 text-2xl font-semibold tabular-nums">${formatAmount(kpis.blockedProcessingFeeAmount)}</p>
        </article>
        <article class="rounded-xl border bg-card p-4">
          <p class="text-xs text-muted-foreground">生效质量扣款金额</p>
          <p class="mt-2 text-2xl font-semibold tabular-nums">${formatAmount(kpis.effectiveQualityDeductionAmount)}</p>
        </article>
        <article class="rounded-xl border bg-card p-4">
          <p class="text-xs text-muted-foreground">总财务影响金额</p>
          <p class="mt-2 text-2xl font-semibold tabular-nums">${formatAmount(kpis.totalFinancialImpactAmount)}</p>
          <p class="mt-1 text-xs text-muted-foreground">= 待确认金额 + 正式质量扣款流水金额</p>
        </article>
        <article class="rounded-xl border bg-card p-4">
          <p class="text-xs text-muted-foreground">历史金额</p>
          <p class="mt-2 text-2xl font-semibold tabular-nums ${kpis.nextCycleAdjustmentAmount < 0 ? 'text-emerald-700' : kpis.nextCycleAdjustmentAmount > 0 ? 'text-amber-700' : ''}">${formatSignedAmount(kpis.nextCycleAdjustmentAmount)}</p>
          <p class="mt-1 text-xs text-muted-foreground">当前版本中的历史金额仅作过渡展示。</p>
        </article>
      </section>

      <section class="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_1fr]">
        <article class="rounded-xl border bg-card p-5">
          ${renderTrendSection()}
        </article>
        <article class="rounded-xl border bg-card p-5">
          <div class="mb-4 flex flex-col gap-1">
            <h3 class="text-sm font-semibold text-foreground">状态补充指标</h3>
            <p class="text-xs text-muted-foreground">用于区分异议中金额、已纳入对账金额和已进入预付款批次金额，不与历史金额重复计入。</p>
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div class="rounded-lg border bg-muted/20 p-4">
              <p class="text-xs text-muted-foreground">异议中金额</p>
              <p class="mt-2 text-xl font-semibold tabular-nums">${formatAmount(kpis.disputingAmount)}</p>
            </div>
            <div class="rounded-lg border bg-muted/20 p-4">
              <p class="text-xs text-muted-foreground">已纳入对账金额</p>
              <p class="mt-2 text-xl font-semibold tabular-nums">${formatAmount(kpis.includedAmount)}</p>
            </div>
            <div class="rounded-lg border bg-muted/20 p-4">
              <p class="text-xs text-muted-foreground">已进入预付款批次金额</p>
              <p class="mt-2 text-xl font-semibold tabular-nums">${formatAmount(kpis.settledAmount)}</p>
            </div>
          </div>
        </article>
      </section>

      <section class="rounded-xl border bg-card p-5">
        <div class="mb-4 flex flex-col gap-2">
          <h2 class="text-base font-semibold">维度分解</h2>
          <p class="text-sm text-muted-foreground">点击任一分组项后，仅联动下方明细，不会改动顶部 KPI 和趋势口径。</p>
        </div>
        ${renderBreakdownSection()}
      </section>

      <section class="rounded-xl border bg-card p-5">
        <div class="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 class="text-base font-semibold">明细钻取</h2>
            <p class="text-sm text-muted-foreground">展示当前筛选口径下的质量扣款与结算影响明细，可继续跳转到质检记录和扣款依据。</p>
          </div>
          ${
            drilldownActive
              ? `
                <div class="flex items-center gap-2">
                  <span class="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">已按 ${escapeHtml(QUALITY_DEDUCTION_ANALYSIS_DIMENSION_LABEL[state.breakdownDimension])} 钻取：${escapeHtml(
                    buildQualityDeductionBreakdown(state.query, state.breakdownDimension).find(
                      (row) => row.key === state.query.drilldownValue,
                    )?.label ?? state.query.drilldownValue ?? '',
                  )}</span>
                  <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-danalysis-action="clear-drilldown">清除钻取</button>
                </div>
              `
              : '<span class="text-xs text-muted-foreground">未选择维度钻取，明细展示当前全部筛选结果</span>'
          }
        </div>

        ${
          details.length === 0
            ? '<div class="flex h-48 items-center justify-center text-sm text-muted-foreground">当前筛选条件下暂无扣款分析明细</div>'
            : `
              <div class="overflow-x-auto rounded-md border">
                <table class="w-full min-w-[1720px] text-sm">
                  <thead>
                    <tr class="border-b bg-muted/40 text-left">
                      <th class="px-4 py-2 font-medium">质检单号</th>
                      <th class="px-4 py-2 font-medium">回货批次号</th>
                      <th class="px-4 py-2 font-medium">生产单号</th>
                      <th class="px-4 py-2 font-medium">工厂</th>
                      <th class="px-4 py-2 font-medium">工序</th>
                      <th class="px-4 py-2 font-medium">质检结果</th>
                      <th class="px-4 py-2 text-right font-medium">工厂责任数量</th>
                      <th class="px-4 py-2 font-medium">工厂响应状态</th>
                      <th class="px-4 py-2 font-medium">异议状态</th>
                      <th class="px-4 py-2 font-medium">结算影响状态</th>
                      <th class="px-4 py-2 text-right font-medium">待确认金额</th>
                      <th class="px-4 py-2 text-right font-medium">生效质量扣款</th>
                      <th class="px-4 py-2 text-right font-medium">总财务影响</th>
                      <th class="px-4 py-2 font-medium">历史金额</th>
                      <th class="px-4 py-2 font-medium">${escapeHtml(
                        state.query.timeBasis === 'SETTLEMENT_CYCLE' ? '结算周期 / 归属时间' : '财务影响生效时间',
                      )}</th>
                      <th class="px-4 py-2 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${details
                      .map(
                        (row) => `
                          <tr class="border-b last:border-b-0 align-top">
                            <td class="px-4 py-3 font-mono text-xs">${escapeHtml(row.qcNo)}</td>
                            <td class="px-4 py-3 font-mono text-xs">${escapeHtml(row.returnInboundBatchNo)}</td>
                            <td class="px-4 py-3 font-mono text-xs">${escapeHtml(row.productionOrderNo)}</td>
                            <td class="px-4 py-3">${escapeHtml(row.factoryName)}</td>
                            <td class="px-4 py-3">${escapeHtml(row.processLabel)}</td>
                            <td class="px-4 py-3">${escapeHtml(row.qcResultLabel)}</td>
                            <td class="px-4 py-3 text-right tabular-nums">${row.factoryLiabilityQty}</td>
                            <td class="px-4 py-3">${escapeHtml(row.factoryResponseStatusLabel)}</td>
                            <td class="px-4 py-3">${escapeHtml(row.disputeStatusLabel)}</td>
                            <td class="px-4 py-3">${escapeHtml(row.settlementImpactStatusLabel)}</td>
                            <td class="px-4 py-3 text-right tabular-nums">${formatAmount(row.blockedProcessingFeeAmount)}</td>
                            <td class="px-4 py-3 text-right tabular-nums">${formatAmount(row.effectiveQualityDeductionAmount)}</td>
                            <td class="px-4 py-3 text-right tabular-nums">${formatAmount(row.totalFinancialImpactAmount)}</td>
                            <td class="px-4 py-3">
                              ${
                                row.hasAdjustment
                                  ? `
                                    <div class="flex flex-col gap-1">
                                      <span>${escapeHtml(row.adjustmentTypeLabel ?? '—')}</span>
                                      <span class="tabular-nums ${row.adjustmentAmountSigned < 0 ? 'text-emerald-700' : 'text-amber-700'}">${formatSignedAmount(row.adjustmentAmountSigned)}</span>
                                      <span class="text-xs text-muted-foreground">${escapeHtml(row.targetSettlementCycleId ?? '—')}</span>
                                    </div>
                                  `
                                  : '<span class="text-muted-foreground">—</span>'
                              }
                            </td>
                            <td class="px-4 py-3 text-xs text-muted-foreground">
                              <div class="flex flex-col gap-1">
                                <span>${escapeHtml(row.displayTimeLabel)}</span>
                                <span>${escapeHtml(row.detailSummary)}</span>
                              </div>
                            </td>
                            <td class="px-4 py-3">
                              <div class="flex items-center gap-1">
                                <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-nav="${escapeHtml(row.qcHref)}">查看质检记录</button>
                                ${
                                  row.deductionHref
                                    ? `<button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-nav="${escapeHtml(row.deductionHref)}">查看扣款依据</button>`
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
    ;(state.query as Record<string, string | undefined>)[field] = filterNode.value
    return true
  }

  const dimensionNode = target.closest<HTMLElement>('[data-danalysis-dimension]')
  if (dimensionNode) {
    const next = dimensionNode.dataset.danalysisDimension as QualityDeductionAnalysisDimension | undefined
    if (!next) return false
    state.breakdownDimension = next
    state.query.drilldownDimension = undefined
    state.query.drilldownValue = undefined
    return true
  }

  const drilldownNode = target.closest<HTMLElement>('[data-danalysis-breakdown-value]')
  if (drilldownNode) {
    const value = drilldownNode.dataset.danalysisBreakdownValue
    if (!value) return false
    const isSame =
      state.query.drilldownDimension === state.breakdownDimension && state.query.drilldownValue === value
    state.query.drilldownDimension = isSame ? undefined : state.breakdownDimension
    state.query.drilldownValue = isSame ? undefined : value
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-danalysis-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.danalysisAction
  if (action === 'reset') {
    state.query = createDefaultQualityDeductionAnalysisQuery()
    state.breakdownDimension = 'FACTORY'
    return true
  }
  if (action === 'clear-drilldown') {
    state.query.drilldownDimension = undefined
    state.query.drilldownValue = undefined
    return true
  }
  return false
}

export function isDeductionAnalysisDialogOpen(): boolean {
  return false
}
