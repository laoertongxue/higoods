import { buildWoolFactWorkflowMockStore } from './mock-data.ts'
import type {
  WoolCompletionRecord,
  WoolHandoverRecord,
  WoolMachine,
  WoolMachineAssociation,
  WoolMachineAssociationLog,
  WoolOperationLog,
  WoolProcessReportRecord,
  WoolQtyChangeLog,
  WoolWarehouseFlow,
  WoolWorkOrder,
  WoolYarnIssueRecord,
  WoolYarnReceiptRecord,
  WoolYarnReturnRecord,
} from './types.ts'

export const WOOL_DOMAIN_STORE_KEY = 'higood-fcs-wool-domain-store-v2'

export interface WoolDomainStore {
  workOrders: Record<string, WoolWorkOrder>
  yarnReceipts: WoolYarnReceiptRecord[]
  yarnIssues: WoolYarnIssueRecord[]
  yarnReturns: WoolYarnReturnRecord[]
  processReports: WoolProcessReportRecord[]
  handovers: WoolHandoverRecord[]
  qtyChangeLogs: WoolQtyChangeLog[]
  warehouseFlows: WoolWarehouseFlow[]
  completions: WoolCompletionRecord[]
  machines: WoolMachine[]
  machineAssociations: WoolMachineAssociation[]
  machineAssociationLogs: WoolMachineAssociationLog[]
  operationLogs: WoolOperationLog[]
}

type WoolStorage = Pick<Storage, 'getItem' | 'setItem'>

let memoryStore: WoolDomainStore | undefined

function cloneStore(store: WoolDomainStore): WoolDomainStore {
  return structuredClone(store)
}

function getStorage(): WoolStorage | null {
  const candidate = (globalThis as { localStorage?: WoolStorage }).localStorage
  return candidate?.getItem && candidate?.setItem ? candidate : null
}

function validateRecordArray(store: WoolDomainStore, field: keyof WoolDomainStore): void {
  if (!Array.isArray(store[field])) throw new Error(`毛织存储校验失败：${field} 必须是数组`)
}

export function validateWoolStore(store: WoolDomainStore): void {
  if (!store || typeof store !== 'object') throw new Error('毛织存储校验失败：存储对象无效')
  if (!store.workOrders || typeof store.workOrders !== 'object' || Array.isArray(store.workOrders)) {
    throw new Error('毛织存储校验失败：workOrders 必须是对象')
  }
  for (const [woolOrderId, order] of Object.entries(store.workOrders)) {
    if (!woolOrderId || order.woolOrderId !== woolOrderId || !order.woolOrderNo) {
      throw new Error(`毛织存储校验失败：加工单 ${woolOrderId || '未知'} 身份无效`)
    }
    if (!Array.isArray(order.outputPlanLines) || order.outputPlanLines.length === 0) {
      throw new Error(`毛织存储校验失败：加工单 ${woolOrderId} 缺少加工后 SKU`)
    }
  }
  for (const field of [
    'yarnReceipts',
    'yarnIssues',
    'yarnReturns',
    'processReports',
    'handovers',
    'qtyChangeLogs',
    'warehouseFlows',
    'completions',
    'machines',
    'machineAssociations',
    'machineAssociationLogs',
    'operationLogs',
  ] as const) {
    validateRecordArray(store, field)
  }
}

function readPersistedStore(): WoolDomainStore | undefined {
  const raw = getStorage()?.getItem(WOOL_DOMAIN_STORE_KEY)
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as WoolDomainStore
    validateWoolStore(parsed)
    return parsed
  } catch {
    return undefined
  }
}

export function readWoolStore(): WoolDomainStore {
  if (!memoryStore) {
    memoryStore = readPersistedStore() ?? buildWoolFactWorkflowMockStore()
    validateWoolStore(memoryStore)
  }
  return cloneStore(memoryStore)
}

export function replaceWoolStore(nextStore: WoolDomainStore): WoolDomainStore {
  const draft = cloneStore(nextStore)
  validateWoolStore(draft)
  const serialized = JSON.stringify(draft)
  getStorage()?.setItem(WOOL_DOMAIN_STORE_KEY, serialized)
  memoryStore = draft
  return cloneStore(draft)
}

export function commitWoolStore(
  mutator: (draft: WoolDomainStore) => void,
): WoolDomainStore {
  const draft = readWoolStore()
  mutator(draft)
  validateWoolStore(draft)
  const serialized = JSON.stringify(draft)
  getStorage()?.setItem(WOOL_DOMAIN_STORE_KEY, serialized)
  memoryStore = draft
  return cloneStore(draft)
}
