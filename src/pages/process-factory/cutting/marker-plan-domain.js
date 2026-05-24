export const MARKER_PLAN_STORAGE_KEY = 'cuttingMarkerPlanLedger';
export const DEFAULT_SINGLE_SPREAD_FIXED_LOSS = 0.06;
export const MARKER_SIZE_CODES = ['S', 'M', 'L', 'XL', '2XL', 'onesize', 'onesizeplus'];
function roundTo(value, precision) {
    const factor = 10 ** precision;
    return Math.round((Number(value) || 0) * factor) / factor;
}
function safeNumber(value) {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
}
function formatIntegerFormulaValue(value) {
    return String(Math.max(Math.round(safeNumber(value)), 0));
}
function formatDecimalFormulaValue(value, digits) {
    return roundTo(safeNumber(value), digits).toFixed(digits);
}
export function normalizeMarkerPlanCombinationToken(value, fallback) {
    const text = String(value || '').trim();
    if (!text)
        return fallback;
    return text.replace(/\s+/g, '-').replace(/_+/g, '_');
}
export function normalizeMarkerPlanEffectiveWidth(value) {
    const raw = String(value ?? '').trim();
    const numeric = typeof value === 'number'
        ? value
        : Number(raw.match(/\d+(?:\.\d+)?/)?.[0] || Number.NaN);
    if (!Number.isFinite(numeric) || numeric <= 0)
        return 'UNKNOWN_WIDTH';
    const rounded = Math.round(numeric * 100) / 100;
    return `${rounded}cm`;
}
export function buildMarkerPlanCombinationGroupKey(source) {
    const spuKey = normalizeMarkerPlanCombinationToken(source.spuCode || source.styleCode, 'UNKNOWN_SPU');
    const patternKey = normalizeMarkerPlanCombinationToken(source.patternFileKey || source.patternKey, 'UNKNOWN_PATTERN');
    const widthKey = normalizeMarkerPlanEffectiveWidth(source.effectiveWidth);
    const historyKey = normalizeMarkerPlanCombinationToken(source.historicalGroupKey, 'NEW_GROUP');
    return [spuKey, patternKey, widthKey, historyKey].join('__');
}
export const markerPlanModeMeta = {
    normal: {
        key: 'normal',
        label: '普通模式',
        className: 'bg-slate-100 text-slate-700 border border-slate-200',
        helperText: '按普通模式维护颜色、尺码和层数。',
    },
    high_low: {
        key: 'high_low',
        label: '高低层模式',
        className: 'bg-amber-100 text-amber-700 border border-amber-200',
        helperText: '按高低层模式维护不同尺码列的层数。',
    },
    fold_normal: {
        key: 'fold_normal',
        label: '对折普通模式',
        className: 'bg-blue-100 text-blue-700 border border-blue-200',
        helperText: '按对折普通模式维护计划层数和对折门幅。',
    },
    fold_high_low: {
        key: 'fold_high_low',
        label: '对折高低层模式',
        className: 'bg-violet-100 text-violet-700 border border-violet-200',
        helperText: '按对折高低层模式维护阶梯层数。',
    },
};
export const markerPlanStatusMeta = {
    MAPPING_ISSUE: {
        key: 'MAPPING_ISSUE',
        label: '映射异常',
        className: 'bg-rose-100 text-rose-700 border border-rose-200',
        helperText: '技术包、SKU、颜色或裁片映射仍有异常。',
    },
    WAITING_LAYOUT: {
        key: 'WAITING_LAYOUT',
        label: '待补唛架',
        className: 'bg-sky-100 text-sky-700 border border-sky-200',
        helperText: '唛架矩阵还没完成，不能交接铺布。',
    },
    CANCELED: {
        key: 'CANCELED',
        label: '已作废',
        className: 'bg-slate-200 text-slate-700 border border-slate-300',
        helperText: '当前唛架方案已作废，不再继续交接铺布。',
    },
    READY_FOR_SPREADING: {
        key: 'READY_FOR_SPREADING',
        label: '可交接铺布',
        className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
        helperText: '当前唛架已满足铺布交接条件。',
    },
};
export const markerAllocationStatusMeta = {
    pending: {
        key: 'pending',
        label: '待配平',
        className: 'bg-slate-100 text-slate-700 border border-slate-200',
        helperText: '来源分配还没生成。',
    },
    balanced: {
        key: 'balanced',
        label: '已匹配',
        className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
        helperText: '各尺码来源分配与配比一致。',
    },
    unbalanced: {
        key: 'unbalanced',
        label: '未配平',
        className: 'bg-amber-100 text-amber-700 border border-amber-200',
        helperText: '至少有一个尺码的来源分配与配比不一致。',
    },
};
export const markerMappingStatusMeta = {
    pending: {
        key: 'pending',
        label: '待确认',
        className: 'bg-slate-100 text-slate-700 border border-slate-200',
        helperText: '还没生成裁片拆解，无法判断映射是否通过。',
    },
    passed: {
        key: 'passed',
        label: '已通过',
        className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
        helperText: '技术包、SKU、颜色和裁片映射都已通过。',
    },
    issue: {
        key: 'issue',
        label: '有异常',
        className: 'bg-rose-100 text-rose-700 border border-rose-200',
        helperText: '存在技术包、SKU、颜色或裁片映射异常。',
    },
};
export const markerLayoutStatusMeta = {
    pending: {
        key: 'pending',
        label: '待补唛架',
        className: 'bg-slate-100 text-slate-700 border border-slate-200',
        helperText: '唛架矩阵还没准备完整。',
    },
    done: {
        key: 'done',
        label: '已完成',
        className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
        helperText: '唛架矩阵已完成。',
    },
};
export const markerImageStatusMeta = {
    pending: {
        key: 'pending',
        label: '待上传',
        className: 'bg-slate-100 text-slate-700 border border-slate-200',
        helperText: '当前还没有方案图或唛架明细图。',
    },
    done: {
        key: 'done',
        label: '已上传',
        className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
        helperText: '方案图和唛架明细图资料已补齐。',
    },
};
export function createEmptySizeRatioRows() {
    return MARKER_SIZE_CODES.map((sizeCode, index) => ({
        sizeCode,
        qty: 0,
        sortOrder: index + 1,
    }));
}
export function normalizeMarkerSizeCode(sizeCode) {
    const normalized = String(sizeCode || '').trim();
    if (normalized === 'plusonesize')
        return 'onesizeplus';
    if (normalized && MARKER_SIZE_CODES.includes(normalized))
        return normalized;
    return null;
}
export function computeMarkerPlanTotalPieces(sizeRatioRows) {
    return Array.isArray(sizeRatioRows) ? sizeRatioRows.reduce((sum, row) => sum + Math.max(safeNumber(row.qty), 0), 0) : 0;
}
export function computeMarkerPlanSystemUnitUsage(netLength, totalPieces) {
    if (safeNumber(totalPieces) <= 0)
        return 0;
    return roundTo(safeNumber(netLength) / safeNumber(totalPieces), 3);
}
export function computeMarkerPlanSystemUnitUsageFromBeds(beds) {
    const weightedLength = beds.reduce((sum, bed) => sum + safeNumber(bed.markerLength) * Math.max(safeNumber(bed.plannedLayerCount), 0), 0);
    const plannedGarmentQty = beds.reduce((sum, bed) => sum + Math.max(safeNumber(bed.plannedGarmentQty), 0), 0);
    if (plannedGarmentQty <= 0)
        return 0;
    return roundTo(weightedLength / plannedGarmentQty, 3);
}
export function computeMarkerPlanFinalUnitUsage(systemUnitUsage, manualUnitUsage) {
    if (manualUnitUsage === null || manualUnitUsage === undefined || Number.isNaN(Number(manualUnitUsage))) {
        return roundTo(systemUnitUsage, 3);
    }
    return roundTo(Number(manualUnitUsage), 3);
}
export function computeMarkerLayoutLineSystemUnitUsage(line) {
    if (safeNumber(line.markerPieceQty) <= 0)
        return 0;
    return roundTo(safeNumber(line.markerLength) / safeNumber(line.markerPieceQty), 3);
}
export function computeMarkerLayoutLineSpreadLength(line, singleSpreadFixedLoss = DEFAULT_SINGLE_SPREAD_FIXED_LOSS) {
    return roundTo((safeNumber(line.markerLength) + safeNumber(singleSpreadFixedLoss)) * Math.max(safeNumber(line.repeatCount), 0), 2);
}
export function computeMarkerModeDetailSystemUnitUsage(line) {
    if (safeNumber(line.markerPieceQty) <= 0)
        return 0;
    return roundTo(safeNumber(line.markerLength) / safeNumber(line.markerPieceQty), 3);
}
export function computeMarkerModeDetailSpreadLength(line, singleSpreadFixedLoss = DEFAULT_SINGLE_SPREAD_FIXED_LOSS) {
    return roundTo((safeNumber(line.markerLength) + safeNumber(singleSpreadFixedLoss)) * Math.max(safeNumber(line.repeatCount), 0), 2);
}
export function computeMarkerHighLowMatrixTotal(cells) {
    return cells.reduce((sum, cell) => sum + Math.max(safeNumber(cell.qty), 0), 0);
}
export function computeMarkerFoldedEffectiveWidth(config) {
    return roundTo((safeNumber(config.originalEffectiveWidth) - safeNumber(config.foldAllowance)) / 2, 2);
}
export function computeMarkerFoldWidthCheckPassed(config) {
    return safeNumber(config.maxLayoutWidth) <= safeNumber(config.foldedEffectiveWidth);
}
export function computeMarkerAllocationSumBySize(allocationRows) {
    const summary = Object.fromEntries(MARKER_SIZE_CODES.map((sizeCode) => [sizeCode, 0]));
    allocationRows.forEach((row) => {
        summary[row.sizeCode] += Math.max(safeNumber(row.garmentQty), 0);
    });
    return summary;
}
export function computeMarkerAllocationDiffBySize(sizeRatioRows, allocationRows) {
    const ratioMap = Object.fromEntries(createEmptySizeRatioRows().map((row) => [row.sizeCode, 0]));
    sizeRatioRows.forEach((row) => {
        ratioMap[row.sizeCode] = Math.max(safeNumber(row.qty), 0);
    });
    const allocationMap = computeMarkerAllocationSumBySize(allocationRows);
    return Object.fromEntries(MARKER_SIZE_CODES.map((sizeCode) => [sizeCode, allocationMap[sizeCode] - ratioMap[sizeCode]]));
}
export function computeMarkerExplodedPieceQty(piecePerGarment, garmentQty) {
    return Math.max(safeNumber(piecePerGarment), 0) * Math.max(safeNumber(garmentQty), 0);
}
export function computeMarkerPlannedSpreadLength(plan) {
    if ('beds' in plan && Array.isArray(plan.beds) && plan.beds.length) {
        return roundTo(plan.beds.reduce((sum, bed) => sum + safeNumber(bed.spreadTotalLength), 0), 2);
    }
    if (plan.markerMode === 'normal' || plan.markerMode === 'fold_normal') {
        return roundTo(plan.layoutLines.reduce((sum, line) => sum + computeMarkerLayoutLineSpreadLength(line, plan.singleSpreadFixedLoss), 0), 2);
    }
    return roundTo(plan.modeDetailLines.reduce((sum, line) => sum + computeMarkerModeDetailSpreadLength(line, plan.singleSpreadFixedLoss), 0), 2);
}
export function deriveMarkerAllocationStatus(sizeRatioRows, allocationRows) {
    if (!allocationRows.length)
        return 'pending';
    const diffMap = computeMarkerAllocationDiffBySize(sizeRatioRows, allocationRows);
    return Object.values(diffMap).every((diff) => diff === 0) ? 'balanced' : 'unbalanced';
}
export function deriveMarkerMappingStatus(pieceRows) {
    if (!pieceRows.length)
        return 'pending';
    return pieceRows.some((row) => row.mappingStatus !== 'MATCHED') ? 'issue' : 'passed';
}
export function deriveMarkerLayoutStatus(plan) {
    if (Array.isArray(plan.beds) && plan.beds.length) {
        const hasReadyBeds = plan.beds.every((bed) => bed.readyForSpreading);
        if (!hasReadyBeds)
            return 'pending';
        if ((plan.markerMode === 'fold_normal' || plan.markerMode === 'fold_high_low') && !plan.foldConfig?.widthCheckPassed) {
            return 'pending';
        }
        return 'done';
    }
    const hasLayout = plan.markerMode === 'normal' || plan.markerMode === 'fold_normal'
        ? plan.layoutLines.some((line) => safeNumber(line.markerLength) > 0 && safeNumber(line.repeatCount) > 0 && safeNumber(line.markerPieceQty) > 0)
        : plan.modeDetailLines.some((line) => safeNumber(line.markerLength) > 0 && safeNumber(line.repeatCount) > 0 && safeNumber(line.markerPieceQty) > 0);
    if (!hasLayout)
        return 'pending';
    if ((plan.markerMode === 'fold_normal' || plan.markerMode === 'fold_high_low') && !plan.foldConfig?.widthCheckPassed) {
        return 'pending';
    }
    return 'done';
}
export function deriveMarkerImageStatus(imageCount) {
    return imageCount > 0 ? 'done' : 'pending';
}
export function deriveMarkerReadyForSpreading(plan) {
    return plan.confirmationStatus === '已确认';
}
export function deriveMarkerPlanStatus(plan) {
    if (plan.mappingStatus === 'issue')
        return 'MAPPING_ISSUE';
    if (plan.layoutStatus !== 'done')
        return 'WAITING_LAYOUT';
    if (plan.confirmationStatus === '已确认')
        return 'READY_FOR_SPREADING';
    return 'WAITING_LAYOUT';
}
export function deriveMarkerPlanDefaultTab(plan) {
    if (plan.lastVisitedTab === 'basic' || plan.lastVisitedTab === 'explosion' || plan.lastVisitedTab === 'layout')
        return plan.lastVisitedTab;
    if (plan.mappingStatus === 'issue')
        return 'explosion';
    if (plan.layoutStatus !== 'done')
        return 'layout';
    return 'layout';
}
export function buildMarkerTotalPiecesFormula(sizeRatioRows) {
    const rows = Array.isArray(sizeRatioRows) ? sizeRatioRows : [];
    const terms = rows.map((row) => `${formatIntegerFormulaValue(row.qty)} 件`);
    return `${formatIntegerFormulaValue(computeMarkerPlanTotalPieces(rows))} 件 = ${terms.length ? terms.join(' + ') : '0 件'}`;
}
export function buildMarkerSystemUnitUsageFormula(netLength, totalPieces) {
    return `${formatDecimalFormulaValue(computeMarkerPlanSystemUnitUsage(netLength, totalPieces), 3)} m/件 = ${formatDecimalFormulaValue(netLength, 2)} m ÷ ${formatIntegerFormulaValue(totalPieces)} 件`;
}
export function buildMarkerPlanSystemUnitUsageFormula(plan) {
    if (Array.isArray(plan.beds) && plan.beds.length) {
        const readyBeds = plan.beds.filter((bed) => safeNumber(bed.markerLength) > 0 && safeNumber(bed.plannedLayerCount) > 0 && safeNumber(bed.plannedGarmentQty) > 0);
        const plannedGarmentQty = readyBeds.reduce((sum, bed) => sum + Math.max(safeNumber(bed.plannedGarmentQty), 0), 0);
        const terms = readyBeds.length
            ? readyBeds.map((bed) => `${formatDecimalFormulaValue(bed.markerLength, 2)} m × ${formatIntegerFormulaValue(bed.plannedLayerCount)} 层（${bed.bedNo}）`)
            : ['0.00 m'];
        return `${formatDecimalFormulaValue(computeMarkerPlanSystemUnitUsageFromBeds(readyBeds), 3)} m/件 = (${terms.join(' + ')}) ÷ ${formatIntegerFormulaValue(plannedGarmentQty || plan.totalPieces)} 件`;
    }
    return buildMarkerSystemUnitUsageFormula(plan.netLength, plan.totalPieces);
}
export function buildMarkerFinalUnitUsageFormula(systemUnitUsage, manualUnitUsage) {
    const finalUnitUsage = computeMarkerPlanFinalUnitUsage(systemUnitUsage, manualUnitUsage);
    return manualUnitUsage == null
        ? `${formatDecimalFormulaValue(finalUnitUsage, 3)} m/件 = ${formatDecimalFormulaValue(systemUnitUsage, 3)} m/件`
        : `${formatDecimalFormulaValue(finalUnitUsage, 3)} m/件 = ${formatDecimalFormulaValue(manualUnitUsage, 3)} m/件`;
}
export function buildMarkerAllocationSumFormula(sizeCode, allocationRows) {
    const matchedRows = allocationRows.filter((row) => row.sizeCode === sizeCode);
    const terms = matchedRows.length
        ? matchedRows.map((row) => `${formatIntegerFormulaValue(row.garmentQty)} 件`)
        : ['0 件'];
    return `${formatIntegerFormulaValue(computeMarkerAllocationSumBySize(allocationRows)[sizeCode])} 件 = ${terms.join(' + ')}`;
}
export function buildMarkerAllocationDiffFormula(sizeCode, sizeRatioRows, allocationRows) {
    const ratioQty = sizeRatioRows.find((row) => row.sizeCode === sizeCode)?.qty || 0;
    const allocationQty = computeMarkerAllocationSumBySize(allocationRows)[sizeCode];
    const diffQty = computeMarkerAllocationDiffBySize(sizeRatioRows, allocationRows)[sizeCode];
    const diffText = diffQty >= 0 ? formatIntegerFormulaValue(diffQty) : `-${formatIntegerFormulaValue(Math.abs(diffQty))}`;
    return `${diffText} 件 = ${formatIntegerFormulaValue(allocationQty)} 件 - ${formatIntegerFormulaValue(ratioQty)} 件`;
}
export function buildMarkerExplodedPieceQtyFormula(piecePerGarment, garmentQty) {
    return `${formatIntegerFormulaValue(computeMarkerExplodedPieceQty(piecePerGarment, garmentQty))} 片 = ${formatIntegerFormulaValue(piecePerGarment)} 片/件 × ${formatIntegerFormulaValue(garmentQty)} 件`;
}
export function buildMarkerSkuExplodedPieceQtyFormula(rows) {
    const total = rows.reduce((sum, row) => sum + Math.max(safeNumber(row.explodedPieceQty), 0), 0);
    const terms = rows.length ? rows.map((row) => `${formatIntegerFormulaValue(row.explodedPieceQty)} 片`) : ['0 片'];
    return `${formatIntegerFormulaValue(total)} 片 = ${terms.join(' + ')}`;
}
export function buildMarkerLayoutLineSystemUnitUsageFormula(line) {
    return `${formatDecimalFormulaValue(computeMarkerLayoutLineSystemUnitUsage(line), 3)} m/件 = ${formatDecimalFormulaValue(line.markerLength, 2)} m ÷ ${formatIntegerFormulaValue(line.markerPieceQty)} 件`;
}
export function buildMarkerLayoutLineSpreadLengthFormula(line, singleSpreadFixedLoss = DEFAULT_SINGLE_SPREAD_FIXED_LOSS) {
    return `${formatDecimalFormulaValue(computeMarkerLayoutLineSpreadLength(line, singleSpreadFixedLoss), 2)} m = (${formatDecimalFormulaValue(line.markerLength, 2)} m + ${formatDecimalFormulaValue(singleSpreadFixedLoss, 2)} m) × ${formatIntegerFormulaValue(line.repeatCount)}`;
}
export function buildMarkerModeDetailSystemUnitUsageFormula(line) {
    return `${formatDecimalFormulaValue(computeMarkerModeDetailSystemUnitUsage(line), 3)} m/件 = ${formatDecimalFormulaValue(line.markerLength, 2)} m ÷ ${formatIntegerFormulaValue(line.markerPieceQty)} 件`;
}
export function buildMarkerModeDetailSpreadLengthFormula(line, singleSpreadFixedLoss = DEFAULT_SINGLE_SPREAD_FIXED_LOSS) {
    return `${formatDecimalFormulaValue(computeMarkerModeDetailSpreadLength(line, singleSpreadFixedLoss), 2)} m = (${formatDecimalFormulaValue(line.markerLength, 2)} m + ${formatDecimalFormulaValue(singleSpreadFixedLoss, 2)} m) × ${formatIntegerFormulaValue(line.repeatCount)}`;
}
export function buildMarkerHighLowMatrixTotalFormula(cells) {
    const terms = cells.length ? cells.map((cell) => `${formatIntegerFormulaValue(cell.qty)} 件`) : ['0 件'];
    return `${formatIntegerFormulaValue(computeMarkerHighLowMatrixTotal(cells))} 件 = ${terms.join(' + ')}`;
}
export function buildMarkerFoldedEffectiveWidthFormula(config) {
    return `${formatDecimalFormulaValue(computeMarkerFoldedEffectiveWidth(config), 2)} cm = (${formatDecimalFormulaValue(config.originalEffectiveWidth, 2)} cm - ${formatDecimalFormulaValue(config.foldAllowance, 2)} cm) ÷ 2`;
}
export function buildMarkerPlannedSpreadLengthFormula(plan) {
    if (Array.isArray(plan.beds) && plan.beds.length) {
        const terms = plan.beds.map((bed) => `(${formatDecimalFormulaValue(bed.markerLength, 2)} m + ${formatDecimalFormulaValue(plan.singleSpreadFixedLoss, 2)} m) × ${formatIntegerFormulaValue(bed.plannedLayerCount)} 层（${bed.bedNo}）`);
        return `${formatDecimalFormulaValue(computeMarkerPlannedSpreadLength(plan), 2)} m = ${terms.join(' + ')}`;
    }
    const lineValues = plan.markerMode === 'normal' || plan.markerMode === 'fold_normal'
        ? plan.layoutLines.map((line) => computeMarkerLayoutLineSpreadLength(line, plan.singleSpreadFixedLoss))
        : plan.modeDetailLines.map((line) => computeMarkerModeDetailSpreadLength(line, plan.singleSpreadFixedLoss));
    const terms = lineValues.length ? lineValues.map((value) => `${formatDecimalFormulaValue(value, 2)} m`) : ['0.00 m'];
    return `${formatDecimalFormulaValue(computeMarkerPlannedSpreadLength(plan), 2)} m = ${terms.join(' + ')}`;
}
