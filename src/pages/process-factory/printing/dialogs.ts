import { isPrintablePrintingRoll } from '../../../data/fcs/printing-task-domain.ts'
import { printingMaterialCode } from './relations.ts'
import { getPrintingMaterialReceiptOptions } from '../../../data/fcs/printing-material-receipts.ts'
import {
  formatPrintingQty,
  formatPrintingUsage,
  formatPrintingWeightKg,
  getPrintingWorkOrderById,
  type PrintingRollBarcode,
  type PrintingWorkOrderBusinessRecord,
} from '../../../data/fcs/printing-work-order-business.ts'
import { escapeHtml } from '../../../utils.ts'

export type PrintingDialogType =
  | 'assign'
  | 'change-input'
  | 'receive-input'
  | 'complete'
  | 'handover'
  | 'receive-handover'
  | 'complete-document'
  | 'cancel'
  | 'barcodes'
  | 'barcode-edit'
  | 'barcode-batch-edit'
  | 'barcode-import'
  | 'logs'
  | 'edit-info'

export interface PrintingDialogState {
  type: PrintingDialogType
  workOrderId: string
  receiptId?: string
  barcodeId?: string
  selectedBarcodeIds?: string[]
  barcodePage?: number
  rollFrom?: string
  rollTo?: string
  createdFrom?: string
  createdTo?: string
}

let currentDialog: PrintingDialogState | null = null
let escapeListenerInstalled=false

export function getPrintingDialogState(): PrintingDialogState | null {
  return currentDialog ? structuredClone(currentDialog) : null
}

export function openPrintingDialog(state: PrintingDialogState): void {
  if(!escapeListenerInstalled && typeof document!=='undefined'){document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('[data-printing-image-preview]'))closePrintingDialog()});escapeListenerInstalled=true}
  currentDialog = { ...structuredClone(state), receiptId: state.receiptId || `PRINT-RECEIPT-${Date.now()}-${Math.random().toString(36).slice(2)}` }
  refreshPrintingDialogSurface()
}

export function closePrintingDialog(): void {
  currentDialog = null
  refreshPrintingDialogSurface()
}

export function replacePrintingDialog(state: PrintingDialogState): void {
  currentDialog = structuredClone(state)
  refreshPrintingDialogSurface()
}

function field(label: string, control: string, helper = ''): string {
  return `<label class="block"><span class="mb-1 block text-xs font-medium text-slate-600">${escapeHtml(label)}</span>${control}${helper ? `<span class="mt-1 block text-xs text-slate-500">${escapeHtml(helper)}</span>` : ''}</label>`
}

function inputControl(name: string, value: string | number, options: { type?: string; step?: string; readonly?: boolean; placeholder?: string } = {}): string {
  return `<input class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:bg-slate-50" data-printing-dialog-field="${escapeHtml(name)}" type="${escapeHtml(options.type || 'text')}" value="${escapeHtml(value)}" ${options.step ? `step="${escapeHtml(options.step)}"` : ''} ${options.readonly ? 'readonly' : ''} placeholder="${escapeHtml(options.placeholder || '')}">`
}

function dialogShell(input: { title: string; order: PrintingWorkOrderBusinessRecord; body: string; confirmLabel?: string; wide?: boolean; footerExtra?: string }): string {
  return `<div class="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="${escapeHtml(input.title)}">
    <button type="button" class="absolute inset-0 bg-slate-950/55" data-printing-action="close-dialog" aria-label="关闭弹窗"></button>
    <section class="relative z-10 max-h-[92vh] w-full ${input.wide ? 'max-w-6xl' : 'max-w-2xl'} overflow-auto rounded-xl bg-white shadow-2xl" data-printing-dialog-panel data-skip-page-rerender="true">
      <header class="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white px-5 py-4">
        <div><h2 class="text-lg font-semibold">${escapeHtml(input.title)}</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(input.order.printOrderNo)} · ${escapeHtml(input.order.output.sku)}</p></div>
        <button type="button" class="rounded-md border px-3 py-1.5 text-sm" data-printing-action="close-dialog">关闭</button>
      </header>
      <div class="p-5">${input.body}</div>
      <footer class="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t bg-white px-5 py-4">
        ${input.footerExtra || ''}
        <button type="button" class="rounded-md border px-4 py-2 text-sm" data-printing-action="close-dialog">取消</button>
        ${input.confirmLabel ? `<button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white" data-printing-action="submit-dialog">${escapeHtml(input.confirmLabel)}</button>` : ''}
      </footer>
    </section>
  </div>`
}

function renderAssign(order: PrintingWorkOrderBusinessRecord): string {
  return dialogShell({
    title: '分配印花加工厂', order, confirmLabel: '确认分配',
    body: `<div class="grid gap-4 sm:grid-cols-2">
      ${field('加工厂编码', inputControl('factoryId', order.printFactoryId || 'F090'))}
      ${field('加工厂', inputControl('factoryName', order.printFactoryName || 'FLOWER 印花厂'))}
    </div><p class="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-700">分配后加工状态进入“待接收投入”；交出状态仍为“未开始”。</p>`,
  })
}

function renderChangeInput(order: PrintingWorkOrderBusinessRecord): string {
  const usageRequired = order.usage.calculationMode === 'BY_USAGE'
  const objectType = escapeHtml(order.plannedInput.objectType)
  const qtyUnit = escapeHtml(order.plannedInput.qtyUnit)
  const showFabricSpecification = ['面料', '花边', '织带'].includes(order.plannedInput.objectType)
  return dialogShell({
    title: '调整加工投入', order, confirmLabel: '确认调整',
    body: `<div class="rounded-lg border bg-slate-50 p-4 text-sm">
      <p class="font-medium">当前计划投入：[${objectType}] ${escapeHtml(order.plannedInput.materialName)}</p>
      <p class="mt-1 font-mono text-xs">${escapeHtml(order.plannedInput.sku)}</p>
      <p class="mt-2 text-xs text-slate-600">标准单位用量 ${formatPrintingUsage(order.usage.standardUnitUsage)} · 加工单单位用量 ${formatPrintingUsage(order.usage.orderUnitUsage)} · 计划 ${formatPrintingQty(order.plannedInput.plannedQty)} ${qtyUnit}</p>
    </div>
    <div class="mt-4 grid gap-4 sm:grid-cols-2">
      ${field('对象类型', inputControl('objectType', order.plannedInput.objectType, { readonly: true }))}
      ${field('新投入 SKU', inputControl('newSku', order.plannedInput.sku))}
      ${field(`新${objectType}名称`, inputControl('newMaterialName', order.plannedInput.materialName))}
      ${field(`${objectType}图片`, `<select class="h-9 w-full rounded-md border px-3 text-sm" data-printing-dialog-field="newImageUrl"><option value="">新物料对应图片待补齐</option></select>`)}
      ${showFabricSpecification ? field('克重（g/㎡）', inputControl('newGsm', order.plannedInput.gsm, { type: 'number', step: '0.01' })) : ''}
      ${showFabricSpecification ? field('幅宽（cm）', inputControl('newWidthCm', order.plannedInput.widthCm, { type: 'number', step: '0.01' })) : ''}
      ${field('标准单位用量', inputControl('newStandardUnitUsage', order.usage.standardUnitUsage ?? '', { type: 'number', step: '0.0001' }), usageRequired ? '来自 BOM/技术包的基准，可按新规格确认' : '采购/备货直接数量可不填')}
      ${field('加工单单位用量', inputControl('newOrderUnitUsage', order.usage.orderUnitUsage ?? '', { type: 'number', step: '0.0001' }), usageRequired ? '跨规格换料必须重新填写；计划投入自动重算' : '直接数量模式不使用单位用量')}
      ${field(`直接计划投入（${qtyUnit}）`, inputControl('newPlannedQty', order.plannedInput.plannedQty, { type: 'number', step: '0.01', readonly: usageRequired }), usageRequired ? '按需求基数 × 加工单单位用量重算' : '采购/备货可直接修改')}
      ${field('变更原因', `<textarea class="min-h-20 w-full rounded-md border p-3 text-sm" data-printing-dialog-field="reason" placeholder="必填：现场换料、规格替代等"></textarea>`)}
    </div>
    <div class="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">产出 SKU 固定为 ${escapeHtml(order.output.sku)}，不会随投入变化。调整后印花信息单和印花确认单标记需重印；已产生完成数量时系统会阻断整单换料。</div>`,
  })
}

function renderReceiveInput(order: PrintingWorkOrderBusinessRecord): string {
  if (order.historicalInputQuantityUnknown) return dialogShell({ title: '补录历史累计投入', order, confirmLabel: '确认补录', body: `<div class="rounded bg-amber-50 p-3 text-sm">历史累计投入未记录；本次补录不代表新的上游实物交接，不扣上游可收量。</div><div class="mt-4 grid gap-4 sm:grid-cols-2">${field(`历史累计投入（${escapeHtml(order.plannedInput.qtyUnit)}）`, inputControl('receivedQty', '', {type:'number',step:'0.01'}), `至少已明确使用 ${order.actualInput.usedQty} ${order.plannedInput.qtyUnit}`)}${field('历史累计卷数', inputControl('receivedRollCount', '', {type:'number',step:'1'}))}${order.historicalRollQuantitiesUnknown ? field('历史完成卷数', inputControl('historicalCompletedRollCount', '', {type:'number',step:'1'}), '按历史记录补录，不生成或改写旧条码') : ''}${field('补录原因（必填）', inputControl('historicalReason', ''))}${field('补录人', inputControl('receiverName', 'Hilon'))}</div>` })

  const source = getPrintingMaterialReceiptOptions(order.workOrderId)
  const qtyUnit = escapeHtml(order.plannedInput.qtyUnit)
  const sourceField = source.options.length > 0
    ? field('来源单据', `<select data-printing-dialog-field="upstreamRecordId" class="h-9 w-full rounded border"><option value="">请选择本次接收单据</option>${source.options.map(item => `<option value="${escapeHtml(item.recordId)}" ${source.options.length === 1 ? 'selected' : ''}>${escapeHtml(item.label)} · 可收 ${item.availableQty} ${escapeHtml(item.unit)}</option>`).join('')}</select>`)
    : `<div class="sm:col-span-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">${escapeHtml(source.blockReason || '来源单据尚未到位。')}</div>`
  return dialogShell({
    title: '接收加工投入', order, confirmLabel: source.options.length > 0 ? '确认接收' : undefined,
    body: `<div class="rounded-lg border bg-slate-50 p-4 text-sm"><p class="font-medium">计划投入：[${escapeHtml(order.plannedInput.objectType)}] ${escapeHtml(order.plannedInput.materialName)}</p><p class="font-mono text-xs">${escapeHtml(order.plannedInput.sku)}</p><p class="mt-2 text-xs text-slate-600">计划 ${formatPrintingQty(order.plannedInput.plannedQty)} ${qtyUnit}；已接收 ${formatPrintingQty(order.actualInput.receivedQty)} ${qtyUnit} / ${order.actualInput.receivedRollCount} 卷</p></div>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        ${sourceField}
        ${field('实际投入 SKU', inputControl('actualSku', order.plannedInput.sku), '如与计划不同，请先调整加工投入')}
        ${field(`本次接收数量（${qtyUnit}）`, inputControl('receivedQty', Math.max(0, order.plannedInput.plannedQty - order.actualInput.receivedQty).toFixed(2), { type: 'number', step: '0.01' }))}
        ${field('本次接收卷数', inputControl('receivedRollCount', 1, { type: 'number', step: '1' }))}
        ${field('接收人', inputControl('receiverName', 'Hilon'))}
      </div>`,
  })
}

function renderComplete(order: PrintingWorkOrderBusinessRecord): string {
  const inputUnit = escapeHtml(order.plannedInput.qtyUnit)
  const outputUnit = escapeHtml(order.output.qtyUnit)
  return dialogShell({
    title: '填报加工完成', order, confirmLabel: '确认加工完成',
    body: `<div class="rounded-md bg-blue-50 p-3 text-sm text-blue-700">填写截至本次的累计使用和累计完成数量；系统只新增本批产出卷，保留此前交出与入库记录。</div>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        ${field(`累计实际使用（${inputUnit}）`, inputControl('usedQty', order.actualInput.receivedQty.toFixed(2), { type: 'number', step: '0.01' }), `不得超过已接收 ${formatPrintingQty(order.actualInput.receivedQty)} ${inputUnit}`)}
        ${field('累计实际使用卷数', inputControl('usedRollCount', Math.max(order.actualInput.receivedRollCount, 1), { type: 'number', step: '1' }))}
        ${field(`累计完成数量（${outputUnit}）`, inputControl('completedQty', order.actualInput.receivedQty.toFixed(2), { type: 'number', step: '0.01' }), '不得超过实际使用数量')}
        ${field('累计完成卷数', inputControl('completedRollCount', Math.max(order.actualInput.receivedRollCount, 1), { type: 'number', step: '1' }))}
        ${field('打印机', inputControl('printerNo', order.printerNo === '未分配' ? 'PR-01' : order.printerNo))}
      </div>`,
  })
}

function renderHandover(order: PrintingWorkOrderBusinessRecord): string {
  const remaining = Math.max(0, order.output.completedQty - order.handover.handedOverQty)
  const qtyUnit = escapeHtml(order.output.qtyUnit)
  return dialogShell({
    title: '交出加工产出', order, confirmLabel: '确认交出', wide: true,
    body: `<div class="grid gap-3 sm:grid-cols-3">
      ${field(`本次交出数量（${qtyUnit}）`, inputControl('handoverQty', remaining.toFixed(2), { type: 'number', step: '0.01' }), `剩余可交 ${formatPrintingQty(remaining)} ${qtyUnit}`)}
      ${field('交出人', inputControl('handoverOperator', '印花交出员'))}
      ${field('下游接收人', inputControl('handoverReceiver', order.handover.receiverName === '未指定' ? '下游接收人' : order.handover.receiverName))}
    </div>
    <div class="mt-5 overflow-x-auto rounded-lg border"><table class="min-w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="p-3">选择</th><th class="p-3">条码</th><th class="p-3">产出 SKU</th><th class="p-3">卷号</th><th class="p-3">数量(${qtyUnit})</th><th class="p-3">重量(KG)</th><th class="p-3">状态</th></tr></thead><tbody>${order.barcodes.map((barcode) => `<tr class="border-t"><td class="p-3"><input type="checkbox" data-printing-barcode-select value="${escapeHtml(barcode.id)}" ${barcode.status === '已交出' || barcode.status === '已入库' ? 'disabled' : 'checked'}></td><td class="p-3 font-mono text-xs">${escapeHtml(barcode.barcode)}</td><td class="p-3 font-mono text-xs">${escapeHtml(printingMaterialCode(barcode.sku, true))}</td><td class="p-3">${escapeHtml(barcode.rollNo)}</td><td class="p-3">${formatPrintingQty(barcode.lengthY)}</td><td class="p-3">${formatPrintingWeightKg(barcode.weightKg)}</td><td class="p-3">${escapeHtml(barcode.status)}</td></tr>`).join('')}</tbody></table></div>`,
  })
}

function renderReceiveHandover(order: PrintingWorkOrderBusinessRecord): string {
  const pending = Math.max(0, order.handover.handedOverQty - order.handover.receivedQty)
  const qtyUnit = escapeHtml(order.output.qtyUnit)
  return dialogShell({
    title: '接收加工产出', order, confirmLabel: '确认接收',
    body: `<div class="rounded-lg border bg-slate-50 p-4 text-sm"><p>交出单：${escapeHtml(order.handover.handoverNo || '未生成')}</p><p class="mt-1">累计交出 ${formatPrintingQty(order.handover.handedOverQty)} ${qtyUnit} · 已接收 ${formatPrintingQty(order.handover.receivedQty)} ${qtyUnit} · 待接收 ${formatPrintingQty(pending)} ${qtyUnit}</p></div>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        ${field(`本次实收（${qtyUnit}）`, inputControl('receiveQty', pending.toFixed(2), { type: 'number', step: '0.01' }))}
        ${field('接收人', inputControl('outputReceiver', order.handover.receiverName === '未指定' ? '下游接收人' : order.handover.receiverName))}
        ${field('异议数量', inputControl('objectionQty', 0, { type: 'number', step: '1' }), '异议是独立事实，不改加工完成状态')}
        ${field('差异/异议说明', `<textarea class="min-h-20 w-full rounded-md border p-3 text-sm" data-printing-dialog-field="differenceReason" placeholder="无差异可不填"></textarea>`)}
      </div>`,
  })
}

function renderCancel(order: PrintingWorkOrderBusinessRecord): string {
  return dialogShell({
    title: '取消印花加工单', order, confirmLabel: '确认取消',
    body: `<div class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">取消是主管动作。已有完成数量或交出事实时不可直接取消。</div><div class="mt-4">${field('取消原因', `<textarea class="min-h-24 w-full rounded-md border p-3 text-sm" data-printing-dialog-field="cancelReason" placeholder="必填"></textarea>`)}</div>`,
  })
}

function renderCompleteDocument(order: PrintingWorkOrderBusinessRecord): string {
  return dialogShell({
    title: '人工完成印花加工单', order, confirmLabel: '确认完成单据',
    body: `<div class="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">下游已经全部接收且无差异。此动作由现场负责人确认本加工单结束，不会因下游接收自动触发。</div><div class="mt-4">${field('完成人', inputControl('documentCompleter', '印花主管'))}</div>`,
  })
}

function barcodeRows(order: PrintingWorkOrderBusinessRecord, rolls = order.barcodes): string {
  const showFabricSpecification = ['面料', '花边', '织带'].includes(order.output.objectType)
  return rolls.map((barcode) => `<tr class="border-t">
    <td class="p-2"><input type="checkbox" data-printing-barcode-select value="${escapeHtml(barcode.id)}"></td>
    <td class="p-2">${escapeHtml(barcode.id)}</td><td class="p-2 font-mono text-xs">${escapeHtml(barcode.barcode)}</td>
    <td class="p-2"><p>${escapeHtml(barcode.printOrderNo)}</p><p class="text-xs text-slate-500">印花单</p></td>
    <td class="p-2 font-mono text-xs">${escapeHtml(printingMaterialCode(barcode.sku, true))}</td><td class="p-2">${escapeHtml(barcode.status)}${barcode.outboundArea ? `<br>${escapeHtml(barcode.outboundArea)}` : ''}</td><td class="p-2">${escapeHtml(barcode.rollNo)}</td>
    <td class="p-2 text-right">${formatPrintingQty(barcode.lengthY)}</td><td class="p-2 text-right">${formatPrintingWeightKg(barcode.weightKg)}</td><td class="p-2 text-right">${showFabricSpecification ? barcode.gsm.toFixed(2) : '—'}</td><td class="p-2 text-right">${showFabricSpecification ? barcode.widthCm : '—'}</td>
    <td class="p-2"><p>${escapeHtml(barcode.warehouseName)}</p><p class="text-xs ${barcode.inboundStatus === '待上架' ? 'text-amber-600' : 'text-green-600'}">${escapeHtml(barcode.inboundStatus)}</p></td>
    <td class="p-2 text-xs">${escapeHtml(barcode.inboundAt || '—')}<br><span class="text-slate-500">创建：${escapeHtml(barcode.createdAt || '历史未记录')}</span></td><td class="p-2 text-xs">${escapeHtml(barcode.printedBy || '—')}<br>${escapeHtml(barcode.printedAt || '—')}</td>
    <td class="sticky right-0 bg-white p-2"><div class="flex gap-1"><button class="rounded border px-2 py-1 text-xs" data-printing-action="edit-barcode" data-barcode-id="${escapeHtml(barcode.id)}">编辑</button><button class="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-700" ${isPrintablePrintingRoll(order, barcode) ? '' : 'disabled title="草稿或超出完成数量，不能打印"'} data-printing-action="print-one-barcode" data-barcode-id="${escapeHtml(barcode.id)}">打印条码</button><button class="rounded border px-2 py-1 text-xs" data-printing-action="copy-barcode" data-barcode-id="${escapeHtml(barcode.id)}" title="复制规格并新增草稿卷">复制新增</button></div></td>
  </tr>`).join('')
}

function renderBarcodes(order: PrintingWorkOrderBusinessRecord): string {
  const filters = currentDialog || { type: 'barcodes', workOrderId: order.workOrderId }
  const rolls = order.barcodes.filter(roll => (!filters.rollFrom || Number(roll.rollNo) >= Number(filters.rollFrom)) && (!filters.rollTo || Number(roll.rollNo) <= Number(filters.rollTo)) && (!filters.createdFrom || !!roll.createdAt && roll.createdAt.slice(0,10) >= filters.createdFrom) && (!filters.createdTo || !!roll.createdAt && roll.createdAt.slice(0,10) <= filters.createdTo))
  const totalPages = Math.max(1, Math.ceil(rolls.length / 20))
  const page = Math.max(1, Math.min(filters.barcodePage || 1, totalPages))
  return dialogShell({
    title: '加工产出卷条码', order, wide: true,
    body: `<div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">${field('卷码起',inputControl('rollFrom',filters.rollFrom || '',{type:'number'}))}${field('卷码止',inputControl('rollTo',filters.rollTo || '',{type:'number'}))}${field('创建时间起',inputControl('createdFrom',filters.createdFrom || '',{type:'date'}))}${field('创建时间止',inputControl('createdTo',filters.createdTo || '',{type:'date'}))}</div><div class="mb-3 flex gap-2"><button class="rounded border px-3 py-2 text-sm" data-printing-action="filter-barcodes">查询</button><button class="rounded border px-3 py-2 text-sm" data-printing-action="reset-barcode-filters">重置</button></div><div class="mb-4 flex flex-wrap items-center justify-between gap-3"><div class="flex flex-wrap gap-2"><button class="rounded bg-blue-600 px-3 py-2 text-sm text-white" data-printing-action="open-barcode-batch-edit">批量修改</button><button class="rounded bg-amber-500 px-3 py-2 text-sm text-white" ${order.barcodes.some(barcode => isPrintablePrintingRoll(order, barcode)) ? '' : 'disabled'} data-printing-action="batch-print-barcodes">批量打印</button><button class="rounded bg-emerald-600 px-3 py-2 text-sm text-white" data-printing-action="add-barcode">补充条码</button><button class="rounded border px-3 py-2 text-sm text-red-700" data-printing-action="delete-barcodes">批量删除</button><button class="rounded border px-3 py-2 text-sm" data-printing-action="import-barcodes">导入细码</button><button class="rounded border px-3 py-2 text-sm" data-printing-action="outbound-barcodes">批量下架到待出库区</button><span class="self-center text-xs text-slate-500" data-printing-barcode-selected-count>已选 0</span></div><p class="text-xs text-slate-500">草稿可维护；仅已完成、正数量且总量不超过完成量的卷可打印</p></div>
      <div class="max-w-full overflow-x-auto rounded-lg border"><table class="min-w-[1680px] text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="p-2"><input type="checkbox" aria-label="全选本页条码" data-printing-barcode-select-all></th><th class="p-2">ID</th><th class="p-2">条码</th><th class="p-2">关联单号</th><th class="p-2">SKU</th><th class="p-2">状态</th><th class="p-2">卷号</th><th class="p-2">数量(${escapeHtml(order.output.qtyUnit)})</th><th class="p-2">重量(KG)</th><th class="p-2">克重</th><th class="p-2">幅宽</th><th class="p-2">入库仓库/状态</th><th class="p-2">入库时间</th><th class="p-2">打印人/时间</th><th class="sticky right-0 bg-slate-50 p-2">操作</th></tr></thead><tbody>${barcodeRows(order, rolls.slice((page - 1) * 20, page * 20)) || '<tr><td colspan="15" class="p-4">暂无匹配的卷条码</td></tr>'}</tbody></table></div>
      <div class="mt-4 flex flex-wrap items-center justify-end gap-3 text-sm text-slate-600"><span>每页 20 条</span><span>共 ${rolls.length} 条，第 ${page} 页 / 共 ${totalPages} 页</span><button class="rounded border px-2 py-1" data-printing-action="barcode-page" data-page="${page-1}" ${page<=1?'disabled':''}>上一页</button><strong class="rounded bg-blue-600 px-3 py-1 text-white">${page}</strong><button class="rounded border px-2 py-1" data-printing-action="barcode-page" data-page="${page+1}" ${page>=totalPages?'disabled':''}>下一页</button></div>`,
  })
}

function renderBarcodeEdit(order: PrintingWorkOrderBusinessRecord, barcode: PrintingRollBarcode): string {
  const showFabricSpecification = ['面料', '花边', '织带'].includes(order.output.objectType)
  return dialogShell({
    title: '编辑卷属性', order, confirmLabel: '确定',
    body: `<div class="grid gap-4 sm:grid-cols-2">
      ${field('条码', inputControl('barcode', barcode.barcode, { readonly: true }))}
      ${field('产出 SKU', inputControl('barcodeSku', printingMaterialCode(barcode.sku, true), { readonly: true }))}
      ${field(`数量（${escapeHtml(order.output.qtyUnit)}）`, inputControl('lengthY', barcode.lengthY.toFixed(2), { type: 'number', step: '0.01' }), showFabricSpecification ? '填写数量、米数或重量任一项，系统自动换算' : '按本加工单数量单位填写')}
      ${showFabricSpecification ? field('米数（M）', inputControl('meters', barcode.meters.toFixed(2), { type: 'number', step: '0.01' })) : ''}
      ${field('重量（KG）', inputControl('weightKg', formatPrintingWeightKg(barcode.weightKg), { type: 'number', step: '0.001' }), 'KG 固定保留 3 位小数')}
      ${showFabricSpecification ? field('克重（g/㎡）', inputControl('gsm', barcode.gsm.toFixed(2), { type: 'number', step: '0.01' })) : ''}
      ${showFabricSpecification ? field('幅宽（cm）', inputControl('widthCm', barcode.widthCm, { type: 'number', step: '0.01' })) : ''}
      ${field('缸号', inputControl('vatNo', barcode.vatNo))}
      ${field('入库仓库', inputControl('warehouseName', barcode.warehouseName))}
      ${field('备注', `<textarea class="min-h-20 w-full rounded-md border p-3 text-sm" data-printing-dialog-field="barcodeRemark" placeholder="打印时追加到标签末尾">${escapeHtml(barcode.remark || '')}</textarea>`)}
    </div>`,
  })
}

function renderBarcodeBatchEdit(order: PrintingWorkOrderBusinessRecord, barcodeIds: string[]): string {
  const first = order.barcodes.find((barcode) => barcodeIds.includes(barcode.id)) || order.barcodes[0]
  const showFabricSpecification = ['面料', '花边', '织带'].includes(order.output.objectType)
  return dialogShell({
    title: `批量修改卷属性（${barcodeIds.length} 卷）`, order, confirmLabel: '确认批量修改',
    body: `<div class="grid gap-4 sm:grid-cols-2">
      ${showFabricSpecification ? field('克重（g/㎡）', inputControl('batchGsm', first?.gsm.toFixed(2) || order.output.gsm, { type: 'number', step: '0.01' })) : ''}
      ${showFabricSpecification ? field('幅宽（cm）', inputControl('batchWidthCm', first?.widthCm || order.output.widthCm, { type: 'number', step: '0.01' })) : ''}
      ${field('缸号', inputControl('batchVatNo', first?.vatNo || ''))}
      ${field('入库仓库', inputControl('batchWarehouseName', first?.warehouseName || (showFabricSpecification ? 'HILON-面料仓' : 'HILON-物料仓')))}
    </div><p class="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-700">${showFabricSpecification ? '批量更新选中卷的克重、幅宽、缸号和入库仓库；已有长度的卷将按新规格重算重量。' : '批量更新选中物料条码的缸号和入库仓库，不套用面料克重、幅宽规则。'}</p>`,
  })
}

export function renderPrintingDialog(): string {
  if (!currentDialog) return ''
  const order = getPrintingWorkOrderById(currentDialog.workOrderId)
  if (!order) return ''
  if (currentDialog.type === 'logs') return dialogShell({title:'印花操作日志',order,wide:true,body:`<table class="w-full text-left text-sm"><thead><tr><th class="p-2">时间</th><th class="p-2">操作人</th><th class="p-2">操作</th><th class="p-2">说明</th></tr></thead><tbody>${order.operationLogs.map(log=>`<tr class="border-t"><td class="p-2">${escapeHtml(log.operatedAt)}</td><td class="p-2">${escapeHtml(log.operatorName)}</td><td class="p-2">${escapeHtml(log.action)}</td><td class="p-2">${escapeHtml(log.remark)}</td></tr>`).join('')}</tbody></table>`})
  if (currentDialog.type === 'edit-info') return dialogShell({title:'编辑印花信息',order,confirmLabel:'保存',body:`<div class="grid gap-4 sm:grid-cols-2">${field('工艺名称',inputControl('craftName',order.requirement.craftName,{readonly:order.output.completedQty>0}))}${field('类型',inputControl('craftType',order.requirement.type,{readonly:order.output.completedQty>0}))}${field('深浅',inputControl('shade',order.requirement.shade,{readonly:order.output.completedQty>0}))}${field('温度',inputControl('temperature',order.requirement.temperature,{readonly:order.output.completedQty>0}))}${field('打印机',inputControl('printerNo',order.printerNo))}${field('计划交货时间',inputControl('plannedFinishAt',order.plannedFinishAt?.slice(0,16).replace(' ','T')||'',{type:'datetime-local'}))}</div><label class="mt-4 block text-sm">备注<textarea data-printing-dialog-field="infoRemark" class="mt-1 min-h-24 w-full rounded border p-3">${escapeHtml(order.remark)}</textarea></label>`})
  if (currentDialog.type === 'assign') return renderAssign(order)
  if (currentDialog.type === 'change-input') return renderChangeInput(order)
  if (currentDialog.type === 'receive-input') return renderReceiveInput(order)
  if (currentDialog.type === 'complete') return renderComplete(order)
  if (currentDialog.type === 'handover') return renderHandover(order)
  if (currentDialog.type === 'receive-handover') return renderReceiveHandover(order)
  if (currentDialog.type === 'complete-document') return renderCompleteDocument(order)
  if (currentDialog.type === 'cancel') return renderCancel(order)
  if (currentDialog.type === 'barcodes') return renderBarcodes(order)
  if (currentDialog.type === 'barcode-import') return dialogShell({title:'导入细码',order,confirmLabel:'校验并导入',body:`<p class="mb-3 text-sm">每行填写“卷号,数量”，单位为 ${escapeHtml(order.output.qtyUnit)}。请先补充对应草稿卷；全部校验通过后一起保存。</p><textarea class="min-h-48 w-full rounded border p-3 font-mono text-sm" data-printing-dialog-field="rollImport" placeholder="0001,12.50&#10;0002,20.00"></textarea><label class="mt-3 block text-sm">或选择 CSV / TXT 文件<input type="file" accept=".csv,.txt" data-printing-roll-import-file></label>`})
  if (currentDialog.type === 'barcode-edit') {
    const barcode = order.barcodes.find((item) => item.id === currentDialog?.barcodeId)
    return barcode ? renderBarcodeEdit(order, barcode) : renderBarcodes(order)
  }
  if (currentDialog.type === 'barcode-batch-edit') return renderBarcodeBatchEdit(order, currentDialog.selectedBarcodeIds || [])
  return ''
}

export function refreshPrintingDialogSurface(): void {
  if (typeof document === 'undefined') return
  const surface = document.querySelector<HTMLElement>('[data-printing-dialog-surface]')
  if (surface) surface.innerHTML = renderPrintingDialog()
}
