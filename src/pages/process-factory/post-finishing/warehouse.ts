// @page-pattern: list

import {
  POST_FINISHING_ACCEPTANCE_ACTORS,
  POST_FINISHING_SEWING_TASK_TYPE_LABEL,
  confirmPostFinishingFactoryReturn,
  correctPostFinishingFactoryReturnConfirmation,
  getPostFinishingFactoryReturn,
  listPostFinishingFactoryReturns,
  listPostFinishingReturnConfirmationVersions,
  listPostFinishingWaitHandoverWarehouseMovements,
  listPostFinishingWaitHandoverWarehouseRecords,
  listPostFinishingWaitProcessWarehouseMovements,
  listPostFinishingWaitProcessWarehouseRecords,
  sendPostFinishingFactoryReturnToQc,
  type PostFinishingAcceptanceSku,
  type PostFinishingFactoryReturnDelivery,
  type PostFinishingWaitHandoverWarehouseMovement,
  type PostFinishingWaitHandoverWarehouseRecord,
  type PostFinishingWaitProcessWarehouseMovement,
  type PostFinishingWaitProcessWarehouseRecord,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { paginateStandardListRows, type StandardListColumnPreferences } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderPostFinishingPageHeader, renderPostFinishingQcPrintActions, renderPostStatusBadge } from './shared.ts'

let pageMessage = ''
let pageMessageTone: 'success' | 'error' = 'success'

type WarehouseMode = 'wait-process' | 'wait-handover'
type WarehouseTab = 'inventory' | 'movements' | 'locations' | 'returns'

interface WarehouseBatch {
  warehouseRecordId: string
  deliveryId: string
  deliveryOrderNo: string
  productionOrderNo: string
  returnIndex: number
  locationCode: string
  status: string
  inboundQty: number
  availableQty: number
  outboundQty: number
  qcTaskNo?: string
  recheckOrderNo?: string
  outboundOrderNo?: string
}

interface WarehouseInventoryRow {
  sku: PostFinishingAcceptanceSku
  currentQty: number
  inboundQty: number
  outboundQty: number
  batches: WarehouseBatch[]
}

const warehouseUi = {
  keyword: '',
  availability: 'available' as 'all' | 'available' | 'unavailable',
  page: 1,
  pageSize: 20,
  selectedSkuId: '',
  selectedView: 'stock' as 'stock' | 'movements',
  showReturnLookup: false,
}

function currentWarehouseMode(): WarehouseMode {
  return typeof window !== 'undefined' && window.location.pathname.includes('wait-handover-warehouse')
    ? 'wait-handover'
    : 'wait-process'
}

function warehousePath(mode = currentWarehouseMode()): string {
  return `/fcs/craft/post-finishing/${mode === 'wait-process' ? 'wait-process-warehouse' : 'wait-handover-warehouse'}`
}

function currentDeliveryId(): string {
  return typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('deliveryId') || ''
}

function currentTab(mode = currentWarehouseMode()): WarehouseTab {
  const value = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('tab') || ''
  if (value === 'pending') return 'returns'
  if (value === 'movements' || value === 'locations' || value === 'inventory') return value
  if (value === 'returns' && mode === 'wait-process') return value
  return 'inventory'
}

function refresh(deliveryId = currentDeliveryId()): void {
  const tab = currentTab()
  const query = deliveryId
    ? `?tab=${tab}&deliveryId=${encodeURIComponent(deliveryId)}&refresh=${Date.now()}`
    : `?tab=${tab}&refresh=${Date.now()}`
  appStore.navigate(`${warehousePath()}${query}`)
}

function renderMessage(): string {
  if (!pageMessage) return ''
  const tone = pageMessageTone === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-red-200 bg-red-50 text-red-700'
  return `<div class="rounded-lg border px-4 py-3 text-sm ${tone}" role="status">${escapeHtml(pageMessage)}</div>`
}

function qty(record: PostFinishingFactoryReturnDelivery, key: 'registeredQty' | 'confirmedQty'): number {
  return record.lines.reduce((sum, line) => sum + (line[key] || 0), 0)
}

function buildWaitProcessInventory(records: PostFinishingWaitProcessWarehouseRecord[]): WarehouseInventoryRow[] {
  const rows = new Map<string, WarehouseInventoryRow>()
  records.forEach((record) => record.lines.forEach((line) => {
    const row = rows.get(line.sku.skuId) || { sku: line.sku, currentQty: 0, inboundQty: 0, outboundQty: 0, batches: [] }
    row.currentQty += line.availableQty
    row.inboundQty += line.confirmedQty
    row.outboundQty += record.status === '已送检' ? line.confirmedQty : 0
    row.batches.push({
      warehouseRecordId: record.warehouseRecordId,
      deliveryId: record.deliveryId,
      deliveryOrderNo: record.deliveryOrderNo,
      productionOrderNo: record.productionOrderNo,
      returnIndex: record.returnIndex,
      locationCode: record.locationCode,
      status: record.status,
      inboundQty: line.confirmedQty,
      availableQty: line.availableQty,
      outboundQty: record.status === '已送检' ? line.confirmedQty : 0,
    })
    rows.set(line.sku.skuId, row)
  }))
  return [...rows.values()].sort((left, right) => left.sku.skuCode.localeCompare(right.sku.skuCode))
}

function buildWaitHandoverInventory(records: PostFinishingWaitHandoverWarehouseRecord[]): WarehouseInventoryRow[] {
  const rows = new Map<string, WarehouseInventoryRow>()
  records.forEach((record) => record.lines.forEach((line) => {
    const row = rows.get(line.sku.skuId) || { sku: line.sku, currentQty: 0, inboundQty: 0, outboundQty: 0, batches: [] }
    row.currentQty += line.availableQty
    row.inboundQty += line.inboundQty
    row.outboundQty += line.handedOverQty
    row.batches.push({
      warehouseRecordId: record.warehouseRecordId,
      deliveryId: record.deliveryId,
      deliveryOrderNo: record.deliveryOrderNo,
      productionOrderNo: record.productionOrderNo,
      returnIndex: record.returnIndex,
      locationCode: record.locationCode,
      status: record.status,
      inboundQty: line.inboundQty,
      availableQty: line.availableQty,
      outboundQty: line.handedOverQty,
      qcTaskNo: record.qcTaskNo,
      recheckOrderNo: record.recheckOrderNo,
      outboundOrderNo: record.outboundOrderNo,
    })
    rows.set(line.sku.skuId, row)
  }))
  return [...rows.values()].sort((left, right) => left.sku.skuCode.localeCompare(right.sku.skuCode))
}

function renderSkuImage(sku: PostFinishingAcceptanceSku): string {
  const label = `${sku.skuCode} ${sku.colorName} ${sku.sizeName}`
  return `<button type="button" class="relative flex h-11 w-11 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-md border bg-slate-50" data-post-finishing-action="full-flow-zoom-image" data-image-url="${escapeHtml(sku.imageUrl)}" data-image-label="${escapeHtml(label)}"><img src="${escapeHtml(sku.imageUrl)}" alt="${escapeHtml(`${sku.spuName} ${sku.colorName} ${sku.sizeName}`)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false" /><span class="px-1 text-center text-[9px] text-slate-500">图片加载中…</span></button>`
}

function inventoryColumns(): StandardListColumn<WarehouseInventoryRow>[] {
  return [
    { key: 'sku', title: 'SKU', width: 230, required: true, freezeable: true, render: (row) => `<div data-warehouse-sku-row="${escapeHtml(row.sku.skuId)}"><div class="font-mono text-xs font-semibold">${escapeHtml(row.sku.skuCode)}</div></div>` },
    { key: 'spec', title: '款式名称/规格', width: 430, required: true, render: (row) => `<div class="flex items-center gap-3">${renderSkuImage(row.sku)}<div class="min-w-0"><div class="truncate font-medium">${escapeHtml(row.sku.spuName)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.sku.colorName)} / ${escapeHtml(row.sku.sizeName)}</div></div></div>` },
    { key: 'stock', title: '当前库存', width: 160, required: true, align: 'center', render: (row) => `<strong class="tabular-nums ${row.currentQty > 0 ? 'text-slate-900' : 'text-slate-400'}">${row.currentQty} 件</strong>` },
    { key: 'actions', title: '操作', width: 250, required: true, actionColumn: true, render: (row) => `<div class="flex justify-end gap-3 whitespace-nowrap"><button type="button" class="text-xs text-blue-600 hover:underline" data-post-finishing-action="full-flow-open-stock" data-sku-id="${escapeHtml(row.sku.skuId)}">库存明细</button><button type="button" class="text-xs text-blue-600 hover:underline" data-post-finishing-action="full-flow-open-movements" data-sku-id="${escapeHtml(row.sku.skuId)}">查看库存流水</button></div>` },
  ]
}

function fixedPreferences<T>(columns: readonly StandardListColumn<T>[]): StandardListColumnPreferences {
  return { order: columns.map((column) => column.key), visibleKeys: columns.map((column) => column.key), frozenKeys: ['sku'], pageSize: warehouseUi.pageSize }
}

function renderWarehouseTabs(mode: WarehouseMode, tab: WarehouseTab): string {
  const tabs: Array<{ key: WarehouseTab; label: string }> = mode === 'wait-process'
    ? [{ key: 'inventory', label: '库存' }, { key: 'movements', label: '流水记录' }, { key: 'locations', label: '库区库位' }, { key: 'returns', label: '车缝登记回货' }]
    : [{ key: 'inventory', label: '库存' }, { key: 'movements', label: '流水记录' }, { key: 'locations', label: '库区库位' }]
  return `<nav class="flex min-h-10 items-end gap-6 border-b bg-card px-3" aria-label="${mode === 'wait-process' ? '后道待加工仓' : '后道待交出仓'}页签">${tabs.map((item) => `<a data-nav="${warehousePath(mode)}?tab=${item.key}" class="border-b-2 px-1 py-3 text-sm ${tab === item.key ? 'border-blue-500 font-semibold text-blue-600' : 'border-transparent text-slate-600 hover:text-slate-900'}">${item.label}</a>`).join('')}</nav>`
}

function renderWarehouseFilters(mode: WarehouseMode): string {
  return `<div class="flex flex-wrap items-end gap-3 rounded-lg border bg-card px-3 py-2"><label class="text-xs text-muted-foreground">关键词<input class="ml-2 h-8 w-64 rounded-md border px-3 text-sm" data-post-finishing-field="warehouse-keyword" value="${escapeHtml(warehouseUi.keyword)}" placeholder="SKU/款式名称/颜色/尺码" /></label>${mode === 'wait-handover' ? `<label class="text-xs text-muted-foreground">可出库<select class="ml-2 h-8 rounded-md border bg-white px-3 text-sm" data-post-finishing-field="warehouse-availability"><option value="available" ${warehouseUi.availability === 'available' ? 'selected' : ''}>可出库</option><option value="all" ${warehouseUi.availability === 'all' ? 'selected' : ''}>全部</option><option value="unavailable" ${warehouseUi.availability === 'unavailable' ? 'selected' : ''}>不可出库</option></select></label>` : ''}<span class="ml-auto"></span><button type="button" class="h-8 rounded-md border px-3 text-xs" data-post-finishing-action="full-flow-reset-filter">重置</button><button type="button" class="h-8 rounded-md bg-blue-600 px-4 text-xs font-medium text-white" data-post-finishing-action="full-flow-query">查询</button></div>`
}

function filterInventoryRows(rows: WarehouseInventoryRow[], mode: WarehouseMode): WarehouseInventoryRow[] {
  const keyword = warehouseUi.keyword.trim().toLowerCase()
  return rows.filter((row) => {
    const matchesKeyword = !keyword || [row.sku.skuCode, row.sku.spuName, row.sku.colorName, row.sku.sizeName].join(' ').toLowerCase().includes(keyword)
    const matchesAvailability = mode === 'wait-process' || warehouseUi.availability === 'all'
      || (warehouseUi.availability === 'available' ? row.currentQty > 0 : row.currentQty === 0)
    return matchesKeyword && matchesAvailability
  })
}

function renderInventoryContent(mode: WarehouseMode, rows: WarehouseInventoryRow[]): { tableHtml: string; paginationHtml: string; listTitle: string } {
  const filtered = filterInventoryRows(rows, mode)
  const slice = paginateStandardListRows(filtered, warehouseUi.page, warehouseUi.pageSize)
  warehouseUi.page = slice.currentPage
  const columns = inventoryColumns()
  return {
    listTitle: '库存',
    tableHtml: renderStandardListTable({ columns, rows: slice.rows, preferences: fixedPreferences(columns), sort: null, eventPrefix: 'post-finishing', emptyText: '暂无符合条件的库存。' }),
    paginationHtml: renderTablePagination({ total: slice.total, from: slice.from, to: slice.to, currentPage: slice.currentPage, totalPages: slice.totalPages, pageSize: slice.pageSize, actionPrefix: 'post-finishing', fieldPrefix: 'post-finishing', pageSizeOptions: [10, 20, 50] }),
  }
}

type WarehouseMovement = PostFinishingWaitProcessWarehouseMovement | PostFinishingWaitHandoverWarehouseMovement

function renderMovementContent(mode: WarehouseMode, movements: WarehouseMovement[]): { tableHtml: string; paginationHtml: string; listTitle: string } {
  const filtered = movements.filter((movement) => {
    const keyword = warehouseUi.keyword.trim().toLowerCase()
    return !keyword || [movement.deliveryOrderNo, movement.productionOrderNo, ...movement.quantities.map((line) => line.sku.skuCode)].join(' ').toLowerCase().includes(keyword)
  })
  const slice = paginateStandardListRows(filtered, warehouseUi.page, warehouseUi.pageSize)
  warehouseUi.page = slice.currentPage
  const columns: StandardListColumn<WarehouseMovement>[] = [
    { key: 'time', title: '时间', width: 190, required: true, freezeable: true, render: (row) => `<span data-${mode === 'wait-process' ? 'wait-process' : 'wait-handover'}-movement="${escapeHtml(row.movementId)}">${escapeHtml(new Date(row.operatedAt).toLocaleString('zh-CN'))}</span>` },
    { key: 'action', title: '出入库动作', width: 150, required: true, render: (row) => `<strong>${escapeHtml(row.movementType)}</strong>` },
    { key: 'number', title: '送货单 / 生产单', width: 300, required: true, render: (row) => `<div class="font-mono text-xs">${escapeHtml(row.deliveryOrderNo)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.productionOrderNo)}</div>` },
    { key: 'quantity', title: '数量', width: 170, required: true, align: 'center', render: (row) => `${row.quantities.reduce((sum, line) => sum + line.quantity, 0)} 件 / ${row.quantities.length} SKU` },
    { key: 'operator', title: '操作人', width: 180, required: true, render: (row) => `${escapeHtml(row.operator.actorName)}<div class="text-xs text-muted-foreground">${escapeHtml(row.operator.roleName)}</div>` },
  ]
  return {
    listTitle: '流水记录',
    tableHtml: renderStandardListTable({ columns, rows: slice.rows, preferences: fixedPreferences(columns), sort: null, eventPrefix: 'post-finishing', emptyText: mode === 'wait-process' ? '确认回货后生成入仓流水，送检后生成出仓流水。' : '复检完成后生成入仓流水，仓库收货后生成交出流水。' }),
    paginationHtml: renderTablePagination({ total: slice.total, from: slice.from, to: slice.to, currentPage: slice.currentPage, totalPages: slice.totalPages, pageSize: slice.pageSize, actionPrefix: 'post-finishing', fieldPrefix: 'post-finishing', pageSizeOptions: [10, 20, 50] }),
  }
}

function renderLocationContent(mode: WarehouseMode, rows: WarehouseInventoryRow[]): { tableHtml: string; paginationHtml: string; listTitle: string } {
  const locations = [...new Map(rows.flatMap((row) => row.batches.map((batch) => [batch.locationCode, batch])).values())]
  const slice = paginateStandardListRows(locations, warehouseUi.page, warehouseUi.pageSize)
  warehouseUi.page = slice.currentPage
  const columns: StandardListColumn<WarehouseBatch>[] = [
    { key: 'area', title: '库区', width: 250, required: true, render: () => mode === 'wait-process' ? '车缝回货待加工区' : '复检合格待交出区' },
    { key: 'location', title: '库位码', width: 240, required: true, freezeable: true, render: (row) => `<span class="font-mono font-semibold">${escapeHtml(row.locationCode)}</span>` },
    { key: 'number', title: '关联批次', width: 330, required: true, render: (row) => `<div class="font-mono text-xs">${escapeHtml(row.deliveryOrderNo)}</div><div class="text-xs text-muted-foreground">${escapeHtml(row.productionOrderNo)} · 第 ${row.returnIndex} 次回货</div>` },
    { key: 'status', title: '当前状态', width: 180, required: true, render: (row) => renderPostStatusBadge(row.status) },
  ]
  return { listTitle: '库区库位', tableHtml: renderStandardListTable({ columns, rows: slice.rows, preferences: fixedPreferences(columns), sort: null, eventPrefix: 'post-finishing', emptyText: '暂无库区库位记录。' }), paginationHtml: renderTablePagination({ total: slice.total, from: slice.from, to: slice.to, currentPage: slice.currentPage, totalPages: slice.totalPages, pageSize: slice.pageSize, actionPrefix: 'post-finishing', fieldPrefix: 'post-finishing' }) }
}

function renderReturnsContent(deliveries: PostFinishingFactoryReturnDelivery[]): { tableHtml: string; paginationHtml: string; listTitle: string } {
  const keyword = warehouseUi.keyword.trim().toLowerCase()
  const filtered = deliveries.filter((record) => !keyword || [record.deliveryOrderNo, record.productionOrderNo, record.sewingFactoryName].join(' ').toLowerCase().includes(keyword))
  const slice = paginateStandardListRows(filtered, warehouseUi.page, warehouseUi.pageSize)
  warehouseUi.page = slice.currentPage
  const columns: StandardListColumn<PostFinishingFactoryReturnDelivery>[] = [
    { key: 'delivery', title: '送货单 / 生产单', width: 320, required: true, freezeable: true, render: (record) => `<div data-return-card="${escapeHtml(record.deliveryId)}"><button type="button" class="font-mono text-xs font-semibold text-blue-700 hover:underline" data-nav="${warehousePath('wait-process')}?tab=returns&deliveryId=${encodeURIComponent(record.deliveryId)}">${escapeHtml(record.deliveryOrderNo)}</button><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.productionOrderNo)} · 第 ${record.returnIndex} 次回货</div></div>` },
    { key: 'factory', title: '车缝工厂 / 任务', width: 300, required: true, render: (record) => `<div>${escapeHtml(record.sewingFactoryName)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.sewingTaskNo)} · ${escapeHtml(POST_FINISHING_SEWING_TASK_TYPE_LABEL[record.sewingTaskType])}</div>` },
    { key: 'quantity', title: '登记 / 确认', width: 190, required: true, align: 'center', render: (record) => `${qty(record, 'registeredQty')} / ${record.confirmedAt ? qty(record, 'confirmedQty') : '待点数'} 件` },
    { key: 'status', title: '状态', width: 160, required: true, render: (record) => renderPostStatusBadge(record.status) },
    { key: 'actions', title: '操作', width: 190, required: true, actionColumn: true, render: (record) => `<a data-nav="${warehousePath('wait-process')}?tab=returns&deliveryId=${encodeURIComponent(record.deliveryId)}" class="text-xs text-blue-600 hover:underline">${record.status === '已确认待送检' ? '查看并送检' : '查看回货确认'}</a>` },
  ]
  return { listTitle: '车缝登记回货', tableHtml: renderStandardListTable({ columns, rows: slice.rows, preferences: fixedPreferences(columns), sort: null, eventPrefix: 'post-finishing', emptyText: '暂无车缝回货登记。' }), paginationHtml: renderTablePagination({ total: slice.total, from: slice.from, to: slice.to, currentPage: slice.currentPage, totalPages: slice.totalPages, pageSize: slice.pageSize, actionPrefix: 'post-finishing', fieldPrefix: 'post-finishing' }) }
}

function renderInventoryDrawer(mode: WarehouseMode, rows: WarehouseInventoryRow[]): string {
  const row = rows.find((item) => item.sku.skuId === warehouseUi.selectedSkuId)
  if (!row) return ''
  const batches = row.batches.slice().sort((left, right) => right.returnIndex - left.returnIndex)
  const movements = mode === 'wait-process' ? listPostFinishingWaitProcessWarehouseMovements() : listPostFinishingWaitHandoverWarehouseMovements()
  const skuMovements = movements.filter((movement) => movement.quantities.some((line) => line.sku.skuId === row.sku.skuId))
  const batchContent = batches.map((batch) => {
    const stageLinks = mode === 'wait-process'
      ? `<a data-nav="${warehousePath('wait-process')}?tab=returns&deliveryId=${encodeURIComponent(batch.deliveryId)}" class="text-blue-600 hover:underline">查看批次${batch.availableQty > 0 ? '并送检' : ''}</a>`
      : `<a data-nav="/fcs/craft/post-finishing/recheck-orders?keyword=${encodeURIComponent(batch.recheckOrderNo || '')}" class="text-blue-600 hover:underline">复检单 ${escapeHtml(batch.recheckOrderNo || '—')}</a><a data-nav="/fcs/craft/post-finishing/outbound-orders?keyword=${encodeURIComponent(batch.outboundOrderNo || '')}" class="text-blue-600 hover:underline">出货单 ${escapeHtml(batch.outboundOrderNo || '—')}</a>`
    return `<article class="rounded-lg border p-3 text-sm" data-warehouse-batch="${escapeHtml(batch.warehouseRecordId)}">
      <div class="flex items-start justify-between gap-3">
        <div><div class="font-mono text-xs font-semibold">${escapeHtml(batch.deliveryOrderNo)}</div><div class="mt-1 text-xs text-muted-foreground">${escapeHtml(batch.productionOrderNo)} · 第 ${batch.returnIndex} 次回货 · ${escapeHtml(batch.locationCode)}</div></div>
        ${renderPostStatusBadge(batch.status)}
      </div>
      <div class="mt-3 grid grid-cols-3 gap-2 text-xs"><span>入仓 <strong>${batch.inboundQty} 件</strong></span><span>可用 <strong>${batch.availableQty} 件</strong></span><span>出仓 <strong>${batch.outboundQty} 件</strong></span></div>
      <div class="mt-3 flex flex-wrap gap-3 text-xs">${stageLinks}<a data-nav="/fcs/craft/post-finishing/audit-records?deliveryId=${encodeURIComponent(batch.deliveryId)}" class="text-blue-600 hover:underline">查看全流程</a></div>
    </article>`
  }).join('')
  const movementContent = skuMovements.map((movement) => {
    const quantity = movement.quantities.find((line) => line.sku.skuId === row.sku.skuId)?.quantity || 0
    return `<article class="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"><div><strong>${escapeHtml(movement.movementType)}</strong><div class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(movement.deliveryOrderNo)} · ${escapeHtml(new Date(movement.operatedAt).toLocaleString('zh-CN'))}</div></div><div class="text-right"><strong>${quantity} 件</strong><div class="text-xs text-muted-foreground">${escapeHtml(movement.operator.actorName)}</div></div></article>`
  }).join('') || '<div class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">暂无该 SKU 流水。</div>'
  const body = warehouseUi.selectedView === 'stock'
    ? `<h3 class="mt-5 font-semibold">按送货批次拆分</h3><div class="mt-2 space-y-2">${batchContent}</div>`
    : `<h3 class="mt-5 font-semibold">SKU 库存流水</h3><div class="mt-2 space-y-2">${movementContent}</div>`
  return `
    <div class="fixed inset-0 z-[150] bg-black/30" data-post-finishing-action="full-flow-close-overlay"></div>
    <aside class="fixed inset-y-0 right-0 z-[160] w-full max-w-3xl overflow-y-auto border-l bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" data-warehouse-inventory-drawer="${escapeHtml(row.sku.skuId)}">
      <div class="flex items-start justify-between gap-3"><div class="flex gap-3">${renderSkuImage(row.sku)}<div><h2 class="font-semibold">${escapeHtml(row.sku.skuCode)}</h2><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.sku.spuName)} · ${escapeHtml(row.sku.colorName)} / ${escapeHtml(row.sku.sizeName)}</p></div></div><button type="button" class="rounded-md border px-3 py-2 text-xs" data-post-finishing-action="full-flow-close-overlay">关闭</button></div>
      <div class="mt-4 grid grid-cols-3 gap-2 text-sm"><div class="rounded-lg bg-slate-50 p-3">累计入仓<strong class="mt-1 block">${row.inboundQty} 件</strong></div><div class="rounded-lg bg-blue-50 p-3 text-blue-800">当前库存<strong class="mt-1 block">${row.currentQty} 件</strong></div><div class="rounded-lg bg-slate-50 p-3">累计出仓<strong class="mt-1 block">${row.outboundQty} 件</strong></div></div>
      ${body}
    </aside>`
}

function renderReturnLookupDialog(): string {
  if (!warehouseUi.showReturnLookup) return ''
  return `<div class="fixed inset-0 z-[170] flex items-center justify-center bg-black/35 p-4"><section class="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" data-return-lookup-dialog><div class="flex items-start justify-between gap-3"><div><h2 class="font-semibold">回货确认</h2><p class="mt-1 text-xs text-muted-foreground">Web 端输入完整送货单号，打开待确认回货记录。</p></div><button type="button" class="rounded-md border px-3 py-2 text-xs" data-post-finishing-action="full-flow-close-overlay">关闭</button></div><label class="mt-4 block text-sm">完整送货单号<input autofocus class="mt-1 h-11 w-full rounded-md border px-3 font-mono" data-post-finishing-field="return-order-number" data-scan-enter="true" placeholder="请输入完整送货单号" /></label><p class="mt-2 text-xs text-muted-foreground">不支持部分单号和模糊代选。</p><button type="button" class="mt-4 w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white" data-post-finishing-action="full-flow-open-return">查找回货记录</button></section></div>`
}

function renderWarehouseOverview(mode: WarehouseMode): string {
  const tab = currentTab(mode)
  const processRecords = listPostFinishingWaitProcessWarehouseRecords()
  const handoverRecords = listPostFinishingWaitHandoverWarehouseRecords()
  const rows = mode === 'wait-process' ? buildWaitProcessInventory(processRecords) : buildWaitHandoverInventory(handoverRecords)
  const movements = mode === 'wait-process' ? listPostFinishingWaitProcessWarehouseMovements() : listPostFinishingWaitHandoverWarehouseMovements()
  const locations = new Set(rows.flatMap((row) => row.batches.map((batch) => batch.locationCode)))
  const areaCount = rows.length ? 1 : 0
  const stats = renderStandardListStats([
    { label: mode === 'wait-process' ? '待加工在仓' : '待交出在仓', value: `${rows.length} 条` },
    { label: 'SKU 种数', value: `${new Set(rows.map((row) => row.sku.skuId)).size} 种` },
    { label: '库区库位', value: `${areaCount} / ${locations.size}` },
    { label: '流转记录', value: `${movements.length} 条` },
  ])
  let content = renderInventoryContent(mode, rows)
  if (tab === 'movements') content = renderMovementContent(mode, movements)
  if (tab === 'locations') content = renderLocationContent(mode, rows)
  if (tab === 'returns' && mode === 'wait-process') content = renderReturnsContent(listPostFinishingFactoryReturns().sort((a, b) => b.registeredAt.localeCompare(a.registeredAt)))
  return renderStandardListPage({
    title: mode === 'wait-process' ? '后道待加工仓' : '后道待交出仓',
    primaryActionsHtml: `<div class="flex flex-wrap items-center justify-end gap-2">${renderPostFinishingQcPrintActions()}${mode === 'wait-process' ? '<button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-post-finishing-action="full-flow-show-return-lookup">回货确认</button>' : ''}</div>`,
    feedbackHtml: renderMessage(),
    filtersHtml: `<div class="space-y-3">${stats}${renderWarehouseTabs(mode, tab)}${renderWarehouseFilters(mode)}</div>`,
    listTitle: content.listTitle,
    listActionsHtml: `<span class="text-xs text-muted-foreground">当前库存 ${rows.reduce((sum, row) => sum + row.currentQty, 0)} 件</span>`,
    tableHtml: content.tableHtml,
    paginationHtml: content.paginationHtml,
    overlaysHtml: `${renderInventoryDrawer(mode, rows)}${renderReturnLookupDialog()}`,
  })
}

function renderConfirmationVersionHistory(record: PostFinishingFactoryReturnDelivery): string {
  const versions = listPostFinishingReturnConfirmationVersions({ deliveryId: record.deliveryId })
  if (!versions.length) return ''
  return `<section class="rounded-xl border bg-card p-4"><div class="flex items-center justify-between gap-3"><div><h3 class="font-semibold">后道最终确认版本</h3><p class="mt-1 text-xs text-muted-foreground">只有当前生效版本进入 PPIC 回货及 30% / 70% / 100% 节点；旧版本只作审计留痕。</p></div><span class="text-xs text-muted-foreground">${versions.length} 个版本</span></div><div class="mt-3 space-y-2">${versions.slice().reverse().map((version) => `<article class="rounded-lg border p-3 text-sm ${version.status === 'ACTIVE' ? 'border-emerald-200 bg-emerald-50' : 'bg-slate-50 text-slate-600'}"><div class="flex flex-wrap items-center justify-between gap-2"><div class="font-mono text-xs font-semibold">${escapeHtml(version.confirmationVersionId)}</div><span class="rounded-full border px-2 py-0.5 text-xs">${version.status === 'ACTIVE' ? '当前生效' : '已被订正'}</span></div><div class="mt-2 grid gap-2 text-xs md:grid-cols-4"><div>类型：${version.versionKind === 'FINAL_CONFIRMATION' ? '最终确认' : '主管订正'}</div><div>确认：${version.confirmedQty} 件</div><div>操作人：${escapeHtml(version.confirmedBy.actorName)}</div><div>时间：${escapeHtml(version.confirmedAt)}</div></div>${version.correctionReason ? `<div class="mt-2 text-xs">订正原因：${escapeHtml(version.correctionReason)}</div>` : ''}</article>`).join('')}</div></section>`
}

function renderConfirmationCorrection(record: PostFinishingFactoryReturnDelivery): string {
  if (record.status !== '已确认待送检') return ''
  return `<section class="rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 class="font-semibold text-amber-900">后道回货主管订正</h3><p class="mt-1 text-xs text-amber-800">仅用于送检前发现最终确认数量有误。订正会生成新版本，原版本保留，不允许静默覆盖。</p><div class="mt-3 overflow-x-auto"><table class="min-w-[720px] w-full text-left text-sm"><thead><tr class="text-xs text-amber-900"><th class="px-3 py-2">SKU</th><th class="px-3 py-2">登记数量</th><th class="px-3 py-2">当前确认</th><th class="px-3 py-2">订正后数量</th></tr></thead><tbody class="divide-y divide-amber-200">${record.lines.map((line) => `<tr data-return-correction-line="${escapeHtml(line.sku.skuId)}"><td class="px-3 py-2">${escapeHtml(line.sku.skuCode)} · ${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</td><td class="px-3 py-2">${line.registeredQty} 件</td><td class="px-3 py-2">${line.confirmedQty ?? 0} 件</td><td class="px-3 py-2"><input type="number" min="0" step="1" value="${line.confirmedQty ?? 0}" class="h-9 w-24 rounded-md border bg-white px-2" data-return-correction-count /></td></tr>`).join('')}</tbody></table></div><label class="mt-3 block text-sm text-amber-900">订正原因<textarea class="mt-1 min-h-20 w-full rounded-md border bg-white px-3 py-2" data-return-correction-reason placeholder="必须说明为什么订正"></textarea></label><button type="button" class="mt-3 rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white" data-post-finishing-action="full-flow-correct-return" data-delivery-id="${escapeHtml(record.deliveryId)}">主管确认订正并保留版本</button></section>`
}

function renderImageButton(record: PostFinishingFactoryReturnDelivery, line: PostFinishingFactoryReturnDelivery['lines'][number]): string {
  void record
  return renderSkuImage(line.sku)
}

function renderConfirmationDetail(record: PostFinishingFactoryReturnDelivery): string {
  const showSecond = ['待二次点数', '差异待授权'].includes(record.status)
  const showAuthorization = record.status === '差异待授权'
  return `<div class="space-y-4" data-return-confirm-root="${escapeHtml(record.deliveryId)}">
    <div class="flex flex-wrap items-center justify-between gap-3"><button type="button" class="text-sm text-blue-700 hover:underline" data-nav="/fcs/craft/post-finishing/wait-process-warehouse">← 返回回货列表</button><div class="flex gap-2">${record.status === '已确认待送检' ? `<button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white" data-post-finishing-action="full-flow-send-qc" data-delivery-id="${escapeHtml(record.deliveryId)}">确认送检出库</button>` : ''}${record.qcTaskNo && record.status !== '已确认待送检' ? `<a data-nav="/fcs/craft/post-finishing/print?type=SEND_QC&id=${encodeURIComponent(record.deliveryId)}" class="rounded-md border px-3 py-2 text-sm">打印送检单</a><a data-nav="/fcs/craft/post-finishing/qc-workbench?taskNo=${encodeURIComponent(record.qcTaskNo)}" class="rounded-md border px-3 py-2 text-sm">打开质检单</a>` : ''}</div></div>
    <section class="rounded-xl border bg-card p-4"><div class="flex items-start justify-between gap-4"><div><h2 class="text-lg font-semibold">${escapeHtml(record.deliveryOrderNo)}</h2><p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.productionOrderNo)} · 第 ${record.returnIndex} 次回货 · ${escapeHtml(record.deliveryPersonName)}</p></div>${renderPostStatusBadge(record.status)}</div><div class="mt-3 grid gap-3 text-sm md:grid-cols-4"><div><span class="text-xs text-muted-foreground">执行任务</span><div>${escapeHtml(record.sewingTaskNo)}</div><div class="font-mono text-xs text-muted-foreground">${escapeHtml(record.executionTaskId)}</div></div><div><span class="text-xs text-muted-foreground">分配与任务类型</span><div>${escapeHtml(record.assignmentId)}</div><div class="text-xs text-muted-foreground">${escapeHtml(POST_FINISHING_SEWING_TASK_TYPE_LABEL[record.sewingTaskType])}</div></div><div><span class="text-xs text-muted-foreground">后道最终确认人</span><div>${escapeHtml(record.confirmedBy?.actorName || '—')}</div><div class="text-xs text-muted-foreground">${escapeHtml(record.confirmedAt || '尚未确认')}</div></div><div><span class="text-xs text-muted-foreground">差异授权人</span><div>${escapeHtml(record.returnAuthorizedBy ? `${record.returnAuthorizedBy.authorizerName} / ${record.returnAuthorizationId}` : '无需授权')}</div></div></div><div class="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">数据边界：工厂登记是申报；本页“后道最终确认”才是 PPIC 正式回货及履约节点的唯一数据源。</div></section>
    ${record.status !== '已确认待送检' && record.status !== '已送检' && record.status !== '已完成' ? `<section class="rounded-xl border bg-card p-4"><h3 class="font-semibold">${showSecond ? '第二次点数' : '第一次点数'}</h3><p class="mt-1 text-xs text-muted-foreground">任一 SKU 首次差异率超过 5%才要求二次点数；二次点数仍超过 5%才需要授权。分母始终为工厂登记数量。</p><div class="mt-4 overflow-x-auto"><table class="min-w-[880px] w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">SKU</th><th class="px-3 py-2">登记数量</th><th class="px-3 py-2">第一次点数</th><th class="px-3 py-2">第二次点数</th><th class="px-3 py-2">最终差异</th></tr></thead><tbody class="divide-y">${record.lines.map((line) => `<tr data-return-count-line="${escapeHtml(line.sku.skuId)}"><td class="px-3 py-3"><div class="flex items-center gap-3">${renderImageButton(record, line)}<div><div class="font-semibold">${escapeHtml(line.sku.skuCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</div></div></div></td><td class="px-3 py-3 font-semibold">${line.registeredQty} 件</td><td class="px-3 py-3"><input type="number" min="0" step="1" value="${line.firstCountQty ?? line.registeredQty}" class="h-9 w-24 rounded-md border px-2" data-return-first-count /></td><td class="px-3 py-3"><input type="number" min="0" step="1" value="${line.secondCountQty ?? line.firstCountQty ?? line.registeredQty}" class="h-9 w-24 rounded-md border px-2 ${showSecond ? '' : 'bg-slate-100'}" data-return-second-count ${showSecond ? '' : 'disabled'} /></td><td class="px-3 py-3 text-xs">${line.confirmedQty === undefined ? '系统自动计算' : `${(line.differenceQty || 0) > 0 ? '多' : (line.differenceQty || 0) < 0 ? '少' : '一致'} ${Math.abs(line.differenceQty || 0)} 件 / ${((line.differenceRate || 0) * 100).toFixed(2)}%`}</td></tr>`).join('')}</tbody></table></div>${showAuthorization ? `<div class="mt-4 grid gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 md:grid-cols-2"><label class="text-sm">差异原因<textarea class="mt-1 min-h-20 w-full rounded-md border bg-white px-3 py-2" data-return-difference-reason placeholder="必须填写"></textarea></label><label class="text-sm">录入或粘贴动态授权码<textarea class="mt-1 min-h-20 w-full rounded-md border bg-white px-3 py-2 font-mono text-xs" data-return-authorization placeholder="PFAUTH:..."></textarea></label></div>` : ''}<button type="button" class="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white" data-post-finishing-action="full-flow-confirm-return" data-delivery-id="${escapeHtml(record.deliveryId)}">${showSecond ? (showAuthorization ? '授权并确认回货' : '提交第二次点数') : '提交第一次点数'}</button></section>` : ''}
    ${renderConfirmationCorrection(record)}
    ${renderConfirmationVersionHistory(record)}
    <section class="rounded-xl border border-blue-200 bg-blue-50 p-4"><h3 class="font-semibold text-blue-900">SPU 技术参数在质检单统一维护</h3><p class="mt-1 text-xs text-blue-800">颜色对照图和各尺码尺寸按 SPU 共用，本回货页不再重复上传。</p><a href="/fcs/craft/post-finishing/qc-orders" data-nav="/fcs/craft/post-finishing/qc-orders" class="mt-3 inline-flex rounded-md border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-700">前往质检单维护</a></section>
  </div>`
}

export function renderPostFinishingWaitProcessWarehousePage(): string {
  const selected = currentDeliveryId() ? getPostFinishingFactoryReturn(currentDeliveryId()) : undefined
  return selected
    ? `<div class="space-y-4 p-4" data-post-finishing-return-page>${renderPostFinishingPageHeader('后道待加工仓', '根据完整送货单号确认回货，确认后进入待加工仓并可发起送检', renderPostFinishingQcPrintActions(selected.qcTaskNo))}${renderMessage()}${renderConfirmationDetail(selected)}</div>`
    : `<div data-post-finishing-return-page>${renderWarehouseOverview('wait-process')}</div>`
}

export function renderPostFinishingWaitHandoverWarehousePage(): string {
  return `<div data-post-finishing-wait-handover-page>${renderWarehouseOverview('wait-handover')}</div>`
}

function showImage(url: string, label: string): void {
  const overlay = document.createElement('div')
  overlay.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.innerHTML = `<button type="button" class="absolute right-4 top-4 rounded-full bg-white px-3 py-2 text-sm">关闭</button><div class="flex min-h-40 min-w-64 items-center justify-center rounded-xl bg-white p-3"><img src="${escapeHtml(url)}" alt="${escapeHtml(label)}" class="max-h-[82vh] max-w-[86vw] rounded-xl object-contain" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败，请核对原图后重试';this.nextElementSibling.hidden=false" /><span class="p-8 text-sm text-slate-500">图片加载中…</span></div>`
  const close = () => {
    overlay.remove()
    document.removeEventListener('keydown', onKeydown)
  }
  const onKeydown = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
  overlay.addEventListener('click', close)
  document.addEventListener('keydown', onKeydown)
  document.body.appendChild(overlay)
}

export function handlePostFinishingReturnFlowEvent(target: HTMLElement, event?: Event): boolean {
  const actionNode = target.closest<HTMLElement>('[data-post-finishing-action]')
  const action = actionNode?.dataset.postFinishingAction
  const fieldNode = target.closest<HTMLInputElement | HTMLSelectElement>('[data-post-finishing-field]')
  const field = fieldNode?.dataset.postFinishingField
  const openReturnFromEnter = field === 'return-order-number' && event?.type === 'keydown' && (event as KeyboardEvent).key === 'Enter'
  if (!action?.startsWith('full-flow-') && !['prev-page', 'next-page'].includes(action || '') && field !== 'pageSize' && !openReturnFromEnter) return false
  try {
    if (action === 'full-flow-zoom-image' && actionNode?.dataset.imageUrl) {
      showImage(actionNode.dataset.imageUrl, actionNode.dataset.imageLabel || '产品图片')
      return true
    }
    if (field === 'pageSize') {
      if (event?.type === 'change') {
        warehouseUi.pageSize = Math.max(10, Number(fieldNode?.value || 20))
        warehouseUi.page = 1
        refresh('')
      }
      return true
    }
    if (action === 'prev-page' || action === 'next-page') {
      warehouseUi.page = Math.max(1, warehouseUi.page + (action === 'next-page' ? 1 : -1))
      refresh('')
      return true
    }
    if (action === 'full-flow-query') {
      warehouseUi.keyword = document.querySelector<HTMLInputElement>('[data-post-finishing-field="warehouse-keyword"]')?.value || ''
      warehouseUi.availability = (document.querySelector<HTMLSelectElement>('[data-post-finishing-field="warehouse-availability"]')?.value || warehouseUi.availability) as typeof warehouseUi.availability
      warehouseUi.page = 1
      refresh('')
      return true
    }
    if (action === 'full-flow-reset-filter') {
      warehouseUi.keyword = ''
      warehouseUi.availability = 'available'
      warehouseUi.page = 1
      refresh('')
      return true
    }
    if (action === 'full-flow-open-stock' || action === 'full-flow-open-movements') {
      warehouseUi.selectedSkuId = actionNode?.dataset.skuId || ''
      warehouseUi.selectedView = action === 'full-flow-open-stock' ? 'stock' : 'movements'
      refresh('')
      return true
    }
    if (action === 'full-flow-show-return-lookup') {
      warehouseUi.showReturnLookup = true
      refresh('')
      return true
    }
    if (action === 'full-flow-close-overlay') {
      warehouseUi.selectedSkuId = ''
      warehouseUi.showReturnLookup = false
      refresh('')
      return true
    }
    if (action === 'full-flow-open-return' || openReturnFromEnter) {
      const orderNo = document.querySelector<HTMLInputElement>('[data-post-finishing-field="return-order-number"]')?.value.trim() || ''
      const delivery = getPostFinishingFactoryReturn(orderNo)
      if (!delivery || delivery.deliveryOrderNo !== orderNo) throw new Error('未找到完整送货单号，请核对后重新输入。')
      warehouseUi.showReturnLookup = false
      appStore.navigate(`${warehousePath('wait-process')}?tab=returns&deliveryId=${encodeURIComponent(delivery.deliveryId)}`)
      return true
    }
    const deliveryId = actionNode?.dataset.deliveryId || currentDeliveryId()
    if (!deliveryId) throw new Error('缺少送货单。')
    if (action === 'full-flow-confirm-return') {
      const root = document.querySelector<HTMLElement>('[data-return-confirm-root]')
      if (!root) throw new Error('未找到回货确认表单。')
      const lines = Array.from(root.querySelectorAll<HTMLElement>('[data-return-count-line]'))
      const current = getPostFinishingFactoryReturn(deliveryId)
      if (!current) throw new Error('未找到送货单。')
      const firstCounts = lines.map((line) => ({ skuId: line.dataset.returnCountLine || '', actualQty: Number(line.querySelector<HTMLInputElement>('[data-return-first-count]')?.value || 0) }))
      const showSecond = ['待二次点数', '差异待授权'].includes(current.status)
      const secondCounts = showSecond ? lines.map((line) => ({ skuId: line.dataset.returnCountLine || '', actualQty: Number(line.querySelector<HTMLInputElement>('[data-return-second-count]')?.value || 0) })) : undefined
      const confirmed = confirmPostFinishingFactoryReturn({
        deliveryId,
        firstCounts,
        secondCounts,
        actor: POST_FINISHING_ACCEPTANCE_ACTORS.returnConfirmer,
        authorization: current.status === '差异待授权' ? {
          scanValue: root.querySelector<HTMLTextAreaElement>('[data-return-authorization]')?.value || '',
          differenceReason: root.querySelector<HTMLTextAreaElement>('[data-return-difference-reason]')?.value || '',
        } : undefined,
      })
      pageMessage = `后道已最终确认回货，质检单 ${confirmed.qcTaskNo || '—'} 已自动生成并进入待送检；数量已进入后道待加工仓。`
    }
    if (action === 'full-flow-correct-return') {
      const root = document.querySelector<HTMLElement>('[data-return-confirm-root]')
      if (!root) throw new Error('未找到回货订正表单。')
      const correctedCounts = Array.from(root.querySelectorAll<HTMLElement>('[data-return-correction-line]')).map((line) => ({
        skuId: line.dataset.returnCorrectionLine || '',
        actualQty: Number(line.querySelector<HTMLInputElement>('[data-return-correction-count]')?.value || 0),
      }))
      correctPostFinishingFactoryReturnConfirmation({
        deliveryId,
        correctedCounts,
        correctionReason: root.querySelector<HTMLTextAreaElement>('[data-return-correction-reason]')?.value || '',
        actor: POST_FINISHING_ACCEPTANCE_ACTORS.returnSupervisor,
      })
      pageMessage = '后道最终确认已由回货主管订正；新版本生效，原版本已保留。'
    }
    if (action === 'full-flow-send-qc') {
      const task = sendPostFinishingFactoryReturnToQc({ deliveryId, actor: POST_FINISHING_ACCEPTANCE_ACTORS.sender })
      pageMessage = `送检成功：${task.qcTaskNo}`
    }
    pageMessageTone = 'success'
  } catch (error) {
    pageMessage = error instanceof Error ? error.message : '操作失败，请重新核对。'
    pageMessageTone = 'error'
  }
  refresh(actionNode?.dataset.deliveryId || currentDeliveryId())
  return true
}
