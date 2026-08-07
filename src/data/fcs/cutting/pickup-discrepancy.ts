import { getBrowserLocalStorage, type BrowserStorageLike } from '../../browser-storage.ts'
import type { PickupNodeCarrierType } from './pickup-node-domain.ts'

export type PickupDiscrepancyStatus = '待主管处理' | '已处理'

export interface PickupDiscrepancyRecord {
  discrepancyId: string
  productionOrderId: string
  productionOrderNo: string
  pickupNodeId: string
  pickupNodeVersion: number
  demandLineId: string
  materialSku: string
  materialName: string
  differenceQty: number
  unit: string
  carrierType: PickupNodeCarrierType
  carrierLabel: string
  palletUnnumbered: boolean
  operatorName: string
  reportedAt: string
  note: string
  photoName: string
  status: PickupDiscrepancyStatus
  supervisorRequestedBy: string
  supervisorRequestedAt: string
  handledBy: string
  handledAt: string
  resolution: string
}

export type PickupDiscrepancyInput = Omit<
  PickupDiscrepancyRecord,
  | 'discrepancyId'
  | 'reportedAt'
  | 'status'
  | 'supervisorRequestedBy'
  | 'supervisorRequestedAt'
  | 'handledBy'
  | 'handledAt'
  | 'resolution'
>

export type PickupActiveNodeResolver = (
  pickupNodeId: string,
) => {
  nodeId: string
  version: number
  items: Array<{ prepLineId: string; materialSku: string; unit: string }>
} | null

const STORAGE_KEY = 'higood.fcs.cutting.pickup-discrepancies.v1'

function nowText(): string {
  return new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replaceAll('/', '-')
}

function readRecords(storage: BrowserStorageLike | null): PickupDiscrepancyRecord[] {
  if (!storage) return []
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRecords(records: PickupDiscrepancyRecord[], storage: BrowserStorageLike | null): void {
  storage?.setItem(STORAGE_KEY, JSON.stringify(records))
}

export function listPickupDiscrepancies(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PickupDiscrepancyRecord[] {
  return structuredClone(readRecords(storage))
}

export function reportPickupDiscrepancy(
  input: PickupDiscrepancyInput,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
  resolveActiveNode?: PickupActiveNodeResolver,
): PickupDiscrepancyRecord {
  if (!input.pickupNodeId || input.pickupNodeVersion <= 0) {
    throw new Error('当前待领节点或版本无效，请重新进入接收任务。')
  }
  if (!input.demandLineId || !input.materialSku || !input.unit) {
    throw new Error('请选择存在差异的物料。')
  }
  if (!Number.isFinite(input.differenceQty) || input.differenceQty <= 0) {
    throw new Error('差异数量必须大于 0。')
  }
  if (!input.note.trim() && !input.photoName.trim()) {
    throw new Error('请上传现场照片或填写现场说明。')
  }
  if (!resolveActiveNode) throw new Error('缺少当前待领节点解析器，不能上报差异。')
  const activeNode = resolveActiveNode(input.pickupNodeId)
  if (!activeNode) throw new Error('当前待领节点已失效，请重新进入接收任务。')
  if (activeNode.nodeId !== input.pickupNodeId) {
    throw new Error('当前待领节点身份不一致，请重新进入接收任务。')
  }
  if (activeNode.version !== input.pickupNodeVersion) {
    throw new Error('当前待领节点版本已更新，请重新核对后再上报差异。')
  }
  if (!activeNode.items.some((item) =>
    item.prepLineId === input.demandLineId
    && item.materialSku === input.materialSku
    && item.unit === input.unit
  )) {
    throw new Error('差异物料不属于当前待领节点，请重新选择。')
  }
  const records = readRecords(storage)
  const existing = records.find((record) =>
    record.pickupNodeId === input.pickupNodeId
    && record.pickupNodeVersion === input.pickupNodeVersion
    && record.demandLineId === input.demandLineId
    && record.status === '待主管处理'
  )
  if (existing) return structuredClone(existing)
  const reportedAt = nowText()
  const record: PickupDiscrepancyRecord = {
    ...input,
    discrepancyId: `pickup-difference:${input.pickupNodeId}:v${input.pickupNodeVersion}:${Date.now()}`,
    reportedAt,
    status: '待主管处理',
    supervisorRequestedBy: '',
    supervisorRequestedAt: '',
    handledBy: '',
    handledAt: '',
    resolution: '',
  }
  writeRecords([record, ...records], storage)
  return structuredClone(record)
}

export function resolvePickupDiscrepancy(
  discrepancyId: string,
  input: { handledBy: string; resolution: string },
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PickupDiscrepancyRecord | null {
  if (!input.handledBy.trim() || !input.resolution.trim()) {
    throw new Error('主管处理人和处理结论不能为空。')
  }
  const records = readRecords(storage)
  const record = records.find((item) => item.discrepancyId === discrepancyId)
  if (!record) return null
  record.status = '已处理'
  record.handledBy = input.handledBy.trim()
  record.handledAt = nowText()
  record.resolution = input.resolution.trim()
  writeRecords(records, storage)
  return structuredClone(record)
}

export function requestPickupDiscrepancySupervisor(
  discrepancyId: string,
  operatorName: string,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PickupDiscrepancyRecord | null {
  const records = readRecords(storage)
  const record = records.find((item) => item.discrepancyId === discrepancyId)
  if (!record) return null
  record.supervisorRequestedBy = operatorName
  record.supervisorRequestedAt = nowText()
  writeRecords(records, storage)
  return structuredClone(record)
}

export function assertPickupNodeHasNoOpenDiscrepancy(
  pickupNodeId: string,
  pickupNodeVersion: number,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): void {
  const discrepancy = readRecords(storage).find((record) =>
    record.pickupNodeId === pickupNodeId
    && record.pickupNodeVersion === pickupNodeVersion
    && record.status === '待主管处理'
  )
  if (discrepancy) {
    throw new Error(`当前节点存在接收差异待主管处理（${discrepancy.materialName}），不可确认接收。`)
  }
}
