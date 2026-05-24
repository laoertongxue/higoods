export const CUTTING_QR_PREFIX = 'FCSQR';
export const CUTTING_QR_VERSION = '2.0.0';
function encodePayload(payload) {
    return `${CUTTING_QR_PREFIX}:${encodeURIComponent(JSON.stringify(payload))}`;
}
export function serializeCuttingQrPayload(payload) {
    return encodePayload(payload);
}
export function deserializeCuttingQrPayload(value) {
    if (!value)
        return null;
    const raw = value.startsWith(`${CUTTING_QR_PREFIX}:`) ? decodeURIComponent(value.slice(CUTTING_QR_PREFIX.length + 1)) : value;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || typeof parsed.codeType !== 'string')
            return null;
        if (!parsed.version || !parsed.issuedAt)
            return null;
        if (parsed.codeType === 'CUT_ORDER') {
            if (!parsed.cutOrderId || !parsed.cutOrderNo)
                return null;
            return parsed;
        }
        if (parsed.codeType === 'FEI_TICKET') {
            if (!parsed.feiTicketId || !parsed.feiTicketNo || !parsed.cutOrderId)
                return null;
            return parsed;
        }
        if (parsed.codeType === 'CARRIER') {
            if (!parsed.carrierId || !parsed.carrierCode || !parsed.cycleId)
                return null;
            return parsed;
        }
        return null;
    }
    catch {
        return null;
    }
}
export function buildCutOrderQrPayload(input) {
    return {
        codeType: 'CUT_ORDER',
        version: CUTTING_QR_VERSION,
        issuedAt: input.issuedAt,
        cutOrderId: input.cutOrderId,
        cutOrderNo: input.cutOrderNo,
        productionOrderId: input.productionOrderId,
        productionOrderNo: input.productionOrderNo,
        materialSku: input.materialSku,
    };
}
export function buildFeiTicketQrPayload(input) {
    return {
        codeType: 'FEI_TICKET',
        version: CUTTING_QR_VERSION,
        issuedAt: input.issuedAt,
        feiTicketId: input.feiTicketId,
        feiTicketNo: input.feiTicketNo,
        cutOrderId: input.cutOrderId,
        cutOrderNo: input.cutOrderNo,
        productionOrderId: input.productionOrderId,
        productionOrderNo: input.productionOrderNo,
        sourceOutputLineId: input.sourceOutputLineId,
        fabricRollId: input.fabricRollId,
        fabricRollNo: input.fabricRollNo,
        fabricColor: input.fabricColor,
        materialSku: input.materialSku,
        garmentSkuId: input.garmentSkuId,
        garmentColor: input.garmentColor,
        pieceScope: [...input.pieceScope],
        pieceGroup: input.pieceGroup,
        bundleScope: input.bundleScope,
        skuColor: input.skuColor,
        skuSize: input.skuSize,
        partCode: input.partCode,
        partName: input.partName,
        bundleNo: input.bundleNo,
        bundleQty: Math.max(input.bundleQty, 0),
        pieceSetNoStart: Math.max(input.pieceSetNoStart || 1, 1),
        pieceSetNoEnd: Math.max(input.pieceSetNoEnd || input.bundleQty || 1, 1),
        pieceSetNoRange: input.pieceSetNoRange || `${Math.max(input.pieceSetNoStart || 1, 1)}-${Math.max(input.pieceSetNoEnd || input.bundleQty || 1, 1)}`,
        bundleTicketType: input.bundleTicketType || '扎束菲票',
        actualCutPieceQty: Math.max(input.actualCutPieceQty, 0),
        qty: Math.max(input.qty, 0),
        secondaryCrafts: [...input.secondaryCrafts],
        craftSequenceVersion: input.craftSequenceVersion,
        currentCraftStage: input.currentCraftStage || '',
    };
}
export function buildCarrierQrPayload(input) {
    return {
        codeType: 'CARRIER',
        version: CUTTING_QR_VERSION,
        issuedAt: input.issuedAt,
        carrierId: input.carrierId,
        carrierCode: input.carrierCode,
        carrierType: input.carrierType,
        cycleId: input.cycleId,
    };
}
