import { startPrintingProduction, recordPrintingProductionStage } from '../../../data/fcs/printing-task-domain.ts'
import { printingDemandFields, printingDocumentVersion, printingProductionStage, printingQuantityGroups, printingPresentationFacts } from './presentation.ts'
import { printingWorkOrderTimeGroups } from './work-order-times.ts'
import { handlePrintingWarehouseEvent } from './warehouse.ts'
import { handlePrintingStatisticsEvent } from './statistics.ts'
import { handlePrintingDashboardsEvent } from './dashboards.ts'
import { handlePrintingDispatchEvent, refreshPrintingDispatchPage } from './dispatch.ts'
import { updatePrintingOrderInformation, deletePrintingRollBarcodes, copyPrintingRollBarcode, importPrintingRollLengths, movePrintingRollsToOutboundArea } from '../../../data/fcs/printing-task-domain.ts'
import { printingMaterialCode, printingUpstreamNames } from './relations.ts'
import { PRINTING_DEMAND_SOURCE_LABEL, PRINTING_RECEIPT_STATUS_LABEL, PRINTING_PROCESSING_STATUS_LABEL, PRINTING_HANDOVER_STATUS_LABEL } from '../../../data/fcs/printing-work-order-business.ts'
import { recordPrintingHistoricalInput } from '../../../data/fcs/printing-work-order-business.ts'
import {
  addPrintingRollBarcode,
  assignPrintingWorkOrder,
  batchUpdatePrintingRollBarcodes,
  cancelPrintingWorkOrder,
  changePrintingInput,
  completePrintWorkOrderDocument,
  completePrintingWorkOrder,
  getPrintingWorkOrderById,
  markPrintingRollBarcodesPrinted,
  receivePrintingHandover,
  updatePrintingRollBarcode,
} from '../../../data/fcs/printing-work-order-business.ts'
import { buildUnifiedPrintPreviewLink, type PrintDocumentType } from '../../../data/fcs/print-service.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  closePrintingDialog,
  getPrintingDialogState,
  openPrintingDialog,
  replacePrintingDialog,
} from './dialogs.ts'
import { refreshPrintingWorkOrderDetailPage } from './work-order-detail.ts'
import {
  getFilteredPrintingWorkOrders,
  getSelectedPrintingWorkOrderIds,
  handlePrintingWorkOrderListEvent,
  refreshPrintingWorkOrderListPage,
  selectFilteredPrintingWorkOrders,
} from './work-orders.ts'

function showPrintingToast(message: string, tone: 'success' | 'error' = 'success'): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  let root = document.getElementById('printing-page-toast-root')
  if (!root) {
    root = document.createElement('div')
    root.id = 'printing-page-toast-root'
    root.className = 'pointer-events-none fixed right-6 top-20 z-[150] flex max-w-sm flex-col gap-2'
    document.body.appendChild(root)
  }
  const toast = document.createElement('div')
  toast.className = `pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg ${tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`
  toast.textContent = message
  root.appendChild(toast)
  window.setTimeout(() => { toast.remove(); if (root?.childElementCount === 0) root.remove() }, 2600)
}

function refreshVisiblePage(): void {
  refreshPrintingDispatchPage()
  refreshPrintingWorkOrderListPage()
  refreshPrintingWorkOrderDetailPage()
}

function dialogPanel(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('[data-printing-dialog-panel]')
}

function fieldValue(name: string): string {
  const field = dialogPanel()?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-printing-dialog-field="${name}"]`)
  return field?.value?.trim() || ''
}

function numberValue(name: string): number {
  return Number(fieldValue(name))
}

function selectedBarcodeIds(): string[] {
  return [...(dialogPanel()?.querySelectorAll<HTMLInputElement>('[data-printing-barcode-select]:checked') || [])].map((input) => input.value)
}

function updateBarcodeSelectionCount(): void {
  const count = selectedBarcodeIds().length
  const all=dialogPanel()?.querySelectorAll('[data-printing-barcode-select]').length || 0
  const header=dialogPanel()?.querySelector<HTMLInputElement>('[data-printing-barcode-select-all]')
  if(header){header.checked=all>0&&count===all;header.indeterminate=count>0&&count<all}
  document.querySelectorAll<HTMLElement>('[data-printing-barcode-selected-count]').forEach((node) => { node.textContent = `已选 ${count}` })
}

function submitDialog(): void {
  const dialog = getPrintingDialogState()
  if (!dialog) return
  try {
    if (dialog.type === 'edit-info') {
      const record = getPrintingWorkOrderById(dialog.workOrderId)!
      const readPattern = (prefix: 'frontPattern' | 'insidePattern') => {
        const original = record.requirement[prefix]
        const values = { patternNo:fieldValue(`${prefix}No`),patternVersion:fieldValue(`${prefix}Version`),patternName:fieldValue(`${prefix}Name`),imageUrl:fieldValue(`${prefix}Image`) }
        if (original && Object.entries(values).every(([key, value]) => original[key as keyof typeof values] === value)) return original
        return { ...values, imageAlt:`${prefix === 'frontPattern' ? '正面' : '反面'}花型 ${values.patternNo}` }
      }
      updatePrintingOrderInformation(dialog.workOrderId,{ printSide:(fieldValue('printSide') || record.requirement.printSide) as '单面'|'双面',frontPattern:readPattern('frontPattern'),insidePattern:(fieldValue('printSide') || record.requirement.printSide) === '双面' ? readPattern('insidePattern') : undefined,changeReason:fieldValue('changeReason'),craftName:fieldValue('craftName'),type:fieldValue('craftType'),shade:fieldValue('shade'),temperature:fieldValue('temperature'),printerNo:fieldValue('printerNo'),plannedFinishAt:fieldValue('plannedFinishAt'),remark:fieldValue('infoRemark'),operatorName:'印花跟单员'})
      showPrintingToast('印花信息已保存，原打印单请核对重印')
    } else if (dialog.type === 'start-production') {
      startPrintingProduction(dialog.workOrderId, {id:dialog.receiptId!,qty:numberValue('productionQty'),operatorName:fieldValue('productionOperator')})
      showPrintingToast('实际领用已保存，已开始本次生产')
    } else if (dialog.type === 'production-stage') {
      const [stage, action] = fieldValue('productionAction').split(':')
      recordPrintingProductionStage(dialog.workOrderId, {id:dialog.receiptId!,stage:stage as 'ARTWORK'|'SAMPLE'|'PRINT'|'TRANSFER',action:action as 'START'|'FINISH',qty:fieldValue('productionQty') ? numberValue('productionQty') : undefined,operatorName:fieldValue('productionOperator')})
      showPrintingToast('本工序记录已保存')
    } else if (dialog.type === 'assign') {
      assignPrintingWorkOrder(dialog.workOrderId, { factoryId: fieldValue('factoryId'), operatorName: '生产计划员' })
      showPrintingToast('已分配加工厂，加工状态进入“待接收投入”')
    } else if (dialog.type === 'change-input') {
      const record = getPrintingWorkOrderById(dialog.workOrderId)
      if (!record) throw new Error('未找到印花加工单')
      const standardUsageText = fieldValue('newStandardUnitUsage')
      const orderUsageText = fieldValue('newOrderUnitUsage')
      changePrintingInput(dialog.workOrderId, {
        newSku: fieldValue('newSku'), newMaterialName: fieldValue('newMaterialName'), newImageUrl: fieldValue('newImageUrl'),
        newGsm: numberValue('newGsm'), newWidthCm: numberValue('newWidthCm'),
        newStandardUnitUsage: standardUsageText ? Number(standardUsageText) : null,
        newOrderUnitUsage: orderUsageText ? Number(orderUsageText) : record.usage.calculationMode === 'DIRECT' ? null : undefined,
        newPlannedQty: numberValue('newPlannedQty'), reason: fieldValue('reason'), operatorName: '生产计划员',
      })
      showPrintingToast('加工投入已调整；产出 SKU 未改变，信息单和确认单已标记需重印')
    } else if (dialog.type === 'receive-input') {
      const historicalCorrection = getPrintingWorkOrderById(dialog.workOrderId)?.historicalInputQuantityUnknown
      if (historicalCorrection) recordPrintingHistoricalInput(dialog.workOrderId, { receivedQty: numberValue('receivedQty'), receivedRollCount: numberValue('receivedRollCount'), reason: fieldValue('historicalReason'), operatorName: fieldValue('receiverName'), historicalCompletedRollCount: fieldValue('historicalCompletedRollCount') ? numberValue('historicalCompletedRollCount') : undefined })
      else throw new Error('请在待接收中登记实收和库位')
      showPrintingToast(historicalCorrection ? '历史累计投入已补录，原交接记录保持不变' : '本厂实收已保存，等待实际开工')
    } else if (dialog.type === 'complete') {
      completePrintingWorkOrder(dialog.workOrderId, { batchId:dialog.receiptId,lossQty:fieldValue('lossQty') ? numberValue('lossQty') : undefined,finishOrder:dialogPanel()?.querySelector<HTMLInputElement>('[data-printing-dialog-field="finishOrder"]')?.checked || false,usedQty: numberValue('usedQty'), usedRollCount: numberValue('usedRollCount'), completedQty: numberValue('completedQty'), completedRollCount: numberValue('completedRollCount'), printerNo: fieldValue('printerNo'), operatorName: '印花执行员' })
      showPrintingToast('本批产出已保存，请按实际逐卷维护数量后交出')
    } else if (dialog.type === 'receive-handover') {
      receivePrintingHandover(dialog.workOrderId, { receivedQty: numberValue('receiveQty'), receiverName: fieldValue('outputReceiver'), objectionQty: numberValue('objectionQty'), differenceReason: fieldValue('differenceReason') })
      showPrintingToast('下游接收事实已保存；单据仍需人工完成')
    } else if (dialog.type === 'complete-document') {
      completePrintWorkOrderDocument(dialog.workOrderId, { operatorName: fieldValue('documentCompleter') || '印花主管' })
      showPrintingToast('印花加工单已由现场负责人确认完成')
    } else if (dialog.type === 'cancel') {
      cancelPrintingWorkOrder(dialog.workOrderId, { operatorName: '印花主管', reason: fieldValue('cancelReason') })
      showPrintingToast('印花加工单已取消')
    } else if (dialog.type === 'barcode-import') {
      const count = importPrintingRollLengths(dialog.workOrderId, fieldValue('rollImport'))
      showPrintingToast(`已导入 ${count} 卷细码`)
      replacePrintingDialog({type:'barcodes',workOrderId:dialog.workOrderId})
      refreshVisiblePage()
      return
    } else if (dialog.type === 'barcode-edit') {
      if (!dialog.barcodeId) throw new Error('未选择卷条码')
      const lengthY = numberValue('lengthY'); const meters = numberValue('meters'); const weightKg = numberValue('weightKg')
      updatePrintingRollBarcode(dialog.workOrderId, dialog.barcodeId, {
        lengthY: lengthY > 0 ? lengthY : undefined, meters: meters > 0 ? meters : undefined, weightKg: weightKg > 0 ? weightKg : undefined,
        weightMeasured:dialogPanel()?.querySelector<HTMLInputElement>('[data-printing-dialog-field="weightMeasured"]')?.checked || false, gsm: numberValue('gsm'), widthCm: numberValue('widthCm'), vatNo: fieldValue('vatNo'), warehouseName: fieldValue('warehouseName'), remark: fieldValue('barcodeRemark'),
      })
      showPrintingToast('卷属性已保存，重量按 KG 三位小数记录')
      replacePrintingDialog({ type: 'barcodes', workOrderId: dialog.workOrderId })
      refreshVisiblePage()
      return
    } else if (dialog.type === 'barcode-batch-edit') {
      batchUpdatePrintingRollBarcodes(dialog.workOrderId, dialog.selectedBarcodeIds || [], { gsm: numberValue('batchGsm'), widthCm: numberValue('batchWidthCm'), vatNo: fieldValue('batchVatNo'), warehouseName: fieldValue('batchWarehouseName') })
      showPrintingToast('选中卷属性已批量更新')
      replacePrintingDialog({ type: 'barcodes', workOrderId: dialog.workOrderId })
      refreshVisiblePage()
      return
    } else {
      return
    }
    closePrintingDialog()
    refreshVisiblePage()
  } catch (error) {
    showPrintingToast(error instanceof Error ? error.message : '操作失败', 'error')
  }
}

function closeImagePreview(): void {
  document.querySelector('[data-printing-image-preview]')?.remove()
}

let imageEscapeInstalled = false

function openImagePreview(url: string, alt: string): void {
  closeImagePreview()
  const overlay = document.createElement('div')
  overlay.className = 'fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/80 p-5'
  overlay.dataset.printingImagePreview = 'true'
  overlay.innerHTML = `<button type="button" class="absolute inset-0" data-printing-action="close-image" aria-label="关闭大图"></button><section class="relative z-10 max-h-full max-w-6xl rounded-lg bg-white p-4"><div class="mb-3 flex items-center justify-between gap-4"><h2 class="font-semibold">${escapeHtml(alt)}</h2><button type="button" class="rounded border px-3 py-1.5 text-sm" data-printing-action="close-image">关闭</button></div><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}高清大图" class="max-h-[80vh] max-w-full object-contain" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><p hidden class="p-12 text-center text-red-600">图片加载失败，请检查原图。</p></section>`
  overlay.addEventListener('click', event => { if ((event.target as HTMLElement).closest('[data-printing-action="close-image"]')) closeImagePreview() })
  document.body.appendChild(overlay)
  if (!imageEscapeInstalled) {
    imageEscapeInstalled = true
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return
      if (document.querySelector('[data-printing-image-preview]')) closeImagePreview()
      else closePrintingDialog()
    })
  }
}

function navigatePrint(documentType: PrintDocumentType, workOrderIds: string[], barcodeIds: string[] = []): void {
  if (!workOrderIds.length) throw new Error('请选择印花加工单')

  const sourceId = documentType === 'PRINTING_ROLL_LABEL'
    ? `${workOrderIds[0]}:${barcodeIds.join(',')}`
    : workOrderIds.join(',')
  appStore.navigate(buildUnifiedPrintPreviewLink({ documentType, sourceType: documentType === 'PRINTING_ROLL_LABEL' ? 'PRINTING_ROLL_RECORD' : 'PRINTING_WORK_ORDER', sourceId }))
}

export function buildPrintingExportRows(kind: 'export', sourceRows = getFilteredPrintingWorkOrders()): { headers: string[]; values: Array<Array<string | number>>; name: string } {
  if (!sourceRows.length) return { headers: ['印花加工单'], values: [], name: '印花加工单' }
  const rows = sourceRows
  const timeLabels = rows[0] ? printingWorkOrderTimeGroups(rows[0]).flatMap(group => group.fields.map(([label]) => label)) : []
  const allTimeLabels = [...new Set([...timeLabels, ...rows.flatMap(row => printingWorkOrderTimeGroups(row).flatMap(group => group.fields.map(([label]) => label)))])]
  const headers = ['加工厂', '印花加工单', '任务单', '需求来源', '来源单号', '需求单', '生产单', '创建方式', '售卖类型', '是否补料', '商品SPU', '投入物料', '计划投入SKU', '实际投入SKU', '投入单位', '产出SKU', '产出单位', '工艺', '加工方式', '印花面别', '正面花型', '正面版本', '反面花型', '反面版本', '设备', '接收状态', '加工状态', '生产环节', '交出状态', '上游供料方', '下游接收方', '接收仓', '下游接收人', '需求与印花版本', ...printingQuantityGroups(rows[0] || sourceRows[0]).flatMap(group => group.fields.flatMap(([label]) => [label, `${label}单位`, `${label}完整性`])), ...allTimeLabels, '备注']
  const values = rows.map(row => {
    const demand = new Map(printingDemandFields(row))
    const f = printingPresentationFacts(row), inputUnit = row.plannedInput.qtyUnit, outputUnit = row.output.qtyUnit
    const unknownSource = f.sourceQty === 0 && (row.actualInput.receivedQty > 0 || row.historicalInputQuantityUnknown)
    const quantityFacts: Array<[number | undefined, string]> = [[row.plannedInput.plannedQty,inputUnit],[row.output.plannedQty,outputUnit],[unknownSource?undefined:f.sourceQty,inputUnit],[unknownSource?undefined:Math.max(0,f.sourceQty-f.receivedQty),inputUnit],[row.historicalInputQuantityUnknown?undefined:row.actualInput.receivedQty,inputUnit],[row.historicalRollQuantitiesUnknown?undefined:row.actualInput.receivedRollCount,['面料','花边','织带'].includes(row.plannedInput.objectType)?'卷':'包'],[row.historicalInputQuantityUnknown?undefined:f.availableInputQty,inputUnit],[row.actualInput.usedQty,inputUnit],[f.inProcessQty,inputUnit],[row.output.completedQty,outputUnit],[f.lossQty,inputUnit],[f.reservedOutputQty,outputUnit],[f.availableOutputQty,outputUnit],[row.handover.handedOverQty,outputUnit],[row.handover.receivedQty,outputUnit],[row.pendingWritebackQty,outputUnit]]
    const times = new Map(printingWorkOrderTimeGroups(row).flatMap(group => group.fields))
    return [row.printFactoryName, row.printOrderNo, row.taskNo, PRINTING_DEMAND_SOURCE_LABEL[row.demandSource.type], row.demandSource.sourceNo || row.demandSource.sourceLabel, demand.get('需求单') || '', demand.get('生产单') || '', row.creationMethod, row.salesType, demand.get('是否补料') || '', row.product.spu || '不适用（备货）', row.plannedInput.materialName, printingMaterialCode(row.plannedInput.sku), row.historicalInputQuantityUnknown ? '历史未记录' : row.actualInput.actualSku ? printingMaterialCode(row.actualInput.actualSku) : '尚未接收', row.plannedInput.qtyUnit, printingMaterialCode(row.output.sku, true), row.output.qtyUnit, row.requirement.craftName, row.requirement.type, row.requirement.printSide, row.requirement.frontPattern.patternNo, row.requirement.frontPattern.patternVersion, row.requirement.insidePattern?.patternNo || (row.requirement.printSide === '双面' ? '资料待补充' : '不适用'), row.requirement.insidePattern?.patternVersion || (row.requirement.printSide === '双面' ? '资料待补充' : '不适用'), row.printerNo, PRINTING_RECEIPT_STATUS_LABEL[row.receiptStatus], PRINTING_PROCESSING_STATUS_LABEL[row.processingStatus], printingProductionStage(row), PRINTING_HANDOVER_STATUS_LABEL[row.handoverStatus], printingUpstreamNames(row).join('、') || '尚无来源', row.receivingTargetName, row.receivingTargetWarehouseName, row.handover.receivedBy || '尚未登记', printingDocumentVersion(row), ...quantityFacts.flatMap(([qty,unit]) => [qty ?? '',unit,qty === undefined ? '历史未记录或尚未核算' : '已记录']), ...allTimeLabels.map(label => times.get(label) || '不适用'), row.remark]
  })
  return { headers, values, name: '印花加工单' }
}

function exportCsv(kind: 'export'): void {
  const sourceRows = getFilteredPrintingWorkOrders()
  if (!sourceRows.length) { showPrintingToast('当前筛选没有可导出数据', 'error'); return }
  const { headers, values, name } = buildPrintingExportRows(kind, sourceRows)
  const csv = [headers, ...values].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a'); link.href = url; link.download = `${name}.csv`; link.click(); URL.revokeObjectURL(url)
  showPrintingToast(`已导出 ${values.length} 条${name}`)
}

function handlePrintingAction(actionNode: HTMLElement, action: string): boolean {
  const workOrderId = actionNode.dataset.workOrderId || document.querySelector<HTMLElement>('[data-printing-work-order-detail-root]')?.dataset.workOrderId || getPrintingDialogState()?.workOrderId || ''
  if (action === 'open-dispatch-pending' || action === 'open-dispatch-documents') { appStore.navigate(`/fcs/craft/printing/${action === 'open-dispatch-pending' ? 'pending-handover' : 'handover-documents'}${workOrderId ? `?workOrderId=${encodeURIComponent(workOrderId)}` : ''}`); return true }
  if (action === 'receive-input' && !getPrintingWorkOrderById(workOrderId)?.historicalInputQuantityUnknown) { appStore.navigate(`/fcs/craft/printing/pending-receipts?workOrderId=${encodeURIComponent(workOrderId)}`); return true }
  if (action === 'handover') { appStore.navigate(`/fcs/craft/printing/pending-handover?workOrderId=${encodeURIComponent(workOrderId)}`); return true }
  if (['filter-barcodes','reset-barcode-filters','barcode-page'].includes(action)) {
    const current=getPrintingDialogState()
    if(current)replacePrintingDialog(action==='reset-barcode-filters'?{type:'barcodes',workOrderId}:{...current,barcodePage:action==='barcode-page'?Number(actionNode.dataset.page):1,rollFrom:fieldValue('rollFrom'),rollTo:fieldValue('rollTo'),createdFrom:fieldValue('createdFrom'),createdTo:fieldValue('createdTo')})
    return true
  }
  if(action==='import-barcodes'){replacePrintingDialog({type:'barcode-import',workOrderId});return true}
  if(['copy-barcode','delete-barcodes','outbound-barcodes'].includes(action)) {
    try {
      if(action==='copy-barcode')copyPrintingRollBarcode(workOrderId,actionNode.dataset.barcodeId || '')
      else {const ids=selectedBarcodeIds();if(!ids.length)throw new Error('请先选择卷条码');if(!window.confirm(action==='delete-barcodes'?`确认删除所选 ${ids.length} 个卷条码？`:`确认将 ${ids.length} 卷下架到待出库区？`))return true;action==='delete-barcodes'?deletePrintingRollBarcodes(workOrderId,ids):movePrintingRollsToOutboundArea(workOrderId,ids)}
      replacePrintingDialog({type:'barcodes',workOrderId});refreshVisiblePage();showPrintingToast('卷条码操作已保存')
    }catch(error){showPrintingToast(error instanceof Error?error.message:'操作失败','error')}
    return true
  }
  if (action === 'preview-image') { openImagePreview(actionNode.dataset.imageUrl || '', actionNode.dataset.imageAlt || '业务图片'); return true }
  if (action === 'close-image') { closeImagePreview(); return true }
  if (action === 'close-dialog') { closePrintingDialog(); return true }
  if (action === 'submit-dialog') { submitDialog(); return true }
  if (['logs', 'remarks', 'start-production', 'production-stage', 'edit-info', 'assign', 'change-input', 'receive-input', 'complete', 'handover', 'receive-handover', 'complete-document', 'cancel'].includes(action)) {
    if (workOrderId) openPrintingDialog({ type: action as Parameters<typeof openPrintingDialog>[0]['type'], workOrderId })
    return true
  }
  if (action === 'open-barcodes') { if (workOrderId) openPrintingDialog({ type: 'barcodes', workOrderId }); return true }
  if (action === 'edit-barcode') { if (workOrderId) replacePrintingDialog({ type: 'barcode-edit', workOrderId, barcodeId: actionNode.dataset.barcodeId }); return true }
  if (action === 'add-barcode') {
    if (!workOrderId) return true
    try { addPrintingRollBarcode(workOrderId); replacePrintingDialog({ type: 'barcodes', workOrderId }); refreshVisiblePage(); showPrintingToast('已补充一个草稿卷条码') } catch (error) { showPrintingToast(error instanceof Error ? error.message : '补充条码失败', 'error') }
    return true
  }
  if (action === 'open-barcode-batch-edit') {
    const ids = selectedBarcodeIds()
    if (!ids.length) { showPrintingToast('请选择要批量修改的产出卷条码', 'error'); return true }
    replacePrintingDialog({ type: 'barcode-batch-edit', workOrderId, selectedBarcodeIds: ids }); return true
  }
  if (action === 'batch-print-barcodes' || action === 'print-one-barcode') {
    const ids = action === 'print-one-barcode' ? [actionNode.dataset.barcodeId || ''] : selectedBarcodeIds()
    try { markPrintingRollBarcodesPrinted(workOrderId, ids, 'Web 打印操作员'); navigatePrint('PRINTING_ROLL_LABEL', [workOrderId], ids) } catch (error) { showPrintingToast(error instanceof Error ? error.message : '条码打印失败', 'error') }
    return true
  }
  if (action === 'open-print') {
    try { navigatePrint(actionNode.dataset.documentType as PrintDocumentType, [workOrderId]) } catch (error) { showPrintingToast(error instanceof Error ? error.message : '打印预览失败', 'error') }
    return true
  }
  if (action === 'select-filtered') {
    selectFilteredPrintingWorkOrders()
    return true
  }
  if (action === 'batch-print-confirmation') {
    try { navigatePrint('PRINTING_CONFIRMATION', getSelectedPrintingWorkOrderIds()) } catch (error) { showPrintingToast(error instanceof Error ? error.message : '请选择印花加工单', 'error') }
    return true
  }
  if (action === 'export') { exportCsv(action); return true }
  return false
}

export function handleCraftPrintingEvent(target: HTMLElement): boolean {
  if (handlePrintingWarehouseEvent(target))return true
  if (handlePrintingStatisticsEvent(target) || handlePrintingDashboardsEvent(target)) return true
  if (handlePrintingDispatchEvent(target)) { if(target.closest('[data-printing-dispatch="confirm"]'))refreshVisiblePage();return true }
  if(target.matches('[data-printing-roll-import-file]')) {
    const file=(target as HTMLInputElement).files?.[0]
    if(file) {if(file.size>100000){showPrintingToast('细码文件不能超过 100KB','error');return true}file.text().then(text=>{const input=dialogPanel()?.querySelector<HTMLTextAreaElement>('[data-printing-dialog-field="rollImport"]');if(input)input.value=text.replace(/^\uFEFF/,'')}).catch(()=>showPrintingToast('文件读取失败，请重新选择','error'))}
    return true
  }
  if(target.matches('[data-printing-barcode-select-all]')) {dialogPanel()?.querySelectorAll<HTMLInputElement>('[data-printing-barcode-select]').forEach(input=>{input.checked=(target as HTMLInputElement).checked});updateBarcodeSelectionCount();return true}

  if (handlePrintingWorkOrderListEvent(target)) return true
  if (target.matches('[data-printing-barcode-select]')) { updateBarcodeSelectionCount(); return true }
  const actionNode = target.closest<HTMLElement>('[data-printing-action]')
  if (!actionNode) return false
  return handlePrintingAction(actionNode, actionNode.dataset.printingAction || '')
}
