import type { CentralPdaLanguage } from './frame.ts'
import type { PrintRollFields } from './print-roll-ui.ts'
import { centralPrintOutput, centralPrintRollRemaining } from './print-output-model.ts'
import { cb, ce, ct, centralNotice } from './ui.ts'
import { dyePartnerLabel } from './dye-ui.ts'
import { printNumber as n, printUnit, printUsesRolls, printFieldError } from './print-ui.ts'
import { printCard, printPhoto } from './print-view.ts'
export interface PrintRollEditor { rollId:string;fields:PrintRollFields;quantities:Record<'NATIVE'|'METERS',string>;initial:string;revision:string;operationId:string;specOpen:boolean }
export interface PrintOutputUi { panel:'list'|'edit'|'label'|'washing'|'dispatch';rollId?:string;labelIds:string[];labelRevisions:Record<string,string>;printRequested:boolean;labelReady:boolean;operationId:string }
const labels={
 zh:{measure:'实测单位',native:'原单位',meters:'米',quantity:'本卷实测数量',edit:'填写卷数量',editAgain:'修改卷数量',label:'查看标签',add:'补充卷条码',pending:'待填写数量',printed:'已打印',unprinted:'未打印',reserved:'已加入交出单',onShelf:'已上架',weightMode:'重量',theory:'理论重量',actual:'实称重量',weight:'实称重量 · kg',spec:'规格',gsm:'克重 · g/m²',width:'幅宽 · cm',vat:'缸号',remark:'备注',clear:'清空填写',save:'保存本卷',print:'打印标签',printedConfirm:'确认标签已打印',original:'已登记',remaining:'本卷最多可填',missingImage:'产出实物图缺失，暂不能打印',unitChanged:'核对本卷实测单位',rollClosed:'本卷不能修改',back:'返回产出',qtyNotReady:'先填写有效卷数量和规格',labelWaiting:'标签正在加载',unweighed:'未称重',historyMissing:'原单未记录历史卷数量',noRows:'暂无产出条码'},
 id:{measure:'Satuan ukur',native:'Satuan asal',meters:'Meter',quantity:'Jumlah terukur rol ini',edit:'Isi jumlah rol',editAgain:'Ubah jumlah rol',label:'Lihat label',add:'Tambah kode rol',pending:'Jumlah belum diisi',printed:'Sudah dicetak',unprinted:'Belum dicetak',reserved:'Sudah masuk kiriman',onShelf:'Sudah disimpan',weightMode:'Berat',theory:'Berat teori',actual:'Berat timbang',weight:'Berat timbang · kg',spec:'Spesifikasi',gsm:'Gramasi · g/m²',width:'Lebar · cm',vat:'Kode bak',remark:'Catatan',clear:'Kosongkan isian',save:'Simpan rol ini',print:'Cetak label',printedConfirm:'Label sudah dicetak',original:'Tercatat',remaining:'Batas jumlah rol ini',missingImage:'Foto hasil belum tersedia. Label belum dapat dicetak.',unitChanged:'Periksa satuan ukur rol ini',rollClosed:'Rol ini tidak dapat diubah',back:'Kembali ke hasil',qtyNotReady:'Isi jumlah rol dan spesifikasi yang valid dahulu.',labelWaiting:'Memuat label',unweighed:'Belum ditimbang',historyMissing:'Jumlah rol lama belum tercatat',noRows:'Belum ada kode hasil'},
} as const
export function prt(lang:CentralPdaLanguage,key:keyof typeof labels.zh,rolls=true):string {
 const label=labels[lang][key]
 return rolls?label:lang==='id'?label.replace(/rol/g,'kemasan'):label.replace(/卷/g,'包装')
}
const field=(lang:CentralPdaLanguage,key:keyof PrintRollFields,label:string,value:string,numeric=true)=>`<label class="my-3 block font-semibold">${ce(label)}<input data-central-print-roll-field="${ce(key)}" class="mt-2 min-h-14 w-full rounded-xl border bg-white p-3 text-lg" value="${ce(value)}" inputmode="${numeric?'decimal':'text'}" autocomplete="off"></label>`
export function renderPrintOutputPanel(orderId:string,factoryId:string,ui:PrintOutputUi,editor:PrintRollEditor|undefined,lang:CentralPdaLanguage){
 const state=centralPrintOutput(orderId,factoryId)
 if(!state)return centralNotice(ct(lang,'empty'))
 const o=state.fact.order,roll=state.rolls.find(r=>r.id===ui.rollId),unit=printUnit(o.output.qtyUnit,lang),fabric=printUsesRolls(o.output.objectType),kg=!fabric&&['kg','公斤','千克'].includes(o.output.qtyUnit.toLowerCase()),label=(key:keyof typeof labels.zh)=>prt(lang,key,fabric)
 if(ui.panel==='edit'){
  if(!roll||!editor||editor.rollId!==roll.id||!roll.editable)return centralNotice(label('rollClosed'))+cb(label('back'),'print-output-back')
  const f=editor.fields
  let html=printCard(`<div class="flex items-center gap-3">${printPhoto(o.output.imageUrl,o.output.sku)}<div class="min-w-0"><strong class="block break-all">${ce(roll.barcode)}</strong><p class="break-words text-sm">${ce(o.output.sku)}</p><p class="font-bold">${label('original')} ${n(roll.lengthY,lang)} ${ce(unit)}</p></div></div>`)+`<p class="my-3 font-bold">${label('remaining')} ${n(centralPrintRollRemaining(orderId,roll.id,factoryId),lang)} ${ce(unit)}</p>`
  if(!roll.batchId&&o.productionBatches?.length)html+=`<label class="my-3 block font-semibold">${lang==='id'?'Lot hasil':'产出批次'}<select data-central-print-roll-field="batch" class="mt-2 min-h-14 w-full rounded-xl border bg-white p-3"><option value="">${lang==='id'?'Pilih lot hasil':'选择产出批次'}</option>${o.productionBatches.map((b,i)=>`<option value="${ce(b.id)}"${f.batch===b.id?' selected':''}>${lang==='id'?'Lot hasil':'产出批次'} ${i+1} · ${n(b.qty,lang)} ${ce(unit)}</option>`).join('')}</select></label>`
  if(fabric&&o.output.qtyUnit.toLowerCase()==='yard')html+=`<label class="my-3 block font-semibold">${label('measure')}<select data-central-print-roll-field="measure" class="mt-2 min-h-14 w-full rounded-xl border bg-white p-3"><option value="NATIVE"${f.measure==='NATIVE'?' selected':''}>Yard</option><option value="METERS"${f.measure==='METERS'?' selected':''}>m</option></select></label>`
  html+=field(lang,'quantity',`${label('quantity')} · ${f.measure==='METERS'?'m':unit}`,f.quantity)
  if(!kg)html+=`<label class="my-3 block font-semibold">${label('weightMode')}<select data-central-print-roll-field="weightMode" class="mt-2 min-h-14 w-full rounded-xl border bg-white p-3"><option value="THEORETICAL"${f.weightMode==='THEORETICAL'?' selected':''}>${label(fabric?'theory':'unweighed')}</option><option value="ACTUAL"${f.weightMode==='ACTUAL'?' selected':''}>${label('actual')}</option></select></label>`+(f.weightMode==='ACTUAL'?field(lang,'weight',label('weight'),f.weight):'')
  html+=cb(label('spec'),'print-roll-spec',undefined,editor.specOpen)
  if(editor.specOpen)html+=(fabric?field(lang,'gsm',label('gsm'),f.gsm)+field(lang,'width',label('width'),f.width):'')+field(lang,'vat',label('vat'),f.vat,false)+field(lang,'remark',label('remark'),f.remark,false)
  return html+printFieldError()+`<div class="my-3 grid grid-cols-2 gap-2">${cb(label('clear'),'print-roll-clear')}${cb(label('back'),'print-output-back')}</div>`
 }
 if(ui.panel==='label'){
  return `<p class="my-3 break-all font-semibold">${ui.labelIds.map(id=>ce(state.rolls.find(r=>r.id===id)?.barcode||'')).join(' / ')}</p><iframe title="${label('label')}" data-central-print-label class="h-[44dvh] w-full rounded-xl border bg-white"></iframe><div class="my-3 grid grid-cols-2 gap-2">${state.fact.closed?'':cb(label('print'),'print-label-print')}${cb(label('back'),'print-output-back')}</div>`
 }
 let html=`<p class="my-3 break-words">${ct(lang,'target')} · <strong>${ce(dyePartnerLabel({id:o.receivingTargetId,name:o.receivingTargetName},lang))}</strong></p>`
 if(!state.fact.closed&&o.output.objectType==='面料'&&o.output.completedQty>0)html+=cb(lang==='id'?'Rabaan / kirim cuci':'触摸判断 / 送洗','print-wash-open')
 if(state.documents.length||!state.fact.closed&&state.rolls.some(r=>!r.handoverRecordId&&!r.reservedBy&&!r.dispatchBlock))html+=cb(lang==='id'?(state.documents.length?'Dokumen kiriman':'Siapkan kiriman'):(state.documents.length?'交出单':'发起交出'),'print-dispatch-open')
 html+=state.rolls.map(r=>printCard(`<strong class="block break-all">${ce(r.barcode)}</strong><p class="my-2 text-xl font-bold">${r.quantityConfirmed!==false&&r.lengthY>0?`${n(r.lengthY,lang)} ${ce(unit)}`:label('pending')}</p><p class="my-2">${r.handoverRecordId?ct(lang,'handed'):r.reservedBy?label('reserved'):r.inboundStatus==='已上架'?label('onShelf'):r.printedAt?label('printed'):label('unprinted')}</p><div class="grid grid-cols-2 gap-2">${r.editable?cb(label(r.quantityConfirmed&&r.lengthY>0?'editAgain':'edit'),'print-roll-edit',r.id):''}${r.printable?cb(label('label'),'print-roll-label',r.id):''}</div>`)).join('')||centralNotice(label(o.historicalRollQuantitiesUnknown?'historyMissing':'noRows'))
 if(!state.fact.closed&&!o.historicalRollQuantitiesUnknown&&o.output.completedQty>0)html+=cb(label('add'),'print-roll-add')
 return html
}
