export type PostFinishingDocumentKind = 'DELIVERY' | 'QC' | 'POST' | 'RECHECK' | 'OUTBOUND'

export type PostFinishingDeliveryTrigger = '车缝正常交出' | '公共PDA自助回货' | '管理端补登记'

export interface PostFinishingDocumentNumberRequest {
  kind: PostFinishingDocumentKind
  productionOrderNo: string
  sourceObjectId: string
  idempotencyKey: string
  sequence: number
  triggerSource?: PostFinishingDeliveryTrigger
  existingDocumentNos?: readonly string[]
}

export interface PostFinishingDocumentNumberRecord extends Omit<PostFinishingDocumentNumberRequest, 'existingDocumentNos'> {
  documentNo: string
  createdAt: string
}

const STORAGE_KEY = 'higood-fcs-post-finishing-document-numbering-v1'

function readPersistedRecords(): PostFinishingDocumentNumberRecord[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as PostFinishingDocumentNumberRecord[] : []
  } catch {
    return []
  }
}

let records = readPersistedRecords()

function persist(): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // 原型无 localStorage 时保留运行期编号事实。
  }
}

function compactProductionOrderNo(productionOrderNo: string): string {
  return productionOrderNo.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

function buildDocumentNo(input: PostFinishingDocumentNumberRequest): string {
  const sequence = String(input.sequence).padStart(2, '0')
  const compact = compactProductionOrderNo(input.productionOrderNo)
  switch (input.kind) {
    case 'DELIVERY':
      return `DEL-${compact}-${sequence}`
    case 'QC':
      return `${input.productionOrderNo}-${input.sequence}`
    case 'POST':
      return `HD-${compact}-${sequence}`
    case 'RECHECK':
      return `FC-${compact}-${sequence}`
    case 'OUTBOUND':
      return `FCK-${compact}-${sequence}`
  }
}

function readStrictQcSequence(productionOrderNo: string, documentNo: string): number {
  const prefix = `${productionOrderNo}-`
  if (!documentNo.startsWith(prefix)) return 0
  const suffix = documentNo.slice(prefix.length)
  if (!/^[1-9]\d*$/.test(suffix)) return 0
  const sequence = Number(suffix)
  return Number.isSafeInteger(sequence) ? sequence : 0
}

export function issuePostFinishingDocumentNumber(
  input: PostFinishingDocumentNumberRequest,
  now = new Date(),
): PostFinishingDocumentNumberRecord {
  const { existingDocumentNos = [], ...numberInput } = input
  const normalizedKey = numberInput.idempotencyKey.trim()
  if (!normalizedKey) throw new Error('缺少单号幂等键。')
  const existing = records.find((record) => record.kind === numberInput.kind && record.idempotencyKey === normalizedKey)
  if (existing) return { ...existing }

  const persistedMaximum = records
    .filter((record) => record.kind === 'QC' && record.productionOrderNo === numberInput.productionOrderNo)
    .reduce((maximum, record) => Math.max(maximum, record.sequence, readStrictQcSequence(numberInput.productionOrderNo, record.documentNo)), 0)
  const existingMaximum = existingDocumentNos
    .reduce((maximum, documentNo) => Math.max(maximum, readStrictQcSequence(numberInput.productionOrderNo, documentNo)), 0)
  const effectiveSequence = numberInput.kind === 'QC'
    ? Math.max(persistedMaximum, existingMaximum) + 1
    : numberInput.sequence
  const normalizedInput: Omit<PostFinishingDocumentNumberRequest, 'existingDocumentNos'> = {
    ...numberInput,
    sequence: effectiveSequence,
    idempotencyKey: normalizedKey,
  }
  const documentNo = buildDocumentNo(normalizedInput)
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
  records = []
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY)
  } catch {
    // 忽略原型存储不可用。
  }
}
