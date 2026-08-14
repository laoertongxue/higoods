// @page-pattern: list
import { hydrateRealQRCodes, renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../../components/ui/process-order-list-controller.ts'
import { normalizeListColumnPreferences } from '../../../components/ui/list-table-model.ts'
import type { StandardListColumn } from '../../../components/ui/list-table.ts'
import {
  completeCutPieceReturnSupplement,
  confirmCutPieceReturnReceipt,
  confirmCutPieceReturnRehandover,
  createCutPieceReturnLargeTicket,
  createCutPieceReturnRekitBatch,
  createCutPieceReturnSupplementPlan,
  getCutPieceReturnCase,
  listCutPieceReturnCases,
  markCutPieceReturnLargeTicketPrinted,
  scrapCutPieceReturnInventory,
  type CutPieceReturnCaseProjection,
  type CutPieceReturnLargeTicket,
} from '../../../data/fcs/cutting/cut-piece-return-domain.ts'
import { escapeHtml } from '../../../utils.ts'

type DialogMode = 'detail' | 'receive' | 'scrap' | 'supplement' | 'rekit' | 'ticket' | 'ticket-print' | null

interface CutPieceReturnPageState {
  filters: {
    keyword: string
    receiptStatus: 'ALL' | CutPieceReturnCaseProjection['receiptStatus']
    dispositionStatus: 'ALL' | CutPieceReturnCaseProjection['dispositionStatus']
  }
  list: ProcessOrderListControllerState
  activeCaseId: string
  dialogMode: DialogMode
  activeTicketId: string
  recognizedPartCodes: string[]
  feedback: { tone: 'success' | 'warning' | 'error'; message: string } | null
  imagePreview: { src: string; alt: string } | null
}

const pagePath = '/fcs/craft/cutting/cut-piece-return-processing'
const eventPrefix = 'cut-piece-return-list'
const preferenceKey = `higood:list-page:${pagePath}`
const pageSizes = [10, 20, 50]
let escapeHandlerInstalled = false

const state: CutPieceReturnPageState = {
  filters: { keyword: '', receiptStatus: 'ALL', dispositionStatus: 'ALL' },
  list: {
    currentPage: 1,
    sort: null,
    preferences: normalizeListColumnPreferences([], null, pageSizes),
    preferencesLoaded: false,
    showColumnSettings: false,
  },
  activeCaseId: '',
  dialogMode: null,
  activeTicketId: '',
  recognizedPartCodes: [],
  feedback: null,
  imagePreview: null,
}

const numberFormatter = new Intl.NumberFormat('zh-CN')

function formatQty(value: number): string {
  return numberFormatter.format(Math.max(Math.round(Number(value || 0)), 0))
}

function toneClass(status: string): string {
  if (/已关闭|已正式交出|已确认|已完成/.test(status)) return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (/待|进行中|补料中/.test(status)) return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function badge(status: string): string {
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass(status)}">${escapeHtml(status)}</span>`
}

function renderImageThumb(src: string, alt: string, label: string): string {
  return `
    <button type="button" class="group relative h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-slate-100" data-skip-page-rerender="true" data-cut-piece-return-action="preview-image" data-image-src="${escapeHtml(src)}" data-image-alt="${escapeHtml(alt)}" aria-label="查看${escapeHtml(label)}大图">
      <span class="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500" data-image-loading>加载中</span>
      <img class="relative h-full w-full object-cover" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" onload="this.previousElementSibling?.remove()" onerror="this.classList.add('hidden');this.previousElementSibling.textContent='图片加载失败'" />
    </button>
  `
}

function renderObjectCell(row: CutPieceReturnCaseProjection): string {
  return `
    <div class="flex min-w-0 gap-2">
      ${renderImageThumb(row.styleImageUrl, row.styleImageAlt, `${row.spuCode} 款式`)}
      ${renderImageThumb(row.materialImageUrl, row.materialImageAlt, `${row.materialSku} 物料`)}
      <div class="min-w-0 leading-5">
        <strong class="block truncate">${escapeHtml(row.spuCode)} · ${escapeHtml(row.styleName)}</strong>
        <span class="block truncate text-xs text-muted-foreground">${escapeHtml(row.materialName)}（${escapeHtml(row.materialAlias)}）</span>
        <span class="block truncate text-xs text-muted-foreground">${escapeHtml(row.garmentColor)} / ${escapeHtml(row.size)}</span>
      </div>
    </div>
  `
}

function renderResponsibilityCell(row: CutPieceReturnCaseProjection): string {
  return `
    <div class="space-y-0.5 text-xs leading-5">
      <strong class="block text-sm">当前应回 ${formatQty(row.responsibility.currentExpectedReturnQty)} 件</strong>
      <span class="block text-muted-foreground">首次 ${formatQty(row.responsibility.frozenMinimumReturnQty)} + 再交出 ${formatQty(row.responsibility.rehandedOverGarmentQty)}</span>
      <span class="block text-muted-foreground">− 已确认退件 ${formatQty(row.responsibility.confirmedReturnedGarmentQty)}</span>
    </div>
  `
}

function renderInventoryCell(row: CutPieceReturnCaseProjection): string {
  return `
    <div class="text-xs leading-5">
      <strong class="block">退裁片库区 ${formatQty(row.returnZoneAvailablePieceQty)} 片</strong>
      <span class="block text-muted-foreground">待交出仓 ${formatQty(row.waitHandoverPieceQty)} 片</span>
      <span class="block text-muted-foreground">已报废 ${formatQty(row.scrappedPieceQty)} 片</span>
    </div>
  `
}

function renderActions(row: CutPieceReturnCaseProjection): string {
  return `
    <div class="flex flex-wrap justify-end gap-1.5">
      <button type="button" class="rounded border px-2 py-1 text-xs hover:bg-muted" data-skip-page-rerender="true" data-cut-piece-return-action="open-detail" data-case-id="${escapeHtml(row.caseId)}">详情</button>
      ${row.receiptStatus !== '已确认退件' ? `<button type="button" class="rounded border border-blue-600 bg-blue-600 px-2 py-1 text-xs text-white" data-skip-page-rerender="true" data-cut-piece-return-action="open-receive" data-case-id="${escapeHtml(row.caseId)}">接收清点</button>` : ''}
      ${row.receiptStatus === '已确认退件' && row.returnZoneAvailablePieceQty > 0 ? `<button type="button" class="rounded border px-2 py-1 text-xs hover:bg-muted" data-skip-page-rerender="true" data-cut-piece-return-action="open-ticket" data-case-id="${escapeHtml(row.caseId)}">快速打大菲票</button>` : ''}
    </div>
  `
}

const columns: StandardListColumn<CutPieceReturnCaseProjection>[] = [
  {
    key: 'returnOrderNo', title: '退仓单', width: 190, required: true, freezeable: true, sortable: true,
    sortValue: (row) => row.returnOrderNo,
    render: (row) => `<div><strong class="block">${escapeHtml(row.returnOrderNo)}</strong><span class="block text-xs text-muted-foreground">${escapeHtml(row.sourceHandoverOrderNo)}</span><span class="block text-xs text-muted-foreground">${escapeHtml(row.sourceHandoverRecordNo)}</span></div>`,
  },
  { key: 'object', title: '款式 / 物料', width: 360, required: true, freezeable: true, render: renderObjectCell },
  {
    key: 'factory', title: '来源车缝工厂', width: 220, sortable: true, sortValue: (row) => row.sourceFactoryName,
    render: (row) => `<div><strong class="block">${escapeHtml(row.sourceFactoryName)}</strong><span class="block text-xs text-muted-foreground">${escapeHtml(row.productionOrderNo)}</span><span class="block text-xs text-muted-foreground">任务 ${escapeHtml(row.sewingTaskId)}</span></div>`,
  },
  { key: 'receipt', title: '接收与清点', width: 180, sortable: true, sortValue: (row) => row.receiptStatus, render: (row) => `<div class="space-y-1">${badge(row.receiptStatus)}<span class="block text-xs text-muted-foreground">已确认 ${formatQty(row.responsibility.confirmedReturnedGarmentQty)} 件</span></div>` },
  { key: 'responsibility', title: '工厂当前应回', width: 260, required: true, freezeable: true, sortable: true, sortValue: (row) => row.responsibility.currentExpectedReturnQty, render: renderResponsibilityCell },
  { key: 'inventory', title: '退裁片库存', width: 210, sortable: true, sortValue: (row) => row.returnZoneAvailablePieceQty, render: renderInventoryCell },
  { key: 'supplement', title: '补料关联', width: 230, render: (row) => row.latestSupplementOrderNos.length ? `<div>${row.latestSupplementOrderNos.map((no) => `<a class="block text-xs text-blue-700 hover:underline" data-nav="/fcs/craft/cutting/supplement-management?recordNo=${encodeURIComponent(no)}">${escapeHtml(no)}</a>`).join('')}</div>` : '<span class="text-xs text-muted-foreground">尚未创建</span>' },
  { key: 'status', title: '后续处理', width: 180, sortable: true, sortValue: (row) => row.dispositionStatus, render: (row) => badge(row.dispositionStatus) },
  { key: 'updatedAt', title: '最近更新', width: 170, sortable: true, sortValue: (row) => row.updatedAt, render: (row) => `<span class="text-xs">${escapeHtml(row.updatedAt)}</span>` },
  { key: 'actions', title: '操作', width: 230, required: true, actionColumn: true, align: 'right', render: renderActions },
]

state.list.preferences = normalizeListColumnPreferences(
  columns.map(({ key, required, freezeable, actionColumn }) => ({ key, required, freezeable, actionColumn })),
  { order: columns.map((column) => column.key), visibleKeys: columns.map((column) => column.key), frozenKeys: ['returnOrderNo'], pageSize: 10 },
  pageSizes,
)

function filteredRows(): CutPieceReturnCaseProjection[] {
  const keyword = state.filters.keyword.trim().toLowerCase()
  return listCutPieceReturnCases()
    .filter((row) => state.filters.receiptStatus === 'ALL' || row.receiptStatus === state.filters.receiptStatus)
    .filter((row) => state.filters.dispositionStatus === 'ALL' || row.dispositionStatus === state.filters.dispositionStatus)
    .filter((row) => !keyword || [row.returnOrderNo, row.sourceHandoverOrderNo, row.productionOrderNo, row.sourceFactoryName, row.spuCode, row.styleName, row.garmentColor, row.size].some((value) => value.toLowerCase().includes(keyword)))
}

const listController = createProcessOrderListController({
  state: state.list,
  columns,
  preferenceKey,
  pageSizeOptions: pageSizes,
  eventPrefix,
  rootSelector: '[data-cut-piece-return-page]',
  tableSurfaceSelector: '[data-cut-piece-return-table]',
  paginationSurfaceSelector: '[data-cut-piece-return-pagination]',
  overlaysSurfaceSelector: '[data-cut-piece-return-list-overlays]',
  defaultFrozenKeys: ['returnOrderNo'],
  columnSettingsTitle: '裁片退仓处理列设置',
  emptyText: '没有符合条件的裁片退仓单。',
  getRows: filteredRows,
  maxFrozenWidth: 560,
  locallyManagedEvents: true,
})

function selectedCase(): CutPieceReturnCaseProjection | null {
  return state.activeCaseId ? getCutPieceReturnCase(state.activeCaseId) : null
}

function renderFeedback(): string {
  if (!state.feedback) return '<div data-cut-piece-return-feedback></div>'
  const colors = state.feedback.tone === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : state.feedback.tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-900'
      : 'border-amber-200 bg-amber-50 text-amber-900'
  return `<div data-cut-piece-return-feedback><div class="flex items-center justify-between rounded-md border px-3 py-2 text-sm ${colors}" role="status"><span>${escapeHtml(state.feedback.message)}</span><button type="button" data-skip-page-rerender="true" data-cut-piece-return-action="dismiss-feedback" aria-label="关闭提示">×</button></div></div>`
}

function renderFilters(): string {
  return `
    <div data-cut-piece-return-filters class="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      <label class="min-w-[300px] flex-1 space-y-1"><span class="block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-skip-page-rerender="true" data-cut-piece-return-field="keyword" value="${escapeHtml(state.filters.keyword)}" placeholder="退仓单 / 交出单 / 生产单 / SPU / 工厂" /></label>
      <label class="space-y-1"><span class="block text-xs text-muted-foreground">接收状态</span><select class="h-9 min-w-40 rounded-md border bg-background px-2 text-sm" data-skip-page-rerender="true" data-cut-piece-return-field="receiptStatus"><option value="ALL">全部</option>${['待接收', '已接收待清点', '已确认退件'].map((value) => `<option value="${value}" ${state.filters.receiptStatus === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
      <label class="space-y-1"><span class="block text-xs text-muted-foreground">后续处理</span><select class="h-9 min-w-44 rounded-md border bg-background px-2 text-sm" data-skip-page-rerender="true" data-cut-piece-return-field="dispositionStatus"><option value="ALL">全部</option>${['待处理', '补料中', '待重新齐套', '已进入待交出仓', '已关闭'].map((value) => `<option value="${value}" ${state.filters.dispositionStatus === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
      <button type="button" class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-skip-page-rerender="true" data-cut-piece-return-action="reset-filters">重置</button>
    </div>
  `
}

function renderStats(rows: CutPieceReturnCaseProjection[]): string {
  return `<div data-cut-piece-return-stats>${renderStandardListStats([
    { label: '退仓单', value: `${rows.length} 单` },
    { label: '当前应回', value: `${formatQty(rows.reduce((sum, row) => sum + row.responsibility.currentExpectedReturnQty, 0))} 件` },
    { label: '退裁片库区', value: `${formatQty(rows.reduce((sum, row) => sum + row.returnZoneAvailablePieceQty, 0))} 片` },
    { label: '待重新齐套 / 待交出', value: `${rows.filter((row) => ['待重新齐套', '已进入待交出仓'].includes(row.dispositionStatus)).length} 单` },
  ])}</div>`
}

function renderPartTable(record: CutPieceReturnCaseProjection): string {
  return `
    <div class="overflow-x-auto rounded-lg border">
      <table class="w-full min-w-[760px] text-sm">
        <thead class="bg-muted/40 text-xs text-muted-foreground"><tr><th class="px-3 py-2 text-left">部位</th><th class="px-3 py-2 text-left">原裁片单</th><th class="px-3 py-2 text-left">旧实物菲票</th><th class="px-3 py-2 text-right">退裁片可用</th><th class="px-3 py-2 text-right">补料到齐</th></tr></thead>
        <tbody>${record.parts.map((part) => {
          const returned = record.inventoryLots.filter((lot) => lot.partCode === part.partCode && lot.sourceType === '三方工厂退回' && lot.warehouseArea === '退裁片库区').reduce((sum, lot) => sum + Math.max(lot.pieceQty - lot.allocatedPieceQty - lot.scrappedPieceQty, 0), 0)
          const supplied = record.inventoryLots.filter((lot) => lot.partCode === part.partCode && lot.sourceType === '补料裁片' && lot.warehouseArea === '退裁片库区').reduce((sum, lot) => sum + Math.max(lot.pieceQty - lot.allocatedPieceQty - lot.scrappedPieceQty, 0), 0)
          return `<tr class="border-t"><td class="px-3 py-2"><strong>${escapeHtml(part.partName)}</strong><span class="ml-2 text-xs text-muted-foreground">${escapeHtml(part.partCode)}</span></td><td class="px-3 py-2 text-xs">${escapeHtml(part.sourceCutOrderNo)}</td><td class="px-3 py-2">${badge(part.oldPhysicalTicketStatus)}</td><td class="px-3 py-2 text-right tabular-nums">${formatQty(returned)} 片</td><td class="px-3 py-2 text-right tabular-nums">${formatQty(supplied)} 片</td></tr>`
        }).join('')}</tbody>
      </table>
    </div>
  `
}

function renderResponsibilityPanel(record: CutPieceReturnCaseProjection): string {
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div class="flex flex-wrap items-start justify-between gap-3"><div><h3 class="font-semibold text-blue-950">车缝工厂当前应回责任</h3><p class="mt-1 text-sm text-blue-900">${escapeHtml(record.responsibility.formulaText)}</p></div><strong class="text-xl text-blue-950">${formatQty(record.responsibility.currentExpectedReturnQty)} 件</strong></div>
      <p class="mt-2 text-xs text-blue-800">部位清点差异只进入报废 / 补料 / 重新齐套处理，不二次扣减工厂应回责任；重新齐套放入待交出仓也不增加责任，只有正式交出后才增加。</p>
    </section>
  `
}

function renderDialogShell(title: string, subtitle: string, body: string, footer = ''): string {
  return `
    <div class="fixed inset-0 z-[140]" data-skip-page-rerender="true" data-cut-piece-return-dialog>
      <button type="button" class="absolute inset-0 bg-black/45" data-cut-piece-return-action="close-dialog" aria-label="关闭"></button>
      <section class="absolute inset-y-4 right-4 flex w-[min(900px,calc(100%-2rem))] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
        <header class="flex items-start justify-between gap-3 border-b px-5 py-4"><div><h2 class="text-lg font-semibold">${escapeHtml(title)}</h2><p class="mt-1 text-sm text-muted-foreground">${escapeHtml(subtitle)}</p></div><button type="button" class="rounded border px-3 py-1.5 text-sm" data-cut-piece-return-action="close-dialog">关闭</button></header>
        <div class="flex-1 space-y-4 overflow-y-auto p-5">${body}</div>
        ${footer ? `<footer class="flex flex-wrap justify-end gap-2 border-t px-5 py-4">${footer}</footer>` : ''}
      </section>
    </div>
  `
}

function renderDetailDialog(record: CutPieceReturnCaseProjection): string {
  const latestPlan = record.supplementPlans.at(-1)
  const waitBatch = record.rekitBatches.find((batch) => batch.stage === '待交出仓')
  return renderDialogShell(
    `${record.returnOrderNo} · 裁片退仓处理`,
    `${record.productionOrderNo} / ${record.garmentColor} / ${record.size}`,
    `
      ${renderResponsibilityPanel(record)}
      <section class="grid gap-3 md:grid-cols-2"><div class="rounded-lg border p-4"><h3 class="font-semibold">来源交出事实</h3><dl class="mt-3 grid grid-cols-[120px_1fr] gap-2 text-sm"><dt class="text-muted-foreground">交出单</dt><dd>${escapeHtml(record.sourceHandoverOrderNo)}</dd><dt class="text-muted-foreground">交出记录</dt><dd>${escapeHtml(record.sourceHandoverRecordNo)}</dd><dt class="text-muted-foreground">冻结放行快照</dt><dd>${escapeHtml(record.frozenReleaseSnapshotId)}</dd><dt class="text-muted-foreground">来源工厂</dt><dd>${escapeHtml(record.sourceFactoryName)}</dd></dl></div><div class="rounded-lg border p-4"><h3 class="font-semibold">库区边界</h3><p class="mt-2 text-sm">退回裁片先进入<strong>裁床待交出仓内独立的退裁片库区</strong>；报废从这里核销。退回裁片与补料裁片完成部位齐套并装入同一新中转袋后，才转为<strong>正常裁床待交出仓库存</strong>。</p></div></section>
      ${renderPartTable(record)}
      <section class="rounded-lg border p-4"><h3 class="font-semibold">接收记录</h3>${record.receipts.length ? record.receipts.map((receipt) => `<div class="mt-3 rounded-md bg-muted/30 p-3 text-sm"><strong>${formatQty(receipt.returnedGarmentQty)} 件</strong><span class="ml-2 text-muted-foreground">${escapeHtml(receipt.confirmedAt)} · ${escapeHtml(receipt.confirmedBy)}</span><p class="mt-1">${escapeHtml(receipt.differenceSummary)}</p></div>`).join('') : '<p class="mt-2 text-sm text-muted-foreground">尚未确认退件。</p>'}</section>
      <section class="rounded-lg border p-4"><div class="flex flex-wrap items-center justify-between gap-2"><div><h3 class="font-semibold">补料与重新齐套</h3><p class="mt-1 text-xs text-muted-foreground">补哪些部位、各补多少片可手动调整；最终补齐件数单独确认。</p></div><a class="text-sm text-blue-700 hover:underline" data-nav="/fcs/craft/cutting/supplement-management">查看补料管理</a></div>${latestPlan ? `<div class="mt-3 text-sm"><p><strong>最终补齐：</strong>${latestPlan.finalMakeupGarmentQty} 件</p><p class="mt-1"><strong>部位：</strong>${latestPlan.partLines.map((line) => `${line.partName} ${line.supplementPieceQty} 片`).join('、')}</p><p class="mt-1"><strong>补料单：</strong>${latestPlan.supplementLinks.map((link) => `${link.supplementOrderNo}（${link.status}）`).join('、')}</p></div>` : '<p class="mt-2 text-sm text-muted-foreground">尚未创建补料计划。</p>'}</section>
      ${waitBatch ? `<section class="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><h3 class="font-semibold">已进入裁床待交出仓</h3><p class="mt-1">中转袋 ${escapeHtml(waitBatch.transferBagCode)} · ${waitBatch.finalGarmentQty} 件 · ${waitBatch.partCounts.reduce((sum, item) => sum + item.pieceQty, 0)} 片。正式交出后才会把 ${waitBatch.finalGarmentQty} 件加回车缝工厂应回责任。</p></section>` : ''}
      <section class="rounded-lg border p-4"><h3 class="font-semibold">操作追溯</h3><div class="mt-3 space-y-2">${record.operationLogs.length ? record.operationLogs.slice().reverse().map((log) => `<div class="grid gap-1 rounded-md bg-muted/30 p-3 text-xs md:grid-cols-[150px_1fr_180px]"><strong>${escapeHtml(log.action)}</strong><div><span class="font-medium">${escapeHtml(log.businessNo)}</span><span class="ml-2">${escapeHtml(log.quantityText)}</span><p class="mt-1 text-muted-foreground">${escapeHtml(log.note)}</p></div><span class="text-muted-foreground">${escapeHtml(log.operatedAt)} · ${escapeHtml(log.operatedBy)}</span></div>`).join('') : '<p class="text-sm text-muted-foreground">暂无操作记录。</p>'}</div></section>
    `,
    `<button type="button" class="rounded border px-4 py-2 text-sm" data-cut-piece-return-action="open-scrap" data-case-id="${escapeHtml(record.caseId)}">报废退裁片</button><button type="button" class="rounded border px-4 py-2 text-sm" data-cut-piece-return-action="open-supplement" data-case-id="${escapeHtml(record.caseId)}">创建补料</button>${latestPlan && !latestPlan.completedAt ? `<button type="button" class="rounded border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm text-white" data-cut-piece-return-action="complete-supplement" data-case-id="${escapeHtml(record.caseId)}" data-plan-id="${escapeHtml(latestPlan.planId)}">模拟补料完成入库</button>` : ''}${record.dispositionStatus === '待重新齐套' ? `<button type="button" class="rounded border border-blue-600 bg-blue-600 px-4 py-2 text-sm text-white" data-cut-piece-return-action="open-rekit" data-case-id="${escapeHtml(record.caseId)}">重新齐套装袋</button>` : ''}${waitBatch ? `<button type="button" class="rounded border border-blue-700 bg-blue-700 px-4 py-2 text-sm text-white" data-cut-piece-return-action="confirm-rehandover" data-case-id="${escapeHtml(record.caseId)}" data-rekit-id="${escapeHtml(waitBatch.rekitBatchId)}">确认正式交出</button>` : ''}`,
  )
}

function renderReceiveDialog(record: CutPieceReturnCaseProjection): string {
  return renderDialogShell(
    '接收、清点并确认退件',
    '先按件接收，再按部位清点，最终按件确认；部位差异不反向修改确认退件数。',
    `${renderResponsibilityPanel(record)}<section class="rounded-lg border p-4"><div class="flex items-start gap-3"><span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-700 text-sm font-semibold text-white">1</span><div><strong>按件接收</strong><p class="mt-1 text-xs text-muted-foreground">登记三方车缝工厂本次送回的件数，作为现场接收对象。</p></div></div><div class="mt-3 grid gap-4 md:grid-cols-2"><label class="space-y-1"><span class="text-sm font-medium">本次接收并最终确认退件（件）</span><input type="number" min="1" max="${record.responsibility.currentExpectedReturnQty}" value="12" class="h-10 w-full rounded-md border px-3" data-cut-piece-return-form="returnedGarmentQty" /></label><label class="space-y-1"><span class="text-sm font-medium">操作人</span><input value="裁床退仓员" class="h-10 w-full rounded-md border px-3" data-cut-piece-return-form="operator" /></label></div></section><section class="rounded-lg border"><div class="border-b bg-muted/30 px-4 py-3"><div class="flex items-start gap-3"><span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-700 text-sm font-semibold text-white">2</span><div><strong>按部位清点（片）</strong><p class="mt-1 text-xs text-muted-foreground">可以扫描旧菲票；实物票缺失时直接按系统已知部位手填数量。部位差异保留，不反向改写件数。</p></div></div></div>${record.parts.map((part) => `<label class="grid grid-cols-[1fr_140px] items-center gap-3 border-b px-4 py-3 last:border-b-0"><span><strong>${escapeHtml(part.partName)}</strong><span class="ml-2 text-xs text-muted-foreground">${escapeHtml(part.partCode)} · ${escapeHtml(part.oldPhysicalTicketStatus)}</span></span><input type="number" min="0" value="12" class="h-9 rounded-md border px-3 text-right" data-cut-piece-return-part-count="${escapeHtml(part.partCode)}" /></label>`).join('')}</section><section class="rounded-lg border border-emerald-200 bg-emerald-50 p-4"><div class="flex items-start gap-3"><span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-sm font-semibold text-white">3</span><div><strong>最终按件确认</strong><p class="mt-1 text-xs text-emerald-900">确认后按件数扣减车缝工厂应回责任；各部位按实际片数进入退裁片库区。</p></div></div></section>`,
    '<button type="button" class="rounded border px-4 py-2 text-sm" data-cut-piece-return-action="close-dialog">取消</button><button type="button" class="rounded border border-blue-600 bg-blue-600 px-4 py-2 text-sm text-white" data-cut-piece-return-action="confirm-receive">确认退件并入退裁片库区</button>',
  )
}

function renderScrapDialog(record: CutPieceReturnCaseProjection): string {
  return renderDialogShell('报废退裁片', '报废只核销退裁片库区库存，不再次改变车缝工厂应回责任。', `<div class="grid gap-4 md:grid-cols-2"><label class="space-y-1"><span class="text-sm font-medium">部位</span><select class="h-10 w-full rounded-md border px-3" data-cut-piece-return-form="scrapPartCode">${record.parts.map((part) => `<option value="${escapeHtml(part.partCode)}">${escapeHtml(part.partName)}</option>`).join('')}</select></label><label class="space-y-1"><span class="text-sm font-medium">报废数量（片）</span><input type="number" min="1" value="1" class="h-10 w-full rounded-md border px-3" data-cut-piece-return-form="scrapQty" /></label></div><label class="block space-y-1"><span class="text-sm font-medium">操作人</span><input value="裁床主管" class="h-10 w-full rounded-md border px-3" data-cut-piece-return-form="operator" /></label><div class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">报废不可撤销，提交前必须确认部位和数量。</div>`, '<button type="button" class="rounded border px-4 py-2 text-sm" data-cut-piece-return-action="close-dialog">取消</button><button type="button" class="rounded border border-red-700 bg-red-700 px-4 py-2 text-sm text-white" data-cut-piece-return-action="confirm-scrap">确认报废</button>')
}

function renderSupplementDialog(record: CutPieceReturnCaseProjection): string {
  return renderDialogShell('创建退仓补料计划', '补哪些部位、补多少片均可手动调整，不受本次退回部位清点数量上限约束；最终补齐件数必须单独明确。', `<div class="grid gap-4 md:grid-cols-2"><label class="space-y-1"><span class="text-sm font-medium">最终补齐件数（件）</span><input type="number" min="1" value="12" class="h-10 w-full rounded-md border px-3" data-cut-piece-return-form="finalMakeupGarmentQty" /></label><label class="space-y-1"><span class="text-sm font-medium">操作人</span><input value="裁床主管" class="h-10 w-full rounded-md border px-3" data-cut-piece-return-form="operator" /></label></div><div class="rounded-lg border"><div class="border-b bg-muted/30 px-4 py-3"><strong>手动补裁部位（片）</strong></div>${record.parts.map((part) => `<label class="grid grid-cols-[1fr_140px] items-center gap-3 border-b px-4 py-3 last:border-b-0"><span><strong>${escapeHtml(part.partName)}</strong><span class="ml-2 text-xs text-muted-foreground">拆分到 ${escapeHtml(part.sourceCutOrderNo)}</span></span><input type="number" min="0" value="${part.partCode === 'BACK' ? '2' : '0'}" class="h-9 rounded-md border px-3 text-right" data-cut-piece-return-supplement-count="${escapeHtml(part.partCode)}" /></label>`).join('')}</div><p class="text-xs text-muted-foreground">如部位来自不同原裁片单，系统会按原裁片单拆成多张补料单，但仍归属于同一退仓补料计划。</p>`, '<button type="button" class="rounded border px-4 py-2 text-sm" data-cut-piece-return-action="close-dialog">取消</button><button type="button" class="rounded border border-blue-600 bg-blue-600 px-4 py-2 text-sm text-white" data-cut-piece-return-action="confirm-supplement">创建并关联补料单</button>')
}

function renderRekitDialog(record: CutPieceReturnCaseProjection): string {
  const latestPlan = record.supplementPlans.at(-1)
  return renderDialogShell('重新齐套并装入新中转袋', '系统按最终件数校验每个必需部位；退裁片与补料裁片可混合齐套，但只能整体移入正常待交出仓。', `${renderPartTable(record)}<div class="grid gap-4 md:grid-cols-3"><label class="space-y-1"><span class="text-sm font-medium">本次最终齐套（件）</span><input type="number" min="1" value="${latestPlan?.finalMakeupGarmentQty || 1}" class="h-10 w-full rounded-md border px-3" data-cut-piece-return-form="rekitGarmentQty" /></label><label class="space-y-1"><span class="text-sm font-medium">新中转袋</span><input value="BAG-RETURN-${escapeHtml(record.returnOrderNo.slice(-3))}" class="h-10 w-full rounded-md border px-3" data-cut-piece-return-form="transferBagCode" /></label><label class="space-y-1"><span class="text-sm font-medium">操作人</span><input value="裁片齐套员" class="h-10 w-full rounded-md border px-3" data-cut-piece-return-form="operator" /></label></div><div class="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">提交后只形成“裁床待交出仓”库存和新中转袋，不增加工厂应回责任；必须在待交出仓正式交出后才增加。</div>`, '<button type="button" class="rounded border px-4 py-2 text-sm" data-cut-piece-return-action="close-dialog">取消</button><button type="button" class="rounded border border-blue-600 bg-blue-600 px-4 py-2 text-sm text-white" data-cut-piece-return-action="confirm-rekit">确认齐套并转待交出仓</button>')
}

function renderTicketDialog(record: CutPieceReturnCaseProjection): string {
  return renderDialogShell('快速确认部位并生成退裁片大菲票', '有旧票先扫描；旧票缺失时可按系统已知部位快速选择。大菲票一次覆盖当前选择的多个部位。', `<div class="flex gap-2"><input class="h-10 flex-1 rounded-md border px-3" data-cut-piece-return-form="partScan" placeholder="扫描旧菲票号 / 输入部位码或部位名称" /><button type="button" class="rounded border px-4 text-sm" data-cut-piece-return-action="recognize-part">识别部位</button><button type="button" class="rounded border px-4 text-sm" data-cut-piece-return-action="select-all-parts">全选可用部位</button></div><div class="rounded-lg border">${record.parts.map((part) => { const checked = state.recognizedPartCodes.includes(part.partCode); return `<label class="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0"><span><strong>${escapeHtml(part.partName)}</strong><span class="ml-2 text-xs text-muted-foreground">${escapeHtml(part.oldFeiTicketNo)} · ${escapeHtml(part.oldPhysicalTicketStatus)}</span></span><input type="checkbox" value="${escapeHtml(part.partCode)}" data-cut-piece-return-ticket-part ${checked ? 'checked' : ''} /></label>` }).join('')}</div><label class="block space-y-1"><span class="text-sm font-medium">制票人</span><input value="裁床退仓员" class="h-10 w-full rounded-md border px-3" data-cut-piece-return-form="operator" /></label>`, '<button type="button" class="rounded border px-4 py-2 text-sm" data-cut-piece-return-action="close-dialog">取消</button><button type="button" class="rounded border border-blue-600 bg-blue-600 px-4 py-2 text-sm text-white" data-cut-piece-return-action="create-large-ticket">生成大菲票</button>')
}

function renderLargeTicketPrint(record: CutPieceReturnCaseProjection, ticket: CutPieceReturnLargeTicket): string {
  const qrValue = JSON.stringify({ type: 'CUT_PIECE_RETURN_LARGE_TICKET', caseId: record.caseId, ticketNo: ticket.ticketNo, partLines: ticket.partLines })
  return renderDialogShell('退裁片大菲票打印预览', `${ticket.ticketNo} · 固定 100mm × 100mm`, `<style>@media print{body *{visibility:hidden!important}[data-cut-piece-return-print-sheet],[data-cut-piece-return-print-sheet] *{visibility:visible!important}[data-cut-piece-return-print-sheet]{position:absolute!important;left:0;top:0;margin:0!important;box-shadow:none!important}}</style><div class="mx-auto h-[100mm] w-[100mm] max-w-full border border-black bg-white p-[2mm] text-black shadow" data-cut-piece-return-print-sheet><div class="border border-black"><div class="border-b border-black p-[2mm] text-xl font-black">退裁片大菲票 · ${escapeHtml(record.returnOrderNo)}</div><div class="grid grid-cols-[1fr_32mm]"><div class="grid grid-cols-2 text-xs"><div class="border-b border-r border-black p-[1.5mm]"><span class="block text-[8px]">生产单</span><strong>${escapeHtml(record.productionOrderNo)}</strong></div><div class="border-b border-r border-black p-[1.5mm]"><span class="block text-[8px]">SPU / 色码</span><strong>${escapeHtml(record.spuCode)} · ${escapeHtml(record.garmentColor)} / ${escapeHtml(record.size)}</strong></div><div class="col-span-2 border-b border-r border-black p-[1.5mm]"><span class="block text-[8px]">面料</span><strong>${escapeHtml(record.materialName)}（${escapeHtml(record.materialAlias)}） · ${escapeHtml(record.materialColor)}</strong></div><div class="col-span-2 border-b border-r border-black p-[1.5mm]"><span class="block text-[8px]">包含部位</span>${ticket.partLines.map((line) => `<strong class="mr-3 inline-block">${escapeHtml(line.partName)} ${formatQty(line.pieceQty)} 片</strong>`).join('')}</div><div class="border-b border-r border-black p-[1.5mm]"><span class="block text-[8px]">退裁片库区</span><strong>RETURN-A</strong></div><div class="border-b border-r border-black p-[1.5mm]"><span class="block text-[8px]">大菲票号</span><strong>${escapeHtml(ticket.ticketNo)}</strong></div><div class="col-span-2 border-r border-black p-[1.5mm]"><span class="block text-[8px]">来源</span><strong>${escapeHtml(record.sourceFactoryName)} / ${escapeHtml(record.sourceHandoverOrderNo)}</strong></div></div><aside class="flex flex-col items-center justify-center gap-2 p-[1.5mm] text-center">${renderRealQrPlaceholder({ value: qrValue, size: 112, title: '退裁片大菲票二维码', label: ticket.ticketNo })}<strong class="text-[10px]">扫码查看退仓部位</strong></aside></div></div></div>`, '<button type="button" class="rounded border px-4 py-2 text-sm" data-cut-piece-return-action="close-dialog">关闭</button><button type="button" class="rounded border border-blue-600 bg-blue-600 px-4 py-2 text-sm text-white" data-cut-piece-return-action="print-large-ticket">打印大菲票</button>')
}

function renderOverlays(): string {
  const record = selectedCase()
  const dialog = !record || !state.dialogMode
    ? ''
    : state.dialogMode === 'detail' ? renderDetailDialog(record)
      : state.dialogMode === 'receive' ? renderReceiveDialog(record)
        : state.dialogMode === 'scrap' ? renderScrapDialog(record)
          : state.dialogMode === 'supplement' ? renderSupplementDialog(record)
            : state.dialogMode === 'rekit' ? renderRekitDialog(record)
              : state.dialogMode === 'ticket' ? renderTicketDialog(record)
                : state.dialogMode === 'ticket-print'
                  ? (() => { const ticket = record.largeTickets.find((item) => item.ticketId === state.activeTicketId); return ticket ? renderLargeTicketPrint(record, ticket) : '' })()
                  : ''
  const image = state.imagePreview ? `<div class="fixed inset-0 z-[170] flex items-center justify-center bg-black/75 p-4" data-skip-page-rerender="true" data-cut-piece-return-image-preview><button type="button" class="absolute inset-0" data-cut-piece-return-action="close-image-preview" aria-label="关闭大图"></button><div class="relative max-h-[92vh] max-w-[92vw]"><img src="${escapeHtml(state.imagePreview.src)}" alt="${escapeHtml(state.imagePreview.alt)}" class="max-h-[88vh] max-w-[88vw] object-contain" onerror="this.classList.add('hidden');this.nextElementSibling.classList.remove('hidden')" /><div class="hidden rounded bg-white p-8 text-sm text-red-700">图片加载失败，请关闭后核对素材。</div><button type="button" class="absolute -right-3 -top-3 h-9 w-9 rounded-full bg-white text-xl shadow" data-cut-piece-return-action="close-image-preview" aria-label="关闭大图">×</button></div></div>` : ''
  return `${listController.renderColumnSettings()}${dialog}${image}`
}

export function renderCraftCuttingCutPieceReturnProcessingPage(): string {
  const rows = filteredRows()
  const view = listController.getView()
  if (typeof document !== 'undefined') queueMicrotask(() => {
    listController.installColumnDragEvents()
    ensureEscapeHandler()
  })
  return `<div data-cut-piece-return-page>${renderStandardListPage({
    title: '裁片退仓处理',
    primaryActionsHtml: '<a class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-nav="/fcs/craft/cutting/warehouse-management/wait-handover">查看裁床待交出仓</a>',
    feedbackHtml: renderFeedback(),
    filtersHtml: renderFilters(),
    statsHtml: renderStats(rows),
    listTitle: '三方车缝工厂退回裁片',
    listActionsHtml: '<button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-skip-page-rerender="true" data-cut-piece-return-list-action="open-column-settings">列设置</button>',
    tableHtml: `<div data-cut-piece-return-table>${view.tableHtml}</div>`,
    paginationHtml: `<div data-cut-piece-return-pagination>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-cut-piece-return-list-overlays>${renderOverlays()}</div>`,
  })}</div>`
}

function refreshCutPieceReturnList(): void {
  listController.refresh()
  const stats = document.querySelector<HTMLElement>('[data-cut-piece-return-stats]')
  if (stats) stats.outerHTML = renderStats(filteredRows())
}

function refreshCutPieceReturnFilters(): void {
  const filters = document.querySelector<HTMLElement>('[data-cut-piece-return-filters]')
  if (filters) filters.outerHTML = renderFilters()
}

function refreshCutPieceReturnFeedback(): void {
  const feedback = document.querySelector<HTMLElement>('[data-cut-piece-return-feedback]')
  if (feedback) feedback.outerHTML = renderFeedback()
}

function refreshCutPieceReturnOverlays(): void {
  const overlays = document.querySelector<HTMLElement>('[data-cut-piece-return-list-overlays]')
  if (!overlays) return
  overlays.innerHTML = renderOverlays()
  hydrateRealQRCodes(overlays)
}

function refreshAfterBusinessMutation(): void {
  refreshCutPieceReturnList()
  refreshCutPieceReturnFeedback()
  refreshCutPieceReturnOverlays()
}

function ensureEscapeHandler(): void {
  if (escapeHandlerInstalled || typeof document === 'undefined') return
  escapeHandlerInstalled = true
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !document.querySelector('[data-cut-piece-return-page]')) return
    if (state.imagePreview) state.imagePreview = null
    else if (state.dialogMode) {
      state.dialogMode = null
      state.activeTicketId = ''
    } else return
    refreshCutPieceReturnOverlays()
  })
}

function formValue(field: string): string {
  return document.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-cut-piece-return-form="${field}"]`)?.value.trim() || ''
}

function openDialog(caseId: string, mode: Exclude<DialogMode, null>): void {
  state.activeCaseId = caseId
  state.dialogMode = mode
  state.activeTicketId = ''
  state.recognizedPartCodes = []
  state.feedback = null
}

function setError(error: unknown): void {
  state.feedback = { tone: 'error', message: error instanceof Error ? error.message : String(error) }
}

export function handleCraftCuttingCutPieceReturnProcessingEvent(eventTarget: EventTarget | null, event?: Event): boolean {
  const target = eventTarget instanceof Element ? eventTarget : null
  if (!target) return false
  const filterField = target.closest<HTMLInputElement | HTMLSelectElement>('[data-cut-piece-return-field]')
  if (filterField && (event?.type === 'input' || event?.type === 'change')) {
    const field = filterField.dataset.cutPieceReturnField as keyof CutPieceReturnPageState['filters']
    ;(state.filters as Record<string, string>)[field] = filterField.value
    state.list.currentPage = 1
    refreshCutPieceReturnList()
    return true
  }
  const pageField = target.closest<HTMLSelectElement>('[data-cut-piece-return-list-field="pageSize"]')
  if (pageField && event?.type === 'change') {
    listController.setPageSize(Number(pageField.value))
    refreshCutPieceReturnList()
    return true
  }
  const listAction = target.closest<HTMLElement>('[data-cut-piece-return-list-action]')
  if (listAction) {
    const action = listAction.dataset.cutPieceReturnListAction || ''
    if (action === 'open-column-settings') state.list.showColumnSettings = true
    else if (action === 'close-column-settings') state.list.showColumnSettings = false
    else if (action === 'restore-column-settings') listController.restorePreferences()
    else if (action === 'prev-page') listController.stepPage(-1)
    else if (action === 'next-page') listController.stepPage(1)
    else if (action === 'sort-column') listController.cycleSort(listAction.dataset.columnKey || '')
    else if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') listController.updateColumnPreference(action, listAction.dataset.cutPieceReturnListColumnKey || listAction.dataset.columnKey || '', listAction instanceof HTMLInputElement ? listAction.checked : undefined)
    refreshCutPieceReturnList()
    refreshCutPieceReturnOverlays()
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-cut-piece-return-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.cutPieceReturnAction || ''
  const caseId = actionNode.dataset.caseId || state.activeCaseId
  if (action === 'dismiss-feedback') { state.feedback = null; refreshCutPieceReturnFeedback(); return true }
  if (action === 'reset-filters') { state.filters = { keyword: '', receiptStatus: 'ALL', dispositionStatus: 'ALL' }; state.list.currentPage = 1; refreshCutPieceReturnFilters(); refreshCutPieceReturnList(); return true }
  if (action === 'close-dialog') { state.dialogMode = null; state.activeTicketId = ''; refreshCutPieceReturnOverlays(); return true }
  if (action === 'preview-image') { state.imagePreview = { src: actionNode.dataset.imageSrc || '', alt: actionNode.dataset.imageAlt || '业务图片' }; refreshCutPieceReturnOverlays(); return true }
  if (action === 'close-image-preview') { state.imagePreview = null; refreshCutPieceReturnOverlays(); return true }
  if (action === 'open-detail') { openDialog(caseId, 'detail'); refreshCutPieceReturnOverlays(); return true }
  if (action === 'open-receive') { openDialog(caseId, 'receive'); refreshCutPieceReturnOverlays(); return true }
  if (action === 'open-scrap') { openDialog(caseId, 'scrap'); refreshCutPieceReturnOverlays(); return true }
  if (action === 'open-supplement') { openDialog(caseId, 'supplement'); refreshCutPieceReturnOverlays(); return true }
  if (action === 'open-rekit') { openDialog(caseId, 'rekit'); refreshCutPieceReturnOverlays(); return true }
  if (action === 'open-ticket') { openDialog(caseId, 'ticket'); refreshCutPieceReturnOverlays(); return true }
  try {
    if (action === 'confirm-receive') {
      const record = selectedCase()!
      confirmCutPieceReturnReceipt({ caseId: record.caseId, returnedGarmentQty: Number(formValue('returnedGarmentQty')), partCounts: record.parts.map((part) => ({ partCode: part.partCode, pieceQty: Number(document.querySelector<HTMLInputElement>(`[data-cut-piece-return-part-count="${part.partCode}"]`)?.value || 0) })), confirmedBy: formValue('operator') })
      state.dialogMode = 'detail'
      state.feedback = { tone: 'success', message: '已按件确认退件，并按部位片数写入退裁片库区；部位差异已保留。' }
      refreshAfterBusinessMutation()
      return true
    }
    if (action === 'confirm-scrap') {
      if (typeof window !== 'undefined' && !window.confirm('确认从退裁片库区报废并永久核销该数量吗？')) return true
      scrapCutPieceReturnInventory({ caseId: state.activeCaseId, partCode: formValue('scrapPartCode'), pieceQty: Number(formValue('scrapQty')), operatedBy: formValue('operator') })
      state.dialogMode = 'detail'
      state.feedback = { tone: 'success', message: '报废数量已从退裁片库区核销，车缝工厂应回责任未被二次扣减。' }
      refreshAfterBusinessMutation()
      return true
    }
    if (action === 'confirm-supplement') {
      const record = selectedCase()!
      createCutPieceReturnSupplementPlan({ caseId: record.caseId, finalMakeupGarmentQty: Number(formValue('finalMakeupGarmentQty')), partLines: record.parts.map((part) => ({ partCode: part.partCode, supplementPieceQty: Number(document.querySelector<HTMLInputElement>(`[data-cut-piece-return-supplement-count="${part.partCode}"]`)?.value || 0) })), createdBy: formValue('operator') })
      state.dialogMode = 'detail'
      state.feedback = { tone: 'success', message: '已按原裁片单拆分并关联补料单；补裁部位和数量采用本次手动确认值。' }
      refreshAfterBusinessMutation()
      return true
    }
    if (action === 'complete-supplement') {
      completeCutPieceReturnSupplement({ caseId, planId: actionNode.dataset.planId || '', completedBy: '补料完成员' })
      state.dialogMode = 'detail'
      state.feedback = { tone: 'success', message: '补料裁片已完成并进入退裁片库区，现可与原退回裁片重新齐套。' }
      refreshAfterBusinessMutation()
      return true
    }
    if (action === 'confirm-rekit') {
      createCutPieceReturnRekitBatch({ caseId: state.activeCaseId, finalGarmentQty: Number(formValue('rekitGarmentQty')), transferBagCode: formValue('transferBagCode'), createdBy: formValue('operator') })
      state.dialogMode = 'detail'
      state.feedback = { tone: 'success', message: '退回裁片与补料裁片已按部位齐套装入新中转袋并转入裁床待交出仓。' }
      refreshAfterBusinessMutation()
      return true
    }
    if (action === 'confirm-rehandover') {
      if (typeof window !== 'undefined' && !window.confirm('确认该中转袋已从裁床待交出仓正式交给车缝工厂吗？正式交出后将增加工厂应回责任。')) return true
      confirmCutPieceReturnRehandover({ caseId, rekitBatchId: actionNode.dataset.rekitId || '', handedOverBy: '交出仓管' })
      state.dialogMode = 'detail'
      state.feedback = { tone: 'success', message: '已形成正式再交出记录，本次齐套件数已加回车缝工厂当前应回责任。' }
      refreshAfterBusinessMutation()
      return true
    }
    if (action === 'recognize-part') {
      const record = selectedCase()!
      const keyword = formValue('partScan').toLowerCase()
      const part = record.parts.find((item) => [item.partCode, item.partName, item.oldFeiTicketNo].some((value) => value.toLowerCase().includes(keyword)))
      if (!part || !keyword) throw new Error('未识别到本退仓单部位，请检查菲票号或直接点选部位。')
      state.recognizedPartCodes = [...new Set([...state.recognizedPartCodes, part.partCode])]
      state.feedback = { tone: 'success', message: `已识别部位：${part.partName}。` }
      refreshCutPieceReturnFeedback()
      refreshCutPieceReturnOverlays()
      return true
    }
    if (action === 'select-all-parts') {
      state.recognizedPartCodes = selectedCase()!.parts.map((part) => part.partCode)
      refreshCutPieceReturnOverlays()
      return true
    }
    if (action === 'create-large-ticket') {
      const selected = Array.from(document.querySelectorAll<HTMLInputElement>('[data-cut-piece-return-ticket-part]:checked')).map((item) => item.value)
      const updated = createCutPieceReturnLargeTicket({ caseId: state.activeCaseId, partCodes: selected, createdBy: formValue('operator') })
      const ticket = updated.largeTickets.at(-1)!
      state.activeTicketId = ticket.ticketId
      state.dialogMode = 'ticket-print'
      state.feedback = { tone: 'success', message: '已生成退裁片大菲票，可直接打印；无需依赖旧实物菲票。' }
      refreshAfterBusinessMutation()
      return true
    }
    if (action === 'print-large-ticket') {
      markCutPieceReturnLargeTicketPrinted({ caseId: state.activeCaseId, ticketId: state.activeTicketId })
      refreshAfterBusinessMutation()
      if (typeof window !== 'undefined') window.print()
      return true
    }
  } catch (error) {
    setError(error)
    refreshCutPieceReturnFeedback()
    refreshCutPieceReturnOverlays()
    return true
  }
  return false
}

export function enterCraftCuttingCutPieceReturnProcessingRoute(): void {
  if (typeof document !== 'undefined' && document.querySelector('[data-cut-piece-return-page]')) return
  state.list.currentPage = 1
  state.list.sort = null
  const requestedCaseId = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('caseId') || ''
  state.activeCaseId = getCutPieceReturnCase(requestedCaseId)?.caseId || ''
  state.dialogMode = state.activeCaseId ? 'detail' : null
  state.imagePreview = null
  state.feedback = null
}
