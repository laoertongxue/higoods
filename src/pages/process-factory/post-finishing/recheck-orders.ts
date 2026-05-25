import { buildPostFinishingRecheckOrderDetailLink } from '../../../data/fcs/fcs-route-links.ts'
import {
  completePostFinishingRecheckOrder,
  getPostFinishingRecheckOrderById,
  listPostFinishingRecheckOrderEntities,
  type PostFinishingRecheckOrder,
  type PostFinishingRecheckSkuResult,
} from '../../../data/fcs/post-finishing-domain.ts'
import { appStore } from '../../../state/store.ts'
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
    if (filters.status !== '全部' && record.recheckStatus !== filters.status) return false
    if (filters.factory !== '全部' && record.managedPostFactoryName !== filters.factory) return false
    if (filters.source !== '全部' && record.sourceType !== filters.source) return false
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
          ${renderDetailField('来源', record.sourceType)}
          ${renderDetailField('关联质检单', record.qcOrderNo)}
          ${renderDetailField('关联后道单', record.postOrderNo || '无后道单')}
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
      <td class="px-3 py-3 text-sm">${escapeHtml(record.recheckedAt || '—')}</td>
      <td class="px-3 py-3"><div class="flex flex-wrap gap-2">${renderPostAction('查看复检单详情', buildPostFinishingRecheckOrderDetailLink(record.recheckOrderId))}${record.recheckStatus !== '复检完成' ? `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" onclick="window.__postCompleteRecheck('${escapeHtml(record.recheckOrderId)}')">完成复检</button>` : ''}</div></td>
    </tr>
  `).join('')

  return `
    <div class="space-y-4 p-4">
      ${renderPostFinishingPageHeader('复检单')}
      ${renderPostFilterPanel({
        filters,
        statusOptions: allRecords.map((record) => record.recheckStatus),
        sourceOptions: allRecords.map((record) => record.sourceType),
        factoryOptions: allRecords.map((record) => record.managedPostFactoryName),
        keywordPlaceholder: '复检单 / 质检单 / 后道单 / 生产单 / SKU',
      })}
      ${renderPostSection('复检单列表', `${renderPostTable(
        ['复检单号', '来源', '关联质检单', '关联后道单', '生产单', '后道工厂', '款式衣服', 'SKU 明细', '复检数量', '合格数量', '不合格数量', '复检状态', '复检时间', '操作'],
        rows || '<tr><td colspan="14" class="px-3 py-8 text-center text-sm text-muted-foreground">暂无复检单</td></tr>',
        'min-w-[1500px]',
      )}<div class="mt-4">${renderPostPagination(pagination)}</div>`)}
    </div>
  `
}
