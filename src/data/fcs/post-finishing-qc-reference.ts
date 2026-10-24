import { assertPostFinishingWrite, registerPostFinishingRepository } from './post-finishing-records.ts'
export type PostFinishingQcReferenceType = '色差参考图' | '尺寸判断标准'
export type PostFinishingQcReferenceSource = '买手上传' | 'QC代上传'

export interface PostFinishingQcReferenceRecord {
  referenceId: string
  deliveryId: string
  deliveryOrderNo: string
  productionOrderNo: string
  qcTaskId?: string
  qcTaskNo?: string
  referenceType: PostFinishingQcReferenceType
  title: string
  description: string
  imageUrl?: string
  source: PostFinishingQcReferenceSource
  sourceNote?: string
  uploaderId: string
  uploaderName: string
  uploadedAt: string
  version: number
}


function readPersistedRecords(): PostFinishingQcReferenceRecord[] { return [] }

let records = readPersistedRecords()

// 仅固定演示数据的同步初始化暂缓保存；普通业务操作仍即时保存。
let demoPersistence: 'idle' | 'save' | 'remove' | undefined

export function beginPostFinishingQcReferenceDemoBatch() {
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

function cloneRecord(record: PostFinishingQcReferenceRecord): PostFinishingQcReferenceRecord {
  return { ...record }
}

export function uploadPostFinishingQcReference(input: {
  deliveryId: string
  deliveryOrderNo: string
  productionOrderNo: string
  qcTaskId?: string
  qcTaskNo?: string
  referenceType: PostFinishingQcReferenceType
  title: string
  description: string
  imageUrl?: string
  source: PostFinishingQcReferenceSource
  sourceNote?: string
  uploaderId: string
  uploaderName: string
  uploadedAt?: string
}): PostFinishingQcReferenceRecord {
  assertPostFinishingWrite()
  if (!input.title.trim()) throw new Error('请填写质检参考资料名称。')
  if (!input.description.trim() && !input.imageUrl) throw new Error('请填写判断标准或上传参考图片。')
  if (input.source === 'QC代上传' && !input.sourceNote?.trim()) {
    throw new Error('QC代上传时必须注明买手通过飞书提供资料等实际来源。')
  }
  const version = records.filter((record) => (
    record.deliveryId === input.deliveryId && record.referenceType === input.referenceType
  )).length + 1
  const record: PostFinishingQcReferenceRecord = {
    ...input,
    referenceId: `PF-QCREF-${String(records.length + 1).padStart(6, '0')}`,
    title: input.title.trim(),
    description: input.description.trim(),
    sourceNote: input.sourceNote?.trim(),
    uploadedAt: input.uploadedAt || new Date().toISOString(),
    version,
  }
  records.push(record)
  persist()
  return cloneRecord(record)
}

export function bindPostFinishingQcReferences(input: {
  deliveryId: string
  qcTaskId: string
  qcTaskNo: string
}): PostFinishingQcReferenceRecord[] {
  assertPostFinishingWrite()
  const unbound = records.filter((record) => record.deliveryId === input.deliveryId && !record.qcTaskId)
  unbound.forEach((record) => {
    record.qcTaskId = input.qcTaskId
    record.qcTaskNo = input.qcTaskNo
  })
  if (unbound.length) persist()
  return records.filter((record) => record.qcTaskId === input.qcTaskId).map(cloneRecord)
}

export function listPostFinishingQcReferences(input: {
  deliveryId?: string
  qcTaskId?: string
} = {}): PostFinishingQcReferenceRecord[] {
  return records
    .filter((record) => {
      if (input.deliveryId && record.deliveryId !== input.deliveryId) return false
      if (input.qcTaskId && record.qcTaskId !== input.qcTaskId) return false
      return true
    })
    .sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt))
    .map(cloneRecord)
}

export function resetPostFinishingQcReferences(): void {
  assertPostFinishingWrite()
  records = []
  if (demoPersistence !== undefined) { demoPersistence = 'remove'; return }
  assertPostFinishingWrite()
}

registerPostFinishingRepository('references', () => records, value => { records = value })
