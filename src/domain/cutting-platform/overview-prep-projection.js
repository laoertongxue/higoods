function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
}
function normalizeDateTime(value) {
    return value && value.trim().length > 0 ? value : '';
}
function compareDateTime(left, right) {
    return normalizeDateTime(left).localeCompare(normalizeDateTime(right), 'zh-CN');
}
function toResultLabel(status) {
    if (status === 'MATCHED')
        return '扫码领取成功';
    if (status === 'RECHECK_REQUIRED')
        return '领料差异待复核';
    if (status === 'PHOTO_SUBMITTED')
        return '已提交照片凭证';
    return '未扫码回写';
}
function toReceiptStatus(status) {
    if (status === 'MATCHED')
        return 'SCANNED_MATCHED';
    if (status === 'RECHECK_REQUIRED')
        return 'SCANNED_RECHECK';
    if (status === 'PHOTO_SUBMITTED')
        return 'PHOTO_SUBMITTED';
    return 'NOT_SCANNED';
}
function toReceiptStatusLabel(status) {
    if (status === 'SCANNED_MATCHED')
        return '已回执';
    if (status === 'SCANNED_RECHECK')
        return '待复核';
    if (status === 'PHOTO_SUBMITTED')
        return '已提交凭证';
    return '未回执';
}
function deriveStatusFromWriteback(record) {
    const resultLabel = record.resultLabel || '';
    if (/成功|正常|匹配|一致/.test(resultLabel))
        return 'MATCHED';
    if ((record.photoProofCount || 0) > 0)
        return 'PHOTO_SUBMITTED';
    return 'RECHECK_REQUIRED';
}
function deriveStatusFromLines(lines) {
    if (!lines.length)
        return 'NOT_SCANNED';
    if (lines.some((line) => line.issueFlags.includes('RECEIVE_DIFF')))
        return 'RECHECK_REQUIRED';
    if (lines.every((line) => line.receiveStatus === 'RECEIVED'))
        return 'MATCHED';
    if (lines.some((line) => line.receiveStatus === 'PARTIAL'))
        return 'RECHECK_REQUIRED';
    if (lines.some((line) => line.receiveStatus === 'RECEIVED'))
        return 'MATCHED';
    return 'NOT_SCANNED';
}
function buildPickupSlipNo(cutOrderNo, productionOrderNo) {
    const base = cutOrderNo || productionOrderNo || 'UNKNOWN';
    return `LL-${base}`;
}
function buildPrintVersionNo(pickupSlipNo, printCopyCount) {
    if (printCopyCount <= 0)
        return '-';
    return `${pickupSlipNo}-V${String(printCopyCount).padStart(2, '0')}`;
}
function buildQrCodeValue(cutOrderId, cutOrderNo) {
    const key = cutOrderId || cutOrderNo || '-';
    return key === '-' ? '-' : `CUT_ORDER:${key}`;
}
function buildResultSummaryText(group) {
    const parts = [
        `最近领料结果：${group.latestResultLabel}`,
        `回执状态：${group.receiptStatusLabel}`,
    ];
    if (group.latestScannedAt !== '-') {
        parts.push(`最近确认 ${group.latestScannedAt} · ${group.latestScannedBy}`);
    }
    if (group.needsRecheck) {
        parts.push('当前存在领料差异，需复核配置和领取结果');
    }
    if (group.hasPhotoEvidence) {
        parts.push(`已提交 ${group.photoProofCount} 张照片凭证`);
    }
    return parts.join('；');
}
function buildEvidenceSummaryText(group) {
    if (!group.hasPhotoEvidence)
        return '当前无照片凭证';
    return `当前已提交 ${group.photoProofCount} 张照片凭证`;
}
function groupLinesByCutOrder(record, cutOrderRefs) {
    const groups = cutOrderRefs.map((ref) => ({
        cutOrderId: ref.cutOrderId,
        cutOrderNo: ref.cutOrderNo,
        lines: record.materialLines.filter((line) => (line.cutOrderId && line.cutOrderId === ref.cutOrderId)
            || (line.cutOrderNo && line.cutOrderNo === ref.cutOrderNo)),
    }));
    if (groups.length > 0)
        return groups;
    return [
        {
            cutOrderId: '',
            cutOrderNo: '',
            lines: record.materialLines.slice(),
        },
    ];
}
function buildGroupProjection(options) {
    const sortedWritebacks = options.writebacks
        .slice()
        .sort((left, right) => compareDateTime(right.submittedAt, left.submittedAt));
    const latestWriteback = sortedWritebacks[0] || null;
    const latestResultStatus = latestWriteback
        ? deriveStatusFromWriteback(latestWriteback)
        : deriveStatusFromLines(options.lines);
    const latestResultLabel = latestWriteback?.resultLabel || toResultLabel(latestResultStatus);
    const receiptStatus = toReceiptStatus(latestResultStatus);
    const receiptStatusLabel = toReceiptStatusLabel(receiptStatus);
    const printed = options.lines.some((line) => line.printSlipStatus === 'PRINTED');
    const qrGenerated = options.lines.some((line) => line.qrStatus === 'GENERATED');
    const printCopyCount = printed ? Math.max(options.lines.filter((line) => line.printSlipStatus === 'PRINTED').length, 1) : 0;
    const pickupSlipNo = buildPickupSlipNo(options.cutOrderNo, options.record.productionOrderNo);
    const latestPrintVersionNo = buildPrintVersionNo(pickupSlipNo, printCopyCount);
    const qrCodeValue = qrGenerated ? buildQrCodeValue(options.cutOrderId, options.cutOrderNo) : '-';
    const materialSkus = unique(options.lines.map((line) => line.materialSku));
    const hasPhotoEvidence = sortedWritebacks.some((item) => item.photoProofCount > 0);
    const photoProofCount = sortedWritebacks.reduce((sum, item) => sum + Number(item.photoProofCount || 0), 0);
    const needsRecheck = latestResultStatus === 'RECHECK_REQUIRED' || options.lines.some((line) => line.issueFlags.includes('RECEIVE_DIFF'));
    const latestScannedAt = latestWriteback?.submittedAt || options.record.lastPickupScanAt || '-';
    const latestScannedBy = latestWriteback?.operatorName || options.record.lastOperatorName || '-';
    const printSlipStatusLabel = printed ? '已打印' : '未打印';
    const qrBindingSummaryText = qrGenerated
        ? `主码已按裁片单生成，覆盖 ${materialSkus.length || options.lines.length || 1} 个面料项`
        : '当前尚未生成主码';
    const group = {
        cutOrderId: options.cutOrderId,
        cutOrderNo: options.cutOrderNo,
        materialSkus,
        lines: options.lines,
        latestWriteback,
        latestResultStatus,
        latestResultLabel,
        latestScannedAt,
        latestScannedBy,
        hasPhotoEvidence,
        photoProofCount,
        needsRecheck,
        receiptStatus,
        receiptStatusLabel,
        printCopyCount,
        printed,
        qrGenerated,
        printSlipStatusLabel,
        pickupSlipNo,
        latestPrintVersionNo,
        qrCodeValue,
        qrBindingSummaryText,
        resultSummaryText: '',
        evidenceSummaryText: '',
    };
    group.resultSummaryText = buildResultSummaryText(group);
    group.evidenceSummaryText = buildEvidenceSummaryText(group);
    return group;
}
function buildAggregate(groups, record) {
    const latestGroup = groups
        .filter((group) => group.latestScannedAt !== '-')
        .sort((left, right) => compareDateTime(right.latestScannedAt, left.latestScannedAt))[0] || null;
    const totalCount = Math.max(groups.length, 1);
    const configuredCount = groups.filter((group) => group.lines.every((line) => line.configStatus === 'CONFIGURED')).length;
    const receiveSuccessCount = groups.filter((group) => group.latestResultStatus === 'MATCHED').length;
    const recheckRequiredCount = groups.filter((group) => group.needsRecheck).length;
    const photoSubmittedCount = groups.filter((group) => group.hasPhotoEvidence).length;
    return {
        printedSlipCount: groups.filter((group) => group.printed).length,
        qrGeneratedCount: groups.filter((group) => group.qrGenerated).length,
        receiveSuccessCount,
        recheckRequiredCount,
        photoSubmittedCount,
        latestReceiveAt: latestGroup?.latestScannedAt || '-',
        latestReceiveBy: latestGroup?.latestScannedBy || '-',
        materialReceiveSummaryText: `配料 ${configuredCount}/${totalCount} · 领料成功 ${receiveSuccessCount}/${totalCount}`,
        resultSummaryText: latestGroup?.resultSummaryText
            || (record.materialLines.length > 0 ? '当前尚未形成正式扫码回执。' : '当前生产单下暂无可汇总的配料行。'),
    };
}
function buildSummary(groups, aggregate) {
    const representative = groups
        .slice()
        .sort((left, right) => {
        const dateDiff = compareDateTime(right.latestScannedAt === '-' ? '' : right.latestScannedAt, left.latestScannedAt === '-' ? '' : left.latestScannedAt);
        if (dateDiff !== 0)
            return dateDiff;
        return right.printCopyCount - left.printCopyCount;
    })[0] || null;
    if (!representative) {
        return {
            pickupSlipNo: '-',
            latestPrintVersionNo: '-',
            printCopyCount: 0,
            printSlipStatusLabel: '未打印',
            qrCodeValue: '-',
            qrStatus: '未生成二维码',
            latestResultStatus: 'NOT_SCANNED',
            latestResultLabel: '未扫码回写',
            latestScannedBy: '-',
            needsRecheck: false,
            hasPhotoEvidence: false,
            photoProofCount: 0,
            receiptStatus: 'NOT_SCANNED',
            receiptStatusLabel: '未回执',
            latestScannedAt: '-',
            printVersionSummaryText: '当前尚无打印版本',
            qrBindingSummaryText: '当前尚未生成二维码绑定对象',
            resultSummaryText: '当前尚无正式领料回写。',
            evidenceSummaryText: '当前无照片凭证',
            summaryText: '当前没有领料回执摘要。',
        };
    }
    return {
        pickupSlipNo: representative.pickupSlipNo,
        latestPrintVersionNo: representative.latestPrintVersionNo,
        printCopyCount: representative.printCopyCount,
        printSlipStatusLabel: representative.printSlipStatusLabel,
        qrCodeValue: representative.qrCodeValue,
        qrStatus: representative.qrGenerated ? '已生成二维码' : '未生成二维码',
        latestResultStatus: representative.latestResultStatus,
        latestResultLabel: representative.latestResultLabel,
        latestScannedBy: representative.latestScannedBy,
        needsRecheck: representative.needsRecheck,
        hasPhotoEvidence: representative.hasPhotoEvidence,
        photoProofCount: representative.photoProofCount,
        receiptStatus: representative.receiptStatus,
        receiptStatusLabel: representative.receiptStatusLabel,
        latestScannedAt: representative.latestScannedAt,
        printVersionSummaryText: representative.printed
            ? `当前共打印 ${aggregate.printedSlipCount} 张领料单，最新版本 ${representative.latestPrintVersionNo}`
            : '当前尚无打印版本',
        qrBindingSummaryText: representative.qrBindingSummaryText,
        resultSummaryText: representative.resultSummaryText,
        evidenceSummaryText: representative.evidenceSummaryText,
        summaryText: `${aggregate.materialReceiveSummaryText}；${representative.resultSummaryText}`,
    };
}
export function buildPlatformCuttingPrepProjection(snapshot, record, cutOrderRefs) {
    const groupedLines = groupLinesByCutOrder(record, cutOrderRefs);
    const pickupWritebacks = snapshot.pdaExecutionState.pickupWritebacks;
    const groups = groupedLines.map((group) => {
        const writebacks = pickupWritebacks.filter((item) => {
            if (group.cutOrderId)
                return item.cutOrderId === group.cutOrderId;
            if (group.cutOrderNo)
                return item.cutOrderNo === group.cutOrderNo;
            return item.productionOrderId === record.productionOrderId || item.productionOrderNo === record.productionOrderNo;
        });
        return buildGroupProjection({
            record,
            cutOrderId: group.cutOrderId,
            cutOrderNo: group.cutOrderNo,
            lines: group.lines,
            writebacks,
        });
    });
    const aggregate = buildAggregate(groups, record);
    const summary = buildSummary(groups, aggregate);
    return { aggregate, summary };
}
export function listPlatformCuttingPrepRowsByProductionOrder(snapshot) {
    return snapshot.progressRecords.map((record) => ({
        productionOrderId: record.productionOrderId,
        productionOrderNo: record.productionOrderNo,
        prep: buildPlatformCuttingPrepProjection(snapshot, record, snapshot.cutOrders
            .filter((item) => item.productionOrderId === record.productionOrderId)
            .map((item) => snapshot.registry.cutOrdersById[item.cutOrderId] || snapshot.registry.cutOrdersByNo[item.cutOrderNo])
            .filter((item) => Boolean(item))),
    }));
}
export function getPlatformCuttingPrepStatusByProductionOrder(snapshot, productionOrderId) {
    const record = snapshot.progressRecords.find((item) => item.productionOrderId === productionOrderId);
    if (!record)
        return null;
    const cutOrderRefs = snapshot.cutOrders
        .filter((item) => item.productionOrderId === productionOrderId)
        .map((item) => snapshot.registry.cutOrdersById[item.cutOrderId] || snapshot.registry.cutOrdersByNo[item.cutOrderNo])
        .filter((item) => Boolean(item));
    return buildPlatformCuttingPrepProjection(snapshot, record, cutOrderRefs);
}
