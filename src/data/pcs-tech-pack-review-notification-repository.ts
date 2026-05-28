import type {
  TechnicalReviewNotificationRecord,
} from './pcs-technical-data-version-types.ts'

const STORAGE_KEY = 'higood-pcs-tech-pack-review-notification-store-v1'
const STORE_VERSION = 1

interface TechnicalReviewNotificationStoreSnapshot {
  version: number
  records: TechnicalReviewNotificationRecord[]
}

let memorySnapshot: TechnicalReviewNotificationStoreSnapshot | null = null

function canUseStorage(): boolean {
  return (
    typeof localStorage !== 'undefined' &&
    typeof localStorage.getItem === 'function' &&
    typeof localStorage.setItem === 'function' &&
    typeof localStorage.removeItem === 'function'
  )
}

function cloneRecord(record: TechnicalReviewNotificationRecord): TechnicalReviewNotificationRecord {
  return { ...record }
}

function createEmptySnapshot(): TechnicalReviewNotificationStoreSnapshot {
  return {
    version: STORE_VERSION,
    records: [],
  }
}

function normalizeRecord(record: TechnicalReviewNotificationRecord): TechnicalReviewNotificationRecord {
  return {
    ...cloneRecord(record),
    failedReason: record.failedReason || '',
    feishuMessageId: record.feishuMessageId || '',
    deepLink: record.deepLink || '',
  }
}

function hydrateSnapshot(snapshot: Partial<TechnicalReviewNotificationStoreSnapshot>): TechnicalReviewNotificationStoreSnapshot {
  return {
    version: STORE_VERSION,
    records: Array.isArray(snapshot.records)
      ? snapshot.records.map(normalizeRecord).sort((a, b) => b.sentAt.localeCompare(a.sentAt))
      : [],
  }
}

function loadSnapshot(): TechnicalReviewNotificationStoreSnapshot {
  if (memorySnapshot) return {
    version: memorySnapshot.version,
    records: memorySnapshot.records.map(cloneRecord),
  }
  if (!canUseStorage()) {
    memorySnapshot = createEmptySnapshot()
    return { version: memorySnapshot.version, records: memorySnapshot.records.map(cloneRecord) }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    memorySnapshot = raw ? hydrateSnapshot(JSON.parse(raw)) : createEmptySnapshot()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
    return { version: memorySnapshot.version, records: memorySnapshot.records.map(cloneRecord) }
  } catch {
    memorySnapshot = createEmptySnapshot()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
    return { version: memorySnapshot.version, records: memorySnapshot.records.map(cloneRecord) }
  }
}

function persistSnapshot(snapshot: TechnicalReviewNotificationStoreSnapshot): void {
  memorySnapshot = hydrateSnapshot(snapshot)
  if (canUseStorage()) localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
}

export function listTechPackReviewNotifications(): TechnicalReviewNotificationRecord[] {
  return loadSnapshot().records.map(cloneRecord)
}

export function listTechPackReviewNotificationsByVersionId(
  technicalVersionId: string,
): TechnicalReviewNotificationRecord[] {
  return listTechPackReviewNotifications().filter((item) => item.technicalVersionId === technicalVersionId)
}

export function listTechPackReviewNotificationsByNode(
  technicalVersionId: string,
  nodeKey: TechnicalReviewNotificationRecord['nodeKey'],
): TechnicalReviewNotificationRecord[] {
  return listTechPackReviewNotificationsByVersionId(technicalVersionId).filter((item) => item.nodeKey === nodeKey)
}

export function appendTechPackReviewNotification(
  record: TechnicalReviewNotificationRecord,
): TechnicalReviewNotificationRecord {
  const snapshot = loadSnapshot()
  const normalized = normalizeRecord(record)
  persistSnapshot({
    version: STORE_VERSION,
    records: [normalized, ...snapshot.records.filter((item) => item.notificationId !== normalized.notificationId)],
  })
  return normalized
}

export function replaceTechPackReviewNotificationStore(records: TechnicalReviewNotificationRecord[]): void {
  persistSnapshot({
    version: STORE_VERSION,
    records,
  })
}

export function resetTechPackReviewNotificationRepository(): void {
  const snapshot = createEmptySnapshot()
  persistSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  }
}
