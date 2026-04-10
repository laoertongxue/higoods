import { listSampleAssets } from './pcs-sample-asset-repository.ts'
import { listSampleLedgerEvents } from './pcs-sample-ledger-repository.ts'
import { ensureSampleBootstrapInitialized } from './pcs-sample-project-writeback.ts'
import {
  SAMPLE_LEDGER_EVENT_NAME_MAP,
  type SampleAssetRecord,
  type SampleLedgerEventRecord,
} from './pcs-sample-types.ts'

export interface SampleInventoryViewItem {
  sampleAssetId: string
  sampleCode: string
  sampleName: string
  sampleType: string
  responsibleSite: string
  inventoryStatus: string
  availabilityStatus: string
  locationDisplay: string
  custodianName: string
  projectCode: string
  projectName: string
  workItemTypeName: string
  lastEventType: string
  lastEventTime: string
}

export interface SampleLedgerViewItem {
  ledgerEventId: string
  ledgerEventCode: string
  eventName: string
  sampleCode: string
  sampleName: string
  sourceDocType: string
  sourceDocCode: string
  projectCode: string
  projectName: string
  workItemTypeName: string
  responsibleSite: string
  businessDate: string
  operatorName: string
  inventoryStatusAfter: string
}

export interface SampleTransferGroup {
  key: string
  label: string
  events: SampleLedgerViewItem[]
}

function toInventoryViewItem(asset: SampleAssetRecord): SampleInventoryViewItem {
  return {
    sampleAssetId: asset.sampleAssetId,
    sampleCode: asset.sampleCode,
    sampleName: asset.sampleName,
    sampleType: asset.sampleType,
    responsibleSite: asset.responsibleSite,
    inventoryStatus: asset.inventoryStatus,
    availabilityStatus: asset.availabilityStatus,
    locationDisplay: asset.locationDisplay,
    custodianName: asset.custodianName,
    projectCode: asset.projectCode,
    projectName: asset.projectName,
    workItemTypeName: asset.workItemTypeName,
    lastEventType: asset.lastEventType ? SAMPLE_LEDGER_EVENT_NAME_MAP[asset.lastEventType] : '',
    lastEventTime: asset.lastEventTime,
  }
}

function toLedgerViewItem(event: SampleLedgerEventRecord): SampleLedgerViewItem {
  return {
    ledgerEventId: event.ledgerEventId,
    ledgerEventCode: event.ledgerEventCode,
    eventName: event.eventName,
    sampleCode: event.sampleCode,
    sampleName: event.sampleName,
    sourceDocType: event.sourceDocType,
    sourceDocCode: event.sourceDocCode,
    projectCode: event.projectCode,
    projectName: event.projectName,
    workItemTypeName: event.workItemTypeName,
    responsibleSite: event.responsibleSite,
    businessDate: event.businessDate,
    operatorName: event.operatorName,
    inventoryStatusAfter: event.inventoryStatusAfter,
  }
}

export function listSampleInventoryViewItems(): SampleInventoryViewItem[] {
  ensureSampleBootstrapInitialized()
  return listSampleAssets().map(toInventoryViewItem)
}

export function listSampleLedgerViewItems(): SampleLedgerViewItem[] {
  ensureSampleBootstrapInitialized()
  return listSampleLedgerEvents().map(toLedgerViewItem)
}

export function listSampleTransferGroups(): SampleTransferGroup[] {
  const events = listSampleLedgerViewItems()
  const groups: SampleTransferGroup[] = [
    {
      key: 'inbound',
      label: '入库流',
      events: events.filter((item) => ['到样签收', '核对入库', '归还入库', '盘点'].includes(item.eventName)),
    },
    {
      key: 'borrow',
      label: '借用流',
      events: events.filter((item) => ['预占锁定', '取消预占', '领用出库'].includes(item.eventName)),
    },
    {
      key: 'shipping',
      label: '寄送流',
      events: events.filter((item) => ['寄出', '签收'].includes(item.eventName)),
    },
    {
      key: 'returning',
      label: '退货流',
      events: events.filter((item) => ['退货', '处置'].includes(item.eventName)),
    },
  ]
  return groups
}
