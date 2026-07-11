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
  // HMR 后 PDA 模块会提供新的 reader 引用；registry 保持单例并切换到最新来源。
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
