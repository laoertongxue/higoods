/**
 * store-domain-quality-types.ts
 * 质量域类型定义与纯 helper — 无 React 依赖
 * 当前原型仓直接使用的质量域类型定义文件
 */
export function resolveDefaultReturnInboundQcPolicy(processType) {
    return processType === 'SEW' ? 'REQUIRED' : 'OPTIONAL';
}
export function inferReturnInboundProcessTypeFromTask(task) {
    const processCode = (task.processCode || '').toUpperCase();
    const processName = task.processNameZh || '';
    if (processCode === 'PROC_CUT' || processName.includes('裁片') || processName.includes('裁剪')) {
        return 'CUT_PANEL';
    }
    if (processCode === 'PROC_SEW' || processName.includes('车缝') || processName.includes('缝制')) {
        return 'SEW';
    }
    if (processName.includes('印花')) {
        return 'PRINT';
    }
    if (processName.includes('染印')) {
        return 'DYE_PRINT';
    }
    if (processName.includes('染色') || processName.includes('染整')) {
        return 'DYE';
    }
    return 'OTHER';
}
export function deriveDyePrintSettlementRelation(processorFactoryId, settlementPartyType, settlementPartyId) {
    if (settlementPartyType === 'GROUP_INTERNAL')
        return 'GROUP_INTERNAL';
    if (settlementPartyId === processorFactoryId)
        return 'GROUP_INTERNAL';
    if (settlementPartyType === 'OTHER')
        return 'SPECIAL';
    return 'EXTERNAL';
}
// =============================================
// Default responsibility helper
// =============================================
export function defaultResponsibility(rootCauseType, refTaskAssignedFactoryId) {
    switch (rootCauseType) {
        case 'PROCESS':
            return { responsiblePartyType: 'FACTORY', responsiblePartyId: refTaskAssignedFactoryId || 'FAC-001' };
        case 'MATERIAL':
            return { responsiblePartyType: 'SUPPLIER', responsiblePartyId: 'SUP-001' };
        case 'DYE_PRINT':
            return { responsiblePartyType: 'PROCESSOR', responsiblePartyId: 'PROC-DP-001' };
        default:
            return { responsiblePartyType: 'OTHER', responsiblePartyId: 'OTHER-001' };
    }
}
