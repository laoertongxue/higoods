import {
  buildPostFinishingWaitHandoverWarehouseLink,
  buildPostFinishingWaitProcessWarehouseLink,
  buildPostFinishingWorkOrderDetailLink,
  buildUnifiedPrintPreviewRouteLink,
} from '../../../data/fcs/fcs-route-links.ts'
import {
  getPostFinishingFlowText,
  getPostFinishingSourceLabel,
  listPostFinishingWorkOrders,
} from '../../../data/fcs/post-finishing-domain.ts'
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
        <td class="px-3 py-3 text-sm">${escapeHtml(getPostFinishingSourceLabel(order))}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(getPostFinishingFlowText(order))}</td>
        <td class="px-3 py-3">${renderPostStatusBadge(order.receiveAction.status)}</td>
        <td class="px-3 py-3">${renderPostStatusBadge(order.qcAction.status)}</td>
        <td class="px-3 py-3 text-sm">${order.isPostDoneBySewingFactory ? '车缝厂已完成后道' : renderPostStatusBadge(order.postAction.status)}</td>
        <td class="px-3 py-3">${renderPostStatusBadge(order.recheckAction.status)}</td>
        <td class="px-3 py-3">${renderPostStatusBadge(order.handoverAction?.status || (order.waitHandoverWarehouseRecordId ? '待交出' : '未生成'))}</td>
        <td class="px-3 py-3 text-sm">${formatGarmentQty(order.plannedGarmentQty, order.plannedGarmentQtyUnit)}</td>
        <td class="px-3 py-3">${renderPostStatusBadge(order.currentStatus)}</td>
        <td class="px-3 py-3">
          <div class="flex flex-wrap gap-2">
            ${renderPostAction('查看详情', buildPostFinishingWorkOrderDetailLink(order.postOrderId))}
            ${renderPostAction('打印任务流转卡', buildUnifiedPrintPreviewRouteLink({
              documentType: 'TASK_ROUTE_CARD',
              sourceType: 'POST_FINISHING_WORK_ORDER',
              sourceId: order.postOrderId,
            }))}
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
          ['后道单号', '生产单', '来源任务', '当前工厂', '后道来源', '当前流程', '接收领料状态', '质检状态', '后道状态', '复检状态', '交出状态', '计划成衣件数', '当前状态', '操作'],
          rows,
          'min-w-[1760px]',
        ),
      )}
    </div>
  `
}
