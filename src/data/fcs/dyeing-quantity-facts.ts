import {
  listDyeWorkOrders,
  isDyeYarnOrder,
  listDyeExecutionNodeRecords,
  getDyeOrderHandoverRecords,
  DYE_WORK_ORDER_STATUS_LABEL,
} from './dyeing-task-domain.ts'
import {
  listFactoryMaterialUses,
  convertReceiptQuantity,
  listFactoryReceipts,
  getFactoryReceivingSource,
} from './factory-receiving.ts'
import { DYE_DEMO_DETAILS, dyeFactoryTabLabel } from './dye-work-order-demo-details.ts'
import { getDyeOrderImageManifest } from './process-order-image-manifest.ts'
import { readFactoryQcState } from './factory-qc-records.ts'

/** Read the same confirmed receipt, processing and handoff records used by the order pages. */
export function getDyeingQuantityFacts() {
  const uses = listFactoryMaterialUses()
  const handfeelState = readFactoryQcState()
  const receiptLines = listFactoryReceipts().flatMap((r) =>
    r.lines.map((line) => ({ line, recordId: getFactoryReceivingSource(line.sourceId)?.originalRecordId })),
  )
  return listDyeWorkOrders().map((order) => {
    const nodes = [...(order.completedExecutionBatches ?? []).flat(), ...listDyeExecutionNodeRecords(order.dyeOrderId)]
    const input = nodes.find((n) => n.nodeCode === 'INPUT_RECEIVED')
    const received = order.materialReceipts?.length
      ? order.materialReceipts.reduce((n, r) => n + r.qty, 0)
      : input?.finishedAt
        ? (input.outputQty ?? input.inputQty ?? 0)
        : 0
    const used = nodes.filter((n) => n.nodeCode === 'DYE' && n.startedAt).reduce((n, r) => n + (r.inputQty ?? 0), 0)
    const dyed = nodes.filter((n) => n.nodeCode === 'DYE' && n.finishedAt).reduce((n, r) => n + (r.outputQty ?? 0), 0)
    const packed = nodes
      .filter((n) => n.nodeCode === 'PACK' && n.finishedAt)
      .reduce((n, r) => n + (r.outputQty ?? 0), 0)
    const quantity = (value: number, unit: string) => {
      const converted = convertReceiptQuantity(value, unit, order.qtyUnit)
      if (converted === undefined) throw new Error(`${order.dyeOrderNo} 的数量单位 ${unit} 无法换算为 ${order.qtyUnit}`)
      return converted
    }
    const records = getDyeOrderHandoverRecords(order.dyeOrderId)
      .filter((r) => r.handoverRecordStatus !== 'VOIDED')
      .map((r) => ({
        ...r,
        submittedQty: quantity(r.submittedQty ?? 0, r.qtyUnit || order.qtyUnit),
        receiverWrittenQty:
          r.receiverWrittenQty === undefined ? undefined : quantity(r.receiverWrittenQty, r.qtyUnit || order.qtyUnit),
      }))
    const nativeHanded = records.reduce((n, r) => n + (r.submittedQty ?? 0), 0)
    const actual = records.filter((r) => Boolean(r.receiverWrittenAt) || Boolean(r.taskReceipts?.length))
    const nativeDownstreamReceived = actual.reduce((n, r) => n + (r.receiverWrittenQty ?? 0), 0)
    const actualIds = new Set(actual.map((r) => r.handoverRecordId || r.recordId))
    const downstreamLines = receiptLines.filter((r) => r.recordId && actualIds.has(r.recordId))
    const nativeDownstreamRollCount =
      downstreamLines.length && downstreamLines.every((r) => r.line.material.kind === 'FABRIC')
        ? downstreamLines.reduce((n, r) => n + (r.line.rolls?.length ?? 0), 0)
        : undefined
    const nativeDifference = actual.reduce((n, r) => n + (r.receiverWrittenQty ?? 0) - (r.submittedQty ?? 0), 0)
    // A handfeel SEND is an independent physical fact, not a synthetic PDA handover.
    // Read the original input quantity; later handfeel output/closure cannot alter it.
    const handfeelTransfers = handfeelState.handfeelOrders
      .filter(handfeel => handfeel.source.kind === 'DYEING' && handfeel.source.id === order.dyeOrderId)
      .flatMap(handfeel => handfeel.rolls.filter(roll => !!roll.sentAt).map(roll => {
        const sentQty = quantity(roll.inputQty, roll.unit)
        const receivedQty = roll.receivedAt && Number.isFinite(roll.receivedQty) ? quantity(roll.receivedQty!, roll.unit) : undefined
        return {
          id: handfeel.id + '/' + roll.id, orderId: handfeel.id, orderNo: handfeel.no,
          factoryId: handfeel.factoryId, factoryName: handfeel.factoryName,
          sourceRollId: roll.sourceRollId, barcode: roll.barcode, sentQty,
          sentAt: roll.sentAt!, receivedAt: receivedQty === undefined ? undefined : roll.receivedAt,
          receivedQty, difference: receivedQty === undefined ? undefined : receivedQty - sentQty,
          sentBy: handfeelState.actions.find(action => action.orderId === handfeel.id && action.kind === 'SEND' && action.at === roll.sentAt)?.by || '原记录未留操作人',
        }
      }))
    const handfeelSent = handfeelTransfers.reduce((n, transfer) => n + transfer.sentQty, 0)
    const receivedHandfeel = handfeelTransfers.filter(transfer => transfer.receivedQty !== undefined)
    const handfeelReceived = receivedHandfeel.reduce((n, transfer) => n + transfer.receivedQty!, 0)
    const handfeelDifference = receivedHandfeel.reduce((n, transfer) => n + transfer.difference!, 0)
    const handed = nativeHanded + handfeelSent
    const downstreamReceived = nativeDownstreamReceived + handfeelReceived
    const difference = nativeDifference + handfeelDifference
    const hasActualDownstreamReceipt = actual.length > 0 || receivedHandfeel.length > 0
    const pendingNative = records.filter(record => (record.submittedQty ?? 0) > 0 && !actualIds.has(record.handoverRecordId || record.recordId))
    const pendingReceiptQty = pendingNative.reduce((n, record) => n + (record.submittedQty ?? 0), 0)
      + handfeelTransfers.filter(transfer => transfer.receivedQty === undefined).reduce((n, transfer) => n + transfer.sentQty, 0)
    const hasPendingDownstreamReceipt = pendingNative.length > 0
      || handfeelTransfers.some(transfer => transfer.receivedQty === undefined)
    const downstreamRollCount = actual.length
      ? nativeDownstreamRollCount === undefined ? undefined : nativeDownstreamRollCount + receivedHandfeel.length
      : receivedHandfeel.length || undefined
    const receiptReceived = (order.materialReceipts ?? [])
      .filter((r) => r.receiptId.startsWith('FRP-'))
      .reduce((n, r) => n + r.qty, 0)
    const receiptUsed = uses
      .filter((u) => u.dyeOrderId === order.dyeOrderId)
      .flatMap((u) => u.lines)
      .reduce((n, l) => {
        const receipt=receiptLines.find(r=>r.line.id===l.receiptLineId)?.line
        const measured=receipt?.businessUnit===order.qtyUnit&&receipt.businessQty!==undefined&&receipt.qty>0
          ? l.qty/receipt.qty*receipt.businessQty : undefined
        return n+(convertReceiptQuantity(l.qty,l.unit,order.qtyUnit)??measured??quantity(l.qty,l.unit))
      }, 0)
    const material=order.outputMaterial??receiptLines.find(r=>r.line.material.sku===order.rawMaterialSku)?.line.material
    const spec = DYE_DEMO_DETAILS[order.dyeOrderId],
      images = getDyeOrderImageManifest(order.dyeOrderId)
    return {
      order,
      nodes,
      records,
      actual,
      received,
      used,
      dyed,
      packed,
      handed,
      downstreamReceived,
      downstreamRollCount,
      difference,
      nativeHanded,
      nativeDownstreamReceived,
      nativeDifference,
      handfeelTransfers,
      handfeelSent,
      handfeelReceived,
      handfeelDifference,
      hasActualDownstreamReceipt,
      hasPendingDownstreamReceipt,
      pendingReceiptQty,
      legacyReceived: Math.max(0, received - receiptReceived),
      legacyUsed: Math.max(0, used - receiptUsed),
      availableInput: Math.max(0, received - used),
      availableOutput: Math.max(0, packed - handed),
      status: DYE_WORK_ORDER_STATUS_LABEL[order.status],
      factoryName: dyeFactoryTabLabel(order.dyeFactoryId, order.dyeFactoryName),
      materialName: material?.name || spec?.materialName || order.stockMaterialName || order.rawMaterialSku,
      rawSku: spec?.rawSku || order.rawMaterialSku,
      outputSku: material?.sku || spec?.outputSku || order.materialId,
      imageUrl: material?.imageUrl || spec?.outputImage || images?.material || '',
      color: spec?.colorName || order.targetColor,
      kind:
        isDyeYarnOrder(order)
          ? ('纱线' as const)
          : /花边|辅料/.test(spec?.materialName || order.stockMaterialName || '')
            ? ('辅料' as const)
            : ('面料' as const),
    }
  })
}
export type DyeQuantityFact = ReturnType<typeof getDyeingQuantityFacts>[number]
export interface DyeQuantityGroup {
  unit: string
  planned: number
  received: number
  used: number
  dyed: number
  packed: number
  availableInput: number
  availableOutput: number
  handed: number
  downstreamReceived: number
  difference: number
}
export function groupDyeQuantities(facts: DyeQuantityFact[]): DyeQuantityGroup[] {
  const groups = new Map<string, DyeQuantityGroup>()
  for (const f of facts) {
    const unit =
      f.order.qtyUnit === 'm'
        ? '米'
        : f.order.qtyUnit.toLowerCase() === 'yard'
          ? 'Yard'
          : ['公斤', 'kg'].includes(f.order.qtyUnit)
            ? 'kg'
            : f.order.qtyUnit
    const group = groups.get(unit) ?? {
      unit,
      planned: 0,
      received: 0,
      used: 0,
      dyed: 0,
      packed: 0,
      availableInput: 0,
      availableOutput: 0,
      handed: 0,
      downstreamReceived: 0,
      difference: 0,
    }
    group.planned += f.order.plannedQty
    for (const key of [
      'received',
      'used',
      'dyed',
      'packed',
      'availableInput',
      'availableOutput',
      'handed',
      'downstreamReceived',
      'difference',
    ] as const)
      group[key] += f[key]
    groups.set(unit, group)
  }
  return [...groups.values()]
}
