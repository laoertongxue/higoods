const STORAGE_KEY = 'higood-pcs-tech-pack-version-log-store-v1';
const STORE_VERSION = 1;
let memorySnapshot = null;
function canUseStorage() {
    return typeof localStorage !== 'undefined';
}
function cloneLog(log) {
    return { ...log };
}
function cloneSnapshot(snapshot) {
    return {
        version: snapshot.version,
        logs: snapshot.logs.map(cloneLog),
    };
}
function nowText() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
function createEmptySnapshot() {
    return {
        version: STORE_VERSION,
        logs: [],
    };
}
function normalizeLog(log) {
    return {
        ...cloneLog(log),
        sourceTaskType: log.sourceTaskType === 'REVISION' || log.sourceTaskType === 'PLATE' || log.sourceTaskType === 'ARTWORK' || log.sourceTaskType === 'MANUAL'
            ? log.sourceTaskType
            : '',
        sourceTaskId: log.sourceTaskId || '',
        sourceTaskCode: log.sourceTaskCode || '',
        sourceTaskName: log.sourceTaskName || '',
        changeScope: log.changeScope || '',
        changeText: log.changeText || '',
        beforeVersionId: log.beforeVersionId || '',
        beforeVersionCode: log.beforeVersionCode || '',
        afterVersionId: log.afterVersionId || '',
        afterVersionCode: log.afterVersionCode || '',
        createdAt: log.createdAt || nowText(),
        createdBy: log.createdBy || '系统初始化',
    };
}
function hydrateSnapshot(snapshot) {
    return {
        version: STORE_VERSION,
        logs: Array.isArray(snapshot.logs)
            ? snapshot.logs.map(normalizeLog).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            : [],
    };
}
function loadSnapshot() {
    if (memorySnapshot)
        return cloneSnapshot(memorySnapshot);
    if (!canUseStorage()) {
        memorySnapshot = createEmptySnapshot();
        return cloneSnapshot(memorySnapshot);
    }
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            memorySnapshot = createEmptySnapshot();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot));
            return cloneSnapshot(memorySnapshot);
        }
        const parsed = JSON.parse(raw);
        memorySnapshot = hydrateSnapshot({
            version: STORE_VERSION,
            logs: Array.isArray(parsed.logs) ? parsed.logs : [],
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot));
        return cloneSnapshot(memorySnapshot);
    }
    catch {
        memorySnapshot = createEmptySnapshot();
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
export function listTechPackVersionLogs() {
    return loadSnapshot().logs.map(cloneLog);
}
export function listTechPackVersionLogsByVersionId(technicalVersionId) {
    return loadSnapshot()
        .logs
        .filter((item) => item.technicalVersionId === technicalVersionId)
        .map(cloneLog);
}
export function listTechPackVersionLogsByStyleId(styleId) {
    return loadSnapshot()
        .logs
        .filter((item) => item.styleId === styleId)
        .map(cloneLog);
}
export function appendTechPackVersionLog(log) {
    const snapshot = loadSnapshot();
    const normalized = normalizeLog(log);
    persistSnapshot({
        version: STORE_VERSION,
        logs: [normalized, ...snapshot.logs.filter((item) => item.logId !== normalized.logId)],
    });
    return normalized;
}
export function replaceTechPackVersionLogStore(logs) {
    persistSnapshot({
        version: STORE_VERSION,
        logs,
    });
}
export function resetTechPackVersionLogRepository() {
    const snapshot = createEmptySnapshot();
    persistSnapshot(snapshot);
    if (canUseStorage()) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    }
}
