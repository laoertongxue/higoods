const LEGACY_DECISION_RESULTS = ['调整', '暂缓', '继续调整', '改版后重测', '继续开发', '终止'];
const DECISION_WORK_ITEM_CODES = ['FEASIBILITY_REVIEW', 'SAMPLE_CONFIRM', 'TEST_CONCLUSION'];
const DECISION_FIELD_KEY_MAP = {
    FEASIBILITY_REVIEW: 'reviewConclusion',
    SAMPLE_CONFIRM: 'confirmResult',
    TEST_CONCLUSION: 'conclusion',
};
function isDecisionWorkItemCode(workItemTypeCode) {
    return DECISION_WORK_ITEM_CODES.includes(workItemTypeCode);
}
function isLegacyDecisionResult(value) {
    return typeof value === 'string' && LEGACY_DECISION_RESULTS.includes(value);
}
function stripLegacyTestConclusionFields(payload) {
    const nextPayload = { ...payload };
    delete nextPayload.revisionTaskId;
    delete nextPayload.revisionTaskCode;
    delete nextPayload.projectTerminated;
    delete nextPayload.projectTerminatedAt;
    return nextPayload;
}
function migrateDecisionNodeStatus(status, hasLegacyDecision) {
    if (!hasLegacyDecision)
        return status;
    if (status === '已完成')
        return '待确认';
    if (status === '已取消')
        return '待确认';
    return '待确认';
}
export function migrateProjectDecisionInlineRecords(records) {
    return records.map((record) => {
        if (!isDecisionWorkItemCode(record.workItemTypeCode)) {
            if (record.workItemTypeCode === 'TEST_CONCLUSION') {
                return {
                    ...record,
                    payload: stripLegacyTestConclusionFields(record.payload || {}),
                    detailSnapshot: stripLegacyTestConclusionFields(record.detailSnapshot || {}),
                };
            }
            return record;
        }
        const decisionFieldKey = DECISION_FIELD_KEY_MAP[record.workItemTypeCode];
        const payload = { ...(record.payload || {}) };
        const detailSnapshot = { ...(record.detailSnapshot || {}) };
        const legacyDecision = payload[decisionFieldKey];
        if (!isLegacyDecisionResult(legacyDecision)) {
            if (record.workItemTypeCode === 'TEST_CONCLUSION') {
                return {
                    ...record,
                    payload: stripLegacyTestConclusionFields(payload),
                    detailSnapshot: stripLegacyTestConclusionFields(detailSnapshot),
                };
            }
            return record;
        }
        payload[`${decisionFieldKey}LegacyValue`] = legacyDecision;
        payload[decisionFieldKey] = '';
        payload.migrationNote = `旧决策结果“${legacyDecision}”已失效，请重新选择通过或淘汰。`;
        if (record.workItemTypeCode === 'TEST_CONCLUSION') {
            return {
                ...record,
                recordStatus: '待确认',
                payload: stripLegacyTestConclusionFields(payload),
                detailSnapshot: stripLegacyTestConclusionFields(detailSnapshot),
                updatedAt: record.updatedAt || record.createdAt,
            };
        }
        return {
            ...record,
            recordStatus: '待确认',
            payload,
            detailSnapshot,
            updatedAt: record.updatedAt || record.createdAt,
        };
    });
}
export function migrateProjectDecisionSnapshot(snapshot) {
    const migratedNodes = snapshot.nodes.map((node) => {
        if (!isDecisionWorkItemCode(node.workItemTypeCode))
            return { ...node };
        const hasLegacyDecision = isLegacyDecisionResult(node.latestResultType);
        if (!hasLegacyDecision)
            return { ...node };
        return {
            ...node,
            currentStatus: migrateDecisionNodeStatus(node.currentStatus, true),
            latestResultType: '',
            latestResultText: '',
            pendingActionType: '重新判定',
            pendingActionText: '请重新选择通过或淘汰。',
            currentIssueType: '旧决策结果待确认',
            currentIssueText: `旧决策结果“${node.latestResultType}”已失效，请重新确认。`,
            updatedAt: node.updatedAt || node.lastEventTime || '',
        };
    });
    const projectIdsWithLegacyDecision = new Set(migratedNodes
        .filter((node) => node.currentStatus === '待确认' && isDecisionWorkItemCode(node.workItemTypeCode))
        .map((node) => node.projectId));
    return {
        ...snapshot,
        projects: snapshot.projects.map((project) => project.projectStatus === '已终止' && projectIdsWithLegacyDecision.has(project.projectId)
            ? {
                ...project,
                projectStatus: '进行中',
            }
            : { ...project }),
        phases: snapshot.phases.map((phase) => ({ ...phase })),
        nodes: migratedNodes,
    };
}
export function migrateProjectDecisionInlineRecordSnapshot(snapshot) {
    return {
        ...snapshot,
        records: migrateProjectDecisionInlineRecords(snapshot.records),
    };
}
