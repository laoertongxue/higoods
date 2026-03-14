export type ProcessCreateKind = 'dye' | 'print'

export interface ProcessCreateDemandIntent {
  kind: ProcessCreateKind
  demandId: string
  sourceProductionOrderId: string
  materialCode: string
  materialName: string
  requiredQty: number
  unit: '米' | '片'
  sourceSummary: string
}

let pendingIntent: ProcessCreateDemandIntent | null = null

export function setProcessCreateDemandIntent(intent: ProcessCreateDemandIntent): void {
  pendingIntent = intent
}

export function consumeProcessCreateDemandIntent(kind: ProcessCreateKind): ProcessCreateDemandIntent | null {
  if (!pendingIntent || pendingIntent.kind !== kind) return null
  const current = pendingIntent
  pendingIntent = null
  return current
}
