import { listMilestoneConfigs } from '../milestone-configs.ts';
import { buildSpreadingListViewModel, readMarkerSpreadingPrototypeData, } from '../../../pages/process-factory/cutting/marker-spreading-utils.ts';
import { deriveSpreadingCuttingStatus, deriveSpreadingListStatus, } from '../../../pages/process-factory/cutting/marker-spreading-model.ts';
import { DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES } from '../../../pages/process-factory/cutting/cutting-table-resource.ts';
function normalizeText(value) {
    return String(value || '').trim();
}
function getCuttingReportConfig() {
    const config = listMilestoneConfigs().find((item) => item.processCode === 'PROC_CUT' || item.taskTypeScope === 'CUTTING');
    if (!config) {
        return {
            configId: '未配置',
            processName: '裁片',
            enabled: false,
            ruleLabel: '未配置执行上报规则',
            proofRequirementLabel: '未配置',
            startProofRequirementLabel: '未配置',
            startDueHours: 0,
            label: '执行上报配置未配置',
        };
    }
    return {
        configId: config.id,
        processName: config.processNameZh,
        enabled: config.enabled,
        ruleLabel: config.enabled ? config.ruleLabel : '节点上报未启用',
        proofRequirementLabel: config.proofRequirementLabel,
        startProofRequirementLabel: config.startProofRequirementLabel,
        startDueHours: config.startDueHours,
        label: config.enabled
            ? `${config.processNameZh} · ${config.ruleLabel} · ${config.proofRequirementLabel}`
            : `${config.processNameZh} · 已关联配置 · 节点上报未启用`,
    };
}
function mapStageToTab(stageLabel) {
    if (stageLabel.includes('铺布中'))
        return 'IN_PROGRESS';
    if (stageLabel.includes('待铺布') || stageLabel.includes('待开始'))
        return 'NOT_STARTED';
    return 'DONE';
}
function getActionLabel(stageLabel) {
    if (stageLabel.includes('待铺布') || stageLabel.includes('待开始'))
        return '开始铺布';
    if (stageLabel.includes('铺布中'))
        return '继续铺布';
    return '查看现场记录';
}
function getRows() {
    const data = readMarkerSpreadingPrototypeData();
    return buildSpreadingListViewModel({
        spreadingSessions: data.store.sessions,
        rowsById: data.rowsById,
        markerPlanRefs: data.markerPlanRefs,
        markerRecords: data.store.markers,
    });
}
function mapRowToSession(taskId, row, reportConfig = getCuttingReportConfig()) {
    const stage = deriveSpreadingListStatus(row.session.status);
    const sourceTypeLabel = row.contextType === 'marker-plan-ref' ? '唛架方案' : '裁片单';
    const sourceOrderLabel = row.contextType === 'marker-plan-ref'
        ? row.markerPlanNo || row.cutOrderNos.join(' / ')
        : row.cutOrderNos.join(' / ');
    const productionOrderNo = row.productionOrderNos[0] || '';
    const stageLabel = stage.label;
    const cuttingStageLabel = row.session.cuttingStatus
        ? deriveSpreadingCuttingStatus(row.session.cuttingStatus).label
        : row.session.status === 'DONE'
            ? '待裁剪'
            : '—';
    return {
        taskId,
        spreadingSessionId: row.spreadingSessionId,
        sessionNo: row.sessionNo,
        productionOrderNo,
        sourceOrderLabel,
        sourceTypeLabel,
        markerPlanNo: row.session.sourceSchemeNo || row.session.markerNo || row.session.sourceMarkerNo || row.session.markerId || '待绑定方案',
        markerBedNo: row.session.sourceBedNo || row.sourceMarkerLabel || '待绑定唛架编号',
        markerBedMode: row.spreadingModeLabel,
        cuttingTableName: row.session.cuttingTableName || row.session.cuttingTableNo || '未排程裁床',
        plannedStartAt: row.session.plannedStartAt || '未排程',
        plannedEndAt: row.session.plannedEndAt || '未排程',
        actualStartAt: row.session.actualStartAt || '',
        actualEndAt: row.session.actualEndAt || '',
        estimatedDurationMinutes: row.session.estimatedDurationMinutes || DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES,
        spuCode: row.spuCode,
        styleCode: row.styleCode,
        materialSku: row.materialSkuSummary,
        color: row.colorSummary || '待补',
        plannedGarmentQty: row.plannedCutGarmentQty,
        actualGarmentQty: row.actualCutGarmentQty,
        mainStageLabel: stageLabel,
        cuttingStageLabel,
        statusTab: mapStageToTab(stageLabel),
        wmsReceiveStatus: row.configuredLengthTotal > 0 || row.claimedLengthTotal > 0 ? '待加工仓已接收' : '待中转仓配料入待加工仓',
        warehouseFlowStatus: row.session.prototypeLifecycleOverrides?.warehouseStatusLabel || '待交出仓未接收',
        feiTicketStatus: row.session.prototypeLifecycleOverrides?.feiTicketStatusLabel || '待打印菲票',
        actionLabel: getActionLabel(stageLabel),
        reportConfig,
        sourceRow: row,
    };
}
export function listCuttingMainlineSessions(taskId = 'TASK-CUT-MAINLINE') {
    return getRows().map((row) => mapRowToSession(taskId, row));
}
export function listCuttingMainlineSessionsForProductionOrder(productionOrderNo, taskId = 'TASK-CUT-MAINLINE') {
    const normalized = normalizeText(productionOrderNo);
    if (!normalized)
        return listCuttingMainlineSessions(taskId).slice(0, 8);
    const matched = getRows().filter((row) => row.productionOrderNos.includes(normalized)).map((row) => mapRowToSession(taskId, row));
    return matched.length ? matched : listCuttingMainlineSessions(taskId).slice(0, 8);
}
export function getCuttingMainlineSession(taskId, spreadingSessionId) {
    return listCuttingMainlineSessions(taskId).find((item) => item.spreadingSessionId === spreadingSessionId) || null;
}
export function getFirstCuttingMainlineSessionForTask(taskId, productionOrderNo) {
    return listCuttingMainlineSessionsForProductionOrder(productionOrderNo, taskId)[0] || null;
}
export function buildCuttingMainlineTaskView(task) {
    const sessions = listCuttingMainlineSessionsForProductionOrder(task.productionOrderId, task.taskId);
    const reportConfig = getCuttingReportConfig();
    const plannedTotal = sessions.reduce((sum, item) => sum + item.plannedGarmentQty, 0);
    return {
        taskId: task.taskId,
        taskNo: task.taskNo || task.taskId,
        productionOrderNo: task.productionOrderId || sessions[0]?.productionOrderNo || '',
        factoryId: task.assignedFactoryId || '',
        factoryName: task.assignedFactoryName || '',
        sessions,
        reportConfig,
        summaryLabel: `${sessions.length} 个铺布任务 · 计划 ${plannedTotal.toLocaleString('zh-CN')} 件`,
    };
}
export function isCuttingProcessTask(task) {
    const processText = `${task.processCode || ''} ${task.processNameZh || ''} ${task.processBusinessName || ''}`;
    return /裁片|裁床|PROC_CUT|CUT/.test(processText);
}
export function buildPdaCuttingMainlineUnitPath(taskId, spreadingSessionId, returnTo) {
    const query = returnTo?.trim() ? `?returnTo=${encodeURIComponent(returnTo.trim())}` : '';
    return `/fcs/pda/cutting/unit/${encodeURIComponent(taskId)}/${encodeURIComponent(spreadingSessionId)}${query}`;
}
export function buildPdaCuttingMainlineTaskPath(taskId, returnTo) {
    const query = returnTo?.trim() ? `?returnTo=${encodeURIComponent(returnTo.trim())}` : '';
    return `/fcs/pda/cutting/task/${encodeURIComponent(taskId)}${query}`;
}
export function buildPdaCuttingMainlinePathForSession(spreadingSessionId, returnTo) {
    return buildPdaCuttingMainlineUnitPath('TASK-CUT-MAINLINE', spreadingSessionId, returnTo);
}
