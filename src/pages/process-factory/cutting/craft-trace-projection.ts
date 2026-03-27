import {
  CUTTING_QR_VERSION,
  type CraftTraceValidationResult,
  validateFeiCraftSequence,
} from '../../../data/fcs/cutting/qr-codes.ts'
import {
  getFeiTicketById,
  getFeiTicketByNo,
} from '../../../data/fcs/cutting/generated-fei-tickets.ts'
import {
  buildFcsCuttingDomainSnapshot,
  type CuttingDomainSnapshot,
} from '../../../domain/fcs-cutting-runtime/index.ts'
import {
  buildActiveTicketPocketBindingMap,
  type TransferBagStore,
} from './transfer-bags-model'
import {
  deserializeFeiQrPayload,
} from './fei-qr-model.ts'
import type { FeiTicketLabelRecord } from './fei-tickets-model'
import {
  buildCuttingTraceabilityProjectionContext,
} from './traceability-projection-helpers'

export interface CraftTraceProjectionItem {
  feiTicketId: string
  feiTicketNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderNo: string
  materialSku: string
  secondaryCrafts: string[]
  craftSequenceVersion: string
  currentCraftStage: string
  completedCrafts: string[]
  validation: CraftTraceValidationResult
  carrierCode: string
  usageNo: string
  qrValue: string
}

export interface CraftTraceProjection {
  items: CraftTraceProjectionItem[]
  itemsByTicketId: Record<string, CraftTraceProjectionItem>
  itemsByTicketNo: Record<string, CraftTraceProjectionItem>
}

export function buildCraftTraceProjection(
  snapshot: CuttingDomainSnapshot = buildFcsCuttingDomainSnapshot(),
  options?: {
    transferBagStore?: TransferBagStore
    ticketRecords?: FeiTicketLabelRecord[]
    currentCraftType?: string
    completedCraftsByTicketId?: Record<string, string[]>
  },
): CraftTraceProjection {
  const context = buildCuttingTraceabilityProjectionContext(snapshot, options?.transferBagStore)
  const ticketRecords = options?.ticketRecords || context.ticketRecords
  const activeBindings = buildActiveTicketPocketBindingMap(context.transferBagStore)

  const items = ticketRecords.map((record) => {
    const generated = getFeiTicketById(record.ticketRecordId) || getFeiTicketByNo(record.ticketNo)
    const payload = deserializeFeiQrPayload(record.qrSerializedValue || record.qrValue)
    const secondaryCrafts = payload?.secondaryCrafts || generated?.secondaryCrafts || record.processTags || []
    const craftSequenceVersion = payload?.craftSequenceVersion || generated?.craftSequenceVersion || CUTTING_QR_VERSION
    const currentCraftStage = payload?.currentCraftStage || generated?.currentCraftStage || ''
    const currentCraftType = options?.currentCraftType || currentCraftStage || secondaryCrafts[0] || ''
    const completedCrafts = options?.completedCraftsByTicketId?.[record.ticketRecordId] || []
    const validation =
      payload && currentCraftType
        ? validateFeiCraftSequence(payload, currentCraftType, completedCrafts)
        : {
            allowed: secondaryCrafts.length === 0,
            reason: secondaryCrafts.length ? '当前未指定扫码工艺，已保留正式顺序数据。' : '当前菲票未配置二级工艺顺序。',
            currentCraftType,
            requiredPreviousCrafts: [],
          }
    const binding = activeBindings[record.ticketRecordId]

    return {
      feiTicketId: generated?.feiTicketId || record.ticketRecordId,
      feiTicketNo: generated?.feiTicketNo || record.ticketNo,
      originalCutOrderId: record.originalCutOrderId,
      originalCutOrderNo: record.originalCutOrderNo,
      productionOrderNo: record.productionOrderNo,
      materialSku: record.materialSku,
      secondaryCrafts,
      craftSequenceVersion,
      currentCraftStage,
      completedCrafts,
      validation,
      carrierCode: binding?.pocketNo || record.boundPocketNo || '',
      usageNo: binding?.usageNo || record.boundUsageNo || '',
      qrValue: record.qrSerializedValue || record.qrValue,
    }
  })

  return {
    items,
    itemsByTicketId: Object.fromEntries(items.map((item) => [item.feiTicketId, item])),
    itemsByTicketNo: Object.fromEntries(items.map((item) => [item.feiTicketNo, item])),
  }
}
