import { listWoolCraftTaskOrders,executeWoolCraftAction } from '../../../data/fcs/wool-domain/craft-flow.ts'
import { readWoolStore } from '../../../data/fcs/wool-domain/store.ts'
import type { SpecialCraftTaskOrder } from '../../../data/fcs/special-craft-task-orders.ts'
import { listFactoryReceipts } from '../../../data/fcs/factory-receiving.ts'
import { appStore } from '../../../state/store.ts'
import { getPdaSession } from '../../../data/fcs/store-domain-pda.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderWoolObjectImage } from './stage-display.ts'

export function renderWoolCraftDetail(task:SpecialCraftTaskOrder, surface?:string):string{
 const store=readWoolStore(),order=store.workOrders[task.woolOrderId!],piece=order.externalPieces.find(p=>p.pieceKey===task.woolPieceKey)!
 const index=piece.routeNodes.findIndex(n=>n.sourceEntryId===task.woolRouteNodeId),next=piece.routeNodes[index+1]
 const records=store.craftRecords.filter(r=>r.taskOrderId===task.taskOrderId)
 const receipts=listFactoryReceipts().flatMap(r=>r.lines.filter(l=>l.woolCraftOrderId===task.taskOrderId).map(l=>`${r.receivedAt} · ${r.operatorName} · ${l.qty} 片 · ${l.sourceDocumentNo}`))
 const button=(action:string,label:string)=>`<button class="rounded border px-3 py-2 text-sm" data-special-craft-web-action="open-web-status-action-dialog" data-action-code="${action}" data-source-id="${escapeHtml(task.taskOrderId)}" data-skip-page-rerender="true">${label}</button>`
 return `<div class="space-y-4" data-wool-craft-detail="${escapeHtml(task.taskOrderId)}" data-surface="${surface || ''}"><header><h1 class="text-xl font-semibold">${escapeHtml(task.operationName)}加工单 · 毛织片</h1><p class="break-all text-sm">${escapeHtml(task.taskOrderNo)} · ${escapeHtml(task.factoryName)} · ${task.status}</p></header><section class="flex gap-3 rounded border p-4">${renderWoolObjectImage(order.styleImageUrl,`${order.styleNo} 款式参考图`)}<div class="min-w-0 text-sm"><strong>${escapeHtml(piece.pieceName)}</strong><p>${escapeHtml(order.styleNo)} · ${escapeHtml(piece.skuCode)}</p><p>技术包 ${escapeHtml(order.sourceTechPackVersionCode)} · 路线第 ${index+1} 步 / ${piece.routeNodes.length} 步</p><p>下一站：${escapeHtml(next?`${next.factoryName} · ${next.craftName}`:`${order.factoryName} · 缝盘加工单`)}</p></div></section><section class="grid grid-cols-2 gap-3 sm:grid-cols-4">${[['计划',task.planQty],['实际接收',task.receivedQty],['累计加工',task.completedQty],['累计交出',task.returnedQty||0]].map(([label,qty])=>`<div class="rounded border p-3"><span class="text-sm text-muted-foreground">${label}</span><strong class="block">${qty} 片</strong></div>`).join('')}</section><div class="flex flex-wrap gap-2">${task.status==='已完结'?'':(surface && surface !== 'HANDOVER_RECEIVE' ? '' : button('SPECIAL_CRAFT_CONFIRM_RECEIVE','确认接收'))+(surface && surface !== 'EXECUTION' ? '' : button('SPECIAL_CRAFT_PROCESS_REPORT','加工填报'))+(surface && surface !== 'HANDOVER_HANDOUT' ? '' : button('SPECIAL_CRAFT_SUBMIT_HANDOVER','发起交出'))+(surface && surface !== 'EXECUTION' ? '' : button('SPECIAL_CRAFT_COMPLETE_ORDER','完成加工单'))}</div><details class="rounded border p-3" open><summary>接收记录（${receipts.length}）</summary><div class="mt-2 space-y-2 break-all text-sm">${receipts.map(r=>`<p>${escapeHtml(r)}</p>`).join('')||'尚未接收'}</div></details><details class="rounded border p-3"><summary>加工与交出记录（${records.length}）</summary><div class="mt-2 space-y-2 break-all text-sm">${records.map(r=>`<p>${escapeHtml(r.operatedAt)} · ${escapeHtml(r.operatedBy)} · ${{PROCESS_REPORT:'加工填报',HANDOVER:'发起交出',COMPLETE:'完单'}[r.action]} ${r.qty} 片 · ${escapeHtml(r.recordId)}</p>`).join('')||'尚无记录'}</div></details></div>`
}
export function handleWoolCraftActionUi(target:HTMLElement):boolean{
 const actionNode=target.closest<HTMLElement>('[data-special-craft-web-action]'),save=target.closest<HTMLElement>('[data-wool-craft-save]'),close=target.closest('[data-wool-craft-close]')
 if(close){document.getElementById('wool-craft-dialog')?.remove();return true}
 if(save){
  const dialog=save.closest<HTMLElement>('#wool-craft-dialog')!,error=dialog.querySelector<HTMLElement>('[data-error]')!
  try{const task=listWoolCraftTaskOrders().find(t=>t.taskOrderId===dialog.dataset.taskId)!,session=getPdaSession();
   if(appStore.getState().pathname.includes('/pda')&&(!session||session.factoryId!==task.factoryId))throw new Error('当前工厂不能操作此工艺单')
   executeWoolCraftAction({taskOrderId:task.taskOrderId,actionCode:dialog.dataset.action!,qty:Number(dialog.querySelector<HTMLInputElement>('[name="qty"]')?.value||0),operatorName:session?.userName||'工艺主管',operatedAt:new Date().toLocaleString('sv-SE'),commandId:dialog.dataset.command!})
   dialog.remove();const fresh=listWoolCraftTaskOrders().find(t=>t.taskOrderId===task.taskOrderId)!,detail=document.querySelector<HTMLElement>('[data-wool-craft-detail]')
   if(detail)detail.outerHTML=renderWoolCraftDetail(fresh, detail.dataset.surface || undefined)
   else appStore.navigate(appStore.getState().pathname,{historyMode:'replace'})
  }catch(e){error.textContent=e instanceof Error?e.message:String(e)}return true
 }
 if(!actionNode?.dataset.sourceId?.startsWith('WSC:'))return false
 const task=listWoolCraftTaskOrders().find(t=>t.taskOrderId===actionNode.dataset.sourceId)
 if(!task)return false
 const action=actionNode.dataset.actionCode!,isPda=appStore.getState().pathname.includes('/pda')
 if(action==='SPECIAL_CRAFT_CONFIRM_RECEIVE'){appStore.navigate(`/fcs/${isPda?'pda':'craft'}/wool/pending-receipts?craftOrderId=${encodeURIComponent(task.taskOrderId)}${isPda?'&pda=1':''}`);return true}
 const max=action==='SPECIAL_CRAFT_PROCESS_REPORT'?task.receivedQty-task.completedQty:task.completedQty-(task.returnedQty||0)
 const label=action==='SPECIAL_CRAFT_PROCESS_REPORT'?'加工填报':action==='SPECIAL_CRAFT_SUBMIT_HANDOVER'?'发起交出':'完成加工单'
 document.getElementById('wool-craft-dialog')?.remove()
 document.body.insertAdjacentHTML('beforeend',`<div id="wool-craft-dialog" class="fixed inset-0 z-[160] flex items-center justify-center bg-black/40 p-3" data-task-id="${escapeHtml(task.taskOrderId)}" data-action="${action}" data-command="${crypto.randomUUID()}"><section role="dialog" aria-modal="true" aria-label="${label}" class="max-h-[90vh] w-full max-w-md overflow-auto rounded bg-white p-5"><h2 class="font-semibold">${label} · ${escapeHtml(task.partName||'毛织片')}</h2><p class="mt-2 text-sm">${escapeHtml(task.factoryName)} · ${escapeHtml(task.taskOrderNo)}</p>${action==='SPECIAL_CRAFT_COMPLETE_ORDER'?'<p class="mt-3 text-sm">系统将核对计划加工、交出及直接下游实收是否闭合。</p>':`<label class="mt-3 block">本次数量（片）<input name="qty" aria-label="本次数量（片）" type="number" min="1" max="${max}" step="1" class="mt-1 h-10 w-full rounded border px-3" value="${max}"></label><p class="text-sm">本次最多 ${max} 片</p>`}<p data-error class="my-2 text-sm text-red-700"></p><div class="flex justify-end gap-2"><button data-wool-craft-close data-skip-page-rerender="true" class="rounded border px-3 py-2">取消</button><button data-wool-craft-save data-skip-page-rerender="true" class="rounded bg-blue-600 px-3 py-2 text-white">确认${label}</button></div></section></div>`)
 const dialog = document.getElementById('wool-craft-dialog')!
 dialog.tabIndex = -1
 dialog.focus()
 dialog.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); dialog.remove() } })
 dialog.addEventListener('click',e=>{const t=e.target as HTMLElement;if(t===dialog){e.stopPropagation();dialog.remove()}else if(t.closest('[data-wool-craft-save],[data-wool-craft-close]')){e.stopPropagation();handleWoolCraftActionUi(t)}})
 return true
}
