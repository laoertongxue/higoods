import { getTmfTipMaterialBalance } from '../../../../data/pms/tmf-material-purchases.ts'
import { escapeHtml as e } from '../../../../utils.ts'
import type { TmfCutOutput, TmfTipMaterialIssue } from '../../../../data/pms/tmf-material-purchases.ts'
import type { WebbingEndRequirement } from '../../../../data/fcs/webbing-specifications.ts'

const methods = { NONE: '无端头', METAL: '金属头', PLASTIC_WRAP: '塑料包头', SILICONE_DIP: '硅胶浸头' }
function input(name:string,label:string,type='text',value='') { return `<label class="block text-sm mt-2">${label}<input name="${name}" type="${type}" value="${e(value)}" class="mt-1 w-full rounded border p-2" ${type==='number'?'step="any" min="0"':''}></label>` }
export function renderTmfTippingForm(output:TmfCutOutput, materials:TmfTipMaterialIssue[]):string {
  const end=(name:'A'|'B',expected:WebbingEndRequirement)=>`<fieldset class="border rounded p-3 mt-3"><legend>${name}端实际做法</legend><p class="text-xs">要求：${methods[expected.method]} ${e(expected.specification)}</p><label class="block text-sm mt-2">实际方式<select name="end${name}Method" class="w-full border rounded p-2"><option value="">请选择</option>${Object.entries(methods).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label>${input(`end${name}Spec`,'实际型号 / 颜色 / 尺寸')}<label class="block text-sm mt-2">实际所用辅材<select name="end${name}Material" class="w-full border rounded p-2"><option value="">无端头时留空</option>${materials.map(m=>`<option value="${e(m.id)}">${e(m.materialSkuId)} · ${e(m.materialBomItemId)} · ${m.unit}</option>`).join('')}</select></label>${input(`end${name}Coverage`,'浸头实际覆盖长度（mm，仅硅胶填写）','number')}</fieldset>`
  return `<p class="text-sm">当前待打头 ${output.pendingTipPieces} ${output.unit}；要求成品 ${output.specification.finishedLengthMm}mm。</p>${input('quantity',`本次实际打头（${output.unit}）`,'number')}${input('finished','实际成品长度（mm）','number')}${input('defective','本次另报不良（条/根）','number','0')}${end('A',output.specification.endA)}${end('B',output.specification.endB)}<h3 class="font-medium mt-4">本次辅材耗用</h3><p class="text-xs text-slate-500">按实际交出批次填写；未使用的行填0。独立端头按个，浸头材料按重量。</p>${materials.map(m=>`<fieldset data-tip-material="${e(m.id)}" class="border rounded p-3 mt-2"><legend>${e(m.materialSkuId)} · ${e(m.id)}</legend><p class="text-xs">来源 ${e(m.sourceDocumentNo)}；实收 ${m.receivedQty}，已用 ${m.usedQty}，已损 ${m.scrapQty}，剩余 ${getTmfTipMaterialBalance(m.id).availableQty} ${m.unit}</p>${input(`used:${m.id}`,`本次实际耗用（${m.unit}）`,'number','0')}${input(`scrap:${m.id}`,`本次辅材损坏（${m.unit}）`,'number','0')}<p class="text-xs text-amber-700">端头辅材实物图待补</p></fieldset>`).join('')||'<p class="text-amber-700">当前需求尚无端头辅材交出；请先核对来料。</p>'}${input('reason','不良、错头或辅材损坏原因')}<label class="flex gap-2 text-sm mt-3"><input name="tipConfirmed" type="checkbox">已核对两端实际做法与耗材；不符项如实登记为不良</label>`
}
export function readTmfTippingForm(surface:Element, materials:TmfTipMaterialIssue[]) {
  const value=(name:string)=>Array.from(surface.querySelectorAll<HTMLInputElement|HTMLSelectElement>('input,select')).find(el=>el.name===name)?.value.trim()??''
  const number=(name:string)=>Number(value(name))
  if(!surface.querySelector<HTMLInputElement>('[name="tipConfirmed"]')?.checked)throw new Error('请核对实际端头和耗材后确认。')
  const end=(name:'A'|'B'):WebbingEndRequirement=>{
    const method=value(`end${name}Method`) as WebbingEndRequirement['method']
    if(!(method in methods))throw new Error(`请明确${name}端实际方式。`)
    if(method==='NONE')return {method,specification:''}
    const material=materials.find(m=>m.id===value(`end${name}Material`))
    if(!material)throw new Error(`请选择${name}端实际使用的辅材。`)
    return {method,specification:value(`end${name}Spec`),materialBomItemId:material.materialBomItemId,materialUnit:material.unit,...(method==='SILICONE_DIP'?{coverageMm:number(`end${name}Coverage`)}:{})}
  }
  return {pieces:number('quantity'),actualFinishedLengthMm:number('finished'),defectivePieces:number('defective'),endA:end('A'),endB:end('B'),
    materials:materials.map(m=>({issueId:m.id,usedQty:number(`used:${m.id}`),scrapQty:number(`scrap:${m.id}`)})).filter(m=>m.usedQty!==0||m.scrapQty!==0),reason:value('reason')}
}
