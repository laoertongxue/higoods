import { escapeHtml as e } from '../../../../utils.ts'
import { washingCanExecute, type WashingCommand, type WashingOrder, type WashingRoll } from '../../../../data/fcs/fabric-washing-model.ts'

export const washingExecutionLabels = {
  send: '印花交给染厂', receive: '登记逐卷实收', start: '投入洗水',
  output: '登记实际产出', handout: '交回原接收方', 'downstream-receive': '登记下游实收',
} as const
export type WashingExecutionAction = keyof typeof washingExecutionLabels
export const isWashingExecutionAction = (value?:string):value is WashingExecutionAction => !!value && Object.hasOwn(washingExecutionLabels,value)

/** Each dialog contains only physical rolls that can perform its named action. */
export function washingExecutionRolls(order:WashingOrder,action:WashingExecutionAction):WashingRoll[] {
  if(order.cancelledAt || order.completedAt || order.exception)return []
  if(action!=='downstream-receive' && !washingCanExecute(order))return []
  return order.rolls.filter(roll=>{
    switch(action){
      case 'send':return !roll.sentAt
      case 'receive':return !!roll.sentAt && !roll.receivedAt
      case 'start':return !!roll.receivedAt && !roll.startedAt
      case 'output':return !!roll.startedAt && !roll.completedAt
      case 'handout':return !!roll.completedAt && !roll.handedOutAt
      case 'downstream-receive':return !!roll.handedOutAt && !roll.downstreamReceivedAt
    }
  })
}

type DialogOptions = {
  image:(url:string,name:string,size?:string)=>string
  button:(label:string,action:string,attrs?:string,primary?:boolean)=>string
  positions:Array<{value:string;label:string}>
}
const quantity = (value:number|undefined,unit:string) => value===undefined?'—':`${value} ${unit}`
const hasQuantity = (action:WashingExecutionAction) => ['receive','output','downstream-receive'].includes(action)
const expectedQuantity = (roll:WashingRoll,action:WashingExecutionAction) => action==='receive'?roll.inputQty:action==='output'?roll.receivedQty:roll.outputQty

export function renderWashingExecutionDialog(order:WashingOrder,action:WashingExecutionAction,options:DialogOptions):string {
  const rolls=washingExecutionRolls(order,action),measured=hasQuantity(action),scanning=action==='send'||action==='handout'
  const title=washingExecutionLabels[action],qtyLabel=action==='output'?'实际产出':'实收数量'
  const button=(label:string,value:string,primary=false)=>options.button(label,value,'',primary).replace('data-fabric-washing-action','data-washing-operation-action')
  const destination=action==='send'?order.assignedFactoryName||'GTG':action==='handout'||action==='downstream-receive'?order.source.target?.name||'原接收方待核对':''
  const central=action==='downstream-receive'&&!!order.source.target?.warehouseId
  const position=action==='receive'||action==='downstream-receive'
  return `<dialog aria-labelledby="washing-operation-title" aria-describedby="washing-operation-context" data-washing-operation="${action}" data-washing-operation-revision="${order.revision}" class="m-auto max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-2xl overflow-hidden rounded-xl border p-0 shadow-xl backdrop:bg-black/40"><div class="flex max-h-[calc(100dvh-1rem)] flex-col">
    <header class="flex shrink-0 items-center justify-between gap-3 border-b p-4"><h2 id="washing-operation-title" class="text-lg font-semibold">${title}</h2>${button('关闭','close')}</header>
    <div class="min-h-0 space-y-4 overflow-y-auto p-4" data-washing-operation-body>
      <div class="flex items-center gap-3">${options.image(order.source.imageUrl,order.source.materialName,'h-12 w-12')}<div class="min-w-0 text-sm" id="washing-operation-context"><strong>${e(order.source.materialName)}</strong><p class="break-words text-slate-500">${e(order.no)} · ${e(order.source.materialSku)}</p>${destination?`<p class="mt-1">${action==='send'?'承接染厂':'下游'}：${e(destination)}</p>`:''}</div></div>
      <fieldset class="space-y-3" data-washing-operation-fields><legend class="mb-2 text-sm font-medium">${scanning?'核对本次交出的卷':'选择本次操作的卷'} <span class="font-normal text-slate-500" data-washing-operation-count>已选 0 / ${rolls.length} 卷</span></legend>
      ${rolls.map(roll=>{
        const code=action==='handout'||action==='downstream-receive'?roll.outputBarcode||roll.barcode:roll.barcode
        const expected=expectedQuantity(roll,action)
        const reference=action==='receive'?'印花交出':action==='start'?'已实收':action==='output'?'实际投入':action==='downstream-receive'?'染厂交回':'本次可交出'
        const referenceQty=action==='send'||action==='receive'?roll.inputQty:action==='start'||action==='output'?roll.receivedQty:roll.outputQty
        return `<article class="space-y-2 rounded-lg border p-3" data-washing-dialog-roll="${e(roll.id)}"><label class="flex items-start gap-3"><input type="checkbox" class="mt-0.5 h-5 w-5 shrink-0" data-preserve-native-click="true" data-washing-exec-roll="${e(roll.id)}"><span class="min-w-0 break-all font-medium">${e(code)}</span></label><p class="text-sm text-slate-600">${reference} ${e(quantity(referenceQty,roll.unit))}${code!==roll.barcode?` · 原卷 ${e(roll.barcode)}`:''}</p>
        ${measured?`<label class="block text-sm">${qtyLabel} (${e(roll.unit)})<input type="number" min="0" step="any" ${action==='output'?'':`max="${expected}"`} inputmode="decimal" class="mt-1 block min-h-10 w-full rounded border px-3" aria-label="${e(roll.barcode)}${qtyLabel}" data-washing-qty="${e(roll.id)}" data-washing-expected="${expected}"></label>`:''}
        ${action==='output'?`<label class="block text-sm">重包新卷码 (选填)<input class="mt-1 block min-h-10 w-full rounded border px-3" aria-label="${e(roll.barcode)}重包新卷码" placeholder="留空保留原卷码" data-washing-output-code="${e(roll.id)}"></label>`:''}</article>`
      }).join('')}
      ${position?(central?`<label class="block text-sm">本次实际收货库位<input class="mt-1 block min-h-10 w-full rounded border px-3" aria-label="本次实际收货库位" data-washing-central-location></label>`:`<label class="block text-sm">${action==='receive'?'GTG 实际接收库位':'下游实际接收库位'}<select class="mt-1 block min-h-10 w-full rounded border px-3" data-washing-position><option value="">选择实际库位</option>${options.positions.map(p=>`<option value="${e(p.value)}">${e(p.label)}</option>`).join('')}</select></label>`):''}
      ${scanning?`<div class="flex flex-wrap items-end gap-2"><label class="min-w-0 flex-1 text-sm">扫描或手输实际卷码<input class="mt-1 block min-h-10 w-full rounded border px-3" aria-label="扫描或手输实际卷码" data-washing-scan></label>${button('核对卷码','scan')}</div><p class="break-all text-sm text-blue-800" data-washing-scans>尚未核对卷码</p>`:''}
      ${measured?'<div data-washing-difference-row hidden><label class="flex gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm"><input type="checkbox" class="mt-0.5 h-5 w-5 shrink-0" data-preserve-native-click="true" data-washing-difference>已核对所选卷的数量变化，确认按本次实测数量记录</label></div>':''}</fieldset>
      <p class="empty:hidden text-sm text-red-700" role="alert" data-washing-operation-error></p>
      <div class="space-y-3 rounded border border-amber-200 bg-amber-50 p-3" data-washing-discard-confirm hidden><p class="text-sm">本次填写尚未保存，关闭后不保留。</p><div class="flex flex-wrap gap-2">${button('继续填写','continue')}${button('放弃填写并关闭','discard')}</div></div>
    </div><footer class="flex shrink-0 justify-end gap-3 border-t p-4">${button('取消','close')}${button('确认'+title,'submit',true)}</footer>
  </div></dialog>`
}

/** The command carries only fields used by the selected physical operation. */
export function washingExecutionCommand(order:WashingOrder,action:WashingExecutionAction,dialog:HTMLElement,codes:string[]):WashingCommand {
  const ids=[...dialog.querySelectorAll<HTMLInputElement>('[data-washing-exec-roll]:checked')].map(input=>input.dataset.washingExecRoll!)
  const allowed=washingExecutionRolls(order,action)
  if(!ids.length || ids.some(id=>!allowed.some(roll=>roll.id===id)))throw new Error('请选择本次可操作的卷。')
  const selected=ids.map(id=>allowed.find(roll=>roll.id===id)!)
  const lines=hasQuantity(action)?selected.map(roll=>{
    const value=dialog.querySelector<HTMLInputElement>(`[data-washing-qty="${CSS.escape(roll.id)}"]`)!.value
    const qty=value===''?NaN:Number(value)
    if(!Number.isFinite(qty)||qty<=0)throw new Error('请填写所选卷大于零的实际数量。')
    return {rollId:roll.id,qty,barcode:roll.barcode}
  }):[]
  const position=dialog.querySelector<HTMLSelectElement>('[data-washing-position]')?.value.split('|')||[]
  const differenceConfirmed=dialog.querySelector<HTMLInputElement>('[data-washing-difference]')?.checked??false
  switch(action){
    case 'send':return {type:'SEND',orderId:order.id,rollIds:ids,scannedCodes:codes}
    case 'receive':return {type:'RECEIVE',orderId:order.id,lines,warehouseId:position[0]||'',locationId:position[1]||'',differenceConfirmed}
    case 'start':return {type:'START',orderId:order.id,rollIds:ids}
    case 'output':return {type:'OUTPUT',orderId:order.id,lines:lines.map(line=>({...line,barcode:dialog.querySelector<HTMLInputElement>(`[data-washing-output-code="${CSS.escape(line.rollId)}"]`)?.value.trim()||line.barcode})),differenceConfirmed}
    case 'handout':if(!order.source.target)throw new Error('原接收方待核对，请跟单先核对实际接收方。');return {type:'HANDOUT',orderId:order.id,rollIds:ids,scannedCodes:codes,target:order.source.target}
    case 'downstream-receive':return {type:'DOWNSTREAM_RECEIVE',orderId:order.id,lines,differenceConfirmed,...(order.source.target?.warehouseId?{warehouseId:order.source.target.warehouseId,locationId:dialog.querySelector<HTMLInputElement>('[data-washing-central-location]')?.value||''}:{warehouseId:position[0]||'',locationId:position[1]||''})}
  }
}

export function openWashingExecutionDialog(root:HTMLElement,order:WashingOrder,action:WashingExecutionAction,options:DialogOptions & {
  trigger:HTMLElement
  submit:(command:WashingCommand,revision:number)=>Promise<void>
  saved:(command:WashingCommand)=>void
}):void {
  if(root.querySelector('[data-washing-operation]'))return
  if(!washingExecutionRolls(order,action).length)throw new Error('当前没有可执行本操作的卷，请刷新单据后核对。')
  const slot=root.querySelector<HTMLElement>('[data-washing-operation-slot]')!
  slot.innerHTML=renderWashingExecutionDialog(order,action,options)
  const dialog=slot.querySelector<HTMLDialogElement>('dialog')!,fields=dialog.querySelector<HTMLFieldSetElement>('[data-washing-operation-fields]')!
  const codes=new Set<string>(),eligible=washingExecutionRolls(order,action)
  const error=dialog.querySelector<HTMLElement>('[data-washing-operation-error]')!
  let dirty=false,pending=false
  const beforeUnload=(event:BeforeUnloadEvent)=>{
    if(!dialog.isConnected){window.removeEventListener('beforeunload',beforeUnload);return}
    if(dirty||pending){event.preventDefault();event.returnValue=''}
  }
  const close=()=>{window.removeEventListener('beforeunload',beforeUnload);dialog.close();dialog.remove();if(options.trigger.isConnected)options.trigger.focus()}
  const requestClose=()=>{
    if(pending)return
    if(!dirty){close();return}
    dialog.querySelector<HTMLElement>('[data-washing-discard-confirm]')!.hidden=false
    dialog.querySelector<HTMLButtonElement>('[data-washing-operation-action="continue"]')!.focus()
  }
  const update=()=>{
    const ids=[...dialog.querySelectorAll<HTMLInputElement>('[data-washing-exec-roll]:checked')].map(input=>input.dataset.washingExecRoll!)
    dialog.querySelector('[data-washing-operation-count]')!.textContent=`已选 ${ids.length} / ${eligible.length} 卷`
    const difference=dialog.querySelector<HTMLElement>('[data-washing-difference-row]')
    if(difference){
      const changed=ids.some(id=>{const input=dialog.querySelector<HTMLInputElement>(`[data-washing-qty="${CSS.escape(id)}"]`)!;return input.value!==''&&Number.isFinite(Number(input.value))&&Number(input.value)>0&&Number(input.value)!==Number(input.dataset.washingExpected)})
      difference.hidden=!changed
      if(!changed)dialog.querySelector<HTMLInputElement>('[data-washing-difference]')!.checked=false
    }
    const scanned=dialog.querySelector('[data-washing-scans]');if(scanned)scanned.textContent=codes.size?'已核对：'+[...codes].join('、'):'尚未核对卷码'
  }
  const scan=()=>{
    const input=dialog.querySelector<HTMLInputElement>('[data-washing-scan]')!,code=input.value.trim()
    const roll=eligible.find(roll=>(action==='handout'?roll.outputBarcode||roll.barcode:roll.barcode)===code)
    if(!roll)throw new Error('卷码不在本次可交出范围，请核对实际面料。')
    if(codes.has(code))throw new Error('本卷已经核对，不能重复扫描。')
    codes.add(code);dialog.querySelector<HTMLInputElement>(`[data-washing-exec-roll="${CSS.escape(roll.id)}"]`)!.checked=true
    dirty=true;input.value='';update();input.focus()
  }
  for(const type of ['input','change'])dialog.addEventListener(type,event=>{
    event.stopPropagation();const input=event.target as HTMLInputElement
    if(pending)return
    dirty=true;error.textContent=''
    if(input.matches('[data-washing-qty], [data-washing-output-code]')&&input.value!=='')input.closest('[data-washing-dialog-roll]')!.querySelector<HTMLInputElement>('[data-washing-exec-roll]')!.checked=true
    if(input.matches('[data-washing-qty], [data-washing-exec-roll]')){
      const confirm=dialog.querySelector<HTMLInputElement>('[data-washing-difference]');if(confirm)confirm.checked=false
    }
    if(input.matches('[data-washing-exec-roll]')&&!input.checked){const roll=eligible.find(roll=>roll.id===input.dataset.washingExecRoll)!;codes.delete(action==='handout'?roll.outputBarcode||roll.barcode:roll.barcode)}
    update()
  })
  dialog.addEventListener('cancel',event=>{event.preventDefault();requestClose()})
  dialog.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&(event.target as HTMLElement).matches('[data-washing-scan]')){
      event.preventDefault();event.stopPropagation();if(pending)return
      try{error.textContent='';scan()}catch(err){error.textContent=err instanceof Error?err.message:String(err)}
    }
  })
  dialog.addEventListener('click',async event=>{
    const target=event.target as HTMLElement,control=target.closest<HTMLElement>('[data-washing-operation-action]')
    if(target===dialog){requestClose();return}
    if(!control)return
    event.preventDefault();event.stopPropagation();if(pending)return
    const value=control.dataset.washingOperationAction
    if(value==='close'){requestClose();return}
    if(value==='continue'){dialog.querySelector<HTMLElement>('[data-washing-discard-confirm]')!.hidden=true;return}
    if(value==='discard'){close();return}
    error.textContent=''
    try{
      if(value==='scan'){scan();return}
      if(value!=='submit')return
      const command=washingExecutionCommand(order,action,dialog,[...codes])
      pending=true;fields.disabled=true;dialog.querySelectorAll<HTMLButtonElement>('button').forEach(button=>{button.disabled=true});dialog.setAttribute('aria-busy','true')
      await options.submit(command,order.revision)
      close();options.saved(command)
    }catch(err){error.textContent='未保存：'+(err instanceof Error?err.message:String(err));error.scrollIntoView({block:'nearest'})}
    finally{pending=false;fields.disabled=false;dialog.querySelectorAll<HTMLButtonElement>('button').forEach(button=>{button.disabled=false});dialog.removeAttribute('aria-busy')}
  })
  window.addEventListener('beforeunload',beforeUnload)
  dialog.showModal()
}
