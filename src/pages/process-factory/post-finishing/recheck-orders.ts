// @page-pattern: list

import { renderStandardListPage } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import type { StandardListColumnPreferences } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { buildPostFinishingRecheckOrderDetailLink } from '../../../data/fcs/fcs-route-links.ts'
import {
  completePostFinishingRecheckOrder,
  getPostFinishingRecheckOrderById,
  listPostFinishingRecheckOrderEntities,
  type PostFinishingRecheckOrder,
  type PostFinishingRecheckSkuResult,
} from '../../../data/fcs/post-finishing-domain.ts'
import { appStore } from '../../../state/store.ts'
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
  renderPostFinishingPageHeader,
  renderPostSection,
  renderPostStatusBadge,
  renderPostTable,
} from './shared.ts'

function displayRecheckSource(sourceType: PostFinishingRecheckOrder['sourceType']): string {
  return sourceType === '后道单' ? '实际工序完成' : '质检完成'
}

const RECHECK_COLUMNS: StandardListColumn<PostFinishingRecheckOrder>[] = [
  { key: 'recheckOrderNo', title: '复检单号', width: 150, required: true, freezeable: true, render: (record) => `<span class="font-mono text-xs">${escapeHtml(record.recheckOrderNo)}</span>` },
  { key: 'source', title: '来源', width: 120, render: (record) => escapeHtml(displayRecheckSource(record.sourceType)) },
  { key: 'qcOrderNo', title: '关联质检单', width: 140, render: (record) => `<span class="font-mono text-xs">${escapeHtml(record.qcOrderNo)}</span>` },
  { key: 'postOrderNo', title: '关联实际工序单', width: 160, render: (record) => `<span class="font-mono text-xs">${escapeHtml(record.postOrderNo || '—')}</span>` },
  { key: 'productionOrder', title: PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE, width: 180, required: true, freezeable: true, render: (record) => renderProductionOrderIdentityCell(record.productionOrderNo) },
  { key: 'factory', title: '后道工厂', width: 150, render: (record) => escapeHtml(record.managedPostFactoryName) },
  { key: 'spu', title: '款式衣服', width: 180, render: (record) => `<div class="font-semibold">${escapeHtml(record.spuCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(record.spuName)}</div>` },
  { key: 'skuSummary', title: 'SKU 明细', width: 180, render: (record) => escapeHtml(record.skuSummary) },
  { key: 'recheckedQty', title: '复检数量', width: 110, align: 'right', render: (record) => formatGarmentQty(record.recheckedGarmentQty) },
  { key: 'passedQty', title: '合格数量', width: 110, align: 'right', render: (record) => formatGarmentQty(record.passedGarmentQty) },
  { key: 'defectiveQty', title: '不合格数量', width: 110, align: 'right', render: (record) => formatGarmentQty(record.defectiveGarmentQty) },
  { key: 'status', title: '复检状态', width: 120, render: (record) => renderPostStatusBadge(record.recheckStatus) },
  { key: 'recheckedAt', title: '复检时间', width: 150, render: (record) => escapeHtml(record.recheckedAt || '—') },
  { key: 'actions', title: '操作', width: 210, required: true, actionColumn: true, render: (record) => `<div class="flex flex-wrap gap-2">${renderPostAction('查看复检单详情', buildPostFinishingRecheckOrderDetailLink(record.recheckOrderId))}${record.recheckStatus !== '复检完成' ? `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" onclick="window.__postCompleteRecheck('${escapeHtml(record.recheckOrderId)}')">完成复检</button>` : ''}</div>` },
]

const RECHECK_PREFERENCES: StandardListColumnPreferences = {
  order: RECHECK_COLUMNS.filter((column) => !column.actionColumn).map((column) => column.key),
  visibleKeys: RECHECK_COLUMNS.map((column) => column.key),
  frozenKeys: ['recheckOrderNo', 'productionOrder'],
  pageSize: 20,
}

function renderRecheckPagination(pagination: ReturnType<typeof paginatePostRows<PostFinishingRecheckOrder>>): string {
  const toLink = (page: number): string => {
    const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
    params.set('page', String(page))
    params.set('pageSize', String(pagination.pageSize))
    return `/fcs/craft/post-finishing/recheck-orders?${params.toString()}`
  }
  return renderTablePagination({
    total: pagination.total,
    from: pagination.start,
    to: pagination.end,
    currentPage: pagination.page,
    totalPages: pagination.pageCount,
    pageSize: pagination.pageSize,
    actionPrefix: 'post-recheck-orders',
    fieldPrefix: 'post-recheck-orders',
    pageSizeOptions: [10, 20, 50],
  })
    .replace('data-post-recheck-orders-action="prev-page"', `data-nav="${escapeHtml(toLink(Math.max(1, pagination.page - 1)))}"`)
    .replace('data-post-recheck-orders-action="next-page"', `data-nav="${escapeHtml(toLink(Math.min(pagination.pageCount, pagination.page + 1)))}"`)
    .replace('data-post-recheck-orders-field="pageSize"', `onchange="var u=new URL(window.location.href);u.searchParams.set('page','1');u.searchParams.set('pageSize',this.value);window.location.href=u.pathname+'?'+u.searchParams.toString()"`)
}

function filterRows(records: PostFinishingRecheckOrder[], filters: ReturnType<typeof getPostListFilters>): PostFinishingRecheckOrder[] {
  return records.filter((record) => {
    if (filters.status !== '全部' && record.recheckStatus !== filters.status) return false
    if (filters.factory !== '全部' && record.managedPostFactoryName !== filters.factory) return false
    if (filters.source !== '全部' && displayRecheckSource(record.sourceType) !== filters.source) return false
    return postFilterTextMatches(filters.keyword, [
      record.recheckOrderId,
      record.recheckOrderNo,
      record.qcOrderId,
      record.qcOrderNo,
      record.postOrderId,
      record.postOrderNo,
      record.productionOrderNo,
      record.sourceTaskNo,
      record.managedPostFactoryName,
      record.spuCode,
      record.spuName,
      record.skuSummary,
      record.recheckStatus,
    ])
  })
}

function registerPostRecheckActions(): void {
  if (typeof window === 'undefined') return
  const win = window as Window & { __postCompleteRecheck?: (recheckOrderId: string) => void }
  win.__postCompleteRecheck = (recheckOrderId: string) => {
    const recheckSkuResults = Array.from(document.querySelectorAll<HTMLElement>('[data-recheck-sku-row]')).map((row): PostFinishingRecheckSkuResult => ({
      recheckSkuResultId: row.dataset.recheckSkuResultId || '',
      skuLineId: row.dataset.skuLineId || '',
      skuId: row.dataset.skuId || '',
      skuCode: row.dataset.skuCode || '',
      skuImageUrl: row.dataset.skuImageUrl || undefined,
      colorName: row.dataset.colorName || '',
      sizeName: row.dataset.sizeName || '',
      waitRecheckQty: Number(row.dataset.waitRecheckQty || 0),
      recheckQty: Number((row.querySelector('[data-recheck-qty]') as HTMLInputElement | null)?.value || 0),
      qualifiedQty: Number((row.querySelector('[data-recheck-qualified]') as HTMLInputElement | null)?.value || 0),
      unqualifiedQty: Number((row.querySelector('[data-recheck-unqualified]') as HTMLInputElement | null)?.value || 0),
      qtyUnit: row.dataset.qtyUnit || '件',
      remark: (row.querySelector('[data-recheck-remark]') as HTMLInputElement | null)?.value || undefined,
    }))
    const updated = completePostFinishingRecheckOrder({ recheckOrderId, operatorName: '复检员', recheckSkuResults })
    appStore.navigate(buildPostFinishingRecheckOrderDetailLink(updated.recheckOrderId))
  }
}

function renderSkuRows(record: PostFinishingRecheckOrder): string {
  return record.recheckSkuResults.map((result) => {
    const readonly = record.recheckStatus === '复检完成'
    const disabled = readonly ? 'disabled' : ''
    return `
    <tr
      data-recheck-sku-row
      data-recheck-sku-result-id="${escapeHtml(result.recheckSkuResultId)}"
      data-sku-line-id="${escapeHtml(result.skuLineId)}"
      data-sku-id="${escapeHtml(result.skuId)}"
      data-sku-code="${escapeHtml(result.skuCode)}"
      data-sku-image-url="${escapeHtml(result.skuImageUrl || '')}"
      data-color-name="${escapeHtml(result.colorName)}"
      data-size-name="${escapeHtml(result.sizeName)}"
      data-wait-recheck-qty="${result.waitRecheckQty}"
      data-qty-unit="${escapeHtml(result.qtyUnit)}"
      class="align-top"
    >
      <td class="px-3 py-3"><img class="h-12 w-12 rounded border object-cover" src="${escapeHtml(result.skuImageUrl || 'https://placehold.co/96x96?text=SKU')}" alt="${escapeHtml(result.skuCode)}" /></td>
      <td class="px-3 py-3 text-sm"><div class="font-semibold">${escapeHtml(result.skuCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(result.colorName)} / ${escapeHtml(result.sizeName)}</div></td>
      <td class="px-3 py-3 text-sm font-medium">${formatGarmentQty(result.waitRecheckQty, result.qtyUnit)}</td>
      <td class="px-3 py-3"><input class="h-9 w-24 rounded-md border px-2 text-sm disabled:bg-slate-100" type="number" min="0" data-recheck-qty value="${result.recheckQty || result.waitRecheckQty}" ${disabled} /></td>
      <td class="px-3 py-3"><input class="h-9 w-24 rounded-md border px-2 text-sm disabled:bg-slate-100" type="number" min="0" data-recheck-qualified value="${result.qualifiedQty || result.waitRecheckQty}" ${disabled} /></td>
      <td class="px-3 py-3"><input class="h-9 w-24 rounded-md border px-2 text-sm disabled:bg-slate-100" type="number" min="0" data-recheck-unqualified value="${result.unqualifiedQty}" ${disabled} /></td>
      <td class="px-3 py-3"><input class="h-9 w-44 rounded-md border px-2 text-sm disabled:bg-slate-100" data-recheck-remark value="${escapeHtml(result.remark || '')}" ${disabled} /></td>
    </tr>
  `
  }).join('')
}

function renderDetailField(label: string, value: string): string {
  return `<div class="rounded-lg border bg-slate-50 px-3 py-2"><div class="text-xs text-muted-foreground">${escapeHtml(label)}</div><div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(value || '—')}</div></div>`
}

export function renderPostFinishingRecheckOrderDetailPage(recheckOrderId: string): string {
  registerPostRecheckActions()
  const record = getPostFinishingRecheckOrderById(recheckOrderId)
  if (!record) {
    return `<div class="p-4">${renderPostFinishingPageHeader('复检单详情')} ${renderPostSection('未找到复检单', '<div class="text-sm text-muted-foreground">请返回复检单列表重新选择。</div>')}</div>`
  }
  const actionHtml = `
    <div class="flex flex-wrap gap-2">
      ${renderPostAction('返回复检单列表', '/fcs/craft/post-finishing/recheck-orders')}
      ${record.recheckStatus !== '复检完成' ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-slate-50" onclick="window.__postCompleteRecheck('${escapeHtml(record.recheckOrderId)}')">完成复检</button>` : ''}
    </div>
  `
  return `
    <div class="space-y-4 p-4">
      ${renderPostFinishingPageHeader('复检单详情', `${record.recheckOrderNo} / ${record.managedPostFactoryName}`, actionHtml)}
      ${renderPostSection('复检结果', `
        <div class="grid gap-3 md:grid-cols-4">
          ${renderDetailField('复检单号', record.recheckOrderNo)}
          ${renderDetailField('来源', displayRecheckSource(record.sourceType))}
          ${renderDetailField('关联质检单', record.qcOrderNo)}
          ${renderDetailField('关联实际工序单', record.postOrderNo || '无实际工序单')}
          ${renderDetailField('生产单', record.productionOrderNo)}
          ${renderDetailField('来源任务', record.sourceTaskNo)}
          ${renderDetailField('后道工厂', record.managedPostFactoryName)}
          ${renderDetailField('款式衣服', `${record.spuCode} / ${record.spuName}`)}
          ${renderDetailField('复检数量', formatGarmentQty(record.recheckedGarmentQty))}
          ${renderDetailField('合格数量', formatGarmentQty(record.passedGarmentQty))}
          ${renderDetailField('不合格数量', formatGarmentQty(record.defectiveGarmentQty))}
          ${renderDetailField('复检状态', record.recheckStatus)}
          ${renderDetailField('复检员', record.recheckerName)}
          ${renderDetailField('复检时间', record.recheckedAt || '未完成')}
        </div>
      `)}
      ${renderPostSection('SKU 明细', renderPostTable(
        ['图片', 'SKU', '待复检数量', '本次复检数量', '合格数量', '不合格数量', '备注'],
        renderSkuRows(record),
        'min-w-[1080px]',
      ))}
    </div>
  `
}

export function renderPostFinishingRecheckOrdersPage(): string {
  registerPostRecheckActions()
  const allRecords = listPostFinishingRecheckOrderEntities()
  const filters = getPostListFilters()
  const filteredRecords = filterRows(allRecords, filters)
  const pagination = paginatePostRows(filteredRecords, filters)
  return renderStandardListPage({
    title: '复检单',
    filtersHtml: renderPostFilterPanel({
        filters,
        statusOptions: allRecords.map((record) => record.recheckStatus),
        sourceOptions: allRecords.map((record) => displayRecheckSource(record.sourceType)),
        factoryOptions: allRecords.map((record) => record.managedPostFactoryName),
        keywordPlaceholder: '复检单 / 质检单 / 实际工序单 / 生产单 / SKU',
    }),
    listTitle: '复检单列表',
    tableHtml: renderStandardListTable({ columns: RECHECK_COLUMNS, rows: pagination.rows, preferences: { ...RECHECK_PREFERENCES, pageSize: pagination.pageSize }, sort: null, eventPrefix: 'post-recheck-orders', emptyText: '暂无复检单' }),
    paginationHtml: renderRecheckPagination(pagination),
  })
}
