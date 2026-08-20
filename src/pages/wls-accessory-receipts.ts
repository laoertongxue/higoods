// @page-pattern: list
import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../components/ui/list-table-model.ts'
import {
  confirmLaceReceipt,
  LaceDomainError,
  listLaceHandovers,
  listLaceReceipts,
  WLS_ACCESSORY_CLERK,
  WLS_ACCESSORY_SUPERVISOR,
  type ConfirmLaceReceiptCommand,
  type LaceActor,
  type LaceHandoverRecord,
  type LaceReceiptRecord,
} from '../data/fcs/lace-factory-domain.ts'
import {
  confirmButtonLoopAccessoryReceipt,
  listButtonLoopAccessoryReceiptRows,
} from '../data/fcs/button-loop-accessory-receipts.ts'
import { escapeHtml } from '../utils.ts'
import {
  formatJakartaTime,
  formatLaceQty,
  handleLaceCommonImageEvent,
  hydrateLaceSurface,
  nextLaceClientActionId,
  readNumberField,
  readTextField,
  renderLaceBusinessImage,
  renderLaceFeedback,
  renderLaceImagePreview,
  renderLaceSourceStyles,
  renderLaceStatusBadge,
} from './process-factory/accessory/lace/shared.ts'

interface ReceiptRow {
  handover: LaceHandoverRecord
  receipt?: LaceReceiptRecord
}

interface ReceiptPageState extends ProcessOrderListControllerState {
  keyword: string
  status: '' | '待收货' | '已收货'
  overlay: null
    | { kind: 'receipt'; handoverId: string; clientActionId: string }
    | { kind: 'over-confirm'; command: ConfirmLaceReceiptCommand }
  overlayError: string
  feedback: string
  feedbackOk: boolean
  actorRole: '中央辅料仓管' | '中央辅料仓主管'
}

const EVENT_PREFIX = 'wls-lace-receipts'
const ROOT_SELECTOR = '[data-wls-lace-receipts-root]'
const state: ReceiptPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  status: '',
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
  actorRole: '中央辅料仓管',
}

function currentReceiptActor(): LaceActor {
  return state.actorRole === '中央辅料仓主管' ? WLS_ACCESSORY_SUPERVISOR : WLS_ACCESSORY_CLERK
}

function allRows(): ReceiptRow[] {
  const receipts = new Map(listLaceReceipts().map((receipt) => [receipt.handoverId, receipt]))
  return listLaceHandovers(undefined, currentReceiptActor()).map((handover) => ({ handover, receipt: receipts.get(handover.handoverId) }))
}

function filteredRows(): ReceiptRow[] {
  const keyword = state.keyword.trim().toLowerCase()
  return allRows().filter((row) => {
    if (state.status && row.handover.receiptStatus !== state.status) return false
    if (!keyword) return true
    return [
      row.handover.handoverNo,
      row.handover.workOrderNo,
      row.handover.purchaseOrderNo,
      row.handover.skuCode,
      row.handover.materialName,
      row.handover.fromFactoryName,
      ...row.handover.sourceLines.flatMap((sourceLine) => [sourceLine.styleCode, sourceLine.styleName]),
    ]
      .some((value) => value.toLowerCase().includes(keyword))
  })
}

const columns: StandardListColumn<ReceiptRow>[] = [
  {
    key: 'handover', title: '待收货来源', width: 200, required: true, freezeable: true, sortable: true,
    sortValue: (row) => row.handover.handoverNo,
    render: (row) => `<div class="font-semibold">${escapeHtml(row.handover.handoverNo)}</div><div class="mt-1 text-xs text-slate-500">生产单 ${escapeHtml(row.handover.workOrderNo)}</div><div class="text-xs text-slate-500">采购单 ${escapeHtml(row.handover.purchaseOrderNo)}</div>`,
  },
  {
    key: 'style', title: '款式', width: 220,
    render: (row) => renderLaceSourceStyles(row.handover.sourceLines),
  },
  {
    key: 'material', title: '花边 SKU', width: 260, required: true,
    render: (row) => `<div class="flex items-center gap-3">${renderLaceBusinessImage(row.handover.materialImageUrl, `${row.handover.materialName}（${row.handover.skuCode}）实物图`)}<div><div class="font-medium">${escapeHtml(row.handover.materialName)}</div><div class="text-xs text-slate-500">${escapeHtml(row.handover.skuCode)}</div></div></div>`,
  },
  {
    key: 'factory', title: '交出方／目标仓', width: 230,
    render: (row) => `<div>${escapeHtml(row.handover.fromFactoryName)}</div><div class="mt-1 text-xs text-slate-500">→ ${escapeHtml(row.handover.toWarehouseName)}</div>`,
  },
  {
    key: 'handoverQty', title: '交出数量', width: 130, align: 'right', sortable: true,
    sortValue: (row) => row.handover.qty,
    render: (row) => `<strong>${formatLaceQty(row.handover.qty, row.handover.unit)}</strong>`,
  },
  {
    key: 'receiptQty', title: '实际收货／差异', width: 200, sortable: true,
    sortValue: (row) => row.receipt?.actualQty,
    render: (row) => row.receipt
      ? `<strong>${formatLaceQty(row.receipt.actualQty, row.receipt.unit)}</strong><div class="mt-1 text-xs ${row.receipt.actualQty === row.handover.qty ? 'text-emerald-700' : 'text-red-700'}">${row.receipt.actualQty === row.handover.qty ? '数量一致' : row.receipt.actualQty < row.handover.qty ? `少收 ${formatLaceQty(row.handover.qty - row.receipt.actualQty, row.handover.unit)}` : `多收 ${formatLaceQty(row.receipt.actualQty - row.handover.qty, row.handover.unit)}`}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.receipt.differenceReason || '—')}</div>`
      : '<span class="text-amber-800">待实际清点</span>',
  },
  {
    key: 'package', title: '送货／包装', width: 220,
    render: (row) => `<div>${escapeHtml(row.handover.deliveryNo)} · ${row.handover.packageCount} 包</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.handover.packageNote || '无')}</div>`,
  },
  {
    key: 'status', title: '收货状态', width: 120, sortable: true,
    sortValue: (row) => row.handover.receiptStatus,
    render: (row) => renderLaceStatusBadge(row.handover.receiptStatus, row.handover.receiptStatus === '已收货' ? 'green' : 'yellow'),
  },
  {
    key: 'time', title: '交出／收货时间', width: 190, sortable: true,
    sortValue: (row) => row.handover.handedOverAt,
    render: (row) => `<div>${formatJakartaTime(row.handover.handedOverAt)}</div><div class="mt-1 text-xs text-slate-500">${row.receipt ? `${formatJakartaTime(row.receipt.receivedAt)} · ${escapeHtml(row.receipt.receivedByName)}` : '尚未收货'}</div>${row.receipt ? `<div class="mt-1 text-xs text-slate-500">入库库区：${escapeHtml(row.receipt.warehouseLocation)}</div>` : ''}`,
  },
  {
    key: 'actions', title: '操作', width: 130, required: true, actionColumn: true,
    render: (row) => row.handover.receiptStatus === '待收货'
      ? `<button type="button" class="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700" data-wls-lace-receipts-action="open-receipt" data-handover-id="${escapeHtml(row.handover.handoverId)}" data-skip-page-rerender="true">确认实际收货</button>`
      : `<button type="button" class="rounded-md border px-2 py-1 text-xs" data-nav="/fcs/craft/accessory/lace/work-orders/${encodeURIComponent(row.handover.workOrderId)}">查看生产单</button>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/wls/accessory-receipts',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-wls-lace-receipts-table-surface]',
  paginationSurfaceSelector: '[data-wls-lace-receipts-pagination-surface]',
  overlaysSurfaceSelector: '[data-wls-lace-receipts-column-overlays]',
  defaultFrozenKeys: ['handover'],
  columnSettingsTitle: '中央辅料仓收货列设置',
  emptyText: '暂无花边交出待收货记录',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function renderFilters(): string {
  return `<div class="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3"><label class="min-w-[18rem] flex-1"><span class="mb-1 block text-xs text-slate-500">交出单／生产单／采购单／SKU／工厂</span><input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.keyword)}" data-wls-lace-receipts-field="keyword" data-skip-page-rerender="true"></label><label class="min-w-40"><span class="mb-1 block text-xs text-slate-500">收货状态</span><select class="h-9 w-full rounded-md border bg-white px-3 text-sm" data-wls-lace-receipts-field="status" data-skip-page-rerender="true"><option value="">全部</option><option value="待收货" ${state.status === '待收货' ? 'selected' : ''}>待收货</option><option value="已收货" ${state.status === '已收货' ? 'selected' : ''}>已收货</option></select></label><button class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white" data-wls-lace-receipts-action="apply-filters" data-skip-page-rerender="true">查询</button><button class="h-9 rounded-md border px-4 text-sm" data-wls-lace-receipts-action="reset-filters" data-skip-page-rerender="true">重置</button></div>`
}

function currentOverlayHandover(): LaceHandoverRecord | undefined {
  if (!state.overlay) return undefined
  const handoverId = state.overlay.kind === 'receipt' ? state.overlay.handoverId : state.overlay.command.handoverId
  return listLaceHandovers(undefined, currentReceiptActor()).find((handover) => handover.handoverId === handoverId)
}

function renderReceiptOverlay(): string {
  const handover = currentOverlayHandover()
  if (!state.overlay || !handover) return ''
  if (state.overlay.kind === 'over-confirm') {
    const supervisor = currentReceiptActor().role === '中央辅料仓主管'
    return `<div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true"><section class="w-full max-w-lg rounded-xl bg-white shadow-2xl"><header class="border-b px-5 py-4"><h2 class="font-semibold">多收二次确认</h2></header><div class="p-5"><div class="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><strong>交出 ${formatLaceQty(handover.qty, handover.unit)}，拟实收 ${formatLaceQty(state.overlay.command.actualQty, handover.unit)}</strong><p class="mt-2">多收必须由中央辅料仓主管再次确认，并保留差异原因和凭证。</p></div><label class="mt-4 block text-sm"><span class="mb-1 block text-xs text-slate-500">当前收货身份</span><select class="h-9 w-full rounded-md border bg-white px-3" data-wls-lace-receipts-field="actorRole" data-skip-page-rerender="true"><option value="中央辅料仓管" ${state.actorRole === '中央辅料仓管' ? 'selected' : ''}>中央辅料仓收货人员</option><option value="中央辅料仓主管" ${state.actorRole === '中央辅料仓主管' ? 'selected' : ''}>中央辅料仓主管</option></select></label>${!supervisor ? '<p class="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">当前收货人员不能确认多收，请由已登录的中央辅料仓主管切换到本人身份处理。</p>' : ''}${state.overlayError ? `<div class="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">${escapeHtml(state.overlayError)}</div>` : ''}</div><footer class="flex justify-end gap-2 border-t px-5 py-4"><button class="rounded-md border px-4 py-2 text-sm" data-wls-lace-receipts-action="close-overlay" data-skip-page-rerender="true">取消</button>${supervisor ? '<button class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white" data-wls-lace-receipts-action="confirm-over-receipt" data-skip-page-rerender="true">主管确认并收货</button>' : ''}</footer></section></div>`
  }
  return `<div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true"><section class="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl"><header class="flex items-center justify-between border-b px-5 py-4"><div><h2 class="font-semibold">确认实际收货</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(handover.handoverNo)} · ${escapeHtml(handover.workOrderNo)}</p></div><button class="rounded-md border px-3 py-1.5 text-sm" data-wls-lace-receipts-action="close-overlay" data-skip-page-rerender="true">关闭</button></header><div class="max-h-[68vh] overflow-y-auto p-5">${state.overlayError ? `<div class="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">${escapeHtml(state.overlayError)}</div>` : ''}<div class="mb-4 flex items-center gap-3 rounded-md border p-3">${renderLaceBusinessImage(handover.materialImageUrl, `${handover.materialName}（${handover.skuCode}）实物图`, 'h-16 w-16')}<div><strong>${escapeHtml(handover.materialName)}</strong><div class="text-xs text-slate-500">${escapeHtml(handover.skuCode)}</div><div class="mt-1 text-sm">交出 ${formatLaceQty(handover.qty, handover.unit)} · ${escapeHtml(handover.fromFactoryName)}</div></div></div><div class="grid gap-4 sm:grid-cols-2"><label><span class="mb-1 block text-xs text-slate-500">实际收货数量</span><div class="flex items-center gap-2"><input type="number" min="0" step="0.01" class="h-9 w-full rounded-md border px-3" value="${handover.qty}" data-wls-lace-receipts-field="actualQty"><span>${escapeHtml(handover.unit)}</span></div></label><label><span class="mb-1 block text-xs text-slate-500">收货人</span><input class="h-9 w-full rounded-md border bg-slate-50 px-3" value="${escapeHtml(currentReceiptActor().actorName)}" disabled></label><label><span class="mb-1 block text-xs text-slate-500">入库库区</span><input class="h-9 w-full rounded-md border px-3" value="辅料收货区 A-01" data-wls-lace-receipts-field="warehouseLocation"></label><label><span class="mb-1 block text-xs text-slate-500">入库仓库</span><input class="h-9 w-full rounded-md border bg-slate-50 px-3" value="${escapeHtml(handover.toWarehouseName)}" disabled></label></div><label class="mt-4 block"><span class="mb-1 block text-xs text-slate-500">差异原因</span><textarea class="min-h-20 w-full rounded-md border p-3" data-wls-lace-receipts-field="differenceReason" placeholder="数量不一致时必填"></textarea></label><label class="mt-4 block"><span class="mb-1 block text-xs text-slate-500">收货凭证</span><input class="h-9 w-full rounded-md border px-3" value="${escapeHtml(handover.handoverNo)}-收货清点.jpg" data-wls-lace-receipts-field="evidence"><span class="mt-1 block text-xs text-slate-500">原型记录凭证名称；上传失败时本次不会保存，可保留当前单据重新提交。</span></label><p class="mt-4 text-xs text-slate-500">未看到成功提示即表示本次未保存；网络恢复或修正内容后点击“确认实际收货”重试。</p></div><footer class="flex justify-end gap-2 border-t px-5 py-4"><button class="rounded-md border px-4 py-2 text-sm" data-wls-lace-receipts-action="close-overlay" data-skip-page-rerender="true">取消</button><button class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white" data-wls-lace-receipts-action="save-receipt" data-skip-page-rerender="true">确认实际收货</button></footer></section></div>`
}

function renderOverlays(): string {
  return `<div data-wls-lace-receipts-column-overlays>${controller.renderColumnSettings()}</div>${renderReceiptOverlay()}${renderLaceImagePreview()}`
}

function renderButtonLoopReceiptSection(): string {
  const rows = listButtonLoopAccessoryReceiptRows()
  return `
    <section class="overflow-hidden rounded-lg border border-amber-200 bg-white" data-wls-button-loop-receipts>
      <header class="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3">
        <div>
          <h2 class="font-semibold text-amber-950">盘扣成品收货</h2>
          <p class="mt-1 text-xs text-amber-800">来源为 APF - 辅助工艺已发起交出的盘扣加工单；收货与库存单位均为“个”。</p>
        </div>
        <span class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-900">中央辅料仓</span>
      </header>
      ${rows.length ? `
        <div class="overflow-x-auto">
          <table class="w-full min-w-[880px] text-left text-sm">
            <thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="px-4 py-3">交出单／加工单</th><th class="px-4 py-3">生产单</th><th class="px-4 py-3">交出方</th><th class="px-4 py-3 text-right">交出数量</th><th class="px-4 py-3">去向</th><th class="px-4 py-3">收货状态</th><th class="px-4 py-3 text-right">操作</th></tr></thead>
            <tbody class="divide-y divide-slate-100">${rows.map((row) => `
              <tr>
                <td class="px-4 py-3"><strong>${escapeHtml(row.handoverNo)}</strong><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.task.taskOrderNo)}</div></td>
                <td class="px-4 py-3">${escapeHtml(row.task.productionOrderNo)}</td>
                <td class="px-4 py-3">${escapeHtml(row.task.factoryName)}</td>
                <td class="px-4 py-3 text-right font-semibold">${row.handedOverQty} 个</td>
                <td class="px-4 py-3">${escapeHtml(row.destinationWarehouseName)}</td>
                <td class="px-4 py-3">${row.status === '已收货' && row.receipt
                  ? `<span class="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">已收货 ${row.receipt.receivedQty} 个</span><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.receipt.receivedBy)} · ${escapeHtml(row.receipt.receivedAt)}</div>`
                  : row.receipt
                    ? `<span class="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">已收货 ${row.receipt.receivedQty} 个 / 待收货 ${row.pendingReceiptQty} 个</span><div class="mt-1 text-xs text-slate-500">上一批：${escapeHtml(row.receipt.receivedBy)} · ${escapeHtml(row.receipt.receivedAt)}</div>`
                    : '<span class="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">待收货</span>'}</td>
                <td class="px-4 py-3 text-right">${row.status === '已收货'
                  ? '<span class="text-xs text-slate-400">已完成</span>'
                  : `<button type="button" class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700" data-wls-button-loop-action="confirm-receipt" data-task-order-id="${escapeHtml(row.task.taskOrderId)}" data-skip-page-rerender="true">${row.receipt ? `确认新增收货（${row.pendingReceiptQty} 个）` : '确认全部收货'}</button>`}</td>
              </tr>
            `).join('')}</tbody>
          </table>
        </div>
      ` : '<div class="px-4 py-6 text-sm text-slate-500">暂无已发起交出的盘扣成品。盘扣加工单完成“发起交出”后会自动出现在这里。</div>'}
    </section>
  `
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  const all = allRows()
  const differences = all.filter((row) => row.receipt && row.receipt.actualQty !== row.handover.qty).length
  return renderStandardListPage({
    title: '中央辅料仓收货',
    primaryActionsHtml: `<label class="flex items-center gap-2 text-xs text-slate-500"><span>当前收货身份</span><select class="h-8 rounded-md border bg-white px-2 text-sm text-slate-800" data-wls-lace-receipts-field="actorRole" data-skip-page-rerender="true"><option value="中央辅料仓管" ${state.actorRole === '中央辅料仓管' ? 'selected' : ''}>中央辅料仓收货人员</option><option value="中央辅料仓主管" ${state.actorRole === '中央辅料仓主管' ? 'selected' : ''}>中央辅料仓主管</option></select><span>中央仓库·辅料仓</span></label>`,
    feedbackHtml: `<div>${renderLaceFeedback(state.feedback, state.feedbackOk)}</div>${renderButtonLoopReceiptSection()}`,
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '待收货', value: `${all.filter((row) => row.handover.receiptStatus === '待收货').length} 条` },
      { label: '已收货', value: `${all.filter((row) => row.handover.receiptStatus === '已收货').length} 条` },
      { label: '存在收货差异', value: `${differences} 条` },
    ]),
    listTitle: '花边交出待收货记录',
    listActionsHtml: '<button class="rounded-md border px-3 py-1.5 text-sm" data-wls-lace-receipts-action="open-column-settings" data-skip-page-rerender="true">列设置</button>',
    tableHtml: `<div data-wls-lace-receipts-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-wls-lace-receipts-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-wls-lace-receipts-overlays>${renderOverlays()}</div>`,
  })
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  root.innerHTML = renderInner()
  hydrateLaceSurface(root)
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-wls-lace-receipts-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydrateLaceSurface(surface)
}

export function renderWlsAccessoryReceiptsPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-wls-lace-receipts-root data-skip-page-rerender="true">${renderInner()}</div>`
}

export function handleWlsAccessoryReceiptsEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  const buttonLoopAction = target.closest<HTMLElement>('[data-wls-button-loop-action]')
  if (buttonLoopAction?.dataset.wlsButtonLoopAction === 'confirm-receipt') {
    try {
      const actor = currentReceiptActor()
      const receipt = confirmButtonLoopAccessoryReceipt({
        taskOrderId: buttonLoopAction.dataset.taskOrderId || '',
        receivedBy: actor.actorName,
        receivedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      })
      state.feedback = `盘扣成品 ${receipt.receivedQty} 个已确认进入中央辅料仓。`
      state.feedbackOk = true
    } catch (error) {
      state.feedback = `盘扣收货未保存：${error instanceof Error ? error.message : String(error)}`
      state.feedbackOk = false
    }
    refreshAll()
    return true
  }
  if (handleLaceCommonImageEvent(target, event, refreshOverlays)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    state.overlay = null
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-wls-lace-receipts-field]')
  if (field) {
    const name = field.dataset.wlsLaceReceiptsField
    if (name === 'keyword') state.keyword = field.value
    if (name === 'status') state.status = field.value as ReceiptPageState['status']
    if (name === 'actorRole') {
      state.actorRole = field.value as ReceiptPageState['actorRole']
      state.feedback = `当前收货身份已切换为${currentReceiptActor().actorName}；多收确认不会自动替换成主管身份。`
      state.feedbackOk = true
      if (state.overlay?.kind === 'over-confirm') refreshOverlays()
      else refreshAll()
      return true
    }
    if (name === 'pageSize' && event?.type === 'change') {
      controller.setPageSize(Number(field.value))
      controller.refresh()
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-wls-lace-receipts-action]')
  const action = actionNode?.dataset.wlsLaceReceiptsAction
  if (!actionNode || !action) return false
  if (action === 'prev-page' || action === 'next-page') {
    controller.stepPage(action === 'prev-page' ? -1 : 1)
    controller.refresh()
    return true
  }
  if (action === 'sort-column') {
    controller.cycleSort(actionNode.dataset.columnKey || '')
    controller.refresh()
    return true
  }
  if (action === 'open-column-settings') state.showColumnSettings = true
  if (action === 'close-column-settings') state.showColumnSettings = false
  if (action === 'restore-column-settings') controller.restorePreferences()
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const checkbox = actionNode.closest<HTMLInputElement>('input')
    controller.updateColumnPreference(action, actionNode.dataset.wlsLaceReceiptsColumnKey || actionNode.closest<HTMLElement>('[data-wls-lace-receipts-column-key]')?.dataset.wlsLaceReceiptsColumnKey || '', checkbox?.checked)
  }
  if (['open-column-settings', 'close-column-settings', 'restore-column-settings', 'toggle-column-visibility', 'toggle-column-freeze'].includes(action)) {
    refreshOverlays()
    controller.refresh()
    return true
  }
  if (action === 'apply-filters') {
    state.currentPage = 1
    controller.refresh()
    return true
  }
  if (action === 'reset-filters') {
    state.keyword = ''
    state.status = ''
    state.currentPage = 1
    controller.refresh()
    return true
  }
  if (action === 'open-receipt') {
    state.overlay = { kind: 'receipt', handoverId: actionNode.dataset.handoverId || '', clientActionId: nextLaceClientActionId('WLS-LACE-RECEIPT') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'close-overlay') {
    state.overlay = null
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  const scope = rootElement() ?? document
  if (action === 'save-receipt' && state.overlay?.kind === 'receipt') {
    const command: ConfirmLaceReceiptCommand = {
      handoverId: state.overlay.handoverId,
      actualQty: readNumberField(scope, '[data-wls-lace-receipts-field="actualQty"]'),
      differenceReason: readTextField(scope, '[data-wls-lace-receipts-field="differenceReason"]'),
      evidence: readTextField(scope, '[data-wls-lace-receipts-field="evidence"]'),
      warehouseLocation: readTextField(scope, '[data-wls-lace-receipts-field="warehouseLocation"]'),
      clientActionId: state.overlay.clientActionId,
      actor: currentReceiptActor(),
    }
    try {
      confirmLaceReceipt(command)
      state.overlay = null
      state.feedback = '实际收货已确认，并按 WLS 实收数量回写采购单 SKU。'
      state.feedbackOk = true
      refreshAll()
    } catch (error) {
      if (error instanceof LaceDomainError && error.code === 'OVER_RECEIPT_CONFIRM_REQUIRED') {
        state.overlay = { kind: 'over-confirm', command }
        state.overlayError = ''
        refreshOverlays()
      } else {
        state.overlayError = `未保存：${error instanceof Error ? error.message : String(error)}。请修正后重新提交。`
        refreshOverlays()
      }
    }
    return true
  }
  if (action === 'confirm-over-receipt' && state.overlay?.kind === 'over-confirm') {
    try {
      confirmLaceReceipt({ ...state.overlay.command, overReceiptConfirmed: true, actor: currentReceiptActor() })
      state.overlay = null
      state.feedback = '中央辅料仓主管已二次确认多收，实收和差异凭证已记录。'
      state.feedbackOk = true
      refreshAll()
    } catch (error) {
      state.overlayError = `未保存：${error instanceof Error ? error.message : String(error)}。请修正后重新提交。`
      refreshOverlays()
    }
    return true
  }
  return false
}
