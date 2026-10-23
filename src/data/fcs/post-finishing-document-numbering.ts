import { assertPostFinishingWrite, registerPostFinishingRepository } from './post-finishing-records.ts'
export type PostFinishingDocumentKind = 'DELIVERY' | 'QC' | 'POST' | 'RECHECK' | 'OUTBOUND'

export type PostFinishingDeliveryTrigger = '车缝正常交出' | '公共PDA自助回货' | '管理端补登记'

export interface PostFinishingDocumentNumberRequest {
  kind: PostFinishingDocumentKind
  productionOrderNo: string
  sourceObjectId: string
  idempotencyKey: string
  sequence: number
  childSequence?: number
  sourceDocumentNo?: string
  triggerSource?: PostFinishingDeliveryTrigger
  existingDocumentNos?: readonly string[]
}

export interface PostFinishingDocumentNumberRecord extends Omit<PostFinishingDocumentNumberRequest, 'existingDocumentNos'> {
  documentNo: string
  createdAt: string
}


function readPersistedRecords(): PostFinishingDocumentNumberRecord[] { return [] }

let records = readPersistedRecords()

// 仅固定演示数据的同步初始化暂缓保存；普通业务操作仍即时保存。
let demoPersistence: 'idle' | 'save' | 'remove' | undefined

export function beginPostFinishingNumberingDemoBatch() {
  const before = structuredClone(records)
  demoPersistence = 'idle'
  return {
    commit(): void {
    },
    rollback(): void { records = before },
    finish(): void { demoPersistence = undefined },
  }
}

function persist(): void { assertPostFinishingWrite() }

export function buildPostFinishingDocumentNo(input: PostFinishingDocumentNumberRequest): string {
  if (!input.productionOrderNo.trim() || !Number.isInteger(input.sequence) || input.sequence < 1) throw new Error('生产单号或回货次数无效。')
  if (input.kind === 'DELIVERY') return `${input.productionOrderNo}-${input.sequence}`
  const source = input.sourceDocumentNo?.trim()
  if (!source) throw new Error('缺少实际来源单号，不能生成下游单据。')
  const suffix = { QC: 'ZJ', POST: 'HD', RECHECK: 'FJ', OUTBOUND: 'CH' }[input.kind]
  return `${source}-${suffix}${input.kind === 'RECHECK' && input.childSequence ? `-${String(input.childSequence).padStart(3, '0')}` : ''}`
}

export function issuePostFinishingDocumentNumber(
  input: PostFinishingDocumentNumberRequest,
  now = new Date(),
): PostFinishingDocumentNumberRecord {
  assertPostFinishingWrite()
  const { existingDocumentNos = [], ...numberInput } = input
  const normalizedKey = numberInput.idempotencyKey.trim()
  if (!normalizedKey) throw new Error('缺少单号幂等键。')
  const existing = records.find((record) => record.kind === numberInput.kind && record.idempotencyKey === normalizedKey)
  if (existing) return { ...existing }

  const normalizedInput = { ...numberInput, idempotencyKey: normalizedKey }
  const documentNo = buildPostFinishingDocumentNo(normalizedInput)
  const conflict = records.find((record) => record.kind === numberInput.kind && record.documentNo === documentNo)
  if (conflict && conflict.sourceObjectId !== numberInput.sourceObjectId) {
    throw new Error(`单号 ${documentNo} 已被其他业务对象占用。`)
  }
  const record: PostFinishingDocumentNumberRecord = {
    ...normalizedInput,
    documentNo,
    createdAt: now.toISOString(),
  }
  records.push(record)
  persist()
  return { ...record }
}

export function listPostFinishingDocumentNumberRecords(): PostFinishingDocumentNumberRecord[] {
  return records.map((record) => ({ ...record }))
}

export function resetPostFinishingDocumentNumbering(): void {
  assertPostFinishingWrite()
  records = []
  if (demoPersistence !== undefined) { demoPersistence = 'remove'; return }
  assertPostFinishingWrite()
}

registerPostFinishingRepository('numbering', () => records, value => { records = value })
