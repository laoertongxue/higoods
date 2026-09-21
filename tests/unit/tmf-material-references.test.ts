import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildTmfSemiFinishedSkuCode, listMaterialArchives, getMaterialSkuRecordById } from '../../src/data/pcs-material-archive-repository.ts'

test('织带与绳子参考档案接入实际物料库，保留图片来源和未确认尺寸，不替换橡筋', () => {
  const records = listMaterialArchives('accessory')
  for (const [id, category, filename, original] of [
    ['tmf-webbing-reference', '织带', 'webbing-real-roll.jpg', '半成品织带卷.jpg'],
    ['tmf-rope-reference', '绳子', 'rope-real-bundle.jpg', '半成品绳子.jpg'],
  ]) {
    const archive = records.find((item) => item.materialId === id)!
    const sku = getMaterialSkuRecordById(`${id}-white`)!
    assert.ok(archive && sku)
    assert.equal(archive.categoryName, category)
    assert.match(archive.widthText, /待确认/)
    assert.equal(sku.materialId, archive.materialId)
    assert.equal(sku.pricingUnit, '米')
    assert.equal(sku.lengthCm, 0)
    assert.equal(sku.widthCm, 0)
    assert.equal(sku.skuImageUrl, archive.mainImageUrl)
    assert.deepEqual(readFileSync(new URL(`../../public/materials/tmf/${filename}`, import.meta.url)), readFileSync(new URL(`../../docs/product-design/tmf-webbing/assets/${original}`, import.meta.url)))
  }
  assert.equal(records.find((item) => item.materialId === 'material_accessory_elastic_001')!.materialCode, 'ACC-ELASTIC-42CM')
  assert.equal(records.filter((item) => item.materialId.startsWith('tmf-')).length, 2)
})

test('同分钟新建不同幅宽织带和绳径主档不共用SPU身份，SKU保持各自父档归属',async()=>{
 const m=await import('../../src/data/pcs-material-archive-repository.ts')
 const reference=m.getMaterialArchiveById('tmf-webbing-reference')!
 const base={...reference,materialName:'测试同名织带',materialNameEn:'Test webbing',mainImageUrl:'',categoryName:'织带',mainUnit:'米',pricingUnit:'米',auxiliaryUnits:['卷'],widthText:'20mm'}
 const before=m.listMaterialArchives('accessory').length
 for(const widthText of ['','待确认','20/30mm','0mm','-20mm','Φ20mm','50CM截断'])assert.throws(()=>m.createMaterialArchive({...base,widthText}),/织带幅宽/)
 assert.equal(m.listMaterialArchives('accessory').length,before)
 const records=['20mm','3cm','40毫米'].map(widthText=>m.createMaterialArchive({...base,widthText}))
 assert.equal(new Set(records.map(r=>r.materialId)).size,3)
 assert.equal(new Set(records.map(r=>r.materialCode)).size,3)
 assert.deepEqual(records.map(r=>r.widthText),['20mm','30mm','40mm'])
 const draft={colorName:'蓝色',specName:'P001',sizeName:'',skuImageUrl:'',costPrice:0,freightCost:0,weightKg:0,lengthCm:0,widthCm:0,heightCm:0,barcode:''}
 for(const record of records){const sku=m.createMaterialSkuRecord(record.materialId,draft)!;assert.equal(sku.materialId,record.materialId);assert.equal(sku.materialCode,record.materialCode);assert.equal(m.listMaterialSkuRecordsByMaterialId(record.materialId).length,1)}
 const lineageSku=m.createMaterialSkuRecord(records[0].materialId,{...draft,pantoneCode:'19-4052',patternCode:'P001'})!
 assert.equal(lineageSku.materialSkuCode,`${records[0].materialCode}-19-4052-蓝色-P001`)
 assert.equal(lineageSku.pantoneCode,'19-4052');assert.equal(lineageSku.patternCode,'P001')
 assert.throws(()=>m.createMaterialSkuRecord(records[1].materialId,{...draft,colorName:''}),/必须填写颜色编码/)
 const rope=m.createMaterialArchive({...base,categoryName:'绳子',materialName:'测试绳子',widthText:'Φ5mm'})
 assert.equal(rope.widthText,'Φ5mm');assert.match(rope.materialCode,/-D5MM$/)
 const repeated=m.createMaterialArchive({...base,widthText:'20mm'})
 assert.notEqual(repeated.materialId,records[0].materialId);assert.notEqual(repeated.materialCode,records[0].materialCode)
 assert.equal(m.getMaterialArchiveById('tmf-webbing-reference')!.widthText,'幅宽待确认','不将参考图强行认定为正式尺寸')
})

test('TMF半成品SKU按SPU→潘通色号→颜色→花型生成，长度和端头不进入SKU', () => {
  assert.equal(
    buildTmfSemiFinishedSkuCode({ spuCode: 'A', pantoneCode: '19-4052', colorCode: 'blue', patternCode: 'P001' }),
    'A-19-4052-BLUE-P001',
  )
  assert.equal(
    buildTmfSemiFinishedSkuCode({ spuCode: 'A', pantoneCode: '19-4052', colorCode: 'blue' }),
    'A-19-4052-BLUE',
  )
  assert.equal(
    buildTmfSemiFinishedSkuCode({ spuCode: 'TMF-W20MM', colorCode: '本白', patternCode: '' }),
    'TMF-W20MM-本白',
  )
  assert.throws(() => buildTmfSemiFinishedSkuCode({ spuCode: 'A', colorCode: '' }), /至少需要 SPU 和颜色编码/)
  assert.doesNotMatch(
    buildTmfSemiFinishedSkuCode({ spuCode: 'A', pantoneCode: '19-4052', colorCode: 'blue', patternCode: 'P001' }),
    /50CM|70CM|METAL|PLASTIC|SILICONE/i,
  )
})
