import {
  getEngineeringMasterOrderById,
  submitEngineeringTaskResult,
} from './pcs-engineering-master-repository'
import {
  assertEngineeringUploadedFilesReady,
  type EngineeringUploadedFile,
} from './pcs-engineering-file-upload.ts'
import type { EngineeringTaskType } from './pcs-engineering-master-types'

const STORAGE_KEY = 'higood:pcs:engineering-pattern-results:v1'
const PATTERN_TASK_TYPES: EngineeringTaskType[] = [
  'BASE_PATTERN_WOVEN',
  'BASE_PATTERN_KNIT',
  'SIZE_PATTERN_WOVEN',
  'SIZE_PATTERN_KNIT',
]

export interface EngineeringPatternResultVersion {
  resultVersionId: string
  masterOrderId: string
  taskId: string
  versionNo: number
  versionLabel: string
  patternKind: '基码纸样' | '齐码纸样'
  materialKind: '梭织' | '毛织'
  applicableSizes: string[]
  sourceFiles: EngineeringUploadedFile[]
  previewFiles: EngineeringUploadedFile[]
  imageUrls: string[]
  prjFiles: string[]
  pdfFiles: string[]
  dxfFiles: string[]
  rulFiles: string[]
  note: string
  submittedBy: string
  submittedAt: string
  replacedVersionId: string
}

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function clone(item: EngineeringPatternResultVersion): EngineeringPatternResultVersion {
  const sourceFiles = Array.isArray(item.sourceFiles) ? item.sourceFiles.map((file) => ({ ...file })) : []
  const previewFiles = Array.isArray(item.previewFiles) ? item.previewFiles.map((file) => ({ ...file })) : []
  return {
    ...item,
    applicableSizes: [...item.applicableSizes],
    sourceFiles,
    previewFiles,
    imageUrls: [...(item.imageUrls || [])],
    prjFiles: [...(item.prjFiles || [])],
    pdfFiles: [...item.pdfFiles],
    dxfFiles: [...item.dxfFiles],
    rulFiles: [...item.rulFiles],
  }
}

function readAll(): EngineeringPatternResultVersion[] {
  if (!canUseStorage()) return []
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.map(clone) : []
  } catch {
    return []
  }
}

function writeAll(items: EngineeringPatternResultVersion[]): void {
  if (!canUseStorage()) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function nowText(): string {
  return new Date().toLocaleString('zh-CN', { hour12: false })
}

function splitValues(values: string[]): string[] {
  return values.map((item) => item.trim()).filter(Boolean)
}

export function listEngineeringPatternResultVersions(taskId: string): EngineeringPatternResultVersion[] {
  return readAll()
    .filter((item) => item.taskId === taskId)
    .sort((left, right) => right.versionNo - left.versionNo)
    .map(clone)
}

export function submitEngineeringPatternResult(input: {
  masterOrderId: string
  taskId: string
  applicableSizes: string[]
  sourceFiles: EngineeringUploadedFile[]
  previewFiles: EngineeringUploadedFile[]
  note: string
  submittedBy: string
}): EngineeringPatternResultVersion {
  const master = getEngineeringMasterOrderById(input.masterOrderId)
  if (!master) throw new Error('未找到来源工程主单。')
  const task = master.tasks.find((item) => item.taskId === input.taskId)
  if (!task || !PATTERN_TASK_TYPES.includes(task.taskType)) throw new Error('未找到制版任务。')
  const submittedBy = input.submittedBy.trim()
  if (!submittedBy) throw new Error('请填写成果提交人。')
  const applicableSizes = splitValues(input.applicableSizes)
  if (applicableSizes.length === 0) throw new Error('请至少填写一个适用尺码。')
  const sourceFiles = input.sourceFiles.map((file) => ({ ...file }))
  const previewFiles = input.previewFiles.map((file) => ({ ...file }))
  assertEngineeringUploadedFilesReady(sourceFiles, '纸样源文件')
  assertEngineeringUploadedFilesReady(previewFiles, '纸样预览图')
  const imageUrls = previewFiles.map((file) => file.dataUrl)
  const prjFiles = sourceFiles.filter((file) => file.extension === 'prj').map((file) => file.fileName)
  const pdfFiles = sourceFiles.filter((file) => file.extension === 'pdf').map((file) => file.fileName)
  const dxfFiles = sourceFiles.filter((file) => file.extension === 'dxf').map((file) => file.fileName)
  const rulFiles = sourceFiles.filter((file) => file.extension === 'rul').map((file) => file.fileName)
  if (prjFiles.length === 0) throw new Error('请上传纸样 PRJ 源文件。')
  if (imageUrls.length === 0) throw new Error('请上传纸样预览图。')
  const existing = listEngineeringPatternResultVersions(task.taskId)
  if (task.status !== '已完成') {
    submitEngineeringTaskResult(master.masterOrderId, task.taskId, {
      resultImageIds: imageUrls,
      submittedBy,
    })
  }
  const versionNo = (existing[0]?.versionNo || 0) + 1
  const submittedAt = nowText()
  const record: EngineeringPatternResultVersion = {
    resultVersionId: `${task.taskId}-PV-${versionNo}`,
    masterOrderId: master.masterOrderId,
    taskId: task.taskId,
    versionNo,
    versionLabel: `v${versionNo}.0`,
    patternKind: task.taskType.startsWith('BASE_PATTERN') ? '基码纸样' : '齐码纸样',
    materialKind: task.taskType.endsWith('KNIT') ? '毛织' : '梭织',
    applicableSizes,
    sourceFiles,
    previewFiles,
    imageUrls,
    prjFiles,
    pdfFiles,
    dxfFiles,
    rulFiles,
    note: input.note.trim(),
    submittedBy,
    submittedAt,
    replacedVersionId: existing[0]?.resultVersionId || '',
  }
  writeAll([record, ...readAll()])
  return clone(record)
}

export function resetEngineeringPatternResultVersions(): void {
  if (canUseStorage()) localStorage.removeItem(STORAGE_KEY)
}
