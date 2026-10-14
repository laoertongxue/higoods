// 扫码拣货工作页：输入拣货单号回车/加载后展示拣货任务与明细。
// 属于扫码进入式工作页，不使用标准列表页骨架，也不声明 @page-pattern。
import { escapeHtml } from '../../../utils.ts'
import { hydrateIcons } from '../../../components/shell.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { showListFeedback } from '../../../components/ui/list-feedback.ts'
import { scanPickOrderSeed, type ScanPickOrder, type ScanPickLine } from './seed.ts'

const EVENT_PREFIX = 'wls-online-scan-pick'
const DATASET_PREFIX = EVENT_PREFIX.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())

const state = {
  query: '',
  loadedOrderNo: '' as string,
}

function findOrder(no: string): ScanPickOrder | undefined {
  const key = no.trim().toUpperCase()
  return scanPickOrderSeed.find(order => order.pickOrderNo.toUpperCase() === key)
}

function currentOrder(): ScanPickOrder | undefined {
  return state.loadedOrderNo ? findOrder(state.loadedOrderNo) : undefined
}

function lineStatusBadge(line: ScanPickLine): string {
  if (line.status === '已拣货') return `<span class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">已拣货</span>`
  return `<span class="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">待拣货</span>`
}

function renderOrderResult(order: ScanPickOrder): string {
  const totalPlanned = order.lines.reduce((sum, line) => sum + line.plannedQuantity, 0)
  const totalPicked = order.lines.reduce((sum, line) => sum + line.pickedQuantity, 0)
  const rows = order.lines.map(line => `
    <tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50">
      <td class="px-3 py-2">
        <div class="flex items-center gap-2">
          <img src="${escapeHtml(line.image)}" alt="${escapeHtml(line.name)}" loading="lazy" class="h-10 w-10 rounded-md border border-slate-200 object-cover" onerror="this.style.display='none'">
          <div class="min-w-0">
            <div class="truncate text-xs text-slate-700">${escapeHtml(line.name)}</div>
            <div class="font-mono text-[11px] text-blue-600">${escapeHtml(line.spu)}</div>
            <div class="font-mono text-[11px] text-slate-500">${escapeHtml(line.sku)}</div>
          </div>
        </div>
      </td>
      <td class="px-3 py-2 font-mono text-xs text-slate-600">${escapeHtml(line.location)}</td>
      <td class="px-3 py-2 text-right text-sm text-slate-700">${line.plannedQuantity}</td>
      <td class="px-3 py-2 text-right text-sm font-medium ${line.pickedQuantity >= line.plannedQuantity ? 'text-emerald-700' : 'text-slate-600'}">${line.pickedQuantity}</td>
      <td class="px-3 py-2">${lineStatusBadge(line)}</td>
      <td class="px-3 py-2 text-right">
        <button class="rounded ${line.status === '已拣货' ? 'cursor-not-allowed border border-slate-200 px-2 py-0.5 text-xs text-slate-400' : 'bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700'}" data-${EVENT_PREFIX}-action="pick-line" data-${EVENT_PREFIX}-line-id="${escapeHtml(line.id)}" ${line.status === '已拣货' ? 'disabled' : ''}>${line.status === '已拣货' ? '已拣货' : '确认拣货'}</button>
      </td>
    </tr>`).join('')

  return `<div class="space-y-3">
    <div class="rounded-lg border bg-white p-3">
      <div class="grid gap-2 text-sm text-slate-600 md:grid-cols-4">
        <div>拣货单号：<span class="font-medium text-slate-800">${escapeHtml(order.pickOrderNo)}</span></div>
        <div>出库单号：<span class="font-medium text-slate-800">${escapeHtml(order.outboundOrderNo)}</span></div>
        <div>关联单号：<span class="font-medium text-slate-800">${escapeHtml(order.relatedOrderNo)}</span></div>
        <div>出库仓库：<span class="font-medium text-slate-800">${escapeHtml(order.warehouse)}</span></div>
        <div>拣货类型：<span class="font-medium text-slate-800">${escapeHtml(order.pickType)}</span></div>
        <div>操作人员：<span class="font-medium text-slate-800">${escapeHtml(order.operator)}</span></div>
        <div>创建时间：<span class="font-medium text-slate-800">${escapeHtml(order.createdAt)}</span></div>
        <div>拣货进度：<span class="font-medium text-slate-800">${totalPicked} / ${totalPlanned}</span></div>
      </div>
    </div>
    <div class="rounded-lg border bg-white">
      <div class="flex items-center justify-between border-b px-3 py-2">
        <span class="text-sm font-medium text-slate-700">拣货明细（${order.lines.length} 行）</span>
        ${renderSecondaryButton('完成拣货', { prefix: EVENT_PREFIX, action: 'complete-pick', skipPageRerender: true })}
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[760px]" data-${EVENT_PREFIX}-detail>
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-3 py-2 text-left font-medium">商品信息</th>
              <th class="px-3 py-2 text-left font-medium">库位</th>
              <th class="px-3 py-2 text-right font-medium">应拣数量</th>
              <th class="px-3 py-2 text-right font-medium">已拣数量</th>
              <th class="px-3 py-2 text-left font-medium">状态</th>
              <th class="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </div>`
}

function renderWorkspace(): string {
  const order = currentOrder()
  return `<section class="space-y-3 p-4">
    <header><h1 class="text-xl font-semibold">扫描拣货</h1><p class="mt-1 text-sm text-muted-foreground">请扫描或输入拣货单号后回车，加载拣货任务与明细。</p></header>
    <div class="rounded-lg border bg-white p-3">
      <div class="flex flex-wrap items-center gap-2">
        <input class="h-9 w-80 rounded-md border border-input bg-background px-3 text-sm" value="${escapeHtml(state.query)}" placeholder="请扫描或输入拣货单号后回车" data-${EVENT_PREFIX}-field="query" data-skip-page-rerender="true">
        ${renderPrimaryButton('加载', { prefix: EVENT_PREFIX, action: 'load', skipPageRerender: true }, 'search')}
        ${renderSecondaryButton('清空', { prefix: EVENT_PREFIX, action: 'clear', skipPageRerender: true }, 'rotate-ccw')}
      </div>
    </div>
    <div data-${EVENT_PREFIX}-result>${order ? renderOrderResult(order) : `<div class="rounded-lg border border-dashed bg-white p-10 text-center text-sm text-muted-foreground">扫描拣货单号后展示拣货任务</div>`}</div>
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

function loadOrder(): void {
  const input = rootElement()?.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-field="query"]`)
  const value = input ? input.value : state.query
  state.query = value
  const order = findOrder(value)
  if (!order) {
    state.loadedOrderNo = ''
    refreshWorkspace()
    showListFeedback('未找到该拣货单，请核对单号后重试', 'warning')
    return
  }
  state.loadedOrderNo = order.pickOrderNo
  refreshWorkspace()
  showListFeedback(`拣货单 ${order.pickOrderNo} 已加载，共 ${order.lines.length} 行商品`)
}

export function renderWlsOnlineScanPick(): string {
  return `<div data-${EVENT_PREFIX}-root data-skip-page-rerender="true"><div data-${EVENT_PREFIX}-workspace>${renderWorkspace()}</div></div>`
}

export function handleWlsOnlineScanPickEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement()) return false
  const field = target.closest<HTMLInputElement>(`[data-${EVENT_PREFIX}-field]`)
  if (field) {
    if (field.dataset[`${DATASET_PREFIX}Field`] === 'query') {
      state.query = field.value
      if (event?.type === 'keydown') { loadOrder(); return true }
      return true
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset[`${DATASET_PREFIX}Action`]
  if (!actionNode || !action) return false
  if (event?.type === 'change') return true
  if (action === 'load') { loadOrder(); return true }
  if (action === 'clear') { state.query = ''; state.loadedOrderNo = ''; refreshWorkspace(); return true }
  if (action === 'pick-line') {
    const order = currentOrder()
    const line = order?.lines.find(item => item.id === (actionNode.dataset[`${DATASET_PREFIX}LineId`] || ''))
    if (!line) return true
    if (line.status === '已拣货') { showListFeedback('该商品行已拣货', 'info'); return true }
    line.pickedQuantity = line.plannedQuantity
    line.status = '已拣货'
    refreshWorkspace()
    showListFeedback(`${line.sku} 已拣货 ${line.pickedQuantity} 件`)
    return true
  }
  if (action === 'complete-pick') {
    const order = currentOrder()
    if (!order) return true
    const remaining = order.lines.filter(line => line.status !== '已拣货')
    if (remaining.length > 0) {
      showListFeedback(`还有 ${remaining.length} 行商品未拣货，暂不能完成`, 'warning')
      return true
    }
    order.status = '拣货完成'
    refreshWorkspace()
    showListFeedback(`拣货单 ${order.pickOrderNo} 已完成拣货`)
    return true
  }
  return false
}
