// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { paginateStandardListRows, type StandardListColumnPreferences } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import {
  getPostFinishingMaterialTransferOrder,
  listPostFinishingMaterialTransferOrders,
  type PostFinishingMaterialTransferOrder,
  type PostFinishingMaterialTransferStatus,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'

function query(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function navigate(overrides: Record<string, string | null>): void {
  const params = query()
  Object.entries(overrides).forEach(([key, value]) => value === null ? params.delete(key) : params.set(key, value))
  appStore.navigate(`/fcs/craft/post-finishing/material-transfers${params.size ? `?${params.toString()}` : ''}`)
}

function statusBadge(status: PostFinishingMaterialTransferStatus): string {
  const tone: Record<PostFinishingMaterialTransferStatus, string> = {
    申请调拨: 'border-slate-300 bg-slate-50 text-slate-700',
    待调拨: 'border-amber-300 bg-amber-50 text-amber-800',
    待入库: 'border-blue-300 bg-blue-50 text-blue-800',
    已入库: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  }
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${tone[status]}">${escapeHtml(status)}</span>`
}

function imageButton(url: string, label: string): string {
  return `<button type="button" class="relative flex h-11 w-11 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-md border bg-slate-50" data-post-finishing-action="full-flow-zoom-image" data-image-url="${escapeHtml(url)}" data-image-label="${escapeHtml(label)}"><img src="${escapeHtml(url)}" alt="${escapeHtml(label)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"/><span class="px-1 text-center text-[9px] text-slate-500">图片加载中…</span></button>`
}

function legacyResponsibilityLabel(responsibility: PostFinishingMaterialTransferOrder['responsibility']): string {
  return (responsibility as typeof responsibility & { label?: string }).label || ''
}

const columns: StandardListColumn<PostFinishingMaterialTransferOrder>[] = [
  { key: 'order', title: '调拨单号', width: 180, required: true, freezeable: true, render: (row) => `<div class="font-mono font-semibold text-blue-700">${escapeHtml(row.transferOrderNo)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(new Date(row.createdAt).toLocaleString('zh-CN'))}</div>` },
  { key: 'production', title: '生产单 / 后道责任', width: 210, required: true, render: (row) => `<div class="font-mono font-semibold">${escapeHtml(row.productionOrderNo)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.sewingTaskNo)}</div><div class="mt-1 text-xs text-blue-700">${escapeHtml(legacyResponsibilityLabel(row.responsibility))}</div>` },
  { key: 'style', title: '款式', width: 280, required: true, render: (row) => `<div class="flex items-center gap-3">${imageButton(row.styleImageUrl, `${row.styleNo} ${row.styleName} 款式图`)}<div class="min-w-0"><div class="font-mono text-xs font-semibold">${escapeHtml(row.styleNo)}</div><div class="mt-1 max-w-48 truncate text-xs" title="${escapeHtml(row.styleName)}">${escapeHtml(row.styleName)}</div></div></div>` },
  { key: 'route', title: '调拨方向', width: 210, required: true, render: (row) => `<div>${escapeHtml(row.sourceWarehouseName)} → ${escapeHtml(row.targetWarehouseName)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.targetAreaName)} / ${escapeHtml(row.targetLocationCode)}</div>` },
  { key: 'material', title: '物料', width: 160, required: true, align: 'center', render: (row) => `${row.lines.length} 种 / ${row.lines.reduce((sum, line) => sum + line.preparedQty, 0)} ${escapeHtml(row.lines[0]?.unit || '件')}` },
  { key: 'status', title: '调出方状态', width: 110, required: true, render: (row) => statusBadge(row.status) },
  { key: 'updated', title: '最近更新', width: 150, required: true, render: (row) => escapeHtml(new Date(row.updatedAt).toLocaleString('zh-CN')) },
  { key: 'actions', title: '操作', width: 100, required: true, actionColumn: true, render: (row) => `<a data-nav="/fcs/craft/post-finishing/material-transfers?transferId=${encodeURIComponent(row.transferOrderId)}" class="text-xs font-medium text-blue-700 hover:underline">查看详情</a>` },
]

function renderDetailDrawer(record?: PostFinishingMaterialTransferOrder): string {
  if (!record) return ''
  const requested = record.lines.reduce((sum, line) => sum + line.requestedQty, 0)
  const prepared = record.lines.reduce((sum, line) => sum + line.preparedQty, 0)
  return `<div class="fixed inset-0 z-[150] bg-black/30" data-nav="/fcs/craft/post-finishing/material-transfers"></div><aside class="fixed inset-y-0 right-0 z-[160] w-full max-w-4xl overflow-y-auto border-l bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label="后道辅料调拨单详情" data-material-transfer-detail="${escapeHtml(record.transferOrderId)}"><div class="flex items-start justify-between gap-4"><div><h2 class="text-lg font-semibold">后道辅料调拨单详情</h2><p class="mt-1 font-mono text-sm text-muted-foreground">${escapeHtml(record.transferOrderNo)}</p></div><a data-nav="/fcs/craft/post-finishing/material-transfers" class="rounded-md border px-3 py-2 text-sm">关闭</a></div>
    <section class="mt-5 rounded-xl border bg-card p-4"><div class="flex items-start gap-3">${imageButton(record.styleImageUrl, `${record.styleNo} ${record.styleName} 款式图`)}<div class="min-w-0 flex-1"><div class="flex flex-wrap items-center justify-between gap-2"><div><div class="font-mono font-semibold">${escapeHtml(record.productionOrderNo)}</div><div class="mt-1 text-sm">${escapeHtml(record.styleNo)} · ${escapeHtml(record.styleName)}</div></div>${statusBadge(record.status)}</div><div class="mt-3 grid gap-3 text-sm md:grid-cols-3"><div><span class="text-xs text-muted-foreground">任务责任</span><div>${escapeHtml(legacyResponsibilityLabel(record.responsibility))}</div></div><div><span class="text-xs text-muted-foreground">调拨方向</span><div>${escapeHtml(record.sourceWarehouseName)} → ${escapeHtml(record.targetWarehouseName)}</div></div><div><span class="text-xs text-muted-foreground">目标库位</span><div>${escapeHtml(record.targetAreaName)} / ${escapeHtml(record.targetLocationCode)}</div></div></div></div></div></section>
    <section class="mt-4 rounded-xl border bg-card p-4"><div class="flex items-center justify-between"><div><h3 class="font-semibold">物料明细</h3><p class="mt-1 text-xs text-muted-foreground">不允许分批入库；入库数量以调出方实际配料数量为准。</p></div><div class="text-right text-xs text-muted-foreground">申请 ${requested} / 实配 ${prepared}</div></div><div class="mt-3 overflow-x-auto"><table class="min-w-[780px] w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">物料</th><th class="px-3 py-2">物料编码 / SPU</th><th class="px-3 py-2">规格</th><th class="px-3 py-2 text-right">申请</th><th class="px-3 py-2 text-right">调出方实配</th></tr></thead><tbody class="divide-y">${record.lines.map((line) => `<tr><td class="px-3 py-3"><div class="flex items-center gap-3">${imageButton(line.imageUrl, `${line.materialCode} ${line.materialName} 物料图`)}<span>${escapeHtml(line.materialName)}</span></div></td><td class="px-3 py-3"><div class="font-mono text-xs">${escapeHtml(line.materialCode)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(line.materialSpuCode)}</div></td><td class="px-3 py-3">${escapeHtml(line.specification)}</td><td class="px-3 py-3 text-right">${line.requestedQty} ${escapeHtml(line.unit)}</td><td class="px-3 py-3 text-right font-semibold">${line.preparedQty} ${escapeHtml(line.unit)}</td></tr>`).join('')}</tbody></table></div></section>
    <section class="mt-4 rounded-xl border bg-card p-4"><h3 class="font-semibold">状态进度</h3><div class="mt-3 space-y-3">${record.statusHistory.map((item, index) => `<div class="flex gap-3"><div class="mt-1 h-3 w-3 shrink-0 rounded-full ${index === record.statusHistory.length - 1 ? 'bg-blue-600' : 'bg-emerald-500'}"></div><div class="min-w-0 flex-1 border-b pb-3"><div class="flex flex-wrap items-center justify-between gap-2"><strong>${escapeHtml(item.status)}</strong><span class="text-xs text-muted-foreground">${escapeHtml(new Date(item.operatedAt).toLocaleString('zh-CN'))}</span></div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.operatorName)} · ${escapeHtml(item.remark)}</div></div></div>`).join('')}</div></section>
  </aside>`
}

export function renderPostFinishingMaterialTransfersPage(): string {
  const current = query()
  const keyword = current.get('keyword')?.trim().toLowerCase() || ''
  const status = current.get('status') || ''
  const sourceWarehouse = current.get('sourceWarehouse') || ''
  const createdFrom = current.get('createdFrom') || ''
  const createdTo = current.get('createdTo') || ''
  const allRows = listPostFinishingMaterialTransferOrders()
  const rows = allRows.filter((row) => {
    const searchable = [row.transferOrderNo, row.productionOrderNo, row.sewingTaskNo, row.styleNo, row.styleName, ...row.lines.flatMap((line) => [line.materialName, line.materialCode, line.materialSpuCode])].join(' ').toLowerCase()
    const createdDate = row.createdAt.slice(0, 10)
    return (!keyword || searchable.includes(keyword))
      && (!status || row.status === status)
      && (!sourceWarehouse || row.sourceWarehouseName === sourceWarehouse)
      && (!createdFrom || createdDate >= createdFrom)
      && (!createdTo || createdDate <= createdTo)
  })
  const pageSize = Math.max(10, Math.min(50, Number(current.get('pageSize') || 20)))
  const slice = paginateStandardListRows(rows, Number(current.get('page') || 1), pageSize)
  const preferences: StandardListColumnPreferences = { order: columns.map((column) => column.key), visibleKeys: columns.map((column) => column.key), frozenKeys: ['order'], pageSize }
  const selected = current.get('transferId') ? getPostFinishingMaterialTransferOrder(current.get('transferId') || '') : undefined
  const sourceWarehouses = [...new Set(allRows.map((row) => row.sourceWarehouseName))]
  return renderStandardListPage({
    title: '后道辅料调拨单',
    feedbackHtml: '<div class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">本页只查看调出方准备进度；后道领料回厂后在 PDA 整单入库。物料差异不使用成衣回货授权规则。</div>',
    statsHtml: renderStandardListStats([
      { label: '调拨单', value: `${allRows.length} 张` },
      { label: '待调拨', value: `${allRows.filter((row) => ['申请调拨', '待调拨'].includes(row.status)).length} 张` },
      { label: '待入库', value: `${allRows.filter((row) => row.status === '待入库').length} 张` },
      { label: '已入库', value: `${allRows.filter((row) => row.status === '已入库').length} 张` },
    ]),
    filtersHtml: `<form action="/fcs/craft/post-finishing/material-transfers" class="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-3 xl:grid-cols-6"><label class="text-xs text-muted-foreground md:col-span-2">调拨单号 / 生产单号<input name="keyword" value="${escapeHtml(current.get('keyword') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" placeholder="调拨单/生产单/任务/款式/物料"/></label><label class="text-xs text-muted-foreground">来源仓<select name="sourceWarehouse" class="mt-1 h-9 w-full rounded-md border px-3 text-sm"><option value="">全部</option>${sourceWarehouses.map((value) => `<option value="${escapeHtml(value)}" ${value === sourceWarehouse ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label><label class="text-xs text-muted-foreground">调出方状态<select name="status" class="mt-1 h-9 w-full rounded-md border px-3 text-sm"><option value="">全部</option>${(['申请调拨', '待调拨', '待入库', '已入库'] as PostFinishingMaterialTransferStatus[]).map((value) => `<option value="${value}" ${value === status ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label class="text-xs text-muted-foreground">创建开始<input type="date" name="createdFrom" value="${escapeHtml(createdFrom)}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm"/></label><label class="text-xs text-muted-foreground">创建结束<input type="date" name="createdTo" value="${escapeHtml(createdTo)}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm"/></label><div class="flex items-end justify-end gap-2 md:col-span-3 xl:col-span-6"><a data-nav="/fcs/craft/post-finishing/material-transfers" class="inline-flex h-9 items-center rounded-md border px-4 text-sm">重置</a><button class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white">查询</button></div></form>`,
    listTitle: '调拨单列表',
    tableHtml: renderStandardListTable({ columns, rows: slice.rows, preferences, sort: null, eventPrefix: 'post-finishing-material-transfers', emptyText: '暂无符合条件的后道辅料调拨单。' }),
    paginationHtml: renderTablePagination({ total: slice.total, from: slice.from, to: slice.to, currentPage: slice.currentPage, totalPages: slice.totalPages, pageSize: slice.pageSize, actionPrefix: 'post-finishing-material-transfers', fieldPrefix: 'post-finishing-material-transfers' }),
    overlaysHtml: renderDetailDrawer(selected),
  })
}

export function handlePostFinishingMaterialTransfersEvent(target: HTMLElement, event?: Event): boolean {
  if (typeof window === 'undefined' || window.location.pathname !== '/fcs/craft/post-finishing/material-transfers') return false
  const action = target.closest<HTMLElement>('[data-post-finishing-material-transfers-action]')?.dataset.postFinishingMaterialTransfersAction
  if (action === 'prev-page' || action === 'next-page') {
    navigate({ page: String(Math.max(1, Number(query().get('page') || 1) + (action === 'prev-page' ? -1 : 1))), transferId: null })
    return true
  }
  const pageSize = target.closest<HTMLSelectElement>('[data-post-finishing-material-transfers-field="pageSize"]')
  if (pageSize && event?.type === 'change') {
    navigate({ page: '1', pageSize: pageSize.value, transferId: null })
    return true
  }
  return false
}
