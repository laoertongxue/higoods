import { getMaterialSkuRecordById, listAllMaterialSkuRecords, listMaterialSkuLineage, getMaterialProcessDefinition, resolveMaterialSkuIdentity } from './pcs-material-archive-repository.ts'
import { buildProcessedMaterialCode } from './pcs-material-rules.ts'
import type { MaterialVariantCreateInput, MaterialVariantProcessStep, MaterialVariantRecord, MaterialVariantResult, MaterialVariantProcessType } from './pcs-material-variant-types.ts'

// Read adapter for consumers being moved to materialSkuId; no second identity or persistence.
function projection(id: string): MaterialVariantRecord | null {
  const sku = getMaterialSkuRecordById(id) || resolveMaterialSkuIdentity(id)
  if (!sku) return null
  const chain = listMaterialSkuLineage(sku.materialSkuId)
  const map: Record<string, MaterialVariantProcessType> = { DYEING:'dye',PRINTING:'print',EMBROIDERY:'embroider',HEAT_TRANSFER:'heat' }
  const processes = chain.filter(item=>item.stage && item.stage!=='BASE').map(item=>{
    const process=getMaterialProcessDefinition(item.materialSkuId)
    return {processType:map[item.stage!],processCode:item.stage!,processName:({DYEING:'染色',PRINTING:'印花',EMBROIDERY:'绣花',HEAT_TRANSFER:'烫画'} as Record<string,string>)[item.stage!],patternCode:process?.patternCode}
  })
  return {variantId:sku.materialSkuId,materialId:sku.materialId,materialSkuId:sku.materialSkuId,baseSkuCode:chain[0].materialSkuCode,
    variantCode:sku.materialSkuCode,displayName:sku.materialName,colorName:sku.colorName,pantoneRef:sku.pantoneCode,chainCategory:processes.length?'process':'plain',layerIndex:processes.length,
    predecessorVariantId:sku.inputSkuId,processes,createdAt:sku.createdAt,updatedAt:sku.updatedAt}
}
export function listMaterialVariants(materialId?:string, _store?:Map<string,MaterialVariantRecord>):MaterialVariantRecord[]{return listAllMaterialSkuRecords().filter(sku=>!materialId||sku.materialId===materialId).map(sku=>projection(sku.materialSkuId)!)}
export function getMaterialVariantById(id:string,_store?:Map<string,MaterialVariantRecord>){return projection(id)}
export function listVariantLineage(id:string,_store?:Map<string,MaterialVariantRecord>){const sku=projection(id);return sku?listMaterialSkuLineage(sku.materialSkuId!).map(item=>projection(item.materialSkuId)!):[]}
export function migrateLegacyBomLinesToBaseVariants(materialId:string,baseSkuCode:string,materialSkuId='',_store?:Map<string,MaterialVariantRecord>){const result=projection(materialSkuId||baseSkuCode);return result&&result.materialId===materialId?[result]:[]}
export function mapLegacyBomItemsToBaseVariants<T extends {materialSkuId?:string;variantId?:string}>(lines:T[]):T[]{return lines.map(line=>({...line,variantId:line.materialSkuId||line.variantId}))}
export function createMaterialVariant(_input:MaterialVariantCreateInput,_store?:Map<string,MaterialVariantRecord>):MaterialVariantResult{return {ok:false,error:'REQUIRED_FIELD',message:'请在物料 SKU 的“基于此 SKU 新增加工”创建，独立变种入口已退役。'}}
export function resetMaterialVariantStore():void { /* No independent store exists. */ }
export function buildDyeVariantCode(baseSkuCode:string,colorName:string,pantoneRef:string){return buildProcessedMaterialCode(baseSkuCode,{inputSkuId:'',processType:'DYEING',colorCode:colorName,pantoneSystem:'TCX',pantoneCode:pantoneRef,skuImageUrl:''})}
export function buildAppendedVariantCode(code:string,step:MaterialVariantProcessStep){const map:Record<string,'PRINTING'|'EMBROIDERY'|'HEAT_TRANSFER'>={print:'PRINTING',embroider:'EMBROIDERY',heat:'HEAT_TRANSFER'};if(!map[step.processType])throw new Error('请使用已确认的物料身份工艺。');return buildProcessedMaterialCode(code,{inputSkuId:'',processType:map[step.processType],patternCode:step.patternCode,printSide:'A',skuImageUrl:''})}
