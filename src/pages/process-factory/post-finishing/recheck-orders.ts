// @page-pattern: list

import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../../components/ui/list-table.ts'
import { paginateStandardListRows, type StandardListColumnPreferences } from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import {
  POST_FINISHING_ACCEPTANCE_ACTORS,
  claimPostFinishingRecheckOrder,
  completePostFinishingRecheckOrderFullFlow,
  getCurrentPostFinishingActor,
  getPostFinishingFactoryReturn,
  getPostFinishingFullFlowRecheckOrder,
  getPostFinishingWaitHandoverWarehouseRecord,
  listPostFinishingFullFlowRecheckOrders,
  markPostFinishingRecheckSkuRelabeled,
  releasePostFinishingRecheckOrder,
  scanPostFinishingRecheckSkuBarcode,
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
let messageTone: 'success' | 'error' = 'success'

function removeRecheckClaimDialog(): void {
  if (typeof document === 'undefined') return
  document.getElementById('post-finishing-recheck-claim-modal')?.remove()
}

function openRecheckClaimDialog(): void {
  removeRecheckClaimDialog()
  const actor = getCurrentPostFinishingActor(POST_FINISHING_ACCEPTANCE_ACTORS.recheckerA.actorId)
  const host = document.getElementById('app') || document.body
  host.insertAdjacentHTML('beforeend', `<div id="post-finishing-recheck-claim-modal" class="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 p-4" data-skip-page-rerender="true"><section class="w-full max-w-xl rounded-lg border bg-background shadow-2xl" role="dialog" aria-modal="true" aria-label="领取复检单"><header class="flex items-center justify-between gap-3 border-b px-4 py-3"><div><h2 class="font-semibold">领取复检单</h2><p class="mt-1 text-xs text-muted-foreground">当前复检员：${escapeHtml(actor.actorName)}</p></div><button type="button" class="rounded-md border px-2 py-1 text-xs" data-post-finishing-recheck-action="close-claim">关闭</button></header><div class="space-y-3 p-4"><p class="text-sm text-muted-foreground">只能扫描或输入完整复检单号；仅待复检且未被领取的单据可领取。</p><input autofocus class="h-10 w-full rounded-md border px-3 font-mono text-sm" placeholder="完整复检单号" data-recheck-claim-task-no /><div class="flex justify-end gap-2"><button type="button" class="rounded-md border px-4 py-2 text-sm" data-post-finishing-recheck-action="close-claim">取消</button><button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white" data-post-finishing-recheck-action="confirm-claim">确认领取</button></div></div></section></div>`)
  document.querySelector<HTMLInputElement>('[data-recheck-claim-task-no]')?.focus()
}

function currentRechecker() {
  return getCurrentPostFinishingActor(POST_FINISHING_ACCEPTANCE_ACTORS.recheckerA.actorId)
}

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
  { key: 'recheck', title: '复检单号', width: 160, required: true, freezeable: true, render: (row) => `<div class="break-all font-mono font-semibold">${escapeHtml(row.record.recheckOrderNo)}</div><div class="mt-1 text-xs text-muted-foreground">第 ${row.record.returnIndex} 次回货</div>` },
  { key: 'source', title: '来源', width: 100, required: true, render: (row) => escapeHtml(row.record.sourceType) },
  { key: 'qc', title: '关联质检单', width: 150, required: true, render: (row) => `<span class="break-all font-mono text-blue-700">${escapeHtml(row.record.qcTaskNo)}</span>` },
  { key: 'post', title: '关联后道加工单', width: 150, required: true, render: (row) => `<span class="break-all font-mono ${row.record.postTaskNo ? 'text-blue-700' : 'text-muted-foreground'}">${escapeHtml(row.record.postTaskNo || '不适用')}</span>` },
  { key: 'production', title: '生产单号', width: 130, required: true, render: (row) => `<span class="font-mono text-blue-700">${escapeHtml(row.record.productionOrderNo)}</span>` },
  { key: 'factory', title: '加工工厂', width: 130, required: true, render: (row) => escapeHtml(row.delivery?.managedPostFactoryName || '—') },
  { key: 'style', title: '款式名称', width: 180, required: true, render: (row) => `<div class="font-mono text-xs">${escapeHtml(row.record.lines[0]?.sku.spuCode || '—')}</div><div class="mt-1 text-xs">${escapeHtml(row.record.lines[0]?.sku.spuName || '—')}</div>` },
  { key: 'sku', title: 'SKU 明细', width: 210, required: true, render: renderSkuSummary },
  { key: 'expected', title: '复检数量', width: 90, required: true, align: 'center', render: (row) => `${totalExpected(row.record)} 件` },
  { key: 'passed', title: '合格数量', width: 90, required: true, align: 'center', render: (row) => `${totalPassed(row.record)} 件` },
  { key: 'defect', title: '不合格数量', width: 100, required: true, align: 'center', render: (row) => `${totalDefect(row.record)} 件` },
  { key: 'rechecker', title: '复检员', width: 100, required: true, render: (row) => escapeHtml(row.record.claimedBy?.actorName || '待领取') },
  { key: 'status', title: '复检状态', width: 100, required: true, render: (row) => renderPostStatusBadge(row.record.status) },
  { key: 'time', title: '复检时间', width: 140, required: true, render: (row) => escapeHtml(row.record.completedAt ? new Date(row.record.completedAt).toLocaleString('zh-CN') : row.record.claimedAt ? new Date(row.record.claimedAt).toLocaleString('zh-CN') : '—') },
  { key: 'actions', title: '操作', width: 230, required: true, actionColumn: true, render: (row) => {
    const actor = currentRechecker()
    const isOwner = row.record.claimedBy?.actorId === actor.actorId
    const isSupervisor = actor.roleName.includes('主管')
    return `<div class="grid grid-cols-2 gap-x-3 gap-y-2"><a data-nav="/fcs/craft/post-finishing/recheck-orders?id=${encodeURIComponent(row.record.recheckOrderId)}" class="whitespace-nowrap text-xs font-medium text-blue-700 hover:underline">${isOwner && row.record.status !== '复检完成' ? '执行复检' : '查看复检详情'}</a>${isOwner && row.record.status !== '复检完成' ? `<button type="button" class="whitespace-nowrap text-left text-xs text-amber-700 hover:underline" data-post-finishing-recheck-action="release" data-recheck-id="${escapeHtml(row.record.recheckOrderId)}">退领</button>` : ''}${isSupervisor && row.record.claimedBy && row.record.status !== '复检完成' ? `<button type="button" class="whitespace-nowrap text-left text-xs text-amber-700 hover:underline" data-post-finishing-action="full-flow-supervisor-release-recheck" data-recheck-id="${escapeHtml(row.record.recheckOrderId)}">主管释放</button>` : ''}</div>`
  } },
]

function renderDetail(record: RecheckRecord): string {
  const waitHandover = record.outboundOrderNo ? getPostFinishingWaitHandoverWarehouseRecord(record.outboundOrderNo) : undefined
  const actor = currentRechecker()
  const isOwner = record.claimedBy?.actorId === actor.actorId
  const editable = Boolean(isOwner && record.status !== '复检完成')
  const rows = record.lines.map((line) => `<tr data-recheck-result-line="${escapeHtml(line.sku.skuId)}" data-expected-qty="${line.expectedQty}">
    <td class="px-3 py-3"><div class="flex items-center gap-3">${image(line)}<div><div class="font-semibold">${escapeHtml(line.sku.skuCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(line.sku.spuCode)} · ${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</div></div></div></td>
    <td class="px-3 py-3">${line.expectedQty} 件</td>
    <td class="px-3 py-3">${editable ? `<input type="number" min="0" step="1" value="${line.passedQty ?? line.expectedQty}" class="h-9 w-24 rounded-md border px-2 text-right" data-recheck-result-field="passedQty"/>` : `${line.passedQty ?? '—'}${line.passedQty === undefined ? '' : ' 件'}`}</td>
    <td class="px-3 py-3">${editable ? `<input type="number" min="0" step="1" value="${line.defectQty ?? 0}" class="h-9 w-24 rounded-md border px-2 text-right" data-recheck-result-field="defectQty"/>` : `${line.defectQty ?? '—'}${line.defectQty === undefined ? '' : ' 件'}`}</td>
    <td class="px-3 py-3">${editable ? `<select class="h-9 min-w-28 rounded-md border px-2 text-sm" data-recheck-result-field="barcodeCorrect"><option value="">请选择</option><option value="yes" ${line.barcodeStatus === '正确' ? 'selected' : ''}>是，条码正确</option><option value="no" ${['错误待重贴','已重贴待复扫'].includes(line.barcodeStatus) ? 'selected' : ''}>否，条码错误</option></select>${line.barcodeStatus !== '待扫描' ? `<div class="mt-2">${renderPostStatusBadge(line.barcodeStatus)}</div>` : ''}` : renderPostStatusBadge(line.barcodeStatus)}${line.barcodeStatus === '错误待重贴' ? `<div class="mt-2 flex flex-col gap-1"><a data-nav="/fcs/craft/post-finishing/print?type=SKU_LABEL&id=${encodeURIComponent(record.recheckOrderId)}&skuId=${encodeURIComponent(line.sku.skuId)}" class="text-xs text-blue-700 underline">打印重贴条码</a>${editable ? `<button type="button" class="text-left text-xs text-amber-700 underline" data-post-finishing-recheck-action="relabeled" data-recheck-id="${escapeHtml(record.recheckOrderId)}" data-sku-id="${escapeHtml(line.sku.skuId)}">已重新贴码</button>` : ''}</div>` : ''}</td>
    <td class="px-3 py-3 text-xs">${line.barcodeEvents.map((event) => `${escapeHtml(event.action)} · ${escapeHtml(event.operator.actorName)} · ${escapeHtml(new Date(event.operatedAt).toLocaleString('zh-CN'))}`).join('<br/>') || '尚未确认'}</td>
  </tr>`).join('')
  const authorizationText = record.recheckAuthorizedBy
    ? `${record.recheckAuthorizedBy.authorizerName} / ${record.recheckAuthorizationId}`
    : '无差异'
  const expectedTotal = totalExpected(record)
  const actualTotal = record.lines.reduce((sum, line) => sum + (line.passedQty ?? line.expectedQty) + (line.defectQty ?? 0), 0)
  return `<div class="space-y-4" data-recheck-web-form="${escapeHtml(record.recheckOrderId)}" data-skip-page-rerender="true">
    <section class="rounded-xl border bg-card p-4"><div class="flex items-start justify-between gap-4"><div><h2 class="font-mono text-lg font-semibold">${escapeHtml(record.recheckOrderNo)}</h2><p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.productionOrderNo)} · 根送货单 ${escapeHtml(record.deliveryOrderNo)} · ${escapeHtml(record.sourceType)}${record.postTaskNo ? ` ${escapeHtml(record.postTaskNo)}` : ''}</p></div>${renderPostStatusBadge(record.status)}</div><div class="mt-3 grid gap-3 text-sm md:grid-cols-5"><div><span class="text-xs text-muted-foreground">复检员</span><div>${escapeHtml(record.claimedBy?.actorName || '未领取')}</div></div><div><span class="text-xs text-muted-foreground">领取时间</span><div>${escapeHtml(record.claimedAt ? new Date(record.claimedAt).toLocaleString('zh-CN') : '—')}</div></div><div><span class="text-xs text-muted-foreground">数量授权人</span><div>${escapeHtml(authorizationText)}</div></div><div><span class="text-xs text-muted-foreground">后道出货单</span><div>${escapeHtml(record.outboundOrderNo || '待生成')}</div></div><div><span class="text-xs text-muted-foreground">待交出仓</span><div>${escapeHtml(waitHandover ? `${waitHandover.status} / ${waitHandover.lines.reduce((sum, line) => sum + line.availableQty, 0)} 件` : '复检完成后入仓')}</div></div></div></section>
    ${record.claimedBy && !isOwner && record.status !== '复检完成' ? `<div class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">该复检单已由 ${escapeHtml(record.claimedBy.actorName)} 复检中，当前账号只能查看。</div>` : ''}
    <section class="rounded-xl border bg-card p-4"><h3 class="font-semibold">SKU 数量与条码核对</h3><p class="mt-1 text-xs text-muted-foreground">复检合格 + 复检瑕疵应等于交接数量；任一 SKU 存在数量差异均需上级授权。条码错误必须重新贴码并复核为“是”。</p><div class="mt-3 overflow-x-auto"><table class="min-w-[1040px] w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">SKU / 产品</th><th class="px-3 py-2">交接数量</th><th class="px-3 py-2">复检合格</th><th class="px-3 py-2">复检瑕疵</th><th class="px-3 py-2">SKU 条码是否正确</th><th class="px-3 py-2">条码操作日志</th></tr></thead><tbody class="divide-y">${rows}</tbody></table></div>${editable ? `<div class="mt-4 rounded-lg px-3 py-2 text-sm ${actualTotal === expectedTotal ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}" data-recheck-live-summary>交接 ${expectedTotal} 件 · 当前录入 ${actualTotal} 件 · 差异 ${actualTotal - expectedTotal} 件</div><div class="${actualTotal === expectedTotal ? 'hidden ' : ''}mt-3 grid gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 md:grid-cols-2" data-recheck-authorization><label class="text-sm text-amber-900">差异原因<input class="mt-1 h-10 w-full rounded-md border bg-white px-3" data-recheck-difference-reason /></label><label class="text-sm text-amber-900">上级 30 秒动态授权码<textarea class="mt-1 min-h-20 w-full rounded-md border bg-white px-3 py-2 font-mono text-xs" data-recheck-authorization-code></textarea></label></div><button type="button" class="mt-4 w-full rounded-md bg-blue-600 px-5 py-3 text-sm font-semibold text-white" data-post-finishing-recheck-action="complete" data-recheck-id="${escapeHtml(record.recheckOrderId)}">提交复检并生成后道出货单</button>` : ''}</section>
    ${record.outboundOrderNo ? `<div class="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">复检已完成，唯一后道出货单：<a data-nav="/fcs/craft/post-finishing/outbound-orders/${encodeURIComponent(record.outboundOrderId || '')}" class="font-mono font-semibold underline">${escapeHtml(record.outboundOrderNo)}</a></div>` : ''}
  </div>`
}

export function renderPostFinishingRecheckOrderDetailPage(recheckOrderId: string): string {
  const record = getPostFinishingFullFlowRecheckOrder(recheckOrderId)
  const headerActions = record ? `<div class="flex flex-wrap items-center justify-end gap-2">${record.claimedBy?.actorId === currentRechecker().actorId && record.status !== '复检完成' ? `<button type="button" class="inline-flex h-9 items-center rounded-md border border-amber-300 px-3 text-sm text-amber-800" data-post-finishing-recheck-action="release" data-recheck-id="${escapeHtml(record.recheckOrderId)}">退领复检单</button>` : ''}<a data-nav="/fcs/craft/post-finishing/recheck-orders" class="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm">返回复检单列表</a></div>` : `<a data-nav="/fcs/craft/post-finishing/recheck-orders" class="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm">返回复检单列表</a>`
  return `<div class="space-y-4 p-4">${renderPostFinishingPageHeader('复检单详情', '', headerActions)}${message ? `<div role="status" class="rounded-lg border px-4 py-3 text-sm ${messageTone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}">${escapeHtml(message)}</div>` : ''}${record ? renderDetail(record) : '<div class="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">未找到复检单。</div>'}</div>`
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
    const sourceLabel = row.record.sourceType
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
    primaryActionsHtml: '<button type="button" class="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white" data-post-finishing-recheck-action="open-claim" data-skip-page-rerender="true">领取复检单</button>',
    feedbackHtml: message ? `<div role="status" class="rounded-lg border px-4 py-3 text-sm ${messageTone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}">${escapeHtml(message)}</div>` : '',
    filtersHtml: `<form action="/fcs/craft/post-finishing/recheck-orders" class="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-3 xl:grid-cols-5"><label class="text-xs text-muted-foreground md:col-span-2">关键词<input name="keyword" value="${escapeHtml(current.get('keyword') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" placeholder="复检单/质检单/后道加工单/生产单/SKU"/></label><label class="text-xs text-muted-foreground">当前状态<select name="status" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(['待复检','复检中','条码异常待重贴','复检完成'], status)}</select></label><label class="text-xs text-muted-foreground">上游来源<select name="source" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(['质检直达','后道加工后'], source)}</select></label><label class="text-xs text-muted-foreground">工厂<select name="factory" class="mt-1 h-9 w-full rounded-md border px-3 text-sm">${selectOptions(factories, factory)}</select></label><div class="flex items-end justify-end gap-2 md:col-span-3 xl:col-span-5"><a data-nav="/fcs/craft/post-finishing/recheck-orders" class="inline-flex h-9 items-center rounded-md border px-4 text-sm">重置</a><button class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white">查询</button></div></form>`,
    statsHtml: renderStandardListStats([
      { label: '复检单', value: `${allRecords.length} 张` },
      { label: '待复检', value: `${statusCounts['待复检'] || 0} 张` },
      { label: '复检中', value: `${(statusCounts['复检中'] || 0) + (statusCounts['条码异常待重贴'] || 0)} 张` },
      { label: '复检完成', value: `${statusCounts['复检完成'] || 0} 张` },
    ]),
    tableHtml: renderStandardListTable({ columns, rows: slice.rows, preferences, sort: null, eventPrefix: 'post-finishing-recheck-orders', emptyText: '暂无符合条件的复检单。' }),
    paginationHtml: renderTablePagination({ total: slice.total, from: slice.from, to: slice.to, currentPage: slice.currentPage, totalPages: slice.totalPages, pageSize: slice.pageSize, actionPrefix: 'post-finishing-recheck-orders', fieldPrefix: 'post-finishing-recheck-orders' }),
  })
}

export function handlePostFinishingRecheckOrdersEvent(target: HTMLElement, event?: Event): boolean {
  const form = target.closest<HTMLElement>('[data-recheck-web-form]')
  if (form && ['input', 'change'].includes(event?.type || '') && target.closest('[data-recheck-result-field]')) {
    const lines = Array.from(form.querySelectorAll<HTMLElement>('[data-recheck-result-line]'))
    const expected = lines.reduce((sum, line) => sum + Number(line.dataset.expectedQty || 0), 0)
    const actual = lines.reduce((sum, line) => sum
      + Number(line.querySelector<HTMLInputElement>('[data-recheck-result-field="passedQty"]')?.value || 0)
      + Number(line.querySelector<HTMLInputElement>('[data-recheck-result-field="defectQty"]')?.value || 0), 0)
    const summary = form.querySelector<HTMLElement>('[data-recheck-live-summary]')
    if (summary) {
      summary.textContent = `交接 ${expected} 件 · 当前录入 ${actual} 件 · 差异 ${actual - expected} 件`
      summary.className = `mt-4 rounded-lg px-3 py-2 text-sm ${actual === expected ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`
      form.querySelector<HTMLElement>('[data-recheck-authorization]')?.classList.toggle('hidden', actual === expected)
    }
    return true
  }
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
  const actionNode = target.closest<HTMLElement>('[data-post-finishing-recheck-action], [data-post-finishing-action="full-flow-supervisor-release-recheck"]')
  const action = actionNode?.dataset.postFinishingRecheckAction
    || (target.matches('[data-recheck-claim-task-no]') && event?.type === 'keydown' && (event as KeyboardEvent).key === 'Enter' ? 'confirm-claim' : undefined)
    || (actionNode?.dataset.postFinishingAction === 'full-flow-supervisor-release-recheck' ? 'supervisor-release' : undefined)
  if (!action) return false
  try {
    if (action === 'open-claim') {
      openRecheckClaimDialog()
      return true
    }
    if (action === 'close-claim') {
      removeRecheckClaimDialog()
      return true
    }
    if (action === 'confirm-claim') {
      const taskNo = document.querySelector<HTMLInputElement>('[data-recheck-claim-task-no]')?.value.trim() || ''
      const record = claimPostFinishingRecheckOrder({ recheckOrderNo: taskNo, actor: currentRechecker() })
      removeRecheckClaimDialog()
      message = `领取成功：${record.recheckOrderNo}`
      messageTone = 'success'
      appStore.navigate(`/fcs/craft/post-finishing/recheck-orders?id=${encodeURIComponent(record.recheckOrderId)}`)
      return true
    }
    if (action === 'release' || action === 'supervisor-release') {
      const supervisor = action === 'supervisor-release'
      if (!window.confirm(`确认${supervisor ? '由主管释放' : '退领'}该复检单？已录入数量、条码确认和未提交授权数据将全部清空。`)) return true
      const record = releasePostFinishingRecheckOrder({
        recheckOrderId: actionNode?.dataset.recheckId || '',
        actor: supervisor ? POST_FINISHING_ACCEPTANCE_ACTORS.postSupervisor : currentRechecker(),
        reason: supervisor ? '主管释放错误领取' : '复检员退领：错误领取',
        supervisor,
      })
      message = `${record.recheckOrderNo} 已退回待复检，复检数据已清空。`
      messageTone = 'success'
      refresh()
      return true
    }
    if (action === 'relabeled') {
      const record = markPostFinishingRecheckSkuRelabeled({
        recheckOrderId: actionNode?.dataset.recheckId || '',
        skuId: actionNode?.dataset.skuId || '',
        actor: currentRechecker(),
      })
      message = '已记录重新贴码，请将“SKU 条码是否正确”选为“是”后再提交。'
      messageTone = 'success'
      appStore.navigate(`/fcs/craft/post-finishing/recheck-orders?id=${encodeURIComponent(record.recheckOrderId)}&refresh=${Date.now()}`)
      return true
    }
    if (action === 'complete') {
      const root = document.querySelector<HTMLElement>('[data-recheck-web-form]')
      if (!root) throw new Error('未找到 Web 复检表单。')
      const record = getPostFinishingFullFlowRecheckOrder(actionNode?.dataset.recheckId || '')
      if (!record) throw new Error('未找到复检单。')
      const lines = Array.from(root.querySelectorAll<HTMLElement>('[data-recheck-result-line]'))
      const results = lines.map((line) => ({
        skuId: line.dataset.recheckResultLine || '',
        passedQty: Number(line.querySelector<HTMLInputElement>('[data-recheck-result-field="passedQty"]')?.value || 0),
        defectQty: Number(line.querySelector<HTMLInputElement>('[data-recheck-result-field="defectQty"]')?.value || 0),
        barcodeCorrect: line.querySelector<HTMLSelectElement>('[data-recheck-result-field="barcodeCorrect"]')?.value || '',
        expectedQty: Number(line.dataset.expectedQty || 0),
      }))
      if (results.some((line) => !line.barcodeCorrect && line.expectedQty > 0)) throw new Error('每个 SKU 都必须选择条码是否正确。')
      const actor = currentRechecker()
      for (const result of results) {
        const currentLine = record.lines.find((line) => line.sku.skuId === result.skuId)
        if (!currentLine || result.expectedQty <= 0) continue
        if (result.barcodeCorrect === 'no') {
          if (currentLine.barcodeStatus !== '错误待重贴') {
            scanPostFinishingRecheckSkuBarcode({ recheckOrderId: record.recheckOrderId, skuId: result.skuId, scannedBarcode: 'WEB-确认条码错误', actor })
          }
          message = `SKU ${currentLine.sku.skuCode} 条码错误，已阻断出货。请打印正确条码、重新贴码后再复核。`
          messageTone = 'error'
          appStore.navigate(`/fcs/craft/post-finishing/recheck-orders?id=${encodeURIComponent(record.recheckOrderId)}&refresh=${Date.now()}`)
          return true
        }
        if (currentLine.barcodeStatus !== '正确') {
          scanPostFinishingRecheckSkuBarcode({ recheckOrderId: record.recheckOrderId, skuId: result.skuId, scannedBarcode: currentLine.sku.barcode, actor })
        }
      }
      const hasDifference = results.some((line) => line.passedQty + line.defectQty !== line.expectedQty)
      const completed = completePostFinishingRecheckOrderFullFlow({
        recheckOrderId: record.recheckOrderId,
        actor,
        results: results.map(({ skuId, passedQty, defectQty }) => ({ skuId, passedQty, defectQty })),
        authorization: hasDifference ? {
          scanValue: root.querySelector<HTMLTextAreaElement>('[data-recheck-authorization-code]')?.value.trim() || '',
          differenceReason: root.querySelector<HTMLInputElement>('[data-recheck-difference-reason]')?.value.trim() || '',
        } : undefined,
      })
      message = `复检完成，已自动生成后道出货单 ${completed.outboundOrderNo || ''}。`
      messageTone = 'success'
      appStore.navigate(`/fcs/craft/post-finishing/recheck-orders?id=${encodeURIComponent(completed.recheckOrderId)}&refresh=${Date.now()}`)
      return true
    }
  } catch (error) {
    message = error instanceof Error ? error.message : '复检单操作失败。'
    messageTone = 'error'
    if (action === 'confirm-claim') removeRecheckClaimDialog()
  }
  refresh()
  return true
}
