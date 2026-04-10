import { VIDEO_PLATFORM_META, getVideoItems, listVideoRecords } from './pcs-testing.ts'
import type { VideoTestRecord, VideoTestingStoreSnapshot } from './pcs-video-testing-types.ts'

const VIDEO_TESTING_STORAGE_KEY = 'higood-pcs-video-testing-store-v1'
const VIDEO_TESTING_STORE_VERSION = 1

let memorySnapshot: VideoTestingStoreSnapshot | null = null

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function cloneRecord(record: VideoTestRecord): VideoTestRecord {
  return { ...record }
}

function cloneSnapshot(snapshot: VideoTestingStoreSnapshot): VideoTestingStoreSnapshot {
  return {
    version: snapshot.version,
    records: snapshot.records.map(cloneRecord),
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

function buildSeedSnapshot(): VideoTestingStoreSnapshot {
  return {
    version: VIDEO_TESTING_STORE_VERSION,
    records: listVideoRecords().map((record) => {
      const firstItem = getVideoItems(record.id)[0] ?? null
      const skuCode = firstItem?.sku ?? ''
      const skuSegments = parseSkuCodeSegments(skuCode)
      return {
        videoRecordId: record.id,
        videoRecordCode: record.id,
        videoTitle: record.title,
        channelName: `${VIDEO_PLATFORM_META[record.platform].label} / ${record.account}`,
        businessDate: toBusinessDate(record.publishedAt ?? record.updatedAt),
        publishedAt: record.publishedAt ?? '',
        recordStatus: record.status === 'RECONCILING' ? '核对中' : record.status === 'COMPLETED' ? '已关账' : record.status === 'CANCELLED' ? '已取消' : '草稿',
        styleCode: firstItem?.productRef ?? '',
        spuCode: firstItem?.productRef ?? '',
        skuCode,
        colorCode: skuSegments.colorCode,
        sizeCode: skuSegments.sizeCode,
        exposureQty: firstItem?.exposure ?? record.views,
        clickQty: firstItem?.click ?? record.likes,
        orderQty: firstItem?.order ?? 0,
        gmvAmount: firstItem?.gmv ?? record.gmv,
        ownerName: record.owner,
        legacyProjectRef: firstItem?.projectRef ?? null,
        legacyProjectId: firstItem?.projectRef ?? null,
      }
    }),
  }
}

function hydrateSnapshot(snapshot: VideoTestingStoreSnapshot): VideoTestingStoreSnapshot {
  return {
    version: VIDEO_TESTING_STORE_VERSION,
    records: Array.isArray(snapshot.records) ? snapshot.records.map(cloneRecord) : [],
  }
}

function loadSnapshot(): VideoTestingStoreSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)

  if (!canUseStorage()) {
    memorySnapshot = buildSeedSnapshot()
    return cloneSnapshot(memorySnapshot)
  }

  try {
    const raw = localStorage.getItem(VIDEO_TESTING_STORAGE_KEY)
    if (!raw) {
      memorySnapshot = buildSeedSnapshot()
      localStorage.setItem(VIDEO_TESTING_STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }
    const parsed = JSON.parse(raw) as Partial<VideoTestingStoreSnapshot>
    memorySnapshot = hydrateSnapshot({
      version: VIDEO_TESTING_STORE_VERSION,
      records: Array.isArray(parsed.records) ? parsed.records as VideoTestRecord[] : buildSeedSnapshot().records,
    })
    localStorage.setItem(VIDEO_TESTING_STORAGE_KEY, JSON.stringify(memorySnapshot))
    return cloneSnapshot(memorySnapshot)
  } catch {
    memorySnapshot = buildSeedSnapshot()
    if (canUseStorage()) {
      localStorage.setItem(VIDEO_TESTING_STORAGE_KEY, JSON.stringify(memorySnapshot))
    }
    return cloneSnapshot(memorySnapshot)
  }
}

export function getVideoTestingStoreSnapshot(): VideoTestingStoreSnapshot {
  return loadSnapshot()
}

export function listVideoTestRecords(): VideoTestRecord[] {
  return loadSnapshot().records.map(cloneRecord)
}

export function getVideoTestRecordById(videoRecordId: string): VideoTestRecord | null {
  const record = loadSnapshot().records.find((item) => item.videoRecordId === videoRecordId)
  return record ? cloneRecord(record) : null
}

export function resetVideoTestingRepository(): void {
  const snapshot = buildSeedSnapshot()
  memorySnapshot = snapshot
  if (canUseStorage()) {
    localStorage.removeItem(VIDEO_TESTING_STORAGE_KEY)
    localStorage.setItem(VIDEO_TESTING_STORAGE_KEY, JSON.stringify(snapshot))
  }
}
