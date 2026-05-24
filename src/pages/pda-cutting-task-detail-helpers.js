import { buildPdaCuttingExecutionNavHref } from './pda-cutting-nav-context';
function includesAny(value, keywords) {
    if (!value)
        return false;
    return keywords.some((keyword) => value.includes(keyword));
}
function resolveRouteLabel(routeKey) {
    if (routeKey === 'spreading')
        return '按唛架方案铺布';
    if (routeKey === 'inbound')
        return '入裁片待交出仓';
    if (routeKey === 'handover')
        return '发起交出';
    return '反馈异常';
}
function hasPendingReplenishment(line) {
    return (Boolean(line.replenishmentRiskLabel) &&
        !includesAny(line.replenishmentRiskLabel, ['当前无', '无补料', '暂无补料', '无需补料']));
}
function isReceiveCompleted(status) {
    return includesAny(status, ['来料已入仓', '已回执', '已领取']);
}
function isSpreadingCompleted(status) {
    return includesAny(status, ['铺布已完成']);
}
function isHandoverCompleted(status) {
    return includesAny(status, ['已交接']);
}
function isInboundCompleted(status) {
    return includesAny(status, ['已入仓']);
}
function resolveCurrentStepLabel(stepCode) {
    if (stepCode === 'START')
        return '待开工';
    if (stepCode === 'PICKUP')
        return '交接领料';
    if (stepCode === 'SPREADING')
        return '按唛架方案铺布';
    if (stepCode === 'REPLENISHMENT')
        return '反馈异常';
    if (stepCode === 'INBOUND')
        return '入裁片待交出仓';
    if (stepCode === 'HANDOVER')
        return '发起交出';
    return '已完成';
}
function mapStepCodeToRouteKey(stepCode) {
    if (stepCode === 'START')
        return null;
    if (stepCode === 'PICKUP')
        return 'spreading';
    if (stepCode === 'SPREADING')
        return 'spreading';
    if (stepCode === 'REPLENISHMENT')
        return 'replenishment-feedback';
    if (stepCode === 'HANDOVER')
        return 'handover';
    if (stepCode === 'INBOUND')
        return 'inbound';
    return null;
}
export function resolvePdaCuttingTaskOrderCurrentStepCode(line) {
    if (line.currentStepCode)
        return line.currentStepCode;
    if (!isReceiveCompleted(line.currentReceiveStatus))
        return 'PICKUP';
    if (!isSpreadingCompleted(line.currentExecutionStatus))
        return 'SPREADING';
    if (hasPendingReplenishment(line))
        return 'REPLENISHMENT';
    if (!isInboundCompleted(line.currentInboundStatus))
        return 'INBOUND';
    if (!isHandoverCompleted(line.currentHandoverStatus))
        return 'HANDOVER';
    return 'DONE';
}
export function resolvePdaCuttingTaskOrderCurrentStepLabel(line) {
    if (line.currentStepCode)
        return resolveCurrentStepLabel(line.currentStepCode);
    if (line.currentStepLabel)
        return line.currentStepLabel;
    return resolveCurrentStepLabel(resolvePdaCuttingTaskOrderCurrentStepCode(line));
}
export function resolvePdaCuttingTaskOrderPrimaryRouteKey(line) {
    if (line.primaryExecutionRouteKey)
        return line.primaryExecutionRouteKey;
    const currentStepCode = resolvePdaCuttingTaskOrderCurrentStepCode(line);
    return mapStepCodeToRouteKey(currentStepCode) || 'handover';
}
export function resolvePdaCuttingTaskOrderPrimaryActionLabel(line) {
    return resolveRouteLabel(resolvePdaCuttingTaskOrderPrimaryRouteKey(line));
}
export function buildPdaCuttingTaskOrderActions(taskId, line, returnTo) {
    return [
        'spreading',
        'inbound',
        'handover',
        'replenishment-feedback',
    ].map((routeKey) => ({
        key: routeKey,
        label: resolveRouteLabel(routeKey),
        href: buildPdaCuttingExecutionNavHref(taskId, routeKey, {
            executionOrderId: line.executionOrderId,
            executionOrderNo: line.executionOrderNo,
            cutOrderId: line.cutOrderId,
            cutOrderNo: line.cutOrderNo,
            markerPlanId: line.markerPlanId,
            markerPlanNo: line.markerPlanNo,
            materialSku: line.materialSku,
            returnTo,
            sourcePageKey: 'cutting-task-detail',
            focusTaskId: taskId,
            focusExecutionOrderId: line.executionOrderId,
            focusExecutionOrderNo: line.executionOrderNo,
            highlightCutPieceOrder: true,
        }),
    }));
}
export function resolvePdaCuttingTaskOverviewStatusLabel(input) {
    if (!input.cutPieceOrderCount)
        return '暂无裁片单';
    if (input.exceptionCutPieceOrderCount > 0)
        return '有异常待处理';
    if (input.completedCutPieceOrderCount === input.cutPieceOrderCount)
        return '已全部完成';
    if (input.completedCutPieceOrderCount === 0)
        return '待开始';
    if (input.pendingCutPieceOrderCount > 0)
        return '处理中';
    return '待确认';
}
