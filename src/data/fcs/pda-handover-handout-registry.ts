import { getBrowserLocalStorage } from '../browser-storage.ts'
import type { PdaHandoverHead, PdaHandoverRecord, PdaHandoverStateSnapshot } from './pda-handover-events.ts'

export const handoverHeadAdditions = new Map<string, PdaHandoverHead>()
export const handoutRecordAdditions = new Map<string, PdaHandoverRecord[]>()
export const handoutRecordOverrides = new Map<string, Partial<PdaHandoverRecord>>()
export const handoutRecordVersionHistory = new Map<string, PdaHandoverRecord[]>()
let listCompleteHeads: (() => PdaHandoverHead[]) | null = null
let listCompleteRecords: ((handoverId: string) => PdaHandoverRecord[]) | null = null
let completeReaderOwner = ''
let completeReaderInstallToken: symbol | null = null
const FORMAL_HANDOUT_STORAGE_KEY = 'higood.formal-merged-handout-actions.v1'
let handoverStateAccess: {
  capture: () => PdaHandoverStateSnapshot
  restore: (state: PdaHandoverStateSnapshot) => void
} | null = null

/** Legacy cleanup must not load the PDA execution graph while process tasks initialize. */
export function installPdaHandoverStateAccess(
  capture: () => PdaHandoverStateSnapshot,
  restore: (state: PdaHandoverStateSnapshot) => void,
): void {
  handoverStateAccess = { capture, restore }
}

export function captureRegisteredPdaHandoverState(): PdaHandoverStateSnapshot {
  if (handoverStateAccess) return handoverStateAccess.capture()
  return structuredClone({
    persistedActionsRaw: getBrowserLocalStorage()?.getItem(FORMAL_HANDOUT_STORAGE_KEY) ?? null,
    handoverHeadAdditions: Array.from(handoverHeadAdditions.entries()),
    handoutRecordAdditions: Array.from(handoutRecordAdditions.entries()),
    handoutRecordOverrides: Array.from(handoutRecordOverrides.entries()),
    handoutRecordVersionHistory: Array.from(handoutRecordVersionHistory.entries()),
    pickupRecordAdditions: [], pickupRecordOverrides: [], headCompletionOverrides: [],
    cachedBuiltHeads: null, cachedPostFinishingBuiltHeads: null,
  })
}

export function restoreRegisteredPdaHandoverState(state: PdaHandoverStateSnapshot): void {
  if (handoverStateAccess) { handoverStateAccess.restore(state); return }
  const restored = structuredClone(state)
  handoverHeadAdditions.clear()
  handoutRecordAdditions.clear()
  handoutRecordOverrides.clear()
  handoutRecordVersionHistory.clear()
  restored.handoverHeadAdditions.forEach(([id, value]) => handoverHeadAdditions.set(id, value))
  restored.handoutRecordAdditions.forEach(([id, value]) => handoutRecordAdditions.set(id, value))
  restored.handoutRecordOverrides.forEach(([id, value]) => handoutRecordOverrides.set(id, value))
  restored.handoutRecordVersionHistory.forEach(([id, value]) => handoutRecordVersionHistory.set(id, value))
  // Private pickup maps are not initialized yet; PDA will load the cleaned persistent rows later.
  const storage = getBrowserLocalStorage()
  if (Object.prototype.hasOwnProperty.call(restored, 'persistedActionsRaw') && storage?.getItem(FORMAL_HANDOUT_STORAGE_KEY) !== restored.persistedActionsRaw) {
    if (restored.persistedActionsRaw == null) storage?.removeItem?.(FORMAL_HANDOUT_STORAGE_KEY)
    else storage?.setItem?.(FORMAL_HANDOUT_STORAGE_KEY, restored.persistedActionsRaw)
  }
}

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

export function listRegisteredHandoutRecordVersions(runtimeTaskIds?: readonly string[]): PdaHandoverRecord[] {
  const targetTaskIds = runtimeTaskIds ? new Set(runtimeTaskIds) : null
  const records = listRegisteredHandoutHeads()
    .filter((head) => !targetTaskIds || targetTaskIds.has(head.taskId))
    .flatMap((head) => listRegisteredHandoutRecords(head.handoverId))
    .filter((record) => !targetTaskIds || targetTaskIds.has(record.taskId))
  const history = targetTaskIds
    ? Array.from(targetTaskIds).flatMap((taskId) => handoutRecordVersionHistory.get(taskId) ?? [])
    : Array.from(handoutRecordVersionHistory.values()).flat()
  return [
    ...history,
    ...records,
  ]
}
