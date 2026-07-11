import type { PdaHandoverHead, PdaHandoverRecord } from './pda-handover-events.ts'

export const handoverHeadAdditions = new Map<string, PdaHandoverHead>()
export const handoutRecordAdditions = new Map<string, PdaHandoverRecord[]>()
export const handoutRecordOverrides = new Map<string, Partial<PdaHandoverRecord>>()
let listCompleteHeads: (() => PdaHandoverHead[]) | null = null
let listCompleteRecords: ((handoverId: string) => PdaHandoverRecord[]) | null = null

export function installCompleteHandoutReaders(
  headReader: () => PdaHandoverHead[],
  recordReader: (handoverId: string) => PdaHandoverRecord[],
): void {
  if ((listCompleteHeads && listCompleteHeads !== headReader) || (listCompleteRecords && listCompleteRecords !== recordReader)) {
    throw new Error('交出单完整只读来源已安装，不可重复覆盖')
  }
  listCompleteHeads = headReader
  listCompleteRecords = recordReader
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
