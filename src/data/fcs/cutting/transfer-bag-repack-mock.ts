import {
  appendCuttingRuntimeEventIdempotent,
  type RuntimeWarehouseLocationRef,
  type TransferBagTicketFactSnapshot,
} from './cutting-runtime-event-ledger.ts'
import {
  getBrowserLocalStorage,
  type BrowserStorageLike,
} from '../../browser-storage.ts'

export const TRANSFER_BAG_REPACK_MOCK_SOURCE_BAG_CODES = [
  'BAG-REPACK-DEMO-01',
  'BAG-REPACK-DEMO-02',
  'BAG-REPACK-DEMO-03',
] as const

export const TRANSFER_BAG_REPACK_MOCK_RESULT_BAG_CODE = TRANSFER_BAG_REPACK_MOCK_SOURCE_BAG_CODES[0]

const MOCK_PRODUCTION_ORDER_ID = 'PO-ID-REPACK-DEMO-001'
const MOCK_PRODUCTION_ORDER_NO = 'PO-REPACK-DEMO-001'
const MOCK_RECEIVER_FACTORY_ID = 'FACTORY-SEWING-REPACK-DEMO'
const MOCK_RECEIVER_FACTORY_NAME = '拆袋重装演示车缝厂'
const MOCK_OTHER_FACTORY_ID = 'FACTORY-SEWING-REPACK-OTHER'
const MOCK_OTHER_FACTORY_NAME = '其他任务演示车缝厂'
const MOCK_PIECE_QTYS = [18, 20, 22, 16, 24] as const
const MOCK_COLORS = ['藏青', '藏青', '灰蓝', '灰蓝', '黑色'] as const
const MOCK_SIZES = ['S', 'M', 'L', 'XL', '2XL'] as const
const MOCK_PARTS = [
  { code: 'FRONT', name: '前片' },
  { code: 'BACK', name: '后片' },
  { code: 'SLEEVE', name: '袖片' },
  { code: 'COLLAR', name: '领片' },
  { code: 'POCKET', name: '口袋片' },
] as const

function mockLocation(index: number): RuntimeWarehouseLocationRef {
  const position = String(index + 1).padStart(2, '0')
  const locationNo = `A-R01-L01-P${position}`
  return {
    factoryId: 'FACTORY-ONBOARD-0035',
    warehouseId: 'FIW-FACTORY-ONBOARD-0035-WAIT_HANDOVER',
    warehouseKind: 'WAIT_HANDOVER',
    areaId: 'CUT-WH-AREA-A',
    areaName: 'A区',
    shelfId: 'CUT-WH-SHELF-A-R01',
    shelfNo: 'R01',
    locationId: `CUT-WH-LOC-${locationNo}`,
    locationNo,
  }
}

function mockTickets(bagIndex: number): TransferBagTicketFactSnapshot[] {
  return MOCK_PIECE_QTYS.map((pieceQty, ticketIndex) => {
    const sequence = String(ticketIndex + 1).padStart(2, '0')
    const bagSequence = String(bagIndex + 1).padStart(2, '0')
    const part = MOCK_PARTS[ticketIndex]
    const isTargetTask = bagIndex === 0 || ticketIndex < (bagIndex === 1 ? 3 : 2)
    const isUnassigned = bagIndex === 1 && !isTargetTask
    return {
      feiTicketId: `FT-REPACK-DEMO-${bagSequence}-${sequence}`,
      feiTicketNo: `FP-RP-${bagSequence}-${sequence}`,
      productionOrderId: MOCK_PRODUCTION_ORDER_ID,
      productionOrderNo: MOCK_PRODUCTION_ORDER_NO,
      cutOrderId: `CUT-ID-REPACK-DEMO-${bagSequence}`,
      cutOrderNo: `CUT-RP-${bagSequence}`,
      color: MOCK_COLORS[ticketIndex],
      size: MOCK_SIZES[ticketIndex],
      partCode: part.code,
      partName: part.name,
      pieceQty,
      sewingTaskId: isTargetTask ? 'SEW-ID-REPACK-DEMO-001' : isUnassigned ? '' : 'SEW-ID-REPACK-DEMO-OTHER',
      sewingTaskNo: isTargetTask ? 'SEW-RP-DEMO-001' : isUnassigned ? '' : 'SEW-RP-DEMO-OTHER',
      receiverFactoryId: isUnassigned ? '' : isTargetTask ? MOCK_RECEIVER_FACTORY_ID : MOCK_OTHER_FACTORY_ID,
      receiverFactoryName: isUnassigned ? '' : isTargetTask ? MOCK_RECEIVER_FACTORY_NAME : MOCK_OTHER_FACTORY_NAME,
    }
  })
}

export function ensureTransferBagRepackMockEvents(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): void {
  TRANSFER_BAG_REPACK_MOCK_SOURCE_BAG_CODES.forEach((bagCode, index) => {
    const tickets = mockTickets(index)
    const locationRef = mockLocation(index)
    const usageCycleId = `usage:${bagCode}:mock-1`
    const baggingAt = `2026-08-03 08:0${index + 1}`
    const inboundAt = `2026-08-03 08:1${index + 1}`
    const totalPieceQty = tickets.reduce((sum, ticket) => sum + ticket.pieceQty, 0)

    appendCuttingRuntimeEventIdempotent({
      idempotencyKey: `mock:${usageCycleId}:BAGGING_CONFIRMED`,
      eventType: '菲票装袋',
      eventSource: 'MOCK',
      eventStatus: '已同步',
      occurredAt: baggingAt,
      operatorName: '拆袋重装演示装袋员',
      operatorRole: '裁片仓装袋员',
      refs: {
        productionOrderId: MOCK_PRODUCTION_ORDER_ID,
        productionOrderNo: MOCK_PRODUCTION_ORDER_NO,
        cutOrderId: tickets[0]?.cutOrderId,
        cutOrderNo: tickets[0]?.cutOrderNo,
        feiTicketIds: tickets.map((ticket) => ticket.feiTicketId),
        feiTicketNos: tickets.map((ticket) => ticket.feiTicketNo),
        transferBagCode: bagCode,
        usageCycleId,
      },
      payload: {
        baggingRecordId: `mock-bagging:${bagCode}`,
        bagCode,
        feiTicketItems: tickets,
        totalPieceQty,
        mixedFlag: true,
        baggingBy: '拆袋重装演示装袋员',
        baggingAt,
      },
    }, storage)

    appendCuttingRuntimeEventIdempotent({
      idempotencyKey: `mock:${usageCycleId}:INBOUND_CONFIRMED`,
      eventType: '中转袋入仓',
      eventSource: 'MOCK',
      eventStatus: '已同步',
      occurredAt: inboundAt,
      operatorName: '拆袋重装演示入仓员',
      operatorRole: '裁片仓入仓员',
      refs: {
        productionOrderId: MOCK_PRODUCTION_ORDER_ID,
        productionOrderNo: MOCK_PRODUCTION_ORDER_NO,
        cutOrderId: tickets[0]?.cutOrderId,
        cutOrderNo: tickets[0]?.cutOrderNo,
        feiTicketIds: tickets.map((ticket) => ticket.feiTicketId),
        feiTicketNos: tickets.map((ticket) => ticket.feiTicketNo),
        transferBagCode: bagCode,
        usageCycleId,
      },
      inventoryEffect: {
        inventoryScope: '裁床待交出仓',
        direction: 'IN',
        qty: totalPieceQty,
        unit: '片',
        toWarehouseArea: locationRef.areaName,
        toLocationCode: locationRef.locationNo,
      },
      payload: {
        tempBagUseId: `mock-temp:${bagCode}`,
        bagCode,
        warehouseArea: locationRef.areaName,
        locationCode: locationRef.locationNo,
        inboundBy: '拆袋重装演示入仓员',
        inboundAt,
        feiTicketItems: tickets,
        totalPieceQty,
        mixedFlag: true,
        warehouseLocations: [{ ...locationRef }],
        idempotencyKey: `mock:${usageCycleId}:INBOUND_CONFIRMED`,
      },
    }, storage)
  })
}
