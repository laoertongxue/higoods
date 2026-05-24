import { getProjectById } from './pcs-project-repository.ts';
import { createProjectImageAssetRecords, getProjectImageAssetById, listProjectImageAssetsBySourceNode, removeProjectImageAsset, updateProjectImageAsset, upsertProjectImageAssets, } from './pcs-project-image-repository.ts';
const SAMPLE_SHOOT_SOURCE_NODE_CODE = 'SAMPLE_SHOOT_FIT';
const SAMPLE_SHOOT_IMAGE_TYPE_MAP = {
    sampleFlatImageIds: '样衣平铺图',
    sampleTryOnImageIds: '试穿图',
    sampleDetailImageIds: '细节图',
};
function ensureUsageScopes(scopes, additions) {
    const scopeSet = new Set([...scopes, ...additions]);
    return [...scopeSet];
}
function removeUsageScopes(scopes, removals) {
    const removalSet = new Set(removals);
    return scopes.filter((scope) => !removalSet.has(scope));
}
function getCurrentSortStart(projectId) {
    return listProjectImageAssetsBySourceNode(projectId, SAMPLE_SHOOT_SOURCE_NODE_CODE).length;
}
export function listSampleShootImageAssets(projectId) {
    return listProjectImageAssetsBySourceNode(projectId, SAMPLE_SHOOT_SOURCE_NODE_CODE);
}
export function appendSampleShootImages(projectId, fieldKey, imageUrls, operatorName = '当前用户', sourceRecordId = '') {
    const project = getProjectById(projectId);
    if (!project) {
        throw new Error('未找到对应商品项目，不能上传样衣拍摄图片。');
    }
    const normalizedUrls = imageUrls.map((item) => item.trim()).filter(Boolean);
    if (normalizedUrls.length === 0)
        return [];
    const sortStart = getCurrentSortStart(project.projectId);
    const imageType = SAMPLE_SHOOT_IMAGE_TYPE_MAP[fieldKey];
    const records = createProjectImageAssetRecords(project, normalizedUrls.map((imageUrl, index) => ({
        imageUrl,
        imageName: `${imageType} ${sortStart + index + 1}`,
        imageType,
        sourceNodeCode: SAMPLE_SHOOT_SOURCE_NODE_CODE,
        sourceRecordId,
        sourceType: '样衣拍摄与试穿',
        usageScopes: ['样衣评估', '项目资料归档'],
        imageStatus: '待确认',
        mainFlag: false,
        sortNo: sortStart + index + 1,
    })), operatorName);
    return upsertProjectImageAssets(records);
}
export function updateSampleShootImageUsage(projectId, imageId, action, operatorName = '当前用户') {
    const image = getProjectImageAssetById(imageId);
    if (!image || image.projectId !== projectId || image.sourceNodeCode !== SAMPLE_SHOOT_SOURCE_NODE_CODE) {
        throw new Error('未找到对应样衣拍摄图片。');
    }
    let usageScopes = [...image.usageScopes];
    let imageStatus = image.imageStatus;
    if (action === 'listing') {
        usageScopes = ensureUsageScopes(usageScopes, ['样衣评估', '项目资料归档', '商品上架']);
        imageStatus = '可用于上架';
    }
    else if (action === 'styleArchive') {
        usageScopes = ensureUsageScopes(usageScopes, ['样衣评估', '项目资料归档', '款式档案']);
        imageStatus = '可用于款式档案';
    }
    else if (action === 'evaluateOnly') {
        usageScopes = ensureUsageScopes(removeUsageScopes(usageScopes, ['商品上架', '款式档案']), ['样衣评估', '项目资料归档']);
        imageStatus = '待确认';
    }
    else if (action === 'retake') {
        usageScopes = ensureUsageScopes(removeUsageScopes(usageScopes, ['商品上架', '款式档案']), ['样衣评估', '项目资料归档']);
        imageStatus = '需重拍';
    }
    else if (action === 'discarded') {
        usageScopes = ensureUsageScopes(removeUsageScopes(usageScopes, ['商品上架', '款式档案']), ['项目资料归档']);
        imageStatus = '已弃用';
    }
    const updated = updateProjectImageAsset(imageId, {
        usageScopes,
        imageStatus,
        updatedAt: new Date().toISOString(),
        updatedBy: operatorName,
    });
    if (!updated) {
        throw new Error('更新样衣拍摄图片用途失败。');
    }
    return updated;
}
export function removeSampleShootImage(projectId, imageId) {
    const image = getProjectImageAssetById(imageId);
    if (!image || image.projectId !== projectId || image.sourceNodeCode !== SAMPLE_SHOOT_SOURCE_NODE_CODE) {
        throw new Error('未找到待删除的样衣拍摄图片。');
    }
    removeProjectImageAsset(imageId);
}
export function listSampleShootCandidateImages(projectId, scope) {
    const expectedStatus = scope === '商品上架' ? '可用于上架' : '可用于款式档案';
    return listSampleShootImageAssets(projectId).filter((record) => record.usageScopes.includes(scope) && record.imageStatus === expectedStatus);
}
