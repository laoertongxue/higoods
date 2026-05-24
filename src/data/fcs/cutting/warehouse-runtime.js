import { buildCuttingCoreRegistry } from '../../../domain/cutting-core/index.ts';
import { productionOrders } from '../production-orders.ts';
import { listGeneratedCutOrderSourceRecords } from './generated-cut-orders.ts';
import { buildGeneratedFeiTicketTraceMatrix, listSpreadingResultGeneratedFeiTickets } from './generated-fei-tickets.ts';
import { cuttingOrderProgressRecords } from './order-progress.ts';
import { buildSpreadingDrivenTransferBagTraceMatrix, buildSystemSeedTransferBagRuntime } from './transfer-bag-runtime.ts';
const numberFormatter = new Intl.NumberFormat('zh-CN');
const registry = buildCuttingCoreRegistry();
const productionOrderById = new Map(productionOrders.map((order) => [order.productionOrderId, order]));
function resolveSourceProductionOrderNo(source) {
    const rawOrderNo = source.productionOrderNo || productionOrderById.get(source.productionOrderId)?.productionOrderNo;
    return String(rawOrderNo || source.productionOrderId || source.cutOrderNo || '').trim();
}
const progressLineByCutOrderId = new Map();
const progressLineByCutOrderNo = new Map();
const progressRecordByCutOrderId = new Map();
const progressRecordByCutOrderNo = new Map();
cuttingOrderProgressRecords.forEach((record) => {
    record.materialLines.forEach((line) => {
        if (line.cutOrderId) {
            progressLineByCutOrderId.set(line.cutOrderId, line);
            progressRecordByCutOrderId.set(line.cutOrderId, record);
        }
        if (line.cutOrderNo) {
            progressLineByCutOrderNo.set(line.cutOrderNo, line);
            progressRecordByCutOrderNo.set(line.cutOrderNo, record);
        }
    });
});
function cloneFlowHistory(items) {
    return items.map((item) => ({ ...item }));
}
function cloneFabricRecord(record) {
    return { ...record };
}
function cloneCutPieceRecord(record) {
    return { ...record };
}
function cloneSampleRecord(record) {
    return {
        ...record,
        flowHistory: cloneFlowHistory(record.flowHistory),
    };
}
function unique(values) {
    return Array.from(new Set(values));
}
function resolveProgressLine(cutOrderId, cutOrderNo) {
    return progressLineByCutOrderId.get(cutOrderId) || progressLineByCutOrderNo.get(cutOrderNo) || null;
}
function resolveProgressRecord(cutOrderId, cutOrderNo) {
    return progressRecordByCutOrderId.get(cutOrderId) || progressRecordByCutOrderNo.get(cutOrderNo) || null;
}
function resolveConfiguredLength(requiredQty, materialType) {
    const multiplier = materialType === 'LINING' ? 0.85 : materialType === 'PRINT' ? 1.35 : 1.15;
    return Math.max(48, Math.round(requiredQty * multiplier));
}
function resolveConfiguredRollCount(configuredLength) {
    return Math.max(1, Math.ceil(configuredLength / 58));
}
function resolveUsageByReceiveStatus(options) {
    const { receiveStatus, configuredRollCount, configuredLength, sequence } = options;
    if (receiveStatus === 'PARTIAL') {
        return {
            fabricState: 'NEED_RECHECK',
            usedRollCount: Math.max(1, Math.floor(configuredRollCount * 0.6)),
            usedLength: Math.round(configuredLength * 0.62),
        };
    }
    if (receiveStatus === 'RECEIVED') {
        const partial = sequence % 3 === 0;
        return {
            fabricState: partial ? 'PARTIAL_USED' : 'READY',
            usedRollCount: partial ? Math.max(1, configuredRollCount - 1) : configuredRollCount,
            usedLength: partial ? Math.round(configuredLength * 0.82) : configuredLength,
        };
    }
    return {
        fabricState: 'READY',
        usedRollCount: 0,
        usedLength: 0,
    };
}
function buildFabricActionText(line, cutOrderNo) {
    if (line?.latestActionText)
        return line.latestActionText;
    return `裁片单 ${cutOrderNo} 的裁床仓记录已切到正式主源，待现场继续确认领用节奏。`;
}
function buildPieceSummaryText(requiredQty, pieceName) {
    return `${pieceName} ${numberFormatter.format(Math.max(requiredQty, 0))} 件，已进入正式裁片仓读链。`;
}
function buildSampleFlowHistory(options) {
    const base = options.latestActionAt.slice(0, 10);
    const initialBy = '样衣管理员 陈如意';
    const initialHistory = [
        {
            stage: 'DESIGN_CENTER',
            actionText: `设计中心完成 ${options.sampleName}`,
            operatedBy: '设计师 林若彤',
            operatedAt: `${base} 09:00`,
            note: `${options.sampleNo} 首版样衣完成。`,
        },
        {
            stage: 'PMC_WAREHOUSE',
            actionText: '样衣进入 PMC 仓库',
            operatedBy: initialBy,
            operatedAt: `${base} 12:00`,
            note: '等待裁床或工厂调用。',
        },
    ];
    if (options.currentLocationStage === 'PMC_WAREHOUSE' || options.currentLocationStage === 'BACK_TO_PMC') {
        return initialHistory.concat({
            stage: 'BACK_TO_PMC',
            actionText: '样衣回到 PMC 仓库',
            operatedBy: options.latestActionBy,
            operatedAt: options.latestActionAt,
            note: '当前可再次调用。',
        });
    }
    return initialHistory.concat({
        stage: options.currentLocationStage,
        actionText: options.currentLocationStage === 'CUTTING'
            ? '裁床调用样衣'
            : options.currentLocationStage === 'FACTORY_CHECK'
                ? '工厂核价调用样衣'
                : '样衣进入回仓抽检',
        operatedBy: options.latestActionBy,
        operatedAt: options.latestActionAt,
        note: options.currentLocationStage === 'CUTTING'
            ? '用于裁片版位和工艺确认。'
            : options.currentLocationStage === 'FACTORY_CHECK'
                ? '用于工厂侧工艺与核价确认。'
                : '用于回仓抽检与复核。',
    });
}
function buildFormalWarehouseRuntimeCache() {
    const cutOrderSources = listGeneratedCutOrderSourceRecords();
    const fabric = cutOrderSources.map((source, index) => {
        const productionOrderNo = resolveSourceProductionOrderNo(source);
        const progressLine = resolveProgressLine(source.cutOrderId, source.cutOrderNo);
        const progressRecord = resolveProgressRecord(source.cutOrderId, source.cutOrderNo);
        const cutOrderRef = registry.cutOrdersById[source.cutOrderId];
        const configuredLength = progressLine?.configuredLength || resolveConfiguredLength(source.requiredQty, source.materialType);
        const configuredRollCount = progressLine?.configuredRollCount || resolveConfiguredRollCount(configuredLength);
        const usage = resolveUsageByReceiveStatus({
            receiveStatus: progressLine?.receiveStatus || 'NOT_RECEIVED',
            configStatus: progressLine?.configStatus || 'NOT_CONFIGURED',
            configuredRollCount,
            configuredLength,
            sequence: index,
        });
        const usedRollCount = Math.min(configuredRollCount, usage.usedRollCount);
        const usedLength = Math.min(configuredLength, usage.usedLength);
        const remainingRollCount = Math.max(configuredRollCount - usedRollCount, 0);
        const remainingLength = Math.max(configuredLength - usedLength, 0);
        return {
            id: `formal-fabric-${source.cutOrderId}`,
            warehouseType: 'CUTTING_FABRIC',
            bindingState: 'BOUND_FORMAL_WAREHOUSE_RECORD',
            cutOrderId: source.cutOrderId,
            cutOrderNo: source.cutOrderNo,
            productionOrderId: source.productionOrderId,
            productionOrderNo,
            markerPlanId: cutOrderRef?.activeMarkerPlanRefId || '',
            markerPlanNo: cutOrderRef?.activeMarkerPlanRefNo || '',
            cutPieceOrderNo: source.cutOrderNo,
            materialSku: source.materialSku,
            materialType: source.materialType,
            materialLabel: source.materialLabel,
            materialAlias: source.materialAlias,
            materialImageUrl: source.materialImageUrl,
            configuredRollCount,
            configuredLength,
            usedRollCount,
            usedLength,
            remainingRollCount,
            remainingLength,
            latestConfigAt: progressRecord?.lastFieldUpdateAt || progressRecord?.purchaseDate || productionOrderById.get(source.productionOrderId)?.createdAt || '',
            latestReceiveAt: progressLine?.receiveStatus === 'NOT_RECEIVED' ? '' : progressRecord?.lastPickupScanAt || progressRecord?.lastFieldUpdateAt || '',
            latestActionText: buildFabricActionText(progressLine, source.cutOrderNo),
            fabricState: usage.fabricState,
            note: usage.fabricState === 'NEED_RECHECK' ? '当前裁床领料 / 使用记录存在差异，需继续核对。' : '当前仓务读链已切换到正式裁片单主码。',
        };
    });
    const cutPiece = cutOrderSources.map((source, index) => {
        const productionOrderNo = resolveSourceProductionOrderNo(source);
        const progressLine = resolveProgressLine(source.cutOrderId, source.cutOrderNo);
        const progressRecord = resolveProgressRecord(source.cutOrderId, source.cutOrderNo);
        const cutOrderRef = registry.cutOrdersById[source.cutOrderId];
        const inboundStatus = progressRecord?.hasInboundRecord || (progressLine?.pieceProgressLines || []).some((line) => Number(line.inboundQty || 0) > 0)
            ? index % 5 === 0
                ? 'HANDED_OVER'
                : 'WAITING_HANDOVER'
            : 'PENDING_INBOUND';
        const zoneCode = inboundStatus === 'PENDING_INBOUND' ? 'UNASSIGNED' : ['A', 'B', 'C'][index % 3];
        const latestActor = progressRecord?.lastOperatorName || '裁片仓 库管';
        const quantity = (progressLine?.pieceProgressLines || []).reduce((sum, line) => sum + Number(line.actualCutQty || line.inboundQty || 0), 0) || Math.max(source.requiredQty, 12);
        const pieceName = source.pieceRows[0]?.partName || '裁片主片';
        return {
            id: `formal-cut-piece-${source.cutOrderId}`,
            warehouseType: 'CUT_PIECE',
            bindingState: 'BOUND_FORMAL_WAREHOUSE_RECORD',
            cutOrderId: source.cutOrderId,
            cutOrderNo: source.cutOrderNo,
            productionOrderId: source.productionOrderId,
            productionOrderNo,
            markerPlanId: cutOrderRef?.activeMarkerPlanRefId || '',
            markerPlanNo: cutOrderRef?.activeMarkerPlanRefNo || '',
            cutPieceOrderNo: source.cutOrderNo,
            materialSku: source.materialSku,
            groupNo: cutOrderRef?.activeMarkerPlanRefNo || `${source.materialSku}-主组`,
            zoneCode,
            locationLabel: zoneCode === 'UNASSIGNED' ? '待分区' : `${zoneCode} 区 ${String((index % 4) + 1)} 组`,
            inboundStatus,
            inboundAt: inboundStatus === 'PENDING_INBOUND' ? '' : progressRecord?.lastFieldUpdateAt || productionOrderById.get(source.productionOrderId)?.updatedAt || '',
            inboundBy: inboundStatus === 'PENDING_INBOUND' ? '' : latestActor,
            pieceSummary: buildPieceSummaryText(quantity, pieceName),
            handoverStatus: inboundStatus === 'HANDED_OVER' ? 'HANDED_OVER' : 'WAITING_HANDOVER',
            handoverTarget: inboundStatus === 'HANDED_OVER' ? '已交接后道缝制' : '待后道交接',
            note: progressLine?.latestActionText || `裁片单 ${source.cutOrderNo} 的裁片仓记录已切换到正式仓务读链。`,
        };
    });
    const sample = [];
    const seenProductionOrders = new Set();
    cutOrderSources.forEach((source, index) => {
        if (seenProductionOrders.has(source.productionOrderId))
            return;
        seenProductionOrders.add(source.productionOrderId);
        const productionOrder = productionOrderById.get(source.productionOrderId);
        const productionOrderNo = resolveSourceProductionOrderNo(source);
        const statusPattern = index % 4;
        const latestActionAt = productionOrder?.updatedAt || productionOrder?.createdAt || '2026-03-27 09:00';
        const latestActionBy = statusPattern === 0 ? '样衣管理员 陈如意' : statusPattern === 1 ? 'PMC 样衣管理员 林佩琪' : statusPattern === 2 ? '抽检员 周雅晴' : '裁床组 黄秀娟';
        const currentLocationStage = statusPattern === 0 ? 'CUTTING' : statusPattern === 1 ? 'FACTORY_CHECK' : statusPattern === 2 ? 'BACK_TO_PMC' : 'RETURN_CHECK';
        const currentStatus = statusPattern === 0 ? 'IN_USE' : statusPattern === 1 ? 'WAITING_RETURN' : statusPattern === 2 ? 'AVAILABLE' : 'CHECKING';
        const sampleNo = `SMP-${productionOrderNo.replace(/[^0-9]/g, '').slice(-6) || source.cutOrderNo.slice(-6)}`;
        const sampleName = `${productionOrder?.demandSnapshot.spuName || source.sourceTechPackSpuCode || source.cutOrderNo} 样衣`;
        const nextSuggestedAction = currentStatus === 'IN_USE'
            ? '裁床参考结束后归还 PMC 仓库。'
            : currentStatus === 'WAITING_RETURN'
                ? '样衣核价完成后归还，并安排抽检复核。'
                : currentStatus === 'CHECKING'
                    ? '抽检完成后回到 PMC 仓库。'
                    : '下次裁床启动前可再次调用。';
        sample.push({
            id: `formal-sample-${source.productionOrderId}`,
            warehouseType: 'SAMPLE',
            bindingState: 'BOUND_FORMAL_SAMPLE_RECORD',
            cutOrderId: source.cutOrderId,
            cutOrderNo: source.cutOrderNo,
            productionOrderId: source.productionOrderId,
            productionOrderNo,
            sampleNo,
            sampleName,
            relatedProductionOrderNo: productionOrderNo,
            relatedCutPieceOrderNo: source.cutOrderNo,
            currentLocationStage,
            currentHolder: currentStatus === 'IN_USE'
                ? '裁床组 黄秀娟'
                : currentStatus === 'WAITING_RETURN'
                    ? '工厂核价组 吴晓莹'
                    : currentStatus === 'CHECKING'
                        ? '抽检员 周雅晴'
                        : 'PMC 样衣仓',
            currentStatus,
            latestActionAt,
            latestActionBy,
            nextSuggestedAction,
            flowHistory: buildSampleFlowHistory({
                sampleItemId: `formal-sample-${source.productionOrderId}`,
                sampleNo,
                sampleName,
                currentLocationStage,
                latestActionAt,
                latestActionBy,
            }),
        });
    });
    const alerts = [];
    const firstUnassigned = cutPiece.find((item) => item.zoneCode === 'UNASSIGNED');
    if (firstUnassigned) {
        alerts.push({
            id: 'formal-wa-unassigned',
            warehouseAlertType: 'UNASSIGNED_ZONE',
            level: 'HIGH',
            title: '裁片待分区',
            description: `${firstUnassigned.cutOrderNo} 仍待裁片仓分配区域。`,
            relatedNo: firstUnassigned.cutOrderNo,
            suggestedAction: '优先完成入仓分区，避免后续查找与交接延迟。',
        });
    }
    const firstNeedRecheck = fabric.find((item) => item.fabricState === 'NEED_RECHECK');
    if (firstNeedRecheck) {
        alerts.push({
            id: 'formal-wa-stock-recheck',
            warehouseAlertType: 'STOCK_RECHECK',
            level: 'HIGH',
            title: '裁床仓余量待核对',
            description: `${firstNeedRecheck.materialSku} 当前存在裁床领料或余量差异待核对。`,
            relatedNo: firstNeedRecheck.materialSku,
            suggestedAction: '先核对裁床仓余料，再推进后续仓务收口。',
        });
    }
    const firstOverdueSample = sample.find((item) => item.currentStatus === 'WAITING_RETURN');
    if (firstOverdueSample) {
        alerts.push({
            id: 'formal-wa-sample-overdue',
            warehouseAlertType: 'SAMPLE_OVERDUE',
            level: 'MEDIUM',
            title: '样衣待归还',
            description: `${firstOverdueSample.sampleNo} 当前仍在外部环节流转。`,
            relatedNo: firstOverdueSample.sampleNo,
            suggestedAction: '联系当前持有人完成样衣归还与抽检。',
        });
    }
    if (cutPiece.some((item) => item.handoverStatus === 'WAITING_HANDOVER')) {
        alerts.push({
            id: 'formal-wa-space-risk',
            warehouseAlertType: 'SPACE_RISK',
            level: 'LOW',
            title: '裁片待交接',
            description: '当前仍存在待交接裁片组，建议优先核对发后道节奏。',
            relatedNo: '裁片仓',
            suggestedAction: '优先处理已入仓待后道交接的裁片组。',
        });
    }
    return { fabric, cutPiece, sample, alerts };
}
let cachedRuntime = null;
function getCache() {
    if (!cachedRuntime) {
        cachedRuntime = buildFormalWarehouseRuntimeCache();
    }
    return cachedRuntime;
}
export function listFormalFabricWarehouseRecords() {
    return getCache().fabric.map(cloneFabricRecord);
}
export function listFormalCutPieceWarehouseRecords() {
    return getCache().cutPiece.map(cloneCutPieceRecord);
}
export function listFormalSampleWarehouseRecords() {
    return getCache().sample.map(cloneSampleRecord);
}
export const cuttingFabricStockRecords = listFormalFabricWarehouseRecords();
export const cutPieceWarehouseRecords = listFormalCutPieceWarehouseRecords();
export const sampleWarehouseRecords = listFormalSampleWarehouseRecords();
export const warehouseAlertRecords = getCache().alerts.map((item) => ({ ...item }));
export function cloneWarehouseManagementData() {
    return {
        fabricStocks: listFormalFabricWarehouseRecords(),
        cutPieceRecords: listFormalCutPieceWarehouseRecords(),
        sampleRecords: listFormalSampleWarehouseRecords(),
        alerts: warehouseAlertRecords.map((item) => ({ ...item })),
    };
}
export function buildWarehouseRuntimeTraceMatrix(records = listFormalCutPieceWarehouseRecords()) {
    const cutOrderRows = listGeneratedCutOrderSourceRecords();
    const cutOrderRowsById = new Map(cutOrderRows.map((record) => [record.cutOrderId, record]));
    const feiTraceById = new Map(buildGeneratedFeiTicketTraceMatrix().map((row) => [row.feiTicketId, row]));
    const transferTraceRows = buildSpreadingDrivenTransferBagTraceMatrix(buildSystemSeedTransferBagRuntime({
        cutOrderRows: cutOrderRows.map((record) => ({
            cutOrderId: record.cutOrderId,
            cutOrderNo: record.cutOrderNo,
            productionOrderNo: record.productionOrderNo,
            styleCode: record.styleCode,
            spuCode: record.sourceTechPackSpuCode || '',
            color: record.colorScope[0] || '',
            materialSku: record.materialSku,
            plannedQty: record.requiredQty,
        })),
        ticketRecords: listSpreadingResultGeneratedFeiTickets().map((record) => {
            const sourceCutOrder = cutOrderRowsById.get(record.cutOrderId);
            const trace = feiTraceById.get(record.feiTicketId);
            return {
                feiTicketId: record.feiTicketId,
                feiTicketNo: record.feiTicketNo,
                sourceSpreadingSessionId: record.sourceSpreadingSessionId,
                sourceSpreadingSessionNo: record.sourceSpreadingSessionNo,
                sourceMarkerId: record.sourceMarkerId,
                sourceMarkerNo: record.sourceMarkerNo,
                sourceWritebackId: trace?.sourceWritebackId || '',
                cutOrderId: record.cutOrderId,
                cutOrderNo: record.cutOrderNo,
                productionOrderNo: record.productionOrderNo,
                markerPlanNo: record.sourceMarkerPlanNo,
                styleCode: sourceCutOrder?.styleCode || '',
                spuCode: record.sourceTechPackSpuCode || sourceCutOrder?.sourceTechPackSpuCode || '',
                color: record.skuColor,
                size: record.skuSize,
                partName: record.partName,
                qty: record.garmentQty,
                materialSku: record.materialSku,
                sourceContextType: record.sourceMarkerPlanId ? 'marker-plan-ref' : 'cut-order',
                status: 'PRINTED',
            };
        }),
    }));
    return records
        .map((record) => {
        const matchedTransferRow = transferTraceRows.find((row) => row.cutOrderId === record.cutOrderId &&
            (!record.markerPlanNo || !row.markerPlanNo || row.markerPlanNo === record.markerPlanNo)) ||
            transferTraceRows.find((row) => row.cutOrderId === record.cutOrderId) ||
            null;
        return {
            warehouseRecordId: record.id,
            cutOrderId: record.cutOrderId,
            cutOrderNo: record.cutOrderNo,
            markerPlanId: record.markerPlanId,
            markerPlanNo: record.markerPlanNo,
            materialSku: record.materialSku,
            cutPieceOrderNo: record.cutPieceOrderNo,
            spreadingSessionId: matchedTransferRow?.sourceSpreadingSessionId || '',
            spreadingSessionNo: matchedTransferRow?.sourceSpreadingSessionNo || '',
            sourceMarkerId: matchedTransferRow?.sourceMarkerId || '',
            sourceMarkerNo: matchedTransferRow?.sourceMarkerNo || '',
            feiTicketId: matchedTransferRow?.feiTicketId || '',
            feiTicketNo: matchedTransferRow?.feiTicketNo || '',
            bagId: matchedTransferRow?.bagId || '',
            bagCode: matchedTransferRow?.bagCode || '',
            transferBatchId: matchedTransferRow?.transferBatchId || '',
            sourceWritebackId: matchedTransferRow?.sourceWritebackId || '',
            inboundStatus: record.inboundStatus,
            handoverStatus: record.handoverStatus,
        };
    })
        .sort((left, right) => left.cutOrderNo.localeCompare(right.cutOrderNo, 'zh-CN')
        || left.warehouseRecordId.localeCompare(right.warehouseRecordId, 'zh-CN'));
}
export function buildSpreadingDrivenWarehouseTraceMatrix(records = listFormalCutPieceWarehouseRecords()) {
    return buildWarehouseRuntimeTraceMatrix(records).filter((record) => Boolean(record.spreadingSessionId));
}
