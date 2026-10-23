import type { CentralPdaLanguage } from './frame.ts'
import { cb, ce, ct, centralNotice, centralTime, centralFormalName } from './ui.ts'
import { dyePartnerLabel } from './dye-ui.ts'
import { WASHING_HAND_FEELS } from '../../data/fcs/fabric-washing-model.ts'
import { centralPrintWashing, type PrintWashingDraft } from './print-washing-model.ts'
import { printCard, printPhoto } from './print-view.ts'
import { printError, printFieldError, printNumber as n, printUnit } from './print-ui.ts'

const labels={
 zh:{open:'触摸判断 / 送洗',heading:'触摸面料',batch:'产出批次',select:'选择实际卷',decision:'触摸结果',no:'不需要洗水',wash:'需要洗水',feel:'目标手感',choose:'选择手感',soft:'柔软手感',thick:'增厚蓬松棉手感',stiff:'硬挺手感',save:'保存触摸结果',correct:'纠正触摸结果',send:'交给 GTG',scan:'扫本次送洗卷',identify:'识别',scanned:'已扫',remove:'取消本卷',sent:'已交给 GTG',received:'GTG 实收',final:'最终下游实收',output:'洗后产出',pending:'未判断',noReady:'暂无可判断的实际产出卷',selectRoll:'选择本次实际卷',chooseDecision:'登记实际触摸结果',chooseFeel:'选择目标洗水手感',wrongScan:'卷码不属于本次洗水单，重新扫码',duplicate:'本卷已扫，继续扫下一卷',alreadySent:'本卷已送洗，继续扫未交出的卷',scanFirst:'先扫本次送洗的实际卷',notReady:'本批尚未完成印花或实测数量',changed:'本批已变化，重新读取后核对',unavailable:'GTG 当前不能承接，核对工厂资料后重试',correctionBlocked:'本批已交出，不能更改触摸结果',correctionGroup:'完整选择原洗水单的卷后纠正',ownerChanged:'由原登记人核对触摸结果',scanCount:'本次已扫',back:'返回产出',judge:'查看触摸结果',sender:'交出人',judgeBy:'判断人',clear:'清空本次填写',reserved:'本卷已加入印花交出草稿，先解除该卷占用再送洗'},
 id:{open:'Rabaan / kirim cuci',heading:'Raba kain',batch:'Lot hasil',select:'Pilih rol fisik',decision:'Hasil rabaan',no:'Tidak perlu dicuci',wash:'Perlu dicuci',feel:'Rabaan yang dituju',choose:'Pilih rabaan',soft:'Lembut',thick:'Tebal dan mengembang seperti katun',stiff:'Kaku',save:'Simpan hasil rabaan',correct:'Ubah hasil rabaan',send:'Serahkan ke GTG',scan:'Pindai rol untuk dicuci',identify:'Kenali',scanned:'Sudah dipindai',remove:'Batalkan rol ini',sent:'Diserahkan ke GTG',received:'Diterima GTG',final:'Diterima tujuan akhir',output:'Hasil setelah cuci',pending:'Belum diperiksa',noReady:'Belum ada rol hasil yang dapat diperiksa',selectRoll:'Pilih rol fisik untuk diperiksa',chooseDecision:'Isi hasil rabaan kain',chooseFeel:'Pilih rabaan yang dituju',wrongScan:'Kode rol bukan untuk order cuci ini. Pindai ulang.',duplicate:'Rol ini sudah dipindai. Lanjut ke rol berikutnya.',alreadySent:'Rol ini sudah dikirim. Pindai rol yang belum dikirim.',scanFirst:'Pindai rol fisik yang akan dikirim dahulu',notReady:'Pencetakan atau jumlah terukur lot ini belum selesai.',changed:'Lot ini berubah. Muat ulang lalu periksa.',unavailable:'GTG belum dapat menerima pekerjaan. Periksa data pabrik lalu coba lagi.',correctionBlocked:'Lot sudah dikirim. Hasil rabaan tidak dapat diubah.',correctionGroup:'Pilih semua rol pada order cuci asal untuk mengubah hasil.',ownerChanged:'Minta pencatat asal memeriksa hasil rabaan.',scanCount:'Dipindai kali ini',back:'Kembali ke hasil',judge:'Lihat hasil rabaan',sender:'Diserahkan oleh',judgeBy:'Diperiksa oleh',clear:'Kosongkan isian ini',reserved:'Rol ini sudah masuk draf kiriman cetak. Keluarkan rol dari draf sebelum mengirim untuk dicuci.'},
} as const
export const pwt=(lang:CentralPdaLanguage,key:keyof typeof labels.zh)=>labels[lang][key]
export function printWashingError(error:unknown,lang:CentralPdaLanguage):string {
 const message=error instanceof Error?error.message:'',key=message.replace(/^PW_/,'') as keyof typeof labels.zh
 if(message.startsWith('PW_')&&key in labels.zh)return pwt(lang,key)
 if(lang==='zh'&&!message.startsWith('PW_'))return printError(error,lang)
 if(/已保存.*(?:未能更新|未更新)/.test(message))return 'Sudah disimpan. Muat ulang untuk melihat hasil.'
 if(/本人登记/.test(message))return pwt(lang,'ownerChanged')
 if(/完整选择原洗水单/.test(message))return pwt(lang,'correctionGroup')
 if(/GTG 已接单|本批已交出/.test(message))return pwt(lang,'correctionBlocked')
 if(/GTG 当前未启用/.test(message))return pwt(lang,'unavailable')
 if(/版本|变化|冲突|其他页面修改|操作标识/.test(message))return pwt(lang,'changed')
 if(/实际触摸|触摸结果|目标洗水手感/.test(message))return pwt(lang,'chooseDecision')
 if(/卷码|扫齐|重复交出/.test(message))return pwt(lang,'wrongScan')
 return printError(error,lang)
}
export function renderPrintWashing(orderId:string,factoryId:string,draft:PrintWashingDraft,actorId:string,lang:CentralPdaLanguage) {
 const state=centralPrintWashing(orderId,factoryId),t=(key:keyof typeof labels.zh)=>pwt(lang,key)
 if(!state)return centralNotice(ct(lang,'empty'))
 const source=state.sources.find(s=>s.id===draft.sourceId),sending=state.orders.find(o=>o.id===draft.sendOrderId),closed=state.fact.closed
 const batch=(id:string)=>/^CENTRAL-PRINT-/.test(id)?`${t('batch')} ${state.sources.findIndex(s=>s.batchId===id)+1}`:id
 let html=printCard(`<div class="flex items-center gap-3">${printPhoto(state.fact.order.output.imageUrl,state.fact.order.output.sku)}<div class="min-w-0"><strong class="block break-words">${ce(state.fact.order.printOrderNo)}</strong><p class="break-words">${ce(state.fact.order.output.sku)}</p><p class="font-semibold">${t(sending?'send':'heading')}</p></div></div>`)
 if(sending){
  const rolls=sending.rolls.filter(r=>!r.sentAt),selected=rolls.filter(r=>draft.scans.includes(r.barcode)),unit=printUnit(sending.rolls[0]?.unit||'',lang)
  html+=`<strong class="my-3 block break-words">${ce(sending.no)} · GTG</strong>`
  if(!closed&&rolls.length&&!sending.exception&&!sending.completedAt){html+=`<label class="my-3 block font-semibold">${t('scan')}<div class="mt-2 flex items-end gap-2"><input data-central-print-wash-field="scan" class="min-h-14 min-w-0 w-full flex-1 rounded-xl border bg-white p-3" value="${ce(draft.scan)}" autocomplete="off">${cb(t('identify'),'print-wash-scan')}</div></label><p class="my-3 font-bold">${t('scanCount')} ${selected.length} · ${n(selected.reduce((sum,r)=>sum+r.inputQty,0),lang)} ${ce(unit)}</p>`
   html+=rolls.map(r=>printCard(`<strong class="block break-all">${ce(r.barcode)}</strong><p>${n(r.inputQty,lang)} ${ce(printUnit(r.unit,lang))}</p>${draft.scans.includes(r.barcode)?`<p class="font-semibold text-green-700">${t('scanned')}</p>${cb(t('remove'),'print-wash-remove',r.barcode)}`:''}`)).join('')
   html+=cb(t('clear'),'print-wash-clear')
  }
  html+=cb(t('judge'),'print-wash-judge')
 }else if(source){
  if(state.sources.length>1)html+=`<label class="my-3 block font-semibold">${t('batch')}<select data-central-print-wash-field="sourceId" class="mt-2 min-h-14 w-full rounded-xl border bg-white p-3">${state.sources.map(s=>`<option value="${ce(s.id)}"${s.id===draft.sourceId?' selected':''}>${ce(batch(s.batchId))}</option>`).join('')}</select></label>`
  else html+=`<p class="my-3 break-all">${ce(batch(source.batchId))}</p>`
  const available=state.available(source.id),selectable=!closed&&source.actualCompleted&&!source.blockedReason
  html+=source.rolls.map(r=>{const j=state.judgments.find(j=>j.rollId===r.id),order=state.orders.find(o=>o.id===j?.orderId),canSelect=selectable&&(available.includes(r.id)||draft.correct&&draft.selected.includes(r.id)),canCorrect=!closed&&j?.actorId===actorId&&!r.handedOut&&(!order||!order.acceptedAt&&!order.rolls.some(r=>r.sentAt))
   return printCard(`${canSelect?`<label class="flex min-h-14 items-center gap-3"><input type="checkbox" class="h-6 w-6 shrink-0" data-central-print-wash-roll="${ce(r.id)}"${draft.selected.includes(r.id)?' checked':''}><span class="min-w-0 break-all"><strong>${ce(r.barcode)}</strong><span class="block">${n(r.qty,lang)} ${ce(printUnit(r.unit,lang))}</span></span></label>`:`<strong class="block break-all">${ce(r.barcode)}</strong><p>${n(r.qty,lang)} ${ce(printUnit(r.unit,lang))}</p>`}${j?`<p>${t(j.decision==='NO_WASH'?'no':'wash')}</p><p class="text-sm">${t('judgeBy')} · ${ce(centralFormalName(j.actorName,j.actorId,lang))} · ${ce(centralTime(j.at,lang))}</p>`:''}${canCorrect&&!draft.correct?cb(t('correct'),'print-wash-correct',r.id):''}`)
  }).join('')
  if(selectable&&(available.length||draft.correct)){
   html+=`<p class="my-3 font-semibold">${t('decision')}</p><div class="grid grid-cols-2 gap-2">${cb(t('no'),'print-wash-decision','NO_WASH',draft.decision==='NO_WASH')}${cb(t('wash'),'print-wash-decision','WASH',draft.decision==='WASH')}</div>`
   if(draft.decision==='WASH')html+=`<label class="my-3 block font-semibold">${t('feel')}<select data-central-print-wash-field="handFeel" class="mt-2 min-h-14 w-full rounded-xl border bg-white p-3"><option value="">${t('choose')}</option>${WASHING_HAND_FEELS.map((f,i)=>`<option value="${ce(f)}"${f===draft.handFeel?' selected':''}>${t((['soft','thick','stiff'] as const)[i])}</option>`).join('')}</select></label>`
   html+=cb(t('clear'),'print-wash-clear')
  }else if(!source.actualCompleted||source.blockedReason)html+=centralNotice(t('notReady'))
 }else html+=centralNotice(t('noReady'))
 html+=printFieldError()
 html+=renderPrintWashingReceipts(orderId,factoryId,lang,draft.sendOrderId,true)
 return html+cb(t('back'),'print-output-back')
}

/** The dye factory receipt and the final recipient receipt remain separate facts. */
export function renderPrintWashingReceipts(orderId:string,factoryId:string,lang:CentralPdaLanguage,sendOrderId='',allowSend=false){
 const state=centralPrintWashing(orderId,factoryId);if(!state)return ''
 const closed=state.fact.closed,t=(key:keyof typeof labels.zh)=>pwt(lang,key);let html=''
 for(const order of state.orders){
  const unit=printUnit(order.rolls[0]?.unit||'',lang),sum=(field:'inputQty'|'receivedQty'|'outputQty'|'downstreamQty')=>n(order.rolls.reduce((n,r)=>n+(r[field]||0),0),lang),sent=order.rolls.filter(r=>r.sentAt).reduce((n,r)=>n+r.inputQty,0)
  html+=printCard(`<strong class="block break-words">${ce(order.no)}</strong><p>${t(({柔软手感:'soft',增厚蓬松棉手感:'thick',硬挺手感:'stiff'} as const)[order.handFeel])}</p><p>${t('sent')} ${n(sent,lang)} ${ce(unit)}</p><p>${t('received')} ${sum('receivedQty')} ${ce(unit)}</p><p>${t('output')} ${sum('outputQty')} ${ce(unit)}</p><p class="break-words">${ct(lang,'target')} · ${ce(dyePartnerLabel(order.source.target||{id:'',name:''},lang))}</p><p>${t('final')} ${sum('downstreamQty')} ${ce(unit)}</p>${allowSend&&!closed&&!order.exception&&!order.completedAt&&order.rolls.some(r=>!r.sentAt)&&sendOrderId!==order.id?cb(t('send'),'print-wash-send',order.id):''}`)
  html+=state.actions.filter(a=>a.orderId===order.id&&a.action==='SEND').map(a=>`<p class="my-2 break-words text-sm">${t('sender')} · ${ce(centralFormalName(a.actor.name,a.actor.id,lang))} · ${ce(centralTime(a.at,lang))} · ${n(order.rolls.filter(r=>a.rollIds.includes(r.id)).reduce((sum,r)=>sum+r.inputQty,0),lang)} ${ce(unit)}</p>`).join('')
 }
 return html
}
