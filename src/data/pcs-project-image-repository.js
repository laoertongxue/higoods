import { deleteProjectImageBlob, getProjectImageBlob, resetProjectImageBlobStore, saveProjectImageBlob, } from './pcs-project-image-blob-repository.ts';
const PROJECT_IMAGE_STORAGE_KEY = 'higood-pcs-project-image-assets-v1';
const PROJECT_IMAGE_STORE_VERSION = 1;
export const PROJECT_IMAGE_COMPAT_REF_PREFIX = 'project-image-asset:';
let memorySnapshot = null;
const runtimeUrlCache = new Map();
const pendingHydrations = new Set();
function canUseStorage() {
    return typeof localStorage !== 'undefined';
}
function notifyRenderRequested() {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function')
        return;
    window.dispatchEvent(new Event('higood:request-render'));
}
function revokeRuntimeUrl(storageKey) {
    const runtimeUrl = runtimeUrlCache.get(storageKey);
    if (!runtimeUrl)
        return;
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function' && runtimeUrl.startsWith('blob:')) {
        URL.revokeObjectURL(runtimeUrl);
    }
    runtimeUrlCache.delete(storageKey);
}
function cloneRecord(record) {
    return {
        ...record,
        usageScopes: [...record.usageScopes],
    };
}
function cloneSnapshot(snapshot) {
    return {
        version: snapshot.version,
        records: snapshot.records.map(cloneRecord),
    };
}
function createEmptySnapshot() {
    return {
        version: PROJECT_IMAGE_STORE_VERSION,
        records: [],
    };
}
function isDataImageUrl(value) {
    return /^data:image\//.test(value.trim());
}
function buildRuntimeImageUrl(blob, storageKey) {
    const cached = runtimeUrlCache.get(storageKey);
    if (cached)
        return cached;
    const runtimeUrl = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(blob)
        : `mock://project-image/${encodeURIComponent(storageKey)}`;
    runtimeUrlCache.set(storageKey, runtimeUrl);
    return runtimeUrl;
}
function decodeBase64(base64) {
    try {
        if (typeof atob === 'function') {
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index += 1) {
                bytes[index] = binary.charCodeAt(index);
            }
            return bytes;
        }
        const bufferCtor = globalThis.Buffer;
        if (bufferCtor) {
            return new Uint8Array(bufferCtor.from(base64, 'base64'));
        }
    }
    catch {
        return null;
    }
    return null;
}
function dataUrlToBlob(dataUrl) {
    const matched = dataUrl.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/);
    if (!matched)
        return null;
    const mimeType = matched[1] || 'image/png';
    const bytes = decodeBase64(matched[2]);
    if (!bytes)
        return null;
    return new Blob([bytes], { type: mimeType });
}
function normalizeRecord(record) {
    const storageType = record.storageType || (record.storageKey ? 'local-blob' : 'external-url');
    return {
        imageId: record.imageId || '',
        projectId: record.projectId || '',
        projectCode: record.projectCode || '',
        projectName: record.projectName || '',
        imageUrl: record.imageUrl || '',
        storageType,
        storageKey: storageType === 'local-blob' ? record.storageKey || '' : '',
        imageName: record.imageName || '',
        imageType: record.imageType || '项目参考图',
        sourceNodeCode: record.sourceNodeCode || '',
        sourceRecordId: record.sourceRecordId || '',
        sourceType: record.sourceType || '商品项目立项',
        usageScopes: Array.isArray(record.usageScopes) ? [...record.usageScopes] : [],
        imageStatus: record.imageStatus || '待确认',
        mainFlag: record.mainFlag === true,
        sortNo: Number.isFinite(record.sortNo) ? record.sortNo : 0,
        createdAt: record.createdAt || '',
        createdBy: record.createdBy || '',
        updatedAt: record.updatedAt || '',
        updatedBy: record.updatedBy || '',
    };
}
function queuePersistBlob(storageKey, blob) {
    if (!storageKey || !blob)
        return;
    void saveProjectImageBlob(blob, storageKey).catch(() => undefined);
}
async function hydrateLocalBlobUrl(record) {
    if (!record.storageKey || pendingHydrations.has(record.storageKey))
        return;
    pendingHydrations.add(record.storageKey);
    try {
        const blob = await getProjectImageBlob(record.storageKey);
        if (!blob)
            return;
        const runtimeUrl = buildRuntimeImageUrl(blob, record.storageKey);
        if (!memorySnapshot)
            return;
        const recordIndex = memorySnapshot.records.findIndex((item) => item.imageId === record.imageId);
        if (recordIndex < 0)
            return;
        if (memorySnapshot.records[recordIndex].imageUrl === runtimeUrl)
            return;
        memorySnapshot.records[recordIndex] = {
            ...memorySnapshot.records[recordIndex],
            imageUrl: runtimeUrl,
        };
        notifyRenderRequested();
    }
    finally {
        pendingHydrations.delete(record.storageKey);
    }
}
function prepareRecordForRuntime(record) {
    const normalized = normalizeRecord(record);
    if (normalized.storageType === 'local-blob' && normalized.storageKey) {
        const runtimeUrl = runtimeUrlCache.get(normalized.storageKey) || '';
        if (!runtimeUrl) {
            void hydrateLocalBlobUrl(normalized);
        }
        return {
            ...normalized,
            imageUrl: runtimeUrl,
        };
    }
    if (isDataImageUrl(normalized.imageUrl)) {
        const storageKey = normalized.storageKey || `${normalized.imageId || buildStableHash(normalized.imageUrl)}-blob`;
        const blob = dataUrlToBlob(normalized.imageUrl);
        const runtimeUrl = blob ? buildRuntimeImageUrl(blob, storageKey) : normalized.imageUrl;
        queuePersistBlob(storageKey, blob);
        return {
            ...normalized,
            imageUrl: runtimeUrl,
            storageType: blob ? 'local-blob' : 'external-url',
            storageKey: blob ? storageKey : '',
        };
    }
    return {
        ...normalized,
        storageType: normalized.storageType || 'external-url',
        storageKey: normalized.storageType === 'local-blob' ? normalized.storageKey : '',
    };
}
function createPersistableRecord(record) {
    const normalized = normalizeRecord(record);
    if (normalized.storageType === 'local-blob' && normalized.storageKey) {
        return {
            ...normalized,
            imageUrl: '',
        };
    }
    if (isDataImageUrl(normalized.imageUrl)) {
        const storageKey = normalized.storageKey || `${normalized.imageId || buildStableHash(normalized.imageUrl)}-blob`;
        const blob = dataUrlToBlob(normalized.imageUrl);
        queuePersistBlob(storageKey, blob);
        return {
            ...normalized,
            imageUrl: blob ? '' : normalized.imageUrl,
            storageType: blob ? 'local-blob' : 'external-url',
            storageKey: blob ? storageKey : '',
        };
    }
    return {
        ...normalized,
        storageType: 'external-url',
        storageKey: '',
    };
}
function createPersistableSnapshot(snapshot) {
    return {
        version: PROJECT_IMAGE_STORE_VERSION,
        records: Array.isArray(snapshot.records) ? snapshot.records.map(createPersistableRecord) : [],
    };
}
function hydrateSnapshot(snapshot) {
    return {
        version: PROJECT_IMAGE_STORE_VERSION,
        records: Array.isArray(snapshot.records) ? snapshot.records.map((record) => prepareRecordForRuntime(record)) : [],
    };
}
function loadSnapshot() {
    if (memorySnapshot)
        return cloneSnapshot(memorySnapshot);
    if (!canUseStorage()) {
        memorySnapshot = hydrateSnapshot(createEmptySnapshot());
        return cloneSnapshot(memorySnapshot);
    }
    try {
        const raw = localStorage.getItem(PROJECT_IMAGE_STORAGE_KEY);
        if (!raw) {
            memorySnapshot = hydrateSnapshot(createEmptySnapshot());
            localStorage.setItem(PROJECT_IMAGE_STORAGE_KEY, JSON.stringify(createPersistableSnapshot(memorySnapshot)));
            return cloneSnapshot(memorySnapshot);
        }
        const parsed = JSON.parse(raw);
        memorySnapshot = hydrateSnapshot({
            version: PROJECT_IMAGE_STORE_VERSION,
            records: Array.isArray(parsed.records) ? parsed.records : [],
        });
        localStorage.setItem(PROJECT_IMAGE_STORAGE_KEY, JSON.stringify(createPersistableSnapshot(memorySnapshot)));
        return cloneSnapshot(memorySnapshot);
    }
    catch {
        memorySnapshot = hydrateSnapshot(createEmptySnapshot());
        if (canUseStorage()) {
            localStorage.setItem(PROJECT_IMAGE_STORAGE_KEY, JSON.stringify(createPersistableSnapshot(memorySnapshot)));
        }
        return cloneSnapshot(memorySnapshot);
    }
}
function persistSnapshot(snapshot) {
    memorySnapshot = hydrateSnapshot(snapshot);
    if (canUseStorage()) {
        localStorage.setItem(PROJECT_IMAGE_STORAGE_KEY, JSON.stringify(createPersistableSnapshot(memorySnapshot)));
    }
}
function buildStableHash(text) {
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
        hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    }
    return hash.toString(36);
}
function buildProjectInitImageId(projectId, imageRef, sortNo) {
    return `${projectId}-project-init-image-${sortNo}-${buildStableHash(imageRef)}`;
}
function buildProjectImageAssetId(projectId, sourceNodeCode, imageType, imageRef, sortNo) {
    return `${projectId}-${sourceNodeCode.toLowerCase()}-${imageType}-${sortNo}-${buildStableHash(imageRef)}`.replace(/[^a-z0-9-]/gi, '-');
}
export function buildProjectImageCompatRef(record) {
    return `${PROJECT_IMAGE_COMPAT_REF_PREFIX}${record.imageId}`;
}
export function isProjectImageCompatRef(value) {
    return value.startsWith(PROJECT_IMAGE_COMPAT_REF_PREFIX);
}
export function stripProjectImageCompatRef(value) {
    return value.startsWith(PROJECT_IMAGE_COMPAT_REF_PREFIX) ? value.slice(PROJECT_IMAGE_COMPAT_REF_PREFIX.length) : value;
}
export function listProjectImageAssets(projectId) {
    const snapshot = loadSnapshot();
    return snapshot.records
        .filter((record) => !projectId || record.projectId === projectId)
        .sort((left, right) => left.sortNo - right.sortNo || left.createdAt.localeCompare(right.createdAt))
        .map(cloneRecord);
}
export function listProjectReferenceImages(projectId) {
    return listProjectImageAssets(projectId).filter((record) => record.imageType === '项目参考图');
}
export function listProjectImageAssetsBySourceNode(projectId, sourceNodeCode) {
    return listProjectImageAssets(projectId).filter((record) => record.sourceNodeCode === sourceNodeCode);
}
export function getProjectImageAssetById(imageId) {
    return listProjectImageAssets().find((record) => record.imageId === imageId) || null;
}
export function markProjectImageAssetUsableForListing(imageId, operatorName = '当前用户', timestamp = '') {
    const current = getProjectImageAssetById(imageId);
    if (!current)
        return null;
    const nextTime = timestamp || new Date().toISOString();
    const usageScopes = current.usageScopes.includes('商品上架')
        ? [...current.usageScopes]
        : [...current.usageScopes, '商品上架'];
    return updateProjectImageAsset(imageId, {
        usageScopes,
        imageStatus: '可用于上架',
        updatedAt: nextTime,
        updatedBy: operatorName,
    });
}
export function markProjectImageAssetUsableForStyleArchive(imageId, operatorName = '当前用户', timestamp = '') {
    const current = getProjectImageAssetById(imageId);
    if (!current)
        return null;
    const nextTime = timestamp || new Date().toISOString();
    const usageScopes = current.usageScopes.includes('款式档案')
        ? [...current.usageScopes]
        : [...current.usageScopes, '款式档案'];
    const dedupedScopes = Array.from(new Set(usageScopes));
    return updateProjectImageAsset(imageId, {
        usageScopes: dedupedScopes,
        imageStatus: '可用于款式档案',
        updatedAt: nextTime,
        updatedBy: operatorName,
    });
}
export function replaceProjectInitReferenceImages(project, imageUrls, operatorName = '当前用户', timestamp = '') {
    const nextTime = timestamp || new Date().toISOString();
    const snapshot = loadSnapshot();
    const currentRecords = snapshot.records.filter((record) => record.projectId === project.projectId && record.sourceNodeCode === 'PROJECT_INIT');
    const keepRecords = snapshot.records.filter((record) => !(record.projectId === project.projectId && record.sourceNodeCode === 'PROJECT_INIT'));
    const nextRecords = imageUrls
        .map((imageUrl) => imageUrl.trim())
        .filter(Boolean)
        .map((imageUrl, index) => {
        const sortNo = index + 1;
        const compatId = isProjectImageCompatRef(imageUrl) ? stripProjectImageCompatRef(imageUrl) : '';
        const stableId = compatId ||
            buildProjectInitImageId(project.projectId, imageUrl, sortNo);
        const existed = currentRecords.find((record) => record.imageId === stableId) ||
            (!compatId ? currentRecords.find((record) => record.imageUrl === imageUrl) : null);
        if (compatId && !existed) {
            return null;
        }
        const prepared = prepareRecordForRuntime(normalizeRecord({
            imageId: existed?.imageId || stableId,
            projectId: project.projectId,
            projectCode: project.projectCode,
            projectName: project.projectName,
            imageUrl: compatId ? existed?.imageUrl || '' : imageUrl,
            storageType: existed?.storageType,
            storageKey: existed?.storageKey,
            imageName: existed?.imageName || `参考图片 ${sortNo}`,
            imageType: '项目参考图',
            sourceNodeCode: 'PROJECT_INIT',
            sourceRecordId: '',
            sourceType: '商品项目立项',
            usageScopes: ['立项参考', '项目资料归档'],
            imageStatus: existed?.imageStatus || '待确认',
            mainFlag: false,
            sortNo,
            createdAt: existed?.createdAt || nextTime,
            createdBy: existed?.createdBy || operatorName,
            updatedAt: nextTime,
            updatedBy: operatorName,
        }));
        return prepared;
    })
        .filter((record) => Boolean(record));
    persistSnapshot({
        version: PROJECT_IMAGE_STORE_VERSION,
        records: [...keepRecords, ...nextRecords],
    });
    return nextRecords.map(cloneRecord);
}
export function appendProjectInitReferenceImages(project, imageUrls, operatorName = '当前用户') {
    const currentRefs = listProjectReferenceImages(project.projectId).map((record) => buildProjectImageCompatRef(record));
    const merged = [...currentRefs, ...imageUrls.map((item) => item.trim()).filter(Boolean)];
    return replaceProjectInitReferenceImages(project, merged, operatorName);
}
export function upsertProjectImageAssets(records) {
    if (records.length === 0)
        return [];
    const snapshot = loadSnapshot();
    const normalizedRecords = records.map((record) => prepareRecordForRuntime(normalizeRecord(record)));
    const recordMap = new Map(snapshot.records.map((record) => [record.imageId, record]));
    normalizedRecords.forEach((record) => {
        recordMap.set(record.imageId, record);
    });
    const nextRecords = [...recordMap.values()].sort((left, right) => left.projectId.localeCompare(right.projectId) ||
        left.sourceNodeCode.localeCompare(right.sourceNodeCode) ||
        left.sortNo - right.sortNo ||
        left.createdAt.localeCompare(right.createdAt));
    persistSnapshot({
        version: PROJECT_IMAGE_STORE_VERSION,
        records: nextRecords,
    });
    return normalizedRecords.map(cloneRecord);
}
export async function createProjectImageAssetRecordsFromFiles(project, files, buildRecord, operatorName = '当前用户', timestamp = '') {
    const nextTime = timestamp || new Date().toISOString();
    const createdRecords = await Promise.all(files.map(async (file, index) => {
        const partial = buildRecord(file, index);
        const imageId = partial.imageId ||
            buildProjectImageAssetId(project.projectId, partial.sourceNodeCode, partial.imageType, `${file.name}-${file.size}-${file.lastModified}`, partial.sortNo || index + 1);
        const storageKey = `${imageId}-blob`;
        await saveProjectImageBlob(file, storageKey);
        const runtimeUrl = buildRuntimeImageUrl(file, storageKey);
        return prepareRecordForRuntime(normalizeRecord({
            imageId,
            projectId: project.projectId,
            projectCode: project.projectCode,
            projectName: project.projectName,
            imageUrl: runtimeUrl,
            storageType: 'local-blob',
            storageKey,
            imageName: partial.imageName,
            imageType: partial.imageType,
            sourceNodeCode: partial.sourceNodeCode,
            sourceRecordId: partial.sourceRecordId,
            sourceType: partial.sourceType,
            usageScopes: partial.usageScopes,
            imageStatus: partial.imageStatus,
            mainFlag: partial.mainFlag,
            sortNo: partial.sortNo,
            createdAt: nextTime,
            createdBy: operatorName,
            updatedAt: nextTime,
            updatedBy: operatorName,
        }));
    }));
    return createdRecords.map(cloneRecord);
}
export function createProjectImageAssetRecords(project, records, operatorName = '当前用户', timestamp = '') {
    const nextTime = timestamp || new Date().toISOString();
    return records.map((record, index) => prepareRecordForRuntime(normalizeRecord({
        imageId: record.imageId ||
            buildProjectImageAssetId(project.projectId, record.sourceNodeCode, record.imageType, record.imageUrl || `${record.imageName}-${index + 1}`, record.sortNo || index + 1),
        projectId: project.projectId,
        projectCode: project.projectCode,
        projectName: project.projectName,
        imageUrl: record.imageUrl,
        storageType: record.storageType,
        storageKey: record.storageKey,
        imageName: record.imageName,
        imageType: record.imageType,
        sourceNodeCode: record.sourceNodeCode,
        sourceRecordId: record.sourceRecordId,
        sourceType: record.sourceType,
        usageScopes: record.usageScopes,
        imageStatus: record.imageStatus,
        mainFlag: record.mainFlag,
        sortNo: record.sortNo,
        createdAt: nextTime,
        createdBy: operatorName,
        updatedAt: nextTime,
        updatedBy: operatorName,
    })));
}
export function updateProjectImageAsset(imageId, patch) {
    const snapshot = loadSnapshot();
    const current = snapshot.records.find((record) => record.imageId === imageId);
    if (!current)
        return null;
    const nextRecord = prepareRecordForRuntime(normalizeRecord({
        ...current,
        ...patch,
        imageId: current.imageId,
        projectId: current.projectId,
        projectCode: current.projectCode,
        projectName: current.projectName,
    }));
    persistSnapshot({
        version: PROJECT_IMAGE_STORE_VERSION,
        records: snapshot.records.map((record) => (record.imageId === imageId ? nextRecord : record)),
    });
    return cloneRecord(nextRecord);
}
export function removeProjectImageAsset(imageId) {
    const snapshot = loadSnapshot();
    const current = snapshot.records.find((record) => record.imageId === imageId) || null;
    if (current?.storageKey) {
        revokeRuntimeUrl(current.storageKey);
        void deleteProjectImageBlob(current.storageKey).catch(() => undefined);
    }
    persistSnapshot({
        version: PROJECT_IMAGE_STORE_VERSION,
        records: snapshot.records.filter((record) => record.imageId !== imageId),
    });
}
export function resetProjectImageAssets() {
    Array.from(runtimeUrlCache.keys()).forEach((storageKey) => revokeRuntimeUrl(storageKey));
    pendingHydrations.clear();
    void resetProjectImageBlobStore().catch(() => undefined);
    persistSnapshot(createEmptySnapshot());
}
