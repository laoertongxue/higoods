import { productionOrders } from '../data/fcs/production-orders'
import { appStore } from '../state/store'
import {
  buildCapacityStatusBadge,
  buildCapacityCalendarData,
  buildCapacityBottleneckData,
  buildCapacityRiskData,
  buildFactoryCalendarData,
  type CapacityBottleneckCraftRow,
  type CapacityBottleneckDateRow,
  type CapacityBottleneckTab as CapacityBottleneckViewTab,
  type CapacityBottleneckUnallocatedTaskRow,
  type CapacityBottleneckUnscheduledTaskRow,
  type CapacityCalendarComparisonRow,
  type CapacityCalendarUnallocatedRow,
  type CapacityCalendarUnscheduledRow,
  type CapacityRiskOrderRow,
  type CapacityRiskTaskRow,
  type FactoryCalendarData,
  type FactoryCalendarRow,
  type FactoryCalendarSourceRow,
  type FactoryCalendarWindowDays,
  filterCapacityRiskTaskRows,
  summarizeProductionOrderRisk,
} from '../data/fcs/capacity-calendar'
import {
  createCapacityCalendarOverride,
  expireCapacityCalendarOverride,
  getCapacityCalendarOverrideById,
  listCapacityCalendarOverrides,
  removeCapacityCalendarOverride,
  updateCapacityCalendarOverride,
  type CapacityCalendarOverrideInput,
} from '../data/fcs/capacity-calendar-overrides'
import {
  listLegacyLikeDeductionBasisForTailPages,
  listLegacyLikeDyePrintOrdersForTailPages,
  listLegacyLikeExceptionsForTailPages,
  listLegacyLikeProcessTasksForTailPages,
  listLegacyLikeQualityInspectionsForTailPages,
} from '../data/fcs/page-adapters/long-tail-pages-adapter'
import { listFactoryCapacityEntries } from '../data/fcs/factory-capacity-profile-mock'
import { listFactoryMasterRecords } from '../data/fcs/factory-master-store'
import { syncDispatchCapacityUsageLedger } from './dispatch-board/context'
import { escapeHtml, toClassName } from '../utils'

const processTasks = listLegacyLikeProcessTasksForTailPages()
const legacyLikeQualityInspections = listLegacyLikeQualityInspectionsForTailPages()
const legacyLikeDeductionBasisItems = listLegacyLikeDeductionBasisForTailPages()
const legacyLikeDyePrintOrders = listLegacyLikeDyePrintOrdersForTailPages()
const legacyLikeExceptions = listLegacyLikeExceptionsForTailPages()

type Tone = 'default' | 'secondary' | 'destructive' | 'outline'

type OverviewTab = 'comparison' | 'unallocated' | 'unscheduled'
type RiskTab = 'task' | 'order'
type BottleneckTab = CapacityBottleneckViewTab
type FactoryCalendarWindowFilter = FactoryCalendarWindowDays

type CapacityPoliciesEditorMode = 'create' | 'edit' | ''

interface CapacityPoliciesFormState {
  factoryId: string
  processCode: string
  craftCode: string
  startDate: string
  endDate: string
  reason: string
  note: string
}

interface CapacityState {
  overviewKeyword: string
  overviewTab: OverviewTab
  riskKeyword: string
  riskTab: RiskTab
  riskProcessCode: string
  riskCraftCode: string
  riskConclusion: string
  riskWindowDays: FactoryCalendarWindowFilter
  bottleneckKeyword: string
  bottleneckTab: BottleneckTab
  bottleneckWindowDays: FactoryCalendarWindowFilter
  bottleneckProcessCode: string
  bottleneckCraftCode: string
  bottleneckCraftDetailKey: string
  bottleneckDateDetailKey: string
  constraintsFactoryId: string
  constraintsWindowDays: FactoryCalendarWindowFilter
  constraintsProcessCode: string
  constraintsCraftCode: string
  constraintsCurrentPage: number
  constraintsDetailRowKey: string
  policiesEditorMode: CapacityPoliciesEditorMode
  policiesEditingOverrideId: string
  policiesForm: CapacityPoliciesFormState
  policiesFormError: string
  policiesNotice: string
  querySignature: string
  routeContext: {
    source: string
    keyword: string
    orderIds: string[]
  }
}

const state: CapacityState = {
  overviewKeyword: '',
  overviewTab: 'comparison',
  riskKeyword: '',
  riskTab: 'task',
  riskProcessCode: '',
  riskCraftCode: '',
  riskConclusion: '',
  riskWindowDays: 15,
  bottleneckKeyword: '',
  bottleneckTab: 'craft',
  bottleneckWindowDays: 15,
  bottleneckProcessCode: '',
  bottleneckCraftCode: '',
  bottleneckCraftDetailKey: '',
  bottleneckDateDetailKey: '',
  constraintsFactoryId: '',
  constraintsWindowDays: 15,
  constraintsProcessCode: '',
  constraintsCraftCode: '',
  constraintsCurrentPage: 1,
  constraintsDetailRowKey: '',
  policiesEditorMode: '',
  policiesEditingOverrideId: '',
  policiesForm: {
    factoryId: '',
    processCode: '',
    craftCode: '',
    startDate: '',
    endDate: '',
    reason: '',
    note: '',
  },
  policiesFormError: '',
  policiesNotice: '',
  querySignature: '',
  routeContext: {
    source: '',
    keyword: '',
    orderIds: [],
  },
}

const FACTORY_CALENDAR_PAGE_SIZE = 12

const TASK_STATUS_ZH: Record<string, string> = {
  NOT_STARTED: '未开始',
  IN_PROGRESS: '进行中',
  DONE: '已完成',
  BLOCKED: '生产暂停',
  CANCELLED: '已取消',
}

const toneClassMap: Record<Tone, string> = {
  default: 'border-blue-200 bg-blue-50 text-blue-700',
  secondary: 'border-slate-200 bg-slate-100 text-slate-700',
  destructive: 'border-red-200 bg-red-50 text-red-700',
  outline: 'border-slate-300 bg-transparent text-slate-600',
}

function renderBadge(text: string, tone: Tone = 'secondary', className = ''): string {
  return `<span class="inline-flex items-center rounded border px-2 py-0.5 text-xs ${toneClassMap[tone]} ${className}">${escapeHtml(text)}</span>`
}

function formatCapacityScopeText(processName: string | undefined, craftName: string | undefined): string {
  const process = (processName ?? '').trim()
  const craft = (craftName ?? '').trim()
  if (!process) return craft
  if (!craft || craft === process) return process
  return `${process} - ${craft}`
}

function renderStatCard(label: string, value: number, valueClass = ''): string {
  return `
    <article class="rounded-lg border bg-card">
      <div class="px-4 pb-4 pt-4">
        <p class="text-xs font-medium leading-snug text-muted-foreground">${escapeHtml(label)}</p>
        <p class="mt-1 text-2xl font-bold ${valueClass}">${value}</p>
      </div>
    </article>
  `
}

function renderMetricStatCard(label: string, value: string, valueClass = ''): string {
  return `
    <article class="rounded-lg border bg-card">
      <div class="px-4 pb-4 pt-4">
        <p class="text-xs font-medium leading-snug text-muted-foreground">${escapeHtml(label)}</p>
        <p class="mt-1 text-2xl font-bold ${valueClass}">${escapeHtml(value)}</p>
      </div>
    </article>
  `
}

function renderPageHint(text: string): string {
  return `<div class="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">${escapeHtml(text)}</div>`
}

function renderCapacityStatusBadge(status: CapacityCalendarComparisonRow['status'] | FactoryCalendarRow['status']): string {
  const meta = buildCapacityStatusBadge(status)
  const tone: Tone =
    meta.tone === 'danger'
      ? 'destructive'
      : meta.tone === 'warning'
        ? 'default'
        : meta.tone === 'normal'
          ? 'secondary'
          : 'outline'
  return renderBadge(meta.label, tone)
}

function createEmptyPoliciesForm(): CapacityPoliciesFormState {
  return {
    factoryId: '',
    processCode: '',
    craftCode: '',
    startDate: '',
    endDate: '',
    reason: '',
    note: '',
  }
}

function buildPoliciesFormFromOverride(overrideId: string): CapacityPoliciesFormState {
  const record = getCapacityCalendarOverrideById(overrideId)
  if (!record) return createEmptyPoliciesForm()
  return {
    factoryId: record.factoryId,
    processCode: record.processCode ?? '',
    craftCode: record.craftCode ?? '',
    startDate: record.startDate,
    endDate: record.endDate,
    reason: record.reason,
    note: record.note ?? '',
  }
}

function getPoliciesFactoryOptions() {
  return listFactoryMasterRecords()
    .filter((factory) => factory.status === 'active')
    .map((factory) => ({
      value: factory.id,
      label: `${factory.name}（${factory.code}）`,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'))
}

function getPoliciesProcessOptions(factoryId: string) {
  const processMap = new Map<string, { value: string; label: string }>()
  for (const { row } of listFactoryCapacityEntries(factoryId)) {
    if (!processMap.has(row.processCode)) {
      processMap.set(row.processCode, {
        value: row.processCode,
        label: row.processName,
      })
    }
  }
  return [...processMap.values()].sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'))
}

function getPoliciesCraftOptions(factoryId: string, processCode: string) {
  return listFactoryCapacityEntries(factoryId)
    .filter(({ row }) => row.processCode === processCode)
    .map(({ row }) => ({
      value: row.craftCode,
      label: row.craftName,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'))
}

function openPoliciesEditor(mode: CapacityPoliciesEditorMode, overrideId = ''): void {
  state.policiesEditorMode = mode
  state.policiesEditingOverrideId = overrideId
  if (mode === 'edit' && overrideId) {
    state.policiesForm = buildPoliciesFormFromOverride(overrideId)
  } else {
    const nextForm = createEmptyPoliciesForm()
    nextForm.factoryId = getPoliciesFactoryOptions()[0]?.value ?? ''
    state.policiesForm = nextForm
  }
  state.policiesFormError = ''
  state.policiesNotice = ''
}

function closePoliciesEditor(): void {
  state.policiesEditorMode = ''
  state.policiesEditingOverrideId = ''
  state.policiesForm = createEmptyPoliciesForm()
  state.policiesFormError = ''
}

function buildPoliciesOverrideInput(): CapacityCalendarOverrideInput {
  return {
    factoryId: state.policiesForm.factoryId,
    processCode: state.policiesForm.processCode || undefined,
    craftCode: state.policiesForm.craftCode || undefined,
    startDate: state.policiesForm.startDate,
    endDate: state.policiesForm.endDate,
    overrideType: 'PAUSE',
    reason: state.policiesForm.reason,
    note: state.policiesForm.note || undefined,
  }
}

function resolvePoliciesOverrideStateLabel(startDate: string, endDate: string): { label: string; tone: Tone } {
  const today = new Date().toISOString().slice(0, 10)
  if (endDate < today) return { label: '已过期', tone: 'outline' }
  if (startDate > today) return { label: '未来生效', tone: 'secondary' }
  return { label: '生效中', tone: 'default' }
}

function getCurrentCapacityQueryString(): string {
  const pathname = appStore.getState().pathname
  const [, query = ''] = pathname.split('?')
  return query
}

function getCurrentCapacitySearchParams(): URLSearchParams {
  return new URLSearchParams(getCurrentCapacityQueryString())
}

function syncCapacityStateFromRoute(): void {
  const pathname = appStore.getState().pathname
  if (state.querySignature === pathname) return

  const params = getCurrentCapacitySearchParams()
  const pathOnly = pathname.split('?')[0]
  const source = params.get('source') || ''
  const keyword = params.get('keyword') || ''
  const orderId = params.get('orderId') || ''
  const orderIds = (params.get('orderIds') || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const scopedOrderIds = Array.from(new Set([orderId, ...orderIds].filter(Boolean)))
  const tab = params.get('tab') || ''

  state.routeContext = {
    source,
    keyword,
    orderIds: scopedOrderIds,
  }

  if (pathOnly === '/fcs/capacity/overview') {
    state.overviewKeyword = keyword
    if (tab === 'comparison' || tab === 'unallocated' || tab === 'unscheduled') state.overviewTab = tab
  }

  state.querySignature = pathname
}

function renderCapacityRouteContextBanner(page: 'overview' | 'constraints'): string {
  if (state.routeContext.source !== 'cuttable-pool') return ''

  if (page === 'overview') {
    const summary = state.routeContext.keyword
      ? `来自可裁排产：已带入关键词 ${state.routeContext.keyword}`
      : state.routeContext.orderIds.length
        ? `来自可裁排产：已带入 ${state.routeContext.orderIds.length} 个生产单`
        : '来自可裁排产'
    return `<div class="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">${escapeHtml(summary)}</div>`
  }

  const summary = state.routeContext.orderIds.length
    ? `来自可裁排产：已带入 ${state.routeContext.orderIds.length} 个生产单约束上下文`
    : '来自可裁排产'

  return `<div class="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">${escapeHtml(summary)}</div>`
}

function renderTabButton(page: string, tab: string, current: string, label: string): string {
  const active = current === tab
  return `
    <button
      data-capacity-action="switch-tab"
      data-page="${page}"
      data-tab="${tab}"
      class="rounded-md border px-3 py-1.5 text-sm transition ${
        active
          ? 'border-blue-300 bg-blue-50 text-blue-700'
          : 'border-slate-200 bg-white text-muted-foreground hover:bg-muted'
      }"
    >
      ${escapeHtml(label)}
    </button>
  `
}

function taskStatusText(status: string): string {
  return TASK_STATUS_ZH[status] ?? status
}

function orderFactoryName(orderId: string): string {
  const order = productionOrders.find((item) => item.productionOrderId === orderId)
  return order?.mainFactorySnapshot?.name ?? order?.mainFactoryId ?? '—'
}

function getOrderDyeStatus(orderId: string): string {
  const orderDyes = legacyLikeDyePrintOrders.filter((item) => item.productionOrderId === orderId)
  if (orderDyes.length === 0) return '无染印'
  if (orderDyes.some((item) => item.availableQty > 0)) return '可继续'
  return '生产暂停'
}

function getOrderQcPendingCount(orderId: string): number {
  return legacyLikeQualityInspections.filter(
    (item) => item.productionOrderId === orderId && item.status !== 'CLOSED',
  ).length
}

function getOrderOpenExceptionCount(orderId: string): number {
  return legacyLikeExceptions.filter(
    (item) => item.relatedOrderIds.includes(orderId) && item.caseStatus !== 'CLOSED',
  ).length
}

function includesKeyword(value: string, keyword: string): boolean {
  return value.toLowerCase().includes(keyword)
}

function toLower(value: string | undefined | null): string {
  return (value ?? '').toLowerCase()
}

function formatSamValue(value: number): string {
  if (!Number.isFinite(value)) return '--'
  return Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })
}

function matchesOverviewKeyword(keyword: string, ...parts: Array<string | number | undefined>): boolean {
  if (!keyword) return true
  return parts.some((part) => String(part ?? '').toLowerCase().includes(keyword))
}

function getVisibleComparisonRows(rows: CapacityCalendarComparisonRow[], keyword: string): CapacityCalendarComparisonRow[] {
  const filtered = rows.filter((row) =>
    matchesOverviewKeyword(
      keyword,
      row.date,
      row.factoryId,
      row.factoryName,
      row.processCode,
      row.processName,
      row.craftCode,
      row.craftName,
      ...row.taskIds,
    ),
  )

  if (keyword) return filtered.slice(0, 120)
  return filtered.slice(0, 80)
}

function renderCapacityComparisonTable(rows: CapacityCalendarComparisonRow[], keyword: string): string {
  const visibleRows = getVisibleComparisonRows(rows, keyword)
  if (visibleRows.length === 0) {
    return '<tr><td colspan="9" class="px-3 py-10 text-center text-sm text-muted-foreground">当前筛选条件下暂无工厂供需对比明细</td></tr>'
  }

  return visibleRows
    .map((row) => {
      const balanceClass = row.remainingSam < 0 ? 'text-red-600' : 'text-green-700'

      return `
        <tr
          class="border-b last:border-0"
          data-capacity-comparison-row="${escapeHtml(`${row.date}::${row.factoryId}::${row.craftCode}`)}"
          data-capacity-overload="${row.overload ? 'true' : 'false'}"
        >
          <td class="px-3 py-3 text-sm">${escapeHtml(row.date)}</td>
          <td class="px-3 py-3 text-sm">
            <div class="font-medium text-foreground">${escapeHtml(row.factoryName)}</div>
            <div class="text-xs text-muted-foreground">${escapeHtml(row.factoryId)}</div>
          </td>
          <td class="px-3 py-3 text-sm">
            <div>${escapeHtml(row.processName)}</div>
            <div class="text-xs text-muted-foreground">${escapeHtml(row.craftName)}</div>
          </td>
          <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(row.supplySam))}</td>
          <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(row.committedSam))}</td>
          <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(row.frozenSam))}</td>
          <td class="px-3 py-3 text-right text-sm font-medium ${balanceClass}">${escapeHtml(formatSamValue(row.remainingSam))}</td>
          <td class="px-3 py-3 text-sm">
            <div>${renderCapacityStatusBadge(row.status)}</div>
            <div class="mt-1 max-w-[220px] text-xs leading-5 text-muted-foreground">${escapeHtml(row.statusReason)}</div>
          </td>
          <td class="px-3 py-3 text-sm">
            <div>占用 ${row.commitmentCount} / 冻结 ${row.freezeCount}</div>
            <div class="text-xs text-muted-foreground">${escapeHtml(row.taskIds.slice(0, 2).join('、') || '—')}${row.taskIds.length > 2 ? ' 等' : ''}</div>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderUnallocatedRows(rows: CapacityCalendarUnallocatedRow[], keyword: string): string {
  const filtered = rows
    .filter((row) =>
      matchesOverviewKeyword(
        keyword,
        row.date,
        row.processCode,
        row.processName,
        row.craftCode,
        row.craftName,
        ...row.taskIds,
        ...row.assignmentStatuses,
      ),
    )
    .slice(0, 50)

  if (filtered.length === 0) {
    return '<tr><td colspan="5" class="px-3 py-8 text-center text-sm text-muted-foreground">暂无待分配需求</td></tr>'
  }

  return filtered
    .map((row) => `
      <tr class="border-b last:border-0" data-capacity-unallocated-row="${escapeHtml(`${row.date}::${row.craftCode}`)}">
        <td class="px-3 py-3 text-sm">${escapeHtml(row.date)}</td>
        <td class="px-3 py-3 text-sm">
          <div>${escapeHtml(row.processName)}</div>
          <div class="text-xs text-muted-foreground">${escapeHtml(row.craftName)}</div>
        </td>
        <td class="px-3 py-3 text-right text-sm font-medium text-orange-700">${escapeHtml(formatSamValue(row.demandSam))}</td>
        <td class="px-3 py-3 text-center text-sm">${row.taskCount}</td>
        <td class="px-3 py-3 text-sm text-muted-foreground">${escapeHtml(row.assignmentStatuses.join(' / '))}</td>
      </tr>
    `)
    .join('')
}

function renderUnscheduledRows(rows: CapacityCalendarUnscheduledRow[], keyword: string): string {
  const filtered = rows
    .filter((row) =>
      matchesOverviewKeyword(
        keyword,
        row.taskId,
        row.productionOrderId,
        row.demandType,
        row.processCode,
        row.processName,
        row.craftCode,
        row.craftName,
        row.assignmentStatus,
        row.assignmentMode,
        row.factoryName,
      ),
    )
    .slice(0, 50)

  if (filtered.length === 0) {
    return '<tr><td colspan="7" class="px-3 py-8 text-center text-sm text-muted-foreground">暂无未排期需求</td></tr>'
  }

  return filtered
    .map((row) => `
      <tr class="border-b last:border-0" data-capacity-unscheduled-row="${escapeHtml(row.taskId)}">
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(row.taskId)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(row.productionOrderId)}</td>
        <td class="px-3 py-3">${renderBadge(row.demandType, row.demandType === '待分配需求' ? 'outline' : row.demandType === '已冻结需求' ? 'secondary' : 'default')}</td>
        <td class="px-3 py-3 text-sm">
          <div>${escapeHtml(row.processName)}</div>
          <div class="text-xs text-muted-foreground">${escapeHtml(row.craftName)}</div>
        </td>
        <td class="px-3 py-3 text-sm">${escapeHtml(row.factoryName)}</td>
        <td class="px-3 py-3 text-right text-sm font-medium text-amber-700">${escapeHtml(formatSamValue(row.standardSamTotal))}</td>
        <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(row.reason)}</td>
      </tr>
    `)
    .join('')
}

function renderFactoryCalendarPagination(totalRows: number): string {
  const totalPages = Math.max(1, Math.ceil(totalRows / FACTORY_CALENDAR_PAGE_SIZE))
  if (totalPages <= 1) return ''

  const start = Math.max(1, state.constraintsCurrentPage - 2)
  const end = Math.min(totalPages, start + 4)
  const pages = Array.from({ length: end - start + 1 }, (_, index) => start + index)

  return `
    <div class="flex items-center justify-between border-t px-4 py-3">
      <div class="text-xs text-muted-foreground">第 ${state.constraintsCurrentPage} 页，共 ${totalPages} 页</div>
      <div class="flex items-center gap-1">
        <button
          data-capacity-action="factory-calendar-prev-page"
          class="rounded-md border px-3 py-1 text-sm ${state.constraintsCurrentPage === 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}"
        >上一页</button>
        ${pages
          .map(
            (page) => `
              <button
                data-capacity-action="factory-calendar-goto-page"
                data-page="${page}"
                class="rounded-md border px-3 py-1 text-sm ${page === state.constraintsCurrentPage ? 'bg-blue-600 text-white' : 'hover:bg-muted'}"
              >${page}</button>
            `,
          )
          .join('')}
        <button
          data-capacity-action="factory-calendar-next-page"
          class="rounded-md border px-3 py-1 text-sm ${state.constraintsCurrentPage === totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}"
        >下一页</button>
      </div>
    </div>
  `
}

function renderFactoryCalendarMainTable(rows: FactoryCalendarRow[], selectedRowKey: string): string {
  if (rows.length === 0) {
    return '<tr><td colspan="10" class="px-3 py-10 text-center text-sm text-muted-foreground">当前筛选条件下暂无工厂日历明细</td></tr>'
  }

  const start = (state.constraintsCurrentPage - 1) * FACTORY_CALENDAR_PAGE_SIZE
  const pagedRows = rows.slice(start, start + FACTORY_CALENDAR_PAGE_SIZE)

  return pagedRows
    .map((row) => {
      const isActive = row.rowKey === selectedRowKey
      const balanceClass = row.remainingSam < 0 ? 'text-red-600' : row.remainingSam === 0 ? 'text-amber-700' : 'text-green-700'

      return `
        <tr
          class="border-b last:border-0 ${isActive ? 'bg-blue-50/60' : 'hover:bg-muted/20'} cursor-pointer"
          data-capacity-action="open-factory-calendar-detail"
          data-row-key="${escapeHtml(row.rowKey)}"
        >
          <td class="px-3 py-3 text-sm">${escapeHtml(row.date)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.processName)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.craftName)}</td>
          <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(row.supplySam))}</td>
          <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(row.committedSam))}</td>
          <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(row.frozenSam))}</td>
          <td class="px-3 py-3 text-right text-sm font-medium ${balanceClass}">${escapeHtml(formatSamValue(row.remainingSam))}</td>
          <td class="px-3 py-3 text-sm">
            <div>${renderCapacityStatusBadge(row.status)}</div>
            <div class="mt-1 max-w-[220px] text-xs leading-5 text-muted-foreground">${escapeHtml(row.statusReason)}</div>
          </td>
          <td class="px-3 py-3 text-center text-sm">${row.committedTaskCount}</td>
          <td class="px-3 py-3 text-center text-sm">${row.frozenTaskCount}</td>
        </tr>
      `
    })
    .join('')
}

function renderFactoryCalendarSourceTable(sources: FactoryCalendarSourceRow[], emptyText: string): string {
  if (sources.length === 0) {
    return `<div class="rounded-xl bg-slate-50 px-3 py-5 text-center text-sm text-muted-foreground">${escapeHtml(emptyText)}</div>`
  }

  return `
    <div class="overflow-x-auto rounded-xl bg-slate-50/90" data-testid="factory-calendar-source-table">
      <table class="w-full text-sm">
        <thead class="border-b border-slate-200/80 bg-slate-100/80 text-muted-foreground">
          <tr>
            <th class="px-3 py-2 text-left font-medium">任务编号</th>
            <th class="px-3 py-2 text-left font-medium">生产单号</th>
            <th class="px-3 py-2 text-right font-medium">标准工时</th>
            <th class="px-3 py-2 text-left font-medium">时间窗口</th>
            <th class="px-3 py-2 text-left font-medium">对象类型</th>
            <th class="px-3 py-2 text-left font-medium">来源说明</th>
          </tr>
        </thead>
        <tbody>
          ${sources
            .map((source) => `
              <tr class="border-b border-slate-200/80 last:border-0">
                <td class="px-3 py-3">
                  <div class="font-mono text-xs text-foreground">${escapeHtml(source.taskId)}</div>
                  <div class="text-[11px] text-muted-foreground">${escapeHtml(source.sourceTypeLabel)}</div>
                </td>
                <td class="px-3 py-3 text-sm">${escapeHtml(source.productionOrderId)}</td>
                <td class="px-3 py-3 text-right text-sm">
                  <div class="font-medium text-foreground">${escapeHtml(formatSamValue(source.standardSamTotal))}</div>
                  <div class="text-[11px] text-muted-foreground">当日计入 ${escapeHtml(formatSamValue(source.dailySam))}</div>
                </td>
                <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(source.windowText)}</td>
                <td class="px-3 py-3 text-sm">
                  <div>${escapeHtml(source.objectType)}</div>
                  <div class="text-[11px] text-muted-foreground">${escapeHtml(source.allocationUnitId ?? '整任务')}</div>
                </td>
                <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(source.note)}</td>
              </tr>
            `)
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderFactoryCalendarDetailPanel(
  calendar: FactoryCalendarData,
  selectedRow: FactoryCalendarRow | null,
): string {
  if (!selectedRow) {
    return `
      <aside class="border-t border-slate-200 pt-5 text-sm xl:border-l xl:border-t-0 xl:pl-6" data-testid="factory-calendar-detail-panel">
        <h2 class="text-sm font-semibold text-foreground">来源明细</h2>
        <p class="mt-3 text-sm leading-6 text-muted-foreground" data-testid="factory-calendar-detail-empty">选择左侧一条工厂日历记录后，可在这里查看占用和冻结来源。</p>
      </aside>
    `
  }

  return `
    <aside
      class="space-y-4 border-t border-slate-200 pt-5 xl:border-l xl:border-t-0 xl:pl-6"
      data-factory-calendar-detail="${escapeHtml(selectedRow.rowKey)}"
      data-testid="factory-calendar-detail-panel"
    >
      <div class="space-y-1">
        <h2 class="text-sm font-semibold text-foreground">来源明细</h2>
        <p class="text-xs text-muted-foreground">${escapeHtml(calendar.selectedFactoryName)} / ${escapeHtml(selectedRow.date)} / ${escapeHtml(formatCapacityScopeText(selectedRow.processName, selectedRow.craftName))}</p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2" data-testid="factory-calendar-detail-summary">
        <div class="rounded-xl bg-slate-50/90 px-4 py-3">
          <p class="text-xs text-muted-foreground">供给标准工时</p>
          <p class="mt-1 text-lg font-semibold text-foreground">${escapeHtml(formatSamValue(selectedRow.supplySam))}</p>
        </div>
        <div class="rounded-xl bg-slate-50/90 px-4 py-3">
          <p class="text-xs text-muted-foreground">剩余标准工时</p>
          <p class="mt-1 text-lg font-semibold ${selectedRow.remainingSam < 0 ? 'text-red-600' : 'text-green-700'}">${escapeHtml(formatSamValue(selectedRow.remainingSam))}</p>
        </div>
      </div>

      <div class="space-y-2 rounded-xl bg-slate-50/90 px-4 py-3" data-testid="factory-calendar-detail-status">
        <div class="flex items-center gap-2">
          ${renderCapacityStatusBadge(selectedRow.status)}
          <span class="text-sm font-medium text-foreground">当前状态</span>
        </div>
        <p class="text-xs leading-5 text-muted-foreground">${escapeHtml(selectedRow.statusReason)}</p>
      </div>

      <section class="space-y-2 border-t border-slate-200 pt-4" data-testid="factory-calendar-committed-section">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium text-foreground">已占用来源</h3>
          ${renderBadge(`对象 ${selectedRow.committedTaskCount}`, selectedRow.committedTaskCount > 0 ? 'default' : 'outline')}
        </div>
        ${renderFactoryCalendarSourceTable(selectedRow.committedSources, '当前日期下暂无已占用来源。')}
      </section>

      <section class="space-y-2 border-t border-slate-200 pt-4" data-testid="factory-calendar-frozen-section">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium text-foreground">已冻结来源</h3>
          ${renderBadge(`对象 ${selectedRow.frozenTaskCount}`, selectedRow.frozenTaskCount > 0 ? 'secondary' : 'outline')}
        </div>
        ${renderFactoryCalendarSourceTable(selectedRow.frozenSources, '当前日期下暂无已冻结来源。')}
      </section>
    </aside>
  `
}

function getOverviewStats() {
  const orders = productionOrders.length
  const tasks = processTasks.length
  const blocked = processTasks.filter((task) => task.status === 'BLOCKED').length
  const dyePending = legacyLikeDyePrintOrders.filter((dpo) => dpo.availableQty <= 0).length
  const qcPending = legacyLikeQualityInspections.filter((item) => item.status !== 'CLOSED').length
  const settlementReady = legacyLikeDeductionBasisItems.filter((item) => item.settlementReady === true).length

  return { orders, tasks, blocked, dyePending, qcPending, settlementReady }
}

function getOverviewFactoryRows() {
  const map = new Map<
    string,
    {
      factoryId: string
      taskCount: number
      blockedCount: number
      orderIds: Set<string>
      dyeCount: number
      qcPendingCount: number
    }
  >()

  for (const task of processTasks) {
    const factoryId =
      task.assignedFactoryId ??
      productionOrders.find((order) => order.productionOrderId === task.productionOrderId)?.mainFactoryId ??
      '未知工厂'

    if (!map.has(factoryId)) {
      map.set(factoryId, {
        factoryId,
        taskCount: 0,
        blockedCount: 0,
        orderIds: new Set<string>(),
        dyeCount: 0,
        qcPendingCount: 0,
      })
    }

    const row = map.get(factoryId)
    if (!row) continue
    row.taskCount += 1
    row.orderIds.add(task.productionOrderId)
    if (task.status === 'BLOCKED') row.blockedCount += 1
  }

  for (const dpo of legacyLikeDyePrintOrders) {
    const factoryId = dpo.processorFactoryId ?? '未知工厂'
    if (!map.has(factoryId)) {
      map.set(factoryId, {
        factoryId,
        taskCount: 0,
        blockedCount: 0,
        orderIds: new Set<string>(),
        dyeCount: 0,
        qcPendingCount: 0,
      })
    }

    const row = map.get(factoryId)
    if (!row) continue
    row.dyeCount += 1
  }

  for (const qc of legacyLikeQualityInspections.filter((item) => item.status !== 'CLOSED')) {
    const basis = legacyLikeDeductionBasisItems.find(
      (item) => item.sourceRefId === qc.qcId || item.sourceId === qc.qcId,
    )
    const factoryId =
      basis?.factoryId ??
      productionOrders.find((order) => order.productionOrderId === qc.productionOrderId)?.mainFactoryId ??
      '未知工厂'

    if (!map.has(factoryId)) {
      map.set(factoryId, {
        factoryId,
        taskCount: 0,
        blockedCount: 0,
        orderIds: new Set<string>(),
        dyeCount: 0,
        qcPendingCount: 0,
      })
    }

    const row = map.get(factoryId)
    if (!row) continue
    row.qcPendingCount += 1
  }

  return [...map.values()].map((item) => {
    const loadStatus =
      item.blockedCount > 0 ? '存在生产暂停' : item.taskCount >= 10 ? '高占用' : item.taskCount >= 1 ? '正常' : '空闲'

    return {
      factoryId: item.factoryId,
      taskCount: item.taskCount,
      blockedCount: item.blockedCount,
      orderCount: item.orderIds.size,
      dyeCount: item.dyeCount,
      qcPendingCount: item.qcPendingCount,
      loadStatus,
    }
  })
}

function getOverviewOrderRows() {
  return productionOrders.map((order) => {
    const tasks = processTasks.filter((task) => task.productionOrderId === order.productionOrderId)
    const blockedCount = tasks.filter((task) => task.status === 'BLOCKED').length
    const taskCount = tasks.length
    const dyeStatus = getOrderDyeStatus(order.productionOrderId)
    const qcPending = getOrderQcPendingCount(order.productionOrderId)

    const pressure =
      blockedCount > 0
        ? '高风险'
        : qcPending > 0
          ? '待质检'
          : dyeStatus === '生产暂停'
            ? '待进入下一步'
            : taskCount > 0
              ? '可推进'
              : '未启动'

    return {
      productionOrderId: order.productionOrderId,
      mainFactory: order.mainFactorySnapshot?.name ?? order.mainFactoryId ?? '—',
      taskCount,
      blockedCount,
      dyeStatus,
      qcPending,
      pressure,
    }
  })
}

function renderOverviewFactoryTable(keyword: string): string {
  const rows = getOverviewFactoryRows().filter((row) => {
    if (!keyword) return true
    return includesKeyword(toLower(row.factoryId), keyword)
  })

  if (rows.length === 0) {
    return '<tr><td colspan="8" class="px-3 py-10 text-center text-sm text-muted-foreground">暂无工厂产能占用数据</td></tr>'
  }

  return rows
    .map((row) => {
      const loadTone: Tone =
        row.loadStatus === '存在生产暂停'
          ? 'destructive'
          : row.loadStatus === '高占用'
            ? 'default'
            : row.loadStatus === '空闲'
              ? 'outline'
              : 'secondary'

      return `
        <tr class="border-b last:border-0">
          <td class="px-3 py-3 text-sm font-mono">${escapeHtml(row.factoryId)}</td>
          <td class="px-3 py-3 text-center text-sm">${row.taskCount}</td>
          <td class="px-3 py-3 text-center text-sm">${
            row.blockedCount > 0 ? renderBadge(String(row.blockedCount), 'destructive') : '<span class="text-muted-foreground">0</span>'
          }</td>
          <td class="px-3 py-3 text-center text-sm">${row.orderCount}</td>
          <td class="px-3 py-3 text-center text-sm">${row.dyeCount}</td>
          <td class="px-3 py-3 text-center text-sm">${
            row.qcPendingCount > 0 ? renderBadge(String(row.qcPendingCount), 'default') : '<span class="text-muted-foreground">0</span>'
          }</td>
          <td class="px-3 py-3">${renderBadge(row.loadStatus, loadTone)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-1">
              <button data-nav="/fcs/process/task-breakdown" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看任务</button>
              <button data-nav="/fcs/production/orders" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看生产单</button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderOverviewOrderTable(keyword: string): string {
  const rows = getOverviewOrderRows().filter((row) => {
    if (!keyword) return true
    return (
      includesKeyword(toLower(row.productionOrderId), keyword) || includesKeyword(toLower(row.mainFactory), keyword)
    )
  })

  if (rows.length === 0) {
    return '<tr><td colspan="8" class="px-3 py-10 text-center text-sm text-muted-foreground">暂无生产单交付压力数据</td></tr>'
  }

  return rows
    .map((row) => {
      const dyeTone: Tone =
        row.dyeStatus === '生产暂停'
          ? 'destructive'
          : row.dyeStatus === '可继续'
            ? 'default'
            : 'outline'

      const pressureTone: Tone =
        row.pressure === '高风险'
          ? 'destructive'
          : row.pressure === '待质检' || row.pressure === '待进入下一步'
            ? 'default'
            : row.pressure === '可推进'
              ? 'secondary'
              : 'outline'

      return `
        <tr class="border-b last:border-0">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(row.productionOrderId)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(row.mainFactory)}</td>
          <td class="px-3 py-3 text-center text-sm">${row.taskCount}</td>
          <td class="px-3 py-3 text-center text-sm">${
            row.blockedCount > 0 ? renderBadge(String(row.blockedCount), 'destructive') : '<span class="text-muted-foreground">0</span>'
          }</td>
          <td class="px-3 py-3">${renderBadge(row.dyeStatus, dyeTone)}</td>
          <td class="px-3 py-3 text-center text-sm">${
            row.qcPending > 0 ? renderBadge(String(row.qcPending), 'default') : '<span class="text-muted-foreground">0</span>'
          }</td>
          <td class="px-3 py-3">${renderBadge(row.pressure, pressureTone)}</td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap gap-1">
              <button data-nav="/fcs/production/orders/${row.productionOrderId}" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看生产单</button>
              <button data-nav="/fcs/process/task-breakdown" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看任务</button>
              <button data-nav="/fcs/process/dye-orders" class="inline-flex h-8 items-center rounded-md px-3 text-xs hover:bg-muted">查看染印</button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

export function renderCapacityOverviewPage(): string {
  syncCapacityStateFromRoute()
  syncDispatchCapacityUsageLedger()
  const calendar = buildCapacityCalendarData()
  const keyword = state.overviewKeyword.trim().toLowerCase()
  const visibleComparisonRows = getVisibleComparisonRows(calendar.comparisonRows, keyword)
  const hiddenComparisonCount = Math.max(calendar.comparisonRows.filter((row) =>
    matchesOverviewKeyword(
      keyword,
      row.date,
      row.factoryId,
      row.factoryName,
      row.processCode,
      row.processName,
      row.craftCode,
      row.craftName,
      ...row.taskIds,
    ),
  ).length - visibleComparisonRows.length, 0)
  const dateRangeText = calendar.displayDates.length
    ? `${calendar.displayDates[0]} 至 ${calendar.displayDates[calendar.displayDates.length - 1]}`
    : '暂无日期窗口'
  const tabSummaryMap: Record<OverviewTab, { title: string; description: string; panel: string }> = {
    comparison: {
      title: '工厂供需明细',
      description:
        '按 日期 / 工厂 / 工序 / 工艺 聚合。已占用只消费占用工时对象，已冻结只消费冻结工时对象，剩余 = 供给 - 已占用 - 已冻结。',
      panel: `
        <div class="rounded-md border" data-capacity-overview-panel="comparison">
          <div class="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
            <div>
              <h2 class="text-sm font-semibold text-foreground">工厂供需明细</h2>
              <p class="mt-1 text-xs text-muted-foreground">按 日期 / 工厂 / 工序 / 工艺 聚合展示工厂事实，不混入需求池。</p>
            </div>
            ${
              hiddenComparisonCount > 0
                ? `<span class="text-xs text-muted-foreground">当前仅展示前 ${visibleComparisonRows.length} 条，剩余 ${hiddenComparisonCount} 条可用关键词继续筛选</span>`
                : ''
            }
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 text-left font-medium">日期</th>
                          <th class="px-3 py-2 text-left font-medium">工厂</th>
                          <th class="px-3 py-2 text-left font-medium">工序 / 工艺</th>
                          <th class="px-3 py-2 text-right font-medium">供给</th>
                          <th class="px-3 py-2 text-right font-medium">已占用</th>
                          <th class="px-3 py-2 text-right font-medium">已冻结</th>
                          <th class="px-3 py-2 text-right font-medium">剩余</th>
                          <th class="px-3 py-2 text-left font-medium">当前状态</th>
                          <th class="px-3 py-2 text-left font-medium">对象数</th>
                        </tr>
              </thead>
              <tbody>${renderCapacityComparisonTable(calendar.comparisonRows, keyword)}</tbody>
            </table>
          </div>
        </div>
      `,
    },
    unallocated: {
      title: '待分配需求',
      description: '只看尚未稳定落到工厂、但已经具备标准工时和日期窗口的需求池，不会错误扣减具体工厂。',
      panel: `
        <div class="rounded-md border" data-capacity-overview-panel="unallocated">
          <div class="border-b bg-muted/30 px-4 py-3">
            <h2 class="text-sm font-semibold text-foreground">待分配需求</h2>
            <p class="mt-1 text-xs text-muted-foreground">只统计未形成冻结/占用对象、但仍有总标准工时且可落日的任务需求。</p>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 text-left font-medium">日期</th>
                  <th class="px-3 py-2 text-left font-medium">工序 / 工艺</th>
                  <th class="px-3 py-2 text-right font-medium">需求</th>
                  <th class="px-3 py-2 text-center font-medium">任务数</th>
                  <th class="px-3 py-2 text-left font-medium">当前状态</th>
                </tr>
              </thead>
              <tbody>${renderUnallocatedRows(calendar.unallocatedRows, keyword)}</tbody>
            </table>
          </div>
        </div>
      `,
    },
    unscheduled: {
      title: '未排期需求',
      description: '只看总标准工时已存在、但还缺少可用日期或窗口的需求池，避免被静默忽略或强行落到今天。',
      panel: `
        <div class="rounded-md border" data-capacity-overview-panel="unscheduled">
          <div class="border-b bg-muted/30 px-4 py-3">
            <h2 class="text-sm font-semibold text-foreground">未排期需求</h2>
            <p class="mt-1 text-xs text-muted-foreground">总标准工时已存在，但缺少可用日期 / 窗口，因此当前不会被静默忽略，也不会强行落到今天。</p>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 text-left font-medium">任务ID</th>
                  <th class="px-3 py-2 text-left font-medium">生产单号</th>
                  <th class="px-3 py-2 text-left font-medium">需求类型</th>
                  <th class="px-3 py-2 text-left font-medium">工序 / 工艺</th>
                  <th class="px-3 py-2 text-left font-medium">当前落厂</th>
                  <th class="px-3 py-2 text-right font-medium">总需求</th>
                  <th class="px-3 py-2 text-left font-medium">原因</th>
                </tr>
              </thead>
              <tbody>${renderUnscheduledRows(calendar.unscheduledRows, keyword)}</tbody>
            </table>
          </div>
        </div>
      `,
    },
  }
  const activeTab = tabSummaryMap[state.overviewTab]

  return `
    <div class="space-y-6" data-testid="capacity-calendar-page">
      <header class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">供需总览</h1>
          <p class="mt-0.5 text-sm text-muted-foreground">当前供需窗口 ${escapeHtml(dateRangeText)}，覆盖 ${calendar.displayDates.length} 天。</p>
        </div>
      </header>

      ${renderCapacityRouteContextBanner('overview')}

      ${renderPageHint('当前页把工厂事实、待分配需求、未排期需求拆到独立 Tab 查看；供给仍来自产能档案自动计算结果。')}

      <section class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6" data-capacity-supply-demand-summary>
        ${renderMetricStatCard('供给总量（标准工时）', formatSamValue(calendar.summary.supplyTotal))}
        ${renderMetricStatCard('已占用总量（标准工时）', formatSamValue(calendar.summary.committedTotal))}
        ${renderMetricStatCard('已冻结总量（标准工时）', formatSamValue(calendar.summary.frozenTotal), calendar.summary.frozenTotal > 0 ? 'text-amber-700' : '')}
        ${renderMetricStatCard('剩余总量（标准工时）', formatSamValue(calendar.summary.remainingTotal), calendar.summary.remainingTotal < 0 ? 'text-red-600' : 'text-green-700')}
        ${renderMetricStatCard('待分配需求总量（标准工时）', formatSamValue(calendar.summary.unallocatedTotal), calendar.summary.unallocatedTotal > 0 ? 'text-orange-700' : '')}
        ${renderMetricStatCard('未排期需求总量（标准工时）', formatSamValue(calendar.summary.unscheduledTotal), calendar.summary.unscheduledTotal > 0 ? 'text-amber-700' : '')}
      </section>

      <section class="rounded-lg border bg-card px-4 py-4 text-sm" data-capacity-calendar-rules>
        <div class="space-y-1">
          <p class="font-medium text-foreground">时间窗口口径</p>
          <p class="text-muted-foreground">开始/结束窗口按 ${escapeHtml(calendar.windowPriority.start.join(' > '))} 和 ${escapeHtml(calendar.windowPriority.end.join(' > '))} 配对成功时均摊到窗口内每日；只有单日期时整笔落到该日，缺日期则进入未排期需求。</p>
        </div>
        ${
          calendar.missingSamRows.length > 0
            ? `<div class="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">当前仍有 ${calendar.missingSamRows.length} 条任务缺少可用总标准工时字段，未参与供需对比，避免被静默吞掉。</div>`
            : ''
        }
      </section>

      <section class="flex max-w-xl items-center gap-2">
        <input
          data-capacity-filter="overview-keyword"
          value="${escapeHtml(state.overviewKeyword)}"
          placeholder="关键词（日期 / 工厂 / 工序 / 工艺 / 任务ID）"
          class="h-9 w-full rounded-md border bg-background px-3 text-sm"
        />
      </section>

      <section class="space-y-4" data-testid="capacity-overview-tabs-section">
        <div class="flex flex-wrap items-center gap-2" data-capacity-overview-tabs>
          ${renderTabButton('overview', 'comparison', state.overviewTab, '工厂供需明细')}
          ${renderTabButton('overview', 'unallocated', state.overviewTab, '待分配需求')}
          ${renderTabButton('overview', 'unscheduled', state.overviewTab, '未排期需求')}
        </div>
        <div class="space-y-2">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold text-foreground">${escapeHtml(activeTab.title)}</h2>
              <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(activeTab.description)}</p>
            </div>
          </div>
          ${activeTab.panel}
        </div>
      </section>
    </div>
  `
}

function renderRiskConclusionBadge(conclusion: CapacityRiskTaskRow['conclusion'] | CapacityRiskOrderRow['highestRiskConclusion']): string {
  const tone: Tone =
    conclusion === 'PAUSED' || conclusion === 'EXCEEDS_WINDOW'
      ? 'destructive'
      : conclusion === 'TIGHT'
        ? 'default'
        : conclusion === 'CAPABLE'
          ? 'secondary'
          : 'outline'
  const labelMap = {
    CAPABLE: '可承载',
    TIGHT: '紧张',
    EXCEEDS_WINDOW: '超出窗口',
    PAUSED: '暂停',
    FROZEN_PENDING: '已冻结待确认',
    UNALLOCATED: '未落厂',
    UNSCHEDULED: '未排期',
  } as const
  return renderBadge(labelMap[conclusion], tone)
}

function renderRiskSamValue(value?: number): string {
  return value == null ? '—' : formatSamValue(value)
}

function renderRiskFactoryCell(row: CapacityRiskTaskRow): string {
  if (!row.factoryName) {
    return `<div class="text-sm text-muted-foreground">未落厂</div>`
  }
  const bindingLabel =
    row.factoryBindingKind === 'COMMITTED'
      ? '已落厂占用'
      : row.factoryBindingKind === 'FROZEN_PENDING'
        ? '已冻结待确认'
        : '未落厂'
  const scopeLine =
    row.factoryBindingKind === 'FROZEN_PENDING' && (row.bindingFactoryCount ?? 0) > 1
      ? `<div class="text-xs text-muted-foreground">${row.bindingFactoryCount} 家候选工厂</div>`
      : ''
  return `
    <div class="text-sm font-medium text-foreground">${escapeHtml(row.factoryName)}</div>
    <div class="text-xs text-muted-foreground">${escapeHtml(bindingLabel)}</div>
    ${scopeLine}
  `
}

function renderRiskWindowText(row: CapacityRiskTaskRow): string {
  const lines = [`<div class="text-sm">${escapeHtml(row.windowText || '日期不足')}</div>`]
  if (row.conclusion === 'FROZEN_PENDING' && row.frozenWindowText) {
    lines.push(`<div class="text-xs text-muted-foreground">冻结窗口：${escapeHtml(row.frozenWindowText)}</div>`)
  }
  if (row.fallbackRuleLabel) {
    lines.push(`<div class="text-xs text-muted-foreground">${escapeHtml(row.fallbackRuleLabel)}</div>`)
  }
  return lines.join('')
}

function renderRiskTaskTable(rows: CapacityRiskTaskRow[]): string {
  if (rows.length === 0) {
    return '<tr><td colspan="13" class="px-3 py-10 text-center text-sm text-muted-foreground">当前筛选条件下暂无任务工时风险数据</td></tr>'
  }

  return rows
    .map((row) => `
      <tr class="border-b last:border-0">
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(row.taskId)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(row.productionOrderId)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(row.processName)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(row.craftName)}</td>
        <td class="px-3 py-3">${renderRiskFactoryCell(row)}</td>
        <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(row.totalStandardTime))}</td>
        <td class="px-3 py-3">${renderRiskWindowText(row)}</td>
        <td class="px-3 py-3 text-right text-sm">${escapeHtml(renderRiskSamValue(row.windowSupplySam))}</td>
        <td class="px-3 py-3 text-right text-sm">${escapeHtml(renderRiskSamValue(row.otherCommittedSam))}</td>
        <td class="px-3 py-3 text-right text-sm">${escapeHtml(renderRiskSamValue(row.otherFrozenSam))}</td>
        <td class="px-3 py-3 text-right text-sm font-medium ${row.remainingAfterCurrentSam != null && row.remainingAfterCurrentSam < 0 ? 'text-red-600' : 'text-green-700'}">${escapeHtml(renderRiskSamValue(row.remainingAfterCurrentSam))}</td>
        <td class="px-3 py-3">${renderRiskConclusionBadge(row.conclusion)}</td>
        <td class="max-w-[280px] px-3 py-3 text-xs leading-5 text-muted-foreground">${escapeHtml(row.reason)}</td>
      </tr>
    `)
    .join('')
}

function renderRiskOrderTable(rows: CapacityRiskOrderRow[]): string {
  if (rows.length === 0) {
    return '<tr><td colspan="10" class="px-3 py-10 text-center text-sm text-muted-foreground">当前筛选条件下暂无生产单工时风险数据</td></tr>'
  }

  return rows
    .map((row) => `
      <tr class="border-b last:border-0">
        <td class="px-3 py-3 text-sm font-medium">${escapeHtml(row.productionOrderId)}</td>
        <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(row.totalStandardTime))}</td>
        <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(row.allocatedStandardTime))}</td>
        <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(row.frozenPendingStandardTime))}</td>
        <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(row.unallocatedStandardTime))}</td>
        <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(row.unscheduledStandardTime))}</td>
        <td class="px-3 py-3 text-center text-sm">${row.taskCount}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(row.mainRiskProcessName && row.mainRiskCraftName ? `${row.mainRiskProcessName} / ${row.mainRiskCraftName}` : '—')}</td>
        <td class="px-3 py-3">${renderRiskConclusionBadge(row.highestRiskConclusion)}</td>
        <td class="max-w-[260px] px-3 py-3 text-xs leading-5 text-muted-foreground">${escapeHtml(row.reason)}</td>
      </tr>
    `)
    .join('')
}

export function renderCapacityRiskPage(): string {
  syncDispatchCapacityUsageLedger()
  const riskData = buildCapacityRiskData()
  const filteredTaskRows = filterCapacityRiskTaskRows({
    rows: riskData.taskRows,
    keyword: state.riskKeyword,
    processCode: state.riskProcessCode,
    craftValue: state.riskCraftCode,
    conclusion: state.riskConclusion,
    windowDays: state.riskWindowDays,
  })
  const filteredOrderRows = summarizeProductionOrderRisk(filteredTaskRows)
  const stats = {
    capable: filteredTaskRows.filter((row) => row.conclusion === 'CAPABLE').length,
    tight: filteredTaskRows.filter((row) => row.conclusion === 'TIGHT').length,
    exceedsWindow: filteredTaskRows.filter((row) => row.conclusion === 'EXCEEDS_WINDOW').length,
    paused: filteredTaskRows.filter((row) => row.conclusion === 'PAUSED').length,
    frozenPending: filteredTaskRows.filter((row) => row.conclusion === 'FROZEN_PENDING').length,
    unallocated: filteredTaskRows.filter((row) => row.conclusion === 'UNALLOCATED').length,
    unscheduled: filteredTaskRows.filter((row) => row.conclusion === 'UNSCHEDULED').length,
  }
  const craftOptions = riskData.craftOptions.filter((item) =>
    state.riskProcessCode ? item.processCode === state.riskProcessCode : true,
  )

  return `
    <div class="space-y-6" data-capacity-risk-page>
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-balance">任务工时风险</h1>
          <p class="mt-1 text-sm text-muted-foreground">当前页统一按标准工时窗口判断：已落厂看窗口可承载余量，已冻结待确认、未落厂、未排期分别单独归类。</p>
        </div>
        <p class="text-sm text-muted-foreground">当前筛选下 ${filteredTaskRows.length} 条任务 / ${filteredOrderRows.length} 张生产单</p>
      </header>

      <section class="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-7" data-capacity-risk-kpis>
        ${renderStatCard('可承载任务数', stats.capable)}
        ${renderStatCard('紧张任务数', stats.tight)}
        ${renderStatCard('超出窗口任务数', stats.exceedsWindow)}
        ${renderStatCard('暂停任务数', stats.paused)}
        ${renderStatCard('已冻结待确认任务数', stats.frozenPending)}
        ${renderStatCard('未落厂任务数', stats.unallocated)}
        ${renderStatCard('未排期任务数', stats.unscheduled)}
      </section>

      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <input
          data-capacity-filter="risk-keyword"
          value="${escapeHtml(state.riskKeyword)}"
          placeholder="关键词（任务 / 生产单 / 工厂）"
          class="h-9 w-full rounded-md border bg-background px-3 text-sm"
        />
        <select data-capacity-filter="risk-window-days" class="h-9 w-full rounded-md border bg-background px-3 text-sm">
          ${riskData.windowOptions
            .map((option) => `<option value="${option.value}" ${state.riskWindowDays === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
            .join('')}
        </select>
        <select data-capacity-filter="risk-process-code" class="h-9 w-full rounded-md border bg-background px-3 text-sm">
          <option value="">全部工序</option>
          ${riskData.processOptions
            .map((option) => `<option value="${escapeHtml(option.value)}" ${state.riskProcessCode === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
            .join('')}
        </select>
        <select data-capacity-filter="risk-craft-code" class="h-9 w-full rounded-md border bg-background px-3 text-sm">
          <option value="">全部工艺</option>
          ${craftOptions
            .map((option) => `<option value="${escapeHtml(option.value)}" ${state.riskCraftCode === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
            .join('')}
        </select>
        <select data-capacity-filter="risk-conclusion" class="h-9 w-full rounded-md border bg-background px-3 text-sm">
          ${riskData.conclusionOptions
            .map((option) => `<option value="${escapeHtml(option.value)}" ${state.riskConclusion === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
            .join('')}
        </select>
      </section>

      <section class="space-y-4">
        <div class="inline-flex rounded-md bg-muted p-1">
          ${renderTabButton('risk', 'task', state.riskTab, '任务风险')}
          ${renderTabButton('risk', 'order', state.riskTab, '生产单风险')}
        </div>

        ${
          state.riskTab === 'task'
            ? `
              <div class="overflow-x-auto rounded-md border">
                <table class="w-full text-sm" data-capacity-risk-task-table>
                  <thead class="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium">任务编号</th>
                      <th class="px-3 py-2 text-left font-medium">生产单号</th>
                      <th class="px-3 py-2 text-left font-medium">工序</th>
                      <th class="px-3 py-2 text-left font-medium">工艺</th>
                      <th class="px-3 py-2 text-left font-medium">当前工厂 / 当前承接对象</th>
                      <th class="px-3 py-2 text-right font-medium">任务总标准工时</th>
                      <th class="px-3 py-2 text-left font-medium">窗口起止日期</th>
                      <th class="px-3 py-2 text-right font-medium">窗口供给标准工时</th>
                      <th class="px-3 py-2 text-right font-medium">其他已占用标准工时</th>
                      <th class="px-3 py-2 text-right font-medium">其他已冻结标准工时</th>
                      <th class="px-3 py-2 text-right font-medium">当前任务计入后剩余标准工时</th>
                      <th class="px-3 py-2 text-left font-medium">风险结论</th>
                      <th class="px-3 py-2 text-left font-medium">风险原因</th>
                    </tr>
                  </thead>
                  <tbody>${renderRiskTaskTable(filteredTaskRows)}</tbody>
                </table>
              </div>
            `
            : `
              <div class="overflow-x-auto rounded-md border">
                <table class="w-full text-sm" data-capacity-risk-order-table>
                  <thead class="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium">生产单号</th>
                      <th class="px-3 py-2 text-right font-medium">生产单总标准工时</th>
                      <th class="px-3 py-2 text-right font-medium">已落厂标准工时</th>
                      <th class="px-3 py-2 text-right font-medium">已冻结待确认标准工时</th>
                      <th class="px-3 py-2 text-right font-medium">未落厂标准工时</th>
                      <th class="px-3 py-2 text-right font-medium">未排期标准工时</th>
                      <th class="px-3 py-2 text-center font-medium">任务数</th>
                      <th class="px-3 py-2 text-left font-medium">主要风险工序 / 工艺</th>
                      <th class="px-3 py-2 text-left font-medium">最高风险结论</th>
                      <th class="px-3 py-2 text-left font-medium">风险原因</th>
                    </tr>
                  </thead>
                  <tbody>${renderRiskOrderTable(filteredOrderRows)}</tbody>
                </table>
              </div>
            `
        }
      </section>
    </div>
  `
}

function filterBottleneckCraftRows(rows: CapacityBottleneckCraftRow[], keyword: string): CapacityBottleneckCraftRow[] {
  if (!keyword) return rows
  return rows.filter((row) =>
    [
      row.processName,
      row.craftName,
      formatSamValue(row.windowSupplySam),
      formatSamValue(row.windowRemainingSam),
    ].some((value) => includesKeyword(toLower(value), keyword)),
  )
}

function filterBottleneckDateRows(rows: CapacityBottleneckDateRow[], keyword: string): CapacityBottleneckDateRow[] {
  if (!keyword) return rows
  return rows.filter((row) =>
    includesKeyword(toLower(row.date), keyword)
    || row.detailRows.some((detail) =>
      [detail.factoryName, detail.processName, detail.craftName].some((value) => includesKeyword(toLower(value), keyword)),
    ),
  )
}

function filterBottleneckUnallocatedRows(
  rows: CapacityBottleneckUnallocatedTaskRow[],
  keyword: string,
): CapacityBottleneckUnallocatedTaskRow[] {
  if (!keyword) return rows
  return rows.filter((row) =>
    [
      row.taskId,
      row.productionOrderId,
      row.processName,
      row.craftName,
      row.assignmentStatusLabel,
      row.note,
    ].some((value) => includesKeyword(toLower(value), keyword)),
  )
}

function filterBottleneckUnscheduledRows(
  rows: CapacityBottleneckUnscheduledTaskRow[],
  keyword: string,
): CapacityBottleneckUnscheduledTaskRow[] {
  if (!keyword) return rows
  return rows.filter((row) =>
    [
      row.taskId,
      row.productionOrderId,
      row.processName,
      row.craftName,
      row.assignmentStatusLabel,
      row.reason,
      row.note,
    ].some((value) => includesKeyword(toLower(value), keyword)),
  )
}

function summarizeFilteredBottleneckData(input: {
  craftRows: CapacityBottleneckCraftRow[]
  dateRows: CapacityBottleneckDateRow[]
  unallocatedRows: CapacityBottleneckUnallocatedTaskRow[]
  unscheduledRows: CapacityBottleneckUnscheduledTaskRow[]
}) {
  return {
    bottleneckCraftCount: input.craftRows.filter((row) => row.windowRemainingSam < 0).length,
    overloadedDateCount: input.dateRows.filter((row) => row.overloadedCraftCount > 0).length,
    unallocatedTotal: input.unallocatedRows.reduce((sum, row) => sum + row.totalStandardTime, 0),
    unscheduledTotal: input.unscheduledRows.reduce((sum, row) => sum + row.totalStandardTime, 0),
    maxDailyGapSam: input.dateRows.reduce((max, row) => Math.max(max, row.maxGapSam), 0),
    maxCraftGapSam: input.craftRows.reduce((max, row) => Math.max(max, row.maxGapSam), 0),
  }
}

function renderBottleneckCraftTable(rows: CapacityBottleneckCraftRow[], selectedRowKey: string): string {
  if (rows.length === 0) {
    return '<tr><td colspan="14" class="px-3 py-10 text-center text-sm text-muted-foreground">当前筛选条件下暂无工艺瓶颈数据</td></tr>'
  }

  return rows
    .map((row) => {
      const selected = row.rowKey === selectedRowKey
      const remainingClass = row.windowRemainingSam < 0 ? 'text-red-600' : 'text-green-700'
      const gapClass = row.maxGapSam > 0 ? 'text-red-600' : 'text-muted-foreground'
      return `
        <tr class="border-b last:border-0 ${selected ? 'bg-blue-50/60' : ''}" data-bottleneck-craft-row="${escapeHtml(row.rowKey)}">
          <td class="px-3 py-3 text-sm">${escapeHtml(row.processName)}</td>
          <td class="px-3 py-3 text-sm font-medium">${escapeHtml(row.craftName)}</td>
          <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(row.windowSupplySam))}</td>
          <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(row.windowCommittedSam))}</td>
          <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(row.windowFrozenSam))}</td>
          <td class="px-3 py-3 text-right text-sm font-medium ${remainingClass}">${escapeHtml(formatSamValue(row.windowRemainingSam))}</td>
          <td class="px-3 py-3 text-center text-sm">${row.overloadDayCount}</td>
          <td class="px-3 py-3 text-center text-sm">${row.tightDayCount}</td>
          <td class="px-3 py-3 text-center text-sm">${row.pausedDayCount}</td>
          <td class="px-3 py-3 text-center text-sm">${row.factoryCount}</td>
          <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(row.unallocatedSam))}</td>
          <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(row.unscheduledSam))}</td>
          <td class="px-3 py-3 text-right text-sm font-medium ${gapClass}">${escapeHtml(formatSamValue(row.maxGapSam))}</td>
          <td class="px-3 py-3 text-right">
            <button
              data-capacity-action="open-bottleneck-craft-detail"
              data-row-key="${escapeHtml(row.rowKey)}"
              class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted"
            >
              查看明细
            </button>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderBottleneckDateTable(rows: CapacityBottleneckDateRow[], selectedDate: string): string {
  if (rows.length === 0) {
    return '<tr><td colspan="12" class="px-3 py-10 text-center text-sm text-muted-foreground">当前筛选条件下暂无日期瓶颈数据</td></tr>'
  }

  return rows
    .map((row) => {
      const selected = row.date === selectedDate
      const remainingClass = row.remainingSam < 0 ? 'text-red-600' : 'text-green-700'
      const gapClass = row.maxGapSam > 0 ? 'text-red-600' : 'text-muted-foreground'
      return `
        <tr class="border-b last:border-0 ${selected ? 'bg-blue-50/60' : ''}" data-bottleneck-date-row="${escapeHtml(row.date)}">
          <td class="px-3 py-3 text-sm font-medium">${escapeHtml(row.date)}</td>
          <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(row.supplySam))}</td>
          <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(row.committedSam))}</td>
          <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(row.frozenSam))}</td>
          <td class="px-3 py-3 text-right text-sm font-medium ${remainingClass}">${escapeHtml(formatSamValue(row.remainingSam))}</td>
          <td class="px-3 py-3 text-center text-sm">${row.overloadedFactoryCount}</td>
          <td class="px-3 py-3 text-center text-sm">${row.overloadedCraftCount}</td>
          <td class="px-3 py-3 text-center text-sm">${row.pausedFactoryCount}</td>
          <td class="px-3 py-3 text-center text-sm">${row.tightCraftCount}</td>
          <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(row.unallocatedSam))}</td>
          <td class="px-3 py-3 text-right text-sm font-medium ${gapClass}">${escapeHtml(formatSamValue(row.maxGapSam))}</td>
          <td class="px-3 py-3 text-right">
            <button
              data-capacity-action="open-bottleneck-date-detail"
              data-date="${escapeHtml(row.date)}"
              class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted"
            >
              查看明细
            </button>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderBottleneckDemandTableSection(
  title: string,
  description: string,
  tableHtml: string,
  testId: string,
): string {
  return `
    <section class="rounded-md border" data-testid="${escapeHtml(testId)}">
      <div class="border-b bg-muted/30 px-4 py-3">
        <h3 class="text-sm font-semibold text-foreground">${escapeHtml(title)}</h3>
        <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(description)}</p>
      </div>
      <div class="overflow-x-auto">
        ${tableHtml}
      </div>
    </section>
  `
}

function renderBottleneckUnallocatedTable(rows: CapacityBottleneckUnallocatedTaskRow[]): string {
  if (rows.length === 0) {
    return `
      <table class="w-full text-sm">
        <tbody><tr><td colspan="9" class="px-3 py-10 text-center text-sm text-muted-foreground">当前窗口内暂无待分配需求</td></tr></tbody>
      </table>
    `
  }

  return `
    <table class="w-full text-sm" data-bottleneck-unallocated-table>
      <thead class="border-b bg-muted/40 text-muted-foreground">
        <tr>
          <th class="px-3 py-2 text-left font-medium">任务编号</th>
          <th class="px-3 py-2 text-left font-medium">生产单号</th>
          <th class="px-3 py-2 text-left font-medium">工序</th>
          <th class="px-3 py-2 text-left font-medium">工艺</th>
          <th class="px-3 py-2 text-right font-medium">任务总标准工时</th>
          <th class="px-3 py-2 text-left font-medium">日期窗口</th>
          <th class="px-3 py-2 text-left font-medium">当前分配阶段</th>
          <th class="px-3 py-2 text-center font-medium">已冻结工厂数</th>
          <th class="px-3 py-2 text-left font-medium">说明</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr class="border-b last:border-0" data-bottleneck-unallocated-row="${escapeHtml(row.taskId)}">
                <td class="px-3 py-3 font-mono text-xs">${escapeHtml(row.taskId)}</td>
                <td class="px-3 py-3 text-sm">${escapeHtml(row.productionOrderId)}</td>
                <td class="px-3 py-3 text-sm">${escapeHtml(row.processName)}</td>
                <td class="px-3 py-3 text-sm">${escapeHtml(row.craftName)}</td>
                <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(row.totalStandardTime))}</td>
                <td class="px-3 py-3 text-sm">${escapeHtml(row.windowText)}</td>
                <td class="px-3 py-3 text-sm">${escapeHtml(row.assignmentStatusLabel)}</td>
                <td class="px-3 py-3 text-center text-sm">${row.frozenFactoryCount}</td>
                <td class="max-w-[260px] px-3 py-3 text-xs leading-5 text-muted-foreground">${escapeHtml(row.note)}</td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>
  `
}

function renderBottleneckUnscheduledTable(rows: CapacityBottleneckUnscheduledTaskRow[]): string {
  if (rows.length === 0) {
    return `
      <table class="w-full text-sm">
        <tbody><tr><td colspan="7" class="px-3 py-10 text-center text-sm text-muted-foreground">当前暂无未排期需求</td></tr></tbody>
      </table>
    `
  }

  return `
    <table class="w-full text-sm" data-bottleneck-unscheduled-table>
      <thead class="border-b bg-muted/40 text-muted-foreground">
        <tr>
          <th class="px-3 py-2 text-left font-medium">任务编号</th>
          <th class="px-3 py-2 text-left font-medium">生产单号</th>
          <th class="px-3 py-2 text-left font-medium">工序</th>
          <th class="px-3 py-2 text-left font-medium">工艺</th>
          <th class="px-3 py-2 text-right font-medium">任务总标准工时</th>
          <th class="px-3 py-2 text-left font-medium">缺失日期原因</th>
          <th class="px-3 py-2 text-left font-medium">说明</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr class="border-b last:border-0" data-bottleneck-unscheduled-row="${escapeHtml(row.taskId)}">
                <td class="px-3 py-3 font-mono text-xs">${escapeHtml(row.taskId)}</td>
                <td class="px-3 py-3 text-sm">${escapeHtml(row.productionOrderId)}</td>
                <td class="px-3 py-3 text-sm">${escapeHtml(row.processName)}</td>
                <td class="px-3 py-3 text-sm">${escapeHtml(row.craftName)}</td>
                <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(row.totalStandardTime))}</td>
                <td class="px-3 py-3 text-sm">${escapeHtml(row.reason)}</td>
                <td class="max-w-[260px] px-3 py-3 text-xs leading-5 text-muted-foreground">${escapeHtml(row.note)}</td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>
  `
}

function renderBottleneckCraftDetailPanel(row: CapacityBottleneckCraftRow | null): string {
  if (!row) {
    return `
      <aside class="rounded-md border bg-card p-4">
        <h3 class="text-sm font-semibold text-foreground">工艺明细</h3>
        <p class="mt-2 text-sm text-muted-foreground">从左侧工艺瓶颈榜选择一行后，可查看该工艺在当前窗口内的日期分布和工厂分布。</p>
      </aside>
    `
  }

  return `
    <aside class="rounded-md border bg-card" data-bottleneck-craft-detail>
      <div class="border-b bg-muted/30 px-4 py-3">
        <h3 class="text-sm font-semibold text-foreground">${escapeHtml(formatCapacityScopeText(row.processName, row.craftName))}</h3>
        <p class="mt-1 text-xs text-muted-foreground">窗口总供给 ${escapeHtml(formatSamValue(row.windowSupplySam))} / 已占用 ${escapeHtml(formatSamValue(row.windowCommittedSam))} / 已冻结 ${escapeHtml(formatSamValue(row.windowFrozenSam))} / 剩余 ${escapeHtml(formatSamValue(row.windowRemainingSam))}</p>
      </div>
      <div class="space-y-4 p-4">
        <section class="space-y-2">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">日期分布</h4>
          <div class="overflow-x-auto rounded-md border">
            <table class="w-full text-sm">
              <thead class="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 text-left font-medium">日期</th>
                  <th class="px-3 py-2 text-right font-medium">供给</th>
                  <th class="px-3 py-2 text-right font-medium">已占用</th>
                  <th class="px-3 py-2 text-right font-medium">已冻结</th>
                  <th class="px-3 py-2 text-right font-medium">剩余</th>
                </tr>
              </thead>
              <tbody>
                ${row.dateRows
                  .map(
                    (dateRow) => `
                      <tr class="border-b last:border-0">
                        <td class="px-3 py-3 text-sm">${escapeHtml(dateRow.date)}</td>
                        <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(dateRow.supplySam))}</td>
                        <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(dateRow.committedSam))}</td>
                        <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(dateRow.frozenSam))}</td>
                        <td class="px-3 py-3 text-right text-sm font-medium ${dateRow.remainingSam < 0 ? 'text-red-600' : 'text-green-700'}">${escapeHtml(formatSamValue(dateRow.remainingSam))}</td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </section>
        <section class="space-y-2">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">工厂分布</h4>
          <div class="overflow-x-auto rounded-md border">
            <table class="w-full text-sm">
              <thead class="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 text-left font-medium">工厂</th>
                  <th class="px-3 py-2 text-right font-medium">供给</th>
                  <th class="px-3 py-2 text-right font-medium">已占用</th>
                  <th class="px-3 py-2 text-right font-medium">已冻结</th>
                  <th class="px-3 py-2 text-right font-medium">剩余</th>
                </tr>
              </thead>
              <tbody>
                ${row.factoryRows
                  .map(
                    (factoryRow) => `
                      <tr class="border-b last:border-0">
                        <td class="px-3 py-3 text-sm">${escapeHtml(factoryRow.factoryName)}</td>
                        <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(factoryRow.supplySam))}</td>
                        <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(factoryRow.committedSam))}</td>
                        <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(factoryRow.frozenSam))}</td>
                        <td class="px-3 py-3 text-right text-sm font-medium ${factoryRow.remainingSam < 0 ? 'text-red-600' : 'text-green-700'}">${escapeHtml(formatSamValue(factoryRow.remainingSam))}</td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </aside>
  `
}

function renderBottleneckDateDetailPanel(row: CapacityBottleneckDateRow | null): string {
  if (!row) {
    return `
      <aside class="rounded-md border bg-card p-4">
        <h3 class="text-sm font-semibold text-foreground">日期明细</h3>
        <p class="mt-2 text-sm text-muted-foreground">从左侧日期瓶颈榜选择一行后，可查看当天哪些工厂 / 工艺最紧。</p>
      </aside>
    `
  }

  return `
    <aside class="rounded-md border bg-card" data-bottleneck-date-detail>
      <div class="border-b bg-muted/30 px-4 py-3">
        <h3 class="text-sm font-semibold text-foreground">${escapeHtml(row.date)}</h3>
        <p class="mt-1 text-xs text-muted-foreground">当日供给 ${escapeHtml(formatSamValue(row.supplySam))} / 已占用 ${escapeHtml(formatSamValue(row.committedSam))} / 已冻结 ${escapeHtml(formatSamValue(row.frozenSam))} / 剩余 ${escapeHtml(formatSamValue(row.remainingSam))}</p>
      </div>
      <div class="overflow-x-auto p-4">
        <table class="w-full text-sm">
          <thead class="border-b bg-muted/40 text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left font-medium">工厂</th>
              <th class="px-3 py-2 text-left font-medium">工序</th>
              <th class="px-3 py-2 text-left font-medium">工艺</th>
              <th class="px-3 py-2 text-right font-medium">供给</th>
              <th class="px-3 py-2 text-right font-medium">已占用</th>
              <th class="px-3 py-2 text-right font-medium">已冻结</th>
              <th class="px-3 py-2 text-right font-medium">剩余</th>
              <th class="px-3 py-2 text-center font-medium">占用任务数</th>
              <th class="px-3 py-2 text-center font-medium">冻结任务数</th>
            </tr>
          </thead>
          <tbody>
            ${
              row.detailRows.length
                ? row.detailRows
                    .map(
                      (detail) => `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-3 text-sm">${escapeHtml(detail.factoryName)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(detail.processName)}</td>
                          <td class="px-3 py-3 text-sm">${escapeHtml(detail.craftName)}</td>
                          <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(detail.supplySam))}</td>
                          <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(detail.committedSam))}</td>
                          <td class="px-3 py-3 text-right text-sm">${escapeHtml(formatSamValue(detail.frozenSam))}</td>
                          <td class="px-3 py-3 text-right text-sm font-medium ${detail.remainingSam < 0 ? 'text-red-600' : 'text-green-700'}">${escapeHtml(formatSamValue(detail.remainingSam))}</td>
                          <td class="px-3 py-3 text-center text-sm">${detail.committedTaskCount}</td>
                          <td class="px-3 py-3 text-center text-sm">${detail.frozenTaskCount}</td>
                        </tr>
                      `,
                    )
                    .join('')
                : '<tr><td colspan="9" class="px-3 py-10 text-center text-sm text-muted-foreground">当前日期下暂无工艺瓶颈明细</td></tr>'
            }
          </tbody>
        </table>
      </div>
    </aside>
  `
}

export function renderCapacityBottleneckPage(): string {
  syncDispatchCapacityUsageLedger()
  const bottleneck = buildCapacityBottleneckData({
    windowDays: state.bottleneckWindowDays,
    processCode: state.bottleneckProcessCode || undefined,
    craftCode: state.bottleneckCraftCode || undefined,
  })

  state.bottleneckWindowDays = bottleneck.windowDays
  const keyword = state.bottleneckKeyword.trim().toLowerCase()
  const selectedCraftValue =
    state.bottleneckCraftCode && state.bottleneckProcessCode
      ? `${state.bottleneckProcessCode}::${state.bottleneckCraftCode}`
      : ''

  const filteredCraftRows = filterBottleneckCraftRows(bottleneck.craftRows, keyword)
  const filteredDateRows = filterBottleneckDateRows(bottleneck.dateRows, keyword)
  const filteredUnallocatedRows = filterBottleneckUnallocatedRows(bottleneck.unallocatedRows, keyword)
  const filteredUnscheduledRows = filterBottleneckUnscheduledRows(bottleneck.unscheduledRows, keyword)
  const summary = summarizeFilteredBottleneckData({
    craftRows: filteredCraftRows,
    dateRows: filteredDateRows,
    unallocatedRows: filteredUnallocatedRows,
    unscheduledRows: filteredUnscheduledRows,
  })

  const selectedCraftRow =
    filteredCraftRows.find((row) => row.rowKey === state.bottleneckCraftDetailKey) ?? filteredCraftRows[0] ?? null
  const selectedDateRow =
    filteredDateRows.find((row) => row.date === state.bottleneckDateDetailKey) ?? filteredDateRows[0] ?? null
  state.bottleneckCraftDetailKey = selectedCraftRow?.rowKey ?? ''
  state.bottleneckDateDetailKey = selectedDateRow?.date ?? ''

  return `
    <div class="space-y-6" data-capacity-bottleneck-page>
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-balance">工艺瓶颈与待分配</h1>
          <p class="mt-1 text-sm text-muted-foreground">当前页只看标准工时主线：工艺瓶颈看供给、已占用、已冻结与剩余；待分配和未排期需求单独留在需求池中，不会错误扣到具体工厂。</p>
        </div>
      </header>

      <section class="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6" data-bottleneck-kpis>
        ${renderStatCard('瓶颈工艺数', summary.bottleneckCraftCount)}
        ${renderStatCard('超载日期数', summary.overloadedDateCount)}
        ${renderMetricStatCard('待分配标准工时总量', formatSamValue(summary.unallocatedTotal), summary.unallocatedTotal > 0 ? 'text-orange-700' : '')}
        ${renderMetricStatCard('未排期标准工时总量', formatSamValue(summary.unscheduledTotal), summary.unscheduledTotal > 0 ? 'text-amber-700' : '')}
        ${renderMetricStatCard('最大单日缺口', formatSamValue(summary.maxDailyGapSam), summary.maxDailyGapSam > 0 ? 'text-red-600' : '')}
        ${renderMetricStatCard('最大工艺缺口', formatSamValue(summary.maxCraftGapSam), summary.maxCraftGapSam > 0 ? 'text-red-600' : '')}
      </section>

      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <input
          data-capacity-filter="bottleneck-keyword"
          value="${escapeHtml(state.bottleneckKeyword)}"
          placeholder="关键词（工序 / 工艺 / 日期 / 任务）"
          class="h-9 w-full rounded-md border bg-background px-3 text-sm"
        />
        <select data-capacity-filter="bottleneck-window-days" class="h-9 w-full rounded-md border bg-background px-3 text-sm">
          ${bottleneck.windowOptions
            .map((option) => `<option value="${option.value}" ${option.value === state.bottleneckWindowDays ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
            .join('')}
        </select>
        <select data-capacity-filter="bottleneck-process-code" class="h-9 w-full rounded-md border bg-background px-3 text-sm">
          <option value="">全部工序</option>
          ${bottleneck.processOptions
            .map((option) => `<option value="${escapeHtml(option.value)}" ${state.bottleneckProcessCode === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
            .join('')}
        </select>
        <select data-capacity-filter="bottleneck-craft-code" class="h-9 w-full rounded-md border bg-background px-3 text-sm">
          <option value="">全部工艺</option>
          ${bottleneck.craftOptions
            .map((option) => `<option value="${escapeHtml(option.value)}" ${selectedCraftValue === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
            .join('')}
        </select>
      </section>

      <section class="space-y-4">
        <div class="inline-flex rounded-md bg-muted p-1">
          ${renderTabButton('bottleneck', 'craft', state.bottleneckTab, '工艺瓶颈榜')}
          ${renderTabButton('bottleneck', 'date', state.bottleneckTab, '日期瓶颈榜')}
          ${renderTabButton('bottleneck', 'demand', state.bottleneckTab, '待分配 / 未排期')}
        </div>

        ${
          state.bottleneckTab === 'craft'
            ? `
              <div class="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
                <div class="rounded-md border">
                  <div class="border-b bg-muted/30 px-4 py-3">
                    <h2 class="text-sm font-semibold text-foreground">工艺瓶颈榜</h2>
                    <p class="mt-1 text-xs text-muted-foreground">按 工序 / 工艺 聚合窗口总供给、已占用、已冻结、剩余、待分配、未排期和最大缺口，默认按最大缺口倒序。</p>
                  </div>
                  <div class="overflow-x-auto">
                    <table class="w-full text-sm" data-bottleneck-craft-table>
                      <thead class="border-b bg-muted/40 text-muted-foreground">
                        <tr>
                          <th class="px-3 py-2 text-left font-medium">工序</th>
                          <th class="px-3 py-2 text-left font-medium">工艺</th>
                          <th class="px-3 py-2 text-right font-medium">窗口总供给标准工时</th>
                          <th class="px-3 py-2 text-right font-medium">窗口总已占用标准工时</th>
                          <th class="px-3 py-2 text-right font-medium">窗口总已冻结标准工时</th>
                          <th class="px-3 py-2 text-right font-medium">窗口总剩余标准工时</th>
                          <th class="px-3 py-2 text-center font-medium">超载天数</th>
                          <th class="px-3 py-2 text-center font-medium">紧张天数</th>
                          <th class="px-3 py-2 text-center font-medium">暂停天数</th>
                          <th class="px-3 py-2 text-center font-medium">涉及工厂数</th>
                          <th class="px-3 py-2 text-right font-medium">待分配标准工时</th>
                          <th class="px-3 py-2 text-right font-medium">未排期标准工时</th>
                          <th class="px-3 py-2 text-right font-medium">最大缺口</th>
                          <th class="px-3 py-2 text-right font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody>${renderBottleneckCraftTable(filteredCraftRows, selectedCraftRow?.rowKey ?? '')}</tbody>
                    </table>
                  </div>
                </div>
                ${renderBottleneckCraftDetailPanel(selectedCraftRow)}
              </div>
            `
            : state.bottleneckTab === 'date'
              ? `
                <div class="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
                  <div class="rounded-md border">
                    <div class="border-b bg-muted/30 px-4 py-3">
                      <h2 class="text-sm font-semibold text-foreground">日期瓶颈榜</h2>
                      <p class="mt-1 text-xs text-muted-foreground">按 日期 聚合全部工厂、全部工艺的标准工时供给、已占用、已冻结、剩余、待分配与最大缺口。</p>
                    </div>
                    <div class="overflow-x-auto">
                      <table class="w-full text-sm" data-bottleneck-date-table>
                        <thead class="border-b bg-muted/40 text-muted-foreground">
                          <tr>
                            <th class="px-3 py-2 text-left font-medium">日期</th>
                            <th class="px-3 py-2 text-right font-medium">当日总供给标准工时</th>
                            <th class="px-3 py-2 text-right font-medium">当日总已占用标准工时</th>
                            <th class="px-3 py-2 text-right font-medium">当日总已冻结标准工时</th>
                            <th class="px-3 py-2 text-right font-medium">当日总剩余标准工时</th>
                            <th class="px-3 py-2 text-center font-medium">当日超载工厂数</th>
                            <th class="px-3 py-2 text-center font-medium">当日超载工艺数</th>
                            <th class="px-3 py-2 text-center font-medium">当日暂停工厂数</th>
                            <th class="px-3 py-2 text-center font-medium">当日紧张工艺数</th>
                            <th class="px-3 py-2 text-right font-medium">当日待分配标准工时</th>
                            <th class="px-3 py-2 text-right font-medium">当日最大缺口</th>
                            <th class="px-3 py-2 text-right font-medium">操作</th>
                          </tr>
                        </thead>
                        <tbody>${renderBottleneckDateTable(filteredDateRows, selectedDateRow?.date ?? '')}</tbody>
                      </table>
                    </div>
                  </div>
                  ${renderBottleneckDateDetailPanel(selectedDateRow)}
                </div>
              `
              : `
                <div class="space-y-4">
                  ${renderBottleneckDemandTableSection(
                    '待分配需求',
                    '业务上仍未最终落厂的任务会继续留在需求池；如果已在多家工厂形成冻结，会同时占用这些工厂能力，但不会从待分配池消失。',
                    renderBottleneckUnallocatedTable(filteredUnallocatedRows),
                    'bottleneck-unallocated-section',
                  )}
                  ${renderBottleneckDemandTableSection(
                    '未排期需求',
                    '已有标准工时但缺少有效日期窗口的任务会单独列出，不会被强行落到某一天。',
                    renderBottleneckUnscheduledTable(filteredUnscheduledRows),
                    'bottleneck-unscheduled-section',
                  )}
                </div>
              `
        }
      </section>
    </div>
  `
}

export function renderCapacityConstraintsPage(): string {
  syncCapacityStateFromRoute()
  syncDispatchCapacityUsageLedger()
  const calendar = buildFactoryCalendarData({
    factoryId: state.constraintsFactoryId,
    windowDays: state.constraintsWindowDays,
    processCode: state.constraintsProcessCode || undefined,
    craftCode: state.constraintsCraftCode || undefined,
  })

  state.constraintsFactoryId = calendar.selectedFactoryId
  state.constraintsWindowDays = calendar.windowDays
  state.constraintsProcessCode = calendar.selectedProcessCode ?? ''
  state.constraintsCraftCode = calendar.selectedCraftCode ?? ''

  const scopedRows = state.routeContext.orderIds.length
    ? calendar.rows.filter((row) =>
        [...row.committedSources, ...row.frozenSources].some((source) => state.routeContext.orderIds.includes(source.productionOrderId)),
      )
    : calendar.rows
  const scopedTaskIds = new Set(scopedRows.flatMap((row) => [...row.committedSources, ...row.frozenSources].map((source) => source.taskId)))
  const scopedCraftKeys = new Set(scopedRows.map((row) => `${row.processCode}::${row.craftCode}`))
  const scopedSummary = state.routeContext.orderIds.length
    ? {
        supplyTotal: scopedRows.reduce((sum, row) => sum + row.supplySam, 0),
        committedTotal: scopedRows.reduce((sum, row) => sum + row.committedSam, 0),
        frozenTotal: scopedRows.reduce((sum, row) => sum + row.frozenSam, 0),
        remainingTotal: scopedRows.reduce((sum, row) => sum + row.remainingSam, 0),
        craftCount: scopedCraftKeys.size,
        taskCount: scopedTaskIds.size,
        normalCount: scopedRows.filter((row) => row.status === 'NORMAL').length,
        tightCount: scopedRows.filter((row) => row.status === 'TIGHT').length,
        overloadedCount: scopedRows.filter((row) => row.status === 'OVERLOADED').length,
        pausedCount: scopedRows.filter((row) => row.status === 'PAUSED').length,
      }
    : calendar.summary

  const totalPages = Math.max(1, Math.ceil(scopedRows.length / FACTORY_CALENDAR_PAGE_SIZE))
  if (state.constraintsCurrentPage > totalPages) {
    state.constraintsCurrentPage = totalPages
  }
  if (state.constraintsCurrentPage < 1) {
    state.constraintsCurrentPage = 1
  }

  const selectedRow =
    scopedRows.find((row) => row.rowKey === state.constraintsDetailRowKey)
    ?? scopedRows[0]
    ?? null

  state.constraintsDetailRowKey = selectedRow?.rowKey ?? ''

  const windowText = calendar.dates.length
    ? `${calendar.dates[0]} 至 ${calendar.dates[calendar.dates.length - 1]}`
    : '暂无日期窗口'
  const selectedCraftValue =
    calendar.selectedCraftCode && calendar.selectedProcessCode
      ? `${calendar.selectedProcessCode}::${calendar.selectedCraftCode}`
      : ''

  return `
    <div class="space-y-5" data-testid="capacity-constraints-page">
      <header class="space-y-1" data-testid="capacity-constraints-header">
        <div class="space-y-1">
          <h1 class="text-2xl font-bold tracking-tight">工厂日历</h1>
          <p class="text-sm text-muted-foreground">${escapeHtml(calendar.selectedFactoryName)} / 当前窗口 ${escapeHtml(windowText)}</p>
        </div>
      </header>

      ${renderCapacityRouteContextBanner('constraints')}

      <p class="text-sm text-muted-foreground" data-testid="capacity-constraints-hint">当前页展示选定工厂在窗口内各工序 / 工艺的标准工时供需事实，待分配需求不扣到工厂。</p>

      <section class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6" data-testid="capacity-constraints-kpis">
        ${renderMetricStatCard('窗口总供给标准工时', formatSamValue(scopedSummary.supplyTotal))}
        ${renderMetricStatCard('窗口已占用标准工时', formatSamValue(scopedSummary.committedTotal), scopedSummary.committedTotal > 0 ? 'text-blue-700' : '')}
        ${renderMetricStatCard('窗口已冻结标准工时', formatSamValue(scopedSummary.frozenTotal), scopedSummary.frozenTotal > 0 ? 'text-amber-700' : '')}
        ${renderMetricStatCard('窗口剩余标准工时', formatSamValue(scopedSummary.remainingTotal), scopedSummary.remainingTotal < 0 ? 'text-red-600' : 'text-green-700')}
        ${renderStatCard('覆盖工艺数', scopedSummary.craftCount)}
        ${renderStatCard('涉及任务数', scopedSummary.taskCount)}
      </section>

      <section class="grid gap-3 rounded-xl bg-slate-50/80 p-4 md:grid-cols-2 xl:grid-cols-4" data-testid="capacity-constraints-filters">
        <label class="space-y-1 text-sm">
          <span class="text-muted-foreground">工厂</span>
          <select data-capacity-filter="constraints-factory-id" class="h-9 w-full rounded-md border bg-background px-3 text-sm">
            ${calendar.factoryOptions
              .map(
                (factory) => `<option value="${escapeHtml(factory.id)}" ${factory.id === calendar.selectedFactoryId ? 'selected' : ''}>${escapeHtml(factory.label)}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="space-y-1 text-sm">
          <span class="text-muted-foreground">日期窗口</span>
          <select data-capacity-filter="constraints-window-days" class="h-9 w-full rounded-md border bg-background px-3 text-sm">
            ${calendar.windowOptions
              .map(
                (option) => `<option value="${option.value}" ${option.value === calendar.windowDays ? 'selected' : ''}>${escapeHtml(option.label)}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="space-y-1 text-sm">
          <span class="text-muted-foreground">工序</span>
          <select data-capacity-filter="constraints-process-code" class="h-9 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">全部工序</option>
            ${calendar.processOptions
              .map(
                (process) => `<option value="${escapeHtml(process.processCode)}" ${process.processCode === calendar.selectedProcessCode ? 'selected' : ''}>${escapeHtml(process.processName)}</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="space-y-1 text-sm">
          <span class="text-muted-foreground">工艺</span>
          <select data-capacity-filter="constraints-craft-code" class="h-9 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">全部工艺</option>
            ${calendar.craftOptions
              .map(
                (craft) => `<option value="${escapeHtml(`${craft.processCode}::${craft.craftCode}`)}" ${`${craft.processCode}::${craft.craftCode}` === selectedCraftValue ? 'selected' : ''}>${escapeHtml(formatCapacityScopeText(craft.processName, craft.craftName))}</option>`,
              )
              .join('')}
          </select>
        </label>
      </section>

      <section class="grid gap-6 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,1fr)]" data-testid="capacity-constraints-main">
        <div class="space-y-3">
          <section class="overflow-hidden rounded-xl border bg-card" data-testid="factory-calendar-table-section">
            <div class="border-b bg-muted/20 px-4 py-3">
              <h2 class="text-sm font-semibold text-foreground">每日供需主表</h2>
              <p class="mt-1 text-xs text-muted-foreground">按日期、工序、工艺查看窗口内每日供给、占用、冻结与剩余标准工时。</p>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm" data-factory-calendar-table>
                <thead class="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2 text-left font-medium">日期</th>
                    <th class="px-3 py-2 text-left font-medium">工序</th>
                    <th class="px-3 py-2 text-left font-medium">工艺</th>
                    <th class="px-3 py-2 text-right font-medium">供给标准工时</th>
                    <th class="px-3 py-2 text-right font-medium">已占用标准工时</th>
                    <th class="px-3 py-2 text-right font-medium">已冻结标准工时</th>
                    <th class="px-3 py-2 text-right font-medium">剩余标准工时</th>
                    <th class="px-3 py-2 text-left font-medium">当前状态</th>
                    <th class="px-3 py-2 text-center font-medium">占用任务数</th>
                    <th class="px-3 py-2 text-center font-medium">冻结任务数</th>
                  </tr>
                </thead>
                <tbody>${renderFactoryCalendarMainTable(scopedRows, selectedRow?.rowKey ?? '')}</tbody>
              </table>
            </div>
            ${renderFactoryCalendarPagination(scopedRows.length)}
          </section>
          <p class="text-xs text-muted-foreground" data-testid="factory-calendar-count-rule-note">${escapeHtml(calendar.countRuleNote)}</p>
        </div>

        ${renderFactoryCalendarDetailPanel(calendar, selectedRow)}
      </section>
    </div>
  `
}

function renderCapacityPoliciesOverrideDrawer(): string {
  if (!state.policiesEditorMode) return ''

  const factoryOptions = getPoliciesFactoryOptions()
  const selectedFactoryId = state.policiesForm.factoryId || factoryOptions[0]?.value || ''
  const processOptions = selectedFactoryId ? getPoliciesProcessOptions(selectedFactoryId) : []
  const selectedProcessCode =
    state.policiesForm.processCode && processOptions.some((item) => item.value === state.policiesForm.processCode)
      ? state.policiesForm.processCode
      : ''
  const craftOptions = selectedFactoryId && selectedProcessCode ? getPoliciesCraftOptions(selectedFactoryId, selectedProcessCode) : []
  const title = state.policiesEditorMode === 'edit' ? '编辑暂停例外' : '新增暂停例外'

  return `
    <div class="fixed inset-0 z-50" data-testid="capacity-policies-override-drawer">
      <button
        class="absolute inset-0 bg-black/45"
        data-capacity-action="close-policies-editor"
        aria-label="关闭暂停例外抽屉"
      ></button>
      <section class="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col overflow-hidden border-l bg-background shadow-2xl">
        <header class="flex items-start justify-between border-b px-6 py-5">
          <div>
            <h2 class="text-lg font-semibold text-foreground">${title}</h2>
            <p class="mt-1 text-sm text-muted-foreground">当前阶段仅维护暂停例外，支持整厂、工序、工艺三个层级。</p>
          </div>
          <button type="button" data-capacity-action="close-policies-editor" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">关闭</button>
        </header>
        <div class="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          ${
            state.policiesFormError
              ? `<div class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">${escapeHtml(state.policiesFormError)}</div>`
              : ''
          }
          <div class="grid gap-4 md:grid-cols-2">
            <label class="space-y-2 text-sm">
              <span class="font-medium text-foreground">工厂</span>
              <select
                data-capacity-policies-field="factoryId"
                class="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">请选择工厂</option>
                ${factoryOptions
                  .map(
                    (option) => `
                      <option value="${escapeHtml(option.value)}" ${option.value === selectedFactoryId ? 'selected' : ''}>${escapeHtml(option.label)}</option>
                    `,
                  )
                  .join('')}
              </select>
            </label>
            <label class="space-y-2 text-sm">
              <span class="font-medium text-foreground">工序（可选）</span>
              <select
                data-capacity-policies-field="processCode"
                class="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">整厂暂停</option>
                ${processOptions
                  .map(
                    (option) => `
                      <option value="${escapeHtml(option.value)}" ${option.value === selectedProcessCode ? 'selected' : ''}>${escapeHtml(option.label)}</option>
                    `,
                  )
                  .join('')}
              </select>
            </label>
            <label class="space-y-2 text-sm">
              <span class="font-medium text-foreground">工艺（可选）</span>
              <select
                data-capacity-policies-field="craftCode"
                class="h-10 w-full rounded-md border bg-background px-3 text-sm"
                ${selectedProcessCode ? '' : 'disabled'}
              >
                <option value="">${selectedProcessCode ? '整工序暂停' : '请先选择工序'}</option>
                ${craftOptions
                  .map(
                    (option) => `
                      <option value="${escapeHtml(option.value)}" ${option.value === state.policiesForm.craftCode ? 'selected' : ''}>${escapeHtml(option.label)}</option>
                    `,
                  )
                  .join('')}
              </select>
            </label>
            <div class="rounded-lg bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <div class="font-medium text-foreground">作用范围规则</div>
              <div class="mt-1 leading-6">仅选工厂 = 整厂暂停；工厂 + 工序 = 工序暂停；工厂 + 工序 + 工艺 = 工艺暂停。</div>
            </div>
            <label class="space-y-2 text-sm">
              <span class="font-medium text-foreground">起始日期</span>
              <input
                type="date"
                data-capacity-policies-field="startDate"
                value="${escapeHtml(state.policiesForm.startDate)}"
                class="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </label>
            <label class="space-y-2 text-sm">
              <span class="font-medium text-foreground">结束日期</span>
              <input
                type="date"
                data-capacity-policies-field="endDate"
                value="${escapeHtml(state.policiesForm.endDate)}"
                class="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </label>
          </div>
          <label class="space-y-2 text-sm">
            <span class="font-medium text-foreground">原因</span>
            <input
              type="text"
              data-capacity-policies-field="reason"
              value="${escapeHtml(state.policiesForm.reason)}"
              placeholder="例如：整厂盘点、关键工艺设备检修"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </label>
          <label class="space-y-2 text-sm">
            <span class="font-medium text-foreground">说明（可选）</span>
            <textarea
              data-capacity-policies-field="note"
              rows="4"
              placeholder="补充说明此次暂停例外的背景、范围或恢复条件"
              class="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >${escapeHtml(state.policiesForm.note)}</textarea>
          </label>
        </div>
        <footer class="flex items-center justify-end gap-3 border-t px-6 py-4">
          <button type="button" data-capacity-action="close-policies-editor" class="rounded-md border px-4 py-2 text-sm hover:bg-muted">取消</button>
          <button type="button" data-capacity-action="submit-policies-editor" class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">保存</button>
        </footer>
      </section>
    </div>
  `
}

export function renderCapacityPoliciesPage(): string {
  const calendarData = buildCapacityCalendarData()
  const overrideSourceRows = listCapacityCalendarOverrides()
  const overrideSourceMap = new Map(overrideSourceRows.map((item) => [item.id, item]))
  const overrideRows = calendarData.pauseOverrideRows.map((row) => {
    const source = overrideSourceMap.get(row.id)
    const stateMeta = resolvePoliciesOverrideStateLabel(row.startDate, row.endDate)
    return {
      ...row,
      reason: source?.reason ?? row.reason,
      note: source?.note ?? row.note ?? '',
      stateLabel: stateMeta.label,
      stateTone: stateMeta.tone,
    }
  })

  const overrideRowsHtml =
    overrideRows.length === 0
      ? '<tr><td colspan="8" class="px-4 py-10 text-center text-sm text-muted-foreground">当前暂无暂停例外，可按整厂、工序或工艺新增。</td></tr>'
      : overrideRows
          .map((row) => {
            const scopeText = row.craftName
              ? formatCapacityScopeText(row.processName ?? row.processCode, row.craftName)
              : row.processName ?? '整厂暂停'
            const actionLabel = row.stateLabel === '生效中' ? '失效' : '删除'
            return `
              <tr class="border-b last:border-0">
                <td class="px-4 py-3 text-sm">
                  <div class="font-medium text-foreground">${escapeHtml(row.factoryName)}</div>
                  <div class="mt-1">${renderBadge(row.stateLabel, row.stateTone)}</div>
                </td>
                <td class="px-4 py-3 text-sm text-muted-foreground">${escapeHtml(scopeText)}</td>
                <td class="px-4 py-3 text-sm">${escapeHtml(row.startDate)}</td>
                <td class="px-4 py-3 text-sm">${escapeHtml(row.endDate)}</td>
                <td class="px-4 py-3 text-sm">${escapeHtml(row.reason)}</td>
                <td class="px-4 py-3 text-sm text-muted-foreground">${escapeHtml(row.note || '—')}</td>
                <td class="px-4 py-3 text-sm text-muted-foreground">${escapeHtml(row.scopeLabel)}</td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-2">
                    <button type="button" data-capacity-action="open-policies-editor" data-override-id="${escapeHtml(row.id)}" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">编辑</button>
                    <button type="button" data-capacity-action="remove-policies-override" data-override-id="${escapeHtml(row.id)}" class="rounded-md border px-3 py-1.5 text-xs text-red-700 hover:bg-red-50">${actionLabel}</button>
                  </div>
                </td>
              </tr>
            `
          })
          .join('')

  return `
    <div class="space-y-6" data-testid="capacity-policies-page">
      <header>
        <h1 class="text-2xl font-semibold text-foreground">暂停例外</h1>
      </header>

      ${
        state.policiesNotice
          ? `<div class="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">${escapeHtml(state.policiesNotice)}</div>`
          : ''
      }

      <section class="rounded-lg border bg-card px-5 py-5" data-testid="capacity-policies-tips-section">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-foreground">当前阶段口径</h2>
            <p class="mt-1 text-sm text-muted-foreground">这一步先收轻规则提示，人工动态维护入口只有“暂停例外”。</p>
          </div>
          ${renderBadge('当前阶段仅支持暂停', 'outline')}
        </div>
        <ul class="mt-4 space-y-2 text-sm text-muted-foreground">
          <li>1. 供给来自产能档案自动计算的默认日可供给标准工时。</li>
          <li>2. 需求来自任务总标准工时。</li>
          <li>3. 剩余 = 供给 - 已占用 - 已冻结。</li>
          <li>4. 待分配需求不会提前扣到具体工厂。</li>
          <li>5. 当前阶段人工动态例外只支持整厂、工序、工艺三级暂停。</li>
        </ul>
      </section>

      <section class="rounded-lg border bg-card px-5 py-5" data-testid="capacity-policies-overrides-section">
        <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2 class="text-lg font-semibold text-foreground">暂停例外</h2>
            <p class="mt-1 text-sm text-muted-foreground">当前阶段唯一人工维护的动态例外入口。整厂、工序、工艺三级暂停都在这里维护。</p>
          </div>
          <button type="button" data-capacity-action="open-policies-editor" class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">新增暂停例外</button>
        </div>
        <div class="mt-4 overflow-x-auto rounded-md border">
          <table class="w-full text-sm">
            <thead class="border-b bg-muted/40 text-muted-foreground">
              <tr>
                <th class="px-4 py-3 text-left font-medium">工厂</th>
                <th class="px-4 py-3 text-left font-medium">工序 / 工艺</th>
                <th class="px-4 py-3 text-left font-medium">起始日期</th>
                <th class="px-4 py-3 text-left font-medium">结束日期</th>
                <th class="px-4 py-3 text-left font-medium">原因</th>
                <th class="px-4 py-3 text-left font-medium">说明</th>
                <th class="px-4 py-3 text-left font-medium">作用范围</th>
                <th class="px-4 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody>${overrideRowsHtml}</tbody>
          </table>
        </div>
      </section>

      ${renderCapacityPoliciesOverrideDrawer()}
    </div>
  `
}

export function handleCapacityEvent(target: HTMLElement): boolean {
  const policiesFieldNode = target.closest<HTMLElement>('[data-capacity-policies-field]')
  if (
    policiesFieldNode instanceof HTMLInputElement ||
    policiesFieldNode instanceof HTMLSelectElement ||
    policiesFieldNode instanceof HTMLTextAreaElement
  ) {
    const field = policiesFieldNode.dataset.capacityPoliciesField as keyof CapacityPoliciesFormState | undefined
    if (!field) return false
    const value = policiesFieldNode.value

    if (field === 'factoryId') {
      state.policiesForm.factoryId = value
      state.policiesForm.processCode = ''
      state.policiesForm.craftCode = ''
    } else if (field === 'processCode') {
      state.policiesForm.processCode = value
      state.policiesForm.craftCode = ''
    } else {
      state.policiesForm[field] = value
    }
    state.policiesFormError = ''
    state.policiesNotice = ''
    return true
  }

  const filterNode = target.closest<HTMLElement>('[data-capacity-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const filter = filterNode.dataset.capacityFilter
    const value = filterNode.value

    if (filter === 'overview-keyword') state.overviewKeyword = value
    if (filter === 'risk-keyword') state.riskKeyword = value
    if (filter === 'risk-window-days') {
      const days = Number(value)
      state.riskWindowDays = days === 7 || days === 30 ? days : 15
    }
    if (filter === 'risk-process-code') {
      state.riskProcessCode = value
      state.riskCraftCode = ''
    }
    if (filter === 'risk-craft-code') {
      state.riskCraftCode = value
      if (value) {
        const [processCode] = value.split('::')
        state.riskProcessCode = processCode ?? ''
      }
    }
    if (filter === 'risk-conclusion') state.riskConclusion = value
    if (filter === 'bottleneck-keyword') state.bottleneckKeyword = value
    if (filter === 'bottleneck-window-days') {
      const days = Number(value)
      state.bottleneckWindowDays = days === 7 || days === 30 ? days : 15
      state.bottleneckCraftDetailKey = ''
      state.bottleneckDateDetailKey = ''
    }
    if (filter === 'bottleneck-process-code') {
      state.bottleneckProcessCode = value
      state.bottleneckCraftCode = ''
      state.bottleneckCraftDetailKey = ''
      state.bottleneckDateDetailKey = ''
    }
    if (filter === 'bottleneck-craft-code') {
      if (!value) {
        state.bottleneckCraftCode = ''
      } else {
        const [processCode, craftCode] = value.split('::')
        state.bottleneckProcessCode = processCode ?? ''
        state.bottleneckCraftCode = craftCode ?? ''
      }
      state.bottleneckCraftDetailKey = ''
      state.bottleneckDateDetailKey = ''
    }
    if (filter === 'constraints-factory-id') {
      state.constraintsFactoryId = value
      state.constraintsProcessCode = ''
      state.constraintsCraftCode = ''
      state.constraintsCurrentPage = 1
      state.constraintsDetailRowKey = ''
    }
    if (filter === 'constraints-window-days') {
      const days = Number(value)
      state.constraintsWindowDays = days === 7 || days === 30 ? days : 15
      state.constraintsCurrentPage = 1
      state.constraintsDetailRowKey = ''
    }
    if (filter === 'constraints-process-code') {
      state.constraintsProcessCode = value
      state.constraintsCraftCode = ''
      state.constraintsCurrentPage = 1
      state.constraintsDetailRowKey = ''
    }
    if (filter === 'constraints-craft-code') {
      if (!value) {
        state.constraintsCraftCode = ''
      } else {
        const [processCode, craftCode] = value.split('::')
        state.constraintsProcessCode = processCode ?? ''
        state.constraintsCraftCode = craftCode ?? ''
      }
      state.constraintsCurrentPage = 1
      state.constraintsDetailRowKey = ''
    }

    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-capacity-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.capacityAction
  if (!action) return false

  if (action === 'switch-tab') {
    const page = actionNode.dataset.page
    const tab = actionNode.dataset.tab

    if (page === 'overview' && (tab === 'comparison' || tab === 'unallocated' || tab === 'unscheduled')) {
      state.overviewTab = tab
      return true
    }

    if (page === 'risk' && (tab === 'task' || tab === 'order')) {
      state.riskTab = tab
      return true
    }

    if (page === 'bottleneck' && (tab === 'craft' || tab === 'date' || tab === 'demand')) {
      state.bottleneckTab = tab
      return true
    }

    return true
  }

  if (action === 'open-policies-editor') {
    const overrideId = actionNode.dataset.overrideId ?? ''
    openPoliciesEditor(overrideId ? 'edit' : 'create', overrideId)
    return true
  }

  if (action === 'close-policies-editor') {
    closePoliciesEditor()
    return true
  }

  if (action === 'submit-policies-editor') {
    try {
      const input = buildPoliciesOverrideInput()
      if (state.policiesEditorMode === 'edit' && state.policiesEditingOverrideId) {
        updateCapacityCalendarOverride(state.policiesEditingOverrideId, input)
        state.policiesNotice = '暂停例外已更新。'
      } else {
        createCapacityCalendarOverride(input)
        state.policiesNotice = '暂停例外已新增。'
      }
      closePoliciesEditor()
      return true
    } catch (error) {
      state.policiesFormError = error instanceof Error ? error.message : '暂停例外保存失败'
      return true
    }
  }

  if (action === 'remove-policies-override') {
    const overrideId = actionNode.dataset.overrideId ?? ''
    if (!overrideId) return true
    const current = getCapacityCalendarOverrideById(overrideId)
    const today = new Date().toISOString().slice(0, 10)
    if (current && current.startDate <= today && current.endDate >= today) {
      if (current.startDate === today) {
        removeCapacityCalendarOverride(overrideId)
        state.policiesNotice = '暂停例外已删除。'
      } else {
        const yesterday = new Date(`${today}T00:00:00`)
        yesterday.setDate(yesterday.getDate() - 1)
        expireCapacityCalendarOverride(overrideId, yesterday.toISOString().slice(0, 10))
        state.policiesNotice = '暂停例外已失效。'
      }
    } else {
      removeCapacityCalendarOverride(overrideId)
      state.policiesNotice = '暂停例外已删除。'
    }
    if (state.policiesEditingOverrideId === overrideId) {
      closePoliciesEditor()
    }
    return true
  }

  if (action === 'open-factory-calendar-detail') {
    const rowKey = actionNode.dataset.rowKey ?? ''
    state.constraintsDetailRowKey = rowKey
    return true
  }

  if (action === 'open-bottleneck-craft-detail') {
    state.bottleneckCraftDetailKey = actionNode.dataset.rowKey ?? ''
    return true
  }

  if (action === 'open-bottleneck-date-detail') {
    state.bottleneckDateDetailKey = actionNode.dataset.date ?? ''
    return true
  }

  if (action === 'factory-calendar-prev-page') {
    state.constraintsCurrentPage = Math.max(1, state.constraintsCurrentPage - 1)
    return true
  }

  if (action === 'factory-calendar-next-page') {
    state.constraintsCurrentPage += 1
    return true
  }

  if (action === 'factory-calendar-goto-page') {
    const page = Number(actionNode.dataset.page)
    if (Number.isFinite(page) && page > 0) {
      state.constraintsCurrentPage = page
    }
    return true
  }

  return false
}
