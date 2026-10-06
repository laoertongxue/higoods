import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createTechnicalDataVersionBootstrapSnapshot } from '../../src/data/pcs-technical-data-version-bootstrap.ts'
import { buildTechnicalDataDerivedState, getTechnicalDataVersionContent, getNextTechnicalVersionIdentity, listTechnicalDataVersions } from '../../src/data/pcs-technical-data-version-repository.ts'
import { getMaterialSkuRecordById } from '../../src/data/pcs-material-archive-repository.ts'
import { projectUneditedLegacyTechnicalDemo } from '../../src/data/pcs-technical-data-demo-projection.ts'
import { registerPcsFile } from '../../src/data/pcs-record-runtime.ts'
import { validateProcessRouteGraph } from '../../src/data/tech-pack-process-route.ts'
import type { TechnicalDataVersionStoreSnapshot } from '../../src/data/pcs-technical-data-version-types.ts'
import { productionDemands } from '../../src/data/fcs/production-demands.ts'

const baseline = createTechnicalDataVersionBootstrapSnapshot()
const legacy: TechnicalDataVersionStoreSnapshot = JSON.parse(readFileSync('tests/fixtures/technical-pack-legacy-demo.json', 'utf8'))

function assertDistribution(snapshot: TechnicalDataVersionStoreSnapshot) {
  assert.equal(snapshot.records.length, 26)
  assert.equal(snapshot.records.filter(record => record.versionStatus === 'PUBLISHED').length, 20)
  assert.equal(snapshot.records.filter(record => record.versionStatus === 'DRAFT' && record.reviewStage === '未提交审核').length, 3)
  assert.equal(snapshot.records.filter(record => record.versionStatus === 'DRAFT' && record.reviewStage === '第一阶段并行审核').length, 3)
  assert.deepEqual(snapshot.records.map(record => Number(record.technicalVersionCode)).sort((a,b) => a-b), Array.from({ length: 26 }, (_, i) => i + 1))
}

test('TP-ID-002: FCS live hydration cannot change the static 26 identities or their numeric sequence', () => {
  const saved = structuredClone(productionDemands)
  try {
    productionDemands.splice(0, productionDemands.length, ...saved.filter(row => row.spuCode.startsWith('SPU-2024')))
    const rebuilt = createTechnicalDataVersionBootstrapSnapshot(5)
    assertDistribution(rebuilt)
    assert.deepEqual(rebuilt.records.map(row => [row.technicalVersionId, row.technicalVersionCode]), baseline.records.map(row => [row.technicalVersionId, row.technicalVersionCode]))
  } finally { productionDemands.splice(0, productionDemands.length, ...saved) }
})

test('TP-DATA-001: baseline has 20 actual complete formal versions and three plus three draft review states', () => {
  assertDistribution(baseline)
  for (const record of baseline.records.filter(record => record.versionStatus === 'PUBLISHED')) {
    const content = baseline.contents.find(item => item.technicalVersionId === record.technicalVersionId)!
    const derived = buildTechnicalDataDerivedState(record.versionStatus, content)
    assert.equal(derived.completenessScore, 100, record.technicalVersionId)
    assert.deepEqual(derived.missingItemCodes, [])
    assert.equal(buildTechnicalDataDerivedState('PUBLISHED', { ...content, patternFiles: [] }).completenessScore, 80, 'removing originals must reduce score')
    for (const file of content.patternFiles) {
      for (const original of [file.dxfFile!, file.rulFile!]) {
        const path = `public${original.dataUrl}`
        assert.ok(existsSync(path), path)
        assert.equal(original.fileSize, statSync(path).size)
      }
    }
    for (const design of content.patternDesigns) assert.ok(existsSync(`public${design.imageUrl}`))
    assert.ok(record.publishedAt)
    assert.ok(!record.versionLabel.includes('Mock'))
  }
})

test('TP-ROUTE-001: all twenty formal routes have three resolvable dye→print→wash chains and five two-craft pieces', () => {
  for (const record of listTechnicalDataVersions().filter(record => record.versionStatus === 'PUBLISHED')) {
    const content = getTechnicalDataVersionContent(record.technicalVersionId)!
    assert.deepEqual(validateProcessRouteGraph(content.processEntries, { requireComplete: true }), [], `stored graph ${record.technicalVersionCode}`)
    const prep = content.processEntries.filter(entry => entry.stageCode === 'PREP')
    const keys = [...new Set(prep.map(entry => entry.routeObjectKey))]
    assert.equal(keys.length, 3)
    for (const key of keys) {
      const lane = prep.filter(entry => entry.routeObjectKey === key).sort((a,b) => (a.routeStepNo || 0) - (b.routeStepNo || 0))
      assert.deepEqual(lane.map(entry => entry.processCode), ['DYE','PRINT','WASH'])
      lane.forEach((entry, index) => {
        const input = getMaterialSkuRecordById(entry.inputMaterialSkuId || '')
        const output = getMaterialSkuRecordById(entry.outputMaterialSkuId || '')
        assert.ok(input && output, `${record.technicalVersionCode} ${entry.id}`)
        assert.equal(output.status, 'ACTIVE'); assert.equal(output.approvalStatus, 'APPROVED')
        if (index) { assert.deepEqual(entry.predecessorEntryIds, [lane[index - 1].id]); assert.equal(entry.inputMaterialSkuId, lane[index - 1].outputMaterialSkuId) }
        if (entry.processCode === 'WASH') assert.equal(entry.inputMaterialSkuId, entry.outputMaterialSkuId)
        else assert.notEqual(entry.inputMaterialSkuId, entry.outputMaterialSkuId)
      })
    }
    const crafts = content.processEntries.filter(entry => entry.routeSourceKind === 'PIECE_CRAFT')
    const pieceKeys = [...new Set(crafts.map(entry => entry.routeObjectKey))]
    assert.equal(pieceKeys.length, 5)
    for (const key of pieceKeys) {
      const lane = crafts.filter(entry => entry.routeObjectKey === key).sort((a,b) => (a.routeStepNo || 0) - (b.routeStepNo || 0))
      assert.deepEqual(lane.map(entry => entry.craftName), ['绣花','压褶'])
      assert.deepEqual(lane[1].predecessorEntryIds, [lane[0].id])
      assert.ok(lane.every(entry => entry.inputObjectType === 'CUT_PIECE' && entry.outputObjectType === 'CUT_PIECE'))
    }
  }
  assert.equal(getMaterialSkuRecordById('material-r1-process-embroidery')?.approvalStatus, 'DRAFT', 'unreferenced candidates stay draft')
  assert.equal(getMaterialSkuRecordById('material-r1-process-heat')?.approvalStatus, 'DRAFT')
})

test('TP-ID-001: ID is persisted independent of ordering and next identity uses the global maximum', () => {
  const records = listTechnicalDataVersions()
  assert.equal(getNextTechnicalVersionIdentity().technicalVersionCode, '27')
  assert.equal(records.find(item => item.technicalVersionId === 'tdv_demand_ASYSA26060310')?.technicalVersionCode, '1')
  assert.equal(records.find(item => item.technicalVersionId === 'tdv_seed_project_018_review_skip_demo')?.baseTechnicalVersionCode, '25')
  const formal = records.find(item => item.versionStatus === 'PUBLISHED')!
  formal.missingItemCodes.push('PROCESS')
  assert.deepEqual(listTechnicalDataVersions().find(item => item.technicalVersionId === formal.technicalVersionId)?.missingItemCodes, [], 'fast list reads must remain isolated from caller mutation')
})

test('TP-LEGACY-001: exact old static copies project read-only, preserve source identities and preserve changed records or content', () => {
  const projected = projectUneditedLegacyTechnicalDemo(legacy, baseline)
  assert.equal(projected.records.length, 1)
  assert.equal(projected.records[0].technicalVersionCode, '25')
  assert.equal(projected.records[0].versionStatus, 'DRAFT')
  assert.equal(buildTechnicalDataDerivedState('DRAFT', projected.contents[0]).completenessScore, 100)
  assert.equal(projected.records.find(item => item.technicalVersionId === 'tdv_seed_project_018_base')?.createdFromTaskType, 'PLATE')
  assert.equal(projected.records.find(item => item.technicalVersionId === 'tdv_seed_project_018_base')?.createdFromTaskCode, 'PT-20260407-018')
  const changed = structuredClone(legacy)
  changed.records[0].note = '用户保存的备注'
  changed.contents[0].patternDesc = '用户保存的纸样说明'
  const protectedProjection = projectUneditedLegacyTechnicalDemo(changed, baseline)
  assert.deepEqual(protectedProjection.records[0], changed.records[0])
  assert.deepEqual(protectedProjection.contents[0], changed.contents[0])
  const removed = structuredClone(legacy); removed.records.shift(); removed.contents.shift()
  const withDeletion = projectUneditedLegacyTechnicalDemo(removed, baseline)
  assert.equal(withDeletion.records.length, removed.records.length, 'partial old source cannot resurrect omitted rows')
  assert.deepEqual(legacy.records[0].technicalVersionCode, 'TDV-20260407-018')
  const hydrated = structuredClone(legacy)
  const design = hydrated.contents[0].patternDesigns[0]
  const originalFileId = design.imageUrl.slice('pcs-file:'.length)
  const preview = registerPcsFile(new Blob(['legacy image']), originalFileId)
  design.imageUrl = preview.url; design.previewThumbnailDataUrl = preview.url
  assert.equal(projectUneditedLegacyTechnicalDemo(hydrated, baseline).records[0].technicalVersionCode, '25', 'same saved file decoded as a blob URL remains the same demo identity')
  const changedPreview = registerPcsFile(new Blob(['different image']), 'technical-pack-user-replacement')
  design.imageUrl = changedPreview.url; design.previewThumbnailDataUrl = changedPreview.url
  assert.deepEqual(projectUneditedLegacyTechnicalDemo(hydrated, baseline).contents[0], hydrated.contents[0], 'different registered file identity remains a user edit')
})

test('TP-LEGACY-002: repository reads old demo without writes; new legacy-source creation is rejected', () => {
  const result = spawnSync(process.execPath, ['--import','tsx','--input-type=module','-e', `
    import assert from 'node:assert/strict'; import fs from 'node:fs';
    const source=JSON.parse(fs.readFileSync('tests/fixtures/technical-pack-legacy-demo.json','utf8'));
    const raw=JSON.stringify(source);let writes=0;const values=new Map([['higood-pcs-technical-data-version-store-v5',raw]]);
    const {pcsRecordStore}=await import('./src/data/pcs-record-runtime.ts');
    Object.assign(pcsRecordStore,{getItem:k=>values.get(k)||null,setItem:(k,v)=>{writes++;values.set(k,v)},removeItem:()=>{writes++}});
    const repo=await import('./src/data/pcs-technical-data-version-repository.ts');
    const list=repo.listTechnicalDataVersions();assert.equal(list.length,26);assert.equal(list.filter(x=>x.versionStatus==='PUBLISHED'&&x.completenessScore===100&&!x.missingItemCodes.length).length,20);assert.equal(writes,0);
    const old=list.find(x=>x.createdFromTaskType==='PLATE');assert(old);assert.throws(()=>repo.createTechnicalDataVersionDraft({...old,technicalVersionId:'new-legacy'}),/只能由生产准备单生成/);assert.equal(writes,0);
    repo.assignTechnicalPackResponsible(old.technicalVersionId,'跟单','U001');
    const saved=JSON.parse(values.get('higood-pcs-technical-data-version-store-v5'));assert.equal(saved.records.length,1,'one edit must not write the remaining static baseline');assert.equal(saved.contents.length,1);assert.equal(repo.buildTechnicalDataDerivedState(saved.records[0].versionStatus,saved.contents[0]).completenessScore,100);
  `], {encoding:'utf8'})
  assert.equal(result.status, 0, result.stdout + result.stderr)
})

test('TP-LEGACY-003: early release content upgrades after person maintenance but genuine technical edits remain intact', () => {
  const record = listTechnicalDataVersions().find(item => item.technicalVersionCode === '1')!
  const content = getTechnicalDataVersionContent(record.technicalVersionId)!
  const oldJson = JSON.stringify(content)
    .replaceAll('MAT-FB-00000002', 'DR-COTTON-001')
    .replaceAll('白底蓝花棉布坯布', '设计改款白底蓝花棉布')
    .replaceAll('material-r1-DR-COTTON-001-B01', 'dr_cotton_raw')
    .replaceAll('material-r1-process-techpack-cotton-dye', 'dr_cotton_dyed')
    .replaceAll('material-r1-process-techpack-cotton-print', 'dr_cotton_dye_print')
  const oldContent = JSON.parse(oldJson)
  oldContent.patternDesigns[1].name = 'DR-BLUE-FLOWER-001 · 设计改款白底蓝花棉布正面花型演示图'
  oldContent.patternFiles.forEach((file: { imageUrl?: string }) => { delete file.imageUrl })
  oldContent.processEntries.forEach((entry: { routeSourceKind?: string; craftName?: string; processCode: string; predecessorEntryIds: string[] }) => {
    if (entry.routeSourceKind === 'PIECE_CRAFT' && entry.craftName === '绣花') entry.predecessorEntryIds = [1,2,3].map(index => `${record.technicalVersionId}-flow-cut-${index}`)
    if (entry.processCode === 'SEW') entry.predecessorEntryIds = entry.predecessorEntryIds.filter(id => !id.includes('-flow-cut-'))
  })
  const source = { version: 5, records: [{ ...record, merchandiserId: 'U001', merchandiserName: '人员维护结果', updatedAt: '2026-10-06 11:35' }], contents: [oldContent], pendingItems: [] }
  const projected = projectUneditedLegacyTechnicalDemo(source, baseline)
  assert.deepEqual(projected.records, source.records, 'person fields and maintenance timestamps are retained exactly')
  assert.equal(projected.contents[0].bomItems[1].materialCode, 'MAT-FB-00000002')
  assert.deepEqual(validateProcessRouteGraph(projected.contents[0].processEntries, { requireComplete: true }), [])
  const changed = structuredClone(source)
  changed.contents[0].patternDesc = '真实业务纸样编辑'
  assert.deepEqual(projectUneditedLegacyTechnicalDemo(changed, baseline).contents, changed.contents, 'a real content edit cannot be replaced')
})


test('TP-PAGE-001: route rendering preserves stored IDs and hides objects without additional processing', async () => {
  const { ensureTechPackPageState, state, getChecklist } = await import('../../src/pages/tech-pack/context.ts')
  const { renderProcessTab } = await import('../../src/pages/tech-pack/process-domain.ts')
  const record = listTechnicalDataVersions().find(item => item.technicalVersionCode === '1')!
  ensureTechPackPageState(record.styleCode, { styleId: record.styleId, technicalVersionId: record.technicalVersionId, activeTab: 'process' })
  assert.equal(state.processRouteStatus, 'CONFIRMED', 'detail must preserve the confirmed explicit route')
  assert.deepEqual(validateProcessRouteGraph(state.techniques, { requireComplete: true }), [])
  assert.ok(getChecklist().filter(item => item.required).every(item => item.done), 'detail completeness agrees with the formal list')
  assert.deepEqual(state.techniques.map(item => item.id), getTechnicalDataVersionContent(record.technicalVersionId)!.processEntries.map(item => item.id), 'a read must not regenerate graph identities')
  assert.equal(state.patternItems.length, 2, 'no artificial incomplete packages may be injected into a real stored package')
  assert.equal(state.patternItems[1].id, `${record.technicalVersionId}-pattern-main`)
  state.bomItems.push({ ...state.bomItems[0], id: 'unused-bom', materialName: '不需要加工的测试物料', materialCode: 'UNUSED' })
  state.patternItems[1].pieceRows.push({ ...state.patternItems[1].pieceRows[0], id: 'unused-piece', name: '不需要加工的测试裁片', specialCrafts: [] })
  const html = renderProcessTab()
  assert.equal(html.match(/data-tech-prep-route-lane=/g)?.length, 3)
  for (const name of ['前片','后片','左袖片','右袖片','领片']) assert.ok(html.includes(`>${name}<`), name)
  assert.ok(!html.includes('不需要加工的测试物料'))
  assert.ok(!html.includes('不需要加工的测试裁片'))
  assert.ok(!html.includes('待选择新 SKU'))
  state.bomItems.pop(); state.patternItems[1].pieceRows.pop()
  for (const formal of listTechnicalDataVersions().filter(item => item.versionStatus === 'PUBLISHED')) {
    ensureTechPackPageState(formal.styleCode, { styleId: formal.styleId, technicalVersionId: formal.technicalVersionId })
    assert.equal(state.processRouteStatus, 'CONFIRMED', formal.technicalVersionCode)
    assert.ok(getChecklist().filter(item => item.required).every(item => item.done), `formal detail ${formal.technicalVersionCode}`)
    assert.ok(state.patternItems.every(item => existsSync(`public${item.image}`)), 'paper sample preview must be a real static image')
  }
})

test('TP-PERSON-001: valid maintenance retains published content, records a log, and rejects wrong-role candidates', () => {
  const result = spawnSync(process.execPath, ['--import','tsx','--input-type=module','-e', `
    import assert from 'node:assert/strict';
    const values=new Map();const {pcsRecordStore}=await import('./src/data/pcs-record-runtime.ts');
    Object.assign(pcsRecordStore,{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)});
    const repo=await import('./src/data/pcs-technical-data-version-repository.ts');
    const logs=await import('./src/data/pcs-tech-pack-version-log-repository.ts');
    const record=repo.listTechnicalDataVersions().find(x=>x.technicalVersionCode==='1');const before=repo.getTechnicalDataVersionContent(record.technicalVersionId);
    assert.throws(()=>repo.assignTechnicalPackResponsible(record.technicalVersionId,'跟单','BUYER-001'),/有效的跟单/);assert.equal(values.size,0);
    const saved=repo.assignTechnicalPackResponsible(record.technicalVersionId,'跟单','U001','维护测试');
    assert.equal(saved.merchandiserName,'Budi Santoso');assert.equal(saved.versionStatus,'PUBLISHED');assert.deepEqual(repo.getTechnicalDataVersionContent(record.technicalVersionId),before);
    assert.equal(JSON.parse(values.get('higood-pcs-technical-data-version-store-v5')).records.find(x=>x.technicalVersionId===record.technicalVersionId).merchandiserName,'Budi Santoso');
    const entries=logs.listTechPackVersionLogsByVersionId(record.technicalVersionId);assert.equal(entries.length,1);assert.equal(entries[0].createdBy,'维护测试');assert.ok(entries[0].changeText.includes('跟单C → Budi Santoso'));
    const page=await import('./src/pages/pcs-technical-data-tech-pack-list.ts');page.technicalLogModal.versionId=record.technicalVersionId;const html=page.renderTechnicalLogModal();assert.ok(html.includes('维护测试'));assert.ok(html.includes('发布正式版本'));
  `], { encoding:'utf8' })
  assert.equal(result.status,0,result.stdout + result.stderr)
})
