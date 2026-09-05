import { getBrowserLocalStorage, readBrowserStorageItem, writeBrowserStorageItem } from '../../browser-storage.ts'
import type { MarkerPlan, MarkerSchemeBed } from '../../../pages/process-factory/cutting/marker-plan-domain.ts'
import {
  FEI_TICKET_MANUAL_SOURCE_BASIS,
  FEI_TICKET_MANUAL_SOURCE_BASIS_TYPE,
  formatFeiTicketSpecialCraftDisplayLabel,
  resolveFeiTicketSpecialCraftsForPart,
  type GeneratedFeiTicketSourceRecord,
} from './generated-fei-tickets.ts'
import { encodeFeiTicketQr } from './qr-codes.ts'
import { CUTTING_MANUAL_FEI_TICKET_SOURCES_STORAGE_KEY } from './storage/fei-tickets-storage.ts'

export interface ManualFeiTicketOperationLog {
  logId: string
  feiTicketId: string
  manualBatchId: string
  action: '手动批量建票' | '新增菲票' | '修改数量' | '删除未打印菲票' | '打印菲票' | '补打菲票'
  detail: string
  operatedAt: string
  operatedBy: string
}

export interface ManualFeiTicketStore {
  records: GeneratedFeiTicketSourceRecord[]
  operationLogs: ManualFeiTicketOperationLog[]
}

export interface CreateManualFeiTicketBatchInput {
  markerPlan: MarkerPlan
  markerMember: MarkerSchemeBed
  layerCount: number
  sizePiecePerLayer: Record<string, number>
  createdAt?: string
  createdBy: string
  remark?: string
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim()
}

function normalizePositiveInteger(value: unknown, fallback = 0): number {
  const numeric = Math.floor(Number(value || 0))
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(normalizeText).filter(Boolean)))
}

function stableToken(value: string): string {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
  return Math.abs(hash).toString(36).toUpperCase()
}

function emptyStore(): ManualFeiTicketStore {
  return { records: [], operationLogs: [] }
}

export function deserializeManualFeiTicketStore(raw: string | null): ManualFeiTicketStore {
  if (!raw) return emptyStore()
  try {
    const parsed = JSON.parse(raw) as Partial<ManualFeiTicketStore> | GeneratedFeiTicketSourceRecord[]
    if (Array.isArray(parsed)) return { records: parsed, operationLogs: [] }
    return {
      records: Array.isArray(parsed.records) ? parsed.records : [],
      operationLogs: Array.isArray(parsed.operationLogs) ? parsed.operationLogs : [],
    }
  } catch {
    return emptyStore()
  }
}

export function serializeManualFeiTicketStore(store: ManualFeiTicketStore): string {
  return JSON.stringify(store)
}

export function readManualFeiTicketStore(): ManualFeiTicketStore {
  return deserializeManualFeiTicketStore(
    readBrowserStorageItem(getBrowserLocalStorage(), CUTTING_MANUAL_FEI_TICKET_SOURCES_STORAGE_KEY),
  )
}

export function persistManualFeiTicketStore(store: ManualFeiTicketStore): boolean {
  return writeBrowserStorageItem(
    getBrowserLocalStorage(),
    CUTTING_MANUAL_FEI_TICKET_SOURCES_STORAGE_KEY,
    serializeManualFeiTicketStore(store),
  )
}

export function listManualFeiTicketSources(): GeneratedFeiTicketSourceRecord[] {
  return readManualFeiTicketStore().records
    .filter((record) => record.sourceBasisType === FEI_TICKET_MANUAL_SOURCE_BASIS_TYPE)
    .sort((left, right) => right.issuedAt.localeCompare(left.issuedAt) || left.feiTicketNo.localeCompare(right.feiTicketNo))
}

export function listManualFeiTicketOperationLogs(feiTicketId?: string): ManualFeiTicketOperationLog[] {
  return readManualFeiTicketStore().operationLogs
    .filter((log) => !feiTicketId || log.feiTicketId === feiTicketId)
    .sort((left, right) => right.operatedAt.localeCompare(left.operatedAt))
}

function resolveMarkerSource(plan: MarkerPlan, cutOrderId: string) {
  return plan.selectedSourceCutOrderRows?.find((row) => row.cutOrderId === cutOrderId)
    || plan.selectedSourceCutOrderRows?.[0]
    || null
}

function buildManualTicketRecord(options: {
  input: CreateManualFeiTicketBatchInput
  batchId: string
  row: MarkerPlan['pieceExplosionRows'][number]
  partInstanceNo: number
  garmentQty: number
  index: number
  issuedAt: string
}): GeneratedFeiTicketSourceRecord {
  const { input, batchId, row, partInstanceNo, garmentQty, index, issuedAt } = options
  const source = resolveMarkerSource(input.markerPlan, row.sourceCutOrderId)
  const cutOrderId = normalizeText(row.sourceCutOrderId || source?.cutOrderId || input.markerPlan.cutOrderIds[0])
  const cutOrderNo = normalizeText(row.sourceCutOrderNo || source?.cutOrderNo || input.markerPlan.cutOrderNos[0])
  const productionOrderId = normalizeText(
    row.sourceProductionOrderId || source?.productionOrderId || input.markerPlan.productionOrderIds[0],
  )
  const productionOrderNo = normalizeText(
    row.sourceProductionOrderNo || source?.productionOrderNo || input.markerPlan.productionOrderNos[0],
  )
  const markerNo = normalizeText(input.markerPlan.markerNo || input.markerPlan.markerPlanNo)
  const memberNo = normalizeText(input.markerMember.bedNo || input.markerMember.bedName || input.markerMember.bedId)
  const partInstanceLabel = Math.max(row.piecePerGarment, 1) > 1 ? String(partInstanceNo) : ''
  const sourceOutputLineId = `${batchId}-${row.id}-${partInstanceNo}`
  const feiTicketId = `manual-fei-${stableToken(sourceOutputLineId)}`
  const feiTicketNo = `TM-${stableToken(markerNo).slice(0, 5)}-${stableToken(batchId).slice(0, 5)}-${String(index + 1).padStart(3, '0')}`
  const size = normalizeText(row.sizeCode) || '均码'
  const color = normalizeText(row.colorCode || input.markerMember.colorCode || input.markerMember.colorName) || '颜色待补'
  const skuCode = normalizeText(row.skuCode) || `${input.markerPlan.spuCode}-${color}-${size}`
  const partCode = normalizeText(row.partCode || row.partNameCn) || '部位待补'
  const partName = normalizeText(row.partNameCn || row.partNameId || row.partCode) || '部位待补'
  const qty = Math.max(garmentQty, 1)
  const specialCrafts = resolveFeiTicketSpecialCraftsForPart({
    outputLineId: sourceOutputLineId,
    productionOrderId,
    partCode,
    partName,
    sizeCode: size,
    actualCutPieceQty: qty,
    bundleQty: qty,
  })
  const secondaryCrafts = unique(specialCrafts.map((craft) => craft.craftName))
  const assemblyGroupKey = [batchId, color, size, 'B01'].join('::')
  const pieceScope = unique([markerNo, memberNo, color, size, partName])
  const pieceGroup = partName
  const bundleScope = `${markerNo}-${memberNo}-${color}-${size}-B01`
  const materialIdentity = {
    materialSku: normalizeText(row.materialSku || input.markerPlan.sourceMaterialSku || input.markerPlan.materialSkuSummary),
    materialName: normalizeText(source?.materialName || row.materialAlias || row.materialSku) || '物料待补',
    materialColor: color,
    materialAlias: normalizeText(row.materialAlias || source?.materialAlias || row.materialSku) || '物料待补',
    materialImageUrl: normalizeText(row.materialImageUrl || source?.materialImageUrl),
    materialUnit: '米',
  } as const
  const patternIdentity = {
    patternFileId: normalizeText(source?.patternFileId),
    patternFileName: normalizeText(source?.patternFileName || row.patternCode) || '纸样待补',
    patternVersion: normalizeText(source?.patternVersion || input.markerPlan.techPackVersion) || '待补',
    patternKind: '生产纸样',
    effectiveWidthValue: Number(source?.effectiveWidthText.match(/\d+(?:\.\d+)?/)?.[0] || 0),
    effectiveWidthUnit: 'cm',
    piecePartCodes: [partCode],
    piecePartNames: [partName],
  } as const
  const qrPayloadInput = {
    feiTicketId,
    feiTicketNo,
    cutOrderId,
    cutOrderNo,
    productionOrderId,
    productionOrderNo,
    markerPlanId: input.markerPlan.markerPlanId || input.markerPlan.id,
    markerPlanNo: input.markerPlan.markerPlanNo,
    markerNumber: markerNo,
    bedNo: memberNo,
    spreadingOrderId: '',
    spreadingOrderNo: '无铺布单',
    spuCode: input.markerPlan.spuCode,
    styleName: input.markerPlan.styleName,
    color,
    size,
    sourceOutputLineId,
    fabricRollId: '',
    fabricRollNo: '无布卷',
    fabricColor: color,
    materialSku: materialIdentity.materialSku,
    garmentSkuId: skuCode,
    garmentColor: color,
    applicableSkuCodes: [skuCode],
    applicableSkuLabel: skuCode,
    assemblyGroupKey,
    siblingPartTicketNos: [] as string[],
    pieceScope,
    pieceGroup,
    bundleScope,
    skuColor: color,
    skuSize: size,
    partCode,
    partName,
    garmentInstanceNo: 1,
    layerCount: input.layerCount,
    businessSizeLabel: `${size}-${input.layerCount}层`,
    partQuantityPerGarment: Math.max(row.piecePerGarment, 1),
    pieceQty: qty,
    garmentQty: qty,
    pieceSequenceLabel: '手动建票（无铺布层序）',
    pieceSequenceStartNo: 0,
    pieceSequenceEndNo: 0,
    bundleNo: 'B01',
    bundleQty: qty,
    pieceSetNoStart: 1,
    pieceSetNoEnd: qty,
    pieceSetNoRange: qty > 1 ? `1-${qty}` : '1',
    bundleTicketType: '手动部位菲票',
    actualCutPieceQty: qty,
    qty,
    hasSpecialCraft: specialCrafts.length > 0,
    specialCrafts: specialCrafts.map((craft) => ({
      craftCategory: craft.craftCategory,
      craftType: craft.craftType,
      receiverFactoryCode: craft.receiverFactoryCode,
      receiverFactoryName: craft.receiverFactoryName,
    })),
    feiTicketVersion: 'V1',
    secondaryCrafts,
    craftSequenceVersion: `${input.markerPlan.techPackVersion || 'v0'}:${secondaryCrafts.length}`,
    currentCraftStage: secondaryCrafts[0] || '',
    issuedAt,
  }
  const encoded = encodeFeiTicketQr(qrPayloadInput)

  return {
    feiTicketId,
    feiTicketNo,
    sourceOutputLineId,
    sourceSpreadingSessionId: '',
    sourceSpreadingSessionNo: '无铺布单',
    sourceMarkerId: input.markerPlan.id,
    sourceMarkerNo: markerNo,
    cutOrderId,
    cutOrderNo,
    productionOrderId,
    productionOrderNo,
    sourceMarkerPlanId: input.markerPlan.markerPlanId || input.markerPlan.id,
    sourceMarkerPlanNo: input.markerPlan.markerPlanNo,
    fabricRollId: '',
    fabricRollNo: '无布卷',
    fabricColor: color,
    materialSku: materialIdentity.materialSku,
    materialIdentity,
    patternIdentity: {
      ...patternIdentity,
      piecePartCodes: [...patternIdentity.piecePartCodes],
      piecePartNames: [...patternIdentity.piecePartNames],
    },
    garmentSkuId: skuCode,
    garmentColor: color,
    applicableSkuCodes: [skuCode],
    applicableSkuLabel: skuCode,
    assemblyGroupKey,
    siblingPartTicketNos: [],
    pieceScope,
    pieceGroup,
    bundleScope,
    skuCode,
    skuColor: color,
    skuSize: size,
    partCode,
    partName,
    partInstanceNo: partInstanceLabel,
    garmentInstanceNo: 1,
    layerCount: input.layerCount,
    businessSizeLabel: `${size}-${input.layerCount}层`,
    partQuantityPerGarment: Math.max(row.piecePerGarment, 1),
    bundleNo: 'B01',
    bundleQty: qty,
    pieceSetNoStart: 1,
    pieceSetNoEnd: qty,
    pieceSetNoRange: qty > 1 ? `1-${qty}` : '1',
    bundleTicketType: '手动部位菲票',
    actualCutPieceQty: qty,
    printStatus: 'WAIT_PRINT',
    qty,
    garmentQty: qty,
    sourceTraceCompleteness: 'COMPLETE',
    secondaryCrafts,
    craftSequenceVersion: qrPayloadInput.craftSequenceVersion,
    currentCraftStage: secondaryCrafts[0] || '',
    hasSpecialCraft: specialCrafts.length > 0,
    specialCrafts,
    specialCraftDisplayLabel: formatFeiTicketSpecialCraftDisplayLabel(specialCrafts),
    pieceSequenceRange: null,
    pieceSequenceLabel: '手动建票（无铺布层序）',
    pieceSequenceCannotGenerateReason: '手动菲票没有铺布执行记录，不生成床次层序。',
    sourceTechPackSpuCode: input.markerPlan.techPackSpu || input.markerPlan.spuCode,
    sourceBasis: FEI_TICKET_MANUAL_SOURCE_BASIS,
    sourceBasisType: FEI_TICKET_MANUAL_SOURCE_BASIS_TYPE,
    markerNumber: markerNo,
    bedNo: memberNo,
    spreadingOrderId: '',
    spreadingOrderNo: '无铺布单',
    issuedAt,
    qrPayload: encoded.payload,
    qrValue: encoded.qrValue,
    manualBatchId: batchId,
    manualMarkerMemberId: input.markerMember.bedId,
    manualCreatedBy: input.createdBy,
    manualUpdatedAt: issuedAt,
    manualUpdatedBy: input.createdBy,
    manualRemark: input.remark || '',
  }
}

function linkSiblingTickets(records: GeneratedFeiTicketSourceRecord[]): GeneratedFeiTicketSourceRecord[] {
  return records.map((record) => {
    const siblingPartTicketNos = records
      .filter((item) => item.assemblyGroupKey === record.assemblyGroupKey && item.feiTicketId !== record.feiTicketId)
      .map((item) => item.feiTicketNo)
    const encoded = encodeFeiTicketQr({ ...record.qrPayload, siblingPartTicketNos })
    return { ...record, siblingPartTicketNos, qrPayload: encoded.payload, qrValue: encoded.qrValue }
  })
}

export function createManualFeiTicketBatch(input: CreateManualFeiTicketBatchInput): {
  batchId: string
  records: GeneratedFeiTicketSourceRecord[]
} {
  const layerCount = normalizePositiveInteger(input.layerCount)
  if (!layerCount) throw new Error('铺布层数必须大于 0。')
  const issuedAt = input.createdAt || new Date().toISOString()
  const batchId = `manual-batch-${stableToken(`${input.markerPlan.id}|${input.markerMember.bedId}|${issuedAt}`)}`
  const memberColor = normalizeText(input.markerMember.colorCode || input.markerMember.colorName)
  const memberMaterial = normalizeText(input.markerMember.materialSku)
  const selectedSizes = Object.entries(input.sizePiecePerLayer)
    .filter(([, qty]) => normalizePositiveInteger(qty) > 0)
    .map(([size]) => normalizeText(size))
  const sourceRows = input.markerPlan.pieceExplosionRows.filter((row) => {
    const colorMatches = !memberColor || !normalizeText(row.colorCode) || normalizeText(row.colorCode) === memberColor
    const materialMatches = !memberMaterial || !normalizeText(row.materialSku) || normalizeText(row.materialSku) === memberMaterial
    const sizeMatches = !selectedSizes.length || selectedSizes.includes(normalizeText(row.sizeCode))
    return colorMatches && materialMatches && sizeMatches
  })
  if (!sourceRows.length) throw new Error('该唛架成员没有可生成菲票的裁片部位明细。')

  let recordIndex = 0
  const records = sourceRows.flatMap((row) => {
    const piecesPerLayer = normalizePositiveInteger(input.sizePiecePerLayer[row.sizeCode])
    if (!piecesPerLayer) return []
    const garmentQty = layerCount * piecesPerLayer
    return Array.from({ length: Math.max(normalizePositiveInteger(row.piecePerGarment, 1), 1) }, (_, index) => {
      const record = buildManualTicketRecord({
        input: { ...input, layerCount },
        batchId,
        row,
        partInstanceNo: index + 1,
        garmentQty,
        index: recordIndex,
        issuedAt,
      })
      recordIndex += 1
      return record
    })
  })
  if (!records.length) throw new Error('请至少为一个尺码填写每层件数。')
  const linkedRecords = linkSiblingTickets(records)
  const store = readManualFeiTicketStore()
  const operationLogs = linkedRecords.map((record, index): ManualFeiTicketOperationLog => ({
    logId: `${batchId}-create-${index + 1}`,
    feiTicketId: record.feiTicketId,
    manualBatchId: batchId,
    action: '手动批量建票',
    detail: `由唛架 ${input.markerPlan.markerNo} / 成员 ${input.markerMember.bedNo} 生成，${record.skuSize} ${record.partName} ${record.qty}片。`,
    operatedAt: issuedAt,
    operatedBy: input.createdBy,
  }))
  persistManualFeiTicketStore({
    records: [...store.records, ...linkedRecords],
    operationLogs: [...store.operationLogs, ...operationLogs],
  })
  return { batchId, records: linkedRecords }
}

export function appendManualFeiTicket(input: {
  sourceRecord: GeneratedFeiTicketSourceRecord
  qty: number
  remark: string
  operatedBy: string
  operatedAt?: string
  manualBatchId?: string
}): GeneratedFeiTicketSourceRecord {
  const store = readManualFeiTicketStore()
  const operatedAt = input.operatedAt || new Date().toISOString()
  const qty = normalizePositiveInteger(input.qty)
  if (!qty) throw new Error('新增菲票数量必须大于 0。')
  const batchId = input.manualBatchId || input.sourceRecord.manualBatchId || `manual-append-${stableToken(operatedAt)}`
  const sequence = store.records.filter((record) => record.manualBatchId === batchId).length + 1
  const feiTicketId = `manual-fei-${stableToken(`${input.sourceRecord.feiTicketId}|${operatedAt}|${sequence}`)}`
  const feiTicketNo = `${input.sourceRecord.feiTicketNo}-A${String(sequence).padStart(2, '0')}`
  const sourceOutputLineId = `${input.sourceRecord.sourceOutputLineId}-append-${sequence}`
  const pieceSetNoRange = qty > 1 ? `1-${qty}` : '1'
  const encoded = encodeFeiTicketQr({
    ...input.sourceRecord.qrPayload,
    feiTicketId,
    feiTicketNo,
    sourceOutputLineId,
    qty,
    pieceQty: qty,
    garmentQty: qty,
    bundleQty: qty,
    actualCutPieceQty: qty,
    pieceSetNoStart: 1,
    pieceSetNoEnd: qty,
    pieceSetNoRange,
    issuedAt: operatedAt,
  })
  const record: GeneratedFeiTicketSourceRecord = {
    ...input.sourceRecord,
    feiTicketId,
    feiTicketNo,
    sourceOutputLineId,
    qty,
    garmentQty: qty,
    bundleQty: qty,
    actualCutPieceQty: qty,
    pieceSetNoStart: 1,
    pieceSetNoEnd: qty,
    pieceSetNoRange,
    printStatus: 'WAIT_PRINT',
    issuedAt: operatedAt,
    qrPayload: encoded.payload,
    qrValue: encoded.qrValue,
    sourceBasis: FEI_TICKET_MANUAL_SOURCE_BASIS,
    sourceBasisType: FEI_TICKET_MANUAL_SOURCE_BASIS_TYPE,
    manualBatchId: batchId,
    manualCreatedBy: input.operatedBy,
    manualUpdatedAt: operatedAt,
    manualUpdatedBy: input.operatedBy,
    manualRemark: input.remark,
  }
  persistManualFeiTicketStore({
    records: [...store.records, record],
    operationLogs: [...store.operationLogs, {
      logId: `${feiTicketId}-append`,
      feiTicketId,
      manualBatchId: batchId,
      action: '新增菲票',
      detail: `从 ${input.sourceRecord.feiTicketNo} 新增同一部位菲票，数量 ${qty}片。${input.remark ? `备注：${input.remark}` : ''}`,
      operatedAt,
      operatedBy: input.operatedBy,
    }],
  })
  return record
}

export function updateUnprintedManualFeiTicketQuantity(input: {
  feiTicketId: string
  qty: number
  reason: string
  operatedBy: string
  operatedAt?: string
}): GeneratedFeiTicketSourceRecord {
  const store = readManualFeiTicketStore()
  const index = store.records.findIndex((record) => record.feiTicketId === input.feiTicketId)
  const current = store.records[index]
  if (!current || current.sourceBasisType !== FEI_TICKET_MANUAL_SOURCE_BASIS_TYPE) throw new Error('仅支持修改手动生成的菲票。')
  if (current.printStatus !== 'WAIT_PRINT') throw new Error('已打印或已作废菲票不可修改数量。')
  const qty = normalizePositiveInteger(input.qty)
  if (!qty) throw new Error('菲票数量必须大于 0。')
  const reason = normalizeText(input.reason)
  if (!reason) throw new Error('请填写修改数量原因。')
  const operatedAt = input.operatedAt || new Date().toISOString()
  const pieceSetNoRange = qty > 1 ? `1-${qty}` : '1'
  const encoded = encodeFeiTicketQr({
    ...current.qrPayload,
    qty,
    pieceQty: qty,
    garmentQty: qty,
    bundleQty: qty,
    actualCutPieceQty: qty,
    pieceSetNoStart: 1,
    pieceSetNoEnd: qty,
    pieceSetNoRange,
  })
  const updated = {
    ...current,
    qty,
    garmentQty: qty,
    bundleQty: qty,
    actualCutPieceQty: qty,
    pieceSetNoStart: 1,
    pieceSetNoEnd: qty,
    pieceSetNoRange,
    qrPayload: encoded.payload,
    qrValue: encoded.qrValue,
    manualUpdatedAt: operatedAt,
    manualUpdatedBy: input.operatedBy,
  }
  const records = [...store.records]
  records[index] = updated
  persistManualFeiTicketStore({
    records,
    operationLogs: [...store.operationLogs, {
      logId: `${input.feiTicketId}-qty-${stableToken(operatedAt)}`,
      feiTicketId: input.feiTicketId,
      manualBatchId: current.manualBatchId || '',
      action: '修改数量',
      detail: `数量由 ${current.qty}片修改为 ${qty}片。原因：${reason}`,
      operatedAt,
      operatedBy: input.operatedBy,
    }],
  })
  return updated
}

export function deleteUnprintedManualFeiTicket(input: {
  feiTicketId: string
  operatedBy: string
  operatedAt?: string
}): boolean {
  const store = readManualFeiTicketStore()
  const current = store.records.find((record) => record.feiTicketId === input.feiTicketId)
  if (!current || current.sourceBasisType !== FEI_TICKET_MANUAL_SOURCE_BASIS_TYPE) throw new Error('仅支持删除手动生成的菲票。')
  if (current.printStatus !== 'WAIT_PRINT') throw new Error('已打印或已作废菲票不可删除。')
  const operatedAt = input.operatedAt || new Date().toISOString()
  return persistManualFeiTicketStore({
    records: store.records.filter((record) => record.feiTicketId !== input.feiTicketId),
    operationLogs: [...store.operationLogs, {
      logId: `${input.feiTicketId}-delete-${stableToken(operatedAt)}`,
      feiTicketId: input.feiTicketId,
      manualBatchId: current.manualBatchId || '',
      action: '删除未打印菲票',
      detail: `删除未打印手动菲票 ${current.feiTicketNo}。`,
      operatedAt,
      operatedBy: input.operatedBy,
    }],
  })
}

export function recordManualFeiTicketPrint(input: {
  sourceIds: string[]
  printedBy: string
  printedAt?: string
  reason?: string
  paperColor?: 'WHITE' | 'YELLOW'
  templateCode?: string
  labelSize?: string
}): GeneratedFeiTicketSourceRecord[] {
  const sourceIds = new Set(input.sourceIds.map(normalizeText).filter(Boolean))
  if (!sourceIds.size) return []
  const store = readManualFeiTicketStore()
  const printedAt = input.printedAt || new Date().toISOString()
  const updatedRecords: GeneratedFeiTicketSourceRecord[] = []
  const operationLogs = [...store.operationLogs]
  const records = store.records.map((record) => {
    const matched = [record.feiTicketId, record.feiTicketNo, record.sourceOutputLineId].some((value) => sourceIds.has(value))
    if (!matched || record.sourceBasisType !== FEI_TICKET_MANUAL_SOURCE_BASIS_TYPE) return record
    const previousPrintCount = Math.max(Number(record.manualPrintCount || 0), record.printStatus === 'PRINTED' || record.printStatus === 'REPRINTED' ? 1 : 0)
    const isReprint = previousPrintCount > 0
    const reason = normalizeText(input.reason)
    if (isReprint && !reason) throw new Error('补打菲票必须填写补打原因。')
    const paperColor = input.paperColor || (record.hasSpecialCraft ? 'YELLOW' : 'WHITE')
    const templateCode = input.templateCode || (paperColor === 'YELLOW' ? 'FEI_TICKET_YELLOW_THERMAL' : 'FEI_TICKET_WHITE_THERMAL')
    const labelSize = input.labelSize || 'LABEL_100_100'
    const next: GeneratedFeiTicketSourceRecord = {
      ...record,
      printStatus: isReprint ? 'REPRINTED' : 'PRINTED',
      manualFirstPrintedAt: record.manualFirstPrintedAt || printedAt,
      manualLatestReprintedAt: isReprint ? printedAt : record.manualLatestReprintedAt,
      manualPrintCount: previousPrintCount + 1,
      manualLastPrintedBy: input.printedBy,
      manualUpdatedAt: printedAt,
      manualUpdatedBy: input.printedBy,
      manualPrintHistory: [...(record.manualPrintHistory || []), {
        action: isReprint ? 'REPRINT' : 'PRINT',
        printedAt,
        printedBy: input.printedBy,
        reason,
        paperColor,
        templateCode,
        labelSize,
        sourceRange: Array.from(sourceIds),
      }],
    }
    updatedRecords.push(next)
    operationLogs.push({
      logId: `${record.feiTicketId}-${isReprint ? 'reprint' : 'print'}-${stableToken(printedAt)}`,
      feiTicketId: record.feiTicketId,
      manualBatchId: record.manualBatchId || '',
      action: isReprint ? '补打菲票' : '打印菲票',
      detail: `${isReprint ? '补打' : '首次打印'} ${record.feiTicketNo}，使用${paperColor === 'YELLOW' ? '黄色' : '白色'}热敏纸 / ${templateCode} / ${labelSize}。${isReprint ? `原因：${reason}。` : ''}打印后数量与删除操作已锁定。`,
      operatedAt: printedAt,
      operatedBy: input.printedBy,
    })
    return next
  })
  if (!updatedRecords.length) return []
  persistManualFeiTicketStore({ records, operationLogs })
  return updatedRecords
}
