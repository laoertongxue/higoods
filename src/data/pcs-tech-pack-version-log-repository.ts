import type {
  TechPackVersionLogRecord,
  TechPackVersionLogStoreSnapshot,
} from './pcs-tech-pack-version-log-types.ts'

const STORAGE_KEY = 'higood-pcs-tech-pack-version-log-store-v1'
const STORE_VERSION = 1

let memorySnapshot: TechPackVersionLogStoreSnapshot | null = null

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function cloneLog(log: TechPackVersionLogRecord): TechPackVersionLogRecord {
  return { ...log }
}

function cloneSnapshot(snapshot: TechPackVersionLogStoreSnapshot): TechPackVersionLogStoreSnapshot {
  return {
    version: snapshot.version,
    logs: snapshot.logs.map(cloneLog),
  }
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function createEmptySnapshot(): TechPackVersionLogStoreSnapshot {
  return {
    version: STORE_VERSION,
    logs: [],
  }
}

function normalizeLog(log: TechPackVersionLogRecord): TechPackVersionLogRecord {
  return {
    ...cloneLog(log),
    sourceTaskType:
      log.sourceTaskType === 'REVISION' || log.sourceTaskType === 'PLATE' || log.sourceTaskType === 'ARTWORK'
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
  }
}

function hydrateSnapshot(snapshot: TechPackVersionLogStoreSnapshot): TechPackVersionLogStoreSnapshot {
  return {
    version: STORE_VERSION,
    logs: Array.isArray(snapshot.logs)
      ? snapshot.logs.map(normalizeLog).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      : [],
  }
}

function loadSnapshot(): TechPackVersionLogStoreSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)
  if (!canUseStorage()) {
    memorySnapshot = createEmptySnapshot()
    return cloneSnapshot(memorySnapshot)
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      memorySnapshot = createEmptySnapshot()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }
    const parsed = JSON.parse(raw) as Partial<TechPackVersionLogStoreSnapshot>
    memorySnapshot = hydrateSnapshot({
      version: STORE_VERSION,
      logs: Array.isArray(parsed.logs) ? (parsed.logs as TechPackVersionLogRecord[]) : [],
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
    return cloneSnapshot(memorySnapshot)
  } catch {
    memorySnapshot = createEmptySnapshot()
    if (canUseStorage()) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
    }
    return cloneSnapshot(memorySnapshot)
  }
}

function persistSnapshot(snapshot: TechPackVersionLogStoreSnapshot): void {
  memorySnapshot = hydrateSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
  }
}

export function listTechPackVersionLogs(): TechPackVersionLogRecord[] {
  return loadSnapshot().logs.map(cloneLog)
}

export function listTechPackVersionLogsByVersionId(technicalVersionId: string): TechPackVersionLogRecord[] {
  return loadSnapshot()
    .logs
    .filter((item) => item.technicalVersionId === technicalVersionId)
    .map(cloneLog)
}

export function listTechPackVersionLogsByStyleId(styleId: string): TechPackVersionLogRecord[] {
  return loadSnapshot()
    .logs
    .filter((item) => item.styleId === styleId)
    .map(cloneLog)
}

export function appendTechPackVersionLog(log: TechPackVersionLogRecord): TechPackVersionLogRecord {
  const snapshot = loadSnapshot()
  const normalized = normalizeLog(log)
  persistSnapshot({
    version: STORE_VERSION,
    logs: [normalized, ...snapshot.logs.filter((item) => item.logId !== normalized.logId)],
  })
  return normalized
}

export function replaceTechPackVersionLogStore(logs: TechPackVersionLogRecord[]): void {
  persistSnapshot({
    version: STORE_VERSION,
    logs,
  })
}

export function resetTechPackVersionLogRepository(): void {
  const snapshot = createEmptySnapshot()
  persistSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  }
}
