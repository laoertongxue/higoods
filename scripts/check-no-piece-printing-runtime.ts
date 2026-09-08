import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  captureProcessWarehouseMutationState,
  getProcessWarehouseRecordById,
  listProcessWarehouseRecords,
  restoreProcessWarehouseMutationState,
} from '../src/data/fcs/process-warehouse-domain.ts'
import { applyPrintWarehouseLinkageAfterAction } from '../src/data/fcs/process-warehouse-linkage-service.ts'
import {
  deriveHandoutObjectProfile,
  type PdaHandoverHead,
} from '../src/data/fcs/pda-handover-events.ts'
import { listPrintWorkOrders } from '../src/data/fcs/printing-task-domain.ts'

const runtimeFiles = [
  'src/data/fcs/pda-task-mock-factory.ts',
  'src/data/fcs/process-warehouse-domain.ts',
  'src/data/fcs/process-warehouse-linkage-service.ts',
  'src/data/fcs/pda-handover-events.ts',
  'src/pages/pda-exec.ts',
  'src/pages/pda-exec-detail.ts',
]

const forbiddenTerms = [
  'isPiecePrinting',
  'isFabricPrinting',
  '印花裁片',
  '裁片印花',
]

for (const file of runtimeFiles) {
  const source = readFileSync(file, 'utf8')
  for (const term of forbiddenTerms) {
    assert(!source.includes(term), `${file} 仍残留旧裁片印花兼容：${term}`)
  }
}

const warehousePrintRecords = listProcessWarehouseRecords({ craftType: 'PRINT' })
assert(warehousePrintRecords.length > 0, '统一工艺仓应保留印花原物料演示记录')
assert(
  warehousePrintRecords.every((record) => record.objectType !== '裁片'),
  '印花待加工仓/待交出仓不能出现裁片对象',
)
assert(
  warehousePrintRecords.some((record) => record.objectType === '面料')
    && warehousePrintRecords.some((record) => record.objectType === '辅料'),
  '印花仓演示必须同时覆盖面料与花边等辅料原物料，而不是把同款所有物料压成面料',
)

const legacyHeadWithoutObjectFact: PdaHandoverHead = {
  handoverId: 'CHECK-PRINT-MATERIAL-FALLBACK',
  headType: 'HANDOUT',
  qrCodeValue: 'CHECK-PRINT-MATERIAL-FALLBACK',
  taskId: 'CHECK-PRINT-TASK',
  taskNo: 'CHECK-PRINT-TASK',
  processName: '印花',
  sourceFactoryName: '印花工厂',
  targetName: '中转区域',
  targetKind: 'WAREHOUSE',
  qtyUnit: '片',
  factoryId: 'CHECK-FACTORY',
  taskStatus: 'DONE',
  summaryStatus: 'NONE',
  recordCount: 0,
  pendingWritebackCount: 0,
  writtenBackQtyTotal: 0,
  objectionCount: 0,
  completionStatus: 'OPEN',
  qtyExpectedTotal: 1,
  qtyActualTotal: 0,
  qtyDiffTotal: 1,
  processBusinessCode: 'PRINT',
}
assert.equal(
  deriveHandoutObjectProfile(legacyHeadWithoutObjectFact, []).objectType,
  'MATERIAL',
  '缺少正式 BOM 对象事实的旧印花记录必须降级成原物料，不能由“片”单位猜成裁片',
)

const fabricPrintOrder = listPrintWorkOrders().find((order) => order.objectType === '面料')
assert(fabricPrintOrder, '印花加工单演示应至少包含一张面料 BOM 原物料加工单')
const warehouseSnapshot = captureProcessWarehouseMutationState()
try {
  const linkage = applyPrintWarehouseLinkageAfterAction({
    success: true,
    sourceType: 'PRINT',
    sourceId: fabricPrintOrder.printOrderId,
    taskId: fabricPrintOrder.taskId,
    actionCode: 'PRINT_FINISH_TRANSFER',
    previousStatus: 'TRANSFERRING',
    nextStatus: 'WAIT_HANDOVER',
    // 对抗性输入：调用方传入旧“裁片/片”值，也不能覆盖加工单绑定的正式 BOM 对象与单位。
    objectType: '裁片',
    objectQty: fabricPrintOrder.plannedQty,
    qtyUnit: '片',
  })
  const warehouse = getProcessWarehouseRecordById(linkage.createdWaitHandoverWarehouseRecordId)
  assert(warehouse, '印花完成后应生成待交出仓事实')
  assert.equal(warehouse.objectType, '面料', '印花仓对象必须读取加工单的正式 BOM 类别')
  assert.equal(warehouse.qtyUnit, fabricPrintOrder.qtyUnit, '印花仓单位必须读取加工单的正式 BOM 单位')
  assert.equal(warehouse.relatedFeiTicketIds.length, 0, '印花原物料不能绑定裁片菲票')
} finally {
  restoreProcessWarehouseMutationState(warehouseSnapshot)
}

for (const file of [
  'src/data/fcs/process-warehouse-domain.ts',
  'src/pages/process-factory/special-craft/warehouse.ts',
]) {
  const source = readFileSync(file, 'utf8')
  assert(!source.includes("includes('曲牙')"), `${file} 仍把历史“曲牙”当作曲牙绣`)
  assert(source.includes("includes('曲牙绣')"), `${file} 未按当前词条精确识别曲牙绣`)
}

console.log('裁片印花旧兼容清理专项检查通过：正式 BOM 对象优先、旧记录降级原物料、印花仓无裁片/菲票、曲牙绣精确识别。')
