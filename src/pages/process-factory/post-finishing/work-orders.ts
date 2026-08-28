// @page-pattern: list

import { renderStandardListPage } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import type { StandardListColumnPreferences } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import {
  buildPostFinishingWaitProcessWarehouseLink,
  buildPostFinishingWorkOrderDetailLink,
  buildUnifiedPrintPreviewRouteLink,
} from '../../../data/fcs/fcs-route-links.ts'
import {
  listPostFinishingWorkOrders,
  type PostFinishingWorkOrder,
} from '../../../data/fcs/post-finishing-domain.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionOrderIdentityCell,
} from '../../../data/fcs/production-order-identity.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  formatGarmentQty,
  getPostListFilters,
  paginatePostRows,
  postFilterTextMatches,
  renderPostAction,
  renderPostFilterPanel,
  renderPostStatusBadge,
} from './shared.ts'

function filterRows(records: PostFinishingWorkOrder[], filters: ReturnType<typeof getPostListFilters>): PostFinishingWorkOrder[] {
  return records.filter((order) => {
    if (filters.status !== '全部' && order.currentStatus !== filters.status && order.postStatus !== filters.status) return false
    if (filters.factory !== '全部' && order.managedPostFactoryName !== filters.factory) return false
    return postFilterTextMatches(filters.keyword, [
      order.postOrderId,
      order.postOrderNo,
      order.qcOrderId,
      order.qcOrderNo,
      order.recheckOrderId,
      order.recheckOrderNo,
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

const WORK_ORDER_COLUMNS: StandardListColumn<PostFinishingWorkOrder>[] = [
  { key: 'postOrderNo', title: '加工单号', width: 150, required: true, freezeable: true, render: (order) => `<span class="font-mono text-xs">${escapeHtml(order.postOrderNo)}</span>` },
  { key: 'qcOrderNo', title: '关联质检单', width: 140, render: (order) => `<span class="font-mono text-xs">${escapeHtml(order.qcOrderNo)}</span>` },
  { key: 'productionOrder', title: PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE, width: 180, required: true, freezeable: true, render: (order) => renderProductionOrderIdentityCell(order.sourceProductionOrderNo) },
  { key: 'sourceFactory', title: '来源工厂', width: 150, render: (order) => escapeHtml(order.sourceSewingFactoryName) },
  { key: 'managedFactory', title: '后道工厂', width: 150, render: (order) => escapeHtml(order.managedPostFactoryName) },
  { key: 'spu', title: '款式衣服', width: 180, render: (order) => `<div class="font-semibold">${escapeHtml(order.spuCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(order.spuName)}</div>` },
  { key: 'skuSummary', title: 'SKU 明细', width: 180, render: (order) => escapeHtml(order.skuSummary) },
  { key: 'processItems', title: '实际工序', width: 200, render: (order) => `<div class="flex flex-wrap gap-1">${renderPostItems(order)}</div>` },
  { key: 'plannedQty', title: '待处理数量', width: 120, align: 'right', render: (order) => formatGarmentQty(order.plannedGarmentQty, order.plannedGarmentQtyUnit) },
  { key: 'postStatus', title: '阶段状态', width: 120, render: (order) => renderPostStatusBadge(order.postStatus) },
  { key: 'updatedAt', title: '最近更新', width: 150, render: (order) => escapeHtml(order.updatedAt) },
  { key: 'actions', title: '操作', width: 260, required: true, actionColumn: true, render: (order) => `<div class="flex flex-wrap gap-2">${renderPostAction('查看详情', buildPostFinishingWorkOrderDetailLink(order.postOrderId))}${renderPostAction('查看待加工仓', buildPostFinishingWaitProcessWarehouseLink(order.postOrderId))}${renderPostAction('打印任务流转卡', buildUnifiedPrintPreviewRouteLink({ documentType: 'TASK_ROUTE_CARD', sourceType: 'POST_FINISHING_WORK_ORDER', sourceId: order.postOrderId }))}</div>` },
]

const WORK_ORDER_PREFERENCES: StandardListColumnPreferences = {
  order: WORK_ORDER_COLUMNS.filter((column) => !column.actionColumn).map((column) => column.key),
  visibleKeys: WORK_ORDER_COLUMNS.map((column) => column.key),
  frozenKeys: ['postOrderNo', 'productionOrder'],
  pageSize: 20,
}

function renderWorkOrderPagination(pagination: ReturnType<typeof paginatePostRows<PostFinishingWorkOrder>>): string {
  const toLink = (page: number): string => {
    const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
    params.set('page', String(page))
    params.set('pageSize', String(pagination.pageSize))
    return `/fcs/craft/post-finishing/work-orders?${params.toString()}`
  }
  return renderTablePagination({
    total: pagination.total,
    from: pagination.start,
    to: pagination.end,
    currentPage: pagination.page,
    totalPages: pagination.pageCount,
    pageSize: pagination.pageSize,
    actionPrefix: 'post-work-orders',
    fieldPrefix: 'post-work-orders',
    pageSizeOptions: [10, 20, 50],
  })
    .replace('data-post-work-orders-action="prev-page"', `data-nav="${escapeHtml(toLink(Math.max(1, pagination.page - 1)))}"`)
    .replace('data-post-work-orders-action="next-page"', `data-nav="${escapeHtml(toLink(Math.min(pagination.pageCount, pagination.page + 1)))}"`)
    .replace('data-post-work-orders-field="pageSize"', `onchange="var u=new URL(window.location.href);u.searchParams.set('page','1');u.searchParams.set('pageSize',this.value);window.location.href=u.pathname+'?'+u.searchParams.toString()"`)
}

export function renderPostFinishingWorkOrdersPage(): string {
  const allRecords = listPostFinishingWorkOrders()
  const filters = getPostListFilters()
  const filteredRecords = filterRows(allRecords, filters)
  const pagination = paginatePostRows(filteredRecords, filters)
  return renderStandardListPage({
    title: '后道单',
    filtersHtml: renderPostFilterPanel({
        filters,
        statusOptions: allRecords.flatMap((order) => [order.currentStatus, order.postStatus]),
        sourceOptions: allRecords.map((order) => order.postProcessItems.join('、')),
        factoryOptions: allRecords.map((order) => order.managedPostFactoryName),
        keywordPlaceholder: '后道单 / 质检单 / 生产单 / 款式 / 实际工序',
    }),
    listTitle: '后道单列表',
    tableHtml: renderStandardListTable({ columns: WORK_ORDER_COLUMNS, rows: pagination.rows, preferences: { ...WORK_ORDER_PREFERENCES, pageSize: pagination.pageSize }, sort: null, eventPrefix: 'post-work-orders', emptyText: '暂无后道单' }),
    paginationHtml: renderWorkOrderPagination(pagination),
  })
}
