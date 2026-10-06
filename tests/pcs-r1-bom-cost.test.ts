import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { pcsRecordStore } from '../src/data/pcs-record-runtime.ts'
import * as material from '../src/data/pcs-material-archive-repository.ts'
import { captureEngineeringBomMaterialReference, resolveEngineeringBomMaterialLine } from '../src/data/pcs-engineering-bom-material-resolver.ts'
import { buildEngineeringBomMaterialLine, calculateEngineeringBomCost, getTechnicalDataVersionBomWorkspace, freezeTechnicalDataVersionBomPricingSnapshot, saveTechnicalDataVersionBomMaterialLine } from '../src/data/pcs-engineering-bom-pricing.ts'
import * as bom from '../src/data/pcs-engineering-bom-repository.ts'
import * as tech from '../src/data/pcs-technical-data-version-repository.ts'
import { saveTechnicalDataVersionContent } from '../src/data/pcs-project-technical-data-writeback.ts'
import { updateLatestPcsExchangeRate } from '../src/data/pcs-exchange-rate-config.ts'
import { listSkuArchivesByStyleId, updateSkuArchive, getSkuArchiveById } from '../src/data/pcs-sku-archive-repository.ts'
import { projectLegacySkuMaterialIntent } from '../src/data/pcs-engineering-bom-legacy-intent.ts'
import type { TechnicalBomItem, TechnicalDataVersionContent } from '../src/data/pcs-technical-data-version-types.ts'
import type { EngineeringBomMaterialLineDraft } from '../src/data/pcs-engineering-bom-types.ts'
import { buildWoolOrderSourceSnapshot, type WoolOrderSourceBuildInput } from '../src/data/fcs/wool-domain/tech-pack-source.ts'

const BASE = 'material-r1-MAT-FB-00000001-B01', PRINT = 'material-r1-process-print'
const baseline = material.getMaterialArchiveBaseline()
const line = (id = PRINT): EngineeringBomMaterialLineDraft => ({ materialSkuId: id, usage: 1, sampleQuantity: 1, usageUnit: 'Yard', lossRate: 0 })
beforeEach(() => {
  tech.resetTechnicalDataVersionRepository()
  const fixture = structuredClone(baseline)
  // Cost scenarios use an approved target; material-approval completeness has separate coverage.
  fixture.skuRecords.filter(sku => [BASE, PRINT].includes(sku.materialSkuId)).forEach(sku => { sku.status = 'ACTIVE'; sku.approvalStatus = 'APPROVED' })
  pcsRecordStore.setItem(material.MATERIAL_ARCHIVE_STORAGE_KEY, JSON.stringify(fixture)); material.resetMaterialArchiveCache()
})
function draft(items?: TechnicalBomItem[]) {
  const template = tech.listTechnicalDataVersions().find(row => row.versionStatus === 'DRAFT')!
  const source = tech.getTechnicalDataVersionContent(template.technicalVersionId)!
  const id = template.technicalVersionId
  const content: TechnicalDataVersionContent = { ...structuredClone(source), technicalVersionId: id,
    legacySkuIntentSourceIds: [],
    patternFiles: source.patternFiles.map(item => ({ ...item, fileUrl: '/production-confirmation-demo/grey-zip-hoodie.dxf', recordKind: 'ORIGINAL' as any })),
    bomItems: items || [{ id: `${id}-line`, materialSkuId: PRINT, type: '面料', name: '印花面料', spec: '标准', unit: 'Yard', unitConsumption: 1, lossRate: 0, supplier: '' }],
    bomCustomCosts: [], bomCustomCostDecision: 'NO_CUSTOM_COST', patternDesigns: [],
  } as TechnicalDataVersionContent
  delete content.bomPricingSnapshot
  tech.updateTechnicalDataVersionRecord(id, { linkedPartTemplateIds: [] })
  tech.updateTechnicalDataVersionContent(id, content)
  return { id, template, content }
}

test('COST draft uses recursive composite standard cost and notes upstream reference changes', () => {
  const saved = buildEngineeringBomMaterialLine(line(), '买手')
  assert.equal(saved.materialCostReference!.totalStandardCny, 8)
  const raw = pcsRecordStore.getItem(material.MATERIAL_ARCHIVE_STORAGE_KEY)
  assert.equal(resolveEngineeringBomMaterialLine(saved).standardUnitPriceCny, 8)
  assert.equal(pcsRecordStore.getItem(material.MATERIAL_ARCHIVE_STORAGE_KEY), raw)
  material.saveMaterialStandardCost(BASE, { purchaseStandardCny: 6, changeReason: '采购标准更新' })
  const current = resolveEngineeringBomMaterialLine(saved)
  assert.equal(current.standardUnitPriceCny, 9); assert.equal(current.standardCostChanged, true)
  assert.match(current.standardCostMessage!, /已更新/)
})

test('COST actual zero remains valid; missing standard is blocked; calculations avoid per-line early rounding', () => {
  material.saveMaterialStandardCost(BASE, { purchaseStandardCny: 0, transportStandardCny: 0, changeReason: '已确认零成本' })
  assert.equal(buildEngineeringBomMaterialLine(line(BASE), '买手').materialCostReference!.totalStandardCny, 0)
  assert.equal(resolveEngineeringBomMaterialLine(line(BASE)).priceStatus, '有效')
  const result = calculateEngineeringBomCost({ exchangeRateIdrPerCny: 2200, customCosts: [], materialLines: [1, 2].map(() => ({ materialSkuId: BASE, usage: 1, usageUnit: 'Yard', pricingUnit: 'Yard', conversionToPricingUnit: 1, lossRate: 0, standardUnitPriceCny: .0049 })) })
  assert.equal(result.materialCostCny, .01)
  material.saveMaterialStandardCost(BASE, { purchaseStandardCny: null, changeReason: '待维护采购标准' })
  assert.equal(resolveEngineeringBomMaterialLine(line(BASE)).standardUnitPriceCny, null)
  assert.throws(() => buildEngineeringBomMaterialLine(line(BASE), '买手'), /不完整|缺|采购/)
  assert.throws(() => calculateEngineeringBomCost({ exchangeRateIdrPerCny: 2200, customCosts: [], materialLines: [{ materialSkuId: BASE, usage: 1, usageUnit: 'Yard', pricingUnit: 'Yard', conversionToPricingUnit: 1, lossRate: 0, standardUnitPriceCny: null }] }), /未维护完整/)
})

test('GOV-006 BOM new selection and save reject an unavailable SKU or parent without changing saved lines', () => {
  const template = tech.listTechnicalDataVersions()[0]
  const versions = bom.createEngineeringBomVersionsForOwner({ ownerStage: 'TECH_PACK_DRAFT', ownerId: 'new-bom-availability', ownerCode: 'NEW-BOM', styleId: template.styleId, createdBy: '买手' })
  const available = material.getMaterialArchiveStoreSnapshot()
  const persisted = pcsRecordStore.getItem('higood-pcs-engineering-bom-pricing-plan-store-v2')
  for (const owner of ['sku', 'parent']) for (const state of ['INACTIVE', 'NOT_ENABLED', 'ARCHIVED', 'DRAFT', 'PENDING']) {
    const fixture = structuredClone(available)
    const sku = fixture.skuRecords.find(item => item.materialSkuId === BASE)!
    const record = owner === 'sku' ? sku : fixture.records.find(item => item.materialId === sku.materialId)!
    if (state === 'DRAFT' || state === 'PENDING') record.approvalStatus = state
    else record.status = state as typeof record.status
    pcsRecordStore.setItem(material.MATERIAL_ARCHIVE_STORAGE_KEY, JSON.stringify(fixture)); material.resetMaterialArchiveCache()
    assert.throws(() => buildEngineeringBomMaterialLine(line(BASE), '买手'), /审核|启用|停用/, `${owner}/${state} new selection`)
    assert.throws(() => bom.saveEngineeringBomVersion({ versionId: versions[0].bomDraftVersionId, role: '买手', userId: 'buyer', userName: '买手', materialLines: [line(BASE)] }), /审核|启用|停用/, `${owner}/${state} save guard`)
    assert.equal(pcsRecordStore.getItem('higood-pcs-engineering-bom-pricing-plan-store-v2'), persisted)
  }
})

test('GOV-006 stopping a material preserves an existing BOM line but blocks adding or replacing a line', () => {
  const template = tech.listTechnicalDataVersions()[0]
  const version = bom.createEngineeringBomVersionsForOwner({ ownerStage: 'TECH_PACK_DRAFT', ownerId: 'existing-bom-availability', ownerCode: 'EXISTING-BOM', styleId: template.styleId, createdBy: '买手' })[0]
  const input = { versionId: version.bomDraftVersionId, role: '买手' as const, userId: 'buyer', userName: '买手' }
  const saved = bom.saveEngineeringBomVersion({ ...input, materialLines: [line(BASE)] })
  material.setMaterialUseStatus(material.getMaterialSkuRecordById(BASE)!.materialId, 'INACTIVE', '停用主档')
  material.setMaterialUseStatus(BASE, 'INACTIVE', '停用规格')
  const updated = bom.saveEngineeringBomVersion({ ...input, materialLines: [{ ...saved.materialLines[0], usage: 2 }] })
  assert.equal(updated.materialLines[0].usage, 2)
  assert.equal(updated.materialLines[0].bomItemId, saved.materialLines[0].bomItemId)
  assert.equal(resolveEngineeringBomMaterialLine(updated.materialLines[0]).materialCostCny, 12)
  const persisted = pcsRecordStore.getItem('higood-pcs-engineering-bom-pricing-plan-store-v2')
  assert.throws(() => bom.saveEngineeringBomVersion({ ...input, materialLines: [...updated.materialLines, { ...line(BASE), bomItemId: 'new-copy-line' }] }), /审核|启用|停用/)
  assert.throws(() => bom.saveEngineeringBomVersion({ ...input, materialLines: [{ ...updated.materialLines[0], materialSkuId: PRINT }] }), /审核|启用|停用/)
  assert.equal(pcsRecordStore.getItem('higood-pcs-engineering-bom-pricing-plan-store-v2'), persisted)
})

test('GOV-006 technical BOM edits retain an existing stopped material while new material selection stays guarded', () => {
  const { id } = draft([{ id: 'existing-tech-bom', materialSkuId: BASE, type: '面料', name: '基础面料', spec: '标准', unit: 'Yard', unitConsumption: 1, lossRate: 0, supplier: '' } as TechnicalBomItem])
  material.setMaterialUseStatus(material.getMaterialSkuRecordById(BASE)!.materialId, 'INACTIVE', '停用主档')
  material.setMaterialUseStatus(BASE, 'INACTIVE', '停用规格')
  const saved = saveTechnicalDataVersionBomMaterialLine(id, 'existing-tech-bom', { usage: 3 }, '买手')
  assert.equal(saved.materialLines[0].materialSkuId, BASE)
  assert.equal(saved.materialLines[0].materialCostCny, 18)
  const persisted = pcsRecordStore.getItem('higood-pcs-technical-data-version-store-v5')
  assert.throws(() => saveTechnicalDataVersionBomMaterialLine(id, 'existing-tech-bom', { materialSkuId: PRINT }, '买手'), /审核|启用|停用/)
  assert.equal(pcsRecordStore.getItem('higood-pcs-technical-data-version-store-v5'), persisted)
})

test('COST confirmed plan keeps its cost and unit versions, while copied drafts use new standards', () => {
  const template = tech.listTechnicalDataVersions()[0]
  const input = { ownerStage: 'TECH_PACK_DRAFT' as const, ownerId: 'cost-plan-r1', ownerCode: 'COST-R1', styleId: template.styleId, createdBy: '买手' }
  const versions = bom.createEngineeringBomVersionsForOwner(input)
  versions.forEach(version => bom.saveEngineeringBomVersion({ versionId: version.bomDraftVersionId, role: '买手', userId: 'buyer', userName: '买手', materialLines: [line()] }))
  bom.saveEngineeringBomPricingPlan({ ...input, role: '买手', userId: 'buyer', userName: '买手', customCostDecision: 'NO_CUSTOM_COST', customCosts: [] })
  bom.confirmEngineeringBomPricingPlan({ ...input, role: '买手', userId: 'buyer', userName: '买手' })
  const frozen = bom.resolveEngineeringBomPricingPlan(input.ownerStage, input.ownerId).resolved
  material.saveMaterialStandardCost(BASE, { purchaseStandardCny: 9, changeReason: '确认后更新' })
  updateLatestPcsExchangeRate({ idrPerCny: 3000, usdPerCny: .17, updatedBy: '展示汇率维护' })
  assert.deepEqual(bom.resolveEngineeringBomPricingPlan(input.ownerStage, input.ownerId).resolved, frozen)
  bom.createEngineeringBomVersionsForOwner({ ...input, ownerId: 'cost-plan-copy-r1' })
  bom.copyEngineeringBomPricingPlan({ sourceOwnerStage: input.ownerStage, sourceOwnerId: input.ownerId, targetOwnerStage: input.ownerStage, targetOwnerId: 'cost-plan-copy-r1', copiedBy: '买手' })
  const copied = bom.resolveEngineeringBomPricingPlan(input.ownerStage, 'cost-plan-copy-r1')
  assert.equal(copied.resolved.materialLines[0].standardUnitPriceCny, 12)
  assert.equal(copied.resolved.materialLines[0].standardCostChanged, true)
})

test('COST technical draft page reads current standard; publish freezes once and activation reuses it after price/FX changes', () => {
  const { id } = draft()
  assert.equal(getTechnicalDataVersionBomWorkspace(id).materialLines[0].standardUnitPriceCny, 8)
  material.saveMaterialStandardCost(BASE, { purchaseStandardCny: 6, changeReason: '发布前更新' })
  assert.equal(getTechnicalDataVersionBomWorkspace(id).materialLines[0].standardUnitPriceCny, 9)
  tech.publishTechnicalDataVersionRecord(id, '2026-10-05 12:00', '发布人')
  const publishedContent = tech.getTechnicalDataVersionContent(id)!, publishedRecord = tech.getTechnicalDataVersionById(id)!
  assert.equal(publishedContent.bomPricingSnapshot!.frozenAt, '2026-10-05 12:00')
  const published = getTechnicalDataVersionBomWorkspace(id)
  material.saveMaterialStandardCost(BASE, { purchaseStandardCny: 20, changeReason: '发布后更新' })
  updateLatestPcsExchangeRate({ idrPerCny: 3100, usdPerCny: .18, updatedBy: '展示汇率维护' })
  assert.deepEqual(getTechnicalDataVersionBomWorkspace(id), published)
  assert.deepEqual(freezeTechnicalDataVersionBomPricingSnapshot(id, '2026-10-06 13:00', '启用人'), publishedContent.bomPricingSnapshot)
  assert.deepEqual(tech.getTechnicalDataVersionById(id), publishedRecord)
  assert.deepEqual(tech.getTechnicalDataVersionContent(id), publishedContent)
  const persistedSnapshot = JSON.parse(pcsRecordStore.getItem('higood-pcs-technical-data-version-store-v5')!).contents.find((item: TechnicalDataVersionContent) => item.technicalVersionId === id).bomPricingSnapshot
  assert.deepEqual(persistedSnapshot, publishedContent.bomPricingSnapshot)
  assert.equal(persistedSnapshot.materialLines[0].standardUnitPriceCny, 9)
  assert.ok(persistedSnapshot.materialLines[0].materialCostReference.adoptedVersionIds.length > 1)
})

test('UOM frozen usage conversion retains the selected unit relation version', () => {
  const relation = material.saveMaterialUnitRelation(BASE, { auxUnitId: 'KG', mainQtyPerAux: 5, basisType: 'SPECIFICATION', basisReference: '门幅克重测定', uses: ['PRICING'], isDefaultForUse: ['PRICING'], status: 'ACTIVE', changeReason: '初始关系' })
  const frozen = captureEngineeringBomMaterialReference({ ...line(BASE), usageUnit: 'KG' }, 'FROZEN')
  assert.ok(frozen.unitConversionReference!.relationIds.includes(relation.relationId))
  material.saveMaterialUnitRelation(BASE, { ...relation, relationId: relation.relationId, mainQtyPerAux: 4, changeReason: '单位标准更新' })
  assert.equal(resolveEngineeringBomMaterialLine(frozen).materialCostCny, 30)
  assert.equal(resolveEngineeringBomMaterialLine({ ...frozen, costReferenceMode: 'CURRENT' }).materialCostCny, 24)
})

test('BRIDGE multiple yarn intentions remain separate technical inputs, project once and preserve source SKU', () => {
  const { id, template } = draft([])
  const sku = listSkuArchivesByStyleId(template.styleId)[0]
  const yarns = ['material-r1-MAT-YN-00000001-B01', 'material-r1-MAT-YN-00000001-B02'].map(id => material.getMaterialSkuRecordById(id)!)
  updateSkuArchive(sku.skuId, { expectedMaterials: yarns.map((yarn, index) => ({ materialSkuId: yarn.materialSkuId, materialSkuCode: yarn.materialSkuCode, materialName: yarn.materialName, quantity: index ? .2 : .3, unit: 'KG', note: '毛衣多色纱线用料意向' })) })
  const oldSku = getSkuArchiveById(sku.skuId)
  const before = pcsRecordStore.getItem('higood-pcs-technical-data-version-store-v5')
  const projected = tech.getTechnicalDataVersionContent(id)!
  assert.equal(projected.bomItems.length, 2)
  assert.deepEqual(projected.bomItems.map(item => [item.materialSkuId, item.unitConsumption, item.unit]), [[yarns[0].materialSkuId, .3, 'KG'], [yarns[1].materialSkuId, .2, 'KG']])
  assert.match(projected.bomItems[0].remark!, /历史用料意向/)
  assert.equal(pcsRecordStore.getItem('higood-pcs-technical-data-version-store-v5'), before)
  saveTechnicalDataVersionContent(id, { bomItems: projected.bomItems }, '技术人员')
  assert.deepEqual(getSkuArchiveById(sku.skuId), oldSku)
  assert.equal(tech.getTechnicalDataVersionContent(id)!.bomItems.length, 2)
  saveTechnicalDataVersionContent(id, { bomItems: [] }, '删除不采用的意向')
  assert.equal(tech.getTechnicalDataVersionContent(id)!.bomItems.length, 0)
  const unknown = projectLegacySkuMaterialIntent([], [{ ...sku, expectedMaterials: [{ materialSkuId: 'missing', materialSkuCode: 'unknown', materialName: '不推断', quantity: 1, unit: 'KG' }] }])
  assert.equal(unknown.bomItems.length, 0); assert.equal(unknown.unresolvedSourceIds.length, 1)
})


test('COST failed publishing cannot leave a published record or half-frozen cost references', () => {
  const { id } = draft()
  material.saveMaterialStandardCost(BASE, { purchaseStandardCny: null, changeReason: '标准未维护' })
  const record = tech.getTechnicalDataVersionById(id), content = tech.getTechnicalDataVersionContent(id)
  const persisted = pcsRecordStore.getItem('higood-pcs-technical-data-version-store-v5')
  assert.throws(() => tech.publishTechnicalDataVersionRecord(id, '2026-10-05 15:00', '发布人'), /未维护完整/)
  assert.deepEqual(tech.getTechnicalDataVersionById(id), record)
  assert.deepEqual(tech.getTechnicalDataVersionContent(id), content)
  assert.equal(pcsRecordStore.getItem('higood-pcs-technical-data-version-store-v5'), persisted)
})

test('BRIDGE-002/003 multi-color yarn keeps both technical inputs and separates panel from garment output', () => {
  const yarns = ['material-r1-MAT-YN-00000001-B01', 'material-r1-MAT-YN-00000001-B02'].map(id => material.getMaterialSkuRecordById(id)!)
  const source: WoolOrderSourceBuildInput = {
    taskId: 'r1-wool-task', productionOrderId: 'r1-wool-order', productionOrderNo: 'R1-WOOL-001',
    kind: 'PART_PANEL', sourceTechPackVersionId: 'r1-frozen-tech', sourceTechPackVersionCode: 'R1-V1',
    skuLines: [{ skuCode: 'R1-KNIT-BLACK-M', colorCode: 'BLACK', colorName: '黑色', sizeCode: 'M', plannedQty: 100 }],
    bomItems: yarns.map((yarn, i) => ({ id: `yarn-${i}`, materialCode: yarn.materialSkuCode, usageProcessCodes: ['PROC_WOOL'], applicableSkuCodes: ['R1-KNIT-BLACK-M'] })),
    colorMaterialMappings: [{ id: 'r1-colors', mappingOrigin: 'TECH_PACK', status: 'CONFIRMED', colorCode: 'BLACK', lines: yarns.map((yarn, i) => ({ id: `color-${i}`, bomItemId: `yarn-${i}`, materialCode: yarn.materialSkuCode })) }],
    woolParts: [{ woolPartCode: 'SLEEVE', woolPartName: '袖片', pieceCountPerGarment: 2 }],
  }
  const before = pcsRecordStore.getItem(material.MATERIAL_ARCHIVE_STORAGE_KEY)
  const panel = buildWoolOrderSourceSnapshot(source)
  const garment = buildWoolOrderSourceSnapshot({ ...source, kind: 'WHOLE_GARMENT' })
  assert.deepEqual(panel.outputPlanLines[0].requiredYarnSkus, yarns.map(yarn => yarn.materialSkuCode))
  assert.deepEqual(panel.outputPlanLines[0].sourceBomItemIds, ['yarn-0', 'yarn-1'])
  assert.equal(panel.outputPlanLines[0].outputObjectType, 'WOOL_PANEL')
  assert.equal(garment.outputPlanLines[0].outputObjectType, 'GARMENT')
  assert.equal(panel.outputPlanLines[0].sourceTechPackVersionId, 'r1-frozen-tech')
  assert.equal(panel.outputPlanLines[0].qtyUnit, '件') // 计划按成衣件数；实物流转的片数另属毛织部位。
  assert.equal(panel.outputPlanLines[0].plannedQty, 100)
  assert.deepEqual(panel.generationIssuesBySku, {})
  assert.equal(pcsRecordStore.getItem(material.MATERIAL_ARCHIVE_STORAGE_KEY), before)
  assert.deepEqual(yarns.map(yarn => yarn.mainUnit), ['KG', 'KG'])
})
