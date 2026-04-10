import {
  LIVE_PURPOSE_META,
  SESSION_STATUS_META,
  getLiveSessionItems,
  listLiveSessions,
} from './pcs-testing.ts'
import type { LiveProductLine, LiveSessionRecord, LiveTestingStoreSnapshot } from './pcs-live-testing-types.ts'

const LIVE_TESTING_STORAGE_KEY = 'higood-pcs-live-testing-store-v1'
const LIVE_TESTING_STORE_VERSION = 1

let memorySnapshot: LiveTestingStoreSnapshot | null = null

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function cloneSession(session: LiveSessionRecord): LiveSessionRecord {
  return {
    ...session,
    purposes: [...session.purposes],
  }
}

function cloneLine(line: LiveProductLine): LiveProductLine {
  return { ...line }
}

function cloneSnapshot(snapshot: LiveTestingStoreSnapshot): LiveTestingStoreSnapshot {
  return {
    version: snapshot.version,
    sessions: snapshot.sessions.map(cloneSession),
    productLines: snapshot.productLines.map(cloneLine),
  }
}

function toBusinessDate(value: string | null | undefined): string {
  return value?.slice(0, 10) ?? ''
}

function parseSkuCodeSegments(skuCode: string): { colorCode: string; sizeCode: string } {
  const parts = skuCode.split('-').filter(Boolean)
  if (parts.length >= 2) {
    return {
      sizeCode: parts.at(-2) ?? '',
      colorCode: parts.at(-1) ?? '',
    }
  }
  return { colorCode: '', sizeCode: '' }
}

function buildSeedSnapshot(): LiveTestingStoreSnapshot {
  const sessions = listLiveSessions()
  const sessionRecords: LiveSessionRecord[] = sessions.map((session) => ({
    liveSessionId: session.id,
    liveSessionCode: session.id,
    sessionTitle: session.title,
    channelName: session.liveAccount,
    hostName: session.anchor,
    sessionStatus: SESSION_STATUS_META[session.status].label,
    businessDate: toBusinessDate(session.startAt),
    startedAt: session.startAt,
    endedAt: session.endAt ?? '',
    ownerName: session.owner,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    purposes: session.purposes.map((purpose) => LIVE_PURPOSE_META[purpose].label),
    itemCount: session.itemCount,
    testItemCount: session.testItemCount,
    testAccountingStatus: session.testAccountingStatus,
    gmvAmount: session.gmvTotal,
    legacyProjectRef: null,
    legacyProjectId: null,
  }))

  const productLines: LiveProductLine[] = sessions.flatMap((session) =>
    getLiveSessionItems(session.id).map((item, index) => {
      const skuSegments = parseSkuCodeSegments(item.sku)
      return {
        liveLineId: `${session.id}__${item.id}`,
        liveLineCode: `${session.id}-L${String(index + 1).padStart(2, '0')}`,
        liveSessionId: session.id,
        liveSessionCode: session.id,
        lineNo: index + 1,
        productTitle: item.productName,
        styleCode: item.productRef,
        spuCode: item.productRef,
        skuCode: item.sku,
        colorCode: skuSegments.colorCode,
        sizeCode: skuSegments.sizeCode,
        exposureQty: item.exposure,
        clickQty: item.click,
        orderQty: item.order,
        gmvAmount: item.gmv,
        businessDate: toBusinessDate(session.startAt),
        ownerName: session.owner,
        sessionStatus: SESSION_STATUS_META[session.status].label,
        legacyProjectRef: item.projectRef,
        legacyProjectId: item.projectRef,
      }
    }),
  )

  return {
    version: LIVE_TESTING_STORE_VERSION,
    sessions: sessionRecords,
    productLines,
  }
}

function hydrateSnapshot(snapshot: LiveTestingStoreSnapshot): LiveTestingStoreSnapshot {
  return {
    version: LIVE_TESTING_STORE_VERSION,
    sessions: Array.isArray(snapshot.sessions) ? snapshot.sessions.map(cloneSession) : [],
    productLines: Array.isArray(snapshot.productLines) ? snapshot.productLines.map(cloneLine) : [],
  }
}

function loadSnapshot(): LiveTestingStoreSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)

  if (!canUseStorage()) {
    memorySnapshot = buildSeedSnapshot()
    return cloneSnapshot(memorySnapshot)
  }

  try {
    const raw = localStorage.getItem(LIVE_TESTING_STORAGE_KEY)
    if (!raw) {
      memorySnapshot = buildSeedSnapshot()
      localStorage.setItem(LIVE_TESTING_STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }
    const parsed = JSON.parse(raw) as Partial<LiveTestingStoreSnapshot>
    memorySnapshot = hydrateSnapshot({
      version: LIVE_TESTING_STORE_VERSION,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions as LiveSessionRecord[] : buildSeedSnapshot().sessions,
      productLines: Array.isArray(parsed.productLines)
        ? parsed.productLines as LiveProductLine[]
        : buildSeedSnapshot().productLines,
    })
    localStorage.setItem(LIVE_TESTING_STORAGE_KEY, JSON.stringify(memorySnapshot))
    return cloneSnapshot(memorySnapshot)
  } catch {
    memorySnapshot = buildSeedSnapshot()
    if (canUseStorage()) {
      localStorage.setItem(LIVE_TESTING_STORAGE_KEY, JSON.stringify(memorySnapshot))
    }
    return cloneSnapshot(memorySnapshot)
  }
}

export function getLiveTestingStoreSnapshot(): LiveTestingStoreSnapshot {
  return loadSnapshot()
}

export function listLiveSessionRecords(): LiveSessionRecord[] {
  return loadSnapshot().sessions.map(cloneSession)
}

export function getLiveSessionRecordById(liveSessionId: string): LiveSessionRecord | null {
  const record = loadSnapshot().sessions.find((item) => item.liveSessionId === liveSessionId)
  return record ? cloneSession(record) : null
}

export function listLiveProductLines(): LiveProductLine[] {
  return loadSnapshot().productLines.map(cloneLine)
}

export function listLiveProductLinesBySession(liveSessionId: string): LiveProductLine[] {
  return loadSnapshot()
    .productLines
    .filter((item) => item.liveSessionId === liveSessionId)
    .sort((a, b) => a.lineNo - b.lineNo)
    .map(cloneLine)
}

export function getLiveProductLineById(liveLineId: string): LiveProductLine | null {
  const line = loadSnapshot().productLines.find((item) => item.liveLineId === liveLineId)
  return line ? cloneLine(line) : null
}

export function resetLiveTestingRepository(): void {
  const snapshot = buildSeedSnapshot()
  memorySnapshot = snapshot
  if (canUseStorage()) {
    localStorage.removeItem(LIVE_TESTING_STORAGE_KEY)
    localStorage.setItem(LIVE_TESTING_STORAGE_KEY, JSON.stringify(snapshot))
  }
}
