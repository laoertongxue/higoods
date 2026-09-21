// @page-pattern: workbench
import { escapeHtml as e } from '../../../../utils.ts'
import { getTmfPurchaseState, getTmfProductionDemandFulfillment, receiveTmfProductionPackage } from '../../../../data/pms/tmf-material-purchases.ts'

const selector = '[data-tmf-production-receipts]'
const prefix = 'tmf-production-receipts'
let receiverKey = ''
let selected = ''
let operationId = ''
let feedback = ''
const key = (organization: string, person: string) => JSON.stringify([organization, person])
const action = (name: string, label: string, id = '', primary = false) => `<button type="button" class="rounded border px-4 py-2 text-sm ${primary ? 'bg-blue-600 text-white' : 'bg-white'}" data-${prefix}-action="${name}" data-id="${e(id)}" data-skip-page-rerender="true">${label}</button>`
/** 按发料单保留每次交接，不能把同一包的不同发料单合成一条实收。 */
export function getTmfProductionReceiptTasks() {
  const data = getTmfPurchaseState()
  return data.productionIssues.flatMap(issue => {
    const pkg = data.packages.find(item => item.id === issue.packageId)
    const demand = data.demands.find(item => item.id === issue.demandId)
    if (!pkg || !demand) return []
    const purchase = data.orders.find(item => item.materialSkuId === pkg.materialSkuId)
    return [{ issue, pkg, demand, purchase, remaining: issue.dispatchedPieces - issue.receivedPieces, fulfillment: getTmfProductionDemandFulfillment(demand.id) }]
  })
}
type Task = ReturnType<typeof getTmfProductionReceiptTasks>[number]
const assigned = () => getTmfProductionReceiptTasks().filter(t => key(t.issue.receiverOrganizationId,t.issue.receiverId) === receiverKey)
const root = () => document.querySelector<HTMLElement>(selector)
const tip = (method: string) => ({ NONE:'无端头', METAL:'金属头', PLASTIC_WRAP:'塑料包头', SILICONE_DIP:'硅胶浸头' }[method] ?? method)
function identityOptions() {
  const seen = new Set<string>()
  return getTmfProductionReceiptTasks().flatMap(task => {
    const value = key(task.issue.receiverOrganizationId,task.issue.receiverId)
    if (seen.has(value)) return []
    seen.add(value)
    return [`<option value="${e(value)}" ${value===receiverKey?'selected':''}>${e(task.issue.receiverOrganizationId)} / ${e(task.issue.receiverId)}</option>`]
  }).join('')
}
function material(task: Task) {
  return `<div class="flex gap-3 items-center">${task.purchase?.materialImageUrl ? `<button type="button" data-${prefix}-action="image" data-id="${e(task.issue.id)}" data-skip-page-rerender="true"><img class="w-14 h-14 object-cover rounded border" src="${e(task.purchase.materialImageUrl)}" alt="${e(task.purchase.materialName)}半成品参考图"></button>` : ''}<div class="min-w-0"><p>${e(task.purchase?.materialName ?? task.pkg.materialSkuId)}</p><p class="text-xs break-all text-slate-500">${e(task.pkg.materialSkuId)}</p><p class="text-xs text-amber-700">${task.purchase?.materialImageUrl ? '图为半成品参考；真实实拍替代图' : '该规格实物图待补'}</p></div></div>`
}
function taskCard(task: Task) {
  return `<article class="rounded-lg border bg-white p-4"><div class="flex justify-between gap-3"><div class="min-w-0"><h2 class="font-semibold">${e(task.demand.productionOrderNo)} · ${e(task.demand.garmentSize)}</h2><p class="text-sm">${e(task.demand.specification.usage)} · 成品 ${task.pkg.actualFinishedLengthMm}mm</p><p class="text-xs break-all">包 ${e(task.pkg.id)}</p><p class="text-xs break-all text-slate-500">发料单 ${e(task.issue.id)}</p></div><strong class="shrink-0 ${task.remaining?'text-amber-700':'text-emerald-700'}">${task.remaining ? `待收 ${task.remaining} ${task.pkg.unit}` : '本次已收齐'}</strong></div><p class="text-sm mt-2">A端 ${e(tip(task.pkg.endA.method))} ${e(task.pkg.endA.specification)}；B端 ${e(tip(task.pkg.endB.method))} ${e(task.pkg.endB.specification)}</p><div class="mt-3">${material(task)}</div><div class="flex items-center justify-between gap-2 mt-3"><span class="text-sm">发出 ${task.issue.dispatchedPieces}，已收 ${task.issue.receivedPieces} ${task.pkg.unit}</span>${action('open',task.remaining?'核对收货':'查看结果',task.issue.id,task.remaining>0)}</div></article>`
}
function renderQueue() {
  if (!receiverKey) return '<p class="rounded border bg-white p-5 text-sm">请先选择本次演示领料身份，再查看分配给自己的待收物料。</p>'
  const tasks = assigned()
  const pending = tasks.filter(t=>t.remaining>0)
  const completed = tasks.filter(t=>t.remaining===0)
  return `<p class="text-sm mb-3">待收 ${pending.length} 张发料单；已收齐 ${completed.length} 张</p><div class="grid gap-3 md:grid-cols-2">${pending.map(taskCard).join('')}</div>${completed.length?`<details class="mt-4"><summary class="cursor-pointer text-sm py-2">查看已收齐 ${completed.length} 张</summary><div class="grid gap-3 md:grid-cols-2">${completed.map(taskCard).join('')}</div></details>`:''}${tasks.length?'':'<p class="rounded border bg-white p-4">当前身份暂无指定发料单。</p>'}`
}
function renderTask(task: Task) {
  return `<section class="max-w-2xl mx-auto rounded-lg border bg-white p-5"><div class="flex justify-between items-center"><h2 class="font-semibold">${task.remaining?'核对本次收货':'本次收货结果'}</h2>${action('back','返回待收')}</div><p class="mt-3 font-medium">${e(task.demand.productionOrderNo)} · ${e(task.demand.garmentSize)} · ${e(task.demand.specification.usage)}</p><p class="text-sm break-all">包 ${e(task.pkg.id)}</p><div class="mt-3">${material(task)}</div><div class="rounded bg-slate-50 p-3 mt-3 text-sm"><p>下料 ${task.pkg.actualCutLengthMm}mm；成品 ${task.pkg.actualFinishedLengthMm}mm</p><p>A端：${e(tip(task.pkg.endA.method))} ${e(task.pkg.endA.specification)}</p><p>B端：${e(tip(task.pkg.endB.method))} ${e(task.pkg.endB.specification)}</p><p class="mt-2">发出 ${task.issue.dispatchedPieces}，已收 ${task.issue.receivedPieces}，待收 ${task.remaining} ${task.pkg.unit}</p></div>${task.remaining?`<ol class="list-decimal pl-5 mt-4 space-y-4 text-sm"><li><label>核对实物包号<input name="package" data-skip-page-rerender="true" class="block mt-1 w-full border rounded p-2" placeholder="扫描或输入包号" autocomplete="off"></label></li><li><label>本次实际收到（${task.pkg.unit}）<input name="pieces" data-skip-page-rerender="true" type="number" min="1" step="1" class="block mt-1 w-full border rounded p-2"></label><p class="text-xs text-slate-500 mt-1">按实际数量填写；未到部分继续显示待收。</p></li><li><label class="flex gap-2"><input name="checked" data-skip-page-rerender="true" type="checkbox">实物长度、两端方式和合格状态与要求一致</label></li></ol><p role="alert" data-tmf-prod-error class="text-red-700 mt-3 text-sm"></p><div class="mt-4">${action('confirm','确认本次实收','',true)}</div>`:`<p class="mt-4">该规格生产需求：${e(task.fulfillment.status)}；仍缺 ${task.fulfillment.shortagePieces} ${task.pkg.unit}</p><p class="text-xs text-slate-500 mt-2">本张发料单收齐不代表其他规格需求已满足。</p>`}</section>`
}
function refresh() {
  const el=root();if(!el)return
  const task=assigned().find(t=>t.issue.id===selected)
  el.querySelector('[data-tmf-prod-content]')!.innerHTML=task?renderTask(task):renderQueue()
  el.querySelector('[data-tmf-prod-feedback]')!.textContent=feedback
}
function bind() {
  const el=root();if(!el||el.dataset.bound)return;el.dataset.bound='true'
  el.addEventListener('error',event=>{if(event.target instanceof HTMLImageElement){const span=document.createElement('span');span.textContent='图片加载失败';event.target.replaceWith(span)}},true)
  el.addEventListener('change',event=>{const field=event.target as HTMLSelectElement;if(field.name==='receiverIdentity'){receiverKey=field.value;selected=operationId='';feedback='已切换演示身份，以下为该身份的收货记录。';refresh()}})
  el.addEventListener('keydown',event=>{if(event.key==='Escape')el.querySelector('[data-tmf-prod-image]')!.innerHTML=''})
  el.addEventListener('click',event=>{
    const button=(event.target as HTMLElement).closest<HTMLElement>(`[data-${prefix}-action]`);if(!button)return;event.stopPropagation()
    const name=button.getAttribute(`data-${prefix}-action`)
    try {
      if(name==='open') {const task=assigned().find(t=>t.issue.id===button.dataset.id);if(!task)throw new Error('这张发料单未分配给当前领料人。');selected=task.issue.id;operationId=`tmf-prod-ui:${crypto.randomUUID()}`;feedback='';refresh()}
      else if(name==='back'){selected=operationId='';refresh()}
      else if(name==='close-image')el.querySelector('[data-tmf-prod-image]')!.innerHTML=''
      else if(name==='image'){
        const task=assigned().find(t=>t.issue.id===button.dataset.id)
        if(task?.purchase?.materialImageUrl)el.querySelector('[data-tmf-prod-image]')!.innerHTML=`<div class="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4"><button class="absolute inset-0" data-${prefix}-action="close-image" data-skip-page-rerender="true" aria-label="关闭大图"></button><div class="relative rounded bg-white p-3"><p>半成品参考图；真实实拍替代图 ${action('close-image','关闭')}</p><img class="max-h-[70vh] max-w-[85vw] object-contain" src="${e(task.purchase.materialImageUrl)}" alt="${e(task.purchase.materialName)}半成品参考图"></div></div>`
      }
      else if(name==='confirm'){
        const task=assigned().find(t=>t.issue.id===selected);if(!task||!operationId)throw new Error('当前发料单或领料身份已变化，请重新选择。')
        const scanned=el.querySelector<HTMLInputElement>('[name="package"]')!.value.trim()
        if(!el.querySelector<HTMLInputElement>('[name="checked"]')!.checked)throw new Error('请核对长度、端头和质量。不一致时请联系主管处理。')
        const pieces=Number(el.querySelector<HTMLInputElement>('[name="pieces"]')!.value)
        receiveTmfProductionPackage({issueId:task.issue.id,packageId:scanned,demandId:task.demand.id,receiverOrganizationId:task.issue.receiverOrganizationId,pieces},{id:task.issue.receiverId,name:`${task.issue.receiverId}（领料演示）`,role:'生产领料人'},operationId)
        const remaining=task.remaining-pieces
        feedback=`已保存本次 ${pieces} ${task.pkg.unit}。${remaining?`本张发料单仍有 ${remaining} ${task.pkg.unit} 待收，请继续核对未到物料。`:'本张发料单已收齐。'}`
        operationId=`tmf-prod-ui:${crypto.randomUUID()}`
        refresh()
      }
    }catch(error){const output=el.querySelector('[data-tmf-prod-error]')??el.querySelector('[data-tmf-prod-feedback]');if(output)output.textContent=error instanceof Error?error.message:'未保存，请重试。'}
  })
}
export function renderTmfProductionReceiptsPage(): string {
  selected=operationId=''
  if(typeof window!=='undefined')requestAnimationFrame(bind)
  return `<div data-tmf-production-receipts class="p-4 md:p-6 max-w-5xl mx-auto"><h1 class="text-xl font-semibold">生产领料确认</h1><p class="text-sm text-slate-500 mt-2">核对实物后确认自己收到的数量。</p><div class="rounded border bg-white p-3 mt-4"><label class="text-sm">演示领料身份<select name="receiverIdentity" class="block w-full rounded border p-2 mt-1"><option value="">请选择组织与领料人</option>${identityOptions()}</select></label><p class="text-xs text-amber-700 mt-2">此选择仅模拟操作身份，不代表真实登录或授权；正式接收身份来源仍待接入。</p></div><p class="text-sm text-blue-700 my-3" role="status" data-tmf-prod-feedback>${e(feedback)}</p><div data-tmf-prod-content>${renderQueue()}</div><div data-tmf-prod-image></div></div>`
}
