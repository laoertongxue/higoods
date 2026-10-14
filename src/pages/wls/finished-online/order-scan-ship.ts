// 扫码打单工作页：扫描拣货单号 + 商品条码，选择打印机后打印面单。
// 属于扫码进入式工作页，不使用标准列表页骨架，也不声明 @page-pattern。
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { orderScanShipOrderSeed, ORDER_SCAN_SHIP_PRINTERS, type OrderScanShipOrder, type OrderScanShipLine } from './seed.ts'

const EVENT_PREFIX = 'wls-online-order-scan-ship'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())

const state = {
  pickOrderNo: '',
  barcode: '',
  printer: ORDER_SCAN_SHIP_PRINTERS[0] as string,
  loadedOrderNo: '' as string,
}

function findOrder(no: string): OrderScanShipOrder | undefined {
  const key = no.trim().toUpperCase()
  return orderScanShipOrderSeed.find(order => order.pickOrderNo.toUpperCase() === key)
}

function currentOrder(): OrderScanShipOrder | undefined {
  return state.loadedOrderNo ? findOrder(state.loadedOrderNo) : undefined
}

function lineStatusBadge(line: OrderScanShipLine): string {
  if (line.status === '已打印') return `<span class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">已打印</span>`
  if (line.status === '已扫描') return `<span class="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">已扫描</span>`
  return `<span class="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">待扫描</span>`
}

function renderResult(order: OrderScanShipOrder): string {
  const rows = order.lines.map(line => `
    <tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50">
      <td class="px-3 py-2 text-xs text-slate-600">
        <div>${escapeHtml(order.outboundOrderNo)}</div>
        <div class="text-slate-400">${escapeHtml(order.relatedOrderNo)}</div>
      </td>
      <td class="px-3 py-2">
        <img src="${escapeHtml(line.product.image)}" alt="${escapeHtml(line.product.name)}" loading="lazy" class="h-10 w-10 rounded-md border border-slate-200 object-cover" onerror="this.style.display='none'">
      </td>
      <td class="px-3 py-2 font-mono text-xs text-slate-600">${escapeHtml(line.product.sku)}</td>
      <td class="px-3 py-2 text-xs text-slate-700">${escapeHtml(line.product.name)}</td>
      <td class="px-3 py-2 text-right text-sm text-slate-700">${line.orderedQuantity}</td>
      <td class="px-3 py-2 text-right text-sm ${line.pickedQuantity >= line.orderedQuantity ? 'font-medium text-emerald-700' : 'text-slate-600'}">${line.pickedQuantity}</td>
      <td class="px-3 py-2">${lineStatusBadge(line)}</td>
      <td class="px-3 py-2 text-right"><button class="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50" data-${EVENT_PREFIX}-action="print-line" data-${EVENT_PREFIX}-line-id="${escapeHtml(line.id)}">打印</button></td>
    </tr>`).join('')

  return `<div class="rounded-lg border bg-white">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
      <span class="text-sm font-medium text-slate-700">订单结果（${order.lines.length} 行）</span>
      <span class="text-xs text-slate-500">打印机：${escapeHtml(state.printer)}</span>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full min-w-[900px]" data-${EVENT_PREFIX}-result>
        <thead class="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th class="px-3 py-2 text-left font-medium">订单信息</th>
            <th class="px-3 py-2 text-left font-medium">商品图片</th>
            <th class="px-3 py-2 text-left font-medium">商品SKU</th>
            <th class="px-3 py-2 text-left font-medium">商品名称</th>
            <th class="px-3 py-2 text-right font-medium">商品数量</th>
            <th class="px-3 py-2 text-right font-medium">拣货数量</th>
            <th class="px-3 py-2 text-left font-medium">状态</th>
            <th class="px-3 py-2 text-right font-medium">操作</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`
}

function renderWorkspace(): string {
  const order = currentOrder()
  const printerOptions = ORDER_SCAN_SHIP_PRINTERS
    .map(option => `<option value="${escapeHtml(option)}" ${state.printer === option ? 'selected' : ''}>${escapeHtml(option)}</option>`)
    .join('')
  return `<section class="space-y-3 p-4">
    <header><h1 class="text-xl font-semibold">扫码打单</h1><p class="mt-1 text-sm text-muted-foreground">扫描拣货单号加载订单，再扫描商品条码核对，选择打印机打印面单。</p></header>
    <div class="rounded-lg border bg-white p-3">
      <div class="grid gap-2 md:grid-cols-3">
        <label><span class="mb-1 block text-xs text-muted-foreground">扫描拣货单号</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.pickOrderNo)}" placeholder="扫描拣货单号" data-${EVENT_PREFIX}-field="pickOrderNo" data-skip-page-rerender="true"></label>
        <label><span class="mb-1 block text-xs text-muted-foreground">扫描商品条码</span><input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.barcode)}" placeholder="扫描商品条码" data-${EVENT_PREFIX}-field="barcode" data-skip-page-rerender="true"></label>
        <label><span class="mb-1 block text-xs text-muted-foreground">打印机</span><select class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" data-${EVENT_PREFIX}-field="printer">${printerOptions}</select></label>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        ${renderPrimaryButton('扫描', { prefix: EVENT_PREFIX, action: 'scan', skipPageRerender: true }, 'scan-line')}
        ${renderSecondaryButton('重新检测', { prefix: EVENT_PREFIX, action: 'reset-check', skipPageRerender: true }, 'rotate-ccw')}
      </div>
    </div>
    ${order ? renderResult(order) : `<div class="rounded-lg border border-dashed bg-white p-10 text-center text-sm text-muted-foreground">扫描拣货单号后展示订单结果</div>`}
  </section>`
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-root]`)
}

function refreshWorkspace(): void {
  const host = document.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-workspace]`)
  if (!host) return
  host.innerHTML = renderWorkspace()
  hydrateIcons(host)
}

function scan(): void {
  const root = rootElement()
  const read = (field: string): string => root?.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field="${field}"]`)?.value ?? ''
  state.pickOrderNo = read('pickOrderNo')
  state.barcode = read('barcode')
  state.printer = read('printer') || state.printer

  if (state.pickOrderNo.trim()) {
    const order = findOrder(state.pickOrderNo)
    if (!order) {
      state.loadedOrderNo = ''
      refreshWorkspace()
      showListFeedback('未找到该拣货单，请核对单号后重试', 'warning')
      return
    }
    if (state.loadedOrderNo !== order.pickOrderNo) {
      state.loadedOrderNo = order.pickOrderNo
      order.lines.forEach(line => { line.status = '待扫描' })
      refreshWorkspace()
    }
  }

  const order = currentOrder()
  if (!order) {
    refreshWorkspace()
    showListFeedback('请先扫描拣货单号加载订单', 'warning')
    return
  }
  const barcode = state.barcode.trim()
  if (!barcode) { refreshWorkspace(); showListFeedback('请扫描商品条码', 'warning'); return }
  const line = order.lines.find(item => item.barcode.toUpperCase() === barcode.toUpperCase() || item.product.sku.toUpperCase() === barcode.toUpperCase())
  if (!line) { refreshWorkspace(); showListFeedback(`未找到条码 ${barcode} 对应的商品，请重新检测`, 'warning'); return }
  if (line.status === '待扫描') line.status = '已扫描'
  state.barcode = ''
  refreshWorkspace()
  showListFeedback(`${line.product.sku} 已扫描，状态：${line.status}`)
}

export function renderWlsOnlineOrderScanShip(): string {
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleWlsOnlineOrderScanShipEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    const name = field.dataset[`${DATASET_PREFIX}Field`]
    if (name === 'pickOrderNo') { state.pickOrderNo = field.value; if (event?.type === 'keydown') scan(); return true }
    if (name === 'barcode') { state.barcode = field.value; if (event?.type === 'keydown') scan(); return true }
    if (name === 'printer') { state.printer = field.value; return true }
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset[`${DATASET_PREFIX}Action`]
  if (!actionNode || !action) return false
  if (event?.type === 'change') return true
  if (action === 'scan') { scan(); return true }
  if (action === 'reset-check') {
    const order = currentOrder()
    if (!order) { showListFeedback('请先扫描拣货单号加载订单', 'warning'); return true }
    order.lines.forEach(line => { line.status = '待扫描' })
    state.barcode = ''
    refreshWorkspace()
    showListFeedback('已重新检测，所有商品行恢复待扫描')
    return true
  }
  if (action === 'print-line') {
    const order = currentOrder()
    const line = order?.lines.find(item => item.id === (actionNode.dataset[`${DATASET_PREFIX}LineId`] || ''))
    if (!line) return true
    if (line.status === '待扫描') { showListFeedback('请先扫描该商品条码再打印', 'warning'); return true }
    line.status = '已打印'
    refreshWorkspace()
    showListFeedback(`${line.product.sku} 面单已打印（${state.printer}）`)
    return true
  }
  return false
}
