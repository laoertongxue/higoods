import type { CentralPdaLanguage } from './frame.ts'
import { cb,ce,ct,centralFormalName,centralNotice,centralTime } from './ui.ts'
import { dyePartnerLabel } from './dye-ui.ts'
import { printError,printFieldError,printNumber as n,printUnit } from './print-ui.ts'
import { printCard,printPhoto } from './print-view.ts'
import { centralPrintDispatch,centralPrintDispatchDocument,type PrintDispatchDraft } from './print-dispatch-model.ts'
const labels={
 zh:{open:'发起交出',records:'交出单',clear:'清空输入',scan:'扫本次交出的实物',identify:'识别',new:'新建交出',draft:'待交出',sent:'已交出',voided:'已作废',confirm:'确认交出',warehouse:'目标仓',scanned:'已核对',unscanned:'待核对',scanCount:'已核对卷',scanAgain:'重新扫余下实物，完成本次核对',remove:'移除本卷',void:'作废草稿',removeNote:'此卷将释放交出占用',voidNote:'本单全部卷将释放交出占用',needTouch:'先登记本卷实际触摸结果',needLabel:'先填写卷数量、规格并打印标签',wrongScan:'本卷不属于相同工厂、下游仓和单位的可交出实物，重新扫码',reserved:'本卷已在其他交出草稿中，打开该草稿继续',duplicate:'本卷已核对，继续扫下一卷',changed:'交出单或实物已变化，重新读取后核对',scanFirst:'先扫本次交出的实际卷',targetMissing:'原单缺少下游组织或目标仓，核对原单后重新读取',creator:'建单人',scanner:'核对人',sender:'交出人',receiver:'实收人',unknown:'历史实收资料未齐',back:'返回产出',empty:'暂无交出单',noAvailable:'暂无可交出的实际卷'},
 id:{open:'Siapkan kiriman',records:'Dokumen kiriman',clear:'Kosongkan kode',scan:'Pindai barang yang akan dikirim',identify:'Kenali',new:'Kiriman baru',draft:'Belum diserahkan',sent:'Sudah diserahkan',voided:'Dibatalkan',confirm:'Konfirmasi serahkan',warehouse:'Gudang tujuan',scanned:'Sudah diperiksa',unscanned:'Belum diperiksa',scanCount:'Rol diperiksa',scanAgain:'Pindai ulang barang yang tersisa untuk memeriksa kiriman ini.',remove:'Keluarkan rol ini',void:'Batalkan draf',removeNote:'Rol ini akan dilepas dari kiriman',voidNote:'Semua rol akan dilepas dari kiriman ini',needTouch:'Catat hasil rabaan rol ini dahulu',needLabel:'Isi jumlah dan spesifikasi rol, lalu cetak label.',wrongScan:'Rol tidak sesuai pabrik, gudang tujuan, atau satuan kiriman. Pindai ulang.',reserved:'Rol ini sudah masuk draf lain. Buka draf itu untuk melanjutkan.',duplicate:'Rol ini sudah diperiksa. Pindai rol berikutnya.',changed:'Kiriman atau barang berubah. Muat ulang lalu periksa.',scanFirst:'Pindai barang yang akan dikirim dahulu',targetMissing:'Tujuan atau gudang belum lengkap pada order asal. Periksa order lalu muat ulang.',creator:'Dibuat oleh',scanner:'Diperiksa oleh',sender:'Diserahkan oleh',receiver:'Diterima oleh',unknown:'Data penerimaan lama belum lengkap',back:'Kembali ke hasil',empty:'Belum ada dokumen kiriman',noAvailable:'Belum ada barang yang dapat dikirim'},
} as const
export const pdt=(lang:CentralPdaLanguage,key:keyof typeof labels.zh)=>labels[lang][key]
export function printDispatchError(error:unknown,lang:CentralPdaLanguage){
 const message=error instanceof Error?error.message:'',code=message.match(/PD_[A-Za-z]+/)?.[0],key=code?.slice(3) as keyof typeof labels.zh
 if(code&&key in labels.zh)return pdt(lang,key)
 if(lang==='id'){
  if(/触摸|手感|需要洗水|洗水异常/.test(message))return pdt(lang,'needTouch')
  if(/同加工厂|同接收方|同接收仓|同单位/.test(message))return pdt(lang,'wrongScan')
  if(/先扫齐/.test(message))return pdt(lang,'scanFirst')
  if(/重复加入|不在本交出单/.test(message))return pdt(lang,'wrongScan')
  if(/规格|打印.*标签|卷数量未确认/.test(message))return pdt(lang,'needLabel')
  if(/交出单不存在|仅草稿|只能作废|只有尚未交出/.test(message))return pdt(lang,'changed')
 }
 return printError(error,lang)
}
export function renderPrintDispatch(orderId:string,factoryId:string,draft:PrintDispatchDraft,lang:CentralPdaLanguage,limit=15){
 const state=centralPrintDispatch(orderId,factoryId);if(!state)return centralNotice(ct(lang,'empty'))
 const current=draft.documentId?centralPrintDispatchDocument(draft.documentId):undefined,o=state.fact.order,t=(key:keyof typeof labels.zh)=>pdt(lang,key),target=dyePartnerLabel({id:o.receivingTargetId,name:o.receivingTargetName},lang),closed=state.fact.closed
 let html=printCard(`<p>${ct(lang,'target')} · <strong>${ce(target)}</strong></p><p>${t('warehouse')} · ${ce(centralFormalName(o.receivingTargetWarehouseName,o.receivingTargetId,lang))}</p>`)
 if(!state.targetReady)html+=centralNotice(t('targetMissing'))
 if(state.targetReady&&!closed&&(!current||current.doc.status==='草稿'))html+=`<label class="my-3 block font-semibold">${t('scan')}<div class="mt-2 flex items-end gap-2"><input data-central-print-dispatch-field="scan" class="min-h-14 min-w-0 w-full flex-1 rounded-xl border bg-white p-3" autocomplete="off" value="${ce(draft.scan)}">${cb(t('identify'),'print-dispatch-scan')}</div></label>${cb(t('clear'),'print-dispatch-clear')}`
 if(current){
  const {doc,rows}=current
  html+=`<strong class="my-3 block break-all">${ce(doc.id)}</strong><p class="my-2 font-semibold">${t(doc.status==='草稿'?'draft':doc.status==='已交出'?'sent':'voided')} · ${n(current.total,lang)} ${ce(printUnit(current.unit,lang))}</p>`
  if(doc.status==='草稿')html+=`<p class="my-2 font-bold">${t('scanCount')} ${current.scanned} / ${rows.length}</p>`+(current.scanned===rows.length&&!doc.scanCompletedAt?centralNotice(t('scanAgain')):'')
  const last=doc.scans?.at(-1),visible=last?[...rows.filter(r=>r.workOrderId===last.workOrderId&&r.roll?.id===last.barcodeId),...rows.filter(r=>r.workOrderId!==last.workOrderId||r.roll?.id!==last.barcodeId)]:rows
  html+=visible.slice(0,limit).map(row=>{const r=row.roll,order=row.order,scanned=doc.scans?.find(s=>s.workOrderId===row.workOrderId&&s.barcodeId===r?.id)
   if(!r)return centralNotice(t('unknown'))
   return printCard(`<div class="flex items-center gap-3">${order?printPhoto(order.output.imageUrl,order.output.sku):''}<div class="min-w-0"><strong class="block break-all">${ce(r.barcode)}</strong><p class="break-words">${ce(order?.printOrderNo||'—')}</p><p class="break-words">${ce(r.sku)}</p><p class="text-xl font-bold">${n(r.lengthY,lang)} ${ce(printUnit(order?.output.qtyUnit||current.unit,lang))}</p></div></div>${doc.status==='草稿'?`<p class="my-2 ${scanned?'text-green-700':''}">${t(scanned?'scanned':'unscanned')}</p>`:''}${scanned?`<p class="text-sm">${t('scanner')} · ${ce(centralFormalName(scanned.scannedBy,scanned.scannedByUserId||'',lang))}</p>`:''}${!closed&&doc.status==='草稿'?cb(t('remove'),'print-dispatch-remove',JSON.stringify([row.workOrderId,r.id])):''}`)
  }).join('')
  if(rows.length>limit)html+=cb(ct(lang,'more'),'print-dispatch-more')
  html+=`<p class="my-2 break-words text-sm">${t('creator')} · ${ce(centralFormalName(doc.createdBy,doc.createdByUserId||'',lang))} · ${ce(centralTime(doc.createdAt,lang))}</p>`
  if(doc.handedOverAt)html+=`<p class="my-2 break-words text-sm">${t('sender')} · ${ce(centralFormalName(doc.handedOverBy,doc.handedOverByUserId||'',lang))} · ${ce(centralTime(doc.handedOverAt,lang))}</p>`
  if(doc.status==='草稿'&&current.releaseError)html+=centralNotice(t('needTouch'))+`<div class="my-3 grid gap-2">${cb(lang==='id'?'Rabaan / kirim cuci':'触摸判断 / 送洗','print-wash-open')}</div>`
  if(!closed&&doc.status==='草稿')html+=`<div class="my-3 grid">${cb(t('void'),'print-dispatch-void')}</div>`
  if(doc.status==='已交出')html+=renderPrintDispatchReceipt(current,lang)
 }
 html+=printFieldError()+`<div class="my-3 grid grid-cols-2 gap-2">${!closed&&draft.documentId?cb(t('new'),'print-dispatch-new'):''}${cb(t('back'),'print-output-back')}</div>`
 const others=state.docs.filter(d=>d.id!==draft.documentId)
 if(others.length||!current)html+=`<p class="my-3 font-semibold">${t('records')}</p>`
 html+=others.slice(0,limit).map(d=>printCard(`<strong class="block break-all">${ce(d.id)}</strong><p class="my-2">${t(d.status==='草稿'?'draft':d.status==='已交出'?'sent':'voided')} · ${d.lines.reduce((n,l)=>n+l.barcodeIds.length,0)} ${lang==='id'?'rol':'卷'}</p>${cb(lang==='id'?'Buka':'打开','print-dispatch-document',d.id)}`)).join('')||(!current?centralNotice(t('empty')):'')
 if(others.length>limit)html+=cb(ct(lang,'more'),'print-dispatch-more')
 return html
}
export function renderPrintDispatchReceipt(current:NonNullable<ReturnType<typeof centralPrintDispatchDocument>>,lang:CentralPdaLanguage){
 let html=current.receiptUnknown?centralNotice(pdt(lang,'unknown')):''
 for(const record of current.records){const qty=record.receiverWrittenQty??record.warehouseWrittenQty
  html+=printCard(`<strong class="block break-all">${ce(record.handoverRecordNo||current.doc.id+' / '+record.sequenceNo)}</strong><p>${ct(lang,'handed')} ${n(record.submittedQty??record.plannedQty??0,lang)} ${ce(printUnit(record.qtyUnit||current.unit,lang))}</p><p class="font-bold">${qty===undefined?ct(lang,'awaiting'):`${ct(lang,'actual')} ${n(qty,lang)} ${ce(printUnit(record.qtyUnit||current.unit,lang))}`}</p>${record.receiverWrittenAt||record.warehouseWrittenAt?`<p class="text-sm">${pdt(lang,'receiver')} · ${ce(record.receiverWrittenBy||'—')} · ${ce(centralTime(record.receiverWrittenAt||record.warehouseWrittenAt||'',lang))}</p>`:''}`)
 }
 return html
}
