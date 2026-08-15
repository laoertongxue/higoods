// @page-pattern: list
import { hydrateRealQRCodes, renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../../components/ui/process-order-list-controller.ts'
import { normalizeListColumnPreferences } from '../../../components/ui/list-table-model.ts'
import type { StandardListColumn } from '../../../components/ui/list-table.ts'
import {
  confirmCutPieceReturnReceipt,
  createAndConfirmCutPieceReturn,
  createCutPieceReturnLargeTicket,
  createCutPieceReturnSupplementPlan,
  findCutPieceReturnSources,
  getCutPieceReturnCase,
  listCutPieceReturnFactoriesByProductionOrder,
  listCutPieceReturnInitiationCandidates,
  listCutPieceReturnCases,
  markCutPieceReturnLargeTicketPrinted,
  scrapCutPieceReturnInventory,
  type CutPieceReturnCaseProjection,
  type CutPieceReturnIdentificationMode,
  type CutPieceReturnLargeTicket,
  type CutPieceReturnInitiationCandidate,
  type CutPieceReturnLookupMode,
  type CutPieceReturnPhysicalTicketStatus,
  type CutPieceReturnSourceFactoryOption,
} from '../../../data/fcs/cutting/cut-piece-return-domain.ts'
import { escapeHtml } from '../../../utils.ts'

type DialogMode = 'create' | 'detail' | 'receive' | 'scrap' | 'supplement' | 'ticket' | 'ticket-print' | null

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
  recognizedPartKeys: string[]
  createLookupMode: CutPieceReturnLookupMode
  createQuery: {
    sewingTaskNo: string
    productionOrderNo: string
    factoryId: string
    feiTicketNo: string
  }
  createFactoryOptions: CutPieceReturnSourceFactoryOption[]
  createResults: CutPieceReturnInitiationCandidate[]
  createSelectedCandidateId: string
  createHasSearched: boolean
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
  recognizedPartKeys: [],
  createLookupMode: 'SEWING_TASK',
  createQuery: { sewingTaskNo: '', productionOrderNo: '', factoryId: '', feiTicketNo: '' },
  createFactoryOptions: [],
  createResults: [],
  createSelectedCandidateId: '',
  createHasSearched: false,
  feedback: null,
  imagePreview: null,
}

const numberFormatter = new Intl.NumberFormat('zh-CN')

function formatQty(value: number): string {
  return numberFormatter.format(Math.max(Math.round(Number(value || 0)), 0))
}

function toneClass(status: string): string {
  if (/已报废关闭|已转补料|已确认|已完成/.test(status)) return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (/待|未完成/.test(status)) return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function badge(status: string): string {
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass(status)}">${escapeHtml(status)}</span>`
}

function renderImageThumb(src: string, alt: string, label: string): string {
  return `
    <button type="button" class="group relative h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-slate-100" data-skip-page-rerender="true" data-cut-piece-return-action="preview-image" data-image-src="${escapeHtml(src)}" data-image-alt="${escapeHtml(alt)}" aria-label="查看${escapeHtml(label)}大图">
      <span class="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500" data-image-loading>加载中</span>
      <img class="relative h-full w-full object-cover" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" onload="this.previousElementSibling?.classList.add('hidden')" onerror="this.classList.add('hidden');if(this.previousElementSibling){this.previousElementSibling.classList.remove('hidden');this.previousElementSibling.textContent='图片加载失败'}" />
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
      <span class="block text-muted-foreground">首次 ${formatQty(row.responsibility.frozenMinimumReturnQty)} + 后续正式交出 ${formatQty(row.responsibility.laterFormalHandoverGarmentQty)}</span>
      <span class="block text-muted-foreground">− 已确认退件 ${formatQty(row.responsibility.confirmedReturnedGarmentQty)}</span>
    </div>
  `
}

function renderInventoryCell(row: CutPieceReturnCaseProjection): string {
  return `
    <div class="text-xs leading-5">
      <strong class="block">退裁片库区 ${formatQty(row.returnZoneAvailablePieceQty)} 片</strong>
      <span class="block text-muted-foreground">已转补料 ${formatQty(row.transferredToSupplementPieceQty)} 片</span>
      <span class="block text-muted-foreground">已报废 ${formatQty(row.scrappedPieceQty)} 片</span>
    </div>
  `
}

function renderActions(row: CutPieceReturnCaseProjection): string {
  const canDispose = row.receiptStatus === '已确认退件' && !row.settlementType && row.returnZoneAvailablePieceQty > 0
  return `
    <div class="flex flex-wrap justify-end gap-1.5">
      <button type="button" class="rounded border px-2 py-1 text-xs hover:bg-muted" data-skip-page-rerender="true" data-cut-piece-return-action="open-detail" data-case-id="${escapeHtml(row.caseId)}">详情</button>
      ${row.receiptStatus !== '已确认退件' ? `<button type="button" class="rounded border border-blue-600 bg-blue-600 px-2 py-1 text-xs text-white" data-skip-page-rerender="true" data-cut-piece-return-action="open-receive" data-case-id="${escapeHtml(row.caseId)}">接收清点</button>` : ''}
      ${canDispose ? `<button type="button" class="rounded border px-2 py-1 text-xs hover:bg-muted" data-skip-page-rerender="true" data-cut-piece-return-action="open-ticket" data-case-id="${escapeHtml(row.caseId)}">快速打大菲票</button>` : ''}
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
  { key: 'supplement', title: '补料关联', width: 250, render: (row) => row.latestSupplementStatuses.length ? `<div class="space-y-1">${row.latestSupplementStatuses.map((item) => `<a class="flex items-center justify-between gap-2 text-xs text-blue-700 hover:underline" data-nav="/fcs/craft/cutting/supplement-management?recordNo=${encodeURIComponent(item.supplementOrderNo)}"><span>${escapeHtml(item.supplementOrderNo)}</span>${badge(item.status)}</a>`).join('')}</div>` : '<span class="text-xs text-muted-foreground">尚未创建</span>' },
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
    .filter((row) => !keyword || [
      row.returnOrderNo,
      row.sourceHandoverOrderNo,
      ...row.sourceHandoverRecordNos,
      row.productionOrderNo,
      row.sewingTaskId,
      row.sourceFactoryName,
      row.spuCode,
      row.styleName,
      row.garmentColor,
      row.size,
      ...row.parts.flatMap((part) => [part.sourceCutOrderNo, ...part.historicalTicketNos]),
    ].some((value) => value.toLowerCase().includes(keyword)))
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
      <label class="min-w-[300px] flex-1 space-y-1"><span class="block text-xs text-muted-foreground">搜索</span><input class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-skip-page-rerender="true" data-cut-piece-return-field="keyword" value="${escapeHtml(state.filters.keyword)}" placeholder="退仓单 / 车缝任务 / 菲票 / 裁片单 / 生产单 / 工厂" /></label>
      <label class="space-y-1"><span class="block text-xs text-muted-foreground">接收状态</span><select class="h-9 min-w-40 rounded-md border bg-background px-2 text-sm" data-skip-page-rerender="true" data-cut-piece-return-field="receiptStatus"><option value="ALL">全部</option>${['待接收', '已确认退件'].map((value) => `<option value="${value}" ${state.filters.receiptStatus === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
      <label class="space-y-1"><span class="block text-xs text-muted-foreground">后续处理</span><select class="h-9 min-w-44 rounded-md border bg-background px-2 text-sm" data-skip-page-rerender="true" data-cut-piece-return-field="dispositionStatus"><option value="ALL">全部</option>${['待处理', '已转补料', '已报废关闭'].map((value) => `<option value="${value}" ${state.filters.dispositionStatus === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
      <button type="button" class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-skip-page-rerender="true" data-cut-piece-return-action="reset-filters">重置</button>
    </div>
  `
}

function renderStats(rows: CutPieceReturnCaseProjection[]): string {
  return `<div data-cut-piece-return-stats>${renderStandardListStats([
    { label: '退仓单', value: `${rows.length} 单` },
    { label: '当前应回', value: `${formatQty(rows.reduce((sum, row) => sum + row.responsibility.currentExpectedReturnQty, 0))} 件` },
    { label: '退裁片库区', value: `${formatQty(rows.reduce((sum, row) => sum + row.returnZoneAvailablePieceQty, 0))} 片` },
    { label: '待处理', value: `${rows.filter((row) => row.dispositionStatus === '待处理').length} 单` },
  ])}</div>`
}

function renderPartTable(record: CutPieceReturnCaseProjection): string {
  return `
    <div class="overflow-x-auto rounded-lg border">
      <table class="w-full min-w-[860px] text-sm">
        <thead class="bg-muted/40 text-xs text-muted-foreground"><tr><th class="px-3 py-2 text-left">部位</th><th class="px-3 py-2 text-left">原裁片单</th><th class="px-3 py-2 text-left">历史来源菲票</th><th class="px-3 py-2 text-left">本次实物票证据</th><th class="px-3 py-2 text-right">退裁片可用</th><th class="px-3 py-2 text-right">已转补料</th><th class="px-3 py-2 text-right">已报废</th></tr></thead>
        <tbody>${record.parts.map((part) => {
          const lots = record.inventoryLots.filter((lot) => lot.partCode === part.partCode && lot.sourceCutOrderId === part.sourceCutOrderId)
          const available = lots.reduce((sum, lot) => sum + Math.max(lot.pieceQty - lot.transferredPieceQty - lot.scrappedPieceQty, 0), 0)
          const transferred = lots.reduce((sum, lot) => sum + lot.transferredPieceQty, 0)
          const scrapped = lots.reduce((sum, lot) => sum + lot.scrappedPieceQty, 0)
          const receiptEvidence = record.receipts.flatMap((receipt) => receipt.partCounts).find((item) => item.partCode === part.partCode && item.sourceCutOrderId === part.sourceCutOrderId)
          const evidenceText = !receiptEvidence
            ? '尚未清点'
            : receiptEvidence.identificationMode === 'SCAN_OLD_TICKET'
              ? `已扫码 · ${receiptEvidence.scannedTicketNo}`
              : receiptEvidence.physicalTicketStatus === 'UNREADABLE' ? '票据不可识别 · 手动选部位' : '未带实物票 · 手动选部位'
          return `<tr class="border-t"><td class="px-3 py-2"><strong>${escapeHtml(part.partName)}</strong><span class="ml-2 text-xs text-muted-foreground">${escapeHtml(part.partCode)}</span></td><td class="px-3 py-2 text-xs">${escapeHtml(part.sourceCutOrderNo)}</td><td class="px-3 py-2 text-xs">${part.historicalTicketExists ? `系统有记录 · ${part.historicalTicketNos.map(escapeHtml).join('、')}` : '系统无历史票号'}</td><td class="px-3 py-2 text-xs">${escapeHtml(evidenceText)}</td><td class="px-3 py-2 text-right tabular-nums">${formatQty(available)} 片</td><td class="px-3 py-2 text-right tabular-nums">${formatQty(transferred)} 片</td><td class="px-3 py-2 text-right tabular-nums">${formatQty(scrapped)} 片</td></tr>`
        }).join('')}</tbody>
      </table>
    </div>
  `
}

function renderResponsibilityPanel(record: CutPieceReturnCaseProjection): string {
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div class="flex flex-wrap items-start justify-between gap-3"><div><h3 class="font-semibold text-blue-950">车缝工厂当前应回责任</h3><p class="mt-1 text-sm text-blue-900">${escapeHtml(record.responsibility.formulaText)}</p></div><strong class="text-xl text-blue-950">${formatQty(record.responsibility.currentExpectedReturnQty)} 件</strong></div>
      <p class="mt-2 text-xs text-blue-800">部位清点差异只进入报废或补料处理，不二次扣减工厂应回责任；创建退仓、报废、创建或完成补料都不增加责任，只有普通交出流程形成新的正式交出后才增加。</p>
    </section>
  `
}

function renderDialogShell(title: string, subtitle: string, body: string, footer = ''): string {
  return `
    <div class="fixed inset-0 z-[140]" data-skip-page-rerender="true" data-cut-piece-return-dialog>
      <button type="button" class="absolute inset-0 bg-black/45" data-cut-piece-return-action="close-dialog" aria-label="关闭"></button>
      <section class="absolute inset-y-4 right-4 flex w-[min(900px,calc(100%-2rem))] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl">
        <header class="flex items-start justify-between gap-3 border-b px-5 py-4"><div><h2 class="text-lg font-semibold">${escapeHtml(title)}</h2><p class="mt-1 text-sm text-muted-foreground">${escapeHtml(subtitle)}</p></div><button type="button" class="rounded border px-3 py-1.5 text-sm" data-cut-piece-return-action="close-dialog">关闭</button></header>
        <div class="flex-1 space-y-4 overflow-y-auto p-5">${renderFeedback()}${body}</div>
        ${footer ? `<footer class="flex flex-wrap justify-end gap-2 border-t px-5 py-4">${footer}</footer>` : ''}
      </section>
    </div>
  `
}

function partKey(part: CutPieceReturnCaseProjection['parts'][number]): string {
  return `${part.sourceCutOrderId}::${part.partCode}`
}

function partAvailableQty(record: CutPieceReturnCaseProjection, sourceCutOrderId: string, partCode: string): number {
  return record.inventoryLots
    .filter((lot) => lot.sourceCutOrderId === sourceCutOrderId && lot.partCode === partCode && lot.warehouseArea === '退裁片库区')
    .reduce((sum, lot) => sum + Math.max(lot.pieceQty - lot.transferredPieceQty - lot.scrappedPieceQty, 0), 0)
}

function selectedCreateCandidate(): CutPieceReturnInitiationCandidate | null {
  return state.createResults.find((candidate) => candidate.candidateId === state.createSelectedCandidateId) ?? null
}

function resetCreateFlow(): void {
  state.createLookupMode = 'SEWING_TASK'
  state.createQuery = { sewingTaskNo: '', productionOrderNo: '', factoryId: '', feiTicketNo: '' }
  state.createFactoryOptions = []
  state.createResults = []
  state.createSelectedCandidateId = ''
  state.createHasSearched = false
}

function renderCreateLookupControls(): string {
  const modes: Array<{ key: CutPieceReturnLookupMode; label: string }> = [
    { key: 'SEWING_TASK', label: '车缝任务单号' },
    { key: 'PRODUCTION_FACTORY', label: '生产单 + 车缝工厂' },
    { key: 'FEI_TICKET', label: '菲票号' },
  ]
  const tabs = `<div class="grid gap-2 md:grid-cols-3">${modes.map((mode) => `<button type="button" class="rounded-md border px-3 py-2 text-sm ${state.createLookupMode === mode.key ? 'border-blue-600 bg-blue-50 font-medium text-blue-800' : 'hover:bg-muted'}" data-cut-piece-return-action="set-create-lookup-mode" data-lookup-mode="${mode.key}">${mode.label}</button>`).join('')}</div>`
  if (state.createLookupMode === 'PRODUCTION_FACTORY') {
    return `${tabs}<div class="mt-3 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto]"><label class="space-y-1"><span class="block text-xs text-muted-foreground">生产单号（精确匹配）</span><input class="h-10 w-full rounded-md border px-3" value="${escapeHtml(state.createQuery.productionOrderNo)}" data-cut-piece-return-form="lookupProductionOrderNo" placeholder="PO-202603-0101" /></label><button type="button" class="mt-5 h-10 rounded-md border px-3 text-sm hover:bg-muted" data-cut-piece-return-action="load-create-factories">查询承接工厂</button><label class="space-y-1"><span class="block text-xs text-muted-foreground">实际承接车缝工厂</span><select class="h-10 w-full rounded-md border px-3" data-cut-piece-return-form="lookupFactoryId" ${state.createFactoryOptions.length ? '' : 'disabled'}><option value="">${state.createFactoryOptions.length ? '请选择' : '请先查询生产单'}</option>${state.createFactoryOptions.map((factory) => `<option value="${escapeHtml(factory.factoryId)}" ${factory.factoryId === state.createQuery.factoryId ? 'selected' : ''}>${escapeHtml(factory.factoryName)}</option>`).join('')}</select></label><button type="button" class="mt-5 h-10 rounded-md border border-blue-600 bg-blue-600 px-4 text-sm text-white" data-cut-piece-return-action="find-create-sources">查找车缝任务</button></div>`
  }
  const field = state.createLookupMode === 'SEWING_TASK' ? 'lookupSewingTaskNo' : 'lookupFeiTicketNo'
  const value = state.createLookupMode === 'SEWING_TASK' ? state.createQuery.sewingTaskNo : state.createQuery.feiTicketNo
  const placeholder = state.createLookupMode === 'SEWING_TASK' ? 'ST-260324-001' : 'FT-260324-001'
  return `${tabs}<div class="mt-3 flex gap-3"><label class="flex-1 space-y-1"><span class="block text-xs text-muted-foreground">${state.createLookupMode === 'SEWING_TASK' ? '车缝任务单号（精确匹配）' : '历史菲票号（精确匹配）'}</span><input class="h-10 w-full rounded-md border px-3" value="${escapeHtml(value)}" data-cut-piece-return-form="${field}" placeholder="${placeholder}" /></label><button type="button" class="mt-5 h-10 rounded-md border border-blue-600 bg-blue-600 px-4 text-sm text-white" data-cut-piece-return-action="find-create-sources">查找车缝任务</button></div>`
}

function renderCreateCandidateCard(candidate: CutPieceReturnInitiationCandidate): string {
  const selected = candidate.candidateId === state.createSelectedCandidateId
  return `<label class="block rounded-lg border p-4 ${selected ? 'border-blue-600 bg-blue-50/40' : ''} ${candidate.eligible ? 'cursor-pointer hover:border-blue-400' : 'bg-muted/30 opacity-75'}" ${candidate.eligible ? `data-cut-piece-return-action="select-create-source" data-candidate-id="${escapeHtml(candidate.candidateId)}"` : ''}><div class="flex items-start gap-3"><input type="radio" name="cut-piece-return-candidate" value="${escapeHtml(candidate.candidateId)}" class="mt-1" ${selected ? 'checked' : ''} ${candidate.eligible ? '' : 'disabled'} /><div class="flex min-w-0 flex-1 gap-3">${renderImageThumb(candidate.styleImageUrl, candidate.styleImageAlt, `${candidate.spuCode} 款式`)}${candidate.parts[0] ? renderImageThumb(candidate.parts[0].sourceMaterialImageUrl, candidate.parts[0].sourceMaterialImageAlt, `${candidate.parts[0].sourceMaterialSku} 物料`) : ''}<div class="min-w-0 flex-1"><div class="flex flex-wrap items-center justify-between gap-2"><strong>任务 ${escapeHtml(candidate.sewingTaskId)} · ${escapeHtml(candidate.productionOrderNo)}</strong>${candidate.eligible ? badge('可退仓') : badge('已阻断')}</div><p class="mt-1 text-sm">${escapeHtml(candidate.spuCode)} · ${escapeHtml(candidate.styleName)} · ${escapeHtml(candidate.garmentColor)} / ${escapeHtml(candidate.size)}</p><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(candidate.sourceFactoryName)} · ${escapeHtml(candidate.sourceHandoverOrderNo)} · 记录 ${candidate.sourceHandoverRecordNos.map(escapeHtml).join('、')}</p><p class="mt-1 text-xs">首次责任 ${formatQty(candidate.frozenMinimumReturnQty)} 件 · 历史退件 ${formatQty(candidate.frozenMinimumReturnQty - candidate.currentExpectedReturnQty)} 件 · 当前可退 ${formatQty(candidate.currentExpectedReturnQty)} 件</p>${candidate.matchedFeiTicketNo ? `<p class="mt-1 text-xs text-blue-800">通过菲票 ${escapeHtml(candidate.matchedFeiTicketNo)} 找到任务；该查找不代表本次实物票在场。</p>` : ''}${candidate.blockedReasons.length ? `<p class="mt-2 text-xs text-red-700">${candidate.blockedReasons.map(escapeHtml).join('；')}</p>` : ''}</div></div></div></label>`
}

function renderCreateReceiptInputs(candidate: CutPieceReturnInitiationCandidate): string {
  return `<section class="space-y-4 rounded-lg border p-4"><div><h3 class="font-semibold">录入本次退仓数量</h3><p class="mt-1 text-xs text-muted-foreground">件数和部位片数分别校验；部位差异只保留记录，不反向改写退件数。</p></div><div class="grid gap-3 md:grid-cols-2"><label class="space-y-1"><span class="block text-sm font-medium">本次退仓件数（件）</span><input type="number" min="1" max="${candidate.currentExpectedReturnQty}" value="1" class="h-10 w-full rounded-md border px-3" data-cut-piece-return-form="createReturnedGarmentQty" /><span class="block text-xs text-muted-foreground">不得超过当前可退 ${formatQty(candidate.currentExpectedReturnQty)} 件</span></label><label class="space-y-1"><span class="block text-sm font-medium">操作人</span><input value="裁床退仓员" class="h-10 w-full rounded-md border px-3" data-cut-piece-return-form="createOperator" /></label></div><div class="overflow-x-auto rounded-lg border"><table class="w-full min-w-[820px] text-sm"><thead class="bg-muted/40 text-xs text-muted-foreground"><tr><th class="px-3 py-2 text-left">原裁片单 / 部位</th><th class="px-3 py-2 text-left">有效交出 / 已退 / 可退</th><th class="px-3 py-2 text-left">本次实物票证据</th><th class="px-3 py-2 text-left">扫描票号</th><th class="px-3 py-2 text-right">本次片数</th></tr></thead><tbody>${candidate.parts.map((part, index) => `<tr class="border-t" data-cut-piece-return-create-row="${index}"><td class="px-3 py-3"><strong>${escapeHtml(part.partName)}</strong><span class="ml-2 text-xs text-muted-foreground">${escapeHtml(part.partCode)}</span><span class="block text-xs text-muted-foreground">${escapeHtml(part.sourceCutOrderNo)} · 历史票 ${part.historicalTicketNos.map(escapeHtml).join('、') || '无'}</span></td><td class="px-3 py-3 text-xs"><span class="block">有效交出 ${formatQty(part.effectiveHandedPieceQty)} 片</span><span class="block text-muted-foreground">已退 ${formatQty(part.confirmedReturnedPieceQty)} 片</span><strong class="block text-blue-800">可退 ${formatQty(part.currentReturnablePieceQty)} 片</strong></td><td class="px-3 py-3"><select class="h-9 w-full rounded-md border px-2 text-xs" data-cut-piece-return-evidence-mode><option value="MANUAL_MISSING">未带实物票，手动选部位</option><option value="MANUAL_UNREADABLE">实物票不可识别</option><option value="SCAN">扫描旧菲票并匹配</option></select></td><td class="px-3 py-3"><input class="h-9 w-full rounded-md border px-2 text-xs" data-cut-piece-return-scanned-ticket placeholder="${escapeHtml(part.oldFeiTicketNo)}" /></td><td class="px-3 py-3 text-right"><input type="number" min="0" max="${part.currentReturnablePieceQty}" value="0" class="h-9 w-28 rounded-md border px-3 text-right" data-cut-piece-return-part-count ${part.currentReturnablePieceQty ? '' : 'disabled'} /></td></tr>`).join('')}</tbody></table></div><div class="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">确认时一次创建退仓单、按件扣减责任并按部位入退裁片库区；任一项失败都不会留下空的待接收单。</div></section>`
}

function renderCreateDialog(): string {
  const candidate = selectedCreateCandidate()
  const resultHtml = !state.createHasSearched
    ? '<div class="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">请先精确查找车缝任务，不展示全量交出候选。</div>'
    : state.createResults.length
      ? `<div class="space-y-3"><h3 class="text-sm font-semibold">查找结果（${state.createResults.length} 个责任范围）</h3>${state.createResults.map(renderCreateCandidateCard).join('')}</div>`
      : '<div class="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">没有找到可用的车缝任务正式交出事实。请检查单号，或确认工厂已完成接收回写。</div>'
  return renderDialogShell(
    '新增裁片退仓',
    '先找到精确车缝任务，再录入退件和部位片数，一次确认入退裁片库区。',
    `<section class="space-y-3 rounded-lg border p-4"><div><h3 class="font-semibold">1. 查找车缝任务</h3><p class="mt-1 text-xs text-muted-foreground">生产单可能拆成多个车缝任务；查到多个结果时必须选定具体任务和色码范围。</p></div>${renderCreateLookupControls()}</section>${resultHtml}${candidate ? renderCreateReceiptInputs(candidate) : ''}`,
    `<button type="button" class="rounded border px-4 py-2 text-sm" data-cut-piece-return-action="close-dialog">取消</button><button type="button" class="rounded border border-blue-600 bg-blue-600 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50" data-cut-piece-return-action="confirm-create-return" ${candidate?.eligible ? '' : 'disabled'}>确认退件并入退裁片库区</button>`,
  )
}

function renderDetailDialog(record: CutPieceReturnCaseProjection): string {
  const latestPlan = record.supplementPlans.at(-1)
  const canDispose = record.receiptStatus === '已确认退件' && !record.settlementType && record.returnZoneAvailablePieceQty > 0
  return renderDialogShell(
    `${record.returnOrderNo} · 裁片退仓处理`,
    `${record.productionOrderNo} / ${record.garmentColor} / ${record.size}`,
    `${renderResponsibilityPanel(record)}<section class="grid gap-3 md:grid-cols-2"><div class="rounded-lg border p-4"><h3 class="font-semibold">来源交出事实</h3><dl class="mt-3 grid grid-cols-[120px_1fr] gap-2 text-sm"><dt class="text-muted-foreground">交出单</dt><dd>${escapeHtml(record.sourceHandoverOrderNo)}</dd><dt class="text-muted-foreground">交出记录</dt><dd>${record.sourceHandoverRecordNos.map(escapeHtml).join('、')}</dd><dt class="text-muted-foreground">冻结放行快照</dt><dd>${escapeHtml(record.frozenReleaseSnapshotId)}</dd><dt class="text-muted-foreground">来源工厂</dt><dd>${escapeHtml(record.sourceFactoryName)}</dd></dl></div><div class="rounded-lg border p-4"><h3 class="font-semibold">退仓结算边界</h3><p class="mt-2 text-sm">确认退件后，各部位实际片数进入<strong>退裁片库区</strong>。报废从该库区核销；非报废裁片在创建关联补料单时整体转入补料业务，本退仓单即结算。后续裁剪、齐套、装袋和交出统一由普通补料与交出流程处理。</p></div></section>${renderPartTable(record)}<section class="rounded-lg border p-4"><h3 class="font-semibold">接收记录</h3>${record.receipts.length ? record.receipts.map((receipt) => `<div class="mt-3 rounded-md bg-muted/30 p-3 text-sm"><strong>${formatQty(receipt.returnedGarmentQty)} 件</strong><span class="ml-2 text-muted-foreground">${escapeHtml(receipt.confirmedAt)} · ${escapeHtml(receipt.confirmedBy)}</span><p class="mt-1">${escapeHtml(receipt.differenceSummary)}</p></div>`).join('') : '<p class="mt-2 text-sm text-muted-foreground">尚未确认退件。</p>'}</section><section class="rounded-lg border p-4"><div class="flex flex-wrap items-center justify-between gap-2"><div><h3 class="font-semibold">补料关联</h3><p class="mt-1 text-xs text-muted-foreground">按原裁片单拆单；创建成功即完成退仓侧结算，后续仅跟踪补料单状态。</p></div><a class="text-sm text-blue-700 hover:underline" data-nav="/fcs/craft/cutting/supplement-management">查看补料管理</a></div>${latestPlan ? `<div class="mt-3 text-sm"><p><strong>最终补：</strong>${latestPlan.finalMakeupGarmentQty} 件</p><p class="mt-1"><strong>新补裁：</strong>${latestPlan.partLines.map((line) => `${escapeHtml(line.partName)} ${line.supplementPieceQty} 片`).join('、')}</p><div class="mt-2 flex flex-wrap gap-2">${record.latestSupplementStatuses.map((item) => `<a class="inline-flex items-center gap-2 rounded border px-2 py-1 text-blue-700" data-nav="/fcs/craft/cutting/supplement-management?recordNo=${encodeURIComponent(item.supplementOrderNo)}"><span>${escapeHtml(item.supplementOrderNo)}</span>${badge(item.status)}</a>`).join('')}</div></div>` : '<p class="mt-2 text-sm text-muted-foreground">尚未创建补料单。</p>'}</section>${record.settlementType ? `<section class="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><h3 class="font-semibold">退仓处理已结算</h3><p class="mt-1">${record.settlementType === 'SUPPLEMENT_CREATED' ? '非报废裁片已转入补料业务并建立原裁片单关联。' : '退裁片库区库存已全部报废核销。'} ${escapeHtml(record.settledAt)} · ${escapeHtml(record.settledBy)}</p></section>` : ''}<section class="rounded-lg border p-4"><h3 class="font-semibold">操作追溯</h3><div class="mt-3 space-y-2">${record.operationLogs.length ? record.operationLogs.slice().reverse().map((log) => `<div class="grid gap-1 rounded-md bg-muted/30 p-3 text-xs md:grid-cols-[150px_1fr_180px]"><strong>${escapeHtml(log.action)}</strong><div><span class="font-medium">${escapeHtml(log.businessNo)}</span><span class="ml-2">${escapeHtml(log.quantityText)}</span><p class="mt-1 text-muted-foreground">${escapeHtml(log.note)}</p></div><span class="text-muted-foreground">${escapeHtml(log.operatedAt)} · ${escapeHtml(log.operatedBy)}</span></div>`).join('') : '<p class="text-sm text-muted-foreground">暂无操作记录。</p>'}</div></section>`,
    canDispose ? `<button type="button" class="rounded border border-red-200 px-4 py-2 text-sm text-red-700" data-cut-piece-return-action="open-scrap" data-case-id="${escapeHtml(record.caseId)}">报废退裁片</button><button type="button" class="rounded border border-blue-600 bg-blue-600 px-4 py-2 text-sm text-white" data-cut-piece-return-action="open-supplement" data-case-id="${escapeHtml(record.caseId)}">创建补料并结算</button>` : '',
  )
}

function renderReceiveDialog(record: CutPieceReturnCaseProjection): string {
  const liveCandidate = listCutPieceReturnInitiationCandidates().find((candidate) =>
    candidate.responsibilityScopeKey === record.responsibilityScopeKey
  )
  return renderDialogShell(
    '接收、清点并确认退件',
    '先按件接收，再逐个部位记录识别依据和实际片数，最终按件确认。',
    `${renderResponsibilityPanel(record)}<section class="rounded-lg border p-4"><div class="flex items-start gap-3"><span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-700 text-sm font-semibold text-white">1</span><div><strong>按件接收</strong><p class="mt-1 text-xs text-muted-foreground">本次确认退件数不得超过当前应回；创建退仓本身不扣减。</p></div></div><div class="mt-3 grid gap-4 md:grid-cols-2"><label class="space-y-1"><span class="text-sm font-medium">本次接收并最终确认退件（件）</span><input type="number" min="1" max="${record.responsibility.currentExpectedReturnQty}" value="1" class="h-10 w-full rounded-md border px-3" data-cut-piece-return-form="returnedGarmentQty" /></label><label class="space-y-1"><span class="text-sm font-medium">操作人</span><input value="裁床退仓员" class="h-10 w-full rounded-md border px-3" data-cut-piece-return-form="operator" /></label></div></section><section class="rounded-lg border"><div class="border-b bg-muted/30 px-4 py-3"><div class="flex items-start gap-3"><span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-700 text-sm font-semibold text-white">2</span><div><strong>按部位清点（片）</strong><p class="mt-1 text-xs text-muted-foreground">“有实物票”只在旧菲票成功扫描并匹配本单时成立；未带票或票据不可识别时，按冻结部位手动选择并录入实际片数。</p></div></div></div>${record.parts.map((part, index) => { const livePart = liveCandidate?.parts.find((item) => item.sourceCutOrderId === part.sourceCutOrderId && item.partCode === part.partCode); const currentReturnablePieceQty = livePart?.currentReturnablePieceQty ?? 0; return `<div class="grid gap-3 border-b px-4 py-3 last:border-b-0 md:grid-cols-[1fr_190px_210px_120px] md:items-end" data-cut-piece-return-receive-row="${index}"><div><strong>${escapeHtml(part.partName)}</strong><span class="ml-2 text-xs text-muted-foreground">${escapeHtml(part.partCode)}</span><p class="mt-1 text-xs text-muted-foreground">${escapeHtml(part.sourceCutOrderNo)} · ${part.historicalTicketExists ? `系统历史票号 ${part.historicalTicketNos.map(escapeHtml).join('、')}` : '系统无历史票号'}</p><p class="mt-1 text-xs text-blue-800">有效交出 ${formatQty(livePart?.effectiveHandedPieceQty ?? part.effectiveHandedPieceQty)} 片 · 已退 ${formatQty(livePart?.confirmedReturnedPieceQty ?? 0)} 片 · 当前可退 ${formatQty(currentReturnablePieceQty)} 片</p></div><label class="space-y-1"><span class="block text-xs text-muted-foreground">本次识别方式</span><select class="h-9 w-full rounded-md border px-2 text-sm" data-cut-piece-return-evidence-mode><option value="MANUAL_MISSING">未带实物票，手动选部位</option><option value="MANUAL_UNREADABLE">实物票不可识别，手动选部位</option><option value="SCAN">扫描旧菲票并匹配</option></select></label><label class="space-y-1"><span class="block text-xs text-muted-foreground">扫描票号（仅扫码时填写）</span><input class="h-9 w-full rounded-md border px-3 text-sm" data-cut-piece-return-scanned-ticket placeholder="${escapeHtml(part.oldFeiTicketNo)}" /></label><label class="space-y-1"><span class="block text-xs text-muted-foreground">实际清点（片）</span><input type="number" min="0" max="${currentReturnablePieceQty}" value="0" class="h-9 w-full rounded-md border px-3 text-right" data-cut-piece-return-part-count ${currentReturnablePieceQty ? '' : 'disabled'} /></label></div>` }).join('')}</section><section class="rounded-lg border border-emerald-200 bg-emerald-50 p-4"><div class="flex items-start gap-3"><span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-sm font-semibold text-white">3</span><div><strong>最终按件确认</strong><p class="mt-1 text-xs text-emerald-900">确认后按件数扣减车缝工厂应回责任；各部位按实际片数进入退裁片库区。部位差异不反向改写件数。</p></div></div></section>`,
    '<button type="button" class="rounded border px-4 py-2 text-sm" data-cut-piece-return-action="close-dialog">取消</button><button type="button" class="rounded border border-blue-600 bg-blue-600 px-4 py-2 text-sm text-white" data-cut-piece-return-action="confirm-receive">确认退件并入退裁片库区</button>',
  )
}

function renderScrapDialog(record: CutPieceReturnCaseProjection): string {
  const parts = record.parts.filter((part) => partAvailableQty(record, part.sourceCutOrderId, part.partCode) > 0)
  return renderDialogShell('报废退裁片', '报废从退裁片库区永久核销，不再次改变车缝工厂应回责任。', `<div class="grid gap-4 md:grid-cols-2"><label class="space-y-1"><span class="text-sm font-medium">原裁片单 / 部位</span><select class="h-10 w-full rounded-md border px-3" data-cut-piece-return-form="scrapPartKey">${parts.map((part) => `<option value="${escapeHtml(partKey(part))}">${escapeHtml(part.sourceCutOrderNo)} · ${escapeHtml(part.partName)}（可用 ${formatQty(partAvailableQty(record, part.sourceCutOrderId, part.partCode))} 片）</option>`).join('')}</select></label><label class="space-y-1"><span class="text-sm font-medium">报废数量（片）</span><input type="number" min="1" value="1" class="h-10 w-full rounded-md border px-3" data-cut-piece-return-form="scrapQty" /></label></div><label class="block space-y-1"><span class="text-sm font-medium">报废原因</span><textarea class="min-h-20 w-full rounded-md border px-3 py-2 text-sm" data-cut-piece-return-form="scrapReason" placeholder="必填：污染、破损、缺片无法使用等"></textarea></label><label class="block space-y-1"><span class="text-sm font-medium">操作人</span><input value="裁床主管" class="h-10 w-full rounded-md border px-3" data-cut-piece-return-form="operator" /></label><div class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">报废不可撤销；全部可用退裁片报废后，本退仓单按“已报废关闭”结算。</div>`, '<button type="button" class="rounded border px-4 py-2 text-sm" data-cut-piece-return-action="close-dialog">取消</button><button type="button" class="rounded border border-red-700 bg-red-700 px-4 py-2 text-sm text-white" data-cut-piece-return-action="confirm-scrap">确认报废</button>')
}

function renderSupplementDialog(record: CutPieceReturnCaseProjection): string {
  return renderDialogShell('创建车缝退仓补料', '手动确认新补裁部位和片数，不受之前清点数量限制；同时明确最终补多少件。', `<div class="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">提交后按原裁片单原子拆分补料单，业务来源标记为“车缝退仓”；剩余退裁片整体转入对应补料业务，本退仓单立即结算。后续齐套、装袋与交出统一由普通补料和交出流程办理。</div><div class="grid gap-4 md:grid-cols-2"><label class="space-y-1"><span class="text-sm font-medium">最终补多少件（件）</span><input type="number" min="1" value="1" class="h-10 w-full rounded-md border px-3" data-cut-piece-return-form="finalMakeupGarmentQty" /></label><label class="space-y-1"><span class="text-sm font-medium">操作人</span><input value="裁床主管" class="h-10 w-full rounded-md border px-3" data-cut-piece-return-form="operator" /></label></div><div class="rounded-lg border"><div class="border-b bg-muted/30 px-4 py-3"><strong>手动确认新补裁部位（片）</strong><p class="mt-1 text-xs text-muted-foreground">每个仍有退裁片的原裁片单至少填写一个正数部位；否则请先报废该原裁片单下的剩余退裁片。</p></div>${record.parts.map((part, index) => `<label class="grid grid-cols-[1fr_140px] items-center gap-3 border-b px-4 py-3 last:border-b-0" data-cut-piece-return-supplement-row="${index}"><span><strong>${escapeHtml(part.partName)}</strong><span class="ml-2 text-xs text-muted-foreground">${escapeHtml(part.partCode)}</span><span class="block text-xs text-muted-foreground">原裁片单 ${escapeHtml(part.sourceCutOrderNo)} · 可复用退裁片 ${formatQty(partAvailableQty(record, part.sourceCutOrderId, part.partCode))} 片</span></span><input type="number" min="0" value="0" class="h-9 rounded-md border px-3 text-right" data-cut-piece-return-supplement-count /></label>`).join('')}</div>`, '<button type="button" class="rounded border px-4 py-2 text-sm" data-cut-piece-return-action="close-dialog">取消</button><button type="button" class="rounded border border-blue-600 bg-blue-600 px-4 py-2 text-sm text-white" data-cut-piece-return-action="confirm-supplement">创建补料单并结算退仓</button>')
}

function renderTicketDialog(record: CutPieceReturnCaseProjection): string {
  const availableParts = record.parts.filter((part) => partAvailableQty(record, part.sourceCutOrderId, part.partCode) > 0)
  return renderDialogShell('快速确认部位并生成退裁片大菲票', '旧实物菲票缺失是正常现场场景；可扫描历史票号，也可直接按原裁片单和部位快速选择。', `<div class="flex flex-wrap gap-2"><input class="h-10 min-w-[260px] flex-1 rounded-md border px-3" data-cut-piece-return-form="partScan" placeholder="扫描旧菲票号 / 输入裁片单、部位码或名称" /><button type="button" class="rounded border px-4 text-sm" data-cut-piece-return-action="recognize-part">识别部位</button><button type="button" class="rounded border px-4 text-sm" data-cut-piece-return-action="select-all-parts">全选可用部位</button></div><div class="rounded-lg border">${availableParts.map((part) => { const key = partKey(part); const checked = state.recognizedPartKeys.includes(key); const evidence = record.receipts.flatMap((receipt) => receipt.partCounts).find((item) => item.sourceCutOrderId === part.sourceCutOrderId && item.partCode === part.partCode); return `<label class="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0"><span><strong>${escapeHtml(part.partName)}</strong><span class="ml-2 text-xs text-muted-foreground">${escapeHtml(part.sourceCutOrderNo)} · 可用 ${formatQty(partAvailableQty(record, part.sourceCutOrderId, part.partCode))} 片</span><span class="block text-xs text-muted-foreground">历史来源票：${part.historicalTicketExists ? escapeHtml(part.oldFeiTicketNo) : '无'}；本次证据：${evidence?.identificationMode === 'SCAN_OLD_TICKET' ? `已扫码 ${escapeHtml(evidence.scannedTicketNo)}` : evidence ? '手动选部位' : '尚未记录'}</span></span><input type="checkbox" value="${escapeHtml(key)}" data-cut-piece-return-ticket-part ${checked ? 'checked' : ''} /></label>` }).join('')}</div><label class="block space-y-1"><span class="text-sm font-medium">制票人</span><input value="裁床退仓员" class="h-10 w-full rounded-md border px-3" data-cut-piece-return-form="operator" /></label>`, '<button type="button" class="rounded border px-4 py-2 text-sm" data-cut-piece-return-action="close-dialog">取消</button><button type="button" class="rounded border border-blue-600 bg-blue-600 px-4 py-2 text-sm text-white" data-cut-piece-return-action="create-large-ticket">生成大菲票</button>')
}

function renderLargeTicketPrint(record: CutPieceReturnCaseProjection, ticket: CutPieceReturnLargeTicket): string {
  const qrValue = JSON.stringify({ type: 'CUT_PIECE_RETURN_LARGE_TICKET', caseId: record.caseId, ticketNo: ticket.ticketNo, partLines: ticket.partLines })
  return renderDialogShell('退裁片大菲票打印预览', `${ticket.ticketNo} · 固定 100mm × 100mm`, `<style>@media print{body *{visibility:hidden!important}[data-cut-piece-return-print-sheet],[data-cut-piece-return-print-sheet] *{visibility:visible!important}[data-cut-piece-return-print-sheet]{position:absolute!important;left:0;top:0;margin:0!important;box-shadow:none!important}}</style><div class="mx-auto h-[100mm] w-[100mm] max-w-full border border-black bg-white p-[2mm] text-black shadow" data-cut-piece-return-print-sheet><div class="border border-black"><div class="border-b border-black p-[2mm] text-xl font-black">退裁片大菲票 · ${escapeHtml(record.returnOrderNo)}</div><div class="grid grid-cols-[1fr_32mm]"><div class="grid grid-cols-2 text-xs"><div class="border-b border-r border-black p-[1.5mm]"><span class="block text-[8px]">生产单</span><strong>${escapeHtml(record.productionOrderNo)}</strong></div><div class="border-b border-r border-black p-[1.5mm]"><span class="block text-[8px]">SPU / 色码</span><strong>${escapeHtml(record.spuCode)} · ${escapeHtml(record.garmentColor)} / ${escapeHtml(record.size)}</strong></div><div class="col-span-2 border-b border-r border-black p-[1.5mm]"><span class="block text-[8px]">面料</span><strong>${escapeHtml(record.materialName)}（${escapeHtml(record.materialAlias)}） · ${escapeHtml(record.materialColor)}</strong></div><div class="col-span-2 border-b border-r border-black p-[1.5mm]"><span class="block text-[8px]">包含部位</span>${ticket.partLines.map((line) => `<strong class="mr-3 inline-block">${escapeHtml(line.partName)} ${formatQty(line.pieceQty)} 片</strong>`).join('')}</div><div class="border-b border-r border-black p-[1.5mm]"><span class="block text-[8px]">退裁片库区</span><strong>RETURN-A</strong></div><div class="border-b border-r border-black p-[1.5mm]"><span class="block text-[8px]">大菲票号</span><strong>${escapeHtml(ticket.ticketNo)}</strong></div><div class="col-span-2 border-r border-black p-[1.5mm]"><span class="block text-[8px]">来源</span><strong>${escapeHtml(record.sourceFactoryName)} / ${escapeHtml(record.sourceHandoverOrderNo)}</strong></div></div><aside class="flex flex-col items-center justify-center gap-2 p-[1.5mm] text-center">${renderRealQrPlaceholder({ value: qrValue, size: 112, title: '退裁片大菲票二维码', label: ticket.ticketNo })}<strong class="text-[10px]">扫码查看退仓部位</strong></aside></div></div></div>`, '<button type="button" class="rounded border px-4 py-2 text-sm" data-cut-piece-return-action="close-dialog">关闭</button><button type="button" class="rounded border border-blue-600 bg-blue-600 px-4 py-2 text-sm text-white" data-cut-piece-return-action="print-large-ticket">打印大菲票</button>')
}

function renderOverlays(): string {
  const record = selectedCase()
  const dialog = !state.dialogMode
    ? ''
    : state.dialogMode === 'create' ? renderCreateDialog()
      : !record ? ''
      : state.dialogMode === 'detail' ? renderDetailDialog(record)
      : state.dialogMode === 'receive' ? renderReceiveDialog(record)
        : state.dialogMode === 'scrap' ? renderScrapDialog(record)
          : state.dialogMode === 'supplement' ? renderSupplementDialog(record)
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
    primaryActionsHtml: '<div class="flex items-center gap-2"><a class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-nav="/fcs/craft/cutting/warehouse-management/wait-handover">查看退裁片库区</a><button type="button" class="inline-flex h-9 items-center rounded-md border border-blue-600 bg-blue-600 px-3 text-sm text-white hover:bg-blue-700" data-skip-page-rerender="true" data-cut-piece-return-action="open-create">新增退仓</button></div>',
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
  document.querySelectorAll<HTMLElement>('[data-cut-piece-return-feedback]').forEach((feedback) => {
    feedback.outerHTML = renderFeedback()
  })
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
  state.recognizedPartKeys = []
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
  if (action === 'close-dialog') { state.dialogMode = null; state.activeTicketId = ''; state.feedback = null; refreshCutPieceReturnFeedback(); refreshCutPieceReturnOverlays(); return true }
  if (action === 'preview-image') { state.imagePreview = { src: actionNode.dataset.imageSrc || '', alt: actionNode.dataset.imageAlt || '业务图片' }; refreshCutPieceReturnOverlays(); return true }
  if (action === 'close-image-preview') { state.imagePreview = null; refreshCutPieceReturnOverlays(); return true }
  if (action === 'open-create') { resetCreateFlow(); openDialog('', 'create'); refreshCutPieceReturnOverlays(); return true }
  if (action === 'open-detail') { openDialog(caseId, 'detail'); refreshCutPieceReturnOverlays(); return true }
  if (action === 'open-receive') { openDialog(caseId, 'receive'); refreshCutPieceReturnOverlays(); return true }
  if (action === 'open-scrap') { openDialog(caseId, 'scrap'); refreshCutPieceReturnOverlays(); return true }
  if (action === 'open-supplement') { openDialog(caseId, 'supplement'); refreshCutPieceReturnOverlays(); return true }
  if (action === 'open-ticket') { openDialog(caseId, 'ticket'); refreshCutPieceReturnOverlays(); return true }
  try {
    if (action === 'set-create-lookup-mode') {
      state.createLookupMode = actionNode.dataset.lookupMode as CutPieceReturnLookupMode
      state.createFactoryOptions = []
      state.createResults = []
      state.createSelectedCandidateId = ''
      state.createHasSearched = false
      state.feedback = null
      refreshCutPieceReturnFeedback()
      refreshCutPieceReturnOverlays()
      return true
    }
    if (action === 'load-create-factories') {
      const productionOrderNo = formValue('lookupProductionOrderNo')
      state.createQuery.productionOrderNo = productionOrderNo
      state.createFactoryOptions = listCutPieceReturnFactoriesByProductionOrder(productionOrderNo)
      state.createQuery.factoryId = state.createFactoryOptions.length === 1 ? state.createFactoryOptions[0].factoryId : ''
      state.createResults = []
      state.createSelectedCandidateId = ''
      state.createHasSearched = false
      state.feedback = state.createFactoryOptions.length
        ? { tone: 'success', message: `已找到 ${state.createFactoryOptions.length} 个实际承接车缝工厂，请继续选择并查找任务。` }
        : { tone: 'warning', message: '该生产单没有已完成接收回写的车缝工厂交出事实。' }
      refreshCutPieceReturnFeedback()
      refreshCutPieceReturnOverlays()
      return true
    }
    if (action === 'find-create-sources') {
      if (state.createLookupMode === 'SEWING_TASK') {
        state.createQuery.sewingTaskNo = formValue('lookupSewingTaskNo')
        state.createResults = findCutPieceReturnSources({ mode: 'SEWING_TASK', sewingTaskNo: state.createQuery.sewingTaskNo })
      } else if (state.createLookupMode === 'PRODUCTION_FACTORY') {
        state.createQuery.productionOrderNo = formValue('lookupProductionOrderNo')
        state.createQuery.factoryId = formValue('lookupFactoryId')
        state.createResults = findCutPieceReturnSources({ mode: 'PRODUCTION_FACTORY', productionOrderNo: state.createQuery.productionOrderNo, factoryId: state.createQuery.factoryId })
      } else {
        state.createQuery.feiTicketNo = formValue('lookupFeiTicketNo')
        state.createResults = findCutPieceReturnSources({ mode: 'FEI_TICKET', feiTicketNo: state.createQuery.feiTicketNo })
      }
      state.createHasSearched = true
      state.createSelectedCandidateId = state.createResults.length === 1 && state.createResults[0].eligible
        ? state.createResults[0].candidateId
        : ''
      state.feedback = state.createResults.length
        ? { tone: 'success', message: state.createResults.length === 1 ? '已定位到一个车缝任务责任范围。' : `已找到 ${state.createResults.length} 个责任范围，请选择具体车缝任务和色码。` }
        : { tone: 'warning', message: '没有找到匹配的有效正式交出来源。' }
      refreshCutPieceReturnFeedback()
      refreshCutPieceReturnOverlays()
      return true
    }
    if (action === 'select-create-source') {
      const candidateId = actionNode.dataset.candidateId || ''
      const candidate = state.createResults.find((item) => item.candidateId === candidateId)
      if (!candidate?.eligible) throw new Error('该车缝任务责任范围当前不可退仓。')
      state.createSelectedCandidateId = candidateId
      state.feedback = null
      refreshCutPieceReturnFeedback()
      refreshCutPieceReturnOverlays()
      return true
    }
    if (action === 'confirm-create-return') {
      const candidate = selectedCreateCandidate()
      if (!candidate?.eligible) throw new Error('请先查找并选择一个可退仓的具体车缝任务责任范围。')
      const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-cut-piece-return-create-row]'))
      const partCounts = rows.map((row) => {
        const part = candidate.parts[Number(row.dataset.cutPieceReturnCreateRow)]
        const evidenceMode = row.querySelector<HTMLSelectElement>('[data-cut-piece-return-evidence-mode]')?.value || 'MANUAL_MISSING'
        return {
          partCode: part.partCode,
          sourceCutOrderId: part.sourceCutOrderId,
          pieceQty: Number(row.querySelector<HTMLInputElement>('[data-cut-piece-return-part-count]')?.value || 0),
          identificationMode: evidenceMode === 'SCAN' ? 'SCAN_OLD_TICKET' as const : 'MANUAL_PART_SELECTION' as const,
          physicalTicketStatus: evidenceMode === 'SCAN'
            ? 'PRESENT_AND_SCANNED' as const
            : evidenceMode === 'MANUAL_UNREADABLE' ? 'UNREADABLE' as const : 'MISSING' as const,
          scannedTicketNo: row.querySelector<HTMLInputElement>('[data-cut-piece-return-scanned-ticket]')?.value.trim() || '',
        }
      })
      const created = createAndConfirmCutPieceReturn({
        candidateId: candidate.candidateId,
        returnedGarmentQty: Number(formValue('createReturnedGarmentQty')),
        partCounts,
        confirmedBy: formValue('createOperator'),
      })
      state.activeCaseId = created.caseId
      state.dialogMode = 'detail'
      state.feedback = { tone: 'success', message: `已创建并确认退仓单 ${created.returnOrderNo}；按件责任和各部位退裁片库存已一次写入。` }
      refreshAfterBusinessMutation()
      return true
    }
    if (action === 'confirm-receive') {
      const record = selectedCase()!
      const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-cut-piece-return-receive-row]'))
      const partCounts = rows.map((row) => {
        const index = Number(row.dataset.cutPieceReturnReceiveRow)
        const part = record.parts[index]
        const evidenceMode = row.querySelector<HTMLSelectElement>('[data-cut-piece-return-evidence-mode]')?.value || 'MANUAL_MISSING'
        const identificationMode: CutPieceReturnIdentificationMode = evidenceMode === 'SCAN' ? 'SCAN_OLD_TICKET' : 'MANUAL_PART_SELECTION'
        const physicalTicketStatus: CutPieceReturnPhysicalTicketStatus = evidenceMode === 'SCAN'
          ? 'PRESENT_AND_SCANNED'
          : evidenceMode === 'MANUAL_UNREADABLE' ? 'UNREADABLE' : 'MISSING'
        return {
          partCode: part.partCode,
          sourceCutOrderId: part.sourceCutOrderId,
          pieceQty: Number(row.querySelector<HTMLInputElement>('[data-cut-piece-return-part-count]')?.value || 0),
          identificationMode,
          physicalTicketStatus,
          scannedTicketNo: row.querySelector<HTMLInputElement>('[data-cut-piece-return-scanned-ticket]')?.value.trim() || '',
        }
      })
      confirmCutPieceReturnReceipt({ caseId: record.caseId, returnedGarmentQty: Number(formValue('returnedGarmentQty')), partCounts, confirmedBy: formValue('operator') })
      state.dialogMode = 'detail'
      state.feedback = { tone: 'success', message: '已按件确认退件，并按部位实际片数和识别证据写入退裁片库区；部位差异已保留。' }
      refreshAfterBusinessMutation()
      return true
    }
    if (action === 'confirm-scrap') {
      if (typeof window !== 'undefined' && !window.confirm('确认从退裁片库区报废并永久核销该数量吗？')) return true
      const key = formValue('scrapPartKey')
      const separatorIndex = key.lastIndexOf('::')
      if (separatorIndex < 0) throw new Error('请选择要报废的原裁片单和部位。')
      scrapCutPieceReturnInventory({ caseId: state.activeCaseId, sourceCutOrderId: key.slice(0, separatorIndex), partCode: key.slice(separatorIndex + 2), pieceQty: Number(formValue('scrapQty')), reason: formValue('scrapReason'), operatedBy: formValue('operator') })
      state.dialogMode = 'detail'
      state.feedback = { tone: 'success', message: '报废数量已从退裁片库区核销，车缝工厂应回责任未被二次扣减。' }
      refreshAfterBusinessMutation()
      return true
    }
    if (action === 'confirm-supplement') {
      const record = selectedCase()!
      const partLines = Array.from(document.querySelectorAll<HTMLElement>('[data-cut-piece-return-supplement-row]')).map((row) => {
        const part = record.parts[Number(row.dataset.cutPieceReturnSupplementRow)]
        return { partCode: part.partCode, sourceCutOrderId: part.sourceCutOrderId, supplementPieceQty: Number(row.querySelector<HTMLInputElement>('[data-cut-piece-return-supplement-count]')?.value || 0) }
      })
      createCutPieceReturnSupplementPlan({ caseId: record.caseId, finalMakeupGarmentQty: Number(formValue('finalMakeupGarmentQty')), partLines, createdBy: formValue('operator') })
      state.dialogMode = 'detail'
      state.feedback = { tone: 'success', message: '已按原裁片单拆分车缝退仓补料单；剩余退裁片已转入补料业务，本退仓单已结算。' }
      refreshAfterBusinessMutation()
      return true
    }
    if (action === 'recognize-part') {
      const record = selectedCase()!
      const keyword = formValue('partScan').toLowerCase()
      const part = record.parts.find((item) => partAvailableQty(record, item.sourceCutOrderId, item.partCode) > 0 && [item.partCode, item.partName, item.sourceCutOrderNo, ...item.historicalTicketNos].some((value) => value.toLowerCase().includes(keyword)))
      if (!part || !keyword) throw new Error('未识别到本退仓单部位，请检查菲票号或直接点选部位。')
      state.recognizedPartKeys = [...new Set([...state.recognizedPartKeys, partKey(part)])]
      state.feedback = { tone: 'success', message: `已识别部位：${part.partName}。` }
      refreshCutPieceReturnFeedback()
      refreshCutPieceReturnOverlays()
      return true
    }
    if (action === 'select-all-parts') {
      const record = selectedCase()!
      state.recognizedPartKeys = record.parts.filter((part) => partAvailableQty(record, part.sourceCutOrderId, part.partCode) > 0).map(partKey)
      refreshCutPieceReturnOverlays()
      return true
    }
    if (action === 'create-large-ticket') {
      const selected = Array.from(document.querySelectorAll<HTMLInputElement>('[data-cut-piece-return-ticket-part]:checked')).map((item) => item.value)
      const updated = createCutPieceReturnLargeTicket({ caseId: state.activeCaseId, partKeys: selected, createdBy: formValue('operator') })
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
  resetCreateFlow()
}
