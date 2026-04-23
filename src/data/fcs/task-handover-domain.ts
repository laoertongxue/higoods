import {
  type HandoverObjectType,
  type HandoverOrderStatus,
  type HandoverReceiverKind,
  type HandoverRecordLifecycleStatus,
  type PdaHandoverHead,
  type PdaHandoverRecord,
} from './pda-handover-events.ts'
import {
  buildHandoverOrderQrValue,
  buildHandoverRecordQrValue,
} from './task-qr.ts'

export function getReceiverKindLabel(kind?: HandoverReceiverKind): string {
  if (kind === 'MANAGED_POST_FACTORY') return '我方后道工厂'
  return '仓库'
}

export function getReceiverDisplayName(
  source: Pick<PdaHandoverHead, 'receiverName' | 'targetName' | 'receiverKind'>,
): string {
  return source.receiverName || source.targetName || getReceiverKindLabel(source.receiverKind)
}

export function getRecordReceiverWrittenQty(
  record: Pick<PdaHandoverRecord, 'receiverWrittenQty' | 'warehouseWrittenQty'>,
): number | undefined {
  if (typeof record.receiverWrittenQty === 'number') return record.receiverWrittenQty
  if (typeof record.warehouseWrittenQty === 'number') return record.warehouseWrittenQty
  return undefined
}

export function getRecordReceiverWrittenAt(
  record: Pick<PdaHandoverRecord, 'receiverWrittenAt' | 'warehouseWrittenAt'>,
): string | undefined {
  return record.receiverWrittenAt || record.warehouseWrittenAt || undefined
}

export function getRecordReceiverWrittenBy(
  record: Pick<PdaHandoverRecord, 'receiverWrittenBy'>,
): string | undefined {
  return record.receiverWrittenBy || undefined
}

export function getRecordSubmittedQty(
  record: Pick<PdaHandoverRecord, 'submittedQty' | 'plannedQty'>,
): number {
  if (typeof record.submittedQty === 'number') return record.submittedQty
  if (typeof record.plannedQty === 'number') return record.plannedQty
  return 0
}

export function getRecordDiffQty(
  record: Pick<PdaHandoverRecord, 'submittedQty' | 'plannedQty' | 'receiverWrittenQty' | 'warehouseWrittenQty' | 'diffQty'>,
): number | undefined {
  if (typeof record.diffQty === 'number') return record.diffQty
  const writtenQty = getRecordReceiverWrittenQty(record)
  if (typeof writtenQty !== 'number') return undefined
  return writtenQty - getRecordSubmittedQty(record)
}

export function getHandoverOrderQrDisplayValue(
  head: Pick<PdaHandoverHead, 'handoverOrderQrValue' | 'qrCodeValue' | 'handoverOrderId' | 'handoverId'>,
): string {
  return head.handoverOrderQrValue
    || head.qrCodeValue
    || buildHandoverOrderQrValue(head.handoverOrderId || head.handoverId)
}

export function getHandoverRecordQrDisplayValue(
  record: Pick<PdaHandoverRecord, 'handoverRecordQrValue' | 'handoverRecordId' | 'recordId'>,
): string {
  return record.handoverRecordQrValue
    || buildHandoverRecordQrValue(record.handoverRecordId || record.recordId)
}

export function getHandoverObjectTypeLabel(type?: HandoverObjectType | 'GARMENT'): string {
  if (type === 'FABRIC') return '面料'
  if (type === 'CUT_PIECE') return '裁片'
  if (type === 'SEMI_FINISHED_GARMENT') return '半成品'
  return '成衣'
}

export function getHandoverOrderStatusLabel(status?: HandoverOrderStatus): string {
  if (status === 'AUTO_CREATED') return '已创建'
  if (status === 'OPEN') return '可交出'
  if (status === 'PARTIAL_SUBMITTED') return '已部分交出'
  if (status === 'WAIT_RECEIVER_WRITEBACK') return '待回写'
  if (status === 'PARTIAL_WRITTEN_BACK') return '部分回写'
  if (status === 'WRITTEN_BACK') return '已回写'
  if (status === 'DIFF_WAIT_FACTORY_CONFIRM') return '差异待确认'
  if (status === 'HAS_OBJECTION') return '有异议'
  if (status === 'OBJECTION_PROCESSING') return '异议处理中'
  if (status === 'CLOSED') return '已关闭'
  return '可交出'
}

export function getHandoverRecordStatusLabel(
  status?: HandoverRecordLifecycleStatus | PdaHandoverRecord['status'],
): string {
  if (status === 'SUBMITTED_WAIT_WRITEBACK' || status === 'PENDING_WRITEBACK') return '待回写'
  if (status === 'WRITTEN_BACK_MATCHED' || status === 'WRITTEN_BACK') return '已回写'
  if (status === 'WRITTEN_BACK_DIFF') return '差异待确认'
  if (status === 'DIFF_ACCEPTED') return '已接受差异'
  if (status === 'OBJECTION_REPORTED') return '已发起异议'
  if (status === 'OBJECTION_PROCESSING') return '异议处理中'
  if (status === 'OBJECTION_RESOLVED') return '异议已处理'
  if (status === 'VOIDED') return '已作废'
  return '待回写'
}

export function canReceiverWriteback(
  record: Pick<PdaHandoverRecord, 'handoverRecordStatus' | 'status'>,
): boolean {
  return record.handoverRecordStatus === 'SUBMITTED_WAIT_WRITEBACK' || record.status === 'PENDING_WRITEBACK'
}

export function canHandleDiff(
  record: Pick<PdaHandoverRecord, 'handoverRecordStatus'>,
): boolean {
  return record.handoverRecordStatus === 'WRITTEN_BACK_DIFF'
}
