import { openCuttingRecordDatabase, commitCuttingRecords, type CuttingStoredRecord, type CuttingStoredCommand } from './cutting-record-repository.ts'
import { cuttingRecordUuid } from './cutting-record-identity.ts'

function fileIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(fileIds)
  if (!value || typeof value !== 'object') return []
  const data = value as Record<string, unknown>
  if ('$productionFile' in data) {
    if (Object.keys(data).length !== 1 || typeof data.$productionFile !== 'string' || !/^production-context-file:[a-f0-9]{64}$/.test(data.$productionFile)) throw new Error('附件引用格式不完整，未进行恢复或清理。')
    return [data.$productionFile]
  }
  return Object.values(data).flatMap(fileIds)
}
export function validateCuttingFileReferences(records: CuttingStoredRecord[], commands: CuttingStoredCommand[], files: Array<{ id: string; blob: Blob }>): void {
  const available = new Set(files.map(file => file.id))
  const references = [...records.flatMap(record => fileIds(record.value)), ...commands.flatMap(command => fileIds(command.result))]
  if (references.some(id => !available.has(id))) throw new Error('备份缺少业务记录或操作回执引用的附件，未恢复。')
}
export interface CuttingFileUsage { revision: number; total: number; bytes: number; orphanIds: string[]; orphanBytes: number }
export async function inspectCuttingFileUsage(): Promise<CuttingFileUsage> {
  const db = await openCuttingRecordDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['records', 'commands', 'files', 'meta'], 'readonly')
    const records = tx.objectStore('records').getAll(), commands = tx.objectStore('commands').getAll()
    const files = tx.objectStore('files').getAll(), revision = tx.objectStore('meta').get('revision')
    tx.onabort = () => reject(tx.error || new Error('附件检查未完成，请重试。'))
    tx.onerror = () => {}
    tx.oncomplete = () => {
      try {
        const refs = new Set([...(records.result as CuttingStoredRecord[]).flatMap(row => fileIds(row.value)), ...(commands.result as CuttingStoredCommand[]).flatMap(row => fileIds(row.result))])
        const entries = files.result as Array<{ id: string; blob: Blob }>
        validateCuttingFileReferences(records.result, commands.result, entries)
        // Only this feature's known content-addressed files are eligible. Unknown module files are retained.
        const orphan = entries.filter(file => /^production-context-file:[a-f0-9]{64}$/.test(file.id) && !refs.has(file.id))
        resolve({ revision: revision.result?.value || 0, total: entries.length, bytes: entries.reduce((sum, file) => sum + file.blob.size, 0), orphanIds: orphan.map(file => file.id), orphanBytes: orphan.reduce((sum, file) => sum + file.blob.size, 0) })
      } catch (error) { reject(error) }
    }
  })
}
/** Only called after the user confirms the concrete count shown by inspect. CAS protects new references. */
export async function removeConfirmedUnreferencedCuttingFiles(confirmed: CuttingFileUsage): Promise<number> {
  const current = await inspectCuttingFileUsage()
  if (current.revision !== confirmed.revision || JSON.stringify([...current.orphanIds].sort()) !== JSON.stringify([...confirmed.orphanIds].sort())) throw new Error('附件引用已变化，本次未清理，请重新检查并确认。')
  if (!current.orphanIds.length) return 0
  await commitCuttingRecords({ revision: current.revision, change: { puts: [], deleteFileIds: current.orphanIds },
    command: { id: `cutting-file-cleanup:${cuttingRecordUuid()}`, intent: JSON.stringify(current.orphanIds), result: { deletedFileIds: current.orphanIds }, at: new Date().toISOString() } })
  return current.orphanIds.length
}
