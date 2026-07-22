import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  confirmSupplementAndGenerateProcessWorkOrders,
  listSupplementRecords,
} from '../src/pages/process-factory/cutting/supplement-management.ts'
import { getProcessWorkOrderById, listProcessWorkOrders } from '../src/data/fcs/process-work-order-domain.ts'
import { listPdaGenericProcessTasks } from '../src/data/fcs/pda-task-mock-factory.ts'
import { getProductionOrderTechPackSnapshot } from '../src/data/fcs/production-order-tech-pack-runtime.ts'
import {
  resolveUniqueSupplementBomItem,
  setProcessWorkOrderGenerationCommitFailureForTest,
} from '../src/data/fcs/process-work-order-generation-service.ts'

const supplementSource = readFileSync(
  new URL('../src/pages/process-factory/cutting/supplement-management.ts', import.meta.url),
  'utf8',
)
assert.doesNotMatch(supplementSource, /印花需求|染色需求|生成[^'"<\n]{0,12}需求/, '补料模块不得残留印花、染色需求单旧词')
assert.match(supplementSource, /裁片补料生成/, '补料加工单详情必须明确显示“裁片补料生成”')

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

const multiBomSnapshot = getProductionOrderTechPackSnapshot(fixtureDraft.productionOrderId)
assert(multiBomSnapshot, '缺少多 BOM 原子性检查所需冻结技术包')
const secondaryBom = multiBomSnapshot.bomItems.find((item) => item.id.endsWith('-bom-supplement-secondary'))
assert(secondaryBom, '冻结技术包必须提供第二条印花、染色 BOM 检查行')
assert(secondaryBom.materialCode, '第二条 BOM 必须提供物料编码')
const multiBomDraft = structuredClone(fixtureDraft)
multiBomDraft.confirmationIdentity = 'task8-multi-bom-atomic-failure'
const secondaryDemand = structuredClone(multiBomDraft.materialDemands[0])
secondaryDemand.key = `${secondaryDemand.key}:secondary`
secondaryDemand.materialPatternMappingId = `${secondaryDemand.materialPatternMappingId}:secondary`
secondaryDemand.sourceBomItemId = secondaryBom.id
secondaryDemand.materialSku = secondaryBom.materialCode
secondaryDemand.materialName = secondaryBom.name
const secondaryLine = structuredClone(multiBomDraft.lines[0])
secondaryLine.key = `${secondaryLine.key}:secondary`
secondaryLine.basis.key = `${secondaryLine.basis.key}:secondary`
secondaryLine.basis.shortageMaterial.materialPatternMappingId = secondaryDemand.materialPatternMappingId
secondaryLine.basis.shortageMaterial.materialSku = secondaryDemand.materialSku
secondaryLine.basis.shortageMaterial.materialName = secondaryDemand.materialName
multiBomDraft.materialDemands.push(secondaryDemand)
multiBomDraft.lines.push(secondaryLine)

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
