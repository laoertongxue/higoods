import assert from 'node:assert/strict'
import test from 'node:test'
import { AccessoryTaskScopeError, buildAccessorySewingTaskScopes, type AccessorySewingTaskScopeFacts, type AccessorySewingTaskFact } from '../../src/data/wls/accessory-warehouse-task-scope.ts'
import { ACCESSORY_HILON_WAREHOUSE as HILON, type AccessoryPreparation, type AccessoryTransfer } from '../../src/data/wls/accessory-warehouse-flow.ts'
import type { EffectiveTaskAssignment } from '../../src/data/fcs/effective-task-assignments.ts'
import type { ProductionOrderTechPackSnapshot, TechPackBomItemSnapshot } from '../../src/data/fcs/production-tech-pack-snapshot-types.ts'
import type { SewingMaterialHandoverProjection } from '../../src/data/fcs/sewing-material-handover.ts'
import type { SewingPickupSlipVersion } from '../../src/data/fcs/sewing-pickup-slips.ts'

const codes = (code: string) => (error: unknown) => error instanceof AccessoryTaskScopeError && error.code === code
const PRICE_LINE = 'PREP-1:TECH-v2:BOM-PRICE'
const ZIP_LINE = 'PREP-1:TECH-v2:BOM-ZIP'
function snapshot(): ProductionOrderTechPackSnapshot {
  const bom = { type: '辅料' as const, spec: '', unit: '条', supplier: '已核对供应商', unitConsumption: 1, lossRate: 0 }
  return {
    snapshotId: 'SNAP-1', productionOrderId: 'PO-1', productionOrderNo: 'SC-001', styleId: 'ST-1', styleCode: 'ST-001', styleName: '样衣', status: 'RELEASED',
    versionLabel: 'v2', sourceTechPackVersionId: 'TECH-v2', sourceTechPackVersionCode: 'TECH-2', sourceTechPackVersionLabel: 'v2', sourcePublishedAt: '2026-10-01', snapshotAt: '2026-10-01', snapshotBy: '设计员', patternDesc: '',
    bomItems: [{ ...bom, id: 'BOM-PRICE', materialCode: 'ACC-PRICE', name: '价格吊牌', unit: '张', unitConsumption: 2, lossRate: 0.1, applicableSkuCodes: ['RED-M'] }, { ...bom, id: 'BOM-ZIP', materialCode: 'ACC-ZIP', name: '拉链' }],
    patternFiles: [], processEntries: [], sizeTable: [], sizeMeasurements: [], colorMaterialMappings: [], cutPieceParts: [], patternDesigns: [], linkedDesignRevisionTaskIds: [], linkedPatternTaskIds: [], linkedArtworkTaskIds: [], completenessScore: 100,
    imageSnapshot: { productImages: [], styleImages: [], sampleImages: [], materialImages: [], accessoryImages: [], patternImages: [], markerImages: [], artworkImages: [] },
  }
}
function preparation(): AccessoryPreparation {
  const line = { imageUrl: '/authorized.jpg', color: '', spec: '', preparedQty: 100, availableQty: 0, locationId: 'GTP-A01', requiresCutting: false }
  return {
    id: 'PREP-1', productionOrderId: 'PO-1', productionOrderNo: 'SC-001', styleName: '样衣', styleImageUrl: '/style.jpg', techPackVersion: 'TECH-v2', cuttingFactoryId: 'CUT-1', cuttingFactoryName: 'sea cutting', status: '已配齐', version: 2, remark: '', history: [],
    lines: [{ ...line, id: PRICE_LINE, materialSku: 'ACC-PRICE', materialName: '价格吊牌', unit: '张', requiredQty: 110, preparedQty: 110, purpose: '价格吊牌' }, { ...line, id: ZIP_LINE, materialSku: 'ACC-ZIP', materialName: '拉链', unit: '条', requiredQty: 100, purpose: '其他' }],
  }
}
function receivedTransfer(): AccessoryTransfer {
  const prep = preparation()
  return {
    id: 'TR-1', preparationId: prep.id, productionOrderId: prep.productionOrderId, kind: 'GTP_TO_SITE', fromWarehouse: 'WH-FITTING-001', toWarehouse: HILON, status: '已收货', version: 3, createdAt: '2026-10-10', createdBy: '仓管', history: [],
    lines: prep.lines.map(line => ({ id: line.id, sourceLineId: line.id, materialSku: line.materialSku, materialName: line.materialName, imageUrl: line.imageUrl, color: line.color, spec: line.spec, unit: line.unit, purpose: line.purpose, requiresCutting: false, qty: line.requiredQty, fromLocationId: 'GTP-A01', toLocationId: 'H-A01' })),
  }
}
function task(id: string, red: number, blue: number): AccessorySewingTaskFact {
  return { taskId: id, taskNo: id, productionOrderId: 'PO-1', processCode: 'SEW', processNameZh: '车缝', status: 'NOT_STARTED', assignmentStatus: 'ASSIGNED', scopeQty: red + blue,
    scopeSkuLines: [{ skuCode: 'RED-M', color: '红', size: 'M', qty: red }, { skuCode: 'BLUE-L', color: '蓝', size: 'L', qty: blue }] }
}
function assignment(source: AccessorySewingTaskFact, id: string): EffectiveTaskAssignment {
  return { assignmentId: id, runtimeTaskId: source.taskId, productionOrderId: source.productionOrderId, factoryId: `FACTORY-${id}`, factoryName: `车缝厂${id}`, source: 'DIRECT_DISPATCH',
    assignedQty: source.scopeQty, skuLines: structuredClone(source.scopeSkuLines), processCodes: ['SEW'], frozenPrice: 100, priceCurrency: 'IDR', priceUnit: '件', businessAssignedAt: '2026-10-10', operatedAt: '2026-10-10', operatedBy: 'PPIC-1', ppicId: `PPIC-${id}`, ppicName: `跟单${id}`, status: 'EFFECTIVE' }
}
function facts(): AccessorySewingTaskScopeFacts {
  const tasks = [task('TASK-A', 40, 10), task('TASK-B', 10, 40)]
  return { tasks, assignments: tasks.map((source, i) => assignment(source, i ? 'B' : 'A')), snapshot: snapshot(), orderSkuLines: [{ skuCode: 'RED-M', color: '红', size: 'M', qty: 50 }, { skuCode: 'BLUE-L', color: '蓝', size: 'L', qty: 50 }] }
}
function projection(source: EffectiveTaskAssignment): SewingMaterialHandoverProjection {
  const requirement = { requirementLineId: `REQ-${source.assignmentId}`, bomItemId: 'BOM-PRICE', materialType: '辅料' as const, materialCode: 'ACC-PRICE', materialName: '价格吊牌', materialSpec: '', unit: '张', unitConsumption: 2, lossRate: 0.1, assignedGarmentQty: source.assignedQty, requiredQty: 110, cumulativeHandedOverQty: 12, shortageQty: 98, overQty: 0 }
  return { context: { assignmentId: source.assignmentId, runtimeTaskId: source.runtimeTaskId, productionOrderId: 'PO-1', productionOrderNo: 'SC-001', taskNo: source.runtimeTaskId, factoryId: source.factoryId, factoryName: source.factoryName, ppicId: source.ppicId!, ppicName: source.ppicName!, snapshotId: 'SNAP-1', dataCompleteness: 'COMPLETE', requirementLines: [requirement] },
    lines: [requirement], handoverEvents: [], hasCutPieceRelease: false, hasCutPieceDebt: false, materialShortageLineCount: 1 }
}
function slip(source: EffectiveTaskAssignment): SewingPickupSlipVersion {
  return { slipId: 'SLIP-1', slipNo: 'LL-1', versionId: 'SLIP-1-v3', versionNo: 3, versionLabel: 'v3', status: 'CURRENT', assignmentId: source.assignmentId, runtimeTaskId: source.runtimeTaskId,
    taskNo: source.runtimeTaskId, productionOrderId: 'PO-1', productionOrderNo: 'SC-001', taskKindLabel: '独立车缝', factoryId: source.factoryId, factoryName: source.factoryName, ppicId: source.ppicId!, ppicName: source.ppicName!, warehouseName: 'HILON辅料仓', objectKind: 'ACCESSORY', styleCode: 'ST-1', styleName: '样衣', styleImageUrl: '/style.jpg', lines: [], printedAt: '2026-10-10', printedByPpicId: source.ppicId!, printedByPpicName: source.ppicName! }
}

test('每任务按有效SKU范围乘BOM单耗损耗，不能重复使用整生产单数量', () => {
  const input = facts(), before = structuredClone(input)
  const scopes = buildAccessorySewingTaskScopes(preparation(), receivedTransfer(), input)
  assert.deepEqual(input, before)
  assert.equal(scopes.length, 2)
  assert.deepEqual(scopes.map(scope => scope.quantitiesByLine[PRICE_LINE]), [88, 22])
  assert.deepEqual(scopes.map(scope => scope.postQuantitiesByLine[ZIP_LINE]), [50, 50])
  assert.deepEqual(scopes.map(scope => scope.sewingQuantitiesByLine[PRICE_LINE]), [88, 22])
  assert.equal(scopes[0].postQuantitiesByLine[PRICE_LINE], undefined)
  assert.equal(scopes[0].sewingQuantitiesByLine[ZIP_LINE], undefined)
  assert.equal(scopes[0].ppicId, 'PPIC-A')
  assert.equal(scopes[0].bomQuantities.find(row => row.bomItemId === 'BOM-PRICE')?.assignedGarmentQty, 40)
})

test('多库位片段按稳定任务顺序分配，所有任务累计不超来源，不跨单位', () => {
  const transfer = receivedTransfer(), price = transfer.lines[0]
  transfer.lines = [{ ...price, id: 'PRICE-A', qty: 60, toLocationId: 'H-A01' }, { ...price, id: 'PRICE-B', qty: 50, toLocationId: 'H-B01' }, transfer.lines[1]]
  const scopes = buildAccessorySewingTaskScopes(preparation(), transfer, facts())
  assert.deepEqual(scopes.map(scope => [scope.quantitiesByLine['PRICE-A'] || 0, scope.quantitiesByLine['PRICE-B'] || 0]), [[60, 28], [0, 22]])
  assert.equal(scopes.reduce((sum, row) => sum + (row.quantitiesByLine['PRICE-A'] || 0), 0), 60)
  assert.equal(scopes.reduce((sum, row) => sum + (row.quantitiesByLine['PRICE-B'] || 0), 0), 50)
  assert.equal(scopes[0].bomQuantities.find(row => row.bomItemId === 'BOM-PRICE')?.unit, '张')
  assert.equal(scopes[0].bomQuantities.find(row => row.bomItemId === 'BOM-ZIP')?.unit, '条')
})

test('既有实交账和当前领料版本保留引用，不伪造库位实交，不把累计实交清零', () => {
  const input = facts()
  input.handoverProjections = [projection(input.assignments[0])]
  input.pickupSlipVersions = [slip(input.assignments[0])]
  const scopes = buildAccessorySewingTaskScopes(preparation(), receivedTransfer(), input)
  assert.equal(scopes[0].handoverContextPresent, true)
  assert.equal(scopes[0].requirementLineIdByLine[PRICE_LINE], 'REQ-A')
  assert.equal(scopes[0].cumulativeHandedQtyByRequirement['REQ-A'], 12)
  assert.equal(scopes[0].pickupSlipVersionId, 'SLIP-1-v3')
  assert.equal(scopes[1].handoverContextPresent, false)
  assert.deepEqual(scopes[1].cumulativeHandedQtyByRequirement, {})
  assert.equal(scopes[1].pickupSlipVersionId, undefined)
})

test('任务版本由有效分配与SKU事实决定，顺序重排稳定，实际范围变更改变版本', () => {
  const input = facts()
  const first = buildAccessorySewingTaskScopes(preparation(), receivedTransfer(), input)
  const reordered = structuredClone(input)
  reordered.assignments.reverse()
  reordered.assignments.forEach(row => row.skuLines.reverse())
  assert.deepEqual(buildAccessorySewingTaskScopes(preparation(), receivedTransfer(), reordered).map(row => row.taskVersion), first.map(row => row.taskVersion))
  const changed = structuredClone(input)
  changed.assignments[0].operatedAt = '2026-10-11'
  assert.notEqual(buildAccessorySewingTaskScopes(preparation(), receivedTransfer(), changed)[0].taskVersion, first[0].taskVersion)
})

test('未收货、过期技术包、无SKU范围和单位冲突明确阻断', () => {
  const input = facts()
  assert.throws(() => buildAccessorySewingTaskScopes(preparation(), { ...receivedTransfer(), status: '已出库待收货' }, input), codes('SOURCE_NOT_RECEIVED'))
  assert.throws(() => buildAccessorySewingTaskScopes({ ...preparation(), techPackVersion: 'OLD' }, receivedTransfer(), input), codes('SOURCE_VERSION_CHANGED'))
  assert.throws(() => buildAccessorySewingTaskScopes(preparation(), receivedTransfer(), { ...input, snapshot: null }), codes('TECH_PACK_MISSING'))
  assert.throws(() => buildAccessorySewingTaskScopes(preparation(), receivedTransfer(), { ...input, orderSkuLines: [] }), codes('SKU_SCOPE_MISSING'))
  const differentUnit = structuredClone(input)
  differentUnit.snapshot!.bomItems[0].unit = '件'
  assert.throws(() => buildAccessorySewingTaskScopes(preparation(), receivedTransfer(), differentUnit), codes('BOM_UNIT_CONFLICT'))
})

test('过期和取消分配不能复活；未分配、部分分配任务不能自动选择旧厂', () => {
  const input = facts()
  assert.throws(() => buildAccessorySewingTaskScopes(preparation(), receivedTransfer(), { ...input, assignments: input.assignments.map(row => ({ ...row, status: 'SUPERSEDED' })) }), codes('WAITING_SEWING_ASSIGNMENT'))
  assert.throws(() => buildAccessorySewingTaskScopes(preparation(), receivedTransfer(), { ...input, tasks: input.tasks.map(row => ({ ...row, assignmentStatus: 'UNASSIGNED' })) }), codes('WAITING_SEWING_ASSIGNMENT'))
  const cancelled = structuredClone(input)
  cancelled.tasks[0].status = 'CANCELLED'
  assert.throws(() => buildAccessorySewingTaskScopes(preparation(), receivedTransfer(), cancelled), codes('STALE_SEWING_ASSIGNMENT'))
  const partial = structuredClone(input)
  partial.assignments[0].skuLines[0].qty = 30
  partial.assignments[0].assignedQty = 40
  assert.throws(() => buildAccessorySewingTaskScopes(preparation(), receivedTransfer(), partial), codes('PARTIALLY_ASSIGNED_TASK'))
})

test('缺少PPIC、错厂、错颜色尺码、数量合计不符和生产单重复范围不放行', () => {
  const base = facts()
  const noPpic = structuredClone(base); noPpic.assignments[0].ppicId = ''
  assert.throws(() => buildAccessorySewingTaskScopes(preparation(), receivedTransfer(), noPpic), codes('ASSIGNMENT_PARTIES_MISSING'))
  const wrongFactory = structuredClone(base); wrongFactory.tasks[0].assignedFactoryId = 'STALE-FACTORY'
  assert.throws(() => buildAccessorySewingTaskScopes(preparation(), receivedTransfer(), wrongFactory), codes('ASSIGNMENT_FACTORY_CHANGED'))
  const wrongSize = structuredClone(base); wrongSize.assignments[0].skuLines[0].size = 'XL'
  assert.throws(() => buildAccessorySewingTaskScopes(preparation(), receivedTransfer(), wrongSize), codes('ASSIGNED_SKU_CONFLICT'))
  const wrongTotal = structuredClone(base); wrongTotal.assignments[0].assignedQty = 51
  assert.throws(() => buildAccessorySewingTaskScopes(preparation(), receivedTransfer(), wrongTotal), codes('ASSIGNED_QUANTITY_CONFLICT'))
  const duplicated = structuredClone(base); duplicated.orderSkuLines[0].qty = 49
  assert.throws(() => buildAccessorySewingTaskScopes(preparation(), receivedTransfer(), duplicated), codes('DUPLICATED_ORDER_SCOPE'))
})

test('混合后道责任冲突阻断；全部车缝烫包则所有辅料由任务领料，不生成后道份额', () => {
  const input = facts()
  input.tasks[1].mergedTaskType = 'SEWING_IRON_PACK'
  input.assignments[1].processCodes = ['SEWING', 'IRON_PACK']
  assert.throws(() => buildAccessorySewingTaskScopes(preparation(), receivedTransfer(), input), codes('MIXED_POST_RESPONSIBILITY'))
  input.tasks[0].mergedTaskType = 'SEWING_IRON_PACK'
  input.assignments[0].processCodes = ['SEWING', 'IRON_PACK']
  const scopes = buildAccessorySewingTaskScopes(preparation(), receivedTransfer(), input)
  assert.ok(scopes.every(row => row.taskType === 'SEWING_IRONING_PACKING'))
  assert.ok(scopes.every(row => Object.keys(row.postQuantitiesByLine).length === 0))
  assert.equal(scopes[0].sewingQuantitiesByLine[ZIP_LINE], 50)
})

test('调拨片段、正式用途、单耗和BOM来源冲突不能生成清单', () => {
  const input = facts()
  const missingLocation = receivedTransfer(); missingLocation.lines[0].toLocationId = ''
  assert.throws(() => buildAccessorySewingTaskScopes(preparation(), missingLocation, input), codes('TRANSFER_LINE_SOURCE_CONFLICT'))
  const moreConsumption = structuredClone(input); moreConsumption.snapshot!.bomItems[0].unitConsumption = 3
  assert.throws(() => buildAccessorySewingTaskScopes(preparation(), receivedTransfer(), moreConsumption), codes('TASK_MATERIAL_OVER_SOURCE'))
  const unknownPurpose = preparation(); unknownPurpose.lines[0].purpose = '待核对'
  assert.throws(() => buildAccessorySewingTaskScopes(unknownPurpose, receivedTransfer(), input), (error: unknown) => error instanceof Error && /用途待核对/.test(error.message))
  const noBom = structuredClone(input); noBom.snapshot!.bomItems = noBom.snapshot!.bomItems.slice(1)
  assert.throws(() => buildAccessorySewingTaskScopes(preparation(), receivedTransfer(), noBom), codes('BOM_SOURCE_CONFLICT'))
})

test('已存在交出账或当前领料凭证与任务身份不一致时拒绝，而非覆盖旧事实', () => {
  const input = facts()
  const oldProjection = projection(input.assignments[0]); oldProjection.context.ppicId = 'OLD-PPIC'
  assert.throws(() => buildAccessorySewingTaskScopes(preparation(), receivedTransfer(), { ...input, handoverProjections: [oldProjection] }), codes('HANDOVER_CONTEXT_CONFLICT'))
  const oldSlip = slip(input.assignments[0]); oldSlip.factoryId = 'OLD-FACTORY'
  assert.throws(() => buildAccessorySewingTaskScopes(preparation(), receivedTransfer(), { ...input, pickupSlipVersions: [oldSlip] }), codes('PICKUP_VERSION_CONFLICT'))
})
