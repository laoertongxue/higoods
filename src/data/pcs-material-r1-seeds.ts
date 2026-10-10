import type { MaterialArchiveStoreSnapshot, MaterialArchiveKind, MaterialArchiveRecord, MaterialSkuRecord, MaterialProcessDraft, MaterialSpecValues } from './pcs-material-archive-types.ts'
import { buildProcessedMaterialCode, MATERIAL_CODE_RULE_VERSION } from './pcs-material-rules.ts'

// Static demo only. Real sample photos stay separate from pattern/production files.
export function addMaterialR1Demonstration(source: MaterialArchiveStoreSnapshot): MaterialArchiveStoreSnapshot {
  const snapshot = structuredClone(source)
  snapshot.processDefinitions ||= []; snapshot.costVersions ||= []; snapshot.unitRelations ||= []; snapshot.packages ||= []; snapshot.assets ||= []
  const time = '2026-10-05 09:00'
  const examples: Array<[MaterialArchiveKind,string,string,string,string,string]> = [
    ['fabric','MAT-FB-00000002','白底蓝花棉布坯布','梭织布','Yard','/materials/fei-ticket/white-poplin.png'],
    ['fabric','MAT-FB-00000001','棉涤梭织坯布','梭织布','Yard','/materials/process-orders/greige-cotton-polyester-woven.jpg'],
    ['yarn','MAT-YN-00000001','针织棉纱','针织用纱','KG','/materials/process-orders/cotton-yarn-cone.jpg'],
    ['yarn','MAT-YN-00000002','包缝线','包缝线','KG','/materials/pcs-reviewed/thread-white.jpg'],
    ['consumable','MAT-CS-00000001','透明包装袋','包装袋','PCS','/materials/packing-bag.jpg'],
    ['consumable','MAT-CS-00000002','白色辅助胶带','胶带','M','/materials/pcs-reviewed/tape-white.jpg'],
    ['parts','MAT-EP-00000001','裁剪刀片','裁床配件','PCS','/materials/pcs-reviewed/knife.jpg'],
    ['parts','MAT-EP-00000002','裁剪刀具','通用配件','PCS','/materials/pcs-reviewed/knife.jpg'],
  ]
  for (const [kind, code, name, category, unit, image] of examples) {
    const id = `material-r1-${code}`
    const root: MaterialArchiveRecord = { materialId:id, kind, materialCode:code, materialName:name, materialNameEn:name, categoryName:category,
      specSummary:'原型演示规格', composition:kind === 'yarn' ? '100% 棉' : kind === 'fabric' ? '65% 涤纶 / 35% 棉' : '',
      compositionItems:kind === 'fabric' ? [{component:'涤纶',percentage:65},{component:'棉',percentage:35}] : kind === 'yarn' ? [{component:'棉',percentage:100}] : [],
      processTags:[], widthText:kind==='fabric'?'150cm':'', gramWeightText:kind==='fabric'?'180g/m²':'', widthValueCm:kind==='fabric'?150:null, gramWeightGsm:kind==='fabric'?180:null,
      categoryAttributes:kind==='fabric'?{construction:'平纹',width:150,gramWeight:180}:kind==='yarn'?{countSystem:'Ne',countValue:40,plies:2}:kind==='parts'||kind==='consumable'?{}:{material:'按演示实物'},
      pricingUnit:unit, mainUnit:unit, auxiliaryUnits:[], mainImageUrl:image,galleryImageUrls:[image], status:'ACTIVE',approvalStatus:'APPROVED',skuCount:kind==='fabric'?1:2,usedStyleCount:0,usedTechPackCount:0,
      barcodeTemplateCode:'material-label-r1',remark:'R1 静态演示；图片用于识别示例，不代表采购或加工已经发生。',createdAt:time,updatedAt:time,createdBy:'原型演示',updatedBy:'原型演示' }
    snapshot.records.push(root)
    for (let index=1;index<=(kind==='fabric'?1:2);index++) {
      const skuId=`${id}-B0${index}`
      const identity: MaterialSpecValues = kind==='fabric'?{}:kind==='yarn'?{}:kind==='parts'||kind==='consumable'?{}:{}
      const sku: MaterialSkuRecord = { materialSkuId:skuId,materialId:id,materialCode:code,materialSkuCode:`${code}-B0${index}`, materialName:name,
        colorName:kind==='yarn'?(index===1?'白色':'黑色'):kind==='fabric'?'本白':'', colorCode:kind==='yarn'?(index===1?'white':'black'):kind==='fabric'?'greige':'', specName:kind==='yarn'?'40Ne/2':kind==='parts'?(index===1?'10英寸':'12英寸'):kind==='consumable'?(category==='包装袋'?(index===1?'30×25cm':'40×25cm'):(index===1?'20mm×50m':'25mm×50m')):`规格 ${index}`,sizeName:'', skuImageUrl:kind==='yarn'&&index===2?'/materials/pcs-reviewed/thread-black.png':image,
        costPrice:5,freightCost:1,pricingUnit:unit,mainUnit:unit,weightKg:0,lengthCm:0,widthCm:0,heightCm:0,barcode:`${code}-B0${index}`,stage:'BASE',approvalStatus:'APPROVED',status:'ACTIVE',
        identityValues:identity,effectiveSpecValues:{...root.categoryAttributes,...identity},baseSpecSegment:`B0${index}`,barcodeAliases:[],mainUnitUsed:false,codeRuleVersionId:MATERIAL_CODE_RULE_VERSION,
        createdAt:time,updatedAt:time,createdBy:'原型演示',updatedBy:'原型演示' }
      snapshot.skuRecords.push(sku)
    }
  }
  const base = snapshot.skuRecords.find(sku => sku.materialSkuId === 'material-r1-MAT-FB-00000001-B01')!
  const inputs: Array<{ suffix:string; parent:string; data:Omit<MaterialProcessDraft,'inputSkuId'> }> = [
    {suffix:'dye',parent:base.materialSkuId,data:{processType:'DYEING',colorCode:'black',colorName:'黑色',pantoneSystem:'TCX',pantoneCode:'19-4003',skuImageUrl:'/materials/process-orders/white-black-cotton-jersey.jpg',processStandardCny:.8}},
    {suffix:'print',parent:'material-r1-process-dye',data:{processType:'PRINTING',patternId:'pattern-pl001197',patternCode:'pl001197',patternVersionId:'pl001197-v1',printSide:'A',skuImageUrl:'/materials/fei-ticket/blue-white-print-cotton.png',processStandardCny:1.2}},
    {suffix:'double',parent:base.materialSkuId,data:{processType:'PRINTING',patternId:'pattern-pl001197',patternCode:'pl001197',patternVersionId:'pl001197-v1',backPatternCode:'pl001197',backPatternVersionId:'pl001197-v1',printSide:'AB',skuImageUrl:'/materials/fei-ticket/blue-white-print-cotton.png',processStandardCny:1.6}},
    {suffix:'penetration',parent:base.materialSkuId,data:{processType:'PRINTING',patternId:'pattern-pl001197',patternCode:'pl001197',patternVersionId:'pl001197-v1',backPatternCode:'pl001198',backPatternVersionId:'pl001198-v1',printSide:'AB',penetration:true,skuImageUrl:'/materials/fei-ticket/blue-white-print-cotton.png',processStandardCny:null}},
    {suffix:'embroidery',parent:'material-r1-process-dye',data:{processType:'EMBROIDERY',patternId:'pattern-pl001197',patternCode:'pl001197',patternVersionId:'pl001197-v1',skuImageUrl:'/materials/process-orders/white-water-soluble-lace-12-15mm.jpg',processStandardCny:2}},
    {suffix:'techpack-cotton-dye',parent:'material-r1-MAT-FB-00000002-B01',data:{processType:'DYEING',colorCode:'white',colorName:'白色',pantoneSystem:'TCX',pantoneCode:'11-0601',skuImageUrl:'/materials/fei-ticket/white-poplin.png',processStandardCny:.8}},
    {suffix:'techpack-cotton-print',parent:'material-r1-process-techpack-cotton-dye',data:{processType:'PRINTING',patternId:'pattern-pl001197',patternCode:'pl001197',patternVersionId:'pl001197-v1',printSide:'A',skuImageUrl:'/materials/fei-ticket/blue-white-print-cotton.png',processStandardCny:1.2}},
    {suffix:'techpack-cn360-dye',parent:'material_fabric_001_sku_001',data:{processType:'DYEING',colorCode:'blue',colorName:'蓝色',pantoneSystem:'TCX',pantoneCode:'19-4052',skuImageUrl:'/materials/archive/cf4795cd9b8a6964c389b1708d66678a.png',processStandardCny:.8}},
    {suffix:'techpack-cn360-print',parent:'material-r1-process-techpack-cn360-dye',data:{processType:'PRINTING',patternId:'pattern-pl001197',patternCode:'pl001197',patternVersionId:'pl001197-v1',printSide:'A',skuImageUrl:'/materials/fei-ticket/blue-white-print-cotton.png',processStandardCny:1.2}},
    {suffix:'heat',parent:base.materialSkuId,data:{processType:'HEAT_TRANSFER',patternId:'pattern-pl001198',patternCode:'pl001198',patternVersionId:'pl001198-v1',skuImageUrl:'/materials/fei-ticket/blue-white-print-cotton.png',processStandardCny:.7}},
  ]
  for (const item of inputs) {
    const parent = snapshot.skuRecords.find(sku=>sku.materialSkuId===item.parent)!, id=`material-r1-process-${item.suffix}`
    const draft={...item.data,inputSkuId:item.parent},code=buildProcessedMaterialCode(parent.materialSkuCode,draft),assetId=`material-r1-execution-${item.suffix}`
    // Released technical-pack examples reference approved output specifications; other candidates remain drafts.
    const approved = ['dye','print','techpack-cn360-dye','techpack-cn360-print','techpack-cotton-dye','techpack-cotton-print'].includes(item.suffix)
    const sku:MaterialSkuRecord={...parent,materialSkuId:id,materialSkuCode:code,barcode:code,inputSkuId:item.parent,processDefinitionId:`process-${id}`,stage:draft.processType,
      colorName:draft.colorName||parent.colorName,colorCode:draft.colorCode||parent.colorCode,pantoneCode:draft.pantoneCode||parent.pantoneCode,pantoneSystem:draft.pantoneSystem||parent.pantoneSystem,
      patternCode:draft.patternCode,skuImageUrl:draft.skuImageUrl,costPrice:0,freightCost:0,barcodeAliases:item.suffix==='embroidery'?['CNIDML160-black-19-4003-pl001197-xPT']:[],approvalStatus:approved?'APPROVED':'DRAFT',status:approved?'ACTIVE':'NOT_ENABLED'}
    snapshot.skuRecords.push(sku)
    snapshot.processDefinitions.push({...draft,processDefinitionId:`process-${id}`,outputSkuId:id,objectType:'MATERIAL',processVersionId:'demo-v1',executionAssetIds:approved?[`${assetId}-document`]:[],codeRuleVersionId:MATERIAL_CODE_RULE_VERSION,createdAt:time})
    snapshot.costVersions.push({costVersionId:`cost-${id}`,materialSkuId:id,purchaseStandardCny:null,transportStandardCny:null,processStandardCny:draft.processStandardCny??null,purchaseIncludesTransport:false,pricingUnit:parent.mainUnit || parent.pricingUnit,taxIncluded:true,effectiveAt:time,changeReason:'原型加工费用场景',operatorName:'原型演示'})
    if (approved) snapshot.assets.push({assetId:`${assetId}-document`,materialId:parent.materialId,materialSkuId:id,role:draft.processType==='PRINTING'?'PRINT_FILE':'SPECIFICATION',name:draft.processType==='PRINTING'?'pl001197 原型印花执行文件.svg':'原型染色标准资料.md',url:draft.processType==='PRINTING'?'/technical-data/print-pl001197-demo.svg':'/technical-data/dye-standard-demo.md',version:1,createdAt:time})
    // Identity images and an execution document are never silently treated as the same asset.
    snapshot.assets.push({assetId,materialId:parent.materialId,materialSkuId:id,role:'IDENTIFICATION',name:approved?'加工规格识别图':'加工规格示例图（待补正式执行资料）',url:draft.skuImageUrl,version:1,createdAt:time})
  }
  return snapshot
}
