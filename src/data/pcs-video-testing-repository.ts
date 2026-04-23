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
  const baseRecords = listVideoRecords().map((record) => {
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
  })

  const extraRecords: VideoTestRecord[] = [
    {
      videoRecordId: 'SV-PJT-011',
      videoRecordCode: 'SV-PJT-011',
      videoTitle: '基础轻甜印花连衣裙短视频测款',
      channelName: '抖音 / 女装测款号',
      businessDate: '2026-04-03',
      publishedAt: '2026-04-03 12:30',
      recordStatus: '已关账',
      styleCode: 'SPU-TSHIRT-081',
      spuCode: 'SPU-TSHIRT-081',
      skuCode: 'SPU-TSHIRT-081-M-PINK',
      colorCode: 'PINK',
      sizeCode: 'M',
      exposureQty: 68200,
      clickQty: 4320,
      orderQty: 248,
      gmvAmount: 59272,
      ownerName: '小美',
      legacyProjectRef: 'PRJ-20251216-011',
      legacyProjectId: 'PRJ-20251216-011',
    },
    {
      videoRecordId: 'SV-PJT-012',
      videoRecordCode: 'SV-PJT-012',
      videoTitle: '快反撞色卫衣套装短视频测款',
      channelName: 'TikTok / 快反内容号',
      businessDate: '2026-04-02',
      publishedAt: '2026-04-02 18:20',
      recordStatus: '已关账',
      styleCode: 'SPU-HOODIE-082',
      spuCode: 'SPU-HOODIE-082',
      skuCode: 'SPU-HOODIE-082-L-BLACK',
      colorCode: 'BLACK',
      sizeCode: 'L',
      exposureQty: 54800,
      clickQty: 3280,
      orderQty: 156,
      gmvAmount: 31044,
      ownerName: '李娜',
      legacyProjectRef: null,
      legacyProjectId: null,
    },
    {
      videoRecordId: 'SV-PJT-015',
      videoRecordCode: 'SV-PJT-015',
      videoTitle: '设计款中式结饰上衣短视频复盘',
      channelName: '抖音 / 设计验证号',
      businessDate: '2026-04-06',
      publishedAt: '2026-04-06 10:40',
      recordStatus: '已关账',
      styleCode: 'SPU-2024-005',
      spuCode: 'SPU-2024-005',
      skuCode: 'SPU-2024-005-M-RED',
      colorCode: 'RED',
      sizeCode: 'M',
      exposureQty: 47600,
      clickQty: 2850,
      orderQty: 138,
      gmvAmount: 44022,
      ownerName: '赵云',
      legacyProjectRef: 'PRJ-20251216-015',
      legacyProjectId: 'PRJ-20251216-015',
    },
    {
      videoRecordId: 'SV-PJT-018',
      videoRecordCode: 'SV-PJT-018',
      videoTitle: '设计款印花阔腿连体裤改版测款',
      channelName: '抖音 / 设计验证号',
      businessDate: '2026-04-01',
      publishedAt: '2026-04-01 17:00',
      recordStatus: '已关账',
      styleCode: 'SPU-2026-018',
      spuCode: 'SPU-2026-018',
      skuCode: 'SPU-2026-018-M-MULTI',
      colorCode: 'MULTI',
      sizeCode: 'M',
      exposureQty: 21800,
      clickQty: 930,
      orderQty: 26,
      gmvAmount: 9334,
      ownerName: '李娜',
      legacyProjectRef: 'PRJ-20251216-018',
      legacyProjectId: 'PRJ-20251216-018',
    },
    {
      videoRecordId: 'SV-PJT-019',
      videoRecordCode: 'SV-PJT-019',
      videoTitle: '基础款针织开衫测款复盘',
      channelName: '抖音 / 基础款内容号',
      businessDate: '2026-04-02',
      publishedAt: '2026-04-02 14:00',
      recordStatus: '已关账',
      styleCode: 'SPU-2026-019',
      spuCode: 'SPU-2026-019',
      skuCode: 'SPU-2026-019-L-BEIGE',
      colorCode: 'BEIGE',
      sizeCode: 'L',
      exposureQty: 14400,
      clickQty: 610,
      orderQty: 14,
      gmvAmount: 2506,
      ownerName: '小雅',
      legacyProjectRef: 'PRJ-20251216-019',
      legacyProjectId: 'PRJ-20251216-019',
    },
    {
      videoRecordId: 'SV-PJT-022',
      videoRecordCode: 'SV-PJT-022',
      videoTitle: '设计款民族印花半裙测款复盘',
      channelName: 'TikTok / 设计验证号',
      businessDate: '2026-04-04',
      publishedAt: '2026-04-04 20:10',
      recordStatus: '已关账',
      styleCode: 'SPU-2026-022',
      spuCode: 'SPU-2026-022',
      skuCode: 'SPU-2026-022-M-MULTI',
      colorCode: 'MULTI',
      sizeCode: 'M',
      exposureQty: 12100,
      clickQty: 520,
      orderQty: 10,
      gmvAmount: 2690,
      ownerName: '赵云',
      legacyProjectRef: 'PRJ-20251216-022',
      legacyProjectId: 'PRJ-20251216-022',
    },
    {
      videoRecordId: 'SV-PJT-024',
      videoRecordCode: 'SV-PJT-024',
      videoTitle: '快反居家套装双渠道测款复盘',
      channelName: '微信视频号 / 居家内容号',
      businessDate: '2026-04-05',
      publishedAt: '2026-04-05 17:30',
      recordStatus: '已关账',
      styleCode: 'SPU-2026-024',
      spuCode: 'SPU-2026-024',
      skuCode: 'SPU-2026-024-L-BEIGE',
      colorCode: 'BEIGE',
      sizeCode: 'L',
      exposureQty: 9800,
      clickQty: 380,
      orderQty: 7,
      gmvAmount: 1085,
      ownerName: '李娜',
      legacyProjectRef: null,
      legacyProjectId: null,
    },
  ]

  return {
    version: VIDEO_TESTING_STORE_VERSION,
    records: [...baseRecords, ...extraRecords],
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
