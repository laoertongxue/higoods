import { hydratePmsProductPurchaseOrdersFromIdb, getPmsProductPurchaseOrder } from '../../data/pms/product-purchase-orders.ts'
import { parsePmsExcelRows } from '../../utils/pms-excel-import.ts'
import { pmsBusinessNumber } from '../../utils/pms-business-number.ts'
// @page-pattern: list
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats, renderProcessSelectionHeader, syncProcessSelectionHeader } from '../../components/ui/process-order-list-presentation.ts'
import { renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import { getPurchaseMaterialReference, listPurchaseMaterialReferences } from '../../data/pms/canonical-purchase-references.ts'
import {
  checkPmsMaterialRequirementPush,
  listPmsMaterialPurchaseOrders,
  hydratePmsMaterialPurchaseOrdersFromIdb,
  pushPmsMaterialRequirement,
  batchPushPmsMaterialRequirements, importPmsMaterialLogistics, registerAndInboundPmsMaterialPurchases,
  type PmsRequirementPushLineInput,
} from '../../data/pms/material-purchase-orders.ts'
import { batchAssociatePmsMaterialRequirements, importPmsRequirementQuantities, batchUpdatePmsMaterialRequirements, updatePmsMaterialRequirement, getPmsMaterialRequirement, hydratePmsMaterialRequirementsFromIdb, listPmsMaterialRequirements, type PmsMaterialRequirement, type PmsMaterialRequirementLine } from '../../data/pms/material-requirements.ts'
import { nextPmsActionId, PMS_BUYER_ACTOR, PmsDomainError } from '../../data/pms/runtime.ts'
import { buildPmsHtmlTemplateFile, downloadPmsFile, downloadPmsCsv } from '../../utils/pms-export.ts'
import { escapeHtml } from '../../utils.ts'
import {
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

type RequirementOverlay =
  | null
  | { kind:'edit'|'reject'|'associate'|'replace';requirementNo:string;clientActionId:string }
  | {kind:'file';mode:'quantity'|'inbound';rows:Array<{number:string;sku:string;quantity:number}>;fileName:string;clientActionId:string}
  | {kind:'logistics';clientActionId:string}
  | {kind:'batch';mode:string;requirementNo:string;clientActionId:string}
  | { kind: 'detail'; requirementNo: string; clientActionId: string }
  | { kind: 'push'; requirementNo: string; clientActionId: string }

interface RequirementPageState extends ProcessOrderListControllerState {
  selectedRequirementNos:string[]
  keyword: string
  filters:Record<string,string>
  status: string
  overlay: RequirementOverlay
  overlayError: string
  feedback: string
  feedbackOk: boolean
}

const EVENT_PREFIX = 'pms-mreq'
const ROOT_SELECTOR = '[data-pms-mreq-root]'

const state: RequirementPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 2 },
  preferencesLoaded: false,
  showColumnSettings: false,
  selectedRequirementNos:[],
  keyword: '',
  status: '',filters:{},
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
}

function requirementDisplayStatus(row:PmsMaterialRequirement):string{
 if(row.rejectedReason)return '采购驳回'
 const orders=row.lines.map(line=>listPmsMaterialPurchaseOrders().find(order=>order.purchaseOrderNo===line.generatedPurchaseOrderNo)).filter(Boolean)
 if(row.lines.every(line=>line.suggestedQty<=0||orders.some(order=>order!.purchaseOrderNo===line.generatedPurchaseOrderNo&&order!.status==='已入库')))return '全部入库'
 if(orders.some(order=>order!.inventoryPosting||order!.status==='已入库'))return '部分入库'
 return orders.length?'采购中':'等待采购'
}
function filteredRows(): PmsMaterialRequirement[] {
 const keyword=state.keyword.trim().toLowerCase(),f=state.filters
 return listPmsMaterialRequirements().filter(row=>{
  if(state.status&&requirementDisplayStatus(row)!==state.status)return false
  const source=getPmsProductPurchaseOrder(row.sourcePurchaseOrderNo),linked=row.lines.map(line=>listPmsMaterialPurchaseOrders().find(order=>order.purchaseOrderNo===line.generatedPurchaseOrderNo)).filter(Boolean)
  if(f.region && (row.purchaseRegion||source?.area||'未记录')!==f.region)return false
  if(f.type && (source?.purchaseType||'未记录')!==f.type)return false
  if(f.idPurchase && (linked.some(order=>order!.purchaseRegion==='印尼')?'是':'否')!==f.idPurchase)return false
  if(f.kol && (source?.purchaseType==='达人寄样'?'是':source?'否':'未记录')!==f.kol)return false
  if(f.first && (source?.isFirstOrder||'未记录')!==f.first)return false
  const created=row.createdAt?.slice(0,10)||'',purchased=source?.orderedAt?.slice(0,10)||''
  for(const [key,date] of [['created',created],['purchased',purchased]])if((f[key+'From']||f[key+'To'])&&(!date||(f[key+'From']&&date<f[key+'From'])||(f[key+'To']&&date>f[key+'To'])))return false
  const values=f.field==='spu'?[row.spu]:f.field==='sku'?row.lines.map(line=>line.materialCode):f.field==='purchase'?[row.sourcePurchaseOrderNo,pmsBusinessNumber(row.sourcePurchaseOrderNo)]:[row.requirementNo,pmsBusinessNumber(row.requirementNo),row.sourcePurchaseOrderNo,row.productName,row.spu,...row.lines.flatMap(line=>[line.materialName,line.materialCode])]
  return !keyword||keyword.split(/[，,\s]+/).filter(Boolean).some(word=>values.some(value=>value.toLowerCase().includes(word)))
 })
}

function unitTotals(lines:PmsMaterialRequirementLine[]):string{return [...new Set(lines.map(line=>line.unit))].map(unit=>formatPmsQty(lines.filter(line=>line.unit===unit).reduce((sum,line)=>sum+line.suggestedQty,0),unit)).join(' · ')}

function requirementTone(status: PmsMaterialRequirement['status']): 'blue' | 'green' | 'yellow' {
  if (status === '已下推') return 'green'
  if (status === '部分下推') return 'blue'
  return 'yellow'
}

const columns: StandardListColumn<PmsMaterialRequirement>[] = [
 {key:'selection',title:'选择',width:54,required:true,renderHeader:rows=>renderProcessSelectionHeader(rows.map(row=>row.requirementNo),new Set(state.selectedRequirementNos),EVENT_PREFIX),render:row=>`<input type="checkbox" aria-label="选择 ${escapeHtml(pmsBusinessNumber(row.requirementNo))}" data-mreq-select="${escapeHtml(row.requirementNo)}" ${state.selectedRequirementNos.includes(row.requirementNo)?'checked':''}>`},
  {
    key: 'requirement',
    title: '需求单 / 来源',
    width: 210,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.requirementNo,
    render: (row) => `<div class="font-semibold">${escapeHtml(pmsBusinessNumber(row.requirementNo))}</div><div class="mt-1 text-xs text-slate-500">来源 ${escapeHtml(row.sourcePurchaseOrderNo || '—')}${row.sourceSuggestionNo ? ` · ${escapeHtml(row.sourceSuggestionNo)}` : ''}</div><div class="mt-1 text-xs text-slate-500">${formatPmsTime(row.createdAt)}</div>`,
  },
  {
    key: 'style',
    title: '款式',
    width: 220,
    required: true,
    freezeable: true,
    render: (row) => `<div class="flex items-center gap-3">${renderPmsBusinessImage(row.styleImageUrl, `${row.productName}款式图`, 'h-12 w-12')}<div><div class="font-medium">${escapeHtml(row.productName)}</div><div class="text-xs text-slate-500">${escapeHtml(row.spu)}</div></div></div>`,
  },
  {
    key: 'lines',
    title: '物料行 / 待下推',
    width: 170,
    render: (row) => {
      const pending = row.lines.filter((line) => line.pushStatus === '待下推'&&line.suggestedQty>0).length
      return `<div class="text-sm">共 <strong>${row.lines.length}</strong> 行</div><div class="mt-1 text-xs ${pending > 0 ? 'text-amber-700' : 'text-emerald-700'}">待下推 ${pending} 行</div><div class="mt-1 text-xs text-slate-500">建议合计 ${unitTotals(row.lines)}</div>`
    },
  },
  {
    key: 'status',
    title: '状态',
    width: 110,
    sortable: true,
    sortValue: (row) => row.status,
    render: (row) => renderPmsStatusBadge(requirementDisplayStatus(row), requirementTone(row.status)),
  },
  {
    key: 'actions',
    title: '操作',
    width: 170,
    actionColumn: true,
    render: (row) => {
      const check = checkPmsMaterialRequirementPush(row.requirementNo)
      return `<div class="flex items-center justify-end gap-1.5">
        <button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-detail" data-requirement-no="${escapeHtml(row.requirementNo)}" data-skip-page-rerender="true">查看明细</button>
        <button type="button" class="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded px-1.5 py-1 text-xs text-blue-700 hover:bg-blue-50" data-${EVENT_PREFIX}-action="open-push" data-requirement-no="${escapeHtml(row.requirementNo)}" data-skip-page-rerender="true" ${check.ok ? '' : 'disabled'}>下推采购单</button>
      </div>`
    },
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/material-requirements',
  pageSizeOptions: [2, 5, 10, 20],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-mreq-table-surface]',
  paginationSurfaceSelector: '[data-pms-mreq-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-mreq-overlays]',
  defaultFrozenKeys: ['requirement', 'style'],
  columnSettingsTitle: '面辅料需求列设置',
  emptyText: '当前条件下暂无面辅料需求单',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof window === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function renderFilters(): string {
  const statuses=['','等待采购','采购驳回','采购中','全部入库','部分入库','待审核','审核驳回','合并已删除']
  const options = statuses.map((value) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${value || '全部状态'}</option>`).join('')
  const advancedCount = (state.status?1:0)+Object.values(state.filters).filter(Boolean).length
  const select=(key:string,label:string,values:string[])=>`<label class="min-w-0 text-xs text-slate-500">${label}<select class="mt-1 h-9 w-full rounded border px-2 text-sm" data-pms-mreq-field="filter:${key}"><option value="">全部</option>${values.map(value=>`<option value="${escapeHtml(value)}" ${state.filters[key]===value?'selected':''}>${escapeHtml(key==='field'?({spu:'SPU',sku:'SKU',purchase:'商品采购单'} as Record<string,string>)[value]||value:value)}</option>`).join('')}</select></label>`
  const extras=select('field','检索字段',['spu','sku','purchase'])+select('region','采购区域',['国内','印尼','未记录'])+select('type','商品类型',['做货','成衣','样衣','达人寄样','未记录'])+select('idPurchase','是否有ID面辅料采购单',['是','否'])+select('kol','是否KOL样品小单',['是','否','未记录'])+select('first','是否首单',['是','否','未记录'])+[['created','创建时间'],['purchased','采购下单时间']].map(([key,label])=>`<div class="col-span-2"><span class="text-xs text-slate-500">${label}</span><div class="mt-1 flex gap-1">${['From','To'].map((suffix,index)=>`<input type="date" aria-label="${label}${index?'结束':'开始'}" class="h-9 min-w-0 w-full rounded border px-2 text-xs" value="${escapeHtml(state.filters[key+suffix]||'')}" data-pms-mreq-field="filter:${key+suffix}">`).join('')}</div></div>`).join('')
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="需求单号 / 来源采购单 / 款式 / 物料" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">下推状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="status" data-skip-page-rerender="true">${options}</select></label>${extras}
    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    ${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
    ${renderProcessFilterToggle(advancedCount, 'button')}
    </div></div>`
}

function renderStats(): string {
  const rows = filteredRows()
  const pendingLines = rows.flatMap((row) => row.lines).filter((line) => line.pushStatus === '待下推'&&line.suggestedQty>0)
  return renderProcessOrderStats([
    { label: '需求单总数', value: rows.length },
    { label: '待下推行', value: pendingLines.length },
    { label: '建议采购量', value: unitTotals(pendingLines) },
    { label: '已生成采购单', value: listPmsMaterialPurchaseOrders().filter((order) => rows.some((row) => row.requirementNo === order.requirementNo)).length },
  ])
}

function renderLineRow(requirement: PmsMaterialRequirement, line: PmsMaterialRequirementLine, editable: boolean): string {
  const blocked = line.suggestedQty <= 0
  const price = listPmsMaterialPurchaseOrders().find(order=>order.purchaseOrderNo===line.generatedPurchaseOrderNo)?.unitPrice ?? line.unitPrice ?? getPurchaseMaterialReference(line.materialCode)?.referencePrice ?? 0
  const input = editable
    ? `<input class="h-8 w-24 rounded-md border px-2 text-sm ${blocked ? 'bg-slate-100 text-slate-400' : ''}" type="number" min="0" step="0.01" value="${blocked ? 0 : line.actualQty}" ${blocked ? 'disabled' : ''} data-${EVENT_PREFIX}-push-qty="${escapeHtml(line.lineNo)}" data-skip-page-rerender="true" />`
    : `<span class="tabular-nums">${formatPmsQty(line.actualQty, line.unit)}</span>`
  const priceInput = editable
    ? `<input class="h-8 w-24 rounded-md border px-2 text-sm ${blocked ? 'bg-slate-100 text-slate-400' : ''}" type="number" min="0" step="0.01" value="${price}" ${blocked ? 'disabled' : ''} data-${EVENT_PREFIX}-push-price="${escapeHtml(line.lineNo)}" data-skip-page-rerender="true" />`
    : `<span class="tabular-nums">¥${price.toFixed(2)}</span>`
  return `<tr class="border-b last:border-b-0">
    <td class="px-3 py-2"><div class="flex items-center gap-3">${renderPmsBusinessImage(line.imageUrl, `${line.materialName}（${line.materialCode}）实物图`, 'h-11 w-11')}<div><div class="font-medium">${escapeHtml(line.materialName)}</div><div class="text-xs text-slate-500">${escapeHtml(line.materialCode)} · ${escapeHtml(line.materialType)} · ${escapeHtml(line.unit)}</div><div class="text-xs text-slate-500">单件用量 ${line.plannedUsage} · 损耗 ${Math.round(line.lossRate * 100)}%</div></div></div></td>
    <td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(line.bomDemand, line.unit)}</td>
    <td class="px-3 py-2 text-sm tabular-nums">${line.stockKnown===false?'待核库存':formatPmsQty(line.stockQty, line.unit)}</td>
    <td class="px-3 py-2 text-sm tabular-nums">${line.historicalStockKnown===false?'未提供':formatPmsQty(line.historicalStockQty, line.unit)}</td>
    <td class="px-3 py-2 text-sm tabular-nums">${line.historicalStockKnown===false?'未提供':formatPmsQty(line.idHistoricalStockQty, line.unit)}</td>
    <td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(line.purchasingQty, line.unit)}</td>
    <td class="px-3 py-2 text-sm font-semibold tabular-nums">${formatPmsQty(line.suggestedQty, line.unit)}</td>
    <td class="px-3 py-2">${input}</td>
    <td class="px-3 py-2">${priceInput}</td>
    <td class="px-3 py-2 text-sm">${escapeHtml(line.supplierName || '未指定')}</td>
    <td class="px-3 py-2">${line.pushStatus === '已下推' ? `<a class="text-blue-700 underline" href="/pms/material-purchase-orders?purchaseOrderNo=${encodeURIComponent(line.generatedPurchaseOrderNo)}">${escapeHtml(pmsBusinessNumber(line.generatedPurchaseOrderNo))}</a>` : renderPmsStatusBadge(line.suggestedQty > 0 ? '待下推' : '建议为 0', line.suggestedQty > 0 ? 'yellow' : 'slate')}</td>
  </tr>`
}

function renderLineTable(requirement: PmsMaterialRequirement, editable: boolean): string {
  return `<div class="overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left" style="min-width: 1180px"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="w-72 px-3 py-2">物料</th><th class="w-24 px-3 py-2">BOM 需求</th><th class="w-20 px-3 py-2">库存</th><th class="w-24 px-3 py-2">历史库存</th><th class="w-28 px-3 py-2">ID 历史库存</th><th class="w-20 px-3 py-2">采购中</th><th class="w-24 px-3 py-2">建议采购</th><th class="w-28 px-3 py-2">实际采购</th><th class="w-28 px-3 py-2">采购单价</th><th class="w-40 px-3 py-2">供应商</th><th class="w-36 px-3 py-2">下推状态</th></tr></thead><tbody>${requirement.lines.map((line) => renderLineRow(requirement, line, editable)).join('')}</tbody></table></div>`
}

function renderDetailOverlay(requirementNo: string): string {
  const requirement = listPmsMaterialRequirements().find((row) => row.requirementNo === requirementNo)
  if (!requirement) return ''
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="面辅料需求明细"><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭明细"></button><section class="relative z-10 flex h-full w-[1080px] max-w-[96vw] flex-col overflow-y-auto bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">${escapeHtml(pmsBusinessNumber(requirement.requirementNo))} · ${escapeHtml(requirement.productName)}</h2><p class="mt-1 text-xs text-slate-500">来源 ${escapeHtml(requirement.sourcePurchaseOrderNo)} · ${escapeHtml(requirement.status)} · ${formatPmsTime(requirement.createdAt)}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-4 p-4">
    <div class="flex items-center gap-4">${renderPmsBusinessImage(requirement.styleImageUrl, `${requirement.productName}款式图`, 'h-20 w-20')}<dl class="grid flex-1 grid-cols-3 gap-3 text-sm"><div><dt class="text-xs text-muted-foreground">状态</dt><dd class="mt-1">${renderPmsStatusBadge(requirement.status, requirementTone(requirement.status))}</dd></div><div><dt class="text-xs text-muted-foreground">物料行</dt><dd class="mt-1">${requirement.lines.length} 行</dd></div><div><dt class="text-xs text-muted-foreground">来源建议</dt><dd class="mt-1">${escapeHtml(requirement.sourceSuggestionNo || '手工/生产采购单生成')}</dd></div></dl></div>
    <div class="flex flex-wrap gap-2">${[['edit','修改需求'],['associate','关联采购单'],['replace','替换物料'],['reject','驳回需求']].map(([kind,label])=>renderSecondaryButton(label,{prefix:EVENT_PREFIX,action:'edit-requirement'},kind==='reject'?'x-circle':'pencil').replace('<button',`<button data-edit-kind="${kind}" data-requirement-no="${escapeHtml(requirement.requirementNo)}"`)).join('')}</div>
    ${requirement.rejectedReason?`<p class="text-sm text-red-700">已驳回：${escapeHtml(requirement.rejectedReason)}</p>`:''}
    ${renderLineTable(requirement, false)}
    <p class="text-xs text-slate-500">BOM 需求 = SKU 数量 × 单件用量 × (1 + 损耗)；建议采购量 = max(0, BOM 需求 − 库存 − 采购中)。</p>
  </div></section></div>`
}

function renderPushOverlay(requirementNo: string): string {
  const requirement = listPmsMaterialRequirements().find((row) => row.requirementNo === requirementNo)
  if (!requirement) return ''
  const check = checkPmsMaterialRequirementPush(requirementNo)
  const pushable = requirement.lines.filter((line) => line.pushStatus === '待下推' && line.suggestedQty > 0).length
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="下推面辅料采购单" data-pms-mreq-push-root><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭下推"></button><section class="relative z-10 flex h-full w-[900px] max-w-[96vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">下推面辅料采购单</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(requirementNo)} · 建议采购量为 0 的行不能下推，缺供应商的行会被阻断</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="flex-1 space-y-4 overflow-y-auto p-4">${renderPmsOverlayError(state.overlayError)}
    <p class="rounded-md border bg-muted/30 px-3 py-2 text-sm text-slate-700">实际采购数量默认为建议采购量，可按供应商报价调整；下推后生成面辅料采购单，状态为“待采购”。可下推 ${pushable} 行。</p>
    ${renderLineTable(requirement, true)}
  </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('确认下推生成采购单', { prefix: EVENT_PREFIX, action: 'submit-push' }, 'check-check').replace('<button', `<button ${check.ok ? '' : 'disabled'}`)}</footer></section></div>`
}

function renderRequirementForm():string {
  const overlay=state.overlay
  if(!overlay || !(overlay.kind==='edit'||overlay.kind==='reject'||overlay.kind==='associate'||overlay.kind==='replace')) return ''
  const row=getPmsMaterialRequirement(overlay.requirementNo)
  if(!row) return ''
  const input=(key:string,label:string,value:unknown,type='text')=>`<label class="block text-sm">${label}<input class="mt-1 h-9 w-full rounded border px-2" type="${type}" value="${escapeHtml(String(value || ''))}" data-mreq-edit="${key}"></label>`
  const body=overlay.kind==='reject'?`<p class="text-sm">驳回 ${escapeHtml(row.requirementNo)} 后停止生成采购单，已生成采购记录保留。</p>`+input('rejectedReason','驳回原因',''):overlay.kind==='associate'?`<label class="block text-sm">采购单<select class="mt-1 h-9 w-full rounded border px-2" data-mreq-edit="associatePurchaseOrderNo"><option value="">请选择</option>${listPmsMaterialPurchaseOrders().filter(order=>!order.requirementNo && row.lines.some(line=>line.materialCode===order.materialCode && line.pushStatus==='待下推')).map(order=>`<option value="${escapeHtml(order.purchaseOrderNo)}">${escapeHtml(pmsBusinessNumber(order.purchaseOrderNo))} · ${escapeHtml(order.materialName)} · ${order.orderedQty} ${escapeHtml(order.unit)}</option>`).join('')}</select></label>`:overlay.kind==='replace'?`<label class="block text-sm">需求物料行<select class="mt-1 h-9 w-full rounded border px-2" data-mreq-edit="lineNo">${row.lines.filter(line=>line.pushStatus==='待下推').map(line=>`<option value="${escapeHtml(line.lineNo)}">${escapeHtml(line.materialName)} · ${escapeHtml(line.unit)}</option>`).join('')}</select></label><label class="block text-sm">替换物料 SKU<select class="mt-1 h-9 w-full rounded border px-2" data-mreq-edit="materialCode">${listPurchaseMaterialReferences().filter(ref=>ref.active && ref.imageUrl).map(ref=>`<option value="${escapeHtml(ref.materialCode)}">${escapeHtml(ref.materialCode)} · ${escapeHtml(ref.materialName)} · ${escapeHtml(ref.unit)}</option>`).join('')}</select></label>`:input('skuQty','商品需求件数',row.lines[0]?.skuQty,'number')+input('purchaseRegion','采购区域',row.purchaseRegion || '国内')+input('buyerName','采购员',row.buyerName || PMS_BUYER_ACTOR.name)+input('remark','需求备注',row.remark || '')+row.lines.filter(line=>line.pushStatus==='待下推').map(line=>`<fieldset class="space-y-2 rounded border p-3" data-mreq-line="${escapeHtml(line.lineNo)}"><legend>${escapeHtml(line.materialName)}</legend>${renderPmsBusinessImage(line.imageUrl,line.materialName,'h-10 w-10')}${input(`${line.lineNo}:supplierName`,'供应商',line.supplierName)}${input(`${line.lineNo}:warehouse`,'采购仓库',line.warehouse)}${input(`${line.lineNo}:actualQty`,`实际采购数量（${escapeHtml(line.unit)}）`,line.actualQty,'number')}</fieldset>`).join('')
  return `<div class="fixed inset-0 z-[60] flex justify-end bg-black/30" role="dialog" aria-modal="true" aria-label="需求操作"><section class="flex h-full w-[520px] max-w-[95vw] flex-col bg-white"><header class="border-b p-4 font-semibold">${escapeHtml(pmsBusinessNumber(row.requirementNo))} 需求操作</header><div class="flex-1 space-y-4 overflow-auto p-4">${body}</div><footer class="flex justify-end gap-2 border-t p-4">${renderSecondaryButton('取消',{prefix:EVENT_PREFIX,action:'close-overlay'})}${renderPrimaryButton(overlay.kind==='reject'?'驳回需求':overlay.kind==='associate'?'关联采购单':overlay.kind==='replace'?'替换物料':'保存需求',{prefix:EVENT_PREFIX,action:'submit-edit'})}</footer></section></div>`
}
function renderMreqFileOverlay(overlay:Extract<RequirementOverlay,{kind:'file'}>):string{
 return `<div class="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true" aria-label="数量文件导入"><section class="flex h-full w-[680px] max-w-[96vw] flex-col bg-white"><header class="flex justify-between border-b p-4"><h2 class="font-semibold">${overlay.mode==='quantity'?'上传实际采购数量':'上传入库数量'}</h2>${renderSecondaryButton('关闭',{prefix:EVENT_PREFIX,action:'close-overlay'})}</header><div class="flex-1 overflow-auto p-4">${renderPmsOverlayError(state.overlayError)}<p class="mb-3 text-sm">支持 .xlsx、Excel .xls 和本页模板。${overlay.mode==='quantity'?'只修改未下推需求的实际采购量。':'按采购单登记累计实到数量并形成原料库存的本地入库记录。'}整批校验并共同保存。</p>${renderSecondaryButton('下载模板',{prefix:EVENT_PREFIX,action:'mreq-file-template'},'download')}<label class="my-4 block text-sm">选择文件<input type="file" accept=".xlsx,.xls,.csv" class="mt-2 block w-full" data-mreq-upload-file></label><p class="text-sm">${escapeHtml(overlay.fileName)}</p><div class="mt-3 space-y-2">${overlay.rows.map(row=>`<div class="rounded border p-2 text-sm">${escapeHtml(pmsBusinessNumber(row.number))} · ${escapeHtml(row.sku)} · ${row.quantity}</div>`).join('')}</div></div><footer class="flex justify-end gap-2 border-t p-4">${renderSecondaryButton('取消',{prefix:EVENT_PREFIX,action:'close-overlay'})}${renderPrimaryButton('保存整批数量',{prefix:EVENT_PREFIX,action:'submit-file'}).replace('<button',`<button ${!overlay.rows.length?'disabled':''}`)}</footer></section></div>`
}
async function readMreqUpload(file:File|undefined):Promise<void>{
 if(!file || state.overlay?.kind!=='file')return
 try{const raw=await parsePmsExcelRows(file),rows=raw.slice(raw[0]?.some(cell=>/单号|SKU|数量/.test(cell))?1:0).filter(cells=>cells.some(cell=>cell.trim())).map(cells=>({number:cells[0]?.trim()||'',sku:cells[1]?.trim()||'',quantity:Number(cells[2])}));if(!rows.length || rows.some(row=>!row.number||!row.sku||!Number.isFinite(row.quantity)||row.quantity<0)||new Set(rows.map(row=>row.number+':'+row.sku)).size!==rows.length)throw new Error('文件须有有效单号、SKU和非负数量，每个单号与SKU只能出现一次');const mode=state.overlay.mode;for(const row of rows){const source=mode==='quantity'?listPmsMaterialRequirements().find(item=>item.requirementNo===row.number||pmsBusinessNumber(item.requirementNo)===row.number):listPmsMaterialPurchaseOrders().find(item=>item.purchaseOrderNo===row.number||pmsBusinessNumber(item.purchaseOrderNo)===row.number);if(!source)throw new Error(`找不到 ${row.number}，使用本页已有单号`);row.number='purchaseOrderNo'in source?source.purchaseOrderNo:source.requirementNo}state.overlay.rows=rows;state.overlay.fileName=file.name;state.overlayError='';refreshOverlays()}catch(error){state.overlayError=error instanceof Error?error.message:'文件不能读取';preserveEditingError()}
}
function renderMreqLogisticsOverlay():string{
 const ids=[...new Set(state.selectedRequirementNos.flatMap(no=>getPmsMaterialRequirement(no)?.lines.map(line=>line.generatedPurchaseOrderNo).filter(Boolean)||[]))],fields=[['company','物流公司','text'],['trackingNo','物流单号','text'],['shipDate','发货日期','date'],['estimatedArrival','预计到达','date'],['boxCount','箱数','number'],['rolls','卷数','number'],['qty','数量','number'],['fee','运费','number'],['remark','备注','text']]
 return `<div class="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true" aria-label="批量填写物流"><section class="flex h-full w-[760px] max-w-[96vw] flex-col bg-white"><header class="flex justify-between border-b p-4"><h2 class="font-semibold">批量填写物流单号</h2>${renderSecondaryButton('关闭',{prefix:EVENT_PREFIX,action:'close-overlay'})}</header><div class="flex-1 overflow-auto p-4">${renderPmsOverlayError(state.overlayError)}${!ids.length?'<p>所选需求还没有关联采购单，先创建或关联采购单。</p>':ids.map(no=>{const row=listPmsMaterialPurchaseOrders().find(item=>item.purchaseOrderNo===no);if(!row)return '';return `<fieldset class="mb-4 space-y-2 rounded border p-3" data-mreq-logistics-order="${escapeHtml(no)}"><legend>${escapeHtml(pmsBusinessNumber(no))} · ${escapeHtml(row.materialName)}</legend><div class="flex gap-2">${renderPmsBusinessImage(row.materialImageUrl,row.materialName)}<span>采购 ${formatPmsQty(row.orderedQty,row.unit)}</span></div><div class="grid grid-cols-3 gap-2">${fields.map(([key,label,type])=>`<label class="text-xs">${label}${key==='qty'?`（${row.unit}）`:''}<input name="${key}" type="${type}" class="mt-1 h-9 w-full rounded border px-2" value="${type==='number'?0:''}"></label>`).join('')}</div></fieldset>`}).join('')}</div><footer class="flex justify-end gap-2 border-t p-4">${renderSecondaryButton('取消',{prefix:EVENT_PREFIX,action:'close-overlay'})}${renderPrimaryButton('保存全部物流',{prefix:EVENT_PREFIX,action:'submit-logistics'}).replace('<button',`<button ${!ids.length?'disabled':''}`)}</footer></section></div>`
}
function renderOverlays(): string {
  if(state.overlay?.kind==='file')return renderMreqFileOverlay(state.overlay)
  if(state.overlay?.kind==='logistics')return renderMreqLogisticsOverlay()
  if(state.overlay?.kind==='batch'){const mode=state.overlay.mode;const labels:Record<string,string>={buyerName:'采购员',supplierName:'面辅料供应商',purchaseRegion:'采购区域',remark:'需求备注',unitPrice:'实际采购单价',associate:'关联采购单',printingFactory:'印染工厂',printingProcess:'印染工艺',rejectedReason:'驳回原因',push:'创建采购单'};return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label="批量需求操作"><section class="w-full max-w-lg space-y-3 rounded-lg bg-white p-5"><h2 class="font-semibold">批量${labels[mode]}</h2><p class="text-sm">已选 ${state.selectedRequirementNos.length} 张需求：${state.selectedRequirementNos.map(pmsBusinessNumber).map(escapeHtml).join('、')}</p>${mode==='associate'?state.selectedRequirementNos.map(no=>{const row=getPmsMaterialRequirement(no)!;return `<label class="block text-sm">${escapeHtml(pmsBusinessNumber(no))}<select class="mt-1 h-9 w-full rounded border px-2" data-mreq-associate-no="${escapeHtml(no)}"><option value="">请选择同SKU采购单</option>${listPmsMaterialPurchaseOrders().filter(order=>!order.requirementNo&&order.status!=='已关闭'&&row.lines.some(line=>line.materialCode===order.materialCode&&line.unit===order.unit&&line.pushStatus==='待下推')).map(order=>`<option value="${escapeHtml(order.purchaseOrderNo)}">${escapeHtml(pmsBusinessNumber(order.purchaseOrderNo))} · ${escapeHtml(order.materialName)}</option>`).join('')}</select></label>`}).join(''):mode==='push'?'<p class="text-sm">按每行实际采购量及已确认单价创建采购单。所有需求共同保存，任一行不合法则整批不保存。</p>':`<label class="block text-sm">${labels[mode]}<input class="mt-1 h-9 w-full rounded border px-2" type="${mode==='unitPrice'?'number':'text'}" data-mreq-batch-value></label>`}<footer class="flex justify-end gap-2">${renderSecondaryButton('取消',{prefix:EVENT_PREFIX,action:'close-overlay'})}${renderPrimaryButton(mode==='push'?'创建采购单':'保存设置',{prefix:EVENT_PREFIX,action:'save-batch'})}</footer></section></div>${renderPmsImagePreview()}`}

  if(state.overlay && ['edit','reject','associate','replace'].includes(state.overlay.kind)) return renderRequirementForm()+renderPmsImagePreview()

  const columnSettings = `<div data-pms-mreq-column-overlays>${controller.renderColumnSettings()}</div>`
  if (!state.overlay) return `${columnSettings}${renderPmsImagePreview()}`
  if (state.overlay.kind === 'detail') return `${columnSettings}${renderDetailOverlay(state.overlay.requirementNo)}${renderPmsImagePreview()}`
  return `${columnSettings}${renderPushOverlay(state.overlay.requirementNo)}${renderPmsImagePreview()}`
}

function renderInner(): string {
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({
      showHeader: true,
    title: '面辅料需求分析',
    feedbackHtml: `<div data-pms-mreq-feedback>${renderPmsFeedback(state.feedback,state.feedbackOk)}</div>`,
    filtersHtml: `<div data-pms-mreq-filters>${renderFilters()}</div>`,
    statsHtml: `<div data-pms-mreq-stats>${renderStats()}</div>`,
    listTitle: `共 ${filteredRows().length} 条`,
    listActionsHtml: `<select class="h-9 rounded border px-2 text-sm" aria-label="批量需求操作" data-mreq-batch-mode><option value="">批量操作</option>${[['associate','关联面辅料采购单'],['push','创建面辅料采购单'],['buyerName','设置采购员'],['supplierName','设置供应商'],['purchaseRegion','设置采购区域'],['remark','采购备注'],['unitPrice','确认实际采购价'],['printingFactory','设置印染工厂'],['printingProcess','设置印染工艺'],['rejectedReason','驳回需求']].map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select><span class="text-xs" data-mreq-selected-count>已选 ${state.selectedRequirementNos.length} 张</span><div class="flex flex-wrap items-center gap-2">${renderSecondaryButton('上传实际采购数量',{prefix:EVENT_PREFIX,action:'open-file-quantity'},'upload')}${renderSecondaryButton('上传入库数量',{prefix:EVENT_PREFIX,action:'open-file-inbound'},'upload')}${renderSecondaryButton('批量填写物流',{prefix:EVENT_PREFIX,action:'open-logistics'},'truck')}${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}</div>`,
    tableHtml: `<div data-pms-mreq-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-mreq-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-mreq-overlays>${renderOverlays()}</div>`,
  })
}

function refreshAll(resetFilters=false):void {
  const root=rootElement();if(!root) return
  controller.refresh({overlays:false})
  const update=(part:string,html:string)=>{const region=root.querySelector<HTMLElement>(`[data-pms-mreq-${part}]`);if(region){region.innerHTML=html;hydratePmsSurface(region)}}
  const title=root.querySelector<HTMLElement>('[data-standard-list-table-section] h2');if(title) title.textContent=`共 ${filteredRows().length} 条`
  update('stats',renderStats());update('feedback',renderPmsFeedback(state.feedback,state.feedbackOk));if(resetFilters) update('filters',renderFilters())
  refreshOverlays();syncProcessSelectionHeader(root)
}
function preserveEditingError():void {
  const root=rootElement();if(!root) return
  const panel=root.querySelector('[role="dialog"] section')
  let alert=panel?.querySelector<HTMLElement>('[data-pms-edit-error]')
  if(!alert && panel){alert=document.createElement('p');alert.dataset.pmsEditError='';alert.className='rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700';alert.setAttribute('role','alert');panel.prepend(alert)}
  if(alert) alert.textContent=state.overlayError
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-mreq-overlays]')
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
    state.feedback = '当前查询条件下没有可导出的面辅料需求。'
    state.feedbackOk = false
    refreshAll()
    return
  }
  downloadPmsCsv(
    '面辅料需求分析.csv',
    ['需求单号', '来源采购单', '款式', 'SPU', '状态', '物料编码', '物料名称', '单位', 'BOM需求', '库存', '历史库存', 'ID历史库存', '采购中', '建议采购量', '实际采购量', '供应商', '下推状态', '生成采购单'],
    rows.flatMap((row) =>
      row.lines.map((line) => [row.requirementNo, row.sourcePurchaseOrderNo, row.productName, row.spu, row.status, line.materialCode, line.materialName, line.unit, line.bomDemand, line.stockQty, line.historicalStockQty, line.idHistoricalStockQty, line.purchasingQty, line.suggestedQty, line.actualQty, line.supplierName, line.pushStatus, line.generatedPurchaseOrderNo]),
    ),
  )
  state.feedback = `已导出 ${rows.length} 张需求单的全部物料行。`
  state.feedbackOk = true
  refreshAll()
}

async function submitPush(requirementNo: string): Promise<void> {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-mreq-push-root]')
  if (!surface) return
  const requirement = listPmsMaterialRequirements().find((row) => row.requirementNo === requirementNo)
  if (!requirement) return
  const inputs: PmsRequirementPushLineInput[] = []
  requirement.lines.forEach((line) => {
    if (line.pushStatus !== '待下推' || line.suggestedQty <= 0) return
    const qty = Number.parseFloat(surface.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-push-qty="${line.lineNo}"]`)?.value ?? '')
    const price = Number.parseFloat(surface.querySelector<HTMLInputElement>(`[data-${EVENT_PREFIX}-push-price="${line.lineNo}"]`)?.value ?? '')
    if (Number.isFinite(qty) && qty > 0) inputs.push({ lineNo: line.lineNo, actualQty: qty, unitPrice: Number.isFinite(price) ? price : 0 })
  })
  try {
    const created = await pushPmsMaterialRequirement(requirementNo, inputs, PMS_BUYER_ACTOR,state.overlay?.clientActionId)
    state.feedback = `已下推生成 ${created.length} 张面辅料采购单：${created.map((order) => pmsBusinessNumber(order.purchaseOrderNo)).join('、')}`
    state.feedbackOk = true
    state.overlay = null
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '下推面辅料采购单失败'
    preserveEditingError()
  }
}

export async function renderPmsMaterialRequirementsPage(): Promise<string> {
  try{await Promise.all([hydratePmsMaterialRequirementsFromIdb(),hydratePmsMaterialPurchaseOrdersFromIdb()])}catch(error){state.feedback=error instanceof Error?error.message:'用户数据不可读';state.feedbackOk=false}
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-pms-mreq-root data-skip-page-rerender="true"><style>[data-pms-mreq-root] [data-standard-list-scroll] td{vertical-align:top}</style>${renderInner()}</div>`
}

export function closePmsMaterialRequirementOverlays(): boolean {
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

export async function handlePmsMaterialRequirementsEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (handlePmsCommonImageEvent(target, event, refreshOverlays)) return true
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    closeOverlay()
    return true
  }

  const extraField=target.closest<HTMLInputElement|HTMLSelectElement>('[data-pms-mreq-field]');if(extraField?.dataset.pmsMreqField?.startsWith('filter:')){state.filters[extraField.dataset.pmsMreqField.slice(7)]=extraField.value;return true}
  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  const fieldName = field?.dataset.pmsMreqField
  if (field && fieldName) {
    if(fieldName==='selection-scope'){state.selectedRequirementNos=field.value==='clear'?[]:field.value==='page'?filteredRows().slice((state.currentPage-1)*state.preferences.pageSize,state.currentPage*state.preferences.pageSize).map(row=>row.requirementNo):filteredRows().map(row=>row.requirementNo);refreshAll();return true}
    if (fieldName === 'keyword') {
      state.keyword = field.value
      return true
    }
    if (fieldName === 'status') {
      state.status = field.value as RequirementPageState['status']
      return true
    }
    if (fieldName === 'pageSize') {
      controller.setPageSize(Number.parseInt((field as HTMLSelectElement).value, 10))
      controller.refresh({ overlays: false })
      return true
    }
    return true
  }

  const selection=target.closest<HTMLInputElement>('[data-mreq-select]');if(selection){if(event?.type==='change'){const no=selection.dataset.mreqSelect || '';state.selectedRequirementNos=selection.checked?[...new Set([...state.selectedRequirementNos,no])]:state.selectedRequirementNos.filter(value=>value!==no);const count=rootElement()?.querySelector('[data-mreq-selected-count]');if(count)count.textContent=`已选 ${state.selectedRequirementNos.length} 张`}return true}
  const batch=target.closest<HTMLSelectElement>('[data-mreq-batch-mode]');if(batch && event?.type==='change'){if(!state.selectedRequirementNos.length){state.feedback='选择要操作的需求';state.feedbackOk=false;refreshAll();return true}if(batch.value){state.overlay={kind:'batch',mode:batch.value,requirementNo:'',clientActionId:crypto.randomUUID()};batch.value='';refreshOverlays()}return true}
  if(event?.type==='change' && target instanceof HTMLInputElement && target.matches('[data-mreq-upload-file]') && state.overlay?.kind==='file'){await readMreqUpload(target.files?.[0]);return true}
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  const action = actionNode?.dataset.pmsMreqAction
  if (!action) return false

  if(action==='toggle-page'){const nos=filteredRows().slice((state.currentPage-1)*state.preferences.pageSize,state.currentPage*state.preferences.pageSize).map(row=>row.requirementNo);state.selectedRequirementNos=actionNode instanceof HTMLInputElement && actionNode.checked?[...new Set([...state.selectedRequirementNos,...nos])]:state.selectedRequirementNos.filter(no=>!nos.includes(no));refreshAll();return true}
  if(action==='open-file-quantity'||action==='open-file-inbound'){state.overlay={kind:'file',mode:action==='open-file-quantity'?'quantity':'inbound',rows:[],fileName:'',clientActionId:crypto.randomUUID()};state.overlayError='';refreshOverlays();return true}
  if(action==='mreq-file-template' && state.overlay?.kind==='file'){const mode=state.overlay.mode;downloadPmsFile(mode==='quantity'?'实际采购数量模板.xls':'入库数量模板.xls',buildPmsHtmlTemplateFile('数量导入模板',[mode==='quantity'?'需求单号':'采购单号','SKU','数量'],[]),'application/vnd.ms-excel');return true}
  if(action==='submit-file' && state.overlay?.kind==='file'){const overlay=state.overlay;try{if(overlay.mode==='quantity')await importPmsRequirementQuantities(overlay.rows.map(row=>({requirementNo:row.number,materialCode:row.sku,quantity:row.quantity})),overlay.clientActionId);else await registerAndInboundPmsMaterialPurchases(overlay.rows.map(row=>({purchaseOrderNo:row.number,materialCode:row.sku,quantity:row.quantity})),PMS_BUYER_ACTOR,overlay.clientActionId);state.feedback=`已保存文件中的 ${overlay.rows.length} 条数量`;state.feedbackOk=true;state.overlay=null;refreshAll()}catch(error){state.overlayError=error instanceof Error?error.message:'数量未保存';preserveEditingError()}return true}
  if(action==='open-logistics'){if(!state.selectedRequirementNos.length){state.feedback='先选择面辅料需求';state.feedbackOk=false;refreshAll();return true}state.overlay={kind:'logistics',clientActionId:crypto.randomUUID()};state.overlayError='';refreshOverlays();return true}
  if(action==='submit-logistics'&&state.overlay?.kind==='logistics'){const overlay=state.overlay;try{const nodes=Array.from(rootElement()?.querySelectorAll<HTMLElement>('[data-mreq-logistics-order]')||[]);if(!nodes.length)throw new Error('所选需求还没有关联采购单，先创建或关联采购单');const rows=nodes.map(node=>{const read=(key:string)=>node.querySelector<HTMLInputElement>(`[name="${key}"]`)?.value.trim()||'';return{purchaseOrderNo:node.dataset.mreqLogisticsOrder||'',company:read('company'),trackingNo:read('trackingNo'),shipDate:read('shipDate'),estimatedArrival:read('estimatedArrival'),boxCount:Number(read('boxCount')),rolls:Number(read('rolls')),qty:Number(read('qty')),fee:Number(read('fee')),remark:read('remark')}});await importPmsMaterialLogistics(rows,PMS_BUYER_ACTOR,overlay.clientActionId);state.feedback=`已保存 ${rows.length} 条物流信息`;state.feedbackOk=true;state.overlay=null;refreshAll()}catch(error){state.overlayError=error instanceof Error?error.message:'物流未保存';preserveEditingError()}return true}
  if(action==='save-batch' && state.overlay?.kind==='batch'){const overlay=state.overlay,value=rootElement()?.querySelector<HTMLInputElement>('[data-mreq-batch-value]')?.value || '';try{if(overlay.mode==='associate')await batchAssociatePmsMaterialRequirements(state.selectedRequirementNos.map(requirementNo=>({requirementNo,purchaseOrderNo:rootElement()?.querySelector<HTMLSelectElement>(`[data-mreq-associate-no="${requirementNo}"]`)?.value||''})),overlay.clientActionId);else if(overlay.mode==='push'){const entries=state.selectedRequirementNos.map(requirementNo=>({requirementNo,lines:getPmsMaterialRequirement(requirementNo)!.lines.filter(line=>line.pushStatus==='待下推' && line.actualQty>0).map(line=>({lineNo:line.lineNo,actualQty:line.actualQty,unitPrice:line.unitPrice || 0}))}));await batchPushPmsMaterialRequirements(entries,PMS_BUYER_ACTOR,overlay.clientActionId)}else await batchUpdatePmsMaterialRequirements(state.selectedRequirementNos,overlay.mode as Parameters<typeof batchUpdatePmsMaterialRequirements>[1],value,overlay.clientActionId);state.feedback='批量需求操作已保存';state.feedbackOk=true;state.overlay=null;state.selectedRequirementNos=[];refreshAll()}catch(error){state.overlayError=error instanceof Error?error.message:'批量操作未保存';preserveEditingError()}return true}
  if(action==='edit-requirement'){state.overlay={kind:actionNode?.dataset.editKind as 'edit'|'reject'|'associate'|'replace',requirementNo:actionNode?.dataset.requirementNo || '',clientActionId:crypto.randomUUID()};state.overlayError='';refreshOverlays();return true}
  if(action==='submit-edit'){
    const overlay=state.overlay
    if(!overlay || !(overlay.kind==='edit'||overlay.kind==='reject'||overlay.kind==='associate'||overlay.kind==='replace')) return true
    const text=(key:string)=>rootElement()?.querySelector<HTMLInputElement|HTMLSelectElement>(`[data-mreq-edit="${key}"]`)?.value || ''
    const patch=overlay.kind==='reject'?{rejectedReason:text('rejectedReason')}:overlay.kind==='associate'?{associatePurchaseOrderNo:text('associatePurchaseOrderNo')}:overlay.kind==='replace'?{replacement:{lineNo:text('lineNo'),materialCode:text('materialCode')}}:{skuQty:Number(text('skuQty')),purchaseRegion:text('purchaseRegion'),buyerName:text('buyerName'),remark:text('remark'),lineDetails:getPmsMaterialRequirement(overlay.requirementNo)!.lines.filter(line=>line.pushStatus==='待下推').map(line=>({lineNo:line.lineNo,supplierName:text(`${line.lineNo}:supplierName`),warehouse:text(`${line.lineNo}:warehouse`),actualQty:Number(text(`${line.lineNo}:actualQty`))}))}
    try{await updatePmsMaterialRequirement(overlay.requirementNo,patch,overlay.clientActionId);state.feedback='需求操作已保存';state.feedbackOk=true;state.overlay=null;refreshAll()}catch(error){state.overlayError=error instanceof Error?error.message:'需求未保存';preserveEditingError()};return true
  }
  if (action === 'query') {
    state.currentPage = 1
    state.feedback = ''
    refreshAll()
    return true
  }
  if (action === 'reset') {
    state.keyword = ''
    state.status = '';state.filters={}
    state.currentPage = 1
    state.feedback = ''
    refreshAll(true)
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
    const key = actionNode?.closest<HTMLElement>('[data-pms-mreq-column-key]')?.dataset.pmsMreqColumnKey || ''
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
    state.overlay = { kind: 'detail', requirementNo: actionNode?.dataset.requirementNo || '', clientActionId: nextPmsActionId('pms-mreq-detail') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-push') {
    state.overlay = { kind: 'push', requirementNo: actionNode?.dataset.requirementNo || '', clientActionId: nextPmsActionId('pms-mreq-push') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'close-overlay') {
    closeOverlay()
    return true
  }
  if (action === 'submit-push') {
    if (state.overlay?.kind === 'push') await submitPush(state.overlay.requirementNo)
    return true
  }
  return false
}

export function getPmsMaterialRequirementRowCountForTest(): number {
  return filteredRows().length
}
