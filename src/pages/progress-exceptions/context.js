import { appStore } from '../../state/store';
import { escapeHtml } from '../../utils';
import { getExecutionTaskFactById, } from '../../data/fcs/page-adapters/task-execution-adapter';
import { processTypes, getProcessTypeByCode, } from '../../data/fcs/process-types';
import { productionOrders, } from '../../data/fcs/production-orders';
import { indonesiaFactories } from '../../data/fcs/indonesia-factories';
import { extendTenderDeadlineFromRuntime, getTenderByIdFromRuntime, listMaterialIssueSheetsFromRuntime, } from '../../data/fcs/store-domain-dispatch-process';
import { initialNotifications, initialUrges, mockInternalUsers, generateNotificationId, generateUrgeId, getProgressExceptionById, listProgressExceptions, upsertProgressExceptionCase, } from '../../data/fcs/store-domain-progress';
import { applyQualitySeedBootstrap } from '../../data/fcs/store-domain-quality-bootstrap';
import { syncPdaStartRiskAndExceptions } from '../../data/fcs/pda-start-link';
import { ensurePdaPickupDisputeSeedCases } from '../../helpers/fcs-pda-pickup-dispute';
import { allowContinueFromPauseException, recordPauseExceptionFollowUp, syncMilestoneOverdueExceptions, } from '../../data/fcs/pda-exec-link';
import { buildHandoverOrderDetailLink, getProductionOrderHandoverSummary, getTaskHandoverSummary, } from '../../data/fcs/handover-ledger-view';
import { CATEGORY_LABEL, SUB_CATEGORY_LABEL, getDefaultSubCategoryKeyFromReason, getSubCategoryOptionsByCategory, getUnifiedCategoryFromReason, inferLegacySubCategoryKey, isSubCategoryKey, } from '../../data/fcs/progress-exception-taxonomy';
import { appendCaseAction, appendCaseAuditLog, appendCaseStatusChangeAudit, CLOSE_REASON_LABEL, markCaseClosed, markCaseResolved, maybeAutoCloseResolvedCase, RESOLVE_RULE_LABEL, RESOLVE_SOURCE_LABEL, } from '../../data/fcs/progress-exception-lifecycle';
applyQualitySeedBootstrap();
ensurePdaPickupDisputeSeedCases();
export const EXCEPTION_PAGE_SIZE = 20;
export const state = {
    lastQueryKey: '',
    initializedByQuery: false,
    upstreamTaskId: '',
    upstreamPo: '',
    upstreamTenderId: '',
    upstreamReasonCode: '',
    upstreamSeverity: '',
    upstreamCaseId: '',
    showUpstreamHint: false,
    keyword: '',
    statusFilter: 'ALL',
    severityFilter: 'ALL',
    categoryFilter: 'ALL',
    subCategoryFilter: 'ALL',
    ownerFilter: 'ALL',
    factoryFilter: 'ALL',
    processFilter: 'ALL',
    currentPage: 1,
    aggregateFilter: null,
    detailCaseId: null,
    closeDialogCaseId: null,
    closeReason: 'RESOLVED_DONE',
    closeRemark: '',
    closeMergeCaseId: '',
    unblockDialogCaseId: null,
    unblockRemark: '',
    pauseFollowUpCaseId: null,
    pauseFollowUpRemark: '',
    extendDialogCaseId: null,
    claimDisputeHandleStatus: 'VIEWED',
    claimDisputeHandleConclusion: '',
    claimDisputeHandleNote: '',
    pickupDisputeHandleStatus: 'PROCESSING',
    pickupDisputeHandleResolvedQty: '',
    pickupDisputeHandleNote: '',
    rowActionMenuCaseId: null,
};
export const SEVERITY_COLOR_CLASS = {
    S1: 'border-red-200 bg-red-100 text-red-700',
    S2: 'border-orange-200 bg-orange-100 text-orange-700',
    S3: 'border-slate-200 bg-slate-100 text-slate-600',
};
export const STATUS_COLOR_CLASS = {
    OPEN: 'border-red-200 bg-red-100 text-red-700',
    IN_PROGRESS: 'border-blue-200 bg-blue-100 text-blue-700',
    RESOLVED: 'border-green-200 bg-green-100 text-green-700',
    CLOSED: 'border-zinc-200 bg-zinc-100 text-zinc-600',
};
export const STATUS_ICON = {
    OPEN: 'alert-circle',
    IN_PROGRESS: 'play',
    RESOLVED: 'check-circle-2',
    CLOSED: 'x-circle',
};
export const CASE_STATUS_LABEL = {
    OPEN: '待处理',
    IN_PROGRESS: '处理中',
    RESOLVED: '已解决',
    CLOSED: '已关闭',
};
export const DIRECT_CLOSE_REASON_SET = new Set([
    'DUPLICATE',
    'FALSE_ALARM',
    'OBJECT_INVALID',
    'MERGED',
]);
export const REASON_LABEL = {
    BLOCKED_MATERIAL: '物料待处理',
    BLOCKED_CAPACITY: '产能待处理',
    BLOCKED_QUALITY: '质量待处理',
    BLOCKED_TECH: '技术待处理',
    BLOCKED_EQUIPMENT: '设备待处理',
    BLOCKED_OTHER: '其他待处理',
    TENDER_OVERDUE: '竞价逾期',
    TENDER_NEAR_DEADLINE: '竞价临近截止',
    NO_BID: '无人报价',
    PRICE_ABNORMAL: '报价异常',
    DISPATCH_REJECTED: '派单拒单',
    ACK_TIMEOUT: '接单超时',
    TECH_PACK_NOT_RELEASED: '技术包未发布',
    FACTORY_BLACKLISTED: '工厂黑名单',
    HANDOVER_DIFF: '交接差异',
    MATERIAL_NOT_READY: '物料未齐套',
    START_OVERDUE: '开工逾期',
    MILESTONE_NOT_REPORTED: '关键节点未上报',
};
export function getReasonLabel(exc) {
    return exc.reasonLabel || REASON_LABEL[exc.reasonCode] || exc.reasonCode;
}
export function normalizeCaseStatus(status) {
    return status;
}
export function getUnifiedCategory(exc) {
    if (exc.unifiedCategory)
        return exc.unifiedCategory;
    return getUnifiedCategoryFromReason(exc.reasonCode, exc.category);
}
export function getSubCategoryKey(exc) {
    if (exc.subCategoryKey)
        return exc.subCategoryKey;
    const byReason = getDefaultSubCategoryKeyFromReason(exc.reasonCode);
    if (byReason)
        return byReason;
    const legacy = inferLegacySubCategoryKey(exc.reasonCode, exc.summary, exc.detail);
    if (legacy)
        return legacy;
    return 'EXEC_BLOCK_OTHER';
}
export function getSubCategoryLabel(exc) {
    return SUB_CATEGORY_LABEL[getSubCategoryKey(exc)];
}
export function getCaseFactoryId(exc) {
    for (const taskId of exc.relatedTaskIds) {
        const task = getTaskById(taskId);
        if (task?.assignedFactoryId)
            return task.assignedFactoryId;
    }
    return '';
}
export function getCaseFactoryName(exc) {
    const factoryId = getCaseFactoryId(exc);
    if (factoryId)
        return getFactoryById(factoryId)?.name || factoryId;
    return exc.linkedFactoryName || '-';
}
export function getCaseProcessName(exc) {
    const taskId = exc.relatedTaskIds[0];
    if (!taskId)
        return '-';
    const task = getTaskById(taskId);
    if (!task?.processCode)
        return '-';
    return getProcessTypeByCode(task.processCode)?.nameZh || task.processNameZh || task.processCode;
}
export function getRelatedObjects(exc) {
    const rows = [];
    const pushUnique = (typeLabel, id, kind) => {
        if (!id)
            return;
        if (!rows.some((row) => row.typeLabel === typeLabel && row.id === id))
            rows.push({ typeLabel, id, kind });
    };
    for (const orderId of exc.relatedOrderIds)
        pushUnique('生产单', orderId, 'order');
    for (const taskId of exc.relatedTaskIds)
        pushUnique('任务', taskId, 'task');
    for (const tenderId of exc.relatedTenderIds)
        pushUnique('招标单', tenderId, 'tender');
    if (/^PDA-/.test(exc.sourceId))
        pushUnique('工厂端任务', exc.sourceId, 'pda');
    if (/^HO-/.test(exc.sourceId))
        pushUnique('交出单', exc.sourceId, 'handover');
    if (rows.length === 0 && exc.sourceId)
        pushUnique('来源单据', exc.sourceId, 'other');
    return rows;
}
export function getSubCategoryOptions(category) {
    return getSubCategoryOptionsByCategory(category);
}
export const OWNER_OPTIONS = [
    { id: 'U002', name: '跟单A' },
    { id: 'U003', name: '跟单B' },
    { id: 'U004', name: '运营' },
    { id: 'U005', name: '管理员' },
];
export function nowTimestamp(date = new Date()) {
    return date.toISOString().replace('T', ' ').slice(0, 19);
}
export function getCurrentQueryString() {
    const pathname = appStore.getState().pathname;
    const [, query] = pathname.split('?');
    return query ?? '';
}
export function getCurrentSearchParams() {
    return new URLSearchParams(getCurrentQueryString());
}
export function getOrderById(orderId) {
    return productionOrders.find((order) => order.productionOrderId === orderId);
}
export function getFactoryById(factoryId) {
    return indonesiaFactories.find((factory) => factory.id === factoryId);
}
export function getTenderById(tenderId) {
    return getTenderByIdFromRuntime(tenderId);
}
export function getExceptionCases() {
    return listProgressExceptions();
}
export function getCaseById(caseId) {
    return getProgressExceptionById(caseId);
}
export function getTaskById(taskId) {
    return getExecutionTaskFactById(taskId) ?? undefined;
}
export const TASK_STATUS_LABEL = {
    NOT_STARTED: '未开始',
    IN_PROGRESS: '进行中',
    DONE: '已完成',
    BLOCKED: '生产暂停',
    CANCELLED: '已取消',
};
export function getTaskStatusLabel(task) {
    if (!task)
        return '-';
    return TASK_STATUS_LABEL[task.status];
}
export function getMaterialIssueRows(exc) {
    return listMaterialIssueSheetsFromRuntime().filter((item) => (exc.relatedTaskIds.length > 0 && exc.relatedTaskIds.includes(item.taskId)) ||
        (exc.relatedOrderIds.length > 0 && item.productionOrderId && exc.relatedOrderIds.includes(item.productionOrderId)));
}
export function getHandoverCaseSnapshot(exc) {
    const firstOrderId = exc.relatedOrderIds[0];
    const firstTaskId = exc.relatedTaskIds[0];
    return {
        orderSummary: firstOrderId ? getProductionOrderHandoverSummary(firstOrderId) : null,
        taskSummary: firstTaskId ? getTaskHandoverSummary(firstTaskId) : null,
    };
}
export function parseTimestampToMs(value) {
    const parsed = Date.parse(value.replace(' ', 'T'));
    return Number.isNaN(parsed) ? 0 : parsed;
}
export function getRelatedTasks(exc) {
    return exc.relatedTaskIds.map((taskId) => getTaskById(taskId)).filter((task) => Boolean(task));
}
export function getRelatedTenders(exc) {
    return exc.relatedTenderIds
        .map((tenderId) => getTenderById(tenderId))
        .filter((tender) => Boolean(tender));
}
export function getResolveJudgeResult(exc) {
    const unifiedCategory = getUnifiedCategory(exc);
    const relatedTasks = getRelatedTasks(exc);
    const relatedOrders = exc.relatedOrderIds.map((orderId) => getOrderById(orderId)).filter((order) => Boolean(order));
    const relatedTenders = getRelatedTenders(exc);
    if (unifiedCategory === 'ASSIGNMENT') {
        const hasAcceptedTask = relatedTasks.some((task) => task.acceptanceStatus === 'ACCEPTED');
        const hasAwardedTask = relatedTasks.some((task) => task.assignmentStatus === 'AWARDED');
        const allTenderAwarded = relatedTenders.length > 0 && relatedTenders.every((tender) => tender.status === 'AWARDED');
        const resolved = hasAcceptedTask || hasAwardedTask || allTenderAwarded;
        return {
            resolved,
            ruleText: '任务已真正落实承接方（接单成功/竞价定标）后，系统自动判定为已解决。',
            currentResultText: resolved
                ? '当前已满足：任务已落实承接方，可进入关闭流程。'
                : '当前未满足：任务尚未真正落实承接方，请继续推进分配或接单。',
            resolvedDetail: '任务已真正落实承接方，系统自动判定为已解决',
            resolvedRuleCode: 'ASSIGNMENT_TARGET_SECURED',
        };
    }
    if (unifiedCategory === 'EXECUTION') {
        if (exc.reasonCode === 'START_OVERDUE') {
            const resolved = relatedTasks.some((task) => Boolean(task.startedAt));
            return {
                resolved,
                ruleText: '工厂确认开工后，系统自动判定为已解决。',
                currentResultText: resolved
                    ? '当前已满足：任务已确认开工，可进入关闭流程。'
                    : '当前未满足：任务仍未开工，请先推动工厂确认开工。',
                resolvedDetail: '工厂已确认开工，系统自动判定为已解决',
                resolvedRuleCode: 'EXEC_START_CONFIRMED',
            };
        }
        if (exc.reasonCode === 'MILESTONE_NOT_REPORTED') {
            const resolved = relatedTasks.some((task) => task.milestoneStatus === 'REPORTED' || Boolean(task.milestoneReportedAt));
            return {
                resolved,
                ruleText: '关键节点按规则完成上报后，系统自动判定为已解决。',
                currentResultText: resolved
                    ? '当前已满足：任务已补报关键节点，可进入关闭流程。'
                    : '当前未满足：关键节点仍未上报，请先在工厂端移动应用中完成节点上报。',
                resolvedDetail: '任务已补报关键节点，系统自动判定为已解决',
                resolvedRuleCode: 'EXEC_MILESTONE_REPORTED',
            };
        }
        const resolved = relatedTasks.length > 0 &&
            relatedTasks.every((task) => task.status !== 'BLOCKED' && task.pauseStatus !== 'REPORTED' && task.pauseStatus !== 'FOLLOWING_UP');
        return {
            resolved,
            ruleText: '平台允许继续且任务恢复执行后，系统自动判定为已解决。',
            currentResultText: resolved
                ? '当前已满足：任务已恢复进行中，可进入关闭流程。'
                : '当前未满足：任务仍处于生产暂停，请先处理暂停原因并允许继续。',
            resolvedDetail: '任务已恢复可执行状态，系统自动判定为已解决',
            resolvedRuleCode: 'EXEC_RESUMED',
        };
    }
    if (unifiedCategory === 'TECH_PACK') {
        const resolved = relatedOrders.length > 0 && relatedOrders.every((order) => Boolean(order.techPackSnapshot));
        return {
            resolved,
            ruleText: '技术包快照已冻结且可正常使用后，系统自动判定为已解决。',
            currentResultText: resolved
                ? '当前已满足：技术包快照已冻结，可进入关闭流程。'
                : '当前未满足：生产单仍缺少可执行的技术包快照，请先处理技术包。',
            resolvedDetail: '技术包快照已冻结并可用于生产，系统自动判定为已解决',
            resolvedRuleCode: 'TECH_PACK_RELEASED',
        };
    }
    if (unifiedCategory === 'MATERIAL') {
        const rows = getMaterialIssueRows(exc);
        const isSatisfied = rows.every((row) => row.status === 'ISSUED' || row.issuedQty >= row.requestedQty);
        const resolved = rows.length > 0 && isSatisfied;
        return {
            resolved,
            ruleText: '领料记录满足或领料链路闭合后，系统自动判定为已解决。',
            currentResultText: resolved
                ? '当前已满足：领料记录已满足，可进入关闭流程。'
                : '当前未满足：仍有领料缺口或未闭合记录，请继续推进领料。',
            resolvedDetail: '领料记录已满足并闭合，系统自动判定为已解决',
            resolvedRuleCode: 'MATERIAL_SATISFIED',
        };
    }
    const { orderSummary, taskSummary } = getHandoverCaseSnapshot(exc);
    const resolved = taskSummary
        ? taskSummary.processStatusLabel === '已完成'
        : Boolean(orderSummary && !orderSummary.hasOpenIssue);
    return {
        resolved,
        ruleText: '交出差异/数量异议处理完成并闭合后，系统自动判定为已解决。',
        currentResultText: resolved
            ? '当前已满足：交出记录已闭合，可进入关闭流程。'
            : '当前未满足：仍有数量差异或异议未处理，请继续跟进交出处理。',
        resolvedDetail: '交出差异/异议已处理完成，系统自动判定为已解决',
        resolvedRuleCode: 'HANDOUT_ISSUE_CLOSED',
    };
}
export function hasUpstreamFilter() {
    return Boolean(state.upstreamTaskId ||
        state.upstreamPo ||
        state.upstreamTenderId ||
        state.upstreamReasonCode ||
        state.upstreamSeverity ||
        state.upstreamCaseId);
}
export function syncFromQuery() {
    const queryKey = getCurrentQueryString();
    if (state.lastQueryKey === queryKey)
        return;
    state.lastQueryKey = queryKey;
    const params = getCurrentSearchParams();
    state.upstreamTaskId = params.get('taskId') || '';
    state.upstreamPo = params.get('po') || '';
    state.upstreamTenderId = params.get('tenderId') || '';
    state.upstreamReasonCode = params.get('reasonCode') || '';
    state.upstreamSeverity = params.get('severity') || '';
    state.upstreamCaseId = params.get('caseId') || '';
    const hasUpstream = hasUpstreamFilter();
    state.showUpstreamHint = hasUpstream;
    if (!state.initializedByQuery) {
        state.initializedByQuery = true;
        state.statusFilter = 'ALL';
        state.severityFilter = state.upstreamSeverity || 'ALL';
        state.subCategoryFilter = 'ALL';
    }
    else {
        if (state.upstreamSeverity)
            state.severityFilter = state.upstreamSeverity;
    }
    if (state.upstreamReasonCode) {
        const reasonCode = state.upstreamReasonCode;
        const key = getDefaultSubCategoryKeyFromReason(reasonCode);
        if (key)
            state.subCategoryFilter = key;
    }
    if (state.upstreamCaseId) {
        state.detailCaseId = state.upstreamCaseId;
    }
    state.currentPage = 1;
}
export function getSpuFromCase(exc) {
    if (exc.relatedOrderIds.length === 0)
        return '-';
    const order = getOrderById(exc.relatedOrderIds[0]);
    return order?.demandSnapshot?.spuCode || '-';
}
export function filterCases() {
    const exceptionCases = getExceptionCases();
    const queryTaskId = state.upstreamTaskId;
    const queryPo = state.upstreamPo;
    const queryTenderId = state.upstreamTenderId;
    const queryCaseId = state.upstreamCaseId;
    return exceptionCases
        .filter((exc) => {
        if (queryTaskId && !exc.relatedTaskIds.includes(queryTaskId))
            return false;
        if (queryPo && !exc.relatedOrderIds.includes(queryPo))
            return false;
        if (queryTenderId && !exc.relatedTenderIds.includes(queryTenderId))
            return false;
        if (queryCaseId && exc.caseId !== queryCaseId)
            return false;
        if (state.keyword.trim()) {
            const kw = state.keyword.trim().toLowerCase();
            const spuCode = getSpuFromCase(exc);
            const matched = exc.caseId.toLowerCase().includes(kw) ||
                exc.relatedOrderIds.some((id) => id.toLowerCase().includes(kw)) ||
                exc.relatedTaskIds.some((id) => id.toLowerCase().includes(kw)) ||
                exc.summary.toLowerCase().includes(kw) ||
                spuCode.toLowerCase().includes(kw);
            if (!matched)
                return false;
        }
        if (state.statusFilter !== 'ALL' && normalizeCaseStatus(exc.caseStatus) !== state.statusFilter)
            return false;
        if (state.severityFilter !== 'ALL' && exc.severity !== state.severityFilter)
            return false;
        if (state.categoryFilter !== 'ALL' && getUnifiedCategory(exc) !== state.categoryFilter)
            return false;
        if (state.subCategoryFilter !== 'ALL' && getSubCategoryKey(exc) !== state.subCategoryFilter)
            return false;
        if (state.ownerFilter !== 'ALL' && exc.ownerUserId !== state.ownerFilter)
            return false;
        if (state.factoryFilter !== 'ALL' && getCaseFactoryId(exc) !== state.factoryFilter)
            return false;
        if (state.processFilter !== 'ALL') {
            const taskId = exc.relatedTaskIds[0];
            const task = taskId ? getTaskById(taskId) : undefined;
            if (!task?.processCode || task.processCode !== state.processFilter)
                return false;
        }
        if (state.aggregateFilter) {
            if (state.aggregateFilter.type === 'reason' && getSubCategoryKey(exc) !== state.aggregateFilter.value) {
                return false;
            }
            if (state.aggregateFilter.type === 'factory') {
                const hitFactory = exc.relatedTaskIds.some((taskId) => {
                    const task = getTaskById(taskId);
                    return task?.assignedFactoryId === state.aggregateFilter?.value;
                });
                if (!hitFactory)
                    return false;
            }
            if (state.aggregateFilter.type === 'process') {
                const hitProcess = exc.relatedTaskIds.some((taskId) => {
                    const task = getTaskById(taskId);
                    return task?.processCode === state.aggregateFilter?.value;
                });
                if (!hitProcess)
                    return false;
            }
        }
        return true;
    })
        .sort((a, b) => {
        const severityOrder = { S1: 0, S2: 1, S3: 2 };
        const statusOrder = {
            OPEN: 0,
            IN_PROGRESS: 1,
            RESOLVED: 2,
            CLOSED: 3,
        };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
            return severityOrder[a.severity] - severityOrder[b.severity];
        }
        const aStatus = normalizeCaseStatus(a.caseStatus);
        const bStatus = normalizeCaseStatus(b.caseStatus);
        if (statusOrder[aStatus] !== statusOrder[bStatus]) {
            return statusOrder[aStatus] - statusOrder[bStatus];
        }
        const aUpdated = new Date(a.updatedAt.replace(' ', 'T')).getTime();
        const bUpdated = new Date(b.updatedAt.replace(' ', 'T')).getTime();
        return bUpdated - aUpdated;
    });
}
export function getExceptionTotalPages(totalCount) {
    return Math.max(1, Math.ceil(totalCount / EXCEPTION_PAGE_SIZE));
}
export function clampExceptionCurrentPage(totalCount) {
    const totalPages = getExceptionTotalPages(totalCount);
    const nextPage = Math.min(Math.max(state.currentPage, 1), totalPages);
    if (state.currentPage !== nextPage) {
        state.currentPage = nextPage;
    }
    return nextPage;
}
export function getPagedCases(cases) {
    const page = clampExceptionCurrentPage(cases.length);
    const start = (page - 1) * EXCEPTION_PAGE_SIZE;
    return cases.slice(start, start + EXCEPTION_PAGE_SIZE);
}
export function getKpis(now) {
    const all = getExceptionCases();
    const today = now.toISOString().slice(0, 10);
    return {
        open: all.filter((exc) => normalizeCaseStatus(exc.caseStatus) === 'OPEN').length,
        inProgress: all.filter((exc) => normalizeCaseStatus(exc.caseStatus) === 'IN_PROGRESS').length,
        s1: all.filter((exc) => exc.severity === 'S1' && normalizeCaseStatus(exc.caseStatus) !== 'CLOSED').length,
        todayNew: all.filter((exc) => exc.createdAt.slice(0, 10) === today).length,
        todayClosed: all.filter((exc) => normalizeCaseStatus(exc.caseStatus) === 'CLOSED' && (exc.closedAt || '').slice(0, 10) === today).length,
    };
}
export function getAggregates() {
    const activeCases = getExceptionCases().filter((exc) => normalizeCaseStatus(exc.caseStatus) !== 'CLOSED');
    const reasonCounts = {};
    const factoryCounts = {};
    const processCounts = {};
    for (const exc of activeCases) {
        const subKey = getSubCategoryKey(exc);
        reasonCounts[subKey] = (reasonCounts[subKey] ?? 0) + 1;
        for (const taskId of exc.relatedTaskIds) {
            const task = getTaskById(taskId);
            if (task?.assignedFactoryId) {
                factoryCounts[task.assignedFactoryId] = (factoryCounts[task.assignedFactoryId] ?? 0) + 1;
            }
            if (task?.processCode) {
                processCounts[task.processCode] = (processCounts[task.processCode] ?? 0) + 1;
            }
        }
    }
    const topReasons = Object.entries(reasonCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    const topFactories = Object.entries(factoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    const topProcesses = Object.entries(processCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    return {
        topReasons,
        topFactories,
        topProcesses,
    };
}
export function escapeAttr(value) {
    return escapeHtml(value);
}
export function renderBadge(label, className) {
    return `<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`;
}
export function renderStatusBadge(caseStatus) {
    const uiStatus = normalizeCaseStatus(caseStatus);
    return `
    <span class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${STATUS_COLOR_CLASS[uiStatus]}">
      <i data-lucide="${STATUS_ICON[uiStatus]}" class="h-3 w-3"></i>
      ${CASE_STATUS_LABEL[uiStatus]}
    </span>
  `;
}
export { appStore, processTypes, getProcessTypeByCode, listMaterialIssueSheetsFromRuntime, getExecutionTaskFactById, productionOrders, indonesiaFactories, extendTenderDeadlineFromRuntime, getTenderByIdFromRuntime, initialNotifications, initialUrges, mockInternalUsers, generateNotificationId, generateUrgeId, listProgressExceptions, getProgressExceptionById, upsertProgressExceptionCase, syncPdaStartRiskAndExceptions, allowContinueFromPauseException, recordPauseExceptionFollowUp, syncMilestoneOverdueExceptions, buildHandoverOrderDetailLink, getProductionOrderHandoverSummary, getTaskHandoverSummary, CATEGORY_LABEL, SUB_CATEGORY_LABEL, getDefaultSubCategoryKeyFromReason, getSubCategoryOptionsByCategory, getUnifiedCategoryFromReason, inferLegacySubCategoryKey, isSubCategoryKey, appendCaseAction, appendCaseAuditLog, appendCaseStatusChangeAudit, CLOSE_REASON_LABEL, markCaseClosed, markCaseResolved, maybeAutoCloseResolvedCase, RESOLVE_RULE_LABEL, RESOLVE_SOURCE_LABEL, escapeHtml, };
