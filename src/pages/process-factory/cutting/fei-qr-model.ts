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
  OriginalCutOrderTicketOwner,
} from './fei-tickets-model'

export const FEI_QR_SCHEMA_NAME = 'FEI_TICKET'
export const FEI_QR_SCHEMA_VERSION = CUTTING_QR_VERSION

export type FeiQrProcessKey = 'embroidery' | 'template' | 'strip' | 'dyeMark'

export interface FeiQrReservedProcessSlot {
  processKey: FeiQrProcessKey
  enabled: boolean
  payloadVersion: string | null
  data: Record<string, unknown> | null
  note: string
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
  ownerType: 'original-cut-order'
  ownerId: string
  sourceContextType: 'original-order' | 'merge-batch'
  sourceMergeBatchId: string
  sourceMergeBatchNo: string
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
  ownerType: 'original-cut-order'
  originalCutOrderNo: string
  productionOrderNo: string
  styleCode: string
  spuCode: string
  materialSku: string
  sourceContextType: 'original-order' | 'merge-batch'
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

export interface FeiQrCompatibilityMeta {
  isLegacy: boolean
  schemaVersion: string
  compatibilityNote: string
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
  compatibilityMeta: FeiQrCompatibilityMeta
}

export interface FeiQrReservedProcessBadge {
  key: FeiQrProcessKey
  label: string
  className: string
  detailText: string
}

export interface TransferBagReservedBridge {
  ticketNo: string
  originalCutOrderNo: string
  ownerType: 'original-cut-order'
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
      note: existing?.reservedTransferBagBinding?.note ?? '周转口袋父子码绑定消费正式载具周期与菲票子码。',
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
    OriginalCutOrderTicketOwner,
    | 'originalCutOrderId'
    | 'originalCutOrderNo'
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
  return {
    codeType: 'FEI_TICKET',
    version: input.ticketRecord.schemaVersion || generated?.qrPayload.version || CUTTING_QR_VERSION,
    issuedAt: input.ticketRecord.createdAt || input.ticketRecord.printedAt || generated?.issuedAt || '',
    feiTicketId: generated?.feiTicketId || input.ticketRecord.ticketRecordId,
    feiTicketNo: generated?.feiTicketNo || input.ticketRecord.ticketNo,
    originalCutOrderId: input.owner.originalCutOrderId,
    originalCutOrderNo: input.owner.originalCutOrderNo,
    productionOrderId: input.owner.productionOrderId,
    productionOrderNo: input.owner.productionOrderNo,
    materialSku: input.owner.materialSku,
    pieceScope: generated?.pieceScope || unique([normalizeText(input.ticketRecord.partName), normalizeText(input.ticketRecord.size)].filter(Boolean)),
    pieceGroup: generated?.pieceGroup || normalizeText(input.ticketRecord.partName) || '整单裁片',
    bundleScope: generated?.bundleScope || `BUNDLE-${String(input.ticketRecord.sequenceNo || 1).padStart(3, '0')}`,
    skuColor: generated?.skuColor || normalizeText(input.ticketRecord.color) || normalizeText(input.owner.color) || '待补颜色',
    skuSize: generated?.skuSize || normalizeText(input.ticketRecord.size) || '均码',
    partName: generated?.partName || normalizeText(input.ticketRecord.partName) || '整单裁片',
    qty: Math.max(generated?.qty || input.ticketRecord.quantity || 1, 1),
    secondaryCrafts: generated?.secondaryCrafts || unique((input.ticketRecord.processTags || []).map((item) => normalizeText(item))),
    craftSequenceVersion: generated?.craftSequenceVersion || `${input.ticketRecord.schemaVersion || CUTTING_QR_VERSION}:compat`,
    currentCraftStage: generated?.currentCraftStage || '',
  }
}

export function buildFeiQrPayload(options: {
  ticketRecord: FeiTicketLabelRecord
  owner: Pick<
    OriginalCutOrderTicketOwner,
    | 'originalCutOrderId'
    | 'originalCutOrderNo'
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
    schemaName: FEI_QR_SCHEMA_NAME,
    schemaVersion: payload.version,
    ownerType: 'original-cut-order',
    ownerId: options.owner.originalCutOrderId,
    sourceContextType: options.ticketRecord.sourceContextType,
    sourceMergeBatchId: options.ticketRecord.sourceMergeBatchId || '',
    sourceMergeBatchNo: options.ticketRecord.sourceMergeBatchNo || '',
    sourcePrintJobId: options.ticketRecord.sourcePrintJobId || options.printJob?.printJobId || '',
    sourcePrintJobNo: options.printJob?.printJobNo || '',
    styleCode: options.owner.styleCode,
    spuCode: options.owner.spuCode,
    sameCodeValue: options.owner.sameCodeValue,
    qrBaseValue: options.owner.qrBaseValue || options.owner.originalCutOrderNo,
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
    originalCutOrderNo: payload.originalCutOrderNo,
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
  if (!payload.originalCutOrderId || !payload.originalCutOrderNo) warnings.push('当前菲票缺少原始裁片单主码引用。')
  if (!payload.productionOrderNo) warnings.push('当前菲票缺少生产单号。')
  if (!payload.materialSku) warnings.push('当前菲票缺少面料 SKU。')
  if (!payload.feiTicketNo) warnings.push('当前菲票缺少菲票号。')
  const craftValidation = payload.secondaryCrafts.length
    ? validateFeiCraftSequence(payload, payload.currentCraftStage || payload.secondaryCrafts[0], [])
    : null
  if (craftValidation && !craftValidation.allowed) warnings.push(craftValidation.reason)
  return {
    isValid: payload.codeType === 'FEI_TICKET' && Boolean(payload.feiTicketId && payload.originalCutOrderId && payload.materialSku),
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
    issuedAt: payload.issuedAt,
    feiTicketId: payload.feiTicketId,
    feiTicketNo: payload.feiTicketNo,
    originalCutOrderId: payload.originalCutOrderId,
    originalCutOrderNo: payload.originalCutOrderNo,
    productionOrderId: payload.productionOrderId,
    productionOrderNo: payload.productionOrderNo,
    materialSku: payload.materialSku,
    pieceScope: [...payload.pieceScope],
    pieceGroup: payload.pieceGroup,
    bundleScope: payload.bundleScope,
    skuColor: payload.skuColor,
    skuSize: payload.skuSize,
    partName: payload.partName,
    qty: payload.qty,
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
    ownerType: 'original-cut-order',
    ownerId: payload.originalCutOrderId,
    sourceContextType: 'original-order',
    sourceMergeBatchId: '',
    sourceMergeBatchNo: '',
    sourcePrintJobId: '',
    sourcePrintJobNo: '',
    styleCode: '',
    spuCode: '',
    sameCodeValue: payload.originalCutOrderNo,
    qrBaseValue: payload.originalCutOrderNo,
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

export function buildFeiQrCompatibilityMeta(record: Partial<FeiTicketLabelRecord>): FeiQrCompatibilityMeta {
  const usedDefaultReservedProcess = !record.reservedProcess
  const usedDefaultReservedTrace = !record.reservedTrace
  const isLegacy = !record.schemaName || !record.schemaVersion || record.schemaVersion !== FEI_QR_SCHEMA_VERSION
  return {
    isLegacy,
    schemaVersion: record.schemaVersion || FEI_QR_SCHEMA_VERSION,
    compatibilityNote: isLegacy ? '旧票据已按正式菲票子码结构兼容展示。' : '当前票据已使用正式菲票子码结构。',
    usedDefaultReservedProcess,
    usedDefaultReservedTrace,
  }
}

export function buildTransferBagReservedBridge(payload: FeiQrPayload): TransferBagReservedBridge {
  return {
    ticketNo: payload.feiTicketNo,
    originalCutOrderNo: payload.originalCutOrderNo,
    ownerType: payload.ownerType,
    qrSchemaVersion: payload.schemaVersion,
    qrBaseValue: payload.qrBaseValue,
  }
}

export function buildQrNavigationPayload(payload: FeiQrPayload): Record<string, string | undefined> {
  return {
    originalCutOrderId: payload.originalCutOrderId,
    originalCutOrderNo: payload.originalCutOrderNo,
    mergeBatchId: payload.sourceMergeBatchId || undefined,
    mergeBatchNo: payload.sourceMergeBatchNo || undefined,
    productionOrderNo: payload.productionOrderNo || undefined,
    ticketNo: payload.feiTicketNo || undefined,
    materialSku: payload.materialSku || undefined,
  }
}
