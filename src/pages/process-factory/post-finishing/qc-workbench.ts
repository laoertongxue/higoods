import { renderInspectionReference } from '../../quality-management/reference.ts'
// @page-pattern: form
import { runPostFinishingCommand, registerPostFinishingFile, releasePostFinishingPendingFile } from '../../../data/fcs/post-finishing-records.ts'
import { ensureQualityManagementRecords, QUALITY_CONFIGURATION_REVISION_ID, getQualityConfigurationRevision } from '../../../data/fcs/quality-management-records.ts'
import {
  POST_FINISHING_PROCESS_ITEMS, claimPostFinishingQcTask, completePostFinishingQcTask, getCurrentPostFinishingActor,
  clarifyPostFinishingQcBasis, recordPostFinishingIndependentCheck, getPostFinishingIndependentCheckStandard,
  getPostFinishingFullFlowQcTask, getPostFinishingActiveQcTask, getPostFinishingQcInspectionSummary,
  submitPostFinishingQcRound, upgradePostFinishingQcInspection, attachPostFinishingQcSignedPaper, type PostFinishingQcTask,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml as e } from '../../../utils.ts'
import { renderPostFinishingPageHeader, renderPostFinishingQcPrintActions, renderPostStatusBadge } from './shared.ts'
import type { PostQcCount } from '../../../data/fcs/post-finishing-quality.ts'

let notice = '', failed = false, dirty = false, leaveGuardInstalled = false
const operationIds = new Map<string,string>()
const selectedFileUrls = new WeakMap<File,string>()
const pendingFiles=new Map<string,File>()
let saving=false
function discardPendingFiles(keep: ReadonlySet<File> = new Set()):void {
  for(const [url,file] of pendingFiles)if(!keep.has(file)){releasePostFinishingPendingFile(url);selectedFileUrls.delete(file);pendingFiles.delete(url)}
}
type DraftControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
function controlGroup(node: DraftControl): string {
  if(node.closest('[data-qc-result-line]'))return 'round'
  if(node.matches('[data-qc-paper-file]'))return 'paper'
  if([...node.attributes].some(attr=>attr.name.startsWith('data-qc-basis-')))return 'basis'
  if([...node.attributes].some(attr=>attr.name.startsWith('data-qc-follow-')))return 'follow'
  if([...node.attributes].some(attr=>attr.name.startsWith('data-qc-upgrade-')))return 'upgrade'
  return 'process'
}
function draftControls(root: ParentNode): DraftControl[] {return [...root.querySelectorAll<DraftControl>('input,textarea,select')]}
function hasDraft(node: DraftControl): boolean {
  if(node instanceof HTMLInputElement){
    if(node.type==='file')return Boolean(node.files?.length)
    if(['checkbox','radio'].includes(node.type))return node.checked!==node.defaultChecked
  }
  if(node instanceof HTMLSelectElement)return node.selectedIndex!==Math.max(0,[...node.options].findIndex(option=>option.defaultSelected))
  return node.value!==node.defaultValue
}
function controlIdentity(node: DraftControl): string {
  return `${node.closest<HTMLElement>('[data-qc-result-line]')?.dataset.qcResultLine || ''}:${node.matches('[data-qc-process-item]')?node.value:''}:`+
    [...node.attributes].filter(attr=>attr.name.startsWith('data-qc-')).map(attr=>`${attr.name}=${attr.value}`).sort().join('|')
}
function updateLiveSummary(root: ParentNode):void {
  const summary=root.querySelector('[data-qc-live-summary]')
  if(summary){const rows=collect(root as HTMLElement);summary.textContent=`本轮新增：合格${rows.reduce((n,r)=>n+r.passedQty,0)}，瑕疵${rows.reduce((n,r)=>n+r.defectQty,0)}，返工${rows.reduce((n,r)=>n+r.returnQty,0)}；尚未提交。`}
}
// Replace only the current QC section. Move native controls from the other
// unsaved sections so their FileLists and text stay in page memory; the saved
// section is rebuilt from committed business facts.
function refreshSavedSection(form: HTMLElement, task: PostFinishingQcTask, savedGroup: string): void {
  const template=document.createElement('template');template.innerHTML=renderTask(task,false)
  const fresh=template.content.firstElementChild as HTMLElement
  const next=new Map(draftControls(fresh).map(node=>[controlIdentity(node),node]))
  for(const previous of draftControls(form)){
    if(controlGroup(previous)===savedGroup)continue
    const replacement=next.get(controlIdentity(previous));if(!replacement)continue
    const details=previous.closest('details'),preview=previous.nextElementSibling?.matches('[data-qc-selected-files]')?previous.nextElementSibling:null
    if(details?.open){const targetDetails=replacement.closest('details');if(targetDetails)targetDetails.open=true}
    replacement.replaceWith(previous)
    if(preview)previous.insertAdjacentElement('afterend',preview)
  }
  form.replaceWith(fresh)
  discardPendingFiles(new Set(draftControls(fresh).flatMap(node=>node instanceof HTMLInputElement?[...(node.files || [])]:[])))
  dirty=draftControls(fresh).some(hasDraft);updateLiveSummary(fresh)
  const page=fresh.closest('[data-testid="post-finishing-qc-workbench-page"]')
  page?.querySelector('[data-qc-action-notice]')?.remove()
  page?.querySelector('[data-qc-page-notice]')?.remove()
  page?.insertAdjacentHTML('afterbegin',`<div data-qc-action-notice role="status" class="rounded border bg-green-50 p-3 text-green-800">${e(notice)}${dirty?' 其他尚未提交内容已保留。':''}</div>`)
}

function fileUrl(file: File, allowPdf = false): string { let url=selectedFileUrls.get(file); if(!url) {url=registerPostFinishingFile(file,{allowPdf});selectedFileUrls.set(file,url);pendingFiles.set(url,file)} return url }
const query = () => typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
const value = (root: ParentNode, selector: string) => root.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector)?.value.trim() || ''
const btn = (action: string, label: string, id = '') => `<button type="button" class="rounded-md bg-blue-600 px-4 py-2.5 font-medium text-white" data-post-finishing-action="${action}" data-task-id="${e(id)}">${label}</button>`
function showSelectedFiles(input:HTMLInputElement):void {
  const files=[...(input.files || [])],allowPdf=input.matches('[data-qc-paper-file]')
  const parent=input.parentElement
  parent?.querySelector('[data-qc-selected-files]')?.remove()
  for(const file of files)if(!file.size || file.size>20*1024*1024 || (!file.type.startsWith('image/') && !(allowPdf&&file.type==='application/pdf')))throw new Error(allowPdf?'请选择不超过20 MB的纸单图片或PDF。':'请选择不超过20 MB的问题照片。')
  if(!files.length)return
  const preview=document.createElement('div');preview.dataset.qcSelectedFiles='true';preview.className='mt-3 flex flex-wrap gap-3'
  preview.innerHTML=files.map(file=>{const url=fileUrl(file,allowPdf);return `<div class="max-w-[180px] rounded border bg-white p-2 text-xs">${file.type.startsWith('image/')?`<button type="button" class="block h-24 w-32 overflow-hidden rounded border" data-post-finishing-action="full-flow-zoom-image" data-image-url="${e(url)}" data-image-label="${e(file.name)}"><img class="h-full w-full object-contain" src="${e(url)}" alt="所选文件 ${e(file.name)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>所选图片加载失败</span></button>`:`<a class="text-blue-700 underline" href="${e(url)}" target="_blank" rel="noopener">查看所选PDF</a>`}<p class="mt-1 break-all">${e(file.name)}</p><p>${Math.ceil(file.size/1024)} KB · 尚未保存</p></div>`}).join('')
  preview.insertAdjacentHTML('beforeend','<button type="button" class="self-start rounded border px-3 py-2 text-xs" data-qc-clear-selected data-post-finishing-action="full-flow-clear-qc-file">清除此处所选文件</button>')
  input.insertAdjacentElement('afterend',preview)
}
function installLeaveGuard(): void {
  if (leaveGuardInstalled || typeof window === 'undefined') return
  leaveGuardInstalled = true
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = '' } })
  document.addEventListener('click', event => {
    if (!dirty || !(event.target instanceof HTMLElement) || event.target.closest('a[target="_blank"]') || !event.target.closest('[data-nav],a[href]')) return
    if (!window.confirm('有尚未提交的检查输入或文件，确认离开？')) { event.preventDefault(); event.stopImmediatePropagation() }
    else {dirty = false;discardPendingFiles()}
  }, true)
}
async function prepareProductionClaim(taskNo: string): Promise<void> {
  const task=getPostFinishingFullFlowQcTask(taskNo)
  if(!task || task.sourceKind==='WAREHOUSE_STOCK')return
  const context=await import('../../../data/fcs/production-context-records.ts')
  if(context.isProductionContextReady())return
  // A completed inventory QC returns to this same scanner without preparing
  // unrelated production history. A later production claim prepares exactly
  // the original production entry dependencies before it can save anything.
  await (await import('../../../data/pcs-record-runtime.ts')).ensurePcsRecordState()
  await import('../../../data/fcs/ppic-daily-return-records.ts')
  const snapshot=await (await import('../../../data/fcs/cutting/cutting-record-repository.ts')).readCuttingRecords()
  await context.hydrateProductionContextRecords(snapshot)
  await (await import('../../../data/fcs/cutting/part-ticket-records.ts')).hydratePartTicketRecords(snapshot)
  await (await import('../../../data/fcs/production-context-actions.ts')).hydrateProductionSourceEffects()
  await (await import('../../../data/wls/accessory-warehouse-post-finishing.ts')).prepareAccessoryPostFinishing()
}
function taskFromPage(): PostFinishingQcTask | undefined {
  const actor = getCurrentPostFinishingActor()
  return ['detail','followup'].includes(query().get('view') || '') ? getPostFinishingFullFlowQcTask(query().get('taskNo') || '') : getPostFinishingActiveQcTask(actor.actorId)
}
function renderStandard(task: PostFinishingQcTask): string {
  if (!task.inspection) return `<section class="rounded-xl border bg-white p-4"><p>旧在检记录尚无标准快照。保留原领取人；确认本次有效要求后再继续检查，不补造原标准。</p>${btn('full-flow-claim-qc','确认本次标准并开始',task.qcTaskId)}</section>`
  const snapshot = task.inspection.snapshot
  const rows = (items: typeof snapshot.items) => `<table class="w-full text-left text-sm"><thead><tr><th class="p-2">项目</th><th class="p-2">检查内容与判定依据</th><th class="p-2">要求来源</th></tr></thead><tbody>${items.map(item => `<tr class="border-t"><td class="p-2">${e(item.dimension)}<br><strong>${e(item.name)}</strong></td><td class="p-2">${e(item.content)}<div class="mt-1 text-xs text-slate-600">${e(item.criterion)}</div>${item.references.map(ref => `<span class="mr-2 text-xs text-slate-500">${renderInspectionReference(ref)}</span>`).join('')}</td><td class="p-2 text-xs">${e(item.sourceStandardId)} v${item.sourceStandardVersion}${item.overriddenBy.map(row => `<br>覆盖：${e(row.standardId)} v${row.version}`).join('')}</td></tr>`).join('')}</tbody></table>`
  return `<section class="rounded-xl border bg-white p-4"><h3 class="font-semibold">本次固定检查要求</h3><p class="mt-1 text-xs text-slate-500">${e(snapshot.basicStandard.name)} v${snapshot.basicStandard.version} · 开检选取 ${e(snapshot.selectedAt)} · 无现场免检</p><div class="mt-3 overflow-auto">${rows(snapshot.items)}</div>${snapshot.skuSnapshots?.filter(row => JSON.stringify(row.snapshot.items) !== JSON.stringify(snapshot.items)).map(row => `<details class="mt-3 rounded border p-3"><summary>颜色尺码要求：${e(task.lines.find(line => line.sku.skuId === row.skuId)?.sku.colorName || '')} / ${e(task.lines.find(line => line.sku.skuId === row.skuId)?.sku.sizeName || '')}</summary>${rows(row.snapshot.items)}</details>`).join('') || ''}${snapshot.references.map(ref=>renderInspectionReference(ref)).join('')}</section>`
}
function basisItemOptions(task: PostFinishingQcTask): string {
  const snapshot=task.inspection?.snapshot
  if(!snapshot)return ''
  const items=new Map<string,{name:string;skuIds:Set<string>}>()
  const add=(rows:typeof snapshot.items,skuId?:string)=>{for(const item of rows){const value=items.get(item.id)||{name:item.name,skuIds:new Set<string>()};if(skuId)value.skuIds.add(skuId);items.set(item.id,value)}}
  if(snapshot.skuSnapshots?.length)for(const row of snapshot.skuSnapshots)add(row.snapshot.items,row.skuId)
  else add(snapshot.items)
  return [...items].map(([id,item])=>{
    const scope=item.skuIds.size===task.lines.length?'本批全部颜色尺码':task.lines.filter(line=>item.skuIds.has(line.sku.skuId)).map(line=>`${line.sku.colorName} / ${line.sku.sizeName}`).join('、')
    return `<option value="${e(id)}">${e(item.name)}${scope?` · ${e(scope)}`:''}</option>`
  }).join('')
}
function renderTask(task: PostFinishingQcTask, readOnly: boolean): string {
  const inspection = task.inspection, summary = getPostFinishingQcInspectionSummary(task)
  const canEdit = !readOnly && task.claimedBy?.actorId === getCurrentPostFinishingActor().actorId && task.status === '质检中'
  const inventory = task.sourceKind === 'WAREHOUSE_STOCK'
  const followupStandard = !readOnly && task.status==='质检完成' ? getPostFinishingIndependentCheckStandard(task.qcTaskId) : undefined
  const quantities = task.lines.reduce((n,line) => n + line.expectedQty,0)
  const pending = summary?.pendingAudit
  const operationKey = `${task.qcTaskId}:${inspection?.rounds.length || 0}`
  if (!operationIds.has(operationKey)) operationIds.set(operationKey,crypto.randomUUID())
  for(const suffix of ['basis','follow'])if(!operationIds.has(`${task.qcTaskId}:${suffix}`))operationIds.set(`${task.qcTaskId}:${suffix}`,crypto.randomUUID())
  const history = inspection?.rounds.map(round => `<tr class="border-t"><td class="p-2">第${round.roundNumber}轮</td><td>${round.percent}% / 累计目标${round.target}</td><td>${round.lines.reduce((n,row) => n + row.passedQty,0)}</td><td>${round.lines.reduce((n,row) => n + row.defectQty,0)}</td><td>${round.lines.reduce((n,row) => n + row.returnQty,0)}</td><td>${e(round.submittedAt)}</td></tr>`).join('') || ''
  return `<div class="space-y-4" data-qc-workbench-task="${e(task.qcTaskId)}" data-qc-operation-id="${e(operationIds.get(operationKey)!)}" data-qc-basis-operation="${e(operationIds.get(`${task.qcTaskId}:basis`)!)}" data-qc-follow-operation="${e(operationIds.get(`${task.qcTaskId}:follow`)!)}" data-skip-page-rerender="true">
  <section class="rounded-xl border bg-white p-4"><div class="flex flex-wrap justify-between gap-3"><div><h2 class="text-xl font-semibold">${e(task.qcTaskNo)}</h2><p class="mt-1 text-sm">${inventory ? `库存送检 · ${e(task.sourceWarehouseName || '')} · ${e(task.deliveryOrderNo)}` : `${e(task.productionOrderNo)} · ${e(task.deliveryOrderNo)}`}</p><p class="mt-1 text-xs text-slate-500">${task.claimedBy ? `领取人：${e(task.claimedBy.actorName)} · ${e(task.claimedAt || '')}` : '尚未领取'} · 实际接收${quantities}件</p></div>${renderPostStatusBadge(task.status)}</div>${summary ? `<div class="mt-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-4"><div>当前比例 <strong>${inspection!.percent}%</strong></div><div>累计应检 <strong>${summary.target}</strong></div><div>实际已检 <strong>${summary.inspectedQty}</strong></div><div>尚需检查 <strong>${summary.remainingQty}</strong></div><div>实检合格 ${summary.passedQty}</div><div>实检瑕疵 ${summary.defectQty}</div><div>实检返工 ${summary.returnQty}</div><div>未检 ${summary.uninspectedQty}</div></div><p class="mt-3 text-sm ${pending ? 'text-red-700' : 'text-slate-700'}">${pending ? `第${pending.roundNumber}轮不合格${pending.unqualifiedQty}件，达到${pending.threshold}件阈值，待稽查；QC尚未完成。` : task.status === '质检完成' ? `正常可放行${summary.releasedQty}件＝实检合格${summary.passedQty}＋未检随批放行${summary.uninspectedQty}，瑕疵/返工单独处理。` : '本批QC完成前不交出任何部分货物。'}</p>${inspection!.fullReasons.length ? `<p class="mt-2 text-xs text-amber-800">全检原因：${inspection!.fullReasons.map(e).join('；')}</p>` : ''}` : ''}</section>
  <section class="flex flex-wrap gap-3 rounded-xl border bg-white p-3">${task.lines.map(line=>`<div class="flex items-center gap-2"><button class="h-16 w-16 overflow-hidden rounded border" data-post-finishing-action="full-flow-zoom-image" data-image-url="${e(line.sku.imageUrl)}" data-image-label="${e(line.sku.spuName)}"><img src="${e(line.sku.imageUrl)}" alt="${e(line.sku.spuName)} ${e(line.sku.colorName)}" class="h-full w-full object-contain" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>对应图片加载失败</span></button><div class="text-xs">${e(line.sku.spuName)}<br>${e(line.sku.skuCode)} · ${e(line.sku.colorName)} / ${e(line.sku.sizeName)}</div></div>`).join('')}</section>
  ${renderStandard(task)}
  ${inspection ? `<section class="rounded-xl border bg-white p-4"><h3 class="font-semibold">依据澄清记录</h3>${(inspection.basisClarifications || []).map(row=>`<p class="mt-2 text-sm">${e(row.itemId)} · 冲突：${e(row.conflictDescription)} · 实际采用：${e(row.adoptedBasis)} · ${e(row.clarificationNote)} · ${e(row.by)} ${e(row.at)}</p>`).join('') || '<p class="mt-2 text-xs text-slate-500">未登记依据冲突。</p>'}${canEdit ? `<details class="mt-3"><summary>登记冲突项目的澄清结果</summary><select class="mt-2 w-full rounded border p-2" data-qc-basis-item>${basisItemOptions(task)}</select>${[['conflict','冲突内容'],['adopted','实际采用依据'],['note','澄清说明']].map(([key,label])=>`<label class="mt-2 block text-sm">${label}<textarea class="block w-full rounded border p-2" data-qc-basis-${key}></textarea></label>`).join('')}<div class="mt-3">${btn('full-flow-clarify-qc-basis','保存本项目澄清记录',task.qcTaskId)}</div></details>` : ''}</section>` : ''}
  ${task.independentChecks?.length ? `<section class="rounded-xl border bg-white p-4"><h3 class="font-semibold">独立追检记录</h3>${task.independentChecks.map(row=>`<p class="mt-2 text-sm">${e(row.at)} · ${e(row.by.actorName)} · 原QC ${e(task.qcTaskNo)}<br>对象：${e(row.objectDescription)}；范围：${e(row.scopeDescription)}；项目：${row.itemIds.map(e).join('、')}<br>原因：${e(row.reason)}；实际结果：${e(row.result)}</p>`).join('')}</section>` : ''}
  ${readOnly && task.status==='质检完成' ? `<a class="inline-block rounded border bg-white p-3 text-blue-700" href="/fcs/craft/post-finishing/qc-workbench?taskNo=${encodeURIComponent(task.qcTaskNo)}&view=followup" data-nav="/fcs/craft/post-finishing/qc-workbench?taskNo=${encodeURIComponent(task.qcTaskNo)}&view=followup">登记另行安排的独立追检</a>` : ''}
  ${!readOnly && task.status==='质检完成' ? `<details class="rounded-xl border bg-white p-4"><summary>登记另行安排的独立追检</summary><p class="mt-2 text-xs">明确实际对象、范围和项目，单独记录并关联本QC。原检查结果及出货保持原事实。</p>${[['object','追检对象'],['scope','明确范围'],['reason','追检原因'],['result','实际检查结果']].map(([key,label])=>`<label class="mt-2 block text-sm">${label}<textarea class="block w-full rounded border p-2" data-qc-follow-${key}></textarea></label>`).join('')}<fieldset class="mt-3">${(followupStandard?.items || []).map(item=>`<label class="mr-4 inline-block text-sm"><input type="checkbox" data-qc-follow-item="${e(item.id)}"> ${e(item.name)}</label>`).join('')}</fieldset><div class="mt-3">${btn('full-flow-independent-qc','保存独立追检记录',task.qcTaskId)}</div></details>` : ''}
  ${inspection ? `<section class="rounded-xl border bg-white p-4"><h3 class="font-semibold">检查轮次记录</h3><div class="overflow-auto"><table class="mt-3 w-full text-left text-sm"><thead><tr><th>轮次</th><th>比例/累计目标</th><th>合格</th><th>瑕疵</th><th>返工</th><th>提交时间</th></tr></thead><tbody>${history || '<tr><td colspan="6" class="p-3 text-slate-500">尚无已提交检查结果，默认输入不算已检。</td></tr>'}</tbody></table></div>${inspection.rounds.map(round=>round.lines.map(line=>(line.issuePhotoUrls || []).map(url=>`<button class="m-2 inline-block h-20 w-20 overflow-hidden rounded border" data-post-finishing-action="full-flow-zoom-image" data-image-url="${e(url)}" data-image-label="第${round.roundNumber}轮问题照片"><img src="${e(url)}" alt="第${round.roundNumber}轮问题照片" class="h-full w-full object-contain"></button>`).join('')).join('')).join('')}${inspection.audits.map(audit => `<p class="mt-2 text-sm">第${audit.roundNumber}轮稽查：${audit.status === 'PENDING' ? '待处理' : `${audit.fromPercent}% → ${audit.toPercent}% · ${e(audit.note || '')}`}</p>`).join('')}</section>` : ''}
  ${canEdit && pending ? `<section class="rounded-xl border border-amber-300 bg-amber-50 p-4"><h3 class="font-semibold">处理本轮稽查</h3><p class="mt-1 text-sm">本期只能提高比例或全检；升后不降，已检抵扣累计目标。</p><label class="mt-3 inline-block text-sm">提高到 <select class="ml-2 rounded border bg-white p-2" data-qc-upgrade-percent>${[...new Set([...(inspection!.snapshot.ruleSnapshot!.percentSteps),100])].filter(n => n > inspection!.percent).sort((a,b) => a-b).map(n => `<option value="${n}">${n}%</option>`).join('')}</select></label><label class="mt-3 block text-sm">稽查决定<textarea class="mt-1 block w-full rounded border bg-white p-2" data-qc-upgrade-note></textarea></label><div class="mt-3">${btn('full-flow-upgrade-qc','确认提高检查比例',task.qcTaskId)}</div></section>` : ''}
  ${canEdit && inspection && !pending && summary!.remainingQty > 0 ? `<section class="rounded-xl border bg-white p-4"><h3 class="font-semibold">本轮新增检查结果</h3><p class="mt-1 text-xs text-slate-600">整批尚需${summary!.remainingQty}件，不按SKU分配抽样。三类互斥，同件多问题只计一件；各SKU不能超过剩余实物。</p><p class="mt-3 rounded bg-blue-50 p-3 text-sm" data-qc-live-summary>本轮尚未提交</p><div class="mt-4 space-y-4">${task.lines.map(line => {
    const remaining = summary!.lines.find(row => row.skuId === line.sku.skuId)!.uninspectedQty
    const items = inspection.snapshot.skuSnapshots?.find(row => row.skuId === line.sku.skuId)?.snapshot.items || inspection.snapshot.items
    return `<article class="rounded-xl border p-3" data-qc-result-line="${e(line.sku.skuId)}" data-remaining="${remaining}"><div class="flex items-center gap-3"><button type="button" class="h-20 w-20 shrink-0 overflow-hidden rounded border" data-post-finishing-action="full-flow-zoom-image" data-image-url="${e(line.sku.imageUrl)}" data-image-label="${e(line.sku.spuName)}"><img class="h-full w-full object-contain" src="${e(line.sku.imageUrl)}" alt="${e(line.sku.spuName)} ${e(line.sku.colorName)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>对应图片加载失败</span></button><div><strong>${e(line.sku.spuName)}</strong><div class="text-xs">${e(line.sku.skuCode)} · ${e(line.sku.colorName)} / ${e(line.sku.sizeName)}</div><div class="mt-1 text-xs">实收${line.expectedQty}，剩余未检${remaining}</div></div></div><div class="mt-3 grid grid-cols-3 gap-3">${[['passedQty','合格'],['defectQty','瑕疵'],['returnQty','返工']].map(([key,label]) => `<label class="text-sm">${label}<input type="number" min="0" max="${remaining}" step="1" value="0" class="mt-1 w-full rounded border p-2 text-right" data-qc-result-field="${key}"></label>`).join('')}</div><fieldset class="mt-3"><legend class="text-sm font-medium">发现的问题（多选，不按原因相加件数）</legend><div class="mt-2 grid gap-2 sm:grid-cols-2">${items.map(item => `<label class="text-xs"><input type="checkbox" data-qc-issue="${e(item.id)}"> ${e(item.name)}</label>`).join('')}</div><textarea class="mt-2 w-full rounded border p-2 text-sm" placeholder="问题说明；问题照片选填" data-qc-issue-note></textarea><label class="mt-2 block text-xs">问题照片（选填）<input type="file" accept="image/*" multiple class="mt-1 block w-full" data-qc-issue-files></label></fieldset></article>`
  }).join('')}</div><div class="mt-4">${btn('full-flow-submit-qc-round',`提交第${inspection.rounds.length + 1}轮检查`,task.qcTaskId)}</div></section>` : ''}
  ${inspection ? `<section class="rounded-xl border bg-white p-4"><h3 class="font-semibold">${inventory ? '适用单据与资料' : '纸面双签单'}</h3><p class="mt-1 text-xs">当前检查要求版本 ${inspection.paperVersion}。${inventory ? '库存不额外要求纸面双签。' : '升检后重新打印并上传；旧纸单保留，问题照片选填。'}</p><div class="mt-3">${renderPostFinishingQcPrintActions(task.qcTaskNo)}</div>${canEdit ? `<label class="mt-3 block text-sm">选择纸单图片或PDF<input type="file" accept="image/*,application/pdf" class="mt-1 block w-full rounded border p-2" data-qc-paper-file data-qc-paper-version="${inspection.paperVersion}"></label><div class="mt-3">${btn('full-flow-upload-qc-paper','上传并保存当前纸单',task.qcTaskId)}</div>` : ''}${inspection.papers.map(paper => `<p class="mt-2 text-sm">版本${paper.version} · <a href="${e(paper.url)}" target="_blank" rel="noopener" class="text-blue-700 underline">${e(paper.name)}</a> · ${e(paper.uploadedAt)}</p>`).join('')}</section>` : ''}
  ${canEdit && inspection && !pending && summary!.remainingQty === 0 ? `<section class="rounded-xl border bg-white p-4"><h3 class="font-semibold">完成本批QC并按去向办理</h3>${!inventory ? `<fieldset class="mt-3"><legend class="text-sm">实际需要的后道加工项目</legend><div class="mt-2 flex flex-wrap gap-4">${POST_FINISHING_PROCESS_ITEMS.map(item => `<label><input type="checkbox" value="${item}" data-qc-process-item ${(task.frozenProcessItems || task.responsibility.defaultProcessItems).includes(item) ? 'checked' : ''}> ${item}</label>`).join('')}</div></fieldset>` : '<p class="mt-2 text-sm">正常货整批返原仓，瑕疵进瑕疵品仓，返工交goto_global；实际交接与上架后再完成申请。</p>'}<div class="mt-4">${btn('full-flow-complete-qc','确认完成QC并生成对应去向',task.qcTaskId)}</div></section>` : ''}
  </div>`
}
export function renderPostFinishingQcWorkbenchPage(): string {
  installLeaveGuard()
  const readOnly = query().get('view') === 'detail'
  try {
    const task = taskFromPage()
    return `<div class="space-y-4 p-4" data-testid="post-finishing-qc-workbench-page">${renderPostFinishingPageHeader(readOnly ? '质检记录详情' : '执行质检','输入完整质检单号领取；每人完成当前单后再领下一张')}${notice ? `<div data-qc-page-notice role="status" class="rounded border p-3 ${failed ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}">${e(notice)}</div>` : ''}${task ? renderTask(task,readOnly) : readOnly ? '<p role="alert">未找到完整质检单号。</p>' : `<section class="mx-auto max-w-2xl rounded-xl border bg-white p-5"><h2 class="font-semibold">输入完整质检单号</h2><p class="mt-1 text-sm">当前办理人：${e(getCurrentPostFinishingActor().actorName)}</p><input autofocus class="mt-4 h-11 w-full rounded border px-3" data-post-finishing-field="qc-task-input" placeholder="完整QC单号" value="${e(query().get('taskNo') || '')}"> <div class="mt-3">${btn('full-flow-claim-qc','领取并固定本次检查要求')}</div></section>`}</div>`
  } catch (error) { return `<div role="alert" class="p-4 text-red-700">${e((error as Error).message)} 请重新读取，原记录不变。</div>` }
}
function collect(root: HTMLElement): PostQcCount[] {
  return [...root.querySelectorAll<HTMLElement>('[data-qc-result-line]')].map(line => ({ skuId: line.dataset.qcResultLine!, passedQty: Number(value(line,'[data-qc-result-field="passedQty"]') || 0), defectQty: Number(value(line,'[data-qc-result-field="defectQty"]') || 0), returnQty: Number(value(line,'[data-qc-result-field="returnQty"]') || 0), issues: [...line.querySelectorAll<HTMLInputElement>('[data-qc-issue]:checked')].map(node => ({ itemId: node.dataset.qcIssue!, note: value(line,'[data-qc-issue-note]') || undefined })) }))
}
export async function handlePostFinishingQcWorkbenchEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  const root = target.closest<HTMLElement>('[data-qc-workbench-task]')
  const clear=target.closest('[data-qc-clear-selected]')
  if(root && clear){
    const preview=clear.closest('[data-qc-selected-files]'),input=preview?.previousElementSibling
    if(input instanceof HTMLInputElement)input.value=''
    preview?.remove();root.querySelector('[data-qc-selection-error]')?.remove()
    discardPendingFiles(new Set(draftControls(root).flatMap(node=>node instanceof HTMLInputElement?[...(node.files || [])]:[])))
    dirty=draftControls(root).some(hasDraft);return true
  }
  if (root && ['input','change'].includes(event?.type || '') && target.matches('input,textarea,select')) {
    dirty = true
    if(event?.type==='change' && target instanceof HTMLInputElement && target.type==='file'){
      const selected=new Set([...root.querySelectorAll<HTMLInputElement>('input[type="file"]')].flatMap(node=>[...(node.files || [])]))
      for(const [url,file] of pendingFiles)if(!selected.has(file)){releasePostFinishingPendingFile(url);selectedFileUrls.delete(file);pendingFiles.delete(url)}
      root.querySelector('[data-qc-selection-error]')?.remove()
      try{showSelectedFiles(target)}catch(error){target.value='';const alert=document.createElement('p');alert.dataset.qcSelectionError='true';alert.setAttribute('role','alert');alert.className='mt-2 text-sm text-red-700';alert.textContent=`${(error as Error).message} 本次无效选择已清除，已保存附件保持原记录。`;target.insertAdjacentElement('afterend',alert)}
      dirty=draftControls(root).some(hasDraft)
    }
    updateLiveSummary(root)
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-post-finishing-action]')
  const scanner = target.closest<HTMLInputElement>('[data-post-finishing-field="qc-task-input"]')
  const action = actionNode?.dataset.postFinishingAction || (scanner && event?.type === 'keydown' && (event as KeyboardEvent).key === 'Enter' ? 'full-flow-claim-qc' : '')
  if (!['full-flow-claim-qc','full-flow-submit-qc-round','full-flow-upgrade-qc','full-flow-upload-qc-paper','full-flow-complete-qc','full-flow-clarify-qc-basis','full-flow-independent-qc'].includes(action || '')) return false
  if(saving)return true
  saving=true
  if(root)root.inert=true
  try {
    const actor = getCurrentPostFinishingActor()
    await ensureQualityManagementRecords()
    if (action === 'full-flow-claim-qc') {
      const taskId = actionNode?.dataset.taskId
      const taskNo = taskId ? getPostFinishingFullFlowQcTask(taskId)?.qcTaskNo || '' : value(document,'[data-post-finishing-field="qc-task-input"]')
      // The scanner may name a native QC outside the previously viewed batch.
      // Read that exact original task before deciding its source or claiming it.
      const records=await import('../../../data/fcs/post-finishing-records.ts')
      await records.ensurePostFinishingExecutionRecordState('/fcs/craft/post-finishing/qc-workbench?taskNo='+encodeURIComponent(taskNo))
      if(records.getPostFinishingStorageFailure())throw Error(records.getPostFinishingStorageFailure())
      await prepareProductionClaim(taskNo)
      const task = await runPostFinishingCommand(() => claimPostFinishingQcTask({ qcTaskNo: taskNo, actor }), { guards: [{ id: QUALITY_CONFIGURATION_REVISION_ID, expectedVersion: getQualityConfigurationRevision() }] })
      dirty = false; notice = `领取成功，已固定本次标准和抽检参数：${task.qcTaskNo}`; failed = false
      appStore.navigate(`/fcs/craft/post-finishing/qc-workbench?taskNo=${encodeURIComponent(task.qcTaskNo)}&refresh=${Date.now()}`); return true
    }
    const form = document.querySelector<HTMLElement>('[data-qc-workbench-task]')
    const taskId = actionNode?.dataset.taskId || form?.dataset.qcWorkbenchTask || ''
    const task = getPostFinishingFullFlowQcTask(taskId)
    if (!form || !task) throw new Error('未找到当前QC，请重新读取。')
    const bridge = task.sourceKind === 'WAREHOUSE_STOCK' ? await import('../../../data/fcs/post-finishing-inventory-bridge.ts') : undefined
    if (bridge) await bridge.preparePostFinishingInventoryBridge()
    const options = bridge ? { participants: [bridge.inventoryTransactionParticipant] } : {}
    if (action === 'full-flow-submit-qc-round') {
      const lines=collect(form)
      for (const line of lines) {
        const row=[...form.querySelectorAll<HTMLElement>('[data-qc-result-line]')].find(row=>row.dataset.qcResultLine===line.skuId)
        line.issuePhotoUrls=[...(row?.querySelector<HTMLInputElement>('[data-qc-issue-files]')?.files || [])].map(file=>fileUrl(file))
      }
      await runPostFinishingCommand(() => submitPostFinishingQcRound({ qcTaskId: taskId, actor, operationId: form.dataset.qcOperationId!, lines }), options)
      notice = '本轮结果已保存；请查看是否触发稽查，QC尚未自动完成。'
    } else if (action === 'full-flow-upgrade-qc') {
      const nextPercent = Number(value(form,'[data-qc-upgrade-percent]')), note = value(form,'[data-qc-upgrade-note]')
      if (!window.confirm(`确认提高到${nextPercent}%？升后不能降低，已检抵扣，纸单须重打上传；尚未上传的旧纸单选择也会清除。`)) return true
      await runPostFinishingCommand(() => upgradePostFinishingQcInspection({ qcTaskId: taskId, actor, nextPercent, note }), options); notice = '已提高本批检查比例，请按差额补检。旧要求下尚未上传的纸单选择已清除，请按新版本重新打印并选择纸单。'
    } else if (action === 'full-flow-upload-qc-paper') {
      const input = form.querySelector<HTMLInputElement>('[data-qc-paper-file]'), file = input?.files?.[0]
      if (!file) throw new Error('请选择真实纸单文件。')
      const url = fileUrl(file,true)
      await runPostFinishingCommand(() => attachPostFinishingQcSignedPaper({ qcTaskId: taskId, actor, url, name: file.name }), options); notice = '当前要求版本纸单已保存。'
    } else if (action === 'full-flow-clarify-qc-basis') {
      await runPostFinishingCommand(()=>clarifyPostFinishingQcBasis({qcTaskId:taskId,actor,itemId:value(form,'[data-qc-basis-item]'),conflictDescription:value(form,'[data-qc-basis-conflict]'),adoptedBasis:value(form,'[data-qc-basis-adopted]'),clarificationNote:value(form,'[data-qc-basis-note]'),operationId:form.dataset.qcBasisOperation!}),options)
      notice='依据澄清记录已保存。'
    } else if (action === 'full-flow-independent-qc') {
      await runPostFinishingCommand(()=>recordPostFinishingIndependentCheck({qcTaskId:taskId,actor,objectDescription:value(form,'[data-qc-follow-object]'),scopeDescription:value(form,'[data-qc-follow-scope]'),reason:value(form,'[data-qc-follow-reason]'),result:value(form,'[data-qc-follow-result]'),itemIds:[...form.querySelectorAll<HTMLInputElement>('[data-qc-follow-item]:checked')].map(node=>node.dataset.qcFollowItem!),operationId:form.dataset.qcFollowOperation!}),options)
      notice='独立追检记录已保存，原QC结果保持原事实。'
    } else {
      if(draftControls(form).some(node=>controlGroup(node)!=='process' && hasDraft(node)))throw new Error('还有尚未提交的检查、依据澄清或所选文件，请先保存或清除，再完成QC。')
      if (!window.confirm('确认本批QC完成并按实际正常、瑕疵及返工去向办理？已提交结果不能更正。')) return true
      const processItems = [...form.querySelectorAll<HTMLInputElement>('[data-qc-process-item]:checked')].map(node => node.value)
      await runPostFinishingCommand(() => completePostFinishingQcTask({ qcTaskId: taskId, actor, processItems }), options); notice = 'QC已完成；对应加工或出货/分类交接已生成，实际交接尚需办理。'
    }
    if(action==='full-flow-clarify-qc-basis')operationIds.delete(`${taskId}:basis`)
    if(action==='full-flow-independent-qc')operationIds.delete(`${taskId}:follow`)
    failed = false
    document.querySelectorAll<HTMLElement>('[data-post-finishing-preserve-input]').forEach(node=>{delete node.dataset.postFinishingPreserveInput})
    document.querySelector('[data-qc-save-error]')?.remove()
    if(action==='full-flow-complete-qc'){
      discardPendingFiles();dirty=false
      appStore.navigate(`/fcs/craft/post-finishing/qc-workbench?taskNo=${encodeURIComponent(task.qcTaskNo)}&refresh=${Date.now()}`)
    } else {
      const group=action==='full-flow-submit-qc-round'?'round':action==='full-flow-upload-qc-paper'?'paper':action==='full-flow-upgrade-qc'?'upgrade':action==='full-flow-clarify-qc-basis'?'basis':'follow'
      refreshSavedSection(form,getPostFinishingFullFlowQcTask(taskId)!,group)
    }
  } catch (error) {
    failed = true; notice = error instanceof Error ? error.message : '本次未保存。'; target.dataset.postFinishingPreserveInput = 'true'
    document.querySelector('[data-qc-save-error]')?.remove()
    document.querySelector('[data-testid="post-finishing-qc-workbench-page"]')?.insertAdjacentHTML('afterbegin',`<div data-qc-save-error role="alert" class="rounded border bg-red-50 p-3 text-red-700">${e(notice)} 当前输入和所选文件已保留。</div>`)
  } finally {saving=false;if(root)root.inert=false}
  return true
}
