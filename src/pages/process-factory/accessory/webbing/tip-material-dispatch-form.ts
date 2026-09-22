import { escapeHtml as e } from '../../../../utils.ts'
import type { TmfProductionDemand } from '../../../../data/fcs/webbing-production-demands.ts'
import { getTmfPurchaseState } from '../../../../data/pms/tmf-material-purchases.ts'
const methodName={NONE:'无端头',METAL:'金属头',PLASTIC_WRAP:'塑料包头',SILICONE_DIP:'硅胶浸头'}
function requirements(demand:TmfProductionDemand){return [demand.specification.endA,demand.specification.endB].filter(end=>end.method!=='NONE'&&end.materialBomItemId)}
export function renderTmfTipMaterialDispatchForm(demand:TmfProductionDemand):string{
 const ends=requirements(demand),boms=[...new Set(ends.map(end=>end.materialBomItemId!))]
 const lots=getTmfPurchaseState().tipMaterialLots.filter(lot=>lot.onHandQty>0)
 const field=(name:string,label:string,type='text')=>`<label class="block mt-3 text-sm">${label}<input name="${name}" type="${type}" class="w-full border rounded p-2 mt-1" ${type==='number'?'min="0" step="0.001"':''}></label>`
 return `<p class="mt-3 text-sm">接收：TMF－辅料厂；本次仅交出辅材，工厂另行实收。</p><div class="border rounded p-3 mt-3">${[demand.specification.endA,demand.specification.endB].map((end,index)=>`<p>${index===0?'A':'B'}端：${methodName[end.method]} ${e(end.specification)}${end.coverageMm?` · 覆盖${end.coverageMm}mm`:''}</p>`).join('')}<p class="text-xs text-slate-500">端头参考图见技术包端头要求；请按型号、颜色、尺寸核对实物。</p></div><label class="block mt-3 text-sm">对应技术包辅材<select name="tipBom" class="w-full border rounded p-2 mt-1"><option value="">请选择</option>${boms.map(id=>{const end=ends.find(end=>end.materialBomItemId===id)!;return `<option value="${e(id)}">${e(id)} · ${methodName[end.method]} · ${e(end.specification)} · ${end.materialUnit}</option>`}).join('')}</select></label><label class="block mt-3 text-sm">来源实收批次<select name="tipLot" class="w-full border rounded p-2 mt-1"><option value="">请选择已有实收批次</option>${lots.map(lot=>`<option value="${e(lot.id)}">${e(lot.id)} · ${e(lot.materialSkuId)} · ${e(lot.warehouseId)} / ${e(lot.location)} · 可发 ${lot.onHandQty} ${lot.unit}</option>`).join('')}</select></label>${field('issue','本次辅材发料单号')}${field('batch','扫描实物辅材批次')}${field('sku','扫描实际辅材 SKU')}${field('quantity','本次实际发出（按所选批次单位）','number')}<label class="flex gap-2 mt-3 text-sm"><input name="confirmed" type="checkbox">确认批次、型号、颜色、尺寸和数量符合上述技术包辅材要求</label>`
}
export function readTmfTipMaterialDispatchForm(surface:Element,demand:TmfProductionDemand){
 const value=(name:string)=>surface.querySelector<HTMLInputElement|HTMLSelectElement>(`[name="${name}"]`)!.value.trim()
 if(!surface.querySelector<HTMLInputElement>('[name="confirmed"]')!.checked)throw new Error('请核对辅材实物和技术包要求后确认。')
 const end=requirements(demand).find(end=>end.materialBomItemId===value('tipBom'))
 if(!demand.specification.tippingRequired||!end)throw new Error('请选择当前技术包要求的辅材。')
 const lot=getTmfPurchaseState().tipMaterialLots.find(lot=>lot.id===value('tipLot'))
 if(!lot)throw new Error('请选择已有实收的辅材批次，不能凭发料数量创建库存。')
 if(lot.unit!==end.materialUnit)throw new Error('辅材批次单位与技术包要求不一致，不能把个数与重量混用。')
 if(value('batch')!==lot.id||value('sku')!==lot.materialSkuId)throw new Error('所扫辅材批次或SKU不符，请核对实物。')
 return {id:value('issue'),demandId:demand.id,stockLotId:lot.id,materialBomItemId:end.materialBomItemId!,materialSkuId:lot.materialSkuId,sourceDocumentNo:value('issue'),unit:lot.unit,dispatchedQty:Number(value('quantity'))}
}
