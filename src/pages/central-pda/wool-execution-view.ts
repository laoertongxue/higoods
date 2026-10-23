import type { CentralPdaLanguage } from './frame.ts'
import type { CentralWoolExecution, CentralWoolExecutionLine } from './wool-model.ts'
import type { WoolDomainStore } from '../../data/fcs/wool-domain/store.ts'
import { getWoolProcessReportEffectiveQty } from '../../data/fcs/wool-domain/queries.ts'
import { cb, ce, cn, ct, centralFormalName, centralTime } from './ui.ts'
import { renderWoolHandoverForm, renderWoolHandoverRecords } from './wool-handover-view.ts'
import type { CentralWoolHandoverTarget, CentralWoolReceiptActor } from './wool-handover-model.ts'
import { wt, woolInput, woolPhoto, woolColorName } from './wool-ui.ts'

export const woolGarmentUnit = (language: CentralPdaLanguage) => language === 'zh' ? '件' : 'pcs'
export function woolExecutionIdentity(row: CentralWoolExecution, language: CentralPdaLanguage) {
  const order = row.order, name = centralFormalName(order.styleName, order.styleNo, language)
  return `<section class="my-3 rounded-xl border bg-white p-3"><div class="flex gap-3">${woolPhoto(order.styleImageUrl, name, language)}<div class="min-w-0"><strong class="block break-words">${ce(name)}</strong><p class="mt-1 break-words">${ce(order.woolOrderNo)}</p><p class="mt-1 break-words text-sm">${ce(order.productionOrderNo)}</p></div></div></section>`
}
export function renderWoolExecutionList(rows: CentralWoolExecution[], language: CentralPdaLanguage, limit: number) {
  const unit = woolGarmentUnit(language)
  return rows.slice(0, limit).map(row => `<article class="mb-4" data-wool-execution-order="${ce(row.order.woolOrderId)}">${woolExecutionIdentity(row, language)}<div class="mb-2 grid gap-2">${row.lines.map(line => `<p class="break-words">${ce(line.line.outputSkuCode)} · ${ct(language, 'produced')} ${cn(line.readiness.reportedQty, language)} ${unit}</p>`).join('')}</div>${cb(ct(language, 'detail'), 'wool-execute-open', row.order.woolOrderId)}</article>`).join('')
}
export function renderWoolExecutionDetail(options: {
  row: CentralWoolExecution; line?: CentralWoolExecutionLine; language: CentralPdaLanguage;
  quantity: string; fieldFeedback: string; store: WoolDomainStore; operatorLabel: (name: string,actorId?:string) => string;
  receiptActors?: Map<string,CentralWoolReceiptActor>; controlHtml?: string;
  mode?: 'report'|'handover'|'history'; targets?: CentralWoolHandoverTarget[]; selectedTarget?: CentralWoolHandoverTarget; handoverQuantity?: string; selectedHandover?: string; allBatches?: boolean; openHandoverRecords?: boolean;
}) {
  const { row, line, language, store, operatorLabel } = options, unit = woolGarmentUnit(language)
  const sku = line?.line.outputSkuCode
  const choices = row.lines.length > 1 || !line ? `<div class="my-3 grid grid-cols-2 gap-2">${row.lines.map(item => `<button type="button" class="min-h-12 break-words rounded-xl border p-3 text-left ${item === line ? 'border-blue-600 bg-blue-50 text-blue-700' : 'bg-white'}" data-central-action="wool-execute-sku" data-central-value="${ce(item.line.outputSkuCode)}" aria-pressed="${item === line}"><strong class="block text-xl">${ce(item.line.sizeCode)}</strong><span class="mt-1 block">${ce(woolColorName(item.line.colorName,language))}</span><span class="mt-1 block text-sm">${ce(item.line.outputSkuCode)}</span></button>`).join('')}</div>` : `<p class="my-3 break-words font-bold">${ce(sku || '')}</p>`
  if (!line) return woolExecutionIdentity(row, language) + choices
  const readiness = line.readiness
  const reportable = !row.completed && readiness.canReport && row.actions.includes('REPORT_PROCESS')
  const count = `<dl class="my-3 grid grid-cols-2 gap-3"><div class="rounded-xl border bg-white p-3"><dt>${ct(language, 'produced')}</dt><dd class="mt-1 text-xl font-bold">${cn(readiness.reportedQty, language)} ${unit}</dd></div><div class="rounded-xl border bg-white p-3">${row.completed ? `<strong class="text-green-700">${ct(language, 'closed')}</strong>` : `<dt>${wt(language, 'reportAvailable')}</dt><dd class="mt-1 text-xl font-bold">${cn(reportable ? readiness.remainingReportQty : 0, language)} ${unit}</dd>`}</div></dl>`
  const missing = row.completed ? '' : row.order.stage==='KNITTING' && readiness.missingYarnSkus.length ? `<p class="my-3 break-words">${wt(language, 'reportMissingYarn')} · ${ce(readiness.missingYarnSkus.join(' / '))}</p>` : !line.automatic && (!readiness.isReady || line.issues.length > 0) ? `<p class="my-3">${wt(language, 'reportBlocked')}</p>` : ''
  const input = reportable || options.quantity ? woolInput(line.line.outputSkuCode + ' · ' + wt(language, row.order.kind === 'PART_PANEL' ? 'reportEquivalent' : 'reportQuantityLabel'), options.quantity, 'reportQty',false,!reportable) + `<p class="my-2" data-wool-field-feedback>${ce(options.fieldFeedback)}</p>` + `<div data-wool-report-clear-control${options.quantity ? '' : ' hidden'}>${cb(ct(language, 'clear'), 'wool-report-clear')}</div>` : ''
  const reports = store.processReports.filter(record => record.woolOrderId === row.order.woolOrderId && record.outputSkuCode === sku)
    .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)).map(record => `<div class="mt-3 border-t pt-2"><strong>${cn(getWoolProcessReportEffectiveQty(store, record), language)} ${unit}</strong><p class="mt-1 text-sm">${ce(centralTime(record.reportedAt, language))}</p><p class="break-words text-sm">${wt(language, 'reportWorker')} · ${ce(operatorLabel(record.reportedBy))}</p></div>`).join('')
  const mode=options.mode||'report',targets=options.targets||[],handoverAvailable=targets.some(target=>target.availableQty>0)
  const modeButton=(value:'report'|'handover',label:string)=>`<button type="button" class="min-h-12 break-words rounded-xl border p-3 font-bold ${mode===value?'border-blue-600 bg-blue-50 text-blue-700':'bg-white'}" data-central-action="wool-execute-mode" data-central-value="${value}" aria-pressed="${mode===value}">${ce(label)}</button>`
  const actions=(reportable&&mode!=='report'||handoverAvailable&&mode!=='handover')?`<div class="my-3 grid grid-cols-2 gap-2">${reportable?modeButton('report',wt(language,'reportMode')):''}${handoverAvailable?modeButton('handover',wt(language,'handoverMode')):''}</div>`:''
  const handovers=renderWoolHandoverRecords({row,sku:sku!,store,language,operatorLabel,receiptActors:options.receiptActors,selectedId:mode==='history'?options.selectedHandover:undefined,allBatches:options.allBatches,forceOpen:mode==='history'||options.openHandoverRecords})
  const actionContent=mode==='handover'?renderWoolHandoverForm({row,targets,selected:options.selectedTarget,language,quantity:options.handoverQuantity||'',fieldFeedback:options.fieldFeedback}):mode==='history'?'':count+missing+input
  return woolExecutionIdentity(row, language) + choices + `<p class="my-2 break-words">${wt(language,'color')} · ${ce(woolColorName(line.line.colorName,language))} · ${wt(language,'size')} ${ce(line.line.sizeCode)}</p>` + actions + (options.controlHtml||'') + actionContent
    + `<details class="my-3 rounded-xl border bg-white p-3" data-wool-report-records><summary class="min-h-10 font-bold">${wt(language, 'reports')}</summary>${reports || wt(language, 'noReports')}</details>`
    + handovers
}
