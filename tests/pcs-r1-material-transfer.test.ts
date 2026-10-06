import test,{beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import {pcsRecordStore} from '../src/data/pcs-record-runtime.ts'
import * as repo from '../src/data/pcs-material-archive-repository.ts'
import {buildMaterialBusinessTemplate,parseMaterialBusinessCsv,materialRowsToCsv,previewMaterialBusinessImport,applyMaterialBusinessImportPreview,exportMaterialBusinessRows,materialTransferHeaders,type MaterialTransferMode} from '../src/data/pcs-material-transfer.ts'
import {createMaterialImportValidationCsv,createMaterialCostValidationSnapshot} from '../src/data/pcs-material-performance-fixtures.ts'

const baseline=repo.getMaterialArchiveBaseline(),baseId='material-r1-MAT-FB-00000001-B01'
beforeEach(()=>{pcsRecordStore.setItem(repo.MATERIAL_ARCHIVE_STORAGE_KEY,JSON.stringify(baseline));repo.resetMaterialArchiveCache()})
const csv=(mode:MaterialTransferMode,rows:Record<string,string>[])=>{const headers=materialTransferHeaders(mode);return materialRowsToCsv([headers,...rows.map(row=>headers.map(h=>row[h]||''))])}
const sample=()=>{const [headers,row]=parseMaterialBusinessCsv(buildMaterialBusinessTemplate('fabric','archives'));return Object.fromEntries(headers.map((h,i)=>[h,row[i]]))}

test('GOV-008: material CSV handles Unicode, quoted commas, quotes and newlines',()=>{
 const values=[['编码','名称'],['A','"棉，麻", 面料\n说明']]
 assert.deepEqual(parseMaterialBusinessCsv(materialRowsToCsv(values)),values)
 assert.throws(()=>parseMaterialBusinessCsv('"编码\nA'),/引号未闭合/)
})
test('GOV-008: full root group previews without writes and commits once with every child',()=>{
 const white=sample(),black={...white,'SKU颜色':'黑色','SKU颜色编码':'black'}
 const original=pcsRecordStore.setItem;let writes=0;pcsRecordStore.setItem=(...args)=>{writes++;original(...args)}
 try{
  const preview=previewMaterialBusinessImport('fabric','archives',csv('archives',[white,black]))
  assert.equal(preview.validGroups,1);assert.equal(preview.failedRows,0);assert.equal(writes,0)
  const result=applyMaterialBusinessImportPreview(preview)
  assert.equal(writes,1);assert.equal(result[0].codes.length,2)
  repo.resetMaterialArchiveCache()
  const root=repo.getMaterialArchiveByCode(white['物料编码'])!
  assert.equal(repo.listMaterialSkuRecordsByMaterialId(root.materialId).length,2)
 }finally{pcsRecordStore.setItem=original}
})
test('GOV-008: one bad row blocks the whole parent while a different valid group remains eligible',()=>{
 const row=sample(),bad={...row,'主计量单位':'不存在'},other={...row,'物料编码':'CSV-OTHER'}
 const preview=previewMaterialBusinessImport('fabric','archives',csv('archives',[row,bad,other]))
 assert.equal(preview.validGroups,1);assert.equal(preview.failedRows,1)
 applyMaterialBusinessImportPreview(preview)
 assert.equal(repo.getMaterialArchiveByCode(row['物料编码']),null)
 assert.ok(repo.getMaterialArchiveByCode('CSV-OTHER'))
})
test('GOV-008: a save failure after preview publishes neither parent nor earlier children',()=>{
 const row=sample(),black={...row,'SKU颜色':'黑色','SKU颜色编码':'black'}
 const preview=previewMaterialBusinessImport('fabric','archives',csv('archives',[row,black])),before=JSON.stringify(repo.getMaterialArchiveStoreSnapshot())
 preview.groups[0].rows[1].values['SKU颜色编码']='white'
 assert.throws(()=>applyMaterialBusinessImportPreview(preview),/身份规格已存在/)
 assert.equal(JSON.stringify(repo.getMaterialArchiveStoreSnapshot()),before)
})
test('MAT/CODE: CSV stages use the preceding row actual generated SKU',()=>{
 const root=sample(),dye={...root,'加工类型':'DYEING','直接投入SKU':root['物料编码']+'-B01','SKU颜色编码':'black','SKU颜色':'黑色','Pantone体系':'TCX','Pantone色号':'19-4003'}
 const preview=previewMaterialBusinessImport('fabric','archives',csv('archives',[root,dye]))
 assert.equal(preview.failedRows,0)
 applyMaterialBusinessImportPreview(preview)
 const target=repo.resolveMaterialSkuIdentity(root['物料编码']+'-B01-black-19-4003PT')!
 assert.equal(repo.getMaterialSkuRecordById(target.inputSkuId!)?.materialSkuCode,root['物料编码']+'-B01')
})
test('UOM/COST: CSV rejects nonpositive relation and preserves an explicit zero cost',()=>{
 const unit={'SKU编码或ID':baseId,'辅助单位':'KG','1辅等于主数量':'0','依据类型':'SPECIFICATION','换算依据':'技术测定','状态':'ACTIVE','适用用途':'PRICING','调整原因':'维护'}
 assert.equal(previewMaterialBusinessImport('fabric','units',csv('units',[unit])).failedRows,1)
 const cost={'SKU编码或ID':baseId,'标准采购成本RMB':'0','基础运输成本RMB':'0','产出计价单位':'Yard','采购已含运输':'否','调整原因':'人工确认零值'}
 const preview=previewMaterialBusinessImport('fabric','costs',csv('costs',[cost]));assert.equal(preview.failedRows,0)
 applyMaterialBusinessImportPreview(preview);assert.equal(repo.getMaterialStandardCost(baseId).totalStandardCny,0)
 assert.equal(parseMaterialBusinessCsv(exportMaterialBusinessRows('costs',[baseId]))[1][1],'0')
})
test('GOV-027: business exports honor all selected identities without stock or supplier fields',()=>{
 const ids=baseline.skuRecords.map(row=>row.materialSkuId),table=parseMaterialBusinessCsv(exportMaterialBusinessRows('archives',ids))
 assert.equal(table.length,ids.length+1)
 assert.ok(table[0].includes('直接投入SKU'));assert.ok(table[0].includes('技术属性JSON'))
 assert.ok(!/供应商|库存|空差|Asaya|备份|恢复/.test(table[0].join(',')))
})
test('GOV-027: image columns reject bytes and temporary URLs, while empty root exports remain visible',()=>{
 const row=sample()
 for(const url of ['data:image/png;base64,AAAA','blob:temporary-preview','pcs-file:missing-file']){
  const preview=previewMaterialBusinessImport('fabric','archives',csv('archives',[{...row,'主图':url}]))
  assert.equal(preview.validGroups,0);assert.equal(preview.failedRows,1)
 }
 const copied=repo.copyMaterialArchive(baseline.records[0].materialId)!
 const exported=parseMaterialBusinessCsv(exportMaterialBusinessRows('archives',[],[copied.materialId]))
 assert.equal(exported.length,2)
 assert.equal(exported[1][exported[0].indexOf('物料编码')],copied.materialCode)
 assert.equal(exported[1][exported[0].indexOf('加工类型')],'无 SKU（待建立）')
})
test('PERF: 100 and 1000 rows validate completely and cost change reaches 100 descendants without publishing',t=>{
 const before=JSON.stringify(repo.getMaterialArchiveStoreSnapshot())
 for(const count of [100,1000] as const){const text=createMaterialImportValidationCsv(count),started=performance.now(),preview=previewMaterialBusinessImport('fabric','archives',text),elapsed=performance.now()-started;assert.equal(preview.rows.length,count);assert.equal(preview.validGroups,count);assert.equal(preview.failedRows,0);t.diagnostic(`${count} import rows pure preview ${elapsed.toFixed(2)} ms`)}
 const fixture=createMaterialCostValidationSnapshot(100),started=performance.now(),result=repo.previewMaterialCostChangeInSnapshot(fixture.snapshot,fixture.baseSkuId,{purchaseStandardCny:6}),elapsed=performance.now()-started
 assert.equal(result.length,101);assert.ok(result.every(row=>row.after===row.before!+1));assert.equal(JSON.stringify(repo.getMaterialArchiveStoreSnapshot()),before)
 t.diagnostic(`100 cost descendants pure preview ${elapsed.toFixed(2)} ms`)
})
