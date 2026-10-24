// @page-pattern: list
import { saveSewingSampleSourceUiAction } from '../../data/fcs/production-context-actions.ts'
import { getEffectiveTaskAssignment } from '../../data/fcs/effective-task-assignments.ts'
import { renderStandardListFilters, renderStandardListPage } from '../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../components/ui/list-table.ts'
import { renderTablePagination } from '../../components/ui/pagination.ts'
import { renderTabs } from '../../components/ui/tabs.ts'
import { ensureSewingOutsourcingSampleDemo } from '../../data/fcs/sewing-outsourcing-demo.ts'
import { readInspectionSnapshot, assertInspectionSnapshotCurrent } from '../../data/fcs/quality-management-records.ts'
import { getProductionOrderTechPackSnapshot } from '../../data/fcs/production-order-tech-pack-runtime.ts'
import { resolveQualityStyleContext } from '../../data/fcs/quality-management-style-context.ts'
import {
  getSewingSampleApprovalRecord, getSampleApprovalTiming, handoffPreProductionSampleToApprover,
  listSewingSampleApprovalListEntries, receivePreProductionSampleByPpic, recordSampleApprovalFeedbackToFactory,
  startSampleApproval, submitSampleApprovalSuggestion, summarizeSampleApprovalStructuredComments, sampleApprovalStatusLabels,
  type SampleApprovalStructuredComments, type SewingSampleApprovalRecord,
} from '../../data/fcs/sewing-sample-approval-suggestion.ts'
import type { InspectionIssue } from '../../data/fcs/quality-management-types.ts'
import { escapeHtml } from '../../utils.ts'

type Situation = 'PENDING_RETURN' | 'PENDING_APPROVAL' | 'PENDING_FEEDBACK' | 'COMPLETED'
type Form = SampleApprovalStructuredComments & { conclusion: 'NO_PROBLEM'|'HAS_PROBLEM'; issues:InspectionIssue[]; approvalSheetPhotoUrls:string[]; approverName:string; approverConfirmed:boolean }
type Dialog = {kind:'RECEIVE'|'START'|'APPROVAL'|'CARD';assignmentId:string;commandId:string;error:string;photos:string[];name:string;confirmed:boolean;form?:Form}|null
let dialog:Dialog=null
let preview:{url:string;label:string}|null=null
let active:Situation='PENDING_RETURN', keyword='', draftKeyword='', activePage=1, pageSize=20, feedback=''
let sequence=0, saving=false
const LABELS:Record<string,string> = sampleApprovalStatusLabels
const TABS:Record<Situation,string>={PENDING_RETURN:'待PPIC接收',PENDING_APPROVAL:'待批版',PENDING_FEEDBACK:'待反馈工厂',COMPLETED:'已完成'}
const COMMENT_FIELDS:Array<[keyof SampleApprovalStructuredComments,string]>=[['fabricApprovalComment','面料意见'],['processComment','工艺意见'],['materialUsageComment','用料意见'],['otherComment','其他意见']]
const action=(name:string,id:string,label:string,primary=false)=>`<button type="button" class="${primary?'rounded bg-blue-600 px-3 py-2 text-white':'text-blue-700'}" data-sample-approval-action="${name}" data-assignment-id="${escapeHtml(id)}">${label}</button>`
const command=(action:string)=>`SAMPLE-${action}-${Date.now()}-${++sequence}`
function matches(record: { sample: Pick<SewingSampleApprovalRecord['sample'], 'status'> }, situation = active):boolean {
  const status=record.sample.status
  return situation==='PENDING_RETURN'?['WAITING_PPIC_RECEIVE'].includes(status)
    :situation==='PENDING_FEEDBACK'?status==='SUGGESTION_UPLOADED':situation==='COMPLETED'?status==='FEEDBACK_SENT'
    :['PPIC_RECEIVED','HANDED_TO_APPROVER','APPROVAL_IN_PROGRESS'].includes(status)
}
function photos(record:SewingSampleApprovalRecord):string[]{return record.sample.ppicReceivedSamplePhotoUrls.length?record.sample.ppicReceivedSamplePhotoUrls:record.sample.samplePhotoUrls}
function image(url:string,label:string,classes='h-20 w-16'):string {
  if(!url)return '<span class="text-xs text-red-700">对应图片待补齐</span>'
  return `<button type="button" class="${classes} shrink-0 overflow-hidden rounded border" data-sample-approval-action="preview-image" data-image-url="${escapeHtml(url)}" data-image-label="${escapeHtml(label)}" aria-label="查看${escapeHtml(label)}大图"><img class="h-full w-full object-contain" src="${escapeHtml(url)}" alt="${escapeHtml(label)}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="text-xs text-red-700">图片加载失败</span></button>`
}
function gallery(urls:string[],label:string,editable=false):string {
  return `<div class="flex flex-wrap gap-3">${urls.map((url,index)=>`<div>${image(url,`${label}${index+1}`,'h-32 w-28')}${editable?action('remove-photo',dialog!.assignmentId,`删除第${index+1}张`).replace('data-assignment-id=',`data-photo-index="${index}" data-assignment-id=`):''}</div>`).join('')||'<p class="text-sm text-slate-500">暂无照片</p>'}</div>`
}
function rowActions(record:SewingSampleApprovalRecord):string {
  const map:Record<string,[string,string]>={WAITING_PPIC_RECEIVE:['receive-sample','接收样衣并拍照'],PPIC_RECEIVED:['handoff-approver','转交批版人员'],HANDED_TO_APPROVER:['start-approval','领取批版'],APPROVAL_IN_PROGRESS:['open-approval','填写批版建议'],SUGGESTION_UPLOADED:['feedback-factory','登记已反馈工厂']}
  const next=map[record.sample.status]
  return `<div class="flex flex-wrap justify-end gap-3">${next?action(next[0],record.assignmentId,next[1],true):''}${action('show-card',record.assignmentId,'查看建议卡')}</div>`
}
const columns:StandardListColumn<SewingSampleApprovalRecord>[]=[
  {key:'sample',title:'款式／实物',width:300,required:true,render:r=>`<div class="flex gap-3">${image(photos(r)[0]||r.sample.styleImageUrl,r.sample.styleCode)}<div><b>${escapeHtml(r.sample.styleCode)}</b><p>${escapeHtml(r.sample.styleName)}</p><p class="text-xs">${escapeHtml(r.sample.sampleNo)}</p><p class="text-xs">实收照片 ${r.sample.ppicReceivedSamplePhotoUrls.length} 张</p></div></div>`},
  {key:'task',title:'生产单／任务',width:230,required:true,render:r=>`${escapeHtml(r.sample.productionOrderNo)}<p>${escapeHtml(r.sample.taskNo)}</p>`},
  {key:'factory',title:'工厂／PPIC',width:230,render:r=>`${escapeHtml(r.sample.factoryName)}<p>PPIC：${escapeHtml(r.sample.currentPpicName)}</p>`},
  {key:'status',title:'当前节点／时效',width:240,required:true,render:r=>{const t=getSampleApprovalTiming(r);return `<b>${LABELS[r.sample.status]||'待核对'}</b><p class="text-xs">领取：${escapeHtml(t.startedAt||'尚未领取')}</p>${t.deadlineAt?`<p class="text-xs ${t.overdue?'text-red-700':''}">截止：${escapeHtml(t.deadlineAt)} ${escapeHtml(t.timeZone)}</p>`:t.startedAt?'<p class="text-xs text-amber-700">时间资料待核对</p>':''}`}},
  {key:'suggestion',title:'批版意见',width:260,render:r=>{const s=r.suggestionVersions.at(-1);return s?`<b>${s.conclusion==='NO_PROBLEM'?'无问题':'有问题'}</b><p>${escapeHtml((s.issues||[]).map(i=>i.note).join('；')||summarizeSampleApprovalStructuredComments(s.structuredComments)||'已提交')}</p><p class="text-xs">${escapeHtml(s.uploadedByName)}</p>`:'尚未提交'}},
  {key:'actions',title:'操作',width:260,required:true,actionColumn:true,render:rowActions},
]
function standard(record:SewingSampleApprovalRecord,form?:Form):string {
  const snapshot=record.inspectionStandardSnapshot
  if(!snapshot)return '<p class="text-amber-700">领取批版时固定本次检查要求。</p>'
  return `<section data-sample-inspection-standard class="space-y-3 rounded border p-4"><h3 class="font-semibold">本次检查要求 · ${escapeHtml(snapshot.basicStandard.name)}</h3><p class="text-xs">取用时间 ${escapeHtml(snapshot.selectedAt)}；共 ${snapshot.items.length} 项。基础标准及适用附加要求已合成。</p>${snapshot.items.map(item=>{const issue=form?.issues.find(i=>i.itemId===item.id);return `<article class="rounded border p-3"><b>${escapeHtml(item.dimension)} · ${escapeHtml(item.name)}</b><p>${escapeHtml(item.content)}</p><p class="text-sm">判定：${escapeHtml(item.criterion)}</p><p class="text-xs text-slate-500">来源 ${escapeHtml(item.sourceStandardId)} v${item.sourceStandardVersion}${item.overriddenBy.length?' · 附加要求覆盖':''}</p>${item.references.map(ref=>`<p class="text-xs">依据：${escapeHtml(ref.name)}${ref.value?` · ${escapeHtml(ref.value)}`:''}</p>`).join('')}${form?`<label class="mt-2 flex gap-2 text-sm"><input type="checkbox" data-sample-issue-id="${escapeHtml(item.id)}" ${issue?'checked':''}>此项有问题</label><textarea class="mt-1 min-h-16 w-full rounded border p-2 text-sm" data-sample-issue-note="${escapeHtml(item.id)}" placeholder="填写此项具体问题">${escapeHtml(issue?.note||'')}</textarea>`:''}</article>`}).join('')}</section>`
}
function card(record:SewingSampleApprovalRecord):string {
  const suggestion=record.suggestionVersions.at(-1), timing=getSampleApprovalTiming(record)
  return `<article data-sample-approval-screenshot-card class="space-y-4"><h2 class="text-xl font-semibold">批版建议</h2><p>${escapeHtml(record.sample.styleCode)} · ${escapeHtml(record.sample.styleName)}</p><p>${escapeHtml(record.sample.factoryName)} · ${escapeHtml(record.sample.productionOrderNo)} · ${escapeHtml(record.sample.taskNo)}</p>${gallery(photos(record),'PPIC实收样衣照片')}<p>领取人：${escapeHtml(record.currentApproverName||'尚未领取')}；领取 ${escapeHtml(timing.startedAt||'—')}；截止 ${escapeHtml(timing.deadlineAt||'时间待核对')} ${escapeHtml(timing.timeZone)}</p>${standard(record)}${suggestion?`<h3 class="font-semibold">结论：${suggestion.conclusion==='NO_PROBLEM'?'无问题':'有问题'}</h3><ul>${(suggestion.issues||[]).map(issue=>`<li>${escapeHtml(record.inspectionStandardSnapshot?.items.find(item=>item.id===issue.itemId)?.name||issue.itemId)}：${escapeHtml(issue.note||'')}</li>`).join('')}</ul><p>${escapeHtml(summarizeSampleApprovalStructuredComments(suggestion.structuredComments))}</p>${gallery(suggestion.approvalSheetPhotoUrls,'批版补充资料')}<p>提交 ${escapeHtml(timing.completedAt || suggestion.uploadedAt)}${timing.timeVerified ? ` ${escapeHtml(timing.timeZone)}` : '（时间资料待核对）'} · ${escapeHtml(suggestion.uploadedByName)}</p><p>反馈登记：${escapeHtml(suggestion.feedbackNote||'待反馈')}</p>`:'<p>尚未提交批版意见。</p>'}<details><summary>本次技术资料（${record.referenceSnapshots.length}项）</summary>${record.referenceSnapshots.map(ref=>`<div class="my-2 rounded border p-2"><b>${escapeHtml(ref.label)}</b> · ${escapeHtml(ref.versionLabel)}${ref.imageUrl?image(ref.imageUrl,ref.label):''}${ref.fileName?`<pre class="whitespace-pre-wrap break-all text-xs">${escapeHtml(ref.fileName)}</pre>`:''}</div>`).join('')||'已有资料待补齐'}</details></article>`
}
function readForm(fallback:Form):Form {
  const read=(name:string)=>document.querySelector<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>(`[data-sample-approval-field="${name}"]`)
  const issues=[...document.querySelectorAll<HTMLInputElement>('[data-sample-issue-id]')].filter(field=>field.checked).map(field=>({itemId:field.dataset.sampleIssueId!,note:[...document.querySelectorAll<HTMLTextAreaElement>('[data-sample-issue-note]')].find(note=>note.dataset.sampleIssueNote===field.dataset.sampleIssueId)?.value.trim()||''}))
  return {...fallback,...Object.fromEntries(COMMENT_FIELDS.map(([key])=>[key,read(key)?.value||''])),issues,conclusion:read('conclusion')?.value==='HAS_PROBLEM'?'HAS_PROBLEM':'NO_PROBLEM',approverName:read('approverName')?.value.trim()||'',approverConfirmed:!!(read('approverConfirmed') as HTMLInputElement)?.checked}
}
function overlays():string {
  let result=''
  if(dialog){const r=getSewingSampleApprovalRecord(dialog.assignmentId);if(r){let body='',title='',submit=''
    if(dialog.kind==='CARD'){title='批版建议卡';body=card(r)}
    if(dialog.kind==='RECEIVE'){title='PPIC接收产前版样衣';body=`<p>${escapeHtml(r.sample.styleCode)} · ${escapeHtml(r.sample.styleName)} · ${escapeHtml(r.sample.factoryName)}</p><p>拍摄实际收到的本厂样衣，可选择多张，至少一张。</p>${image(r.sample.styleImageUrl,'款式识别图')}<input type="file" accept="image/*" multiple data-sample-approval-action="select-received-photos" data-assignment-id="${escapeHtml(r.assignmentId)}">${gallery(dialog.photos,'待保存实收照片',true)}`;submit='submit-receive'}
    if(dialog.kind==='START'){title='领取批版';body=`<p>领取后按工厂当地时间连续计48小时；本次固定当前有效检查要求。</p><label>实际领取人姓名<input class="mt-1 h-10 w-full rounded border px-3" data-sample-approval-field="startApproverName" value="${escapeHtml(dialog.name)}"></label><label class="flex gap-2"><input type="checkbox" data-sample-approval-field="startConfirmed" ${dialog.confirmed?'checked':''}>本人已收到本件样衣，确认承担本次批版</label>`;submit='confirm-start-approval'}
    if(dialog.kind==='APPROVAL'&&dialog.form){title='填写批版建议';body=`${gallery(photos(r),'PPIC实收样衣')}${standard(r,dialog.form)}<label>批版结论<select class="mt-1 h-10 w-full rounded border" data-sample-approval-field="conclusion"><option value="NO_PROBLEM" ${dialog.form.conclusion==='NO_PROBLEM'?'selected':''}>无问题</option><option value="HAS_PROBLEM" ${dialog.form.conclusion==='HAS_PROBLEM'?'selected':''}>有问题</option></select></label><p>有问题须勾选具体检查项并填写问题；不新增纸面签字要求。</p>${COMMENT_FIELDS.map(([key,label])=>`<label class="block">${label}（选填）<textarea class="mt-1 min-h-16 w-full rounded border p-2" data-sample-approval-field="${key}">${escapeHtml(dialog!.form![key])}</textarea></label>`).join('')}<label>补充批版资料照片（选填）<input type="file" accept="image/*" multiple data-sample-approval-action="select-approval-sheet-photos" data-assignment-id="${escapeHtml(r.assignmentId)}"></label>${gallery(dialog.form.approvalSheetPhotoUrls,'补充批版资料',true)}<label>实际提交人姓名<input class="mt-1 h-10 w-full rounded border px-3" data-sample-approval-field="approverName" value="${escapeHtml(dialog.form.approverName)}"></label><label class="flex gap-2"><input type="checkbox" data-sample-approval-field="approverConfirmed" ${dialog.form.approverConfirmed?'checked':''}>本人为领取人 ${escapeHtml(r.currentApproverName||'')}，已核对本次要求和样衣</label>`;submit='submit-approval'}
    result=`<div data-sample-dialog class="fixed inset-0 z-50 overflow-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="${title}"><section class="relative mx-auto my-3 w-full max-w-4xl rounded-lg bg-white shadow-xl"><header class="flex justify-between border-b p-5"><h2 class="text-xl font-semibold">${title}</h2>${action('close-dialog',r.assignmentId,'关闭')}</header><div class="space-y-4 p-5">${dialog.error?`<p role="alert" class="rounded bg-red-50 p-3 text-red-700">${escapeHtml(dialog.error)}</p>`:''}${body}</div><footer class="flex justify-end gap-3 border-t p-4">${action('close-dialog',r.assignmentId,'取消')}${submit?action(submit,r.assignmentId,saving?'保存中…':dialog.kind==='START'?'确认领取':dialog.kind==='RECEIVE'?'保存照片并确认接收':'提交批版建议',true):''}</footer></section></div>`
  }}
  if(preview)result+=`<div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-label="图片大图"><button class="absolute inset-0" data-sample-approval-action="close-image" aria-label="关闭大图遮罩"></button><section class="relative max-h-[94vh] max-w-5xl overflow-auto rounded bg-white p-3"><header class="flex justify-between gap-3"><b>${escapeHtml(preview.label)}</b>${action('close-image','','关闭')}</header><img class="max-h-[82vh] max-w-full object-contain" src="${escapeHtml(preview.url)}" alt="${escapeHtml(preview.label)}高清图"></section></div>`
  return result
}
function content():string {
  const all=listSewingSampleApprovalListEntries().filter(r=>(r.assignmentAliases || [{assignmentId:r.assignmentId}]).some(alias=>getEffectiveTaskAssignment(alias.assignmentId)?.status==='EFFECTIVE'))
  const normalized=keyword.trim().toLowerCase(), filtered=all.filter(record=>matches(record)).filter(r=>!normalized||[r.sample.styleCode,r.sample.styleName,r.sample.productionOrderNo,r.sample.taskNo,r.sample.factoryName,r.sample.currentPpicName].some(value=>value.toLowerCase().includes(normalized)))
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));activePage=Math.min(Math.max(1,activePage),totalPages);const from=(activePage-1)*pageSize
  const rows=filtered.slice(from,from+pageSize).map(entry=>getSewingSampleApprovalRecord(entry.assignmentId)!)
  return renderStandardListPage({title:'批版建议',feedbackHtml:feedback?`<p role="status" class="rounded border p-3">${escapeHtml(feedback)}</p>`:'',statusTabsHtml:renderTabs({tabs:(Object.keys(TABS) as Situation[]).map(key=>({key,label:TABS[key],count:all.filter(record=>matches(record,key)).length})),activeKey:active,variant:'pills',prefix:'sample-approval',action:'switch-tab',fullWidth:true}),filtersHtml:renderStandardListFilters({actionPrefix:'sample-approval',fieldsHtml:`<input class="h-10 w-full max-w-lg rounded border px-3" placeholder="SPU / PO / 任务 / 工厂 / PPIC" value="${escapeHtml(draftKeyword)}" data-sample-approval-filter="keyword">`}),listTitle:`${TABS[active]}的产前版样衣`,tableHtml:renderStandardListTable({columns,rows,preferences:{order:columns.filter(c=>!c.actionColumn).map(c=>c.key),visibleKeys:columns.map(c=>c.key),frozenKeys:['sample'],pageSize},sort:null,eventPrefix:'sample-approval',emptyText:'当前条件下暂无产前版样衣'}),paginationHtml:renderTablePagination({total:filtered.length,from:filtered.length?from+1:0,to:Math.min(from+pageSize,filtered.length),currentPage:activePage,totalPages,pageSize,actionPrefix:'sample-approval',fieldPrefix:'sample-approval',pageSizeOptions:[20,50]})})
}
function refreshPage(dataChanged=false):void {const root=document.querySelector<HTMLElement>('[data-sample-approval-page]');if(!root)return;if(dataChanged)root.querySelector<HTMLElement>('[data-sample-content]')!.innerHTML=content();root.querySelector<HTMLElement>('[data-sample-overlays]')!.innerHTML=overlays()}
let leaveGuardInstalled=false
function installLeaveGuard():void {
 if(leaveGuardInstalled || typeof window==='undefined')return
 leaveGuardInstalled=true
 const hasDraft=()=>!!dialog && ['RECEIVE','APPROVAL','START'].includes(dialog.kind)
 window.addEventListener('beforeunload',event=>{if(!hasDraft())return;event.preventDefault();event.returnValue=''})
 document.addEventListener('click',event=>{const anchor=(event.target as Element)?.closest?.('a[href]');if(!anchor||!hasDraft())return;if(saving || !window.confirm('本次照片或意见尚未保存，确认离开？')){event.preventDefault();event.stopImmediatePropagation()}else{dialog=null;preview=null}},true)
}
export function renderSampleApprovalSuggestionsPage():string {installLeaveGuard();ensureSewingOutsourcingSampleDemo();return `<div data-sample-approval-page data-skip-page-rerender="true"><div data-sample-content>${content()}</div><div data-sample-overlays>${overlays()}</div></div>`}
export function isSampleApprovalSuggestionDialogOpen():boolean{return !!(dialog||preview)}
export function closeSampleApprovalSuggestionDialog():boolean{if(saving)return true;if(preview){preview=null;refreshPage();return true}if(!dialog)return false;if((dialog.kind==='APPROVAL'||dialog.kind==='RECEIVE')&&!window.confirm('尚未保存的照片或意见将不会保留，确认离开？'))return true;dialog=null;refreshPage();return true}
async function filesToUrls(files:File[]):Promise<string[]>{if(files.length>20||files.some(file=>!file.type.startsWith('image/')||file.size>10*1024*1024))throw new Error('请选择图片，每张不超过10MB，每次不超过20张');return Promise.all(files.map(file=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error(`无法读取照片：${file.name}`));reader.readAsDataURL(file)})))}
async function snapshotFor(record:SewingSampleApprovalRecord){const bound=getProductionOrderTechPackSnapshot(record.sample.productionOrderId);return readInspectionSnapshot({sourceKind:'PRE_PRODUCTION_SAMPLE',stage:'PRE_PRODUCTION_SAMPLE_APPROVAL',objectType:'GARMENT',...resolveQualityStyleContext({styleId:bound?.styleId,styleCode:record.sample.styleCode})})}
export async function handleSampleApprovalSuggestionsEvent(target:HTMLElement,event?:Event):Promise<boolean>{
  const filter=target.closest<HTMLInputElement>('[data-sample-approval-filter="keyword"]');if(filter){draftKeyword=filter.value;return true}
  const size=target.closest<HTMLSelectElement>('[data-sample-approval-field="pageSize"]');if(size){pageSize=Number(size.value)||20;activePage=1;refreshPage(true);return true}
  const node=target.closest<HTMLElement>('[data-sample-approval-action]'),name=node?.dataset.sampleApprovalAction;if(!node||!name)return false
  if(name.startsWith('select-')&&event?.type!=='change')return true
  if(name==='preview-image'){if(dialog?.kind==='APPROVAL'&&dialog.form)dialog.form=readForm(dialog.form);preview={url:node.dataset.imageUrl||'',label:node.dataset.imageLabel||'图片'};refreshPage();return true}
  if(name==='close-image'){preview=null;refreshPage();return true}
  if(name==='close-dialog'){closeSampleApprovalSuggestionDialog();return true}
  if(name.startsWith('switch-tab:')){active=name.slice(11) as Situation;activePage=1;refreshPage(true);return true}
  if(name==='query'||name==='reset'){keyword=name==='reset'?'':draftKeyword;if(name==='reset')draftKeyword='';activePage=1;refreshPage(true);return true}
  if(name==='prev-page'||name==='next-page'){activePage+=name==='prev-page'?-1:1;refreshPage(true);return true}
  if(saving)return true
  const id=node.dataset.assignmentId||'',record=getSewingSampleApprovalRecord(id);if(!record)return false
  const ppic={actorId:record.sample.currentPpicId,actorName:record.sample.currentPpicName,role:'PPIC' as const}
  const open=(kind:NonNullable<Dialog>['kind'])=>{dialog={kind,assignmentId:id,commandId:command(kind),error:'',photos:[],name:'',confirmed:false}}
  let changed=false
  try{
    if(name==='show-card')open('CARD')
    else if(name==='receive-sample')open('RECEIVE')
    else if(name==='start-approval')open('START')
    else if(name==='open-approval'){open('APPROVAL');dialog!.form={conclusion:'NO_PROBLEM',issues:[],fabricApprovalComment:'',processComment:'',materialUsageComment:'',otherComment:'',approvalSheetPhotoUrls:[],approverName:'',approverConfirmed:false}}
    else if(name==='select-received-photos'||name==='select-approval-sheet-photos'){if(!dialog)return true;if(dialog.form)dialog.form=readForm(dialog.form);const selected=await filesToUrls([...((node as HTMLInputElement).files||[])]);if(dialog.kind==='RECEIVE')dialog.photos=[...new Set([...dialog.photos,...selected])];else if(dialog.form)dialog.form.approvalSheetPhotoUrls=[...new Set([...dialog.form.approvalSheetPhotoUrls,...selected])]}
    else if(name==='remove-photo'&&dialog){const index=Number(node.dataset.photoIndex);if(dialog.form){dialog.form=readForm(dialog.form);dialog.form.approvalSheetPhotoUrls=dialog.form.approvalSheetPhotoUrls.filter((_,i)=>i!==index)}else dialog.photos=dialog.photos.filter((_,i)=>i!==index)}
    else {saving=true;event?.preventDefault();const now=new Date().toISOString()
      if(name==='submit-receive'&&dialog?.kind==='RECEIVE'){const urls=dialog.photos,cmd=dialog.commandId;await saveSewingSampleSourceUiAction(id,cmd,JSON.stringify({name,id,urls}),()=>receivePreProductionSampleByPpic({commandId:cmd,assignmentId:id,actor:ppic,receivedSamplePhotoUrls:urls,receivedAt:now}));feedback='已保存本件实收照片并接收样衣。'}
      else if(name==='handoff-approver'){const cmd=command('HANDOFF');await saveSewingSampleSourceUiAction(id,cmd,JSON.stringify({name,id}),()=>handoffPreProductionSampleToApprover({commandId:cmd,assignmentId:id,actor:ppic,approverTeamName:'大货批版组',handedAt:now}));feedback='已记录实物转交。'}
      else if(name==='confirm-start-approval'&&dialog?.kind==='START'){dialog.name=document.querySelector<HTMLInputElement>('[data-sample-approval-field="startApproverName"]')?.value.trim()||'';dialog.confirmed=!!document.querySelector<HTMLInputElement>('[data-sample-approval-field="startConfirmed"]')?.checked;if(!dialog.name||!dialog.confirmed)throw new Error('请填写实际领取人，并确认本人接收样衣');const actor={actorId:`SAMPLE-APPROVER:${dialog.commandId}`,actorName:dialog.name,role:'SAMPLE_APPROVER' as const},cmd=dialog.commandId,snapshot=await snapshotFor(record);await assertInspectionSnapshotCurrent(snapshot);await saveSewingSampleSourceUiAction(id,cmd,JSON.stringify({name,id,actor,snapshotId:snapshot.id}),()=>startSampleApproval({commandId:cmd,assignmentId:id,actor,receivedAt:now,inspectionStandardSnapshot:snapshot}));feedback='领取已保存，本次要求已固定，连续计48小时。'}
      else if(name==='submit-approval'&&dialog?.form){dialog.form=readForm(dialog.form);const form=dialog.form,cmd=dialog.commandId;if(!form.approverConfirmed||form.approverName!==record.currentApproverName||!record.currentApproverId)throw new Error('须由原领取人填写姓名并确认提交');const actor={actorId:record.currentApproverId,actorName:form.approverName,role:'SAMPLE_APPROVER' as const};await saveSewingSampleSourceUiAction(id,cmd,JSON.stringify({name,id,form}),()=>submitSampleApprovalSuggestion({commandId:cmd,assignmentId:id,actor,conclusion:form.conclusion,issues:form.issues,structuredComments:form,approvalSheetPhotoUrls:form.approvalSheetPhotoUrls,uploadedAt:now}));feedback='批版意见已保存，等待PPIC登记反馈工厂。'}
      else if(name==='feedback-factory'){const cmd=command('FEEDBACK');await saveSewingSampleSourceUiAction(id,cmd,JSON.stringify({name,id}),()=>recordSampleApprovalFeedbackToFactory({commandId:cmd,assignmentId:id,actor:ppic,feedbackAt:now,feedbackNote:'已从系统截取批版建议卡并反馈给承接工厂生产负责人。'}));feedback='已登记截图反馈时间和责任人，不代表工厂收悉回执。'}
      else return false
      dialog=null;changed=true
    }
  }catch(error){const message=error instanceof Error?error.message:'尚未保存，请重试';if(dialog)dialog.error=message;else feedback=message;changed=!dialog}
  finally{saving=false;refreshPage(changed)}
  return true
}
