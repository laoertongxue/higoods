import {
  buildPostFinishingWaitHandoverWarehouseLink,
  buildPostFinishingWorkOrderDetailLink,
} from '../../../data/fcs/fcs-route-links.ts'
import {
  listPostFinishingRecheckOrderEntities,
  type PostFinishingRecheckOrder,
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

function filterRows(records: PostFinishingRecheckOrder[], filters: ReturnType<typeof getPostListFilters>): PostFinishingRecheckOrder[] {
  return records.filter((record) => {
    if (filters.status !== '全部' && record.recheckStatus !== filters.status && record.wmsSyncStatus !== filters.status) return false
    if (filters.factory !== '全部' && record.managedPostFactoryName !== filters.factory) return false
    if (filters.source !== '全部' && record.sourceType !== filters.source) return false
    return postFilterTextMatches(filters.keyword, [
      record.recheckOrderNo,
      record.qcOrderNo,
      record.postOrderNo,
      record.productionOrderNo,
      record.sourceTaskNo,
      record.managedPostFactoryName,
      record.spuCode,
      record.spuName,
      record.skuSummary,
      record.recheckStatus,
      record.wmsSyncStatus,
    ])
  })
}

export function renderPostFinishingRecheckOrdersPage(): string {
  const allRecords = listPostFinishingRecheckOrderEntities()
  const filters = getPostListFilters()
  const filteredRecords = filterRows(allRecords, filters)
  const pagination = paginatePostRows(filteredRecords, filters)
  const rows = pagination.rows.map((record) => `
    <tr class="align-top">
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.recheckOrderNo)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.sourceType)}</td>
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.qcOrderNo)}</td>
      <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.postOrderNo || '—')}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.productionOrderNo)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.managedPostFactoryName)}</td>
      <td class="px-3 py-3 text-sm"><div class="font-semibold">${escapeHtml(record.spuCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(record.spuName)}</div></td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.skuSummary)}</td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(record.recheckedGarmentQty)}</td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(record.passedGarmentQty)}</td>
      <td class="px-3 py-3 text-sm">${formatGarmentQty(record.defectiveGarmentQty)}</td>
      <td class="px-3 py-3">${renderPostStatusBadge(record.recheckStatus)}</td>
      <td class="px-3 py-3">${renderPostStatusBadge(record.wmsSyncStatus)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.recheckedAt || '—')}</td>
      <td class="px-3 py-3"><div class="flex flex-wrap gap-2">${record.postOrderId ? renderPostAction('查看后道单', buildPostFinishingWorkOrderDetailLink(record.postOrderId, 'post')) : renderPostAction('查看质检单', '/fcs/craft/post-finishing/qc-orders')}${renderPostAction('查看待交出仓', buildPostFinishingWaitHandoverWarehouseLink(record.postOrderId || record.qcOrderId), record.recheckStatus !== '复检完成')}</div></td>
    </tr>
  `).join('')

  return `
    <div class="space-y-4 p-4">
      ${renderPostFinishingPageHeader('复检单')}
      ${renderPostFilterPanel({
        filters,
        statusOptions: allRecords.flatMap((record) => [record.recheckStatus, record.wmsSyncStatus]),
        sourceOptions: allRecords.map((record) => record.sourceType),
        factoryOptions: allRecords.map((record) => record.managedPostFactoryName),
        keywordPlaceholder: '复检单 / 质检单 / 后道单 / 生产单 / SKU',
      })}
      ${renderPostSection('复检单列表', `${renderPostTable(
        ['复检单号', '来源', '关联质检单', '关联后道单', '生产单', '后道工厂', '款式衣服', 'SKU 明细', '复检数量', '合格数量', '不合格数量', '复检状态', 'WMS同步', '复检时间', '操作'],
        rows || '<tr><td colspan="15" class="px-3 py-8 text-center text-sm text-muted-foreground">暂无复检单</td></tr>',
        'min-w-[1700px]',
      )}<div class="mt-4">${renderPostPagination(pagination)}</div>`)}
    </div>
  `
}
