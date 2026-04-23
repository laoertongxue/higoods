import { mockFactories } from './factory-mock-data.ts'
import type { Factory } from './factory-types.ts'
import {
  buildFactoryWaitHandoverStockItemFromOutboundRecord,
  buildFactoryWaitProcessStockItemFromInboundRecord,
  buildInboundRecordFromHandoverReceive,
  buildInboundRecordFromPickup,
  buildOutboundRecordFromHandoverRecord,
  decreasePendingFactoryWaitHandoverQty,
  findFactoryInternalWarehouseByFactoryAndKind,
  findFactoryWaitHandoverStockItemByHandoverRecordId,
  findPendingFactoryWaitHandoverStockItemByOrderId,
  findFactoryWarehouseOutboundRecordByHandoverRecordId,
  upsertFactoryWaitHandoverStockItem,
  upsertFactoryWaitProcessStockItem,
  upsertFactoryWarehouseInboundRecord,
  upsertFactoryWarehouseOutboundRecord,
  type FactoryInboundRecordStatus,
  type FactoryInternalWarehouse,
  type FactoryOutboundRecordStatus,
  type FactoryWaitHandoverStockItem,
  type FactoryWaitProcessStockItem,
  type FactoryWarehouseInboundRecord,
  type FactoryWarehouseOutboundRecord,
} from './factory-internal-warehouse.ts'
import {
  findPdaHandoverHead,
  findPdaHandoverRecord,
  findPdaPickupHead,
  findPdaPickupRecord,
  getHandoverOrderById,
  getPdaHeadSourceExecutionDoc,
} from './pda-handover-events.ts'
import { getRecordDiffQty } from './task-handover-domain.ts'
import type { WarehouseIssueOrder } from './warehouse-material-execution.ts'

const NORMAL_AREA_NAMES = ['A区', 'B区', 'C区', 'D区', 'E区', 'F区'] as const

function roundQty(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(Number(value) * 100) / 100
}

function hashCode(text: string): number {
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

function resolveFactory(input: { factoryId?: string; factoryName?: string }): Factory {
  const byId = input.factoryId ? mockFactories.find((factory) => factory.id === input.factoryId) : undefined
  if (byId) return byId
  const byName = input.factoryName ? mockFactories.find((factory) => factory.name === input.factoryName) : undefined
  if (byName) return byName
  throw new Error('未找到工厂内部仓所属工厂')
}

function resolveWarehouse(factoryId: string, warehouseKind: FactoryInternalWarehouse['warehouseKind']): FactoryInternalWarehouse {
  const warehouse = findFactoryInternalWarehouseByFactoryAndKind(factoryId, warehouseKind)
  if (!warehouse) {
    throw new Error(warehouseKind === 'WAIT_PROCESS' ? '未找到待加工仓' : '未找到待交出仓')
  }
  return warehouse
}

function pickWarehousePosition(
  warehouse: FactoryInternalWarehouse,
  status: '待领料' | '已入待加工仓' | '差异待处理' | '待交出' | '已交出' | '已回写' | '差异' | '异议中',
  seed: string,
): { areaName: string; shelfNo: string; locationNo: string; locationText: string } {
  const preferredAreaName =
    status === '差异待处理' || status === '差异' || status === '异议中'
      ? '异常区'
      : status === '待领料' || status === '已交出'
        ? '待确认区'
        : NORMAL_AREA_NAMES[hashCode(seed) % NORMAL_AREA_NAMES.length]
  const area = warehouse.areaList.find((item) => item.areaName === preferredAreaName) || warehouse.areaList[0]
  const shelf = area.shelfList[0]
  const location = shelf.locationList[hashCode(seed) % shelf.locationList.length]
  return {
    areaName: area.areaName,
    shelfNo: shelf.shelfNo,
    locationNo: location.locationNo,
    locationText: `${area.areaName} / ${shelf.shelfNo} / ${location.locationNo}`,
  }
}

function resolvePickupBuilderBase(
  pickupRecordId: string,
  factory: Factory,
  warehouse: FactoryInternalWarehouse,
): FactoryWarehouseInboundRecord | null {
  const pickupHead = findPdaPickupHead(findPdaPickupRecord(pickupRecordId)?.handoverId || '')
  const sourceDoc = pickupHead ? getPdaHeadSourceExecutionDoc(pickupHead.handoverId) : undefined
  if (!pickupHead || !sourceDoc || sourceDoc.docType !== 'ISSUE') return null
  const pickupRecord = findPdaPickupRecord(pickupRecordId)
  if (!pickupRecord) return null
  const issueDoc = sourceDoc as WarehouseIssueOrder
  const lineIndex = Math.max(Math.min((pickupRecord.sequenceNo || 1) - 1, issueDoc.lines.length - 1), 0)
  const line = issueDoc.lines[lineIndex]
  if (!line) return null
  return buildInboundRecordFromPickup(issueDoc, line, factory, warehouse, lineIndex)
}

export function linkPickupConfirmToInboundRecord(input: {
  pickupRecordId: string
  pickupRecordNo?: string
  factoryId?: string
  factoryName?: string
  taskId?: string
  taskNo?: string
  sourceObjectName?: string
  itemKind?: FactoryWaitProcessStockItem['itemKind']
  itemName?: string
  materialSku?: string
  partName?: string
  fabricColor?: string
  sizeCode?: string
  feiTicketNo?: string
  transferBagNo?: string
  fabricRollNo?: string
  expectedQty?: number
  receivedQty?: number
  unit?: string
  receiverName?: string
  receivedAt?: string
  photoList?: string[]
  abnormalReason?: string
}): {
  inboundRecord: FactoryWarehouseInboundRecord
  waitProcessStockItem: FactoryWaitProcessStockItem
} {
  const pickupRecord = findPdaPickupRecord(input.pickupRecordId)
  if (!pickupRecord) {
    throw new Error(`未找到待领料记录：${input.pickupRecordId}`)
  }
  const pickupHead = findPdaPickupHead(pickupRecord.handoverId)
  const factory = resolveFactory({
    factoryId: input.factoryId || pickupHead?.factoryId,
    factoryName: input.factoryName || pickupHead?.targetName,
  })
  const warehouse = resolveWarehouse(factory.id, 'WAIT_PROCESS')
  const builderBase = resolvePickupBuilderBase(input.pickupRecordId, factory, warehouse)
  const expectedQty = roundQty(input.expectedQty ?? pickupRecord.qtyExpected)
  const receivedQty = roundQty(
    input.receivedQty
      ?? pickupRecord.factoryConfirmedQty
      ?? pickupRecord.qtyActual
      ?? pickupRecord.factoryReportedQty
      ?? pickupRecord.warehouseHandedQty,
  )
  const differenceQty = roundQty(receivedQty - expectedQty)
  const status: FactoryInboundRecordStatus = differenceQty !== 0 ? '差异待处理' : '已入库'
  const baseRecord =
    builderBase
    || ({
      inboundRecordId: `INB-${pickupRecord.recordId}`,
      inboundRecordNo: `RK-${input.pickupRecordNo || pickupRecord.recordId}`,
      warehouseId: warehouse.warehouseId,
      warehouseName: warehouse.warehouseName,
      factoryId: factory.id,
      factoryName: factory.name,
      factoryKind: factory.factoryType,
      sourceRecordId: pickupRecord.recordId,
      sourceRecordNo: input.pickupRecordNo || pickupRecord.recordId,
      sourceRecordType: 'MATERIAL_PICKUP',
      sourceObjectName: input.sourceObjectName || pickupHead?.sourceFactoryName || '面辅料仓',
      taskId: input.taskId || pickupRecord.taskId,
      taskNo: input.taskNo || pickupHead?.taskNo,
      itemKind: input.itemKind || '面料',
      itemName: input.itemName || pickupRecord.materialName || pickupRecord.materialSummary,
      materialSku: input.materialSku || pickupRecord.materialCode || pickupRecord.skuCode,
      partName: input.partName || pickupRecord.pieceName,
      fabricColor: input.fabricColor || pickupRecord.skuColor,
      sizeCode: input.sizeCode || pickupRecord.skuSize,
      feiTicketNo: input.feiTicketNo,
      transferBagNo: input.transferBagNo,
      fabricRollNo: input.fabricRollNo || pickupRecord.materialSpec,
      expectedQty,
      receivedQty,
      differenceQty,
      unit: input.unit || pickupRecord.qtyUnit,
      receiverName: input.receiverName || factory.name,
      receivedAt: input.receivedAt || pickupRecord.factoryConfirmedAt || pickupRecord.receivedAt || pickupRecord.submittedAt,
      areaName: '',
      shelfNo: '',
      locationNo: '',
      status,
      abnormalReason: input.abnormalReason,
      photoList: [...(input.photoList || [])],
      remark: '由领料记录生成',
    } satisfies FactoryWarehouseInboundRecord)
  const position = pickWarehousePosition(warehouse, status === '已入库' ? '已入待加工仓' : '差异待处理', pickupRecord.recordId)
  const inboundRecord: FactoryWarehouseInboundRecord = {
    ...baseRecord,
    inboundRecordId: `INB-${pickupRecord.recordId}`,
    inboundRecordNo: baseRecord.inboundRecordNo || `RK-${pickupRecord.recordId}`,
    warehouseId: warehouse.warehouseId,
    warehouseName: warehouse.warehouseName,
    factoryId: factory.id,
    factoryName: factory.name,
    factoryKind: factory.factoryType,
    sourceRecordId: pickupRecord.recordId,
    sourceRecordNo: input.pickupRecordNo || pickupRecord.recordId,
    sourceRecordType: 'MATERIAL_PICKUP',
    sourceObjectName: input.sourceObjectName || baseRecord.sourceObjectName,
    taskId: input.taskId || baseRecord.taskId || pickupRecord.taskId,
    taskNo: input.taskNo || baseRecord.taskNo || pickupHead?.taskNo,
    itemKind: input.itemKind || baseRecord.itemKind,
    itemName: input.itemName || baseRecord.itemName,
    materialSku: input.materialSku || baseRecord.materialSku,
    partName: input.partName || baseRecord.partName,
    fabricColor: input.fabricColor || baseRecord.fabricColor,
    sizeCode: input.sizeCode || baseRecord.sizeCode,
    feiTicketNo: input.feiTicketNo || baseRecord.feiTicketNo,
    transferBagNo: input.transferBagNo || baseRecord.transferBagNo,
    fabricRollNo: input.fabricRollNo || baseRecord.fabricRollNo,
    expectedQty,
    receivedQty,
    differenceQty,
    unit: input.unit || baseRecord.unit,
    receiverName: input.receiverName || baseRecord.receiverName || factory.name,
    receivedAt: input.receivedAt || baseRecord.receivedAt,
    areaName: position.areaName,
    shelfNo: position.shelfNo,
    locationNo: position.locationNo,
    status,
    abnormalReason:
      differenceQty !== 0
        ? input.abnormalReason || pickupRecord.objectionReason || '数量不符'
        : undefined,
    photoList: [...(input.photoList || pickupRecord.objectionProofFiles?.map((file) => file.name) || [])],
    remark: '由领料记录生成',
  }
  const savedInbound = upsertFactoryWarehouseInboundRecord(inboundRecord)
  const waitProcessStockItem = upsertFactoryWaitProcessStockItem({
    ...buildFactoryWaitProcessStockItemFromInboundRecord(savedInbound),
    stockItemId: `WPS-${pickupRecord.recordId}`,
    sourceRecordId: pickupRecord.recordId,
    sourceRecordNo: input.pickupRecordNo || pickupRecord.recordId,
    status: differenceQty !== 0 ? '差异待处理' : '已入待加工仓',
    abnormalReason: savedInbound.abnormalReason,
    photoList: [...savedInbound.photoList],
    locationText: position.locationText,
  })
  const linkedInbound = upsertFactoryWarehouseInboundRecord({
    ...savedInbound,
    generatedStockItemId: waitProcessStockItem.stockItemId,
  })
  return {
    inboundRecord: linkedInbound,
    waitProcessStockItem,
  }
}

export function linkHandoverReceiveToInboundRecord(input: {
  handoverOrderId?: string
  handoverRecordId: string
  factoryId: string
  factoryName?: string
  receiverWrittenQty?: number
  sourceFactoryName?: string
  itemKind?: FactoryWaitProcessStockItem['itemKind']
  itemName?: string
  materialSku?: string
  partName?: string
  fabricColor?: string
  sizeCode?: string
  feiTicketNo?: string
  transferBagNo?: string
  fabricRollNo?: string
  unit?: string
  receivedAt?: string
  receiverName?: string
  abnormalReason?: string
  photoList?: string[]
}): {
  inboundRecord: FactoryWarehouseInboundRecord
  waitProcessStockItem: FactoryWaitProcessStockItem
} {
  const record = findPdaHandoverRecord(input.handoverRecordId)
  if (!record) {
    throw new Error(`未找到交出记录：${input.handoverRecordId}`)
  }
  const head =
    (input.handoverOrderId ? getHandoverOrderById(input.handoverOrderId) : undefined)
    || findPdaHandoverHead(record.handoverId)
  if (!head) {
    throw new Error('未找到交出单')
  }
  const factory = resolveFactory({ factoryId: input.factoryId, factoryName: input.factoryName || head.receiverName || head.targetName })
  const warehouse = resolveWarehouse(factory.id, 'WAIT_PROCESS')
  const builderBase = buildInboundRecordFromHandoverReceive(head, record, factory, warehouse, Math.max((record.sequenceNo || 1) - 1, 0))
  const expectedQty = roundQty(record.submittedQty ?? record.plannedQty)
  const receivedQty = roundQty(input.receiverWrittenQty ?? record.receiverWrittenQty)
  const differenceQty = roundQty(receivedQty - expectedQty)
  const status: FactoryInboundRecordStatus = differenceQty !== 0 ? '差异待处理' : '已入库'
  const position = pickWarehousePosition(warehouse, status === '已入库' ? '已入待加工仓' : '差异待处理', record.recordId)
  const inboundRecord: FactoryWarehouseInboundRecord = {
    ...builderBase,
    inboundRecordId: `INB-${record.handoverRecordId || record.recordId}`,
    inboundRecordNo: builderBase.inboundRecordNo || `RK-${record.handoverRecordNo || record.recordId}`,
    warehouseId: warehouse.warehouseId,
    warehouseName: warehouse.warehouseName,
    factoryId: factory.id,
    factoryName: factory.name,
    factoryKind: factory.factoryType,
    sourceRecordId: record.handoverRecordId || record.recordId,
    sourceRecordNo: record.handoverRecordNo || head.handoverOrderNo || head.handoverId,
    sourceRecordType: 'HANDOVER_RECEIVE',
    sourceObjectName: input.sourceFactoryName || head.sourceFactoryName,
    taskId: head.taskId,
    taskNo: head.taskNo,
    itemKind: input.itemKind || builderBase.itemKind,
    itemName: input.itemName || builderBase.itemName,
    materialSku: input.materialSku || builderBase.materialSku,
    partName: input.partName || builderBase.partName,
    fabricColor: input.fabricColor || builderBase.fabricColor,
    sizeCode: input.sizeCode || builderBase.sizeCode,
    feiTicketNo: input.feiTicketNo || builderBase.feiTicketNo,
    transferBagNo: input.transferBagNo || builderBase.transferBagNo,
    fabricRollNo: input.fabricRollNo || builderBase.fabricRollNo,
    expectedQty,
    receivedQty,
    differenceQty,
    unit: input.unit || builderBase.unit,
    receiverName: input.receiverName || factory.name,
    receivedAt: input.receivedAt || record.receiverWrittenAt || record.factorySubmittedAt,
    areaName: position.areaName,
    shelfNo: position.shelfNo,
    locationNo: position.locationNo,
    status,
    abnormalReason:
      differenceQty !== 0
        ? input.abnormalReason || record.diffReason || '数量不符'
        : undefined,
    photoList: [...(input.photoList || record.receiverProofFiles?.map((file) => file.name) || [])],
    remark: '由交出接收生成',
  }
  const savedInbound = upsertFactoryWarehouseInboundRecord(inboundRecord)
  const waitProcessStockItem = upsertFactoryWaitProcessStockItem({
    ...buildFactoryWaitProcessStockItemFromInboundRecord(savedInbound),
    stockItemId: `WPS-${record.handoverRecordId || record.recordId}`,
    sourceRecordId: record.handoverRecordId || record.recordId,
    sourceRecordNo: record.handoverRecordNo || head.handoverOrderNo || head.handoverId,
    status: differenceQty !== 0 ? '差异待处理' : '已入待加工仓',
    abnormalReason: savedInbound.abnormalReason,
    photoList: [...savedInbound.photoList],
    locationText: position.locationText,
  })
  const linkedInbound = upsertFactoryWarehouseInboundRecord({
    ...savedInbound,
    generatedStockItemId: waitProcessStockItem.stockItemId,
  })
  return {
    inboundRecord: linkedInbound,
    waitProcessStockItem,
  }
}

export function linkTaskCompletionToWaitHandoverStock(input: {
  taskId?: string
  taskNo?: string
  factoryId: string
  factoryName?: string
  productionOrderId?: string
  productionOrderNo?: string
  handoverOrderId?: string
  handoverOrderNo?: string
  itemKind: FactoryWaitHandoverStockItem['itemKind']
  itemName: string
  materialSku?: string
  partName?: string
  fabricColor?: string
  sizeCode?: string
  feiTicketNo?: string
  transferBagNo?: string
  fabricRollNo?: string
  completedQty: number
  lossQty?: number
  alreadyHandoverQty?: number
  unit: string
  receiverKind: FactoryWaitHandoverStockItem['receiverKind']
  receiverName: string
  completedAt?: string
}): {
  waitHandoverStockItem: FactoryWaitHandoverStockItem
} {
  const factory = resolveFactory({ factoryId: input.factoryId, factoryName: input.factoryName })
  const warehouse = resolveWarehouse(factory.id, 'WAIT_HANDOVER')
  const existingPending = input.handoverOrderId
    ? findPendingFactoryWaitHandoverStockItemByOrderId(input.handoverOrderId)
    : undefined
  const waitHandoverQty = roundQty(
    Math.max((input.completedQty || 0) - (input.lossQty || 0) - (input.alreadyHandoverQty || 0), 0),
  )
  const seed = `${input.taskId || input.productionOrderId || input.itemName}-${input.partName || input.materialSku || ''}`
  const position = existingPending
    ? {
      areaName: existingPending.areaName,
      shelfNo: existingPending.shelfNo,
      locationNo: existingPending.locationNo,
      locationText: existingPending.locationText,
    }
    : pickWarehousePosition(warehouse, '待交出', seed)
  const stockItemId = existingPending?.stockItemId || `WHS-TASK-${input.taskId || input.productionOrderId || hashCode(seed)}`
  const waitHandoverStockItem = upsertFactoryWaitHandoverStockItem({
    stockItemId,
    warehouseId: warehouse.warehouseId,
    factoryId: factory.id,
    factoryName: factory.name,
    factoryKind: factory.factoryType,
    warehouseName: warehouse.warehouseName,
    taskId: input.taskId,
    taskNo: input.taskNo,
    productionOrderId: input.productionOrderId,
    productionOrderNo: input.productionOrderNo,
    itemKind: input.itemKind,
    itemName: input.itemName,
    materialSku: input.materialSku,
    partName: input.partName,
    fabricColor: input.fabricColor,
    sizeCode: input.sizeCode,
    feiTicketNo: input.feiTicketNo,
    transferBagNo: input.transferBagNo,
    fabricRollNo: input.fabricRollNo,
    completedQty: roundQty(input.completedQty),
    lossQty: roundQty(input.lossQty),
    waitHandoverQty,
    unit: input.unit,
    receiverKind: input.receiverKind,
    receiverName: input.receiverName,
    handoverOrderId: input.handoverOrderId,
    handoverOrderNo: input.handoverOrderNo,
    areaName: position.areaName,
    shelfNo: position.shelfNo,
    locationNo: position.locationNo,
    locationText: position.locationText,
    status: '待交出',
    photoList: [],
    remark: '由任务完工生成',
  })
  return { waitHandoverStockItem }
}

export function linkHandoverRecordToOutboundRecord(input: {
  handoverOrderId: string
  handoverOrderNo?: string
  handoverRecordId: string
  handoverRecordNo?: string
  handoverRecordQrValue?: string
  taskId?: string
  taskNo?: string
  factoryId?: string
  factoryName?: string
  receiverKind?: FactoryWaitHandoverStockItem['receiverKind']
  receiverName?: string
  itemKind?: FactoryWaitHandoverStockItem['itemKind']
  itemName?: string
  materialSku?: string
  partName?: string
  fabricColor?: string
  sizeCode?: string
  feiTicketNo?: string
  transferBagNo?: string
  fabricRollNo?: string
  submittedQty?: number
  unit?: string
  operatorName?: string
  submittedAt?: string
}): {
  outboundRecord: FactoryWarehouseOutboundRecord
  updatedWaitHandoverStockItem: FactoryWaitHandoverStockItem
} {
  const record = findPdaHandoverRecord(input.handoverRecordId)
  if (!record) {
    throw new Error(`未找到交出记录：${input.handoverRecordId}`)
  }
  const head = getHandoverOrderById(input.handoverOrderId) || findPdaHandoverHead(record.handoverId)
  if (!head) {
    throw new Error('未找到交出单')
  }
  const factory = resolveFactory({
    factoryId: input.factoryId || head.factoryId,
    factoryName: input.factoryName || head.sourceFactoryName,
  })
  const warehouse = resolveWarehouse(factory.id, 'WAIT_HANDOVER')
  const outboundQty = roundQty(input.submittedQty ?? record.submittedQty ?? record.plannedQty)
  const builderBase = buildOutboundRecordFromHandoverRecord(head, record, factory, warehouse, Math.max((record.sequenceNo || 1) - 1, 0))
  const outboundRecord: FactoryWarehouseOutboundRecord = {
    ...builderBase,
    outboundRecordId: `OUT-${record.handoverRecordId || record.recordId}`,
    outboundRecordNo: builderBase.outboundRecordNo || `CK-${input.handoverRecordNo || record.handoverRecordNo || record.recordId}`,
    warehouseId: warehouse.warehouseId,
    warehouseName: warehouse.warehouseName,
    factoryId: factory.id,
    factoryName: factory.name,
    factoryKind: factory.factoryType,
    sourceTaskId: input.taskId || builderBase.sourceTaskId || head.taskId,
    sourceTaskNo: input.taskNo || builderBase.sourceTaskNo || head.taskNo,
    handoverOrderId: input.handoverOrderId,
    handoverOrderNo: input.handoverOrderNo || head.handoverOrderNo || head.handoverId,
    handoverRecordId: record.handoverRecordId || record.recordId,
    handoverRecordNo: input.handoverRecordNo || record.handoverRecordNo || record.recordId,
    handoverRecordQrValue: input.handoverRecordQrValue || record.handoverRecordQrValue,
    receiverKind: input.receiverKind || builderBase.receiverKind,
    receiverName: input.receiverName || builderBase.receiverName,
    itemKind: input.itemKind || builderBase.itemKind,
    itemName: input.itemName || builderBase.itemName,
    materialSku: input.materialSku || builderBase.materialSku,
    partName: input.partName || builderBase.partName,
    fabricColor: input.fabricColor || builderBase.fabricColor,
    sizeCode: input.sizeCode || builderBase.sizeCode,
    feiTicketNo: input.feiTicketNo || builderBase.feiTicketNo,
    transferBagNo: input.transferBagNo || builderBase.transferBagNo,
    fabricRollNo: input.fabricRollNo || builderBase.fabricRollNo,
    outboundQty,
    receiverWrittenQty: builderBase.receiverWrittenQty,
    differenceQty: builderBase.differenceQty,
    unit: input.unit || builderBase.unit,
    operatorName: input.operatorName || builderBase.operatorName || factory.name,
    outboundAt: input.submittedAt || builderBase.outboundAt,
    status: builderBase.status || '已出库',
    abnormalReason: builderBase.abnormalReason,
    photoList: [...builderBase.photoList],
    remark: '由交出记录生成',
  }
  const savedOutbound = upsertFactoryWarehouseOutboundRecord(outboundRecord)
  const linkedWaitHandover = upsertFactoryWaitHandoverStockItem({
    ...buildFactoryWaitHandoverStockItemFromOutboundRecord(savedOutbound),
    stockItemId: `WHS-${record.handoverRecordId || record.recordId}`,
    handoverOrderId: input.handoverOrderId,
    handoverOrderNo: input.handoverOrderNo || head.handoverOrderNo || head.handoverId,
    handoverRecordId: record.handoverRecordId || record.recordId,
    handoverRecordNo: input.handoverRecordNo || record.handoverRecordNo || record.recordId,
    handoverRecordQrValue: input.handoverRecordQrValue || record.handoverRecordQrValue,
    status: '已交出',
    waitHandoverQty: 0,
    remark: '由交出记录生成',
  })
  decreasePendingFactoryWaitHandoverQty(input.handoverOrderId, outboundQty)
  const linkedOutbound = upsertFactoryWarehouseOutboundRecord({
    ...savedOutbound,
    relatedWaitHandoverStockItemId: linkedWaitHandover.stockItemId,
  })
  return {
    outboundRecord: linkedOutbound,
    updatedWaitHandoverStockItem: linkedWaitHandover,
  }
}

export function syncReceiverWritebackToOutboundRecord(input: {
  handoverRecordId: string
  receiverWrittenQty: number
  receiverWrittenAt?: string
  receiverWrittenBy?: string
  differenceQty?: number
}): {
  updatedOutboundRecord: FactoryWarehouseOutboundRecord
  updatedWaitHandoverStockItem: FactoryWaitHandoverStockItem
} {
  const existingOutbound = findFactoryWarehouseOutboundRecordByHandoverRecordId(input.handoverRecordId)
  if (!existingOutbound) {
    throw new Error(`未找到出库记录：${input.handoverRecordId}`)
  }
  const differenceQty = roundQty(
    input.differenceQty
      ?? (input.receiverWrittenQty - existingOutbound.outboundQty),
  )
  const status: FactoryOutboundRecordStatus = differenceQty === 0 ? '已回写' : '差异'
  const updatedOutboundRecord = upsertFactoryWarehouseOutboundRecord({
    ...existingOutbound,
    receiverWrittenQty: roundQty(input.receiverWrittenQty),
    differenceQty,
    status,
    abnormalReason: differenceQty !== 0 ? existingOutbound.abnormalReason || '数量不符' : undefined,
  })
  const existingWaitItem = findFactoryWaitHandoverStockItemByHandoverRecordId(input.handoverRecordId)
  const nextWaitItem = upsertFactoryWaitHandoverStockItem({
    ...(existingWaitItem || buildFactoryWaitHandoverStockItemFromOutboundRecord(updatedOutboundRecord)),
    stockItemId: existingWaitItem?.stockItemId || updatedOutboundRecord.relatedWaitHandoverStockItemId || `WHS-${input.handoverRecordId}`,
    warehouseId: existingWaitItem?.warehouseId || updatedOutboundRecord.warehouseId,
    factoryId: existingWaitItem?.factoryId || updatedOutboundRecord.factoryId,
    factoryName: existingWaitItem?.factoryName || updatedOutboundRecord.factoryName,
    factoryKind: existingWaitItem?.factoryKind || updatedOutboundRecord.factoryKind,
    warehouseName: existingWaitItem?.warehouseName || updatedOutboundRecord.warehouseName,
    processCode: existingWaitItem?.processCode || updatedOutboundRecord.processCode,
    processName: existingWaitItem?.processName || updatedOutboundRecord.processName,
    itemKind: existingWaitItem?.itemKind || updatedOutboundRecord.itemKind,
    itemName: existingWaitItem?.itemName || updatedOutboundRecord.itemName,
    materialSku: existingWaitItem?.materialSku || updatedOutboundRecord.materialSku,
    partName: existingWaitItem?.partName || updatedOutboundRecord.partName,
    fabricColor: existingWaitItem?.fabricColor || updatedOutboundRecord.fabricColor,
    sizeCode: existingWaitItem?.sizeCode || updatedOutboundRecord.sizeCode,
    feiTicketNo: existingWaitItem?.feiTicketNo || updatedOutboundRecord.feiTicketNo,
    transferBagNo: existingWaitItem?.transferBagNo || updatedOutboundRecord.transferBagNo,
    fabricRollNo: existingWaitItem?.fabricRollNo || updatedOutboundRecord.fabricRollNo,
    unit: existingWaitItem?.unit || updatedOutboundRecord.unit,
    areaName: existingWaitItem?.areaName || '待确认区',
    shelfNo: existingWaitItem?.shelfNo || '待确认-01',
    locationNo: existingWaitItem?.locationNo || '待确认-01-01',
    locationText: existingWaitItem?.locationText || `待确认区 / 待确认-01 / 待确认-01-01`,
    completedQty: existingWaitItem?.completedQty || updatedOutboundRecord.outboundQty,
    lossQty: existingWaitItem?.lossQty || 0,
    waitHandoverQty: 0,
    receiverKind: existingWaitItem?.receiverKind || updatedOutboundRecord.receiverKind,
    receiverName: existingWaitItem?.receiverName || updatedOutboundRecord.receiverName,
    handoverOrderId: existingWaitItem?.handoverOrderId || updatedOutboundRecord.handoverOrderId,
    handoverOrderNo: existingWaitItem?.handoverOrderNo || updatedOutboundRecord.handoverOrderNo,
    handoverRecordId: input.handoverRecordId,
    handoverRecordNo: existingWaitItem?.handoverRecordNo || updatedOutboundRecord.handoverRecordNo,
    handoverRecordQrValue: existingWaitItem?.handoverRecordQrValue || updatedOutboundRecord.handoverRecordQrValue,
    receiverWrittenQty: roundQty(input.receiverWrittenQty),
    differenceQty,
    objectionStatus: undefined,
    status: differenceQty === 0 ? '已回写' : '差异',
    abnormalReason: differenceQty !== 0 ? updatedOutboundRecord.abnormalReason : undefined,
    photoList: [...(existingWaitItem?.photoList || updatedOutboundRecord.photoList || [])],
    remark: '由交出记录生成',
  })
  return {
    updatedOutboundRecord,
    updatedWaitHandoverStockItem: nextWaitItem,
  }
}

export function syncQuantityObjectionToOutboundRecord(input: {
  handoverRecordId: string
  objectionId: string
  objectionStatus: string
}): {
  updatedOutboundRecord: FactoryWarehouseOutboundRecord
  updatedWaitHandoverStockItem: FactoryWaitHandoverStockItem
} {
  const existingOutbound = findFactoryWarehouseOutboundRecordByHandoverRecordId(input.handoverRecordId)
  if (!existingOutbound) {
    throw new Error(`未找到出库记录：${input.handoverRecordId}`)
  }
  const updatedOutboundRecord = upsertFactoryWarehouseOutboundRecord({
    ...existingOutbound,
    status: '异议中',
    abnormalReason: existingOutbound.abnormalReason || `异议单 ${input.objectionId}`,
  })
  const existingWaitItem = findFactoryWaitHandoverStockItemByHandoverRecordId(input.handoverRecordId)
  const updatedWaitHandoverStockItem = upsertFactoryWaitHandoverStockItem({
    ...(existingWaitItem || buildFactoryWaitHandoverStockItemFromOutboundRecord(updatedOutboundRecord)),
    stockItemId: existingWaitItem?.stockItemId || updatedOutboundRecord.relatedWaitHandoverStockItemId || `WHS-${input.handoverRecordId}`,
    handoverRecordId: input.handoverRecordId,
    handoverRecordNo: existingWaitItem?.handoverRecordNo || updatedOutboundRecord.handoverRecordNo,
    handoverRecordQrValue: existingWaitItem?.handoverRecordQrValue || updatedOutboundRecord.handoverRecordQrValue,
    status: '异议中',
    objectionStatus: input.objectionStatus,
    differenceQty:
      existingWaitItem?.differenceQty
      ?? updatedOutboundRecord.differenceQty
      ?? roundQty(getRecordDiffQty(findPdaHandoverRecord(input.handoverRecordId) || {}) || 0),
    abnormalReason: updatedOutboundRecord.abnormalReason,
    remark: '由交出记录生成',
  })
  return {
    updatedOutboundRecord,
    updatedWaitHandoverStockItem,
  }
}
