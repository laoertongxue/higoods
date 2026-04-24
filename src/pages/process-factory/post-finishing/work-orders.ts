import {
  buildPostFinishingWaitHandoverWarehouseLink,
  buildPostFinishingWaitProcessWarehouseLink,
  buildPostFinishingWorkOrderDetailLink,
  buildTaskRouteCardPrintLink,
} from '../../../data/fcs/fcs-route-links.ts'
import { listPostFinishingWorkOrders } from '../../../data/fcs/post-finishing-domain.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatGarmentQty,
  renderPostAction,
  renderPostFinishingPageHeader,
  renderPostSection,
  renderPostStatusBadge,
  renderPostTable,
} from './shared.ts'

export function renderPostFinishingWorkOrdersPage(): string {
  const rows = listPostFinishingWorkOrders()
    .map((order) => `
      <tr class="align-top">
        <td class="px-3 py-3 font-mono text-xs">${escapeHtml(order.postOrderNo)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(order.sourceProductionOrderNo)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(order.sourceTaskNo)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(order.currentFactoryName)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(order.routeMode)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(order.plannedGarmentQty, order.plannedGarmentQtyUnit)}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(order.postAction.acceptedGarmentQty, order.postAction.qtyUnit)}</td>
        <td class="px-3 py-3">${renderPostStatusBadge(order.currentStatus)}</td>
        <td class="px-3 py-3 text-sm">${order.qcAction ? '需要' : '待后道完成后进入后道工厂'}</td>
        <td class="px-3 py-3 text-sm">${order.recheckAction ? '需要' : '待质检完成后进入复检'}</td>
        <td class="px-3 py-3">
          <div class="flex flex-wrap gap-2">
            ${renderPostAction('查看详情', buildPostFinishingWorkOrderDetailLink(order.postOrderId))}
            ${renderPostAction('打印任务流转卡', buildTaskRouteCardPrintLink('POST_FINISHING_WORK_ORDER', order.postOrderId))}
            ${renderPostAction('查看待加工仓', buildPostFinishingWaitProcessWarehouseLink(order.postOrderId))}
            ${renderPostAction(
              order.waitHandoverWarehouseRecordId ? '查看交出记录' : '暂无交出记录',
              buildPostFinishingWaitHandoverWarehouseLink(order.postOrderId),
              !order.waitHandoverWarehouseRecordId,
            )}
          </div>
        </td>
      </tr>
    `)
    .join('')

  return `
    <div class="space-y-4 p-4">
      ${renderPostFinishingPageHeader('后道单')}
      ${renderPostSection(
        '后道单列表',
        renderPostTable(
          ['后道单号', '生产单', '来源任务', '当前工厂', '是否专门后道工厂', '计划成衣件数', '已完成后道成衣件数', '当前状态', '是否需要质检', '是否需要复检', '操作'],
          rows,
          'min-w-[1480px]',
        ),
      )}
    </div>
  `
}
