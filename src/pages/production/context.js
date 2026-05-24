import { appStore } from '../../state/store';
import { escapeHtml, formatDateTime } from '../../utils';
import { renderFormDialog, renderConfirmDialog } from '../../components/ui/dialog';
import { productionDemands } from '../../data/fcs/production-demands';
import { productionOrders, productionOrderStatusConfig, assignmentProgressStatusConfig, riskFlagConfig, formatProductionOrderMainFactoryName, isProductionOrderMainFactoryPending, } from '../../data/fcs/production-orders';
import { indonesiaFactories, typesByTier, tierLabels, typeLabels, } from '../../data/fcs/indonesia-factories';
import { legalEntities } from '../../data/fcs/legal-entities';
import { cloneProductionOrderTechPackSnapshot, getDemandCurrentTechPackInfo, } from '../../data/fcs/production-tech-pack-snapshot-builder';
import { getRuntimeAssignmentSummaryByOrder, getRuntimeBiddingSummaryByOrder, getRuntimeOrderStandardTimeTotal, getRuntimeTaskById, getRuntimeTaskCountByOrder, listRuntimeExecutionTasksByOrder, listRuntimeTaskSplitGroupsByOrder, listRuntimeTasksByOrder, } from '../../data/fcs/runtime-process-tasks';
import { resolveTaskStandardTimeSnapshot, } from '../../data/fcs/process-tasks';
import { summarizeTaskDetailRows } from '../../data/fcs/task-detail-rows';
import { applyQualitySeedBootstrap, } from '../../data/fcs/store-domain-quality-bootstrap';
import { initialDeductionBasisItems, initialAllocationByTaskId, } from '../../data/fcs/store-domain-quality-seeds';
import { listLegacyLikeQualityInspectionsForTailPages, listLegacyLikeDyePrintOrdersForTailPages, } from '../../data/fcs/page-adapters/long-tail-pages-adapter';
import { initialStatementDrafts, initialSettlementBatches, initialProductionOrderChanges, } from '../../data/fcs/store-domain-settlement-seeds';
import { addMaterialToDraft, confirmMaterialRequestDraft, getMaterialDraftIndicatorsByOrder, getDraftStatusLabel, getMaterialRequestDraftById, getMaterialRequestDraftSummaryByOrder, listMaterialDraftOperationLogsByOrder, getSupplementOptionDisplayRows, getTaskTypeLabel, listMaterialRequestDraftsByOrder, restoreMaterialDraftSuggestion, setMaterialDraftLineConfirmedQty, setMaterialDraftMode, setMaterialDraftNeedMaterial, setMaterialDraftRemark, toggleMaterialDraftLine, } from '../../data/fcs/material-request-drafts';
applyQualitySeedBootstrap();
const PAGE_SIZE = 10;
const currentUser = {
    id: 'U001',
    name: 'Budi Santoso',
    role: 'ADMIN',
};
const PLAN_EMPTY_FORM = {
    planStartDate: '',
    planEndDate: '',
    planQty: '',
    planFactoryId: '',
    planFactoryName: '',
    planRemark: '',
};
const DELIVERY_EMPTY_FORM = {
    productionOrderId: '',
    deliveryWarehouseId: '',
    deliveryWarehouseName: '',
    deliveryWarehouseRemark: '',
};
const CHANGE_CREATE_EMPTY_FORM = {
    productionOrderId: '',
    changeType: '',
    beforeValue: '',
    afterValue: '',
    impactScopeZh: '',
    reason: '',
    remark: '',
};
const CHANGE_STATUS_EMPTY_FORM = {
    nextStatus: '',
    remark: '',
};
const demandStatusConfig = {
    PENDING_CONVERT: { label: '待转单', className: 'bg-blue-100 text-blue-700' },
    CONVERTED: { label: '已转单', className: 'bg-green-100 text-green-700' },
    HOLD: { label: '已挂起', className: 'bg-yellow-100 text-yellow-700' },
    CANCELLED: { label: '已取消', className: 'bg-gray-100 text-gray-600' },
};
const demandTechPackStatusConfig = {
    INCOMPLETE: { label: '待完善', className: 'bg-orange-100 text-orange-700' },
    RELEASED: { label: '已发布', className: 'bg-green-100 text-green-700' },
};
const demandPriorityConfig = {
    URGENT: { label: '紧急', className: 'bg-red-100 text-red-700' },
    HIGH: { label: '高', className: 'bg-orange-100 text-orange-700' },
    NORMAL: { label: '普通', className: 'bg-blue-100 text-blue-700' },
};
const lifecycleStatusLabel = {
    DRAFT: '草稿',
    PLANNED: '已计划',
    RELEASED: '已下发',
    IN_PRODUCTION: '生产中',
    QC_PENDING: '待质检',
    COMPLETED: '已完成',
    CLOSED: '已关闭',
};
const lifecycleStatusClass = {
    DRAFT: 'bg-slate-100 text-slate-700',
    PLANNED: 'bg-blue-100 text-blue-700',
    RELEASED: 'bg-indigo-100 text-indigo-700',
    IN_PRODUCTION: 'bg-cyan-100 text-cyan-700',
    QC_PENDING: 'bg-yellow-100 text-yellow-700',
    COMPLETED: 'bg-green-100 text-green-700',
    CLOSED: 'bg-gray-100 text-gray-600',
};
const taskStatusLabel = {
    NOT_STARTED: '未开始',
    IN_PROGRESS: '进行中',
    DONE: '已完成',
    BLOCKED: '当前生产暂停',
    CANCELLED: '已取消',
};
const taskStatusClass = {
    NOT_STARTED: 'bg-slate-100 text-slate-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    DONE: 'bg-green-100 text-green-700',
    BLOCKED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-gray-100 text-gray-600',
};
const changeTypeLabels = {
    QTY_CHANGE: '数量变更',
    DATE_CHANGE: '日期变更',
    FACTORY_CHANGE: '工厂变更',
    STYLE_CHANGE: '款式信息变更',
    OTHER: '其他',
};
const changeStatusLabels = {
    DRAFT: '草稿',
    PENDING: '待处理',
    DONE: '已完成',
    CANCELLED: '已取消',
};
const changeStatusClass = {
    DRAFT: 'bg-slate-100 text-slate-700',
    PENDING: 'bg-blue-100 text-blue-700',
    DONE: 'bg-white text-slate-700',
    CANCELLED: 'bg-red-100 text-red-700',
};
const changeAllowedNext = {
    DRAFT: ['PENDING', 'CANCELLED'],
    PENDING: ['DONE', 'CANCELLED'],
    DONE: [],
    CANCELLED: [],
};
const lifecycleAllowedNext = {
    DRAFT: ['PLANNED'],
    PLANNED: ['RELEASED'],
    RELEASED: ['IN_PRODUCTION', 'PLANNED'],
    IN_PRODUCTION: ['QC_PENDING', 'RELEASED'],
    QC_PENDING: ['COMPLETED', 'IN_PRODUCTION'],
    COMPLETED: ['CLOSED', 'QC_PENDING'],
    CLOSED: [],
};
const keyProcessKeywords = ['裁剪', '染印', '车缝', '后整', '后道'];
function cloneDemand(demand) {
    return {
        ...demand,
        marketScopes: [...demand.marketScopes],
        skuLines: demand.skuLines.map((sku) => ({ ...sku })),
    };
}
function cloneOrder(order) {
    return {
        ...order,
        mainFactorySnapshot: {
            ...order.mainFactorySnapshot,
            tags: [...order.mainFactorySnapshot.tags],
        },
        techPackSnapshot: cloneProductionOrderTechPackSnapshot(order.techPackSnapshot),
        demandSnapshot: {
            ...order.demandSnapshot,
            skuLines: order.demandSnapshot.skuLines.map((sku) => ({ ...sku })),
        },
        sourceDemandIds: [...(order.sourceDemandIds ?? [order.demandId])],
        sourceDemandSnapshots: (order.sourceDemandSnapshots ?? [order.demandSnapshot]).map((snapshot) => ({
            ...snapshot,
            skuLines: snapshot.skuLines.map((sku) => ({ ...sku })),
        })),
        assignmentSummary: { ...order.assignmentSummary },
        assignmentProgress: { ...order.assignmentProgress },
        biddingSummary: { ...order.biddingSummary },
        directDispatchSummary: { ...order.directDispatchSummary },
        taskBreakdownSummary: {
            ...order.taskBreakdownSummary,
            taskTypesTop3: [...order.taskBreakdownSummary.taskTypesTop3],
        },
        riskFlags: [...order.riskFlags],
        auditLogs: order.auditLogs.map((log) => ({ ...log })),
    };
}
function cloneChange(change) {
    return {
        ...change,
    };
}
function normalizeSeedChanges(seedChanges, orders) {
    if (orders.length === 0)
        return seedChanges.map(cloneChange);
    return seedChanges.map((change, index) => {
        const hasOrder = orders.some((order) => order.productionOrderId === change.productionOrderId);
        if (hasOrder)
            return cloneChange(change);
        const replacementOrder = orders[index % orders.length];
        return {
            ...cloneChange(change),
            productionOrderId: replacementOrder.productionOrderId,
        };
    });
}
function toTimestamp(date = new Date()) {
    return date.toISOString().replace('T', ' ').slice(0, 19);
}
let productionCoreLocalSeq = 0;
function nextLocalEntityId(prefix, width = 6) {
    productionCoreLocalSeq += 1;
    return `${prefix}-${String(productionCoreLocalSeq).padStart(width, '0')}`;
}
function nextChangeId(month, existingIds) {
    const prefix = `CHG-${month}-`;
    let max = 0;
    existingIds.forEach((id) => {
        if (!id.startsWith(prefix))
            return;
        const tail = Number(id.slice(prefix.length));
        if (Number.isFinite(tail) && tail > max)
            max = tail;
    });
    const next = max + 1;
    return `${prefix}${String(next).padStart(4, '0')}`;
}
function showPlanMessage(message, tone = 'success') {
    if (typeof document === 'undefined' || typeof window === 'undefined')
        return;
    const rootId = 'production-plan-toast-root';
    let root = document.getElementById(rootId);
    if (!root) {
        root = document.createElement('div');
        root.id = rootId;
        root.className = 'pointer-events-none fixed right-6 top-20 z-[120] flex max-w-sm flex-col gap-2';
        document.body.appendChild(root);
    }
    const toast = document.createElement('div');
    toast.className =
        tone === 'error'
            ? 'pointer-events-auto rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-md transition-all duration-200'
            : 'pointer-events-auto rounded-md border bg-background px-4 py-3 text-sm text-foreground shadow-md transition-all duration-200';
    toast.textContent = message;
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-6px)';
    root.appendChild(toast);
    window.requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });
    window.setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-6px)';
        window.setTimeout(() => {
            toast.remove();
            if (root && root.childElementCount === 0) {
                root.remove();
            }
        }, 180);
    }, 2200);
}
function includesKeyword(value, keyword) {
    return value.toLowerCase().includes(keyword);
}
function safeText(value) {
    if (!value)
        return '-';
    return value;
}
function renderBadge(text, className) {
    return `<span class="inline-flex rounded border px-2 py-0.5 text-xs ${className}">${escapeHtml(text)}</span>`;
}
function renderSplitEventList(events, limit = 3) {
    if (events.length === 0) {
        return '<p class="text-xs text-muted-foreground">暂无拆分事件</p>';
    }
    return events
        .slice(0, limit)
        .map((event) => {
        const resultText = event.resultTasks
            .map((task) => `${task.taskNo}（${task.assignedFactoryName || '-'}，${taskStatusLabel[task.status]}）`)
            .join('；');
        return `
        <div class="rounded-md border bg-muted/20 px-2.5 py-2 text-xs">
          <p>来源任务：${escapeHtml(event.sourceTaskNo)} · 拆分组：${escapeHtml(event.splitGroupId)}</p>
          <p class="mt-0.5 text-muted-foreground">结果任务：${event.resultTasks.length} 条 · 工厂：${escapeHtml(event.factorySummary)} · 状态：${escapeHtml(event.statusSummary)}</p>
          <p class="mt-0.5 text-muted-foreground">${escapeHtml(resultText || '-')}</p>
        </div>
      `;
    })
        .join('');
}
function deriveRuntimeAssignmentProgressStatus(input) {
    if (input.totalTasks === 0)
        return 'NOT_READY';
    const handledCount = input.directAssignedCount + input.biddingLaunchedCount + input.biddingAwardedCount;
    if (handledCount === 0)
        return 'PENDING';
    if (input.unassignedCount === 0 && input.directAssignedCount + input.biddingAwardedCount >= input.totalTasks) {
        return 'DONE';
    }
    return 'IN_PROGRESS';
}
function getOrderRuntimeAssignmentSnapshot(order) {
    const runtimeTaskCount = getRuntimeTaskCountByOrder(order.productionOrderId);
    if (runtimeTaskCount === 0) {
        const emptySummary = {
            totalTasks: 0,
            directCount: 0,
            biddingCount: 0,
            unassignedCount: 0,
            directAssignedCount: 0,
            biddingLaunchedCount: 0,
            biddingAwardedCount: 0,
            assignedFactoryCount: 0,
            rejectedCount: 0,
            overdueAckCount: 0,
        };
        return {
            assignmentSummary: {
                directCount: 0,
                biddingCount: 0,
                totalTasks: 0,
                unassignedCount: 0,
            },
            assignmentProgress: {
                directAssignedCount: 0,
                biddingLaunchedCount: 0,
                biddingAwardedCount: 0,
                status: deriveRuntimeAssignmentProgressStatus(emptySummary),
            },
            biddingSummary: {
                activeTenderCount: 0,
                nearestDeadline: undefined,
                overdueTenderCount: 0,
            },
            directDispatchSummary: {
                assignedFactoryCount: 0,
                rejectedCount: 0,
                overdueAckCount: 0,
            },
        };
    }
    const assignmentSummary = getRuntimeAssignmentSummaryByOrder(order.productionOrderId);
    const biddingSummary = getRuntimeBiddingSummaryByOrder(order.productionOrderId);
    const assignmentProgress = {
        directAssignedCount: assignmentSummary.directAssignedCount,
        biddingLaunchedCount: assignmentSummary.biddingLaunchedCount,
        biddingAwardedCount: assignmentSummary.biddingAwardedCount,
        status: deriveRuntimeAssignmentProgressStatus({
            totalTasks: assignmentSummary.totalTasks,
            unassignedCount: assignmentSummary.unassignedCount,
            directAssignedCount: assignmentSummary.directAssignedCount,
            biddingLaunchedCount: assignmentSummary.biddingLaunchedCount,
            biddingAwardedCount: assignmentSummary.biddingAwardedCount,
        }),
    };
    const directDispatchSummary = {
        assignedFactoryCount: assignmentSummary.assignedFactoryCount,
        rejectedCount: assignmentSummary.rejectedCount,
        overdueAckCount: assignmentSummary.overdueAckCount,
    };
    return {
        assignmentSummary: {
            directCount: assignmentSummary.directCount,
            biddingCount: assignmentSummary.biddingCount,
            totalTasks: assignmentSummary.totalTasks,
            unassignedCount: assignmentSummary.unassignedCount,
        },
        assignmentProgress,
        biddingSummary,
        directDispatchSummary,
    };
}
function getRuntimeTaskTypeLabel(task) {
    if (task.taskCategoryZh)
        return task.taskCategoryZh;
    if (task.isSpecialCraft)
        return task.craftName || task.processBusinessName || task.processNameZh;
    return task.processBusinessName || task.processNameZh;
}
function getTaskDetailRows(task) {
    if (task.scopeDetailRows && task.scopeDetailRows.length > 0)
        return task.scopeDetailRows;
    return task.detailRows ?? [];
}
function formatStandardTimeMinutes(value) {
    if (!Number.isFinite(value) || Number(value) <= 0)
        return '--';
    return `${Number(value).toLocaleString()} 分钟`;
}
function formatStandardTimePerUnit(value) {
    if (!Number.isFinite(value) || Number(value) <= 0)
        return '--';
    return Number(value).toLocaleString();
}
function getOrderStandardTimeSnapshot(order) {
    const runtimeTasks = listRuntimeExecutionTasksByOrder(order.productionOrderId)
        .sort((a, b) => {
        if (a.seq !== b.seq)
            return a.seq - b.seq;
        return (a.taskNo || a.taskId).localeCompare(b.taskNo || b.taskId);
    });
    const breakdownRows = runtimeTasks.map((task) => {
        const standardTime = resolveTaskStandardTimeSnapshot(task);
        const processLabel = task.isSpecialCraft && task.craftName
            ? `${task.processBusinessName || task.processNameZh} / ${task.craftName}`
            : task.processBusinessName || task.processNameZh || task.processCode;
        return {
            taskId: task.taskId,
            taskNo: task.taskNo || task.taskId,
            taskLabel: getRuntimeTaskTypeLabel(task),
            processLabel,
            qty: task.scopeQty || task.qty,
            detailRowCount: getTaskDetailRows(task).length,
            standardTimePerUnit: standardTime.standardTimePerUnit,
            standardTimeUnit: standardTime.standardTimeUnit,
            totalStandardTime: standardTime.totalStandardTime,
            isSplitResult: Boolean(task.isSplitResult),
        };
    });
    return {
        totalStandardTime: getRuntimeOrderStandardTimeTotal(order.productionOrderId),
        taskCount: breakdownRows.length,
        breakdownRows,
    };
}
function getOrderTaskBreakdownSnapshot(order) {
    const runtimeTasks = listRuntimeTasksByOrder(order.productionOrderId);
    const splitEvents = listRuntimeTaskSplitGroupsByOrder(order.productionOrderId);
    if (runtimeTasks.length === 0) {
        return {
            isBrokenDown: false,
            taskTypesTop3: [],
            detailRowCount: 0,
            detailRowTotalQty: 0,
            detailRowPreview: '-',
            sourceTaskCount: 0,
            splitSourceCount: 0,
            splitResultCount: 0,
            executionTaskCount: 0,
            splitGroupCount: 0,
            splitEvents: [],
            lastBreakdownAt: '-',
            lastBreakdownBy: '-',
        };
    }
    const typeCounter = new Map();
    for (const task of runtimeTasks) {
        const label = getRuntimeTaskTypeLabel(task);
        typeCounter.set(label, (typeCounter.get(label) ?? 0) + 1);
    }
    const taskTypesTop3 = [...typeCounter.entries()]
        .sort((a, b) => {
        if (b[1] !== a[1])
            return b[1] - a[1];
        return a[0].localeCompare(b[0]);
    })
        .slice(0, 3)
        .map(([label]) => label);
    const lastBreakdownAt = runtimeTasks
        .map((task) => task.updatedAt || task.createdAt)
        .sort((a, b) => b.localeCompare(a))[0] || '-';
    const lastBreakdownBy = '系统';
    const detailRowMap = new Map();
    for (const task of runtimeTasks) {
        for (const row of getTaskDetailRows(task)) {
            if (!detailRowMap.has(row.rowKey))
                detailRowMap.set(row.rowKey, row);
        }
    }
    const detailRowSummary = summarizeTaskDetailRows([...detailRowMap.values()], 2);
    const splitResultCount = runtimeTasks.filter((task) => task.isSplitResult).length;
    const splitSourceCount = runtimeTasks.filter((task) => task.isSplitSource).length;
    const executionTaskCount = runtimeTasks.filter((task) => task.executionEnabled !== false && task.isSplitSource !== true).length;
    const sourceTaskCount = runtimeTasks.filter((task) => !task.isSplitResult).length;
    return {
        isBrokenDown: true,
        taskTypesTop3,
        detailRowCount: detailRowSummary.count,
        detailRowTotalQty: detailRowSummary.totalQty,
        detailRowPreview: detailRowSummary.previewText || '-',
        sourceTaskCount,
        splitSourceCount,
        splitResultCount,
        executionTaskCount,
        splitGroupCount: splitEvents.length,
        splitEvents,
        lastBreakdownAt,
        lastBreakdownBy,
    };
}
function renderStatCard(label, value, valueClass = '') {
    return `
    <article class="rounded-lg border bg-card">
      <div class="px-4 pb-4 pt-4">
        <p class="text-xs font-medium leading-snug text-muted-foreground">${escapeHtml(label)}</p>
        <p class="mt-1 text-2xl font-bold ${valueClass}">${typeof value === 'number' ? value.toLocaleString() : escapeHtml(value)}</p>
      </div>
    </article>
  `;
}
function renderEmptyRow(colspan, text) {
    return `<tr><td colspan="${colspan}" class="h-24 px-4 text-center text-sm text-muted-foreground">${escapeHtml(text)}</td></tr>`;
}
function parseOrderSuffix(orderId) {
    const matched = /PO-202603-(\d+)/.exec(orderId);
    if (!matched)
        return 0;
    return Number(matched[1] ?? '0');
}
function nextProductionOrderId(orders) {
    let max = 0;
    for (const order of orders) {
        max = Math.max(max, parseOrderSuffix(order.productionOrderId));
    }
    return `PO-202603-${String(max + 1).padStart(4, '0')}`;
}
function toDemandTechPackStatus(status) {
    return status === 'RELEASED' ? 'RELEASED' : 'INCOMPLETE';
}
function toOrderTechPackStatus(status) {
    if (status === 'RELEASED')
        return 'RELEASED';
    return 'BETA';
}
function normalizeTechPackVersionLabel(status, versionLabel) {
    if (status === 'INCOMPLETE')
        return '待启用';
    if (!versionLabel || !versionLabel.trim())
        return '-';
    return versionLabel;
}
function getDemandTechPackDisplayMeta(input) {
    if (input.canConvertToProductionOrder) {
        return { label: '已启用', className: 'bg-green-100 text-green-700' };
    }
    if (!input.styleId) {
        return { label: '未建档', className: 'bg-red-100 text-red-700' };
    }
    if (!input.currentTechPackVersionId) {
        return { label: '未启用', className: 'bg-orange-100 text-orange-700' };
    }
    if (!input.publishedAt) {
        return { label: '未发布', className: 'bg-orange-100 text-orange-700' };
    }
    return { label: '待补齐', className: 'bg-yellow-100 text-yellow-700' };
}
function getOrderBusinessTechPackStatus(status) {
    if (status && typeof status === 'object')
        return 'RELEASED';
    if (!status)
        return 'INCOMPLETE';
    return toDemandTechPackStatus(status);
}
function deriveLifecycleStatus(order) {
    if (order.lifecycleStatus)
        return order.lifecycleStatus;
    if (order.status === 'DRAFT' || order.status === 'WAIT_TECH_PACK_RELEASE')
        return 'DRAFT';
    if (order.status === 'READY_FOR_BREAKDOWN' || order.status === 'WAIT_ASSIGNMENT')
        return 'PLANNED';
    if (order.status === 'ASSIGNING')
        return 'RELEASED';
    if (order.status === 'EXECUTING')
        return 'IN_PRODUCTION';
    if (order.status === 'COMPLETED')
        return 'COMPLETED';
    return 'CLOSED';
}
function buildSettlementSummary(statementCount, batchCount) {
    if (statementCount === 0 && batchCount === 0)
        return '无结算影响';
    if (statementCount > 0 && batchCount === 0)
        return `对账单 ${statementCount} 条`;
    if (statementCount === 0 && batchCount > 0)
        return `预付款批次 ${batchCount} 条`;
    return `对账单 ${statementCount} 条 / 预付款批次 ${batchCount} 条`;
}
function getTechPackSnapshotForDemand(demand) {
    const current = getDemandCurrentTechPackInfo(demand);
    const mappedStatus = current.canConvertToProductionOrder ? 'RELEASED' : 'INCOMPLETE';
    const display = getDemandTechPackDisplayMeta(current);
    return {
        status: mappedStatus,
        versionCode: current.currentTechPackVersionCode,
        versionLabel: current.currentTechPackVersionLabel || '',
        displayStatusLabel: display.label,
        displayStatusClassName: display.className,
        publishedAt: current.publishedAt,
        canGenerate: current.canConvertToProductionOrder &&
            !demand.hasProductionOrder &&
            demand.productionOrderId === null &&
            demand.demandStatus === 'PENDING_CONVERT',
        blockReason: current.blockReason,
        completenessScore: current.completenessScore,
    };
}
function listDemandOperationsByStatus(status) {
    if (status === 'PENDING_CONVERT')
        return ['VIEW_DETAIL', 'GENERATE', 'HOLD', 'CANCEL'];
    if (status === 'CONVERTED')
        return ['VIEW_DETAIL'];
    if (status === 'HOLD')
        return ['UNHOLD', 'CANCEL'];
    return ['VIEW_DETAIL'];
}
function getTechPackOperationLabel(status) {
    return '查看当前生效技术包';
}
function renderDemandOperations(demand, techPackStatus, options) {
    const compact = options?.compact ?? true;
    const techPackAction = options?.techPackAction ?? 'open-current-tech-pack';
    const allowGenerate = options?.allowGenerate ?? techPackStatus === 'RELEASED';
    const baseClass = compact
        ? 'rounded px-2 py-1 text-xs hover:bg-muted'
        : 'inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-muted';
    const generateClass = compact
        ? 'rounded border px-2 py-1 text-xs hover:bg-muted'
        : 'inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-muted';
    const dangerClass = compact
        ? 'rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50'
        : 'inline-flex items-center rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50';
    const ops = listDemandOperationsByStatus(demand.demandStatus);
    const demandOpButtons = ops
        .map((op) => {
        if (op === 'VIEW_DETAIL') {
            return `<button class="${baseClass}" data-prod-action="open-demand-detail" data-demand-id="${demand.demandId}">查看详情</button>`;
        }
        if (op === 'GENERATE') {
            if (!allowGenerate)
                return '';
            return `<button class="${generateClass}" data-prod-action="open-demand-single" data-demand-id="${demand.demandId}">生成</button>`;
        }
        if (op === 'HOLD') {
            return `<button class="${baseClass}" data-prod-action="hold-demand" data-demand-id="${demand.demandId}">挂起</button>`;
        }
        if (op === 'UNHOLD') {
            return `<button class="${baseClass}" data-prod-action="unhold-demand" data-demand-id="${demand.demandId}">取消挂起</button>`;
        }
        return `<button class="${dangerClass}" data-prod-action="cancel-demand" data-demand-id="${demand.demandId}">取消</button>`;
    })
        .join('');
    const techPackButton = compact
        ? `<button class="inline-flex items-center rounded px-2 py-1 text-xs hover:bg-muted" data-prod-action="${techPackAction}" data-spu-code="${escapeHtml(demand.spuCode)}">
           <i data-lucide="file-text" class="mr-1 h-4 w-4"></i>
           ${getTechPackOperationLabel(techPackStatus)}
         </button>`
        : `<button class="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-prod-action="${techPackAction}" data-spu-code="${escapeHtml(demand.spuCode)}">
           <i data-lucide="external-link" class="mr-2 h-4 w-4"></i>
           ${getTechPackOperationLabel(techPackStatus)}
         </button>`;
    return `${demandOpButtons}${techPackButton}`;
}
function getLegacyLikeDyePrintOrders() {
    return listLegacyLikeDyePrintOrdersForTailPages();
}
function getLegacyLikeQualityInspections() {
    return listLegacyLikeQualityInspectionsForTailPages();
}
function getOrderMaterialIndicators(order) {
    return getMaterialDraftIndicatorsByOrder(order.productionOrderId);
}
function getOrderDisplayBreakdownSnapshot(order) {
    const assignment = getOrderDisplayAssignmentSnapshot(order);
    const initialTaskCount = order.status === 'DRAFT' || order.status === 'WAIT_TECH_PACK_RELEASE' ? 0 : Math.max(order.assignmentSummary.totalTasks, 1);
    const lastAt = assignment.assignmentProgress.status === 'IN_PROGRESS' || assignment.assignmentProgress.status === 'DONE'
        ? order.taskBreakdownSummary.lastBreakdownAt ?? order.updatedAt ?? order.createdAt
        : order.updatedAt ?? order.createdAt;
    const lastBy = assignment.assignmentProgress.status === 'IN_PROGRESS' || assignment.assignmentProgress.status === 'DONE'
        ? order.taskBreakdownSummary.lastBreakdownBy ?? '系统'
        : order.auditLogs[order.auditLogs.length - 1]?.by ?? '系统';
    if (assignment.assignmentProgress.status === 'DONE') {
        return {
            isBrokenDown: true,
            phase: 'ASSIGNED',
            label: '已分配',
            detailText: `任务 ${Math.max(assignment.assignmentSummary.totalTasks, initialTaskCount)} / 已分配`,
            badgeClassName: 'bg-green-50 text-green-700',
            lastBreakdownAt: lastAt,
            lastBreakdownBy: lastBy,
            isPendingAssignment: false,
            hasEnteredAssignment: true,
        };
    }
    if (assignment.assignmentProgress.status === 'IN_PROGRESS') {
        return {
            isBrokenDown: true,
            phase: 'ASSIGNING',
            label: '分配中',
            detailText: `任务 ${Math.max(assignment.assignmentSummary.totalTasks, initialTaskCount)} / 分配中`,
            badgeClassName: 'bg-blue-50 text-blue-700',
            lastBreakdownAt: lastAt,
            lastBreakdownBy: lastBy,
            isPendingAssignment: false,
            hasEnteredAssignment: true,
        };
    }
    if (assignment.assignmentProgress.status === 'PENDING') {
        return {
            isBrokenDown: false,
            phase: 'WAIT_ASSIGNMENT',
            label: '待分配',
            detailText: `任务 ${Math.max(assignment.assignmentSummary.totalTasks, initialTaskCount)} / 待分配`,
            badgeClassName: 'bg-yellow-50 text-yellow-700',
            lastBreakdownAt: lastAt,
            lastBreakdownBy: lastBy,
            isPendingAssignment: true,
            hasEnteredAssignment: false,
        };
    }
    return {
        isBrokenDown: false,
        phase: 'INITIAL_TASK',
        label: initialTaskCount > 0 ? '已有任务' : '未建任务',
        detailText: initialTaskCount > 0 ? `初始任务 ${initialTaskCount}` : '尚未建任务',
        badgeClassName: initialTaskCount > 0 ? 'bg-slate-100 text-slate-700' : 'bg-gray-100 text-gray-600',
        lastBreakdownAt: lastAt,
        lastBreakdownBy: lastBy,
        isPendingAssignment: true,
        hasEnteredAssignment: false,
    };
}
function getOrderDisplayAssignmentSnapshot(order) {
    return {
        assignmentSummary: { ...order.assignmentSummary },
        assignmentProgress: { ...order.assignmentProgress },
        biddingSummary: { ...order.biddingSummary },
        directDispatchSummary: { ...order.directDispatchSummary },
    };
}
function getOrderMaterialDisplaySummary(order) {
    const breakdown = getOrderDisplayBreakdownSnapshot(order);
    const assignment = getOrderDisplayAssignmentSnapshot(order);
    const materialSummary = getMaterialRequestDraftSummaryByOrder(order.productionOrderId);
    if (breakdown.phase === 'INITIAL_TASK') {
        return {
            stage: 'NOT_READY',
            previewCount: 0,
            summaryText: '待进入分配后生成',
            badgeLabel: '待生成',
            badgeClassName: 'bg-slate-100 text-slate-700',
            hasActualDraft: false,
            hasConfirmedDraft: false,
        };
    }
    if (breakdown.phase === 'WAIT_ASSIGNMENT') {
        const previewCount = Math.max(materialSummary.totalDraftCount, order.assignmentSummary.totalTasks, 1);
        return {
            stage: 'PREVIEW',
            previewCount,
            summaryText: `预览 ${previewCount} / 待分配后确认`,
            badgeLabel: '预览草稿',
            badgeClassName: 'bg-blue-100 text-blue-700',
            hasActualDraft: false,
            hasConfirmedDraft: false,
        };
    }
    if (materialSummary.totalDraftCount === 0) {
        return {
            stage: 'ACTUAL_PENDING',
            previewCount: 0,
            summaryText: '实际分配后待生成',
            badgeLabel: '未建草稿',
            badgeClassName: 'bg-slate-100 text-slate-700',
            hasActualDraft: false,
            hasConfirmedDraft: false,
        };
    }
    if (materialSummary.createdCount === 0) {
        return {
            stage: 'ACTUAL_PENDING',
            previewCount: 0,
            summaryText: `草稿 ${materialSummary.totalDraftCount} / 待确认 ${materialSummary.pendingCount}`,
            badgeLabel: '待确认草稿',
            badgeClassName: 'bg-amber-100 text-amber-700',
            hasActualDraft: true,
            hasConfirmedDraft: false,
        };
    }
    if (materialSummary.pendingCount > 0) {
        return {
            stage: 'ACTUAL_PARTIAL',
            previewCount: 0,
            summaryText: `草稿 ${materialSummary.totalDraftCount} / 已确认 ${materialSummary.createdCount} / 待确认 ${materialSummary.pendingCount}`,
            badgeLabel: '部分确认',
            badgeClassName: 'bg-blue-100 text-blue-700',
            hasActualDraft: true,
            hasConfirmedDraft: true,
        };
    }
    return {
        stage: 'ACTUAL_CONFIRMED',
        previewCount: 0,
        summaryText: `草稿 ${materialSummary.totalDraftCount} / 已确认 ${materialSummary.createdCount}`,
        badgeLabel: '已确认草稿',
        badgeClassName: 'bg-green-100 text-green-700',
        hasActualDraft: true,
        hasConfirmedDraft: true,
    };
}
function getOrderTechPackInfo(order) {
    const current = getDemandCurrentTechPackInfo(order.demandSnapshot);
    const snapshotStatus = order.techPackSnapshot ? 'RELEASED' : 'INCOMPLETE';
    const snapshotVersionCode = order.techPackSnapshot?.sourceTechPackVersionCode || '';
    const snapshotVersion = normalizeTechPackVersionLabel(snapshotStatus, order.techPackSnapshot?.sourceTechPackVersionLabel || '');
    const hasFrozenSnapshot = Boolean(order.techPackSnapshot &&
        String(order.techPackSnapshot.sourceTechPackVersionId || '').trim() &&
        String(order.techPackSnapshot.sourcePublishedAt || '').trim());
    const snapshotReadyStatus = hasFrozenSnapshot ? '已冻结' : '缺失';
    const snapshotReadyClassName = snapshotReadyStatus === '已冻结'
        ? 'bg-green-100 text-green-700'
        : 'bg-red-100 text-red-700';
    const currentStatus = current.canConvertToProductionOrder ? 'RELEASED' : 'INCOMPLETE';
    const currentVersionCode = current.currentTechPackVersionCode;
    const currentVersion = normalizeTechPackVersionLabel(currentStatus, current.currentTechPackVersionLabel);
    const sourceTaskText = (() => {
        if (!order.techPackSnapshot)
            return '暂无来源任务链';
        const parts = [];
        if (order.techPackSnapshot.linkedRevisionTaskIds.length > 0)
            parts.push(`改版任务 ${order.techPackSnapshot.linkedRevisionTaskIds.length}`);
        if (order.techPackSnapshot.linkedPatternTaskIds.length > 0)
            parts.push(`制版任务 ${order.techPackSnapshot.linkedPatternTaskIds.length}`);
        if (order.techPackSnapshot.linkedArtworkTaskIds.length > 0)
            parts.push(`花型任务 ${order.techPackSnapshot.linkedArtworkTaskIds.length}`);
        return parts.length > 0 ? parts.join(' / ') : '暂无来源任务链';
    })();
    return {
        snapshotStatus,
        snapshotVersionCode,
        snapshotVersion,
        snapshotReadyStatus,
        snapshotReadyClassName,
        currentStatus,
        currentVersionCode,
        currentVersion,
        currentPublishedAt: current.publishedAt,
        completenessScore: order.techPackSnapshot?.completenessScore ?? 0,
        sourceTaskText,
        isOutOfSync: currentStatus !== snapshotStatus ||
            currentVersionCode !== snapshotVersionCode ||
            currentVersion !== snapshotVersion,
    };
}
function getOrderTechPackSnapshotDisplay(order) {
    const info = getOrderTechPackInfo(order);
    return {
        techPackVersionText: order.techPackSnapshot
            ? `${order.techPackSnapshot.sourceTechPackVersionCode || '-'} / ${order.techPackSnapshot.sourceTechPackVersionLabel || '-'}`
            : '暂无技术包快照',
        techPackSnapshotAt: order.techPackSnapshot?.snapshotAt || '-',
        techPackReadyStatus: info.snapshotReadyStatus,
        techPackReadyClassName: info.snapshotReadyClassName,
    };
}
function getDemandById(demandId) {
    if (!demandId)
        return null;
    return state.demands.find((demand) => demand.demandId === demandId) ?? null;
}
function getOrderById(orderId) {
    if (!orderId)
        return null;
    return state.orders.find((order) => order.productionOrderId === orderId) ?? null;
}
function getProcessTaskById(taskId) {
    return getRuntimeTaskById(taskId);
}
function getChangeById(changeId) {
    if (!changeId)
        return null;
    return state.changes.find((change) => change.changeId === changeId) ?? null;
}
function openAppRoute(pathname, key, title) {
    if (key && title) {
        appStore.openTab({
            key,
            title,
            href: pathname,
            closable: true,
        });
        return;
    }
    appStore.navigate(pathname);
}
function getDemandFactoryOptions() {
    let factories = indonesiaFactories.filter((factory) => factory.status === 'ACTIVE');
    if (state.demandTierFilter !== 'ALL') {
        factories = factories.filter((factory) => factory.tier === state.demandTierFilter);
    }
    if (state.demandTypeFilter !== 'ALL') {
        factories = factories.filter((factory) => factory.type === state.demandTypeFilter);
    }
    const keyword = state.demandFactorySearch.trim().toLowerCase();
    if (keyword) {
        factories = factories.filter((factory) => {
            return (factory.code.toLowerCase().includes(keyword) ||
                factory.name.toLowerCase().includes(keyword));
        });
    }
    const tierWeight = {
        SATELLITE: 0,
        THIRD_PARTY: 1,
        CENTRAL: 2,
    };
    factories.sort((a, b) => {
        const byTier = tierWeight[a.tier] - tierWeight[b.tier];
        if (byTier !== 0)
            return byTier;
        return a.code.localeCompare(b.code);
    });
    return factories;
}
function getAvailableDemandTypes() {
    if (state.demandTierFilter === 'ALL') {
        return Object.keys(typeLabels);
    }
    return typesByTier[state.demandTierFilter] ?? [];
}
function getFilteredDemands() {
    let result = [...state.demands];
    const keyword = state.demandKeyword.trim().toLowerCase();
    if (keyword) {
        result = result.filter((demand) => {
            return (demand.demandId.toLowerCase().includes(keyword) ||
                demand.spuCode.toLowerCase().includes(keyword) ||
                demand.spuName.toLowerCase().includes(keyword) ||
                demand.legacyOrderNo.toLowerCase().includes(keyword));
        });
    }
    if (state.demandStatusFilter !== 'ALL') {
        result = result.filter((demand) => demand.demandStatus === state.demandStatusFilter);
    }
    if (state.demandTechPackFilter !== 'ALL') {
        result = result.filter((demand) => getTechPackSnapshotForDemand(demand).status === state.demandTechPackFilter);
    }
    if (state.demandHasOrderFilter === 'YES') {
        result = result.filter((demand) => demand.hasProductionOrder);
    }
    if (state.demandHasOrderFilter === 'NO') {
        result = result.filter((demand) => !demand.hasProductionOrder);
    }
    if (state.demandPriorityFilter !== 'ALL') {
        result = result.filter((demand) => demand.priority === state.demandPriorityFilter);
    }
    if (state.demandOnlyUngenerated) {
        result = result.filter((demand) => !demand.hasProductionOrder);
    }
    return result;
}
function getBatchGeneratableDemandIds() {
    return getBatchSelectedDemandIds().filter((demandId) => {
        const demand = state.demands.find((item) => item.demandId === demandId);
        if (!demand)
            return false;
        return (demand.demandStatus === 'PENDING_CONVERT' &&
            !demand.hasProductionOrder &&
            getTechPackSnapshotForDemand(demand).canGenerate);
    });
}
function getBatchSelectedDemandIds() {
    const visibleDemandIds = new Set(getFilteredDemands().map((demand) => demand.demandId));
    return [...state.demandSelectedIds].filter((demandId) => visibleDemandIds.has(demandId));
}
function listOrdersFromDemandGeneratableDemands() {
    return state.demands.filter((demand) => {
        if (demand.demandStatus !== 'PENDING_CONVERT')
            return false;
        if (demand.hasProductionOrder)
            return false;
        if (demand.productionOrderId !== null)
            return false;
        return getTechPackSnapshotForDemand(demand).canGenerate;
    });
}
function getOrdersFromDemandSelectedIds() {
    const available = new Set(listOrdersFromDemandGeneratableDemands().map((item) => item.demandId));
    return [...state.ordersFromDemandSelectedIds].filter((demandId) => available.has(demandId));
}
function getFilteredOrders() {
    let result = [...state.orders];
    const keyword = state.ordersKeyword.trim().toLowerCase();
    if (keyword) {
        result = result.filter((order) => {
            return (order.productionOrderId.toLowerCase().includes(keyword) ||
                order.legacyOrderNo.toLowerCase().includes(keyword) ||
                order.demandSnapshot.spuCode.toLowerCase().includes(keyword) ||
                order.demandSnapshot.spuName.toLowerCase().includes(keyword) ||
                formatProductionOrderMainFactoryName(order).toLowerCase().includes(keyword));
        });
    }
    if (state.ordersStatusFilter.length > 0) {
        result = result.filter((order) => state.ordersStatusFilter.includes(order.status));
    }
    if (state.ordersBreakdownFilter !== 'ALL') {
        result = result.filter((order) => {
            const snapshot = getOrderDisplayBreakdownSnapshot(order);
            if (state.ordersBreakdownFilter === 'PENDING')
                return snapshot.isPendingAssignment;
            return snapshot.hasEnteredAssignment;
        });
    }
    if (state.ordersAssignmentProgressFilter !== 'ALL') {
        result = result.filter((order) => getOrderDisplayAssignmentSnapshot(order).assignmentProgress.status ===
            state.ordersAssignmentProgressFilter);
    }
    if (state.ordersAssignmentModeFilter !== 'ALL') {
        result = result.filter((order) => {
            const assignment = getOrderDisplayAssignmentSnapshot(order);
            const direct = assignment.assignmentSummary.directCount;
            const bidding = assignment.assignmentSummary.biddingCount;
            if (state.ordersAssignmentModeFilter === 'DIRECT_ONLY')
                return direct > 0 && bidding === 0;
            if (state.ordersAssignmentModeFilter === 'BIDDING_ONLY')
                return bidding > 0 && direct === 0;
            if (state.ordersAssignmentModeFilter === 'MIXED')
                return bidding > 0 && direct > 0;
            return true;
        });
    }
    if (state.ordersBiddingRiskFilter !== 'ALL') {
        result = result.filter((order) => {
            const assignment = getOrderDisplayAssignmentSnapshot(order);
            if (state.ordersBiddingRiskFilter === 'OVERDUE') {
                return assignment.biddingSummary.overdueTenderCount > 0;
            }
            if (state.ordersBiddingRiskFilter === 'NEAR_DEADLINE') {
                return order.riskFlags.includes('TENDER_NEAR_DEADLINE');
            }
            if (state.ordersBiddingRiskFilter === 'NONE') {
                return (assignment.biddingSummary.activeTenderCount === 0 &&
                    assignment.biddingSummary.overdueTenderCount === 0);
            }
            return true;
        });
    }
    if (state.ordersTierFilter !== 'ALL') {
        result = result.filter((order) => !isProductionOrderMainFactoryPending(order) &&
            order.mainFactorySnapshot.tier === state.ordersTierFilter);
    }
    if (state.ordersHasMaterialDraftFilter !== 'ALL') {
        result = result.filter((order) => {
            const indicators = getOrderMaterialDisplaySummary(order);
            return state.ordersHasMaterialDraftFilter === 'YES'
                ? indicators.hasActualDraft
                : !indicators.hasActualDraft;
        });
    }
    if (state.ordersHasConfirmedMaterialRequestFilter !== 'ALL') {
        result = result.filter((order) => {
            const indicators = getOrderMaterialDisplaySummary(order);
            return state.ordersHasConfirmedMaterialRequestFilter === 'YES'
                ? indicators.hasConfirmedDraft
                : !indicators.hasConfirmedDraft;
        });
    }
    if (state.ordersMaterialStageFilter !== 'ALL') {
        result = result.filter((order) => {
            const indicators = getOrderMaterialDisplaySummary(order);
            if (state.ordersMaterialStageFilter === 'PREVIEW')
                return indicators.stage === 'PREVIEW';
            if (state.ordersMaterialStageFilter === 'ACTUAL_PENDING') {
                return indicators.stage === 'ACTUAL_PENDING' || indicators.stage === 'ACTUAL_PARTIAL';
            }
            return indicators.stage === 'ACTUAL_CONFIRMED';
        });
    }
    return result;
}
function getPaginatedOrders(filteredOrders) {
    const start = (state.ordersCurrentPage - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
}
function getPlanFactoryOptions() {
    const map = new Map();
    for (const factory of indonesiaFactories) {
        map.set(factory.id, factory.name);
    }
    for (const order of state.orders) {
        if (order.planFactoryId) {
            map.set(order.planFactoryId, order.planFactoryName ?? order.planFactoryId);
        }
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
}
function getPlanWeekRange() {
    const date = new Date();
    const day = date.getDay() === 0 ? 6 : date.getDay() - 1;
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - day);
    const weekStart = date.toISOString().slice(0, 10);
    const weekEndDate = new Date(weekStart);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = weekEndDate.toISOString().slice(0, 10);
    return { weekStart, weekEnd };
}
function closeAllProductionDialogs() {
    state.demandDetailId = null;
    state.demandBatchDialogOpen = false;
    state.demandSingleGenerateId = null;
    state.demandGenerateConfirmOpen = false;
    state.ordersDemandSnapshotId = null;
    state.ordersLogsId = null;
    state.ordersFromDemandDialogOpen = false;
    state.ordersFromDemandSelectedIds = new Set();
    state.materialDraftOrderId = null;
    state.materialDraftAddDraftId = null;
    state.materialDraftAddSelections = new Set();
    state.planEditOrderId = null;
    state.deliveryEditOrderId = null;
    state.changesCreateOpen = false;
    state.changesStatusOpen = false;
    state.statusDialogOpen = false;
    state.detailLogsOpen = false;
    state.detailSimulateOpen = false;
    state.detailConfirmSimulateOpen = false;
    state.ordersActionMenuId = null;
}
const state = {
    demands: productionDemands.map(cloneDemand),
    orders: productionOrders.map(cloneOrder),
    changes: normalizeSeedChanges(initialProductionOrderChanges, productionOrders),
    demandKeyword: '',
    demandStatusFilter: 'ALL',
    demandTechPackFilter: 'ALL',
    demandHasOrderFilter: 'ALL',
    demandPriorityFilter: 'ALL',
    demandOnlyUngenerated: false,
    demandSelectedIds: new Set(),
    demandDetailId: null,
    demandBatchDialogOpen: false,
    demandSingleGenerateId: null,
    demandGenerateConfirmOpen: false,
    demandSelectedFactoryId: '',
    demandTierFilter: 'ALL',
    demandTypeFilter: 'ALL',
    demandFactorySearch: '',
    demandShowAdvanced: false,
    demandOwnerPartyManual: false,
    demandOwnerPartyType: 'FACTORY',
    demandOwnerPartyId: '',
    demandOwnerReason: '',
    ordersKeyword: '',
    ordersStatusFilter: [],
    ordersTechPackFilter: 'ALL',
    ordersBreakdownFilter: 'ALL',
    ordersAssignmentProgressFilter: 'ALL',
    ordersAssignmentModeFilter: 'ALL',
    ordersBiddingRiskFilter: 'ALL',
    ordersTierFilter: 'ALL',
    ordersHasMaterialDraftFilter: 'ALL',
    ordersHasConfirmedMaterialRequestFilter: 'ALL',
    ordersMaterialStageFilter: 'ALL',
    ordersCurrentPage: 1,
    ordersSelectedIds: new Set(),
    ordersDemandSnapshotId: null,
    ordersLogsId: null,
    ordersActionMenuId: null,
    ordersFromDemandDialogOpen: false,
    ordersFromDemandSelectedIds: new Set(),
    materialDraftOrderId: null,
    materialDraftAddDraftId: null,
    materialDraftAddSelections: new Set(),
    ordersViewMode: 'table',
    planKeyword: '',
    planStatusFilter: 'ALL',
    planFactoryFilter: 'ALL',
    planEditOrderId: null,
    planForm: { ...PLAN_EMPTY_FORM },
    deliveryKeyword: '',
    deliveryStatusFilter: 'ALL',
    deliveryEditOrderId: null,
    deliveryForm: { ...DELIVERY_EMPTY_FORM },
    changesKeyword: '',
    changesTypeFilter: 'ALL',
    changesStatusFilter: 'ALL',
    changesCreateOpen: false,
    changesCreateForm: { ...CHANGE_CREATE_EMPTY_FORM },
    changesCreateErrors: {},
    changesStatusOpen: false,
    changesStatusTarget: null,
    changesStatusForm: { ...CHANGE_STATUS_EMPTY_FORM },
    changesStatusError: '',
    statusKeyword: '',
    statusFilter: 'ALL',
    statusDialogOpen: false,
    statusSelectedOrderId: null,
    statusNext: '',
    statusRemark: '',
    detailCurrentOrderId: null,
    detailTab: 'overview',
    detailLogsOpen: false,
    detailSimulateOpen: false,
    detailSimulateStatus: 'DRAFT',
    detailConfirmSimulateOpen: false,
};
export { appStore, escapeHtml, formatDateTime, renderFormDialog, renderConfirmDialog, productionDemands, productionOrders, productionOrderStatusConfig, assignmentProgressStatusConfig, riskFlagConfig, formatProductionOrderMainFactoryName, isProductionOrderMainFactoryPending, indonesiaFactories, typesByTier, tierLabels, typeLabels, legalEntities, getRuntimeAssignmentSummaryByOrder, getRuntimeBiddingSummaryByOrder, getRuntimeOrderStandardTimeTotal, getRuntimeTaskById, getRuntimeTaskCountByOrder, listRuntimeExecutionTasksByOrder, listRuntimeTaskSplitGroupsByOrder, listRuntimeTasksByOrder, summarizeTaskDetailRows, resolveTaskStandardTimeSnapshot, initialDeductionBasisItems, initialAllocationByTaskId, initialStatementDrafts, initialSettlementBatches, initialProductionOrderChanges, addMaterialToDraft, confirmMaterialRequestDraft, getMaterialDraftIndicatorsByOrder, getDraftStatusLabel, getMaterialRequestDraftById, getMaterialRequestDraftSummaryByOrder, listMaterialDraftOperationLogsByOrder, getSupplementOptionDisplayRows, getTaskTypeLabel, listMaterialRequestDraftsByOrder, restoreMaterialDraftSuggestion, setMaterialDraftLineConfirmedQty, setMaterialDraftMode, setMaterialDraftNeedMaterial, setMaterialDraftRemark, toggleMaterialDraftLine, PAGE_SIZE, currentUser, PLAN_EMPTY_FORM, DELIVERY_EMPTY_FORM, CHANGE_CREATE_EMPTY_FORM, CHANGE_STATUS_EMPTY_FORM, demandStatusConfig, demandTechPackStatusConfig, demandPriorityConfig, lifecycleStatusLabel, lifecycleStatusClass, taskStatusLabel, taskStatusClass, changeTypeLabels, changeStatusLabels, changeStatusClass, changeAllowedNext, lifecycleAllowedNext, keyProcessKeywords, cloneDemand, cloneOrder, cloneChange, normalizeSeedChanges, toTimestamp, nextLocalEntityId, nextChangeId, showPlanMessage, includesKeyword, safeText, renderBadge, renderSplitEventList, deriveRuntimeAssignmentProgressStatus, getOrderRuntimeAssignmentSnapshot, getRuntimeTaskTypeLabel, getTaskDetailRows, getOrderTaskBreakdownSnapshot, formatStandardTimeMinutes, formatStandardTimePerUnit, getOrderStandardTimeSnapshot, renderStatCard, renderEmptyRow, parseOrderSuffix, nextProductionOrderId, toDemandTechPackStatus, toOrderTechPackStatus, normalizeTechPackVersionLabel, getOrderBusinessTechPackStatus, deriveLifecycleStatus, buildSettlementSummary, getTechPackSnapshotForDemand, listDemandOperationsByStatus, getTechPackOperationLabel, renderDemandOperations, getLegacyLikeDyePrintOrders, getLegacyLikeQualityInspections, getOrderMaterialIndicators, getOrderDisplayBreakdownSnapshot, getOrderDisplayAssignmentSnapshot, getOrderMaterialDisplaySummary, getOrderTechPackInfo, getOrderTechPackSnapshotDisplay, getDemandById, getOrderById, getProcessTaskById, getChangeById, openAppRoute, getDemandFactoryOptions, getAvailableDemandTypes, getFilteredDemands, getBatchSelectedDemandIds, getBatchGeneratableDemandIds, listOrdersFromDemandGeneratableDemands, getOrdersFromDemandSelectedIds, getFilteredOrders, getPaginatedOrders, getPlanFactoryOptions, getPlanWeekRange, closeAllProductionDialogs, state, };
