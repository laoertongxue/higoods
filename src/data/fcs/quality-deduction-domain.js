export function deriveQualityDeductionCaseStatus(input) {
    const { qcRecord, factoryResponse, disputeCase, pendingDeductionRecord, formalLedger, settlementImpact } = input;
    if (formalLedger?.status === 'PREPAID' || formalLedger?.status === 'WAIT_FINAL_SETTLEMENT' || settlementImpact.status === 'SETTLED') {
        return 'SETTLED';
    }
    if (pendingDeductionRecord?.status === 'DISPUTED' || disputeCase?.status === 'PENDING_REVIEW' || disputeCase?.status === 'IN_REVIEW') {
        return 'WAIT_PLATFORM_REVIEW';
    }
    if (pendingDeductionRecord?.status === 'PENDING_FACTORY_CONFIRM') {
        return 'WAIT_FACTORY_RESPONSE';
    }
    if (formalLedger && (formalLedger.status === 'GENERATED_PENDING_STATEMENT' || formalLedger.status === 'INCLUDED_IN_STATEMENT' || formalLedger.status === 'INCLUDED_IN_PREPAYMENT_BATCH')) {
        if (factoryResponse?.factoryResponseStatus === 'AUTO_CONFIRMED') {
            return 'AUTO_CONFIRMED_PENDING_SETTLEMENT';
        }
        if (disputeCase?.adjudicationResult) {
            return 'ADJUDICATED_PENDING_SETTLEMENT';
        }
        return 'READY_FOR_SETTLEMENT';
    }
    if (pendingDeductionRecord?.status === 'CLOSED_WITHOUT_LEDGER') {
        return 'CLOSED';
    }
    if (qcRecord.qcStatus === 'CLOSED' && (settlementImpact.status === 'NO_IMPACT' || settlementImpact.status === 'BLOCKED')) {
        return 'CLOSED';
    }
    return 'NO_ACTION';
}
