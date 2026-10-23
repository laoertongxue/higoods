import { ce, cn, cb, centralNotice, centralFormalName } from './ui.ts'
import { cutPhoto, cutInput } from './cutting-view.ts'
import { cutUnit, cutLabel, cutText } from './cutting-ui.ts'
import type { CentralPdaLanguage } from './frame.ts'
import type { CentralSpreadingSource, CentralSpreadingInput, CentralSpreadingAction } from '../../data/fcs/cutting/cutting-spreading-command.ts'
import { centralSpreadingSourceSnapshot, prepareCentralSpreadingAction } from '../../data/fcs/cutting/cutting-spreading-command.ts'
import { centralSpreadingInput } from './cutting-spreading-model.ts'
import { dyeNumber } from './dye-ui.ts'
import type { FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import { cuttingTableResources } from '../process-factory/cutting/cutting-table-resource.ts'
const words={zh:{identify:'识别卷',identifyFirst:'先识别本次卷号',spreading:'铺布',start:'开始铺布',roll:'登记卷',nextRoll:'登记下一卷',saveRoll:'保存本卷',finish:'完成铺布',cut:'开始裁剪',finishCut:'完成裁剪',done:'裁剪已完成',table:'裁床',owner:'负责人',rollNo:'卷号',labeled:'原卷长度',length:'每层长度',layers:'层数',garments:'实裁件数',head:'布头',tail:'布尾',waste:'布头 / 布尾',source:'本单领料',unit:'床次项',noIssue:'暂无本单领料',clear:'清空本卷',reset:'撤销本次填写',usage:'用料',reported:'已登记',pieceUnit:'件',layerUnit:'层',required:'填写本卷数量和卷号',material:'面料',closed:'单据已完成，只能查看',state:'当前状态不能执行此操作',materialError:'当前可用用料不足，重新读取后核对',tableError:'选择可用裁床',tableBusy:'该时段裁床已有任务',rollSource:'重新选择本单领料和床次项',rollQty:'填写有效长度、整数层数和件数',rollLength:'本卷用料不能超过原卷长度',rollLimit:'用料不能超过本次领料剩余量',duplicate:'该卷已登记，打开原记录继续',handover:'累计层数不能少于已登记交接层数',rollRequired:'先保存完整卷记录'},
 id:{identify:'Cari rol',identifyFirst:'Pindai atau cari nomor rol dahulu.',spreading:'Gelar kain',start:'Mulai gelar kain',roll:'Catat rol',nextRoll:'Catat rol berikutnya',saveRoll:'Simpan rol',finish:'Selesai gelar kain',cut:'Mulai potong',finishCut:'Selesai potong',done:'Potong selesai',table:'Meja potong',owner:'Penanggung jawab',rollNo:'Nomor rol',labeled:'Panjang awal rol',length:'Panjang per lapis',layers:'Jumlah lapis',garments:'Hasil potong',head:'Sisa awal',tail:'Sisa akhir',waste:'Sisa awal / akhir',source:'Bahan untuk order ini',unit:'Bagian gelaran',noIssue:'Belum ada bahan diambil untuk order ini',clear:'Kosongkan rol',reset:'Batalkan perubahan',usage:'Bahan terpakai',reported:'Tercatat',pieceUnit:'pcs',layerUnit:'lapis',required:'Isi nomor rol dan jumlah',material:'Kain',closed:'Order selesai. Hanya bisa dilihat.',state:'Status saat ini tidak mengizinkan tindakan ini.',materialError:'Bahan yang tersedia belum cukup. Muat ulang lalu periksa.',tableError:'Pilih meja potong yang tersedia.',tableBusy:'Meja sudah dijadwalkan pada waktu ini.',rollSource:'Pilih bahan dan bagian gelaran untuk order ini.',rollQty:'Isi panjang yang valid serta jumlah lapis dan hasil bulat.',rollLength:'Pemakaian melebihi panjang awal rol.',rollLimit:'Pemakaian melebihi sisa bahan yang diambil.',duplicate:'Rol sudah dicatat. Buka catatan yang ada.',handover:'Jumlah lapis kumulatif kurang dari lapis serah terima.',rollRequired:'Simpan catatan rol lengkap terlebih dahulu.'}} as const
export const spreadText=(lang:CentralPdaLanguage,key:keyof typeof words.zh)=>words[lang][key]
export function spreadError(code:string,lang:CentralPdaLanguage){const keys:Record<string,keyof typeof words.zh>={CUT_rollIdentify:'identifyFirst',CUT_spreadClosed:'closed',CUT_spreadState:'state',CUT_spreadMaterial:'materialError',CUT_table:'tableError',CUT_tableBusy:'tableBusy',CUT_rollSource:'rollSource',CUT_rollQuantity:'rollQty',CUT_rollLength:'rollLength',CUT_rollIssueLimit:'rollLimit',CUT_rollDuplicate:'duplicate',CUT_rollHandover:'handover',CUT_rollRequired:'rollRequired'};return keys[code]?spreadText(lang,keys[code]):undefined}
export interface CuttingWorkDraft { tableId:string;issueId:string;unitId:string;rollNo:string;labeled:string;length:string;layers:string;garments:string;head:string;tail:string;waste:boolean;operationId:string;expectedSource:string }
export function cuttingWorkDraft(source:CentralSpreadingSource,rollId:string,lang:CentralPdaLanguage):CuttingWorkDraft {
 const roll=source.session.rolls.find(roll=>roll.rollRecordId===rollId),units=source.session.planUnits||[]
 return{tableId:source.session.cuttingTableId||'',issueId:roll?.sourceIssueEventId||(source.issues.length===1?source.issues[0].issue.eventId:''),unitId:roll?.planUnitId||(units.length===1?units[0].planUnitId:''),
  rollNo:roll?.rollNo||'',labeled:roll?cn(roll.labeledLength,lang):'',length:roll?cn(roll.actualLength,lang):'',layers:roll?cn(roll.layerCount,lang):'',garments:roll?cn(roll.actualCutGarmentQty??roll.actualCutPieceQty??0,lang):'',
  head:roll?cn(roll.headLength,lang):'',tail:roll?cn(roll.tailLength,lang):'',waste:!!roll&&(roll.headLength>0||roll.tailLength>0),operationId:crypto.randomUUID(),expectedSource:centralSpreadingSourceSnapshot(source)}
}
export function cuttingWorkInput(source:CentralSpreadingSource,actor:FactoryPdaUser,draft:CuttingWorkDraft,rollId:string,action:CentralSpreadingAction,lang:CentralPdaLanguage):CentralSpreadingInput {
 const input:CentralSpreadingInput={...centralSpreadingInput(source,actor,action,draft.operationId),expectedSource:draft.expectedSource,tableId:draft.tableId}
 if(action==='save-roll')input.roll={...(rollId&&rollId!=='new'?{rollRecordId:rollId}:{}),sourceIssueEventId:draft.issueId,planUnitId:draft.unitId,rollNo:draft.rollNo,
  labeledLength:dyeNumber(draft.labeled,lang,null,true),actualLength:dyeNumber(draft.length,lang,null,true),headLength:draft.head?dyeNumber(draft.head,lang,null,true):0,tailLength:draft.tail?dyeNumber(draft.tail,lang,null,true):0,
  layerCount:dyeNumber(draft.layers,lang,null,true),actualGarmentQty:dyeNumber(draft.garments,lang,null,true)}
 prepareCentralSpreadingAction(source,input)
 return input
}
export const cutWorkPath=(cut:string,pb:string,roll?:string)=>'/fcs/pda/central/cut/execute/'+encodeURIComponent(cut)+'?'+new URLSearchParams({mode:'spread',pb,...(roll?{roll}:{})})
export function cuttingWorkAction(source:CentralSpreadingSource,rollId:string):CentralSpreadingAction|undefined {
 if(source.session.cuttingStatus==='CUTTING_DONE'||source.session.voidedAt)return
 if(rollId)return source.session.status==='IN_PROGRESS'?'save-roll':undefined
 if(['DRAFT','TO_FILL'].includes(source.session.status))return'start-spreading'
 if(source.session.status==='IN_PROGRESS')return source.session.rolls.length?'finish-spreading':undefined
 if(source.session.status==='DONE')return source.session.cuttingStatus==='CUTTING'?'finish-cutting':'start-cutting'
}
export function cuttingWorkActionLabel(action:CentralSpreadingAction,lang:CentralPdaLanguage){return spreadText(lang,({'start-spreading':'start','save-roll':'saveRoll','finish-spreading':'finish','start-cutting':'cut','finish-cutting':'finishCut'} as const)[action])}
export function renderCuttingWork(source:CentralSpreadingSource,draft:CuttingWorkDraft,rollId:string,cut:string,actor:FactoryPdaUser,lang:CentralPdaLanguage){
 const t=(key:keyof typeof words.zh)=>spreadText(lang,key),session=source.session,closed=session.cuttingStatus==='CUTTING_DONE'||!!session.voidedAt,roll=session.rolls.find(roll=>roll.rollRecordId===rollId),isForm=!!rollId&&session.status==='IN_PROGRESS'&&!closed
 let html=`<section class="rounded-xl border bg-white p-3"><div class="flex items-center gap-3">${cutPhoto(source.order.materialIdentity.materialImageUrl,cutLabel(source.order.materialIdentity.materialName,lang,t('material')),lang)}<strong class="min-w-0 break-words">${ce(source.order.spreadingOrderNo)}</strong></div><p class="mt-2 break-words text-sm">${ce(source.order.sourceCutOrderNos.join(' · '))}</p></section>`
 if(['DRAFT','TO_FILL'].includes(session.status)&&!closed){html+=`<h2 class="my-3 text-lg font-bold">${t('table')}</h2><div class="grid grid-cols-2 gap-2">${cuttingTableResources.map((table,i)=>cb(lang==='zh'?table.cuttingTableNo:`Meja ${i+1}`,'cut-work-table',table.cuttingTableId,draft.tableId===table.cuttingTableId)).join('')}</div><p class="my-3 text-base">${t('owner')} · ${ce(centralFormalName(actor.name,actor.loginId,lang))}</p>`}
 if(isForm){
  html+=`<p class="my-3 text-sm">${t('reported')} · ${cn(session.rolls.length,lang)}</p>`
  if(roll)html+=`<p class="my-3 break-words text-sm">${t('reported')} · ${cn(roll.actualLength,lang)} m/${t('layerUnit')} · ${cn(roll.layerCount,lang)} ${t('layerUnit')} · ${cn(roll.actualCutGarmentQty??roll.actualCutPieceQty??0,lang)} ${t('pieceUnit')}</p>`
  if(source.issues.length===1){const issue=source.issues[0];html+=`<p class="my-3 break-words text-sm">${t('source')} · ${ce(String((issue.issue.payload as {issueRecordNo?:string}).issueRecordNo||issue.issue.refs.spreadingOrderNo||''))} · ${cn(issue.issue.inventoryEffect?.qty||0,lang)} ${ce(cutUnit(issue.issue.inventoryEffect?.unit||'',lang))}</p>`}
  if(source.issues.length!==1)html+=`<h2 class="my-3 font-bold">${t('source')}</h2>`+(source.issues.map(row=>cb(String((row.issue.payload as {issueRecordNo?:string}).issueRecordNo||row.issue.refs.spreadingOrderNo||'')+' · '+cn(Math.max(0,(row.issue.inventoryEffect?.qty||0)-row.returnedQty-(row.consumedQty||0)),lang)+' '+cutUnit(row.issue.inventoryEffect?.unit||'',lang),'cut-work-issue',row.issue.eventId,draft.issueId===row.issue.eventId)).join('')||centralNotice(t('noIssue')))
  const units=session.planUnits||[]
  if(units.length>1)html+=`<h2 class="my-3 font-bold">${t('unit')}</h2><div class="grid gap-2">${units.map((unit,i)=>cb((lang==='zh'?unit.stepLabel||`床次项 ${i+1}`:unit.stepNo?`Tahap ${unit.stepNo}`:`Bagian ${i+1}`)+' · '+(unit.sizeRows||[]).map(row=>row.size+' × '+cn(row.plannedQty,lang)).join(' / '),'cut-work-unit',unit.planUnitId,draft.unitId===unit.planUnitId)).join('')}</div>`
  html+=cutInput(t('rollNo'),draft.rollNo,'work-rollNo')+cb(t('identify'),'cut-work-identify')+cutInput(t('labeled')+' · m',draft.labeled,'work-labeled','text','米')+cutInput(t('length')+' · m',draft.length,'work-length','text','米')+cutInput(t('layers')+' · '+t('layerUnit'),draft.layers,'work-layers','text','层')+cutInput(t('garments')+' · '+t('pieceUnit'),draft.garments,'work-garments','text','件')
  html+=cb(t('waste'),'cut-work-waste',undefined,draft.waste)
  if(draft.waste)html+=cutInput(t('head')+' · m',draft.head,'work-head','text','米')+cutInput(t('tail')+' · m',draft.tail,'work-tail','text','米')
  html+=`<p data-cut-field-error class="my-2 text-base text-red-700"></p>`+cb(t(roll?'reset':'clear'),'cut-work-clear')
 }else{
  if(session.status==='IN_PROGRESS'&&!closed)html+=`<button type="button" class="my-3 block min-h-14 w-full rounded-xl bg-blue-600 p-3 text-center text-lg font-bold text-white" data-central-nav="${ce(cutWorkPath(cut,source.order.spreadingOrderId,'new'))}">${t(session.rolls.length?'nextRoll':'roll')}</button>`
  const records=roll?[roll]:session.rolls
  html+=records.map(row=>`<${roll?'article':'button'} ${roll?'':`type="button" data-central-nav="${ce(cutWorkPath(cut,source.order.spreadingOrderId,row.rollRecordId))}"`} class="my-3 w-full rounded-xl border bg-white p-3 text-left"><strong class="block break-words">${ce(row.rollNo)}</strong><span class="block">${cn(row.usableLength,lang)} m · ${cn(row.layerCount,lang)} ${t('layerUnit')} · ${cn(row.actualCutGarmentQty??row.actualCutPieceQty??0,lang)} ${t('pieceUnit')}</span><span class="block break-words text-sm">${row.operatorNames.map(name=>ce(cutLabel(name,lang,row.lastUpdatedById||''))).join(' · ')}</span>${roll?`<span class="mt-2 block">${t('labeled')} · ${cn(row.labeledLength,lang)} m<br>${t('length')} · ${cn(row.actualLength,lang)} m<br>${t('head')} · ${cn(row.headLength,lang)} m · ${t('tail')} · ${cn(row.tailLength,lang)} m</span>`:''}</${roll?'article':'button'}>`).join('')
  if(closed)html+=centralNotice(t('done'))
 }
 return html
}
