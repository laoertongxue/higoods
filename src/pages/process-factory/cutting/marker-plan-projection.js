import { buildFcsCuttingDomainSnapshot, } from '../../../domain/fcs-cutting-runtime/index.ts';
import { cuttingOrderProgressRecords } from '../../../data/fcs/cutting/order-progress.ts';
import { listMarkerPlanRefSourceRecords } from '../../../data/fcs/cutting/marker-plan-ref-source.ts';
import { createEmptyStore, } from './marker-spreading-model.ts';
import { buildMaterialPrepViewModel } from './material-prep-model.ts';
import { buildSystemSeedMarkerPlanRefs, } from './marker-plan-ref-model.ts';
import { buildCutOrderViewModel } from './cut-orders-model.ts';
import { buildProductionProgressRows } from './production-progress-model.ts';
import { buildMarkerPlanViewModel, deserializeMarkerPlanStorage, getMarkerPlanStorageKey } from './marker-plan-model.ts';
import { buildMarkerPlanOccupancyLookup } from './marker-plan-occupancy.ts';
function readStoredMarkerPlans() {
    try {
        return deserializeMarkerPlanStorage(localStorage.getItem(getMarkerPlanStorageKey()));
    }
    catch {
        return [];
    }
}
function buildMarkerPlanSourceMarkerPlanRefItems(cutOrderRows) {
    const rowsById = Object.fromEntries(cutOrderRows.map((row) => [row.cutOrderId, row]));
    return listMarkerPlanRefSourceRecords().flatMap((record) => record.sourceCutOrderIds
        .map((cutOrderId) => rowsById[cutOrderId] || null)
        .filter((row) => Boolean(row))
        .map((row) => ({
        id: row.cutOrderId,
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
        currentStage: row.currentStageLabel,
        markerPlanOccupancyStatus: row.activeMarkerPlanId ? 'IN_MARKER_PLAN' : 'AVAILABLE',
        cuttableState: {
            label: row.cuttableState.label,
            selectable: row.cuttableState.selectable,
            key: row.cuttableState.key,
        },
        markerPlanGroupKey: `${row.styleCode}::${row.materialSku}`,
        markerPlanNo: record.markerPlanNo,
    })));
}
function buildMarkerPlanSeedMarkerStore(options) {
    const store = createEmptyStore();
    const cutOrderRows = options.cutOrderRows.slice(0, 2);
    const markerPlanRef = options.markerPlanRefs[0] || null;
    const sessions = [
        ...cutOrderRows.map((row, index) => ({
            spreadingSessionId: `seed-spreading-cut-order-${index + 1}`,
            sessionNo: `PB-SEED-${String(index + 1).padStart(3, '0')}`,
            contextType: 'cut-order',
            cutOrderIds: [row.cutOrderId],
            completionLinkage: {
                linkedCutOrderIds: [row.cutOrderId],
            },
        })),
        ...(markerPlanRef
            ? [
                {
                    spreadingSessionId: 'seed-spreading-marker-plan-ref-1',
                    sessionNo: 'PB-SEED-901',
                    contextType: 'marker-plan-ref',
                    markerPlanId: markerPlanRef.markerPlanId,
                    markerPlanNo: markerPlanRef.markerPlanNo,
                    cutOrderIds: markerPlanRef.items.map((item) => item.cutOrderId),
                    completionLinkage: {
                        linkedCutOrderIds: markerPlanRef.items.map((item) => item.cutOrderId),
                    },
                },
            ]
            : []),
    ];
    return {
        ...store,
        sessions: sessions,
    };
}
export function buildMarkerPlanSummaryBuildOptions(progressRecords = cuttingOrderProgressRecords, markerPlanOccupancy = {}) {
    const productionRows = buildProductionProgressRows(progressRecords);
    const seedCutOrderRows = buildCutOrderViewModel(progressRecords, [], { progressRows: productionRows, markerPlanOccupancy }).rows;
    const markerPlanRefs = buildSystemSeedMarkerPlanRefs(buildMarkerPlanSourceMarkerPlanRefItems(seedCutOrderRows));
    const cutOrderRows = buildCutOrderViewModel(progressRecords, markerPlanRefs, { progressRows: productionRows, markerPlanOccupancy }).rows;
    const materialPrepRows = buildMaterialPrepViewModel(progressRecords, markerPlanRefs, { pickupWritebacks: [] }).rows;
    const markerStore = buildMarkerPlanSeedMarkerStore({
        cutOrderRows,
        markerPlanRefs,
    });
    return {
        productionRows,
        cutOrderRows,
        materialPrepRows,
        markerPlanRefs,
        markerStore,
        feiViewModel: { rows: [], printableUnits: [], unitRowsById: {}, unitsById: {}, ticketRecords: [], printJobs: [], ticketRecordsById: {}, printJobsById: {} },
        fabricWarehouseView: { rows: [], rowsById: {}, stockItems: [] },
        cutPieceWarehouseView: { rows: [], rowsById: {}, inventoryItems: [] },
        sampleWarehouseView: { rows: [], rowsById: {} },
        transferBagView: { rows: [], rowsById: {} },
        transferBagReturnView: { rows: [], rowsById: {} },
        replenishmentView: { rows: [], rowsById: {} },
        specialProcessView: { rows: [], rowsById: {} },
    };
}
export function buildMarkerPlanProjection(snapshot = buildFcsCuttingDomainSnapshot()) {
    const storedPlans = readStoredMarkerPlans();
    const sources = buildMarkerPlanSummaryBuildOptions(snapshot.progressRecords, buildMarkerPlanOccupancyLookup(storedPlans));
    return {
        snapshot,
        sources,
        storedPlans,
        viewModel: buildMarkerPlanViewModel(sources, storedPlans),
    };
}
