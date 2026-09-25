import { exportCuttingRecordBackup, validateCuttingRecordBackup, type CuttingRecordBackup } from './cutting-record-repository.ts'

const MAGIC = 'HIGCUT01'
/** 文件字节保留为二进制段，业务 JSON 只记录长度及类型，不转 Base64。 */
export async function buildCuttingBackupFile(): Promise<Blob> {
  const backup = await exportCuttingRecordBackup()
  const metadata = new TextEncoder().encode(JSON.stringify({ ...backup,
    files: backup.files.map(file => ({ id: file.id, size: file.blob.size, type: file.blob.type })) }))
  const size = new Uint8Array(4); new DataView(size.buffer).setUint32(0, metadata.byteLength)
  return new Blob([MAGIC, size, metadata, ...backup.files.map(file => file.blob)], { type: 'application/octet-stream' })
}
export async function readCuttingBackupFile(file: Blob): Promise<CuttingRecordBackup> {
  if (file.size < 12 || await file.slice(0, 8).text() !== MAGIC) throw new Error('请选择 HiGood 裁后处理备份文件。')
  const length = new DataView(await file.slice(8, 12).arrayBuffer()).getUint32(0)
  if (length > file.size - 12) throw new Error('备份文件不完整，未恢复。')
  const metadata = JSON.parse(await file.slice(12, 12 + length).text())
  if (!Array.isArray(metadata.files)) throw new Error('备份附件目录缺失。')
  let offset = 12 + length
  const files = metadata.files.map((entry: { id: string; size: number; type: string }) => {
    if (!Number.isSafeInteger(entry.size) || entry.size < 0 || offset + entry.size > file.size) throw new Error('备份附件内容不完整。')
    const blob = file.slice(offset, offset + entry.size, entry.type); offset += entry.size
    return { id: entry.id, blob }
  })
  if (offset !== file.size) throw new Error('备份包含未登记内容，未恢复。')
  const backup = { ...metadata, files }; validateCuttingRecordBackup(backup); return backup
}
