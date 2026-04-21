export type FcsQrType = 'TASK' | 'HANDOVER_ORDER' | 'HANDOVER_RECORD' | 'UNKNOWN'

function buildFcsQrValue(type: Exclude<FcsQrType, 'UNKNOWN'>, id: string): string {
  return `FCS:${type}:v1:${id}`
}

export function buildTaskQrValue(taskId: string): string {
  return buildFcsQrValue('TASK', taskId)
}

export function buildHandoverOrderQrValue(handoverOrderId: string): string {
  return buildFcsQrValue('HANDOVER_ORDER', handoverOrderId)
}

export function buildHandoverRecordQrValue(handoverRecordId: string): string {
  return buildFcsQrValue('HANDOVER_RECORD', handoverRecordId)
}

export function parseFcsQrValue(qrValue: string): {
  type: FcsQrType
  id?: string
  version?: string
} {
  const parts = qrValue.split(':')
  if (parts.length < 4 || parts[0] !== 'FCS') {
    return { type: 'UNKNOWN' }
  }

  const typeToken = parts[1]
  const versionToken = parts[2]
  const id = parts.slice(3).join(':')
  if (!id) {
    return { type: 'UNKNOWN' }
  }

  if (typeToken === 'TASK' || typeToken === 'HANDOVER_ORDER' || typeToken === 'HANDOVER_RECORD') {
    return {
      type: typeToken,
      id,
      version: versionToken,
    }
  }

  return { type: 'UNKNOWN' }
}
