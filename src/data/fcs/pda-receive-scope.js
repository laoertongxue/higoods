import { PDA_MOCK_QUOTED_TENDERS } from './pda-mobile-mock.ts';
import { canFactoryAccessSpecialCraftPdaTask } from './special-craft-pda-scope.ts';
export const PDA_RECEIVE_EXCLUDED_PROCESS_NAMES = ['印花', '染色'];
const EXCLUDED_PROCESS_CODE_KEYWORDS = ['PRINT', 'DYE'];
function normalizeValue(value) {
    return (value ?? '').trim();
}
function hasExcludedProcessName(value) {
    const normalized = normalizeValue(value);
    return PDA_RECEIVE_EXCLUDED_PROCESS_NAMES.some((name) => normalized === name || normalized.includes(name));
}
function hasExcludedProcessCode(value) {
    const normalized = normalizeValue(value).toUpperCase();
    return EXCLUDED_PROCESS_CODE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}
export function isReceiveEligibleProcessName(processName, processCode) {
    return !hasExcludedProcessName(processName) && !hasExcludedProcessCode(processCode);
}
export function isReceiveEligibleTask(task, selectedFactoryId) {
    if (!task)
        return false;
    return isReceiveEligibleProcessName(task.processNameZh, task.processCode)
        && (!selectedFactoryId || canFactoryAccessSpecialCraftPdaTask(selectedFactoryId, task));
}
export function isReceiveEligibleTender(tender, task, selectedFactoryId) {
    if (task)
        return isReceiveEligibleTask(task, selectedFactoryId);
    return isReceiveEligibleProcessName(tender.processName, tender.processCode)
        && (!selectedFactoryId || canFactoryAccessSpecialCraftPdaTask(selectedFactoryId, tender));
}
export function createInitialPdaReceiveSubmittedTenderIds() {
    return new Set(PDA_MOCK_QUOTED_TENDERS.map((item) => item.tenderId));
}
export function filterReceivePendingAcceptTasks(tasks, selectedFactoryId) {
    return tasks.filter((task) => task.assignedFactoryId === selectedFactoryId &&
        task.assignmentMode === 'DIRECT' &&
        (!task.acceptanceStatus || task.acceptanceStatus === 'PENDING') &&
        isReceiveEligibleTask(task, selectedFactoryId));
}
export function filterReceiveActiveBiddingTenders(tenders, submittedTenderIds, resolveTask, selectedFactoryId) {
    return tenders.filter((tender) => !submittedTenderIds.has(tender.tenderId) &&
        isReceiveEligibleTender(tender, tender.taskId ? resolveTask(tender.taskId) : null, selectedFactoryId));
}
export function filterReceiveQuotedTenders(tenders, submittedTenderIds, resolveTask, selectedFactoryId) {
    return tenders.filter((tender) => submittedTenderIds.has(tender.tenderId) &&
        isReceiveEligibleTender(tender, tender.taskId ? resolveTask(tender.taskId) : null, selectedFactoryId));
}
export function filterReceiveAwardedTaskFacts(tasks, selectedFactoryId) {
    return tasks.filter((task) => task.assignmentMode === 'BIDDING' &&
        task.assignmentStatus === 'AWARDED' &&
        task.assignedFactoryId === selectedFactoryId &&
        isReceiveEligibleTask(task, selectedFactoryId));
}
