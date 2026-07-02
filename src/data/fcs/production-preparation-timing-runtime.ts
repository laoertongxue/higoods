import {
  buildPreparationOutputs,
  type PreparationDownloadRecord,
  type PreparationItemType,
  type PreparationUploadRecord,
  type ProductionPreparationItem,
  type ProductionPreparationRecord,
} from './production-preparation-timing'

export const PREPARATION_RUNTIME_STORAGE_KEY = 'higood.production-preparation.runtime.v1'

interface ConfirmedPreparationRecord {
  confirmedBy: string
  confirmedAt: string
  selectedItemIds?: string[]
}

export interface PreparationRuntimeState {
  confirmedRecords: Record<string, ConfirmedPreparationRecord>
  uploads: PreparationUploadRecord[]
  downloads: PreparationDownloadRecord[]
}

export const EMPTY_PREPARATION_RUNTIME_STATE: PreparationRuntimeState = {
  confirmedRecords: {},
  uploads: [],
  downloads: [],
}

export function isBasePatternItem(itemType: PreparationItemType): boolean {
  return itemType === '梭织基码纸样' || itemType === '毛织基码纸样'
}

export function nowIsoMinute(): string {
  return new Date().toISOString().slice(0, 16)
}

export function createLocalId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function loadPreparationRuntimeState(): PreparationRuntimeState {
  try {
    const raw = window.localStorage.getItem(PREPARATION_RUNTIME_STORAGE_KEY)
    if (!raw) return EMPTY_PREPARATION_RUNTIME_STATE
    const parsed = JSON.parse(raw) as Partial<PreparationRuntimeState>
    return {
      confirmedRecords: parsed.confirmedRecords ?? {},
      uploads: Array.isArray(parsed.uploads) ? parsed.uploads : [],
      downloads: Array.isArray(parsed.downloads) ? parsed.downloads : [],
    }
  } catch {
    return EMPTY_PREPARATION_RUNTIME_STATE
  }
}

export function savePreparationRuntimeState(state: PreparationRuntimeState): void {
  window.localStorage.setItem(PREPARATION_RUNTIME_STORAGE_KEY, JSON.stringify(state))
}

export function mergePreparationRuntimeRecords(
  records: ProductionPreparationRecord[],
  runtime: PreparationRuntimeState,
): ProductionPreparationRecord[] {
  return records.map((record) => {
    const confirmation = runtime.confirmedRecords[record.recordId]
    const items = record.items.map((item) => mergePreparationRuntimeItem(item, runtime, confirmation?.selectedItemIds))
    const workItemsConfirmedBy = confirmation?.confirmedBy ?? record.workItemsConfirmedBy
    const workItemsConfirmedAt = confirmation?.confirmedAt ?? record.workItemsConfirmedAt
    const hasRuntimeUpload = runtime.uploads.some((upload) => upload.recordId === record.recordId)
    const outputReady = record.outputReady || (hasRuntimeUpload && isRuntimeOutputReady(items, workItemsConfirmedBy, workItemsConfirmedAt))
    const outputPublishedAt = outputReady
      ? record.outputPublishedAt || latestCompletionEvidenceAt(items)
      : record.outputPublishedAt
    return {
      ...record,
      workItemsConfirmedBy,
      workItemsConfirmedAt,
      outputReady,
      outputPublishedAt,
      outputs: buildPreparationOutputs({
        recordNo: record.recordNo,
        productionDemandNo: record.productionDemandNo,
        productionOrderNo: record.productionOrderNo,
        outputReady,
        outputPublishedAt,
        workItemsConfirmedBy,
        workItemsConfirmedAt,
        items,
      }),
      items,
    }
  })
}

function isSelectedPreparationItem(item: ProductionPreparationItem): boolean {
  return item.selectedByMerchandiser !== false && item.status !== '无需'
}

function hasUploadEvidence(upload: PreparationUploadRecord): boolean {
  return Boolean(upload.fileName && upload.uploadedAt && upload.uploadedBy)
}

function hasCompletionEvidence(item: ProductionPreparationItem): boolean {
  return Boolean(
    item.status === '已完成' &&
      item.actualFinishAt &&
      item.uploads?.some(hasUploadEvidence),
  )
}

function isRuntimeOutputReady(
  items: ProductionPreparationItem[],
  workItemsConfirmedBy: string,
  workItemsConfirmedAt: string,
): boolean {
  if (!(workItemsConfirmedBy && workItemsConfirmedAt)) return false
  const selectedItems = items.filter(isSelectedPreparationItem)
  return selectedItems.length > 0 && selectedItems.every(hasCompletionEvidence)
}

function latestCompletionEvidenceAt(items: ProductionPreparationItem[]): string {
  return items
    .filter(isSelectedPreparationItem)
    .flatMap((item) => [
      item.actualFinishAt,
      ...(item.uploads ?? []).filter(hasUploadEvidence).map((upload) => upload.uploadedAt),
    ])
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left))[0] ?? ''
}

function mergePreparationRuntimeItem(
  item: ProductionPreparationItem,
  runtime: PreparationRuntimeState,
  selectedItemIds?: string[],
): ProductionPreparationItem {
  const uploads = runtime.uploads.filter((upload) => upload.itemId === item.itemId)
  const downloads = runtime.downloads.filter((download) => download.itemId === item.itemId)
  const selectionOverridden = Array.isArray(selectedItemIds)
  const selectedByMerchandiser = selectionOverridden
    ? item.requiredKind === '必做' || selectedItemIds.includes(item.itemId)
    : item.selectedByMerchandiser
  if (!uploads.length && !downloads.length && !selectionOverridden) return item
  const lastUpload = uploads.slice().sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))[0]
  return {
    ...item,
    selectedByMerchandiser,
    status: !selectedByMerchandiser ? '无需' : lastUpload ? '已完成' : item.status,
    actualFinishAt: lastUpload?.uploadedAt ?? item.actualFinishAt,
    evidenceSummary: lastUpload ? `最后上传：${lastUpload.fileName}` : item.evidenceSummary,
    uploads: [...(item.uploads ?? []), ...uploads],
    downloads: [...(item.downloads ?? []), ...downloads],
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error ?? new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

export async function buildUploadRecordsFromFiles(input: {
  recordId: string
  itemId: string
  itemType: PreparationItemType
  files: File[]
  uploadedBy: string
  note: string
}): Promise<PreparationUploadRecord[]> {
  const uploadedAt = nowIsoMinute()
  const records: PreparationUploadRecord[] = []
  for (const file of input.files) {
    records.push({
      uploadId: createLocalId('upload'),
      recordId: input.recordId,
      itemId: input.itemId,
      itemType: input.itemType,
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
      fileDataUrl: await readFileAsDataUrl(file),
      uploadedBy: input.uploadedBy,
      uploadedAt,
      note: input.note,
    })
  }
  return records
}

export function appendDownloadRecord(
  runtime: PreparationRuntimeState,
  input: {
    recordId: string
    itemId: string
    uploadId: string
    fileName: string
    downloadedBy: string
  },
): PreparationRuntimeState {
  return {
    ...runtime,
    downloads: [
      ...runtime.downloads,
      {
        downloadId: createLocalId('download'),
        recordId: input.recordId,
        itemId: input.itemId,
        uploadId: input.uploadId,
        fileName: input.fileName,
        downloadedBy: input.downloadedBy,
        downloadedAt: nowIsoMinute(),
      },
    ],
  }
}
