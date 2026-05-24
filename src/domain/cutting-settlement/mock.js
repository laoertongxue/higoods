import { buildPlatformCuttingSettlementInputViews } from './platform.adapter';
export function cloneCuttingSettlementInputViews() {
    return buildPlatformCuttingSettlementInputViews().map((row) => ({
        ...row,
        settlementInput: {
            ...row.settlementInput,
            operatorSummary: row.settlementInput.operatorSummary.map((item) => ({ ...item })),
            groupSummary: row.settlementInput.groupSummary.map((item) => ({ ...item })),
            pickupSummary: { ...row.settlementInput.pickupSummary },
            executionSummary: { ...row.settlementInput.executionSummary },
            replenishmentSummary: { ...row.settlementInput.replenishmentSummary },
            warehouseSummary: { ...row.settlementInput.warehouseSummary },
            exceptionImpactSummary: { ...row.settlementInput.exceptionImpactSummary },
        },
        scoreInput: {
            ...row.scoreInput,
        },
        routes: { ...row.routes },
        relatedExceptionNos: [...row.relatedExceptionNos],
    }));
}
