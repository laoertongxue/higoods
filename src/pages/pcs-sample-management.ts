import { handlePcsSampleLabelInput, handlePcsSampleLabelAction } from './pcs-sample-label.ts'
import { getPcsSampleLabelIdentity } from '../data/pcs-sample-management.ts'
import { runPcsRecordCommand } from '../data/pcs-record-runtime.ts'
import { ensureLosLiveRoomState, liveRoomTransferGuards } from '../data/los-live-room-master.ts'
import { renderBadge } from '../components/ui/badge.ts'
import { renderButton } from '../components/ui/button.ts'
import { renderTable } from '../components/ui/table.ts'
import type { BadgeVariant, TableColumn, TableOptions } from '../components/ui/types.ts'
import {
  getPcsSampleById,
  getPcsSampleSource,
  getPcsSampleSourceReadError,
  listPcsSampleLedgerEvents,
  listPcsSampleLedgerEventsBySampleId,
  listPcsSampleRecords,
  listPcsSampleRequests,
  listPcsSampleRequestsBySampleId,
  listPcsSampleReturnCases,
  listPcsSampleStocktakeDiffs,
  listPcsSampleTransfers,
  listPcsSampleTypeConversionLogs,
  convertPcsSampleType,
  transferPcsSample,
  PCS_SAMPLE_STORAGE_KEY,
} from '../data/pcs-sample-management.ts'
import type {
  PcsSampleLedgerEvent,
  PcsSampleRecord,
  PcsSampleRequestStatus,
  PcsSampleReturnCase,
  PcsSampleReturnCaseStatus,
  PcsSampleStocktakeDiff,
  PcsSampleStocktakeDiffStatus,
  PcsSampleTransferRecord,
  PcsSampleUseRequest,
} from '../data/pcs-sample-management.ts'
import {
  PCS_SAMPLE_TYPES,
  PCS_SAMPLE_TYPE_LABELS,
  PCS_SAMPLE_LOCATION_TYPES,
  PCS_SAMPLE_LOCATION_TYPE_LABELS,
  listPcsSampleLocations,
  getPcsSampleLocationById,
} from '../data/pcs-sample-location-master.ts'
import type { PcsSampleType } from '../data/pcs-sample-location-master.ts'
import { escapeHtml, toClassName } from '../utils.ts'

type SampleViewMode = 'card' | 'table'

interface SampleManagementState {
  notice: string | null
  filters: {
    search: string
    status: string
    site: string
    requestStatus: string
    transferCategory: string
    locationType: string
    returnStatus: string
    ledgerType: string
    stocktakeStatus: string
  }
  selectedSampleId: string | null
  selectedRequestId: string | null
  selectedTransferId: string | null
  selectedReturnCaseId: string | null
  selectedLedgerEventId: string | null
  selectedStocktakeDiffId: string | null
  createRequestOpen: boolean
  flowOpen: boolean
  flowSampleId: string
  flowTarget: string
  flowReason: string
  conversionReason: string
  viewMode: SampleViewMode
}

const state: SampleManagementState = {
  notice: null,
  filters: {
    search: '',
    status: '全部',
    site: '全部',
    requestStatus: '全部',
    transferCategory: '全部',
    locationType: '全部',
    returnStatus: '全部',
    ledgerType: '全部',
    stocktakeStatus: '全部',
  },
  selectedSampleId: null,
  selectedRequestId: null,
  selectedTransferId: null,
  selectedReturnCaseId: null,
  selectedLedgerEventId: null,
  selectedStocktakeDiffId: null,
  createRequestOpen: false,
  flowOpen: false,
  flowSampleId: '',
  flowTarget: '',
  flowReason: '',
  conversionReason: '',
  viewMode: 'card',
}

const SAMPLE_STATUS_TONE: Record<string, BadgeVariant> = {
  在库可用: 'success',
  预占锁定: 'warning',
  借出占用: 'info',
  在途待签收: 'info',
  维修中: 'warning',
  待处置: 'danger',
  已退货: 'neutral',
  已处置: 'neutral',
}

const REQUEST_STATUS_TONE: Record<PcsSampleRequestStatus, BadgeVariant> = {
  草稿: 'neutral',
  待审批: 'warning',
  已批准待领用: 'info',
  使用中: 'success',
  归还中: 'warning',
  已完成: 'success',
  已驳回: 'danger',
  已取消: 'neutral',
}

const RETURN_STATUS_TONE: Record<PcsSampleReturnCaseStatus, BadgeVariant> = {
  待审批: 'warning',
  待执行: 'info',
  执行中: 'warning',
  已结案: 'success',
  已驳回: 'danger',
}

const STOCKTAKE_STATUS_TONE: Record<PcsSampleStocktakeDiffStatus, BadgeVariant> = {
  待确认: 'warning',
  处理中: 'info',
  已调整: 'success',
  已关闭: 'neutral',
}

/** Preserve readable business columns; the table component supplies horizontal scrolling. */
function renderSampleTableSurface<T>(columns: TableColumn<T>[], rows: T[], options: TableOptions): string {
  return renderTable(columns.map((column) => ({
    ...column,
    minWidth: column.minWidth || column.width,
    className: toClassName(column.className, column.width ? 'whitespace-nowrap' : ''),
  })), rows, options)
}

function sampleSourceText(record: { projectCode: string; projectName?: string; source?: PcsSampleRecord['source'] }): string {
  const source = getPcsSampleSource(record)
  return `${source.note} · ${source.code}${source.name ? ` · ${source.name}` : ''}`
}

function matchesKeyword(values: unknown[], keyword: string): boolean {
  if (!keyword) return true
  const normalized = keyword.trim().toLowerCase()
  return values.some((value) => String(value || '').toLowerCase().includes(normalized))
}

function renderNotice(): string {
  const notice = [state.notice, getPcsSampleSourceReadError()].filter(Boolean).join('；')
  if (!notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
      <div class="flex items-start justify-between gap-3">
        <p>${escapeHtml(notice)}</p>
        <button type="button" class="inline-flex h-7 items-center rounded-md px-2 text-xs hover:bg-blue-100" data-pcs-sample-action="close-notice">关闭</button>
      </div>
    </section>
  `
}

function renderTextInput(field: string, value: string, placeholder: string, className = ''): string {
  return `
    <input
      type="search"
      value="${escapeHtml(value)}"
      placeholder="${escapeHtml(placeholder)}"
      class="${toClassName('h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100', className)}"
      data-pcs-sample-field="${escapeHtml(field)}"
    />
  `
}

function renderSelect(field: string, value: string, options: string[], className = ''): string {
  return `
    <select
      class="${toClassName('h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100', className)}"
      data-pcs-sample-field="${escapeHtml(field)}"
    >
      ${options.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
    </select>
  `
}

function renderStatusBadge(status: string): string {
  return renderBadge(status, SAMPLE_STATUS_TONE[status] || 'neutral')
}

function renderAvailabilityBadge(availability: string): string {
  if (availability === '可申请') return renderBadge(availability, 'success', 'check-circle-2')
  if (availability === '需审批') return renderBadge(availability, 'warning', 'shield-alert')
  return renderBadge(availability, 'neutral')
}

function renderRiskBadge(text: string): string {
  if (!text) return '<span class="text-xs text-slate-400">无</span>'
  return renderBadge(text, text.includes('高') || text.includes('超时') ? 'danger' : 'warning', 'alert-triangle')
}

function renderPageShell(title: string, description: string, body: string, actions = ''): string {
  return `
    <div class="space-y-4 p-6" data-pcs-sample-page-root="true">
      ${renderNotice()}
      <section class="rounded-xl border bg-white px-4 py-4 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-xs text-slate-500">商品中心系统 / 样衣管理</p>
            <h1 class="mt-1 text-2xl font-semibold text-slate-900">${escapeHtml(title)}</h1>
            <p class="mt-1 text-sm text-slate-500">${escapeHtml(description)}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            ${renderButton({
              label: '刷新',
              icon: 'refresh-cw',
              variant: 'secondary',
              action: { prefix: 'pcsSample', action: 'mock-action' },
              className: 'border-slate-200 bg-white text-slate-700',
            }).replace('data-pcs-sample-action="mock-action"', 'data-pcs-sample-action="mock-action" data-message="已刷新样衣管理演示数据"')}
            ${actions}
          </div>
        </div>
      </section>
      ${body}
    </div>
  `
}

function getSampleStats(samples = listPcsSampleRecords()) {
  return {
    total: samples.length,
    available: samples.filter((item) => item.status === '在库可用').length,
    occupied: samples.filter((item) => item.occupancyType !== '无').length,
    transit: samples.filter((item) => item.status === '在途待签收').length,
    risks: samples.filter((item) => item.anomaly).length,
  }
}

function renderMetricCards(metrics: Array<{ label: string; value: string | number; tone: string; action?: string; status?: string }>): string {
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      ${metrics.map((item) => `
        <button
          type="button"
          class="rounded-xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow"
          ${item.action ? `data-pcs-sample-action="${escapeHtml(item.action)}"` : ''}
          ${item.status ? `data-status="${escapeHtml(item.status)}"` : ''}
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm text-slate-500">${escapeHtml(item.label)}</p>
              <p class="mt-2 text-2xl font-semibold ${escapeHtml(item.tone)}">${escapeHtml(item.value)}</p>
            </div>
            <i data-lucide="bar-chart-3" class="h-5 w-5 text-slate-300"></i>
          </div>
        </button>
      `).join('')}
    </section>
  `
}

function getFilteredSamples(): PcsSampleRecord[] {
  const { search, status, site } = state.filters
  return listPcsSampleRecords().filter((sample) => {
    if (status !== '全部' && sample.status !== status) return false
    if (site !== '全部' && sample.responsibleSite !== site) return false
    if (state.filters.locationType !== '全部' && PCS_SAMPLE_LOCATION_TYPE_LABELS[getPcsSampleLocationById(sample.currentLocationId || '')?.locationType!] !== state.filters.locationType) return false
    return matchesKeyword(
      [
        sample.sampleCode,
        getPcsSampleLabelIdentity(sample.skuCode)?.hgCode,
        sample.name,
        sampleSourceText(sample),
        sample.projectName,
        sample.sourceStepName,
        sample.currentLocation,
        sample.transit?.trackingNo,
      ],
      search,
    )
  })
}

function renderSampleCell(sample: PcsSampleRecord): string {
  return `
    <div class="flex min-w-[240px] items-center gap-3">
      <button type="button" class="shrink-0 cursor-zoom-in overflow-hidden rounded-lg border" data-pda-image-preview-url="${escapeHtml(sample.imageUrl)}" data-pda-image-preview-title="${escapeHtml(`${sample.sampleCode} ${sample.name}`)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(sample.name)}大图">
        <img src="${escapeHtml(sample.imageUrl)}" alt="${escapeHtml(sample.name)}" class="h-14 w-14 object-cover" />
      </button>
      <div>
        <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/samples/detail/${escapeHtml(sample.sampleId)}">${escapeHtml(getPcsSampleLabelIdentity(sample.skuCode)?.hgCode || '编号待生成')}</button><p class="mt-1 break-all text-xs text-slate-500">${escapeHtml(sample.skuCode)}</p>
        <p class="mt-1 text-sm text-slate-700">${escapeHtml(sample.name)}</p>
        <div class="mt-1 flex flex-wrap gap-1 text-xs text-slate-500">
          <span>${escapeHtml(sample.category)}</span><span>·</span><span>${escapeHtml(sample.size)}</span><span>·</span><span>${escapeHtml(sample.color)}</span>
        </div>
      </div>
    </div>
  `
}

function renderSampleTable(samples: PcsSampleRecord[]): string {
  const columns: TableColumn<PcsSampleRecord>[] = [
    { key: 'sampleCode', title: '样衣编号/名称', minWidth: '260px', render: renderSampleCell },
    { key: 'sampleType', title: '样品类型', width: '110px', render: sample => escapeHtml(PCS_SAMPLE_TYPE_LABELS[sample.sampleType]) },
    {
      key: 'projectCode',
      title: '关联来源 / 用途',
      minWidth: '220px',
      render: (sample) => `
        <div>
          <div class="font-medium text-slate-900">${escapeHtml(sampleSourceText(sample))}</div>
          <p class="mt-1 text-sm text-slate-500">${escapeHtml(sample.projectName)}</p>
          <p class="mt-1 text-xs text-slate-400">${escapeHtml(sample.sourceStepName)}</p>
        </div>
      `,
    },
    { key: 'status', title: '库存状态', width: '120px', render: (sample) => renderStatusBadge(sample.status) },
    { key: 'availability', title: '可用性', width: '110px', render: (sample) => renderAvailabilityBadge(sample.availability) },
    {
      key: 'currentLocation',
      title: '当前位置',
      minWidth: '180px',
      render: (sample) => `
        <div class="text-sm text-slate-900">${escapeHtml(sample.currentLocation)}</div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml(sample.locationDetail)}</div>
      `,
    },
    {
      key: 'occupiedBy',
      title: '占用/预占',
      minWidth: '180px',
      render: (sample) => sample.occupancyType === '无'
        ? '<span class="text-sm text-slate-400">无占用</span>'
        : `
          <div class="text-sm font-medium text-slate-900">${escapeHtml(sample.occupiedBy)}</div>
          <div class="mt-1 text-xs text-slate-500">${escapeHtml(sample.occupiedFor)} · 至 ${escapeHtml(sample.occupiedUntil)}</div>
        `,
    },
    {
      key: 'transit',
      title: '运单/ETA',
      minWidth: '180px',
      render: (sample) => sample.transit
        ? `
          <div class="text-sm font-medium text-slate-900">${escapeHtml(sample.transit.trackingNo)}</div>
          <div class="mt-1 text-xs text-slate-500">${escapeHtml(sample.transit.carrier)} · ETA ${escapeHtml(sample.transit.eta)}</div>
        `
        : '<span class="text-sm text-slate-400">无在途</span>',
    },
    {
      key: 'anomaly',
      title: '风险',
      width: '120px',
      render: (sample) => sample.anomaly ? renderRiskBadge(sample.anomaly.type) : '<span class="text-sm text-slate-400">无</span>',
    },
    {
      key: 'sampleId',
      title: '操作',
      width: '220px',
      align: 'right',
      render: (sample) => `
        <div class="flex justify-end gap-2">
          <a class="inline-flex h-8 items-center rounded-md border px-3 text-xs text-blue-700" href="/pcs/samples/label/${encodeURIComponent(sample.sampleId)}" data-nav="/pcs/samples/label/${encodeURIComponent(sample.sampleId)}">打印标签</a>
          <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-sample-action="select-sample" data-pcs-sample-id="${escapeHtml(sample.sampleId)}">快照</button>
          <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-nav="/pcs/samples/ledger">台账</button>
        </div>
      `,
    },
  ]

  return renderSampleTableSurface(columns, samples, {
    emptyText: '暂无符合条件的样衣库存',
    hoverable: true,
    rowAction: { prefix: 'pcsSample', action: 'select-sample', dataKey: 'sampleId' },
  })
}

function renderInventoryFilters(): string {
  return `
    <section class="rounded-xl border bg-white px-4 py-4 shadow-sm">
      <div class="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_180px_auto]">
        ${renderTextInput('search', state.filters.search, '搜索样衣编号/名称/关联来源/用途 / 原始环节/运单号')}
        ${renderSelect('status', state.filters.status, ['全部', '在库可用', '预占锁定', '借出占用', '在途待签收', '维修中', '待处置', '已退货'])}
        ${renderSelect('site', state.filters.site, ['全部', '深圳样衣间', '雅加达样衣间'])}
        ${renderSelect('location-type', state.filters.locationType, ['全部', ...Object.values(PCS_SAMPLE_LOCATION_TYPE_LABELS)])}
        <button type="button" class="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-action="reset-filters">重置</button>
      </div>
    </section>
  `
}

function renderSampleDetailDrawer(): string {
  const sample = state.selectedSampleId ? getPcsSampleById(state.selectedSampleId) : null
  if (!sample) return ''
  const ledgerEvents = listPcsSampleLedgerEventsBySampleId(sample.sampleId)
  const requests = listPcsSampleRequestsBySampleId(sample.sampleId)
  return `
    <div class="fixed inset-0 z-50" data-testid="pcs-sample-detail-drawer">
      <button type="button" class="absolute inset-0 bg-slate-900/40" data-pcs-sample-action="close-drawers" aria-label="关闭样衣详情"></button>
      <aside class="absolute right-0 top-0 flex h-full w-full max-w-3xl flex-col overflow-y-auto bg-white shadow-xl">
        <header class="sticky top-0 z-10 border-b bg-white px-5 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs text-slate-500">样衣详情快照</p>
              <h2 class="mt-1 text-xl font-semibold text-slate-900">${escapeHtml(sample.sampleCode)} · ${escapeHtml(sample.name)}</h2>
              <div class="mt-2 flex flex-wrap gap-2">${renderStatusBadge(sample.status)}${renderAvailabilityBadge(sample.availability)}${sample.anomaly ? renderRiskBadge(sample.anomaly.type) : ''}</div>
            </div>
            <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-action="close-drawers">关闭</button>
          </div>
        </header>
        <div class="space-y-4 px-5 py-5">
          <section class="grid gap-4 lg:grid-cols-[180px,1fr]">
            <button type="button" class="cursor-zoom-in overflow-hidden rounded-xl border" data-pda-image-preview-url="${escapeHtml(sample.imageUrl)}" data-pda-image-preview-title="${escapeHtml(`${sample.sampleCode} ${sample.name}`)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(sample.name)}大图">
              <img src="${escapeHtml(sample.imageUrl)}" alt="${escapeHtml(sample.name)}" class="h-56 w-full object-cover lg:h-full" />
            </button>
            <div class="grid gap-3 sm:grid-cols-2">
              ${renderInfoItem('品类/尺码/颜色', `${sample.category} · ${sample.size} · ${sample.color}`)}
              ${renderInfoItem('面料/模板', `${sample.material} · ${sample.templateType}`)}
              ${renderInfoItem('样品类型', PCS_SAMPLE_TYPE_LABELS[sample.sampleType])}
              ${renderInfoItem('贴码记录', sample.taggedAt ? `${getPcsSampleLabelIdentity(sample.skuCode)?.hgCode || 'HG 编号待生成'} · SKU ${sample.skuCode} · ${sample.taggedAt}` : '未贴码')}
              ${renderInfoItem('责任站点', sample.responsibleSite)}
              ${renderInfoItem('当前位置', `${sample.currentLocation} · ${sample.locationDetail}`)}
              ${renderInfoItem('关联来源', sampleSourceText(sample))}
              ${renderInfoItem('用途 / 原始环节', sample.sourceStepName)}
              ${renderInfoItem('占用信息', sample.occupancyType === '无' ? '无占用' : `${sample.occupiedBy} · ${sample.occupiedFor} · 至 ${sample.occupiedUntil}`)}
              ${renderInfoItem('最近更新', `${sample.updatedAt} · ${sample.updatedBy}`)}
            </div>
          </section>
          ${sample.transit ? `
            <section class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
              <h3 class="text-sm font-semibold text-blue-900">在途信息</h3>
              <div class="mt-2 grid gap-2 text-sm text-blue-800 sm:grid-cols-2">
                <div>路线：${escapeHtml(sample.transit.from)} → ${escapeHtml(sample.transit.to)}</div>
                <div>运单：${escapeHtml(sample.transit.carrier)} ${escapeHtml(sample.transit.trackingNo)}</div>
                <div>ETA：${escapeHtml(sample.transit.eta)}</div>
                <div>SLA：${escapeHtml(sample.transit.transitSlaHours)} 小时</div>
              </div>
            </section>
          ` : ''}
          ${sample.anomaly ? `
            <section class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <h3 class="text-sm font-semibold text-rose-900">异常/风险</h3>
              <p class="mt-2 text-sm text-rose-700">${escapeHtml(sample.anomaly.level)}级 · ${escapeHtml(sample.anomaly.type)} · ${escapeHtml(sample.anomaly.note)}</p>
            </section>
          ` : ''}
          <section class="grid gap-4 lg:grid-cols-2">
            ${renderMiniList('关联申请', requests.map((item) => `${item.requestCode} · ${item.status} · ${item.purpose}`), '暂无关联申请')}
            ${renderMiniList('最近台账事件', ledgerEvents.map((item) => `${item.time} · ${item.eventType} · ${item.summary}`), '暂无台账事件')}
          </section>
          <section class="flex flex-wrap gap-2">
            ${PCS_SAMPLE_TYPES.filter((type) => type !== sample.sampleType)
              .map(
                (type) =>
                  `<button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-action="convert-type" data-sample-id="${escapeHtml(sample.sampleId)}" data-to-type="${type}">转为${escapeHtml(PCS_SAMPLE_TYPE_LABELS[type])}</button>`,
              )
              .join('')}
            <button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-nav="/pcs/samples/detail/${escapeHtml(sample.sampleId)}">打开完整详情</button>
            <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-action="mock-action" data-message="已模拟标记 ${escapeHtml(sample.sampleCode)} 的库存动作">模拟库存动作</button>
            <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/samples/ledger">查看完整台账</button>
          </section>
        </div>
      </aside>
    </div>
  `
}

function renderInfoItem(label: string, value: string): string {
  return `
    <div class="rounded-lg border bg-slate-50 px-3 py-2">
      <p class="text-xs text-slate-500">${escapeHtml(label)}</p>
      <p class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(value || '-')}</p>
    </div>
  `
}

function renderMiniList(title: string, lines: string[], emptyText: string): string {
  return `
    <section class="rounded-xl border bg-white px-4 py-4">
      <h3 class="text-sm font-semibold text-slate-900">${escapeHtml(title)}</h3>
      <div class="mt-3 space-y-2">
        ${lines.length > 0
          ? lines.map((line) => `<div class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">${escapeHtml(line)}</div>`).join('')
          : `<div class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-400">${escapeHtml(emptyText)}</div>`}
      </div>
    </section>
  `
}

export function renderPcsSampleInventoryPage(): string {
  const stats = getSampleStats()
  const samples = getFilteredSamples()
  const body = `
    ${renderMetricCards([
      { label: '全部样衣', value: stats.total, tone: 'text-slate-900', action: 'quick-filter-status', status: '全部' },
      { label: '在库可用', value: stats.available, tone: 'text-emerald-600', action: 'quick-filter-status', status: '在库可用' },
      { label: '预占/借出', value: stats.occupied, tone: 'text-blue-600' },
      { label: '在途待签收', value: stats.transit, tone: 'text-indigo-600', action: 'quick-filter-status', status: '在途待签收' },
      { label: '异常风险', value: stats.risks, tone: 'text-rose-600' },
    ])}
    ${renderInventoryFilters()}
    <section class="rounded-xl border bg-white shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 class="text-base font-semibold text-slate-900">库存清单</h2>
          <p class="mt-1 text-sm text-slate-500">共 ${escapeHtml(samples.length)} 条，展示样衣状态、占用、在途和异常信息。</p>
        </div>
        <div class="flex gap-2">
          <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/samples/application">发起使用申请</button>
          <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/samples/transfer">查看流转</button>
        </div>
      </div>
      ${renderSampleTable(samples)}
    </section>
    ${renderSampleDetailDrawer()}
  `
  return renderPageShell('样衣库存', '管理样衣资产状态、站点位置、占用预占、在途签收和异常风险。', body)
}

function renderRequestTable(requests: PcsSampleUseRequest[]): string {
  const columns: TableColumn<PcsSampleUseRequest>[] = [
    { key: 'requestCode', title: '申请单号', width: '150px', render: (request) => `<button type="button" class="font-medium text-blue-700 hover:underline" data-pcs-sample-action="select-request" data-request-id="${escapeHtml(request.requestId)}">${escapeHtml(request.requestCode)}</button>` },
    { key: 'status', title: '状态', width: '130px', render: (request) => renderBadge(request.status, REQUEST_STATUS_TONE[request.status]) },
    { key: 'responsibleSite', title: '责任站点', width: '120px' },
    { key: 'sampleIds', title: '样衣数量', width: '90px', render: (request) => `<span class="font-medium">${escapeHtml(request.sampleIds.length)}</span>` },
    { key: 'expectedReturnAt', title: '预计归还', width: '150px' },
    { key: 'projectName', title: '关联来源 / 用途', minWidth: '220px', render: (request) => `<div><div class="font-medium text-slate-900">${escapeHtml(sampleSourceText(request))}</div><div class="mt-1 text-sm text-slate-500">${escapeHtml(request.sourceStepName)}</div></div>` },
    { key: 'applicant', title: '申请人', width: '100px' },
    { key: 'keeper', title: '审批/仓管', width: '120px', render: (request) => `${escapeHtml(request.approver || '-')} / ${escapeHtml(request.keeper || '-')}` },
    { key: 'updatedAt', title: '更新时间', width: '150px' },
    { key: 'requestId', title: '操作', width: '120px', align: 'right', render: (request) => `<button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-sample-action="select-request" data-request-id="${escapeHtml(request.requestId)}">查看</button>` },
  ]
  return renderSampleTableSurface(columns, requests, { emptyText: '暂无样衣使用申请', hoverable: true })
}

function renderRequestDrawer(): string {
  const request = state.selectedRequestId ? listPcsSampleRequests().find((item) => item.requestId === state.selectedRequestId) : null
  if (!request) return ''
  const samples = request.sampleIds.map((sampleId) => getPcsSampleById(sampleId)).filter((item): item is PcsSampleRecord => Boolean(item))
  return `
    <div class="fixed inset-0 z-50">
      <button type="button" class="absolute inset-0 bg-slate-900/40" data-pcs-sample-action="close-drawers" aria-label="关闭申请详情"></button>
      <aside class="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-white shadow-xl">
        <header class="border-b px-5 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex flex-wrap items-center gap-2">${renderBadge(request.status, REQUEST_STATUS_TONE[request.status])}${renderBadge(request.responsibleSite, 'outline')}</div>
              <h2 class="mt-2 text-xl font-semibold text-slate-900">${escapeHtml(request.requestCode)}</h2>
              <p class="mt-1 text-sm text-slate-500">${escapeHtml(request.purpose)}</p>
            </div>
            <button type="button" class="inline-flex h-9 items-center rounded-md border px-3 text-sm" data-pcs-sample-action="close-drawers">关闭</button>
          </div>
        </header>
        <div class="space-y-4 px-5 py-5">
          <section class="grid gap-3 sm:grid-cols-2">
            ${renderInfoItem('关联来源', sampleSourceText(request))}
            ${renderInfoItem('用途 / 原始环节', request.sourceStepName)}
            ${renderInfoItem('申请人', request.applicant)}
            ${renderInfoItem('审批人/仓管', `${request.approver || '-'} / ${request.keeper || '-'}`)}
            ${renderInfoItem('预计归还', request.expectedReturnAt)}
            ${renderInfoItem('更新时间', request.updatedAt)}
          </section>
          ${renderMiniList('样衣清单', samples.map((sample) => `${sample.sampleCode} · ${sample.name} · ${sample.status}`), '暂无样衣')}
          ${renderMiniList('处理记录', request.timeline.map((item) => `${item.time} · ${item.action} · ${item.operator}${item.remark ? ` · ${item.remark}` : ''}`), '暂无记录')}
          <div class="flex flex-wrap gap-2">
            <button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-sample-action="mock-action" data-message="已模拟推进 ${escapeHtml(request.requestCode)} 的申请流程">推进流程</button>
            <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/samples/ledger">查看台账回写</button>
          </div>
        </div>
      </aside>
    </div>
  `
}

function renderCreateRequestDrawer(): string {
  if (!state.createRequestOpen) return ''
  const availableSamples = listPcsSampleRecords().filter((sample) => sample.availability !== '不可申请').slice(0, 5)
  return `
    <div class="fixed inset-0 z-50">
      <button type="button" class="absolute inset-0 bg-slate-900/40" data-pcs-sample-action="close-drawers" aria-label="关闭新建申请"></button>
      <aside class="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-white shadow-xl">
        <header class="border-b px-5 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs text-slate-500">样衣使用申请</p>
              <h2 class="mt-1 text-xl font-semibold text-slate-900">新建申请</h2>
              <p class="mt-1 text-sm text-slate-500">演示预占校验、同站点规则、预计归还时间和样衣清单。</p>
            </div>
            <button type="button" class="inline-flex h-9 items-center rounded-md border px-3 text-sm" data-pcs-sample-action="close-drawers">关闭</button>
          </div>
        </header>
        <div class="space-y-4 px-5 py-5">
          <section class="grid gap-3 sm:grid-cols-2">
            ${renderInfoItem('申请用途', '直播拍摄 / 达人试穿 / 工程评审')}
            ${renderInfoItem('校验规则', '所选样衣必须同责任站点，且不可处于不可申请状态。')}
            ${renderInfoItem('预计归还', '默认需要填写到小时，超期会进入风险提醒。')}
            ${renderInfoItem('台账回写', '提交后预占，确认领用后出库，归还后入库。')}
          </section>
          ${renderMiniList('可选样衣', availableSamples.map((sample) => `${sample.sampleCode} · ${sample.name} · ${sample.responsibleSite} · ${sample.availability}`), '暂无可选样衣')}
          <div class="flex flex-wrap gap-2">
            <button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-sample-action="submit-create-request">保存为草稿</button>
            <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-action="close-drawers">取消</button>
          </div>
        </div>
      </aside>
    </div>
  `
}

export function renderPcsSampleApplicationPage(): string {
  const requests = listPcsSampleRequests().filter((request) => {
    if (state.filters.requestStatus !== '全部' && request.status !== state.filters.requestStatus) return false
    return matchesKeyword([request.requestCode, request.projectCode, request.projectName, request.sourceStepName, request.applicant], state.filters.search)
  })
  const stats = {
    total: listPcsSampleRequests().length,
    pending: listPcsSampleRequests().filter((item) => item.status === '待审批').length,
    active: listPcsSampleRequests().filter((item) => item.status === '使用中').length,
    returning: listPcsSampleRequests().filter((item) => item.status === '归还中').length,
  }
  const body = `
    ${renderMetricCards([
      { label: '全部申请', value: stats.total, tone: 'text-slate-900' },
      { label: '待审批', value: stats.pending, tone: 'text-amber-600' },
      { label: '使用中', value: stats.active, tone: 'text-emerald-600' },
      { label: '归还中', value: stats.returning, tone: 'text-purple-600' },
      { label: '超期未归还', value: 1, tone: 'text-rose-600' },
    ])}
    <section class="rounded-xl border bg-white px-4 py-4 shadow-sm">
      <div class="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_auto]">
        ${renderTextInput('search', state.filters.search, '申请单号/样衣编号/关联来源/用途 / 原始环节/申请人')}
        ${renderSelect('request-status', state.filters.requestStatus, ['全部', '草稿', '待审批', '已批准待领用', '使用中', '归还中', '已完成', '已驳回', '已取消'])}
        <button type="button" class="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-sample-action="open-create-request">新建申请</button>
      </div>
    </section>
    <section class="rounded-xl border bg-white shadow-sm">
      <div class="border-b px-4 py-3">
        <h2 class="text-base font-semibold text-slate-900">申请单列表</h2>
        <p class="mt-1 text-sm text-slate-500">驱动预占、确认领用、发起归还、确认归还入库等台账事件。</p>
      </div>
      ${renderRequestTable(requests)}
    </section>
    ${renderRequestDrawer()}
    ${renderCreateRequestDrawer()}
  `
  return renderPageShell('样衣使用申请', '管理借用申请流程，串联预占锁定、领用出库、归还入库。', body)
}

function renderTransferTable(records: PcsSampleTransferRecord[]): string {
  const columns: TableColumn<PcsSampleTransferRecord>[] = [
    { key: 'time', title: '时间', width: '150px' },
    { key: 'sampleCode', title: '样衣', minWidth: '220px', render: (record) => `<button type="button" class="font-medium text-blue-700 hover:underline" data-pcs-sample-action="select-transfer" data-transfer-id="${escapeHtml(record.transferId)}">${escapeHtml(record.sampleCode)}</button><p class="mt-1 text-sm text-slate-500">${escapeHtml(record.sampleName)}</p>` },
    { key: 'transferCategory', title: '流转类型', width: '110px', render: (record) => renderBadge(record.transferCategory, 'outline') },
    { key: 'eventType', title: '事件类型', width: '100px', render: (record) => renderBadge(record.eventType, record.eventType === '签收' ? 'success' : 'info') },
    { key: 'fromEntity', title: '起点 → 终点', minWidth: '220px', render: (record) => `<span>${escapeHtml(record.fromEntity)}</span><span class="px-2 text-slate-400">→</span><span>${escapeHtml(record.toEntity)}</span>` },
    { key: 'responsibleSite', title: '责任站点', width: '120px' },
    { key: 'trackingNo', title: '运单', width: '150px', render: (record) => record.trackingNo ? `${escapeHtml(record.carrier)}<br><span class="text-xs text-slate-500">${escapeHtml(record.trackingNo)}</span>` : '<span class="text-slate-400">无</span>' },
    { key: 'projectCode', title: '关联来源', minWidth: '220px', render: (record) => escapeHtml(sampleSourceText(record)) },
    { key: 'operator', title: '经办人', width: '90px' },
    { key: 'riskFlags', title: '风险', width: '120px', render: (record) => record.riskFlags.length ? record.riskFlags.map(renderRiskBadge).join('') : '<span class="text-sm text-slate-400">无</span>' },
    { key: 'transferId', title: '操作', width: '90px', align: 'right', render: (record) => `<button type="button" class="inline-flex h-8 items-center rounded-md border px-3 text-xs" data-pcs-sample-action="select-transfer" data-transfer-id="${escapeHtml(record.transferId)}">查看</button>` },
  ]
  return renderSampleTableSurface(columns, records, { emptyText: '暂无样衣流转记录', hoverable: true })
}

function renderTransferDrawer(): string {
  const record = state.selectedTransferId ? listPcsSampleTransfers().find((item) => item.transferId === state.selectedTransferId) : null
  if (!record) return ''
  return renderGenericDrawer(
    '流转记录详情',
    `${record.transferCategory} · ${record.eventType} · ${record.sampleCode}`,
    [
      ['样衣', `${record.sampleCode} · ${record.sampleName}`],
      ['时间', record.time],
      ['路线', `${record.fromEntity} → ${record.toEntity}`],
      ['责任站点', record.responsibleSite],
      ['运单', record.trackingNo ? `${record.carrier} ${record.trackingNo}` : '无'],
      ['经办人', record.operator],
      ['关联来源', sampleSourceText(record)],
      ['备注', record.remark],
    ],
    record.riskFlags,
  )
}

export function renderPcsSampleTransferPage(): string {
  const records = listPcsSampleTransfers().filter((record) => {
    if (state.filters.transferCategory !== '全部' && record.transferCategory !== state.filters.transferCategory) return false
    if (state.filters.locationType !== '全部' && ![record.fromLocationId, record.toLocationId].some(id => PCS_SAMPLE_LOCATION_TYPE_LABELS[getPcsSampleLocationById(id)?.locationType!] === state.filters.locationType)) return false
    return matchesKeyword([record.sampleCode, record.sampleName, record.projectCode, record.trackingNo, record.fromEntity, record.toEntity], state.filters.search)
  })
  const body = `
    ${renderMetricCards([
      { label: '全部流转', value: listPcsSampleTransfers().length, tone: 'text-slate-900' },
      { label: '跨站点调拨', value: listPcsSampleTransfers().filter((item) => item.transferCategory === '站点调拨').length, tone: 'text-blue-600' },
      { label: '借用/归还', value: listPcsSampleTransfers().filter((item) => item.transferCategory === '借用流转' || item.transferCategory === '归还入库').length, tone: 'text-emerald-600' },
      { label: '退货/维修', value: listPcsSampleTransfers().filter((item) => item.transferCategory === '退货流转' || item.transferCategory === '维修流转').length, tone: 'text-amber-600' },
      { label: '风险流转', value: listPcsSampleTransfers().filter((item) => item.riskFlags.length > 0).length, tone: 'text-rose-600' },
    ])}
    <section class="rounded-xl border bg-white px-4 py-4 shadow-sm">
      <div class="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px]">
        ${renderTextInput('search', state.filters.search, '搜索样衣/关联来源/运单/发出方/接收方')}
        ${renderSelect('transfer-category', state.filters.transferCategory, ['全部', '站点调拨', '借用流转', '归还入库', '退货流转', '维修流转'])}
        ${renderSelect('location-type', state.filters.locationType, ['全部', ...Object.values(PCS_SAMPLE_LOCATION_TYPE_LABELS)])}
      </div>
    </section>
    <section class="rounded-xl border bg-white shadow-sm">${renderTransferTable(records)}</section>
    ${renderTransferDrawer()}
  `
  return renderPageShell('样衣流转记录', '记录样衣出库、在途、签收、借出、归还等跨站点和人员流转事件。', body)
}

function renderReturnCaseTable(records: PcsSampleReturnCase[]): string {
  const columns: TableColumn<PcsSampleReturnCase>[] = [
    { key: 'caseCode', title: '案件编号', width: '150px', render: (record) => `<button type="button" class="font-medium text-blue-700 hover:underline" data-pcs-sample-action="select-return-case" data-return-case-id="${escapeHtml(record.caseId)}">${escapeHtml(record.caseCode)}</button>` },
    { key: 'caseType', title: '类型', width: '90px', render: (record) => renderBadge(record.caseType, record.caseType === '退货' ? 'info' : 'warning') },
    { key: 'status', title: '状态', width: '100px', render: (record) => renderBadge(record.status, RETURN_STATUS_TONE[record.status]) },
    { key: 'responsibleSite', title: '责任站点', width: '120px' },
    { key: 'sampleCode', title: '样衣', minWidth: '230px', render: (record) => `<div class="flex items-center gap-3"><button type="button" class="shrink-0 cursor-zoom-in overflow-hidden rounded-lg border" data-pda-image-preview-url="${escapeHtml(record.sampleImageUrl)}" data-pda-image-preview-title="${escapeHtml(`${record.sampleCode} ${record.sampleName}`)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(record.sampleName)}大图"><img src="${escapeHtml(record.sampleImageUrl)}" alt="${escapeHtml(record.sampleName)}" class="h-12 w-12 object-cover" /></button><div><div class="font-medium text-slate-900">${escapeHtml(record.sampleCode)}</div><div class="text-sm text-slate-500">${escapeHtml(record.sampleName)}</div></div></div>` },
    { key: 'inventoryStatusSnapshot', title: '样衣状态', width: '110px', render: (record) => renderStatusBadge(record.inventoryStatusSnapshot) },
    { key: 'reasonCategory', title: '原因', width: '110px' },
    { key: 'projectCode', title: '关联来源', minWidth: '220px', render: (record) => escapeHtml(sampleSourceText(record)) },
    { key: 'initiatedBy', title: '发起人', width: '90px' },
    { key: 'acceptedBy', title: '受理人', width: '90px' },
    { key: 'updatedAt', title: '更新时间', width: '150px' },
    { key: 'riskFlag', title: '风险', width: '100px', render: (record) => renderRiskBadge(record.riskFlag) },
  ]
  return renderSampleTableSurface(columns, records, { emptyText: '暂无退货与处理案件', hoverable: true })
}

function renderReturnCaseDrawer(): string {
  const record = state.selectedReturnCaseId ? listPcsSampleReturnCases().find((item) => item.caseId === state.selectedReturnCaseId) : null
  if (!record) return ''
  return `
    <div class="fixed inset-0 z-50">
      <button type="button" class="absolute inset-0 bg-slate-900/40" data-pcs-sample-action="close-drawers" aria-label="关闭案件详情"></button>
      <aside class="absolute right-0 top-0 flex h-full w-full max-w-3xl flex-col overflow-y-auto bg-white shadow-xl">
        <header class="border-b px-5 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex flex-wrap gap-2">${renderBadge(record.caseType, record.caseType === '退货' ? 'info' : 'warning')}${renderBadge(record.status, RETURN_STATUS_TONE[record.status])}${renderBadge(record.responsibleSite, 'outline')}</div>
              <h2 class="mt-2 text-xl font-semibold text-slate-900">${escapeHtml(record.caseCode)}</h2>
            </div>
            <button type="button" class="inline-flex h-9 items-center rounded-md border px-3 text-sm" data-pcs-sample-action="close-drawers">关闭</button>
          </div>
        </header>
        <div class="space-y-4 px-5 py-5">
          <section class="grid gap-4 lg:grid-cols-[160px,1fr]">
            <button type="button" class="cursor-zoom-in overflow-hidden rounded-xl border" data-pda-image-preview-url="${escapeHtml(record.sampleImageUrl)}" data-pda-image-preview-title="${escapeHtml(`${record.sampleCode} ${record.sampleName}`)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(record.sampleName)}大图">
              <img src="${escapeHtml(record.sampleImageUrl)}" alt="${escapeHtml(record.sampleName)}" class="h-48 w-full object-cover" />
            </button>
            <div class="grid gap-3 sm:grid-cols-2">
              ${renderInfoItem('样衣', `${record.sampleCode} · ${record.sampleName}`)}
              ${renderInfoItem('样衣状态快照', record.inventoryStatusSnapshot)}
              ${renderInfoItem('原因', `${record.reasonCategory} · ${record.reasonText}`)}
              ${renderInfoItem('关联来源', sampleSourceText(record))}
              ${renderInfoItem(record.caseType === '退货' ? '退回目标' : '处置结果', record.caseType === '退货' ? `${record.returnTarget} · ${record.returnMethod}` : record.dispositionResult)}
              ${record.caseType === '退货' ? renderInfoItem('物流证据', record.trackingNo ? `${record.carrier} ${record.trackingNo}${record.logisticsEvidence ? ` · ${record.logisticsEvidence}` : ''}` : record.logisticsEvidence || '未登记') : ''}
              ${renderInfoItem('更新时间', record.updatedAt)}
            </div>
          </section>
          ${renderMiniList('案件记录', record.timeline.map((item) => `${item.time} · ${item.action} · ${item.operator}${item.remark ? ` · ${item.remark}` : ''}`), '暂无记录')}
          <div class="flex flex-wrap gap-2">
            <button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-sample-action="mock-action" data-message="已模拟执行 ${escapeHtml(record.caseCode)} 的${escapeHtml(record.caseType)}流程">执行流程</button>
            <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/samples/ledger">查看台账事件</button>
          </div>
        </div>
      </aside>
    </div>
  `
}

export function renderPcsSampleReturnPage(): string {
  const records = listPcsSampleReturnCases().filter((record) => {
    if (state.filters.returnStatus !== '全部' && record.status !== state.filters.returnStatus) return false
    return matchesKeyword([record.caseCode, record.sampleCode, record.sampleName, record.projectCode, record.reasonCategory], state.filters.search)
  })
  const body = `
    ${renderMetricCards([
      { label: '全部案件', value: listPcsSampleReturnCases().length, tone: 'text-slate-900' },
      { label: '待审批', value: listPcsSampleReturnCases().filter((item) => item.status === '待审批').length, tone: 'text-amber-600' },
      { label: '执行中', value: listPcsSampleReturnCases().filter((item) => item.status === '执行中').length, tone: 'text-blue-600' },
      { label: '已结案', value: listPcsSampleReturnCases().filter((item) => item.status === '已结案').length, tone: 'text-emerald-600' },
      { label: '高风险', value: listPcsSampleReturnCases().filter((item) => item.riskFlag.includes('高')).length, tone: 'text-rose-600' },
    ])}
    <section class="rounded-xl border bg-white px-4 py-4 shadow-sm">
      <div class="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_auto]">
        ${renderTextInput('search', state.filters.search, '搜索案件编号/样衣编号/名称/关联来源')}
        ${renderSelect('return-status', state.filters.returnStatus, ['全部', '待审批', '待执行', '执行中', '已结案', '已驳回'])}
        <button type="button" class="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-sample-action="mock-action" data-message="已打开新建退货与处理案件演示入口">新建案件</button>
      </div>
    </section>
    <section class="rounded-xl border bg-white shadow-sm">${renderReturnCaseTable(records)}</section>
    ${renderReturnCaseDrawer()}
  `
  return renderPageShell('样衣退货与处理', '处理测款淘汰、质量异常、供应商退样、内部维修或处置等样衣闭环。', body)
}

function renderLedgerTable(events: PcsSampleLedgerEvent[]): string {
  const columns: TableColumn<PcsSampleLedgerEvent>[] = [
    { key: 'time', title: '时间', width: '155px' },
    { key: 'site', title: '站点', width: '120px', render: (event) => renderBadge(event.site, 'outline') },
    { key: 'sampleCode', title: '样衣', minWidth: '220px', render: (event) => `<button type="button" class="font-medium text-blue-700 hover:underline" data-pcs-sample-action="select-ledger" data-ledger-event-id="${escapeHtml(event.eventId)}">${escapeHtml(event.sampleCode)}</button><p class="mt-1 text-sm text-slate-500">${escapeHtml(event.sampleName)}</p>` },
    { key: 'eventType', title: '事件类型', width: '110px', render: (event) => renderBadge(event.eventType, event.eventType === '退货' || event.eventType === '处置' ? 'warning' : 'info') },
    { key: 'summary', title: '摘要', minWidth: '220px' },
    { key: 'fromLocation', title: '位置/去向', minWidth: '220px', render: (event) => `${escapeHtml(event.fromLocation)}<span class="px-2 text-slate-400">→</span>${escapeHtml(event.toLocation)}` },
    { key: 'holder', title: '持有人/目的方', width: '140px' },
    { key: 'sourceDoc', title: '来源单据', width: '140px' },
    { key: 'projectCode', title: '关联来源 / 用途', minWidth: '180px', render: (event) => `<div class="font-medium text-slate-900">${escapeHtml(sampleSourceText(event))}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(event.sourceStepName)}</div>` },
    { key: 'operator', title: '操作人', width: '90px' },
  ]
  return renderSampleTableSurface(columns, events, { emptyText: '暂无样衣台账事件', hoverable: true })
}

function renderLedgerDrawer(): string {
  const event = state.selectedLedgerEventId ? listPcsSampleLedgerEvents().find((item) => item.eventId === state.selectedLedgerEventId) : null
  if (!event) return ''
  return renderGenericDrawer(
    '台账事件详情',
    `${event.eventType} · ${event.sampleCode}`,
    [
      ['事件时间', event.time],
      ['站点', event.site],
      ['样衣', `${event.sampleCode} · ${event.sampleName}`],
      ['摘要', event.summary],
      ['位置变化', `${event.fromLocation} → ${event.toLocation}`],
      ['持有人/目的方', event.holder],
      ['来源单据', event.sourceDoc],
      ['关联来源 / 用途', `${sampleSourceText(event)} · ${event.sourceStepName}`],
      ['操作人', event.operator],
      ['备注', event.remark],
    ],
    event.isVoided ? ['已作废'] : [],
  )
}

export function renderPcsSampleLedgerPage(): string {
  const events = listPcsSampleLedgerEvents().filter((event) => {
    if (state.filters.ledgerType !== '全部' && event.eventType !== state.filters.ledgerType) return false
    return matchesKeyword([event.sampleCode, event.sampleName, event.summary, event.sourceDoc, event.projectCode, event.sourceStepName, event.operator], state.filters.search)
  })
  const body = `
    ${renderMetricCards([
      { label: '全部事件', value: listPcsSampleLedgerEvents().length, tone: 'text-slate-900' },
      { label: '借出/归还', value: listPcsSampleLedgerEvents().filter((item) => item.eventType === '借出' || item.eventType === '归还').length, tone: 'text-blue-600' },
      { label: '在途/签收', value: listPcsSampleLedgerEvents().filter((item) => item.eventType === '在途' || item.eventType === '签收').length, tone: 'text-indigo-600' },
      { label: '退货/处置', value: listPcsSampleLedgerEvents().filter((item) => item.eventType === '退货' || item.eventType === '处置').length, tone: 'text-amber-600' },
      { label: '盘点调整', value: listPcsSampleLedgerEvents().filter((item) => item.eventType === '盘点调整').length, tone: 'text-emerald-600' },
    ])}
    <section class="rounded-xl border bg-white px-4 py-4 shadow-sm">
      <div class="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_auto]">
        ${renderTextInput('search', state.filters.search, '搜索样衣/摘要/来源单据/关联来源/操作人')}
        ${renderSelect('ledger-type', state.filters.ledgerType, ['全部', '入库', '出库', '在途', '签收', '借出', '归还', '预占', '释放', '退货', '处置', '盘点调整', '打标', '类型互转'])}
        <button type="button" class="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/samples/ledger/stocktake">盘点差异追踪</button>
      </div>
    </section>
    <section class="rounded-xl border bg-white shadow-sm">
      <div class="border-b px-4 py-3">
        <h2 class="text-base font-semibold text-slate-900">台账事件列表</h2>
        <p class="mt-1 text-sm text-slate-500">按样衣追踪位置变化、持有人变化、来源单据和操作人。</p>
      </div>
      ${renderLedgerTable(events)}
    </section>
    ${renderLedgerDrawer()}
  `
  return renderPageShell('样衣台账', '沉淀样衣入库、出库、预占、借出、归还、退货、处置和盘点调整事件。', body)
}

function renderStocktakeTable(diffs: PcsSampleStocktakeDiff[]): string {
  const columns: TableColumn<PcsSampleStocktakeDiff>[] = [
    { key: 'diffId', title: '差异编号', width: '130px', render: (diff) => `<button type="button" class="font-medium text-blue-700 hover:underline" data-pcs-sample-action="select-stocktake" data-stocktake-diff-id="${escapeHtml(diff.diffId)}">${escapeHtml(diff.diffId)}</button>` },
    { key: 'stocktakeCode', title: '盘点单', width: '150px' },
    { key: 'sampleCode', title: '样衣', minWidth: '220px', render: (diff) => `<div class="font-medium text-slate-900">${escapeHtml(diff.sampleCode)}</div><div class="text-sm text-slate-500">${escapeHtml(diff.sampleName)}</div>` },
    { key: 'systemQty', title: '系统', width: '80px', align: 'center' },
    { key: 'countedQty', title: '实盘', width: '80px', align: 'center' },
    { key: 'diffQty', title: '差异', width: '100px', align: 'center', render: (diff) => renderBadge(`${diff.diffQty > 0 ? '+' : ''}${diff.diffQty} ${diff.diffType}`, diff.diffType === '短缺' ? 'danger' : 'info') },
    { key: 'status', title: '状态', width: '100px', render: (diff) => renderBadge(diff.status, STOCKTAKE_STATUS_TONE[diff.status]) },
    { key: 'owner', title: '负责人', width: '100px' },
    { key: 'discoveredAt', title: '发现时间', width: '150px' },
    { key: 'nextAction', title: '下一步', minWidth: '220px' },
  ]
  return renderSampleTableSurface(columns, diffs, { emptyText: '暂无盘点差异', hoverable: true })
}

function renderStocktakeDrawer(): string {
  const diff = state.selectedStocktakeDiffId ? listPcsSampleStocktakeDiffs().find((item) => item.diffId === state.selectedStocktakeDiffId) : null
  if (!diff) return ''
  return renderGenericDrawer(
    '盘点差异详情',
    `${diff.stocktakeCode} · ${diff.sampleCode}`,
    [
      ['差异编号', diff.diffId],
      ['盘点单', diff.stocktakeCode],
      ['样衣', `${diff.sampleCode} · ${diff.sampleName}`],
      ['站点', diff.site],
      ['系统/实盘', `${diff.systemQty} / ${diff.countedQty}`],
      ['差异', `${diff.diffQty > 0 ? '+' : ''}${diff.diffQty} · ${diff.diffType}`],
      ['状态', diff.status],
      ['负责人', diff.owner],
      ['原因', diff.reason],
      ['下一步', diff.nextAction],
    ],
    diff.status === '待确认' ? ['待确认'] : [],
  )
}

export function renderPcsSampleStocktakePage(): string {
  const diffs = listPcsSampleStocktakeDiffs().filter((diff) => {
    if (state.filters.stocktakeStatus !== '全部' && diff.status !== state.filters.stocktakeStatus) return false
    return matchesKeyword([diff.diffId, diff.stocktakeCode, diff.sampleCode, diff.sampleName, diff.owner, diff.reason], state.filters.search)
  })
  const body = `
    ${renderMetricCards([
      { label: '全部差异', value: listPcsSampleStocktakeDiffs().length, tone: 'text-slate-900' },
      { label: '待确认', value: listPcsSampleStocktakeDiffs().filter((item) => item.status === '待确认').length, tone: 'text-amber-600' },
      { label: '处理中', value: listPcsSampleStocktakeDiffs().filter((item) => item.status === '处理中').length, tone: 'text-blue-600' },
      { label: '已调整', value: listPcsSampleStocktakeDiffs().filter((item) => item.status === '已调整').length, tone: 'text-emerald-600' },
      { label: '短缺件数', value: Math.abs(listPcsSampleStocktakeDiffs().filter((item) => item.diffType === '短缺').reduce((sum, item) => sum + item.diffQty, 0)), tone: 'text-rose-600' },
    ])}
    <section class="rounded-xl border bg-white px-4 py-4 shadow-sm">
      <div class="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px]">
        ${renderTextInput('search', state.filters.search, '搜索差异编号/盘点单/样衣/负责人')}
        ${renderSelect('stocktake-status', state.filters.stocktakeStatus, ['全部', '待确认', '处理中', '已调整', '已关闭'])}
      </div>
    </section>
    <section class="rounded-xl border bg-white shadow-sm">${renderStocktakeTable(diffs)}</section>
    ${renderStocktakeDrawer()}
  `
  return renderPageShell('盘点差异追踪', '追踪样衣盘点短缺、盈余、原因确认、调整入账和关闭动作。', body)
}

function renderSampleCards(samples: PcsSampleRecord[]): string {
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      ${samples.map((sample) => `
        <article class="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div class="relative h-44 w-full overflow-hidden bg-slate-50">
            <button type="button" class="absolute inset-0 z-0 block overflow-hidden" data-pcs-sample-action="select-sample" data-pcs-sample-id="${escapeHtml(sample.sampleId)}" aria-label="打开${escapeHtml(sample.sampleCode)}详情">
              <img src="${escapeHtml(sample.imageUrl)}" alt="${escapeHtml(sample.name)}" class="h-full w-full object-cover transition hover:scale-105" />
            </button>
            <button type="button" class="absolute right-2 top-2 z-10 rounded border border-white/80 bg-white/90 px-2 py-1 text-xs text-slate-700 shadow hover:bg-white" data-pda-image-preview-url="${escapeHtml(sample.imageUrl)}" data-pda-image-preview-title="${escapeHtml(`${sample.sampleCode} ${sample.name}`)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(sample.name)}大图">大图</button>
          </div>
          <div class="space-y-3 px-4 py-4">
            <div>
              <button type="button" class="font-semibold text-blue-700 hover:underline" data-nav="/pcs/samples/detail/${escapeHtml(sample.sampleId)}">${escapeHtml(getPcsSampleLabelIdentity(sample.skuCode)?.hgCode || '编号待生成')}</button><p class="mt-1 break-all text-xs text-slate-500">${escapeHtml(sample.skuCode)}</p>
              <p class="mt-1 line-clamp-2 text-sm text-slate-700">${escapeHtml(sample.name)}</p><a class="mt-2 inline-block text-sm text-blue-700" href="/pcs/samples/label/${encodeURIComponent(sample.sampleId)}" data-nav="/pcs/samples/label/${encodeURIComponent(sample.sampleId)}">打印标签</a>
            </div>
            <div class="flex flex-wrap gap-2">${renderStatusBadge(sample.status)}${renderAvailabilityBadge(sample.availability)}${sample.anomaly ? renderRiskBadge(sample.anomaly.type) : ''}</div>
            <div class="space-y-1 text-sm text-slate-500">
              <p>${escapeHtml(sample.responsibleSite)} · ${escapeHtml(sample.currentLocation)}</p>
              <p>${escapeHtml(sampleSourceText(sample))} · ${escapeHtml(sample.sourceStepName)}</p>
              <p>${sample.occupiedUntil ? `预计归还：${escapeHtml(sample.occupiedUntil)}` : sample.transit ? `ETA：${escapeHtml(sample.transit.eta)}` : '无待归还/在途节点'}</p>
            </div>
          </div>
        </article>
      `).join('')}
    </section>
  `
}

export function renderPcsSampleViewPage(): string {
  const samples = getFilteredSamples()
  const body = `
    <section class="rounded-xl border bg-white px-4 py-4 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="grid flex-1 gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_180px]">
          ${renderTextInput('search', state.filters.search, '搜索样衣/关联来源/用途 / 原始环节/位置')}
          ${renderSelect('status', state.filters.status, ['全部', '在库可用', '预占锁定', '借出占用', '在途待签收', '维修中', '待处置', '已退货'])}
          ${renderSelect('site', state.filters.site, ['全部', '深圳样衣间', '雅加达样衣间'])}
        ${renderSelect('location-type', state.filters.locationType, ['全部', ...Object.values(PCS_SAMPLE_LOCATION_TYPE_LABELS)])}
        </div>
        <div class="flex rounded-md border border-slate-200 bg-white p-1">
          <button type="button" class="${toClassName('inline-flex h-8 items-center gap-1 rounded px-3 text-sm', state.viewMode === 'card' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50')}" data-pcs-sample-action="set-view-mode" data-view-mode="card"><i data-lucide="layout-grid" class="h-4 w-4"></i>卡片</button>
          <button type="button" class="${toClassName('inline-flex h-8 items-center gap-1 rounded px-3 text-sm', state.viewMode === 'table' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50')}" data-pcs-sample-action="set-view-mode" data-view-mode="table"><i data-lucide="list" class="h-4 w-4"></i>表格</button>
        </div>
      </div>
    </section>
    ${state.viewMode === 'card' ? renderSampleCards(samples) : `<section class="rounded-xl border bg-white shadow-sm">${renderSampleTable(samples)}</section>`}
    ${renderSampleDetailDrawer()}
  `
  return renderPageShell('样衣视图', '以卡片或表格查看样衣可用性、风险、责任站点和预计归还/ETA。', body)
}

function renderGenericDrawer(title: string, heading: string, items: Array<[string, string]>, risks: string[]): string {
  return `
    <div class="fixed inset-0 z-50">
      <button type="button" class="absolute inset-0 bg-slate-900/40" data-pcs-sample-action="close-drawers" aria-label="关闭详情"></button>
      <aside class="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-white shadow-xl">
        <header class="border-b px-5 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs text-slate-500">${escapeHtml(title)}</p>
              <h2 class="mt-1 text-xl font-semibold text-slate-900">${escapeHtml(heading)}</h2>
              <div class="mt-2 flex flex-wrap gap-2">${risks.map(renderRiskBadge).join('')}</div>
            </div>
            <button type="button" class="inline-flex h-9 items-center rounded-md border px-3 text-sm" data-pcs-sample-action="close-drawers">关闭</button>
          </div>
        </header>
        <div class="grid gap-3 px-5 py-5 sm:grid-cols-2">
          ${items.map(([label, value]) => renderInfoItem(label, value)).join('')}
        </div>
      </aside>
    </div>
  `
}

export function renderPcsSampleDetailPage(sampleId: string): string {
  const sample = getPcsSampleById(decodeURIComponent(sampleId))
  if (!sample) {
    return renderPageShell(
      '样衣详情',
      '当前样衣不存在或已被移除。',
      `<section class="rounded-xl border bg-white p-10 text-center text-slate-500">未找到样衣：${escapeHtml(sampleId)}</section>`,
    )
  }

  const ledgerEvents = listPcsSampleLedgerEventsBySampleId(sample.sampleId)
  const requests = listPcsSampleRequestsBySampleId(sample.sampleId)
  const body = `
    <section class="rounded-xl border bg-white px-4 py-4 shadow-sm">
      <button type="button" class="inline-flex h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/samples/inventory">
        <i data-lucide="arrow-left" class="h-4 w-4"></i>返回样衣库存
      </button>
      <a class="ml-3 inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm text-white" href="/pcs/samples/label/${encodeURIComponent(sample.sampleId)}" data-nav="/pcs/samples/label/${encodeURIComponent(sample.sampleId)}">打印样衣标签</a>
      <div class="mt-4 grid gap-5 lg:grid-cols-[260px_1fr]">
            <button type="button" class="cursor-zoom-in overflow-hidden rounded-xl border" data-pda-image-preview-url="${escapeHtml(sample.imageUrl)}" data-pda-image-preview-title="${escapeHtml(`${sample.sampleCode} ${sample.name}`)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(sample.name)}大图">
              <img src="${escapeHtml(sample.imageUrl)}" alt="${escapeHtml(sample.name)}" class="h-80 w-full object-contain" />
            </button>
        <div>
          <div class="flex flex-wrap gap-2">${renderStatusBadge(sample.status)}${renderAvailabilityBadge(sample.availability)}${sample.anomaly ? renderRiskBadge(sample.anomaly.type) : ''}</div>
          <h2 class="mt-3 text-2xl font-semibold text-slate-900">${escapeHtml(sample.sampleCode)} · ${escapeHtml(sample.name)}</h2>
          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            ${renderInfoItem('基础属性', `${sample.category} · ${sample.size} · ${sample.color} · ${sample.material}`)}
            ${renderInfoItem('样品类型', PCS_SAMPLE_TYPE_LABELS[sample.sampleType])}
            ${renderInfoItem('贴码记录', sample.taggedAt ? `${getPcsSampleLabelIdentity(sample.skuCode)?.hgCode || 'HG 编号待生成'} · SKU ${sample.skuCode} · ${sample.taggedAt}` : '未贴码')}
            ${renderInfoItem('HG 样衣编号', getPcsSampleLabelIdentity(sample.skuCode)?.hgCode || '待生成')}
            ${renderInfoItem('首次登记日期', getPcsSampleLabelIdentity(sample.skuCode)?.registeredAt.slice(0,10) || '待核对')}
            ${renderInfoItem('模板类型', sample.templateType)}
            ${renderInfoItem('责任站点', sample.responsibleSite)}
            ${renderInfoItem('当前位置', `${sample.currentLocation} · ${sample.locationDetail}`)}
            ${renderInfoItem('关联来源', sampleSourceText(sample))}
            ${renderInfoItem('用途 / 原始环节', sample.sourceStepName)}
            ${renderInfoItem('占用/预占', sample.occupancyType === '无' ? '无占用' : `${sample.occupiedBy} · ${sample.occupiedFor} · 至 ${sample.occupiedUntil}`)}
            ${renderInfoItem('最近更新', `${sample.updatedAt} · ${sample.updatedBy}`)}
          </div>
        </div>
      </div>
    </section>
    <section class="grid gap-4 lg:grid-cols-2">
      ${renderMiniList('关联申请', requests.map((item) => `${item.requestCode} · ${item.status} · ${item.purpose}`), '暂无关联申请')}
      ${renderMiniList('台账事件', ledgerEvents.map((item) => `${item.time} · ${item.eventType} · ${item.summary}`), '暂无台账事件')}
      ${renderMiniList(
        '类型互转记录',
        listPcsSampleTypeConversionLogs(sample.sampleId).map(
          (item) =>
            `${item.convertedAt} · ${PCS_SAMPLE_TYPE_LABELS[item.fromType]} → ${PCS_SAMPLE_TYPE_LABELS[item.toType]} · ${item.actor} · ${item.reason}`,
        ),
        '暂无类型互转记录',
      )}
      ${renderMiniList(
        '流转记录',
        listPcsSampleTransfers().filter(item => item.sampleId === sample.sampleId).map(item => `${item.time} · ${item.fromEntity} → ${item.toEntity} · ${item.operator} · ${item.remark}${item.riskFlags.includes('例外用途') ? ' · 例外用途' : ''}`),
        '暂无流转记录',
      )}
    </section>
    <section class="rounded-lg border bg-white p-4 shadow-sm">
      <div class="text-sm font-medium text-slate-900">样品类型</div>
      <div class="mt-2 flex flex-wrap gap-2">
        ${PCS_SAMPLE_TYPES.map(
          (type) =>
            `<button type="button" class="inline-flex h-9 items-center rounded-md border px-4 text-sm ${type === sample.sampleType ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}" ${type === sample.sampleType ? 'disabled' : ''} data-pcs-sample-action="convert-type" data-sample-id="${escapeHtml(sample.sampleId)}" data-to-type="${type}">${escapeHtml(PCS_SAMPLE_TYPE_LABELS[type])}${type === sample.sampleType ? '（当前）' : ''}</button>`,
        ).join('')}
      </div>
      <button type="button" class="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm text-white" data-pcs-sample-action="open-flow" data-sample-id="${escapeHtml(sample.sampleId)}">确认流转签收</button>
      <p class="mt-2 text-xs text-slate-500">营销样品与生产样品可任意互转；互转会记录操作人、时间与原因。打标码值为 HG 样衣编号，扫码后核对对应 SKU。</p>
      <div class="mt-3 text-sm text-slate-700">打标状态：${sample.taggedAt ? `已贴码 ${escapeHtml(getPcsSampleLabelIdentity(sample.skuCode)?.hgCode || 'HG 编号待生成')}（${escapeHtml(sample.taggedAt)}）` : '未贴码，不能完成入库后打标/测款⑤'} · 对应 SKU：${escapeHtml(sample.skuCode)}</div>
    </section>
  `
  return renderPageShell('样衣详情', '查看样衣的库存快照、申请关联、流转和台账事件。', body + renderFlowDialog())
}

function resetFilters(): void {
  state.filters.search = ''
  state.filters.status = '全部'
  state.filters.site = '全部'
  state.filters.requestStatus = '全部'
  state.filters.transferCategory = '全部'
  state.filters.locationType = '全部'
  state.filters.returnStatus = '全部'
  state.filters.ledgerType = '全部'
  state.filters.stocktakeStatus = '全部'
}

function closeDrawers(): void {
  state.selectedSampleId = null
  state.selectedRequestId = null
  state.selectedTransferId = null
  state.selectedReturnCaseId = null
  state.selectedLedgerEventId = null
  state.selectedStocktakeDiffId = null
  state.createRequestOpen = false
  state.flowOpen = false
}

export function handlePcsSampleManagementInput(target: Element): boolean {
  if (target.closest('[data-pcs-sample-field^="label-"]')) return handlePcsSampleLabelInput(target)
  const fieldNode = target.closest<HTMLElement>('[data-pcs-sample-field]')
  if (!fieldNode) return false
  const field = fieldNode.dataset.pcsSampleField || ''
  const value = fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement || fieldNode instanceof HTMLTextAreaElement ? fieldNode.value : ''

  if (field === 'search') state.filters.search = value
  else if (field === 'status') state.filters.status = value || '全部'
  else if (field === 'site') state.filters.site = value || '全部'
  else if (field === 'request-status') state.filters.requestStatus = value || '全部'
  else if (field === 'location-type') state.filters.locationType = value || '全部'
  else if (field === 'flow-target') { state.flowTarget = value; return false }
  else if (field === 'flow-reason') { state.flowReason = value; return false }
  else if (field === 'transfer-category') state.filters.transferCategory = value || '全部'
  else if (field === 'return-status') state.filters.returnStatus = value || '全部'
  else if (field === 'ledger-type') state.filters.ledgerType = value || '全部'
  else if (field === 'stocktake-status') state.filters.stocktakeStatus = value || '全部'
  else return false

  return true
}

export async function handlePcsSampleManagementEvent(target: HTMLElement): Promise<boolean> {
  const actionNode = target.closest<HTMLElement>('[data-pcs-sample-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsSampleAction || ''
  if (['print-label','register-label','reset-label-size'].includes(action)) { await handlePcsSampleLabelAction(action); return false }

  if (action === 'open-flow') { state.flowOpen = true; state.flowSampleId = actionNode.dataset.sampleId || ''; state.flowTarget = ''; state.flowReason = ''; return true }
  if (action === 'close-flow') { state.flowOpen = false; return true }
  if (action === 'save-flow') {
    try {
      await ensureLosLiveRoomState()
      const guards = liveRoomTransferGuards(state.flowTarget)
      const result = await runPcsRecordCommand(() => transferPcsSample(state.flowSampleId, state.flowTarget, '当前用户', state.flowReason), crypto.randomUUID(), [PCS_SAMPLE_STORAGE_KEY], guards)
      if (!result.ok) { state.notice = result.message || '未保存'; return true }
      state.flowOpen = false; state.notice = '流转签收已保存，当前位置与台账已更新。'
    } catch (error) { state.notice = `未保存：${error instanceof Error ? error.message : '请重试'}` }
    return true
  }
  if (action === 'close-notice') {
    state.notice = null
    return true
  }
  if (action === 'convert-type') {
    const sampleId = actionNode.dataset.sampleId || ''
    const toType = (actionNode.dataset.toType || '') as PcsSampleType
    const reason = window.prompt('请填写类型互转原因：', state.conversionReason || '业务调整')
    if (reason === null) return true
    state.conversionReason = reason
    let result
    try { result = await runPcsRecordCommand(() => convertPcsSampleType(sampleId, toType, '当前用户', reason), crypto.randomUUID(), [PCS_SAMPLE_STORAGE_KEY]) }
    catch (error) { state.notice = `未保存：${error instanceof Error ? error.message : '请重试'}`; return true }
    state.notice = result.ok
      ? `已转为${PCS_SAMPLE_TYPE_LABELS[toType]}，并记录操作人与时间。`
      : result.message || '类型互转失败。'
    return true
  }
  if (action === 'close-drawers') {
    closeDrawers()
    return true
  }
  if (action === 'reset-filters') {
    resetFilters()
    return true
  }
  if (action === 'quick-filter-status') {
    state.filters.status = actionNode.dataset.status || '全部'
    return true
  }
  if (action === 'select-sample') {
    state.selectedSampleId = actionNode.dataset.pcsSampleId || null
    return true
  }
  if (action === 'select-request') {
    state.selectedRequestId = actionNode.dataset.requestId || null
    return true
  }
  if (action === 'open-create-request') {
    state.createRequestOpen = true
    return true
  }
  if (action === 'submit-create-request') {
    state.createRequestOpen = false
    state.notice = '已保存样衣使用申请草稿，并预留后续提交、审批、领用、归还演示链路。'
    return true
  }
  if (action === 'select-transfer') {
    state.selectedTransferId = actionNode.dataset.transferId || null
    return true
  }
  if (action === 'select-return-case') {
    state.selectedReturnCaseId = actionNode.dataset.returnCaseId || null
    return true
  }
  if (action === 'select-ledger') {
    state.selectedLedgerEventId = actionNode.dataset.ledgerEventId || null
    return true
  }
  if (action === 'select-stocktake') {
    state.selectedStocktakeDiffId = actionNode.dataset.stocktakeDiffId || null
    return true
  }
  if (action === 'set-view-mode') {
    state.viewMode = actionNode.dataset.viewMode === 'table' ? 'table' : 'card'
    return true
  }
  if (action === 'mock-action') {
    state.notice = actionNode.dataset.message || '已执行样衣管理演示动作。'
    return true
  }

  return false
}

export function isPcsSampleManagementDialogOpen(): boolean {
  return Boolean(
    state.selectedSampleId ||
      state.selectedRequestId ||
      state.selectedTransferId ||
      state.selectedReturnCaseId ||
      state.selectedLedgerEventId ||
      state.selectedStocktakeDiffId ||
      state.createRequestOpen || state.flowOpen,
  )
}

function renderFlowDialog(): string {
  if (!state.flowOpen) return ''
  const sample = getPcsSampleById(state.flowSampleId)
  if (!sample) return ''
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-label="确认流转签收">
    <section class="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
      <h2 class="text-lg font-semibold">确认流转签收</h2>
      ${state.notice?.includes('未保存') || state.notice?.includes('不存在') || state.notice?.includes('必须') ? `<p class="mt-2 text-sm text-rose-700" role="alert">${escapeHtml(state.notice)}</p>` : ''}
      <p class="my-3 text-sm">${escapeHtml(sample.skuCode)} · ${escapeHtml(sample.currentLocation)} → 接收位置</p>
      <label class="block text-sm">接收位置<select data-pcs-sample-field="flow-target" class="mt-2 w-full rounded border p-2"><option value="">请选择</option>${listPcsSampleLocations().filter(loc => loc.enabled !== false && loc.locationId !== sample.currentLocationId).map(loc => `<option value="${escapeHtml(loc.locationId)}" ${loc.locationId === state.flowTarget ? 'selected' : ''}>${escapeHtml(PCS_SAMPLE_LOCATION_TYPE_LABELS[loc.locationType])} · ${escapeHtml(loc.locationName)}${loc.ownerName ? ` · ${escapeHtml(loc.ownerName)}` : ''}</option>`).join('')}</select></label>
      <label class="mt-3 block text-sm">流转原因<textarea data-pcs-sample-field="flow-reason" class="mt-2 w-full rounded border p-2" placeholder="说明用途；例外流转也必须填写原因">${escapeHtml(state.flowReason)}</textarea></label>
      <p class="mt-2 text-xs text-slate-500">接收方已收到实物且SKU码核对一致后确认；不替代运输中签收。</p>
      <div class="mt-4 flex justify-end gap-2"><button class="rounded border px-4 py-2" data-pcs-sample-action="close-flow">取消</button><button class="rounded bg-blue-600 px-4 py-2 text-white" data-pcs-sample-action="save-flow">确认签收并保存</button></div>
    </section></div>`
}
