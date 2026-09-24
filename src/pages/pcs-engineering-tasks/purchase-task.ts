import { renderProfessionalBusinessList } from './business-list.ts'
// @page-pattern: list
// 标准列表由 business-list 复用 renderStandardListPage、renderStandardListTable、renderTablePagination。
// 辅料下单任务模块：读取生产准备单任务记录，列表 / 详情渲染与列表分派注册。
// 页面只读展示任务记录，任务状态推进在生产准备单详情完成。




import {
  type AccessoryPurchaseTaskLinkage,
  bindAccessoryPurchaseOrder,
  computeAccessoryPurchaseTaskLinkage,
  reconcileAccessoryPurchaseTaskLinkage,
  unbindAccessoryPurchaseOrder,
} from '../../data/pcs-engineering-purchase-linkage.ts'
import { escapeHtml } from '../../utils.ts'
import { renderEmptyDetail, renderStatusBadge } from './shared.ts'
import { getEngineeringTaskDetail, renderTaskDependencyCard, renderTaskLogsCard, renderTaskMaterialLinesCard, renderTaskWorkbenchHeader } from './master-task-common.ts'

const PURCHASE_TASK_TYPES = ['ACCESSORY_PURCHASE'] as const
const PURCHASE_LIST_PATH = '/pcs/production-preparation/purchase'
const PURCHASE_DETAIL_PAGE_SIZE = 5
const PURCHASE_FILTER_STATUS_OPTIONS = ['待开始', '进行中', '已完成']
const purchaseDetailPages = new Map<string, number>()
const CURRENT_PURCHASE_OPERATOR = { operatorId: 'U-PURCHASE-AHAO', operatorName: '采购人员-阿昊', operatorRole: '采购人员' as const }

function renderPurchaseOrderRow(
  order: AccessoryPurchaseTaskLinkage['purchaseOrders'][number],
  masterOrderId: string,
  taskId: string,
): string {
  const unbindButton = `<button type="button" class="text-rose-600 hover:underline" data-purchase-action="unbind-order" data-master-order-id="${escapeHtml(masterOrderId)}" data-task-id="${escapeHtml(taskId)}" data-purchase-order-no="${escapeHtml(order.purchaseOrderNo)}">解除绑定</button>`
  if (order.accessStatus === '无权读取') {
    return `<tr class="border-t border-slate-100">
      <td class="px-3 py-3 font-medium">${escapeHtml(order.purchaseOrderNo)}</td>
      <td colspan="5" class="px-3 py-3 text-amber-700">无权读取</td>
      <td class="px-3 py-3 text-right">${unbindButton}</td>
    </tr>`
  }
  return `<tr class="border-t border-slate-100">
    <td class="px-3 py-3 font-medium">${escapeHtml(order.purchaseOrderNo)}</td>
    <td class="px-3 py-3">${escapeHtml(order.supplierName)}</td>
    <td class="px-3 py-3">${order.materialLines.map((line) => `${escapeHtml(line.materialSkuId)} · ${escapeHtml(line.materialName)}`).join('<br>')}</td>
    <td class="px-3 py-3">${order.materialLines.map((line) => `${line.quantity} ${escapeHtml(line.unit)}`).join('<br>')}</td>
    <td class="px-3 py-3">${escapeHtml(order.status)}</td>
    <td class="px-3 py-3">${escapeHtml(order.orderedAt || '未下单')}</td>
    <td class="px-3 py-3 text-right">${unbindButton}</td>
  </tr>`
}

function renderPurchaseSummaryContent(linkage: AccessoryPurchaseTaskLinkage): string {
  const { task, gate } = linkage
  return `<div class="grid gap-3 px-5 py-4 sm:grid-cols-3">
    <div><p class="text-xs text-slate-500">任务状态</p><div class="mt-1">${renderStatusBadge(task.status)}</div></div>
    <div><p class="text-xs text-slate-500">采购覆盖</p><p class="mt-1 text-sm font-medium text-slate-800">${gate.coveredMaterialSkuIds.length}/${gate.coveredMaterialSkuIds.length + gate.missingMaterialSkuIds.length}</p></div>
    <div><p class="text-xs text-slate-500">完成时间</p><p class="mt-1 text-sm font-medium text-slate-800">${escapeHtml(task.completedAt || '—')}</p></div>
  </div>`
}

function renderPurchaseSummaryRegion(linkage: AccessoryPurchaseTaskLinkage): string {
  return `<section class="rounded-lg border border-slate-200 bg-white" data-purchase-summary-region>${renderPurchaseSummaryContent(linkage)}</section>`
}

function renderPurchaseLinkageContent(masterOrderId: string, taskId: string, currentLinkage?: AccessoryPurchaseTaskLinkage): string {
  const { task, purchaseOrders, gate } = currentLinkage ?? computeAccessoryPurchaseTaskLinkage(masterOrderId, taskId)
  const required = [...new Set(task.materialLines.filter((line) => line.status === '正常' && line.requirementType === '辅料').map((line) => line.materialSkuId))]
  const totalPages = Math.max(1, Math.ceil(purchaseOrders.length / PURCHASE_DETAIL_PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, purchaseDetailPages.get(taskId) || 1), totalPages)
  purchaseDetailPages.set(taskId, currentPage)
  const pageRows = purchaseOrders.slice((currentPage - 1) * PURCHASE_DETAIL_PAGE_SIZE, currentPage * PURCHASE_DETAIL_PAGE_SIZE)
  return `<div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 class="font-semibold text-slate-900">绑定采购单</h2>
        <p class="mt-1 text-xs ${gate.complete ? 'text-emerald-600' : 'text-amber-700'}">已覆盖 ${gate.coveredMaterialSkuIds.length}/${required.length}${gate.missingMaterialSkuIds.length > 0 ? ` · 缺少 ${escapeHtml(gate.missingMaterialSkuIds.join('、'))}` : ''}</p>
      </div>
      <form class="flex gap-2" data-purchase-bind-form>
        <input name="purchaseOrderNo" data-purchase-order-input autocomplete="off" class="h-9 w-56 rounded-md border border-slate-300 px-3 text-sm" placeholder="输入采购单号" />
        <button type="submit" class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-purchase-action="bind-order" data-master-order-id="${escapeHtml(masterOrderId)}" data-task-id="${escapeHtml(taskId)}">绑定</button>
      </form>
    </div>
    <p class="min-h-6 px-5 pt-3 text-xs text-rose-600" data-purchase-feedback>${gate.blockReason ? escapeHtml(gate.blockReason) : ''}</p>
    <div class="overflow-x-auto px-5 pb-3">
      <table class="w-full min-w-[900px] text-left text-sm">
        <thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="px-3 py-2">采购单号</th><th class="px-3 py-2">供应商</th><th class="px-3 py-2">物料</th><th class="px-3 py-2">数量</th><th class="px-3 py-2">采购状态</th><th class="px-3 py-2">实际下单时间</th><th class="px-3 py-2 text-right">操作</th></tr></thead>
        <tbody>${pageRows.length > 0 ? pageRows.map((order) => renderPurchaseOrderRow(order, masterOrderId, taskId)).join('') : '<tr><td colspan="7" class="px-3 py-8 text-center text-slate-400">暂无已绑定采购单</td></tr>'}</tbody>
      </table>
    </div>
    <div class="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
      <span>共 ${purchaseOrders.length} 条 · 每页 ${PURCHASE_DETAIL_PAGE_SIZE} 条 · 第 ${currentPage} 页 / 共 ${totalPages} 页</span>
      <div class="flex gap-2"><button type="button" class="rounded border px-3 py-1 disabled:opacity-40" ${currentPage <= 1 ? 'disabled' : ''} data-purchase-action="purchase-prev-page" data-master-order-id="${escapeHtml(masterOrderId)}" data-task-id="${escapeHtml(taskId)}">上一页</button><button type="button" class="rounded border px-3 py-1 disabled:opacity-40" ${currentPage >= totalPages ? 'disabled' : ''} data-purchase-action="purchase-next-page" data-master-order-id="${escapeHtml(masterOrderId)}" data-task-id="${escapeHtml(taskId)}">下一页</button></div>
    </div>`
}

function renderPurchaseLinkageRegion(masterOrderId: string, taskId: string, linkage: AccessoryPurchaseTaskLinkage): string {
  return `<section class="rounded-lg border border-slate-200 bg-white" data-purchase-linkage-region>${renderPurchaseLinkageContent(masterOrderId, taskId, linkage)}</section>`
}

export function reconcileAndRefreshPurchaseTaskRegions(masterOrderId: string, taskId: string): AccessoryPurchaseTaskLinkage {
  const linkage = reconcileAccessoryPurchaseTaskLinkage(masterOrderId, taskId)
  const summaryHost = document.querySelector<HTMLElement>('[data-purchase-summary-region]')
  const linkageHost = document.querySelector<HTMLElement>('[data-purchase-linkage-region]')
  if (summaryHost) summaryHost.innerHTML = renderPurchaseSummaryContent(linkage)
  if (linkageHost) linkageHost.innerHTML = renderPurchaseLinkageContent(masterOrderId, taskId, linkage)
  return linkage
}

export function handlePurchaseTaskEvent(target: HTMLElement, event?: Event): boolean {
  const node = target.closest<HTMLElement>('[data-purchase-action]')
  if (!node) return false
  const action = node.dataset.purchaseAction || ''
  const masterOrderId = node.dataset.masterOrderId || ''
  const taskId = node.dataset.taskId || ''
  if (!masterOrderId || !taskId) return false
  event?.preventDefault()
  const feedback = () => document.querySelector<HTMLElement>('[data-purchase-feedback]')
  try {
    if (action === 'bind-order') {
      const input = document.querySelector<HTMLInputElement>('[data-purchase-order-input]')
      const orderNo = input?.value.trim() || ''
      bindAccessoryPurchaseOrder(masterOrderId, taskId, orderNo)
      reconcileAndRefreshPurchaseTaskRegions(masterOrderId, taskId)
      const currentFeedback = feedback()
      if (currentFeedback) currentFeedback.textContent = `已绑定采购单 ${orderNo}`
      return true
    }
    if (action === 'unbind-order') {
      const purchaseOrderNo = node.dataset.purchaseOrderNo || ''
      if (!window.confirm(`确认解除采购单 ${purchaseOrderNo} 的绑定？解除后将重新计算物料覆盖和任务状态。`)) return true
      const reason = window.prompt('请输入解除绑定原因')?.trim() || ''
      if (!reason) throw new Error('请填写解除绑定原因。')
      unbindAccessoryPurchaseOrder({
        masterOrderId,
        taskId,
        purchaseOrderNo,
        ...CURRENT_PURCHASE_OPERATOR,
        reason,
      })
      reconcileAndRefreshPurchaseTaskRegions(masterOrderId, taskId)
      return true
    }
    if (action === 'purchase-prev-page' || action === 'purchase-next-page') {
      const current = purchaseDetailPages.get(taskId) || 1
      purchaseDetailPages.set(taskId, action === 'purchase-prev-page' ? Math.max(1, current - 1) : current + 1)
      reconcileAndRefreshPurchaseTaskRegions(masterOrderId, taskId)
      return true
    }
  } catch (error) {
    const currentFeedback = feedback()
    if (currentFeedback) currentFeedback.textContent = error instanceof Error ? error.message : '采购单绑定失败。'
    return true
  }
  return false
}

function renderPurchaseDetailPage(taskId: string): string {
  const initialDetail = getEngineeringTaskDetail(taskId)
  if (!initialDetail) return renderEmptyDetail('辅料下单任务', PURCHASE_LIST_PATH)
  const linkage = reconcileAccessoryPurchaseTaskLinkage(initialDetail.master.masterOrderId, initialDetail.task.taskId)
  const detail = getEngineeringTaskDetail(taskId)
  if (!detail) return renderEmptyDetail('辅料下单任务', PURCHASE_LIST_PATH)
  const { task, master } = detail
  return `
    <div class="space-y-5 p-4" data-engineering-task-detail="purchase:${escapeHtml(task.taskId)}">
      ${renderTaskWorkbenchHeader(task, master, 'purchase', PURCHASE_LIST_PATH)}
      ${renderPurchaseSummaryRegion(linkage)}
      ${renderTaskMaterialLinesCard(task)}
      ${renderPurchaseLinkageRegion(master.masterOrderId, task.taskId, linkage)}
      ${renderTaskDependencyCard(task)}
      ${renderTaskLogsCard(task, master, 'purchase')}
    </div>
  `
}

export function renderPcsPurchaseTaskPage(): string { return renderProfessionalBusinessList('purchase') }

export function renderPcsPurchaseTaskDetailPage(taskId: string): string {
  return renderPurchaseDetailPage(taskId)
}
