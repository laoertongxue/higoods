import { getPcsDurableFileReference, resolvePcsFileReference } from './pcs-record-runtime.ts'
import { listSimpleMaterialCategories, type SimpleMaterialKind } from './pcs-simple-material-categories.ts'
import { listMaterialUnitDefinitions } from './pcs-material-config.ts'
import { canonicalMaterialUnit, fixedMaterialFactor, checkedMaterialCode, materialCodeSegment } from './pcs-material-rules.ts'
import { createMaterialArchive, createMaterialSkuRecord, updateMaterialArchive, updateMaterialSkuRecord, withMaterialArchiveMutationBatch, getMaterialArchiveStoreSnapshot, getMaterialArchiveByCode, resolveMaterialSkuIdentity, validateSimpleMaterialSpecification, simpleMaterialSpecificationIdentity, listMaterialUnitRelations, listMaterialPackageSpecs, listMaterialCostVersions, saveMaterialUnitRelation, saveMaterialPackageSpec, saveMaterialStandardCost, getMaterialPricingRelationId, getMaterialUnitFactor, type MaterialArchiveDraft } from './pcs-material-archive-repository.ts'
import { parseMaterialBusinessCsv, materialRowsToCsv, type MaterialTransferMode, type MaterialImportGroup, type MaterialImportPreview, type MaterialImportRow } from './pcs-material-transfer.ts'
import type { MaterialSkuRecord, MaterialSkuDraftInput, MaterialStandardCostVersion, MaterialUnitRelation } from './pcs-material-archive-types.ts'
const columns:Record<MaterialTransferMode,string[]>={
 archives:['模式','物料编码','物料名称','分类编码','SKU编码','规格型号','主计量单位','识别图','主档说明','规格说明','版本时间'],
 units:['SKU编码','辅助单位','每辅助单位主数量','包装含量','含量单位','计量依据','用途','默认用途','调整原因'],
 costs:['SKU编码','标准采购成本RMB','基础运输成本RMB','采购已含运输','计价单位','包装含量','原币金额','原币','原报价单位','原币折算CNY','归一依据','调整原因'],
}
export const SIMPLE_IMPORT_LIMITS:Record<MaterialTransferMode,number>={archives:500,units:20,costs:20}
export function simpleTransferHeaders(mode:MaterialTransferMode):string[]{return [...columns[mode]]}
function unit(value:string):string {const code=canonicalMaterialUnit(value);if(!value||!listMaterialUnitDefinitions().some(x=>x.enabled&&canonicalMaterialUnit(x.code)===code))throw new Error('请选择已启用的计量单位。');return code}
function image(value:string):string {if(/^(data|blob|javascript):/i.test(value))throw new Error('识别图使用已保存文件引用或静态地址，不接收临时地址或内嵌字节。');return resolvePcsFileReference(value)}
function revision(sku:MaterialSkuRecord,root:unknown):string {let hash=2166136261;for(const char of JSON.stringify([sku,root])){hash=Math.imul(hash^char.charCodeAt(0),16777619)}return `${sku.updatedAt}#${(hash>>>0).toString(16)}`}
function amount(value:string):number|null{if(!value)return null;const n=Number(value);if(!Number.isFinite(n)||n<0)throw new Error('标准金额请输入非负数，未知留空。');return n}
function rootDraft(kind:SimpleMaterialKind,v:Record<string,string>,previous?:ReturnType<typeof getMaterialArchiveByCode>):MaterialArchiveDraft{
 const category=listSimpleMaterialCategories(kind).find(x=>x.code===v['分类编码']);if(!category||!category.enabled&&previous?.subcategoryId!==category.id)throw new Error('分类编码不存在、停用或不属于当前物料类型。')
 if(!v['物料名称'].trim()||v['物料名称'].length>80||v['主档说明'].length>500)throw new Error('名称必填且最多80字，说明最多500字。')
 return {kind,materialCode:v['物料编码']||undefined,materialName:v['物料名称'],materialNameEn:'',categoryName:category.name,subcategoryId:category.id,remark:v['主档说明'],specSummary:'',composition:'',processTags:[],widthText:'',gramWeightText:'',pricingUnit:unit(v['主计量单位']),mainImageUrl:image(v['识别图']),barcodeTemplateCode:'material-label-r1'}
}
function skuDraft(v:Record<string,string>):MaterialSkuDraftInput {validateSimpleMaterialSpecification({specName:v['规格型号'],specDescription:v['规格说明']});return {specName:v['规格型号'].trim(),specDescription:v['规格说明'],mainUnit:unit(v['主计量单位']),pricingUnit:unit(v['主计量单位']),skuImageUrl:image(v['识别图']),colorName:'',sizeName:'',costPrice:0,freightCost:0,purchaseStandardCny:null,transportStandardCny:null,weightKg:0,lengthCm:0,widthCm:0,heightCm:0,barcode:''}}
const useNames:Record<string,MaterialUnitRelation['uses'][number]>={'采购':'PURCHASE','计价':'PRICING','领用':'ISSUE',PURCHASE:'PURCHASE',PRICING:'PRICING',ISSUE:'ISSUE'}
function uses(value:string):MaterialUnitRelation['uses']{const result=value.split(/[|、,，]/).filter(Boolean).map(x=>useNames[x.trim()]);if(result.some(x=>!x))throw new Error('用途填写采购、计价、领用。');return [...new Set(result)]}
function unitDraft(v:Record<string,string>,sku:MaterialSkuRecord){
 const aux=unit(v['辅助单位']),quantity=Number(v['每辅助单位主数量']),packQty=amount(v['包装含量']),use=uses(v['用途']),defaults=uses(v['默认用途'])
 if(!Number.isFinite(quantity)||quantity<=0||!v['计量依据'].trim()||!use.length||defaults.some(x=>!use.includes(x)))throw new Error('请填写正数换算、计量依据、有效用途；默认用途应包含在用途内。')
 const fixed=fixedMaterialFactor(aux,sku.mainUnit!);if(fixed!==null&&Math.abs(fixed-quantity)>1e-9)throw new Error('固定换算与基础配置不一致。')
 if(packQty!==null){const factor=getMaterialUnitFactor(sku.materialSkuId,unit(v['含量单位']),sku.mainUnit!);if(packQty<=0||factor===null||Math.abs(packQty*factor-quantity)>1e-9)throw new Error('包装含量与主单位换算不一致或缺少依据。')}
 const matches=listMaterialUnitRelations(sku.materialSkuId).filter(x=>canonicalMaterialUnit(x.auxUnitId)===aux&&Math.abs(x.mainQtyPerAux-quantity)<1e-9&&Boolean(x.packageSpecId)===(packQty!==null))
 if(matches.length>1)throw new Error('相同包装含量有多项关系，请在规格计量单位页面明确选用。')
 const previous=matches[0];if(previous&&!v['调整原因'])throw new Error('更新单位关系需填写调整原因。')
 return {aux,quantity,packQty,use,defaults,previous}
}
function costDraft(v:Record<string,string>,sku:MaterialSkuRecord):Partial<MaterialStandardCostVersion>&{changeReason:string}{
 if(sku.inputSkuId)throw new Error('历史加工产出的成本保留只读，请勿用简单模板覆盖。')
 if(!v['调整原因'].trim()||!['是','否'].includes(v['采购已含运输']))throw new Error('成本调整原因必填，采购已含运输填是或否。')
 const pricing=unit(v['计价单位']),quantity=amount(v['包装含量']),matches=listMaterialUnitRelations(sku.materialSkuId).filter(x=>x.uses.includes('PRICING')&&canonicalMaterialUnit(x.auxUnitId)===pricing&&(quantity===null||x.mainQtyPerAux===quantity))
 if(quantity!==null&&matches.length!==1)throw new Error('计价包装含量未对应唯一有效关系，请先维护计量单位。')
 const relation=getMaterialPricingRelationId(sku.materialSkuId,pricing,quantity===null?undefined:matches[0].relationId)
 if(getMaterialUnitFactor(sku.materialSkuId,pricing,sku.mainUnit!,relation)===null)throw new Error('计价单位缺少换算依据，不能假定1:1。')
 const result:Partial<MaterialStandardCostVersion>&{changeReason:string}={purchaseStandardCny:amount(v['标准采购成本RMB']),transportStandardCny:amount(v['基础运输成本RMB']),purchaseIncludesTransport:v['采购已含运输']==='是',pricingUnit:pricing,pricingUnitRelationId:relation,changeReason:v['调整原因']}
 if(v['原币金额']){amount(v['原币金额']);if(!['CNY','IDR','USD'].includes(v['原币'])||!v['归一依据']||!(Number(v['原币折算CNY'])>0)||getMaterialUnitFactor(sku.materialSkuId,pricing,unit(v['原报价单位']),relation)===null)throw new Error('原币报价需有效币种、正数汇率、换算关系及归一依据。');result.sourceMoney={amount:v['原币金额'],currency:v['原币'] as 'CNY'|'IDR'|'USD',unit:v['原报价单位'],cnyPerSourceCurrency:v['原币折算CNY'],normalizationBasis:v['归一依据']}}
 return result
}
export function previewSimpleMaterialImport(kind:SimpleMaterialKind,mode:MaterialTransferMode,text:string):MaterialImportPreview {
 const table=parseMaterialBusinessCsv(text),headers=table.shift()||[],expected=columns[mode]
 const limit=SIMPLE_IMPORT_LIMITS[mode]
 if(!table.length||table.length>limit)throw new Error(`本次最多 ${limit} 行；请按完整主档组拆分文件，空文件不能导入。`)
 if(headers.length!==expected.length||new Set(headers).size!==headers.length||expected.some(x=>!headers.includes(x)))throw new Error('请使用简单模板；不接受技术属性、加工字段或旧内部关系ID。')
 const snap=getMaterialArchiveStoreSnapshot(),roots=new Map(snap.records.map(x=>[x.materialCode,x])),skus=new Map(snap.skuRecords.map(x=>[x.materialSkuCode,x])),groups=new Map<string,MaterialImportGroup>(),seen=new Set<string>(),reserved=new Set(roots.keys()),auto=new Map<string,string>(),rows:MaterialImportRow[]=[]
 let sequence=snap.records.filter(x=>x.kind===kind).length+1
 for(let i=0;i<table.length;i++){
  const v=Object.fromEntries(headers.map((name,j)=>[name,table[i][j]||'']))
  if(mode==='archives'&&v['模式']==='新增'&&!v['物料编码']){let code=auto.get(v['物料名称']);if(!code){do{code=`MAT-${kind==='parts'?'EP':'CS'}-${String(sequence++).padStart(8,'0')}`}while(reserved.has(code));reserved.add(code);auto.set(v['物料名称'],code)}v['物料编码']=code}
  const key=mode==='archives'?v['物料编码']:v['SKU编码'],row:MaterialImportRow={line:i+2,values:v,key,description:'',errors:[]};rows.push(row);let group=groups.get(key);if(!group){group={key,rows:[],errors:[]};groups.set(key,group)}group.rows.push(row)
  try{
   if(table[i].length!==headers.length||!key)throw new Error('行列数量不符或定位编码缺失。')
   if(mode==='archives'){
    if(!['新增','新增规格','更新'].includes(v['模式']))throw new Error('模式填写新增、新增规格或更新。')
    const root=roots.get(key),draft=rootDraft(kind,v,root),spec=skuDraft(v)
    if(checkedMaterialCode(materialCodeSegment(key,'物料编码'))!==key)throw new Error('物料编码需规范化。')
    if(v['模式']==='新增'&&(root||v['SKU编码']))throw new Error('新增主档编码已存在或填写了已有SKU编码。')
    if(v['模式']!=='新增'&&(!root||root.kind!==kind||root.status==='ARCHIVED'))throw new Error('更新或新增规格需有效的同类主档。')
    if(root && v['模式']!=='更新' && (root.status==='INACTIVE'||root.materialName!==draft.materialName||root.subcategoryId!==draft.subcategoryId))throw new Error('新增规格必须采用原主档名称和分类，且主档不能停用。')
    if(group.rows.length>1&&['模式','物料名称','分类编码','主档说明'].some(field=>group!.rows[0].values[field]!==v[field]))throw new Error('同一主档组的模式、名称或分类不一致。')
    const old=skus.get(v['SKU编码']);if(v['模式']==='更新'){
     if(!old||old.materialId!==root!.materialId||!v['版本时间']||v['版本时间']!==revision(old,root))throw new Error('更新需对应SKU编码及当前导出版本时间，请重新导出。')
     if(old.approvalStatus==='APPROVED'&&simpleMaterialSpecificationIdentity(old.specName)!==simpleMaterialSpecificationIdentity(spec.specName))throw new Error('已审核规格不能通过导入改变实物身份；文字更正请使用专门操作。')
     if(old.mainUnitUsed||old.approvalStatus==='APPROVED'){if(canonicalMaterialUnit(old.mainUnit!)!==spec.mainUnit)throw new Error('已审核或使用的主单位不能修改。')}
     row.values['主档版本时间']=root!.updatedAt;row.description=`更新 ${old.materialSkuCode}：${old.specName} → ${spec.specName}；名称 ${root!.materialName} → ${draft.materialName}；说明 ${old.specDescription||'—'} → ${v['规格说明']||'—'}`
    }else row.description=`${v['模式']} ${draft.materialName} · ${spec.specName}`
    const identity=key+'|'+simpleMaterialSpecificationIdentity(spec.specName);if(seen.has(identity)||snap.skuRecords.some(x=>x.materialId===root?.materialId&&x.materialSkuId!==old?.materialSkuId&&simpleMaterialSpecificationIdentity(x.specName)===simpleMaterialSpecificationIdentity(spec.specName)))throw new Error('同主档规格型号重复。');seen.add(identity)
   }else{
    const sku=skus.get(key),root=sku&&snap.records.find(x=>x.materialId===sku.materialId);if(!sku||root?.kind!==kind)throw new Error('SKU不存在或类型不符。')
    row.description=sku.materialSkuCode
    if(mode==='units'){const draft=unitDraft(v,sku),identity=key+'|'+draft.aux+'|'+draft.quantity;if(seen.has(identity))throw new Error('同一批次单位关系重复。');seen.add(identity)}
    else {costDraft(v,sku);if(seen.has(key))throw new Error('同一批次每SKU只接受一个新标准。');seen.add(key)}
   }
  }catch(error){row.errors.push(error instanceof Error?error.message:'数据错误。')}
 }
 for(const g of groups.values())g.errors=g.rows.flatMap(r=>r.errors.map(e=>`第 ${r.line} 行：${e}`))
 return {kind,mode,rows,groups:[...groups.values()],validGroups:[...groups.values()].filter(g=>!g.errors.length).length,failedRows:rows.filter(r=>r.errors.length).length}
}
export function applySimpleMaterialImportGroup(kind:SimpleMaterialKind,mode:MaterialTransferMode,group:MaterialImportGroup):string[]{
 if(group.errors.length)throw new Error('该组仍有错误，未保存。')
 return withMaterialArchiveMutationBatch(()=>{
  const codes:string[]=[];let checkedRootVersion=false;let root=mode==='archives'?getMaterialArchiveByCode(group.key):null;const originalRoot=root
  if(mode==='archives'&&group.rows[0]?.values['模式']==='新增'&&originalRoot)throw new Error('新增主档编码已存在，请重新预览。')
  for(const row of group.rows){const v=row.values;try{
   if(mode==='archives'){
    const draft=rootDraft(kind,v,root),spec=skuDraft(v)
    if(v['模式']==='新增'&&!root){root=createMaterialArchive({...draft,firstSku:spec});codes.push(getMaterialArchiveStoreSnapshot().skuRecords.find(x=>x.materialId===root!.materialId)!.materialSkuCode);continue}
    if(!root||root.kind!==kind)throw new Error('主档不存在或类型不符。')
    if(v['模式']==='更新'){
     const old=resolveMaterialSkuIdentity(v['SKU编码']);if(!old||old.materialId!==root.materialId||revision(old,originalRoot)!==v['版本时间']||!checkedRootVersion&&root.updatedAt!==v['主档版本时间'])throw new Error('资料已变化，请重新导出并预览。')
     // Import changes the explicitly selected dossier fields only; preserve existing gallery, aliases and all adopted costs/units.
     root=updateMaterialArchive(root.materialId,{...root,...draft,galleryImageUrls:root.galleryImageUrls});checkedRootVersion=true
     const saved=updateMaterialSkuRecord(old.materialSkuId,{...old,...spec,pricingUnit:old.pricingUnit,purchaseStandardCny:undefined,transportStandardCny:undefined,barcode:old.barcode,barcodeAliases:old.barcodeAliases});if(!saved)throw new Error('规格不存在。');codes.push(saved.materialSkuCode)
    }else if(['新增','新增规格'].includes(v['模式'])){if(root.status==='ARCHIVED'||root.status==='INACTIVE'||root.materialName!==draft.materialName||root.subcategoryId!==draft.subcategoryId)throw new Error('主档已变化或不可新增规格。');const saved=createMaterialSkuRecord(root.materialId,spec);if(!saved)throw new Error('未保存规格。');codes.push(saved.materialSkuCode)}else throw new Error('导入模式无效。')
   }else{
    const sku=resolveMaterialSkuIdentity(v['SKU编码']),parent=sku&&getMaterialArchiveStoreSnapshot().records.find(x=>x.materialId===sku.materialId);if(!sku||parent?.kind!==kind)throw new Error('SKU不存在或类型不符。')
    if(mode==='costs')saveMaterialStandardCost(sku.materialSkuId,costDraft(v,sku))
    else {const d=unitDraft(v,sku);let packId=d.previous?.packageSpecId;if(d.packQty!==null&&!packId){packId=saveMaterialPackageSpec(sku.materialSkuId,{packageTypeId:d.aux,contentQty:d.packQty,contentUnitId:v['含量单位'],grossWeightKg:null,lengthCm:null,widthCm:null,heightCm:null,volumeM3:null,volumeSource:'UNKNOWN',measurementBasis:v['计量依据'],status:'ACTIVE'}).packageSpecId}
     const previous=d.previous||listMaterialUnitRelations(sku.materialSkuId).find(x=>x.packageSpecId===packId&&packId)
     saveMaterialUnitRelation(sku.materialSkuId,{relationId:previous?.relationId,auxUnitId:d.aux,mainQtyPerAux:d.quantity,basisType:d.packQty!==null?'PACKAGE':fixedMaterialFactor(d.aux,sku.mainUnit!)!==null?'FIXED':'SPECIFICATION',basisReference:v['计量依据'],packageSpecId:packId,uses:d.use,isDefaultForUse:d.defaults,status:'ACTIVE',changeReason:v['调整原因']||'导入单位标准'})
    }codes.push(sku.materialSkuCode)
   }
  }catch(error){throw new Error(`第 ${row.line} 行：${error instanceof Error?error.message:'未保存。'}`)}}return codes
 })
}
export function buildSimpleMaterialTemplate(kind:SimpleMaterialKind,mode:MaterialTransferMode):string{
 const headers=columns[mode],v:Record<string,string>=mode==='archives'?{'模式':'新增','物料名称':kind==='parts'?'裁剪刀片':'包装袋','分类编码':listSimpleMaterialCategories(kind).find(x=>x.enabled)!.code,'规格型号':kind==='parts'?'10英寸':'30×25cm','主计量单位':'PCS','主档说明':'原型导入示例','规格说明':'按实际规格填写'}:mode==='units'?{'SKU编码':'请替换实际SKU编码','辅助单位':'箱','每辅助单位主数量':'10','包装含量':'10','含量单位':'PCS','计量依据':'确认每盒10个','用途':'采购|计价|领用','调整原因':'导入确认'}:{'SKU编码':'请替换实际SKU编码','标准采购成本RMB':'2','基础运输成本RMB':'0.1','采购已含运输':'否','计价单位':'PCS','调整原因':'维护标准成本'}
 return materialRowsToCsv([headers,headers.map(x=>v[x]||'')])
}
export function exportSimpleMaterialRows(mode:MaterialTransferMode,skus:MaterialSkuRecord[]):string{
 const headers=columns[mode],snapshot=getMaterialArchiveStoreSnapshot(),rows:unknown[][]=[headers]
 for(const sku of skus){if(mode==='archives'){const root=snapshot.records.find(x=>x.materialId===sku.materialId)!,category=listSimpleMaterialCategories().find(x=>x.id===root.subcategoryId);rows.push(['更新',root.materialCode,root.materialName,category?.code,sku.materialSkuCode,sku.specName,sku.mainUnit,getPcsDurableFileReference(sku.skuImageUrl),root.remark||'',sku.specDescription||'',revision(sku,root)])}
 else if(mode==='units')for(const r of listMaterialUnitRelations(sku.materialSkuId)){const pack=listMaterialPackageSpecs(sku.materialSkuId,true).find(x=>x.packageSpecId===r.packageSpecId);rows.push([sku.materialSkuCode,r.auxUnitId,r.mainQtyPerAux,pack?.contentQty,pack?.contentUnitId,r.basisReference,r.uses.map(x=>({PURCHASE:'采购',PRICING:'计价',ISSUE:'领用'})[x]).join('|'),r.isDefaultForUse.map(x=>({PURCHASE:'采购',PRICING:'计价',ISSUE:'领用'})[x]).join('|'),r.changeReason])}
 else{const c=listMaterialCostVersions(sku.materialSkuId).at(-1),relation=listMaterialUnitRelations(sku.materialSkuId,true).find(x=>x.relationId===c?.pricingUnitRelationId);rows.push([sku.materialSkuCode,c?.purchaseStandardCny,c?.transportStandardCny,c?.purchaseIncludesTransport?'是':'否',c?.pricingUnit||sku.pricingUnit,relation?.mainQtyPerAux,c?.sourceMoney?.amount,c?.sourceMoney?.currency,c?.sourceMoney?.unit,c?.sourceMoney?.cnyPerSourceCurrency,c?.sourceMoney?.normalizationBasis,c?.changeReason])}}
 return materialRowsToCsv(rows)
}
