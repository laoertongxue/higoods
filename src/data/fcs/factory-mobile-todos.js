import { listPdaTaskFlowTasks } from './pda-cutting-execution-source.ts';
import { getPdaHandoutHeads, getPdaPickupHeads, listQuantityObjections } from './pda-handover-events.ts';
import { listFactoryWarehouseOutboundRecords, listFactoryWaitProcessStockItems, } from './factory-internal-warehouse.ts';
import { listSettlementStatementsByParty } from './store-domain-settlement-seeds.ts';
import { FULL_CAPABILITY_FACTORY_ID, listPostFinishingTasks, listPostFinishingWaitHandoverWarehouseRecords, } from './post-finishing-domain.ts';
import { listPostFinishingMobileExecutionTasks, } from './process-mobile-task-binding.ts';
function parseDateMs(value) {
    if (!value)
        return Number.NaN;
    const normalized = value.includes('T') ? value : value.replace(' ', 'T');
    const parsed = new Date(normalized).getTime();
    return Number.isFinite(parsed) ? parsed : Number.NaN;
}
function isSameDay(value, now = new Date()) {
    const parsed = parseDateMs(value);
    if (!Number.isFinite(parsed))
        return false;
    const current = new Date(parsed);
    return (current.getFullYear() === now.getFullYear()
        && current.getMonth() === now.getMonth()
        && current.getDate() === now.getDate());
}
function resolvePriority(dueAt, status = '待处理') {
    if (status === '处理中')
        return '加急';
    const diff = parseDateMs(dueAt) - Date.now();
    if (Number.isFinite(diff) && diff <= 12 * 3600 * 1000)
        return '紧急';
    if (Number.isFinite(diff) && diff <= 24 * 3600 * 1000)
        return '加急';
    return '普通';
}
function resolveTodoStatus(task) {
    if (task.status === 'DONE')
        return '已处理';
    if (task.status === 'BLOCKED')
        return '处理中';
    return '待处理';
}
function buildTaskReceiveTodos(factoryId) {
    return listPdaTaskFlowTasks()
        .filter((task) => task.assignedFactoryId === factoryId
        && (!task.acceptanceStatus || task.acceptanceStatus === 'PENDING')
        && task.assignmentMode === 'DIRECT')
        .map((task, index) => ({
        todoId: `todo-accept-${task.taskId}`,
        todoNo: `TD-AC-${String(index + 1).padStart(3, '0')}`,
        todoType: '待接单',
        todoTitle: `${task.processNameZh || '工序'}待接单`,
        todoSubtitle: `${task.productionOrderNo || task.productionOrderId} · ${task.taskNo || task.taskId}`,
        factoryId,
        factoryName: task.assignedFactoryName || task.assignedFactoryId || factoryId,
        relatedTaskId: task.taskId,
        relatedTaskNo: task.taskNo || task.taskId,
        priority: resolvePriority(task.acceptDeadline),
        status: '待处理',
        dueAt: task.acceptDeadline,
        createdAt: task.dispatchedAt || task.createdAt || task.acceptDeadline || '',
        detailRoute: `/fcs/pda/notify/todo-accept-${task.taskId}`,
        actionLabel: '去处理',
    }));
}
function buildPostFinishingTaskReceiveTodos(factoryId) {
    return listPostFinishingTasks()
        .filter((task) => task.managedPostFactoryId === factoryId && task.acceptanceStatus === 'PENDING')
        .map((task, index) => ({
        todoId: `todo-post-accept-${task.postTaskId}`,
        todoNo: `TD-PA-${String(index + 1).padStart(3, '0')}`,
        todoType: '待接单',
        todoTitle: `后道任务待接单`,
        todoSubtitle: `${task.productionOrderNo} · ${task.postTaskNo} · ${task.spuName}`,
        factoryId,
        factoryName: task.managedPostFactoryName,
        relatedTaskId: task.postTaskId,
        relatedTaskNo: task.postTaskNo,
        priority: resolvePriority(task.createdAt),
        status: '待处理',
        dueAt: task.createdAt,
        createdAt: task.createdAt,
        detailRoute: `/fcs/pda/notify/todo-post-accept-${task.postTaskId}`,
        actionLabel: '去处理',
    }));
}
function buildExecTodos(factoryId) {
    const acceptedTasks = listPdaTaskFlowTasks().filter((task) => task.assignedFactoryId === factoryId && task.acceptanceStatus === 'ACCEPTED');
    const pendingStart = acceptedTasks
        .filter((task) => task.status === 'NOT_STARTED')
        .map((task, index) => ({
        todoId: `todo-start-${task.taskId}`,
        todoNo: `TD-ST-${String(index + 1).padStart(3, '0')}`,
        todoType: '待开工',
        todoTitle: `${task.processNameZh || '工序'}待开工`,
        todoSubtitle: `${task.productionOrderNo || task.productionOrderId} · ${task.taskNo || task.taskId}`,
        factoryId,
        factoryName: task.assignedFactoryName || task.assignedFactoryId || factoryId,
        relatedTaskId: task.taskId,
        relatedTaskNo: task.taskNo || task.taskId,
        priority: resolvePriority(task.taskDeadline),
        status: resolveTodoStatus(task),
        dueAt: task.taskDeadline,
        createdAt: task.acceptedAt || task.createdAt || task.taskDeadline || '',
        detailRoute: `/fcs/pda/notify/todo-start-${task.taskId}`,
        actionLabel: '去处理',
    }));
    const pendingFinish = acceptedTasks
        .filter((task) => task.status === 'IN_PROGRESS')
        .map((task, index) => ({
        todoId: `todo-finish-${task.taskId}`,
        todoNo: `TD-FN-${String(index + 1).padStart(3, '0')}`,
        todoType: '待完工',
        todoTitle: `${task.processNameZh || '工序'}待完工`,
        todoSubtitle: `${task.productionOrderNo || task.productionOrderId} · ${task.taskNo || task.taskId}`,
        factoryId,
        factoryName: task.assignedFactoryName || task.assignedFactoryId || factoryId,
        relatedTaskId: task.taskId,
        relatedTaskNo: task.taskNo || task.taskId,
        priority: resolvePriority(task.taskDeadline, '处理中'),
        status: '处理中',
        dueAt: task.taskDeadline,
        createdAt: task.startedAt || task.acceptedAt || task.taskDeadline || '',
        detailRoute: `/fcs/pda/notify/todo-finish-${task.taskId}`,
        actionLabel: '去处理',
    }));
    const blocked = acceptedTasks
        .filter((task) => task.status === 'BLOCKED')
        .map((task, index) => ({
        todoId: `todo-exception-${task.taskId}`,
        todoNo: `TD-EX-${String(index + 1).padStart(3, '0')}`,
        todoType: '异常待处理',
        todoTitle: `${task.processNameZh || '工序'}异常待处理`,
        todoSubtitle: `${task.productionOrderNo || task.productionOrderId} · ${task.blockReason || '待确认原因'}`,
        factoryId,
        factoryName: task.assignedFactoryName || task.assignedFactoryId || factoryId,
        relatedTaskId: task.taskId,
        relatedTaskNo: task.taskNo || task.taskId,
        priority: '紧急',
        status: '处理中',
        dueAt: task.taskDeadline,
        createdAt: task.blockedAt || task.updatedAt || task.taskDeadline || '',
        detailRoute: `/fcs/pda/notify/todo-exception-${task.taskId}`,
        actionLabel: '去处理',
    }));
    return [...pendingStart, ...pendingFinish, ...blocked];
}
function buildPostFinishingExecTodos(factoryId) {
    const tasks = listPostFinishingMobileExecutionTasks().filter((task) => task.assignedFactoryId === factoryId
        && task.acceptanceStatus === 'ACCEPTED');
    return tasks
        .filter((task) => task.status !== 'DONE')
        .map((task, index) => {
        const status = task.status === 'BLOCKED' ? '处理中' : task.status === 'IN_PROGRESS' ? '处理中' : '待处理';
        const todoType = task.status === 'BLOCKED'
            ? '异常待处理'
            : task.status === 'IN_PROGRESS'
                ? '待完工'
                : '待开工';
        return {
            todoId: `todo-post-exec-${task.taskId}`,
            todoNo: `TD-PE-${String(index + 1).padStart(3, '0')}`,
            todoType,
            todoTitle: `后道任务${todoType}`,
            todoSubtitle: `${task.productionOrderId} · ${task.taskNo || task.taskId}`,
            factoryId,
            factoryName: task.assignedFactoryName || factoryId,
            relatedTaskId: task.taskId,
            relatedTaskNo: task.taskNo || task.taskId,
            priority: task.status === 'BLOCKED' ? '紧急' : resolvePriority(task.taskDeadline, status),
            status,
            dueAt: task.taskDeadline || task.updatedAt || task.createdAt,
            createdAt: task.startedAt || task.acceptedAt || task.createdAt || '',
            detailRoute: `/fcs/pda/notify/todo-post-exec-${task.taskId}`,
            actionLabel: '去处理',
        };
    });
}
function buildPickupTodos(factoryId) {
    return getPdaPickupHeads(factoryId).map((head, index) => ({
        todoId: `todo-pickup-${head.handoverId}`,
        todoNo: `TD-PU-${String(index + 1).padStart(3, '0')}`,
        todoType: '待领料',
        todoTitle: `${head.processName}待领料`,
        todoSubtitle: `${head.productionOrderNo || head.productionOrderId} · ${head.objectSummary}`,
        factoryId,
        factoryName: head.factoryName || factoryId,
        relatedTaskId: head.taskId,
        relatedTaskNo: head.taskNo,
        relatedHandoverOrderId: head.handoverId,
        priority: resolvePriority(head.deadlineAt),
        status: '待处理',
        dueAt: head.deadlineAt,
        createdAt: head.createdAt,
        detailRoute: `/fcs/pda/notify/todo-pickup-${head.handoverId}`,
        actionLabel: '确认',
    }));
}
function buildPostFinishingPickupTodos(factoryId) {
    return getPdaPickupHeads(factoryId)
        .filter((head) => head.processBusinessCode === 'POST_FINISHING')
        .map((head, index) => ({
        todoId: `todo-post-pickup-${head.handoverId}`,
        todoNo: `TD-PP-${String(index + 1).padStart(3, '0')}`,
        todoType: '待领料',
        todoTitle: `后道待接收上游交出`,
        todoSubtitle: `${head.productionOrderNo || '-'} · ${head.sourceDocNo || head.objectSummary || head.scopeLabel || ''}`,
        factoryId,
        factoryName: head.factoryName || head.targetName || factoryId,
        relatedTaskId: head.taskId,
        relatedTaskNo: head.taskNo,
        relatedHandoverOrderId: head.handoverId,
        priority: resolvePriority(head.deadlineAt || head.lastRecordAt || head.completedByWarehouseAt),
        status: '待处理',
        dueAt: head.deadlineAt || head.lastRecordAt || head.completedByWarehouseAt,
        createdAt: head.lastRecordAt || head.completedByWarehouseAt || '',
        detailRoute: `/fcs/pda/notify/todo-post-pickup-${head.handoverId}`,
        actionLabel: '确认',
    }));
}
function buildHandoutTodos(factoryId) {
    return getPdaHandoutHeads(factoryId).map((head, index) => ({
        todoId: `todo-handout-${head.handoverId}`,
        todoNo: `TD-HO-${String(index + 1).padStart(3, '0')}`,
        todoType: '待交出',
        todoTitle: `${head.processName}待交出`,
        todoSubtitle: `${head.productionOrderNo || head.productionOrderId} · ${head.objectSummary}`,
        factoryId,
        factoryName: head.factoryName || factoryId,
        relatedTaskId: head.taskId,
        relatedTaskNo: head.taskNo,
        relatedHandoverOrderId: head.handoverId,
        priority: resolvePriority(head.deadlineAt, '处理中'),
        status: '处理中',
        dueAt: head.deadlineAt,
        createdAt: head.createdAt,
        detailRoute: `/fcs/pda/notify/todo-handout-${head.handoverId}`,
        actionLabel: '去处理',
    }));
}
function buildPostFinishingHandoutTodos(factoryId) {
    return getPdaHandoutHeads(factoryId)
        .filter((head) => head.processBusinessCode === 'POST_FINISHING')
        .map((head, index) => ({
        todoId: `todo-post-handout-${head.handoverId}`,
        todoNo: `TD-PH-${String(index + 1).padStart(3, '0')}`,
        todoType: '待交出',
        todoTitle: `后道待交出`,
        todoSubtitle: `${head.productionOrderNo || '-'} · ${head.sourceDocNo || head.scopeLabel || head.objectSummary || ''}`,
        factoryId,
        factoryName: head.factoryName || head.sourceFactoryName || factoryId,
        relatedTaskId: head.taskId,
        relatedTaskNo: head.taskNo,
        relatedHandoverOrderId: head.handoverId,
        priority: resolvePriority(head.deadlineAt || head.lastRecordAt, '处理中'),
        status: '处理中',
        dueAt: head.deadlineAt || head.lastRecordAt,
        createdAt: head.lastRecordAt || '',
        detailRoute: `/fcs/pda/notify/todo-post-handout-${head.handoverId}`,
        actionLabel: '去处理',
    }));
}
function buildDifferenceTodos(factoryId) {
    const processDiffs = listFactoryWaitProcessStockItems()
        .filter((item) => item.factoryId === factoryId && item.status === '差异待处理')
        .map((item, index) => ({
        todoId: `todo-inbound-diff-${item.stockItemId}`,
        todoNo: `TD-ID-${String(index + 1).padStart(3, '0')}`,
        todoType: '差异待处理',
        todoTitle: `${item.warehouseName}差异待处理`,
        todoSubtitle: `${item.sourceRecordNo} · ${item.itemName} · 差异 ${item.differenceQty}`,
        factoryId,
        factoryName: item.factoryName,
        relatedTaskId: item.taskId,
        relatedTaskNo: item.taskNo,
        priority: '紧急',
        status: '处理中',
        dueAt: item.receivedAt,
        createdAt: item.receivedAt,
        detailRoute: `/fcs/pda/notify/todo-inbound-diff-${item.stockItemId}`,
        actionLabel: '去处理',
        relatedInboundRecordId: item.sourceRecordId,
    }));
    const outboundDiffs = listFactoryWarehouseOutboundRecords()
        .filter((item) => item.factoryId === factoryId && (item.status === '差异' || item.status === '异议中'))
        .map((item, index) => ({
        todoId: `todo-outbound-diff-${item.outboundRecordId}`,
        todoNo: `TD-OD-${String(index + 1).padStart(3, '0')}`,
        todoType: '差异待处理',
        todoTitle: `${item.warehouseName}${item.status === '异议中' ? '异议处理中' : '差异待处理'}`,
        todoSubtitle: `${item.handoverRecordNo || item.handoverOrderNo} · 差异 ${item.differenceQty ?? 0}`,
        factoryId,
        factoryName: item.factoryName,
        relatedTaskId: item.sourceTaskId,
        relatedTaskNo: item.sourceTaskNo,
        relatedHandoverOrderId: item.handoverOrderId,
        relatedHandoverRecordId: item.handoverRecordId,
        relatedOutboundRecordId: item.outboundRecordId,
        priority: '紧急',
        status: '处理中',
        dueAt: item.outboundAt,
        createdAt: item.outboundAt,
        detailRoute: `/fcs/pda/notify/todo-outbound-diff-${item.outboundRecordId}`,
        actionLabel: '去处理',
    }));
    const objections = listQuantityObjections()
        .filter((item) => item.factoryId === factoryId && item.status !== 'OBJECTION_RESOLVED')
        .map((item, index) => ({
        todoId: `todo-objection-${item.objectionId}`,
        todoNo: `TD-OB-${String(index + 1).padStart(3, '0')}`,
        todoType: '差异待处理',
        todoTitle: `数量异议待处理`,
        todoSubtitle: `${item.objectionNo} · 差异 ${item.diffQty}${item.qtyUnit}`,
        factoryId,
        factoryName: item.factoryName,
        relatedTaskId: item.sourceTaskId,
        relatedHandoverOrderId: item.handoverOrderId,
        relatedHandoverRecordId: item.handoverRecordId,
        priority: '紧急',
        status: item.status === 'SUBMITTED' ? '待处理' : '处理中',
        dueAt: item.raisedAt,
        createdAt: item.raisedAt,
        detailRoute: `/fcs/pda/notify/todo-objection-${item.objectionId}`,
        actionLabel: '去处理',
    }));
    return [...processDiffs, ...outboundDiffs, ...objections];
}
function buildPostFinishingDifferenceTodos(factoryId) {
    return listPostFinishingWaitHandoverWarehouseRecords()
        .filter((record) => record.diffGarmentQty !== 0)
        .map((record, index) => ({
        todoId: `todo-post-diff-${record.warehouseRecordId}`,
        todoNo: `TD-PD-${String(index + 1).padStart(3, '0')}`,
        todoType: '差异待处理',
        todoTitle: `后道交出差异待处理`,
        todoSubtitle: `${record.sourceProductionOrderNo} · ${record.recheckOrderNo} · 差异 ${record.diffGarmentQty}${record.qtyUnit}`,
        factoryId,
        factoryName: record.managedPostFactoryName,
        relatedTaskId: record.postOrderId,
        relatedTaskNo: record.postOrderNo,
        relatedHandoverRecordId: record.handoverRecordId,
        relatedOutboundRecordId: record.warehouseRecordId,
        priority: '紧急',
        status: '处理中',
        dueAt: record.updatedAt,
        createdAt: record.updatedAt,
        detailRoute: `/fcs/pda/notify/todo-post-diff-${record.warehouseRecordId}`,
        actionLabel: '去处理',
    }));
}
function buildSettlementTodos(factoryId) {
    return listSettlementStatementsByParty(factoryId)
        .filter((statement) => statement.status === 'PENDING_FACTORY_CONFIRM' || statement.factoryFeedbackStatus === 'PENDING_FACTORY_CONFIRM')
        .map((statement, index) => ({
        todoId: `todo-settlement-${statement.statementId}`,
        todoNo: `TD-STL-${String(index + 1).padStart(3, '0')}`,
        todoType: '对账待确认',
        todoTitle: `${statement.settlementCycleLabel || statement.statementNo || statement.statementId}待确认`,
        todoSubtitle: `${statement.statementNo || statement.statementId} · 应付 ${statement.netPayableAmount ?? statement.totalAmount}`,
        factoryId,
        factoryName: statement.factoryName || factoryId,
        relatedSettlementId: statement.statementId,
        priority: '加急',
        status: '待处理',
        dueAt: statement.sentToFactoryAt || statement.createdAt,
        createdAt: statement.createdAt,
        detailRoute: `/fcs/pda/notify/todo-settlement-${statement.statementId}`,
        actionLabel: '确认',
    }));
}
function compareTodo(a, b) {
    const priorityRank = {
        紧急: 3,
        加急: 2,
        普通: 1,
    };
    const aPriority = priorityRank[a.priority] || 0;
    const bPriority = priorityRank[b.priority] || 0;
    if (aPriority !== bPriority)
        return bPriority - aPriority;
    return parseDateMs(a.dueAt || a.createdAt) - parseDateMs(b.dueAt || b.createdAt);
}
export function getFactoryMobileTodoActionRoute(todo) {
    switch (todo.todoType) {
        case '待接单':
            return todo.relatedTaskId ? `/fcs/pda/task-receive/${todo.relatedTaskId}` : '/fcs/pda/task-receive';
        case '待领料':
        case '待交出':
            return todo.relatedHandoverOrderId ? `/fcs/pda/handover/${todo.relatedHandoverOrderId}` : '/fcs/pda/handover';
        case '待开工':
        case '待完工':
        case '异常待处理':
            return todo.relatedTaskId ? `/fcs/pda/exec/${todo.relatedTaskId}` : '/fcs/pda/exec';
        case '差异待处理':
            if (todo.relatedOutboundRecordId)
                return '/fcs/pda/warehouse/outbound-records';
            if (todo.relatedInboundRecordId)
                return '/fcs/pda/warehouse/inbound-records';
            return '/fcs/pda/handover';
        case '对账待确认':
            return '/fcs/pda/settlement';
        default:
            return '/fcs/pda/task-receive';
    }
}
export function getFactoryMobileTodos(factoryId) {
    if (factoryId === FULL_CAPABILITY_FACTORY_ID) {
        return [
            ...buildPostFinishingTaskReceiveTodos(factoryId),
            ...buildPostFinishingPickupTodos(factoryId),
            ...buildPostFinishingExecTodos(factoryId),
            ...buildPostFinishingHandoutTodos(factoryId),
            ...buildPostFinishingDifferenceTodos(factoryId),
            ...buildSettlementTodos(factoryId),
        ]
            .sort(compareTodo);
    }
    return [
        ...buildTaskReceiveTodos(factoryId),
        ...buildPickupTodos(factoryId),
        ...buildExecTodos(factoryId),
        ...buildHandoutTodos(factoryId),
        ...buildDifferenceTodos(factoryId),
        ...buildSettlementTodos(factoryId),
    ]
        .sort(compareTodo);
}
export function getFactoryMobileTodoCount(factoryId) {
    return getFactoryMobileTodos(factoryId).filter((item) => item.status === '待处理' || item.status === '处理中').length;
}
export function getFactoryMobileTodoById(todoId) {
    const allTodos = Array.from(new Set([
        FULL_CAPABILITY_FACTORY_ID,
        ...listPdaTaskFlowTasks()
            .map((task) => task.assignedFactoryId)
            .filter((factoryId) => Boolean(factoryId)),
    ])).flatMap((factoryId) => getFactoryMobileTodos(factoryId));
    return allTodos.find((item) => item.todoId === todoId) ?? null;
}
export function getFactoryMobileTodoSummary(factoryId) {
    const todos = getFactoryMobileTodos(factoryId);
    return {
        total: todos.filter((item) => item.status === '待处理' || item.status === '处理中').length,
        urgent: todos.filter((item) => item.priority === '紧急').length,
        dueToday: todos.filter((item) => isSameDay(item.dueAt)).length,
        difference: todos.filter((item) => item.todoType === '差异待处理').length,
        settlement: todos.filter((item) => item.todoType === '对账待确认').length,
    };
}
