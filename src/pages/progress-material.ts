import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { productionOrders } from '../data/fcs/production-orders'
import {
  getTaskTypeLabel,
  listMaterialRequests,
  listMaterialRequestsByOrder,
  type MaterialRequestRecord,
} from '../data/fcs/material-request-drafts'
import {
  getWarehouseExecutionDocById,
  getWarehouseExecutionSummaryByOrder,
  listWarehouseExecutionDocsByMaterialRequestNo,
  listWarehouseExecutionDocsByOrder,
  type WarehouseExecutionDoc,
  type WarehouseExecutionDocType,
  type WarehouseExecutionStatus,
} from '../data/fcs/warehouse-material-execution'
import {
  getRuntimeTaskById,
  isRuntimeTaskExecutionTask,
  listRuntimeTasksByBaseTaskId,
  type RuntimeProcessTask,
} from '../data/fcs/runtime-process-tasks'

type ExecutionStatusFilter = 'ALL' | 'NO_DOC' | WarehouseExecutionStatus

type HasShortageFilter = 'ALL' | 'YES' | 'NO'

interface MaterialProgressState {
  keyword: string
  executionStatus: ExecutionStatusFilter
  hasShortage: HasShortageFilter
  deliveryDateFrom: string
  deliveryDateTo: string

  drawerOpen: boolean
  selectedDocId: string | null
  docTypeFilter: 'ALL' | WarehouseExecutionDocType
  notFoundDocId: string | null
  activePoId: string | null
  lastQueryKey: string
}

interface OrderExecutionRow {
  productionOrderId: string
  legacyOrderNo: string
  spuCode: string
  spuName: string
  mainFactoryName: string
  requiredDeliveryDate: string
  summary: ReturnType<typeof getWarehouseExecutionSummaryByOrder>
  latestDoc: WarehouseExecutionDoc | null
}

const DOC_TYPE_LABEL: Record<WarehouseExecutionDocType, string> = {
  ISSUE: '仓库发料单',
  RETURN: '工序回货单',
  INTERNAL_TRANSFER: '仓内流转单',
}

const EXECUTION_STATUS_LABEL: Record<WarehouseExecutionStatus, string> = {
  PLANNED: '待生成',
  PREPARING: '待备料',
  PARTIALLY_PREPARED: '部分备齐',
  READY: '已备齐待出库',
  ISSUED: '已发料',
  IN_TRANSIT: '在途',
  RECEIVED: '已接收',
  PARTIALLY_RETURNED: '部分回货',
  RETURNED: '已回货',
  CLOSED: '已关闭',
}

const TARGET_TYPE_LABEL: Record<'EXTERNAL_FACTORY' | 'WAREHOUSE_WORKSHOP', string> = {
  EXTERNAL_FACTORY: '外部工厂',
  WAREHOUSE_WORKSHOP: '仓内后道',
}

const STATUS_VARIANT_CLASS_MAP: Record<WarehouseExecutionStatus, string> = {
  PLANNED: 'border-slate-200 bg-slate-50 text-slate-700',
  PREPARING: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  PARTIALLY_PREPARED: 'border-orange-200 bg-orange-50 text-orange-700',
  READY: 'border-blue-200 bg-blue-50 text-blue-700',
  ISSUED: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  IN_TRANSIT: 'border-violet-200 bg-violet-50 text-violet-700',
  RECEIVED: 'border-teal-200 bg-teal-50 text-teal-700',
  PARTIALLY_RETURNED: 'border-amber-200 bg-amber-50 text-amber-700',
  RETURNED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CLOSED: 'border-zinc-200 bg-zinc-50 text-zinc-700',
}

const state: MaterialProgressState = {
  keyword: '',
  executionStatus: 'ALL',
  hasShortage: 'ALL',
  deliveryDateFrom: '',
  deliveryDateTo: '',

  drawerOpen: false,
  selectedDocId: null,
  docTypeFilter: 'ALL',
  notFoundDocId: null,
  activePoId: null,
  lastQueryKey: '',
}

const executionStatusOptions: Array<{ value: ExecutionStatusFilter; label: string }> = [
  { value: 'ALL', label: '全部' },
  { value: 'NO_DOC', label: '未生成执行单' },
  { value: 'PLANNED', label: EXECUTION_STATUS_LABEL.PLANNED },
  { value: 'PREPARING', label: EXECUTION_STATUS_LABEL.PREPARING },
  { value: 'PARTIALLY_PREPARED', label: EXECUTION_STATUS_LABEL.PARTIALLY_PREPARED },
  { value: 'READY', label: EXECUTION_STATUS_LABEL.READY },
  { value: 'ISSUED', label: EXECUTION_STATUS_LABEL.ISSUED },
  { value: 'IN_TRANSIT', label: EXECUTION_STATUS_LABEL.IN_TRANSIT },
  { value: 'RECEIVED', label: EXECUTION_STATUS_LABEL.RECEIVED },
  { value: 'PARTIALLY_RETURNED', label: EXECUTION_STATUS_LABEL.PARTIALLY_RETURNED },
  { value: 'RETURNED', label: EXECUTION_STATUS_LABEL.RETURNED },
  { value: 'CLOSED', label: EXECUTION_STATUS_LABEL.CLOSED },
]

const hasShortageOptions: Array<{ value: HasShortageFilter; label: string }> = [
  { value: 'ALL', label: '全部' },
  { value: 'YES', label: '是' },
  { value: 'NO', label: '否' },
]

function getCurrentQueryString(): string {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return query ?? ''
}

function getCurrentSearchParams(): URLSearchParams {
  return new URLSearchParams(getCurrentQueryString())
}

function buildQuery(params: { po?: string | null; docId?: string | null }): string {
  const search = new URLSearchParams()
  if (params.po) search.set('po', params.po)
  if (params.docId) search.set('docId', params.docId)
  const query = search.toString()
  return query ? `?${query}` : ''
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

function toTimeNumber(value: string | undefined): number {
  if (!value) return 0
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const time = new Date(normalized).getTime()
  return Number.isFinite(time) ? time : 0
}

function formatPercent(value: number): string {
  const safe = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  return `${safe}%`
}

function renderProgressBar(percent: number, widthClass: string): string {
  const safePercent = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0))
  return `
    <div class="flex items-center gap-2">
      <span class="${widthClass} overflow-hidden rounded-full bg-muted">
        <span class="block h-full rounded-full bg-blue-600" style="width:${safePercent}%"></span>
      </span>
      <span class="text-sm">${safePercent}%</span>
    </div>
  `
}

function resolveRuntimeTaskForRequest(request: MaterialRequestRecord): RuntimeProcessTask | null {
  const direct = getRuntimeTaskById(request.taskId)
  if (direct && isRuntimeTaskExecutionTask(direct)) return direct

  const baseMatches = listRuntimeTasksByBaseTaskId(request.taskId).filter((task) =>
    isRuntimeTaskExecutionTask(task),
  )
  if (baseMatches.length === 0) return null
  if (baseMatches.length === 1) return baseMatches[0]

  const matchedByTaskNo = baseMatches.find((task) => (task.taskNo || task.taskId) === request.taskNo)
  if (matchedByTaskNo) return matchedByTaskNo

  const orderScope = baseMatches.find((task) => task.scopeType === 'ORDER')
  return orderScope ?? baseMatches[0]
}

function formatTaskScope(task: RuntimeProcessTask | null): string {
  if (!task) return '整单'
  if (task.scopeType === 'SKU') {
    const parts = [task.skuCode, task.skuColor, task.skuSize].filter(Boolean)
    return parts.length > 0 ? parts.join(' / ') : task.scopeLabel
  }
  return task.scopeLabel
}

function getOrderRows(): OrderExecutionRow[] {
  return productionOrders.map((order) => {
    const docs = listWarehouseExecutionDocsByOrder(order.productionOrderId)
    return {
      productionOrderId: order.productionOrderId,
      legacyOrderNo: order.legacyOrderNo,
      spuCode: order.demandSnapshot.spuCode,
      spuName: order.demandSnapshot.spuName,
      mainFactoryName: order.mainFactorySnapshot.name,
      requiredDeliveryDate: order.demandSnapshot.requiredDeliveryDate ?? '-',
      summary: getWarehouseExecutionSummaryByOrder(order.productionOrderId),
      latestDoc: docs[0] ?? null,
    }
  })
}

function getFilteredOrderRows(rows: OrderExecutionRow[]): OrderExecutionRow[] {
  const keyword = state.keyword.trim().toLowerCase()

  return rows.filter((row) => {
    if (keyword) {
      const haystack = `${row.productionOrderId} ${row.legacyOrderNo} ${row.spuCode} ${row.spuName} ${row.mainFactoryName}`.toLowerCase()
      if (!haystack.includes(keyword)) return false
    }

    if (state.executionStatus !== 'ALL') {
      if (state.executionStatus === 'NO_DOC') {
        if (row.latestDoc) return false
      } else if (row.latestDoc?.status !== state.executionStatus) {
        return false
      }
    }

    if (state.hasShortage === 'YES' && row.summary.shortLineCount === 0) return false
    if (state.hasShortage === 'NO' && row.summary.shortLineCount > 0) return false

    if (state.deliveryDateFrom && row.requiredDeliveryDate < state.deliveryDateFrom) return false
    if (state.deliveryDateTo && row.requiredDeliveryDate > state.deliveryDateTo) return false

    return true
  })
}

function filterMaterialRequestsByKeyword(rows: MaterialRequestRecord[]): MaterialRequestRecord[] {
  const keyword = state.keyword.trim().toLowerCase()
  if (!keyword) return rows

  return rows.filter((row) => {
    const runtimeTask = resolveRuntimeTaskForRequest(row)
    const scopeLabel = formatTaskScope(runtimeTask)
    const haystack = `${row.productionOrderNo} ${row.taskName} ${getTaskTypeLabel(row.taskType)} ${row.materialRequestNo} ${row.materialSummary} ${scopeLabel}`.toLowerCase()
    return haystack.includes(keyword)
  })
}

function getAggregatedSummary(rows: OrderExecutionRow[]): {
  requestCount: number
  issueOrderCount: number
  returnOrderCount: number
  internalTransferCount: number
  shortLineCount: number
  completionRate: number
  completenessRate: number
} {
  const totals = rows.reduce(
    (acc, row) => {
      acc.requestCount += row.summary.requestCount
      acc.issueOrderCount += row.summary.issueOrderCount
      acc.returnOrderCount += row.summary.returnOrderCount
      acc.internalTransferCount += row.summary.internalTransferCount
      acc.shortLineCount += row.summary.shortLineCount
      acc.totalCompletion += row.summary.completionRate
      acc.totalCompleteness += row.summary.completenessRate
      return acc
    },
    {
      requestCount: 0,
      issueOrderCount: 0,
      returnOrderCount: 0,
      internalTransferCount: 0,
      shortLineCount: 0,
      totalCompletion: 0,
      totalCompleteness: 0,
    },
  )

  const divisor = rows.length > 0 ? rows.length : 1
  return {
    requestCount: totals.requestCount,
    issueOrderCount: totals.issueOrderCount,
    returnOrderCount: totals.returnOrderCount,
    internalTransferCount: totals.internalTransferCount,
    shortLineCount: totals.shortLineCount,
    completionRate: Math.round(totals.totalCompletion / divisor),
    completenessRate: Math.round(totals.totalCompleteness / divisor),
  }
}

function renderMaterialRequestSection(rows: MaterialRequestRecord[]): string {
  return `
    <section class="rounded-lg border bg-card">
      <header class="flex items-center justify-between px-4 pb-3 pt-4">
        <div>
          <h2 class="text-base font-semibold">正式领料需求跟踪</h2>
          <p class="text-xs text-muted-foreground">正式需求已联动仓库执行对象，按执行范围展示进度</p>
        </div>
        <span class="text-xs text-muted-foreground">共 ${rows.length} 条</span>
      </header>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1260px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-left">
              <th class="px-3 py-2 font-medium">生产单号</th>
              <th class="px-3 py-2 font-medium">任务名称</th>
              <th class="px-3 py-2 font-medium">执行范围</th>
              <th class="px-3 py-2 font-medium">执行方</th>
              <th class="px-3 py-2 font-medium">领料需求编号</th>
              <th class="px-3 py-2 font-medium">领料方式</th>
              <th class="px-3 py-2 font-medium">物料说明</th>
              <th class="px-3 py-2 font-medium">仓库执行状态</th>
              <th class="px-3 py-2 font-medium">最近更新时间</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length === 0
                ? `
                    <tr>
                      <td colspan="9" class="px-3 py-8 text-center text-muted-foreground">暂无已创建领料需求</td>
                    </tr>
                  `
                : rows
                    .map((row) => {
                      const runtimeTask = resolveRuntimeTaskForRequest(row)
                      const docs = listWarehouseExecutionDocsByMaterialRequestNo(row.materialRequestNo)
                      const latestDoc = docs[0]
                      const statusCell = latestDoc
                        ? renderBadge(
                            EXECUTION_STATUS_LABEL[latestDoc.status],
                            STATUS_VARIANT_CLASS_MAP[latestDoc.status],
                          )
                        : '<span class="text-muted-foreground">未生成执行单</span>'

                      return `
                        <tr class="border-b last:border-b-0">
                          <td class="px-3 py-2 font-medium text-primary">${escapeHtml(row.productionOrderNo)}</td>
                          <td class="px-3 py-2">${escapeHtml(row.taskName)}</td>
                          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(formatTaskScope(runtimeTask))}</td>
                          <td class="px-3 py-2">${escapeHtml(runtimeTask?.assignedFactoryName ?? '待分配')}</td>
                          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(row.materialRequestNo)}</td>
                          <td class="px-3 py-2">${escapeHtml(row.materialModeLabel)}</td>
                          <td class="px-3 py-2">${escapeHtml(row.materialSummary)}</td>
                          <td class="px-3 py-2">${statusCell}</td>
                          <td class="px-3 py-2 text-sm text-muted-foreground">${escapeHtml(row.updatedAt)}</td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderWarehouseDocsSection(orderIds: string[]): string {
  const docs = orderIds
    .flatMap((orderId) => listWarehouseExecutionDocsByOrder(orderId))
    .sort((a, b) => toTimeNumber(b.updatedAt) - toTimeNumber(a.updatedAt))

  return `
    <section class="rounded-lg border bg-card">
      <header class="flex items-center justify-between px-4 pb-3 pt-4">
        <div>
          <h2 class="text-base font-semibold">仓库执行单</h2>
          <p class="text-xs text-muted-foreground">发料单 / 回货单 / 仓内流转单</p>
        </div>
        <span class="text-xs text-muted-foreground">共 ${docs.length} 条</span>
      </header>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1320px] text-sm">
          <thead>
            <tr class="border-b bg-muted/40 text-left">
              <th class="px-3 py-2 font-medium">单号</th>
              <th class="px-3 py-2 font-medium">类型</th>
              <th class="px-3 py-2 font-medium">生产单</th>
              <th class="px-3 py-2 font-medium">工序</th>
              <th class="px-3 py-2 font-medium">执行范围</th>
              <th class="px-3 py-2 font-medium">目标执行方</th>
              <th class="px-3 py-2 font-medium">状态</th>
              <th class="px-3 py-2 font-medium">计划行数</th>
              <th class="px-3 py-2 font-medium">缺口行数</th>
              <th class="px-3 py-2 font-medium">最近更新</th>
              <th class="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${
              docs.length === 0
                ? `
                    <tr>
                      <td colspan="11" class="px-3 py-8 text-center text-muted-foreground">暂无仓库执行单</td>
                    </tr>
                  `
                : docs
                    .map((doc) => {
                      const shortLineCount = doc.lines.filter((line) => line.shortQty > 0).length
                      const targetLabel = doc.targetType === 'WAREHOUSE_WORKSHOP'
                        ? `${TARGET_TYPE_LABEL[doc.targetType]} · ${doc.warehouseName ?? '-'} `
                        : `${TARGET_TYPE_LABEL[doc.targetType]} · ${doc.targetFactoryName ?? '-'}`

                      return `
                        <tr class="border-b last:border-b-0">
                          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(doc.docNo)}</td>
                          <td class="px-3 py-2">${renderBadge(DOC_TYPE_LABEL[doc.docType], 'border-slate-300 bg-white text-slate-700')}</td>
                          <td class="px-3 py-2 font-medium text-primary">${escapeHtml(doc.productionOrderId)}</td>
                          <td class="px-3 py-2">${escapeHtml(doc.processNameZh)}</td>
                          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(doc.scopeLabel)}</td>
                          <td class="px-3 py-2">${escapeHtml(targetLabel)}</td>
                          <td class="px-3 py-2">${renderBadge(EXECUTION_STATUS_LABEL[doc.status], STATUS_VARIANT_CLASS_MAP[doc.status])}</td>
                          <td class="px-3 py-2">${doc.lines.length}</td>
                          <td class="px-3 py-2">${
                            shortLineCount > 0
                              ? renderBadge(String(shortLineCount), 'border-red-200 bg-red-50 text-red-700')
                              : '<span class="text-muted-foreground">0</span>'
                          }</td>
                          <td class="px-3 py-2 text-sm text-muted-foreground">${escapeHtml(doc.updatedAt)}</td>
                          <td class="px-3 py-2 text-right">
                            <button class="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted" data-material-action="open-doc-detail" data-doc-id="${escapeHtml(
                              doc.id,
                            )}">
                              查看详情
                              <i data-lucide="chevron-right" class="ml-1 h-4 w-4"></i>
                            </button>
                          </td>
                        </tr>
                      `
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderMaterialListView(): string {
  const rows = getFilteredOrderRows(getOrderRows())
  const materialRequests = filterMaterialRequestsByKeyword(listMaterialRequests())
  const summary = getAggregatedSummary(rows)

  return `
    <div class="space-y-4">
      <div class="flex items-center gap-4">
        <button class="inline-flex h-8 items-center rounded-md px-3 text-sm hover:bg-muted" data-nav="/fcs/progress/board">
          <i data-lucide="arrow-left" class="mr-1.5 h-4 w-4"></i>
          返回
        </button>
        <div>
          <h1 class="flex items-center gap-2 text-xl font-semibold">
            <i data-lucide="package-search" class="h-5 w-5"></i>
            领料进度跟踪
          </h1>
          <p class="text-sm text-muted-foreground">正式领料需求与仓库执行联动视图</p>
        </div>
      </div>

      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <article class="rounded-lg border bg-card p-4">
          <p class="text-xs text-muted-foreground">正式领料需求数</p>
          <p class="mt-2 text-2xl font-semibold">${summary.requestCount}</p>
        </article>
        <article class="rounded-lg border bg-card p-4">
          <p class="text-xs text-muted-foreground">发料单数</p>
          <p class="mt-2 text-2xl font-semibold">${summary.issueOrderCount}</p>
        </article>
        <article class="rounded-lg border bg-card p-4">
          <p class="text-xs text-muted-foreground">回货单数</p>
          <p class="mt-2 text-2xl font-semibold">${summary.returnOrderCount}</p>
        </article>
        <article class="rounded-lg border bg-card p-4">
          <p class="text-xs text-muted-foreground">仓内流转单数</p>
          <p class="mt-2 text-2xl font-semibold">${summary.internalTransferCount}</p>
        </article>
        <article class="rounded-lg border bg-card p-4">
          <p class="text-xs text-muted-foreground">缺口行数</p>
          <p class="mt-2 text-2xl font-semibold ${summary.shortLineCount > 0 ? 'text-destructive' : ''}">${summary.shortLineCount}</p>
        </article>
        <article class="rounded-lg border bg-card p-4">
          <p class="text-xs text-muted-foreground">齐套率 / 执行完成率</p>
          <p class="mt-2 text-lg font-semibold">${formatPercent(summary.completenessRate)} / ${formatPercent(summary.completionRate)}</p>
        </article>
      </section>

      <section class="rounded-lg border bg-card">
        <div class="p-4">
          <div class="flex flex-wrap items-end gap-3">
            <div class="min-w-[220px] flex-1">
              <label class="mb-1 block text-xs text-muted-foreground">关键词</label>
              <div class="relative">
                <i data-lucide="search" class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"></i>
                <input
                  class="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm"
                  placeholder="生产单号 / SPU / 主工厂"
                  value="${escapeHtml(state.keyword)}"
                  data-material-field="keyword"
                />
              </div>
            </div>

            <div class="w-[180px]">
              <label class="mb-1 block text-xs text-muted-foreground">执行状态</label>
              <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-material-field="executionStatus">
                ${executionStatusOptions
                  .map((item) => `<option value="${item.value}" ${state.executionStatus === item.value ? 'selected' : ''}>${item.label}</option>`)
                  .join('')}
              </select>
            </div>

            <div class="w-[120px]">
              <label class="mb-1 block text-xs text-muted-foreground">是否有缺口</label>
              <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-material-field="hasShortage">
                ${hasShortageOptions
                  .map((item) => `<option value="${item.value}" ${state.hasShortage === item.value ? 'selected' : ''}>${item.label}</option>`)
                  .join('')}
              </select>
            </div>

            <div class="w-[140px]">
              <label class="mb-1 block text-xs text-muted-foreground">交付期从</label>
              <input
                class="h-9 w-full rounded-md border bg-background px-3 text-sm"
                type="date"
                value="${escapeHtml(state.deliveryDateFrom)}"
                data-material-field="deliveryDateFrom"
              />
            </div>

            <div class="w-[140px]">
              <label class="mb-1 block text-xs text-muted-foreground">交付期至</label>
              <input
                class="h-9 w-full rounded-md border bg-background px-3 text-sm"
                type="date"
                value="${escapeHtml(state.deliveryDateTo)}"
                data-material-field="deliveryDateTo"
              />
            </div>

            <button class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-material-action="reset-filters">
              <i data-lucide="rotate-ccw" class="mr-1.5 h-4 w-4"></i>
              重置
            </button>
          </div>
        </div>
      </section>

      ${renderMaterialRequestSection(materialRequests)}

      ${renderWarehouseDocsSection(rows.map((row) => row.productionOrderId))}

      <section class="rounded-lg border bg-card">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1320px] text-sm">
            <thead>
              <tr class="border-b bg-muted/40 text-left">
                <th class="px-3 py-2 font-medium">生产单号</th>
                <th class="px-3 py-2 font-medium">旧单号</th>
                <th class="px-3 py-2 font-medium">SPU</th>
                <th class="px-3 py-2 font-medium">主工厂</th>
                <th class="px-3 py-2 font-medium">交付期</th>
                <th class="px-3 py-2 font-medium">需求数</th>
                <th class="px-3 py-2 font-medium">发料/回货/流转</th>
                <th class="px-3 py-2 font-medium">齐套率</th>
                <th class="px-3 py-2 font-medium">完成率</th>
                <th class="px-3 py-2 font-medium">最新执行状态</th>
                <th class="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${
                rows.length === 0
                  ? `
                    <tr>
                      <td colspan="11" class="px-3 py-8 text-center text-muted-foreground">暂无数据</td>
                    </tr>
                  `
                  : rows
                      .map((row) => {
                        const latestStatus = row.latestDoc
                          ? renderBadge(EXECUTION_STATUS_LABEL[row.latestDoc.status], STATUS_VARIANT_CLASS_MAP[row.latestDoc.status])
                          : '<span class="text-muted-foreground">未生成执行单</span>'

                        return `
                          <tr class="cursor-pointer border-b hover:bg-muted/50" data-material-action="select-po" data-po-id="${escapeHtml(
                            row.productionOrderId,
                          )}">
                            <td class="px-3 py-2 font-medium text-primary">${escapeHtml(row.productionOrderId)}</td>
                            <td class="px-3 py-2 text-muted-foreground">${escapeHtml(row.legacyOrderNo)}</td>
                            <td class="px-3 py-2">
                              <div class="text-sm">${escapeHtml(row.spuCode)}</div>
                              <div class="text-xs text-muted-foreground">${escapeHtml(row.spuName)}</div>
                            </td>
                            <td class="px-3 py-2">${escapeHtml(row.mainFactoryName)}</td>
                            <td class="px-3 py-2">${escapeHtml(row.requiredDeliveryDate)}</td>
                            <td class="px-3 py-2">${row.summary.requestCount}</td>
                            <td class="px-3 py-2 text-xs">${row.summary.issueOrderCount} / ${row.summary.returnOrderCount} / ${row.summary.internalTransferCount}</td>
                            <td class="px-3 py-2">${renderProgressBar(row.summary.completenessRate, 'h-2 w-12')}</td>
                            <td class="px-3 py-2">${renderProgressBar(row.summary.completionRate, 'h-2 w-12')}</td>
                            <td class="px-3 py-2">${latestStatus}</td>
                            <td class="px-3 py-2 text-right">
                              <button class="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted" data-material-action="select-po" data-po-id="${escapeHtml(
                                row.productionOrderId,
                              )}">
                                查看详情
                                <i data-lucide="chevron-right" class="ml-1 h-4 w-4"></i>
                              </button>
                            </td>
                          </tr>
                        `
                      })
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `
}

function renderDocDrawer(poId: string): string {
  if (!state.drawerOpen || !state.selectedDocId) return ''

  const doc = getWarehouseExecutionDocById(state.selectedDocId, poId)
  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-material-action="close-drawer" aria-label="关闭"></button>
      <aside class="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto border-l bg-background shadow-2xl">
        <header class="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-3">
          <h3 class="text-base font-semibold">仓库执行单详情</h3>
          <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-material-action="close-drawer" aria-label="关闭">
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>
        </header>

        ${
          doc
            ? `
              <div class="space-y-6 p-4">
                <section>
                  <h4 class="mb-3 text-sm font-medium">单头信息</h4>
                  <div class="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4">
                    <div>
                      <div class="text-xs text-muted-foreground">执行单号</div>
                      <div class="font-medium">${escapeHtml(doc.docNo)}</div>
                    </div>
                    <div>
                      <div class="text-xs text-muted-foreground">单据类型</div>
                      <div class="font-medium">${escapeHtml(DOC_TYPE_LABEL[doc.docType])}</div>
                    </div>
                    <div>
                      <div class="text-xs text-muted-foreground">生产单号</div>
                      <div class="font-medium">${escapeHtml(doc.productionOrderId)}</div>
                    </div>
                    <div>
                      <div class="text-xs text-muted-foreground">工序</div>
                      <div class="font-medium">${escapeHtml(doc.processNameZh)}</div>
                    </div>
                    <div>
                      <div class="text-xs text-muted-foreground">执行范围</div>
                      <div class="font-mono text-xs">${escapeHtml(doc.scopeLabel)}</div>
                    </div>
                    <div>
                      <div class="text-xs text-muted-foreground">目标执行方</div>
                      <div class="font-medium">${escapeHtml(
                        doc.targetType === 'WAREHOUSE_WORKSHOP'
                          ? `${TARGET_TYPE_LABEL[doc.targetType]} · ${doc.warehouseName ?? '-'}`
                          : `${TARGET_TYPE_LABEL[doc.targetType]} · ${doc.targetFactoryName ?? '-'}`,
                      )}</div>
                    </div>
                    <div>
                      <div class="text-xs text-muted-foreground">执行状态</div>
                      ${renderBadge(EXECUTION_STATUS_LABEL[doc.status], STATUS_VARIANT_CLASS_MAP[doc.status])}
                    </div>
                    <div>
                      <div class="text-xs text-muted-foreground">最近更新</div>
                      <div class="font-medium">${escapeHtml(doc.updatedAt)}</div>
                    </div>
                  </div>
                </section>

                <section>
                  <h4 class="mb-3 text-sm font-medium">执行明细</h4>
                  <div class="overflow-x-auto rounded-lg border">
                    <table class="w-full min-w-[980px] text-sm">
                      <thead>
                        <tr class="border-b bg-muted/40 text-left">
                          <th class="px-3 py-2 font-medium">物料编码</th>
                          <th class="px-3 py-2 font-medium">物料名称</th>
                          <th class="px-3 py-2 font-medium">单位</th>
                          <th class="px-3 py-2 text-right font-medium">计划数量</th>
                          <th class="px-3 py-2 text-right font-medium">备料数量</th>
                          <th class="px-3 py-2 text-right font-medium">已发/已转/已回</th>
                          <th class="px-3 py-2 text-right font-medium">缺口数量</th>
                          <th class="px-3 py-2 font-medium">SKU</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${doc.lines
                          .map((line) => {
                            const finishedQty =
                              doc.docType === 'RETURN'
                                ? line.returnedQty
                                : doc.docType === 'INTERNAL_TRANSFER'
                                  ? line.transferredQty
                                  : line.issuedQty
                            const skuText = [line.skuCode, line.skuColor, line.skuSize].filter(Boolean).join(' / ')
                            return `
                              <tr class="border-b last:border-b-0">
                                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(line.materialCode ?? '-')}</td>
                                <td class="px-3 py-2">
                                  <div>${escapeHtml(line.materialName)}</div>
                                  <div class="text-xs text-muted-foreground">${escapeHtml(line.materialSpec ?? '-')}</div>
                                </td>
                                <td class="px-3 py-2">${escapeHtml(line.unit)}</td>
                                <td class="px-3 py-2 text-right">${line.plannedQty}</td>
                                <td class="px-3 py-2 text-right">${line.preparedQty}</td>
                                <td class="px-3 py-2 text-right">${finishedQty}</td>
                                <td class="px-3 py-2 text-right">${
                                  line.shortQty > 0
                                    ? `<span class="font-medium text-destructive">${line.shortQty}</span>`
                                    : '<span class="text-muted-foreground">0</span>'
                                }</td>
                                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(skuText || '-')}</td>
                              </tr>
                            `
                          })
                          .join('')}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            `
            : `
              <div class="flex items-center justify-center py-12 text-muted-foreground">
                <i data-lucide="loader-2" class="mr-2 h-4 w-4 animate-spin"></i>
                加载中
              </div>
            `
        }
      </aside>
    </div>
  `
}

function renderMaterialDetailView(poId: string, docIdFromQuery: string | null): string {
  const order = productionOrders.find((item) => item.productionOrderId === poId)
  const summary = getWarehouseExecutionSummaryByOrder(poId)
  const materialRequests = listMaterialRequestsByOrder(poId)
  const executionDocs = listWarehouseExecutionDocsByOrder(poId)
  const docs =
    state.docTypeFilter === 'ALL'
      ? executionDocs
      : executionDocs.filter((doc) => doc.docType === state.docTypeFilter)

  const shortageLines = docs.flatMap((doc) =>
    doc.lines
      .filter((line) => line.shortQty > 0)
      .map((line) => ({
        docNo: doc.docNo,
        materialCode: line.materialCode ?? '-',
        materialName: line.materialName,
        plannedQty: line.plannedQty,
        preparedQty: line.preparedQty,
        shortQty: line.shortQty,
      })),
  )

  return `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button class="inline-flex h-8 items-center rounded-md px-3 text-sm hover:bg-muted" data-material-action="back-to-list">
            <i data-lucide="arrow-left" class="mr-1.5 h-4 w-4"></i>
            返回列表
          </button>
          <h1 class="flex items-center gap-2 text-xl font-semibold">
            <i data-lucide="package-search" class="h-5 w-5"></i>
            领料进度跟踪
          </h1>
        </div>
      </div>

      <section class="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-3">
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <span class="text-muted-foreground">当前筛选:</span>
          ${renderBadge(`生产单号: ${poId}`, 'border-blue-200 bg-blue-50 text-blue-700')}
          ${docIdFromQuery ? renderBadge(`执行单号: ${docIdFromQuery}`, 'border-slate-300 bg-white text-slate-700') : ''}
        </div>
        <button class="inline-flex h-8 items-center rounded-md px-3 text-sm hover:bg-muted" data-material-action="back-to-list">
          <i data-lucide="x" class="mr-1.5 h-4 w-4"></i>
          清除筛选
        </button>
      </section>

      ${
        state.notFoundDocId
          ? `
            <section class="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <i data-lucide="alert-triangle" class="h-4 w-4"></i>
              <span>执行单不存在: ${escapeHtml(state.notFoundDocId)}</span>
            </section>
          `
          : ''
      }

      <section class="rounded-lg border bg-card">
        <header class="px-4 pb-3 pt-4">
          <h2 class="flex items-center gap-2 text-base font-semibold">
            <i data-lucide="package" class="h-4 w-4"></i>
            生产单概况
          </h2>
        </header>
        <div class="px-4 pb-4">
          <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <div>
              <div class="text-xs text-muted-foreground">生产单号</div>
              <div class="font-medium">${escapeHtml(poId)}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">旧单号</div>
              <div class="font-medium">${escapeHtml(order?.legacyOrderNo ?? '-')}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">SPU</div>
              <div class="font-medium">${escapeHtml(order?.demandSnapshot.spuCode ?? '-')}</div>
              <div class="text-xs text-muted-foreground">${escapeHtml(order?.demandSnapshot.spuName ?? '-')}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">主工厂</div>
              <div class="font-medium">${escapeHtml(order?.mainFactorySnapshot.name ?? '-')}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">需求/发料/回货/流转</div>
              <div class="font-medium">${summary.requestCount} / ${summary.issueOrderCount} / ${summary.returnOrderCount} / ${summary.internalTransferCount}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">齐套率 / 完成率</div>
              <div class="font-medium">${formatPercent(summary.completenessRate)} / ${formatPercent(summary.completionRate)}</div>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-lg border bg-card">
        <header class="px-4 pb-3 pt-4">
          <h2 class="text-base font-semibold">该生产单已创建领料需求</h2>
        </header>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1120px] text-sm">
            <thead>
              <tr class="border-b bg-muted/40 text-left">
                <th class="px-3 py-2 font-medium">任务名称</th>
                <th class="px-3 py-2 font-medium">任务类型</th>
                <th class="px-3 py-2 font-medium">执行范围</th>
                <th class="px-3 py-2 font-medium">领料需求编号</th>
                <th class="px-3 py-2 font-medium">领料方式</th>
                <th class="px-3 py-2 font-medium">仓库执行状态</th>
                <th class="px-3 py-2 font-medium">最近更新时间</th>
              </tr>
            </thead>
            <tbody>
              ${
                materialRequests.length === 0
                  ? `
                      <tr>
                        <td colspan="7" class="px-3 py-8 text-center text-muted-foreground">暂无已创建领料需求</td>
                      </tr>
                    `
                  : materialRequests
                      .map((row) => {
                        const runtimeTask = resolveRuntimeTaskForRequest(row)
                        const docsForRequest = listWarehouseExecutionDocsByMaterialRequestNo(row.materialRequestNo)
                        const latestDoc = docsForRequest[0]
                        return `
                          <tr class="border-b last:border-b-0">
                            <td class="px-3 py-2">${escapeHtml(row.taskName)}</td>
                            <td class="px-3 py-2">${renderBadge(getTaskTypeLabel(row.taskType), 'border-slate-300 bg-white text-slate-700')}</td>
                            <td class="px-3 py-2 font-mono text-xs">${escapeHtml(formatTaskScope(runtimeTask))}</td>
                            <td class="px-3 py-2 font-mono text-xs">${escapeHtml(row.materialRequestNo)}</td>
                            <td class="px-3 py-2">${escapeHtml(row.materialModeLabel)}</td>
                            <td class="px-3 py-2">${
                              latestDoc
                                ? renderBadge(EXECUTION_STATUS_LABEL[latestDoc.status], STATUS_VARIANT_CLASS_MAP[latestDoc.status])
                                : '<span class="text-muted-foreground">未生成执行单</span>'
                            }</td>
                            <td class="px-3 py-2 text-sm text-muted-foreground">${escapeHtml(row.updatedAt)}</td>
                          </tr>
                        `
                      })
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </section>

      <section class="rounded-lg border bg-card">
        <header class="px-4 pb-3 pt-4">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-base font-semibold">仓库执行单</h2>
            <select class="h-9 w-44 rounded-md border bg-background px-3 text-sm" data-material-field="docTypeFilter">
              <option value="ALL" ${state.docTypeFilter === 'ALL' ? 'selected' : ''}>全部类型</option>
              <option value="ISSUE" ${state.docTypeFilter === 'ISSUE' ? 'selected' : ''}>仓库发料单</option>
              <option value="RETURN" ${state.docTypeFilter === 'RETURN' ? 'selected' : ''}>工序回货单</option>
              <option value="INTERNAL_TRANSFER" ${state.docTypeFilter === 'INTERNAL_TRANSFER' ? 'selected' : ''}>仓内流转单</option>
            </select>
          </div>
        </header>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1260px] text-sm">
            <thead>
              <tr class="border-b bg-muted/40 text-left">
                <th class="px-3 py-2 font-medium">单号</th>
                <th class="px-3 py-2 font-medium">类型</th>
                <th class="px-3 py-2 font-medium">工序</th>
                <th class="px-3 py-2 font-medium">执行范围</th>
                <th class="px-3 py-2 font-medium">目标执行方</th>
                <th class="px-3 py-2 font-medium">状态</th>
                <th class="px-3 py-2 font-medium">计划行数</th>
                <th class="px-3 py-2 font-medium">缺口行数</th>
                <th class="px-3 py-2 font-medium">最近更新</th>
                <th class="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${
                docs.length === 0
                  ? `
                      <tr>
                        <td colspan="10" class="px-3 py-8 text-center text-muted-foreground">暂无执行单</td>
                      </tr>
                    `
                  : docs
                      .map((doc) => {
                        const shortLineCount = doc.lines.filter((line) => line.shortQty > 0).length
                        const targetLabel = doc.targetType === 'WAREHOUSE_WORKSHOP'
                          ? `${TARGET_TYPE_LABEL[doc.targetType]} · ${doc.warehouseName ?? '-'}`
                          : `${TARGET_TYPE_LABEL[doc.targetType]} · ${doc.targetFactoryName ?? '-'}`
                        return `
                          <tr class="border-b last:border-b-0">
                            <td class="px-3 py-2 font-mono text-xs">${escapeHtml(doc.docNo)}</td>
                            <td class="px-3 py-2">${renderBadge(DOC_TYPE_LABEL[doc.docType], 'border-slate-300 bg-white text-slate-700')}</td>
                            <td class="px-3 py-2">${escapeHtml(doc.processNameZh)}</td>
                            <td class="px-3 py-2 font-mono text-xs">${escapeHtml(doc.scopeLabel)}</td>
                            <td class="px-3 py-2">${escapeHtml(targetLabel)}</td>
                            <td class="px-3 py-2">${renderBadge(EXECUTION_STATUS_LABEL[doc.status], STATUS_VARIANT_CLASS_MAP[doc.status])}</td>
                            <td class="px-3 py-2">${doc.lines.length}</td>
                            <td class="px-3 py-2">${
                              shortLineCount > 0
                                ? renderBadge(String(shortLineCount), 'border-red-200 bg-red-50 text-red-700')
                                : '<span class="text-muted-foreground">0</span>'
                            }</td>
                            <td class="px-3 py-2 text-sm text-muted-foreground">${escapeHtml(doc.updatedAt)}</td>
                            <td class="px-3 py-2 text-right">
                              <button class="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted" data-material-action="open-doc-detail" data-doc-id="${escapeHtml(
                                doc.id,
                              )}">
                                查看详情
                                <i data-lucide="chevron-right" class="ml-1 h-4 w-4"></i>
                              </button>
                            </td>
                          </tr>
                        `
                      })
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </section>

      <section class="rounded-lg border bg-card">
        <header class="px-4 pb-3 pt-4">
          <h2 class="flex items-center gap-2 text-base font-semibold">
            <i data-lucide="alert-triangle" class="h-4 w-4 text-destructive"></i>
            缺口汇总
          </h2>
        </header>
        <div class="overflow-x-auto">
          ${
            shortageLines.length === 0
              ? `
                <div class="flex items-center justify-center py-8 text-muted-foreground">
                  <i data-lucide="check" class="mr-2 h-4 w-4"></i>
                  无缺口
                </div>
              `
              : `
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b bg-muted/40 text-left">
                      <th class="px-3 py-2 font-medium">执行单号</th>
                      <th class="px-3 py-2 font-medium">物料编码</th>
                      <th class="px-3 py-2 font-medium">物料名称</th>
                      <th class="px-3 py-2 text-right font-medium">计划数量</th>
                      <th class="px-3 py-2 text-right font-medium">备料数量</th>
                      <th class="px-3 py-2 text-right font-medium">缺口数量</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${shortageLines
                      .map(
                        (line) => `
                          <tr class="border-b last:border-b-0">
                            <td class="px-3 py-2 font-mono text-xs">${escapeHtml(line.docNo)}</td>
                            <td class="px-3 py-2 font-mono text-xs">${escapeHtml(line.materialCode)}</td>
                            <td class="px-3 py-2">${escapeHtml(line.materialName)}</td>
                            <td class="px-3 py-2 text-right">${line.plannedQty}</td>
                            <td class="px-3 py-2 text-right">${line.preparedQty}</td>
                            <td class="px-3 py-2 text-right"><span class="font-medium text-destructive">${line.shortQty}</span></td>
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

      ${renderDocDrawer(poId)}
    </div>
  `
}

function syncDetailStateByQuery(poId: string | null, docIdFromQuery: string | null): void {
  const queryKey = `${poId ?? ''}|${docIdFromQuery ?? ''}`
  if (state.lastQueryKey === queryKey) return
  state.lastQueryKey = queryKey

  if (state.activePoId !== poId) {
    state.activePoId = poId
    state.drawerOpen = false
    state.selectedDocId = null
    state.docTypeFilter = 'ALL'
    state.notFoundDocId = null
  }

  if (!poId) {
    state.drawerOpen = false
    state.selectedDocId = null
    state.notFoundDocId = null
    return
  }

  if (!docIdFromQuery) {
    state.notFoundDocId = null
    return
  }

  const doc = getWarehouseExecutionDocById(docIdFromQuery, poId)
  if (doc) {
    state.selectedDocId = docIdFromQuery
    state.drawerOpen = true
    state.notFoundDocId = null
  } else {
    state.notFoundDocId = docIdFromQuery
  }
}

function resetListFilters(): void {
  state.keyword = ''
  state.executionStatus = 'ALL'
  state.hasShortage = 'ALL'
  state.deliveryDateFrom = ''
  state.deliveryDateTo = ''
}

function updateField(field: string, node: HTMLInputElement | HTMLSelectElement): void {
  if (field === 'keyword' && node instanceof HTMLInputElement) {
    state.keyword = node.value
    return
  }

  if (field === 'deliveryDateFrom' && node instanceof HTMLInputElement) {
    state.deliveryDateFrom = node.value
    return
  }

  if (field === 'deliveryDateTo' && node instanceof HTMLInputElement) {
    state.deliveryDateTo = node.value
    return
  }

  if (field === 'executionStatus' && node instanceof HTMLSelectElement) {
    state.executionStatus = node.value as ExecutionStatusFilter
    return
  }

  if (field === 'hasShortage' && node instanceof HTMLSelectElement) {
    state.hasShortage = node.value as HasShortageFilter
    return
  }

  if (field === 'docTypeFilter' && node instanceof HTMLSelectElement) {
    state.docTypeFilter = node.value as 'ALL' | WarehouseExecutionDocType
  }
}

function handleAction(action: string, actionNode: HTMLElement): boolean {
  if (action === 'reset-filters') {
    resetListFilters()
    return true
  }

  if (action === 'select-po') {
    const poId = actionNode.dataset.poId
    if (!poId) return true
    appStore.navigate(`/fcs/progress/material${buildQuery({ po: poId })}`)
    return true
  }

  if (action === 'back-to-list') {
    appStore.navigate('/fcs/progress/material')
    return true
  }

  if (action === 'open-doc-detail') {
    const docId = actionNode.dataset.docId
    if (!docId) return true
    state.selectedDocId = docId
    state.drawerOpen = true
    state.notFoundDocId = null
    return true
  }

  if (action === 'close-drawer') {
    state.drawerOpen = false
    return true
  }

  return false
}

export function renderProgressMaterialPage(): string {
  const params = getCurrentSearchParams()
  const poId = params.get('po')
  const docIdFromQuery = params.get('docId') ?? params.get('pickId')

  syncDetailStateByQuery(poId, docIdFromQuery)

  if (poId) {
    return renderMaterialDetailView(poId, docIdFromQuery)
  }
  return renderMaterialListView()
}

export function handleProgressMaterialEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-material-field]')
  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.materialField
    if (!field) return true
    updateField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-material-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.materialAction
  if (!action) return false

  return handleAction(action, actionNode)
}

export function isProgressMaterialDrawerOpen(): boolean {
  return state.drawerOpen
}
