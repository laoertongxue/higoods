import { listConfigDimensionOptions } from './pcs-config-workspace-repository.ts';
import { getProjectConfigSourceMapping, listProjectConfigSourceMappings, } from './pcs-project-domain-contract.ts';
function toWorkspaceOption(option) {
    return {
        id: option.id,
        code: option.code,
        name: option.name_zh,
    };
}
function listEnabledDimensionOptions(dimensionId) {
    return listConfigDimensionOptions(dimensionId)
        .filter((item) => item.status === 'ENABLED')
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(toWorkspaceOption);
}
export function listProjectWorkspaceBrands() {
    return listEnabledDimensionOptions('brands');
}
export function listProjectWorkspaceCategories() {
    return listEnabledDimensionOptions('categories');
}
export function listProjectWorkspaceColors() {
    return listEnabledDimensionOptions('colors');
}
export function listProjectWorkspaceSizes() {
    return listEnabledDimensionOptions('sizes');
}
export function listProjectWorkspaceStyles() {
    return listEnabledDimensionOptions('styles');
}
export function listProjectWorkspaceStyleCodes() {
    return listEnabledDimensionOptions('styleCodes');
}
export function listProjectWorkspaceTrendElements() {
    return listEnabledDimensionOptions('trendElements');
}
export function listProjectWorkspaceFabrics() {
    return listEnabledDimensionOptions('fabrics');
}
export function listProjectWorkspaceSpecialCrafts() {
    return listEnabledDimensionOptions('specialCrafts');
}
export function listProjectWorkspaceCrowdPositioning() {
    return listEnabledDimensionOptions('crowdPositioning');
}
export function listProjectWorkspaceAges() {
    return listEnabledDimensionOptions('ages');
}
export function listProjectWorkspaceCrowds() {
    return listEnabledDimensionOptions('crowds');
}
export function listProjectWorkspaceProductPositioning() {
    return listEnabledDimensionOptions('productPositioning');
}
export function buildProjectWorkspaceCategoryOptions() {
    return listProjectWorkspaceCategories().map((item) => ({
        id: item.id,
        name: item.name,
        children: [],
    }));
}
export function findProjectWorkspaceOptionById(dimensionId, optionId) {
    return listEnabledDimensionOptions(dimensionId).find((item) => item.id === optionId) ?? null;
}
export function listProjectWorkspaceSourceMappings() {
    return listProjectConfigSourceMappings();
}
export function getProjectWorkspaceSourceMapping(fieldKey) {
    return getProjectConfigSourceMapping(fieldKey);
}
export function getProjectWorkspaceSourceHintText(fieldKey) {
    const mapping = getProjectWorkspaceSourceMapping(fieldKey);
    if (!mapping)
        return '当前来源：未定义';
    const prefix = mapping.sourceKind === '配置工作台' ? '数据来源' : '当前来源';
    return `${prefix}：${mapping.sourceKind} / ${mapping.sourceRef}`;
}
export function listProjectWorkspaceSourceSummaries(fieldKeys) {
    const items = fieldKeys
        ? listProjectWorkspaceSourceMappings().filter((item) => fieldKeys.includes(item.fieldKey))
        : listProjectWorkspaceSourceMappings();
    const bucket = new Map();
    items.forEach((item) => {
        const current = bucket.get(item.sourceKind) ??
            {
                sourceKind: item.sourceKind,
                fieldCount: 0,
                fieldKeys: [],
                fieldLabels: [],
            };
        current.fieldCount += 1;
        current.fieldKeys.push(item.fieldKey);
        current.fieldLabels.push(item.fieldLabel);
        bucket.set(item.sourceKind, current);
    });
    return Array.from(bucket.values()).sort((a, b) => b.fieldCount - a.fieldCount || a.sourceKind.localeCompare(b.sourceKind));
}
export function getProjectWorkspaceCategoryCompatibilityNote() {
    return '当前配置工作台仅提供一级品类维度，兼容二级分类字段保留为空，不做必填，不新增硬编码。';
}
