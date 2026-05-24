import { createStyleArchiveBootstrapSnapshot } from './pcs-style-archive-bootstrap.ts';
import { buildStyleFixture } from './pcs-product-archive-fixtures.ts';
import { normalizeStyleTechPackStatusText } from './pcs-product-lifecycle-governance.ts';
import { getProjectNodeRecordByWorkItemTypeCode } from './pcs-project-repository.ts';
const STYLE_ARCHIVE_STORAGE_KEY = 'higood-pcs-style-archive-store-v2';
const STYLE_ARCHIVE_STORE_VERSION = 2;
let memorySnapshot = null;
function canUseStorage() {
    return (typeof localStorage !== 'undefined' &&
        typeof localStorage.getItem === 'function' &&
        typeof localStorage.setItem === 'function' &&
        typeof localStorage.removeItem === 'function');
}
function cloneRecord(record) {
    return {
        ...record,
        seasonTags: Array.isArray(record.seasonTags) ? [...record.seasonTags] : [],
        styleTags: Array.isArray(record.styleTags) ? [...record.styleTags] : [],
        targetAudienceTags: Array.isArray(record.targetAudienceTags) ? [...record.targetAudienceTags] : [],
        targetChannelCodes: Array.isArray(record.targetChannelCodes) ? [...record.targetChannelCodes] : [],
        galleryImageIds: Array.isArray(record.galleryImageIds) ? [...record.galleryImageIds] : [],
        galleryImageUrls: Array.isArray(record.galleryImageUrls) ? [...record.galleryImageUrls] : [],
        currentTechPackVersionId: record.currentTechPackVersionId || '',
        currentTechPackVersionCode: record.currentTechPackVersionCode || '',
        currentTechPackVersionLabel: record.currentTechPackVersionLabel || '',
        currentTechPackVersionStatus: record.currentTechPackVersionStatus || '',
        currentTechPackVersionActivatedAt: record.currentTechPackVersionActivatedAt || '',
        currentTechPackVersionActivatedBy: record.currentTechPackVersionActivatedBy || '',
    };
}
function clonePendingItem(item) {
    return { ...item };
}
function cloneSnapshot(snapshot) {
    return {
        version: snapshot.version,
        records: snapshot.records.map(cloneRecord),
        pendingItems: snapshot.pendingItems.map(clonePendingItem),
    };
}
function seedSnapshot() {
    return createStyleArchiveBootstrapSnapshot(STYLE_ARCHIVE_STORE_VERSION);
}
function normalizeBaseInfoStatus(status) {
    if (status === '已维护')
        return '已建档';
    return status || '待完善';
}
function normalizeRecord(record) {
    const fixture = buildStyleFixture(record.styleCode || record.styleId, record.styleName || record.styleCode);
    const inferredSourceProjectNodeId = !record.sourceProjectNodeId && record.sourceProjectId
        ? getProjectNodeRecordByWorkItemTypeCode(record.sourceProjectId, 'STYLE_ARCHIVE_CREATE')?.projectNodeId || ''
        : record.sourceProjectNodeId || '';
    return {
        ...cloneRecord(record),
        archiveStatus: record.archiveStatus === 'ACTIVE' || record.archiveStatus === 'ARCHIVED' ? record.archiveStatus : 'DRAFT',
        styleNameEn: record.styleNameEn || fixture.styleNameEn,
        baseInfoStatus: normalizeBaseInfoStatus(record.baseInfoStatus),
        specificationStatus: record.specificationStatus || '未建立',
        techPackStatus: normalizeStyleTechPackStatusText(record.techPackStatus || '未建立'),
        costPricingStatus: record.costPricingStatus || '未建立',
        specificationCount: Number.isFinite(record.specificationCount) ? record.specificationCount : 0,
        techPackVersionCount: Number.isFinite(record.techPackVersionCount) ? record.techPackVersionCount : 0,
        costVersionCount: Number.isFinite(record.costVersionCount) ? record.costVersionCount : 0,
        channelProductCount: Number.isFinite(record.channelProductCount) ? record.channelProductCount : 0,
        currentTechPackVersionId: record.currentTechPackVersionId || '',
        currentTechPackVersionCode: record.currentTechPackVersionCode || '',
        currentTechPackVersionLabel: record.currentTechPackVersionLabel || '',
        currentTechPackVersionStatus: record.currentTechPackVersionStatus || '',
        currentTechPackVersionActivatedAt: record.currentTechPackVersionActivatedAt || '',
        currentTechPackVersionActivatedBy: record.currentTechPackVersionActivatedBy || '',
        mainImageId: record.mainImageId || '',
        mainImageUrl: record.mainImageUrl || '',
        galleryImageIds: Array.isArray(record.galleryImageIds) ? [...record.galleryImageIds] : [],
        galleryImageUrls: Array.isArray(record.galleryImageUrls) ? [...record.galleryImageUrls] : [],
        imageSource: record.imageSource || (record.mainImageUrl ? '历史图片' : ''),
        sellingPointText: record.sellingPointText || fixture.sellingPointText,
        detailDescription: record.detailDescription || fixture.detailDescription,
        packagingInfo: record.packagingInfo || fixture.packagingInfo,
        remark: record.remark || '',
        sourceProjectNodeId: inferredSourceProjectNodeId,
        generatedAt: record.generatedAt || record.updatedAt || '',
        generatedBy: record.generatedBy || '系统初始化',
        updatedAt: record.updatedAt || record.generatedAt || '',
        updatedBy: record.updatedBy || '系统初始化',
        legacyOriginProject: record.legacyOriginProject || '',
    };
}
function normalizePendingItem(item) {
    return {
        ...clonePendingItem(item),
        rawStyleCode: item.rawStyleCode || '',
        rawOriginProject: item.rawOriginProject || '',
        reason: item.reason || '未说明原因',
        discoveredAt: item.discoveredAt || '',
    };
}
function hydrateSnapshot(snapshot) {
    return {
        version: STYLE_ARCHIVE_STORE_VERSION,
        records: Array.isArray(snapshot.records) ? snapshot.records.map(normalizeRecord) : [],
        pendingItems: Array.isArray(snapshot.pendingItems) ? snapshot.pendingItems.map(normalizePendingItem) : [],
    };
}
function mergeMissingSeedData(snapshot) {
    const seed = seedSnapshot();
    const seedById = new Map(seed.records.map((item) => [item.styleId, item]));
    const existingIds = new Set(snapshot.records.map((item) => item.styleId));
    const existingPendingIds = new Set(snapshot.pendingItems.map((item) => item.pendingId));
    const patchedRecords = snapshot.records.map((record) => {
        const seeded = seedById.get(record.styleId);
        if (!seeded?.currentTechPackVersionId || record.currentTechPackVersionId)
            return record;
        return {
            ...record,
            techPackStatus: seeded.techPackStatus,
            techPackVersionCount: Math.max(record.techPackVersionCount || 0, seeded.techPackVersionCount || 0),
            currentTechPackVersionId: seeded.currentTechPackVersionId,
            currentTechPackVersionCode: seeded.currentTechPackVersionCode,
            currentTechPackVersionLabel: seeded.currentTechPackVersionLabel,
            currentTechPackVersionStatus: seeded.currentTechPackVersionStatus,
            currentTechPackVersionActivatedAt: seeded.currentTechPackVersionActivatedAt,
            currentTechPackVersionActivatedBy: seeded.currentTechPackVersionActivatedBy,
            updatedAt: seeded.updatedAt || record.updatedAt,
            updatedBy: seeded.updatedBy || record.updatedBy,
        };
    });
    return {
        version: STYLE_ARCHIVE_STORE_VERSION,
        records: [
            ...patchedRecords,
            ...seed.records.filter((item) => !existingIds.has(item.styleId)).map(cloneRecord),
        ],
        pendingItems: [
            ...snapshot.pendingItems,
            ...seed.pendingItems.filter((item) => !existingPendingIds.has(item.pendingId)).map(clonePendingItem),
        ],
    };
}
function loadSnapshot() {
    if (memorySnapshot)
        return cloneSnapshot(memorySnapshot);
    if (!canUseStorage()) {
        memorySnapshot = seedSnapshot();
        return cloneSnapshot(memorySnapshot);
    }
    try {
        const raw = localStorage.getItem(STYLE_ARCHIVE_STORAGE_KEY);
        if (!raw) {
            memorySnapshot = seedSnapshot();
            localStorage.setItem(STYLE_ARCHIVE_STORAGE_KEY, JSON.stringify(memorySnapshot));
            return cloneSnapshot(memorySnapshot);
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.records) || !Array.isArray(parsed.pendingItems)) {
            memorySnapshot = seedSnapshot();
            localStorage.setItem(STYLE_ARCHIVE_STORAGE_KEY, JSON.stringify(memorySnapshot));
            return cloneSnapshot(memorySnapshot);
        }
        memorySnapshot = mergeMissingSeedData(hydrateSnapshot({
            version: STYLE_ARCHIVE_STORE_VERSION,
            records: parsed.records,
            pendingItems: parsed.pendingItems,
        }));
        localStorage.setItem(STYLE_ARCHIVE_STORAGE_KEY, JSON.stringify(memorySnapshot));
        return cloneSnapshot(memorySnapshot);
    }
    catch {
        memorySnapshot = seedSnapshot();
        if (canUseStorage()) {
            localStorage.setItem(STYLE_ARCHIVE_STORAGE_KEY, JSON.stringify(memorySnapshot));
        }
        return cloneSnapshot(memorySnapshot);
    }
}
function persistSnapshot(snapshot) {
    memorySnapshot = hydrateSnapshot(snapshot);
    if (canUseStorage()) {
        localStorage.setItem(STYLE_ARCHIVE_STORAGE_KEY, JSON.stringify(memorySnapshot));
    }
}
export function getStyleArchiveStoreSnapshot() {
    return loadSnapshot();
}
export function listStyleArchives() {
    return loadSnapshot().records.map(cloneRecord).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function getStyleArchiveById(styleId) {
    const record = loadSnapshot().records.find((item) => item.styleId === styleId);
    return record ? cloneRecord(record) : null;
}
export function findStyleArchiveByCode(styleCode) {
    // FCS 需求页与转单链路都从正式款式档案读取当前生效技术包版本指针。
    const matchedRecords = loadSnapshot().records.filter((item) => item.styleCode === styleCode);
    const record = matchedRecords.find((item) => item.styleId.startsWith('style_demand_') && Boolean(item.currentTechPackVersionId)) ??
        matchedRecords.find((item) => Boolean(item.currentTechPackVersionId)) ??
        matchedRecords.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    return record ? cloneRecord(record) : null;
}
export function findStyleArchiveByProjectId(projectId) {
    const record = loadSnapshot().records.find((item) => item.sourceProjectId === projectId);
    return record ? cloneRecord(record) : null;
}
export function hasStyleArchiveForProject(projectId) {
    return Boolean(findStyleArchiveByProjectId(projectId));
}
export function createStyleArchiveShell(record) {
    const snapshot = loadSnapshot();
    const normalized = normalizeRecord(record);
    if (!normalized.sourceProjectId ||
        !normalized.sourceProjectCode ||
        !normalized.sourceProjectName ||
        !normalized.sourceProjectNodeId) {
        throw new Error('款式档案只能从商品项目 STYLE_ARCHIVE_CREATE 节点生成。');
    }
    if (normalized.sourceProjectId && snapshot.records.some((item) => item.sourceProjectId === normalized.sourceProjectId)) {
        throw new Error('当前商品项目已存在正式款式档案主关联。');
    }
    persistSnapshot({
        ...snapshot,
        records: [normalized, ...snapshot.records],
    });
    return cloneRecord(normalized);
}
export function updateStyleArchive(styleId, patch) {
    const snapshot = loadSnapshot();
    const index = snapshot.records.findIndex((item) => item.styleId === styleId);
    if (index < 0)
        return null;
    const nextRecord = normalizeRecord({
        ...snapshot.records[index],
        ...patch,
    });
    const nextRecords = [...snapshot.records];
    nextRecords.splice(index, 1, nextRecord);
    persistSnapshot({
        ...snapshot,
        records: nextRecords,
    });
    return cloneRecord(nextRecord);
}
export function listStyleArchivePendingItems() {
    return loadSnapshot().pendingItems.map(clonePendingItem);
}
export function pushStyleArchivePendingItem(item) {
    const snapshot = loadSnapshot();
    if (snapshot.pendingItems.some((current) => current.pendingId === item.pendingId))
        return;
    persistSnapshot({
        ...snapshot,
        pendingItems: [...snapshot.pendingItems, normalizePendingItem(item)],
    });
}
export function replaceStyleArchiveStore(snapshot) {
    persistSnapshot(snapshot);
}
export function resetStyleArchiveRepository() {
    const snapshot = seedSnapshot();
    persistSnapshot(snapshot);
    if (canUseStorage()) {
        localStorage.removeItem(STYLE_ARCHIVE_STORAGE_KEY);
        localStorage.setItem(STYLE_ARCHIVE_STORAGE_KEY, JSON.stringify(snapshot));
    }
}
