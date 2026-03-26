import type {
  FeiTicketLabelRecord,
  FeiTicketPrintJob,
  OriginalCutOrderTicketOwner,
} from './fei-tickets-model'

export const FEI_QR_SCHEMA_NAME = 'fcs-fei-ticket'
export const FEI_QR_SCHEMA_VERSION = '1.0.0'

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

export interface FeiQrPayload {
  schemaName: string
  schemaVersion: string
  ownerType: 'original-cut-order'
  ownerId: string
  ticket: {
    ticketRecordId: string
    ticketNo: string
    originalCutOrderId: string
    originalCutOrderNo: string
    sequenceNo: number
    qrBaseValue: string
    createdAt: string
  }
  sourceContext: {
    sourceContextType: 'original-order' | 'merge-batch'
    sourceMergeBatchId: string
    sourceMergeBatchNo: string
    sourcePrintJobId: string
    sourcePrintJobNo: string
  }
  baseBiz: {
    productionOrderId: string
    productionOrderNo: string
    styleCode: string
    spuCode: string
    color: string
    materialSku: string
    sameCodeValue: string
  }
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
      enabled: existing?.reservedTransferBagBinding?.enabled ?? false,
      bridgeKey: existing?.reservedTransferBagBinding?.bridgeKey ?? null,
      note: existing?.reservedTransferBagBinding?.note ?? '后续周转口袋父子码绑定将消费该桥接字段。',
    },
    reservedScanCheckpoint: {
      enabled: existing?.reservedScanCheckpoint?.enabled ?? false,
      payloadVersion: existing?.reservedScanCheckpoint?.payloadVersion ?? null,
      checkpoints: existing?.reservedScanCheckpoint?.checkpoints ?? null,
      note: existing?.reservedScanCheckpoint?.note ?? '后续主码校验节点将消费该保留结构。',
    },
    reservedFutureFields: existing?.reservedFutureFields ?? {},
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
  return {
    schemaName: options.ticketRecord.schemaName || FEI_QR_SCHEMA_NAME,
    schemaVersion: options.ticketRecord.schemaVersion || FEI_QR_SCHEMA_VERSION,
    ownerType: 'original-cut-order',
    ownerId: options.owner.originalCutOrderId,
    ticket: {
      ticketRecordId: options.ticketRecord.ticketRecordId,
      ticketNo: options.ticketRecord.ticketNo,
      originalCutOrderId: options.ticketRecord.originalCutOrderId,
      originalCutOrderNo: options.ticketRecord.originalCutOrderNo,
      sequenceNo: options.ticketRecord.sequenceNo,
      qrBaseValue: options.ticketRecord.legacyQrBaseValue || options.owner.qrBaseValue || options.ticketRecord.qrValue,
      createdAt: options.ticketRecord.createdAt || '',
    },
    sourceContext: {
      sourceContextType: options.ticketRecord.sourceContextType,
      sourceMergeBatchId: options.ticketRecord.sourceMergeBatchId || '',
      sourceMergeBatchNo: options.ticketRecord.sourceMergeBatchNo || '',
      sourcePrintJobId: options.ticketRecord.sourcePrintJobId || options.printJob?.printJobId || '',
      sourcePrintJobNo: options.printJob?.printJobNo || '',
    },
    baseBiz: {
      productionOrderId: options.owner.productionOrderId,
      productionOrderNo: options.owner.productionOrderNo,
      styleCode: options.owner.styleCode,
      spuCode: options.owner.spuCode,
      color: options.owner.color,
      materialSku: options.owner.materialSku,
      sameCodeValue: options.owner.sameCodeValue,
    },
    reservedProcess: getDefaultReservedProcessPayload(
      (options.ticketRecord.reservedProcess as Partial<Record<FeiQrProcessKey, Partial<FeiQrReservedProcessSlot> | null>> | null) || null,
    ),
    reservedTrace: getDefaultReservedTracePayload((options.ticketRecord.reservedTrace as Partial<FeiQrReservedTrace> | null) || null),
  }
}

export function buildFeiQrPayloadSummary(payload: FeiQrPayload): FeiQrPayloadSummary {
  return {
    qrBaseValue: payload.ticket.qrBaseValue,
    schemaVersion: payload.schemaVersion,
    ownerType: payload.ownerType,
    originalCutOrderNo: payload.ticket.originalCutOrderNo,
    productionOrderNo: payload.baseBiz.productionOrderNo,
    styleCode: payload.baseBiz.styleCode,
    spuCode: payload.baseBiz.spuCode,
    materialSku: payload.baseBiz.materialSku,
    sourceContextType: payload.sourceContext.sourceContextType,
    hasReservedProcess: Object.values(payload.reservedProcess).length > 0,
    hasReservedTrace: Boolean(payload.reservedTrace),
  }
}

export function validateFeiQrPayload(payload: FeiQrPayload): FeiQrValidationResult {
  const topLevelKeys = Object.keys(payload)
  const allowedTopLevelKeys = ['schemaName', 'schemaVersion', 'ownerType', 'ownerId', 'ticket', 'sourceContext', 'baseBiz', 'reservedProcess', 'reservedTrace']
  const warnings: string[] = []

  if (payload.ownerType !== 'original-cut-order') warnings.push('裁片单主码归属对象不是 original-cut-order。')
  if (!payload.ticket.ticketNo) warnings.push('当前主码缺少菲票号。')
  if (!payload.baseBiz.productionOrderNo) warnings.push('当前主码缺少生产单号。')
  if (!payload.baseBiz.sameCodeValue) warnings.push('当前主码缺少裁片单主码摘要。')

  return {
    isValid:
      payload.schemaName === FEI_QR_SCHEMA_NAME &&
      Boolean(payload.ownerId) &&
      Boolean(payload.sourceContext.sourceContextType) &&
      Boolean(payload.baseBiz.productionOrderNo),
    schemaName: payload.schemaName,
    schemaVersion: payload.schemaVersion,
    hasOwner: Boolean(payload.ownerId && payload.ownerType === 'original-cut-order'),
    hasSourceContext: Boolean(payload.sourceContext.sourceContextType),
    hasBaseBiz: Boolean(payload.baseBiz.productionOrderNo && payload.baseBiz.materialSku),
    unknownFields: topLevelKeys.filter((key) => !allowedTopLevelKeys.includes(key)),
    warnings,
  }
}

export function serializeFeiQrPayload(payload: FeiQrPayload): string {
  return `FCSQR:${encodeURIComponent(JSON.stringify(payload))}`
}

export function deserializeFeiQrPayload(value: string): FeiQrPayload | null {
  if (!value) return null

  const raw = value.startsWith('FCSQR:') ? decodeURIComponent(value.slice(6)) : value
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as FeiQrPayload
  } catch {
    return null
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
        ? `${processLabels[key]}已启用，当前 payloadVersion ${slot.payloadVersion || '待补'}。`
        : `${processLabels[key]}尚未启用，当前仅保留扩展槽位。`,
    }
  })
}

export function buildFeiQrCompatibilityMeta(record: Partial<FeiTicketLabelRecord>): FeiQrCompatibilityMeta {
  const usedDefaultReservedProcess = !record.reservedProcess
  const usedDefaultReservedTrace = !record.reservedTrace
  const isLegacy = !record.schemaName || !record.schemaVersion || usedDefaultReservedProcess || usedDefaultReservedTrace

  return {
    isLegacy,
    schemaVersion: record.schemaVersion || FEI_QR_SCHEMA_VERSION,
    compatibilityNote: isLegacy ? '旧版数据已按默认结构兼容展示。' : '当前票据已使用版本化主码结构。',
    usedDefaultReservedProcess,
    usedDefaultReservedTrace,
  }
}

export function buildTransferBagReservedBridge(payload: FeiQrPayload): TransferBagReservedBridge {
  return {
    ticketNo: payload.ticket.ticketNo,
    originalCutOrderNo: payload.ticket.originalCutOrderNo,
    ownerType: payload.ownerType,
    qrSchemaVersion: payload.schemaVersion,
    qrBaseValue: payload.ticket.qrBaseValue,
  }
}

export function buildQrNavigationPayload(payload: FeiQrPayload): Record<string, string | undefined> {
  return {
    originalCutOrderNo: payload.ticket.originalCutOrderNo,
    mergeBatchNo: payload.sourceContext.sourceMergeBatchNo || undefined,
    productionOrderNo: payload.baseBiz.productionOrderNo || undefined,
    ticketNo: payload.ticket.ticketNo || undefined,
  }
}
