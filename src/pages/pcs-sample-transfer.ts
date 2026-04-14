import { ensurePcsProjectDemoDataReady } from './pcs-projects.ts'
import { ensurePcsSampleDemoDataReady } from '../data/pcs-sample-demo.ts'
import { getSampleAssetById, listSampleAssets } from '../data/pcs-sample-asset-repository.ts'
import { listSampleLedgerEvents, listSampleLedgerEventsBySample } from '../data/pcs-sample-ledger-repository.ts'
import type { SampleLedgerEventRecord, SampleLedgerEventType } from '../data/pcs-sample-types.ts'
import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'

type TransferCategoryKey = 'all' | 'inbound' | 'borrow' | 'logistics' | 'return' | 'inventory' | 'disposal'
type RiskFlagKey = 'IN_TRANSIT_TIMEOUT' | 'OVERDUE_RETURN' | 'PENDING_CHECK'

interface TransferRiskMeta {
  label: string
  className: string
}

interface TransferRecordViewModel {
  eventId: string
  eventCode: string
  eventType: SampleLedgerEventType
  eventLabel: string
  category: TransferCategoryKey
  categoryLabel: string
  eventTime: string
  sampleAssetId: string
  sampleCode: string
  sampleName: string
  fromDisplay: string
  toDisplay: string
  responsibleSite: string
  projectId: string
  projectCode: string
  projectName: string
  projectNodeId: string
  workItemTypeName: string
  sourceDocCode: string
  sourceDocType: string
  sourceModule: string
  operatorName: string
  note: string
  currentStatus: string
  riskFlags: RiskFlagKey[]
}

interface TransferPageState {
  notice: string | null
  filters: {
    search: string
    category: TransferCategoryKey
    eventType: string
    site: string
    onlyRisk: boolean
  }
  detailEventId: string | null
}

const CATEGORY_META: Record<TransferCategoryKey, { label: string; className: string }> = {
  all: { label: '全部类型', className: 'bg-slate-100 text-slate-700' },
  inbound: { label: '入库流', className: 'bg-sky-100 text-sky-700' },
  borrow: { label: '借用流', className: 'bg-violet-100 text-violet-700' },
  logistics: { label: '物流流', className: 'bg-blue-100 text-blue-700' },
  return: { label: '退货流', className: 'bg-amber-100 text-amber-700' },
  inventory: { label: '盘点纠正', className: 'bg-emerald-100 text-emerald-700' },
  disposal: { label: '处置流', className: 'bg-rose-100 text-rose-700' },
}

const EVENT_META: Record<SampleLedgerEventType, { label: string; className: string; category: TransferCategoryKey }> = {
  RECEIVE_ARRIVAL: { label: '到样签收', className: 'bg-sky-100 text-sky-700', category: 'inbound' },
  CHECKIN_VERIFY: { label: '核对入库', className: 'bg-emerald-100 text-emerald-700', category: 'inbound' },
  RESERVE_LOCK: { label: '预占锁定', className: 'bg-violet-100 text-violet-700', category: 'borrow' },
  CANCEL_RESERVE: { label: '取消预占', className: 'bg-slate-100 text-slate-700', category: 'borrow' },
  CHECKOUT_BORROW: { label: '领用出库', className: 'bg-orange-100 text-orange-700', category: 'borrow' },
  RETURN_CHECKIN: { label: '归还入库', className: 'bg-emerald-100 text-emerald-700', category: 'borrow' },
  SHIP_OUT: { label: '寄出', className: 'bg-blue-100 text-blue-700', category: 'logistics' },
  DELIVER_SIGNED: { label: '签收', className: 'bg-cyan-100 text-cyan-700', category: 'logistics' },
  STOCKTAKE: { label: '盘点', className: 'bg-emerald-100 text-emerald-700', category: 'inventory' },
  DISPOSAL: { label: '处置', className: 'bg-rose-100 text-rose-700', category: 'disposal' },
  RETURN_SUPPLIER: { label: '退货', className: 'bg-amber-100 text-amber-700', category: 'return' },
}

const RISK_META: Record<RiskFlagKey, TransferRiskMeta> = {
  IN_TRANSIT_TIMEOUT: { label: '在途超时', className: 'bg-rose-100 text-rose-700' },
  OVERDUE_RETURN: { label: '超期未归还', className: 'bg-orange-100 text-orange-700' },
  PENDING_CHECK: { label: '待核对', className: 'bg-amber-100 text-amber-700' },
}

const state: TransferPageState = {
  notice: null,
  filters: {
    search: '',
    category: 'all',
    eventType: 'all',
    site: 'all',
    onlyRisk: false,
  },
  detailEventId: null,
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

function getTodayDateText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function extractDueDate(note: string): string | null {
  const matched = note.match(/20\d{2}-\d{2}-\d{2}(?: \d{2}:\d{2})?/)
  return matched ? matched[0] : null
}

function hoursBetween(startText: string, endText: string): number {
  const start = parseDateTime(startText)
  const end = parseDateTime(endText)
  if (!start || !end) return 0
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 3600000))
}

function buildTransferRecord(event: SampleLedgerEventRecord): TransferRecordViewModel {
  const asset = getSampleAssetById(event.sampleAssetId)
  const riskFlags: RiskFlagKey[] = []
  if (
    event.eventType === 'SHIP_OUT' &&
    asset &&
    asset.inventoryStatus === '在途待签收' &&
    hoursBetween(event.businessDate, `${getTodayDateText()} 23:59`) > 48
  ) {
    riskFlags.push('IN_TRANSIT_TIMEOUT')
  }
  const dueDate = extractDueDate(event.note)
  if (
    event.eventType === 'CHECKOUT_BORROW' &&
    asset &&
    asset.inventoryStatus === '借出占用' &&
    dueDate &&
    dueDate.slice(0, 10) < getTodayDateText()
  ) {
    riskFlags.push('OVERDUE_RETURN')
  }
  if ((event.eventType === 'RECEIVE_ARRIVAL' || event.eventType === 'DELIVER_SIGNED') && event.inventoryStatusAfter === '在库待核对') {
    riskFlags.push('PENDING_CHECK')
  }

  return {
    eventId: event.ledgerEventId,
    eventCode: event.ledgerEventCode,
    eventType: event.eventType,
    eventLabel: EVENT_META[event.eventType].label,
    category: EVENT_META[event.eventType].category,
    categoryLabel: CATEGORY_META[EVENT_META[event.eventType].category].label,
    eventTime: event.businessDate,
    sampleAssetId: event.sampleAssetId,
    sampleCode: event.sampleCode,
    sampleName: event.sampleName,
    fromDisplay: event.locationBefore,
    toDisplay: event.locationAfter,
    responsibleSite: event.responsibleSite,
    projectId: event.projectId,
    projectCode: event.projectCode,
    projectName: event.projectName,
    projectNodeId: event.projectNodeId,
    workItemTypeName: event.workItemTypeName,
    sourceDocCode: event.sourceDocCode,
    sourceDocType: event.sourceDocType,
    sourceModule: event.sourceModule,
    operatorName: event.operatorName,
    note: event.note,
    currentStatus: asset?.inventoryStatus || event.inventoryStatusAfter,
    riskFlags,
  }
}

function getTransferRecords(): TransferRecordViewModel[] {
  ensurePageDataReady()
  return listSampleLedgerEvents().map(buildTransferRecord).sort((a, b) => b.eventTime.localeCompare(a.eventTime))
}

function getFilteredRecords(): TransferRecordViewModel[] {
  const keyword = state.filters.search.trim().toLowerCase()
  return getTransferRecords().filter((item) => {
    if (keyword) {
      const haystack = [
        item.eventCode,
        item.sampleCode,
        item.sampleName,
        item.projectCode,
        item.projectName,
        item.workItemTypeName,
        item.sourceDocCode,
        item.operatorName,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    if (state.filters.category !== 'all' && item.category !== state.filters.category) return false
    if (state.filters.eventType !== 'all' && item.eventType !== state.filters.eventType) return false
    if (state.filters.site !== 'all' && item.responsibleSite !== state.filters.site) return false
    if (state.filters.onlyRisk && item.riskFlags.length === 0) return false
    return true
  })
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="font-medium">样衣流转记录</p>
          <p class="mt-1">${escapeHtml(state.notice)}</p>
        </div>
        <button type="button" class="inline-flex h-7 items-center rounded-md px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-sample-transfer-action="close-notice">关闭</button>
      </div>
    </section>
  `
}

function renderHeader(): string {
  return `
    <section class="rounded-xl border bg-white px-6 py-5 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs text-slate-500">商品中心 / 样衣资产管理</p>
          <h1 class="mt-1 text-2xl font-semibold text-slate-900">样衣流转记录</h1>
          <p class="mt-1 text-sm text-slate-500">按流转事件查看样衣从到样、借用、物流、退货到处置的全过程留痕。</p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-transfer-action="refresh"><i data-lucide="refresh-cw" class="h-4 w-4"></i>刷新</button>
          <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-transfer-action="export"><i data-lucide="download" class="h-4 w-4"></i>导出</button>
        </div>
      </div>
    </section>
  `
}

function renderFilters(): string {
  const records = getTransferRecords()
  const eventTypes = Array.from(new Set(records.map((item) => item.eventType)))
  const sites = Array.from(new Set(records.map((item) => item.responsibleSite)))
  return `
    <section class="rounded-xl border bg-white px-6 py-5 shadow-sm">
      <div class="grid gap-4 xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>搜索</span>
          <input type="search" class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" placeholder="样衣编号 / 项目 / 工作项 / 运单号 / 保管人" value="${escapeHtml(state.filters.search)}" data-pcs-sample-transfer-field="search" />
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>流转类型</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-sample-transfer-field="category">
            ${Object.entries(CATEGORY_META)
              .map(([key, meta]) => `<option value="${escapeHtml(key)}" ${state.filters.category === key ? 'selected' : ''}>${escapeHtml(meta.label)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>事件类型</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-sample-transfer-field="eventType">
            <option value="all">全部事件</option>
            ${eventTypes
              .map((type) => `<option value="${escapeHtml(type)}" ${state.filters.eventType === type ? 'selected' : ''}>${escapeHtml(EVENT_META[type].label)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="flex flex-col gap-2 text-sm text-slate-600">
          <span>责任站点</span>
          <select class="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-blue-500" data-pcs-sample-transfer-field="site">
            <option value="all">全部站点</option>
            ${sites
              .map((site) => `<option value="${escapeHtml(site)}" ${state.filters.site === site ? 'selected' : ''}>${escapeHtml(site)}</option>`)
              .join('')}
          </select>
        </label>
        <div class="flex items-end justify-between gap-3">
          <label class="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" ${state.filters.onlyRisk ? 'checked' : ''} data-pcs-sample-transfer-action="toggle-only-risk" />
            <span>只看风险记录</span>
          </label>
          <button type="button" class="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-transfer-action="reset">重置</button>
        </div>
      </div>
    </section>
  `
}

function renderSummary(): string {
  const records = getFilteredRecords()
  const total = records.length
  const inbound = records.filter((item) => item.category === 'inbound').length
  const borrow = records.filter((item) => item.category === 'borrow').length
  const logistics = records.filter((item) => item.category === 'logistics').length
  const risk = records.filter((item) => item.riskFlags.length > 0).length
  const today = records.filter((item) => item.eventTime.slice(0, 10) === getTodayDateText()).length
  const cards = [
    { label: '全部流转', value: total, helper: '样衣全量事件留痕', tone: 'border-slate-200 bg-white text-slate-900' },
    { label: '入库流', value: inbound, helper: '到样签收与核对入库', tone: 'border-sky-200 bg-sky-50 text-sky-700' },
    { label: '借用流', value: borrow, helper: '预占、领用与归还', tone: 'border-violet-200 bg-violet-50 text-violet-700' },
    { label: '物流流', value: logistics, helper: '跨站点与在途签收', tone: 'border-blue-200 bg-blue-50 text-blue-700' },
    { label: '风险记录', value: risk, helper: '在途超时、超期未归还、待核对', tone: 'border-rose-200 bg-rose-50 text-rose-700' },
    { label: '今日新增', value: today, helper: '今日新增流转事件', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  ]
  return `
    <section class="grid gap-4 xl:grid-cols-6">
      ${cards
        .map(
          (card) => `
            <article class="${escapeHtml(toClassName('rounded-xl border px-5 py-4 shadow-sm', card.tone))}">
              <p class="text-sm font-medium">${escapeHtml(card.label)}</p>
              <p class="mt-3 text-3xl font-semibold">${escapeHtml(card.value)}</p>
              <p class="mt-2 text-xs opacity-80">${escapeHtml(card.helper)}</p>
            </article>
          `,
        )
        .join('')}
    </section>
  `
}

function renderRiskBadges(riskFlags: RiskFlagKey[]): string {
  if (riskFlags.length === 0) return '<span class="text-xs text-slate-400">-</span>'
  return riskFlags
    .map((flag) => `<span class="${escapeHtml(toClassName('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', RISK_META[flag].className))}">${escapeHtml(RISK_META[flag].label)}</span>`)
    .join('')
}

function renderTable(): string {
  const records = getFilteredRecords()
  return `
    <section class="rounded-xl border bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-3">流转编号</th>
              <th class="px-4 py-3">样衣</th>
              <th class="px-4 py-3">类型 / 事件</th>
              <th class="px-4 py-3">位置变更</th>
              <th class="px-4 py-3">项目 / 工作项</th>
              <th class="px-4 py-3">风险</th>
              <th class="px-4 py-3">时间</th>
              <th class="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${
              records.length === 0
                ? '<tr><td colspan="8" class="px-4 py-12 text-center text-sm text-slate-500">当前筛选条件下暂无样衣流转记录。</td></tr>'
                : records
                    .map(
                      (record) => `
                        <tr class="hover:bg-slate-50/80">
                          <td class="px-4 py-3 align-top">
                            <p class="font-medium text-slate-900">${escapeHtml(record.eventCode)}</p>
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(record.sourceDocCode || '-')}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <button type="button" class="text-left font-medium text-blue-700 hover:underline" data-pcs-sample-transfer-action="open-detail" data-event-id="${escapeHtml(record.eventId)}">${escapeHtml(record.sampleCode)}</button>
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(record.sampleName)}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <div class="flex flex-wrap gap-2">
                              <span class="${escapeHtml(toClassName('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', CATEGORY_META[record.category].className))}">${escapeHtml(record.categoryLabel)}</span>
                              <span class="${escapeHtml(toClassName('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', EVENT_META[record.eventType].className))}">${escapeHtml(record.eventLabel)}</span>
                            </div>
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(record.currentStatus)}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            <p class="text-slate-900">${escapeHtml(record.fromDisplay)}</p>
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(record.toDisplay)}</p>
                          </td>
                          <td class="px-4 py-3 align-top">
                            ${
                              record.projectId
                                ? `<button type="button" class="text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(record.projectId)}">${escapeHtml(record.projectCode || record.projectName)}</button>
                                   <p class="mt-1 text-xs text-slate-500">${escapeHtml(record.workItemTypeName || '-')}</p>`
                                : '<p class="text-slate-500">未绑定正式商品项目</p>'
                            }
                          </td>
                          <td class="px-4 py-3 align-top"><div class="flex flex-wrap gap-2">${renderRiskBadges(record.riskFlags)}</div></td>
                          <td class="px-4 py-3 align-top">
                            <p class="text-slate-900">${escapeHtml(formatDateTime(record.eventTime))}</p>
                            <p class="mt-1 text-xs text-slate-500">${escapeHtml(record.operatorName || '-')}</p>
                          </td>
                          <td class="px-4 py-3 align-top text-right">
                            <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50" data-pcs-sample-transfer-action="open-detail" data-event-id="${escapeHtml(record.eventId)}">查看详情</button>
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
    <div class="fixed inset-0 z-40 flex justify-end">
      <button type="button" class="absolute inset-0 bg-slate-900/35" data-pcs-sample-transfer-action="close-detail"></button>
      <section class="relative flex h-full w-full max-w-3xl flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div class="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p class="text-xs text-slate-500">样衣流转详情</p>
            <h2 class="mt-1 text-lg font-semibold text-slate-900">${escapeHtml(title)}</h2>
          </div>
          <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-sample-transfer-action="close-detail">关闭</button>
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-5">${body}</div>
      </section>
    </div>
  `
}

function renderDetailDrawer(): string {
  if (!state.detailEventId) return ''
  const record = getTransferRecords().find((item) => item.eventId === state.detailEventId)
  if (!record) return ''
  const timeline = listSampleLedgerEventsBySample(record.sampleAssetId)
    .slice(0, 10)
    .map(
      (event) => `
        <div class="rounded-lg border border-slate-200 p-3">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-medium text-slate-900">${escapeHtml(EVENT_META[event.eventType].label)}</p>
            <p class="text-xs text-slate-500">${escapeHtml(formatDateTime(event.businessDate))}</p>
          </div>
          <p class="mt-1 text-xs text-slate-500">${escapeHtml(event.locationBefore)} → ${escapeHtml(event.locationAfter)}</p>
          <p class="mt-1 text-xs text-slate-500">${escapeHtml(event.note || '-')}</p>
        </div>
      `,
    )
    .join('')

  const body = `
    <div class="space-y-6">
      <section class="rounded-lg border bg-slate-50 p-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="${escapeHtml(toClassName('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', CATEGORY_META[record.category].className))}">${escapeHtml(record.categoryLabel)}</span>
          <span class="${escapeHtml(toClassName('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', EVENT_META[record.eventType].className))}">${escapeHtml(record.eventLabel)}</span>
          <span class="inline-flex rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">${escapeHtml(record.currentStatus)}</span>
        </div>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p class="text-xs text-slate-500">样衣编号</p>
            <p class="mt-1 font-medium text-slate-900">${escapeHtml(record.sampleCode)}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">样衣名称</p>
            <p class="mt-1 font-medium text-slate-900">${escapeHtml(record.sampleName)}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">来源位置</p>
            <p class="mt-1 text-slate-900">${escapeHtml(record.fromDisplay)}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">去向位置</p>
            <p class="mt-1 text-slate-900">${escapeHtml(record.toDisplay)}</p>
          </div>
        </div>
      </section>

      <section class="grid gap-4 md:grid-cols-2">
        <div class="rounded-lg border bg-white p-4">
          <p class="text-sm font-medium text-slate-900">业务关联</p>
          <div class="mt-3 space-y-3 text-sm">
            <div>
              <p class="text-xs text-slate-500">责任站点</p>
              <p class="mt-1 text-slate-900">${escapeHtml(record.responsibleSite)}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">项目</p>
              ${
                record.projectId
                  ? `<button type="button" class="mt-1 text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(record.projectId)}">${escapeHtml(record.projectCode || record.projectName)}</button>
                     <p class="mt-1 text-xs text-slate-500">${escapeHtml(record.projectName || '-')}</p>`
                  : '<p class="mt-1 text-slate-500">未绑定正式商品项目</p>'
              }
            </div>
            <div>
              <p class="text-xs text-slate-500">关联工作项</p>
              ${
                record.projectId && record.projectNodeId
                  ? `<button type="button" class="mt-1 text-left font-medium text-blue-700 hover:underline" data-nav="/pcs/projects/${escapeHtml(record.projectId)}/work-items/${escapeHtml(record.projectNodeId)}">${escapeHtml(record.workItemTypeName || '-')}</button>`
                  : `<p class="mt-1 text-slate-900">${escapeHtml(record.workItemTypeName || '-')}</p>`
              }
            </div>
          </div>
        </div>
        <div class="rounded-lg border bg-white p-4">
          <p class="text-sm font-medium text-slate-900">单据与处理</p>
          <div class="mt-3 space-y-3 text-sm">
            <div>
              <p class="text-xs text-slate-500">来源模块 / 单据</p>
              <p class="mt-1 text-slate-900">${escapeHtml(record.sourceModule)} / ${escapeHtml(record.sourceDocCode || '-')}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">处理人</p>
              <p class="mt-1 text-slate-900">${escapeHtml(record.operatorName || '-')}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">处理说明</p>
              <p class="mt-1 text-slate-900">${escapeHtml(record.note || '-')}</p>
            </div>
          </div>
        </div>
      </section>

      ${
        record.riskFlags.length > 0
          ? `
            <section class="rounded-lg border border-rose-200 bg-rose-50 p-4">
              <p class="text-sm font-medium text-rose-700">风险提示</p>
              <div class="mt-3 flex flex-wrap gap-2">
                ${record.riskFlags
                  .map((flag) => `<span class="${escapeHtml(toClassName('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', RISK_META[flag].className))}">${escapeHtml(RISK_META[flag].label)}</span>`)
                  .join('')}
              </div>
            </section>
          `
          : ''
      }

      <section class="rounded-lg border bg-white p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-slate-900">同样衣时间线</p>
            <p class="mt-1 text-xs text-slate-500">展示该样衣最近 10 条流转记录，便于回看位置与责任变化。</p>
          </div>
          <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/samples/ledger">查看完整台账</button>
        </div>
        <div class="mt-4 space-y-3">${timeline}</div>
      </section>
    </div>
  `

  return renderDrawerShell(`${record.sampleCode} · ${record.eventLabel}`, body)
}

export function renderPcsSampleTransferPage(): string {
  ensurePageDataReady()
  return `
    <div class="space-y-6">
      ${renderNotice()}
      ${renderHeader()}
      ${renderFilters()}
      ${renderSummary()}
      ${renderTable()}
      ${renderDetailDrawer()}
    </div>
  `
}

export function handlePcsSampleTransferInput(target: Element): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pcs-sample-transfer-field]')
  if (!fieldNode) return false
  const field = fieldNode.dataset.pcsSampleTransferField
  if (!field) return false

  if (field === 'search' && fieldNode instanceof HTMLInputElement) {
    state.filters.search = fieldNode.value
    return true
  }
  if (field === 'category' && fieldNode instanceof HTMLSelectElement) {
    state.filters.category = fieldNode.value as TransferCategoryKey
    return true
  }
  if (field === 'eventType' && fieldNode instanceof HTMLSelectElement) {
    state.filters.eventType = fieldNode.value
    return true
  }
  if (field === 'site' && fieldNode instanceof HTMLSelectElement) {
    state.filters.site = fieldNode.value
    return true
  }
  return false
}

export function handlePcsSampleTransferEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pcs-sample-transfer-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsSampleTransferAction
  if (!action) return false

  if (action === 'close-notice') {
    state.notice = null
    return true
  }
  if (action === 'refresh') {
    ensurePageDataReady()
    state.notice = '已刷新样衣流转记录。'
    return true
  }
  if (action === 'export') {
    state.notice = `已导出 ${getFilteredRecords().length} 条样衣流转记录。`
    return true
  }
  if (action === 'reset') {
    state.filters = { search: '', category: 'all', eventType: 'all', site: 'all', onlyRisk: false }
    return true
  }
  if (action === 'toggle-only-risk') {
    state.filters.onlyRisk = !state.filters.onlyRisk
    return true
  }
  if (action === 'open-detail') {
    const eventId = actionNode.dataset.eventId
    if (!eventId) return true
    state.detailEventId = eventId
    return true
  }
  if (action === 'close-detail') {
    state.detailEventId = null
    return true
  }
  return false
}

export function isPcsSampleTransferDialogOpen(): boolean {
  return Boolean(state.detailEventId)
}

export function resetPcsSampleTransferState(): void {
  state.notice = null
  state.detailEventId = null
  state.filters = { search: '', category: 'all', eventType: 'all', site: 'all', onlyRisk: false }
}
