import {
  buildPostFinishingWaitProcessWarehouseLink,
  buildPostFinishingWorkOrderDetailLink,
  buildUnifiedPrintPreviewRouteLink,
} from '../../../data/fcs/fcs-route-links.ts'
import {
  listPostFinishingWorkOrders,
  type PostFinishingWorkOrder,
} from '../../../data/fcs/post-finishing-domain.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatGarmentQty,
  getPostListFilters,
  paginatePostRows,
  postFilterTextMatches,
  renderPostAction,
  renderPostFilterPanel,
  renderPostFinishingPageHeader,
  renderPostPagination,
  renderPostSection,
  renderPostStatusBadge,
  renderPostTable,
} from './shared.ts'

function filterRows(records: PostFinishingWorkOrder[], filters: ReturnType<typeof getPostListFilters>): PostFinishingWorkOrder[] {
  return records.filter((order) => {
    if (filters.status !== '全部' && order.currentStatus !== filters.status && order.postStatus !== filters.status) return false
    if (filters.factory !== '全部' && order.managedPostFactoryName !== filters.factory) return false
    return postFilterTextMatches(filters.keyword, [
      order.postOrderNo,
      order.qcOrderNo,
      order.sourceProductionOrderNo,
      order.sourceTaskNo,
      order.sourceSewingFactoryName,
      order.managedPostFactoryName,
      order.spuCode,
      order.spuName,
      order.skuSummary,
      order.postProcessItems.join('、'),
      order.currentStatus,
      order.postStatus,
    ])
  })
}

function renderPostItems(order: PostFinishingWorkOrder): string {
  return order.postProcessItems.length
    ? order.postProcessItems.map((item) => `<span class="inline-flex rounded-full border bg-slate-50 px-2 py-0.5 text-xs">${escapeHtml(item)}</span>`).join('')
    : '<span class="text-muted-foreground">—</span>'
}

export function renderPostFinishingWorkOrdersPage(): string {
  const allRecords = listPostFinishingWorkOrders()
  const filters = getPostListFilters()
  const filteredRecords = filterRows(allRecords, filters)
  const pagination = paginatePostRows(filteredRecords, filters)
  const rows = pagination.rows.map((order) => `
    <tr class="align-top">
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(order.postOrderNo)}</td>
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(order.qcOrderNo)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(order.sourceProductionOrderNo)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(order.sourceSewingFactoryName)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(order.managedPostFactoryName)}</td>
      <td class="px-3 py-3 text-sm"><div class="font-semibold">${escapeHtml(order.spuCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(order.spuName)}</div></td>
      <td class="px-3 py-3 text-sm">${escapeHtml(order.skuSummary)}</td>
      <td class="px-3 py-3"><div class="flex flex-wrap gap-1">${renderPostItems(order)}</div></td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(order.plannedGarmentQty, order.plannedGarmentQtyUnit)}</td>
      <td class="px-3 py-3">${renderPostStatusBadge(order.postStatus)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(order.updatedAt)}</td>
      <td class="px-3 py-3">
        <div class="flex flex-wrap gap-2">
          ${renderPostAction('查看详情', buildPostFinishingWorkOrderDetailLink(order.postOrderId))}
          ${renderPostAction('查看待加工仓', buildPostFinishingWaitProcessWarehouseLink(order.postOrderId))}
          ${renderPostAction('打印任务流转卡', buildUnifiedPrintPreviewRouteLink({ documentType: 'TASK_ROUTE_CARD', sourceType: 'POST_FINISHING_WORK_ORDER', sourceId: order.postOrderId }))}
        </div>
      </td>
    </tr>
  `).join('')

  return `
    <div class="space-y-4 p-4">
      ${renderPostFinishingPageHeader('后道单')}
      ${renderPostFilterPanel({
        filters,
        statusOptions: allRecords.flatMap((order) => [order.currentStatus, order.postStatus]),
        sourceOptions: allRecords.map((order) => order.postProcessItems.join('、')),
        factoryOptions: allRecords.map((order) => order.managedPostFactoryName),
        keywordPlaceholder: '后道单 / 质检单 / 生产单 / 款式 / 后道项目',
      })}
      ${renderPostSection('后道单列表', `${renderPostTable(
        ['后道单号', '关联质检单', '生产单', '来源工厂', '后道工厂', '款式衣服', 'SKU 明细', '后道项目', '后道数量', '后道状态', '最近更新', '操作'],
        rows || '<tr><td colspan="12" class="px-3 py-8 text-center text-sm text-muted-foreground">暂无后道单</td></tr>',
        'min-w-[1500px]',
      )}<div class="mt-4">${renderPostPagination(pagination)}</div>`)}
    </div>
  `
}
