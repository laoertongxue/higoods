import { listPmsFirstLegBatches } from '../../data/pms/first-leg-logistics.ts'
import { renderMpoBarcodeOverlay, handleMpoBarcodeEvent, closeMpoBarcodeOverlay } from './material-purchase-barcodes.ts'
import { renderMpoParityActions, renderMpoParityToolbar, renderMpoSkuSummary, renderMpoSkuTable, mpoQuantityText, renderMpoParityOverlay, hasMpoParityOverlay, closeMpoParityOverlay, handleMpoParityEvent, exportMpoParityRows, buildMpoPurchasePrintHtml, mpoParityHasUnsavedChanges, mpoParityIsSaving, renderMpoExecutionFacts, renderMpoCostSummary } from './material-purchase-order-parity.ts'
import { pmsBusinessNumber } from '../../utils/pms-business-number.ts'
import { ensurePurchaseCatalogState, listPurchaseGoodsReferences } from '../../data/pms/canonical-purchase-references.ts'
import { readPcsMaterialHandoff } from '../../data/pcs-material-handoff.ts'
import { getMaterialSkuRecordById } from '../../data/pcs-material-archive-repository.ts'
import { hydratePmsSuppliersFromIdb, listPmsSuppliers } from '../../data/pms/suppliers.ts'
// @page-pattern: list
import { hydratePmsTmfPurchaseReferencesFromIdb, getTmfMaterialPurchase, reviseTmfMaterialPurchase, type TmfPurchaseActor } from '../../data/pms/tmf-material-purchases.ts'
import { renderTmfPurchaseRevision, renderTmfPurchaseRevisionHistory } from './tmf-purchase-revision.ts'
import { renderTmfTipPurchaseForm, readTmfTipPurchaseForm, updateTmfTipPurchaseSource } from './tmf-tip-purchase-form.ts'
import { renderStandardListPage } from '../../components/ui/list-page.ts'
import { handleProcessFilterPresentation, renderProcessFilterToggle, renderProcessOrderStats, renderProcessSelectionHeader, syncProcessSelectionHeader } from '../../components/ui/process-order-list-presentation.ts'
import { renderDangerButton, renderPrimaryButton, renderSecondaryButton } from '../../components/ui/button.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../../components/ui/list-table-model.ts'
import {
  convertPmsMaterialPurchaseToRaw, inspectPmsMaterialPurchaseOrder, updatePmsMaterialLogistics,
  createPmsMaterialPurchaseOrder, updatePmsMaterialPurchaseOrder, copyPmsMaterialPurchaseOrder,
  createPmsTmfTipPurchase, batchAdvancePmsMaterialPurchaseOrders,
  closePmsMaterialPurchaseOrder,
  getPmsMaterialPurchaseOrder,
  importPmsMaterialLogistics,
  listPmsMaterialLogisticsRecords,
  listPmsMaterialPurchaseLogs,
  listPmsMaterialPurchaseOrders,
  pmsAllowedMaterialOrderNextStatuses,
  registerPmsMaterialPurchaseArrival,
  batchUpdatePmsMaterialPurchaseOrders,
  addPmsMaterialPurchaseAttachment,removePmsMaterialPurchaseAttachment,readPmsMaterialPurchaseAttachment,
  validatePmsLogisticsImportRow,
  getPmsPcsPurchaseUnitOptions, hydratePmsMaterialPurchaseOrdersFromIdb, savePmsPcsMaterialPurchaseDraft,
  type PmsPcsMaterialPurchaseDraftInput, type PmsPcsMaterialPurchaseSource,
  type PmsLogisticsImportRow,
  type PmsMaterialLogisticsRecord,
  type PmsMaterialPurchaseOrder,
  type PmsMaterialPurchaseOrderStatus,
  getPmsMaterialPurchaseOrderLines, pmsMaterialPurchaseOrderAmount, pmsMaterialPurchaseSellerArrivalStatus,
  pmsMaterialLogisticsIdentity,
} from '../../data/pms/material-purchase-orders.ts'
import { nextPmsActionId, PMS_BUYER_ACTOR, PmsDomainError } from '../../data/pms/runtime.ts'
import { downloadPmsCsv, buildPmsHtmlTemplateFile, downloadPmsFile } from '../../utils/pms-export.ts'
import { parsePmsExcelRows } from '../../utils/pms-excel-import.ts'
import { escapeHtml } from '../../utils.ts'
import {
  confirmPmsAction,
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

interface ImportPreviewRow {
  row: PmsLogisticsImportRow
  error: string
}

type PcsPurchaseTab = 'purchase' | 'source' | 'history'
interface PcsPurchaseForm {
  materialSkuId: string
  unitRelationId: string
  quantity: string
  supplierCode: string
  purchaseRegion: string
  unitPrice: string
  currency: 'RMB' | 'IDR' | 'USD'
  warehouse: string
  expectedArrivalDate: string
  buyerName: string
  remark: string
  purchaseOrderNo?: string
  expectedVersion?: number
  operationId: string
}

type MpoOverlay =
  | null
  | {kind:'attachment';orderNo:string;category:'物流凭证'|'附加图片';clientActionId:string}
  | {kind:'barcodes';orderNo:string;clientActionId:string;initialMode?:'import'|'print'}
  | {kind:'inspection';orderNo:string;clientActionId:string}
  | {kind:'logistics-edit';recordNo:string;clientActionId:string}
  | {kind:'logistics-new';orderNo:string;clientActionId:string}
  | {kind:'batch-fields';field:string;clientActionId:string}
  | { kind: 'tmf-revision'; orderNo: string; clientActionId: string }
  | { kind: 'tip-purchase'; clientActionId: string }
  | { kind: 'detail'; orderNo: string; clientActionId: string }
  | { kind: 'arrival'; orderNo: string; clientActionId: string }
  | { kind: 'close'; orderNo: string; clientActionId: string }
  | { kind: 'import'; rows: ImportPreviewRow[]; clientActionId: string }

interface MpoPageState extends ProcessOrderListControllerState {
  attachmentFile:File|null
  attachmentPreviewUrl:string
  attachmentPreviewType:string
  keyword: string
  keywordField:string
  listSort:string
  multiFilters:Record<string,string[]>
  dateFilters:Record<string,string>
  rangeFilters:Record<string,string>
  status: '' | PmsMaterialPurchaseOrderStatus
  logisticsFilter: '' | '未导入' | '已导入'
  selectedOrderNos: string[]
  overlay: MpoOverlay
  overlayError: string
  feedback: string
  feedbackOk: boolean
  readStatus: 'initial' | 'loading' | 'ready' | 'error'
  readError: string
  purchaseView: 'list' | 'edit' | 'detail'
  purchaseTab: PcsPurchaseTab
  purchaseForm: PcsPurchaseForm | null
  purchaseOrderNo: string
  purchaseDirty: boolean
  purchaseSaving: boolean
  purchaseError: string
}

const EVENT_PREFIX = 'pms-mpo'
const ROOT_SELECTOR = '[data-pms-mpo-root]'

const state: MpoPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 5 },
  preferencesLoaded: false,
  showColumnSettings: false,
  attachmentFile:null,attachmentPreviewUrl:'',attachmentPreviewType:'',
  keyword: '',keywordField:'all',listSort:'',multiFilters:{},dateFilters:{},rangeFilters:{},
  status: '',
  logisticsFilter: '',
  selectedOrderNos: [],
  overlay: null,
  overlayError: '',
  feedback: '',
  feedbackOk: true,
  readStatus: 'initial', readError: '', purchaseView: 'list', purchaseTab: 'purchase', purchaseForm: null,
  purchaseOrderNo: '', purchaseDirty: false, purchaseSaving: false, purchaseError: '',
}

let purchaseEntry = ''
function purchaseEntryKey(): string { return typeof window === 'undefined' ? '' : `${window.location.pathname}${window.location.search}` }

function beginPcsPurchaseForm(materialSkuId: string, order?: PmsMaterialPurchaseOrder): void {
  const units = getPmsPcsPurchaseUnitOptions(materialSkuId)
  const queryRelation = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('unitRelationId') || ''
  state.purchaseForm = { materialSkuId, unitRelationId: order?.pcsSource?.relationId || (units.some(unit => unit.relationId === queryRelation) ? queryRelation : ''),
    quantity: order ? String(order.orderedQty) : '', supplierCode: order?.supplierCode || '', purchaseRegion: order?.purchaseRegion || '',
    unitPrice: order ? String(order.unitPrice) : '', currency: order?.currency || 'RMB', warehouse: order?.warehouse || '',
    expectedArrivalDate: order?.expectedArrivalDate || '', buyerName: order?.buyerName || PMS_BUYER_ACTOR.name,
    remark: order?.remark || '', purchaseOrderNo: order?.purchaseOrderNo, expectedVersion: order?.draftVersion,
    operationId: `PCS-PURCHASE:${crypto.randomUUID()}` }
  state.purchaseView = 'edit'; state.purchaseTab = 'purchase'; state.purchaseDirty = false; state.purchaseError = ''
}

function applyPcsPurchaseEntry(): void {
  const entry = purchaseEntryKey()
  if (entry === purchaseEntry || state.readStatus !== 'ready') return
  purchaseEntry = entry
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
  const orderNo = params.get('purchaseOrderNo') || ''
  if (orderNo) {
    const order = getPmsMaterialPurchaseOrder(orderNo)
    if (!order) throw new Error('采购单不存在，请返回列表重新读取。')
    if(order.pcsSource){state.purchaseOrderNo=orderNo;state.purchaseView='detail';state.purchaseTab='purchase';state.purchaseForm=null}else{state.purchaseView='list';state.purchaseForm=null;state.overlay={kind:'detail',orderNo,clientActionId:crypto.randomUUID()}}
  } else if (params.get('pcsIntent') === 'purchase') {
    const handoff = readPcsMaterialHandoff()
    if (!handoff || handoff.kind !== 'PURCHASE') throw new Error('缺少采购物料，请返回物料档案重新发起。')
    beginPcsPurchaseForm(handoff.target.materialSkuId)
  } else { state.purchaseView = 'list'; state.purchaseForm = null;if(params.has('keyword'))state.keyword=params.get('keyword')||'' }
}

function loadPurchasePage(force = false): void {
  if (!force && state.readStatus !== 'initial') return
  state.readStatus = 'loading'; state.readError = ''
  void Promise.all([hydratePmsMaterialPurchaseOrdersFromIdb(force), hydratePmsTmfPurchaseReferencesFromIdb(force), ensurePurchaseCatalogState(), hydratePmsSuppliersFromIdb()]).then(() => {
    state.readStatus = 'ready'; applyPcsPurchaseEntry(); refreshAll()
  }).catch(error => { state.readStatus = 'error'; state.readError = error instanceof Error ? error.message : '采购资料无法读取。'; refreshAll() })
}

function setPurchaseLocation(orderNo = ''): void {
  if (typeof window === 'undefined') return
  window.history.replaceState(window.history.state, '', `/pms/material-purchase-orders${orderNo ? `?purchaseOrderNo=${encodeURIComponent(orderNo)}` : ''}`)
  purchaseEntry = purchaseEntryKey()
}

function currentPurchaseUnit(): PmsPcsMaterialPurchaseSource | undefined {
  const form = state.purchaseForm
  if (!form) return undefined
  const source = form.purchaseOrderNo ? getPmsMaterialPurchaseOrder(form.purchaseOrderNo)?.pcsSource : undefined
  if (source?.relationId === (form.unitRelationId || null)) return source
  return getPmsPcsPurchaseUnitOptions(form.materialSkuId).find(unit => (unit.relationId || '') === form.unitRelationId)
}

function renderPurchaseUnitSummary(unit: PmsPcsMaterialPurchaseSource | undefined, quantity: string, price: string, currency: string): string {
  if (!unit) return '<span class="text-red-700">请重新选择有效的采购单位。</span>'
  const mainQty = Number(quantity) * unit.mainQtyPerPurchaseUnit, total = Number(quantity) * Number(price)
  return `<span>1 ${escapeHtml(unit.purchaseUnit)} = ${unit.mainQtyPerPurchaseUnit} ${escapeHtml(unit.mainUnit)}</span><span>${quantity && Number.isFinite(mainQty) ? `主单位数量 ${formatPmsQty(mainQty, unit.mainUnit)}` : '填写数量后计算主单位数量'}</span><span>${quantity && price && Number.isFinite(total) ? `含税金额 ${total.toFixed(2)} ${escapeHtml(currency)}` : '填写实际单价后计算金额'}</span>`
}

function purchaseField(label: string, name: keyof PcsPurchaseForm, type = 'text', options?: string): string {
  const form = state.purchaseForm!, value = String(form[name] ?? '')
  const attrs = `data-${EVENT_PREFIX}-field="pcs-${name}" data-skip-page-rerender="true" ${state.purchaseSaving ? 'disabled' : ''}`
  const inputClass = 'h-10 w-full rounded-md border bg-white px-3 text-sm'
  const choices = name === 'warehouse' ? [...new Set(listPmsMaterialPurchaseOrders().map(order => order.warehouse).filter(Boolean))]
    : name === 'purchaseRegion' ? ['中国', '印度尼西亚', '马来西亚'] : []
  return `<label class="block"><span class="mb-1.5 block text-sm font-medium">${escapeHtml(label)}</span>${options !== undefined
    ? `<select class="${inputClass}" ${attrs}>${options}</select>`
    : `<input class="${inputClass}" type="${type}" value="${escapeHtml(value)}" ${type === 'number' ? 'min="0" step="any" inputmode="decimal"' : ''} ${choices.length ? `list="pms-pcs-${name}-options"` : ''} ${attrs} />${choices.length ? `<datalist id="pms-pcs-${name}-options">${choices.map(choice => `<option value="${escapeHtml(choice)}"></option>`).join('')}</datalist>` : ''}`}</label>`
}

function renderPcsPurchaseWorkspace(): string {
  const editing = state.purchaseView === 'edit', form = state.purchaseForm
  const order = editing ? (form?.purchaseOrderNo ? getPmsMaterialPurchaseOrder(form.purchaseOrderNo) : undefined) : getPmsMaterialPurchaseOrder(state.purchaseOrderNo)
  const skuId = form?.materialSkuId || order?.pcsSource?.materialSkuId || '', sku = getMaterialSkuRecordById(skuId)
  const source = editing ? currentPurchaseUnit() : order?.pcsSource
  if (!sku || !source || (editing && !form)) return `<div class="rounded-lg border bg-white p-6">采购来源无法读取。${renderSecondaryButton('返回采购列表', {prefix:EVENT_PREFIX,action:'pcs-list'})}</div>`
  const tabs: Array<[PcsPurchaseTab, string]> = [['purchase', '采购信息'], ['source', '物料与计量单位'], ...(!editing ? [['history', '操作记录'] as [PcsPurchaseTab, string]] : [])]
  let body = ''
  if (state.purchaseTab === 'source') {
    body = `<div class="flex items-center gap-4">${renderPmsBusinessImage(sku.skuImageUrl, `${sku.materialName}物料图`, 'h-20 w-20')}<div><strong>${escapeHtml(sku.materialName)}</strong><p class="mt-1 text-sm">${escapeHtml(source.materialSkuCode)}</p><p class="mt-1 text-sm text-slate-500">规格型号：${escapeHtml(source.specName || sku.specName)}</p><a class="mt-2 inline-block text-sm text-blue-700" href="${escapeHtml(source.returnPath)}">查看来源物料</a></div></div><dl class="mt-6 grid gap-4 text-sm md:grid-cols-2"><div><dt class="text-slate-500">主计量单位</dt><dd>${escapeHtml(source.mainUnit)} · V${source.mainUnitVersion}</dd></div><div><dt class="text-slate-500">采购单位</dt><dd>${escapeHtml(source.purchaseUnit)}</dd></div><div><dt class="text-slate-500">换算</dt><dd>1 ${escapeHtml(source.purchaseUnit)} = ${source.mainQtyPerPurchaseUnit} ${escapeHtml(source.mainUnit)}</dd></div><div><dt class="text-slate-500">换算依据</dt><dd>${escapeHtml(source.basis)}</dd></div><div><dt class="text-slate-500">单位关系版本</dt><dd>${source.relationVersion ? `${escapeHtml(source.relationId || '')} · V${source.relationVersion}` : '主单位，无辅助换算'}</dd></div>${source.packageSnapshot ? `<div><dt class="text-slate-500">采用包装</dt><dd>${source.packageSnapshot.contentQty} ${escapeHtml(source.packageSnapshot.contentUnitId)} / ${escapeHtml(source.purchaseUnit)} · V${source.packageSnapshot.version}<p class="text-xs text-slate-500">${escapeHtml(source.packageSnapshot.packageSpecId)} · ${escapeHtml(source.packageSnapshot.measurementBasis)}</p></dd></div>` : ''}<div><dt class="text-slate-500">${source.capturedAt ? '采用时间' : '采用方式'}</dt><dd>${source.capturedAt ? formatPmsTime(source.capturedAt) : '保存草稿时保留本次计量快照'}</dd></div></dl>`
  } else if (state.purchaseTab === 'history' && order) {
    const logs = listPmsMaterialPurchaseLogs(order.purchaseOrderNo)
    body = `<ul class="space-y-3">${logs.map(log => `<li class="rounded-md border p-3 text-sm"><strong>${escapeHtml(log.action)}</strong><span class="ml-3 text-slate-500">${escapeHtml(log.actorName)} · ${formatPmsTime(log.occurredAt)}</span><p class="mt-2">${escapeHtml(log.afterValue)}</p></li>`).join('') || '<li>暂无操作记录</li>'}</ul>`
  } else if (editing && form) {
    const unitChoices = getPmsPcsPurchaseUnitOptions(skuId)
    if (!unitChoices.some(unit => unit.relationId === source.relationId)) unitChoices.push(source)
    const options = (values: Array<[string, string]>, selected: string, placeholder = '') => `${placeholder ? `<option value="">${placeholder}</option>` : ''}${values.map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}`
    body = `<div class="grid gap-x-6 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
      ${purchaseField('采购数量 *', 'quantity', 'number')}
      ${purchaseField('采购单位 *', 'unitRelationId', 'text', options(unitChoices.map(unit => [unit.relationId || '', `${unit.purchaseUnit}（${unit.mainQtyPerPurchaseUnit} ${unit.mainUnit}）${unit.relationVersion ? ` · 换算 V${unit.relationVersion}` : ' · 主单位'}`]), form.unitRelationId))}
      ${purchaseField('供应商 *', 'supplierCode', 'text', options(listPmsSuppliers().filter(item => item.status === '已启用').map(item => [item.supplierCode, `${item.supplierName}（${item.supplierCode}）`]), form.supplierCode, '请选择供应商'))}
      ${purchaseField(`实际含税单价 / ${source.purchaseUnit} *`, 'unitPrice', 'number')}
      ${purchaseField('采购币种 *', 'currency', 'text', options([['RMB', '人民币 RMB'], ['IDR', '印尼盾 IDR'], ['USD', '美元 USD']], form.currency))}
      ${purchaseField('采购区域 *', 'purchaseRegion')}
      ${purchaseField('收货仓 *', 'warehouse')}
      ${purchaseField('预计到货日期 *', 'expectedArrivalDate', 'date')}
      ${purchaseField('采购负责人 *', 'buyerName')}
      <div class="md:col-span-2 lg:col-span-3">${purchaseField('备注', 'remark')}</div>
    </div><div class="mt-5 flex flex-wrap gap-x-6 gap-y-2 rounded-md bg-slate-50 p-3 text-sm" data-pms-pcs-purchase-summary>${renderPurchaseUnitSummary(source, form.quantity, form.unitPrice, form.currency)}</div>`
  } else if (order) {
    body = `<dl class="grid gap-5 text-sm md:grid-cols-2 lg:grid-cols-3">${[
      ['供应商', order.supplierName], ['采购区域', order.purchaseRegion || ''], ['采购负责人', order.buyerName],
      ['采购数量', mpoQuantityText(order,'orderedQty')], ['主单位数量', formatPmsQty(order.mainUnitQuantity || 0, source.mainUnit)],
      ['实际含税单价', `${order.unitPrice.toFixed(4)} ${order.currency} / ${order.unit}`],
      ['实际含税金额', `${(pmsMaterialPurchaseOrderAmount(order)).toFixed(2)} ${order.currency}`], ['收货仓', order.warehouse],
      ['预计到货日期', order.expectedArrivalDate], ['创建日期', order.orderDate], ['草稿版本', `V${order.draftVersion}`], ['备注', order.remark || '—'],
    ].map(([label, value]) => `<div><dt class="text-slate-500">${escapeHtml(label)}</dt><dd class="mt-1 font-medium">${escapeHtml(value)}</dd></div>`).join('')}</dl>`
  }
  return `<section class="mx-auto max-w-6xl space-y-4" data-pms-pcs-purchase-workspace><header class="flex flex-wrap items-center justify-between gap-3"><div><h1 class="text-xl font-semibold">${editing ? (order ? '编辑采购草稿' : '新建采购草稿') : escapeHtml(order!.purchaseOrderNo)}</h1><p class="mt-1 text-sm text-slate-500">${escapeHtml(sku.materialName)} · ${escapeHtml(sku.materialSkuCode)} · ${editing ? '尚未保存' : '草稿'}</p></div><div class="flex gap-2">${renderSecondaryButton('采购单列表',{prefix:EVENT_PREFIX,action:'pcs-list'})}${!editing ? renderPrimaryButton('编辑草稿',{prefix:EVENT_PREFIX,action:'pcs-edit'}) : ''}</div></header>
    ${renderPmsFeedback(state.feedback, state.feedbackOk)}${renderPmsOverlayError(state.purchaseError)}${state.purchaseError && form?.purchaseOrderNo ? renderSecondaryButton('重新读取草稿', {prefix:EVENT_PREFIX,action:'pcs-read-draft'}) : ''}
    <section class="overflow-hidden rounded-lg border bg-white"><nav class="flex gap-1 border-b px-4" role="tablist">${tabs.map(([id,label]) => `<button type="button" role="tab" aria-selected="${state.purchaseTab === id}" class="border-b-2 px-4 py-3 text-sm ${state.purchaseTab === id ? 'border-blue-600 font-medium text-blue-700' : 'border-transparent text-slate-500'}" data-${EVENT_PREFIX}-action="pcs-tab" data-tab="${id}" data-skip-page-rerender="true">${label}</button>`).join('')}</nav><div class="p-5" role="tabpanel">${body}</div></section>
    ${editing ? `<footer class="sticky bottom-0 flex items-center justify-between rounded-lg border bg-white p-4 shadow-sm"><span class="text-sm text-slate-500">${state.purchaseSaving ? '正在保存…' : '保存后保留本次采购条件与计量关系'}</span><div class="flex gap-2">${renderSecondaryButton('取消',{prefix:EVENT_PREFIX,action:'pcs-cancel'})}${renderPrimaryButton(state.purchaseSaving ? '保存中…' : '保存草稿',{prefix:EVENT_PREFIX,action:'pcs-save'}).replace('<button', `<button ${state.purchaseSaving ? 'disabled' : ''}`)}</div></footer>` : ''}<div data-pms-mpo-overlays>${renderPmsImagePreview()+renderMpoAttachmentPreview()}</div></section>`
}

async function savePcsPurchaseForm(): Promise<void> {
  const form = state.purchaseForm
  if (!form || state.purchaseSaving) return
  if (!form.quantity.trim() || !form.unitPrice.trim()) { state.purchaseError = '请填写采购数量和实际含税单价。'; refreshAll(); return }
  state.purchaseSaving = true; state.purchaseError = ''; refreshAll()
  try {
    const input: PmsPcsMaterialPurchaseDraftInput = { ...form, unitRelationId: form.unitRelationId || null, quantity: Number(form.quantity), unitPrice: Number(form.unitPrice) }
    const order = await savePmsPcsMaterialPurchaseDraft(input, PMS_BUYER_ACTOR, form.operationId)
    state.purchaseDirty = false; state.purchaseForm = null; state.purchaseOrderNo = order.purchaseOrderNo; state.purchaseView = 'detail'; state.purchaseTab = 'purchase'
    state.feedback = `${order.purchaseOrderNo} 采购草稿已保存。`; state.feedbackOk = true; setPurchaseLocation(order.purchaseOrderNo)
  } catch (error) { state.purchaseError = error instanceof Error ? error.message : '采购草稿未保存，请保留当前输入并重试。' }
  finally { state.purchaseSaving = false; refreshAll() }
}

let purchaseLeaveGuardInstalled = false
function installPcsPurchaseLeaveGuard(): void {
  if (purchaseLeaveGuardInstalled || typeof window === 'undefined') return
  purchaseLeaveGuardInstalled = true
  window.addEventListener('beforeunload', event => {
    if (!rootElement() || (!state.purchaseDirty && !state.purchaseSaving&&!mpoParityHasUnsavedChanges()&&!mpoParityIsSaving())) return
    event.preventDefault(); event.returnValue = ''
  })
  document.addEventListener('click', async event => {
    if (!rootElement() || (!state.purchaseDirty && !state.purchaseSaving&&!mpoParityHasUnsavedChanges()&&!mpoParityIsSaving()) || !(event.target instanceof HTMLElement)) return
    const navigation = event.target.closest<HTMLElement>('a[href], [data-route], [data-tab-href]')
    if (!navigation) return
    event.preventDefault();event.stopImmediatePropagation()
    if(state.purchaseSaving||mpoParityIsSaving())return
    if(await confirmPmsAction('当前采购内容尚未保存，离开后将放弃修改。','放弃修改并离开','离开采购表单')){state.purchaseDirty=false;closeMpoParityOverlay();navigation.click()}
  }, true)
}

function purchaseMoney(order: PmsMaterialPurchaseOrder): string {
  return `${pmsMaterialPurchaseOrderAmount(order).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${order.currency}`
}

function orderLogistics(orderNo: string): PmsMaterialLogisticsRecord[] {
  return listPmsMaterialLogisticsRecords().filter((record) => record.purchaseOrderNo === orderNo)
}

const filterLabels:Record<string,string>={materialType:'采购类型',purchaseRegion:'采购地区',usageType:'用途',supplierName:'面辅料供应商',buyerName:'采购人',stockProduction:'是否备货生产',arrival:'商家到货状态',placed:'下单状态',priceConfirmed:'是否已确定成本价'}
const dateLabels:Record<string,string>={create:'创建时间',inbound:'入库时间',purchased:'采购下单时间',sign:'签收时间',ship:'商家发货时间',transfer:'转运时间',warehouse:'到达仓库时间'}
function filterValue(order:PmsMaterialPurchaseOrder,key:string):string{
 if(key==='stockProduction')return order.isStockProduction===true?'是':order.isStockProduction===false?'否':'未记录'
 if(key==='arrival')return pmsMaterialPurchaseSellerArrivalStatus(order)
 if(key==='placed')return order.orderPlacementStatus || (order.rejectedReason?'驳回':['草稿','待采购'].includes(order.status)?'待下单':'已下单')
 if(key==='priceConfirmed')return order.priceConfirmed===true?'已确定':'未记录'
 return String(order[key as keyof PmsMaterialPurchaseOrder]||'未记录')
}
function orderDates(order:PmsMaterialPurchaseOrder,key:string):string[]{
 const logistics=orderLogistics(order.purchaseOrderNo)
 if(key==='create')return [order.orderDate]
 if(key==='inbound')return [order.inventoryPosting?.postedAt||'',...(order.inventoryPostings||[]).map(row=>row.postedAt),...logistics.map(row=>row.inboundAt||'')]
 if(key==='purchased')return [order.purchasedAt||'']
 if(key==='sign')return logistics.map(row=>row.domesticSignedAt)
 if(key==='ship')return logistics.map(row=>row.shipDate)
 if(key==='transfer')return logistics.filter(row=>row.headBatchNo).map(row=>listPmsFirstLegBatches().find(batch=>batch.batchNo===row.headBatchNo)?.actualShipDate||'').concat((order.transferVouchers||[]).map(row=>row.transferDate||''))
 return logistics.map(row=>row.headSignedAt).concat(order.arrivedAt||'')
}
function filteredRows(): PmsMaterialPurchaseOrder[] {
 const keywords=state.keyword.trim().toLowerCase().split(/[，,\s]+/).filter(Boolean)
 return listPmsMaterialPurchaseOrders().filter(order=>{
  if(state.status && order.status!==state.status)return false
  if(state.logisticsFilter){const has=orderLogistics(order.purchaseOrderNo).length>0;if(state.logisticsFilter==='已导入'?!has:has)return false}
  for(const [key,values] of Object.entries(state.multiFilters))if(values.length&&!values.includes(filterValue(order,key)))return false
  for(const key of Object.keys(dateLabels)){const from=state.dateFilters[key+'From'],to=state.dateFilters[key+'To'];if((from||to)&&!orderDates(order,key).some(date=>date&&(!from||date.slice(0,10)>=from)&&(!to||date.slice(0,10)<=to)))return false}
  for(const key of ['shipDays','transferDays']){const min=state.rangeFilters[key+'Min'],max=state.rangeFilters[key+'Max'];if(!min&&!max)continue;const values=orderLogistics(order.purchaseOrderNo).map(row=>{const start=key==='shipDays'?order.purchasedAt:row.domesticSignedAt,end=key==='shipDays'?row.shipDate:row.headSignedAt;return start&&end?(Date.parse(end)-Date.parse(start))/86400000:NaN});if(!values.some(value=>Number.isFinite(value)&&(!min||value>=Number(min))&&(!max||value<=Number(max))))return false}
  const lines=getPmsMaterialPurchaseOrderLines(order),logistics=orderLogistics(order.purchaseOrderNo)
  const lineValues=(key:string)=>lines.map(line=>String(line[key as keyof typeof line]||''))
  const applicant=String((order as unknown as Record<string,unknown>).applicantName||listPmsMaterialPurchaseLogs(order.purchaseOrderNo).find(log=>log.action==='创建采购单')?.actorName||'')
  const picker=String((order as unknown as Record<string,unknown>).pickerName||'')
  const identifiers=lines.flatMap(line=>{const sku=line.materialSkuId?getMaterialSkuRecordById(line.materialSkuId):undefined;return [sku?.barcode||'',...(sku?.barcodeAliases||[])]})
  const values=state.keywordField==='all'?[order.purchaseOrderNo,pmsBusinessNumber(order.purchaseOrderNo),order.styleName,order.styleCode,order.supplierName,order.sourceProductPurchaseOrderNo,order.remark,applicant,picker,...identifiers,...lines.flatMap(line=>[line.materialCode,line.materialName,line.materialSpu]),...logistics.flatMap(row=>[row.trackingNo,row.boxNo||'',row.headBatchNo||''])]:state.keywordField==='applicant'?[applicant]:state.keywordField==='picker'?[picker]:state.keywordField==='identifier'?identifiers:state.keywordField==='tracking'?logistics.map(row=>row.trackingNo):['boxNo','headBatchNo'].includes(state.keywordField)?logistics.map(row=>String(row[state.keywordField as keyof typeof row]||'')):['materialCode','materialName','materialSpu'].includes(state.keywordField)?lineValues(state.keywordField):[String(order[state.keywordField as keyof PmsMaterialPurchaseOrder]||''),state.keywordField==='purchaseOrderNo'?pmsBusinessNumber(order.purchaseOrderNo):'']
  return !keywords.length||keywords.some(keyword=>values.some(value=>value.toLowerCase().includes(keyword)))
 })
}

function statusTone(status: PmsMaterialPurchaseOrderStatus): 'blue' | 'green' | 'yellow' | 'red' | 'slate' {
  if (status === '待采购' || status === '已采购') return 'yellow'
  if (status === '部分到货') return 'blue'
  if (status === '已到货' || status === '已入库') return 'green'
  return 'slate'
}

const columns: StandardListColumn<PmsMaterialPurchaseOrder>[] = [
  {
    key: 'select',
    title: '',
    width: 44,
    required: true,
    leadingControlColumn: true,
    renderHeader: (rows) => renderProcessSelectionHeader(rows.map((row) => row.purchaseOrderNo), new Set(state.selectedOrderNos), EVENT_PREFIX),
    render: (row) => `<input type="checkbox" aria-label="选择 ${escapeHtml(pmsBusinessNumber(row.purchaseOrderNo))}" data-${EVENT_PREFIX}-field="select-row" data-order-no="${escapeHtml(row.purchaseOrderNo)}" ${state.selectedOrderNos.includes(row.purchaseOrderNo) ? 'checked' : ''} data-skip-page-rerender="true" />`,
  },
  {
    key: 'order',
    title: '采购单 / 状态',
    width: 210,
    required: true,
    freezeable: true,
    sortable: true,
    sortValue: (row) => row.purchaseOrderNo,
    render: row => `<button class="font-semibold text-blue-700" data-pms-mpo-action="open-order-detail" data-order-no="${escapeHtml(row.purchaseOrderNo)}">${escapeHtml(pmsBusinessNumber(row.purchaseOrderNo))}</button><div class="mt-1">${renderPmsStatusBadge(row.status,statusTone(row.status))}</div><div class="mt-1 text-xs text-slate-500">${row.pcsSource?'来源物料档案':row.requirementNo?`<a href="/pms/material-requirements?keyword=${encodeURIComponent(row.requirementNo)}" class="text-blue-700">需求 ${escapeHtml(pmsBusinessNumber(row.requirementNo))}</a>`:'手工采购'}</div>${row.sourceProductPurchaseOrderNo?`<a class="text-xs text-blue-700" href="/pms/product-purchase-orders?keyword=${encodeURIComponent(row.sourceProductPurchaseOrderNo)}">源采购 ${escapeHtml(pmsBusinessNumber(row.sourceProductPurchaseOrderNo))}</a>`:''}`,
  },
  {
    key: 'material',
    title: '物料与款式',
    width: 280,
    required: true,
    freezeable: true,
    render: renderMpoSkuSummary,
  },
  {
    key: 'supplier',
    title: '供应商 / 仓库',
    width: 190,
    sortable: true,
    sortValue: (row) => row.supplierName,
    render: row => `<div class="space-y-1 text-xs"><button class="text-blue-700" data-pms-mpo-action="parity-field" data-field="supplierName" data-order-no="${escapeHtml(row.purchaseOrderNo)}">${escapeHtml(row.supplierName)}</button><div>${escapeHtml(row.warehouse)}</div><div>${escapeHtml(row.materialType)}采购 · ${escapeHtml(row.purchaseRegion||'未设置区域')}</div><div>${escapeHtml(row.usageType||'成衣做货')}</div><div>采购员 ${escapeHtml(row.buyerName||'未设置')}</div><div>下单 ${escapeHtml(filterValue(row,'placed'))} · ${escapeHtml(filterValue(row,'arrival'))}</div><div>交期 ${escapeHtml(row.expectedArrivalDate||'待定')}</div><button class="text-blue-700" data-pms-mpo-action="parity-edit" data-order-no="${escapeHtml(row.purchaseOrderNo)}">编辑采购信息</button></div>`,
  },
  {
    key: 'qty',
    title: '采购 / 已到货',
    width: 150,
    sortable: true,
    sortValue: (row) => row.orderedQty,
    render: row => `<div class="space-y-1 text-xs tabular-nums">计划 ${mpoQuantityText(row,'orderedQty')}<br>实采 ${mpoQuantityText(row,'actualPurchasedQty')}<br>商家到货 ${mpoQuantityText(row,'sellerReceivedQty')}<br>入库 ${mpoQuantityText(row,'inboundQty')}<br><span class="text-slate-500">计划金额 ${purchaseMoney(row)}</span></div>`,
  },
  {
    key: 'logistics',
    title: '物流',
    width: 230,
    render: (row) => {
      const records = orderLogistics(row.purchaseOrderNo)
      if (records.length === 0) return '<span class="text-xs text-amber-700">未导入快递信息</span>'
      return `<div class="space-y-1">${records.map((record) => `<div class="text-xs"><div class="font-medium">${escapeHtml(record.company)}</div><div class="text-slate-500">${escapeHtml(record.trackingNo)} · ${formatPmsQty(record.qty, record.unit)}</div><div class="${record.domesticSigned ? 'text-emerald-700' : 'text-amber-700'}">${record.domesticSigned ? '国内已签收' : '国内未签收'}${record.headBatchNo ? ` · ${record.headSigned ? '头程已签收' : `头程 ${escapeHtml(record.headBatchNo)}`}` : ''}</div></div>`).join('')}</div>`
    },
  },
  {
    key:'times',title:'创建 / 修改时间',width:160,sortable:true,
    sortValue:row=>state.listSort.startsWith('update')?row.updatedAt||'':row.orderDate,
    render:row=>'<div class="space-y-1 text-xs">'+escapeHtml(row.orderDate)+'<br><span class="text-slate-500">修改 '+escapeHtml(row.updatedAt||'未记录')+'</span></div>',
  },
  {
    key: 'actions',
    title: '操作',
    width: 190,
    actionColumn: true,
    render: renderMpoParityActions,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:/pms/material-purchase-orders',
  pageSizeOptions: [5, 10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-pms-mpo-table-surface]',
  paginationSurfaceSelector: '[data-pms-mpo-pagination-surface]',
  overlaysSurfaceSelector: '[data-pms-mpo-overlays]',
  defaultFrozenKeys: ['order', 'material'],
  columnSettingsTitle: '面辅料采购单列设置',
  emptyText: '当前条件下暂无面辅料采购单',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function rootElement(): HTMLElement | null {
  if (typeof window === 'undefined') return null
  return document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function syncBatchButtons(): void {
  const root = rootElement()
  if (!root) return
  root.querySelectorAll<HTMLButtonElement>(`[data-${EVENT_PREFIX}-action="batch-purchased"], [data-${EVENT_PREFIX}-action="batch-inbound"]`).forEach((button) => {
    button.disabled = state.selectedOrderNos.length === 0
  })
  const count = root.querySelector<HTMLElement>(`[data-${EVENT_PREFIX}-selected-count]`)
  if (count) count.textContent = `已选 ${state.selectedOrderNos.length} 张`
  const titleNode = root.querySelector<HTMLElement>('[data-standard-list-table-section] h2')
  if (titleNode) titleNode.textContent = `共 ${filteredRows().length} 条${state.selectedOrderNos.length ? ` · 已选 ${state.selectedOrderNos.length} 条` : ''}`
  syncProcessSelectionHeader(root)
}

function renderFilters(): string {
  const statuses: Array<'' | PmsMaterialPurchaseOrderStatus> = ['', '草稿', '待采购', '已采购', '部分到货', '已到货', '已入库', '已关闭']
  const statusOptions = statuses.map((value) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${value || '全部状态'}</option>`).join('')
  const logisticsOptions = ['', '未导入', '已导入'].map((value) => `<option value="${value}" ${state.logisticsFilter === value ? 'selected' : ''}>${value || '全部物流'}</option>`).join('')
  const advancedCount = (state.logisticsFilter?1:0)+Object.values(state.multiFilters).filter(values=>values.length).length+Object.values(state.dateFilters).filter(Boolean).length+Object.values(state.rangeFilters).filter(Boolean).length
  const choices=(key:string)=>[...new Set(listPmsMaterialPurchaseOrders().map(order=>filterValue(order,key)))].sort()
  const multis=Object.entries(filterLabels).map(([key,label])=>`<div class="min-w-0"><label class="block text-xs text-slate-500" for="mpo-filter-${key}">${label}</label><select id="mpo-filter-${key}" multiple size="3" class="mt-1 w-full rounded border px-2 text-xs" data-pms-mpo-field="multi:${key}">${choices(key).map(value=>`<option value="${escapeHtml(value)}" ${(state.multiFilters[key]||[]).includes(value)?'selected':''}>${escapeHtml(value)}</option>`).join('')}</select><div class="mt-1 flex gap-3 text-xs"><button data-pms-mpo-action="multi-all" data-filter-key="${key}">全选</button><button data-pms-mpo-action="multi-clear" data-filter-key="${key}">清除</button></div></div>`).join('')
  const dates=Object.entries(dateLabels).map(([key,label])=>`<div class="col-span-2 min-w-0"><span class="text-xs text-slate-500">${label}</span><div class="mt-1 flex items-center gap-1">${['From','To'].map((suffix,index)=>`${index?'—':''}<input aria-label="${label}${index?'结束':'开始'}" type="date" class="h-9 min-w-0 w-full rounded border px-2 text-xs" value="${escapeHtml(state.dateFilters[key+suffix]||'')}" data-pms-mpo-field="date:${key+suffix}">`).join('')}</div></div>`).join('')
  const ranges=[['shipDays','出货时效（天）'],['transferDays','转运时效（天）']].map(([key,label])=>`<div class="col-span-2"><span class="text-xs text-slate-500">${label}</span><div class="mt-1 flex gap-1">${['Min','Max'].map((suffix,index)=>`<input aria-label="${label}${index?'最大':'最小'}" type="number" min="0" class="h-9 min-w-0 w-full rounded border px-2" value="${escapeHtml(state.rangeFilters[key+suffix]||'')}" data-pms-mpo-field="range:${key+suffix}">`).join('')}</div></div>`).join('')
  return `<div class="rounded-lg border bg-white p-3" data-standard-list-filter-bar><div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">检索字段</span><select class="h-9 w-full rounded border px-2 text-sm" data-pms-mpo-field="keywordField">${[['all','全部'],['purchaseOrderNo','采购单号'],['materialCode','SKU'],['materialSpu','物料 SPU'],['styleCode','成衣 SPU'],['sourceProductPurchaseOrderNo','源采购单'],['boxNo','箱号'],['headBatchNo','转运批次'],['materialName','物料名称'],['supplierName','供应商'],['remark','采购备注'],['applicant','申请人'],['picker','选品人'],['identifier','商品识别码'],['tracking','物流单号']].map(([key,label])=>`<option value="${key}" ${state.keywordField===key?'selected':''}>${label}</option>`).join('')}</select></label><label class="min-w-0 sm:col-span-2"><span class="mb-1 block text-xs text-muted-foreground">关键词</span><input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="采购单号 / 物料 / 供应商 / 物流单号" value="${escapeHtml(state.keyword)}" data-${EVENT_PREFIX}-field="keyword" data-skip-page-rerender="true" /></label>
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">采购单状态</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="status" data-skip-page-rerender="true">${statusOptions}</select></label>
    <label><span class="mb-1 block text-xs text-slate-500">排序</span><select class="h-9 w-full rounded border px-2 text-sm" data-pms-mpo-field="listSort">${[['','默认排序'],['create-desc','创建时间倒序'],['create-asc','创建时间正序'],['update-desc','修改时间倒序'],['update-asc','修改时间正序']].map(([key,label])=>`<option value="${key}" ${state.listSort===key?'selected':''}>${label}</option>`).join('')}</select></label>    </div><div data-process-advanced ${advancedCount ? '' : 'hidden'}><div class="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-6">
    <label class="min-w-0"><span class="mb-1 block text-xs text-muted-foreground">物流</span><select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-${EVENT_PREFIX}-field="logisticsFilter" data-skip-page-rerender="true">${logisticsOptions}</select></label>${multis}${dates}${ranges}
    </div></div><div class="mt-3 flex w-full flex-wrap items-center gap-2" data-process-filter-actions>
    ${renderPrimaryButton('查询', { prefix: EVENT_PREFIX, action: 'query' }, 'search')}
    ${renderSecondaryButton('重置', { prefix: EVENT_PREFIX, action: 'reset' }, 'rotate-ccw')}
    <select class="h-9 rounded border px-2 text-sm" aria-label="导出内容" data-mpo-export-kind>${['订单明细','订单','结算单','原料入库'].map(value=>`<option>${value}</option>`).join('')}</select>${renderSecondaryButton('导出', { prefix: EVENT_PREFIX, action: 'export' }, 'download')}
    ${renderSecondaryButton('导入快递信息', { prefix: EVENT_PREFIX, action: 'open-import' }, 'upload')}
    ${renderProcessFilterToggle(advancedCount, 'button')}
    </div></div>`
}

function renderStats(): string {
  const rows = filteredRows()
  const quantity=(key:'orderedQty'|'sellerReceivedQty'|'inboundQty')=>{const totals=new Map<string,number>();for(const row of rows)for(const line of getPmsMaterialPurchaseOrderLines(row))totals.set(line.unit,(totals.get(line.unit)||0)+line[key]);return [...totals].map(([unit,value])=>formatPmsQty(value,unit)).join(' / ')||'0'}
  return renderProcessOrderStats([
    { label: '采购单总数', value: rows.length },
    { label: '计划采购数量', value:quantity('orderedQty') },
    { label: '商家到货数量', value:quantity('sellerReceivedQty') },
    { label: '入库数量', value:quantity('inboundQty') },
    { label: '计划采购金额', value: [...new Set(rows.map(row => row.currency))].map(currency => `${rows.filter(row => row.currency === currency).reduce((sum, row) => sum + pmsMaterialPurchaseOrderAmount(row), 0).toFixed(2)} ${currency}`).join(' / ') },
  ])
}

function renderDetailOverlay(orderNo: string): string {
  const order = getPmsMaterialPurchaseOrder(orderNo)
  if (!order) return ''
  const records = orderLogistics(orderNo)
  const nextStatuses = pmsAllowedMaterialOrderNextStatuses(order.status)
  const advanceButtons = nextStatuses
    .filter((status) => status !== '已关闭' && (!order.tmfTipSource || status === '已采购'))
    .map((status) => renderSecondaryButton(`推进为${status}`, { prefix: EVENT_PREFIX, action: 'advance-status' }, 'arrow-right').replace('<button', `<button data-order-no="${escapeHtml(orderNo)}" data-next-status="${status}"`))
    .join('')
  const recordsHtml = records.length
    ? records.map((record) => `<tr class="border-b last:border-b-0"><td class="px-3 py-2 text-sm">${escapeHtml(record.company)}</td><td class="px-3 py-2 text-sm">${escapeHtml(record.trackingNo)}${!record.domesticSigned&&!record.headBatchNo?`<button class="ml-2 text-xs text-blue-700" data-pms-mpo-action="parity-logistics" data-record-no="${escapeHtml(record.recordNo)}">修改</button>`:''}</td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(record.qty, record.unit)}</td><td class="px-3 py-2 text-sm">${escapeHtml(record.shipDate || '—')}</td><td class="px-3 py-2">${record.domesticSigned ? renderPmsStatusBadge('国内已签收', 'green') : renderPmsStatusBadge('国内未签收', 'yellow')}</td><td class="px-3 py-2">${record.headBatchNo ? (record.headSigned ? renderPmsStatusBadge(`头程已签收 ${record.headBatchNo}`, 'green') : renderPmsStatusBadge(`头程 ${record.headBatchNo}`, 'blue')) : renderPmsStatusBadge('未加入头程', 'slate')}</td></tr>`).join('')
    : '<tr><td class="px-3 py-6 text-center text-sm text-muted-foreground" colspan="6">还没有导入快递信息</td></tr>'
  const logs = listPmsMaterialPurchaseLogs(orderNo)
  const logItems = logs.length
    ? logs.map((log) => `<li class="rounded-md border p-3 text-xs"><div class="flex items-center justify-between"><strong>${escapeHtml(log.action)}</strong><span class="text-slate-500">${formatPmsTime(log.occurredAt)}</span></div><div class="mt-1 text-slate-600">${escapeHtml(log.actorName)}：${escapeHtml(log.beforeValue)} → ${escapeHtml(log.afterValue)}${log.reason ? `（${escapeHtml(log.reason)}）` : ''}</div></li>`).join('')
    : '<li class="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">暂无操作日志</li>'
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="面辅料采购单详情" data-pms-mpo-detail-root><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭详情"></button><section class="relative z-10 flex h-full w-[820px] max-w-[96vw] flex-col overflow-y-auto bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">${escapeHtml(pmsBusinessNumber(order.purchaseOrderNo))} · ${escapeHtml(order.materialName)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(order.supplierName)} · ${escapeHtml(order.warehouse)} · ${escapeHtml(order.status)}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-5 p-4">
    <div class="flex items-center gap-4">${renderPmsBusinessImage(order.materialImageUrl, `${order.materialName}（${order.materialCode}）实物图`, 'h-20 w-20')}<div class="w-40 shrink-0"><div class="font-medium">${escapeHtml(order.materialName)}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(order.materialCode)} · ${escapeHtml(order.unit)}</div></div><dl class="grid flex-1 grid-cols-3 gap-3 text-sm"><div><dt class="text-xs text-muted-foreground">采购数量</dt><dd class="mt-1 font-semibold tabular-nums">${mpoQuantityText(order,'orderedQty')}</dd></div><div><dt class="text-xs text-muted-foreground">已到货</dt><dd class="mt-1 tabular-nums">${mpoQuantityText(order,'sellerReceivedQty')}</dd></div><div><dt class="text-xs text-muted-foreground">采购金额</dt><dd class="mt-1 tabular-nums">${formatPmsMoney(pmsMaterialPurchaseOrderAmount(order), order.currency)}</dd></div>${!order.styleCode ? '<div><dt class="text-xs text-muted-foreground">备货用途</dt><dd class="mt-1">基础备货</dd></div>' : `<div><dt class="text-xs text-muted-foreground">款式</dt><dd class="mt-1 flex items-center gap-2">${renderPmsBusinessImage(order.styleImageUrl, `${order.styleName}款式图`, 'h-6 w-6')}<span>${escapeHtml(order.styleName)} · ${escapeHtml(order.styleCode)}</span></dd></div>`}<div><dt class="text-xs text-muted-foreground">交期</dt><dd class="mt-1">${escapeHtml(order.expectedArrivalDate || '待定')}</dd></div><div><dt class="text-xs text-muted-foreground">供应商确认</dt><dd class="mt-1">${order.supplierConfirmed ? renderPmsStatusBadge('已确认', 'green') : renderPmsStatusBadge('待确认', 'yellow')}</dd></div></dl></div>
    ${order.tmfTipSource ? `<section data-pms-tip-purchase-origin class="rounded-lg border p-4 text-sm"><h3 class="font-semibold">端头辅材采购来源</h3><p>生产单 ${escapeHtml(order.tmfTipSource.productionOrderNo)}；采用版本 ${escapeHtml(order.tmfTipSource.versionId)}</p><p>快照 ${escapeHtml(order.tmfTipSource.snapshotId)}；辅材 BOM ${escapeHtml(order.tmfTipSource.materialBomItemId)}</p><p class="mt-2">到货、入库数量来自仓库实际实收，不能手改累计。<a href="/wls/accessory-receipts" class="text-blue-700 underline">前往辅料仓收货</a>，选择“织带投入料采购”。</p></section>` : ''}
    ${renderMpoSkuTable(order)}<section class="rounded-lg border p-4"><h3 class="text-sm font-semibold">可执行动作</h3><div class="my-3 flex flex-wrap gap-2">${order.rejectedReason?`<p class="text-sm text-red-700">采购已驳回：${escapeHtml(order.rejectedReason)}</p>`:''}${renderSecondaryButton('修改采购信息',{prefix:EVENT_PREFIX,action:'parity-edit'}).replace('<button',`<button data-order-no="${escapeHtml(orderNo)}"`)}${renderSecondaryButton('复制采购单',{prefix:EVENT_PREFIX,action:'parity-copy'}).replace('<button',`<button data-order-no="${escapeHtml(orderNo)}"`)}${renderSecondaryButton('转原料采购',{prefix:EVENT_PREFIX,action:'parity-convert-raw'}).replace('<button',`<button data-order-no="${escapeHtml(orderNo)}" ${['原料','样衣'].includes(order.materialType)||['已入库','已关闭'].includes(order.status)?'disabled':''}`)}${renderSecondaryButton('条码明细',{prefix:EVENT_PREFIX,action:'open-barcodes'},'barcode').replace('<button',`<button data-order-no="${escapeHtml(orderNo)}"`)}${renderSecondaryButton('打印采购单',{prefix:EVENT_PREFIX,action:'print-order'}).replace('<button',`<button data-order-no="${escapeHtml(orderNo)}"`)}</div><div class="mt-3 flex flex-wrap gap-2">${getTmfMaterialPurchase(orderNo) && !['已关闭','已入库'].includes(order.status) ? renderSecondaryButton('变更基础采购数量',{prefix:EVENT_PREFIX,action:'open-tmf-revision'}).replace('<button',`<button data-order-no="${escapeHtml(orderNo)}"`) : ''}${advanceButtons}${renderSecondaryButton('登记质检 / 瑕疵处理',{prefix:EVENT_PREFIX,action:'parity-inspection'},'clipboard-check').replace('<button',`<button data-order-no="${escapeHtml(orderNo)}" ${!['部分到货','已到货'].includes(order.status)||order.inventoryPosting?'disabled':''}`)}${renderSecondaryButton('登记到货', { prefix: EVENT_PREFIX, action: 'parity-quantity' }, 'package-check').replace('<button', `<button data-order-no="${escapeHtml(orderNo)}" ${order.tmfTipSource || order.status === '已关闭' || order.status === '已入库' ? 'disabled' : ''}`)}${nextStatuses.includes('已关闭') ? renderDangerButton('关闭采购单', { prefix: EVENT_PREFIX, action: 'open-close' }, 'x-circle').replace('<button', `<button data-order-no="${escapeHtml(orderNo)}"`) : ''}</div><p class="mt-2 text-xs text-slate-500">状态顺序：待采购 → 已采购 → 部分到货/已到货 → 已入库；已关闭不可恢复。</p></section>
    <section class="rounded-lg border p-4"><h3 class="font-semibold">采购图片与物流凭证</h3><div class="my-3 flex flex-wrap gap-2">${[['附加图片','添加图片'],['物流凭证','上传物流凭证']].map(([category,label])=>renderSecondaryButton(label,{prefix:EVENT_PREFIX,action:'open-attachment'},'paperclip').replace('<button',`<button data-order-no="${escapeHtml(orderNo)}" data-file-category="${category}" ${order.pcsSource||order.tmfTipSource||getTmfMaterialPurchase(orderNo)?'disabled':''}`)).join('')}</div>${(order.attachments || []).map(file=>`<div class="flex items-center gap-3 border-t py-2"><span class="text-xs text-slate-500">${file.category}</span><button class="flex-1 text-left text-sm text-blue-700" data-pms-mpo-action="preview-attachment" data-file-id="${escapeHtml(file.fileId)}">${escapeHtml(file.name)}</button><button class="text-xs text-red-700" data-pms-mpo-action="delete-attachment" data-order-no="${escapeHtml(orderNo)}" data-file-id="${escapeHtml(file.fileId)}">删除附件</button></div>`).join('')}</section>
    ${order.inspection?`<section class="rounded border p-3 text-sm"><h3 class="font-semibold">采购质检</h3><p>抽检 ${formatPmsQty(order.inspection.sampleQty,order.unit)}；合格 ${formatPmsQty(order.inspection.qualifiedQty,order.unit)}；瑕疵 ${formatPmsQty(order.inspection.defectQty,order.unit)}</p><p>${escapeHtml(order.inspection.inspector)} · ${formatPmsTime(order.inspection.inspectedAt)} · ${escapeHtml(order.inspection.reason)}${order.inspection.shortageRate!==undefined?` · 空差率 ${order.inspection.shortageRate.toFixed(2)}%`:''}${order.inspection.defectQty?` · 瑕疵仓：${escapeHtml(order.inspection.warehouse)}`:''}</p></section>`:''}
    <section><div class="mb-2 flex justify-between"><h3 class="text-sm font-semibold">物流记录（${records.length}）</h3>${renderSecondaryButton('添加快递信息',{prefix:EVENT_PREFIX,action:'parity-logistics'},'truck').replace('<button',`<button data-order-no="${escapeHtml(orderNo)}" ${['已关闭','已入库'].includes(order.status)?'disabled':''}`)}</div><div class="overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left" style="min-width: 760px"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">物流公司</th><th class="px-3 py-2">物流单号</th><th class="px-3 py-2">数量</th><th class="px-3 py-2">发货日期</th><th class="px-3 py-2">国内签收</th><th class="px-3 py-2">头程</th></tr></thead><tbody>${recordsHtml}</tbody></table></div></section>
    ${renderMpoCostSummary(order)}${renderMpoExecutionFacts(order)}
    ${getTmfMaterialPurchase(orderNo) ? renderTmfPurchaseRevisionHistory(orderNo) : ''}
    <section><h3 class="mb-2 text-sm font-semibold">操作日志</h3><ul class="space-y-2">${logItems}</ul></section>
  </div></section></div>`
}

function renderArrivalOverlay(orderNo: string): string {
  const order = getPmsMaterialPurchaseOrder(orderNo)
  if (!order) return ''
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="登记到货" data-pms-mpo-arrival-root><section class="w-full max-w-lg rounded-xl bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">登记到货 · ${escapeHtml(pmsBusinessNumber(orderNo))}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(order.materialName)} · 采购 ${mpoQuantityText(order,'orderedQty')}</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="space-y-3 p-4">${renderPmsOverlayError(state.overlayError)}<label class="flex flex-col gap-1 text-xs text-muted-foreground">本次累计到货数量（${escapeHtml(order.unit)}）
    <input class="h-9 rounded-md border bg-background px-2 text-sm" type="number" min="0" step="0.01" value="${order.receivedQty > 0 ? order.receivedQty : order.orderedQty}" data-${EVENT_PREFIX}-arrival-qty data-skip-page-rerender="true" />
  </label><p class="text-xs text-slate-500">到货数量小于采购数量记为“部分到货”，等于采购数量记为“已到货”。</p></div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('保存到货', { prefix: EVENT_PREFIX, action: 'submit-arrival' }, 'check-check')}</footer></section></div>`
}

function renderImportOverlay(rows: ImportPreviewRow[]): string {
  const errorCount = rows.filter((item) => item.error).length
  const previewRows = rows.length
    ? rows.map((item) => `<tr class="border-b last:border-b-0 ${item.error ? 'bg-red-50' : ''}"><td class="px-3 py-2 text-sm">${escapeHtml(item.row.purchaseOrderNo)}</td><td class="px-3 py-2 text-sm">${escapeHtml(item.row.company)}</td><td class="px-3 py-2 text-sm">${escapeHtml(item.row.trackingNo)}</td><td class="px-3 py-2 text-sm">${escapeHtml(item.row.shipDate || '—')}</td><td class="px-3 py-2 text-sm tabular-nums">${item.row.boxCount}</td><td class="px-3 py-2 text-sm tabular-nums">${formatPmsQty(item.row.qty)}</td><td class="px-3 py-2 text-sm tabular-nums">¥${item.row.fee.toFixed(2)}</td><td class="px-3 py-2 text-xs ${item.error ? 'text-red-700' : 'text-emerald-700'}">${escapeHtml(item.error || '校验通过')}</td></tr>`).join('')
    : '<tr><td class="px-3 py-8 text-center text-sm text-muted-foreground" colspan="8">请选择模板文件，或先下载模板填写后上传</td></tr>'
  return `<div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="导入快递信息" data-pms-mpo-import-root><button type="button" class="absolute inset-0 bg-slate-900/40" data-${EVENT_PREFIX}-action="close-overlay" data-skip-page-rerender="true" aria-label="关闭导入"></button><section class="relative z-10 flex h-full w-[980px] max-w-[96vw] flex-col bg-background shadow-2xl"><header class="flex items-center justify-between border-b px-4 py-3"><div><h2 class="font-semibold">导入快递信息</h2><p class="mt-1 text-xs text-slate-500">支持 .xls / .xlsx / CSV；多 SKU 采购单须填写 SKU；同一采购明细和运单不可重复导入</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header><div class="flex-1 space-y-4 overflow-y-auto p-4">${renderPmsOverlayError(state.overlayError)}
    <div class="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 p-3">
      ${renderSecondaryButton('下载导入模板', { prefix: EVENT_PREFIX, action: 'download-template' }, 'download')}
      <label class="flex items-center gap-2 text-sm">选择文件
        <input type="file" accept=".xlsx,.xls,.csv,.txt" class="text-xs" data-${EVENT_PREFIX}-field="import-file" data-skip-page-rerender="true" />
      </label>
      <span class="text-xs text-slate-500">共解析 ${rows.length} 行${errorCount > 0 ? `，其中 ${errorCount} 行存在错误` : ''}</span>
    </div>
    <div class="overflow-x-auto rounded-lg border"><table class="w-full table-fixed text-left" style="min-width: 900px"><thead class="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">采购单号</th><th class="px-3 py-2">物流公司</th><th class="px-3 py-2">物流单号</th><th class="px-3 py-2">发货日期</th><th class="px-3 py-2">箱数</th><th class="px-3 py-2">数量</th><th class="px-3 py-2">运费</th><th class="px-3 py-2">校验</th></tr></thead><tbody>${previewRows}</tbody></table></div>
  </div><footer class="flex items-center justify-end gap-2 border-t px-4 py-3">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('确认导入', { prefix: EVENT_PREFIX, action: 'submit-import' }, 'check-check').replace('<button', `<button ${rows.length > 0 && errorCount === 0 ? '' : 'disabled'}`)}</footer></section></div>`
}

function renderCloseOverlay(orderNo: string): string {
  const order = getPmsMaterialPurchaseOrder(orderNo)
  if (!order) return ''
  return `<div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="关闭面辅料采购单" data-pms-mpo-close-root><section class="w-full max-w-lg rounded-xl bg-background p-5 shadow-2xl"><header class="mb-4 flex items-center justify-between"><div><h2 class="font-semibold">关闭 ${escapeHtml(pmsBusinessNumber(orderNo))}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(order.materialName)} · ${escapeHtml(order.status)} · 关闭后不可恢复</p></div>${renderSecondaryButton('关闭', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}</header>${renderPmsOverlayError(state.overlayError)}
    <label class="flex flex-col gap-1 text-xs text-muted-foreground">关闭原因（必填）<textarea class="min-h-24 rounded-md border bg-background p-2 text-sm" placeholder="如供应商无法交付、终端取消" data-${EVENT_PREFIX}-close-reason data-skip-page-rerender="true"></textarea></label>
    <footer class="mt-4 flex items-center justify-end gap-2">${renderSecondaryButton('取消', { prefix: EVENT_PREFIX, action: 'close-overlay' }, 'x')}${renderPrimaryButton('确认关闭', { prefix: EVENT_PREFIX, action: 'submit-close' }, 'check-check')}</footer></section></div>`
}

function renderMpoAttachmentPreview():string{return state.attachmentPreviewUrl?`<div class="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-5" role="dialog" aria-modal="true" aria-label="采购附件预览"><button class="absolute right-5 top-5 rounded bg-white p-3" data-pms-mpo-action="close-file-preview">关闭预览</button>${state.attachmentPreviewType.startsWith('image/')?`<img class="max-h-[90vh] max-w-[90vw] object-contain" src="${state.attachmentPreviewUrl}" alt="已保存采购附件">`:`<iframe class="h-[85vh] w-[90vw] bg-white" src="${state.attachmentPreviewUrl}" title="已保存采购附件"></iframe>`}</div>`:''}
function renderInspectionOverlay(orderNo:string):string{
 const order=getPmsMaterialPurchaseOrder(orderNo);if(!order)return '';const old=order.inspection
 const field=(name:string,label:string,value:string|number,type='text')=>`<label class="block text-sm">${label}<input name="${name}" type="${type}" value="${escapeHtml(value)}" class="mt-1 h-9 w-full rounded border px-3" ${type==='number'?'min="0" step="any"':''}></label>`
 return `<div class="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true" aria-label="登记采购质检"><section class="flex h-full w-[640px] max-w-[96vw] flex-col bg-white"><header class="flex justify-between border-b p-4"><h2 class="font-semibold">登记质检 / 瑕疵处理</h2>${renderSecondaryButton('关闭',{prefix:EVENT_PREFIX,action:'close-overlay'})}</header><div class="flex-1 overflow-auto p-4" data-mpo-qc-form>${renderPmsOverlayError(state.overlayError)}<div class="mb-4 flex items-center gap-3">${renderPmsBusinessImage(order.materialImageUrl,order.materialName)}<span>${escapeHtml(order.materialName)} · ${escapeHtml(pmsBusinessNumber(orderNo))}<br>实到 ${formatPmsQty(order.receivedQty,order.unit)}</span></div><div class="grid grid-cols-2 gap-3">${field('sampleQty',`抽检数量（${order.unit}）`,old?.sampleQty||'','number')}${field('qualifiedQty',`合格数量（${order.unit}）`,old?.qualifiedQty||'','number')}${field('defectQty',`瑕疵数量（${order.unit}）`,old?.defectQty||0,'number')}${field('inspector','质检员',old?.inspector||PMS_BUYER_ACTOR.name)}${field('warehouse','瑕疵仓',old?.warehouse||'')}${field('reason','瑕疵原因',old?.reason||'')}${field('labelLength',`标签长度（${order.unit}）`,old?.labelLength||0,'number')}${field('actualLength',`实际长度（${order.unit}）`,old?.actualLength||0,'number')}</div><p class="mt-4 text-xs text-slate-500">合格与瑕疵数量之和须等于抽检数量。只登记本次已观察到的瑕疵数量，不按抽检比例推算整批。保存仅形成本地原型记录。</p></div><footer class="flex justify-end gap-2 border-t p-4">${renderSecondaryButton('取消',{prefix:EVENT_PREFIX,action:'close-overlay'})}${renderPrimaryButton('保存质检结果',{prefix:EVENT_PREFIX,action:'submit-inspection'})}</footer></section></div>`
}
function renderLogisticsEditOverlay(recordNo:string,orderNo=''):string{
 const order=getPmsMaterialPurchaseOrder(orderNo),existing=listPmsMaterialLogisticsRecords().find(item=>item.recordNo===recordNo),row=existing||(order?{...order,company:'',trackingNo:'',shipDate:'',estimatedArrival:'',boxCount:0,rolls:0,qty:0,fee:0,transportMethod:'快递',contact:'',sellerBoxNo:'',boxNo:'',lengthCm:0,widthCm:0,heightCm:0,weightKg:0,transferCenter:'',estimatedTransferDays:0}:undefined);if(!row)return ''
 const fields=[['company','物流公司','text'],['trackingNo','物流单号','text'],['shipDate','发货日期','date'],['estimatedArrival','预计到达日期','date'],['boxCount','箱数','number'],['rolls','卷数','number'],['qty',`数量（${row.unit}）`,'number'],['fee','运费','number'],['remark','备注','text'],['contact','联系人','text'],['sellerBoxNo','商家箱号','text'],['boxNo','自编箱号','text'],['lengthCm','长度（cm）','number'],['widthCm','宽度（cm）','number'],['heightCm','高度（cm）','number'],['weightKg','重量（kg）','number'],['transferCenter','转运中心','text'],['estimatedTransferDays','预计转运天数','number']] as const
 return `<div class="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true" aria-label="采购物流信息"><section class="flex h-full w-[640px] max-w-[96vw] flex-col bg-white"><header class="flex justify-between border-b p-4"><h2 class="font-semibold">${existing?'修改':'添加'}采购物流信息</h2>${renderSecondaryButton('关闭',{prefix:EVENT_PREFIX,action:'close-overlay'})}</header><div class="flex-1 overflow-auto p-4" data-mpo-logistics-form>${renderPmsOverlayError(state.overlayError)}<div class="mb-4 flex gap-3">${renderPmsBusinessImage(row.materialImageUrl,row.materialName)}<span>${escapeHtml(row.materialName)} · ${escapeHtml(row.trackingNo)}</span></div><label class="mb-3 block text-sm">货运方式<select name="transportMethod" class="mt-1 h-9 w-full rounded border px-2">${['快递','自提','货拉拉','海运','空运'].map(value=>`<option ${row.transportMethod===value?'selected':''}>${value}</option>`).join('')}</select></label><div class="grid grid-cols-2 gap-3">${fields.map(([name,label,type])=>`<label class="block text-sm">${label}<input name="${name}" type="${type}" class="mt-1 h-9 w-full rounded border px-3" value="${escapeHtml(row[name]??'')}"></label>`).join('')}</div></div><footer class="flex justify-end gap-2 border-t p-4">${renderSecondaryButton('取消',{prefix:EVENT_PREFIX,action:'close-overlay'})}${renderPrimaryButton('保存物流信息',{prefix:EVENT_PREFIX,action:'submit-logistics-edit'})}</footer></section></div>`
}
function renderOverlays(): string {
  if(hasMpoParityOverlay())return renderMpoParityOverlay()+`<div data-mpo-parity-image-preview>${renderPmsImagePreview()}</div>`
  if(state.overlay?.kind==='attachment')return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label="采购附件表单"><section class="w-full max-w-lg space-y-4 rounded-lg bg-white p-5"><h2 class="font-semibold">上传${state.overlay.category}</h2><p class="text-sm">采购单 ${escapeHtml(pmsBusinessNumber(state.overlay.orderNo))}，支持图片或PDF，最大20MB。</p><label class="block text-sm">选择文件<input class="mt-2 block w-full text-sm" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" data-mpo-attachment-file></label><footer class="flex justify-end gap-2">${renderSecondaryButton('取消',{prefix:EVENT_PREFIX,action:'close-overlay'})}${renderPrimaryButton('保存附件',{prefix:EVENT_PREFIX,action:'save-attachment'})}</footer></section></div>`+renderMpoAttachmentPreview()

  if(state.overlay?.kind==='batch-fields'){const field=state.overlay.field;const labels:Record<string,string>={buyerName:'采购员',supplierName:'面辅料供应商',purchaseRegion:'采购区域',remark:'采购备注',unitPrice:'实际采购单价',printingFactory:'印花工厂',cuttingFactory:'裁片工厂',printingProcess:'印染工艺',dyeFee:'染色费用',rejectedReason:'驳回原因'};return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label="批量采购操作"><section class="w-full max-w-lg space-y-3 rounded-lg bg-white p-5"><h2 class="font-semibold">设置${labels[field]}</h2><p class="text-sm">共 ${state.selectedOrderNos.length} 张采购单：${state.selectedOrderNos.map(pmsBusinessNumber).map(escapeHtml).join('、')}</p><label class="block text-sm">${labels[field]}<input class="mt-1 h-9 w-full rounded border px-2" data-mpo-batch-value type="${['unitPrice','dyeFee'].includes(field)?'number':'text'}"></label><footer class="flex justify-end gap-2">${renderSecondaryButton('取消',{prefix:EVENT_PREFIX,action:'close-overlay'})}${renderPrimaryButton(field==='rejectedReason'?'驳回采购':'保存设置',{prefix:EVENT_PREFIX,action:'save-batch-fields'})}</footer></section></div>${renderPmsImagePreview()+renderMpoAttachmentPreview()}`}


  const columnSettings = `<div data-pms-mpo-column-overlays>${controller.renderColumnSettings()}</div>`
  if (!state.overlay) return `${columnSettings}${renderPmsImagePreview()+renderMpoAttachmentPreview()}`
  if (state.overlay.kind === 'tmf-revision') return `${columnSettings}${renderTmfPurchaseRevision(state.overlay.orderNo)}${renderPmsImagePreview()+renderMpoAttachmentPreview()}`
  if (state.overlay.kind === 'tip-purchase') return `${columnSettings}${renderTmfTipPurchaseForm()}`
  if (state.overlay.kind === 'detail') return `${columnSettings}${renderDetailOverlay(state.overlay.orderNo)}${renderPmsImagePreview()+renderMpoAttachmentPreview()}`
  if (state.overlay.kind === 'arrival') return `${columnSettings}${renderArrivalOverlay(state.overlay.orderNo)}${renderPmsImagePreview()+renderMpoAttachmentPreview()}`
  if (state.overlay.kind === 'close') return `${columnSettings}${renderCloseOverlay(state.overlay.orderNo)}${renderPmsImagePreview()+renderMpoAttachmentPreview()}`
  if(state.overlay.kind==='barcodes')return `${columnSettings}${renderMpoBarcodeOverlay(state.overlay.orderNo,state.overlay.initialMode)}`
  if(state.overlay.kind==='inspection')return `${columnSettings}${renderInspectionOverlay(state.overlay.orderNo)}`
  if(state.overlay.kind==='logistics-edit')return `${columnSettings}${renderLogisticsEditOverlay(state.overlay.recordNo)}`
  if(state.overlay.kind==='logistics-new')return `${columnSettings}${renderLogisticsEditOverlay('',state.overlay.orderNo)}`
  return `${columnSettings}${renderImportOverlay(state.overlay.rows)}${renderPmsImagePreview()+renderMpoAttachmentPreview()}`
}

const barcodeCallbacks={refresh:()=>{refreshAll();refreshOverlays()},close:()=>{state.overlay=null;state.overlayError='';refreshOverlays()},feedback:(message:string,ok:boolean)=>{state.feedback=message;state.feedbackOk=ok}}

function renderInner(): string {
  if (state.readStatus === 'loading' || state.readStatus === 'initial') return '<div class="rounded-lg border bg-white p-6 text-sm text-slate-600" role="status">正在读取采购资料…</div>'
  if (state.readStatus === 'error') return `<div class="rounded-lg border border-amber-200 bg-amber-50 p-5"><h1 class="font-semibold">采购资料暂时无法读取</h1><p class="my-3 text-sm">${escapeHtml(state.readError)}</p>${renderSecondaryButton('重新读取',{prefix:EVENT_PREFIX,action:'pcs-retry'})}</div>`
  if (state.purchaseView !== 'list') return renderPcsPurchaseWorkspace()
  controller.ensurePreferencesLoaded()
  const view = controller.getView()
  return renderStandardListPage({className:'pms-compact-list',
      showHeader: true,
    title: '面辅料采购单',
    primaryActionsHtml: `<div class="flex flex-wrap gap-2">${['面料','物料','辅料'].map(kind=>renderPrimaryButton(`${kind}采购`,{prefix:EVENT_PREFIX,action:'parity-new'},'plus').replace('<button',`<button data-purchase-kind="${kind}"`)).join('')}<details><summary class="cursor-pointer rounded border px-3 py-2 text-sm">更多采购</summary><div class="absolute z-20 flex gap-2 rounded border bg-white p-2 shadow">${['原料','样衣'].map(kind=>renderSecondaryButton(`${kind}采购`,{prefix:EVENT_PREFIX,action:'parity-new'}).replace('<button',`<button data-purchase-kind="${kind}"`)).join('')}${renderSecondaryButton('创建端头辅材采购', { prefix: EVENT_PREFIX, action: 'open-tip-purchase' }, 'plus')}</div></details></div>`,
    feedbackHtml: `<div data-pms-mpo-feedback>${renderPmsFeedback(state.feedback,state.feedbackOk)}</div>`,
    filtersHtml: `<div data-pms-mpo-filters>${renderFilters()}</div>`,
    statsHtml: `<div data-pms-mpo-stats>${renderStats()}</div>`,
    listTitle: `共 ${filteredRows().length} 条${state.selectedOrderNos.length ? ` · 已选 ${state.selectedOrderNos.length} 条` : ''}`,
    listActionsHtml: `${renderMpoParityToolbar()}${renderSecondaryButton('列设置', { prefix: EVENT_PREFIX, action: 'open-column-settings' }, 'settings-2')}`,
    tableHtml: `<div data-pms-mpo-table-surface>${view.tableHtml}</div>`,
    paginationHtml: `<div data-pms-mpo-pagination-surface>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-pms-mpo-overlays>${renderOverlays()}</div>`,
  })
}

function refreshAll(resetFilters=false):void {
  const root=rootElement();if(!root) return
  if(state.purchaseView!=='list' || !root.querySelector('[data-pms-mpo-table-surface]')) {const body=root.querySelector<HTMLElement>('[data-pms-mpo-body]');if(body){body.innerHTML=renderInner();hydratePmsSurface(body)}return}
  controller.refresh({overlays:false})
  const update=(part:string,html:string)=>{const region=root.querySelector<HTMLElement>(`[data-pms-mpo-${part}]`);if(region){region.innerHTML=html;hydratePmsSurface(region)}}
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
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-mpo-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydratePmsSurface(surface)
}

function closeOverlay(): void {
  state.overlay = null
  state.overlayError = ''
  refreshOverlays()
}

function exportRows(kind:string):void{const count=exportMpoParityRows(filteredRows(),kind);state.feedback=count?`已导出全部筛选结果，共 ${count} 条`:'当前筛选范围没有可导出的记录';state.feedbackOk=count>0;refreshAll()}

function downloadTemplate(): void {
  const html = buildPmsHtmlTemplateFile(
    '快递信息导入模板',
    ['采购单号', 'SKU', '物流公司', '物流单号', '发货日期', '预计到达日期', '箱数', '卷数', '数量', '运费', '备注'],
    [
      ['CGF-2026-0001', '请填写该采购单的SKU', '顺丰速运', 'SF1368000123456', '2026-06-10', '2026-06-13', 6, 6, 552, 380, ''],
      ['CGF-2026-0004', '请填写该采购单的SKU', '德邦物流', 'DB6600123987', '2026-06-11', '2026-06-14', 8, 8, 800, 460, ''],
    ],
  )
  downloadPmsFile('快递信息导入模板.xls', html, 'application/vnd.ms-excel')
}

function mapImportRows(rawRows:string[][]):ImportPreviewRow[]{
 const hasHeader=/采购单号/.test(rawRows[0]?.[0]||''),withSku=hasHeader&&rawRows[0][1]==='SKU',offset=withSku?1:0
 const existing=new Set(listPmsMaterialLogisticsRecords().map(pmsMaterialLogisticsIdentity)),seen=new Set<string>()
 return rawRows.slice(hasHeader?1:0).filter(cells=>cells.some(cell=>cell.trim())).map(cells=>{
  const row:PmsLogisticsImportRow={purchaseOrderNo:(cells[0]||'').trim(),materialCode:withSku?(cells[1]||'').trim():undefined,company:(cells[1+offset]||'').trim(),trackingNo:(cells[2+offset]||'').trim(),shipDate:(cells[3+offset]||'').trim(),estimatedArrival:(cells[4+offset]||'').trim(),boxCount:Number(cells[5+offset]||0),rolls:Number(cells[6+offset]||0),qty:Number(cells[7+offset]||0),fee:Number(cells[8+offset]||0),remark:(cells[9+offset]||'').trim()}
  const error=validatePmsLogisticsImportRow(row,existing,seen);if(!error)seen.add(pmsMaterialLogisticsIdentity(row));return {row,error}
 })
}

async function handleImportFile(file:File):Promise<void>{
  try{const rows=await parsePmsExcelRows(file);state.overlay={kind:'import',rows:mapImportRows(rows),clientActionId:nextPmsActionId('pms-mpo-import')};state.overlayError='';refreshOverlays()}catch(error){state.overlayError=error instanceof Error?error.message:'解析文件失败，请使用导入模板';preserveEditingError()}
}

async function submitArrival(orderNo: string): Promise<void> {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-mpo-arrival-root]')
  if (!surface) return
  const qty = Number.parseFloat(readTextField(surface as ParentNode, `[data-${EVENT_PREFIX}-arrival-qty]`))
  try {
    const order = await registerPmsMaterialPurchaseArrival(orderNo, qty, PMS_BUYER_ACTOR,state.overlay?.clientActionId)
    state.feedback = `${orderNo} 已登记到货 ${mpoQuantityText(order,'sellerReceivedQty')}，状态为${order.status}。`
    state.feedbackOk = true
    state.overlay = null
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '登记到货失败'
    preserveEditingError()
  }
}

async function submitImport(rows: ImportPreviewRow[]): Promise<void> {
  try {
    const imported = await importPmsMaterialLogistics(rows.map((item) => item.row), PMS_BUYER_ACTOR,state.overlay?.clientActionId)
    state.feedback = `已导入 ${imported.length} 条快递信息，采购跟踪已同步。`
    state.feedbackOk = true
    state.overlay = null
    state.overlayError = ''
    refreshAll()
  } catch (error) {
    state.overlayError = error instanceof PmsDomainError ? error.message : '导入快递信息失败'
    preserveEditingError()
  }
}

async function batchAdvance(nextStatus: PmsMaterialPurchaseOrderStatus): Promise<void> {
  try {
    const updated = await batchAdvancePmsMaterialPurchaseOrders([...state.selectedOrderNos], nextStatus, PMS_BUYER_ACTOR)
    state.feedback = nextStatus==='已入库'?`已保存 ${updated.length} 张采购单的本次可入库数量。未到齐的采购单保留部分到货状态。`:`已将 ${updated.length} 张采购单推进为${nextStatus}。`
    state.feedbackOk = true
    state.selectedOrderNos = []
    refreshAll()
  } catch (error) {
    state.feedback = error instanceof PmsDomainError ? error.message : '批量状态推进失败'
    state.feedbackOk = false
    refreshAll()
  }
}

export async function renderPmsMaterialPurchaseOrdersPage(): Promise<string> {
  try{await Promise.all([hydratePmsMaterialPurchaseOrdersFromIdb(),hydratePmsTmfPurchaseReferencesFromIdb(),ensurePurchaseCatalogState(),hydratePmsSuppliersFromIdb()]);state.readStatus='ready';applyPcsPurchaseEntry()}catch(error){state.readStatus='error';state.readError=error instanceof Error?error.message:'用户数据不可读'}
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  loadPurchasePage()
  try { applyPcsPurchaseEntry() } catch (error) { state.readStatus = 'error'; state.readError = error instanceof Error ? error.message : '采购来源无法读取。' }
  installPcsPurchaseLeaveGuard()
  return `<div data-pms-mpo-root data-skip-page-rerender="true"><style>[data-pms-mpo-root] [data-standard-list-scroll] td{vertical-align:top}</style><div data-pms-mpo-body>${renderInner()}</div></div>`
}

export async function closePmsMaterialPurchaseOrderOverlays(): Promise<boolean> {
  if(rootElement()?.querySelector('[data-mpo-row-menu]')&&!hasMpoParityOverlay()){closeMpoParityOverlay();return true}
  if(hasMpoParityOverlay()){const close=rootElement()?.querySelector<HTMLElement>('[data-pms-mpo-action="parity-close"]');if(close)await handlePmsMaterialPurchaseOrdersEvent(close);return true}
  if (state.overlay?.kind === 'barcodes') return await closeMpoBarcodeOverlay(barcodeCallbacks)
  if(state.attachmentPreviewUrl){URL.revokeObjectURL(state.attachmentPreviewUrl);state.attachmentPreviewUrl='';refreshOverlays();return true}
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

export async function handlePmsMaterialPurchaseOrdersEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  if (!rootElement() && typeof window !== 'undefined') return false
  if(state.overlay?.kind==='barcodes' && await handleMpoBarcodeEvent(target,event,barcodeCallbacks))return true
  if (handlePmsCommonImageEvent(target, event, ()=>{const region=rootElement()?.querySelector<HTMLElement>('[data-mpo-parity-image-preview]');if(region){region.innerHTML=renderPmsImagePreview();hydratePmsSurface(region)}else refreshOverlays()})) return true
  if(await handleMpoParityEvent(target,event,{selected:()=>state.selectedOrderNos,refresh:()=>refreshAll(),overlays:()=>refreshOverlays(),prepare:()=>{state.overlay=null;state.overlayError=''},feedback:(message,ok)=>{state.feedback=message;state.feedbackOk=ok;refreshAll()}}))return true
  if (rootElement() && handleProcessFilterPresentation(rootElement()!, target)) return true
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && state.overlay) {
    if(state.overlay.kind==='barcodes')await closeMpoBarcodeOverlay(barcodeCallbacks);else closeOverlay()
    return true
  }

  const field = target.closest<HTMLInputElement | HTMLSelectElement>(`[data-${EVENT_PREFIX}-field]`)
  const fieldName = field?.dataset.pmsMpoField
  if (field && fieldName) {
    if (fieldName.startsWith('pcs-') && state.purchaseForm) {
      const name = fieldName.slice(4) as keyof PcsPurchaseForm
      if (['quantity', 'unitRelationId', 'supplierCode', 'purchaseRegion', 'unitPrice', 'currency', 'warehouse', 'expectedArrivalDate', 'buyerName', 'remark'].includes(name)) {
        ;(state.purchaseForm as unknown as Record<string, unknown>)[name] = field.value
        state.purchaseDirty = true
        if (name === 'unitRelationId') refreshAll()
        else {
          const summary = rootElement()?.querySelector('[data-pms-pcs-purchase-summary]')
          if (summary) summary.innerHTML = renderPurchaseUnitSummary(currentPurchaseUnit(), state.purchaseForm.quantity, state.purchaseForm.unitPrice, state.purchaseForm.currency)
        }
      }
      return true
    }
    if (fieldName === 'tip-purchase-source') {
      const form = rootElement()?.querySelector('[data-pms-tip-purchase-form]')
      if (form) updateTmfTipPurchaseSource(form)
      return true
    }
    if(fieldName==='listSort'){state.listSort=field.value;state.sort=field.value?{key:'times',direction:field.value.endsWith('asc')?'asc':'desc'}:null;return true}
    if(fieldName==='keywordField'){state.keywordField=field.value;return true}
    if(fieldName.startsWith('multi:')){state.multiFilters[fieldName.slice(6)]=Array.from((field as HTMLSelectElement).selectedOptions).map(option=>option.value);return true}
    if(fieldName.startsWith('date:')){state.dateFilters[fieldName.slice(5)]=field.value;return true}
    if(fieldName.startsWith('range:')){state.rangeFilters[fieldName.slice(6)]=field.value;return true}
    if (fieldName === 'keyword') {
      state.keyword = field.value
      return true
    }
    if (fieldName === 'status') {
      state.status = field.value as MpoPageState['status']
      return true
    }
    if (fieldName === 'logisticsFilter') {
      state.logisticsFilter = field.value as MpoPageState['logisticsFilter']
      return true
    }
    if (fieldName === 'select-row') {
      const orderNo = field.dataset.orderNo || ''
      if (field instanceof HTMLInputElement && field.checked) {
        state.selectedOrderNos = [...new Set([...state.selectedOrderNos, orderNo])]
      } else {
        state.selectedOrderNos = state.selectedOrderNos.filter((no) => no !== orderNo)
      }
      controller.refresh({ overlays: false })
      syncBatchButtons()
      return true
    }
    if (fieldName === 'selection-scope') {
      const scope = field.value
      if (!scope) return true
      if (scope === 'clear') {
        state.selectedOrderNos = []
      } else if (scope === 'page') {
        state.selectedOrderNos = [...(rootElement()?.querySelectorAll<HTMLInputElement>(`tbody [data-${EVENT_PREFIX}-field="select-row"]`) ?? [])].map((box) => box.dataset.orderNo || '')
      } else {
        state.selectedOrderNos = filteredRows().map((row) => row.purchaseOrderNo)
      }
      controller.refresh({ overlays: false })
      syncBatchButtons()
      return true
    }
    if (fieldName === 'import-file') {
      if (field instanceof HTMLInputElement && field.files?.[0]) await handleImportFile(field.files[0])
      return true
    }
    if (fieldName === 'pageSize') {
      controller.setPageSize(Number.parseInt((field as HTMLSelectElement).value, 10))
      controller.refresh({ overlays: false })
      return true
    }
    return true
  }


  const batchField=target.closest<HTMLSelectElement>('[data-mpo-batch-field]');if(batchField && event?.type==='change'){if(!state.selectedOrderNos.length){state.feedback='选择要操作的采购单';state.feedbackOk=false;refreshAll();return true}if(batchField.value){state.overlay={kind:'batch-fields',field:batchField.value,clientActionId:crypto.randomUUID()};batchField.value='';refreshOverlays()}return true}
  const upload=target.closest<HTMLInputElement>('[data-mpo-attachment-file]');if(upload && event?.type==='change'){state.attachmentFile=upload.files?.[0] || null;return true}
  const actionNode = target.closest<HTMLElement>(`[data-${EVENT_PREFIX}-action]`)
  let action = actionNode?.dataset.pmsMpoAction
  if(action==='open-order-detail')action='open-detail'
  const parityAliases:Record<string,string>={'parity-inspection':'open-inspection','parity-attachment':'open-attachment','parity-print':'print-order','parity-barcodes':'open-barcodes','parity-barcode-import':'open-barcodes','parity-barcode-print':'open-barcodes'}
  if(action&&parityAliases[action])action=parityAliases[action]
  if (!action) return false

  if(action==='open-attachment'){state.attachmentFile=null;state.overlay={kind:'attachment',orderNo:actionNode?.dataset.orderNo || '',category:(actionNode?.dataset.fileCategory || '物流凭证') as '物流凭证'|'附加图片',clientActionId:crypto.randomUUID()};state.overlayError='';refreshOverlays();return true}
  if(action==='save-attachment' && state.overlay?.kind==='attachment'){const overlay=state.overlay;try{if(!state.attachmentFile)throw new Error('选择要保存的文件');await addPmsMaterialPurchaseAttachment(overlay.orderNo,state.attachmentFile,overlay.category,PMS_BUYER_ACTOR,overlay.clientActionId);state.overlay={kind:'detail',orderNo:overlay.orderNo,clientActionId:crypto.randomUUID()};state.attachmentFile=null;state.feedback='采购附件已保存';state.feedbackOk=true;refreshAll()}catch(error){state.overlayError=error instanceof Error?error.message:'附件未保存';preserveEditingError()}return true}
  if(action==='preview-attachment'){try{const blob=await readPmsMaterialPurchaseAttachment(actionNode?.dataset.fileId || '');if(state.attachmentPreviewUrl)URL.revokeObjectURL(state.attachmentPreviewUrl);state.attachmentPreviewUrl=URL.createObjectURL(blob);state.attachmentPreviewType=blob.type;refreshOverlays()}catch(error){state.overlayError=error instanceof Error?error.message:'附件不可读';preserveEditingError()}return true}
  if(action==='close-file-preview'){if(state.attachmentPreviewUrl)URL.revokeObjectURL(state.attachmentPreviewUrl);state.attachmentPreviewUrl='';refreshOverlays();return true}
  if(action==='delete-attachment'){const orderNo=actionNode?.dataset.orderNo || '',fileId=actionNode?.dataset.fileId || '',file=getPmsMaterialPurchaseOrder(orderNo)?.attachments?.find(row=>row.fileId===fileId);if(file && await confirmPmsAction(`删除采购单 ${pmsBusinessNumber(orderNo)} 的附件 ${file.name}？仍被其它单据引用的文件会保留。`,'删除附件','删除采购附件')){try{await removePmsMaterialPurchaseAttachment(orderNo,fileId,PMS_BUYER_ACTOR,crypto.randomUUID());state.feedback='采购附件已删除';state.feedbackOk=true;refreshAll()}catch(error){state.overlayError=error instanceof Error?error.message:'附件未删除';preserveEditingError()}}return true}
  if(action==='multi-all'||action==='multi-clear'){
    const key=actionNode?.getAttribute('data-filter-key')||'',select=rootElement()?.querySelector<HTMLSelectElement>(`[data-pms-mpo-field="multi:${key}"]`)
    if(select){Array.from(select.options).forEach(option=>option.selected=action==='multi-all');state.multiFilters[key]=Array.from(select.selectedOptions).map(option=>option.value)}return true
  }
  if(action==='open-inspection'){state.overlay={kind:'inspection',orderNo:actionNode?.dataset.orderNo||'',clientActionId:crypto.randomUUID()};state.overlayError='';refreshOverlays();return true}
  if(action==='convert-raw'){const no=actionNode?.dataset.orderNo||'';if(await confirmPmsAction(`将 ${pmsBusinessNumber(no)} 调整为原料采购？保留原SKU、单位、数量和历史记录。只修改本地采购分类。`,'转原料采购'))try{await convertPmsMaterialPurchaseToRaw(no,PMS_BUYER_ACTOR,crypto.randomUUID());state.feedback='已转为原料采购';state.feedbackOk=true;refreshAll()}catch(error){state.overlayError=error instanceof Error?error.message:'分类未保存';preserveEditingError()}return true}
  if(action==='new-logistics'){state.overlay={kind:'logistics-new',orderNo:actionNode?.dataset.orderNo||'',clientActionId:crypto.randomUUID()};state.overlayError='';refreshOverlays();return true}
  if(action==='edit-logistics'){state.overlay={kind:'logistics-edit',recordNo:actionNode?.dataset.recordNo||'',clientActionId:crypto.randomUUID()};state.overlayError='';refreshOverlays();return true}
  if(action==='submit-inspection'&&state.overlay?.kind==='inspection'){
    const overlay=state.overlay,form=rootElement()?.querySelector<HTMLElement>('[data-mpo-qc-form]')
    if(form)try{const read=(name:string)=>form.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value.trim()||'';await inspectPmsMaterialPurchaseOrder(overlay.orderNo,{sampleQty:Number(read('sampleQty')),qualifiedQty:Number(read('qualifiedQty')),defectQty:Number(read('defectQty')),reason:read('reason'),warehouse:read('warehouse'),inspector:read('inspector'),labelLength:Number(read('labelLength')),actualLength:Number(read('actualLength'))},PMS_BUYER_ACTOR,overlay.clientActionId);state.feedback='质检结果已保存。入库时按已登记数量分到收货仓和瑕疵仓。';state.feedbackOk=true;state.overlay={kind:'detail',orderNo:overlay.orderNo,clientActionId:crypto.randomUUID()};refreshAll()}catch(error){state.overlayError=error instanceof Error?error.message:'质检未保存';preserveEditingError()}return true
  }
  if(action==='submit-logistics-edit'&&(state.overlay?.kind==='logistics-edit'||state.overlay?.kind==='logistics-new')){
    const overlay=state.overlay,form=rootElement()?.querySelector<HTMLElement>('[data-mpo-logistics-form]')
    if(form)try{const read=(name:string)=>form.querySelector<HTMLInputElement|HTMLSelectElement>(`[name="${name}"]`)?.value.trim()||'';const input={company:read('company'),trackingNo:read('trackingNo'),shipDate:read('shipDate'),estimatedArrival:read('estimatedArrival'),boxCount:Number(read('boxCount')),rolls:Number(read('rolls')),qty:Number(read('qty')),fee:Number(read('fee')),remark:read('remark'),transportMethod:read('transportMethod'),contact:read('contact'),sellerBoxNo:read('sellerBoxNo'),boxNo:read('boxNo'),lengthCm:Number(read('lengthCm')),widthCm:Number(read('widthCm')),heightCm:Number(read('heightCm')),weightKg:Number(read('weightKg')),transferCenter:read('transferCenter'),estimatedTransferDays:Number(read('estimatedTransferDays'))};const row=overlay.kind==='logistics-new'?(await importPmsMaterialLogistics([{...input,purchaseOrderNo:overlay.orderNo}],PMS_BUYER_ACTOR,overlay.clientActionId))[0]:await updatePmsMaterialLogistics(overlay.recordNo,input,PMS_BUYER_ACTOR,overlay.clientActionId);state.feedback='采购物流信息已保存';state.feedbackOk=true;state.overlay={kind:'detail',orderNo:row.purchaseOrderNo,clientActionId:crypto.randomUUID()};refreshAll()}catch(error){state.overlayError=error instanceof Error?error.message:'物流信息未保存';preserveEditingError()}return true
  }
  if(action==='open-barcodes'){state.overlay={kind:'barcodes',orderNo:actionNode?.dataset.orderNo || '',clientActionId:crypto.randomUUID(),initialMode:actionNode?.dataset.pmsMpoAction==='parity-barcode-import'?'import':actionNode?.dataset.pmsMpoAction==='parity-barcode-print'?'print':undefined};refreshOverlays();return true}
  if(action==='save-batch-fields' && state.overlay?.kind==='batch-fields'){const overlay=state.overlay,value=rootElement()?.querySelector<HTMLInputElement>('[data-mpo-batch-value]')?.value || '';try{await batchUpdatePmsMaterialPurchaseOrders(state.selectedOrderNos,overlay.field as Parameters<typeof batchUpdatePmsMaterialPurchaseOrders>[1],value,PMS_BUYER_ACTOR,overlay.clientActionId);state.feedback='批量采购设置已保存';state.feedbackOk=true;state.selectedOrderNos=[];state.overlay=null;refreshAll()}catch(error){state.overlayError=error instanceof Error?error.message:'批量操作未保存';preserveEditingError()}return true}
  if(action==='print-order'){const row=getPmsMaterialPurchaseOrder(actionNode?.dataset.orderNo || '');if(row){const popup=window.open('','_blank');if(popup){popup.document.write(buildMpoPurchasePrintHtml(row));popup.document.close()}else{state.feedback='打印窗口未打开，请允许本页打开新窗口后重试';state.feedbackOk=false;refreshAll()}}return true}
  if (action === 'pcs-retry') { purchaseEntry = ''; loadPurchasePage(true); refreshAll(); return true }
  if (action === 'pcs-save') { void savePcsPurchaseForm(); return true }
  if (action === 'pcs-read-draft') {
    const form = state.purchaseForm
    if (!form?.purchaseOrderNo || state.purchaseSaving) return true
    if (state.purchaseDirty && !await confirmPmsAction('重新读取会恢复已保存的草稿，当前未保存修改将放弃。','重新读取草稿','放弃未保存修改')) return true
    state.purchaseSaving = true; refreshAll()
    void hydratePmsMaterialPurchaseOrdersFromIdb(true).then(() => {
      const latest = getPmsMaterialPurchaseOrder(form.purchaseOrderNo!)
      if (!latest?.pcsSource) throw new Error('采购草稿无法读取，请返回列表重试。')
      beginPcsPurchaseForm(latest.pcsSource.materialSkuId, latest)
    }).catch(error => { state.purchaseError = error instanceof Error ? error.message : '采购草稿无法读取，请重试。' })
      .finally(() => { state.purchaseSaving = false; refreshAll() })
    return true
  }
  if (action === 'pcs-tab') { state.purchaseTab = actionNode?.dataset.tab as PcsPurchaseTab; refreshAll(); return true }
  if (action === 'pcs-edit') {
    const order = getPmsMaterialPurchaseOrder(state.purchaseOrderNo)
    if (order?.pcsSource) { beginPcsPurchaseForm(order.pcsSource.materialSkuId, order); state.feedback = ''; refreshAll() }
    return true
  }
  if (action === 'pcs-list' || action === 'pcs-cancel') {
    if (state.purchaseSaving) return true
    if (state.purchaseDirty && !await confirmPmsAction('当前采购内容尚未保存，放弃后无法恢复这些修改。','放弃修改','放弃采购表单')) return true
    state.purchaseDirty = false; state.purchaseError = ''; state.feedback = ''
    if (action === 'pcs-cancel' && state.purchaseForm?.purchaseOrderNo) {
      state.purchaseOrderNo = state.purchaseForm.purchaseOrderNo; state.purchaseView = 'detail'; state.purchaseTab = 'purchase'; setPurchaseLocation(state.purchaseOrderNo)
    } else { state.purchaseView = 'list'; setPurchaseLocation() }
    state.purchaseForm = null; refreshAll(); return true
  }

  if (action === 'open-tip-purchase') {
    state.overlay = { kind: 'tip-purchase', clientActionId: `TMF-TIP-PURCHASE:${crypto.randomUUID()}` }
    state.overlayError = ''
    refreshOverlays()
    rootElement()?.querySelector<HTMLSelectElement>('[data-pms-tip-purchase-form] [name="source"]')?.focus()
    return true
  }
  if (action === 'submit-tip-purchase' && state.overlay?.kind === 'tip-purchase') {
    const form = rootElement()?.querySelector('[data-pms-tip-purchase-form]')
    if (!form) return true
    try {
      const order = await createPmsTmfTipPurchase(readTmfTipPurchaseForm(form), PMS_BUYER_ACTOR, state.overlay.clientActionId)
      state.keyword = order.purchaseOrderNo; state.status = ''; state.logisticsFilter = ''; state.currentPage = 1
      state.overlay = null; state.overlayError = ''
      state.feedback = `${order.purchaseOrderNo} 已创建，物料与生产采用版本关联。请核对后下达采购。`; state.feedbackOk = true
      refreshAll()
    } catch (error) {
      const message = form.querySelector('[data-pms-tip-purchase-error]')
      if (message) message.textContent = error instanceof Error ? error.message : '采购未保存，请重试。'
    }
    return true
  }
  if (action === 'toggle-page') {
    const checked = actionNode instanceof HTMLInputElement && actionNode.checked
    rootElement()?.querySelectorAll<HTMLInputElement>(`tbody [data-${EVENT_PREFIX}-field="select-row"]`).forEach((box) => {
      const orderNo = box.dataset.orderNo || ''
      if (checked) state.selectedOrderNos = [...new Set([...state.selectedOrderNos, orderNo])]
      else state.selectedOrderNos = state.selectedOrderNos.filter((no) => no !== orderNo)
    })
    controller.refresh({ overlays: false })
    syncBatchButtons()
    return true
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
    state.logisticsFilter = '';state.keywordField='all';state.listSort='';state.sort=null;state.multiFilters={};state.dateFilters={};state.rangeFilters={}
    state.selectedOrderNos = []
    state.currentPage = 1
    state.feedback = ''
    refreshAll(true)
    return true
  }
  if (action === 'export') {
    exportRows(rootElement()?.querySelector<HTMLSelectElement>('[data-mpo-export-kind]')?.value || '订单明细')
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
    const key = actionNode?.closest<HTMLElement>('[data-pms-mpo-column-key]')?.dataset.pmsMpoColumnKey || ''
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
    const orderNo = actionNode?.dataset.orderNo || '', order = getPmsMaterialPurchaseOrder(orderNo)
    if (order?.pcsSource) {
      state.purchaseView = 'detail'; state.purchaseOrderNo = orderNo; state.purchaseForm = null; state.purchaseTab = 'purchase'; state.feedback = ''; setPurchaseLocation(orderNo); refreshAll(); return true
    }
    state.overlay = { kind: 'detail', orderNo: actionNode?.dataset.orderNo || '', clientActionId: nextPmsActionId('pms-mpo-detail') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-tmf-revision') {
    state.overlay = { kind: 'tmf-revision', orderNo: actionNode?.dataset.orderNo || '', clientActionId: nextPmsActionId('tmf-purchase-revision') }
    state.overlayError = ''; refreshOverlays(); return true
  }
  if (action === 'submit-tmf-revision' && state.overlay?.kind === 'tmf-revision') {
    const form = rootElement()?.querySelector<HTMLElement>('[data-tmf-purchase-revision]')
    if (!form) return true
    try {
      const quantity = Number(form.querySelector<HTMLInputElement>('[name="orderedQty"]')!.value)
      const order = getTmfMaterialPurchase(state.overlay.orderNo)
      if (order?.orderedQty === quantity) throw new Error('数量未变化，请修改数量或取消。')
      reviseTmfMaterialPurchase(state.overlay.orderNo, { orderedQty: quantity,
        expectedVersion: Number(form.dataset.version), reason: form.querySelector<HTMLInputElement>('[name="reason"]')!.value.trim(),
        confirmed: form.querySelector<HTMLInputElement>('[name="confirmed"]')!.checked }, PMS_BUYER_ACTOR as TmfPurchaseActor, state.overlay.clientActionId)
      state.feedback = '采购数量变更已保存。请核对基础计划版本及是否需要重新接单或处置。'; state.feedbackOk = true
      state.overlay = {kind:'detail',orderNo:order!.purchaseOrderNo,clientActionId:nextPmsActionId('pms-mpo-detail')}
      refreshAll()
    } catch (error) {
      form.querySelector('[data-tmf-purchase-revision-error]')!.textContent = error instanceof Error ? error.message : '变更未保存，请重试。'
    }
    return true
  }
  if (action === 'open-arrival') {
    state.overlay = { kind: 'arrival', orderNo: actionNode?.dataset.orderNo || '', clientActionId: nextPmsActionId('pms-mpo-arrival') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'open-close') {
    state.overlay = { kind: 'close', orderNo: actionNode?.dataset.orderNo || '', clientActionId: nextPmsActionId('pms-mpo-close') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'submit-close') {
    if (state.overlay?.kind !== 'close') return true
    const surface = rootElement()?.querySelector<HTMLElement>('[data-pms-mpo-close-root]')
    const reason = surface ? readTextField(surface, `[data-${EVENT_PREFIX}-close-reason]`) : ''
    try {
      await closePmsMaterialPurchaseOrder(state.overlay.orderNo, reason, PMS_BUYER_ACTOR,state.overlay.clientActionId)
      state.feedback = `已关闭 ${state.overlay.orderNo}，原因已记录。`
      state.feedbackOk = true
      state.overlay = null
      state.overlayError = ''
      refreshAll()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '关闭采购单失败'
      preserveEditingError()
    }
    return true
  }
  if (action === 'open-import') {
    state.overlay = { kind: 'import', rows: [], clientActionId: nextPmsActionId('pms-mpo-import') }
    state.overlayError = ''
    refreshOverlays()
    return true
  }
  if (action === 'close-overlay') {
    if(state.overlay?.kind==='barcodes')await closeMpoBarcodeOverlay(barcodeCallbacks);else closeOverlay()
    return true
  }
  if (action === 'download-template') {
    downloadTemplate()
    return true
  }
  if (action === 'submit-arrival') {
    if (state.overlay?.kind === 'arrival') await submitArrival(state.overlay.orderNo)
    return true
  }
  if (action === 'submit-import') {
    if (state.overlay?.kind === 'import') await submitImport(state.overlay.rows)
    return true
  }
  if (action === 'batch-purchased') {
    await batchAdvance('已采购')
    return true
  }
  if (action === 'batch-inbound') {
    await batchAdvance('已入库')
    return true
  }
  if (action === 'advance-status') {
    const orderNo = actionNode?.dataset.orderNo || ''
    const nextStatus = actionNode?.dataset.nextStatus as PmsMaterialPurchaseOrderStatus | undefined
    if (!nextStatus) return true
    try {
      await batchAdvancePmsMaterialPurchaseOrders([orderNo], nextStatus, PMS_BUYER_ACTOR)
      state.feedback = nextStatus==='已入库'?`${pmsBusinessNumber(orderNo)} 本次入库数量已保存，当前状态为${getPmsMaterialPurchaseOrder(orderNo)?.status}。`:`${pmsBusinessNumber(orderNo)} 已推进为${nextStatus}。`
      state.feedbackOk = true
      refreshAll()
    } catch (error) {
      state.overlayError = error instanceof PmsDomainError ? error.message : '状态推进失败'
      preserveEditingError()
    }
    return true
  }
  return false
}

export function getPmsMaterialPurchaseOrderRowCountForTest(): number {
  return filteredRows().length
}
