import type {
  SampleLedgerEventRecord,
  SampleLedgerStoreSnapshot,
  SampleWritebackPendingItem,
} from './pcs-sample-types.ts'

const SAMPLE_LEDGER_STORAGE_KEY = 'higood-pcs-sample-ledger-v1'
const SAMPLE_LEDGER_STORE_VERSION = 1

let memorySnapshot: SampleLedgerStoreSnapshot | null = null

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function cloneEvent(event: SampleLedgerEventRecord): SampleLedgerEventRecord {
  return { ...event }
}

function clonePendingItem(item: SampleWritebackPendingItem): SampleWritebackPendingItem {
  return { ...item }
}

function cloneSnapshot(snapshot: SampleLedgerStoreSnapshot): SampleLedgerStoreSnapshot {
  return {
    version: snapshot.version,
    events: snapshot.events.map(cloneEvent),
    pendingItems: snapshot.pendingItems.map(clonePendingItem),
  }
}

function emptySnapshot(): SampleLedgerStoreSnapshot {
  return {
    version: SAMPLE_LEDGER_STORE_VERSION,
    events: [],
    pendingItems: [],
  }
}

function normalizeEvent(event: SampleLedgerEventRecord): SampleLedgerEventRecord {
  return {
    ...cloneEvent(event),
    projectId: event.projectId || '',
    projectCode: event.projectCode || '',
    projectName: event.projectName || '',
    projectNodeId: event.projectNodeId || '',
    workItemTypeCode: event.workItemTypeCode || '',
    workItemTypeName: event.workItemTypeName || '',
    sourceDocType: event.sourceDocType || '',
    sourceDocId: event.sourceDocId || '',
    sourceDocCode: event.sourceDocCode || '',
    legacyProjectRef: event.legacyProjectRef || '',
    legacyWorkItemInstanceId: event.legacyWorkItemInstanceId || '',
    note: event.note || '',
  }
}

function normalizePendingItem(item: SampleWritebackPendingItem): SampleWritebackPendingItem {
  return {
    ...clonePendingItem(item),
    sourcePage: item.sourcePage || '未知页面',
    sourceDocType: item.sourceDocType || '未知来源单据',
    sourceDocCode: item.sourceDocCode || '',
    sampleCode: item.sampleCode || '',
    rawProjectField: item.rawProjectField || '',
    rawWorkItemField: item.rawWorkItemField || '',
    reason: item.reason || '未说明原因',
    discoveredAt: item.discoveredAt || '',
  }
}

function dedupeEvents(events: SampleLedgerEventRecord[]): SampleLedgerEventRecord[] {
  const map = new Map<string, SampleLedgerEventRecord>()
  events.forEach((event) => {
    const normalized = normalizeEvent(event)
    const existing = map.get(normalized.ledgerEventId)
    if (!existing || normalized.businessDate.localeCompare(existing.businessDate) >= 0) {
      map.set(normalized.ledgerEventId, normalized)
    }
  })
  return Array.from(map.values()).sort((a, b) => b.businessDate.localeCompare(a.businessDate))
}

function dedupePendingItems(items: SampleWritebackPendingItem[]): SampleWritebackPendingItem[] {
  const map = new Map<string, SampleWritebackPendingItem>()
  items.forEach((item) => {
    const normalized = normalizePendingItem(item)
    const key = [
      normalized.sourcePage,
      normalized.sourceDocType,
      normalized.sourceDocCode,
      normalized.sampleCode,
      normalized.rawProjectField,
      normalized.rawWorkItemField,
      normalized.reason,
    ].join('::')
    map.set(key, normalized)
  })
  return Array.from(map.values()).sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt))
}

function hydrateSnapshot(snapshot: SampleLedgerStoreSnapshot): SampleLedgerStoreSnapshot {
  return {
    version: SAMPLE_LEDGER_STORE_VERSION,
    events: dedupeEvents(Array.isArray(snapshot.events) ? snapshot.events : []),
    pendingItems: dedupePendingItems(Array.isArray(snapshot.pendingItems) ? snapshot.pendingItems : []),
  }
}

function loadSnapshot(): SampleLedgerStoreSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)
  if (!canUseStorage()) {
    memorySnapshot = emptySnapshot()
    return cloneSnapshot(memorySnapshot)
  }

  try {
    const raw = localStorage.getItem(SAMPLE_LEDGER_STORAGE_KEY)
    if (!raw) {
      memorySnapshot = emptySnapshot()
      localStorage.setItem(SAMPLE_LEDGER_STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }

    const parsed = JSON.parse(raw) as Partial<SampleLedgerStoreSnapshot>
    memorySnapshot = hydrateSnapshot({
      version: SAMPLE_LEDGER_STORE_VERSION,
      events: Array.isArray(parsed.events) ? (parsed.events as SampleLedgerEventRecord[]) : [],
      pendingItems: Array.isArray(parsed.pendingItems) ? (parsed.pendingItems as SampleWritebackPendingItem[]) : [],
    })
    localStorage.setItem(SAMPLE_LEDGER_STORAGE_KEY, JSON.stringify(memorySnapshot))
    return cloneSnapshot(memorySnapshot)
  } catch {
    memorySnapshot = emptySnapshot()
    if (canUseStorage()) {
      localStorage.setItem(SAMPLE_LEDGER_STORAGE_KEY, JSON.stringify(memorySnapshot))
    }
    return cloneSnapshot(memorySnapshot)
  }
}

function persistSnapshot(snapshot: SampleLedgerStoreSnapshot): void {
  memorySnapshot = hydrateSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.setItem(SAMPLE_LEDGER_STORAGE_KEY, JSON.stringify(memorySnapshot))
  }
}

export function listSampleLedgerEvents(): SampleLedgerEventRecord[] {
  return loadSnapshot().events.map(cloneEvent)
}

export function listSampleLedgerEventsBySample(sampleAssetId: string): SampleLedgerEventRecord[] {
  return loadSnapshot()
    .events
    .filter((item) => item.sampleAssetId === sampleAssetId)
    .sort((a, b) => b.businessDate.localeCompare(a.businessDate))
    .map(cloneEvent)
}

export function getSampleLedgerEventById(ledgerEventId: string): SampleLedgerEventRecord | null {
  const event = loadSnapshot().events.find((item) => item.ledgerEventId === ledgerEventId)
  return event ? cloneEvent(event) : null
}

export function upsertSampleLedgerEvent(event: SampleLedgerEventRecord): SampleLedgerEventRecord {
  const snapshot = loadSnapshot()
  persistSnapshot({
    ...snapshot,
    events: [...snapshot.events, normalizeEvent(event)],
  })
  return getSampleLedgerEventById(event.ledgerEventId) ?? normalizeEvent(event)
}

export function listSampleWritebackPendingItems(): SampleWritebackPendingItem[] {
  return loadSnapshot().pendingItems.map(clonePendingItem)
}

export function upsertSampleWritebackPendingItem(item: SampleWritebackPendingItem): SampleWritebackPendingItem {
  const snapshot = loadSnapshot()
  persistSnapshot({
    ...snapshot,
    pendingItems: [...snapshot.pendingItems, normalizePendingItem(item)],
  })
  return normalizePendingItem(item)
}

export function replaceSampleLedgerStore(events: SampleLedgerEventRecord[], pendingItems: SampleWritebackPendingItem[] = []): void {
  persistSnapshot({
    version: SAMPLE_LEDGER_STORE_VERSION,
    events,
    pendingItems,
  })
}

export function resetSampleLedgerRepository(): void {
  persistSnapshot(emptySnapshot())
  if (canUseStorage()) {
    localStorage.removeItem(SAMPLE_LEDGER_STORAGE_KEY)
  }
}
