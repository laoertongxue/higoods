import { buildProductionPieceTruth, resolveTechPackForProduction, } from '../../../domain/fcs-cutting-piece-truth/index.ts';
function uniqueStrings(values) {
    return Array.from(new Set(values.filter((value) => Boolean(value))));
}
function toGapRow(row) {
    return {
        productionOrderId: row.productionOrderId,
        productionOrderNo: row.productionOrderNo,
        sourceCutOrderNo: row.cutOrderNo,
        materialSku: row.materialSku,
        skuCode: row.skuCode,
        color: row.color,
        size: row.size,
        partCode: row.partCode,
        partName: row.partName,
        patternName: row.patternName,
        pieceCountPerUnit: row.pieceCountPerUnit,
        requiredGarmentQty: row.requiredGarmentQty,
        requiredPieceQty: row.requiredPieceQty,
        mappingStatus: row.mappingStatus,
        mappingStatusLabel: row.mappingStatusLabel,
        actualCutQty: row.actualCutQty,
        inboundQty: row.inboundQty,
        gapQty: row.gapCutQty,
        inboundGapQty: row.gapInboundQty,
        latestUpdatedAt: row.latestUpdatedAt,
        latestOperatorName: row.latestOperatorName,
    };
}
export function buildProductionPieceProgressViewModelFromTruth(truth) {
    const pieceDetailRows = truth.gapRows.map(toGapRow);
    const skuSummaryRows = truth.skuRows.map((row) => ({
        skuCode: row.skuCode,
        color: row.color,
        size: row.size,
        requiredGarmentQty: row.requiredGarmentQty,
        requiredPieceQty: row.requiredPieceQty,
        actualCutQty: row.actualCutQty,
        inboundQty: row.inboundQty,
        gapQty: row.gapCutQty,
        inboundGapQty: row.gapInboundQty,
        sourceCutOrderCount: row.cutOrderCount,
        mappingStatus: row.mappingStatus,
        mappingStatusLabel: row.mappingStatusLabel,
        completionLabel: row.currentStateLabel,
    }));
    const incompleteSkuRows = skuSummaryRows.filter((row) => row.mappingStatus !== 'MATCHED' || row.gapQty > 0 || row.inboundGapQty > 0);
    const incompleteCutOrderRows = truth.cutOrderRows
        .filter((row) => row.gapPartCount > 0 || row.currentStateLabel !== '无缺口')
        .map((row) => ({
        sourceCutOrderNo: row.cutOrderNo,
        materialSkuSummary: row.materialSku,
        skuSummaryText: '',
        gapPartCount: row.gapPartCount,
        gapPieceQty: Math.max(row.gapCutQty, row.gapInboundQty),
        mappingWarningCount: truth.mappingIssues.filter((issue) => issue.cutOrderNo === row.cutOrderNo).length,
    }));
    return {
        techPackLink: truth.techPackLink,
        skuSummaryRows,
        pieceDetailRows,
        gapRows: pieceDetailRows.filter((row) => row.gapQty > 0 || row.inboundGapQty > 0 || row.mappingStatus !== 'MATCHED'),
        incompleteSkuRows,
        incompleteCutOrderRows,
        mappingWarnings: uniqueStrings([
            ...truth.mappingIssues.map((issue) => issue.message),
            ...truth.dataIssues.map((issue) => issue.message),
        ]),
        totals: {
            requiredGarmentQtyTotal: skuSummaryRows.reduce((sum, row) => sum + row.requiredGarmentQty, 0),
            requiredPieceQtyTotal: truth.counts.requiredPieceQtyTotal,
            actualCutQtyTotal: truth.counts.actualCutQtyTotal,
            inboundQtyTotal: truth.counts.inboundQtyTotal,
            gapQtyTotal: truth.counts.gapCutQtyTotal,
            inboundGapQtyTotal: truth.counts.gapInboundQtyTotal,
            incompleteSkuCount: truth.counts.pendingSkuCount,
            incompleteCutOrderCount: truth.cutOrderRows.filter((row) => row.gapPartCount > 0 || row.currentStateLabel !== '无缺口').length,
        },
    };
}
export function buildProductionPieceProgressViewModel(record, options = {}) {
    const truth = buildProductionPieceTruth(record, { overlaySignals: options.overlaySignals });
    return buildProductionPieceProgressViewModelFromTruth(truth);
}
export { buildProductionPieceTruth, resolveTechPackForProduction };
