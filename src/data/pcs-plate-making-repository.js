import { createTaskBootstrapSnapshot } from './pcs-task-bootstrap.ts';
const STORAGE_KEY = 'higood-pcs-plate-making-store-v1';
const STORE_VERSION = 1;
let memorySnapshot = null;
function canUseStorage() {
    return typeof localStorage !== 'undefined';
}
function cloneTask(task) {
    return {
        ...task,
        participantNames: [...task.participantNames],
        flowerImageIds: [...(task.flowerImageIds || [])],
        materialRequirementLines: (task.materialRequirementLines || []).map((line) => ({ ...line })),
        patternImageLineItems: (task.patternImageLineItems || []).map((line) => ({ ...line })),
        patternPdfFileIds: [...(task.patternPdfFileIds || [])],
        patternDxfFileIds: [...(task.patternDxfFileIds || [])],
        patternRulFileIds: [...(task.patternRulFileIds || [])],
        supportImageIds: [...(task.supportImageIds || [])],
        supportVideoIds: [...(task.supportVideoIds || [])],
        partTemplateLinks: (task.partTemplateLinks || []).map((link) => ({
            ...link,
            matchedPartNames: [...(link.matchedPartNames || [])],
        })),
    };
}
function clonePendingItem(item) {
    return { ...item };
}
function cloneSnapshot(snapshot) {
    return {
        version: snapshot.version,
        tasks: snapshot.tasks.map(cloneTask),
        pendingItems: snapshot.pendingItems.map(clonePendingItem),
    };
}
function seedSnapshot() {
    const bootstrap = createTaskBootstrapSnapshot();
    return {
        version: STORE_VERSION,
        tasks: bootstrap.plateTasks.map(cloneTask),
        pendingItems: bootstrap.platePendingItems.map(clonePendingItem),
    };
}
function normalizeTask(task) {
    return {
        ...cloneTask(task),
        participantNames: [...(task.participantNames || [])],
        styleId: task.styleId || '',
        styleCode: task.styleCode || task.productStyleCode || task.spuCode || '',
        styleName: task.styleName || '',
        productHistoryType: task.productHistoryType || '',
        patternMakerId: task.patternMakerId || '',
        patternMakerName: task.patternMakerName || '',
        sampleConfirmedAt: task.sampleConfirmedAt || '',
        urgentFlag: Boolean(task.urgentFlag),
        patternArea: task.patternArea || '',
        colorRequirementText: task.colorRequirementText || '',
        newPatternSpuCode: task.newPatternSpuCode || '',
        flowerImageIds: [...(task.flowerImageIds || [])],
        materialRequirementLines: (task.materialRequirementLines || []).map((line, index) => ({
            lineId: line.lineId || `${task.plateTaskId}_material_${index + 1}`,
            materialImageId: line.materialImageId || '',
            materialName: line.materialName || '',
            materialSku: line.materialSku || '',
            printRequirement: line.printRequirement || '',
            quantity: Number(line.quantity || 0),
            unitPrice: Number(line.unitPrice || 0),
            amount: Number(line.amount || 0),
            note: line.note || '',
        })),
        patternImageLineItems: (task.patternImageLineItems || []).map((line, index) => ({
            lineId: line.lineId || `${task.plateTaskId}_pattern_image_${index + 1}`,
            imageId: line.imageId || '',
            materialPartName: line.materialPartName || '',
            materialDescription: line.materialDescription || '',
            pieceCount: Number(line.pieceCount || 0),
        })),
        patternPdfFileIds: [...(task.patternPdfFileIds || [])],
        patternDxfFileIds: [...(task.patternDxfFileIds || [])],
        patternRulFileIds: [...(task.patternRulFileIds || [])],
        supportImageIds: [...(task.supportImageIds || [])],
        supportVideoIds: [...(task.supportVideoIds || [])],
        partTemplateLinks: (task.partTemplateLinks || []).map((link) => ({
            templateId: link.templateId || '',
            templateCode: link.templateCode || '',
            templateName: link.templateName || '',
            matchedPartNames: [...(link.matchedPartNames || [])],
        })),
        linkedTechPackVersionId: task.linkedTechPackVersionId || '',
        linkedTechPackVersionCode: task.linkedTechPackVersionCode || '',
        linkedTechPackVersionLabel: task.linkedTechPackVersionLabel || '',
        linkedTechPackVersionStatus: task.linkedTechPackVersionStatus || '',
        linkedTechPackUpdatedAt: task.linkedTechPackUpdatedAt || '',
        primaryTechPackGeneratedFlag: Boolean(task.primaryTechPackGeneratedFlag),
        primaryTechPackGeneratedAt: task.primaryTechPackGeneratedAt || '',
        acceptedAt: task.acceptedAt || '',
        confirmedAt: task.confirmedAt || '',
        note: task.note || '',
        legacyProjectRef: task.legacyProjectRef || '',
        legacyUpstreamRef: task.legacyUpstreamRef || '',
    };
}
function hydrateSnapshot(snapshot) {
    return {
        version: STORE_VERSION,
        tasks: Array.isArray(snapshot.tasks) ? snapshot.tasks.map(normalizeTask) : [],
        pendingItems: Array.isArray(snapshot.pendingItems) ? snapshot.pendingItems.map(clonePendingItem) : [],
    };
}
function mergeMissingSeedData(snapshot) {
    const seed = seedSnapshot();
    const existingTaskIds = new Set(snapshot.tasks.map((item) => item.plateTaskId));
    const existingPendingIds = new Set(snapshot.pendingItems.map((item) => item.pendingId));
    return hydrateSnapshot({
        version: STORE_VERSION,
        tasks: [
            ...snapshot.tasks,
            ...seed.tasks.filter((item) => !existingTaskIds.has(item.plateTaskId)).map(cloneTask),
        ],
        pendingItems: [
            ...snapshot.pendingItems,
            ...seed.pendingItems.filter((item) => !existingPendingIds.has(item.pendingId)).map(clonePendingItem),
        ],
    });
}
function loadSnapshot() {
    if (memorySnapshot)
        return cloneSnapshot(memorySnapshot);
    if (!canUseStorage()) {
        memorySnapshot = seedSnapshot();
        return cloneSnapshot(memorySnapshot);
    }
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            memorySnapshot = seedSnapshot();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot));
            return cloneSnapshot(memorySnapshot);
        }
        const parsed = JSON.parse(raw);
        memorySnapshot = mergeMissingSeedData(hydrateSnapshot({
            version: STORE_VERSION,
            tasks: Array.isArray(parsed.tasks) ? parsed.tasks : seedSnapshot().tasks,
            pendingItems: Array.isArray(parsed.pendingItems) ? parsed.pendingItems : seedSnapshot().pendingItems,
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot));
        return cloneSnapshot(memorySnapshot);
    }
    catch {
        memorySnapshot = seedSnapshot();
        if (canUseStorage()) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot));
        }
        return cloneSnapshot(memorySnapshot);
    }
}
function persistSnapshot(snapshot) {
    memorySnapshot = hydrateSnapshot(snapshot);
    if (canUseStorage()) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot));
    }
}
export function listPlateMakingTasks() {
    return loadSnapshot().tasks.map(cloneTask).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function getPlateMakingTaskById(plateTaskId) {
    const task = loadSnapshot().tasks.find((item) => item.plateTaskId === plateTaskId);
    return task ? cloneTask(task) : null;
}
export function listPlateMakingTasksByProject(projectId) {
    return loadSnapshot().tasks.filter((item) => item.projectId === projectId).map(cloneTask);
}
export function listPlateMakingTasksByProjectNode(projectId, projectNodeId) {
    return loadSnapshot()
        .tasks
        .filter((item) => item.projectId === projectId && item.projectNodeId === projectNodeId)
        .map(cloneTask);
}
export function upsertPlateMakingTask(task) {
    const snapshot = loadSnapshot();
    persistSnapshot({
        ...snapshot,
        tasks: [normalizeTask(task), ...snapshot.tasks.filter((item) => item.plateTaskId !== task.plateTaskId)],
    });
    return getPlateMakingTaskById(task.plateTaskId) ?? normalizeTask(task);
}
export function updatePlateMakingTask(plateTaskId, patch) {
    const current = getPlateMakingTaskById(plateTaskId);
    if (!current)
        return null;
    return upsertPlateMakingTask({ ...current, ...patch, plateTaskId: current.plateTaskId, plateTaskCode: current.plateTaskCode });
}
export function listPlateMakingTaskPendingItems() {
    return loadSnapshot().pendingItems.map(clonePendingItem);
}
export function upsertPlateMakingTaskPendingItem(item) {
    const snapshot = loadSnapshot();
    persistSnapshot({
        ...snapshot,
        pendingItems: [item, ...snapshot.pendingItems.filter((current) => current.pendingId !== item.pendingId)],
    });
    return clonePendingItem(item);
}
export function replacePlateMakingTaskStore(tasks, pendingItems = []) {
    persistSnapshot({
        version: STORE_VERSION,
        tasks,
        pendingItems,
    });
}
export function resetPlateMakingTaskRepository() {
    const snapshot = seedSnapshot();
    persistSnapshot(snapshot);
    if (canUseStorage()) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    }
}
