import { DYE_FACTORY_TABS, dyeFactoryTabLabel, dyePartnerFields } from '../../../data/fcs/dye-work-order-demo-details.ts'
import { openDyeOutput, handleDyeOutputEvent } from './output-documents.ts'
import { syncProcessSelectionHeader, renderProcessOrderStats, renderProcessSelectionHeader, renderProcessFilterToggle, handleProcessFilterPresentation } from '../../../components/ui/process-order-list-presentation.ts'
// @page-pattern: list

import { hydrateIcons } from '../../../components/shell.ts'
import { renderBadge } from '../../../components/ui/badge.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderInput } from '../../../components/ui/form.ts'
import { renderStandardListPage } from '../../../components/ui/list-page.ts'
import {
  renderStandardListColumnSettings,
  renderStandardListTable,
  type StandardListColumn,
} from '../../../components/ui/list-table.ts'
import {
  clearListColumnPreferences,
  loadListColumnPreferences,
  normalizeListColumnPreferences,
  paginateStandardListRows,
  resetStandardListEntryTransientStateOnRouteEntry,
  saveListColumnPreferences,
  sortStandardListRows,
  type StandardListColumnPreferences,
  type StandardListSortState,
} from '../../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import {
  DEFAULT_DYE_WORK_ORDER_ONLINE_FILTERS,
  buildDyeWorkOrderCsv,
  filterDyeWorkOrderOnlineRows,
  getDyeWorkOrderOnlineSummary,
  listDyeWorkOrderOnlineRows,
  type DyeWorkOrderOnlineFilters,
  type DyeWorkOrderOnlineRow,
} from '../../../data/fcs/dye-work-order-online-view.ts'
import {
  getDyeWorkOrderOnlineRecord,
  isDyeWorkOrderHighRiskStatusChange,
  updateDyeWorkOrderFromPfos,
  updateDyeWorkOrderRemark,
  type DyeWorkOrderPfosEditInput,
} from '../../../data/fcs/dye-work-order-online-domain.ts'
import {
  PROCESS_ORDER_HANDOVER_STATUS_LABEL,
  PROCESS_ORDER_PROCESSING_STATUS_LABEL,
  PROCESS_ORDER_RECEIPT_STATUS_LABEL,
  type ProcessOrderHandoverStatus,
  type ProcessOrderProcessingStatus,
  type ProcessOrderReceiptStatus,
} from '../../../data/fcs/process-order-flow-contract.ts'
import {
  PROCESS_WORK_ORDER_SOURCE_LABEL,
  type ProcessWorkOrderSourceType,
} from '../../../data/fcs/process-work-order-domain.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  readDyeWorkOrderEditInput,
  renderDyeWorkOrderOverlay,
  type DyeWorkOrderOverlayState,
} from './work-order-overlays.ts'

const EVENT_PREFIX = 'dye-work-orders'
const PREFERENCE_KEY = '/fcs/craft/dyeing/work-orders:list-columns-v2'
const PAGE_SIZE_OPTIONS = [10, 20, 50]

const state: {
  factoryTab: string
  currentPage: number
  rowsSnapshot: DyeWorkOrderOnlineRow[] | null
  filters: DyeWorkOrderOnlineFilters
  selectedIds: Set<string>
  sort: StandardListSortState | null
  preferences: StandardListColumnPreferences
  preferencesLoaded: boolean
  showColumnSettings: boolean
  overlay: DyeWorkOrderOverlayState
  pendingEditInput: DyeWorkOrderPfosEditInput | null
} = {
  factoryTab: '',
  currentPage: 1,
  rowsSnapshot: null,
  filters: { ...DEFAULT_DYE_WORK_ORDER_ONLINE_FILTERS, statuses: [] },
  selectedIds: new Set(),
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: ['dyeInfo'], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  overlay: null,
  pendingEditInput: null,
}

let columnDragEventsInstalled = false
let draggedColumnKey = ''

function formatQty(value: number, unit: string): string {
  return `${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${escapeHtml(unit)}`
}

function formatDifference(value: number, unit: string): string {
  if (value > 0) return `多 ${formatQty(value, unit)}`
  if (value < 0) return `少 ${formatQty(Math.abs(value), unit)}`
  return '一致'
}

function pendingDyeQty(row: DyeWorkOrderOnlineRow): number {
  if (['染色完成', '待审核', '部分入库', '待人工完单', '已完成', '取消'].includes(row.status)) return 0
  return Math.max(0, row.plannedQty - row.completedQty)
}

function renderListImage(url: string, alt: string): string {
  return `<button type="button" class="relative h-10 w-10 shrink-0 cursor-zoom-in overflow-hidden rounded border bg-white" data-pda-image-preview-url="${escapeHtml(url)}" data-pda-image-preview-title="${escapeHtml(alt)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(alt)}大图"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"><span class="absolute inset-0 flex items-center justify-center bg-white px-1 text-center text-[10px] text-muted-foreground">图片加载中</span></button>`
}

function axisTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (['RECEIVED', 'COMPLETED', 'FULL_HANDOVER'].includes(status)) return 'success'
  if (['RECEIPT_DIFFERENCE', 'CANCELLED'].includes(status)) return 'danger'
  if (['PARTIAL_RECEIVED', 'PARTIAL_HANDOVER', 'PROCESSING'].includes(status)) return 'info'
  if (['WAIT_SOURCE', 'WAIT_RECEIVE', 'WAIT_HANDOVER'].includes(status)) return 'warning'
  return 'neutral'
}

function detailButton(row: DyeWorkOrderOnlineRow, text: string): string {
  return `<button type="button" class="text-left text-xs text-blue-700 hover:underline" data-dye-work-orders-action="view" data-id="${escapeHtml(row.dyeOrderId)}">${escapeHtml(text)}</button>`
}
function renderActions(row: DyeWorkOrderOnlineRow): string {
  return `<div class="grid grid-cols-2 gap-x-1 gap-y-0.5">${['查看','编辑','日志','打印流程卡','打印条码',row.remark.trim() ? '查看备注' : '备注'].map((label,index) => `<button type="button" class="inline-flex min-h-7 w-full items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-dye-work-orders-action="${['view','edit','logs','print-one','barcodes','remark'][index]}" data-id="${escapeHtml(row.dyeOrderId)}">${label}</button>`).join('')}</div>`
}

function field(label: string, value: string): string {
  return `<div class="leading-5"><span class="text-muted-foreground">${escapeHtml(label)}：</span><span class="break-words">${escapeHtml(value)}</span></div>`
}

function materialItem(item: {imageUrl: string; name: string; sku: string}): string {
  return `<div class="flex items-start gap-2" data-dye-material-item>${renderListImage(item.imageUrl, `${item.name} ${item.sku}`)}<div class="min-w-0 flex-1"><div class="font-medium leading-5">${escapeHtml(item.name)}</div><div class="break-all text-muted-foreground leading-5">${escapeHtml(item.sku)}</div></div></div>`
}

function renderMaterialItem(item: DyeWorkOrderOnlineRow['inputMaterials'][number]): string {
  return `<div data-dye-material-spec>${materialItem(item)}<div class="mt-2">${field('物料类型',item.materialType)}${field('成分',item.composition)}${field('幅宽',item.materialType==='纱线'?'不适用（筒装纱线）':item.width)}${field('克重',item.materialType==='纱线'?'不适用（按净重 kg 计量）':item.weightGsm === null ? '待维护' : `${item.weightGsm} g/m²`)}</div></div>`
}

function renderOrderProduct(row: DyeWorkOrderOnlineRow): string {
  const tags = [row.isOverdue ? renderBadge('超期', 'danger') : '', row.isReplenishment ? renderBadge('补料', 'warning') : ''].filter(Boolean)
  const factoryName = row.factoryId ? dyeFactoryTabLabel(row.factoryId, row.factoryName) : '待分配工厂'
  return `<div class="divide-y divide-gray-200 text-xs" data-dye-cell="order-product">
    <section class="space-y-1 pb-3" data-dye-section="documents">${field('加工厂',factoryName)}<div><span class="text-muted-foreground">染色加工单：</span>${detailButton(row, row.workOrderNo)}</div>${field('任务单',row.taskNo)}${field('生产单',row.productionOrderNo || '不适用（备货单）')}${field('售卖类型',row.salesType)}</section>
    <section class="py-3" data-dye-section="product">${materialItem({imageUrl:row.productImageUrl, name:row.productName, sku:row.productCode})}</section>
    ${tags.length ? `<section class="flex flex-wrap gap-1 pt-3" data-dye-section="tags">${tags.join('')}</section>` : ''}
  </div>`
}

function renderInputUpstream(row: DyeWorkOrderOnlineRow): string {
  return `<div class="divide-y divide-gray-200 text-xs" data-dye-cell="input-upstream"><section class="space-y-3 pb-3" data-dye-section="inputs">${row.inputMaterials.map(renderMaterialItem).join('')}</section><section class="space-y-3 pt-3" data-dye-section="upstream">${row.upstreamDocuments.map(doc=>`<div data-dye-upstream-document data-partner-kind="${doc.partner.kind}"><div class="mb-1 font-medium text-muted-foreground">上游</div>${dyePartnerFields(doc.partner).map(([label,value])=>field(label,value)).join('')}<div class="flex flex-wrap items-baseline gap-x-2 leading-5"><span class="break-all text-blue-700">${doc.href ? `<a href="${escapeHtml(doc.href)}" class="hover:underline">${escapeHtml(doc.documentNo)}</a>` : escapeHtml(doc.documentNo)}</span><span class="shrink-0 text-muted-foreground">${doc.documentType}</span></div>${field('单据状态',doc.status)}${field('计划数量',formatQty(doc.plannedQty,doc.unit))}${field(doc.documentType === '调拨单' ? '调拨数量' : doc.documentType==='出库单'?'出库数量':'交出数量',formatQty(doc.sentQty,doc.unit))}</div>`).join('')}</section></div>`
}

function renderOutputDownstream(row: DyeWorkOrderOnlineRow): string {
  return `<div class="divide-y divide-gray-200 text-xs" data-dye-cell="output-downstream"><section class="space-y-2 pb-3" data-dye-section="output">${renderMaterialItem({imageUrl:row.outputImageUrl,name:row.materialName,sku:row.colorSku,materialType:row.materialType,composition:row.composition,width:row.width,weightGsm:row.weightGsm})}${field('色号',row.colorNo)}${field('颜色',row.targetColorName)}</section><section class="pt-3" data-dye-section="downstream"><div class="mb-1 font-medium text-muted-foreground">下游</div>${row.downstreamPartner ? dyePartnerFields(row.downstreamPartner).map(([label,value])=>field(label,value)).join('') : field('接收方',row.receiverName || row.receiverWarehouseName)}</section></div>`
}

function renderQuantities(row: DyeWorkOrderOnlineRow): string {
  const yarnText=(weights:NonNullable<DyeWorkOrderOnlineRow['yarnQuantities']>['received'],fallback:string)=>weights.length?`${weights.reduce((n,w)=>n+w.pcs,0)} pcs / 毛重 ${(weights.reduce((n,w)=>n+w.grossGrams,0)/1000).toFixed(3)} kg / 净重 ${(weights.reduce((n,w)=>n+w.netGrams,0)/1000).toFixed(3)} kg`:fallback
  const upstreamByUnit = new Map<string, number>()
  for (const doc of row.upstreamDocuments) upstreamByUnit.set(doc.unit, (upstreamByUnit.get(doc.unit) || 0) + doc.sentQty)
  const groups: Array<[string, Array<[string, string]>]> = [
    ['plan', [['计划数量',formatQty(row.plannedQty,row.qtyUnit)]]],
    ['receipt', [
      ['上游交出数量',row.yarnQuantities?yarnText(row.yarnQuantities.upstream,'历史三项计量未采集'):[...upstreamByUnit].map(([unit,qty])=>formatQty(qty,unit)).join(' / ') || '尚未交出'],
      ['接收数量',row.yarnQuantities?yarnText(row.yarnQuantities.received,row.receivedInputQty>0?'历史三项计量未采集':'0 pcs / 毛重 0.000 kg / 净重 0.000 kg'):row.receiptKnown ? formatQty(row.receivedInputQty,row.qtyUnit) : '历史接收未登记'],
    ]],
    ['processing', [
      ['加工用料',row.usageKnown ? formatQty(row.rawMaterialQty,row.qtyUnit) : '历史用量未登记'],
      ['备料数量',formatQty(row.preparedQty,row.qtyUnit)],
      ['备料卷数',row.isYarn?'不适用（纱线按筒）':`${row.preparedRollCount} 卷`],
      [row.isYarn?'备料净重':'备料重量（理论）',formatQty(row.isYarn?row.preparedQty:row.preparedWeightKg,'kg')],
      ['完成数量',row.isYarn?formatQty(row.completedQty,'kg 净重'):`${row.completedRollCount} 卷 / ${formatQty(row.completedQty,row.qtyUnit)}`],
      ['损耗数量',row.lossKnown ? formatQty(row.lossQty,row.qtyUnit) : '尚未完工核算'],
    ]],
    ['handover', [
      ['交出数量',row.yarnQuantities?yarnText(row.yarnQuantities.shipped,row.handedOverQty>0?'历史三项计量未采集':'0 pcs / 毛重 0.000 kg / 净重 0.000 kg'):`${row.handedOverRollCount} 卷 / ${formatQty(row.handedOverQty,row.qtyUnit)}`],
      ['下游接收数量',row.yarnQuantities?yarnText(row.yarnQuantities.downstream,row.downstreamReceivedQty>0?'历史三项计量未采集':'0 pcs / 毛重 0.000 kg / 净重 0.000 kg'):formatQty(row.downstreamReceivedQty,row.qtyUnit)],
      ['下游待接收',row.isYarn?`${row.pendingInboundQty.toFixed(3)} kg 净重`:formatQty(row.pendingInboundQty,row.qtyUnit)],
    ]],
  ]
  return `<div class="divide-y divide-gray-200 text-xs" data-dye-cell="quantities">${groups.map(([key,items])=>`<section class="py-3 first:pt-0 last:pb-0" data-dye-quantity-section="${key}">${items.map(([label,value])=>field(label,value)).join('')}</section>`).join('')}</div>`
}

const columns: StandardListColumn<DyeWorkOrderOnlineRow>[] = [
  { key: 'selection', title: '选择', width: 72, required: true, leadingControlColumn: true, renderHeader: rows => renderProcessSelectionHeader(rows.map(row => row.dyeOrderId), state.selectedIds, EVENT_PREFIX), render: row => `<input aria-label="选择 ${escapeHtml(row.workOrderNo)}" type="checkbox" ${state.selectedIds.has(row.dyeOrderId) ? 'checked' : ''} data-dye-work-orders-action="toggle-selection" data-id="${escapeHtml(row.dyeOrderId)}">` },
  {
    key: 'dyeInfo', title: '加工单／商品', width: 245, required: true, freezeable: true, sortable: true,
    sortValue: row => row.workOrderNo,
    render: renderOrderProduct,
  },
  {
    key: 'material', title: '加工投入／上游', width: 280, required: true, freezeable: true, sortable: true,
    sortValue: row => row.rawMaterialSku,
    render: renderInputUpstream,
  },
  {
    key: 'requirement', title: '加工要求', width: 175, freezeable: true, sortable: true,
    sortValue: row => row.processName,
    render: row => `<div class="text-xs space-y-1" data-dye-cell="requirements">${field('工艺',row.processName)}${field('类型',row.headVatOrRedye)}${field('深浅',row.shade || '工艺未指定')}${field('温度',row.temperature ? `${row.temperature}℃` : '工艺未指定')}${field('包含水溶',row.requiresWaterSoluble ? '是' : '否')}</div>`,
  },
  {
    key: 'status', title: '处理进度', width: 132, required: true, freezeable: true,
    render: row => `<div class="space-y-2"><div><span class="mr-1 text-xs text-muted-foreground">接收</span>${renderBadge(row.receiptKnown ? row.receiptStatusLabel : '历史待补录', axisTone(row.receiptStatus))}</div><div><span class="mr-1 text-xs text-muted-foreground">加工</span>${renderBadge(row.processingStatusLabel, axisTone(row.processingStatus))}</div><div><span class="mr-1 text-xs text-muted-foreground">交出</span>${renderBadge(row.handoverStatusLabel, axisTone(row.handoverStatus))}</div></div>`,
  },
  {
    key: 'output', title: '加工产出／下游', width: 245, required: true, freezeable: true, sortable: true,
    sortValue: row => row.completedQty,
    render: renderOutputDownstream,
  },
  {
    key: 'time', title: '时间', width: 195, freezeable: true, sortable: true,
    sortValue: row => row.plannedFinishAt,
    render: row => `<div class="space-y-2 text-xs" data-dye-cell="time">${field('下单时间',row.orderedAt)}${field('交货时间',row.plannedFinishAt || '尚未安排交期')}${field('完成时间',row.completedAt || (row.processingStatus === 'CANCELLED' ? '已取消，无完成时间' : '尚未完成'))}${field('交出时间',row.deliveredAt || '尚未交出')}</div>`,
  },
  { key: 'quantity', title: '数量', width: 235, freezeable: true, sortable: true, sortValue: row=>row.plannedQty, render:renderQuantities },
  { key: 'actions', title: '操作', width: 176, required: true, actionColumn: true, render: renderActions },
]

const columnRules = columns.map(({ key, required, freezeable, actionColumn }) => ({ key, required, freezeable, actionColumn }))

function defaultPreferences(): StandardListColumnPreferences {
  return normalizeListColumnPreferences(columnRules, {
    order: columns.map((column) => column.key),
    visibleKeys: columns.map((column) => column.key),
    frozenKeys: ['dyeInfo'],
    pageSize: 10,
  }, PAGE_SIZE_OPTIONS)
}

function ensurePreferencesLoaded(): void {
  if (state.preferencesLoaded) return
  state.preferencesLoaded = true
  const defaults = defaultPreferences()
  state.preferences = typeof window === 'undefined' || typeof document === 'undefined'
    ? defaults
    : loadListColumnPreferences(window.localStorage, PREFERENCE_KEY, columnRules, defaults, PAGE_SIZE_OPTIONS)
  if (typeof window !== 'undefined' && !window.localStorage.getItem(`${PREFERENCE_KEY}:time-quantity-added`)) {
    state.preferences.visibleKeys = [...new Set([...state.preferences.visibleKeys, 'time', 'quantity'])]
    saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences)
    window.localStorage.setItem(`${PREFERENCE_KEY}:time-quantity-added`, '1')
  }
}

function option(value: string, current: string, label = value): string {
  return `<option value="${escapeHtml(value)}" ${value === current ? 'selected' : ''}>${escapeHtml(label)}</option>`
}

function selectField(label: string, field: string, options: string[], current: string, className = 'min-w-0'): string {
  return `<label class="${className}"><span class="mb-1 block text-xs text-muted-foreground">${escapeHtml(label)}</span><select class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" data-dye-work-orders-field="${escapeHtml(field)}">${options.map((value) => option(value, current, value || '全部')).join('')}</select></label>`
}

function sourceTypeSelectField(current: '' | ProcessWorkOrderSourceType): string {
  const options: Array<['' | ProcessWorkOrderSourceType, string]> = [
    ['', '全部'],
    ...Object.entries(PROCESS_WORK_ORDER_SOURCE_LABEL) as Array<[ProcessWorkOrderSourceType, string]>,
  ]
  return `<label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">需求来源</span><select class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" data-dye-work-orders-field="sourceType">${options.map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === current ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>`
}

function textField(label: string, field: string, value: string, placeholder = ''): string {
  return `<label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">${escapeHtml(label)}</span><input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" data-dye-work-orders-field="${escapeHtml(field)}"></label>`
}

function uniqueValues(rows: DyeWorkOrderOnlineRow[], getValue: (row: DyeWorkOrderOnlineRow) => string): string[] {
  return ['', ...new Set(rows.map(getValue).filter(Boolean))]
}

function axisStatusSelect<T extends string>(label: string, field: string, labels: Record<T, string>, current: '' | T): string {
  return `<label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">${escapeHtml(label)}</span><select class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" data-dye-work-orders-field="${escapeHtml(field)}"><option value="">全部</option>${Object.entries(labels).map(([value, text]) => `<option value="${escapeHtml(value)}" ${value === current ? 'selected' : ''}>${escapeHtml(String(text))}</option>`).join('')}</select></label>`
}

function renderFactoryTabs(rows: DyeWorkOrderOnlineRow[]): string {
  const extra = [...new Set(rows.map(row => row.factoryId).filter(Boolean))].filter(id => !DYE_FACTORY_TABS.some(tab => tab.id === id)).map(id => ({id, label: rows.find(row => row.factoryId === id)!.factoryName}))
  return `<div role="tablist" aria-label="加工厂切换" class="mb-3 flex flex-wrap gap-1 border-b border-slate-300 bg-slate-50 px-3 pt-3">${[...DYE_FACTORY_TABS, ...extra].map(tab => `<button type="button" role="tab" aria-selected="${state.factoryTab === tab.id}" data-dye-work-orders-action="factory-tab" data-factory-id="${escapeHtml(tab.id)}" class="-mb-px rounded-t-lg border px-5 py-2.5 text-sm font-semibold ${state.factoryTab === tab.id ? 'border-b-white border-t-4 border-t-sky-600 bg-white text-sky-700' : 'border-slate-300 text-slate-500 hover:bg-white'}">${escapeHtml(tab.label)} <span class="text-xs font-normal">${rows.filter(row => !tab.id || (tab.id === 'unassigned' ? !row.factoryId : row.factoryId === tab.id)).length}</span></button>`).join('')}</div>`
}

function renderFilters(rows: DyeWorkOrderOnlineRow[]): string {
  const filters = state.filters
  const advancedCount = ['sourceType','upstreamName','receiverName','processName','materialType','colorNo','salesType','exception','startDate','endDate'].filter(key => Boolean(filters[key as keyof DyeWorkOrderOnlineFilters])).length + (filters.timeField !== 'orderedAt' ? 1 : 0)
  return `<div class="rounded-lg border bg-white p-3"><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    ${textField('综合查询', 'keyword', filters.keyword, '单号、商品、物料或交接单').replace('<label class="', '<label class="sm:col-span-2 ')}
    ${axisStatusSelect('接收状态', 'receiptStatus', PROCESS_ORDER_RECEIPT_STATUS_LABEL, filters.receiptStatus)}
    ${axisStatusSelect('加工状态', 'processingStatus', PROCESS_ORDER_PROCESSING_STATUS_LABEL, filters.processingStatus)}
    ${axisStatusSelect('交出状态', 'handoverStatus', PROCESS_ORDER_HANDOVER_STATUS_LABEL, filters.handoverStatus)}
    ${selectField('加工厂', 'factoryName', uniqueValues(rows, row => row.factoryName), filters.factoryName)}
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    ${sourceTypeSelectField(filters.sourceType)}
    ${selectField('上游供料方', 'upstreamName', uniqueValues(rows, row => row.upstreamName), filters.upstreamName)}
    ${selectField('下游接收方', 'receiverName', uniqueValues(rows, row => row.receiverName), filters.receiverName)}
    ${selectField('工艺', 'processName', uniqueValues(rows, row => row.processName), filters.processName)}
    ${selectField('物料类型', 'materialType', uniqueValues(rows, row => row.materialType), filters.materialType)}
    ${selectField('售卖类型', 'salesType', uniqueValues(rows, row => row.salesType), filters.salesType)}
    ${selectField('异常', 'exception', ['', '超期', '补料', '接收差异', '历史待补录'], filters.exception)}
    ${textField('目标颜色／色号', 'colorNo', filters.colorNo)}
    ${selectField('时间类型', 'timeField', ['orderedAt','plannedFinishAt','completedAt','deliveredAt'], filters.timeField).replace('>orderedAt<','>下单时间<').replace('>plannedFinishAt<','>预计完成<').replace('>completedAt<','>完成时间<').replace('>deliveredAt<','>交出时间<')}
    ${textField('开始日期', 'startDate', filters.startDate).replace('<input', '<input type="date"')}${textField('结束日期', 'endDate', filters.endDate).replace('<input', '<input type="date"')}
    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'apply-filter' }, 'search')}${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset-filter' }, 'rotate-ccw')}${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}${renderSecondaryButton('导出投入接收', { prefix: EVENT_PREFIX, action: 'export-preparation' })}${renderSecondaryButton('导出超期单', { prefix: EVENT_PREFIX, action: 'export-overdue' })}${renderProcessFilterToggle(advancedCount, 'button')}</div></div>`.replace(/<(input|select)\b/g, '<$1 data-skip-page-rerender="true"')
}

function renderSummaryValue(items: Array<{ unit: string; qty: number }>): string {
  return items.some(item => item.qty !== 0) ? items.filter(item => item.qty !== 0).map((item) => `${item.qty.toLocaleString('zh-CN')} ${item.unit}`).join(' / ') : '0'
}

function renderDyeSummary(items: Array<{label: string; value: string | number}>): string {
  return renderProcessOrderStats(items)
}

function filteredRows(allRows: DyeWorkOrderOnlineRow[]): DyeWorkOrderOnlineRow[] {
  return filterDyeWorkOrderOnlineRows(allRows, state.filters).filter(row => !state.factoryTab || (state.factoryTab === 'unassigned' ? !row.factoryId : row.factoryId === state.factoryTab))
}

// Query, selection and column preferences only reshape the current page data.
// Invalidate this page-local snapshot on route entry and successful data edits.
function currentRows(): DyeWorkOrderOnlineRow[] {
  return state.rowsSnapshot ??= listDyeWorkOrderOnlineRows()
}

function renderWorkspace(sourceOverride?: '' | ProcessWorkOrderSourceType): string {
  ensurePreferencesLoaded()
  const allRows = currentRows()
  const rows = sourceOverride === undefined
    ? filteredRows(allRows)
    : filterDyeWorkOrderOnlineRows(allRows, { ...state.filters, sourceType: sourceOverride })
  const sorted = sortStandardListRows(rows, state.sort, (row, key) => columns.find((column) => column.key === key)?.sortValue?.(row))
  const paging = paginateStandardListRows(sorted, state.currentPage, state.preferences.pageSize)
  state.currentPage = paging.currentPage
  const summary = getDyeWorkOrderOnlineSummary(rows)
  return renderStandardListPage({
    title: '染色加工单',
    showHeader: false,
    filtersHtml: renderFactoryTabs(allRows) + renderFilters(allRows),
    statsHtml: renderDyeSummary([
      { label: '加工单数', value: rows.length },
      { label: '计划投入', value: renderSummaryValue(summary.plannedQtyByUnit) },
      { label: '已接收', value: renderSummaryValue(summary.receivedQtyByUnit) },
      { label: '实际使用', value: renderSummaryValue(summary.rawMaterialQtyByUnit) },
      { label: '完成数量', value: renderSummaryValue(summary.completedQtyByUnit) },
      { label: '下游待接收', value: renderSummaryValue(summary.pendingQtyByUnit) },
    ]),
    listTitle: `共 ${rows.length} 条 · 已选 ${state.selectedIds.size} 条`,
    listActionsHtml: `<div class="flex flex-wrap items-center gap-2">${renderPrimaryButton(`批量打印流程卡（${state.selectedIds.size}）`, { prefix: EVENT_PREFIX, action: 'batch-print' }, 'printer').replace('<button', `<button ${state.selectedIds.size ? '' : 'disabled'}`)}${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: renderStandardListTable({ columns, rows: paging.rows, preferences: state.preferences, sort: state.sort, eventPrefix: EVENT_PREFIX, emptyText: '暂无染色加工单' }),
    paginationHtml: renderTablePagination({ total: paging.total, from: paging.from, to: paging.to, currentPage: paging.currentPage, totalPages: paging.totalPages, pageSize: paging.pageSize, actionPrefix: EVENT_PREFIX, fieldPrefix: EVENT_PREFIX, pageSizeOptions: PAGE_SIZE_OPTIONS }),
    overlaysHtml: state.showColumnSettings ? renderStandardListColumnSettings({ title: '染色加工单列设置', columns, preferences: state.preferences, eventPrefix: EVENT_PREFIX, maxFrozenWidth: 520 }) : '',
  })
}

export function renderCraftDyeingWorkOrdersPage(options: { sourceType?: '' | ProcessWorkOrderSourceType } = {}): string {
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  state.rowsSnapshot = null
  syncOverlayFromLocation()
  installColumnDragEvents()
  return `<div data-dye-work-orders-root data-skip-page-rerender="true"><style>[data-dye-work-orders-workspace] [data-standard-list-scroll] td{vertical-align:top}</style><div data-dye-work-orders-workspace>${renderWorkspace(options.sourceType)}</div><div data-dye-work-orders-overlay>${state.overlay ? renderDyeWorkOrderOverlay(state.overlay) : ''}</div></div>`
}

function syncOverlayFromLocation(): void {
  if (state.overlay || typeof window === 'undefined') return
  const dyeOrderId = new URLSearchParams(window.location.search).get('dyeOrderId')
  if (dyeOrderId) state.overlay = { type: 'view', dyeOrderId }
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('[data-dye-work-orders-root]')
}

function refreshWorkspace(): void {
  const region = rootElement()?.querySelector<HTMLElement>('[data-dye-work-orders-workspace]')
  if (!region) return
  region.innerHTML = renderWorkspace()
  hydrateIcons(region)
  syncProcessSelectionHeader(region)
}

function refreshOverlay(): void {
  const region = rootElement()?.querySelector<HTMLElement>('[data-dye-work-orders-overlay]')
  if (!region) return
  region.innerHTML = state.overlay ? renderDyeWorkOrderOverlay(state.overlay) : ''
  hydrateIcons(region)
}

function replaceDyeOrderQuery(dyeOrderId?: string): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (dyeOrderId) url.searchParams.set('dyeOrderId', dyeOrderId)
  else url.searchParams.delete('dyeOrderId')
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

function downloadCsv(kind: '全部' | '投入接收' | '超期未完结'): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const rows = filteredRows(currentRows())
  const blob = new Blob([buildDyeWorkOrderCsv(rows, kind)], { type: 'text/csv;charset=utf-8' })
  const href = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = `染色加工单-${kind}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(href)
}

function openFlowCard(ids: string[]): void {
  if (typeof window === 'undefined') return
  if (!ids.length) {
    window.alert('请先选择需要打印的染色加工单。')
    return
  }
  const href = `/fcs/print/task-route-card?sourceType=DYEING_WORK_ORDER&sourceId=${encodeURIComponent(ids.join(','))}`
  window.open(href, '_blank', 'noopener,noreferrer')
}

function closeOverlay(): void {
  state.overlay = null
  state.pendingEditInput = null
  replaceDyeOrderQuery()
  refreshOverlay()
}

function saveEdit(input: DyeWorkOrderPfosEditInput): void {
  const dyeOrderId = state.overlay?.dyeOrderId
  if (!dyeOrderId) return
  try {
    updateDyeWorkOrderFromPfos(dyeOrderId, input)
    state.rowsSnapshot = null
    closeOverlay()
    refreshWorkspace()
  } catch (error) {
    state.overlay = { type: 'edit', dyeOrderId, error: error instanceof Error ? error.message : '保存失败' }
    state.pendingEditInput = null
    refreshOverlay()
  }
}

function persistPreferences(): void {
  if (typeof window !== 'undefined') saveListColumnPreferences(window.localStorage, PREFERENCE_KEY, state.preferences)
}

function readField(root: HTMLElement, field: string): string {
  return root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-dye-work-orders-field="${field}"]`)?.value.trim() || ''
}

function readFilters(root: HTMLElement): DyeWorkOrderOnlineFilters {
  const keywordFieldLabel = readField(root, 'keywordField')
  const keywordFieldMap: Record<string, DyeWorkOrderOnlineFilters['keywordField']> = { 全部: 'all', 加工单号: 'workOrderNo', 任务单号: 'taskNo', 生产单号: 'productionOrderNo', 采购单号: 'purchaseOrderNo', 商品编码: 'productCode' }
  return {
    ...state.filters,
    keywordField: keywordFieldMap[keywordFieldLabel] || 'all',
    keyword: readField(root, 'keyword'),
    upstreamName: readField(root, 'upstreamName'),
    exception: readField(root, 'exception'),
    timeField: (readField(root, 'timeField') || 'orderedAt') as DyeWorkOrderOnlineFilters['timeField'],
    startDate: readField(root, 'startDate'),
    endDate: readField(root, 'endDate'),
    statuses: [],
    receiptStatus: readField(root, 'receiptStatus') as '' | ProcessOrderReceiptStatus,
    processingStatus: readField(root, 'processingStatus') as '' | ProcessOrderProcessingStatus,
    handoverStatus: readField(root, 'handoverStatus') as '' | ProcessOrderHandoverStatus,
    salesType: readField(root, 'salesType'),
    factoryName: readField(root, 'factoryName'),
    processName: readField(root, 'processName'),
    receiverName: readField(root, 'receiverName'),
    sourceType: readField(root, 'sourceType') as DyeWorkOrderOnlineFilters['sourceType'],
    yarn: (readField(root, 'yarn') || '全部') as DyeWorkOrderOnlineFilters['yarn'],
    replenishment: (readField(root, 'replenishment') || '全部') as DyeWorkOrderOnlineFilters['replenishment'],
    gtgInStock: (readField(root, 'gtgInStock') || '全部') as DyeWorkOrderOnlineFilters['gtgInStock'],
    materialType: readField(root, 'materialType'),
    colorNo: readField(root, 'colorNo'),
    composition: readField(root, 'composition'),
    width: readField(root, 'width'),
    weightGsm: readField(root, 'weightGsm'),
  }
}

function updateColumnPreference(action: string, columnKey: string): void {
  const column = columns.find((item) => item.key === columnKey)
  if (!column || column.actionColumn) return
  let visibleKeys = [...state.preferences.visibleKeys]
  let frozenKeys = [...state.preferences.frozenKeys]
  if (action === 'toggle-column-visibility' && !column.required) visibleKeys = visibleKeys.includes(columnKey) ? visibleKeys.filter((key) => key !== columnKey) : [...visibleKeys, columnKey]
  if (action === 'toggle-column-freeze' && column.freezeable) frozenKeys = frozenKeys.includes(columnKey) ? frozenKeys.filter((key) => key !== columnKey) : [...frozenKeys, columnKey]
  state.preferences = normalizeListColumnPreferences(columnRules, { ...state.preferences, visibleKeys, frozenKeys }, PAGE_SIZE_OPTIONS)
  persistPreferences()
  refreshWorkspace()
}

function installColumnDragEvents(): void {
  if (columnDragEventsInstalled || typeof document === 'undefined') return
  columnDragEventsInstalled = true
  document.addEventListener('dragstart', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-dye-work-orders-root] [data-standard-list-column-drag]') : null
    if (!target) return
    draggedColumnKey = target.dataset.dragSource || ''
    event.dataTransfer?.setData('text/plain', draggedColumnKey)
  })
  document.addEventListener('dragover', (event) => {
    if (event.target instanceof Element && event.target.closest('[data-dye-work-orders-root] [data-drop-target]')) event.preventDefault()
  })
  document.addEventListener('drop', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-dye-work-orders-root] [data-drop-target]') : null
    const sourceKey = draggedColumnKey || event.dataTransfer?.getData('text/plain') || ''
    const targetKey = target?.dataset.dropTarget || ''
    draggedColumnKey = ''
    if (!sourceKey || !targetKey || sourceKey === targetKey) return
    const regularOrder = state.preferences.order.filter((key) => key !== 'actions' && key !== sourceKey)
    const targetIndex = regularOrder.indexOf(targetKey)
    if (targetIndex < 0) return
    event.preventDefault()
    regularOrder.splice(targetIndex, 0, sourceKey)
    state.preferences = normalizeListColumnPreferences(columnRules, { ...state.preferences, order: [...regularOrder, 'actions'] }, PAGE_SIZE_OPTIONS)
    persistPreferences()
    refreshWorkspace()
  })
}

export function handleDyeWorkOrderListEvent(target: HTMLElement): boolean {
  const root = target.closest<HTMLElement>('[data-dye-work-orders-root]')
  if (!root) return false
  if (handleDyeOutputEvent(target)) {
    if (target.closest<HTMLElement>('[data-dye-output-action]')?.dataset.dyeOutputAction === 'confirm') { state.rowsSnapshot = null; refreshWorkspace() }
    return true
  }
  const outputAction = target.closest<HTMLElement>('[data-dye-work-orders-action]')
  const outputKey = outputAction?.dataset.dyeWorkOrdersAction
  if (outputKey === 'barcodes' || outputKey === 'output-pending' || outputKey === 'output-documents') { openDyeOutput(outputKey === 'barcodes' ? 'barcodes' : outputKey === 'output-pending' ? 'pending' : 'documents', outputAction?.dataset.id, currentRows().find(row => row.dyeOrderId === outputAction?.dataset.id)); return true }
  if (handleProcessFilterPresentation(root, target)) return true
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-dye-work-orders-field]')
  if (field?.dataset.dyeWorkOrdersField === 'selection-scope') {
    const scope = field.value
    if (!scope) return true
    const rows = sortStandardListRows(filteredRows(currentRows()), state.sort, (row, key) => columns.find(column => column.key === key)?.sortValue?.(row))
    if (scope === 'clear') state.selectedIds.clear()
    else (scope === 'page' ? paginateStandardListRows(rows, state.currentPage, state.preferences.pageSize).rows : rows).forEach(row => state.selectedIds.add(row.dyeOrderId))
    refreshWorkspace(); return true
  }
  if (field?.dataset.dyeWorkOrdersField === 'pageSize') {
    const pageSize = Number(field.value)
    state.preferences = { ...state.preferences, pageSize: PAGE_SIZE_OPTIONS.includes(pageSize) ? pageSize : 10 }
    state.currentPage = 1
    persistPreferences()
    refreshWorkspace()
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-dye-work-orders-action]')
  if (!actionNode) return Boolean(field)
  const action = actionNode.dataset.dyeWorkOrdersAction || ''
  if (action === 'factory-tab') { state.factoryTab = actionNode.dataset.factoryId || ''; state.filters.factoryName = ''; state.currentPage = 1; state.selectedIds.clear(); refreshWorkspace(); return true }
  if (action === 'view' || action === 'edit' || action === 'logs') {
    const dyeOrderId = actionNode.dataset.id || ''
    if (!dyeOrderId) return true
    state.overlay = { type: action, dyeOrderId, ...(action === 'logs' ? { logPage: 1 } : {}) }
    state.pendingEditInput = null
    replaceDyeOrderQuery(dyeOrderId)
    refreshOverlay()
    return true
  }
  if (action === 'close-overlay') { closeOverlay(); return true }
  if (action === 'remark' || action === 'edit-remark') {
    const dyeOrderId = actionNode.dataset.id || state.overlay?.dyeOrderId
    if (!dyeOrderId) return true
    const record = getDyeWorkOrderOnlineRecord(dyeOrderId)
    state.overlay = {type: action === 'edit-remark' || !record.remark.trim() ? 'remark-edit' : 'remark', dyeOrderId}
    refreshOverlay()
    return true
  }
  if (action === 'save-remark' && state.overlay?.type === 'remark-edit') {
    const dyeOrderId = state.overlay.dyeOrderId
    const overlay = root.querySelector<HTMLElement>('[data-dye-work-orders-overlay]')!
    const input = overlay.querySelector<HTMLTextAreaElement>('[data-dye-work-orders-field="remark-content"]')!
    try {
      updateDyeWorkOrderRemark(dyeOrderId, input.value, Number(overlay.querySelector<HTMLInputElement>('[data-dye-remark-version]')?.value))
      state.rowsSnapshot = null
      root.querySelectorAll<HTMLElement>('[data-dye-work-orders-action="remark"]').forEach(button => {
        if (button.dataset.id === dyeOrderId) button.textContent = '查看备注'
      })
      closeOverlay()
    } catch (error) {
      overlay.querySelector<HTMLElement>('[data-dye-remark-error]')!.textContent = error instanceof Error ? error.message : '备注保存失败，请重试'
    }
    return true
  }
  if (action === 'save-edit') {
    const dyeOrderId = state.overlay?.dyeOrderId
    if (!dyeOrderId) return true
    try {
      const input = readDyeWorkOrderEditInput(root)
      const current = getDyeWorkOrderOnlineRecord(dyeOrderId)
      if (isDyeWorkOrderHighRiskStatusChange(current.status, input.status)) {
        state.pendingEditInput = input
        state.overlay = { type: 'edit', dyeOrderId, confirmHighRisk: true, targetStatus: input.status }
        refreshOverlay()
      } else saveEdit(input)
    } catch (error) {
      state.overlay = { type: 'edit', dyeOrderId, error: error instanceof Error ? error.message : '请检查填写内容' }
      refreshOverlay()
    }
    return true
  }
  if (action === 'confirm-high-risk') {
    if (state.pendingEditInput) saveEdit(state.pendingEditInput)
    return true
  }
  if (action === 'cancel-high-risk') {
    if (state.overlay) state.overlay = { type: 'edit', dyeOrderId: state.overlay.dyeOrderId }
    state.pendingEditInput = null
    refreshOverlay()
    return true
  }
  if (action === 'prev-log-page' || action === 'next-log-page') {
    if (state.overlay?.type === 'logs') {
      const current = state.overlay.logPage || 1
      state.overlay = { ...state.overlay, logPage: Math.max(1, current + (action === 'next-log-page' ? 1 : -1)) }
      refreshOverlay()
    }
    return true
  }
  if (action === 'export') { downloadCsv('全部'); return true }
  if (action === 'export-preparation') { downloadCsv('投入接收'); return true }
  if (action === 'export-overdue') { downloadCsv('超期未完结'); return true }
  if (action === 'print-one') { openFlowCard([actionNode.dataset.id || ''].filter(Boolean)); return true }
  if (action === 'batch-print') { openFlowCard([...state.selectedIds]); return true }
  if (action === 'apply-filter') { state.selectedIds.clear(); state.filters = readFilters(root); state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'reset-filter') { state.selectedIds.clear(); state.filters = { ...DEFAULT_DYE_WORK_ORDER_ONLINE_FILTERS, statuses: [] }; state.currentPage = 1; refreshWorkspace(); return true }
  if (action === 'toggle-page') {
    root.querySelectorAll<HTMLInputElement>('tbody [data-dye-work-orders-action="toggle-selection"]').forEach(box => { const id = box.dataset.id || ''; if ((actionNode as HTMLInputElement).checked) state.selectedIds.add(id); else state.selectedIds.delete(id) })
    refreshWorkspace(); return true
  }
  if (action === 'select-page' || action === 'select-all' || action === 'clear-selection') {
    const rows = sortStandardListRows(filteredRows(currentRows()), state.sort, (row, key) => columns.find(column => column.key === key)?.sortValue?.(row))
    state.selectedIds = new Set(action === 'clear-selection' ? [] : (action === 'select-page' ? paginateStandardListRows(rows, state.currentPage, state.preferences.pageSize).rows : rows).map(row => row.dyeOrderId))
    refreshWorkspace(); return true
  }
  if (action === 'toggle-selection') {
    const id = actionNode.dataset.id || ''
    if (state.selectedIds.has(id)) state.selectedIds.delete(id); else state.selectedIds.add(id)
    refreshWorkspace()
    return true
  }
  if (action === 'prev-page' || action === 'next-page') { state.currentPage = Math.max(1, state.currentPage + (action === 'next-page' ? 1 : -1)); refreshWorkspace(); return true }
  if (action === 'sort-column') {
    const key = actionNode.dataset.columnKey || ''
    state.sort = state.sort?.key !== key ? { key, direction: 'asc' } : state.sort.direction === 'asc' ? { key, direction: 'desc' } : null
    state.currentPage = 1
    refreshWorkspace()
    return true
  }
  if (action === 'open-column-settings') { state.showColumnSettings = true; refreshWorkspace(); return true }
  if (action === 'close-column-settings') { state.showColumnSettings = false; refreshWorkspace(); return true }
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    updateColumnPreference(action, actionNode.dataset.dyeWorkOrdersColumnKey || actionNode.closest<HTMLElement>('[data-dye-work-orders-column-key]')?.dataset.dyeWorkOrdersColumnKey || '')
    return true
  }
  if (action === 'restore-column-settings') {
    if (typeof window !== 'undefined') clearListColumnPreferences(window.localStorage, PREFERENCE_KEY)
    state.preferences = defaultPreferences(); state.sort = null; state.currentPage = 1; refreshWorkspace(); return true
  }
  return false
}
