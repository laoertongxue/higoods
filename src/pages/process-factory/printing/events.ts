import {
  addPrintingRollBarcode,
  assignPrintingWorkOrder,
  batchUpdatePrintingRollBarcodes,
  cancelPrintingWorkOrder,
  changePrintingInput,
  completePrintingWorkOrder,
  getPrintingWorkOrderById,
  handoverPrintingOutput,
  markPrintingRollBarcodesPrinted,
  receivePrintingHandover,
  receivePrintingInput,
  recordPrintingDocumentAction,
  updatePrintingRollBarcode,
  type PrintingDocumentHistory,
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
  document.querySelectorAll<HTMLElement>('[data-printing-barcode-selected-count]').forEach((node) => { node.textContent = `已选 ${count}` })
}

function submitDialog(): void {
  const dialog = getPrintingDialogState()
  if (!dialog) return
  try {
    if (dialog.type === 'assign') {
      assignPrintingWorkOrder(dialog.workOrderId, { factoryId: fieldValue('factoryId'), factoryName: fieldValue('factoryName'), operatorName: '生产计划员' })
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
      receivePrintingInput(dialog.workOrderId, { actualSku: fieldValue('actualSku'), receivedQty: numberValue('receivedQty'), receivedRollCount: numberValue('receivedRollCount'), receiverName: fieldValue('receiverName') })
      showPrintingToast('加工投入已接收，加工状态进入“加工中”')
    } else if (dialog.type === 'complete') {
      completePrintingWorkOrder(dialog.workOrderId, { usedQty: numberValue('usedQty'), usedRollCount: numberValue('usedRollCount'), completedQty: numberValue('completedQty'), completedRollCount: numberValue('completedRollCount'), printerNo: fieldValue('printerNo'), operatorName: '印花执行员' })
      showPrintingToast('加工完成事实已保存，交出状态进入“待交出”')
    } else if (dialog.type === 'handover') {
      handoverPrintingOutput(dialog.workOrderId, { qty: numberValue('handoverQty'), barcodeIds: selectedBarcodeIds(), operatorName: fieldValue('handoverOperator') || '印花交出员', receiverName: fieldValue('handoverReceiver') })
      showPrintingToast('加工产出已交出，等待下游接收')
    } else if (dialog.type === 'receive-handover') {
      receivePrintingHandover(dialog.workOrderId, { receivedQty: numberValue('receiveQty'), receiverName: fieldValue('outputReceiver'), objectionQty: numberValue('objectionQty'), differenceReason: fieldValue('differenceReason') })
      showPrintingToast('下游接收事实已保存')
    } else if (dialog.type === 'cancel') {
      cancelPrintingWorkOrder(dialog.workOrderId, { operatorName: '印花主管', reason: fieldValue('cancelReason') })
      showPrintingToast('印花加工单已取消')
    } else if (dialog.type === 'barcode-edit') {
      if (!dialog.barcodeId) throw new Error('未选择卷条码')
      const lengthY = numberValue('lengthY'); const meters = numberValue('meters'); const weightKg = numberValue('weightKg')
      updatePrintingRollBarcode(dialog.workOrderId, dialog.barcodeId, {
        lengthY: lengthY > 0 ? lengthY : undefined, meters: meters > 0 ? meters : undefined, weightKg: weightKg > 0 ? weightKg : undefined,
        gsm: numberValue('gsm'), widthCm: numberValue('widthCm'), vatNo: fieldValue('vatNo'), warehouseName: fieldValue('warehouseName'), remark: fieldValue('barcodeRemark'),
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

function documentHistoryName(documentType: string): PrintingDocumentHistory['documentName'] {
  return documentType === 'PRINTING_INFO_SHEET' ? '印花信息单' : documentType === 'PRINTING_CONFIRMATION' ? '印花确认单' : '加工产出卷条码'
}

function navigatePrint(documentType: PrintDocumentType, workOrderIds: string[], barcodeIds: string[] = []): void {
  if (!workOrderIds.length) throw new Error('请选择印花加工单')
  workOrderIds.forEach((workOrderId) => recordPrintingDocumentAction(workOrderId, { documentName: documentHistoryName(documentType), action: '打印', operatorName: 'Web 打印操作员', remark: workOrderIds.length > 1 ? `批量 ${workOrderIds.length} 张` : undefined }))
  const sourceId = documentType === 'PRINTING_ROLL_LABEL'
    ? `${workOrderIds[0]}:${barcodeIds.join(',')}`
    : workOrderIds.join(',')
  appStore.navigate(buildUnifiedPrintPreviewLink({ documentType, sourceType: documentType === 'PRINTING_ROLL_LABEL' ? 'PRINTING_ROLL_RECORD' : 'PRINTING_WORK_ORDER', sourceId }))
}

function exportCsv(): void {
  const rows = getFilteredPrintingWorkOrders()
  const headers = ['印花单', '任务单', '需求来源', '来源单号', '商品SPU', '计划投入SKU', '实际投入SKU', '产出SKU', '标准单位用量', '加工单单位用量', '计划投入(Yard)', '实际接收(Yard)', '实际使用(Yard)', '完成(Yard)', '加工状态', '交出状态', '已交出(Yard)', '已接收(Yard)', '差异(Yard)', '异议数', '历史损耗(Yard)']
  const values = rows.map((row) => [row.printOrderNo, row.taskNo, row.demandSource.type, row.demandSource.sourceNo, row.product.spu, row.plannedInput.sku, row.actualInput.actualSku, row.output.sku, row.usage.standardUnitUsage ?? '', row.usage.orderUnitUsage ?? '', row.plannedInput.plannedQty, row.actualInput.receivedQty, row.actualInput.usedQty, row.output.completedQty, row.processingStatus, row.handoverStatus, row.handover.handedOverQty, row.handover.receivedQty, row.handover.diffQty, row.handover.objectionQty, row.historicalLossQty])
  const csv = [headers, ...values].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a'); link.href = url; link.download = '印花加工单.csv'; link.click(); URL.revokeObjectURL(url)
  showPrintingToast(`已导出 ${rows.length} 张印花加工单`)
}

function handlePrintingAction(actionNode: HTMLElement, action: string): boolean {
  const workOrderId = actionNode.dataset.workOrderId || document.querySelector<HTMLElement>('[data-printing-work-order-detail-root]')?.dataset.workOrderId || getPrintingDialogState()?.workOrderId || ''
  if (action === 'preview-image') { openImagePreview(actionNode.dataset.imageUrl || '', actionNode.dataset.imageAlt || '业务图片'); return true }
  if (action === 'close-image') { closeImagePreview(); return true }
  if (action === 'close-dialog') { closePrintingDialog(); return true }
  if (action === 'submit-dialog') { submitDialog(); return true }
  if (['assign', 'change-input', 'receive-input', 'complete', 'handover', 'receive-handover', 'cancel'].includes(action)) {
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
  if (action === 'export') { exportCsv(); return true }
  return false
}

export function handleCraftPrintingEvent(target: HTMLElement): boolean {
  if (handlePrintingWorkOrderListEvent(target)) return true
  if (target.matches('[data-printing-barcode-select]')) { updateBarcodeSelectionCount(); return true }
  const actionNode = target.closest<HTMLElement>('[data-printing-action]')
  if (!actionNode) return false
  return handlePrintingAction(actionNode, actionNode.dataset.printingAction || '')
}
