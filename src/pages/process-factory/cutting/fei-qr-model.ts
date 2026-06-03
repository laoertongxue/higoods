import {
  getFeiTicketById,
  getFeiTicketByNo,
} from '../../../data/fcs/cutting/generated-fei-tickets.ts'
import {
  CUTTING_QR_VERSION,
  deserializeCuttingQrPayload,
  serializeCuttingQrPayload,
  type FeiTicketQrPayload as CanonicalFeiTicketQrPayload,
} from '../../../data/fcs/cutting/qr-payload.ts'
import { validateFeiCraftSequence } from '../../../data/fcs/cutting/qr-codes.ts'
import type {
  FeiTicketLabelRecord,
  FeiTicketPrintJob,
  CutOrderTicketOwner,
} from './fei-tickets-model.ts'

export const FEI_QR_SCHEMA_NAME = 'FEI_TICKET'
export const FEI_QR_SCHEMA_VERSION = CUTTING_QR_VERSION
const GENERATED_QR_META_FIELD = ['qr', 'Payload'].join('') as const

export type FeiQrProcessKey = 'embroidery' | 'template' | 'strip' | 'dyeMark'

export interface FeiQrReservedProcessSlot {
  processKey: FeiQrProcessKey
  enabled: boolean
  payloadVersion: string | null
  data: Record<string, unknown> | null
  note: string
}

function readGeneratedQrVersion(record: ReturnType<typeof getFeiTicketById> | ReturnType<typeof getFeiTicketByNo> | null): string | undefined {
  if (!record) return undefined
  const qrMeta = (record as unknown as Record<string, unknown>)[GENERATED_QR_META_FIELD] as { version?: string } | undefined
  return qrMeta?.version
}

export interface FeiQrReservedTrace {
  reservedTransferBagBinding: {
    enabled: boolean
    bridgeKey: string | null
    note: string
  }
  reservedScanCheckpoint: {
    enabled: boolean
    payloadVersion: string | null
    checkpoints: Record<string, unknown> | null
    note: string
  }
  reservedFutureFields: Record<string, unknown>
}

export interface FeiQrPayload extends CanonicalFeiTicketQrPayload {
  schemaName: string
  schemaVersion: string
  ownerType: 'cut-order'
  ownerId: string
  sourceContextType: 'cut-order' | 'marker-plan'
  sourceMarkerPlanId: string
  sourceMarkerPlanNo: string
  sourcePrintJobId: string
  sourcePrintJobNo: string
  styleCode: string
  spuCode: string
  sameCodeValue: string
  qrBaseValue: string
  reservedProcess: Record<FeiQrProcessKey, FeiQrReservedProcessSlot>
  reservedTrace: FeiQrReservedTrace
}

export interface FeiQrPayloadSummary {
  qrBaseValue: string
  schemaVersion: string
  ownerType: 'cut-order'
  cutOrderNo: string
  productionOrderNo: string
  styleCode: string
  spuCode: string
  materialSku: string
  sourceContextType: 'cut-order' | 'marker-plan'
  hasReservedProcess: boolean
  hasReservedTrace: boolean
}

export interface FeiQrValidationResult {
  isValid: boolean
  schemaName: string
  schemaVersion: string
  hasOwner: boolean
  hasSourceContext: boolean
  hasBaseBiz: boolean
  unknownFields: string[]
  warnings: string[]
}

export interface FeiQrSchemaMeta {
  isCurrentSchema: boolean
  schemaVersion: string
  schemaNote: string
  usedDefaultReservedProcess: boolean
  usedDefaultReservedTrace: boolean
}

export interface FeiQrPreviewRecord {
  ticketRecordId: string
  ticketNo: string
  qrValue: string
  payloadJson: string
  summary: FeiQrPayloadSummary
  validation: FeiQrValidationResult
  schemaMeta: FeiQrSchemaMeta
}

export interface FeiQrReservedProcessBadge {
  key: FeiQrProcessKey
  label: string
  className: string
  detailText: string
}

export interface TransferBagReservedBridge {
  ticketNo: string
  cutOrderNo: string
  ownerType: 'cut-order'
  qrSchemaVersion: string
  qrBaseValue: string
}

const processLabels: Record<FeiQrProcessKey, string> = {
  embroidery: '绣花扩展',
  template: '打模板扩展',
  strip: '打条扩展',
  dyeMark: '打染标扩展',
}

function normalizeText(value: string | null | undefined): string {
  return String(value || '').trim()
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function createReservedProcessSlot(processKey: FeiQrProcessKey): FeiQrReservedProcessSlot {
  return {
    processKey,
    enabled: false,
    payloadVersion: null,
    data: null,
    note: '后续阶段启用',
  }
}

export function getDefaultReservedProcessPayload(
  existing?: Partial<Record<FeiQrProcessKey, Partial<FeiQrReservedProcessSlot> | null>> | null,
): Record<FeiQrProcessKey, FeiQrReservedProcessSlot> {
  const keys: FeiQrProcessKey[] = ['embroidery', 'template', 'strip', 'dyeMark']
  return Object.fromEntries(
    keys.map((key) => {
      const base = createReservedProcessSlot(key)
      const patch = existing?.[key] || null
      return [
        key,
        patch
          ? {
              ...base,
              ...patch,
              processKey: key,
              enabled: patch.enabled ?? false,
              payloadVersion: patch.payloadVersion ?? null,
              data: patch.data ?? null,
              note: patch.note ?? base.note,
            }
          : base,
      ]
    }),
  ) as Record<FeiQrProcessKey, FeiQrReservedProcessSlot>
}

export function getDefaultReservedTracePayload(existing?: Partial<FeiQrReservedTrace> | null): FeiQrReservedTrace {
  return {
    reservedTransferBagBinding: {
      enabled: existing?.reservedTransferBagBinding?.enabled ?? true,
      bridgeKey: existing?.reservedTransferBagBinding?.bridgeKey ?? null,
      note: existing?.reservedTransferBagBinding?.note ?? '中转袋父子码绑定消费正式载具周期与菲票子码。',
    },
    reservedScanCheckpoint: {
      enabled: existing?.reservedScanCheckpoint?.enabled ?? true,
      payloadVersion: existing?.reservedScanCheckpoint?.payloadVersion ?? CUTTING_QR_VERSION,
      checkpoints: existing?.reservedScanCheckpoint?.checkpoints ?? null,
      note: existing?.reservedScanCheckpoint?.note ?? '工艺扫码依据正式菲票子码做顺序校验。',
    },
    reservedFutureFields: existing?.reservedFutureFields ?? {},
  }
}

function inferReservedProcess(payload: CanonicalFeiTicketQrPayload): Record<FeiQrProcessKey, FeiQrReservedProcessSlot> {
  const secondaryCrafts = payload.secondaryCrafts.map((item) => item.toLowerCase())
  return getDefaultReservedProcessPayload({
    embroidery: secondaryCrafts.some((item) => item.includes('绣'))
      ? { enabled: true, payloadVersion: payload.craftSequenceVersion, note: '当前菲票含绣花顺序信息。' }
      : null,
    template: secondaryCrafts.some((item) => item.includes('模板'))
      ? { enabled: true, payloadVersion: payload.craftSequenceVersion, note: '当前菲票含模板工艺顺序信息。' }
      : null,
    strip: secondaryCrafts.some((item) => item.includes('条') || item.includes('包边'))
      ? { enabled: true, payloadVersion: payload.craftSequenceVersion, note: '当前菲票含条带 / 包边工艺顺序信息。' }
      : null,
    dyeMark: secondaryCrafts.some((item) => item.includes('染') || item.includes('洗'))
      ? { enabled: true, payloadVersion: payload.craftSequenceVersion, note: '当前菲票含染整 / 洗水工艺顺序信息。' }
      : null,
  })
}

function normalizeBasePayload(input: {
  ticketRecord: FeiTicketLabelRecord
  owner: Pick<
    CutOrderTicketOwner,
    | 'cutOrderId'
    | 'cutOrderNo'
    | 'productionOrderId'
    | 'productionOrderNo'
    | 'styleCode'
    | 'spuCode'
    | 'color'
    | 'materialSku'
    | 'sameCodeValue'
    | 'qrBaseValue'
  >
}): CanonicalFeiTicketQrPayload {
  const generated = getFeiTicketById(input.ticketRecord.ticketRecordId) || getFeiTicketByNo(input.ticketRecord.ticketNo)
  const specialCrafts = generated?.specialCrafts || input.ticketRecord.specialCrafts || []
  const pieceSequenceRange = generated?.pieceSequenceRange || input.ticketRecord.pieceSequenceRange || null
  const versionLabel = input.ticketRecord.version ? `V${input.ticketRecord.version}` : 'V1'
  return {
    codeType: 'FEI_TICKET',
    version: input.ticketRecord.schemaVersion || readGeneratedQrVersion(generated) || CUTTING_QR_VERSION,
    payloadVersion: input.ticketRecord.schemaVersion || readGeneratedQrVersion(generated) || CUTTING_QR_VERSION,
    qrType: '菲票',
    issuedAt: input.ticketRecord.createdAt || input.ticketRecord.printedAt || generated?.issuedAt || '',
    feiTicketId: generated?.feiTicketId || input.ticketRecord.ticketRecordId,
    feiTicketNo: generated?.feiTicketNo || input.ticketRecord.ticketNo,
    cutOrderId: input.owner.cutOrderId,
    cutOrderNo: input.owner.cutOrderNo,
    productionOrderId: input.owner.productionOrderId,
    productionOrderNo: input.owner.productionOrderNo,
    markerPlanId: generated?.sourceMarkerPlanId || input.ticketRecord.sourceMarkerPlanId || '',
    markerPlanNo: generated?.sourceMarkerPlanNo || input.ticketRecord.sourceMarkerPlanNo || '',
    markerNumber: generated?.markerNumber || input.ticketRecord.sourceMarkerNo || '',
    bedNo: generated?.bedNo || input.ticketRecord.sourceMarkerNo || '',
    spreadingOrderId: generated?.spreadingOrderId || input.ticketRecord.sourceSpreadingSessionId || '',
    spreadingOrderNo: generated?.spreadingOrderNo || input.ticketRecord.sourceSpreadingSessionNo || '',
    spuCode: input.owner.spuCode,
    styleName: input.owner.styleCode,
    color: generated?.skuColor || generated?.fabricColor || input.ticketRecord.fabricColor || normalizeText(input.ticketRecord.color) || normalizeText(input.owner.color) || '待补颜色',
    size: generated?.skuSize || normalizeText(input.ticketRecord.size) || '均码',
    materialSku: input.owner.materialSku,
    sourceOutputLineId: generated?.sourceOutputLineId || input.ticketRecord.sourceOutputLineId || '',
    fabricRollId: generated?.fabricRollId || input.ticketRecord.fabricRollId || '',
    fabricRollNo: generated?.fabricRollNo || input.ticketRecord.fabricRollNo || '',
    fabricColor: generated?.fabricColor || input.ticketRecord.fabricColor || normalizeText(input.ticketRecord.color) || normalizeText(input.owner.color) || '待补颜色',
    garmentSkuId: generated?.garmentSkuId || input.ticketRecord.garmentSkuId || '',
    garmentColor: generated?.garmentColor || input.ticketRecord.garmentColor || normalizeText(input.ticketRecord.color) || normalizeText(input.owner.color) || '待补颜色',
    applicableSkuCodes: generated?.applicableSkuCodes?.length ? [...generated.applicableSkuCodes] : [generated?.garmentSkuId || input.ticketRecord.garmentSkuId || input.owner.spuCode].filter(Boolean),
    applicableSkuLabel: generated?.applicableSkuLabel || generated?.garmentSkuId || input.ticketRecord.garmentSkuId || input.owner.spuCode,
    assemblyGroupKey: generated?.assemblyGroupKey || [input.owner.cutOrderNo, generated?.fabricRollNo || input.ticketRecord.fabricRollNo, generated?.skuSize || normalizeText(input.ticketRecord.size), generated?.bundleNo || input.ticketRecord.bundleNo].filter(Boolean).join('::'),
    siblingPartTicketNos: generated?.siblingPartTicketNos ? [...generated.siblingPartTicketNos] : [],
    pieceScope: generated?.pieceScope || unique([normalizeText(input.ticketRecord.partName), normalizeText(input.ticketRecord.size)].filter(Boolean)),
    pieceGroup: generated?.pieceGroup || normalizeText(input.ticketRecord.partName) || '整单裁片',
    bundleScope: generated?.bundleScope || normalizeText(input.ticketRecord.bundleNo) || `BUNDLE-${String(input.ticketRecord.sequenceNo || 1).padStart(3, '0')}`,
    skuColor: generated?.skuColor || input.ticketRecord.fabricColor || normalizeText(input.ticketRecord.color) || normalizeText(input.owner.color) || '待补颜色',
    skuSize: generated?.skuSize || normalizeText(input.ticketRecord.size) || '均码',
    partCode: generated?.partCode || normalizeText(input.ticketRecord.partCode) || normalizeText(input.ticketRecord.partName) || '整单裁片',
    partName: generated?.partName || normalizeText(input.ticketRecord.partName) || '整单裁片',
    garmentInstanceNo: Math.max(generated?.garmentInstanceNo || input.ticketRecord.pieceSetNoStart || 1, 1),
    layerCount: Math.max(generated?.layerCount || generated?.pieceSequenceRange?.actualLayerCount || pieceSequenceRange?.actualLayerCount || pieceSequenceRange?.endNo || 0, 0),
    businessSizeLabel: generated?.businessSizeLabel || [generated?.skuSize || normalizeText(input.ticketRecord.size) || '均码', generated?.garmentInstanceNo || input.ticketRecord.pieceSetNoStart || 1, generated?.layerCount || generated?.pieceSequenceRange?.actualLayerCount || pieceSequenceRange?.actualLayerCount || pieceSequenceRange?.endNo || 0].filter(Boolean).join('-'),
    partQuantityPerGarment: Math.max(generated?.partQuantityPerGarment || generated?.patternIdentity?.piecePartNames?.length || 0, 0),
    pieceQty: Math.max(generated?.actualCutPieceQty || input.ticketRecord.actualCutPieceQty || input.ticketRecord.quantity || 1, 1),
    garmentQty: Math.max(generated?.garmentQty || input.ticketRecord.quantity || generated?.qty || 1, 1),
    pieceSequenceLabel: generated?.pieceSequenceLabel || input.ticketRecord.pieceSequenceLabel || '',
    pieceSequenceStartNo: Math.max(pieceSequenceRange?.startNo || 0, 0),
    pieceSequenceEndNo: Math.max(pieceSequenceRange?.endNo || 0, 0),
    bundleNo: generated?.bundleNo || normalizeText(input.ticketRecord.bundleNo) || `BUNDLE-${String(input.ticketRecord.sequenceNo || 1).padStart(3, '0')}`,
    bundleQty: Math.max(generated?.bundleQty || input.ticketRecord.quantity || 1, 1),
    pieceSetNoStart: Math.max(generated?.pieceSetNoStart || input.ticketRecord.pieceSetNoStart || 1, 1),
    pieceSetNoEnd: Math.max(generated?.pieceSetNoEnd || input.ticketRecord.pieceSetNoEnd || generated?.bundleQty || input.ticketRecord.quantity || 1, 1),
    pieceSetNoRange:
      generated?.pieceSetNoRange
      || input.ticketRecord.pieceSetNoRange
      || `${Math.max(generated?.pieceSetNoStart || input.ticketRecord.pieceSetNoStart || 1, 1)}-${Math.max(generated?.pieceSetNoEnd || input.ticketRecord.pieceSetNoEnd || generated?.bundleQty || input.ticketRecord.quantity || 1, 1)}`,
    bundleTicketType: generated?.bundleTicketType || input.ticketRecord.bundleTicketType || '扎束菲票',
    actualCutPieceQty: Math.max(generated?.actualCutPieceQty || input.ticketRecord.actualCutPieceQty || input.ticketRecord.quantity || 1, 1),
    qty: Math.max(generated?.qty || input.ticketRecord.quantity || 1, 1),
    hasSpecialCraft: Boolean(generated?.hasSpecialCraft ?? input.ticketRecord.hasSpecialCraft),
    specialCrafts: specialCrafts.map((craft) => ({
      craftCategory: craft.craftCategory,
      craftType: craft.craftType,
      receiverFactoryCode: craft.receiverFactoryCode,
      receiverFactoryName: craft.receiverFactoryName,
    })),
    feiTicketVersion: versionLabel,
    generatedAt: input.ticketRecord.createdAt || input.ticketRecord.printedAt || generated?.issuedAt || '',
    secondaryCrafts: generated?.secondaryCrafts || unique((input.ticketRecord.processTags || []).map((item) => normalizeText(item))),
    craftSequenceVersion: generated?.craftSequenceVersion || `${input.ticketRecord.schemaVersion || CUTTING_QR_VERSION}:compat`,
    currentCraftStage: generated?.currentCraftStage || '',
  }
}

export function buildFeiQrPayload(options: {
  ticketRecord: FeiTicketLabelRecord
  owner: Pick<
    CutOrderTicketOwner,
    | 'cutOrderId'
    | 'cutOrderNo'
    | 'productionOrderId'
    | 'productionOrderNo'
    | 'styleCode'
    | 'spuCode'
    | 'color'
    | 'materialSku'
    | 'sameCodeValue'
    | 'qrBaseValue'
  >
  printJob?: Pick<FeiTicketPrintJob, 'printJobId' | 'printJobNo'> | null
}): FeiQrPayload {
  const payload = normalizeBasePayload(options)
  return {
    ...payload,
    payloadVersion: payload.payloadVersion || payload.version || CUTTING_QR_VERSION,
    qrType: payload.qrType || '菲票',
    markerPlanId: payload.markerPlanId || '',
    markerPlanNo: payload.markerPlanNo || '',
    markerNumber: payload.markerNumber || '',
    bedNo: payload.bedNo || '',
    spreadingOrderId: payload.spreadingOrderId || '',
    spreadingOrderNo: payload.spreadingOrderNo || '',
    spuCode: payload.spuCode || '',
    styleName: payload.styleName || '',
    color: payload.color || payload.skuColor || payload.fabricColor || '',
    size: payload.size || payload.skuSize || '',
    applicableSkuCodes: payload.applicableSkuCodes?.length ? [...payload.applicableSkuCodes] : [payload.garmentSkuId].filter(Boolean),
    applicableSkuLabel: payload.applicableSkuLabel || payload.garmentSkuId || 'SKU 待补',
    assemblyGroupKey: payload.assemblyGroupKey || [payload.cutOrderNo, payload.fabricRollNo, payload.skuSize, payload.bundleNo].filter(Boolean).join('::'),
    siblingPartTicketNos: [...(payload.siblingPartTicketNos || [])],
    garmentInstanceNo: payload.garmentInstanceNo || payload.pieceSetNoStart || 1,
    layerCount: payload.layerCount || payload.pieceSequenceEndNo || 0,
    businessSizeLabel: payload.businessSizeLabel || [payload.size || payload.skuSize, payload.garmentInstanceNo || payload.pieceSetNoStart || 1, payload.layerCount || payload.pieceSequenceEndNo || 0].filter(Boolean).join('-'),
    partQuantityPerGarment: payload.partQuantityPerGarment || 0,
    pieceQty: payload.pieceQty || payload.actualCutPieceQty || payload.qty || 0,
    garmentQty: payload.garmentQty || payload.qty || 0,
    pieceSequenceLabel: payload.pieceSequenceLabel || '',
    pieceSequenceStartNo: payload.pieceSequenceStartNo || 0,
    pieceSequenceEndNo: payload.pieceSequenceEndNo || 0,
    hasSpecialCraft: Boolean(payload.hasSpecialCraft),
    specialCrafts: payload.specialCrafts || [],
    feiTicketVersion: payload.feiTicketVersion || 'V1',
    generatedAt: payload.generatedAt || payload.issuedAt,
    schemaName: FEI_QR_SCHEMA_NAME,
    schemaVersion: payload.version,
    ownerType: 'cut-order',
    ownerId: options.owner.cutOrderId,
    sourceContextType: options.ticketRecord.sourceContextType,
    sourceMarkerPlanId: options.ticketRecord.sourceMarkerPlanId || '',
    sourceMarkerPlanNo: options.ticketRecord.sourceMarkerPlanNo || '',
    sourcePrintJobId: options.ticketRecord.sourcePrintJobId || options.printJob?.printJobId || '',
    sourcePrintJobNo: options.printJob?.printJobNo || '',
    styleCode: options.owner.styleCode,
    sameCodeValue: options.owner.sameCodeValue,
    qrBaseValue: options.owner.qrBaseValue || options.owner.cutOrderNo,
    reservedProcess: getDefaultReservedProcessPayload(
      (options.ticketRecord.reservedProcess as Partial<Record<FeiQrProcessKey, Partial<FeiQrReservedProcessSlot> | null>> | null)
      || inferReservedProcess(payload),
    ),
    reservedTrace: getDefaultReservedTracePayload((options.ticketRecord.reservedTrace as Partial<FeiQrReservedTrace> | null) || null),
  }
}

export function buildFeiQrPayloadSummary(payload: FeiQrPayload): FeiQrPayloadSummary {
  return {
    qrBaseValue: payload.qrBaseValue,
    schemaVersion: payload.schemaVersion,
    ownerType: payload.ownerType,
    cutOrderNo: payload.cutOrderNo,
    productionOrderNo: payload.productionOrderNo,
    styleCode: payload.styleCode,
    spuCode: payload.spuCode,
    materialSku: payload.materialSku,
    sourceContextType: payload.sourceContextType,
    hasReservedProcess: Object.values(payload.reservedProcess).some((item) => item.enabled),
    hasReservedTrace: Boolean(payload.reservedTrace.reservedTransferBagBinding.enabled || payload.reservedTrace.reservedScanCheckpoint.enabled),
  }
}

export function validateFeiQrPayload(payload: FeiQrPayload): FeiQrValidationResult {
  const warnings: string[] = []
  if (!payload.cutOrderId || !payload.cutOrderNo) warnings.push('当前菲票缺少裁片单主码引用。')
  if (!payload.productionOrderNo) warnings.push('当前菲票缺少生产单号。')
  if (!payload.materialSku) warnings.push('当前菲票缺少面料 SKU。')
  if (!payload.fabricRollNo) warnings.push('当前菲票缺少面料卷号。')
  if (!payload.fabricColor) warnings.push('当前菲票缺少布料颜色。')
  if (!payload.skuSize) warnings.push('当前菲票缺少尺码。')
  if (!payload.partName) warnings.push('当前菲票缺少裁片部位。')
  if (!payload.feiTicketNo) warnings.push('当前菲票缺少菲票号。')
  const craftValidation = payload.secondaryCrafts.length
    ? validateFeiCraftSequence(payload, payload.currentCraftStage || payload.secondaryCrafts[0], [])
    : null
  if (craftValidation && !craftValidation.allowed) warnings.push(craftValidation.reason)
  return {
    isValid: payload.codeType === 'FEI_TICKET' && Boolean(payload.feiTicketId && payload.cutOrderId && payload.materialSku),
    schemaName: payload.schemaName,
    schemaVersion: payload.schemaVersion,
    hasOwner: Boolean(payload.ownerId),
    hasSourceContext: Boolean(payload.sourceContextType),
    hasBaseBiz: Boolean(payload.productionOrderNo && payload.materialSku),
    unknownFields: [],
    warnings,
  }
}

function toCanonicalPayload(payload: FeiQrPayload): CanonicalFeiTicketQrPayload {
  return {
    codeType: 'FEI_TICKET',
    version: payload.version,
    payloadVersion: payload.payloadVersion,
    qrType: payload.qrType,
    issuedAt: payload.issuedAt,
    feiTicketId: payload.feiTicketId,
    feiTicketNo: payload.feiTicketNo,
    cutOrderId: payload.cutOrderId,
    cutOrderNo: payload.cutOrderNo,
    productionOrderId: payload.productionOrderId,
    productionOrderNo: payload.productionOrderNo,
    markerPlanId: payload.markerPlanId,
    markerPlanNo: payload.markerPlanNo,
    markerNumber: payload.markerNumber,
    bedNo: payload.bedNo,
    spreadingOrderId: payload.spreadingOrderId,
    spreadingOrderNo: payload.spreadingOrderNo,
    spuCode: payload.spuCode,
    styleName: payload.styleName,
    color: payload.color,
    size: payload.size,
    sourceOutputLineId: payload.sourceOutputLineId,
    fabricRollId: payload.fabricRollId,
    fabricRollNo: payload.fabricRollNo,
    fabricColor: payload.fabricColor,
    materialSku: payload.materialSku,
    garmentSkuId: payload.garmentSkuId,
    garmentColor: payload.garmentColor,
    applicableSkuCodes: [...payload.applicableSkuCodes],
    applicableSkuLabel: payload.applicableSkuLabel,
    assemblyGroupKey: payload.assemblyGroupKey,
    siblingPartTicketNos: [...payload.siblingPartTicketNos],
    pieceScope: [...payload.pieceScope],
    pieceGroup: payload.pieceGroup,
    bundleScope: payload.bundleScope,
    skuColor: payload.skuColor,
    skuSize: payload.skuSize,
    partCode: payload.partCode,
    partName: payload.partName,
    garmentInstanceNo: payload.garmentInstanceNo,
    layerCount: payload.layerCount,
    businessSizeLabel: payload.businessSizeLabel,
    partQuantityPerGarment: payload.partQuantityPerGarment,
    pieceQty: payload.pieceQty,
    garmentQty: payload.garmentQty,
    pieceSequenceLabel: payload.pieceSequenceLabel,
    pieceSequenceStartNo: payload.pieceSequenceStartNo,
    pieceSequenceEndNo: payload.pieceSequenceEndNo,
    bundleNo: payload.bundleNo,
    bundleQty: payload.bundleQty,
    pieceSetNoStart: payload.pieceSetNoStart,
    pieceSetNoEnd: payload.pieceSetNoEnd,
    pieceSetNoRange: payload.pieceSetNoRange,
    bundleTicketType: payload.bundleTicketType,
    actualCutPieceQty: payload.actualCutPieceQty,
    qty: payload.qty,
    hasSpecialCraft: payload.hasSpecialCraft,
    specialCrafts: payload.specialCrafts.map((craft) => ({ ...craft })),
    feiTicketVersion: payload.feiTicketVersion,
    generatedAt: payload.generatedAt,
    secondaryCrafts: [...payload.secondaryCrafts],
    craftSequenceVersion: payload.craftSequenceVersion,
    currentCraftStage: payload.currentCraftStage || '',
  }
}

export function serializeFeiQrPayload(payload: FeiQrPayload): string {
  return serializeCuttingQrPayload(toCanonicalPayload(payload))
}

export function deserializeFeiQrPayload(value: string): FeiQrPayload | null {
  const payload = deserializeCuttingQrPayload(value)
  if (!payload || payload.codeType !== 'FEI_TICKET') return null
  return {
    ...payload,
    schemaName: FEI_QR_SCHEMA_NAME,
    schemaVersion: payload.version,
    ownerType: 'cut-order',
    ownerId: payload.cutOrderId,
    sourceContextType: 'cut-order',
    sourceMarkerPlanId: '',
    sourceMarkerPlanNo: '',
    sourcePrintJobId: '',
    sourcePrintJobNo: '',
    styleCode: '',
    spuCode: '',
    sameCodeValue: payload.cutOrderNo,
    qrBaseValue: payload.cutOrderNo,
    reservedProcess: inferReservedProcess(payload),
    reservedTrace: getDefaultReservedTracePayload(),
  }
}

export function buildReservedProcessBadges(payload: FeiQrPayload): FeiQrReservedProcessBadge[] {
  return (Object.keys(payload.reservedProcess) as FeiQrProcessKey[]).map((key) => {
    const slot = payload.reservedProcess[key]
    return {
      key,
      label: processLabels[key],
      className: slot.enabled
        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
        : 'bg-slate-100 text-slate-700 border border-slate-200',
      detailText: slot.enabled
        ? `${processLabels[key]}已纳入正式菲票子码顺序版本 ${slot.payloadVersion || payload.craftSequenceVersion}。`
        : `${processLabels[key]}当前未命中工艺顺序，仅保留扩展槽位。`,
    }
  })
}

export function buildFeiQrSchemaMeta(record: Partial<FeiTicketLabelRecord>): FeiQrSchemaMeta {
  const usedDefaultReservedProcess = !record.reservedProcess
  const usedDefaultReservedTrace = !record.reservedTrace
  const isCurrentSchema = Boolean(record.schemaName && record.schemaVersion === FEI_QR_SCHEMA_VERSION)
  return {
    isCurrentSchema,
    schemaVersion: record.schemaVersion || FEI_QR_SCHEMA_VERSION,
    schemaNote: '当前票据已使用正式菲票子码结构。',
    usedDefaultReservedProcess,
    usedDefaultReservedTrace,
  }
}

export function buildTransferBagReservedBridge(payload: FeiQrPayload): TransferBagReservedBridge {
  return {
    ticketNo: payload.feiTicketNo,
    cutOrderNo: payload.cutOrderNo,
    ownerType: payload.ownerType,
    qrSchemaVersion: payload.schemaVersion,
    qrBaseValue: payload.qrBaseValue,
  }
}

export function buildQrNavigationPayload(payload: FeiQrPayload): Record<string, string | undefined> {
  return {
    cutOrderId: payload.cutOrderId,
    cutOrderNo: payload.cutOrderNo,
    markerPlanId: payload.sourceMarkerPlanId || undefined,
    markerPlanNo: payload.sourceMarkerPlanNo || undefined,
    productionOrderNo: payload.productionOrderNo || undefined,
    ticketNo: payload.feiTicketNo || undefined,
    materialSku: payload.materialSku || undefined,
  }
}
