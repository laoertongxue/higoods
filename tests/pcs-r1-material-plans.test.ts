import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { pcsRecordStore, registerPcsFile } from '../src/data/pcs-record-runtime.ts'
import { decodePcsRecordSnapshot } from '../src/data/pcs-record-codec.ts'
import { getMaterialArchiveBaseline, getMaterialArchiveStoreSnapshot, getMaterialSkuRecordById, getMaterialProcessDefinition, resetMaterialArchiveCache, MATERIAL_ARCHIVE_STORAGE_KEY, reviseMaterialProcessAssets, addMaterialAsset } from '../src/data/pcs-material-archive-repository.ts'
import { materialProcessHandoffPath, materialPurchaseHandoffPath, readPcsMaterialHandoff } from '../src/data/pcs-material-handoff.ts'
import * as plans from '../src/data/fcs/material-process-plans.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'

const materialBaseline = getMaterialArchiveBaseline()
// Plan scenarios start after archive review and enabling; the published demos
// intentionally keep the processing stages as drafts for the review workflow.
for (const sku of materialBaseline.skuRecords.filter(item => item.materialSkuId.startsWith('material-r1-process-'))) {
  sku.approvalStatus = 'APPROVED'; sku.status = 'ACTIVE'
}
beforeEach(() => {
  pcsRecordStore.setItem(MATERIAL_ARCHIVE_STORAGE_KEY, JSON.stringify(materialBaseline)); resetMaterialArchiveCache()
  pcsRecordStore.setItem(plans.FCS_MATERIAL_PROCESS_PLAN_KEY, JSON.stringify(plans.getFcsMaterialProcessPlanBaseline())); plans.resetFcsMaterialProcessPlanCache()
})
function input(suffix = 'embroidery'): plans.FcsMaterialProcessPlanDraft {
  const outputSkuId = `material-r1-process-${suffix}`, definition = getMaterialProcessDefinition(outputSkuId)!
  return { inputSkuId: definition.inputSkuId, outputSkuId, processDefinitionId: definition.processDefinitionId, processVersionId: definition.processVersionId,
    plannedInputQty: 100, plannedOutputQty: 95, factoryId: plans.listFcsMaterialPlanFactoryOptions(definition.processType)[0].id,
    plannedStartDate: '2026-10-06', plannedFinishDate: '2026-10-08', responsibleName: '计划专员', remark: '原型计划验证' }
}
test('MAT/FCS: factory options use the actual name and code, not the short-name code fallback', () => {
  const factories = new Map(listFactoryMasterRecords().map(factory => [factory.id, factory]))
  for (const type of ['DYEING', 'PRINTING', 'EMBROIDERY', 'HEAT_TRANSFER'] as const) {
    for (const option of plans.listFcsMaterialPlanFactoryOptions(type)) {
      assert.equal(option.name, factories.get(option.id)?.name)
      assert.equal(option.code, factories.get(option.id)?.code)
    }
  }
  const dyeOption = plans.listFcsMaterialPlanFactoryOptions('DYEING')[0]
  assert.notEqual(dyeOption.name, dyeOption.code)
  assert.equal(plans.createFcsMaterialProcessPlan(input('dye'), 'DRAFT', 'factory-name').factoryName, dyeOption.name)
})
test('MAT/FCS: four processes create actual plans without a production demand or warehouse facts', () => {
  const before = getMaterialArchiveStoreSnapshot()
  for (const suffix of ['dye', 'print', 'embroidery', 'heat']) {
    const draft = input(suffix), plan = plans.createFcsMaterialProcessPlan(draft, 'PLANNED', `test-${suffix}`)
    assert.equal(plan.status, 'PLANNED'); assert.equal(plan.source.sourceType, 'MATERIAL_SKU')
    assert.equal(plan.source.input.materialSkuId, draft.inputSkuId); assert.equal(plan.source.output.materialSkuId, draft.outputSkuId)
    assert.equal(plan.source.process.processDefinitionId, draft.processDefinitionId); assert.equal(plan.source.process.processVersionId, draft.processVersionId)
    assert.equal(plan.plannedInputQty, 100); assert.equal(plan.plannedOutputQty, 95)
    assert.ok(!('productionDemandId' in plan)); assert.ok(!('productionOrderId' in plan)); assert.ok(!('receivedQty' in plan)); assert.ok(!('inventory' in plan))
    assert.equal(plans.getFcsMaterialProcessPlanReceipt(plan).detailPath, `/fcs/process/material-plans/${plan.planId}`)
    assert.equal(plans.listFcsMaterialProcessPlans({ skuId: draft.outputSkuId }).filter(item => item.planId === plan.planId).length, 1)
    assert.equal(getMaterialSkuRecordById(draft.inputSkuId)?.mainUnitUsed, true)
  }
  assert.equal(plans.listFcsMaterialProcessPlans().length, 4)
  const after = getMaterialArchiveStoreSnapshot()
  assert.equal(after.skuRecords.length, before.skuRecords.length)
  assert.deepEqual(after.processDefinitions, before.processDefinitions)
  assert.deepEqual(after.costVersions, before.costVersions)
})
test('MAT/FCS: source identity and adopted process version are revalidated before every creation', () => {
  const initial = JSON.stringify(getMaterialArchiveStoreSnapshot()), draft = input()
  assert.throws(() => plans.createFcsMaterialProcessPlan({ ...draft, inputSkuId: 'material-r1-MAT-FB-00000001-B01' }, 'DRAFT', 'wrong-input'), /不一致/)
  assert.throws(() => plans.createFcsMaterialProcessPlan({ ...draft, processDefinitionId: 'wrong-definition' }, 'DRAFT', 'wrong-definition'), /不一致/)
  assert.throws(() => plans.createFcsMaterialProcessPlan({ ...draft, processVersionId: 'old' }, 'DRAFT', 'old-version'), /版本已变化/)
  assert.equal(plans.listFcsMaterialProcessPlans().length, 0)
  assert.equal(JSON.stringify(getMaterialArchiveStoreSnapshot()), initial)
})
test('GOV-006 new process selection, handoff and save reject unavailable input, target or parent archive', () => {
  const draft = input('embroidery')
  for (const owner of ['input', 'output', 'root'] as const) {
    for (const patch of [{ status: 'INACTIVE' }, { status: 'NOT_ENABLED' }, { status: 'ARCHIVED' }, { approvalStatus: 'DRAFT' }, { approvalStatus: 'PENDING' }] as const) {
      const fixture = structuredClone(materialBaseline)
      const sku = fixture.skuRecords.find(item => item.materialSkuId === (owner === 'input' ? draft.inputSkuId : draft.outputSkuId))!
      Object.assign(owner === 'root' ? fixture.records.find(item => item.materialId === sku.materialId)! : sku, patch)
      pcsRecordStore.setItem(MATERIAL_ARCHIVE_STORAGE_KEY, JSON.stringify(fixture)); resetMaterialArchiveCache()
      const initial = JSON.stringify(getMaterialArchiveStoreSnapshot())
      assert.ok(!plans.listFcsMaterialPlanTargets().some(item => item.materialSkuId === draft.outputSkuId), `${owner} ${JSON.stringify(patch)}`)
      assert.throws(() => materialProcessHandoffPath(draft.outputSkuId), /审核并启用/)
      assert.throws(() => plans.createFcsMaterialProcessPlan(draft, 'DRAFT', `${owner}-${JSON.stringify(patch)}`), /审核并启用/)
      if (owner !== 'input') assert.throws(() => materialPurchaseHandoffPath(draft.outputSkuId), /审核并启用/)
      assert.equal(plans.listFcsMaterialProcessPlans().length, 0)
      assert.equal(JSON.stringify(getMaterialArchiveStoreSnapshot()), initial)
    }
  }
})
test('GOV-006 stopping material later preserves the saved plan and its adopted process version', () => {
  const draft = input('embroidery'), plan = plans.createFcsMaterialProcessPlan(draft, 'DRAFT', 'before-stop')
  const fixture = getMaterialArchiveStoreSnapshot()
  fixture.records.find(item => item.materialId === plan.source.output.materialId)!.status = 'INACTIVE'
  fixture.skuRecords.find(item => item.materialSkuId === draft.outputSkuId)!.status = 'INACTIVE'
  pcsRecordStore.setItem(MATERIAL_ARCHIVE_STORAGE_KEY, JSON.stringify(fixture)); resetMaterialArchiveCache()
  assert.deepEqual(plans.getFcsMaterialProcessPlanById(plan.planId), plan)
  assert.throws(() => plans.createFcsMaterialProcessPlan(draft, 'DRAFT', 'after-stop'), /审核并启用/)
  const continued = plans.updateFcsMaterialProcessPlan(plan.planId, draft, 'PLANNED', plan.version)
  assert.equal(continued.status, 'PLANNED')
  assert.deepEqual(continued.source, plan.source)
})
test('MAT/FCS: draft accepts incomplete arrangements; confirmed plan requires positive quantities and eligible factory', () => {
  const draft = input('heat'), initial = JSON.stringify(getMaterialArchiveStoreSnapshot())
  for (const change of [{ plannedOutputQty: 0 }, { plannedInputQty: -1 }, { factoryId: 'FAC-APF' }, { plannedFinishDate: '2026-10-01' }, { plannedStartDate: '2026-02-30' }]) {
    assert.throws(() => plans.createFcsMaterialProcessPlan({ ...draft, ...change }, 'PLANNED', `invalid-${JSON.stringify(change)}`))
  }
  assert.equal(JSON.stringify(getMaterialArchiveStoreSnapshot()), initial)
  const incomplete = { ...draft, plannedInputQty: null, plannedOutputQty: null, factoryId: '', responsibleName: '', plannedStartDate: '', plannedFinishDate: '' }
  assert.throws(() => plans.createFcsMaterialProcessPlan(incomplete, 'PLANNED', 'incomplete-plan'), /补齐/)
  const result = plans.createFcsMaterialProcessPlan(incomplete, 'DRAFT', 'incomplete-draft')
  assert.equal(result.plannedInputQty, null); assert.equal(result.factoryName, ''); assert.equal(result.status, 'DRAFT')
})
test('MAT/FCS: duplicate saves do not duplicate plans; changed retries and stale drafts cannot overwrite', () => {
  const draft = input(), first = plans.createFcsMaterialProcessPlan(draft, 'DRAFT', 'same-operation')
  assert.equal(plans.createFcsMaterialProcessPlan(draft, 'DRAFT', 'same-operation').planId, first.planId)
  assert.throws(() => plans.createFcsMaterialProcessPlan({ ...draft, plannedOutputQty: 80 }, 'DRAFT', 'same-operation'), /另一份计划内容/)
  const updated = plans.updateFcsMaterialProcessPlan(first.planId, { ...draft, plannedOutputQty: 80 }, 'DRAFT', 1)
  assert.equal(updated.version, 2)
  assert.throws(() => plans.updateFcsMaterialProcessPlan(first.planId, draft, 'DRAFT', 1), /其他页面修改/)
  const confirmed = plans.updateFcsMaterialProcessPlan(first.planId, { ...draft, plannedOutputQty: 80 }, 'PLANNED', 2)
  assert.equal(confirmed.status, 'PLANNED'); assert.equal(plans.listFcsMaterialProcessPlans().length, 1)
  assert.throws(() => plans.updateFcsMaterialProcessPlan(first.planId, draft, 'DRAFT', 3), /已确认/)
})
test('MAT/FCS: saved source image/file and process versions stay frozen across subsequent material revisions', () => {
  const draft = input('embroidery'), sku = getMaterialSkuRecordById(draft.outputSkuId)!
  const file = registerPcsFile(new Blob(['embroidery machine file'], { type: 'application/octet-stream' }), 'fcs-plan-execution-file')
  const asset = addMaterialAsset({ materialId: sku.materialId, materialSkuId: sku.materialSkuId, role: 'EMBROIDERY_FILE', name: 'test.dst', url: file.url, fileId: file.fileId })
  reviseMaterialProcessAssets(sku.materialSkuId, [asset.assetId], 'embroidery-file-v2')
  const adopted = { ...draft, processVersionId: 'embroidery-file-v2' }
  const result = plans.createFcsMaterialProcessPlan(adopted, 'DRAFT', 'adopt-version')
  assert.equal(result.source.executionAssets[0].fileReference, `pcs-file:${file.fileId}`)
  reviseMaterialProcessAssets(sku.materialSkuId, [asset.assetId], 'embroidery-file-v3')
  plans.resetFcsMaterialProcessPlanCache()
  const saved = plans.getFcsMaterialProcessPlanById(result.planId)!
  assert.equal(saved.source.process.processVersionId, 'embroidery-file-v2')
  assert.equal(saved.source.executionAssets[0].assetId, asset.assetId)
  assert.equal(plans.updateFcsMaterialProcessPlan(saved.planId, adopted, 'PLANNED', saved.version).source.process.processVersionId, 'embroidery-file-v2')
  const hydrated = JSON.stringify(plans.getFcsMaterialProcessPlanStoreSnapshot()).replaceAll(`pcs-file:${file.fileId}`, file.url)
  pcsRecordStore.setItem(plans.FCS_MATERIAL_PROCESS_PLAN_KEY, hydrated); plans.resetFcsMaterialProcessPlanCache()
  assert.equal(plans.getFcsMaterialProcessPlanById(saved.planId)!.source.executionAssets[0].fileReference, `pcs-file:${file.fileId}`)
})
test('MAT/FCS: first read is empty and write-free; two plans for one target retain their own record identities', () => {
  const original = pcsRecordStore.setItem; let writes = 0
  pcsRecordStore.setItem = (...args) => { writes++; return original(...args) }
  try { plans.resetFcsMaterialProcessPlanCache(); assert.deepEqual(plans.listFcsMaterialProcessPlans(), []); plans.listFcsMaterialPlanTargets(); assert.equal(writes, 0) }
  finally { pcsRecordStore.setItem = original }
  const first = plans.createFcsMaterialProcessPlan(input(), 'DRAFT', 'first'), second = plans.createFcsMaterialProcessPlan(input(), 'DRAFT', 'second')
  const records = decodePcsRecordSnapshot(plans.FCS_MATERIAL_PROCESS_PLAN_KEY, JSON.stringify(plans.getFcsMaterialProcessPlanStoreSnapshot()))
  assert.ok(records.some(row => row.id.endsWith(`/plans/${first.planId}`))); assert.ok(records.some(row => row.id.endsWith(`/plans/${second.planId}`)))
  plans.resetFcsMaterialProcessPlanCache(); resetMaterialArchiveCache()
  assert.equal(plans.getFcsMaterialProcessPlanById(second.planId)?.planNo, second.planNo)
  assert.equal(getMaterialSkuRecordById(input().inputSkuId)?.mainUnitUsed, true)
})
test('MAT/FCS: handoff opens a versioned independent plan form for all four processes without creating a plan', () => {
  for (const suffix of ['dye', 'print', 'embroidery', 'heat']) {
    const draft = input(suffix), path = materialProcessHandoffPath(draft.outputSkuId)
    assert.ok(path.startsWith('/fcs/process/material-plans/new?'))
    const params = new URLSearchParams(path.split('?')[1]); assert.equal(params.get('processVersionId'), draft.processVersionId)
    assert.equal(readPcsMaterialHandoff(params.toString())?.input?.materialSkuId, draft.inputSkuId)
    params.set('processVersionId', 'older'); assert.throws(() => readPcsMaterialHandoff(params.toString()), /版本已变化/)
  }
  assert.equal(plans.listFcsMaterialProcessPlans().length, 0)
})
