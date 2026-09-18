// @page-pattern: list
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats } from '../../components/ui/process-order-list-presentation.ts'
import { renderDangerButton, renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import {
  advancePmsProductPurchaseOrderStatus,
  checkPmsGenerateMaterialRequirement,
  closePmsProductPurchaseOrder,
  createPmsProductPurchaseOrders,
  defaultPmsSkuPrice,
  generatePmsMaterialRequirement,
  getPmsProductPurchaseOrder,
  listPmsPpoLogs,
  listPmsProductPurchaseOrders,
  pmsAllowedNextStatuses,
  pmsProductPurchaseOrderAmount,
  pmsProductPurchaseOrderLineAmount,
  updatePmsProductPurchaseOrder,
  type PmsProductPurchaseOrder,
  type PmsProductPurchaseOrderStatus,
  type PmsPurchaseRegion,
  type PmsYesNo,
} from '../../data/pms/product-purchase-orders.ts'
import { listPmsSuggestionViews, type PmsSuggestionView } from '../../data/pms/purchase-suggestions.ts'
import { nextPmsActionId, PMS_BUYER_ACTOR, PMS_MANAGER_ACTOR, PmsDomainError } from '../../data/pms/runtime.ts'
import { downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import {
  formatPmsMoney,
  formatPmsQty,
  formatPmsTime,
  handlePmsCommonImageEvent,
  hydratePmsSurface,
  readTextField,
  renderPmsBusinessImage,
  renderPmsFeedback,
  renderPmsImagePreview,
  renderPmsOverlayError,
  renderPmsStatusBadge,
} from './shared.ts'

type PpoOverlay =
  | null
  | { kind: 'detail'; purchaseOrderNo: string; clientActionId: string }
  | { kind: 'create'; clientActionId: string }
  | { kind: 'edit'; purchaseOrderNo: string; clientActionId: string }
  | { kind: 'close'; purchaseOrderNo: string; clientActionId: string }
  | { kind: 'generate'; purchaseOrderNo: string; clientActionId: string }

interface PpoPageState extends ProcessOrderListControllerState {
  keyword: string
  status: '' | PmsProductPurchaseOrderStatus
  purchaseType: '' | PmsProductPurchaseOrder['purchaseType']
  blockedOnly: boolean
  overlay: PpoOverlay
  overlayError: string
  feedback: string
  feedbackOk: boolean
}

const EVENT_PREFIX = 'pms-ppo'
const ROOT_SELECTOR = '[data-pms-ppo-root]'
const SUPPLIERS = ['广州华盛制衣有限公司', '佛山成衣加工厂', '中山针织制衣有限公司', '苏州户外服饰有限公司', '宁波衬衫制造有限公司', '杭州女装制衣有限公司', '杭州样衣开发中心']
const WAREHOUSES = ['印尼雅加达成品仓', '广州原料仓', '杭州样衣仓']
const REGIONS: PmsPurchaseRegion[] = ['国内', '印尼', '其他']
const DEFAULT_LINE_WEIGHT = 0.35

const state: PpoPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  status: '',
  purchaseType: '',
  blockedOnly: false,
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
}

function filteredRows(): PmsProductPurchaseOrder[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listPmsProductPurchaseOrders().filter((order) => {
    if (state.status && order.status !== state.status) return false
    if (state.purchaseType && order.purchaseType !== state.purchaseType) return false
    if (state.blockedOnly && !order.lines.some((line) => line.needBom && !line.bomMatched)) return false
    if (!keyword) return true
    return [order.purchaseOrderNo, order.spu, order.productName, order.supplierName, purchaserName(order), ...order.lines.map((line) => line.sku)].some((value) => value.toLowerCase().includes(keyword))
  })
}

function statusTone(status: PmsProductPurchaseOrderStatus): 'blue' | 'green' | 'yellow' | 'red' | 'slate' {
  if (status === '待采购' || status === '待确认') return 'yellow'
  if (status === '已确认' || status === '已发货') return 'blue'
  if (status === '已完成' || status === '已入库' || status === '已到货') return 'green'
  if (status === '已关闭') return 'slate'
  return 'slate'
}

function materialStatusTone(status: string): 'blue' | 'green' | 'yellow' | 'red' | 'slate' {
  if (status === '已下推') return 'green'
  if (status === '已生成') return 'blue'
  if (status === '未生成') return 'yellow'
  if (status === '不需要') return 'slate'
  return 'red'
}

function purchaserName(order: PmsProductPurchaseOrder): string {
  return order.purchaser || order.creator
}

function lineBomStatus(line: PmsProductPurchaseOrder['lines'][number]): '已匹配' | '未匹配' {
  return line.bomStatus ?? (line.bomMatched ? '已匹配' : '未匹配')
}

function bomStatusTone(status: '已匹配' | '未匹配'): 'green' | 'red' {
  return status === '已匹配' ? 'green' : 'red'
}

function yesNo(value: PmsYesNo | undefined): PmsYesNo {
  return value === '是' ? '是' : '否'
}

const columns: StandardListColumn<PmsProductPurchaseOrder>[] = [
  {
    key: 'order',
    title: '采购单 / 状态',
    width: 210,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (order) => order.purchaseOrderNo,
    render: (order) => `<div class="font-semibold">${escapeHtml(order.purchaseOrderNo)}</div><div class="mt-1">${renderPmsStatusBadge(order.status, statusTone(order.status))}</div><div class="mt-1 text-xs text-slate-500">V${order.version} · ${escapeHtml(order.creator)}</div>${order.closedReason ? `<div class="mt-1 text-xs text-slate-500">关闭：${escapeHtml(order.closedReason)}</div>` : ''}`,
  },
  {
    key: 'product',
    title: '款式与 SKU',
    width: 250,
    required: true,
    freezeable: true,
    render: (order) => `<div class="flex items-center gap-3">${renderPmsBusinessImage(order.imageUrl, `${order.productName}（${order.spu}）款式图`, 'h-12 w-12')}<div><div class="font-medium">${escapeHtml(order.productName)}</div><div class="text-xs text-slate-500">${escapeHtml(order.spu)} · ${escapeHtml(order.purchaseType)} · ${escapeHtml(order.area)}</div><div class="text-xs text-slate-500">${order.lines.length} 个 SKU</div></div></div>`,
  },
  {
    key: 'supplier',
    title: '供应商 / 仓库',
    width: 190,
    sortable: true,
    sortValue: (order) => order.supplierName,
    render: (order) => `<div class="font-medium">${escapeHtml(order.supplierName)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(order.warehouse)}</div>`,
  },
  {
    key: 'purchaser',
    title: '采购专员',
    width: 110,
    sortable: true,
    sortValue: (order) => purchaserName(order),
    render: (order) => `<div class="text-sm">${escapeHtml(purchaserName(order))}</div>${yesNo(order.isUrgent) === '是' ? '<div class="mt-1 text-xs text-red-700">加急</div>' : ''}${yesNo(order.isFirstOrder) === '是' ? '<div class="mt-1 text-xs text-blue-700">首单</div>' : ''}`,
  },
  {
    key: 'delivery',
    title: '下单 / 期望交期',
    width: 170,
    sortable: true,
    sortValue: (order) => order.orderedAt,
    render: (order) => `<div class="text-sm">${formatPmsTime(order.orderedAt)}</div><div class="mt-1 text-xs text-slate-500">期望 ${escapeHtml(order.expectedDeliveryDate || '—')}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(order.sourceSuggestionNo ? `来源 ${order.sourceSuggestionNo}` : '手工创建')}</div>`,
  },
  {
    key: 'amount',
    title: '数量 / 金额',
    width: 180,
    sortable: true,
    sortValue: (order) => pmsProductPurchaseOrderAmount(order),
    render: (order) => `<div class="text-sm tabular-nums">${formatPmsQty(order.lines.reduce((sum, line) => sum + line.qty, 0), '件')}</div><div class="mt-1 text-sm font-semibold tabular-nums">${formatPmsMoney(pmsProductPurchaseOrderAmount(order))}</div>`,
  },
  {
    key: 'material',
    title: '面辅料状态',
    width: 150,
    render: (order) => {
      const statuses = [...new Set(order.lines.map((line) => (line.needBom ? line.materialStatus : '不需要')))]
      return `<div class="space-y-1">${statuses.map((status) => renderPmsStatusBadge(status, materialStatusTone(status))).join('')}</div>${order.lines.some((line) => line.needBom && !line.bomMatched) ? '<div class="mt-1 text-xs text-red-700">BOM 未匹配</div>' : ''}`
    },
  },
  {
    key: 'actions',
    title: '操作',
    width: 240,
    actionColumn: true,
    render: (order) => {
      const editable = order.status === '草稿' || order.status === '待采购' || order.status === '待确认'
      const canGenerate = checkPmsGenerateMaterialRequirement(order.purchaseOrderNo).ok
      return `<div class="flex items-center justify-end gap-1.5">
        <button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-detail" data-order-no="${escapeHtml(order.purchaseOrderNo)}" data-skip-page-rerender="true">详情</button>
        <button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-edit" data-order-no="${escapeHtml(order.purchaseOrderNo)}" data-skip-page-rerender="true" ${editable ? '' : 'disabled'}>编辑</button>
        <button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-generate" data-order-no="${escapeHtml(order.purchaseOrderNo)}" data-skip-page-rerender="true" ${canGenerate ? '' : 'disabled'}>生成需求</button>
      </div>`
    },
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/product-purchase-orders',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-ppo-table-surface]',
  paginationSurfaceSelector: '[data-pms-ppo-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-ppo-overlays]',
  defaultFrozenKeys: ['order', 'product'],
  columnSettingsTitle: '商品采购单列设置',
  emptyText: '当前条件下暂无商品采购单',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof window === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function readRouteFilterFromLocation(): void {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  if (params.get('bomMatched') === '未匹配') state.blockedOnly = true
}

function renderFilters(): string {
  const statuses: Array<'' | PmsProductPurchaseOrderStatus> = ['', '草稿', '待采购', '待确认', '已确认', '已发货', '已到货', '已入库', '已完成', '已关闭']
  const statusOptions = statuses.map((value) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${value || '全部状态'}</option>`).join('')
  const typeOptions = ['', '做货', '成衣', '样衣'].map((value) => `<option value="${value}" ${state.purchaseType === value ? 'selected' : ''}>${value || '全部采购类型'}</option>`).join('')
  const advancedCount = (state.purchaseType ? 1 : 0) + (state.blockedOnly ? 1 : 0)
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="采购单号 / 款号 / 供应商 / SKU" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">采购单状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="status" data-skip-page-rerender="true">${statusOptions}</select></label>
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">采购类型</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="purchaseType" data-skip-page-rerender="true">${typeOptions}</select></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">BOM 匹配</span><span class="flex h-9 items-center gap-2 text-sm text-slate-700"><input type="checkbox" data-${EVENT_PREFIX}-field="blockedOnly" ${state.blockedOnly ? 'checked' : ''} data-skip-page-rerender="true" />仅看 BOM 未匹配</span></label>
    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
    ${renderSecondaryButton('新建采购单', { prefix: EVENT_PREFIX, action: 'open-create' }, 'plus')}
    ${renderProcessFilterToggle(advancedCount, 'button')}
    </div></div>`
}

function renderStats(): string {
  const rows = filteredRows()
  const pending = rows.filter((order) => order.status === '待采购' || order.status === '待确认').length
  const blocked = rows.filter((order) => order.lines.some((line) => line.needBom && !line.bomMatched)).length
  const generated = rows.filter((order) => order.lines.some((line) => line.materialStatus === '已生成' || line.materialStatus === '已下推')).length
  return renderProcessOrderStats([
    { label: '采购单总数', value: rows.length },
    { label: '待处理', value: pending },
    { label: 'BOM 未匹配', value: blocked },
    { label: '已生成面辅料需求', value: generated },
  ])
}

function renderLineRows(order: PmsProductPurchaseOrder): string {
  return order.lines
    .map((line) => {
      const bomStatus = lineBomStatus(line)
      return `<tr class="border-b last:border-b-0"><td class="px-3 py-2 text-sm">${escapeHtml(line.sku)}</td><td class="px-3 py-2 text-sm">${escapeHtml(line.color)} / ${escapeHtml(line.size)}</td><td class="px-3 py-2 text-sm">${escapeHtml(line.needBom ? line.bomNo || '—' : '—')}</td><td class="px-3 py-2 text-sm">${escapeHtml(line.needBom ? line.bomVersion || '—' : '—')}</td><td class="px-3 py-2">${line.needBom ? renderPmsStatusBadge(bomStatus, bomStatusTone(bomStatus)) : '—'}</td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(line.qty, '件')}</td><td class="px-3 py-2 text-sm tabular-nums">${line.deliveredQty ? formatPmsQty(line.deliveredQty, '件') : '—'}</td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsMoney(line.standardPrice)}</td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsMoney(line.actualPrice)}</td><td class="px-3 py-2 text-sm font-semibold tabular-nums">${formatPmsMoney(pmsProductPurchaseOrderLineAmount(line))}</td><td class="px-3 py-2 text-sm">${escapeHtml(line.applicant || '—')}</td><td class="px-3 py-2 text-sm">${escapeHtml(line.creator || '—')}</td><td class="px-3 py-2 text-sm tabular-nums">${line.weight === undefined ? '—' : `${line.weight} kg`}</td><td class="px-3 py-2">${line.needBom ? (line.bomMatched ? renderPmsStatusBadge(line.materialStatus, materialStatusTone(line.materialStatus)) : renderPmsStatusBadge('BOM 未匹配', 'red')) : renderPmsStatusBadge('不需要', 'slate')}</td></tr>`
    })
    .join('')
}

function renderDetailOverlay(purchaseOrderNo: string): string {
  const order = getPmsProductPurchaseOrder(purchaseOrderNo)
  if (!order) return ''
  const logs = listPmsPpoLogs(purchaseOrderNo)
  const nextStatuses = pmsAllowedNextStatuses(order.status)
  const check = checkPmsGenerateMaterialRequirement(purchaseOrderNo)
  const advanceButtons = nextStatuses
    .map((status) => renderSecondaryButton(`推进为${status}`, { prefix: EVENT_PREFIX, action: 'advance-status' }, 'arrow-right').replace('<button', `<button data-order-no="${escapeHtml(order.purchaseOrderNo)}" data-next-status="${status}"`))
    .join('')
  const logItems = logs.length
    ? logs.map((log) => `<li class="rounded-md border p-3 text-xs"><div class="flex items-center justify-between"><strong>${escapeHtml(log.action)}</strong><span class="text-slate-500">${formatPmsTime(log.occurredAt)}</span></div><div class="mt-1 text-slate-600">${escapeHtml(log.actorName)}：${escapeHtml(log.beforeValue)} → ${escapeHtml(log.afterValue)}${log.reason ? `（${escapeHtml(log.reason)}）` : ''}</div></li>`).join('')
    : '<li class="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">暂无操作日志</li>'
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="商品采购单详情"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭详情"></button><section class="relative z-10 flex h-full w-[920px] max-w-[94vw] flex-col overflow-y-auto bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">${escapeHtml(order.purchaseOrderNo)} · ${escapeHtml(order.productName)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(order.supplierName)} · ${escapeHtml(order.warehouse)} · V${order.version}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-5 p-4">
    <div class="flex items-center gap-4">${renderPmsBusinessImage(order.imageUrl, `${order.productName}（${order.spu}）款式图`, 'h-20 w-20')}<dl class="grid flex-1 grid-cols-3 gap-3 text-sm"><div><dt class="text-xs text-muted-foreground">状态</dt><dd class="mt-1">${renderPmsStatusBadge(order.status, statusTone(order.status))}</dd></div><div><dt class="text-xs text-muted-foreground">采购类型</dt><dd class="mt-1">${escapeHtml(order.purchaseType)}</dd></div><div><dt class="text-xs text-muted-foreground">采购区域</dt><dd class="mt-1">${escapeHtml(order.productionArea || order.area)}</dd></div><div><dt class="text-xs text-muted-foreground">采购专员</dt><dd class="mt-1">${escapeHtml(purchaserName(order))}</dd></div><div><dt class="text-xs text-muted-foreground">是否加急</dt><dd class="mt-1">${yesNo(order.isUrgent)}</dd></div><div><dt class="text-xs text-muted-foreground">是否首单</dt><dd class="mt-1">${yesNo(order.isFirstOrder)}</dd></div><div><dt class="text-xs text-muted-foreground">期望交期</dt><dd class="mt-1">${escapeHtml(order.expectedDeliveryDate || '—')}</dd></div><div><dt class="text-xs text-muted-foreground">采购金额</dt><dd class="mt-1 font-semibold tabular-nums">${formatPmsMoney(pmsProductPurchaseOrderAmount(order))}</dd></div><div><dt class="text-xs text-muted-foreground">来源建议</dt><dd class="mt-1">${escapeHtml(order.sourceSuggestionNo || '手工创建')}</dd></div><div class="col-span-3"><dt class="text-xs text-muted-foreground">采购备注</dt><dd class="mt-1 text-slate-600">${escapeHtml(order.remark || '—')}</dd></div></dl></div>
    <section class="overflow-x-auto rounded-lg border"><table class="w-full min-w-[1180px] table-fixed text-left"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">SKU</th><th class="px-3 py-2">颜色 / 尺码</th><th class="px-3 py-2">BOM 编号</th><th class="px-3 py-2">BOM 版本</th><th class="px-3 py-2">BOM 状态</th><th class="px-3 py-2">采购数量</th><th class="px-3 py-2">已交付</th><th class="px-3 py-2">标准采购价</th><th class="px-3 py-2">实际单价</th><th class="px-3 py-2">采购金额</th><th class="px-3 py-2">申请人</th><th class="px-3 py-2">添加人</th><th class="px-3 py-2">重量</th><th class="px-3 py-2">面辅料状态</th></tr></thead><tbody>${renderLineRows(order)}</tbody><tfoot class="border-t bg-muted/30 text-sm"><tr><td class="px-3 py-2 font-semibold" colspan="5">采购金额汇总</td><td class="px-3 py-2 font-semibold tabular-nums">${formatPmsQty(order.lines.reduce((sum, line) => sum + line.qty, 0), '件')}</td><td class="px-3 py-2">—</td><td class="px-3 py-2">—</td><td class="px-3 py-2">—</td><td class="px-3 py-2 font-semibold tabular-nums">${formatPmsMoney(pmsProductPurchaseOrderAmount(order))}</td><td class="px-3 py-2 text-xs text-slate-500" colspan="4">按行采购金额求和</td></tr></tfoot></table></section>
    <section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">可执行动作</h3><div class="mt-3 flex flex-wrap items-center gap-2">${advanceButtons}${renderSecondaryButton('生成面辅料需求', { prefix: EVENT_PREFIX, action: 'open-generate' }, 'file-plus-2').replace('<button', `<button data-order-no="${escapeHtml(order.purchaseOrderNo)}" ${check.ok ? '' : 'disabled'}`)}${renderDangerButton('关闭采购单', { prefix: EVENT_PREFIX, action: 'open-close' }, 'x-circle').replace('<button', `<button data-order-no="${escapeHtml(order.purchaseOrderNo)}"`)}</div>${check.ok ? '' : `<p class="mt-2 text-xs text-amber-700">当前不可生成面辅料需求：${escapeHtml(check.reason)}</p>`}</section>
    <section><h3 class="mb-2 text-sm font-semibold">操作日志</h3><ul class="space-y-2">${logItems}</ul></section>
  </div></section></div>`
}

function renderSuggestionCatalog(): PmsSuggestionView[] {
  return listPmsSuggestionViews()
}

function renderCreateOverlay(): string {
  const catalog = renderSuggestionCatalog()
  const options = catalog.map((row) => `<option value="${escapeHtml(row.spu)}">${escapeHtml(row.productName)} · ${escapeHtml(row.spu)} · ${escapeHtml(row.purchaseType)}</option>`).join('')
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="新建商品采购单" data-pms-ppo-create-root><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭新建"></button><section class="relative z-10 flex h-full w-[760px] max-w-[94vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">新建商品采购单</h2><p class="mt-1 text-xs text-slate-500">选择款式后勾选 SKU 并填写数量与单价；做货 SKU 需要 BOM 已匹配</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="flex-1 space-y-4 overflow-y-auto p-4">${renderPmsOverlayError(state.overlayError)}
    <div class="grid grid-cols-2 gap-3">
      <label class="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">款式
        <select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-create-field="spu">${options}</select>
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">供应商
        <select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-create-field="supplierName">${SUPPLIERS.map((supplier) => `<option value="${escapeHtml(supplier)}">${escapeHtml(supplier)}</option>`).join('')}</select>
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">目标仓库
        <select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-create-field="warehouse">${WAREHOUSES.map((warehouse) => `<option value="${escapeHtml(warehouse)}">${escapeHtml(warehouse)}</option>`).join('')}</select>
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">采购专员
        <input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(PMS_BUYER_ACTOR.name)}" placeholder="必填" data-${EVENT_PREFIX}-create-field="purchaser" data-skip-page-rerender="true" />
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">采购区域
        <select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-create-field="productionArea"><option value="">请选择采购区域</option>${REGIONS.map((region) => `<option value="${escapeHtml(region)}">${escapeHtml(region)}</option>`).join('')}</select>
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">期望交期
        <input class="h-9 rounded-md border bg-background px-2 text-sm" type="date" value="2026-07-31" data-${EVENT_PREFIX}-create-field="expectedDeliveryDate" data-skip-page-rerender="true" />
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">采购备注
        <input class="h-9 rounded-md border bg-background px-2 text-sm" placeholder="选填" data-${EVENT_PREFIX}-create-field="remark" data-skip-page-rerender="true" />
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">是否加急
        <select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-create-field="isUrgent"><option value="否">否</option><option value="是">是</option></select>
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">是否首单
        <select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-create-field="isFirstOrder"><option value="否">否</option><option value="是">是</option></select>
      </label>
    </div>
    <div class="overflow-hidden rounded-lg border"><table class="w-full table-fixed text-left"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="w-16 px-3 py-2">选择</th><th class="w-48 px-3 py-2">SKU</th><th class="w-32 px-3 py-2">颜色 / 尺码</th><th class="w-32 px-3 py-2">数量</th><th class="w-32 px-3 py-2">单价</th><th class="w-28 px-3 py-2">重量(kg)</th></tr></thead><tbody data-${EVENT_PREFIX}-create-sku-body>${catalog[0] ? catalog[0].skuItems.map((sku) => renderCreateSkuRow(sku.sku, sku.color, sku.size, defaultPmsSkuPrice(sku.sku), 0)).join('') : '<tr><td class="px-3 py-6 text-center text-sm text-muted-foreground" colspan="6">暂无可采购 SKU</td></tr>'}</tbody></table></div>
    <p class="text-xs text-slate-500">新建后采购单进入“待采购”，可继续编辑或推进状态。</p>
  </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('保存采购单', { prefix: EVENT_PREFIX, action: 'submit-create' }, 'check-check')}</footer></section></div>`
}

function renderCreateSkuRow(sku: string, color: string, size: string, price: number, qty: number): string {
  return `<tr class="border-b last:border-b-0"><td class="px-3 py-2"><input type="checkbox" data-${EVENT_PREFIX}-create-check="${escapeHtml(sku)}" data-skip-page-rerender="true" /></td><td class="px-3 py-2 text-sm">${escapeHtml(sku)}</td><td class="px-3 py-2 text-sm">${escapeHtml(color)} / ${escapeHtml(size)}</td><td class="px-3 py-2"><input class="h-8 w-24 rounded-md border px-2 text-sm" type="number" min="1" step="1" value="${qty || ''}" data-${EVENT_PREFIX}-create-qty="${escapeHtml(sku)}" data-skip-page-rerender="true" /></td><td class="px-3 py-2"><input class="h-8 w-24 rounded-md border px-2 text-sm" type="number" min="0" step="0.1" value="${price}" data-${EVENT_PREFIX}-create-price="${escapeHtml(sku)}" data-skip-page-rerender="true" /></td><td class="px-3 py-2"><input class="h-8 w-24 rounded-md border px-2 text-sm" type="number" min="0" step="0.01" value="${DEFAULT_LINE_WEIGHT}" data-${EVENT_PREFIX}-create-weight="${escapeHtml(sku)}" data-skip-page-rerender="true" /></td></tr>`
}

function refreshCreateSkuBody(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-ppo-create-root]')
  if (!surface) return
  const spu = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-create-field="spu"]`)
  const catalogRow = renderSuggestionCatalog().find((row) => row.spu === spu)
  const body = surface.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-create-sku-body]`)
  if (!body) return
  body.innerHTML = catalogRow
    ? catalogRow.skuItems.map((sku) => renderCreateSkuRow(sku.sku, sku.color, sku.size, defaultPmsSkuPrice(sku.sku), 0)).join('')
    : '<tr><td class="px-3 py-6 text-center text-sm text-muted-foreground" colspan="6">暂无可采购 SKU</td></tr>'
  hydratePmsSurface(body)
}

function renderEditOverlay(purchaseOrderNo: string): string {
  const order = getPmsProductPurchaseOrder(purchaseOrderNo)
  if (!order) return ''
  const lineRows = order.lines
    .map((line) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 text-sm">${escapeHtml(line.sku)}</td><td class="px-3 py-2 text-sm">${escapeHtml(line.color)} / ${escapeHtml(line.size)}</td><td class="px-3 py-2"><input class="h-8 w-24 rounded-md border px-2 text-sm" type="number" min="1" step="1" value="${line.qty}" data-${EVENT_PREFIX}-edit-qty="${escapeHtml(line.lineId)}" data-skip-page-rerender="true" /></td><td class="px-3 py-2"><input class="h-8 w-24 rounded-md border px-2 text-sm" type="number" min="0" step="0.1" value="${line.actualPrice}" data-${EVENT_PREFIX}-edit-price="${escapeHtml(line.lineId)}" data-skip-page-rerender="true" /></td><td class="px-3 py-2"><input class="h-8 w-24 rounded-md border px-2 text-sm" type="number" min="0" step="0.01" value="${line.weight ?? DEFAULT_LINE_WEIGHT}" data-${EVENT_PREFIX}-edit-weight="${escapeHtml(line.lineId)}" data-skip-page-rerender="true" /></td></tr>`)
    .join('')
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="编辑商品采购单" data-pms-ppo-edit-root><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭编辑"></button><section class="relative z-10 flex h-full w-[720px] max-w-[94vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">编辑 ${escapeHtml(order.purchaseOrderNo)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(order.productName)} · 当前 V${order.version} · 保存后版本号 +1</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="flex-1 space-y-4 overflow-y-auto p-4">${renderPmsOverlayError(state.overlayError)}
    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">供应商
        <select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-edit-field="supplierName">${SUPPLIERS.map((supplier) => `<option value="${escapeHtml(supplier)}" ${supplier === order.supplierName ? 'selected' : ''}>${escapeHtml(supplier)}</option>`).join('')}</select>
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">目标仓库
        <select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-edit-field="warehouse">${WAREHOUSES.map((warehouse) => `<option value="${escapeHtml(warehouse)}" ${warehouse === order.warehouse ? 'selected' : ''}>${escapeHtml(warehouse)}</option>`).join('')}</select>
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">采购专员
        <input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(purchaserName(order))}" data-${EVENT_PREFIX}-edit-field="purchaser" data-skip-page-rerender="true" />
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">采购区域
        <select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-edit-field="productionArea"><option value="">请选择采购区域</option>${REGIONS.map((region) => `<option value="${escapeHtml(region)}" ${region === (order.productionArea || order.area) ? 'selected' : ''}>${escapeHtml(region)}</option>`).join('')}</select>
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">期望交期
        <input class="h-9 rounded-md border bg-background px-2 text-sm" type="date" value="${escapeHtml(order.expectedDeliveryDate)}" data-${EVENT_PREFIX}-edit-field="expectedDeliveryDate" data-skip-page-rerender="true" />
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">采购备注
        <input class="h-9 rounded-md border bg-background px-2 text-sm" value="${escapeHtml(order.remark)}" data-${EVENT_PREFIX}-edit-field="remark" data-skip-page-rerender="true" />
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">是否加急
        <select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-edit-field="isUrgent"><option value="否" ${yesNo(order.isUrgent) === '否' ? 'selected' : ''}>否</option><option value="是" ${yesNo(order.isUrgent) === '是' ? 'selected' : ''}>是</option></select>
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">是否首单
        <select class="h-9 rounded-md border bg-background px-2 text-sm" data-${EVENT_PREFIX}-edit-field="isFirstOrder"><option value="否" ${yesNo(order.isFirstOrder) === '否' ? 'selected' : ''}>否</option><option value="是" ${yesNo(order.isFirstOrder) === '是' ? 'selected' : ''}>是</option></select>
      </label>
    </div>
    <div class="overflow-hidden rounded-lg border"><table class="w-full table-fixed text-left"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">SKU</th><th class="px-3 py-2">颜色 / 尺码</th><th class="px-3 py-2">数量</th><th class="px-3 py-2">单价</th><th class="px-3 py-2">重量(kg)</th></tr></thead><tbody>${lineRows}</tbody></table></div>
  </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('保存修改', { prefix: EVENT_PREFIX, action: 'submit-edit' }, 'check-check')}</footer></section></div>`
}

function renderCloseOverlay(purchaseOrderNo: string): string {
  const order = getPmsProductPurchaseOrder(purchaseOrderNo)
  if (!order) return ''
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="关闭商品采购单" data-pms-ppo-close-root><section class="w-full max-w-lg rounded-xl bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">关闭 ${escapeHtml(purchaseOrderNo)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(order.productName)} · ${escapeHtml(order.status)} · 关闭后不可恢复</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-3 p-4">${renderPmsOverlayError(state.overlayError)}<label class="flex flex-col gap-1 text-xs text-muted-foreground">关闭原因（必填）
    <textarea class="min-h-24 rounded-md border bg-background p-2 text-sm" placeholder="如终端取消订单、供应商无法交付" data-${EVENT_PREFIX}-close-reason data-skip-page-rerender="true"></textarea>
  </label></div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('确认关闭', { prefix: EVENT_PREFIX, action: 'submit-close' }, 'check-check')}</footer></section></div>`
}

function renderGenerateOverlay(purchaseOrderNo: string): string {
  const order = getPmsProductPurchaseOrder(purchaseOrderNo)
  if (!order) return ''
  const check = checkPmsGenerateMaterialRequirement(purchaseOrderNo)
  const preview = check.ok ? '将按 BOM 单件用量 × (1 + 损耗) 拆解物料需求，并扣除库存与采购中数量。' : check.reason
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="生成面辅料需求" data-pms-ppo-generate-root><section class="w-full max-w-xl rounded-xl bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">生成面辅料需求</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(order.purchaseOrderNo)} · ${escapeHtml(order.productName)}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-3 p-4">${renderPmsOverlayError(state.overlayError)}<p class="rounded-md border bg-muted/30 px-3 py-2 text-sm text-slate-700">${escapeHtml(preview)}</p>${order.lines.some((line) => line.needBom && !line.bomMatched) ? '<p class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">存在 BOM 未匹配的 SKU，必须先完成 BOM/样板维护。</p>' : ''}  </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('确认生成', { prefix: EVENT_PREFIX, action: 'submit-generate' }, 'check-check').replace('<button', `<button ${check.ok ? '' : 'disabled'}`)}</footer></section></div>`
}

function renderOverlays(): string {
  const columnSettings = `<div data-pms-ppo-column-overlays>${controller.renderColumnSettings()}</div>`
  if (!state.overlay) return `${columnSettings}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'detail') return `${columnSettings}${renderDetailOverlay(state.overlay.purchaseOrderNo)}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'create') return `${columnSettings}${renderCreateOverlay()}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'edit') return `${columnSettings}${renderEditOverlay(state.overlay.purchaseOrderNo)}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'close') return `${columnSettings}${renderCloseOverlay(state.overlay.purchaseOrderNo)}${renderPmsImagePreview()}`
  return `${columnSettings}${renderGenerateOverlay(state.overlay.purchaseOrderNo)}${renderPmsImagePreview()}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
      showHeader: false,
    title: '商品采购单',
    feedbackHtml: renderPmsFeedback(state.feedback, state.feedbackOk),
    filtersHtml: renderFilters(),
    statsHtml: renderStats(),
    listTitle: `共 ${filteredRows().length} 条`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2"><span class="text-xs text-muted-foreground">做货 SKU 的 BOM 未匹配时不能生成面辅料需求</span>${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-ppo-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-ppo-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-ppo-overlays>${renderOverlays()}</div>`,
  })
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  root.innerHTML = renderInner()
  hydratePmsSurface(root)
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-ppo-overlays]')
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
    state.feedback = '当前查询条件下没有可导出的商品采购单。'
    state.feedbackOk = false
    refreshAll()
    return
  }
  downloadPmsCsv(
    '商品采购单.csv',
    ['采购单号', '款式', 'SPU', '采购类型', '区域', '供应商', '仓库', '状态', '版本', '下单时间', '期望交期', 'SKU数', '采购数量', '采购金额', '面辅料状态'],
    rows.map((order) => [
      order.purchaseOrderNo,
      order.productName,
      order.spu,
      order.purchaseType,
      order.area,
      order.supplierName,
      order.warehouse,
      order.status,
      order.version,
      order.orderedAt,
      order.expectedDeliveryDate,
      order.lines.length,
      order.lines.reduce((sum, line) => sum + line.qty, 0),
      pmsProductPurchaseOrderAmount(order).toFixed(2),
      [...new Set(order.lines.map((line) => (line.needBom ? line.materialStatus : '不需要')))].join(' / '),
    ]),
  )
  state.feedback = `已导出 ${rows.length} 张商品采购单（当前查询条件全量）。`
  state.feedbackOk = true
  refreshAll()
}

function readPpoRegion(surface: ParentNode, selector: string): PmsPurchaseRegion | '' {
  const value = readTextField(surface, selector)
  return value === '国内' || value === '印尼' || value === '其他' ? value : ''
}

function readPpoYesNo(surface: ParentNode, selector: string): PmsYesNo {
  return readTextField(surface, selector) === '是' ? '是' : '否'
}

function submitCreate(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-ppo-create-root]')
  if (!surface) return
  const spu = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-create-field="spu"]`)
  const supplierName = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-create-field="supplierName"]`)
  const warehouse = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-create-field="warehouse"]`)
  const expectedDeliveryDate = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-create-field="expectedDeliveryDate"]`)
  const remark = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-create-field="remark"]`)
  const purchaser = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-create-field="purchaser"]`)
  const productionArea = readPpoRegion(surface, `[data-${EVENT_PREFIX}-create-field="productionArea"]`)
  const isUrgent = readPpoYesNo(surface, `[data-${EVENT_PREFIX}-create-field="isUrgent"]`)
  const isFirstOrder = readPpoYesNo(surface, `[data-${EVENT_PREFIX}-create-field="isFirstOrder"]`)
  const catalogRow = renderSuggestionCatalog().find((row) => row.spu === spu)
  if (!catalogRow) {
    state.overlayError = '请选择有效的款式'
    refreshOverlays()
    return
  }
  const lines = catalogRow.skuItems
    .filter((sku) => surface.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-create-check="${sku.sku}"]`)?.checked)
    .map((sku) => ({
      sku: sku.sku,
      color: sku.color,
      size: sku.size,
      qty: Number.parseInt(surface.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-create-qty="${sku.sku}"]`)?.value ?? '', 10),
      standardPrice: Number.parseFloat(surface.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-create-price="${sku.sku}"]`)?.value ?? '') || 0,
      actualPrice: Number.parseFloat(surface.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-create-price="${sku.sku}"]`)?.value ?? '') || 0,
      weight: Number.parseFloat(surface.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-create-weight="${sku.sku}"]`)?.value ?? ''),
    }))
  try {
    const created = createPmsProductPurchaseOrders(
      [{ spu: catalogRow.spu, productName: catalogRow.productName, imageUrl: catalogRow.imageUrl, purchaseType: catalogRow.purchaseType, area: catalogRow.area, productionArea, supplierName, warehouse, expectedDeliveryDate, purchaser, isUrgent, isFirstOrder, remark, lines }],
      PMS_BUYER_ACTOR,
    )
    state.feedback = `已创建商品采购单 ${created[0]?.purchaseOrderNo ?? ''}，状态为待采购。`
    state.feedbackOk = true
    state.overlay = null
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '创建采购单失败，请检查填写内容'
    refreshOverlays()
  }
}

function submitEdit(purchaseOrderNo: string): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-ppo-edit-root]')
  if (!surface) return
  const supplierName = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-edit-field="supplierName"]`)
  const warehouse = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-edit-field="warehouse"]`)
  const expectedDeliveryDate = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-edit-field="expectedDeliveryDate"]`)
  const remark = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-edit-field="remark"]`)
  const purchaser = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-edit-field="purchaser"]`)
  const productionArea = readPpoRegion(surface, `[data-${EVENT_PREFIX}-edit-field="productionArea"]`)
  const isUrgent = readPpoYesNo(surface, `[data-${EVENT_PREFIX}-edit-field="isUrgent"]`)
  const isFirstOrder = readPpoYesNo(surface, `[data-${EVENT_PREFIX}-edit-field="isFirstOrder"]`)
  const order = getPmsProductPurchaseOrder(purchaseOrderNo)
  if (!order) return
  const lines = order.lines.map((line) => ({
    lineId: line.lineId,
    qty: Number.parseInt(surface.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-edit-qty="${line.lineId}"]`)?.value ?? '', 10),
    actualPrice: Number.parseFloat(surface.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-edit-price="${line.lineId}"]`)?.value ?? ''),
    weight: Number.parseFloat(surface.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-edit-weight="${line.lineId}"]`)?.value ?? ''),
  }))
  try {
    updatePmsProductPurchaseOrder(purchaseOrderNo, { supplierName, warehouse, expectedDeliveryDate, remark, purchaser, isUrgent, isFirstOrder, productionArea, lines }, PMS_BUYER_ACTOR)
    state.feedback = `已保存 ${purchaseOrderNo} 的修改，版本已更新。`
    state.feedbackOk = true
    state.overlay = null
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '保存采购单失败，请检查填写内容'
    refreshOverlays()
  }
}

function submitClose(purchaseOrderNo: string): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-ppo-close-root]')
  if (!surface) return
  const reason = readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-close-reason]`)
  try {
    closePmsProductPurchaseOrder(purchaseOrderNo, reason, PMS_MANAGER_ACTOR)
    state.feedback = `已关闭 ${purchaseOrderNo}。`
    state.feedbackOk = true
    state.overlay = null
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '关闭采购单失败'
    refreshOverlays()
  }
}

function submitGenerate(purchaseOrderNo: string): void {
  try {
    const result = generatePmsMaterialRequirement(purchaseOrderNo, PMS_BUYER_ACTOR)
    state.feedback = `已生成面辅料需求 ${result.requirementNo}，共 ${result.lines.length} 条物料行，可在面辅料需求分析页下推采购单。`
    state.feedbackOk = true
    state.overlay = null
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '生成面辅料需求失败'
    refreshOverlays()
  }
}

export function renderPmsProductPurchaseOrdersPage(): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  readRouteFilterFromLocation()
  controller.installColumnDragEvents()
  return `<div data-pms-ppo-root data-skip-page-rerender="true"><style>[data-pms-ppo-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export function closePmsProductPurchaseOrderOverlays(): boolean {
  if (state.overlay) {
    state.overlay = null
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (state.showColumnSettings) {
    state.showColumnSettings = false
    refreshOverlays()
    return true
  }
  return false
}

export function handlePmsProductPurchaseOrdersEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handlePmsCommonImageEvent(target, event, refreshOverlays)) return true
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    closeOverlay()
    return true
  }

  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  const fieldName = field?.dataset.pmsPpoField
  if (field && fieldName) {
    if (fieldName === 'keyword') {
      state.keyword = field.value
      return true
    }
    if (fieldName === 'status') {
      state.status = field.value as PpoPageState['status']
      return true
    }
    if (fieldName === 'purchaseType') {
      state.purchaseType = field.value as PpoPageState['purchaseType']
      return true
    }
    if (fieldName === 'blockedOnly') {
      state.blockedOnly = field instanceof HTMLInputElement ? field.checked : false
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
  const action = actionNode?.dataset.pmsPpoAction
  if (!action) {
    if (target.closest(`[data-${EVENT_PREFIX}-create-field="spu"]`)) {
      refreshCreateSkuBody()
      return true
    }
    return false
  }

  if (action === 'query') {
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'reset') {
    state.keyword = ''
    state.status = ''
    state.purchaseType = ''
    state.blockedOnly = false
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'export') {
    exportRows()
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
    const key = actionNode?.closest<HTMLElement>('[data-pms-ppo-column-key]')?.dataset.pmsPpoColumnKey || ''
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
  if (action === 'open-detail') {
    state.overlay = { kind: 'detail', purchaseOrderNo: actionNode?.dataset.orderNo || '', clientActionId: nextPmsActionId('pms-ppo-detail') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-create') {
    state.overlay = { kind: 'create', clientActionId: nextPmsActionId('pms-ppo-create') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-edit') {
    state.overlay = { kind: 'edit', purchaseOrderNo: actionNode?.dataset.orderNo || '', clientActionId: nextPmsActionId('pms-ppo-edit') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-close') {
    state.overlay = { kind: 'close', purchaseOrderNo: actionNode?.dataset.orderNo || '', clientActionId: nextPmsActionId('pms-ppo-close') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-generate') {
    state.overlay = { kind: 'generate', purchaseOrderNo: actionNode?.dataset.orderNo || '', clientActionId: nextPmsActionId('pms-ppo-generate') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'advance-status') {
    const purchaseOrderNo = actionNode?.dataset.orderNo || ''
    const nextStatus = actionNode?.dataset.nextStatus as PmsProductPurchaseOrderStatus | undefined
    if (!nextStatus) return true
    try {
      advancePmsProductPurchaseOrderStatus(purchaseOrderNo, nextStatus, PMS_MANAGER_ACTOR)
      state.feedback = `${purchaseOrderNo} 已推进为${nextStatus}。`
      state.feedbackOk = true
      refreshAll()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '状态推进失败'
      refreshOverlays()
    }
    return true
  }
  if (action === 'close-overlay') {
    closeOverlay()
    return true
  }
  if (action === 'submit-create') {
    submitCreate()
    return true
  }
  if (action === 'submit-edit') {
    if (state.overlay?.kind === 'edit') submitEdit(state.overlay.purchaseOrderNo)
    return true
  }
  if (action === 'submit-close') {
    if (state.overlay?.kind === 'close') submitClose(state.overlay.purchaseOrderNo)
    return true
  }
  if (action === 'submit-generate') {
    if (state.overlay?.kind === 'generate') submitGenerate(state.overlay.purchaseOrderNo)
    return true
  }
  return false
}

export function getPmsProductPurchaseOrderRowCountForTest(): number {
  return filteredRows().length
}
