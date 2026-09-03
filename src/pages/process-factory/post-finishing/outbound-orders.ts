// @page-pattern: list

import { renderStandardListPage } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { paginateStandardListRows, type StandardListColumnPreferences } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import {
  getPostFinishingFullFlowOutboundOrder,
  getPostFinishingFactoryReturn,
  getPostFinishingWaitHandoverWarehouseRecord,
  listPostFinishingFullFlowOutboundOrders,
  listPostFinishingWarehouseReceipts,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderPostFinishingPageHeader, renderPostStatusBadge } from './shared.ts'

type OutboundRecord = NonNullable<ReturnType<typeof getPostFinishingFullFlowOutboundOrder>>

interface OutboundRow {
  record: OutboundRecord
  factoryName: string
  taskNo: string
  outboundQty: number
  inboundQty: number
  statusLabel: '待确认' | '已确认'
}

function query(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function navigate(overrides: Record<string, string>): void {
  const params = query()
  Object.entries(overrides).forEach(([key, value]) => params.set(key, value))
  appStore.navigate(`/fcs/craft/post-finishing/outbound-orders?${params.toString()}`)
}

function selectOptions(values: string[], selected: string): string {
  return ['<option value="">全部</option>', ...values.map((value) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>`)].join('')
}

function authorizationText(record: NonNullable<ReturnType<typeof getPostFinishingFullFlowOutboundOrder>>): string {
  return record.warehouseAuthorizedBy
    ? `${record.warehouseAuthorizedBy.authorizerName} / ${record.warehouseAuthorizationId}`
    : '无差异'
}

function image(line: NonNullable<ReturnType<typeof getPostFinishingFullFlowOutboundOrder>>['lines'][number]): string {
  const label = `${line.sku.skuCode} ${line.sku.colorName} ${line.sku.sizeName}`
  return `<button type="button" class="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-slate-50" data-post-finishing-action="full-flow-zoom-image" data-image-url="${escapeHtml(line.sku.imageUrl)}" data-image-label="${escapeHtml(label)}"><img src="${escapeHtml(line.sku.imageUrl)}" alt="${escapeHtml(`${line.sku.spuName} ${line.sku.colorName} ${line.sku.sizeName}`)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"/><span class="px-1 text-center text-[9px] text-slate-500">图片加载中…</span></button>`
}

function renderDetail(record: NonNullable<ReturnType<typeof getPostFinishingFullFlowOutboundOrder>>): string {
  const receipt = listPostFinishingWarehouseReceipts().find((item) => item.outboundOrderId === record.outboundOrderId)
  const waitHandover = getPostFinishingWaitHandoverWarehouseRecord(record.outboundOrderId)
  const delivery = getPostFinishingFactoryReturn(record.deliveryId)
  const factoryName = delivery?.managedPostFactoryName || '—'
  const displayStatus = record.status === '已接收入库' ? '已确认' : '待确认'
  const rows = record.lines.map((line) => `<tr>
    <td class="px-3 py-3">${record.lines.indexOf(line) + 1}</td><td class="px-3 py-3">${image(line)}</td><td class="px-3 py-3"><span class="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">成品</span></td><td class="px-3 py-3 font-mono text-xs">${escapeHtml(line.sku.skuCode)}</td><td class="px-3 py-3">${escapeHtml(line.sku.spuName)}</td><td class="px-3 py-3">${escapeHtml(line.sku.colorName)}</td><td class="px-3 py-3">${escapeHtml(line.sku.sizeName)}</td><td class="px-3 py-3">—</td><td class="px-3 py-3">—</td><td class="px-3 py-3">—</td><td class="px-3 py-3">${line.outboundQty}</td><td class="px-3 py-3">${line.receivedQty ?? 0}</td><td class="px-3 py-3">件</td><td class="px-3 py-3">${displayStatus === '已确认' ? '已入后道待交出仓' : '待入后道待交出仓'}</td>
  </tr>`).join('')
  return `<div class="space-y-4">
    <section class="rounded-xl border bg-card p-4"><h3 class="font-semibold">单头信息</h3><dl class="mt-4 grid gap-x-8 gap-y-3 text-sm md:grid-cols-2"><div><dt class="text-xs text-muted-foreground">出货单号</dt><dd class="font-mono">${escapeHtml(record.outboundOrderNo)}</dd></div><div><dt class="text-xs text-muted-foreground">状态</dt><dd>${renderPostStatusBadge(displayStatus)}</dd></div><div><dt class="text-xs text-muted-foreground">工厂</dt><dd>${escapeHtml(factoryName)}</dd></div><div><dt class="text-xs text-muted-foreground">出库仓</dt><dd>${escapeHtml(`${factoryName}-后道待加工仓`)}</dd></div><div><dt class="text-xs text-muted-foreground">接收仓</dt><dd>${escapeHtml(`${factoryName}-后道待交出仓`)}</dd></div><div><dt class="text-xs text-muted-foreground">来源动作</dt><dd>复检完成 → 后道待交出仓</dd></div><div><dt class="text-xs text-muted-foreground">生产单号</dt><dd class="font-mono">${escapeHtml(record.productionOrderNo)}</dd></div><div><dt class="text-xs text-muted-foreground">任务单号</dt><dd class="font-mono">${escapeHtml(delivery?.sewingTaskNo || '—')}</dd></div><div><dt class="text-xs text-muted-foreground">来源对象</dt><dd>复检单</dd></div><div><dt class="text-xs text-muted-foreground">交接单号</dt><dd class="font-mono">${escapeHtml(record.recheckOrderNo)}</dd></div><div><dt class="text-xs text-muted-foreground">库区</dt><dd>${escapeHtml(waitHandover?.areaName || '后道待交出仓')}</dd></div><div><dt class="text-xs text-muted-foreground">库位</dt><dd>${escapeHtml(waitHandover?.locationCode || '待分配')}</dd></div><div><dt class="text-xs text-muted-foreground">计划数量</dt><dd>${record.lines.reduce((sum, line) => sum + line.outboundQty, 0)} 件</dd></div><div><dt class="text-xs text-muted-foreground">入库数量</dt><dd>${record.lines.reduce((sum, line) => sum + (line.receivedQty || 0), 0)} 件</dd></div><div><dt class="text-xs text-muted-foreground">出库时间</dt><dd>${escapeHtml(new Date(record.createdAt).toLocaleString('zh-CN'))}</dd></div><div><dt class="text-xs text-muted-foreground">操作人</dt><dd>${escapeHtml(record.receivedBy?.actorName || '系统自动生成')}</dd></div><div class="md:col-span-2"><dt class="text-xs text-muted-foreground">备注</dt><dd>${escapeHtml(receipt?.differenceReason || '复检完成后自动生成')}</dd></div><div class="md:col-span-2"><dt class="text-xs text-muted-foreground">追溯链路</dt><dd class="font-mono text-xs">${escapeHtml(record.deliveryOrderNo)} → ${escapeHtml(record.qcTaskNo)} → ${escapeHtml(record.postTaskNo || '—')} → ${escapeHtml(record.recheckOrderNo)} → ${escapeHtml(record.outboundOrderNo)}</dd></div></dl></section>
    <section class="rounded-xl border bg-card p-4"><h3 class="font-semibold">出货明细</h3><div class="mt-3 overflow-x-auto"><table class="min-w-[1500px] w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-muted-foreground"><tr>${['序号','图片','类型','SKU','名称','颜色','尺码','项次号','袋号','卷号','计划','入库','单位','行状态'].map((head) => `<th class="px-3 py-2">${head}</th>`).join('')}</tr></thead><tbody class="divide-y">${rows}</tbody></table></div></section>
    ${receipt ? `<section class="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h3 class="font-semibold text-emerald-900">仓库接收记录</h3><div class="mt-2 text-sm text-emerald-800">${escapeHtml(receipt.receivedBy.actorName)} · ${escapeHtml(new Date(receipt.receivedAt).toLocaleString('zh-CN'))} · ${escapeHtml(receipt.differenceReason || '数量一致')}</div></section>` : ''}
  </div>`
}

const outboundColumns: StandardListColumn<OutboundRow>[] = [
  { key: 'outboundNo', title: '出货单号', width: 180, required: true, freezeable: true, render: (row) => `<span class="break-all font-mono font-semibold">${escapeHtml(row.record.outboundOrderNo)}</span>` },
  { key: 'factory', title: '工厂', width: 150, required: true, render: (row) => escapeHtml(row.factoryName) },
  { key: 'productionNo', title: '生产单号', width: 150, required: true, render: (row) => `<span class="font-mono text-xs">${escapeHtml(row.record.productionOrderNo)}</span>` },
  { key: 'taskNo', title: '任务单号', width: 150, required: true, render: (row) => `<span class="font-mono text-xs">${escapeHtml(row.taskNo)}</span>` },
  { key: 'outboundQty', title: '出库数量', width: 90, required: true, align: 'center', render: (row) => `${row.outboundQty} 件` },
  { key: 'inboundQty', title: '入库数量', width: 90, required: true, align: 'center', render: (row) => `${row.inboundQty} 件` },
  { key: 'status', title: '状态', width: 90, required: true, render: (row) => renderPostStatusBadge(row.statusLabel) },
  { key: 'createdAt', title: '创建时间', width: 160, required: true, render: (row) => escapeHtml(new Date(row.record.createdAt).toLocaleString('zh-CN')) },
  { key: 'operator', title: '操作人', width: 110, required: true, render: (row) => escapeHtml(row.record.receivedBy?.actorName || '系统') },
  { key: 'actions', title: '操作', width: 310, required: true, actionColumn: true, render: (row) => `<div class="grid grid-cols-3 gap-x-3 gap-y-2"><a data-nav="/fcs/craft/post-finishing/outbound-orders/${encodeURIComponent(row.record.outboundOrderId)}" class="whitespace-nowrap text-xs font-medium text-blue-700 hover:underline">详情</a><a data-nav="/fcs/craft/post-finishing/print?type=OUTBOUND&id=${encodeURIComponent(row.record.outboundOrderId)}" class="whitespace-nowrap text-xs text-blue-700 hover:underline">打印整单</a><a data-nav="/fcs/craft/post-finishing/print?type=OUTBOUND_BARCODE&id=${encodeURIComponent(row.record.outboundOrderId)}" class="whitespace-nowrap text-xs text-blue-700 hover:underline">打印条码</a><a data-nav="/fcs/craft/post-finishing/print?type=OUTBOUND_HANGTAG&id=${encodeURIComponent(row.record.outboundOrderId)}" class="whitespace-nowrap text-xs text-blue-700 hover:underline">打印吊牌</a></div>` },
]

export function renderPostFinishingOutboundOrdersPage(): string {
  const current = query()
  const keyword = current.get('keyword')?.trim().toLowerCase() || ''
  const status = current.get('status') || ''
  const factory = current.get('factory') || ''
  const createdFrom = current.get('createdFrom') || ''
  const createdTo = current.get('createdTo') || ''
  const allRecords = listPostFinishingFullFlowOutboundOrders()
  const rows = allRecords.map((record): OutboundRow => {
    const delivery = getPostFinishingFactoryReturn(record.deliveryId)
    return {
      record,
      factoryName: delivery?.managedPostFactoryName || '—',
      taskNo: delivery?.sewingTaskNo || '—',
      outboundQty: record.lines.reduce((sum, line) => sum + line.outboundQty, 0),
      inboundQty: record.lines.reduce((sum, line) => sum + (line.receivedQty || 0), 0),
      statusLabel: record.status === '已接收入库' ? '已确认' : '待确认',
    }
  }).filter((row) => {
    const text = [row.record.outboundOrderNo, row.record.recheckOrderNo, row.record.postTaskNo, row.record.qcTaskNo, row.record.deliveryOrderNo, row.record.productionOrderNo, row.taskNo, row.factoryName].filter(Boolean).join(' ').toLowerCase()
    const createdDate = row.record.createdAt.slice(0, 10)
    return (!keyword || text.includes(keyword))
      && (!status || row.statusLabel === status)
      && (!factory || row.factoryName === factory)
      && (!createdFrom || createdDate >= createdFrom)
      && (!createdTo || createdDate <= createdTo)
  })
  const pageSize = Math.max(10, Math.min(50, Number(current.get('pageSize') || 20)))
  const slice = paginateStandardListRows(rows, Number(current.get('page') || 1), pageSize)
  const preferences: StandardListColumnPreferences = { order: outboundColumns.map((column) => column.key), visibleKeys: outboundColumns.map((column) => column.key), frozenKeys: ['outboundNo'], pageSize }
  const factories = [...new Set(allRecords.map((record) => getPostFinishingFactoryReturn(record.deliveryId)?.managedPostFactoryName).filter((value): value is string => Boolean(value)))]
  return renderStandardListPage({
    title: '后道出货单列表',
    primaryActionsHtml: '',
    filtersHtml: `<form action="/fcs/craft/post-finishing/outbound-orders" class="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-3 xl:grid-cols-6"><label class="text-xs text-muted-foreground md:col-span-2">关键词<input name="keyword" value="${escapeHtml(current.get('keyword') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" placeholder="出货单/生产单/任务单/质检单/复检单" /></label><label class="text-xs text-muted-foreground">状态<select name="status" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(['待确认','已确认'], status)}</select></label><label class="text-xs text-muted-foreground">工厂<select name="factory" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(factories, factory)}</select></label><label class="text-xs text-muted-foreground">创建开始<input type="date" name="createdFrom" value="${escapeHtml(createdFrom)}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label><label class="text-xs text-muted-foreground">创建结束<input type="date" name="createdTo" value="${escapeHtml(createdTo)}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label><div class="flex items-end justify-end gap-2 md:col-span-3 xl:col-span-6"><a data-nav="/fcs/craft/post-finishing/outbound-orders" class="inline-flex h-9 items-center rounded-md border px-4 text-sm">重置</a><button class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white">查询</button></div></form>`,
    tableHtml: renderStandardListTable({ columns: outboundColumns, rows: slice.rows, preferences, sort: null, eventPrefix: 'post-finishing-outbound-orders', emptyText: '暂无符合条件的后道出货单。' }),
    paginationHtml: renderTablePagination({ total: slice.total, from: slice.from, to: slice.to, currentPage: slice.currentPage, totalPages: slice.totalPages, pageSize: slice.pageSize, actionPrefix: 'post-finishing-outbound-orders', fieldPrefix: 'post-finishing-outbound-orders' }),
  })
}

export function renderPostFinishingOutboundOrderDetailPage(id: string): string {
  const record = getPostFinishingFullFlowOutboundOrder(id)
  const actions = record ? `<div class="flex flex-wrap items-center justify-end gap-2"><a data-nav="/fcs/craft/post-finishing/print?type=OUTBOUND&id=${encodeURIComponent(record.outboundOrderId)}" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white">打印整单</a><a data-nav="/fcs/craft/post-finishing/print?type=OUTBOUND_BARCODE&id=${encodeURIComponent(record.outboundOrderId)}" class="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm">打印条码</a><a data-nav="/fcs/craft/post-finishing/print?type=OUTBOUND_HANGTAG&id=${encodeURIComponent(record.outboundOrderId)}" class="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm">打印吊牌</a><a data-nav="/fcs/craft/post-finishing/outbound-orders" class="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm">返回出货单列表</a></div>` : `<a data-nav="/fcs/craft/post-finishing/outbound-orders" class="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm">返回出货单列表</a>`
  return `<div class="space-y-4 p-4">${renderPostFinishingPageHeader('后道出货单详情', record?.outboundOrderNo || '', actions)}${record ? renderDetail(record) : '<div class="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">未找到后道出货单。</div>'}</div>`
}

export function handlePostFinishingOutboundOrderEvent(target: HTMLElement, event?: Event): boolean {
  const action = target.closest<HTMLElement>('[data-post-finishing-outbound-orders-action]')?.dataset.postFinishingOutboundOrdersAction
  if (action === 'prev-page' || action === 'next-page') {
    navigate({ page: String(Math.max(1, Number(query().get('page') || 1) + (action === 'prev-page' ? -1 : 1))) })
    return true
  }
  const pageSize = target.closest<HTMLSelectElement>('[data-post-finishing-outbound-orders-field="pageSize"]')
  if (pageSize && event?.type === 'change') {
    navigate({ page: '1', pageSize: pageSize.value })
    return true
  }
  return false
}
