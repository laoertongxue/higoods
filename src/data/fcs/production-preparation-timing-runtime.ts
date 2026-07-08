import {
  buildPreparationOutputs,
  preparationTypeDefaultItems,
  type PreparationDownloadRecord,
  type PreparationDyeRequirement,
  type PreparationItemType,
  type PreparationMaterialRequirement,
  type PreparationTypeDefaultItem,
  type PreparationUploadRecord,
  type ProductPrepType,
  type ProductionPreparationItem,
  type ProductionPreparationRecord,
} from './production-preparation-timing'

export const PREPARATION_RUNTIME_STORAGE_KEY = 'higood.production-preparation.runtime.v1'

interface ConfirmedPreparationRecord {
  confirmedBy: string
  confirmedAt: string
  confirmedProductPrepType?: ProductPrepType
  selectedItemTypes?: PreparationItemType[]
  overrideReason?: string
  selectedItemIds?: string[]
  materialRequirement?: PreparationMaterialRequirement
  sampleRequirementText?: string
  confirmationRemark?: string
}

type RuntimeSelection =
  | { overridden: false }
  | { overridden: true; itemTypes?: Set<PreparationItemType>; itemIds?: Set<string> }

export interface PreparationRuntimeState {
  confirmedRecords: Record<string, ConfirmedPreparationRecord>
  uploads: PreparationUploadRecord[]
  downloads: PreparationDownloadRecord[]
  dyeRequirements: Record<string, PreparationDyeRequirement>
}

export const EMPTY_PREPARATION_RUNTIME_STATE: PreparationRuntimeState = {
  confirmedRecords: {},
  uploads: [],
  downloads: [],
  dyeRequirements: {},
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
      dyeRequirements: parsed.dyeRequirements ?? {},
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
    const selection = resolveRuntimeSelection(confirmation)
    const workItemsConfirmedBy = confirmation?.confirmedBy ?? record.workItemsConfirmedBy
    const workItemsConfirmedAt = confirmation?.confirmedAt ?? record.workItemsConfirmedAt
    const confirmedProductPrepType = confirmation?.confirmedProductPrepType ?? record.confirmedProductPrepType
    const sourceItems = buildRuntimeTemplateItems(record, confirmation, selection, confirmedProductPrepType)
    const items = sourceItems.map((item) => mergePreparationRuntimeItem(item, runtime, selection))
    const prepTypeSource = confirmation?.confirmedProductPrepType
      ? confirmation.confirmedProductPrepType === record.derivedProductPrepType ? '系统推导' : '人工修正'
      : record.prepTypeSource
    const prepTypeOverrideReason = confirmation?.confirmedProductPrepType
      ? confirmation.overrideReason ?? ''
      : record.prepTypeOverrideReason
    const selectionOverridden = selection.overridden
    const hasRuntimeUpload = runtime.uploads.some((upload) => upload.recordId === record.recordId)
    const runtimeOutputReady = isRuntimeOutputReady(items, workItemsConfirmedBy, workItemsConfirmedAt)
    const outputReady = selectionOverridden
      ? runtimeOutputReady
      : record.outputReady || (hasRuntimeUpload && runtimeOutputReady)
    const productionDemandNo = selectionOverridden && outputReady
      ? record.productionDemandNo || runtimeProductionDemandNo(record.recordNo)
      : record.productionDemandNo
    const productionOrderNo = selectionOverridden && outputReady
      ? record.productionOrderNo || runtimeProductionOrderNo(record.recordNo)
      : record.productionOrderNo
    const outputPublishedAt = outputReady
      ? record.outputPublishedAt || latestCompletionEvidenceAt(items)
      : selectionOverridden ? '' : record.outputPublishedAt
    return {
      ...record,
      confirmedProductPrepType,
      prepTypeSource,
      prepTypeConfirmedBy: confirmation?.confirmedBy ?? record.prepTypeConfirmedBy,
      prepTypeConfirmedAt: confirmation?.confirmedAt ?? record.prepTypeConfirmedAt,
      prepTypeOverrideReason,
      materialRequirement: confirmation?.materialRequirement ?? record.materialRequirement,
      sampleRequirementText: confirmation?.sampleRequirementText ?? record.sampleRequirementText,
      confirmationRemark: confirmation?.confirmationRemark ?? record.confirmationRemark,
      workItemsConfirmedBy,
      workItemsConfirmedAt,
      productionDemandNo,
      productionOrderNo,
      outputReady,
      outputPublishedAt,
      outputs: buildPreparationOutputs({
        recordNo: record.recordNo,
        productionDemandNo,
        productionOrderNo,
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

function resolveRuntimeSelection(confirmation?: ConfirmedPreparationRecord): RuntimeSelection {
  if (Array.isArray(confirmation?.selectedItemTypes)) {
    return { overridden: true, itemTypes: new Set(confirmation.selectedItemTypes) }
  }
  if (Array.isArray(confirmation?.selectedItemIds)) {
    return { overridden: true, itemIds: new Set(confirmation.selectedItemIds) }
  }
  return { overridden: false }
}

function runtimeDocumentSuffix(recordNo: string): string {
  return recordNo.replace(/^PREP-/, '') || recordNo
}

function runtimeProductionDemandNo(recordNo: string): string {
  return `PD-${runtimeDocumentSuffix(recordNo)}`
}

function runtimeProductionOrderNo(recordNo: string): string {
  return `PO-${runtimeDocumentSuffix(recordNo)}`
}

function buildRuntimeTemplateItems(
  record: ProductionPreparationRecord,
  confirmation: ConfirmedPreparationRecord | undefined,
  selection: RuntimeSelection,
  confirmedProductPrepType: ProductPrepType,
): ProductionPreparationItem[] {
  if (!selection.overridden || !selection.itemTypes) return record.items
  const templateItems = preparationTypeDefaultItems[confirmedProductPrepType] ?? []
  const existingByType = new Map(record.items.map((item) => [item.itemType, item]))
  const generatedItems = templateItems
    .filter((item) => !existingByType.has(item.itemType))
    .map((item) => createRuntimeTemplateItem(record, confirmation, selection, item, existingByType, templateItems))
  const items = [...record.items, ...generatedItems]
  const itemsByType = new Map(items.map((item) => [item.itemType, item]))
  const templateTypes = new Set(templateItems.map((item) => item.itemType))
  return items.map((item) => templateTypes.has(item.itemType)
    ? {
        ...item,
        dependsOnItemIds: runtimeDependencyTypes(item.itemType, templateItems)
          .map((itemType) => itemIdForType(record, itemsByType, itemType)),
      }
    : item)
}

function runtimeTemplateItemId(recordId: string, itemType: PreparationItemType): string {
  return `${recordId}-runtime-${itemType}`
}

function itemIdForType(
  record: ProductionPreparationRecord,
  existingByType: Map<PreparationItemType, ProductionPreparationItem>,
  itemType: PreparationItemType,
): string {
  return existingByType.get(itemType)?.itemId ?? runtimeTemplateItemId(record.recordId, itemType)
}

function runtimeDependencyTypes(
  itemType: PreparationItemType,
  templateItems: PreparationTypeDefaultItem[],
): PreparationItemType[] {
  const templateTypes = new Set(templateItems.map((item) => item.itemType))
  if (itemType === '版衣制作') {
    return (['毛织基码纸样', '梭织基码纸样'] as const).filter((type) => templateTypes.has(type))
  }
  if (itemType === '毛织齐码纸样' || itemType === '梭织齐码纸样') {
    return templateTypes.has('版衣制作') ? ['版衣制作'] : []
  }
  if (itemType === '染色调色（纱线）') {
    return templateTypes.has('确认染色要求（纱线）') ? ['确认染色要求（纱线）'] : []
  }
  if (itemType === '染色调色（面料）') {
    return templateTypes.has('确认染色要求（面料）') ? ['确认染色要求（面料）'] : []
  }
  return []
}

function runtimeItemLayout(
  itemType: PreparationItemType,
  templateItems: PreparationTypeDefaultItem[],
): Pick<ProductionPreparationItem, 'sequenceGroup' | 'parallelGroup' | 'ownerTeam' | 'ownerName'> {
  const hasWoolBase = templateItems.some((item) => item.itemType === '毛织基码纸样')
  const hasWovenBase = templateItems.some((item) => item.itemType === '梭织基码纸样')
  if (itemType === '毛织基码纸样') return { sequenceGroup: hasWovenBase ? '双基码并行' : '毛织主线', parallelGroup: '毛织基码', ownerTeam: '毛织团队', ownerName: '待分配' }
  if (itemType === '梭织基码纸样') return { sequenceGroup: hasWoolBase ? '双基码并行' : '梭织主线', parallelGroup: '梭织基码', ownerTeam: '版师团队', ownerName: '待分配' }
  if (itemType === '版衣制作') return { sequenceGroup: hasWoolBase && hasWovenBase ? '混合主线' : hasWoolBase ? '毛织主线' : '梭织主线', parallelGroup: '版衣', ownerTeam: '车板团队', ownerName: '待接单' }
  if (itemType === '毛织齐码纸样') return { sequenceGroup: hasWovenBase ? '双齐码并行' : '毛织主线', parallelGroup: '毛织齐码', ownerTeam: '毛织团队', ownerName: '待分配' }
  if (itemType === '梭织齐码纸样') return { sequenceGroup: hasWoolBase ? '双齐码并行' : '梭织主线', parallelGroup: '梭织齐码', ownerTeam: '版师团队', ownerName: '待分配' }
  if (itemType === '数码印/DTF/DTG花型') return { sequenceGroup: '花型并行', parallelGroup: '花型', ownerTeam: '花型团队', ownerName: '待分配' }
  if (itemType === '确认染色要求（纱线）') return { sequenceGroup: '染色并行', parallelGroup: '纱线染色', ownerTeam: '跟单角色', ownerName: '待确认' }
  if (itemType === '染色调色（纱线）') return { sequenceGroup: '染色并行', parallelGroup: '纱线染色', ownerTeam: '染色团队', ownerName: '待接单' }
  if (itemType === '确认染色要求（面料）') return { sequenceGroup: '染色并行', parallelGroup: '面料染色', ownerTeam: '跟单角色', ownerName: '待确认' }
  if (itemType === '染色调色（面料）') return { sequenceGroup: '染色并行', parallelGroup: '面料染色', ownerTeam: '染色团队', ownerName: '待接单' }
  return { sequenceGroup: '辅料并行', parallelGroup: '主辅料', ownerTeam: '采购团队', ownerName: '待接单' }
}

function createRuntimeTemplateItem(
  record: ProductionPreparationRecord,
  confirmation: ConfirmedPreparationRecord | undefined,
  selection: Extract<RuntimeSelection, { overridden: true; itemTypes: Set<PreparationItemType> }>,
  templateItem: PreparationTypeDefaultItem,
  existingByType: Map<PreparationItemType, ProductionPreparationItem>,
  templateItems: PreparationTypeDefaultItem[],
): ProductionPreparationItem {
  const selected = selection.itemTypes.has(templateItem.itemType)
  const required = templateItem.defaultSelected && !templateItem.canUnselect
  const selectedAt = selected ? confirmation?.confirmedAt ?? record.workItemsConfirmedAt ?? record.enteredAt : ''
  const layout = runtimeItemLayout(templateItem.itemType, templateItems)
  const sourceObjectNo = record.productionOrderNo || record.recordNo
  return {
    itemId: runtimeTemplateItemId(record.recordId, templateItem.itemType),
    recordId: record.recordId,
    itemType: templateItem.itemType,
    required,
    requiredKind: required ? '必做' : '选填',
    selectedByMerchandiser: selected,
    selectedAt,
    ...layout,
    dependsOnItemIds: runtimeDependencyTypes(templateItem.itemType, templateItems)
      .map((itemType) => itemIdForType(record, existingByType, itemType)),
    status: selected ? '待开始' : '待判断',
    plannedStartAt: record.enteredAt,
    plannedFinishAt: record.expectedFinishAt,
    actualFinishAt: '',
    evidenceType: '跟单确认',
    evidenceSummary: selected ? '跟单切换商品类型后生成的准备项，待上传完成凭证' : '跟单切换商品类型后生成的可选准备项',
    sourceObjectType: record.productionOrderNo ? '生产单' : '生产准备记录',
    sourceObjectNo,
    sourceHref: record.productionOrderNo
      ? `/fcs/production/orders?keyword=${encodeURIComponent(record.productionOrderNo)}`
      : `/fcs/production/preparation-timing?recordId=${encodeURIComponent(record.recordId)}`,
    overdueHours: 0,
    remark: 'runtime 类型模板生成',
    uploads: [],
    downloads: [],
    ...(templateItem.itemType === '数码印/DTF/DTG花型'
      ? { completionImageIds: [], patternFileIds: [], buyerReviewStatus: '未提交' as const }
      : {}),
  }
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
  selection: RuntimeSelection,
): ProductionPreparationItem {
  const uploads = runtime.uploads.filter((upload) => upload.itemId === item.itemId)
  const downloads = runtime.downloads.filter((download) => download.itemId === item.itemId)
  const dyeRequirement = runtime.dyeRequirements[item.itemId] ?? item.dyeRequirement
  const selectedByMerchandiser = selection.overridden
    ? selection.itemTypes
      ? selection.itemTypes.has(item.itemType)
      : item.requiredKind === '必做' || Boolean(selection.itemIds?.has(item.itemId))
    : item.selectedByMerchandiser
  if (!uploads.length && !downloads.length && !selection.overridden && dyeRequirement === item.dyeRequirement) return item
  const lastUpload = uploads.slice().sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))[0]
  return {
    ...item,
    dyeRequirement,
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
