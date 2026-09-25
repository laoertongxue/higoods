import { getFactoryInternalWarehouseRegistryReference } from '../factory-internal-warehouse-locations.ts'
import { readWoolStoreForCuttingReceipts } from './store.ts'
import type { GeneratedFeiTicketSourceRecord } from '../cutting/generated-fei-tickets.ts'
import type { FeiTicketQrPayload } from '../cutting/qr-payload.ts'

export const WOOL_DEFAULT_CUTTING_FACTORY_ID = 'ID-F004'
export interface WoolPanelCuttingReceiptSource extends GeneratedFeiTicketSourceRecord {
  receivingFactoryId: string
  receivingWarehouseId: string
}

export function resolveWoolCuttingReceiver(receiverId: string): { factoryId: string; warehouseId: string } | undefined {
  const legacyDefault = ['CUTTING-WAIT-HANDOVER', 'WH-CUTTING-WAIT-HANDOVER', 'WOOL-CUTTING-WAIT-HANDOVER'].includes(receiverId)
  const warehouseId = legacyDefault ? 'FIW-ID-F004-WAIT_HANDOVER' : receiverId
  const warehouse = getFactoryInternalWarehouseRegistryReference().find(warehouse => warehouse.warehouseId === warehouseId
    && warehouse.isEnabled && warehouse.warehouseKind === 'WAIT_HANDOVER' && warehouse.factoryKind === 'CENTRAL_CUTTING')
  return warehouse ? { factoryId: warehouse.factoryId, warehouseId: warehouse.warehouseId } : undefined
}

/** PROD-003: read-only receipt identity. Bag occupancy/outbound remains sewing-dispatch's sole ledger. */
export function listWoolPanelCuttingReceiptSources(factoryId?: string): WoolPanelCuttingReceiptSource[] {
  const store = readWoolStoreForCuttingReceipts()
  return store.handovers.flatMap((handover) => {
    const order = store.workOrders[handover.woolOrderId]
    const output = order?.outputPlanLines.find((line) => line.outputSkuCode === handover.outputSkuCode)
    const receipt = handover.downstreamReceipt
    const receiver = resolveWoolCuttingReceiver(handover.receiverId)
    if (order?.stage !== 'LINKING' || handover.automatic || handover.pieceKey || order?.kind !== 'PART_PANEL' || output?.outputObjectType !== 'WOOL_PANEL'
      || handover.receiverType !== 'CUTTING_WAIT_HANDOVER_WAREHOUSE' || !receiver || (factoryId && receiver.factoryId !== factoryId)
      || receipt?.status !== 'CONFIRMED' || typeof receipt.actualReceivedQty !== 'number'
      || !Number.isFinite(receipt.actualReceivedQty) || receipt.actualReceivedQty <= 0 || !receipt.receivedAt?.trim()
      || !output.garmentSkuCode) return []
    const no = `WOOL-PANEL:${handover.handoverId}`
    const qty = receipt.actualReceivedQty
    const receivedAt = receipt.receivedAt
    const partName = `部位毛织产物（${order.taskNo}）`
    const partCode = `WOOL-TASK:${order.sourceTaskId}`
    // Empty cutting fields deliberately mean "not a spreading/cutting output".
    const trace = {
      feiTicketId: no, feiTicketNo: no, sourceOutputLineId: handover.handoverId,
      cutOrderId: '', cutOrderNo: '', markerPlanId: '', markerPlanNo: '', markerNumber: '', bedNo: '',
      spreadingOrderId: '', spreadingOrderNo: '', fabricRollId: '', fabricRollNo: '',
      productionOrderId: order.productionOrderId, productionOrderNo: order.productionOrderNo,
      fabricColor: output.colorName, materialSku: output.outputSkuCode,
      garmentSkuId: output.garmentSkuCode, garmentColor: output.colorName,
      applicableSkuCodes: [output.garmentSkuCode], applicableSkuLabel: output.garmentSkuCode,
      assemblyGroupKey: `${order.productionOrderId}:${output.garmentSkuCode}`,
      siblingPartTicketNos: [] as string[], pieceScope: [partName], pieceGroup: partName,
      bundleScope: no, skuColor: output.colorName, skuSize: output.sizeCode,
      partCode, partName, garmentInstanceNo: 0, layerCount: 0,
      businessSizeLabel: output.sizeCode, partQuantityPerGarment: 0,
      pieceSequenceLabel: '', bundleNo: no, bundleQty: qty,
      pieceSetNoStart: 0, pieceSetNoEnd: 0, pieceSetNoRange: '', bundleTicketType: '部位毛织实收',
      actualCutPieceQty: 0, qty, garmentQty: 0, hasSpecialCraft: false,
      secondaryCrafts: [] as string[], craftSequenceVersion: '', currentCraftStage: '裁床已实收',
    }
    const qrPayload: FeiTicketQrPayload = {
      ...trace, codeType: 'FEI_TICKET', version: '2.0.0', payloadVersion: '2.0.0', qrType: '菲票',
      issuedAt: receivedAt, spuCode: order.styleNo, styleName: order.styleName,
      color: output.colorName, size: output.sizeCode, pieceQty: 0,
      pieceSequenceStartNo: 0, pieceSequenceEndNo: 0, specialCrafts: [],
      feiTicketVersion: 'WOOL_PANEL_RECEIPT:1', generatedAt: receivedAt,
    }
    const source: WoolPanelCuttingReceiptSource = {
      receivingFactoryId: receiver.factoryId, receivingWarehouseId: receiver.warehouseId,
      ...trace, sourceSpreadingSessionId: '', sourceSpreadingSessionNo: '', sourceMarkerId: '', sourceMarkerNo: '',
      sourceMarkerPlanId: '', sourceMarkerPlanNo: '',
      materialIdentity: { materialSku: output.outputSkuCode, materialName: partName, materialColor: output.colorName, materialAlias: '', materialImageUrl: order.styleImageUrl || '', materialUnit: '件' },
      patternIdentity: { patternFileId: '', patternFileName: '', patternVersion: output.sourceTechPackVersionCode, patternKind: '毛织', effectiveWidthValue: 0, effectiveWidthUnit: '', piecePartCodes: [partCode], piecePartNames: [partName] },
      skuCode: output.garmentSkuCode, partInstanceNo: '', printStatus: 'WAIT_PRINT', sourceTraceCompleteness: 'COMPLETE',
      specialCrafts: [], specialCraftDisplayLabel: '', pieceSequenceRange: null,
      pieceSequenceCannotGenerateReason: '部位毛织按来源任务的对应件数实收，不维护物理片数', sourceTechPackSpuCode: order.styleNo,
      sourceBasis: '部位毛织实收', sourceBasisType: 'WOOL_PANEL_RECEIPT', issuedAt: receivedAt,
      qrPayload, qrValue: no,
    }
    return [source]
  })
}
