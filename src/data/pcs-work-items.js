import { getAllWorkItemTemplates, getSelectableWorkItemTemplates, getStandardProjectWorkItemIdentityById, getWorkItemTemplateConfig, } from './pcs-work-item-configs.ts';
import { getProjectPhaseContract } from './pcs-project-domain-contract.ts';
import { getFirstSampleTaskFieldPolicySummary } from './pcs-sample-task-field-policy.ts';
import { getFirstOrderSampleTaskFieldPolicySummary } from './pcs-first-order-sample-field-policy.ts';
export const FIRST_SAMPLE_WORK_ITEM_CODE = 'FIRST_SAMPLE';
export const FIRST_ORDER_SAMPLE_WORK_ITEM_CODE = 'FIRST_ORDER_SAMPLE';
function cloneFieldGroups(groups) {
    return groups.map((group) => ({
        ...group,
        fields: group.fields.map((field) => ({ ...field })),
    }));
}
function cloneConfig(config) {
    return {
        ...config,
        roleCodes: [...config.roleCodes],
        roleNames: [...config.roleNames],
        capabilities: { ...config.capabilities },
        fieldGroups: cloneFieldGroups(config.fieldGroups),
        businessRules: [...config.businessRules],
        systemConstraints: [...config.systemConstraints],
        attachments: (config.attachments ?? []).map((item) => ({ ...item })),
        interactionNotes: [...(config.interactionNotes ?? [])],
        statusOptions: config.statusOptions?.map((item) => ({ ...item })),
        statusFlow: Array.isArray(config.statusFlow)
            ? config.statusFlow.map((item) => ({ ...item }))
            : config.statusFlow,
        rollbackRules: [...(config.rollbackRules ?? [])],
    };
}
function listBuiltinDefinitions() {
    return getAllWorkItemTemplates().map(cloneConfig);
}
function toListItem(config) {
    return {
        id: config.workItemId,
        code: config.workItemTypeCode,
        name: config.workItemTypeName,
        phaseCode: config.phaseCode,
        phaseName: config.defaultPhaseName,
        nature: config.workItemNature,
        role: config.roleNames.join(' / '),
        updatedAt: config.updatedAt,
        status: '标准内置',
        desc: config.description,
        isBuiltin: true,
        isSelectableForTemplate: config.isSelectableForTemplate,
    };
}
export function listPcsWorkItems() {
    return listBuiltinDefinitions()
        .map(toListItem)
        .sort((a, b) => {
        const phaseOrderDiff = getProjectPhaseContract(a.phaseCode).phaseOrder -
            getProjectPhaseContract(b.phaseCode).phaseOrder;
        if (phaseOrderDiff !== 0)
            return phaseOrderDiff;
        return a.id.localeCompare(b.id, undefined, { numeric: true });
    });
}
export function getPcsWorkItemById(workItemId) {
    const found = getWorkItemTemplateConfig(workItemId);
    return found ? toListItem(found) : null;
}
export function getPcsWorkItemDefinition(workItemId) {
    const builtin = getWorkItemTemplateConfig(workItemId);
    return builtin ? cloneConfig(builtin) : null;
}
export function getPcsWorkItemTemplateConfig(workItemId) {
    return getPcsWorkItemDefinition(workItemId);
}
export function listSelectableTemplateWorkItems(phaseCode) {
    return getSelectableWorkItemTemplates()
        .filter((item) => (phaseCode ? item.phaseCode === phaseCode : true))
        .sort((a, b) => a.workItemId.localeCompare(b.workItemId, undefined, { numeric: true }))
        .map(cloneConfig);
}
export function getBuiltinProjectWorkItemDefinition(workItemId) {
    const identity = getStandardProjectWorkItemIdentityById(workItemId);
    return identity ? getWorkItemTemplateConfig(identity.workItemId) : null;
}
export function getFirstSampleWorkItemFieldPolicySummary() {
    return getFirstSampleTaskFieldPolicySummary();
}
export function getFirstOrderSampleWorkItemFieldPolicySummary() {
    return getFirstOrderSampleTaskFieldPolicySummary();
}
