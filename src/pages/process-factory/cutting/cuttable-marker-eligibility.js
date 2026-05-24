const reasonTextMap = {
    CUT_ORDER_CLOSED: '已关闭',
    NO_CLAIM_RECORD: '无领料记录',
    NOT_STARTED: '未开工',
    NO_AVAILABLE_BALANCE: '可用余额为 0',
    BALANCE_LOCKED_BY_DRAFT_MARKER_PLAN: '可用余额已被草稿唛架方案锁定',
    BALANCE_LOCKED_BY_EFFECTIVE_MARKER_PLAN: '可用余额已被有效唛架方案锁定',
    IN_NON_CONTINUABLE_OCCUPANCY: '当前处于不可继续排唛架的占用关系',
    MISSING_MATERIAL_LEDGER: '缺少数量账',
    MISSING_PATTERN_IDENTITY: '缺少纸样信息',
};
function roundQty(value) {
    return Number(Number(value || 0).toFixed(2));
}
function isClosedCutOrder(record) {
    return Boolean(record.closeReason || record.closedAt || /已关闭|不再补裁/.test(record.cuttingStage));
}
function hasClaimRecord(line, record, materialLedgerProjection) {
    return Boolean(materialLedgerProjection?.latestClaimEvent)
        || Number(materialLedgerProjection?.cuttingClaimedQty || 0) > 0
        || Number(line.receivedLength || 0) > 0
        || Number(line.receivedRollCount || 0) > 0
        || Boolean(record.lastPickupScanAt);
}
function hasStarted(record, startState) {
    return startState.started || record.hasSpreadingRecord || record.hasInboundRecord;
}
function createLockKey(event, lockType) {
    return `${lockType}:${event.sourceObjectId || event.sourceObjectType || event.eventId}`;
}
export function deriveCurrentMarkerLocks(materialLedgerProjection) {
    if (!materialLedgerProjection)
        return [];
    const lockMap = new Map();
    for (const event of materialLedgerProjection.events) {
        if (event.eventType !== 'MARKER_DRAFT_LOCKED'
            && event.eventType !== 'MARKER_DRAFT_RELEASED'
            && event.eventType !== 'MARKER_CONFIRMED_LOCKED') {
            continue;
        }
        const lockType = event.eventType === 'MARKER_CONFIRMED_LOCKED' ? '有效唛架锁定' : '草稿唛架锁定';
        const lockKey = createLockKey(event, lockType);
        const current = lockMap.get(lockKey) || {
            lockId: lockKey,
            lockType,
            markerPlanId: event.sourceObjectId || '',
            lockedQty: 0,
            unit: event.unit || materialLedgerProjection.unit,
        };
        current.lockedQty += event.eventType === 'MARKER_DRAFT_RELEASED'
            ? -Math.max(Number(event.quantity || 0), 0)
            : Math.max(Number(event.quantity || 0), 0);
        current.lockedQty = roundQty(current.lockedQty);
        lockMap.set(lockKey, current);
    }
    return Array.from(lockMap.values())
        .filter((lock) => lock.lockedQty > 0)
        .sort((left, right) => left.lockType.localeCompare(right.lockType, 'zh-CN')
        || right.lockedQty - left.lockedQty
        || left.markerPlanId.localeCompare(right.markerPlanId, 'zh-CN'));
}
function pushReason(reasonCodes, code) {
    if (!reasonCodes.includes(code))
        reasonCodes.push(code);
}
export function deriveCuttableMarkerEligibility(options) {
    const projection = options.materialLedgerProjection;
    const reasonCodes = [];
    const currentLocks = deriveCurrentMarkerLocks(projection);
    const unit = projection?.unit || options.line.materialIdentity?.materialUnit || '米';
    const claimedQty = roundQty(projection?.cuttingClaimedQty || 0);
    const lockedQty = roundQty(projection?.markerLockedQty || 0);
    const consumedQty = roundQty(projection?.spreadingConsumedQty || 0);
    const availableMaterialQty = roundQty(projection?.availableQty || 0);
    if (isClosedCutOrder(options.record)) {
        pushReason(reasonCodes, 'CUT_ORDER_CLOSED');
    }
    if (!hasClaimRecord(options.line, options.record, projection)) {
        pushReason(reasonCodes, 'NO_CLAIM_RECORD');
    }
    if (!hasStarted(options.record, options.startState)) {
        pushReason(reasonCodes, 'NOT_STARTED');
    }
    if (!projection) {
        pushReason(reasonCodes, 'MISSING_MATERIAL_LEDGER');
    }
    if (projection && !projection.patternIdentity?.patternFileId) {
        pushReason(reasonCodes, 'MISSING_PATTERN_IDENTITY');
    }
    if (projection && availableMaterialQty <= 0) {
        pushReason(reasonCodes, 'NO_AVAILABLE_BALANCE');
        if (currentLocks.some((lock) => lock.lockType === '草稿唛架锁定')) {
            pushReason(reasonCodes, 'BALANCE_LOCKED_BY_DRAFT_MARKER_PLAN');
        }
        if (currentLocks.some((lock) => lock.lockType === '有效唛架锁定')) {
            pushReason(reasonCodes, 'BALANCE_LOCKED_BY_EFFECTIVE_MARKER_PLAN');
        }
    }
    if (options.markerPlanOccupancy && projection && availableMaterialQty <= 0 && lockedQty > 0) {
        pushReason(reasonCodes, 'IN_NON_CONTINUABLE_OCCUPANCY');
    }
    return {
        cutOrderId: options.cutOrderId,
        productionOrderId: options.productionOrderId,
        isEligible: reasonCodes.length === 0,
        eligibleLabel: reasonCodes.length === 0 ? '可排唛架' : '不可进入',
        reasonCodes,
        reasonTexts: reasonCodes.map((code) => reasonTextMap[code]),
        availableMaterialQty,
        availableMaterialUnit: unit,
        claimedQty,
        lockedQty,
        consumedQty,
        ledgerSource: projection ? 'material-ledger-projection' : 'missing-material-ledger',
        currentLocks,
    };
}
