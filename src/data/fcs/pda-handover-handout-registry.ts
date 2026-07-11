import type { PdaHandoverHead, PdaHandoverRecord } from './pda-handover-events.ts'

export const handoverHeadAdditions = new Map<string, PdaHandoverHead>()
export const handoutRecordAdditions = new Map<string, PdaHandoverRecord[]>()
export const handoutRecordOverrides = new Map<string, Partial<PdaHandoverRecord>>()
let listCompleteHeads: (() => PdaHandoverHead[]) | null = null
let listCompleteRecords: ((handoverId: string) => PdaHandoverRecord[]) | null = null
let completeReaderOwner = ''
let completeReaderInstallToken: symbol | null = null

function normalizeModuleOwner(ownerUrl: string): string {
  if (!ownerUrl.trim()) throw new Error('交出单完整只读来源缺少模块归属')
  try {
    const url = new URL(ownerUrl)
    return `${url.origin}${url.pathname}`
  } catch {
    return ownerUrl.split(/[?#]/, 1)[0]
  }
}

export function installCompleteHandoutReaders(
  headReader: () => PdaHandoverHead[],
  recordReader: (handoverId: string) => PdaHandoverRecord[],
  ownerUrl: string,
): () => void {
  const owner = normalizeModuleOwner(ownerUrl)
  if (completeReaderOwner && completeReaderOwner !== owner) throw new Error('交出单完整只读来源仅允许原安装模块热替换')
  const token = Symbol(owner)
  listCompleteHeads = headReader
  listCompleteRecords = recordReader
  completeReaderOwner = owner
  completeReaderInstallToken = token
  return () => {
    if (completeReaderInstallToken !== token) return
    listCompleteHeads = null
    listCompleteRecords = null
    completeReaderOwner = ''
    completeReaderInstallToken = null
  }
}

export function listRegisteredHandoutHeads(): PdaHandoverHead[] {
  if (listCompleteHeads) return listCompleteHeads().filter((head) => head.headType === 'HANDOUT')
  return Array.from(handoverHeadAdditions.values()).filter((head) => head.headType === 'HANDOUT')
}

export function listRegisteredHandoutRecords(handoverId: string): PdaHandoverRecord[] {
  const complete = listCompleteRecords?.(handoverId) ?? []
  const merged = new Map(complete.map((record) => [record.handoverRecordId || record.recordId, record]))
  for (const record of handoutRecordAdditions.get(handoverId) ?? []) {
    merged.set(record.handoverRecordId || record.recordId, {
      ...record,
      ...(handoutRecordOverrides.get(record.recordId) ?? {}),
    })
  }
  return Array.from(merged.values())
}
