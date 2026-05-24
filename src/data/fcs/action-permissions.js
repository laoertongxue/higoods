export const ACTION_PERMISSION_DENIED_TEXT = '无操作权限';
const ACTION_ROLE_MAP = {
    CREATE_HANDOVER_RECORD: ['FACTORY', 'PLATFORM'],
    RECEIVER_WRITEBACK: ['RECEIVER', 'PLATFORM'],
    RAISE_QUANTITY_OBJECTION: ['FACTORY', 'PLATFORM'],
    ACCEPT_DIFF: ['FACTORY', 'PLATFORM'],
    REVIEW_REPLENISHMENT: ['CUTTING_LEAD', 'PLATFORM'],
    APPLY_REPLENISHMENT: ['CUTTING_LEAD', 'PLATFORM'],
    CONFIRM_PICKUP: ['CUTTING_OPERATOR', 'PLATFORM'],
    REJECT_PICKUP: ['CUTTING_OPERATOR', 'PLATFORM'],
    EXCEPTION_PICKUP: ['CUTTING_OPERATOR', 'PLATFORM'],
    CONFIGURE_FABRIC_MATERIAL: ['WAREHOUSE_OPERATOR', 'CUTTING_LEAD', 'PLATFORM'],
    REVIEW_PRINTING_TRANSFER: ['WAREHOUSE_OPERATOR', 'PLATFORM'],
    REVIEW_DYEING_TRANSFER: ['WAREHOUSE_OPERATOR', 'PLATFORM'],
};
function isRole(value) {
    return Boolean(value &&
        ['FACTORY', 'RECEIVER', 'PLATFORM', 'QC', 'CUTTING_LEAD', 'CUTTING_OPERATOR', 'WAREHOUSE_OPERATOR', 'VIEWER'].includes(value));
}
export function resolveFcsDemoRole(defaultRole = 'PLATFORM') {
    if (typeof window === 'undefined')
        return defaultRole;
    const params = new URLSearchParams(window.location.search);
    const searchRole = params.get('demoRole');
    if (isRole(searchRole))
        return searchRole;
    const attrRole = document.body?.dataset.demoRole || null;
    if (isRole(attrRole))
        return attrRole;
    return defaultRole;
}
export function canRunFcsAction(action, role) {
    return ACTION_ROLE_MAP[action]?.includes(role) ?? false;
}
export function canCreateHandoverRecord(role) {
    return canRunFcsAction('CREATE_HANDOVER_RECORD', role);
}
export function canReceiverWritebackAction(role) {
    return canRunFcsAction('RECEIVER_WRITEBACK', role);
}
export function canRaiseQuantityObjection(role) {
    return canRunFcsAction('RAISE_QUANTITY_OBJECTION', role);
}
export function canAcceptDiffAction(role) {
    return canRunFcsAction('ACCEPT_DIFF', role);
}
export function canReviewReplenishment(role) {
    return canRunFcsAction('REVIEW_REPLENISHMENT', role);
}
export function canConfigureFabricMaterial(role) {
    return canRunFcsAction('CONFIGURE_FABRIC_MATERIAL', role);
}
