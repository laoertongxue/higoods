import {
  listGeneratedCutOrderSourceRecords,
  type GeneratedCutOrderSourceRecord,
} from './generated-cut-orders.ts'
import { cuttingOrderProgressRecords } from './order-progress.ts'
import type { CuttingMaterialIdentity, CuttingPatternIdentity } from './types.ts'

export type CuttingMaterialLedgerEventType =
  | 'TRANSFER_WAREHOUSE_ALLOCATED'
  | 'CUTTING_CLAIMED'
  | 'CUTTING_WAIT_PROCESS_INBOUNDED'
  | 'SPREADING_ACTUAL_CONSUMED'
  | 'CUTTING_RETURNED'
  | 'LEDGER_ADJUSTED'

export const cuttingMaterialLedgerEventTypeLabels: Record<CuttingMaterialLedgerEventType, string> = {
  TRANSFER_WAREHOUSE_ALLOCATED: '中转仓配料',
  CUTTING_CLAIMED: '裁床领料',
  CUTTING_WAIT_PROCESS_INBOUNDED: '扫码入仓',
  SPREADING_ACTUAL_CONSUMED: '铺布实际消耗',
  CUTTING_RETURNED: '裁床退料',
  LEDGER_ADJUSTED: '差异调整',
}

export type CuttingMaterialLedgerSourceObjectType =
  | 'CUT_ORDER_REQUIREMENT'
  | 'WMS_PREP_RECORD'
  | 'PDA_PICKUP_RECORD'
  | 'WAIT_PROCESS_INBOUND_RECORD'
  | 'SPREADING_SESSION'
  | 'RETURN_RECORD'
  | 'ADJUSTMENT_RECORD'

export interface CuttingMaterialLedgerEvent {
  eventId: string
  cutOrderId: string
  cutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  materialSku: string
  materialName: string
  materialColor: string
  materialAlias: string
  patternFileId: string
  quantity: number
  unit: string
  eventType: CuttingMaterialLedgerEventType
  sourceObjectType: CuttingMaterialLedgerSourceObjectType
  sourceObjectId: string
  occurredAt: string
  operatorName: string
  remark: string
}

export interface MaterialLedgerProjection {
  cutOrderId: string
  cutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  materialIdentity: CuttingMaterialIdentity
  patternIdentity: CuttingPatternIdentity
  requiredMaterialQty: number
  transferWarehouseAllocatedQty: number
  cuttingClaimedQty: number
  spreadingConsumedQty: number
  returnedQty: number
  adjustmentQty: number
  availableQty: number
  unit: string
  latestClaimEvent: CuttingMaterialLedgerEvent | null
  events: CuttingMaterialLedgerEvent[]
}

function roundQty(value: number): number {
  return Number(Number(value || 0).toFixed(2))
}

function uniqueByEventId(events: CuttingMaterialLedgerEvent[]): CuttingMaterialLedgerEvent[] {
  const seen = new Set<string>()
  return events.filter((event) => {
    if (!event.eventId || seen.has(event.eventId)) return false
    seen.add(event.eventId)
    return true
  })
}

function estimateRequiredMaterialQty(record: GeneratedCutOrderSourceRecord): number {
  return roundQty(Math.max(Number(record.requiredQty || 0) * 0.42, 1))
}

function buildEvent(
  record: GeneratedCutOrderSourceRecord,
  eventType: CuttingMaterialLedgerEventType,
  quantity: number,
  options: {
    eventId: string
    sourceObjectType: CuttingMaterialLedgerSourceObjectType
    sourceObjectId: string
    occurredAt: string
    operatorName: string
    remark: string
  },
): CuttingMaterialLedgerEvent {
  return {
    eventId: options.eventId,
    cutOrderId: record.cutOrderId,
    cutOrderNo: record.cutOrderNo,
    productionOrderId: record.productionOrderId,
    productionOrderNo: record.productionOrderNo,
    materialSku: record.materialIdentity.materialSku,
    materialName: record.materialIdentity.materialName,
    materialColor: record.materialIdentity.materialColor,
    materialAlias: record.materialIdentity.materialAlias,
    patternFileId: record.patternIdentity.patternFileId,
    quantity: roundQty(quantity),
    unit: record.materialIdentity.materialUnit,
    eventType,
    sourceObjectType: options.sourceObjectType,
    sourceObjectId: options.sourceObjectId,
    occurredAt: options.occurredAt,
    operatorName: options.operatorName,
    remark: options.remark,
  }
}

const progressLineByCutOrder = new Map(
  cuttingOrderProgressRecords.flatMap((record) =>
    record.materialLines.flatMap((line) => {
      const pairs: Array<[string, typeof line]> = []
      if (line.cutOrderId) pairs.push([line.cutOrderId, line])
      if (line.cutOrderNo) pairs.push([line.cutOrderNo, line])
      if (line.cutPieceOrderNo) pairs.push([line.cutPieceOrderNo, line])
      return pairs
    }),
  ),
)

function buildProgressDrivenEvents(record: GeneratedCutOrderSourceRecord): CuttingMaterialLedgerEvent[] {
  const line = progressLineByCutOrder.get(record.cutOrderId) || progressLineByCutOrder.get(record.cutOrderNo)
  if (!line) return []
  const events: CuttingMaterialLedgerEvent[] = []

  if (Number(line.configuredLength || 0) > 0) {
    events.push(buildEvent(record, 'TRANSFER_WAREHOUSE_ALLOCATED', line.configuredLength, {
      eventId: `ledger:${record.cutOrderId}:prep:system`,
      sourceObjectType: 'WMS_PREP_RECORD',
      sourceObjectId: `prep:${record.cutOrderId}`,
      occurredAt: '2026-03-10 09:20',
      operatorName: '中转仓系统',
      remark: '按当前裁片单生成中转仓配料数量账。',
    }))
  }

  if (Number(line.receivedLength || 0) > 0) {
    events.push(buildEvent(record, 'CUTTING_CLAIMED', line.receivedLength, {
      eventId: `ledger:${record.cutOrderId}:claim:system`,
      sourceObjectType: 'PDA_PICKUP_RECORD',
      sourceObjectId: `pickup:${record.cutOrderId}`,
      occurredAt: '2026-03-11 10:30',
      operatorName: '裁床领料员',
      remark: '按当前裁片单生成裁床领料数量账。',
    }))
  }

  return events
}

function buildPrompt2ScenarioEvents(record: GeneratedCutOrderSourceRecord): CuttingMaterialLedgerEvent[] {
  const no = record.cutOrderNo
  if (no === 'CUT-260306-101-03') {
    return [
      buildEvent(record, 'TRANSFER_WAREHOUSE_ALLOCATED', 620, {
        eventId: `ledger:${record.cutOrderId}:prep:001`,
        sourceObjectType: 'WMS_PREP_RECORD',
        sourceObjectId: 'WMS-PREP-260306-101-03-01',
        occurredAt: '2026-03-12 09:10',
        operatorName: '中转仓 周敏',
        remark: '口袋布纸样首次配料。',
      }),
      buildEvent(record, 'CUTTING_CLAIMED', 300, {
        eventId: `ledger:${record.cutOrderId}:claim:001`,
        sourceObjectType: 'PDA_PICKUP_RECORD',
        sourceObjectId: 'PDA-PICK-260306-101-03-01',
        occurredAt: '2026-03-12 11:05',
        operatorName: '裁床 李明',
        remark: '口袋布纸样首次领料。',
      }),
      buildEvent(record, 'SPREADING_ACTUAL_CONSUMED', 80, {
        eventId: `ledger:${record.cutOrderId}:consume:001`,
        sourceObjectType: 'SPREADING_SESSION',
        sourceObjectId: 'PB-260306-101-03-01',
        occurredAt: '2026-03-13 16:40',
        operatorName: '铺布组 王强',
        remark: '按铺布实际用量扣减。',
      }),
    ]
  }

  if (no === 'CUT-260306-101-01') {
    return [
      buildEvent(record, 'TRANSFER_WAREHOUSE_ALLOCATED', 780, {
        eventId: `ledger:${record.cutOrderId}:prep:001`,
        sourceObjectType: 'WMS_PREP_RECORD',
        sourceObjectId: 'WMS-PREP-260306-101-01-01',
        occurredAt: '2026-03-10 09:30',
        operatorName: '中转仓 周敏',
        remark: '主面料第一次配料。',
      }),
      buildEvent(record, 'TRANSFER_WAREHOUSE_ALLOCATED', 540, {
        eventId: `ledger:${record.cutOrderId}:prep:002`,
        sourceObjectType: 'WMS_PREP_RECORD',
        sourceObjectId: 'WMS-PREP-260306-101-01-02',
        occurredAt: '2026-03-14 09:20',
        operatorName: '中转仓 周敏',
        remark: '主面料第二次配料。',
      }),
      buildEvent(record, 'CUTTING_CLAIMED', 300, {
        eventId: `ledger:${record.cutOrderId}:claim:001`,
        sourceObjectType: 'PDA_PICKUP_RECORD',
        sourceObjectId: 'PDA-PICK-260306-101-01-01',
        occurredAt: '2026-03-10 11:10',
        operatorName: '裁床 李明',
        remark: '第一次领料用于首轮唛架。',
      }),
      buildEvent(record, 'CUTTING_CLAIMED', 420, {
        eventId: `ledger:${record.cutOrderId}:claim:002`,
        sourceObjectType: 'PDA_PICKUP_RECORD',
        sourceObjectId: 'PDA-PICK-260306-101-01-02',
        occurredAt: '2026-03-14 11:30',
        operatorName: '裁床 李明',
        remark: '第二次领料用于继续排唛架。',
      }),
      buildEvent(record, 'SPREADING_ACTUAL_CONSUMED', 180, {
        eventId: `ledger:${record.cutOrderId}:consume:001`,
        sourceObjectType: 'SPREADING_SESSION',
        sourceObjectId: 'PB-030101-01-A',
        occurredAt: '2026-03-15 16:10',
        operatorName: '铺布组 王强',
        remark: '第一次铺布实际消耗。',
      }),
      buildEvent(record, 'SPREADING_ACTUAL_CONSUMED', 80, {
        eventId: `ledger:${record.cutOrderId}:consume:002`,
        sourceObjectType: 'SPREADING_SESSION',
        sourceObjectId: 'PB-030101-01-B',
        occurredAt: '2026-03-16 16:35',
        operatorName: '铺布组 王强',
        remark: '第二次铺布实际消耗。',
      }),
      buildEvent(record, 'LEDGER_ADJUSTED', 20, {
        eventId: `ledger:${record.cutOrderId}:adjust:001`,
        sourceObjectType: 'ADJUSTMENT_RECORD',
        sourceObjectId: 'ADJ-260306-101-01',
        occurredAt: '2026-03-16 18:00',
        operatorName: '裁床主管 何倩',
        remark: '盘点差异调整，确认可用余额增加。',
      }),
    ]
  }

  if (no === 'CUT-260306-101-04') {
    return [
      buildEvent(record, 'TRANSFER_WAREHOUSE_ALLOCATED', 320, {
        eventId: `ledger:${record.cutOrderId}:prep:001`,
        sourceObjectType: 'WMS_PREP_RECORD',
        sourceObjectId: 'WMS-PREP-260306-101-04-01',
        occurredAt: '2026-03-12 08:50',
        operatorName: '中转仓 周敏',
        remark: '155cm 幅宽版本首次配料。',
      }),
      buildEvent(record, 'CUTTING_CLAIMED', 300, {
        eventId: `ledger:${record.cutOrderId}:claim:001`,
        sourceObjectType: 'PDA_PICKUP_RECORD',
        sourceObjectId: 'PDA-PICK-260306-101-04-01',
        occurredAt: '2026-03-12 10:35',
        operatorName: '裁床 李明',
        remark: '155cm 幅宽版本首次领料。',
      }),
    ]
  }

  if (no === 'CUT-260307-102-01') {
    return [
      buildEvent(record, 'TRANSFER_WAREHOUSE_ALLOCATED', 260, {
        eventId: `ledger:${record.cutOrderId}:prep:001`,
        sourceObjectType: 'WMS_PREP_RECORD',
        sourceObjectId: 'WMS-PREP-260307-102-01-01',
        occurredAt: '2026-03-13 09:00',
        operatorName: '中转仓 周敏',
        remark: '用于验证可用余额为 0 的配料数量账。',
      }),
      buildEvent(record, 'CUTTING_CLAIMED', 240, {
        eventId: `ledger:${record.cutOrderId}:claim:001`,
        sourceObjectType: 'PDA_PICKUP_RECORD',
        sourceObjectId: 'PDA-PICK-260307-102-01-01',
        occurredAt: '2026-03-13 10:20',
        operatorName: '裁床 李明',
        remark: '已领料并开工，但本次可用余额后续被实际消耗完。',
      }),
      buildEvent(record, 'SPREADING_ACTUAL_CONSUMED', 240, {
        eventId: `ledger:${record.cutOrderId}:consume:001`,
        sourceObjectType: 'SPREADING_SESSION',
        sourceObjectId: 'PB-260307-102-01-01',
        occurredAt: '2026-03-13 16:10',
        operatorName: '铺布组 王强',
        remark: '铺布实际用量等于裁床已领数量，当前可用余额为 0。',
      }),
    ]
  }

  if (no === 'CUT-260306-101-02') {
    return [
      buildEvent(record, 'TRANSFER_WAREHOUSE_ALLOCATED', 900, {
        eventId: `ledger:${record.cutOrderId}:prep:001`,
        sourceObjectType: 'WMS_PREP_RECORD',
        sourceObjectId: 'WMS-PREP-260306-101-02-01',
        occurredAt: '2026-03-08 09:10',
        operatorName: '中转仓 周敏',
        remark: 'Charcoal 面料配料。',
      }),
      buildEvent(record, 'CUTTING_CLAIMED', 500, {
        eventId: `ledger:${record.cutOrderId}:claim:001`,
        sourceObjectType: 'PDA_PICKUP_RECORD',
        sourceObjectId: 'PDA-PICK-260306-101-02-01',
        occurredAt: '2026-03-08 11:20',
        operatorName: '裁床 李明',
        remark: '历史唛架前领料。',
      }),
      buildEvent(record, 'SPREADING_ACTUAL_CONSUMED', 350, {
        eventId: `ledger:${record.cutOrderId}:consume:001`,
        sourceObjectType: 'SPREADING_SESSION',
        sourceObjectId: 'PB-HISTORY-260306-101-02',
        occurredAt: '2026-03-09 17:00',
        operatorName: '铺布组 王强',
        remark: '历史唛架已铺布消耗，不再占用当前余额。',
      }),
      buildEvent(record, 'CUTTING_CLAIMED', 400, {
        eventId: `ledger:${record.cutOrderId}:claim:002`,
        sourceObjectType: 'PDA_PICKUP_RECORD',
        sourceObjectId: 'PDA-PICK-260306-101-02-02',
        occurredAt: '2026-03-15 10:15',
        operatorName: '裁床 李明',
        remark: '后续再次领料，重新形成可用余额。',
      }),
      buildEvent(record, 'CUTTING_RETURNED', 50, {
        eventId: `ledger:${record.cutOrderId}:return:001`,
        sourceObjectType: 'RETURN_RECORD',
        sourceObjectId: 'RET-260306-101-02',
        occurredAt: '2026-03-15 18:30',
        operatorName: '裁床仓 陈敏',
        remark: '余料退回中转仓，减少裁床可用余额。',
      }),
    ]
  }

  if (no === 'CUT-260306-101-05') {
    return [
      buildEvent(record, 'TRANSFER_WAREHOUSE_ALLOCATED', 360, {
        eventId: `ledger:${record.cutOrderId}:prep:001`,
        sourceObjectType: 'WMS_PREP_RECORD',
        sourceObjectId: 'WMS-PREP-260306-101-05-01',
        occurredAt: '2026-03-16 09:05',
        operatorName: '中转仓 周敏',
        remark: '同生产单、同纸样、同幅宽的唛架组合验证数据。',
      }),
      buildEvent(record, 'CUTTING_CLAIMED', 260, {
        eventId: `ledger:${record.cutOrderId}:claim:001`,
        sourceObjectType: 'PDA_PICKUP_RECORD',
        sourceObjectId: 'PDA-PICK-260306-101-05-01',
        occurredAt: '2026-03-16 10:25',
        operatorName: '裁床 李明',
        remark: '形成可用余额，用于验证同生产单多选。',
      }),
    ]
  }

  if (no === 'CUT-260306-101-06') {
    return [
      buildEvent(record, 'TRANSFER_WAREHOUSE_ALLOCATED', 360, {
        eventId: `ledger:${record.cutOrderId}:prep:001`,
        sourceObjectType: 'WMS_PREP_RECORD',
        sourceObjectId: 'WMS-PREP-260306-101-06-01',
        occurredAt: '2026-03-16 09:15',
        operatorName: '中转仓 周敏',
        remark: '同纸样同幅宽但历史组合组不同的验证数据。',
      }),
      buildEvent(record, 'CUTTING_CLAIMED', 260, {
        eventId: `ledger:${record.cutOrderId}:claim:001`,
        sourceObjectType: 'PDA_PICKUP_RECORD',
        sourceObjectId: 'PDA-PICK-260306-101-06-01',
        occurredAt: '2026-03-16 10:40',
        operatorName: '裁床 李明',
        remark: '形成可用余额，用于验证历史组合组不一致禁止同选。',
      }),
    ]
  }

  if (no === 'CUT-260307-102-03') {
    return [
      buildEvent(record, 'TRANSFER_WAREHOUSE_ALLOCATED', 420, {
        eventId: `ledger:${record.cutOrderId}:prep:001`,
        sourceObjectType: 'WMS_PREP_RECORD',
        sourceObjectId: 'WMS-PREP-260307-102-03-01',
        occurredAt: '2026-03-16 09:30',
        operatorName: '中转仓 周敏',
        remark: '跨生产单、同 SPU、同纸样、同幅宽的唛架组合验证数据。',
      }),
      buildEvent(record, 'CUTTING_CLAIMED', 280, {
        eventId: `ledger:${record.cutOrderId}:claim:001`,
        sourceObjectType: 'PDA_PICKUP_RECORD',
        sourceObjectId: 'PDA-PICK-260307-102-03-01',
        occurredAt: '2026-03-16 11:05',
        operatorName: '裁床 李明',
        remark: '形成可用余额，用于验证跨生产单允许同选。',
      }),
    ]
  }

  return []
}

function buildWaitProcessInboundEvents(events: CuttingMaterialLedgerEvent[]): CuttingMaterialLedgerEvent[] {
  return events
    .filter((event) => event.eventType === 'CUTTING_CLAIMED')
    .map((event) => ({
      ...event,
      eventId: `${event.eventId}:wait-process-inbound`,
      eventType: 'CUTTING_WAIT_PROCESS_INBOUNDED' as const,
      sourceObjectType: 'WAIT_PROCESS_INBOUND_RECORD' as const,
      sourceObjectId: `wait-process-inbound:${event.sourceObjectId}`,
      remark: '裁床完成中转仓领料后，扫码确认进入裁床待加工仓库区库位。',
    }))
}

export function listCuttingMaterialLedgerEvents(): CuttingMaterialLedgerEvent[] {
  const baseEvents = uniqueByEventId(
    [
      ...listGeneratedCutOrderSourceRecords().flatMap((record) => {
      const scenarioEvents = buildPrompt2ScenarioEvents(record)
      return scenarioEvents.length ? scenarioEvents : buildProgressDrivenEvents(record)
      }),
    ],
  )

  return uniqueByEventId(
    [
      ...baseEvents,
      ...buildWaitProcessInboundEvents(baseEvents),
    ],
  ).sort((left, right) =>
    left.productionOrderNo.localeCompare(right.productionOrderNo, 'zh-CN')
    || left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN')
    || left.occurredAt.localeCompare(right.occurredAt, 'zh-CN'),
  )
}

function buildProjection(record: GeneratedCutOrderSourceRecord, events: CuttingMaterialLedgerEvent[]): MaterialLedgerProjection {
  const transferWarehouseAllocatedQty = roundQty(
    events
      .filter((event) => event.eventType === 'TRANSFER_WAREHOUSE_ALLOCATED')
      .reduce((sum, event) => sum + Number(event.quantity || 0), 0),
  )
  const cuttingClaimedQty = roundQty(
    events
      .filter((event) => event.eventType === 'CUTTING_CLAIMED')
      .reduce((sum, event) => sum + Number(event.quantity || 0), 0),
  )
  const spreadingConsumedQty = roundQty(
    events
      .filter((event) => event.eventType === 'SPREADING_ACTUAL_CONSUMED')
      .reduce((sum, event) => sum + Number(event.quantity || 0), 0),
  )
  const returnedQty = roundQty(
    events
      .filter((event) => event.eventType === 'CUTTING_RETURNED')
      .reduce((sum, event) => sum + Math.max(Number(event.quantity || 0), 0), 0),
  )
  const adjustmentQty = roundQty(
    events
      .filter((event) => event.eventType === 'LEDGER_ADJUSTED')
      .reduce((sum, event) => sum + Number(event.quantity || 0), 0),
  )
  const availableQty = roundQty(
    Math.max(cuttingClaimedQty - spreadingConsumedQty - returnedQty + adjustmentQty, 0),
  )
  const latestClaimEvent =
    events
      .filter((event) => event.eventType === 'CUTTING_CLAIMED')
      .slice()
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt, 'zh-CN'))[0] || null

  return {
    cutOrderId: record.cutOrderId,
    cutOrderNo: record.cutOrderNo,
    productionOrderId: record.productionOrderId,
    productionOrderNo: record.productionOrderNo,
    materialIdentity: { ...record.materialIdentity },
    patternIdentity: {
      ...record.patternIdentity,
      piecePartCodes: [...record.patternIdentity.piecePartCodes],
      piecePartNames: [...record.patternIdentity.piecePartNames],
    },
    requiredMaterialQty: estimateRequiredMaterialQty(record),
    transferWarehouseAllocatedQty,
    cuttingClaimedQty,
    spreadingConsumedQty,
    returnedQty,
    adjustmentQty,
    availableQty,
    unit: record.materialIdentity.materialUnit || record.materialUnit || '米',
    latestClaimEvent,
    events: events.map((event) => ({ ...event })),
  }
}

export function listMaterialLedgerProjections(): MaterialLedgerProjection[] {
  const eventsByCutOrderId = new Map<string, CuttingMaterialLedgerEvent[]>()
  listCuttingMaterialLedgerEvents().forEach((event) => {
    const rows = eventsByCutOrderId.get(event.cutOrderId) || []
    rows.push(event)
    eventsByCutOrderId.set(event.cutOrderId, rows)
  })
  return listGeneratedCutOrderSourceRecords().map((record) =>
    buildProjection(record, eventsByCutOrderId.get(record.cutOrderId) || []),
  )
}

export function buildMaterialLedgerProjectionMap(): Record<string, MaterialLedgerProjection> {
  const map: Record<string, MaterialLedgerProjection> = {}
  listMaterialLedgerProjections().forEach((projection) => {
    map[projection.cutOrderId] = projection
    map[projection.cutOrderNo] = projection
  })
  return map
}

export function getMaterialLedgerProjectionByCutOrder(cutOrderIdOrNo: string): MaterialLedgerProjection | null {
  return buildMaterialLedgerProjectionMap()[cutOrderIdOrNo] || null
}

export function listMaterialLedgerProjectionsByProductionOrderId(productionOrderId: string): MaterialLedgerProjection[] {
  return listMaterialLedgerProjections().filter((projection) => projection.productionOrderId === productionOrderId)
}
