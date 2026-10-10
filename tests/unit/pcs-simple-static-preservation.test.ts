import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { getMaterialArchiveBaseline, MATERIAL_ARCHIVE_STORAGE_KEY } from '../../src/data/pcs-material-archive-repository.ts'
import { assemblePcsRecordSnapshot, decodePcsRecordSnapshot } from '../../src/data/pcs-record-codec.ts'
import { isPcsNewStaticRecord, PCS_STATIC_DEMO_VERSION } from '../../src/data/pcs-record-static-versions.ts'
import { migrateMaterialMockImage } from '../../src/data/pcs-reviewed-image-catalog.ts'
const out='output/playwright/pcs-simple-materials/adversarial'
const evidence:any[]=[]

test('SIMPLE-058: reviewed bag / cutting blade / white tape source mappings are consistent and user images are preserved',async()=>{
 const baseline=getMaterialArchiveBaseline(),published=JSON.parse(await readFile('src/data/generated/pcs-record-baseline.json','utf8')),served=JSON.parse(published[MATERIAL_ARCHIVE_STORAGE_KEY])
 for(const [code,label,url,specs] of [
  ['MAT-CS-00000001','透明包装袋','/materials/packing-bag.jpg',['30×25cm','40×25cm']],
  ['MAT-CS-00000002','白色辅助胶带','/materials/pcs-reviewed/tape-white.jpg',['20mm×50m','25mm×50m']],
  ['MAT-EP-00000001','裁剪刀片','/materials/pcs-reviewed/knife.jpg',['10英寸','12英寸']],
 ] as const){
  const root=baseline.records.find(x=>x.materialCode===code)!,stored=served.records.find((x:any)=>x.materialCode===code)!
  assert.equal(root.materialName,label);assert.equal(root.mainImageUrl,url);assert.equal(stored.mainImageUrl,url)
  const skus=baseline.skuRecords.filter(x=>x.materialId===root.materialId),storedSkus=served.skuRecords.filter((x:any)=>x.materialId===root.materialId)
  assert.deepEqual(skus.map(x=>x.specName),[...specs]);assert.deepEqual(storedSkus.map((x:any)=>x.specName),[...specs]);assert.ok(skus.every(x=>x.skuImageUrl===url));assert.ok(storedSkus.every((x:any)=>x.skuImageUrl===url))
  const bytes=await readFile('public'+url);assert.equal(bytes[0],0xff);assert.equal(bytes[1],0xd8);assert.ok(bytes.length>1000)
  const user='pcs-file:user-chosen-'+code;assert.equal(migrateMaterialMockImage(code,user,'material'),user);assert.equal(migrateMaterialMockImage(skus[0].materialSkuCode,user,'sku'),user)
  evidence.push({code,label,url,specs,sha256:createHash('sha256').update(bytes).digest('hex'),visualObservation:code==='MAT-CS-00000001'?'透明LDPE袋局部，未见尺寸刻度':code==='MAT-CS-00000002'?'白色胶带卷，未见宽度/长度刻度':'裁剪直刀片，未见10/12英寸刻度',scope:'识别图对应物料类型；图片共享仅作外观识别，不以照片证明不可辨尺寸'})
 }
})

test('SIMPLE-058: new static publication cannot overwrite user overlays or resurrect root / SKU deletion markers',async()=>{
 const baseline=getMaterialArchiveBaseline(),bag=baseline.records.find(x=>x.materialCode==='MAT-CS-00000001')!,knife=baseline.records.find(x=>x.materialCode==='MAT-EP-00000002')!,bagSku=baseline.skuRecords.find(x=>x.materialId===bag.materialId)!,knifeSkus=baseline.skuRecords.filter(x=>x.materialId===knife.materialId)
 const previous={version:1,records:[bag,knife],skuRecords:[bagSku,...knifeSkus]},next={version:2,records:[{...bag,materialName:'新版静态袋名称',mainImageUrl:'/new-static-bag.jpg'},{...knife,materialName:'新版静态刀具名称'}],skuRecords:[{...bagSku,specName:'新版静态袋规格'},...knifeSkus.map(x=>({...x,specName:'新版静态刀具规格'}))]}
 const oldRows=decodePcsRecordSnapshot(MATERIAL_ARCHIVE_STORAGE_KEY,JSON.stringify(previous))
 const rootId=`${MATERIAL_ARCHIVE_STORAGE_KEY}/records/${bag.materialId}`,skuId=`${MATERIAL_ARCHIVE_STORAGE_KEY}/skuRecords/${bagSku.materialSkuId}`
 const rootOverlay={...oldRows.find(x=>x.id===rootId)!,version:7,value:{position:0,data:{...bag,materialName:'用户保存袋名称',remark:'用户维护说明',mainImageUrl:'pcs-file:chosen-image'}}}
 const skuOverlay={...oldRows.find(x=>x.id===skuId)!,version:9,value:{position:0,data:{...bagSku,specName:'用户确认规格'}}}
 const deletes=[`records/${knife.materialId}`,...knifeSkus.map(x=>`skuRecords/${x.materialSkuId}`)].map(id=>({id:`${MATERIAL_ARCHIVE_STORAGE_KEY}/${id}`,collection:`${MATERIAL_ARCHIVE_STORAGE_KEY}/${id.split('/')[0]}`,value:null,version:5,deleted:true}))
 const overlays=[rootOverlay,skuOverlay,...deletes]
 for(const filter of [undefined,isPcsNewStaticRecord]){
  const old=assemblePcsRecordSnapshot(MATERIAL_ARCHIVE_STORAGE_KEY,overlays,JSON.stringify(previous),filter) as any,newer=assemblePcsRecordSnapshot(MATERIAL_ARCHIVE_STORAGE_KEY,overlays,JSON.stringify(next),filter) as any
  for(const result of [old,newer]){const root=result.records.find((x:any)=>x.materialId===bag.materialId),sku=result.skuRecords.find((x:any)=>x.materialSkuId===bagSku.materialSkuId);assert.equal(root.materialName,'用户保存袋名称');assert.equal(root.mainImageUrl,'pcs-file:chosen-image');assert.equal(root.remark,'用户维护说明');assert.equal(sku.specName,'用户确认规格');assert.ok(!result.records.some((x:any)=>x.materialId===knife.materialId));assert.ok(!result.skuRecords.some((x:any)=>knifeSkus.some(k=>k.materialSkuId===x.materialSkuId)))}
  assert.equal(newer.version,2)
 }
 assert.ok(isPcsNewStaticRecord(rootId));assert.ok(deletes.every(row=>isPcsNewStaticRecord(row.id)));assert.deepEqual(overlays.map(x=>x.version),[7,9,5,5,5])
 evidence.push({publication:[1,2],staticVersion:PCS_STATIC_DEMO_VERSION,rootOverlay:rootId,skuOverlay:skuId,tombstones:deletes.map(x=>x.id),preserved:['user name','user explanation','durable image reference','user specification','root and both SKU deletions'],paths:['ordinary seed merge','registered newly introduced seed merge'],scope:'真实组装函数的发布前后契约；此专项不替代浏览器IndexedDB读取、刷新、性能证据'})
 await mkdir(out,{recursive:true});await writeFile(out+'/static-preservation.json',JSON.stringify({passed:true,requirements:['SIMPLE-058'],evidence,visualCheckedBy:'simple_pages actual local images inspected 2026-10-09',limitations:'照片无可辨尺寸刻度，不能用照片证明10/12英寸或20/25mm实测尺寸；类型/颜色与档案一致，规格明确由文字提供。'},null,2))
})
