import type { CentralPdaLanguage } from './frame.ts'
import type { CentralWoolExecution } from './wool-model.ts'
import type { CentralWoolHandoverTarget, CentralWoolReceiptActor } from './wool-handover-model.ts'
import type { WoolDomainStore } from '../../data/fcs/wool-domain/store.ts'
import { getWoolHandoverEffectiveQty } from '../../data/fcs/wool-domain/queries.ts'
import { getFactoryMasterRecordById } from '../../data/fcs/factory-master-store.ts'
import { centralOperationLabel } from './operation-label.ts'
import { cb, ce, cn, ct, centralFormalName, centralTime } from './ui.ts'
import { wt, woolInput, woolPieceName } from './wool-ui.ts'

export const woolHandoverUnit = (unit: '片' | '件', lang: CentralPdaLanguage) => lang === 'zh' ? unit : unit === '片' ? 'potong' : 'pcs'
export function woolHandoverReceiver(target: Pick<CentralWoolHandoverTarget, 'receiverId' | 'receiverName' | 'receiverType'>, lang: CentralPdaLanguage) {
  const factory = getFactoryMasterRecordById(target.receiverId)
  return target.receiverType === 'CUTTING_WAIT_HANDOVER_WAREHOUSE' ? wt(lang,'cuttingReceiver')
    : centralFormalName(target.receiverName, factory?.code || target.receiverName, lang)
}
export function renderWoolHandoverForm(options: {
  row: CentralWoolExecution; targets: CentralWoolHandoverTarget[]; selected?: CentralWoolHandoverTarget;
  language: CentralPdaLanguage; quantity: string; fieldFeedback: string;
}) {
  const { targets, selected, language } = options
  const parts = targets.some(target=>target.piece) ? `<div class="my-3 grid gap-2">${targets.map(target => `<button type="button" class="min-h-12 break-words rounded-xl border p-3 text-left ${selected?.key===target.key?'border-blue-600 bg-blue-50 text-blue-700':'bg-white'}" data-central-action="wool-handover-part" data-central-value="${ce(target.key)}" aria-pressed="${selected?.key===target.key}"><strong>${ce(woolPieceName(target.piece!,language))}</strong><span class="mt-1 block">${wt(language,'handoverAvailable')} · ${cn(target.availableQty,language)} ${woolHandoverUnit(target.unit,language)}</span></button>`).join('')}</div>` : ''
  if (!selected) return parts
  const unit = woolHandoverUnit(selected.unit,language)
  const destination = `<section class="my-3 rounded-xl border bg-white p-3"><p class="break-words"><span class="mr-2">${ct(language,'target')}</span><strong>${ce(woolHandoverReceiver(selected,language))}</strong></p>${selected.craftName?`<p class="mt-2">${ce(centralOperationLabel(selected.craftName,language))}</p>`:''}</section>`
  const count = `<p class="my-3 text-xl font-bold">${wt(language,'handoverAvailable')} · ${cn(selected.availableQty,language)} ${unit}</p>`
  const form = selected.availableQty>0 || options.quantity ? woolInput((selected.piece?woolPieceName(selected.piece,language)+' · ':'')+selected.sku+' · '+wt(language,'handoverQuantity')+' · '+unit,options.quantity,'handoverQty',false,options.row.completed||!selected.ready||selected.availableQty<=0)
    + `<p class="my-2" data-wool-field-feedback>${ce(options.fieldFeedback)}</p><div data-wool-handover-clear-control${options.quantity?'':' hidden'}>${cb(ct(language,'clear'),'wool-handover-clear')}</div>` : ''
  return parts+destination+count+form
}
export function renderWoolHandoverRecords(options: {
  row: CentralWoolExecution; sku: string; store: WoolDomainStore; language: CentralPdaLanguage;
  operatorLabel: (name:string,actorId?:string)=>string; receiptActors?: Map<string,CentralWoolReceiptActor>;
  selectedId?: string; allBatches?: boolean; forceOpen?: boolean;
}) {
  const { row, store, language, operatorLabel, selectedId } = options
  const records = store.handovers.filter(record=>record.woolOrderId===row.order.woolOrderId && record.outputSkuCode===options.sku
    && (!selectedId || options.allBatches || record.handoverId===selectedId)).sort((a,b)=>b.handedOverAt.localeCompare(a.handedOverAt))
  const toggle = selectedId ? `<div class="my-2 grid grid-cols-2 gap-2">${cb(wt(language,'thisBatch'),'wool-handover-scope','batch')}${cb(wt(language,'allBatches'),'wool-handover-scope','all')}</div>` : ''
  const html=records.map(record=>{
    const unit=woolHandoverUnit(record.qtyUnit==='片'?'片':'件',language),qty=getWoolHandoverEffectiveQty(store,record),receipt=record.downstreamReceipt
    const receiverOrder=store.workOrders[record.targetWorkOrderId||''],receiver=receiverOrder?.woolOrderNo||woolHandoverReceiver(record,language)
    const piece=row.order.externalPieces.find(piece=>piece.pieceKey===record.pieceKey)
    const received=receipt?.actualReceivedQty===undefined
      ? receipt?.status==='CONFIRMED'?wt(language,'actualUnknown'):ct(language,'awaiting')
      : `${wt(language,'actualReceived')} · ${cn(receipt.actualReceivedQty,language)} ${unit}`
    const remaining=receipt?.status==='PENDING'&&receipt.actualReceivedQty!==undefined
      ? `<p class="mt-1">${ct(language,'awaiting')} · ${cn(Math.max(0,qty-receipt.actualReceivedQty),language)} ${unit}</p>` : ''
    return `<article class="mt-3 border-t pt-3 ${record.handoverId===selectedId?'border-blue-500':''}" data-wool-handover-id="${ce(record.handoverId)}" tabindex="-1"><strong>${record.automatic?wt(language,'internalTransfer'):ct(language,'handed')} · ${cn(qty,language)} ${unit}</strong>${piece?`<p class="mt-1 break-words">${ce(woolPieceName(piece,language))}</p>`:''}<p class="mt-1 break-words">${ct(language,'target')} · ${ce(receiver)}</p><p class="mt-1">${ce(received)}</p>${remaining}<p class="mt-1 text-sm">${ce(centralTime(record.handedOverAt,language))}</p><p class="break-words text-sm">${wt(language,'handoverWorker')} · ${ce(operatorLabel(record.handedOverBy))}</p>${receipt?.receivedBy?`<p class="break-words text-sm">${wt(language,'receivedBy')} · ${ce(operatorLabel(receipt.receivedBy,options.receiptActors?.get(record.handoverId)?.operatorId))}</p>`:''}${receipt?.receivedAt?`<p class="text-sm">${ce(centralTime(receipt.receivedAt,language))}</p>`:''}</article>`
  }).join('')
  return `<details class="my-3 rounded-xl border bg-white p-3" data-wool-handover-records${options.forceOpen?' open':''}><summary class="min-h-10 font-bold">${wt(language,'handoverAndReceipt')}</summary>${toggle}${html||wt(language,'noHandoverRecords')}</details>`
}
