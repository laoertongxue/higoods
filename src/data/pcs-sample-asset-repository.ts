import type { SampleAssetRecord, SampleAssetStoreSnapshot } from './pcs-sample-types.ts'

const SAMPLE_ASSET_STORAGE_KEY = 'higood-pcs-sample-assets-v1'
const SAMPLE_ASSET_STORE_VERSION = 1

let memorySnapshot: SampleAssetStoreSnapshot | null = null

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function cloneAsset(asset: SampleAssetRecord): SampleAssetRecord {
  return { ...asset }
}

function cloneSnapshot(snapshot: SampleAssetStoreSnapshot): SampleAssetStoreSnapshot {
  return {
    version: snapshot.version,
    assets: snapshot.assets.map(cloneAsset),
  }
}

function emptySnapshot(): SampleAssetStoreSnapshot {
  return {
    version: SAMPLE_ASSET_STORE_VERSION,
    assets: [],
  }
}

function normalizeAsset(asset: SampleAssetRecord): SampleAssetRecord {
  return {
    ...cloneAsset(asset),
    projectId: asset.projectId || '',
    projectCode: asset.projectCode || '',
    projectName: asset.projectName || '',
    projectNodeId: asset.projectNodeId || '',
    workItemTypeCode: asset.workItemTypeCode || '',
    workItemTypeName: asset.workItemTypeName || '',
    sourceDocType: asset.sourceDocType || '',
    sourceDocId: asset.sourceDocId || '',
    sourceDocCode: asset.sourceDocCode || '',
    lastEventId: asset.lastEventId || '',
    lastEventType: asset.lastEventType || '',
    lastEventTime: asset.lastEventTime || '',
    legacyProjectRef: asset.legacyProjectRef || '',
    legacyWorkItemInstanceId: asset.legacyWorkItemInstanceId || '',
  }
}

function hydrateSnapshot(snapshot: SampleAssetStoreSnapshot): SampleAssetStoreSnapshot {
  return {
    version: SAMPLE_ASSET_STORE_VERSION,
    assets: Array.isArray(snapshot.assets) ? snapshot.assets.map(normalizeAsset) : [],
  }
}

function loadSnapshot(): SampleAssetStoreSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)
  if (!canUseStorage()) {
    memorySnapshot = emptySnapshot()
    return cloneSnapshot(memorySnapshot)
  }

  try {
    const raw = localStorage.getItem(SAMPLE_ASSET_STORAGE_KEY)
    if (!raw) {
      memorySnapshot = emptySnapshot()
      localStorage.setItem(SAMPLE_ASSET_STORAGE_KEY, JSON.stringify(memorySnapshot))
      return cloneSnapshot(memorySnapshot)
    }
    const parsed = JSON.parse(raw) as Partial<SampleAssetStoreSnapshot>
    memorySnapshot = hydrateSnapshot({
      version: SAMPLE_ASSET_STORE_VERSION,
      assets: Array.isArray(parsed.assets) ? (parsed.assets as SampleAssetRecord[]) : [],
    })
    localStorage.setItem(SAMPLE_ASSET_STORAGE_KEY, JSON.stringify(memorySnapshot))
    return cloneSnapshot(memorySnapshot)
  } catch {
    memorySnapshot = emptySnapshot()
    if (canUseStorage()) {
      localStorage.setItem(SAMPLE_ASSET_STORAGE_KEY, JSON.stringify(memorySnapshot))
    }
    return cloneSnapshot(memorySnapshot)
  }
}

function persistSnapshot(snapshot: SampleAssetStoreSnapshot): void {
  memorySnapshot = hydrateSnapshot(snapshot)
  if (canUseStorage()) {
    localStorage.setItem(SAMPLE_ASSET_STORAGE_KEY, JSON.stringify(memorySnapshot))
  }
}

export function listSampleAssets(): SampleAssetRecord[] {
  return loadSnapshot().assets.map(cloneAsset).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getSampleAssetById(sampleAssetId: string): SampleAssetRecord | null {
  const asset = loadSnapshot().assets.find((item) => item.sampleAssetId === sampleAssetId)
  return asset ? cloneAsset(asset) : null
}

export function getSampleAssetByCode(sampleCode: string): SampleAssetRecord | null {
  const asset = loadSnapshot().assets.find((item) => item.sampleCode === sampleCode)
  return asset ? cloneAsset(asset) : null
}

export function upsertSampleAsset(asset: SampleAssetRecord): SampleAssetRecord {
  const snapshot = loadSnapshot()
  const filtered = snapshot.assets.filter((item) => item.sampleAssetId !== asset.sampleAssetId)
  const nextAsset = normalizeAsset(asset)
  persistSnapshot({
    version: SAMPLE_ASSET_STORE_VERSION,
    assets: [nextAsset, ...filtered],
  })
  return cloneAsset(nextAsset)
}

export function replaceSampleAssetStore(assets: SampleAssetRecord[]): void {
  persistSnapshot({
    version: SAMPLE_ASSET_STORE_VERSION,
    assets,
  })
}

export function resetSampleAssetRepository(): void {
  persistSnapshot(emptySnapshot())
  if (canUseStorage()) {
    localStorage.removeItem(SAMPLE_ASSET_STORAGE_KEY)
  }
}
