export const platformCuttingUrgencyMeta = {
    AA: { label: 'AA 紧急', className: 'bg-rose-50 text-rose-700' },
    A: { label: 'A 紧急', className: 'bg-orange-50 text-orange-700' },
    B: { label: 'B 紧急', className: 'bg-amber-50 text-amber-700' },
    C: { label: 'C 优先', className: 'bg-sky-50 text-sky-700' },
    D: { label: 'D 常规', className: 'bg-slate-100 text-slate-700' },
};
export const platformCuttingStageMeta = {
    PENDING_PICKUP: { label: '待领料', className: 'bg-slate-100 text-slate-700' },
    EXECUTING: { label: '执行中', className: 'bg-sky-50 text-sky-700' },
    PENDING_REPLENISHMENT: { label: '待补料', className: 'bg-rose-50 text-rose-700' },
    PENDING_INBOUND: { label: '待入仓', className: 'bg-violet-50 text-violet-700' },
    PENDING_HANDOVER: { label: '待交接', className: 'bg-fuchsia-50 text-fuchsia-700' },
    ALMOST_DONE: { label: '已基本完成', className: 'bg-emerald-50 text-emerald-700' },
};
export const platformCuttingRiskMeta = {
    HIGH: { label: '高风险', className: 'bg-rose-50 text-rose-700' },
    MEDIUM: { label: '中风险', className: 'bg-amber-50 text-amber-700' },
    LOW: { label: '低风险', className: 'bg-sky-50 text-sky-700' },
};
export function filterPlatformCuttingOverviewRows(rows, filters) {
    const keyword = filters.keyword.trim().toLowerCase();
    return rows.filter((row) => {
        const matchesKeyword = keyword.length === 0 ||
            [
                row.productionOrderNo,
                row.cuttingTaskNo,
                row.pickupSlipNo,
                row.assignedFactoryName,
                row.mainIssueTitle,
                row.platformStageSummary,
                row.record.searchKeywords.join(' '),
            ]
                .join(' ')
                .toLowerCase()
                .includes(keyword);
        const matchesUrgency = filters.urgencyLevel === 'ALL' || row.urgencyLevel === filters.urgencyLevel;
        const matchesStage = filters.stage === 'ALL' || row.currentStage === filters.stage;
        const matchesRisk = filters.riskLevel === 'ALL' || row.overallRiskLevel === filters.riskLevel;
        const matchesPending = filters.pendingOnly === 'ALL' || row.isPendingFollowUp;
        const matchesPickup = filters.pickupResult === 'ALL' ||
            (filters.pickupResult === 'MATCHED' && row.pickupSummary.latestResultStatus === 'MATCHED') ||
            (filters.pickupResult === 'RECHECK_REQUIRED' && row.pickupSummary.needsRecheck) ||
            (filters.pickupResult === 'PHOTO_SUBMITTED' && row.pickupSummary.hasPhotoEvidence);
        return matchesKeyword && matchesUrgency && matchesStage && matchesRisk && matchesPickup && matchesPending;
    });
}
export function buildPlatformOverviewStats(rows) {
    return {
        inProgressCount: rows.filter((row) => row.currentStage !== 'ALMOST_DONE').length,
        highRiskCount: rows.filter((row) => row.overallRiskLevel === 'HIGH').length,
        pendingPickupCount: rows.filter((row) => row.currentStage === 'PENDING_PICKUP').length,
        pendingReplenishmentCount: rows.filter((row) => row.currentStage === 'PENDING_REPLENISHMENT').length,
        pendingWarehouseOrHandoverCount: rows.filter((row) => row.currentStage === 'PENDING_INBOUND' || row.currentStage === 'PENDING_HANDOVER').length,
        recheckOrPhotoCount: rows.filter((row) => row.hasReceiveRecheck || row.hasPhotoEvidence).length,
    };
}
export function buildPlatformFocusRows(rows) {
    return [...rows]
        .sort((left, right) => {
        const score = (row) => {
            if (row.hasPendingReplenishment && row.overallRiskLevel === 'HIGH')
                return 0;
            if (row.hasReceiveRecheck)
                return 1;
            if (row.hasExecutionStalled)
                return 2;
            if (row.hasPendingInbound)
                return 3;
            if (row.hasPendingHandover)
                return 4;
            if (row.hasSampleRisk)
                return 5;
            if (row.overallRiskLevel === 'HIGH')
                return 6;
            if (row.overallRiskLevel === 'MEDIUM')
                return 7;
            return 8;
        };
        const scoreDiff = score(left) - score(right);
        if (scoreDiff !== 0)
            return scoreDiff;
        if (left.pendingIssueCount !== right.pendingIssueCount)
            return right.pendingIssueCount - left.pendingIssueCount;
        return left.productionOrderNo.localeCompare(right.productionOrderNo);
    })
        .slice(0, 4);
}
export function hasPlatformOverviewFilters(filters) {
    return (filters.keyword.trim().length > 0 ||
        filters.urgencyLevel !== 'ALL' ||
        filters.stage !== 'ALL' ||
        filters.riskLevel !== 'ALL' ||
        filters.pickupResult !== 'ALL' ||
        filters.pendingOnly !== 'ALL');
}
export function buildPlatformEmptyStateText(hasFilters, mode) {
    if (mode === 'focus')
        return '当前没有需要平台优先跟进的裁片任务。';
    return hasFilters ? '未找到符合筛选条件的裁片任务。' : '当前没有可展示的裁片任务总览记录。';
}
export function buildPlatformPickupText(row) {
    return `${row.pickupAggregate.materialReceiveSummaryText} · ${row.pickupSummary.latestResultLabel}`;
}
export function buildPlatformExecutionText(row) {
    return `${row.executionSummaryText} · 最近动作 ${row.recentFactoryActionSource}`;
}
export function buildPlatformReplenishmentText(row) {
    return row.replenishmentSummaryText;
}
export function buildPlatformWarehouseText(row) {
    return `${row.warehouseSummaryText} · ${row.sampleSummaryText}`;
}
export function buildPlatformIssueText(row) {
    if (row.pendingIssueCount === 0)
        return '当前无待跟进问题';
    return `${row.pendingIssueCount} 项问题，含 ${row.highRiskIssueCount} 项高风险`;
}
