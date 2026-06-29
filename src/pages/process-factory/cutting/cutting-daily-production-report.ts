import { escapeHtml } from '../../../utils.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionOrderIdentityCell,
} from '../../../data/fcs/production-order-identity.ts'
import {
  buildCuttingDailyProductionReport,
  CUTTING_DAILY_DEMO_REPORT_DATE,
  CUTTING_DAILY_REPORT_PATH,
  cuttingDailyTabs,
  getCuttingDailyExecutionOwnerLabel,
  getCuttingDailyTabLabel,
  type CuttingDailyDetailRow,
  type CuttingDailyExecutionOwner,
  type CuttingDailyMetric,
  type CuttingDailyMetricAvailability,
  type CuttingDailyProductionContributionRow,
  type CuttingDailyProductionReport,
  type CuttingDailyProductionReportQuery,
  type CuttingDailyTab,
} from './cutting-daily-production-report-model.ts'

const PAGE_PATH = CUTTING_DAILY_REPORT_PATH

type DetailFilters = {
  detailKeyword: string
  detailStatus: string
  detailMetric: string
  page: number
  pageSize: number
}

const availabilityLabelMap: Record<CuttingDailyMetricAvailability, string> = {
  AVAILABLE: '可计算',
  NO_RECORDS: '当日无记录',
  PARTIAL: '部分可计算',
  UNAVAILABLE: '无法计算',
}

type UiTone = 'blue' | 'green' | 'amber' | 'red' | 'gray' | 'violet' | 'cyan'

const tabAccentMap: Record<CuttingDailyTab, { tone: UiTone; icon: string }> = {
  overview: { tone: 'blue', icon: 'activity' },
  tasks: { tone: 'blue', icon: 'clipboard-list' },
  marker: { tone: 'violet', icon: 'layers' },
  spreading: { tone: 'cyan', icon: 'scissors' },
  fulfillment: { tone: 'green', icon: 'package-check' },
  materials: { tone: 'amber', icon: 'package-open' },
  tickets: { tone: 'violet', icon: 'ticket' },
  warehouse: { tone: 'red', icon: 'warehouse' },
}

const toneCssMap: Record<UiTone, { accent: string; soft: string }> = {
  blue: { accent: '#2563eb', soft: '#eff6ff' },
  green: { accent: '#16a34a', soft: '#f0fdf4' },
  amber: { accent: '#d97706', soft: '#fffbeb' },
  red: { accent: '#dc2626', soft: '#fef2f2' },
  gray: { accent: '#64748b', soft: '#f8fafc' },
  violet: { accent: '#7c3aed', soft: '#f5f3ff' },
  cyan: { accent: '#0891b2', soft: '#ecfeff' },
}

function renderDailyReportStyles(): string {
  return `
    <style>
      .cdr-page {
        --cdr-bg: #f6f7f9;
        --cdr-panel: #ffffff;
        --cdr-ink: #171717;
        --cdr-muted: #737373;
        --cdr-line: #e5e7eb;
        --cdr-blue: #2563eb;
        --cdr-blue-50: #eff6ff;
        --cdr-blue-100: #dbeafe;
        --cdr-blue-700: #1d4ed8;
        --cdr-radius: 10px;
        --cdr-shadow: 0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.05);
        width: 100%;
        max-width: none;
        margin: 0;
        color: var(--cdr-ink);
        container-type: inline-size;
      }
      .cdr-page * { box-sizing: border-box; }
      .cdr-head { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 14px; }
      .cdr-title { margin: 0 0 5px; font-size: 22px; font-weight: 750; letter-spacing: 0; line-height: 1.25; }
      .cdr-btn { height: 36px; border: 1px solid var(--cdr-line); background: #fff; border-radius: 8px; padding: 0 12px; display: inline-flex; align-items: center; gap: 7px; color: #404040; font-weight: 550; white-space: nowrap; font-size: 13px; }
      .cdr-btn:hover { background: #f8fafc; }
      .cdr-btn-primary { background: var(--cdr-blue); border-color: var(--cdr-blue); color: #fff; }
      .cdr-btn-primary:hover { background: var(--cdr-blue-700); }
      .cdr-tabs { display: flex; gap: 2px; margin-top: 0; padding: 0 2px; overflow-x: auto; background: #fff; border-radius: var(--cdr-radius); border: 1px solid var(--cdr-line); box-shadow: var(--cdr-shadow); }
      .cdr-tab { height: 44px; padding: 0 15px; border: 0; background: transparent; color: #666; position: relative; white-space: nowrap; font-weight: 650; font-size: 13px; display: inline-flex; align-items: center; }
      .cdr-tab:hover { color: #222; background: #f8fafc; }
      .cdr-tab-active { color: var(--cdr-blue); }
      .cdr-tab-active:after { content: ""; position: absolute; left: 12px; right: 12px; bottom: 0; height: 2px; background: var(--cdr-blue); border-radius: 2px; }
      .cdr-tab-count { font-size: 10px; border-radius: 999px; padding: 1px 5px; margin-left: 4px; background: #f1f5f9; color: #64748b; }
      .cdr-tab-active .cdr-tab-count { background: var(--cdr-blue-100); color: var(--cdr-blue-700); }
      .cdr-metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin: 10px 0 12px; }
      .cdr-metric-card { background: #fff; border: 1px solid var(--cdr-line); border-radius: var(--cdr-radius); padding: 12px; min-width: 0; min-height: 126px; box-shadow: var(--cdr-shadow); transition: .15s; position: relative; overflow: hidden; text-align: left; }
      .cdr-metric-card:hover { border-color: #bfdbfe; box-shadow: 0 6px 18px rgba(15,23,42,.07); transform: translateY(-1px); }
      .cdr-metric-card:before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--card-accent, var(--cdr-blue)); }
      .cdr-metric-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; }
      .cdr-metric-title { min-width: 0; font-weight: 700; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .cdr-metric-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: var(--card-soft, var(--cdr-blue-50)); color: var(--card-accent, var(--cdr-blue)); flex: 0 0 auto; }
      .cdr-metric-primary { display: flex; align-items: baseline; gap: 5px; margin-bottom: 9px; }
      .cdr-metric-primary strong { font-size: 22px; line-height: 1; letter-spacing: 0; font-weight: 750; }
      .cdr-metric-primary span { font-size: 11px; color: var(--cdr-muted); }
      .cdr-mini-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 8px; border-top: 1px dashed #e5e7eb; padding-top: 9px; }
      .cdr-mini b { display: block; font-size: 13px; font-weight: 700; }
      .cdr-mini span { display: block; margin-top: 2px; color: var(--cdr-muted); font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .cdr-metric-footer { margin-top: 8px; display: flex; justify-content: space-between; gap: 8px; color: var(--cdr-muted); font-size: 10px; }
      .cdr-metric-link { color: var(--cdr-blue); font-weight: 650; white-space: nowrap; }
      .cdr-panel { border: 1px solid var(--cdr-line); background: #fff; border-radius: var(--cdr-radius); box-shadow: var(--cdr-shadow); }
      .cdr-tab-content { min-height: 500px; }
      .cdr-section-pad { padding: 14px; }
      .cdr-section-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 10px; }
      .cdr-section-heading h2 { font-size: 15px; line-height: 1.25; margin: 0; font-weight: 750; }
      .cdr-section-heading p { font-size: 11px; color: var(--cdr-muted); margin: 3px 0 0; line-height: 1.5; }
      .cdr-flow { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 18px; margin-bottom: 13px; }
      .cdr-flow-node { border: 1px solid var(--cdr-line); border-radius: 9px; padding: 11px; position: relative; background: #fff; min-width: 0; }
      .cdr-flow-node:not(:last-child):after { content: "→"; position: absolute; right: -15px; top: 50%; transform: translateY(-50%); color: #94a3b8; font-weight: 700; }
      .cdr-flow-node span { font-size: 10px; color: var(--cdr-muted); }
      .cdr-flow-node b { display: block; font-size: 18px; margin-top: 4px; font-weight: 750; }
      .cdr-flow-node em { display: block; font-style: normal; font-size: 10px; color: #64748b; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .cdr-data-note { border-left: 3px solid #93c5fd; background: #f8fbff; padding: 9px 11px; margin-bottom: 12px; color: #475569; font-size: 11px; line-height: 1.5; border-radius: 0 7px 7px 0; }
      .cdr-detail-filter { border: 1px solid var(--cdr-line); background: #fafafa; border-radius: 9px; padding: 10px 12px; margin-bottom: 12px; display: grid; grid-template-columns: minmax(360px, 1fr) minmax(160px, 220px) auto minmax(220px, auto); align-items: end; gap: 10px; }
      .cdr-field label { display: block; font-size: 12px; color: #525252; margin: 0 0 5px; font-weight: 650; }
      .cdr-input { height: 36px; border: 1px solid #dcdfe4; border-radius: 8px; background: #fff; width: 100%; padding: 0 10px; color: #262626; outline: none; font-size: 13px; }
      .cdr-input:focus { border-color: #93c5fd; box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
      .cdr-detail-note { color: var(--cdr-muted); font-size: 11px; display: flex; align-items: center; gap: 5px; padding-bottom: 8px; justify-content: flex-end; }
      .cdr-table-shell { border: 1px solid var(--cdr-line); border-radius: 9px; overflow: hidden; }
      .cdr-table-scroll { overflow: auto; max-width: 100%; }
      .cdr-table { width: 100%; border-collapse: separate; border-spacing: 0; min-width: max(1320px, 100%); font-size: 12px; }
      .cdr-table thead th { position: sticky; top: 0; background: #f8fafc; color: #64748b; font-size: 11px; font-weight: 700; text-align: left; padding: 9px 10px; border-bottom: 1px solid var(--cdr-line); white-space: nowrap; z-index: 1; }
      .cdr-table tbody td { padding: 10px; border-bottom: 1px solid #edf0f3; vertical-align: top; color: #333; }
      .cdr-table tbody tr:hover { background: #f8fbff; }
      .cdr-table tbody tr:last-child td { border-bottom: 0; }
      .cdr-cell-main { font-weight: 650; color: #262626; }
      .cdr-cell-sub { font-size: 10px; color: var(--cdr-muted); margin-top: 3px; line-height: 1.4; }
      .cdr-link-text { color: var(--cdr-blue); font-weight: 650; }
      .cdr-nowrap { white-space: nowrap; }
      .cdr-num { text-align: right; font-variant-numeric: tabular-nums; }
      .cdr-pagination { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 12px; background: #fafafa; border-top: 1px solid var(--cdr-line); color: var(--cdr-muted); font-size: 11px; }
      .cdr-pager { display: flex; gap: 5px; flex-wrap: wrap; }
      .cdr-page-btn { height: 28px; min-width: 28px; border: 1px solid var(--cdr-line); border-radius: 6px; background: #fff; font-size: 11px; padding: 0 10px; }
      .cdr-page-btn:hover { background: #f8fafc; }
      .cdr-page-btn-active { background: var(--cdr-blue); border-color: var(--cdr-blue); color: #fff; }
      .cdr-empty { padding: 56px 20px; text-align: center; color: var(--cdr-muted); font-size: 13px; }
      .cdr-empty strong { display: block; color: #404040; margin-bottom: 5px; }
      .cdr-badge { display: inline-flex; align-items: center; height: 22px; border-radius: 999px; padding: 0 7px; font-size: 10px; font-weight: 650; border: 1px solid transparent; white-space: nowrap; }
      .cdr-badge-blue { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
      .cdr-badge-green { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
      .cdr-badge-amber { background: #fffbeb; color: #a16207; border-color: #fde68a; }
      .cdr-badge-red { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
      .cdr-badge-gray { background: #f3f4f6; color: #525252; border-color: #e5e7eb; }
      .cdr-badge-violet { background: #f5f3ff; color: #6d28d9; border-color: #ddd6fe; }
      .cdr-badge-cyan { background: #ecfeff; color: #0e7490; border-color: #a5f3fc; }
      .cdr-style-cell { display: flex; gap: 9px; min-width: 205px; align-items: center; }
      .cdr-thumb { width: 40px; height: 46px; border-radius: 8px; border: 1px solid var(--cdr-line); display: flex; align-items: center; justify-content: center; color: #fff; flex: 0 0 auto; overflow: hidden; position: relative; background: linear-gradient(135deg, #2563eb, #7c3aed); }
      .cdr-thumb:after { content: ""; position: absolute; inset: 6px 9px 4px; border-radius: 5px 5px 7px 7px; border: 2px solid rgba(255,255,255,.8); }
      .cdr-style-text { min-width: 0; }
      .cdr-style-text .cdr-cell-main, .cdr-style-text .cdr-cell-sub { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px; }
      @container (min-width: 1500px) {
        .cdr-metric-grid { grid-template-columns: repeat(var(--cdr-metric-cols, 4), minmax(0, 1fr)); }
        .cdr-detail-filter { grid-template-columns: minmax(520px, 1fr) minmax(200px, 260px) auto minmax(280px, auto); }
      }
      @media(max-width: 1280px) {
        .cdr-metric-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
        .cdr-flow { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
        .cdr-flow-node:after { display: none; }
      }
      @media(max-width: 900px) {
        .cdr-head { flex-direction: column; }
        .cdr-metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .cdr-detail-filter { grid-template-columns: 1fr; }
        .cdr-detail-note { justify-content: flex-start; padding-bottom: 0; }
      }
      @media(max-width: 640px) {
        .cdr-metric-grid, .cdr-flow { grid-template-columns: 1fr; }
      }
      @media print {
        .cdr-detail-filter, .cdr-tabs { display: none !important; }
        .cdr-page { max-width: none; }
        .cdr-panel, .cdr-metric-card { box-shadow: none; }
        .cdr-metric-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      }
    </style>
  `
}

function getSearchParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams()
  return new URLSearchParams(window.location.search)
}

function normalizeExecutionOwner(value: string | null): CuttingDailyExecutionOwner {
  if (value === 'OWN' || value === 'THIRD_PARTY' || value === 'UNASSIGNED' || value === 'CONFLICT') return value
  return 'ALL'
}

function normalizeTab(value: string | null): CuttingDailyTab {
  return cuttingDailyTabs.some((tab) => tab.key === value) ? value as CuttingDailyTab : 'overview'
}

function getQuery(params: URLSearchParams): CuttingDailyProductionReportQuery {
  return {
    reportDate: params.get('date') || CUTTING_DAILY_DEMO_REPORT_DATE,
    factoryId: params.get('factoryId') || 'F090',
    keyword: params.get('keyword') || '',
    executionOwner: normalizeExecutionOwner(params.get('executionOwner')),
    includeDemoData: params.get('includeDemoData') !== '0',
    timezone: params.get('timezone') || 'Asia/Jakarta',
  }
}

let cachedReport:
  | { key: string; report: CuttingDailyProductionReport }
  | null = null

function makeReportCacheKey(query: CuttingDailyProductionReportQuery): string {
  return [
    query.reportDate,
    query.factoryId,
    query.keyword,
    query.executionOwner,
    query.includeDemoData ? 'demo' : 'formal',
    query.timezone,
  ].join('\u0001')
}

function getCachedReport(query: CuttingDailyProductionReportQuery): CuttingDailyProductionReport {
  const key = makeReportCacheKey(query)
  if (cachedReport?.key === key) return cachedReport.report
  const report = buildCuttingDailyProductionReport(query)
  cachedReport = { key, report }
  return report
}

function getDetailFilters(params: URLSearchParams): DetailFilters {
  return {
    detailKeyword: params.get('detailKeyword') || '',
    detailStatus: params.get('detailStatus') || '',
    detailMetric: params.get('detailMetric') || '',
    page: Math.max(1, Number(params.get('page') || 1)),
    pageSize: Math.max(1, Number(params.get('pageSize') || 20)),
  }
}

function buildHref(params: Record<string, string | number | undefined | null>, resetPage = true): string {
  const search = getSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') search.delete(key)
    else search.set(key, String(value))
  })
  if (resetPage) search.set('page', '1')
  const query = search.toString()
  return `${PAGE_PATH}${query ? `?${query}` : ''}`
}

function formatNumber(value: number | null | undefined, maximumFractionDigits = 0): string {
  if (value === null || value === undefined) return '—'
  return Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits })
}

function getToneCss(tone: UiTone): { accent: string; soft: string } {
  return toneCssMap[tone] || toneCssMap.blue
}

function renderLocalBadge(label: string, tone: UiTone): string {
  return `<span class="cdr-badge cdr-badge-${tone}">${escapeHtml(label)}</span>`
}

function getAvailabilityTone(availability: CuttingDailyMetricAvailability): UiTone {
  if (availability === 'AVAILABLE') return 'green'
  if (availability === 'PARTIAL') return 'amber'
  if (availability === 'UNAVAILABLE') return 'red'
  return 'gray'
}

function renderAvailabilityBadge(availability: CuttingDailyMetricAvailability): string {
  return renderLocalBadge(availabilityLabelMap[availability], getAvailabilityTone(availability))
}

function getStatusTone(status: string): UiTone {
  if (/完成|确认|已接|已打印|正常|齐套|可计算/.test(status)) return 'green'
  if (/差异|拒|作废|异常|冲突|无法|缺/.test(status)) return 'red'
  if (/待|部分|未|调整|补/.test(status)) return 'amber'
  if (/三方|工艺|菲票|中转/.test(status)) return 'violet'
  return 'gray'
}

function renderIcon(name: string, className = 'h-4 w-4'): string {
  return `<i data-lucide="${escapeHtml(name)}" class="${escapeHtml(className)}"></i>`
}

function renderMetricCard(metric: CuttingDailyMetric, index = 0): string {
  const href = buildHref({
    tab: metric.tab,
    detailMetric: metric.key,
  })
  const tone = getAvailabilityTone(metric.availability)
  const visualTone = metric.availability === 'AVAILABLE'
    ? tabAccentMap[metric.tab]?.tone || tone
    : tone
  const visual = getToneCss(visualTone)
  const icon = tabAccentMap[metric.tab]?.icon || 'bar-chart-3'
  const miniItems = [
    [String(metric.recordCount), '记录数'],
    [metric.latestOccurredAt || '—', '最后记录'],
  ]
  return `
    <button
      type="button"
      data-nav="${escapeHtml(`${href}#daily-detail`)}"
      class="cdr-metric-card"
      style="--card-accent:${visual.accent};--card-soft:${visual.soft}"
      data-testid="${index === 0 ? 'cutting-daily-tab-stage-metrics' : ''}"
    >
      <div class="cdr-metric-head">
        <div class="cdr-metric-title">${escapeHtml(metric.label)}</div>
        <div class="cdr-metric-icon">${renderIcon(icon, 'h-4 w-4')}</div>
      </div>
      <div class="cdr-metric-primary">
        <strong>${escapeHtml(formatNumber(metric.value))}</strong>
        <span>${escapeHtml(metric.unit)}</span>
      </div>
      <div class="cdr-mini-metrics">
        ${miniItems.map(([value, label]) => `
          <div class="cdr-mini">
            <b>${escapeHtml(value)}</b>
            <span>${escapeHtml(label)}</span>
          </div>
        `).join('')}
      </div>
      <div class="cdr-metric-footer">
        ${renderAvailabilityBadge(metric.availability)}
        <span class="cdr-metric-link">查看明细 →</span>
      </div>
    </button>
  `
}

function renderOverviewMetricCard(groupTitle: string, metrics: CuttingDailyMetric[], index: number): string {
  const primaryMetric = metrics[0]
  const tab = primaryMetric?.tab || 'overview'
  const visual = getToneCss(tabAccentMap[tab]?.tone || 'blue')
  const icon = tabAccentMap[tab]?.icon || 'bar-chart-3'
  const miniItems = metrics.slice(1, 5).map((metric) => [
    formatNumber(metric.value),
    `${metric.label.replace(/^今日|^当前|^截至查询时点/, '')}${metric.unit ? ` · ${metric.unit}` : ''}`,
  ])
  while (miniItems.length < 4) miniItems.push(['—', '暂无补充指标'])
  return `
    <button
      type="button"
      data-nav="${escapeHtml(buildHref({ tab, detailMetric: undefined, detailStatus: undefined }))}"
      class="cdr-metric-card"
      style="--card-accent:${visual.accent};--card-soft:${visual.soft}"
      data-testid="${index === 0 ? 'cutting-daily-overview-metrics' : ''}"
    >
      <div class="cdr-metric-head">
        <div class="cdr-metric-title">${escapeHtml(groupTitle)}</div>
        <div class="cdr-metric-icon">${renderIcon(icon, 'h-4 w-4')}</div>
      </div>
      <div class="cdr-metric-primary">
        <strong>${escapeHtml(formatNumber(primaryMetric?.value ?? null))}</strong>
        <span>${escapeHtml(primaryMetric?.unit || '')}</span>
      </div>
      <div class="cdr-mini-metrics">
        ${miniItems.slice(0, 4).map(([value, label]) => `
          <div class="cdr-mini">
            <b>${escapeHtml(value)}</b>
            <span>${escapeHtml(label)}</span>
          </div>
        `).join('')}
      </div>
      <div class="cdr-metric-footer">
        <span>${escapeHtml(primaryMetric?.helperText || '当前页签统计')}</span>
        <span class="cdr-metric-link">进入页签 →</span>
      </div>
    </button>
  `
}

function getActiveMetrics(report: CuttingDailyProductionReport, activeTab: CuttingDailyTab): CuttingDailyMetric[] {
  return report.metricGroups.flatMap((group) => group.metrics).filter((metric) => metric.tab === activeTab)
}

function renderMetricGrid(report: CuttingDailyProductionReport, activeTab: CuttingDailyTab): string {
  if (activeTab === 'overview') {
    const cards = report.metricGroups.map((group, index) => renderOverviewMetricCard(group.title, group.metrics, index))
    return `
      <section
        class="cdr-metric-grid"
        style="--cdr-metric-cols:${Math.min(Math.max(cards.length, 1), 6)}"
        data-testid="cutting-daily-overview-metric-grid"
      >
        ${cards.join('')}
      </section>
    `
  }

  const metrics = getActiveMetrics(report, activeTab)
  if (!metrics.length) return ''
  return `
    <section
      class="cdr-metric-grid"
      style="--cdr-metric-cols:${Math.min(Math.max(metrics.length, 1), 6)}"
      aria-label="${escapeHtml(getCuttingDailyTabLabel(activeTab))}统计卡片"
    >
      ${metrics.map((metric, index) => renderMetricCard(metric, index)).join('')}
    </section>
  `
}

function renderTabs(activeTab: CuttingDailyTab, report: CuttingDailyProductionReport): string {
  return `
    <section class="cdr-tabs" data-testid="cutting-daily-tabs" aria-label="日报业务页签">
      ${cuttingDailyTabs.map((tab) => {
        const summary = report.tabSummary[tab.key]
        return `
          <button
            type="button"
            data-nav="${escapeHtml(buildHref({ tab: tab.key, detailKeyword: undefined, detailStatus: undefined, detailMetric: undefined }))}"
            class="cdr-tab ${activeTab === tab.key ? 'cdr-tab-active' : ''}"
          >
            ${escapeHtml(tab.label)}
            <span class="cdr-tab-count">${summary.count}</span>
          </button>
        `
      }).join('')}
    </section>
  `
}

function filterDetailRows(rows: CuttingDailyDetailRow[], filters: DetailFilters): CuttingDailyDetailRow[] {
  const keyword = filters.detailKeyword.trim().toLowerCase()
  const metricKey = filters.detailMetric.trim()
  return rows.filter((row) => {
    if (metricKey && !row.metricKeys.includes(metricKey)) return false
    if (keyword && !row.searchText.toLowerCase().includes(keyword)) return false
    if (filters.detailStatus && !row.status.includes(filters.detailStatus)) return false
    return true
  })
}

function paginateRows<T>(rows: T[], page: number, pageSize: number): { rows: T[]; page: number; pageSize: number; total: number; pageCount: number } {
  const safePageSize = Math.max(1, pageSize)
  const pageCount = Math.max(1, Math.ceil(rows.length / safePageSize))
  const safePage = Math.min(Math.max(1, page), pageCount)
  const start = (safePage - 1) * safePageSize
  return {
    rows: rows.slice(start, start + safePageSize),
    page: safePage,
    pageSize: safePageSize,
    total: rows.length,
    pageCount,
  }
}

function renderPagination(pagination: { total: number; page: number; pageSize: number; pageCount: number }): string {
  return `
    <div class="cdr-pagination">
      <div>共 ${pagination.total} 条，当前第 ${pagination.page} / ${pagination.pageCount} 页</div>
      <div class="cdr-pager">
        ${[20, 50, 100].map((size) => `<button type="button" data-nav="${escapeHtml(buildHref({ page: 1, pageSize: size }, false))}" class="cdr-page-btn ${pagination.pageSize === size ? 'cdr-page-btn-active' : ''}">${size} / 页</button>`).join('')}
        <button type="button" ${pagination.page <= 1 ? 'disabled' : ''} data-nav="${escapeHtml(buildHref({ page: pagination.page - 1, pageSize: pagination.pageSize }, false))}" class="cdr-page-btn disabled:cursor-not-allowed disabled:opacity-50">上一页</button>
        <button type="button" ${pagination.page >= pagination.pageCount ? 'disabled' : ''} data-nav="${escapeHtml(buildHref({ page: pagination.page + 1, pageSize: pagination.pageSize }, false))}" class="cdr-page-btn disabled:cursor-not-allowed disabled:opacity-50">下一页</button>
      </div>
    </div>
  `
}

function renderDetailSearch(activeTab: CuttingDailyTab, filters: DetailFilters): string {
  return `
    <div id="daily-detail" class="cdr-detail-filter" data-cutting-daily-detail-filter>
      ${Array.from(getSearchParams().entries())
        .filter(([key]) => !['detailKeyword', 'detailStatus', 'page'].includes(key))
        .map(([key, value]) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}" />`)
        .join('')}
      <input type="hidden" name="tab" value="${escapeHtml(activeTab)}" />
      <div class="cdr-field">
        <label>明细检索</label>
        <input name="detailKeyword" value="${escapeHtml(filters.detailKeyword)}" placeholder="在当前页签内搜索业务对象、生产单、状态、操作人" class="cdr-input" />
      </div>
      <div class="cdr-field">
        <label>状态</label>
        <input name="detailStatus" value="${escapeHtml(filters.detailStatus)}" placeholder="全部状态" class="cdr-input" />
      </div>
      <button
        type="button"
        class="cdr-btn"
        data-nav-from-fields="[data-cutting-daily-detail-filter]"
        data-nav-base="${PAGE_PATH}"
        data-nav-hash="daily-detail"
      >检索明细</button>
      <div class="cdr-detail-note">
        ${renderIcon('info', 'h-3.5 w-3.5')}
        ${filters.detailMetric ? `来自卡片下钻：${escapeHtml(filters.detailMetric)}` : '仅过滤当前表格，不改变统计卡片'}
      </div>
    </div>
  `
}

function renderDetailTable(rows: CuttingDailyDetailRow[], activeTab: CuttingDailyTab, filters: DetailFilters): string {
  const filteredRows = filterDetailRows(rows, filters)
  const pagination = paginateRows(filteredRows, filters.page, filters.pageSize)
  if (!filteredRows.length) {
    return `
      ${renderDetailSearch(activeTab, filters)}
      <section class="cdr-panel cdr-empty">
        <strong>暂无符合条件的明细</strong>
        当前页签在同一统计范围内暂无系统记录。
      </section>
    `
  }
  return `
    ${renderDetailSearch(activeTab, filters)}
    <section class="cdr-table-shell" data-testid="cutting-daily-detail-table">
      <div class="cdr-table-scroll">
        <table class="cdr-table">
          <thead>
            <tr>
              ${['业务对象', '业务单号', PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE, 'SPU', '摘要', '数量', '发生时间', '操作人', '状态', '数据来源', '操作'].map((head) => `<th>${escapeHtml(head)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${pagination.rows.map((row) => `
              <tr>
                <td><div class="cdr-cell-main">${escapeHtml(row.objectType)}</div></td>
                <td><span class="cdr-link-text">${escapeHtml(row.objectNo || '—')}</span></td>
                <td>${renderProductionOrderIdentityCell(row.productionOrderNo || '—')}</td>
                <td>${escapeHtml(row.spuCode || '—')}</td>
                <td>${escapeHtml(row.summary || '—')}</td>
                <td class="cdr-nowrap">${escapeHtml(row.quantityText || '—')}</td>
                <td class="cdr-nowrap">${escapeHtml(row.occurredAt || '—')}</td>
                <td>${escapeHtml(row.operator || '—')}</td>
                <td>${renderLocalBadge(row.status || '—', getStatusTone(row.status || ''))}</td>
                <td><span class="cdr-cell-sub">${escapeHtml(row.sourceName)}</span></td>
                <td>
                  <button type="button" data-nav="${escapeHtml(row.href)}" class="cdr-btn">查看来源</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${renderPagination(pagination)}
    </section>
  `
}

function renderContributionSnapshot(rows: CuttingDailyProductionContributionRow[]): string {
  if (!rows.length) {
    return '<section class="cdr-panel cdr-empty"><strong>暂无生产单贡献数据</strong>所选范围内暂无可汇总的生产单记录。</section>'
  }
  const topRows = rows.slice(0, 8)
  return `
    <section class="cdr-panel" data-testid="cutting-daily-contribution-snapshot">
      <div class="cdr-section-pad">
        <div class="cdr-section-heading">
        <div>
            <h2>生产单贡献与满足情况</h2>
            <p>按今日实裁裁片数量倒序，汇总生产单在裁床环节的当日活动和当前齐套状态</p>
          </div>
          ${renderLocalBadge(`前 ${topRows.length} 个生产单`, 'blue')}
        </div>
      </div>
      <div class="cdr-table-scroll">
        <table class="cdr-table" style="min-width: 1280px">
          <thead>
            <tr>
              ${['款式 / SPU', PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE, '生产计划', '今日实裁裁片', '当前已裁齐套', '当前未齐套', '今日交出', '最后发生时间', '操作'].map((head) => `<th>${escapeHtml(head)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${topRows.map((row) => `
              <tr>
                <td>
                  <div class="cdr-style-cell">
                    <div class="cdr-thumb"></div>
                    <div class="cdr-style-text">
                      <div class="cdr-cell-main">${escapeHtml(row.styleName)}</div>
                      <div class="cdr-cell-sub">${escapeHtml(row.spuCode)}</div>
                    </div>
                  </div>
                </td>
                <td>${renderProductionOrderIdentityCell(row.productionOrderNo)}<div class="cdr-cell-sub">${row.cutOrderCount} 张裁片单</div></td>
                <td class="cdr-num">${formatNumber(row.planQty)} 件</td>
                <td class="cdr-num"><div class="cdr-cell-main">${formatNumber(row.actualCutPieceQty)} 片</div><div class="cdr-cell-sub">等效 ${formatNumber(row.actualCutGarmentQty)} 件</div></td>
                <td class="cdr-num">${formatNumber(row.completeKitQty)} 件</td>
                <td class="cdr-num">${formatNumber(row.incompleteQty)} 件</td>
                <td class="cdr-num">${formatNumber(row.handedOverQty)} 片</td>
                <td class="cdr-nowrap">${escapeHtml(row.latestOccurredAt || '—')}</td>
                <td><button type="button" data-nav="${escapeHtml(buildHref({ tab: 'fulfillment', detailKeyword: row.productionOrderNo, detailStatus: undefined }))}" class="cdr-btn">查看</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderOverview(report: CuttingDailyProductionReport): string {
  const flowMetrics = report.metricGroups
    .map((group) => group.metrics[0])
    .filter((metric): metric is CuttingDailyMetric => Boolean(metric))
  return `
    <div class="cdr-tab-content space-y-3">
      <section class="cdr-panel">
        <div class="cdr-section-pad">
          <div class="cdr-section-heading">
            <div>
              <h2>今日关键路径</h2>
              <p>同一统计范围内，各环节已形成的系统记录</p>
            </div>
            ${renderLocalBadge('动态统计', 'blue')}
          </div>
          <div class="cdr-flow">
            ${flowMetrics.map((metric) => `
              <button type="button" data-nav="${escapeHtml(buildHref({ tab: metric.tab, detailMetric: metric.key }))}" class="cdr-flow-node">
                <span>${escapeHtml(getCuttingDailyTabLabel(metric.tab))}</span>
                <b>${escapeHtml(formatNumber(metric.value))}</b>
                <em>${escapeHtml(metric.unit)}</em>
              </button>
            `).join('')}
          </div>
          <div class="cdr-data-note">齐套、可交出等指标为当前累计状态；历史日期没有可靠快照时，不将当前库存伪装为所选日期的历史日末库存。</div>
        </div>
      </section>
      ${renderContributionSnapshot(report.productionContributions)}
    </div>
  `
}

function renderActiveTabContent(report: CuttingDailyProductionReport, activeTab: CuttingDailyTab, filters: DetailFilters): string {
  if (activeTab === 'overview') return renderOverview(report)
  return `
    <div class="cdr-panel cdr-tab-content">
      <div class="cdr-section-pad">
        <div class="cdr-section-heading">
          <div>
            <h2>${escapeHtml(getCuttingDailyTabLabel(activeTab))}明细</h2>
            <p>当前页签内检索只影响下方表格，不改变上方统计卡片口径</p>
          </div>
          ${renderLocalBadge(`${report.tabSummary[activeTab].count} 条记录`, 'gray')}
        </div>
      </div>
      ${renderDetailTable(report.detailRowsByTab[activeTab], activeTab, filters)}
    </div>
  `
}

function escapeExcelCell(value: string | number | null | undefined): string {
  return escapeHtml(value === null || value === undefined ? '' : String(value))
}

function renderExcelTable(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  return `
    <table>
      <thead><tr>${headers.map((header) => `<th>${escapeExcelCell(header)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeExcelCell(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  `
}

function buildCuttingDailyExcelHtml(query: CuttingDailyProductionReportQuery): string {
  const report = getCachedReport(query)
  const scopeRows = [
    ['报表名称', '裁床每日生产报表'],
    ['统计日期', report.query.reportDate],
    ['统计工厂', report.factoryName],
    ['工厂时区', report.query.timezone],
    ['生产单或款式筛选', report.query.keyword || '全部'],
    ['执行归属', getCuttingDailyExecutionOwnerLabel(report.query.executionOwner)],
    ['数据来源', report.query.includeDemoData ? '包含演示数据' : '正式数据'],
    ['统计窗口', `${report.windowStartAt} - ${report.windowEndAt}`],
    ['数据生成时间', report.generatedAt],
    ['动态报表说明', '本报表根据当前系统中已经形成的业务记录动态统计，历史数据可能因后续补录发生变化。'],
  ]
  const metricRows = report.metricGroups.flatMap((group) =>
    group.metrics.map((metric) => [
      group.title,
      metric.label,
      metric.value ?? '—',
      metric.unit,
      availabilityLabelMap[metric.availability],
      metric.recordCount,
      metric.helperText,
    ]),
  )
  const detailRows = Object.entries(report.detailRowsByTab)
    .filter(([tab]) => tab !== 'overview')
    .flatMap(([tab, rows]) => rows.map((row) => [
      getCuttingDailyTabLabel(tab as CuttingDailyTab),
      row.objectType,
      row.objectNo,
      row.productionOrderNo,
      row.spuCode,
      row.summary,
      row.quantityText,
      row.occurredAt,
      row.operator,
      row.status,
      row.sourceName,
    ]))
  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="UTF-8" /></head>
      <body>
        <h1>报表说明</h1>
        ${renderExcelTable(['项目', '内容'], scopeRows)}
        <br style="page-break-before:always" />
        <h1>总览</h1>
        ${renderExcelTable(['分组', '指标', '数值', '单位', '可用状态', '记录数', '口径说明'], metricRows)}
        <br style="page-break-before:always" />
        <h1>生产单贡献</h1>
        ${renderExcelTable(
          ['生产单', 'SPU', '款式名称', '计划数量', '裁片单数', '铺布单数', '实裁裁片', '等效成衣', '已裁齐套', '未齐套', '入仓', '交出', '最后发生时间'],
          report.productionContributions.map((row) => [
            row.productionOrderNo,
            row.spuCode,
            row.styleName,
            row.planQty,
            row.cutOrderCount,
            row.spreadingSessionCount,
            row.actualCutPieceQty,
            row.actualCutGarmentQty ?? '部分可计算',
            row.completeKitQty,
            row.incompleteQty,
            row.inboundQty,
            row.handedOverQty,
            row.latestOccurredAt,
          ]),
        )}
        <br style="page-break-before:always" />
        <h1>明细</h1>
        ${renderExcelTable(['页签', '业务对象', '业务单号', '生产单', 'SPU', '摘要', '数量', '发生时间', '操作人', '状态', '数据来源'], detailRows)}
        <br style="page-break-before:always" />
        <h1>数据记录情况</h1>
        ${renderExcelTable(
          ['环节', '状态', '记录数', '最后记录', '说明'],
          report.coverage.map((item) => [item.moduleName, item.status, item.recordCount, item.latestRecordedAt || '—', item.reason]),
        )}
      </body>
    </html>
  `
}

function renderPrintStyles(): string {
  return `
    <style>
      @media print {
        button, form, [data-no-print="true"] { display: none !important; }
        body { background: #fff !important; }
        table { page-break-inside: auto; }
        tr { page-break-inside: avoid; page-break-after: auto; }
      }
    </style>
  `
}

export function handleCraftCuttingDailyProductionReportEvent(target: HTMLElement): boolean {
  const actionTarget = target.closest<HTMLElement>('[data-cutting-daily-action]')
  const action = actionTarget?.dataset.cuttingDailyAction
  if (!action) return false
  if (typeof window === 'undefined' || typeof document === 'undefined') return true

  if (action === 'print') {
    window.print()
    return true
  }

  if (action === 'refresh') {
    window.location.reload()
    return true
  }

  if (action !== 'export-excel') return false

  const query = getQuery(getSearchParams())
  const excelHtml = buildCuttingDailyExcelHtml(query)
  const blob = new Blob([`\ufeff${excelHtml}`], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = `裁床每日生产报表_${query.factoryId}_${query.reportDate}_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '').slice(0, 14)}.xls`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(href)
  return true
}

export function renderCraftCuttingDailyProductionReportPage(): string {
  const params = getSearchParams()
  const query = getQuery(params)
  const activeTab = normalizeTab(params.get('tab'))
  const detailFilters = getDetailFilters(params)
  const report = getCachedReport(query)

  return `
    ${renderPrintStyles()}
    ${renderDailyReportStyles()}
    <div class="cdr-page" data-testid="cutting-daily-production-report-page">
      <header class="cdr-head">
        <div>
          <h1 class="cdr-title">裁床每日生产报表</h1>
        </div>
      </header>
      ${renderTabs(activeTab, report)}
      ${renderMetricGrid(report, activeTab)}
      ${renderActiveTabContent(report, activeTab, detailFilters)}
    </div>
  `
}
