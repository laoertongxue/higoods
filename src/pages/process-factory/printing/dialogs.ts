import { listPrintingFactoryOptions } from '../../../data/fcs/printing-factories.ts'
import { getPrintingWorkflowFacts } from '../../../data/fcs/printing-task-domain.ts'
import { renderPrintingDemandSource, printingProductionStage, renderPrintingObjectImage } from './presentation.ts'
import { renderPrintingWorkOrderTimes } from './work-order-times.ts'
import { isPrintablePrintingRoll } from '../../../data/fcs/printing-task-domain.ts'
import { printingMaterialCode } from './relations.ts'
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
  | 'remarks'
  | 'start-production'
  | 'production-stage'

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
      <div class="p-5"><div class="mb-4 flex flex-wrap gap-4 border-b pb-3">${input.order.demandSource.type !== 'STOCK' ? `<div class="flex max-w-sm items-center gap-2">${renderPrintingObjectImage(input.order.product)}<div class="text-xs"><p>${escapeHtml(input.order.product.productName)}</p><p>${escapeHtml(input.order.product.spu)}</p></div></div>` : ''}<div class="flex max-w-sm items-center gap-2">${renderPrintingObjectImage(input.order.plannedInput)}<div class="text-xs"><p>${escapeHtml(input.order.plannedInput.materialName)}</p><p>${escapeHtml(printingMaterialCode(input.order.plannedInput.sku))}</p></div></div></div>${input.body}</div>
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
      ${field('加工厂', `<select class="h-9 w-full rounded-md border px-3 text-sm" data-printing-dialog-field="factoryId"><option value="">请选择印花加工厂</option>${listPrintingFactoryOptions().map(factory => `<option value="${escapeHtml(factory.id)}" ${factory.id === order.printFactoryId ? 'selected' : ''}>${escapeHtml(factory.name)}</option>`).join('')}</select>`)}
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

  const href = `/fcs/craft/printing/pending-receipts?workOrderId=${encodeURIComponent(order.workOrderId)}`
  return dialogShell({title:'接收加工投入',order,body:`<p class="text-sm">请在待接收中按来源单逐条扫码、登记实收和库位。</p><a class="mt-4 inline-flex rounded bg-blue-600 px-4 py-2 text-sm text-white" href="${href}" data-nav="${href}">进入待接收</a>`})
}

function renderComplete(order: PrintingWorkOrderBusinessRecord): string {
  const facts = getPrintingWorkflowFacts(order.workOrderId)
  const packageLabel = ['面料', '花边', '织带'].includes(order.output.objectType) ? '卷数' : '包装数'
  return dialogShell({
    title: '填报加工产出', order, confirmLabel: '保存本批产出',
    body: `${renderPrintingDemandSource(order)}<p class="mt-3 rounded-md bg-blue-50 p-3 text-sm text-blue-700">按实际记录填写累计合格产出；打印和转印分别填报。实际卷码在产出后逐卷维护，草稿卷不能直接交出。</p>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        ${field(`累计实际使用（${order.plannedInput.qtyUnit}）`, inputControl('usedQty', order.actualInput.usedQty, { type: 'number', step: '0.01', readonly: true }), '由实际开工领料记录产生')}
        ${field(`累计使用${packageLabel}`, inputControl('usedRollCount', order.actualInput.usedRollCount, { type: 'number', step: '1' }))}
        ${field(`累计合格完成（${order.output.qtyUnit}）`, inputControl('completedQty', order.output.completedQty, { type: 'number', step: '0.01' }), '只填写实际最终产出，不累计正反面或不同工序')}
        ${field(`累计完成${packageLabel}`, inputControl('completedRollCount', order.output.completedRollCount, { type: 'number', step: '1' }))}
        ${field(`本批已核算损耗（${order.plannedInput.qtyUnit}）`, inputControl('lossQty', '', { type: 'number', step: '0.01' }), '只填本次新增核算；未核算留空，确认无损耗填写 0')}
        ${field('打印设备', inputControl('printerNo', order.printerNo))}
      </div><label class="mt-4 flex gap-2 text-sm"><input type="checkbox" data-printing-dialog-field="finishOrder">本单全部加工完成（需所有投入和在制数量核算完成）</label>`,
  })
}

function renderProductionOperation(order: PrintingWorkOrderBusinessRecord, start: boolean): string {
  const facts = getPrintingWorkflowFacts(order.workOrderId)
  const choices = [['ARTWORK:FINISH','确认花型版本'], ['SAMPLE:FINISH','确认样品/米样'], ['PRINT:START','开始打印'], ['PRINT:FINISH','填报打印完成'], ...(facts.requiresTransfer ? [['TRANSFER:START','开始转印'],['TRANSFER:FINISH','填报转印完成']] : [])]
  return dialogShell({ title: start ? '开工领料' : '印花工序记录', order, confirmLabel: start ? '确认开工领料' : '保存工序记录', body: `${renderPrintingDemandSource(order)}<p class="mt-3 text-sm">当前环节：${escapeHtml(printingProductionStage(order))}</p><div class="mt-4 grid gap-4 sm:grid-cols-2">${start ? field(`本次实际领用（${order.plannedInput.qtyUnit}）`, inputControl('productionQty', '', {type:'number',step:'0.01'}), `本厂可用 ${formatPrintingQty(facts.availableInputQty)} ${order.plannedInput.qtyUnit}`) : field('本次动作', `<select class="h-9 w-full rounded border px-2" data-printing-dialog-field="productionAction">${choices.map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}</select>`) }
  ${!start ? field(`本工序累计完成（${order.output.qtyUnit}）`, inputControl('productionQty', '', {type:'number',step:'0.01'}), '仅打印/转印完成时填写；开始和确认花型/样品无需数量') : ''}${field('操作人',inputControl('productionOperator','印花执行员'))}</div><p class="mt-4 text-xs text-slate-500">每次保存保留操作人和时间；已有接收、其他工序和交接事实不会被覆盖。</p>` })
}

function renderEditInformation(order: PrintingWorkOrderBusinessRecord): string {
  const facts = getPrintingWorkflowFacts(order.workOrderId)
  const blocker = order.processingStatus === 'CANCELLED' || order.processingStatus === 'PROCESS_COMPLETED' ? '本单已结束，不能变更印花要求。'
    : order.historicalInputQuantityUnknown ? '历史投入未核实，请先补齐历史实际投入。'
    : facts.inProcessQty > 0.001 ? `本批还有 ${formatPrintingQty(facts.inProcessQty)} ${order.plannedInput.qtyUnit} 在制或未核算数量，请先完成本批核算。`
    : order.barcodes.some(roll => roll.quantityConfirmed === false || roll.lengthY <= 0) || order.barcodes.reduce((sum, roll) => sum + roll.lengthY, 0) < order.output.completedQty - 0.01 ? '存在尚未测量的产出卷，请先在产出卷条码中补齐实际数量。' : ''
  const locked = Boolean(blocker)
  const pattern = (label: string, prefix: string, value: PrintingWorkOrderBusinessRecord['requirement']['frontPattern'] | undefined) => `<fieldset class="rounded-lg border p-3"><legend class="px-1 text-sm font-semibold">${label}</legend>${value ? `<div class="mb-3 flex items-center gap-2">${renderPrintingObjectImage(value)}<span class="text-xs">${escapeHtml(value.patternName)} · ${escapeHtml(value.patternNo)}</span></div>` : ''}<div class="grid gap-3 sm:grid-cols-2">${field('花型编号',inputControl(`${prefix}No`,value?.patternNo || '',{readonly:locked}))}${field('版本',inputControl(`${prefix}Version`,value?.patternVersion || '',{readonly:locked}))}${field('花型名称',inputControl(`${prefix}Name`,value?.patternName || '',{readonly:locked}))}${field('正式图片地址',inputControl(`${prefix}Image`,value?.imageUrl || '',{readonly:locked}))}</div></fieldset>`
  return dialogShell({title:'编辑印花信息',order,confirmLabel:'保存',wide:true,body:`${renderPrintingDemandSource(order)}<div class="my-4 grid gap-2 rounded-lg border bg-slate-50 p-3 text-sm sm:grid-cols-3"><p>加工厂：${escapeHtml(order.printFactoryName)}</p><p>任务单：${escapeHtml(order.taskNo)}</p><p>本厂实收：${order.historicalInputQuantityUnknown ? '历史未记录' : formatPrintingQty(order.actualInput.receivedQty)} ${escapeHtml(order.plannedInput.qtyUnit)}</p><p>实际使用：${formatPrintingQty(order.actualInput.usedQty)} ${escapeHtml(order.plannedInput.qtyUnit)}</p><p>合格完成：${formatPrintingQty(order.output.completedQty)} ${escapeHtml(order.output.qtyUnit)}</p><p>实际交出：${formatPrintingQty(order.handover.handedOverQty)} ${escapeHtml(order.output.qtyUnit)}</p></div><div class="grid gap-4 sm:grid-cols-3">${field('工艺名称',inputControl('craftName',order.requirement.craftName,{readonly:locked}))}${field('加工方式',inputControl('craftType',order.requirement.type,{readonly:locked}))}${field('印花面别',`<select class="h-9 w-full rounded border px-2" data-printing-dialog-field="printSide" ${locked ? 'disabled' : ''}><option ${order.requirement.printSide === '单面' ? 'selected' : ''}>单面</option><option ${order.requirement.printSide === '双面' ? 'selected' : ''}>双面</option></select>`)}${field('深浅',inputControl('shade',order.requirement.shade,{readonly:locked}))}${field('适用温度',inputControl('temperature',order.requirement.temperature,{readonly:locked}))}${field('打印设备',inputControl('printerNo',order.printerNo))}${field('计划完成时间',inputControl('plannedFinishAt',order.plannedFinishAt?.replace(' ','T')||'',{type:'datetime-local',step:'1'}))}</div><div class="mt-4 space-y-3">${pattern('正面花型','frontPattern',order.requirement.frontPattern)}${pattern('反面花型（双面时必填）','insidePattern',order.requirement.insidePattern)}</div><div class="mt-3 rounded border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800"><p>当前印花要求版本：V${order.requirementVersion || 1}</p><p>变更影响范围：后续未开工批次</p><p>已完成批次保留原花型与版本；新版本需重新确认花型和打样。</p></div>${blocker ? `<p class="mt-2 text-sm text-amber-700">${escapeHtml(blocker)}</p>` : ''}${field('修改原因',inputControl('changeReason',''),'变更工艺、面别或花型时必填；已有批次不会被覆盖')}<label class="mt-4 block text-sm">备注<textarea data-printing-dialog-field="infoRemark" class="mt-1 min-h-24 w-full rounded border p-3">${escapeHtml(order.remark)}</textarea></label><details class="mt-4"><summary class="cursor-pointer text-sm text-blue-700">查看实际时间（只读）</summary>${renderPrintingWorkOrderTimes(order)}</details>`})
}

function renderHandover(order: PrintingWorkOrderBusinessRecord): string {
  const href = `/fcs/craft/printing/pending-handover?workOrderId=${encodeURIComponent(order.workOrderId)}`
  return dialogShell({title:'交出加工产出',order,body:`<p class="text-sm">请在待交出列表按实际产出卷创建单据，再完成扫码交接。</p><a class="mt-4 inline-flex rounded bg-blue-600 px-4 py-2 text-sm text-white" href="${href}" data-nav="${href}">进入待交出列表</a>`})
}

function renderReceiveHandover(order: PrintingWorkOrderBusinessRecord): string {
  const pending = Math.max(0, order.handover.handedOverQty - order.handover.receivedQty)
  const qtyUnit = escapeHtml(order.output.qtyUnit)
  return dialogShell({
    title: '接收加工产出', order, confirmLabel: '确认接收',
    body: `<div class="rounded-lg border bg-slate-50 p-4 text-sm"><p>交出单：${escapeHtml(order.handover.handoverNo || '未生成')}</p><p class="mt-1">累计交出 ${formatPrintingQty(order.handover.handedOverQty)} ${qtyUnit} · 已接收 ${formatPrintingQty(order.handover.receivedQty)} ${qtyUnit} · 待接收 ${formatPrintingQty(pending)} ${qtyUnit}</p></div>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        ${field(`本次实收（${qtyUnit}）`, inputControl('receiveQty', pending.toFixed(2), { type: 'number', step: '0.01' }))}
        ${field('接收人', inputControl('outputReceiver', order.handover.receivedBy || ''))}
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
    body: `<div class="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">下游已经全部接收且无差异。此动作由现场负责人确认本加工单结束，不会因下游接收自动触发。</div><div class="mt-4">${field('完成人', inputControl('documentCompleter', '', { placeholder: '请填写实际完成人姓名' }))}</div>`,
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
      ${field('重量（KG）', inputControl('weightKg', formatPrintingWeightKg(barcode.weightKg), { type: 'number', step: '0.001' }), 'KG 固定保留 3 位小数；按规格换算的重量不代表实称')}<label class="flex items-center gap-2 text-sm"><input type="checkbox" data-printing-dialog-field="weightMeasured" ${barcode.weightSource==='ACTUAL'?'checked':''}>重量为现场称重值</label>
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
  if (currentDialog.type === 'edit-info') return renderEditInformation(order)
  if (currentDialog.type === 'remarks') return dialogShell({ title:'加工单备注', order, body:`${renderPrintingDemandSource(order)}<p class="mt-4 whitespace-pre-wrap text-sm">${escapeHtml(order.remark || '暂无备注，可在编辑信息中填写')}</p>` })
  if (currentDialog.type === 'start-production' || currentDialog.type === 'production-stage') return renderProductionOperation(order, currentDialog.type === 'start-production')
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
