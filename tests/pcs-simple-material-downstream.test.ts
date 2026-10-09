import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { pcsRecordStore } from '../src/data/pcs-record-runtime.ts'
import { getMaterialArchiveBaseline, getMaterialArchiveStoreSnapshot, getMaterialSkuRecordById, getMaterialProcessDefinition, resetMaterialArchiveCache, MATERIAL_ARCHIVE_STORAGE_KEY, listMaterialSkuRecordsByMaterialId } from '../src/data/pcs-material-archive-repository.ts'
import { assertEngineeringBomMaterialRules, getGarmentBomMaterialType } from '../src/data/pcs-engineering-bom-material-resolver.ts'
import { buildEngineeringBomMaterialLine } from '../src/data/pcs-engineering-bom-pricing.ts'
import { materialProcessHandoffPath, readPcsMaterialHandoff } from '../src/data/pcs-material-handoff.ts'
import { getPmsPcsPurchaseUnitOptions } from '../src/data/pms/material-purchase-orders.ts'
import * as plans from '../src/data/fcs/material-process-plans.ts'
import * as bom from '../src/data/pcs-engineering-bom-repository.ts'
import { listTechnicalDataVersions, getTechnicalDataVersionContent, updateTechnicalDataVersionContent, assertTechnicalMaterialSelectionDelta } from '../src/data/pcs-technical-data-version-repository.ts'
import type { EngineeringBomMaterialLineDraft } from '../src/data/pcs-engineering-bom-types.ts'
import type { TechnicalBomItem, TechnicalProcessEntry } from '../src/data/pcs-technical-data-version-types.ts'

const baseline = getMaterialArchiveBaseline()
beforeEach(() => {
  pcsRecordStore.setItem(MATERIAL_ARCHIVE_STORAGE_KEY, JSON.stringify(baseline)); resetMaterialArchiveCache()
  pcsRecordStore.setItem(plans.FCS_MATERIAL_PROCESS_PLAN_KEY, JSON.stringify(plans.getFcsMaterialProcessPlanBaseline())); plans.resetFcsMaterialProcessPlanCache()
  bom.resetEngineeringBomRepository()
})
function simpleSku(kind: 'consumable' | 'parts') {
  const root = getMaterialArchiveStoreSnapshot().records.find(item => item.kind === kind)!
  return listMaterialSkuRecordsByMaterialId(root.materialId)[0]
}
function line(skuId = simpleSku('consumable').materialSkuId): EngineeringBomMaterialLineDraft {
  const sku = getMaterialSkuRecordById(skuId)!
  return { materialSkuId: skuId, usage: 1, sampleQuantity: 1, usageUnit: sku.mainUnit || sku.pricingUnit, lossRate: 0,
    printRequirement: '否', dyeRequirement: '否', printSide: '无', linkedPatternResultIds: [] }
}
function technicalLine(skuId: string): TechnicalBomItem {
  return { id: `simple-${skuId}`, materialSkuId: skuId, type: getGarmentBomMaterialType(skuId) || '其他', name: '原型耗材', spec: '规格', unit: 'PCS', unitConsumption: 1, lossRate: 0, supplier: '-', printRequirement: '无', dyeRequirement: '无' }
}
test('SIMPLE-046/047: packaging uses stable category ID; equipment parts cannot be new garment BOM candidates', () => {
  const fixture = structuredClone(baseline), packaging = fixture.records.find(item => item.subcategoryId === 'material-category-consumable-20')!
  assert.ok(packaging)
  packaging.categoryName = '改名后的耗材分类'
  const ordinary = fixture.records.find(item => item.kind === 'consumable' && item.materialId !== packaging.materialId)!
  ordinary.categoryName = '包装袋'
  pcsRecordStore.setItem(MATERIAL_ARCHIVE_STORAGE_KEY, JSON.stringify(fixture)); resetMaterialArchiveCache()
  assert.equal(getGarmentBomMaterialType(listMaterialSkuRecordsByMaterialId(packaging.materialId)[0].materialSkuId), '包装材料')
  assert.equal(getGarmentBomMaterialType(listMaterialSkuRecordsByMaterialId(ordinary.materialId)[0].materialSkuId), '其他')
  const parts = simpleSku('parts')
  assert.equal(getGarmentBomMaterialType(parts.materialSkuId), null)
  assert.throws(() => assertEngineeringBomMaterialRules(line(parts.materialSkuId)), /设备配件不能新加入/)
  assert.doesNotThrow(() => assertEngineeringBomMaterialRules(line(parts.materialSkuId), parts.materialSkuId))
  assert.throws(() => assertEngineeringBomMaterialRules({ ...line(listMaterialSkuRecordsByMaterialId(ordinary.materialId)[0].materialSkuId), materialType: '包装材料' }), /应归属/)
})
test('SIMPLE-048: material line save rejects forged dye/print/process flags before cost capture', () => {
  const base = line(), before = JSON.stringify(getMaterialArchiveStoreSnapshot())
  for (const patch of [{ dyeRequirement: '是' }, { printRequirementText: '渗透印' }, { processCode: 'EMBROIDERY' }, { printSide: '正面' }, { linkedPatternResultIds: ['pl001197'] }] as const) {
    assert.throws(() => buildEngineeringBomMaterialLine({ ...base, ...patch } as EngineeringBomMaterialLineDraft, '买手'), /不维护/)
  }
  assert.equal(JSON.stringify(getMaterialArchiveStoreSnapshot()), before)
})
test('SIMPLE-047/048: direct color/whole-plan saves and source copies reject new parts or simple process facts without writing', () => {
  const createOwner = (ownerId: string) => bom.createEngineeringBomVersionsForOwner({ ownerStage: 'INDEPENDENT_SAMPLING', ownerId, ownerCode: ownerId, styleId: '', ownerStyle: { styleId: '', styleCode: '', styleName: '原型验证衣服', styleImageUrl: '/assets/styles/verification.jpg' }, createdBy: '买手' })[0]
  const target = createOwner('simple-target'), before = JSON.stringify(bom.captureEngineeringBomRepositoryState())
  const partsLine = { ...line(simpleSku('parts').materialSkuId), bomItemId: 'new-parts' }
  for (const candidate of [partsLine, { ...line(), printRequirement: '是' as const }]) {
    assert.throws(() => bom.saveEngineeringBomVersion({ versionId: target.bomDraftVersionId, role: '买手', userId: 'buyer', userName: '买手', materialLines: [candidate] }), /设备配件不能新加入|不维护/)
    assert.throws(() => bom.replaceEngineeringBomPricingPlanDraft({ ownerStage: target.ownerStage, ownerId: target.ownerId, role: '买手', userId: 'buyer', userName: '买手', colors: [{ productColor: target.productColor, materialLines: [candidate] }], customCostDecision: 'NO_CUSTOM_COST', customCosts: [] }), /设备配件不能新加入|不维护/)
    assert.equal(JSON.stringify(bom.captureEngineeringBomRepositoryState()), before)
  }
  const source = createOwner('simple-history-source'), history = bom.captureEngineeringBomRepositoryState()
  const sourceRecord = history.records.find(item => item.bomDraftVersionId === source.bomDraftVersionId)!
  sourceRecord.versionStatus = 'PUBLISHED_SNAPSHOT'; sourceRecord.materialLines = [partsLine]
  history.plans.find(item => item.ownerId === source.ownerId)!.status = 'PUBLISHED_SNAPSHOT'
  bom.restoreEngineeringBomRepositoryState(history)
  const historyBefore = JSON.stringify(bom.captureEngineeringBomRepositoryState())
  assert.throws(() => bom.regenerateEngineeringBomVersionFromSource({ targetVersionId: target.bomDraftVersionId, sourceVersionId: source.bomDraftVersionId, role: '买手', userId: 'buyer', userName: '买手' }), /设备配件不能新加入/)
  assert.throws(() => bom.copyEngineeringBomPricingPlan({ sourceOwnerStage: source.ownerStage, sourceOwnerId: source.ownerId, targetOwnerStage: target.ownerStage, targetOwnerId: target.ownerId, copiedBy: '买手' }), /设备配件不能新加入/)
  assert.equal(JSON.stringify(bom.captureEngineeringBomRepositoryState()), historyBefore)
})
test('SIMPLE-048: generic technical content repository blocks new parts and new simple process demands; unchanged history is retained', () => {
  const record = listTechnicalDataVersions().find(item => item.versionStatus === 'DRAFT')!
  const base = getTechnicalDataVersionContent(record.technicalVersionId)!
  const initial = JSON.stringify(base), consumable = technicalLine(simpleSku('consumable').materialSkuId), parts = technicalLine(simpleSku('parts').materialSkuId)
  for (const item of [parts, { ...consumable, printRequirement: '需要印花' }, { ...consumable, embroideryRequirement: '有' }, { ...consumable, linkedPatternIds: ['pl001197'] }]) {
    assert.throws(() => updateTechnicalDataVersionContent(record.technicalVersionId, { bomItems: [...base.bomItems, item] }), /设备配件不能新加入|不维护/)
    assert.equal(JSON.stringify(getTechnicalDataVersionContent(record.technicalVersionId)), initial)
  }
  const old = { ...base, bomItems: [...base.bomItems, { ...parts, dyeRequirement: '历史染色要求' }] }
  assert.doesNotThrow(() => assertTechnicalMaterialSelectionDelta(old, { ...old, bomItems: old.bomItems.map(item => ({ ...item, unitConsumption: item.unitConsumption + 1 })) }))
  assert.throws(() => assertTechnicalMaterialSelectionDelta(old, { ...old, bomItems: old.bomItems.map(item => item.id === parts.id ? { ...item, dyeRequirement: '新染色要求' } : item) }), /不维护/)
})
test('SIMPLE-048: generic process route injection cannot bypass BOM controls', () => {
  const record = listTechnicalDataVersions().find(item => item.versionStatus === 'DRAFT')!, base = getTechnicalDataVersionContent(record.technicalVersionId)!
  const skuId = simpleSku('consumable').materialSkuId
  const process = { id: 'forged-simple-route', entryType: 'PROCESS_BASELINE', stageCode: 'PREP', stageName: '准备', processCode: 'PRINT', processName: '印花', assignmentGranularity: 'SKU', defaultDocType: 'TASK', taskTypeMode: 'PROCESS', isSpecialCraft: false, inputMaterialSkuId: skuId, outputMaterialSkuId: skuId } as TechnicalProcessEntry
  const before = JSON.stringify(base)
  assert.throws(() => updateTechnicalDataVersionContent(record.technicalVersionId, { processEntries: [...base.processEntries, process] }), /不能新增或修改加工/)
  assert.equal(JSON.stringify(getTechnicalDataVersionContent(record.technicalVersionId)), before)
  assert.throws(() => assertTechnicalMaterialSelectionDelta(base, { ...base, bomItems: [...base.bomItems, { ...technicalLine(simpleSku('parts').materialSkuId), type: '成衣' }] }), /设备配件不能新加入/)
  assert.doesNotThrow(() => assertTechnicalMaterialSelectionDelta(base, { ...base, bomItems: [...base.bomItems, { ...technicalLine('internal-garment-sku'), type: '成衣', printRequirement: '原有成衣工艺' }] }))
  const fabricId = baseline.skuRecords.find(item => baseline.records.some(root => root.materialId === item.materialId && root.kind === 'fabric'))!.materialSkuId
  const oldBom = { ...technicalLine(fabricId), type: '面料' }, linked = { ...process, inputMaterialSkuId: fabricId, outputMaterialSkuId: fabricId, linkedBomItemIds: [oldBom.id] }
  const old = { ...base, bomItems: [...base.bomItems, oldBom], processEntries: [...base.processEntries, linked] }
  assert.doesNotThrow(() => assertTechnicalMaterialSelectionDelta(old, structuredClone(old)))
  assert.throws(() => assertTechnicalMaterialSelectionDelta(old, { ...old, bomItems: old.bomItems.map(item => item.id === oldBom.id ? { ...technicalLine(skuId), id: oldBom.id } : item) }), /不能新增或修改加工/)
})
test('SIMPLE-049/050: FCS and handoff reject legacy process definitions under both simple kinds without writing plans', () => {
  for (const kind of ['consumable', 'parts'] as const) {
    const fixture = structuredClone(baseline), output = fixture.skuRecords.find(item => item.materialSkuId === 'material-r1-process-dye')!
    const root = fixture.records.find(item => item.materialId === output.materialId)!
    Object.assign(root, { kind, subcategoryId: fixture.records.find(item => item.kind === kind)!.subcategoryId, approvalStatus: 'APPROVED', status: 'ACTIVE' })
    for (const sku of fixture.skuRecords.filter(item => item.materialId === root.materialId)) Object.assign(sku, { status: 'ACTIVE', approvalStatus: 'APPROVED' })
    pcsRecordStore.setItem(MATERIAL_ARCHIVE_STORAGE_KEY, JSON.stringify(fixture)); resetMaterialArchiveCache()
    const definition = getMaterialProcessDefinition(output.materialSkuId)!
    const draft = { inputSkuId: definition.inputSkuId, outputSkuId: output.materialSkuId, processDefinitionId: definition.processDefinitionId, processVersionId: definition.processVersionId, plannedInputQty: 1, plannedOutputQty: 1, factoryId: '', plannedStartDate: '', plannedFinishDate: '', responsibleName: '', remark: '' }
    assert.ok(!plans.listFcsMaterialPlanTargets().some(item => item.materialSkuId === output.materialSkuId))
    assert.throws(() => materialProcessHandoffPath(output.materialSkuId), /不能发起/)
    assert.throws(() => readPcsMaterialHandoff(`?${new URLSearchParams({ pcsIntent: 'process', inputSkuId: draft.inputSkuId, outputSkuId: draft.outputSkuId, processDefinitionId: draft.processDefinitionId, processVersionId: draft.processVersionId })}`), /不能发起/)
    assert.throws(() => plans.createFcsMaterialProcessPlan(draft, 'DRAFT', kind), /不能新建加工/)
    assert.equal(plans.listFcsMaterialProcessPlans().length, 0)
  }
})
test('SIMPLE-045: purchase source exposes specification and concrete adopted relation/package versions', () => {
  const snapshot = getMaterialArchiveStoreSnapshot(), sku = simpleSku('consumable')
  snapshot.packages ||= []; snapshot.unitRelations ||= []
  snapshot.packages.push({ packageSpecId: 'simple-pack-10', ownerSkuId: sku.materialSkuId, packageTypeId: 'package-box', contentQty: 10, contentUnitId: sku.mainUnit!, grossWeightKg: null, lengthCm: null, widthCm: null, heightCm: null, volumeM3: null, volumeSource: 'UNKNOWN', measurementBasis: '确认每盒十个', version: 3, status: 'ACTIVE' })
  snapshot.unitRelations.push({ relationId: 'simple-relation-10', materialSkuId: sku.materialSkuId, auxUnitId: '盒', mainQtyPerAux: 10, basisType: 'PACKAGE', basisReference: '确认每盒十个', packageSpecId: 'simple-pack-10', uses: ['PURCHASE'], isDefaultForUse: [], version: 3, status: 'ACTIVE', changeReason: '原型确认', createdAt: '2026-10-09' })
  pcsRecordStore.setItem(MATERIAL_ARCHIVE_STORAGE_KEY, JSON.stringify(snapshot)); resetMaterialArchiveCache()
  const source = getPmsPcsPurchaseUnitOptions(sku.materialSkuId).find(item => item.relationId === 'simple-relation-10')!
  assert.equal(source.specName, getMaterialSkuRecordById(sku.materialSkuId)!.specName)
  assert.deepEqual(source.packageSnapshot, { packageSpecId: 'simple-pack-10', version: 3, contentQty: 10, contentUnitId: sku.mainUnit!, measurementBasis: '确认每盒十个' })
  assert.equal(source.mainQtyPerPurchaseUnit, 10)
  snapshot.packages.find(item => item.packageSpecId === 'simple-pack-10')!.contentQty = 20
  assert.equal(source.packageSnapshot!.contentQty, 10)
})
