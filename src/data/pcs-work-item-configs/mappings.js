import { getProjectPhaseNameByCode } from '../pcs-project-phase-definitions.ts';
import { listProjectWorkItemContracts, PCS_PROJECT_WORK_ITEM_LEGACY_MAPPINGS, } from '../pcs-project-domain-contract.ts';
export const STANDARD_PROJECT_WORK_ITEM_IDENTITIES = listProjectWorkItemContracts().map((item) => ({
    workItemId: item.workItemId,
    workItemTypeCode: item.workItemTypeCode,
    workItemTypeName: item.workItemTypeName,
    phaseCode: item.phaseCode,
}));
export const workItemIdMap = Object.fromEntries(STANDARD_PROJECT_WORK_ITEM_IDENTITIES.map((item) => [item.workItemId, item.workItemTypeCode]));
export const typeToIdMap = Object.fromEntries(STANDARD_PROJECT_WORK_ITEM_IDENTITIES.map((item) => [item.workItemTypeCode, item.workItemId]));
const identityById = new Map(STANDARD_PROJECT_WORK_ITEM_IDENTITIES.map((item) => [item.workItemId, item]));
const identityByCode = new Map(STANDARD_PROJECT_WORK_ITEM_IDENTITIES.map((item) => [item.workItemTypeCode, item]));
const identityByName = new Map(STANDARD_PROJECT_WORK_ITEM_IDENTITIES.map((item) => [normalizeLegacyWorkItemName(item.workItemTypeName), item]));
export const LEGACY_PROJECT_WORK_ITEM_MAPPINGS = PCS_PROJECT_WORK_ITEM_LEGACY_MAPPINGS
    .filter((item) => item.legacyName)
    .map((item) => ({
    legacyName: item.legacyName,
    legacyCode: item.legacyCode,
    workItemTypeCode: item.workItemTypeCode,
}));
const legacyMappingByName = new Map(LEGACY_PROJECT_WORK_ITEM_MAPPINGS.map((item) => [
    normalizeLegacyWorkItemName(item.legacyName),
    getStandardProjectWorkItemIdentityByCode(item.workItemTypeCode),
]));
export function normalizeLegacyWorkItemName(name) {
    return name.trim().replace(/\s+/g, '');
}
export function listStandardProjectWorkItemIdentities() {
    return STANDARD_PROJECT_WORK_ITEM_IDENTITIES.map((item) => ({ ...item }));
}
export function getStandardProjectWorkItemIdentityById(workItemId) {
    const found = identityById.get(workItemId);
    return found ? { ...found } : null;
}
export function getStandardProjectWorkItemIdentityByCode(workItemTypeCode) {
    const found = identityByCode.get(workItemTypeCode);
    return found ? { ...found } : null;
}
export function getStandardProjectWorkItemIdentityByName(workItemTypeName) {
    const found = identityByName.get(normalizeLegacyWorkItemName(workItemTypeName));
    return found ? { ...found } : null;
}
export function resolveLegacyProjectWorkItemIdentity(legacyName) {
    const normalized = normalizeLegacyWorkItemName(legacyName);
    const byName = legacyMappingByName.get(normalized);
    if (byName)
        return { ...byName };
    const byCode = PCS_PROJECT_WORK_ITEM_LEGACY_MAPPINGS.find((item) => item.legacyCode === legacyName);
    return byCode ? getStandardProjectWorkItemIdentityByCode(byCode.workItemTypeCode) : null;
}
export function resolveLegacyProjectWorkItemTypeCode(name) {
    return resolveLegacyProjectWorkItemIdentity(name)?.workItemTypeCode ?? null;
}
export function resolveLegacyProjectWorkItemId(name) {
    return resolveLegacyProjectWorkItemIdentity(name)?.workItemId ?? null;
}
export function getDefaultPhaseNameByWorkItemCode(workItemTypeCode) {
    const identity = getStandardProjectWorkItemIdentityByCode(workItemTypeCode);
    return identity ? getProjectPhaseNameByCode(identity.phaseCode) : '';
}
