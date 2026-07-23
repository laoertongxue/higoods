import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  confirmSupplementAndGenerateProcessWorkOrders,
  listSupplementRecords,
  setSupplementRecordSaveFailureForTest,
  setSupplementWorkOrderLookupFailureForTest,
} from '../src/pages/process-factory/cutting/supplement-management.ts'
import { cuttingOrderProgressRecords } from '../src/data/fcs/cutting/order-progress.ts'
import { getProcessWorkOrderById, listProcessWorkOrders } from '../src/data/fcs/process-work-order-domain.ts'
import { listPdaGenericProcessTasks } from '../src/data/fcs/pda-task-mock-factory.ts'
import { getProductionOrderTechPackSnapshot } from '../src/data/fcs/production-order-tech-pack-runtime.ts'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import {
  prepareProcessWorkOrderBatch,
  resolveUniqueSupplementBomItem,
  setProcessWorkOrderGenerationCommitFailureForTest,
  setProcessWorkOrderGenerationPrepareFailureForTest,
  setProcessWorkOrderGenerationRollbackFailureForTest,
  type ProcessWorkOrderGenerationInput,
} from '../src/data/fcs/process-work-order-generation-service.ts'

const supplementSource = readFileSync(
  new URL('../src/pages/process-factory/cutting/supplement-management.ts', import.meta.url),
  'utf8',
)
assert.doesNotMatch(supplementSource, /印花需求|染色需求|生成[^'"<\n]{0,12}需求/, '补料模块不得残留印花、染色需求单旧词')
assert.match(
  supplementSource,
  /PROCESS_WORK_ORDER_SOURCE_LABEL\.CUT_PIECE_SUPPLEMENT/,
  '补料加工单详情必须通过统一来源映射展示“裁片补料生成”',
)

const initialRecords = listSupplementRecords()
assert(initialRecords.length > 0, '缺少补料检查数据')

const cloneProbe = listSupplementRecords()
cloneProbe[0].createdBy = '不应写回页面状态'
cloneProbe[0].draft.reason = '不应写回嵌套草稿'
if (cloneProbe[0].processWorkOrderRefs[0]) cloneProbe[0].processWorkOrderRefs[0].plannedQty = -1
assert.notEqual(listSupplementRecords()[0].createdBy, cloneProbe[0].createdBy, '补料记录查询必须返回深拷贝')
assert.notEqual(listSupplementRecords()[0].draft.reason, cloneProbe[0].draft.reason, '补料记录查询必须深拷贝嵌套草稿')
assert(listSupplementRecords()[0].processWorkOrderRefs.every((item) => item.plannedQty > 0), '补料记录查询必须深拷贝加工单引用')

const seedRecord = initialRecords.find((record) =>
  record.draft.sourceType === 'cut-order'
  && record.draft.materialDemands.some((item) => item.printRequired && item.dyeRequired),
)
assert(seedRecord, '缺少同一冻结 BOM 同时需要染色、印花的补料检查数据')

const fixtureDraft = structuredClone(seedRecord.draft)
fixtureDraft.confirmationIdentity = 'task8-positive-confirmation'
const beforePositiveCount = listSupplementRecords().length
const result = confirmSupplementAndGenerateProcessWorkOrders(fixtureDraft, '测试人员')
assert.equal(result.ok, true)
if (result.ok) {
  assert.equal(result.record.draft.confirmationIdentity, fixtureDraft.confirmationIdentity, '补料记录必须冻结明确的确认标识')
  assert.equal(result.record.confirmationKey, fixtureDraft.confirmationIdentity, '补料记录必须保存未散列的稳定确认键')
  assert(result.record.requestFingerprint.length > 20, '补料记录必须保存完整业务请求指纹')
  assert.equal(result.record.processWorkOrderRefs.length, 2)
  assert.deepEqual(result.record.processWorkOrderRefs.map((item) => item.processType).sort(), ['DYE', 'PRINT'])
  assert(result.record.processWorkOrderRefs.every((item) => item.workOrderId && item.workOrderNo))
  assert(result.record.processWorkOrderRefs.every((item) => item.sourceType === 'CUT_PIECE_SUPPLEMENT'))
  assert(result.record.processWorkOrderRefs.every((item) => Number.isFinite(item.plannedQty) && item.plannedQty > 0))
  const snapshot = getProductionOrderTechPackSnapshot(fixtureDraft.productionOrderId)
  assert(snapshot, '补料检查数据缺少冻结技术包')
  const sourceDemand = fixtureDraft.materialDemands[0]
  const sourceBomItem = snapshot.bomItems.find((item) => item.id === sourceDemand.sourceBomItemId)
  assert(sourceBomItem, '补料检查数据缺少唯一 BOM 行')
  const supplementQty = fixtureDraft.lines
    .filter((line) => line.basis.shortageMaterial.materialPatternMappingId === sourceDemand.materialPatternMappingId)
    .reduce((sum, line) => sum + line.supplementQty, 0)
  const expectedPlannedQty = Math.round(
    supplementQty * sourceBomItem.unitConsumption * (1 + sourceBomItem.lossRate) * 1_000_000,
  ) / 1_000_000
  assert(result.record.processWorkOrderRefs.every((item) => item.plannedQty === expectedPlannedQty), '加工数量必须按补料件数、BOM 单耗和损耗精确到 6 位')
  for (const ref of result.record.processWorkOrderRefs) {
    const workOrder = getProcessWorkOrderById(ref.workOrderId)
    assert(workOrder, `真实加工单不存在：${ref.workOrderId}`)
    assert.equal(workOrder.workOrderNo, ref.workOrderNo)
    assert.equal(workOrder.sourceType, 'CUT_PIECE_SUPPLEMENT')
    assert.equal(workOrder.sourceSnapshot.supplementRecordId, result.record.id)
    assert.equal(workOrder.sourceSnapshot.supplementRecordNo, result.record.recordNo)
    assert.equal(workOrder.sourceSnapshot.originalCutOrderNo, fixtureDraft.sourceNo)
    assert.equal(workOrder.sourceSnapshot.techPackVersionId, fixtureDraft.materialDemands[0].techPackVersionId)
    assert(workOrder.sourceSnapshot.bomItemId, '补料加工单必须保存 BOM 行')
    assert.equal(workOrder.plannedQty, ref.plannedQty)
    assert.equal(workOrder.sourceSnapshot.sourceType, 'CUT_PIECE_SUPPLEMENT')
    assert(workOrder.sourceSnapshot.supplementRecordNo, '加工单必须保留补料单号')
    assert(workOrder.sourceSnapshot.originalCutOrderNo, '加工单必须保留原裁片单号')
    assert(workOrder.sourceSnapshot.productionOrderNo, '加工单必须保留生产单号')
    assert(workOrder.sourceSnapshot.techPackVersionLabel, '加工单必须保留冻结技术包版本')
  }
}

const repeated = confirmSupplementAndGenerateProcessWorkOrders(structuredClone(fixtureDraft), '测试人员')
assert.equal(repeated.ok, true)
if (result.ok && repeated.ok) {
  assert.equal(repeated.record.id, result.record.id, '重复确认必须返回同一补料记录')
  assert.deepEqual(repeated.record.processWorkOrderRefs, result.record.processWorkOrderRefs, '重复确认不得重复生成加工单引用')
}
assert.equal(listSupplementRecords().length, beforePositiveCount + 1, '重复确认不得重复写入补料记录')

const conflictingRetryDraft = structuredClone(fixtureDraft)
conflictingRetryDraft.reasonDetail = `${conflictingRetryDraft.reasonDetail}（冲突修改）`
const conflictingRetry = confirmSupplementAndGenerateProcessWorkOrders(conflictingRetryDraft, '测试人员')
assert.equal(conflictingRetry.ok, false, '相同确认键但业务请求不同必须明确冲突，不得复用旧记录')
if (!conflictingRetry.ok) assert.match(conflictingRetry.message, /确认键|冲突|请求/)

const noProcessSeed = initialRecords.find((record) =>
  record.draft.sourceType === 'cut-order'
  && record.draft.materialDemands.every((item) => !item.printRequired && !item.dyeRequired),
)
assert(noProcessSeed, '缺少无需印染加工的补料检查数据')
const noProcessDraft = structuredClone(noProcessSeed.draft)
noProcessDraft.confirmationIdentity = 'task8-no-process-confirmation'
const noProcessResult = confirmSupplementAndGenerateProcessWorkOrders(noProcessDraft, '测试人员')
assert.equal(noProcessResult.ok, true)
if (noProcessResult.ok) assert.deepEqual(noProcessResult.record.processWorkOrderRefs, [])

const noProcessMissingSnapshotDraft = structuredClone(noProcessDraft)
noProcessMissingSnapshotDraft.confirmationIdentity = 'task8-no-process-missing-snapshot'
noProcessMissingSnapshotDraft.productionOrderId = 'PO-NO-FROZEN-TECH-PACK-NO-PROCESS'
const noProcessMissingSnapshotResult = confirmSupplementAndGenerateProcessWorkOrders(noProcessMissingSnapshotDraft, '测试人员')
assert.equal(noProcessMissingSnapshotResult.ok, false, '即使无需印染加工单，缺少冻结技术包也不得确认补料')
if (!noProcessMissingSnapshotResult.ok) assert.match(noProcessMissingSnapshotResult.message, /冻结技术包/)

const emptyMaterialDraft = structuredClone(noProcessDraft)
emptyMaterialDraft.confirmationIdentity = 'task8-empty-material'
emptyMaterialDraft.materialDemands = []
const emptyMaterialResult = confirmSupplementAndGenerateProcessWorkOrders(emptyMaterialDraft, '测试人员')
assert.equal(emptyMaterialResult.ok, false, '没有补料物料时不得绕过原裁片、冻结版本和唯一 BOM 链路')

const emptyLineDraft = structuredClone(noProcessDraft)
emptyLineDraft.confirmationIdentity = 'task8-empty-line'
emptyLineDraft.lines = []
assert.equal(confirmSupplementAndGenerateProcessWorkOrders(emptyLineDraft, '测试人员').ok, false, '补料确认至少需要一条补料明细')

for (const [label, qty] of [
  ['NaN', Number.NaN],
  ['正无穷', Number.POSITIVE_INFINITY],
  ['零', 0],
  ['负数', -1],
  ['小数', 1.5],
] as const) {
  const invalidQtyDraft = structuredClone(noProcessDraft)
  invalidQtyDraft.confirmationIdentity = `task8-invalid-qty-${label}`
  invalidQtyDraft.lines[0].supplementQty = qty
  const invalidQtyResult = confirmSupplementAndGenerateProcessWorkOrders(invalidQtyDraft, '测试人员')
  assert.equal(invalidQtyResult.ok, false, `裁片补料数量为${label}时必须阻断`)
}

const uncoveredLineDraft = structuredClone(noProcessDraft)
uncoveredLineDraft.confirmationIdentity = 'task8-uncovered-line'
uncoveredLineDraft.lines[0].basis.shortageMaterial.materialPatternMappingId = 'MAPPING-NOT-COVERED'
assert.equal(confirmSupplementAndGenerateProcessWorkOrders(uncoveredLineDraft, '测试人员').ok, false, '每条补料明细必须由且仅由一条物料记录覆盖')

const duplicateDemandDraft = structuredClone(noProcessDraft)
duplicateDemandDraft.confirmationIdentity = 'task8-duplicate-demand'
const duplicateDemand = structuredClone(duplicateDemandDraft.materialDemands[0])
duplicateDemand.key = `${duplicateDemand.key}:duplicate`
duplicateDemandDraft.materialDemands.push(duplicateDemand)
assert.equal(confirmSupplementAndGenerateProcessWorkOrders(duplicateDemandDraft, '测试人员').ok, false, '同一明细映射不得对应重复物料记录')

const wrongSkuDraft = structuredClone(fixtureDraft)
wrongSkuDraft.confirmationIdentity = 'task8-wrong-material-sku'
wrongSkuDraft.materialDemands[0].materialSku = 'MAT-WRONG-SKU'
assert.equal(confirmSupplementAndGenerateProcessWorkOrders(wrongSkuDraft, '测试人员').ok, false, 'sourceBomItemId 命中时仍须核验稳定物料编码')

const wrongNameDraft = structuredClone(fixtureDraft)
wrongNameDraft.confirmationIdentity = 'task8-wrong-material-name'
wrongNameDraft.materialDemands[0].materialName = '错误物料名称'
assert.equal(confirmSupplementAndGenerateProcessWorkOrders(wrongNameDraft, '测试人员').ok, false, 'sourceBomItemId 命中时仍须核验物料名称')

const anotherMaterialRecord = initialRecords.find((record) => (
  record.draft.productionOrderId === fixtureDraft.productionOrderId
  && record.draft.sourceType === 'cut-order'
  && record.draft.sourceNo !== fixtureDraft.sourceNo
  && record.draft.materialDemands[0]?.materialSku !== fixtureDraft.materialDemands[0]?.materialSku
))
assert(anotherMaterialRecord, '缺少同生产单另一物料裁片单错配检查数据')
const wrongCutMaterialDraft = structuredClone(fixtureDraft)
wrongCutMaterialDraft.confirmationIdentity = 'task8-wrong-cut-material'
wrongCutMaterialDraft.materialDemands[0].originalCutOrderId = anotherMaterialRecord.draft.materialDemands[0].originalCutOrderId
wrongCutMaterialDraft.materialDemands[0].originalCutOrderNo = anotherMaterialRecord.draft.materialDemands[0].originalCutOrderNo
assert.equal(confirmSupplementAndGenerateProcessWorkOrders(wrongCutMaterialDraft, '测试人员').ok, false, '同生产单另一物料的裁片单不得冒充当前 BOM 原裁片单')

const recordsBeforeInvalid = listSupplementRecords().length
const workOrdersBeforeInvalid = listProcessWorkOrders().length
const missingSnapshotDraft = structuredClone(fixtureDraft)
missingSnapshotDraft.confirmationIdentity = 'task8-missing-snapshot'
missingSnapshotDraft.productionOrderId = 'PO-NO-FROZEN-TECH-PACK'
const missingSnapshotResult = confirmSupplementAndGenerateProcessWorkOrders(missingSnapshotDraft, '测试人员')
assert.equal(missingSnapshotResult.ok, false)
if (!missingSnapshotResult.ok) assert.match(missingSnapshotResult.message, /冻结技术包/)

const missingBomDraft = structuredClone(fixtureDraft)
missingBomDraft.confirmationIdentity = 'task8-missing-bom'
missingBomDraft.materialDemands[0].sourceBomItemId = 'BOM-NOT-FOUND'
const missingBomResult = confirmSupplementAndGenerateProcessWorkOrders(missingBomDraft, '测试人员')
assert.equal(missingBomResult.ok, false)
if (!missingBomResult.ok) assert.match(missingBomResult.message, /唯一匹配|BOM/)
assert.equal(listSupplementRecords().length, recordsBeforeInvalid, '校验失败不得写入补料记录')
assert.equal(listProcessWorkOrders().length, workOrdersBeforeInvalid, '校验失败不得半写加工单')

const validSnapshot = getProductionOrderTechPackSnapshot(fixtureDraft.productionOrderId)
assert(validSnapshot, '缺少重复 BOM 检查数据')
const duplicatedBom = validSnapshot.bomItems.find((item) => item.id === fixtureDraft.materialDemands[0].sourceBomItemId)
assert(duplicatedBom, '缺少重复 BOM 检查行')
const ambiguous = resolveUniqueSupplementBomItem({
  bomItems: [structuredClone(duplicatedBom), structuredClone(duplicatedBom)],
  sourceBomItemId: duplicatedBom.id,
  materialSku: fixtureDraft.materialDemands[0].materialSku,
  materialName: fixtureDraft.materialDemands[0].materialName,
})
assert.equal(ambiguous.ok, false, '多条 BOM 匹配必须明确失败')

for (const [field, value] of [
  ['unitConsumption', Number.NaN],
  ['unitConsumption', 0],
  ['unitConsumption', -1],
  ['lossRate', Number.NaN],
  ['lossRate', -1],
  ['lossRate', 101],
] as const) {
  const invalidBom = structuredClone(duplicatedBom)
  invalidBom[field] = value
  const invalidBomResult = resolveUniqueSupplementBomItem({
    bomItems: [invalidBom],
    sourceBomItemId: invalidBom.id,
    materialSku: fixtureDraft.materialDemands[0].materialSku,
    materialName: fixtureDraft.materialDemands[0].materialName,
  })
  assert.equal(invalidBomResult.ok, false, `BOM ${field}=${String(value)} 时必须阻断，包括无需印染的补料`)
}

function fnvToken(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, '0')
}

function findFNV32Collision(): [string, string] {
  return ['costarring', 'liquid']
}

const [collisionKeyA, collisionKeyB] = findFNV32Collision()
assert.equal(fnvToken(collisionKeyA), fnvToken(collisionKeyB), '碰撞样本必须命中同一条补料记录 ID')
const collisionDraftA = structuredClone(noProcessDraft)
collisionDraftA.confirmationIdentity = collisionKeyA
const collisionDraftB = structuredClone(noProcessDraft)
collisionDraftB.confirmationIdentity = collisionKeyB
assert.equal(confirmSupplementAndGenerateProcessWorkOrders(collisionDraftA, '测试人员').ok, true)
const collisionResult = confirmSupplementAndGenerateProcessWorkOrders(collisionDraftB, '测试人员')
assert.equal(collisionResult.ok, false, '不同原始确认键即使发生哈希碰撞也不得复用旧记录')

const saveFailureDraft = structuredClone(fixtureDraft)
saveFailureDraft.confirmationIdentity = 'task8-record-save-rollback'
const saveFailureCounts = {
  records: listSupplementRecords().length,
  workOrders: listProcessWorkOrders().length,
  pdaTasks: listPdaGenericProcessTasks().length,
}
setSupplementRecordSaveFailureForTest(true)
const saveFailureResult = confirmSupplementAndGenerateProcessWorkOrders(saveFailureDraft, '测试人员')
setSupplementRecordSaveFailureForTest(false)
assert.equal(saveFailureResult.ok, false, '加工单提交后补料记录保存失败时整批必须失败')
assert.equal(listSupplementRecords().length, saveFailureCounts.records)
assert.equal(listProcessWorkOrders().length, saveFailureCounts.workOrders)
assert.equal(listPdaGenericProcessTasks().length, saveFailureCounts.pdaTasks)
assert.equal(confirmSupplementAndGenerateProcessWorkOrders(saveFailureDraft, '测试人员').ok, true, '记录保存失败回滚后必须可以使用同一确认键重试')

const lookupFailureDraft = structuredClone(fixtureDraft)
lookupFailureDraft.confirmationIdentity = 'task8-work-order-lookup-rollback'
const lookupFailureCounts = {
  records: listSupplementRecords().length,
  workOrders: listProcessWorkOrders().length,
  pdaTasks: listPdaGenericProcessTasks().length,
}
setSupplementWorkOrderLookupFailureForTest(true)
const lookupFailureResult = confirmSupplementAndGenerateProcessWorkOrders(lookupFailureDraft, '测试人员')
assert.equal(lookupFailureResult.ok, false, '提交成功后加工单引用解析失败时必须整批回滚')
assert.equal(listSupplementRecords().length, lookupFailureCounts.records)
assert.equal(listProcessWorkOrders().length, lookupFailureCounts.workOrders)
assert.equal(listPdaGenericProcessTasks().length, lookupFailureCounts.pdaTasks)
assert.equal(confirmSupplementAndGenerateProcessWorkOrders(lookupFailureDraft, '测试人员').ok, true, '引用解析失败回滚后必须可使用同一确认键重试')

function buildTransactionInput(seed: string, processCodes: Array<'DYE' | 'PRINT'> = ['DYE', 'PRINT']): ProcessWorkOrderGenerationInput {
  return {
    source: { sourceType: 'STOCK', stockMaterialId: `stock-${seed}`, stockMaterialName: `事务物料 ${seed}` },
    processCodes,
    orderedAt: `2026-07-23 10:${seed.padStart(2, '0').slice(-2)}:00`,
    materialId: `MAT-${seed}`,
    materialName: `事务物料 ${seed}`,
    materialItems: [{ materialId: `MAT-${seed}`, materialName: `事务物料 ${seed}` }],
    targetColor: '黑色',
    plannedQty: 10,
    qtyUnit: '米',
    spuCode: `SPU-${seed}`,
    spuName: '事务检查款',
    requiredDeliveryDate: '2026-07-30',
  }
}

const transactionBaseCounts = () => ({
  workOrders: listProcessWorkOrders().length,
  pdaTasks: listPdaGenericProcessTasks().length,
})
const assertTransactionCounts = (expected: ReturnType<typeof transactionBaseCounts>, label: string) => {
  assert.equal(listProcessWorkOrders().length, expected.workOrders, `${label}不得残留加工单`)
  assert.equal(listPdaGenericProcessTasks().length, expected.pdaTasks, `${label}不得残留 PDA 任务`)
}

const prepareFailureCounts = transactionBaseCounts()
setProcessWorkOrderGenerationPrepareFailureForTest('DYE', 2)
assert.throws(() => prepareProcessWorkOrderBatch([
  buildTransactionInput('prepare-1', ['DYE']),
  buildTransactionInput('prepare-2', ['DYE']),
]), /模拟.*准备失败/)
setProcessWorkOrderGenerationPrepareFailureForTest(null)
assertTransactionCounts(prepareFailureCounts, '准备阶段失败')

for (const [processCode, occurrence, label] of [
  ['DYE', 1, '第 1 张染色'],
  ['PRINT', 1, '第 1 张印花'],
  ['DYE', 2, '第 2 张染色'],
  ['PRINT', 2, '第 2 张印花'],
] as const) {
  const counts = transactionBaseCounts()
  const transaction = prepareProcessWorkOrderBatch([
    buildTransactionInput(`commit-${processCode}-${occurrence}-1`),
    buildTransactionInput(`commit-${processCode}-${occurrence}-2`),
  ])
  setProcessWorkOrderGenerationCommitFailureForTest(processCode, occurrence)
  assert.throws(() => transaction.commit(), /模拟.*提交失败/)
  setProcessWorkOrderGenerationCommitFailureForTest(null)
  assertTransactionCounts(counts, `${label}提交失败`)
}

const rollbackFailureCounts = transactionBaseCounts()
const rollbackFailureTransaction = prepareProcessWorkOrderBatch([
  buildTransactionInput('rollback-error-1'),
  buildTransactionInput('rollback-error-2'),
])
setProcessWorkOrderGenerationRollbackFailureForTest('DYE', 1)
setProcessWorkOrderGenerationCommitFailureForTest('PRINT', 2)
assert.throws(() => rollbackFailureTransaction.commit(), (error: unknown) => {
  assert(error instanceof AggregateError, '回滚失败必须与原始提交失败聚合返回')
  assert.match(error.message, /提交失败/)
  assert(error.cause instanceof Error)
  assert.match(error.cause.message, /提交失败/)
  assert(error.errors.some((item) => item instanceof Error && /回滚失败/.test(item.message)))
  return true
})
setProcessWorkOrderGenerationCommitFailureForTest(null)
setProcessWorkOrderGenerationRollbackFailureForTest(null)
assertTransactionCounts(rollbackFailureCounts, '回滚异常后续继清理')

const duplicateInputCounts = transactionBaseCounts()
const duplicateInput = buildTransactionInput('duplicate-source', ['DYE'])
const duplicateTransaction = prepareProcessWorkOrderBatch([duplicateInput, structuredClone(duplicateInput)])
const duplicateResults = duplicateTransaction.commit()
assert.equal(duplicateResults[0].dyeWorkOrderId, duplicateResults[1].dyeWorkOrderId, '批内重复来源必须复用同一张加工单')
assert.equal(listProcessWorkOrders().length, duplicateInputCounts.workOrders + 1, '批内重复来源只允许落一张加工单')
duplicateTransaction.rollback()
assertTransactionCounts(duplicateInputCounts, '公开事务主动回滚')

const releaseOrder = productionOrders.find((order) => order.productionOrderNo === 'PO14671')
assert(releaseOrder?.techPackSnapshot, 'PO14671 必须有独立的冻结技术包快照')
const releaseSnapshot = releaseOrder.techPackSnapshot
const releaseSkuCodes = releaseOrder.demandSnapshot.skuLines.map((line) => line.skuCode).sort()
assert.equal(releaseSkuCodes.length, 12, 'PO14671 必须覆盖 4 色 × 3 码的 12 条生产 SKU')
assert(releaseSkuCodes.every((sku) => sku.startsWith('ASYSA26060310-')), 'PO14671 SKU 必须属于当前款式')
assert.deepEqual(releaseOrder.sourceDemandSnapshots[0].skuLines, releaseOrder.demandSnapshot.skuLines)
const releaseBomIds = new Set(releaseSnapshot.bomItems.map((item) => item.id))
const releasePatternIds = new Set(releaseSnapshot.patternFiles.map((item) => item.patternFileId))
for (const bomItem of releaseSnapshot.bomItems) {
  assert.deepEqual([...bomItem.applicableSkuCodes].sort(), releaseSkuCodes, `BOM ${bomItem.id} 必须适用当前生产单全部 SKU`)
  assert(bomItem.linkedPatternIds.every((id) => releasePatternIds.has(id)), `BOM ${bomItem.id} 不得引用外部纸样`)
}
for (const mapping of releaseSnapshot.colorMaterialMappings) {
  assert.equal(mapping.spuCode, 'ASYSA26060310')
  for (const line of mapping.lines) {
    assert(releaseBomIds.has(line.bomItemId), `款色用料 ${line.id} 引用的 BOM 必须存在`)
    assert(releasePatternIds.has(line.patternId), `款色用料 ${line.id} 引用的纸样必须存在`)
    assert(line.applicableSkuCodes.every((sku) => releaseSkuCodes.includes(sku)), `款色用料 ${line.id} 不得引用外部 SKU`)
  }
}
for (const process of releaseSnapshot.processEntries) {
  assert(process.linkedBomItemIds.every((id) => releaseBomIds.has(id)), `工艺 ${process.id} 引用的 BOM 必须存在`)
  assert(process.linkedPatternIds.every((id) => releasePatternIds.has(id)), `工艺 ${process.id} 引用的纸样必须存在`)
}
const releaseSnapshotText = JSON.stringify(releaseSnapshot)
assert.doesNotMatch(releaseSnapshotText, /SPU-2024-005|tdv_demand_SPU_2024_005|SPECIAL_CRAFT|直喷|烫画/, 'PO14671 不得残留模板款式、旧版本、特殊工艺或印花转印引用')

const multiBomSnapshot = getProductionOrderTechPackSnapshot(fixtureDraft.productionOrderId)
assert(multiBomSnapshot, '缺少多 BOM 原子性检查所需冻结技术包')
const secondaryBom = multiBomSnapshot.bomItems.find((item) => item.id.endsWith('-bom-supplement-secondary'))
assert(secondaryBom, '冻结技术包必须提供第二条印花、染色 BOM 检查行')
assert(secondaryBom.materialCode, '第二条 BOM 必须提供物料编码')
const multiBomDraft = structuredClone(fixtureDraft)
multiBomDraft.confirmationIdentity = 'task8-multi-bom-atomic-failure'
multiBomDraft.sourceType = 'production-order'
multiBomDraft.sourceNo = multiBomDraft.productionOrderNo
const secondaryDemand = structuredClone(multiBomDraft.materialDemands[0])
secondaryDemand.key = `${secondaryDemand.key}:secondary`
secondaryDemand.materialPatternMappingId = `${secondaryDemand.materialPatternMappingId}:secondary`
secondaryDemand.sourceBomItemId = secondaryBom.id
secondaryDemand.materialSku = secondaryBom.materialCode
secondaryDemand.materialName = secondaryBom.name
const secondaryCutLine = cuttingOrderProgressRecords
  .find((record) => record.productionOrderId === multiBomDraft.productionOrderId)
  ?.materialLines.find((line) => (
    line.materialSku === secondaryBom.materialCode
    || line.materialIdentity?.materialSku === secondaryBom.materialCode
  ))
assert(secondaryCutLine, '第二条 BOM 必须有真实原裁片单和物料事实')
secondaryDemand.originalCutOrderId = secondaryCutLine.cutOrderId || secondaryCutLine.cutPieceOrderNo
secondaryDemand.originalCutOrderNo = secondaryCutLine.cutOrderNo || secondaryCutLine.cutPieceOrderNo
const secondaryLine = structuredClone(multiBomDraft.lines[0])
secondaryLine.key = `${secondaryLine.key}:secondary`
secondaryLine.basis.key = `${secondaryLine.basis.key}:secondary`
secondaryLine.basis.shortageMaterial.materialPatternMappingId = secondaryDemand.materialPatternMappingId
secondaryLine.basis.shortageMaterial.materialSku = secondaryDemand.materialSku
secondaryLine.basis.shortageMaterial.materialName = secondaryDemand.materialName
secondaryLine.basis.shortageMaterial.line = structuredClone(secondaryCutLine)
secondaryLine.basis.shortageMaterial.cutOrderNo = secondaryDemand.originalCutOrderNo
secondaryLine.basis.shortageMaterial.bomItem = structuredClone(secondaryBom)
secondaryLine.basis.shortageMaterial.mappingLine = undefined
multiBomDraft.materialDemands.push(secondaryDemand)
multiBomDraft.lines.push(secondaryLine)

const sameCutMultiMaterialDraft = structuredClone(multiBomDraft)
sameCutMultiMaterialDraft.confirmationIdentity = 'task8-same-cut-multi-material'
const primaryDemandForSameCut = sameCutMultiMaterialDraft.materialDemands[0]
const secondaryDemandForSameCut = sameCutMultiMaterialDraft.materialDemands[1]
const primaryDraftLineForSameCut = sameCutMultiMaterialDraft.lines.find((line) => (
  line.basis.shortageMaterial.materialPatternMappingId === primaryDemandForSameCut.materialPatternMappingId
))
const secondaryDraftLineForSameCut = sameCutMultiMaterialDraft.lines.find((line) => (
  line.basis.shortageMaterial.materialPatternMappingId === secondaryDemandForSameCut.materialPatternMappingId
))
assert(primaryDraftLineForSameCut && secondaryDraftLineForSameCut, '同一裁片单多物料检查必须找到两个 mapping 的明细')
const primaryLineForSameCut = primaryDraftLineForSameCut.basis.shortageMaterial.line
const secondaryLineForSameCut = secondaryDraftLineForSameCut.basis.shortageMaterial.line
const sameCutSecondaryMaterialLine = structuredClone(secondaryLineForSameCut)
sameCutSecondaryMaterialLine.cutOrderId = primaryDemandForSameCut.originalCutOrderId
sameCutSecondaryMaterialLine.cutOrderNo = primaryDemandForSameCut.originalCutOrderNo
sameCutSecondaryMaterialLine.cutPieceOrderNo = primaryLineForSameCut.cutPieceOrderNo
secondaryDemandForSameCut.originalCutOrderId = primaryDemandForSameCut.originalCutOrderId
secondaryDemandForSameCut.originalCutOrderNo = primaryDemandForSameCut.originalCutOrderNo
secondaryDraftLineForSameCut.basis.shortageMaterial.line = structuredClone(sameCutSecondaryMaterialLine)
secondaryDraftLineForSameCut.basis.shortageMaterial.cutOrderNo = primaryDemandForSameCut.originalCutOrderNo
assert.equal(secondaryDraftLineForSameCut.basis.shortageMaterial.line.cutOrderId, secondaryDemandForSameCut.originalCutOrderId)
assert.equal(secondaryDraftLineForSameCut.basis.shortageMaterial.line.cutOrderNo, secondaryDemandForSameCut.originalCutOrderNo)
const sameCutProductionRecord = cuttingOrderProgressRecords.find((record) => record.productionOrderId === sameCutMultiMaterialDraft.productionOrderId)
assert(sameCutProductionRecord, '缺少同一裁片单多物料检查的生产记录')
sameCutProductionRecord.materialLines.push(sameCutSecondaryMaterialLine)
const sameCutMultiMaterialResult = confirmSupplementAndGenerateProcessWorkOrders(sameCutMultiMaterialDraft, '测试人员')
sameCutProductionRecord.materialLines.pop()
assert.equal(
  sameCutMultiMaterialResult.ok,
  true,
  `同一裁片单内多物料时必须按当前 demand 的稳定物料身份解析，不得回退第一条明细：${sameCutMultiMaterialResult.ok ? '' : sameCutMultiMaterialResult.message}`,
)
if (sameCutMultiMaterialResult.ok) {
  assert.deepEqual(
    sameCutMultiMaterialResult.record.processWorkOrderRefs.map((item) => `${item.materialSku}:${item.processType}`),
    [
      `${primaryDemandForSameCut.materialSku}:DYE`,
      `${primaryDemandForSameCut.materialSku}:PRINT`,
      `${secondaryDemandForSameCut.materialSku}:DYE`,
      `${secondaryDemandForSameCut.materialSku}:PRINT`,
    ],
  )
}

const ambiguousSameCutDraft = structuredClone(sameCutMultiMaterialDraft)
ambiguousSameCutDraft.confirmationIdentity = 'task8-same-cut-ambiguous-material'
sameCutProductionRecord.materialLines.push(
  structuredClone(sameCutSecondaryMaterialLine),
  structuredClone(sameCutSecondaryMaterialLine),
)
const ambiguousSameCutResult = confirmSupplementAndGenerateProcessWorkOrders(ambiguousSameCutDraft, '测试人员')
sameCutProductionRecord.materialLines.splice(-2, 2)
assert.equal(ambiguousSameCutResult.ok, false, '同一裁片单内当前物料身份匹配多条时必须拒绝')
if (!ambiguousSameCutResult.ok) assert.match(ambiguousSameCutResult.message, /唯一|多条|明细/)

const atomicCountsBefore = {
  records: listSupplementRecords().length,
  workOrders: listProcessWorkOrders().length,
  pdaTasks: listPdaGenericProcessTasks().length,
}
setProcessWorkOrderGenerationCommitFailureForTest('PRINT', 2)
const multiBomFailed = confirmSupplementAndGenerateProcessWorkOrders(multiBomDraft, '测试人员')
setProcessWorkOrderGenerationCommitFailureForTest(null)
assert.equal(multiBomFailed.ok, false, '第二个 BOM 的印花加工单提交失败时，整批确认必须失败')
assert.equal(listSupplementRecords().length, atomicCountsBefore.records, '整批失败不得保存补料记录')
assert.equal(listProcessWorkOrders().length, atomicCountsBefore.workOrders, '整批失败不得残留任何加工单或幂等写入')
assert.equal(listPdaGenericProcessTasks().length, atomicCountsBefore.pdaTasks, '整批失败不得残留任何 PDA 任务')

const multiBomRetried = confirmSupplementAndGenerateProcessWorkOrders(multiBomDraft, '测试人员')
assert.equal(multiBomRetried.ok, true, '整批回滚后必须可以使用同一确认标识重试')
if (multiBomRetried.ok) {
  assert.deepEqual(
    multiBomRetried.record.processWorkOrderRefs.map((item) => `${item.materialSku}:${item.processType}`),
    [
      `${multiBomDraft.materialDemands[0].materialSku}:DYE`,
      `${multiBomDraft.materialDemands[0].materialSku}:PRINT`,
      `${secondaryDemand.materialSku}:DYE`,
      `${secondaryDemand.materialSku}:PRINT`,
    ],
    '多 BOM 加工单引用必须按 BOM 输入顺序、同 BOM 先染色后印花稳定排序',
  )
}

console.log('PASS: 裁片补料确认生成真实印染加工单，冻结追溯、多 BOM 原子回滚与详情事实符合预期')
