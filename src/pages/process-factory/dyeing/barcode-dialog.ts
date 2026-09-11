import { escapeHtml as e } from '../../../utils.ts'
import { renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderCode128Barcode } from '../../../components/real-barcode.ts'
import { listDyeWorkOrderOnlineRows, type DyeWorkOrderOnlineRow } from '../../../data/fcs/dye-work-order-online-view.ts'
import { dyeLengthMeters } from '../../../data/fcs/dye-work-order-demo-details.ts'
import { getDyeOutputRolls, saveDyeOutputRolls, deleteDyeOutputRolls, markDyeOutputRolls, type DyeOutputRoll } from '../../../data/fcs/dyeing-task-domain.ts'

let orderId = '', from = '', to = '', dateFrom = '', dateTo = '', keyword = ''
let page = 1, pageSize = 20
let editorIds: string[] = [], editorMode: 'add' | 'edit' | 'copy' | 'batch' = 'add'
let importRows: Partial<DyeOutputRoll>[] = [], printingIds: string[] = []
const selected = new Set<string>()
const button = (label: string, action: string, id = '') => renderSecondaryButton(label, {prefix: 'dye-barcode', action}).replace('<button', `<button data-id="${e(id)}"`)
let currentRow: DyeWorkOrderOnlineRow | undefined
let afterClose: (() => void) | undefined
function closeDialog() { root()?.remove(); const callback = afterClose; afterClose = undefined; callback?.() }
const rowInfo = () => { if (!currentRow) throw new Error('未找到染色加工单'); return currentRow }
const root = () => document.querySelector<HTMLElement>('[data-dye-barcode-root]')
const input = (name: string, label: string, value = '', type = 'text') => `<label class="block text-sm">${e(label)}<input data-dye-barcode-field="${name}" data-skip-page-rerender="true" type="${type}" ${type === 'number' ? 'step="any" min="0"' : ''} value="${e(value)}" class="mt-1 h-9 w-full rounded border bg-white px-2"></label>`
const value = (name: string) => root()?.querySelector<HTMLInputElement>(`[data-dye-barcode-field="${name}"]`)?.value.trim() || ''
function number(name: string, label: string) { const raw = value(name); if (!raw) throw new Error(`请填写${label}。`); const n = Number(raw); if (!Number.isFinite(n) || n < 0) throw new Error(`${label}必须是有效非负数。`); return n }
const filtered = () => getDyeOutputRolls(orderId).filter(roll => (!from || Number(roll.rollNo) >= Number(from)) && (!to || Number(roll.rollNo) <= Number(to)) && (!dateFrom || roll.createdAt >= dateFrom.replace('T', ' ')) && (!dateTo || roll.createdAt <= dateTo.replace('T', ' ') + ':59') && (!keyword || `${roll.barcode} ${roll.vatNo}`.toLowerCase().includes(keyword.toLowerCase())))
function thumb(url: string, title: string) { return `<button type="button" data-skip-page-rerender="true" data-pda-image-preview-url="${e(url)}" data-pda-image-preview-title="${e(title)}" aria-label="查看${e(title)}大图" class="relative h-10 w-10 shrink-0 overflow-hidden rounded border"><img class="h-full w-full object-contain" src="${e(url)}" alt="${e(title)}" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败'"><span class="absolute inset-0 bg-white text-[10px]">加载中</span></button>` }
function table(headers: string[], rows: string[][]) { return `<div class="overflow-auto border"><table class="w-full text-left text-xs"><thead><tr>${headers.map(h => `<th class="whitespace-nowrap border-b bg-slate-50 p-2">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(cells => `<tr>${cells.map(cell => `<td class="border-b p-2 align-middle">${cell}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${headers.length}" class="p-6 text-center">没有符合条件的条码</td></tr>`}</tbody></table></div>` }
function renderBody() {
  const row = rowInfo(), rolls = filtered(), pages = Math.max(1, Math.ceil(rolls.length / pageSize)); page = Math.min(page, pages)
  const visible = rolls.slice((page - 1) * pageSize, page * pageSize)
  return `<div class="mb-4 flex items-center gap-3">${thumb(row.productImageUrl, row.productName)}<div class="text-sm">关联单号：<strong>${e(row.workOrderNo)}</strong><div class="text-xs text-slate-500">${e(row.productCode)} · ${e(row.productName)}</div></div></div>
  <div class="mb-4 grid grid-cols-2 items-end gap-3 md:grid-cols-6">${input('from', '卷码起', from, 'number')}${input('to', '卷码止', to, 'number')}${input('dateFrom', '创建时间起', dateFrom, 'datetime-local')}${input('dateTo', '创建时间止', dateTo, 'datetime-local')}${input('keyword', '条码 / 缸号', keyword)}<div class="flex gap-2">${button('查询', 'search')}${button('重置', 'reset')}</div></div>
  <div class="mb-3 flex flex-wrap items-center gap-2">${button('批量修改', 'batch')}${button('批量打印', 'print-selected')}${button('补充条码', 'add')}${button('批量删除', 'delete')}${button('导入细码', 'import')}${button('批量下架到待出库区', 'stage')}<span class="text-xs" data-dye-barcode-selected>已选 ${selected.size}</span></div>
  <div class="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs"><span>总卷数：<b>${rolls.length}</b>　总长度：<b>${rolls.reduce((n,r) => n+r.qty,0).toFixed(2)}</b> ${e(row.qtyUnit)}　实称总重量：<b>${rolls.reduce((n,r) => n+r.weightKg,0).toFixed(3)}</b> kg</span><label>每页 <select data-dye-barcode-field="pageSize" class="rounded border p-1">${[10,20,50].map(n=>`<option ${n===pageSize?'selected':''}>${n}</option>`).join('')}</select> 条</label></div>
  ${table([`<input aria-label="全选本页条码" type="checkbox" data-dye-barcode-action="select-page" ${visible.length && visible.every(r => selected.has(r.id)) ? 'checked' : ''}>`, 'ID', '条码', '关联单号', 'SKU / 物料', '状态', '入库状态', '卷号', `卷长 (${e(row.qtyUnit)})`, '实称重量 (KG)', '克重 (g/m²)', '幅宽 (cm)', '入库仓库 / 库位', '入库时间', '打印人', '打印时间', '操作'], visible.map(roll => [
    `<input aria-label="选择条码 ${e(roll.rollNo)}" type="checkbox" data-dye-barcode-select="${e(roll.id)}" ${selected.has(roll.id)?'checked':''}>`, e(roll.id), `<span class="whitespace-nowrap">${e(roll.barcode)}</span>`, e(row.workOrderNo), `<div class="flex min-w-52 items-center gap-2">${thumb(row.outputImageUrl, `${row.materialName} ${row.targetColorName}`)}<div>${e(row.colorSku)}<br>${e(row.materialName)} · ${e(row.targetColorName)}</div></div>`, roll.dispatchId ? '已交出' : roll.stagedAt ? '待出库' : roll.qty > 0 ? '已维护' : '草稿', e(roll.inboundStatus || '未入库'), e(roll.rollNo), roll.qty.toFixed(2), roll.weightKg.toFixed(3), roll.gsm.toFixed(2), String(roll.widthCm), `${e(roll.warehouseName || row.receiverWarehouseName)}<br>${e(roll.stagedAt ? '待出库区' : roll.locationName || '待上架')}`, e(roll.inboundAt || '尚未入库'), e(roll.printedBy || '尚未打印'), e(roll.printedAt || '尚未打印'), `<div class="flex whitespace-nowrap gap-1">${button('编辑','edit',roll.id)}${button('打印条码','print-one',roll.id)}${button('复制新增','copy',roll.id)}</div>`]))}
  <div class="mt-3 flex justify-between text-xs"><span>共 ${rolls.length} 条，第 ${page} / ${pages} 页</span><div class="flex items-center gap-2">${button('上一页','prev')}${button('下一页','next')}<label>跳转到 <input type="number" min="1" max="${pages}" class="w-14 rounded border p-1" data-dye-barcode-field="jump" value="${page}"> 页</label>${button('确定','jump')}</div></div><p class="mt-3 text-xs text-slate-500">条码维护不改变加工完成数量。入库状态只表示本卷的入库记录。</p>`
}
function refresh() { const body = root()?.querySelector('[data-dye-barcode-body]'); if (body) body.innerHTML = renderBody() }
function showError(message: string) { const el = root()?.querySelector('[data-dye-barcode-error]'); if (el) el.textContent = message; const inner = root()?.querySelector('[data-dye-barcode-inner-error]'); if (inner) inner.textContent = message }
function closeInner() { root()?.querySelector('[data-dye-barcode-inner]')?.remove(); importRows = []; printingIds = []; root()?.focus() }
function modal(title: string, body: string, footer: string) {
  closeInner()
  root()?.insertAdjacentHTML('beforeend', `<div class="absolute inset-0 z-10 flex items-center justify-center bg-black/30 p-4" data-dye-barcode-inner><section role="dialog" aria-modal="true" aria-label="${e(title)}" class="flex max-h-[86vh] w-full max-w-xl flex-col rounded-lg bg-white shadow-xl"><header class="flex items-center justify-between border-b p-3"><h3 class="font-semibold">${e(title)}</h3>${button('关闭','close-inner')}</header><div class="overflow-auto p-4">${body}<p role="alert" class="mt-2 text-sm text-red-700" data-dye-barcode-inner-error></p></div><footer class="flex justify-end gap-2 border-t p-3">${footer}</footer></section></div>`)
}
function editor(mode: typeof editorMode, ids: string[]) {
  editorMode = mode; editorIds = ids
  const row = rowInfo(), roll = getDyeOutputRolls(orderId).find(r=>r.id===ids[0]), batch = mode === 'batch', fresh = mode === 'copy' || mode === 'add'
  const get = (key: keyof DyeOutputRoll, fallback: number|string = '') => batch ? '' : String(roll?.[key] ?? fallback)
  modal(batch ? `批量修改 ${ids.length} 卷` : mode === 'copy' ? '新增条码' : mode === 'edit' ? '编辑条码' : '补充条码',
    `${roll ? `<p class="mb-2 text-xs text-slate-500">参照条码：${e(roll.barcode)}</p>` : ''}<p class="mb-3 text-xs text-amber-700">${batch ? '只修改填写的字段，留空保持各卷原值。' : '卷长与米数可相互换算。'}实称重量按现场称重填写，理论重量仅供参考。</p><div class="grid grid-cols-2 gap-3" data-dye-barcode-editor>
    ${input('qty', `卷长 (${row.qtyUnit})`, batch ? '' : fresh ? '0' : get('qty',0),'number')}${!batch && dyeLengthMeters(1,row.qtyUnit) !== null ? input('meters','米数 (M)', batch ? '' : fresh ? '0' : (dyeLengthMeters(roll?.qty || 0,row.qtyUnit) || 0).toFixed(2),'number') : ''}
    ${input('weightKg','实称重量 (KG)', batch ? '' : fresh ? '0' : get('weightKg',0),'number')}${input('gsm','克重 (g/m²)',get('gsm',row.weightGsm || 0),'number')}${input('widthCm','幅宽 (cm)',get('widthCm',parseFloat(row.width) || 0),'number')}${input('vatNo','缸号',get('vatNo'))}<div class="col-span-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600"><div>理论重量${batch ? '合计' : ''}（仅参考）：<output data-dye-barcode-theory aria-live="polite"></output></div><div class="mt-1">卷长（米）× 幅宽（米）× 克重（g/m²）÷ 1000</div></div><label class="col-span-2 text-sm">备注<textarea data-dye-barcode-field="remark" class="mt-1 min-h-20 w-full rounded border p-2" placeholder="打印时追加到标签末尾">${e(get('remark'))}</textarea></label></div>`, button('确定','save')+button('取消','close-inner'))
  updateTheory()
}
function theoreticalWeight(qty: number, unit: string, widthCm: number, gsm: number): number | null {
  const meters = dyeLengthMeters(qty, unit)
  if (meters === null || ![qty, widthCm, gsm].every(Number.isFinite) || qty < 0 || widthCm <= 0 || gsm <= 0) return null
  return meters * widthCm / 100 * gsm / 1000
}
function updateTheory() {
  const output = root()?.querySelector<HTMLOutputElement>('[data-dye-barcode-theory]')
  if (!output) return
  const unit = rowInfo().qtyUnit
  const fallback = editorMode === 'batch' ? getDyeOutputRolls(orderId).filter(roll => editorIds.includes(roll.id)) : [undefined]
  const weights = fallback.map(roll => {
    const field = (key: 'qty' | 'widthCm' | 'gsm') => value(key) ? Number(value(key)) : roll?.[key] ?? NaN
    return theoreticalWeight(field('qty'), unit, field('widthCm'), field('gsm'))
  })
  output.textContent = dyeLengthMeters(1, unit) === null ? '不适用（非长度计量）'
    : weights.some(weight => weight === null) ? '填写有效卷长、幅宽和克重后显示'
    : `${weights.reduce<number>((sum, weight) => sum + weight!, 0).toFixed(3)} kg`
}
function convert(fieldName: string) {
  if (!['qty','meters','weightKg','gsm','widthCm'].includes(fieldName)) return
  if (editorMode === 'batch') { updateTheory(); return }
  const row = rowInfo(), factor = dyeLengthMeters(1,row.qtyUnit)
  const source = Number(value(fieldName))
  if (!value(fieldName) || !Number.isFinite(source) || source < 0) { updateTheory(); showError('请输入有效的非负数字。'); return }
  if (factor !== null && (fieldName === 'qty' || fieldName === 'meters')) {
    const counterpart = fieldName === 'qty' ? 'meters' : 'qty'
    const el = root()?.querySelector<HTMLInputElement>(`[data-dye-barcode-field="${counterpart}"]`)
    if (el) el.value = (fieldName === 'qty' ? source * factor : source / factor).toFixed(2)
  }
  updateTheory()
  showError('')
}
function requireSelection() { if (!selected.size) throw new Error('请先选择条码。'); return [...selected] }
function preview(ids: string[]) {
  const row = rowInfo(), rolls = getDyeOutputRolls(orderId).filter(r=>ids.includes(r.id))
  if (!rolls.length || rolls.some(r=>r.qty<=0)) throw new Error('请先维护有效卷长，再打印。')
  modal('条码打印预览', '<iframe title="染色产出卷标签" class="h-[58vh] w-full border" data-dye-barcode-print></iframe>',button('打印','print')+button('返回','close-inner'))
  printingIds = ids
  const frame = root()!.querySelector<HTMLIFrameElement>('[data-dye-barcode-print]')!
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:100mm 100mm;margin:4mm}body{font:12px Arial;margin:0}section{box-sizing:border-box;width:90mm;height:90mm;border:1px solid;padding:4mm;break-after:page}section:last-child{break-after:auto}svg{width:80mm;height:18mm}img{width:15mm;height:15mm;object-fit:contain;float:right}h2{font-size:18px}p{margin:6px 0}</style></head><body>${rolls.map(roll=>`<section><img src="${e(row.outputImageUrl)}" alt="${e(row.materialName)}"><h2>${e(row.workOrderNo)} · ${e(roll.rollNo)}</h2><p>${e(row.materialName)} · ${e(row.targetColorName)}</p><p>${e(row.colorSku)}</p>${renderCode128Barcode(roll.barcode,roll.barcode)}<p>${e(roll.barcode)}</p><p>卷长：${roll.qty.toFixed(2)} ${e(row.qtyUnit)}　实称重量：${roll.weightKg.toFixed(3)} kg</p><p>理论重量（仅参考）：${theoreticalWeight(roll.qty,row.qtyUnit,roll.widthCm,roll.gsm)?.toFixed(3) ?? '不适用'}${theoreticalWeight(roll.qty,row.qtyUnit,roll.widthCm,roll.gsm) === null ? '' : ' kg'}</p><p>幅宽：${roll.widthCm} cm　克重：${roll.gsm} g/m²</p><p>缸号：${e(roll.vatNo || '未分缸')}</p><p>${e(roll.remark)}</p></section>`).join('')}</body></html>`
}
export function openDyeBarcodeDialog(id: string, snapshot?: DyeWorkOrderOnlineRow, onClose?: () => void) {
  document.querySelector('[data-dye-output-root]')?.remove(); root()?.remove()
  afterClose = onClose
  orderId = id; currentRow = snapshot ?? listDyeWorkOrderOnlineRows().find(row => row.dyeOrderId === id); from = to = dateFrom = dateTo = keyword = ''; page = 1; selected.clear()
  if(currentRow?.isYarn){window.location.href=`/fcs/craft/dyeing/yarn-shipments?orderId=${encodeURIComponent(id)}`;return}
  const el = document.createElement('div'); el.dataset.dyeBarcodeRoot = ''; el.dataset.skipPageRerender = 'true'; el.className = 'fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4'; el.tabIndex = -1
  el.innerHTML = `<section role="dialog" aria-modal="true" aria-label="打印条码" class="flex max-h-[94vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-lg bg-white shadow-xl"><header class="flex items-center justify-between border-b p-3"><h2 class="font-semibold">打印条码 — ${e(rowInfo().workOrderNo)}</h2>${button('关闭','close')}</header><p role="alert" class="px-4 text-sm text-red-700" data-dye-barcode-error></p><main class="overflow-auto p-4" data-dye-barcode-body>${renderBody()}</main></section>`
  el.addEventListener('keydown', event=>{if(event.key==='Escape'){event.stopPropagation();el.querySelector('[data-dye-barcode-inner]') ? closeInner() : closeDialog()}})
  el.addEventListener('click', event=>{if(event.target===el) closeDialog(); else if((event.target as HTMLElement).matches('[data-dye-barcode-inner]')) closeInner()})
  el.addEventListener('input', event=>{const t=event.target as HTMLInputElement; if(t.dataset.dyeBarcodeField==='importText'){importRows=[];el.querySelector('[data-dye-barcode-import-preview]')!.innerHTML=''}; if(t.dataset.dyeBarcodeField && el.querySelector('[data-dye-barcode-editor]')) convert(t.dataset.dyeBarcodeField)})
  document.querySelector('[data-dye-work-orders-root], [data-dye-output-page]')?.appendChild(el); el.focus()
}
export function handleDyeBarcodeEvent(target: HTMLElement): boolean {
  if (!target.closest('[data-dye-barcode-root]')) return false
  const checkbox = target.closest<HTMLInputElement>('[data-dye-barcode-select]')
  if (checkbox) { checkbox.checked ? selected.add(checkbox.dataset.dyeBarcodeSelect!) : selected.delete(checkbox.dataset.dyeBarcodeSelect!); const label=root()?.querySelector('[data-dye-barcode-selected]'); if(label) label.textContent=`已选 ${selected.size}`; const head=root()?.querySelector<HTMLInputElement>('[data-dye-barcode-action="select-page"]'); if(head){const visible=filtered().slice((page-1)*pageSize,page*pageSize);head.checked=visible.length>0&&visible.every(r=>selected.has(r.id));head.indeterminate=!head.checked&&visible.some(r=>selected.has(r.id))}; return true }
  const control=target.closest<HTMLInputElement>('[data-dye-barcode-field]')
  if(control) { if(control.dataset.dyeBarcodeField==='pageSize' && Number(control.value)!==pageSize){ pageSize=Number(control.value);page=1;selected.clear();refresh() };return true }
  const node=target.closest<HTMLElement>('[data-dye-barcode-action]'); if(!node) return true
  const action=node.dataset.dyeBarcodeAction!, id=node.dataset.id || ''; showError('')
  try {
    if(action==='close'){closeDialog();return true}
    if(action==='close-inner'){closeInner();return true}
    if(action==='search'){const a=value('from'),b=value('to'),start=value('dateFrom'),end=value('dateTo');if((a && (!Number.isInteger(Number(a)) || Number(a)<1)) || (b && (!Number.isInteger(Number(b)) || Number(b)<1)) || (a && b && Number(a)>Number(b)) || (start && end && start>end)) throw new Error('请检查卷码或时间范围，起始值不能大于结束值。');from=a;to=b;dateFrom=start;dateTo=end;keyword=value('keyword');page=1;selected.clear()}
    if(action==='reset'){from=to=dateFrom=dateTo=keyword='';page=1;selected.clear()}
    if(action==='prev')page=Math.max(1,page-1)
    if(action==='next')page++
    if(action==='jump'){const n=number('jump','页码');if(!Number.isInteger(n)||n<1||n>Math.max(1,Math.ceil(filtered().length/pageSize)))throw new Error('页码超出范围。');page=n}
    if(action==='select-page'){const checked=(node as HTMLInputElement).checked;filtered().slice((page-1)*pageSize,page*pageSize).forEach(r=>checked?selected.add(r.id):selected.delete(r.id))}
    if(['add','edit','copy','batch'].includes(action)){editor(action as typeof editorMode,action==='batch'?requireSelection():id?[id]:[]);return true}
    if(action==='save'){
      const patch: Partial<DyeOutputRoll>={}
      for(const [key,label] of [['qty','卷长'],['weightKg','实称重量'],['gsm','克重'],['widthCm','幅宽']] as const){if(editorMode==='batch'&&!value(key))continue;patch[key]=number(key,label)}
      for(const key of ['vatNo','remark'] as const)if(editorMode!=='batch'||value(key))patch[key]=value(key)
      if(!Object.keys(patch).length)throw new Error('请至少填写一个需要修改的字段。')
      const edits=(editorMode==='edit'||editorMode==='batch')?editorIds.map(id=>({id,...patch})):[patch]
      saveDyeOutputRolls(orderId,edits);selected.clear();closeInner()
    }
    if(action==='delete'||action==='stage'){const ids=requireSelection();modal(action==='delete'?'确认删除条码':'确认下架到待出库区',`<p>本次选择 ${ids.length} 卷。${action==='delete'?'仅允许删除未被交出单占用的卷。':'下架后显示待出库区，不表示接收方已入库。'}</p>`,button('确认',`confirm-${action}`)+button('取消','close-inner'));return true}
    if(action==='confirm-delete'){deleteDyeOutputRolls(orderId,requireSelection());selected.clear();closeInner()}
    if(action==='confirm-stage'){markDyeOutputRolls(orderId,requireSelection(),'stage');closeInner()}
    if(action==='record-printed'){markDyeOutputRolls(orderId,printingIds,'print');closeInner()}
    if(action==='print-one'||action==='print-selected'){preview(action==='print-one'?[id]:requireSelection());return true}
    if(action==='print'){const frame=root()?.querySelector<HTMLIFrameElement>('[data-dye-barcode-print]');if(!frame?.contentDocument?.querySelector('svg'))throw new Error('标签仍在加载，请稍后打印。');modalPrint(frame);return true}
    if(action==='import'){modal('导入细码',`<p class="mb-3 text-xs">粘贴 CSV / Excel 细码，每行：卷长,实称重量KG,克重,幅宽cm,缸号,备注。支持首行中文表头，最多 500 卷。所有行校验通过后才保存。</p><textarea data-dye-barcode-field="importText" class="min-h-48 w-full rounded border p-2" aria-label="细码内容" placeholder="23,4.10,130,150,G001,第一卷"></textarea><div data-dye-barcode-import-preview></div>`,button('校验预览','validate-import')+button('确认导入','commit-import')+button('取消','close-inner'));return true}
    if(action==='validate-import'){
      importRows=[];const lines=value('importText').split(/\r?\n/).filter(line=>line.trim());if(/卷长|数量/.test(lines[0]||''))lines.shift();if(!lines.length||lines.length>500)throw new Error('请提供 1～500 行细码。')
      const parsed=lines.map((line,i)=>{const cells=line.split(line.includes('\t')?'\t':',').map(v=>v.trim());if(cells.length<4||cells.slice(0,4).some(v=>v===''||!Number.isFinite(Number(v))||Number(v)<0)||Number(cells[0])<=0)throw new Error(`第 ${i+1} 行：请填写有效卷长、实称重量、克重、幅宽；卷长须大于 0。`);return{qty:Number(cells[0]),weightKg:Number(cells[1]),gsm:Number(cells[2]),widthCm:Number(cells[3]),vatNo:cells[4]||'',remark:cells.slice(5).join(',')}})
      importRows=parsed;root()!.querySelector('[data-dye-barcode-import-preview]')!.innerHTML=`<p class="my-2 text-sm text-green-700">校验通过 ${parsed.length} 卷，总长度 ${parsed.reduce((s,r)=>s+r.qty,0).toFixed(2)} ${e(rowInfo().qtyUnit)}</p>`+table(['卷长','实称重量','克重','幅宽','缸号'],parsed.slice(0,10).map(r=>[String(r.qty),String(r.weightKg),String(r.gsm),String(r.widthCm),e(r.vatNo)]));return true
    }
    if(action==='commit-import'){if(!importRows.length)throw new Error('请先校验预览。');saveDyeOutputRolls(orderId,importRows);closeInner();selected.clear()}
    refresh()
  }catch(error){showError(error instanceof Error?error.message:String(error))}
  return true
}
function modalPrint(frame: HTMLIFrameElement) {
  const ids=[...printingIds]
  frame.contentWindow!.print()
  // Explicit user confirmation after browser print prevents preview/cancellation being recorded as printing.
  modal('打印结果确认','<p>请确认标签已成功打印；取消打印请关闭此窗口。</p>',button('已成功打印','record-printed')+button('取消','close-inner'))
  printingIds=ids

}
