import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { pcsRecordStore } from '../src/data/pcs-record-runtime.ts'
import * as repo from '../src/data/pcs-material-archive-repository.ts'
import { getMaterialTemplate, getMaterialConfigSnapshot, resetMaterialConfigCache, PCS_MATERIAL_CONFIG_KEY, saveMaterialEquipmentModel, saveMaterialTemplate, saveMaterialUnit } from '../src/data/pcs-material-config.ts'
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
  return repo.createMaterialArchive({ kind, categoryName,categoryAttributes:categoryName==='扣合类'?{installationType:'机打'}:{}, materialName: `${categoryName}测试`, materialNameEn: 'Material test', specSummary: '', composition: '', processTags: [], widthText: '', gramWeightText: '', pricingUnit: 'PCS', mainImageUrl: '/materials/tmf/rope-real-bundle.jpg', barcodeTemplateCode: 'material-label-r1', remark:'',...(kind==='consumable'||kind==='parts'?{firstSku:sku({specName:'首次登记'})}:{}),...extra })
}
function sku(extra: Partial<MaterialSkuDraftInput> = {}): MaterialSkuDraftInput { return { colorName: '白色', specName: '标准规格', sizeName: '', mainUnit: 'PCS', skuImageUrl: '/materials/tmf/rope-real-bundle.jpg', costPrice: 0, freightCost: 0, weightKg: 0, lengthCm: 0, widthCm: 0, heightCm: 0, barcode: '', ...extra } }

test('MAT-009/MSKU-007: references save stable IDs with display names; duplicate and invalid composition percentages are blocked', () => {
  const composition=listConfigDimensionOptions('compositions')[0],construction=listConfigDimensionOptions('constructions')[0],color=listConfigDimensionOptions('colors')[0]
  const fabric=root('梭织面料','fabric',{compositionItems:[{component:composition.name_zh,percentage:100}],categoryAttributes:{construction:construction.name_zh,width:150,gramWeight:120},firstSku:sku({colorName:color.name_zh,mainUnit:'M'})})
  assert.equal(fabric.compositionItems?.[0].componentId,composition.id);assert.equal(fabric.categoryAttributeReferences?.construction[0].id,construction.id);assert.equal(fabric.materialNameTranslations?.en,'Material test')
  const item=repo.listMaterialSkuRecordsByMaterialId(fabric.materialId)[0];assert.equal(item.colorId,color.id)
  assert.throws(()=>root('梭织面料','fabric',{compositionItems:[{component:composition.name_zh,percentage:50},{component:composition.name_zh,percentage:50}]}),/不能重复/)
  assert.throws(()=>root('梭织面料','fabric',{compositionItems:[{component:composition.name_zh,percentage:Number.NaN}]}),/比例需有效/)
})

test('MSKU-004/017: display name changes keep identity; barcode aliases cannot shadow another SKU', () => {
  const record=root('胶带','consumable'),a=repo.createMaterialSkuRecord(record.materialId,sku({materialName:'展示名称A',specName:'20mm',identityValues:{width:20,length:30}}))!,b=repo.createMaterialSkuRecord(record.materialId,sku({specName:'25mm',identityValues:{width:25,length:30}}))!
  const next=repo.updateMaterialSkuRecord(a.materialSkuId,{...a,materialName:'展示名称B',barcodeAliases:['OLD-TEST-CODE']})!
  assert.equal(next.materialSkuCode,a.materialSkuCode);assert.equal(repo.resolveMaterialSkuIdentity('OLD-TEST-CODE')?.materialSkuId,a.materialSkuId)
  assert.throws(()=>repo.updateMaterialSkuRecord(a.materialSkuId,{...next,barcodeAliases:[b.materialSkuCode]}),/其他 SKU/)
})

test('ASSET/COLOR-007: uploaded references retain original metadata and sample roles; invalid file types and sizes are blocked', () => {
  const record=root('扣合类')
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
