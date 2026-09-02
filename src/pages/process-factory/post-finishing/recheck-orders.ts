// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { paginateStandardListRows, type StandardListColumnPreferences } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import {
  POST_FINISHING_ACCEPTANCE_ACTORS,
  getPostFinishingFactoryReturn,
  getPostFinishingFullFlowRecheckOrder,
  getPostFinishingWaitHandoverWarehouseRecord,
  listPostFinishingFullFlowRecheckOrders,
  releasePostFinishingRecheckOrder,
  type PostFinishingFactoryReturnDelivery,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderPostFinishingPageHeader, renderPostStatusBadge } from './shared.ts'

type RecheckRecord = NonNullable<ReturnType<typeof getPostFinishingFullFlowRecheckOrder>>

interface RecheckOrderRow {
  record: RecheckRecord
  delivery?: PostFinishingFactoryReturnDelivery
}

let message = ''

function refresh(): void {
  const current = query()
  current.set('refresh', String(Date.now()))
  appStore.navigate(`/fcs/craft/post-finishing/recheck-orders?${current.toString()}`)
}

function query(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function navigate(overrides: Record<string, string>): void {
  const current = query()
  Object.entries(overrides).forEach(([key, value]) => current.set(key, value))
  appStore.navigate(`/fcs/craft/post-finishing/recheck-orders?${current.toString()}`)
}

function selectOptions(values: string[], selected: string): string {
  return ['<option value="">全部</option>', ...values.map((value) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>`)].join('')
}

function image(line: RecheckRecord['lines'][number]): string {
  const label = `${line.sku.skuCode} ${line.sku.colorName} ${line.sku.sizeName}`
  return `<button type="button" class="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-slate-50" data-post-finishing-action="full-flow-zoom-image" data-image-url="${escapeHtml(line.sku.imageUrl)}" data-image-label="${escapeHtml(label)}"><img src="${escapeHtml(line.sku.imageUrl)}" alt="${escapeHtml(`${line.sku.spuName} ${line.sku.colorName} ${line.sku.sizeName}`)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"/><span class="px-1 text-center text-[9px] text-slate-500">图片加载中…</span></button>`
}

function renderSkuSummary(row: RecheckOrderRow): string {
  return `<div class="space-y-2">${row.record.lines.map((line) => `<div class="flex items-center gap-2">${image(line)}<span class="min-w-0"><span class="block font-mono text-xs">${escapeHtml(line.sku.skuCode)}</span><span class="text-[11px] text-muted-foreground">${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)} · ${line.expectedQty} 件</span></span></div>`).join('')}</div>`
}

function totalExpected(record: RecheckRecord): number {
  return record.lines.reduce((sum, line) => sum + line.expectedQty, 0)
}

function totalPassed(record: RecheckRecord): number {
  return record.lines.reduce((sum, line) => sum + (line.passedQty || 0), 0)
}

function totalDefect(record: RecheckRecord): number {
  return record.lines.reduce((sum, line) => sum + (line.defectQty || 0), 0)
}

const columns: StandardListColumn<RecheckOrderRow>[] = [
  { key: 'recheck', title: '复检单号', width: 220, required: true, freezeable: true, render: (row) => `<div class="font-mono font-semibold">${escapeHtml(row.record.recheckOrderNo)}</div><div class="mt-1 text-xs text-muted-foreground">第 ${row.record.returnIndex} 次回货</div>` },
  { key: 'source', title: '来源', width: 110, required: true, render: (row) => row.record.postTaskNo ? '后道单' : '质检单' },
  { key: 'qc', title: '关联质检单', width: 220, required: true, render: (row) => `<span class="font-mono text-blue-700">${escapeHtml(row.record.qcTaskNo)}</span>` },
  { key: 'post', title: '关联后道单', width: 220, required: true, render: (row) => `<span class="font-mono ${row.record.postTaskNo ? 'text-blue-700' : 'text-muted-foreground'}">${escapeHtml(row.record.postTaskNo || '—')}</span>` },
  { key: 'production', title: '生产单号', width: 180, required: true, render: (row) => `<span class="font-mono text-blue-700">${escapeHtml(row.record.productionOrderNo)}</span>` },
  { key: 'factory', title: '加工工厂', width: 190, required: true, render: (row) => escapeHtml(row.delivery?.managedPostFactoryName || '—') },
  { key: 'style', title: '款式名称', width: 280, required: true, render: (row) => `<div class="font-mono text-xs">${escapeHtml(row.record.lines[0]?.sku.spuCode || '—')}</div><div class="mt-1 text-xs">${escapeHtml(row.record.lines[0]?.sku.spuName || '—')}</div>` },
  { key: 'sku', title: 'SKU 明细', width: 330, required: true, render: renderSkuSummary },
  { key: 'expected', title: '复检数量', width: 120, required: true, align: 'center', render: (row) => `${totalExpected(row.record)} 件` },
  { key: 'passed', title: '合格数量', width: 120, required: true, align: 'center', render: (row) => `${totalPassed(row.record)} 件` },
  { key: 'defect', title: '不合格数量', width: 130, required: true, align: 'center', render: (row) => `${totalDefect(row.record)} 件` },
  { key: 'status', title: '复检状态', width: 140, required: true, render: (row) => renderPostStatusBadge(row.record.status) },
  { key: 'time', title: '复检时间', width: 190, required: true, render: (row) => escapeHtml(row.record.completedAt ? new Date(row.record.completedAt).toLocaleString('zh-CN') : row.record.claimedAt ? new Date(row.record.claimedAt).toLocaleString('zh-CN') : '—') },
  { key: 'actions', title: '操作', width: 230, required: true, actionColumn: true, render: (row) => `<div class="flex flex-wrap justify-end gap-x-3 gap-y-2"><a data-nav="/fcs/craft/post-finishing/recheck-orders?id=${encodeURIComponent(row.record.recheckOrderId)}" class="text-xs font-medium text-blue-700 hover:underline">查看复检详情</a>${row.record.claimedBy && row.record.status !== '复检完成' ? `<button type="button" class="text-xs text-amber-700 hover:underline" data-post-finishing-action="full-flow-supervisor-release-recheck" data-recheck-id="${escapeHtml(row.record.recheckOrderId)}">主管释放</button>` : ''}</div>` },
]

function renderDetail(record: RecheckRecord): string {
  const waitHandover = record.outboundOrderNo ? getPostFinishingWaitHandoverWarehouseRecord(record.outboundOrderNo) : undefined
  const rows = record.lines.map((line) => `<tr>
    <td class="px-3 py-3"><div class="flex items-center gap-3">${image(line)}<div><div class="font-semibold">${escapeHtml(line.sku.skuCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(line.sku.spuCode)} · ${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</div></div></div></td>
    <td class="px-3 py-3">${line.expectedQty} 件</td>
    <td class="px-3 py-3">${line.passedQty ?? '—'}</td>
    <td class="px-3 py-3">${line.defectQty ?? '—'}</td>
    <td class="px-3 py-3">${renderPostStatusBadge(line.barcodeStatus)}</td>
    <td class="px-3 py-3 text-xs">${line.barcodeEvents.map((event) => `${escapeHtml(event.action)} · ${escapeHtml(event.operator.actorName)} · ${escapeHtml(new Date(event.operatedAt).toLocaleString('zh-CN'))}${event.scannedBarcode ? ` · 实扫 ${escapeHtml(event.scannedBarcode)}` : ''}`).join('<br/>') || '尚未扫描'}</td>
  </tr>`).join('')
  const authorizationText = record.recheckAuthorizedBy
    ? `${record.recheckAuthorizedBy.authorizerName} / ${record.recheckAuthorizationId}`
    : '无差异'
  return `<div class="space-y-4">
    <button type="button" data-nav="/fcs/craft/post-finishing/recheck-orders" class="text-sm text-blue-700 underline">← 返回复检单列表</button>
    <section class="rounded-xl border bg-card p-4"><div class="flex items-start justify-between gap-4"><div><h2 class="font-mono text-lg font-semibold">${escapeHtml(record.recheckOrderNo)}</h2><p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.productionOrderNo)} · 根送货单 ${escapeHtml(record.deliveryOrderNo)} · ${escapeHtml(record.postTaskNo || '质检后直接复检')}</p></div>${renderPostStatusBadge(record.status)}</div><div class="mt-3 grid gap-3 text-sm md:grid-cols-5"><div><span class="text-xs text-muted-foreground">复检员</span><div>${escapeHtml(record.claimedBy?.actorName || '未领取')}</div></div><div><span class="text-xs text-muted-foreground">领取时间</span><div>${escapeHtml(record.claimedAt ? new Date(record.claimedAt).toLocaleString('zh-CN') : '—')}</div></div><div><span class="text-xs text-muted-foreground">数量授权人</span><div>${escapeHtml(authorizationText)}</div></div><div><span class="text-xs text-muted-foreground">后道出货单</span><div>${escapeHtml(record.outboundOrderNo || '待生成')}</div></div><div><span class="text-xs text-muted-foreground">待交出仓</span><div>${escapeHtml(waitHandover ? `${waitHandover.status} / ${waitHandover.lines.reduce((sum, line) => sum + line.availableQty, 0)} 件` : '复检完成后入仓')}</div></div></div></section>
    <section class="rounded-xl border bg-card p-4"><h3 class="font-semibold">SKU 数量与条码核对</h3><div class="mt-3 overflow-x-auto"><table class="min-w-[980px] w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">SKU / 产品</th><th class="px-3 py-2">交接数量</th><th class="px-3 py-2">复检合格</th><th class="px-3 py-2">复检瑕疵</th><th class="px-3 py-2">条码状态</th><th class="px-3 py-2">条码过程 / 操作人 / 时间</th></tr></thead><tbody class="divide-y">${rows}</tbody></table></div></section>
    <div class="flex flex-wrap gap-2"><a data-nav="/fcs/pda/post-finishing/recheck?id=${encodeURIComponent(record.recheckOrderNo)}" class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">打开 PDA 复检</a>${record.claimedBy && record.status !== '复检完成' ? `<button type="button" class="rounded-md border border-amber-300 px-4 py-2 text-sm text-amber-800" data-post-finishing-action="full-flow-supervisor-release-recheck" data-recheck-id="${escapeHtml(record.recheckOrderId)}">主管释放错误领取</button>` : ''}${record.outboundOrderNo ? `<a data-nav="/fcs/craft/post-finishing/wait-handover-warehouse?tab=inventory" class="rounded-md border px-4 py-2 text-sm">查看待交出仓</a><a data-nav="/fcs/craft/post-finishing/outbound-orders/${encodeURIComponent(record.outboundOrderId || '')}" class="rounded-md border px-4 py-2 text-sm">查看唯一出货单</a>` : ''}<a data-nav="/fcs/craft/post-finishing/audit-records?deliveryId=${encodeURIComponent(record.deliveryId)}" class="rounded-md border px-4 py-2 text-sm">查看全流程</a></div>
  </div>`
}

export function renderPostFinishingRecheckOrderDetailPage(recheckOrderId: string): string {
  const record = getPostFinishingFullFlowRecheckOrder(recheckOrderId)
  return `<div class="space-y-4 p-4">${renderPostFinishingPageHeader('复检单详情', 'Web 只读追溯；数量与 SKU 条码在 PDA 完成')}${message ? `<div role="status" class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">${escapeHtml(message)}</div>` : ''}${record ? renderDetail(record) : '<div class="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">未找到复检单。</div>'}</div>`
}

export function renderPostFinishingRecheckOrdersPage(): string {
  const selected = query().get('id')
  if (selected) return renderPostFinishingRecheckOrderDetailPage(selected)
  const current = query()
  const keyword = current.get('keyword')?.trim().toLowerCase() || ''
  const status = current.get('status') || ''
  const source = current.get('source') || ''
  const factory = current.get('factory') || ''
  const allRecords = listPostFinishingFullFlowRecheckOrders()
  const rows = allRecords.map((record): RecheckOrderRow => ({ record, delivery: getPostFinishingFactoryReturn(record.deliveryId) })).filter((row) => {
    const sourceLabel = row.record.postTaskNo ? '后道单' : '质检单'
    const searchable = [row.record.recheckOrderNo, row.record.productionOrderNo, row.record.postTaskNo, row.record.qcTaskNo, row.record.outboundOrderNo, row.delivery?.managedPostFactoryName, ...row.record.lines.map((line) => line.sku.skuCode)].filter(Boolean).join(' ').toLowerCase()
    return (!keyword || searchable.includes(keyword))
      && (!status || row.record.status === status)
      && (!source || sourceLabel === source)
      && (!factory || row.delivery?.managedPostFactoryName === factory)
  })
  const pageSize = Math.max(10, Math.min(50, Number(current.get('pageSize') || 20)))
  const slice = paginateStandardListRows(rows, Number(current.get('page') || 1), pageSize)
  const preferences: StandardListColumnPreferences = { order: columns.map((column) => column.key), visibleKeys: columns.map((column) => column.key), frozenKeys: ['recheck'], pageSize }
  const factories = [...new Set(allRecords.map((record) => getPostFinishingFactoryReturn(record.deliveryId)?.managedPostFactoryName).filter((value): value is string => Boolean(value)))]
  const statusCounts = allRecords.reduce<Record<string, number>>((result, record) => {
    result[record.status] = (result[record.status] || 0) + 1
    return result
  }, {})
  return renderStandardListPage({
    title: '复检单',
    primaryActionsHtml: '<div class="flex items-center gap-3"><span class="text-xs text-muted-foreground">质检直达或后道完成后自动生成；现场优先使用 PDA</span><a data-nav="/fcs/pda/post-finishing/recheck" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white">打开 PDA 复检</a></div>',
    feedbackHtml: message ? `<div role="status" class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">${escapeHtml(message)}</div>` : '',
    filtersHtml: `<form action="/fcs/craft/post-finishing/recheck-orders" class="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-3 xl:grid-cols-5"><label class="text-xs text-muted-foreground md:col-span-2">关键词<input name="keyword" value="${escapeHtml(current.get('keyword') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" placeholder="复检单/质检单/后道单/生产单/SKU"/></label><label class="text-xs text-muted-foreground">当前状态<select name="status" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(['待复检','复检中','条码异常待重贴','复检完成'], status)}</select></label><label class="text-xs text-muted-foreground">后道单来源<select name="source" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(['质检单','后道单'], source)}</select></label><label class="text-xs text-muted-foreground">工厂<select name="factory" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(factories, factory)}</select></label><div class="flex items-end justify-end gap-2 md:col-span-3 xl:col-span-5"><a data-nav="/fcs/craft/post-finishing/recheck-orders" class="inline-flex h-9 items-center rounded-md border px-4 text-sm">重置</a><button class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white">查询</button></div></form>`,
    statsHtml: renderStandardListStats([
      { label: '复检单', value: `${allRecords.length} 张` },
      { label: '待复检', value: `${statusCounts['待复检'] || 0} 张` },
      { label: '复检中', value: `${(statusCounts['复检中'] || 0) + (statusCounts['条码异常待重贴'] || 0)} 张` },
      { label: '复检完成', value: `${statusCounts['复检完成'] || 0} 张` },
    ]),
    listTitle: '复检单列表',
    tableHtml: renderStandardListTable({ columns, rows: slice.rows, preferences, sort: null, eventPrefix: 'post-finishing-recheck-orders', emptyText: '暂无符合条件的复检单。' }),
    paginationHtml: renderTablePagination({ total: slice.total, from: slice.from, to: slice.to, currentPage: slice.currentPage, totalPages: slice.totalPages, pageSize: slice.pageSize, actionPrefix: 'post-finishing-recheck-orders', fieldPrefix: 'post-finishing-recheck-orders' }),
  })
}

export function handlePostFinishingRecheckOrdersEvent(target: HTMLElement, event?: Event): boolean {
  const pageAction = target.closest<HTMLElement>('[data-post-finishing-recheck-orders-action]')?.dataset.postFinishingRecheckOrdersAction
  if (pageAction === 'prev-page' || pageAction === 'next-page') {
    navigate({ page: String(Math.max(1, Number(query().get('page') || 1) + (pageAction === 'prev-page' ? -1 : 1))) })
    return true
  }
  const pageSize = target.closest<HTMLSelectElement>('[data-post-finishing-recheck-orders-field="pageSize"]')
  if (pageSize && event?.type === 'change') {
    navigate({ page: '1', pageSize: pageSize.value })
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-post-finishing-action="full-flow-supervisor-release-recheck"]')
  if (!actionNode) return false
  if (!window.confirm('确认由主管释放该复检单？释放后将回到待复检，其他复检员可重新领取。')) return true
  try {
    const record = releasePostFinishingRecheckOrder({
      recheckOrderId: actionNode.dataset.recheckId || '',
      actor: POST_FINISHING_ACCEPTANCE_ACTORS.postSupervisor,
      reason: '主管释放错误领取',
      supervisor: true,
    })
    message = `${record.recheckOrderNo} 已由主管释放并回到待复检。`
  } catch (error) {
    message = error instanceof Error ? error.message : '主管释放失败。'
  }
  refresh()
  return true
}
