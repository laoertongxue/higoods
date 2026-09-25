import type { SewingPickupSlipVersion, SewingPickupHandoverResult } from '../sewing-pickup-slips.ts'
import { ProductionContextReadError } from '../production-context-records.ts'
import { readCuttingRecords, commitCuttingRecords, type CuttingStoredRecord } from './cutting-record-repository.ts'
import { cuttingRecordFingerprint } from './cutting-record-identity.ts'

const key = 'higood:ppic:sewing-pickup-slips:v1'
const scopeId = 'retired-cut-piece-pickup:scope'
const versionCollection = 'retired-cut-piece-pickup-versions'
const resultCollection = 'retired-cut-piece-pickup-results'
interface Source { version: 1; versions: SewingPickupSlipVersion[]; handoverResults: SewingPickupHandoverResult[] }
const empty = (): Source => ({ version: 1, versions: [], handoverResults: [] })
let history = empty(), initialization: CuttingStoredRecord[] = [], ready = false
function parse(raw: string | null): Source {
  if (!raw) return empty()
  const data = JSON.parse(raw) as Source
  if (data.version !== 1 || !Array.isArray(data.versions) || !Array.isArray(data.handoverResults)) throw new Error('历史领料单格式不完整')
  if (data.versions.some(item => !item.versionId || !item.assignmentId || !Array.isArray(item.lines))
    || new Set(data.versions.map(item => item.versionId)).size !== data.versions.length
    || new Set(data.handoverResults.map(item => item.commandId)).size !== data.handoverResults.length) throw new Error('历史领料单身份不完整或重复')
  const versions = new Map(data.versions.map(item => [item.versionId, item]))
  for (const result of data.handoverResults) {
    const version = versions.get(result.versionId)
    if (!result.commandId || !version || !result.sourceRecordId || !Array.isArray(result.quantities)
      || result.quantities.some(line => !version.lines.some(item => item.lineId === line.lineId) || !Number.isFinite(line.actualQty) || line.actualQty < 0)) throw new Error('历史领料实交缺少原单或有效数量')
  }
  return data
}
function selected(source: Source): Source {
  const versions = source.versions.filter(item => item.objectKind === 'CUT_PIECE'), ids = new Set(versions.map(item => item.versionId))
  return { version: 1, versions, handoverResults: source.handoverResults.filter(item => ids.has(item.versionId)) }
}
function rows(source: Source): CuttingStoredRecord[] {
  return [...source.versions.map(value => ({ id: `${versionCollection}:${value.versionId}`, collection: versionCollection, value })),
    ...source.handoverResults.map(value => ({ id: `${resultCollection}:${value.commandId}`, collection: resultCollection, value }))]
}
export function validateRetiredCutPiecePickupHistory(records: CuttingStoredRecord[]): Source {
  const source: Source = { version: 1, versions: records.filter(row => row.collection === versionCollection).map(row => row.value as SewingPickupSlipVersion), handoverResults: records.filter(row => row.collection === resultCollection).map(row => row.value as SewingPickupHandoverResult) }
  parse(JSON.stringify(source))
  if (source.versions.some(item => item.objectKind !== 'CUT_PIECE')) throw new Error('裁片历史包含非裁片领料单')
  const map = new Map(records.map(row => [row.id, row]))
  if (rows(source).some(row => JSON.stringify(map.get(row.id)) !== JSON.stringify(row))) throw new Error('裁片领料历史身份不一致')
  const scope = records.find(row => row.id === scopeId)
  if (scope && (scope.collection !== 'retired-cut-piece-pickup-scopes' || ((scope.value as {phase?:string;version?:number}).phase !== 'COMPLETE' || (scope.value as {version?:number}).version !== 1))) throw new Error('历史领料核对标记不完整')
  return source
}
const marker = (): CuttingStoredRecord => ({ id: scopeId, collection: 'retired-cut-piece-pickup-scopes', value: { version: 1, phase: 'COMPLETE' } })
function legacy(): string | null { return typeof localStorage === 'undefined' ? null : localStorage.getItem(key) }
export function prepareRetiredCutPiecePickupHistory(records: CuttingStoredRecord[]): void {
  history = validateRetiredCutPiecePickupHistory(records)
  initialization = []
  if (!records.some(row => row.id === scopeId)) {
    try {
      if (selected(parse(legacy())).versions.length) throw new Error('发现旧裁片领料历史，请先迁移')
    } catch (error) { throw new ProductionContextReadError(`裁片历史来源尚未核对：${String(error)}。请恢复读取权限并迁移，未忽略历史实交。`) }
    initialization = [marker()]
  }
  ready = true
}
export function retiredCutPieceHistoryInitializationRecords(): CuttingStoredRecord[] { return structuredClone(initialization) }
export function assertRetiredCutPieceHistoryCurrent(): void {
  if (initialization.length && selected(parse(legacy())).versions.length) throw new Error('旧页面写入裁片领料历史，本次未保存，请先迁移。')
}
export function listRetiredCutPieceHandoverHistory(assignmentId: string) {
  const source = typeof window === 'undefined' || typeof document === 'undefined' ? selected(parse(legacy())) : history
  if (typeof window !== 'undefined' && typeof document !== 'undefined' && !ready) throw new Error('裁片历史尚未核对，请重新进入页面。')
  const versions = new Map(source.versions.filter(item => item.assignmentId === assignmentId).map(item => [item.versionId,item]))
  return source.handoverResults.filter(item => versions.has(item.versionId)).map(result => {
    const version = versions.get(result.versionId)!
    return { handoverRecordId: result.sourceRecordId, lines: result.quantities.map(quantity => {
      const line = version.lines.find(line => line.lineId === quantity.lineId)!
      return { skuCode: line.objectCode, color: line.color, size: line.size, partCode: line.sourcePartCode || line.part, pieceQty: quantity.actualQty }
    }) }
  })
}
/** 已停用裁片纸单没有新增入口；仅移走其历史，面辅料纸单继续留在原共享键。 */
export async function migrateRetiredCutPiecePickupHistory(input: { otherPagesClosed: boolean; progress: (message: string) => void }): Promise<number> {
  if (!input.otherPagesClosed) throw new Error('请先关闭其他 HiGood 页面并确认。')
  const raw = legacy(), source = parse(raw), archive = selected(source), targets = rows(archive)
  const fingerprint = await cuttingRecordFingerprint(JSON.stringify(targets))
  for (let offset = 0; offset < targets.length; offset += 100) {
    const snapshot = await readCuttingRecords(), existing = new Map(snapshot.records.map(row => [row.id,row]))
    const batch = targets.slice(offset,offset+100)
    if (batch.some(row => existing.has(row.id) && JSON.stringify(existing.get(row.id)) !== JSON.stringify(row))) throw new Error('裁片领料历史与已保存版本冲突，源记录未清理。')
    await commitCuttingRecords({ revision: snapshot.revision, change: { puts: batch.filter(row => !existing.has(row.id)) },
      assertSourcesCurrent: () => { if (legacy() !== raw) throw new Error('旧领料历史发生变化，迁移暂停，源记录保留。') },
      command: { id: `retired-pickup:${fingerprint}:${offset}`, intent: fingerprint, result: batch.length, at: new Date().toISOString() } })
    input.progress(`裁片历史迁移 ${Math.min(offset+100,targets.length)} / ${targets.length} 条，旧源仍保留。`)
  }
  const saved = await readCuttingRecords(), savedMap = new Map(saved.records.map(row => [row.id,row]))
  if (targets.some(row => JSON.stringify(savedMap.get(row.id)) !== JSON.stringify(row))) throw new Error('裁片历史读回不一致，未清理源记录。')
  if (legacy() !== raw) throw new Error('旧领料历史在核对后变化，未清理。')
  const ids = new Set(archive.versions.map(item => item.versionId)), retained = { ...source, versions: source.versions.filter(item => !ids.has(item.versionId)), handoverResults: source.handoverResults.filter(item => !ids.has(item.versionId)) }
  if (targets.length) {
    if (retained.versions.length || retained.handoverResults.length) localStorage.setItem(key,JSON.stringify(retained))
    else localStorage.removeItem(key)
  }
  if (selected(parse(legacy())).versions.length) throw new Error('旧裁片历史重新出现，迁移未完成。')
  const final = await readCuttingRecords()
  if (!final.records.some(row => row.id === scopeId)) await commitCuttingRecords({ revision: final.revision, change: { puts: [marker()] }, assertSourcesCurrent: () => { if (selected(parse(legacy())).versions.length) throw new Error('旧页面重写裁片历史，未标记完成。') }, command: { id: 'retired-pickup:complete', intent: 'retired-pickup:complete', result: true, at: new Date().toISOString() } })
  prepareRetiredCutPiecePickupHistory((await readCuttingRecords()).records)
  input.progress(`裁片领料历史已核对 ${targets.length} 条；其他领料单保持原样。`)
  return targets.length
}
