import { processTasks } from '../process-tasks.ts';
import { listRuntimeExecutionTasks, } from '../runtime-process-tasks.ts';
const STAGE_LABEL_BY_CODE = {
    PREP: '准备阶段',
    PROD: '生产阶段',
    POST: '后道阶段',
};
const STAGE_LABEL_BY_LEGACY_STAGE = {
    CUTTING: '裁片阶段',
    SEWING: '生产阶段',
    POST: '后道阶段',
    SPECIAL: '特殊工艺阶段',
};
const GRANULARITY_LABEL = {
    ORDER: '按生产单',
    COLOR: '按颜色',
    SKU: '按SKU',
    DETAIL: '按明细行',
};
const syntheticTaskFacts = new Map();
function toTimeNumber(value) {
    if (!value)
        return 0;
    const normalized = value.includes('T') ? value : value.replace(' ', 'T');
    const parsed = new Date(normalized).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
}
function normalizeRecordLike(value) {
    if (!value)
        return {};
    if (Array.isArray(value)) {
        const normalized = {};
        for (const entry of value) {
            if (!entry || typeof entry !== 'object')
                continue;
            const keyCandidate = entry.key
                ?? entry.code
                ?? entry.name;
            const valueCandidate = entry.value
                ?? entry.id
                ?? entry.label;
            if (typeof keyCandidate !== 'string')
                continue;
            if (typeof valueCandidate === 'string') {
                normalized[keyCandidate] = valueCandidate;
            }
            else if (Array.isArray(valueCandidate)) {
                normalized[keyCandidate] = valueCandidate.filter((item) => typeof item === 'string');
            }
        }
        return normalized;
    }
    if (typeof value === 'object') {
        const normalized = {};
        for (const [key, item] of Object.entries(value)) {
            if (typeof item === 'string') {
                normalized[key] = item;
            }
            else if (Array.isArray(item)) {
                normalized[key] = item.filter((entry) => typeof entry === 'string');
            }
        }
        return normalized;
    }
    return {};
}
function cloneDetailRows(task) {
    const rows = task.scopeDetailRows.length > 0 ? task.scopeDetailRows : task.detailRows ?? [];
    return rows.map((row) => ({
        ...row,
        dimensions: normalizeRecordLike(row.dimensions),
        sourceRefs: normalizeRecordLike(row.sourceRefs),
    }));
}
function createFallbackTask(runtimeTask) {
    const now = runtimeTask.updatedAt || runtimeTask.createdAt || '2026-03-20 00:00:00';
    return {
        taskId: runtimeTask.taskId,
        taskNo: runtimeTask.taskNo || runtimeTask.taskId,
        productionOrderId: runtimeTask.productionOrderId,
        seq: runtimeTask.seq,
        processCode: runtimeTask.processCode,
        processNameZh: runtimeTask.processNameZh,
        stage: runtimeTask.stage,
        qty: runtimeTask.scopeQty || runtimeTask.qty,
        qtyUnit: runtimeTask.qtyUnit,
        assignmentMode: runtimeTask.assignmentMode,
        assignmentStatus: runtimeTask.assignmentStatus,
        ownerSuggestion: { kind: 'MAIN_FACTORY' },
        qcPoints: [],
        stdTimeMinutes: runtimeTask.publishedSamPerUnit ?? runtimeTask.stdTimeMinutes,
        difficulty: runtimeTask.difficulty,
        publishedSamPerUnit: runtimeTask.publishedSamPerUnit,
        publishedSamUnit: runtimeTask.publishedSamUnit,
        publishedSamTotal: runtimeTask.publishedSamTotal,
        publishedSamDifficulty: runtimeTask.publishedSamDifficulty,
        publishedSamSource: runtimeTask.publishedSamSource,
        attachments: [],
        status: runtimeTask.status,
        assignedFactoryId: runtimeTask.assignedFactoryId,
        assignedFactoryName: runtimeTask.assignedFactoryName,
        acceptDeadline: runtimeTask.acceptDeadline,
        taskDeadline: runtimeTask.taskDeadline,
        dispatchRemark: runtimeTask.dispatchRemark,
        dispatchedAt: runtimeTask.dispatchedAt,
        dispatchedBy: runtimeTask.dispatchedBy,
        acceptanceStatus: runtimeTask.acceptanceStatus,
        acceptedAt: runtimeTask.acceptedAt,
        acceptedBy: runtimeTask.acceptedBy,
        startDueAt: runtimeTask.startDueAt,
        startDueSource: runtimeTask.startDueSource,
        startRiskStatus: runtimeTask.startRiskStatus,
        startHeadcount: runtimeTask.startHeadcount,
        startProofFiles: runtimeTask.startProofFiles ? [...runtimeTask.startProofFiles] : undefined,
        startOverdueExceptionId: runtimeTask.startOverdueExceptionId,
        milestoneRuleType: runtimeTask.milestoneRuleType,
        milestoneRuleLabel: runtimeTask.milestoneRuleLabel,
        milestoneTargetQty: runtimeTask.milestoneTargetQty,
        milestoneTargetUnit: runtimeTask.milestoneTargetUnit,
        milestoneRequired: runtimeTask.milestoneRequired,
        milestoneStatus: runtimeTask.milestoneStatus,
        milestoneReportedAt: runtimeTask.milestoneReportedAt,
        milestoneReportedQty: runtimeTask.milestoneReportedQty,
        milestoneProofFiles: runtimeTask.milestoneProofFiles ? [...runtimeTask.milestoneProofFiles] : undefined,
        milestoneProofRequirement: runtimeTask.milestoneProofRequirement,
        milestoneOverdueExceptionEnabled: runtimeTask.milestoneOverdueExceptionEnabled,
        milestoneOverdueHours: runtimeTask.milestoneOverdueHours,
        milestoneExceptionSeverity: runtimeTask.milestoneExceptionSeverity,
        milestoneOverdueExceptionId: runtimeTask.milestoneOverdueExceptionId,
        startedAt: runtimeTask.startedAt,
        finishedAt: runtimeTask.finishedAt,
        taskQrValue: runtimeTask.taskQrValue,
        taskQrStatus: runtimeTask.taskQrStatus,
        handoverAutoCreatePolicy: runtimeTask.handoverAutoCreatePolicy,
        handoverOrderId: runtimeTask.handoverOrderId,
        handoverStatus: runtimeTask.handoverStatus,
        receiverKind: runtimeTask.receiverKind,
        receiverId: runtimeTask.receiverId,
        receiverName: runtimeTask.receiverName,
        dependsOnTaskIds: [...runtimeTask.dependsOnTaskIds],
        taskCategoryZh: runtimeTask.taskCategoryZh,
        stageCode: runtimeTask.stageCode,
        stageName: runtimeTask.stageName,
        processBusinessCode: runtimeTask.processBusinessCode,
        processBusinessName: runtimeTask.processBusinessName,
        craftCode: runtimeTask.craftCode,
        craftName: runtimeTask.craftName,
        selectedTargetObject: runtimeTask.selectedTargetObject,
        assignmentGranularity: runtimeTask.assignmentGranularity,
        ruleSource: runtimeTask.ruleSource,
        detailSplitMode: runtimeTask.detailSplitMode,
        detailSplitDimensions: runtimeTask.detailSplitDimensions ? [...runtimeTask.detailSplitDimensions] : [],
        detailRows: cloneDetailRows(runtimeTask),
        rootTaskNo: runtimeTask.rootTaskNo || runtimeTask.taskNo || runtimeTask.taskId,
        splitGroupId: runtimeTask.splitGroupId,
        splitFromTaskNo: runtimeTask.splitFromTaskNo,
        splitSeq: runtimeTask.splitSeq,
        detailRowKeys: runtimeTask.detailRowKeys ? [...runtimeTask.detailRowKeys] : runtimeTask.scopeDetailRows.map((row) => row.rowKey),
        isSplitResult: runtimeTask.isSplitResult,
        isSplitSource: runtimeTask.isSplitSource,
        executionEnabled: runtimeTask.executionEnabled,
        defaultDocType: runtimeTask.defaultDocType,
        taskTypeMode: runtimeTask.taskTypeMode,
        isSpecialCraft: runtimeTask.isSpecialCraft,
        woolTaskType: runtimeTask.woolTaskType,
        woolKind: runtimeTask.woolKind,
        woolKindLabel: runtimeTask.woolKindLabel,
        woolOrderId: runtimeTask.woolOrderId,
        woolOrderNo: runtimeTask.woolOrderNo,
        woolDownstreamTarget: runtimeTask.woolDownstreamTarget,
        yarnSku: runtimeTask.yarnSku,
        yarnPlannedWeightKg: runtimeTask.yarnPlannedWeightKg,
        yarnReceivedWeightKg: runtimeTask.yarnReceivedWeightKg,
        requiresFeiTicket: runtimeTask.requiresFeiTicket,
        packagingRequired: runtimeTask.packagingRequired,
        materialIssueMode: runtimeTask.materialIssueMode,
        mockReceiveSummary: runtimeTask.mockReceiveSummary,
        mockExecutionSummary: runtimeTask.mockExecutionSummary,
        mockHandoverSummary: runtimeTask.mockHandoverSummary,
        mockStartPrerequisiteMet: runtimeTask.mockStartPrerequisiteMet,
        createdAt: now,
        updatedAt: now,
        auditLogs: [...runtimeTask.auditLogs],
    };
}
function syncTaskFromRuntime(task, runtimeTask, forceRuntime = false) {
    const runtimeWins = forceRuntime || toTimeNumber(task.updatedAt) <= toTimeNumber(runtimeTask.updatedAt);
    task.taskNo = runtimeTask.taskNo || runtimeTask.taskId;
    task.productionOrderId = runtimeTask.productionOrderId;
    task.seq = runtimeTask.seq;
    task.processCode = runtimeTask.processCode;
    task.processNameZh = runtimeTask.processNameZh;
    task.stage = runtimeTask.stage;
    task.qty = runtimeTask.scopeQty || runtimeTask.qty;
    task.qtyUnit = runtimeTask.qtyUnit;
    task.dependsOnTaskIds = [...runtimeTask.dependsOnTaskIds];
    task.stdTimeMinutes = runtimeTask.publishedSamPerUnit ?? runtimeTask.stdTimeMinutes;
    task.difficulty = runtimeTask.difficulty;
    task.publishedSamPerUnit = runtimeTask.publishedSamPerUnit;
    task.publishedSamUnit = runtimeTask.publishedSamUnit;
    task.publishedSamTotal = runtimeTask.publishedSamTotal;
    task.publishedSamDifficulty = runtimeTask.publishedSamDifficulty;
    task.publishedSamSource = runtimeTask.publishedSamSource;
    task.stageCode = runtimeTask.stageCode;
    task.stageName = runtimeTask.stageName;
    task.processBusinessCode = runtimeTask.processBusinessCode;
    task.processBusinessName = runtimeTask.processBusinessName;
    task.craftCode = runtimeTask.craftCode;
    task.craftName = runtimeTask.craftName;
    task.selectedTargetObject = runtimeTask.selectedTargetObject;
    task.assignmentGranularity = runtimeTask.assignmentGranularity;
    task.ruleSource = runtimeTask.ruleSource;
    task.detailSplitMode = runtimeTask.detailSplitMode;
    task.detailSplitDimensions = runtimeTask.detailSplitDimensions ? [...runtimeTask.detailSplitDimensions] : [];
    task.detailRows = cloneDetailRows(runtimeTask);
    task.rootTaskNo = runtimeTask.rootTaskNo || runtimeTask.taskNo || runtimeTask.taskId;
    task.splitGroupId = runtimeTask.splitGroupId;
    task.splitFromTaskNo = runtimeTask.splitFromTaskNo;
    task.splitSeq = runtimeTask.splitSeq;
    task.detailRowKeys = runtimeTask.detailRowKeys ? [...runtimeTask.detailRowKeys] : runtimeTask.scopeDetailRows.map((row) => row.rowKey);
    task.isSplitResult = runtimeTask.isSplitResult;
    task.isSplitSource = runtimeTask.isSplitSource;
    task.executionEnabled = runtimeTask.executionEnabled;
    task.defaultDocType = runtimeTask.defaultDocType;
    task.taskTypeMode = runtimeTask.taskTypeMode;
    task.isSpecialCraft = runtimeTask.isSpecialCraft;
    task.taskCategoryZh = runtimeTask.taskCategoryZh;
    task.woolTaskType = runtimeTask.woolTaskType;
    task.woolKind = runtimeTask.woolKind;
    task.woolKindLabel = runtimeTask.woolKindLabel;
    task.woolOrderId = runtimeTask.woolOrderId;
    task.woolOrderNo = runtimeTask.woolOrderNo;
    task.woolDownstreamTarget = runtimeTask.woolDownstreamTarget;
    task.yarnSku = runtimeTask.yarnSku;
    task.yarnPlannedWeightKg = runtimeTask.yarnPlannedWeightKg;
    task.yarnReceivedWeightKg = runtimeTask.yarnReceivedWeightKg;
    task.requiresFeiTicket = runtimeTask.requiresFeiTicket;
    task.packagingRequired = runtimeTask.packagingRequired;
    task.materialIssueMode = runtimeTask.materialIssueMode;
    task.mockReceiveSummary = runtimeTask.mockReceiveSummary;
    task.mockExecutionSummary = runtimeTask.mockExecutionSummary;
    task.mockHandoverSummary = runtimeTask.mockHandoverSummary;
    task.mockStartPrerequisiteMet = runtimeTask.mockStartPrerequisiteMet;
    if (!runtimeWins)
        return;
    task.assignmentMode = runtimeTask.assignmentMode;
    task.assignmentStatus = runtimeTask.assignmentStatus;
    task.assignedFactoryId = runtimeTask.assignedFactoryId;
    task.assignedFactoryName = runtimeTask.assignedFactoryName;
    task.acceptDeadline = runtimeTask.acceptDeadline;
    task.taskDeadline = runtimeTask.taskDeadline;
    task.dispatchRemark = runtimeTask.dispatchRemark;
    task.dispatchedAt = runtimeTask.dispatchedAt;
    task.dispatchedBy = runtimeTask.dispatchedBy;
    task.standardPrice = runtimeTask.standardPrice;
    task.standardPriceCurrency = runtimeTask.standardPriceCurrency;
    task.standardPriceUnit = runtimeTask.standardPriceUnit;
    task.dispatchPrice = runtimeTask.dispatchPrice;
    task.dispatchPriceCurrency = runtimeTask.dispatchPriceCurrency;
    task.dispatchPriceUnit = runtimeTask.dispatchPriceUnit;
    task.priceDiffReason = runtimeTask.priceDiffReason;
    task.acceptanceStatus = runtimeTask.acceptanceStatus;
    task.acceptedAt = runtimeTask.acceptedAt;
    task.acceptedBy = runtimeTask.acceptedBy;
    task.awardedAt = runtimeTask.awardedAt;
    task.status = runtimeTask.status;
    task.startDueAt = runtimeTask.startDueAt;
    task.startDueSource = runtimeTask.startDueSource;
    task.startRiskStatus = runtimeTask.startRiskStatus;
    task.startHeadcount = runtimeTask.startHeadcount;
    task.startProofFiles = runtimeTask.startProofFiles ? [...runtimeTask.startProofFiles] : undefined;
    task.startOverdueExceptionId = runtimeTask.startOverdueExceptionId;
    task.milestoneRuleType = runtimeTask.milestoneRuleType;
    task.milestoneRuleLabel = runtimeTask.milestoneRuleLabel;
    task.milestoneTargetQty = runtimeTask.milestoneTargetQty;
    task.milestoneTargetUnit = runtimeTask.milestoneTargetUnit;
    task.milestoneRequired = runtimeTask.milestoneRequired;
    task.milestoneStatus = runtimeTask.milestoneStatus;
    task.milestoneReportedAt = runtimeTask.milestoneReportedAt;
    task.milestoneReportedQty = runtimeTask.milestoneReportedQty;
    task.milestoneProofFiles = runtimeTask.milestoneProofFiles ? [...runtimeTask.milestoneProofFiles] : undefined;
    task.milestoneProofRequirement = runtimeTask.milestoneProofRequirement;
    task.milestoneOverdueExceptionEnabled = runtimeTask.milestoneOverdueExceptionEnabled;
    task.milestoneOverdueHours = runtimeTask.milestoneOverdueHours;
    task.milestoneExceptionSeverity = runtimeTask.milestoneExceptionSeverity;
    task.milestoneOverdueExceptionId = runtimeTask.milestoneOverdueExceptionId;
    task.startedAt = runtimeTask.startedAt;
    task.finishedAt = runtimeTask.finishedAt;
    task.taskQrValue = runtimeTask.taskQrValue;
    task.taskQrStatus = runtimeTask.taskQrStatus;
    task.handoverAutoCreatePolicy = runtimeTask.handoverAutoCreatePolicy;
    task.handoverOrderId = runtimeTask.handoverOrderId;
    task.handoverStatus = runtimeTask.handoverStatus;
    task.receiverKind = runtimeTask.receiverKind;
    task.receiverId = runtimeTask.receiverId;
    task.receiverName = runtimeTask.receiverName;
    task.blockReason = runtimeTask.blockReason;
    task.blockRemark = runtimeTask.blockRemark;
    task.blockedAt = runtimeTask.blockedAt;
    task.hasMaterialRequest = runtimeTask.hasMaterialRequest;
    task.materialRequestNo = runtimeTask.materialRequestNo;
    task.materialMode = runtimeTask.materialMode;
    task.materialModeLabel = runtimeTask.materialModeLabel;
    task.materialRequestStatus = runtimeTask.materialRequestStatus;
    task.updatedAt = runtimeTask.updatedAt;
    task.createdAt = runtimeTask.createdAt;
    task.auditLogs = [...runtimeTask.auditLogs];
}
function resolveProcessName(task) {
    return task.processBusinessName || task.processNameZh || task.processCode;
}
function resolveTaskTypeName(task) {
    if (task.taskCategoryZh)
        return task.taskCategoryZh;
    if (task.isSpecialCraft)
        return task.craftName || resolveProcessName(task);
    return resolveProcessName(task);
}
export function getTaskStageDisplayName(task) {
    if (task.stageName)
        return task.stageName;
    if (task.stageCode && STAGE_LABEL_BY_CODE[task.stageCode])
        return STAGE_LABEL_BY_CODE[task.stageCode];
    return STAGE_LABEL_BY_LEGACY_STAGE[task.stage] || task.stage;
}
export function getTaskProcessDisplayName(task) {
    return task.isSpecialCraft ? resolveTaskTypeName(task) : resolveProcessName(task);
}
export function getTaskTypeDisplayName(task) {
    return resolveTaskTypeName(task);
}
export function getTaskGranularityDisplayName(task) {
    const granularity = task.assignmentGranularity;
    if (granularity && GRANULARITY_LABEL[granularity])
        return GRANULARITY_LABEL[granularity];
    return '-';
}
export function listExecutionTaskFacts() {
    const runtimeTasks = listRuntimeExecutionTasks().filter((task) => task.defaultDocType !== 'DEMAND');
    const runtimeTaskIds = new Set(runtimeTasks.map((task) => task.taskId));
    const facts = [];
    for (const key of syntheticTaskFacts.keys()) {
        if (!runtimeTaskIds.has(key))
            syntheticTaskFacts.delete(key);
    }
    for (const runtimeTask of runtimeTasks) {
        const directBase = processTasks.find((task) => task.taskId === runtimeTask.taskId);
        if (directBase) {
            syncTaskFromRuntime(directBase, runtimeTask);
            facts.push(directBase);
            continue;
        }
        const synthetic = syntheticTaskFacts.get(runtimeTask.taskId) ?? createFallbackTask(runtimeTask);
        syncTaskFromRuntime(synthetic, runtimeTask, true);
        syntheticTaskFacts.set(runtimeTask.taskId, synthetic);
        facts.push(synthetic);
    }
    return facts.sort((a, b) => {
        if (a.productionOrderId !== b.productionOrderId) {
            return a.productionOrderId.localeCompare(b.productionOrderId);
        }
        if (a.seq !== b.seq)
            return a.seq - b.seq;
        const splitSeqA = a.splitSeq ?? 0;
        const splitSeqB = b.splitSeq ?? 0;
        if (splitSeqA !== splitSeqB)
            return splitSeqA - splitSeqB;
        return (a.taskNo || a.taskId).localeCompare(b.taskNo || b.taskId);
    });
}
export function getExecutionTaskFactById(taskId) {
    return listExecutionTaskFacts().find((task) => task.taskId === taskId) ?? null;
}
export function toExecutionTaskFact(task) {
    return {
        ...task,
        displayStageName: getTaskStageDisplayName(task),
        displayProcessName: getTaskProcessDisplayName(task),
        displayTaskType: getTaskTypeDisplayName(task),
        displayGranularity: getTaskGranularityDisplayName(task),
    };
}
