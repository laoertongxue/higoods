import type { EngineeringUploadedFile, EngineeringUploadPurpose } from './pcs-engineering-file-upload.ts'
import { captureEngineeringUploadedFiles } from './pcs-engineering-file-upload.ts'

const STORAGE_KEY = 'higood-pcs-engineering-task-uploads-v1'

export interface EngineeringTaskUploadGroup {
  taskId: string
  itemId: string
  purpose: EngineeringUploadPurpose
  files: EngineeringUploadedFile[]
}

let memoryGroups: EngineeringTaskUploadGroup[] | null = null

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
}

function cloneGroup(group: EngineeringTaskUploadGroup): EngineeringTaskUploadGroup {
  return { ...group, files: group.files.map((file) => ({ ...file })) }
}

function readGroups(): EngineeringTaskUploadGroup[] {
  if (memoryGroups) return memoryGroups
  if (canUseStorage()) {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as EngineeringTaskUploadGroup[]
      if (Array.isArray(parsed)) return (memoryGroups = parsed.map(cloneGroup))
    } catch { /* 使用空上传记录 */ }
  }
  return (memoryGroups = [])
}

function writeGroups(groups: EngineeringTaskUploadGroup[]): void {
  const nextGroups = groups.map(cloneGroup)
  if (canUseStorage()) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextGroups))
    } catch {
      throw new Error('文件已读取，但浏览器存储空间不足。请删除不需要的草稿文件后重试。')
    }
  }
  memoryGroups = nextGroups
}

export function listEngineeringTaskUploadedFiles(
  taskId: string,
  itemId = 'TASK',
  purpose?: EngineeringUploadPurpose,
): EngineeringUploadedFile[] {
  return readGroups()
    .filter((group) => group.taskId === taskId && group.itemId === itemId && (!purpose || group.purpose === purpose))
    .flatMap((group) => group.files)
    .map((file) => ({ ...file }))
}

export function getEngineeringTaskUploadedFile(fileId: string): EngineeringUploadedFile | undefined {
  const normalizedId = fileId.trim()
  if (!normalizedId) return undefined
  const file = readGroups().flatMap((group) => group.files).find((item) => item.fileId === normalizedId)
  return file ? { ...file } : undefined
}

export function compactEngineeringTaskUploadedFile<T extends Pick<EngineeringUploadedFile, 'fileId' | 'dataUrl'>>(file: T): T {
  return getEngineeringTaskUploadedFile(file.fileId)?.dataUrl ? { ...file, dataUrl: '' } : { ...file }
}

export function hydrateEngineeringTaskUploadedFile<T extends Pick<EngineeringUploadedFile, 'fileId' | 'dataUrl'>>(file: T): T {
  if (file.dataUrl) return { ...file }
  const stored = getEngineeringTaskUploadedFile(file.fileId)
  return stored?.dataUrl ? { ...file, dataUrl: stored.dataUrl } : { ...file }
}

export async function uploadEngineeringTaskFiles(input: {
  taskId: string
  itemId?: string
  purpose: EngineeringUploadPurpose
  files: FileList | File[]
  actor: { userId: string; userName: string; teamName: string }
  roundNo?: number
}): Promise<EngineeringUploadedFile[]> {
  if (!input.taskId.trim()) throw new Error('缺少任务信息，无法保存文件。')
  const itemId = input.itemId || 'TASK'
  const uploaded = await captureEngineeringUploadedFiles({
    files: input.files,
    purpose: input.purpose,
    actor: input.actor,
    roundNo: input.roundNo,
  })
  const groups = readGroups().map(cloneGroup)
  const existing = groups.find((group) => group.taskId === input.taskId && group.itemId === itemId && group.purpose === input.purpose)
  if (existing) existing.files.push(...uploaded)
  else groups.push({ taskId: input.taskId, itemId, purpose: input.purpose, files: uploaded })
  writeGroups(groups)
  return uploaded.map((file) => ({ ...file }))
}

export function removeEngineeringTaskUploadedFile(input: {
  taskId: string
  itemId?: string
  fileId: string
  locked?: boolean
}): void {
  if (input.locked) throw new Error('成果已经提交，不能删除本轮文件。返工时请上传新一轮成果。')
  const groups = readGroups().map(cloneGroup)
  const itemId = input.itemId || 'TASK'
  groups.forEach((group) => {
    if (group.taskId === input.taskId && group.itemId === itemId) {
      group.files = group.files.filter((file) => file.fileId !== input.fileId)
    }
  })
  writeGroups(groups.filter((group) => group.files.length > 0))
}

export function resetEngineeringTaskUploadRepository(): void {
  memoryGroups = []
  if (canUseStorage()) localStorage.removeItem(STORAGE_KEY)
}
