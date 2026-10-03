import { pcsRecordStore, withPcsDemoData, registerPcsRepositoryReset } from './pcs-record-runtime.ts'
import type {
  TechnicalReviewNotificationRecord,
} from './pcs-technical-data-version-types.ts'

const STORAGE_KEY = 'higood-pcs-tech-pack-review-notification-store-v1'
const STORE_VERSION = 1

export interface TechnicalReviewNotificationStoreSnapshot {
  version: number
  records: TechnicalReviewNotificationRecord[]
}

let memorySnapshot: TechnicalReviewNotificationStoreSnapshot | null = null

function canUseStorage(): boolean {
  return (
    typeof pcsRecordStore !== 'undefined' &&
    typeof pcsRecordStore.getItem === 'function' &&
    typeof pcsRecordStore.setItem === 'function' &&
    typeof pcsRecordStore.removeItem === 'function'
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
    memorySnapshot = withPcsDemoData(() => createEmptySnapshot())
    return { version: memorySnapshot.version, records: memorySnapshot.records.map(cloneRecord) }
  }
  try {
    const raw = pcsRecordStore.getItem(STORAGE_KEY)
    memorySnapshot = raw ? hydrateSnapshot(JSON.parse(raw)) : withPcsDemoData(() => createEmptySnapshot())

    return { version: memorySnapshot.version, records: memorySnapshot.records.map(cloneRecord) }
  } catch {
    memorySnapshot = withPcsDemoData(() => createEmptySnapshot())

    return { version: memorySnapshot.version, records: memorySnapshot.records.map(cloneRecord) }
  }
}

function persistSnapshot(snapshot: TechnicalReviewNotificationStoreSnapshot): void {
  memorySnapshot = hydrateSnapshot(snapshot)
  if (canUseStorage()) pcsRecordStore.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
}

export function listTechPackReviewNotifications(): TechnicalReviewNotificationRecord[] {
  return loadSnapshot().records.map(cloneRecord)
}

export function getTechPackReviewNotificationStoreSnapshot(): TechnicalReviewNotificationStoreSnapshot {
  return loadSnapshot()
}

export function restoreTechPackReviewNotificationStoreSnapshot(
  snapshot: TechnicalReviewNotificationStoreSnapshot,
): void {
  persistSnapshot(snapshot)
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
  const snapshot = withPcsDemoData(() => createEmptySnapshot())
  persistSnapshot(snapshot)
  if (canUseStorage()) {
    pcsRecordStore.removeItem(STORAGE_KEY)
    pcsRecordStore.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  }
}

registerPcsRepositoryReset(() => { memorySnapshot = null })
