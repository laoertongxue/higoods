import { getFactoryMasterRecordById } from './factory-master-store.ts'
import {
  createFactoryInternalWarehouseMutationSnapshot,
  findFactoryInternalWarehouseByFactoryAndKind,
  restoreFactoryInternalWarehouseMutationSnapshot,
  upsertFactoryWaitProcessStockItem,
  upsertFactoryWarehouseInboundRecord,
  upsertFactoryWarehouseOutboundRecord,
  type FactoryWaitProcessStockItem,
  type FactoryWarehouseInboundRecord,
  type FactoryWarehouseOutboundRecord,
} from './factory-internal-warehouse.ts'
import {
  capturePdaHandoverState,
  getPdaHandoverRecordsByHead,
  findPdaHandoverHead,
  restorePdaHandoverState,
  upsertPdaHandoutRecordMock,
  upsertPdaHandoverHeadMock,
  type PdaHandoverHead,
  type PdaHandoverRecord,
} from './pda-handover-events.ts'
import {
  captureProcessTaskStore,
  processTasks,
  restoreProcessTaskStore,
  updateKolGotoWholeOrderTaskExecution,
  type ProcessTask,
} from './process-tasks.ts'
import { productionOrders, type ProductionOrder } from './production-orders.ts'
import {
  KOL_GOTO_FACTORY_ID,
  KOL_GOTO_FACTORY_NAME,
} from './factory-mock-data.ts'
import { assertKolGotoWholeOrderTask, isKolGotoWholeOrderTask } from './kol-goto-special-flow.ts'
import {
  captureKolGotoFixedTotalLedgerStore,
  recordKolGotoFixedTotalTaskCompletion,
  restoreKolGotoFixedTotalLedgerStore,
} from './kol-goto-fixed-total-ledger.ts'

export interface KolGotoPickupLine {
  bomItemId: string
  materialType: '面料' | '辅料'
  materialCode: string
  materialName: string
  materialSpec: string
  materialImageUrl: string
  plannedQty: number
  pickedQty: number
  remainingQty: number
  unit: string
}

export interface KolGotoPickupBatch {
  pickupBatchId: string
  clientSubmissionId: string
  taskId: string
  productionOrderId: string
  lines: Array<Pick<KolGotoPickupLine, 'bomItemId' | 'materialCode' | 'materialName' | 'materialType' | 'unit'> & {
    pickupLineId: string
    pickupBatchId: string
    qty: number
  }>
  pickedAt: string
  pickedBy: string
  inboundRecordIds: string[]
  outboundRecordIds: string[]
}

const pickupBatches: KolGotoPickupBatch[] = []
let pickupFailureStepForTest: 'AFTER_INBOUND' | 'AFTER_STOCK' | 'AFTER_OUTBOUND' | null = null

export function setKolGotoPickupFailureStepForTest(
  step: 'AFTER_INBOUND' | 'AFTER_STOCK' | 'AFTER_OUTBOUND' | null,
): void {
  pickupFailureStepForTest = step
}

function roundQty(value: number): number {
  return Math.round(value * 100) / 100
}

function getKolGotoTask(taskId: string): ProcessTask {
  const task = processTasks.find((item) => item.taskId === taskId)
  assertKolGotoWholeOrderTask(task, 'KOL PDA 操作')
  return task as ProcessTask
}

function getKolGotoOrder(
  task: ProcessTask,
): ProductionOrder & { techPackSnapshot: NonNullable<ProductionOrder['techPackSnapshot']> } {
  const order = productionOrders.find((item) => item.productionOrderId === task.productionOrderId)
  if (!order?.techPackSnapshot) throw new Error('KOL 整单任务缺少冻结技术包，不能加工领料')
  return order as ProductionOrder & { techPackSnapshot: NonNullable<ProductionOrder['techPackSnapshot']> }
}

function getDefaultKolGotoWarehouseLocation() {
  const warehouse = findFactoryInternalWarehouseByFactoryAndKind(KOL_GOTO_FACTORY_ID, 'WAIT_PROCESS')
  const area = warehouse?.areaList[0]
  const shelf = area?.shelfList[0]
  const location = shelf?.locationList[0]
  if (!warehouse || !area || !shelf || !location) {
    throw new Error('KOL-GOTO 待加工仓默认库区库位不存在')
  }
  if (warehouse.areaList.length !== 1 || area.shelfList.length !== 1 || shelf.locationList.length !== 1) {
    throw new Error('KOL-GOTO 待加工仓只能维护一个默认库区、货架和库位')
  }
  return { warehouse, area, shelf, location }
}

export function listKolGotoPickupBatches(taskId?: string): KolGotoPickupBatch[] {
  return structuredClone(taskId ? pickupBatches.filter((item) => item.taskId === taskId) : pickupBatches)
}

export function listKolGotoPickupLines(taskId: string): KolGotoPickupLine[] {
  const task = getKolGotoTask(taskId)
  const order = getKolGotoOrder(task)
  const pickedByBom = new Map<string, number>()
  pickupBatches
    .filter((batch) => batch.taskId === taskId)
    .flatMap((batch) => batch.lines)
    .forEach((line) => pickedByBom.set(line.bomItemId, roundQty((pickedByBom.get(line.bomItemId) ?? 0) + line.qty)))
  const orderQty = order.demandSnapshot.skuLines.reduce((sum, line) => sum + line.qty, 0)

  return order.techPackSnapshot.bomItems
    .filter((item): item is typeof item & { type: '面料' | '辅料' } => item.type === '面料' || item.type === '辅料')
    .map((item, index) => {
      const plannedQty = roundQty(orderQty * item.unitConsumption * (1 + item.lossRate))
      const pickedQty = roundQty(pickedByBom.get(item.id) ?? 0)
      return {
        bomItemId: item.id,
        materialType: item.type,
        materialCode: item.materialCode || item.materialSkuId || item.id,
        materialName: item.name,
        materialSpec: item.spec,
        materialImageUrl: item.materialImageUrl || order.techPackSnapshot!.imageSnapshot.materialImages[index] || '',
        plannedQty,
        pickedQty,
        remainingQty: roundQty(Math.max(plannedQty - pickedQty, 0)),
        unit: item.unit || (item.type === '面料' ? '米' : '件'),
      }
    })
}

export function submitKolGotoPickup(input: {
  taskId: string
  quantities: Record<string, number>
  pickedAt: string
  pickedBy: string
  clientSubmissionId: string
}): KolGotoPickupBatch {
  const clientSubmissionId = input.clientSubmissionId.trim()
  if (!clientSubmissionId) throw new Error('加工领料提交标识不能为空')
  const task = getKolGotoTask(input.taskId)
  const replayed = pickupBatches.find(
    (batch) => batch.taskId === input.taskId && batch.clientSubmissionId === clientSubmissionId,
  )
  if (replayed) return structuredClone(replayed)
  if (task.status === 'DONE') throw new Error('KOL 整单任务已完成，不能继续加工领料')
  if (!input.pickedAt.trim() || !input.pickedBy.trim()) throw new Error('加工领料时间和操作人不能为空')
  const availableLines = listKolGotoPickupLines(input.taskId)
  if (availableLines.length === 0) throw new Error('冻结技术包没有面料或辅料 BOM，不能加工领料')
  const selectedLines = availableLines.flatMap((line) => {
    const inputQty = Number(input.quantities[line.bomItemId] ?? 0)
    if (!Number.isFinite(inputQty) || inputQty < 0) throw new Error(`${line.materialName} 领料数量无效`)
    if (inputQty === 0) return []
    const qty = roundQty(inputQty)
    if (qty <= 0) throw new Error(`${line.materialName} 领料数量按两位小数计量后必须大于 0`)
    if (qty > line.remainingQty) throw new Error(`${line.materialName} 本次最多可领 ${line.remainingQty} ${line.unit}`)
    return [{ ...line, qty }]
  })
  if (selectedLines.length === 0) throw new Error('请至少填写一项面料或辅料领料数量')

  const batchNo = pickupBatches.filter((item) => item.taskId === input.taskId).length + 1
  const pickupBatchId = `KOL-PICK-${input.taskId}-${String(batchNo).padStart(3, '0')}`
  const { warehouse, area, shelf, location } = getDefaultKolGotoWarehouseLocation()
  const factory = getFactoryMasterRecordById(KOL_GOTO_FACTORY_ID)
  if (!factory) throw new Error('KOL-GOTO 工厂档案不存在')
  const order = getKolGotoOrder(task)
  const warehouseSnapshot = createFactoryInternalWarehouseMutationSnapshot()
  const taskSnapshot = captureProcessTaskStore()
  const inboundRecordIds: string[] = []
  const outboundRecordIds: string[] = []

  try {
    selectedLines.forEach((line, index) => {
      const token = `${pickupBatchId}-${String(index + 1).padStart(2, '0')}`
      const pickupLineId = `KOL-PICK-LINE-${token}`
      const inboundRecordId = `INB-${token}`
      const outboundRecordId = `OUT-${token}`
      const common = {
        warehouseId: warehouse.warehouseId,
        warehouseName: warehouse.warehouseName,
        factoryId: KOL_GOTO_FACTORY_ID,
        factoryName: KOL_GOTO_FACTORY_NAME,
        factoryKind: factory.factoryType,
        processCode: task.processCode,
        processName: task.processNameZh,
        productionOrderId: order.productionOrderId,
        productionOrderNo: order.productionOrderNo,
        itemKind: line.materialType,
        itemName: line.materialName,
        materialSku: line.materialCode,
        unit: line.unit,
        photoList: line.materialImageUrl ? [line.materialImageUrl] : [],
      } as const
      const inbound: FactoryWarehouseInboundRecord = {
        ...common,
        inboundRecordId,
        inboundRecordNo: inboundRecordId,
        sourceRecordId: pickupLineId,
        sourceRecordNo: pickupLineId,
        sourceRecordType: 'KOL_PROCESSING_PICKUP',
        sourceObjectName: '加工领料',
        taskId: task.taskId,
        taskNo: task.taskNo,
        sourceType: 'PRODUCTION_ORDER',
        sourceSnapshot: {
          sourceType: 'PRODUCTION_ORDER',
          productionOrderId: order.productionOrderId,
          productionOrderNo: order.productionOrderNo,
          techPackVersionId: order.techPackSnapshot!.sourceTechPackVersionId,
          techPackVersionLabel: order.techPackSnapshot!.sourceTechPackVersionLabel,
          bomItemId: line.bomItemId,
        },
        expectedQty: line.qty,
        receivedQty: line.qty,
        differenceQty: 0,
        receiverName: input.pickedBy,
        receivedAt: input.pickedAt,
        areaName: area.areaName,
        shelfNo: shelf.shelfNo,
        locationNo: location.locationNo,
        status: '已入库',
        generatedStockItemId: `STOCK-${token}`,
        remark: '加工领料提交时自动入库；同一事务继续自动出库。',
      }
      const stock: FactoryWaitProcessStockItem = {
        ...common,
        stockItemId: `STOCK-${token}`,
        sourceRecordId: pickupLineId,
        sourceRecordNo: pickupLineId,
        sourceRecordType: 'KOL_PROCESSING_PICKUP',
        sourceObjectKind: '面辅料仓',
        sourceObjectName: '加工领料',
        taskId: task.taskId,
        taskNo: task.taskNo,
        sourceType: 'PRODUCTION_ORDER',
        sourceSnapshot: inbound.sourceSnapshot,
        expectedQty: line.qty,
        receivedQty: line.qty,
        availableQty: 0,
        issuedQty: line.qty,
        differenceQty: 0,
        receiverName: input.pickedBy,
        receivedAt: input.pickedAt,
        areaName: area.areaName,
        shelfNo: shelf.shelfNo,
        locationNo: location.locationNo,
        locationText: `${area.areaName} / ${shelf.shelfNo} / ${location.locationNo}`,
        status: '已领用',
        remark: '加工领料自动入库后立即出库，库存余额为 0。',
      }
      const outbound: FactoryWarehouseOutboundRecord = {
        ...common,
        outboundRecordId,
        outboundRecordNo: outboundRecordId,
        sourceTaskId: task.taskId,
        sourceTaskNo: task.taskNo,
        sourceRecordId: pickupLineId,
        sourceRecordNo: pickupLineId,
        sourceRecordType: 'KOL_PROCESSING_PICKUP',
        sourceObjectName: '加工领料',
        sourceType: 'PRODUCTION_ORDER',
        sourceSnapshot: inbound.sourceSnapshot,
        receiverKind: '加工任务',
        receiverName: task.taskNo || task.taskId,
        outboundQty: line.qty,
        operatorName: input.pickedBy,
        outboundAt: input.pickedAt,
        status: '已出库',
        remark: `加工领料自动从 ${area.areaName} / ${shelf.shelfNo} / ${location.locationNo} 出库。`,
      }
      upsertFactoryWarehouseInboundRecord(inbound)
      if (pickupFailureStepForTest === 'AFTER_INBOUND') throw new Error('KOL 加工领料入库后故障注入')
      upsertFactoryWaitProcessStockItem(stock)
      if (pickupFailureStepForTest === 'AFTER_STOCK') throw new Error('KOL 加工领料库存后故障注入')
      upsertFactoryWarehouseOutboundRecord(outbound)
      if (pickupFailureStepForTest === 'AFTER_OUTBOUND') throw new Error('KOL 加工领料出库后故障注入')
      inboundRecordIds.push(inboundRecordId)
      outboundRecordIds.push(outboundRecordId)
    })

    if (task.status === 'NOT_STARTED') {
      updateKolGotoWholeOrderTaskExecution(task.taskId, { status: 'IN_PROGRESS', startedAt: input.pickedAt }, {
        action: 'AUTO_START_ON_PICKUP',
        detail: `首次加工领料自动开工；领料批次 ${pickupBatchId}。`,
        at: input.pickedAt,
        by: input.pickedBy,
      })
    } else {
      updateKolGotoWholeOrderTaskExecution(task.taskId, {}, {
        action: 'MATERIAL_PICKUP',
        detail: `追加加工领料批次 ${pickupBatchId}。`,
        at: input.pickedAt,
        by: input.pickedBy,
      })
    }
  } catch (error) {
    restoreFactoryInternalWarehouseMutationSnapshot(warehouseSnapshot)
    restoreProcessTaskStore(taskSnapshot)
    throw error
  }

  const batch: KolGotoPickupBatch = {
    pickupBatchId,
    clientSubmissionId,
    taskId: task.taskId,
    productionOrderId: order.productionOrderId,
    lines: selectedLines.map((line, index) => ({
      pickupLineId: `KOL-PICK-LINE-${pickupBatchId}-${String(index + 1).padStart(2, '0')}`,
      pickupBatchId,
      bomItemId: line.bomItemId,
      materialCode: line.materialCode,
      materialName: line.materialName,
      materialType: line.materialType,
      unit: line.unit,
      qty: line.qty,
    })),
    pickedAt: input.pickedAt,
    pickedBy: input.pickedBy,
    inboundRecordIds,
    outboundRecordIds,
  }
  pickupBatches.push(batch)
  return structuredClone(batch)
}

function getKolGotoHandoutHeadId(taskId: string): string {
  return `HOH-KOL-${taskId}`
}

export function listKolGotoHandoutRecords(taskId: string): PdaHandoverRecord[] {
  return getPdaHandoverRecordsByHead(getKolGotoHandoutHeadId(taskId))
}

export function getKolGotoHandoutQty(taskId: string): number {
  return roundQty(
    listKolGotoHandoutRecords(taskId)
      .filter((record) => record.handoverRecordStatus !== 'VOIDED')
      .reduce((sum, record) => sum + Number(record.submittedQty || 0), 0),
  )
}

export function submitKolGotoHandout(input: {
  taskId: string
  qty: number
  submittedAt: string
  submittedBy: string
  remark?: string
  clientSubmissionId: string
}): PdaHandoverRecord {
  const clientSubmissionId = input.clientSubmissionId.trim()
  if (!clientSubmissionId) throw new Error('交出提交标识不能为空')
  const task = getKolGotoTask(input.taskId)
  const replayRecordId = `KOL-HOR-${input.taskId}-${clientSubmissionId.replace(/[^a-zA-Z0-9_-]+/g, '_')}`
  const replayed = listKolGotoHandoutRecords(input.taskId).find(
    (record) => record.recordId === replayRecordId,
  )
  if (replayed) return structuredClone(replayed)
  if (task.status === 'DONE') throw new Error('KOL 整单任务已完成，不能继续交出')
  if (task.status !== 'IN_PROGRESS') throw new Error('请先完成加工领料；首次领料会自动开工')
  if (!Number.isFinite(input.qty) || input.qty <= 0) throw new Error('本次交出数量必须大于 0')
  const submittedQty = roundQty(input.qty)
  if (submittedQty <= 0) throw new Error('本次交出数量按两位小数计量后必须大于 0')
  const handedQty = getKolGotoHandoutQty(task.taskId)
  const remainingQty = roundQty(task.qty - handedQty)
  if (submittedQty > remainingQty) throw new Error(`本次最多可交出 ${remainingQty} ${task.qtyDisplayUnit || '件'}`)
  if (!input.submittedAt.trim() || !input.submittedBy.trim()) throw new Error('交出时间和操作人不能为空')

  const headId = getKolGotoHandoutHeadId(task.taskId)
  const existingHead = findPdaHandoverHead(headId)
  const sequenceNo = listKolGotoHandoutRecords(task.taskId).length + 1
  const handoverSnapshot = capturePdaHandoverState()
  const taskSnapshot = captureProcessTaskStore()
  try {
    if (!existingHead) {
      const head: PdaHandoverHead = {
        handoverId: headId,
        handoverOrderId: headId,
        headType: 'HANDOUT',
        qrCodeValue: `HANDOVER-ORDER:${headId}`,
        taskId: task.taskId,
        sourceTaskId: task.taskId,
        taskNo: task.taskNo || task.taskId,
        sourceTaskNo: task.taskNo || task.taskId,
        productionOrderId: task.productionOrderId,
        productionOrderNo: task.productionOrderNo || task.productionOrderId,
        processName: task.processNameZh,
        sourceFactoryName: KOL_GOTO_FACTORY_NAME,
        sourceFactoryId: KOL_GOTO_FACTORY_ID,
        targetName: task.receiverName || '成衣接收方',
        targetKind: 'WAREHOUSE',
        receiverKind: 'WAREHOUSE',
        receiverId: task.receiverId || 'KOL-GARMENT-RECEIVER',
        receiverName: task.receiverName || '成衣接收方',
        qtyUnit: task.qtyDisplayUnit || '件',
        factoryId: KOL_GOTO_FACTORY_ID,
        taskStatus: 'IN_PROGRESS',
        summaryStatus: 'NONE',
        recordCount: 0,
        pendingWritebackCount: 0,
        submittedQtyTotal: 0,
        writtenBackQtyTotal: 0,
        objectionCount: 0,
        plannedQty: task.qty,
        completionStatus: 'OPEN',
        qtyExpectedTotal: task.qty,
        qtyActualTotal: 0,
        qtyDiffTotal: task.qty,
        scopeLabel: 'KOL 整单成衣交出',
        stageCode: 'PROD',
        stageName: '整单生产',
        processBusinessCode: task.processBusinessCode,
        processBusinessName: task.processBusinessName,
        taskTypeCode: 'WHOLE_ORDER_TASK',
        taskTypeLabel: 'KOL整单任务',
        assignmentGranularity: 'ORDER',
        assignmentGranularityLabel: '整单',
      }
      upsertPdaHandoverHeadMock(head)
    }

    const recordId = replayRecordId || `KOL-HOR-${task.taskId}-${String(sequenceNo).padStart(3, '0')}`
    const record = upsertPdaHandoutRecordMock({
      recordId,
      handoverRecordId: recordId,
      handoverRecordNo: recordId,
      handoverId: headId,
      handoverOrderId: headId,
      taskId: task.taskId,
      sourceTaskId: task.taskId,
      productionOrderId: task.productionOrderId,
      productionOrderNo: task.productionOrderNo || task.productionOrderId,
      sequenceNo,
      handoutObjectType: 'GARMENT',
      objectType: 'FINISHED_GARMENT',
      handoutItemLabel: `KOL 整单成衣 / 第 ${sequenceNo} 次 / ${submittedQty} ${task.qtyDisplayUnit || '件'}`,
      materialCode: task.productionOrderId,
      materialName: 'KOL 整单成衣',
      materialSpec: task.saleTypeSnapshot,
      plannedQty: task.qty,
      submittedQty,
      qtyUnit: task.qtyDisplayUnit || '件',
      factorySubmittedAt: input.submittedAt,
      factorySubmittedBy: input.submittedBy,
      factorySubmittedByKind: 'FACTORY',
      factoryRemark: input.remark?.trim() || 'KOL-GOTO 发起交出；交出数量同时计入已加工数量。',
      factoryProofFiles: [],
      receiverWrittenQty: submittedQty,
      receiverWrittenAt: input.submittedAt,
      receiverWrittenBy: '系统自动计入',
      receiverRemark: 'KOL-GOTO 特殊流程：发起交出即直接计入已加工和已交出数量，无需仓管确认。',
      status: 'WRITTEN_BACK',
      handoverRecordStatus: 'WRITTEN_BACK_MATCHED',
      lifecycleUpdatedAt: input.submittedAt,
      handoverRecordQrValue: `HANDOVER-RECORD:${recordId}`,
    })
    const submittedQtyTotal = roundQty(handedQty + submittedQty)
    const currentHead = findPdaHandoverHead(headId)
    if (!currentHead) throw new Error('KOL 交出单头创建失败')
    upsertPdaHandoverHeadMock({
      ...currentHead,
      summaryStatus: 'WRITTEN_BACK',
      handoverOrderStatus: submittedQtyTotal === task.qty ? 'WRITTEN_BACK' : 'PARTIAL_WRITTEN_BACK',
      recordCount: sequenceNo,
      pendingWritebackCount: 0,
      submittedQtyTotal,
      writtenBackQtyTotal: submittedQtyTotal,
      lastRecordAt: input.submittedAt,
      qtyActualTotal: submittedQtyTotal,
      qtyDiffTotal: roundQty(task.qty - submittedQtyTotal),
    })
    updateKolGotoWholeOrderTaskExecution(task.taskId, {
      handoverOrderId: headId,
      handoverStatus: 'PARTIAL_SUBMITTED',
    }, {
      action: 'HANDOUT_AND_PROCESS',
      detail: `第 ${sequenceNo} 次交出 ${submittedQty} ${task.qtyDisplayUnit || '件'}；交出数量自动计为加工完成数量。`,
      at: input.submittedAt,
      by: input.submittedBy,
    })
    return record
  } catch (error) {
    restorePdaHandoverState(handoverSnapshot)
    restoreProcessTaskStore(taskSnapshot)
    throw error
  }
}

export function completeKolGotoWholeOrderTask(input: {
  taskId: string
  completedAt: string
  completedBy: string
}): ProcessTask {
  const task = getKolGotoTask(input.taskId)
  const order = getKolGotoOrder(task)
  if (task.status === 'DONE') {
    recordKolGotoFixedTotalTaskCompletion({
      taskId: task.taskId,
      taskNo: task.taskNo || task.taskId,
      productionOrderId: order.productionOrderId,
      productionOrderNo: order.productionOrderNo,
      completedAt: task.finishedAt || input.completedAt,
      fixedTotalPrice: Number(task.fixedTotalPrice || 0),
      currency: task.fixedTotalPriceCurrency || 'IDR',
    })
    return structuredClone(task)
  }
  const handedQty = getKolGotoHandoutQty(task.taskId)
  if (handedQty !== task.qty) {
    throw new Error(`累计交出 ${handedQty} ${task.qtyDisplayUnit || '件'}，需达到任务数量 ${task.qty} 后才能完成`)
  }
  if (!input.completedAt.trim() || !input.completedBy.trim()) throw new Error('完成时间和操作人不能为空')
  const headId = getKolGotoHandoutHeadId(task.taskId)
  const head = findPdaHandoverHead(headId)
  if (!head) throw new Error('尚未发起交出，不能完成任务')
  const handoverSnapshot = capturePdaHandoverState()
  const taskSnapshot = captureProcessTaskStore()
  const settlementSnapshot = captureKolGotoFixedTotalLedgerStore()
  try {
    upsertPdaHandoverHeadMock({
      ...head,
      taskStatus: 'DONE',
      completionStatus: 'COMPLETED',
      factoryMarkedComplete: true,
      factoryMarkedCompleteAt: input.completedAt,
      receiverClosedAt: input.completedAt,
      summaryStatus: 'WRITTEN_BACK',
      handoverOrderStatus: 'CLOSED',
      pendingWritebackCount: 0,
      submittedQtyTotal: task.qty,
      writtenBackQtyTotal: task.qty,
      qtyActualTotal: task.qty,
      qtyDiffTotal: 0,
    })
    const completedTask = updateKolGotoWholeOrderTaskExecution(task.taskId, {
      status: 'DONE',
      finishedAt: input.completedAt,
      handoverStatus: 'CLOSED',
    }, {
      action: 'FINISH_TASK',
      detail: `累计交出 ${handedQty} ${task.qtyDisplayUnit || '件'}，整单任务完成；无需等待仓管确认。`,
      at: input.completedAt,
      by: input.completedBy,
    })
    recordKolGotoFixedTotalTaskCompletion({
      taskId: completedTask.taskId,
      taskNo: completedTask.taskNo || completedTask.taskId,
      productionOrderId: order.productionOrderId,
      productionOrderNo: order.productionOrderNo,
      completedAt: input.completedAt,
      fixedTotalPrice: Number(completedTask.fixedTotalPrice || 0),
      currency: completedTask.fixedTotalPriceCurrency || 'IDR',
    })
    return completedTask
  } catch (error) {
    restorePdaHandoverState(handoverSnapshot)
    restoreProcessTaskStore(taskSnapshot)
    restoreKolGotoFixedTotalLedgerStore(settlementSnapshot)
    throw error
  }
}

export function listKolGotoTasks(): ProcessTask[] {
  return processTasks.filter((task) => isKolGotoWholeOrderTask(task)).map((task) => structuredClone(task))
}

function submitSeedPickup(taskId: string, clientSubmissionId: string, pickedAt: string): void {
  const lines = listKolGotoPickupLines(taskId)
  const line = lines.find((item) => item.remainingQty >= 1)
  if (!line) return
  submitKolGotoPickup({
    taskId,
    quantities: { [line.bomItemId]: 1 },
    pickedAt,
    pickedBy: 'KOL-GOTO 演示操作员',
    clientSubmissionId,
  })
}

let kolGotoPdaScenariosSeeded = false

export function ensureKolGotoPdaScenarios(): void {
  if (kolGotoPdaScenariosSeeded) return
  const taskByOrderId = new Map(listKolGotoTasks().map((task) => [task.productionOrderId, task]))
  const repeatedPickupTask = taskByOrderId.get('PO-202603-0005')
  if (repeatedPickupTask && repeatedPickupTask.status !== 'DONE') {
    submitSeedPickup(repeatedPickupTask.taskId, 'SEED-PICKUP-001', '2026-08-18 08:10:00')
    submitSeedPickup(repeatedPickupTask.taskId, 'SEED-PICKUP-002', '2026-08-18 10:20:00')
  }

  const repeatedHandoutTask = taskByOrderId.get('PO-202603-0009')
  if (repeatedHandoutTask && repeatedHandoutTask.status !== 'DONE') {
    submitSeedPickup(repeatedHandoutTask.taskId, 'SEED-PICKUP-003', '2026-08-18 08:30:00')
    submitKolGotoHandout({
      taskId: repeatedHandoutTask.taskId,
      qty: 120,
      submittedAt: '2026-08-18 13:00:00',
      submittedBy: 'KOL-GOTO 演示操作员',
      clientSubmissionId: 'SEED-HANDOUT-001',
    })
    submitKolGotoHandout({
      taskId: repeatedHandoutTask.taskId,
      qty: 180,
      submittedAt: '2026-08-18 16:00:00',
      submittedBy: 'KOL-GOTO 演示操作员',
      clientSubmissionId: 'SEED-HANDOUT-002',
    })
  }

  const completedTask = taskByOrderId.get('PO-202603-081')
  if (completedTask) {
    if (completedTask.status !== 'DONE') {
      submitSeedPickup(completedTask.taskId, 'SEED-PICKUP-004', '2026-08-17 08:20:00')
      const firstQty = Math.floor(completedTask.qty * 0.4)
      submitKolGotoHandout({
        taskId: completedTask.taskId,
        qty: firstQty,
        submittedAt: '2026-08-18 11:10:00',
        submittedBy: 'KOL-GOTO 演示操作员',
        clientSubmissionId: 'SEED-HANDOUT-003',
      })
      submitKolGotoHandout({
        taskId: completedTask.taskId,
        qty: completedTask.qty - firstQty,
        submittedAt: '2026-08-18 17:30:00',
        submittedBy: 'KOL-GOTO 演示操作员',
        clientSubmissionId: 'SEED-HANDOUT-004',
      })
    }
    completeKolGotoWholeOrderTask({
      taskId: completedTask.taskId,
      completedAt: '2026-08-18 17:35:00',
      completedBy: 'KOL-GOTO 演示操作员',
    })
  }
  kolGotoPdaScenariosSeeded = true
}

ensureKolGotoPdaScenarios()
