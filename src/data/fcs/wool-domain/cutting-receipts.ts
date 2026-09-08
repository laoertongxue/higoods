import { readWoolStore } from './store.ts'
import type { GeneratedFeiTicketSourceRecord } from '../cutting/generated-fei-tickets.ts'
import type { FeiTicketQrPayload } from '../cutting/qr-payload.ts'

/** PROD-003: read-only receipt identity. Bag occupancy/outbound remains sewing-dispatch's sole ledger. */
export function listWoolPanelCuttingReceiptSources(): GeneratedFeiTicketSourceRecord[] {
  const store = readWoolStore()
  return store.handovers.flatMap((handover) => {
    const order = store.workOrders[handover.woolOrderId]
    const output = order?.outputPlanLines.find((line) => line.outputSkuCode === handover.outputSkuCode)
    const receipt = handover.downstreamReceipt
    if (order?.kind !== 'PART_PANEL' || output?.outputObjectType !== 'WOOL_PANEL'
      || handover.receiverType !== 'CUTTING_WAIT_HANDOVER_WAREHOUSE'
      || receipt?.status !== 'CONFIRMED' || typeof receipt.actualReceivedQty !== 'number'
      || !Number.isFinite(receipt.actualReceivedQty) || receipt.actualReceivedQty <= 0 || !receipt.receivedAt?.trim()
      || !output.woolPartCode || !output.woolPartName || !output.garmentSkuCode) return []
    const no = `WOOL-PANEL:${handover.handoverId}`
    const qty = receipt.actualReceivedQty
    const receivedAt = receipt.receivedAt
    const partName = output.woolPartName
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
      partCode: output.woolPartCode, partName, garmentInstanceNo: 0, layerCount: 0,
      businessSizeLabel: output.sizeCode, partQuantityPerGarment: 0,
      pieceSequenceLabel: '', bundleNo: no, bundleQty: qty,
      pieceSetNoStart: 0, pieceSetNoEnd: 0, pieceSetNoRange: '', bundleTicketType: '部位毛织实收',
      actualCutPieceQty: 0, qty, garmentQty: 0, hasSpecialCraft: false,
      secondaryCrafts: [] as string[], craftSequenceVersion: '', currentCraftStage: '裁床已实收',
    }
    const qrPayload: FeiTicketQrPayload = {
      ...trace, codeType: 'FEI_TICKET', version: '2.0.0', payloadVersion: '2.0.0', qrType: '菲票',
      issuedAt: receivedAt, spuCode: order.styleNo, styleName: order.styleName,
      color: output.colorName, size: output.sizeCode, pieceQty: qty,
      pieceSequenceStartNo: 0, pieceSequenceEndNo: 0, specialCrafts: [],
      feiTicketVersion: 'WOOL_PANEL_RECEIPT:1', generatedAt: receivedAt,
    }
    const source: GeneratedFeiTicketSourceRecord = {
      ...trace, sourceSpreadingSessionId: '', sourceSpreadingSessionNo: '', sourceMarkerId: '', sourceMarkerNo: '',
      sourceMarkerPlanId: '', sourceMarkerPlanNo: '',
      materialIdentity: { materialSku: output.outputSkuCode, materialName: partName, materialColor: output.colorName, materialAlias: '', materialImageUrl: '', materialUnit: '片' },
      patternIdentity: { patternFileId: '', patternFileName: '', patternVersion: output.sourceTechPackVersionCode, patternKind: '毛织', effectiveWidthValue: 0, effectiveWidthUnit: '', piecePartCodes: [output.woolPartCode], piecePartNames: [partName] },
      skuCode: output.garmentSkuCode, partInstanceNo: '', printStatus: 'WAIT_PRINT', sourceTraceCompleteness: 'COMPLETE',
      specialCrafts: [], specialCraftDisplayLabel: '', pieceSequenceRange: null,
      pieceSequenceCannotGenerateReason: '毛织片来自裁床实收，没有铺布层序', sourceTechPackSpuCode: order.styleNo,
      sourceBasis: '部位毛织实收', sourceBasisType: 'WOOL_PANEL_RECEIPT', issuedAt: receivedAt,
      qrPayload, qrValue: no,
    }
    return [source]
  })
}
