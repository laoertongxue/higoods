import {
  completeFactoryWarehouseStocktakeOrder,
  createFactoryWarehouseStocktakeOrder,
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
  getMobileWarehouseRuntimeContext,
  renderCompactFieldList,
  renderMobilePageEmptyState,
  renderSectionFilterChips,
  renderStatusPill,
  renderWarehouseSummaryHeader,
} from './pda-warehouse-shared'
import { escapeHtml } from '../utils'

type StocktakeFilter = '全部' | '盘点中' | '待确认' | '已完成' | '已取消'

interface StocktakeState {
  status: StocktakeFilter
  selectedOrderId: string | null
  createWarehouseKind: 'WAIT_PROCESS' | 'WAIT_HANDOVER'
}

const state: StocktakeState = {
  status: '全部',
  selectedOrderId: null,
  createWarehouseKind: 'WAIT_PROCESS',
}

const FILTERS: Array<{ value: StocktakeFilter; label: string }> = [
  { value: '全部', label: '全部' },
  { value: '盘点中', label: '盘点中' },
  { value: '待确认', label: '待确认' },
  { value: '已完成', label: '已完成' },
  { value: '已取消', label: '已取消' },
]

function getRows() {
  const runtime = getMobileWarehouseRuntimeContext()
  if (!runtime) return []
  return listFactoryWarehouseStocktakeOrders()
    .filter((item) => item.factoryId === runtime.factoryId)
    .filter((item) => (state.status === '全部' ? true : item.status === state.status))
}

function renderDetailDrawer(): string {
  const order = getRows().find((item) => item.stocktakeOrderId === state.selectedOrderId)
  if (!order) return ''
  return `
    <div class="fixed inset-0 z-[120]">
      <button type="button" class="absolute inset-0 bg-black/40" data-pda-warehouse-action="close-stocktake-detail"></button>
      <section class="absolute inset-x-0 bottom-[72px] top-16 overflow-y-auto rounded-t-3xl border bg-background px-4 py-4 shadow-2xl">
        <div class="sticky top-0 z-10 border-b bg-background pb-3">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold text-foreground">盘点详情</h2>
              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(order.stocktakeOrderNo)} · ${escapeHtml(order.warehouseName)}</div>
            </div>
            <button type="button" class="rounded-full border px-3 py-1 text-xs" data-pda-warehouse-action="close-stocktake-detail">关闭</button>
          </div>
        </div>
        <div class="mt-4 space-y-3">
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
                    <div>账面数量：${line.bookQty} ${escapeHtml(line.unit)}</div>
                    <div>库区 / 货架 / 库位：${escapeHtml(line.areaName)} / ${escapeHtml(line.shelfNo)} / ${escapeHtml(line.locationNo)}</div>
                  </div>
                  <div class="mt-4 grid grid-cols-2 gap-2">
                    <label class="text-xs text-muted-foreground">
                      实盘数量
                      <input
                        type="number"
                        min="0"
                        step="1"
                        class="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-sm"
                        data-pda-warehouse-field="stocktake-counted-qty"
                        data-order-id="${escapeAttr(order.stocktakeOrderId)}"
                        data-line-id="${escapeAttr(line.lineId)}"
                        value="${line.countedQty ?? ''}"
                      />
                    </label>
                    <label class="text-xs text-muted-foreground">
                      差异原因
                      <input
                        type="text"
                        class="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-sm"
                        data-pda-warehouse-field="stocktake-difference-reason"
                        data-order-id="${escapeAttr(order.stocktakeOrderId)}"
                        data-line-id="${escapeAttr(line.lineId)}"
                        value="${escapeAttr(line.differenceReason || '')}"
                        placeholder="差异时必填"
                      />
                    </label>
                  </div>
                  <div class="mt-2 text-xs text-muted-foreground">差异数量：${escapeHtml(buildWarehouseDifferenceText(line.differenceQty))}</div>
                </article>
              `,
            )
            .join('')}
        </div>
        <div class="sticky bottom-0 mt-4 border-t bg-background py-3">
          <div class="flex gap-2">
            <button type="button" class="flex-1 rounded-xl border px-3 py-2.5 text-sm" data-pda-warehouse-action="close-stocktake-detail">返回</button>
            <button type="button" class="flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground" data-pda-warehouse-action="complete-stocktake" data-order-id="${escapeAttr(order.stocktakeOrderId)}">完成盘点</button>
          </div>
        </div>
      </section>
    </div>
  `
}

export function renderPdaWarehouseStocktakePage(): string {
  const runtime = getMobileWarehouseRuntimeContext()
  if (!runtime) return renderPdaFrame(renderMobilePageEmptyState('未登录', '请先登录工厂端移动应用。'), 'warehouse')
  const rows = getRows()
  const content = `
    <div class="space-y-4 px-4 pb-5 pt-4">
      ${renderWarehouseSummaryHeader('盘点', '只支持全盘，记录差异，不生成完整库存调整单。', runtime.overview)}
      <section class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-sm font-semibold text-foreground">创建全盘</div>
            <div class="mt-1 text-xs text-muted-foreground">选择待加工仓或待交出仓，按当前库存明细生成盘点单。</div>
          </div>
          <button type="button" class="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground" data-pda-warehouse-action="create-stocktake">创建全盘</button>
        </div>
        <div class="mt-3 flex gap-2">
          <button type="button" class="rounded-full border px-3 py-1.5 text-xs ${state.createWarehouseKind === 'WAIT_PROCESS' ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}" data-pda-warehouse-field="stocktake-warehouse-kind" data-value="WAIT_PROCESS">待加工仓</button>
          <button type="button" class="rounded-full border px-3 py-1.5 text-xs ${state.createWarehouseKind === 'WAIT_HANDOVER' ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}" data-pda-warehouse-field="stocktake-warehouse-kind" data-value="WAIT_HANDOVER">待交出仓</button>
        </div>
      </section>
      ${renderSectionFilterChips(state.status, FILTERS, 'stocktake-status')}
      <section class="space-y-3">
        ${
          rows.length > 0
            ? rows
                .map(
                  (row) => `
                    <article class="rounded-2xl border bg-card px-4 py-4 shadow-sm">
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0 flex-1">
                          <div class="text-sm font-semibold text-foreground">${escapeHtml(row.stocktakeOrderNo)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.warehouseName)} · ${escapeHtml(row.stocktakeScope)}</div>
                        </div>
                        ${renderStatusPill(row.status)}
                      </div>
                      <div class="mt-3 space-y-1.5 text-xs text-muted-foreground">
                        <div>盘点人：${escapeHtml(row.createdBy)}</div>
                        <div>开始时间：${escapeHtml(row.startedAt ? row.startedAt.slice(0, 16) : '-')}</div>
                        <div>完成时间：${escapeHtml(row.completedAt ? row.completedAt.slice(0, 16) : '-')}</div>
                        <div>明细数 / 差异数：${escapeHtml(buildStocktakeOrderSummary(row))}</div>
                      </div>
                      <div class="mt-4 flex flex-wrap gap-2">
                        <button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-stocktake-detail" data-order-id="${escapeAttr(row.stocktakeOrderId)}">查看</button>
                        ${row.status === '盘点中' ? `<button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-warehouse-action="open-stocktake-detail" data-order-id="${escapeAttr(row.stocktakeOrderId)}">录入实盘</button>` : ''}
                      </div>
                    </article>
                  `,
                )
                .join('')
            : renderMobilePageEmptyState('暂无盘点记录', '点击“创建全盘”即可按当前仓库明细生成盘点单。')
        }
      </section>
      ${renderDetailDrawer()}
    </div>
  `
  return renderPdaFrame(content, 'warehouse', { headerTitle: '盘点' })
}

export function handlePdaWarehouseStocktakeEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pda-warehouse-action]')
  const action = actionNode?.dataset.pdaWarehouseAction
  if (action === 'create-stocktake') {
    const runtime = getPdaRuntimeContext()
    const warehouse = getCurrentFactoryWarehouseByKind(state.createWarehouseKind)
    if (runtime && warehouse) {
      const created = createFactoryWarehouseStocktakeOrder(runtime.factoryId, warehouse.warehouseId, runtime.userName)
      if (created) {
        state.selectedOrderId = created.stocktakeOrderId
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
  if (field === 'stocktake-warehouse-kind') {
    state.createWarehouseKind = value as 'WAIT_PROCESS' | 'WAIT_HANDOVER'
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
