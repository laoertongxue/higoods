import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  getMaterialProgressByPo,
  getPickingLinesByPickId,
  getPickingOrderById,
  getPickingOrdersByPo,
  getPoList,
  getPoSummaryById,
  getShortageSummaryByPo,
  type MaterialProgress,
  type PickingLine,
  type PickingOrder,
  type PickingStatus,
  type PoSummary,
  type ShortageReasonCode,
} from '../data/fcs/legacy-wms-picking'

type ReadinessStatusFilter = 'ALL' | 'NOT_CREATED' | 'CREATED' | 'PICKING' | 'PARTIAL' | 'COMPLETED'
type HasShortageFilter = 'ALL' | 'YES' | 'NO'
type ShortageReasonFilter = 'all' | ShortageReasonCode

interface PoListRow extends PoSummary {
  progress: MaterialProgress
}

interface MaterialProgressState {
  keyword: string
  readinessStatus: ReadinessStatusFilter
  hasShortage: HasShortageFilter
  deliveryDateFrom: string
  deliveryDateTo: string

  drawerOpen: boolean
  selectedPickId: string | null
  shortageReasonFilter: ShortageReasonFilter
  notFoundPickId: string | null
  activePoId: string | null
  lastQueryKey: string
}

const PICKING_STATUS_LABEL: Record<PickingStatus, string> = {
  NOT_CREATED: '未创建',
  CREATED: '已创建',
  PICKING: '领料中',
  PARTIAL: '部分完成',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
}

const MATERIAL_READY_LABEL: Record<'NOT_CREATED' | 'CREATED' | 'PICKING' | 'PARTIAL' | 'COMPLETED', string> = {
  NOT_CREATED: '未创建',
  CREATED: '已创建',
  PICKING: '领料中',
  PARTIAL: '部分齐套',
  COMPLETED: '已齐套',
}

const SHORTAGE_REASON_LABEL: Record<ShortageReasonCode, string> = {
  INSUFFICIENT_STOCK: '库存不足',
  NOT_RECEIVED: '未入库',
  QC_FAILED: '质检不合格',
  FROZEN: '冻结',
  UNKNOWN: '未知',
}

const statusVariantClassMap: Record<PickingStatus, string> = {
  NOT_CREATED: 'border-slate-200 bg-slate-50 text-slate-700',
  CREATED: 'border-blue-200 bg-blue-50 text-blue-700',
  PICKING: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  PARTIAL: 'border-red-200 bg-red-50 text-red-700',
  COMPLETED: 'border-green-200 bg-green-50 text-green-700',
  CANCELLED: 'border-zinc-200 bg-zinc-50 text-zinc-600',
}

const materialStatusVariantClassMap: Record<'NOT_CREATED' | 'CREATED' | 'PICKING' | 'PARTIAL' | 'COMPLETED', string> = {
  NOT_CREATED: 'border-slate-200 bg-slate-50 text-slate-700',
  CREATED: 'border-blue-200 bg-blue-50 text-blue-700',
  PICKING: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  PARTIAL: 'border-red-200 bg-red-50 text-red-700',
  COMPLETED: 'border-green-200 bg-green-50 text-green-700',
}

const state: MaterialProgressState = {
  keyword: '',
  readinessStatus: 'ALL',
  hasShortage: 'ALL',
  deliveryDateFrom: '',
  deliveryDateTo: '',

  drawerOpen: false,
  selectedPickId: null,
  shortageReasonFilter: 'all',
  notFoundPickId: null,
  activePoId: null,
  lastQueryKey: '',
}

const readinessStatusOptions: Array<{ value: ReadinessStatusFilter; label: string }> = [
  { value: 'ALL', label: '全部' },
  { value: 'NOT_CREATED', label: '未创建' },
  { value: 'CREATED', label: '已创建' },
  { value: 'PICKING', label: '领料中' },
  { value: 'PARTIAL', label: '部分齐套' },
  { value: 'COMPLETED', label: '已齐套' },
]

const hasShortageOptions: Array<{ value: HasShortageFilter; label: string }> = [
  { value: 'ALL', label: '全部' },
  { value: 'YES', label: '是' },
  { value: 'NO', label: '否' },
]

const shortageReasonOptions: Array<{ value: ShortageReasonFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'INSUFFICIENT_STOCK', label: '库存不足' },
  { value: 'NOT_RECEIVED', label: '未入库' },
  { value: 'QC_FAILED', label: '质检不合格' },
  { value: 'FROZEN', label: '冻结' },
  { value: 'UNKNOWN', label: '未知' },
]

function getCurrentQueryString(): string {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return query ?? ''
}

function getCurrentSearchParams(): URLSearchParams {
  return new URLSearchParams(getCurrentQueryString())
}

function buildQuery(params: { po?: string | null; pickId?: string | null }): string {
  const search = new URLSearchParams()
  if (params.po) search.set('po', params.po)
  if (params.pickId) search.set('pickId', params.pickId)
  const query = search.toString()
  return query ? `?${query}` : ''
}

function renderBadge(label: string, className: string): string {
  return `<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

function getPoListRows(): PoListRow[] {
  const poList = getPoList()
  return poList.map((po) => ({
    ...po,
    progress: getMaterialProgressByPo(po.poId),
  }))
}

function getFilteredPoRows(rows: PoListRow[]): PoListRow[] {
  const keyword = state.keyword.trim().toLowerCase()

  return rows.filter((row) => {
    if (keyword) {
      const haystack = `${row.poId} ${row.spuCode} ${row.spuName} ${row.mainFactoryName}`.toLowerCase()
      if (!haystack.includes(keyword)) return false
    }

    if (state.readinessStatus !== 'ALL' && row.progress.readinessStatus !== state.readinessStatus) {
      return false
    }

    if (state.hasShortage === 'YES' && row.progress.shortLineCount === 0) return false
    if (state.hasShortage === 'NO' && row.progress.shortLineCount > 0) return false

    if (state.deliveryDateFrom && row.requiredDeliveryDate < state.deliveryDateFrom) return false
    if (state.deliveryDateTo && row.requiredDeliveryDate > state.deliveryDateTo) return false

    return true
  })
}

function renderProgressBar(percent: number, widthClass: string): string {
  const safePercent = Math.max(0, Math.min(100, percent))
  return `
    <div class="flex items-center gap-2">
      <span class="${widthClass} overflow-hidden rounded-full bg-muted">
        <span class="block h-full rounded-full bg-blue-600" style="width:${safePercent}%"></span>
      </span>
      <span class="text-sm">${safePercent}%</span>
    </div>
  `
}

function renderMaterialListView(): string {
  const rows = getFilteredPoRows(getPoListRows())

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
          <p class="text-sm text-muted-foreground">配料单与物料齐套追踪</p>
        </div>
      </div>

      <section class="rounded-lg border bg-card">
        <div class="p-4">
          <div class="flex flex-wrap items-end gap-3">
            <div class="min-w-[200px] flex-1">
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

            <div class="w-[150px]">
              <label class="mb-1 block text-xs text-muted-foreground">物料就绪状态</label>
              <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-material-field="readinessStatus">
                ${readinessStatusOptions
                  .map(
                    (item) =>
                      `<option value="${item.value}" ${state.readinessStatus === item.value ? 'selected' : ''}>${item.label}</option>`,
                  )
                  .join('')}
              </select>
            </div>

            <div class="w-[120px]">
              <label class="mb-1 block text-xs text-muted-foreground">是否有缺口</label>
              <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-material-field="hasShortage">
                ${hasShortageOptions
                  .map(
                    (item) =>
                      `<option value="${item.value}" ${state.hasShortage === item.value ? 'selected' : ''}>${item.label}</option>`,
                  )
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

      <section class="rounded-lg border bg-card">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1240px] text-sm">
            <thead>
              <tr class="border-b bg-muted/40 text-left">
                <th class="px-3 py-2 font-medium">生产单号</th>
                <th class="px-3 py-2 font-medium">旧单号</th>
                <th class="px-3 py-2 font-medium">SPU</th>
                <th class="px-3 py-2 font-medium">主工厂</th>
                <th class="px-3 py-2 font-medium">交付期</th>
                <th class="px-3 py-2 font-medium">物料就绪状态</th>
                <th class="px-3 py-2 font-medium">配齐率</th>
                <th class="px-3 py-2 font-medium">缺口行数</th>
                <th class="px-3 py-2 font-medium">最新配料单状态</th>
                <th class="px-3 py-2 font-medium">最近更新</th>
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
                        return `
                          <tr class="cursor-pointer border-b hover:bg-muted/50" data-material-action="select-po" data-po-id="${escapeHtml(
                            row.poId,
                          )}">
                            <td class="px-3 py-2 font-medium text-primary">${escapeHtml(row.poId)}</td>
                            <td class="px-3 py-2 text-muted-foreground">${escapeHtml(row.legacyOrderNo)}</td>
                            <td class="px-3 py-2">
                              <div class="text-sm">${escapeHtml(row.spuCode)}</div>
                              <div class="text-xs text-muted-foreground">${escapeHtml(row.spuName)}</div>
                            </td>
                            <td class="px-3 py-2">${escapeHtml(row.mainFactoryName)}</td>
                            <td class="px-3 py-2">${escapeHtml(row.requiredDeliveryDate)}</td>
                            <td class="px-3 py-2">${renderBadge(
                              MATERIAL_READY_LABEL[row.progress.readinessStatus],
                              materialStatusVariantClassMap[row.progress.readinessStatus],
                            )}</td>
                            <td class="px-3 py-2">${renderProgressBar(row.progress.fulfillmentRate, 'h-2 w-12')}</td>
                            <td class="px-3 py-2">${
                              row.progress.shortLineCount > 0
                                ? renderBadge(String(row.progress.shortLineCount), 'border-red-200 bg-red-50 text-red-700')
                                : '<span class="text-muted-foreground">0</span>'
                            }</td>
                            <td class="px-3 py-2">${
                              row.progress.latestPickStatus
                                ? renderBadge(
                                    PICKING_STATUS_LABEL[row.progress.latestPickStatus],
                                    statusVariantClassMap[row.progress.latestPickStatus],
                                  )
                                : '<span class="text-muted-foreground">-</span>'
                            }</td>
                            <td class="px-3 py-2 text-sm text-muted-foreground">${escapeHtml(
                              row.progress.latestUpdatedAt ?? '-',
                            )}</td>
                            <td class="px-3 py-2 text-right">
                              <button class="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted" data-material-action="select-po" data-po-id="${escapeHtml(
                                row.poId,
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

function renderDrawer(poId: string): string {
  if (!state.drawerOpen || !state.selectedPickId) return ''

  const selectedPickingOrder = getPickingOrderById(state.selectedPickId, poId)
  const selectedPickingLines = selectedPickingOrder ? getPickingLinesByPickId(selectedPickingOrder.pickId) : []

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-material-action="close-drawer" aria-label="关闭"></button>
      <aside class="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l bg-background shadow-2xl">
        <header class="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-3">
          <h3 class="text-base font-semibold">配料单详情</h3>
          <button class="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" data-material-action="close-drawer" aria-label="关闭">
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>
        </header>

        ${
          selectedPickingOrder
            ? `
              <div class="space-y-6 p-4">
                <section>
                  <h4 class="mb-3 text-sm font-medium">配料单头</h4>
                  <div class="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4">
                    <div>
                      <div class="text-xs text-muted-foreground">配料单号</div>
                      <div class="font-medium">${escapeHtml(selectedPickingOrder.pickId)}</div>
                    </div>
                    <div>
                      <div class="text-xs text-muted-foreground">生产单号</div>
                      <div class="font-medium">${escapeHtml(selectedPickingOrder.poId)}</div>
                    </div>
                    <div>
                      <div class="text-xs text-muted-foreground">仓库</div>
                      <div class="font-medium">${escapeHtml(selectedPickingOrder.warehouseName)}</div>
                    </div>
                    <div>
                      <div class="text-xs text-muted-foreground">状态</div>
                      ${renderBadge(
                        PICKING_STATUS_LABEL[selectedPickingOrder.status],
                        statusVariantClassMap[selectedPickingOrder.status],
                      )}
                    </div>
                    <div>
                      <div class="text-xs text-muted-foreground">配齐率</div>
                      ${renderProgressBar(selectedPickingOrder.fulfillmentRate, 'h-2 w-16')}
                    </div>
                    <div>
                      <div class="text-xs text-muted-foreground">缺口行数</div>
                      <div class="font-medium">
                        ${
                          selectedPickingOrder.shortLineCount > 0
                            ? renderBadge(String(selectedPickingOrder.shortLineCount), 'border-red-200 bg-red-50 text-red-700')
                            : '0'
                        }
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h4 class="mb-3 text-sm font-medium">明细行</h4>
                  <div class="overflow-x-auto rounded-lg border">
                    <table class="w-full min-w-[920px] text-sm">
                      <thead>
                        <tr class="border-b bg-muted/40 text-left">
                          <th class="px-3 py-2 font-medium">物料编码</th>
                          <th class="px-3 py-2 font-medium">物料名称</th>
                          <th class="px-3 py-2 font-medium">单位</th>
                          <th class="px-3 py-2 text-right font-medium">需求数量</th>
                          <th class="px-3 py-2 text-right font-medium">已领数量</th>
                          <th class="px-3 py-2 text-right font-medium">缺口数量</th>
                          <th class="px-3 py-2 font-medium">原因</th>
                          <th class="px-3 py-2 font-medium">库位</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${selectedPickingLines
                          .map(
                            (line) => `
                              <tr class="border-b last:border-b-0">
                                <td class="px-3 py-2 font-mono text-xs">${escapeHtml(line.materialCode)}</td>
                                <td class="px-3 py-2">
                                  <div>${escapeHtml(line.materialName)}</div>
                                  <div class="text-xs text-muted-foreground">${escapeHtml(line.specification)}</div>
                                </td>
                                <td class="px-3 py-2">${escapeHtml(line.uom)}</td>
                                <td class="px-3 py-2 text-right">${line.requiredQty}</td>
                                <td class="px-3 py-2 text-right">${line.pickedQty}</td>
                                <td class="px-3 py-2 text-right">${
                                  line.shortQty > 0
                                    ? `<span class="font-medium text-destructive">${line.shortQty}</span>`
                                    : '<span class="text-muted-foreground">0</span>'
                                }</td>
                                <td class="px-3 py-2">${
                                  line.reasonCode
                                    ? renderBadge(SHORTAGE_REASON_LABEL[line.reasonCode], 'border-slate-300 bg-transparent text-slate-700')
                                    : '<span class="text-muted-foreground">-</span>'
                                }</td>
                                <td class="px-3 py-2 font-mono text-xs text-muted-foreground">${escapeHtml(line.location ?? '-')}</td>
                              </tr>
                            `,
                          )
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

function renderMaterialDetailView(poId: string, pickIdFromQuery: string | null): string {
  const poSummary = getPoSummaryById(poId)
  const pickingOrders = getPickingOrdersByPo(poId)
  const shortageLines = getShortageSummaryByPo(poId)

  const filteredShortageLines =
    state.shortageReasonFilter === 'all'
      ? shortageLines
      : shortageLines.filter((line) => line.reasonCode === state.shortageReasonFilter)

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
          ${
            pickIdFromQuery
              ? renderBadge(`配料单号: ${pickIdFromQuery}`, 'border-slate-300 bg-white text-slate-700')
              : ''
          }
        </div>
        <button class="inline-flex h-8 items-center rounded-md px-3 text-sm hover:bg-muted" data-material-action="back-to-list">
          <i data-lucide="x" class="mr-1.5 h-4 w-4"></i>
          清除筛选
        </button>
      </section>

      ${
        state.notFoundPickId
          ? `
            <section class="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <i data-lucide="alert-triangle" class="h-4 w-4"></i>
              <span>配料单不存在: ${escapeHtml(state.notFoundPickId)}</span>
            </section>
          `
          : ''
      }

      <section class="rounded-lg border bg-card">
        <header class="px-4 pb-3 pt-4">
          <h2 class="flex items-center gap-2 text-base font-semibold">
            <i data-lucide="package" class="h-4 w-4"></i>
            生产单摘要
          </h2>
        </header>
        <div class="px-4 pb-4">
          <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <div>
              <div class="text-xs text-muted-foreground">生产单号</div>
              <div class="font-medium">${escapeHtml(poSummary.poId)}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">旧单号</div>
              <div class="font-medium">${escapeHtml(poSummary.legacyOrderNo)}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">SPU</div>
              <div class="font-medium">${escapeHtml(poSummary.spuCode)}</div>
              <div class="text-xs text-muted-foreground">${escapeHtml(poSummary.spuName)}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">主工厂</div>
              <div class="font-medium">${escapeHtml(poSummary.mainFactoryName)}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">交付期</div>
              <div class="font-medium">${escapeHtml(poSummary.requiredDeliveryDate)}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground">物料就绪状态</div>
              ${renderBadge(
                MATERIAL_READY_LABEL[poSummary.materialReadyStatus],
                materialStatusVariantClassMap[poSummary.materialReadyStatus],
              )}
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-lg border bg-card">
        <header class="px-4 pb-3 pt-4">
          <h2 class="text-base font-semibold">配料单列表</h2>
        </header>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b bg-muted/40 text-left">
                <th class="px-3 py-2 font-medium">配料单号</th>
                <th class="px-3 py-2 font-medium">仓库</th>
                <th class="px-3 py-2 font-medium">状态</th>
                <th class="px-3 py-2 font-medium">配齐率</th>
                <th class="px-3 py-2 font-medium">缺口行数</th>
                <th class="px-3 py-2 font-medium">最近更新</th>
                <th class="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${pickingOrders
                .map(
                  (order) => `
                    <tr class="border-b last:border-b-0">
                      <td class="px-3 py-2 font-medium">${escapeHtml(order.pickId)}</td>
                      <td class="px-3 py-2">${escapeHtml(order.warehouseName)}</td>
                      <td class="px-3 py-2">${renderBadge(PICKING_STATUS_LABEL[order.status], statusVariantClassMap[order.status])}</td>
                      <td class="px-3 py-2">${renderProgressBar(order.fulfillmentRate, 'h-2 w-16')}</td>
                      <td class="px-3 py-2">${
                        order.shortLineCount > 0
                          ? renderBadge(String(order.shortLineCount), 'border-red-200 bg-red-50 text-red-700')
                          : '<span class="text-muted-foreground">0</span>'
                      }</td>
                      <td class="px-3 py-2 text-sm text-muted-foreground">${escapeHtml(order.updatedAt)}</td>
                      <td class="px-3 py-2 text-right">
                        <button class="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted" data-material-action="open-pick-detail" data-pick-id="${escapeHtml(
                          order.pickId,
                        )}">
                          查看详情
                          <i data-lucide="chevron-right" class="ml-1 h-4 w-4"></i>
                        </button>
                      </td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>

      <section class="rounded-lg border bg-card">
        <header class="px-4 pb-3 pt-4">
          <div class="flex items-center justify-between gap-2">
            <h2 class="flex items-center gap-2 text-base font-semibold">
              <i data-lucide="alert-triangle" class="h-4 w-4 text-destructive"></i>
              缺口汇总
            </h2>
            <select class="h-9 w-40 rounded-md border bg-background px-3 text-sm" data-material-field="shortageReasonFilter">
              ${shortageReasonOptions
                .map(
                  (option) =>
                    `<option value="${option.value}" ${state.shortageReasonFilter === option.value ? 'selected' : ''}>${option.label}</option>`,
                )
                .join('')}
            </select>
          </div>
        </header>
        <div class="overflow-x-auto">
          ${
            filteredShortageLines.length === 0
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
                      <th class="px-3 py-2 font-medium">物料编码</th>
                      <th class="px-3 py-2 font-medium">物料名称</th>
                      <th class="px-3 py-2 text-right font-medium">需求数量</th>
                      <th class="px-3 py-2 text-right font-medium">已领数量</th>
                      <th class="px-3 py-2 text-right font-medium">缺口数量</th>
                      <th class="px-3 py-2 font-medium">原因</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filteredShortageLines
                      .map(
                        (line, index) => `
                          <tr class="border-b last:border-b-0">
                            <td class="px-3 py-2 font-mono text-sm">${escapeHtml(line.materialCode)}</td>
                            <td class="px-3 py-2">${escapeHtml(line.materialName)}</td>
                            <td class="px-3 py-2 text-right">${line.requiredQty}</td>
                            <td class="px-3 py-2 text-right">${line.pickedQty}</td>
                            <td class="px-3 py-2 text-right"><span class="font-medium text-destructive">${line.shortQty}</span></td>
                            <td class="px-3 py-2">${
                              line.reasonCode
                                ? renderBadge(SHORTAGE_REASON_LABEL[line.reasonCode], 'border-slate-300 bg-transparent text-slate-700')
                                : '-'
                            }</td>
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

      ${renderDrawer(poId)}
    </div>
  `
}

function syncDetailStateByQuery(poId: string | null, pickIdFromQuery: string | null): void {
  const queryKey = `${poId ?? ''}|${pickIdFromQuery ?? ''}`
  if (state.lastQueryKey === queryKey) return
  state.lastQueryKey = queryKey

  if (state.activePoId !== poId) {
    state.activePoId = poId
    state.drawerOpen = false
    state.selectedPickId = null
    state.shortageReasonFilter = 'all'
    state.notFoundPickId = null
  }

  if (!poId) {
    state.drawerOpen = false
    state.selectedPickId = null
    state.notFoundPickId = null
    return
  }

  if (!pickIdFromQuery) {
    state.notFoundPickId = null
    return
  }

  const order = getPickingOrderById(pickIdFromQuery, poId)
  if (order) {
    state.selectedPickId = pickIdFromQuery
    state.drawerOpen = true
    state.notFoundPickId = null
  } else {
    state.notFoundPickId = pickIdFromQuery
  }
}

function resetListFilters(): void {
  state.keyword = ''
  state.readinessStatus = 'ALL'
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

  if (field === 'readinessStatus' && node instanceof HTMLSelectElement) {
    state.readinessStatus = node.value as ReadinessStatusFilter
    return
  }

  if (field === 'hasShortage' && node instanceof HTMLSelectElement) {
    state.hasShortage = node.value as HasShortageFilter
    return
  }

  if (field === 'shortageReasonFilter' && node instanceof HTMLSelectElement) {
    state.shortageReasonFilter = node.value as ShortageReasonFilter
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

  if (action === 'open-pick-detail') {
    const pickId = actionNode.dataset.pickId
    if (!pickId) return true
    state.selectedPickId = pickId
    state.drawerOpen = true
    state.notFoundPickId = null
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
  const pickIdFromQuery = params.get('pickId')

  syncDetailStateByQuery(poId, pickIdFromQuery)

  if (poId) {
    return renderMaterialDetailView(poId, pickIdFromQuery)
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
