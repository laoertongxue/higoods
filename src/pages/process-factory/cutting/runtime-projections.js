import { buildFcsCuttingDomainSnapshot, } from '../../../domain/fcs-cutting-runtime/index.ts';
import { buildCutPieceWarehouseViewModel } from './cut-piece-warehouse-model.ts';
import { buildFabricWarehouseViewModel } from './fabric-warehouse-model.ts';
import { buildFeiTicketsViewModel, buildSystemSeedFeiTicketLedger, } from './fei-tickets-model.ts';
import { buildMaterialPrepViewModel } from './material-prep-model.ts';
import { buildCutOrderViewModel } from './cut-orders-model.ts';
import { buildProductionProgressRows } from './production-progress-model.ts';
import { buildReplenishmentViewModel, } from './replenishment-model.ts';
import { buildSampleWarehouseViewModel } from './sample-warehouse-model.ts';
import { buildSpecialProcessViewModel, } from './special-processes-model.ts';
import { buildSummaryDetailPanelData, buildCuttingSummaryViewModel, } from './summary-model.ts';
import { buildSystemSeedTransferBagStore, buildTransferBagViewModel, mergeTransferBagStores, } from './transfer-bags-model.ts';
import { buildTransferBagReturnViewModel } from './transfer-bag-return-model.ts';
import { readStoredMarkerPlanOccupancyLookup } from './marker-plan-occupancy.ts';
function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
}
function mergeByKey(seed, stored, key) {
    const merged = new Map();
    seed.forEach((item) => merged.set(String(item[key]), item));
    stored.forEach((item) => merged.set(String(item[key]), item));
    return Array.from(merged.values());
}
function parseMarkerPlanRefDate(markerPlanNo) {
    const match = markerPlanNo.match(/(\d{2})(\d{2})(\d{2})/);
    if (!match)
        return '';
    return `20${match[1]}-${match[2]}-${match[3]}`;
}
function inferSourceMarkerPlanRefStatus(rows) {
    if (rows.some((row) => row.currentStage.key === 'INBOUND'))
        return 'DONE';
    if (rows.some((row) => ['CUTTING', 'IN_MARKER_PLAN'].includes(row.currentStage.key)))
        return 'CUTTING';
    return 'READY';
}
function buildSourceMarkerPlanRefItems(source) {
    return source.cutOrderRows.map((row) => ({
        markerPlanId: source.markerPlanId,
        cutOrderId: row.cutOrderId,
        cutOrderNo: row.cutOrderNo,
        productionOrderId: row.productionOrderId,
        productionOrderNo: row.productionOrderNo,
        styleCode: row.styleCode,
        spuCode: row.spuCode,
        styleName: row.styleName,
        urgencyLabel: row.urgencyLabel,
        plannedShipDate: row.plannedShipDate,
        plannedShipDateDisplay: row.plannedShipDate,
        materialSku: row.materialSku,
        materialCategory: row.materialCategory,
        materialLabel: row.materialLabel,
        currentStage: row.currentStage.label,
        cuttableStateLabel: row.cuttableState.label,
        sourceMarkerPlaningKey: `${row.styleCode}::${row.materialSku}`,
    }));
}
function buildRuntimeMarkerPlanRefRecords(snapshot, cutOrderRows) {
    const cutOrderRowsById = Object.fromEntries(cutOrderRows.map((row) => [row.cutOrderId, row]));
    const sourceRecords = snapshot.markerPlanRefState.sourceRecords
        .map((record) => {
        const rows = record.sourceCutOrderIds
            .map((id) => cutOrderRowsById[id])
            .filter((row) => Boolean(row));
        if (!rows.length)
            return null;
        const materialSkuSummary = unique(rows.map((row) => row.materialSku)).join(' / ');
        return {
            markerPlanId: record.markerPlanId,
            markerPlanNo: record.markerPlanNo,
            status: inferSourceMarkerPlanRefStatus(rows),
            markerPlanGroupKey: `${rows[0]?.styleCode || ''}::${materialSkuSummary}`,
            styleCode: rows[0]?.styleCode || '',
            spuCode: rows[0]?.spuCode || '',
            styleName: rows[0]?.styleName || '',
            materialSkuSummary,
            sourceProductionOrderCount: unique(rows.map((row) => row.productionOrderId)).length,
            sourceCutOrderCount: rows.length,
            plannedCuttingGroup: '',
            plannedCuttingDate: parseMarkerPlanRefDate(record.markerPlanNo),
            note: '来源于裁片 runtime 主源聚合。',
            createdFrom: 'system-seed',
            createdAt: parseMarkerPlanRefDate(record.markerPlanNo) ? `${parseMarkerPlanRefDate(record.markerPlanNo)} 09:00` : '',
            updatedAt: parseMarkerPlanRefDate(record.markerPlanNo) ? `${parseMarkerPlanRefDate(record.markerPlanNo)} 09:00` : '',
            items: buildSourceMarkerPlanRefItems({
                markerPlanId: record.markerPlanId,
                cutOrderRows: rows,
            }),
        };
    })
        .filter((record) => record !== null);
    return mergeByKey(sourceRecords, snapshot.markerPlanRefState.storedRecords, 'markerPlanId');
}
function buildCutOrderRows(snapshot, markerPlanRefs, progressRows) {
    return buildCutOrderViewModel(snapshot.progressRecords, markerPlanRefs, {
        progressRows,
        markerPlanOccupancy: readStoredMarkerPlanOccupancyLookup(),
    }).rows;
}
function buildFeiLedger(options) {
    const systemFeiLedger = buildSystemSeedFeiTicketLedger({
        cutOrderRows: options.cutOrderRows,
        materialPrepRows: options.materialPrepRows,
        markerPlanRefs: options.markerPlanRefs,
        markerStore: options.markerStore,
    });
    return {
        drafts: options.snapshot.feiTicketState.drafts,
        ticketRecords: mergeByKey(systemFeiLedger.ticketRecords, options.snapshot.feiTicketState.ticketRecords, 'ticketRecordId'),
        printJobs: mergeByKey(systemFeiLedger.printJobs, options.snapshot.feiTicketState.printJobs, 'printJobId'),
    };
}
function buildTransferBagStore(snapshot, cutOrderRows, ticketRecords, markerPlanRefs) {
    const seed = buildSystemSeedTransferBagStore({
        cutOrderRows,
        ticketRecords,
        markerPlanRefs,
    });
    return mergeTransferBagStores(seed, snapshot.transferBagState.store);
}
export function mapCuttingDomainSnapshotToSummaryBuildOptions(snapshot) {
    const progressRows = buildProductionProgressRows(snapshot.progressRecords, {
        pickupWritebacks: snapshot.pdaExecutionState.pickupWritebacks,
        inboundWritebacks: snapshot.pdaExecutionState.inboundWritebacks,
        handoverWritebacks: snapshot.pdaExecutionState.handoverWritebacks,
        replenishmentFeedbackWritebacks: snapshot.pdaExecutionState.replenishmentFeedbackWritebacks,
    });
    const seedCutOrderRows = buildCutOrderRows(snapshot, [], progressRows);
    const markerPlanRefs = buildRuntimeMarkerPlanRefRecords(snapshot, seedCutOrderRows);
    const cutOrderRows = buildCutOrderRows(snapshot, markerPlanRefs, progressRows);
    const materialPrepRows = buildMaterialPrepViewModel(snapshot.progressRecords, markerPlanRefs, {
        pickupWritebacks: snapshot.pdaExecutionState.pickupWritebacks,
    }).rows;
    const markerStore = snapshot.markerSpreadingState.store;
    const feiLedger = buildFeiLedger({
        snapshot,
        cutOrderRows,
        materialPrepRows,
        markerPlanRefs,
        markerStore,
    });
    const feiViewModel = buildFeiTicketsViewModel({
        cutOrderRows,
        materialPrepRows,
        markerPlanRefs,
        markerStore,
        ticketRecords: feiLedger.ticketRecords,
        printJobs: feiLedger.printJobs,
        drafts: feiLedger.drafts,
        prefilter: null,
    });
    const fabricWarehouseView = buildFabricWarehouseViewModel(cutOrderRows, snapshot.warehouseState.fabricStocks);
    const cutPieceWarehouseView = buildCutPieceWarehouseViewModel(cutOrderRows, snapshot.warehouseState.cutPieceRecords, {
        inboundWritebacks: snapshot.pdaExecutionState.inboundWritebacks,
        handoverWritebacks: snapshot.pdaExecutionState.handoverWritebacks,
        warehouseWritebacks: snapshot.warehouseState.cutPieceWritebacks,
    });
    const sampleWarehouseView = buildSampleWarehouseViewModel(cutOrderRows, snapshot.warehouseState.sampleRecords, {
        sampleWritebacks: snapshot.warehouseState.sampleWritebacks,
    });
    const transferStore = buildTransferBagStore(snapshot, cutOrderRows, feiLedger.ticketRecords, markerPlanRefs);
    const transferBagView = buildTransferBagViewModel({
        cutOrderRows,
        ticketRecords: feiLedger.ticketRecords,
        markerPlanRefs,
        store: transferStore,
    });
    const transferBagReturnView = buildTransferBagReturnViewModel({
        store: transferStore,
        baseViewModel: transferBagView,
    });
    const replenishmentView = buildReplenishmentViewModel({
        materialPrepRows,
        cutOrderRows,
        markerPlanRefs,
        markerStore,
        reviews: snapshot.replenishmentState.reviews,
        impactPlans: snapshot.replenishmentState.impactPlans,
        actions: snapshot.replenishmentState.actions,
        pdaFeedbackWritebacks: snapshot.pdaExecutionState.replenishmentFeedbackWritebacks,
    });
    const specialProcessView = buildSpecialProcessViewModel({
        cutOrderRows,
        markerPlanRefs,
        orders: snapshot.specialProcessState.orders,
        bindingPayloads: snapshot.specialProcessState.bindingPayloads,
        scopeLines: snapshot.specialProcessState.scopeLines,
        executionLogs: snapshot.specialProcessState.executionLogs,
        followupActions: snapshot.specialProcessState.followupActions,
    });
    return {
        productionRows: progressRows,
        cutOrderRows,
        materialPrepRows,
        markerPlanRefs,
        markerStore,
        feiViewModel,
        fabricWarehouseView,
        cutPieceWarehouseView,
        sampleWarehouseView,
        transferBagView,
        transferBagReturnView,
        replenishmentView,
        specialProcessView,
    };
}
export function buildFcsCuttingSummaryProjection(snapshot = buildFcsCuttingDomainSnapshot()) {
    const sources = mapCuttingDomainSnapshotToSummaryBuildOptions(snapshot);
    return {
        snapshot,
        sources,
        viewModel: buildCuttingSummaryViewModel(sources),
    };
}
export function buildCuttingSummaryProjection(snapshot = buildFcsCuttingDomainSnapshot()) {
    return buildFcsCuttingSummaryProjection(snapshot);
}
export function buildFcsCuttingSummaryDetailProjection(rowId, projection = buildFcsCuttingSummaryProjection()) {
    return buildSummaryDetailPanelData(rowId, {
        ...projection.sources,
        rows: projection.viewModel.rows,
    });
}
export function buildCuttingSummaryDetailProjection(rowId, projection = buildFcsCuttingSummaryProjection()) {
    return buildFcsCuttingSummaryDetailProjection(rowId, projection);
}
