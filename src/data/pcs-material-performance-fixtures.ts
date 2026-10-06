/** Explicit, in-memory validation loads. These are never part of ordinary page initialization. */
import { getMaterialArchiveBaseline } from './pcs-material-archive-repository.ts'
import { buildMaterialBusinessTemplate, materialRowsToCsv, parseMaterialBusinessCsv } from './pcs-material-transfer.ts'
import { buildProcessedMaterialCode } from './pcs-material-rules.ts'
import type { MaterialArchiveKind, MaterialArchiveStoreSnapshot, MaterialProcessDraft, MaterialSkuRecord } from './pcs-material-archive-types.ts'

export function createMaterialImportValidationCsv(rowCount: 100 | 1000, kind: MaterialArchiveKind = 'fabric', prefix = 'PERF-MAT'): string {
  const [headers, example] = parseMaterialBusinessCsv(buildMaterialBusinessTemplate(kind, 'archives'))
  const codeIndex=headers.indexOf('物料编码'),nameIndex=headers.indexOf('物料名称')
  return materialRowsToCsv([headers, ...Array.from({length:rowCount},(_,index)=>{
    const row=[...example];row[codeIndex]=`${prefix}-${String(index+1).padStart(4,'0')}`;row[nameIndex]=`性能验证物料 ${index+1}`;return row
  })])
}

export function createMaterialCostValidationSnapshot(descendantCount = 100): { snapshot: MaterialArchiveStoreSnapshot; baseSkuId: string; descendantCount: number } {
  if(!Number.isInteger(descendantCount)||descendantCount<1||descendantCount>1000)throw new Error('验证负载需要 1～1000 个后代。')
  const baseline=getMaterialArchiveBaseline(),base=baseline.skuRecords.find(sku=>sku.materialSkuId==='material-r1-MAT-FB-00000001-B01')!,root=baseline.records.find(item=>item.materialId===base.materialId)!
  const snapshot:MaterialArchiveStoreSnapshot={version:baseline.version,records:[root],skuRecords:[base],usageRecords:[],logRecords:[],processDefinitions:[],unitRelations:[],packages:[],assets:[],costVersions:baseline.costVersions!.filter(cost=>cost.materialSkuId===base.materialSkuId)}
  const types=['DYEING','PRINTING','EMBROIDERY','HEAT_TRANSFER'] as const
  let parent:MaterialSkuRecord=base
  for(let index=0;index<descendantCount;index++){
    const depth=index%4;if(depth===0)parent=base
    const draft:MaterialProcessDraft={inputSkuId:parent.materialSkuId,processType:types[depth],colorCode:`load${Math.floor(index/4)+1}`,pantoneSystem:'TCX',pantoneCode:'19-4003',patternCode:'pl001197',printSide:'A',skuImageUrl:base.skuImageUrl}
    const id=`material-validation-${index+1}`,processId=`material-validation-process-${index+1}`,costId=`material-validation-cost-${index+1}`
    const child:MaterialSkuRecord={...parent,materialSkuId:id,materialSkuCode:buildProcessedMaterialCode(parent.materialSkuCode,draft),inputSkuId:parent.materialSkuId,stage:draft.processType,processDefinitionId:processId,currentCostVersionId:costId}
    snapshot.skuRecords.push(child)
    snapshot.processDefinitions!.push({...draft,processDefinitionId:processId,outputSkuId:id,objectType:'MATERIAL',processVersionId:'1',executionAssetIds:[],codeRuleVersionId:'material-r1',createdAt:base.createdAt})
    snapshot.costVersions!.push({costVersionId:costId,materialSkuId:id,purchaseStandardCny:null,transportStandardCny:null,purchaseIncludesTransport:false,processStandardCny:1,pricingUnit:base.pricingUnit,taxIncluded:true,effectiveAt:base.createdAt,changeReason:'纯内存性能样本',operatorName:'原型验证'})
    parent=child
  }
  return {snapshot,baseSkuId:base.materialSkuId,descendantCount}
}
