import { getBrowserLocalStorage, getBrowserSessionStorage, readBrowserStorageItem, } from '../../browser-storage.ts';
import { listCuttingProductionOrdersWithFormalTechPack, listGeneratedCutOrderSourceRecords, } from './generated-cut-orders.ts';
import { listMarkerPlanRefSourceRecords, } from './marker-plan-ref-source.ts';
import { cuttingOrderProgressRecords } from './order-progress.ts';
import { listFormalCutPieceWarehouseRecords, listFormalFabricWarehouseRecords, listFormalSampleWarehouseRecords, } from './warehouse-runtime.ts';
import { CUTTING_FEI_TICKET_DRAFTS_STORAGE_KEY, CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY, CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY, deserializeFeiTicketDraftsStorage, deserializeFeiTicketPrintJobsStorage, deserializeFeiTicketRecordsStorage, } from './storage/fei-tickets-storage.ts';
import { CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY, deserializeMarkerSpreadingStorage, } from './marker-spreading-ledger.ts';
import { CUTTING_REPLENISHMENT_ACTIONS_STORAGE_KEY, CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY, CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY, deserializeReplenishmentActionsStorage, deserializeReplenishmentImpactPlansStorage, deserializeReplenishmentReviewsStorage, } from './storage/replenishment-storage.ts';
import { CUTTING_SPECIAL_PROCESS_BINDING_PAYLOAD_STORAGE_KEY, CUTTING_SPECIAL_PROCESS_EXECUTION_LOGS_STORAGE_KEY, CUTTING_SPECIAL_PROCESS_FOLLOWUP_ACTIONS_STORAGE_KEY, CUTTING_SPECIAL_PROCESS_ORDERS_STORAGE_KEY, CUTTING_SPECIAL_PROCESS_SCOPE_LINES_STORAGE_KEY, deserializeBindingStripPayloadsStorage, deserializeSpecialProcessExecutionLogsStorage, deserializeSpecialProcessFollowupActionsStorage, deserializeSpecialProcessOrdersStorage, deserializeSpecialProcessScopeLinesStorage, } from './storage/special-processes-storage.ts';
import { CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY, deserializeTransferBagStorage, } from './storage/transfer-bags-storage.ts';
import { CUTTING_PDA_EXECUTION_WRITEBACK_STORAGE_KEY, deserializePdaExecutionWritebackStorage, } from './pda-execution-writeback-ledger.ts';
import { CUTTING_MARKER_PLAN_REF_LEDGER_STORAGE_KEY, deserializeMarkerPlanRefStorage, } from './storage/marker-plan-ref-storage.ts';
import { CUTTING_WAREHOUSE_WRITEBACK_STORAGE_KEY, deserializeCuttingWarehouseWritebackStorage, } from './warehouse-writeback-ledger.ts';
const CUTTING_RUNTIME_LOCAL_STORAGE_SIGNATURE_KEYS = [
    CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
    CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY,
    CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY,
    CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY,
    CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY,
    CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY,
    CUTTING_REPLENISHMENT_ACTIONS_STORAGE_KEY,
    CUTTING_SPECIAL_PROCESS_ORDERS_STORAGE_KEY,
    CUTTING_SPECIAL_PROCESS_BINDING_PAYLOAD_STORAGE_KEY,
    CUTTING_SPECIAL_PROCESS_SCOPE_LINES_STORAGE_KEY,
    CUTTING_SPECIAL_PROCESS_EXECUTION_LOGS_STORAGE_KEY,
    CUTTING_SPECIAL_PROCESS_FOLLOWUP_ACTIONS_STORAGE_KEY,
    CUTTING_PDA_EXECUTION_WRITEBACK_STORAGE_KEY,
    CUTTING_MARKER_PLAN_REF_LEDGER_STORAGE_KEY,
    CUTTING_WAREHOUSE_WRITEBACK_STORAGE_KEY,
];
const CUTTING_RUNTIME_SESSION_STORAGE_SIGNATURE_KEYS = [
    CUTTING_FEI_TICKET_DRAFTS_STORAGE_KEY,
];
export function getCuttingRuntimeStorageSignature() {
    const localStorageRef = getBrowserLocalStorage();
    const sessionStorageRef = getBrowserSessionStorage();
    const localSignature = CUTTING_RUNTIME_LOCAL_STORAGE_SIGNATURE_KEYS
        .map((key) => `${key}:${readBrowserStorageItem(localStorageRef, key) || ''}`)
        .join('\n');
    const sessionSignature = CUTTING_RUNTIME_SESSION_STORAGE_SIGNATURE_KEYS
        .map((key) => `${key}:${readBrowserStorageItem(sessionStorageRef, key) || ''}`)
        .join('\n');
    return `${localSignature}\n${sessionSignature}`;
}
export function readCuttingMarkerStore() {
    return deserializeMarkerSpreadingStorage(readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY));
}
export function readCuttingFeiRuntimeState() {
    return {
        drafts: deserializeFeiTicketDraftsStorage(readBrowserStorageItem(getBrowserSessionStorage(), CUTTING_FEI_TICKET_DRAFTS_STORAGE_KEY)),
        ticketRecords: deserializeFeiTicketRecordsStorage(readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY)),
        printJobs: deserializeFeiTicketPrintJobsStorage(readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY)),
    };
}
export function readCuttingTransferBagRuntimeState() {
    return {
        store: deserializeTransferBagStorage(readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY)),
    };
}
export function readCuttingReplenishmentRuntimeState() {
    return {
        reviews: deserializeReplenishmentReviewsStorage(readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY)),
        impactPlans: deserializeReplenishmentImpactPlansStorage(readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY)),
        actions: deserializeReplenishmentActionsStorage(readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_REPLENISHMENT_ACTIONS_STORAGE_KEY)),
    };
}
export function readCuttingSpecialProcessRuntimeState() {
    return {
        orders: deserializeSpecialProcessOrdersStorage(readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_SPECIAL_PROCESS_ORDERS_STORAGE_KEY)),
        bindingPayloads: deserializeBindingStripPayloadsStorage(readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_SPECIAL_PROCESS_BINDING_PAYLOAD_STORAGE_KEY)),
        scopeLines: deserializeSpecialProcessScopeLinesStorage(readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_SPECIAL_PROCESS_SCOPE_LINES_STORAGE_KEY)),
        executionLogs: deserializeSpecialProcessExecutionLogsStorage(readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_SPECIAL_PROCESS_EXECUTION_LOGS_STORAGE_KEY)),
        followupActions: deserializeSpecialProcessFollowupActionsStorage(readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_SPECIAL_PROCESS_FOLLOWUP_ACTIONS_STORAGE_KEY)),
    };
}
export function readCuttingPdaExecutionRuntimeState() {
    const store = deserializePdaExecutionWritebackStorage(readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_PDA_EXECUTION_WRITEBACK_STORAGE_KEY));
    return {
        pickupWritebacks: store.pickupWritebacks,
        inboundWritebacks: store.inboundWritebacks,
        handoverWritebacks: store.handoverWritebacks,
        replenishmentFeedbackWritebacks: store.replenishmentFeedbackWritebacks,
    };
}
export function readCuttingStoredMarkerPlanRefLedger() {
    return deserializeMarkerPlanRefStorage(readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_MARKER_PLAN_REF_LEDGER_STORAGE_KEY));
}
export function readCuttingWarehouseWritebackRuntimeState() {
    const store = deserializeCuttingWarehouseWritebackStorage(readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_WAREHOUSE_WRITEBACK_STORAGE_KEY));
    return {
        cutPieceWritebacks: store.cutPieceWritebacks,
        sampleWritebacks: store.sampleWritebacks,
    };
}
export function readCuttingRuntimeInputs() {
    const feiRuntimeState = readCuttingFeiRuntimeState();
    const replenishmentRuntimeState = readCuttingReplenishmentRuntimeState();
    const specialProcessRuntimeState = readCuttingSpecialProcessRuntimeState();
    const pdaExecutionRuntimeState = readCuttingPdaExecutionRuntimeState();
    const warehouseWritebackRuntimeState = readCuttingWarehouseWritebackRuntimeState();
    return {
        productionOrders: listCuttingProductionOrdersWithFormalTechPack().map((order) => ({ ...order })),
        cutOrders: listGeneratedCutOrderSourceRecords(),
        markerPlanRefState: {
            sourceRecords: listMarkerPlanRefSourceRecords(),
            storedRecords: readCuttingStoredMarkerPlanRefLedger().map((record) => ({ ...record })),
        },
        progressRecords: cuttingOrderProgressRecords.map((record) => ({
            ...record,
            materialLines: record.materialLines.map((line) => ({
                ...line,
                materialIdentity: line.materialIdentity ? { ...line.materialIdentity } : undefined,
                patternIdentity: line.patternIdentity
                    ? {
                        ...line.patternIdentity,
                        piecePartCodes: [...line.patternIdentity.piecePartCodes],
                        piecePartNames: [...line.patternIdentity.piecePartNames],
                    }
                    : undefined,
                skuScopeLines: (line.skuScopeLines || []).map((scope) => ({ ...scope })),
                pieceProgressLines: (line.pieceProgressLines || []).map((piece) => ({ ...piece })),
                issueFlags: [...line.issueFlags],
            })),
            skuRequirementLines: (record.skuRequirementLines || []).map((line) => ({ ...line })),
            riskFlags: [...record.riskFlags],
        })),
        warehouseState: {
            fabricStocks: listFormalFabricWarehouseRecords(),
            cutPieceRecords: listFormalCutPieceWarehouseRecords(),
            sampleRecords: listFormalSampleWarehouseRecords(),
            cutPieceWritebacks: warehouseWritebackRuntimeState.cutPieceWritebacks,
            sampleWritebacks: warehouseWritebackRuntimeState.sampleWritebacks,
        },
        markerSpreadingState: {
            store: readCuttingMarkerStore(),
        },
        feiTicketState: {
            drafts: feiRuntimeState.drafts,
            ticketRecords: feiRuntimeState.ticketRecords,
            printJobs: feiRuntimeState.printJobs,
        },
        transferBagState: {
            store: readCuttingTransferBagRuntimeState().store,
        },
        replenishmentState: {
            reviews: replenishmentRuntimeState.reviews,
            impactPlans: replenishmentRuntimeState.impactPlans,
            actions: replenishmentRuntimeState.actions,
        },
        specialProcessState: {
            orders: specialProcessRuntimeState.orders,
            bindingPayloads: specialProcessRuntimeState.bindingPayloads,
            scopeLines: specialProcessRuntimeState.scopeLines,
            executionLogs: specialProcessRuntimeState.executionLogs,
            followupActions: specialProcessRuntimeState.followupActions,
        },
        pdaExecutionState: {
            pickupWritebacks: pdaExecutionRuntimeState.pickupWritebacks,
            inboundWritebacks: pdaExecutionRuntimeState.inboundWritebacks,
            handoverWritebacks: pdaExecutionRuntimeState.handoverWritebacks,
            replenishmentFeedbackWritebacks: pdaExecutionRuntimeState.replenishmentFeedbackWritebacks,
        },
    };
}
