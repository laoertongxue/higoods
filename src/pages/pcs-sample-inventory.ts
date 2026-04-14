import { ensurePcsProjectDemoDataReady } from './pcs-projects.ts'
import { ensurePcsSampleDemoDataReady } from '../data/pcs-sample-demo.ts'
import { listProjects } from '../data/pcs-project-repository.ts'
import { getSampleAssetById, listSampleAssets } from '../data/pcs-sample-asset-repository.ts'
import { listSampleLedgerEvents, listSampleLedgerEventsBySample } from '../data/pcs-sample-ledger-repository.ts'
import { appendSampleTransition } from '../data/pcs-sample-actions.ts'
import type {
  SampleAssetRecord,
  SampleInventoryStatus,
  SampleLedgerEventRecord,
} from '../data/pcs-sample-types.ts'
import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'

type OccupancyType = '无' | '预占' | '占用'
type QuickFilterKey = 'all' | 'available' | 'reserved' | 'occupied' | 'inTransit' | 'anomaly'

interface TransitViewModel {
  from: string
  to: string
  trackingNo: string
  etaText: string
  elapsedHours: number
  slaHours: number
  overdue: boolean
}

interface AnomalyViewModel {
  type: string
  level: '高' | '中'
  note: string
}

interface InventorySampleViewModel {
  sampleAssetId: string
  sampleCode: string
  sampleName: string
  sampleType: string
  categoryName: string
  templateType: string
  projectId: string | null
  projectCode: string | null
  projectName: string | null
  status: SampleInventoryStatus
  currentLocation: string
  locationDetail: string
  occupancyType: OccupancyType
  occupiedBy: string | null
  occupiedFor: string | null
  occupiedUntil: string | null
  inTransit: boolean
  transit: TransitViewModel | null
  anomaly: AnomalyViewModel | null
  relatedWorkItemName: string | null
  relatedWorkItemRoute: string | null
  sourceDocCode: string
  sourceDocRoute: string | null
  updatedAt: string
  updatedBy: string
  recentEvents: SampleLedgerEventRecord[]
}

interface SampleInventoryPageState {
  notice: string | null
  filters: {
    search: string
    status: string
    location: string
    template: string
    showAnomalyOnly: boolean
    showTransitOverdueOnly: boolean
    showTodayReturnOnly: boolean
    quickFilter: QuickFilterKey
  }
  detailSampleAssetId: string | null
}

const STATUS_META: Record<SampleInventoryStatus, { label: string; className: string }> = {
  在途: { label: '在途', className: 'bg-blue-100 text-blue-700' },
  在库待核对: { label: '在库待核对', className: 'bg-sky-100 text-sky-700' },
  在库可用: { label: '在库可用', className: 'bg-emerald-100 text-emerald-700' },
  预占锁定: { label: '预占锁定', className: 'bg-violet-100 text-violet-700' },
  借出占用: { label: '借出占用', className: 'bg-orange-100 text-orange-700' },
  在途待签收: { label: '在途待签收', className: 'bg-blue-100 text-blue-700' },
  待处置: { label: '待处置', className: 'bg-rose-100 text-rose-700' },
  已退货: { label: '已退货', className: 'bg-slate-100 text-slate-600' },
  维修中: { label: '维修中', className: 'bg-amber-100 text-amber-700' },
  已处置: { label: '已处置', className: 'bg-slate-100 text-slate-600' },
}

const QUICK_FILTER_LABEL_MAP: Record<QuickFilterKey, string> = {
  all: '全部',
  available: '在库可用',
  reserved: '预占锁定',
  occupied: '借出占用',
  inTransit: '在途待签收',
  anomaly: '异常',
}

const state: SampleInventoryPageState = {
  notice: null,
  filters: {
    search: '',
    status: '全部',
    location: '全部',
    template: '全部',
    showAnomalyOnly: false,
    showTransitOverdueOnly: false,
    showTodayReturnOnly: false,
    quickFilter: 'all',
  },
  detailSampleAssetId: null,
}

function ensurePageDataReady(): void {
  ensurePcsProjectDemoDataReady()
  ensurePcsSampleDemoDataReady()
}

function parseDateTime(value: string): Date | null {
  if (!value) return null
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function hoursBetween(startText: string, endText: string): number {
  const start = parseDateTime(startText)
  const end = parseDateTime(endText)
  if (!start || !end) return 0
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 3600000))
}

function extractDueDate(note: string): string | null {
  const matched = note.match(/20\d{2}-\d{2}-\d{2}(?: \d{2}:\d{2})?/)
  return matched ? matched[0] : null
}

function getTodayDateText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

interface InventoryActionConfig {
  noticePrefix: string
  eventType: Parameters<typeof appendSampleTransition>[0]['eventType']
  inventoryStatusAfter: Parameters<typeof appendSampleTransition>[0]['inventoryStatusAfter']
  availabilityAfter: Parameters<typeof appendSampleTransition>[0]['availabilityAfter']
  locationType: Parameters<typeof appendSampleTransition>[0]['locationType']
  locationDisplay: string
  custodianType: Parameters<typeof appendSampleTransition>[0]['custodianType']
  custodianName: string
  operatorName: string
  note: string
  sourceDocType: Parameters<typeof appendSampleTransition>[0]['sourceDocType']
  sourceDocCodePrefix: string
}

function applyInventoryAction(sampleAssetId: string, config: InventoryActionConfig): boolean {
  ensurePageDataReady()
  const result = appendSampleTransition({
    sampleAssetId,
    eventType: config.eventType,
    inventoryStatusAfter: config.inventoryStatusAfter,
    availabilityAfter: config.availabilityAfter,
    locationType: config.locationType,
    locationDisplay: config.locationDisplay,
    custodianType: config.custodianType,
    custodianName: config.custodianName,
    operatorName: config.operatorName,
    note: config.note,
    sourceModule: '样衣库存',
    sourceDocType: config.sourceDocType,
    sourceDocCodePrefix: config.sourceDocCodePrefix,
  })
  if (!result?.asset) {
    state.notice = '未找到对应样衣资产。'
    return true
  }

  state.notice = `${config.noticePrefix}：${result.asset.sampleCode}`
  return true
}

function getCurrentLocation(locationDisplay: string, locationType: SampleAssetRecord['locationType']): string {
  if (locationType === '在途') return '在途'
  if (locationDisplay.includes('摄影棚')) return '摄影棚'
  if (locationDisplay.includes('直播')) return '雅加达直播间'
  if (locationDisplay.includes('维修')) return '维修区'
  if (locationDisplay.includes('处置')) return '处置区'
  if (locationDisplay.includes('深圳')) return '深圳仓'
  return locationDisplay || '未登记'
}

function getStatusBadge(status: SampleInventoryStatus): string {
  const meta = STATUS_META[status]
  return `<span class="${escapeHtml(toClassName('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', meta.className))}">${escapeHtml(meta.label)}</span>`
}

function buildInventoryViewModels(): InventorySampleViewModel[] {
  ensurePageDataReady()
  const projectMap = new Map(listProjects().map((project) => [project.projectId, project]))
  const eventMap = new Map<string, SampleLedgerEventRecord[]>()
  listSampleLedgerEvents().forEach((event) => {
    const list = eventMap.get(event.sampleAssetId) || []
    list.push(event)
    eventMap.set(event.sampleAssetId, list)
  })

  return listSampleAssets().map((asset) => {
    const project = asset.projectId ? projectMap.get(asset.projectId) || null : null
    const recentEvents = (eventMap.get(asset.sampleAssetId) || []).slice(0, 8)
    const latestEvent = recentEvents[0] || null
    const occupancyType: OccupancyType = asset.inventoryStatus === '预占锁定' ? '预占' : asset.inventoryStatus === '借出占用' ? '占用' : '无'
    const occupiedUntil = latestEvent ? extractDueDate(latestEvent.note) : null
    const transit =
      asset.locationType === '在途' || asset.inventoryStatus === '在途待签收'
        ? {
            from: latestEvent?.locationBefore || '上一节点',
            to: latestEvent?.locationAfter || asset.locationDisplay,
            trackingNo: latestEvent?.sourceDocCode || asset.sourceDocCode,
            etaText: latestEvent?.note || '待签收',
            elapsedHours: hoursBetween(latestEvent?.businessDate || asset.updatedAt, `${getTodayDateText()} 23:59`),
            slaHours: 48,
            overdue: hoursBetween(latestEvent?.businessDate || asset.updatedAt, `${getTodayDateText()} 23:59`) > 48,
          }
        : null

    let anomaly: AnomalyViewModel | null = null
    if (asset.inventoryStatus === '待处置') {
      anomaly = { type: '待处置', level: '高', note: latestEvent?.note || '样衣已进入待处置流程。' }
    } else if (asset.inventoryStatus === '维修中') {
      anomaly = { type: '维修中', level: '中', note: latestEvent?.note || '样衣正在维修处理中。' }
    } else if (transit?.overdue) {
      anomaly = { type: '在途超时', level: '高', note: `已超过 SLA ${transit.slaHours} 小时，当前累计 ${transit.elapsedHours} 小时。` }
    } else if (
      occupancyType === '占用' &&
      occupiedUntil &&
      occupiedUntil.slice(0, 10) < getTodayDateText()
    ) {
      anomaly = { type: '归还超期', level: '中', note: `应归还时间为 ${occupiedUntil}，当前仍未回仓。` }
    }

    const sourceDocRoute =
      asset.sourceDocType === '样衣使用申请'
        ? '/pcs/samples/application'
        : asset.sourceDocType === '样衣退回单' || asset.sourceDocType === '样衣处置单'
          ? '/pcs/samples/return'
          : asset.sourceDocType === '首版样衣打样任务'
            ? '/pcs/samples/first-sample'
            : asset.sourceDocType === '产前版样衣任务'
              ? '/pcs/samples/pre-production'
              : '/pcs/samples/ledger'

    return {
      sampleAssetId: asset.sampleAssetId,
      sampleCode: asset.sampleCode,
      sampleName: asset.sampleName,
      sampleType: asset.sampleType || '样衣',
      categoryName: project?.categoryName || '-',
      templateType: project?.styleType || '未归类',
      projectId: asset.projectId || null,
      projectCode: asset.projectCode || null,
      projectName: asset.projectName || null,
      status: asset.inventoryStatus,
      currentLocation: getCurrentLocation(asset.locationDisplay, asset.locationType),
      locationDetail: asset.locationDisplay,
      occupancyType,
      occupiedBy: occupancyType === '无' ? null : asset.custodianName || latestEvent?.operatorName || null,
      occupiedFor: occupancyType === '无' ? null : asset.workItemTypeName || latestEvent?.sourceDocType || null,
      occupiedUntil,
      inTransit: Boolean(transit),
      transit,
      anomaly,
      relatedWorkItemName: asset.workItemTypeName || null,
      relatedWorkItemRoute: asset.projectId && asset.projectNodeId ? `/pcs/projects/${asset.projectId}/work-items/${asset.projectNodeId}` : null,
      sourceDocCode: asset.sourceDocCode,
      sourceDocRoute,
      updatedAt: asset.updatedAt,
      updatedBy: asset.updatedBy,
      recentEvents,
    }
  })
}

function getLocationOptions(items: InventorySampleViewModel[]): string[] {
  return ['全部', ...Array.from(new Set(items.map((item) => item.currentLocation)))]
}

function getTemplateOptions(items: InventorySampleViewModel[]): string[] {
  return ['全部', ...Array.from(new Set(items.map((item) => item.templateType)))]
}

function getFilteredSamples(): InventorySampleViewModel[] {
  const items = buildInventoryViewModels()
  const search = state.filters.search.trim().toLowerCase()
  return items.filter((sample) => {
    if (search) {
      const haystack = [
        sample.sampleCode,
        sample.sampleName,
        sample.projectCode || '',
        sample.projectName || '',
        sample.sourceDocCode,
        sample.transit?.trackingNo || '',
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(search)) return false
    }
    if (state.filters.status !== '全部' && sample.status !== state.filters.status) return false
    if (state.filters.location !== '全部' && sample.currentLocation !== state.filters.location) return false
    if (state.filters.template !== '全部' && sample.templateType !== state.filters.template) return false
    if (state.filters.showAnomalyOnly && !sample.anomaly) return false
    if (state.filters.showTransitOverdueOnly && !(sample.transit && sample.transit.overdue)) return false
    if (state.filters.showTodayReturnOnly) {
      if (!(sample.occupancyType === '占用' && sample.occupiedUntil && sample.occupiedUntil.slice(0, 10) === getTodayDateText())) {
        return false
      }
    }

    if (state.filters.quickFilter === 'available' && sample.status !== '在库可用') return false
    if (state.filters.quickFilter === 'reserved' && sample.status !== '预占锁定') return false
    if (state.filters.quickFilter === 'occupied' && sample.status !== '借出占用') return false
    if (state.filters.quickFilter === 'inTransit' && !sample.inTransit) return false
    if (state.filters.quickFilter === 'anomaly' && !sample.anomaly) return false

    return true
  })
}

function getSummary(items: InventorySampleViewModel[]) {
  return {
    total: items.length,
    available: items.filter((item) => item.status === '在库可用').length,
    reserved: items.filter((item) => item.status === '预占锁定').length,
    occupied: items.filter((item) => item.status === '借出占用').length,
    inTransit: items.filter((item) => item.inTransit).length,
    anomaly: items.filter((item) => Boolean(item.anomaly)).length,
  }
}

function renderHeader(): string {
  return `
    <section>
      <p class="text-xs text-slate-500">商品中心 / 样衣管理</p>
      <h1 class="mt-1 text-2xl font-semibold text-slate-900">样衣库存</h1>
      <p class="mt-1 text-sm text-slate-500">以样衣资产为主视角查看当前库存状态、位置、占用、在途和异常情况。</p>
    </section>
  `
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
      <div class="flex items-start justify-between gap-3">
        <p class="text-sm text-blue-800">${escapeHtml(state.notice)}</p>
        <button type="button" class="inline-flex h-7 items-center rounded-md px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-sample-inventory-action="close-notice">关闭</button>
      </div>
    </section>
  `
}

function renderFilters(items: InventorySampleViewModel[]): string {
  const locationOptions = getLocationOptions(items)
  const templateOptions = getTemplateOptions(items)

  return `
    <section class="rounded-lg border bg-white p-4">
      <div class="space-y-4">
        <div class="grid gap-4 md:grid-cols-4">
          <label class="space-y-1">
            <span class="text-xs text-slate-500">搜索样衣</span>
            <div class="relative">
              <i data-lucide="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"></i>
              <input
                class="h-10 w-full rounded-md border border-slate-200 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="搜索样衣编号 / 名称 / 项目 / 来源单据"
                value="${escapeHtml(state.filters.search)}"
                data-pcs-sample-inventory-field="search"
              />
            </div>
          </label>
          <label class="space-y-1">
            <span class="text-xs text-slate-500">状态</span>
            <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-sample-inventory-field="status">
              ${['全部', '在库可用', '预占锁定', '借出占用', '在途待签收', '维修中', '待处置', '已退货', '已处置']
                .map((status) => `<option value="${status}" ${state.filters.status === status ? 'selected' : ''}>${escapeHtml(status === '全部' ? '全部状态' : status)}</option>`)
                .join('')}
            </select>
          </label>
          <label class="space-y-1">
            <span class="text-xs text-slate-500">位置</span>
            <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-sample-inventory-field="location">
              ${locationOptions.map((location) => `<option value="${escapeHtml(location)}" ${state.filters.location === location ? 'selected' : ''}>${escapeHtml(location === '全部' ? '全部位置' : location)}</option>`).join('')}
            </select>
          </label>
          <label class="space-y-1">
            <span class="text-xs text-slate-500">模板类型</span>
            <select class="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" data-pcs-sample-inventory-field="template">
              ${templateOptions.map((template) => `<option value="${escapeHtml(template)}" ${state.filters.template === template ? 'selected' : ''}>${escapeHtml(template === '全部' ? '全部类型' : template)}</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex flex-wrap items-center gap-6">
            <label class="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" ${state.filters.showAnomalyOnly ? 'checked' : ''} data-pcs-sample-inventory-action="toggle-anomaly-only" />
              只看异常
            </label>
            <label class="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" ${state.filters.showTransitOverdueOnly ? 'checked' : ''} data-pcs-sample-inventory-action="toggle-transit-overdue" />
              只看在途超时
            </label>
            <label class="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" ${state.filters.showTodayReturnOnly ? 'checked' : ''} data-pcs-sample-inventory-action="toggle-today-return" />
              今日需归还
            </label>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-inventory-action="reset">重置</button>
            <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-inventory-action="refresh">
              <i data-lucide="refresh-cw" class="h-4 w-4"></i>刷新
            </button>
          </div>
        </div>
      </div>
    </section>
  `
}

function renderSummary(items: InventorySampleViewModel[]): string {
  const summary = getSummary(items)
  const cards = [
    { key: 'all' as QuickFilterKey, label: '总量', value: summary.total, icon: 'package', tone: 'bg-blue-50 text-blue-700' },
    { key: 'available' as QuickFilterKey, label: '在库可用', value: summary.available, icon: 'check-circle', tone: 'bg-emerald-50 text-emerald-700' },
    { key: 'reserved' as QuickFilterKey, label: '预占', value: summary.reserved, icon: 'lock', tone: 'bg-violet-50 text-violet-700' },
    { key: 'occupied' as QuickFilterKey, label: '占用', value: summary.occupied, icon: 'users', tone: 'bg-orange-50 text-orange-700' },
    { key: 'inTransit' as QuickFilterKey, label: '在途', value: summary.inTransit, icon: 'truck', tone: 'bg-blue-50 text-blue-700' },
    { key: 'anomaly' as QuickFilterKey, label: '异常', value: summary.anomaly, icon: 'alert-triangle', tone: 'bg-rose-50 text-rose-700' },
  ]

  return `
    <section class="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      ${cards
        .map(
          (card) => `
            <button
              type="button"
              class="${escapeHtml(
                toClassName(
                  'rounded-lg border bg-white p-4 text-left transition hover:bg-slate-50',
                  state.filters.quickFilter === card.key ? 'ring-2 ring-blue-500' : '',
                ),
              )}"
              data-pcs-sample-inventory-action="set-quick-filter"
              data-value="${escapeHtml(card.key)}"
            >
              <div class="flex items-center gap-3">
                <div class="${escapeHtml(toClassName('flex h-10 w-10 items-center justify-center rounded-lg', card.tone))}">
                  <i data-lucide="${escapeHtml(card.icon)}" class="h-5 w-5"></i>
                </div>
                <div>
                  <p class="text-2xl font-bold text-slate-900">${card.value}</p>
                  <p class="text-sm text-slate-500">${escapeHtml(card.label)}</p>
                </div>
              </div>
            </button>
          `,
        )
        .join('')}
    </section>
  `
}

function renderTable(items: InventorySampleViewModel[]): string {
  return `
    <section class="rounded-lg border bg-white">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-3">样衣编号 / 名称</th>
              <th class="px-4 py-3">所属项目</th>
              <th class="px-4 py-3">状态</th>
              <th class="px-4 py-3">当前位置</th>
              <th class="px-4 py-3">占用 / 预占</th>
              <th class="px-4 py-3">在途信息</th>
              <th class="px-4 py-3">异常</th>
              <th class="px-4 py-3">最近更新</th>
              <th class="px-4 py-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${
              items.length === 0
                ? `
                  <tr>
                    <td colspan="9" class="px-4 py-10 text-center text-sm text-slate-500">暂无符合条件的样衣库存。</td>
                  </tr>
                `
                : items
                    .map(
                      (sample) => `
                        <tr class="cursor-pointer hover:bg-slate-50/70" data-pcs-sample-inventory-action="open-detail" data-sample-asset-id="${escapeHtml(sample.sampleAssetId)}">
                          <td class="px-4 py-3">
                            <div>
                              <p class="font-medium text-slate-900">${escapeHtml(sample.sampleCode)}</p>
                              <div class="mt-1 flex flex-wrap items-center gap-2">
                                <span class="text-sm text-slate-600">${escapeHtml(sample.sampleName)}</span>
                                <span class="inline-flex rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">${escapeHtml(sample.templateType)}</span>
                              </div>
                            </div>
                          </td>
                          <td class="px-4 py-3">
                            ${
                              sample.projectId
                                ? `<button type="button" class="text-left text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(sample.projectId)}">${escapeHtml(sample.projectCode || sample.projectName || '')}</button><p class="mt-1 text-xs text-slate-500">${escapeHtml(sample.projectName || '')}</p>`
                                : '<span class="text-sm text-slate-500">公共样衣</span>'
                            }
                          </td>
                          <td class="px-4 py-3">${getStatusBadge(sample.status)}</td>
                          <td class="px-4 py-3">
                            <p class="text-sm text-slate-900">${escapeHtml(sample.currentLocation)}</p>
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(sample.locationDetail)}</p>
                          </td>
                          <td class="px-4 py-3">
                            ${
                              sample.occupancyType !== '无'
                                ? `
                                  <p class="text-sm font-medium text-slate-900">${escapeHtml(sample.occupiedBy || '-')}</p>
                                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(sample.occupiedFor || '-')} · 至 ${escapeHtml(sample.occupiedUntil || '-')}</p>
                                `
                                : '<span class="text-sm text-slate-400">-</span>'
                            }
                          </td>
                          <td class="px-4 py-3">
                            ${
                              sample.transit
                                ? `
                                  <p class="text-sm font-medium text-slate-900">${escapeHtml(sample.transit.trackingNo)}</p>
                                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(sample.transit.from)} → ${escapeHtml(sample.transit.to)}</p>
                                  <p class="mt-1 text-xs ${sample.transit.overdue ? 'text-rose-600' : 'text-slate-500'}">${escapeHtml(sample.transit.etaText)}</p>
                                `
                                : '<span class="text-sm text-slate-400">-</span>'
                            }
                          </td>
                          <td class="px-4 py-3">
                            ${
                              sample.anomaly
                                ? `
                                  <span class="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">${escapeHtml(sample.anomaly.type)}</span>
                                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(sample.anomaly.level)}级</p>
                                `
                                : '<span class="text-sm text-slate-400">-</span>'
                            }
                          </td>
                          <td class="px-4 py-3">
                            <p class="text-sm text-slate-600">${escapeHtml(formatDateTime(sample.updatedAt))}</p>
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(sample.updatedBy || '-')}</p>
                          </td>
                          <td class="px-4 py-3 text-center">
                            <div class="flex items-center justify-center gap-2">
                              <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" data-pcs-sample-inventory-action="open-detail" data-sample-asset-id="${escapeHtml(sample.sampleAssetId)}">
                                <i data-lucide="eye" class="h-4 w-4"></i>
                              </button>
                              <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" data-nav="/pcs/samples/ledger">
                                <i data-lucide="external-link" class="h-4 w-4"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      `,
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderDrawerShell(title: string, body: string): string {
  return `
    <div class="fixed inset-0 z-50 flex justify-end">
      <button type="button" class="absolute inset-0 bg-slate-900/35" data-pcs-sample-inventory-action="close-detail"></button>
      <section class="relative flex h-full w-full max-w-3xl flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div class="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p class="text-xs text-slate-500">样衣库存详情</p>
            <h2 class="mt-1 text-lg font-semibold text-slate-900">${escapeHtml(title)}</h2>
          </div>
          <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-inventory-action="close-detail">关闭</button>
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-5">${body}</div>
      </section>
    </div>
  `
}

function renderDetailDrawer(items: InventorySampleViewModel[]): string {
  if (!state.detailSampleAssetId) return ''
  const sample = items.find((item) => item.sampleAssetId === state.detailSampleAssetId)
  if (!sample) return ''

  const actions: string[] = []
  if (sample.inTransit) {
    actions.push(`
      <button type="button" class="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-pcs-sample-inventory-action="sign-receive" data-sample-asset-id="${escapeHtml(sample.sampleAssetId)}">
        <i data-lucide="check-circle" class="mr-2 h-4 w-4"></i>标记签收
      </button>
    `)
  }
  if (sample.occupancyType === '预占') {
    actions.push(`
      <button type="button" class="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-inventory-action="release-reserve" data-sample-asset-id="${escapeHtml(sample.sampleAssetId)}">
        <i data-lucide="unlock" class="mr-2 h-4 w-4"></i>释放预占
      </button>
    `)
  }
  if (sample.occupancyType === '占用') {
    actions.push(`
      <button type="button" class="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-inventory-action="mark-return" data-sample-asset-id="${escapeHtml(sample.sampleAssetId)}">
        <i data-lucide="rotate-ccw" class="mr-2 h-4 w-4"></i>标记归还
      </button>
    `)
  }
  actions.push(`
    <button type="button" class="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-inventory-action="init-maintenance" data-sample-asset-id="${escapeHtml(sample.sampleAssetId)}">
      <i data-lucide="wrench" class="mr-2 h-4 w-4"></i>发起维修
    </button>
  `)

  const body = `
    <div class="space-y-6">
      <section class="rounded-lg border bg-slate-50 p-4">
        <div class="flex flex-wrap items-center gap-2">
          ${getStatusBadge(sample.status)}
          <span class="inline-flex rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">${escapeHtml(sample.sampleType)}</span>
          <span class="inline-flex rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">${escapeHtml(sample.templateType)}</span>
        </div>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p class="text-xs text-slate-500">样衣编号</p>
            <p class="mt-1 font-medium text-slate-900">${escapeHtml(sample.sampleCode)}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">样衣名称</p>
            <p class="mt-1 font-medium text-slate-900">${escapeHtml(sample.sampleName)}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">商品项目</p>
            ${
              sample.projectId
                ? `<button type="button" class="mt-1 text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(sample.projectId)}">${escapeHtml(sample.projectCode || sample.projectName || '')}</button><p class="mt-1 text-xs text-slate-500">${escapeHtml(sample.projectName || '')}</p>`
                : '<p class="mt-1 font-medium text-slate-500">公共样衣</p>'
            }
          </div>
          <div>
            <p class="text-xs text-slate-500">关联工作项</p>
            ${
              sample.relatedWorkItemRoute
                ? `<button type="button" class="mt-1 text-left font-medium text-blue-700 hover:underline" data-nav="${escapeHtml(sample.relatedWorkItemRoute)}">${escapeHtml(sample.relatedWorkItemName || '查看工作项')}</button>`
                : `<p class="mt-1 font-medium text-slate-900">${escapeHtml(sample.relatedWorkItemName || '-')}</p>`
            }
          </div>
        </div>
      </section>

      <section class="grid gap-4 md:grid-cols-2">
        <div class="rounded-lg border bg-white p-4">
          <p class="text-sm font-medium text-slate-900">当前位置</p>
          <p class="mt-3 text-sm text-slate-900">${escapeHtml(sample.currentLocation)}</p>
          <p class="mt-1 text-xs text-slate-500">${escapeHtml(sample.locationDetail)}</p>
        </div>
        <div class="rounded-lg border bg-white p-4">
          <p class="text-sm font-medium text-slate-900">占用快照</p>
          ${
            sample.occupancyType === '无'
              ? '<p class="mt-3 text-sm text-slate-500">当前无占用或预占。</p>'
              : `
                  <p class="mt-3 text-sm text-slate-900">${escapeHtml(sample.occupiedBy || '-')}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(sample.occupancyType)} · ${escapeHtml(sample.occupiedFor || '-')}</p>
                  <p class="mt-1 text-xs text-slate-500">至 ${escapeHtml(sample.occupiedUntil || '-')}</p>
                `
          }
        </div>
        ${
          sample.transit
            ? `
              <div class="rounded-lg border bg-white p-4">
                <p class="text-sm font-medium text-slate-900">在途信息</p>
                <p class="mt-3 text-sm text-slate-900">${escapeHtml(sample.transit.trackingNo)}</p>
                <p class="mt-1 text-xs text-slate-500">${escapeHtml(sample.transit.from)} → ${escapeHtml(sample.transit.to)}</p>
                <p class="mt-1 text-xs ${sample.transit.overdue ? 'text-rose-600' : 'text-slate-500'}">${escapeHtml(sample.transit.etaText)}</p>
              </div>
            `
            : ''
        }
        ${
          sample.anomaly
            ? `
              <div class="rounded-lg border border-rose-200 bg-rose-50 p-4">
                <p class="text-sm font-medium text-rose-700">异常</p>
                <p class="mt-3 text-sm font-medium text-rose-700">${escapeHtml(sample.anomaly.type)} / ${escapeHtml(sample.anomaly.level)}级</p>
                <p class="mt-1 text-xs text-rose-700">${escapeHtml(sample.anomaly.note)}</p>
              </div>
            `
            : ''
        }
      </section>

      <section class="rounded-lg border bg-white p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-slate-900">快捷操作</p>
            <p class="mt-1 text-xs text-slate-500">操作会同步更新样衣库存快照，并补记一条对应的台账留痕。</p>
          </div>
          <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/samples/ledger">查看完整台账</button>
        </div>
        <div class="mt-4 grid gap-3 md:grid-cols-2">
          ${actions.join('')}
        </div>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-slate-900">最近台账事件</p>
            <p class="mt-1 text-xs text-slate-500">按时间倒序展示该样衣最近 8 条库存与流转留痕。</p>
          </div>
          <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/samples/ledger">
            查看完整台账
            <i data-lucide="external-link" class="h-4 w-4"></i>
          </button>
        </div>
        <div class="mt-4 space-y-3">
          ${sample.recentEvents
            .map(
              (event) => `
                <div class="flex gap-3 rounded-lg border border-slate-200 p-3">
                  <div class="mt-0.5 text-slate-400"><i data-lucide="calendar" class="h-4 w-4"></i></div>
                  <div class="flex-1">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <p class="text-sm font-medium text-slate-900">${escapeHtml(event.eventName)}</p>
                      <p class="text-xs text-slate-500">${escapeHtml(formatDateTime(event.businessDate))}</p>
                    </div>
                    <p class="mt-1 text-xs text-slate-500">${escapeHtml(event.locationBefore)} → ${escapeHtml(event.locationAfter)}</p>
                    <p class="mt-1 text-xs text-slate-500">${escapeHtml(event.note || '-')}</p>
                    <p class="mt-1 text-xs text-slate-400">${escapeHtml(event.operatorName || '-')} · ${escapeHtml(event.sourceDocCode || event.sourceDocId)}</p>
                  </div>
                </div>
              `,
            )
            .join('')}
        </div>
      </section>
    </div>
  `

  return renderDrawerShell(`${sample.sampleCode} · 样衣详情(快照)`, body)
}

export function renderPcsSampleInventoryPage(): string {
  ensurePageDataReady()
  const items = getFilteredSamples()
  return `
    <div class="space-y-6">
      ${renderNotice()}
      ${renderHeader()}
      ${renderFilters(buildInventoryViewModels())}
      ${renderSummary(buildInventoryViewModels())}
      ${renderTable(items)}
      ${renderDetailDrawer(buildInventoryViewModels())}
    </div>
  `
}

export function handlePcsSampleInventoryInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-sample-inventory-field]')
  if (!fieldNode) return false
  const field = fieldNode.dataset.pcsSampleInventoryField
  if (!field) return false

  if (field === 'search' && fieldNode instanceof HTMLInputElement) {
    state.filters.search = fieldNode.value
    return true
  }
  if (field === 'status' && fieldNode instanceof HTMLSelectElement) {
    state.filters.status = fieldNode.value
    return true
  }
  if (field === 'location' && fieldNode instanceof HTMLSelectElement) {
    state.filters.location = fieldNode.value
    return true
  }
  if (field === 'template' && fieldNode instanceof HTMLSelectElement) {
    state.filters.template = fieldNode.value
    return true
  }
  return false
}

export function handlePcsSampleInventoryEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pcs-sample-inventory-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsSampleInventoryAction
  if (!action) return false

  if (action === 'close-notice') {
    state.notice = null
    return true
  }
  if (action === 'refresh') {
    ensurePageDataReady()
    state.notice = '已刷新样衣库存数据。'
    return true
  }
  if (action === 'reset') {
    state.filters = {
      search: '',
      status: '全部',
      location: '全部',
      template: '全部',
      showAnomalyOnly: false,
      showTransitOverdueOnly: false,
      showTodayReturnOnly: false,
      quickFilter: 'all',
    }
    return true
  }
  if (action === 'toggle-anomaly-only') {
    state.filters.showAnomalyOnly = !state.filters.showAnomalyOnly
    return true
  }
  if (action === 'toggle-transit-overdue') {
    state.filters.showTransitOverdueOnly = !state.filters.showTransitOverdueOnly
    return true
  }
  if (action === 'toggle-today-return') {
    state.filters.showTodayReturnOnly = !state.filters.showTodayReturnOnly
    return true
  }
  if (action === 'set-quick-filter') {
    const value = (actionNode.dataset.value as QuickFilterKey) || 'all'
    const nextQuickFilter = state.filters.quickFilter === value ? 'all' : value
    state.filters.quickFilter = nextQuickFilter
    state.filters.status = '全部'
    state.filters.showAnomalyOnly = false
    if (nextQuickFilter === 'available') state.filters.status = '在库可用'
    if (nextQuickFilter === 'reserved') state.filters.status = '预占锁定'
    if (nextQuickFilter === 'occupied') state.filters.status = '借出占用'
    if (nextQuickFilter === 'inTransit') state.filters.status = '在途待签收'
    if (nextQuickFilter === 'anomaly') state.filters.showAnomalyOnly = true
    return true
  }
  if (action === 'open-detail') {
    const sampleAssetId = actionNode.dataset.sampleAssetId
    if (!sampleAssetId) return true
    state.detailSampleAssetId = sampleAssetId
    return true
  }
  if (action === 'close-detail') {
    state.detailSampleAssetId = null
    return true
  }
  if (action === 'sign-receive') {
    const sampleAssetId = actionNode.dataset.sampleAssetId
    if (!sampleAssetId) return true
    const asset = getSampleAssetById(sampleAssetId)
    return applyInventoryAction(sampleAssetId, {
      noticePrefix: '已标记签收',
      eventType: 'DELIVER_SIGNED',
      inventoryStatusAfter: '在库待核对',
      availabilityAfter: '不可用',
      locationType: '仓库',
      locationDisplay: `${asset?.responsibleSite || '深圳'}收货区`,
      custodianType: '仓管',
      custodianName: `${asset?.responsibleSite || '深圳'}仓管`,
      operatorName: `${asset?.responsibleSite || '深圳'}仓管`,
      note: '库存签收完成，已进入待核对状态。',
      sourceDocType: asset?.sourceDocType || '',
      sourceDocCodePrefix: 'INV-SIGN',
    })
  }
  if (action === 'release-reserve') {
    const sampleAssetId = actionNode.dataset.sampleAssetId
    if (!sampleAssetId) return true
    const asset = getSampleAssetById(sampleAssetId)
    return applyInventoryAction(sampleAssetId, {
      noticePrefix: '已释放预占',
      eventType: 'CANCEL_RESERVE',
      inventoryStatusAfter: '在库可用',
      availabilityAfter: '可用',
      locationType: asset?.locationType || '仓库',
      locationDisplay: asset?.locationDisplay || '深圳主仓待分配库位',
      custodianType: '仓管',
      custodianName: `${asset?.responsibleSite || '深圳'}仓管`,
      operatorName: `${asset?.responsibleSite || '深圳'}仓管`,
      note: '库存页释放预占，样衣恢复在库可用。',
      sourceDocType: '样衣使用申请',
      sourceDocCodePrefix: 'INV-REL',
    })
  }
  if (action === 'mark-return') {
    const sampleAssetId = actionNode.dataset.sampleAssetId
    if (!sampleAssetId) return true
    const asset = getSampleAssetById(sampleAssetId)
    return applyInventoryAction(sampleAssetId, {
      noticePrefix: '已标记归还',
      eventType: 'RETURN_CHECKIN',
      inventoryStatusAfter: '在库可用',
      availabilityAfter: '可用',
      locationType: '仓库',
      locationDisplay: `${asset?.responsibleSite || '深圳'}收货区`,
      custodianType: '仓管',
      custodianName: `${asset?.responsibleSite || '深圳'}仓管`,
      operatorName: `${asset?.responsibleSite || '深圳'}仓管`,
      note: '库存页完成归还入库，样衣恢复可用。',
      sourceDocType: '样衣使用申请',
      sourceDocCodePrefix: 'INV-RET',
    })
  }
  if (action === 'init-maintenance') {
    const sampleAssetId = actionNode.dataset.sampleAssetId
    if (!sampleAssetId) return true
    const asset = getSampleAssetById(sampleAssetId)
    return applyInventoryAction(sampleAssetId, {
      noticePrefix: '已发起维修申请',
      eventType: 'STOCKTAKE',
      inventoryStatusAfter: '维修中',
      availabilityAfter: '不可用',
      locationType: '仓库',
      locationDisplay: `${asset?.responsibleSite || '深圳'}维修区`,
      custodianType: '内部人员',
      custodianName: '样衣维修组',
      operatorName: '样衣维修组',
      note: '库存页登记维修流转，样衣转入维修中。',
      sourceDocType: '盘点单',
      sourceDocCodePrefix: 'INV-REP',
    })
  }

  return false
}

export function isPcsSampleInventoryDialogOpen(): boolean {
  return Boolean(state.detailSampleAssetId)
}

export function resetPcsSampleInventoryState(): void {
  state.notice = null
  state.filters = {
    search: '',
    status: '全部',
    location: '全部',
    template: '全部',
    showAnomalyOnly: false,
    showTransitOverdueOnly: false,
    showTodayReturnOnly: false,
    quickFilter: 'all',
  }
  state.detailSampleAssetId = null
}
