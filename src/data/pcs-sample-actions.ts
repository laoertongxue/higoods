import { getSampleAssetById, upsertSampleAsset } from './pcs-sample-asset-repository.ts'
import { listSampleLedgerEvents, upsertSampleLedgerEvent } from './pcs-sample-ledger-repository.ts'
import {
  SAMPLE_LEDGER_EVENT_NAME_MAP,
  type SampleAvailabilityStatus,
  type SampleCustodianType,
  type SampleInventoryStatus,
  type SampleLedgerEventRecord,
  type SampleLedgerEventType,
  type SampleLocationType,
  type SampleSourceDocType,
} from './pcs-sample-types.ts'

export interface SampleTransitionInput {
  sampleAssetId: string
  eventType: SampleLedgerEventType
  inventoryStatusAfter: SampleInventoryStatus
  availabilityAfter: SampleAvailabilityStatus
  locationType: SampleLocationType
  locationDisplay: string
  custodianType: SampleCustodianType
  custodianName: string
  operatorName: string
  note: string
  sourceModule: string
  sourceDocType: SampleSourceDocType | ''
  sourceDocCodePrefix?: string
  sourceDocCode?: string
  sourceDocId?: string
}

export interface SampleTransitionResult {
  asset: ReturnType<typeof getSampleAssetById>
  event: SampleLedgerEventRecord
}

function padNumber(value: number): string {
  return String(value).padStart(2, '0')
}

function formatBusinessDate(date: Date): string {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())} ${padNumber(date.getHours())}:${padNumber(date.getMinutes())}:${padNumber(date.getSeconds())}`
}

function formatCompactDate(date: Date): string {
  return `${date.getFullYear()}${padNumber(date.getMonth() + 1)}${padNumber(date.getDate())}`
}

function sanitizeCode(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase()
}

export function appendSampleTransition(input: SampleTransitionInput): SampleTransitionResult | null {
  const asset = getSampleAssetById(input.sampleAssetId)
  if (!asset) return null

  const now = new Date()
  const businessDate = formatBusinessDate(now)
  const compactDate = formatCompactDate(now)
  const eventCodePrefix = `LE-${compactDate}-`
  const eventSequence =
    listSampleLedgerEvents().filter((item) => item.ledgerEventCode.startsWith(eventCodePrefix)).length + 1
  const sequenceText = String(eventSequence).padStart(3, '0')
  const sourceDocId =
    input.sourceDocId || `${sanitizeCode(input.sampleAssetId).toLowerCase()}_${input.eventType.toLowerCase()}_${now.getTime()}`
  const sourceDocCode = input.sourceDocCode || `${input.sourceDocCodePrefix || 'SAMPLE'}-${compactDate}-${sequenceText}`
  const operatorName = input.operatorName || asset.updatedBy || '样衣管理员'

  const event: SampleLedgerEventRecord = {
    ledgerEventId: `sample_${input.eventType.toLowerCase()}_${sanitizeCode(input.sampleAssetId).toLowerCase()}_${now.getTime()}`,
    ledgerEventCode: `${eventCodePrefix}${sequenceText}`,
    eventType: input.eventType,
    eventName: SAMPLE_LEDGER_EVENT_NAME_MAP[input.eventType],
    sampleAssetId: asset.sampleAssetId,
    sampleCode: asset.sampleCode,
    sampleName: asset.sampleName,
    quantity: 1,
    responsibleSite: asset.responsibleSite,
    inventoryStatusBefore: asset.inventoryStatus,
    inventoryStatusAfter: input.inventoryStatusAfter,
    availabilityBefore: asset.availabilityStatus,
    availabilityAfter: input.availabilityAfter,
    locationBefore: asset.locationDisplay,
    locationAfter: input.locationDisplay,
    sourceModule: input.sourceModule,
    sourceDocType: input.sourceDocType,
    sourceDocId,
    sourceDocCode,
    projectId: asset.projectId,
    projectCode: asset.projectCode,
    projectName: asset.projectName,
    projectNodeId: asset.projectNodeId,
    workItemTypeCode: asset.workItemTypeCode,
    workItemTypeName: asset.workItemTypeName,
    operatorId: '',
    operatorName,
    businessDate,
    note: input.note,
    legacyProjectRef: asset.legacyProjectRef,
    legacyWorkItemInstanceId: asset.legacyWorkItemInstanceId,
    createdAt: businessDate,
    createdBy: operatorName,
  }

  upsertSampleLedgerEvent(event)
  const nextAsset = {
    ...asset,
    inventoryStatus: input.inventoryStatusAfter,
    availabilityStatus: input.availabilityAfter,
    locationType: input.locationType,
    locationCode: sanitizeCode(input.locationDisplay || asset.locationDisplay || asset.sampleCode) || asset.locationCode,
    locationDisplay: input.locationDisplay,
    custodianType: input.custodianType,
    custodianName: input.custodianName,
    sourceDocType: input.sourceDocType,
    sourceDocId,
    sourceDocCode,
    lastEventId: event.ledgerEventId,
    lastEventType: input.eventType,
    lastEventTime: businessDate,
    updatedAt: businessDate,
    updatedBy: operatorName,
  }

  upsertSampleAsset(nextAsset)
  return {
    asset: nextAsset,
    event,
  }
}

export function appendSampleTransitions(inputs: SampleTransitionInput[]): SampleTransitionResult[] {
  return inputs.map((item) => appendSampleTransition(item)).filter((item): item is SampleTransitionResult => Boolean(item))
}
