import { getMaterialArchiveById, getMaterialSkuRecordById, getMaterialProcessDefinition, listMaterialSkuLineage } from './pcs-material-archive-repository.ts'
import type { MaterialProcessType, MaterialSkuRecord } from './pcs-material-archive-types.ts'

export interface DesignRevisionMaterialProcessStage {
  processType: MaterialProcessType
  processDefinitionId: string
  inputSkuId: string
  inputSkuCode: string
  outputSkuId: string
  outputSkuCode: string
}
export interface DesignRevisionMaterialSkuSnapshot {
  targetSkuId: string; targetSkuCode: string; materialId: string; materialName: string; materialImageUrl: string
  rawSkuId: string; rawSkuCode: string; dyedSkuId: string; dyedSkuCode: string
  colorName: string; pantoneCode: string; patternCode: string; patternImageUrl: string
  requiresDye: boolean; requiresPrint: boolean; pricingUnit: string; capturedAt: string
  processStages?: DesignRevisionMaterialProcessStage[]
}
function activeSku(id:string):MaterialSkuRecord|null {const sku=getMaterialSkuRecordById(id);return sku?.status==='ACTIVE'&&sku.approvalStatus==='APPROVED'?sku:null}
/** The target is one canonical material SKU. Every operation adopts its explicit direct predecessor. */
export function resolveDesignRevisionMaterialSku(targetSkuId:string,capturedAt=''):DesignRevisionMaterialSkuSnapshot {
 const target=activeSku(targetSkuId)
 if(!target)throw new Error(`目标物料 SKU ${targetSkuId||'未选择'} 不存在、未审核或已停用。`)
 const archive=getMaterialArchiveById(target.materialId)
 if(!archive||archive.status!=='ACTIVE')throw new Error(`${target.materialSkuCode} 所属物料已停用。`)
 const lineage=listMaterialSkuLineage(targetSkuId),raw=lineage[0]
 const processStages:DesignRevisionMaterialProcessStage[]=lineage.filter(s=>Boolean(s.inputSkuId)).map(output=>{
   const definition=getMaterialProcessDefinition(output.materialSkuId),input=activeSku(output.inputSkuId!)
   if(!definition||!input||input.materialId!==archive.materialId)throw new Error(`${output.materialSkuCode} 的直接投入或加工定义不可用。`)
   if(!activeSku(output.materialSkuId))throw new Error(`${output.materialSkuCode} 尚未审核启用。`)
   return{processType:definition.processType,processDefinitionId:definition.processDefinitionId,inputSkuId:input.materialSkuId,inputSkuCode:input.materialSkuCode,outputSkuId:output.materialSkuId,outputSkuCode:output.materialSkuCode}
 })
 const dyed=lineage.find(s=>s.stage==='DYEING'),printed=lineage.find(s=>s.stage==='PRINTING')
 const requiresDye=Boolean(dyed),requiresPrint=Boolean(printed)
 if(dyed&&(!dyed.colorName.trim()||!dyed.pantoneCode?.trim()))throw new Error(`${dyed.materialSkuCode} 缺少颜色或 Pantone 色号。`)
 if(printed&&(!printed.patternCode?.trim()||!printed.patternImageUrl?.trim()))throw new Error(`${printed.materialSkuCode} 缺少花型编号或正式花型图片。`)
 if(!target.skuImageUrl?.trim()||!raw.skuImageUrl?.trim())throw new Error(`${target.materialSkuCode} 缺少物料实图。`)
 if(!target.pricingUnit?.trim()||!raw.pricingUnit?.trim())throw new Error(`${target.materialSkuCode} 缺少计量单位。`)
 return{targetSkuId:target.materialSkuId,targetSkuCode:target.materialSkuCode,materialId:target.materialId,materialName:archive.materialName,materialImageUrl:target.skuImageUrl,
 rawSkuId:raw.materialSkuId,rawSkuCode:raw.materialSkuCode,dyedSkuId:dyed?.materialSkuId||'',dyedSkuCode:dyed?.materialSkuCode||'',colorName:target.colorName,pantoneCode:dyed?.pantoneCode||target.pantoneCode||'',patternCode:printed?.patternCode||'',patternImageUrl:printed?.patternImageUrl||'',requiresDye,requiresPrint,pricingUnit:target.pricingUnit,capturedAt,processStages}
}
