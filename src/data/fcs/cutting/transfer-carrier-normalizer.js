function text(value) {
    return typeof value === 'string' ? value.trim() : String(value || '').trim();
}
export function normalizeTransferCarrierSeedTicket(record) {
    return {
        feiTicketId: text(record.feiTicketId),
        feiTicketNo: text(record.feiTicketNo),
    };
}
export function normalizeTransferCarrierRecord(record) {
    return {
        carrierId: text(record.carrierId),
        carrierCode: text(record.carrierCode),
        currentCycleId: text(record.currentCycleId),
        currentOwnerTaskId: text(record.currentOwnerTaskId),
        latestCycleId: text(record.latestCycleId),
        latestCycleNo: text(record.latestCycleNo),
    };
}
export function normalizeTransferCarrierCycleRecord(record) {
    const carrierCode = text(record.carrierCode);
    return {
        cycleId: text(record.cycleId),
        cycleNo: text(record.cycleNo),
        carrierId: text(record.carrierId),
        carrierCode,
        carrierType: record.carrierType === 'box' || carrierCode.startsWith('BOX') ? 'box' : 'bag',
        cycleStatus: text(record.cycleStatus),
        status: text(record.status),
    };
}
export function normalizeCarrierCycleItemBinding(record, cyclesById) {
    const cycleId = text(record.cycleId);
    const cycle = cyclesById[cycleId] || {};
    return {
        cycleId,
        cycleNo: text(record.cycleNo) ||
            text(cycle.cycleNo),
        carrierId: text(record.carrierId),
        carrierCode: text(record.carrierCode),
        feiTicketId: text(record.feiTicketId),
        feiTicketNo: text(record.feiTicketNo),
        operator: text(record.operator),
        status: text(record.status) || 'BOUND',
    };
}
export function normalizeTransferBagDispatchManifest(record) {
    return {
        cycleId: text(record.cycleId),
        carrierCode: text(record.carrierCode),
    };
}
