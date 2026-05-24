export const materialTypeMeta = {
    PRINT: { label: '面料', className: 'bg-slate-100 text-slate-700' },
    DYE: { label: '面料', className: 'bg-slate-100 text-slate-700' },
    SOLID: { label: '面料', className: 'bg-slate-100 text-slate-700' },
    LINING: { label: '里布', className: 'bg-slate-100 text-slate-700' },
};
export const configMeta = {
    NOT_CONFIGURED: { label: '无配料数量', className: 'bg-slate-100 text-slate-700' },
    PARTIAL: { label: '配料数量不足', className: 'bg-orange-100 text-orange-700' },
    CONFIGURED: { label: '有配料数量', className: 'bg-emerald-100 text-emerald-700' },
};
export const receiveMeta = {
    NOT_RECEIVED: { label: '无领料记录', className: 'bg-slate-100 text-slate-700' },
    PARTIAL: { label: '领料数量不足', className: 'bg-orange-100 text-orange-700' },
    RECEIVED: { label: '有领料记录', className: 'bg-emerald-100 text-emerald-700' },
};
export const printMeta = {
    NOT_PRINTED: { label: '未打印', className: 'bg-slate-100 text-slate-700' },
    PRINTED: { label: '已打印', className: 'bg-blue-100 text-blue-700' },
};
export const qrMeta = {
    NOT_GENERATED: { label: '未生成裁片单二维码', className: 'bg-slate-100 text-slate-700' },
    GENERATED: { label: '已生成裁片单二维码', className: 'bg-violet-100 text-violet-700' },
};
export function shouldDisplayQrByPrepStatus(status) {
    return status === 'CONFIGURED' || status === 'PARTIAL';
}
export function shouldDisplayQrLabelByPrepStatus(status) {
    return shouldDisplayQrByPrepStatus(status);
}
export function canViewPrepQr(status) {
    return shouldDisplayQrByPrepStatus(status);
}
export function shouldPrintPrepQr(status) {
    return shouldDisplayQrByPrepStatus(status);
}
export function getPrepQrHiddenText(status, variant = 'list') {
    if (shouldDisplayQrByPrepStatus(status))
        return '';
    if (variant === 'detail')
        return '当前未配置，暂不显示裁片单二维码。';
    if (variant === 'print')
        return '当前项未配置，本次打印不带裁片单二维码。';
    return '未配置，暂不显示裁片单二维码';
}
export const discrepancyMeta = {
    NONE: { label: '无差异', className: 'bg-slate-100 text-slate-700' },
    RECHECK_REQUIRED: { label: '待核对', className: 'bg-rose-100 text-rose-700' },
    PHOTO_SUBMITTED: { label: '已提交照片', className: 'bg-cyan-100 text-cyan-700' },
};
export const receiveResultMeta = {
    MATCHED: { label: '匹配', className: 'bg-emerald-100 text-emerald-700' },
    RECHECK: { label: '驳回核对', className: 'bg-rose-100 text-rose-700' },
    PHOTO_SUBMITTED: { label: '带照片提交', className: 'bg-cyan-100 text-cyan-700' },
};
const numberFormatter = new Intl.NumberFormat('zh-CN');
export function formatQty(value) {
    return numberFormatter.format(value);
}
export function formatLength(value) {
    return `${numberFormatter.format(value)} 米`;
}
export function buildConfigSummary(line) {
    return `已配 ${line.configuredRollCount}/${line.demandRollCount} 卷 · 剩余卷数 ${Math.max(line.demandRollCount - line.configuredRollCount, 0)} 卷`;
}
export function buildReceiveSummary(line) {
    return `已领 ${line.receivedRollCount}/${line.configuredRollCount || line.demandRollCount} 卷 · ${formatLength(line.receivedLength)}`;
}
function matchLineRisk(line, riskFilter) {
    if (riskFilter === 'ALL')
        return true;
    if (riskFilter === 'DIFF_ONLY')
        return line.discrepancyStatus !== 'NONE';
    if (riskFilter === 'RECEIVE_ONLY')
        return line.receiveStatus !== 'RECEIVED';
    return true;
}
function matchLineStatus(line, filters) {
    const materialTypeOk = filters.materialType === 'ALL' || line.materialType === filters.materialType;
    const configOk = filters.configStatus === 'ALL' || line.configStatus === filters.configStatus;
    const receiveOk = filters.receiveStatus === 'ALL' || line.receiveStatus === filters.receiveStatus;
    const riskOk = matchLineRisk(line, filters.riskFilter);
    return materialTypeOk && configOk && receiveOk && riskOk;
}
export function filterMaterialPrepGroups(groups, filters) {
    const keyword = filters.keyword.trim().toLowerCase();
    return groups
        .map((group) => {
        const groupMatched = keyword.length === 0 ||
            group.productionOrderNo.toLowerCase().includes(keyword) ||
            group.cuttingTaskNo.toLowerCase().includes(keyword) ||
            group.assignedFactoryName.toLowerCase().includes(keyword);
        const lines = group.materialLines.filter((line) => {
            const keywordMatched = groupMatched ||
                line.cutPieceOrderNo.toLowerCase().includes(keyword) ||
                line.materialSku.toLowerCase().includes(keyword) ||
                line.materialLabel.toLowerCase().includes(keyword);
            return keywordMatched && matchLineStatus(line, filters);
        });
        return {
            ...group,
            materialLines: lines,
        };
    })
        .filter((group) => group.materialLines.length > 0);
}
export function buildMaterialPrepSummary(groups) {
    const cutPieceMap = new Map();
    groups.forEach((group) => {
        group.materialLines.forEach((line) => {
            const bucket = cutPieceMap.get(line.cutPieceOrderNo) ?? [];
            bucket.push(line);
            cutPieceMap.set(line.cutPieceOrderNo, bucket);
        });
    });
    let pendingConfigCount = 0;
    let partialConfigCount = 0;
    let qrReadyCount = 0;
    let pendingReceiveCount = 0;
    let receiveDoneCount = 0;
    let discrepancyCount = 0;
    cutPieceMap.forEach((lines) => {
        const configStatus = deriveCutPieceConfigStatus(lines);
        const receiveStatus = deriveCutPieceReceiveStatus(lines);
        const hasQr = shouldDisplayQrByPrepStatus(configStatus);
        const hasDiscrepancy = lines.some((line) => line.discrepancyStatus !== 'NONE');
        if (configStatus === 'NOT_CONFIGURED')
            pendingConfigCount += 1;
        if (configStatus === 'PARTIAL')
            partialConfigCount += 1;
        if (hasQr)
            qrReadyCount += 1;
        if (receiveStatus === 'NOT_RECEIVED')
            pendingReceiveCount += 1;
        if (receiveStatus === 'RECEIVED')
            receiveDoneCount += 1;
        if (hasDiscrepancy)
            discrepancyCount += 1;
    });
    return {
        pendingConfigCount,
        partialConfigCount,
        qrReadyCount,
        pendingReceiveCount,
        receiveDoneCount,
        discrepancyCount,
    };
}
export function deriveCutPieceConfigStatus(lines) {
    if (lines.every((line) => line.configuredRollCount >= line.demandRollCount || line.configuredLength >= line.demandLength)) {
        return 'CONFIGURED';
    }
    if (lines.some((line) => line.configuredRollCount > 0 || line.configuredLength > 0)) {
        return 'PARTIAL';
    }
    return 'NOT_CONFIGURED';
}
export function deriveCutPieceReceiveStatus(lines) {
    if (lines.every((line) => line.receivedRollCount >= line.configuredRollCount && line.configuredRollCount > 0)) {
        return 'RECEIVED';
    }
    if (lines.some((line) => line.receivedRollCount > 0 || line.receivedLength > 0)) {
        return 'PARTIAL';
    }
    return 'NOT_RECEIVED';
}
export function buildGroupConfigSummary(group) {
    const configured = group.materialLines.filter((line) => line.configStatus === 'CONFIGURED').length;
    const partial = group.materialLines.filter((line) => line.configStatus === 'PARTIAL').length;
    return `有配料数量 ${configured} 条 · 配料数量不足 ${partial} 条`;
}
export function buildGroupReceiveSummary(group) {
    const received = group.materialLines.filter((line) => line.receiveStatus === 'RECEIVED').length;
    const partial = group.materialLines.filter((line) => line.receiveStatus === 'PARTIAL').length;
    return `有领料记录 ${received} 条 · 领料数量不足 ${partial} 条`;
}
export function buildGroupRiskFlags(group) {
    const flags = new Set();
    group.materialLines.forEach((line) => {
        if (line.configStatus === 'PARTIAL')
            flags.add('配料数量不足');
        if (line.receiveStatus !== 'RECEIVED')
            flags.add('领料记录待补');
        if (line.discrepancyStatus === 'RECHECK_REQUIRED')
            flags.add('待核对');
        if (line.discrepancyStatus === 'PHOTO_SUBMITTED')
            flags.add('已提交照片');
        if (line.issueFlags.includes('待补料'))
            flags.add('待补料');
        if (line.issueFlags.includes('待入仓'))
            flags.add('待入仓');
    });
    return Array.from(flags);
}
export function buildBatchCoverageSummary(line) {
    if (!line.configBatches.length)
        return '尚未生成来料批次。';
    const pending = line.configBatches.filter((batch) => !batch.printIncluded).length;
    return pending ? `当前有 ${pending} 笔本次来料待打印。` : `共 ${line.configBatches.length} 笔来料批次，均已进入打印记录。`;
}
export function getPendingPrintBatches(line) {
    const pending = line.configBatches.filter((batch) => !batch.printIncluded);
    return pending.length ? pending : line.configBatches.slice(-1);
}
export function buildEmptyStateText(filters) {
    if (filters.riskFilter !== 'ALL')
        return '暂无待处理记录';
    return '暂无匹配结果';
}
