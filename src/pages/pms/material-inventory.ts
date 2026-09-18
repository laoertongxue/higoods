// @page-pattern: list
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import {
  createPmsInventoryMonitorRow,
  formatPmsInventoryProcessChain,
  generatePmsInventoryOrder,
  getPmsInventoryMonitorRow,
  listPmsInventoryMonitor,
  listPmsInventoryOrders,
  PMS_INVENTORY_PROCESSES,
  PMS_INVENTORY_USAGE_TYPES,
  refreshPmsInventoryStocks,
  updatePmsInventoryRule,
  type PmsInventoryMonitorRow,
  type PmsInventoryOrder,
  type PmsInventoryProcess,
  type PmsInventoryTriggerMode,
  type PmsInventoryUsageType,
} from '../../data/pms/inventory-monitor.ts'
import { listPmsMaterials, type PmsPurchaseRegion } from '../../data/pms/materials.ts'
import { listPmsLogs, PmsDomainError } from '../../data/pms/runtime.ts'
import { listPmsSuppliers } from '../../data/pms/suppliers.ts'
import { listPmsWarehouses } from '../../data/pms/warehouses.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import {
  formatPmsQty,
  formatPmsTime,
  handlePmsCommonImageEvent,
  hydratePmsSurface,
  readNumberField,
  readTextField,
  renderPmsBusinessImage,
  renderPmsFeedback,
  renderPmsImagePreview,
  renderPmsOverlayError,
  renderPmsStatusBadge,
} from './shared.ts'

type InventoryOverlay =
  | null
  | { kind: 'rule'; id: string }
  | { kind: 'order'; id: string }
  | { kind: 'logs'; id: string }
  | { kind: 'records' }
  | { kind: 'add' }

type TransferFilter = '' | '可调拨' | '不可调拨'

interface InventoryPageState extends ProcessOrderListControllerState {
  keyword: string
  ruleFilter: '' | PmsInventoryMonitorRow['ruleStatus']
  materialFilter: string
  warehouseFilter: string
  processFilter: '' | PmsInventoryProcess
  transferFilter: TransferFilter
  ruleProcessChain: PmsInventoryProcess[]
  orderType: PmsInventoryOrder['orderType']
  overlay: InventoryOverlay
  overlayError: string
  feedback: string
  feedbackOk: boolean
}

const EVENT_PREFIX = 'pms-inv'
const ROOT_SELECTOR = '[data-pms-inv-root]'
const BUYER = { id: 'USR-PMS-WANG', name: '王采购', role: '采购员' as const }

const state: InventoryPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  ruleFilter: '',
  materialFilter: '',
  warehouseFilter: '',
  processFilter: '',
  transferFilter: '',
  ruleProcessChain: [],
  orderType: '采购单',
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
}

function filteredRows(): PmsInventoryMonitorRow[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listPmsInventoryMonitor().filter((row) => {
    if (state.ruleFilter && row.ruleStatus !== state.ruleFilter) return false
    if (state.materialFilter && row.materialCode !== state.materialFilter) return false
    if (state.warehouseFilter && row.warehouse !== state.warehouseFilter) return false
    if (state.processFilter && !row.processChain.includes(state.processFilter)) return false
    if (state.transferFilter === '可调拨' && !row.canTransfer) return false
    if (state.transferFilter === '不可调拨' && row.canTransfer) return false
    if (!keyword) return true
    return [row.materialCode, row.materialName, row.warehouse].some((value) => value.toLowerCase().includes(keyword))
  })
}

function ruleTone(status: PmsInventoryMonitorRow['ruleStatus']): 'green' | 'yellow' | 'red' {
  if (status === '正常') return 'green'
  if (status === '待补货') return 'yellow'
  return 'red'
}

function getMaterialImageUrl(materialCode: string): string {
  return listPmsMaterials().find((material) => material.materialCode === materialCode)?.imageUrl ?? ''
}

function renderInventoryImage(row: PmsInventoryMonitorRow): string {
  if (row.materialImageUrl) return renderPmsBusinessImage(row.materialImageUrl, `${row.materialName}（${row.materialCode}）实物图`, 'h-12 w-12')
  return '<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border bg-slate-50 px-1 text-center text-[10px] leading-tight text-slate-500">未匹配物料档案图</span>'
}

const columns: StandardListColumn<PmsInventoryMonitorRow>[] = [
  {
    key: 'material',
    title: '物料',
    width: 280,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.materialName,
    render: (row) => `<div class="flex items-center gap-3">${renderInventoryImage(row)}<div><div class="font-medium">${escapeHtml(row.materialName)}</div><div class="text-xs text-slate-500">${escapeHtml(row.materialCode)} · ${escapeHtml(row.unit)}</div><div class="text-xs text-slate-500">${escapeHtml(row.warehouse)}</div></div></div>`,
  },
  {
    key: 'stock',
    title: '库存 / 触发线',
    width: 200,
    sortable: true,
    sortValue: (row) => row.stockQty,
    render: (row) => `<div class="text-sm tabular-nums">库存 <strong>${formatPmsQty(row.stockQty, row.unit)}</strong></div><div class="mt-1 text-xs tabular-nums text-slate-500">安全阈值 ${formatPmsQty(row.safetyThreshold, row.unit)}</div><div class="mt-1 text-xs tabular-nums text-slate-500">触发线 ${formatPmsQty(row.triggerLine, row.unit)}（${escapeHtml(row.triggerMode)}）</div>`,
  },
  {
    key: 'suggested',
    title: '目标库存 / 建议量',
    width: 200,
    sortable: true,
    sortValue: (row) => row.suggestedQty,
    render: (row) => `<div class="text-sm tabular-nums">目标 ${formatPmsQty(row.targetStock, row.unit)}</div><div class="mt-1 text-sm font-semibold tabular-nums ${row.suggestedQty > 0 ? 'text-amber-700' : 'text-emerald-700'}">建议 ${formatPmsQty(row.suggestedQty, row.unit)}</div><div class="mt-1 text-xs text-slate-500">提前期 ${row.purchaseLeadTimeDays} 天</div>`,
  },
  {
    key: 'process',
    title: '加工工序链',
    width: 180,
    render: (row) => `<div class="text-sm">${escapeHtml(formatPmsInventoryProcessChain(row.processChain))}</div><div class="mt-1 text-xs text-slate-500">${row.processChain.length > 0 ? `共 ${row.processChain.length} 道工序` : '未配置工序'}</div>`,
  },
  {
    key: 'greige',
    title: '坯布匹配',
    width: 230,
    render: (row) => row.greigeSku
      ? `<div class="text-sm">${escapeHtml(row.greigeName || row.greigeSku)}</div><div class="mt-1 text-xs text-slate-500">坯布 SPU ${escapeHtml(row.greigeSpu || '—')} · SKU ${escapeHtml(row.greigeSku)}</div><div class="mt-1 text-xs tabular-nums ${row.greigeStock > 0 ? 'text-slate-500' : 'text-red-700'}">坯布库存 ${formatPmsQty(row.greigeStock)}</div>`
      : '<div class="text-sm text-slate-400">—</div><div class="mt-1 text-xs text-slate-500">未配置坯布匹配</div>',
  },
  {
    key: 'qualification',
    title: '建单资格',
    width: 230,
    render: (row) => `<div class="flex flex-wrap gap-1">${row.canTransfer ? renderPmsStatusBadge('可调拨', 'green') : renderPmsStatusBadge('不可调拨', 'slate')}${row.canPurchase ? renderPmsStatusBadge('可采购', 'blue') : renderPmsStatusBadge('不可采购', 'slate')}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.supplierName)}</div>${row.transferBlockReason ? `<div class="mt-1 text-xs text-amber-700">调拨限制：${escapeHtml(row.transferBlockReason)}</div>` : ''}`,
  },
  {
    key: 'status',
    title: '规则状态',
    width: 140,
    sortable: true,
    sortValue: (row) => row.ruleStatus,
    render: (row) => `${renderPmsStatusBadge(row.ruleStatus, ruleTone(row.ruleStatus))}${row.remark ? `<div class="mt-1 text-xs text-slate-500">${escapeHtml(row.remark)}</div>` : ''}`,
  },
  {
    key: 'actions',
    title: '操作',
    width: 250,
    actionColumn: true,
    render: (row) => `<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5"><button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="open-rule" data-monitor-id="${escapeHtml(row.id)}" data-skip-page-rerender="true">规则设置</button><button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="open-order" data-monitor-id="${escapeHtml(row.id)}" data-skip-page-rerender="true" ${row.ruleStatus !== '规则异常' && row.suggestedQty > 0 ? '' : 'disabled'}>建单</button><button type="button" class="text-left text-xs text-blue-700 hover:underline" data-${EVENT_PREFIX}-action="open-logs" data-monitor-id="${escapeHtml(row.id)}" data-skip-page-rerender="true">日志</button></div>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/material-inventory',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-inv-table-surface]',
  paginationSurfaceSelector: '[data-pms-inv-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-inv-overlays]',
  defaultFrozenKeys: ['material'],
  columnSettingsTitle: '面辅料库存监控列设置',
  emptyText: '当前条件下暂无监控物料',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof window === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function selectOptions(values: string[], selected: string, placeholder: string): string {
  const head = placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : ''
  return `${head}${values.map((value) => `<option value="${escapeHtml(value)}" ${selected === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}`
}

function renderFilters(): string {
  const rows = listPmsInventoryMonitor()
  const materials = [...new Set(rows.map((row) => row.materialCode))]
  const warehouses = [...new Set(rows.map((row) => row.warehouse))]
  const advancedCount = [state.warehouseFilter, state.processFilter, state.transferFilter].filter(Boolean).length
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="物料编码 / 名称 / 仓库" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">物料</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="materialFilter" data-skip-page-rerender="true">${selectOptions(materials, state.materialFilter, '全部物料')}</select></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">规则状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="ruleFilter" data-skip-page-rerender="true">${selectOptions(['正常', '待补货', '规则异常'], state.ruleFilter, '全部状态')}</select></label>
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">仓库</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="warehouseFilter" data-skip-page-rerender="true">${selectOptions(warehouses, state.warehouseFilter, '全部仓库')}</select></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">加工工序</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="processFilter" data-skip-page-rerender="true">${selectOptions(PMS_INVENTORY_PROCESSES, state.processFilter, '全部工序')}</select></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">调拨资格</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="transferFilter" data-skip-page-rerender="true">${selectOptions(['可调拨', '不可调拨'], state.transferFilter, '全部资格')}</select></label>
    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
    ${renderProcessFilterToggle(advancedCount, 'button')}
    <span class="ml-auto text-xs text-muted-foreground">触发线 = 阈值 × 比例 或固定值；建议量 = max(0, 目标库存 − 库存)；调拨需本仓与坯布库存均大于 0</span>
    </div></div>`
}

function renderStats(): string {
  const rows = filteredRows()
  return renderProcessOrderStats([
    { label: '监控物料', value: rows.length },
    { label: '待补货', value: rows.filter((row) => row.ruleStatus === '待补货').length },
    { label: '规则异常', value: rows.filter((row) => row.ruleStatus === '规则异常').length },
    { label: '可调拨', value: rows.filter((row) => row.canTransfer).length },
    { label: '建议补货量', value: formatPmsQty(rows.reduce((sum, row) => sum + row.suggestedQty, 0)) },
  ])
}

function renderRuleOverlay(id: string): string {
  const row = getPmsInventoryMonitorRow(id)
  if (!row) return ''
  const processBoxes = PMS_INVENTORY_PROCESSES.map((processName) => `<label class="flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-sm"><input type="checkbox" data-${EVENT_PREFIX}-rule-process="${processName}" data-skip-page-rerender="true" ${row.processChain.includes(processName) ? 'checked' : ''} />${processName}</label>`).join('')
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="补货规则设置" data-pms-inv-rule-root><section class="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-background p-5 shadow-2xl"><header class="mb-4 flex items-center justify-between"><div><h2 class="font-semibold">补货规则 · ${escapeHtml(row.materialName)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(row.materialCode)} · ${escapeHtml(row.warehouse)} · 当前库存 ${formatPmsQty(row.stockQty, row.unit)}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header>${renderPmsOverlayError(state.overlayError)}
    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">安全阈值<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0.01" step="0.01" value="${row.safetyThreshold}" data-${EVENT_PREFIX}-rule-field="safetyThreshold" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">触发方式<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-rule-field="triggerMode" data-skip-page-rerender="true">${['比例', '固定'].map((value) => `<option value="${value}" ${row.triggerMode === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">触发比例（0–1）<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" max="1" step="0.01" value="${row.triggerRatio}" data-${EVENT_PREFIX}-rule-field="triggerRatio" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">固定触发线<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" step="0.01" value="${row.fixedTrigger}" data-${EVENT_PREFIX}-rule-field="fixedTrigger" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">目标库存<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0.01" step="0.01" value="${row.targetStock}" data-${EVENT_PREFIX}-rule-field="targetStock" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">备注<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(row.remark)}" data-${EVENT_PREFIX}-rule-field="remark" data-skip-page-rerender="true" /></label>
    </div>
    <div class="mt-3 rounded-md border p-3">
      <div class="text-xs font-semibold text-muted-foreground">加工工序链（可多选，勾选顺序即工序顺序）</div>
      <div class="mt-2 flex flex-wrap gap-2">${processBoxes}</div>
      <p class="mt-2 text-xs text-slate-500">当前工序顺序：<span data-${EVENT_PREFIX}-process-order>${escapeHtml(formatPmsInventoryProcessChain(row.processChain))}</span></p>
    </div>
    <div class="mt-3 rounded-md border p-3">
      <div class="text-xs font-semibold text-muted-foreground">坯布匹配（填写任一坯布信息时，坯布 SKU 必填）</div>
      <div class="mt-2 grid grid-cols-2 gap-3">
        <label class="flex flex-col gap-1 text-xs text-muted-foreground">坯布 SPU<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(row.greigeSpu)}" data-${EVENT_PREFIX}-rule-field="greigeSpu" data-skip-page-rerender="true" /></label>
        <label class="flex flex-col gap-1 text-xs text-muted-foreground">坯布 SKU（必填）<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(row.greigeSku)}" data-${EVENT_PREFIX}-rule-field="greigeSku" data-skip-page-rerender="true" /></label>
        <label class="flex flex-col gap-1 text-xs text-muted-foreground">坯布名称<input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(row.greigeName)}" data-${EVENT_PREFIX}-rule-field="greigeName" data-skip-page-rerender="true" /></label>
        <label class="flex flex-col gap-1 text-xs text-muted-foreground">坯布库存<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" step="0.01" value="${row.greigeStock}" data-${EVENT_PREFIX}-rule-field="greigeStock" data-skip-page-rerender="true" /></label>
      </div>
    </div>
    <p class="mt-3 rounded-md border bg-muted/30 px-3 py-2 text-xs text-slate-600">当前触发线 ${formatPmsQty(row.triggerLine, row.unit)}，建议量 ${formatPmsQty(row.suggestedQty, row.unit)}；比例不在 0–1、阈值或目标库存 ≤ 0 时规则异常；坯布库存为 0 时不可调拨。</p>
    <footer class="mt-4 flex items-center justify-end gap-2">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('保存规则', { prefix: EVENT_PREFIX, action: 'submit-rule' }, 'check-check').replace('<button', `<button data-monitor-id="${escapeHtml(id)}"`)}</footer></section></div>`
}

function renderPurchaseFields(row: PmsInventoryMonitorRow): string {
  const enabledSuppliers = listPmsSuppliers().filter((supplier) => supplier.status === '已启用')
  const supplierNames = enabledSuppliers.map((supplier) => supplier.supplierName)
  if (row.supplierName && !supplierNames.includes(row.supplierName)) supplierNames.unshift(row.supplierName)
  const candidates = listPmsInventoryMonitor().filter((candidate) => candidate.ruleStatus !== '规则异常' && candidate.suggestedQty > 0)
  return `<div class="grid grid-cols-3 gap-3">
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">供应商<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-purchase-field="supplier" data-skip-page-rerender="true">${selectOptions(supplierNames, row.supplierName, '')}</select></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">采购地区<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-purchase-field="region" data-skip-page-rerender="true">${selectOptions(['国内', '印尼'], '国内', '')}</select></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">使用类型<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-purchase-field="usage" data-skip-page-rerender="true">${selectOptions(PMS_INVENTORY_USAGE_TYPES, PMS_INVENTORY_USAGE_TYPES[0] ?? '', '')}</select></label>
    </div>
    <div class="mt-3 rounded-md border p-3">
      <div class="text-xs font-semibold">SKU 勾选与数量（按勾选项生成采购明细）</div>
      <div class="mt-2 space-y-2">${candidates.map((candidate) => `<label class="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm" data-${EVENT_PREFIX}-purchase-row data-sku="${escapeHtml(candidate.materialCode)}"><input type="checkbox" data-${EVENT_PREFIX}-purchase-item data-skip-page-rerender="true" ${candidate.id === row.id ? 'checked' : ''} /><span class="flex min-w-0 flex-1 items-center gap-2">${renderPmsBusinessImage(candidate.materialImageUrl ?? getMaterialImageUrl(candidate.materialCode), `${candidate.materialName}（${candidate.materialCode}）实物图`, 'h-8 w-8')}<span class="min-w-0">${escapeHtml(candidate.materialName)} <span class="text-xs text-slate-500">${escapeHtml(candidate.materialCode)}</span></span></span><span class="shrink-0 text-xs text-slate-500">建议 ${formatPmsQty(candidate.suggestedQty, candidate.unit)}</span><input class="h-8 w-28 shrink-0 rounded-md border bg-background px-2 text-sm tabular-nums" type="number" min="0.01" step="0.01" value="${candidate.suggestedQty}" data-${EVENT_PREFIX}-purchase-qty data-skip-page-rerender="true" /></label>`).join('')}</div>
    </div>`
}

function renderTransferFields(row: PmsInventoryMonitorRow): string {
  const warehouses = listPmsWarehouses().filter((warehouse) => warehouse.status === '启用').map((warehouse) => warehouse.warehouseName)
  const fromOptions = warehouses.includes('广州原料仓') ? warehouses : ['广州原料仓', ...warehouses]
  const toOptions = [...warehouses, '国内区域', '印尼区域']
  const defaultFrom = fromOptions.includes('广州原料仓') ? '广州原料仓' : fromOptions[0] ?? ''
  const defaultTo = toOptions.includes(row.warehouse) ? row.warehouse : toOptions[0] ?? ''
  return `<div class="grid grid-cols-3 gap-3">
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">调出仓库<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-transfer-field="from" data-skip-page-rerender="true">${selectOptions(fromOptions, defaultFrom, '')}</select></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">调入目标（仓库 / 区域）<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-transfer-field="to" data-skip-page-rerender="true">${selectOptions(toOptions, defaultTo, '')}</select></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">调拨数量（${escapeHtml(row.unit)}）<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0.01" step="0.01" value="${row.suggestedQty}" data-${EVENT_PREFIX}-order-qty data-skip-page-rerender="true" /></label>
    </div>
    <label class="mt-3 flex items-center gap-2 rounded-md border p-3 text-sm"><input type="checkbox" data-${EVENT_PREFIX}-sync-process data-skip-page-rerender="true" />同步生成加工单（按规则工序链生成加工单号）</label>`
}

function renderOrderOverlay(id: string): string {
  const row = getPmsInventoryMonitorRow(id)
  if (!row) return ''
  const orders = listPmsInventoryOrders().filter((order) => order.monitorId === id)
  const orderType: PmsInventoryOrder['orderType'] = state.orderType === '采购单' && !row.canPurchase ? '调拨单' : state.orderType === '调拨单' && !row.canTransfer ? '采购单' : state.orderType
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="生成补货单据" data-pms-inv-order-root><section class="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-background p-5 shadow-2xl"><header class="mb-4 flex items-center justify-between"><div><h2 class="font-semibold">生成补货单据 · ${escapeHtml(row.materialName)}</h2><p class="mt-1 text-xs text-slate-500">建议量 ${formatPmsQty(row.suggestedQty, row.unit)}；建单数量不得超过建议量${row.transferBlockReason ? ` · 调拨限制：${escapeHtml(row.transferBlockReason)}` : ''}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header>${renderPmsOverlayError(state.overlayError)}
    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">单据类型<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-order-type data-skip-page-rerender="true"><option value="采购单" ${orderType === '采购单' ? 'selected' : ''} ${row.canPurchase ? '' : 'disabled'}>采购单${row.canPurchase ? '' : '（资格不足）'}</option><option value="调拨单" ${orderType === '调拨单' ? 'selected' : ''} ${row.canTransfer ? '' : 'disabled'}>调拨单${row.canTransfer ? '' : '（资格不足）'}</option></select></label>
      ${orderType === '采购单' ? '<div class="rounded-md border bg-muted/30 px-3 py-2 text-xs text-slate-600">采购单按下方勾选 SKU 逐项生成明细，勾选项数量之和即建单总量。</div>' : `<div class="rounded-md border bg-muted/30 px-3 py-2 text-xs text-slate-600">工序链 ${escapeHtml(formatPmsInventoryProcessChain(row.processChain))}；勾选同步生成加工单后，每个工序生成一个加工单号。</div>`}
    </div>
    <div class="mt-3">${orderType === '采购单' ? renderPurchaseFields(row) : renderTransferFields(row)}</div>
    ${orders.length > 0 ? `<div class="mt-3 rounded-md border p-3 text-xs"><div class="font-semibold">本物料已建单据</div><ul class="mt-1 space-y-1 text-slate-600">${orders.map((order) => `<li>${escapeHtml(order.orderNo)} · ${escapeHtml(order.orderType)} · ${formatPmsQty(order.qty, order.unit)} · ${escapeHtml(order.lines.length)} 个 SKU · 加工单 ${escapeHtml(order.processOrderNos.length > 0 ? order.processOrderNos.join(' → ') : '—')} · ${escapeHtml(order.createdBy)} · ${formatPmsTime(order.createdAt)}</li>`).join('')}</ul></div>` : ''}
    <footer class="mt-4 flex items-center justify-end gap-2">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('确认建单', { prefix: EVENT_PREFIX, action: 'submit-order' }, 'check-check').replace('<button', `<button data-monitor-id="${escapeHtml(id)}"`)}</footer></section></div>`
}

function renderOrderRecord(order: PmsInventoryOrder): string {
  const chain = order.processOrderNos.length > 0 ? order.processOrderNos.join(' → ') : '—'
  return `<article class="rounded-md border p-3 text-xs" data-${EVENT_PREFIX}-order-record="${escapeHtml(order.orderNo)}">
      <div class="flex items-center justify-between gap-2"><div class="flex items-center gap-2"><strong>${escapeHtml(order.orderNo)}</strong>${renderPmsStatusBadge(order.orderType, order.orderType === '采购单' ? 'blue' : 'green')}</div><span class="text-slate-500">${formatPmsTime(order.createdAt)}</span></div>
      <div class="mt-1 text-slate-600">${escapeHtml(order.materialName)}（${escapeHtml(order.materialCode)}）· ${formatPmsQty(order.qty, order.unit)} · 操作人 ${escapeHtml(order.createdBy)}</div>
      <div class="mt-1 text-slate-600">加工单号链：${escapeHtml(chain)}</div>
      ${order.orderType === '采购单' ? `<div class="mt-1 text-slate-600">供应商 ${escapeHtml(order.supplierName)} · 采购地区 ${escapeHtml(order.purchaseRegion || '—')} · 使用类型 ${escapeHtml(order.usageType || '—')}</div>` : `<div class="mt-1 text-slate-600">调出 ${escapeHtml(order.fromWarehouse)} → 调入 ${escapeHtml(order.toTarget)} · 同步加工单 ${order.syncProcessOrder ? '是' : '否'}</div>`}
      <details class="mt-2"><summary class="cursor-pointer text-blue-700">查看明细（${order.lines.length} 个 SKU）</summary><table class="mt-2 w-full text-left"><thead><tr class="text-slate-500"><th class="py-1">SKU</th><th class="py-1">名称</th><th class="py-1 text-right">数量</th></tr></thead><tbody>${order.lines.map((line) => `<tr class="border-t"><td class="py-1">${escapeHtml(line.sku)}</td><td class="py-1">${escapeHtml(line.skuName)}</td><td class="py-1 text-right tabular-nums">${formatPmsQty(line.qty, line.unit)}</td></tr>`).join('')}</tbody></table></details>
    </article>`
}

function renderRecordsOverlay(): string {
  const orders = listPmsInventoryOrders()
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="生成记录" data-pms-inv-records-root><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭生成记录"></button><section class="relative z-10 flex h-full w-[760px] max-w-[96vw] flex-col overflow-y-auto bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">生成记录</h2><p class="mt-1 text-xs text-slate-500">采购单 / 调拨单 · 加工单号链 · 操作人与明细</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-2 p-4" data-${EVENT_PREFIX}-record-list>${orders.length > 0 ? orders.map(renderOrderRecord).join('') : '<p class="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">暂无生成记录，请从监控行发起采购或调拨建单。</p>'}</div></section></div>`
}

function renderAddOverlay(): string {
  const monitored = new Set(listPmsInventoryMonitor().map((row) => row.materialCode))
  const candidates = listPmsMaterials().filter((material) => material.status === '已启用' && !monitored.has(material.materialCode))
  const warehouseNames = listPmsWarehouses().filter((warehouse) => warehouse.status === '启用').map((warehouse) => warehouse.warehouseName)
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="添加监控 SKU" data-pms-inv-add-root><section class="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl bg-background p-5 shadow-2xl"><header class="mb-4 flex items-center justify-between"><div><h2 class="font-semibold">添加监控 SKU</h2><p class="mt-1 text-xs text-slate-500">SKU 必填且不能与现有监控重复；添加后按补货规则参与监控。</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header>${renderPmsOverlayError(state.overlayError)}
    ${candidates.length > 0 ? `<div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">监控 SKU（必填）<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-add-field="sku" data-skip-page-rerender="true"><option value="">请选择物料 SKU</option>${candidates.map((material) => `<option value="${escapeHtml(material.materialCode)}">${escapeHtml(material.materialName)}（${escapeHtml(material.materialCode)}）</option>`).join('')}</select></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">监控仓库<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-add-field="warehouse" data-skip-page-rerender="true">${selectOptions(warehouseNames, '', '请选择仓库')}</select></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">当前库存<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" step="0.01" value="0" data-${EVENT_PREFIX}-add-field="stockQty" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">安全阈值<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0.01" step="0.01" value="100" data-${EVENT_PREFIX}-add-field="safetyThreshold" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">触发方式<select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-add-field="triggerMode" data-skip-page-rerender="true">${['比例', '固定'].map((value) => `<option value="${value}">${value}</option>`).join('')}</select></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">触发比例（0–1）<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" max="1" step="0.01" value="0.5" data-${EVENT_PREFIX}-add-field="triggerRatio" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">固定触发线<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" step="0.01" value="100" data-${EVENT_PREFIX}-add-field="fixedTrigger" data-skip-page-rerender="true" /></label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">目标库存<input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0.01" step="0.01" value="200" data-${EVENT_PREFIX}-add-field="targetStock" data-skip-page-rerender="true" /></label>
      <label class="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">备注<input class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-add-field="remark" data-skip-page-rerender="true" /></label>
    </div>` : '<p class="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">当前没有未监控的启用物料，无法新增监控 SKU。</p>'}
    <footer class="mt-4 flex items-center justify-end gap-2">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('添加监控', { prefix: EVENT_PREFIX, action: 'submit-add' }, 'plus').replace('<button', `<button ${candidates.length > 0 ? '' : 'disabled'}`)}</footer></section></div>`
}

function renderLogsOverlay(id: string): string {
  const row = getPmsInventoryMonitorRow(id)
  if (!row) return ''
  const logs = listPmsLogs('inventory-monitor', id)
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="库存监控日志" data-pms-inv-logs-root><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭日志"></button><section class="relative z-10 flex h-full w-[560px] max-w-[94vw] flex-col overflow-y-auto bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">${escapeHtml(row.materialName)} · 操作日志</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(row.materialCode)} · ${escapeHtml(row.warehouse)}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-2 p-4">${logs.length > 0 ? logs.map((log) => `<article class="rounded-md border p-3 text-xs"><div class="flex items-center justify-between"><strong>${escapeHtml(log.action)}</strong><span class="text-slate-500">${formatPmsTime(log.occurredAt)}</span></div><div class="mt-1 text-slate-600">${escapeHtml(log.actorName)}：${escapeHtml(log.beforeValue)} → ${escapeHtml(log.afterValue)}${log.reason ? `（${escapeHtml(log.reason)}）` : ''}</div></article>`).join('') : '<p class="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">暂无操作日志</p>'}</div></section></div>`
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-inv-column-overlays>${controller.renderColumnSettings()}</div>`
  if (!state.overlay) return `${columnSettings}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'rule') return `${columnSettings}${renderRuleOverlay(state.overlay.id)}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'order') return `${columnSettings}${renderOrderOverlay(state.overlay.id)}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'records') return `${columnSettings}${renderRecordsOverlay()}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'add') return `${columnSettings}${renderAddOverlay()}${renderPmsImagePreview()}`
  return `${columnSettings}${renderLogsOverlay(state.overlay.id)}${renderPmsImagePreview()}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
      showHeader: false,
    title: '面辅料库存监控',
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: renderFilters(),
    statsHtml: renderStats(),
    listTitle: `共 ${filteredRows().length} 条`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('批量刷新库存', { prefix: EVENT_PREFIX, action: 'refresh-stocks' }, 'refresh-cw')}${renderPrimaryButton('添加监控 SKU', { prefix: EVENT_PREFIX, action: 'open-add' }, 'plus')}${renderSecondaryButton('生成记录', { prefix: EVENT_PREFIX, action: 'open-records' }, 'eye')}${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-inv-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-inv-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-inv-overlays>${renderOverlays()}</div>`,
  })
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  root.innerHTML = renderInner()
  hydratePmsSurface(root)
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-inv-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydratePmsSurface(surface)
}

function closeOverlay(): void {
  state.overlay = null
  state.overlayError = ''
  refreshOverlays()
}

function exportRows(): void {
  const rows = filteredRows()
  if (rows.length === 0) {
    state.feedback = '当前查询条件下没有可导出的监控物料。'
    state.feedbackOk = false
    refreshAll()
    return
  }
  downloadPmsCsv(
    '面辅料库存监控.csv',
    ['物料编码', '物料名称', '仓库', '库存', '单位', '安全阈值', '触发方式', '触发线', '目标库存', '建议量', '加工工序链', '坯布 SPU', '坯布 SKU', '坯布名称', '坯布库存', '规则状态', '可调拨', '不可调拨原因', '可采购', '供应商', '提前期'],
    rows.map((row) => [row.materialCode, row.materialName, row.warehouse, row.stockQty, row.unit, row.safetyThreshold, row.triggerMode, row.triggerLine, row.targetStock, row.suggestedQty, formatPmsInventoryProcessChain(row.processChain), row.greigeSpu, row.greigeSku, row.greigeName, row.greigeStock, row.ruleStatus, row.canTransfer ? '是' : '否', row.transferBlockReason, row.canPurchase ? '是' : '否', row.supplierName, row.purchaseLeadTimeDays]),
  )
  state.feedback = `已导出 ${rows.length} 条监控物料（当前查询条件全量）。`
  state.feedbackOk = true
  refreshAll()
}

function readPurchaseItems(surface: HTMLElement): Array<{ sku: string; qty: number }> {
  return Array.from(surface.querySelectorAll<HTMLElement>(`[data-${EVENT_PREFIX}-purchase-row]`))
    .filter((rowNode) => rowNode.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-purchase-item]`)?.checked)
    .map((rowNode) => ({
      sku: rowNode.dataset.sku || '',
      qty: Number(rowNode.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-purchase-qty]`)?.value ?? Number.NaN),
    }))
}

export function renderPmsMaterialInventoryPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-pms-inv-root data-skip-page-rerender="true"><style>[data-pms-inv-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export function closePmsInventoryOverlays(): boolean {
  if (state.overlay) {
    closeOverlay()
    return true
  }
  if (state.showColumnSettings) {
    state.showColumnSettings = false
    refreshOverlays()
    return true
  }
  return false
}

export function handlePmsMaterialInventoryEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handlePmsCommonImageEvent(target, event, refreshOverlays)) return true
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    closeOverlay()
    return true
  }
  const orderTypeField = target.closest<HTMLSelectElement>(`[data-${EVENT_PREFIX}-order-type]`)
  if (orderTypeField && event?.type === 'change') {
    state.orderType = orderTypeField.value as PmsInventoryOrder['orderType']
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  const processToggle = target.closest<HTMLInputElement>(`[data-${EVENT_PREFIX}-rule-process]`)
  if (processToggle && event?.type === 'change') {
    const processName = (processToggle.dataset.pmsInvRuleProcess || '') as PmsInventoryProcess
    if (!PMS_INVENTORY_PROCESSES.includes(processName)) return true
    if (processToggle.checked) {
      if (!state.ruleProcessChain.includes(processName)) state.ruleProcessChain = [...state.ruleProcessChain, processName]
    } else {
      state.ruleProcessChain = state.ruleProcessChain.filter((item) => item !== processName)
    }
    const orderNode = target.closest<HTMLElement>('[data-pms-inv-rule-root]')?.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-process-order]`)
    if (orderNode) orderNode.textContent = formatPmsInventoryProcessChain(state.ruleProcessChain)
    return true
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  const fieldName = field?.dataset.pmsInvField
  if (field && fieldName) {
    if (fieldName === 'keyword') {
      state.keyword = field.value
      return true
    }
    if (fieldName === 'ruleFilter') {
      state.ruleFilter = field.value as InventoryPageState['ruleFilter']
      return true
    }
    if (fieldName === 'materialFilter') {
      state.materialFilter = field.value
      return true
    }
    if (fieldName === 'warehouseFilter') {
      state.warehouseFilter = field.value
      return true
    }
    if (fieldName === 'processFilter') {
      state.processFilter = field.value as InventoryPageState['processFilter']
      return true
    }
    if (fieldName === 'transferFilter') {
      state.transferFilter = field.value as TransferFilter
      return true
    }
    if (fieldName === 'pageSize') {
      controller.setPageSize(Number.parseInt((field as HTMLSelectElement).value, 10))
      controller.refresh({ overlays: false })
      return true
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset.pmsInvAction
  if (!action) return false
  if (action === 'query') {
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'reset') {
    state.keyword = ''
    state.ruleFilter = ''
    state.materialFilter = ''
    state.warehouseFilter = ''
    state.processFilter = ''
    state.transferFilter = ''
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'export') {
    exportRows()
    return true
  }
  if (action === 'refresh-stocks') {
    const result = refreshPmsInventoryStocks(BUYER)
    state.feedback = `已批量刷新 ${result.count} 条监控 SKU 的库存与刷新时间。`
    state.feedbackOk = true
    refreshAll()
    return true
  }
  if (action === 'open-column-settings') {
    state.showColumnSettings = true
    refreshOverlays()
    return true
  }
  if (action === 'close-column-settings') {
    state.showColumnSettings = false
    refreshOverlays()
    return true
  }
  if (action === 'restore-column-settings') {
    controller.restorePreferences()
    refreshOverlays()
    controller.refresh()
    return true
  }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const key = actionNode?.closest<HTMLElement>('[data-pms-inv-column-key]')?.dataset.pmsInvColumnKey || ''
    controller.updateColumnPreference(action, key, actionNode?.closest('input')?.checked)
    refreshOverlays()
    controller.refresh()
    return true
  }
  if (action === 'prev-page' || action === 'next-page') {
    controller.stepPage(action === 'next-page' ? 1 : -1)
    controller.refresh({ overlays: false })
    return true
  }
  if (action === 'sort-column') {
    controller.cycleSort(actionNode?.dataset.columnKey || '')
    controller.refresh()
    return true
  }
  if (action === 'open-rule' || action === 'open-order' || action === 'open-logs') {
    const id = actionNode?.dataset.monitorId || ''
    state.overlay = action === 'open-rule' ? { kind: 'rule', id } : action === 'open-order' ? { kind: 'order', id } : { kind: 'logs', id }
    state.overlayError = ''
    const row = getPmsInventoryMonitorRow(id)
    if (action === 'open-rule') state.ruleProcessChain = row ? [...row.processChain] : []
    if (action === 'open-order') state.orderType = row?.canPurchase ? '采购单' : '调拨单'
    refreshOverlays()
    return true
  }
  if (action === 'open-records') {
    state.overlay = { kind: 'records' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-add') {
    state.overlay = { kind: 'add' }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'submit-rule') {
    const id = actionNode?.dataset.monitorId || ''
    const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-inv-rule-root]')
    if (!surface) return true
    try {
      const row = updatePmsInventoryRule(
        id,
        {
          safetyThreshold: readNumberField(surface, `[data-${EVENT_PREFIX}-rule-field="safetyThreshold"]`),
          triggerMode: readTextField(surface, `[data-${EVENT_PREFIX}-rule-field="triggerMode"]`) as PmsInventoryTriggerMode,
          triggerRatio: readNumberField(surface, `[data-${EVENT_PREFIX}-rule-field="triggerRatio"]`),
          fixedTrigger: readNumberField(surface, `[data-${EVENT_PREFIX}-rule-field="fixedTrigger"]`),
          targetStock: readNumberField(surface, `[data-${EVENT_PREFIX}-rule-field="targetStock"]`),
          processChain: state.ruleProcessChain,
          greigeSpu: readTextField(surface, `[data-${EVENT_PREFIX}-rule-field="greigeSpu"]`),
          greigeSku: readTextField(surface, `[data-${EVENT_PREFIX}-rule-field="greigeSku"]`),
          greigeName: readTextField(surface, `[data-${EVENT_PREFIX}-rule-field="greigeName"]`),
          greigeStock: readNumberField(surface, `[data-${EVENT_PREFIX}-rule-field="greigeStock"]`),
          remark: readTextField(surface, `[data-${EVENT_PREFIX}-rule-field="remark"]`),
        },
        BUYER,
      )
      state.feedback = `${row.materialName} 规则已保存：触发线 ${row.triggerLine}，建议量 ${row.suggestedQty}，工序 ${formatPmsInventoryProcessChain(row.processChain)}，状态 ${row.ruleStatus}。`
      state.feedbackOk = true
      state.overlay = null
      state.overlayError = ''
      refreshAll()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '保存规则失败'
      refreshOverlays()
    }
    return true
  }
  if (action === 'submit-add') {
    const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-inv-add-root]')
    if (!surface) return true
    try {
      const row = createPmsInventoryMonitorRow(
        {
          materialCode: readTextField(surface, `[data-${EVENT_PREFIX}-add-field="sku"]`),
          warehouse: readTextField(surface, `[data-${EVENT_PREFIX}-add-field="warehouse"]`),
          stockQty: readNumberField(surface, `[data-${EVENT_PREFIX}-add-field="stockQty"]`),
          safetyThreshold: readNumberField(surface, `[data-${EVENT_PREFIX}-add-field="safetyThreshold"]`),
          triggerMode: readTextField(surface, `[data-${EVENT_PREFIX}-add-field="triggerMode"]`) as PmsInventoryTriggerMode,
          triggerRatio: readNumberField(surface, `[data-${EVENT_PREFIX}-add-field="triggerRatio"]`),
          fixedTrigger: readNumberField(surface, `[data-${EVENT_PREFIX}-add-field="fixedTrigger"]`),
          targetStock: readNumberField(surface, `[data-${EVENT_PREFIX}-add-field="targetStock"]`),
          remark: readTextField(surface, `[data-${EVENT_PREFIX}-add-field="remark"]`),
        },
        BUYER,
      )
      state.feedback = `已添加监控 SKU ${row.materialCode}（${row.warehouse}），当前状态 ${row.ruleStatus}。`
      state.feedbackOk = true
      state.overlay = null
      state.overlayError = ''
      refreshAll()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '添加监控 SKU 失败'
      refreshOverlays()
    }
    return true
  }
  if (action === 'submit-order') {
    const id = actionNode?.dataset.monitorId || ''
    const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-inv-order-root]')
    if (!surface) return true
    try {
      const orderType = readTextField(surface, `[data-${EVENT_PREFIX}-order-type]`) as PmsInventoryOrder['orderType']
      let order: PmsInventoryOrder
      if (orderType === '采购单') {
        const items = readPurchaseItems(surface)
        if (items.length === 0) throw new PmsDomainError('INVENTORY_ITEMS_REQUIRED', '请至少勾选一个 SKU 并填写采购数量')
        order = generatePmsInventoryOrder(id, orderType, items.reduce((sum, item) => sum + item.qty, 0), BUYER, {
          supplierName: readTextField(surface, `[data-${EVENT_PREFIX}-purchase-field="supplier"]`),
          purchaseRegion: readTextField(surface, `[data-${EVENT_PREFIX}-purchase-field="region"]`) as PmsPurchaseRegion,
          usageType: readTextField(surface, `[data-${EVENT_PREFIX}-purchase-field="usage"]`) as PmsInventoryUsageType,
          items,
        })
      } else {
        order = generatePmsInventoryOrder(id, orderType, readNumberField(surface, `[data-${EVENT_PREFIX}-order-qty]`), BUYER, {
          fromWarehouse: readTextField(surface, `[data-${EVENT_PREFIX}-transfer-field="from"]`),
          toWarehouse: readTextField(surface, `[data-${EVENT_PREFIX}-transfer-field="to"]`),
          syncProcessOrder: Boolean(surface.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-sync-process]`)?.checked),
        })
      }
      state.feedback = `已创建${order.orderType} ${order.orderNo}（${order.lines.length} 个 SKU · ${formatPmsQty(order.qty, order.unit)}）${order.processOrderNos.length > 0 ? `，同步加工单 ${order.processOrderNos.join(' → ')}` : ''}。`
      state.feedbackOk = true
      state.overlay = null
      state.overlayError = ''
      refreshAll()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '建单失败'
      refreshOverlays()
    }
    return true
  }
  if (action === 'close-overlay') {
    closeOverlay()
    return true
  }
  return false
}
