import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { pcsRecordStore } from '../src/data/pcs-record-runtime.ts'
import * as repo from '../src/data/pcs-material-archive-repository.ts'
import { getMaterialTemplate, getMaterialTemplateByVersion, getMaterialConfigSnapshot, resetMaterialConfigCache, PCS_MATERIAL_CONFIG_KEY, saveMaterialEquipmentModel, saveMaterialTemplateVersion, saveMaterialUnit } from '../src/data/pcs-material-config.ts'
import { materialUnitDimension } from '../src/data/pcs-material-rules.ts'
import { listConfigDimensionOptions } from '../src/data/pcs-config-workspace-repository.ts'
import { validateMaterialTemplateValues } from '../src/data/pcs-material-attributes.ts'
import { exportMaterialBusinessRows, parseMaterialBusinessCsv, previewMaterialBusinessImport, materialRowsToCsv } from '../src/data/pcs-material-transfer.ts'
import { renderPcsMaterialArchiveEditPage, renderPcsMaterialSkuEditPage } from '../src/pages/pcs-material-archives.ts'
import type { MaterialSkuDraftInput } from '../src/data/pcs-material-archive-types.ts'

const configBaseline = getMaterialConfigSnapshot()
const baseline = repo.getMaterialArchiveBaseline()
beforeEach(() => {
  pcsRecordStore.setItem(PCS_MATERIAL_CONFIG_KEY, JSON.stringify(configBaseline)); resetMaterialConfigCache()
  pcsRecordStore.setItem(repo.MATERIAL_ARCHIVE_STORAGE_KEY, JSON.stringify(baseline)); repo.resetMaterialArchiveCache()
})
function root(categoryName: string, kind: repo.MaterialArchiveDraft['kind'] = 'accessory', extra: Partial<repo.MaterialArchiveDraft> = {}) {
  return repo.createMaterialArchive({ kind, categoryName, materialName: `${categoryName}测试`, materialNameEn: 'Material test', specSummary: '', composition: '', processTags: [], widthText: '', gramWeightText: '', pricingUnit: 'PCS', mainImageUrl: '/materials/tmf/rope-real-bundle.jpg', barcodeTemplateCode: 'material-label-r1', remark: '', ...extra })
}
function sku(extra: Partial<MaterialSkuDraftInput> = {}): MaterialSkuDraftInput { return { colorName: '白色', specName: '标准规格', sizeName: '', mainUnit: 'PCS', skuImageUrl: '/materials/tmf/rope-real-bundle.jpg', costPrice: 0, freightCost: 0, weightKg: 0, lengthCm: 0, widthCm: 0, heightCm: 0, barcode: '', ...extra } }

test('ATTR-005/006: shank buttons omit holes; hole buttons require an integer; legacy v1 is unchanged', () => {
  const current = getMaterialTemplate('accessory', '纽扣'), legacy = getMaterialTemplateByVersion(current.templateId, 1)
  assert.equal(current.version, 3); assert.equal(legacy.fields.find(item=>item.key==='holeCount')?.requiredWhen, undefined)
  const shank = root('纽扣', 'accessory', { categoryAttributes: { material: '树脂', construction: '圆形', fastening: '脚式', holeCount: null }, firstSku: sku({identityValues:{diameter:12}}) })
  assert.doesNotThrow(()=>repo.setMaterialApproval(shank.materialId,'SUBMIT'))
  assert.throws(()=>root('纽扣','accessory',{categoryAttributes:{fastening:'脚式',holeCount:0}}),/脚式/)
  assert.throws(()=>root('纽扣','accessory',{categoryAttributes:{fastening:'孔式',holeCount:2.5}}),/整数/)
  const hole = root('纽扣','accessory',{categoryAttributes:{material:'树脂',construction:'圆形',fastening:'孔式'},firstSku:sku({identityValues:{diameter:12}})})
  assert.throws(()=>repo.setMaterialApproval(hole.materialId,'SUBMIT'),/孔数/)
})

test('ATTR-017/018/019: bag units remain pinned per template and business CSV preserves the original version', () => {
  const latest=getMaterialTemplate('consumable','包装袋'),old=getMaterialTemplateByVersion(latest.templateId,1)
  assert.deepEqual(latest.fields.filter(item=>item.level==='sku' && item.type==='number').map(item=>item.unit),['mm','mm','μm'])
  assert.deepEqual(old.fields.filter(item=>item.level==='sku' && item.type==='number').map(item=>item.unit),['cm','cm','mm'])
  assert.deepEqual(getMaterialTemplateByVersion(latest.templateId,2).previousVersionConversions?.map(item=>item.factor),[10,10,1000]);assert.deepEqual(latest.previousVersionConversions,[])
  const record=root('包装袋','consumable',{templateId:old.templateId,templateVersion:1,categoryAttributes:{material:'PE'},firstSku:sku({identityValues:{length:30,width:20,thickness:.05}})})
  const item=repo.listMaterialSkuRecordsByMaterialId(record.materialId)[0]
  repo.resetMaterialArchiveCache();assert.equal(repo.getMaterialArchiveById(record.materialId)?.templateVersion,1);assert.equal(repo.getMaterialSkuRecordById(item.materialSkuId)?.identityValues?.thickness,.05)
  const table=parseMaterialBusinessCsv(exportMaterialBusinessRows('archives',[item.materialSkuId]));const head=table[0],data=table[1]
  assert.equal(data[head.indexOf('模板版本')],'1');data[head.indexOf('物料编码')]='IMPORTED-OLD-BAG';data[head.indexOf('SKU名称')]='旧规格复核'
  const preview=previewMaterialBusinessImport('consumable','archives',materialRowsToCsv(table));assert.equal(preview.failedRows,0)
  assert.throws(()=>saveMaterialTemplateVersion({...latest,previousVersionConversions:[{key:'thickness',fromUnit:'mm',toUnit:'μm',factor:0}]},'管理员'),/版本换算/)
})

test('ATTR-022/023/026: fluid grade and viscosity are independent; named dimensions validate each positive value and unit', () => {
  const fluid=root('油剂','consumable',{categoryAttributes:{model:'针车油'}})
  const oil=repo.createMaterialSkuRecord(fluid.materialId,sku({identityValues:{grade:'ISO VG',viscosityGrade:'22',netContent:1}}))!
  assert.equal(oil.identityValues?.grade,'ISO VG');assert.equal(oil.identityValues?.viscosityGrade,'22')
  const parts=root('缝纫机配件','parts')
  const item=repo.createMaterialSkuRecord(parts.materialId,sku({identityValues:{model:'配件A',dimensions:[{name:'外径',value:20,unit:'mm'},{name:'厚度',value:3,unit:'mm'}],interface:'两孔固定'}}))!
  assert.deepEqual(item.identityValues?.dimensions,[{name:'外径',value:20,unit:'mm'},{name:'厚度',value:3,unit:'mm'}])
  for(const dimensions of [[{name:'外径',value:0,unit:'mm'}],[{name:'',value:20,unit:'mm'}],[{name:'外径',value:20,unit:'KG'}],[{name:'外径',value:20,unit:'mm'},{name:'外径',value:3,unit:'mm'}]])assert.throws(()=>repo.createMaterialSkuRecord(parts.materialId,sku({identityValues:{dimensions}})),/尺寸/)
})

test('ATTR-028/029: equipment model belongs to its chosen type and retained labels survive model changes', () => {
  const types=listConfigDimensionOptions('equipmentTypes'),first=types[0],second=types[1]
  const model=saveMaterialEquipmentModel({id:'',equipmentTypeId:first.id,code:'MODEL-TEST',name:'已确认测试型号',enabled:true},'管理员')
  const pair={equipmentTypeId:first.id,equipmentTypeName:first.name_zh,equipmentModelId:model.id,equipmentModelName:model.name}
  const record=root('缝纫机配件','parts',{equipmentCompatibilityDetails:[pair],categoryAttributes:{partType:'针板',material:'钢'}})
  assert.throws(()=>root('缝纫机配件','parts',{equipmentCompatibilityDetails:[{...pair,equipmentTypeId:second.id}]}),/必须属于/)
  saveMaterialEquipmentModel({...model,name:'型号改名',enabled:false},'管理员')
  const saved=repo.updateMaterialArchive(record.materialId,{...record,remark:'仅更新说明'})
  assert.equal(saved.equipmentCompatibilityDetails?.[0].equipmentModelName,'已确认测试型号')
  assert.throws(()=>root('缝纫机配件','parts',{equipmentCompatibilityDetails:[pair]}),/启用/)
})

test('MAT-009/MSKU-007: references save stable IDs with display names; duplicate and invalid composition percentages are blocked', () => {
  const composition=listConfigDimensionOptions('compositions')[0],construction=listConfigDimensionOptions('constructions')[0],color=listConfigDimensionOptions('colors')[0]
  const fabric=root('梭织布','fabric',{compositionItems:[{component:composition.name_zh,percentage:100}],categoryAttributes:{construction:construction.name_zh,width:150,gramWeight:120},firstSku:sku({colorName:color.name_zh,mainUnit:'M'})})
  assert.equal(fabric.compositionItems?.[0].componentId,composition.id);assert.equal(fabric.categoryAttributeReferences?.construction[0].id,construction.id);assert.equal(fabric.materialNameTranslations?.en,'Material test')
  const item=repo.listMaterialSkuRecordsByMaterialId(fabric.materialId)[0];assert.equal(item.colorId,color.id)
  assert.throws(()=>root('梭织布','fabric',{compositionItems:[{component:composition.name_zh,percentage:50},{component:composition.name_zh,percentage:50}]}),/不能重复/)
  assert.throws(()=>root('梭织布','fabric',{compositionItems:[{component:composition.name_zh,percentage:Number.NaN}]}),/比例需有效/)
})

test('MSKU-004/017: display name changes keep identity; barcode aliases cannot shadow another SKU', () => {
  const record=root('胶带','consumable'),a=repo.createMaterialSkuRecord(record.materialId,sku({materialName:'展示名称A',identityValues:{width:20,length:30}}))!,b=repo.createMaterialSkuRecord(record.materialId,sku({identityValues:{width:25,length:30}}))!
  const next=repo.updateMaterialSkuRecord(a.materialSkuId,{...a,materialName:'展示名称B',barcodeAliases:['OLD-TEST-CODE']})!
  assert.equal(next.materialSkuCode,a.materialSkuCode);assert.equal(repo.resolveMaterialSkuIdentity('OLD-TEST-CODE')?.materialSkuId,a.materialSkuId)
  assert.throws(()=>repo.updateMaterialSkuRecord(a.materialSkuId,{...next,barcodeAliases:[b.materialSkuCode]}),/其他 SKU/)
})

test('ATTR/UOM: refined editors retain separate tabs and render unit-aware controls without changing saved v1 records', () => {
  const bag=root('包装袋','consumable'),item=repo.createMaterialSkuRecord(bag.materialId,sku({identityValues:{length:300,width:200,thickness:50}}))!
  const html=renderPcsMaterialSkuEditPage('consumable',bag.materialId,item.materialSkuId)
  assert.match(html,/厚度（μm）/);assert.match(html,/SKU 名称/);assert.match(html,/旧码 \/ 条码别名/);assert.match(html,/计量单位/)
  const parts=root('缝纫机配件','parts');const rootHtml=renderPcsMaterialArchiveEditPage('parts',parts.materialId)
  assert.match(rootHtml,/技术属性/);assert.match(rootHtml,/图片/)
  const yarn=getMaterialTemplate('yarn','针织用纱')
  assert.throws(()=>validateMaterialTemplateValues(yarn,'root',{plies:1.5},false),/整数/)
})

test('ASSET/COLOR-007: uploaded references retain original metadata and sample roles; invalid file types and sizes are blocked', () => {
  const record=root('胶带','consumable')
  assert.throws(()=>repo.validateMaterialAssetFile({fileName:'sample.exe',mimeType:'image/png',sizeBytes:10,role:'COLOR_SAMPLE'}),/图片/)
  assert.throws(()=>repo.validateMaterialAssetFile({fileName:'sample.png',mimeType:'image/png',sizeBytes:0,role:'COLOR_SAMPLE'}),/大于 0/)
  const asset=repo.addMaterialAsset({materialId:record.materialId,role:'COLOR_SAMPLE',name:'确认色样',fileName:'sample.png',mimeType:'image/png',sizeBytes:1234,url:'/materials/tmf/rope-real-bundle.jpg'})
  repo.resetMaterialArchiveCache()
  assert.deepEqual(repo.listMaterialAssets(record.materialId).find(item=>item.assetId===asset.assetId),asset)
  assert.equal(asset.sizeBytes,1234);assert.equal(asset.version,1);assert.equal(asset.sortOrder,0)
})

test('MAT-012: legacy KG or bare weight text never becomes fabric gram weight', () => {
  for (const text of ['0.2 KG', '180', '0.18 kg/㎡', '', undefined]) assert.equal(repo.parseMaterialGramWeightGsm(text), null)
  for (const text of ['180 g/m²', '180 g/㎡', '180gsm']) assert.equal(repo.parseMaterialGramWeightGsm(text), 180)
})

test('UOM-008/MSKU-015: pricing uses an active pricing relation and records the selected version', () => {
  const record = root('油剂','consumable'), item = repo.createMaterialSkuRecord(record.materialId,sku({mainUnit:'L',pricingUnit:'L'}))!
  const purchaseOnly = repo.saveMaterialUnitRelation(item.materialSkuId,{auxUnitId:'KG',mainQtyPerAux:1.2,basisType:'SPECIFICATION',basisReference:'已确认密度',uses:['PURCHASE'],isDefaultForUse:['PURCHASE'],status:'ACTIVE',changeReason:'采购关系'})
  assert.throws(()=>repo.saveMaterialStandardCost(item.materialSkuId,{pricingUnit:'KG',purchaseStandardCny:4,transportStandardCny:0,changeReason:'核价'}),/计价用途/)
  assert.throws(()=>repo.saveMaterialStandardCost(item.materialSkuId,{pricingUnit:'KG',pricingUnitRelationId:purchaseOnly.relationId,purchaseStandardCny:4,transportStandardCny:0,changeReason:'核价'}),/计价关系/)
  const pricing = repo.saveMaterialUnitRelation(item.materialSkuId,{...purchaseOnly,uses:['PURCHASE','PRICING'],isDefaultForUse:['PURCHASE','PRICING'],changeReason:'新增计价用途'})
  repo.saveMaterialStandardCost(item.materialSkuId,{pricingUnit:'KG',purchaseStandardCny:4,transportStandardCny:0,changeReason:'核价'})
  assert.equal(repo.listMaterialCostVersions(item.materialSkuId).at(-1)?.pricingUnitRelationId,pricing.relationId)
  const revised=repo.saveMaterialUnitRelation(item.materialSkuId,{...pricing,mainQtyPerAux:1.1,changeReason:'换算修订'})
  repo.saveMaterialStandardCost(item.materialSkuId,{purchaseStandardCny:5,changeReason:'修订后核价'})
  assert.equal(repo.listMaterialCostVersions(item.materialSkuId).at(-1)?.pricingUnitRelationId,revised.relationId)
  repo.saveMaterialStandardCost(item.materialSkuId,{pricingUnit:'L',purchaseStandardCny:3,changeReason:'改用主单位'})
  assert.equal(repo.listMaterialCostVersions(item.materialSkuId).at(-1)?.pricingUnitRelationId,undefined)
})

test('UNIT-004/005: configured area units allow up to eight quantity decimal places', () => {
  saveMaterialUnit({id:'unit-test-area',code:'m2',label:'平方米',dimension:'area',precision:8,enabled:true})
  assert.equal(materialUnitDimension('m2'),'面积')
  assert.throws(()=>saveMaterialUnit({id:'unit-test-area2',code:'cm2',label:'平方厘米',dimension:'area',precision:9,enabled:true}),/0–8/)
})

test('ATTR dictionaries and TPL category identities are independent and stable across new versions', () => {
  const template = getMaterialTemplate('accessory','拉链')
  assert.equal(template.fields.find(item=>item.key==='material')?.dictionaryId,'materialConstructions')
  assert.equal(template.fields.find(item=>item.key==='teeth')?.dictionaryId,'zipperTeeth')
  assert.equal(template.fields.find(item=>item.key==='opening')?.dictionaryId,'zipperOpenings')
  const record=root('拉链','accessory',{categoryAttributes:{material:'尼龙',teeth:'尼龙齿',opening:'闭口'},firstSku:sku({identityValues:{length:18,gauge:'3#'}})})
  assert.equal(record.categoryAttributeReferences?.teeth[0].id,listConfigDimensionOptions('zipperTeeth')[0].id)
  assert.equal(record.subcategoryId,template.categoryId)
  assert.throws(()=>saveMaterialTemplateVersion({...template,categoryCode:'CHANGED'},'管理员'),/不能变更/)
  const next=saveMaterialTemplateVersion({...template,changeNote:'说明修订'},'管理员')
  assert.equal(next.categoryId,template.categoryId);assert.equal(next.categoryCode,template.categoryCode)
  const lace=getMaterialTemplate('accessory','刺绣花边')
  assert.equal(lace.fields.find(item=>item.key==='width')?.level,'root');assert.equal(lace.fields.find(item=>item.key==='shape')?.level,'root')
  assert.equal(getMaterialTemplateByVersion(lace.templateId,1).fields.find(item=>item.key==='width')?.level,'sku')
})
