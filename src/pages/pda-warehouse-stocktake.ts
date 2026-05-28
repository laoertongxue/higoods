import {
  completeFactoryWarehouseStocktakeOrder,
  createFactoryWarehouseStocktakeOrder,
  listFactoryWaitHandoverStockItems,
  listFactoryWaitProcessStockItems,
  listFactoryWarehouseAdjustmentOrdersByStocktake,
  listFactoryWarehouseStocktakeDifferenceReviewsByOrder,
  listFactoryWarehouseStocktakeOrders,
  updateFactoryWarehouseStocktakeLine,
} from '../data/fcs/factory-internal-warehouse.ts'
import { getPdaRuntimeContext } from './pda-runtime'
import { renderPdaFrame } from './pda-shell'
import {
  buildStocktakeOrderSummary,
  buildStocktakeStatusText,
  buildWarehouseDifferenceText,
  escapeAttr,
  getCurrentFactoryWarehouseByKind,
  getMobileWarehouseSearchParams,
  getMobileWarehouseRuntimeContext,
  renderCompactFieldList,
  renderMobilePageEmptyState,
  renderSectionFilterChips,
  renderStatusPill,
} from './pda-warehouse-shared'
import { escapeHtml } from '../utils'

type StocktakeFilter = '全部' | '盘点中' | '待确认' | '已完成' | '已取消'
type WarehouseToolMode = 'search' | 'scan' | 'stocktake'
type StocktakeView = '盘点记录' | '盘盈单' | '盘亏单'

interface StocktakeState {
  status: StocktakeFilter
  view: StocktakeView
  selectedOrderId: string | null
  createDialogOpen: boolean
  createWarehouseKind: 'WAIT_PROCESS' | 'WAIT_HANDOVER'
  createBlindStocktake: boolean
  createOwnerNames: string[]
  createPlannedAt: string
}

const state: StocktakeState = {
  status: '全部',
  view: '盘点记录',
  selectedOrderId: null,
  createDialogOpen: false,
  createWarehouseKind: 'WAIT_PROCESS',
  createBlindStocktake: true,
  createOwnerNames: ['申请人3'],
  createPlannedAt: '2026-04-20T14:00',
}

const FILTERS: Array<{ value: StocktakeFilter; label: string }> = [
  { value: '全部', label: '全部' },
  { value: '盘点中', label: '盘点中' },
  { value: '待确认', label: '待确认' },
  { value: '已完成', label: '已完成' },
  { value: '已取消', label: '已取消' },
]

const STOCKTAKE_VIEWS: Array<{ value: StocktakeView; label: string }> = [
  { value: '盘点记录', label: '盘点记录' },
  { value: '盘盈单', label: '盘盈单' },
  { value: '盘亏单', label: '盘亏单' },
]

const STOCKTAKE_OWNER_OPTIONS = ['申请人3', '仓库主管', '裁床仓管']

const MODE_OPTIONS: Array<{ value: WarehouseToolMode; label: string; title: string; description: string }> = [
  { value: 'search', label: '查库存', title: '查库存', description: '按物料、菲票、载具或库位查看当前仓内记录。' },
  { value: 'scan', label: '扫码查询', title: '扫码查询', description: '现场扫码后查看物料、菲票、载具或库位信息。' },
  { value: 'stocktake', label: '库存盘点', title: '库存盘点', description: '按库位核对实物数量，记录盘盈盘亏并提交差异。' },
]

function getWarehouseToolMode(): WarehouseToolMode {
  const value = getMobileWarehouseSearchParams().get('mode')
  return value === 'scan' || value === 'stocktake' ? value : 'search'
}

function buildWarehouseToolRoute(mode: WarehouseToolMode): string {
  const current = getMobileWarehouseSearchParams()
  const params = new URLSearchParams()
  const scope = current.get('scope')
  if (scope) params.set('scope', scope)
  params.set('mode', mode)
  return `/fcs/pda/warehouse/stocktake?${params.toString()}`
}

function getRows() {
  const runtime = getMobileWarehouseRuntimeContext()
  if (!runtime) return []
  return listFactoryWarehouseStocktakeOrders()
    .filter((item) => item.factoryId === runtime.factoryId)
    .filter((item) => (state.status === '全部' ? true : item.status === state.status))
}

type InventoryQueryRow = {
  id: string
  warehouseName: string
  warehouseShortName: string
  itemName: string
  itemKind: string
  code: string
  sourceText: string
  qty: number
  unit: string
  locationText: string
  status: string
}

function renderWarehouseQueryPageHeader(title: string, description: string): string {
  return `
    <div class="flex items-start justify-between gap-3 px-1 pb-1 pt-1">
      <div class="min-w-0">
        <div class="text-xl font-semibold leading-tight text-foreground">${escapeHtml(title)}</div>
        <div class="mt-1 max-w-[260px] text-xs leading-5 text-muted-foreground">${escapeHtml(description)}</div>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground"
        data-nav="/fcs/pda/warehouse"
      >
        返回仓管
      </button>
    </div>
  `
}

function getWaitProcessSourceText(item: {
  sourceRecordType: string
  sourceObjectKind: string
  sourceObjectName: string
}): string {
  if (item.sourceRecordType === 'MATERIAL_PICKUP') return `扫码入仓 · 来自${item.sourceObjectKind}`
  if (item.sourceRecordType === 'HANDOVER_RECEIVE') return `接收入仓 · 来自${item.sourceObjectKind}`
  if (item.sourceRecordType === 'TRANSFER_RECEIVE') return `流转入仓 · 来自${item.sourceObjectKind}`
  if (item.sourceRecordType === 'STOCKTAKE_ADJUSTMENT') return '盘点调整 · 库存调整单'
  return `${item.sourceObjectName || item.sourceObjectKind} · 入仓记录`
}

function getWaitHandoverSourceText(item: {
  handoverRecordNo?: string
  handoverOrderNo?: string
  receiverKind?: string
  receiverName?: string
}): string {
  if (item.handoverRecordNo) return `交出记录 · ${item.receiverName || item.receiverKind || '接收方'}`
  if (item.handoverOrderNo) return `交出单 · ${item.receiverName || item.receiverKind || '接收方'}`
  return `待交出库存 · ${item.receiverName || item.receiverKind || '下游'}`
}

function buildInventoryQueryRows(): InventoryQueryRow[] {
  const runtime = getMobileWarehouseRuntimeContext()
  if (!runtime) return []
  const allWaitProcessItems = listFactoryWaitProcessStockItems()
  const allWaitHandoverItems = listFactoryWaitHandoverStockItems()
  const scopedWaitProcessItems = allWaitProcessItems.filter((item) => item.factoryId === runtime.factoryId)
  const scopedWaitHandoverItems = allWaitHandoverItems.filter((item) => item.factoryId === runtime.factoryId)
  const hasScopedRows = scopedWaitProcessItems.length + scopedWaitHandoverItems.length > 0
  const waitProcessItems = (hasScopedRows ? scopedWaitProcessItems : allWaitProcessItems.slice(0, 4))
    .map((item) => ({
      id: item.stockItemId,
      warehouseName: item.warehouseName,
      warehouseShortName: '待加工仓',
      itemName: item.itemName,
      itemKind: item.itemKind,
      code: item.materialSku || item.feiTicketNo || item.transferBagNo || item.fabricRollNo || item.sourceRecordNo || '-',
      sourceText: getWaitProcessSourceText(item),
      qty: item.receivedQty,
      unit: item.unit,
      locationText: item.locationText,
      status: item.status,
    }))
  const waitHandoverItems = (hasScopedRows ? scopedWaitHandoverItems : allWaitHandoverItems.slice(0, 4))
    .map((item) => ({
      id: item.stockItemId,
      warehouseName: item.warehouseName,
      warehouseShortName: '待交出仓',
      itemName: item.itemName,
      itemKind: item.itemKind,
      code: item.feiTicketNo || item.transferBagNo || item.materialSku || item.fabricRollNo || item.handoverRecordNo || '-',
      sourceText: getWaitHandoverSourceText(item),
      qty: item.waitHandoverQty || item.completedQty,
      unit: item.unit,
      locationText: item.locationText,
      status: item.status,
    }))
  return [...waitProcessItems, ...waitHandoverItems].slice(0, 8)
}

function renderInventoryQueryResultCard(row: InventoryQueryRow, mode: WarehouseToolMode, index: number): string {
  const scanLabel = mode === 'scan' && index === 0 ? '<span class="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">本次扫码</span>' : ''
  return `
    <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <div class="truncate text-sm font-semibold text-foreground">${escapeHtml(row.itemName)}</div>
            ${scanLabel}
          </div>
          <div class="mt-1 truncate text-xs text-muted-foreground">${escapeHtml(row.code)}</div>
        </div>
        ${renderStatusPill(row.status)}
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div>仓别：${escapeHtml(row.warehouseShortName)}</div>
        <div>类型：${escapeHtml(row.itemKind)}</div>
        <div>数量：${escapeHtml(`${row.qty} ${row.unit}`)}</div>
        <div>库位：${escapeHtml(row.locationText || '待确认')}</div>
        <div class="col-span-2 truncate">来源：${escapeHtml(row.sourceText)}</div>
      </div>
      <button type="button" class="mt-3 w-full rounded-xl border px-3 py-2 text-xs font-medium text-foreground">
        查看库存流水
      </button>
    </article>
  `
}

function renderInventorySearchPanel(mode: WarehouseToolMode): string {
  const rows = buildInventoryQueryRows()
  const inputLabel = mode === 'scan' ? '扫描码' : '关键词'
  const inputPlaceholder = mode === 'scan' ? '扫描物料码 / 菲票码 / 载具码 / 库位码' : '输入物料、菲票、载具、库位'
  const resultTitle = mode === 'scan' ? '扫码结果' : '查询结果'
  const resultDescription = mode === 'scan' ? '演示扫到第一条库存对象后展示的当前库存。' : '演示按关键词查询后的库存对象。'
  return `
    <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
      <label class="text-xs font-medium text-muted-foreground">
        ${escapeHtml(inputLabel)}
        <input
          class="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm"
          placeholder="${escapeAttr(inputPlaceholder)}"
        />
      </label>
      <button type="button" class="mt-3 h-11 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground">${mode === 'scan' ? '确认扫码查询' : '查询'}</button>
    </section>
    <section class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-sm font-semibold text-foreground">${escapeHtml(resultTitle)}</div>
          <div class="mt-0.5 text-xs text-muted-foreground">${escapeHtml(resultDescription)}</div>
        </div>
        <span class="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">${rows.length} 条</span>
      </div>
      ${
        rows.length
          ? rows.map((row, index) => renderInventoryQueryResultCard(row, mode, index)).join('')
          : renderMobilePageEmptyState('暂无库存记录', '扫码入仓或回收入仓后会在这里显示。')
      }
    </section>
  `
}

function renderStocktakeCreateButton(): string {
  return `
    <button
      type="button"
      class="flex min-h-[88px] w-full items-center justify-between rounded-2xl bg-primary px-4 py-4 text-left text-primary-foreground shadow-sm"
      data-pda-warehouse-action="open-create-stocktake"
    >
      <span>
        <span class="block text-base font-semibold">创建盘点单</span>
        <span class="mt-1 block text-xs opacity-90">选择仓库、全盘方式、责任人和盘点时间。</span>
      </span>
      <span class="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">创建</span>
    </button>
  `
}

function renderCreateStocktakeDialog(): string {
  if (!state.createDialogOpen) return ''
  return `
    <div class="fixed inset-0 z-[120]">
      <button type="button" class="absolute inset-0 bg-black/40" data-pda-warehouse-action="close-create-stocktake"></button>
      <section class="absolute inset-x-4 top-16 max-h-[calc(100vh-132px)] overflow-y-auto rounded-3xl border bg-background p-4 shadow-2xl">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-foreground">创建盘点单</h2>
            <p class="mt-1 text-xs leading-5 text-muted-foreground">当前仅支持全盘。盲盘时盘点人看不到库存账面数量。</p>
          </div>
          <button type="button" class="rounded-full border px-3 py-1 text-xs" data-pda-warehouse-action="close-create-stocktake">关闭</button>
        </div>

        <div class="mt-4 space-y-4">
          <div>
            <div class="text-xs font-medium text-muted-foreground">选择仓库</div>
            <div class="mt-2 grid grid-cols-2 gap-2">
              ${[
                { value: 'WAIT_PROCESS', label: '待加工仓' },
                { value: 'WAIT_HANDOVER', label: '待交出仓' },
              ]
                .map(
                  (item) => `
                    <button
                      type="button"
                      class="rounded-xl border px-3 py-2 text-sm font-medium ${state.createWarehouseKind === item.value ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}"
                      data-pda-warehouse-field="stocktake-warehouse-kind"
                      data-value="${item.value}"
                    >
                      ${item.label}
                    </button>
                  `,
                )
                .join('')}
            </div>
          </div>

          <div>
            <div class="text-xs font-medium text-muted-foreground">盘点方式</div>
            <div class="mt-2 rounded-xl border bg-muted/30 px-3 py-2 text-sm font-medium text-foreground">全盘</div>
          </div>

          <div>
            <div class="text-xs font-medium text-muted-foreground">是否盲盘</div>
            <div class="mt-2 grid grid-cols-2 gap-2">
              ${[
                { value: 'true', label: '盲盘' },
                { value: 'false', label: '非盲盘' },
              ]
                .map((item) => {
                  const active = String(state.createBlindStocktake) === item.value
                  return `
                    <button
                      type="button"
                      class="rounded-xl border px-3 py-2 text-sm font-medium ${active ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}"
                      data-pda-warehouse-field="stocktake-blind"
                      data-value="${item.value}"
                    >
                      ${item.label}
                    </button>
                  `
                })
                .join('')}
            </div>
          </div>

          <div>
            <div class="text-xs font-medium text-muted-foreground">盘点任务责任人</div>
            <div class="mt-2 flex flex-wrap gap-2">
              ${STOCKTAKE_OWNER_OPTIONS.map((name) => {
                const active = state.createOwnerNames.includes(name)
                return `
                  <button
                    type="button"
                    class="rounded-full border px-3 py-1.5 text-xs font-medium ${active ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}"
                    data-pda-warehouse-field="stocktake-owner"
                    data-value="${escapeAttr(name)}"
                  >
                    ${escapeHtml(name)}
                  </button>
                `
              }).join('')}
            </div>
          </div>

          <label class="block text-xs font-medium text-muted-foreground">
            盘点时间
            <input
              type="datetime-local"
              class="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm text-foreground"
              data-pda-warehouse-field="stocktake-planned-at"
              value="${escapeAttr(state.createPlannedAt)}"
            />
          </label>
        </div>

        <div class="mt-5 grid grid-cols-2 gap-2">
          <button type="button" class="rounded-xl border px-3 py-3 text-sm font-medium" data-pda-warehouse-action="close-create-stocktake">取消</button>
          <button type="button" class="rounded-xl bg-primary px-3 py-3 text-sm font-medium text-primary-foreground" data-pda-warehouse-action="create-stocktake">创建盘点单</button>
        </div>
      </section>
    </div>
  `
}

function renderStocktakeOrderCard(order: ReturnType<typeof getRows>[number]): string {
  return `
    <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-semibold text-foreground">${escapeHtml(order.stocktakeOrderNo)}</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">
            ${escapeHtml(order.warehouseName)} · ${escapeHtml(order.stocktakeMethod || order.stocktakeScope)} · ${order.isBlindStocktake ? '盲盘' : '非盲盘'}
          </div>
        </div>
        ${renderStatusPill(order.status)}
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div>责任人：${escapeHtml((order.ownerNames?.length ? order.ownerNames : [order.createdBy]).join('、'))}</div>
        <div>明细：${escapeHtml(buildStocktakeOrderSummary(order))}</div>
        <div>计划：${escapeHtml(order.plannedAt ? order.plannedAt.slice(0, 16).replace('T', ' ') : '-')}</div>
        <div>完成：${escapeHtml(order.completedAt ? order.completedAt.slice(0, 16) : '-')}</div>
      </div>
      <button
        type="button"
        class="mt-3 w-full rounded-xl border px-3 py-2 text-xs font-medium text-foreground"
        data-pda-warehouse-action="open-stocktake-detail"
        data-order-id="${escapeAttr(order.stocktakeOrderId)}"
      >
        ${order.status === '盘点中' ? '录入盘点' : '查看盘点'}
      </button>
    </article>
  `
}

function renderSurplusLossOrderCard(order: ReturnType<typeof getRows>[number], kind: '盘盈单' | '盘亏单'): string {
  const adjustments = listFactoryWarehouseAdjustmentOrdersByStocktake(order.stocktakeOrderId).filter((item) => item.adjustmentType === kind)
  const reviews = listFactoryWarehouseStocktakeDifferenceReviewsByOrder(order.stocktakeOrderId).filter((item) =>
    kind === '盘盈单' ? item.differenceQty > 0 : item.differenceQty < 0,
  )
  const reviewCards = reviews
    .map((review) => {
      const adjustment = adjustments.find((item) => item.reviewId === review.reviewId)
      return `
        <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold text-foreground">${escapeHtml(kind)} · ${escapeHtml(review.stocktakeOrderNo)}</div>
              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.warehouseName)} · ${escapeHtml(review.itemKind)}</div>
            </div>
            ${renderStatusPill(adjustment?.status || review.reviewStatus)}
          </div>
          <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
            <div>对象：${escapeHtml(review.materialSku || review.partName || review.itemName)}</div>
            <div>账面 / 实盘：${escapeHtml(`${review.bookQty} / ${review.countedQty} ${review.unit}`)}</div>
            <div>${kind === '盘盈单' ? '盘盈数量' : '盘亏数量'}：${escapeHtml(`${Math.abs(review.differenceQty)} ${review.unit}`)}</div>
            <div>审核状态：${escapeHtml(review.reviewStatus)}${adjustment ? `，调整单：${escapeHtml(adjustment.adjustmentOrderNo)}` : '，审核通过后生成库存调整单据'}</div>
          </div>
        </article>
      `
    })
    .join('')
  const adjustmentCards = adjustments
    .filter((item) => !reviews.some((review) => review.reviewId === item.reviewId))
    .map(
      (item) => `
        <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold text-foreground">${escapeHtml(item.adjustmentOrderNo)}</div>
              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.stocktakeOrderNo)} · ${escapeHtml(item.warehouseName)}</div>
            </div>
            ${renderStatusPill(item.status)}
          </div>
          <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
            <div>对象：${escapeHtml(item.itemKind)} · ${escapeHtml(item.materialSku || item.partName || item.itemName)}</div>
            <div>账面 / 实盘：${escapeHtml(`${item.bookQty} / ${item.countedQty} ${item.unit}`)}</div>
            <div>${kind === '盘盈单' ? '盘盈数量' : '盘亏数量'}：${escapeHtml(`${Math.abs(item.adjustmentQty)} ${item.unit}`)}</div>
            <div>状态：${escapeHtml(item.status)}，审核通过后生成库存调整。</div>
          </div>
        </article>
      `,
    )
    .join('')
  return reviewCards + adjustmentCards
}

function renderStocktakeListByView(rows: ReturnType<typeof getRows>): string {
  if (state.view === '盘点记录') {
    return rows.length
      ? rows.map((row) => renderStocktakeOrderCard(row)).join('')
      : renderMobilePageEmptyState('暂无盘点单', '点击“创建盘点单”即可按当前仓库明细生成盘点单。')
  }
  const cards = rows.map((row) => renderSurplusLossOrderCard(row, state.view)).join('')
  return cards || renderMobilePageEmptyState(`暂无${state.view}`, '盘点差异审核通过后会自动生成盘盈单或盘亏单。')
}

function renderStocktakePanel(): string {
  const rows = getRows()
  const order = rows.find((item) => item.stocktakeOrderId === state.selectedOrderId)
  if (order) return renderStocktakeDetailPage(order)
  return `
    ${renderStocktakeCreateButton()}
    <section class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <div class="text-sm font-semibold text-foreground">盘点</div>
        <span class="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">${rows.length} 单</span>
      </div>
      ${renderSectionFilterChips(state.view, STOCKTAKE_VIEWS, 'stocktake-view')}
      ${renderSectionFilterChips(state.status, FILTERS, 'stocktake-status')}
      ${renderStocktakeListByView(rows)}
    </section>
    ${renderCreateStocktakeDialog()}
  `
}

function renderStocktakeDetailPage(order: ReturnType<typeof getRows>[number]): string {
  const adjustments = listFactoryWarehouseAdjustmentOrdersByStocktake(order.stocktakeOrderId)
  return `
    <section class="space-y-4">
      <div class="flex items-start justify-between gap-3 px-1">
        <div class="min-w-0">
          <div class="text-lg font-semibold text-foreground">盘点详情</div>
          <div class="mt-1 text-xs leading-5 text-muted-foreground">${escapeHtml(order.stocktakeOrderNo)} · ${escapeHtml(order.warehouseName)} · ${order.isBlindStocktake ? '盲盘' : '非盲盘'}</div>
        </div>
        <button type="button" class="shrink-0 rounded-full bg-muted px-3 py-1.5 text-xs font-medium" data-pda-warehouse-action="close-stocktake-detail">返回列表</button>
      </div>
      ${renderCompactFieldList([
        ['盘点方式', order.stocktakeMethod || order.stocktakeScope],
        ['责任人', (order.ownerNames?.length ? order.ownerNames : [order.createdBy]).join('、')],
        ['盘点时间', order.plannedAt ? order.plannedAt.slice(0, 16).replace('T', ' ') : '-'],
        ['盘点结果', buildStocktakeOrderSummary(order)],
      ])}
      <section class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm font-semibold text-foreground">盘点对象明细</div>
          <span class="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">${order.lineList.length} 条</span>
        </div>
          ${order.lineList
            .map(
              (line) => `
                <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0 flex-1">
                      <div class="text-sm font-semibold text-foreground">${escapeHtml(`${line.itemKind} / ${line.itemName}`)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.materialSku || line.partName || '-')} · ${escapeHtml(line.fabricColor || '-')} / ${escapeHtml(line.sizeCode || '-')}</div>
                    </div>
                    ${renderStatusPill(buildStocktakeStatusText(line))}
                  </div>
                  <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    <div>菲票号 / 中转袋号：${escapeHtml(line.feiTicketNo || '-')} / ${escapeHtml(line.transferBagNo || '-')}</div>
                    <div>卷号：${escapeHtml(line.fabricRollNo || '-')}</div>
                    ${order.isBlindStocktake ? `<div>库存数量：盲盘不显示</div>` : `<div>库存数量：${line.bookQty} ${escapeHtml(line.unit)}</div>`}
                    <div>库区 / 货架 / 库位：${escapeHtml(line.areaName)} / ${escapeHtml(line.shelfNo)} / ${escapeHtml(line.locationNo)}</div>
                  </div>
                  <div class="mt-4 grid grid-cols-2 gap-2">
                    <label class="text-xs text-muted-foreground">
                      实盘数量
                      ${
                        order.status === '盘点中'
                          ? `<input
                              type="number"
                              min="0"
                              step="1"
                              class="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-sm"
                              data-pda-warehouse-field="stocktake-counted-qty"
                              data-order-id="${escapeAttr(order.stocktakeOrderId)}"
                              data-line-id="${escapeAttr(line.lineId)}"
                              value="${line.countedQty ?? ''}"
                            />`
                          : `<div class="mt-1 h-10 rounded-xl border bg-muted/40 px-3 py-2 text-sm text-foreground">${escapeHtml(line.countedQty === undefined ? '-' : String(line.countedQty))}</div>`
                      }
                    </label>
                    <label class="text-xs text-muted-foreground">
                      差异原因
                      ${
                        order.status === '盘点中'
                          ? `<input
                              type="text"
                              class="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-sm"
                              data-pda-warehouse-field="stocktake-difference-reason"
                              data-order-id="${escapeAttr(order.stocktakeOrderId)}"
                              data-line-id="${escapeAttr(line.lineId)}"
                              value="${escapeAttr(line.differenceReason || '')}"
                              placeholder="差异时必填"
                            />`
                          : `<div class="mt-1 h-10 rounded-xl border bg-muted/40 px-3 py-2 text-sm text-foreground">${escapeHtml(line.differenceReason || '-')}</div>`
                      }
                    </label>
                  </div>
                  <div class="mt-2 text-xs text-muted-foreground">差异数量：${escapeHtml(buildWarehouseDifferenceText(line.differenceQty))}</div>
                </article>
              `,
            )
            .join('')}
      </section>
      <section class="space-y-3">
        <div class="text-sm font-semibold text-foreground">盘盈 / 盘亏单</div>
        ${
          adjustments.length
            ? adjustments
                .map(
                  (item) => `
                    <article class="rounded-2xl border bg-card px-4 py-3 text-xs text-muted-foreground">
                      <div class="flex items-center justify-between gap-3">
                        <div class="font-semibold text-foreground">${escapeHtml(item.adjustmentOrderNo)}</div>
                        ${renderStatusPill(item.adjustmentType || '库存调整')}
                      </div>
                      <div class="mt-2">对象：${escapeHtml(item.materialSku || item.partName || item.itemName)}</div>
                      <div class="mt-1">库存 / 盘点：${escapeHtml(`${item.bookQty} / ${item.countedQty} ${item.unit}`)}，差异：${escapeHtml(`${item.adjustmentQty} ${item.unit}`)}</div>
                    </article>
                  `,
                )
                .join('')
            : renderMobilePageEmptyState('暂无盘盈盘亏单', '盘点差异审核通过后会生成盘盈单或盘亏单。')
        }
      </section>
      <div class="sticky bottom-0 border-t bg-background py-3">
        <div class="flex gap-2">
          <button type="button" class="flex-1 rounded-xl border px-3 py-2.5 text-sm" data-pda-warehouse-action="close-stocktake-detail">返回</button>
          ${order.status === '盘点中' ? `<button type="button" class="flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground" data-pda-warehouse-action="complete-stocktake" data-order-id="${escapeAttr(order.stocktakeOrderId)}">完成盘点</button>` : `<div class="flex-1 rounded-xl border px-3 py-2.5 text-center text-sm text-muted-foreground">${order.status === '待确认' ? '已提交差异待审核' : escapeHtml(order.status)}</div>`}
        </div>
      </div>
    </section>
  `
}

export function renderPdaWarehouseStocktakePage(): string {
  const runtime = getMobileWarehouseRuntimeContext()
  if (!runtime) return renderPdaFrame(renderMobilePageEmptyState('未登录', '请先登录工厂端移动应用。'), 'warehouse')
  const mode = getWarehouseToolMode()
  const modeMeta = MODE_OPTIONS.find((item) => item.value === mode) || MODE_OPTIONS[0]
  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      ${renderWarehouseQueryPageHeader(modeMeta.title, modeMeta.description)}
      ${mode === 'stocktake' ? renderStocktakePanel() : renderInventorySearchPanel(mode)}
    </div>
  `
  return renderPdaFrame(content, 'warehouse', { headerTitle: modeMeta.title })
}

export function handlePdaWarehouseStocktakeEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pda-warehouse-action]')
  const action = actionNode?.dataset.pdaWarehouseAction
  if (action === 'open-create-stocktake') {
    state.createDialogOpen = true
    return true
  }
  if (action === 'close-create-stocktake') {
    state.createDialogOpen = false
    return true
  }
  if (action === 'create-stocktake') {
    const runtime = getPdaRuntimeContext()
    const warehouse = getCurrentFactoryWarehouseByKind(state.createWarehouseKind)
    if (runtime && warehouse) {
      const created = createFactoryWarehouseStocktakeOrder(runtime.factoryId, warehouse.warehouseId, runtime.userName, {
        stocktakeMethod: '全盘',
        isBlindStocktake: state.createBlindStocktake,
        ownerNames: state.createOwnerNames.length ? state.createOwnerNames : [runtime.userName],
        plannedAt: state.createPlannedAt ? state.createPlannedAt.replace('T', ' ') : undefined,
      })
      if (created) {
        state.selectedOrderId = created.stocktakeOrderId
        state.createDialogOpen = false
      }
    }
    return true
  }
  if (action === 'open-stocktake-detail' && actionNode.dataset.orderId) {
    state.selectedOrderId = actionNode.dataset.orderId
    return true
  }
  if (action === 'close-stocktake-detail') {
    state.selectedOrderId = null
    return true
  }
  if (action === 'complete-stocktake' && actionNode.dataset.orderId) {
    completeFactoryWarehouseStocktakeOrder(actionNode.dataset.orderId)
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-pda-warehouse-field]')
  const field = fieldNode?.dataset.pdaWarehouseField
  const value =
    fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement || fieldNode instanceof HTMLTextAreaElement
      ? fieldNode.value
      : fieldNode?.dataset.value || ''
  if (field === 'stocktake-status') {
    state.status = value as StocktakeFilter
    return true
  }
  if (field === 'stocktake-view') {
    state.view = value as StocktakeView
    return true
  }
  if (field === 'stocktake-warehouse-kind') {
    state.createWarehouseKind = value as 'WAIT_PROCESS' | 'WAIT_HANDOVER'
    return true
  }
  if (field === 'stocktake-blind') {
    state.createBlindStocktake = value === 'true'
    return true
  }
  if (field === 'stocktake-owner') {
    state.createOwnerNames = state.createOwnerNames.includes(value)
      ? state.createOwnerNames.filter((item) => item !== value)
      : [...state.createOwnerNames, value]
    return true
  }
  if (field === 'stocktake-planned-at') {
    state.createPlannedAt = value
    return true
  }
  if ((field === 'stocktake-counted-qty' || field === 'stocktake-difference-reason') && fieldNode) {
    const orderId = fieldNode.dataset.orderId
    const lineId = fieldNode.dataset.lineId
    if (!orderId || !lineId) return false
    updateFactoryWarehouseStocktakeLine(orderId, lineId, {
      countedQty: field === 'stocktake-counted-qty' && value !== '' ? Number(value) : undefined,
      differenceReason: field === 'stocktake-difference-reason' ? value : undefined,
    })
    return true
  }
  return false
}
