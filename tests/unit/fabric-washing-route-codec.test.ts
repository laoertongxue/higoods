import test from 'node:test'
import assert from 'node:assert/strict'
import { splitWashingLedger, rebuildWashingLedger } from '../../src/data/fcs/fabric-washing-storage-bridge.ts'
import { serializePrintExecution, parsePrintExecution } from '../../src/data/fcs/printing-execution-storage.ts'
import { removePredeterminedWashing, validateProcessRouteGraph } from '../../src/data/tech-pack-process-route.ts'
import { projectUneditedLegacyTechnicalDemo } from '../../src/data/pcs-technical-data-demo-projection.ts'
import { createTechnicalDataVersionBootstrapSnapshot } from '../../src/data/pcs-technical-data-version-bootstrap.ts'
import { resolveTechPackProcessEntryRule, type TechPackProcessEntry } from '../../src/data/fcs/tech-packs.ts'
import { MATERIAL_VARIANT_PROCESS_TYPE_LABELS } from '../../src/data/pcs-material-variant-types.ts'
import { getFcsCraftDictRef } from '../../src/data/pcs-material-variant-fcs-dict.ts'

test('WASH-219/222: current labels and legacy route display use 洗水 without changing stored identities or free text', () => {
 assert.equal(MATERIAL_VARIANT_PROCESS_TYPE_LABELS.wash, '洗水')
 assert.equal(getFcsCraftDictRef('craft-wash')?.processName, '洗水')
 for (const processCode of ['WASH', 'craft-wash']) {
  const old = {id:'history-1', entryType:'PROCESS_BASELINE', stageCode:'PREP', processCode, processName:'水洗', craftName:'水洗', assignmentGranularity:'ORDER', detailSplitDimensions:[]} as unknown as TechPackProcessEntry
  const before=structuredClone(old),display=resolveTechPackProcessEntryRule(old)
  assert.equal(display.processName,'洗水');assert.equal(display.craftName,'洗水');assert.equal(display.processCode,processCode)
  assert.deepEqual(old,before)
  assert.equal(resolveTechPackProcessEntryRule({...old,processName:'旧水洗工艺记录'}).processName,'旧水洗工艺记录')
 }
})

test('CT-01: washing is rejected from an authored static route',()=>{
 const entries=[{id:'w',stageCode:'PREP',processCode:'WASH',routeObjectKey:'BOM:f',inputObjectType:'FABRIC' as const,outputObjectType:'FABRIC' as const,inputMaterialSkuId:'sku',outputMaterialSkuId:'sku'}]
 assert.ok(validateProcessRouteGraph(entries).some(i=>i.code==='WASH_NOT_STATIC_ROUTE'))
})
test('CT-01: new planning bridges removed washing predecessors without mutating frozen history',()=>{
 const entries=[{id:'p',stageCode:'PREP',processCode:'PRINT',predecessorEntryIds:[]},{id:'w',stageCode:'PREP',processCode:'WASH',predecessorEntryIds:['p']},{id:'c',stageCode:'PROD',processCode:'CUT_PANEL',predecessorEntryIds:['w']}]
 const before=structuredClone(entries),next=removePredeterminedWashing(entries)
 assert.deepEqual(next.map(i=>i.id),['p','c']);assert.deepEqual(next[1].predecessorEntryIds,['p']);assert.deepEqual(entries,before)
})
test('CT-10: compressed legacy image references expand before selected leaf adoption',()=>{
 const image='data:image/png;base64,aGVsbG8='
 const raw=serializePrintExecution({version:1,state:{workOrders:[['p',{id:'p',imageUrl:image}]],nodeRecords:[],reviewRecords:[]},tasks:[{taskId:'t',imageUrl:image}]})
 const rows=splitWashingLedger(raw);assert.equal((rows[0].value as any).imageUrl,image)
 const restored=parsePrintExecution(rebuildWashingLedger(null,rows)!) as any
 assert.equal(restored.state.workOrders[0][1].imageUrl,image);assert.equal(restored.tasks[0].imageUrl,image)
})
test('CT-10: selective overrides and tombstones retain unrelated documents and root configuration',()=>{
 const raw=JSON.stringify({version:1,sources:[{id:'a',value:1},{id:'b',value:2}],receipts:[],defaults:{F:'location'}})
 const rows=splitWashingLedger(raw),next=JSON.parse(rebuildWashingLedger(raw,[{...rows[0],deleted:true}])!)
 assert.deepEqual(next.sources,[{id:'b',value:2}]);assert.deepEqual(next.defaults,{F:'location'})
 assert.throws(()=>splitWashingLedger('{"sources":[{}]}'),/稳定身份/)
})
test('CT-10: published historical washing content remains frozen while new static samples omit it',()=>{
 const baseline=createTechnicalDataVersionBootstrapSnapshot(),source=structuredClone(baseline),content=source.contents.find(c=>source.records.find(r=>r.technicalVersionId===c.technicalVersionId)?.versionStatus==='PUBLISHED')!
 content.processEntries.push({...content.processEntries[0],id:'historic-wash',processCode:'WASH',processName:'旧水洗'})
 const before=JSON.stringify(source)
 const projected=projectUneditedLegacyTechnicalDemo(source,baseline)
 assert.deepEqual(projected.contents.find(c=>c.technicalVersionId===content.technicalVersionId),content)
 assert.equal(JSON.stringify(source),before)
 assert.equal(baseline.contents.some(c=>c.processEntries.some(e=>e.processCode==='WASH')),false)
})
